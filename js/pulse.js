/*
 * Pulse ad player ad manager
 */

(function () {
  const pulseAdManagers = {};


  OO.Ads.manager(function () {
    const log = () => {
      const args = Array.prototype.slice.call(arguments);
      if (OO.Pulse) {
        if (OO.Pulse.Utils.logTagged) {
          args.unshift([{ tag: 'v4', color: '#69388E' }]);
          OO.Pulse.Utils.logTagged.apply(null, args);
        } else {
          OO.Pulse.Utils.log.apply(null, args);
        }
      } else {
        args.unshift('OO.Pulse: ');
        console.log.apply(window.console, args);
      }
    };

    const AD_MODULE_STATE = {
      UNINITIALIZED: 'uninitialized',
      LOADING: 'loading',
      READY: 'ready',
      FAILED: 'failed',
    };

    /**
     * @class PulseAdManager
     * @classDesc The Pulse Ad Manager class.
     * @public
     */
    const PulseAdManager = function () {
      this.name = 'videoplaza-ads-manager';// mandatory to get the ad set info from Backlot
      this.ready = false; // Also mandatory so the player knows if the ad manager is ready
      this.initTime = Date.now();
      this.sharedVideoElement = null;// element we will share with the player on iphone
      this._contentMetadata = {};
      this._requestSettings = {};
      this._pulseHost = null;
      this._isControllingVideo = false;
      this.ui = null;

      let session = null;
      let isWaitingForPrerolls = false;
      let isInAdMode = false;
      let podStarted = null;
      let contentPaused = false;
      let currentOverlayAd = null;
      let overlayTimer = null;
      let lastOverlayAdStart = 0;
      let currentPauseAd = null;
      let overlayTimeLeftMillis = 0;
      let isFullscreen = false;
      let adPlayer = null; // pulse ad player
      let preferredRenderingMode = null;
      let amc = null;
      const pulseSDKUrl = '/proxy/pulse-sdk-html5/2.1/latest.min.js';
      let adModuleState = AD_MODULE_STATE.UNINITIALIZED;
      let enableDebugMode = false;
      let pluginCallbacks = {};
      let forcedSiteId;
      let previewAdId;
      let noPulseConfiguration = false;

      this.getAdPlayer = () => adPlayer;

      /**
       * Called by the AMF when the UI is ready.
       */
      this.registerUi = () => {
        this.ui = amc.ui;
        // Set the CSS overlay so it's responsive

        const style = document.createElement('style');
        const css = '.oo-ad-overlay-image { width:100% !important}'
          + ' .oo-ad-overlay {  margin:auto !important}';

        style.type = 'text/css';
        if (style.styleSheet) {
          style.styleSheet.cssText = css;
        } else {
          style.appendChild(document.createTextNode(css));
        }
        document.getElementsByTagName('head')[0].appendChild(style);

        if (amc.ui.useSingleVideoElement && !this.sharedVideoElement && amc.ui.ooyalaVideoElement[0]
          && (amc.ui.ooyalaVideoElement[0].className === 'video')) {
          this.sharedVideoElement = this.ui.ooyalaVideoElement[0];
        }
      };

      const mergeCommaSeparatedListsBase = (a, b) => {
        if (a) {
          if (b) {
            return `${a},${b}`;
          }
          return a;
        }
        return b;
      };

      const removeUndefinedElements = (args) => {
        const retArray = [];
        for (let i = 0, n = args.length; i < n; i++) {
          if (args[i]) {
            retArray.push(args[i]);
          }
        }
        return retArray;
      };

      const mergeCommaSeparatedStrings = () => {
        // Remove the undefined element first
        const params = removeUndefinedElements(arguments);
        const argsLentgh = params.length;

        switch (argsLentgh) {
          case 0:
            return undefined;
          case 1:
            return params[0];
          case 2:
            return mergeCommaSeparatedListsBase(params[0], params[1]);
          default:
            return mergeCommaSeparatedListsBase(params.shift(), mergeCommaSeparatedStrings(params));
        }
      };

      const getInsertionPointTypeFromAdPosition = (position) => {
        const PREROLL = 1;
        const INSTREAM = 2;
        const POSTROLL = 4;

        const pos = parseInt(position);
        const insertionPointFilter = [];

        /* eslint-disable no-bitwise */
        if (pos & PREROLL) {
          insertionPointFilter.push('onBeforeContent');
        }
        if (pos & INSTREAM) {
          insertionPointFilter.push('playbackPosition');
          insertionPointFilter.push('playbackTime');
        }
        if (pos & POSTROLL) {
          insertionPointFilter.push('onContentEnd');
        }
        /* eslint-enable no-bitwise */

        if (insertionPointFilter.length > 0) {
          // Always add pause ads
          insertionPointFilter.push('onPause');
        }

        return (insertionPointFilter.length !== 0 ? insertionPointFilter.join(',') : null);
      };

      const safeSplit = (array, char) => {
        if (array) {
          return array.split(char);
        }
        return null;
      };

      const safeMap = (array, func) => {
        if (array) {
          return array.map(func);
        }
        return null;
      };

      const cleanObject = (obj) => {
        for (const prop in obj) {
          if (obj[prop] === null || obj[prop] === undefined) {
            delete obj[prop];
          }
        }
      };

      const safeParseInt = (string) => {
        const val = parseInt(string);
        if (!val || isNaN(val)) {
          return null;
        }
        return val;
      };

      const getFlashVersion = () => {
        // ie
        try {
          try {
            const axo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash.6');
            try {
              axo.AllowScriptAccess = 'always';
            } catch (e) {
              return '6,0,0';
            }
          } catch (e) {
            // empty
          }
          return new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version').replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];
          // other browsers
        } catch (e) {
          try {
            if (navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin) {
              return (navigator.plugins['Shockwave Flash 2.0'] || navigator.plugins['Shockwave Flash']).description.replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];
            }
          } catch (e) {
            // empty
          }
        }
        return '0,0,0';
      };

      const getByPriority = () => {
        for (let i = 0, n = arguments.length; i < n; i++) {
          if (arguments[i] || arguments[i] === '') {
            return arguments[i];
          }
        }
        // If none of the passed objects exist
        return null;
      };

      const getProtocolFromPulseHost = (host) => {
        if (host.indexOf('https') === 0) { // Then it starts with https
          return 'https://';
        }
        return 'http://';
      };

      const getPulseAccount = (host) => {
        const regEx = /(?:https?:\/\/)?(.*)\/?/;
        return host.match(regEx)[1];
      };

      const getCategoryFromPlayerLevelShares = (shares) => {
        // Category is the first element
        const values = safeSplit(shares, ',');
        if (values && values.length !== 0) {
          return values[0];
        }
      };

      const getContentPartnerFromPlayerLevelShares = (shares) => {
        // Category is the first element
        const values = safeSplit(shares, ',');
        if (values && values.length === 2) {
          return values[1];
        }
      };

      const updateAdScreenPointerEventsEnabled = () => {
        const adScreens = document.getElementsByClassName('oo-ad-screen');
        const skinClickLayers = document.getElementsByClassName('oo-player-skin-plugins-click-layer');

        if (adScreens.length === 0) {
          if (!this.adScreenPointerEventsEnabled && !this.adScreenIntervalId) {
            this.adScreenIntervalId = setInterval((() => {
              // Ad screen may disappear before we hit this, so clear if we are not in an ad break anymore
              if (this._currentAdBreak === null) {
                clearInterval(this.adScreenIntervalId);
                this.adScreenIntervalId = undefined;
              } else {
                updateAdScreenPointerEventsEnabled();
              }
            }), 100);
          }
        } else {
          if (this.adScreenIntervalId) {
            clearInterval(this.adScreenIntervalId);
            this.adScreenIntervalId = undefined;
          }

          for (let i = 0; i < adScreens.length; ++i) {
            adScreens[i].style['pointer-events'] = this.adScreenPointerEventsEnabled ? 'auto' : 'none';
          }

          for (let i = 0; i < skinClickLayers.length; ++i) {
            skinClickLayers[i].style['pointer-events'] = this.adScreenPointerEventsEnabled ? 'auto' : 'none';
          }
        }
      };

      const enableAdScreenPointerEvents = () => {
        this.adScreenPointerEventsEnabled = true;
        updateAdScreenPointerEventsEnabled();
      };

      const disableAdScreenPointerEvents = () => {
        this.adScreenPointerEventsEnabled = false;
        updateAdScreenPointerEventsEnabled();
      };

      const makePlaceholderAd = (type, position) => {
        const streams = {};
        streams[OO.VIDEO.ENCODING.PULSE] = '';
        return new amc.Ad({
          position,
          duration: 42,
          adManager: this.name,
          ad: { type, placeholder: true },
          streams,
          adType: amc.ADTYPE.UNKNOWN_AD_REQUEST,
        });
      };


      // When the overlay shoule be removed
      const onOverlayFinished = () => {
        clearTimeout(overlayTimer);
        amc.notifyNonlinearAdEnded(currentOverlayAd.id);
        currentOverlayAd = null;
      };

      //
      const startOverlayCountdown = () => {
        lastOverlayAdStart = Date.now();
        overlayTimer = setTimeout(onOverlayFinished, overlayTimeLeftMillis);
      };

      // Called when the overlay is displayed
      const onOverlayShown = () => {
        if (currentOverlayAd) {
          overlayTimeLeftMillis = currentOverlayAd.ad.getDuration() * 1000;
          adPlayer.overlayAdShown(currentOverlayAd.ad);
          startOverlayCountdown();
        }
      };

      // Save the current display time of the overlay so it can be resumed later
      const overlayPause = () => {
        if (currentOverlayAd) {
          overlayTimeLeftMillis -= (Date.now() - lastOverlayAdStart);
          clearTimeout(overlayTimer);
        }
      };

      /**
       * When an ad is canceled
       * @param ad v4ad
       * @param params error code
       */
      this.cancelAd = (ad, params) => {
        // Only skip can happen
        if (params.code === 'skipped') {
          adPlayer.skipButtonClicked();
        } else if (session) {
          session.stopAdBreak();
        }
      };

      this.cancelOverlay = (v4ad) => {
        adPlayer.overlayAdClosed(v4ad.ad);
        clearTimeout(overlayTimer);
        currentOverlayAd = null;
      };

      /**
       * Pause the ad player
       * @param ad v4 ad
       */
      this.pauseAd = () => {
        if (adPlayer) {
          adPlayer.pause();
        }
      };

      /**
       * Resume the v4ad
       * @param ad
       */
      this.resumeAd = () => {
        if (adPlayer) {
          adPlayer.play();
        }
      };

      /**
       * <i>Optional.</i><br/>
       * Called when player clicks on the tap frame, if tap frame is disabled, then this function will not be
       * called
       * @method AdManager#playerClicked
       * @public
       */
      this.playerClicked = () => {
        if (this._currentAd) {
          const clickThroughURL = this._currentAd.getClickthroughURL();
          if (clickThroughURL) {
            this.openClickThrough(clickThroughURL);
          }
        } else if (this._currentOverlayAd) {
          adPlayer.overlayAdClicked(this._currentOverlayAd);
        } else if (this._currentPauseAd) {
          // TODO
        }
      };

      /**
       * Called by Ad Manager Controller.  The ad manager should destroy itself.  It will be unregistered by
       * the Ad Manager Controller.
       * @method AdManager#destroy
       * @public
       */
      this.destroy = () => {
        // Stop any running ads
        if (adPlayer) {
          adPlayer.destroy();
        }
      };

      this.registerVideoControllerWrapper = (videoPlugin) => {
        this.videoControllerWrapper = videoPlugin;
      };

      const _onContentChanged = () => {
        // Not needed rn
      };

      const _onContentPause = () => {
        contentPaused = true;
        if (adPlayer) {
          adPlayer.contentPaused();
        }
      };


      const _onContentResume = () => {
        contentPaused = false;

        if (currentPauseAd) {
          amc.notifyNonlinearAdEnded(currentPauseAd.id);
          currentPauseAd = null;
        }
        if (adPlayer) {
          adPlayer.contentStarted();
        }
      };


      this.notifyAdPodStarted = (id, adCount) => {
        if (!podStarted) {
          podStarted = id;
        }
        amc.notifyPodStarted(podStarted, adCount);
      };

      this.notifyAdPodEnded = () => {
        const podEndedId = podStarted;
        podStarted = null;
        amc.notifyPodEnded(podEndedId);
      };

      /**
       * Called by the Pulse SDK when an overlay should shown
       * @param pulseOverlayAd
       */
      this.showOverlayAd = (pulseOverlayAd) => {
        if (currentOverlayAd) {
          onOverlayFinished();
        }

        this._currentOverlayAd = pulseOverlayAd;

        amc.forceAdToPlay(this.name,
          pulseOverlayAd,
          amc.ADTYPE.NONLINEAR_OVERLAY,
          [pulseOverlayAd.getResourceURL()]);
      };

      // This method is called by the V4 AMF
      this.showOverlay = () => {
        if (currentOverlayAd) {
          startOverlayCountdown();
        }
      };

      this.hideOverlay = () => {
        overlayTimeLeftMillis -= (Date.now() - lastOverlayAdStart);
      };

      this.sessionEnded = () => {
        amc.adManagerDoneControllingAds();
      };

      this.openClickThrough = (url) => {
        window.open(url);
        if (adPlayer) {
          adPlayer.adClickThroughOpened();
        }
      };

      /**
       * Checks to see if the ad player is muted.
       * @protected
       * @method Pulse#muted
       * @returns {Boolean} True if the ad player is muted or does not exist yet, false otherwise.
       */
      this.muted = () => {
        let muted = true;
        if (adPlayer) {
          muted = adPlayer._muted;
        }
        return muted;
      };

      const playPlaceholder = () => {
        const streams = {};
        streams[OO.VIDEO.ENCODING.PULSE] = '';
        amc.forceAdToPlay(
          this.name,
          { placeholder: true },
          amc.ADTYPE.LINEAR_VIDEO,
          streams,
        );
      };

      const _onMainVideoTimeUpdate = (event, playheadTime) => {
        if (adPlayer) {
          adPlayer.contentPositionChanged(playheadTime);
        }
      };

      const _onPlayStarted = () => {
        if (adPlayer) {
          adPlayer.contentStarted();
        }
      };

      const _onContentFinished = () => {
        this._contentFinished = true;
        if (adPlayer) {
          adPlayer.contentFinished();
        }
      };

      const _onDeviceIdSet = (event, deviceId) => {
        if (!this._persistentId) {
          this._persistentId = deviceId;
        }
      };

      const _onSizeChanged = () => {
        if (adPlayer) {
          adPlayer.resize(-1,
            -1, isFullscreen);
          setTimeout(() => {
            adPlayer.resize(-1, -1, isFullscreen);
          }, 500);
        }
      };

      const _onFullscreenChanged = (event, shouldEnterFullscreen) => {
        isFullscreen = shouldEnterFullscreen;
        _onSizeChanged();
      };

      const _onInitialPlay = () => {
        if (!this.ready || noPulseConfiguration) {
          // Do not wait for prerolls, do not control ads
          return;
        }

        isWaitingForPrerolls = true;
        amc.adManagerWillControlAds();
        if (adModuleState === AD_MODULE_STATE.READY) {
          if (!adPlayer) {
            this.tryInitAdPlayer();
          }

          session = OO.Pulse.createSession(this._contentMetadata, this._requestSettings);

          // We start the Pulse session
          if (adPlayer) {
            adPlayer.startSession(session, this);
          }
        }
      };

      const _onReplay = () => {
        this._contentFinished = false;
        _onInitialPlay.call(this);
      };

      const _onAdFinished = () => {
        amc.notifyLinearAdEnded(1);
        enableAdScreenPointerEvents();
        this._currentAd = null;
      };

      const _onAdError = () => {
        enableAdScreenPointerEvents();
      };

      const _onAdSkipped = () => {
        amc.notifyLinearAdEnded(1);
        enableAdScreenPointerEvents();
        this._currentAd = null;
      };

      const _onAdBreakFinished = () => {
        this._currentAdBreak = null;
        this.notifyAdPodEnded();
      };

      const _onAdBreakStarted = (event, eventData) => {
        adPlayer.resize(-1,
          -1, isFullscreen);
        this._currentAdBreak = eventData.adBreak;
        this.notifyAdPodStarted(this._adBreakId, this._currentAdBreak.getPlayableAdsTotal());
      };

      const _onAdClicked = () => {
        this.videoControllerWrapper.togglePlayPause();
      };
      const _onAdPaused = () => {
        this.videoControllerWrapper.raisePauseEvent();
      };

      const _onAdPlaying = () => {
        this.videoControllerWrapper.raisePlayingEvent();
      };

      /**
       * Callback for when we receive the AD_VOLUME_CHANGED event from the Pulse SDK. We will ask
       * the video controller wrapper to notify the player of the volume change event.
       * @private
       * @method Pulse#_onAdVolumeChanged
       * @param {String} event The event name
       * @param {Object} metadata The metadata associated with the event
       */
      const _onAdVolumeChanged = (event, metadata) => {
        this.videoControllerWrapper.raiseVolumeEvent(metadata.volume, this.muted());
      };

      /**
       * Callback for when we receive the AD_PLAY_PROMISE_REJECTED event from the Pulse SDK. We will ask
       * the video controller wrapper to notify the player of the playback failure.
       * @private
       * @method Pulse#_onAdPlayPromiseRejected
       * @param {String} event The event name
       * @param {Object} metadata The metadata associated with the event
       */
      const _onAdPlayPromiseRejected = () => {
        if (this.muted()) {
          this.videoControllerWrapper.raiseMutedPlaybackFailed();
        } else {
          this.videoControllerWrapper.raiseUnmutedPlaybackFailed();
        }
      };

      const _onSessionStarted = () => {
        if (pluginCallbacks && pluginCallbacks.onSessionCreated) {
          pluginCallbacks.onSessionCreated(session);
        }
      };

      const _onAdTimeUpdate = (event, eventData) => {
        const duration = eventData.duration
          ? eventData.duration
          : this.currentAd.getCoreAd().creatives[0].duration;
        this.videoControllerWrapper.raiseTimeUpdate(eventData.position, duration);
      };

      const _onAdStarted = (event, eventData) => {
        this._currentAd = eventData.ad;

        // If we're playing a VPAID, don't let the player eat the pointer events
        const selectedMediaFile = this._currentAd.getMediaFiles()[0];
        if (selectedMediaFile.apiFramework && selectedMediaFile.apiFramework === 'VPAID') {
          log('Playing VPAID ad; disabling pointer events on player');
          disableAdScreenPointerEvents();
        }

        const clickThroughURL = this._currentAd.getClickthroughURL();
        const skipOffset = this._currentAd.getSkipOffset();
        let name = null;

        if (this._showAdTitle) {
          name = this._currentAd.getCoreAd().title;
        }

        amc.focusAdVideo();

        amc.notifyLinearAdStarted(1, {
          duration: this._currentAd.getCoreAd().creatives[0].duration,
          name,
          indexInPod: eventData.adPosition,
          skippable: this._currentAd.isSkippable(),
          hasClickUrl: !!clickThroughURL,
        });

        if (this._currentAd.isSkippable()) {
          amc.showSkipVideoAdButton(true, skipOffset.toString());
        } else {
          amc.showSkipVideoAdButton(false);
        }
        adPlayer.resize(-1,
          -1, isFullscreen);
      };

      const _onOverlayShown = () => {
        /* Impression is tracked by the SDK before this
                   handler is triggered, so nothing needs to be done here */
      };

      /**
       * Ad manager init
       *
       * Register the event listeners for everything the ad player will need
       * @param adManagerController
       * @param playerId
       */
      this.initialize = (adManagerController, playerId) => {
        amc = adManagerController; // the AMC is how the code interacts with the player
        pulseAdManagers[playerId] = this;

        // Add any player event listeners now
        amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, _onContentChanged);
        amc.addPlayerListener(amc.EVENTS.PAUSED, _onContentPause);
        amc.addPlayerListener(amc.EVENTS.RESUME, _onContentResume);
        amc.addPlayerListener(amc.EVENTS.INITIAL_PLAY_REQUESTED, _onInitialPlay);
        amc.addPlayerListener(amc.EVENTS.PLAY_STARTED, _onPlayStarted);
        amc.addPlayerListener(amc.EVENTS.CONTENT_COMPLETED, _onContentFinished);
        amc.addPlayerListener(amc.EVENTS.SIZE_CHANGED, _onSizeChanged);
        amc.addPlayerListener(amc.EVENTS.FULLSCREEN_CHANGED, _onFullscreenChanged);
        amc.addPlayerListener(amc.EVENTS.REPLAY_REQUESTED, _onReplay);
        amc.addPlayerListener(amc.EVENTS.DEVICE_ID_SET, _onDeviceIdSet);
      };

      /**
       * Called by Ad Manager Controller.  When this function is called, all movie and server metadata are
       * ready to be parsed.
       * This metadata may contain the adTagUrl and other ad manager and movie specific configuration.
       * @method AdManager#loadMetadata
       * @public
       * @param {object} adManagerMetadata Ad manager-specific metadata
       * @param {object} backlotBaseMetadata Base metadata from Ooyala Backlot
       * @param {object} movieMetadata Metadata for the main video
       */
      this.loadMetadata = (adManagerMetadata, backlotBaseMetadata, movieMetadata) => {
        preferredRenderingMode = adManagerMetadata.pulse_rendering_mode || 'HTML5_FIRST';
        this._pulseHost = adManagerMetadata.pulse_host
          || backlotBaseMetadata.pulse_host
          || backlotBaseMetadata.vpHost
          || adManagerMetadata.vpDomain;

        if (!this._pulseHost) {
          log(`No Pulse hostname found in plugin parameters or media metadata;
              will not attempt to show Pulse ads`);
          noPulseConfiguration = true;
          this.ready = true;
          amc.onAdManagerReady();
          amc.reportPluginLoaded(Date.now() - this.initTime, this.name);
          return;
        }

        this.ready = true;
        amc.onAdManagerReady();
        amc.reportPluginLoaded(Date.now() - this.initTime, this.name);

        this._deviceContainer = adManagerMetadata.pulse_device_container;
        if (adManagerMetadata.pulse_persistent_id) {
          this._persistentId = adManagerMetadata.pulse_persistent_id;
        }
        const protocol = getProtocolFromPulseHost(this._pulseHost);
        const pulse_account_name = getPulseAccount(this._pulseHost);


        // Load the Pulse SDK if not already included
        if (!OO.Pulse) {
          log('Pulse SDK not present; loading latest ..');
          adModuleState = AD_MODULE_STATE.LOADING;
          amc.loadAdModule(this.name, protocol + pulse_account_name + pulseSDKUrl, (success) => {
            adModuleState = success ? AD_MODULE_STATE.READY : AD_MODULE_STATE.FAILED;
            if (!success && podStarted) {
              log('Failed to load Pulse SDK');
              // Stop the ad pod previously started by playAd()
              amc.notifyPodEnded(podStarted);
            } else if (isWaitingForPrerolls) {
              log('Pulse SDK loaded, trying to play prerolls ..');
              _onInitialPlay.call(this);
            }
          });
        } else {
          log('Using Pulse SDK already present on page');
          adModuleState = AD_MODULE_STATE.READY;
          if (isWaitingForPrerolls) {
            _onInitialPlay.call(this);
          }
        }

        // Check for some callbacks to expose plugin internals
        // (clear any old callbacks that may have been registered first)
        pluginCallbacks = {};
        if (adManagerMetadata.pulse_callbacks) {
          for (const name in adManagerMetadata.pulse_callbacks) {
            if (adManagerMetadata.pulse_callbacks.hasOwnProperty(name)) {
              const callback = adManagerMetadata.pulse_callbacks[name];

              if (typeof callback === 'function') {
                pluginCallbacks[name] = callback;
              }
            }
          }
        }

        // Allow setting explicit site id
        forcedSiteId = undefined;
        if (adManagerMetadata.pulse_force_site_id) {
          forcedSiteId = adManagerMetadata.pulse_force_site_id;
          log('Forcing site id: ', forcedSiteId);
        }

        previewAdId = undefined;
        if (adManagerMetadata.pulse_preview) {
          previewAdId = adManagerMetadata.pulse_preview;
          log('Ad preview for id ', previewAdId);
        }


        // The request settings and content metadata are going to be assembled progressively here

        // First we fill the integration-only metadata
        this._requestSettings = {
          height: adManagerMetadata.pulse_height,
          width: adManagerMetadata.pulse_width,
          maxBitRate: adManagerMetadata.pulse_max_bitrate,
        };

        if (forcedSiteId) {
          this._requestSettings.forceSiteId = forcedSiteId;
        }

        if (previewAdId) {
          this._requestSettings.pulse_preview = previewAdId;
        }

        // Then the parameters that always overriden by the custom metadata or the integration metadata are set
        this._contentMetadata.category = getByPriority(
          adManagerMetadata.pulse_category,
          backlotBaseMetadata.pulse_category,
          backlotBaseMetadata.vpCategory,
          getCategoryFromPlayerLevelShares(adManagerMetadata.playerLevelShares),
          adManagerMetadata.category,
        );

        this._contentMetadata.contentForm = getByPriority(
          adManagerMetadata.pulse_content_form,
          backlotBaseMetadata.pulse_content_form,
          (movieMetadata.duration / 1000 > adManagerMetadata.longFormLimit ? 'longForm' : 'shortForm'),
        );

        this._contentMetadata.contentPartner = getByPriority(
          adManagerMetadata.pulse_content_partner,
          backlotBaseMetadata.pulse_content_partner,
          getContentPartnerFromPlayerLevelShares(adManagerMetadata.playerLevelShares),
        );

        this._requestSettings.referrerUrl = getByPriority(
          adManagerMetadata.pulse_referrer_url,
          backlotBaseMetadata.pulse_referrer_url,
        );

        this._requestSettings.linearSlotSize = getByPriority(
          adManagerMetadata.pulse_linear_slot_size,
          safeParseInt(backlotBaseMetadata.pulse_linear_slot_size),
        );

        this._contentMetadata.id = getByPriority(
          adManagerMetadata.pulse_content_id,
          backlotBaseMetadata.pulse_content_id,
          adManagerMetadata.embedCode,
        );

        this._contentMetadata.duration = getByPriority(
          adManagerMetadata.pulse_duration,
          safeParseInt(backlotBaseMetadata.pulse_duration),
          movieMetadata.duration / 1000,
        );

        this._contentMetadata.customParameters = adManagerMetadata.pulse_custom_parameters;

        this._contentMetadata.contentProviderInformation = {
          embedCode: movieMetadata.embed_code,
          pcode: movieMetadata.asset_pcode,
        };

        this._requestSettings.vptpTicketData = adManagerMetadata.pulse_vptp_data;

        this._requestSettings.maxLinearBreakDuration = parseInt(
          adManagerMetadata.pulse_max_linear_break_duration
          || backlotBaseMetadata.pulse_max_linear_break_duration,
        );

        if (isNaN(this._requestSettings.maxLinearBreakDuration)) {
          this._requestSettings.maxLinearBreakDuration = null;
        }

        this._requestSettings.linearPlaybackPositions = safeMap(safeSplit(getByPriority(
          adManagerMetadata.pulse_linear_cuepoints,
          backlotBaseMetadata.pulse_linear_cuepoints,
          backlotBaseMetadata.cuepoints,
          adManagerMetadata.playerLevelCuePoints,
        ), ','), Number);

        this._requestSettings.nonlinearPlaybackPositions = safeMap(safeSplit(getByPriority(
          adManagerMetadata.pulse_non_linear_cuepoints,
          backlotBaseMetadata.pulse_non_linear_cuepoints,
          adManagerMetadata.nonLinearAdBreaks,
        ), ','), Number);

        if (adManagerMetadata.all_ads) {
          this._requestSettings.insertionPointFilter = safeSplit(getByPriority(
            adManagerMetadata.pulse_insertion_point_filter
            || backlotBaseMetadata.pulse_insertion_point_filter
            || getInsertionPointTypeFromAdPosition(adManagerMetadata.all_ads[0].position),
          ), ',');
        } else {
          this._requestSettings.insertionPointFilter = safeSplit(getByPriority(
            adManagerMetadata.pulse_insertion_point_filter,
            backlotBaseMetadata.pulse_insertion_point_filter,
          ), ',');
        }
        // If pulse_override_metadata is true, the integration metadata will be given priority over the backlot ad set and custom metadata
        if (adManagerMetadata.pulse_override_metadata) {
          log('Overriding Backlot metadata with page-level parameters');
          this._contentMetadata.flags = safeSplit(getByPriority(adManagerMetadata.pulse_flags,
            backlotBaseMetadata.pulse_flags,
            adManagerMetadata.playerLevelFlags), ',');

          this._contentMetadata.tags = safeSplit(getByPriority(adManagerMetadata.pulse_tags,
            backlotBaseMetadata.pulse_tags,
            backlotBaseMetadata.vpTags,
            adManagerMetadata.playerLevelTags), ',');
        } else {
          this._contentMetadata.flags = safeSplit(mergeCommaSeparatedStrings(
            adManagerMetadata.pulse_flags,
            backlotBaseMetadata.pulse_flags,
            adManagerMetadata.playerLevelFlags,
          ), ',');

          this._contentMetadata.tags = safeSplit(mergeCommaSeparatedStrings(
            adManagerMetadata.pulse_tags,
            backlotBaseMetadata.pulse_tags,
            backlotBaseMetadata.vpTags,
            adManagerMetadata.playerLevelTags,
          ), ',');
        }

        enableDebugMode = adManagerMetadata.pulse_debug;

        // Due to some SDK bugs?, remove all the undefined or null properties from the request objects
        cleanObject(this._contentMetadata);
        cleanObject(this._requestSettings);
      };

      /**
       * Mandatory method. We just return a placeholder ad that will prevent the content from starting. It will allow
       * the SDK to start the session and return if actual ads are present or not
       * @returns {array}
       */
      this.buildTimeline = () => (noPulseConfiguration ? [] : [makePlaceholderAd.call(this, 'adRequest', 0)]);

      /**
       * Mandatory method. Called by the AMF when an ad play has been requested
       * @param v4ad
       */
      this.playAd = (v4ad) => {
        if (v4ad === null) {
          return;
        }

        switch (adModuleState) {
          case AD_MODULE_STATE.UNINITIALIZED:
            log('playAd() called with unexpected state UNINITIALIZED');
            break;
          case AD_MODULE_STATE.LOADING:
            // Waiting for SDK load to finish; do nothing
            break;
          case AD_MODULE_STATE.READY:
            // All good, do nothing here
            break;
          case AD_MODULE_STATE.FAILED:
            log('Aborting ad break as SDK failed to load');
            // SDK failed to load due to timeout or other issues; stop placeholder ad pod
            amc.notifyPodEnded(v4ad.id);
            return;
          default:
            // ??
            log(`playAd() called with unexpected state ${adModuleState}`);
            return;
        }

        if (v4ad.adType === amc.ADTYPE.NONLINEAR_OVERLAY) {
          if (contentPaused) {
            currentPauseAd = v4ad;
          } else {
            currentOverlayAd = v4ad;
          }

          amc.sendURLToLoadAndPlayNonLinearAd(v4ad.ad, v4ad.id, v4ad.ad.getResourceURL());
          amc.showNonlinearAdCloseButton();

          // Assume the ad was loaded
          if (!contentPaused) {
            onOverlayShown();
          }
          return;
        }

        isInAdMode = true;
        podStarted = v4ad.id;
        this._isInPlayAd = true;
        overlayPause();

        if (adPlayer) {
          adPlayer.contentPaused();
        }

        if (this._mustExitAdMode) {
          this._mustExitAdMode = false;
          this.notifyAdPodEnded();

          if (adPlayer) {
            adPlayer.contentStarted();
          }

          amc.addPlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onMainVideoTimeUpdate);
        }
      };

      this.startContentPlayback = () => {
        isWaitingForPrerolls = false;

        if (isInAdMode) {
          this.notifyAdPodEnded();
          if (adPlayer) {
            adPlayer.contentStarted();
          }

          isInAdMode = false;
          amc.addPlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onMainVideoTimeUpdate);
        } else {
          // This happens if the change to ad mode hasn't been done yet.
          // Raise a flag that will be read when entering ad mode
          this._mustExitAdMode = true;
        }
      };

      this.pauseContentPlayback = () => {
        // ui.ooyalaVideoElement.off("timeupdate",_onMainVideoTimeUpdate);
        amc.removePlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onMainVideoTimeUpdate);

        if (!isWaitingForPrerolls) {
          setTimeout(playPlaceholder, 1);
        }

        if (isInAdMode || (isWaitingForPrerolls && !this.ui.useSingleVideoElement)) {
          return true;
        }
        return false;
      };

      this.tryInitAdPlayer = () => {
        const flashVersion = getFlashVersion().split(',').shift();

        if (this.ui && adModuleState === AD_MODULE_STATE.READY) {
          if (!adPlayer) {
            const renderingMode = flashVersion >= 11
              ? OO.Pulse.AdPlayer.Settings.RenderingMode.HTML5_FIRST
              : OO.Pulse.AdPlayer.Settings.RenderingMode.HTML5_ONLY;
            OO.Pulse.debug = enableDebugMode || OO.Pulse.debug;
            OO.Pulse.setPulseHost(this._pulseHost, this._deviceContainer, this._persistentId);
            adPlayer = OO.Pulse.createAdPlayer(amc.ui.playerSkinPluginsElement
              ? amc.ui.playerSkinPluginsElement[0]
              : amc.ui.pluginsElement[0],
            {
              VPAIDViewMode: OO.Pulse.AdPlayer.Settings.VPAIDViewMode.NORMAL,
              renderingMode: preferredRenderingMode || renderingMode,
            }, this.sharedVideoElement);

            // We register all the event listeners we will need
            /* eslint-disable max-len */
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_BREAK_FINISHED, _onAdBreakFinished);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_BREAK_STARTED, _onAdBreakStarted);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_FINISHED, _onAdFinished);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_ERROR, _onAdError);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_SKIPPED, _onAdSkipped);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_STARTED, _onAdStarted);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_PROGRESS, _onAdTimeUpdate);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_CLICKED, _onAdClicked);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_PAUSED, _onAdPaused);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_PLAYING, _onAdPlaying);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.SESSION_STARTED, _onSessionStarted);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.OVERLAY_AD_SHOWN, _onOverlayShown);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_VOLUME_CHANGED, _onAdVolumeChanged);
            adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_PLAY_PROMISE_REJECTED, _onAdPlayPromiseRejected);
            /* eslint-enable max-len */

            if (pluginCallbacks && pluginCallbacks.onAdPlayerCreated) {
              pluginCallbacks.onAdPlayerCreated(adPlayer);
            }
          }
        }
      };
    };
    return new PulseAdManager();
  });

  const PulseVideoWrapper = function (adManager) {
    const _adManager = adManager;

    this.controller = {};
    this.isPlaying = false;

    /** ********************************************************************************* */
    // Required. Methods that Video Controller, Destroy, or Factory call
    /** ********************************************************************************* */

    /**
     * Hands control of the video element off to another plugin.
     * This function is only needed if the feature OO.VIDEO.FEATURE.VIDEO_OBJECT_GIVE or
     * OO.VIDEO.FEATURE.VIDEO_OBJECT_TAKE is supported.
     * @public
     * @method PulseVideoWrapper#sharedElementGive
     */
    this.sharedElementGive = () => {
      setTimeout(() => {
        _adManager.sharedVideoElement.style.display = 'block';
        _adManager.sharedVideoElement.play();
      }, 100);
      _adManager.sharedVideoElement.style.visibility = 'hidden';
      _adManager._isControllingVideo = false;
    };

    /**
     * Takes control of the video element from another plugin.
     * This function is only needed if the feature OO.VIDEO.FEATURE.VIDEO_OBJECT_GIVE or
     * OO.VIDEO.FEATURE.VIDEO_OBJECT_TAKE is supported.
     * @public
     * @method PulseVideoWrapper#sharedElementTake
     */
    this.sharedElementTake = () => {
      _adManager.sharedVideoElement.crossorigin = null;
      _adManager._isControllingVideo = true;
      _adManager.sharedVideoElement.style.visibility = 'visible';
      if (_adManager && _adManager._waitingForContentPause) {
        _adManager._waitingForContentPause = false;
      }
    };

    /**
     * Subscribes to all events raised by the video element.
     * This is called by the Factory during creation.
     * @public
     * @method PulseVideoWrapper#subscribeAllEvents
     */
    this.subscribeAllEvents = () => {
      _adManager.registerVideoControllerWrapper(this);
    };

    /**
     * Unsubscribes all events from the video element.
     * This function is not required but can be called by the destroy function.
     * @private
     * @method PulseVideoWrapper#unsubscribeAllEvents
     */
    const unsubscribeAllEvents = () => {
    };

    /**
     * Loads the current stream url in the video element; the element should be left paused.  This function
     * is generally called when preloading a stream before triggering play.  Load may not be called before
     * play.
     * @public
     * @method PulseVideoWrapper#load
     */
    this.load = () => {
    };

    this.togglePlayPause = () => {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    };
    /**
     * Triggers playback on the video element.  If the 'load' function was not already called and the stream
     * is not loaded, trigger a load now.
     * @public
     * @method PulseVideoWrapper#play
     */
    this.play = () => {
      if (_adManager) {
        _adManager.resumeAd();
        this.isPlaying = true;
        this.raisePlayingEvent();
      }
    };


    /**
     * Triggers a pause on the video element.
     * @public
     * @method PulseVideoWrapper#pause
     */
    this.pause = () => {
      if (_adManager) {
        _adManager.pauseAd();
        this.isPlaying = false;
        this.raisePauseEvent();
      }
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method PulseVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     */
    this.seek = (time) => {
      if (_adManager && _adManager.getAdPlayer()) {
        _adManager.getAdPlayer().seek(time);
      }
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method PulseVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = (volume) => {
      // Do not set the volume if the Pulse ad player is muted since that will unmute the ad player
      if (_adManager && _adManager.getAdPlayer() && !_adManager.muted()) {
        _adManager.getAdPlayer().setVolume(volume);
      }
    };

    /**
     * Mutes the Pulse ad player.
     * @public
     * @method PulseVideoWrapper#mute
     */
    this.mute = () => {
      if (_adManager && _adManager.getAdPlayer()) {
        _adManager.getAdPlayer().mute();
      }
    };

    /**
     * Unmutes the Pulse ad player.
     * @public
     * @method PulseVideoWrapper#unmute
     */
    this.unmute = () => {
      if (_adManager && _adManager.getAdPlayer()) {
        _adManager.getAdPlayer().unmute();
      }
    };

    /**
     * Gets the current time position of the video.
     * @public
     * @method PulseVideoWrapper#getCurrentTime
     * @returns {number} The current time position of the video (seconds)
     */
    this.getCurrentTime = () => {
    };

    /**
     * Applies the given css to the video element.
     * @public
     * @method PulseVideoWrapper#applyCss
     * @param {object} css The css to apply in key value pairs
     */
    this.applyCss = (css) => {
      const node = _adManager.sharedVideoElement;
      if (!node) {
        return;
      }
      Object.keys(css).forEach((prop) => {
        node.style[prop] = css[prop];
      });
    };

    /**
     * Destroys the individual video element.
     * @public
     * @method PulseVideoWrapper#destroy
     */
    this.destroy = () => {
      // Pause the video
      // Reset the source
      // Unsubscribe all events
      unsubscribeAllEvents();
      // Remove the element
    };

    // **********************************************************************************/
    // Example callback methods
    // **********************************************************************************/

    this.raisePlayEvent = (event) => {
      this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
    };

    this.raisePlayingEvent = () => {
      this.controller.notify(this.controller.EVENTS.PLAYING);
    };

    this.raiseEndedEvent = () => {
      this.controller.notify(this.controller.EVENTS.ENDED);
    };

    this.raiseErrorEvent = (event) => {
      const code = event.target.error ? event.target.error.code : -1;
      this.controller.notify(this.controller.EVENTS.ERROR, { errorcode: code });
    };

    this.raiseSeekingEvent = () => {
      this.controller.notify(this.controller.EVENTS.SEEKING);
    };

    this.raiseSeekedEvent = () => {
      this.controller.notify(this.controller.EVENTS.SEEKED);
    };

    this.raisePauseEvent = () => {
      this.controller.notify(this.controller.EVENTS.PAUSED);
    };

    this.raiseRatechangeEvent = () => {
      this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
    };

    this.raiseStalledEvent = () => {
      this.controller.notify(this.controller.EVENTS.STALLED);
    };

    /**
     * Notifies the video controller of VOLUME_CHANGE and MUTE_STATE_CHANGE events.
     * @private
     * @method PulseVideoWrapper#raiseVolumeEvent
     * @param {Number} volume The current volume
     * @param {boolean} muted The current mute state
     */
    this.raiseVolumeEvent = (volume, muted) => {
      if (volume === 0 || muted) {
        this.controller.notify(this.controller.EVENTS.MUTE_STATE_CHANGE, { muted: true });
      } else {
        this.controller.notify(this.controller.EVENTS.MUTE_STATE_CHANGE, { muted: false });
        this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { volume });
      }
    };

    /**
     * Notifies the video controller of the UNMUTED_PLAYBACK_FAILED event.
     * @private
     * @method PulseVideoWrapper#raiseUnmutedPlaybackFailed
     */
    this.raiseUnmutedPlaybackFailed = () => {
      this.controller.notify(this.controller.EVENTS.UNMUTED_PLAYBACK_FAILED);
    };

    /**
     * Notifies the video controller of the MUTED_PLAYBACK_FAILED event.
     * @private
     * @method PulseVideoWrapper#raiseMutedPlaybackFailed
     */
    this.raiseMutedPlaybackFailed = () => {
      this.controller.notify(this.controller.EVENTS.MUTED_PLAYBACK_FAILED);
    };

    this.raiseWaitingEvent = () => {
      this.controller.notify(this.controller.EVENTS.WAITING);
    };

    this.raiseTimeUpdate = (position, duration) => {
      this.controller.notify(this.controller.EVENTS.TIME_UPDATE,
        {
          currentTime: position,
          duration,
          buffer: duration,
          seekRange: { begin: 0, end: 10 },
        });
    };

    this.raiseDurationChange = (event) => {
      this.raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
    };

    this.raisePlayhead = (eventname, event) => {
      this.controller.notify(eventname,
        {
          currentTime: event.target.currentTime,
          duration: event.target.duration,
          buffer: 10,
          seekRange: { begin: 0, end: 10 },
        });
    };

    this.raiseProgress = (event) => {
      this.controller.notify(this.controller.EVENTS.PROGRESS,
        {
          currentTime: event.target.currentTime,
          duration: event.target.duration,
          buffer: 10,
          seekRange: { begin: 0, end: 10 },
        });
    };

    this.raiseCanPlayThrough = () => {
      this.controller.notify(this.controller.EVENTS.BUFFERED);
    };

    this.raiseFullScreenBegin = (event) => {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
        { _isFullScreen: true, paused: event.target.paused });
    };

    this.raiseFullScreenEnd = (event) => {
      this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
        { _isFullScreen: false, paused: event.target.paused });
    };
  };

  // Pulse Video plugin
  const PulsePlayerFactory = function () {
    this.adManager = {};
    this.name = 'PulseVideoTech';
    this.encodings = [OO.VIDEO.ENCODING.PULSE];
    this.features = [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_TAKE];
    this.technology = OO.VIDEO.TECHNOLOGY.HTML5;
    this.ready = true;

    /**
     * Creates a video player instance using PulseVideoWrapper.
     * @public
     * @method TemplateVideoFactory#create
     * @param {object} parentContainer The jquery div that should act as the parent for the video element
     * @param {string} domId The dom id of the video player instance to create
     * @param {object} ooyalaVideoController A reference to the video controller in the Ooyala player
     * @param {object} css The css to apply to the video element
     * @param {string} playerId The unique player identifier of the player creating this instance
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = (parentContainer, domId, ooyalaVideoController, css, playerId) => {
      const pulseAdManager = pulseAdManagers[playerId];
      const wrapper = new PulseVideoWrapper(pulseAdManager);
      wrapper.controller = ooyalaVideoController;
      wrapper.subscribeAllEvents();
      return wrapper;
    };

    this.createFromExisting = (domId, ooyalaVideoController, playerId) => {
      const pulseAdManager = pulseAdManagers[playerId];
      const wrapper = new PulseVideoWrapper(pulseAdManager);

      pulseAdManager.sharedVideoElement = document.getElementById(domId);
      wrapper.controller = ooyalaVideoController;
      wrapper.subscribeAllEvents();

      return wrapper;
    };
    /**
     * Destroys the video technology factory.
     * @public
     * @method TemplateVideoFactory#destroy
     */
    this.destroy = () => {
      this.encodings = [];
      this.create = () => {
      };
    };

    /**
     * Represents the max number of support instances of video elements that can be supported on the
     * current platform. -1 implies no limit.
     * @public
     * @property TemplateVideoFactory#maxSupportedElements
     */
    this.maxSupportedElements = -1;
  };

  OO.Video.plugin(new PulsePlayerFactory());
}());
