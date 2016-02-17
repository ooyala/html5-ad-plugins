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
   * @property {string} name Name of the vast manager, must match what is sent from Backlot and used at the page level
   * @property {object} amc An internal reference to the Ad Manager Framework
   * @property {boolean} testMode If enabled, it will put the ad manager in test mode causing certain functions to not load
   * @property {string} ADTYPE Which ad manger the ad belongs to. This should match the this.name of the ad manager,
   * but doesn't have to.
   * @property {boolean} ready Used to communicate with the ad manger controller if the manager is ready to go. Default
   * is false and if the ad manager controller sees it as false after initialization then it will destroy the manager.
   * @property {object} inlineAd The stream url of the current ad to be played
   * @property {number} currentDepth Keeps track of how many layers the Ad is wrapped in and sets off a warning if the
   * maximum is reached
   * @property {object} vastAdUnit Contains the ad once it has been loaded
   * @property {boolean} loaded Set to true once the ad has been loaded successfully
   * @property {string} embedCode Keeps track of the embed code of the movie that is currently playing
   * @property {string} loaderId Unique id name for the loader, which is required by the API
   * @property {object} movieMd Contains the metadata of the main movie
   * @property {string} adURLOverride If the page level params override the ad url then it is stored here
   * @property {object} lastOverlayAd Contains the ad information for the overlay that was displayed before it was removed.
   * This is used so we know what to add back to the screen after the video ad is done and the main video hasn't ended.
   * @property {object} errorInfo The object that holds each individual ad id's error urls. Used for error reporting.
   * @property {string} ERROR Constant used when triggering an error to indicate it was a Vast error
   * @property {string} READY Constant used to trigger an event to indicate that the vast ad is ready for use
   * @property {string} VAST_AD_CONTAINER Constant used to keep track of the Vast Ad container div/layer that is used to
   * show the ads
   * @property {object} currentAdBeingLoaded Stores the ad data of the ad that is currently being loaded
   * @property {object} wrapperAds Is used to keep track of the analytic and clickthrough info of an ad
   * @property {string} wrapperParentId Used to keep track of ad's wrapper parent ID
   * @property {object} ERROR_CODES Used to define the VAST 3.0 error codes
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
    this.embedCode = 'unkown';
    this.loaderId = 'OoVastAdsLoader' + _.uniqueId;
    this.movieMd = null;
    this.adURLOverride;
    this.lastOverlayAd;
    this.errorInfo = {};
    this.ERROR = 'vastError';
    this.READY = 'vastReady';
    this.VAST_AD_CONTAINER = '#vast_ad_container';
    this.currentAdBeingLoaded = null;
    this.wrapperAds = { error: [],
                        impression: [],
                        companion: [],
                        linear: { tracking: {}, ClickTracking: [] },
                        nonLinear: { tracking: {} } };
    // when wrapper ajax callback returns, wrapperParentId will be properly set
    this.wrapperParentId = null;

    /**
     * TODO: Support all error codes. Not all error events are tracked in our code.
     * Standard VAST 3 errors
     */
    this.ERROR_CODES = {
      /**
       * XML Parsing Error.
       */
      XML_PARSING:                        100,

      /**
       * VAST Schema Validation Error.
       */
      SCHEMA_VALIDATION:                  101,

      /**
       * VAST Version of response not supported.
       */
      VERSION_UNSUPPORTED:                102,

      /**
       * TODO: Add support
       * Trafficking error. Video Player received an ad type that it was not
       * expecting and/or cannot display.
       */
      AD_TYPE_UNSUPPORTED:                200,

      /**
       * TODO: Add support
       * Video player expecting different linearity.
       */
      VIDEO_EXPECT_DIFFERENT_LINEARITY:   201,

      /**
       * TODO: Add support
       * Video player expecting different duration.
       */
      VIDEO_EXPECT_DIFFERENT_DURATION:    202,

      /**
       * TODO: Add support
       * Video player expecting different size.
       */
      VIDEO_EXPECT_DIFFERENT_SIZE:        203,

      /**
       * General Wrapper Error.
       */
      GENERAL_WRAPPER:                    300,

      /**
       * TODO: Add support
       * Timeout of VAST URI provided in Wrapper element, or of VAST URI
       * provided in a subsequent Wrapper element. Includes request errors
       * such as invalid URI, unreachable or request timeout for URI, and
       * security or other exceptions related to requesting a VAST URI.
       */
      WRAPPER_URI_TIMEOUT:                301,

      /**
       * Wrapper limit reached, as defined by the video player. Too many
       * Wrapper responses have been received with no inLine response.
       */
      WRAPPER_LIMIT_REACHED:              302,

      /**
       * No ads VAST response after one or more Wrappers. Also includes
       * number of empty VAST responses from fallback.
       */
      WRAPPER_NO_ADS:                     303,

      /**
       * General linear error. Video player is unable to display the linear ad.
       */
      GENERAL_LINEAR_ADS:                 400,

      /**
       * TODO: Add support
       * File not found. Unable to find Linear/MediaFile from URI.
       */
      FILE_NOT_FOUND:                     401,

      /**
       * TODO: Add support
       * Timeout of MediaFile URI.
       */
      MEDIAFILE_TIMEOUT:                  402,

      /**
       * TODO: Add support
       * Could not find MediaFile that is supported by this video player, based
       * on the attributes of the MediaFile element.
       */
      MEDIAFILE_UNSUPPORTED:              403,

      /**
       * TODO: Add support
       * Problem displaying MediaFile.
       */
      MEDIAFILE_DISPLAY_PROBLEM:          405,

      /**
       * General NonLinearAds error.
       */
      GENERAL_NONLINEAR_ADS:              500,

      /**
       * TODO: Add support
       * Unable to display NonLinear Ad because creative dimensions do not
       * align with creative display area(i.e., creative dimension too large).
       */
      NONLINEAR_ADS_DIMENSIONS:           501,

      /**
       * TODO: Add support
       * Unable to fetch NonLinearAds/NonLinear resource.
       */
      NONLINEAR_ADS_UNABLE_TO_FETCH:      502,

      /**
       * TODO: Add support
       * Could not find NonLinear resource with supported type.
       */
      NONLINEAR_ADS_RESOURCE_UNSUPPORTED: 503,

      /**
       * TODO: Add support
       * General CompanionAds error.
       */
      GENERAL_COMPANION_ADS:              600,

      /**
       * TODO: Add support
       * Unable to display companion because creative dimensions do not fit
       * within Companion display area (i.e., no available space).
       */
      COMPANION_ADS_DIMENSIONS:           601,

      /**
       * TODO: Add support
       * Unable to display Required Companion.
       */
      COMPANION_ADS_UNABLE_TO_DISPLAY:    602,

      /**
       * TODO: Add support
       * Unable to fetch CompanionAds/Companion resource.
       */
      COMPANION_ADS_UNABLE_TO_FETCH:      603,

      /**
       * TODO: Add support
       * Could not find Companion resource with supported type.
       */
      COMPANION_ADS_RESOURCE_UNSUPPORTED: 604,

      /**
       * TODO: Add support
       * Undefined error.
       */
      UNDEFINED:                          900,

      /**
       * TODO: Add support
       * General VPAID error.
       */
      GENERAL_VPAID:                      901
    };

    var adCompletedCallback = null;

    var VERSION_MAJOR_2 = '2';
    var VERSION_MAJOR_3 = '3';
    var SUPPORTED_VERSIONS = [VERSION_MAJOR_2, VERSION_MAJOR_3];
    var FEATURES = {
      SKIP_AD : "skipAd"
    };
    var SUPPORTED_FEATURES = {};
    SUPPORTED_FEATURES[VERSION_MAJOR_2] = [];
    SUPPORTED_FEATURES[VERSION_MAJOR_3] = [FEATURES.SKIP_AD];

    /**
     * Used to keep track of what events that are tracked for vast.
     */
    var TrackingEvents = ['creativeView', 'start', 'midpoint', 'firstQuartile', 'thirdQuartile', 'complete',
      'mute', 'unmute', 'pause', 'rewind', 'resume', 'fullscreen', 'expand', 'collapse', 'acceptInvitation',
      'close' ];

    /**
     * Helper function to verify that XML is valid
     * @public
     * @method Vast#isValidVastXML
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {boolean} Returns true if the xml is valid otherwise it returns false.
     */
    this.isValidVastXML = function(vastXML) {
      return this.isValidRootTagName(vastXML) && this.isValidVastVersion(vastXML);
    };

    /**
     * Helper function to verify XML has valid VAST root tag.
     * @public
     * @method Vast#isValidRootTagName
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {boolean} Returns true if the root tag is valid otherwise it returns false.
     */
    this.isValidRootTagName = function(vastXML) {
      var rootTagName = (vastXML && vastXML.firstChild) ? vastXML.firstChild.tagName || '' : '';
      if (rootTagName.toUpperCase() != "VAST") {
        OO.log("VAST: Invalid VAST XML for Tag Name: " + rootTagName);
        this.trackError(this.ERROR_CODES.SCHEMA_VALIDATION, this.wrapperParentId);
        return false;
      }
      return true;
    };

    /**
     * Helper function to verify XML is a valid VAST version.
     * @public
     * @method Vast#isValidVastVersion
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {boolean} Returns true if the VAST version is valid otherwise it returns false.
     */
    this.isValidVastVersion = function(vastXML) {
      var version = getVastVersion(vastXML);
      if (!supportsVersion(version)) {
        OO.log("VAST: Invalid VAST Version: " + version);
        this.trackError(this.ERROR_CODES.VERSION_UNSUPPORTED, this.wrapperParentId);
        return false;
      }
      return true;
    };

    /**
     * Returns the Vast version of the provided XML.
     * @private
     * @method Vast#getVastVersion
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {string} The Vast version.
     */
    var getVastVersion = _.bind(function(vastXML) {
      return $(vastXML.firstChild).attr('version');
    }, this);

    /**
     * Returns the Vast major version. For example, the '3' in 3.0.
     * @private
     * @method Vast#getMajorVersion
     * @param {string} version The Vast version as parsed from the XML
     * @returns {string} The major version.
     */
    var getMajorVersion = _.bind(function(version) {
      if(typeof version === 'string') {
        return version.split('.')[0];
      }
    }, this);

    /**
     * Checks to see if this ad manager supports a given Vast version.
     * @private
     * @method Vast#supportsVersion
     * @param {string} version The Vast version as parsed from the XML
     * @returns {boolean} true if the version is supported by this ad manager, false otherwise.
     */
    var supportsVersion = _.bind(function(version) {
      return _.contains(SUPPORTED_VERSIONS, getMajorVersion(version));
    }, this);

    /**
     * Checks to see if the given Vast version supports the skip ad functionality, as per Vast specs
     * for different versions.
     * @private
     * @method Vast#supportsSkipAd
     * @param {string} version The Vast version as parsed from the XML
     * @returns {boolean} true if the skip ad functionality is supported in the specified Vast version,
     *                    false otherwise.
     */
    var supportsSkipAd = _.bind(function(version) {
      return _.contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.SKIP_AD);
    }, this);

    /**
     * Helper function to grab error information. VastAdSingleParser already grabs error data while
     * creating ad object, but some errors may occur before the object is created.
     * Note: <Error> can only live in three places: directly under <VAST>, <Ad>, or <Wrapper> elements.
     * <Error> tags are also optional so they may not always exist.
     * @public
     * @method Vast#getErrorInfo
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @param {object} ads A jQuery object which contains the collection of ad elements found
     * @returns {object} The error object with a list of error urls and whether or not there are no ads.
     */
    this.getErrorInfo = function(vastXML, ads) {
      _.each(ads, function(ad) {
        var error = {
          errorURLs: [],
          wrapperParentId: this.wrapperParentId || null
        };

        var errorElement = $(ad).find("Error");
        if (errorElement.length > 0){
          error.errorURLs = [errorElement.text()];
        }
        var adId = $(ad).prop("id");
        this.errorInfo[adId] = error;
      }, this);
    };

    /**
     * This should be the first thing that happens in the parser function: check if the vast XML has no ads.
     * If it does not have ads, track error urls
     * @public
     * @method Vast#checkNoAds
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @param {object} ads A jQuery object which contains the collection of ad elements found
     * @returns {boolean} true if there are no ads, false otherwise.
     */
    this.checkNoAds = function(vastXML, ads) {
      // if there are no ads in ad response then track error
      if (ads.length === 0) {
        // there could be an <Error> element in the vast response
        var noAdsErrorURL = $(vastXML).find("Error").text();
        if (noAdsErrorURL) {
          this.pingURL(this.ERROR_CODES.WRAPPER_NO_ADS, noAdsErrorURL);
        }
        // if the ad response came from a wrapper, then go up the chain and ping those error urls
        this.trackError(this.ERROR_CODES.WRAPPER_NO_ADS, this.wrapperParentId);
        return true;
      }
      return false;
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
     * @param {object} amc The current instance of the ad manager controller
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
     * @param {object} pbMetadata Contains the page level and Backlot metadata of the specific Ad Manager
     * @param {object} baseBacklotMetadata Contains the Backlot base metadata
     * @param {object} movieMetadata Contains the movie metadata that is currently loaded
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
     * Checks to see if the current metadata contains any ads that are pre-rolls and of type vast. If there are any
     * then it will load the ads.
     * @public
     * @method Vast#loadPreRolls
     */
    this.loadPreRolls = function() {
      return findAndLoadAd("pre");
    };

    /**
     * Checks the metadata for any remaining ads of type vast that are not pre-rolls.
     * If it finds any then it will load them.
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
      // TODO: Do not destroy the whole ad manager if one ad fails!
      this.destroy();
    }, this);

    /**
     * Finds ads based on the position provided to the function.
     * @private
     * @method Vast#findAndLoadAd
     * @param {string} position The position of the ad to be loaded. "pre" (preroll), "midPost" (midroll and post rolls)
     * "all" (all positions).
     * @returns {boolean} true if it found an ad or ads to load otherwise it returns false. This is only used for
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
        adCompletedCallback = null;
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
     * @param {object} adWrapper The current Ad's metadata
     */
    this.playAd = function(adWrapper) {
      // When the ad is done, trigger callback
      if (adWrapper.isLinear) {
        this.amc.notifyPodStarted(adWrapper.id, 1);
        adCompletedCallback = _.bind(function(amc, adId) {
            amc.notifyLinearAdEnded(adId);
            amc.notifyPodEnded(adId);
          }, this, this.amc, adWrapper.id);
        this.checkCompanionAds(adWrapper.ad);
        initSkipAdOffset(adWrapper);
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
     * Determine if a Vast ad is skippable, and if so, when the skip ad button should be displayed.
     * Notifies AMC of the result.
     * @private
     * @method Vast#initSkipAdOffset
     * @param {object} adWrapper The current Ad's metadata
     */
    var initSkipAdOffset = _.bind(function(adWrapper) {
      if (supportsSkipAd(adWrapper.ad.data.version)) {
        var skipOffset = adWrapper.ad.data.linear.skipOffset;
        if (skipOffset) {
          if (skipOffset.indexOf('%') === skipOffset.length - 1) {
            this.amc.showSkipVideoAdButton(true, skipOffset, true);
          } else {
            //Vast format: HH:MM:SS.mmm
            var splits = skipOffset.split(':');
            var hh = splits[0];
            var mm = splits[1];
            var ss = splits[2];
            var ms = 0;
            var secondsSplits = ss.split('.');
            if (secondsSplits.length === 2) {
              ss = secondsSplits[0];
              ms = secondsSplits[1];
            }
            var offset = +ms + (+ss * 1000) + (+mm * 60 * 1000) + (+hh * 60 * 60 * 1000);
            //Provide the offset to the AMC in seconds
            offset = Math.round(offset / 1000);
            this.amc.showSkipVideoAdButton(true, offset.toString(), true);
          }
        } else {
          this.amc.showSkipVideoAdButton(false);
        }
      } else {
        //For Vast versions that don't support the skipoffset attribute, we
        //want to use Ooyala's settings for displaying the skip ad button
        this.amc.showSkipVideoAdButton(true);
      }
    }, this);

    /**
     * This is called by the Ad Manager Controller when it needs to cancel an Ad due to a timeout or skip button.
     * @public
     * @method Vast#cancelAd
     * @param {object} ad The Ad that needs to be cancelled
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
     * @param {object} ad Ad to cancel if it is not null
     */
    this.destroy = function() {
      // Stop any running ads
      this.cancelAd();
      this.ready = false;
      this.currentDepth = 0;
    };

    /**
     * Takes an ad and adds it to the timeline by calling appenedToTimeline which is an Ad Manager Controller function.
     * Also the properties of whether an ad is linear or not, and whether or not the marquee should show are set here.
     * @private
     * @method Vast#addToTimeline
     * @param {object} ad The ad metadata that is being added to the timeline
     * @param {object} adLoaded The ad object that has been loaded
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
          streamData = this.extractStreamForType(vastStreams, videoEncodingsSupported[encoding]);
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
     * @method Vast#ajax
     * @param {string} url The url that contains the Ad creative
     * @param {function} errorCallback callback in case there is an error in loading
     * @param {string} dataType Type of data, currently either "xml" if vast fails to load and "script" if it loads
     * successfully.
     * @param {object} loadingAd The current Ad metadata that is being loaded
     * @param {string} wrapperParentId Is the current ad's "parent" wrapper ID. Could be
     * undefined if ad does not have parent/wrapper. We want to pass this in to the next vast response
     * so the new ad knows who its parent is for error reporting purposes.
     */
    this.ajax = function(url, errorCallback, dataType, loadingAd, wrapperParentId) {
      $.ajax({
        url: OO.getNormalizedTagUrl(url, this.embedCode),
        type: 'GET',
        beforeSend: function(xhr) {
          xhr.withCredentials = true;
        },
        dataType: dataType,
        crossDomain: true,
        cache:false,
        //TODO: should pass wrapperParentId here for wrapper
        success: (dataType == "script") ? function() {} : _.bind(this.onVastResponse, this, loadingAd
          || this.currentAdBeingLoaded),
        error: _.bind(errorCallback, this, loadingAd || this.currentAdBeingLoaded)
      });
      this.currentAdBeingLoaded = null;
    };

    /**
     * Opens a page based on the clickthrough url when the user click on the Ad.
     * @public
     * @method Vast#playerClicked
     * @param {object} amcAd Ad wrapper that is sent from the Ad Manager Controller that contains the data
     * @param {boolean} showPage If set to true then we show the page, if it is false then we don't show the page
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
     * @param {object} amcAd The current ad data
     */
    this.pauseAd = function(amcAd) {
      // No code required here as VTC will pause the ad
    };

    /**
     * Resume the ad element.
     * @public
     * @method Vast#resumeAd
     * @param {object} amcAd The current ad data
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
     * is stored in this object
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
     * @param {string} url The url that we need to open in a new page
     */
    this.openUrl = function(url) {
      if (!url) { return; }
      window.open(url);
    };

    /**
     * Calls ajax to load the Ad via the url provided.
     * @public
     * @method Vast#loadUrl
     * @param {string} url The Ad creative url
     */
    this.loadUrl = function(url) {
      this.vastUrl = url;
      this.ajax(url, this.onVastError, 'xml');
    };

    /**
     * If the Ad failed to load, then the Vast manager will try to load the Ad again. This time it will create a new url
     * using a proxy url, if one is set in the player params, attach an encoded original url as a parameter, then
     * it will return the new Url to be used. If a proxy url was not provided then one is created and returned.
     * @public
     * @method Vast#getProxyUrl
     * @returns {string} the proxy url with all the data and encoding that is necessary to make it able to be used for loading.
     */
    this.getProxyUrl = function() {
      OO.publicApi[this.loaderId] = _.bind(this.onVastProxyResult, this);
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
     *  @method Vast#onVastError
     */
    this.onVastError = function() {
      OO.log("VAST: Direct Ajax Failed Error");
      this.ajax(this.getProxyUrl(), this.onFinalError, 'script');
    };

    /**
    * This method pings all the ad's error URLs with a specific error code if the error URL
    * contains the macro, "[ERRORCODE]". If ad has a parent wrapper, then go up the chain and ping
    * wrapper's error urls as well.
    * @public
    * @method Vast#trackError
    * @param {number} code Error code
    * @param {boolean} currentAdId Ad ID of current ad
    */
    this.trackError = function(code, currentAdId) {
      if (currentAdId && currentAdId in this.errorInfo) {
        this.pingURLs(this.errorInfo[currentAdId].errorURLs);
        var parentId = this.errorInfo[currentAdId].wrapperParentId;

        // ping parent wrapper's error urls too if ad had parent
        if (parentId) {
          this.trackError(code, parentId);
        }
      }
    };

    /**
     * Helper function to ping error URL. Replaces error macro if it exists.
     * @public
     * @method Vast#pingURL
     * @param {number} code Error code
     * @param {string} url URL to ping
     */
    this.pingURL = function(code, url) {
      url = url.replace(/\[ERRORCODE\]/, code);
      OO.pixelPing(url);
    };

    /**
     * Helper function to ping error URLs.
     * @public
     * @method Vast#pingURL
     * @param {number} code Error code
     * @param {string[]} urls URLs to ping
     */
    this.pingURLs = function(code, urls) {
      _.each(urls, function() {
        pingURL(code, url);
      }, this);
    };

    /**
     * If the ad fails to load a second time, this callback is called and triggers an error message, but doesn't try to
     * reload the ad.
     * @public
     * @method Vast#onFinalError
     * @fires this.Error
     */
    this.onFinalError = function() {
      OO.log("VAST: Proxy Ajax Failed Error");
      failedAd();
    };

    /**
     * Extracts the creative based on the format type that is expected.
     * @public
     * @method Vast#extractStreamForType
     * @param {Object[]} streams The stream choices from the metadata
     * @param {string} type The type of video we want to use for the creative
     * @returns {string} The creative url if it finds one, otherwise null.
     */
    this.extractStreamForType = function(streams, type) {
      var filter = [];
      filter.push("video/" +type);
      var stream = _.find(streams, function(v) { return (filter.indexOf(v.type) >= 0); }, this);
      return stream ? stream.url : null;
    };

    /**
     *  If a linear ad is found, then it is parsed and sent to be added to the time via addToTimeLine.
     * @public
     * @method Vast#handleLinearAd
     * @param {object} adLoaded The ad that was loaded
     * @param {XMLDocument} vastXML The current vast xml that contains the ad data
     * @returns {boolean} True if the ad was loaded and a stream was found; else false.
     */
    this.handleLinearAd = function(adLoaded, vastXML) {
      // See if the <Linear> even exists
      if (this.hasLinear(vastXML)) {
        // filter our playable stream:
        var firstLinearAd = _.find(this.inlineAd.ads, function(v){ return !_.isEmpty(v.linear.mediaFiles); }, this);
        if (!firstLinearAd) {
          OO.log("VAST: General Linear Ads Error; No Mediafiles in XML", this.inlineAd);
          // Want to ping error URLs at current depth if there are any available
          if (this.inlineAd && this.inlineAd.ads) {
            this.trackError(this.ERROR_CODES.GENERAL_LINEAR_ADS, this.inlineAd.ads[0].id);
          }
          else {
            this.trackError(this.ERROR_CODES.GENERAL_LINEAR_ADS, this.wrapperParentId);
          }
          return false;
        }
        var streams = firstLinearAd.linear.mediaFiles;
        var maxMedia = _.max(streams, function(v) { return parseInt(v.bitrate, 10); });
        this.vastAdUnit.maxBitrateStream = maxMedia && maxMedia.url;
        this.vastAdUnit.durationInMilliseconds = OO.timeStringToSeconds(firstLinearAd.linear.Duration) * 1000;
        _.extend(this.vastAdUnit.data, firstLinearAd);
        this.vastAdUnit.data.tracking = firstLinearAd.linear.tracking;
        addToTimeline(this.vastAdUnit, adLoaded);
        if (_.isEmpty(this.vastAdUnit.streams)) {
          // No Playable stream, report error.
          OO.log("VAST: Cannot Find Playable Stream in Vast Result", this.inlineAd);
          return false;
        }
        return true;
      }
      return false;
    };

    /**
     * Helper function to determine whether a linear ad exists
     * @public
     * @method Vast#hasLinear
     * @param {XMLDocument} vastXML The current vast xml that contains the ad data
     * @returns {boolean} true if vastXML has an Inline Linear ad, false otherwise.
     */
    this.hasLinear = function(vastXML) {
      var inlineElement = $(vastXML).find("InLine");
      var linearElement = $(inlineElement).find("Linear");
      return (linearElement.length > 0);
    };

    /**
     * If a non-linear Ad is found then it is parsed and added to the timeline via the addToTimeline function.
     * @public
     * @method Vast#handleNonLinearAd
     * @param {object} adLoaded The ad that was loaded
     * @param {XMLDocument} vastXML The current vast xml that contains the ad data
     * @returns {boolean} true if the load was successful and a stream was found otherwise false.
     */
    this.handleNonLinearAd = function(adLoaded, vastXML) {
      // See if the <NonLinear> even exists
      if (this.hasNonLinear(vastXML)) {
        // filter our playable stream:
        var firstNonLinearAd = _.find(this.inlineAd.ads, function(v){ return !_.isEmpty(v.nonLinear.url); }, this);
        if (!firstNonLinearAd) {
          OO.log("VAST: General NonLinear Ads Error: Cannot Find Playable Stream in Vast Result", this.inlineAd);
          // Want to ping error URLs at current depth if there are any available
          if (this.inlineAd && this.inlineAd.ads) {
            this.trackError(this.ERROR_CODES.GENERAL_NONLINEAR_ADS, this.inlineAd.ads[0].id);
          }
          else {
            this.trackError(this.ERROR_CODES.GENERAL_NONLINEAR_ADS, this.wrapperParentId);
          }
          return false;
        }
        var adURL = firstNonLinearAd.nonLinear.url;
        this.vastAdUnit.streamUrl = adURL;
        _.extend(this.vastAdUnit.data, firstNonLinearAd);
        this.vastAdUnit.data.tracking = firstNonLinearAd.nonLinear.tracking;
        addToTimeline(this.vastAdUnit, adLoaded);
        return true;
      }
      return false;
    };

    /**
     * Helper function to determine whether a nonlinear ad exists
     * @public
     * @method Vast#hasNonLinear
     * @param {XMLDocument} vastXML The current vast xml that contains the ad data
     * @returns {boolean} true if vastXML has an Inline NonLinear ad, false otherwise.
     */
    this.hasNonLinear = function(vastXML) {
      var inlineElement = $(vastXML).find("InLine");
      var nonLinearElement = $(inlineElement).find("NonLinear");
      return (nonLinearElement.length > 0);
    };

    /**
     * Takes all the ad data that is in the inline xml and merges them all together into the ad object.
     * @public
     * @method Vast#mergeVastAdResult
     */
    this.mergeVastAdResult = function() {
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
     * @param {object} adInfo The Ad metadata
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
     * @method Vast#onVastProxyResult
     * @param {string} value The new proxy url to use and try to load the ad again with
     */
    this.onVastProxyResult = function(value) {
      var xml = $.parseXML(value);
      this.onVastResponse(this.currentAdBeingLoaded, xml);
    };

    /**
     * The xml is parsed to find any tracking events and then returned as part of an object.
     * @private
     * @method Vast#parseTrackingEvents
     * @param {object} tracking The tracking object to be mutated
     * @param {XMLDocument} xml The data of the ad with tracking info
     * @param {string[]} trackingEvents List of events that are tracked, if null then it uses the global one
     * @returns {object} An array of tracking items.
     */
    var parseTrackingEvents = _.bind(function(tracking, xml, trackingEvents) {
      var events = trackingEvents || TrackingEvents;
      _.each(events, function(item) {
        var sel = "Tracking[event=" + item + "]";
        tracking[item] = filterEmpty(xml.find(sel).map(function(i, v) { return $(v).text(); }));
      }, {});
    }, this);

    /**
     * Helper function to remove empty items.
     * @private
     * @method Vast#filterEmpty
     * @param {Array} array An array that is the be checked if it is empty
     * @returns {Array} The filtered array.
     */
    var filterEmpty = _.bind(function(array) {
      return _.without(array, null, "");
    }, this);

    /**
     * While getting the ad data the manager needs to parse the companion ad data as well and add it to the object.
     * @private
     * @method Vast#parseCompanionAd
     * @param {XMLDocument} companionAdXML XML that contains the companion ad data
     * @returns {object} The ad object with companion ad.
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
     * @param {XMLDocument} linearXml The xml containing the ad data to be parsed
     * @returns {object} An object containing the ad data.
     */
    var parseLinearAd = _.bind(function(linearXml) {
      var result = {
        tracking: {},
        // ClickTracking needs to be remembered because it can exist in wrapper ads
        ClickTracking: filterEmpty($(linearXml).find("ClickTracking").map(function() { return $(this).text(); })),
        ClickThrough: filterEmpty($(linearXml).find("ClickThrough").map(function() { return $(this).text(); })),
        CustomClick: filterEmpty($(linearXml).find("CustomClick").map(function() { return $(this).text(); }))
      };

      result.skipOffset = $(linearXml).attr("skipoffset");

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
     * @param {XMLDocument} nonLinearAdsXml Contains the ad data that needs to be parsed
     * @returns {object} An object that contains the ad data.
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
     * @param {XMLDocument} xml The xml that contains the ad data
     * @param {string} type The ad type
     * @param {number} version The Vast version
     * @returns {object} The ad object otherwise it returns 1.
     */
    var VastAdSingleParser = _.bind(function(xml, type, version) {
      var result = getVastTemplate();
      var jqueryXML = $(xml);
      result.version = version;
      var linear = jqueryXML.find("Linear").eq(0);
      var nonLinearAds = jqueryXML.find("NonLinearAds");

      if (type === "wrapper") { result.VASTAdTagURI = jqueryXML.find("VASTAdTagURI").text(); }
      result.id = jqueryXML.prop("id");
      result.error = filterEmpty(jqueryXML.find("Error").map(function() { return $(this).text(); }));
      result.impression = filterEmpty(jqueryXML.find("Impression").map(function() { return $(this).text(); }));
      result.title = _.first(filterEmpty(jqueryXML.find("AdTitle").map(function() { return $(this).text(); })));

      if (linear.size() > 0) { result.linear = parseLinearAd(linear); }
      if (nonLinearAds.size() > 0) { result.nonLinear = parseNonLinearAds(nonLinearAds); }
      jqueryXML.find("Companion").map(function(i, v){
        result.companion.push(parseCompanionAd($(v)));
        return 1;
      });

      return result;
    }, this);

    /**
     * The xml needs to get parsed and and ad object is returned.
     * @public
     * @method Vast#parser
     * @param {XMLDocument} vastXML The xml that contains the ad data
     * @returns {object} The object if an ad was found otherwise it returns null.
     */
    this.parser = function(vastXML) {
      var jqueryAds =  $(vastXML).find("Ad");
      if (!this.checkNoAds(vastXML, jqueryAds)){
        // need to get error tracking information early in case error events need to be reported
        // before the ad object is created
        this.getErrorInfo(vastXML, jqueryAds);
      }

      if (!this.isValidVastXML(vastXML)) {
        return null;
      }

      var result = { ads: [] };
      result.version = getVastVersion(vastXML);
      var inline = $(vastXML).find("InLine");
      var wrapper = $(vastXML).find("Wrapper");

      if (inline.size() > 0) {
        result.type = "inline";
      } else if (wrapper.size() > 0) {
        result.type = "wrapper";
      } else {
        return null;
      }
      jqueryAds.each(function() {
        result.ads.push(VastAdSingleParser(this, result.type, result.version));
      });

      return result;
    };

    /**
     * When the vast Ad is loaded correctly it will call this callback. Here the data is parsed to see if it is a linear
     * or nonLinear Ad. It will pull the tracking, impression, companion and clicking information. Then merge the results
     * and send it to the correct handler based on if it is Linear or not.
     * @public
     * @method Vast#onVastResponse
     * @param {object} adLoaded The ad loaded object and metadata
     * @param {XMLDocument} xml The xml returned from loading the ad
     * @param {string} wrapperParentIdArg Is the current ad's "parent" wrapper ID. This argument would be set on an ajax
     * call for a wrapper ad. This argument could also be undefined if ad did not have parent/wrapper.
     */
    this.onVastResponse = function(adLoaded, xml, wrapperParentIdArg) {
      this.wrapperParentId = wrapperParentIdArg;
      var vastAd = this.parser(xml);
      if (!vastAd || !adLoaded) {
        this.trackError(this.ERROR_CODES.XML_PARSING, this.wrapperParentId);
        failedAd();
      }
      else if (vastAd.type == "wrapper") {
        this.handleWrapper(adLoaded, vastAd, xml);
      }
      else if (vastAd.type == "inline") {
        this.handleInline(adLoaded, vastAd, xml);
      }
    };

    /**
     * Helper function to handle Wrapper Ad.
     * @public
     * @method Vast#handleWrapper
     * @param {object} adLoaded The ad loaded object and metadata
     * @param {object} vastAd The object returned from parser, containing ad information (tracking events, linear/nonlinear
     * ad information, companion ads, etc)
     * @param {XMLDocument} vastXML The current vast xml that contains the ad data
     */
    this.handleWrapper = function(adLoaded, vastAd, vastXML) {
      this.currentDepth++;
      if (vastAd.ads && !_.isEmpty(vastAd.ads)) {
        var firstWrapperAd = vastAd.ads[0];
        OO.log("VAST: Vast Tag Url: ", firstWrapperAd.VASTAdTagURI, this.currentDepth);
        if (this.currentDepth < OO.playerParams.maxVastWrapperDepth) {
          var _wrapperAds = this.wrapperAds;
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
            this.ajax(firstWrapperAd.VASTAdTagURI, this.onFinalError, 'xml', null, firstWrapperAd.id);
          }
          else {
            this.handleLinearAd(adLoaded, vastXML);
            this.handleNonLinearAd(adLoaded, vastXML);
            addToTimeline(this.vastAdUnit, adLoaded);
          }
        }
        else {
          OO.log("VAST: Max Wrapper Depth Reached.", this.currentDepth, OO.playerParams.maxVastWrapperDepth);
          this.trackError(this.ERROR_CODES.WRAPPER_LIMIT_REACHED, firstWrapperAd.id);
          failedAd();
        }
      }
      else {
        this.trackError(this.ERROR_CODES.GENERAL_WRAPPER, this.wrapperParentId);
        failedAd();
      }
    };

    /**
     * Helper function to handle Inline Ad.
     * @public
     * @method Vast#handleInline
     * @param {object} adLoaded The ad loaded object and metadata
     * @param {object} vastAd The object returned from parser, containing ad information (tracking events, linear/nonlinear
     * ad information, companion ads, etc)
     * @param {XMLDocument} vastXML The current vast xml that contains the ad data.
     */
    this.handleInline = function(adLoaded, vastAd, vastXML) {
      this.inlineAd = vastAd;
      this.mergeVastAdResult();
      if (this.handleLinearAd(adLoaded, vastXML) || this.handleNonLinearAd(adLoaded, vastXML)) {
        this.loaded = true;
        this.trigger(this.READY, this);
      }
      else {
        failedAd();
      }
    };
  });
  return new Vast();
});
