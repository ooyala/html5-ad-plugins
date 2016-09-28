global.vpaid = {
  adInit: false,
  adStarted: false,
  adStopped: false,
  adSkipped: false
}

global.vpaid.VpaidAd = function() {
  this.slot_ = null;
  this.eventsCallbacks = {};
  this.videoSlot_ = null;
  this.properties = {
    adLinear: true,
    skippableState: false,
    adParameters: '{}',
    width: 100,
    height: 100,
    adCompanions: {companion: {}}
  };
  this.initAd = function(width, height, viewMode, desiredBitrate, creativeData, environmentVars) {
    global.vpaid.adInit = true;
    this.properties.adParameters = JSON.parse(creativeData.AdParameters);
    this.callEvent('AdLoaded');
  };
  this.handshakeVersion = function(version) { return ('2.0'); };
  this.startAd = function() {
    global.vpaid.adStarted = true;
  };
  this.stopAd = function() {
    this.callEvent('AdStopped');
    global.vpaid.adStopped = true;
   };
  this.resizeAd = function(width, height, viewMode) {
    this.properties.width = width;
    this.properties.height = height;
  };
  this.adVideoCompleted = function() {
    this.callEvent('AdVideoComplete');
  };
  this.pauseAd = function() {};
  this.resumeAd = function() {};
  this.expandAd = function() {};
  this.collapseAd = function() {};
  this.sendClick = function(playerHandles) {
    this.eventsCallbacks['AdClickThru'].apply(this, ['url', 1, playerHandles]);
  }
  this.sendAdLinearChange = function(isLinear) {
    this.properties['adLinear'] = isLinear;
    this.callEvent('AdLinearChange');
  }
  this.skipAd = function() {
    global.vpaid.adSkipped = true;
    this.callEvent('AdSkipped');
  };
  this.subscribe = function(aCallback, eventName, aContext) {
    var cb = aCallback.bind(aContext);
    this.eventsCallbacks[eventName] = cb;
  };
  this.unsubscribe = function(eventName) {};
  this.setSkippableState = function(state) {
    this.properties.skippableState = state;
    this.callEvent('AdSkippableStateChange');
  };
  this.getAdSkippableState = function() {
    return this.properties.skippableState;
  };
  this.getAdCompanions = function() {
    return this.properties.adCompanions;
  }
  this.getAdLinear = function() {
    return this.properties['adLinear'];
  };
  this.setAdLinear = function(adLinear) {
    this.properties['adLinear'] = adLinear;
  };
  this.callEvent = function(eventType) {
    if (eventType in this.eventsCallbacks) {
      this.eventsCallbacks[eventType]();
    }
  };
};

// Has all required functions but handshakeVersion returns <2.0
global.vpaid.incorrectVersionVPAIDAd = function() {
  this.slot_ = null;
  this.videoSlot_ = null;
  this.properties = {
    adLinear: true
  };
  this.initAd = function(width, height, viewMode, desiredBitrate, creativeData, environmentVars) {
    global.vpaid.adInit = true;
  };
  this.handshakeVersion = function(version) { return ('1.0'); };
  this.startAd = function() {};
  this.stopAd = function() {};
  this.resizeAd = function(width, height, viewMode) {};
  this.pauseAd = function() {};
  this.resumeAd = function() {};
  this.expandAd = function() {};
  this.collapseAd = function() {};
  this.skipAd = function() {};
  this.subscribe = function(aCallback, eventName, aContext) {};
  this.unsubscribe = function(eventName) {};
};

//required functions missing
global.vpaid.missingFnVPAIDAd = function() {
  this.initAd = function(width, height, viewMode, desiredBitrate, creativeData, environmentVars) {
    global.vpaid.adInit = true;
  };
  this.handshakeVersion = function(version) { return ('2.0'); };
  this.startAd = function() {};
  this.stopAd = function() {};
};

global.vpaidAd = {
  position: 0,
  duration: 16,
  adManager: 'vast',
  ad: {
    data: {
      adType: 'vpaid',
      companion: [{
        width: '300',
        height: '250',
        companionClickThrough: 'click1',
        type: 'static',
        data: 'image1.jpg',
        url: 'image1.jpg',
        expandedWidth: undefined,
        expandedHeight: undefined,
        tracking: { creativeView: [] }
      }],
      error: '',
      impression: [ { url: 'impressionUrl' } ],
      linear: {
        mediaFiles: {
          url: 'http://file.js',
          type: 'application/javascript',
          width: 16,
          height: 9,
          tracking: []
        },
        skipOffset: null,
        clickTracking: '',
        clickThrough: '',
        customClick: ''
      },
      nonLinear: {
        mediaFiles: {
          url: 'http://file.js',
          type: 'application/javascript',
          width: 16,
          height: 9,
          tracking: []
        },
        skipOffset: null,
        clickTracking: '',
        clickThrough: '',
        customClick: ''
      },
      title: 'title',
      tracking: [
        { event: 'start', url: 'startUrl' },
        { event: 'firstQuartile', url: 'firstQuartileUrl' },
        { event: 'complete', url: 'completeUrl' },
        { event: 'mute', url: 'muteUrl' }
      ],
      type: 'linearVideo',
      version: '2.0',
      videoClickTracking: { clickTracking: '', clickThrough: '', customClick: '' } 
    },
    fallbackAd: null,
    positionSeconds: 0,
    adParams: '{}',
    streams: { mp4: '' },
    type: 'InLine',
    durationInMilliseconds: 16000,
  },
  isLinear: true
};
