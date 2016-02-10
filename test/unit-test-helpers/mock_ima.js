google =
{
  ima :
  {
    adManagerInstance : null,   //for unit test convenience
    linearAds : true,          //for unit test convenience
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
      //getHeight,
      //getMinSuggestedDuration,
      //getTitle,
      //getTraffickingParameters,
      //getTraffickingParametersString,
      //getUiElements,
      //getWidth,
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
      setPlayerType : function() {}
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
      Type : {}
    },
    AdsLoader : function(container)
    {
      var callbacks = {};
      var adsManagerLoadedEvent =
      {
        getAdsManager : function()
        {
          if (!google.ima.adManagerInstance)
          {
            var mockAdManager = function()
            {
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
              this.start = function() {};
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
                if (typeof amCallbacks[event] === "function")
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
      this.addEventListener = function(event, callback)
      {
        callbacks[event] = callback;
      };
      this.contentComplete = function() {};
      this.requestAds = function()
      {
        //mock executes this callback immediately. Typically this does not occur in real world situations
        if (typeof callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED] === "function")
        {
          callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED](adsManagerLoadedEvent);
        }
      };
      this.destroy = function() {};
    },
    AdsRequest : function() {},
    AdsRenderingSettings : function() {},
    AdEvent :
    {
      Type :
      {
        ALL_ADS_COMPLETED : "allAdsCompleted",
        COMPLETE : "complete",
        SKIPPED : "skipped",
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
        AD_ERROR : "adError",
        CONTENT_PAUSE_REQUESTED : "contentPauseRequested",
        CONTENT_RESUME_REQUESTED : "contentResumeRequested"
      }
    },
    ViewMode : {}
  }
};
