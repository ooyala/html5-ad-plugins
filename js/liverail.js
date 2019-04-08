/*
 * Liverail Ad Manager
 * owner: Ooyala - Playback Interface Team
 * version: 0.1
 *
 * Integration docs can be found at: http://support.liverail.com/technical-docs/iab/vpaid-integration
 * VPAID docs can be found at: http://www.iab.net/media/file/VPAID_2.0_Final_04-10-2012.pdf
 *
 */

const {
  isFunction,
  extend,
  each,
} = require('underscore');

OO.Ads.manager(() => {
  // There are quite a few more of these events, see the linked VPAID docs above
  const VPAID_EVENTS = {
    AD_LOADED: 'AdLoaded',
    AD_STARTED: 'AdStarted',
    AD_STOPPED: 'AdStopped',
    AD_IMPRESSION: 'AdImpression',
    AD_CLICK_THRU: 'AdClickThru',
    AD_PAUSED: 'AdPaused',
    AD_PLAYING: 'AdPlaying',
    AD_VIDEO_START: 'AdVideoStart',
    AD_VIDEO_COMPLETE: 'AdVideoComplete',
    AD_ERROR: 'AdError',
    AD_LOG: 'AdLog',
  };

  /**
   * @class Liverail
   * @classDesc The Liverail class.
   * @constructor
   */
  const Liverail = function () {
    // core
    this.name = 'liverail-ads-manager';
    let amc = null;
    let liverailVPAIDManager = null;
    let remoteModuleJs = null;
    let liverailFrame = null;
    this.environmentVariables = {};

    // module state
    this.ready = false;
    this.initTime = Date.now();
    let adModuleJsReady = false;
    let iframeLoaded = false;
    let metadataFetched = false;

    // ad settings
    let adPlaying = false;
    let startAfterLoad = false;
    let adLoaded = false;
    const slotEndedCallback = null;
    const slotStartedCallback = null;
    const adStartedCallback = null;
    let adEndedCallback = null;
    let countdownIntervalId = null;

    // /// Helpers /////
    /**
     * Log.
     */
    const log = (...args) => {
      if (isFunction(OO.log)) {
        OO.log.apply(null, ['liverail-ads-manager:'].concat(args));
      } else {
        console.log(['liverail-ads-manager:'].concat(args));
      }
    };

    /**
     * Try init.
     * @private
     */
    const _tryInit = () => {
      if (!adModuleJsReady || !metadataFetched) return;
      this.ready = true;
      amc.onAdManagerReady(this.name);
      amc.reportPluginLoaded(Date.now() - this.initTime, this.name);
    };

    /**
     * Reset ad state.
     * @private
     */
    const _resetAdState = () => {
      startAfterLoad = false;
      adLoaded = false;
      adPlaying = false;
      adEndedCallback = null;
    };

    /**
     * Update Countdown.
     * @private
     */
    const _updateCountdown = () => {
      const remainingTime = liverailVPAIDManager.getAdRemainingTime();
      if (this.environmentVariables.LR_LAYOUT_SKIN_MESSAGE) {
        const message = ('Advertisement: Your video will resume in {COUNTDOWN} seconds.')
          .replace('{COUNTDOWN}', remainingTime)
          .replace('seconds', remainingTime === 1 ? 'second' : 'seconds');
        amc.ui.updateCustomAdMarquee(message);
      } else {
        amc.ui.updateAdMarqueeTime(remainingTime);
      }
    };

    /**
     * On Ad Event.
     * @param {Array} args The array of arguments.
     * @private
     */
    const _onAdEvent = (...args) => {
      const [eventName, logData] = args;
      if (eventName !== VPAID_EVENTS.AD_LOG) {
        log(eventName, 'fired with args', args.slice(1));
      }

      switch (eventName) {
        case VPAID_EVENTS.AD_LOADED:
          adLoaded = true;
          if (startAfterLoad) {
            liverailVPAIDManager.startAd();
          }
          break;
        case VPAID_EVENTS.AD_STARTED:
          if (slotStartedCallback) {
            slotStartedCallback();
          }
          break;
        case VPAID_EVENTS.AD_IMPRESSION:
          if (adStartedCallback) {
            adStartedCallback();
          }
          countdownIntervalId = setInterval(() => {
            _updateCountdown();
          }, 500);
          break;
        case VPAID_EVENTS.AD_CLICK_THRU:
          amc.adsClicked();
          break;
        case VPAID_EVENTS.AD_VIDEO_COMPLETE:
          if (adEndedCallback) {
            adEndedCallback();
          }
          break;
        case VPAID_EVENTS.AD_STOPPED:
          clearInterval(countdownIntervalId);
          if (slotEndedCallback) {
            slotEndedCallback();
          }
          _resetAdState();
          break;
        case VPAID_EVENTS.AD_ERROR:
          // TODO: call ad ended callback if an ad was active
          if (slotEndedCallback && adPlaying) {
            slotEndedCallback();
          }
          _resetAdState();
          break;
        case VPAID_EVENTS.AD_LOG:
          log('LIVERAIL AD LOG -', logData);
          break;
        default:
        // do nothing
      }
    };

    /**
     * On sdk loaded.
     * @private
     */
    const _onSdkLoaded = () => {
      log('SDK loaded');
      adModuleJsReady = true;

      liverailVPAIDManager = liverailFrame.contentWindow.getVPAIDAd();
      liverailVPAIDManager.handshakeVersion('2.0');

      each(VPAID_EVENTS, (eventName) => {
        liverailVPAIDManager.subscribe(() => {
          _onAdEvent(VPAID_EVENTS[eventName]);
        }, VPAID_EVENTS[eventName]);
      });

      _tryInit();
    };

    /**
     * Try load sdk.
     * @private
     */
    const _tryLoadSdk = () => {
      if ((remoteModuleJs == null) || !iframeLoaded) return;
      const loader = liverailFrame.contentWindow.document.createElement('script');
      loader.src = remoteModuleJs;
      loader.onload = _onSdkLoaded;
      loader.onerror = this.destroy;
      liverailFrame.contentWindow.document.body.appendChild(loader);
      _tryInit();
    };

    this.registerUi = () => {
      remoteModuleJs = (amc.ui.isSSL ? 'https://cdn-static-secure.liverail.com/js/LiveRail.AdManager-1.0.js'
        : 'http://cdn-static.liverail.com/js/LiveRail.AdManager-1.0.js');
      _tryLoadSdk();
    };

    this.loadMetadata = (pageAndBacklotMetadata, baseMetadata) => {
      metadataFetched = true;

      let tags;
      let pair;
      let i;
      const params = {};

      /**
       * Is Lr param.
       * @param {string} key The Lr param.
       * @returns {boolean} Returns true if key = 'LR_...'
       */
      const isLrParam = key => (typeof key === 'string') && (key.indexOf('LR_') === 0);

      // load parameters from movie level custom metadata from backlot
      if (baseMetadata && (typeof baseMetadata === 'object')) {
        // This is needed because the LiveRail ad source provides nonstandard means of incorporating
        // movie-level metadata and this is how it makes it into metadata
        each(baseMetadata, (key) => {
          if (isLrParam(key)) {
            params[key] = key;
          }
        });
      }

      if (pageAndBacklotMetadata && (typeof pageAndBacklotMetadata === 'object')) {
        // load parameters set in backdoor 3rd party module settings
        each(pageAndBacklotMetadata, (key) => {
          if (isLrParam(key)) {
            params[key] = key;
          }
        });

        // load parameters from backlot ad-set level
        // Ad tag url parameters override all
        if (typeof pageAndBacklotMetadata.tagUrl === 'string') {
          // If the parameter is a real URL, decode it
          const requiresDecode = (pageAndBacklotMetadata.tagUrl.indexOf('http') === 0);
          tags = pageAndBacklotMetadata.tagUrl.split('&');
          for (i = 0; i < tags.length; i++) {
            pair = tags[i].split('=');
            if (isLrParam(pair[0]) && pair[1].length > 0) {
              params[pair[0]] = requiresDecode ? decodeURI(pair[1]) : pair[1];
            }
          }
        }
      }

      this.environmentVariables = extend(params, this.environmentVariables);
      if (amc.movieDuration) {
        this.environmentVariables.LR_VIDEO_DURATION = Math.max(amc.movieDuration, 1);
      }

      _tryInit();
    };

    // Currently we only support 1 ad
    // Currently we only support linear ads
    this.buildTimeline = () => {
      if (!this.environmentVariables.LR_VIDEO_POSITION) return [];
      const positionString = this.environmentVariables.LR_VIDEO_POSITION.replace('%', '');
      const positionPercent = parseInt(Number.isNaN(positionString) ? 0 : positionString, 10);
      // If postroll, use MaxValue in case the movie duration is off by milliseconds from the playhead
      const position = (positionPercent === 100)
        ? Number.MAX_VALUE
        : positionPercent / 100 * amc.movieDuration;
      return [
        new amc.Ad({
          position,
          duration: liverailVPAIDManager.getAdDuration(),
          adManager: this.name,
          ad: liverailVPAIDManager,
          adType: (liverailVPAIDManager.getAdLinear() ? amc.ADTYPE.LINEAR_VIDEO
            : amc.ADTYPE.NONLINEAR_OVERLAY),
        }),
      ];
    };

    // /// Playback /////

    /**
     * Callback for when we receive the INITIAL_PLAY_REQUESTED and REPLAY_REQUESTED events from the AMC.
     * @method Liverail#_playbackBeginning
     * @private
     */
    const _playbackBeginning = () => {
      const creativeData = {};
      const environmentVariables = extend({
        slot: amc.ui.videoWrapper[0],
        // slot: amc.ui.adWrapper[0],
        videoSlot: amc.ui.adVideoElement[0],
        videoSlotCanAutoPlay: true, // based on LR engineer's comment, need to set it to true
      }, this.environmentVariables);

      // TODO: This actually shouldn't be done now in case the window is small for the ad lifetime.
      //       This should be done within seconds before ad playback.
      // initAd is defined in the VPAID spec:
      // http://www.iab.net/media/file/VPAIDFINAL51109.pdf
      liverailVPAIDManager.initAd(amc.ui.adVideoElement[0].offsetWidth, amc.ui.adVideoElement[0].offsetHeight,
        'normal', 600, creativeData, environmentVariables);
    };

    this.playAd = (ad) => {
      adEndedCallback = () => amc.notifyLinearAdEnded(ad.id);
      adPlaying = true;

      // On iOS and Android devices, playback will not start if LiveRail dispatches an ad error event. The
      // device will assume the video play event is not user-initiated. This tricks the device into thinking
      // the video element is already playing (will not work for pre-5.0 iOS devices)
      if (ad.position === 0) {
        amc.ui.ooyalaVideoElement[0].load();
      }

      // If not yet loaded, call startAd in loaded
      if (adLoaded) {
        liverailVPAIDManager.startAd();
      } else {
        startAfterLoad = true;
      }
    };

    /**
     * On Iframe Loaded.
     * @private
     */
    const _onIframeLoaded = () => {
      log('iframe loaded');
      iframeLoaded = true;
      _tryLoadSdk();
    };

    // /// Setup /////
    this.initialize = (amcInterface) => {
      amc = amcInterface;
      amc.addPlayerListener(amc.EVENTS.INITIAL_PLAY_REQUESTED, _playbackBeginning);
      amc.addPlayerListener(amc.EVENTS.REPLAY_REQUESTED, _playbackBeginning);
      log('Initializing SDK');
      liverailFrame = document.createElement('iframe');
      liverailFrame.style.display = 'none';
      liverailFrame.onload = _onIframeLoaded;
      document.body.appendChild(liverailFrame);
    };

    this.cancelAd = () => {
      // if the input is null, cancel the current ad
      if (!adPlaying) return;
      liverailVPAIDManager.stopAd();
      if (adEndedCallback) {
        adEndedCallback();
      }
      _resetAdState();
    };

    this.pauseAd = () => {
      liverailVPAIDManager.pauseAd();
    };

    this.resumeAd = () => {
      liverailVPAIDManager.resumeAd();
    };

    this.destroy = () => {
      this.cancelAd();
      // TODO: reset all variables
    };
  };

  return new Liverail();
});
