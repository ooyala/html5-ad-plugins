/*
 * Unit test class for the Google IMA Ad Manager
 * https://github.com/Automattic/expect.js
 */

//stubs
OO.log = function() {};

describe('ad_manager_ima', function() {
  var amc,ima;
  var imaVideoPluginFactory;
  var name = "google-ima-ads-manager";
  var playerId = "ima-player-id";
  var originalOoAds = _.clone(OO.Ads);
  //require(TEST_ROOT + "unit-test-helpers/mock_amc.js");

  // IMA constants
  var AD_RULES_POSITION_TYPE = 'r';
  var NON_AD_RULES_POSITION_TYPE = 't';

  // Helper functions

  var initialize = function(adRules) {
    ima.initialize(amc, playerId);
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

  before(_.bind(function() {
    OO.Ads = {
      manager: function(adManager){
        ima = adManager(_, $);
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
  }, this));

  after(function() {
    OO.Ads = originalOoAds;
  });

  beforeEach(function() {
  });

  afterEach(_.bind(function() {
    ima.destroy();
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', function(){
    expect(typeof amc).to.be("object");
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

  it('Init: video plugin is created after ad manager is initialized', function(){
    ima.initialize(amc, playerId);
    var imaVideoPlugin = imaVideoPluginFactory.create(null, null, null, null, playerId);
    expect(typeof imaVideoPlugin).to.be("object");
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

  it('Init: ad is added to timeline for non-ad-rules ads', function(){
    debugger;
    initialize(false);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].ad.type).not.to.be("adRequest");
  });

  it('Init: fake ad is added to timeline for ad rules ads', function(){
    debugger;
    initialize(true);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].ad.type).to.be("adRequest");
  });

  it('Timeline: adds all valid slots', function() {
  });
});
