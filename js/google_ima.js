/*
 * Google IMA Ad Manager
 * owner: PBI
 * originally authored: June 2015
 */

const {
  find,
  isFinite,
  filter,
  delay,
  each,
  contains,
  pairs,
} = require('underscore');

// TODO make amc ignore ad request timeout.
require('../html5-common/js/utils/InitModules/InitOOUnderscore.js');
require('../html5-common/js/utils/constants.js');
require('../html5-common/js/utils/utils.js');


(function () {
  const registeredGoogleIMAManagers = {};

  OO.Ads.manager(() => {
    const _throwError = (outputStr) => {
      // TODO consolidate code to exit gracefully if we have an error.
      throw new Error(`GOOGLE IMA: ${outputStr}`);
    };

    const _inlinePlaybackSupported = () => !(OO.iosMajorVersion < 10 && OO.isIphone);

    /**
     * @class GoogleIMA
     * @classDesc The GoogleIMA Ads Manager class is registered as an ads manager with the Ad Manager Controller.
     * This class communicates between the player's ad manager controller and the GoogleIMA sdk.  This implementation handles both
     * AdRules ads and Non AdRules ads.
     * @property {string} PLUGIN_VERSION This is a variable version number of the player sent to Google for tracking
     *             **This must be updated with big updates to a different number**
     * @property {string} PLAYER_TYPE This is a variable that specifies the name of the player that is relayed to
     *             Google for tracking
     * @property {object} sharedVideoElement The video element to use on iOS where only one video element is allowed
     */
    const GoogleIMA = function () {
      this.name = 'google-ima-ads-manager';
      this.ready = false;
      this.runningUnitTests = false;
      this.sharedVideoElement = null;
      this.initTime = Date.now();
      this.enableIosSkippableAds = false;

      // private member variables of this GoogleIMA object
      let _amc = null;
      let _adModuleJsReady = false;
      let _playheadTracker;
      let _usingAdRules;
      let _IMAAdsLoader;
      let _IMAAdsManager;
      let _imaAdPlayed;
      let _IMAAdDisplayContainer;
      let _linearAdIsPlaying;
      let _timeUpdater = null;
      let _uiContainer = null;
      let _uiContainerPrevStyle = null;
      let browserCanAutoplayUnmuted = false;

      let _adToPlayOnRequestSuccess = null;
      let _requestedAd = null;

      // Constants
      const DEFAULT_IMA_IFRAME_Z_INDEX = 10004;
      const DEFAULT_ADS_REQUEST_TIME_OUT = 15000;
      const DEFAULT_LOAD_VIDEO_TIME_OUT = 15000;
      const AD_RULES_POSITION_TYPE = 'r';
      const NON_AD_RULES_POSITION_TYPE = 't';
      const NON_AD_RULES_PERCENT_POSITION_TYPE = 'p';
      const PLAYER_TYPE = 'Ooyala';
      const PLUGIN_VERSION = '1.0';

      const INVISIBLE_CSS = { left: OO.CSS.INVISIBLE_POSITION, visibility: 'hidden' };

      const OVERLAY_WIDTH_PADDING = 50;
      const OVERLAY_HEIGHT_PADDING = 50;

      const TIME_UPDATER_INTERVAL = 500;
      const OOYALA_IMA_PLUGIN_TIMEOUT = 'ooyalaImaPluginTimeout';

      /**
       * Resets _playheadTracker's current time to 0. If _playheadTracker doesn't
       * exist, it creates it.
       * @private
       * @method GoogleIMA#_resetPlayheadTracker
       */
      const _resetPlayheadTracker = () => {
        if (!_playheadTracker) {
          _playheadTracker = { duration: 0, currentTime: 0 };
        } else {
          _playheadTracker.currentTime = 0;
        }
      };

      /**
       * Reset all the variables needed for multiple ad plays.
       * @private
       * @method GoogleIMA#_createAMCListeners
       */
      const _resetVars = () => {
        this.ready = false;
        _usingAdRules = true;

        this.startImaOnVtcPlay = false;
        this.capturedUserClick = false;
        this.initialPlayRequestTime = -1;
        this.adRequestTime = -1;
        this.adResponseTime = -1;
        this.mainContentDuration = 0;
        this.initialPlayRequested = false;
        this.canSetupAdsRequest = true;
        this.adTagUrl = null;
        this.currentMedia = null;
        this.currentImpressionTime = 0;
        this.adFinalTagUrl = null;
        this.adPosition = -1;
        this.adsReady = false;
        this.additionalAdTagParameters = null;
        this.adsRequested = false;
        this.adsRequestTimeoutRef = null;
        this.disableFlashAds = false;
        this.contentEnded = false;
        this.pauseAdOnClick = null;
        this.isFullscreen = false;
        this.maxAdsRequestTimeout = DEFAULT_ADS_REQUEST_TIME_OUT;
        this.uiRegistered = false;
        this.metadataReady = false;
        this.allAdInfo = null;
        this.currentAMCAdPod = null;
        this.currentIMAAd = null;
        this.currentNonLinearIMAAd = null;
        this.isReplay = false;
        this.requestAdsOnReplay = true;
        this.preloadAds = false;
        _linearAdIsPlaying = false;
        _resetPlayheadTracker();
        this.hasPreroll = false;

        this.adPlaybackStarted = false;
        this.savedVolume = -1;
        this.showAdControls = false;
        this.useGoogleAdUI = false;
        this.useGoogleCountdown = false;
        this.useInsecureVpaidMode = false;
        this.imaIframeZIndex = DEFAULT_IMA_IFRAME_Z_INDEX;

        // flag to track whether ad rules failed to load
        this.adRulesLoadError = false;

        // ad request vars
        _adToPlayOnRequestSuccess = null;
        _requestedAd = null;

        // google sdk variables
        _IMAAdsLoader = null;
        _IMAAdsManager = null;
        _imaAdPlayed = false;
        _IMAAdDisplayContainer = null;
      };

      /**
       * Returns true if ad (from backlot) has a valid ad tag.
       * @private
       * @method GoogleIMA#isValidAdTag
       * @returns {array} Ads with valid ad tags.
       */
      const _isValidAdTag = (ad) => {
        if (!ad) {
          return false;
        }

        const url = ad.tag_url;
        const isAdRulesAd = (ad.position_type === AD_RULES_POSITION_TYPE);
        const isSameAdType = (_usingAdRules === isAdRulesAd);

        return isSameAdType && url && typeof url === 'string';
      };

      /**
       * Returns all the valid ad tags stored inside of this.allAdInfo. If using
       * Ad Rules, return only valid Ad Rules ads. If not using Ad Rules then
       * it returns the valid non Ad Rules ads.
       * @private
       * @method GoogleIMA#_getValidAdTagUrls
       * @returns {array} Ads with valid ad tags. Null if this.allAdInfo doesn't exist.
       */
      const _getValidAdTagUrls = () => {
        if (!this.allAdInfo) {
          return null;
        }

        return filter(this.allAdInfo, _isValidAdTag);
      };

      /**
       * Tries to notify the VTC that we cannot playback unmuted since attempting to play unmuted
       * in an environment where muted playback is required will cause a fatal ad error.
       * @private
       * @method GoogleIMA#_tryNotifyUnmutedPlaybackFailed
       */
      const _tryNotifyUnmutedPlaybackFailed = () => {
        let notified = false;
        // PLAYER-2426: We do not want to mute if we are using ad rules, are handling the initial ad request
        // for ad rules, and found no prerolls.
        const noPrerollAdRulesAdRequest = _usingAdRules && !this.hasPreroll && this.currentAMCAdPod
          && this.currentAMCAdPod.adType === _amc.ADTYPE.UNKNOWN_AD_REQUEST;
        if (this.willPlayAdMuted() && this.videoControllerWrapper && !noPrerollAdRulesAdRequest) {
          this.startImaOnVtcPlay = true;
          this.videoControllerWrapper.raiseUnmutedPlaybackFailed();
          notified = true;
        }
        return notified;
      };

      /**
       * Tries to start the IMA Ads Manager for ad playback. If we have not detected a user click yet
       * for platforms where unmuted autoplay is not supported, we'll mute playback first.
       * @private
       * @method GoogleIMA#_tryStartAdsManager
       */
      const _tryStartAdsManager = () => {
        const notified = _tryNotifyUnmutedPlaybackFailed();
        if (!notified && _IMAAdsManager) {
          OO.log('Starting IMA Ads Manager');
          _IMAAdsManager.start();
        }
      };

      /**
       * Callback for Ad Manager Controller EVENTS.CONTENT_COMPLETED.  Marks the main content as having completed and
       * notifies the IMA SDK, so it can play postrolls if neccessary.
       * @private
       * @method GoogleIMA#_onContentCompleted
       */
      const _onContentCompleted = () => {
        if (this.contentEnded === false) {
          this.contentEnded = true;
          if (_IMAAdsLoader) {
            _IMAAdsLoader.contentComplete();
          }
        }
      };

      /**
       * Callback for Ad Manager Controller EVENTS.PLAYHEAD_TIME_CHANGED.  Updates the IMA SDK with current playhead time.
       * @private
       * @method GoogleIMA#_onPlayheadTimeChanged
       * @param playhead current playhead time
       * @param duration - duration of the movie.
       */
      const _onPlayheadTimeChanged = (event, playheadTime, duration) => {
        if (!_playheadTracker) {
          _resetPlayheadTracker();
        }

        // in case the amc gives us playhead updates while IMA is playing an ad (AdRules case)
        // then we don't want to update the playhead that IMA reads from to avoid triggering
        // more ads while playing the current one.
        if (!_linearAdIsPlaying) {
          _playheadTracker.currentTime = playheadTime;
          _playheadTracker.duration = duration;
        }
      };

      /**
       * Update the IMA SDK to inform it the size of the video container has changed.
       * @private
       * @method GoogleIMA#_updateIMASize
       */
      const _updateIMASize = () => {
        if (_IMAAdsManager && _uiContainer) {
          const viewMode = this.isFullscreen ? google.ima.ViewMode.FULLSCREEN : google.ima.ViewMode.NORMAL;
          let width = _uiContainer.clientWidth;
          let height = _uiContainer.clientHeight;
          // For nonlinear overlays, we want to provide the size that we sent to the AMC in playAd.
          // We do this because the player skin plugins div (_uiContainer) may not have been redrawn yet
          if (this.currentAMCAdPod && this.currentNonLinearIMAAd) {
            if (this.currentAMCAdPod.width) {
              // eslint-disable-next-line prefer-destructuring
              width = this.currentAMCAdPod.width;
              if (this.currentAMCAdPod.paddingWidth) {
                width += this.currentAMCAdPod.paddingWidth;
              }
            }

            if (this.currentAMCAdPod.height) {
              // eslint-disable-next-line prefer-destructuring
              height = this.currentAMCAdPod.height;
              if (this.currentAMCAdPod.paddingHeight) {
                height += this.currentAMCAdPod.paddingHeight;
              }
            }
          }
          _IMAAdsManager.resize(width, height, viewMode);
        }
      };

      /**
       * Callback for size change notifications.
       * @private
       * @method GoogleIMA#_onSizeChanged
       */
      const _onSizeChanged = () => {
        _updateIMASize();
      };

      /**
       * Callback for Ad Manager Controller. Handles going into and out of fullscreen mode.
       * @public
       * @method GoogleIMA#onFullScreenChanged
       * @param {boolean} shouldEnterFullscreen True if going into fullscreen
       */
      const _onFullscreenChanged = (event, shouldEnterFullscreen) => {
        this.isFullscreen = shouldEnterFullscreen;
        _onSizeChanged();
      };

      /**
       * Return true if you can ad request depending on if it's a replay or not.
       * If it's not a replay then it will return true. If it is, then it depends
       * on the player setup.
       * @private
       * @method GoogleIMA#_checkRequestAdsOnReplay
       */
      const _checkRequestAdsOnReplay = () => {
        if (!this.isReplay) {
          return true;
        }

        return this.requestAdsOnReplay;
      };

      /**
       * Returns true if the google sdk has loaded correctly and has at least
       * defined AdDisplayContainer.
       * @private
       * @method GoogleIMA#_isGoogleSDKValid
       * @returns {boolean} True if AdDisplayContainer is defined.
       */
      const _isGoogleSDKValid = () => (google && google.ima && google.ima.AdDisplayContainer);

      /**
       * Clean up function for IMA SDK AdsLoader.
       * @private
       * @method GoogleIMA#_IMA_SDK_destroyAdsLoader
       */
      const _IMA_SDK_destroyAdsLoader = () => {
        if (_IMAAdsLoader) {
          _IMAAdsLoader.destroy();
          _IMAAdsLoader = null;
        }
      };

      /**
       * Clean up function for IMA SDK AdDisplayContainer.
       * @private
       * @method GoogleIMA#_IMA_SDK_destroyAdDisplayContainer
       */
      const _IMA_SDK_destroyAdDisplayContainer = () => {
        if (_IMAAdDisplayContainer) {
          _IMAAdDisplayContainer.destroy();
          _IMAAdDisplayContainer = null;
          this.capturedUserClick = false;
        }
      };

      /**
       * Clean up function for IMA SDK AdsManager.
       * @private
       * @method GoogleIMA#_IMA_SDK_destroyAdsManager
       */
      const _IMA_SDK_destroyAdsManager = () => {
        if (_IMAAdsManager) {
          _IMAAdsManager.stop();
          _IMAAdsManager.destroy();
          _IMAAdsManager = null;
          _imaAdPlayed = false;
        }
      };

      /**
       * Give control back to Ad Manager Controller for determining when all ads and video have played.
       * @private
       * @method GoogleIMA#_tryUndoSetupForAdRules
       */
      const _tryUndoSetupForAdRules = () => {
        if (_usingAdRules && _amc) {
          _amc.adManagerDoneControllingAds(this.name);
        }
      };

      /**
       * Resets the IMA SDK to allow for requesting more ads.
       * @private
       * @method GoogleIMA#_resetAdsState
       */
      const _resetAdsState = () => {
        _tryUndoSetupForAdRules();

        // If you want to use the same ad tag twice you have to destroy the admanager and call
        // adsLoader.contentComplete. (This also helps with non-adrules ads)  This resets the
        // internal state in the IMA SDK. You call contentComplete after destroying the adManager
        // so you don't accidently play postrolls.
        // Link to documentation: https://developers.google.com/interactive-media-ads/docs/sdks/android/faq
        _IMA_SDK_destroyAdsManager();
        if (_IMAAdsLoader) {
          _IMAAdsLoader.contentComplete();
        }
        this.currentIMAAd = null;
        this.currentNonLinearIMAAd = null;

        this.adsRequested = false;
      };

      /**
       * Called by the Ad Manager Controller to determine if an ad video element must be created on player
       * initialization. This is done so that the Video Controller can interface with the Ad's Video Plugin
       * prior to an ad request. A typical use case would be to pass a user click to the ad plugin prior
       * to ad playback so that the ad can start unmuted for browsers that require user interaction for
       * unmuted playback.
       * @method AdManager#createAdVideoElementOnPlayerInit
       * @public
       * @returns {string[]} An array of encoding types corresponding to the video elements that the Video Controller
       *                     should create. Return an empty array, null, or undefined if this is not required.
       */
      this.createAdVideoElementOnPlayerInit = () => [OO.VIDEO.ENCODING.IMA];

      /**
       * Sets this ad manager to ready and notifies the Ad Manager Controller that it's ready if
       * the ad display container has been created and the metadata has been received.
       * @private
       * @method GoogleIMA#_trySetAdManagerToReady
       */
      const _trySetAdManagerToReady = () => {
        if (_IMAAdDisplayContainer && this.metadataReady && !this.ready) {
          this.ready = true;
          _amc.onAdManagerReady();
          _amc.reportPluginLoaded(Date.now() - this.initTime, this.name);
        }
      };

      /**
       * Fired when IMA SDK has a VMAP or Ad Rules ad that is ready for playback.
       * @private
       * @method GoogleIMA#_startPlaylistAd
       * @param adEvent - Event data from IMA SDK.
       */
      const _startPlaylistAd = () => {
        OO.log('GOOGLE_IMA:: starting playlist ad');
        // Proceed as usual if we're not using ad rules
        if (!_usingAdRules) {
          return;
        }
        // Mimic AMC behavior and cancel any existing non-linear ads before playing the next ad.
        // Note that there is a known issue in the IMA SDK that prevents the COMPLETE
        // event from being fired when a non-linear ad is removed. This is also a workaround
        // for that issue.
        if (this.currentAMCAdPod && this.currentNonLinearIMAAd) {
          this.cancelAd(this.currentAMCAdPod);
        }
        // [PLAYER-319]
        // IMA will not initialize ad rules overlays unless the ad container is already rendered and
        // has enough room for the overlay by the time the ad is ready to play. As a workaround, we expand
        // the ad container and make sure it's rendered, while at the same time hiding it visually.
        // We store the element's current style in order to restore it afterwards.
        _uiContainerPrevStyle = _uiContainer.getAttribute('style') || '';
        _uiContainer.setAttribute(
          'style',
          'display: block; width: 100%; height: 100%; visibility: hidden; pointer-events: none;',
        );
        _onSizeChanged();
        _tryNotifyUnmutedPlaybackFailed();
      };

      /**
       * Callback when IMA SDK detect an ad click. This relays it to the Ad Manager Controller.
       * @private
       * @method GoogleIMA#_IMA_SDK_onAdClicked
       * @param adEvent - Event data from IMA SDK.
       */
      const _IMA_SDK_onAdClicked = () => {
        _amc.adsClicked();
        _amc.adsClickthroughOpened();
      };

      /**
       * Notifies the video controller wrapper of the pause event.
       * @private
       * @method GoogleIMA#_raisePauseEvent
       */
      const _raisePauseEvent = () => {
        if (this.videoControllerWrapper) {
          this.videoControllerWrapper.raisePauseEvent();
        }
      };

      /**
       * Checks if there is any companion ads associated with the ad and if one is found, it will call the Ad Manager
       * Controller to show it.
       * @public
       * @method GoogleIMA#checkCompanionAds
       * @param {object} ad The Ad metadata
       */
      const _checkCompanionAds = (ad) => {
        // companionAd slots are required
        if (!ad || !_amc.pageSettings.companionAd || !_amc.pageSettings.companionAd.slots) {
          return;
        }
        // Page level setting with format:
        // companionAd: {
        //  slots: [{width: 300, height: 250}, ..]
        // }
        const { slots } = _amc.pageSettings.companionAd;
        const companionAds = [];
        let companionAd = null;

        each(slots, (slot) => {
          if (slot.width && slot.height) {
            companionAd = ad.getCompanionAds(slot.width, slot.height);
            if (companionAd.length) {
              each(companionAd, (ad) => {
                companionAds.push({ slotSize: `${slot.width}x${slot.height}`, ad: ad.getContent() });
              });
            }
          }
        });

        if (!companionAds.length) {
          return;
        }
        // companionAds = [{slotSize: "300x250", ad: <Companion Ad as HTML>}, ..]
        _amc.showCompanion(companionAds);
      };

      /**
       * Checks to see if we should ignore certain IMA ad events if the ad
       * is not currently playing (either completed or has not started).
       * @private
       * @method GoogleIMA#_ignoreWhenAdNotPlaying
       * @param {object} adEvent The IMA ad event
       */
      const _ignoreWhenAdNotPlaying = (adEvent) => {
        const eventType = google.ima.AdEvent.Type;
        const ignoredEvents = [
          // eventType.ALL_ADS_COMPLETED,
          eventType.COMPLETE,
          eventType.SKIPPED,
          eventType.FIRST_QUARTILE,
          // eventType.LOADED,
          eventType.MIDPOINT,
          eventType.PAUSED,
          eventType.RESUMED,
          // eventType.STARTED,
          eventType.THIRD_QUARTILE,
          // eventType.VOLUME_CHANGED,
          // eventType.VOLUME_MUTED,
          eventType.USER_CLOSE,
          // eventType.DURATION_CHANGE
        ];

        return !adEvent || (!this.adPlaybackStarted && contains(ignoredEvents, adEvent.type));
      };

      /**
       * Will restore the original style of the UI container if one exists.
       * This is used in a workaround for PLAYER-319.
       * @private
       * @method GoogleIMA#_resetUIContainerStyle
       */
      const _resetUIContainerStyle = () => {
        if (_uiContainer && typeof _uiContainerPrevStyle !== 'undefined' && _uiContainerPrevStyle !== null) {
          _uiContainer.setAttribute('style', _uiContainerPrevStyle);
        }
        _uiContainerPrevStyle = null;
      };

      /**
       * Stops the timer that was started via _startTimeUpdater.
       * @private
       * @method GoogleIMA#_stopTimeUpdater
       */
      const _stopTimeUpdater = () => {
        clearInterval(_timeUpdater);
        _timeUpdater = null;
      };

      /**
       * Starts a timer that will provide an update to the video controller wrapper of the ad's current time.
       * We use a timer because IMA does not provide us with a time update event.
       * @private
       * @method GoogleIMA#_startTimeUpdater
       */
      const _startTimeUpdater = () => {
        _stopTimeUpdater();
        // starting an interval causes unit tests to throw a max call stack exceeded error
        if (!this.runningUnitTests) {
          _timeUpdater = setInterval(() => {
            if (_linearAdIsPlaying) {
              this.videoControllerWrapper.raiseTimeUpdate(this.getCurrentTime(), this.getDuration());
            } else {
              _stopTimeUpdater();
            }
          }, TIME_UPDATER_INTERVAL);
        }
      };

      /**
       * Tries to tell the Ad Manager Controller that this ad manager will determine when the video and ads end.
       * @private
       * @method GoogleIMA#_trySetupForAdRules
       */
      const _trySetupForAdRules = () => {
        if (_usingAdRules) {
          _amc.adManagerWillControlAds(this.name);
        }
      };

      /**
       * Searches for the iframe that IMA uses to render ads.
       * @private
       * @method GoogleIMA#_getImaIframe
       * @returns {object} The IMA iframe
       */
      const _getImaIframe = () => {
        let imaIframe = null;
        if (_uiContainer) {
          const iframes = _uiContainer.querySelector('iframe');
          imaIframe = iframes;
        }
        return imaIframe;
      };

      /**
       * Hides the iframe that IMA uses to render ads.
       * @private
       * @method GoogleIMA#_hideImaIframe
       */
      const _hideImaIframe = () => {
        const IMAiframe = _getImaIframe();
        if (IMAiframe && IMAiframe.style) {
          IMAiframe.style.display = 'none';
        }
      };

      /**
       * Logs ad metric events.
       * @private
       * @method GoogleIMA#_onAdMetrics
       * @param {object} adEvent
       */
      const _onAdMetrics = (adEvent) => {
        OO.log('Google IMA Ad playthrough', adEvent.type);
      };

      /**
       * Callback for EVENTS.CONTENT_CHANGED. Means new video is playing, so all ad data needs to be reset.
       * @private
       * @method GoogleIMA#_onContentChanged
       */
      const _onContentChanged = () => {
        this.contentEnded = false;
        _tryUndoSetupForAdRules();
        _resetAdsState();
        _resetPlayheadTracker();
      };

      /**
       * Notify the AMC that a linear ad has started to play.
       * @private
       * @method GoogleIMA#_startLinearAd
       */
      const _startLinearAd = () => {
        if (!this.currentIMAAd) {
          _throwError('Trying to start linear ad and this.currentIMAAd is falsy');
        }

        if (!this.currentAMCAdPod) {
          _throwError('Trying to start linear ad and this.currentAMCAdPod is falsy');
        }

        const adId = this.currentAMCAdPod.id;

        const adProperties = {};

        // ad properties - actual values to be provided by IMA APIs, default values are set here
        let totalAdsInPod = 1;
        adProperties.indexInPod = 1;
        adProperties.name = null;
        adProperties.duration = 0;
        adProperties.hasClickUrl = false; // default to false because IMA does not provide any clickthrough APIs to us
        adProperties.skippable = false;

        try {
          const adPodInfo = this.currentIMAAd.getAdPodInfo();
          totalAdsInPod = adPodInfo.getTotalAds();
          adProperties.indexInPod = adPodInfo.getAdPosition();
        } catch (e) {
          _throwError('IMA ad returning bad value for this.currentIMAAd.getAdPodInfo().');
        }

        // Google may remove any of these APIs at a future point.
        // Note: getClickThroughUrl has been removed by Google
        if (typeof this.currentIMAAd.getTitle === 'function') {
          adProperties.name = this.currentIMAAd.getTitle();
        }

        if (typeof this.currentIMAAd.getDuration === 'function') {
          adProperties.duration = this.currentIMAAd.getDuration();
        }

        if (typeof this.currentIMAAd.isSkippable === 'function') {
          adProperties.skippable = this.currentIMAAd.isSkippable();
        }

        if (adProperties.indexInPod === 1) {
          _amc.notifyPodStarted(adId, totalAdsInPod);
        }

        _checkCompanionAds(this.currentIMAAd);
        _amc.notifyLinearAdStarted(adId, adProperties);
      };

      /**
       * Should be called when IMA has shown a non-linear ad rules ad.
       * Forcing this dummy ad through the AMC queue will raise the necessary
       * events for Ad Impression and it will also let the skin know that it
       * needs to show the ads container.
       * @private
       * @method GoogleIMA#_startNonLinearAdRulesOverlay
       */
      const _startNonLinearAdRulesOverlay = () => {
        const adData = {
          position_type: AD_RULES_POSITION_TYPE,
          forced_ad_type: _amc.ADTYPE.NONLINEAR_OVERLAY,
        };
        _checkCompanionAds(this.currentIMAAd);
        _amc.forceAdToPlay(this.name, adData, _amc.ADTYPE.NONLINEAR_OVERLAY);
      };

      /**
       * Stop overlay and prepare the ad manager to be able to request another ad.
       * @private
       * @method GoogleIMA#_stopNonLinearOverlay
       * @param adId the id of the overlay we are stopping
       */
      const _stopNonLinearOverlay = (adId) => {
        _amc.notifyNonlinearAdEnded(adId);

        if (!_usingAdRules) {
          _resetAdsState();
        }
      };

      /**
       * Ends the current ad pod (linear or non linear) and notifies the Ad Manager
       * Controller that the whole ad pod has ended.
       * @private
       * @method GoogleIMA#_endCurrentAdPod
       * @param linear whether or not the ad pod was linear or overlay
       */
      const _endCurrentAdPod = (linear) => {
        if (this.currentAMCAdPod) {
          const { currentAMCAdPod } = this;
          const adId = currentAMCAdPod.id;

          this.currentAMCAdPod = null;
          _linearAdIsPlaying = false;

          if (linear) {
            _amc.notifyPodEnded(adId);
          } else {
            _stopNonLinearOverlay(adId);
          }
        }
      };

      /**
       * Ends the current ad in an ad pod the Ad Manager Controller. If it's the
       * last ad in the pod or if forceEndAdPod is true, it also notifies the AMC
       * that the whole ad pod has ended.
       * @private
       * @method GoogleIMA#_endCurrentAd
       * @param forceEndAdPod forces the ad pod to end
       */
      const _endCurrentAd = (forceEndAdPod) => {
        if (this.currentAMCAdPod) {
          if (this.currentIMAAd) {
            const { currentIMAAd } = this;
            this.currentIMAAd = null;
            if (currentIMAAd.isLinear()) {
              const adPodInfo = currentIMAAd.getAdPodInfo();
              if (!adPodInfo) {
                if (forceEndAdPod) {
                  _endCurrentAdPod(true);
                }
                _throwError('IMA ad returning bad value for this.currentIMAAd.getAdPodInfo().');
              }

              _amc.notifyLinearAdEnded(this.currentAMCAdPod.id);

              const adPos = adPodInfo.getAdPosition();
              const totalAds = adPodInfo.getTotalAds();
              // IMA's ad position is 1 based not 0 based.  So last ad in a 3 ad pod will be position 3.

              // Wait until we receive content resume event from IMA before we end ad pod for
              // single video element mode. This is to workaround an issue where the video controller
              // and IMA are out of sync if we end ad pod too early for single video element mode
              if ((!_amc.ui.useSingleVideoElement && adPos === totalAds) || forceEndAdPod) {
                _endCurrentAdPod(true);
              }
            } else {
              _endCurrentAdPod(this.currentAMCAdPod.isRequest);
            }
          } else {
            _endCurrentAdPod(true);
          }
        }

        _resetUIContainerStyle();
        this.currentIMAAd = null;
        this.adPlaybackStarted = false;
      };

      /**
       * Switches from playing a linear ad to non-linear overlay (Because we don't
       * know what type of ad it is until it plays).
       * @private
       * @method GoogleIMA#_startNonLinearOverlay
       */
      const _startNonLinearOverlay = () => {
        if (!this.currentAMCAdPod) {
          _throwError('Trying to start non linear overlay and this.currentAMCAdPod is falsy');
        }

        // notify that the fake ad has started
        _amc.notifyPodStarted(this.currentAMCAdPod.id);
        // we don't know the type of ad until it starts playing, we assume it's linear
        // but if it isn't then we need to tell the ad manager otherwise and resume playing
        const adData = {
          position_type: NON_AD_RULES_POSITION_TYPE,
          forced_ad_type: _amc.ADTYPE.NONLINEAR_OVERLAY,
        };
        _checkCompanionAds(this.currentIMAAd);
        // end the request ad
        _endCurrentAd(true);
        _amc.forceAdToPlay(this.name, adData, _amc.ADTYPE.NONLINEAR_OVERLAY);
      };

      /**
       * Try to notify the AMC that an ad started to play.  Will fail if either the AMC
       * isn't in ad mode or if IMA hasn't started playing the ad.
       * @private
       * @method GoogleIMA#_tryStartAd
       */
      const _tryStartAd = () => {
        let adTypeStarted = null;
        if (this.currentIMAAd && this.currentAMCAdPod) {
          if (this.currentIMAAd.isLinear()) {
            adTypeStarted = _amc.ADTYPE.LINEAR_VIDEO;
            _startLinearAd();
          } else {
            adTypeStarted = _amc.ADTYPE.NONLINEAR_OVERLAY;
            _startNonLinearOverlay();
          }
        }
        return adTypeStarted;
      };

      /**
       * Callback from IMA SDK to tell this ad manager to pause the main content video. If ad is an Ad Rules ad, the Ad
       * Manager Controller is forced to play an ad.
       * @private
       * @method GoogleIMA#_IMA_SDK_pauseMainContent
       */
      const _IMA_SDK_pauseMainContent = () => {
        OO.log('GOOGLE_IMA:: Content Pause Requested by Google IMA!');
        _linearAdIsPlaying = true;
        if (_usingAdRules) {
          const adData = {
            position_type: AD_RULES_POSITION_TYPE,
            forced_ad_type: _amc.ADTYPE.LINEAR_VIDEO,
          };
          const streams = {};
          streams[OO.VIDEO.ENCODING.IMA] = '';
          if (_playheadTracker.currentTime <= 0) {
            const ad = {
              position: _amc.FORCED_AD_POSITION,
              adManager: this.name,
              ad: adData,
              streams,
              adType: _amc.ADTYPE.LINEAR_VIDEO,
              mainContentDuration: this.mainContentDuration,
            };
            _amc.appendToTimeline([
              new _amc.Ad(ad),
            ]);
            _endCurrentAd(true);
          } else {
            _amc.forceAdToPlay(this.name, adData, _amc.ADTYPE.LINEAR_VIDEO, streams);
          }
        }
      };

      /**
       * Callback from IMA SDK to tell this ad manager to resume the main content video.
       * @private
       * @method GoogleIMA#_IMA_SDK_resumeMainContent
       */
      const _IMA_SDK_resumeMainContent = () => {
        OO.log('GOOGLE_IMA:: Content Resume Requested by Google IMA!');

        // make sure when we resume, that we have ended the ad pod and told
        // the AMC that we have done so.
        _endCurrentAd(true);
      };

      /**
       * If an error occurs cause ad manager to fail gracefully.  If it's ad rules, no more ads will play.  Non ad rules
       * just not play the one ad.
       * @private
       * @method GoogleIMA#_onImaAdError
       * @param {object} adErrorEvent - IMA SDK error data
       */
      const _onImaAdError = (adError) => {
        // all IMA errors are fatal so it's safe to clear out this timeout.
        clearTimeout(this.adsRequestTimeoutRef);
        if (_usingAdRules) {
          // if ads are not ready yet, ima failed to load
          if (!this.adsReady) {
            this.adRulesLoadError = true;
          }
          // give control back to AMC
          _tryUndoSetupForAdRules();
        }

        _IMA_SDK_destroyAdsManager();

        if (adError === OOYALA_IMA_PLUGIN_TIMEOUT) {
          _IMA_SDK_destroyAdsLoader();
        }

        // make sure we are showing the video in case it was hidden for whatever reason.
        if (adError) {
          let errorString = 'ERROR Google IMA';

          // if this error came from the SDK
          if (adError.getError) {
            const errorData = adError.getError();
            let isTimeout = false;
            let isEmpty = false;
            let isPlaybackError = false;
            const errorCodes = {
              vastErrorCode: errorData.getVastErrorCode(),
              innerErrorCode: errorData.getInnerError(),
              errorCode: errorData.getErrorCode(),
            };
            OO.log('GOOGLE_IMA:: SDK Error received: Error Code List', JSON.stringify(errorCodes));
            const imaErrorCodes = google.ima.AdError.ErrorCode;

            switch (errorCodes.vastErrorCode) {
              case imaErrorCodes.VAST_MEDIA_LOAD_TIMEOUT:
              case imaErrorCodes.VAST_LOAD_TIMEOUT:
                isTimeout = true;
                break;
              case imaErrorCodes.VAST_NO_ADS_AFTER_WRAPPER:
              case imaErrorCodes.VAST_EMPTY_RESPONSE:
                isEmpty = true;
                break;
              case imaErrorCodes.VAST_MEDIA_ERROR:
              case imaErrorCodes.VIDEO_PLAY_ERROR:
                isPlaybackError = true;
                break;
              default:
                break;
            }
            if (errorCodes.errorCode === imaErrorCodes.VIDEO_PLAY_ERROR) {
              isPlaybackError = true;
            }

            _amc.onSdkAdEvent(this.name, adError.type, { errorData });
            if (isEmpty) {
              _amc.onAdRequestEmpty(
                this.name,
                this.adPosition,
                this.adFinalTagUrl,
                errorCodes,
                errorData.getMessage(),
              );
            } else if (isPlaybackError) {
              _amc.onAdPlaybackError(
                this.name,
                this.adPosition,
                this.adFinalTagUrl,
                errorCodes,
                errorData.getMessage(),
                this.currentMedia,
              );
            } else {
              _amc.onAdRequestError(
                this.name,
                this.adPosition,
                this.adFinalTagUrl,
                errorCodes,
                errorData.getMessage(),
                isTimeout,
              );
            }
            errorString = `ERROR Google SDK: ${adError.getError()}`;
          } else {
            // else the error came from the plugin
            errorString = `ERROR Google IMA plugin: ${adError}`;
          }

          if (_amc) {
            _amc.raiseAdError(errorString);
          } else {
            OO.log(errorString);
          }
        }

        _endCurrentAd(true);
      };

      /**
       * Callback in case of timeout during ad request.
       * @private
       * @method GoogleIMA#_adsRequestTimeout
       */
      const _adsRequestTimeout = () => {
        OO.log('IMA Ad request timed out');
        if (!this.adsReady) {
          _onImaAdError(OOYALA_IMA_PLUGIN_TIMEOUT);
        }
      };

      /**
       * Tries to request an ad, if all requirements are met.  You cannot request
       * an ad again without first calling _resetAdsState().
       * @private
       * @method GoogleIMA#_trySetupAdsRequest
       */
      const _trySetupAdsRequest = () => {
        // need metadata, ima sdk, and ui to be registered before we can request an ad
        if (this.adsRequested
          || !this.canSetupAdsRequest
          || !this.adTagUrl
          || !this.uiRegistered
          || !_amc.currentEmbedCode
          || !_IMAAdsLoader
          || !_checkRequestAdsOnReplay()) {
          return;
        }

        // at this point we are guaranteed that metadata has been received and the sdk is loaded.
        // so now we can set whether to disable flash ads or not.
        if (google && google.ima && google.ima.settings) {
          google.ima.settings.setDisableFlashAds(this.disableFlashAds);
        }

        const adsRequest = new google.ima.AdsRequest();
        if (this.additionalAdTagParameters) {
          const connector = this.adTagUrl.indexOf('?') > 0 ? '&' : '?';

          // Generate an array of key/value pairings, for faster string concat
          const paramArray = [];
          each(this.additionalAdTagParameters, (paramValue, param) => {
            paramArray.push(`${param}=${paramValue}`);
          });

          this.adTagUrl += connector + paramArray.join('&');
        }
        adsRequest.adTagUrl = OO.getNormalizedTagUrl(this.adTagUrl, _amc.currentEmbedCode);
        this.adFinalTagUrl = adsRequest.adTagUrl;
        // Specify the linear and nonlinear slot sizes. This helps the SDK to
        // select the correct creative if multiple are returned.
        const w = _amc.ui.width;
        const h = _amc.ui.height;
        adsRequest.linearAdSlotWidth = w;
        adsRequest.linearAdSlotHeight = h;

        adsRequest.nonLinearAdSlotWidth = w;
        adsRequest.nonLinearAdSlotHeight = h;

        // Google makes use of certain parameters to determine inventory for ad playback
        const adWillPlayMuted = this.willPlayAdMuted();
        OO.log(`IMA: setAdWillPlayMuted = ${adWillPlayMuted}`);
        adsRequest.setAdWillPlayMuted(adWillPlayMuted);

        _resetAdsState();
        _trySetupForAdRules();
        _IMAAdsLoader.requestAds(adsRequest);

        // Used to determine time until response is received
        this.adRequestTime = new Date().valueOf();
        _amc.onAdRequest(this.name, this.adPosition);
        if (this.runningUnitTests && this.maxAdsRequestTimeout === 0) {
          _adsRequestTimeout();
        } else {
          this.adsRequestTimeoutRef = delay(_adsRequestTimeout, this.maxAdsRequestTimeout);
        }
        this.adsRequested = true;
      };

      /**
       * Tries to initialize the AdsManager variable, from the IMA SDK, that is received from an ad request.
       * @private
       * @method GoogleIMA#_tryPlayImaAd
       */
      const _tryPlayImaAd = () => {
        // block this code from running till we want to play the video
        // if you run it before then ima will take over and immediately try to play
        // ads (if there is a preroll)
        const validAdRequestSuccess = this.currentAMCAdPod && _adToPlayOnRequestSuccess
          === this.currentAMCAdPod;
        const readyToPlay = validAdRequestSuccess || _usingAdRules;
        if (_IMAAdsManager && this.initialPlayRequested && !_imaAdPlayed && _uiContainer && readyToPlay) {
          try {
            // PBW-6610
            // Traditionally we have relied on the LOADED ad event before calling adsManager.start.
            // This may have worked accidentally.
            // IMA Guides and the video suite inspector both call adsManager.start immediately after
            // adsManager.init
            // Furthermore, some VPAID ads do not fire LOADED event until adsManager.start is called
            _tryStartAdsManager();
            _adToPlayOnRequestSuccess = null;
            _imaAdPlayed = true;

            // notify placeholder end if we do not have a preroll to start main content

            // handling this after starting the ads manager since we need these states for determining
            // if we require muted autoplay.
            if (_usingAdRules
              && !this.hasPreroll
              && this.currentAMCAdPod
              && this.currentAMCAdPod.adType === _amc.ADTYPE.UNKNOWN_AD_REQUEST) {
              _amc.notifyPodStarted(this.currentAMCAdPod.id, 1);
              _endCurrentAd(true);
            }
          } catch (adError) {
            _onImaAdError(adError);
          }
        }
      };

      /**
       * Callback from IMA SDK for ad tracking events.
       * @private
       * @method GoogleIMA#_IMA_SDK_onAdEvent
       * @param {object} adEvent The IMA ad event
       */
      const _IMA_SDK_onAdEvent = (adEvent) => {
        if (_ignoreWhenAdNotPlaying(adEvent)) {
          OO.log('Ignoring IMA EVENT: ', adEvent.type, adEvent);
          return;
        }
        _amc.onSdkAdEvent(this.name, adEvent.type, { adData: adEvent.getAdData() });
        // Retrieve the ad from the event. Some events (e.g. ALL_ADS_COMPLETED)
        // don't have ad object associated.
        const eventType = google.ima.AdEvent.Type;
        const ad = adEvent.getAd();

        switch (adEvent.type) {
          case eventType.LOADED:
            _startPlaylistAd(adEvent);
            // We normally focus the video element when receiving the ad STARTED notification from IMA.
            // However, for environments where only a single video element is supported, we will focus the video
            // element right before starting the ad. This allows the video element listeners to get unregistered
            // and prevent shared video element interference.
            if (_amc.ui.useSingleVideoElement) {
              _amc.focusAdVideo();
            }
            this.currentMedia = ad.getMediaUrl();
            _resetUIContainerStyle();
            break;
          case eventType.STARTED:
            // Workaround of an issue on iOS where the IMA iframe is capturing clicks after an ad.
            // We will show the iframe on receiving STARTED and hide it when receiving COMPLETE
            if (OO.isIos) {
              const IMAiframe = _getImaIframe();
              if (IMAiframe && IMAiframe.style) {
                IMAiframe.style.display = 'block';
              }
            }

            if (this.videoControllerWrapper && this.requiresMutedAutoplay()) {
              // workaround of an IMA issue where we don't receive a MUTED ad event
              // on Safari mobile, so we'll notify of current volume and mute state now
              this.videoControllerWrapper.raiseVolumeEvent();
            }

            this.adPlaybackStarted = true;
            if (ad.isLinear()) {
              _linearAdIsPlaying = true;

              if (!_amc.ui.useSingleVideoElement) {
                _amc.focusAdVideo();
              }

              if (this.savedVolume >= 0) {
                this.setVolume(this.savedVolume);
                this.savedVolume = -1;
              }
              // Since IMA handles its own UI, we want the video player to hide its UI elements
              _amc.hidePlayerUi(this.showAdControls, false, this.autoHideAdControls);

              // in the case where skippable ads are enabled we want to exit fullscreen
              // because custom playback is disabled and ads can't be rendered in fullscreen.
              if (_inlinePlaybackSupported() && OO.isIphone && this.enableIosSkippableAds === true) {
                if (this.sharedVideoElement) {
                  this.sharedVideoElement.webkitExitFullscreen();
                }
              }
            } else {
              this.currentNonLinearIMAAd = ad;
            }
            this.currentIMAAd = ad;
            _onSizeChanged();
            _tryStartAd();
            if (this.videoControllerWrapper) {
              if (ad.isLinear()) {
                this.videoControllerWrapper.raisePlayEvent();
              }
              this.videoControllerWrapper.raiseTimeUpdate(this.getCurrentTime(), this.getDuration());
              _startTimeUpdater();
            }
            // Non-linear ad rules or VMAP ads will not be started by _tryStartAd()
            // because there'll be no AMC ad pod. We start them here after the time update event
            // in order to prevent the progress bar from flashing
            if (_usingAdRules && !ad.isLinear()) {
              _startNonLinearAdRulesOverlay();
            }
            break;
          case eventType.RESUMED:
            if (this.videoControllerWrapper) {
              if (ad.isLinear()) {
                this.videoControllerWrapper.raisePlayEvent();
              }
            }
            break;
          case eventType.USER_CLOSE:
          case eventType.SKIPPED:
          case eventType.COMPLETE: {
            // Workaround of an issue on iOS where the IMA iframe is capturing clicks after an ad.
            // We will show the iframe on receiving STARTED and hide it when receiving COMPLETE
            if (OO.isIos) {
              _hideImaIframe();
            }

            if (_usingAdRules) {
              this.adResponseTime = new Date().valueOf();
            }
            let adSkipped = false;
            if (adEvent.type === eventType.SKIPPED) {
              adSkipped = true;
            }
            const completionTime = new Date().valueOf() - this.currentImpressionTime;
            _amc.onAdCompleted(this.name, completionTime, adSkipped, this.adFinalTagUrl);
            this.adPlaybackStarted = false;
            if (this.videoControllerWrapper && (ad && ad.isLinear())) {
              _stopTimeUpdater();
              // IMA provides values which can result in negative current times or current times which are greater than duration.
              // For good user experience, we will provide the duration as the current time here if the event type is COMPLETE
              const currentTime = adEvent.type === eventType.COMPLETE
                ? this.getDuration()
                : this.getCurrentTime();
              this.videoControllerWrapper.raiseTimeUpdate(currentTime, this.getDuration());
              this.videoControllerWrapper.raiseEndedEvent();
            }
            // Save the volume so the volume can persist on future ad playbacks if we don't receive another volume update from VTC
            this.savedVolume = this.getVolume();

            if (!ad || !ad.isLinear()) {
              this.currentNonLinearIMAAd = null;
            }

            _endCurrentAd(false);
            _linearAdIsPlaying = false;
            _onAdMetrics(adEvent);
            break;
          }
          case eventType.PAUSED:
            _raisePauseEvent();
            break;
          case eventType.ALL_ADS_COMPLETED:
            _linearAdIsPlaying = false;
            OO.log('all google ima ads completed!');
            _tryUndoSetupForAdRules();

            /*
            On iPhone, _IMA_SDK_resumeMainContent() is not being triggered after the last postroll, for
            both adrules and non-adrules. For non-adrules, this event is triggered after every ad,
            so we must check that it is the last postroll before calling _IMA_SDK_resumeMainContent().
            */
            if (OO.isIos && this.contentEnded && _amc.isLastAdPlayed()) {
              _IMA_SDK_resumeMainContent();
            }
            break;
          case eventType.IMPRESSION: {
            this.currentImpressionTime = new Date().valueOf();
            const loadTime = this.currentImpressionTime - this.adResponseTime;
            let protocol = 'VAST';
            if (ad && ad.g && ad.g.vpaid === true) {
              protocol = 'VPAID';
            }
            let type = 'unknown';
            if (ad && ad.isLinear()) {
              if (ad.getContentType().lastIndexOf('video', 0) === 0) {
                type = _amc.ADTYPE.LINEAR_VIDEO;
              } else {
                type = _amc.ADTYPE.LINEAR_OVERLAY;
              }
            } else if (ad && ad.getContentType().lastIndexOf('video', 0) === 0) {
              type = _amc.ADTYPE.NONLINEAR_VIDEO;
            } else {
              type = _amc.ADTYPE.NONLINEAR_OVERLAY;
            }
            _amc.onAdSdkImpression(this.name, this.adPosition, loadTime, protocol, type);
            break;
          }
          case eventType.FIRST_QUARTILE:
          case eventType.MIDPOINT:
          case eventType.THIRD_QUARTILE:
            _onAdMetrics(adEvent);
            break;
          case eventType.VOLUME_CHANGED:
          case eventType.VOLUME_MUTED:
            // Workaround of an issue where if IMA takes too long to mute the video
            // for autoplay. If we receive the muted event and ad playback has not started,
            // call resume() to force IMA to try playing the ad again. Note that
            // calling start() again does not seem to work.
            // Observed on Android Nexus 6P, version 7.1.1
            if (adEvent.type === eventType.VOLUME_MUTED && !this.adPlaybackStarted) {
              _IMAAdsManager.resume();
            }
            if (this.videoControllerWrapper) {
              this.videoControllerWrapper.raiseVolumeEvent();
            }
            break;
          case eventType.DURATION_CHANGE:
            if (this.videoControllerWrapper) {
              this.videoControllerWrapper.raiseDurationChange(this.getCurrentTime(), this.getDuration());
            }
            break;
          case eventType.AD_BREAK_READY:
            break;
          case eventType.CLICK:
            _IMA_SDK_onAdClicked(adEvent);
            break;
          case eventType.CONTENT_PAUSE_REQUESTED:
            if (_usingAdRules && ad) {
              const adPodInfo = ad.getAdPodInfo();
              const adPodIndex = adPodInfo.getPodIndex();

              // If ad is not part of preroll.
              if (adPodIndex !== 0) {
                this.adResponseTime = new Date().valueOf();
              }
            }
            _IMA_SDK_pauseMainContent(adEvent);
            break;
          case eventType.CONTENT_RESUME_REQUESTED:
            _IMA_SDK_resumeMainContent(adEvent);
            break;
          default:
            break;
        }
      };

      /**
       * Callback when ad request is completed. Sets up ad manager to listen to IMA SDK events.
       * @private
       * @method GoogleIMA#_onAdRequestSuccess
       * @param {object} adsManagerLoadedEvent - from the IMA SDK contains the IMA AdManager instance.
       */
      const _onAdRequestSuccess = (adsManagerLoadedEvent) => {
        clearTimeout(this.adsRequestTimeoutRef);
        this.adResponseTime = new Date().valueOf();
        const responseTime = this.adResponseTime - this.adRequestTime;
        const timeSinceInitialPlay = this.adResponseTime - this.initialPlayRequestTime;
        _amc.onAdRequestSuccess(this.name, this.adPosition, responseTime, timeSinceInitialPlay);
        _amc.onSdkAdEvent(this.name, adsManagerLoadedEvent.type, { eventData: {} });

        if (!_usingAdRules && _IMAAdsManager) {
          // destroy the current ad manager is there is one
          _IMA_SDK_destroyAdsManager();
          this.currentIMAAd = null;
          this.currentNonLinearIMAAd = null;
        }
        // https://developers.google.com/interactive-media-ads/docs/sdks/googlehtml5_apis_v3#ima.AdsRenderingSettings
        const adsSettings = new google.ima.AdsRenderingSettings();
        adsSettings.loadVideoTimeout = DEFAULT_LOAD_VIDEO_TIME_OUT;
        adsSettings.restoreCustomPlaybackStateOnAdBreakComplete = false;
        adsSettings.useStyledNonLinearAds = true;
        adsSettings.enablePreloading = this.preloadAds;
        if (this.useGoogleCountdown) {
          // both COUNTDOWN and AD_ATTRIBUTION are required as per
          // https://developers.google.com/interactive-media-ads/docs/sdks/html5/v3/apis#ima.UiElements
          adsSettings.uiElements = [google.ima.UiElements.COUNTDOWN, google.ima.UiElements.AD_ATTRIBUTION];
        }
        adsSettings.useStyledLinearAds = this.useGoogleAdUI;
        _IMAAdsManager = adsManagerLoadedEvent.getAdsManager(_playheadTracker, adsSettings);

        // When the ads manager is ready, we are ready to apply css changes to the video element
        if (this.videoControllerWrapper) {
          this.videoControllerWrapper.readyForCss = true;
        }

        if (this.videoControllerWrapper) {
          this.videoControllerWrapper.applyStoredCss();
        }

        // a cue point index of 0 references a preroll, so we know we have a preroll if we find it in cuePoints
        const cuePoints = _IMAAdsManager.getCuePoints();
        this.hasPreroll = cuePoints.indexOf(0) >= 0;

        const eventType = google.ima.AdEvent.Type;
        // Add listeners to the required events.
        _IMAAdsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, _onImaAdError, false, this);

        // Following is gathered from:
        // https://developers.google.com/interactive-media-ads/docs/sdks/html5/v3/apis#ima.AdEvent.Type
        const imaAdEvents = [
          eventType.AD_BREAK_READY,
          eventType.AD_METADATA,
          eventType.ALL_ADS_COMPLETED,
          eventType.CLICK,
          eventType.COMPLETE,
          eventType.CONTENT_PAUSE_REQUESTED,
          eventType.CONTENT_RESUME_REQUESTED,
          eventType.DURATION_CHANGE,
          eventType.FIRST_QUARTILE,
          eventType.IMPRESSION,
          eventType.INTERACTION,
          eventType.LINEAR_CHANGED,
          eventType.LOADED,
          eventType.LOG,
          eventType.MIDPOINT,
          eventType.PAUSED,
          eventType.RESUMED,
          eventType.SKIPPABLE_STATE_CHANGED,
          eventType.SKIPPED,
          eventType.STARTED,
          eventType.THIRD_QUARTILE,
          eventType.USER_CLOSE,
          eventType.VOLUME_CHANGED,
          eventType.VOLUME_MUTED,
        ];

        const addIMAEventListener = (e) => {
          _IMAAdsManager.addEventListener(e, _IMA_SDK_onAdEvent, false, this);
        };

        each(imaAdEvents, addIMAEventListener, this);

        // Workaround of an issue on iOS where the IMA iframe is capturing clicks.
        if (OO.isIos) {
          _hideImaIframe();
        }

        // We can safely call init here if we're not using ad rules
        // If we are using ad rules, we need to wait until we get the initialPlayRequested event so that we
        // are ready for ad playback.
        if (!_usingAdRules || this.initialPlayRequested) {
          _IMAAdsManager.init(
            _uiContainer.clientWidth,
            _uiContainer.clientHeight,
            google.ima.ViewMode.NORMAL,
          );
        }

        _trySetAdManagerToReady();
        this.adsReady = true;

        _tryPlayImaAd();
      };

      /**
       * Tries to create an IMA SDK AdsLoader.  The AdsLoader notifies this ad manager when ad requests are completed.
       * @private
       * @method GoogleIMA#IMA_SDK_tryCreateAdsLoader
       */
      const IMA_SDK_tryCreateAdsLoader = () => {
        if (_IMAAdDisplayContainer) {
          const adsManagerEvents = google.ima.AdsManagerLoadedEvent.Type;
          const adErrorEvent = google.ima.AdErrorEvent.Type;
          _IMA_SDK_destroyAdsLoader();
          _IMAAdsLoader = new google.ima.AdsLoader(_IMAAdDisplayContainer);
          _IMAAdsLoader.addEventListener(adsManagerEvents.ADS_MANAGER_LOADED, _onAdRequestSuccess, false);
          _IMAAdsLoader.addEventListener(adErrorEvent.AD_ERROR, _onImaAdError, false);
        }
      };

      /**
       * Tries to initialize the IMA SDK AdContainer.  This is where the ads will be located.
       * @private
       * @method GoogleIMA#_IMA_SDK_tryInitAdContainer
       */
      const _IMA_SDK_tryInitAdContainer = () => {
        if (_adModuleJsReady && this.uiRegistered) {
          if (!_isGoogleSDKValid()) {
            _throwError('IMA SDK loaded but does not contain valid data');
          }

          if (!_IMAAdDisplayContainer) {
            //* *It's now safe to set SDK settings, we have all the page level overrides and
            // the SDK is guaranteed to be loaded.

            // These are required by Google for tracking purposes.
            google.ima.settings.setPlayerVersion(PLUGIN_VERSION);
            google.ima.settings.setPlayerType(PLAYER_TYPE);
            if (_amc.uiLanguage) {
              google.ima.settings.setLocale(_amc.uiLanguage);
            } else {
              google.ima.settings.setLocale(OO.getLocale());
            }

            if (this.useInsecureVpaidMode) {
              google.ima.settings.setVpaidMode(google.ima.ImaSdkSettings.VpaidMode.INSECURE);
            } else {
              google.ima.settings.setVpaidMode(google.ima.ImaSdkSettings.VpaidMode.ENABLED);
            }

            google.ima.settings.setDisableCustomPlaybackForIOS10Plus(this.enableIosSkippableAds);

            if (this.maxRedirects && typeof (this.maxRedirects) === 'number' && this.maxRedirects > 0) {
              google.ima.settings.setNumRedirects(this.maxRedirects);
            }

            // Prefer to use player skin plugins element to allow for click throughs. Use plugins element if not available
            _uiContainer = _amc.ui.playerSkinPluginsElement
              ? _amc.ui.playerSkinPluginsElement[0]
              : _amc.ui.pluginsElement[0];
            // iphone performance is terrible if we don't use the custom playback (i.e. filling in the second param for adDisplayContainer)
            // also doesn't not seem to work nicely with podded ads if you don't use it.

            const vid = this.sharedVideoElement;

            // for IMA, we always want to use the plugins element to house the IMA UI. This allows it to behave
            // properly with the Alice skin.
            _IMAAdDisplayContainer = new google.ima.AdDisplayContainer(_uiContainer,
              vid);
          }

          IMA_SDK_tryCreateAdsLoader();

          _trySetAdManagerToReady();
        }
      };

      /**
       * Callback for Ad Manager Controller EVENTS.INITIAL_PLAY_REQUESTED.  Sets up IMA SDK so it can display ads and
       * trys to request ads if preloading Ad Rules is not enabled.
       * @private
       * @method GoogleIMA#_onInitialPlayRequested
       * @param {string} event The event name
       * @param {boolean} wasAutoplayed True if the video was autoplayed, false if not
       */
      const _onInitialPlayRequested = (event, wasAutoplayed) => {
        this.initialPlayRequestTime = new Date().valueOf();
        OO.log('_onInitialPlayRequested');
        // double check that IMA SDK loaded.
        if (!_IMAAdDisplayContainer) {
          _onImaAdError();
          _amc.unregisterAdManager(this.name);
          _throwError('onInitialPlayRequested called but _IMAAdDisplayContainer not created yet.');
        }

        this.initialPlayRequested = true;
        this.isReplay = false;
        _IMAAdDisplayContainer.initialize();
        this.capturedUserClick = this.capturedUserClick || !wasAutoplayed;

        // if the IMA ads manager object exists, this means that the ad was preloaded
        // Call the init function here when using ad rules so that IMA can take over ad control.
        // If we call it earlier, the ad will start playback automatically even if we're not autoplaying
        if (_usingAdRules && _IMAAdsManager) {
          _IMAAdsManager.init(
            _uiContainer.clientWidth,
            _uiContainer.clientHeight,
            google.ima.ViewMode.NORMAL,
          );
        }
        _tryPlayImaAd();

        this.canSetupAdsRequest = true;
        _trySetupAdsRequest();
      };

      /**
       * Callback for Ad Manager Controller EVENTS.REPLAY_REQUESTED.  Resets the IMA SDK to be able to
       * request ads again and then requests the ads if it's AdRules.
       * @private
       * @method GoogleIMA#_onReplayRequested.
       */
      const _onReplayRequested = () => {
        if (!_IMAAdsLoader) {
          // The Ads Loader might have been destroyed if we had timed out.
          IMA_SDK_tryCreateAdsLoader();
        }
        this.isReplay = true;
        _resetAdsState();
        _resetPlayheadTracker();
        this.contentEnded = false;
        this.adRulesLoadError = false;
        // In the case of ad rules, non of the ads are in the timeline
        // and we won't call initialPlayRequested again. So we manually call
        // to load the ads again. We don't care about preloading at this point.
        if (_usingAdRules) {
          _trySetupAdsRequest();
        }
      };

      /**
       * Callback after IMA SDK is successfully loaded. Tries to setup ad request and container for ads.
       * @private
       * @method GoogleIMA#_onSdkLoaded
       * @param success - whether SDK loaded successfully.
       */
      const _onSdkLoaded = (success) => {
        let errorString = '';
        _adModuleJsReady = success;
        OO.log('onSdkLoaded!');
        // [PBK-639] Corner case where Google's SDK 200s but isn't properly
        // loaded. Better safe than sorry..
        if (!success || !_isGoogleSDKValid()) {
          _onImaAdError();
          errorString = 'ERROR Google SDK failed to load';
          if (success && !_isGoogleSDKValid()) {
            errorString = 'ERROR Google SDK loaded but could not be validated';
          }
          _amc.onAdSdkLoadFailure(this.name, errorString);
          _amc.unregisterAdManager(this.name);
          return;
        }
        _amc.onAdSdkLoaded(this.name);
        _IMA_SDK_tryInitAdContainer();
        _trySetupAdsRequest();
      };

      this.registerVideoControllerWrapper = (videoWrapper) => {
        this.videoControllerWrapper = videoWrapper;
      };

      /**
       * Notifies IMA if the browser requires muted autoplay or not. This test is typically done
       * on a video element.
       * @protected
       * @method GoogleIMA#setRequiresMutedAutoplay
       * @param {boolean} required True if the browser requires muted autoplay, false otherwise
       */
      this.setRequiresMutedAutoplay = (required) => {
        browserCanAutoplayUnmuted = !required;
      };

      /**
       * Checks to see if autoplay requires the video to be muted
       * @protected
       * @method GoogleIMA#requiresMutedAutoplay
       * @returns {boolean} true if video must be muted to autoplay, false otherwise
       */
      this.requiresMutedAutoplay = () => !browserCanAutoplayUnmuted
        && (
          (OO.isSafari && OO.macOsSafariVersion >= 11)
          || OO.isIos
          || OO.isAndroid
          || (OO.isChrome && OO.chromeMajorVersion >= 66)
        );

      /**
       * Add listeners to the Ad Manager Controller about playback.
       * @private
       * @method GoogleIMA#_createAMCListeners
       */
      const _createAMCListeners = () => {
        _amc.addPlayerListener(_amc.EVENTS.INITIAL_PLAY_REQUESTED, _onInitialPlayRequested);
        _amc.addPlayerListener(_amc.EVENTS.CONTENT_COMPLETED, _onContentCompleted);
        _amc.addPlayerListener(_amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onPlayheadTimeChanged);
        _amc.addPlayerListener(_amc.EVENTS.SIZE_CHANGED, _onSizeChanged);
        _amc.addPlayerListener(_amc.EVENTS.CONTENT_CHANGED, _onContentChanged);
        _amc.addPlayerListener(_amc.EVENTS.REPLAY_REQUESTED, _onReplayRequested);
        _amc.addPlayerListener(_amc.EVENTS.FULLSCREEN_CHANGED, _onFullscreenChanged);
      };

      /**
       * Remove listeners from the Ad Manager Controller about playback.
       * @private
       * @method GoogleIMA@_removeAMCListeners
       */
      const _removeAMCListeners = () => {
        if (_amc) {
          _amc.removePlayerListener(_amc.EVENTS.INITIAL_PLAY_REQUESTED, _onInitialPlayRequested);
          _amc.removePlayerListener(_amc.EVENTS.CONTENT_COMPLETED, _onContentCompleted);
          _amc.removePlayerListener(_amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onPlayheadTimeChanged);
          _amc.removePlayerListener(_amc.EVENTS.SIZE_CHANGED, _onSizeChanged);
          _amc.removePlayerListener(_amc.EVENTS.CONTENT_CHANGED, _onContentChanged);
          _amc.removePlayerListener(_amc.EVENTS.REPLAY_REQUESTED, _onReplayRequested);
          _amc.removePlayerListener(_amc.EVENTS.FULL_SCREEN_CHANGED, _onFullscreenChanged);
        }
      };

      /**
       * Cancel the current ad, and destroy/reset all the GoogleIMA SDK variables.
       * @public
       * @method GoogleIMA#destroy
       */
      this.destroy = () => {
        _uiContainer = null;
        _tryUndoSetupForAdRules();
        _IMA_SDK_destroyAdsManager();
        _IMA_SDK_destroyAdsLoader();
        _IMA_SDK_destroyAdDisplayContainer();
        _resetVars();
        _removeAMCListeners();
      };

      /**
       * Initializes the class by registering the ad manager controller.
       * Adds listeners for Ad Manager Controller events.
       * @public
       * @method GoogleIMA#initialize
       * @param {object} amcIn A reference to the ad manager controller instance
       * @param {string} playerId The unique player identifier of the player initializing the class
       */
      this.initialize = (amcIn, playerId) => {
        registeredGoogleIMAManagers[playerId] = this;

        _amc = amcIn;

        const ext = OO.DEBUG ? '_debug.js' : '.js';
        const remoteModuleJs = `//imasdk.googleapis.com/js/sdkloader/ima3${ext}`;
        _resetVars();
        _createAMCListeners();
        if (!this.runningUnitTests) {
          _amc.loadAdModule(this.name, remoteModuleJs, _onSdkLoaded);
        } else {
          _onSdkLoaded(true);
        }
      };

      /**
       * This is called by the ad manager controller when the metadata has been loaded.
       * Ingests metadata, determines if it should use AdRules logic or Non AdRules logic.
       * If preloading ad rules ads is enabled, then it preloads the ads as well.
       * @public
       * @method GoogleIMA#loadMetadata
       * @param {object} metadata Ad manager metadata from Backlot and from the page level
       * @param {object} baseMetadata Base level metadata from Backlot
       * @param {object} movieMetadata Metadata pertaining specifically to the movie being played
       */
      this.loadMetadata = (metadata, baseMetadata, movieMetadata) => {
        this.mainContentDuration = movieMetadata.duration / 1000;
        this.allAdInfo = metadata.all_ads;

        // Check if any ad is ad rules type.  if one is then we change to only using ad rules.
        const usesAdRulesCheck = ad => ad.position_type === AD_RULES_POSITION_TYPE;
        const adRulesAd = find(metadata.all_ads, usesAdRulesCheck);
        _usingAdRules = !!adRulesAd;
        this.adRulesLoadError = false;

        // only fill in the adTagUrl if it's ad rules. Otherwise wait till AMC gives the correct one.
        this.adTagUrl = null;
        if (_usingAdRules) {
          this.adTagUrl = adRulesAd.tag_url;
          this.adPosition = 0;
        }

        // check if ads should play on replays
        this.requestAdsOnReplay = true;
        if (_amc.adManagerSettings.hasOwnProperty(_amc.AD_SETTINGS.REPLAY_ADS)) {
          this.requestAdsOnReplay = _amc.adManagerSettings[_amc.AD_SETTINGS.REPLAY_ADS];
        }

        this.preloadAds = false;
        if (_amc.adManagerSettings.hasOwnProperty(_amc.AD_SETTINGS.PRELOAD_ADS)) {
          this.preloadAds = _amc.adManagerSettings[_amc.AD_SETTINGS.PRELOAD_ADS];
        }

        // check for override on ad timeout
        this.maxAdsRequestTimeout = DEFAULT_ADS_REQUEST_TIME_OUT;
        // IMA does not like timeouts of 0, it still attempts to play the ad even though
        // we have timed out
        // This may be a fault of the plugin or SDK. More investigation is required
        if (isFinite(_amc.adManagerSettings[_amc.AD_SETTINGS.AD_LOAD_TIMEOUT])
          && (_amc.adManagerSettings[_amc.AD_SETTINGS.AD_LOAD_TIMEOUT] > 0 || this.runningUnitTests)) {
          this.maxAdsRequestTimeout = _amc.adManagerSettings[_amc.AD_SETTINGS.AD_LOAD_TIMEOUT];
        }

        this.additionalAdTagParameters = null;
        if (metadata.hasOwnProperty('additionalAdTagParameters')) {
          this.additionalAdTagParameters = metadata.additionalAdTagParameters;
        }

        // if playerControlsOverAds is true we can assume the player controls
        // should be shown. Otherwise use whatever is passed in for showAdControls
        this.showAdControls = false;
        this.playerControlsOverAds = _amc.pageSettings && _amc.pageSettings.playerControlsOverAds === true;
        if (this.playerControlsOverAds) {
          this.showAdControls = true;
        } else if (metadata.hasOwnProperty('showAdControls')) {
          this.showAdControls = metadata.showAdControls;
        }

        // if we are showing the ad controls but the control bar isn't
        // supposed to go over the video, then the video will resize
        // and we have to disable autohiding the bar.
        this.autoHideAdControls = true;
        if (this.showAdControls && !this.playerControlsOverAds) {
          this.autoHideAdControls = false;
        }

        this.useGoogleAdUI = false;
        if (metadata.hasOwnProperty('useGoogleAdUI')) {
          this.useGoogleAdUI = metadata.useGoogleAdUI;
        }

        this.useGoogleCountdown = false;
        if (metadata.hasOwnProperty('useGoogleCountdown')) {
          this.useGoogleCountdown = metadata.useGoogleCountdown;
        }

        this.useInsecureVpaidMode = false;
        if (metadata.hasOwnProperty('vpaidMode')) {
          this.useInsecureVpaidMode = metadata.vpaidMode === 'insecure';
        }

        this.disableFlashAds = false;
        if (metadata.hasOwnProperty('disableFlashAds')) {
          this.disableFlashAds = metadata.disableFlashAds;
        }

        this.imaIframeZIndex = DEFAULT_IMA_IFRAME_Z_INDEX;
        if (metadata.hasOwnProperty('iframeZIndex')) {
          this.imaIframeZIndex = metadata.iframeZIndex;
        }

        this.enableIosSkippableAds = false;
        if (metadata.hasOwnProperty('enableIosSkippableAds')) {
          this.enableIosSkippableAds = metadata.enableIosSkippableAds;
        }

        // we don't set a default because we want Google's default if it isn't specified.
        if (metadata.hasOwnProperty('setMaxRedirects')) {
          if (typeof metadata.setMaxRedirects === 'number') {
            this.maxRedirects = metadata.setMaxRedirects;
          } else if (typeof metadata.setMaxRedirects === 'string') {
            // convert to number
            this.maxRedirects = +metadata.setMaxRedirects;
          }
        }

        // On second video playthroughs, we will not be initializing the ad manager again.
        // Attempt to create the ad display container here instead of after the sdk has loaded
        if (!_IMAAdDisplayContainer) {
          _IMA_SDK_tryInitAdContainer();
        } else if (!_IMAAdsLoader) {
          // The Ads Loader might have been destroyed if we had timed out.
          IMA_SDK_tryCreateAdsLoader();
        }

        this.metadataReady = true;

        _trySetAdManagerToReady();

        // double check that we have ads to play, and that after building the timeline there are ads (it filters out
        // ill formed ads).
        const validAdTags = _getValidAdTagUrls();
        if (validAdTags && validAdTags.length > 0) {
          if (_usingAdRules) {
            this.canSetupAdsRequest = false;
          }
        }
      };

      /**
       * Called when the UI has been set up.  Sets up the native element listeners and style for the overlay.
       * Checks if the module is ready to send the request for ads.
       * @public
       * @method GoogleIMA#registerUi
       */
      this.registerUi = () => {
        this.uiRegistered = true;
        if (_amc.ui.useSingleVideoElement && !this.sharedVideoElement && _amc.ui.ooyalaVideoElement[0]
          && (_amc.ui.ooyalaVideoElement[0].className === 'video')) {
          this.setupSharedVideoElement(_amc.ui.ooyalaVideoElement[0]);
        }

        _IMA_SDK_tryInitAdContainer();
        _trySetupAdsRequest();
      };

      /**
       * Sets up the shared video element.
       * @public
       * @method GoogleIMA#setupSharedVideoElement
       * @param element Element to be setup as the shared video element
       */
      this.setupSharedVideoElement = (element) => {
        // Remove any listeners we added on the previous shared video element
        if (this.sharedVideoElement && OO.isIphone
          && typeof this.sharedVideoElement.removeEventListener === 'function') {
          this.sharedVideoElement.removeEventListener('webkitendfullscreen', _raisePauseEvent);
        }
        this.sharedVideoElement = element;
        // On iPhone, there is a limitation in the IMA SDK where we do not receive a pause event when
        // we leave the native player
        // This is a workaround to listen for the webkitendfullscreen event ourselves
        if (this.sharedVideoElement && OO.isIphone
          && typeof this.sharedVideoElement.addEventListener === 'function') {
          this.sharedVideoElement.addEventListener('webkitendfullscreen', _raisePauseEvent);
        }
      };

      /**
       * Called by the ad manager controller.  Creates OO.AdManagerController#Ad objects, places them in an array,
       * and returns them to the ad manager controller.  If AdRules is used, then the list will be empty. In that
       * case the SDK will handle the timing of ads playing.
       * @public
       * @method GoogleIMA#buildTimeline
       * @returns {OO.AdManagerController#Ad[]} timeline A list of the ads to play for the current video
       */
      this.buildTimeline = () => {
        let streams;
        const adsTimeline = [];
        // for the moment we don't support mixing adrules and non-adrules.
        if (!_usingAdRules) {
          const validAdTags = _getValidAdTagUrls();
          if (validAdTags) {
            for (let i = 0; i < validAdTags.length; i++) {
              const ad = validAdTags[i];
              // double check it's not an ad rules ad before trying to add it to the timeline
              if (ad.position_type !== AD_RULES_POSITION_TYPE) {
                streams = {};
                streams[OO.VIDEO.ENCODING.IMA] = '';
                const adData = {
                  position: ad.position / 1000,
                  adManager: this.name,
                  ad,
                  streams,
                  adType: _amc.ADTYPE.UNKNOWN_AD_REQUEST,
                  mainContentDuration: this.mainContentDuration,
                };

                if (ad.position_type === NON_AD_RULES_PERCENT_POSITION_TYPE) {
                  adData.positionType = NON_AD_RULES_PERCENT_POSITION_TYPE;
                  adData.position = ad.position;
                }

                const adToInsert = new _amc.Ad(adData);
                adsTimeline.push(adToInsert);
              }
            }
          }
        } else {
          // return a placeholder preroll while we wait for IMA
          streams = {};
          streams[OO.VIDEO.ENCODING.IMA] = '';
          const placeholder = [new _amc.Ad({
            position: 0,
            duration: 0,
            adManager: this.name,
            ad: {},
            streams,
            // use linear video so VTC can prepare the video element (does not disturb overlays)
            adType: _amc.ADTYPE.UNKNOWN_AD_REQUEST,
          })];

          return placeholder;
        }

        return adsTimeline;
      };

      /**
       * Called by the ad manager controller.  Ad Manager Controller lets the module know that an ad should play now.
       * @public
       * @method GoogleIMA#playAd
       * @param {object} ad The ad to play from the timeline.
       * @param {object} adRequestOnly True to request the ad without starting playback, false to request and playback the ad
       */
      this.playAd = (amcAdPod, adRequestOnly) => {
        if (amcAdPod === null || typeof amcAdPod === 'undefined') {
          return;
        }

        if (!adRequestOnly) {
          _adToPlayOnRequestSuccess = amcAdPod;
        } else {
          _requestedAd = amcAdPod;
        }

        if (_requestedAd === amcAdPod && this.currentAMCAdPod === amcAdPod) {
          if (!adRequestOnly) {
            _adToPlayOnRequestSuccess = this.currentAMCAdPod;

            if (this.adsReady) {
              _tryPlayImaAd();
            }
          }

          return;
        }

        if (this.currentAMCAdPod) {
          _endCurrentAd(true);
        }

        this.currentAMCAdPod = amcAdPod;
        if (!this.currentAMCAdPod) {
          _throwError('playAd() called but amcAdPod is null.');
        } else if (!this.currentAMCAdPod.ad) {
          _throwError('playAd() called but amcAdPod.ad is null.');
        }

        /*
        Set the z-index of IMA's iframe, where IMA ads are displayed, to 10004.
        This puts IMA ads in front of the main content element, but under the control bar.
        This fixes issues where overlays appear behind the video and for iOS it fixes
        video ads not showing.
        */
        const IMAiframe = _getImaIframe();
        if (IMAiframe && IMAiframe.style) {
          IMAiframe.style.zIndex = this.imaIframeZIndex;
        }

        if (_usingAdRules && this.currentAMCAdPod.adType === _amc.ADTYPE.UNKNOWN_AD_REQUEST) {
          if (adRequestOnly) {
            this.canSetupAdsRequest = true;
            _trySetupAdsRequest();
          }

          return;
        }

        // IMA doesn't use the adVideoElement layer so make sure to hide it.
        if (!_amc.ui.useSingleVideoElement && _amc.ui.adVideoElement) {
          _amc.ui.adVideoElement.css(INVISIBLE_CSS);
        }

        if (_usingAdRules && this.currentAMCAdPod.ad.forced_ad_type !== _amc.ADTYPE.NONLINEAR_OVERLAY) {
          _tryStartAd();
        } else if (this.currentAMCAdPod.ad.forced_ad_type !== _amc.ADTYPE.NONLINEAR_OVERLAY) {
          // if we are trying to play an linear ad then we need to request the ad now.
          // reset adRequested and adTagUrl so we can request another ad
          _resetAdsState();
          this.adTagUrl = this.currentAMCAdPod.ad.tag_url;
          this.adPosition = this.currentAMCAdPod.ad.position / 1000;
          _trySetupAdsRequest();
        } else {
          // Otherwise we are trying to play an overlay, at this point IMA is already
          // displaying it, so just notify AMC that we are showing an overlay.

          // provide width and height values if available. Alice will use these to resize
          // the skin plugins div when a non linear overlay is on screen
          if (this.currentAMCAdPod && this.currentNonLinearIMAAd) {
            // IMA requires some padding in order to have the overlay render or else
            // IMA thinks the available real estate is too small.
            this.currentAMCAdPod.width = this.currentNonLinearIMAAd.getWidth();
            this.currentAMCAdPod.height = this.currentNonLinearIMAAd.getHeight();
            this.currentAMCAdPod.paddingWidth = OVERLAY_WIDTH_PADDING;
            this.currentAMCAdPod.paddingHeight = OVERLAY_HEIGHT_PADDING;
            _onSizeChanged();
          }
          // raise WILL_PLAY_NONLINEAR_AD event and alert AMC and player that a nonlinear ad is started.
          // Nonlinear ad is rendered by IMA.
          _amc.sendURLToLoadAndPlayNonLinearAd(this.currentAMCAdPod, this.currentAMCAdPod.id, null);
        }
      };


      /**
       * Called by the ad manager controller.  Cancels the current running ad.
       * @public
       * @method GoogleIMA#cancelAd
       * @param {object} ad The ad to cancel
       */
      this.cancelAd = (ad) => {
        if (ad && this.currentAMCAdPod && ad.id !== this.currentAMCAdPod.id) {
          _throwError('AMC canceling ad that is not the current one playing.');
        }
        OO.log('GOOGLE IMA: ad got canceled by AMC');

        if (!_usingAdRules) {
          _IMA_SDK_destroyAdsManager();
        }
        _endCurrentAd(true);
      };

      /**
       * Called by the ad manager controller.  Hide the overlay. In this case, overlay showing, after a hide, is not supported
       * so it just cancels the overlay.
       * @public
       * @method GoogleIMA#hideOverlay
       * @param {object} ad The ad to hide
       */
      this.cancelOverlay = (ad) => {
        // currently IMA doesn't have overlay durations so it will always be canceled.
        // They will never receive a completed message.
        this.cancelAd(ad);
      };

      /**
       * Called by the ad manager controller.  Pauses the current ad.
       * @public
       * @method GoogleIMA#pauseAd
       */
      this.pauseAd = () => {
        if (_IMAAdsManager && this.adPlaybackStarted) {
          _IMAAdsManager.pause();
        }
      };

      /**
       * Called by the ad manager controller.  Resumes the current ad.
       * @public
       * @method GoogleIMA#resumeAd
       */
      this.resumeAd = () => {
        if (this.startImaOnVtcPlay) {
          this.startImaOnVtcPlay = false;
          if (_IMAAdsManager) {
            _IMAAdsManager.start();
          }
        } else if (_IMAAdsManager && this.adPlaybackStarted) {
          // On iPhone, just calling _IMAAdsManager.resume doesn't resume the video
          // We want to force the video to reenter fullscreen and play
          if (OO.isIphone && this.sharedVideoElement) {
            // resumeAd will only be called if we have exited fullscreen
            // so this is safe to call
            if (!_inlinePlaybackSupported()) {
              this.sharedVideoElement.webkitEnterFullscreen();
            }
            this.sharedVideoElement.play();
          }
          _IMAAdsManager.resume();
        }
      };

      this.getVolume = () => {
        let volume = 1;
        if (_IMAAdsManager) {
          volume = _IMAAdsManager.getVolume();
        }
        return volume;
      };

      this.setVolume = (volume) => {
        if (_IMAAdsManager) {
          // do not set non-zero volumes if we have not captured the user click
          // since that will cause IMA to error out on platforms where
          // muted autoplay is not supported
          const isVolumeDifferent = _IMAAdsManager.getVolume() !== volume;
          if (isVolumeDifferent
            && (this.capturedUserClick || volume === 0 || !this.requiresMutedAutoplay())
          ) {
            this.savedVolume = -1;
            _IMAAdsManager.setVolume(volume);
            // workaround of an IMA issue where we don't receive a VOLUME_CHANGED ad event
            // on when sharing video element or if playback has not started,
            // so we'll notify of current volume and mute state now
            if (this.videoControllerWrapper && (!this.adPlaybackStarted || this.sharedVideoElement)) {
              this.videoControllerWrapper.raiseVolumeEvent();
            }
          }
        } else {
          // if ad is not playing, store the volume to set later when we start the video
          this.savedVolume = volume;
        }
      };

      /**
       * Preps the IMA SDK for unmuted playback. This needs to be done
       * on the user click thread.
       * @protected
       * @method GoogleIMA#setupUnmutedPlayback
       */
      this.setupUnmutedPlayback = () => {
        this.capturedUserClick = true;
        // We need to pass the user click to the IMA AdDisplayContainer's
        // initialize method so that IMA can start ads unmuted.
        // Do not do this if curently playing an ad or else the ad will restart.
        // We call IMA's setVolume method to pass the click instead if ad is
        // currently playing
        if (!this.currentIMAAd) {
          if (_IMAAdDisplayContainer) {
            _IMAAdDisplayContainer.initialize();
          }
        }
      };

      this.getCurrentTime = () => {
        let currentTime = 0;
        // IMA provides values for getRemainingTime which can result in negative current times
        // or current times which are greater than duration.
        // We will check these boundaries so we will not report these unexpected current times
        if (_IMAAdsManager
          && this.currentIMAAd
          && _IMAAdsManager.getRemainingTime() >= 0
          && _IMAAdsManager.getRemainingTime() <= this.currentIMAAd.getDuration()) {
          currentTime = this.currentIMAAd.getDuration() - _IMAAdsManager.getRemainingTime();
        }
        return currentTime;
      };

      this.getDuration = () => {
        let duration = 0;
        if (this.currentIMAAd) {
          duration = this.currentIMAAd.getDuration();
        }
        return duration;
      };

      this.adVideoFocused = () => {
        // Required for plugin
      };

      /**
       * Checks to see if we intend for the ad to playback muted.
       * @protected
       * @method GoogleIMA#willPlayAdMuted
       * @returns {boolean} true if we intend for the ad to playback muted, false otherwise
       */
      this.willPlayAdMuted = () => this.requiresMutedAutoplay() && !this.capturedUserClick;
    };

    return new GoogleIMA();
  });

  /**
   * @class GoogleIMAVideoWrapper
   * @classdesc Player object that wraps the video element.
   * @param {object} ima The GoogleIMA object this will communicate with
   * @property {object} controller A reference to the Ooyala Video Tech Controller
   * @property {boolean} disableNativeSeek When true, the plugin should supress or undo seeks that come from
   *                                       native video controls
   * @property {boolean} readyForCss When true, css may be applied on the video element.  When false, css
   *                                 should be stored for use later when this value is true.
   */
  const GoogleIMAVideoWrapper = function (ima) {
    const _ima = ima;

    this.controller = {};
    this.disableNativeSeek = true;
    this.isControllingVideo = true;
    this.readyForCss = false;
    let storedCss = null;
    let previousVolume = 1;

    /** ********************************************************************************* */
    // Required. Methods that Video Controller, Destroy, or Factory call
    /** ********************************************************************************* */

    /**
     * Takes control of the video element from another plugin.
     * @public
     * @method GoogleIMAVideoWrapper#sharedElementGive
     */
    this.sharedElementTake = () => {
      this.isControllingVideo = true;
    };

    /**
     * Hands control of the video element off to another plugin.
     * @public
     * @method GoogleIMAVideoWrapper#sharedElementGive
     */
    this.sharedElementGive = () => {
      this.isControllingVideo = false;
    };

    /**
     * Subscribes to all events raised by the video element.
     * This is called by the Factory during creation.
     * @public
     * @method GoogleIMAVideoWrapper#subscribeAllEvents
     */
    this.subscribeAllEvents = () => {
      _ima.registerVideoControllerWrapper(this);
    };

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method GoogleIMAVideoWrapper#load
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = () => {
    };

    /**
     * Triggers playback on the video element.
     * @public
     * @method GoogleIMAVideoWrapper#play
     */
    this.play = () => {
      _ima.resumeAd();
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method GoogleIMAVideoWrapper#pause
     */
    this.pause = () => {
      _ima.pauseAd();
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method GoogleIMAVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     */
    this.seek = () => {
    };

    /**
     * Triggers a mute on the video element.
     * @public
     * @method TemplateVideoWrapper#mute
     */
    this.mute = () => {
      // Note there is no "mute" API. IMA seems to handle the muted
      // attribute themselves when volume is set to 0
      const currentVolume = _ima.getVolume();
      if (currentVolume) {
        previousVolume = currentVolume;
      }
      _ima.setVolume(0);
    };

    /**
     * Triggers an unmute on the video element.
     * @public
     * @method TemplateVideoWrapper#unmute
     * @param {boolean} fromUser True if the action was from a user click, false otherwise
     */
    this.unmute = (fromUser) => {
      if (fromUser) {
        _ima.setupUnmutedPlayback();
      }
      _ima.setVolume(previousVolume || 1);
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method GoogleIMAVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = (volume, muteState) => {
      previousVolume = volume;
      if (muteState) {
        this.mute();
      } else {
        _ima.setVolume(volume);
      }
    };

    /**
     * Gets the current time position of the video.
     * @public
     * @method GoogleIMAVideoWrapper#getCurrentTime
     * @returns {number} The current time position of the video (seconds)
     */
    this.getCurrentTime = () => {
      const time = _ima.getCurrentTime();
      return time;
    };

    /**
     * Triggers application of css changes that have been previously stored.
     * @public
     * @method GoogleIMAVideoWrapper#applyStoredCss
     */
    this.applyStoredCss = () => {
      this.applyCss(storedCss);
    };

    /**
     * Callback to handle notifications that ad finished playing
     * @private
     * @method GoogleIMAVideoWrapper#onAdsPlayed
     */
    this.onAdsPlayed = () => {
    };

    /**
     * Does the application of css to the video element if the video element is shared and under ima control.
     * @private
     * @method GoogleIMAVideoWrapper#applyCssToElemenet
     */
    const applyCssToElement = (css) => {
      if (css && this.isControllingVideo && _ima.sharedVideoElement) {
        const node = document.querySelector(_ima.sharedVideoElement);
        pairs(css).forEach(([key, value]) => {
          node.style[key] = value;
        });
      }
    };

    /**
     * Applies the given css to the video element.
     * @public
     * @method GoogleIMAVideoWrapper#applyCss
     * @param {object} css The css to apply in key value pairs
     */
    this.applyCss = (css) => {
      if (!this.readyForCss) {
        storedCss = css;
      } else {
        applyCssToElement(css);
      }
    };

    /**
     * Destroys the individual video element.
     * @public
     * @method GoogleIMAVideoWrapper#destroy
     */
    this.destroy = () => {
      _ima.sharedVideoElement = null;
    };

    /**
     * Calls the controller notify function only if the video wrapper is controlling the video element.
     * @private
     * @method GoogleIMAVideoWrapper#notifyIfInControl
     * @param {string} event The event to raise to the video controller
     * @param {object} params [optional] Event parameters
     */
    const notifyIfInControl = (event, params) => {
      if (this.isControllingVideo) {
        this.controller.notify(event, params);
      }
    };

    // Events
    this.raisePlayEvent = () => {
      notifyIfInControl(this.controller.EVENTS.PLAY, {});
      notifyIfInControl(this.controller.EVENTS.PLAYING);
    };

    this.raiseEndedEvent = () => {
      notifyIfInControl(this.controller.EVENTS.ENDED);
    };

    this.raisePauseEvent = () => {
      notifyIfInControl(this.controller.EVENTS.PAUSED);
    };

    this.raiseVolumeEvent = () => {
      // IMA is considered muted when volume is set to 0. There are no getters
      // for the muted state
      const volume = _ima.getVolume();
      if (volume === 0) {
        notifyIfInControl(this.controller.EVENTS.MUTE_STATE_CHANGE, { muted: true });
      } else {
        notifyIfInControl(this.controller.EVENTS.MUTE_STATE_CHANGE, { muted: false });
        // PLAYER-2810: Publishing a volume of 0 overwrites the users unmuted volume. We'll
        // only publish volume if we're not muted so that this does not happen
        notifyIfInControl(this.controller.EVENTS.VOLUME_CHANGE, { volume });
      }
    };

    /**
     * While we can not know the value of "buffer"
     * (
     * for SDK, IMA representatives answer:
     * > The IMA SDK for Android doesn’t support the buffer size
     * )
     * set it to 1 (use 1 instead of 0 to avoid the problem of displaying Spinner on the AdScreen)
     * @param {String} eventname - event name
     * @param {Number} currentTime - current time
     * @param {Number} duration - a video duration
     * @param {Number} buffer - value of buffer
     * @link https://groups.google.com/forum/#!topic/ima-sdk/zRNKpKNSukM
     */
    const raisePlayhead = (eventname, currentTime, duration, buffer = 1) => {
      const seekRange = { begin: 0, end: 0 };
      notifyIfInControl(eventname, {
        currentTime, duration, buffer, seekRange,
      });
    };

    this.raiseTimeUpdate = (currentTime, duration) => {
      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, currentTime, duration);
    };

    this.raiseDurationChange = (currentTime, duration) => {
      raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, currentTime, duration);
    };

    /**
     * Notifies the video controller that unmuted playback has failed.
     * @private
     * @method GoogleIMAVideoWrapper#raiseUnmutedPlaybackFailed
     */
    this.raiseUnmutedPlaybackFailed = () => {
      notifyIfInControl(this.controller.EVENTS.UNMUTED_PLAYBACK_FAILED);
    };

    /**
     * Called by the video controller. Notifies the video plugin that unmuted auto-playback of the content was successful.
     * Will notify the IMA ad plugin so that it can play ads unmuted.
     * @public
     * @method GoogleIMAVideoWrapper#notifyUnmutedContentAutoPlaybackSucceeded
     */
    this.notifyUnmutedContentAutoPlaybackSucceeded = () => {
      _ima.setRequiresMutedAutoplay(false);
    };
  };

  /**
   * @class GoogleIMAVideoFactory
   * @classdesc Factory for creating video player objects that use HTML5 video tags.
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use (true if elements can be created)
   * @property {object} streams An array of supported encoding types (ex. m3u8, mp4)
   */
  const GoogleIMAVideoFactory = function () {
    this.name = 'GoogleIMAVideoTech';
    this.encodings = [OO.VIDEO.ENCODING.IMA];
    this.features = [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_TAKE];
    this.technology = OO.VIDEO.TECHNOLOGY.HTML5;

    /**
     * Creates a video player instance using GoogleIMAVideoWrapper.
     * @public
     * @method GoogleIMAVideoFactory#create
     * @param {object} parentContainer The jquery div that should act as the parent for the video element
     * @param {string} id The id of the video player instance to create
     * @param {object} ooyalaVideoController A reference to the video controller in the Ooyala player
     * @param {object} css The css to apply to the video element
     * @param {string} playerId The unique player identifier of the player creating this instance
     * @returns {object} A reference to the wrapper for the newly created element
     */
    this.create = (parentContainer, id, ooyalaVideoController, css, playerId) => {
      const googleIMA = registeredGoogleIMAManagers[playerId];
      const wrapper = new GoogleIMAVideoWrapper(googleIMA);
      wrapper.controller = ooyalaVideoController;
      wrapper.subscribeAllEvents();
      return wrapper;
    };

    /**
     * Creates a video player instance using GoogleIMAVideoWrapper which wraps and existing video element.
     * @public
     * @method GoogleIMAVideoFactory#createFromExisting
     * @param {string} domId The dom id of the video DOM object to use
     * @param {object} ooyalaVideoController A reference to the video controller in the Ooyala player
     * @param {string} playerId The unique player identifier of the player creating this instance
     * @returns {object} A reference to the wrapper for the video element
     */
    this.createFromExisting = (domId, ooyalaVideoController, playerId) => {
      const googleIMA = registeredGoogleIMAManagers[playerId];
      googleIMA.setupSharedVideoElement(document.getElementById(domId));
      const wrapper = new GoogleIMAVideoWrapper(googleIMA);
      wrapper.controller = ooyalaVideoController;
      wrapper.subscribeAllEvents();
      return wrapper;
    };

    /**
     * Destroys the video technology factory.
     * @public
     * @method GoogleIMAVideoFactory#destroy
     */
    this.destroy = () => {
      this.encodings = [];
      this.create = () => {
      };
      this.createFromExisting = () => {
      };
    };

    /**
     * Represents the max number of support instances of video elements that can be supported on the
     * current platform. -1 implies no limit.
     * @public
     * @property GoogleIMAVideoFactory#maxSupportedElements
     */
    this.maxSupportedElements = -1;
  };

  OO.Video.plugin(new GoogleIMAVideoFactory());
}());
