/*
 * Unit test class for the Freewheel Ad Manager
 * https://github.com/Automattic/expect.js
 */

//stubs
OO.log = function() {};

describe('ad_manager_freewheel', function() {
  var amc,fw;
  var name = "freewheel-ads-manager";
  var originalOoAds = _.clone(OO.Ads);
  require(TEST_ROOT + "unit-test-helpers/mock_amc.js");
  require(TEST_ROOT + "unit-test-helpers/mock_fw.js");

  var adsClickthroughOpenedCalled;

  // Helper functions
  var fakeAd = function(timePositionClass, position, duration, customId) {
    this.getTimePositionClass = function() {
      return timePositionClass;
    };
    this.getTimePosition = function() {
      return position;
    };
    this.getTotalDuration = function() {
      return duration;
    };
    this.getCustomId = function() {
      return customId;
    };
    this.getCurrentAdInstance = function() {
      return {
        getRendererController: function() {
          this.processEvent = function() {};
        },
        getEventCallback: function() {}
      };
    };
    this.getAdCount = function() {};
    this.play = function() {};
  };

  var initialize = function() {
    fw.initialize(amc);
    fw.registerUi();
    fw.loadMetadata({"fw_mrm_network_id":"100",
                     "html5_ssl_ad_server":"https://blah",
                     "html5_ad_server": "http://blah"},
                    {},
                    {});
    amc.timeline = fw.buildTimeline();
  };

  var play = function() {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
  };

  var prepareForPreroll = function(customId) {
    var ad = new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, customId);
    var adInstance = new AdInstance({
      name: 'freewilly',
      width: 340,
      height: 260,
      duration: 5,
      customId: customId
    });
    getTemporalSlots = function() {
      return [ ad ];
    };
    initialize();
    play();
    // Play ad request ad
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({ success: true });
    return adInstance;
  };

  before(_.bind(function() {
    OO.Ads = {
      manager: function(adManager){
        fw = adManager(_, $);
        fw.testMode = true;
      }
    };

    delete require.cache[require.resolve(SRC_ROOT + "freewheel.js")];
    require(SRC_ROOT + "freewheel.js");
  }, this));

  after(function() {
    var parentDom, element;
    _.each(document.getElementsByTagName('style'), function(oneStyle){
      if (oneStyle.innerHTML.indexOf("fw_") >= 0) {
        element = oneStyle;
        parentDom = oneStyle.parentNode;
        parentDom.removeChild(element);
      }
    });
    OO.Ads = originalOoAds;
  });

  beforeEach(function() {
    amc = new fake_amc();
    adsClickthroughOpenedCalled = 0;
  });

  afterEach(_.bind(function() {
    fwParams = {};
    fw.destroy();
    fwContext = null;
    getTemporalSlots = function() {};
    setVideoAsset = function() {};
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', function(){
    expect(typeof amc).to.be("object");
  });

  it('Init: mock fw is ready', function(){
    expect(typeof tv).to.be("object");
  });

  it('Init: ad manager is registered', function(){
    expect(fw).to.not.be(null);
  });

  it('Init: ad manager has the expected name', function(){
    expect(fw.name).to.be(name);
  });

  it('Init: ad manager handles the initialize function', function(){
    expect(function() { fw.initialize(amc); }).to.not.throwException();
  });

  it('Init: ad manager handles the registerUi function', function(){
    expect(function() { fw.registerUi(); }).to.not.throwException();
  });

  it('Init: ad manager handles the loadMetadata function', function(){
    var oldAmcReady = _.bind(amc.onAdManagerReady, amc);
    var createMp4Element = false;
    amc.onAdManagerReady = function(makeMp4) {
      createMp4Element = makeMp4;
      if (typeof oldAmcReady === "function") {
        oldAmcReady();
      }
    };
    fw.initialize(amc);
    fw.registerUi();
    fw.loadMetadata({"fw_mrm_network_id":"100",
                                         "html5_ssl_ad_server":"https://blah",
                                         "html5_ad_server": "http://blah"},
                                        {},
                                        {});
    expect(createMp4Element).to.be(true);
  });

  it('Init: ad manager notifies controller that it is loaded', function(){
    fw.initialize(amc);
    fw.registerUi();
    var pluginLoaded = false;
    amc.reportPluginLoaded = function(date, name){
      pluginLoaded = true;
    };
    expect(function() { fw.loadMetadata({"fw_mrm_network_id":"100",
                                         "html5_ssl_ad_server":"https://blah",
                                         "html5_ad_server": "http://blah"},
                                        {},
                                        {}); }).to.not.throwException();
    expect(pluginLoaded).to.be(true);
  });

  it('Init: test video asset override fw_video_asset_id vs video embedcode', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    fw.loadMetadata({
      "fw_video_asset_id":"testVideoAsset",
      "fw_mrm_network_id":"100",
      "html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"},
      {},
      {});

    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("testVideoAsset");
  });

  it('Init: test video asset override fw_video_asset_network_id vs video embedcode', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    fw.loadMetadata({
      "fw_video_asset_network_id":"testVideoAssetNetwork",
      "fw_mrm_network_id":"100",
      "html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"},
      {},
      {});

    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("testVideoAssetNetwork");
  });

  it('Init: test video asset override fw_video_asset_id vs fw_video_asset_network_id vs video embedcode', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    fw.loadMetadata({
      "fw_video_asset_id":"testVideoAsset",
      "fw_video_asset_network_id":"testVideoAssetNetwork",
      "fw_mrm_network_id":"100",
      "html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah"},
      {},
      {});

    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("testVideoAsset");
  });

  it('Init: ad manager can set video asset id to embed code in loadMetadata function when use_external_id is not provided', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    expect(function() { fw.loadMetadata(
      {"fw_mrm_network_id":"100",
        "html5_ssl_ad_server":"https://blah",
        "html5_ad_server": "http://blah",
        "use_external_id":false,
        "embedCode":"myEmbedCode"
      },
      {},
      {}); }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("myEmbedCode");
  });

  it('Init: test video asset override fw_video_asset_id vs fw_video_asset_network_id vs pagelevel embedCode vs video embedcode', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    fw.loadMetadata({
      "fw_video_asset_id":"testVideoAsset",
      "fw_video_asset_network_id":"testVideoAssetNetwork",
      "fw_mrm_network_id":"100",
      "html5_ssl_ad_server":"https://blah",
      "html5_ad_server": "http://blah",
      "use_external_id":false,
      "embedCode":"myEmbedCode"},
      {},
      {});

    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("testVideoAsset");
  });

  it('Init: ad manager can set video asset id to embed code in loadMetadata function when use_external_id is false', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    expect(function() { fw.loadMetadata(
      {"fw_mrm_network_id":"100",
        "html5_ssl_ad_server":"https://blah",
        "html5_ad_server": "http://blah",
        "use_external_id":false,
        "embedCode":"myEmbedCode"
      },
      {},
      {
        "external_id":"myExternalId"
      }); }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("myEmbedCode");
  });

  it('Init: ad manager can set video asset id to external id in loadMetadata function when use_external_id is true', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    expect(function() { fw.loadMetadata(
      {"fw_mrm_network_id":"100",
        "html5_ssl_ad_server":"https://blah",
        "html5_ad_server": "http://blah",
        "use_external_id":true,
        "embedCode":"myEmbedCode"
      },
      {},
      {
        "external_id":"myExternalId"
      }); }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("myExternalId");
  });

  it('Init: ad manager can set video asset id to embed code in loadMetadata function when use_external_id is true but there is no external id', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    expect(function() { fw.loadMetadata(
      {"fw_mrm_network_id":"100",
        "html5_ssl_ad_server":"https://blah",
        "html5_ad_server": "http://blah",
        "use_external_id":true,
        "embedCode":"myEmbedCode"
      },
      {},
      {}); }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("myEmbedCode");
  });

  it('Init: ad manager can set video asset id to external id with a filter in loadMetadata function when use_external_id is true', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    expect(function() { fw.loadMetadata(
      {"fw_mrm_network_id":"100",
        "html5_ssl_ad_server":"https://blah",
        "html5_ad_server": "http://blah",
        "use_external_id":true,
        "external_id_filter":"[^:]*$",
        "embedCode":"myEmbedCode"
      },
      {},
      {
        "external_id":"espn:myExternalId"
      }); }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("myExternalId");
  });

  it('Init: ad manager can set video asset id to external id with a non-applicable filter in loadMetadata function when use_external_id is true', function(){
    fw.initialize(amc);
    fw.registerUi();
    var videoAssetId = null;
    setVideoAsset = function(id) {
      videoAssetId = id;
    };
    expect(function() { fw.loadMetadata(
      {"fw_mrm_network_id":"100",
        "html5_ssl_ad_server":"https://blah",
        "html5_ad_server": "http://blah",
        "use_external_id":true,
        "external_id_filter":"",
        "embedCode":"myEmbedCode"
      },
      {},
      {
        "external_id":"espn:myExternalId"
      }); }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be("espn:myExternalId");
  });

  it('Init: ad manager is ready', function(){
    fw.initialize(amc);
    fw.registerUi();
    expect(fw.ready).to.be(false);
    fw.loadMetadata({"fw_mrm_network_id":"100",
                     "html5_ssl_ad_server":"https://blah",
                     "html5_ad_server": "http://blah"},
                    {},
                    {});
    expect(fw.ready).to.be(true);
  });

  it('Init: ad manager is ready', function(){
    fw.initialize(amc);
    fw.registerUi();
    expect(fw.ready).to.be(false);
    fw.loadMetadata({"fw_mrm_network_id":"100",
                     "html5_ssl_ad_server":"https://blah",
                     "html5_ad_server": "http://blah"},
                    {},
                    {});
    expect(fw.ready).to.be(true);
  });

  it('Init: fake ad is added to timeline', function(){
    initialize();
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
  });

  it('Init: fw context is set up', function(){
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0], function(){});
    expect(fwContext).to.not.be(null);
  });

  describe('Test Bitrate Override', function() {
    it('bitrateOverride valid string', function() {
      fw.initialize(amc);
      fw.registerUi();

      var metadata = {"fw_mrm_network_id":"100",
                      "html5_ssl_ad_server":"https://blah",
                      "html5_ad_server": "http://blah",
                      "bitrateOverride": "1005"};
      fw.loadMetadata(metadata, {}, {});
      amc.timeline = fw.buildTimeline();
      play();
      fw.playAd(amc.timeline[0]);
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE].value).to.be(1005);
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE].overrideLevel).to.be(tv.freewheel.SDK.PARAMETER_LEVEL_OVERRIDE);
    });

    it('bitrateOverride valid int', function() {
      fw.initialize(amc);
      fw.registerUi();

      var metadata = {"fw_mrm_network_id":"100",
                      "html5_ssl_ad_server":"https://blah",
                      "html5_ad_server": "http://blah",
                      "bitrateOverride": 1005};
      fw.loadMetadata(metadata, {}, {});
      amc.timeline = fw.buildTimeline();
      play();
      fw.playAd(amc.timeline[0]);
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE].value).to.be(1005);
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE].overrideLevel).to.be(tv.freewheel.SDK.PARAMETER_LEVEL_OVERRIDE);
    });

    it('bitrateOverride not specified', function() {
      fw.initialize(amc);
      fw.registerUi();

      var metadata = {"fw_mrm_network_id":"100",
                      "html5_ssl_ad_server":"https://blah",
                      "html5_ad_server": "http://blah",
                      };
      fw.loadMetadata(metadata, {}, {});
      amc.timeline = fw.buildTimeline();
      play();
      fw.playAd(amc.timeline[0]);
      //this param shouldn't have been set
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE]).to.be(undefined);
    });

    it('bitrateOverride bad input specified', function() {
      fw.initialize(amc);
      fw.registerUi();

      var metadata = {"fw_mrm_network_id":"100",
                      "html5_ssl_ad_server":"https://blah",
                      "html5_ad_server": "http://blah",
                      "bitrateOverride": "badInput"
                      };
      fw.loadMetadata(metadata, {}, {});
      amc.timeline = fw.buildTimeline();
      play();
      fw.playAd(amc.timeline[0]);
      //this param shouldn't have been set
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE]).to.be(undefined);
    });
  });

  it('Timeline: adds all valid slots', function() {
    getTemporalSlots = function(){
      return [
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, 1001),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, 1002),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_MIDROLL, 15, 5000, 1003),
          new fakeAd("Not an ad", 15, 5000, 1004),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_MIDROLL, 10, 5000, 1005),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY, 10, 5000, 1006),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_POSTROLL, 100000000, 5000, 1007)
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({"success":true});
    expect(amc.timeline.length).to.be(7);
  });

  it('Non-linear overlay: width and height are sent to AMC. No url is sent to the AMC', function() {
    var customId = 1234;
    var overlay = new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY, 10, 5000, customId);
    var width = -1;
    var height = -1;
    var sentUrl = null;
    amc.sendURLToLoadAndPlayNonLinearAd = function(ad, adId, url) {
      if (ad) {
        width = ad.width;
        height = ad.height;
        sentUrl = url;
      }
    };
    var adInstance = new AdInstance({
      name : "blah",
      width : 300,
      height : 50,
      duration : 5
    });
    getTemporalSlots = function(){
      return [
        overlay
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    //play ad request ad
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({"success":true});
    expect(amc.timeline.length).to.be(2);
    //play overlay
    fw.playAd(amc.timeline[1]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
      slotCustomId : customId,
      adInstance : adInstance
    });
    expect(width).to.be(300);
    expect(height).to.be(50);
    expect(sentUrl).to.not.be.ok();
  });

  it('Non-linear overlay: notifies AMC of end of non-linear ad', function() {
    var customId = 1234;
    var overlay = new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY, 10, 5000, customId);
    var notified = false;
    amc.notifyNonlinearAdEnded = function(adId) {
      notified = true;
    };
    var adInstance = new AdInstance({
      name : "blah",
      width : 300,
      height : 50,
      duration : 5,
      customId : customId
    });
    getTemporalSlots = function(){
      return [
        overlay
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    //play ad request ad
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({"success":true});
    expect(amc.timeline.length).to.be(2);
    //play overlay
    fw.playAd(amc.timeline[1]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
      slotCustomId : customId,
      adInstance : adInstance
    });
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION_END]({
      adInstance : adInstance
    });
    expect(notified).to.be(true);
  });

  it('Linear ad: notifies AMC of linear ad events', function() {
    var customId = 1234;
    var linearAd = new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 10, 5000, customId);
    var linearAdStartedCount = 0;
    var podStartedCount = 0;
    amc.notifyLinearAdStarted = function() {
      linearAdStartedCount++;
    };
    amc.notifyPodStarted = function() {
      podStartedCount++;
    };
    var adInstance = new AdInstance({
      name : "blah",
      width : 300,
      height : 50,
      duration : 5,
      customId : customId
    });
    getTemporalSlots = function(){
      return [
        linearAd
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    expect(linearAdStartedCount).to.be(0);
    expect(podStartedCount).to.be(0);
    //play ad request ad
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({"success":true});
    expect(linearAdStartedCount).to.be(0);
    expect(podStartedCount).to.be(1);
    expect(amc.timeline.length).to.be(2);
    //play linear ad
    fw.playAd(amc.timeline[1]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_SLOT_STARTED]({
      adInstance : adInstance
    });
    expect(linearAdStartedCount).to.be(0);
    expect(podStartedCount).to.be(1);

    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
      slotCustomId : customId,
      adInstance : adInstance
    });
    expect(linearAdStartedCount).to.be(1);
    expect(podStartedCount).to.be(2);

    //check that another ad in an ad pod does not throw another pod started event
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
      slotCustomId : customId,
      adInstance : adInstance
    });
    expect(linearAdStartedCount).to.be(2);
    expect(podStartedCount).to.be(2);
  });

  it('Ad Clickthrough: AMC\'s adsClickthroughOpened() should be called when FW\'s ads click event occurs', function() {
    amc.adsClickthroughOpened = function() {
      adsClickthroughOpenedCalled += 1;
    };
    getTemporalSlots = function(){
      return [
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, 1001),
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_CLICK]();
    expect(adsClickthroughOpenedCalled).to.be(1);
  });

  it('Ad Clickthrough: ad manager should handle player clicked logic for non ad requests', function() {
    amc.adsClickthroughOpened = function() {
      adsClickthroughOpenedCalled += 1;
    };
    getTemporalSlots = function(){
      return [
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, 1001),
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({"success":true});
    expect(amc.timeline.length).to.be(2);
    fw.playAd(amc.timeline[1]);
    fw.playerClicked();
    expect(fw.getHandlingClick()).to.be(true);
  });

  describe('Freewheel Context', function() {
    var videoState, volume;

    beforeEach(function() {
      videoState = null;
      volume = null;
      initialize();
      play();
      fw.playAd(amc.timeline[0]);

      fwContext.setVideoState = function(state) {
        videoState = state;
      };

      fwContext.setAdVolume = function(vol) {
        volume = vol;
      };
    });

    it('should set playing state after initial play', function() {
      amc.callbacks[amc.EVENTS.PLAY_STARTED]();
      expect(videoState).to.be(tv.freewheel.SDK.VIDEO_STATE_PLAYING);
    });

    it('should set paused state when content is paused', function() {
      amc.callbacks[amc.EVENTS.PAUSE]();
      expect(videoState).to.be(tv.freewheel.SDK.VIDEO_STATE_PAUSED);
    });

    it('should set playing state when content is resumed', function() {
      amc.callbacks[amc.EVENTS.RESUME]();
      expect(videoState).to.be(tv.freewheel.SDK.VIDEO_STATE_PLAYING);
    });

    it('should set stopped state when content ends', function() {
      amc.callbacks[amc.EVENTS.CONTENT_COMPLETED]();
      expect(videoState).to.be(tv.freewheel.SDK.VIDEO_STATE_STOPPED);
    });

    it('should set ad volume when ad impression ends', function() {
      amc.ui = {
        adVideoElement: [
          {
            muted: false,
            volume: 0.5
          }
        ]
      };

      var adInstance = new AdInstance({
        name : "blah",
        width : 300,
        height : 50,
        duration : 5
      });

      expect(volume).to.be(null);

      fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION_END]({
        adInstance : adInstance
      });

      expect(volume).to.be(0.5);
    });

    it('should mute via setAdVolume when ad impression ends if ad was muted', function() {
      amc.ui = {
        adVideoElement: [
          {
            muted: true,
            volume: 0.5
          }
        ]
      };

      var adInstance = new AdInstance({
        name : "blah",
        width : 300,
        height : 50,
        duration : 5
      });

      expect(volume).to.be(null);

      fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION_END]({
        adInstance : adInstance
      });

      expect(volume).to.be(0);
    });

    it('should notify linear ad started even if impression\'s event.slotCustomId property is missing', function() {
      var customId = 1234;
      var notified = false;
      amc.notifyLinearAdStarted = function() {
        notified = true;
      };
      var adInstance = prepareForPreroll(customId);
      // Play ad
      fw.playAd(amc.timeline[1]);
      fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
        slotCustomId: null,
        adInstance: adInstance
      });
      expect(notified).to.be(true);
    });

    // Shouldn't happen, but we should be able to fall back to the previous behavior if it did
    it('should fall back to impression\'s event.slotCustomId property if slot.getCustomId() fails', function() {
      var customId = 1234;
      var notified = false;
      amc.notifyLinearAdStarted = function() {
        notified = true;
      };
      var adInstance = prepareForPreroll(customId);
      // Override custom id
      adInstance.getSlot = function() {
        return {
          getCustomId: function() {
            return null;
          }
        };
      };
      // Play ad
      fw.playAd(amc.timeline[1]);
      fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
        slotCustomId: customId,
        adInstance: adInstance
      });
      expect(notified).to.be(true);
    });

  });

});
