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
    //For VOD, currentOffset must be greater than 0.
    SsaiPulse.setCurrentOffset(1);
    expect(function() { SsaiPulse.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, content);}).to.not.throwException();
  });

  it('Init: ad manager notifies controller that it is loaded', function()
  {
    var pluginLoaded = false;
    amc.reportPluginLoaded = function(date, name){
      pluginLoaded = true;
    }
    SsaiPulse.initialize(amc);
    expect(function() { SsaiPulse.loadMetadata({"html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"}, {}, {});}).to.not.throwException();
    expect(pluginLoaded).to.be(true);
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

    var currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(currentId3Object, expectedResult)).to.be(true);
  });
  
  it('ID3 Object should not be parsed if ID3 tag contains incorrect inputs', function() {
    SsaiPulse.initialize(amc);
    var mockId3Tag =
    {
      TXXX: "adid=adid1&t=0&d=100"
    };
    // test bad inputs
    mockId3Tag.TXXX = "adid=adid2&banana=0";
    var expectedResult = null;
    var currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(currentId3Object).to.be(expectedResult);
  });
  
  it('ID3 Object should not be parsed if ID3 tag is empty', function() {
    SsaiPulse.initialize(amc);
  
    var mockId3Tag =
    {
      TXXX: ""
    };
    var expectedResult = null;
    var currentId3Object= SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    
    expect(currentId3Object).to.be(expectedResult);
  });
  
  it('ID3 Object should not be parsed if ID3 tag is null', function() {
    SsaiPulse.initialize(amc);
    
    var mockId3Tag =
      {
        TXXX: null
      };
    var expectedResult = null;
    var currentId3Object= SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    
    expect(currentId3Object).to.be(expectedResult);
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
  
  it('Correct ID3 ad duration should be selected', function() {
    SsaiPulse.initialize(amc);
    
    var mockId3Tag =
      {
        TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=1"
      };
    var expectedResult =
      {
        adId: "11de5230-ff5c-4d36-ad77-c0c7644d28e9",
        time: 0,
        duration: 1
      };
    var currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(currentId3Object, expectedResult)).to.be(true);
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
    var currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(currentId3Object, expectedResult)).to.be(true);
    SsaiPulse.onResponse(currentId3Object, ssaiXml);
    expect(currentId3Object.duration).to.be(100);
  });

  it('Ad Timeline should be set after ad metadata request', function()
  {
    SsaiPulse.initialize(amc);
    var mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100"
    };
    var metadataResponse =
    {
      "ads":[{"id":"pre","start":0,"duration":30.0,"adtype":"preroll","adbreakname":"preroll"},
            {"id":"mid","start":70.4,"duration":15.5,"adtype":"midroll","adbreakname":"midroll1"},
            {"id":"post","start":600.04,"duration":30.1,"adtype":"postroll","adbreakname":"postroll"}]
    };
    var currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    SsaiPulse.onMetadataResponse(metadataResponse);
    expect(SsaiPulse.timeline).to.eql(metadataResponse);
  });

  it('Ad url should be parsed for ssai guid and embed on content change', function()
  {
    var testEmbed = "mytestembedcode12345";
    var testGuid = "abcdefgh-1234-abcd-1234-abcdefghijk"
    SsaiPulse.initialize(amc);
    SsaiPulse.onContentUrlChanged("eventName", "http://ssai.ooyala.com/vhls/"+testEmbed+"/pcode/abcd1234?ssai_guid="+testGuid);
    expect(SsaiPulse.ssaiGuid).to.eql(testGuid);
    expect(SsaiPulse.currentEmbed).to.eql(testEmbed);
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
    var currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(OO._.isEqual(currentId3Object, expectedResult)).to.be(true);
    SsaiPulse.onRequestError(currentId3Object);

    var adId = expectedResult.adId;
    
    expect(SsaiPulse.adIdDictionary[adId].state).to.be("error");
  });

  it('Correct VOD offset value should be calculated onPlayheadTimeChanged', function()
  {
    SsaiPulse.initialize(amc);
    var eventName = "";
    var playhead = 0;
    var duration = 100;

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration);
    var offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(100);

    SsaiPulse.onPlayheadTimeChanged(eventName, 50, duration);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(50);

    SsaiPulse.onPlayheadTimeChanged(eventName, 75, duration);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(25);

    SsaiPulse.onPlayheadTimeChanged(eventName, 100, duration);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    // Test bad input
    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, "banana");
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, "apple", "banana");
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, 0);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, undefined);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, undefined, duration);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, undefined, undefined);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, null);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, null, duration);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(duration);

    SsaiPulse.onPlayheadTimeChanged(eventName, null, null);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, {});
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, {}, duration);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

  });

  it('Correct Live offset value should be calculated onPlayheadTimeChanged', function()
  {
    amc.isLiveStream = true;
    SsaiPulse.initialize(amc);
    var eventName = "";
    var playhead = 0;
    var duration = 100;
    var offsetTime = 0;

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, offsetTime);
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
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, 100);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    // We should not have an offset that is greater than duration
    // Keep the previous offset value if an error occurs while calculating new offset
    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, duration, 101);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    // Test bad input
    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, "banana");
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, "banana");
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, undefined);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, null);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, null);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, undefined);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, {});
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, null);
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);

    SsaiPulse.onPlayheadTimeChanged(eventName, playhead, {});
    offset = SsaiPulse.getCurrentOffset();
    expect(offset).to.be(0);
  });

  it('Vast cache is deleted when ad is completed', function()
  {
    SsaiPulse.initialize(amc);
    SsaiPulse.setCurrentOffset(1);

    var mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100"
    };
    var currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=25&d=100"
    };
    currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=50&d=100"
    };
    currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=75&d=100"
    };
    currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    mockId3Tag =
    {
      TXXX: "adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=100&d=100"
    };
    currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(SsaiPulse.adIdDictionary[currentId3Object.adId]).to.be(undefined);
  });

  it('Ad break contains two ads', function()
  {
    SsaiPulse.initialize(amc);
    SsaiPulse.setCurrentOffset(1);
    var mockId3Tag =
    {
      TXXX: "adid=11de5230&t=0&d=100"
    };
    var currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(SsaiPulse.adIdDictionary[currentId3Object.adId]).to.not.be(null);
    mockId3Tag =
    {
      TXXX: "adid=11de5230&t=25&d=100"
    };
    currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    mockId3Tag =
    {
      TXXX: "adid=11de5230&t=50&d=100"
    };
    currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    mockId3Tag =
    {
      TXXX: "adid=11de5230&t=75&d=100"
    };
    currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    mockId3Tag =
    {
      TXXX: "adid=11de5230&t=100&d=100"
    };
    currentId3Object = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag);
    expect(SsaiPulse.adIdDictionary[currentId3Object.adId]).to.be(undefined);
    var mockId3Tag2 =
    {
      TXXX: "adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=0&d=15.160"
    };
    var currentId3Object2 = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag2);
    expect(SsaiPulse.adIdDictionary[currentId3Object2.adId].vastData).to.not.be(null);
    mockId3Tag2 =
    {
      TXXX: "adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=25&d=15.160"
    };
    currentId3Object2 = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag2);
    mockId3Tag2 =
    {
      TXXX: "adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=50&d=15.160"
    };
    currentId3Object2 = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag2);
    mockId3Tag2 =
    {
      TXXX: "adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=75&d=15.160"
    };
    currentId3Object2 = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag2);
    mockId3Tag2 =
    {
      TXXX: "adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=100&d=15.160"
    };
    currentId3Object2 = SsaiPulse.onVideoTagFound("eventName", "videoId", "tagType", mockId3Tag2);
    expect(SsaiPulse.adIdDictionary[currentId3Object2.adId]).to.be(undefined);
  });

});
