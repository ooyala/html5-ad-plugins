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
  var originalMockAmc = null;
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
      tag_url: "https://blah",
      position_type: adRules ? AD_RULES_POSITION_TYPE : NON_AD_RULES_POSITION_TYPE
    };
    var content = {
      all_ads: [ad]
    };
    ima.loadMetadata(content, {}, {});
    amc.timeline = ima.buildTimeline();
  };

  var play = function() {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
  };

  var createVideoWrapper = function(vc) {
    videoWrapper = imaVideoPluginFactory.create(null, null, vc, null, playerId);
  };

  var initAndPlay = function(adRules, vc) {
    initialize(adRules);
    createVideoWrapper(vc);
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
    originalMockAmc = _.clone(amc);
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
    google.ima.linearAds = true;
    notifyEventName = null;
    notifyParams = null;
    amc = originalMockAmc;
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
  it('Init, Ad Rules: setup ads request is successful', function(){
    initialize(true);
    play();
    expect(ima.adsRequested).to.be(true);
  });

  it('Init, Ad Rules: setup ads request notifies amc that the IMA ad manager for ad rules will control ad playback', function(){
    var notified = false;
    amc.adManagerWillControlAds = function(adManagerName) {
      if (adManagerName === name) {
        notified = true;
      }
    };
    initialize(true);
    play();
    expect(notified).to.be(true);
  });

  it('Init, Ad Rules: fake ad is added to timeline for ad rules ads', function(){
    initialize(true);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].ad.type).to.be("adRequest");
  });

  it('Init, Ad Rules: fake ad started notification is received by amc', function(){
    var notified = false;
    amc.notifyPodStarted = function(adId) {
      //current placeholder id is undefined, update this when this changes
      if(typeof adId === "undefined") {
        notified = true;
      }
    };
    initialize(true);
    play();
    ima.playAd(amc.timeline[0]);
    expect(notified).to.be(true);
  });

  it('Init, Ad Rules: fake ad ends properly when IMA ads manager is initialized and there is no preroll', function(){
    var notified = false;
    amc.notifyPodEnded = function(adId) {
      //current placeholder id is undefined, update this when this changes
      if(typeof adId === "undefined") {
        notified = true;
      }
    };
    initialize(true);
    //This line mimics the ad pod having been set by the time the ad request success returns
    //This is a hack, will revisit in the future, but does properly test to see that the fake ad
    //ends when an ad request is successful
    ima.currentAMCAdPod = amc.timeline[0];
    play();
    expect(notified).to.be(true);
  });

  // Non-Ad Rules
  it('Init, Non-Ad Rules: ad is added to timeline for non-ad rules ads', function(){
    initialize(false);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].ad.type).not.to.be("adRequest");
  });

  it('Init, Non-Ad Rules: setup ads request is successful', function(){
    initialize(false);
    play();
    ima.playAd(amc.timeline[0]);
    expect(ima.adsRequested).to.be(true);
  });

  // AMC integration/IMA Event tests
  it('AMC Integration, IMA Event: IMA CLICK event notifies amc of an ad click', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.adsClicked = function() {
      notified = true;
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.CLICK);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA AD_ERROR gives back control and ends current ad and ad pod', function(){
    var doneControllingAdsNotified = false;
    var linearAdEndedNotified = false;
    var podEndedNotified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function() {
      linearAdEndedNotified = true;
    };

    amc.notifyPodEnded = function() {
      podEndedNotified = true;
    };

    amc.adManagerDoneControllingAds = function(adManagerName) {
      if (adManagerName === name) {
        doneControllingAdsNotified = true;
      }
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.AD_ERROR);
    expect(linearAdEndedNotified).to.be(true);
    expect(podEndedNotified).to.be(true);
    expect(doneControllingAdsNotified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA CONTENT_PAUSE_REQUESTED does not notify amc of a forced ad playback with streams set if a preroll', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.forceAdToPlay = function(adManager, ad, adType, streams) {
      if(adManager === name && streams["ima"]) {
        notified = true;
      }
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED);
    expect(notified).to.be(false);
  });

  it('AMC Integration, IMA Event: IMA CONTENT_PAUSE_REQUESTED notifies amc of a forced ad playback with streams set if not a preroll', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.forceAdToPlay = function(adManager, ad, adType, streams) {
      if(adManager === name && streams["ima"] === "") {
        notified = true;
      }
    };
    amc.publishPlayerEvent(amc.EVENTS.PLAYHEAD_TIME_CHANGED, 10, 20); //event, playhead time, duration
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA CONTENT_RESUME_REQUESTED notifies amc of a forced ad playback with streams set if not a preroll', function(){
    var linearAdEndedNotified = false;
    var podEndedNotified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function() {
      linearAdEndedNotified = true;
    };

    amc.notifyPodEnded = function() {
      podEndedNotified = true;
    };

    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED);
    expect(linearAdEndedNotified).to.be(true);
    expect(podEndedNotified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA STARTED event notifies amc of linear ad start for a linear ad', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdStarted = function() {
      notified = true;
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA COMPLETE event notifies amc of linear ad end for a linear ad', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function() {
      notified = true;
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA USER_CLOSE event notifies amc of linear ad end for a linear ad', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function() {
      notified = true;
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.USER_CLOSE);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA SKIPPED event notifies amc of linear ad end for a linear ad', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function() {
      notified = true;
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.SKIPPED);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA COMPLETE event notifies amc of ad pod end with pod size 1', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.notifyPodEnded = function() {
      notified = true;
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    //mock ima has a default ad pod size of 1 (returned via getTotalAds)
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA COMPLETE events notifies amc of ad pod end with pod size 2', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.notifyPodEnded = function() {
      notified = true;
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    var currentAd = am.getCurrentAd();
    var adPosition = 1;
    currentAd.getAdPodInfo = function() {
      return {
        getTotalAds: function () {
          return 2;
        },
        getAdPosition: function () {
          return adPosition;
        }
      };
    };
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    //mock the second ad
    adPosition = 2;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event, Ad Rules: IMA ALL_ADS_COMPLETED gives up control for ad rules ads', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.adManagerDoneControllingAds = function(adManagerName) {
      if (adManagerName === name) {
        notified = true;
      }
    };
    ima.playAd({
      ad : {}
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    am.publishEvent(google.ima.AdEvent.Type.ALL_ADS_COMPLETED);
    expect(notified).to.be(true);
  });

  it('AMC Integration: can cancel ad', function(){
    var notified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function() {
      notified = true;
    };
    var id = "blah";
    var myAd = {
      id : id
    };
    ima.playAd({
      ad : myAd,
      id : id
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    ima.cancelAd(myAd);
  });

  // TODO: Overlay tests once we implement notification to amc of nonLinearAdStarted/Ended

  // VTC-IMA plugin tests
  it('Video plugin: Video wrapper is registered with IMA when created', function(){
    initialize(true);
    createVideoWrapper(vci);
    expect(ima.videoControllerWrapper).to.be(videoWrapper);
  });

  // Wrapper functionality tests
  it('Video plugin: Video wrapper play stores a play request if IMA is not initialized', function(){
    initialize(true);
    createVideoWrapper(vci);
    videoWrapper.play();
    expect(ima.vcPlayRequested).to.be(true);
  });

  it('Video plugin: Video wrapper pause removes a previous play request if IMA is not initialized', function(){
    initialize(true);
    createVideoWrapper(vci);
    videoWrapper.play();
    expect(ima.vcPlayRequested).to.be(true);
    videoWrapper.pause();
    expect(ima.vcPlayRequested).to.be(false);
  });

  it('Video plugin: Video wrapper play starts playback if IMA is initialized', function(){
    initAndPlay(true, vci);
    var am = google.ima.adManagerInstance;
    var started = false;
    am.start = function() {
      started = true;
    };
    videoWrapper.play();
    expect(ima.adPlaybackStarted).to.be(true);
    expect(started).to.be(true);
  });

  it('Video plugin: Playback starts immediately after IMA initialization if playback was requested by video wrapper before IMA is initialized', function(){
    initialize(true);
    createVideoWrapper();
    videoWrapper.play();
    expect(ima.adPlaybackStarted).to.be(false);
    play();
    expect(ima.adPlaybackStarted).to.be(true);
  });

  it('Video plugin: Video wrapper pause pauses playback, a play after will resume playback', function(){
    initAndPlay(true, vci);
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
    initAndPlay(true, vci);
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

  it('Video plugin: Video wrapper getCurrentTime retrieves the current time', function(){
    initAndPlay(true, vci);
    var am = google.ima.adManagerInstance;
    am.getRemainingTime = function() {
      return 20;
    };
    var currentAd = am.getCurrentAd();
    currentAd.getDuration = function() {
      return 30;
    };
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(videoWrapper.getCurrentTime()).to.be(10);    //10 = 30 (duration) - 20 (remaining time)
  });

  // Notify tests
  it('Video plugin: Video wrapper raisePlayEvent notifies controller of PLAYING event', function(){
    expect(notifyEventName).to.be(null);
    initAndPlay(true, vci);
    videoWrapper.raisePlayEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.PLAYING);
  });

  it('Video plugin: Video wrapper raiseEndedEvent notifies controller of ENDED event', function(){
    expect(notifyEventName).to.be(null);
    initAndPlay(true, vci);
    videoWrapper.raiseEndedEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.ENDED);
  });

  it('Video plugin: Video wrapper raisePauseEvent notifies controller of PAUSED event', function(){
    expect(notifyEventName).to.be(null);
    initAndPlay(true, vci);
    videoWrapper.raisePauseEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.PAUSED);
  });

  it('Video plugin: Video wrapper raiseVolumeEvent notifies controller of VOLUME_CHANGE event', function(){
    expect(notifyEventName).to.be(null);
    expect(notifyParams).to.be(null);
    initAndPlay(true, vci);
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
    initAndPlay(true, vci);
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
    initAndPlay(true, vci);
    var CURRENT_TIME = 10;
    var DURATION = 20;
    videoWrapper.raiseDurationChange(CURRENT_TIME, DURATION);
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.DURATION_CHANGE);
    expect(notifyParams).to.eql({ "currentTime" : CURRENT_TIME,
      "duration" : DURATION,
      "buffer" : 0,
      "seekRange" : { "begin" : 0, "end" : 0 } });
  });

  // IMA-VTC: IMA event tests
  it('Video plugin, IMA Event: Video wrapper notifies of play event when we receive IMA STARTED event', function(){
    var playing = false;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.PLAYING) {
          playing = true;
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(playing).to.be(true);
  });

  it('Video plugin, IMA Event: Video wrapper notifies of play event when we receive IMA RESUMED event', function(){
    var playing = false;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.PLAYING) {
          playing = true;
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.RESUMED);
    expect(playing).to.be(true);
  });

  it('Video plugin, IMA Event: Video wrapper notifies of ended event when we receive IMA COMPLETE event', function(){
    var ended = false;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.ENDED) {
          ended = true;
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(ended).to.be(true);
  });

  it('Video plugin, IMA Event: Video wrapper notifies of ended event when we receive IMA SKIPPED event', function(){
    var ended = false;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.ENDED) {
          ended = true;
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.SKIPPED);
    expect(ended).to.be(true);
  });

  it('IMA Event: Video wrapper notifies of ended event when we receive IMA USER_CLOSE event', function(){
    var ended = false;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.ENDED) {
          ended = true;
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.USER_CLOSE);
    expect(ended).to.be(true);
  });

  it('IMA Event: Video wrapper notifies of paused event when we receive IMA PAUSED event', function(){
    var paused = false;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.PAUSED) {
          paused = true;
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.PAUSED);
    expect(paused).to.be(true);
  });

  it('IMA Event: Video wrapper notifies of volume change event when we receive IMA VOLUME_CHANGED event', function(){
    var volumeChanged = false;
    var currentVolume = 0;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.VOLUME_CHANGE) {
          volumeChanged = true;
          currentVolume = params["volume"];
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    am.getVolume = function() {
      return 0.5;
    };
    expect(currentVolume).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.VOLUME_CHANGED);
    expect(volumeChanged).to.be(true);
    expect(currentVolume).to.be(0.5);
  });

  it('IMA Event: Video wrapper notifies of volume change event when we receive IMA VOLUME_MUTED event', function(){
    var volumeChanged = false;
    var currentVolume = 0.5;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.VOLUME_CHANGE) {
          volumeChanged = true;
          currentVolume = params["volume"];
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    am.getVolume = function() {
      return 0;
    };
    expect(currentVolume).to.be(0.5);
    am.publishEvent(google.ima.AdEvent.Type.VOLUME_MUTED);
    expect(volumeChanged).to.be(true);
    expect(currentVolume).to.be(0);
  });

  it('IMA Event: Video wrapper notifies of duration change event when we receive IMA DURATION_CHANGE event', function(){
    var durationChanged = false;
    var currentDuration = 0;
    initAndPlay(true, {
      notify: function(eventName, params) {
        if (eventName === vci.EVENTS.DURATION_CHANGE) {
          durationChanged = true;
          currentDuration = params["duration"];
        }
      },
      EVENTS: vci.EVENTS
    });
    var am = google.ima.adManagerInstance;
    var currentAd = am.getCurrentAd();
    currentAd.getDuration = function() {
      return 30;
    };
    expect(currentDuration).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.DURATION_CHANGE);
    expect(durationChanged).to.be(true);
    expect(currentDuration).to.be(30);
  });
});
