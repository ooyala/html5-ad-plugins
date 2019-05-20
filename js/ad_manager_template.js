/*
 * Ad Manager Template
 * This file can be used to model a new ad manager for the Ooyala HTML5 player.
 *
 * version 0.1
 */

OO.Ads.manager(() => {
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
  const AdManager = function () {
    this.name = 'my-ads-manager';
    this.ready = false;
    this.videoRestrictions = {};

    let amc = null;
    const remoteModuleJs = 'http://my.company/myAdModule.js';
    // eslint-disable-next-line no-unused-vars
    let adModuleJsReady = false;

    /**
     * Callback for when we receive the CONTENT_CHANGED event from the AMC.
     * @private
     */
    const _onContentChanged = () => {
      // Callback for example listener registered in this.initialize
    };

    /**
     * Called by the Ad Manager Controller.  Use this function to initialize, create listeners, and load
     * remote JS files.
     * @method AdManager#initialize
     * @public
     * @param {object} adManagerController A reference to the Ad Manager Controller
     * @param {string} playerId The unique player identifier of the player initializing the class
     */
    // eslint-disable-next-line no-unused-vars
    this.initialize = (adManagerController, playerId) => {
      amc = adManagerController;

      // Add any player event listeners now
      amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, _onContentChanged);

      // ID3 Tag example
      amc.addPlayerListener(amc.EVENTS.VIDEO_TAG_FOUND, this.onVideoTagFound);

      // Loads a remote file.  Use this function to load the client SDK for your ad module.
      amc.loadAdModule(this.name, remoteModuleJs, (success) => {
        adModuleJsReady = success;
      });

      // Initialize the module here
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, the ui has been setup and the values
     * in amc.ui are ready to be used.
     * @method AdManager#registerUi
     * @public
     */
    this.registerUi = () => {
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
    // eslint-disable-next-line no-unused-vars
    this.loadMetadata = (adManagerMetadata, backlotBaseMetadata, movieMetadata) => {
      this.ready = true;
      // Call the onAdManagerReady API after setting this.ready to true
      // to notify the Ad Manager Controller that this ad plugin is ready
      amc.onAdManagerReady();
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
    this.buildTimeline = () => {
      const ad1 = {}; const
        ad2 = {};
      // Video restrictions can be provided at the ad level. If provided, the player will
      // attempt to create a video element that supports the given video restrictions.
      // If created, it will exist in amc.ui.adVideoElement by the time playAd is called.
      // If the element is not created due to lack of support from the available video plugins,
      // the ad will be skipped
      return [new amc.Ad({
        position: 0,
        duration: 10,
        adManager: this.name,
        ad: ad1,
        adType: amc.ADTYPE.LINEAR_VIDEO,
        videoRestrictions: { technology: OO.VIDEO.TECHNOLOGY.HTML5 },
      }),
      new amc.Ad({
        position: 30,
        duration: 10,
        adManager: this.name,
        ad: ad2,
        adType: amc.ADTYPE.NONLINEAR_OVERLAY,
      }),
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
    // eslint-disable-next-line no-unused-vars
    this.playAd = (ad, adPodStartedCallback, adPodEndedCallback, adStartedCallback, adEndedCallback) => {
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
    // eslint-disable-next-line no-unused-vars
    this.cancelAd = (ad, params) => {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should pause the ad passed to the function as a
     * parameter.  If the given ad is not currently playing, no action is required.
     * @method AdManager#pauseAd
     * @public
     * @param {object} ad The ad object to pause
     */
    // eslint-disable-next-line no-unused-vars
    this.pauseAd = (ad) => {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should resume the ad passed to the function as a
     * parameter.  If the given ad is not currently loaded or not paused, no action is required.
     * @method AdManager#resumeAd
     * @public
     * @param {object} ad The ad object to resume
     */
    // eslint-disable-next-line no-unused-vars
    this.resumeAd = (ad) => {
    };

    /**
     * This function gets called by the ad Manager Controller when an ad has completed playing. If the main video is
     * finished playing and there was an overlay displayed before the post-roll then it needs to be removed. If the main
     * video hasn't finished playing and there was an overlay displayed before the ad video played, then it will show
     * the overlay again.
     * @method AdManager#showOverlay
     * @public
     */
    this.showOverlay = () => {

    };

    /**
     * <i>Optional.</i><br/>
     * Called when player clicks on the tap frame, if tap frame is disabled, then this function will not be
     * called
     * @method AdManager#playerClicked
     * @public
    */
    this.playerClicked = () => {
    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player detects start of ad video playback.
     * @method AdManager#adVideoPlaying
     * @public
     */
    this.adVideoPlaying = () => {

    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player focuses the ad video element.
     * @method AdManager#adVideoFocused
     * @public
     */
    this.adVideoFocused = () => {

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
    this.onVideoTagFound = (event, videoId, tagType, metadata) => {
      OO.log('TAG FOUND w/ args: ', [event, videoId, tagType, metadata]);
    };

    /**
     * <i>Optional.</i><br/>
     * Called when the player detects an error in the ad video playback.  If the ad manager did not detect
     * this error itself, it can use this time to end the ad playback.
     * @method AdManager#adVideoError
     * @public
     * @param {object} adWrapper The current Ad's metadata
     * @param {number} errorCode The error code associated with the video playback error
     */
    // eslint-disable-next-line no-unused-vars
    this.adVideoError = (adWrapper, errorCode) => {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should destroy itself.  It will be unregistered by
     * the Ad Manager Controller.
     * @method AdManager#destroy
     * @public
     */
    this.destroy = () => {
      // Stop any running ads
    };

    /**
     * Called by the Ad Manager Controller to determine if an ad video element must be created on player
     * initialization. This is done so that the Video Controller can interface with the Ad's Video Plugin
     * prior to an ad request. A typical use case would be to pass a user click to the ad plugin prior
     * to ad playback so that the ad can start unmuted for browsers that require user interaction for
     * unmuted playback.
     * @method AdManager#createAdVideoElementOnPlayerInit
     * @public
     * @returns {string[]} An array of encoding types corresponding to the video elements that the Video Controller
     *                     should create. Return an empty array, null, or undefined if this is not required.
     */
    this.createAdVideoElementOnPlayerInit = () => [];
  };

  return new AdManager();
});
