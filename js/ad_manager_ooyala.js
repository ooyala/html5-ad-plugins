/**
 * Ad Manager For Ooyala video as Ads
 */
require("../html5-common/js/utils/InitModules/InitOOHazmat.js");
require("../html5-common/js/utils/constants.js");
require("../html5-common/js/utils/environment.js");

OO.Ads.manager(function(_, $) {
  /**
   * @class OoyalaAdManager
   * @classDesc The Ooyala Ads Manager class, registered as an ads manager with the ad manager controller.
   * Controls how Ooyala videos loaded and played as ads while communicating with the ad manager framework.
   * @public
   * @property {string} name Name of the OoyalaAdManager, must match what is sent from Backlot and used at the page level
   * @property {object} _amc An internal reference to the Ad Manager Fratmework
   * @property {string} _adEmbedCode Keeps track of the embed code of the ooyala ad that is currently playing
   * @property {string} __movieEmbedCode Keeps track of the embed code of the main video that is currently playing
   * @property {boolean} _getMainVideoEmbedCode To get the embed code of the main video from the metadata
   * @property {boolean} _playedAtleastOnce To keep track of the main video play
   * @property {object} _adProperties Stores the ad data of the ad that is currently being loaded
   */
  var OoyalaAdManager = function() {
    this.name = "ooyala-ads-manager";
    this.ready = false;
    this.movieMetadata = {};
    this.streams = {};
    var _amc  = null;
    var _adEmbedCode = "";
    var _movieEmbedCode ="";
    var _getMainVideoEmbedCode =true;
    var _playedAtleastOnce = false;
    var _adProperties = {};
    var _urlOpened = false;
    var _adEnded = false;
    
    /**
     * Called by the Ad Manager Controller. Use this function to initialize, create listeners, and load
     * remote JS files.
     * @method AdManager#initialize
     * @public
     * @param {object} adManagerController A reference to the Ad Manager Controller
     * @param {string} playerId The unique player identifier of the player initializing the class
     */
    this.initialize = function(adManagerController, playerId) {
      _amc = adManagerController;
      if (_amc) {
        _amc.addPlayerListener(_amc.EVENTS.INITIAL_PLAY_REQUESTED, _onInitialPlayRequested);
        _amc.addPlayerListener(_amc.EVENTS.CONTENT_COMPLETED, _onContentCompleted);
      }
    };

    /**
     * Called by Ad Manager Controller. When this function is called, all movie and server metadata are
     * ready to be parsed.
     * This metadata may contain the adTagUrl and other ad manager and movie specific configuration.
     * @method AdManager#loadMetadata
     * @public
     * @param {object} adManagerMetadata Ad manager-specific metadata
     * @param {object} backlotBaseMetadata Base metadata from Ooyala Backlot
     * @param {object} movieMetadata Metadata for the main video
     */
    this.loadMetadata = function(adManagerMetadata, backlotBaseMetadata, movieMetadata) {
      if (!movieMetadata) return;
      this.movieMetadata = movieMetadata;
      if (_getMainVideoEmbedCode == true) {
        _movieEmbedCode = movieMetadata.embed_code;
        _getMainVideoEmbedCode = false;
      }
      _adEmbedCode = movieMetadata.ads[0].ad_embed_code;
      var adsRequest = {
        pcode: movieMetadata.asset_pcode || "unknown",
        embedCode: movieMetadata.ads[0].ad_embed_code,
        server: OO.SERVER.AUTH,
        params: {}
      };
      _amc.notify(_amc.EVENTS.WILL_FETCH_AD_AUTHORIZATION,adsRequest); 
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, all the information about the Ooyala
     * ads will be received and will notify the controller that the Ad Manager is ready.
     * @public
     * @param {object} adData Ad-specific metadata
     */
    this.ooyalaAdData = function(adData) {
      if (!adData) return;
      this.streams[OO.VIDEO.ENCODING.MP4] = adData;
      this.ready = true;
      _amc.onAdManagerReady();
    };

    /**
     * Called once per video by Ad Manager Controller once the ad manager has set its ready flag to true.
     * This function asks the ad manager to return a list of all ads to the controller for addition in the
     * line. If the list of ads is not available at this time, return [] or null and call
     * [AdManagerController].appendToTimeline() when the ads become available.
     * The duration and position of each ad should be specified in seconds.
     * @method AdManager#buildTimeline
     * @public
     * @returns {OO.AdManagerController#Ad[]} timeline A list of the ads to play for the current video
     */
    this.buildTimeline = function() {
      var adsTimeline = [];
      var adData = {
        "position": this.movieMetadata.ads[0].time,
        "adManager": this.name,
        "ad": this.movieMetadata.ads[0],
        "streams": this.streams,
        "adType": _amc.ADTYPE.UNKNOWN_AD_REQUEST
      };
      var adToInsert = new _amc.Ad(adData);
      adsTimeline.push(adToInsert);  
      return adsTimeline;       
    };

    /**
     * Called by Ad Manager Controller. The ad manager should play the ad or group of podded ads passed to
     * the function as a parameter.
     * @method AdManager#playAd
     * @public
     * @param {object} ad The ad object to play
     */
    this.playAd = function(ad) {
      var ooyalaAdAutoPlay = {"autoPlay" : true}; 
      _adProperties.indexInPod = 1;
      _adProperties.name = this.movieMetadata.title;
      _adProperties.duration = this.movieMetadata.duration;
      _adProperties.hasClickUrl = ad.ad.click_url;
      _adProperties.skippable = false;
      _amc.notify(_amc.EVENTS.SET_EMBED_CODE, _adEmbedCode, ooyalaAdAutoPlay);
      _amc.hidePlayerUi();
      _amc.notifyPodStarted(ad.id, 1);
      _amc.notifyLinearAdStarted(ad.id, _adProperties);
    };

    /**
     * Called by Ad Manager Controller. The ad manager should cancel the ad passed to the function as a
     * parameter. After cancelling the ad, the ad manager should call the adEndedCallback to indicate that
     * ad cancellation has completed. If the given ad is not currently playing and the adEndedCallback has
     * already been called, then no action is required.
     * @method AdManager#cancelAd
     * @public
     * @param {object} ad The ad object to cancel
     * @param {object} params An object containing information about the cancellation. It will include the
     *                        following fields:
     *                 code : The _amc.AD_CANCEL_CODE for the cancellation
     */
    this.cancelAd = function(ad, params) {
    };

    /**
     * Called when player clicks on the tap frame, if tap frame is disabled, then this function will not be
     * called
     * @method AdManager#playerClicked
     * @public
    */
    this.playerClicked = function() {
      OO.log("Click Url = " + _adProperties.hasClickUrl);
      if (_playedAtleastOnce || _adEnded) {return;} 
      _urlOpened = this.openUrl(_adProperties.hasClickUrl);
      if (_urlOpened) {
        _amc.adsClickthroughOpened();
      }
    };

    /**
     * Opens a new page pointing to the URL provided.
     * @public
     * @method AdManager#openUrl
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
     * Sets _adEnded to true indicating that Ad has played completely.
     * @public
     * @method AdManager#adEnded
     */
    this.adEnded = function() {
      _adEnded = true;
    }

    var _onInitialPlayRequested = function() {
      _amc.adManagerWillControlAds(this.name);
    }
    
    var _onContentCompleted = function() { 
      if (_playedAtleastOnce == false) {
        _playedAtleastOnce = true;
        _amc.notify(_amc.EVENTS.AMC_PREROLLS_DONE,null);
        _amc.notify(_amc.EVENTS.SET_EMBED_CODE, _movieEmbedCode);
      } else {
        _amc.adManagerDoneControllingAds();
      }
    }
  };
  return new OoyalaAdManager();
});
