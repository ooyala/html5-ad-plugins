const Ad = function () {
  // see https://developers.google.com/interactive-media-ads/docs/sdks/html5/v3/apis#ima.Ad
  this.g = { vpaid: false };
  this.getAdId = function () {
    return 'blah';
  };
  this.getAdPodInfo = function () {
    return {
      getTotalAds() {
        return 1;
      },
      getAdPosition() {
        return 1;
      },
      getPodIndex() {
        return 0;
      },
    };
  };
  // getAdSystem,
  // getCompanionAds,
  this.getContentType = function () {
    return 'video';
  };
  // getDescription,
  this.getDuration = function () {
    return -1;
  };
  this.getHeight = function () {
    return -1;
  };
  // getMinSuggestedDuration,
  // getTitle,
  // getTraffickingParameters,
  // getTraffickingParametersString,
  // getUiElements,
  this.getWidth = function () {
    return -1;
  };
  // getWrapperAdIds,
  // getWrapperAdSystems,
  this.isLinear = function () {
    return google.ima.linearAds;
  };

  this.getMediaUrl = function () {
    return 'http:media.url.com';
  };
};

const AdsRequest = function () {
  return {
    setAdWillPlayMuted(adWillPlayMuted) {
      google.ima.adWillPlayMuted = adWillPlayMuted;
    },
  };
};

const AdsRenderingSettings = function () {
  google.ima.adsRenderingSettingsInstance = this;
};

const AdsLoader = function (container) {
  google.ima.adLoaderInstance = this;
  const callbacks = {};
  const adsManagerLoadedEvent = {
    type: google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
    getAdsManager() {
      if (!google.ima.adManagerInstance) {
        const mockAdManager = function () {
          const amCallbacks = {};
          let currentAd = null;
          this.init = function () {
            if (!currentAd) {
              currentAd = new google.ima.Ad();
            }
            google.ima.adsManagerInitCalled = true;
          };
          this.getCuePoints = function () {
            return [];
          };
          this.addEventListener = function (event, callback) {
            amCallbacks[event] = callback;
          };
          this.start = function () {
            google.ima.adsManagerStarted = true;
          };
          this.stop = function () {};
          this.resume = function () {};
          this.pause = function () {};
          this.resize = function () {};
          this.getRemainingTime = function () {};
          this.setVolume = function () {};
          this.getVolume = function () {};
          this.destroy = function () {
            google.ima.adManagerInstance = null;
            currentAd = null;
          };
          this.publishEvent = function (event) { // convenience function for unit tests
            if (typeof amCallbacks[event] === 'function') {
              if (event === google.ima.AdErrorEvent.Type.AD_ERROR) {
                amCallbacks[event](
                  {
                    type: event,
                    getError() {
                      return {
                        getType() {
                          return 'someAdError';
                        },
                        getInnerError() {
                          return 900;
                        },
                        getErrorCode() {
                          return 900;
                        },
                        getVastErrorCode() {
                          return 1001;
                        },
                        getMessage() {
                          return 'Some Error Message';
                        },
                      };
                    },

                  },
                );
              } else {
                amCallbacks[event](
                  {
                    type: event,
                    getAd() {
                      return currentAd;
                    },
                    getAdData() {
                      return {};
                    },
                  },
                );
              }
            }
          };
          this.getCurrentAd = function () { // convenience function for unit tests
            return currentAd;
          };
          this.isCustomPlaybackUsed = function () {
            return false;
          };
        };
        google.ima.adManagerInstance = new mockAdManager();
      }
      return google.ima.adManagerInstance;
    },
  };
  this.getSettings = function () {
    return {
      setAutoPlayAdBreaks() {},
    };
  };
  this.addEventListener = function (event, callback) {
    callbacks[event] = callback;
  };
  this.contentComplete = function () {};
  this.requestAds = function () {
    google.ima.adsRequestMade = true;
    // mock executes this callback immediately. Typically this does not occur in real world situations
    if (typeof callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED] === 'function') {
      if (google.ima.delayAdRequest) {
        google.ima.delayedAdRequestCallback = function () {
          callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED](adsManagerLoadedEvent);
        };
      } else {
        callbacks[google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED](adsManagerLoadedEvent);
      }
    }
  };
  this.destroy = function () {
    google.ima.adLoaderInstance = null;
  };
};

const AdDisplayContainer = function () {
  google.ima.adDisplayContainerInstance = this;
  this.initialize = function () {};
  this.destroy = function () {
    google.ima.adDisplayContainerInstance = null;
  };
};

