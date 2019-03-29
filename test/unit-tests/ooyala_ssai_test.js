/* eslint-disable require-jsdoc */
/*
 * Unit test class for the Ooyala SSAI Ad Manager
 * https://github.com/Automattic/expect.js
 */

// stubs
OO.log = function () {};
require(`${COMMON_SRC_ROOT}utils/utils.js`);
require(`${COMMON_SRC_ROOT}utils/environment.js`);
require(`${COMMON_SRC_ROOT}classes/emitter.js`);
require(`${TEST_ROOT}unit-test-helpers/mock_amc.js`);

const fs = require('fs');

describe('ad_manager_ooyala_ssai', function () {
  let amc; let OoyalaSsai;
  const name = 'ooyala-ssai-ads-manager';
  const originalOoAds = _.clone(OO.Ads);

  // Vast XML
  const ssaiXmlString = fs.readFileSync(
    require.resolve('../unit-test-helpers/mock_responses/ssai.xml'),
    'utf8',
  );
  const ssaiXml = $.parseXML(ssaiXmlString);
  let trackingUrlsPinged = {};

  before(_.bind(() => {
    OO.Ads = {
      manager(adManager) {
        OoyalaSsai = adManager(_, $);
        OoyalaSsai.testMode = true;
      },
    };

    // mock pixelPing to test error tracking
    OO.pixelPing = function (url) {
      if (url) {
        if (Object.prototype.hasOwnProperty.call(trackingUrlsPinged, url)) {
          trackingUrlsPinged[url] += 1;
        } else {
          trackingUrlsPinged[url] = 1;
        }
      }
    };

    delete require.cache[require.resolve(`${SRC_ROOT}ooyala_ssai.js`)];
    // eslint-disable-next-line global-require
    require(`${SRC_ROOT}ooyala_ssai.js`);
  }, this));

  after(() => {
    OO.Ads = originalOoAds;
  });

  beforeEach(() => {
    amc = new FakeAmc();
    amc.adManagerList = [];
    amc.onAdManagerReady = function () { this.timeline = this.adManagerList[0].buildTimeline(); };
    amc.adManagerList.push(OoyalaSsai);
    trackingUrlsPinged = {};
  });

  afterEach(_.bind(() => {
    amc.timeline = [];
    OoyalaSsai.destroy();
  }, this));

  //   ------   TESTS   ------

  it('Init: mock amc is ready', () => {
    expect(typeof amc).to.be('object');
  });

  it('Init: ad manager is registered', () => {
    expect(OoyalaSsai).to.not.be(null);
  });

  it('Init: ad manager has the expected name', () => {
    expect(OoyalaSsai.name).to.be(name);
  });

  it('Init: ad manager handles the initialize function', () => {
    expect(
      () => {
        OoyalaSsai.initialize(amc);
      },
    ).to.not.throwException();
  });

  it('Init: ad manager handles the loadMetadata function', () => {
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
    OoyalaSsai.initialize(amc);
    // For VOD, currentOffset must be greater than 0.
    OoyalaSsai.setCurrentOffset(1);
    expect(() => {
      OoyalaSsai.loadMetadata({
        html5_ssl_ad_server: 'https://blah',
        html5_ad_server: 'http://blah',
      }, {}, content);
    }).to.not.throwException();
  });

  it('Init: sets currentOffset before video was started', () => {
    const asset = {
      duration: 366.61199999999997,
    };

    OoyalaSsai.initialize(amc);
    OoyalaSsai.onContentTreeFetched('eventName', asset);
    expect(OoyalaSsai.getCurrentOffset()).to.equal(366.61199999999997);
    // we should know video length before sending request for VAST xml for SSAI AD
    // as it requires current offset from the end
  });

  it('Init: ad manager notifies controller that it is loaded', () => {
    let pluginLoaded = false;
    amc.reportPluginLoaded = function () {
      pluginLoaded = true;
    };
    OoyalaSsai.initialize(amc);
    expect(() => {
      OoyalaSsai.loadMetadata({
        html5_ssl_ad_server: 'https://blah',
        html5_ad_server: 'http://blah',
      }, {}, {});
    }).to.not.throwException();
    expect(pluginLoaded).to.be(true);
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
    OoyalaSsai.initialize(amc);
    expect(OoyalaSsai.ready).to.be(false);
    OoyalaSsai.loadMetadata({
      html5_ssl_ad_server: 'https://blah',
      html5_ad_server: 'http://blah',
    }, {}, content);
    expect(OoyalaSsai.ready).to.be(true);
  });

  it('ID3 Object should be parsed', () => {
    OoyalaSsai.initialize(amc);
    const mockId3Tag = {
      TXXX: 'adid=adid1&t=0&d=100',
    };

    const expectedResult = {
      adId: 'adid1',
      time: 0,
      duration: 100,
    };

    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(_.isEqual(currentId3Object, expectedResult)).to.be(true);
  });

  it('ID3 Object should not be parsed if ID3 tag contains incorrect inputs', () => {
    OoyalaSsai.initialize(amc);
    const mockId3Tag = {
      TXXX: 'adid=adid1&t=0&d=100',
    };
    // test bad inputs
    mockId3Tag.TXXX = 'adid=adid2&banana=0';
    const expectedResult = null;
    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(currentId3Object).to.be(expectedResult);
  });

  it('ID3 Object should not be parsed if ID3 tag is empty', () => {
    OoyalaSsai.initialize(amc);

    const mockId3Tag = {
      TXXX: '',
    };
    const expectedResult = null;
    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);

    expect(currentId3Object).to.be(expectedResult);
  });

  it('ID3 Object should not be parsed if ID3 tag is null', () => {
    OoyalaSsai.initialize(amc);

    const mockId3Tag = {
      TXXX: null,
    };
    const expectedResult = null;
    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);

    expect(currentId3Object).to.be(expectedResult);
  });

  it('Linear Creative Tracking Events URLs should be pinged', () => {
    const adQueue = [];
    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      const adData = {
        adManager,
        adType,
        ad,
        duration: 15,
        streams,
        position: -1, // we want it to play immediately
      };
      const newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    OoyalaSsai.initialize(amc);

    const currentId3Object = {
      adId: '11de5230-ff5c-4d36-ad77-c0c7644d28e9',
      t: 0,
      d: 15,
    };

    OoyalaSsai.adIdDictionary = {
      '11de5230-ff5c-4d36-ad77-c0c7644d28e9': true,
    };

    OoyalaSsai.currentAd = {
      ad: {},
    };

    OoyalaSsai.onResponse(currentId3Object, ssaiXml);

    const ad = adQueue[0];
    // impression, and start tracking events
    OoyalaSsai.playAd(ad);
    expect(trackingUrlsPinged.startUrl).to.be(1);
    expect(trackingUrlsPinged.startUrl2).to.be(1);
    expect(trackingUrlsPinged.impressionUrl).to.be(1);
    expect(trackingUrlsPinged.impressionUrl2).to.be(1);

    // pause and resume events
    OoyalaSsai.pauseAd(ad);
    expect(trackingUrlsPinged.pauseUrl).to.be(1);
    OoyalaSsai.resumeAd(ad);
    expect(trackingUrlsPinged.resumeUrl).to.be(1);

    // mute and unmute events
    OoyalaSsai.onMuteStateChanged('muteStateChanged', true);
    expect(trackingUrlsPinged.muteUrl).to.be(1);
    OoyalaSsai.onMuteStateChanged('muteStateChanged', false);
    expect(trackingUrlsPinged.unmuteUrl).to.be(1);

    // volume change events should also trigger mute / unmute urls
    OoyalaSsai.onAdVolumeChanged('adVolumeChanged', 0);
    expect(trackingUrlsPinged.muteUrl).to.be(2);
    OoyalaSsai.onAdVolumeChanged('adVolumeChanged', 50);
    expect(trackingUrlsPinged.unmuteUrl).to.be(2);

    // fullscreen events
    OoyalaSsai.onFullscreenChanged('fullscreenChanged', true);
    expect(trackingUrlsPinged.fullscreenUrl).to.be(1);


    // clickthrough tracking events
    OoyalaSsai.playerClicked(ad);
    expect(trackingUrlsPinged.linearClickTrackingUrl).to.be(1);
  });

  it(`Linear Creative Tracking Events mute/unmute urls should
    be pinged only once if multiple events received`, () => {
    const adQueue = [];
    amc.forceAdToPlay = function (adManager, ad, adType, streams) {
      const adData = {
        adManager,
        adType,
        ad,
        duration: 15,
        streams,
        position: -1, // we want it to play immediately
      };
      const newAd = new amc.Ad(adData);
      adQueue.push(newAd);
    };

    OoyalaSsai.initialize(amc);

    const currentId3Object = {
      adId: '11de5230-ff5c-4d36-ad77-c0c7644d28e9',
      t: 0,
      d: 15,
    };

    OoyalaSsai.adIdDictionary = {
      '11de5230-ff5c-4d36-ad77-c0c7644d28e9': true,
    };

    OoyalaSsai.onResponse(currentId3Object, ssaiXml);

    const ad = adQueue[0];
    // impression, and start tracking events
    OoyalaSsai.playAd(ad);
    // mute and unmute events
    OoyalaSsai.onMuteStateChanged('muteStateChanged', true);
    OoyalaSsai.onMuteStateChanged('muteStateChanged', true);
    expect(trackingUrlsPinged.muteUrl).to.be(1);
    OoyalaSsai.onMuteStateChanged('muteStateChanged', false);
    OoyalaSsai.onMuteStateChanged('muteStateChanged', false);
    expect(trackingUrlsPinged.unmuteUrl).to.be(1);

    // volume change events should also trigger mute / unmute urls
    OoyalaSsai.onAdVolumeChanged('adVolumeChanged', 0);
    OoyalaSsai.onAdVolumeChanged('adVolumeChanged', 0);
    OoyalaSsai.onMuteStateChanged('muteStateChanged', false);
    expect(trackingUrlsPinged.muteUrl).to.be(2);
    OoyalaSsai.onAdVolumeChanged('adVolumeChanged', 50);
    OoyalaSsai.onAdVolumeChanged('adVolumeChanged', 10);
    OoyalaSsai.onAdVolumeChanged('adVolumeChanged', 100);
    OoyalaSsai.onMuteStateChanged('muteStateChanged', true);
    expect(trackingUrlsPinged.unmuteUrl).to.be(2);
  });

  it('Correct clickthrough URL should be opened', () => {
    const adQueue = [];
    let clickThroughUrl = '';
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

    window.open = function (url) {
      clickThroughUrl = url;
    };

    OoyalaSsai.initialize(amc);

    const currentId3Object = {
      adId: '11de5230-ff5c-4d36-ad77-c0c7644d28e9',
      t: 0,
      d: 15,
    };

    OoyalaSsai.adIdDictionary = {
      '11de5230-ff5c-4d36-ad77-c0c7644d28e9': true,
    };

    OoyalaSsai.currentAd = {
      ad: {},
    };

    OoyalaSsai.onResponse(currentId3Object, ssaiXml);

    const ad = adQueue[0];

    // clickthrough tracking events
    OoyalaSsai.playerClicked(ad);
    expect(clickThroughUrl).to.be('clickThroughUrl');
  });

  it('Tracking Events URL with CACHEBUSTING macro should be replaced', () => {
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

    OoyalaSsai.initialize(amc);

    const currentId3Object = {
      adId: '11de5230-ff5c-4d36-ad77-c0c7644d28e9',
      t: 0,
      d: 15,
    };

    OoyalaSsai.adIdDictionary = {
      '11de5230-ff5c-4d36-ad77-c0c7644d28e9': true,
    };

    OoyalaSsai.currentAd = {
      ad: {},
    };

    OoyalaSsai.onResponse(currentId3Object, ssaiXml);

    const ad = adQueue[0];

    // impression, and start tracking events
    OoyalaSsai.playAd(ad);

    // get the urls in with the "rnd" query parameter, this will contain the
    // CACHEBUSTING macro that should be replaced.
    Object.keys(trackingUrlsPinged).forEach((url) => {
      if (_.has(trackingUrlsPinged, url) && /rnd=/.test(url)) {
        // should not have the cachebusting macros and should be pinged
        expect(url).to.not.have.string('%5BCACHEBUSTING%5D');

        // replaced value is not be undefined or ""
        const rndValue = url.split('=')[1];
        expect(rndValue).to.not.be(undefined);
        expect(rndValue).to.not.be('');

        expect(trackingUrlsPinged[url]).to.be(1);
      }
    });

    // cacheBuster function should not mutate other URLs without the cachebusting macro"
    expect(_.keys(trackingUrlsPinged)).to.contain('impressionUrl');
    expect(_.keys(trackingUrlsPinged)).to.contain('impressionUrl2');
    expect(_.keys(trackingUrlsPinged)).to.contain('startUrl');
    expect(_.keys(trackingUrlsPinged)).to.contain('startUrl2');
  });

  it('Tracking Events URL with CACHEBUSTING macro should be replaced', () => {
    let adManagerMetadata = {
      cacheBuster: 'true',
    };
    const backlotBaseMetadata = {};
    const movieMetadata = {};
    OoyalaSsai.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(OoyalaSsai.getBustTheCache()).to.be(true);

    // test bad inputs, should default to true
    adManagerMetadata = {
      cacheBuster: '',
    };
    OoyalaSsai.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(OoyalaSsai.getBustTheCache()).to.be(true);

    adManagerMetadata = {
      cacheBuster: 'abcd',
    };
    OoyalaSsai.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(OoyalaSsai.getBustTheCache()).to.be(true);

    adManagerMetadata = {
      cacheBuster: 0,
    };
    OoyalaSsai.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(OoyalaSsai.getBustTheCache()).to.be(true);

    // boolean true/false should work
    adManagerMetadata = {
      cacheBuster: false,
    };
    OoyalaSsai.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(OoyalaSsai.getBustTheCache()).to.be(false);

    adManagerMetadata = {
      cacheBuster: true,
    };
    OoyalaSsai.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(OoyalaSsai.getBustTheCache()).to.be(true);

    // should change to false when value is explicitly "false"
    adManagerMetadata = {
      cacheBuster: 'false',
    };
    OoyalaSsai.loadMetadata(adManagerMetadata, backlotBaseMetadata, movieMetadata);
    expect(OoyalaSsai.getBustTheCache()).to.be(false);
  });

  it('Correct ID3 ad duration should be selected', () => {
    OoyalaSsai.initialize(amc);

    const mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=1',
    };
    const expectedResult = {
      adId: '11de5230-ff5c-4d36-ad77-c0c7644d28e9',
      time: 0,
      duration: 1,
    };
    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(_.isEqual(currentId3Object, expectedResult)).to.be(true);
  });

  it('Correct Ad Duration should be selected', () => {
    OoyalaSsai.initialize(amc);

    // ID3 Tag ad duration should be selected
    const mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100',
    };
    const expectedResult = {
      adId: '11de5230-ff5c-4d36-ad77-c0c7644d28e9',
      time: 0,
      duration: 100,
    };
    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(_.isEqual(currentId3Object, expectedResult)).to.be(true);
    OoyalaSsai.onResponse(currentId3Object, ssaiXml);
    expect(currentId3Object.duration).to.be(100);
  });

  it('Ad Timeline should be set after ad metadata request', () => {
    OoyalaSsai.initialize(amc);
    const mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100',
    };
    const metadataResponse = {
      ads: [{
        id: 'pre', start: 0, duration: 30.0, adtype: 'preroll', adbreakname: 'preroll',
      },
      {
        id: 'mid', start: 70.4, duration: 15.5, adtype: 'midroll', adbreakname: 'midroll1',
      },
      {
        id: 'post', start: 600.04, duration: 30.1, adtype: 'postroll', adbreakname: 'postroll',
      }],
    };
    OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    OoyalaSsai.onMetadataResponse(metadataResponse);
    expect(OoyalaSsai.timeline).to.eql(metadataResponse);
  });

  it('Ad url should be parsed for ssai guid and embed on content change', () => {
    const testEmbed = 'mytestembedcode12345';
    const testGuid = 'abcdefgh-1234-abcd-1234-abcdefghijk';
    OoyalaSsai.initialize(amc);
    OoyalaSsai.onContentUrlChanged('eventName', `http://ssai.ooyala.com/vhls/${testEmbed}/pcode/abcd1234?ssai_guid=${testGuid}`);
    expect(OoyalaSsai.ssaiGuid).to.eql(testGuid);
    expect(OoyalaSsai.currentEmbed).to.eql(testEmbed);
  });

  it('Ad url domain should be parsed from content url on content change', () => {
    const testEmbed = 'mytestembedcode12345';
    const testGuid = 'abcdefgh-1234-abcd-1234-abcdefghijk';
    const testDomain = 'ssai-staging.ooyala.com';
    OoyalaSsai.initialize(amc);
    expect(OoyalaSsai.domainName).to.eql('ssai.ooyala.com');
    OoyalaSsai.onContentUrlChanged('eventName', `http://${testDomain}/vhls/${testEmbed}/pcode/abcd1234?ssai_guid=${testGuid}`);
    expect(OoyalaSsai.ssaiGuid).to.eql(testGuid);
    expect(OoyalaSsai.currentEmbed).to.eql(testEmbed);
    expect(OoyalaSsai.domainName).to.eql(testDomain);
  });

  it('Ad Id should be marked with the error state if the ad request fails', () => {
    OoyalaSsai.initialize(amc);

    // ID3 Tag ad duration should be selected
    const mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100',
    };
    const expectedResult = {
      adId: '11de5230-ff5c-4d36-ad77-c0c7644d28e9',
      time: 0,
      duration: 100,
    };
    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(_.isEqual(currentId3Object, expectedResult)).to.be(true);
    OoyalaSsai.onRequestError(currentId3Object);

    const { adId } = expectedResult;

    expect(OoyalaSsai.adIdDictionary[adId].state).to.be('error');
  });

  it('Correct VOD offset value should be calculated onPlayheadTimeChanged', () => {
    OoyalaSsai.initialize(amc);
    const eventName = '';
    const playhead = 0;
    const duration = 100;

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, duration);
    let offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(100);

    OoyalaSsai.onPlayheadTimeChanged(eventName, 50, duration);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(50);

    OoyalaSsai.onPlayheadTimeChanged(eventName, 75, duration);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(25);

    OoyalaSsai.onPlayheadTimeChanged(eventName, 100, duration);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    // Test bad input
    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, 'banana');
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, 'apple', 'banana');
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, 0);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, undefined);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, undefined, duration);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, undefined, undefined);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, null);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, null, duration);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(duration);

    OoyalaSsai.onPlayheadTimeChanged(eventName, null, null);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, {});
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, {}, duration);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);
  });

  it('Correct Live offset value should be calculated onPlayheadTimeChanged', () => {
    amc.isLiveStream = true;
    OoyalaSsai.initialize(amc);
    const eventName = '';
    const playhead = 0;
    const duration = 100;
    const offsetTime = 0;

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, duration, offsetTime);
    let offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, duration, 50);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(50);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, duration, 99.0);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(1);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, duration, -1);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, duration, 100);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    // We should not have an offset that is greater than duration
    // Keep the previous offset value if an error occurs while calculating new offset
    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, duration, 101);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    // Test bad input
    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, 'banana');
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, 'banana');
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, undefined);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, null);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, null);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, undefined);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, {});
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, null);
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);

    OoyalaSsai.onPlayheadTimeChanged(eventName, playhead, {});
    offset = OoyalaSsai.getCurrentOffset();
    expect(offset).to.be(0);
  });

  it('Vast cache is deleted when ad is completed', () => {
    OoyalaSsai.initialize(amc);
    OoyalaSsai.setCurrentOffset(1);

    let mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100',
    };
    let currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=25&d=100',
    };
    currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=50&d=100',
    };
    currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=75&d=100',
    };
    currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=100&d=100',
    };
    currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(OoyalaSsai.adIdDictionary[currentId3Object.adId]).to.be(undefined);
  });

  it('Ad break contains two ads', () => {
    OoyalaSsai.initialize(amc);
    OoyalaSsai.setCurrentOffset(1);
    let mockId3Tag = {
      TXXX: 'adid=11de5230&t=0&d=100',
    };
    let currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(OoyalaSsai.adIdDictionary[currentId3Object.adId]).to.not.be(null);
    mockId3Tag = {
      TXXX: 'adid=11de5230&t=25&d=100',
    };
    currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    mockId3Tag = {
      TXXX: 'adid=11de5230&t=50&d=100',
    };
    currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    mockId3Tag = {
      TXXX: 'adid=11de5230&t=75&d=100',
    };
    currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    mockId3Tag = {
      TXXX: 'adid=11de5230&t=100&d=100',
    };
    currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(OoyalaSsai.adIdDictionary[currentId3Object.adId]).to.be(undefined);
    let mockId3Tag2 = {
      TXXX: 'adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=0&d=15.160',
    };
    let currentId3Object2 = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag2);
    expect(OoyalaSsai.adIdDictionary[currentId3Object2.adId].vastData).to.not.be(null);
    mockId3Tag2 = {
      TXXX: 'adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=25&d=15.160',
    };
    currentId3Object2 = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag2);
    mockId3Tag2 = {
      TXXX: 'adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=50&d=15.160',
    };
    currentId3Object2 = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag2);
    mockId3Tag2 = {
      TXXX: 'adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=75&d=15.160',
    };
    currentId3Object2 = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag2);
    mockId3Tag2 = {
      TXXX: 'adid=8d157f0b-4f74-4eba-b969-94b3f30616a8&t=100&d=15.160',
    };
    currentId3Object2 = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag2);
    expect(OoyalaSsai.adIdDictionary[currentId3Object2.adId]).to.be(undefined);
  });

  it('Should fire notifySSAIAdPlaying if ad time is less than 100', () => {
    let ssaiAdFound = {};
    amc.notifySSAIAdPlaying = function (ad) {
      ssaiAdFound = ad;
    };
    OoyalaSsai.initialize(amc);
    OoyalaSsai.setCurrentOffset(1);
    const mockId3Tag = {
      TXXX: 'adid=11de5230&t=0&d=100',
    };
    const expectedAd = { adId: '11de5230', time: 0, duration: 100 };
    OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(ssaiAdFound).to.eql(expectedAd);
  });

  it('Should fire notifySSAIAdPlayed if ad time is equal to 100', () => {
    let notifySSAIAdPlayingCalled = false;
    amc.notifySSAIAdPlayed = function () {
      notifySSAIAdPlayingCalled = true;
    };
    OoyalaSsai.initialize(amc);
    OoyalaSsai.setCurrentOffset(1);
    const mockId3Tag = {
      TXXX: 'adid=11de5230&t=100&d=100',
    };
    OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(notifySSAIAdPlayingCalled).to.eql(true);
  });

  it('Init: SSAI requires embed code metadata', () => {
    let embedCodeMetadata = false;
    amc.willRequireEmbedCodeMetadata = function () {
      embedCodeMetadata = true;
    };
    OoyalaSsai.initialize(amc);
    expect(() => {
      OoyalaSsai.loadMetadata({
        html5_ssl_ad_server: 'https://blah',
        html5_ad_server: 'http://blah',
      }, {}, {});
    }).to.not.throwException();
    expect(embedCodeMetadata).to.be(true);
  });

  it('Ad timer is cleared when pause occurs', () => {
    const mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100',
    };
    const ad = {
      ad: {
        data: {
          id: '11de5230',
        },
      },
    };
    OoyalaSsai.initialize(amc);
    OoyalaSsai.setCurrentOffset(1);
    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(OoyalaSsai.adIdDictionary[currentId3Object.adId].adTimer).to.not.be(undefined);
    OoyalaSsai.pauseAd(ad);
    expect(OoyalaSsai.adIdDictionary[currentId3Object.adTimer]).to.be(undefined);
  });

  it('Ad timer is created again when resume occurs', () => {
    const mockId3Tag = {
      TXXX: 'adid=11de5230-ff5c-4d36-ad77-c0c7644d28e9&t=0&d=100',
    };
    const ad = {
      ad: {
        data: {
          id: '11de5230',
        },
      },
    };
    OoyalaSsai.initialize(amc);
    OoyalaSsai.setCurrentOffset(1);
    const currentId3Object = OoyalaSsai.onVideoTagFound('eventName', 'videoId', 'tagType', mockId3Tag);
    expect(OoyalaSsai.adIdDictionary[currentId3Object.adId].adTimer).to.not.be(undefined);
    OoyalaSsai.pauseAd(ad);
    expect(OoyalaSsai.adIdDictionary[currentId3Object.adTimer]).to.be(undefined);
    OoyalaSsai.resumeAd(ad);
    expect(OoyalaSsai.adIdDictionary[currentId3Object.adId]).to.not.be(undefined);
  });
});
