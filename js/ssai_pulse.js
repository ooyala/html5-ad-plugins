/*
 * Ad Manager for SSAI Pulse
 *
 * version 0.1
 */

require("../html5-common/js/utils/InitModules/InitOO.js");
require("../html5-common/js/utils/InitModules/InitOOJQuery.js");
require("../html5-common/js/utils/InitModules/InitOOUnderscore.js");
require("../html5-common/js/utils/InitModules/InitOOHazmat.js");
require("../html5-common/js/utils/InitModules/InitOOPlayerParamsDefault.js");

require("../html5-common/js/utils/constants.js");
require("../html5-common/js/utils/utils.js");
require("../html5-common/js/utils/environment.js");

var vastParser = require("../utils/vast_parser.js");
var adManagerUtils = require("../utils/ad_manager_utils.js");

OO.Ads.manager(function(_, $)
{
  /**
   * @class SsaiPulse
   * @classDesc The SSAI Pulse Ads Manager class, registered as an ads manager with the ad manager controller.
   * Controls how SSAI Pulse ads are loaded and played while communicating with the ad manager framework.
   * @public
   * @property {string} name The name of the ad manager. This should match the name used by the server to
   *                         provide metadata.
   * @property {boolean} ready Should be set to false initially.  Should be set to true when the ad manager
   *                           has loaded all external files and metadata to notify the controller that the
   *                           ad manager is ready for the user to hit play.
   * @property {object} videoRestrictions Optional property that represents restrictions on the video plugin
   *   used.  ex. {"technology":OO.VIDEO.TECHNOLOGY.HTML5, "features":[OO.VIDEO.FEATURE.VIDEO_OBJECT_TAKE]}
   */
  var SsaiPulse = function()
  {
    this.name = "ssai-pulse-ads-manager";
    this.ready = false;
    this.videoRestrictions = {};
    this.testMode = false;

    this.currentId3Object = null;
    this.currentAd = null;

    var amc  = null;
    var currentOffset = 0;

    // Tracking Event states
    var adMode = false;
    var isFullscreen = false;
    var isMuted = false;
    var lastVolume = -1;

    // Params required for ads proxy ads request
    // Request URL will already have initial query parameters; none of these query parameters
    // will be the first (will not need a prefixed "?").
    var SMART_PLAYER = "oosm=1";
    var OFFSET_PARAM = "offset=";
    var AD_ID_PARAM = "aid=";

    // In the event that the ID3 tag has an ad duration of 0 and the VAST XML response does not specify an
    // ad duration, use this constant. Live team said the average SSAI ad was 20 seconds long.
    var FALLBACK_AD_DURATION = 20 // seconds

    var baseRequestUrl = "";
    var requestUrl = "";

    this.adIdDictionary = {};

    // The expected query parameters in an ID3 Metadata String
    var ID3_QUERY_PARAMETERS =
    {
      // The ID of the ad, will correspond to an ad id found in the Vast Ad Response XML
      AD_ID: "adid",

      // At the moment this value does not mean anything. PRD states this parameter should actually
      // be the ad progress percentage. Live team the progress percentage will be added for Q3.
      TIME: "t",

      // Duration of the ad
      DURATION: "d"
    };

    // Constants used to denote the status of particular ad ID request
    var STATE =
    {
      // Denotes that an ad request is waiting for a response
      WAITING: "waiting",

      // Denotes that a response has returned for an ad request and the ad is "playing"
      PLAYING: "playing",

      // Denotes that an error occurred when making the ad request
      ERROR: "error"
    };

    // variable to store the timeout used to keep track of how long an SSAI ad plays
    var adDurationTimeout;

    // player configuration parameters / page level params
    var bustTheCache = true;

    /**
     * Called by the Ad Manager Controller.  Use this function to initialize, create listeners, and load
     * remote JS files.
     * @method SsaiPulse#initialize
     * @public
     * @param {object} adManagerController A reference to the Ad Manager Controller
     * @param {string} playerId The unique player identifier of the player initializing the class
     */
    this.initialize = function(adManagerController, playerId)
    {
      amc = adManagerController;

      // Add any player event listeners now
      amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, _.bind(_onContentChanged, this));

      // ID3 Tag
      amc.addPlayerListener(amc.EVENTS.VIDEO_TAG_FOUND, _.bind(this.onVideoTagFound, this));
      // Stream URL
      amc.addPlayerListener(amc.EVENTS.CONTENT_URL_CHANGED, _.bind(this.onContentUrlChanged, this));
      amc.addPlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED , _.bind(this.onPlayheadTimeChanged, this));

      // Replay for Live streams should not be available, but add this for precaution
      amc.addPlayerListener(amc.EVENTS.REPLAY_REQUESTED, _.bind(this.onReplay, this));

      // Listeners for tracking events
      amc.addPlayerListener(amc.EVENTS.FULLSCREEN_CHANGED, _.bind(this.onFullscreenChanged, this));
      amc.addPlayerListener(amc.EVENTS.AD_VOLUME_CHANGED, _.bind(this.onAdVolumeChanged, this));
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, the ui has been setup and the values
     * in amc.ui are ready to be used.
     * @method SsaiPulse#registerUi
     * @public
     */
    this.registerUi = function()
    {
      // amc.ui.adVideoElement is now ready for use
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, all movie and server metadata are
     * ready to be parsed.
     * This metadata may contain the adTagUrl and other ad manager and movie specific configuration.
     * @method SsaiPulse#loadMetadata
     * @public
     * @param {object} adManagerMetadata Ad manager-specific metadata
     * @param {object} backlotBaseMetadata Base metadata from Ooyala Backlot
     * @param {object} movieMetadata Metadata for the main video
     */
    this.loadMetadata = function(adManagerMetadata, backlotBaseMetadata, movieMetadata)
    {
      this.ready = true;

      if (adManagerMetadata)
      {
        // allow boolean true/false
        if (_.isBoolean(adManagerMetadata["cacheBuster"]))
        {
          bustTheCache = adManagerMetadata["cacheBuster"];
        }
        // allow string true/false
        else if (adManagerMetadata["cacheBuster"] === "true")
        {
          bustTheCache = true;
        }
        else if (adManagerMetadata["cacheBuster"] === "false")
        {
          bustTheCache = false;
        }
        // log message if parameter does not conform to any of the above values
        else
        {
          OO.log("SSAI Pulse: page level parameter: \"cacheBuster\" expected value: \"true\"" +
                 " or \"false\", but value received was: " + adManagerMetadata["cacheBuster"]);
        }
      }
    };

    /**
     * Called once per video by Ad Manager Controller once the ad manager has set its ready flag to true.
     * This function asks the ad manager to return a list of all ads to the controller for addition in the
     * timeline.  If the list of ads is not available at this time, return [] or null and call
     * [SsaiPulseController].appendToTimeline() when the ads become available.
     * The duration and position of each ad should be specified in seconds.
     * @method SsaiPulse#buildTimeline
     * @public
     * @returns {OO.SsaiPulseController#Ad[]} timeline A list of the ads to play for the current video
     */
    this.buildTimeline = function()
    {
      //Video restrictions can be provided at the ad level. If provided, the player will
      //attempt to create a video element that supports the given video restrictions.
      //If created, it will exist in amc.ui.adVideoElement by the time playAd is called.
      //If the element is not created due to lack of support from the available video plugins,
      //the ad will be skipped
      return null;
    };

    /**
     * Registered as a callback with the AMC, which gets called by the Ad Manager Controller when the the play head updates
     * during playback.
     * @public
     * @method SsaiPulse#onPlayheadTimeChanged
     * @param {string} eventname The name of the event for which this callback is called
     * @param {number} playhead The total amount main video playback time (seconds)
     * @param {number} duration Duration of the live video (seconds)
     * @param {number} livePlayhead The current playhead within the DVR/live window (seconds)
     */
    this.onPlayheadTimeChanged = function(eventName, playhead, duration, livePlayhead) {
      var offset = duration - livePlayhead;
      if (_.isFinite(offset) && offset >= 0)
      {
        currentOffset = offset;
      }
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should play the ad or group of podded ads passed to
     * the function as a parameter.
     * @method SsaiPulse#playAd
     * @public
     * @param {object} ad The ad object to play
     * @param {function} adPodStartedCallback Call this function when the ad or group of podded ads have
     *                                        started
     * @param {function} adPodEndedCallback Call this function when the ad or group of podded ads have
     *                                      completed
     * @param {function} adStartedCallback Call this function each time an ad in the set starts
     * @param {function} adEndedCallback Call this function each time an ad in the set completes
     */
    this.playAd = function(ad, adPodStartedCallback, adPodEndedCallback, adStartedCallback, adEndedCallback) {
      if (ad)
      {
        adMode = true;
        this.currentAd = ad;
        if (this.currentAd.ad)
        {
          this.currentAd.ad.id3AdId = this.currentId3Object.adId;
          _handleTrackingUrls(this.currentAd, ["impression", "start"]);
          amc.notifyLinearAdStarted(this.currentAd.id,
            {
              name: this.currentAd.ad.name,
              hasClickUrl: true,
              duration: this.currentAd.duration,
              ssai: this.currentAd.ad.ssai,
              isLive: this.currentAd.ad.isLive
            }
          );
        }
      }
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should cancel the ad passed to the function as a
     * parameter.  After cancelling the ad, the ad manager should call the adEndedCallback to indicate that
     * ad cancellation has completed.  If the given ad is not currently playing and the adEndedCallback has
     * already been called, then no action is required.
     * @method SsaiPulse#cancelAd
     * @public
     * @param {object} ad The ad object to cancel
     * @param {object} params An object containing information about the cancellation. It will include the
     *                        following fields:
     *                 code : The amc.AD_CANCEL_CODE for the cancellation
     */
    this.cancelAd = function(ad, params)
    {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should pause the ad passed to the function as a
     * parameter.  If the given ad is not currently playing, no action is required.
     * @method SsaiPulse#pauseAd
     * @public
     * @param {object} ad The ad object to pause
     */
    this.pauseAd = function(ad)
    {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should resume the ad passed to the function as a
     * parameter.  If the given ad is not currently loaded or not paused, no action is required.
     * @method SsaiPulse#resumeAd
     * @public
     * @param {object} ad The ad object to resume
     */
    this.resumeAd = function(ad)
    {
    };

    /**
     * <i>Optional.</i><br/>
     * When the Ad Manager Controller needs to hide the overlay it will call this function.
     * NOTE: This function should only be used by the ad manager if the cancelOverlay function is not being used.
     * NOTE 2: Only implement this function if you plan to hide and reshow the overlay. Otherwise delete it or leave it commented.
     * @method SsaiPulse#hideOverlay
     * @public
     * @param {object} currentAd The overlay ad object to be stored so when it is shown again, we can update the AMC
     */
    //this.hideOverlay = function(currentAd) {
    //};

    /**
     * <i>Optional.</i><br/>
     * When the Ad Manager Controller needs to cancel the overlay it will call this function.
     * NOTE: This function should only be used by the ad manager if the hideOverlay function is not being used.
     * NOTE 2: Only implement this function if you plan to cancel and not reshow the overlay. Otherwise leave it commented or delete it.
     * @method SsaiPulse#cancelOverlay
     * @public
     * @param {object} currentAd The overlay ad object that the ad manager needs to know is going to be cancelled and removed
     */
    //this.cancelOverlay = function(currentAd) {
    //};

    /**
     * This function gets called by the ad Manager Controller when an ad has completed playing. If the main video is
     * finished playing and there was an overlay displayed before the post-roll then it needs to be removed. If the main
     * video hasn't finished playing and there was an overlay displayed before the ad video played, then it will show
     * the overlay again.
     * @method SsaiPulse#showOverlay
     * @public
     */
    this.showOverlay = function()
    {
    };

    /**
     * <i>Optional.</i><br/>
     * Called when player clicks on the tap frame, if tap frame is disabled, then this function will not be
     * called
     * @method SsaiPulse#playerClicked
     * @public
     */
    this.playerClicked = function(amcAd, showPage)
    {
      if (amcAd && amcAd.ad)
      {
        _handleTrackingUrls(amcAd, ["linearClickTracking"]);
        window.open(amcAd.ad.clickthrough);
      }
    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player detects start of ad video playback.
     * @method SsaiPulse#adVideoPlaying
     * @public
     */
    this.adVideoPlaying = function()
    {
    };

    /**
     * Called when the player creates a new video element and selects the stream url.
     * @public
     * @method SsaiPulse#onContentUrlChanged
     * @param {string} url The stream url
     */
    this.onContentUrlChanged = function(eventName, url)
    {
      // important that smart player parameter is set here
      baseRequestUrl = _makeSmartUrl(url);
      amc.updateMainStreamUrl(baseRequestUrl);
      baseRequestUrl = _preformatUrl(baseRequestUrl);
    };

    /**
     * This is an example callback that interprets video stream tags.  The event is subscribed to in
     * the initialize function.
     * @public
     * @method SsaiPulse#onVideoTagFound
     * @param {string} event The event that triggered this callback
     * @param {string} videoId The id of the video element that processed a tag
     * @param {string} tagType The type of tag that was detected
     * @param {object} metadata Any metadata attached to the found tag
     */
    this.onVideoTagFound = function(eventName, videoId, tagType, metadata)
    {
      OO.log("TAG FOUND w/ args: ", arguments);
      this.currentId3Object = _parseId3Object(metadata);
      if (this.currentId3Object)
      {
        requestUrl = baseRequestUrl;
        requestUrl = _appendAdsProxyQueryParameters(requestUrl, this.currentId3Object.adId);

        // Check to see if we already have adId in dictionary
        if (!_.has(this.adIdDictionary, this.currentId3Object.adId))
        {
          this.adIdDictionary[this.currentId3Object.adId] = STATE.WAITING;

          // Clear any previous timeouts and notify end of ad.
          if (this.currentAd)
          {
            _adEndedCallback();
          }

          _handleId3Ad(this.currentId3Object);
        }
        // If there isn't a current ad playing and an ad request associated to the adid
        // also hasn't sent a request, then play ad in the dictionary.
        else if (!this.currentAd && this.adIdDictionary[this.currentId3Object.adId] !== STATE.WAITING)
        {
          this.adIdDictionary[this.currentId3Object.adId] = STATE.WAITING;
          _handleId3Ad(this.currentId3Object);
        }
        // Check if the ad already playing is not itself
        else if (this.currentAd &&
                 this.currentAd.ad &&
                 this.currentAd.ad.id3AdId !== this.currentId3Object.adId)
        {
          this.adIdDictionary[this.currentId3Object.adId] = STATE.WAITING;
          _adEndedCallback();
          _handleId3Ad(this.currentId3Object);
        }
      }
    };

    /**
     * Registered as a callback with the AMC, which gets called by the Ad Manager Controller when the replay button is
     * clicked. Here it will try to load the rest of the vast ads at this point if there any.
     * @public
     * @method SsaiPulse#onReplay
     */
    this.onReplay = function()
    {
      currentOffset = 0;
      this.currentAd = null;
      this.currentId3Object = null;
    };

    /**
     * Helper function to handle the ID3 Ad timeout and request.
     * @private
     * @method SsaiPulse#_handleId3Ad
     * @param {object} id3Object The ID3 object
     */
    var _handleId3Ad = _.bind(function(id3Object)
    {
      // Will call _sendRequest() once live team fixes ads proxy issue. Will directly call onResponse() for now.
      if (!this.testMode)
      {
        // Set timer for duration of the ad.
        adDurationTimeout = _.delay(_adEndedCallback, id3Object.duration * 1000);

        _sendRequest(requestUrl);
      }
      else {
        this.onResponse(id3Object, null);
      }
    }, this);

    /**
     * Called if the ajax call succeeds
     * @public
     * @method SsaiPulse#onResponse
     * @param {object} id3Object The ID3 object
     * @param {XMLDocument} xml The xml returned from loading the ad
     */
    this.onResponse = function(id3Object, xml)
    {
      OO.log("SSAI Pulse: Response");
      // Call VastParser code
      var vastAds = vastParser.parser(xml);
      var adIdVastData = _parseVastAdsObject(vastAds);

      var ssaiAd =
      {
        clickthrough: "",
        name: "",
        ssai: true,
        isLive: true
      };

      if (_.has(adIdVastData, id3Object.adId))
      {
        var adObject = adIdVastData[id3Object.adId];

        // If the id3object duration was a bad value, reapply the timeout to the new
        // duration
        var duration = _selectDuration(id3Object, adObject);
        if (duration !== id3Object.duration)
        {
          id3Object.duration = duration;
          _clearAdDurationTimeout();
          if (!this.testMode)
          {
            adDurationTimeout = _.delay(_adEndedCallback, duration * 1000);
          }
        }

        this.adIdDictionary[id3Object.adId].vastData = adObject;
        ssaiAd.data = adObject;
        ssaiAd.clickthrough = _getLinearClickThroughUrl(adObject);
        ssaiAd.name = _getTitle(adObject);
      }

      this.adIdDictionary[id3Object.adId] = STATE.PLAYING;
      amc.forceAdToPlay(this.name, ssaiAd, amc.ADTYPE.LINEAR_VIDEO, {}, id3Object.duration);

      //_forceMockAd(id3Object);
    };

    /**
     * Called if the ajax call fails
     * @public
     * @method SsaiPulse#onRequestError
     */
    this.onRequestError = function()
    {
      OO.log("SSAI Pulse: Error");
      if (_.isObject(this.currentId3Object) && _.has(this.adIdDictionary, this.currentId3Object.adId))
      {
        this.adIdDictionary[this.currentId3Object.adId] = STATE.ERROR;
        this.currentAd = null;
      }
    };

    /**
     * Callback for Ad Manager Controller. Handles going into and out of fullscreen mode.
     * This is only required for VPAID ads
     * @public
     * @method SsaiPulse#onFullScreenChanged
     * @param {string} eventName The name of the event for which this callback is called
     * @param {boolean} isFullscreen True if entering fullscreen mode and false when exiting
     */
    this.onFullscreenChanged = function(eventName, isFullscreen)
    {
      // only try to ping tracking urls if player is playing an ad
      if (adMode)
      {
        if (isFullscreen)
        {
          _handleTrackingUrls(this.currentAd, ["fullscreen"]);
        }
        else if (!isFullscreen)
        {
          _handleTrackingUrls(this.currentAd, ["exitFullscreen"]);
        }
      }
    };

    /**
     * Callback for Ad Manager Controller. Handles volume changes.
     * @public
     * @method SsaiPulse#onAdVolumeChanged
     * @param {string} eventName The name of the event for which this callback is called
     * @param {number} volume The current volume level
     */
    this.onAdVolumeChanged = function(eventName, volume)
    {
      if (adMode)
      {
        if (volume === 0 && volume !== lastVolume)
        {
          isMuted = true;
          lastVolume = volume;
          _handleTrackingUrls(this.currentAd, ["mute"]);
        }
        else if (isMuted && volume !== lastVolume)
        {
          isMuted = false;
          lastVolume = volume;
          _handleTrackingUrls(this.currentAd, ["unmute"]);
        }
      }
    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player detects an error in the ad video playback.  If the ad manager did not detect
     * this error itself, it can use this time to end the ad playback.
     * @method SsaiPulse#adVideoError
     * @public
     * @param {object} adWrapper The current Ad's metadata
     * @param {number} errorCode The error code associated with the video playback error
     */
    this.adVideoError = function(adWrapper, errorCode)
    {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should destroy itself.  It will be unregistered by
     * the Ad Manager Controller.
     * @method SsaiPulse#destroy
     * @public
     */
    this.destroy = function()
    {
      // reset parameters
      this.ready = false;
      this.currentAd = null;
      this.currentId3Object = null;
      this.adIdDictionary = {};
      _removeAMCListeners();
    };

    var _onContentChanged = function()
    {
      currentOffset = 0;
      this.currentAd = null;
      this.currentId3Object = null;
    };

    // Helper Functions

    /**
     * Getter for the bustTheCache variable
     * @public
     * @method SsaiPulse#getBustTheCache
     * @returns {boolean} the bustTheCache variable
     */
    this.getBustTheCache = _.bind(function()
    {
      return bustTheCache;
    }, this);

    /**
     * Appends the smart player identifier to the request URL.
     * @private
     * @method SsaiPulse#_makeSmartUrl
     * @param {string} url The stream url
     * @returns {string} The modified stream url with the appended unique identifier.
     */
    var _makeSmartUrl = _.bind(function(url)
    {
      return _appendParamToUrl(url, SMART_PLAYER);
    }, this);

    /**
     * Helper function to append "offset" and "aid" query parameters to the request URL.
     * @private
     * @method SsaiPulse#_appendAdsProxyQueryParameters
     * @param {string} url The request URL
     * @param {string} adId The ID of the ad
     * @returns {string} The request URL with the appended query parameters.
     */
    var _appendAdsProxyQueryParameters = _.bind(function(url, adId)
    {
      var offset = OFFSET_PARAM + currentOffset;
      var newUrl = _appendParamToUrl(url, offset);

      var adIdParam = AD_ID_PARAM + adId;
      newUrl = _appendParamToUrl(newUrl, adIdParam);
      return newUrl;
    }, this);

    /**
     * Appends a parameter to a url.
     * @private
     * @param  {string} url   Url to append the param to
     * @param  {string} param The parameter to be appended
     * @returns {string}       The resulting url after appending the param
     */
    var _appendParamToUrl = function(url, param)
    {
      if (_.isString(url) && _.isString(param))
      {
        if (url.indexOf("?") > -1)
        {
          return url + "&" + param;
        }
        else
        {
          return url + "?" + param;
        }
      }
      return url;
    };

    /**
     * Helper function to replace change the HLS manifest URL to the endpoint used to retrieve
     * the Vast Ad Response from the ads proxy.
     * @private
     * @method SsaiPulse#_preformatUrl
     * @param {string} url The request URL
     * @returns {string} The request URL with the formatted request URL.
     */
    var _preformatUrl = _.bind(function(url)
    {
      //return ((url||'').indexOf('https') === -1 ? (url||'').replace('http:','https:') : url||'').replace('/hls/','/ai/');
      return (url ||'').replace('/hls/','/ai/');
    }, this);

    /**
     * Attempts to load the Ad after normalizing the url.
     * @private
     * @method SsaiPulse#_sendRequest
     * @param {string} url The url that contains the Ad creative
     */
    var _sendRequest = _.bind(function(url)
    {
      $.ajax
      ({
        url: url,
        type: 'GET',
        beforeSend: function(xhr)
        {
          xhr.withCredentials = true;
        },
        dataType: "xml",
        crossDomain: true,
        cache:false,
        success: _.bind(this.onResponse, this, this.currentId3Object),
        error: _.bind(this.onRequestError, this)
      });
    }, this);

    /**
     * TODO: Improve return statement jsdoc
     * Parses the ID3 metadata that is received.
     * @private
     * @method SsaiPulse#_parseId3Object
     * @param {object} id3Object The ID3 metadata passed in
     * @returns {object} An object with "adId", "time", and "duration" as properties.
     */
    var _parseId3Object = _.bind(function(id3Object)
    {
      var parsedId3Object = null;
      if (id3Object)
      {
        if (_.has(id3Object, "TXXX"))
        {
          var id3String = id3Object.TXXX;
          parsedId3Object = _parseId3String(id3String);
        }
        else
        {
          OO.log("SSAI Pulse: Expected ID3 Metadata Object to have a 'TXXX' property");
        }
      }
      return parsedId3Object;
    }, this);

    /**
     * TODO: Improve return statement jsdoc
     * Parses the string contained in the ID3 metadata.
     * @private
     * @method SsaiPulse#_parseId3String
     * @param {string} id3String The string contained under the "TXXX" property to parse
     * @returns {object} An object with "adId", "time", and "duration" as properties.
     */
    var _parseId3String = _.bind(function(id3String)
    {
      var parsedId3Object = null;
      if (id3String)
      {
        parsedId3Object = {};
        var queryParameterStrings = id3String.split("&");
        if (queryParameterStrings.length === 3)
        {
          for (var i = 0; i < queryParameterStrings.length; i++)
          {
            var queryParameterString = queryParameterStrings[i];
            var queryParameterSplit = queryParameterString.split("=");
            var queryParameterKey = queryParameterSplit[0];
            var queryParameterValue = queryParameterSplit[1];
            if (queryParameterKey === ID3_QUERY_PARAMETERS.AD_ID)
            {
              parsedId3Object.adId = queryParameterValue;
            }
            else if (queryParameterKey === ID3_QUERY_PARAMETERS.TIME)
            {
              parsedId3Object.time = +queryParameterValue;
            }
            else if (queryParameterKey === ID3_QUERY_PARAMETERS.DURATION)
            {
              parsedId3Object.duration = +queryParameterValue;
            }
            else
            {
              OO.log("SSAI Pulse: " + queryParameterKey + " is an unrecognized query parameter.\n" +
                     "Recognized query parameters: " + _id3QueryParametersToString());
              parsedId3Object = null;
              break;
            }
          }
        }
        else
        {
          OO.log("SSAI Pulse: ID3 Metadata String contains" + queryParameterStrings.length +
                 "query parameters, but was expected to contain 3 query parameters: " +
                 _id3QueryParametersToString());
          parsedId3Object = null;
        }
      }
      return parsedId3Object;
    }, this);

    /**
     * Helper function to pretty print the ID3_QUERY_PARAMETERS object.
     * @private
     * @method SsaiPulse#_id3QueryParametersToString
     * @returns {string} The string: "adid, t, d".
     */
    var _id3QueryParametersToString = _.bind(function()
    {
      var result = "";
      _.each(_.values(ID3_QUERY_PARAMETERS), function(value)
      {
        result = result + value + ", ";
      });
      result = result.slice(0, -2);
      return result;
    }, this);

    /**
     * Temporary mock function to force an ad to play until live team fixes ad proxy.
     * @private
     * @method SsaiPulse#_forceMockAd
     * @param {object} id3Object The ID3 object
     */
    var _forceMockAd = _.bind(function(id3Object)
    {
      var ad1 =
      {
        clickthrough: "http://www.google.com",
        name: "Test SSAI Ad",
        ssai: true,
        isLive: true
      };
      amc.forceAdToPlay(this.name, ad1, amc.ADTYPE.LINEAR_VIDEO, {}, id3Object.duration);
    }, this);

    /**
     * Ping a list of tracking event names' URLs.
     * @private
     * @method SsaiPulse#_handleTrackingUrls
     * @param {object} adObject The ad metadata
     * @param {string[]} trackingEventNames The array of tracking event names
     */
    var _handleTrackingUrls = function(adObject, trackingEventNames) {
      if (adObject) {
        _.each(trackingEventNames, function(trackingEventName) {
          var urls;
          switch (trackingEventName) {
            case "impression":
              urls = _getImpressionUrls(adObject);
              break;
            case "linearClickTracking":
              urls = _getLinearClickTrackingUrls(adObject);
              break;
            default:
              /*
               * Note: Had to change _getTrackingEventUrls to a less generic, _getLinearTrackingEventUrls.
               * Slight discrepancy between ssai pulse and vast ad manager here. For vast, the
               * "tracking" object exists in the ad.data object, but not in ssai pulse.
               */
              urls = _getLinearTrackingEventUrls(adObject, trackingEventName);
          }
          var urlObject = {};
          urlObject[trackingEventName] = urls;
          _pingTrackingUrls(urlObject);
        });
      }
      else {
        console.log(
            "SSAI Pulse: Tried to ping URLs: [" + trackingEventNames +
            "] but ad object passed in was: " + adObject
        );
        return;
      }
    };

    /**
     * Helper function to retrieve the ad object's impression urls.
     * @private
     * @method SsaiPulse#_getImpressionUrls
     * @param {object} adObject The ad metadata
     * @return {string[]|null} The array of impression urls. Returns null if no URLs exist.
     */
    var _getImpressionUrls = function(adObject) {
      var impressionUrls = null;
      if (adObject &&
          adObject.ad &&
          adObject.ad.data &&
          adObject.ad.data.impression &&
          adObject.ad.data.impression.length > 0) {
        impressionUrls = adObject.ad.data.impression;
      }
      return impressionUrls;
    };

    /**
     * Helper function to retrieve the ad object's linear click tracking urls.
     * @private
     * @method SsaiPulse#_getLinearClickTrackingUrls
     * @param {object} adObject The ad metadata
     * @return {string[]|null} The array of linear click tracking urls. Returns null if no
     * URLs exist.
     */
    var _getLinearClickTrackingUrls = function(adObject) {
      var linearClickTrackingUrls = null;
      if (adObject &&
          adObject.ad &&
          adObject.ad.data &&
          adObject.ad.data.linear &&
          adObject.ad.data.linear.clickTracking &&
          adObject.ad.data.linear.clickTracking.length > 0) {
        linearClickTrackingUrls = adObject.ad.data.linear.clickTracking;
      }
      return linearClickTrackingUrls;
    };

    /**
     * Helper function to retrieve the ad object's tracking urls under a specific event name.
     * @private
     * @method SsaiPulse#_getLinearTrackingEventUrls
     * @param {object} adObject The ad metadata
     * @param {string} trackingEventName The name of the tracking event
     * @returns {string[]|null} The array of tracking urls associated with the event name. Returns null if no URLs exist.
     */
    var _getLinearTrackingEventUrls = function(adObject, trackingEventName) {
      var trackingUrls = null;
      if (adObject &&
          adObject.ad &&
          adObject.ad.data &&
          adObject.ad.data.linear &&
          adObject.ad.data.linear.tracking &&
          adObject.ad.data.linear.tracking[trackingEventName] &&
          adObject.ad.data.linear.tracking[trackingEventName].length > 0) {
        trackingUrls = adObject.ad.data.linear.tracking[trackingEventName];
      }
      return trackingUrls;
    };

    /**
     * Helper function to retrieve the ad object's title.
     * @private
     * @method SsaiPulse#_getTitle
     * @param {object} adObject The ad metadata
     * @return {string|null} The title of the ad. Returns null if no title exists.
     */
    var _getTitle = function(adObject) {
      var title = null;
      if (adObject && adObject.title) {
        title = adObject.title;
      }
      return title;
    };

    /**
     * Helper function to retrieve the ad object's linear click through url.
     * @private
     * @method SsaiPulse#_getLinearClickThroughUrl
     * @param {object} adObject The ad metadata
     * @return {string|null} The linear click through url. Returns null if no
     * URL exists.
     */
    var _getLinearClickThroughUrl = function(adObject) {
      var linearClickThroughUrl = null;
      if (adObject &&
          adObject.linear &&
          adObject.linear.clickThrough) {
        linearClickThroughUrl = adObject.linear.clickThrough;
      }
      return linearClickThroughUrl;
    };

    /**
     * Helper function to convert the ad object returned by the Vast#parser function into
     * a key-value pair object where the key is the ad id and the value is the ad object.
     * @private
     * @method SsaiPulse#_parseVastAdsObject
     * @param {object} vastAds The object containing the parsed ad data
     * @returns {object} The key-value pair object.
     */
    var _parseVastAdsObject = _.bind(function(vastAds)
    {
      var _adIdVastData = {};
      if (vastAds)
      {
        if (vastAds.podded && vastAds.podded.length > 0)
        {
          for (var i = 0; i < vastAds.podded.length; i++)
          {
            var vastAd = vastAds.podded[i];
            if (vastAd && vastAd.id)
            {
              _adIdVastData[vastAd.id] = vastAd;
            }
          }
        }
        if (vastAds.standalone && vastAds.standalone.length > 0)
        {
          for (var i = 0; i < vastAds.standalone.length; i++)
          {
            var vastAd = vastAds.standalone[i];
            if (vastAd && vastAd.id)
            {
              _adIdVastData[vastAd.id] = vastAd;
            }
          }
        }
      }
      return _adIdVastData;
    }, this);

    /**
     * Helper function to get the duration property within the Vast ad object.
     * @private
     * @method SsaiPulse#_getDuration
     * @param {object} vastAdData The Vast ad object
     * @returns {string} The Vast ad duration time stamp.
     */
    var _getDuration = _.bind(function(vastAdData)
    {
      var duration = null;
      if (vastAdData &&
          vastAdData.linear &&
          vastAdData.linear.duration)
      {
        duration = vastAdData.linear.duration;
      }
      return duration;
    }, this);

    /**
     * Helper function to return how far (in seconds) the current playhead is from Live.
     * @public
     * @method SsaiPulse#getCurrentOffset
     * @returns {number} The value of the current offset from Live.
     */
    this.getCurrentOffset = _.bind(function()
    {
      return currentOffset;
    }, this);

    /**
     * Helper function adjust the duration to a proper value. The priority from which to grab the duration is:
     * 1. ID3 Tag ad duration - if the value is 0, fall through
     * 2. VAST XML Response ad duration - if the ad duration is not defined, fall through
     * 3. FALLBACK_AD_DURATION
     * @private
     * @method SsaiPulse#_selectDuration
     * @param {object} id3Object The object containing the ID3 Tag information
     * @param {object} vastAdData The object containing the parsed Vast ad data
     * @returns {number} The duration of the ad (in seconds).
     */
    var _selectDuration = _.bind(function(id3Object, vastAdData)
    {
      var duration = FALLBACK_AD_DURATION;

      var vastDuration = _getDuration(vastAdData);
      vastDuration = adManagerUtils.convertTimeStampToMilliseconds(vastDuration) / 1000;

      if (id3Object && id3Object.duration > 0)
      {
        duration = id3Object.duration;
      }
      else if (vastDuration > 0)
      {
        duration = vastDuration;
      }
      return duration;
    }, this);

    /**
     * Helper function to ping URLs in each set of tracking event arrays.
     * @private
     * @method SsaiPulse#_pingTrackingUrls
     * @param {object} urlObject An object with the tracking event names and their
     * associated URL array.
     */
    var _pingTrackingUrls = _.bind(function(urlObject)
    {
      for (var trackingName in urlObject)
      {
        if (urlObject.hasOwnProperty(trackingName))
        {
          try
          {
            var urls = urlObject[trackingName];
            if (urls)
            {
              if (bustTheCache)
              {
                urls = _cacheBuster(urls);
              }
              OO.pixelPings(urls);
              OO.log("SSAI Pulse: \"" + trackingName + "\" tracking URLs pinged");
            }
            else
            {
              OO.log("SSAI Pulse: No \"" + trackingName + "\" tracking URLs provided to ping");
            }
          }
          catch(e)
          {
            OO.log("SSAI Pulse: Failed to ping \"" + trackingName + "\" tracking URLs");
            if (amc)
            {
              amc.raiseAdError(e);
            }
          }
        }
      }
    }, this);

    /**
     * Replaces the %5BCACHEBUSTING%5D / [CACHEBUSTING] string in each URL in the array with a
     * random generated string. The purpose of a cachebuster is to keep the URLs unique to prevent
     * cached responses.
     * @private
     * @method SsaiPulse#_cacheBuster
     * @param {string[]} urls The array of URLs
     * @returns {string[]} The new array of URLs.
     */
    var _cacheBuster = _.bind(function(urls)
    {
      for (var i = 0; i < urls.length; i++)
      {
        var searchString = "[CACHEBUSTING]";
        var encodedSearchString = encodeURIComponent(searchString);
        var regex = new RegExp(encodedSearchString, "i");
        var randString = OO.getRandomString();
        urls[i] = urls[i].replace(regex, randString);
      }
      return urls;
    }, this);

    /**
     * Callback used when the duration of an ad has passed.
     * @private
     * @method SsaiPulse#_adEndedCallback
     */
    var _adEndedCallback = _.bind(function()
    {
      _clearAdDurationTimeout();
      if (this.currentAd)
      {
        amc.notifyLinearAdEnded(this.currentAd.id);
        amc.notifyPodEnded(this.currentAd.id);
        _handleTrackingUrls(this.currentAd, ["firstQuartile", "midpoint", "thirdQuartile", "complete"]);
      }
      adMode = false;
      this.currentAd = null;
    }, this);

    /**
     * Helper function to clear ad duration timeout.
     * @private
     * @method SsaiPulse#_clearAdDurationTimeout
     */
    var _clearAdDurationTimeout = _.bind(function()
    {
      clearTimeout(adDurationTimeout);
      adDurationTimeout = null;
    }, this);

    /**
     * Remove listeners from the Ad Manager Controller about playback.
     * @private
     * @method SsaiPulse#_removeAMCListeners
     */
    var _removeAMCListeners = _.bind(function()
    {
      if (amc)
      {
        amc.removePlayerListener(amc.EVENTS.CONTENT_CHANGED, _.bind(_onContentChanged, this));
        amc.removePlayerListener(amc.EVENTS.VIDEO_TAG_FOUND, _.bind(this.onVideoTagFound, this));
        amc.removePlayerListener(amc.EVENTS.CONTENT_URL_CHANGED, _.bind(this.onContentUrlChanged, this));
        amc.removePlayerListener(amc.EVENTS.FULLSCREEN_CHANGED, _.bind(this.onFullscreenChanged, this));
        amc.removePlayerListener(amc.EVENTS.AD_VOLUME_CHANGED, _.bind(this.onAdVolumeChanged, this));
      }
    }, this);
  };
  return new SsaiPulse();
});
