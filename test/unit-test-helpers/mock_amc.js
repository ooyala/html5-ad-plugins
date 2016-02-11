fake_amc = function() {
  this.timeline = [];
  this.callbacks = {};
  this.addPlayerListener = function(event, callback){
    this.callbacks[event] = callback;
  };
  this.publishPlayerEvent = function(event){    //convenience method for unit tests
    if(typeof this.callbacks[event] === "function"){
      this.callbacks[event].apply(this, arguments);
    }
  };
  this.EVENTS = {
    INITIAL_PLAY_REQUESTED : "initialPlayRequested",
    PLAYHEAD_TIME_CHANGED : "playheadTimeChanged"
  };
  this.AD_SETTINGS  = {};
  this.ADTYPE = {
    LINEAR_OVERLAY : "linearOverlay",
    NONLINEAR_OVERLAY : "nonlinearOverlay",
    LINEAR_VIDEO : "linearVideo",
    COMPANION : "companion"
  };
  this.Ad = function(adObj){
    adObj.isLinear = (adObj.adType == "linearVideo") || (adObj.adType == "linearOverlay");
    return adObj
  };
  this.currentEmbedCode = "embed";
  this.movieDuration = 60;
  this.ui = {
    rootElement : $("<div>", {}),
    videoWrapper : $("<div>", {}),
    playerSkinVideoWrapper : $("<div>", {}),
    ooyalaVideoElement : $("<div>", {class: "video"}),
    adVideoElement : $("<div>", {class: "video"}),
    pluginsElement : $("<div>", {}),
    playerSkinPluginsElement : $("<div>", {}),
    adWrapper : $("<div>", {})
  };
  this.platform = {};
  this.pageSettings = {};
  this.loadAdModule = function() {};
  this.onAdManagerReady = function() {};
  this.removeAdManager = function() {};
  this.appendToTimeline = function(timeline) {
    this.timeline = this.timeline.concat(timeline);
  };
  this.raiseAdError = function() {};
  this.raiseAdPlayhead = function() {};
  this.adsClicked = function() {};
  this.notifyPodStarted = function() {};
  this.notifyPodEnded = function() {};
  this.notifyLinearAdStarted = function() {};
  this.notifyLinearAdEnded = function() {};
  this.notifyNonlinearAdStarted = function() {};
  this.notifyNonlinearAdEnded = function() {};

  this.adManagerWillControlAds = function() {};
  this.adManagerDoneControllingAds = function() {};
  this.removePlayerListener = function() {};
  this.unregisterAdManager = function() {};
  this.forceAdToPlay = function() {};
  this.showSkipVideoAdButton = function() {};
  this.showCompanion = function() {};
  this.adManagerSettings = {};
};
