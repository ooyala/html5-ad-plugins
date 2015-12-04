/*
 * Unit test class for the Google IMA Ad Manager
 * https://github.com/Automattic/expect.js
 */

//stubs
OO.log = function() {};

describe('ad_manager_ima', function() {
  var amc, ima;
  var imaVideoPluginFactory;
  var videoWrapper;
  var imaIframe;
  var name = "google-ima-ads-manager";
  var playerId = "ima-player-id";
  var originalOoAds = _.clone(OO.Ads);
  var originalOoVideo = _.clone(OO.Video);
  var notifyEventName = null;
  var notifyParams = null;
  require(TEST_ROOT + "unit-test-helpers/mock_amc.js");
  require(TEST_ROOT + "unit-test-helpers/mock_ima.js");

  //mock video controller interface
  var vci = {
    notify: function(eventName, params) {
      notifyEventName = eventName;
      notifyParams = params;
    },
    EVENTS: {
      PLAY: "play",  // TOOD: Consider renaming
      PLAYING: "playing",
      ENDED: "ended",
      ERROR: "error",
      SEEKING: "seeking",
      SEEKED: "seeked",
      PAUSED: "paused",
      RATE_CHANGE: "ratechange",
      STALLED: "stalled",
      TIME_UPDATE: "timeupdate",
      VOLUME_CHANGE: "volumechange",
      BUFFERING: "buffering",
      BUFFERED: "buffered",
      DURATION_CHANGE: "durationchange",
      PROGRESS: "progress",
      WAITING: "waiting",
      FULLSCREEN_CHANGED: "fullScreenChanged"
    }
  };

  // IMA constants
  var AD_RULES_POSITION_TYPE = 'r';
  var NON_AD_RULES_POSITION_TYPE = 't';

  // Helper functions

  var initialize = function(adRules) {
    ima.initialize(amc, playerId);
    ima.registerUi();
    var ad = {
      tag_url : "https://blah",
      position_type : adRules ? AD_RULES_POSITION_TYPE : NON_AD_RULES_POSITION_TYPE
    };
    var content = {
      all_ads : [ad]
    };
    ima.loadMetadata(content, {}, {});
    amc.timeline = ima.buildTimeline();
  };

  var play = function() {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
  };

  var createVideoWrapper = function() {
    videoWrapper = imaVideoPluginFactory.create(null, null, vci, null, playerId);
  };

  var initAndPlay = function() {
    initialize(true);
    createVideoWrapper();
    play();
  };

  before(_.bind(function() {
    imaIframe = $("<iframe src='http://imasdk.googleapis.com/'></iframe>");
    $('body').append(imaIframe);

    OO.Ads = {
      manager: function(adManager) {
        ima = adManager(_, $);
        ima.runningUnitTests = true;
      }
    };

    OO.Video = {
      plugin: function(plugin) {
        imaVideoPluginFactory = plugin;
      }
    };
    amc = new fake_amc();
    delete require.cache[require.resolve(SRC_ROOT + "google_ima.js")];
    require(SRC_ROOT + "google_ima.js");
  }, this));

  after(function() {
    OO.Ads = originalOoAds;
    OO.Video = originalOoVideo;
    imaIframe.remove();
  });

  beforeEach(function() {
  });

  afterEach(_.bind(function() {
    if (videoWrapper) {
      videoWrapper.destroy();
      videoWrapper = null;
    }
    ima.destroy();
    if(google.ima.adManagerInstance) {
      google.ima.adManagerInstance.destroy();
    }
    notifyEventName = null;
    notifyParams = null;
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', function(){
    expect(typeof amc).to.be("object");
  });

  it('Init: mock ima is ready', function(){
    expect(typeof google).to.be("object");
  });

  it('Init: ad manager is registered', function(){
    expect(typeof ima).to.be("object");
  });

  it('Init: ad manager has the expected name', function(){
    expect(ima.name).to.be(name);
  });

  it('Init: ad manager handles the initialize function', function(){
    expect(function() { ima.initialize(amc, playerId); }).to.not.throwException();
  });

  it('Init: video plugin is creatable after ad manager is initialized', function(){
    ima.initialize(amc, playerId);
    videoWrapper = imaVideoPluginFactory.create(null, null, null, null, playerId);
    expect(typeof videoWrapper).to.be("object");
  });

  it('Init: ad manager handles the registerUi function', function(){
    expect(function() { ima.registerUi(); }).to.not.throwException();
  });

  it('Init: ad manager handles the loadMetadata function', function(){
    var ad = {
      tag_url : "https://blah",
      position_type : AD_RULES_POSITION_TYPE
    };
    var content = {
      all_ads : [ad]
    };
    ima.initialize(amc, playerId);
    expect(function() { ima.loadMetadata(content, {}, {}); }).to.not.throwException();
  });

  it('Init: ad manager is ready', function(){
    ima.initialize(amc, playerId);
    expect(ima.ready).to.be(false);
    var ad = {
      tag_url : "https://blah",
      position_type : AD_RULES_POSITION_TYPE
    };
    var content = {
      all_ads : [ad]
    };
    ima.loadMetadata(content, {}, {});
    expect(ima.ready).to.be(true);
  });

  // Ad Rules
  it('Ad Rules: setup ads request is successful', function(){
    initialize(true);
    play();
    expect(ima.adsRequested).to.be(true);
  });

  it('Ad Rules: fake ad is added to timeline for ad rules ads', function(){
    initialize(true);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].ad.type).to.be("adRequest");
  });

  // Non-Ad Rules
  it('Non-Ad Rules: ad is added to timeline for non-ad rules ads', function(){
    initialize(false);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].ad.type).not.to.be("adRequest");
  });

  it('Non-Ad Rules: setup ads request is successful', function(){
    initialize(false);
    play();
    ima.playAd(amc.timeline[0]);
    expect(ima.adsRequested).to.be(true);
  });

  it('Timeline: adds all valid slots', function() {
  });

  it('Init: preroll was loaded', function(){
  });

  it('Init: no preroll was found or loaded', function(){
  });

  it('Init: no preroll but midroll was found or loaded after initial play', function(){
  });

  it('Init: preroll loaded before play and midroll after initial play', function(){
  });

  it('Init: postroll after initial play', function(){
  });

  it('Init: preroll loaded before play, then midroll and postroll after initial play', function(){
  });

  //TODO: VTC-IMA plugin tests
  it('Video plugin: Video wrapper is registered with IMA when created', function(){
    initialize(true);
    createVideoWrapper();
    expect(ima.videoControllerWrapper).to.be(videoWrapper);
  });

  // Wrapper functionality tests
  it('Video plugin: Video wrapper play stores a play request if IMA is not initialized', function(){
    initialize(true);
    createVideoWrapper();
    videoWrapper.play();
    expect(ima.vcPlayRequested).to.be(true);
  });

  it('Video plugin: Video wrapper pause removes a previous play request if IMA is not initialized', function(){
    initialize(true);
    createVideoWrapper();
    videoWrapper.play();
    expect(ima.vcPlayRequested).to.be(true);
    videoWrapper.pause();
    expect(ima.vcPlayRequested).to.be(false);
  });

  it('Video plugin: Video wrapper play starts playback if IMA is initialized', function(){
    initAndPlay();
    var am = google.ima.adManagerInstance;
    var started = false;
    am.start = function() {
      started = true;
    };
    videoWrapper.play();
    expect(ima.adPlaybackStarted).to.be(true);
    expect(started).to.be(true);
  });

  it('Video plugin: Video wrapper pause pauses playback, a play after will resume playback', function(){
    initAndPlay();
    var am = google.ima.adManagerInstance;
    var started = false;
    var playing = false;
    var startCount = 0;
    am.start = function() {
      started = true;
      playing = true;
      startCount++;
    };
    am.pause = function() {
      playing = false;
    };
    am.resume = function() {
      playing = true;
    };
    videoWrapper.play();
    expect(ima.adPlaybackStarted).to.be(true);
    expect(started).to.be(true);
    expect(playing).to.be(true);
    expect(startCount).to.be(1);
    videoWrapper.pause();
    expect(playing).to.be(false);
    videoWrapper.play();
    expect(playing).to.be(true);
    //we want to make sure that IMA's resume is called and not another start
    expect(startCount).to.be(1);
  });

  it('Video plugin: Video wrapper setVolume updates IMA with volume', function(){
    initAndPlay();
    var am = google.ima.adManagerInstance;
    var vol = 0;
    var TEST_VOLUME = 0.5;
    am.setVolume = function(volume) {
      vol = volume;
    };
    videoWrapper.play();
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
  });

  //TODO: This test requires an instance of the current IMA ad. We might be able to mock this
  /*it('Video plugin: Video wrapper getCurrentTime retrieves the current time', function(){
  });*/

  // Notify tests
  it('Video plugin: Video wrapper raisePlayEvent notifies controller of PLAYING event', function(){
    expect(notifyEventName).to.be(null);
    initAndPlay();
    videoWrapper.raisePlayEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.PLAYING);
  });

  it('Video plugin: Video wrapper raiseEndedEvent notifies controller of ENDED event', function(){
    expect(notifyEventName).to.be(null);
    initAndPlay();
    videoWrapper.raiseEndedEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.ENDED);
  });

  it('Video plugin: Video wrapper raisePauseEvent notifies controller of PAUSED event', function(){
    expect(notifyEventName).to.be(null);
    initAndPlay();
    videoWrapper.raisePauseEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.PAUSED);
  });

  it('Video plugin: Video wrapper raiseVolumeEvent notifies controller of VOLUME_CHANGE event', function(){
    expect(notifyEventName).to.be(null);
    expect(notifyParams).to.be(null);
    initAndPlay();
    var am = google.ima.adManagerInstance;
    var vol = 0;
    var TEST_VOLUME = 0.5;
    am.setVolume = function(volume) {
      vol = volume;
    };
    am.getVolume = function() {
      return vol;
    };
    videoWrapper.play();
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
    videoWrapper.raiseVolumeEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.VOLUME_CHANGE);
    expect(notifyParams).to.eql({ "volume" : TEST_VOLUME });
  });

  it('Video plugin: Video wrapper raiseTimeUpdate notifies controller of TIME_UPDATE event', function(){
    expect(notifyEventName).to.be(null);
    expect(notifyParams).to.be(null);
    initAndPlay();
    var CURRENT_TIME = 10;
    var DURATION = 20;
    videoWrapper.raiseTimeUpdate(CURRENT_TIME, DURATION);
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.TIME_UPDATE);
    expect(notifyParams).to.eql({ "currentTime" : CURRENT_TIME,
      "duration" : DURATION,
      "buffer" : 0,
      "seekRange" : { "begin" : 0, "end" : 0 } });
  });

  it('Video plugin: Video wrapper raiseDurationChange notifies controller of DURATION_CHANGE event', function(){
    expect(notifyEventName).to.be(null);
    expect(notifyParams).to.be(null);
    initAndPlay();
    var CURRENT_TIME = 10;
    var DURATION = 20;
    videoWrapper.raiseDurationChange(CURRENT_TIME, DURATION);
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.DURATION_CHANGE);
    expect(notifyParams).to.eql({ "currentTime" : CURRENT_TIME,
      "duration" : DURATION,
      "buffer" : 0,
      "seekRange" : { "begin" : 0, "end" : 0 } });
  });
});
