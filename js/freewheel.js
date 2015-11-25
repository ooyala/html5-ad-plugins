/*
 * Freewheel Ad Manager
 * owner: PBI
 * originally authored: Winter 2014
 *
 * document can be found here: http://techhub.freewheel.tv/pages/viewpage.action?pageId=2949327
 *
 * TODO:
 *   companion ads
 *   implement reporting - use EVENT_AD_FIRST_QUARTILE
 *     http://hub.freewheel.tv/display/techdocs/How+to+Get+Ad+Level+Information+from+Events
 */

OO.Ads.manager(function(_, $) {
  /**
   * @class Freewheel
   * @classDesc The Freewheel Ads Manager class, registered as an ads manager with the ad manager controller.
   * Communicates between the player's ad manager controller and the freewheel sdk.
   * @public
   */
  var Freewheel = function() {
    // core
    this.name       = "freewheel-ads-manager";
    this.testMode   = false;
    var amc         = null;
    var fwAdManager = null;
    var fwContext   = null;

    // state
    this.ready             = false;
    var adModuleJsReady    = false;
    var fwAdDataRequested  = false;
    var currentPlayingSlot = null;
    var handlingClick      = false;
    var shouldRequestAds   = false;

    // data
    var remoteModuleJs = null;
    var videoAssetId   = null;
    var networkId      = null;
    var profileId      = null;
    var siteSectionId  = null;
    var adServerURL    = null;
    var FRMSegment     = null;
    var slots          = [];
    var timeline       = [];
    var adRequestType  = "adRequest";

    // ad session
    var slotEndedCallbacks   = {};
    var slotStartedCallbacks = {};
    var adStartedCallbacks   = {};
    var adEndedCallbacks     = {};
    var indexInPod           = 0;

    // ui - do I need this?
    var freeWheelCompanionAdsWrapperId = null;
    var freeWheelCompanionAdsWrapper   = null;

    //configuration
    var marqueeCountdown = true;

    /**
     * Initializes the class by registering the ad manager controller.
     * Adds listeners to Ooyala player events.
     * @public
     * @method Freewheel#initialize
     * @param {object} amcIn A reference to the ad manager controller instance
     */
    this.initialize = function(amcIn) {
      amc = amcIn;
      amc.addPlayerListener(amc.EVENTS.INITIAL_PLAY_REQUESTED, _.bind(onPlayRequested, this));
      amc.addPlayerListener(amc.EVENTS.PLAY_STARTED, _.bind(onPlay, this));
      amc.addPlayerListener(amc.EVENTS.PAUSE, _.bind(onPause, this));
      amc.addPlayerListener(amc.EVENTS.CONTENT_COMPLETED, _.bind(onContentCompleted, this));
      amc.addPlayerListener(amc.EVENTS.CONTENT_AND_ADS_COMPLETED, _.bind(onAllCompleted, this));
      amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, _.bind(onContentChanged, this));
    };

    /**
     * This is called by the ad manager controller when the metadata has been loaded.
     * Ingests metadata.  Loads the remote ad module. Checks if the module is ready to send the request to
     * Freewheel which would return the list of ads.
     * @public
     * @method Freewheel#loadMetadata
     * @param {object} metadata Ad manager metadata from Backlot and from the page level
     * @param {object} baseMetadata Base level metadata from Backlot
     */
    this.loadMetadata = function(metadata, baseMetadata) {
      // initialize values
      this.ready = false;
      videoAssetId = amc.currentEmbedCode;
      remoteModuleJs = amc.platform.isSSL ?
        'https://m.v.fwmrm.net/p/release/latest-JS/adm/prd/AdManager.js' :
        'http://adm.fwmrm.net/p/release/latest-JS/adm/prd/AdManager.js';

      if (metadata) {
        if (metadata["fw_mrm_network_id"]) {
          networkId = parseInt(metadata["fw_mrm_network_id"], 10);
        }
        profileId = metadata['html5_player_profile'];
        siteSectionId = metadata['fw_site_section_id'];
        videoAssetId = metadata['fw_video_asset_id'] || videoAssetId;
        FRMSegment = metadata['FRMSegment'];
        freeWheelCompanionAdsWrapperId = metadata['companion_ad_wrapper_id'];
        adServerURL = (amc.platform.isSSL ? metadata['html5_ssl_ad_server'] : metadata['html5_ad_server']);
        remoteModuleJs = metadata['fw_ad_module_js'] || remoteModuleJs;
      }

      // If the ad server or network id are not specified, unregister
      if (adServerURL == null || networkId == null) {
        amc.unregisterAdManager(this.name);
        return;
      }

      // TODO: Move some of this logic to the controller
      // [PBW-449] To maintain parity with Flash, we allow 'fw_video_asset_id'
      // to be set on the page-level (see 'onPlayerCreated') or fallback to
      // movie metadata, then externalId, and then embed_code.
      if (baseMetadata && baseMetadata["fw_video_asset_id"]) {
        videoAssetId = videoAssetId || baseMetadata["fw_video_asset_id"];
      } else if (amc.pageSettings && amc.pageSettings["originalId"]) {
        videoAssetId = videoAssetId || amc.pageSettings["originalId"];
      } else {
        videoAssetId = videoAssetId || amc.currentEmbedCode;
      }

      // To help reduce load time this could be done in initialize but we won't know whether or not the url is
      // overridden in Backlot until now.  Since we only want to make this request once, this is the earliest we can
      // do it. The 'if' ensures that we do not reload the Freewheel SDK when the movie changes.
      if (!adModuleJsReady && !this.testMode) {
        amc.loadAdModule(this.name, remoteModuleJs, _.bind(function (success) {
          adModuleJsReady = success;
          if (adModuleJsReady) {
            this.ready = true;
            amc.onAdManagerReady();
          }
        }, this));
      } else if (this.testMode) {
        this.ready = true;
        adModuleJsReady = true;
        amc.onAdManagerReady();
      }
      else {
        this.ready = true;
        amc.onAdManagerReady();
      }
    };

    /**
     * Sets the css for freewheel overlays to ensure proper positioning.
     * @private
     * @method Freewheel#_positionOverlays
     */
    var _positionOverlays = _.bind(function() {
      // Set the css for z-index
      // TODO: Set the z index of the overlay - PBI-658
      var css = '#' + amc.ui.videoWrapper.attr("id") + ' ',
          style = document.createElement('style');
      css += 'span[id^="_fw_ad_container"]{z-index: 10004 !important}';

      style.type = 'text/css';
      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
      document.getElementsByTagName('head')[0].appendChild(style);
    }, this);

    /**
     * Called when the UI has been setup.  Sets up the native element listeners and style for the overlay.
     * Checks if the module is ready to send the request to Freewheel which would return the list of ads.
     * @public
     * @method Freewheel#registerUi
     */
    this.registerUi = function() {
      if (freeWheelCompanionAdsWrapperId) {
        freeWheelCompanionAdsWrapper = $('#' + freeWheelCompanionAdsWrapperId);
      }

      _positionOverlays();
    };

    /**
     * Sends a request to Freewheel which returns the list of ads to play
     * @private
     * @method Freewheel#_sendFreewheelRequest
     */
    var _sendFreewheelRequest = _.bind(function() {
      if (!adModuleJsReady) return;
      shouldRequestAds = false;

      // If Freewheel SDK isn't properly loaded by the JS, unregister
      if (typeof(tv) == "undefined") {
        amc.removeAdManager(this.name);
        return;
      }

      // configure ad manager SDK settings
      fwAdManager = new tv.freewheel.SDK.AdManager();
      fwAdManager.setNetwork(networkId);
      fwAdManager.setServer(adServerURL);

      fwContext = fwAdManager.newContext();
      fwContext.setProfile(profileId);
      fwContext.setVideoAsset(videoAssetId, amc.movieDuration, networkId);
      fwContext.setSiteSection(siteSectionId, networkId);

      _registerDisplayForLinearAd();
      _registerDisplayForNonlinearAd();

      // Include dynamically set key value data
      // Note: Revisit this if customer data can include ";" or "=" characters
      if (FRMSegment) {
        _.each(FRMSegment.split(";"), function(segment) {
          segment = segment.split("=");
          fwContext.addKeyValue(segment[0], segment[1]);
        }, this);
      }

      // Listen to AdManager Events
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_AD_IMPRESSION, _.bind(fw_onAdImpression, this));
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_AD_IMPRESSION_END, _.bind(fw_onAdImpressionEnd, this));
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_SLOT_STARTED, _.bind(fw_onSlotStarted, this));
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_SLOT_ENDED, _.bind(fw_onSlotEnded, this));
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_REQUEST_COMPLETE, _.bind(fw_onAdRequestComplete, this));
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_AD_CLICK, _.bind(fw_onAdClick, this));
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_ERROR, _.bind(fw_onError, this));

      // To make sure video ad playback in poor network condition, set video ad timeout parameters.
      fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_START_DETECT_TIMEOUT, 10000, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
      fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_PROGRESS_DETECT_TIMEOUT, 10000, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
      fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_DISPLAY_CONTROLS_WHEN_PAUSE, false, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
      fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_CLICK_DETECTION, true, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);

      // position the overlay y index
      // NOTE: If we set renderer.html.coadScriptName we can probably render overlays on our own
      //       (coad stands for customer owned ad renderer)
      var controlHeight = amc.ui.rootElement.find(".controlBar");
      controlHeight = (controlHeight.length == 0) ? 60 : controlHeight.height() + OO.CONSTANTS.CONTROLS_BOTTOM_PADDING;
      fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_HTML_MARGIN_HEIGHT, controlHeight, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);

      var companionAds = [
        [
          '<span id="VPNT_1" class="_fwph">',
          '<form id="_fw_form_VPNT_1" style="display:none">',
          '<input type="hidden" name="_fw_input_VPNT_1" id="_fw_input_VPNT_1" value="ptgt=p&amp;h=90&amp;w=728&amp;cd=216,30">',
          '</form>',
          '<span id="_fw_container_VPNT_1"></span>',
          '</span>'
        ].join(''),

        [
          '<span id="SSNT_1" class="_fwph">',
          '<form id="_fw_form_SSNT_1" style="display:none">',
          '<input type="hidden" name="_fw_input_SSNT_1" id="_fw_input_SSNT_1" value="w=300&amp;h=250">',
          '</form>',
          '<span id="_fw_container_SSNT_1"></span>',
          '</span>'
        ].join('')
      ];

      // TODO: Implement a timeout here in case fw_onAdRequestComplete doesn't get called - PBI-731
      fwContext.submitRequest();
      fwAdDataRequested = true;
    }, this);

    /**
     * Called when the Freewheel ad xml request has completed.  If the result was success, read the ad slots.
     * Declare that the ad manager is ready for use by setting this.ready=true.
     * @private
     * @method Freewheel#fw_onAdRequestComplete
     * @param {object} event The requestComplete event indicating success or failure
     */
    var fw_onAdRequestComplete = function(event) {
      if (event.success) {
        slots = fwContext.getTemporalSlots();
        // TODO: Make sure to process these?
        //if (!!event && event.response && event.response.ads && event.response.ads.ads) {
        _prepareTimeline();
        amc.appendToTimeline(timeline);
      } else {
        OO.log("FW: freewheel metadata request failure");
      }
      slotEndedCallbacks[adRequestType]();
      delete slotEndedCallbacks[adRequestType];
    };

    /**
     * Called by the ad manager controller.  Creates OO.AdManagerController#Ad objects, places them in an array,
     * and returns them to the ad manager controller.  Since the list of ads won't be ready when this function is
     * called, this returns a placeholder preroll ad during which the list of ads will be fetched.  This prevents the
     * video from starting before the list has been retrieved.
     * @public
     * @method Freewheel#buildTimeline
     * @returns {OO.AdManagerController#Ad[]} timeline A list of the ads to play for the current video
     */
    this.buildTimeline = function() {
      timeline = [];
      return [ new amc.Ad({
        position: 0,
        duration: 0,
        adManager: this.name,
        ad: { type: adRequestType },
        adType: amc.ADTYPE.LINEAR_OVERLAY
      })];
    };

    /**
     * If the timeline has not been built yet, build it in preparation for sending it to the AMC.
     * Freewheel assumes that the ad video element is an html5 video tag.  To force use of this element,
     * always list the stream type as mp4.
     * @private
     * @method Freewheel#_prepareTimeline
     */
    var _prepareTimeline = _.bind(function() {
      if (!slots) return [];
      if (timeline.length > 0) return;
      for (var i=0; i<slots.length; i++)
      {
        switch (slots[i].getTimePositionClass()) {
          case tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL:
            timeline.push(new amc.Ad({
                  position: 0,
                  duration: slots[i].getTotalDuration(),
                  adManager: this.name,
                  ad: slots[i],
                  streams: {"mp4":""},
                  adType: amc.ADTYPE.LINEAR_VIDEO}));
            break;
          case tv.freewheel.SDK.TIME_POSITION_CLASS_MIDROLL:
            timeline.push(new amc.Ad({
                  position: slots[i].getTimePosition(),
                  duration: slots[i].getTotalDuration(),
                  adManager: this.name,
                  ad: slots[i],
                  streams: {"mp4":""},
                  adType: amc.ADTYPE.LINEAR_VIDEO}));
            break;
          case tv.freewheel.SDK.TIME_POSITION_CLASS_POSTROLL:
            timeline.push(new amc.Ad({
                  position: Number.MAX_VALUE,
                  duration: slots[i].getTotalDuration(),
                  adManager: this.name,
                  ad: slots[i],
                  streams: {"mp4":""},
                  adType: amc.ADTYPE.LINEAR_VIDEO}));
            break;
          case tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY:
            timeline.push(new amc.Ad({
                  position: slots[i].getTimePosition(),
                  duration: slots[i].getTotalDuration(),
                  adManager: this.name,
                  ad: slots[i],
                  adType: amc.ADTYPE.NONLINEAR_OVERLAY}));
            break;
        }
      }
    }, this);

    /**
     * Registers the video display base with freewheel to ensure that linear ads play in the ad video element.
     * @private
     * @method Freewheel#_registerDisplayForLinearAd
     */
    var _registerDisplayForLinearAd = _.bind(function() {
      fwContext.registerVideoDisplayBase(amc.ui.adWrapper.attr("id"));
    }, this);

    /**
     * Sets the video elements with freewheel to ensure that nonlinear ads play in the main video element.
     * @private
     * @method Freewheel#_registerDisplayForNonlinearAd
     */
    var _registerDisplayForNonlinearAd = _.bind(function() {
      fwContext.setContentVideoElement(amc.ui.ooyalaVideoElement[0]);
    }, this);

    /**
     * Called by the ad manager controller.  Plays an ad or triggers a the freewheel request for the list of ads.
     * @public
     * @method Freewheel#playAd
     * @param {object} ad The ad to play
     */
    this.playAd = function(ad) {
      _resetAdState();
      try {
        if (ad.ad.type == adRequestType) {
          if (shouldRequestAds) {
            // Trigger the request for the list of ads;
            indexInPod = 0;
            amc.notifyPodStarted(ad.id, 1);
            slotEndedCallbacks[adRequestType] = _.bind(function(adId) { amc.notifyPodEnded(adId); }, this, ad.id);
            _sendFreewheelRequest();
          } else {
            amc.notifyPodStarted(ad.id, 1);
            amc.notifyPodEnded(ad.id);
          }
        }
        else {
          // Trigger the ad
          _registerDisplayForNonlinearAd();
          _registerDisplayForLinearAd();
          currentPlayingSlot = ad.ad;
          indexInPod = 0;
          if (ad.isLinear) {
            fwContext.setParameter("renderer.video.clickDetection", false, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
            slotStartedCallbacks[ad.ad.getCustomId()] = _.bind(function(ad) {
                amc.notifyPodStarted(ad.id, ad.ad.getAdCount());
              }, this, ad);
            slotEndedCallbacks[ad.ad.getCustomId()] = _.bind(function(adId) {
                amc.notifyPodEnded(adId);
              }, this, ad.id);
            adStartedCallbacks[ad.ad.getCustomId()] = _.bind(function(details) {
                amc.notifyLinearAdStarted(this.name, details);
              }, this);
            adEndedCallbacks[ad.ad.getCustomId()] = _.bind(function(adId) {
                amc.notifyLinearAdEnded(adId);
              }, this, ad.id);
            //Freewheel has a limitation where it is not possible to skip a single ad in a pod.
            //Until this is resolved, we will only show the skip button for ad pods of size 1.
            if (currentPlayingSlot.getAdCount() == 1) {
              amc.showSkipVideoAdButton(true);
            }
            else {
              amc.showSkipVideoAdButton(false);
            }
          } else {
            fwContext.setParameter("renderer.video.clickDetection", true, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
            slotStartedCallbacks[ad.ad.getCustomId()] = _.bind(function(adId) {
                amc.sendURLToLoadAndPlayNonLinearAd(ad, ad.id, null);
              }, this, ad.id);
            slotEndedCallbacks[ad.ad.getCustomId()] = _.bind(function(adId) {
                amc.notifyNonlinearAdEnded(adId);
              }, this, ad.id);
            delete adStartedCallbacks[ad.ad.getCustomId()];
            delete adEndedCallbacks[ad.ad.getCustomId()];
          }

          // Register the content video wrapper to align the overlay to the correct elements
          // TODO: We also need to call this on vpaid
          // getCurrentAdInstance()._creativeRenditions[0].getCreativeApi() == "VPAID"
          if (!ad.isLinear) {
            _registerDisplayForNonlinearAd();
          }
          ad.ad.play();
        }
      }
      catch(err) {
        indexInPod = 0;
        amc.notifyPodStarted(ad.id, 1);
        amc.raiseAdError("Ad could not be played.  " + err);
        amc.notifyPodEnded(ad.id);
      }
    };

    var _resetAdState = _.bind(function() {
      handlingClick = false;
      currentPlayingSlot = null;
    }, this);

    /**
     * Called by the ad manager controller.  Pauses the current ad.
     * Not implemented because the ooyala player handles pause for freewheel.
     * @public
     * @method Freewheel#pauseAd
     * @param {object} ad The ad to pause
     */
    /*
    this.pauseAd = function(ad) {
    };
    */

    /**
     * Called by the ad manager controller.  Resumes the current ad.
     * Not implemented because the ooyala player handles resume for freewheel.
     * @public
     * @method Freewheel#resumeAd
     * @param {object} ad The ad to resume
     */
    /*
    this.resumeAd = function(ad) {
    };
    */

    /**
     * Called by the ad manager controller.  Cancels an ad if the ad passed in is the currently playing ad.
     * @public
     * @method Freewheel#cancelAd
     * @param {object} ad The ad to cancel
     */
    this.cancelAd = function(ad) {
      // Only cancel the ad if it's current
      if (ad && ad.ad && currentPlayingSlot &&
          ((currentPlayingSlot["type"] == adRequestType)) ||
           (currentPlayingSlot.getCustomId() === ad.ad.getCustomId())) {
        _cancelCurrentAd();
      }
    };

    var _cancelCurrentAd = _.bind(function() {
      if (currentPlayingSlot == null) return;
      if ((currentPlayingSlot["type"] == adRequestType) ||
          (typeof(currentPlayingSlot.getCustomId) != "function")) {
        _resetAdState();
        return;
      }

      var id = currentPlayingSlot.getCustomId();
      var timePosition = currentPlayingSlot.getTimePositionClass();
      if (_.isFunction(currentPlayingSlot.stop)) {
        // This causes currentPlayingSlot to be set to null
        currentPlayingSlot.stop();
      }

      // Reset the ad manager ui registration after playing a nonlinear ad
      if (timePosition == tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY) {
        _registerDisplayForLinearAd();
      }

      // Call callbacks
      if (_.isFunction(slotStartedCallbacks[id])) {
        slotStartedCallbacks[id]();
        delete slotStartedCallbacks[id];
      }
      if (_.isFunction(slotEndedCallbacks[id]))
      {
        slotEndedCallbacks[id]();
        delete slotEndedCallbacks[id];
      }
      delete adStartedCallbacks[id];
      delete adEndedCallbacks[id];

      _resetAdState();
    }, this);

    var onContentChanged = function() {
      // On Content Changed, need to dispose the context
      // if (fwContext && _.isFunction(fwContext.dispose)) fwContext.dispose();
    };

    /**
     * Triggers a "click" on the currently playing ad.  This is currently used for testing purposes.
     * @public
     * @method Freewheel#playerClicked
     */
    this.playerClicked = function() {
      if (currentPlayingSlot && (currentPlayingSlot["type"] != adRequestType)) {
        var instance = currentPlayingSlot.getCurrentAdInstance();
        // handlingClick makes sure the click is only triggered once, rather than repeatedly in a loop.
        if (!handlingClick) {
          handlingClick = true
          // NOTE: The below is more correct but is returning an empty array.  FW bug?
          //if (instance.getEventCallbackUrls(tv.freewheel.SDK.EVENT_AD_CLICK, tv.freewheel.SDK.EVENT_TYPE_CLICK).length > 0) {
          var callback = instance.getEventCallback(tv.freewheel.SDK.EVENT_AD_CLICK, tv.freewheel.SDK.EVENT_TYPE_CLICK);
          if (callback && callback._url) {
            instance.getRendererController().processEvent({name:tv.freewheel.SDK.EVENT_AD_CLICK});
          }
        } else {
          handlingClick = false;
        }
      }
    };

    /**
     * When the Ad Manager Controller needs to cancel the overlay it will call this function.
     * @public
     * @method Freewheel#cancelOverlay
     * @param {object} currentAd The overlay ad object that is to be cancelled and removed.
     */
    this.cancelOverlay = function(currentAd) {
      // Consider instead, hiding the span with _fw_ad_container_html
      this.cancelAd(currentAd);
    };

    /**
     * This function gets called by the ad Manager Controller when an ad has completed playing. If the main
     * video is finished playing and there was an overlay displayed before the post-roll then it needs to be
     * removed. If the main video hasn't finished playing and there was an overlay displayed before the ad
     * video played, then it could show the overlay again.  In freewheel we do not currently support resuming
     * the overlay after a linear ad.
     * @public
     * @method Freewheel#showOverlay
     */
    this.showOverlay = function() {
    };

    /**
     * Called when the first playback is requested against the player.
     * Show the companion ads wrapper.
     * @private
     * @method Freewheel#onPlayRequested
     */
    var onPlayRequested = function() {
      shouldRequestAds = true;
      if (freeWheelCompanionAdsWrapper) {
        freeWheelCompanionAdsWrapper.show();
      }
    };

    /**
     * Called when the video is played/resumed.  Sets the video state with Freewheel.
     * @private
     * @method Freewheel#onPlay
     */
    var onPlay = function() {
      if (!fwContext || !_.isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_PLAYING);
    };

    /**
     * Called when the video is paused.  Sets the video state with Freewheel.
     * @private
     * @method Freewheel#onPause
     */
    var onPause = function() {
      if (!fwContext || !_.isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_PAUSED);
    };

    /**
     * Called when the video is completed.  Sets the video state with Freewheel.
     * @private
     * @method Freewheel#onContentCompleted
     */
    var onContentCompleted = function() {
      if (!fwContext || !_.isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_STOPPED);
    };

    /**
     * Called when the video and all ads are completed.  Sets the video state with Freewheel.
     * Hides the companion ads wrapper.
     * @private
     * @method Freewheel#onAllCompleted
     */
    var onAllCompleted = function() {
      if (!fwContext || !_.isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_COMPLETED);

      if (freeWheelCompanionAdsWrapper) {
        freeWheelCompanionAdsWrapper.hide();
      }
    };

    /**
     * If marquee should show the countdown, updates the marquee with the remaining time
     * @private
     * @method Freewheel#_updateCountdown
     */
    var _updateCountdown = _.bind(function(currentTime, duration) {
      if (marqueeCountdown && (duration > 0) && (duration >= currentTime)) {
        var remainingTime = Math.ceil(duration - currentTime);
        amc.ui.updateAdMarqueeTime(remainingTime);
      }
    }, this);

    /**
     * Called by Freewheel js when an ad is clicked.  Raises the event with the ad manager controller by
     * calling "adsClicked".
     * @private
     * @method Freewheel#fw_onAdClick
     */
    var fw_onAdClick = function() {
      // handlingClick makes sure the click is only triggered once, rather than repeatedly in a loop.
      if (!handlingClick) {
        handlingClick = true;
        OO.log("FW: The ad was clicked!");
        amc.adsClicked();
      } else {
        handlingClick = false;
      }

      // Exit full screen to open the link?
      //amc.changeFullscreen(false);
    };

    /**
    * Called by Freewheel js when an ad error is raised.  Raises the event with the ad manager controller
    * by calling "raiseAdError".
    * @private
    * @method Freewheel#fw_onError
    * @param {object} event The AD_ERROR event object
    * @param {string} error The error message
    */
    var fw_onError = function(event, error) {
      amc.raiseAdError("FW: An ad error has occurred. The error string reported was: " + error);
    };

    /**
     * Called when an ad impression begins.  Calls the callback from the ad manager controller to indicate
     * that the ad impression has begun.
     * @private
     * @method Freewheel#fw_onAdImpression
     * @param {object} event The ad impression object indicating which ad started
     */
    var fw_onAdImpression = function(event) {
      indexInPod++;
      if (!event) return;
      if (_.isFunction(adStartedCallbacks[event.slotCustomId])) {
        var clickEvents = _.filter(event.adInstance._eventCallbacks,
                                   function(callback){ return callback._name == "defaultClick" });
        var hasClickUrl = clickEvents.length > 0;
        adStartedCallbacks[event.slotCustomId]({
            name: event.adInstance.getActiveCreativeRendition().getPrimaryCreativeRenditionAsset().getName(),
            duration: event.adInstance._creative.getDuration(),
            hasClickUrl: hasClickUrl,
            indexInPod: indexInPod,
            skippable: false
          });
      }

      /*
      if (event.adInstance.getSlot().getTimePositionClass() == tv.freewheel.SDK.TIME_POSITION_CLASS_DISPLAY) {
        return;
      }

      var singleAdItem = { duration: event.adInstance._creative.getDuration(), adId: event.adInstance._adId,
        creativeId: event.adInstance._creativeId, source: 'html5' };
      this.mb.publish(OO.EVENTS.WILL_PLAY_SINGLE_AD, singleAdItem);
       */
    };

    /**
     * Called when an ad impression ends.  Calls the callback from the ad manager controller to indicate that
     * ad impression has ended.
     * @private
     * @method Freewheel#fw_onAdImpressionEnd
     * @param event {object} event The ad impression object indicating which ad ended
     */
    var fw_onAdImpressionEnd = function(event) {
      // TODO: inspect event for playback success or errors
      if (_.isFunction(adEndedCallbacks[event.adInstance.getSlot().getCustomId()])) {
        adEndedCallbacks[event.adInstance.getSlot().getCustomId()]();
      }
    };

    /**
     * Called when an ad slot has begun.  Removes native player controls.
     * @private
     * @method Freewheel#fw_onSlotStarted
     */
    var fw_onSlotStarted = function() {
      // adVideoElement may be null for overlays
      if (currentPlayingSlot &&
          currentPlayingSlot.getTimePositionClass() === tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY &&
          amc && amc.ui && amc.ui.adVideoElement) {
        amc.ui.adVideoElement.removeAttr('controls');
      }

      // cancel timeout on load
      if (_.isFunction(slotStartedCallbacks[currentPlayingSlot.getCustomId()])) {
        slotStartedCallbacks[currentPlayingSlot.getCustomId()]();
      }
      delete slotStartedCallbacks[currentPlayingSlot.getCustomId()];
    };

    /**
     * Called when an ad slot has ended.  Removes native player controls.  Calls the ad manager controller
     * callback to indicate that the ad has completed.
     * @private
     * @method Freewheel#fw_onSlotEnded
     * @param {object} event The slotEnded event showing which ad ended
     */
    var fw_onSlotEnded = function(event) {
      // Disable controls on the video element.  Freewheel seems to be turning it on
      // TODO: inspect event for playback success or errors

      // check if ad is an overlay
      if (currentPlayingSlot &&
          currentPlayingSlot.getTimePositionClass() === tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY) {
        _registerDisplayForLinearAd();

        // adVideoElement may be null for overlays
        if (amc && amc.ui && amc.ui.adVideoElement) {
          amc.ui.adVideoElement.attr('controls',false);
        }
      }

      if (!event || !event.slot) return;
      _resetAdState();
      if (_.isFunction(slotEndedCallbacks[event.slot.getCustomId()]))
        slotEndedCallbacks[event.slot.getCustomId()]();
      delete slotEndedCallbacks[event.slot.getCustomId()];
      delete adStartedCallbacks[event.slot.getCustomId()];
      delete adEndedCallbacks[event.slot.getCustomId()];
    };

    /**
     * Cancel the current ad, reset the state variables, dispose the remote Freewheel class.
     * @public
     * @method Freewheel#destroy
     */
    this.destroy = function() {
      _cancelCurrentAd();

      // state
      this.ready         = false;
      adModuleJsReady    = false;
      fwAdDataRequested  = false;
      _resetAdState();

      // data
      remoteModuleJs = null;
      videoAssetId   = null;
      networkId      = null;
      profileId      = null;
      siteSectionId  = null;
      adServerURL    = null;
      FRMSegment     = null;
      slots          = [];

      if (fwContext && _.isFunction(fwContext.dispose)) fwContext.dispose();
    };
  };

  return new Freewheel();
});
