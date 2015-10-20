require(SRC_ROOT + "include/constants.js");
require(SRC_ROOT + "core/message_bus.js");
require(TEST_ROOT + 'helpers/message_bus_helper.js');


// override OO.registerModule so we get a handle on factory method
var moduleFactory;
OO.registerModule = function(name, factory) {
  moduleFactory = factory;
};

// load the module
require(SRC_ROOT + "modules/ads/ads_manager.js");

// stub environment
OO.requiredInEnvironment = function() {
  return true;
};


// stub playerParams
OO.playerParams = {};

// stub server defs
OO.SERVER = {AUTH:'http://auth', API: 'http://api'};

describe('ads_manager', function(){
  var mb,adsManager;
  var vast_ad = {
    type: "vast",
    first_shown: 0,
    frequency: 2,
    ad_set_code: "ad_set_code"
  };
  var ooyala_ad = {
    type: "ooyala",
    first_shown: 1,
    frequency: 3,
    public_id: "public_id"
  };
  var random_ad = {
    type: "something_else",
    first_shown: 0,
    frequency: 1,
    ad_set_code: "ad_set_code"
  };

  before(function(){
  });

  after(function(){
  });

  beforeEach(function(){
    mb = new OO.MessageBus();
    adsManager = moduleFactory(mb,'ads-manager-test');
  });

  afterEach(function(){
  });

  it('should exist', function() {
    expect(adsManager).to.not.be(null);
  });

  it('should react to EMBED_CODE_CHANGED', function() {
    var embed_code = 'embed_code';
    mb.publish(OO.EVENTS.EMBED_CODE_CHANGED, embed_code);
    expect(adsManager.currentState).to.be('Init');
    expect(adsManager.currentEmbedCode).to.be(embed_code);
    expect(adsManager.ads).to.eql([]);
  });

  it('should make sure that CONTENT_TREE_FETCHED corresponds to correct embed_code', function() {
    var embed_code = 'embed_code';
    mb.publish(OO.EVENTS.EMBED_CODE_CHANGED, embed_code);
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, 'different_embed_code');
    expect(adsManager.currentState).not.to.be('WaitingForFirstAdRequest');
  });

  it('should process CONTENT_TREE_FETCHED', function() {
    var embed_code = 'embed_code';
    var content = {embed_code: embed_code, ads:[
      {time: 0, type: 'ooyala', ad_embed_code: 'ad_embed_code'}
      ]};
    mb.publish(OO.EVENTS.EMBED_CODE_CHANGED, embed_code);
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, content, embed_code);
    expect(adsManager.currentState).to.be('WaitingForFirstAdRequest');
    expect(adsManager.firstAdsIsOoyala).to.be(true);
    expect(mb.published(OO.EVENTS.WILL_FETCH_AD_AUTHORIZATION)[1].embedCode).to.be('ad_embed_code');
  });

  it("should filter ads by ad frequency settings", function() {
    var embed_code = "embed_code";
    var content = {
      embed_code: embed_code,
      ads: [vast_ad, ooyala_ad]
    };
    adsManager._getAdPlayCounts = function() { return { ad_set_code: 1, public_id: 1 }; };
    mb.publish(OO.EVENTS.EMBED_CODE_CHANGED, embed_code);
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, content, embed_code);
    expect(adsManager.ads.length).to.be(1);
  });

  it("should only filter ad if type is ooyala or vast", function() {
    var embed_code = "embed_code";
    var content = {
      embed_code: embed_code,
      ads: [vast_ad, ooyala_ad, random_ad]
    };
    mb.publish(OO.EVENTS.EMBED_CODE_CHANGED, embed_code);
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, content, embed_code);
    expect(adsManager.ads.length).to.be(2);
  });

  it("should increment ad play counts when PLAYING event is received", function() {
    var embed_code = "embed_code";
    var content = {
      embed_code: embed_code,
      ads: [vast_ad, ooyala_ad]
    };
    mb.publish(OO.EVENTS.EMBED_CODE_CHANGED, embed_code);
    mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, content, embed_code);
    // Stub out this method for the PLAYING event
    adsManager._setVastAdLoader = function() {};
    mb.publish(OO.EVENTS.PLAYING);
    expect(adsManager.adPlayCounts["ad_set_code"]).to.be(1);
    expect(adsManager.adPlayCounts["public_id"]).to.be(1);
  });

  // it('should react to EMBED_CODE_CHANGED', function() {
  //   mb.publish(OO.EVENTS.EMBED_CODE_CHANGED, 'embed_code');
  //   expect(playbackControl.currentState).to.be('WaitingForApiResponse');
  // });
  //
  // it('should be ready for playback after collecting metadata', function() {
  //   // mb.publish(OO.EVENTS.EMBED_CODE_CHANGED, 'embed_code');
  //   // mb.publish(OO.EVENTS.CONTENT_TREE_FETCHED, { ads: [] });
  //   // mb.publish(OO.EVENTS.AUTHORIZATION_FETCHED, {});
  //   // expect(playbackControl.currentState).to.be('PlaybackReady');
  // });

});