google = {
  ima:
  {
    linearAds: true,
    delayedAdRequestCallback: null, // for unit test convenience, call when delayAdRequest is true to complete the ad request
    delayAdRequest: false, // for unit test convenience,
    // normally a call to requestAds calls its callback immediately in this mock
    adManagerInstance: null, // for unit test convenience
    adLoaderInstance: null, // for unit test convenience
    adDisplayContainerInstance: null, // for unit test convenience
    adsRenderingSettingsInstance: null, // for unit test convenience
    disableCustomPlaybackForIOS10Plus: false, // for unit test convenience
    adsManagerStarted: false, // for unit test convenience
    adsManagerInitCalled: false, // for unit test convenience
    adsRequestMade: false,
    resetDefaultValues() {
      google.ima.linearAds = true;
      google.ima.delayedAdRequestCallback = null;
      google.ima.delayAdRequest = false;
      google.ima.adsRenderingSettingsInstance = null;
      google.ima.disableCustomPlaybackForIOS10Plus = false;
      google.ima.adsManagerStarted = false;
      google.ima.adsManagerInitCalled = false;
      google.ima.adsRequestMade = false;
      delete google.ima.adWillPlayMuted;
    },
    Ad,
    AdDisplayContainer,
    settings:
    {
      setPlayerVersion() {},
      setPlayerType() {},
      setVpaidMode() {},
      setLocale() {},
      setDisableFlashAds() {},
      setDisableCustomPlaybackForIOS10Plus(newValue) {
        google.ima.disableCustomPlaybackForIOS10Plus = newValue;
      },
      setNumRedirects(newValue) { google.ima.numRedirects = newValue; },
    },
    AdsManagerLoadedEvent:
    {
      Type:
      {
        ADS_MANAGER_LOADED: 'adsManagerLoaded',
      },
    },
    AdErrorEvent:
    {
      Type: {
        AD_ERROR: 'adError',
      },
    },
    AdsLoader,
    AdsRequest,
    AdsRenderingSettings,
    AdEvent:
    {
      Type:
      {
        AD_BREAK_READY: 'adBreakReady',
        AD_METADATA: 'adMetadata',
        ALL_ADS_COMPLETED: 'allAdsCompleted',
        CLICK: 'click',
        COMPLETE: 'complete',
        CONTENT_PAUSE_REQUESTED: 'contentPauseRequested',
        CONTENT_RESUME_REQUESTED: 'contentResumeRequested',
        DURATION_CHANGE: 'durationChange',
        FIRST_QUARTILE: 'firstQuartile',
        IMPRESSION: 'impression',
        INTERACTION: 'interaction',
        LINEAR_CHANGED: 'linearChanged',
        LOADED: 'loaded',
        LOG: 'log',
        MIDPOINT: 'midpoint',
        PAUSED: 'paused',
        RESUMED: 'resumed',
        SKIPPABLE_STATE_CHANGED: 'skippableStateChanged',
        SKIPPED: 'skipped',
        STARTED: 'started',
        THIRD_QUARTILE: 'thirdQuartile',
        USER_CLOSE: 'userClose',
        VOLUME_CHANGED: 'volumeChanged',
        VOLUME_MUTED: 'volumeMuted',
      },
    },
    AdError:
    {
      ErrorCode:
      {
        ADSLOT_NOT_VISIBLE: -1,
        COMPANION_AD_LOADING_FAILED: -1,
        COMPANION_REQUIRED_ERROR: 602,
        FAILED_TO_REQUEST_ADS: 1005,
        INVALID_ADX_EXTENSION: 1105,
        INVALID_ARGUMENTS: 1101,
        NONLINEAR_DIMENSIONS_ERROR: 501,
        OVERLAY_AD_LOADING_FAILED: -1,
        OVERLAY_AD_PLAYING_FAILED: 500,
        REQUIRED_LISTENERS_NOT_ADDED: 900,
        UNKNOWN_AD_RESPONSE: 1010,
        UNKNOWN_ERROR: 900,
        UNSUPPORTED_LOCALE: 1011,
        VAST_ASSET_MISMATCH: 403,
        VAST_ASSET_NOT_FOUND: 1007,
        VAST_EMPTY_RESPONSE: 1009,
        VAST_LINEAR_ASSET_MISMATCH: 403,
        VAST_LOAD_TIMEOUT: 301,
        VAST_MALFORMED_RESPONSE: -1,
        VAST_MEDIA_ERROR: -1,
        VAST_MEDIA_LOAD_TIMEOUT: 402,
        VAST_NONLINEAR_ASSET_MISMATCH: 503,
        VAST_NO_ADS_AFTER_WRAPPER: 303,
        VAST_SCHEMA_VALIDATION_ERROR: 10,
        VAST_TOO_MANY_REDIRECTS: 302,
        VAST_TRAFFICKING_ERROR: 200,
        VAST_UNEXPECTED_DURATION_ERROR: 202,
        VAST_UNEXPECTED_LINEARITY: 201,
        VAST_UNSUPPORTED_VERSION: 102,
        VAST_WRAPPER_ERROR: 300,
        VIDEO_ELEMENT_REQUIRED: -1,
        VIDEO_ELEMENT_USED: -1,
        VIDEO_PLAY_ERROR: 400,
      },
    },
    ViewMode: {},
    ImaSdkSettings:
    {
      VpaidMode:
      {
        ENABLED: 'enabled',
      },
    },
  },
};
