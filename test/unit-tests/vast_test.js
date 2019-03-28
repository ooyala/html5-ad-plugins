/*
 * Unit test class for the Vast Ad Manager
 * https://github.com/Automattic/expect.js
 */

// stubs
OO.log = function () {};
require(`${COMMON_SRC_ROOT}utils/utils.js`);
require(`${COMMON_SRC_ROOT}utils/environment.js`);
require(`${COMMON_SRC_ROOT}classes/emitter.js`);

const sinon = require('sinon');
const fs = require('fs');

describe('ad_manager_vast', function () {
  let amc;
  let vastAdManager;
  const nameVast = 'vast';
  const originalOoAds = _.clone(OO.Ads);
  require(`${TEST_ROOT}unit-test-helpers/mock_amc.js`);
  require(`${TEST_ROOT}unit-test-helpers/mock_vpaid.js`);

  /* eslint-disable max-len */
  const linearXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_linear.xml'), 'utf8');
  const linearXMLNoClickthroughString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_linear_no_clickthrough.xml'), 'utf8');
  const linearXML2AdsString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_linear_2_ads.xml'), 'utf8');
  const linear30XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_3_0_linear.xml'), 'utf8');
  const linear30PoddedXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_3_0_inline_podded.xml'), 'utf8');
  const linear30MissingMediaFilesString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_3_0_missing_media_files.xml'), 'utf8');
  const nonLinearXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_overlay.xml'), 'utf8');
  const nonLinearXMLMissingURLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_overlay_missing_url.xml'), 'utf8');
  const wrapper1XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_wrapper_1.xml'), 'utf8');
  const wrapper2XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_wrapper_2.xml'), 'utf8');
  const vmapAdTagPreXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vmap_adtag_pre.xml'), 'utf8');
  const vmapInlinePreAdTagPostXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vmap_inline_pre_adtag_post.xml'), 'utf8');
  const vmapInlineRepeatAdXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vmap_inline_repeatad.xml'), 'utf8');
  const vmapInlineRepeatAdBadInput1XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vmap_inline_repeatad_bad_input1.xml'), 'utf8');
  const vmapInlineRepeatAdBadInput2XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vmap_inline_repeatad_bad_input2.xml'), 'utf8');
  const vmapInlinePoddedXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vmap_inline_podded.xml'), 'utf8');
  const vpaidLinearXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vpaid_linear.xml'), 'utf8');
  const vpaidLinearNoValuesXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vpaid_linear_novalues.xml'), 'utf8');
  const vpaidNonLinearXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vpaid_nonlinear.xml'), 'utf8');
  const vpaidNoCompanionXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vpaid_linear_nocompanions.xml'), 'utf8');
  const contentTypeHLS1XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_content_type_HLS_1.xml'), 'utf8');
  const contentTypeHLS2XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_content_type_HLS_2.xml'), 'utf8');
  const contentTypeHLS3XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_content_type_HLS_3.xml'), 'utf8');
  const contentTypeHLS4XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_content_type_HLS_4.xml'), 'utf8');
  /* eslint-enable max-len */

  const linearXML = $.parseXML(linearXMLString);
  const linearNoClickthroughXML = $.parseXML(linearXMLNoClickthroughString);
  const linearXML2Ads = $.parseXML(linearXML2AdsString);
  const linear30XML = $.parseXML(linear30XMLString);
  const linear30XMLPodded = $.parseXML(linear30PoddedXMLString);
  const linear30MissingMediaFiles = $.parseXML(linear30MissingMediaFilesString);
  const nonLinearXML = $.parseXML(nonLinearXMLString);
  const nonLinearXMLMissingURL = $.parseXML(nonLinearXMLMissingURLString);
  const vmapAdTagPre = $.parseXML(vmapAdTagPreXMLString);
  const vmapInlinePreAdTagPost = $.parseXML(vmapInlinePreAdTagPostXMLString);
  const vmapInlinePodded = $.parseXML(vmapInlinePoddedXMLString);
  const vmapInlineRepeatAd = $.parseXML(vmapInlineRepeatAdXMLString);
  const vmapInlineRepeatAdBadInput1 = $.parseXML(vmapInlineRepeatAdBadInput1XMLString);
  const vmapInlineRepeatAdBadInput2 = $.parseXML(vmapInlineRepeatAdBadInput2XMLString);
  const vpaidLinearXML = $.parseXML(vpaidLinearXMLString);
  const vpaidLinearNoValuesXML = $.parseXML(vpaidLinearNoValuesXMLString);
  const vpaidNonLinearXML = $.parseXML(vpaidNonLinearXMLString);
  const vpaidNoCompanionXML = $.parseXML(vpaidNoCompanionXMLString);
  const contentTypeHLS1 = $.parseXML(contentTypeHLS1XMLString);
  const contentTypeHLS2 = $.parseXML(contentTypeHLS2XMLString);
  const contentTypeHLS3 = $.parseXML(contentTypeHLS3XMLString);
  const contentTypeHLS4 = $.parseXML(contentTypeHLS4XMLString);

  const wrapper1XML = $.parseXML(wrapper1XMLString);
  const wrapper2XML = $.parseXML(wrapper2XMLString);
  const playerParamWrapperDepth = OO.playerParams.maxVastWrapperDepth;
  let errorType = [];
  let adsClickthroughOpenedCalled = 0;

  const initialPlay = function () {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
  };

  const vpaidInitialize = function (xml) {
    const embedCode = 'embed_code';
    const preroll = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
      position: 0,
      url: 'http://blahurl',
    };
    const content = {
      embed_code: embedCode,
      ads: [preroll],
    };
    const server = {
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata(server, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    const xmlNew = xml || vpaidLinearXML;
    vastAdManager.onVastResponse(preroll, xmlNew);
  };

  before(_.bind(() => {
    OO.Ads = {
      manager(adManager) {
        vastAdManager = adManager(_, $);
        vastAdManager.testMode = true;
      },
    };
    delete require.cache[require.resolve(`${SRC_ROOT}ad_manager_vast.js`)];
    require(`${SRC_ROOT}ad_manager_vast.js`);

    const originalTrackError = _.bind(vastAdManager.trackError, vastAdManager);

    // mock trackError function to test error tracking
    vastAdManager.trackError = function (code, currentAdId) {
      errorType.push(code);
      if (typeof originalTrackError === 'function') {
        originalTrackError(code, currentAdId);
      }
    };
  }, this));

  after(() => {
    OO.Ads = originalOoAds;
  });

  beforeEach(() => {
    amc = new FakeAmc();
    amc.adManagerList = [];
    amc.onAdManagerReady = function () {
      this.timeline = this.adManagerList[0].buildTimeline();
    };
    amc.adManagerList.push(vastAdManager);
    OO.playerParams.maxVastWrapperDepth = 2;
    errorType = [];
    vastAdManager.adTrackingInfo = {};
    vastAdManager.adBreaks = [];
    adsClickthroughOpenedCalled = 0;

    OO.pixelPing = sinon.spy();

    // VPAID specifics
    global.vpaid.adInit = false;
    global.vpaid.adStarted = false;
    global.vpaid.adStopped = false;
    global.vpaid.adSkipped = false;
    global.vpaid.getVPAIDAd = function () {
      return new global.vpaid.VpaidAd();
    };

    window.open = () => ({});
  });

  afterEach(_.bind(() => {
    amc.timeline = [];
    vastAdManager.destroy();
    OO.playerParams.maxVastWrapperDepth = playerParamWrapperDepth;
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', () => {
    expect(typeof amc).to.be('object');
  });

  it('Init: ad manager is registered', () => {
    expect(vastAdManager).to.not.be(null);
  });

  it('Init: ad manager has the expected name', () => {
    expect(vastAdManager.name).to.be(nameVast);
  });

  it('Init: ad manager handles the initialize function', () => {
    expect(() => {
      vastAdManager.initialize(amc);
    }).to.not.throwException();
  });

  it('Init: ad manager notifies amc after loading metadata', () => {
    amc.onAdManagerReady = sinon.spy();
    amc.reportPluginLoaded = sinon.spy();

    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };

    const movieMetadata = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    const pbMetadata = {
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata(pbMetadata, null, movieMetadata);
    expect(vastAdManager.ready).to.be(true);

    sinon.assert.calledOnce(amc.onAdManagerReady);
    sinon.assert.calledWith(amc.onAdManagerReady, true);

    // TODO: mock Date to always return the same value
    sinon.assert.calledOnce(amc.reportPluginLoaded);
    const reportPluginLoadedCalls = amc.reportPluginLoaded.getCall(0);
    expect(reportPluginLoadedCalls.args[0]).to.be.a('number');
    expect(reportPluginLoadedCalls.args[1]).to.eql('vast');
  });

  it('Init: ad manager is ready', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    vastAdManager.initialize(amc);
    expect(vastAdManager.ready).to.be(false);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    expect(vastAdManager.ready).to.be(true);
  });

  it('Init: preroll returned in buildTimeline()', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
      url: 'http://blahurl',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    const { timeline } = amc;
    expect(timeline.length).to.be(1);
    expect(timeline[0].position).to.be(0);
    expect(timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
  });

  it('Init: test midroll return in buildTimeline', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10000,
      position_type: 't',
      url: 'http://blahurl',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    const { timeline } = amc;
    expect(timeline.length).to.be(1);
    expect(timeline[0].position).to.be(10);
    expect(timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
  });

  it('Init: test preroll and midroll appear in buildTimeline() and prerolls loads on initialPlay', () => {
    const embedCode = 'embed_code';
    const vastAdPre = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
      url: '0.mp4',
    };
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdPre, vastAdMid],
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);

    // vastAdManager.onVastResponse(vastAdPre, linearXML);
    expect(errorType.length).to.be(0);
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
    expect(amc.timeline[1].adType).to.be(amc.ADTYPE.AD_REQUEST);

    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdPre, linearXML);
    expect(errorType.length).to.be(0);
    // test that real ad gets added to timeline when it's loaded.
    expect(amc.timeline.length).to.be(3);
    // test assumes the timeline isn't being sorted by the amc. If that changes, this will need to change accordingly.
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
    expect(amc.timeline[1].adType).to.be(amc.ADTYPE.AD_REQUEST);
    expect(amc.timeline[2].adType).to.be(amc.ADTYPE.LINEAR_VIDEO);
    expect(amc.timeline[2].ad.type).to.be(undefined);
  });

  it('Init: test postroll appears in buildTimeline', () => {
    const embedCode = 'embed_code';
    const vastAdPost = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 1000000000,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdPost],
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
  });

  it('should invalid vast', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    expect(amc.timeline.length).to.be(1);

    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAd, '<VAST></VAST>');

    expect(errorType.length > 0).to.be(true);
    expect(amc.timeline.length).to.be(1);
    errorType = [];

    vastAdManager.onVastResponse(null, linearXML);
    expect(errorType.length > 0).to.be(true);
    expect(amc.timeline.length).to.be(1);
    errorType = [];

    vastAdManager.onVastResponse(vastAd, '<VAST version="2.1"></VAST>');
    expect(errorType.length > 0).to.be(true);
    expect(amc.timeline.length).to.be(1);
    errorType = [];

    vastAdManager.onVastResponse(null, '<VAST version="2.0"></VAST>');
    expect(errorType.length > 0).to.be(true);
    expect(amc.timeline.length).to.be(1);
  });

  it('should parse inline linear ads', () => {
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, linearXML);

    expect(errorType.length).to.be(0);
    const vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.videoRestrictions).to.be(undefined);
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionUrl']);
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

  it('should parse inline non linear ads', () => {
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, nonLinearXML);
    expect(errorType.length).to.be(0);
    const vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql([]);
    expect(vastAd.ad.data.impression).to.eql(['impressionOverlayUrl', 'impressionOverlay2Url',
      'impressionOverlay3Url', 'impressionOverlay4Url', 'impressionOverlay5Url',
      'impressionOverlay6Url']);
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

  // TODO: Fix wrapper ads test
  // it('should parse wrapper ads', function(){
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
  // });
  // TODO: Need to cover overlays and companions once v4 is integrated.

  // Vast 3.0 Tests

  // Skip Ad functionality
  it('Vast 3.0: should provide skip ad parameters to AMC on playAd', () => {
    let allowSkipButton = false;
    let skipOffset = 0;
    amc.showSkipVideoAdButton = function (allowButton, offset) {
      allowSkipButton = allowButton;
      skipOffset = offset;
    };
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, linear30XML);
    expect(errorType.length).to.be(0);
    const vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(allowSkipButton).to.be(true);
    // value in MS. vast_3_0_linear.xml mock response has value of 00:00:05, which is 5 seconds
    expect(skipOffset).to.be('5');
  });

  it('Vast 2.0: should not provide skip ad parameters to AMC on playAd', () => {
    let allowSkipButton = false;
    let skipOffset = 0;
    amc.showSkipVideoAdButton = function (allowButton, offset) {
      allowSkipButton = allowButton;
      skipOffset = offset;
    };
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, linearXML);
    expect(errorType.length).to.be(0);
    const vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(allowSkipButton).to.be(true);
    expect(skipOffset).to.be(undefined);
  });

  // TODO: Unit test for testing skipoffset with percentage value

  it('Vast 2.0: should provide ad pod position and length of 1 to AMC on playAd', () => {
    let adPodLength = -1;
    let indexInPod = -1;
    let adPodStartedCalled = 0;
    amc.notifyPodStarted = function (id, podLength) {
      adPodStartedCalled += 1;
      adPodLength = podLength;
    };
    amc.notifyLinearAdStarted = function (name, props) {
      if (props) {
        // eslint-disable-next-line prefer-destructuring
        indexInPod = props.indexInPod;
      }
    };

    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    expect(adPodStartedCalled).to.be(0);
    vastAdManager.onResponse('', vastAdMid, linearXML);
    expect(adPodStartedCalled).to.be(1);
    expect(errorType.length).to.be(0);
    const vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(1);
    expect(indexInPod).to.be(1);
  });

  it('Vast 2.0: should open clickthrough url if player is clicked', () => {
    // Vast Ad Manager regularly calls window.open here.
    // Will instead track what we are trying to open
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, linearXML);
    expect(errorType.length).to.be(0);
    const vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    vastAdManager.playerClicked(vastAd, true);
    // 1 clickthrough url is defined in vast_linear.xml
    sinon.mock(window).expects('open').once();
    sinon.assert.calledOnce(amc.adsClickthroughOpened);
  });

  it('Vast 2.0: should not open a clickthrough url if one is not defined', () => {
    // Vast Ad Manager regularly calls window.open here.
    // Will instead track what we are trying to open
    const openedUrls = [];
    vastAdManager.openUrl = function (url) {
      if (url) {
        openedUrls.push(url);
        return true;
      }
      return false;
    };
    amc.adsClickthroughOpened = function () {
      adsClickthroughOpenedCalled += 1;
    };
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, linearNoClickthroughXML);
    expect(errorType.length).to.be(0);
    const vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    vastAdManager.playerClicked(vastAd, true);
    expect(openedUrls.length).to.be(0);
    expect(adsClickthroughOpenedCalled).to.be(0);
  });

  it('Vast 2.0: should play multiple ads if multiple ads are defined', () => {
    const adQueue = [];
    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      const adData = {
        adManager,
        adType,
        ad,
        streams,
        position: -1, // we want it to play immediately
      };
      const newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    vastAdManager.onVastResponse(vastAdMid, linearXML2Ads);
    expect(errorType.length).to.be(0);
    let vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654644');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    [vastAd] = adQueue;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654645');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
  });

  it('Vast 3.0: should parse inline linear podded ads', () => {
    const adQueue = [];
    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      const adData = {
        adManager,
        adType,
        ad,
        streams,
        position: -1, // we want it to play immediately
      };
      const newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    vastAdManager.onVastResponse(vastAdMid, linear30XMLPodded);
    expect(errorType.length).to.be(0);
    let vastAd = amc.timeline[1];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654646');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    [vastAd] = adQueue;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654645');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    [, vastAd] = adQueue;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654644');
    vastAdManager.playAd(vastAd);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
  });

  it('Vast 3.0: should provide proper ad pod positions and length to AMC on playAd', () => {
    let adPodLength = -1;
    let indexInPod = -1;
    const adQueue = [];

    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      const adData = {
        adManager,
        adType,
        ad,
        streams,
        position: -1, // we want it to play immediately
      };
      const newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    amc.notifyPodStarted = function (id, podLength) {
      adPodLength = podLength;
    };
    amc.notifyLinearAdStarted = function (name, props) {
      if (props) {
        // eslint-disable-next-line prefer-destructuring
        indexInPod = props.indexInPod;
      }
    };
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    vastAdManager.onVastResponse(vastAdMid, linear30XMLPodded);
    expect(errorType.length).to.be(0);

    let vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(1);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    [vastAd] = adQueue;
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(2);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
    [, vastAd] = adQueue;
    vastAdManager.playAd(vastAd);
    expect(adPodLength).to.be(3);
    expect(indexInPod).to.be(3);

    vastAdManager.adVideoPlaying();
    vastAdManager.adVideoEnded();
  });

  it('Vast 3.0: AMC is notified of linear/nonlinear ad start/end and pod start/end', () => {
    let nonLinearStartNotified = 0;
    let podStartNotified = 0;
    let podEndNotified = 0;
    let linearStartNotified = 0;
    let linearEndNotified = 0;
    const adQueue = [];

    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      const adData = {
        adManager,
        adType,
        ad,
        streams,
        position: -1, // we want it to play immediately
      };
      const newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    amc.notifyPodStarted = function () {
      podStartNotified += 1;
    };
    amc.notifyPodEnded = function () {
      podEndNotified += 1;
    };
    amc.notifyLinearAdStarted = function () {
      linearStartNotified += 1;
    };
    amc.notifyLinearAdEnded = function () {
      linearEndNotified += 1;
    };
    amc.sendURLToLoadAndPlayNonLinearAd = function () {
      nonLinearStartNotified += 1;
    };
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    vastAdManager.onVastResponse(vastAdMid, linear30XMLPodded);
    expect(errorType.length).to.be(0);

    let vastAd = amc.timeline[1];
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

    [vastAd] = adQueue;
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

    [, vastAd] = adQueue;
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

    // overlay
    [, , vastAd] = adQueue;
    vastAdManager.playAd(vastAd);
    expect(podStartNotified).to.be(1);
    expect(podEndNotified).to.be(1);
    expect(linearStartNotified).to.be(3);
    expect(linearEndNotified).to.be(3);
    expect(nonLinearStartNotified).to.be(1);
  });

  it('Vast 3.0: On ad timeout, fallback ad will be shown', () => {
    const adQueue = [];

    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      const adData = {
        adManager,
        adType,
        ad,
        streams,
        position: -1, // we want it to play immediately
      };
      const newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    amc.notifyPodStarted = function () {};
    amc.notifyPodEnded = function () {};
    amc.notifyLinearAdStarted = function () {};
    amc.notifyLinearAdEnded = function () {};
    amc.sendURLToLoadAndPlayNonLinearAd = function () {};
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, linear30XMLPodded);
    expect(errorType.length).to.be(0);

    let vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654646');

    vastAdManager.cancelAd(vastAd, {
      code: amc.AD_CANCEL_CODE.TIMEOUT,
    });
    [vastAd] = adQueue;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654600');
  });

  it('Vast 3.0: On ad playback error, fallback ad will be shown', () => {
    const adQueue = [];

    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      const adData = {
        adManager,
        adType,
        ad,
        streams,
        position: -1, // we want it to play immediately
      };
      const newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    amc.notifyPodStarted = function () {};
    amc.notifyPodEnded = function () {};
    amc.notifyLinearAdStarted = function () {};
    amc.notifyLinearAdEnded = function () {};
    amc.sendURLToLoadAndPlayNonLinearAd = function () {};
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, linear30XMLPodded);
    expect(errorType.length).to.be(0);

    let vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654646');

    vastAdManager.adVideoError();
    [vastAd] = adQueue;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.id).to.be('6654600');
  });

  it('Vast 3.0, Error Reporting: adTrackingInfo should parse the correct number of errorURLs and ads', () => {
    let jqueryAds = $(linearXML).find('Ad');
    vastAdManager.getErrorTrackingInfo(linearXML, jqueryAds);
    // should have one ad
    let adIDs = _.keys(vastAdManager.adTrackingInfo);
    expect(adIDs.length).to.be(1);
    // should have only one errorurl
    let adErrorInfo = vastAdManager.adTrackingInfo[adIDs[0]];
    expect(adErrorInfo.errorURLs.length).to.be(1);
    vastAdManager.adTrackingInfo = {};

    jqueryAds = $(nonLinearXML).find('Ad');
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

  it('Vast 3.0, Error Reporting: should report XML parsing error', () => {
    const vastAdRequest = {
      adManager: 'vast',
      ad: {
        type: vastAdManager.AD_REQUEST_TYPE,
        url: '1.jpg',
      },
    };

    vastAdManager.initialize(amc);
    vastAdManager.playAd(new amc.Ad(vastAdRequest));
    vastAdManager.onVastResponse(null, linearXML);
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.XML_PARSING)).to.be(true);
    errorType = [];

    vastAdManager.onVastResponse(null, nonLinearXML);
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.XML_PARSING)).to.be(true);
  });

  it('Vast 3.0, Error Reporting: Should report unsupported vast version error', () => {
    vastAdManager.initialize(amc);

    vastAdManager.isValidVastVersion('');
    expect(_.contains(errorType, vastAdManager.ERROR_CODES.VERSION_UNSUPPORTED)).to.be(true);
  });

  it('Vast 3.0, Error Reporting: Should report schema validation error', () => {
    vastAdManager.initialize(amc);

    vastAdManager.isValidRootTagName('');
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

  it('Vast 3.0, Error Reporting: Should report general linear ads error', () => {
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    vastAdManager.initialize(amc);

    // setup parameters so nonlinear ad fails because there are no mediaFiles in XML
    // but still pings error url if there is an error tag
    vastAdManager.adTrackingInfo = {
      linearAd1: {},
    };

    vastAdManager.onVastResponse(vastAdMid, linear30MissingMediaFiles);
    sinon.assert.calledOnce(OO.pixelPing);
    sinon.assert.calledWith(OO.pixelPing, 'errorurl');
  });

  it('Vast 3.0, Error Reporting: Should report general nonlinear ads error', () => {
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    vastAdManager.initialize(amc);

    // setup parameters so nonlinear ad fails because there is no ad url
    // but still pings error url if there is an error tag
    vastAdManager.adTrackingInfo = {
      nonLinearAd1: {},
    };

    vastAdManager.onVastResponse(vastAdMid, nonLinearXMLMissingURL);
    sinon.assert.calledOnce(OO.pixelPing);
    sinon.assert.calledWith(OO.pixelPing, 'errorurl');
  });

  it('Vast 3.0, VMAP: Should call onVMAPResponse if there is a VMAP XML response', () => {
    let onVMAPResponseCalled = false;
    let onVastResponseCalled = false;

    vastAdManager.onResponse = function (adLoaded, xml) {
      const jqueryXML = $(xml);
      const vmap = jqueryXML.find('vmap\\:VMAP, VMAP');
      if (vmap.length > 0) {
        onVMAPResponseCalled = true;
      } else {
        onVastResponseCalled = true;
      }
    };

    vastAdManager.onResponse(null, vmapAdTagPre);
    expect(onVMAPResponseCalled).to.be(true);
    expect(onVastResponseCalled).to.be(false);
  });

  it('Vast 3.0, VMAP, AdTag Pre-roll: Should parse AdTagURI and TrackingEvents properly', () => {
    vastAdManager.onVMAPResponse(vmapAdTagPre);
    const { adBreaks } = vastAdManager;
    expect(adBreaks.length).to.be(1);

    const adBreak = adBreaks[0];
    expect(adBreak.timeOffset).to.be('start');
    expect(adBreak.breakType).to.be('linear');
    expect(adBreak.breakId).to.be('preroll');

    expect(adBreak.adSource).not.to.be(null);

    const { adSource } = adBreak;
    expect(adSource.id).to.be('preroll-ad-1');
    expect(adSource.allowMultipleAds).to.be('false');
    expect(adSource.followRedirects).to.be('true');
    expect(adSource.adTagURI).to.be('adTagURI');

    const { trackingEvents } = adBreak;
    expect(trackingEvents[0].eventName).to.be('breakStart');
    expect(trackingEvents[1].eventName).to.be('error');
    expect(trackingEvents[0].url).to.be('trackingURL');
    expect(trackingEvents[1].url).to.be('errorURL');
  });

  it(`Vast 3.0, VMAP, Inline Pre-roll Overlay,
    Post-roll: Should parse overlay and post-roll properly`, () => {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlinePreAdTagPost);
    const { adBreaks } = vastAdManager;
    expect(adBreaks.length).to.be(2);

    const prerollAdBreak = adBreaks[0];
    expect(prerollAdBreak.timeOffset).to.be('start');
    expect(prerollAdBreak.breakType).to.be('linear');
    expect(prerollAdBreak.breakId).to.be('preroll');

    expect(prerollAdBreak.adSource).not.to.be(null);

    const prerollAdSource = prerollAdBreak.adSource;
    expect(prerollAdSource.id).to.be('preroll-ad-1');
    expect(prerollAdSource.allowMultipleAds).to.be('true');
    expect(prerollAdSource.followRedirects).to.be('true');
    expect(prerollAdSource.adTagURI).to.be(undefined);
    expect(prerollAdSource.VASTAdData).not.to.be(null);

    const { trackingEvents } = prerollAdBreak;
    expect(trackingEvents[0].eventName).to.be('breakStart');
    expect(trackingEvents[1].eventName).to.be('error');
    expect(trackingEvents[0].url).to.be('trackingURL');
    expect(trackingEvents[1].url).to.be('errorURL');

    const vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['Error URL']);
    expect(vastAd.ad.data.impression).to.eql(['Impression']);
    expect(vastAd.ad.data.nonLinear).not.to.be(null);
    expect(vastAd.ad.data.linear).to.eql({});
    expect(vastAd.ad.data.nonLinear.width).to.be('480');
    expect(vastAd.ad.data.nonLinear.height).to.be('70');
    expect(vastAd.ad.data.nonLinear.minSuggestedDuration).to.be('00:00:05');
    expect(vastAd.ad.data.nonLinear.scalable).to.be('true');
    expect(vastAd.ad.data.nonLinear.maintainAspectRatio).to.be('true');
    expect(vastAd.ad.data.nonLinear.nonLinearClickThrough).to.be('nonLinearClickThroughURL');
    expect(vastAd.ad.data.nonLinear.type).to.be('static');
    expect(vastAd.ad.data.nonLinear.data).to.be('staticResourceURL');
    expect(vastAd.ad.data.nonLinear.url).to.be('staticResourceURL');
    expect(vastAd.ad.data.nonLinear.tracking.start).to.eql(['startEventURL']);
    expect(vastAd.ad.data.nonLinear.tracking.firstQuartile).to.eql(['firstQuartileEventURL']);
    expect(vastAd.ad.data.nonLinear.tracking.midpoint).to.eql(['midpointEventURL']);

    const postrollAdBreak = adBreaks[1];
    expect(postrollAdBreak.timeOffset).to.be('end');
    expect(postrollAdBreak.breakType).to.be('linear');
    expect(postrollAdBreak.breakId).to.be('postroll');

    expect(postrollAdBreak.adSource).not.to.be(null);

    const postrollAdSource = postrollAdBreak.adSource;
    expect(postrollAdSource.id).to.be('postroll-ad-1');
    expect(postrollAdSource.allowMultipleAds).to.be('false');
    expect(postrollAdSource.followRedirects).to.be('true');
    expect(postrollAdSource.adTagURI).to.be('adTagURI');
  });

  it('Vast 3.0, VMAP: Should parse AdBreak with repeatAfter attribute properly', () => {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlineRepeatAd);
    const { adBreaks } = vastAdManager;
    expect(adBreaks.length).to.be(3);

    const firstRepeatAdBreak = adBreaks[0];
    expect(firstRepeatAdBreak.timeOffset).to.be('start');
    expect(firstRepeatAdBreak.breakType).to.be('linear');
    expect(firstRepeatAdBreak.breakId).to.be('repeat');
    expect(firstRepeatAdBreak.repeatAfter).to.be('00:00:05');

    expect(firstRepeatAdBreak.adSource).not.to.be(null);

    const firstRepeatAdSource = firstRepeatAdBreak.adSource;
    expect(firstRepeatAdSource.id).to.be('repeat-ad-1');
    expect(firstRepeatAdSource.allowMultipleAds).to.be('true');
    expect(firstRepeatAdSource.followRedirects).to.be('true');
    expect(firstRepeatAdSource.adTagURI).to.be(undefined);
    expect(firstRepeatAdSource.VASTAdData).not.to.be(null);

    let [trackingEvents0, trackingEvents1] = firstRepeatAdBreak.trackingEvents;
    expect(trackingEvents0.eventName).to.be('breakStart');
    expect(trackingEvents1.eventName).to.be('error');
    expect(trackingEvents0.url).to.be('trackingurl1');
    expect(trackingEvents1.url).to.be('errorurl1');

    let vastAd = amc.timeline[0];
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl1']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl1']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.linear.duration).to.eql('00:00:52');
    expect(vastAd.ad.data.linear.skipOffset).to.be('00:00:05');
    expect(vastAd.ad.data.linear.tracking.start).to.eql(['starturl1']);
    expect(vastAd.ad.data.linear.tracking.firstQuartile).to.eql(['firstquartileurl1']);
    expect(vastAd.ad.data.linear.tracking.midpoint).to.eql(['midpointurl1']);
    expect(vastAd.ad.data.linear.clickThrough).to.eql('clickthroughurl1');
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].id).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].delivery).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].bitrate).to.be('330');
    expect(vastAd.ad.data.linear.mediaFiles[0].width).to.be('640');
    expect(vastAd.ad.data.linear.mediaFiles[0].height).to.be('360');
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be('video/mp4');
    expect(vastAd.ad.data.linear.mediaFiles[0].scalable).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].maintainAspectRatio).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].url).to.be('1.mp4');
    expect(vastAd.ad.repeatAfter).to.be(5);

    const secondRepeatAdBreak = adBreaks[1];
    expect(secondRepeatAdBreak.timeOffset).to.be('start');
    expect(secondRepeatAdBreak.breakType).to.be('linear');
    expect(secondRepeatAdBreak.breakId).to.be('repeat');
    expect(secondRepeatAdBreak.repeatAfter).to.be('00:00:10');

    expect(secondRepeatAdBreak.adSource).not.to.be(null);

    const secondRepeatAdSource = secondRepeatAdBreak.adSource;
    expect(secondRepeatAdSource.id).to.be('repeat-ad-2');
    expect(secondRepeatAdSource.allowMultipleAds).to.be('true');
    expect(secondRepeatAdSource.followRedirects).to.be('true');
    expect(secondRepeatAdSource.adTagURI).to.be(undefined);
    expect(secondRepeatAdSource.VASTAdData).not.to.be(null);

    [trackingEvents0, trackingEvents1] = secondRepeatAdBreak.trackingEvents;
    expect(trackingEvents0.eventName).to.be('breakStart');
    expect(trackingEvents1.eventName).to.be('error');
    expect(trackingEvents0.url).to.be('trackingurl2');
    expect(trackingEvents1.url).to.be('errorurl2');

    [, vastAd] = amc.timeline;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl2']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl2']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.linear.duration).to.eql('00:00:52');
    expect(vastAd.ad.data.linear.skipOffset).to.be('00:00:05');
    expect(vastAd.ad.data.linear.tracking.start).to.eql(['starturl2']);
    expect(vastAd.ad.data.linear.tracking.firstQuartile).to.eql(['firstquartileurl2']);
    expect(vastAd.ad.data.linear.tracking.midpoint).to.eql(['midpointurl2']);
    expect(vastAd.ad.data.linear.clickThrough).to.eql('clickthroughurl2');
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].id).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].delivery).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].bitrate).to.be('330');
    expect(vastAd.ad.data.linear.mediaFiles[0].width).to.be('640');
    expect(vastAd.ad.data.linear.mediaFiles[0].height).to.be('360');
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be('video/mp4');
    expect(vastAd.ad.data.linear.mediaFiles[0].scalable).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].maintainAspectRatio).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].url).to.be('1.mp4');
    expect(vastAd.ad.repeatAfter).to.be(10);

    const thirdAdBreak = adBreaks[2];
    expect(thirdAdBreak.timeOffset).to.be('00:00:15');
    expect(thirdAdBreak.breakType).to.be('linear');
    expect(thirdAdBreak.breakId).to.be('midroll');
    expect(thirdAdBreak.repeatAfter).to.be(undefined);

    expect(thirdAdBreak.adSource).not.to.be(null);

    const thirdAdSource = thirdAdBreak.adSource;
    expect(thirdAdSource.id).to.be('midroll-ad-1');
    expect(thirdAdSource.allowMultipleAds).to.be('false');
    expect(thirdAdSource.followRedirects).to.be('false');
    expect(thirdAdSource.adTagURI).to.be(undefined);
    expect(thirdAdSource.VASTAdData).not.to.be(null);

    [trackingEvents0, trackingEvents1] = thirdAdBreak.trackingEvents;
    expect(trackingEvents0.eventName).to.be('breakStart');
    expect(trackingEvents1.eventName).to.be('error');
    expect(trackingEvents0.url).to.be('trackingurl3');
    expect(trackingEvents1.url).to.be('errorurl3');

    [, , vastAd] = amc.timeline;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.error).to.eql(['errorurl3']);
    expect(vastAd.ad.data.impression).to.eql(['impressionurl3']);
    expect(vastAd.ad.data.linear).not.to.be(null);
    expect(vastAd.ad.data.linear.duration).to.eql('00:00:52');
    expect(vastAd.ad.data.linear.skipOffset).to.be('00:00:05');
    expect(vastAd.ad.data.linear.tracking.start).to.eql(['starturl3']);
    expect(vastAd.ad.data.linear.tracking.firstQuartile).to.eql(['firstquartileurl3']);
    expect(vastAd.ad.data.linear.tracking.midpoint).to.eql(['midpointurl3']);
    expect(vastAd.ad.data.linear.clickThrough).to.eql('clickthroughurl3');
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].id).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].delivery).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].bitrate).to.be('330');
    expect(vastAd.ad.data.linear.mediaFiles[0].width).to.be('640');
    expect(vastAd.ad.data.linear.mediaFiles[0].height).to.be('360');
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be('video/mp4');
    expect(vastAd.ad.data.linear.mediaFiles[0].scalable).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].maintainAspectRatio).to.be(undefined);
    expect(vastAd.ad.data.linear.mediaFiles[0].url).to.be('1.mp4');
    expect(vastAd.ad.repeatAfter).to.be(null);
  });

  it('Vast 3.0, VMAP: Should parse AdBreak with bad repeat inputs - 1', () => {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlineRepeatAdBadInput1);
    const { adBreaks } = vastAdManager;

    const firstRepeatAdBreak = adBreaks[0];
    expect(firstRepeatAdBreak.repeatAfter).to.be('00:00:');

    let vastAd = amc.timeline[0];
    expect(vastAd.ad.repeatAfter).to.be(null);

    const secondRepeatAdBreak = adBreaks[1];
    expect(secondRepeatAdBreak.repeatAfter).to.be('1337');

    [, vastAd] = amc.timeline;
    expect(vastAd.ad.repeatAfter).to.be(null);
  });

  it('Vast 3.0, VMAP: Should parse AdBreak with bad repeat inputs - 2', () => {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlineRepeatAdBadInput2);
    const { adBreaks } = vastAdManager;

    const firstRepeatAdBreak = adBreaks[0];
    expect(firstRepeatAdBreak.repeatAfter).to.be('apple');

    let vastAd = amc.timeline[0];
    expect(vastAd.ad.repeatAfter).to.be(null);

    const secondRepeatAdBreak = adBreaks[1];
    expect(secondRepeatAdBreak.repeatAfter).to.be('');

    [, vastAd] = amc.timeline;
    expect(vastAd.ad.repeatAfter).to.be(null);
  });

  it('Vast 3.0, VMAP: Should not play podded ad if allowMultipleAds is set to false', () => {
    vastAdManager.initialize(amc);
    vastAdManager.onVMAPResponse(vmapInlinePodded);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should notify non-linear ad end when stream ends with active overlay', () => {
    let nonLinearStartNotified = 0;
    let nonLinearEndNotified = 0;
    const embedCode = 'embed_code';
    const vastAdMid = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.svg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAdMid],
    };

    amc.sendURLToLoadAndPlayNonLinearAd = function () {
      nonLinearStartNotified += 1;
    };
    amc.notifyNonlinearAdEnded = function () {
      nonLinearEndNotified += 1;
    };

    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah.com',
      html5_ad_server: 'http://blah.com',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAdMid, nonLinearXML);
    expect(errorType.length).to.be(0);

    const vastAd = amc.timeline[1];
    vastAdManager.playAd(vastAd);
    expect(nonLinearStartNotified).to.be(1);
    expect(nonLinearEndNotified).to.be(0);

    vastAdManager.cancelAd(vastAd, {
      code: amc.AD_CANCEL_CODE.STREAM_ENDED,
    });
    expect(nonLinearStartNotified).to.be(1);
    expect(nonLinearEndNotified).to.be(1);
  });

  it('Vast Ad Manager: Should use page level settings with position_type t', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: 10000,
        },
      ],
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline[0].ad.position).to.be(10);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://blahblah');
  });

  it('Vast Ad Manager: Should use page level settings with position_type t with string position', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: '10000',
        },
      ],
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline[0].ad.position).to.be(10);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://blahblah');
  });

  it('Vast Ad Manager: Should use page level settings with position_type p', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: 50,
        },
      ],
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline[0].ad.position).to.be(50); // this should be the percentage. The plugin no longer takes care of the calculation
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://blahblah');
  });

  it('Vast Ad Manager: Should use page level settings with position_type p with string position', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: '70',
        },
      ],
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline[0].ad.position).to.be(70); // this should be the percentage. The plugin no longer takes care of the calculation
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://blahblah');
  });

  it('Vast Ad Manager: Can add multiple position type \'t\' ads with page level settings', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: 10000,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: 20000,
        },
      ],
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.position).to.be(10);
    expect(amc.timeline[1].ad.position).to.be(20);
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://blahblah');
  });

  it('Vast Ad Manager: Can add multiple position type \'p\' ads with page level settings', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: 25,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: 50,
        },
      ],
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.position).to.be(25);// this should be the percentage. The plugin no longer takes care of the calculation
    expect(amc.timeline[1].ad.position).to.be(50);// this should be the percentage. The plugin no longer takes care of the calculation
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://blahblah');
  });

  it('Vast Ad Manager: Can add multiple mixed position type ads with page level settings', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: 25,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: 50000,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: 0,
        },
      ],
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(3);
    expect(amc.timeline[0].ad.position).to.be(25);// this should be the percentage. The plugin no longer takes care of the calculation
    expect(amc.timeline[1].ad.position).to.be(50);
    // Timeline is not sorted at this point
    expect(amc.timeline[2].ad.position).to.be(0);
    vastAdManager.playAd(amc.timeline[2]);
    expect(vastAdManager.vastUrl).to.be('http://blahblah');
  });

  it('Vast Ad Manager: Should ignore page level settings with non-string tag_urls', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: null,
          position_type: 't',
          position: 0,
        },
        {
          position_type: 'p',
          position: 0,
        },
        {
          tag_url: {},
          position_type: 't',
          position: 0,
        },
        {
          tag_url() {},
          position_type: 't',
          position: 0,
        },
        {
          tag_url: true,
          position_type: 't',
          position: 0,
        },
        {
          tag_url: false,
          position_type: 't',
          position: 0,
        },
        {
          tag_url: 12345,
          position_type: 't',
          position: 0,
        },
      ],
    }, {}, content);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should ignore page level settings with null positions', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: null,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: null,
        },
      ],
    }, {}, content);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should ignore page level settings with undefined positions', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 't',
        },
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
        },
      ],
    }, {}, content);
    expect(amc.timeline.length).to.be(0);
  });

  it('Vast Ad Manager: Should ignore page level settings with non-string/non-number positions', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: {},
        },
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position() {},
        },
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: true,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: false,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 't',
          position: NaN,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: 'NaN',
        },
      ],
    }, {}, content);
    expect(amc.timeline.length).to.be(0);
  });

  it(`Vast Ad Manager: Should use tag url override if provided
    in page level settings for content tree ads`, () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
      url: 'http://vastad1',
    };
    const vastAd2 = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code2',
      time: 0,
      position_type: 't',
      url: 'http://vastad2',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd, vastAd2],
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      tagUrl: 'http://override',
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://override');
    expect(amc.timeline[1].ad.tag_url).to.be('http://override');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://override');
  });

  it(`Vast Ad Manager: Should use tag url override
    if provided in page level settings for page level ads`, () => {
    const embedCode = 'embed_code';
    const content = {
      embed_code: embedCode,
      duration: 120000,
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      tagUrl: 'http://override',
      all_ads: [
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: 25,
        },
        {
          tag_url: 'http://blahblah',
          position_type: 'p',
          position: 50,
        },
      ],
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://override');
    expect(amc.timeline[1].ad.tag_url).to.be('http://override');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://override');
  });

  it('Vast Ad Manager: Should ignore tag url override if is not a string', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
      url: 'http://vastad1',
    };
    const vastAd2 = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code2',
      time: 0,
      position_type: 't',
      url: 'http://vastad2',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd, vastAd2],
      duration: 120000,
    };
    vastAdManager.initialize(amc);

    vastAdManager.loadMetadata({
      tagUrl: null,
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://vastad1');
    expect(amc.timeline[1].ad.tag_url).to.be('http://vastad2');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://vastad1');

    amc.timeline = [];
    vastAdManager.loadMetadata({
      // undefined tag url
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://vastad1');
    expect(amc.timeline[1].ad.tag_url).to.be('http://vastad2');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://vastad1');

    amc.timeline = [];
    vastAdManager.loadMetadata({
      tagUrl: {},
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://vastad1');
    expect(amc.timeline[1].ad.tag_url).to.be('http://vastad2');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://vastad1');

    amc.timeline = [];
    vastAdManager.loadMetadata({
      tagUrl() {},
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://vastad1');
    expect(amc.timeline[1].ad.tag_url).to.be('http://vastad2');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://vastad1');

    amc.timeline = [];
    vastAdManager.loadMetadata({
      tagUrl: 12345,
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://vastad1');
    expect(amc.timeline[1].ad.tag_url).to.be('http://vastad2');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://vastad1');

    amc.timeline = [];
    vastAdManager.loadMetadata({
      tagUrl: true,
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://vastad1');
    expect(amc.timeline[1].ad.tag_url).to.be('http://vastad2');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://vastad1');

    amc.timeline = [];
    vastAdManager.loadMetadata({
      tagUrl: false,
    }, {}, content);
    amc.timeline[0].id = 'asdf';// work around because we are using mockAMC and normally it assigns id's
    expect(amc.timeline.length).to.be(2);
    expect(amc.timeline[0].ad.tag_url).to.be('http://vastad1');
    expect(amc.timeline[1].ad.tag_url).to.be('http://vastad2');
    vastAdManager.playAd(amc.timeline[0]);
    expect(vastAdManager.vastUrl).to.be('http://vastad1');
  });

  it('VPAID 2.0: Should use VPAID recovery timeout overrides', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 0,
      position_type: 't',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      vpaidTimeout: {
        iframe: 9,
        loaded: 10,
        started: 11,
        stopped: 12,
      },
    }, {}, content);
    expect(vastAdManager.VPAID_AD_IFRAME_TIMEOUT).to.be(9000);
    expect(vastAdManager.VPAID_AD_LOADED_TIMEOUT).to.be(10000);
    expect(vastAdManager.VPAID_AD_STARTED_TIMEOUT).to.be(11000);
    expect(vastAdManager.VPAID_AD_STOPPED_TIMEOUT).to.be(12000);
  });

  it('VPAID 2.0: Should parse VPAID linear creative', () => {
    vpaidInitialize();
    const ad = amc.timeline[1];
    expect(ad).to.be.an('object');
    expect(ad.duration).to.eql(16);
    expect(ad.position).to.eql(0);
    const parsedAd = global.vpaidAd.ad.data;
    expect(ad.ad).to.be.an('object');
    expect(ad.videoRestrictions).to.eql({
      technology: OO.VIDEO.TECHNOLOGY.HTML5,
      features: [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE],
    });
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

  it('VPAID 2.0: Should create slot and video slot', () => {
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(_.isElement(vastAdManager._slot)).to.be(true);
    expect(_.isElement(vastAdManager._videoSlot)).to.be(true);
  });

  it('VPAID 2.0: initAd should be called after validations', () => {
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(global.vpaid.adInit).to.be(true);
  });

  it('VPAID 2.0: initAd should not be called when any required ad unit function is missing', () => {
    vpaidInitialize();
    global.vpaid.getVPAIDAd = function () {
      return new global.vpaid.MissingFnVPAIDAd();
    };
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(global.vpaid.adInit).to.be(false);
  });

  it('VPAID 2.0: initAd should not be called when using incorrect version <2.0', () => {
    vpaidInitialize();
    global.vpaid.getVPAIDAd = function () {
      return new global.vpaid.IncorrectVersionVPAIDAd();
    };
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(global.vpaid.adInit).to.be(false);
  });

  it('VPAID 2.0: Ad should be started', () => {
    let podStartedNotified = 0;
    let
      linearStartedNotified = 0;
    vpaidInitialize();

    amc.notifyPodStarted = function () {
      podStartedNotified += 1;
    };

    amc.notifyLinearAdStarted = function () {
      linearStartedNotified += 1;
    };

    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(global.vpaid.adStarted).to.be(true);
    expect(podStartedNotified).to.eql(1);
    expect(linearStartedNotified).to.eql(1);
  });

  it('VPAID 2.0: Ad should be stopped when ad video is completed', () => {
    let podEndNotified = 0;
    let
      linearEndNotified = 0;
    vpaidInitialize();

    amc.notifyPodEnded = function () {
      podEndNotified += 1;
    };

    amc.notifyLinearAdEnded = function () {
      linearEndNotified += 1;
    };

    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    ad.vpaidAd.adVideoCompleted();
    expect(global.vpaid.adStopped).to.be(true);
    expect(podEndNotified).to.eql(1);
    expect(linearEndNotified).to.eql(1);
  });

  it('VPAID 2.0: Ad should be skipped when calling skipAd', () => {
    let podEndNotified = 0;
    let
      linearEndNotified = 0;
    vpaidInitialize();

    amc.notifyPodEnded = function () {
      podEndNotified += 1;
    };

    amc.notifyLinearAdEnded = function () {
      linearEndNotified += 1;
    };

    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    vastAdManager.cancelAd(ad, {
      code: amc.AD_CANCEL_CODE.SKIPPED,
    });
    expect(global.vpaid.adSkipped).to.be(true);
    expect(podEndNotified).to.eql(1);
    expect(linearEndNotified).to.eql(1);
  });

  it(`VPAID 2.0: Ad skip button should display when skippableState changes to true,
    or hide when false`, () => {
    let allowSkipButton = false;
    let
      skipOffset = 0;
    amc.showSkipVideoAdButton = function (allowButton, offset) {
      allowSkipButton = allowButton;
      skipOffset = offset;
    };
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();

    ad.vpaidAd.setSkippableState(true);
    expect(allowSkipButton).to.be(true);
    ad.vpaidAd.setSkippableState(false);
    expect(allowSkipButton).to.be(false);
    expect(skipOffset).to.be('0');
  });

  it('VPAID 2.0: Should check and send companion ads', () => {
    let companion;
    const parsedAd = global.vpaidAd.ad.data;
    amc.showCompanion = function (companionAds) {
      companion = companionAds;
    };
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(companion).to.eql(parsedAd.companion);
  });

  it('VPAID 2.0: Ad should not end on adVideoEnded', () => {
    let podEndNotified = 0;
    let
      linearEndNotified = 0;
    vpaidInitialize();

    amc.notifyPodEnded = function () {
      podEndNotified += 1;
    };

    amc.notifyLinearAdEnded = function () {
      linearEndNotified += 1;
    };

    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    vastAdManager.adVideoEnded();
    expect(podEndNotified).to.eql(0);
    expect(linearEndNotified).to.eql(0);
  });

  it(`VPAID 2.0: Ad Unit should handle clickthru if playerHandles is false,
    otherwise players handle the click`, () => {
    let adUnitHandling = true;
    vpaidInitialize();

    vastAdManager.openUrl = function () {
      adUnitHandling = false;
    };

    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    ad.vpaidAd.sendClick(false);
    expect(adUnitHandling).to.be(true);

    ad.vpaidAd.sendClick(true);
    expect(adUnitHandling).to.be(false);
  });

  it('VPAID 2.0: Should notify linear ad started when adLinearChange is sent', () => {
    let linearStartedNotified = 0;
    vpaidInitialize(vpaidNonLinearXML);

    amc.notifyLinearAdStarted = function () {
      linearStartedNotified += 1;
    };
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    amc.adManagerSettings.linearAdSkipButtonStartTime = 5;
    ad.vpaidAd.sendAdLinearChange(false);
    expect(linearStartedNotified).to.eql(0);
    ad.vpaidAd.sendAdLinearChange(true);
    expect(linearStartedNotified).to.eql(1);
  });

  it('VPAID 2.0: Should parse and send ad parameters', () => {
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(JSON.parse(ad.ad.adParams)).to.eql(ad.vpaidAd.properties.adParameters);
  });

  it('VPAID 2.0: Should hide player ui', () => {
    let hidePlayerUi = false;
    amc.hidePlayerUi = function () {
      hidePlayerUi = true;
    };
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(hidePlayerUi).to.be(true);
  });

  it('VPAID 2.0: Should resize ad unit on size changed', () => {
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(ad.vpaidAd.properties.width).to.be(100);
    expect(ad.vpaidAd.properties.height).to.be(100);
    vastAdManager._slot.getBoundingClientRect = function () {
      return {
        width: 200,
        height: 300,
      };
    };
    amc.publishPlayerEvent(amc.EVENTS.SIZE_CHANGED);
    expect(ad.vpaidAd.properties.width).to.be(200);
    expect(ad.vpaidAd.properties.height).to.be(300);
  });

  it('VPAID 2.0: Should resize ad unit on fullscreen change', () => {
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(ad.vpaidAd.properties.width).to.be(100);
    expect(ad.vpaidAd.properties.height).to.be(100);
    vastAdManager._slot.getBoundingClientRect = function () {
      return {
        width: 200,
        height: 300,
      };
    };
    amc.publishPlayerEvent(amc.EVENTS.FULLSCREEN_CHANGED);
    expect(ad.vpaidAd.properties.width).to.be(200);
    expect(ad.vpaidAd.properties.height).to.be(300);
  });

  it('VPAID 2.0: Should check/show ad unit companions when no XML companions available', () => {
    let companion;
    amc.showCompanion = function (companionAds) {
      companion = companionAds;
    };
    vpaidInitialize(vpaidNoCompanionXML);
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    expect(companion).to.eql({ companion: {} });
  });

  it('VPAID 2.0: should fail if media file value is empty', () => {
    vpaidInitialize(vpaidLinearNoValuesXML);
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    expect(vastAdManager.initializeAd()).to.be(null);
    expect(ad.duration).to.eql(16);
    expect(global.vpaid.adInit).to.be(false);
    expect(global.vpaid.adStarted).to.be(false);
  });

  // TODO: Add unit tests for other tracking events
  it('VPAID 2.0: Impression tracking URLs should be pinged', () => {
    vpaidInitialize();
    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();
    ad.vpaidAd.callEvent('AdImpression');

    sinon.assert.calledOnce(OO.pixelPing);
    expect(OO.pixelPing.getCall(0).args).to.eql(['impressionUrl']);
  });

  it('Vast Content Type Filtering: Parser should catch content types for HLS', () => {
    vastAdManager.initialize(amc);
    let vastAd = {
      type: 'vast',
    };

    // catch content-type: application/x-mpegurl
    vastAdManager.onVastResponse(vastAd, contentTypeHLS1);
    [vastAd] = amc.timeline;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be('application/x-mpegurl');
    expect(vastAd.ad.streams).to.not.be(null);
    expect(vastAd.ad.streams.hls).to.be('1.m3u8');

    amc = new FakeAmc();
    vastAdManager.destroy();
    vastAdManager.initialize(amc);

    // catch content-type: application/mpegurl
    vastAdManager.onVastResponse(vastAd, contentTypeHLS2);
    [vastAd] = amc.timeline;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be('application/mpegurl');
    expect(vastAd.ad.streams).to.not.be(null);
    expect(vastAd.ad.streams.hls).to.be('1.m3u8');

    amc = new FakeAmc();
    vastAdManager.destroy();
    vastAdManager.initialize(amc);

    // catch content-type: audio/x-mpegurl
    vastAdManager.onVastResponse(vastAd, contentTypeHLS3);
    [vastAd] = amc.timeline;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be('audio/x-mpegurl');
    expect(vastAd.ad.streams).to.not.be(null);
    expect(vastAd.ad.streams.hls).to.be('1.m3u8');

    amc = new FakeAmc();
    vastAdManager.destroy();
    vastAdManager.initialize(amc);

    // catch content-type: audio/mpegurl
    vastAdManager.onVastResponse(vastAd, contentTypeHLS4);
    [vastAd] = amc.timeline;
    expect(vastAd.ad).to.be.an('object');
    expect(vastAd.ad.data.linear.mediaFiles.length).to.eql(1);
    expect(vastAd.ad.data.linear.mediaFiles[0].type).to.be('audio/mpegurl');
    expect(vastAd.ad.streams).to.not.be(null);
    expect(vastAd.ad.streams.hls).to.be('1.m3u8');
  });

  // Tracking Event Tests

  it('Vast: Linear Creative Tracking Events URLs should be pinged', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.mp4',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAd, linearXML);

    const ad = amc.timeline[1];

    // creativeView, impression, and start tracking events
    vastAdManager.playAd(ad);

    const duration = 52;
    const firstQuartileTime = duration / 4;
    const midpointTime = duration / 2;
    const thirdQuartileTime = (3 * duration) / 4;

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
      code: amc.AD_CANCEL_CODE.SKIPPED,
    });

    sinon.mock(window).expects('open').once();
    // e.once();
    sinon.assert.callCount(OO.pixelPing, 25);
    expect(OO.pixelPing.getCall(0).args).to.eql(['creativeViewUrl']);
    expect(OO.pixelPing.getCall(1).args).to.eql(['startUrl']);
    expect(OO.pixelPing.getCall(2).args).to.eql(['impressionUrl']);
    expect(OO.pixelPing.getCall(3).args).to.eql(['firstQuartileUrl']);
    expect(OO.pixelPing.getCall(4).args).to.eql(['midpointUrl']);
    expect(OO.pixelPing.getCall(5).args).to.eql(['thirdQuartileUrl']);
    expect(OO.pixelPing.getCall(6).args).to.eql(['clickTrackingUrl']);
    expect(OO.pixelPing.getCall(7).args).to.eql(['customClickUrl']);
    expect(OO.pixelPing.getCall(8).args).to.eql(['pauseUrl']);
    expect(OO.pixelPing.getCall(9).args).to.eql(['resumeUrl']);
    expect(OO.pixelPing.getCall(10).args).to.eql(['pauseUrl']);
    expect(OO.pixelPing.getCall(11).args).to.eql(['resumeUrl']);
    expect(OO.pixelPing.getCall(12).args).to.eql(['muteUrl']);
    expect(OO.pixelPing.getCall(13).args).to.eql(['unmuteUrl']);
    expect(OO.pixelPing.getCall(14).args).to.eql(['muteUrl']);
    expect(OO.pixelPing.getCall(15).args).to.eql(['unmuteUrl']);
    expect(OO.pixelPing.getCall(16).args).to.eql(['fullscreenUrl']);
    expect(OO.pixelPing.getCall(17).args).to.eql(['exitFullscreenUrl']);
    expect(OO.pixelPing.getCall(18).args).to.eql(['fullscreenUrl']);
    expect(OO.pixelPing.getCall(19).args).to.eql(['exitFullscreenUrl']);
    expect(OO.pixelPing.getCall(20).args).to.eql(['completeUrl']);
    expect(OO.pixelPing.getCall(21).args).to.eql(['creativeViewUrl']);
    expect(OO.pixelPing.getCall(22).args).to.eql(['startUrl']);
    expect(OO.pixelPing.getCall(23).args).to.eql(['impressionUrl']);
    expect(OO.pixelPing.getCall(24).args).to.eql(['skipUrl']);
  });

  it('Vast: Normal VAST Tracking Events should not be pinged if ad is VPAID', () => {
    vpaidInitialize();
    const ad = amc.timeline[1];

    // creativeView, impression, and start tracking events
    vastAdManager.playAd(ad);
    vastAdManager.initializeAd();

    const duration = 52;
    const firstQuartileTime = duration / 4;
    const midpointTime = duration / 2;
    const thirdQuartileTime = (3 * duration) / 4;

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
      code: amc.AD_CANCEL_CODE.SKIPPED,
    });

    sinon.assert.notCalled(OO.pixelPing);
  });

  it('Vast: NonLinear Creative Tracking Events URLs should be pinged', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();
    vastAdManager.onVastResponse(vastAd, nonLinearXML);

    const ad = amc.timeline[1];

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

    sinon.assert.callCount(OO.pixelPing, 20);
    expect(OO.pixelPing.getCall(0).args).to.eql(['impressionOverlayUrl']);
    expect(OO.pixelPing.getCall(1).args).to.eql(['impressionOverlay2Url']);
    expect(OO.pixelPing.getCall(2).args).to.eql(['impressionOverlay3Url']);
    expect(OO.pixelPing.getCall(3).args).to.eql(['impressionOverlay4Url']);
    expect(OO.pixelPing.getCall(4).args).to.eql(['impressionOverlay5Url']);
    expect(OO.pixelPing.getCall(5).args).to.eql(['impressionOverlay6Url']);
    expect(OO.pixelPing.getCall(6).args).to.eql(['impressionOverlayUrl']);
    expect(OO.pixelPing.getCall(7).args).to.eql(['impressionOverlay2Url']);
    expect(OO.pixelPing.getCall(8).args).to.eql(['impressionOverlay3Url']);
    expect(OO.pixelPing.getCall(9).args).to.eql(['impressionOverlay4Url']);
    expect(OO.pixelPing.getCall(10).args).to.eql(['impressionOverlay5Url']);
    expect(OO.pixelPing.getCall(11).args).to.eql(['impressionOverlay6Url']);
    expect(OO.pixelPing.getCall(12).args).to.eql(['nonLinearClickTrackingUrl']);
    expect(OO.pixelPing.getCall(13).args).to.eql(['impressionOverlayUrl']);
    expect(OO.pixelPing.getCall(14).args).to.eql(['impressionOverlay2Url']);
    expect(OO.pixelPing.getCall(15).args).to.eql(['impressionOverlay3Url']);
    expect(OO.pixelPing.getCall(16).args).to.eql(['impressionOverlay4Url']);
    expect(OO.pixelPing.getCall(17).args).to.eql(['impressionOverlay5Url']);
    expect(OO.pixelPing.getCall(18).args).to.eql(['impressionOverlay6Url']);
    expect(OO.pixelPing.getCall(19).args).to.eql(['closeUrl']);
  });

  it('VAST: Wrapper ads should be properly parsed into the adTrackingInfo object', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    const expected = {
      6654644: {
        vastAdObject: null,
        errorURLs: ['errorurl'],
        wrapperParentId: 'wrapper-parent-2',
      },
      'wrapper-parent-1': {
        vastAdObject: {
          error: ['errorWrapper1Url'],
          impression: ['impressionWrapper1Url'],
          linear: {
            tracking: {
              creativeView: [],
              start: ['startWrapper1Url'],
              midpoint: ['midpointWrapper1Url'],
              firstQuartile: ['firstQuartileWrapper1Url'],
              thirdQuartile: ['thirdQuartileWrapper1Url'],
              complete: ['completeWrapper1Url'],
              mute: [],
              unmute: [],
              pause: [],
              rewind: [],
              resume: [],
              fullscreen: [],
              exitFullscreen: [],
              expand: [],
              collapse: [],
              acceptInvitation: [],
              close: [],
              skip: [],
            },
            clickTracking: ['clickTrackingWrapper1Url'],
            clickThrough: 'clickThroughWrapper1Url',
            customClick: ['customClickWrapper1Url'],
          },
          nonLinear: {},
          companion: [],
          type: 'Wrapper',
          version: '2.0',
          vastAdTagUri: 'vastad.xml',
          title: 'wrapperParentAd1',
          id: 'wrapper-parent-1',
        },
        errorURLs: ['errorWrapper1Url'],
        wrapperParentId: null,
      },
      'wrapper-parent-2': {
        vastAdObject: {
          error: ['errorWrapper2Url'],
          impression: ['impressionWrapper2Url'],
          linear: {
            tracking: {
              creativeView: [],
              start: ['startWrapper2Url'],
              midpoint: ['midpointWrapper2Url'],
              firstQuartile: ['firstQuartileWrapper2Url'],
              thirdQuartile: ['thirdQuartileWrapper2Url'],
              complete: ['completeWrapper2Url'],
              mute: [],
              unmute: [],
              pause: [],
              rewind: [],
              resume: [],
              fullscreen: [],
              exitFullscreen: [],
              expand: [],
              collapse: [],
              acceptInvitation: [],
              close: [],
              skip: [],
            },
            clickTracking: ['clickTrackingWrapper2Url'],
            clickThrough: 'clickThroughWrapper2Url',
            customClick: ['customClickWrapper2Url'],
          },
          nonLinear: {},
          companion: [],
          type: 'Wrapper',
          version: '2.0',
          vastAdTagUri: 'vastad.xml',
          title: 'wrapperParentAd2',
          id: 'wrapper-parent-2',
        },
        errorURLs: ['errorWrapper2Url'],
        wrapperParentId: 'wrapper-parent-1',
      },
    };


    // need to fake wrapper ajax calls
    vastAdManager.onVastResponse(vastAd, wrapper1XML);
    vastAdManager.onVastResponse(vastAd, wrapper2XML, 'wrapper-parent-1');
    vastAdManager.onVastResponse(vastAd, linearXML, 'wrapper-parent-2');

    expect(JSON.stringify(vastAdManager.adTrackingInfo)).to.eql(JSON.stringify(expected));
  });

  it('VAST: Wrapper ads\' tracking events should be pinged if child\'s events are pinged', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    // Wrapper ads could be visualized as a tree with parents and children,
    // but in this case, it looks more like a linked list:
    // wrapper-parent-1 -> wrapper-parent-2 -> 6654644 (Inline Linear Ad)
    const parentDepthOneId = 'wrapper-parent-1';
    const parentDepthTwoId = 'wrapper-parent-2';

    // need to fake wrapper ajax calls
    vastAdManager.onVastResponse(vastAd, wrapper1XML);
    vastAdManager.onVastResponse(vastAd, wrapper2XML, parentDepthOneId);
    vastAdManager.onVastResponse(vastAd, linearXML, parentDepthTwoId);

    const ad = amc.timeline[1];

    // creativeView, impression, and start tracking events
    vastAdManager.playAd(ad);


    sinon.assert.callCount(OO.pixelPing, 7);
    expect(OO.pixelPing.getCall(0).args).to.eql(['creativeViewUrl']);
    expect(OO.pixelPing.getCall(1).args).to.eql(['startUrl']);
    expect(OO.pixelPing.getCall(2).args).to.eql(['impressionUrl']);
    expect(OO.pixelPing.getCall(3).args).to.eql(['startWrapper2Url']);
    expect(OO.pixelPing.getCall(4).args).to.eql(['impressionWrapper2Url']);
    expect(OO.pixelPing.getCall(5).args).to.eql(['startWrapper1Url']);
    expect(OO.pixelPing.getCall(6).args).to.eql(['impressionWrapper1Url']);
  });

  it('VAST: Wrapper ads\' tracking events should be pinged if VPAID child\'s events are pinged', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vpaid',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    // Wrapper ads could be visualized as a tree with parents and children,
    // but in this case, it looks more like a linked list:
    // wrapper-parent-1 -> wrapper-parent-2 -> 6654644 (Inline Linear Ad)
    const parentDepthOneId = 'wrapper-parent-1';
    const parentDepthTwoId = 'wrapper-parent-2';

    // need to fake wrapper ajax calls
    vastAdManager.onVastResponse(vastAd, wrapper1XML);
    vastAdManager.onVastResponse(vastAd, wrapper2XML, parentDepthOneId);
    vastAdManager.onVastResponse(vastAd, vpaidLinearXML, parentDepthTwoId);

    const ad = amc.timeline[1];
    vastAdManager.playAd(ad);

    vastAdManager.initializeAd();
    ad.vpaidAd.callEvent('AdImpression');
    ad.vpaidAd.callEvent('AdVideoStart');

    // leaf and parent level ad events should be pinged
    sinon.assert.callCount(OO.pixelPing, 6);
    expect(OO.pixelPing.getCall(0).args).to.eql(['impressionUrl']);
    expect(OO.pixelPing.getCall(1).args).to.eql(['impressionWrapper2Url']);
    expect(OO.pixelPing.getCall(2).args).to.eql(['impressionWrapper1Url']);
    expect(OO.pixelPing.getCall(3).args).to.eql(['startUrl']);
    expect(OO.pixelPing.getCall(4).args).to.eql(['startWrapper2Url']);
    expect(OO.pixelPing.getCall(5).args).to.eql(['startWrapper1Url']);


    ad.vpaidAd.callEvent('AdClickThru');

    sinon.assert.callCount(OO.pixelPing, 12);
    expect(OO.pixelPing.getCall(6).args).to.eql(['clickTracking']);
    expect(OO.pixelPing.getCall(7).args).to.eql(['customClick']);
    expect(OO.pixelPing.getCall(8).args).to.eql(['clickTrackingWrapper2Url']);
    expect(OO.pixelPing.getCall(9).args).to.eql(['customClickWrapper2Url']);
    expect(OO.pixelPing.getCall(10).args).to.eql(['clickTrackingWrapper1Url']);
    expect(OO.pixelPing.getCall(11).args).to.eql(['customClickWrapper1Url']);

    ad.vpaidAd.callEvent('AdError');

    sinon.assert.callCount(OO.pixelPing, 15);

    expect(OO.pixelPing.getCall(12).args).to.eql(['errorUrl']);
    expect(OO.pixelPing.getCall(13).args).to.eql(['errorWrapper2Url']);
    expect(OO.pixelPing.getCall(14).args).to.eql(['errorWrapper1Url']);
  });

  it('VAST: Wrapper ad requests should not end ad pod until non-wrapper ad is found', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    let podEnded = false;
    amc.notifyPodEnded = function () {
      podEnded = true;
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    // Wrapper ads could be visualized as a tree with parents and children,
    // but in this case, it looks more like a linked list:
    // wrapper-parent-1 -> wrapper-parent-2 -> 6654644 (Inline Linear Ad)
    const parentDepthOneId = 'wrapper-parent-1';
    const parentDepthTwoId = 'wrapper-parent-2';

    const adRequestAd = amc.timeline[0];
    expect(adRequestAd.adType).to.be(amc.ADTYPE.AD_REQUEST);
    vastAdManager.playAd(adRequestAd);

    // need to fake wrapper ajax calls
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vastAd, wrapper1XML);
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vastAd, wrapper2XML, parentDepthOneId);
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vastAd, linearXML, parentDepthTwoId);
    expect(podEnded).to.be(true);
  });

  it('VAST: Wrapper ad requests should end ad pod on vast error', () => {
    const embedCode = 'embed_code';
    const vastAd = {
      type: 'vast',
      first_shown: 0,
      frequency: 2,
      ad_set_code: 'ad_set_code',
      time: 10,
      position_type: 't',
      url: '1.jpg',
    };
    const content = {
      embed_code: embedCode,
      ads: [vastAd],
    };
    let podEnded = false;
    amc.notifyPodEnded = function () {
      podEnded = true;
    };
    vastAdManager.initialize(amc);
    vastAdManager.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    initialPlay();
    vastAdManager.initialPlay();

    const adRequestAd = amc.timeline[0];
    expect(adRequestAd.adType).to.be(amc.ADTYPE.AD_REQUEST);
    vastAdManager.playAd(adRequestAd);

    // need to fake wrapper ajax calls
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vastAd, wrapper1XML);
    expect(podEnded).to.be(false);
    vastAdManager.onVastResponse(vastAd, 'asdf');
    expect(errorType.length > 0).to.be(true);
    expect(podEnded).to.be(true);
  });
});
