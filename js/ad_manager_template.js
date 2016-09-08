/*
 * Ad Manager Template
 * This file can be used to model a new ad manager for the Ooyala HTML5 player.
 *
 * version 0.1
 */

OO.Ads.manager(function(_, $) {
  /**
   * @class AdManager
   * @classDesc The main Ad Manager class.
   * @public
   * @property {string} name The name of the ad manager. This should match the name used by the server to
   *                         provide metadata.
   * @property {boolean} ready Should be set to false initially.  Should be set to true when the ad manager
   *                           has loaded all external files and metadata to notify the controller that the
   *                           ad manager is ready for the user to hit play.
   * @property {object} videoRestrictions Optional property that represents restrictions on the video plugin
   *   used.  ex. {"technology":OO.VIDEO.TECHNOLOGY.HTML5, "features":[OO.VIDEO.FEATURE.VIDEO_OBJECT_TAKE]}
   */
  var AdManager = function() {
    this.name = "my-ads-manager";
    this.ready = false;
    this.videoRestrictions = {};

    var amc  = null;
    var remoteModuleJs = "http://my.company/myAdModule.js";
    var adModuleJsReady = false;

    /**
     * Called by the Ad Manager Controller.  Use this function to initialize, create listeners, and load
     * remote JS files.
     * @method AdManager#initialize
     * @public
     * @param {object} adManagerController A reference to the Ad Manager Controller
     * @param {string} playerId The unique player identifier of the player initializing the class
     */
    this.initialize = function(adManagerController, playerId) {
      amc = adManagerController;

      // Add any player event listeners now
      amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, _.bind(_onContentChanged, this));

      //ID3 Tag example
      amc.addPlayerListener(amc.EVENTS.VIDEO_TAG_FOUND, _.bind(this.onVideoTagFound, this));

      // Loads a remote file.  Use this function to load the client SDK for your ad module.
      amc.loadAdModule(this.name, remoteModuleJs, _.bind(function(success) {
        adModuleJsReady = success;
      }, this));

      // Initialize the module here
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, the ui has been setup and the values
     * in amc.ui are ready to be used.
     * @method AdManager#registerUi
     * @public
     */
    this.registerUi = function() {
      // amc.ui.adVideoElement is now ready for use
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, all movie and server metadata are
     * ready to be parsed.
     * This metadata may contain the adTagUrl and other ad manager and movie specific configuration.
     * @method AdManager#loadMetadata
     * @public
     * @param {object} adManagerMetadata Ad manager-specific metadata
     * @param {object} backlotBaseMetadata Base metadata from Ooyala Backlot
     * @param {object} movieMetadata Metadata for the main video
     */
    this.loadMetadata = function(adManagerMetadata, backlotBaseMetadata, movieMetadata) {
      this.ready = true;
    };

    /**
     * Called once per video by Ad Manager Controller once the ad manager has set its ready flag to true.
     * This function asks the ad manager to return a list of all ads to the controller for addition in the
     * timeline.  If the list of ads is not available at this time, return [] or null and call
     * [AdManagerController].appendToTimeline() when the ads become available.
     * The duration and position of each ad should be specified in seconds.
     * @method AdManager#buildTimeline
     * @public
     * @returns {OO.AdManagerController#Ad[]} timeline A list of the ads to play for the current video
     */
    this.buildTimeline = function() {
      var ad1 = {}, ad2 = {};
      //Video restrictions can be provided at the ad level. If provided, the player will
      //attempt to create a video element that supports the given video restrictions.
      //If created, it will exist in amc.ui.adVideoElement by the time playAd is called.
      //If the element is not created due to lack of support from the available video plugins,
      //the ad will be skipped
      return [ new amc.Ad({ position: 0,
                            duration: 10,
                            adManager: this.name,
                            ad: ad1,
                            adType: amc.ADTYPE.LINEAR_VIDEO,
                            videoRestrictions: { technology: OO.VIDEO.TECHNOLOGY.HTML5 }
                          }),
               new amc.Ad({ position: 30,
                            duration: 10,
                            adManager: this.name,
                            ad: ad2,
                            adType: amc.ADTYPE.NONLINEAR_OVERLAY
                          })
             ];
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should play the ad or group of podded ads passed to
     * the function as a parameter.
     * @method AdManager#playAd
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
      // When the ad impression has started or when the first ad in a set of podded ads has begun,  trigger
      //   adStartedCallback
      // When the ad or group of podded ads are done, trigger adEndedCallback
      // Each time an ad impression starts, trigger adStartedCallback
      // Each time an ad ends, trigger adEndedCallback
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should cancel the ad passed to the function as a
     * parameter.  After cancelling the ad, the ad manager should call the adEndedCallback to indicate that
     * ad cancellation has completed.  If the given ad is not currently playing and the adEndedCallback has
     * already been called, then no action is required.
     * @method AdManager#cancelAd
     * @public
     * @param {object} ad The ad object to cancel
     * @param {object} params An object containing information about the cancellation. It will include the
     *                        following fields:
     *                 code : The amc.AD_CANCEL_CODE for the cancellation
     */
    this.cancelAd = function(ad, params) {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should pause the ad passed to the function as a
     * parameter.  If the given ad is not currently playing, no action is required.
     * @method AdManager#pauseAd
     * @public
     * @param {object} ad The ad object to pause
     */
    this.pauseAd = function(ad) {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should resume the ad passed to the function as a
     * parameter.  If the given ad is not currently loaded or not paused, no action is required.
     * @method AdManager#resumeAd
     * @public
     * @param {object} ad The ad object to resume
     */
    this.resumeAd = function(ad) {
    };

    /**
     * <i>Optional.</i><br/>
     * When the Ad Manager Controller needs to hide the overlay it will call this function.
     * NOTE: This function should only be used by the ad manager if the cancelOverlay function is not being used.
     * NOTE 2: Only implement this function if you plan to hide and reshow the overlay. Otherwise delete it or leave it commented.
     * @method AdManager#hideOverlay
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
     * @method AdManager#cancelOverlay
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
     * @method AdManager#showOverlay
     * @public
     */
    this.showOverlay = function() {
    };

    /**
     * <i>Optional.</i><br/>
     * Called when player clicks on the tap frame, if tap frame is disabled, then this function will not be
     * called
     * @method AdManager#playerClicked
     * @public
    */
    this.playerClicked = function(amcAd, showPage) {
    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player detects start of ad video playback.
     * @method AdManager#adVideoPlaying
     * @public
     */
    this.adVideoPlaying = function() {

    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player focuses the ad video element.
     * @method AdManager#adVideoFocused
     * @public
     */
    this.adVideoFocused = function() {

    };

    /**
     * This is an example callback that interprets video stream tags.  The event is subscribed to in
     * the initialize function.
     * @public
     * @method AdManager#onVideoTagFound
     * @param {string} event The event that triggered this callback.
     * @param {string} videoId The id of the video element that processed a tag.
     * @param {string} tagType The type of tag that was detected.
     * @param {object} metadata Any metadata attached to the found tag.
     */
    this.onVideoTagFound = function(event, videoId, tagType, metadata) {
      OO.log("TAG FOUND w/ args: ", arguments);
    }

    /**
     * <i>Optional.</i><br/>
     * Called when the player detects an error in the ad video playback.  If the ad manager did not detect
     * this error itself, it can use this time to end the ad playback.
     * @method AdManager#adVideoError
     * @public
     * @param {object} adWrapper The current Ad's metadata
     * @param {number} errorCode The error code associated with the video playback error
     */
    this.adVideoError = function(adWrapper, errorCode) {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should destroy itself.  It will be unregistered by
     * the Ad Manager Controller.
     * @method AdManager#destroy
     * @public
     */
    this.destroy = function() {
      // Stop any running ads
    };

    var _onContentChanged = function() {
      // Callback for example listener registered in this.initialize
    }
  };

  return new AdManager();
});
