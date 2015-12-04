google = {
  ima : {
    AdDisplayContainer : function() {
      this.initialize = function() {};
      this.destroy = function() {};
    },
    settings : {
      setPlayerVersion : function() {},
      setPlayerType : function() {}
    },
    AdsManagerLoadedEvent : {
      Type : {
        ADS_MANAGER_LOADED : "adsManagerLoaded"
      }
    },
    AdErrorEvent : {
      Type : {}
    },
    AdsLoader : function() {
      var callbacks = {};
      var adsManagerLoadedEvent = {
        getAdsManager : function() {
          return {
            getCuePoints: function () {
              return [];
            },
            addEventListener: function () {

            },
            stop: function () {
            },
            destroy: function () {
            }
          };
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
    AdsRequest : function() {},
    AdsRenderingSettings : function() {},
    AdEvent : {
      Type : {}
    }
  }
};