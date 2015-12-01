fake_amc = function() {
  this.timeline = [];
  this.callbacks = {};
  this.addPlayerListener = function(event, callback){
    this.callbacks[event] = callback;
  };
  this.EVENTS = {
    INITIAL_PLAY_REQUESTED : "initialPlayRequested"
  };
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
    ooyalaVideoElement : $("<div>", {class: "video"}),
    adVideoElement : $("<div>", {class: "video"}),
    pluginsElement : $("<div>", {}),
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
};
