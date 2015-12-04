google = {
  ima: {
    adManagerInstance: null,   //for unit test convenience
    AdDisplayContainer: function() {
      this.initialize = function() {};
      this.destroy = function() {};
    },
    settings: {
      setPlayerVersion: function() {},
      setPlayerType: function() {}
    },
    AdsManagerLoadedEvent: {
      Type: {
        ADS_MANAGER_LOADED: "adsManagerLoaded"
      }
    },
    AdErrorEvent: {
      Type: {}
    },
    AdsLoader: function() {
      var callbacks = {};
      var adsManagerLoadedEvent = {
        getAdsManager: function() {
          if (!google.ima.adManagerInstance) {
            google.ima.adManagerInstance = {
              init: function() {},
              getCuePoints: function() {
                return [];
              },
              addEventListener: function() {},
              start: function() {},
              stop: function () {},
              resume: function() {},
              pause: function() {},
              destroy: function() {
                google.ima.adManagerInstance = null;
              }
            };
          }
          return google.ima.adManagerInstance;
        }
      };
      this.addEventListener = function(event, callback) {
        callbacks[event] = callback;
      };
      this.contentComplete = function() {};
      this.requestAds = function() {
        if (callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED]) {
          callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED](adsManagerLoadedEvent);
        }
      };
      this.destroy = function() {};
    },
    AdsRequest: function() {},
    AdsRenderingSettings: function() {},
    AdEvent: {
      Type: {}
    },
    ViewMode: {}
  }
};