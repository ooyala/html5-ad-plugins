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
    this.play = function() {};
  };

  var initialize = function() {
    fw.initialize(amc);
    fw.registerUi();
    fw.loadMetadata({"fw_mrm_network_id":"100",
                     "html5_ssl_ad_server":"https://blah",
                     "html5_ad_server": "http://blah"},
                    {});
    amc.timeline = fw.buildTimeline();
  };

  var play = function() {
    amc.callbacks[amc.EVENTS.INITIAL_PLAY_REQUESTED]();
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
  });

  afterEach(_.bind(function() {
    fw.destroy();
    fwContext = null;
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
    fw.initialize(amc);
    fw.registerUi();
    expect(function() { fw.loadMetadata({"fw_mrm_network_id":"100",
                                         "html5_ssl_ad_server":"https://blah",
                                         "html5_ad_server": "http://blah"},
                                        {}); }).to.not.throwException();
  });

  it('Init: ad manager is ready', function(){
    fw.initialize(amc);
    fw.registerUi();
    expect(fw.ready).to.be(false);
    fw.loadMetadata({"fw_mrm_network_id":"100",
                     "html5_ssl_ad_server":"https://blah",
                     "html5_ad_server": "http://blah"},
                    {});
    expect(fw.ready).to.be(true);
  });

  it('Init: fake ad is added to timeline', function(){
    initialize();
    expect(amc.timeline.length).to.be(1);
    expect(amc.timeline[0].ad.type).to.be("adRequest");
  });

  it('Init: fw context is set up', function(){
    initialize();
    expect(amc.timeline.length).to.be(1);
    play();
    fw.playAd(amc.timeline[0], function(){});
    expect(fwContext).to.not.be(null);
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
    debugger;
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
    debugger;
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
});
