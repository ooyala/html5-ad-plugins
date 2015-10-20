/*
 * Unit test class for the Freewheel Ad Manager
 * https://github.com/Automattic/expect.js
 */

require(SRC_ROOT + "include/constants.js");
require(SRC_ROOT + "core/utils.js");
require(SRC_ROOT + "core/emitter.js");
require(SRC_ROOT + "core/message_bus.js");
require(SRC_ROOT + "core/state_machine.js");
require(TEST_ROOT + 'helpers/message_bus_helper.js');

// override OO.registerModule so we get a handle on factory method
//amcModuleFactory = null;
OO.registerModule = function(name, factory) {
  amcModuleFactory = factory;
};

//stubs
OO.exposeStaticApi = function() {};
OO.log = function() {};
OO.playerParams = { maxAdsTimeout:5000 };
OO.playerParams.platform = [];
OO.requiredInEnvironment = function(req) {return req != 'flash-playback'; };
OO.supportAds = true;

// load the module
require(SRC_ROOT + "modules/ads/ad_manager_controller.js");
require(TEST_ROOT + "helpers/mock_fw.js");

describe('ad_manager_freewheel_integration', function() {
  var mb,amc,fw;
  var name = "freewheel-ads-manager";

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
    fw.initialize(amc);
    fw.registerUi();
    fw.loadMetadata({"fw_mrm_network_id":"100",
                     "html5_ssl_ad_server":"https://blah",
                     "html5_ad_server": "http://blah"},
                    {});
  };

  var play = function() {
    mb.publish(OO.EVENTS.PLAY);
    mb.publish(OO.EVENTS.INITIAL_PLAY);
  };

  before(function() {
    require(SRC_ROOT + "modules/ads/freewheel.js");
  });

  after(function() {
    var parentDom, element;
    _.each(document.getElementsByTagName('style'), function(oneStyle){
      if (oneStyle.innerHTML.indexOf("fw_") >= 0) {
        element = oneStyle;
        parentDom = oneStyle.parentNode;
        parentDom.removeChild(element);
      }
    });
  });

  beforeEach(function() {
    // setup the mb and initialize amc, and get a reference to the amc
    mb = new OO.MessageBus();
    amc = amcModuleFactory(mb,'ads-manager-controller-test');
    mb.publish(OO.EVENTS.PLAYER_CREATED, {});

    // create fake ui elements
    amc.ui.rootElement = $("<div>", {});
    amc.ui.videoWrapper = $("<div>", {});
    amc.ui.ooyalaVideoElement = $("<div>", {class: "video"});
    amc.ui.adVideoElement = $("<div>", {class: "video"});
    amc.ui.pluginsElement = $("<div>", {});

    // get a reference to the ad manager
    var managers = OO.Ads.getRegisteredAdManagers();
    if (typeof managers[name] == "object" && managers[name].name == name) {
      fw = managers[name];
      fw.testMode = true;
    } else {
      throw "Freewheel ad manager not registered";
    }
  });

  afterEach(function() {
    fw.destroy();
    fwContext = null;
  });

  //   ------   TESTS   ------

  it('Init: mock fw is ready', function(){
    expect(typeof tv).to.be("object");
  });

  it('Init: ad manager is registered', function(){
    expect(Object.keys(OO.Ads.getRegisteredAdManagers()).length).to.be(1);
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

  it('Init: fw context is set up', function(){
    initialize();
    play();
    expect(fwContext).to.not.be(null);
  });

  it('Timeline: adds all valid slots', function() {
    getTemporalSlots = function(){
      return [
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_PREROLL, 0, 5000),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_MIDROLL, 15, 5000),
          new fakeAd("Not an ad", 15, 5000),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_MIDROLL, 10, 5000),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_OVERLAY, 10, 5000),
          new fakeAd(tv.freewheel.SDK.TIME_POSITION_CLASS_POSTROLL, 100000000, 5000)
      ];
    };
    initialize();
    expect(mb.published(OO.EVENTS.AMC_ALL_READY)).to.be.ok();
    expect(amc.getTimeline().length).to.be(1);
    play();
    fwContext.callbacks[tv.freewheel.SDK.EVENT_REQUEST_COMPLETE]({"success":true});
    expect(amc.getTimeline().length).to.be(7);
  });
});
