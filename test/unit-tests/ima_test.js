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
  require(TEST_ROOT + "unit-test-helpers/mock_amc.js");
  require(TEST_ROOT + "unit-test-helpers/mock_ima.js");

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
    ima.initialize(amc, playerId);
    videoWrapper = imaVideoPluginFactory.create(null, null, null, null, playerId);
  };

  before(_.bind(function() {
    OO.Ads = {
      manager: function(adManager){
        ima = adManager(_, $);
        ima.runningUnitTests = true;
      }
    };

    OO.Video = {
      plugin: function(plugin){
        imaVideoPluginFactory = plugin;
      }
    };
    amc = new fake_amc();
    delete require.cache[require.resolve(SRC_ROOT + "google_ima.js")];
    require(SRC_ROOT + "google_ima.js");

    imaIframe = $("<iframe src='http://imasdk.googleapis.com/'></iframe>");

    $('body').append(imaIframe);
  }, this));

  after(function() {
    OO.Ads = originalOoAds;
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
    debugger;
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
    createVideoWrapper();
    expect(ima.videoControllerWrapper).to.be(videoWrapper);
  });

  // Wrapper functionality tests
  it('Video plugin: Video wrapper requestPlay stores a play request if IMA is not initialized', function(){
    createVideoWrapper();
    videoWrapper.play();
    expect(ima.vcPlayRequested).to.be(true);
  });

  it('Video plugin: Video wrapper requestPause removes a previous play request', function(){
    createVideoWrapper();
    videoWrapper.play();
    expect(ima.vcPlayRequested).to.be(true);
    videoWrapper.pause();
    expect(ima.vcPlayRequested).to.be(false);
  });

  // Notify tests
  it('Video plugin: Video wrapper', function(){
  });
});
