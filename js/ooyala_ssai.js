/*
 * Ooyala SSAI plugin
 *
 * version 0.1
 */

const {
  isBoolean,
  isNumber,
  isFinite,
  delay,
  has,
  isObject,
  isString,
  values,
  each,
  isUndefined,
} = require('underscore');

require('../html5-common/js/utils/InitModules/InitOO.js');
require('../html5-common/js/utils/InitModules/InitOOUnderscore.js');
require('../html5-common/js/utils/InitModules/InitOOHazmat.js');
require('../html5-common/js/utils/InitModules/InitOOPlayerParamsDefault.js');

require('../html5-common/js/utils/constants.js');
require('../html5-common/js/utils/utils.js');
require('../html5-common/js/utils/environment.js');

const VastParser = require('../utils/vast_parser.js');
const adManagerUtils = require('../utils/ad_manager_utils.js');

OO.Ads.manager(() => {
  /**
   * @class OoyalaSsai
   * @classDesc The Ooyala SSAI Ads Manager class, registered as an ads manager with the ad manager controller.
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
  const OoyalaSsai = function () {
    this.name = 'ooyala-ssai-ads-manager';
    this.ready = false;
    this.initTime = Date.now();
    this.videoRestrictions = {};
    this.testMode = false;
    this.timeLine = {};
    this.currentEmbed = '';
    this.domainName = 'ssai.ooyala.com';
    this.ssaiGuid = '';
    this.vastParser = new VastParser();

    this.currentAd = null;

    let amc = null;
    let currentOffset = null;

    // Tracking Event states
    let adMode = false;
    let firstAdFound = false;
    const isFullscreen = false;
    let isMuted = false;
    let lastVolume = -1;

    // Params required for ads proxy ads request
    // Request URL will already have initial query parameters; none of these query parameters
    // will be the first (will not need a prefixed "?").
    const SMART_PLAYER = 'oosm=1';
    const OFFSET_PARAM = 'offset=';
    const AD_ID_PARAM = 'aid=';

    // In the event that the ID3 tag has an ad duration of 0 and the VAST XML response does not specify an
    // ad duration, use this constant. Live team said the average SSAI ad was 20 seconds long.
    const FALLBACK_AD_DURATION = 20; // seconds

    let baseRequestUrl = '';
    let requestUrl = '';

    this.adIdDictionary = {};
    this.currentId3Object = null;

    // The expected query parameters in an ID3 Metadata String
    const ID3_QUERY_PARAMETERS = {
      // The ID of the ad, will correspond to an ad id found in the Vast Ad Response XML
      AD_ID: 'adid',

      // At the moment this value does not mean anything. PRD states this parameter should actually
      // be the ad progress percentage. Live team the progress percentage will be added for Q3.
      TIME: 't',

      // Duration of the ad
      DURATION: 'd',
    };

    // The VAST requirements to tracking event types to track which creative are being viewed
    const TRACKING_CALL_NAMES = {

      25: ['firstQuartile'],

      50: ['midpoint'],

      75: ['thirdQuartile'],

      100: ['complete'],
    };

    const TRACKING_COMPLETE = 100;

    // Helper map object to replace change the manifest URL to the endpoint
    // used to retrieve the Vast Ad Response from the ads proxy.
    const ENDPOINTS_MAP_OBJECT = {
      vhls: 'vai',
      hls: 'ai',
    };

    // Constants used to denote the status of particular ad ID request
    const STATE = {
      // Denotes that an ad request is waiting for a response
      WAITING: 'waiting',

      // Denotes that a response has returned for an ad request and the ad is "playing"
      PLAYING: 'playing',

      // Denotes that an error occurred when making the ad request
      ERROR: 'error',
    };

    // variable to store the timeout used to keep track of how long an SSAI ad plays
    let adDurationTimeout;

    // player configuration parameters / page level params
    let bustTheCache = true;

    this.onContentTreeFetched = (event, content) => {
      currentOffset = content.duration;
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, the ui has been setup and the values
     * in amc.ui are ready to be used.
     * @method OoyalaSsai#registerUi
     * @public
     */
    this.registerUi = () => {
      // amc.ui.adVideoElement is now ready for use
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, all movie and server metadata are
     * ready to be parsed.
     * This metadata may contain the adTagUrl and other ad manager and movie specific configuration.
     * @method OoyalaSsai#loadMetadata
     * @public
     * @param {object} adManagerMetadata Ad manager-specific metadata
     * @param {object} backlotBaseMetadata Base metadata from Ooyala Backlot
     * @param {object} movieMetadata Metadata for the main video
     */
    this.loadMetadata = (adManagerMetadata, backlotBaseMetadata, movieMetadata) => {
      this.ready = true;
      this.timeline = {};
      firstAdFound = false;

      amc.reportPluginLoaded(Date.now() - this.initTime, this.name);

      if (adManagerMetadata) {
        // allow boolean true/false
        if (isBoolean(adManagerMetadata.cacheBuster)) {
          bustTheCache = adManagerMetadata.cacheBuster;
        } else if (adManagerMetadata.cacheBuster === 'true') {
          // Allow string true/false.
          bustTheCache = true;
        } else if (adManagerMetadata.cacheBuster === 'false') {
          bustTheCache = false;
        } else {
          // Log message if parameter does not conform to any of the above values.
          OO.log(`${'Ooyala Pulse: page level parameter: "cacheBuster" expected value: "true"'
          + ' or "false", but value received was: '}${adManagerMetadata.cacheBuster}`);
        }
      }
    };

    /**
     * Called once per video by Ad Manager Controller once the ad manager has set its ready flag to true.
     * This function asks the ad manager to return a list of all ads to the controller for addition in the
     * timeline.  If the list of ads is not available at this time, return [] or null and call
     * [OoyalaSsaiController].appendToTimeline() when the ads become available.
     * The duration and position of each ad should be specified in seconds.
     * @method OoyalaSsai#buildTimeline
     * @public
     * @returns {OO.OoyalaSsaiController#Ad[]} timeline A list of the ads to play for the current video
     */
    // Video restrictions can be provided at the ad level. If provided, the player will
    // attempt to create a video element that supports the given video restrictions.
    // If created, it will exist in amc.ui.adVideoElement by the time playAd is called.
    // If the element is not created due to lack of support from the available video plugins,
    // the ad will be skipped
    this.buildTimeline = () => null;

    /**
     * Registered as a callback with the AMC, which gets called by the Ad Manager Controller when the the play head updates
     * during playback.
     * @public
     * @method OoyalaSsai#onPlayheadTimeChanged
     * @param {string} eventname The name of the event for which this callback is called
     * @param {number} playhead The total amount main video playback time (seconds)
     * @param {number} duration Duration of the live video (seconds)
     * @param {number} offset Current video time (seconds). Currently is obtained just for live stream from amc.
     */

    this.onPlayheadTimeChanged = (eventName, playhead, duration, offset) => {
      let offsetParam = 0;
      if (!amc.isLiveStream) {
        if (duration && isNumber(duration) && duration > 0) {
          offsetParam = duration - playhead;
        }
      }
      // For live streams, if user moved the playback head into the past, offset is the seconds in the past that user is watching
      if ((amc.isLiveStream && (offset && isNumber(offset))
          && (duration && isNumber(duration))) && offset > 0 && offset < duration) {
        offsetParam = duration - offset;
      }

      if (isFinite(offsetParam) && offsetParam >= 0) {
        currentOffset = offsetParam;
      }
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should cancel the ad passed to the function as a
     * parameter.  After cancelling the ad, the ad manager should call the adEndedCallback to indicate that
     * ad cancellation has completed.  If the given ad is not currently playing and the adEndedCallback has
     * already been called, then no action is required.
     * @method OoyalaSsai#cancelAd
     * @public
     * @param {object} ad The ad object to cancel
     * @param {object} params An object containing information about the cancellation. It will include the
     *                        following fields:
     *                 code : The amc.AD_CANCEL_CODE for the cancellation
     */
    this.cancelAd = (ad, params) => {
    };

    /**
     * <i>Optional.</i><br/>
     * When the Ad Manager Controller needs to hide the overlay it will call this function.
     * NOTE: This function should only be used by the ad manager if the cancelOverlay function is not being used.
     * NOTE 2: Only implement this function if you plan to hide and reshow the overlay. Otherwise delete it or leave it commented.
     * @method OoyalaSsai#hideOverlay
     * @public
     * @param {object} currentAd The overlay ad object to be stored so when it is shown again, we can update the AMC
     */
    // this.hideOverlay = (currentAd) => {
    // };

    /**
     * <i>Optional.</i><br/>
     * When the Ad Manager Controller needs to cancel the overlay it will call this function.
     * NOTE: This function should only be used by the ad manager if the hideOverlay function is not being used.
     * NOTE 2: Only implement this function if you plan to cancel and not reshow the overlay. Otherwise leave it commented or delete it.
     * @method OoyalaSsai#cancelOverlay
     * @public
     * @param {object} currentAd The overlay ad object that the ad manager needs to know is going to be cancelled and removed
     */
    // this.cancelOverlay = (currentAd) => {
    // };

    /**
     * This function gets called by the ad Manager Controller when an ad has completed playing. If the main video is
     * finished playing and there was an overlay displayed before the post-roll then it needs to be removed. If the main
     * video hasn't finished playing and there was an overlay displayed before the ad video played, then it will show
     * the overlay again.
     * @method OoyalaSsai#showOverlay
     * @public
     */
    this.showOverlay = () => {
    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player detects start of ad video playback.
     * @method OoyalaSsai#adVideoPlaying
     * @public
     */
    this.adVideoPlaying = () => {
    };

    /**
     *
     *
     */
    const _getAdDuration = (id3Object) => {
      let duration = 0;
      // If not start id3 tag from ad, we recalculate ad duration.
      if (id3Object.time != 0) {
        const adOffset = id3Object.time * id3Object.duration / 100;
        duration = id3Object.duration - adOffset;
      } else {
        duration = id3Object.duration;
      }
      return duration * 1000;
    };

    /**
     * Registered as a callback with the AMC, which gets called by the Ad Manager Controller when the replay button is
     * clicked. Here it will try to load the rest of the vast ads at this point if there any.
     * @public
     * @method OoyalaSsai#onReplay
     */
    this.onReplay = function () {
      currentOffset = 0;
      this.currentAd = null;
    };

    /**
     * Called if the ajax call for SSAI metadata succeeds
     * @public
     * @method OoyalaSsai#onMetadataResponse
     * @param {object} metadata The ad metadata JSON
     */
    this.onMetadataResponse = (metadata) => {
      this.timeline = metadata;
      amc.notifySSAIAdTimelineReceived(this.timeline);
    };

    /**
     * Returns the ssai data from the vast object in case if the vast
     * object contains data for the current id3 object.
     * @private
     * @param id3Object
     * @param adIdVastData
     * @returns {*}
     */
    const _getAdObjectFromVast = (id3Object, adIdVastData) => {
      if (has(adIdVastData, id3Object.adId)) {
        return adIdVastData[id3Object.adId];
      }
    };

    /**
     * Set vast data to the cache for
     * current id3 object.
     * @private
     * @method OoyalaSsai#_setVastDataToDictionary
     */
    const _setVastDataToDictionary = (id3Object, adObject) => {
      if (this.adIdDictionary[id3Object.adId]) {
        this.adIdDictionary[id3Object.adId].vastData = adObject;
      }
    };

    /**
     * Force an ad to play with configured ssai ad data
     * @private
     * @method OoyalaSsai#_notifyAmcToPlayAd
     */
    const _notifyAmcToPlayAd = (id3Object, adObject) => {
      let ssaiAd;
      if (adObject && id3Object) {
        ssaiAd = _configureSsaiObject(adObject);
        _setVastDataToDictionary(id3Object, adObject);
        // If not start id3 tag from ad, we recalculate ad duration.
        if (id3Object.time != 0) {
          const adOffset = id3Object.time * id3Object.duration / 100;
          id3Object.duration -= adOffset;
        }
      }

      amc.forceAdToPlay(this.name, ssaiAd, amc.ADTYPE.LINEAR_VIDEO, {}, id3Object.duration);
    };

    /**
     * Helper function to retrieve the ad object's impression urls.
     * @private
     * @method OoyalaSsai#_getImpressionUrls
     * @param {object} adObject The ad metadata
     * @return {string[]|null} The array of impression urls. Returns null if no URLs exist.
     */
    const _getImpressionUrls = (adObject) => {
      let impressionUrls = null;
      if (adObject
        && adObject.ad
        && adObject.ad.data
        && adObject.ad.data.impression
        && adObject.ad.data.impression.length > 0) {
        impressionUrls = adObject.ad.data.impression;
      }
      return impressionUrls;
    };

    /**
     * Helper function to retrieve the ad object's linear click tracking urls.
     * @private
     * @method OoyalaSsai#_getLinearClickTrackingUrls
     * @param {object} adObject The ad metadata
     * @return {string[]|null} The array of linear click tracking urls. Returns null if no
     * URLs exist.
     */
    const _getLinearClickTrackingUrls = (adObject) => {
      let linearClickTrackingUrls = null;
      if (adObject
        && adObject.ad
        && adObject.ad.data
        && adObject.ad.data.linear
        && adObject.ad.data.linear.clickTracking
        && adObject.ad.data.linear.clickTracking.length > 0) {
        linearClickTrackingUrls = adObject.ad.data.linear.clickTracking;
      }
      return linearClickTrackingUrls;
    };

    /**
     * Helper function to retrieve the ad object's tracking urls under a specific event name.
     * @private
     * @method OoyalaSsai#_getLinearTrackingEventUrls
     * @param {object} adObject The ad metadata
     * @param {string} trackingEventName The name of the tracking event
     * @returns {string[]|null} The array of tracking urls associated with the event name. Returns null if no URLs exist.
     */
    const _getLinearTrackingEventUrls = (adObject, trackingEventName) => {
      let trackingUrls = null;
      if (adObject
        && adObject.ad
        && adObject.ad.data
        && adObject.ad.data.linear
        && adObject.ad.data.linear.tracking
        && adObject.ad.data.linear.tracking[trackingEventName]
        && adObject.ad.data.linear.tracking[trackingEventName].length > 0) {
        trackingUrls = adObject.ad.data.linear.tracking[trackingEventName];
      }
      return trackingUrls;
    };

    /**
     * Called if the ajax call fails
     * @public
     * @method OoyalaSsai#onRequestError
     */
    this.onRequestError = (currentId3Object) => {
      OO.log('Ooyala SSAI: Error');
      if (isObject(currentId3Object) && has(this.adIdDictionary, currentId3Object.adId)) {
        this.adIdDictionary[currentId3Object.adId].state = STATE.ERROR;
        this.currentAd = null;
      }
    };

    /**
     * Called if the ajax call for SSAI metadata fails
     * @public
     * @method OoyalaSsai#onMetadataError
     */
    this.onMetadataError = (url, error) => {
      OO.log(`SSAI Metadata Request: Error${JSON.stringify(error)}`);
      if (error !== null) {
        const code = error.status;
        const message = error.responseText;
        amc.raiseApiError(code, message, url);
      }
    };

    /**
     * Callback for Ad Manager Controller. Handles going into and out of fullscreen mode.
     * This is only required for VPAID ads
     * @public
     * @method OoyalaSsai#onFullScreenChanged
     * @param {string} eventName The name of the event for which this callback is called
     * @param {boolean} isFullscreen True if entering fullscreen mode and false when exiting
     */
    this.onFullscreenChanged = (eventName, isFullscreen) => {
      // only try to ping tracking urls if player is playing an ad
      if (adMode) {
        if (isFullscreen) {
          _handleTrackingUrls(this.currentAd, ['fullscreen']);
        } else if (!isFullscreen) {
          _handleTrackingUrls(this.currentAd, ['exitFullscreen']);
        }
      }
    };

    /**
     * Callback for Ad Manager Controller. Handles volume changes.
     * @public
     * @method OoyalaSsai#onAdVolumeChanged
     * @param {string} eventName The name of the event for which this callback is called
     * @param {number} volume The current volume level
     */
    this.onAdVolumeChanged = (eventName, volume) => {
      let url = [];
      if (volume === 0 && volume !== lastVolume) {
        lastVolume = volume;
        url = ['mute'];
      } else if (volume > 0 && lastVolume === 0) {
        lastVolume = volume;
        url = ['unmute'];
      }

      if (adMode) {
        _handleTrackingUrls(this.currentAd, url);
      }
    };

    /**
     * Callback for Ad Manager Controller. Handles mute state changes.
     * @public
     * @method OoyalaSsai#onMuteStateChanged
     * @param {string} eventName The name of the event for which this callback is called
     * @param {boolean} muteState True if ad was muted, false if ad was unmuted
     */
    this.onMuteStateChanged = (eventName, muteState) => {
      let url = [];

      // If volume is zero mute events are not relevant
      if (lastVolume !== 0) {
        if (!isMuted && muteState === true) {
          isMuted = true;
          url = ['mute'];
        } else if (isMuted && muteState === false) {
          isMuted = false;
          url = ['unmute'];
        }

        if (adMode) {
          _handleTrackingUrls(this.currentAd, url);
        }
      }
    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player detects an error in the ad video playback.  If the ad manager did not detect
     * this error itself, it can use this time to end the ad playback.
     * @method OoyalaSsai#adVideoError
     * @public
     * @param {object} adWrapper The current Ad's metadata
     * @param {number} errorCode The error code associated with the video playback error
     */
    this.adVideoError = (adWrapper, errorCode) => {
    };

    const _onContentChanged = () => {
      currentOffset = 0;
    };

    // Helper Functions

    /**
     * Getter for the bustTheCache variable
     * @public
     * @method OoyalaSsai#getBustTheCache
     * @returns {boolean} the bustTheCache variable
     */
    this.getBustTheCache = () => bustTheCache;

    /**
     * Appends a parameter to a url.
     * @private
     * @param  {string} url   Url to append the param to
     * @param  {string} param The parameter to be appended
     * @returns {string}       The resulting url after appending the param
     */
    const _appendParamToUrl = (url, param) => {
      if (isString(url) && isString(param)) {
        if (url.indexOf('?') > -1) {
          return `${url}&${param}`;
        }

        return `${url}?${param}`;
      }
      return url;
    };

    /**
     * Appends the smart player identifier to the request URL.
     * @private
     * @method OoyalaSsai#_makeSmartUrl
     * @param {string} url The stream url
     * @returns {string} The modified stream url with the appended unique identifier.
     */
    const _makeSmartUrl = url => _appendParamToUrl(url, SMART_PLAYER);

    /**
     * Parses the ad url to obtain the ssai guid, embed code and ssai api domain name
     * @private
     * @method OoyalaSsai#_parseUrl
     * @param {string} url The stream url
     */
    const _parseUrl = (url) => {
      if (typeof url !== 'string') {
        return;
      }
      const urlParts = url.split('?');
      if (urlParts === null) {
        return;
      }
      const queryParamString = urlParts[1];
      const mainUrl = urlParts[0];
      const mainUrlParts = mainUrl.split('/');
      if (mainUrlParts !== null) {
        this.domainName = mainUrlParts[2];
        this.currentEmbed = mainUrlParts[4];
      }
      const queryParams = queryParamString.split('&');
      if (queryParams === null) {
        return;
      }
      for (let index = 0; index < queryParams.length; index++) {
        const paramParts = queryParams[index].split('=');
        if (paramParts === null) {
          continue;
        }
        if (paramParts[0] === 'ssai_guid') {
          this.ssaiGuid = paramParts[1];
          return;
        }
      }
    };

    /**
     * Helper function to append "offset" and "aid" query parameters to the request URL.
     * @private
     * @method OoyalaSsai#_appendAdsProxyQueryParameters
     * @param {string} url The request URL
     * @param {string} adId The ID of the ad
     * @returns {string} The request URL with the appended query parameters.
     */
    const _appendAdsProxyQueryParameters = (url, adId) => {
      const offset = OFFSET_PARAM + currentOffset;
      let newUrl = _appendParamToUrl(url, offset);

      const adIdParam = AD_ID_PARAM + adId;
      newUrl = _appendParamToUrl(newUrl, adIdParam);
      return newUrl;
    };

    /**
     * Checks if current ID3 tag is the last one for an ad, value is
     * represented in percentage, being 100 the completed time.
     * @private
     * @method OoyalaSsai#isId3ContainsCompletedTime
     * @param  {float} id3ObjectTime  Time value from currentId3Object
     * @returns {boolean}  True if ID3 tag time is 100
     */
    const isId3ContainsCompletedTime = id3ObjectTime => id3ObjectTime === 100;

    /**
     * Checks if current ID3 tag is the first one for an ad, value is
     * represented in percentage, being 0 the start time.
     * @private
     * @method OoyalaSsai#isId3ContainsStartedTime
     * @param  {float} id3ObjectTime  Time value from currentId3Object
     * @returns {boolean}  True if ID3 tag time is 0
     */
    const isId3ContainsStartedTime = id3ObjectTime => id3ObjectTime === 0;

    /**
     * Helper function to replace change the HLS manifest URL to the endpoint used to retrieve
     * the Vast Ad Response from the ads proxy.
     * @private
     * @method OoyalaSsai#_preformatUrl
     * @param {string} url The request URL
     * @returns {string} The request URL with the formatted request URL.
     */
    const _preformatUrl = url => url.replace(/vhls|hls/gi, matched => ENDPOINTS_MAP_OBJECT[matched]);

    /**
     * Attempts to load the Ad after normalizing the url.
     * @private
     * @method OoyalaSsai#_sendRequest
     * @param {string} url The url that contains the Ad creative
     */
    const _sendRequest = (url, currentId3Object) => {
      fetch(url, {
        method: 'get',
        credentials: 'omit',
        headers: {
          pragma: 'no-cache',
          'cache-control': 'no-cache',
        },
      })
        .then(res => res.text())
        .then(str => (new window.DOMParser()).parseFromString(str, 'text/xml'))
        .then(res => this.onResponse(currentId3Object, res))
        .catch((error) => {
          console.error(error);
          this.onRequestError(currentId3Object);
        });
    };

    /**
     * Helper function to handle the ID3 Ad timeout and request.
     * @private
     * @method OoyalaSsai#_handleId3Ad
     * @param {object} id3Object The ID3 object
     */
    const _handleId3Ad = (id3Object) => {
      // Will call _sendRequest() once live team fixes ads proxy issue. Will directly call onResponse() for now.
      if (!this.testMode) {
        _sendRequest(requestUrl, id3Object);
      } else {
        this.onResponse(id3Object, null);
      }
    };

    /**
     * Attempts to load obtain ad timeline and metadata for the asset from SSAI api.
     * @private
     * @method OoyalaSsai#_sendMetadataRequest
     */

    const _sendMetadataRequest = () => {
      const url = `${window.location.protocol}//${this.domainName}/v1/metadata/${this.currentEmbed}?ssai_guid=${this.ssaiGuid}`;
      fetch(url, {
        method: 'get',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          pragma: 'no-cache',
          'cache-control': 'no-cache',
        },
      })
        .then(res => res.json())
        .then(res => this.onMetadataResponse(res))
        .catch(err => this.onMetadataError(url, err));
    };

    /**
     * Helper function to pretty print the ID3_QUERY_PARAMETERS object.
     * @private
     * @method OoyalaSsai#_id3QueryParametersToString
     * @returns {string} The string: "adid, t, d".
     */
    const _id3QueryParametersToString = () => {
      let result = '';
      each(values(ID3_QUERY_PARAMETERS), (value) => {
        result = `${result + value}, `;
      });
      result = result.slice(0, -2);
      return result;
    };

    /**
     * TODO: Improve return statement jsdoc
     * Parses the string contained in the ID3 metadata.
     * @private
     * @method OoyalaSsai#_parseId3String
     * @param {string} id3String The string contained under the "TXXX" property to parse
     * @returns {object} An object with "adId", "time", and "duration" as properties.
     */
    const _parseId3String = (id3String) => {
      let parsedId3Object = null;
      if (id3String) {
        parsedId3Object = {};
        const queryParameterStrings = id3String.split('&');
        if (queryParameterStrings.length === 3) {
          for (let i = 0; i < queryParameterStrings.length; i++) {
            const queryParameterString = queryParameterStrings[i];
            const queryParameterSplit = queryParameterString.split('=');
            const queryParameterKey = queryParameterSplit[0];
            const queryParameterValue = queryParameterSplit[1];
            if (queryParameterKey === ID3_QUERY_PARAMETERS.AD_ID) {
              parsedId3Object.adId = queryParameterValue;
            } else if (queryParameterKey === ID3_QUERY_PARAMETERS.TIME) {
              parsedId3Object.time = parseFloat(queryParameterValue);
            } else if (queryParameterKey === ID3_QUERY_PARAMETERS.DURATION) {
              parsedId3Object.duration = parseFloat(queryParameterValue);
            } else {
              OO.log(`Ooyala SSAI: ${queryParameterKey} is an unrecognized query parameter.\n`
                + `Recognized query parameters: ${_id3QueryParametersToString()}`);
              parsedId3Object = null;
              break;
            }
          }
        } else {
          OO.log(`Ooyala SSAI: ID3 Metadata String contains${queryParameterStrings.length}query parameters,
                  but was expected to contain 3 query parameters: ${_id3QueryParametersToString()}`);
          parsedId3Object = null;
        }
      }
      return parsedId3Object;
    };

    /**
     * TODO: Improve return statement jsdoc
     * Parses the ID3 metadata that is received.
     * @private
     * @method OoyalaSsai#_parseId3Object
     * @param {object} id3Object The ID3 metadata passed in
     * @returns {object} An object with "adId", "time", and "duration" as properties.
     */
    const _parseId3Object = (id3Object) => {
      let parsedId3Object = null;
      if (id3Object) {
        if (has(id3Object, 'TXXX')) {
          const id3String = id3Object.TXXX;
          parsedId3Object = _parseId3String(id3String);
        } else {
          OO.log('Ooyala SSAI: Expected ID3 Metadata Object to have a \'TXXX\' property');
        }
      }
      return parsedId3Object;
    };

    /**
     * Temporary mock function to force an ad to play until live team fixes ad proxy.
     * @private
     * @method OoyalaSsai#_forceMockAd
     * @param {object} id3Object The ID3 object
     */
    const _forceMockAd = (id3Object) => {
      const ad1 = {
        clickthrough: 'http://www.google.com',
        name: 'Test SSAI Ad',
        ssai: true,
        isLive: true,
      };
      amc.forceAdToPlay(this.name, ad1, amc.ADTYPE.LINEAR_VIDEO, {}, id3Object.duration);
    };

    /**
     * Helper function to retrieve the ad object's title.
     * @private
     * @method OoyalaSsai#_getTitle
     * @param {object} adObject The ad metadata
     * @return {string|null} The title of the ad. Returns null if no title exists.
     */
    const _getTitle = (adObject) => {
      let title = null;
      if (adObject && adObject.title) {
        title = adObject.title;
      }
      return title;
    };

    /**
     * Helper function to retrieve the ad object's linear click through url.
     * @private
     * @method OoyalaSsai#_getLinearClickThroughUrl
     * @param {object} adObject The ad metadata
     * @return {string|null} The linear click through url. Returns null if no
     * URL exists.
     */
    const _getLinearClickThroughUrl = (adObject) => {
      let linearClickThroughUrl = null;
      if (adObject
        && adObject.linear
        && adObject.linear.clickThrough) {
        linearClickThroughUrl = adObject.linear.clickThrough;
      }
      return linearClickThroughUrl;
    };

    /**
     * Configuring the ssai object to force an ad to play
     * @private
     * @method OoyalaSsai#_configureSsaiObject
     * @param adObject
     * @returns {{clickthrough: string, name: string, ssai: boolean, isLive: boolean}}
     */
    const _configureSsaiObject = (adObject) => {
      const ssaiAd = {
        clickthrough: '',
        name: '',
        ssai: true,
        isLive: true,
      };

      ssaiAd.data = adObject;
      ssaiAd.clickthrough = _getLinearClickThroughUrl(adObject);
      ssaiAd.name = _getTitle(adObject);

      return ssaiAd;
    };

    /**
     * Helper function to convert the ad object returned by the Vast#parser function into
     * a key-value pair object where the key is the ad id and the value is the ad object.
     * @private
     * @method OoyalaSsai#_parseVastAdsObject
     * @param {object} vastAds The object containing the parsed ad data
     * @returns {object} The key-value pair object.
     */
    const _parseVastAdsObject = (vastAds) => {
      let vastAd;
      const _adIdVastData = {};
      if (vastAds) {
        if (vastAds.podded && vastAds.podded.length > 0) {
          for (let i = 0; i < vastAds.podded.length; i++) {
            vastAd = vastAds.podded[i];
            if (vastAd && vastAd.id) {
              _adIdVastData[vastAd.id] = vastAd;
            }
          }
        }
        if (vastAds.standalone && vastAds.standalone.length > 0) {
          for (let i = 0; i < vastAds.standalone.length; i++) {
            vastAd = vastAds.standalone[i];
            if (vastAd && vastAd.id) {
              _adIdVastData[vastAd.id] = vastAd;
            }
          }
        }
      }
      return _adIdVastData;
    };

    /**
     * Helper function to get the duration property within the Vast ad object.
     * @private
     * @method OoyalaSsai#_getDuration
     * @param {object} vastAdData The Vast ad object
     * @returns {string} The Vast ad duration time stamp.
     */
    const _getDuration = (vastAdData) => {
      let duration = null;
      if (vastAdData
        && vastAdData.linear
        && vastAdData.linear.duration) {
        duration = vastAdData.linear.duration;
      }
      return duration;
    };

    /**
     * Helper function to retrieve how far (in seconds) the current playhead is from the end (VOD).
     * For Live it indicates how far the playhead is from actual Live (this value mostly is 0,
     * unless user seeks back).
     * @public
     * @method OoyalaSsai#getCurrentOffset
     * @returns {number} The value of the current offset from Live.
     */
    this.getCurrentOffset = () => currentOffset;

    /**
     * Helper function to set how far (in seconds) the current playhead is from the end (VOD).
     * For Live it indicates how far the playhead is from actual Live (this value mostly is 0,
     * unless user seeks back).
     * @public
     * @method OoyalaSsai#setCurrentOffset
     * @param {}
     */
    this.setCurrentOffset = (offset) => {
      currentOffset = offset;
    };

    /**
     * Helper function adjust the duration to a proper value. The priority from which to grab the duration is:
     * 1. ID3 Tag ad duration - if the value is 0, fall through
     * 2. VAST XML Response ad duration - if the ad duration is not defined, fall through
     * 3. FALLBACK_AD_DURATION
     * @private
     * @method OoyalaSsai#_selectDuration
     * @param {object} id3Object The object containing the ID3 Tag information
     * @param {object} vastAdData The object containing the parsed Vast ad data
     * @returns {number} The duration of the ad (in seconds).
     */
    const _selectDuration = (id3Object, vastAdData) => {
      let duration = FALLBACK_AD_DURATION;

      let vastDuration = _getDuration(vastAdData);
      vastDuration = adManagerUtils.convertTimeStampToMilliseconds(vastDuration) / 1000;

      if (id3Object && id3Object.duration > 0) {
        duration = id3Object.duration;
      } else if (vastDuration > 0) {
        duration = vastDuration;
      }
      return duration;
    };

    /**
     * Replaces the %5BCACHEBUSTING%5D / [CACHEBUSTING] string in each URL in the array with a
     * random generated string. The purpose of a cachebuster is to keep the URLs unique to prevent
     * cached responses.
     * @private
     * @method OoyalaSsai#_cacheBuster
     * @param {string[]} urls The array of URLs
     * @returns {string[]} The new array of URLs.
     */
    const _cacheBuster = (urls) => {
      for (let i = 0; i < urls.length; i++) {
        const searchString = '[CACHEBUSTING]';
        const encodedSearchString = encodeURIComponent(searchString);
        const regex = new RegExp(encodedSearchString, 'i');
        const randString = OO.getRandomString();
        urls[i] = urls[i].replace(regex, randString);
      }
      return urls;
    };

    /**
     * Helper function to ping URLs in each set of tracking event arrays.
     * @private
     * @method OoyalaSsai#_pingTrackingUrls
     * @param {object} urlObject An object with the tracking event names and their
     * associated URL array.
     */
    const _pingTrackingUrls = (urlObject) => {
      for (const trackingName in urlObject) {
        if (!urlObject.hasOwnProperty(trackingName)) {
          return;
        }
        try {
          let urls = urlObject[trackingName];
          if (!urls) {
            OO.log(`Ooyala SSAI: No "${trackingName}" tracking URLs provided to ping`);
            return;
          }
          if (bustTheCache) {
            urls = _cacheBuster(urls);
          }
          OO.pixelPings(urls);
          OO.log(`Ooyala SSAI: "${trackingName}" tracking URLs pinged`);
        } catch (e) {
          OO.log(`Ooyala SSAI: Failed to ping "${trackingName}" tracking URLs`);
          if (amc) {
            amc.raiseAdError(e);
          }
        }
      }
    };

    /**
     * Ping a list of tracking event names' URLs.
     * @private
     * @method OoyalaSsai#_handleTrackingUrls
     * @param {object} adObject The ad metadata
     * @param {string[]} trackingEventNames The array of tracking event names
     */
    const _handleTrackingUrls = (adObject, trackingEventNames) => {
      if (adObject) {
        each(trackingEventNames, (trackingEventName) => {
          let urls;
          switch (trackingEventName) {
            case 'impression':
              urls = _getImpressionUrls(adObject);
              break;
            case 'linearClickTracking':
              urls = _getLinearClickTrackingUrls(adObject);
              break;
            default:
              /*
               * Note: Had to change _getTrackingEventUrls to a less generic, _getLinearTrackingEventUrls.
               * Slight discrepancy between Ooyala SSAI and vast ad manager here. For vast, the
               * "tracking" object exists in the ad.data object, but not in Ooyala SSAI.
               */
              urls = _getLinearTrackingEventUrls(adObject, trackingEventName);
          }
          const urlObject = {};
          urlObject[trackingEventName] = urls;
          _pingTrackingUrls(urlObject);
        });
      } else {
        console.log(
          `Ooyala SSAI: Tried to ping URLs: [${trackingEventNames
          }] but ad object passed in was: ${adObject}`,
        );
      }
    };

    /**
     * Helper function to call impressions.
     * @private
     * @method OoyalaSsai#_handleImpressionCalls
     * @param {object} curId3Object An object with the impressions data
     */
    const _handleImpressionCalls = (curId3Object) => {
      if (!isId3ContainsStartedTime(curId3Object.time)) {
        const dataToExecutingImpressions = {
          ad: {
            data: this.adIdDictionary[curId3Object.adId].vastData,
          },
        };

        _handleTrackingUrls(dataToExecutingImpressions, TRACKING_CALL_NAMES[curId3Object.time]);
      }
    };

    /**
     * Callback used when the duration of an ad has passed.
     * @private
     * @method OoyalaSsai#_adEndedCallback
     */
    // var self = this;
    const _adEndedCallback = (clearTimeoutId, objectId) => () => {
      if (clearTimeoutId) {
        clearTimeout(clearTimeoutId);
      }

      if (!isUndefined(this.adIdDictionary[objectId])) {
        amc.notifyLinearAdEnded(this.adIdDictionary[objectId].curAdId);
        amc.notifyPodEnded(this.adIdDictionary[objectId].curAdId);

        adMode = false;
        this.currentAd = null;
        // We delete vast info for this ad, since was completed.
        delete this.adIdDictionary[objectId];
      }
    };

    /**
     * Remove listeners from the Ad Manager Controller about playback.
     * @private
     * @method OoyalaSsai#_removeAMCListeners
     */
    const _removeAMCListeners = () => {
      if (!amc) {
        return;
      }

      amc.removePlayerListener(amc.EVENTS.CONTENT_CHANGED, _onContentChanged);
      amc.removePlayerListener(amc.EVENTS.CONTENT_URL_CHANGED, this.onContentUrlChanged);
      amc.removePlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, this.onPlayheadTimeChanged);
      amc.removePlayerListener(amc.EVENTS.VIDEO_TAG_FOUND, this.onVideoTagFound);
      amc.removePlayerListener(amc.EVENTS.REPLAY_REQUESTED, this.onReplay);
      amc.removePlayerListener(amc.EVENTS.FULLSCREEN_CHANGED, this.onFullscreenChanged);
      amc.removePlayerListener(amc.EVENTS.AD_VOLUME_CHANGED, this.onAdVolumeChanged);
      amc.removePlayerListener(amc.EVENTS.MUTE_STATE_CHANGED, this.onMuteStateChanged);
      amc.removePlayerListener(amc.EVENTS.PLAY_STARTED, this.onPlayStarted);
      amc.removePlayerListener(amc.EVENTS.CONTENT_TREE_FETCHED, this.onContentTreeFetched);
    };

    /**
     * Called by the Ad Manager Controller.  Use this function to initialize, create listeners, and load
     * remote JS files.
     * @method OoyalaSsai#initialize
     * @public
     * @param {object} adManagerController A reference to the Ad Manager Controller
     * @param {string} playerId The unique player identifier of the player initializing the class
     */
    this.initialize = (adManagerController, playerId) => {
      amc = adManagerController;

      // Request embed code provider metadata
      amc.willRequireEmbedCodeMetadata();

      // Add any player event listeners now
      amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, _onContentChanged);

      // Stream URL
      amc.addPlayerListener(amc.EVENTS.CONTENT_URL_CHANGED, this.onContentUrlChanged);
      amc.addPlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, this.onPlayheadTimeChanged);

      // ID3 Tag
      amc.addPlayerListener(amc.EVENTS.VIDEO_TAG_FOUND, this.onVideoTagFound);

      // Replay for Live streams should not be available, but add this for precaution
      amc.addPlayerListener(amc.EVENTS.REPLAY_REQUESTED, this.onReplay);

      // Listeners for tracking events
      amc.addPlayerListener(amc.EVENTS.FULLSCREEN_CHANGED, this.onFullscreenChanged);
      amc.addPlayerListener(amc.EVENTS.AD_VOLUME_CHANGED, this.onAdVolumeChanged);
      amc.addPlayerListener(amc.EVENTS.MUTE_STATE_CHANGED, this.onMuteStateChanged);
      amc.addPlayerListener(amc.EVENTS.PLAY_STARTED, this.onPlayStarted);
      amc.addPlayerListener(amc.EVENTS.CONTENT_TREE_FETCHED, this.onContentTreeFetched);
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should pause the ad passed to the function as a
     * parameter.  If the given ad is not currently playing, no action is required.
     * @method OoyalaSsai#pauseAd
     * @public
     * @param {object} ad The ad object to pause
     */
    this.pauseAd = (ad) => {
      // Removing the ad timeout since ad was paused
      if (adMode) {
        _handleTrackingUrls(this.currentAd, ['pause']);
        if (ad && ad.ad && ad.ad.data && this.adIdDictionary[ad.ad.data.id]) {
          this.adIdDictionary[ad.ad.data.id].pauseTime = (new Date()).getTime();
          clearTimeout(this.adIdDictionary[ad.ad.data.id].adTimer);
        }
      }
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should resume the ad passed to the function as a
     * parameter.  If the given ad is not currently loaded or not paused, no action is required.
     * @method OoyalaSsai#resumeAd
     * @public
     * @param {object} ad The ad object to resume
     */
    this.resumeAd = (ad) => {
      if (adMode) {
        _handleTrackingUrls(this.currentAd, ['resume']);
        if (ad && ad.ad && ad.ad.data && this.adIdDictionary[ad.ad.data.id] && isFinite(ad.duration)) {
          let { duration } = ad;
          const { startTime, pauseTime } = this.adIdDictionary[ad.ad.data.id];
          // Deducting the already played duration of ad  from the actual ad duration for making timer accurate
          if (startTime && isFinite(startTime) && pauseTime && isFinite(pauseTime)) {
            duration = (ad.duration * 1000) - (pauseTime - startTime);
          }

          if (duration < 0) {
            duration = ad.duration * 1000;
          }

          // Setting the ad callback again since ad was resumed
          this.adIdDictionary[ad.ad.data.id].adTimer = delay(
            _adEndedCallback(null, ad.ad.data.id),
            duration,
          );
        }
      }
    };

    /**
     * Called when the player creates a new video element and selects the stream url.
     * @public
     * @method OoyalaSsai#onContentUrlChanged
     * @param {string} url The stream url
     */
    this.onContentUrlChanged = (eventName, url) => {
      // important that smart player parameter is set here
      baseRequestUrl = _makeSmartUrl(url);
      _parseUrl(url);
      amc.updateMainStreamUrl(baseRequestUrl);
      baseRequestUrl = _preformatUrl(baseRequestUrl);
    };

    /**
     * This is an example callback that interprets video stream tags.  The event is subscribed to in
     * the initialize function.
     * @public
     * @method OoyalaSsai#onVideoTagFound
     * @param {string} event The event that triggered this callback
     * @param {string} videoId The id of the video element that processed a tag
     * @param {string} tagType The type of tag that was detected
     * @param {object} metadata Any metadata attached to the found tag
     */
    this.onVideoTagFound = (eventName, videoId, tagType, metadata) => {
      if (!amc.isLiveStream && !currentOffset) {
        return null;
      }

      const currentId3Object = _parseId3Object(metadata);
      if (currentId3Object) {
        if (currentId3Object.time < TRACKING_COMPLETE) {
          amc.notifySSAIAdPlaying(currentId3Object);
        } else if (currentId3Object.time === TRACKING_COMPLETE) {
          amc.notifySSAIAdPlayed();
        }
        if (!amc.isLiveStream && !firstAdFound) {
          if (!this.testMode) {
            _sendMetadataRequest();
          }
          firstAdFound = true;
        }
        requestUrl = baseRequestUrl;
        requestUrl = _appendAdsProxyQueryParameters(requestUrl, currentId3Object.adId);

        // Check to see if we already have adId in dictionary
        if (!has(this.adIdDictionary, currentId3Object.adId)) {
          this.adIdDictionary[currentId3Object.adId] = {
            state: STATE.WAITING,
            adTimer: delay(_adEndedCallback(null, currentId3Object.adId), _getAdDuration(currentId3Object)),
            startTime: (new Date()).getTime(),
          };
          _handleId3Ad(currentId3Object);
        } else if (has(this.adIdDictionary, currentId3Object.adId)
          && !this.adIdDictionary[currentId3Object.adId].state) {
          clearTimeout(this.adIdDictionary[currentId3Object.adId].adTimer);
          this.adIdDictionary[currentId3Object.adId].state = STATE.WAITING;
          this.adIdDictionary[currentId3Object.adId].startTime = (new Date()).getTime();
          this.adIdDictionary[currentId3Object.adId].adTimer = delay(
            _adEndedCallback(null, currentId3Object.adId),
            _getAdDuration(currentId3Object),
          );
          _notifyAmcToPlayAd(currentId3Object, this.adIdDictionary[currentId3Object.adId].vastData);
        }
        if (this.adIdDictionary[currentId3Object.adId].state !== STATE.ERROR) {
          _handleImpressionCalls(currentId3Object);
        }

        if (has(this.adIdDictionary, currentId3Object.adId)
          && isId3ContainsCompletedTime(currentId3Object.time)) {
          _adEndedCallback(this.adIdDictionary[currentId3Object.adId].adTimer, currentId3Object.adId)();
        }
      }

      return currentId3Object;
    };

    this.onPlayStarted = () => {
      _sendMetadataRequest();
    };

    /**
     * Called if the ajax call succeeds
     * @public
     * @method OoyalaSsai#onResponse
     * @param {object} id3Object The ID3 object
     * @param {XMLDocument} xml The xml returned from loading the ad
     */
    this.onResponse = (id3Object, xml) => {
      OO.log('Ooyala SSAI: Response');
      // Call VastParser code
      const vastAds = this.vastParser.parser(xml);
      const adIdVastData = _parseVastAdsObject(vastAds);

      const adObject = _getAdObjectFromVast(id3Object, adIdVastData);
      _notifyAmcToPlayAd(id3Object, adObject);
      // If response succeded, we make impression calls
      _handleImpressionCalls(id3Object);
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should play the ad or group of podded ads passed to
     * the function as a parameter.
     * @method OoyalaSsai#playAd
     * @public
     * @param {object} ad The ad object to play
     * @param {function} adPodStartedCallback Call this function when the ad or group of podded ads have
     *                                        started
     * @param {function} adPodEndedCallback Call this function when the ad or group of podded ads have
     *                                      completed
     * @param {function} adStartedCallback Call this function each time an ad in the set starts
     * @param {function} adEndedCallback Call this function each time an ad in the set completes
     */
    this.playAd = (ad, adPodStartedCallback, adPodEndedCallback, adStartedCallback, adEndedCallback) => {
      if (ad) {
        adMode = true;
        this.currentAd = ad;
        if (ad.ad && ad.ad.data && ad.ad.data.id) {
          this.adIdDictionary[ad.ad.data.id].curAdId = ad.id;
          _handleTrackingUrls(this.currentAd, ['impression', 'start']);
          if (ad.duration && !isNumber(ad.duration)) {
            ad.duration = 0;
          }
          amc.notifyLinearAdStarted(ad.id,
            {
              name: ad.ad.name,
              hasClickUrl: true,
              duration: ad.duration,
              ssai: ad.ad.ssai,
              isLive: ad.ad.isLive,
            });
        }
      }
    };

    /**
     * <i>Optional.</i><br/>
     * Called when player clicks on the tap frame, if tap frame is disabled, then this function will not be
     * called
     * @method OoyalaSsai#playerClicked
     * @public
     */
    this.playerClicked = (amcAd, showPage) => {
      if (amcAd && amcAd.ad) {
        _handleTrackingUrls(amcAd, ['linearClickTracking']);
        window.open(amcAd.ad.clickthrough);
      }
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should destroy itself.  It will be unregistered by
     * the Ad Manager Controller.
     * @method OoyalaSsai#destroy
     * @public
     */
    this.destroy = () => {
      // reset parameters
      this.ready = false;
      this.currentAd = null;
      this.adIdDictionary = {};
      _removeAMCListeners();
    };
  };
  return new OoyalaSsai();
});
