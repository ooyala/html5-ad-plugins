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

require("../html5-common/js/utils/constants.js");

OO.Ads.manager(function(_, $) {
  /**
   * @class Freewheel
   * @classDesc The Freewheel Ads Manager class, registered as an ads manager with the ad manager controller.
   * Communicates between the player's ad manager controller and the freewheel sdk.
   * @public
   */
  var Freewheel = function() {
    // core
    this.name              = "freewheel-ads-manager";
    this.testMode          = false;
    this.videoRestrictions = { "technology": OO.VIDEO.TECHNOLOGY.HTML5,
                               "features": [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE] };

    var amc         = null;
    var fwAdManager = null;
    var fwContext   = null;

    // state
    this.ready             = false;
    var adModuleJsReady    = false;
    var fwAdDataRequested  = false;
    var currentAd          = null;
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

    // ad session
    var slotEndedCallbacks   = {};
    var slotStartedCallbacks = {};
    var adStartedCallbacks   = {};
    var adEndedCallbacks     = {};
    var indexInPod           = 0;
    var adRequestTimeout     = null;

    // ui - do I need this?
    var freeWheelCompanionAdsWrapperId = null;
    var freeWheelCompanionAdsWrapper   = null;

    //fake video for overlays to work with player_skin_plugins div
    var fakeVideo = null;
    var overlayContainer = null;

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
      amc.addPlayerListener(amc.EVENTS.REPLAY_REQUESTED, _.bind(onReplayRequested, this));
      amc.addPlayerListener(amc.EVENTS.PLAY_STARTED, _.bind(onPlay, this));
      amc.addPlayerListener(amc.EVENTS.PAUSE, _.bind(onPause, this));
      amc.addPlayerListener(amc.EVENTS.CONTENT_COMPLETED, _.bind(onContentCompleted, this));
      amc.addPlayerListener(amc.EVENTS.CONTENT_AND_ADS_COMPLETED, _.bind(onAllCompleted, this));
      amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, _.bind(onContentChanged, this));
      amc.addPlayerListener(amc.EVENTS.SIZE_CHANGED, _.bind(onResize, this));
      amc.addPlayerListener(amc.EVENTS.MAIN_CONTENT_IN_FOCUS, _.bind(onMainContentInFocus, this));
    };

    /**
     * This is called by the ad manager controller when the metadata has been loaded.
     * Ingests metadata.  Loads the remote ad module. Checks if the module is ready to send the request to
     * Freewheel which would return the list of ads.
     * @public
     * @method Freewheel#loadMetadata
     * @param {object} metadata Ad manager metadata from Backlot and from the page level
     * @param {object} baseMetadata Base level metadata from Backlot
     * @param {object} movieMetadata Metadata pertaining specifically to the movie being played
     */
    this.loadMetadata = function(metadata, baseMetadata, movieMetadata) {
      // initialize values
      this.ready = false;
      videoAssetId = null;
      //if we have all the required parameters for using an external id, set videoAssetId to the external id
      var externalId = movieMetadata['external_id'];
      if (metadata['use_external_id'] && externalId) {
        var filter = metadata['external_id_filter'];
        if (filter) {
          var match = externalId.match(filter);
          if (match.length > 0) {
            //the first element of match will contain the match itself
            videoAssetId = match[0];
          }
        } else {
          videoAssetId = externalId;
        }
      }
      //fallback to embed code if we do not have a video asset id yet
      if (!videoAssetId) {
        videoAssetId = metadata['embedCode'];
      }
      remoteModuleJs = amc.platform.isSSL ?
        'https://m.v.fwmrm.net/p/release/latest-JS/adm/prd/AdManager.js' :
        'http://adm.fwmrm.net/p/release/latest-JS/adm/prd/AdManager.js';

      if (metadata) {
        if (metadata["fw_mrm_network_id"]) {
          networkId = parseInt(metadata["fw_mrm_network_id"], 10);
        }
        profileId = metadata['html5_player_profile'];
        siteSectionId = metadata['fw_site_section_id'];
        videoAssetId = metadata['fw_video_asset_id'] || metadata['fw_video_asset_network_id'] || videoAssetId;
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
      if (!videoAssetId)
      {
        if (baseMetadata && baseMetadata["fw_video_asset_id"]) {
          videoAssetId = baseMetadata["fw_video_asset_id"];
        } else if (amc.pageSettings && amc.pageSettings["originalId"]) {
          videoAssetId = amc.pageSettings["originalId"];
        } else {
          videoAssetId = amc.currentEmbedCode;
        }
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
        _clearAdRequestTimeout();
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

      if (OO.requiresSingleVideoElement) {
        // NOTE: If we set renderer.html.coadScriptName we can probably render overlays on our own
        //       (coad stands for customer owned ad renderer)
        var controlHeight = amc.ui.rootElement.find(".controlBar");
        controlHeight = (controlHeight.length == 0) ? 60 : controlHeight.height() + OO.CONSTANTS.CONTROLS_BOTTOM_PADDING;
        fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_HTML_MARGIN_HEIGHT, controlHeight, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
      } else {
        //if we can integrate the overlay with Alice, we do not want to add margin height as it will
        //fit properly within the player skin plugins div without being covered by the control bar
        fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_HTML_MARGIN_HEIGHT, 0, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
      }


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

      fwContext.submitRequest();
      fwAdDataRequested = true;
      _setAdRequestTimeout(_adRequestTimeout, amc.MAX_AD_REQUEST_TIMEOUT);
    }, this);

    /**
     * Set up function to log error if ad response is null after maximum duration allowed for ad request to respond
     * has exceeded.
     * @private
     * @method Freewheel#_adRequestTimeout
     */
    var _adRequestTimeout = _.bind(function(){
      _clearAdRequestTimeout();
      if (!fwContext._adResponse) {
        fwContext.removeEventListener(tv.freewheel.SDK.EVENT_REQUEST_COMPLETE);
        OO.log("FW: freewheel ad request timeout");
        var error = "ad request timeout";
        fw_onError(null, error);
        slotEndedCallbacks[amc.ADTYPE.AD_REQUEST]();
        delete slotEndedCallbacks[amc.ADTYPE.AD_REQUEST];
      }
    }, this);

    /**
     * Set timeout for ad request. Will call the provided callback
     * if we timeout.
     * @private
     * @method Freewheel#_setAdRequestTimeout
     * @param callback The function to call when we time out
     * @param duration the time to wait before timing out
     */
    var _setAdRequestTimeout = _.bind(function(callback, duration){
      if (adRequestTimeout) {
        var error = "Ad Request Timeout already exists - bad state";
        fw_onError(null, error);
      } 
      // only set timeout if not in test mode otherwise it will break unit tests
      else if (!this.testMode) {
        adRequestTimeout = _.delay(callback, duration);
      }
    }, this);

    /**
     * Called when the Freewheel ad xml request has completed.  If the result was success, read the ad slots.
     * Declare that the ad manager is ready for use by setting this.ready=true.
     * @private
     * @method Freewheel#fw_onAdRequestComplete
     * @param {object} event The requestComplete event indicating success or failure
     */
    var fw_onAdRequestComplete = function(event) {
      // clear ad request timeout since fw_onAdRequestComplete was called
      _clearAdRequestTimeout();
      if (event.success) {
        slots = fwContext.getTemporalSlots();
        // TODO: Make sure to process these?
        //if (!!event && event.response && event.response.ads && event.response.ads.ads) {
        _prepareTimeline();
        amc.appendToTimeline(timeline);
      } else {
        OO.log("FW: freewheel metadata request failure");
      }
      slotEndedCallbacks[amc.ADTYPE.AD_REQUEST]();
      delete slotEndedCallbacks[amc.ADTYPE.AD_REQUEST];
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
        ad: {},
        adType: amc.ADTYPE.AD_REQUEST
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
      if (OO.requiresSingleVideoElement) {
        //on iOS and Android, FW expects the following to be our legit video element when
        //playing back video ads. If we attempt to use the fake video and then switch to
        //the real video later, FW places the overlays in unexpected locations.
        fwContext.setContentVideoElement(amc.ui.ooyalaVideoElement[0]);
      } else {
        if (!overlayContainer) {
          //Freewheel uses the width and height of the parent of the video element we provide
          //Create one with 100% width and 100% height here for FW to use
          overlayContainer = document.createElement('div');
          overlayContainer.style.width = "100%";
          overlayContainer.style.height = "100%";
          var parent = amc.ui.playerSkinPluginsElement ? amc.ui.playerSkinPluginsElement[0] : amc.ui.pluginsElement[0];
          parent.appendChild(overlayContainer);
        }

        //We need to create a fake video because the setContentVideoElement API requires a video element. The overlay
        //will be placed in the parent of the provided video element, the player skin plugins element
        if (!fakeVideo) {
          fakeVideo = document.createElement('video');
          overlayContainer.appendChild(fakeVideo);
        }
        fwContext.setContentVideoElement(fakeVideo);
      }
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
        if (ad.adType == amc.ADTYPE.AD_REQUEST) {
          if (shouldRequestAds) {
            // Trigger the request for the list of ads;
            indexInPod = 0;
            amc.notifyPodStarted(ad.id, 1);
            slotEndedCallbacks[amc.ADTYPE.AD_REQUEST] = _.bind(function(adId) { amc.notifyPodEnded(adId); }, this, ad.id);
            _sendFreewheelRequest();
          } else {
            amc.notifyPodStarted(ad.id, 1);
            amc.notifyPodEnded(ad.id);
          }
        }
        else {
          // Trigger the ad
          currentAd = ad;
          currentPlayingSlot = ad.ad;
          indexInPod = 0;
          if (ad.isLinear) {
            _registerDisplayForLinearAd();
            fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_CLICK_DETECTION, false, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
            slotStartedCallbacks[ad.ad.getCustomId()] = _.bind(function(ad) {
                amc.notifyPodStarted(ad.id, ad.ad.getAdCount());
              }, this, ad);
            slotEndedCallbacks[ad.ad.getCustomId()] = _.bind(function(adId) {
                amc.notifyPodEnded(adId);
              }, this, ad.id);
            adStartedCallbacks[ad.ad.getCustomId()] = _.bind(function(adId, details) {
                //We need to remove the fake video element so that Alice
                //can properly render the UI for a linear ad
                if (fakeVideo && overlayContainer) {
                  overlayContainer.removeChild(fakeVideo);
                  fakeVideo = null;
                }
                amc.notifyLinearAdStarted(adId, details);
              }, this, ad.id);
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
            _registerDisplayForNonlinearAd();
            fwContext.setParameter(tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_CLICK_DETECTION, true, tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL);
            adStartedCallbacks[ad.ad.getCustomId()] = _.bind(function(details) {
              //provide width and height values if available. Alice will use these to resize
              //the skin plugins div when a non linear overlay is on screen
              if (details) {
                ad.width = details.width;
                ad.height = details.height;
                //the width and height of the fake video must be equal
                //to or greater than the size of the overlay creative
                //or else FW won't display it
                if (fakeVideo) {
                  fakeVideo.style.width = details.width + 'px';
                  fakeVideo.style.height = details.height + 'px';
                }

                updateOverlayPosition();
              }
              amc.sendURLToLoadAndPlayNonLinearAd(ad, ad.id, null);
            }, this);

            adEndedCallbacks[ad.ad.getCustomId()] = _.bind(function(adId) {
              if (fakeVideo && overlayContainer) {
                overlayContainer.removeChild(fakeVideo);
                fakeVideo = null;
              }
              amc.notifyNonlinearAdEnded(adId);
            }, this, ad.id);
            delete slotStartedCallbacks[ad.ad.getCustomId()];
            delete slotEndedCallbacks[ad.ad.getCustomId()];
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
      currentAd = null;
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
          ((ad.adType === amc.ADTYPE.AD_REQUEST)) ||
           (currentPlayingSlot.getCustomId() === ad.ad.getCustomId())) {
        _cancelCurrentAd();
      }
    };

    var _cancelCurrentAd = _.bind(function() {
      if (currentAd === null) return;
      if ((currentAd.adType === amc.ADTYPE.AD_REQUEST) ||
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

    var updateOverlayPosition = _.bind(function() {
      //Overlay placement issue - PBI-1227 as of 12/9/2015
      //The main issue with Freewheel is when notifying their SDK of video size changes,
      //Freewheel only attempts to resize ads and not re-position ads.
      //In the Freewheel SDK, overlay ads do not have a resize function and thus nothing happens.

      //We want to force the renderer to reposition the overlay ads. The Freewheel SDK has functions
      //that accomplish this, but are undocumented.
      if(currentPlayingSlot && currentAd && !currentAd.isLinear && !this.testMode){
        //Update Freewheel of size changes. At this point Freewheel will attempt to resize any ads
        notifySizeChange();
      }
    }, this);

    var onResize = function() {
      updateOverlayPosition();
    };

    /**
     * Notifies Freewheel of a size change.
     * @private
     * @method Freewheel#notifySizeChange
     */
    var notifySizeChange = function() {
      //Freewheel SDK uses setContentVideoElement and registerVideoDisplayBase for size
      //change notifications for the main content and ad content respectively.
      //_registerDisplayForLinearAd calls registerVideoDisplayBase and
      //_registerDisplayForNonlinearAd calls setContentVideoElement, so we'll call
      //these here
      if (currentPlayingSlot) {
        if (currentPlayingSlot.getTimePositionClass() !== tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY) {
          _registerDisplayForLinearAd();
        } else {
          _registerDisplayForNonlinearAd();
        }
      }
    };

    /**
     * Triggers a "click" on the currently playing ad.  This is currently used for testing purposes.
     * @public
     * @method Freewheel#playerClicked
     */
    this.playerClicked = function() {
      if (currentAd && (currentAd.adType !== amc.ADTYPE.AD_REQUEST)) {
        var instance = currentPlayingSlot.getCurrentAdInstance();
        // handlingClick makes sure the click is only triggered once, rather than repeatedly in a loop.
        if (!handlingClick) {
          handlingClick = true;
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
     * @param {object} currentAd The overlay ad object that is to be cancelled and removed
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
     * This function is called by the ad manager controller when the main video element comes into focus.
     * @private
     * @method Freewheel#onMainContentInFocus
     */
    var onMainContentInFocus = function() {
      // The Freewheel SDK does not like when the video elements passed in via _registerDisplayForLinearAd
      // and _registerDisplayForNonlinearAd have display set to none. This causes overlays to not
      // be positioned and sized correctly (PBI-1307). When we get notified that the main video content
      // is in focus, we need update the overlay position.
      // Note: Updating overlay position uses undocumented methods and may break at any time. Also, simply
      // notifying the SDK via _registerDisplayForNonlinearAd does not appear to be sufficient at this time
      updateOverlayPosition();
    };

    var setupAdsWrapper = function() {
      if (freeWheelCompanionAdsWrapper) {
        freeWheelCompanionAdsWrapper.show();
      }
    };

    /**
     * Called when the first playback is requested against the player.
     * Show the companion ads wrapper.
     * @private
     * @method Freewheel#onPlayRequested
     */
    var onPlayRequested = function() {
      shouldRequestAds = true;
      setupAdsWrapper();
    };

    /**
     * Called when a replay is requested against the player.
     * Resets the ad state.
     * Show the companion ads wrapper.
     * @private
     * @method Freewheel#onReplayRequested
     */
    var onReplayRequested = function() {
      _resetAdState();
      shouldRequestAds = true;
      setupAdsWrapper();
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

      amc.adsClickthroughOpened();

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
        var activeCreativeRendition = event.adInstance.getActiveCreativeRendition();
        adStartedCallbacks[event.slotCustomId]({
            name: activeCreativeRendition.getPrimaryCreativeRenditionAsset().getName(),
            duration: event.adInstance._creative.getDuration(),
            hasClickUrl: hasClickUrl,
            indexInPod: indexInPod,
            skippable: false,
            width: activeCreativeRendition.getWidth(),
            height: activeCreativeRendition.getHeight()
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
          currentPlayingSlot.getTimePositionClass() !== tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY &&
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
      
      // adVideoElement may be null for overlays
      if (currentPlayingSlot &&
          currentPlayingSlot.getTimePositionClass() !== tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY &&
          amc && amc.ui && amc.ui.adVideoElement) {
        amc.ui.adVideoElement.attr('controls',false);
      }

      if (currentPlayingSlot &&
          currentPlayingSlot.getTimePositionClass() == tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY) {
        _registerDisplayForLinearAd();
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
     * Helper function that checks if the ad request timeout exists and erases it.
     * @private
     * @method Freewheel#_clearAdRequestTimeout
     */
    var _clearAdRequestTimeout = _.bind(function() {
      if (adRequestTimeout) {
        clearTimeout(adRequestTimeout);
        adRequestTimeout = null;
      }
    }, this);

    // Getters
    
    /**
     * Returns whether player is handling click.
     * @public
     * @method Freewheel#getHandlingClick
     * @returns {boolean} true if player is handling click. Returns false, if otherwise.
     */
    this.getHandlingClick = function() {
      return handlingClick;
    };

    /**
     * Cancel the current ad, reset the state variables, dispose the remote Freewheel class.
     * @public
     * @method Freewheel#destroy
     */
    this.destroy = function() {
      _cancelCurrentAd();
      _clearAdRequestTimeout();

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

      if (fakeVideo) {
        if (fakeVideo.parentElement) {
          fakeVideo.parentElement.removeChild(fakeVideo);
        }
        fakeVideo = null;
      }

      if (overlayContainer) {
        if (overlayContainer.parentElement) {
          overlayContainer.parentElement.removeChild(overlayContainer);
        }
        overlayContainer = null;
      }

      if (fwContext && _.isFunction(fwContext.dispose)) fwContext.dispose();
    };
  };

  return new Freewheel();
});
