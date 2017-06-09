google =
{
  ima :
  {
    delayAdRequest: false,      //for unit test convenience,
                                //normally a call to requestAds calls its callback immediately in this mock
    adManagerInstance : null,   //for unit test convenience
    adLoaderInstance : null,    //for unit test convenience
    resetDefaultValues : function()
    {
      google.ima.linearAds = true;
      google.ima.delayAdRequest = false;
    },
    Ad : function()
    {   //see https://developers.google.com/interactive-media-ads/docs/sdks/html5/v3/apis#ima.Ad
      this.getAdId = function()
      {
        return "blah";
      };
      this.getAdPodInfo = function()
      {
        return {
          getTotalAds : function ()
          {
            return 1;
          },
          getAdPosition : function ()
          {
            return 1;
          }
        };
      };
      //getAdSystem,
      //getCompanionAds,
      //getContentType,
      //getDescription,
      this.getDuration = function()
      {
        return -1;
      };
      this.getHeight = function()
      {
        return -1;
      };
      //getMinSuggestedDuration,
      //getTitle,
      //getTraffickingParameters,
      //getTraffickingParametersString,
      //getUiElements,
      this.getWidth = function()
      {
        return -1;
      };
      //getWrapperAdIds,
      //getWrapperAdSystems,
      this.isLinear = function()
      {
        return google.ima.linearAds;
      };
    },
    AdDisplayContainer : function()
    {
      this.initialize = function() {};
      this.destroy = function() {};
    },
    settings :
    {
      setPlayerVersion : function() {},
      setPlayerType : function() {},
      setVpaidMode : function() {},
      setLocale : function() {},
      setDisableFlashAds : function() {},
    },
    AdsManagerLoadedEvent :
    {
      Type :
      {
        ADS_MANAGER_LOADED : "adsManagerLoaded"
      }
    },
    AdErrorEvent :
    {
      Type : {
        AD_ERROR : "adError"
      }
    },
    AdsLoader : function(container)
    {
      google.ima.adLoaderInstance = this;
      var callbacks = {};
      var adsManagerLoadedEvent =
      {
        getAdsManager : function()
        {
          if (!google.ima.adManagerInstance)
          {
            var mockAdManager = function()
            {
              var canPublishEvents = false;
              var amCallbacks = {};
              var currentAd = null;
              this.init = function()
              {
                if (!currentAd)
                {
                  currentAd = new google.ima.Ad();
                }
              };
              this.getCuePoints = function()
              {
                return [];
              };
              this.addEventListener = function(event, callback)
              {
                amCallbacks[event] = callback;
              };
              this.start = function() {
                //Use the canPublishEvents flag to ensure that start
                //gets called, otherwise publish events will fail,
                //failing unit tests
                canPublishEvents = true;
              };
              this.stop = function() {};
              this.resume = function() {};
              this.pause = function() {};
              this.resize = function() {};
              this.getRemainingTime = function() {};
              this.getVolume = function() {};
              this.destroy = function()
              {
                google.ima.adManagerInstance = null;
                currentAd = null;
              };
              this.publishEvent = function(event)
              {      //convenience function for unit tests
                if (typeof amCallbacks[event] === "function" && canPublishEvents)
                {
                  amCallbacks[event](
                  {
                    type : event,
                    getAd : function()
                    {
                      return currentAd;
                    }
                  });
                }
              };
              this.getCurrentAd = function()
              {        //convenience function for unit tests
                return currentAd;
              };
              this.isCustomPlaybackUsed = function()
              {
                return false;
              };
            };
            google.ima.adManagerInstance = new mockAdManager();
          }
          return google.ima.adManagerInstance;
        }
      };
      this.getSettings = function() {
        return {
          setAutoPlayAdBreaks: function() {}
        };
      };
      this.addEventListener = function(event, callback)
      {
        callbacks[event] = callback;
      };
      this.contentComplete = function() {};
      this.requestAds = function()
      {
        //mock executes this callback immediately. Typically this does not occur in real world situations
        if (typeof callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED] === "function" &&
            !google.ima.delayAdRequest)
        {
          callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED](adsManagerLoadedEvent);
        }
      };
      this.destroy = function()
      {
        google.ima.adLoaderInstance = null;
      };
    },
    AdsRequest : function() {},
    AdsRenderingSettings : function() {},
    AdEvent :
    {
      Type :
      {
        ALL_ADS_COMPLETED : "allAdsCompleted",
        COMPLETE : "complete",
        SKIPPED : "skip",
        FIRST_QUARTILE : "firstQuartile",
        LOADED : "loaded",
        MIDPOINT : "midpoint",
        PAUSED : "paused",
        RESUMED : "resumed",
        STARTED : "started",
        THIRD_QUARTILE : "thirdQuartile",
        VOLUME_CHANGED : "volumeChanged",
        VOLUME_MUTED : "volumeMuted",
        USER_CLOSE : "userClose",
        DURATION_CHANGE : "durationChange",
        CLICK : "click",
        CONTENT_PAUSE_REQUESTED : "contentPauseRequested",
        CONTENT_RESUME_REQUESTED : "contentResumeRequested"
      }
    },
    ViewMode : {},
    ImaSdkSettings :
    {
      VpaidMode :
      {
        ENABLED : "enabled"
      }
    }
  }
};
