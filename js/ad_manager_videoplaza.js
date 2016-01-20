/*
 * Ad Manager for Ooyala Ad Tech.
 * This file can be used to model a new ad manager for the Ooyala HTML5 player.
 *
 * version 0.1
 */

OO.Ads.manager(function(_, $) {
  /**
   * @class OoyalaAdTech
   * @classDesc The main Ad Manager class for Ooyala ad tech.
   * @public
   * @property {string} name The name of the ad manager. This should match the name used by the server to
   *                         provide metadata.
   * @property {object} amc A reference to the Ad Manager Controller received when the initialize function
   *                        is called.
   * @property {boolean} ready True if the ad manager has loaded the metadata for all ads to play with the
   *                           current video.
   * @property {object} quartileTracks Used to keep track of what quartiles we need to alert the sdk when it has been
   *                                  reached.
   * @property {object} lastVideoAd Keeps track of the last video ad that was played or currently playing.
   * @property {object} tracker Used to keep track of the tracker object sent from the SDK. Used to send tracking info
   *                            to the sdk.
   * @property {boolean} adModuleJsReady Set to true when the sdk is loaded successfully otherwise it is false. If false
   *                                     when it tries to get the sdk data, it will destroy the ad manager.
   * @property {number} overlayTimer Keeps track of the timer object that was created for the overlay.
   * @property {number} timerRemainingTime The amount of seconds left in the timer when it is paused and resumed.
   * @property {number} timerStartTime The amount in seconds that the timer was started at.
   * @property {number} overlayTimeoutTime Used to keep track of the overlay timer override that was set by a param.
   */
  var OoyalaAdTech = function() {
    this.name = "videoplaza-ads-manager";
    this.amc  = null;
    this.ready  = false;
    this.quartileTracks = new Object();
    this.lastVideoAd = null;
    this.tracker = null;
    this.adModuleJsReady = false;
    this.overlayTimer;
    this.timerRemainingTime;
    this.timerStartTime;
    this.overlayTimeoutTime = null;
    var adCompletedCallback = null;

    /**
     * Called by the Ad Manager Controller.  Use this function to initialize, create listeners, and load
     * remote JS files.
     * @method OoyalaAdTech#initialize
     * @public
     * @param {object} amc A reference to the Ad Manager Controller.
     */
    this.initialize = function(amc) {
      this.amc = amc;

      // Add any player event listeners now
      this.amc.addPlayerListener(this.amc.EVENTS.FULLSCREEN_CHANGED, _.bind(onFullscreenChanged, this));
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, all movie and server metadata are
     * ready to be parsed.
     * This metadata may contain the adTagUrl and other ad manager and movie specific configuration.
     * @method OoyalaAdTech#loadMetadata
     * @public
     * @param {object} adManagerMetadata Ad manager specific metadata.
     * @param {object} backlotBaseMetadata Base metadata from Ooyala Backlot.
     * @param {object} movieMetadata Metadata for the main video.
     */
    this.loadMetadata = function(adManagerMetadata, backlotBaseMetadata, movieMetadata) {
      if (!adManagerMetadata || !adManagerMetadata["vpDomain"]) {
        OO.log("Ooyala Ad Tech:: Error vpDomain has not been set, killing ad manager.")
        this.destroy();
        return;
      }
      var vpDomain = adManagerMetadata["vpDomain"];
      var remoteModuleJs = vpDomain + "/proxy/html5-sdk/2/latest/plugin.min.js";
      var durationOfMovieInSecs = movieMetadata.duration/1000;
      var adTags = adManagerMetadata["playerLevelTags"].split(',');
      var linearAdBreaks = adManagerMetadata["playerLevelCuePoints"].split(',').map(Number);
      var flags = adManagerMetadata["playerLevelFlags"].split(',');
      var nonLinearAdBreaks = adManagerMetadata["nonLinearAdBreaks"].split(',').map(Number);

      //TODO:SEND TO SDK
      var longFormLimit = parseInt(adManagerMetadata["longFormLimit"]);
      var playerLevelShares = adManagerMetadata["playerLevelShares"].split(',');

      var contentMetadata = {
        duration: durationOfMovieInSecs,
        flags: flags,
        tags: adTags
      };
      var requestSettings = {
        width: 640,
        height: 480,
        linearPlaybackPositions: linearAdBreaks,
        nonlinearPlaybackPositions: nonLinearAdBreaks
      };

      if (adManagerMetadata["overlayTimeoutTime"] != null) {
        this.overlayTimeoutTime = adManagerMetadata["overlayTimeoutTime"];
      }
      // Loads a remote file.  Use this function to load the client SDK for your ad module.
      this.amc.loadAdModule(this.name, remoteModuleJs, _.bind(function(success) {
        this.adModuleJsReady = success;
        this.doSDKRequestForData(contentMetadata, requestSettings, vpDomain);
      }, this));
    };

    /**
     * The Ad Manager needs to load the sdk and create a session. If the session is successfully created it can start
     * getting ad info. If it fails we need to display a message and move on.
     * @method OoyalaAdTech#doSDKRequestForData
     * @public
     * @param contentMetadata Metadata set from backlot and page level.
     * @param requestSettings The settings that were setup to send to the sdk to prepare ad data.
     * @param vpDomain The domain of which account contains the ad data.
     */
    this.doSDKRequestForData = function(contentMetadata, requestSettings, vpDomain) {
      if (!this.adModuleJsReady || !videoplaza ) {
        this.destroy();
        return;
      }
      var adRequester = new videoplaza.adrequest.AdRequester(vpDomain, {});

      // Called when a session is successfully retrieved and parsed from Karbon
      var sessionReceived = function(session) {
        // Now the session object is available for inspection
        getAdsForTimeline(session);
      };

      // Called when an error occurs during the request or parsing
      var sessionRequestFailed = _.bind(function(message) {
        OO.log('Session request failed! ' + message);
        this.destroy();
      },this);

      var sessionLoadingLog = function(logItem) {
        OO.log("adRequester:: " + logItem.message);
      };
      adRequester.addLogListener(sessionLoadingLog);
      this.ready = true;
      // Perform the actual request
      adRequester.requestSession(contentMetadata, requestSettings, sessionReceived, sessionRequestFailed);
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, the ui has been setup and the values
     * in this.amc.ui are ready to be used.
     * @method OoyalaAdTech#registerUi
     * @public
     */
    this.registerUi = function() {
      // this.amc.ui.adVideoElement is now ready for use
    };

    /**
     * Once the Ad Manager has a successful session it will parse the data and start building the ad timeline.
     * @method OoyalaAdTech#getAdsForTimeline
     * @private
     * @param session The active session that contains the ad data and infomation sent by the SDK from Karban.
     */
    var getAdsForTimeline = _.bind(function(session) {
      if (!session) {
        this.destroy();
        return;
      }
      OO.log('Session request success');
      this.tracker = new videoplaza.tracking.Tracker();
      //Register a log function for outputting errors and info from the Tracker:
      this.tracker.addLogListener(function(logItem){
        OO.log(logItem.message);
      });
      var timeline = [];
      for (var i = 0; i < session.insertionPoints.length; i++) {
        for (var s = 0; s < session.insertionPoints[i].slots.length; s++) {
          for (var a = 0; a < session.insertionPoints[i].slots[s].ads.length; a++) {
            var ad = session.insertionPoints[i].slots[s].ads[a];
            if (ad && ad.type != "inventory") {
              var type;
              var streams = {};
              if (ad.creatives && ad.creatives.length > 0 && ad.creatives[0].type == "video"){
                type = this.amc.ADTYPE.LINEAR_VIDEO;
                if (!_.isEmpty(ad.creatives[0].mediaFiles)) {
                  var vpStreams = ad.creatives[0].mediaFiles;
                  var videoEncodingsSupported = OO.VIDEO.ENCODING;
                  var streamData = null;
                  for (var encoding in videoEncodingsSupported) {
                    streamData = null;
                    streamData = this._extractStreamForType(vpStreams, videoEncodingsSupported[encoding]);
                    if (streamData) {
                      streams[videoEncodingsSupported[encoding]] = streamData;
                    }
                  }
                  if (ad.streamUrl != null ||  !_.isEmpty(streams)) {
                    ad.streams = streams;
                  }
                  ad.clickThrough = ad.creatives[0].clickThroughUrl;
                }
              } else if (ad.creatives && ad.creatives.length > 0 && ad.creatives[0].type == "banner") {
                type = this.amc.ADTYPE.NONLINEAR_OVERLAY;
                if (!_.isEmpty(ad.creatives[0].resources)) {
                  ad.streamUrl = ad.creatives[0].resources[0].url;
                  if (ad.creatives[0].resources[0].clickThroughUrl) {
                    ad.clickThrough = ad.creatives[0].resources[0].clickThroughUrl;
                  }
                }
              } else if (!ad.creatives || ad.creatives.length <= 0) {
                OO.log("No creative file found on the ad XML")
              }
              var timeToPlay;
              if (session.insertionPoints[i].conditions[0].type == videoplaza.adrequest.AdRequester.InsertionPointType.ON_BEFORE_CONTENT)
              {
                timeToPlay = 0;
              }
              else if (session.insertionPoints[i].conditions[0].type == videoplaza.adrequest.AdRequester.InsertionPointType.PLAYBACK_POSITION)
              {
                timeToPlay = session.insertionPoints[i].conditions[0].value;
              }
              else if (session.insertionPoints[i].conditions[0].type == videoplaza.adrequest.AdRequester.InsertionPointType.ON_CONTENT_END)
              {
                timeToPlay = Number.MAX_VALUE;
              }
              var duration = ad.creatives[0].duration; //TODO support multiple creatives potentially.
              timeline.push(new this.amc.Ad({
                position: timeToPlay, duration: duration, adManager: this.name,
                ad: ad, adType: type, streams: streams
              }));
            } else if (ad) {
              this.tracker.reportError(ad, videoplaza.tracking.Tracker.AdError.NO_AD);
              OO.log("Inventory Ad found and reported, no ad to play.");
            } else {
              OO.log("Ooyala Ad Tech: No Ad found");
            }
          }
        }
      }
      this.amc.appendToTimeline(timeline);
    }, this);

    /**
     * Extracts the creative based on the format type that is expected.
     * @public
     * @method Vast#_extractStreamForType
     * @param {object} streams The stream choices from the metadata.
     * @param {string} type The type of video we want to use for the creative.
     * @returns {string} The creative url if it finds one, otherwise null.
     */
    this._extractStreamForType = function(streams, type) {
      var filter = [];
      filter.push("video/" +type);
      var stream = _.find(streams, function(v) { return (filter.indexOf(v.type) >= 0); }, this);
      return stream ? stream.url : null;
    };

    /**
     * Called by Ad Manager Controller.  This function asks the ad manager to pass a list of all ads to the
     * ad manager for addition in the timeline.
     * The duration and position of each ad should be specified in milliseconds.
     * NOTE: Currently not used by Ooyala Ad Tech.
     * @method OoyalaAdTech#buildTimeline
     * @public
     * @returns Null as it is not used for Ad Tech ads.
     */
    this.buildTimeline = function() {
      return null;
    };

    /**
     * Extracts the creative based on the format type that is expected.
     * @public
     * @method OoyalaAdTech#_extractStreamForType
     * @param {object} streams The stream choices from the metadata.
     * @param {string} type The type of video we want to use for the creative.
     * @returns {string} The creative url if it finds one, otherwise null.
     */
    this._extractStreamForType = function(streams, type) {
      // TODO, also cap on bitrate and width/height if there is any device restriction.
      var filter = [];
      switch (type) {
        case "webm":
          filter.push("video/webm");
          break;
        case "mp4":
          filter.push("video/mp4");
          if (OO.isIos) { filter.push("video/quicktime"); }
          break;
      }
      var stream = _.find(streams, function(v) { return (filter.indexOf(v.mimeType) >= 0); }, this);
      return stream ? stream.url : null;
    };

    /**
     * When the ad is finished playing we need to call the AMC callback that was provided to let the AMC know that the
     * ad is finished playing.
     * @public
     * @method OoyalaAdTech#adVideoEnded
     */
    this.adVideoEnded = function() {
      this.tracker.trackEvent(this.lastVideoAd.ad.creatives[0], videoplaza.tracking.Tracker.CreativeEventType.COMPETE);
      if(typeof adCompletedCallback === "function") {
        adCompletedCallback();
        adCompletedCallback = null;
      }
    };

    /**
     * When the ad fails to play we need to call the AMC callback that was provided to let the AMC know that the
     * ad is finished playing and we need to follow the process for cleaning up after an ad fails.
     * @public
     * @method OoyalaAdTech#adVideoError
     */
    this.adVideoError = function() {
      this.adVideoEnded();
      // VTC will pause the ad when the video element loses focus
      cancelAd(null);
    };

    /**
     * Checks if there is any companion ads associated with the ad and if one is found, it will call the Ad Manager
     * Controller to show it.
     * @public
     * @method OoyalaAdTech#checkCompanionAds
     * @param {object} adInfo The Ad metadata.
     */
    this.checkCompanionAds = function(adInfo) {
      if (_.isNull(adInfo) || _.isEmpty(adInfo.companions)) {
        return;
      }
      this.amc.showCompanion(adInfo.companions);
    };

    /**
     * Checks if the ad has reached a quartile based on the duration of ad and current time. If it has reached a quartile
     * then it will track it and inform the sdk.
     * @public
     * @method OoyalaAdTech#trackQuartiles
     * @param {object} ad The Ad metadata.
     * @param {number} duration The total duration of the ad.
     * @param {number} time The current playhead time of the ad.
     */
    this.trackQuartiles = function(ad, duration, time)
    {
      if (!ad || !ad.ad || !ad.ad.creatives) {
        return;
      }
      var creative = ad.ad.creatives[0];
      if ((!this.quartileTracks || !this.quartileTracks["thirdQuartile"]) && time > duration * 0.75) {
        this.tracker.trackEvent(creative, videoplaza.tracking.Tracker.CreativeEventType.THIRD_QUARTILE);
        this.quartileTracks["thirdQuartile"] = true; // Set to true in order to prevent tracking more then once.
      } else if ((!this.quartileTracks || !this.quartileTracks["midpoint"]) && time > duration * 0.50) {
        this.tracker.trackEvent(creative, videoplaza.tracking.Tracker.CreativeEventType.MIDPOINT);
        this.quartileTracks["midpoint"] = true; // Set to true in order to prevent tracking more then once.
      } else if ((!this.quartileTracks || !this.quartileTracks["firstQuartile"]) && time > duration * 0.25) {
        this.tracker.trackEvent(creative, videoplaza.tracking.Tracker.CreativeEventType.FIRST_QUARTILE);
        this.quartileTracks["firstQuartile"] = true; // Set to true in order to prevent tracking more then once.
      }
    };

    /**
     * Once the overlay image has loaded, it is time to add it to the screen. Also the Ad Manager needs to be informed
     * that the ad has started playing.
     * @public
     * @method OoyalaAdTech#onOverlayImgLoaded
     * @param {object} adElement All the ad div container that was created.
     * @param {object} innerWrapper The inner wrapper layer
     * @param {function} adStartedCallback A callback that the Ad Manager Controller needs to have called when the ad is displayed.
     * @param {object} ad Contains the Ad's metadata for this ad that will be needed if the user clicks ont he ad.
     */
    this.onOverlayImgLoaded = function(adElement, innerWrapper, adStartedCallback, ad){
      //TODO:Update Function to work with Alice.
      //this.overlayDiv = OO.$("<div></div>");
      //this.overlayDiv.css({"display": "inline-block", "width": this.overlayImg.width, "height": this.overlayImg.height});
      //var imageTag = OO.$("<img>");
      //imageTag.click(_.bind(this.overlayOnClick, this));
      //imageTag.attr("src", this.overlayImg.src);
      //this.overlayDiv.append(imageTag);
      //adElement.append(this.overlayDiv);
      //this.amc.ui.pluginsElement.append(adElement);
      //this.setOverlayPadding();
      //this.checkCompanionAds(ad.ad);
      //if (adStartedCallback) {
      //  adStartedCallback();
      //}
      //if (this.overlayTimeoutTime != null && this.overlayTimeoutTime <= 0) {
      //  OO.log("Ooyala Adtech:: Overlay Timeout Timer overridden on page level.");
      //  return;
      //} else if (ad.duration > 0 || (this.overlayTimeoutTime && this.overlayTimeoutTime > 0)) {
      //  this.timerStartTime = (new Date()).getTime();
      //  clearTimeout(this.overlayTimer);
      //  this.lastOverlayAd = ad;
      //  var startTimeSecs = ad.duration;
      //  if (this.overlayTimeoutTime != null && this.overlayTimeoutTime > 0) {
      //    startTimeSecs = this.overlayTimeoutTime;
      //  }
      //  var startTimerTimeMS = startTimeSecs * 1000;
      //  this.timerRemainingTime = startTimerTimeMS;
      //  this.overlayTimer = setTimeout(_.bind(this.cancelAd, this), startTimerTimeMS);
      //}
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should play the ad or group of podded ads passed to
     * the function as a parameter.
     * @method OoyalaAdTech#playAd
     * @public
     * @param {object} ad The ad object to play.
     * @param {function} adPodStartedCallback Call this function when the ad or group of podded ads have
     *                                        started.
     * @param {function} adPodEndedCallback Call this function when the ad or group of podded ads have
     *                                      completed.
     * @param {function} adStartedCallback Call this function each time an ad in the set starts
     * @param {function} adEndedCallback Call this function each time an ad in the set completes
     */
    this.playAd = function(ad) {
      // When the ad impression has started or when the first ad in a set of podded ads has begun,  trigger
      //   adStartedCallback
      // When the ad or group of podded ads are done, trigger adEndedCallback
      // Each time an ad impression starts, trigger adStartedCallback
      // Each time an ad ends, trigger adEndedCallback
      OO.log("ad found! " + ad);
      // When the ad is done, trigger callback
      var ui = this.amc.ui;

      this.lastVideoAd = null;

      if (ad.isLinear) {
        this.lastVideoAd = ad;
        this.tracker.trackEvent(ad.ad.creatives[0], videoplaza.tracking.Tracker.CreativeEventType.START);
        this.amc.notifyPodStarted(ad.id, 1);
        adCompletedCallback = _.bind(function(amc, adId) {
          notifyAmcOfAdEnd(adId);
        }, this, this.amc, ad.id);
        this.checkCompanionAds(ad.ad);
        this.amc.showSkipVideoAdButton(true);
        var hasClickUrl = ad.ad.clickThrough.length > 0;
        this.amc.notifyLinearAdStarted(this.name, {
          name: ad.id,
          duration: ad.duration,
          hasClickUrl: hasClickUrl,
          indexInPod: 1,
          skippable: false
        });
      } else {
        var streamUrl;
        if (ad.ad && ad.ad.streamUrl) {
          streamUrl = ad.ad.streamUrl;
        }
        else if (ad.streamUrl) {
          streamUrl = ad.streamUrl;
        }
        this.amc.sendURLToLoadAndPlayNonLinearAd(ad, ad.id, streamUrl);
        this.checkCompanionAds(ad.ad);
      }
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should cancel the ad passed to the function as a
     * parameter.  After cancelling the ad, the ad manager should call the adEndedCallback to indicate that
     * ad cancellation has completed.  If the given ad is not currently playing and the adEndedCallback has
     * already been called, then no action is required.
     * @method OoyalaAdTech#cancelAd
     * @public
     * @param {object} ad The ad object to cancel.
     */
    this.cancelAd = function(ad) {
      if (!this.amc || !this.amc.ui) {
        return;
      }
      if (ad) {
        if (ad.isLinear) {
          // The VTC should pause the ad when the video element loses focus
          notifyAmcOfAdEnd(this.amc, ad.id)
        } else {
          this.lastOverlayAd = null;
          this.amc.notifyNonlinearAdEnded(ad.id);
        }
      }
    };

    /**
     * Notifies the amc that the ad has ended.
     * @method OoyalaAdTech#notifyAmcOfAdEnd
     * @private
     * @param {string} adId unique id that is given to the ad.
     */
    var notifyAmcOfAdEnd = _.bind(function(adId) {
      this.amc.notifyLinearAdEnded(adId);
      this.amc.notifyPodEnded(adId);
    },this);

    /**
     * Pauses the ad element.
     * @public
     * @method AdTech#pauseAd
     * @param {object} amcAd The current ad data.
     */
    this.pauseAd = function(amcAd) {
      // No code required here as VTC will pause the ad
    };

    /**
     * Resume the ad element.
     * @public
     * @method OoyalaAdTech#resumeAd
     * @param {object} amcAd The current ad data.
     */
    this.resumeAd = function(amcAd) {
      // No code required here as VTC will pause the ad
    };

    /**
     * When the Ad Manager Controller needs to hide the overlay it will call this function.
     * @public
     * @method OoyalaAdTech#hideOverlay
     * @param {object} currentAd The overlay ad object to be stored so when it is shown again, we can update the AMC.
     */
    this.hideOverlay = function(currentAd) {
      this.pauseOverlayTimer();
      this.lastOverlayAd = currentAd;
      var overlayContainer = this.amc.ui.rootElement.find(this.OVERLAY_AD_CONTAINER);
      if (overlayContainer) {
        overlayContainer.css('display', 'none');
      }
    };

    /**
     * This function gets called by the ad Manager Controller when an ad has completed playing. If the main video is
     * finished playing and there was an overlay displayed before the post-roll then it needs to be removed. If the main
     * video hasn't finished playing and there was an overlay displayed before the ad video played, then it will show
     * the overlay again.
     * @public
     * @method OoyalaAdTech#showOverlay
     */
    this.showOverlay = function() {
      //TODO: Update to work with Alice
      /*if (!this.amc.ended && this.lastOverlayAd) {
        if (overlayContainer) {
          this.unpauseOverlayTimer();
        }
      }
      else if (this.lastOverlayAd) {
        this.cancelAd(lastOverlayAd);
      }
      */
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should destroy itself.  It will be unregistered by
     * the Ad Manager Controller.
     * @method OoyalaAdTech#destroy
     * @public
     */
    this.destroy = function() {
      // Stop any running ads
      this.cancelAd(null);
    };

    /**
     * Called by the hide overlay function.  This function is used to pause the duration timer for the overlay.
     * This function is called when the overlay is being removed due to another ad appearing. It will clear out the
     * current timer, then take the time it currently is and subtract it from the start time to determine how much
     * time has passed. Once it has that time, it will take the reaming amount of time and subtract the difference.
     * @method OoyalaAdTech#pauseOverlayTimer
     * @public
     */
    this.pauseOverlayTimer = function() {
      if (this.overlayTimer) {
        clearTimeout(this.overlayTimer);
        var timeDifference = (new Date()).getTime() - this.timerStartTime;
        this.timerRemainingTime -= timeDifference;
      }
    };

    /**
     * Called by the show overlay function.  This function should be used to unpause the duration timer for the overlay.
     * This function is called when the overlay is going to be put back on the screen after another ad has finished.
     * @method OoyalaAdTech#unpauseOverlayTimer
     * @public
     */
    this.unpauseOverlayTimer = function() {
      if (this.overlayTimer) {
        this.timerStartTime = (new Date()).getTime();
        clearTimeout(this.overlayTimer);
        this.overlayTimer = setTimeout(_.bind(this.cancelAd, this), this.timerRemainingTime);
      }
    };

    /**
     * @private
     * When the user enters and exits fullscreen we need to track it and send it to the sdk.
     * @method OoyalaAdTech#onFullscreenChanged
     * @param {boolean} shouldEnterFullscreen True if entering fullscreen mode
     */
    var onFullscreenChanged = _.bind(function(shouldEnterFullscreen) {
      if (shouldEnterFullscreen) {
        this.tracker.trackEvent(this.lastVideoAd.ad.creatives[0], videoplaza.tracking.Tracker.CreativeEventType.FULLSCREEN);
      } else {
        this.tracker.trackEvent(this.lastVideoAd.ad.creatives[0], videoplaza.tracking.Tracker.CreativeEventType.EXIT_FULLSCREEN);
      }
    }, this);

    /**
     * Opens a new page pointing to the URL provided.
     * @public
     * @method OoyalaAdTech#openUrl
     * @param {string} url The url that we need to open in a new page.
     */
    this.openUrl = function(url) {
      if (!url) { return; }
      _.defer(function() { window.open(url); });
    };

    /**
     * Opens a page based on the clickthrough url when the user click on the Ad.
     * @public
     * @method OoyalaAdTech#playerClicked
     * @param {object} amcAd Ad wrapper that is sent from the Ad Manager Controller that contains the data.
     * @param {boolean} showPage If set to true then we show the page, if it is false then we don't show the page.
     */
    this.playerClicked = function(amcAd, showPage) {
      if (!showPage) {
        return;
      }
      var highLevelClickThroughUrl;
      if (amcAd && amcAd.ad && amcAd.ad.clickThrough) {
        highLevelClickThroughUrl = amcAd.ad.clickThrough;
      }
      if (highLevelClickThroughUrl) {
        this.openUrl(highLevelClickThroughUrl);
        this.tracker.trackEvent(amcAd.ad.creatives[0], videoplaza.tracking.Tracker.CreativeEventType.CLICKTHROUGH);
      }
    };

    /**
     * When the overlay is clicked playerClicked is called with the Ad's metadata.
     * @public
     * @method OoyalaAdTech#overlayOnClick
     */
    this.overlayOnClick = function() {
      this.amc.overlayClicked();
    };
  };

  return new OoyalaAdTech();
});
