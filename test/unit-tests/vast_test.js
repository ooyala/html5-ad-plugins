/*
 * Unit test class for the Vast Ad Manager
 * https://github.com/Automattic/expect.js
 */

//stubs
OO.log = function() {};
require(COMMON_SRC_ROOT + "utils/utils.js");
require(COMMON_SRC_ROOT + "utils/environment.js");
require(COMMON_SRC_ROOT + "classes/emitter.js");

var fs = require("fs");

describe('ad_manager_vast', function() {
  var amc, vastAdManager;
  var name = "vast";
  var originalOoAds = _.clone(OO.Ads);
  require(TEST_ROOT + "unit-test-helpers/mock_amc.js");

  var linearXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_linear.xml"), "utf8");
  var linear3_0XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_3_0_linear.xml"), "utf8");
  var linear3_0PoddedXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_3_0_inline_podded.xml"), "utf8");
  var nonLinearXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_overlay.xml"), "utf8");
  var wrapperXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_wrapper.xml"), "utf8");
  var linearXML = OO.$.parseXML(linearXMLString);
  var linear3_0XML = OO.$.parseXML(linear3_0XMLString);
  var linear3_0XMLPodded = OO.$.parseXML(linear3_0PoddedXMLString);
  var nonLinearXML = OO.$.parseXML(nonLinearXMLString);
  var wrapperXML = OO.$.parseXML(wrapperXMLString);
  var playerParamWrapperDepth = OO.playerParams.maxVastWrapperDepth;


  // Helper functions
  fakeAd = function(timePositionClass, position, duration) {
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
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
        "html5_ad_server": "http://blah"}, {}, content);
    amc.timeline = vastAdManager.buildTimeline();
  };

  var initalPlay = function() {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
  };

  before(_.bind(function() {
    OO.Ads = {
      manager: function(adManager){
        vastAdManager = adManager(_, $);
        vastAdManager.testMode = true;
      }
    };
    delete require.cache[require.resolve(SRC_ROOT + "ad_manager_vast.js")];
    require(SRC_ROOT + "ad_manager_vast.js");
  }, this));

  after(function() {
    OO.Ads = originalOoAds;
  });

  beforeEach(function() {
    amc = new fake_amc();
    OO.playerParams.maxVastWrapperDepth = 2;
  });

  afterEach(_.bind(function() {
    amc.timeline = [];
    vastAdManager.destroy();
    OO.playerParams.maxVastWrapperDepth = playerParamWrapperDepth;
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', function(){
    expect(typeof amc).to.be("object");
  });

  it('Init: ad manager is registered', function(){
    expect(vastAdManager).to.not.be(null);
  });

  it('Init: ad manager has the expected name', function(){
    expect(vastAdManager.name).to.be(name);
  });

  it('Init: ad manager handles the initialize function', function(){
    expect(function() { vastAdManager.initialize(amc); }).to.not.throwException();
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
    vastAdManager.initialize(amc);
    expect(function() { vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
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
    vastAdManager.initialize(amc);
    expect(vastAdManager.ready).to.be(false);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    expect(vastAdManager.ready).to.be(true);
  });

  it('Init: preroll was loaded', function(){
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
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(true);
  });

  it('Init: no preroll was found or loaded', function(){
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
  });
  it('Init: no preroll but midroll was found or loaded after initial play', function(){
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };

    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad, linearXML);
    expect(amc.timeline.length).to.be(1);
  });
  it('Init: preroll loaded before play and midroll after initial play', function(){
    var embed_code = "embed_code";
    var vast_ad_pre = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t"
    };
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_pre, vast_ad_mid]
    };

    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(true);
    vastAdManager._onVastResponse(vast_ad_pre, linearXML);
    expect(amc.timeline.length).to.be(1);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad_mid, linearXML);
    expect(amc.timeline.length).to.be(2);
  });

  it('Init: postroll after initial play', function(){
    var embed_code = "embed_code";
    var vast_ad_post = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:1000000000,
      position_type:"t",
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_post]
    };

    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    expect(amc.timeline.length).to.be(0);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad_post, linearXML);
    expect(amc.timeline.length).to.be(1);
  });
  it('Init: preroll loaded before play, then midroll and postroll after initial play', function(){
    var embed_code = "embed_code";
    var vast_ad_pre = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t"
    };
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.mp4"
    };
    var vast_ad_post = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:1000000000,
      position_type:"t",
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_pre, vast_ad_mid, vast_ad_post]
    };

    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(true);
    vastAdManager._onVastResponse(vast_ad_pre, linearXML);
    expect(amc.timeline.length).to.be(1);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad_mid, linearXML);
    expect(amc.timeline.length).to.be(2);
    vastAdManager._onVastResponse(vast_ad_post, linearXML);
    expect(amc.timeline.length).to.be(3);
  });

  it('should invalid vast', function(){
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad,'<VAST></VAST>')
    expect(amc.timeline.length).to.be(0);
    vastAdManager._onVastResponse(null,linearXML);
    expect(amc.timeline.length).to.be(0);
    vastAdManager._onVastResponse(vast_ad, '<VAST version="2.1"></VAST>');
    expect(amc.timeline.length).to.be(0);
    vastAdManager._onVastResponse(null, '<VAST version="2.0"></VAST>');
    expect(amc.timeline.length).to.be(0);
  });

  it('should parse inline linear ads', function(){
    var embed_code = "embed_code";
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad_mid, linearXML);
    var vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.linear.tracking.start).to.eql(['starturl']);
    expect(vastAd.ad.data.linear.tracking.firstQuartile).to.eql(['firstQuartileurl']);
    expect(vastAd.ad.data.linear.tracking.midpoint).to.eql(['midpointUrl']);
    expect(vastAd.ad.data.linear.tracking.thirdQuartile).to.eql(['thirdQuartileUrl']);
    expect(vastAd.ad.data.linear.tracking.complete).to.eql(['completeUrl']);
    expect(vastAd.ad.data.linear.tracking.mute).to.eql(['muteUrl']);
    expect(vastAd.ad.data.linear.tracking.unmute).to.eql(['unmuteUrl']);
    expect(vastAd.ad.data.linear.tracking.rewind).to.eql(['rewindUrl']);
    expect(vastAd.ad.data.linear.tracking.pause).to.eql(['pauseUrl']);
    expect(vastAd.ad.data.linear.tracking.resume).to.eql(['resumeUrl']);
    expect(vastAd.ad.data.linear.tracking.creativeView).to.eql(['creativeViewUrl']);
    expect(vastAd.ad.data.linear.tracking.fullscreen).to.eql(['fullScreenUrl']);
    expect(vastAd.ad.data.linear.tracking.acceptInvitation).to.eql([]);
    expect(vastAd.ad.data.companion).to.be.an('array');
    expect(vastAd.ad.data.companion.length).to.be(2);

    expect(vastAd.ad.data.companion[0].type).to.be('static');
    expect(vastAd.ad.data.companion[0].data).to.be('1.jpg');
    expect(vastAd.ad.data.companion[0].width).to.be('728');
    expect(vastAd.ad.data.companion[0].height).to.be('90');
    expect(vastAd.ad.data.companion[0].CompanionClickThrough).to.be('companionClickThrough');
    expect(vastAd.ad.data.companion[0].tracking.creativeView).to.eql(['companionCreativeViewUrl']);

    expect(vastAd.ad.data.companion[1].type).to.be('static');
    expect(vastAd.ad.data.companion[1].data).to.be('2.jpg');
    expect(vastAd.ad.data.companion[1].width).to.be('300');
    expect(vastAd.ad.data.companion[1].height).to.be('250');
    expect(vastAd.ad.data.companion[1].CompanionClickThrough).to.be('companion2ClickThrough');
    expect(vastAd.ad.data.companion[1].tracking.creativeView).to.eql(['companion2CreativeViewUrl']);
  });

  it('should parse inline non linear ads', function(){
    var embed_code = "embed_code";
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.jpg"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad_mid, nonLinearXML);
    var vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionOverlayUrl', 'impressionOverlay2Url',
      'impressionOverlay3Url', 'impressionOverlay4Url', 'impressionOverlay5Url',
      'impressionOverlay6Url' ]);
    expect(vastAd.ad.data.nonLinear).not.to.be(null);
    expect(vastAd.ad.data.linear).to.eql({'ClickTracking':[],'tracking':{}});
    expect(vastAd.ad.data.nonLinear.width).to.be('300');
    expect(vastAd.ad.data.nonLinear.height).to.be('60');
    expect(vastAd.ad.data.nonLinear.NonLinearClickThrough).to.be('nonLinearClickThroughUrl');
    expect(vastAd.ad.data.nonLinear.type).to.be('static');
    expect(vastAd.ad.data.nonLinear.data).to.be('1.jpg');
    expect(vastAd.ad.data.nonLinear.url).to.be('1.jpg');
    expect(vastAd.ad.data.nonLinear.tracking.creativeView).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.start).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.midpoint).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.firstQuartile).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.thirdQuartile).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.complete).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.mute).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.unmute).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.pause).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.rewind).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.resume).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.fullscreen).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.expand).to.eql([]);
    expect(vastAd.ad.data.nonLinear.tracking.collapse).to.eql(['collapseUrl']);
    expect(vastAd.ad.data.nonLinear.tracking.acceptInvitation).to.eql(['acceptInvitationUrl']);
    expect(vastAd.ad.data.nonLinear.tracking.close).to.eql([]);

    expect(vastAd.ad.data.companion).to.be.an('array');
    expect(vastAd.ad.data.companion.length).to.be(2);
    expect(vastAd.ad.data.companion[0].type).to.be('static');
    expect(vastAd.ad.data.companion[0].data).to.be('companion.jpg');
    expect(vastAd.ad.data.companion[0].width).to.be('300');
    expect(vastAd.ad.data.companion[0].height).to.be('60');
    expect(vastAd.ad.data.companion[0].CompanionClickThrough).to.be('companionClickThroughUrl');
    expect(vastAd.ad.data.companion[0].tracking.creativeView).to.eql(['companionCreativeViewUrl']);

    expect(vastAd.ad.data.companion[1].type).to.be('static');
    expect(vastAd.ad.data.companion[1].data).to.be('companion2.jpg');
    expect(vastAd.ad.data.companion[1].width).to.be('300');
    expect(vastAd.ad.data.companion[1].height).to.be('250');
    expect(vastAd.ad.data.companion[1].CompanionClickThrough).to.be('companion2ClickThroughUrl');
    expect(vastAd.ad.data.companion[1].tracking.creativeView).to.eql(['companion2CreativeViewUrl']);
  });

  //TODO: Fix wrapper ads test
  //it('should parse wrapper ads', function(){
  //  var embed_code = "embed_code";
  //  var vast_ad_mid = {
  //    type: "vast",
  //    first_shown: 0,
  //    frequency: 2,
  //    ad_set_code: "ad_set_code",
  //    time:10,
  //    position_type:"t",
  //    url:"1.jpg"
  //  };
  //  var content = {
  //    embed_code: embed_code,
  //    ads: [vast_ad_mid]
  //  };
  //  vastAdManager.initialize(amc);
  //  expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
  //    "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
  //  initalPlay();
  //  expect(vastAdManager.initialPlay()).to.be(true);
  //  vastAdManager._onVastResponse(vast_ad_mid, wrapperXML);
  //  var vastAd = amc.timeline[0];
  //  expect(vastAd.ad).to.be.an('object');
  //  expect(vastAd.ad.data.impression).to.eql(['impressionOverlayUrl', 'impressionOverlay2Url', 'impressionOverlay3Url',
  //    'impressionOverlay4Url', 'impressionOverlay5Url', 'impressionOverlay6Url']);
  //  expect(vastAd.ad.data.companion).to.be.an('array');
  //  expect(vastAd.ad.data.companion.length).to.be(2);
  //  expect(vastAd.ad.data.companion[0].type).to.be('static');
  //  expect(vastAd.ad.data.companion[0].data).to.be('companion.jpg');
  //  expect(vastAd.ad.data.companion[0].width).to.be('300');
  //  expect(vastAd.ad.data.companion[0].height).to.be('60');
  //  expect(vastAd.ad.data.companion[0].CompanionClickThrough).to.be('companionClickThroughUrl');
  //  expect(vastAd.ad.data.companion[0].tracking.creativeView).to.eql(['companionCreativeViewUrl']);
  //
  //  expect(vastAd.ad.data.companion[1].type).to.be('static');
  //  expect(vastAd.ad.data.companion[1].data).to.be('companion2.jpg');
  //  expect(vastAd.ad.data.companion[1].width).to.be('300');
  //  expect(vastAd.ad.data.companion[1].height).to.be('250');
  //  expect(vastAd.ad.data.companion[1].CompanionClickThrough).to.be('companion2ClickThroughUrl');
  //  expect(vastAd.ad.data.companion[1].tracking.creativeView).to.eql(['companion2CreativeViewUrl']);
  //});
  //TODO: Need to cover PlayADs, overlays and companions once v4 is integrated.

  //Vast 3.0 Tests

  //Skip Ad functionality
  it('Vast 3.0: should provide skip ad parameters to AMC on playAd', function(){
    var allowSkipButton = false;
    var skipOffset = 0;
    amc.showSkipVideoAdButton = function(allowButton, offset) {
      allowSkipButton = allowButton;
      skipOffset = offset;
    };
    var embed_code = "embed_code";
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.jpg"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad_mid, linear3_0XML);
    var vastAd = amc.timeline[0];
    vastAdManager.playAd(vastAd);
    expect(allowSkipButton).to.be(true);
    //value in MS. vast_3_0_linear.xml mock response has value of 00:00:05, which is 5 seconds
    expect(skipOffset).to.be('5');
  });

  it('Vast 2.0: should not provide skip ad parameters to AMC on playAd', function(){
    var allowSkipButton = false;
    var skipOffset = 0;
    amc.showSkipVideoAdButton = function(allowButton, offset) {
      allowSkipButton = allowButton;
      skipOffset = offset;
    };
    var embed_code = "embed_code";
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.jpg"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad_mid, linearXML);
    var vastAd = amc.timeline[0];
    vastAdManager.playAd(vastAd);
    expect(allowSkipButton).to.be(true);
    expect(skipOffset).to.be(undefined);
  });

  //TODO: Unit test for testing skipoffset with percentage value

  it('Vast 2.0: should provide ad pod position and length of 1 to AMC on playAd', function(){
    var allowSkipButton = false;
    var skipOffset = 0;
    var adPodLength = -1;
    var indexInPod = -1;
    amc.showSkipVideoAdButton = function(allowButton, offset) {
      allowSkipButton = allowButton;
      skipOffset = offset;
    };
    amc.notifyPodStarted = function(id, podLength) {
      adPodLength = podLength;
    };
    amc.notifyLinearAdStarted = function(name, props) {
      if (props) {
        indexInPod = props.indexInPod;
      }
    };

    var embed_code = "embed_code";
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.jpg"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    vastAdManager._onVastResponse(vast_ad_mid, linearXML);
    var vastAd = amc.timeline[0];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(1);
    expect(indexInPod).to.be(1);
  });

  it('Vast 3.0: should parse inline linear podded ads', function(){
    var embed_code = "embed_code";
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    //TODO: expand on these tests
    vastAdManager._onVastResponse(vast_ad_mid, linear3_0XMLPodded);
    var vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654646');

    vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654645');

    vastAd = amc.timeline[2];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654644');
  });

  it('Vast 3.0: should provide proper ad pod positions and length to AMC on playAd', function(){
    var adPodLength = -1;
    var indexInPod = -1;
    amc.notifyPodStarted = function(id, podLength) {
      adPodLength = podLength;
    };
    amc.notifyLinearAdStarted = function(name, props) {
      if (props) {
        indexInPod = props.indexInPod;
      }
    };
    var embed_code = "embed_code";
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content)).to.be(false);
    initalPlay();
    expect(vastAdManager.initialPlay()).to.be(true);
    //TODO: expand on these tests
    vastAdManager._onVastResponse(vast_ad_mid, linear3_0XMLPodded);

    var vastAd = amc.timeline[0];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(1);

    vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(2);

    vastAd = amc.timeline[2];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(3);
  });
});
