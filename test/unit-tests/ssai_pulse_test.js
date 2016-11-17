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

describe('ad_manager_ssai_pulse', function()
{
  var amc, SsaiPulse;
  var name = "ssai-pulse-ads-manager";
  var originalOoAds = _.clone(OO.Ads);
  require(TEST_ROOT + "unit-test-helpers/mock_amc.js");

  var adsClickthroughOpenedCalled = 0;

  // Vast XML
  var ssaiXmlString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/ssai.xml"), "utf8");
  var ssaiNoDurationXmlString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/ssai_no_duration.xml"), "utf8");
  var ssaiXml = OO.$.parseXML(ssaiXmlString);
  var ssaiNoDurationXml = OO.$.parseXML(ssaiNoDurationXmlString);
  var trackingUrlsPinged = {};

  // Helper functions
  var fakeAd = function(timePositionClass, position, duration)
  {
    var timePositionClass = timePositionClass;
    var position = position;
    var duration = duration;
    this.getTimePositionClass = function(){ return timePositionClass; };
    this.getTimePosition = function() { return position; };
    this.getTotalDuration = function() { return duration; };
  };

  var initialize = function()
  {
    var embed_code = "embed_code";
    var vast_ad = {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t"
    };
    var content =
    {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    SsaiPulse.initialize(amc);
    SsaiPulse.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
  };

  var initialPlay = function()
  {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
  };

  before(_.bind(function()
  {
    OO.Ads =
    {
      manager: function(adManager)
      {
        SsaiPulse = adManager(_, $);
        SsaiPulse.testMode = true;
      }
    };

    // mock pixelPing to test error tracking
    OO.pixelPing = function(url) {
      if (url) {
        if (trackingUrlsPinged.hasOwnProperty(url)) {
          trackingUrlsPinged[url] += 1;
        }
        else {
          trackingUrlsPinged[url] = 1;
        }
      }
    };

    delete require.cache[require.resolve(SRC_ROOT + "ssai_pulse.js")];
    require(SRC_ROOT + "ssai_pulse.js");

  }, this));

  after(function()
  {
    OO.Ads = originalOoAds;
  });

  beforeEach(function()
  {
    amc = new fake_amc();
    amc.adManagerList = [];
    amc.onAdManagerReady = function() {this.timeline = this.adManagerList[0].buildTimeline()};
    amc.adManagerList.push(SsaiPulse);
    trackingUrlsPinged = {};
  });

  afterEach(_.bind(function()
  {
    amc.timeline = [];
    SsaiPulse.destroy();
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', function()
  {
    expect(typeof amc).to.be("object");
  });

  it('Init: ad manager is registered', function()
  {
    expect(SsaiPulse).to.not.be(null);
  });

  it('Init: ad manager has the expected name', function()
  {
    expect(SsaiPulse.name).to.be(name);
  });

  it('Init: ad manager handles the initialize function', function()
  {
    expect(
      function()
      {
        SsaiPulse.initialize(amc);
      }
    ).to.not.throwException();
  });

  it('Init: ad manager handles the loadMetadata function', function()
  {
    var embed_code = "embed_code";
    var vast_ad =
    {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t"
    };
    var content =
    {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    SsaiPulse.initialize(amc);
    expect(function() { SsaiPulse.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);}).to.not.throwException();
  });

  it('Init: ad manager is ready', function()
  {
    var embed_code = "embed_code";
    var vast_ad =
    {
      type: "vast",
      first_shown: 0,
      frequency: 2,
      ad_set_code: "ad_set_code",
      time:0,
      position_type:"t"
    };
    var content =
    {
      embed_code: embed_code,
      ads: [vast_ad]
    };
    SsaiPulse.initialize(amc);
    expect(SsaiPulse.ready).to.be(false);
    SsaiPulse.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);
    expect(SsaiPulse.ready).to.be(true);
  });

  it('ID3 Object should be parsed', function()
  {
    SsaiPulse.initialize(amc);
    var mockId3Tag =
    {
      TXXX: "adid=adid1&t=0&d=100"
    };
    var expectedResult =
    {
      adId: "adid1",
      time: 0,
      duration: 100
    };
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(SsaiPulse.currentId3Object, expectedResult)).to.be(true);

    // test bad inputs
    mockId3Tag.TXXX = "adid=adid2&banana=0";
    expectedResult = null;
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(SsaiPulse.currentId3Object).to.be(null);

    mockId3Tag.TXXX = "";
    expectedResult = null;
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(SsaiPulse.currentId3Object).to.be(null);

    mockId3Tag.TXXX = null;
    expectedResult = null;
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(SsaiPulse.currentId3Object).to.be(null);
  });

  it('Ad should end if new ID3 tag detected', function()
  {
    var notifyLinearAdEndedCount = 0;
    var notifyLinearAdStartedCount = 0;
    amc.notifyLinearAdEnded = function()
    {
      notifyLinearAdEndedCount++;
    };
    amc.notifyLinearAdStarted = function()
    {
      notifyLinearAdStartedCount++;
    };
    amc.forceAdToPlay = function()
    {
      var currentAd =
      {
        id:"id",
        ad: {}
      };
      SsaiPulse.playAd(currentAd);
    };

    var mockId3Tag =
    {
      TXXX: "adid=adid1&t=0&d=100"
    };
    SsaiPulse.initialize(amc);
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(notifyLinearAdStartedCount).to.be(1);
    expect(notifyLinearAdEndedCount).to.be(0);

    mockId3Tag.TXXX = "adid=adid2&t=0&d=101";
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(notifyLinearAdStartedCount).to.be(2);
    expect(notifyLinearAdEndedCount).to.be(1);

    mockId3Tag.TXXX = "adid=adid3&t=0&d=102";
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(notifyLinearAdStartedCount).to.be(3);
    expect(notifyLinearAdEndedCount).to.be(2);
  });

  it('Previously played ad should be able to replay given that it is not already playing', function()
  {
    var notifyLinearAdEndedCount = 0;
    var notifyLinearAdStartedCount = 0;
    amc.notifyLinearAdEnded = function()
    {
      notifyLinearAdEndedCount++;
    };
    amc.notifyLinearAdStarted = function()
    {
      notifyLinearAdStartedCount++;
    };
    amc.forceAdToPlay = function()
    {
      var currentAd =
      {
        id:"id",
        ad: {}
      };
      SsaiPulse.playAd(currentAd);
    };

    var mockId3Tag =
    {
      TXXX: "adid=adid1&t=0&d=100"
    };
    SsaiPulse.initialize(amc);
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(notifyLinearAdStartedCount).to.be(1);
    expect(notifyLinearAdEndedCount).to.be(0);

    mockId3Tag.TXXX = "adid=adid2&t=0&d=101";
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(notifyLinearAdStartedCount).to.be(2);
    expect(notifyLinearAdEndedCount).to.be(1);

    // try to replay first ad ("adid1")
    mockId3Tag.TXXX = "adid=adid1&t=0&d=100";
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(notifyLinearAdStartedCount).to.be(3);
    expect(notifyLinearAdEndedCount).to.be(2);
  });

  it('Linear Creative Tracking Events URLs should be pinged', function()
  {
    var adQueue = [];
    amc.forceAdToPlay = function(adManager, ad, adType, streams)
    {
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

    SsaiPulse.initialize(amc);

    SsaiPulse.currentId3Object =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      t: 0,
      d: 15
    };

    SsaiPulse.adIdDictionary =
    {
      "11de5230-ff5c-4d36-ad77-c0c7644d28e9": true
    };

    SsaiPulse.currentAd =
    {
      ad: {}
    };

    SsaiPulse.onResponse(SsaiPulse.currentId3Object, ssaiXml);

    var ad = adQueue[0];

    // impression, and start tracking events
    SsaiPulse.playAd(ad);
    expect(trackingUrlsPinged.startUrl).to.be(1);
    expect(trackingUrlsPinged.startUrl2).to.be(1);
    expect(trackingUrlsPinged.impressionUrl).to.be(1);
    expect(trackingUrlsPinged.impressionUrl2).to.be(1);

    // clickthrough tracking events
    SsaiPulse.playerClicked(ad);
    expect(trackingUrlsPinged.linearClickTrackingUrl).to.be(1);
  });

  it('Correct clickthrough URL should be opened', function()
  {
    var adQueue = [];
    var clickThroughUrl = "";
    amc.forceAdToPlay = function(adManager, ad, adType, streams)
    {
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

    window.open = function(url)
    {
      clickThroughUrl = url;
    };

    SsaiPulse.initialize(amc);

    SsaiPulse.currentId3Object =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      t: 0,
      d: 15
    };

    SsaiPulse.adIdDictionary =
    {
      "11de5230-ff5c-4d36-ad77-c0c7644d28e9": true
    };

    SsaiPulse.currentAd =
    {
      ad: {}
    };

    SsaiPulse.onResponse(SsaiPulse.currentId3Object, ssaiXml);

    var ad = adQueue[0];

    // clickthrough tracking events
    SsaiPulse.playerClicked(ad);
    expect(clickThroughUrl).to.be("clickThroughUrl");
  });

  it('Tracking Events URL with CACHEBUSTING macro should be replaced', function()
  {
    var adQueue = [];
    amc.forceAdToPlay = function(adManager, ad, adType, streams)
    {
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

    SsaiPulse.initialize(amc);

    SsaiPulse.currentId3Object =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      t: 0,
      d: 15
    };

    SsaiPulse.adIdDictionary =
    {
      "11de5230-ff5c-4d36-ad77-c0c7644d28e9": true
    };

    SsaiPulse.currentAd =
    {
      ad: {}
    };

    SsaiPulse.onResponse(SsaiPulse.currentId3Object, ssaiXml);

    var ad = adQueue[0];

    // impression, and start tracking events
    SsaiPulse.playAd(ad);

    // get the urls in with the "rnd" query parameter, this will contain the
    // CACHEBUSTING macro that should be replaced.
    var url;
    for (url in trackingUrlsPinged)
    {
      if (_.has(trackingUrlsPinged, url) && /rnd=/.test(url))
      {
        // should not have the cachebusting macros and should be pinged
        expect(url).to.not.have.string("%5BCACHEBUSTING%5D");

        // replaced value is not be undefined or ""
        var rndValue = url.split("=")[1];
        expect(rndValue).to.not.be(undefined);
        expect(rndValue).to.not.be("");

        expect(trackingUrlsPinged[url]).to.be(1);
      }
    }

    // cacheBuster function should not mutate other URLs without the cachebusting macro"
    expect(_.keys(trackingUrlsPinged)).to.contain("impressionUrl");
    expect(_.keys(trackingUrlsPinged)).to.contain("impressionUrl2");
    expect(_.keys(trackingUrlsPinged)).to.contain("startUrl");
    expect(_.keys(trackingUrlsPinged)).to.contain("startUrl2");
  });

  it('Tracking Events URL with CACHEBUSTING macro should be replaced', function()
  {
    var adManagerMetadata =
    {
      "cacheBuster": "true"
    };
    var backlotBaseMetadata = {};
    var movieMetadata = {};
    SsaiPulse.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(SsaiPulse.getBustTheCache()).to.be(true);

    // test bad inputs, should default to true
    adManagerMetadata =
    {
      "cacheBuster": ""
    };
    SsaiPulse.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(SsaiPulse.getBustTheCache()).to.be(true);

    adManagerMetadata =
    {
      "cacheBuster": "abcd"
    };
    SsaiPulse.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(SsaiPulse.getBustTheCache()).to.be(true);

    adManagerMetadata =
    {
      "cacheBuster": 0
    };
    SsaiPulse.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(SsaiPulse.getBustTheCache()).to.be(true);

    // boolean true/false should work
    adManagerMetadata =
    {
      "cacheBuster": false
    };
    SsaiPulse.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(SsaiPulse.getBustTheCache()).to.be(false);

    adManagerMetadata =
    {
      "cacheBuster": true
    };
    SsaiPulse.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(SsaiPulse.getBustTheCache()).to.be(true);

    // should change to false when value is explicitly "false"
    adManagerMetadata =
    {
      "cacheBuster": "false"
    };
    SsaiPulse.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(SsaiPulse.getBustTheCache()).to.be(false);
  });

  it('Correct Ad Duration should be selected', function()
  {
    SsaiPulse.initialize(amc);

    // ID3 Tag ad duration should be selected
    var mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100"
    };
    var expectedResult =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      time: 0,
      duration: 100
    };
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(SsaiPulse.currentId3Object, expectedResult)).to.be(true);
    SsaiPulse.onResponse(SsaiPulse.currentId3Object, ssaiXml);
    expect(SsaiPulse.currentId3Object.duration).to.be(100);

    // ID3 ad duration should be selected
    mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=1"
    };
    expectedResult =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      time: 0,
      duration: 1
    };
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(SsaiPulse.currentId3Object, expectedResult)).to.be(true);
    SsaiPulse.onResponse(SsaiPulse.currentId3Object, ssaiXml);
    expect(SsaiPulse.currentId3Object.duration).to.be(1);

    // Vast XML ad duration should be selected
    mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=0"
    };
    expectedResult =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      time: 0,
      duration: 0
    };
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(SsaiPulse.currentId3Object, expectedResult)).to.be(true);
    SsaiPulse.onResponse(SsaiPulse.currentId3Object, ssaiXml);
    expect(SsaiPulse.currentId3Object.duration).to.be(15);

    // Vast XML ad duration should be selected
    mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=-1"
    };
    expectedResult =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      time: 0,
      duration: -1
    };
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(SsaiPulse.currentId3Object, expectedResult)).to.be(true);
    SsaiPulse.onResponse(SsaiPulse.currentId3Object, ssaiXml);
    expect(SsaiPulse.currentId3Object.duration).to.be(15);

    // DEFAULT_AD_DURATION should be selected
    mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=0"
    };
    expectedResult =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      time: 0,
      duration: 0
    };
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(SsaiPulse.currentId3Object, expectedResult)).to.be(true);
    SsaiPulse.onResponse(SsaiPulse.currentId3Object, ssaiNoDurationXml);
    expect(SsaiPulse.currentId3Object.duration).to.be(20);
  });

  it('Ad Id should be marked with the error state if the ad request fails', function()
  {
    SsaiPulse.initialize(amc);

    // ID3 Tag ad duration should be selected
    var mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100"
    };
    var expectedResult =
    {
      adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
      time: 0,
      duration: 100
    };
    SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(SsaiPulse.currentId3Object, expectedResult)).to.be(true);
    SsaiPulse.onRequestError();

    var adId = expectedResult.adId;
    expect(SsaiPulse.adIdDictionary[adId]).to.be("error");
  });

  it('Correct live offset value should be calculated onPlayheadTimeChanged', function()
  {
    SsaiPulse.initialize(amc);
    var eventName = "";
    var playhead = 0;
    var duration = 100;
    var livePlayhead = 100;

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, livePlayhead);
    var offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, 50);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(50);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, 99.0);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(1);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, -1);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(101);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, 100);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    // We should not have an offset that is greater 0 (aka greater than "Live")
    // Keep the previous offset value if an error occurs while calculating new offset
    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, 101);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    // Test bad input
    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, "banana", 1);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, "banana", "apple");
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, undefined, undefined);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, null, null);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, null, undefined);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, undefined, null);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, {}, null);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, null, {});
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, {}, {});
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);
  });

});
