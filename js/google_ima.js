/*
 * Google IMA Ad Manager
 * owner: PBI
 * originally authored: June 2015
 */

//TODO make amc ignore ad request timeout.
require("../html5-common/js/utils/InitModules/InitOOUnderscore.js");
require("../html5-common/js/utils/constants.js");
require("../html5-common/js/utils/utils.js");



(function(_, $)
{
  var registeredGoogleIMAManagers = {};

  OO.Ads.manager(function(_, $)
  {
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
    var GoogleIMA = function()
    {
      this.name = "google-ima-ads-manager";
      this.ready = false;
      this.runningUnitTests = false;
      this.sharedVideoElement = null;

      //private member variables of this GoogleIMA object
      var _amc = null;
      var _adModuleJsReady = false;
      var _playheadTracker;
      var _usingAdRules;
      var _IMAAdsLoader;
      var _IMAAdsManager;
      var _IMAAdsManagerInitialized;
      var _IMAAdDisplayContainer;
      var _linearAdIsPlaying;
      var _timeUpdater = null;
      var _uiContainer = null;
      var _uiContainerPrevStyle = null;

      //Constants
      var DEFAULT_IMA_IFRAME_Z_INDEX = 10004;
      var DEFAULT_ADS_REQUEST_TIME_OUT = 15000;
      var AD_RULES_POSITION_TYPE = 'r';
      var NON_AD_RULES_POSITION_TYPE = 't';
      var NON_AD_RULES_PERCENT_POSITION_TYPE = 'p';
      var PLAYER_TYPE = "Ooyala";
      var PLUGIN_VERSION = "1.0";

      var VISIBLE_CSS = {left: OO.CSS.VISIBLE_POSITION, visibility: "visible"};
      var INVISIBLE_CSS = {left: OO.CSS.INVISIBLE_POSITION, visibility: "hidden"};

      var OVERLAY_WIDTH_PADDING = 50;
      var OVERLAY_HEIGHT_PADDING = 50;

      var TIME_UPDATER_INTERVAL = 500;
      var OOYALA_IMA_PLUGIN_TIMEOUT = "ooyalaImaPluginTimeout";

      /**
       * Helper function to make functions private to GoogleIMA variable for consistency
       * and ease of reading.
       */
      var privateMember = _.bind(function(functionVar)
      {
        if (!_.isFunction(functionVar))
        {
          _throwError("Error: Trying to make private function but " + functionVar + " is not a function.");
          return;
        }
        return _.bind(functionVar, this);
      }, this);

      /**
       * Initializes the class by registering the ad manager controller.
       * Adds listeners for Ad Manager Controller events.
       * @public
       * @method GoogleIMA#initialize
       * @param {object} amcIn A reference to the ad manager controller instance
       * @param {string} playerId The unique player identifier of the player initializing the class
       */
      this.initialize = function(amcIn, playerId)
      {
        registeredGoogleIMAManagers[playerId] = this;

        _amc = amcIn;

        var ext = OO.DEBUG ? '_debug.js' : '.js';
        var remoteModuleJs = "//imasdk.googleapis.com/js/sdkloader/ima3" + ext;
        _resetVars();
        _createAMCListeners();
        if (!this.runningUnitTests)
        {
          _amc.loadAdModule(this.name, remoteModuleJs, _onSdkLoaded);
        }
        else
        {
          _onSdkLoaded(true);
        }
      };

      /**
       * Reset all the variables needed for multiple ad plays.
       * @private
       * @method GoogleIMA#_createAMCListeners
       */
      var _resetVars = privateMember(function()
      {
        this.ready = false;
        this.preloadAdRulesAds = false;
        _usingAdRules = true;

        this.mainContentDuration = 0;
        this.initialPlayRequested = false;
        this.canSetupAdsRequest = true;
        this.adTagUrl = null;
        this.showInAdControlBar = false;
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

        //flag to track whether ad rules failed to load
        this.adRulesLoadError = false;

        //google sdk variables
        _IMAAdsLoader = null;
        _IMAAdsManager = null;
        _IMAAdsManagerInitialized = false;
        _IMAAdDisplayContainer = null;
      });

      /**
       * Add listeners to the Ad Manager Controller about playback.
       * @private
       * @method GoogleIMA#_createAMCListeners
       */
      var _createAMCListeners = privateMember(function()
      {
        _amc.addPlayerListener(_amc.EVENTS.INITIAL_PLAY_REQUESTED, _onInitialPlayRequested);
        _amc.addPlayerListener(_amc.EVENTS.CONTENT_COMPLETED, _onContentCompleted);
        _amc.addPlayerListener(_amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onPlayheadTimeChanged);
        _amc.addPlayerListener(_amc.EVENTS.SIZE_CHANGED, _onSizeChanged);
        _amc.addPlayerListener(_amc.EVENTS.CONTENT_CHANGED, _onContentChanged);
        _amc.addPlayerListener(_amc.EVENTS.REPLAY_REQUESTED, _onReplayRequested);
        _amc.addPlayerListener(_amc.EVENTS.FULLSCREEN_CHANGED, _onFullscreenChanged);
      });

      /**
       * Remove listeners from the Ad Manager Controller about playback.
       * @private
       * @method GoogleIMA@_removeAMCListeners
       */
      var _removeAMCListeners = privateMember(function()
      {
        if (_amc)
        {
          _amc.removePlayerListener(_amc.EVENTS.INITIAL_PLAY_REQUESTED, _onInitialPlayRequested);
          _amc.removePlayerListener(_amc.EVENTS.CONTENT_COMPLETED, _onContentCompleted);
          _amc.removePlayerListener(_amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onPlayheadTimeChanged);
          _amc.removePlayerListener(_amc.EVENTS.SIZE_CHANGED, _onSizeChanged);
          _amc.removePlayerListener(_amc.EVENTS.CONTENT_CHANGED, _onContentChanged);
          _amc.removePlayerListener(_amc.EVENTS.REPLAY_REQUESTED, _onReplayRequested);
          _amc.removePlayerListener(_amc.EVENTS.FULL_SCREEN_CHANGED, _onFullscreenChanged);
        }
      });

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
      this.loadMetadata = function(metadata, baseMetadata, movieMetadata)
      {
        this.mainContentDuration = movieMetadata.duration/1000;
        this.allAdInfo = metadata.all_ads;

        //Check if any ad is ad rules type.  if one is then we change to only using ad rules.
        var usesAdRulesCheck =
          function(ad)
          {
            return ad.position_type == AD_RULES_POSITION_TYPE;
          };
        var adRulesAd = _.find(metadata.all_ads, usesAdRulesCheck);
        _usingAdRules = !!adRulesAd;
        this.adRulesLoadError = false;

        //only fill in the adTagUrl if it's ad rules. Otherwise wait till AMC gives the correct one.
        this.adTagUrl = null;
        if (_usingAdRules)
        {
          this.adTagUrl = adRulesAd.tag_url;
        }

        //the preload feature works, but has been disabled due to product, so setting to false here
        this.preloadAdRulesAds = false;

        //check if ads should play on replays
        this.requestAdsOnReplay = true;
        if (_amc.adManagerSettings.hasOwnProperty(_amc.AD_SETTINGS.REPLAY_ADS))
        {
          this.requestAdsOnReplay = _amc.adManagerSettings[_amc.AD_SETTINGS.REPLAY_ADS];
        }

        //check for override on ad timeout
        this.maxAdsRequestTimeout = DEFAULT_ADS_REQUEST_TIME_OUT;
        //IMA does not like timeouts of 0, it still attempts to play the ad even though
        //we have timed out
        //This may be a fault of the plugin or SDK. More investigation is required
        if (_.isFinite(_amc.adManagerSettings[_amc.AD_SETTINGS.AD_LOAD_TIMEOUT])
            && (_amc.adManagerSettings[_amc.AD_SETTINGS.AD_LOAD_TIMEOUT] > 0 || this.runningUnitTests))
        {
          this.maxAdsRequestTimeout = _amc.adManagerSettings[_amc.AD_SETTINGS.AD_LOAD_TIMEOUT];
        }

        this.additionalAdTagParameters = null;
        if (metadata.hasOwnProperty("additionalAdTagParameters"))
        {
          this.additionalAdTagParameters = metadata.additionalAdTagParameters;
        }

        this.showAdControls = false;
        if (metadata.hasOwnProperty("showAdControls"))
        {
          this.showAdControls = metadata.showAdControls;
        }

        this.useGoogleAdUI = false;
        if (metadata.hasOwnProperty("useGoogleAdUI"))
        {
          this.useGoogleAdUI = metadata.useGoogleAdUI;
        }

        this.useGoogleCountdown = false;
        if (metadata.hasOwnProperty("useGoogleCountdown"))
        {
          this.useGoogleCountdown = metadata.useGoogleCountdown;
        }

        this.useInsecureVpaidMode = false;
        if (metadata.hasOwnProperty("vpaidMode"))
        {
          this.useInsecureVpaidMode = metadata.vpaidMode === "insecure";
        }

        this.disableFlashAds = false;
        if (metadata.hasOwnProperty("disableFlashAds"))
        {
          this.disableFlashAds = metadata.disableFlashAds;
        }

        this.imaIframeZIndex = DEFAULT_IMA_IFRAME_Z_INDEX;
        if (metadata.hasOwnProperty("iframeZIndex"))
        {
          this.imaIframeZIndex = metadata.iframeZIndex;
        }

        //On second video playthroughs, we will not be initializing the ad manager again.
        //Attempt to create the ad display container here instead of after the sdk has loaded
        if (!_IMAAdDisplayContainer)
        {
          _IMA_SDK_tryInitAdContainer();
        }
        else if (!_IMAAdsLoader)
        {
          //The Ads Loader might have been destroyed if we had timed out.
          IMA_SDK_tryCreateAdsLoader();
        }

        this.metadataReady = true;

        _trySetAdManagerToReady();

        //double check that we have ads to play, and that after building the timeline there are ads (it filters out
        //ill formed ads).
        var validAdTags = _getValidAdTagUrls();
        if (validAdTags && validAdTags.length > 0)
        {
          if (_usingAdRules)
          {
            if (this.preloadAdRulesAds)
            {
              this.canSetupAdsRequest = true;
              _trySetupAdsRequest();
            }
            else
            {
              this.canSetupAdsRequest = false;
            }
          }
        }
      };

      /**
       * Called when the UI has been set up.  Sets up the native element listeners and style for the overlay.
       * Checks if the module is ready to send the request for ads.
       * @public
       * @method GoogleIMA#registerUi
       */
      this.registerUi = function()
      {
        this.uiRegistered = true;
        if (_amc.ui.useSingleVideoElement && !this.sharedVideoElement && _amc.ui.ooyalaVideoElement[0] &&
            (_amc.ui.ooyalaVideoElement[0].className === "video")) {
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
      this.setupSharedVideoElement = function(element)
      {
        //Remove any listeners we added on the previous shared video element
        if (this.sharedVideoElement && OO.isIphone && typeof this.sharedVideoElement.removeEventListener === "function")
        {
          this.sharedVideoElement.removeEventListener('webkitendfullscreen', _raisePauseEvent);
        }
        this.sharedVideoElement = element;
        //On iPhone, there is a limitation in the IMA SDK where we do not receive a pause event when
        //we leave the native player
        //This is a workaround to listen for the webkitendfullscreen event ourselves
        if(this.sharedVideoElement && OO.isIphone && typeof this.sharedVideoElement.addEventListener === "function"){
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
      this.buildTimeline = function()
      {
        var adsTimeline = [];
        //for the moment we don't support mixing adrules and non-adrules.
        if (!_usingAdRules)
        {
          var validAdTags = _getValidAdTagUrls();
          if(validAdTags)
          {
            for (var i = 0; i < validAdTags.length; i++)
            {
              var ad = validAdTags[i];
              //double check it's not an ad rules ad before trying to add it to the timeline
              if (ad.position_type != AD_RULES_POSITION_TYPE)
              {
                var streams = {};
                streams[OO.VIDEO.ENCODING.IMA] = "";
                var adData = {
                  "position": ad.position / 1000,
                  "adManager": this.name,
                  "ad": ad,
                  "streams": streams,
                  "adType": _amc.ADTYPE.UNKNOWN_AD_REQUEST
                };

                //percentage position types require a different calculation.
                if (ad.position_type == NON_AD_RULES_PERCENT_POSITION_TYPE)
                {
                  adData.position = ad.position/100 * this.mainContentDuration;
                }

                var adToInsert = new _amc.Ad(adData);
                adsTimeline.push(adToInsert);
              }
            }
          }
        }
        else
        {
          //return a placeholder preroll while we wait for IMA
          var streams = {};
          streams[OO.VIDEO.ENCODING.IMA] = "";
          var placeholder = [ new _amc.Ad({
            position: 0,
            duration: 0,
            adManager: this.name,
            ad: {},
            streams: streams,
            //use linear video so VTC can prepare the video element (does not disturb overlays)
            adType: _amc.ADTYPE.UNKNOWN_AD_REQUEST
          })];

          return placeholder;
        }

        return adsTimeline;
      };

      /**
       * Returns all the valid ad tags stored inside of this.allAdInfo. If using
       * Ad Rules, return only valid Ad Rules ads. If not using Ad Rules then
       * it returns the valid non Ad Rules ads.
       * @private
       * @method GoogleIMA#_getValidAdTagUrls
       * @returns {array} Ads with valid ad tags. Null if this.allAdInfo doesn't exist.
       */
      var _getValidAdTagUrls = privateMember(function()
      {
        if (!this.allAdInfo)
        {
          return null;
        }

        return _.filter(this.allAdInfo, _isValidAdTag);
      });

      /**
       * Returns true if ad (from backlot) has a valid ad tag.
       * @private
       * @method GoogleIMA#isValidAdTag
       * @returns {array} Ads with valid ad tags.
       */
      var _isValidAdTag = privateMember(function(ad)
      {
        if(!ad)
        {
          return false;
        }

        var url = ad.tag_url;
        var isAdRulesAd = (ad.position_type == AD_RULES_POSITION_TYPE);
        var isSameAdType = (_usingAdRules == isAdRulesAd);

        return isSameAdType && url && typeof url === 'string';
      });

      /**
       * Called by the ad manager controller.  Ad Manager Controller lets the module know that an ad should play now.
       * @public
       * @method GoogleIMA#playAd
       * @param {object} ad The ad to play from the timeline.
       */
      this.playAd = function(amcAdPod)
      {
        if(this.currentAMCAdPod)
        {
          _endCurrentAd(true);
        }

        this.currentAMCAdPod = amcAdPod;
        if(!this.currentAMCAdPod)
        {
          _throwError("playAd() called but amcAdPod is null.");
        }
        else if (!this.currentAMCAdPod.ad)
        {
          _throwError("playAd() called but amcAdPod.ad is null.");
        }

        /*
        Set the z-index of IMA's iframe, where IMA ads are displayed, to 10004.
        This puts IMA ads in front of the main content element, but under the control bar.
        This fixes issues where overlays appear behind the video and for iOS it fixes
        video ads not showing.
        */
        var IMAiframe = $("iframe[src^='http://imasdk.googleapis.com/']")[0];
        if (IMAiframe && IMAiframe.style)
        {
          IMAiframe.style.zIndex = this.imaIframeZIndex;
        }

        if(_usingAdRules && this.currentAMCAdPod.adType == _amc.ADTYPE.UNKNOWN_AD_REQUEST)
        {
          //we started our placeholder ad
          _amc.notifyPodStarted(this.currentAMCAdPod.id, 1);
          //if the sdk ad request failed when trying to preload, we should end the placeholder ad
          if(this.preloadAdRulesAds && this.adRulesLoadError)
          {
            _amc.notifyPodEnded(this.currentAMCAdPod.id, 1);
          }
          return;
        }

        //IMA doesn't use the adVideoElement layer so make sure to hide it.
        if (!_amc.ui.useSingleVideoElement && _amc.ui.adVideoElement)
        {
          _amc.ui.adVideoElement.css(INVISIBLE_CSS);
        }

        if(_usingAdRules && this.currentAMCAdPod.ad.forced_ad_type !== _amc.ADTYPE.NONLINEAR_OVERLAY)
        {
          _tryStartAd();
        }
        else
        {
          //if we are trying to play an linear ad then we need to request the ad now.
          if (this.currentAMCAdPod.ad.forced_ad_type != _amc.ADTYPE.NONLINEAR_OVERLAY)
          {
            //reset adRequested and adTagUrl so we can request another ad
            _resetAdsState();
            this.adTagUrl = this.currentAMCAdPod.ad.tag_url;
            _trySetupAdsRequest();
          }
          //Otherwise we are trying to play an overlay, at this point IMA is already
          //displaying it, so just notify AMC that we are showing an overlay.
          else
          {
            //provide width and height values if available. Alice will use these to resize
            //the skin plugins div when a non linear overlay is on screen
            if (this.currentAMCAdPod && this.currentNonLinearIMAAd)
            {
              //IMA requires some padding in order to have the overlay render or else
              //IMA thinks the available real estate is too small.
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
        }
      };

      /**
       * Called by the ad manager controller.  Hide the overlay. In this case, overlay showing, after a hide, is not supported
       * so it just cancels the overlay.
       * @public
       * @method GoogleIMA#hideOverlay
       * @param {object} ad The ad to hide
       */
      this.cancelOverlay = function(ad)
      {
        //currently IMA doesn't have overlay durations so it will always be canceled.
        //They will never receive a completed message.
        this.cancelAd(ad);
      };

      /**
       * Called by the ad manager controller.  Cancels the current running ad.
       * @public
       * @method GoogleIMA#cancelAd
       * @param {object} ad The ad to cancel
       */
      this.cancelAd = function(ad)
      {
        if(ad && this.currentAMCAdPod && ad.id != this.currentAMCAdPod.id)
        {
          _throwError("AMC canceling ad that is not the current one playing.");
        }
        OO.log("GOOGLE IMA: ad got canceled by AMC");

        if (!_usingAdRules)
        {
          _IMA_SDK_destroyAdsManager();
        }
        _endCurrentAd(true);
      };

      /**
       * Called by the ad manager controller.  Pauses the current ad.
       * @public
       * @method GoogleIMA#pauseAd
       * @param {object} ad The ad to pause
       */
      this.pauseAd = function(ad)
      {
        if (_IMAAdsManager && this.adPlaybackStarted)
        {
          _IMAAdsManager.pause();
        }
      };

      /**
       * Called by the ad manager controller.  Resumes the current ad.
       * @public
       * @method GoogleIMA#resumeAd
       * @param {object} ad The ad to resume
       */
      this.resumeAd = function(ad)
      {
        if (_IMAAdsManager && this.adPlaybackStarted)
        {
          //On iPhone, just calling _IMAAdsManager.resume doesn't resume the video
          //We want to force the video to reenter fullscreen and play
          if (OO.isIphone && this.sharedVideoElement)
          {
            //resumeAd will only be called if we have exited fullscreen
            //so this is safe to call
            this.sharedVideoElement.webkitEnterFullscreen();
            this.sharedVideoElement.play();
          }
          _IMAAdsManager.resume();
        }
      };

      this.getVolume = function()
      {
        var volume = 1;
        if (_IMAAdsManager)
        {
          volume = _IMAAdsManager.getVolume();
        }
        return volume;
      };

      this.setVolume = function(volume)
      {
        if (_IMAAdsManager && _linearAdIsPlaying)
        {
          _IMAAdsManager.setVolume(volume);
        }
        else
        {
          //if ad is not playing, store the volume to set later when we start the video
          this.savedVolume = volume;
        }
      };

      this.getCurrentTime = function()
      {
        var currentTime = 0;
        //IMA provides values for getRemainingTime which can result in negative current times
        //or current times which are greater than duration.
        //We will check these boundaries so we will not report these unexpected current times
        if (_IMAAdsManager &&
          this.currentIMAAd &&
          _IMAAdsManager.getRemainingTime() >= 0 &&
          _IMAAdsManager.getRemainingTime() <= this.currentIMAAd.getDuration())
        {
          currentTime = this.currentIMAAd.getDuration() - _IMAAdsManager.getRemainingTime();
        }
        return currentTime;
      };

      this.getDuration = function()
      {
        var duration = 0;
        if (this.currentIMAAd)
        {
          duration = this.currentIMAAd.getDuration();
        }
        return duration;
      };

      this.adVideoFocused = function()
      {
        //Required for plugin
      };

      /**
       * Callback for Ad Manager Controller EVENTS.REPLAY_REQUESTED.  Resets the IMA SDK to be able to
       * request ads again and then requests the ads if it's AdRules.
       * @private
       * @method GoogleIMA#_onReplayRequested.
       */
      var _onReplayRequested = privateMember(function()
      {
        if (!_IMAAdsLoader)
        {
          //The Ads Loader might have been destroyed if we had timed out.
          IMA_SDK_tryCreateAdsLoader();
        }
        this.isReplay = true;
        _resetAdsState();
        _resetPlayheadTracker();
        this.contentEnded = false;
        this.adRulesLoadError = false;
        //In the case of ad rules, non of the ads are in the timeline
        //and we won't call initialPlayRequested again. So we manually call
        //to load the ads again. We don't care about preloading at this point.
        if (_usingAdRules)
        {
          _trySetupAdsRequest();
        }
      });

      /**
       * Resets the IMA SDK to allow for requesting more ads.
       * @private
       * @method GoogleIMA#_resetAdsState
       */
      var _resetAdsState = privateMember(function()
      {
        _tryUndoSetupForAdRules();

        //If you want to use the same ad tag twice you have to destroy the admanager and call
        //adsLoader.contentComplete. (This also helps with non-adrules ads)  This resets the
        //internal state in the IMA SDK. You call contentComplete after destroying the adManager
        //so you don't accidently play postrolls.
        //Link to documentation: https://developers.google.com/interactive-media-ads/docs/sdks/android/faq
        _IMA_SDK_destroyAdsManager();
        if (_IMAAdsLoader)
        {
          _IMAAdsLoader.contentComplete();
        }
        this.currentIMAAd = null;
        this.currentNonLinearIMAAd = null;

        this.adsRequested = false;
      });

      /**
       * Callback for Ad Manager Controller EVENTS.INITIAL_PLAY_REQUESTED.  Sets up IMA SDK so it can display ads and
       * trys to request ads if preloading Ad Rules is not enabled.
       * @private
       * @method GoogleIMA#_onInitialPlayRequested
       */
      var _onInitialPlayRequested = privateMember(function()
      {
        OO.log("_onInitialPlayRequested");
        //double check that IMA SDK loaded.
        if(!_IMAAdDisplayContainer)
        {
          _onImaAdError();
          _amc.unregisterAdManager(this.name);
          _throwError("onInitialPlayRequested called but _IMAAdDisplayContainer not created yet.");
        }

        this.initialPlayRequested = true;
        this.isReplay = false;
        _IMAAdDisplayContainer.initialize();
        _IMA_SDK_tryInitAdsManager();

        //if we aren't preloading the ads, then it's safe to make the ad request now.
        //so we don't mess up analytics and request ads that may not be shown.
        if (!this.preloadAdRulesAds)
        {
          this.canSetupAdsRequest = true;
          _trySetupAdsRequest();
        }
      });

      /**
       * Tries to initialize the AdsManager variable, from the IMA SDK, that is received from an ad request.
       * @private
       * @method GoogleIMA#_IMA_SDK_tryInitAdsManager
       */
      var _IMA_SDK_tryInitAdsManager = privateMember(function()
      {
        //block this code from running till we want to play the video
        //if you run it before then ima will take over and immediately try to play
        //ads (if there is a preroll)
        if (_IMAAdsManager && this.initialPlayRequested && !_IMAAdsManagerInitialized && _uiContainer)
        {
          try
          {
            //notify placeholder end if we do not have a preroll to start main content
            if(_usingAdRules &&
              !this.hasPreroll &&
              this.currentAMCAdPod &&
              this.currentAMCAdPod.adType == _amc.ADTYPE.UNKNOWN_AD_REQUEST)
            {
                _endCurrentAd(true);
            }
            _IMAAdsManager.init(_uiContainer.clientWidth, _uiContainer.clientHeight, google.ima.ViewMode.NORMAL);
            // PBW-6610
            // Traditionally we have relied on the LOADED ad event before calling adsManager.start.
            // This may have worked accidentally.
            // IMA Guides and the video suite inspector both call adsManager.start immediately after
            // adsManager.init
            // Furthermore, some VPAID ads do not fire LOADED event until adsManager.start is called
            _IMAAdsManager.start();
            _IMAAdsManagerInitialized = true;
            OO.log("tryInitadsManager successful: adsManager started")
          }
          catch (adError)
          {
            _onImaAdError(adError);
          }
        }
      });

      /**
       * Callback for Ad Manager Controller EVENTS.CONTENT_COMPLETED.  Marks the main content as having completed and
       * notifies the IMA SDK, so it can play postrolls if neccessary.
       * @private
       * @method GoogleIMA#_onContentCompleted
       */
      var _onContentCompleted = privateMember(function()
      {
        if (this.contentEnded == false)
        {
          this.contentEnded = true;
          if (_IMAAdsLoader)
          {
            _IMAAdsLoader.contentComplete();
          }
        }
      });

      /**
       * Callback for Ad Manager Controller EVENTS.PLAYHEAD_TIME_CHANGED.  Updates the IMA SDK with current playhead time.
       * @private
       * @method GoogleIMA#_onPlayheadTimeChanged
       * @param playhead current playhead time
       * @param duration - duration of the movie.
       */
      var _onPlayheadTimeChanged = privateMember(function(event, playheadTime, duration)
      {
        if (!_playheadTracker)
        {
          _resetPlayheadTracker();
        }

        //in case the amc gives us playhead updates while IMA is playing an ad (AdRules case)
        //then we don't want to update the playhead that IMA reads from to avoid triggering
        //more ads while playing the current one.
        if(!_linearAdIsPlaying)
        {
          _playheadTracker.currentTime = playheadTime;
          _playheadTracker.duration = duration;
        }
      });

      /**
       * Callback for Ad Manager Controller. Handles going into and out of fullscreen mode.
       * @public
       * @method GoogleIMA#onFullScreenChanged
       * @param {boolean} shouldEnterFullscreen True if going into fullscreen
       */
      var _onFullscreenChanged = privateMember(function(event, shouldEnterFullscreen)
      {
        this.isFullscreen = shouldEnterFullscreen;
        _onSizeChanged();
      });

      /**
       * Callback for size change notifications.
       * @private
       * @method GoogleIMA#_onSizeChanged
       */
      var _onSizeChanged = privateMember(function()
      {
        _updateIMASize();
      });

      /**
       * Update the IMA SDK to inform it the size of the video container has changed.
       * @private
       * @method GoogleIMA#_updateIMASize
       */
      var _updateIMASize = privateMember(function()
      {
        if (_IMAAdsManager && _uiContainer)
        {
          var viewMode = this.isFullscreen ? google.ima.ViewMode.FULLSCREEN : google.ima.ViewMode.NORMAL;
          var width = _uiContainer.clientWidth;
          var height = _uiContainer.clientHeight;
          //For nonlinear overlays, we want to provide the size that we sent to the AMC in playAd.
          //We do this because the player skin plugins div (_uiContainer) may not have been redrawn yet
          if (this.currentAMCAdPod && this.currentNonLinearIMAAd)
          {
            if (this.currentAMCAdPod.width)
            {
              width = this.currentAMCAdPod.width;
              if (this.currentAMCAdPod.paddingWidth)
              {
                width += this.currentAMCAdPod.paddingWidth;
              }
            }

            if (this.currentAMCAdPod.height)
            {
              height = this.currentAMCAdPod.height;
              if (this.currentAMCAdPod.paddingHeight)
              {
                height += this.currentAMCAdPod.paddingHeight;
              }
            }
          }
          _IMAAdsManager.resize(width, height, viewMode);
        }
      });

      /**
       * Resets _playheadTracker's current time to 0. If _playheadTracker doesn't
       * exist, it creates it.
       * @private
       * @method GoogleIMA#_resetPlayheadTracker
       */
      var _resetPlayheadTracker = privateMember(function()
      {
        if (!_playheadTracker)
        {
          _playheadTracker = {duration: 0, currentTime: 0};
        }
        else
        {
          _playheadTracker.currentTime = 0;
        }
      });

      /**
       * Tries to request an ad, if all requirements are met.  You cannot request
       * an ad again without first calling _resetAdsState().
       * @private
       * @method GoogleIMA#_trySetupAdsRequest
       */
      var _trySetupAdsRequest = privateMember(function()
      {
        //need metadata, ima sdk, and ui to be registered before we can request an ad
        if ( this.adsRequested         ||
            !this.canSetupAdsRequest   ||
            !this.adTagUrl             ||
            !this.uiRegistered         ||
            !_amc.currentEmbedCode     ||
            !_IMAAdsLoader             ||
            !_checkRequestAdsOnReplay())
        {
          return;
        }

        //at this point we are guaranteed that metadata has been received and the sdk is loaded.
        //so now we can set whether to disable flash ads or not.
        if (google && google.ima && google.ima.settings)
        {
          google.ima.settings.setDisableFlashAds(this.disableFlashAds);
        }

        var adsRequest = new google.ima.AdsRequest();
        if (this.additionalAdTagParameters)
        {
          var connector = this.adTagUrl.indexOf("?") > 0 ? "&" : "?";

          // Generate an array of key/value pairings, for faster string concat
          var paramArray = [];
          var param = null;
          for (param in this.additionalAdTagParameters)
          {
            paramArray.push(param + "=" + this.additionalAdTagParameters[param]);
          }
          this.adTagUrl += connector + paramArray.join("&");
        }
        adsRequest.adTagUrl = OO.getNormalizedTagUrl(this.adTagUrl, _amc.currentEmbedCode);
        // Specify the linear and nonlinear slot sizes. This helps the SDK to
        // select the correct creative if multiple are returned.
        var w = _amc.ui.width;
        var h = _amc.ui.height;
        adsRequest.linearAdSlotWidth = w;
        adsRequest.linearAdSlotHeight = h;

        adsRequest.nonLinearAdSlotWidth = w;
        adsRequest.nonLinearAdSlotHeight = h;

        _resetAdsState();
        _trySetupForAdRules();
        _IMAAdsLoader.requestAds(adsRequest);

        if (this.runningUnitTests && this.maxAdsRequestTimeout === 0)
        {
          _adsRequestTimeout();
        }
        else
        {
          this.adsRequestTimeoutRef = _.delay(_adsRequestTimeout, this.maxAdsRequestTimeout);
        }

        OO.log("adsRequestTimeout: " + this.maxAdsRequestTimeout);
        this.adsRequested = true;
      });


      /**
       * Return true if you can ad request depending on if it's a replay or not.
       * If it's not a replay then it will return true. If it is, then it depends
       * on the player setup.
       * @private
       * @method GoogleIMA#_checkRequestAdsOnReplay
       */
      var _checkRequestAdsOnReplay = privateMember(function()
      {
        if (!this.isReplay)
        {
          return true;
        }

        return this.requestAdsOnReplay;
      });

      /**
       * Callback after IMA SDK is successfully loaded. Tries to setup ad request and container for ads.
       * @private
       * @method GoogleIMA#_onSdkLoaded
       * @param success - whether SDK loaded successfully.
       */
      var _onSdkLoaded = privateMember(function(success)
      {
        _adModuleJsReady = success;
        OO.log("onSdkLoaded!");
        // [PBK-639] Corner case where Google's SDK 200s but isn't properly
        // loaded. Better safe than sorry..
        if (!success || !_isGoogleSDKValid())
        {
          _onImaAdError();
          _amc.unregisterAdManager(this.name);
          return;
        }

        //These are required by Google for tracking purposes.
        google.ima.settings.setPlayerVersion(PLUGIN_VERSION);
        google.ima.settings.setPlayerType(PLAYER_TYPE);
        google.ima.settings.setLocale(OO.getLocale());
        if (this.useInsecureVpaidMode)
        {
          google.ima.settings.setVpaidMode(google.ima.ImaSdkSettings.VpaidMode.INSECURE);
        }
        else
        {
          google.ima.settings.setVpaidMode(google.ima.ImaSdkSettings.VpaidMode.ENABLED);
        }

        _IMA_SDK_tryInitAdContainer();
        _trySetupAdsRequest();
      });

      /**
       * Tries to initialize the IMA SDK AdContainer.  This is where the ads will be located.
       * @private
       * @method GoogleIMA#_IMA_SDK_tryInitAdContainer
       */
      var _IMA_SDK_tryInitAdContainer = privateMember(function()
      {
        if (_adModuleJsReady && this.uiRegistered)
        {
          if (!_isGoogleSDKValid())
          {
             _throwError("IMA SDK loaded but does not contain valid data");
          }

          if (_IMAAdDisplayContainer) {
            _IMAAdDisplayContainer.destroy();
          }

          //Prefer to use player skin plugins element to allow for click throughs. Use plugins element if not available
          _uiContainer = _amc.ui.playerSkinPluginsElement ? _amc.ui.playerSkinPluginsElement[0] : _amc.ui.pluginsElement[0];
          //iphone performance is terrible if we don't use the custom playback (i.e. filling in the second param for adDisplayContainer)
          //also doesn't not seem to work nicely with podded ads if you don't use it.

          //for IMA, we always want to use the plugins element to house the IMA UI. This allows it to behave
          //properly with the Alice skin.
          _IMAAdDisplayContainer = new google.ima.AdDisplayContainer(_uiContainer,
                                                                     this.sharedVideoElement);

          IMA_SDK_tryCreateAdsLoader();

          _trySetAdManagerToReady();
        }
      });

      /**
       * Tries to create an IMA SDK AdsLoader.  The AdsLoader notifies this ad manager when ad requests are completed.
       * @private
       * @method GoogleIMA#IMA_SDK_tryCreateAdsLoader
       */
      var IMA_SDK_tryCreateAdsLoader = privateMember(function()
      {
        if (_IMAAdDisplayContainer)
        {
          var adsManagerEvents = google.ima.AdsManagerLoadedEvent.Type;
          var adErrorEvent = google.ima.AdErrorEvent.Type;
          _IMA_SDK_destroyAdsLoader();
          _IMAAdsLoader = new google.ima.AdsLoader(_IMAAdDisplayContainer);
          // This will enable notifications whenever ad rules or VMAP ads are scheduled
          // for playback, it has no effect on regular ads
          _IMAAdsLoader.getSettings().setAutoPlayAdBreaks(false);
          _IMAAdsLoader.addEventListener(adsManagerEvents.ADS_MANAGER_LOADED, _onAdRequestSuccess, false);
          _IMAAdsLoader.addEventListener(adErrorEvent.AD_ERROR, _onImaAdError, false);
        }
      });

      /**
       * Clean up function for IMA SDK AdDisplayContainer.
       * @private
       * @method GoogleIMA#_IMA_SDK_destroyAdDisplayContainer
       */
      var _IMA_SDK_destroyAdDisplayContainer = privateMember(function()
      {
        if (_IMAAdDisplayContainer)
        {
          _IMAAdDisplayContainer.destroy();
          _IMAAdDisplayContainer = null;
        }
      });

      /**
       * Clean up function for IMA SDK AdsLoader.
       * @private
       * @method GoogleIMA#_IMA_SDK_destroyAdsLoader
       */
      var _IMA_SDK_destroyAdsLoader = privateMember(function()
      {
        if (_IMAAdsLoader)
        {
          _IMAAdsLoader.destroy();
          _IMAAdsLoader = null;
        }
      });

      /**
       * Clean up function for IMA SDK AdsManager.
       * @private
       * @method GoogleIMA#_IMA_SDK_destroyAdsManager
       */
      var _IMA_SDK_destroyAdsManager = privateMember(function()
      {
        if (_IMAAdsManager)
        {
          _IMAAdsManager.stop();
          _IMAAdsManager.destroy();
          _IMAAdsManager = null;
          _IMAAdsManagerInitialized = false;
        }
      });

      /**
       * Cancel the current ad, and destroy/reset all the GoogleIMA SDK variables.
       * @public
       * @method GoogleIMA#destroy
       */
      this.destroy = function()
      {
        _uiContainer = null;
        _tryUndoSetupForAdRules();
        _IMA_SDK_destroyAdsManager();
        _IMA_SDK_destroyAdsLoader();
        _IMA_SDK_destroyAdDisplayContainer();
        _resetVars();
        _removeAMCListeners();
      };

      /**
       * Sets this ad manager to ready and notifies the Ad Manager Controller that it's ready if
       * the ad display container has been created and the metadata has been received.
       * @private
       * @method GoogleIMA#_trySetAdManagerToReady
       */
      var _trySetAdManagerToReady = privateMember(function()
      {
        if (_IMAAdDisplayContainer && this.metadataReady)
        {
          this.ready = true;
          _amc.onAdManagerReady();
        }
      });

      /**
       * Callback in case of timeout during ad request.
       * @private
       * @method GoogleIMA#_adsRequestTimeout
       */
      var _adsRequestTimeout = privateMember(function()
      {
        OO.log("IMA Ad request timed out");
        if (!this.adsReady)
        {
          _onImaAdError(OOYALA_IMA_PLUGIN_TIMEOUT);
        }
      });

      /**
       * If an error occurs cause ad manager to fail gracefully.  If it's ad rules, no more ads will play.  Non ad rules
       * just not play the one ad.
       * @private
       * @method GoogleIMA#_onImaAdError
       * @param {object} adErrorEvent - IMA SDK error data
       */
      var _onImaAdError = privateMember(function(adError)
      {
        if(_usingAdRules)
        {
          //if ads are not ready yet, ima failed to load
          if(!this.adsReady)
          {
            this.adRulesLoadError = true;
          }
          //give control back to AMC
          _tryUndoSetupForAdRules();
        }

        _IMA_SDK_destroyAdsManager();

        if (adError === OOYALA_IMA_PLUGIN_TIMEOUT) {
          _IMA_SDK_destroyAdsLoader();
        }

        _endCurrentAd(true);

        //make sure we are showing the video in case it was hidden for whatever reason.
        if (adError)
        {
          var errorString = "ERROR Google IMA";

          if(adError.getError)
          {
            errorString = "ERROR Google SDK: " + adError.getError();
          }
          else
          {
            errorString = "ERROR Google IMA plugin: " + adError;
          }

          if (_amc)
          {
            _amc.raiseAdError(errorString);
          }
          else
          {
            OO.log(errorString);
          }
        }
      });

      /**
       * Callback when ad request is completed. Sets up ad manager to listen to IMA SDK events.
       * @private
       * @method GoogleIMA#_onAdRequestSuccess
       * @param {object} adsManagerLoadedEvent - from the IMA SDK contains the IMA AdManager instance.
       */
      var _onAdRequestSuccess = privateMember(function(adsManagerLoadedEvent)
      {
        if (!_usingAdRules && _IMAAdsManager)
        {
          //destroy the current ad manager is there is one
          _IMA_SDK_destroyAdsManager();
          this.currentIMAAd = null;
          this.currentNonLinearIMAAd = null;
        }
        // https://developers.google.com/interactive-media-ads/docs/sdks/googlehtml5_apis_v3#ima.AdsRenderingSettings
        var adsSettings = new google.ima.AdsRenderingSettings();
        adsSettings.restoreCustomPlaybackStateOnAdBreakComplete = false;
        adsSettings.useStyledNonLinearAds = true;
        if (this.useGoogleCountdown)
        {
          //both COUNTDOWN and AD_ATTRIBUTION are required as per
          //https://developers.google.com/interactive-media-ads/docs/sdks/html5/v3/apis#ima.UiElements
          adsSettings.uiElements = [google.ima.UiElements.COUNTDOWN, google.ima.UiElements.AD_ATTRIBUTION];
        }
        adsSettings.useStyledLinearAds = this.useGoogleAdUI;
        _IMAAdsManager = adsManagerLoadedEvent.getAdsManager(_playheadTracker, adsSettings);

        // When the ads manager is ready, we are ready to apply css changes to the video element
        // If the sharedVideoElement is not used, mark it as null before applying css
        if (this.videoControllerWrapper)
        {
          this.videoControllerWrapper.readyForCss = true;
        }
        if (!_IMAAdsManager.isCustomPlaybackUsed()) {
          this.setupSharedVideoElement(null);
        }
        if (this.videoControllerWrapper)
        {
          this.videoControllerWrapper.applyStoredCss();
        }

        //a cue point index of 0 references a preroll, so we know we have a preroll if we find it in cuePoints
        var cuePoints = _IMAAdsManager.getCuePoints();
        this.hasPreroll = cuePoints.indexOf(0) >= 0;

        var eventType = google.ima.AdEvent.Type;
        // Add listeners to the required events.
        _IMAAdsManager.addEventListener(eventType.CLICK, _IMA_SDK_onAdClicked, false, this);
        _IMAAdsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, _onImaAdError, false, this);
        _IMAAdsManager.addEventListener(google.ima.AdEvent.Type.AD_BREAK_READY, _IMA_SDK_onAdBreakReady);
        _IMAAdsManager.addEventListener(eventType.CONTENT_PAUSE_REQUESTED, _IMA_SDK_pauseMainContent, false, this);
        _IMAAdsManager.addEventListener(eventType.CONTENT_RESUME_REQUESTED, _IMA_SDK_resumeMainContent, false, this);

        // Listen to any additional events, if necessary.
        var imaAdEvents = [
          eventType.ALL_ADS_COMPLETED,
          eventType.COMPLETE,
          eventType.SKIPPED,
          eventType.FIRST_QUARTILE,
          eventType.LOADED,
          eventType.MIDPOINT,
          eventType.PAUSED,
          eventType.RESUMED,
          eventType.STARTED,
          eventType.THIRD_QUARTILE,
          eventType.VOLUME_CHANGED,
          eventType.VOLUME_MUTED,
          eventType.USER_CLOSE,
          eventType.DURATION_CHANGE];

        var addIMAEventListener =
          function(e)
          {
            _IMAAdsManager.addEventListener(e, _IMA_SDK_onAdEvent, false, this);
          };

        OO._.each(imaAdEvents, addIMAEventListener, this);
        _trySetAdManagerToReady();
        this.adsReady = true;
        clearTimeout(this.adsRequestTimeoutRef);
        _IMA_SDK_tryInitAdsManager();
      });

      /**
       * Fired when IMA SDK has a VMAP or Ad Rules ad that is ready for playback.
       * @private
       * @method GoogleIMA#_IMA_SDK_onAdBreakReady
       * @param adEvent - Event data from IMA SDK.
       */
      var _IMA_SDK_onAdBreakReady = privateMember(function(adEvent)
      {
        OO.log("GOOGLE_IMA:: Ad Rules ad break ready!", adEvent);
        // Proceed as usual if we're not using ad rules
        if (!_usingAdRules)
        {
          _IMAAdsManager.start();
          return;
        }
        // Mimic AMC behavior and cancel any existing non-linear ads before playing the next ad.
        // Note that there is a known issue in the IMA SDK that prevents the COMPLETE
        // event from being fired when a non-linear ad is removed. This is also a workaround
        // for that issue.
        if (this.currentAMCAdPod && this.currentNonLinearIMAAd)
        {
          this.cancelAd(this.currentAMCAdPod);
        }
        // [PLAYER-319]
        // IMA will not initialize ad rules overlays unless the ad container is already rendered and
        // has enough room for the overlay by the time the ad is ready to play. As a workaround, we expand
        // the ad container and make sure it's rendered, while at the same time hiding it visually.
        // We store the element's current style in order to restore it afterwards.
        _uiContainerPrevStyle = _uiContainer.getAttribute("style") || "";
        _uiContainer.setAttribute("style", "display: block; width: 100%; height: 100%; visibility: hidden; pointer-events: none;");
        _onSizeChanged();
        // Resume ads manager operation
        _IMAAdsManager.start();
      });

      /**
       * Callback when IMA SDK detect an ad click. This relays it to the Ad Manager Controller.
       * @private
       * @method GoogleIMA#_IMA_SDK_onAdClicked
       * @param adEvent - Event data from IMA SDK.
       */
      var _IMA_SDK_onAdClicked = privateMember(function(adEvent)
      {
        _amc.adsClicked();
        _amc.adsClickthroughOpened();
      });

      /**
       * Callback from IMA SDK to tell this ad manager to pause the main content video. If ad is an Ad Rules ad, the Ad
       * Manager Controller is forced to play an ad.
       * @private
       * @method GoogleIMA#_IMA_SDK_pauseMainContent
       */
      var _IMA_SDK_pauseMainContent = privateMember(function()
      {
        OO.log("GOOGLE_IMA:: Content Pause Requested by Google IMA!");
        _linearAdIsPlaying = true;
        if (_usingAdRules)
        {
          var adData =
          {
            position_type: AD_RULES_POSITION_TYPE,
            forced_ad_type: _amc.ADTYPE.LINEAR_VIDEO
          };
          //we do not want to force an ad play with preroll ads
          if(_playheadTracker.currentTime > 0)
          {
            var streams = {};
            streams[OO.VIDEO.ENCODING.IMA] = "";
            _amc.forceAdToPlay(this.name, adData, _amc.ADTYPE.LINEAR_VIDEO, streams);
          }
        }
      });

      /**
       * Callback from IMA SDK to tell this ad manager to resume the main content video.
       * @private
       * @method GoogleIMA#_IMA_SDK_resumeMainContent
       */
      var _IMA_SDK_resumeMainContent = privateMember(function()
      {
        //make sure when we resume, that we have ended the ad pod and told
        //the AMC that we have done so.
        _endCurrentAd(true);

        OO.log("GOOGLE_IMA:: Content Resume Requested by Google IMA!");
      });

      /**
       * Notifies the video controller wrapper of the pause event.
       * @private
       * @method GoogleIMA#_raisePauseEvent
       */
      var _raisePauseEvent = privateMember(function()
      {
        if (this.videoControllerWrapper)
        {
          this.videoControllerWrapper.raisePauseEvent();
        }
      });

      /**
       * Checks if there is any companion ads associated with the ad and if one is found, it will call the Ad Manager
       * Controller to show it.
       * @public
       * @method GoogleIMA#checkCompanionAds
       * @param {object} ad The Ad metadata
       */
      var _checkCompanionAds = privateMember(function(ad) {
        // companionAd slots are required
        if (!ad || !_amc.pageSettings.companionAd || !_amc.pageSettings.companionAd.slots) {
          return;
        }
        // Page level setting with format:
        // companionAd: {
        //  slots: [{width: 300, height: 250}, ..]
        // }
        var slots = _amc.pageSettings.companionAd.slots;
        var companionAds = [],
            companionAd = null;

        _.each(slots, function(slot) {
          if (slot.width && slot.height) {
            companionAd = ad.getCompanionAds(slot.width, slot.height);
            if (companionAd.length) {
              _.each(companionAd, function(ad) {
                companionAds.push({slotSize: slot.width + "x" + slot.height, ad: ad.getContent()});
              });
            }
          }
        });

        if (!companionAds.length) {
          return;
        }
        //companionAds = [{slotSize: "300x250", ad: <Companion Ad as HTML>}, ..]
        _amc.showCompanion(companionAds);
       });

      /**
       * Callback from IMA SDK for ad tracking events.
       * @private
       * @method GoogleIMA#_IMA_SDK_onAdEvent
       */
      var _IMA_SDK_onAdEvent = privateMember(function(adEvent)
      {
        // Retrieve the ad from the event. Some events (e.g. ALL_ADS_COMPLETED)
        // don't have ad object associated.
        var eventType = google.ima.AdEvent.Type;
        var ad = adEvent.getAd();
        OO.log("IMA EVENT: ", adEvent.type, adEvent);
        switch (adEvent.type)
        {
          case eventType.LOADED:
            _resetUIContainerStyle();

            if (ad.isLinear())
            {
              _amc.focusAdVideo();
            }
            break;
          case eventType.STARTED:
            this.adPlaybackStarted = true;
            if(ad.isLinear())
            {
              _linearAdIsPlaying = true;
              if (this.savedVolume >= 0)
              {
                this.setVolume(this.savedVolume);
                this.savedVolume = -1;
              }
              //Since IMA handles its own UI, we want the video player to hide its UI elements
              _amc.hidePlayerUi(this.showAdControls, false);
            }
            else
            {
              this.currentNonLinearIMAAd = ad;
            }
            this.currentIMAAd = ad;
            _onSizeChanged();
            _tryStartAd();
            if (this.videoControllerWrapper)
            {
              if (ad.isLinear())
              {
                this.videoControllerWrapper.raisePlayEvent();
              }
              this.videoControllerWrapper.raiseTimeUpdate(this.getCurrentTime(), this.getDuration());
              _startTimeUpdater();
            }
            // Non-linear ad rules or VMAP ads will not be started by _tryStartAd()
            // because there'll be no AMC ad pod. We start them here after the time update event
            // in order to prevent the progress bar from flashing
            if (_usingAdRules && !ad.isLinear())
            {
              _startNonLinearAdRulesOverlay();
            }
            break;
          case eventType.RESUMED:
            if (this.videoControllerWrapper)
            {
              if (ad.isLinear())
              {
                this.videoControllerWrapper.raisePlayEvent();
              }
            }
            break;
          case eventType.USER_CLOSE:
          case eventType.SKIPPED:
          case eventType.COMPLETE:
            this.adPlaybackStarted = false;
            if (this.videoControllerWrapper && (ad && ad.isLinear()))
            {
              _stopTimeUpdater();
              //IMA provides values which can result in negative current times or current times which are greater than duration.
              //For good user experience, we will provide the duration as the current time here if the event type is COMPLETE
              var currentTime = adEvent.type === eventType.COMPLETE ? this.getDuration() : this.getCurrentTime();
              this.videoControllerWrapper.raiseTimeUpdate(currentTime, this.getDuration());
              this.videoControllerWrapper.raiseEndedEvent();
            }
            //Save the volume so the volume can persist on future ad playbacks if we don't receive another volume update from VTC
            this.savedVolume = this.getVolume();

            if (!ad || !ad.isLinear())
            {
              this.currentNonLinearIMAAd = null;
            }

            _endCurrentAd(false);
            _linearAdIsPlaying = false;
            _onAdMetrics(adEvent);

            // (agunawan): Google SDK is not publishing CONTENT_RESUME with livestream!!! !@#!@#!@#@!#@
            if (_amc.isLiveStream)
            {
              // iOS8 fix
              _.delay(_.bind(function()
              {
                _IMA_SDK_resumeMainContent();
              }, this), 100);
            }
            break;
          case eventType.PAUSED:
            _raisePauseEvent();
            break;
          case eventType.ALL_ADS_COMPLETED:
            _linearAdIsPlaying = false;
            OO.log("all google ima ads completed!");
            _tryUndoSetupForAdRules();

            /*
            On iPhone, _IMA_SDK_resumeMainContent() is not being triggered after the last postroll, for
            both adrules and non-adrules. For non-adrules, this event is triggered after every ad,
            so we must check that it is the last postroll before calling _IMA_SDK_resumeMainContent().
            */
            if (OO.isIos && this.contentEnded && _amc.isLastAdPlayed())
            {
              _IMA_SDK_resumeMainContent();
            }

            break;
          case eventType.FIRST_QUARTILE:
          case eventType.MIDPOINT:
          case eventType.THIRD_QUARTILE:
            _onAdMetrics(adEvent);
            break;
          case eventType.VOLUME_CHANGED:
          case eventType.VOLUME_MUTED:
            if (this.videoControllerWrapper)
            {
              this.videoControllerWrapper.raiseVolumeEvent();
            }
            break;
          case eventType.DURATION_CHANGE:
            if (this.videoControllerWrapper)
            {
              this.videoControllerWrapper.raiseDurationChange(this.getCurrentTime(), this.getDuration());
            }
            break;
          default:
            break;
        }
      });

      /**
       * Will restore the original style of the UI container if one exists.
       * This is used in a workaround for PLAYER-319.
       * @private
       * @method GoogleIMA#_resetUIContainerStyle
       */
      var _resetUIContainerStyle = privateMember(function()
      {
        if (_uiContainer && typeof _uiContainerPrevStyle !== 'undefined' && _uiContainerPrevStyle !== null)
        {
          _uiContainer.setAttribute("style", _uiContainerPrevStyle);
        }
        _uiContainerPrevStyle = null;
      });

      /**
       * Starts a timer that will provide an update to the video controller wrapper of the ad's current time.
       * We use a timer because IMA does not provide us with a time update event.
       * @private
       * @method GoogleIMA#_startTimeUpdater
       */
      var _startTimeUpdater = privateMember(function()
      {
        _stopTimeUpdater();
        //starting an interval causes unit tests to throw a max call stack exceeded error
        if (!this.runningUnitTests)
        {
          _timeUpdater = setInterval(_.bind(function()
          {
            if(_linearAdIsPlaying)
            {
              this.videoControllerWrapper.raiseTimeUpdate(this.getCurrentTime(), this.getDuration());
            }
            else
            {
              _stopTimeUpdater();
            }
          }, this), TIME_UPDATER_INTERVAL);
        }
      });

      /**
       * Stops the timer that was started via _startTimeUpdater.
       * @private
       * @method GoogleIMA#_stopTimeUpdater
       */
      var _stopTimeUpdater = privateMember(function()
      {
        clearInterval(_timeUpdater);
        _timeUpdater = null;
      });

      /**
       * Tries to tell the Ad Manager Controller that this ad manager will determine when the video and ads end.
       * @private
       * @method GoogleIMA#_trySetupForAdRules
       */
      var _trySetupForAdRules = privateMember(function()
      {
        if (_usingAdRules)
        {
          _amc.adManagerWillControlAds(this.name);
        }
      });

      /**
       * Give control back to Ad Manager Controller for determining when all ads and video have played.
       * @private
       * @method GoogleIMA#_tryUndoSetupForAdRules
       */
      var _tryUndoSetupForAdRules = privateMember(function()
      {
        if (_usingAdRules && _amc)
        {
          _amc.adManagerDoneControllingAds(this.name);
        }
      });

      /**
       * Logs ad metric events.
       * @private
       * @method GoogleIMA#_onAdMetrics
       * @param {object} adEvent
       */
      var _onAdMetrics = privateMember(function(adEvent)
      {
        OO.log("Google IMA Ad playthrough", adEvent.type);
      });

      /**
       * Callback for EVENTS.CONTENT_CHANGED. Means new video is playing, so all ad data needs to be reset.
       * @private
       * @method GoogleIMA#_onContentChanged
       */
      var _onContentChanged = privateMember(function()
      {
        this.contentEnded = false;
        _tryUndoSetupForAdRules();
        _resetAdsState();
        _resetPlayheadTracker();
      });

      /**
       * Try to notify the AMC that an ad started to play.  Will fail if either the AMC
       * isn't in ad mode or if IMA hasn't started playing the ad.
       * @private
       * @method GoogleIMA#_tryStartAd
       */
      var _tryStartAd = privateMember(function()
      {
        var adTypeStarted = null;
        if (this.currentIMAAd && this.currentAMCAdPod)
        {
          if (this.currentIMAAd.isLinear())
          {
            adTypeStarted = _amc.ADTYPE.LINEAR_VIDEO;
            _startLinearAd();
          }
          else
          {
            adTypeStarted = _amc.ADTYPE.NONLINEAR_OVERLAY;
            _startNonLinearOverlay();
          }
        }
        return adTypeStarted;
      });

      /**
       * Notify the AMC that a linear ad has started to play.
       * @private
       * @method GoogleIMA#_startLinearAd
       */
      var _startLinearAd = privateMember(function()
      {
        if (!this.currentIMAAd)
        {
          _throwError("Trying to start linear ad and this.currentIMAAd is falsy");
        }

        if (!this.currentAMCAdPod)
        {
          _throwError("Trying to start linear ad and this.currentAMCAdPod is falsy");
        }

        var adId = this.currentAMCAdPod.id;

        var adProperties = {};

        //ad properties - actual values to be provided by IMA APIs, default values are set here
        var totalAdsInPod = 1;
        adProperties.indexInPod = 1;
        adProperties.name = null;
        adProperties.duration = 0;
        adProperties.hasClickUrl = false; //default to false because IMA does not provide any clickthrough APIs to us
        adProperties.skippable = false;

        try
        {
          var adPodInfo = this.currentIMAAd.getAdPodInfo();
          totalAdsInPod = adPodInfo.getTotalAds();
          adProperties.indexInPod = adPodInfo.getAdPosition();
        }
        catch(e)
        {
          _throwError("IMA ad returning bad value for this.currentIMAAd.getAdPodInfo().");
        }

        //Google may remove any of these APIs at a future point.
        //Note: getClickThroughUrl has been removed by Google
        if (typeof this.currentIMAAd.getTitle == "function")
        {
          adProperties.name = this.currentIMAAd.getTitle();
        }

        if (typeof this.currentIMAAd.getDuration == "function")
        {
          adProperties.duration = this.currentIMAAd.getDuration();
        }

        if (typeof this.currentIMAAd.isSkippable == "function")
        {
          adProperties.skippable = this.currentIMAAd.isSkippable();
        }

        if (adProperties.indexInPod == 1)
        {
          _amc.notifyPodStarted(adId, totalAdsInPod);
        }

        _checkCompanionAds(this.currentIMAAd);
        _amc.notifyLinearAdStarted(adId, adProperties);
      });

      /**
       * Switches from playing a linear ad to non-linear overlay (Because we don't
       * know what type of ad it is until it plays).
       * @private
       * @method GoogleIMA#_startNonLinearOverlay
       */
      var _startNonLinearOverlay = privateMember(function()
      {
        if (!this.currentAMCAdPod)
        {
          _throwError("Trying to start non linear overlay and this.currentAMCAdPod is falsy");
        }

        //notify that the fake ad has started
        _amc.notifyPodStarted(this.currentAMCAdPod.id);
        //we don't know the type of ad until it starts playing, we assume it's linear
        //but if it isn't then we need to tell the ad manager otherwise and resume playing
        var adData = {
          position_type: NON_AD_RULES_POSITION_TYPE,
          forced_ad_type: _amc.ADTYPE.NONLINEAR_OVERLAY
        };
        _checkCompanionAds(this.currentIMAAd);
        //end the request ad
        _endCurrentAd(true);
        _amc.forceAdToPlay(this.name, adData, _amc.ADTYPE.NONLINEAR_OVERLAY);
      });

      /**
       * Should be called when IMA has shown a non-linear ad rules ad.
       * Forcing this dummy ad through the AMC queue will raise the necessary
       * events for Ad Impression and it will also let the skin know that it
       * needs to show the ads container.
       * @private
       * @method GoogleIMA#_startNonLinearAdRulesOverlay
       */
      var _startNonLinearAdRulesOverlay = privateMember(function()
      {
        var adData = {
          position_type: AD_RULES_POSITION_TYPE,
          forced_ad_type: _amc.ADTYPE.NONLINEAR_OVERLAY
        };
        _checkCompanionAds(this.currentIMAAd);
        _amc.forceAdToPlay(this.name, adData, _amc.ADTYPE.NONLINEAR_OVERLAY);
      });

      /**
       * Stop overlay and prepare the ad manager to be able to request another ad.
       * @private
       * @method GoogleIMA#_stopNonLinearOverlay
       * @param adId the id of the overlay we are stopping
       */
      var _stopNonLinearOverlay = privateMember(function(adId)
      {
        _amc.notifyNonlinearAdEnded(adId);

        if (!_usingAdRules)
        {
          _resetAdsState();
        }
      });

      /**
       * Ends the current ad pod (linear or non linear) and notifies the Ad Manager
       * Controller that the whole ad pod has ended.
       * @private
       * @method GoogleIMA#_endCurrentAdPod
       * @param linear whether or not the ad pod was linear or overlay
       */
      var _endCurrentAdPod = privateMember(function(linear)
      {
        if (this.currentAMCAdPod)
        {
          var currentAMCAdPod = this.currentAMCAdPod;
          var adId = currentAMCAdPod.id;

          this.currentAMCAdPod = null;
          _linearAdIsPlaying = false;

          if (linear)
          {
            _amc.notifyPodEnded(adId);
          }
          else
          {
            _stopNonLinearOverlay(adId);
          }
        }
      });

      /**
       * Ends the current ad in an ad pod the Ad Manager Controller. If it's the
       * last ad in the pod or if forceEndAdPod is true, it also notifies the AMC
       * that the whole ad pod has ended.
       * @private
       * @method GoogleIMA#_endCurrentAd
       * @param forceEndAdPod forces the ad pod to end
       */
      var _endCurrentAd = privateMember(function(forceEndAdPod)
      {
        if (this.currentAMCAdPod)
        {
          if (this.currentIMAAd)
          {
            var currentIMAAd = this.currentIMAAd;
            this.currentIMAAd = null;
            if (currentIMAAd.isLinear())
            {
              var adPodInfo = currentIMAAd.getAdPodInfo();
              if(!adPodInfo)
              {
                if (forceEndAdPod)
                {
                  _endCurrentAdPod(true);
                }
                _throwError("IMA ad returning bad value for this.currentIMAAd.getAdPodInfo().");
              }

              _amc.notifyLinearAdEnded(this.currentAMCAdPod.id);

              var adPos = adPodInfo.getAdPosition();
              var totalAds = adPodInfo.getTotalAds();
              //IMA's ad position is 1 based not 0 based.  So last ad in a 3 ad pod will be position 3.

              //Wait until we receive content resume event from IMA before we end ad pod for
              //single video element mode. This is to workaround an issue where the video controller
              //and IMA are out of sync if we end ad pod too early for single video element mode
              if ((!_amc.ui.useSingleVideoElement && adPos == totalAds) || forceEndAdPod)
              {
                _endCurrentAdPod(true);
              }
            }
            else
            {
              _endCurrentAdPod(this.currentAMCAdPod.isRequest);
            }
          }
          else
          {
            _endCurrentAdPod(true);
          }
        }

        _resetUIContainerStyle();
        this.currentIMAAd = null;
        this.adPlaybackStarted = false;
      });

      /**
       * Returns true if the google sdk has loaded correctly and has at least
       * defined AdDisplayContainer.
       * @private
       * @method GoogleIMA#_isGoogleSDKValid
       * @returns {boolean} True if AdDisplayContainer is defined.
       */
      var _isGoogleSDKValid = privateMember(function()
      {
        return (google && google.ima && google.ima.AdDisplayContainer);
      });

      this.registerVideoControllerWrapper = function(videoWrapper)
      {
        this.videoControllerWrapper = videoWrapper;
      }
    };

    var _throwError = function(outputStr)
    {
      //TODO consolidate code to exit gracefully if we have an error.
      throw new Error("GOOGLE IMA: " + outputStr);
    };

    return new GoogleIMA();
  });

  /**
   * @class GoogleIMAVideoFactory
   * @classdesc Factory for creating video player objects that use HTML5 video tags.
   * @property {string} name The name of the plugin
   * @property {boolean} ready The readiness of the plugin for use (true if elements can be created)
   * @property {object} streams An array of supported encoding types (ex. m3u8, mp4)
   */
  var GoogleIMAVideoFactory = function()
  {
    this.name = "GoogleIMAVideoTech";
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
    this.create = function(parentContainer, id, ooyalaVideoController, css, playerId)
    {
      var googleIMA = registeredGoogleIMAManagers[playerId];
      var wrapper = new GoogleIMAVideoWrapper(googleIMA);
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
    this.createFromExisting = function(domId, ooyalaVideoController, playerId)
    {
      var googleIMA = registeredGoogleIMAManagers[playerId];
      googleIMA.setupSharedVideoElement($("#" + domId)[0]);
      var wrapper = new GoogleIMAVideoWrapper(googleIMA);
      wrapper.controller = ooyalaVideoController;
      wrapper.subscribeAllEvents();
      return wrapper;
    };

    /**
     * Destroys the video technology factory.
     * @public
     * @method GoogleIMAVideoFactory#destroy
     */
    this.destroy = function()
    {
      this.encodings = [];
      this.create = function() {};
      this.createFromExisting = function() {};
    };

    /**
     * Represents the max number of support instances of video elements that can be supported on the
     * current platform. -1 implies no limit.
     * @public
     * @property GoogleIMAVideoFactory#maxSupportedElements
     */
    this.maxSupportedElements = -1;
  };

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
  var GoogleIMAVideoWrapper = function(ima)
  {
    var _ima = ima;

    this.controller = {};
    this.disableNativeSeek = true;
    this.isControllingVideo = true;
    this.readyForCss = false;
    var storedCss = null;

    /************************************************************************************/
    // Required. Methods that Video Controller, Destroy, or Factory call
    /************************************************************************************/

    /**
     * Takes control of the video element from another plugin.
     * @public
     * @method GoogleIMAVideoWrapper#sharedElementGive
     */
    this.sharedElementTake = function() {
      this.isControllingVideo = true;
    };

    /**
     * Hands control of the video element off to another plugin.
     * @public
     * @method GoogleIMAVideoWrapper#sharedElementGive
     */
    this.sharedElementGive = function() {
      this.isControllingVideo = false;
    };

    /**
     * Subscribes to all events raised by the video element.
     * This is called by the Factory during creation.
     * @public
     * @method GoogleIMAVideoWrapper#subscribeAllEvents
     */
    this.subscribeAllEvents = function()
    {
      _ima.registerVideoControllerWrapper(this);
    };

    /**
     * Sets the url of the video.
     * @public
     * @method GoogleIMAVideoWrapper#setVideoUrl
     * @param {string} url The new url to insert into the video element's src attribute
     * @param {string} encoding The encoding of video stream, possible values are found in OO.VIDEO.ENCODING (unused here)
     * @param {boolean} live True if it is a live asset, false otherwise (unused here)
     * @returns {boolean} True or false indicating success
     */
    this.setVideoUrl = function(url)
    {
      return true;
    };

    /**
     * Loads the current stream url in the video element; the element should be left paused.
     * @public
     * @method GoogleIMAVideoWrapper#load
     * @param {boolean} rewind True if the stream should be set to time 0
     */
    this.load = function(rewind)
    {
    };

    /**
     * Sets the initial time of the video playback.
     * @public
     * @method GoogleIMAVideoWrapper#setInitialTime
     * @param {number} initialTime The initial time of the video (seconds)
     */
    this.setInitialTime = function(initialTime)
    {
    };

    /**
     * Triggers playback on the video element.
     * @public
     * @method GoogleIMAVideoWrapper#play
     */
    this.play = function()
    {
      _ima.resumeAd();
    };

    /**
     * Triggers a pause on the video element.
     * @public
     * @method GoogleIMAVideoWrapper#pause
     */
    this.pause = function()
    {
      _ima.pauseAd();
    };

    /**
     * Triggers a seek on the video element.
     * @public
     * @method GoogleIMAVideoWrapper#seek
     * @param {number} time The time to seek the video to (in seconds)
     */
    this.seek = function(time)
    {
    };

    /**
     * Triggers a volume change on the video element.
     * @public
     * @method GoogleIMAVideoWrapper#setVolume
     * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
     */
    this.setVolume = function(volume)
    {
      _ima.setVolume(volume);
    };

    /**
     * Gets the current time position of the video.
     * @public
     * @method GoogleIMAVideoWrapper#getCurrentTime
     * @returns {number} The current time position of the video (seconds)
     */
    this.getCurrentTime = function()
    {
      var time = _ima.getCurrentTime();
      return time;
    };

    /**
     * Applies the given css to the video element.
     * @public
     * @method GoogleIMAVideoWrapper#applyCss
     * @param {object} css The css to apply in key value pairs
     */
    this.applyCss = function(css)
    {
      if (!this.readyForCss)
      {
        storedCss = css;
      }
      else
      {
        applyCssToElement(css);
      }
    };

    /**
     * Triggers application of css changes that have been previously stored.
     * @public
     * @method GoogleIMAVideoWrapper#applyStoredCss
     */
    this.applyStoredCss = function()
    {
      this.applyCss(storedCss);
    };

    /**
     * Callback to handle notifications that ad finished playing
     * @private
     * @method GoogleIMAVideoWrapper#onAdsPlayed
     */
    this.onAdsPlayed = function() {
    };

    /**
     * Does the application of css to the video element if the video element is shared and under ima control.
     * @private
     * @method GoogleIMAVideoWrapper#applyCssToElemenet
     */
    var applyCssToElement = _.bind(function(css)
    {
      if (css && this.isControllingVideo && _ima.sharedVideoElement) {
        $(_ima.sharedVideoElement).css(css);
      }
    }, this);

    /**
     * Destroys the individual video element.
     * @public
     * @method GoogleIMAVideoWrapper#destroy
     */
    this.destroy = function()
    {
      _ima.sharedVideoElement = null;
    };

    /**
     * Calls the controller notify function only if the video wrapper is controlling the video element.
     * @private
     * @method GoogleIMAVideoWrapper#notifyIfInControl
     * @param {string} event The event to raise to the video controller
     * @param {object} params [optional] Event parameters
     */
    var notifyIfInControl = _.bind(function(event, params) {
      if (this.isControllingVideo) {
        this.controller.notify(event, params);
      }
    }, this);

    //Events
    this.raisePlayEvent = function()
    {
      notifyIfInControl(this.controller.EVENTS.PLAY, {});
      notifyIfInControl(this.controller.EVENTS.PLAYING);
    };

    this.raiseEndedEvent = function()
    {
      notifyIfInControl(this.controller.EVENTS.ENDED);
    };

    this.raisePauseEvent = function()
    {
      notifyIfInControl(this.controller.EVENTS.PAUSED);
    };

    this.raiseVolumeEvent = function()
    {
      var volume = _ima.getVolume();
      notifyIfInControl(this.controller.EVENTS.VOLUME_CHANGE, { "volume" : volume });
    };

    this.raiseTimeUpdate = function(currentTime, duration)
    {
      raisePlayhead(this.controller.EVENTS.TIME_UPDATE, currentTime, duration);
    };

    this.raiseDurationChange = function(currentTime, duration)
    {
      raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, currentTime, duration);
    };

    var raisePlayhead = _.bind(function(eventname, currentTime, duration)
    {
      notifyIfInControl(eventname,
        { "currentTime" : currentTime,
          "duration" : duration,
          "buffer" : 0,
          "seekRange" : { "begin" : 0, "end" : 0 } });
    }, this);
  };

  OO.Video.plugin(new GoogleIMAVideoFactory());
}(OO._, OO.$));
