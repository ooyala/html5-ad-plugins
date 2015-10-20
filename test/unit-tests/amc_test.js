/*
 * Unit test class for the Ad Manager Controller in the ad manager framework
 * https://github.com/Automattic/expect.js
 */

require(SRC_ROOT + "include/constants.js");
require(SRC_ROOT + "core/utils.js");
require(SRC_ROOT + "core/emitter.js");
require(SRC_ROOT + "core/message_bus.js");
require(SRC_ROOT + "core/state_machine.js");
require(TEST_ROOT + 'helpers/message_bus_helper.js');

// override OO.registerModule so we get a handle on factory method
//amcModuleFactory = null;
OO.registerModule = function(name, factory) {
  amcModuleFactory = factory;
};

//stubs
OO.exposeStaticApi = function() {};
OO.log = function() {};

// load the module
require(SRC_ROOT + "modules/ads/ad_manager_controller.js");

describe('ad_manager_controller', function() {
  var mb,amc;
  var testcount = 0;
  var templateAdManager = function() {
    this.name = "test-ads-manager" + testcount;
    this.amc = null;
    this.ready = true;
    this.initialize = function(amc) { this.amc = amc; };
    this.buildTimeline = function() { return []; };
    this.playAd = function() {};
    this.loadMetadata = function() { this.ready = true; };
    this.registerUi = function() {};
    this.cancelAd = function() {};
    this.destroy = function() {};
  };
  var testAdManager;

  before(function() {
    // stubs
    OO.playerParams = { maxAdsTimeout:5000 };
    OO.playerParams.platform = [];
  });

  after(function() {});

  beforeEach(function() {
    testcount++;
    OO.requiredInEnvironment = function(req) {return req != 'flash-playback'; };
    OO.supportAds = true;
    OO.isIos = false;
    mb = new OO.MessageBus();
    testAdManager = new templateAdManager();
    try { OO.Ads.manager(testAdManager); } catch (e) { }
    amc = amcModuleFactory(mb,'ads-manager-controller-test');
  });

  afterEach(function() {
    var managers = OO.Ads.getRegisteredAdManagers();
    _.each(managers, function(manager) {
      try { OO.Ads.unregisterAdManager(manager); } catch (e) { }
    });
    amc.onDestroy();
  });

  ///// Private functions /////

  var initPlayer = _.bind(function(pageLevelParams, movieMetadata) {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", pageLevelParams || {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.METADATA_FETCHED, {});
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, movieMetadata || {});
  }, this);

  var startPlay = _.bind(function() {
    mb.publish(OO.EVENTS.INITIAL_PLAY);
    mb.publish(OO.EVENTS.PLAY);
    mb.publish(OO.EVENTS.PLAY_STREAM);
  }, this);

  var playStarted = _.bind(function() {
    mb.publish(OO.EVENTS.WILL_PLAY);
    mb.publish(OO.EVENTS.WILL_PLAY_FROM_BEGINNING);
  }, this);

  var seek = _.bind(function(position) {
    mb.publish(OO.EVENTS.PAUSE);
    mb.publish(OO.EVENTS.SEEK, position);
    mb.publish(OO.EVENTS.SCRUBBED);
    mb.publish(OO.EVENTS.WILL_PLAY);
    mb.publish(OO.EVENTS.PAUSED);
  }, this);

  ///// Init tests /////

  it('should exist', function() {
    expect(amc).to.not.be(null);
  });

  it('events publicly defined', function() {
    expect(OO.EVENTS.AMC_ALL_ADS_DONE).to.be("adManagerControllerAllAdsDone");
    expect(OO.EVENTS.AMC_PREROLLS_DONE).to.be("adManagerControllerPrerollsDone");
    expect(OO.EVENTS.AMC_ALL_READY).to.be("adManagerControllerAllReady");
    expect(OO.EVENTS.AMC_WILL_SWITCH_VIDEO).to.be("adManagerControllerWillSwitchVideo");
    expect(OO.EVENTS.AMC_VIDEO_UNSWITCHED).to.be("adManagerControllerVideoUnswitched");
    expect(OO.EVENTS.WILL_PLAY_NONLINEAR_AD).to.be("willPlayNonlinearAd");
    expect(OO.EVENTS.NONLINEAR_AD_PLAYED).to.be("nonlinearAdPlayed");
  });

  it('init: ui class loaded', function() {
    expect(amc.ui).to.be(null);

    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.PLAYER_CREATED)).to.be.ok();
    expect(amc.ui).not.to.be(null);
    expect(amc.ui.elementId).to.be("elementId");
    expect(amc.ui.useSingleVideoElement).to.be(false);
    expect(amc.ui.rootElement).not.to.be(null);
  });

  it('init: platform class loaded', function() {
    // init
    var platform_params = ["platform", "os", "isIos", "iosMajorVersion", "isAndroid4Plus", "isFirefox",
      "isChrome", "chromeMajorVersion", "isIE", "isIE11Plus", "isMacOs", "isMacOsLionOrLater", "isKindleHD",
      "isSSL", "device"];

    // check before
    expect(amc.platform).to.be(null);

    // trigger
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.PLAYER_CREATED)).to.be.ok();

    // check after
    expect(amc.platform).not.to.be(null);
    expect(amc.platform.requiredInEnvironment).to.eql(OO.requiredInEnvironment);
    for (var i=0; i<platform_params.length; i++) {
      expect(amc.platform[platform_params[i]]).to.eql(OO[platform_params[i]]);
    }
  });

  it('init: interface class loaded', function() {
    expect(amc.interface).to.be(null);
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.PLAYER_CREATED)).to.be.ok();
    expect(amc.interface).not.to.be(null);

    var properties = ["EVENTS", "ADTYPE", "Ad", "ui", "platform",
            "adManagerSettings", "playerSettings", "backlotSettings", "pageSettings",
            "currentEmbedCode", "movieMetadata", "startTime", "movieDuration"];
    var functions = ["playAd", "addPlayerListener", "removePlayerListener", "raiseAdPlayhead", "loadAdModule",
      "onAdManagerReady", "removeAdManager", "adsClicked", "raiseAdError", "appendToTimeline",
      "showCompanion", "forceAdToPlay", "adManagerWillControlAds",
      "adManagerDoneControllingAds", "notifyPodStarted", "notifyPodEnded", "notifyLinearAdStarted",
      "notifyLinearAdEnded", "notifyNonlinearAdStarted", "notifyNonlinearAdEnded", "isLastAdPlayed",
      "sendURLToLoadAndPlayNonLinearAd", "showSkipVideoAdButton"];
    for (var i=0; i<properties.length; i++) {
      expect(amc.interface).to.have.property([properties[i]]);
    }
    for (var i=0; i<functions.length; i++) {
      expect(amc.interface[functions[i]]).to.be.a('function');
    }
  });

  it('init: destroy if ads not supported', function() {
    OO.supportAds = false;
    testAdManager.destroyed = false;
    testAdManager.destroy = function() {
      this.destroyed = true;
    };

    expect(testAdManager.destroyed).to.be(false);
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.AMC_ALL_READY)).to.be.ok();
    expect(testAdManager.destroyed).to.be(true);
    expect(OO.Ads.getRegisteredAdManagers()).to.eql([]);
  });

  it('init: destroy if ads not required in environment', function() {
    OO.requiredInEnvironment = function (req) {
      if (req == 'flash-playback') return false;
      return req != 'ads';
    };
    testAdManager.destroyed = false;
    testAdManager.destroy = function() {
      this.destroyed = true;
    };

    expect(testAdManager.destroyed).to.be(false);
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.AMC_ALL_READY)).to.be.ok();
    expect(testAdManager.destroyed).to.be(true);
    expect(OO.Ads.getRegisteredAdManagers()).to.eql([]);
  });

  it('init: correct video element used', function() {
    OO.isIos = false;
    OO.isAndroid = false;
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    expect(mb.published(OO.EVENTS.PLAYER_EMBEDDED)).to.be.ok();
    expect(amc.ui.useSingleVideoElement).to.be(false);

    OO.isIos = true;
    OO.isAndroid = false;
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    expect(amc.ui.useSingleVideoElement).to.be(true);

    OO.isIos = false;
    OO.isAndroid = true;
    OO.isAndroid4Plus = false;
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    expect(amc.ui.useSingleVideoElement).to.be(true);

    OO.isIos = false;
    OO.isAndroid = true;
    OO.isAndroid4Plus = true;
    OO.chromeMajorVersion = 39;
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    expect(amc.ui.useSingleVideoElement).to.be(true);

    OO.isIos = false;
    OO.isAndroid = true;
    OO.isAndroid4Plus = true;
    OO.chromeMajorVersion = 40;
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    expect(amc.ui.useSingleVideoElement).to.be(false);
  });

  it('init: ui setup on player embedded', function() {
    OO.isIos = false;
    OO.isAndroid = false;
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    expect(mb.published(OO.EVENTS.PLAYER_EMBEDDED)).to.be.ok();
    expect(amc.ui.videoWrapper).not.to.be(null);
    expect(amc.ui.ooyalaVideoElement).not.to.be(null);
    expect(amc.ui.adVideoElement ? amc.ui.adVideoElement.size() : 0).to.be.above(0);
    expect(amc.ui.pluginsElement).to.be.a('object');
  });

  it('init: ui setup on player embedded with single video element', function() {
    OO.isIos = true;
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    expect(mb.published(OO.EVENTS.PLAYER_EMBEDDED)).to.be.ok();
    expect(amc.ui.videoWrapper).not.to.be(null);
    expect(amc.ui.ooyalaVideoElement).not.to.be(null);
    expect(amc.ui.ooyalaVideoElement).to.eql(amc.ui.adVideoElement);
  });

  ///// State tests /////

  it('state: content tree fetched', function() {
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED);
    expect(amc.currentState).to.be.eql("Init");
  });

  it('state: metadata fetched', function() {
    mb.publish(OO.EVENTS.METADATA_FETCHED);
    expect(amc.currentState).to.be.eql("Init");
  });

  it('state: amc all ready', function() {
    mb.publish(OO.EVENTS.AMC_ALL_READY);
    expect(amc.currentState).to.be.eql("Ready");
  });

  it('state: initial play', function() {
    mb.publish(OO.EVENTS.AMC_ALL_READY);
    mb.publish(OO.EVENTS.INITIAL_PLAY);
    expect(amc.currentState).to.be.eql("Playback");
  });

  it('state: scrubbing', function() {
    mb.publish(OO.EVENTS.SCRUBBING);
    expect(amc.currentState).to.be.eql("Playback");
  });

  it('state: set embed code', function() {
    mb.publish(OO.EVENTS.SET_EMBED_CODE);
    expect(amc.currentState).to.be.eql("Reload");
  });

  it('state: embed code changed', function() {
    mb.publish(OO.EVENTS.EMBED_CODE_CHANGED);
    expect(amc.currentState).to.be.eql("Ready");
    // TODO: Check that the ad manager is no longer ready - this depends on changes in PBI-260
  });

  it('state: stream play failed', function() {
    mb.publish(OO.EVENTS.STREAM_PLAY_FAILED);
    expect(amc.currentState).to.be.eql("Destroy");
  });

  it('state: played', function() {
    mb.publish(OO.EVENTS.PLAYED);
    expect(amc.currentState).to.be.eql("Ready");
  });

  it('state: will play ads - no ads', function() {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.WILL_PLAY_ADS);
    expect(amc.currentState).to.be.eql("Playback");
  });

  it('state: will play ads - preroll', function() {
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:3,
      adManager:this.name, ad:null, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    initPlayer();
    startPlay();
    expect(amc.currentState).to.be.eql("LinearAd");
  });

  it('state: will play single ad', function() {
    initPlayer();
    mb.publish(OO.EVENTS.AD_POD_STARTED);
    expect(amc.currentState).to.be.eql("LinearAd");
  });

  it('state: will play single element ad', function() {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.AMC_WILL_SWITCH_VIDEO);
    expect(amc.currentState).to.be.eql("SingleElementAd");
  });

  it('state: will play overlay from ad', function() {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.AMC_WILL_SWITCH_VIDEO);
    expect(amc.currentState).to.be.eql("SingleElementAd");
    mb.publish(OO.EVENTS.WILL_PLAY_NONLINEAR_AD);
    expect(amc.currentState).to.be.eql("SingleElementOverlay");
  });

  it('state: will play overlay from content', function() {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.PLAYER_CREATED)).to.be.ok();
    mb.publish(OO.EVENTS.WILL_PLAY_NONLINEAR_AD);
    expect(amc.currentState).to.be.eql("Overlay");
  });

  it('state: overlay played', function() {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.PLAYER_CREATED)).to.be.ok();
    mb.publish(OO.EVENTS.WILL_PLAY_NONLINEAR_AD);
    expect(amc.currentState).to.be.eql("Overlay");
    mb.publish(OO.EVENTS.NONLINEAR_AD_PLAYED);
    expect(amc.currentState).to.be.eql("Playback");
  });

  it('state: single element overlay played', function() {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.AMC_WILL_SWITCH_VIDEO);
    expect(amc.currentState).to.be.eql("SingleElementAd");
    mb.publish(OO.EVENTS.WILL_PLAY_NONLINEAR_AD);
    expect(amc.currentState).to.be.eql("SingleElementOverlay");
    mb.publish(OO.EVENTS.AMC_VIDEO_UNSWITCHED);
    expect(amc.currentState).to.be.eql("Overlay");
  });

  it('state: single element ad played', function() {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.AMC_WILL_SWITCH_VIDEO);
    expect(amc.currentState).to.be.eql("SingleElementAd");
    mb.publish(OO.EVENTS.AMC_VIDEO_UNSWITCHED);
    expect(amc.currentState).to.be.eql("Playback");
  });

  it('state: ads played', function() {
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.METADATA_FETCHED, {});
    mb.publish(OO.EVENTS.AD_POD_STARTED);
    expect(amc.currentState).to.be.eql("LinearAd");
    mb.publish(OO.EVENTS.NONLINEAR_AD_PLAYED);
    expect(amc.currentState).to.be.eql("Playback");
  });

  it('state: played', function() {
    mb.publish(OO.EVENTS.PLAYED);
    expect(amc.currentState).to.be.eql("Ready");
  });


  ///// Metadata tests /////

  it('metadata: data from player created', function() {
    expect(amc.pageSettings).to.be(null);
    expect(amc.startTime).to.be(-1);

    var params1 = {param1:true};
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", params1);
    expect(mb.published(OO.EVENTS.PLAYER_CREATED)).to.be.ok();
    expect(amc.pageSettings).to.eql(params1);
    expect(amc.startTime).to.be(-1);

    var params2 = {initialTime:10};
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", params2);
    expect(amc.pageSettings).to.eql(params2);
    expect(amc.startTime).to.be(10);
  });

  it('metadata: data from backlot', function() {
    var metadata = { backlotsetting1: "value" };
    mb.publish(OO.EVENTS.METADATA_FETCHED, metadata);
    expect(amc.backlotSettings).to.eql(metadata);
  });

  it('metadata: data from content tree', function() {
    var duration = 10000;
    var metadata = { duration: duration };
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, metadata);
    expect(amc.movieDuration).to.eql(duration/1000);
    expect(amc.movieMetadata).to.eql(metadata);
  });

  it('metadata: loadmetadata - empty backlot', function() {
    testAdManager.metadata = null;
    testAdManager.baseMetadata = null;
    testAdManager.called = false;
    testAdManager.loadMetadata = function(metadata, baseMetadata) {
      this.called = true;
      this.metadata = metadata;
      this.baseMetadata = baseMetadata;
    };

    var pageMetadata = {};
    pageMetadata[testAdManager.name] = {"setting1":"page",
                                        "setting2":2};
    var backlotMetadata = {};
    var movieMetadata = {};
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", pageMetadata);
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.METADATA_FETCHED, backlotMetadata);
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, movieMetadata);
    expect(testAdManager.called).to.eql(true);
    expect(testAdManager.baseMetadata).to.eql({});
    expect(testAdManager.metadata).to.eql({"setting1":"page", "setting2":2});
  });

  it('metadata: loadmetadata - empty page', function() {
    testAdManager.metadata = null;
    testAdManager.baseMetadata = null;
    testAdManager.loadMetadata = function(metadata, baseMetadata) {
      this.metadata = metadata;
      this.baseMetadata = baseMetadata;
    };

    var pageMetadata = {};
    var backlotMetadata = {"base":{"base":true}, "modules":{"another-ad-manager":{"metadata":{"a":true}}}};
    backlotMetadata.modules[testAdManager.name] = {"metadata":{
                                                     "setting1":"backlot",
                                                     "setting3":3
                                                  }};
    var movieMetadata = {};
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", pageMetadata);
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.METADATA_FETCHED, backlotMetadata);
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, movieMetadata);
    expect(testAdManager.baseMetadata).to.eql({"base":true});
    expect(testAdManager.metadata).to.eql({"setting1":"backlot", "setting3":3});
  });

  it('metadata: loadmetadata - page settings override backlot, and base data is sent', function() {
    testAdManager.metadata = null;
    testAdManager.baseMetadata = null;
    testAdManager.loadMetadata = function(metadata, baseMetadata) {
      this.metadata = metadata;
      this.baseMetadata = baseMetadata;
    };

    var pageMetadata = {};
    pageMetadata[testAdManager.name] = {"setting1":"page",
                                        "setting2":2};
    var backlotMetadata = {"base":{"base":true}, "modules":{"another-ad-manager":{"metadata":{"a":true}}}};
    backlotMetadata.modules[testAdManager.name] = {"metadata":{
                                                     "setting1":"backlot",
                                                     "setting3":3
                                                  }};
    var movieMetadata = {duration:5};
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", pageMetadata);
    mb.publish(OO.EVENTS.PLAYER_EMBEDDED);
    mb.publish(OO.EVENTS.METADATA_FETCHED, backlotMetadata);
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, movieMetadata);
    expect(testAdManager.baseMetadata).to.eql({"base":true});
    expect(testAdManager.metadata).to.eql({"setting1":"page", "setting2":2, "setting3":3});
  });

  it('metadata: showInAdControlBar - default', function() {
    testAdManager.buildTimeline = function() { return [ new this.amc.Ad({position:0, duration:1,
      adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    initPlayer();
    startPlay();
    expect(mb.published(OO.EVENTS.DISABLE_PLAYBACK_CONTROLS)).to.be.ok();
  });

  it('metadata: showInAdControlBar - true', function() {
    testAdManager.buildTimeline = function() { return [ new this.amc.Ad({position:0, duration:1,
      adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    initPlayer({showInAdControlBar:true});
    startPlay();
    expect(mb.published(OO.EVENTS.DISABLE_PLAYBACK_CONTROLS)).to.eql([]);
  });

  ///// Manager registration tests /////

  it('register managers: can only register once', function() {
    OO.Ads.manager(testAdManager);
    expect(Object.keys(OO.Ads.getRegisteredAdManagers()).length).to.be(1);
  });

  it('register managers: declare all ready', function() {
    initPlayer();
    expect(mb.published(OO.EVENTS.AMC_ALL_READY)).to.be.ok();
  });

  it('register managers: wait for managers to be ready', function() {
    // NOTE: Will this later declare all ready on timeout, messing up later tests?
    testAdManager.ready = false;
    testAdManager.loadMetadata = function(){};
    initPlayer();
    expect(mb.published(OO.EVENTS.AMC_ALL_READY)).to.eql([]);
  });

  it('register managers: adManager removed if it doesn\'t meet requirements', function() {
    var secondAdManager = new templateAdManager();
    secondAdManager.name = null;
    try { OO.Ads.manager(secondAdManager); } catch (e) { }
    expect(Object.keys(OO.Ads.getRegisteredAdManagers()).length).to.be(1);
  });

  it('register managers: two adManagers can be registered', function() {
    var secondAdManager = new templateAdManager();
    secondAdManager.name = "second-ad-manager";
    OO.Ads.manager(secondAdManager);
    expect(Object.keys(OO.Ads.getRegisteredAdManagers()).length).to.be(2);
  });

  /*
  it('register managers: declare all ready on timeout', function() {
    testAdManager.ready = false;
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    mb.publish(OO.EVENTS.METADATA_FETCHED, {});
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, {});
    // TODO: Require a way to keep this test waiting for the result without blocking the thread
    _.delay(_.bind(function() { expect(mb.published(OO.EVENTS.AMC_ALL_READY)).to.be.ok(); }, this),
      amc.MAX_AD_MODULE_LOAD_TIMEOUT)
    testAdManager.ready = true;
  });
  */

  ///// Manager methods tests /////

  /*
  // this test has timing issues because the load is asynchronous
  it('manager methods: load an external ad module', function() {
    testAdManager.remoteFileSuccess1 = null;
    testAdManager.loadModule = _.bind(function() {
        this.amc.loadAdModule(this.name, ad:"http://www.google.com",
          _.bind(function(success){
            this.remoteFileSuccess1 = success; }, this));
      }, testAdManager);
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.PLAYER_CREATED)).to.be.ok();
    testAdManager.loadModule();
    // defer the result because the load is defered
    _.defer(function() { expect(testAdManager.remoteFileSuccess1).to.be(true); }, this);
  });
  */

  /*
  // this test must be last because the load is defered until the end therefor the check must be defered
  it('manager methods: load an external ad module - fail', function() {
    testAdManager.remoteFileSuccess = null;
    testAdManager.loadModule = _.bind(function() {
        this.amc.loadAdModule(this.name, ad:"",
          _.bind(function(success){ this.remoteFileSuccess = success; }, this));
      }, testAdManager);
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    expect(mb.published(OO.EVENTS.PLAYER_CREATED)).to.be.ok();
    testAdManager.loadModule();
    // defer the result because the load is defered
    _.defer(function() { expect(testAdManager.remoteFileSuccess).to.be(false); }, this);
  });
  */


  ///// Timeline tests /////

  it('timeline: sort ads - linear and overlay varried times', function() {
    testAdManager.buildTimeline = function() {
      return [
        new this.amc.Ad({position:1000000000, duration:0, adManager:this.name, ad:{id:"postroll"},
                          adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:10, duration:0, adManager:this.name, ad:{id:"overlayt10"},
                          adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:10, duration:0, adManager:this.name, ad:{id:"midroll2"},
                          adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:5, duration:0, adManager:this.name, ad:{id:"midroll1"},
                          adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:0, duration:0, adManager:this.name, ad:{id:"overlayt0"},
                          adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:0, duration:0, adManager:this.name, ad:{id:"preroll"},
                          adType:amc.ADTYPE.LINEAR_VIDEO})
      ]; };
    initPlayer();
    var timeline = amc.getTimeline();
    expect(timeline).to.be.an('array');
    expect(timeline).to.have.length(6);
    expect(timeline[0].ad.id).to.be.eql("preroll");
    expect(timeline[1].ad.id).to.be.eql("overlayt0");
    expect(timeline[2].ad.id).to.be.eql("midroll1");
    expect(timeline[3].ad.id).to.be.eql("midroll2");
    expect(timeline[4].ad.id).to.be.eql("overlayt10");
    expect(timeline[5].ad.id).to.be.eql("postroll");
  });

  it('timeline: sort ads - same position', function() {
    testAdManager.buildTimeline = function() { return [
        new this.amc.Ad({position:0, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:0, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:0, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:0, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:0, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:0, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})
      ]; };
    initPlayer();
    var timeline = amc.getTimeline();
    expect(timeline).to.be.an('array');
    expect(timeline).to.have.length(6);
    expect(timeline[0].isLinear).to.be(true);
    expect(timeline[1].isLinear).to.be(true);
    expect(timeline[2].isLinear).to.be(true);
    expect(timeline[3].isLinear).to.be(false);
    expect(timeline[4].isLinear).to.be(false);
    expect(timeline[5].isLinear).to.be(false);
  });

  it('timeline: ad queue - no ads', function() {
    testAdManager.buildTimeline = function() { return [
        new this.amc.Ad({position:2, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:10000000, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:1, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:4, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:2, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:1, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY})
      ]; };
    initPlayer();
    startPlay();

    var adqueue = amc.getAdQueue();
    expect(adqueue).to.be.an('array');
    expect(adqueue).to.have.length(0);
  });

  it('timeline: ad queue - prerolls', function() {
    testAdManager.buildTimeline = function() { return [
        new this.amc.Ad({position:0, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:10000000, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:0, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:4, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY}),
        new this.amc.Ad({position:0, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:1, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY})
      ]; };
    initPlayer();
    startPlay();

    // the queue will be length 2 because the first linear ad was already started
    var adqueue = amc.getAdQueue();
    expect(adqueue).to.be.an('array');
    expect(adqueue).to.have.length(2);
    expect(adqueue[0].isLinear).to.be(true);
    expect(adqueue[1].isLinear).to.be(false);
  });

  it('timeline: ad queue - initialTime is after midrolls', function() {
    testAdManager.buildTimeline = function() { return [
        new this.amc.Ad({position:0, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:10000000, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:5, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:4, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})
      ]; };
    initPlayer({initialTime:10});
    startPlay();

    // only one linear ad should be triggered
    var adqueue = amc.getAdQueue();
    var timeline = amc.getTimeline();
    expect(amc.currentState).to.be.eql("LinearAd");
    expect(adqueue).to.be.an('array');
    expect(adqueue).to.have.length(0);
    expect(timeline).to.be.an('array');
    expect(timeline).to.have.length(4);
    expect(timeline[0].played).to.be(false);
    expect(timeline[1].played).to.be(false);
    expect(timeline[2].played).to.be(true);
  });

  it('timeline: ad queue - seek past midrolls', function() {
    testAdManager.buildTimeline = function() { return [
        new this.amc.Ad({position:1, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:10000000, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:5, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:4, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})
      ]; };

    var duration = 30;
    var metadata = { duration: duration * 1000 };

    initPlayer({}, metadata);
    startPlay();
    playStarted();
    mb.publish(OO.EVENTS.PLAYHEAD_TIME_CHANGED, 0, duration, 0);
    seek(10.5);

    // only one linear ad should be triggered
    var adqueue = amc.getAdQueue();
    var timeline = amc.getTimeline();
    expect(amc.currentState).to.be.eql("LinearAd");
    expect(adqueue).to.be.an('array');
    expect(adqueue).to.have.length(0);
    expect(timeline).to.be.an('array');
    expect(timeline).to.have.length(4);
    expect(timeline[0].played).to.be(false);
    expect(timeline[1].played).to.be(false);
    expect(timeline[2].played).to.be(true);
    expect(timeline[3].played).to.be(false);
  });

  it('timeline: ad queue - seek on end threshold should skip past midrolls', function() {
    testAdManager.buildTimeline = function() { return [
        new this.amc.Ad({position:1, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:10000000, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:5, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
        new this.amc.Ad({position:4, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})
      ]; };

    var duration = 30;
    var metadata = { duration: duration * 1000 };

    initPlayer({}, metadata);
    startPlay();
    playStarted();
    mb.publish(OO.EVENTS.PLAYHEAD_TIME_CHANGED, 0, duration, 0);
    seek(27);

    // no ad should be triggered because we are on the end threshold
    var adqueue = amc.getAdQueue();
    var timeline = amc.getTimeline();
    expect(amc.currentState).to.be.eql("Playback");
    expect(adqueue).to.be.an('array');
    expect(adqueue).to.have.length(0);
    expect(timeline).to.be.an('array');
    expect(timeline).to.have.length(4);
    expect(timeline[0].played).to.be(false);
    expect(timeline[1].played).to.be(false);
    expect(timeline[2].played).to.be(false);
    expect(timeline[3].played).to.be(false);
  });

  ///// Ad Mode /////

  it('ad mode: ad manager playAd should get called on preroll', function(){
    testAdManager.adPlayed = false;
    testAdManager.playAd = function() {
      this.adPlayed = true;
    };
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:1,
      adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    initPlayer();
    startPlay();
    expect(testAdManager.adPlayed).to.be(true);
  });

  it('ad mode: proper events raised before preroll', function(){
    this.playStreamBlocked = true;
    mb.subscribe(OO.EVENTS.PLAY_STREAM, "test", _.bind(function(){ this.playStreamBlocked = false; }, this));
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:1,
      adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    testAdManager.playAd = function(){};
    initPlayer();
    startPlay();
    expect(mb.published(OO.EVENTS.WILL_PLAY_ADS)).to.be.ok();
    expect(mb.published(OO.EVENTS.AD_POD_STARTED)).to.be.ok();
    expect(mb.published(OO.EVENTS.INITIAL_PLAY)).to.be.ok();
    expect(mb.published(OO.EVENTS.PLAY_STREAM)).to.be.ok();
    expect(mb.blockedEvent[OO.EVENTS.PLAY_STREAM]).to.eql(1);
    expect(this.playStreamBlocked).to.be(true);
    expect(mb.published(OO.EVENTS.AMC_PREROLLS_DONE)).to.eql([]);
  });

  it('ad mode: proper events raised after preroll', function(){
    this.playStreamBlocked = true;
    mb.subscribe(OO.EVENTS.PLAY_STREAM, "test", _.bind(function(){ this.playStreamBlocked = false; }, this));
    testAdManager.playAd = function(ad) {
      this.amc.notifyPodStarted(ad.id, 1);
      this.amc.notifyLinearAdStarted(ad.id, {});
      this.amc.notifyLinearAdEnded(ad.id);
      this.amc.notifyPodEnded(ad.id);
    };
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:1,
      adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    initPlayer();
    startPlay();
    expect(mb.published(OO.EVENTS.AD_POD_ENDED)).to.be.ok();
    expect(mb.published(OO.EVENTS.ADS_PLAYED)).to.be.ok();
    expect(mb.published(OO.EVENTS.AMC_PREROLLS_DONE)).to.be.ok();
    expect(mb.published(OO.EVENTS.PLAY_STREAM)).to.be.ok();
    expect(mb.blockedEvent[OO.EVENTS.PLAY_STREAM]).to.not.be.ok();
    expect(this.playStreamBlocked).to.be(false);
    expect(mb.published(OO.EVENTS.ENABLE_PLAYBACK_CONTROLS)).to.be.ok();
  });

  it('ad mode: proper events raised during nonlinear preroll', function(){
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:1,
      adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY})]; };
    testAdManager.playAd = function(){};
    initPlayer();
    startPlay();
    expect(mb.published(OO.EVENTS.INITIAL_PLAY)).to.be.ok();
    expect(mb.published(OO.EVENTS.WILL_PLAY)).to.be.ok();
    expect(mb.blockedEvent[OO.EVENTS.WILL_PLAY]).to.not.be.ok();
    expect(mb.published(OO.EVENTS.AMC_PREROLLS_DONE)).to.be.ok();
    expect(mb.published(OO.EVENTS.WILL_PLAY_ADS)).to.be.ok();
    expect(mb.published(OO.EVENTS.WILL_PLAY_NONLINEAR_AD)).to.be.ok();
  });

  it('ad mode: proper events raised after nonlinear', function(){
    testAdManager.playAd = function(ad) {
      this.amc.notifyPodStarted(ad.id, 1);
      this.amc.notifyLinearAdStarted(ad.id, {});
      this.amc.notifyLinearAdEnded(ad.id);
      this.amc.notifyPodEnded(ad.id);
    };
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:1,
      adManager:this.name, ad:{}, adType:amc.ADTYPE.NONLINEAR_OVERLAY})]; };
    initPlayer();
    startPlay();
    expect(mb.published(OO.EVENTS.NONLINEAR_AD_PLAYED)).to.be.ok();
    expect(mb.published(OO.EVENTS.ADS_PLAYED)).to.be.ok();
  });

  it('ad mode: raiseAdPlayhead raises playhead', function() {
    var playhead = 10;
    var duration = 60;
    this.eventPlayhead = -1;
    this.eventDuration = -1;
    mb.subscribe(OO.EVENTS.PLAYHEAD_TIME_CHANGED, "test", _.bind(function(event, playheadIn, durationIn){
      this.eventPlayhead = playheadIn;
      this.eventDuration = durationIn;
    }, this));
    amc.raiseAdPlayhead(playhead, duration);
    expect(this.eventPlayhead).to.eql(playhead);
    expect(this.eventDuration).to.eql(duration);
  });

  /*
  // Can't be tested because data can't be set on element in unit tests
  it('timeline: ad queue - seek to postroll', function() {
    testAdManager.buildTimeline = function() { return [
      new this.amc.Ad({position:1, duration:0, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
      new this.amc.Ad({position:10000000, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
      new this.amc.Ad({position:5, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO}),
      new this.amc.Ad({position:4, duration:1, adManager:this.name, ad:{}, adType:amc.ADTYPE.LINEAR_VIDEO})
    ]; },
    initPlayer({initialTime: 6});
    mb.publish(OO.EVENTS.SEEKED);
    amc.movieDuration = 30;
    mb.publish(OO.EVENTS.ADS_PLAYED);
    seek(30.5);

    // only one linear ad should be triggered
    var adqueue = amc.getAdQueue();
    var timeline = amc.getTimeline();
    expect(amc.currentState).to.be.eql("LinearAd");
    expect(adqueue).to.be.an('array');
    expect(adqueue).to.have.length(0);
    expect(timeline).to.be.an('array');
    expect(timeline).to.have.length(4);
    expect(timeline[0].played).to.be(false);
    expect(timeline[1].played).to.be(false);
    expect(timeline[2].played).to.be(true); //midroll
    expect(timeline[3].played).to.be(true); //postroll
  });
  */

  ///// Ad manager listeners /////

  it('listeners: INTIAL_PLAY_REQUESTED raised before prerolls', function(){
    this.raised = false;
    amc.addPlayerListener(amc.EVENTS.INITIAL_PLAY_REQUESTED, _.bind(function() {
      this.raised = true;
    }, this));
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:3,
      adManager:this.name, ad:null, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    testAdManager.playAd = function() {};
    initPlayer();
    startPlay();
    expect(this.raised).to.be(true);
  });

  it('listeners: PLAY_STARTED not raised before prerolls', function(){
    this.raised = false;
    amc.addPlayerListener(amc.EVENTS.PLAY_STARTED, _.bind(function() {
      this.raised = true;
    }, this));
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:3,
      adManager:this.name, ad:null, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    testAdManager.playAd = function() {};
    initPlayer();
    startPlay();
    expect(this.raised).to.not.be.ok();
  });

  it('listeners: playStarted raised after prerolls', function(){
    amc.addPlayerListener(amc.EVENTS.PLAY_STARTED, _.bind(function() {
      this.raised = true;
    }, this));
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:3,
      adManager:this.name, ad:null, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    testAdManager.playAd = function(ad) {
      this.amc.notifyPodStarted(ad.id, 1);
      this.amc.notifyLinearAdStarted(ad.id, {});
      this.amc.notifyLinearAdEnded(ad.id);
      this.amc.notifyPodEnded(ad.id);
    };
    initPlayer();
    startPlay();
    playStarted();
    expect(this.raised).to.be(true);
  });

  it('listeners: playheadTimeChanged only raised after playback starts', function(){
    var playhead = 10;
    var duration = 60;
    this.eventPlayhead = -1;
    this.eventDuration = -1;
    amc.addPlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, _.bind(function(eventname, playheadIn, durationIn) {
      this.eventPlayhead = playheadIn;
      this.eventDuration = durationIn;
    }, this));

    // before playback
    mb.publish(OO.EVENTS.PLAYHEAD_TIME_CHANGED, playhead, duration, 0);
    expect(this.eventPlayhead).to.eql(-1);
    expect(this.eventDuration).to.eql(-1);

    // after playback
    initPlayer();
    startPlay();
    playStarted();
    mb.publish(OO.EVENTS.PLAYHEAD_TIME_CHANGED, playhead, duration, 0);
    expect(this.eventPlayhead).to.eql(playhead);
    expect(this.eventDuration).to.eql(duration);
  });

  it('listeners: playheadTimeChanged not raised to ad manager during preroll', function(){
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:3,
      adManager:this.name, ad:null, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    var playhead = 10;
    var duration = 60;
    this.eventPlayhead = -1;
    this.eventDuration = -1;
    testAdManager.adStarted = null;
    testAdManager.adEnded = null;
    amc.addPlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, _.bind(function(eventname, playheadIn, durationIn) {
      this.eventPlayhead = playheadIn;
      this.eventDuration = durationIn;
    }, this));
    testAdManager.playAd = function(ad) {
      this.adStarted = (function(ad) { return function() {
          amc.notifyPodStarted(ad.id, 1);
        }; })(ad);
      this.adEnded =  (function(ad) { return function() {
          amc.notifyPodEnded(ad.id);
        }; })(ad);
    };

    // before preroll
    initPlayer();
    startPlay();
    if (_.isFunction(testAdManager.adStarted)) testAdManager.adStarted();
    mb.publish(OO.EVENTS.PLAYHEAD_TIME_CHANGED, playhead, duration, 0);
    expect(this.eventPlayhead).to.eql(-1);
    expect(this.eventDuration).to.eql(-1);

    // after preroll
    if (_.isFunction(testAdManager.adEnded)) testAdManager.adEnded();
    playStarted();
    mb.publish(OO.EVENTS.PLAYHEAD_TIME_CHANGED, playhead, duration, 0);
    expect(this.eventPlayhead).to.eql(playhead);
    expect(this.eventDuration).to.eql(duration);
  });

  it('listeners: pause raised after content started', function(){
    this.paused = false;
    amc.addPlayerListener(amc.EVENTS.PAUSE, _.bind(function(paused) {
      this.paused = true;
    }, this));

    // before playback
    mb.publish(OO.EVENTS.PAUSE);
    expect(this.paused).to.be(false);

    // after playback
    initPlayer();
    startPlay();
    playStarted();
    mb.publish(OO.EVENTS.PAUSE);
    expect(this.paused).to.be(true);
  });

  it('listeners: pause not raised to ad manager during preroll', function(){
    testAdManager.buildTimeline = function() { return [new this.amc.Ad({position:0, duration:3,
      adManager:this.name, ad:null, adType:amc.ADTYPE.LINEAR_VIDEO})]; };
    this.contentPaused = false;
    this.pausedFor = '';
    testAdManager.adPaused = false;
    testAdManager.adStarted = null;
    testAdManager.adEnded = null;
    amc.addPlayerListener(amc.EVENTS.PAUSE, _.bind(function(paused) {
      this.contentPaused = true;
    }, this));
    mb.subscribe(amc.EVENTS.PAUSE, 'test', _.bind(function(paused, _pausedFor) {
      this.pausedFor = _pausedFor;
    }, this));
    testAdManager.playAd = function(ad) {
      this.adStarted = (function(ad) { return function() {
          amc.notifyPodStarted(ad.id, 1);
        }; })(ad);
      this.adEnded =  (function(ad) { return function() {
          amc.notifyPodEnded(ad.id);
        }; })(ad);
    };
    testAdManager.pauseAd = function() {
      this.adPaused = true;
    };

    // during preroll
    initPlayer();
    startPlay();
    if (_.isFunction(testAdManager.adStarted)) testAdManager.adStarted();
    mb.publish(OO.EVENTS.PAUSE, 'pauseForAdPlayback');

    expect(this.contentPaused).to.be(false);
    expect(this.pausedFor).to.be.eql('pauseForAdPlayback');
    expect(testAdManager.adPaused).to.be(true);

    // after preroll
    if (_.isFunction(testAdManager.adEnded)) testAdManager.adEnded();
    playStarted();
    mb.publish(OO.EVENTS.PAUSE);
    expect(this.pausedFor).to.be(undefined);
    expect(this.contentPaused).to.be(true);
  });

  it('listeners: sizeChanged called on valid sizes', function(){
    var width = 10;
    var height = 12;
    this.newWidth = null;
    this.newHeight = null;
    amc.addPlayerListener(amc.EVENTS.SIZE_CHANGED, _.bind(function() {
      this.newWidth = width;
      this.newHeight = height;
    }, this));

    // setup amc.ui so that onSizeChanged can handle the inputs properly
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    amc.ui.rootElement = $("<div>", {});
    amc.ui.adVideoElement = $("<div>", {class: "video"});

    mb.publish(OO.EVENTS.SIZE_CHANGED, width, height);
    expect(this.newWidth).to.eql(width);
    expect(this.newHeight).to.eql(height);
  });

  it('listeners: sizeChanged not called on invalid sizes', function(){
    amc.addPlayerListener(amc.EVENTS.SIZE_CHANGED, _.bind(function() {
      this.called = true;
    }, this));

    // setup amc.ui so that onSizeChanged can handle the inputs properly
    mb.publish(OO.EVENTS.PLAYER_CREATED, "elementId", {});
    amc.ui.rootElement = {"width": function(){return null;}, "height": function(){return null;}};

    this.called = false;
    mb.publish(OO.EVENTS.SIZE_CHANGED, -1, 50);
    expect(this.called).to.be(false);

    this.called = false;
    mb.publish(OO.EVENTS.SIZE_CHANGED, 100, -50);
    expect(this.called).to.be(false);

    this.called = false;
    mb.publish(OO.EVENTS.SIZE_CHANGED, -100, -50);
    expect(this.called).to.be(false);
  });
});
