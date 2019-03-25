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

const {
  isFunction,
  each,
  delay,
  filter,
} = require('underscore');

require('../html5-common/js/utils/constants.js');

OO.Ads.manager(() => {
  /**
   * @class Freewheel
   * @classDesc The Freewheel Ads Manager class, registered as an ads manager with the ad manager controller.
   * Communicates between the player's ad manager controller and the freewheel sdk.
   * @public
   */
  const Freewheel = function () {
    // core
    this.name = 'freewheel-ads-manager';
    this.testMode = false;
    this.videoRestrictions = {
      technology: OO.VIDEO.TECHNOLOGY.HTML5,
      features: [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE],
    };

    let amc = null;
    let fwAdManager = null;
    let fwContext = null;

    // state
    this.ready = false;
    this.initTime = Date.now();
    let adModuleJsReady = false;
    let currentAd = null;
    let currentPlayingSlot = null;
    let handlingClick = false;
    let shouldRequestAds = false;

    // data
    let remoteModuleJs = null;
    let videoAssetId = null;
    let networkId = null;
    let profileId = null;
    let siteSectionId = null;
    let adServerURL = null;
    let FRMSegment = null;
    let slots = [];
    let timeline = [];

    // ad session
    const slotEndedCallbacks = {};
    const slotStartedCallbacks = {};
    const adStartedCallbacks = {};
    const adEndedCallbacks = {};
    let indexInPod = 0;
    let adRequestTimeout = null;
    let bitrateOverride = null;

    // ui - do I need this?
    let freeWheelCompanionAdsWrapperId = null;
    let freeWheelCompanionAdsWrapper = null;

    // fake video for overlays to work with player_skin_plugins div
    let fakeVideo = null;
    let overlayContainer = null;

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
    this.loadMetadata = (metadata, baseMetadata, movieMetadata) => {
      // initialize values
      this.ready = false;
      videoAssetId = null;
      // if we have all the required parameters for using an external id, set videoAssetId to the external id
      const externalId = movieMetadata.external_id;
      if (metadata.use_external_id && externalId) {
        const filter = metadata.external_id_filter;
        if (filter) {
          const match = externalId.match(filter);
          if (match.length > 0) {
            // the first element of match will contain the match itself
            videoAssetId = match[0];
          }
        } else {
          videoAssetId = externalId;
        }
      }
      // fallback to embed code if we do not have a video asset id yet
      if (!videoAssetId) {
        videoAssetId = metadata.embedCode;
      }
      remoteModuleJs = amc.platform.isSSL
        ? 'https://mssl.fwmrm.net/p/release/latest-JS/adm/prd/AdManager.js'
        : 'http://adm.fwmrm.net/p/release/latest-JS/adm/prd/AdManager.js';

      if (metadata) {
        if (metadata.fw_mrm_network_id) {
          networkId = parseInt(metadata.fw_mrm_network_id, 10);
        }
        profileId = metadata.html5_player_profile;
        siteSectionId = metadata.fw_site_section_id;
        videoAssetId = metadata.fw_video_asset_id || metadata.fw_video_asset_network_id || videoAssetId;
        FRMSegment = metadata.FRMSegment;
        freeWheelCompanionAdsWrapperId = metadata.companion_ad_wrapper_id;
        adServerURL = (amc.platform.isSSL ? metadata.html5_ssl_ad_server : metadata.html5_ad_server);
        remoteModuleJs = metadata.fw_ad_module_js || remoteModuleJs;
        bitrateOverride = parseInt(metadata.bitrateOverride);
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
      if (!videoAssetId) {
        if (baseMetadata && baseMetadata.fw_video_asset_id) {
          videoAssetId = baseMetadata.fw_video_asset_id;
        } else if (amc.pageSettings && amc.pageSettings.originalId) {
          videoAssetId = amc.pageSettings.originalId;
        } else {
          videoAssetId = amc.currentEmbedCode;
        }
      }

      // To help reduce load time this could be done in initialize but we won't know whether or not the url is
      // overridden in Backlot until now.  Since we only want to make this request once, this is the earliest we can
      // do it. The 'if' ensures that we do not reload the Freewheel SDK when the movie changes.
      if (!adModuleJsReady && !this.testMode) {
        amc.loadAdModule(this.name, remoteModuleJs, (success) => {
          adModuleJsReady = success;
          if (adModuleJsReady) {
            this.ready = true;
            amc.onAdManagerReady(true);
            amc.reportPluginLoaded(Date.now() - this.initTime, this.name);
          }
        });
      } else if (this.testMode) {
        this.ready = true;
        adModuleJsReady = true;
        amc.onAdManagerReady(true);
        amc.reportPluginLoaded(Date.now() - this.initTime, this.name);
      } else {
        this.ready = true;
        amc.onAdManagerReady(true);
        amc.reportPluginLoaded(Date.now() - this.initTime, this.name);
      }
    };

    /**
     * Sets the css for freewheel overlays to ensure proper positioning.
     * @private
     * @method Freewheel#_positionOverlays
     */
    const _positionOverlays = () => {
      // Set the css for z-index
      // TODO: Set the z index of the overlay - PBI-658
      let css = `#${amc.ui.videoWrapper.attr('id')} `;
      const style = document.createElement('style');
      css += 'span[id^="_fw_ad_container"]{z-index: 10004 !important}';

      style.type = 'text/css';
      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
      document.getElementsByTagName('head')[0].appendChild(style);
    };

    /**
     * Called when the UI has been setup.  Sets up the native element listeners and style for the overlay.
     * Checks if the module is ready to send the request to Freewheel which would return the list of ads.
     * @public
     * @method Freewheel#registerUi
     */
    this.registerUi = () => {
      if (freeWheelCompanionAdsWrapperId) {
        freeWheelCompanionAdsWrapper = document.getElementById(freeWheelCompanionAdsWrapperId);
      }

      _positionOverlays();
    };

    /**
     * Helper function that checks if the ad request timeout exists and erases it.
     * @private
     * @method Freewheel#_clearAdRequestTimeout
     */
    const _clearAdRequestTimeout = () => {
      if (adRequestTimeout) {
        clearTimeout(adRequestTimeout);
        adRequestTimeout = null;
      }
    };

    /**
     * Registers the video display base with freewheel to ensure that linear ads play in the ad video element.
     * @private
     * @method Freewheel#_registerDisplayForLinearAd
     */
    const _registerDisplayForLinearAd = () => {
      fwContext.registerVideoDisplayBase(amc.ui.adWrapper.attr('id'));
    };

    /**
     * Sets the video elements with freewheel to ensure that nonlinear ads play in the main video element.
     * @private
     * @method Freewheel#_registerDisplayForNonlinearAd
     */
    const _registerDisplayForNonlinearAd = () => {
      if (OO.requiresSingleVideoElement) {
        // on iOS and Android, FW expects the following to be our legit video element when
        // playing back video ads. If we attempt to use the fake video and then switch to
        // the real video later, FW places the overlays in unexpected locations.
        fwContext.setContentVideoElement(amc.ui.ooyalaVideoElement[0]);
      } else {
        if (!overlayContainer) {
          // Freewheel uses the width and height of the parent of the video element we provide
          // Create one with 100% width and 100% height here for FW to use
          overlayContainer = document.createElement('div');
          overlayContainer.style.width = '100%';
          overlayContainer.style.height = '100%';
          const parent = amc.ui.playerSkinPluginsElement
            ? amc.ui.playerSkinPluginsElement[0]
            : amc.ui.pluginsElement[0];
          parent.appendChild(overlayContainer);
        }

        // We need to create a fake video because the setContentVideoElement API requires a video element. The overlay
        // will be placed in the parent of the provided video element, the player skin plugins element
        if (!fakeVideo) {
          fakeVideo = document.createElement('video');
          overlayContainer.appendChild(fakeVideo);
        }
        fwContext.setContentVideoElement(fakeVideo);
      }
    };

    /**
     * Called by Freewheel js when an ad error is raised.  Raises the event with the ad manager controller
     * by calling "raiseAdError".
     * @private
     * @method Freewheel#fw_onError
     * @param {object} event The AD_ERROR event object
     * @param {string} error The error message
     */
    const fw_onError = (event, error) => {
      amc.raiseAdError(`FW: An ad error has occurred. The error string reported was: ${error}`);
    };

    /**
     * Set timeout for ad request. Will call the provided callback
     * if we timeout.
     * @private
     * @method Freewheel#_setAdRequestTimeout
     * @param callback The function to call when we time out
     * @param duration the time to wait before timing out
     */
    const _setAdRequestTimeout = (callback, duration) => {
      if (adRequestTimeout) {
        const error = 'Ad Request Timeout already exists - bad state';
        fw_onError(null, error);
      } else if (!this.testMode) {
        // Only set timeout if not in test mode otherwise it will break unit tests.
        adRequestTimeout = delay(callback, duration);
      }
    };

    /**
     * Set up function to log error if ad response is null after maximum duration allowed for ad request to respond
     * has exceeded.
     * @private
     * @method Freewheel#_adRequestTimeout
     */
    const _adRequestTimeout = () => {
      _clearAdRequestTimeout();
      if (!fwContext._adResponse) {
        fwContext.removeEventListener(tv.freewheel.SDK.EVENT_REQUEST_COMPLETE);
        OO.log('FW: freewheel ad request timeout');
        const error = 'ad request timeout';
        fw_onError(null, error);
        slotEndedCallbacks[amc.ADTYPE.AD_REQUEST]();
        delete slotEndedCallbacks[amc.ADTYPE.AD_REQUEST];
      }
    };

    /**
     * If the timeline has not been built yet, build it in preparation for sending it to the AMC.
     * Freewheel assumes that the ad video element is an html5 video tag.  To force use of this element,
     * always list the stream type as mp4.
     * @private
     * @method Freewheel#_prepareTimeline
     */
    const _prepareTimeline = () => {
      if (!slots) return [];
      if (timeline.length > 0) return;
      for (let i = 0; i < slots.length; i++) {
        switch (slots[i].getTimePositionClass()) {
          case tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL:
            timeline.push(new amc.Ad({
              position: 0,
              duration: slots[i].getTotalDuration(),
              adManager: this.name,
              ad: slots[i],
              streams: { mp4: '' },
              adType: amc.ADTYPE.LINEAR_VIDEO,
            }));
            break;
          case tv.freewheel.SDK.TIME_POSITION_CLASS_MIDROLL:
            timeline.push(new amc.Ad({
              position: slots[i].getTimePosition(),
              duration: slots[i].getTotalDuration(),
              adManager: this.name,
              ad: slots[i],
              streams: { mp4: '' },
              adType: amc.ADTYPE.LINEAR_VIDEO,
            }));
            break;
          case tv.freewheel.SDK.TIME_POSITION_CLASS_POSTROLL:
            timeline.push(new amc.Ad({
              position: Number.MAX_VALUE,
              duration: slots[i].getTotalDuration(),
              adManager: this.name,
              ad: slots[i],
              streams: { mp4: '' },
              adType: amc.ADTYPE.LINEAR_VIDEO,
            }));
            break;
          case tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY:
            timeline.push(new amc.Ad({
              position: slots[i].getTimePosition(),
              duration: slots[i].getTotalDuration(),
              adManager: this.name,
              ad: slots[i],
              adType: amc.ADTYPE.NONLINEAR_OVERLAY,
            }));
            break;
          default:
          // do nothing
        }
      }
    };

    /**
     * Called when the Freewheel ad xml request has completed.  If the result was success, read the ad slots.
     * Declare that the ad manager is ready for use by setting this.ready=true.
     * @private
     * @method Freewheel#fw_onAdRequestComplete
     * @param {object} event The requestComplete event indicating success or failure
     */
    const fw_onAdRequestComplete = (event) => {
      // clear ad request timeout since fw_onAdRequestComplete was called
      _clearAdRequestTimeout();
      if (event.success) {
        slots = fwContext.getTemporalSlots();
        // TODO: Make sure to process these?
        // if (!!event && event.response && event.response.ads && event.response.ads.ads) {
        _prepareTimeline();
        amc.appendToTimeline(timeline);
      } else {
        OO.log('FW: freewheel metadata request failure');
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
    this.buildTimeline = () => {
      timeline = [];
      return [new amc.Ad({
        position: 0,
        duration: 0,
        adManager: this.name,
        ad: {},
        adType: amc.ADTYPE.AD_REQUEST,
      })];
    };

    const _resetAdState = () => {
      handlingClick = false;
      currentPlayingSlot = null;
      currentAd = null;
    };

    const _cancelCurrentAd = () => {
      if (currentAd === null) return;
      if ((currentAd.adType === amc.ADTYPE.AD_REQUEST)
          || (typeof (currentPlayingSlot.getCustomId) !== 'function')) {
        _resetAdState();
        return;
      }

      const id = currentPlayingSlot.getCustomId();
      const timePosition = currentPlayingSlot.getTimePositionClass();
      if (isFunction(currentPlayingSlot.stop)) {
        // This causes currentPlayingSlot to be set to null
        currentPlayingSlot.stop();
      }

      // Reset the ad manager ui registration after playing a nonlinear ad
      if (timePosition === tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY) {
        _registerDisplayForLinearAd();
      }

      // Call callbacks
      if (isFunction(slotStartedCallbacks[id])) {
        slotStartedCallbacks[id]();
        delete slotStartedCallbacks[id];
      }
      if (isFunction(slotEndedCallbacks[id])) {
        slotEndedCallbacks[id]();
        delete slotEndedCallbacks[id];
      }
      delete adStartedCallbacks[id];
      delete adEndedCallbacks[id];

      _resetAdState();
    };

    /**
     * Called by the ad manager controller.  Cancels an ad if the ad passed in is the currently playing ad.
     * @public
     * @method Freewheel#cancelAd
     * @param {object} ad The ad to cancel
     */
    this.cancelAd = (ad) => {
      // Only cancel the ad if it's current
      if (ad && ad.ad && currentPlayingSlot
        && (ad.adType === amc.ADTYPE.AD_REQUEST
          || currentPlayingSlot.getCustomId() === ad.ad.getCustomId())) {
        _cancelCurrentAd();
      }
    };

    const onContentChanged = () => {
      // On Content Changed, need to dispose the context
      // if (fwContext && isFunction(fwContext.dispose)) fwContext.dispose();
    };

    /**
     * Notifies Freewheel of a size change.
     * @private
     * @method Freewheel#notifySizeChange
     */
    const notifySizeChange = () => {
      // Freewheel SDK uses setContentVideoElement and registerVideoDisplayBase for size
      // change notifications for the main content and ad content respectively.
      // _registerDisplayForLinearAd calls registerVideoDisplayBase and
      // _registerDisplayForNonlinearAd calls setContentVideoElement, so we'll call
      // these here
      if (currentPlayingSlot) {
        if (currentPlayingSlot.getTimePositionClass() !== tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY) {
          _registerDisplayForLinearAd();
        } else {
          _registerDisplayForNonlinearAd();
        }
      }
    };

    const updateOverlayPosition = () => {
      // Overlay placement issue - PBI-1227 as of 12/9/2015
      // The main issue with Freewheel is when notifying their SDK of video size changes,
      // Freewheel only attempts to resize ads and not re-position ads.
      // In the Freewheel SDK, overlay ads do not have a resize function and thus nothing happens.

      // We want to force the renderer to reposition the overlay ads. The Freewheel SDK has functions
      // that accomplish this, but are undocumented.
      if (currentPlayingSlot && currentAd && !currentAd.isLinear && !this.testMode) {
        // Update Freewheel of size changes. At this point Freewheel will attempt to resize any ads
        notifySizeChange();
      }
    };

    const onResize = () => {
      updateOverlayPosition();
    };

    /**
     * Triggers a "click" on the currently playing ad.  This is currently used for testing purposes.
     * @public
     * @method Freewheel#playerClicked
     */
    this.playerClicked = () => {
      if (currentAd && (currentAd.adType !== amc.ADTYPE.AD_REQUEST)) {
        const instance = currentPlayingSlot.getCurrentAdInstance();
        // handlingClick makes sure the click is only triggered once, rather than repeatedly in a loop.
        if (!handlingClick) {
          handlingClick = true;
          // NOTE: The below is more correct but is returning an empty array.  FW bug?
          // if (instance.getEventCallbackUrls(tv.freewheel.SDK.EVENT_AD_CLICK, tv.freewheel.SDK.EVENT_TYPE_CLICK).length > 0) {
          const callback = instance.getEventCallback(
            tv.freewheel.SDK.EVENT_AD_CLICK,
            tv.freewheel.SDK.EVENT_TYPE_CLICK,
          );
          if (callback && callback._url) {
            instance.getRendererController().processEvent({ name: tv.freewheel.SDK.EVENT_AD_CLICK });
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
    this.cancelOverlay = (currentAd) => {
      // Consider instead, hiding the span with _fw_ad_container_html
      this.cancelAd(currentAd);
    };

    /**
     * This function is called by the ad manager controller when the main video element comes into focus.
     * @private
     * @method Freewheel#onMainContentInFocus
     */
    const onMainContentInFocus = () => {
      // The Freewheel SDK does not like when the video elements passed in via _registerDisplayForLinearAd
      // and _registerDisplayForNonlinearAd have display set to none. This causes overlays to not
      // be positioned and sized correctly (PBI-1307). When we get notified that the main video content
      // is in focus, we need update the overlay position.
      // Note: Updating overlay position uses undocumented methods and may break at any time. Also, simply
      // notifying the SDK via _registerDisplayForNonlinearAd does not appear to be sufficient at this time
      updateOverlayPosition();
    };

    const setupAdsWrapper = () => {
      if (freeWheelCompanionAdsWrapper) {
        freeWheelCompanionAdsWrapper.style.display = '';
      }
    };

    /**
     * Called when the first playback is requested against the player.
     * Show the companion ads wrapper.
     * @private
     * @method Freewheel#onPlayRequested
     */
    const onPlayRequested = () => {
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
    const onReplayRequested = () => {
      _resetAdState();
      shouldRequestAds = true;
      setupAdsWrapper();
    };

    /**
     * Called when the video is played initially.  Sets the video state with Freewheel.
     * @private
     * @method Freewheel#onPlay
     */
    const onPlay = () => {
      if (!fwContext || !isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_PLAYING);
    };

    /**
     * Called when the video is paused.  Sets the video state with Freewheel.
     * @private
     * @method Freewheel#onPause
     */
    const onPause = () => {
      if (!fwContext || !isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_PAUSED);
    };

    /**
     * Called when the video is resumed after being paused.  Sets the video state with Freewheel.
     * @private
     * @method Freewheel#onResume
     */
    const onResume = () => {
      if (!fwContext || !isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_PLAYING);
    };

    /**
     * Called when the video is completed.  Sets the video state with Freewheel.
     * @private
     * @method Freewheel#onContentCompleted
     */
    const onContentCompleted = () => {
      if (!fwContext || !isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_STOPPED);
    };

    /**
     * Called when the video and all ads are completed.  Sets the video state with Freewheel.
     * Hides the companion ads wrapper.
     * @private
     * @method Freewheel#onAllCompleted
     */
    const onAllCompleted = () => {
      if (!fwContext || !isFunction(fwContext.setVideoState)) return;
      fwContext.setVideoState(tv.freewheel.SDK.VIDEO_STATE_COMPLETED);

      if (freeWheelCompanionAdsWrapper) {
        freeWheelCompanionAdsWrapper.style.display = 'none';
      }
    };

    /**
     * Called by Freewheel js when an ad is clicked.  Raises the event with the ad manager controller by
     * calling "adsClicked".
     * @private
     * @method Freewheel#fw_onAdClick
     */
    const fw_onAdClick = () => {
      // handlingClick makes sure the click is only triggered once, rather than repeatedly in a loop.
      if (!handlingClick) {
        handlingClick = true;
        OO.log('FW: The ad was clicked!');
        amc.adsClicked();
      } else {
        handlingClick = false;
      }

      amc.adsClickthroughOpened();

      // Exit full screen to open the link?
      // amc.changeFullscreen(false);
    };

    /**
     * Called when an ad impression begins.  Calls the callback from the ad manager controller to indicate
     * that the ad impression has begun.
     * @private
     * @method Freewheel#fw_onAdImpression
     * @param {object} event The ad impression object indicating which ad started
     */
    const fw_onAdImpression = (event) => {
      indexInPod += 1;
      if (!event || !event.adInstance) {
        return;
      }
      const { adInstance } = event;
      const adSlot = adInstance.getSlot();
      const slotCustomId = (adSlot ? adSlot.getCustomId() : '') || event.slotCustomId;

      if (isFunction(adStartedCallbacks[slotCustomId])) {
        const clickEvents = filter(adInstance._eventCallbacks, callback => callback._name === 'defaultClick');
        const hasClickUrl = clickEvents.length > 0;
        const activeCreativeRendition = adInstance.getActiveCreativeRendition();
        adStartedCallbacks[slotCustomId]({
          name: activeCreativeRendition.getPrimaryCreativeRenditionAsset().getName(),
          duration: adInstance._creative.getDuration(),
          hasClickUrl,
          indexInPod,
          skippable: false,
          width: activeCreativeRendition.getWidth(),
          height: activeCreativeRendition.getHeight(),
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
    const fw_onAdImpressionEnd = (event) => {
      // FW has an issue where it resets the html5 video element's volume and muted attributes according to
      // FW's internal volume/mute state when moving to the next ad in an ad pod (but not the first ad in an ad pod).
      // This will break playback if muted autoplay is required and FW unmutes the video element. This internal state
      // is usually set with the setAdVolume API. We currently do not support any video plugin to ad plugin communication,
      // so the following is a workaround where we get the ad video element's muted state/volume and call setAdVolume
      // based on these values
      if (amc && amc.ui && amc.ui.adVideoElement && amc.ui.adVideoElement[0]) {
        if (amc.ui.adVideoElement[0].muted) {
          fwContext.setAdVolume(0);
        } else {
          fwContext.setAdVolume(amc.ui.adVideoElement[0].volume);
        }
      }
      // TODO: inspect event for playback success or errors
      if (isFunction(adEndedCallbacks[event.adInstance.getSlot().getCustomId()])) {
        adEndedCallbacks[event.adInstance.getSlot().getCustomId()]();
      }
    };

    /**
     * Called when an ad slot has begun.  Removes native player controls.
     * @private
     * @method Freewheel#fw_onSlotStarted
     */
    const fw_onSlotStarted = () => {
      // adVideoElement may be null for overlays
      if (currentPlayingSlot
          && currentPlayingSlot.getTimePositionClass() !== tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY
          && amc && amc.ui && amc.ui.adVideoElement) {
        amc.ui.adVideoElement.removeAttr('controls');
      }

      // cancel timeout on load
      if (isFunction(slotStartedCallbacks[currentPlayingSlot.getCustomId()])) {
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
    const fw_onSlotEnded = (event) => {
      // Disable controls on the video element.  Freewheel seems to be turning it on
      // TODO: inspect event for playback success or errors

      // adVideoElement may be null for overlays
      if (currentPlayingSlot
          && currentPlayingSlot.getTimePositionClass() !== tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY
          && amc && amc.ui && amc.ui.adVideoElement) {
        amc.ui.adVideoElement.attr('controls', false);
      }

      if (currentPlayingSlot
          && currentPlayingSlot.getTimePositionClass() === tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY) {
        _registerDisplayForLinearAd();
      }

      if (!event || !event.slot) return;
      _resetAdState();
      if (isFunction(slotEndedCallbacks[event.slot.getCustomId()])) {
        slotEndedCallbacks[event.slot.getCustomId()]();
      }
      delete slotEndedCallbacks[event.slot.getCustomId()];
      delete adStartedCallbacks[event.slot.getCustomId()];
      delete adEndedCallbacks[event.slot.getCustomId()];
    };

    /**
     * Sends a request to Freewheel which returns the list of ads to play
     * @private
     * @method Freewheel#_sendFreewheelRequest
     */
    const _sendFreewheelRequest = () => {
      if (!adModuleJsReady) return;
      shouldRequestAds = false;

      // If Freewheel SDK isn't properly loaded by the JS, unregister
      if (typeof (tv) === 'undefined') {
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
        each(FRMSegment.split(';'), (segment) => {
          segment = segment.split('=');
          fwContext.addKeyValue(segment[0], segment[1]);
        });
      }

      // Listen to AdManager Events
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_AD_IMPRESSION, fw_onAdImpression);
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_AD_IMPRESSION_END, fw_onAdImpressionEnd);
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_SLOT_STARTED, fw_onSlotStarted);
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_SLOT_ENDED, fw_onSlotEnded);
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_REQUEST_COMPLETE, fw_onAdRequestComplete);
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_AD_CLICK, fw_onAdClick);
      fwContext.addEventListener(tv.freewheel.SDK.EVENT_ERROR, fw_onError);

      // To make sure video ad playback in poor network condition, set video ad timeout parameters.
      fwContext.setParameter(
        tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_START_DETECT_TIMEOUT,
        10000,
        tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL,
      );
      fwContext.setParameter(
        tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_PROGRESS_DETECT_TIMEOUT,
        10000,
        tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL,
      );
      fwContext.setParameter(
        tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_DISPLAY_CONTROLS_WHEN_PAUSE,
        false,
        tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL,
      );
      fwContext.setParameter(
        tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_CLICK_DETECTION,
        true,
        tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL,
      );

      if (bitrateOverride) {
        fwContext.setParameter(
          tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE,
          bitrateOverride,
          tv.freewheel.SDK.PARAMETER_LEVEL_OVERRIDE,
        );
      }

      if (OO.requiresSingleVideoElement) {
        // NOTE: If we set renderer.html.coadScriptName we can probably render overlays on our own
        //       (coad stands for customer owned ad renderer)
        let controlHeight = amc.ui.rootElement.find('.controlBar');
        controlHeight = (controlHeight.length === 0)
          ? 60
          : controlHeight.height() + OO.CONSTANTS.CONTROLS_BOTTOM_PADDING;
        fwContext.setParameter(
          tv.freewheel.SDK.PARAMETER_RENDERER_HTML_MARGIN_HEIGHT,
          controlHeight,
          tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL,
        );
      } else {
        // if we can integrate the overlay with Alice, we do not want to add margin height as it will
        // fit properly within the player skin plugins div without being covered by the control bar
        fwContext.setParameter(
          tv.freewheel.SDK.PARAMETER_RENDERER_HTML_MARGIN_HEIGHT,
          0,
          tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL,
        );
      }

      fwContext.submitRequest();
      _setAdRequestTimeout(_adRequestTimeout, amc.MAX_AD_REQUEST_TIMEOUT);
    };

    /**
     * Called by the ad manager controller.  Plays an ad or triggers a the freewheel request for the list of ads.
     * @public
     * @method Freewheel#playAd
     * @param {object} ad The ad to play
     */
    this.playAd = (ad) => {
      _resetAdState();
      try {
        if (ad.adType === amc.ADTYPE.AD_REQUEST) {
          if (shouldRequestAds) {
            // Trigger the request for the list of ads;
            indexInPod = 0;
            amc.notifyPodStarted(ad.id, 1);
            slotEndedCallbacks[amc.ADTYPE.AD_REQUEST] = () => { amc.notifyPodEnded(ad.id); };
            _sendFreewheelRequest();
          } else {
            amc.notifyPodStarted(ad.id, 1);
            amc.notifyPodEnded(ad.id);
          }
        } else {
          // Trigger the ad
          currentAd = ad;
          currentPlayingSlot = ad.ad;
          indexInPod = 0;
          if (ad.isLinear) {
            _registerDisplayForLinearAd();
            fwContext.setParameter(
              tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_CLICK_DETECTION,
              false,
              tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL,
            );
            slotStartedCallbacks[ad.ad.getCustomId()] = () => {
              amc.focusAdVideo();
            };
            slotEndedCallbacks[ad.ad.getCustomId()] = () => {
              amc.notifyPodEnded(ad.id);
            };
            adStartedCallbacks[ad.ad.getCustomId()] = (details) => {
              // We need to remove the fake video element so that Alice
              // can properly render the UI for a linear ad
              if (fakeVideo && overlayContainer) {
                overlayContainer.removeChild(fakeVideo);
                fakeVideo = null;
              }
              if (indexInPod <= 1) {
                amc.notifyPodStarted(ad.id, ad.ad.getAdCount());
              }
              amc.notifyLinearAdStarted(ad.id, details);
            };
            adEndedCallbacks[ad.ad.getCustomId()] = () => {
              amc.notifyLinearAdEnded(ad.od);
            };
            // Freewheel has a limitation where it is not possible to skip a single ad in a pod.
            // Until this is resolved, we will only show the skip button for ad pods of size 1.
            if (currentPlayingSlot.getAdCount() === 1) {
              amc.showSkipVideoAdButton(true);
            } else {
              amc.showSkipVideoAdButton(false);
            }
          } else {
            _registerDisplayForNonlinearAd();
            fwContext.setParameter(
              tv.freewheel.SDK.PARAMETER_RENDERER_VIDEO_CLICK_DETECTION,
              true,
              tv.freewheel.SDK.PARAMETER_LEVEL_GLOBAL,
            );
            adStartedCallbacks[ad.ad.getCustomId()] = (details) => {
              // provide width and height values if available. Alice will use these to resize
              // the skin plugins div when a non linear overlay is on screen
              if (details) {
                ad.width = details.width;
                ad.height = details.height;
                // the width and height of the fake video must be equal
                // to or greater than the size of the overlay creative
                // or else FW won't display it
                if (fakeVideo) {
                  fakeVideo.style.width = `${details.width}px`;
                  fakeVideo.style.height = `${details.height}px`;
                }

                updateOverlayPosition();
              }
              amc.sendURLToLoadAndPlayNonLinearAd(ad, ad.id, null);
            };

            adEndedCallbacks[ad.ad.getCustomId()] = () => {
              if (fakeVideo && overlayContainer) {
                overlayContainer.removeChild(fakeVideo);
                fakeVideo = null;
              }
              amc.notifyNonlinearAdEnded(ad.id);
            };
            delete slotStartedCallbacks[ad.ad.getCustomId()];
            delete slotEndedCallbacks[ad.ad.getCustomId()];
          }
          ad.ad.play();
        }
      } catch (err) {
        indexInPod = 0;
        amc.notifyPodStarted(ad.id, 1);
        amc.raiseAdError(`Ad could not be played.  ${err}`);
        amc.notifyPodEnded(ad.id);
      }
    };

    /**
     * Initializes the class by registering the ad manager controller.
     * Adds listeners to Ooyala player events.
     * @public
     * @method Freewheel#initialize
     * @param {object} amcIn A reference to the ad manager controller instance
     */
    this.initialize = (amcIn) => {
      amc = amcIn;
      amc.addPlayerListener(amc.EVENTS.INITIAL_PLAY_REQUESTED, onPlayRequested);
      amc.addPlayerListener(amc.EVENTS.REPLAY_REQUESTED, onReplayRequested);
      amc.addPlayerListener(amc.EVENTS.PLAY_STARTED, onPlay);
      amc.addPlayerListener(amc.EVENTS.PAUSE, onPause);
      amc.addPlayerListener(amc.EVENTS.RESUME, onResume);
      amc.addPlayerListener(amc.EVENTS.CONTENT_COMPLETED, onContentCompleted);
      amc.addPlayerListener(amc.EVENTS.CONTENT_AND_ADS_COMPLETED, onAllCompleted);
      amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, onContentChanged);
      amc.addPlayerListener(amc.EVENTS.SIZE_CHANGED, onResize);
      amc.addPlayerListener(amc.EVENTS.MAIN_CONTENT_IN_FOCUS, onMainContentInFocus);
    };

    // Getters

    /**
     * Returns whether player is handling click.
     * @public
     * @method Freewheel#getHandlingClick
     * @returns {boolean} true if player is handling click. Returns false, if otherwise.
     */
    this.getHandlingClick = () => handlingClick;

    /**
     * Cancel the current ad, reset the state variables, dispose the remote Freewheel class.
     * @public
     * @method Freewheel#destroy
     */
    this.destroy = () => {
      _cancelCurrentAd();
      _clearAdRequestTimeout();

      // state
      this.ready = false;
      adModuleJsReady = false;
      _resetAdState();

      // data
      remoteModuleJs = null;
      videoAssetId = null;
      networkId = null;
      profileId = null;
      siteSectionId = null;
      adServerURL = null;
      FRMSegment = null;
      slots = [];

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

      if (fwContext && isFunction(fwContext.dispose)) fwContext.dispose();
    };
  };

  return new Freewheel();
});
