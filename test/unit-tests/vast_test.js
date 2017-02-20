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
  require(TEST_ROOT + 'unit-test-helpers/mock_vpaid.js');

  var linearXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_linear.xml"), "utf8");
  var linearXMLNoClickthroughString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_linear_no_clickthrough.xml"), "utf8");
  var linearXML2AdsString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_linear_2_ads.xml"), "utf8");
  var linear3_0XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_3_0_linear.xml"), "utf8");
  var linear3_0PoddedXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_3_0_inline_podded.xml"), "utf8");
  var linear3_0MissingMediaFilesString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_3_0_missing_media_files.xml"), "utf8");
  var nonLinearXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_overlay.xml"), "utf8");
  var nonLinearXMLMissingURLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_overlay_missing_url.xml"), "utf8");
  var wrapper1XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_wrapper_1.xml"), "utf8");
  var wrapper2XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_wrapper_2.xml"), "utf8");
  var vmapAdTagPreXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vmap_adtag_pre.xml"), "utf8");
  var vmapInlinePreAdTagPostXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vmap_inline_pre_adtag_post.xml"), "utf8");
  var vmapInlineRepeatAdXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vmap_inline_repeatad.xml"), "utf8");
  var vmapInlineRepeatAdBadInput1XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vmap_inline_repeatad_bad_input1.xml"), "utf8");
  var vmapInlineRepeatAdBadInput2XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vmap_inline_repeatad_bad_input2.xml"), "utf8");
  var vmapInlinePoddedXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vmap_inline_podded.xml"), "utf8");
  var vpaidLinearXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vpaid_linear.xml'), 'utf8');
  var vpaidLinearNoValuesXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vpaid_linear_novalues.xml'), 'utf8');
  var vpaidNonLinearXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vpaid_nonlinear.xml'), 'utf8');
  var vpaidNoCompanionXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vpaid_linear_nocompanions.xml'), 'utf8');
  var contentTypeHLS1XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_content_type_HLS_1.xml"), "utf8");
  var contentTypeHLS2XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_content_type_HLS_2.xml"), "utf8");
  var contentTypeHLS3XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_content_type_HLS_3.xml"), "utf8");
  var contentTypeHLS4XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_content_type_HLS_4.xml"), "utf8");

  var linearXML = OO.$.parseXML(linearXMLString);
  var linearNoClickthroughXML = OO.$.parseXML(linearXMLNoClickthroughString);
  var linearXML2Ads = OO.$.parseXML(linearXML2AdsString);
  var linear3_0XML = OO.$.parseXML(linear3_0XMLString);
  var linear3_0XMLPodded = OO.$.parseXML(linear3_0PoddedXMLString);
  var linear3_0MissingMediaFiles = OO.$.parseXML(linear3_0MissingMediaFilesString);
  var nonLinearXML = OO.$.parseXML(nonLinearXMLString);
  var nonLinearXMLMissingURL = OO.$.parseXML(nonLinearXMLMissingURLString);
  var vmapAdTagPre = OO.$.parseXML(vmapAdTagPreXMLString);
  var vmapInlinePreAdTagPost = OO.$.parseXML(vmapInlinePreAdTagPostXMLString);
  var vmapInlinePodded = OO.$.parseXML(vmapInlinePoddedXMLString);
  var vmapInlineRepeatAd = OO.$.parseXML(vmapInlineRepeatAdXMLString);
  var vmapInlineRepeatAdBadInput1 = OO.$.parseXML(vmapInlineRepeatAdBadInput1XMLString);
  var vmapInlineRepeatAdBadInput2 = OO.$.parseXML(vmapInlineRepeatAdBadInput2XMLString);
  var vpaidLinearXML = OO.$.parseXML(vpaidLinearXMLString);
  var vpaidLinearNoValuesXML = OO.$.parseXML(vpaidLinearNoValuesXMLString);
  var vpaidNonLinearXML = OO.$.parseXML(vpaidNonLinearXMLString);
  var vpaidNoCompanionXML = OO.$.parseXML(vpaidNoCompanionXMLString);
  var contentTypeHLS1 = OO.$.parseXML(contentTypeHLS1XMLString);
  var contentTypeHLS2 = OO.$.parseXML(contentTypeHLS2XMLString);
  var contentTypeHLS3 = OO.$.parseXML(contentTypeHLS3XMLString);
  var contentTypeHLS4 = OO.$.parseXML(contentTypeHLS4XMLString);

  var wrapper1XML = OO.$.parseXML(wrapper1XMLString);
  var wrapper2XML = OO.$.parseXML(wrapper2XMLString);
  var playerParamWrapperDepth = OO.playerParams.maxVastWrapperDepth;
  var errorType = [];
  var pixelPingCalled = false;
  var trackingUrlsPinged = {};
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
      position_type:"t",
      position:0,
      url: "http://blahurl"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
  };

  var vpaidInitialize = function(xml) {
    var embed_code = "embed_code",
        preroll = {
          type: "vast",
          first_shown: 0,
          frequency: 2,
          ad_set_code: "ad_set_code",
          time:0,
          position_type:"t",
          position:0,
          url: "http://blahurl"
        },
        content = {
          embed_code: embed_code,
          ads: [preroll]
        },
        server = {
          html5_ssl_ad_server: "https://blah",
          html5_ad_server: "http://blah"
        };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata(server, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    xml = xml || vpaidLinearXML;
    vastAdManager.onVastResponse(preroll, xml);
  };

  var initialPlay = function() {
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

    // mock pixelPing to test error tracking
    OO.pixelPing = function(url) {
      pixelPingCalled = true;
      if (url) {
        if (trackingUrlsPinged.hasOwnProperty(url)) {
          trackingUrlsPinged[url] += 1;
        }
        else {
          trackingUrlsPinged[url] = 1;
        }
      }
    };

    // mock trackError function to test error tracking
    vastAdManager.trackError = function (code, currentAdId) {
      errorType.push(code);
      if (currentAdId) {
        if (currentAdId && currentAdId in this.adTrackingInfo) {

          //directly ping url
          OO.pixelPing();
        }
      }
    };

  }, this));

  after(function() {
    OO.Ads = originalOoAds;
  });

  beforeEach(function() {
    amc = new fake_amc();
    amc.adManagerList = [];
    amc.onAdManagerReady = function() {this.timeline = this.adManagerList[0].buildTimeline()};
    amc.adManagerList.push(vastAdManager);
    OO.playerParams.maxVastWrapperDepth = 2;
    errorType = [];
    pixelPingCalled= false;
    trackingUrlsPinged = {};
    vastAdManager.adTrackingInfo = {};
    vastAdManager.adBreaks = [];
    adsClickthroughOpenedCalled = 0;

    //VPAID specifics
    global.vpaid.adInit = false;
    global.vpaid.adStarted = false;
    global.vpaid.adStopped = false;
    global.vpaid.adSkipped = false;
    global.vpaid.getVPAIDAd = function() { return new global.vpaid.VpaidAd(); };
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

  it('Init: preroll returned in buildTimeline()', function(){
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t",
      url:"http://blahurl"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    var timeline = amc.timeline;
    expect(timeline.length).to.be(1);
    expect(timeline[0].position).to.be(0);
    expect(timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
  });

  it('Init: test midroll return in buildTimeline', function(){
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10000,
      position_type:"t",
      url:"http://blahurl"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad]
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    var timeline = amc.timeline;
    expect(timeline.length).to.be(1);
    expect(timeline[0].position).to.be(10);
        expect(timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
  });

  it('Init: test preroll and midroll appear in buildTimeline() and prerolls loads on initialPlay', function(){
    var embed_code = "embed_code";
    var vast_ad_pre = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t",
      url:"0.mp4"
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);

    //vastAdManager.onVastResponse(vast_ad_pre, linearXML);
    expect(errorType.length).to.be(0);
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
    expect(amc.timeline[1].adType).to.be(amc.ADTYPE.AD_REQUEST);

    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_pre, linearXML);
    expect(errorType.length).to.be(0);
    //test that real ad gets added to timeline when it's loaded.
    expect(amc.timeline.length).to.be(3);
    //test assumes the timeline isn't being sorted by the amc. If that changes, this will need to change accordingly.
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
    expect(amc.timeline[1].adType).to.be(amc.ADTYPE.AD_REQUEST);
    expect(amc.timeline[2].adType).to.be(amc.ADTYPE.LINEAR_VIDEO);
    expect(amc.timeline[2].ad.type).to.be(undefined);
  });

  it('Init: test postroll appears in buildTimeline', function(){
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    expect(amc.timeline.length).to.be(1);

    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad,'<VAST></VAST>');

    expect(errorType.length > 0).to.be(true);
    expect(amc.timeline.length).to.be(1);
    errorType = [];

    vastAdManager.onVastResponse(null,linearXML);
    expect(errorType.length > 0).to.be(true);
    expect(amc.timeline.length).to.be(1);
    errorType = [];

    vastAdManager.onVastResponse(vast_ad, '<VAST version="2.1"></VAST>');
    expect(errorType.length > 0).to.be(true);
    expect(amc.timeline.length).to.be(1);
    errorType = [];

    vastAdManager.onVastResponse(null, '<VAST version="2.0"></VAST>');
    expect(errorType.length > 0).to.be(true);
    expect(amc.timeline.length).to.be(1);
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, linearXML);

    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.videoRestrictions).to.be(undefined);
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionUrl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.linear.tracking.start).to.eql(['startUrl']);
    expect(vastAd.ad.data.linear.tracking.firstQuartile).to.eql(['firstQuartileUrl']);
    expect(vastAd.ad.data.linear.tracking.midpoint).to.eql(['midpointUrl']);
    expect(vastAd.ad.data.linear.tracking.thirdQuartile).to.eql(['thirdQuartileUrl']);
    expect(vastAd.ad.data.linear.tracking.complete).to.eql(['completeUrl']);
    expect(vastAd.ad.data.linear.tracking.mute).to.eql(['muteUrl']);
    expect(vastAd.ad.data.linear.tracking.unmute).to.eql(['unmuteUrl']);
    expect(vastAd.ad.data.linear.tracking.rewind).to.eql(['rewindUrl']);
    expect(vastAd.ad.data.linear.tracking.pause).to.eql(['pauseUrl']);
    expect(vastAd.ad.data.linear.tracking.resume).to.eql(['resumeUrl']);
    expect(vastAd.ad.data.linear.tracking.creativeView).to.eql(['creativeViewUrl']);
    expect(vastAd.ad.data.linear.tracking.fullscreen).to.eql(['fullscreenUrl']);
    expect(vastAd.ad.data.linear.tracking.acceptInvitation).to.eql([]);
    expect(vastAd.ad.data.companion).to.be.an('array');
    expect(vastAd.ad.data.companion.length).to.be(2);

    expect(vastAd.ad.data.companion[0].type).to.be('static');
    expect(vastAd.ad.data.companion[0].data).to.be('1.jpg');
    expect(vastAd.ad.data.companion[0].width).to.be('728');
    expect(vastAd.ad.data.companion[0].height).to.be('90');
    expect(vastAd.ad.data.companion[0].companionClickThrough).to.be('companionClickThrough');
    expect(vastAd.ad.data.companion[0].tracking.creativeView).to.eql(['companionCreativeViewUrl']);

    expect(vastAd.ad.data.companion[1].type).to.be('static');
    expect(vastAd.ad.data.companion[1].data).to.be('2.jpg');
    expect(vastAd.ad.data.companion[1].width).to.be('300');
    expect(vastAd.ad.data.companion[1].height).to.be('250');
    expect(vastAd.ad.data.companion[1].companionClickThrough).to.be('companion2ClickThrough');
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, nonLinearXML);
    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionOverlayUrl', 'impressionOverlay2Url',
        'impressionOverlay3Url', 'impressionOverlay4Url', 'impressionOverlay5Url',
        'impressionOverlay6Url' ]);
    expect(vastAd.ad.data.nonLinear).not.to.be(null);
    expect(vastAd.ad.data.linear).to.eql({});
    expect(vastAd.ad.data.nonLinear.width).to.be('300');
    expect(vastAd.ad.data.nonLinear.height).to.be('60');
    expect(vastAd.ad.data.nonLinear.nonLinearClickThrough).to.be('nonLinearClickThroughUrl');
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
    expect(vastAd.ad.data.nonLinear.tracking.close).to.eql(['closeUrl']);

    expect(vastAd.ad.data.companion).to.be.an('array');
    expect(vastAd.ad.data.companion.length).to.be(2);
    expect(vastAd.ad.data.companion[0].type).to.be('static');
    expect(vastAd.ad.data.companion[0].data).to.be('companion.jpg');
    expect(vastAd.ad.data.companion[0].width).to.be('300');
    expect(vastAd.ad.data.companion[0].height).to.be('60');
    expect(vastAd.ad.data.companion[0].companionClickThrough).to.be('companionClickThroughUrl');
    expect(vastAd.ad.data.companion[0].tracking.creativeView).to.eql(['companionCreativeViewUrl']);

    expect(vastAd.ad.data.companion[1].type).to.be('static');
    expect(vastAd.ad.data.companion[1].data).to.be('companion2.jpg');
    expect(vastAd.ad.data.companion[1].width).to.be('300');
    expect(vastAd.ad.data.companion[1].height).to.be('250');
    expect(vastAd.ad.data.companion[1].companionClickThrough).to.be('companion2ClickThroughUrl');
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
  //  vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
  //    "html5_ad_server": "http://blah"}, {}, content);
  //  initialPlay();
  //  vastAdManager.initialPlay();
  //  vastAdManager.onVastResponse(vast_ad_mid, wrapper1XML);
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
  //  expect(vastAd.ad.data.companion[0].companionClickThrough).to.be('companionClickThroughUrl');
  //  expect(vastAd.ad.data.companion[0].tracking.creativeView).to.eql(['companionCreativeViewUrl']);
  //
  //  expect(vastAd.ad.data.companion[1].type).to.be('static');
  //  expect(vastAd.ad.data.companion[1].data).to.be('companion2.jpg');
  //  expect(vastAd.ad.data.companion[1].width).to.be('300');
  //  expect(vastAd.ad.data.companion[1].height).to.be('250');
  //  expect(vastAd.ad.data.companion[1].companionClickThrough).to.be('companion2ClickThroughUrl');
  //  expect(vastAd.ad.data.companion[1].tracking.creativeView).to.eql(['companion2CreativeViewUrl']);
  //});
  //TODO: Need to cover overlays and companions once v4 is integrated.

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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, linear3_0XML);
    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, linearXML);
    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, linearXML);
    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(1);
    expect(indexInPod).to.be(1);
  });

  it('Vast 2.0: should open clickthrough url if player is clicked', function(){
    //Vast Ad Manager regularly calls window.open here.
    //Will instead track what we are trying to open
    var openedUrls = [];
    vastAdManager.openUrl = function(url) {
      if (url) {
        openedUrls.push(url);
        return true;
      }
      return false;
    };
    amc.adsClickthroughOpened = function() {
      adsClickthroughOpenedCalled += 1;
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, linearXML);
    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    vastAdManager.playerClicked(vastAd, true);
    //1 clickthrough url is defined in vast_linear.xml
    expect(openedUrls.length).to.be(1);
    expect(adsClickthroughOpenedCalled).to.be(1);
  });

  it('Vast 2.0: should not open a clickthrough url if one is not defined', function(){
    //Vast Ad Manager regularly calls window.open here.
    //Will instead track what we are trying to open
    var openedUrls = [];
    vastAdManager.openUrl = function(url) {
      if (url) {
        openedUrls.push(url);
        return true;
      }
      return false;
    };
    amc.adsClickthroughOpened = function() {
      adsClickthroughOpenedCalled += 1;
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, linearNoClickthroughXML);
    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    vastAdManager.playerClicked(vastAd, true);
    expect(openedUrls.length).to.be(0);
    expect(adsClickthroughOpenedCalled).to.be(0);
  });

  it('Vast 2.0: should play multiple ads if multiple ads are defined', function(){
    var adQueue = [];
    amc.forceAdToPlay = function(adManager, ad, adType, streams) {
      var adData = {
        "adManager": adManager,
        "adType": adType,
        "ad": ad,
        "streams":streams,
        "position": -1 //we want it to play immediately
      };
      var newAd = new amc.Ad(adData);
      adQueue.push(newAd);
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    vastAdManager.onVastResponse(vast_ad_mid, linearXML2Ads);
    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654644');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    vastAd = adQueue[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654645');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
  });

  it('Vast 3.0: should parse inline linear podded ads', function(){
    var adQueue = [];
    amc.forceAdToPlay = function(adManager, ad, adType, streams) {
      var adData = {
        "adManager": adManager,
        "adType": adType,
        "ad": ad,
        "streams":streams,
        "position": -1 //we want it to play immediately
      };
      var newAd = new amc.Ad(adData);
      adQueue.push(newAd);
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    vastAdManager.onVastResponse(vast_ad_mid, linear3_0XMLPodded);
    expect(errorType.length).to.be(0);
    var vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654646');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    vastAd = adQueue[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654645');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    vastAd = adQueue[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654644');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
  });

  it('Vast 3.0: should provide proper ad pod positions and length to AMC on playAd', function(){
    var adPodLength = -1;
    var indexInPod = -1;
    var adQueue = [];

    amc.forceAdToPlay = function(adManager, ad, adType, streams) {
      var adData = {
        "adManager": adManager,
        "adType": adType,
        "ad": ad,
        "streams":streams,
        "position": -1 //we want it to play immediately
      };
      var newAd = new amc.Ad(adData);
      adQueue.push(newAd);
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
      url:"1.mp4"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    vastAdManager.onVastResponse(vast_ad_mid, linear3_0XMLPodded);
    expect(errorType.length).to.be(0);

    var vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(1);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    vastAd = adQueue[0];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(2);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    vastAd = adQueue[1];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(3);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
  });

  it('Vast 3.0: AMC is notified of linear/nonlinear ad start/end and pod start/end', function(){
    var nonLinearStartNotified = 0;
    var podStartNotified = 0;
    var podEndNotified = 0;
    var linearStartNotified = 0;
    var linearEndNotified = 0;
    var adQueue = [];

    amc.forceAdToPlay = function(adManager, ad, adType, streams) {
      var adData = {
        "adManager": adManager,
        "adType": adType,
        "ad": ad,
        "streams":streams,
        "position": -1 //we want it to play immediately
      };
      var newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    amc.notifyPodStarted = function() {
      podStartNotified++;
    };
    amc.notifyPodEnded = function() {
      podEndNotified++;
    };
    amc.notifyLinearAdStarted = function() {
      linearStartNotified++;
    };
    amc.notifyLinearAdEnded = function() {
      linearEndNotified++;
    };
    amc.sendURLToLoadAndPlayNonLinearAd = function() {
      nonLinearStartNotified++;
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    vastAdManager.onVastResponse(vast_ad_mid, linear3_0XMLPodded);
    expect(errorType.length).to.be(0);

    var vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(podStartNotified).to.be(1);
    expect(podEndNotified).to.be(0);
    expect(linearStartNotified).to.be(1);
    expect(linearEndNotified).to.be(0);
    expect(nonLinearStartNotified).to.be(0);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    expect(podStartNotified).to.be(1);
    expect(podEndNotified).to.be(0);
    expect(linearStartNotified).to.be(1);
    expect(linearEndNotified).to.be(1);
    expect(nonLinearStartNotified).to.be(0);

    vastAd = adQueue[0];
    vastAdManager.playAd(vastAd);
    expect(podStartNotified).to.be(1);
    expect(podEndNotified).to.be(0);
    expect(linearStartNotified).to.be(2);
    expect(linearEndNotified).to.be(1);
    expect(nonLinearStartNotified).to.be(0);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    expect(podStartNotified).to.be(1);
    expect(podEndNotified).to.be(0);
    expect(linearStartNotified).to.be(2);
    expect(linearEndNotified).to.be(2);
    expect(nonLinearStartNotified).to.be(0);

    vastAd = adQueue[1];
    vastAdManager.playAd(vastAd);
    expect(podStartNotified).to.be(1);
    expect(podEndNotified).to.be(0);
    expect(linearStartNotified).to.be(3);
    expect(linearEndNotified).to.be(2);
    expect(nonLinearStartNotified).to.be(0);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    expect(podStartNotified).to.be(1);
    expect(podEndNotified).to.be(1);
    expect(linearStartNotified).to.be(3);
    expect(linearEndNotified).to.be(3);
    expect(nonLinearStartNotified).to.be(0);

    //overlay
    vastAd = adQueue[2];
    vastAdManager.playAd(vastAd);
    expect(podStartNotified).to.be(1);
    expect(podEndNotified).to.be(1);
    expect(linearStartNotified).to.be(3);
    expect(linearEndNotified).to.be(3);
    expect(nonLinearStartNotified).to.be(1);
  });

  it('Vast 3.0: On ad timeout, fallback ad will be shown', function(){
    var nonLinearStartNotified = 0;
    var podStartNotified = 0;
    var podEndNotified = 0;
    var linearStartNotified = 0;
    var linearEndNotified = 0;
    var adQueue = [];

    amc.forceAdToPlay = function(adManager, ad, adType, streams) {
      var adData = {
        "adManager": adManager,
        "adType": adType,
        "ad": ad,
        "streams":streams,
        "position": -1 //we want it to play immediately
      };
      var newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    amc.notifyPodStarted = function() {
      podStartNotified++;
    };
    amc.notifyPodEnded = function() {
      podEndNotified++;
    };
    amc.notifyLinearAdStarted = function() {
      linearStartNotified++;
    };
    amc.notifyLinearAdEnded = function() {
      linearEndNotified++;
    };
    amc.sendURLToLoadAndPlayNonLinearAd = function() {
      nonLinearStartNotified++;
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, linear3_0XMLPodded);
    expect(errorType.length).to.be(0);

    var vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654646');

    vastAdManager.cancelAd(vastAd, {
      code : amc.AD_CANCEL_CODE.TIMEOUT
    });
    vastAd = adQueue[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654600');
  });

  it('Vast 3.0: On ad playback error, fallback ad will be shown', function(){
    var nonLinearStartNotified = 0;
    var podStartNotified = 0;
    var podEndNotified = 0;
    var linearStartNotified = 0;
    var linearEndNotified = 0;
    var adQueue = [];

    amc.forceAdToPlay = function(adManager, ad, adType, streams) {
      var adData = {
        "adManager": adManager,
        "adType": adType,
        "ad": ad,
        "streams":streams,
        "position": -1 //we want it to play immediately
      };
      var newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    amc.notifyPodStarted = function() {
      podStartNotified++;
    };
    amc.notifyPodEnded = function() {
      podEndNotified++;
    };
    amc.notifyLinearAdStarted = function() {
      linearStartNotified++;
    };
    amc.notifyLinearAdEnded = function() {
      linearEndNotified++;
    };
    amc.sendURLToLoadAndPlayNonLinearAd = function() {
      nonLinearStartNotified++;
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad_mid, linear3_0XMLPodded);
    expect(errorType.length).to.be(0);

    var vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654646');

    vastAdManager.adVideoError();
    vastAd = adQueue[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([ 'errorurl' ]);
    expect(vastAd.ad.data.impression).to.eql([ 'impressionurl' ]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654600');
  });

  it('Vast 3.0, Error Reporting: adTrackingInfo should parse the correct number of errorURLs and ads', function(){
    var jqueryAds = $(linearXML).find("Ad");
    vastAdManager.getErrorTrackingInfo(linearXML, jqueryAds);
    // should have one ad
    var adIDs = _.keys(vastAdManager.adTrackingInfo);
    expect(adIDs.length).to.be(1);
    // should have only one errorurl
    var adErrorInfo = vastAdManager.adTrackingInfo[adIDs[0]];
    expect(adErrorInfo.errorURLs.length).to.be(1);
    vastAdManager.adTrackingInfo = {};

    jqueryAds = $(nonLinearXML).find("Ad");
    vastAdManager.getErrorTrackingInfo(nonLinearXML, jqueryAds);
    // should have one ad
    adIDs = _.keys(vastAdManager.adTrackingInfo);
    expect(adIDs.length).to.be(1);
    // should have only no errorurls
    adErrorInfo = vastAdManager.adTrackingInfo[adIDs[0]];
    expect(adErrorInfo.errorURLs.length).to.be(0);
  });

  /*
   *  it('Vast 3.0, Error Reporting: Should report too many wrappers error', function(){
   *    var embed_code = "embed_code";
   *    var vast_ad_mid = {
   *      type: "vast",
   *      first_shown: 0,
   *      frequency: 2,
   *      ad_set_code: "ad_set_code",
   *      time:10,
   *      position_type:"t",
   *      url:"1.jpg"
   *    };
   *    var content = {
   *      embed_code: embed_code,
   *      ads: [vast_ad_mid]
   *    };
   *    vastAdManager.initialize(amc);
   *
   *    // setup parameters so wrapper code will fail
   *    vastAdManager.currentDepth = OO.playerParams.maxVastWrapperDepth;
   *    var vastAd = {
   *      ads:[
   *        {
   *          id: "wrapperId",
   *        }
   *      ]
   *    };
   *    vastAdManager.adTrackingInfo = {
   *      "wrapperId": {}
   *    };
   *
   *    vastAdManager.handleWrapper(vast_ad_mid, vastAd, wrapper1XML);
   *    expect(errorType).to.be(vastAdManager.ERROR_CODES.WRAPPER_LIMIT_REACHED);
   *    expect(pixelPingCalled).to.be(true);
   *  });
   *
   *  it('Vast 3.0, Error Reporting: Should report general wrapper error', function(){
   *    var embed_code = "embed_code";
   *    var vast_ad_mid = {
   *      type: "vast",
   *      first_shown: 0,
   *      frequency: 2,
   *      ad_set_code: "ad_set_code",
   *      time:10,
   *      position_type:"t",
   *      url:"1.jpg"
   *    };
   *    var content = {
   *      embed_code: embed_code,
   *      ads: [vast_ad_mid]
   *    };
   *    vastAdManager.initialize(amc);
   *
   *    var vastAd = {
   *      ads: null
   *    };
   *    vastAdManager.handleWrapper(vast_ad_mid, vastAd, wrapper1XML);
   *    expect(errorType).to.be(vastAdManager.ERROR_CODES.GENERAL_WRAPPER);
   *
   *    vastAd = {
   *      ads: []
   *    };
   *    vastAdManager.handleWrapper(vast_ad_mid, vastAd, wrapper1XML);
   *    expect(errorType).to.be(vastAdManager.ERROR_CODES.GENERAL_WRAPPER);
   *  });
   */

  it('Vast 3.0, Error Reporting: should report XML parsing error', function(){
    var embed_code = "embed_code";
    var vast_ad_mid = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:10,
      position_type:"t",
      url:"1.jpg",
    };

    var vast_ad_request = {
      adManager:"vast",
      ad: {
        type:vastAdManager.AD_REQUEST_TYPE,
        url:"1.jpg"
        }
    };

    var content = {
      embed_code: embed_code,
      ads: [vast_ad_mid]
    };

    vastAdManager.initialize(amc);
    vastAdManager.playAd(new amc.Ad(vast_ad_request));
    vastAdManager.onVastResponse(null, linearXML);
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.XML_PARSING)).to.be(true);
    errorType = [];

    vastAdManager.onVastResponse(null, nonLinearXML);
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.XML_PARSING)).to.be(true);
  });

  it('Vast 3.0, Error Reporting: Should report unsupported vast version error', function(){
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

    vastAdManager.isValidVastVersion("");
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.VERSION_UNSUPPORTED)).to.be(true);
  });

  it('Vast 3.0, Error Reporting: Should report schema validation error', function(){
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

    vastAdManager.isValidRootTagName("");
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.SCHEMA_VALIDATION)).to.be(true);
  });

  /*
   *  it('Vast 3.0, Error Reporting: Should report wrapper no ads error', function(){
   *    var embed_code = "embed_code";
   *    var vast_ad_mid = {
   *      type: "vast",
   *      first_shown: 0,
   *      frequency: 2,
   *      ad_set_code: "ad_set_code",
   *      time:10,
   *      position_type:"t",
   *      url:"1.jpg"
   *    };
   *    var content = {
   *      embed_code: embed_code,
   *      ads: [vast_ad_mid]
   *    };
   *    vastAdManager.initialize(amc);
   *
   *    // no error url exists so url is not pinged
   *    vastAdManager.checkNoAds("", []);
   *    expect(errorType).to.be(vastAdManager.ERROR_CODES.WRAPPER_NO_ADS);
   *    expect(pixelPingCalled).to.be(false);
   *
   *    // error url exists so url should be pinged
   *    vastAdManager.checkNoAds(linearXML, []);
   *    expect(errorType).to.be(vastAdManager.ERROR_CODES.WRAPPER_NO_ADS);
   *    expect(pixelPingCalled).to.be(true);
   *  });
   */

  it('Vast 3.0, Error Reporting: Should report general linear ads error', function(){
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

    // setup parameters so nonlinear ad fails because there are no mediaFiles in XML
    // but still pings error url if there is an error tag
    vastAdManager.adTrackingInfo = {
      "linearAd1": {}
    };

    vastAdManager.onVastResponse(vast_ad_mid, linear3_0MissingMediaFiles);
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.GENERAL_LINEAR_ADS)).to.be(true);
    expect(pixelPingCalled).to.be(true);
  });

  it('Vast 3.0, Error Reporting: Should report general nonlinear ads error', function(){
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

    // setup parameters so nonlinear ad fails because there is no ad url
    // but still pings error url if there is an error tag
    vastAdManager.adTrackingInfo = {
      "nonLinearAd1": {}
    };

    vastAdManager.onVastResponse(vast_ad_mid, nonLinearXMLMissingURL);
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.GENERAL_NONLINEAR_ADS)).to.be(true);
    expect(pixelPingCalled).to.be(true);
  });

  it('Vast 3.0, VMAP: Should call onVMAPResponse if there is a VMAP XML response', function() {
    var onVMAPResponseCalled = false;
    var onVastResponseCalled = false;

    vastAdManager.onResponse = function(adLoaded, xml) {
      var jqueryXML = $(xml);
      var vmap = jqueryXML.find("vmap\\:VMAP, VMAP");
      if (vmap.length > 0) {
        onVMAPResponseCalled = true;
      }
      else {
        onVastResponseCalled = true;
      }
    };

    vastAdManager.onResponse(null, vmapAdTagPre);
    expect(onVMAPResponseCalled).to.be(true);
    expect(onVastResponseCalled).to.be(false);
  });

  it('Vast 3.0, VMAP, AdTag Pre-roll: Should parse AdTagURI and TrackingEvents properly', function() {
    vastAdManager.onVMAPResponse(vmapAdTagPre);
    var adBreaks = vastAdManager.adBreaks;
    expect(adBreaks.length).to.be(1);

    var adBreak = adBreaks[0];
    expect(adBreak.timeOffset).to.be("start");
    expect(adBreak.breakType).to.be("linear");
    expect(adBreak.breakId).to.be("preroll");

    expect(adBreak.adSource).not.to.be(null);

    var adSource = adBreak.adSource;
    expect(adSource.id).to.be("preroll-ad-1");
    expect(adSource.allowMultipleAds).to.be("false");
    expect(adSource.followRedirects).to.be("true");
    expect(adSource.adTagURI).to.be("adTagURI");

    var trackingEvents = adBreak.trackingEvents;
    expect(trackingEvents[0].eventName).to.be("breakStart");
    expect(trackingEvents[1].eventName).to.be("error");
    expect(trackingEvents[0].url).to.be("trackingURL");
    expect(trackingEvents[1].url).to.be("errorURL");
  });

  it('Vast 3.0, VMAP, Inline Pre-roll Overlay, Post-roll: Should parse overlay and post-roll properly', function() {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlinePreAdTagPost);
    var adBreaks = vastAdManager.adBreaks;
    expect(adBreaks.length).to.be(2);

    var prerollAdBreak = adBreaks[0];
    expect(prerollAdBreak.timeOffset).to.be("start");
    expect(prerollAdBreak.breakType).to.be("linear");
    expect(prerollAdBreak.breakId).to.be("preroll");

    expect(prerollAdBreak.adSource).not.to.be(null);

    var prerollAdSource = prerollAdBreak.adSource;
    expect(prerollAdSource.id).to.be("preroll-ad-1");
    expect(prerollAdSource.allowMultipleAds).to.be("true");
    expect(prerollAdSource.followRedirects).to.be("true");
    expect(prerollAdSource.adTagURI).to.be(undefined);
    expect(prerollAdSource.VASTAdData).not.to.be(null);

    var trackingEvents = prerollAdBreak.trackingEvents;
    expect(trackingEvents[0].eventName).to.be("breakStart");
    expect(trackingEvents[1].eventName).to.be("error");
    expect(trackingEvents[0].url).to.be("trackingURL");
    expect(trackingEvents[1].url).to.be("errorURL");

    var vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(["Error URL"]);
    expect(vastAd.ad.data.impression).to.eql(["Impression"]);
    expect(vastAd.ad.data.nonLinear).not.to.be(null);
    expect(vastAd.ad.data.linear).to.eql({});
    expect(vastAd.ad.data.nonLinear.width).to.be("480");
    expect(vastAd.ad.data.nonLinear.height).to.be("70");
    expect(vastAd.ad.data.nonLinear.minSuggestedDuration).to.be("00:00:05");
    expect(vastAd.ad.data.nonLinear.scalable).to.be("true");
    expect(vastAd.ad.data.nonLinear.maintainAspectRatio).to.be("true");
    expect(vastAd.ad.data.nonLinear.nonLinearClickThrough).to.be('nonLinearClickThroughURL');
    expect(vastAd.ad.data.nonLinear.type).to.be("static");
    expect(vastAd.ad.data.nonLinear.data).to.be("staticResourceURL");
    expect(vastAd.ad.data.nonLinear.url).to.be("staticResourceURL");
    expect(vastAd.ad.data.nonLinear.tracking.start).to.eql(["startEventURL"]);
    expect(vastAd.ad.data.nonLinear.tracking.firstQuartile).to.eql(["firstQuartileEventURL"]);
    expect(vastAd.ad.data.nonLinear.tracking.midpoint).to.eql(["midpointEventURL"]);

    var postrollAdBreak = adBreaks[1];
    expect(postrollAdBreak.timeOffset).to.be("end");
    expect(postrollAdBreak.breakType).to.be("linear");
    expect(postrollAdBreak.breakId).to.be("postroll");

    expect(postrollAdBreak.adSource).not.to.be(null);

    var postrollAdSource = postrollAdBreak.adSource;
    expect(postrollAdSource.id).to.be("postroll-ad-1");
    expect(postrollAdSource.allowMultipleAds).to.be("false");
    expect(postrollAdSource.followRedirects).to.be("true");
    expect(postrollAdSource.adTagURI).to.be("adTagURI");
  });

  it('Vast 3.0, VMAP: Should parse AdBreak with repeatAfter attribute properly', function() {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlineRepeatAd);
    var adBreaks = vastAdManager.adBreaks;
    expect(adBreaks.length).to.be(3);

    var firstRepeatAdBreak = adBreaks[0];
    expect(firstRepeatAdBreak.timeOffset).to.be("start");
    expect(firstRepeatAdBreak.breakType).to.be("linear");
    expect(firstRepeatAdBreak.breakId).to.be("repeat");
    expect(firstRepeatAdBreak.repeatAfter).to.be("00:00:05");

    expect(firstRepeatAdBreak.adSource).not.to.be(null);

    var firstRepeatAdSource = firstRepeatAdBreak.adSource;
    expect(firstRepeatAdSource.id).to.be("repeat-ad-1");
    expect(firstRepeatAdSource.allowMultipleAds).to.be("true");
    expect(firstRepeatAdSource.followRedirects).to.be("true");
    expect(firstRepeatAdSource.adTagURI).to.be(undefined);
    expect(firstRepeatAdSource.VASTAdData).not.to.be(null);

    var trackingEvents = firstRepeatAdBreak.trackingEvents;
    expect(trackingEvents[0].eventName).to.be("breakStart");
    expect(trackingEvents[1].eventName).to.be("error");
    expect(trackingEvents[0].url).to.be("trackingurl1");
    expect(trackingEvents[1].url).to.be("errorurl1");

    var vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an("object");
    expect(vastAd.ad.data.error).to.eql(["errorurl1"]);
    expect(vastAd.ad.data.impression).to.eql(["impressionurl1"]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.linear.duration).to.eql("00:00:52");
    expect(vastAd.ad.data.linear.skipOffset).to.be("00:00:05");
    expect(vastAd.ad.data.linear.tracking.start).to.eql(["starturl1"]);
    expect(vastAd.ad.data.linear.tracking.firstQuartile).to.eql(["firstquartileurl1"]);
    expect(vastAd.ad.data.linear.tracking.midpoint).to.eql(["midpointurl1"]);
    expect(vastAd.ad.data.linear.clickThrough).to.eql("clickthroughurl1");
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].id).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].delivery).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].bitrate).to.be("330");
    expect(vastAd.ad.data.linear.mediaFiles[0].width).to.be("640");
    expect(vastAd.ad.data.linear.mediaFiles[0].height).to.be("360");
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be("video/mp4");
    expect(vastAd.ad.data.linear.mediaFiles[0].scalable).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].maintainAspectRatio).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].url).to.be("1.mp4");
    expect(vastAd.ad.repeatAfter).to.be(5);

    var secondRepeatAdBreak = adBreaks[1];
    expect(secondRepeatAdBreak.timeOffset).to.be("start");
    expect(secondRepeatAdBreak.breakType).to.be("linear");
    expect(secondRepeatAdBreak.breakId).to.be("repeat");
    expect(secondRepeatAdBreak.repeatAfter).to.be("00:00:10");

    expect(secondRepeatAdBreak.adSource).not.to.be(null);

    var secondRepeatAdSource = secondRepeatAdBreak.adSource;
    expect(secondRepeatAdSource.id).to.be("repeat-ad-2");
    expect(secondRepeatAdSource.allowMultipleAds).to.be("true");
    expect(secondRepeatAdSource.followRedirects).to.be("true");
    expect(secondRepeatAdSource.adTagURI).to.be(undefined);
    expect(secondRepeatAdSource.VASTAdData).not.to.be(null);

    trackingEvents = secondRepeatAdBreak.trackingEvents;
    expect(trackingEvents[0].eventName).to.be("breakStart");
    expect(trackingEvents[1].eventName).to.be("error");
    expect(trackingEvents[0].url).to.be("trackingurl2");
    expect(trackingEvents[1].url).to.be("errorurl2");

    vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an("object");
    expect(vastAd.ad.data.error).to.eql(["errorurl2"]);
    expect(vastAd.ad.data.impression).to.eql(["impressionurl2"]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.linear.duration).to.eql("00:00:52");
    expect(vastAd.ad.data.linear.skipOffset).to.be("00:00:05");
    expect(vastAd.ad.data.linear.tracking.start).to.eql(["starturl2"]);
    expect(vastAd.ad.data.linear.tracking.firstQuartile).to.eql(["firstquartileurl2"]);
    expect(vastAd.ad.data.linear.tracking.midpoint).to.eql(["midpointurl2"]);
    expect(vastAd.ad.data.linear.clickThrough).to.eql("clickthroughurl2");
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].id).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].delivery).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].bitrate).to.be("330");
    expect(vastAd.ad.data.linear.mediaFiles[0].width).to.be("640");
    expect(vastAd.ad.data.linear.mediaFiles[0].height).to.be("360");
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be("video/mp4");
    expect(vastAd.ad.data.linear.mediaFiles[0].scalable).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].maintainAspectRatio).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].url).to.be("1.mp4");
    expect(vastAd.ad.repeatAfter).to.be(10);

    var thirdAdBreak = adBreaks[2];
    expect(thirdAdBreak.timeOffset).to.be("00:00:15");
    expect(thirdAdBreak.breakType).to.be("linear");
    expect(thirdAdBreak.breakId).to.be("midroll");
    expect(thirdAdBreak.repeatAfter).to.be(undefined);

    expect(thirdAdBreak.adSource).not.to.be(null);

    var thirdAdSource = thirdAdBreak.adSource;
    expect(thirdAdSource.id).to.be("midroll-ad-1");
    expect(thirdAdSource.allowMultipleAds).to.be("false");
    expect(thirdAdSource.followRedirects).to.be("false");
    expect(thirdAdSource.adTagURI).to.be(undefined);
    expect(thirdAdSource.VASTAdData).not.to.be(null);

    trackingEvents = thirdAdBreak.trackingEvents;
    expect(trackingEvents[0].eventName).to.be("breakStart");
    expect(trackingEvents[1].eventName).to.be("error");
    expect(trackingEvents[0].url).to.be("trackingurl3");
    expect(trackingEvents[1].url).to.be("errorurl3");

    vastAd = amc.timeline[2];
    expect(vastAd.ad).to.be.an("object");
    expect(vastAd.ad.data.error).to.eql(["errorurl3"]);
    expect(vastAd.ad.data.impression).to.eql(["impressionurl3"]);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.linear.duration).to.eql("00:00:52");
    expect(vastAd.ad.data.linear.skipOffset).to.be("00:00:05");
    expect(vastAd.ad.data.linear.tracking.start).to.eql(["starturl3"]);
    expect(vastAd.ad.data.linear.tracking.firstQuartile).to.eql(["firstquartileurl3"]);
    expect(vastAd.ad.data.linear.tracking.midpoint).to.eql(["midpointurl3"]);
    expect(vastAd.ad.data.linear.clickThrough).to.eql("clickthroughurl3");
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].id).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].delivery).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].bitrate).to.be("330");
    expect(vastAd.ad.data.linear.mediaFiles[0].width).to.be("640");
    expect(vastAd.ad.data.linear.mediaFiles[0].height).to.be("360");
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be("video/mp4");
    expect(vastAd.ad.data.linear.mediaFiles[0].scalable).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].maintainAspectRatio).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].url).to.be("1.mp4");
    expect(vastAd.ad.repeatAfter).to.be(null);
  });

  it('Vast 3.0, VMAP: Should parse AdBreak with bad repeat inputs - 1', function() {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlineRepeatAdBadInput1);
    var adBreaks = vastAdManager.adBreaks;

    var firstRepeatAdBreak = adBreaks[0];
    expect(firstRepeatAdBreak.repeatAfter).to.be("00:00:");

    var vastAd = amc.timeline[0];
    expect(vastAd.ad.repeatAfter).to.be(null);

    var secondRepeatAdBreak = adBreaks[1];
    expect(secondRepeatAdBreak.repeatAfter).to.be("1337");

    vastAd = amc.timeline[1];
    expect(vastAd.ad.repeatAfter).to.be(null);
  });

  it('Vast 3.0, VMAP: Should parse AdBreak with bad repeat inputs - 2', function() {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlineRepeatAdBadInput2);
    var adBreaks = vastAdManager.adBreaks;

    var firstRepeatAdBreak = adBreaks[0];
    expect(firstRepeatAdBreak.repeatAfter).to.be("apple");

    var vastAd = amc.timeline[0];
    expect(vastAd.ad.repeatAfter).to.be(null);

    var secondRepeatAdBreak = adBreaks[1];
    expect(secondRepeatAdBreak.repeatAfter).to.be("");

    vastAd = amc.timeline[1];
    expect(vastAd.ad.repeatAfter).to.be(null);
  });

  it('Vast 3.0, VMAP: Should not play podded ad if allowMultipleAds is set to false', function() {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlinePodded);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should use page level settings with position_type t', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": 10000
        }
      ]
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline[0].ad.position).to.be(10);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://blahblah");
  });

  it('Vast Ad Manager: Should use page level settings with position_type t with string position', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": "10000"
        }
      ]
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline[0].ad.position).to.be(10);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://blahblah");
  });

  it('Vast Ad Manager: Should use page level settings with position_type p', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": 50
        }
      ]
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline[0].ad.position).to.be(60);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://blahblah");
  });

  it('Vast Ad Manager: Should use page level settings with position_type p with string position', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": "50"
        }
      ]
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline[0].ad.position).to.be(60);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://blahblah");
  });

  it('Vast Ad Manager: Can add multiple position type \'t\' ads with page level settings', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": 10000
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": 20000
        }
      ]
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.position).to.be(10);
    expect(amc.timeline[1].ad.position).to.be(20);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://blahblah");
  });

  it('Vast Ad Manager: Can add multiple position type \'p\' ads with page level settings', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": 25
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": 50
        }
      ]
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.position).to.be(30);
    expect(amc.timeline[1].ad.position).to.be(60);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://blahblah");
  });

  it('Vast Ad Manager: Can add multiple mixed position type ads with page level settings', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": 25
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": 50000
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": 0
        }
      ]
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(3);
    expect(amc.timeline[0].ad.position).to.be(30);
    expect(amc.timeline[1].ad.position).to.be(50);
    //Timeline is not sorted at this point
    expect(amc.timeline[2].ad.position).to.be(0);
    vastAdManager.playAd(amc.timeline[2]);
    expect(vastAdManager.vastUrl).to.be("http://blahblah");
  });

  it('Vast Ad Manager: Should ignore page level settings with non-string tag_urls', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": null,
          "position_type": "t",
          "position": 0
        },
        {
          "position_type": "p",
          "position": 0
        },
        {
          "tag_url": {},
          "position_type": "t",
          "position": 0
        },
        {
          "tag_url": function(){},
          "position_type": "t",
          "position": 0
        },
        {
          "tag_url": true,
          "position_type": "t",
          "position": 0
        },
        {
          "tag_url": false,
          "position_type": "t",
          "position": 0
        },
        {
          "tag_url": 12345,
          "position_type": "t",
          "position": 0
        }
      ]
    }, {}, content);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should ignore page level settings with null positions', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": null
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": null
        }
      ]
    }, {}, content);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should ignore page level settings with undefined positions', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "t"
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "p"
        }
      ]
    }, {}, content);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should ignore page level settings with non-string/non-number positions', function() {
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
      ads: [vast_ad],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "all_ads": [
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": {}
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": function(){}
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": true
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": false
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "t",
          "position": NaN
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": "NaN"
        }
      ]
    }, {}, content);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should use tag url override if provided in page level settings for content tree ads', function() {
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t",
      url: "http://vastad1"
    };
    var vast_ad2 = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code2",
      time:0,
      position_type:"t",
      url: "http://vastad2"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad, vast_ad2],
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "tagUrl":"http://override"
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://override");
    expect(amc.timeline[1].ad.tag_url).to.be("http://override");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://override");
  });

  it('Vast Ad Manager: Should use tag url override if provided in page level settings for page level ads', function() {
    var embed_code = "embed_code";
    var content = {
      embed_code: embed_code,
      duration: 120000
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      "tagUrl":"http://override",
      "all_ads":[
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": 25
        },
        {
          "tag_url": "http://blahblah",
          "position_type": "p",
          "position": 50
        }
      ]
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://override");
    expect(amc.timeline[1].ad.tag_url).to.be("http://override");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://override");
  });

  it('Vast Ad Manager: Should ignore tag url override if is not a string', function() {
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t",
      url: "http://vastad1"
    };
    var vast_ad2 = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code2",
      time:0,
      position_type:"t",
      url: "http://vastad2"
    };
    var content = {
      embed_code: embed_code,
      ads: [vast_ad, vast_ad2],
      duration: 120000
    };
    vastAdManager.initialize(amc);

    vastAdManager.loadMetadata({
      "tagUrl":null
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://vastad1");
    expect(amc.timeline[1].ad.tag_url).to.be("http://vastad2");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://vastad1");

    amc.timeline = [];
    vastAdManager.loadMetadata({
      //undefined tag url
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://vastad1");
    expect(amc.timeline[1].ad.tag_url).to.be("http://vastad2");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://vastad1");

    amc.timeline = [];
    vastAdManager.loadMetadata({
      "tagUrl":{}
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://vastad1");
    expect(amc.timeline[1].ad.tag_url).to.be("http://vastad2");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://vastad1");

    amc.timeline = [];
    vastAdManager.loadMetadata({
      "tagUrl":function(){}
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://vastad1");
    expect(amc.timeline[1].ad.tag_url).to.be("http://vastad2");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://vastad1");

    amc.timeline = [];
    vastAdManager.loadMetadata({
      "tagUrl":12345
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://vastad1");
    expect(amc.timeline[1].ad.tag_url).to.be("http://vastad2");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://vastad1");

    amc.timeline = [];
    vastAdManager.loadMetadata({
      "tagUrl":true
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://vastad1");
    expect(amc.timeline[1].ad.tag_url).to.be("http://vastad2");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://vastad1");

    amc.timeline = [];
    vastAdManager.loadMetadata({
      "tagUrl":false
    }, {}, content);
    amc.timeline[0].id = "asdf";//work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be("http://vastad1");
    expect(amc.timeline[1].ad.tag_url).to.be("http://vastad2");
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be("http://vastad1");
  });

  it('VPAID 2.0: Should use VPAID recovery timeout overrides', function() {
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
    vastAdManager.loadMetadata({"vpaidTimeout":{
      "iframe":9,
      "loaded":10,
      "started":11,
      "stopped":12
    }}, {}, content);
    expect(vastAdManager.VPAID_AD_IFRAME_TIMEOUT).to.be(9000);
    expect(vastAdManager.VPAID_AD_LOADED_TIMEOUT).to.be(10000);
    expect(vastAdManager.VPAID_AD_STARTED_TIMEOUT).to.be(11000);
    expect(vastAdManager.VPAID_AD_STOPPED_TIMEOUT).to.be(12000);
  });

  it('VPAID 2.0: Should parse VPAID linear creative', function() {
    vpaidInitialize();
    var ad = amc.timeline[1];
    expect(ad).to.be.an('object');
    expect(ad.duration).to.eql(16);
    expect(ad.position).to.eql(0);
    var parsedAd = global.vpaidAd.ad.data;
    expect(ad.ad).to.be.an('object');
    expect(ad.videoRestrictions).to.eql({ technology: OO.VIDEO.TECHNOLOGY.HTML5,
      features: [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE] });
    expect(ad.ad.adPodIndex).to.eql(1);
    expect(ad.ad.adPodLength).to.eql(1);
    expect(ad.ad.sequence).to.be(null);
    expect(ad.streams).to.eql({ mp4: '' });
    expect(ad.ad.fallbackAd).to.be(null);
    expect(ad.isLinear).to.be(true);
    expect(ad.ad.data).to.be.an('object');
    expect(ad.ad.data.adType).to.eql('vpaid');
    expect(ad.ad.data.companion[0]).to.be.an('object');
    expect(ad.ad.data.companion).to.eql(parsedAd.companion);
    expect(ad.ad.data.error).to.eql('errorUrl');
    expect(ad.ad.data.impression).to.eql(parsedAd.impression);
    expect(ad.ad.data.linear.mediaFiles).to.eql(parsedAd.linear.mediaFiles);
    expect(ad.ad.data.title).to.eql(parsedAd.title);
    expect(ad.ad.data.tracking).to.eql(parsedAd.tracking);
    expect(ad.ad.data.type).to.eql(parsedAd.type);
    expect(ad.ad.data.version).to.eql(parsedAd.version);
    expect(ad.ad.data.videoClickTracking).to.eql(parsedAd.videoClickTracking);
    expect(ad.ad.data.adParams).to.eql(parsedAd.adParams);
  });

  it('VPAID 2.0: Should create slot and video slot', function() {
    vpaidInitialize();
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(_.isElement(vastAdManager._slot)).to.be(true);
    expect(_.isElement(vastAdManager._videoSlot)).to.be(true);
  });

  it('VPAID 2.0: initAd should be called after validations', function() {
    vpaidInitialize();
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(global.vpaid.adInit).to.be(true)
  });

  it('VPAID 2.0: initAd should not be called when any required ad unit function is missing', function() {
    vpaidInitialize();
    global.vpaid.getVPAIDAd = function() { return new global.vpaid.missingFnVPAIDAd(); };
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(global.vpaid.adInit).to.be(false)
  });

  it('VPAID 2.0: initAd should not be called when using incorrect version <2.0', function() {
    vpaidInitialize();
    global.vpaid.getVPAIDAd = function() { return new global.vpaid.incorrectVersionVPAIDAd(); };
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(global.vpaid.adInit).to.be(false)
  });

  it('VPAID 2.0: Ad should be started', function() {
    var podStartedNotified = 0, linearStartedNotified = 0;
    vpaidInitialize();

    amc.notifyPodStarted = function() {
      podStartedNotified++;
    };

    amc.notifyLinearAdStarted = function() {
      linearStartedNotified++;
    };

    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(global.vpaid.adStarted).to.be(true);
    expect(podStartedNotified).to.eql(1);
    expect(linearStartedNotified).to.eql(1);
  });

  it('VPAID 2.0: Ad should be stopped when ad video is completed', function() {
    var podEndNotified = 0, linearEndNotified = 0;
    vpaidInitialize();

    amc.notifyPodEnded = function() {
      podEndNotified++;
    };

    amc.notifyLinearAdEnded = function() {
      linearEndNotified++;
    };

    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    ad.vpaidAd.adVideoCompleted();
    expect(global.vpaid.adStopped).to.be(true);
    expect(podEndNotified).to.eql(1);
    expect(linearEndNotified).to.eql(1);
  });

  it('VPAID 2.0: Ad should be skipped when calling skipAd', function() {
    var podEndNotified = 0, linearEndNotified = 0;
    vpaidInitialize();

    amc.notifyPodEnded = function() {
      podEndNotified++;
    };

    amc.notifyLinearAdEnded = function() {
      linearEndNotified++;
    };

    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    vastAdManager.cancelAd(ad, {
      code : amc.AD_CANCEL_CODE.SKIPPED
    });
    expect(global.vpaid.adSkipped).to.be(true);
    expect(podEndNotified).to.eql(1);
    expect(linearEndNotified).to.eql(1);

  });

  it('VPAID 2.0: Ad skip button should display when skippableState changes to true, or hide when false', function() {
    var allowSkipButton = false, skipOffset = 0;
    amc.showSkipVideoAdButton = function(allowButton, offset) {
      allowSkipButton = allowButton;
      skipOffset = offset;
    };
    vpaidInitialize();
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();

    ad.vpaidAd.setSkippableState(true);
    expect(allowSkipButton).to.be(true);
    ad.vpaidAd.setSkippableState(false);
    expect(allowSkipButton).to.be(false);
    expect(skipOffset).to.be('0');
  });

  it('VPAID 2.0: Should check and send companion ads', function() {
    var companion;
    var parsedAd = global.vpaidAd.ad.data;
    amc.showCompanion = function(companionAds) {
      companion = companionAds;
    };
    vpaidInitialize();
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(companion).to.eql(parsedAd.companion);
  });

  it('VPAID 2.0: Ad should not end on adVideoEnded', function() {
    var podEndNotified = 0, linearEndNotified = 0;
    vpaidInitialize();

    amc.notifyPodEnded = function() {
      podEndNotified++;
    };

    amc.notifyLinearAdEnded = function() {
      linearEndNotified++;
    };

    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    vastAdManager.adVideoEnded();
    expect(podEndNotified).to.eql(0);
    expect(linearEndNotified).to.eql(0);
  });

  it('VPAID 2.0: Ad Unit should handle clickthru if playerHandles is false, otherwise players handle the click', function() {
    var adUnitHandling = true;
    vpaidInitialize();

    vastAdManager.openUrl = function(url) {
      adUnitHandling = false;
    };

    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    ad.vpaidAd.sendClick(false);
    expect(adUnitHandling).to.be(true);

    ad.vpaidAd.sendClick(true);
    expect(adUnitHandling).to.be(false);
  });

  it('VPAID 2.0: Should notify linear ad started when adLinearChange is sent', function() {
    var linearStartedNotified = 0;
    vpaidInitialize(vpaidNonLinearXML);

    amc.notifyLinearAdStarted = function() {
      linearStartedNotified++;
    };
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    amc.adManagerSettings['linearAdSkipButtonStartTime'] = 5;
    ad.vpaidAd.sendAdLinearChange(false);
    expect(linearStartedNotified).to.eql(0);
    ad.vpaidAd.sendAdLinearChange(true);
    expect(linearStartedNotified).to.eql(1);
  });

  it('VPAID 2.0: Should parse and send ad parameters', function() {
    vpaidInitialize();
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(JSON.parse(ad.ad.adParams)).to.eql(ad.vpaidAd.properties.adParameters);
  });

  it('VPAID 2.0: Should hide player ui', function() {
    var hidePlayerUi = false;
    amc.hidePlayerUi = function() {
      hidePlayerUi = true;
    };
    vpaidInitialize();
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(hidePlayerUi).to.be(true);
  });

  it('VPAID 2.0: Should resize ad unit on size changed', function() {
    vpaidInitialize();
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(ad.vpaidAd.properties.width).to.be(100);
    expect(ad.vpaidAd.properties.height).to.be(100);
    vastAdManager._slot.offsetWidth = 200;
    vastAdManager._slot.offsetHeight = 300;
    amc.publishPlayerEvent(amc.EVENTS.SIZE_CHANGED);
    expect(ad.vpaidAd.properties.width).to.be(200);
    expect(ad.vpaidAd.properties.height).to.be(300);
  });

  it('VPAID 2.0: Should resize ad unit on fullscreen change', function() {
    vpaidInitialize();
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(ad.vpaidAd.properties.width).to.be(100);
    expect(ad.vpaidAd.properties.height).to.be(100);
    vastAdManager._slot.offsetWidth = 200;
    vastAdManager._slot.offsetHeight = 300;
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED);
    expect(ad.vpaidAd.properties.width).to.be(200);
    expect(ad.vpaidAd.properties.height).to.be(300);
  });

  it('VPAID 2.0: Should check/show ad unit companions when no XML companions available', function() {
    var companion;
    amc.showCompanion = function(companionAds) {
      companion = companionAds;
    };
    vpaidInitialize(vpaidNoCompanionXML);
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(companion).to.eql({companion:{}});
  });

  it('VPAID 2.0: should fail if media file value is empty', function() {
    vpaidInitialize(vpaidLinearNoValuesXML);
    var ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    expect(vastAdManager.initializeAd()).to.be(null);
    expect(ad.duration).to.eql(16);
    expect(global.vpaid.adInit).to.be(false);
    expect(global.vpaid.adStarted).to.be(false);
  });

  it('Vast Content Type Filtering: Parser should catch content types for HLS', function() {
    vastAdManager.initialize(amc);
    var vast_ad = {
      type: "vast",
    };

    // catch content-type: application/x-mpegurl
    vastAdManager.onVastResponse(vast_ad, contentTypeHLS1);
    var vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an("object");
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be("application/x-mpegurl");
    expect(vastAd.ad.streams).to.not.be(null);
    expect(vastAd.ad.streams.hls).to.be("1.m3u8");

    amc = new fake_amc();
    vastAdManager.destroy();
    vastAdManager.initialize(amc);

    // catch content-type: application/mpegurl
    vastAdManager.onVastResponse(vast_ad, contentTypeHLS2);
    vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an("object");
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be("application/mpegurl");
    expect(vastAd.ad.streams).to.not.be(null);
    expect(vastAd.ad.streams.hls).to.be("1.m3u8");

    amc = new fake_amc();
    vastAdManager.destroy();
    vastAdManager.initialize(amc);

    // catch content-type: audio/x-mpegurl
    vastAdManager.onVastResponse(vast_ad, contentTypeHLS3);
    vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an("object");
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be("audio/x-mpegurl");
    expect(vastAd.ad.streams).to.not.be(null);
    expect(vastAd.ad.streams.hls).to.be("1.m3u8");

    amc = new fake_amc();
    vastAdManager.destroy();
    vastAdManager.initialize(amc);

    // catch content-type: audio/mpegurl
    vastAdManager.onVastResponse(vast_ad, contentTypeHLS4);
    vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an("object");
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be("audio/mpegurl");
    expect(vastAd.ad.streams).to.not.be(null);
    expect(vastAd.ad.streams.hls).to.be("1.m3u8");
  });

  // Tracking Event Tests

  it('Vast: Linear Creative Tracking Events URLs should be pinged', function() {
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
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad, linearXML);

    var ad = amc.timeline[1];

    // creativeView, impression, and start tracking events
    vastAdManager.playAd(ad);

    var duration = 52;
    var firstQuartileTime = duration / 4;
    var midpointTime = duration / 2;
    var thirdQuartileTime = (3 * duration) / 4;

    // "firstQuartile", "midpoint" and "thirdQuartile" tracking events
    amc.publishPlayerEvent(amc.EVENTS.AD_PLAYHEAD_TIME_CHANGED, firstQuartileTime, duration);
    amc.publishPlayerEvent(amc.EVENTS.AD_PLAYHEAD_TIME_CHANGED, midpointTime, duration);
    amc.publishPlayerEvent(amc.EVENTS.AD_PLAYHEAD_TIME_CHANGED, thirdQuartileTime, duration);

    // ClickTracking event
    vastAdManager.playerClicked(ad, true);

    // "pause" and "resume" tracking events
    vastAdManager.pauseAd(ad);
    vastAdManager.resumeAd(ad);
    vastAdManager.pauseAd(ad);
    vastAdManager.resumeAd(ad);

    // "mute" and "unmute" tracking events
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 1);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0.5);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0.01);

    // "fullscreen" and "exitFullscreen" tracking events
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED, true);
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED, false);
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED, true);
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED, false);

    // "complete" tracking event
    vastAdManager.adVideoEnded();

    // play ad again to test "skip" tracking
    vastAdManager.playAd(ad);

    // "skip" tracking event
    vastAdManager.cancelAd(ad, {
      code : amc.AD_CANCEL_CODE.SKIPPED
    });

    expect(trackingUrlsPinged.startUrl).to.be           (2);
    expect(trackingUrlsPinged.creativeViewUrl).to.be    (2);
    expect(trackingUrlsPinged.impressionUrl).to.be      (2);
    expect(trackingUrlsPinged.firstQuartileUrl).to.be   (1);
    expect(trackingUrlsPinged.midpointUrl).to.be        (1);
    expect(trackingUrlsPinged.thirdQuartileUrl).to.be   (1);
    expect(trackingUrlsPinged.clickTrackingUrl).to.be   (1);
    expect(trackingUrlsPinged.pauseUrl).to.be           (2);
    expect(trackingUrlsPinged.resumeUrl).to.be          (2);
    expect(trackingUrlsPinged.muteUrl).to.be            (2);
    expect(trackingUrlsPinged.unmuteUrl).to.be          (2);
    expect(trackingUrlsPinged.fullscreenUrl).to.be      (2);
    expect(trackingUrlsPinged.exitFullscreenUrl).to.be  (2);
    expect(trackingUrlsPinged.completeUrl).to.be        (1);
    expect(trackingUrlsPinged.skipUrl).to.be            (1);
  });

  it('Vast: Normal VAST Tracking Events should not be pinged if ad is VPAID', function() {
    vpaidInitialize();
    var ad = amc.timeline[1];

    // creativeView, impression, and start tracking events
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();

    var duration = 52;
    var firstQuartileTime = duration / 4;
    var midpointTime = duration / 2;
    var thirdQuartileTime = (3 * duration) / 4;

    // "firstQuartile", "midpoint" and "thirdQuartile" tracking events
    amc.publishPlayerEvent(amc.EVENTS.AD_PLAYHEAD_TIME_CHANGED, firstQuartileTime, duration);
    amc.publishPlayerEvent(amc.EVENTS.AD_PLAYHEAD_TIME_CHANGED, midpointTime, duration);
    amc.publishPlayerEvent(amc.EVENTS.AD_PLAYHEAD_TIME_CHANGED, thirdQuartileTime, duration);

    // ClickTracking event
    vastAdManager.playerClicked(ad, true);

    // "pause" and "resume" tracking events
    vastAdManager.pauseAd(ad);
    vastAdManager.resumeAd(ad);
    vastAdManager.pauseAd(ad);
    vastAdManager.resumeAd(ad);

    // "mute" and "unmute" tracking events
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 1);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0.5);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0);
    amc.publishPlayerEvent(amc.EVENTS.AD_VOLUME_CHANGED, 0.01);

    // "fullscreen" and "exitFullscreen" tracking events
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED, true);
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED, false);
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED, true);
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED, false);

    // "complete" tracking event
    vastAdManager.adVideoEnded();

    // play ad again to test "skip" tracking
    vastAdManager.playAd(ad);

    // "skip" tracking event
    vastAdManager.cancelAd(ad, {
      code : amc.AD_CANCEL_CODE.SKIPPED
    });

    expect(trackingUrlsPinged).to.eql({});
  });

  it('Vast: NonLinear Creative Tracking Events URLs should be pinged', function() {
    var embed_code = "embed_code";
    var vast_ad = {
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
      ads: [vast_ad]
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vast_ad, nonLinearXML);

    var ad = amc.timeline[1];

    // play video once with no player click
    vastAdManager.playAd(ad);
    vastAdManager.adVideoEnded();

    // play video again with player click
    vastAdManager.playAd(ad);
    vastAdManager.playerClicked(ad, true);
    vastAdManager.adVideoEnded();

    // play video again with close button clicked
    vastAdManager.playAd(ad);
    vastAdManager.cancelOverlay();
    vastAdManager.adVideoEnded();

    expect(trackingUrlsPinged.impressionOverlayUrl).to.be       (3);
    expect(trackingUrlsPinged.impressionOverlay2Url).to.be      (3);
    expect(trackingUrlsPinged.impressionOverlay3Url).to.be      (3);
    expect(trackingUrlsPinged.impressionOverlay4Url).to.be      (3);
    expect(trackingUrlsPinged.impressionOverlay5Url).to.be      (3);
    expect(trackingUrlsPinged.impressionOverlay6Url).to.be      (3);
    expect(trackingUrlsPinged.nonLinearClickTrackingUrl).to.be  (1);
    expect(trackingUrlsPinged.closeUrl).to.be                   (1);
  });

  it('VAST: Wrapper ads should be properly parsed into the adTrackingInfo object', function() {
    var embed_code = "embed_code";
    var vast_ad = {
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
      ads: [vast_ad]
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    
    // Wrapper ads could be visualized as a tree with parents and children,
    // but in this case, it looks more like a linked list:
    // wrapper-parent-1 -> wrapper-parent-2 -> 6654644 (Inline Linear Ad)
    var parentDepthOneId = "wrapper-parent-1";
    var parentDepthTwoId = "wrapper-parent-2";
    var leafId = "6654644"; // Ad ID from linearXML file

    // need to fake wrapper ajax calls
    vastAdManager.onVastResponse(vast_ad, wrapper1XML);
    vastAdManager.onVastResponse(vast_ad, wrapper2XML, parentDepthOneId);
    vastAdManager.onVastResponse(vast_ad, linearXML, parentDepthTwoId);
   
    var adTrackingInfo = vastAdManager.adTrackingInfo;

    // adTrackingInfo should have the three ads parsed
    expect(_.keys(adTrackingInfo).length).to.be(3);
    expect(_.has(adTrackingInfo, parentDepthOneId)).to.be(true);
    expect(_.has(adTrackingInfo, parentDepthTwoId)).to.be(true);
    expect(_.has(adTrackingInfo, leafId)).to.be(true);

    var parentDepthOneObject = adTrackingInfo[parentDepthOneId];
    var parentDepthTwoObject = adTrackingInfo[parentDepthTwoId];
    var leafObject = adTrackingInfo[leafId];

    // Ad Tracking Objects should have correct wrapper parent IDs
    expect(parentDepthOneObject.wrapperParentId).to.be(null);
    expect(parentDepthTwoObject.wrapperParentId).to.be(parentDepthOneId);
    expect(leafObject.wrapperParentId).to.be(parentDepthTwoId);

    expect(parentDepthOneObject.vastAdObject).to.not.be(null);
    expect(parentDepthTwoObject.vastAdObject).to.not.be(null);
    expect(leafObject.vastAdObject).to.be(null);
  });

  it('VAST: Wrapper ads\' tracking events should be pinged if child\'s events are pinged', function() {
    var embed_code = "embed_code";
    var vast_ad = {
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
      ads: [vast_ad]
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    
    // Wrapper ads could be visualized as a tree with parents and children,
    // but in this case, it looks more like a linked list:
    // wrapper-parent-1 -> wrapper-parent-2 -> 6654644 (Inline Linear Ad)
    var parentDepthOneId = "wrapper-parent-1";
    var parentDepthTwoId = "wrapper-parent-2";
    var leafId = "6654644"; // Ad ID from linearXML file

    // need to fake wrapper ajax calls
    vastAdManager.onVastResponse(vast_ad, wrapper1XML);
    vastAdManager.onVastResponse(vast_ad, wrapper2XML, parentDepthOneId);
    vastAdManager.onVastResponse(vast_ad, linearXML, parentDepthTwoId);

    var ad = amc.timeline[1];

    // creativeView, impression, and start tracking events
    vastAdManager.playAd(ad);

    // leaf and parent level ad events should be pinged
    expect(trackingUrlsPinged.impressionUrl).to.be(1);
    expect(trackingUrlsPinged.startUrl).to.be(1);
    expect(trackingUrlsPinged.creativeViewUrl).to.be(1);

    expect(trackingUrlsPinged.impressionWrapper2Url).to.be(1);
    expect(trackingUrlsPinged.startWrapper2Url).to.be(1);

    expect(trackingUrlsPinged.impressionWrapper1Url).to.be(1);
    expect(trackingUrlsPinged.startWrapper1Url).to.be(1);
  });

  it('VAST: Wrapper ad requests should not end ad pod until non-wrapper ad is found', function() {
    var embed_code = "embed_code";
    var vast_ad = {
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
      ads: [vast_ad]
    };
    var podEnded = false;
    amc.notifyPodEnded = function(id) {
      podEnded = true;
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    // Wrapper ads could be visualized as a tree with parents and children,
    // but in this case, it looks more like a linked list:
    // wrapper-parent-1 -> wrapper-parent-2 -> 6654644 (Inline Linear Ad)
    var parentDepthOneId = "wrapper-parent-1";
    var parentDepthTwoId = "wrapper-parent-2";
    var leafId = "6654644"; // Ad ID from linearXML file

    var adRequestAd = amc.timeline[0];
    expect(adRequestAd.adType).to.be(amc.ADTYPE.AD_REQUEST);
    vastAdManager.playAd(adRequestAd);

    // need to fake wrapper ajax calls
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vast_ad, wrapper1XML);
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vast_ad, wrapper2XML, parentDepthOneId);
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vast_ad, linearXML, parentDepthTwoId);
    expect(podEnded).to.be(true);
  });

  it('VAST: Wrapper ad requests should end ad pod on vast error', function() {
    var embed_code = "embed_code";
    var vast_ad = {
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
      ads: [vast_ad]
    };
    var podEnded = false;
    amc.notifyPodEnded = function(id) {
      podEnded = true;
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    // Wrapper ads could be visualized as a tree with parents and children,
    // but in this case, it looks more like a linked list:
    // wrapper-parent-1 -> wrapper-parent-2 -> 6654644 (Inline Linear Ad)
    var parentDepthOneId = "wrapper-parent-1";
    var parentDepthTwoId = "wrapper-parent-2";
    var leafId = "6654644"; // Ad ID from linearXML file

    var adRequestAd = amc.timeline[0];
    expect(adRequestAd.adType).to.be(amc.ADTYPE.AD_REQUEST);
    vastAdManager.playAd(adRequestAd);

    // need to fake wrapper ajax calls
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vast_ad, wrapper1XML);
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vast_ad,'asdf');
    expect(errorType.length > 0).to.be(true);
    expect(podEnded).to.be(true);
  });
});
