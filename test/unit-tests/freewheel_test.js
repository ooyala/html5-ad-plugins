/* eslint-disable require-jsdoc,import/no-dynamic-require */
/*
 * Unit test class for the Freewheel Ad Manager
 * https://github.com/Automattic/expect.js
 */

// stubs
OO.log = function () {};
require(`${TEST_ROOT}unit-test-helpers/mock_amc.js`);
require(`${TEST_ROOT}unit-test-helpers/mock_fw.js`);

describe('ad_manager_freewheel', function () {
  let amc;
  let fw;
  const name = 'freewheel-ads-manager';
  const originalOoAds = _.clone(OO.Ads);

  let adsClickthroughOpenedCalled;

  // Helper functions
  const FakeAd = function (timePositionClass, position, duration, customId) {
    this.getTimePositionClass = function () {
      return timePositionClass;
    };
    this.getTimePosition = function () {
      return position;
    };
    this.getTotalDuration = function () {
      return duration;
    };
    this.getCustomId = function () {
      return customId;
    };
    this.getCurrentAdInstance = function () {
      return {
        getRendererController() {
          this.processEvent = function () {
          };
        },
        getEventCallback() {
        },
      };
    };
    this.getAdCount = function () {
    };
    this.play = function () {
    };
  };

  const initialize = function () {
    fw.initialize(amc);
    fw.registerUi();
    fw.loadMetadata({
      fw_mrm_network_id: '100',
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    },
    {},
    {});
    amc.timeline = fw.buildTimeline();
  };

  const play = function () {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
  };

  const prepareForPreroll = function (customId) {
    const ad = new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, customId);
    const adInstance = new AdInstance({
      name: 'freewilly',
      width: 340,
      height: 260,
      duration: 5,
      customId,
    });
    getTemporalSlots = function () {
      return [ad];
    };
    initialize();
    play();
    // Play ad request ad
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({ success: true });
    return adInstance;
  };

  before(_.bind(() => {
    OO.Ads = {
      manager(adManager) {
        fw = adManager(_, $);
        fw.testMode = true;
      },
    };

    delete require.cache[require.resolve(`${SRC_ROOT}freewheel.js`)];
    // eslint-disable-next-line global-require
    require(`${SRC_ROOT}freewheel.js`);
  }, this));

  after(() => {
    let parentDom;
    let
      element;
    _.each(document.getElementsByTagName('style'), (oneStyle) => {
      if (oneStyle && oneStyle.innerHTML.indexOf('fw_') >= 0) {
        element = oneStyle;
        parentDom = oneStyle.parentNode;
        parentDom.removeChild(element);
      }
    });
    OO.Ads = originalOoAds;
  });

  beforeEach(() => {
    amc = new FakeAmc();
    adsClickthroughOpenedCalled = 0;
  });

  afterEach(_.bind(() => {
    fwParams = {};
    fw.destroy();
    fwContext = null;
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', () => {
    expect(typeof amc).to.be('object');
  });

  it('Init: mock fw is ready', () => {
    expect(typeof tv).to.be('object');
  });

  it('Init: ad manager is registered', () => {
    expect(fw).to.not.be(null);
  });

  it('Init: ad manager has the expected name', () => {
    expect(fw.name).to.be(name);
  });

  it('Init: ad manager handles the initialize function', () => {
    expect(() => {
      fw.initialize(amc);
    }).to.not.throwException();
  });

  it('Init: ad manager handles the registerUi function', () => {
    expect(() => {
      fw.registerUi();
    }).to.not.throwException();
  });

  it('Init: ad manager handles the loadMetadata function', () => {
    const oldAmcReady = _.bind(amc.onAdManagerReady, amc);
    let createMp4Element = false;
    amc.onAdManagerReady = function (makeMp4) {
      createMp4Element = makeMp4;
      if (typeof oldAmcReady === 'function') {
        oldAmcReady();
      }
    };
    fw.initialize(amc);
    fw.registerUi();
    fw.loadMetadata({
      fw_mrm_network_id: '100',
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    },
    {},
    {});
    expect(createMp4Element).to.be(true);
  });

  it('Init: ad manager notifies controller that it is loaded', () => {
    fw.initialize(amc);
    fw.registerUi();
    let pluginLoaded = false;
    amc.reportPluginLoaded = function () {
      pluginLoaded = true;
    };
    expect(() => {
      fw.loadMetadata({
        fw_mrm_network_id: '100',
        html5_ssl_ad_server: 'https://blah',
        html5_ad_server: 'http://blah',
      },
      {},
      {});
    }).to.not.throwException();
    expect(pluginLoaded).to.be(true);
  });

  it('Init: test video asset override fw_video_asset_id vs video embedcode', () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    fw.loadMetadata({
      fw_video_asset_id: 'testVideoAsset',
      fw_mrm_network_id: '100',
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    },
    {},
    {});

    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('testVideoAsset');
  });

  it('Init: test video asset override fw_video_asset_network_id vs video embedcode', () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    fw.loadMetadata({
      fw_video_asset_network_id: 'testVideoAssetNetwork',
      fw_mrm_network_id: '100',
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    },
    {},
    {});

    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('testVideoAssetNetwork');
  });

  it(`Init: test video asset override fw_video_asset_id
    vs fw_video_asset_network_id vs video embedcode`, () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    fw.loadMetadata({
      fw_video_asset_id: 'testVideoAsset',
      fw_video_asset_network_id: 'testVideoAssetNetwork',
      fw_mrm_network_id: '100',
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    },
    {},
    {});

    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('testVideoAsset');
  });

  it(`Init: ad manager can set video asset id to embed code in loadMetadata function
    when use_external_id is not provided`, () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    expect(() => {
      fw.loadMetadata(
        {
          fw_mrm_network_id: '100',
          html5_ssl_ad_server: 'https://blah',
          html5_ad_server: 'http://blah',
          use_external_id: false,
          embedCode: 'myEmbedCode',
        },
        {},
        {},
      );
    }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('myEmbedCode');
  });

  it(`Init: test video asset override fw_video_asset_id vs fw_video_asset_network_id
    vs pagelevel embedCode vs video embedcode`, () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    fw.loadMetadata({
      fw_video_asset_id: 'testVideoAsset',
      fw_video_asset_network_id: 'testVideoAssetNetwork',
      fw_mrm_network_id: '100',
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
      use_external_id: false,
      embedCode: 'myEmbedCode',
    },
    {},
    {});

    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('testVideoAsset');
  });

  it(`Init: ad manager can set video asset id to embed code in loadMetadata function
    when use_external_id is false`, () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    expect(() => {
      fw.loadMetadata(
        {
          fw_mrm_network_id: '100',
          html5_ssl_ad_server: 'https://blah',
          html5_ad_server: 'http://blah',
          use_external_id: false,
          embedCode: 'myEmbedCode',
        },
        {},
        {
          external_id: 'myExternalId',
        },
      );
    }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('myEmbedCode');
  });

  it(`Init: ad manager can set video asset id to external id in loadMetadata function
    when use_external_id is true`, () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    expect(() => {
      fw.loadMetadata(
        {
          fw_mrm_network_id: '100',
          html5_ssl_ad_server: 'https://blah',
          html5_ad_server: 'http://blah',
          use_external_id: true,
          embedCode: 'myEmbedCode',
        },
        {},
        {
          external_id: 'myExternalId',
        },
      );
    }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('myExternalId');
  });

  it(`Init: ad manager can set video asset id to embed code in loadMetadata function when
    use_external_id is true but there is no external id`, () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    expect(() => {
      fw.loadMetadata(
        {
          fw_mrm_network_id: '100',
          html5_ssl_ad_server: 'https://blah',
          html5_ad_server: 'http://blah',
          use_external_id: true,
          embedCode: 'myEmbedCode',
        },
        {},
        {},
      );
    }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('myEmbedCode');
  });

  it(`Init: ad manager can set video asset id to external id with a filter in loadMetadata function when
    use_external_id is true`, () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    expect(() => {
      fw.loadMetadata(
        {
          fw_mrm_network_id: '100',
          html5_ssl_ad_server: 'https://blah',
          html5_ad_server: 'http://blah',
          use_external_id: true,
          external_id_filter: '[^:]*$',
          embedCode: 'myEmbedCode',
        },
        {},
        {
          external_id: 'espn:myExternalId',
        },
      );
    }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('myExternalId');
  });

  it(`Init: ad manager can set video asset id to external id with
    a non-applicable filter in loadMetadata function when use_external_id is true`, () => {
    fw.initialize(amc);
    fw.registerUi();
    let videoAssetId = null;
    setVideoAsset = function (id) {
      videoAssetId = id;
    };
    expect(() => {
      fw.loadMetadata(
        {
          fw_mrm_network_id: '100',
          html5_ssl_ad_server: 'https://blah',
          html5_ad_server: 'http://blah',
          use_external_id: true,
          external_id_filter: '',
          embedCode: 'myEmbedCode',
        },
        {},
        {
          external_id: 'espn:myExternalId',
        },
      );
    }).to.not.throwException();
    amc.timeline = fw.buildTimeline();
    play();
    fw.playAd(amc.timeline[0]);
    expect(videoAssetId).to.be('espn:myExternalId');
  });

  it('Init: ad manager is ready', () => {
    fw.initialize(amc);
    fw.registerUi();
    expect(fw.ready).to.be(false);
    fw.loadMetadata({
      fw_mrm_network_id: '100',
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    },
    {},
    {});
    expect(fw.ready).to.be(true);
  });

  it('Init: ad manager is ready', () => {
    fw.initialize(amc);
    fw.registerUi();
    expect(fw.ready).to.be(false);
    fw.loadMetadata({
      fw_mrm_network_id: '100',
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    },
    {},
    {});
    expect(fw.ready).to.be(true);
  });

  it('Init: fake ad is added to timeline', () => {
    initialize();
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.AD_REQUEST);
  });

  it('Init: fw context is set up', () => {
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0], () => {
    });
    expect(fwContext).to.not.be(null);
  });

  describe('Test Bitrate Override', () => {
    it('bitrateOverride valid string', () => {
      fw.initialize(amc);
      fw.registerUi();

      const metadata = {
        fw_mrm_network_id: '100',
        html5_ssl_ad_server: 'https://blah',
        html5_ad_server: 'http://blah',
        bitrateOverride: '1005',
      };
      fw.loadMetadata(metadata, {}, {});
      amc.timeline = fw.buildTimeline();
      play();
      fw.playAd(amc.timeline[0]);
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE].value).to.be(1005);
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE].overrideLevel).to.be(
        tv.freewheel.SDK.PARAMETER_LEVEL_OVERRIDE,
      );
    });

    it('bitrateOverride valid int', () => {
      fw.initialize(amc);
      fw.registerUi();

      const metadata = {
        fw_mrm_network_id: '100',
        html5_ssl_ad_server: 'https://blah',
        html5_ad_server: 'http://blah',
        bitrateOverride: 1005,
      };
      fw.loadMetadata(metadata, {}, {});
      amc.timeline = fw.buildTimeline();
      play();
      fw.playAd(amc.timeline[0]);
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE].value).to.be(1005);
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE].overrideLevel).to.be(
        tv.freewheel.SDK.PARAMETER_LEVEL_OVERRIDE,
      );
    });

    it('bitrateOverride not specified', () => {
      fw.initialize(amc);
      fw.registerUi();

      const metadata = {
        fw_mrm_network_id: '100',
        html5_ssl_ad_server: 'https://blah',
        html5_ad_server: 'http://blah',
      };
      fw.loadMetadata(metadata, {}, {});
      amc.timeline = fw.buildTimeline();
      play();
      fw.playAd(amc.timeline[0]);
      // this param shouldn't have been set
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE]).to.be(undefined);
    });

    it('bitrateOverride bad input specified', () => {
      fw.initialize(amc);
      fw.registerUi();

      const metadata = {
        fw_mrm_network_id: '100',
        html5_ssl_ad_server: 'https://blah',
        html5_ad_server: 'http://blah',
        bitrateOverride: 'badInput',
      };
      fw.loadMetadata(metadata, {}, {});
      amc.timeline = fw.buildTimeline();
      play();
      fw.playAd(amc.timeline[0]);
      // this param shouldn't have been set
      expect(fwParams[tv.freewheel.SDK.PARAMETER_DESIRED_BITRATE]).to.be(undefined);
    });
  });

  it('Timeline: adds all valid slots', () => {
    getTemporalSlots = function () {
      return [
        new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, 1001),
        new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, 1002),
        new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_MIDROLL, 15, 5000, 1003),
        new FakeAd('Not an ad', 15, 5000, 1004),
        new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_MIDROLL, 10, 5000, 1005),
        new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY, 10, 5000, 1006),
        new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_POSTROLL, 100000000, 5000, 1007),
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({ success: true });
    expect(amc.timeline.length).to.be(7);
  });

  it('Non-linear overlay: width and height are sent to AMC. No url is sent to the AMC', () => {
    const customId = 1234;
    const overlay = new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY, 10, 5000, customId);
    let width = -1;
    let height = -1;
    let sentUrl = null;
    amc.sendURLToLoadAndPlayNonLinearAd = function (ad, adId, url) {
      if (ad) {
        /* eslint-disable prefer-destructuring */
        width = ad.width;
        height = ad.height;
        /* eslint-enable prefer-destructuring */
        sentUrl = url;
      }
    };
    const adInstance = new AdInstance({
      name: 'blah',
      width: 300,
      height: 50,
      duration: 5,
    });
    getTemporalSlots = function () {
      return [
        overlay,
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    // play ad request ad
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({ success: true });
    expect(amc.timeline.length).to.be(2);
    // play overlay
    fw.playAd(amc.timeline[1]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
      slotCustomId: customId,
      adInstance,
    });
    expect(width).to.be(300);
    expect(height).to.be(50);
    expect(sentUrl).to.not.be.ok();
  });

  it('Non-linear overlay: notifies AMC of end of non-linear ad', () => {
    const customId = 1234;
    const overlay = new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY, 10, 5000, customId);
    let notified = false;
    amc.notifyNonlinearAdEnded = function () {
      notified = true;
    };
    const adInstance = new AdInstance({
      name: 'blah',
      width: 300,
      height: 50,
      duration: 5,
      customId,
    });
    getTemporalSlots = function () {
      return [
        overlay,
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    // play ad request ad
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({ success: true });
    expect(amc.timeline.length).to.be(2);
    // play overlay
    fw.playAd(amc.timeline[1]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
      slotCustomId: customId,
      adInstance,
    });
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION_END]({
      adInstance,
    });
    expect(notified).to.be(true);
  });

  it('Linear ad: notifies AMC of linear ad events', () => {
    const customId = 1234;
    const linearAd = new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 10, 5000, customId);
    let linearAdStartedCount = 0;
    let podStartedCount = 0;
    let focusAdVideoCount = 0;
    amc.focusAdVideo = function () {
      focusAdVideoCount += 1;
    };
    amc.notifyLinearAdStarted = function () {
      linearAdStartedCount += 1;
    };
    amc.notifyPodStarted = function () {
      podStartedCount += 1;
    };
    const adInstance = new AdInstance({
      name: 'blah',
      width: 300,
      height: 50,
      duration: 5,
      customId,
    });
    getTemporalSlots = function () {
      return [
        linearAd,
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    expect(linearAdStartedCount).to.be(0);
    expect(podStartedCount).to.be(0);
    // play ad request ad
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({ success: true });
    expect(linearAdStartedCount).to.be(0);
    expect(podStartedCount).to.be(1);
    expect(amc.timeline.length).to.be(2);
    // play linear ad
    fw.playAd(amc.timeline[1]);
    expect(focusAdVideoCount).to.be(0);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_SLOT_STARTED]({
      adInstance,
    });
    expect(focusAdVideoCount).to.be(1);
    expect(linearAdStartedCount).to.be(0);
    expect(podStartedCount).to.be(1);

    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
      slotCustomId: customId,
      adInstance,
    });
    expect(linearAdStartedCount).to.be(1);
    expect(podStartedCount).to.be(2);

    // check that another ad in an ad pod does not throw another pod started event
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
      slotCustomId: customId,
      adInstance,
    });
    expect(linearAdStartedCount).to.be(2);
    expect(podStartedCount).to.be(2);
  });

  it(`Ad Clickthrough: AMC's adsClickthroughOpened() should be called
    when FW's ads click event occurs`, () => {
    amc.adsClickthroughOpened = function () {
      adsClickthroughOpenedCalled += 1;
    };
    getTemporalSlots = function () {
      return [
        new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, 1001),
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_CLICK]();
    expect(adsClickthroughOpenedCalled).to.be(1);
  });

  it('Ad Clickthrough: ad manager should handle player clicked logic for non ad requests', () => {
    amc.adsClickthroughOpened = function () {
      adsClickthroughOpenedCalled += 1;
    };
    getTemporalSlots = function () {
      return [
        new FakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000, 1001),
      ];
    };
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0]);
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({ success: true });
    expect(amc.timeline.length).to.be(2);
    fw.playAd(amc.timeline[1]);
    fw.playerClicked();
    expect(fw.getHandlingClick()).to.be(true);
  });

  describe('Freewheel Context', () => {
    let videoState;
    let
      volume;

    beforeEach(() => {
      videoState = null;
      volume = null;
      initialize();
      play();
      fw.playAd(amc.timeline[0]);

      fwContext.setVideoState = function (state) {
        videoState = state;
      };

      fwContext.setAdVolume = function (vol) {
        volume = vol;
      };
    });

    it('should set playing state after initial play', () => {
      amc.callbacks[amc.EVENTS.PLAY_STARTED]();
      expect(videoState).to.be(tv.freewheel.SDK.VIDEO_STATE_PLAYING);
    });

    it('should set paused state when content is paused', () => {
      amc.callbacks[amc.EVENTS.PAUSE]();
      expect(videoState).to.be(tv.freewheel.SDK.VIDEO_STATE_PAUSED);
    });

    it('should set playing state when content is resumed', () => {
      amc.callbacks[amc.EVENTS.RESUME]();
      expect(videoState).to.be(tv.freewheel.SDK.VIDEO_STATE_PLAYING);
    });

    it('should set stopped state when content ends', () => {
      amc.callbacks[amc.EVENTS.CONTENT_COMPLETED]();
      expect(videoState).to.be(tv.freewheel.SDK.VIDEO_STATE_STOPPED);
    });

    it('should set ad volume when ad impression ends', () => {
      amc.ui = {
        adVideoElement: [
          {
            muted: false,
            volume: 0.5,
          },
        ],
      };

      const adInstance = new AdInstance({
        name: 'blah',
        width: 300,
        height: 50,
        duration: 5,
      });

      expect(volume).to.be(null);

      fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION_END]({
        adInstance,
      });

      expect(volume).to.be(0.5);
    });

    it('should mute via setAdVolume when ad impression ends if ad was muted', () => {
      amc.ui = {
        adVideoElement: [
          {
            muted: true,
            volume: 0.5,
          },
        ],
      };

      const adInstance = new AdInstance({
        name: 'blah',
        width: 300,
        height: 50,
        duration: 5,
      });

      expect(volume).to.be(null);

      fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION_END]({
        adInstance,
      });

      expect(volume).to.be(0);
    });

    it('should notify linear ad started even if impression\'s event.slotCustomId property is missing', () => {
      const customId = 1234;
      let notified = false;
      amc.notifyLinearAdStarted = function () {
        notified = true;
      };
      const adInstance = prepareForPreroll(customId);
      // Play ad
      fw.playAd(amc.timeline[1]);
      fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
        slotCustomId: null,
        adInstance,
      });
      expect(notified).to.be(true);
    });

    // Shouldn't happen, but we should be able to fall back to the previous behavior if it did
    it('should fall back to impression\'s event.slotCustomId property if slot.getCustomId() fails', () => {
      const customId = 1234;
      let notified = false;
      amc.notifyLinearAdStarted = function () {
        notified = true;
      };
      const adInstance = prepareForPreroll(customId);
      // Override custom id
      adInstance.getSlot = function () {
        return {
          getCustomId() {
            return null;
          },
        };
      };
      // Play ad
      fw.playAd(amc.timeline[1]);
      fwContext.callbacks[tv.freewheel.SDK.EVENT_AD_IMPRESSION]({
        slotCustomId: customId,
        adInstance,
      });
      expect(notified).to.be(true);
    });
  });
});
