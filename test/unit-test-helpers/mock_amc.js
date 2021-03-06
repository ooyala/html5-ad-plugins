/* eslint-disable require-jsdoc */
const sinon = require('sinon');

FakeAmc = function () {
  this.timeline = [];
  this.callbacks = {};
  this.addPlayerListener = function (event, callback) {
    this.callbacks[event] = callback;
  };
  this.publishPlayerEvent = function (...args) { // convenience method for unit tests
    const [event] = args;
    if (event && typeof this.callbacks[event] === 'function') {
      this.callbacks[event].apply(this, args);
    }
  };
  this.FORCED_AD_POSITION = -1;
  this.EVENTS = {
    INITIAL_PLAY_REQUESTED: 'initialPlayRequested',
    PLAY_STARTED: 'playStarted',
    PLAYHEAD_TIME_CHANGED: 'playheadTimeChanged',
    AD_PLAYHEAD_TIME_CHANGED: 'adPlayheadTimeChanged',
    PAUSE: 'pause',
    RESUME: 'resume',
    CONTENT_COMPLETED: 'contentCompleted',
    CONTENT_AND_ADS_COMPLETED: 'contentAndAdsCompleted',
    SIZE_CHANGED: 'sizeChanged',
    CONTROLS_SHOWN: 'controlsShown',
    CONTROLS_HIDDEN: 'controlsHidden',
    CONTENT_CHANGED: 'contentChanged',
    FULLSCREEN_CHANGED: 'fullscreenChanged',
    VOLUME_CHANGED: 'volumeChanged',
    AD_VOLUME_CHANGED: 'adVolumeChanged',
    MAIN_CONTENT_IN_FOCUS: 'mainContentInFocus',
    REPLAY_REQUESTED: 'replayRequested',
  };
  this.AD_SETTINGS = {
    PAUSE_AD_ON_CLICK: 'pauseAdOnClick',
    AD_MANAGER_LOAD_TIMEOUT: 'adManagerLoadTimeout',
    AD_LOAD_TIMEOUT: 'adLoadTimeout',
    DISPLAY_CUE_POINTS: 'displayCuePointMarkers',
    REPLAY_ADS: 'replayAds',
    SHOW_NONLINEAR_CLOSE_BUTTON: 'showNonLinearCloseButton',
    SHOW_LINEAR_AD_SKIP_BUTTON: 'showLinearAdSkipButton',
    LINEAR_AD_SKIP_BUTTON_START_TIME: 'linearAdSkipButtonStartTime',
    ALLOW_AD_CLICK_THROUGH_ON_VIDEO: 'allowAdClickThroughOnVideo',
    PRELOAD_ADS: 'preloadAds',
  };
  this.ADTYPE = {
    LINEAR_OVERLAY: 'linearOverlay',
    NONLINEAR_OVERLAY: 'nonlinearOverlay',
    LINEAR_VIDEO: 'linearVideo',
    COMPANION: 'companion',
    AD_REQUEST: 'adRequest',
    UNKNOWN_AD_REQUEST: 'unknownAdRequest',
  };
  this.AD_CANCEL_CODE = {
    SKIPPED: 'skipped',
    TIMEOUT: 'timeout',
    ERROR: 'error',
    STREAM_ENDED: 'streamEnded',
  };
  const adType = this.ADTYPE;
  this.Ad = function (adObj) {
    adObj.isLinear = (adObj.adType === adType.LINEAR_VIDEO) || (adObj.adType === adType.LINEAR_OVERLAY);
    adObj.isRequest = (adObj.adType === adType.AD_REQUEST) || (adObj.adType === adType.UNKNOWN_AD_REQUEST);
    return adObj;
  };
  this.currentEmbedCode = 'embed';
  this.movieDuration = 60;
  this.ui = {
    rootElement: $('<div>', {}),
    videoWrapper: $('<div>', {}),
    playerSkinVideoWrapper: $('<div>', {}),
    ooyalaVideoElement: $('<div>', { class: 'video' }),
    adVideoElement: $('<div>', { class: 'video' }),
    pluginsElement: $('<div>', {}),
    playerSkinPluginsElement: $('<div>', {}),
    adWrapper: $('<div>', {}),
    transitionToAd() {},
    transitionToMainContent() {},
    useSingleVideoElement: false,
  };
  this.platform = {};
  this.pageSettings = {};
  this.loadAdModule = function () {};
  this.onAdManagerReady = function () {};
  this.removeAdManager = function () {};
  this.appendToTimeline = function (timeline) {
    this.timeline = this.timeline.concat(timeline);
  };
  this.raiseAdError = function () {};
  this.raiseAdPlayhead = function () {};
  this.adsClicked = function () {};
  this.onAdSdkLoaded = function () {};
  this.onAdSdkLoadFailure = function () {};
  this.onAdRequest = function () {};
  this.onAdRequestSuccess = function () {};
  this.onAdRequestEmpty = function () {};
  this.onAdRequestError = function () {};
  this.onAdPlaybackError = function () {};
  this.onAdSdkImpression = function () {};
  this.onAdImpression = function () {};
  this.onAdCompleted = function () {};
  this.adsClickthroughOpened = sinon.spy();
  this.notifyPodStarted = function () {};
  this.notifyPodEnded = function () {};
  this.notifyLinearAdStarted = function () {};
  this.notifyLinearAdEnded = function () {};
  this.notifyNonlinearAdStarted = function () {};
  this.notifyNonlinearAdEnded = function () {};
  this.notifySSAIAdTimelineReceived = function () {};
  this.notifySSAIAdPlaying = function () {};
  this.notifySSAIAdPlayed = function () {};
  this.updateMainStreamUrl = function () {};
  this.hidePlayerUi = function () {};
  this.focusAdVideo = function () {};
  this.reportPluginLoaded = function () {};
  this.adManagerWillControlAds = function () {};
  this.adManagerDoneControllingAds = function () {};
  this.removePlayerListener = function () {};
  this.unregisterAdManager = function () {};
  this.forceAdToPlay = function () {};
  this.sendURLToLoadAndPlayNonLinearAd = function () {};
  this.showSkipVideoAdButton = function () {};
  this.showCompanion = function () {};
  this.onSdkAdEvent = function () {};
  this.adManagerSettings = {};
  this.willRequireEmbedCodeMetadata = function () {};
};
