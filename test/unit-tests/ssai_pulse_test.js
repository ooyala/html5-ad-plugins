/*
 * Unit test class for the SSAI Pulse Ad Manager
 * https://github.com/Automattic/expect.js
 */

//stubs
OO.log = function() {};
require(COMMON_SRC_ROOT + "utils/utils.js");
require(COMMON_SRC_ROOT + "utils/environment.js");
require(COMMON_SRC_ROOT + "classes/emitter.js");

var fs = require("fs");

describe('ad_manager_ssai_pulse', function() {
  var amc, SsaiPulse;
  var name = "ssai-pulse-ads-manager";
  var originalOoAds = _.clone(OO.Ads);
  require(TEST_ROOT + "unit-test-helpers/mock_amc.js");

  var adsClickthroughOpenedCalled = 0;

  // Helper functions
  var fakeAd = function(timePositionClass, position, duration) {
    var timePositionClass = timePositionClass;
    var position = position;
    var duration = duration;
    this.getTimePositionClass = function(){ return timePositionClass; };
    this.getTimePosition = function() { return position; };
    this.getTotalDuration = function() { return duration; };
  };

  var initialize = function() {
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    SsaiPulse.initialize(amc);
    SsaiPulse.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
  };

  var initialPlay = function() {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
  };

  before(_.bind(function() {
    OO.Ads = {
      manager: function(adManager){
        SsaiPulse = adManager(_, $);
        SsaiPulse.testMode = true;
      }
    };
    delete require.cache[require.resolve(SRC_ROOT + "ssai_pulse.js")];
    require(SRC_ROOT + "ssai_pulse.js");

  }, this));

  after(function() {
    OO.Ads = originalOoAds;
  });

  beforeEach(function() {
    amc = new fake_amc();
    amc.adManagerList = [];
    amc.onAdManagerReady = function() {this.timeline = this.adManagerList[0].buildTimeline()};
    amc.adManagerList.push(SsaiPulse);
  });

  afterEach(_.bind(function() {
    amc.timeline = [];
    SsaiPulse.destroy();
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', function(){
    expect(typeof amc).to.be("object");
  });

  it('Init: ad manager is registered', function(){
    expect(SsaiPulse).to.not.be(null);
  });

  it('Init: ad manager has the expected name', function(){
    expect(SsaiPulse.name).to.be(name);
  });

  it('Init: ad manager handles the initialize function', function(){
    expect(function() { SsaiPulse.initialize(amc); }).to.not.throwException();
  });

  it('Init: ad manager handles the loadMetadata function', function(){
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    SsaiPulse.initialize(amc);
    expect(function() { SsaiPulse.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);}).to.not.throwException();
  });

  it('Init: ad manager is ready', function(){
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    SsaiPulse.initialize(amc);
    expect(SsaiPulse.ready).to.be(false);
    SsaiPulse.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    expect(SsaiPulse.ready).to.be(true);
  });
});
