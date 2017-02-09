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
require("../html5-common/js/utils/environment.js");

var adManagerUtils = require("../utils/ad_manager_utils.js");

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
   * @property {number} currentDepth Keeps track of how many layers the Ad is wrapped in and sets off a warning if the
   * maximum is reached
   * @property {boolean} loaded Set to true once the ad has been loaded successfully
   * @property {string} embedCode Keeps track of the embed code of the movie that is currently playing
   * @property {string} loaderId Unique id name for the loader, which is required by the API
   * @property {object} lastOverlayAd Contains the ad information for the overlay that was displayed before it was removed.
   * This is used so we know what to add back to the screen after the video ad is done and the main video hasn't ended.
   * @property {object} adTrackingInfo The object that holds each individual ad id's tracking urls (including error reporting).
   * @property {string} VAST_AD_CONTAINER Constant used to keep track of the Vast Ad container div/layer that is used to
   * show the ads
   * @property {object} currentAdBeingLoaded Stores the ad data of the ad that is currently being loaded
   * @property {string} wrapperParentId Used to keep track of ad's wrapper parent ID
   * @property {object} ERROR_CODES Used to define the VAST 3.0 error codes
   */
  var Vast = function() {
    // this.name should match the key in metadata form the server
    this.name = "vast";
    this.amc  = null;
    this.testMode = false;
    this.ADTYPE = "vast";
    this.ready  = false;
    this.currentDepth = 0;
    this.loaded = false;
    this.embedCode = 'unknown';
    this.loaderId = 'OoVastAdsLoader' + _.uniqueId;
    this.lastOverlayAd;
    this.adTrackingInfo = {};
    this.VAST_AD_CONTAINER = '#vast_ad_container';
    this.currentAdBeingLoaded = null;
    // when wrapper ajax callback returns, wrapperParentId will be properly set
    this.wrapperParentId = null;
    this.adBreaks = [];

    // VPAID Variables
    var vpaidVideoRestrictions          = { technology: OO.VIDEO.TECHNOLOGY.HTML5,
                                            features: [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE] };
    this.mainContentDuration            = -1;
    this.testMode                       = false;

    this.allAdInfo                      = null;
    this.adTagUrlOverride               = null;
    this.showLinearAdSkipButton         = false;
    var vpaidIframe                          = null;
    var timeline                        = [];

    // ad settings
    var transitionFromNonLinearVideo    = false;

    var vpaidIframeLoaded               = false;
    var vpaidAdLoaded                   = false;
    var vpaidAdStarted                  = false;
    var vpaidAdStopped                  = false;

    var vpaidIframeLoadedTimeout        = null;
    var vpaidAdLoadedTimeout            = null;
    var vpaidAdStartedTimeout           = null;
    var vpaidAdStoppedTimeout           = null;

    this.VPAID_AD_IFRAME_TIMEOUT         = 5000;
    this.VPAID_AD_LOADED_TIMEOUT         = 5000;
    this.VPAID_AD_STARTED_TIMEOUT        = 5000;
    this.VPAID_AD_STOPPED_TIMEOUT        = 5000;


    // VPAID variables
    this._slot                          = null;
    this._videoSlot                     = null;
    this._videoSlotCanAutoPlay          = true;
    this.environmentVariables           = {};
    this._eventsCallbacks               = {};
    this._parameters                    = {};

    var VPAID_EVENTS                    = {
                                            AD_LOADED                 : 'AdLoaded',
                                            AD_STARTED                : 'AdStarted',
                                            AD_STOPPED                : 'AdStopped',
                                            AD_SKIPPED                : 'AdSkipped',
                                            AD_SKIPPABLE_STATE_CHANGE : 'AdSkippableStateChange',
                                            AD_DURATION_CHANGE        : 'AdDurationChange',
                                            AD_SIZE_CHANGE            : 'AdSizeChange',
                                            AD_LINEAR_CHANGE          : 'AdLinearChange',
                                            AD_INTERACTION            : 'AdInteraction',
                                            AD_IMPRESSION             : 'AdImpression',
                                            AD_CLICK_THRU             : 'AdClickThru',
                                            AD_PAUSED                 : 'AdPaused',
                                            AD_PLAYING                : 'AdPlaying',
                                            AD_VIDEO_START            : 'AdVideoStart',
                                            AD_VIDEO_COMPLETE         : 'AdVideoComplete',
                                            AD_ERROR                  : 'AdError',
                                            AD_LOG                    : 'AdLog',
                                            AD_REMAINING_TIME_CHANGE  : 'AdRemainingTimeChange',
                                            AD_VIDEO_FIRST_QUARTILE   : 'AdVideoFirstQuartile',
                                            AD_VIDEO_MIDPOINT         : 'AdVideoMidpoint',
                                            AD_VIDEO_THIRD_QUARTILE   : 'AdVideoThirdQuartile',
                                            AD_USER_ACCEPT_INVITATION : 'AdUserAcceptInvitation',
                                            AD_VOLUME_CHANGE          : 'AdVolumeChange',
                                            AD_USER_MINIMIZE          : 'AdUserMinimize'
                                          };

    // VAST Parsed variables
    this.format                           = null;
    this.node                             = null;
    this.ads                              = {};

    var fromPause                         = false;
    //END VPAID VARIABLES

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
       * TODO: Add support
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
       * TODO: Add support
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

    var currentAd = null;
    var nextAd = null;
    var prevAd = null;
    var adPodPrimary = null;
    var adMode = false;

    var VERSION_MAJOR_2 = '2';
    var VERSION_MAJOR_3 = '3';
    var SUPPORTED_VERSIONS = [VERSION_MAJOR_2, VERSION_MAJOR_3];
    var FEATURES = {
      SKIP_AD : "skipAd",
      PODDED_ADS : "poddedAds",
      AD_FALLBACK : "adFallback"
    };
    var SUPPORTED_FEATURES = {};
    SUPPORTED_FEATURES[VERSION_MAJOR_2] = [];
    SUPPORTED_FEATURES[VERSION_MAJOR_3] = [FEATURES.SKIP_AD, FEATURES.PODDED_ADS, FEATURES.AD_FALLBACK];

    var AD_TYPE = {
      INLINE : "InLine",
      WRAPPER : "Wrapper"
    };

    // Used to keep track of whether an ad's firstQuartile, midpoint, or thirdQuartile has been passed.
    var trackingEventQuartiles = {};

    var isMuted = false;
    var lastVolume;

    /**
     * Used to keep track of what events that are tracked for vast.
     */
    var TrackingEvents = ['creativeView', 'start', 'midpoint', 'firstQuartile', 'thirdQuartile', 'complete',
    'mute', 'unmute', 'pause', 'rewind', 'resume', 'fullscreen', 'exitFullscreen', 'expand', 'collapse', 'acceptInvitation',
    'close', 'skip' ];

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
      if (!getVastRoot(vastXML)) {
        _tryRaiseAdError("VAST: Invalid VAST XML");
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
        _tryRaiseAdError("VAST: Invalid VAST Version: " + version);
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
      var vastTag = getVastRoot(vastXML);
      return $(vastTag).attr('version');
    }, this);

    /**
     * Helper function to get the VAST root element.
     * @private
     * @method Vast#getVastRoot
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {object} null if a VAST tag is absent, or if there are multiple VAST tags. Otherwise,
     * returns the VAST root element.
     */
    var getVastRoot = _.bind(function(vastXML) {
      var vastRootElement = $(vastXML).find("VAST");
      if (vastRootElement.length === 0) {
        _tryRaiseAdError("VAST: No VAST tags in XML");
        return null;
      }
      else if (vastRootElement.length > 1) {
        _tryRaiseAdError("VAST: Multiple VAST tags in XML");
        return null;
      }
      return vastRootElement[0];
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
     * Helper function to grab error information. vastAdSingleParser already grabs error data while
     * creating ad object, but some errors may occur before the object is created.
     * Note: <Error> can only live in three places: directly under <VAST>, <Ad>, or <Wrapper> elements.
     * <Error> tags are also optional so they may not always exist.
     * @public
     * @method Vast#getErrorTrackingInfo
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @param {object} ads A jQuery object which contains the collection of ad elements found
     */
    this.getErrorTrackingInfo = function(vastXML, ads) {
      _.each(ads, function(ad) {
        var error = {
          vastAdObject: null,
          errorURLs: [],
          wrapperParentId: this.wrapperParentId || null
        };

        var errorElement = $(ad).find("Error");
        if (errorElement.length > 0){
          error.errorURLs = [errorElement.text()];
        }
        var adId = $(ad).prop("id");
        this.adTrackingInfo[adId] = error;
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
        _tryRaiseAdError("VAST: No ads in XML");
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
     * Checks to see if the given Vast version supports the podded ads functionality, as per Vast specs
     * for different versions.
     * @private
     * @method Vast#supportsPoddedAds
     * @returns {boolean} true if the podded ads functionality is supported in the specified Vast version,
     *                    false otherwise
     */
    var supportsPoddedAds = _.bind(function(version) {
      return _.contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.PODDED_ADS);
    }, this);

    /**
     * Checks to see if the given Vast version supports the ad fallback functionality, as per Vast specs
     * for different versions.
     * @private
     * @method Vast#supportsAdFallback
     * @returns {boolean} true if the ad fallback functionality is supported in the specified Vast version,
     *                    false otherwise
     */
    var supportsAdFallback = _.bind(function(version) {
      return _.contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.AD_FALLBACK);
    }, this);

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
      this.amc.addPlayerListener(this.amc.EVENTS.REPLAY_REQUESTED, _.bind(this.replay, this));
      this.amc.addPlayerListener(this.amc.EVENTS.FULLSCREEN_CHANGED, _.bind(_onFullscreenChanged, this));
      this.amc.addPlayerListener(this.amc.EVENTS.SIZE_CHANGED, _onSizeChanged);
      this.amc.addPlayerListener(this.amc.EVENTS.AD_PLAYHEAD_TIME_CHANGED, _.bind(this.onAdPlayheadTimeChanged, this));
      this.amc.addPlayerListener(this.amc.EVENTS.AD_VOLUME_CHANGED, _.bind(this.onAdVolumeChanged, this));
    };

    /**
     * Callback when the media file is loaded. Once is loaded we can initialize the ad
     * This is only required for VPAID ads
     * @public
     */
    this.initializeAd = _.bind(function() {
      var eventName,
          environmentVariables,
          viewMode,
          creativeData = {};

      vpaidIframeLoaded = true;

      if (_isVpaidAd(currentAd)) {
        currentAd.data = currentAd.ad.data;

        var mediaFileUrl = _cleanString(currentAd.ad.mediaFile.url);
        if (!mediaFileUrl) {
          return null;
        }

        if (typeof vpaidIframe.contentWindow.getVPAIDAd !== 'function' && !this.testMode) {
          _tryRaiseAdError('VPAID 2.0: Required function getVPAIDAd() is not defined.');
          return;
        }

        try{
          currentAd.vpaidAd = this.testMode ? global.vpaid.getVPAIDAd() : vpaidIframe.contentWindow.getVPAIDAd();
        } catch (e) {
          _tryRaiseAdError("VPAID 2.0: error while getting vpaid creative - " + e)
        }


        // Subscribe to ad unit events
        for (eventName in VPAID_EVENTS) {
          try{
            currentAd.vpaidAd.subscribe(_.bind(_onVpaidAdEvent, this, VPAID_EVENTS[eventName]),
              VPAID_EVENTS[eventName], this);
          } catch (e) {
            _tryRaiseAdError("VPAID 2.0: error while subscribing to creative events - " + e)
          }
        }

        this._slot = _createUniqueElement();
        this._videoSlot = this.amc.ui.adVideoElement[0];

        //PBI-1609: Midroll VPAID 2.0 ads get stuck buffering on Mac Safari if
        //the VPAID creative does not call load() on the video. This is not
        //observed when using the Video Suite Inspector

        //Setting preload to auto seems to address this issue with our player
        //TODO: Find the root cause behind this issue and address it
        if (!OO.requiresSingleVideoElement && OO.isSafari) {
          this._videoSlot.preload = "auto";
        }

        environmentVariables = _.extend({
          slot: this._slot,
          videoSlot: this._videoSlot,
          videoSlotCanAutoPlay: true
        }, this.environmentVariables);

        this._properties = {
          adWidth: this._slot.offsetWidth,
          adHeight: this._slot.offsetHeight,
          adDesiredBitrate: 600
        };

        viewMode = _getFsState() ? 'fullscreen' : 'normal';
        creativeData = {
          AdParameters: currentAd.ad.adParams
        };

        this.initVpaidAd(this._properties['adWidth'], this._properties['adHeight'], viewMode,
                         this._properties['adDesiredBitrate'], creativeData, environmentVariables);
      }
    }, this);

    /**
     * Initializes the ad by sending the data to the ad unit. We then wait until we receive
     * AD_LOADED from the creative before proceeding with rendering.
     * @public
     * This is only required for VPAID ads
     * @method Vast#initVpaidAd
     * @param {number} width Width of the slot where the ad will be placed
     * @param {number} height Height of the slot where the ad will be placed
     * @param {string} viewMode Can be either `normal` or `fullscreen`
     * @param {number} desiredBitrate The bitrate for the ad
     * @param {object} creativeData Contains the aditional ad parameters for the ad
     * @param {object} environmentVars Contains the slot and videoSlot elements
     */
    this.initVpaidAd = function(width, height, viewMode, desiredBitrate, creativeData, environmentVars) {
      if (!_isValidVPaid()) {
        _tryRaiseAdError('VPaid Ad Unit is not valid.');
        return;
      }

      _clearVpaidTimeouts();
      vpaidAdLoadedTimeout = _.delay(_checkVpaidAdLoaded, this.VPAID_AD_LOADED_TIMEOUT);
      _safeFunctionCall(currentAd.vpaidAd, "initAd", [width, height, viewMode, desiredBitrate, creativeData, environmentVars]);
    };

    var _clearVpaidTimeouts = function() {
      clearTimeout(vpaidIframeLoadedTimeout);
      vpaidIframeLoadedTimeout = null;

      clearTimeout(vpaidAdLoadedTimeout);
      vpaidAdLoadedTimeout = null;

      clearTimeout(vpaidAdStartedTimeout);
      vpaidAdStartedTimeout = null;

      clearTimeout(vpaidAdStoppedTimeout);
      vpaidAdStoppedTimeout = null;
    };

    var _checkVpaidIframeLoaded = _.bind(function() {
      if (!vpaidIframeLoaded) {
        _tryRaiseAdError('VPAID: iframe did not load');
        _endAd(currentAd, true);
      }
    }, this);

    var _checkVpaidAdLoaded = _.bind(function() {
      if (!vpaidAdLoaded) {
        _tryRaiseAdError('VPAID: Did not receive AD_LOADED event from creative');
        _endAd(currentAd, true);
      }
    }, this);

    var _checkVpaidAdStarted = _.bind(function() {
      if (!vpaidAdStarted) {
        _tryRaiseAdError('VPAID: Did not receive AD_STARTED event from creative');
        _stopVpaidAd();
      }
    }, this);

    var _checkVpaidAdStopped = _.bind(function() {
      if (!vpaidAdStopped) {
        _tryRaiseAdError('VPAID: Did not receive AD_STOPPED event from creative');
        _endAd(currentAd, true);
      }
    }, this);

    /**
     * Called by Ad Manager Controller.  When this function is called, the ui has been setup and the values
     * in amc.ui are ready to be used.
     * @method Vast#registerUi
     * @public
     */
    this.registerUi = function() {
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
      this.mainContentDuration = movieMetadata.duration/1000;
      this.embedCode = this.amc.currentEmbedCode;
      // We want to prioritize the page level setting over the movie metadata
      this.allAdInfo = (pbMetadata ? pbMetadata.all_ads : null) || (movieMetadata ? movieMetadata.ads : {});

      if (pbMetadata && pbMetadata.vpaidTimeout) {
        if (_.isNumber(pbMetadata.vpaidTimeout.iframe) && pbMetadata.vpaidTimeout.iframe >= 0) {
          this.VPAID_AD_IFRAME_TIMEOUT = pbMetadata.vpaidTimeout.iframe * 1000;
        }

        if (_.isNumber(pbMetadata.vpaidTimeout.loaded) && pbMetadata.vpaidTimeout.loaded >= 0) {
          this.VPAID_AD_LOADED_TIMEOUT = pbMetadata.vpaidTimeout.loaded * 1000;
        }

        if (_.isNumber(pbMetadata.vpaidTimeout.started) && pbMetadata.vpaidTimeout.started >= 0) {
          this.VPAID_AD_STARTED_TIMEOUT = pbMetadata.vpaidTimeout.started * 1000;
        }

        if (_.isNumber(pbMetadata.vpaidTimeout.stopped) && pbMetadata.vpaidTimeout.stopped >= 0) {
          this.VPAID_AD_STOPPED_TIMEOUT = pbMetadata.vpaidTimeout.stopped * 1000;
        }
      }

      if (pbMetadata && _.isString(pbMetadata.tagUrl)) {
        this.adTagUrlOverride = pbMetadata.tagUrl;
      } else {
        this.adTagUrlOverride = null;
      }

      this.ready = true;
      this.amc.onAdManagerReady();
    };

    /**
     * [DEPRECATED]Checks to see if the current metadata contains any ads that are pre-rolls and of type vast. If there are any
     * then it will load the ads.
     * @public
     * @method Vast#loadPreRolls[DEPRECATED]
     */
    this.loadPreRolls = function() {
      //deprecated
    };

    /**
     * [DEPRECATED]Checks the metadata for any remaining ads of type vast that are not pre-rolls.
     * If it finds any then it will load them.
     * @public
     * @method Vast#loadAllVastAds[DEPRECATED]
     */
    this.loadAllVastAds = function() {
      //deprecated

    };

    /**
     * Destroys the ad manager.
     * @private
     * @method vast#failedAd
     */
    var failedAd = _.bind(function() {
      var metadata = null;
      var badAd = currentAd;
      currentAd = null;

      if (badAd) {
        if(badAd.ad && badAd.ad.fallbackAd) {
          metadata = badAd.ad.fallbackAd;
        }
        _endAd(badAd, true);
        //force fallback ad to play if it exists
        //otherwise end the ad pod
        if (metadata) {
          var ad = generateAd(metadata);
          this.amc.forceAdToPlay(this.name, ad.ad, ad.adType, ad.streams);
        } else {
          var adPod = adPodPrimary;
          adPodPrimary = null;
          if(adPod) {
             this.amc.notifyPodEnded(adPod.id);
           } else {
             this.amc.notifyPodEnded(badAd.id);
          }
        }
      }
    }, this);

    /**
     * Finds ads based on the position provided to the function.
     * @private
     * @method Vast#loadAd
     * @param {string} position The position of the ad to be loaded. 'pre' (preroll), 'midPost' (midroll and post rolls)
     * 'all' (all positions).
     * @returns {boolean} returns true if it found an ad or ads to load otherwise it returns false. This is only used for
     * unit tests.
     */
    var loadAd = _.bind(function(amcAd) {
      var loadedAds = false;
      var ad = amcAd.ad;
      this.amc.notifyPodStarted(amcAd.id, 1);

      this.currentAdBeingLoaded = ad;
      this.loadUrl(ad.tag_url);
      loadedAds = true;
      return loadedAds;
    }, this);

    /**
     * Registered as a callback with the AMC, which gets called by the Ad Manager Controller when the the play head updates
     * during ad playback.
     * @public
     * @method Vast#onAdPlayheadTimeChanged
     * @param {string} eventname The name of the event for which this callback is called
     * @param {number} playhead Current video time (seconds)
     * @param {number} duration Duration of the current video (seconds)
     */
    this.onAdPlayheadTimeChanged = function(eventName, playhead, duration) {
      var firstQuartileTime = duration / 4;
      var midpointTime = duration / 2;
      var thirdQuartileTime = (3 * duration) / 4;

      if (!trackingEventQuartiles.firstQuartile && playhead >= firstQuartileTime) {
        _handleTrackingUrls(currentAd, ["firstQuartile"]);
        trackingEventQuartiles.firstQuartile = true;
      }
      else if (!trackingEventQuartiles.midpoint && playhead >= midpointTime) {
        _handleTrackingUrls(currentAd, ["midpoint"]);
        trackingEventQuartiles.midpoint = true;
      }
      else if (!trackingEventQuartiles.thirdQuartile && playhead >= thirdQuartileTime) {
        _handleTrackingUrls(currentAd, ["thirdQuartile"]);
        trackingEventQuartiles.thirdQuartile = true;
      }
    };

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
     * Registered as a callback with the AMC, which gets called by the Ad Manager Controller when the replay button is
     * clicked. Here it will try to load the rest of the vast ads at this point if there any.
     * @public
     * @method Vast#replay
     */
    this.replay = function() {
      this.loadPreRolls();
      this.loadAllVastAds();
    };

    /**
     * TODO: out of date
     * This is required by the Ad Manager Controller but for Vast ads nothing is done here.
     * @returns The array of the new timeline to merge into the controller timeline but Vast Manager doesn't use this
     * function since we add the Ads one by one, so we just return null so it is ignored by the AMC.
     * @public
     * @method Vast#buildTimeline
     */
    this.buildTimeline = function() {
      var timeline = [];
      if (this.allAdInfo && _.isArray(this.allAdInfo))
      {
        for (var i = 0; i < this.allAdInfo.length; i++)
        {
          var adMetadata = _.clone(this.allAdInfo[i]);
          //use linear overlay as fake ad so we don't have to specify stream type.
          var adData = {
            adManager: this.name,
            ad: adMetadata,
            duration: 0,
            adType: this.amc.ADTYPE.AD_REQUEST
          };

          if (adMetadata.position_type == 't') {
            //Movie metadata uses time, page level metadata uses position
            if (_isValidPosition(adMetadata.time)) {
              adData.position = +adMetadata.time / 1000;
            } else if (_isValidPosition(adMetadata.position)) {
              adData.position = +adMetadata.position / 1000;
            }
          } else if (adMetadata.position_type == 'p') {
            if (_isValidPosition(adMetadata.position)) {
              adData.position = +adMetadata.position / 100 * this.mainContentDuration;
            }
          }
          adMetadata.position = adData.position;

          //Movie metadata uses url, page level metadata uses tag_url
          if (!adMetadata.tag_url) {
            adMetadata.tag_url = adMetadata.url;
          }

          //Force usage of the ad tag url override if it is valid
          if (_.isString(this.adTagUrlOverride)) {
            adMetadata.tag_url = this.adTagUrlOverride;
          }

          //Only add to timeline if the tag url and position are valid
          if (_.isString(adMetadata.tag_url) && _isValidPosition(adMetadata.position)) {
            var amcAd = new this.amc.Ad(adData);
            timeline.push(amcAd);
          }
        }
      }
      return timeline;
    };

    /**
     * Checks to see if the provided position metadata is valid.
     * @private
     * @method Vast#_isValidPosition
     * @param {*} position The position metadata to check
     * @returns {boolean} True if the position is valid, false otherwise
     */
    var _isValidPosition = _.bind(function(position) {
      //Unary + returns 1 for true and 0 for false and null
      //To avoid this, we check to see if position is a number or a string
      return (typeof position === 'string' || typeof position === 'number') && _.isFinite(+position);
    }, this);

    /**
     * Called when the ad starts playback.
     * @public
     * @method Vast#adVideoPlaying
     */
    this.adVideoPlaying = function() {
      if (currentAd && currentAd.ad && currentAd.ad.nextAdInPod && !fromPause) {
        var metadata = currentAd.ad.nextAdInPod;
        if (metadata) {
          var ad = generateAd(metadata);

          if (metadata.streamUrl != null ||
              (ad.adType == this.amc.ADTYPE.LINEAR_VIDEO && !_.isEmpty(metadata.streams)) ||
              _isVpaidAd(currentAd)) {
            nextAd = ad;
          }
        }
      }
      fromPause = false;
      //TODO: VPAID: Figure out why this is called when resuming video from clicking to non video
    };

    /**
     * When the ad is finished playing we need to call the AMC callback that was provided to let the AMC know that the
     * ad is finished playing.
     * @public
     * @method Vast#adVideoEnded
     */
    this.adVideoEnded = function() {
      prevAd = currentAd;

      //VPAID 2.0 ads will end after notifying the ad of stopAd
      if (!_isVpaidAd(currentAd)) {
        _endAd(currentAd, false);
        _handleTrackingUrls(prevAd, ["complete"]);
      }

      adMode = false;
    };

    /**
     * When the ad fails to play we need to call the AMC callback that was provided to let the AMC know that the
     * ad is finished playing and we need to follow the process for cleaning up after an ad fails.
     * @public
     * @method Vast#adVideoError
     * @param {object} adWrapper The current Ad's metadata
     * @param {number} errorCode The error code associated with the VTC error
     */
    this.adVideoError = function(adWrapper, errorCode) {
      // VTC will pause the ad when the video element loses focus
      // TODO: add douglas error handling changes
      _tryRaiseAdError('Ad failed to play with error code: ', errorCode);
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
      adMode = true;
      trackingEventQuartiles = {};
      if (adWrapper) {
        currentAd = adWrapper;
        if (currentAd.ad) {
          if (currentAd.adType === this.amc.ADTYPE.AD_REQUEST) {
            loadAd(currentAd);
          } else {
            _playLoadedAd(adWrapper);
          }
        }
      }
    };

    /**
     * Ping a list of tracking event names' URLs.
     * @private
     * @method Vast#_handleTrackingUrls
     * @param {object} amcAd The AMC ad object
     * @param {string[]} trackingEventNames The array of tracking event names
     */
    var _handleTrackingUrls = _.bind(function(amcAd, trackingEventNames) {
      if (!_isVpaidAd(amcAd)) {
        var adId = _getAdId(amcAd);

        if (amcAd) {
          _.each(trackingEventNames, function(trackingEventName) {
            var urls;
            switch (trackingEventName) {
              case "impression":
                urls = _getImpressionUrls(amcAd);
                break;
              case "linearClickTracking":
                urls = _getLinearClickTrackingUrls(amcAd);
                break;
              case "nonLinearClickTracking":
                urls = _getNonLinearClickTrackingUrls(amcAd);
                break;
              default:
                urls = _getTrackingEventUrls(amcAd, trackingEventName);
            }
            var urlObject = {};
            urlObject[trackingEventName] = urls;
            _pingTrackingUrls(urlObject, adId);
          });
        }
        else {
          console.log(
              "VAST: Tried to ping URLs: [" + trackingEventNames +
              "] but ad object passed in was: " + amcAd
          );
        }

        // Try to ping parent tracking events as well
        if (this.adTrackingInfo &&
            this.adTrackingInfo[adId] &&
            this.adTrackingInfo[adId].wrapperParentId) {
          var parentId = this.adTrackingInfo[adId].wrapperParentId;
          var parentAdTrackingObject = this.adTrackingInfo[parentId];
          if (parentAdTrackingObject) {
            var parentAdObject = this.adTrackingInfo[parentId].vastAdObject;
            _handleTrackingUrls(parentAdObject, trackingEventNames);
          }
        }
      }
    }, this);

    /**
     * Helper function to return the object that directly contains the VAST ad information.
     * @private
     * @method Vast#_getVastAdObject
     * @param {object} amcAd The AMC Ad object containing the VAST ad object, or the VAST ad
     * object itself
     * @returns {object} The VAST ad object.
     */
    var _getVastAdObject = function(amcAd) {
      var vastAdObject = null;
      if (amcAd &&
          amcAd.ad &&
          amcAd.ad.data) {
        vastAdObject = amcAd.ad.data;
      }
      else if (amcAd &&
               amcAd.data) {
        vastAdObject = amcAd.data;
      }
      else {
        vastAdObject = amcAd;
      }
      return vastAdObject;
    };

    /**
     * Helper function to retrieve the ad object's impression urls.
     * @private
     * @method Vast#_getImpressionUrls
     * @param {object} amcAd The AMC ad object
     * @return {string[]|null} The array of impression urls. Returns null if no URLs exist.
     */
    var _getImpressionUrls = function(amcAd) {
      var vastAdObject = _getVastAdObject(amcAd);
      var impressionUrls = null;
      if (vastAdObject &&
          vastAdObject.impression &&
          vastAdObject.impression.length > 0) {
        impressionUrls = vastAdObject.impression;
      }
      return impressionUrls;
    };

    /**
     * Helper function to retrieve the ad object's linear click tracking urls.
     * @private
     * @method Vast#_getLinearClickTrackingUrls
     * @param {object} amcAd The AMC ad object
     * @return {string[]|null} The array of linear click tracking urls. Returns null if no
     * URLs exist.
     */
    var _getLinearClickTrackingUrls = function(amcAd) {
      var vastAdObject = _getVastAdObject(amcAd);
      var linearClickTrackingUrls = null;
      if (vastAdObject &&
          vastAdObject.linear &&
          vastAdObject.linear.clickTracking &&
          vastAdObject.linear.clickTracking.length > 0) {
        linearClickTrackingUrls = vastAdObject.linear.clickTracking;
      }
      return linearClickTrackingUrls;
    };

    /**
     * Helper function to retrieve the ad object's linear click through url.
     * @private
     * @method Vast#_getLinearClickThroughUrl
     * @param {object} amcAd The AMC ad object
     * @return {string|null} The linear click through url. Returns null if no
     * URL exists.
     */
    var _getLinearClickThroughUrl = function(amcAd) {
      var vastAdObject = _getVastAdObject(amcAd);
      var linearClickThroughUrl = null;
      if (vastAdObject &&
          vastAdObject.linear &&
          vastAdObject.linear.clickThrough) {
        linearClickThroughUrl = vastAdObject.linear.clickThrough;
      }
      return linearClickThroughUrl;
    };

    /**
     * Helper function to retrieve the ad object's nonlinear click through url.
     * @private
     * @method Vast#_getNonLinearClickThroughUrl
     * @param {object} amcAd The AMC ad object
     * @return {string|null} The nonlinear click through url. Returns null if no
     * URL exists.
     */
    var _getNonLinearClickThroughUrl = function(amcAd) {
      var vastAdObject = _getVastAdObject(amcAd);
      var nonLinearClickThroughUrl = null;
      if (vastAdObject &&
          vastAdObject.nonLinear &&
          vastAdObject.nonLinear.nonLinearClickThrough) {
        nonLinearClickThroughUrl = vastAdObject.nonLinear.nonLinearClickThrough;
      }
      return nonLinearClickThroughUrl;
    };

    /**
     * Helper function to retrieve the ad object's nonlinear click tracking urls.
     * @private
     * @method Vast#_getNonLinearClickTrackingUrls
     * @param {object} amcAd The AMC ad object
     * @return {string[]|null} The array of nonlinear click tracking urls. Returns null if no
     * URLs exist.
     */
    var _getNonLinearClickTrackingUrls = function(amcAd) {
      var vastAdObject = _getVastAdObject(amcAd);
      var nonLinearClickTrackingUrls = null;
      if (vastAdObject &&
          vastAdObject.nonLinear &&
          vastAdObject.nonLinear.nonLinearClickTracking &&
          vastAdObject.nonLinear.nonLinearClickTracking.length > 0) {
        nonLinearClickTrackingUrls = vastAdObject.nonLinear.nonLinearClickTracking;
      }
      return nonLinearClickTrackingUrls;
    };

    /**
     * Helper function to get an ad object's "high level" click through url.
     * @private
     * @method Vast#_getHighLevelClickThroughUrl
     * @param {object} amcAd The AMC ad object
     * @returns {string|null} The clickthrough URL string. Returns null if one does not exist.
     */
    var _getHighLevelClickThroughUrl = function(amcAd) {
      var vastAdObject = _getVastAdObject(amcAd);
      var highLevelClickThroughUrl = null;
      if (vastAdObject &&
          vastAdObject.clickThrough) {
        highLevelClickThroughUrl = vastAdObject.clickThrough;
      }
      return highLevelClickThroughUrl;
    };

    /**
     * Helper function to get an ad object's "ooyala" click through url.
     * @private
     * @method Vast#_getOoyalaClickThroughUrl
     * @param {object} amcAd The AMC ad object
     * @returns {string|null} The clickthrough URL string. Returns null if one does not exist.
     */
    var _getOoyalaClickThroughUrl = function(amcAd) {
      var ooyalaClickThroughUrl = null;
      if (amcAd &&
          amcAd.click_url) {
        ooyalaClickThroughUrl = amcAd.click_url;
      }
      return ooyalaClickThroughUrl;
    };

    /**
     * Helper function to retrieve the ad object's tracking urls under a specific event name.
     * @private
     * @method Vast#_getTrackingEventUrls
     * @param {object} amcAd The AMC ad object
     * @param {string} trackingEventName The name of the tracking event
     * @returns {string[]|null} The array of tracking urls associated with the event name. Returns null if no URLs exist.
     */
    var _getTrackingEventUrls = function(amcAd, trackingEventName) {
      var vastAdObject = _getVastAdObject(amcAd);
      var trackingUrls = null;

      // get tracking urls from both the linear and nonLinear object
      var linearTrackingUrls = [];
      var nonLinearTrackingUrls = [];

      if (vastAdObject &&
          vastAdObject.linear &&
          vastAdObject.linear.tracking &&
          vastAdObject.linear.tracking[trackingEventName] &&
          vastAdObject.linear.tracking[trackingEventName].length > 0) {
        linearTrackingUrls = vastAdObject.linear.tracking[trackingEventName];
      }

      if (vastAdObject &&
          vastAdObject.nonLinear &&
          vastAdObject.nonLinear.tracking &&
          vastAdObject.nonLinear.tracking[trackingEventName] &&
          vastAdObject.nonLinear.tracking[trackingEventName].length > 0) {
        nonLinearTrackingUrls = vastAdObject.nonLinear.tracking[trackingEventName];
      }

      if (!_.isEmpty(linearTrackingUrls) || !_.isEmpty(nonLinearTrackingUrls)) {
        trackingUrls = linearTrackingUrls.concat(nonLinearTrackingUrls);
      }

      return trackingUrls;
    };

    /**
     * Helper function to retrieve the ad object's ad ID (the value of the <Ad> element's "id" attribute).
     * Not the "id" our ad manager assigns.
     * @private
     * @method Vast#_getAdId
     * @param {object} amcAd The AMC ad object
     * @returns {string|null} The ad's ID attribute. Returns null if the ID does not exist.
     */
    var _getAdId = function(amcAd) {
      var vastAdObject = _getVastAdObject(amcAd);
      var adId = null;
      if (vastAdObject &&
          vastAdObject.id) {
        adId = vastAdObject.id;
      }
      return adId;
    };

    /**
     * Helper function to ping URLs in each set of tracking event arrays.
     * @private
     * @method Vast#_pingTrackingUrls
     * @param {object} urlObject An object with the tracking event names and their
     * associated URL array.
     * @param {object} adId The ad ID
     */
    var _pingTrackingUrls = _.bind(function(urlObject, adId) {
      for (var trackingName in urlObject) {
        if (urlObject.hasOwnProperty(trackingName)) {
          try {
            var urls = urlObject[trackingName];
            if (urls) {
              OO.pixelPings(urls);
              OO.log("VAST: \"" + trackingName + "\" tracking URLs pinged for VAST Ad Id: " + adId);
            }
            else {
              OO.log("VAST: No \"" + trackingName + "\" tracking URLs provided to ping for VAST Ad Id: " + adId);
            }
          }
          catch(e) {
            _tryRaiseAdError("VAST: Failed to ping \"" + trackingName + "\" tracking URLs for VAST Ad Id: " + adId);
          }
        }
      }
    }, this);

    /**
     * Play an ad from the AMC timeline that has already be loaded (AKA is not an
     * ad request).
     * @private
     * @method Vast#_playLoadedAd
     * @param  {object} adWrapper An object of type AdManagerController.Ad containing ad metadata
     */
    var _playLoadedAd = _.bind(function(adWrapper) {

      var isVPaid = _isVpaidAd(currentAd);

      // When the ad is done, trigger callback
      if (adWrapper.isLinear) {
        if (adWrapper.ad.adPodIndex === 1) {
          //Only handle primary if it is null, to prevent fallback ad from staring
          //another ad pod
          if (adPodPrimary === null) {
            adPodPrimary = adWrapper;
            this.amc.notifyPodStarted(adWrapper.id, adWrapper.ad.adPodLength);
          }
        }

        var hasClickUrl = adWrapper.ad.data.linear.clickThrough.length > 0;
        this.amc.notifyLinearAdStarted(adWrapper.id, {
          name: adWrapper.ad.data.title,
          duration: adWrapper.ad.durationInMilliseconds/1000,
          hasClickUrl: hasClickUrl,
          indexInPod: adWrapper.ad.adPodIndex,
          skippable: false
        });
      } else {
        var streamUrl;
        if (adWrapper.ad && adWrapper.ad.streamUrl) {
          streamUrl = adWrapper.ad.streamUrl;
        }
        else if (adWrapper.streamUrl) {
          streamUrl = adWrapper.streamUrl;
        } else {
          //TODO: What happens when streamUrl is the empty string? Will AMC get notified of an error?
          streamUrl = '';
        }

        this.amc.sendURLToLoadAndPlayNonLinearAd(adWrapper, adWrapper.id, streamUrl);
      }
      if (isVPaid) {
        //Since a VPAID 2.0 ad handles its own UI, we want the video player to hide its UI elements
        this.amc.hidePlayerUi();
        _getFrame();
      } else {
        // For VPAID we can only set the skip offset and check for companions when ad already started
        this.checkCompanionAds(adWrapper.ad);
        initSkipAdOffset(adWrapper);
      }

      // try and ping tracking URLs
      _handleTrackingUrls(adWrapper, ["creativeView", "start", "impression"]);
    }, this);

    /**
     * Determine if a Vast ad is skippable, and if so, when the skip ad button should be displayed.
     * Notifies AMC of the result.
     * @private
     * @method Vast#initSkipAdOffset
     * @param {object} adWrapper The current Ad's metadata
     */
    var initSkipAdOffset = _.bind(function(adWrapper) {
      var isVPaid = _isVpaidAd(adWrapper);
      var adSkippableState = false;
      var skipOffset = '';
      if (isVPaid) {
        adSkippableState = _safeFunctionCall(adWrapper.vpaidAd, "getAdSkippableState");
      }

      var canSkipAds = false;
      if (adWrapper && adWrapper.ad && adWrapper.ad.data) {
        canSkipAds = supportsSkipAd(adWrapper.ad.data.version);
      }

      if (canSkipAds) {
        skipOffset = adWrapper.ad.data.linear.skipOffset;

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
          if (!isVPaid) {
            this.amc.showSkipVideoAdButton(false);
          } else {
            this.amc.showSkipVideoAdButton(adSkippableState,
                            this.amc.adManagerSettings['linearAdSkipButtonStartTime'].toString());
          }
        }
      } else {
        //For Vast versions that don't support the skipoffset attribute, we
        //want to use Ooyala's settings for displaying the skip ad button
          if (!isVPaid) {
            this.amc.showSkipVideoAdButton(true);
          } else {
            this.amc.showSkipVideoAdButton(adSkippableState,
                            this.amc.adManagerSettings['linearAdSkipButtonStartTime'].toString());
          }
      }
    }, this);

    /**
     * This is called by the Ad Manager Controller when it needs to cancel an Ad due to a timeout or skip button.
     * @public
     * @method Vast#cancelAd
     * @param {object} ad The Ad that needs to be cancelled
     * @param {object} params An object containing information about the cancellation
     *                        code : The amc.AD_CANCEL_CODE for the cancellation
     */
    this.cancelAd = function(ad, params) {
      //TODO: add timout logic if needed here as well.
      if (!this.amc || !this.amc.ui || !ad) {
        return;
      }
      if (params) {
        if (params.code === this.amc.AD_CANCEL_CODE.TIMEOUT) {
          failedAd();
        }
        else if (params.code === this.amc.AD_CANCEL_CODE.SKIPPED && currentAd) {
          if (currentAd.vpaidAd) {
            // Notify Ad Unit that we are skipping the ad
            _safeFunctionCall(currentAd.vpaidAd, "skipAd");
          }
          else if (ad.isLinear) {
            _skipAd(currentAd);
          }
        }
      }
      else {
        _endAd(ad, false);
      }
    };

    /**
     * Called when a linear ad is skipped.
     * @private
     * @method Vast#_skipAd()
     * @param {object} currentAd The ad metadata
     */
    var _skipAd = _.bind(function() {
      prevAd = currentAd;
      _endAd(currentAd, false);
      _handleTrackingUrls(prevAd, ["skip"]);
      adMode = false;
    }, this);

    /**
     * Ends an ad. Notifies the AMC about the end of the ad. If it is the last linear ad in the pod,
     * will also notify the AMC of the end of the ad pod.
     * @private
     * @method Vast#_endAd
     * @param {object} ad The ad to end
     * @param {boolean} failed If true, the ending of this ad was caused by a failure
     */
    var _endAd = _.bind(function(ad, failed) {
      _clearVpaidTimeouts();
      if (typeof this._slot !== 'undefined') {
        $(this._slot).remove();
      }

      if (typeof vpaidIframe !== 'undefined') {
        $(vpaidIframe).remove();
      }

      if (currentAd && ad) {
        currentAd = null;
        var isLinear = (ad.vpaidAd ? _safeFunctionCall(ad.vpaidAd, "getAdLinear") : false) || ad.isLinear;
        if (isLinear) {
          this.amc.notifyLinearAdEnded(ad.id);
          //TODO: What does this block do?
          if (transitionFromNonLinearVideo) {
            this.amc.ui.transitionToMainContent(true, false);
            transitionFromNonLinearVideo = false;
            this.amc.notifyNonlinearAdEnded(ad.id);
          }
          if((ad.ad.adPodIndex === ad.ad.adPodLength && !failed) || !nextAd) {
            var adPod = adPodPrimary || ad.id;
            adPodPrimary = null;
            this.amc.notifyPodEnded(adPod.id);
          }
        } else {
          this.lastOverlayAd = null;
          this.amc.notifyNonlinearAdEnded(ad.id);
        }
      }

      if (nextAd) {
        var next = nextAd;
        nextAd = null;
        this.amc.forceAdToPlay(this.name, next.ad, next.adType, next.streams);
      }
    }, this);

    /**
     * Called by the Ad Manager Controller when the module is unregistered, we need to remove any overlays that are visible.
     * @public
     * @method Vast#destroy
     * @param {object} ad Ad to cancel if it is not null
     */
    this.destroy = function() {
      // Stop any running ads
      this.cancelAd(currentAd);
      this.ready = false;
      this.currentDepth = 0;
      this.lastOverlayAd = null;
      adPodPrimary = null;
    };

    /**
     * Generates an AdManagerController (AMC) Ad object from the provided metadata.
     * @private
     * @method Vast#generateAd
     * @param {object} metadata The ad metadata to be used for the AMC Ad object
     * @return {object} The AMC Ad object
     */
    var generateAd = _.bind(function(metadata) {
      if (!metadata) return false;
      var duration;

      if (!_.isEmpty(metadata.data.linear.mediaFiles)) {
        duration = OO.timeStringToSeconds(metadata.data.linear.duration);
      }
      else
      {
        duration = metadata.data.nonLinear.duration ?  OO.timeStringToSeconds(metadata.data.nonLinear.duration) : 0;
      }

      var ad = new this.amc.Ad({
        position: metadata.positionSeconds, duration: duration, adManager: this.name,
        ad: metadata, adType: metadata.data.type, streams: metadata.streams
      });

      if (metadata.data.adType === "vpaid") {
        ad.videoRestrictions = vpaidVideoRestrictions;
      }

      return ad;
    }, this);

    /**
     * Takes an ad and adds it to the timeline by calling appenedToTimeline which is an Ad Manager Controller function.
     * Also the properties of whether an ad is linear or not, and whether or not the marquee should show are set here.
     * @private
     * @method Vast#addToTimeline
     * @param {object} metadata The ad metadata that is being added to the timeline
     * @returns {boolean} True if the ad was added to the timeline successfully, false otherwise.
     */
    var addToTimeline = _.bind(function(metadata) {
      if (!metadata) return;
      var timeline = [];
      var ad = generateAd(metadata);
      var isVPaid = metadata.data && metadata.data.adType === 'vpaid';

      //TODO: This might need to get integrated with Doug's error handling changes.
      //I recall errors for when streams or media files aren't defined. We need to check with Doug on this when we merge.
      if (metadata.streamUrl != null ||
          (ad.adType == this.amc.ADTYPE.LINEAR_VIDEO && !_.isEmpty(metadata.streams)) ||
          (ad.adType === this.amc.ADTYPE.NONLINEAR_OVERLAY && !_.isEmpty(metadata.data.nonLinear.mediaFiles.url))) {
        timeline.push(ad);
        this.amc.appendToTimeline(timeline);
        return true;
      }

      return false;
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
     * @param {string} wrapperParentId The current ad's "parent" ad id. Could be
     * undefined if ad does not have parent/wrapper. We want to pass this in to the next vast response
     * so the new ad knows who its parent is for tracking event purposes.
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
        success: (dataType == "script") ? function() {} : _.bind(this.onResponse, this, wrapperParentId,
            loadingAd || this.currentAdBeingLoaded),
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
      if (!amcAd || !showPage) {
        return;
      }
      var urlOpened = false;
      var highLevelClickThroughUrl = _getHighLevelClickThroughUrl(amcAd);
      var ooyalaClickUrl = _getOoyalaClickThroughUrl(amcAd);
      var adSpecificClickThroughUrl;

      if (highLevelClickThroughUrl) {
        urlOpened = urlOpened || this.openUrl(highLevelClickThroughUrl);
      }

      if (ooyalaClickUrl) {
        urlOpened = urlOpened || this.openUrl(ooyalaClickUrl);
      }

      //TODO: Why was this amcAd.ad.data in the else removed? Was it causing an issue?
      if (amcAd.isLinear) {
        adSpecificClickThroughUrl = _getLinearClickThroughUrl(amcAd);
        urlOpened = urlOpened || this.openUrl(adSpecificClickThroughUrl);
        _handleTrackingUrls(amcAd, ["linearClickTracking"]);
      } else {
        adSpecificClickThroughUrl = _getNonLinearClickThroughUrl(amcAd);
        urlOpened = urlOpened || this.openUrl(adSpecificClickThroughUrl);
        _handleTrackingUrls(amcAd, ["nonLinearClickTracking"]);
      }

      if (urlOpened) {
        this.amc.adsClickthroughOpened();
      }
    };

    /**
     * Pauses the ad element.
     * @public
     * @method Vast#pauseAd
     * @param {object} amcAd The current ad data
     */
    this.pauseAd = function(amcAd) {
      // Need to notify the ad unit that the player was paused
      if (currentAd && currentAd.vpaidAd) {
        _safeFunctionCall(currentAd.vpaidAd, "pauseAd");
      }
      _handleTrackingUrls(amcAd, ["pause"]);
    };

    /**
     * Resume the ad element.
     * @public
     * @method Vast#resumeAd
     * @param {object} amcAd The current ad data
     */
    this.resumeAd = function(amcAd) {
      // Need to notify the ad unit that the player was resumed
      if (currentAd && currentAd.vpaidAd) {
        _safeFunctionCall(currentAd.vpaidAd, "resumeAd");
      }
      _handleTrackingUrls(amcAd, ["resume"]);
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
     * This function gets called by the Ad Manager Controller when an ad has completed playing. If the main video is
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
     * This function gets called by the Ad Manager Controller when an overlay has been canceled by clicking the close button.
     * @public
     * @method Vast#cancelOverlay
     */
    this.cancelOverlay = function() {
      _handleTrackingUrls(currentAd, ["close"]);
    };

    /**
     * Opens a new page pointing to the URL provided.
     * @public
     * @method Vast#openUrl
     * @param {string} url The url that we need to open in a new page
     * @returns {boolean} true, if the URL is valid. Returns false, if url is invalid.
     */
    this.openUrl = function(url) {
      if (!url || typeof url !== 'string') {
        return false;
      }
      var newWindow = window.open(url);
      newWindow.opener = null;
      newWindow.location = url;
      return true;
    };

    /**
     * Calls ajax to load the Ad via the url provided.
     * @public
     * @method Vast#loadUrl
     * @param {string} url The Ad creative url
     */
    this.loadUrl = function(url) {
      this.vastUrl = url;
      if (!this.testMode) {
        this.ajax(url, this.onVastError, 'xml');
      }
    };

    /**
     *  If the Ad fails to load this callback is called.
     *  @public
     *  @method Vast#onVastError
     */
    this.onVastError = function() {
      _tryRaiseAdError("VAST: Ad failed to load");
      failedAd();
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
      if (currentAdId && currentAdId in this.adTrackingInfo) {
        this.pingURLs(this.adTrackingInfo[currentAdId].errorURLs);
        var parentId = this.adTrackingInfo[currentAdId].wrapperParentId;

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
     * Extracts the creative based on the format type that is expected.
     * @public
     * @method Vast#extractStreamForType
     * @param {object[]} streams The stream choices from the metadata
     * @param {string} type The type of video we want to use for the creative
     * @returns {string} The creative url if it finds one, otherwise null.
     */
    this.extractStreamForType = function(streams, type) {
      var filter = [];
      // TODO: Add MIME types for the other encoding types that we support
      switch (type) {
        case "hls":
          filter.push("application/x-mpegurl");
          filter.push("application/mpegurl");
          filter.push("audio/mpegurl");
          filter.push("audio/x-mpegurl");
          break;
        default:
          filter.push("video/" +type);
      }
      var stream = _.find(streams, function(stream) {
        return (filter.indexOf(stream.type) >= 0);
      }, this);
      return stream ? stream.url : null;
    };

    /**
     * Helper function to determine if the ad is a linear ad.
     * @private
     * @method Vast#_hasLinearAd
     * @param {object} ad The ad object
     * @returns {boolean} true if the ad is a linear ad, false otherwise.
     */
    var _hasLinearAd = _.bind(function(ad) {
      return (!_.isEmpty(ad.linear));
    }, this);

    /**
     * Helper function to determine if the ad is a nonlinear ad.
     * @private
     * @method Vast#_hasNonLinearAd
     * @param {object} ad The ad object
     * @returns {boolean} true if the ad is a nonlinear ad, false otherwise.
     */
    var _hasNonLinearAd = _.bind(function(ad) {
      return (!_.isEmpty(ad.nonLinear));
    }, this);

    /**
     *  If a linear ad is found, then it is parsed and sent to be added to the time via addToTimeLine.
     * @private
     * @method Vast#_handleLinearAd
     * @param {object} ad The ad object
     * @param {object} adLoaded The ad that was loaded
     * @param {object} params Additional parameters associated with this ad
     *                        adPodIndex : the index of the ad pod this ad is housed in
     *                        adPodLength : the total number of ads in the ad pod this ad is housed in
     * @returns {object} The ad unit object ready to be added to the timeline
     */
    var _handleLinearAd = _.bind(function(ad, adLoaded, params) {
      if (!ad || _.isEmpty(ad.linear.mediaFiles)) {
        _tryRaiseAdError("VAST: General Linear Ads Error; No Mediafiles in Ad ", ad);
        // Want to ping error URLs at current depth if there are any available
        this.trackError(this.ERROR_CODES.GENERAL_LINEAR_ADS, ad.id);
        return null;
      }

      params = params ? params : {};
      var mediaFiles = ad.linear.mediaFiles;
      var maxMedia = _.max(mediaFiles, function(v) { return parseInt(v.bitrate, 10); });
      var vastAdUnit = { data: {}, vastUrl: this.vastUrl, maxBitrateStream: null };
      vastAdUnit.maxBitrateStream = maxMedia && maxMedia.url;
      vastAdUnit.durationInMilliseconds = OO.timeStringToSeconds(ad.linear.duration) * 1000;
      _.extend(vastAdUnit.data, ad);
      vastAdUnit.data.tracking = ad.linear.tracking;
      vastAdUnit.data.type = this.amc.ADTYPE.LINEAR_VIDEO;
      vastAdUnit.adPodIndex = params.adPodIndex ? params.adPodIndex : 1;
      vastAdUnit.adPodLength = params.adPodLength ? params.adPodLength : 1;
      vastAdUnit.positionSeconds = adLoaded.position;
      vastAdUnit.repeatAfter = adLoaded.repeatAfter ? adLoaded.repeatAfter : null;

      // Save the stream data for use by VideoController
      var streams = {};
      var linearAd = ad.linear;
      if (linearAd && linearAd.mediaFiles) {
        var vastStreams = linearAd.mediaFiles;
        var videoEncodingsSupported = OO.VIDEO.ENCODING;
        var streamData;
        for (var encoding in videoEncodingsSupported) {
          streamData = null;
          streamData = this.extractStreamForType(vastStreams, videoEncodingsSupported[encoding]);
          if (streamData) {
            streams[videoEncodingsSupported[encoding]] = streamData;
          }
        }
      }

      vastAdUnit.streams = streams;
      return vastAdUnit;
    }, this);

    /**
     * If a non-linear Ad is found then it is parsed and added to the timeline via the addToTimeline function.
     * @private
     * @method Vast#_handleNonLinearAd
     * @param {object} ad The ad object
     * @param {object} adLoaded The ad that was loaded
     * @param {object} params Additional parameters associated with this ad
     *                        adPodIndex : the index of the ad pod this ad is housed in
     *                        adPodLength : the total number of ads in the ad pod this ad is housed in
     * @returns {object} The ad unit object ready to be added to the timeline
     */
    var _handleNonLinearAd = _.bind(function(ad, adLoaded, params) {
      // filter our playable stream:
      if (!ad || _.isEmpty(ad.nonLinear.url)) {
        _tryRaiseAdError("VAST: General NonLinear Ads Error: Cannot Find Playable Stream in Ad ", ad);
        // Want to ping error URLs at current depth if there are any available
        this.trackError(this.ERROR_CODES.GENERAL_NONLINEAR_ADS, ad.id);
        return null;
      }
      params = params ? params : {};
      var adURL = ad.nonLinear.url;
      var vastAdUnit = { data: {}, vastUrl: this.vastUrl, maxBitrateStream: null };
      vastAdUnit.streamUrl = adURL;
      _.extend(vastAdUnit.data, ad);
      vastAdUnit.data.tracking = ad.nonLinear.tracking;
      vastAdUnit.data.type = this.amc.ADTYPE.NONLINEAR_OVERLAY;
      vastAdUnit.adPodIndex = params.adPodIndex ? params.adPodIndex : 1;
      vastAdUnit.adPodLength = params.adPodLength ? params.adPodLength : 1;
      vastAdUnit.positionSeconds = adLoaded.position;
      vastAdUnit.repeatAfter = adLoaded.repeatAfter ? adLoaded.repeatAfter : null;

      return vastAdUnit;
    }, this);

    /**
     * Takes all the ad data that is in the inline xml and merges them all together into the ad object.
     * @public
     * @method Vast#mergeVastAdResult
     * @param {object} ad The ad object
     * @param {object} wrapperAds The object containing wrapper ads parameters
     */
    this.mergeVastAdResult = function(ad, wrapperAds) {
      ad.error = wrapperAds.error.concat(ad.error);
      ad.impression = wrapperAds.impression.concat(ad.impression);
      ad.companion = wrapperAds.companion.concat(ad.companion);
      if (wrapperAds.linear.clickTracking) {
        ad.linear.clickTracking = wrapperAds.linear.clickTracking.concat(ad.linear.clickTracking || []);
      }
      if (wrapperAds.linear.tracking) {
        if (!ad.linear.tracking) { ad.linear.tracking  = {}; }
        _.each(wrapperAds.linear.tracking, function(value, key) {
          ad.linear.tracking[key] = ad.linear.tracking[key] ? value.concat(ad.linear.tracking[key]) : value;
        });
      }
      if (wrapperAds.nonLinear.tracking) {
        if (!ad.nonLinear.tracking) { ad.nonLinear.tracking = {}; }
        _.each(wrapperAds.nonLinear.tracking, function(value, key) {
          ad.nonLinear.tracking[key] = ad.nonLinear.tracking[key] ? value.concat(ad.nonLinear.tracking[key]) : value;
        });
      }
    };

    /**
     * Checks if there is any companion ads associated with the ad and if one is found, it will call the Ad Manager
     * Controller to show it.
     * @public
     * @method Vast#checkCompanionAds
     * @param {object} adInfo The Ad metadata
     */
    this.checkCompanionAds = function(adInfo) {
      var data = adInfo.data,
          adUnitCompanions = currentAd.vpaidAd ? _safeFunctionCall(currentAd.vpaidAd, "getAdCompanions") : null,
          companions;

      // If vast template has no companions (has precedence), check the adCompanions property from the ad Unit
      // This rules is only for VPaid, it will take data.companion otherwise anyway
      companions = data && !_.isEmpty(data.companion) ? data.companion : adUnitCompanions;

      if (_.isEmpty(companions)) {
        return;
      }

      this.amc.showCompanion(companions);
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
      var staticResource = _cleanString(companionAdXml.find('StaticResource').text());
      var iframeResource = _cleanString(companionAdXml.find('IFrameResource').text());
      var htmlResource = _cleanString(companionAdXml.find('HTMLResource').text());

      parseTrackingEvents(result.tracking, companionAdXml, ["creativeView"]);

      result = {
        tracking: result.tracking,
        width: companionAdXml.attr('width'),
        height: companionAdXml.attr('height'),
        expandedWidth: companionAdXml.attr('expandedWidth'),
        expandedHeight: companionAdXml.attr('expandedHeight'),
        companionClickThrough: companionAdXml.find('CompanionClickThrough').text()
      };

      if (staticResource.length) {
        _.extend(result, { type: 'static', data: staticResource, url: staticResource });
      } else if (iframeResource.length) {
        _.extend(result, { type: 'iframe', data: iframeResource, url: iframeResource });
      } else if (htmlResource.length) {
        _.extend(result, { type: 'html', data: htmlResource, htmlCode: htmlResource });
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
        // clickTracking needs to be remembered because it can exist in wrapper ads
        clickTracking: filterEmpty($(linearXml).find("ClickTracking").map(function() { return $(this).text(); })),
        //There can only be one clickthrough as per Vast 2.0/3.0 specs and XSDs
        clickThrough: $(linearXml).find("ClickThrough").text(),
        customClick: filterEmpty($(linearXml).find("CustomClick").map(function() { return $(this).text(); }))
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
        result.duration = linearXml.find("Duration").text();
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
        result.nonLinearClickThrough = nonLinear.find("NonLinearClickThrough").text();
        result.nonLinearClickTracking = filterEmpty($(nonLinearAdsXml).
                                        find("NonLinearClickTracking").
                                        map(function() { return $(this).text(); }));

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
     * @method Vast#vastAdSingleParser
     * @param {XMLDocument} xml The xml that contains the ad data
     * @param {number} version The Vast version
     * @returns {object} The ad object otherwise it returns 1.
     */
    var vastAdSingleParser = _.bind(function(xml, version) {
      var result = getVastTemplate();
      var jqueryXML = $(xml);
      var inline = jqueryXML.find(AD_TYPE.INLINE);
      var wrapper = jqueryXML.find(AD_TYPE.WRAPPER);

      if (inline.size() > 0) {
        result.type = AD_TYPE.INLINE;
      } else if (wrapper.size() > 0) {
        result.type = AD_TYPE.WRAPPER;
      } else {
        //TODO: See if returning null here is valid
        return null;
      }

      result.version = version;

      var linear = jqueryXML.find("Linear").eq(0);
      var nonLinearAds = jqueryXML.find("NonLinearAds");

      if (result.type === AD_TYPE.WRAPPER) { result.vastAdTagUri = jqueryXML.find("VASTAdTagURI").text(); }
      result.error = filterEmpty(jqueryXML.find("Error").map(function() { return $(this).text(); }));
      result.impression = filterEmpty(jqueryXML.find("Impression").map(function() { return $(this).text(); }));
      result.title = _.first(filterEmpty(jqueryXML.find("AdTitle").map(function() { return $(this).text(); })));

      if (linear.size() > 0) { result.linear = parseLinearAd(linear); }
      if (nonLinearAds.size() > 0) { result.nonLinear = parseNonLinearAds(nonLinearAds); }
      jqueryXML.find("Companion").map(function(i, v){
        result.companion.push(parseCompanionAd($(v)));
        return 1;
      });

      var sequence = jqueryXML.attr("sequence");
      if (typeof sequence !== 'undefined') {
        result.sequence = sequence;
      }

      var id = jqueryXML.attr("id");
      if (typeof id !== 'undefined') {
        result.id = id;
      }

      return result;
    }, this);

    /**
     * The xml needs to get parsed and and an array of ad objects is returned.
     * @public
     * @method Vast#parser
     * @param {XMLDocument} vastXML The xml that contains the ad data
     * @param {object} adLoaded The ad loaded object and metadata
     * @returns {object[]} An array containing the ad(s) if ads are found, otherwise it returns null.
     */
    this.parser = function(vastXML, adLoaded) {
      var jqueryAds =  $(vastXML).find("Ad");
      if (!this.checkNoAds(vastXML, jqueryAds)){
        // need to get error tracking information early in case error events need to be reported
        // before the ad object is created
        this.getErrorTrackingInfo(vastXML, jqueryAds);
      }

      if (!this.isValidVastXML(vastXML)) {
        return null;
      }
      var result = {
        podded : [],
        standalone : []
      };
      //parse the ad objects from the XML
      var ads = this.parseAds(vastXML, adLoaded);
      //check to see if any ads are sequenced (are podded)
      _.each(ads, _.bind(function(ad) {
        var sequence = typeof ad.sequence !== 'undefined' && _.isNumber(parseInt(ad.sequence)) ? ad.sequence : null;
        var version = typeof ad.version !== 'undefined' ? ad.version : null;
        if (supportsPoddedAds(version) && sequence) {
          //Assume sequences will start from 1
          result.podded[+sequence - 1] = ad;
        } else {
          //store ad as a standalone ad
          result.standalone.push(ad);
        }
      }, this));

      return result;
    };

    /**
     * Parses ad objects from the Vast XML.
     * @public
     * @method Vast#parseAds
     * @param {xml} vastXML The xml that contains the ad data
     * @return {object[]} An array of ad objects
     * @param {object} adLoaded The ad loaded object and metadata
     */
    this.parseAds = function(vastXML, adLoaded) {
      var result = [];
      var version = getVastVersion(vastXML);
      $(vastXML).find("Ad").each(function() {
        var singleAd = _getVpaidCreative(this, version, adLoaded);
        //if there is no vpaid creative, parse as regular vast
        if (!singleAd) {
          singleAd = vastAdSingleParser(this, version);
        }
        if (singleAd) {
          result.push(singleAd);
        }
      });
      return result;
    };

    /**
     * Check wether or not a vpaid ad is valid by checking the ad type and make sure is VPaid
     * This is only required for VPAID ads
     * @method Vast#_isValidVpaidCreative
     * @private
     * @return {boolean} VPaid validated value
     */
    var _isValidVpaidCreative = function(node, isLinear) {
      var apiFramework = (node.attr('apiFramework') || node.attr('apiframework')) === 'VPAID';
      var creativeType = isLinear ? node.attr('type') : (node.find('StaticResource').attr('creativeType') ||
            node.find('StaticResource').attr('creativetype'));
      return apiFramework && creativeType === 'application/javascript';
    };

    /**
     * Prepares an array of ads to be added to the timeline, ready for playback.
     * @private
     * @method Vast#handleAds
     * @param {object[]} ads An array of ad objects
     * @param {object} adLoaded The ad loaded object and metadata
     * @param {object} fallbackAd The ad to fallback to if playback for an ad in this pod fails
     */
    var handleAds = _.bind(function(ads, adLoaded, fallbackAd) {
      //find out how many non linear ads we have so as to not count them
      //when determining ad pod length
      var linearAdCount = 0;
      _.each(ads, _.bind(function(ad) {
        if (!_.isEmpty(ad.linear)) {
          linearAdCount++;
        }
      }, this));

      var handled = false;
      var handlingWrapperAd = false;

      var adUnits = [];
      var wrapperAds = {};
      var processedFallbackAd = null;

      //Process each of the ads in the pod
      _.each(ads, _.bind(function(ad, index) {
        if (ad.type === AD_TYPE.INLINE) {
          wrapperAds = { error: [],
            impression: [],
            companion: [],
            linear: {},
            nonLinear: {}
          };
          var params = {
            adPodIndex : index + 1,
            adPodLength : linearAdCount
          };
          this.mergeVastAdResult(ad, wrapperAds);
          if (!ad.data || ad.data.adType !== 'vpaid') {
            if (_hasLinearAd(ad)) {
              var linearAdUnit = _handleLinearAd(ad, adLoaded, params);
              if (linearAdUnit) {
                //The ad can have both a linear and non linear creative. We'll
                //split these up into separate objects for ad playback
                linearAdUnit = _.clone(linearAdUnit);
                linearAdUnit.data.nonLinear = {};
                adUnits.push(linearAdUnit);
              }
            }
            if (_hasNonLinearAd(ad)) {
              var nonLinearAdUnit = _handleNonLinearAd(ad, adLoaded, params);
              if (nonLinearAdUnit) {
                //The ad can have both a linear and non linear creative. We'll
                //split these up into separate objects for ad playback
                nonLinearAdUnit = _.clone(nonLinearAdUnit);
                nonLinearAdUnit.data.linear = {};
                adUnits.push(nonLinearAdUnit);
              }
            }
          } else {
            adUnits.push(ad);
          }
        } else if (ad.type === AD_TYPE.WRAPPER) {
          //TODO: Add wrapper ad depth limit
          _handleWrapperAd(ad, adLoaded);
          handlingWrapperAd = true;
          handled = true;
        }
      }, this));

      if (fallbackAd) {
        //TODO: Add wrapper ad depth limit
        if (fallbackAd.type === AD_TYPE.INLINE) {
          wrapperAds = {
            error: [],
            impression: [],
            companion: [],
            linear: {},
            nonLinear: {}
          };
          this.mergeVastAdResult(fallbackAd, wrapperAds);
          if (!fallbackAd.data || fallbackAd.data.adType !== 'vpaid') {
            //Prefer to show linear fallback ad
            processedFallbackAd = _handleLinearAd(fallbackAd, adLoaded);
            if (!processedFallbackAd) {
              processedFallbackAd = _handleNonLinearAd(fallbackAd, adLoaded);
            }
          } else {
            processedFallbackAd = fallbackAd;
          }
        }
        else if (ad.type === AD_TYPE.WRAPPER) {
          _handleWrapperAd(ad, adLoaded);
          handlingWrapperAd = true;
          handled = true;
        }
      }

      if (adUnits.length > 0) {
        var previousAdUnit;
        //Set fallback ad and next ad for each ad unit. Depending on if an ad plays successfully
        //or fails to play, the next ad or fallback ad will be forced to play
        _.each(adUnits, _.bind(function(adUnit) {
          adUnit.fallbackAd = processedFallbackAd;
          if (previousAdUnit) {
            previousAdUnit.nextAdInPod = adUnit;
          }
          previousAdUnit = adUnit;
        }, this));

        handled = addToTimeline(adUnits[0]);
      }

      if (handled) {
        this.loaded = true;
      } else {
        failedAd();
      }

      if (currentAd && currentAd.adType === this.amc.ADTYPE.AD_REQUEST && !handlingWrapperAd)
      {
        //notify the amc of the pod ending
        this.amc.notifyPodEnded(currentAd.id);
      }

    }, this);

    /**
     * Helper function to handle wrapper ads.
     * @private
     * @method Vast#_handleWrapperAd
     * @param {object} vastAdObject The VAST ad object
     * @param {object} adLoaded The ad loaded object and metadata
     */
    var _handleWrapperAd = _.bind(function(vastAdObject, adLoaded) {
      if (vastAdObject.vastAdTagUri) {
        var adId = _getAdId(vastAdObject);
        // Store the ad object
        if (_.has(this.adTrackingInfo, adId)) {
          this.adTrackingInfo[adId].vastAdObject = vastAdObject;
          this.adTrackingInfo[adId].wrapperParentId = this.wrapperParentId || null;
        }
        // Theoretically, this branch should not ever execute because _getErrorTrackingInfo()
        // should have already added the ad id to the adTrackingInfo dictionary.
        else {
          this.adTrackingInfo[adId] = {
            vastAdObject: vastAdObject,
            errorURLs: [],
            wrapperParentId: this.wrapperParentId || null
          };
        }
        if (!this.testMode) {
          this.ajax(vastAdObject.vastAdTagUri, this.onVastError, 'xml', adLoaded, adId);
        }
      }
    }, this);

    /**
     * Helper function to determine if the response XML is a VMAP XML.
     * @private
     * @method Vast#_isVMAPResponse
     * @param {XMLDocument} xml The xml returned from loading the ad
     * @returns {boolean} true, if an element with the VMAP tag name is found. Otherwise,
     * returns false.
     */
    var _isVMAPResponse = _.bind(function(xml) {
      return $(xml).find("vmap\\:VMAP, VMAP").length > 0;
    }, this);

    /**
     * When the ad tag url comes back with a response.
     * @public
     * @method Vast#onResponse
     * @param {string} wrapperParentId The current ad's "parent" ad id. Could be
     * undefined if ad does not have parent/wrapper. We want to pass this in to the next vast response
     * so the new ad knows who its parent is for tracking event purposes.
     * @param {object} adLoaded The ad loaded object and metadata
     * @param {XMLDocument} xml The xml returned from loading the ad
     */
    this.onResponse = function(wrapperParentId, adLoaded, xml) {
      if (_isVMAPResponse(xml)) {
        this.onVMAPResponse(xml);
      }
      else {
        this.onVastResponse(adLoaded, xml, wrapperParentId);
      }
    };

    /**
     * When the vast Ad is loaded correctly it will call this callback. Here the data is parsed to see if it is a linear
     * or nonLinear Ad. It will pull the tracking, impression, companion and clicking information. Then merge the results
     * and send it to the correct handler based on if it is Linear or not.
     * @public
     * @method Vast#onVastResponse
     * @param {object} adLoaded The ad loaded object and metadata
     * @param {XMLDocument} xml The xml returned from loading the ad
     * @param {string} wrapperParentIdArg Is the current ad's "parent" ad id. This argument would be set on an ajax
     * call for a wrapper ad. This argument could also be undefined if ad did not have parent/wrapper.
     */
    this.onVastResponse = function(adLoaded, xml, wrapperParentIdArg) {
      this.wrapperParentId = wrapperParentIdArg;
      var vastAds = this.parser(xml, adLoaded);
      var vastVersion = getVastVersion(xml);
      if (!vastAds || !adLoaded || (_.isEmpty(vastAds.podded) && _.isEmpty(vastAds.standalone))) {
        _tryRaiseAdError("VAST: XML Parsing Error");
        this.trackError(this.ERROR_CODES.XML_PARSING, this.wrapperParentId);
        failedAd();
      } else {
        var fallbackAd;
        if(supportsAdFallback(vastVersion) && vastAds.standalone.length > 0) {
          fallbackAd = vastAds.standalone[0];
        }
        var ad;
        if (supportsPoddedAds(vastVersion)) {
          //If there are no podded ads
          if(_.isEmpty(vastAds.podded)) {
            //show the first standalone ad
            ad = vastAds.standalone[0];
            if (ad) {
              handleAds([ad], adLoaded);
            }
          }
          // A VAST response wrapped in VMAP could have allowMultipleAds specified by the VMAP AdBreak
          else if (adLoaded.vmap) {
            if (adLoaded.allowMultipleAds) {
              handleAds(vastAds.podded, adLoaded, fallbackAd);
            }
          }
          //else show the podded ads
          else {
            handleAds(vastAds.podded, adLoaded, fallbackAd);
          }
        } else {
          //show all standalone ads if podded ads are not supported
          handleAds(vastAds.standalone, adLoaded);
        }
      }
    };

    /**
     * Handler for VMAP XML responses.
     * @public
     * @method Vast#onVMAPResponse
     * @param {XMLDocument} xml The xml returned from loading the ad
     */
    this.onVMAPResponse = function(xml) {
      var jqueryXML = $(xml);
      var adBreakElements = jqueryXML.find("vmap\\:AdBreak, AdBreak");
      _.each(adBreakElements, function(adBreakElement) {
        var adBreak = _parseAdBreak(adBreakElement);
        if (!_.isEmpty(adBreak)) {
          this.adBreaks.push(adBreak);
          var adSourceElement = $(adBreakElement).find("vmap\\:AdSource, AdSource");
          var trackingEventsElement = _findVMAPTrackingEvents(adBreakElement);
          var extensionsElement = $(adBreakElement).find("vmap\\:Extensions, Extensions");
          if (trackingEventsElement.length > 0) {
            var trackingEvents = _parseVMAPTrackingEvents(trackingEventsElement);
            if (!_.isEmpty(trackingEvents)) {
              adBreak.trackingEvents = trackingEvents;
            }
          }
          if (adSourceElement.length > 0) {
            var adSource = _parseAdSource(adSourceElement);
            if (!_.isEmpty(adSource)) {
              adBreak.adSource = adSource;
              var adObject = _convertToAdObject(adBreak);
              if (adObject) {
                var adTagURIElement = $(adSourceElement).find("vmap\\:AdTagURI, AdTagURI");
                var vastAdDataElement = $(adSourceElement).find("vmap\\:VASTAdData, VASTAdData");

                // VMAP 1.0.1 fixed a typo where the inline vast data tag was named VASTData instead of
                // VASTAdData. To ensure backwards compatibility with VMAP 1.0 XMLs, if the code cannot
                // find the VASTAdData tag, try to search for the VASTData tag.
                if (vastAdDataElement.length === 0) {
                  vastAdDataElement = $(adSourceElement).find("vmap\\:VASTData, VASTData");
                }

                if (vastAdDataElement.length > 0) {
                  adSource.vastAdData = vastAdDataElement[0];
                  this.onVastResponse(adObject, vastAdDataElement[0]);
                }
                else if (adTagURIElement.length > 0) {
                  adSource.adTagURI = adTagURIElement.text();
                  if (!this.testMode){
                    this.ajax(adSource.adTagURI, this.onVastError, 'xml', adObject);
                  }
                }
              }
              else {
                _tryRaiseAdError("VAST, VMAP: Error creating Ad Object");
              }
            }
          }
        }
      }, this);
    };

    /**
     * Helper function to find all node names with "vmap:TrackingEvents" / "TrackingEvents", and pick only
     * the elements with "vmap:TrackingEvents".
     * Note: must search for both "vmap:TrackingEvents" and "TrackingEvents" because of weird issue where
     * Chrome cannot find "vmap:TrackingEvents" unless another selector is specified.
     * @private
     * @method Vast#_findVMAPTrackingEvents
     * @param {object} adBreakElement The adBreak element to search
     * @returns {object[]} The filtered array with only vmap tracking events.
     */
    var _findVMAPTrackingEvents = _.bind(function(adBreakElement) {
      var trackingEventsElement = $(adBreakElement).find("vmap\\:TrackingEvents, TrackingEvents");
      var VMAPTrackingEventsElement = _.filter(trackingEventsElement.toArray(), function(trackingEventElement) {
        return (trackingEventElement.tagName.toLowerCase().indexOf("vmap:") > -1);
      }, this);
      return VMAPTrackingEventsElement;
    }, this);

    /**
     * Helper function to convert VMAP tracking events into objects with attributes as properties.
     * @private
     * @method Vast#_parseVMAPTrackingEvents
     * @param {object} trackingEventsElement The tracking events element
     * @returns {object[]} The array of tracking event objects.
     */
    var _parseVMAPTrackingEvents = _.bind(function(trackingEventsElement) {
      var trackingEvents = [];
      var trackingElements = $(trackingEventsElement).find("vmap\\:Tracking, Tracking");
      if (trackingElements.length > 0) {
        _.each(trackingElements, function(trackingElement) {
          var tracking = {};
          trackingEvents.push(tracking);
          tracking.url = $(trackingElement).text();
          tracking.eventName = $(trackingElement).attr("event");
        }, this);
      }
      return trackingEvents;
    }, this);

    /**
     * Convert the adBreak attributes into an ad object that will be passed into _onVastResponse().
     * @private
     * @method Vast#_convertToAdObject
     * @param {object} adBreak The adBreak object
     * @returns {object} null if the timeOffset attribute does not match any format. Otherwise, the
     * ad object is returned.
     */
    var _convertToAdObject = _.bind(function(adBreak) {
      var adObject = {
        /*
         *ad_set_code: "",
         *click_url: "",
         *expires: 0,
         *first_shown: 0,
         *frequency: 2,
         *public_id: "",
         *signature: "",
         *tracking_url: [],
         *type: "",
         *url: ""
         */
        vmap: true,
        allowMultipleAds: true,
        time: 0,
        position_type: "t",
      };
      if (!adBreak) {
        return null;
      }
      if (adBreak.adSource && adBreak.adSource.allowMultipleAds) {
        // parse the attribute, and convert string to boolean if it is "true"/"false"
        var allowMultipleAds = adBreak.adSource.allowMultipleAds;
        if (allowMultipleAds == "true" || allowMultipleAds == "false") {
          adObject.allowMultipleAds = (allowMultipleAds == "true");
        }
      }
      if (adBreak.repeatAfter) {
        adObject.repeatAfter = adManagerUtils.convertTimeStampToMilliseconds(adBreak.repeatAfter) / 1000;
      }
      if (adBreak.timeOffset) {
        // case: "start"
        if (/^start$/.test(adBreak.timeOffset)) {
          adObject.position = 0;
        }
        // case: "end"
        else if (/^end$/.test(adBreak.timeOffset)) {
          adObject.position = (this.amc.movieDuration + 1);

        }
        // case: hh:mm:ss.mmm | hh:mm:ss
        else if (/^\d{2}:\d{2}:\d{2}\.000$|^\d{2}:\d{2}:\d{2}$/.test(adBreak.timeOffset)) {
          adObject.position = adManagerUtils.convertTimeStampToMilliseconds(adBreak.timeOffset, this.amc.movieDuration) / 1000;
        }
        // case: [0, 100]%
        else if (/^\d{1,3}%$/.test(adBreak.timeOffset)) {
          // TODO: test percentage > 100
          adObject.position = adManagerUtils.convertPercentToMilliseconds(adBreak.timeOffset) / 1000;
        }
        else {
          _tryRaiseAdError("VAST, VMAP: No Matching 'timeOffset' Attribute format");
          adObject = null;
        }
      }
      return adObject;
    }, this);

    /**
     * Create the adBreak object with its attributes as properties.
     * @private
     * @method Vast#_parseAdBreak
     * @param {object} adBreakElement The adBreak element to parse
     * @returns {object} The formatted adBreak object.
     */
    var _parseAdBreak = _.bind(function(adBreakElement) {
      var adBreak = {};
      adBreak.timeOffset = $(adBreakElement).attr("timeOffset");
      adBreak.breakType = $(adBreakElement).attr("breakType");
      adBreak.breakId = $(adBreakElement).attr("breakId");
      adBreak.repeatAfter = $(adBreakElement).attr("repeatAfter");
      return adBreak;
    }, this);

    /**
     * Create the adSource object with its attributes as properties.
     * @private
     * @method Vast#_parseAdSource
     * @param {object} adSourceElement The adSource element to parse
     * @returns {object} The formatted adSource object.
     */
    var _parseAdSource = _.bind(function(adSourceElement) {
      var adSource = {};
      adSource.id = $(adSourceElement).attr("id");
      adSource.allowMultipleAds = $(adSourceElement).attr("allowMultipleAds");
      adSource.followRedirects = $(adSourceElement).attr("followRedirects");
      return adSource;
    }, this);

    /**
     * Generates a parsed VPaid ad to load.
     * This is only required for VPAID ads
     * @private
     * @method Vast#_getVPaidCreative
     * @param {XMLDocument} adXml Current ad xml
     * @param {string} Current vast version
     * @param {object} adLoaded The ad loaded object and metadata
     * @return {object} Parsed vpaid's metadata ad
     */
    var _getVpaidCreative = _.bind(function(adXml, version, adLoaded) {
      //TODO: Add more comments in the function
      var adParams = '{}';

      this.$_node = $(adXml);
      this.format = _getVpaidFormat();
      var isLinear = this.format === 'Linear';

      var $node = this.$_node.find(this.format);
      if (!$node.length) {
        return;
      }

      var $paramsNode = $node.find('AdParameters');
      //PBI-1828 there have been cases where ads have multiple mediafile tags and it results in a bad url.
      //so make sure we just pick one of the files. Otherwise, they all get appended to each other later in the code.
      var $mediaNode = isLinear ? $node.find('MediaFile').first() : $node.find('StaticResource');
      var $companionsNode = this.$_node.find('CompanionAds');
      var $validNode = isLinear ? $mediaNode : $node;

      if (!$mediaNode.length || !_isValidVpaidCreative($validNode, isLinear)) {
        OO.log('VPaid: No valid media source, either is not a VPaid Ad or ad unit is not in javascript format.');
        return;
      }

      if ($paramsNode.length) {
        adParams = _cleanString($paramsNode.text());
      }

      //TODO: Should we use _cleanString on this?
      var mediaFile = {
        url: $mediaNode.text(),
        type: $mediaNode.attr('type') || $mediaNode.attr('creativeType')
      };

      $mediaNode = isLinear ? $mediaNode : $mediaNode.parent();
      mediaFile = _.extend(mediaFile, {
        width: Number($mediaNode.attr('width')),
        height: Number($mediaNode.attr('height')),
        tracking: this.getVpaidTracking($mediaNode[0])
      });

      var impressions = this.getVpaidImpressions();
      var tracking = this.getVpaidTracking(isLinear ? $node[0] : $node.parent()[0]);
      var errorTracking = _cleanString(this.$_node.find('Error').text());
      var videoClickTracking;
      if (isLinear) {
        videoClickTracking = {
          clickTracking: _cleanString(this.$_node.find('ClickTracking').text()),
          clickThrough: _cleanString(this.$_node.find('ClickThrough').text()),
          customClick: _cleanString(this.$_node.find('CustomClick').text())
        };
      } else {
        videoClickTracking = {
          nonLinearClickThrough: _cleanString(this.$_node.find('NonLinearClickThrough').text())
        }
      }

      var sequence = this.$_node.attr('sequence');
      var adPodLength = this.$_node.parent().find('[sequence] Linear').length;
      if (!supportsPoddedAds(version) || !_.isNumber(parseInt(sequence))) {
        sequence = null;
      }

      var companionAds = [];
      var companions = $companionsNode.find('Companion');
      if (companions.length !== 0) {
        companions.each(function(i, v){
          companionAds.push(parseCompanionAd($(v)));
        });
      }
      // this is for linear/nonlinear
      var ad = {
        mediaFiles: mediaFile,
        tracking: tracking,
        duration: isLinear ? this.$_node.find('Duration').text() : 0,
        skipOffset: $node.attr('skipoffset') || null
      };
      _.extend(ad, videoClickTracking);

      var data = {
        adType: 'vpaid',
        companion: companionAds,
        error: errorTracking,
        impression: impressions,
        linear: ad,
        nonLinear: ad,
        title: _cleanString(this.$_node.find('AdTitle').text()),
        tracking: tracking,
        type: isLinear ? this.amc.ADTYPE.LINEAR_VIDEO : this.amc.ADTYPE.NONLINEAR_OVERLAY,
        version: version,
        videoClickTracking: videoClickTracking
      };

      var result = {
        adPodIndex: parseInt(sequence) || 1,
        sequence: sequence || null,
        adPodLength: adPodLength ? adPodLength : 1,
        data: data,
        fallbackAd: null,
        positionSeconds: adLoaded.position,
        adParams: adParams,
        streams: {'mp4': ''},
        type: AD_TYPE.INLINE,
        mediaFile: mediaFile,
        version: version,
        durationInMilliseconds: OO.timeStringToSeconds(ad.duration) * 1000
      };

      return result;
    }, this);

    /**
     * Starts the click-to-linear ad
     * This is only required for VPAID ads
     * @private
     * @method Vast#_beginVpaidAd
     */
    var _beginVpaidAd = _.bind(function() {
      if (_isVpaidAd(currentAd)) {
        var ad = currentAd.vpaidAd;
        var clickthru = currentAd.ad.data.nonLinear ? currentAd.ad.data.nonLinear.nonLinearClickThrough : '';
        //TODO: Is this used for anything?
        var adLinear = _safeFunctionCall(ad, "getAdLinear");

        initSkipAdOffset(currentAd);
        //Since a VPAID 2.0 ad handles its own UI, we want the video player to hide its UI elements
        this.amc.hidePlayerUi();
        this.amc.notifyPodStarted(currentAd.id, currentAd.ad.adPodLength);

        this.amc.notifyLinearAdStarted(currentAd.id, {
          name: currentAd.data.title,
          duration : _safeFunctionCall(ad, "getAdDuration"),
          clickUrl: clickthru.length > 0,
          indexInPod: currentAd.ad.sequence,
          skippable : _safeFunctionCall(ad, "getAdSkippableState")
        });
      }
    }, this);

    /**
     * Once Ad Playback stopped
     * This is only required for VPAID ads
     * @private
     * @method Vast#_stopVpaidAd
     */
    var _stopVpaidAd = _.bind(function() {
      if (currentAd && currentAd.vpaidAd) {
        _clearVpaidTimeouts();
        vpaidAdStoppedTimeout = _.delay(_checkVpaidAdStopped, this.VPAID_AD_STOPPED_TIMEOUT);
        _safeFunctionCall(currentAd.vpaidAd, "stopAd");
      }
    }, this);

    /**
     * Gets current ad format, which is either Linear or NonLinear
     * This is only required for VPAID ads
     * @private
     * @method Vast#_getVpaidFormat
     * @return {object} Ad format
     */
    var _getVpaidFormat = _.bind(function() {
      var format, name, node;
      node = this.$_node[0].getElementsByTagName('Linear')[0];
      if (!node) {
        node = this.$_node[0].getElementsByTagName('NonLinear')[0];
      }
      if (!node) {
        return;
      }
      name = node.nodeName;
      format = name.toLowerCase() === 'linear' ? 'Linear' : 'NonLinear';
      return format;
    }, this);

    /**
     * Get tracking events.
     * This is only required for VPAID ads
     * @public
     * @method Vast#getVpaidImpressions
     * @return {array} Array with impressions urls
     */
    this.getVpaidImpressions = function() {
      var impressions, node, nodes, _i, _len;
      impressions = [];
      nodes = this.$_node[0].getElementsByTagName('Impression');
      for (_i = 0, _len = nodes.length; _i < _len; _i++) {
        node = nodes[_i];
        impressions.push({
          url: node.textContent
        });
      }
      return impressions;
    };

    /**
     * Get tracking events.
     * This is only required for VPAID ads
     * @public
     * @method Vast#getVpaidTracking
     * @param {object} parent DOM Element to look for tracking events
     * @return {array} Array with tracking events and urls
     */
    this.getVpaidTracking = function(parent) {
      var node, nodes, tracking, _i, _len;
      tracking = [];
      nodes = parent.getElementsByTagName('Tracking');
      if (!nodes) {
        //TODO: Would returning an empty array here be better?
        return;
      }
      for (_i = 0, _len = nodes.length; _i < _len; _i++) {
        node = nodes[_i];
        tracking.push({
          event: node.getAttribute('event'),
          url: node.textContent
        });
      }
      return tracking;
    };

    /**
     * Send error.
     * This is only required for VPAID ads
     * @public
     * @method Vast#sendVpaidError
     */
    this.sendVpaidError = function() {
      if (currentAd && currentAd.data) {
        var error = currentAd.data.error;
        if (error) {
          OO.pixelPing(error);
        }
      }
    };

    /**
     * Send impressions.
     * This is only required for VPAID ads
     * @public
     * @method Vast#sendVpaidImpressions
     */
    this.sendVpaidImpressions = function() {
      if (currentAd && currentAd.data) {
        var impressions = currentAd.data.impressions;
        _.each(impressions, function(impression) {
          if (impression && impression.url) {
            OO.pixelPing(impression.url);
          }
        });
      }
    };

    /**
     * Send tracking events.
     * This is only required for VPAID ads
     * @public
     * @method Vast#sendVpaidTracking
     * @param {string} type Event name to be send
     */
    this.sendVpaidTracking = function(type) {
      var ad = prevAd ? prevAd : currentAd;
      if (ad && ad.data) {
        var tracking = ad.data.tracking,
            currentEvent;
        if (tracking) {
          currentEvent = _.find(tracking, function(item, index) {
            return item.event == type;
          });

          if (currentEvent && currentEvent.url) {
            OO.pixelPing(currentEvent.url);
          }
        }
      }
    };

    /**
     * Send click tracking event.
     * This is only required for VPAID ads
     * @public
     * @method Vast#sendVpaidClickTracking
     * @param {object} ad Ad to look for the tracking url
     */
    this.sendVpaidClickTracking = function(ad) {
      if (ad && ad.data && ad.data.videoClickTracking) {
        var clickTracking = ad.data.videoClickTracking.clickTracking;
        if (clickTracking){
          OO.pixelPing(clickTracking);
        }
      }
    };

    /**
     * Listen and executes events sent by the ad unit
     * This is only required for VPAID ads
     * @private
     * @method Vast#_onVpaidAdEvent
     * @param {string} eventName Name of the event to process
     */
    var _onVpaidAdEvent = _.bind(function(eventName) {
      switch (eventName) {
        case VPAID_EVENTS.AD_LOADED:
          vpaidAdLoaded = true;
          //For VPAID we need to check for companions after ad is created
          if (_isVpaidAd(currentAd)) {
            this.checkCompanionAds(currentAd.ad);
          }
          _clearVpaidTimeouts();
          vpaidAdStartedTimeout = _.delay(_checkVpaidAdStarted, this.VPAID_AD_STARTED_TIMEOUT);
          _safeFunctionCall(currentAd.vpaidAd, "startAd");
          initSkipAdOffset(currentAd);
          // Added to make sure we display videoSlot correctly
          this._videoSlot.style.zIndex = 10001;
          break;

        case VPAID_EVENTS.AD_STARTED:
          vpaidAdStarted = true;
          _onSizeChanged();
          prevAd = currentAd ? currentAd : null;
          this.sendVpaidTracking('creativeView');

          // If a timing issue with VTC causes the VPAID ad to not load, force load and play once the ad is started
          var isLinear = _safeFunctionCall(currentAd.vpaidAd, "getAdLinear");
          if (isLinear && this._videoSlot && this._videoSlot.buffered && (this._videoSlot.buffered.length < 1)) {
            this._videoSlot.load();
            this._videoSlot.play();
          }
          break;

        case VPAID_EVENTS.AD_IMPRESSION:
          this.sendVpaidImpressions();
          break;

        case VPAID_EVENTS.AD_CLICK_THRU:
          var url = arguments[1];
          var playerHandles = arguments[3];
          // Refer to IAB 2.5.4 How to handle VPAID clicks in VAST context
          if (playerHandles) {
            if (url) {
              this.openUrl(url);
            } else {
              this.amc.adsClicked();
            }
          }
          this.sendVpaidClickTracking();
          break;

        case VPAID_EVENTS.AD_VIDEO_START:
          this.sendVpaidTracking('start');
          break;

        case VPAID_EVENTS.AD_VIDEO_FIRST_QUARTILE:
          this.sendVpaidTracking('firstQuartile');
          break;

        case VPAID_EVENTS.AD_VIDEO_MIDPOINT:
          this.sendVpaidTracking('midpoint');
          break;

        case VPAID_EVENTS.AD_VIDEO_THIRD_QUARTILE:
          this.sendVpaidTracking('thirdQuartile');
          break;

        case VPAID_EVENTS.AD_VIDEO_COMPLETE:
          this.sendVpaidTracking('complete');
          _stopVpaidAd();
          break;

        case VPAID_EVENTS.AD_STOPPED:
          vpaidAdStopped = true;
          if (currentAd) {
            _endAd(currentAd, false);
          }
          break;

        case VPAID_EVENTS.AD_INTERACTION:
          this.sendVpaidTracking('interaction');
          break;

        case VPAID_EVENTS.AD_ERROR:
          _tryRaiseAdError('VPaid: Ad unit error: ' + arguments[1]);
          this.sendVpaidTracking('error');
          this.sendVpaidError();
          failedAd();
          break;

        case VPAID_EVENTS.AD_DURATION_CHANGE:
          var remainingTime = _safeFunctionCall(currentAd.vpaidAd, "getAdRemainingTime");
          if (remainingTime <= 0) {
            _stopVpaidAd();
          }
          break;

        case VPAID_EVENTS.AD_SKIPPED:
          this.sendVpaidTracking('skip');
          if (currentAd) {
            _endAd(currentAd, false);
          }
          break;

        case VPAID_EVENTS.AD_SKIPPABLE_STATE_CHANGE:
          var skipState = _safeFunctionCall(currentAd.vpaidAd, "getAdSkippableState");
          this.amc.showSkipVideoAdButton(skipState, '0');
          break;

        case VPAID_EVENTS.AD_LINEAR_CHANGE:
          var adLinear = _safeFunctionCall(currentAd.vpaidAd, "getAdLinear");
          transitionFromNonLinearVideo = true;
          if (adLinear) {
            _beginVpaidAd();
            this.amc.ui.transitionToAd();
          }
          break;

        case VPAID_EVENTS.AD_VOLUME_CHANGE:
          var volume = _safeFunctionCall(currentAd.vpaidAd, "getAdVolume");
          if (volume) {
            this.sendVpaidTracking('unmute');
          } else {
            this.sendVpaidTracking('mute');
          }
          break;

        case VPAID_EVENTS.AD_USER_ACCEPT_INVITATION:
          this.sendVpaidTracking('acceptInvitation');
          break;

        case VPAID_EVENTS.AD_USER_MINIMIZE:
          this.sendVpaidTracking('collapse');
          break;

        case VPAID_EVENTS.AD_USER_CLOSE:
          this.sendVpaidTracking('close');
          break;

        case VPAID_EVENTS.AD_PAUSED:
          this.sendVpaidTracking('pause');
          fromPause = true;
          break;

        case VPAID_EVENTS.AD_PLAYING:
          this.sendVpaidTracking('resume');
          break;
      }
    }, this);

    /**
     * Set variables to its default state
     * @private
     * @method Vast#_resetAdState
     */
    var _resetAdState = _.bind(function() {
      _removeListeners(currentAd.vpaidAd);
      currentAd = null;
      this.currentAdBeingLoaded = null;
      this.format = null;
      this.node = null;
      vpaidIframeLoaded = false;
      vpaidAdLoaded = false;
      vpaidAdStarted = false;
      vpaidAdStopped = false;
      _clearVpaidTimeouts();
    }, this);

    /**
     * Remove any new lines, line breaks and spaces from string.
     * @private
     * @method Vast#_cleanString
     * @return {string} String with no spaces
     */
    var _cleanString = function(string) {
      return string.replace(/\r?\n|\r/g, '').trim();
    };

    /**
     * Check for clickthrough url
     * @private
     * @method Vast#_hasClickUrl
     * @return {object} Ad to look for the clickthrough
     */
    var _hasClickUrl = function(ad) {
      if (ad && ad.data) {
        var  videoClickTracking = ad.data.videoClickTracking;
        if (videoClickTracking.clickThrough) {
          return videoClickTracking.clickThrough.length > 0;
        }
      }
      return false;
    };

    /**
     * Check whether or not a vpaid ad is valid by checking the version and the minimum required functions
     * This is only required for VPAID ads
     * @method Vast#_isValidVPaid
     * @private
     * @return {boolean} VPaid validated value
     */
    var _isValidVPaid = _.bind(function() {
      var vpaidVersion = null;
      try{
        //TODO: Do we want int here? If so, consider var name vpaidMajorVersion
        vpaidVersion = parseInt(currentAd.vpaidAd.handshakeVersion('2.0'));
      } catch (e) {
        OO.log("VPAID 2.0: Error while fetching VPAID 2.0 creative handshakeVersion - " + e)
      }

      var isValid = true;

      if (vpaidVersion !== 2) {
        OO.log('VPaid Ad Unit version is not supported.');
        isValid = false;
      }

      var requiredFunctions = ['handshakeVersion', 'initAd', 'startAd', 'stopAd', 'skipAd', 'resizeAd',
                               'pauseAd', 'resumeAd', 'expandAd', 'collapseAd', 'subscribe', 'unsubscribe'];
      _.each(requiredFunctions, function(fn) {
        if (currentAd && currentAd.vpaidAd && typeof currentAd.vpaidAd[fn] !== 'function') {
          isValid = false;
          OO.log('VPaid Ad Unit is missing function: ' + fn);
        }
      });

      return isValid;
    }, this);

    /**
     * Creates a new slot for each ad unit with unique id to avoid conflicts between ads.
     * This is only required for VPAID ads
     * @private
     * @return {object} A DOM element with unique id.
     */
    var _createUniqueElement = _.bind(function() {
      var parent = this.amc.ui.playerSkinPluginsElement ?
                              this.amc.ui.playerSkinPluginsElement[0] : this.amc.ui.pluginsElement[0];

      //TODO: Does this element get disposed of properly when the ad is finished?
      var element = document.createElement('div');
      element.id = _.uniqueId('pluginElement_');
      element.style.width = '100%';
      element.style.height = '100%';
      parent.insertBefore(element, parent.firstChild);
      return element;
    }, this);

    /**
     * Used to generate a frame to load ad media files.
     * This is only required for VPAID ads
     * @private
     */
    var _getFrame = _.bind(function() {
     _clearVpaidTimeouts();
     vpaidIframeLoadedTimeout = _.delay(_checkVpaidIframeLoaded, this.VPAID_AD_IFRAME_TIMEOUT);
      //TODO: Do iframes created by this function get disposed of properly after the ad is finished?
      vpaidIframe = document.createElement('iframe');
      vpaidIframe.style.display = 'none';
      vpaidIframe.onload = _onIframeLoaded;
      document.body.appendChild(vpaidIframe);
    }, this);

    /**
     * Callback when the frame is loaded.
     * This is only required for VPAID ads
     * @private
     */
    var _onIframeLoaded = _.bind(function() {
      var loader = vpaidIframe.contentWindow.document.createElement('script');
      loader.src = _cleanString(currentAd.ad.mediaFile.url);
      loader.onload = this.initializeAd;
      loader.onerror = _.bind(function(e) {
        _clearVpaidTimeouts();
        _tryRaiseAdError('VPAID: iframe load threw an error: ' + e);
        _endAd(currentAd, true);
      }, this);
      vpaidIframe.contentWindow.document.body.appendChild(loader);
    }, this);

    /**
     * Gets Current Fullscreen state
     * This is only required for VPAID ads
     * @private
     * @method Vast#_getFsState
     */
    var _getFsState = _.bind(function() {
      var fs;

      if (document.fullscreen != null) {
        fs = document.fullscreen;
      } else if (document.mozFullScreen != null) {
        fs = document.mozFullScreen;
      } else if (document.webkitIsFullScreen != null) {
        fs = document.webkitIsFullScreen;
      } else if (document.msFullscreenElement != null) {
        fs = document.msFullscreenElement !== null;
      }

      if (fs == null) {
        fs = false;
      }

      return fs;
    }, this);

    /**
     * Callback for Ad Manager Controller size change notification.
     * @private
     * @method Vast#_onSizeChanged
     */
    var _onSizeChanged = _.bind(function() {
      _updateCreativeSize();
    }, this);

    /**
     * Updates creatives with size changes.
     * @private
     * @method Vast#_updateCreativeSize
     */
    var _updateCreativeSize = _.bind(function() {
      if (this._slot) {
        var viewMode = _getFsState() ? 'fullscreen' : 'normal';
        var width = viewMode === 'fullscreen' ? window.screen.width : this._slot.offsetWidth;
        var height = viewMode === 'fullscreen' ? window.screen.height : this._slot.offsetHeight;
        this.resize(width, height, viewMode);
      }
    }, this);

    /**
     * Callback for Ad Manager Controller. Handles going into and out of fullscreen mode.
     * This is only required for VPAID ads
     * @private
     * @method Vast#onFullScreenChanged
     * @param {string} eventname The name of the event for which this callback is called
     * @param {boolean} isFullscreen True if entering fullscreen mode and false when exiting
     */
    var _onFullscreenChanged = function(eventname, isFullscreen) {
      _onSizeChanged();

      // only try to ping tracking urls if player is playing an ad
      if (adMode) {
        if (isFullscreen) {
          _handleTrackingUrls(currentAd, ["fullscreen"]);
        }
        else if (!isFullscreen) {
          _handleTrackingUrls(currentAd, ["exitFullscreen"]);
        }
      }
    };

    /**
     * Callback for Ad Manager Controller. Handles volume changes.
     * @public
     * @method Vast#onAdVolumeChanged
     * @param {string} eventname The name of the event for which this callback is called
     * @param {number} volume The current volume level
     */
    this.onAdVolumeChanged = function(eventname, volume) {
      if (adMode) {
        if (volume === 0 && volume !== lastVolume) {
          isMuted = true;
          lastVolume = volume;
          _handleTrackingUrls(currentAd, ["mute"]);
        }
        else if (isMuted && volume !== lastVolume) {
          isMuted = false;
          lastVolume = volume;
          _handleTrackingUrls(currentAd, ["unmute"]);
        }
      }
    };

    /**
     * Remove ad listeners
     * This is only required for VPAID ads
     * @private
     * @method Vast#_removeListeners
     */
    var _removeListeners = function(currentAd) {
      var eventName;
      for (eventName in VPAID_EVENTS) {
        currentAd.unsubscribe(eventName);
      }
    };

    /**
     * Resizes the ad slot.
     * This is only required for VPAID ads
     * @public
     * @method Vast#resize
     * @param {integer} width New width to resize to
     * @param {integer} height New height to resize to
     * @param {string} viewMode Can take values: fullscreen or normal
     */
    this.resize = function(width, height, viewMode) {
      if (currentAd && currentAd.vpaidAd) {
        _safeFunctionCall(currentAd.vpaidAd, "resizeAd", [width, height, viewMode]);
      }
    };

    /**
     * Utility function to check if an ad is a VPAID ad.
     * @private
     * @method Vast#_isVpaidAd
     * @param ad The ad to check
     * @returns {boolean}
     */
    var _isVpaidAd = function(ad) {
      var vastAdObject = _getVastAdObject(ad);
      return vastAdObject.adType === 'vpaid';
    };

    // Helpers
    // Safely trigger an ad manager function
    //TODO: consider error message override
    var _safeFunctionCall = function(vpaidAd, funcName, params) {
      try {
        if (_.isFunction(vpaidAd[funcName])) {
          return vpaidAd[funcName].apply(vpaidAd, params);
        }
      } catch (err) {
        _tryRaiseAdError("VPAID 2.0: " +
          "function '" + funcName + "' threw exception -",
          err);
      }
      return null;
    };

    /**
     * Helper function to log and raise the ad error.
     * @private
     * @method Vast#_tryRaiseAdError
     * @param {string} errorMessage The error message
     */
    var _tryRaiseAdError = _.bind(function(errorMessage){
      var _errorMessage = errorMessage;

      // if arguments are comma separated we want to leverage console.log's ability to
      // pretty print objects rather than printing an object's toStr representation.
      if (arguments.length > 1) {
        OO.log.apply(OO.log, arguments);

        // converts the arguments keyword to an Array.
        // arguments looks like an Array, but isn't.
        var convertArgs = [].slice.call(arguments);
        _errorMessage = convertArgs.join("");
      }
      else {
        OO.log(_errorMessage);
      }

      if (this.amc) {
        this.amc.raiseAdError(_errorMessage);
      }
      else {
        OO.log("VAST: Failed to raise ad error. amc undefined.");
      }
    }, this);
  };
  return new Vast();
});
