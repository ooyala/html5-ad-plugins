/*
 * Unit test class for the Google IMA Ad Manager
 * https://github.com/Automattic/expect.js
 */

const {
  each,
} = require('underscore');

// stubs
OO.log = function () {
};

describe('ad_manager_ima', function () {
  let amc;
  let
    ima;
  let imaVideoPluginFactory;
  let videoWrapper;
  let imaIframe;
  const name = 'google-ima-ads-manager';
  const playerId = 'ima-player-id';
  const originalOoAds = _.clone(OO.Ads);
  const originalOoVideo = _.clone(OO.Video);
  let notifyEventNameHistory = [];
  let notifyParamHistory = [];
  let notifyEventName = null;
  let notifyParams = null;
  let adsClickthroughOpenedCalled;
  let originalRequiresMutedAutoplay;

  require(`${TEST_ROOT}unit-test-helpers/mock_amc.js`);
  require(`${TEST_ROOT}unit-test-helpers/mock_ima.js`);

  // mock video controller interface
  const vci = {
    notify(eventName, params) {
      if (notifyEventName) {
        notifyEventNameHistory.push(notifyEventName);
        notifyParamHistory.push(notifyParams);
      }
      notifyEventName = eventName;
      notifyParams = params;
    },
    EVENTS:
      {
        PLAY: 'play', // TOOD : Consider renaming
        PLAYING: 'playing',
        ENDED: 'ended',
        ERROR: 'error',
        SEEKING: 'seeking',
        SEEKED: 'seeked',
        PAUSED: 'paused',
        RATE_CHANGE: 'ratechange',
        STALLED: 'stalled',
        TIME_UPDATE: 'timeupdate',
        VOLUME_CHANGE: 'volumechange',
        BUFFERING: 'buffering',
        BUFFERED: 'buffered',
        DURATION_CHANGE: 'durationchange',
        PROGRESS: 'progress',
        WAITING: 'waiting',
        FULLSCREEN_CHANGED: 'fullScreenChanged',
        MUTE_STATE_CHANGE: 'muteStateChange',
      },
  };

  // IMA constants
  const AD_RULES_POSITION_TYPE = 'r';
  const NON_AD_RULES_POSITION_TYPE = 't';

  // Helper functions

  const initialize = function (adRules, showAdControls) {
    ima.initialize(amc, playerId);
    ima.registerUi();
    const ad = {
      tag_url: 'https://blah',
      position_type: adRules ? AD_RULES_POSITION_TYPE : NON_AD_RULES_POSITION_TYPE,
    };
    const content = {
      all_ads: [ad],
    };

    if (typeof showAdControls !== 'undefined') {
      content.showAdControls = showAdControls;
    }
    ima.loadMetadata(content, {}, {
      duration: 60000,
    });
    amc.timeline = ima.buildTimeline();
  };

  const play = function (autoplayed) {
    const event = amc.EVENTS.INITIAL_PLAY_REQUESTED;
    amc.callbacks[event](event, autoplayed);
  };

  const createVideoWrapper = function (vc) {
    videoWrapper = imaVideoPluginFactory.create(null, null, vc, null, playerId);
  };

  const initAndPlay = function (adRules, vc, autoplayed, showAdControls) {
    initialize(adRules, showAdControls);
    createVideoWrapper(vc);
    play(autoplayed);
  };

  before(_.bind(() => {
    imaIframe = $('<iframe src=\'http://imasdk.googleapis.com/\'></iframe>');
    $('body').append(imaIframe);

    OO.Ads = {
      manager(adManager) {
        ima = adManager(_, $);
        ima.runningUnitTests = true;
      },
    };

    OO.Video = {
      plugin(plugin) {
        imaVideoPluginFactory = plugin;
      },
    };

    OO.getLocale = function () {
      return 'en';
    };
    delete require.cache[require.resolve(`${SRC_ROOT}google_ima.js`)];
    require(`${SRC_ROOT}google_ima.js`);
  }, this));

  after(() => {
    OO.Ads = originalOoAds;
    OO.Video = originalOoVideo;
    imaIframe.remove();
  });

  beforeEach(() => {
    originalRequiresMutedAutoplay = ima.requiresMutedAutoplay;
    amc = new fake_amc();
    adsClickthroughOpenedCalled = 0;
  });

  afterEach(_.bind(() => {
    ima.requiresMutedAutoplay = originalRequiresMutedAutoplay;
    if (videoWrapper) {
      videoWrapper.destroy();
      videoWrapper = null;
    }
    ima.destroy();
    if (google.ima.adManagerInstance) {
      google.ima.adManagerInstance.destroy();
    }
    if (google.ima.adLoaderInstance) {
      google.ima.adLoaderInstance.destroy();
    }
    google.ima.resetDefaultValues();
    notifyEventName = null;
    notifyParams = null;
    notifyEventNameHistory = [];
    notifyParamHistory = [];
    OO.isChrome = false;
    OO.chromeMajorVersion = null;
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', () => {
    expect(typeof amc).to.be('object');
  });

  it('Init: mock ima is ready', () => {
    expect(typeof google).to.be('object');
  });

  it('Init: ad manager is registered', () => {
    expect(typeof ima).to.be('object');
  });

  it('Init: ad manager has the expected name', () => {
    expect(ima.name).to.be(name);
  });

  it('Init: ad manager handles the initialize function', () => {
    expect(() => {
      ima.initialize(amc, playerId);
    }).to.not.throwException();
  });

  it('Init: VTC Integration is creatable after ad manager is initialized', () => {
    ima.initialize(amc, playerId);
    videoWrapper = imaVideoPluginFactory.create(null, null, null, null, playerId);
    expect(typeof videoWrapper).to.be('object');
  });

  it('Init: VTC Integration is creatable from existing element after ad manager is initialized', () => {
    ima.initialize(amc, playerId);
    const wrapper = imaVideoPluginFactory.createFromExisting('domId', {}, playerId);
    expect(typeof wrapper).to.be('object');
  });

  it('Init: ad manager handles the registerUi function', () => {
    expect(() => {
      ima.registerUi();
    }).to.not.throwException();
  });

  it('Init: ad manager handles the loadMetadata function', () => {
    const ad = {
      tag_url: 'https://blah',
      position_type: AD_RULES_POSITION_TYPE,
    };
    const content = {
      all_ads: [ad],
    };
    ima.initialize(amc, playerId);
    expect(() => {
      ima.loadMetadata(content, {}, {});
    }).to.not.throwException();
  });

  it('Init: ad manager accepts valid finite number timeout values', () => {
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = 7000;
    initialize();
    expect(ima.maxAdsRequestTimeout).to.be(7000);
  });

  it('Init: ad manager ignores null timeout values', () => {
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = null;
    initialize();
    // Value of DEFAULT_ADS_REQUEST_TIME_OUT
    expect(ima.maxAdsRequestTimeout).to.be(15000);
  });

  it('Init: ad manager ignores undefined timeout values', () => {
    amc.adManagerSettings = {};
    initialize();
    // Value of DEFAULT_ADS_REQUEST_TIME_OUT
    expect(ima.maxAdsRequestTimeout).to.be(15000);
  });

  it('Init: ad manager ignores string timeout values', () => {
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = 'hello';
    initialize();
    // Value of DEFAULT_ADS_REQUEST_TIME_OUT
    expect(ima.maxAdsRequestTimeout).to.be(15000);
  });

  it('Init: ad manager ignores object timeout values', () => {
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = {};
    initialize();
    // Value of DEFAULT_ADS_REQUEST_TIME_OUT
    expect(ima.maxAdsRequestTimeout).to.be(15000);
  });

  it('Init: ad manager ignores function timeout values', () => {
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = function () {
    };
    initialize();
    // Value of DEFAULT_ADS_REQUEST_TIME_OUT
    expect(ima.maxAdsRequestTimeout).to.be(15000);
  });

  it('Init: ad manager is ready', () => {
    ima.initialize(amc, playerId);
    ima.registerUi();
    expect(ima.ready).to.be(false);
    const ad = {
      tag_url: 'https://blah',
      position_type: AD_RULES_POSITION_TYPE,
    };
    const content = {
      all_ads: [ad],
    };
    ima.loadMetadata(content, {}, {});
    expect(ima.ready).to.be(true);
  });

  it('Init: ad manager notifies controller that it is loaded', () => {
    ima.initialize(amc, playerId);
    ima.registerUi();
    let pluginLoaded = false;
    amc.reportPluginLoaded = function () {
      pluginLoaded = true;
    };
    ima.loadMetadata({}, {}, {});
    expect(pluginLoaded).to.be(true);
  });

  it('Init: ad sdk loads successfully', () => {
    let sdkLoaded = false;
    amc.onAdSdkLoaded = function () {
      sdkLoaded = true;
    };
    ima.initialize(amc, playerId);
    expect(sdkLoaded).to.be(true);
  });

  // Ad Rules
  it('Init, Ad Rules: setup ads request is successful', () => {
    initialize(true);
    play();
    expect(ima.adsRequested).to.be(true);
  });

  it(`Init, Ad Rules: setup ads request notifies amc that
   the IMA ad manager for ad rules will control ad playback`, () => {
    let notified = false;
    amc.adManagerWillControlAds = function (adManagerName) {
      if (adManagerName === name) {
        notified = true;
      }
    };
    initialize(true);
    play();
    expect(notified).to.be(true);
  });

  it('Init, Ad Rules: fake ad is added to timeline for ad rules ads', () => {
    initialize(true);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].adType).to.be(amc.ADTYPE.UNKNOWN_AD_REQUEST);
  });

  it(`Init, Ad Rules: fake ad starts and ends properly when IMA ads manager 
  is initialized and there is no preroll`, () => {
    google.ima.delayAdRequest = true;
    let endNotified = false;
    let startNotified = false;
    amc.notifyPodStarted = function (adId) {
      // current placeholder id is undefined, update this when this changes
      if (typeof adId === 'undefined') {
        startNotified = true;
      }
    };
    amc.notifyPodEnded = function (adId) {
      // current placeholder id is undefined, update this when this changes
      if (typeof adId === 'undefined') {
        endNotified = true;
      }
    };
    initialize(true);
    // This line mimics the ad pod having been set by the time the ad request success returns
    // This is a hack, will revisit in the future, but does properly test to see that the fake ad
    // ends when an ad request is successful
    ima.currentAMCAdPod = amc.timeline[0];
    play();
    expect(startNotified).to.be(false);
    expect(endNotified).to.be(false);

    google.ima.delayedAdRequestCallback();
    expect(startNotified).to.be(true);
    expect(endNotified).to.be(true);
  });

  // Non-Ad Rules
  it('Init, Non-Ad Rules: ad is added to timeline for non-ad rules ads', () => {
    initialize(false);
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].ad.type).not.to.be('adRequest');
  });

  it('Init, Non-Ad Rules: setup ads request is successful', () => {
    initialize(false);
    play();
    ima.playAd(amc.timeline[0]);
    expect(ima.adsRequested).to.be(true);
  });

  it('Play ad: Requests the AMC to hide the player UI', () => {
    let notified = false;
    amc.hidePlayerUi = function (showAdControls, showAdMarquee) {
      expect(showAdControls).to.be(false);
      expect(showAdMarquee).to.be(false);
      notified = true;
    };
    initAndPlay(true, vci);
    ima.playAd(amc.timeline[0]);
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(notified).to.be(true);
  });

  it('Play ad: Metadata setting can choose to show the ad controls while hiding player UI', () => {
    let notified = false;
    amc.hidePlayerUi = function (showAdControls, showAdMarquee) {
      expect(showAdControls).to.be(true);
      expect(showAdMarquee).to.be(false);
      notified = true;
    };
    ima.initialize(amc, playerId);
    ima.registerUi();
    const ad = {
      tag_url: 'https://blah',
      position_type: AD_RULES_POSITION_TYPE,
    };
    const content = {
      all_ads: [ad],
      showAdControls: true,
    };
    ima.loadMetadata(content, {}, {});
    amc.timeline = ima.buildTimeline();
    createVideoWrapper(vci);
    play();
    ima.playAd(amc.timeline[0]);
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(notified).to.be(true);
  });

  describe('Show Ad Control tests', () => {
    beforeEach(() => {
      ima.initialize(amc, 'blah');
      amc.adManagerSettings = {};
    });

    it('Show Ad Controls Override: playerControlsOverAds = true shows ad controls', () => {
      amc.pageSettings.playerControlsOverAds = true;
      ima.loadMetadata({}, {}, {});
      expect(ima.showAdControls).to.be(true);
    });

    it('Show Ad Controls Override: playerControlsOverAds = true shows ad controls', () => {
      amc.pageSettings.playerControlsOverAds = true;
      const metadata = {
        showAdControls: true,
      };
      ima.loadMetadata(metadata, {}, {});
      expect(ima.showAdControls).to.be(true);
    });

    it('Show Ad Controls Override: playerControlsOverAds = true overrides showAdControls', () => {
      amc.pageSettings.playerControlsOverAds = true;
      const metadata = {
        showAdControls: false,
      };
      ima.loadMetadata(metadata, {}, {});
      expect(ima.showAdControls).to.be(true);
    });

    it('Show Ad Controls Override: playerControlsOverAds = false does not override showAdControls', () => {
      amc.pageSettings.playerControlsOverAds = false;
      const metadata = {
        showAdControls: true,
      };
      ima.loadMetadata(metadata, {}, {});
      expect(ima.showAdControls).to.be(true);
      expect(ima.autoHideAdControls).to.be(false);
    });

    it(`Show Ad Controls Override: playerControlsOverAds = false and showAdControls
     = false results in no controls`, () => {
      amc.pageSettings.playerControlsOverAds = false;
      const metadata = {
        showAdControls: false,
      };
      ima.loadMetadata(metadata, {}, {});
      expect(ima.showAdControls).to.be(false);
      expect(ima.autoHideAdControls).to.be(true);
    });

    it('Autohide ad controls should be enabled if we are showing the controls over the ads.', () => {
      amc.pageSettings.playerControlsOverAds = true;
      const metadata = {
        showAdControls: true,
      };
      ima.loadMetadata(metadata, {}, {});
      expect(ima.showAdControls).to.be(true);
      expect(ima.autoHideAdControls).to.be(true);
    });

    it('Play ad: Requests the AMC to hide the player UI by default', () => {
      let notified = false;
      amc.hidePlayerUi = function (showAdControls, showAdMarquee, autoHideAdControls) {
        expect(showAdControls).to.be(false);
        expect(autoHideAdControls).to.be(true);
        notified = true;
      };
      initAndPlay(true, vci);
      ima.playAd(amc.timeline[0]);
      const am = google.ima.adManagerInstance;
      am.publishEvent(google.ima.AdEvent.Type.STARTED);
      expect(notified).to.be(true);
    });

    it('Play ad: Requests the AMC to show the player UI and not autohide', () => {
      let notified = false;
      const showAdControls = true;
      amc.pageSettings.playerControlsOverAds = false;
      amc.hidePlayerUi = function (showAdControls, showAdMarquee, autoHideAdControls) {
        expect(showAdControls).to.be(true);
        expect(autoHideAdControls).to.be(false);
        notified = true;
      };
      initAndPlay(true, vci, undefined, showAdControls);
      ima.playAd(amc.timeline[0]);
      const am = google.ima.adManagerInstance;
      am.publishEvent(google.ima.AdEvent.Type.STARTED);
      expect(notified).to.be(true);
    });
  });

  it('AMC Integration, Ad Rules: Non-linear ad should trigger forceAdToPlay on AMC', () => {
    let triggered = 0;
    google.ima.linearAds = false;
    amc.forceAdToPlay = function () {
      triggered += 1;
    };
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.AD_BREAK_READY);
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(triggered).to.be(1);
  });

  it(`AMC Integration, Ad Rules: Existing non-linear ad should be cancelled
   when content pause is requested`, () => {
    google.ima.linearAds = false;
    amc.playAd = function (ad) {
      ima.playAd(ad);
    };
    amc.forceAdToPlay = function (name, metadata, type) {
      const adData = {
        adManager: name,
        adType: type,
        ad: metadata,
        streams: {},
        position: -1, // play immediately
      };
      const adPod = new amc.Ad(adData);
      adPod.id = 'adId';
      amc.timeline.push(adPod);
      amc.playAd(amc.timeline.shift());
    };
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.AD_BREAK_READY);
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    // These should exist when overlay is being displayed
    expect(ima.currentAMCAdPod).to.be.ok();
    expect(ima.currentIMAAd).to.be.ok();
    am.publishEvent(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED);
    // These should be removed when next ad break is ready
    expect(ima.currentAMCAdPod).to.not.be.ok();
    expect(ima.currentIMAAd).to.not.be.ok();
  });

  // AMC integration/IMA Event tests
  it('AMC Integration, Non-Ad Rules: amc is notified of a non-linear ad playback', () => {
    let notified = false;
    let nonLinearAdState = -1;
    google.ima.linearAds = false;
    initAndPlay(false, vci);
    const id = 'blah';
    let adPod = null;
    amc.forceAdToPlay = function (name, metadata, type) {
      const adData = {
        adManager: name,
        adType: type,
        ad: metadata,
        streams: {},
        position: -1, // we want it to play immediately
      };
      adPod = new amc.Ad(adData);
      adPod.id = id;
      amc.timeline.push(adPod);
      // shifting timeline simulates it having been marked as played
      // play the nonlinear ad, which we now know for sure is nonlinear
      amc.playAd(amc.timeline.shift());
    };
    amc.playAd = function (ad) {
      // play the original ad definition (we assume IMA ads to be linear first)
      ima.playAd(ad);
    };
    amc.notifyNonlinearAdEnded = function () {
      nonLinearAdState = 0;
    };
    amc.sendURLToLoadAndPlayNonLinearAd = function (currentAdPod, adPodId) {
      if (adPod === currentAdPod && id === adPodId) {
        nonLinearAdState = 1;
        notified = true;
      }
    };
    // shifting timeline simulates it having been marked as played
    amc.playAd(amc.timeline.shift());
    const am = google.ima.adManagerInstance;
    // STARTED event from Google leads to forceAdToPlay
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(notified).to.be(true);
    // we want to ensure that we do not notify nonlinear ad ended after we start the nonlinear ad
    expect(nonLinearAdState).to.be(1);
  });

  it(`AMC Integration, Non-Ad Rules: non-linear ad provides amc
   with its width, height, and padding requirement`, () => {
    let nonLinearWidth = -1;
    let nonLinearHeight = -1;
    let paddingWidth = -1;
    let paddingHeight = -1;
    let imaWidth = -1;
    let imaHeight = -1;
    google.ima.linearAds = false;
    initAndPlay(false, vci);
    const id = 'blah';
    const adPod = {
      id,
      ad:
        {
          forced_ad_type: amc.ADTYPE.NONLINEAR_OVERLAY,
        },
    };
    amc.sendURLToLoadAndPlayNonLinearAd = function (currentAdPod, adPodId) {
      if (adPod === currentAdPod && id === adPodId) {
        nonLinearWidth = currentAdPod.width;
        nonLinearHeight = currentAdPod.height;
        paddingWidth = currentAdPod.paddingWidth;
        paddingHeight = currentAdPod.paddingHeight;
      }
    };
    // original ad definition
    ima.playAd(amc.timeline[0]);
    const am = google.ima.adManagerInstance;
    am.resize = function (width, height) {
      imaWidth = width;
      imaHeight = height;
    };
    const currentAd = am.getCurrentAd();
    currentAd.getWidth = function () {
      return 300;
    };
    currentAd.getHeight = function () {
      return 50;
    };
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    // forced ad playback
    ima.playAd(adPod);
    expect(nonLinearWidth).to.be(300);
    expect(nonLinearHeight).to.be(50);
    // these values are defined as constants in google_ima.js
    // as OVERLAY_WIDTH_PADDING and OVERLAY_HEIGHT_PADDING
    expect(paddingWidth).to.be(50);
    expect(paddingHeight).to.be(50);
    // base + padding = ima width/height
    expect(imaWidth).to.be(350);
    expect(imaHeight).to.be(100);
  });

  it('AMC Integration, IMA Event: IMA CLICK event notifies amc of an ad click', () => {
    let notified = false;
    initAndPlay(true, vci);
    amc.adsClicked = function () {
      notified = true;
    };
    amc.adsClickthroughOpened = function () {
      adsClickthroughOpenedCalled += 1;
    };
    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.CLICK);
    expect(notified).to.be(true);
    expect(adsClickthroughOpenedCalled).to.be(1);
  });

  it('AMC Integration, IMA Event: IMA AD_ERROR gives back control and ends current ad and ad pod', () => {
    let doneControllingAdsNotified = false;
    let linearAdEndedNotified = false;
    let podEndedNotified = false;
    amc.notifyLinearAdEnded = function () {
      linearAdEndedNotified = true;
    };

    amc.notifyPodEnded = function () {
      podEndedNotified = true;
    };

    amc.adManagerDoneControllingAds = function (adManagerName) {
      if (adManagerName === name) {
        doneControllingAdsNotified = true;
      }
    };

    initAndPlay(true, vci);
    expect(_.isObject(google.ima.adLoaderInstance)).to.be(true);

    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdErrorEvent.Type.AD_ERROR);
    // Errors from IMA SDK should not destroy the ad loader
    expect(_.isObject(google.ima.adLoaderInstance)).to.be(true);
    expect(linearAdEndedNotified).to.be(true);
    expect(podEndedNotified).to.be(true);
    expect(doneControllingAdsNotified).to.be(true);
  });

  it(`IMA plugin returns control to AMC and destroys ad loader if plugin 
  times out loading ad rules ad`, () => {
    let doneControllingAdsNotified = false;
    amc.adManagerDoneControllingAds = function (adManagerName) {
      if (adManagerName === name) {
        doneControllingAdsNotified = true;
      }
    };
    google.ima.delayAdRequest = true;
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = 0;
    initAndPlay(true, vci);
    expect(ima.maxAdsRequestTimeout).to.be(0);
    expect(_.isObject(google.ima.adLoaderInstance)).to.be(false);
    expect(doneControllingAdsNotified).to.be(true);
  });

  it(`IMA plugin ends current ad pod and destroys ad loader
   if plugin times out loading non-ad rules ad`, () => {
    google.ima.delayAdRequest = true;

    let podEndedNotified = false;

    amc.notifyPodEnded = function () {
      podEndedNotified = true;
    };

    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = 0;
    initAndPlay(false, vci);
    ima.playAd(
      {
        ad: {
          tag_url: 'https://blah',
          position_type: NON_AD_RULES_POSITION_TYPE,
        },
      },
    );
    expect(ima.maxAdsRequestTimeout).to.be(0);
    expect(_.isObject(google.ima.adLoaderInstance)).to.be(false);
    expect(podEndedNotified).to.be(true);
  });

  it('IMA plugin creates ad loader on new video even if last ad loader was destroyed due to timeout', () => {
    google.ima.delayAdRequest = true;
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = 0;
    initAndPlay(true, vci);
    expect(ima.maxAdsRequestTimeout).to.be(0);
    expect(_.isObject(google.ima.adLoaderInstance)).to.be(false);
    const ad = {
      tag_url: 'https://blah',
      position_type: AD_RULES_POSITION_TYPE,
    };
    const content = {
      all_ads: [ad],
    };
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = 15;
    ima.loadMetadata(content, {}, {});
    expect(_.isObject(google.ima.adLoaderInstance)).to.be(true);
  });

  it('IMA plugin creates ad loader on replay even if last ad loader was destroyed due to timeout', () => {
    google.ima.delayAdRequest = true;
    amc.adManagerSettings = {};
    amc.adManagerSettings[amc.AD_SETTINGS.AD_LOAD_TIMEOUT] = 0;
    initAndPlay(true, vci);
    expect(ima.maxAdsRequestTimeout).to.be(0);
    expect(_.isObject(google.ima.adLoaderInstance)).to.be(false);
    ima.maxAdsRequestTimeout = 15000;
    amc.publishPlayerEvent(amc.EVENTS.REPLAY_REQUESTED);
    expect(_.isObject(google.ima.adLoaderInstance)).to.be(true);
  });

  it(`AMC Integration, IMA Event: IMA CONTENT_PAUSE_REQUESTED does not notify amc 
  of a forced ad playback with streams set if a preroll and instead adds preroll to timeline`, () => {
    let forcedAdNotified = 0;
    let appendedToTimeline = [];
    let podEndedNotified = 0;
    initAndPlay(true, vci);
    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      if (adManager === name && streams.ima) {
        forcedAdNotified += 1;
      }
    };
    amc.appendToTimeline = function (ads) {
      appendedToTimeline = appendedToTimeline.concat(ads);
    };
    amc.notifyPodEnded = function () {
      podEndedNotified += 1;
    };

    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED);
    expect(forcedAdNotified).to.be(0);

    // check that the ad rules ad request ad ended
    expect(podEndedNotified).to.be(1);

    // check that the new preroll was appended to the timeline
    expect(appendedToTimeline).to.eql([new amc.Ad({
      position: amc.FORCED_AD_POSITION,
      adManager: name,
      ad: {
        position_type: 'r',
        forced_ad_type: amc.ADTYPE.LINEAR_VIDEO,
      },
      streams: {
        ima: '',
      },
      adType: amc.ADTYPE.LINEAR_VIDEO,
      mainContentDuration: 60,
    })]);
  });

  it(`AMC Integration, IMA Event: IMA CONTENT_PAUSE_REQUESTED notifies amc of a forced ad playback
   with streams set if not a preroll`, () => {
    let notified = false;
    initAndPlay(true, vci);
    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      if (adManager === name && streams.ima === '') {
        notified = true;
      }
    };
    amc.publishPlayerEvent(amc.EVENTS.PLAYHEAD_TIME_CHANGED, 10, 20); // event, playhead time, duration
    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED);
    expect(notified).to.be(true);
  });

  it(`AMC Integration, IMA Event: IMA CONTENT_RESUME_REQUESTED notifies amc of a forced
   ad playback with streams set if not a preroll`, () => {
    let linearAdEndedNotified = false;
    let podEndedNotified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function () {
      linearAdEndedNotified = true;
    };

    amc.notifyPodEnded = function () {
      podEndedNotified = true;
    };

    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED);
    expect(linearAdEndedNotified).to.be(true);
    expect(podEndedNotified).to.be(true);
  });

  it(`AMC Integration, IMA Event, single element mode:
   IMA CONTENT_RESUME_REQUESTED ends the current ad pod`, () => {
    let linearAdEndedNotified = 0;
    let podEndedNotified = 0;
    amc.ui.useSingleVideoElement = true;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function () {
      linearAdEndedNotified += 1;
    };

    amc.notifyPodEnded = function () {
      podEndedNotified += 1;
    };

    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    // Wait until we receive content resume event from IMA before we end ad pod for
    // single video element mode. This is to workaround an issue where the video controller
    // and IMA are out of sync if we end ad pod too early for single video element mode
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(linearAdEndedNotified).to.be(1);
    expect(podEndedNotified).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED);
    expect(linearAdEndedNotified).to.be(1);
    expect(podEndedNotified).to.be(1);
  });

  it(`AMC Integration, IMA Event: IMA STARTED event notifies amc to focus the ad video element 
  and of linear ad start for a linear ad`, () => {
    let adStartedNotified = false;
    let focusNotified = false;
    let adId = -1;
    initAndPlay(true, vci);
    amc.notifyLinearAdStarted = function (id) {
      adId = id;
      adStartedNotified = true;
    };
    amc.focusAdVideo = function () {
      focusNotified = true;
      ima.adVideoFocused();
    };
    ima.playAd(
      {
        id: 'ad_1000',
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(adStartedNotified).to.be(true);
    expect(adId).to.be('ad_1000');
    expect(focusNotified).to.be(true);
  });

  it(`AMC Integration, IMA Event: IMA LOADED event notifies amc to focus the ad video element
   for single video element mode`, () => {
    amc.ui.useSingleVideoElement = true;
    let focusNotified = false;
    initAndPlay(true, vci);
    amc.focusAdVideo = function () {
      focusNotified = true;
      ima.adVideoFocused();
    };
    ima.playAd(
      {
        id: 'ad_1000',
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    expect(focusNotified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA COMPLETE event notifies amc of linear ad end for a linear ad', () => {
    let raiseTimeUpdateCalled = 0;
    let notified = false;
    let adId = -1;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function (id) {
      adId = id;
      notified = true;
    };
    ima.playAd(
      {
        id: 'ad_1000',
        ad: {},
      },
    );
    ima.videoControllerWrapper.raiseTimeUpdate = function () {
      raiseTimeUpdateCalled += 1;
    };

    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(notified).to.be(true);
    expect(adId).to.be('ad_1000');

    // time update should only be raised twice: once for STARTED and and another COMPLETE
    expect(raiseTimeUpdateCalled).to.be(2);
  });

  it('AMC Integration, IMA Event: IMA USER_CLOSE event notifies amc of linear ad end for a linear ad', () => {
    let notified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function () {
      notified = true;
    };
    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.USER_CLOSE);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA SKIPPED event notifies amc of linear ad end for a linear ad', () => {
    let notified = false;
    initAndPlay(true, vci);
    amc.notifyLinearAdEnded = function () {
      notified = true;
    };
    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.SKIPPED);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA COMPLETE event passes all required values', () => {
    const testTime = 500;
    let name = '';
    let url = '';
    let time = -1;
    let skip = true;
    initAndPlay(true, vci);
    amc.onAdCompleted = function (pluginName, completionTime, skipped, adTagUrl) {
      name = pluginName;
      url = adTagUrl;
      if (completionTime >= testTime) {
        time = testTime;
      }
      skip = skipped;
    };
    ima.currentImpressionTime = new Date().valueOf() - testTime;
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(name).to.be(ima.name);
    expect(url).to.be(ima.adFinalTagUrl);
    expect(skip).to.be(false);
    expect(time).to.be(testTime);
  });

  it(`AMC Integration, IMA Event: IMA COMPLETE event (linear ad) notifies
   amc of ad pod end with pod size 1`, () => {
    let notified = false;
    initAndPlay(true, vci);
    amc.notifyPodEnded = function () {
      notified = true;
    };
    ima.playAd(
      {
        ad: {},
      },
    );

    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    // mock ima has a default ad pod size of 1 (returned via getTotalAds)
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event: IMA COMPLETE events notifies amc of ad pod end with pod size 2', () => {
    let notified = false;
    initAndPlay(true, vci);
    amc.notifyPodEnded = function () {
      notified = true;
    };
    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    const currentAd = am.getCurrentAd();
    let adPosition = 1;
    currentAd.getAdPodInfo = function () {
      return {
        getTotalAds() {
          return 2;
        },
        getAdPosition() {
          return adPosition;
        },
      };
    };
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    // mock the second ad
    adPosition = 2;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(notified).to.be(true);
  });

  it(`AMC Integration, IMA Event: IMA COMPLETE event (non-linear ad) 
  notifies amc of non-linear ad end`, () => {
    let raiseTimeUpdateCalled = 0;
    let notified = false;
    google.ima.linearAds = false;
    initAndPlay(true, vci);
    amc.notifyNonlinearAdEnded = function () {
      notified = true;
    };
    ima.playAd(
      {
        ad: {},
      },
    );
    ima.videoControllerWrapper.raiseTimeUpdate = function () {
      raiseTimeUpdateCalled += 1;
    };

    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);

    // time update should only be raised once for STARTED, but not COMPLETE
    expect(raiseTimeUpdateCalled).to.be(1);
    expect(notified).to.be(true);
  });

  it('AMC Integration, IMA Event, Ad Rules: IMA ALL_ADS_COMPLETED gives up control for ad rules ads', () => {
    let notified = false;
    initAndPlay(true, vci);
    amc.adManagerDoneControllingAds = function (adManagerName) {
      if (adManagerName === name) {
        notified = true;
      }
    };
    ima.playAd(
      {
        ad: {},
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    am.publishEvent(google.ima.AdEvent.Type.ALL_ADS_COMPLETED);
    expect(notified).to.be(true);
  });

  it('AMC Integration: can cancel linear ad', () => {
    initAndPlay(true, vci);
    const id = 'blah';
    const myAd = {
      id,
    };
    ima.playAd(
      {
        ad: myAd,
        id,
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    ima.cancelAd(myAd);
  });

  it('AMC Integration: can cancel non-linear ad', () => {
    google.ima.linearAds = false;
    initAndPlay(true, vci);
    const id = 'blah';
    const myAd = {
      id,
    };
    ima.playAd(
      {
        ad: myAd,
        id,
      },
    );
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    ima.cancelAd(myAd);
  });

  // VTC-IMA plugin tests
  it('VTC Integration: Video wrapper is registered with IMA when created', () => {
    initialize(true);
    createVideoWrapper(vci);
    expect(ima.videoControllerWrapper).to.be(videoWrapper);
  });

  // Wrapper functionality tests

  it('VTC Integration: Video wrapper mute updates IMA with volume of 0 if ad loaded', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 100;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    videoWrapper.mute();
    expect(vol).to.be(0);
    expect(notifyEventNameHistory.length).to.eql(1);
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE);
    expect(notifyParams).to.eql(
      {
        muted: true,
      },
    );
  });

  it('VTC Integration: Video wrapper setVolume updates IMA with volume if ad loaded', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);

    expect(notifyEventNameHistory[notifyEventNameHistory.length - 1]).to.be(
      videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE,
    );
    expect(notifyParamHistory[notifyParamHistory.length - 1]).to.eql(
      {
        muted: false,
      },
    );

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.VOLUME_CHANGE);
    expect(notifyParams).to.eql(
      {
        volume: TEST_VOLUME,
      },
    );

    videoWrapper.mute();
    expect(vol).to.be(0);

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE);
    expect(notifyParams).to.eql(
      {
        muted: true,
      },
    );

    // test that muting twice still allows us to restore the old volume when calling unmute()
    videoWrapper.mute();
    expect(vol).to.be(0);

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE);
    expect(notifyParams).to.eql(
      {
        muted: true,
      },
    );

    videoWrapper.unmute();
    expect(vol).to.be(TEST_VOLUME);

    expect(notifyEventNameHistory[notifyEventNameHistory.length - 1]).to.be(
      videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE,
    );
    expect(notifyParamHistory[notifyParamHistory.length - 1]).to.eql(
      {
        muted: false,
      },
    );

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.VOLUME_CHANGE);
    expect(notifyParams).to.eql(
      {
        volume: TEST_VOLUME,
      },
    );
  });

  it('VTC Integration: Video wrapper sets a volume of 1 when unmuting with no previous volume', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);

    videoWrapper.mute();
    expect(vol).to.be(0);

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE);
    expect(notifyParams).to.eql(
      {
        muted: true,
      },
    );

    videoWrapper.unmute();
    expect(vol).to.be(TEST_VOLUME);

    expect(notifyEventNameHistory[notifyEventNameHistory.length - 1]).to.be(
      videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE,
    );
    expect(notifyParamHistory[notifyParamHistory.length - 1]).to.eql(
      {
        muted: false,
      },
    );

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.VOLUME_CHANGE);
    expect(notifyParams).to.eql(
      {
        volume: TEST_VOLUME,
      },
    );
  });

  it('VTC Integration: Video wrapper mutes if setVolume is called with muteState equal to true', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);

    videoWrapper.setVolume(1, true);
    expect(vol).to.be(0);

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE);
    expect(notifyParams).to.eql(
      {
        muted: true,
      },
    );
  });

  it('VTC Integration: Video wrapper setVolume updates IMA with volume if ad loaded', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is loaded
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
    expect(notifyEventNameHistory[notifyEventNameHistory.length - 1]).to.be(
      videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE,
    );
    expect(notifyParamHistory[notifyParamHistory.length - 1]).to.eql(
      {
        muted: false,
      },
    );

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.VOLUME_CHANGE);
    expect(notifyParams).to.eql(
      {
        volume: TEST_VOLUME,
      },
    );
  });

  it('VTC Integration: Video wrapper setVolume notifies VTC with volume if ad is not started', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      // IMA does not publish a volume change event if ad is not started
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
    expect(notifyEventNameHistory[notifyEventNameHistory.length - 1]).to.be(
      videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE,
    );
    expect(notifyParamHistory[notifyParamHistory.length - 1]).to.eql(
      {
        muted: false,
      },
    );

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.VOLUME_CHANGE);
    expect(notifyParams).to.eql(
      {
        volume: TEST_VOLUME,
      },
    );
  });

  it('VTC Integration: Video wrapper setVolume updates IMA with volume if ad started', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
    expect(notifyEventNameHistory[notifyEventNameHistory.length - 1]).to.be(
      videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE,
    );
    expect(notifyParamHistory[notifyParamHistory.length - 1]).to.eql(
      {
        muted: false,
      },
    );

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.VOLUME_CHANGE);
    expect(notifyParams).to.eql(
      {
        volume: TEST_VOLUME,
      },
    );
  });

  it(`VTC Integration: Video wrapper setVolume with a non-zero value does not update IMA with volume
    if a user click is required and we autoplayed`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initAndPlay(true, vci, true);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(0);
  });

  it(`VTC Integration: Video wrapper setVolume with a non-zero value does update IMA with volume
    if a user click is required and we did not autoplay`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initAndPlay(true, vci, false);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
  });

  it(`VTC Integration: Video wrapper setVolume with a non-zero value does update IMA with volume
    if a user click is required and we captured a user click`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initAndPlay(true, vci, true);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    videoWrapper.unmute(true);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
  });

  it('VTC Integration: Video wrapper updates volumeWhenMuted when setVolume called', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    am.setVolume = function (volume) {
      vol = volume;
      videoWrapper.raiseVolumeEvent();
    };
    am.getVolume = function () {
      return vol;
    };

    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.LOADED);
    const TEST_VOLUME = 0.5;
    videoWrapper.setVolume(TEST_VOLUME, true);
    expect(vol).to.be(0);
    videoWrapper.unmute();
    expect(vol).to.be(TEST_VOLUME);
  });

  it('VTC Integration: Video wrapper setVolume saves volume if IMA ad manager is not initialized', () => {
    createVideoWrapper(vci);
    const TEST_VOLUME = 0.5;
    videoWrapper.setVolume(TEST_VOLUME);
    expect(ima.savedVolume).to.be(TEST_VOLUME);
  });

  it('VTC Integration: Saved volume is consumed when ad starts', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
    };
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
    expect(ima.savedVolume).to.be(-1);
  });

  it('VTC Integration: Video wrapper unmute on user click initializes IMA Ad Display Container', () => {
    initAndPlay(true, vci, true);
    let adcInitialized = false;
    const adc = google.ima.adDisplayContainerInstance;
    adc.initialize = function () {
      adcInitialized = true;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // set to false since the ad display container may have been initialized outside of the user click
    // and we want to check if it gets reinitialized on the user click
    adcInitialized = false;
    videoWrapper.unmute(true);
    expect(adcInitialized).to.be(true);
  });

  it(`VTC Integration: Programatic video wrapper unmute
    does not initialize the IMA Ad Display Container`, () => {
    initAndPlay(true, vci, true);
    let adcInitialized = false;
    const adc = google.ima.adDisplayContainerInstance;
    adc.initialize = function () {
      adcInitialized = true;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // set to false since the ad display container may have been initialized outside of the user click
    adcInitialized = false;
    videoWrapper.unmute(false);
    expect(adcInitialized).to.be(false);
  });

  it(`VTC Integration: Video wrapper unmute on user click
    does not initialize IMA Ad Display Container if ad is playing`, () => {
    initAndPlay(true, vci, true);
    let adcInitialized = false;
    const am = google.ima.adManagerInstance;
    const adc = google.ima.adDisplayContainerInstance;
    adc.initialize = function () {
      adcInitialized = true;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // set to false since the ad display container may have been initialized outside of the user click
    // and we want to check if it gets reinitialized on the user click
    adcInitialized = false;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    videoWrapper.unmute(true);
    expect(adcInitialized).to.be(false);
  });

  it('VTC Integration: Video wrapper getCurrentTime retrieves the current time', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    am.getRemainingTime = function () {
      return 20;
    };
    const currentAd = am.getCurrentAd();
    currentAd.getDuration = function () {
      return 30;
    };
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(videoWrapper.getCurrentTime()).to.be(10); // 10 = 30 (duration) - 20 (remaining time)
  });

  // Notify tests
  it('VTC Integration: Video wrapper raisePlayEvent notifies controller of PLAYING event', () => {
    expect(notifyEventName).to.be(null);
    initAndPlay(true, vci);
    videoWrapper.raisePlayEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.PLAYING);
  });

  it('VTC Integration: Video wrapper raiseEndedEvent notifies controller of ENDED event', () => {
    expect(notifyEventName).to.be(null);
    initAndPlay(true, vci);
    videoWrapper.raiseEndedEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.ENDED);
  });

  it('VTC Integration: Video wrapper raisePauseEvent notifies controller of PAUSED event', () => {
    expect(notifyEventName).to.be(null);
    initAndPlay(true, vci);
    videoWrapper.raisePauseEvent();
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.PAUSED);
  });

  it('VTC Integration: Video wrapper raiseVolumeEvent notifies controller of VOLUME_CHANGE event', () => {
    expect(notifyEventName).to.be(null);
    expect(notifyParams).to.be(null);
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    let vol = 0;
    const TEST_VOLUME = 0.5;
    am.setVolume = function (volume) {
      vol = volume;
    };
    am.getVolume = function () {
      return vol;
    };
    // we tell IMA to start ad
    videoWrapper.play();
    // IMA tells us ad is started
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    videoWrapper.setVolume(TEST_VOLUME);
    expect(vol).to.be(TEST_VOLUME);
    videoWrapper.raiseVolumeEvent();
    expect(notifyEventNameHistory[notifyEventNameHistory.length - 1]).to.be(
      videoWrapper.controller.EVENTS.MUTE_STATE_CHANGE,
    );
    expect(notifyParamHistory[notifyParamHistory.length - 1]).to.eql(
      {
        muted: false,
      },
    );

    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.VOLUME_CHANGE);
    expect(notifyParams).to.eql(
      {
        volume: TEST_VOLUME,
      },
    );
  });

  it('VTC Integration: Video wrapper raiseTimeUpdate notifies controller of TIME_UPDATE event', () => {
    expect(notifyEventName).to.be(null);
    expect(notifyParams).to.be(null);
    initAndPlay(true, vci);
    const CURRENT_TIME = 10;
    const DURATION = 20;
    videoWrapper.raiseTimeUpdate(CURRENT_TIME, DURATION);
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.TIME_UPDATE);
    expect(notifyParams).to.eql(
      {
        currentTime: CURRENT_TIME,
        duration: DURATION,
        buffer: 1,
        seekRange:
          {
            begin: 0, end: 0,
          },
      },
    );
  });

  it(`VTC Integration: Video wrapper raiseDurationChange
    notifies controller of DURATION_CHANGE event`, () => {
    expect(notifyEventName).to.be(null);
    expect(notifyParams).to.be(null);
    initAndPlay(true, vci);
    const CURRENT_TIME = 10;
    const DURATION = 20;
    videoWrapper.raiseDurationChange(CURRENT_TIME, DURATION);
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.DURATION_CHANGE);
    expect(notifyParams).to.eql(
      {
        currentTime: CURRENT_TIME,
        duration: DURATION,
        buffer: 1,
        seekRange:
          {
            begin: 0, end: 0,
          },
      },
    );
  });

  // IMA-VTC : IMA event tests
  it(`VTC Integration, IMA Event: Video wrapper notifies of play event
    when we receive IMA STARTED event from a linear ad`, () => {
    let playing = false;
    initAndPlay(true, {
      notify(eventName) {
        if (eventName === vci.EVENTS.PLAYING) {
          playing = true;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(playing).to.be(true);
  });

  it(`VTC Integration, IMA Event: Video wrapper does not notify of play event
    when we receive IMA STARTED event from a nonlinear overlay`, () => {
    let playing = false;
    google.ima.linearAds = false;
    initAndPlay(true, {
      notify(eventName) {
        if (eventName === vci.EVENTS.PLAYING) {
          playing = true;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(playing).to.be(false);
  });

  it(`VTC Integration, IMA Event: Video wrapper notifies of play event
    when we receive IMA RESUMED event`, () => {
    let playing = false;
    initAndPlay(true, {
      notify(eventName) {
        if (eventName === vci.EVENTS.PLAYING) {
          playing = true;
        } else if (eventName === vci.EVENTS.PAUSED) {
          playing = false;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(playing).to.be(true);
    am.publishEvent(google.ima.AdEvent.Type.PAUSED);
    expect(playing).to.be(false);
    am.publishEvent(google.ima.AdEvent.Type.RESUMED);
    expect(playing).to.be(true);
  });

  it(`VTC Integration, IMA Event: Video wrapper notifies of ended event
    when we receive IMA COMPLETE event`, () => {
    let ended = false;
    initAndPlay(true, {
      notify(eventName) {
        if (eventName === vci.EVENTS.ENDED) {
          ended = true;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(ended).to.be(true);
  });

  it(`VTC Integration, IMA Event: Video wrapper notifies of ended event
    when we receive IMA SKIPPED event`, () => {
    let ended = false;
    initAndPlay(true, {
      notify(eventName) {
        if (eventName === vci.EVENTS.ENDED) {
          ended = true;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.SKIPPED);
    expect(ended).to.be(true);
  });

  it('IMA Event: Video wrapper notifies of ended event when we receive IMA USER_CLOSE event', () => {
    let ended = false;
    initAndPlay(true, {
      notify(eventName) {
        if (eventName === vci.EVENTS.ENDED) {
          ended = true;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.USER_CLOSE);
    expect(ended).to.be(true);
  });

  it('IMA Event: Video wrapper notifies of paused event when we receive IMA PAUSED event', () => {
    let paused = false;
    initAndPlay(true, {
      notify(eventName) {
        if (eventName === vci.EVENTS.PAUSED) {
          paused = true;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.PAUSED);
    expect(paused).to.be(true);
  });

  it(`IMA Event: Video wrapper notifies of volume change event
    when we receive IMA VOLUME_CHANGED event`, () => {
    let volumeChanged = false;
    let currentVolume = 0;
    initAndPlay(true, {
      notify(eventName, params) {
        if (eventName === vci.EVENTS.VOLUME_CHANGE) {
          volumeChanged = true;
          currentVolume = params.volume;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.getVolume = function () {
      return 0.5;
    };
    expect(currentVolume).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.VOLUME_CHANGED);
    expect(volumeChanged).to.be(true);
    expect(currentVolume).to.be(0.5);
  });

  it(`IMA Event: Video wrapper does not notify of volume change event
    when we receive IMA VOLUME_MUTED event`, () => {
    let volumeChanged = false;
    let currentVolume = 0.5;
    initAndPlay(true, {
      notify(eventName, params) {
        if (eventName === vci.EVENTS.VOLUME_CHANGE) {
          volumeChanged = true;
          currentVolume = params.volume;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    am.getVolume = function () {
      return 0;
    };
    expect(currentVolume).to.be(0.5);
    am.publishEvent(google.ima.AdEvent.Type.VOLUME_MUTED);
    expect(volumeChanged).to.be(false);
    expect(currentVolume).to.be(0.5);
  });

  it(`IMA Event: Video wrapper notifies of duration change event
    when we receive IMA DURATION_CHANGE event`, () => {
    let durationChanged = false;
    let currentDuration = 0;
    initAndPlay(true, {
      notify(eventName, params) {
        if (eventName === vci.EVENTS.DURATION_CHANGE) {
          durationChanged = true;
          currentDuration = params.duration;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    const currentAd = am.getCurrentAd();
    currentAd.getDuration = function () {
      return 30;
    };
    expect(currentDuration).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.DURATION_CHANGE);
    expect(durationChanged).to.be(true);
    expect(currentDuration).to.be(30);
  });

  const checkNotifyCalled = _.bind((eventname, give) => {
    let notified = false;
    initAndPlay(true, {
      notify() {
        notified = true;
      },
      EVENTS: vci.EVENTS,
    });
    if (give) {
      videoWrapper.sharedElementGive();
    } else {
      videoWrapper.sharedElementTake();
    }
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(eventname);
    return notified;
  }, this);

  it('SingleElement: Video wrapper only notifies of play event when in control of the element', () => {
    let notified = checkNotifyCalled(google.ima.AdEvent.Type.RESUMED, true);
    expect(notified).to.be(false);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.RESUMED, false);
    expect(notified).to.be(true);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.RESUMED, true);
    expect(notified).to.be(false);
  });

  it('SingleElement: Video wrapper only notifies of ended event when in control of the element', () => {
    let notified = checkNotifyCalled(google.ima.AdEvent.Type.COMPLETE, true);
    expect(notified).to.be(false);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.COMPLETE, false);
    expect(notified).to.be(true);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.COMPLETE, true);
    expect(notified).to.be(false);
  });

  it('SingleElement: Video wrapper only notifies of pause event when in control of the element', () => {
    let notified = checkNotifyCalled(google.ima.AdEvent.Type.PAUSED, true);
    expect(notified).to.be(false);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.PAUSED, false);
    expect(notified).to.be(true);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.PAUSED, true);
    expect(notified).to.be(false);
  });

  it(`SingleElement: Video wrapper only notifies of volume change event
    when in control of the element`, () => {
    let notified = checkNotifyCalled(google.ima.AdEvent.Type.VOLUME_CHANGED, true);
    expect(notified).to.be(false);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.VOLUME_CHANGED, false);
    expect(notified).to.be(true);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.VOLUME_CHANGED, true);
    expect(notified).to.be(false);
  });

  it(`SingleElement: Video wrapper only notifies of duration change event
    when in control of the element`, () => {
    let notified = checkNotifyCalled(google.ima.AdEvent.Type.DURATION_CHANGE, true);
    expect(notified).to.be(false);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.DURATION_CHANGE, false);
    expect(notified).to.be(true);
    notified = checkNotifyCalled(google.ima.AdEvent.Type.DURATION_CHANGE, true);
    expect(notified).to.be(false);
  });

  it('SingleElement: Shared video element should be blank if in multi-element mode', () => {
    ima.sharedVideoElement = null;
    amc.ui.useSingleVideoElement = false;
    amc.ui.ooyalaVideoElement = [{ className: 'video' }];
    initialize(false);
    expect(ima.sharedVideoElement).to.be(null);
    amc.ui.useSingleVideoElement = true;
    initialize(false);
    expect(ima.sharedVideoElement).to.not.be(null);
  });

  it('SingleElement: Shared video element should be null after video wrapper calls destroy function', () => {
    ima.sharedVideoElement = null;
    amc.ui.useSingleVideoElement = true;
    amc.ui.ooyalaVideoElement = [{ className: 'video' }];
    initAndPlay(false, vci);
    expect(ima.sharedVideoElement).to.not.be(null);
    videoWrapper.destroy();
    expect(ima.sharedVideoElement).to.be(null);
  });

  it('Test disabling flash ads flag', () => {
    ima.initialize(amc, playerId);
    ima.registerUi();

    ima.loadMetadata({}, {}, {});
    expect(ima.disableFlashAds).to.be(false);

    const content = {
      disableFlashAds: true,
    };
    ima.loadMetadata(content, {}, {});
    expect(ima.disableFlashAds).to.be(true);

    content.disableFlashAds = false;
    ima.loadMetadata(content, {}, {});
    expect(ima.disableFlashAds).to.be(false);
  });

  it(`IMA plugin ignores video wrapper play and pause events
   before ad is ready and after ad is complete`, () => {
    let resumedCount = 0;
    let
      pausedCount = 0;
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    am.resume = function () {
      resumedCount += 1;
    };
    am.pause = function () {
      pausedCount += 1;
    };
    ima.playAd(
      {
        id: 'ad_1000',
        ad: {},
      },
    );
    expect(ima.adPlaybackStarted).to.be(false);
    expect(pausedCount).to.be(0);
    expect(resumedCount).to.be(0);
    videoWrapper.play();
    expect(resumedCount).to.be(0);
    videoWrapper.pause();
    expect(pausedCount).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(ima.adPlaybackStarted).to.be(true);
    videoWrapper.pause();
    expect(pausedCount).to.be(1);
    videoWrapper.play();
    expect(resumedCount).to.be(1);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(ima.adPlaybackStarted).to.be(false);
    videoWrapper.pause();
    expect(pausedCount).to.be(1);
    videoWrapper.play();
    expect(resumedCount).to.be(1);
  });

  it('IMA plugin ignores PAUSED and RESUMED IMA events before ad is ready and after ad is complete', () => {
    let resumedCount = 0;
    let
      pausedCount = 0;
    initAndPlay(true, {
      notify(eventName) {
        switch (eventName) {
          case vci.EVENTS.PAUSED:
            pausedCount += 1;
            break;
          case vci.EVENTS.PLAYING:
            resumedCount += 1;
            break;
          default:
          // do nothing
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    ima.playAd(
      {
        id: 'ad_1000',
        ad: {},
      },
    );
    expect(ima.adPlaybackStarted).to.be(false);
    expect(pausedCount).to.be(0);
    expect(resumedCount).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.RESUMED);
    expect(resumedCount).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.PAUSED);
    expect(pausedCount).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    expect(resumedCount).to.be(1);
    expect(ima.adPlaybackStarted).to.be(true);
    am.publishEvent(google.ima.AdEvent.Type.PAUSED);
    expect(pausedCount).to.be(1);
    am.publishEvent(google.ima.AdEvent.Type.RESUMED);
    expect(resumedCount).to.be(2);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(ima.adPlaybackStarted).to.be(false);
    am.publishEvent(google.ima.AdEvent.Type.PAUSED);
    expect(pausedCount).to.be(1);
    am.publishEvent(google.ima.AdEvent.Type.RESUMED);
    expect(resumedCount).to.be(2);
  });

  it(`IMA plugin ignores COMPLETE, USER_CLOSE and SKIPPED IMA events
    before ad is ready and after ad is complete`, () => {
    let endedCount = 0;
    initAndPlay(true, {
      notify(eventName) {
        if (eventName === vci.EVENTS.ENDED) {
          endedCount += 1;
        }
      },
      EVENTS: vci.EVENTS,
    });
    const am = google.ima.adManagerInstance;
    expect(endedCount).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    am.publishEvent(google.ima.AdEvent.Type.USER_CLOSE);
    am.publishEvent(google.ima.AdEvent.Type.SKIPPED);
    expect(endedCount).to.be(0);
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    expect(endedCount).to.be(1);
    am.publishEvent(google.ima.AdEvent.Type.COMPLETE);
    am.publishEvent(google.ima.AdEvent.Type.USER_CLOSE);
    am.publishEvent(google.ima.AdEvent.Type.SKIPPED);
    expect(endedCount).to.be(1);
  });

  it(`AMC Integration: IMA plugin calls onSdkAdEvent API after receiving
    ADS_MANAGER_LOADED event from IMA SDK for a non-ad rules ad`, () => {
    let called = 0;
    let adPluginName = null;
    let sdkAdEvent = null;
    amc.onSdkAdEvent = function (name, adEvent) {
      called += 1;
      adPluginName = name;
      sdkAdEvent = adEvent;
    };

    initialize(false);
    play();
    ima.playAd(amc.timeline[0]);
    expect(ima.adsRequested).to.be(true);
    expect(called).to.be(1);
    expect(adPluginName).to.be(ima.name);
    expect(_.isEmpty(sdkAdEvent)).to.be(false);
  });

  it(`AMC Integration: IMA plugin calls onSdkAdEvent API after receiving
    ADS_MANAGER_LOADED event from IMA SDK for a non-ad rules ad`, () => {
    let called = 0;
    let adPluginName = null;
    let sdkAdEventName = null;
    let sdkAdEventData = null;
    amc.onSdkAdEvent = function (name, event, params) {
      called += 1;
      adPluginName = name;
      sdkAdEventName = event;
      sdkAdEventData = params;
    };

    initialize(false);
    play();
    ima.playAd(amc.timeline[0]);
    expect(ima.adsRequested).to.be(true);
    expect(called).to.be(1);
    expect(adPluginName).to.be(ima.name);
    expect(sdkAdEventName).to.be(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED);
    expect(_.isEmpty(sdkAdEventData)).to.be(false);
  });

  it(`AMC Integration: IMA plugin calls onSdkAdEvent API after receiving
    ADS_MANAGER_LOADED event from IMA SDK for an ad rules ad`, () => {
    let called = 0;
    let adPluginName = null;
    let sdkAdEventName = null;
    let sdkAdEventData = null;
    amc.onSdkAdEvent = function (name, event, params) {
      called += 1;
      adPluginName = name;
      sdkAdEventName = event;
      sdkAdEventData = params;
    };

    initialize(true);
    play();
    expect(ima.adsRequested).to.be(true);
    expect(called).to.be(1);
    expect(adPluginName).to.be(ima.name);
    expect(sdkAdEventName).to.be(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED);
    expect(_.isEmpty(sdkAdEventData)).to.be(false);
  });

  it('AMC Integration: IMA plugin calls onSdkAdEvent API after receiving an ad error from IMA SDK', () => {
    initAndPlay(true, vci);
    let adPluginName = null;
    let sdkAdEventName = null;
    let sdkAdEventData = null;
    amc.onSdkAdEvent = function (name, event, params) {
      adPluginName = name;
      sdkAdEventName = event;
      sdkAdEventData = params;
    };
    const am = google.ima.adManagerInstance;
    am.publishEvent(google.ima.AdEvent.Type.STARTED);
    am.publishEvent(google.ima.AdErrorEvent.Type.AD_ERROR);
    expect(adPluginName).to.be(ima.name);
    expect(sdkAdEventName).to.be(google.ima.AdErrorEvent.Type.AD_ERROR);
    expect(_.isEmpty(sdkAdEventData)).to.be(false);
  });

  it('AMC Integration: IMA plugin calls onSdkAdEvent API after receiving an ad event from IMA SDK', () => {
    initAndPlay(true, vci);
    const am = google.ima.adManagerInstance;
    const eventType = google.ima.AdEvent.Type;
    const imaAdEvents = [
      eventType.CONTENT_PAUSE_REQUESTED,
      eventType.AD_BREAK_READY,
      eventType.AD_METADATA,
      eventType.LOADED,
      eventType.STARTED, // started required for some of the following events
      eventType.CLICK,
      eventType.DURATION_CHANGE,
      eventType.FIRST_QUARTILE,
      eventType.IMPRESSION,
      eventType.INTERACTION,
      eventType.LINEAR_CHANGED,
      eventType.LOG,
      eventType.MIDPOINT,
      eventType.PAUSED,
      eventType.RESUMED,
      eventType.SKIPPABLE_STATE_CHANGED,
      eventType.THIRD_QUARTILE,
      eventType.VOLUME_CHANGED,
      eventType.VOLUME_MUTED,
      eventType.USER_CLOSE,
      eventType.STARTED, // need started event for SKIPPED
      eventType.SKIPPED,
      eventType.STARTED, // need started event for COMPLETE
      eventType.COMPLETE,
      eventType.STARTED, // need started event for ALL_ADS_COMPLETED
      eventType.ALL_ADS_COMPLETED,
      eventType.CONTENT_RESUME_REQUESTED,
    ];
    let adPluginName = null;
    let sdkAdEventName = null;
    let sdkAdEventData = null;
    amc.onSdkAdEvent = function (name, event, params) {
      adPluginName = name;
      sdkAdEventName = event;
      sdkAdEventData = params;
    };

    each(imaAdEvents, (event) => {
      am.publishEvent(event);
      expect(adPluginName).to.be(ima.name);
      expect(sdkAdEventName).to.be(event);
      expect(_.isEmpty(sdkAdEventData)).to.be(false);
    });
  });

  it('AMC Integration: IMA plugin provides a default value of 15000 ms for loadVideoTimeout', () => {
    initialize(false);
    play();
    ima.playAd(amc.timeline[0]);
    expect(ima.adsRequested).to.be(true);
    expect(_.isEmpty(google.ima.adsRenderingSettingsInstance)).to.be(false);
    expect(google.ima.adsRenderingSettingsInstance.loadVideoTimeout).to.be(15000);
  });

  it('IOS Skippable Ads: Test page level param default', () => {
    // default case
    ima.initialize(amc, playerId);
    ima.loadMetadata({}, {}, {});
    ima.registerUi();
    expect(google.ima.disableCustomPlaybackForIOS10Plus).to.be(false);
    expect(ima.enableIosSkippableAds).to.be(false);
  });

  it('IOS Skippable Ads: Test page level param false', () => {
    const content = {
      enableIosSkippableAds: false,
    };
    ima.initialize(amc, playerId);
    ima.loadMetadata(content, {}, {});
    ima.registerUi();
    expect(google.ima.disableCustomPlaybackForIOS10Plus).to.be(false);
    expect(ima.enableIosSkippableAds).to.be(false);
  });

  it('IOS Skippable Ads: Test page level param true', () => {
    const content = {
      enableIosSkippableAds: true,
    };
    ima.initialize(amc, playerId);
    ima.loadMetadata(content, {}, {});
    ima.registerUi();
    expect(google.ima.disableCustomPlaybackForIOS10Plus).to.be(true);
    expect(ima.enableIosSkippableAds).to.be(true);
  });

  it(`Muted Autoplay: Ads Manager can start after IMA initialization and automatic initial play
    requested if muted autoplay is not required`, () => {
    ima.requiresMutedAutoplay = function () {
      return false;
    };
    initialize(false);
    createVideoWrapper(vci);
    play(true);
    expect(google.ima.adsManagerStarted).to.be(false);
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adsManagerStarted).to.be(true);
  });

  it(`Muted Autoplay: Ads Manager cannot start and wrapper raises
    UNMUTED_PLAYBACK_FAILED after IMA initialization and automatic
    initial play requested if muted autoplay is required`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initialize(false);
    createVideoWrapper(vci);
    play(true);
    expect(google.ima.adsManagerStarted).to.be(false);
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adsManagerStarted).to.be(false);
    expect(notifyEventName).to.be(videoWrapper.controller.EVENTS.UNMUTED_PLAYBACK_FAILED);
  });

  it(`Muted Autoplay: Ads Manager can start after
    IMA initialization and automatic initial play requested
    if muted autoplay is required but we capture a user click`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initialize(false);
    createVideoWrapper(vci);
    play(true);
    // user click
    videoWrapper.unmute(true);
    expect(google.ima.adsManagerStarted).to.be(false);
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adsManagerStarted).to.be(true);
  });

  it(`Muted Autoplay: do not publish UNMUTED_PLAYBACK_FAILED after
    IMA initialization and automatic initial play requested
    if muted autoplay is required but we are ad rules with no preroll`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initialize(true);
    createVideoWrapper(vci);
    play(true);
    // default getCuePoints is returning empty, so no preroll
    ima.playAd(amc.timeline[0]);
    expect(_.contains(
      notifyEventNameHistory,
      videoWrapper.controller.EVENTS.UNMUTED_PLAYBACK_FAILED,
    )).to.be(false);
  });

  it('Muted Autoplay: VTC can notify IMA that muted autoplay is not required', () => {
    OO.isChrome = true;
    OO.chromeMajorVersion = 66;
    initialize(false);
    createVideoWrapper(vci);
    play(true);
    expect(ima.requiresMutedAutoplay()).to.be(true);
    videoWrapper.notifyUnmutedContentAutoPlaybackSucceeded();
    expect(ima.requiresMutedAutoplay()).to.be(false);
  });

  it(`Muted Autoplay: Ad plugin notifies IMA SDK of intent to play
    a muted ad if muted autoplay is required`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initialize(false);
    createVideoWrapper(vci);
    play(true);
    expect(google.ima.adsManagerStarted).to.be(false);
    expect(google.ima.adWillPlayMuted).to.be(undefined);
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adWillPlayMuted).to.be(true);
  });

  it(`Muted Autoplay: Ad plugin notifies IMA SDK of intent to play
    a non-muted ad if muted autoplay is not required`, () => {
    ima.requiresMutedAutoplay = function () {
      return false;
    };
    initialize(false);
    createVideoWrapper(vci);
    play(true);
    expect(google.ima.adsManagerStarted).to.be(false);
    expect(google.ima.adWillPlayMuted).to.be(undefined);
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adWillPlayMuted).to.be(false);
  });

  it(`Muted Autoplay: Ad plugin notifies IMA SDK of intent to play
    a non-muted ad if muted autoplay is required but we did not autoplay`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initialize(false);
    createVideoWrapper(vci);
    play(false);
    expect(google.ima.adsManagerStarted).to.be(false);
    expect(google.ima.adWillPlayMuted).to.be(undefined);
    ima.setupUnmutedPlayback();
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adWillPlayMuted).to.be(false);
  });

  it(`Muted Autoplay: Ad plugin notifies IMA SDK of intent to play
    a non-muted ad if muted autoplay is required but we have captured a user click`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initialize(false);
    createVideoWrapper(vci);
    play(true);
    expect(google.ima.adsManagerStarted).to.be(false);
    expect(google.ima.adWillPlayMuted).to.be(undefined);
    ima.setupUnmutedPlayback();
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adWillPlayMuted).to.be(false);
  });

  it(`Muted Autoplay: Ad plugin can play a non-muted ad on second content onwards
    if we have captured a user click in the first content`, () => {
    ima.requiresMutedAutoplay = function () {
      return true;
    };
    initialize(false);
    createVideoWrapper(vci);
    play(false);
    expect(google.ima.adsManagerStarted).to.be(false);
    expect(google.ima.adWillPlayMuted).to.be(undefined);
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adWillPlayMuted).to.be(false);

    play(true);
    ima.playAd(amc.timeline[0]);
    expect(google.ima.adWillPlayMuted).to.be(false);
  });

  describe('Override number of redirects', () => {
    beforeEach(() => {
      ima.maxRedirects = undefined;
      google.ima.numRedirects = undefined;
    });

    afterEach(() => {
      ima.maxRedirects = undefined;
      google.ima.numRedirects = undefined;
    });

    it('Test that override works', () => {
      const content = {
        setMaxRedirects: 10,
      };

      ima.initialize(amc, playerId);
      ima.loadMetadata(content, {}, {});
      ima.registerUi();

      expect(ima.maxRedirects).to.be(10); // this is what we store internally
      expect(google.ima.numRedirects).to.be(10); // this is what ima receives
    });

    it('Test that override works with string', () => {
      const content = {
        setMaxRedirects: '10',
      };

      ima.initialize(amc, playerId);
      ima.loadMetadata(content, {}, {});
      ima.registerUi();

      expect(ima.maxRedirects).to.be(10); // this is what we store internally
      expect(google.ima.numRedirects).to.be(10); // this is what ima receives
    });

    it('Test what happens when you don\'t set the override', () => {
      const content = {
        // nothing
      };

      ima.initialize(amc, playerId);
      ima.loadMetadata(content, {}, {});
      ima.registerUi();

      expect(ima.maxRedirects).to.be(undefined); // shouldn't be set since we didn't pass in anything
      expect(google.ima.numRedirects).to.be(undefined); // ima should not be called
    });

    it('Test bad input', () => {
      const content = {
        setMaxRedirects: 'bad input',
      };

      ima.initialize(amc, playerId);
      ima.loadMetadata(content, {}, {});
      ima.registerUi();

      expect(isNaN(ima.maxRedirects)).to.be(true); // this is what comes in
      expect(google.ima.numRedirects).to.be(undefined); // ima should not be called
    });
  });

  describe('Ad preloading', () => {
    describe('Ad Rules', () => {
      it('Does not preload an ad by default', () => {
        initialize(true);
        createVideoWrapper(vci);
        expect(google.ima.adsManagerInitCalled).to.be(false);
        expect(google.ima.adsRequestMade).to.be(false);
        play(false);
        ima.playAd(amc.timeline[0]);
        expect(google.ima.adsRequestMade).to.be(true);
        expect(google.ima.adsManagerInitCalled).to.be(true);
      });

      it(`Does not preload an ad if playAd was called prior
        to initial play with preloadAds set to false`, () => {
        initialize(true);
        createVideoWrapper(vci);
        ima.playAd(amc.timeline[0]);
        expect(google.ima.adsManagerInitCalled).to.be(false);
        expect(google.ima.adsRequestMade).to.be(false);
        play(false);
        expect(google.ima.adsRequestMade).to.be(true);
        expect(google.ima.adsManagerInitCalled).to.be(true);
        // start is needed to show the skip ad button for ad rules ads. This is not documented by Google
        expect(google.ima.adsManagerStarted).to.be(true);
      });

      it(`Can preload an ad with preloadAds set to true
        and calling playAd with adRequestOnly set to true`, () => {
        amc.adManagerSettings[amc.AD_SETTINGS.PRELOAD_ADS] = true;
        initialize(true);
        createVideoWrapper(vci);
        ima.playAd(amc.timeline[0], true);
        // For ad rules, AdsManager.init() sets off ad playback, so we do not want it called yet even when preloading
        expect(google.ima.adsManagerInitCalled).to.be(false);
        expect(google.ima.adsRequestMade).to.be(true);
        play(false);
        expect(google.ima.adsManagerInitCalled).to.be(true);
        // start is needed to show the skip ad button for ad rules ads. This is not documented by Google
        expect(google.ima.adsManagerStarted).to.be(true);
      });

      it('Ads Manager init is called after ad request is successful', () => {
        google.ima.delayAdRequest = true;
        amc.adManagerSettings[amc.AD_SETTINGS.PRELOAD_ADS] = true;
        initialize(true);
        createVideoWrapper(vci);
        ima.playAd(amc.timeline[0], true);
        // For ad rules, AdsManager.init() sets off ad playback, so we do not want it called yet even when preloading
        expect(google.ima.adsManagerInitCalled).to.be(false);
        expect(google.ima.adsRequestMade).to.be(true);
        play(false);
        expect(google.ima.adsManagerInitCalled).to.be(false);
        google.ima.delayedAdRequestCallback();
        expect(google.ima.adsManagerInitCalled).to.be(true);
        // start is needed to show the skip ad button for ad rules ads. This is not documented by Google
        expect(google.ima.adsManagerStarted).to.be(true);
      });
    });

    describe('Non Ad Rules', () => {
      it('Does not preload an ad by default', () => {
        initialize(false);
        createVideoWrapper(vci);
        expect(google.ima.adsManagerInitCalled).to.be(false);
        expect(google.ima.adsRequestMade).to.be(false);
        expect(google.ima.adsManagerStarted).to.be(false);
        play(false);
        ima.playAd(amc.timeline[0]);
        expect(google.ima.adsRequestMade).to.be(true);
        expect(google.ima.adsManagerInitCalled).to.be(true);
        expect(google.ima.adsManagerStarted).to.be(true);
      });

      it(`Can preload an ad with preloadAds set to true
        and calling playAd with adRequestOnly set to true`, () => {
        amc.adManagerSettings[amc.AD_SETTINGS.PRELOAD_ADS] = true;
        initialize(false);
        createVideoWrapper(vci);
        ima.playAd(amc.timeline[0], true);
        // For non-ad rules, AdsManager.start() sets off ad playback, so init can be called here safely to preload
        expect(google.ima.adsManagerInitCalled).to.be(true);
        expect(google.ima.adsRequestMade).to.be(true);
        expect(google.ima.adsManagerStarted).to.be(false);
        play(false);
        expect(google.ima.adsManagerInitCalled).to.be(true);
        expect(google.ima.adsManagerStarted).to.be(false);
        ima.playAd(amc.timeline[0], false);
        expect(google.ima.adsManagerStarted).to.be(true);
      });

      it('Ads Manager init is called after ad request is successful', () => {
        google.ima.delayAdRequest = true;
        amc.adManagerSettings[amc.AD_SETTINGS.PRELOAD_ADS] = true;
        initialize(false);
        createVideoWrapper(vci);
        ima.playAd(amc.timeline[0], true);
        expect(google.ima.adsRequestMade).to.be(true);
        expect(google.ima.adsManagerInitCalled).to.be(false);
        expect(google.ima.adsManagerStarted).to.be(false);
        google.ima.delayedAdRequestCallback();
        // For non-ad rules, AdsManager.start() sets off ad playback, so init can be called here safely to preload
        expect(google.ima.adsManagerInitCalled).to.be(true);
        expect(google.ima.adsRequestMade).to.be(true);
        expect(google.ima.adsManagerStarted).to.be(false);
        play(false);
        expect(google.ima.adsManagerInitCalled).to.be(true);
        expect(google.ima.adsManagerStarted).to.be(false);
        ima.playAd(amc.timeline[0], false);
        expect(google.ima.adsManagerStarted).to.be(true);
      });
    });
  });
});
