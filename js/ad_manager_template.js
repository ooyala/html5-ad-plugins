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

    /**
     * Called by the Ad Manager Controller.  Use this function to initialize, create listeners, and load
     * remote JS files.
     * @method AdManager#initialize
     * @public
     * @param {object} adManagerController A reference to the Ad Manager Controller
     * @param {string} playerId The unique player identifier of the player initializing the class
     */
    this.initialize = (adManagerController) => {
      amc = adManagerController;

      // Add any player event listeners now
      amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED);

      // ID3 Tag example
      amc.addPlayerListener(amc.EVENTS.VIDEO_TAG_FOUND, this.onVideoTagFound);

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
     */
    this.loadMetadata = () => {
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
     */
    this.playAd = () => {
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
     */
    this.cancelAd = () => {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should pause the ad passed to the function as a
     * parameter.  If the given ad is not currently playing, no action is required.
     * @method AdManager#pauseAd
     * @public
     */
    this.pauseAd = () => {
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should resume the ad passed to the function as a
     * parameter.  If the given ad is not currently loaded or not paused, no action is required.
     * @method AdManager#resumeAd
     * @public
     */
    this.resumeAd = () => {
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
     */
    this.onVideoTagFound = () => {
      OO.log('TAG FOUND w/ args: ', arguments);
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
  };

  return new AdManager();
});
