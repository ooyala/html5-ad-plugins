/**
 * Ad Manager For Vast Ads
 * Originally Created by Greg Frank Based on Existing Vast Ad Code
 */


require("../html5-common/js/utils/InitModules/InitOO.js");
require("../html5-common/js/utils/InitModules/InitOOJQuery.js");
require("../html5-common/js/utils/InitModules/InitOOUnderscore.js");
require("../html5-common/js/utils/InitModules/InitOOHazmat.js");
require("../html5-common/js/utils/InitModules/InitOOPlayerParamsDefault.js");

require("../html5-common/js/utils/constants.js");
require("../html5-common/js/utils/utils.js");
require("../html5-common/js/classes/emitter.js");
require("../html5-common/js/utils/environment.js");

OO.Ads.manager(function(_, $) {
  /**
   * @class Vast
   * @classDesc The Vast Ads Manager class, registered as an ads manager with the ad manager controller.
   * Controls how Vast ads are loaded and played while communicating with the ad manager framework.
   * @public
   * @property {string} name Name of the vast manager, must match what is sent from Backlot and used at page level.
   * @property {object} amc An internal reference to the Ad Manager Framework.
   * @property {boolean} testMode If enabled it will put the ad manager in test mode causing certain functions to not load.
   * @property {string} ADTYPE Which ad manger the ad belongs to. This should match the this.name of the ad manager,
   * but doesn't have to.
   * @property {boolean} ready Is used to communicate with the ad manger controller if the manager is ready to go. Default
   * is false and if the ad manager controller sees it as false after initialization then it will destroy the manager.
   * @property {object} inlineAd The stream url of the current ad to be played.
   * @property {number} currentDepth Keeps track of how many layers the Ad is wrapped in and sets off a warning if the
   * max is reached.
   * @property {object} vastAdUnit Contains the ad once it has been loaded.
   * @property {boolean} loaded Set to true once the ad has been loaded successfully.
   * @property {string} errorType If an error occurs, this will save the type of error, in order to log it.
   * @property {string} embedCode Keeps track of the embed code of the movie that is currently playing.
   * @property {string} loaderId Unique id name for the loader, which is required by the API.
   * @property {object} movieMd Contains the metadata of the main movie.
   * @property {string} adURLOverride If the page level params override the ad url then it is stored here.
   * @property {object} lastOverlayAd Contains the ad information for the overlay that was displayed before it was removed.
   * This is used so we know what to add back to the screen after the video ad is done and the main video hasn't ended.
   * @property {string} ERROR Constant used when triggering an error to indicate it was a Vast error.
   * @property {string} READY Constant used to trigger an event to indicate that the vast ad is ready for use.
   * @property {string} VAST_AD_CONTAINER Constant used to keep track of the Vast Ad container div/layer that is used to
   * show the ads.
   * @property {object} currentAdBeingLoaded Stores the ad data of the ad that is currently being loaded.
   * @property {object} wrapperAds Is used to keep track of the analytic and clickthrough info of an ad.
   */
  var Vast = OO.inherit(OO.Emitter, function() {
    // this.name should match the key in metadata form the server
    this.name = "vast";
    this.amc  = null;
    this.testMode = false;
    this.ADTYPE = "vast";
    this.ready  = false;
    this.inlineAd = null;
    this.currentDepth = 0;
    this.vastAdUnit = null;
    this.loaded = false;
    this.errorType = '';
    this.embedCode = 'unkown';
    this.loaderId = 'OoVastAdsLoader' + _.uniqueId;
    this.movieMd = null;
    this.adURLOverride;
    this.lastOverlayAd;
    this.ERROR = 'vastError';
    this.READY = 'vastReady';
    this.VAST_AD_CONTAINER = '#vast_ad_container';
    this.currentAdBeingLoaded = null;
    this.wrapperAds = { error: [],
                        impression: [],
                        companion: [],
                        linear: { tracking: {}, ClickTracking: [] },
                        nonLinear: { tracking: {} } };
    var adCompletedCallback = null;

    /**
     * Used to keep track of what events that are tracked for vast.
     */
    var TrackingEvents = ['creativeView', 'start', 'midpoint', 'firstQuartile', 'thirdQuartile', 'complete',
      'mute', 'unmute', 'pause', 'rewind', 'resume', 'fullscreen', 'expand', 'collapse', 'acceptInvitation',
      'close' ];

    /**
     * Helper function to verify that XML is valid
     * @param {xml} vastXML Contains the vast ad data to be parsed.
     * @returns {boolean} Returns true if the xml is valid otherwise it returns false.
     */
    this.isValidVastXML = _.bind(function(vastXML) {
      return this.isValidRootTagName(vastXML) && this.isValidVastVersion(vastXML);
    }, this);

    /**
     * Helper function to verify XML has valid VAST root tag.
     * @param {xml} vastXML Contains the vast ad data to be parsed.
     * @returns {boolean} Returns true if the root tag is valid otherwise it returns false.
     */
    this.isValidRootTagName = function(vastXML) {
      var rootTagName = (vastXML && vastXML.firstChild) ? vastXML.firstChild.tagName || '' : '';
      if (rootTagName.toUpperCase() != "VAST") {
        OO.log("Invalid VAST XML for tag name: " + rootTagName);
        return false;
      }
      return true;
    };

    /**
     * Helper function to verify XML is a valid VAST version.
     * @param {xml} vastXML Contains the vast ad data to be parsed.
     * @returns {boolean} Returns true if the VAST version is valid otherwise it returns false.
     */
    this.isValidVastVersion = function(vastXML) {
      var vastVersion = $(vastXML.firstChild).attr("version");
      if ( vastVersion !== "2.0" && vastVersion !== "3.0") { 
        OO.log("Invalid VAST version: " + vastVersion);
        return false;
      }
      return true;
    };

    /**
     * Default template to use when creating the vast ad object.
     * @private
     * @method Vast#getVastTemplate
     * @returns {object} The ad object that is formated to what we expect vast to look like.
     */
    var getVastTemplate = _.bind(function() {
      return {
        error: [],
        impression: [],
        // Note: This means we only support at most 1 linear and 1 non-linear ad
        linear: {},
        nonLinear: {},
        companion: []
      };
    }, this);

    /**
     * Initialize the vast ad manager. For the Vast Ad Manager it will set the local
     * variable for amc to the current ad manager controller passed into the function and add the
     * event listeners to the amc controller that is needed to handle positioning of the overlay when controls are shown
     * and hidden. It will also add event Listeners that are needed for when the user goes into full screen mode or
     * comes out of it.
     * @public
     * @method Vast#initialize
     * @param {object} amc The current instance of the ad manager controller.
     */
    this.initialize = function(amc) {
      this.amc = amc;
      this.amc.addPlayerListener(this.amc.EVENTS.INITIAL_PLAY_REQUESTED, _.bind(this.initialPlay, this));
    };

    /**
     * The ad manger controller will call loadMetadata when the metadata has been loaded and ready to be parsed.
     * Currently the vast ad manager will use the metadata to load any pre-rolls that are specified by the user.
     * @public
     * @method Vast#loadMetadata
     * @param {object} pbMetadata contains the page level and backlot metadata of the specific Ad Manager.
     * @param {object} baseBacklotMetadata contains the backlot base metadata
     * @param {object} movieMetadata contains the movie metadata that is currently loaded.
     */
    this.loadMetadata = function(pbMetadata, baseBacklotMetadata, movieMetadata) {
    // Interpret the data from the page and backlot - possibly combine this function with initialize
      this.embedCode = this.amc.currentEmbedCode;
      this.movieMd = movieMetadata;
      if (pbMetadata && pbMetadata.tagUrl) {
        this.adURLOverride = pbMetadata.tagUrl;
      }
      this.ready = true;
      return this.loadPreRolls();
    };

    /**
     * Checks to see if the current metadata contains any ads that are pre-rolls and of type vast, if there are any
     * then it will load the ads.
     * @public
     * @method Vast#loadPreRolls
     */
    this.loadPreRolls = function() {
      return findAndLoadAd("pre");
    };

    /**
     * Checks the metadata for any remaining ads of type vast that are not pre-rolls,
     * if it finds any then it will load them.
     * @public
     * @method Vast#loadAllVastAds
     */
    this.loadAllVastAds = function() {
      return findAndLoadAd("midPost");
    };

    /**
     * Destroys the ad manager.
     * @private
     * @method vast#failedAd
     */
    var failedAd = _.bind(function() {
      // TODO: Do not destory the whole ad manager if one ad fails!
      this.destroy();
    }, this);

    /**
     * Finds ads based on the position provided to the function.
     * @private
     * @method Vast#findAndLoadAd
     * @param {string} position The position of the ad to be loaded. "pre" (preroll), "midPost" (midroll and post rolls)
     * "all" (all positions).
     * @returns {boolean} returns true if it found an ad or ads to load otherwise it returns false. This is only used for
     * unit tests.
     */
    var findAndLoadAd = _.bind(function(position) {
      var loadedAds = false;
      if (!this.movieMd || !this.movieMd.ads || this.movieMd.ads.length < 1) return loadedAds;
      for (var i = 0; i < this.movieMd.ads.length; i++) {
        var ad = this.movieMd.ads[i];
        if (ad.type == this.ADTYPE) {
          if (this.adURLOverride) {
            ad.url = this.adURLOverride;
          }
          if (position && ((position == "pre" && ad.time == 0) || (position == 'midPost' && ad.time > 0)
            || (position == "all"))) {
            this.currentAdBeingLoaded = ad;
            if (!this.testMode) {
              this.loadUrl(ad.url);
            }
            loadedAds = true;
          }
        }
      }
      return loadedAds;
    }, this);

    /**
     * Registered as a callback with the AMC, which gets called by the Ad Manager Controller when the play button is hit
     * or the video automatically plays the first time. Here it will try to load the rest of the vast ads at this point
     * if there any. This function should only be used if you need to do something the first time the user hits play.
     * @public
     * @method Vast#initialPlay
     */
    this.initialPlay = function() {
      return this.loadAllVastAds();
    };

     /**
      *
      * This is required by the Ad Manager Controller but for Vast ads nothing is done here.
      * @returns The array of the new timeline to merge into the controller timeline but Vast Manager doesn't use this
      * function since we add the Ads one by one, so we just return null so it is ignored by the AMC.
      * @public
      * @method Vast#buildTimeline
     */
    this.buildTimeline = function() {
      return null;
    };

    /**
     * When the ad is finished playing we need to call the AMC callback that was provided to let the AMC know that the
     * ad is finished playing.
     * @public
     * @method Vast#adVideoEnded
     */
    this.adVideoEnded = function() {
      if (typeof adCompletedCallback === "function") {
        adCompletedCallback();
      }
    };

    /**
     * When the ad fails to play we need to call the AMC callback that was provided to let the AMC know that the
     * ad is finished playing and we need to follow the process for cleaning up after an ad fails.
     * @public
     * @method Vast#adVideoError
     */
    this.adVideoError = function() {
      this.adVideoEnded();
      // VTC will pause the ad when the video element loses focus
      failedAd();
    };


    /**
     * The Ad Manager Controller will call this function when it finds an Ad to play. The type of Ad is checked to see
     * if it is a non-linear or linear Ad. If it is linear then it will hide any overlays that are currently being
     * displayed and add the video to the adVideoElement.  It will also call the adStartedCallback for the linear Ad to
     * inform the Ad Manager Controller that a video Ad started playing. Companion ads are checked for and listeners
     * are added to know when the video ends. However, if the ad is a non-linear ad, then createOverlay is called.
     * @public
     * @method Vast#playAd
     * @param {object} adWrapper The current Ad's metadata.
     */
    this.playAd = function(adWrapper) {
      // When the ad is done, trigger callback
      var ui = this.amc.ui;

      if (adWrapper.isLinear) {
        this.amc.notifyPodStarted(adWrapper.id, 1);
        adCompletedCallback = _.bind(function(amc, adId) {
            amc.notifyLinearAdEnded(adId);
            amc.notifyPodEnded(adId);
          }, this, this.amc, adWrapper.id);
        this.checkCompanionAds(adWrapper.ad);
        this.amc.showSkipVideoAdButton(true);
        var hasClickUrl = adWrapper.ad.data.linear.ClickThrough.length > 0;
        this.amc.notifyLinearAdStarted(this.name, {
            name: adWrapper.ad.data.title,
            duration: adWrapper.ad.durationInMilliseconds/1000,
            hasClickUrl: hasClickUrl,
            indexInPod: 1,
            skippable: false
          });
      }
      else {
        var streamUrl;
        if (adWrapper.ad && adWrapper.ad.streamUrl) {
          streamUrl = adWrapper.ad.streamUrl;
        }
        else if (adWrapper.streamUrl) {
          streamUrl = adWrapper.streamUrl;
        }
        this.amc.sendURLToLoadAndPlayNonLinearAd(adWrapper, adWrapper.id, streamUrl);
        this.checkCompanionAds(adWrapper.ad);
      }
    };

    /**
     * This is called by the Ad Manager Controller when it needs to cancel an Ad due to a timeout or skip button.
     * @public
     * @method Vast#cancelAd
     * @param {object} ad The Ad that needs to be cancelled.
     */
    this.cancelAd = function(ad) {
      //TODO: add timout logic if needed here as well.
      if (!this.amc || !this.amc.ui) {
        return;
      }
      if (ad) {
        if (ad.isLinear) {
          // The VTC should pause the ad when the video element loses focus
          this.amc.notifyLinearAdEnded(ad.id);
          this.amc.notifyPodEnded(ad.id);
        } else {
          this.lastOverlayAd = null;
          this.amc.notifyNonlinearAdEnded(ad.id);
        }
      }
    };

    /**
     * Called by the Ad Manager Controller when the module is unregistered, we need to remove any overlays that are visible.
     * @public
     * @method Vast#destroy
     * @param {object} ad Ad to cancel if it is not null;
     */
    this.destroy = function() {
      // Stop any running ads
      this.cancelAd();
      this.ready = false;
    };

    /**
     * Takes an ad and adds it to the timeline by calling appenedToTimeline which is an Ad Manager Controller function.
     * Also the properties of whether an ad is linear or not, and whether or not the marquee should show are set here.
     * @private
     * @method Vast#addToTimeline
     * @param {object} ad The ad metadata that is being added to the timeline.
     * @param {object} adLoaded The ad object that has been loaded.
     */
    var addToTimeline = _.bind(function(ad, adLoaded) {
      if (!ad) return;
      var timeline = [];
      var type, duration;

      if (!_.isEmpty(ad.data.linear.mediaFiles)) {
        type = this.amc.ADTYPE.LINEAR_VIDEO;
        duration = OO.timeStringToSeconds(ad.data.linear.Duration);
      }
      else
      {
        type = this.amc.ADTYPE.NONLINEAR_OVERLAY;
        duration = ad.data.nonLinear.Duration ?  OO.timeStringToSeconds(ad.data.nonLinear.Duration) : 0;
      }
      var positionSeconds = adLoaded.time/1000;

      // Save the stream data for use by VideoController
      var streams = {};
      var linearAd = ad.data.linear;
      if (linearAd && linearAd.mediaFiles) {
        var vastStreams = linearAd.mediaFiles;
        var videoEncodingsSupported = OO.VIDEO.ENCODING;
        var streamData = null;
        for (var encoding in videoEncodingsSupported) {
          streamData = null;
          streamData = this._extractStreamForType(vastStreams, videoEncodingsSupported[encoding]);
          if (streamData) {
            streams[videoEncodingsSupported[encoding]] = streamData;
          }
        }
      }
      if (ad.streamUrl != null || (type == this.amc.ADTYPE.LINEAR_VIDEO && !_.isEmpty(streams))) {
        ad.streams = streams;
        timeline.push(new this.amc.Ad({
          position: positionSeconds, duration: duration, adManager: this.name,
          ad: ad, adType: type, streams: streams
        }));
        this.amc.appendToTimeline(timeline);
      }
    }, this);

    /**
     * Attempts to load the Ad after normalizing the url.
     * @public
     * @method Vast#_ajax
     * @param {string} url The url that contains the Ad creative
     * @param {function} errorCallback callback in case there is an error in loading.
     * @param {string} dataType Type of data, currently either "xml" if vast fails to load and "script" if it loads
     * successfully.
     * @param {object} loadingAd The current Ad metadata that is being loaded.
     */
    this._ajax = function(url, errorCallback, dataType, loadingAd) {
      $.ajax({
        url: OO.getNormalizedTagUrl(url, this.embedCode),
        type: 'GET',
        beforeSend: function(xhr) {
          xhr.withCredentials = true;
        },
        dataType: dataType,
        crossDomain: true,
        cache:false,
        success: (dataType == "script") ? function() {} : _.bind(this._onVastResponse, this, loadingAd
          || this.currentAdBeingLoaded),
        error: _.bind(errorCallback, this, loadingAd || this.currentAdBeingLoaded)
      });
      this.currentAdBeingLoaded = null;
    };

    /**
     * Opens a page based on the clickthrough url when the user click on the Ad.
     * @public
     * @method Vast#playerClicked
     * @param {object} amcAd Ad wrapper that is sent from the Ad Manager Controller that contains the data.
     * @param {boolean} showPage If set to true then we show the page, if it is false then we don't show the page.
     */
    this.playerClicked = function(amcAd, showPage) {
      if (!showPage) {
       return;
      }
      var highLevelClickThroughUrl = amcAd.ad.data && amcAd.ad.data.ClickThrough;
      var adSpecificClickThroughUrl = null;
      var ooyalaClickUrl = amcAd.click_url;
      if (amcAd.isLinear) {
        adSpecificClickThroughUrl = amcAd.ad.data.linear.ClickThrough;
      } else if (amcAd.ad.data) {
        adSpecificClickThroughUrl = amcAd.ad.data.nonLinear.NonLinearClickThrough;
      }
      if (highLevelClickThroughUrl || ooyalaClickUrl || adSpecificClickThroughUrl) {
        this.openUrl(highLevelClickThroughUrl);
        this.openUrl(ooyalaClickUrl);
        this.openUrl(adSpecificClickThroughUrl);
      }
    };

    /**
     * Pauses the ad element.
     * @public
     * @method Vast#pauseAd
     * @param {object} amcAd The current ad data.
     */
    this.pauseAd = function(amcAd) {
      // No code required here as VTC will pause the ad
    };

    /**
     * Resume the ad element.
     * @public
     * @method Vast#resumeAd
     * @param {object} amcAd The current ad data.
     */
    this.resumeAd = function(amcAd) {
      // No code required here as VTC will resume the ad
    };

    /**
     * When the Ad Manager Controller needs to hide the overlay it will call this function. We will store the current ad
     * for reference. Vast ad doesn't need to do much other then save the reference.
     * @public
     * @method Vast#hideOverlay
     * @param {object} currentAd In order to not lose reference to the overlay object that is currently being shown, it
     * is stored in this object.
     */
    this.hideOverlay = function(currentAd) {
      this.lastOverlayAd = currentAd;
    };

    /**
     * This function gets called by the ad Manager Controller when an ad has completed playing. If the main video is
     * finished playing and there was an overlay displayed before the post-roll then it needs to be cleared out of memory. If the main
     * video hasn't finished playing and then it needs to be displayed agained but VAST doesn't need to do anything here.
     * @public
     * @method Vast#showOverlay
     */
    this.showOverlay = function() {
      if (this.amc.ended && this.lastOverlayAd) {
        this.cancelAd(lastOverlayAd);
      }
    };

    /**
     * Opens a new page pointing to the URL provided.
     * @public
     * @method Vast#openUrl
     * @param {string} url The url that we need to open in a new page.
     */
    this.openUrl = function(url) {
      if (!url) { return; }
      window.open(url);
    };

    /**
     * Calls _ajax to load the Ad via the url provided.
     * @public
     * @method Vast#loadUrl
     * @param {string} url The Ad creative url.
     */
    this.loadUrl = function(url) {
      this.vastUrl = url;
      this._ajax(url, this._onVastError, 'xml');
    };

    /**
     * If the Ad failed to load, then the Vast manager will try to load the Ad again. This time it will create a new url
     * using a proxy url, if one is set in the player params, attach an encoded original url as a parameter, then
     * it will return the new Url to be used. If a proxy url was not provided then one is created and returned.
     * @public
     * @method Vast#_getProxyUrl
     * @returns {string} the proxy url with all the data and encoding that is necessary to make it able to be used for loading.
     */
    this._getProxyUrl = function() {
      OO.publicApi[this.loaderId] = _.bind(this._onVastProxyResult, this);
      if (OO.playerParams.vast_proxy_url) {
        return [OO.playerParams.vast_proxy_url, "?callback=OO.", this.loaderId, "&tag_url=",
            encodeURI(this.vastUrl), "&embed_code=", this.embedCode].join("");
      }
      return OO.URLS.VAST_PROXY({
          cb: "OO." + this.loaderId,
          embedCode: this.embedCode,
          expires: (new Date()).getTime() + 1000,
          tagUrl: encodeURI(this.vastUrl)
      });
    };

    /**
     *  If the Ad fails to load this callback is called. It will try to load again using a proxy url.
     *  @public
     *  @method Vast#_onVastError
     */
    this._onVastError = function() {
      this.errorType = 'directAjaxFailed';
      this._ajax(this._getProxyUrl(), this._onFinalError, 'script');
      this.trigger(this.ERROR, this);
    };

    /**
     * If the ad fails to load a second time, this callback is called and triggers an error message, but doesn't try to
     * reload the ad.
     * @public
     * @method Vast#_onFinalError
     * @fires this.Error
     */
    this._onFinalError = function() {
      this.errorType = "proxyAjaxFailed";
      this.trigger(this.ERROR, this);
      failedAd();
    };

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
     *  If a linear ad is found, then it is parsed and sent to be added to the time via addToTimeLine.
     * @public
     * @method Vast#_handleLinearAd
     * @param {object} adLoaded The ad that was loaded.
     * @returns {boolean} True if the ad was loaded and a stream was found; else false.
     */
    this._handleLinearAd = function(adLoaded) {
      // filter our playable stream:
      var firstLinearAd = _.find(this.inlineAd.ads, function(v){ return !_.isEmpty(v.linear.mediaFiles); }, this);
      if (!firstLinearAd) { return false; }
      var streams = firstLinearAd.linear.mediaFiles;
      var maxMedia = _.max(streams, function(v) { return parseInt(v.bitrate, 10); });
      this.vastAdUnit.maxBitrateStream = maxMedia && maxMedia.url;
      this.vastAdUnit.durationInMilliseconds = OO.timeStringToSeconds(firstLinearAd.linear.Duration) * 1000;
      _.extend(this.vastAdUnit.data, firstLinearAd);
      this.vastAdUnit.data.tracking = firstLinearAd.linear.tracking;
      addToTimeline(this.vastAdUnit, adLoaded);
      if (_.isEmpty(this.vastAdUnit.streams)) {
        // No Playable stream, report error.
        OO.log("Can not find playable stream in vast result", this.inlineAd);
        return false;
      }
      return true;
    };

    /**
     * If a non-linear Ad is found then it is parsed and added to the timeline via the addToTimeline function.
     * @public
     * @method Vast#_handleNonLinearAd
     * @param {object} adLoaded The ad that was loaded.
     * @returns {boolean} True if the load was successful and a stream was found otherwise false.
     */
    this._handleNonLinearAd = function(adLoaded) {
      // filter our playable stream:
      var firstNonLinearAd = _.find(this.inlineAd.ads, function(v){ return !_.isEmpty(v.nonLinear.url); }, this);
      if (!firstNonLinearAd) { return false; }
      var adURL = firstNonLinearAd.nonLinear.url;
      this.vastAdUnit.streamUrl = adURL;
      _.extend(this.vastAdUnit.data, firstNonLinearAd);
      this.vastAdUnit.data.tracking = firstNonLinearAd.nonLinear.tracking;

      if (this.vastAdUnit.streamUrl == null) {
        // No Playable stream, report error.
        OO.log("Can not find playable stream in vast result", this.inlineAd);
        return false;
      }
      addToTimeline(this.vastAdUnit, adLoaded);
      return true;
    };

    /**
     * Takes all the ad data that is in the inline xml and merges them all together into the ad object.
     * @public
     * @method Vast#_mergeVastAdResult
     */
    this._mergeVastAdResult = function() {
      this.vastAdUnit = { data: {}, vastUrl: this.vastUrl, maxBitrateStream: null };
      _.each(this.inlineAd.ads, function(ad) {
        ad.error = this.wrapperAds.error.concat(ad.error);
        ad.impression = this.wrapperAds.impression.concat(ad.impression);
        ad.companion = this.wrapperAds.companion.concat(ad.companion);
        if (this.wrapperAds.linear.ClickTracking) {
          ad.linear.ClickTracking = this.wrapperAds.linear.ClickTracking.concat(ad.linear.ClickTracking || []);
        }
        if (this.wrapperAds.linear.tracking) {
          if (!ad.linear.tracking) { ad.linear.tracking  = {}; }
          _.each(this.wrapperAds.linear.tracking, function(value, key) {
            ad.linear.tracking[key] = ad.linear.tracking[key] ? value.concat(ad.linear.tracking[key]) : value;
          });
        }
        if (this.wrapperAds.nonLinear.tracking) {
          if (!ad.nonLinear.tracking) { ad.nonLinear.tracking = {}; }
          _.each(this.wrapperAds.nonLinear.tracking, function(value, key) {
            ad.nonLinear.tracking[key] = ad.nonLinear.tracking[key] ? value.concat(ad.nonLinear.tracking[key]) : value;
          });
        }
      }, this);
    };

    /**
     * Checks if there is any companion ads associated with the ad and if one is found, it will call the Ad Manager
     * Controller to show it.
     * @public
     * @method Vast#checkCompanionAds
     * @param {object} adInfo The Ad metadata.
     */
    this.checkCompanionAds = function(adInfo) {
      if (_.isNull(adInfo.data) || _.isEmpty(adInfo.data.companion)) {
        return;
       }
       this.amc.showCompanion(adInfo.data.companion);
     };

    /**
     * If using the proxy url doesn't fail, then we parse the data into xml and call the vastResponse callback.
     * @public
     * @method Vast#_onVastProxyResult
     * @param {string} value The new proxy url to use and try to load the ad again with.
     */
    this._onVastProxyResult = function(value) {
      var xml = $.parseXML(value);
      this._onVastResponse(this.currentAdBeingLoaded, xml);
    };

    /**
     * The xml is parsed to find any tracking events and then returned as part of an object.
     * @private
     * @method Vast#parseTrackingEvents
     * @param {array} tracking to add the tracking info to and return.
     * @param {xml} xml The data of the ad with tracking info.
     * @param {array} trackingEvents List of events that are tracked, if null then it uses the global one.
     * @returns {array} tracking An array of tracking items.
     */
    var parseTrackingEvents = _.bind(function(tracking, xml, trackingEvents) {
      var events = trackingEvents || TrackingEvents;
      _.each(events, function(item) {
        var sel = "Tracking[event=" + item + "]";
        tracking[item] = filterEmpty(xml.find(sel).map(function(i, v) { return $(v).text(); }));
      }, {});
    }, this);

    /**
     * Helper function that make sure the array is not empty.
     * @private
     * @method Vast#filterEmpty
     * @param {array} array An array that is the be checked if it is empty.
     */
    var filterEmpty = _.bind(function(array) {
      return _.reject(array, function(x){
        return x === null || x === "";
      }, {});
    }, this);

    /**
     * While getting the ad data the manager needs to parse the companion ad data as well and add it to the object.
     * @private
     * @method Vast#parseCompanionAd
     * @param {xml} companionAdXML Xml that contains the companion ad data.
     * @returns {object} Ad object with companion ad.
     */
    var parseCompanionAd = _.bind(function(companionAdXml) {
      var result = { tracking: {} };
      var staticResource = companionAdXml.find("StaticResource");
      var iframeResource = companionAdXml.find("IFrameResource");
      var htmlResource = companionAdXml.find("HTMLResource");

      parseTrackingEvents(result.tracking, companionAdXml, ["creativeView"]);

      result.width = companionAdXml.attr("width");
      result.height = companionAdXml.attr("height");
      result.expandedWidth = companionAdXml.attr("expandedWidth");
      result.expandedHeight = companionAdXml.attr("expandedHeight");
      result.CompanionClickThrough = companionAdXml.find("CompanionClickThrough").text();

      if (staticResource.size() > 0) {
        _.extend(result, { type: "static", data: staticResource.text(), url: staticResource.text() });
      } else if (iframeResource.size() > 0) {
        _.extend(result, { type: "iframe", data: iframeResource.text(), url: iframeResource.text() });
      } else if (htmlResource.size() > 0) {
        _.extend(result, { type: "html", data: htmlResource.text(), htmlCode: htmlResource.text() });
      }

      return result;
    }, this);

    /**
     * The xml needs to be parsed to grab all the linear data of the ad and create an object.
     * @private
     * @method Vast#parseLinearAd
     * @param {xml} Xml containing the ad data to be parsed.
     * @returns {object} result An object containing the ad data.
     */
    var parseLinearAd = _.bind(function(linearXml) {
      var result = {
        tracking: {},
        // ClickTracking needs to be remembered because it can exist in wrapper ads
        ClickTracking: filterEmpty($(linearXml).find("ClickTracking").map(function() { return $(this).text(); })),
        ClickThrough: filterEmpty($(linearXml).find("ClickThrough").map(function() { return $(this).text(); })),
        CustomClick: filterEmpty($(linearXml).find("CustomClick").map(function() { return $(this).text(); }))
      };
      var mediaFile = linearXml.find("MediaFile");

      parseTrackingEvents(result.tracking, linearXml);
      if (mediaFile.size() > 0) {
        result.mediaFiles = filterEmpty(mediaFile.map(function(i,v) {
          return {
            type: $(v).attr("type").toLowerCase(),
            url: $.trim($(v).text()),
            bitrate: $(v).attr("bitrate"),
            width: $(v).attr("width"),
            height: $(v).attr("height")
          };
        }));
        result.Duration = linearXml.find("Duration").text();
      }

      return result;
    }, this);

    /**
     * The xml needs to be parsed in order to grab all the non-linear ad data.
     * @private
     * @method Vast#parseNonLinearAd
     * @param {xml} nonLinearAdsXml Contains the ad data that needs to be parsed.
     * @returns {object} result An object that contains the ad data.
     */
    var parseNonLinearAds = _.bind(function(nonLinearAdsXml) {
      var result = { tracking: {} };
      var nonLinear = nonLinearAdsXml.find("NonLinear").eq(0);

      parseTrackingEvents(result.tracking, nonLinearAdsXml);

      if (nonLinear.size() > 0) {
        var staticResource = nonLinear.find("StaticResource");
        var iframeResource = nonLinear.find("IFrameResource");
        var htmlResource = nonLinear.find("HTMLResource");
        result.width = nonLinear.attr("width");
        result.height = nonLinear.attr("height");
        result.expandedWidth = nonLinear.attr("expandedWidth");
        result.expandedHeight = nonLinear.attr("expandedHeight");
        result.scalable = nonLinear.attr("scalable");
        result.maintainAspectRatio = nonLinear.attr("maintainAspectRatio");
        result.minSuggestedDuration = nonLinear.attr("minSuggestedDuration");
        result.NonLinearClickThrough = nonLinear.find("NonLinearClickThrough").text();

        if (staticResource.size() > 0) {
          _.extend(result, { type: "static", data: staticResource.text(), url: staticResource.text() });
        } else if (iframeResource.size() > 0) {
          _.extend(result, { type: "iframe", data: iframeResource.text(), url: iframeResource.text() });
        } else if (htmlResource.size() > 0) {
          _.extend(result, { type: "html", data: htmlResource.text(), htmlCode: htmlResource.text() });
        }
      }

      return result;
    }, this);

    /**
     * Takes the xml and ad type and find the ad within the xml and returns it.
     * @private
     * @method Vast#VastAdSingleParser
     * @param {xml} xml Xml that contins the ad data.
     * @param {string} type The ad type.
     * @returns {object} The ad object otherwise it returns 1.
     */
    var VastAdSingleParser = _.bind(function(xml, type) {
      var result = getVastTemplate();
      var linear = $(xml).find("Linear").eq(0);
      var nonLinearAds = $(xml).find("NonLinearAds");

      if (type === "wrapper") { result.VASTAdTagURI = $(xml).find("VASTAdTagURI").text(); }
      result.error = filterEmpty($(xml).find("Error").map(function() { return $(this).text(); }));
      result.impression = filterEmpty($(xml).find("Impression").map(function() { return $(this).text(); }));
      result.title = _.first(filterEmpty($(xml).find("AdTitle").map(function() { return $(this).text(); })));

      if (linear.size() > 0) { result.linear = parseLinearAd(linear); }
      if (nonLinearAds.size() > 0) { result.nonLinear = parseNonLinearAds(nonLinearAds); }
      $(xml).find("Companion").map(function(i, v){
        result.companion.push(parseCompanionAd($(v)));
        return 1;
      });

      return result;
    }, this);

    /**
     * The xml needs to get parsed and and ad object is returned.
     * @public
     * @method Vast#parser
     * @param {xml} vastXML The xml that contains the ad data.
     * @returns {object} If the ad is found it returns the object otherwise it returns null.
     */
    this.parser = function(vastXML) {
      if (!this.isValidVastXML(vastXML)) {
        return null;
      }

      var inline = $(vastXML).find("InLine");
      var wrapper = $(vastXML).find("Wrapper");
      var result = { ads: [] };

      if (inline.size() > 0) {
        result.type = "inline";
      } else if (wrapper.size() > 0) {
        result.type = "wrapper";
      } else {
        return null;
      }
      $(vastXML).find("Ad").each(function() {
        result.ads.push(VastAdSingleParser(this, result.type));
      });

      return result;
    };

    /**
     * When the vast Ad is loaded correctly it will call this callback. Here the data is parsed to see if it is a linear
     * or nonLinear Ad. It will pull the tracking, impression, companion and clicking information. Then merge the results
     * and send it to the correct handler based on if it is Linear or not.
     * @public
     * @method Vast#_onVastResponse
     * @param {object} adLoaded The ad loaded object and metadata.
     * @param {object} xml The xml returned from loading the ad.
     */
    this._onVastResponse = function(adLoaded, xml) {
      var vastAd = this.parser(xml);
      if (!vastAd || !adLoaded) {
        this.errorType = "parseError";
        this.trigger(this.ERROR, this);
        failedAd();
      }
      else if (vastAd.type == "wrapper") {
        this.currentDepth++;
        if (this.currentDepth < OO.playerParams.maxVastWrapperDepth) {
          var firstWrapperAd = vastAd.ads[0];
          var _wrapperAds = this.wrapperAds;
          OO.log("vast tag url is", firstWrapperAd.VASTAdTagURI, this.currentDepth);
          if (firstWrapperAd) {
            this.wrapperAds.error = this.wrapperAds.error.concat(firstWrapperAd.error);
            this.wrapperAds.impression = this.wrapperAds.impression.concat(firstWrapperAd.impression);
            this.wrapperAds.companion = this.wrapperAds.companion.concat(firstWrapperAd.companion);
            this.wrapperAds.linear.ClickTracking = this.wrapperAds.linear.ClickTracking
                .concat(firstWrapperAd.linear.ClickTracking);
            _.each(firstWrapperAd.linear.tracking, function(value, key) {
              _wrapperAds.linear.tracking[key] = _wrapperAds.linear.tracking[key] ?
                                                 value.concat(_wrapperAds.linear.tracking[key]) :
                                                 value;
            });
            _.each(firstWrapperAd.nonLinear.tracking, function(value, key) {
              _wrapperAds.nonLinear.tracking[key] = _wrapperAds.nonLinear.tracking[key] ?
                                                    value.concat(_wrapperAds.nonLinear.tracking[key]) :
                                                    value;
            });
            if (!this.testMode) {
              this._ajax(firstWrapperAd.VASTAdTagURI, this._onFinalError, 'xml');
            } else {
              this._handleLinearAd(adLoaded);
              this._handleNonLinearAd(adLoaded);
            }

          }
          else {
            this.errorType = "wrapperParseError";
            this.trigger(this.ERROR, this);
            failedAd();
          }
        } else {
          OO.log("Max wrapper depth reached.", this.currentDepth, OO.playerParams.maxVastWrapperDepth);
          this.errorType = "tooManyWrapper";
          this.trigger(this.ERROR, this);
          failedAd();
        }
      } else if (vastAd.type == "inline") {
          this.inlineAd = vastAd;
          this._mergeVastAdResult();
          if (this._handleLinearAd(adLoaded) || this._handleNonLinearAd(adLoaded)) {
            this.loaded = true;
            this.trigger(this.READY, this);
          } else {
            this.errorType = "noAd";
            this.trigger(this.ERROR, this);
            failedAd();
        }
      }
    };
  });
  return new Vast();
});
