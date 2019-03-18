fwContext = null;
fwParams = {};
getTemporalSlots = function () {};
setVideoAsset = function () {};

AdInstance = function (params) {
  this._eventCallbacks = {};
  this._creative = {
    getDuration() {
      return params.duration;
    },
  };
  this.getSlot = function () {
    return {
      getCustomId() {
        return params.customId;
      },
    };
  };
  this.getActiveCreativeRendition = function () {
    return {
      getPrimaryCreativeRenditionAsset() {
        return {
          getName() {
            return params.name;
          },
        };
      },
      getWidth() {
        return params.width;
      },
      getHeight() {
        return params.height;
      },
    };
  };
};

const AdManager = function () {
  this.setNetwork = function () {};
  this.setServer = function () {};
  this.newContext = function () {
    fwContext = new function () {
      this.callbacks = {};
      this.setProfile = function () {};
      this.setVideoAsset = setVideoAsset;
      this.setSiteSection = function () {};
      this.addKeyValue = function () {};
      this.addEventListener = function (event, callback) {
        this.callbacks[event] = callback;
      };
      this.setParameter = function (constName, value, overrideLevel) {
        fwParams[constName] = { value, overrideLevel };
      };
      this.submitRequest = function () {};
      this.getTemporalSlots = getTemporalSlots;
      this.registerVideoDisplayBase = function () {};
      this.setContentVideoElement = function () {};
      this.setVideoState = function () {};
      this.setAdVolume = function () {};
      this.dispose = function () {};
    }();
    return fwContext;
  };
};

tv = {
  freewheel: {
    SDK: {
      EVENT_AD_IMPRESSION: 'adImpression',
      EVENT_AD_IMPRESSION_END: 'adImpressionEnd',
      EVENT_SLOT_STARTED: 'slotStarted',
      EVENT_SLOT_ENDED: 'slotEnded',
      EVENT_REQUEST_COMPLETE: 'requestComplete',
      EVENT_AD_CLICK: 'adClick',
      EVENT_ERROR: 'error',
      TIME_POSITION_CLASS_PREROLL: 'preroll',
      TIME_POSITION_CLASS_MIDROLL: 'midroll',
      TIME_POSITION_CLASS_POSTROLL: 'postroll',
      TIME_POSITION_CLASS_OVERLAY: 'overlay',
      VIDEO_STATE_PLAYING: 'playing',
      VIDEO_STATE_PAUSED: 'paused',
      VIDEO_STATE_STOPPED: 'stopped',
      PARAMETER_DESIRED_BITRATE: 'desiredBitrate',
      PARAMETER_LEVEL_OVERRIDE: 'override',
      PARAMETER_LEVEL_GLOBAL: 'global',

      AdManager,
    },
  },
};
