fwContext = null;
getTemporalSlots = function() {};
tv = {
  freewheel : {
    SDK : {
      EVENT_AD_IMPRESSION : "adImpression",
      EVENT_AD_IMPRESSION_END : "adImpressionEnd",
      EVENT_SLOT_STARTED : "slotStarted",
      EVENT_SLOT_ENDED : "slotEnded",
      EVENT_REQUEST_COMPLETE : "requestComplete",
      EVENT_AD_CLICK : "adClick",
      EVENT_ERROR : "error",
      TIME_POSITION_CLASS_PREROLL : "preroll",
      TIME_POSITION_CLASS_MIDROLL : "midroll",
      TIME_POSITION_CLASS_POSTROLL : "postroll",
      TIME_POSITION_CLASS_OVERLAY : "overlay",
      AdManager : function(){
        this.setNetwork = function(){};
        this.setServer = function(){};
        this.newContext = function(){
          fwContext = new function() {
            this.callbacks = {};
            this.setProfile = function(){};
            this.setVideoAsset = function(){};
            this.setSiteSection = function(){};
            this.addKeyValue = function(){};
            this.addEventListener = function(event, callback){
              this.callbacks[event] = callback;
            };
            this.setParameter = function(){};
            this.submitRequest = function(){};
            this.getTemporalSlots = getTemporalSlots;
            this.registerVideoDisplayBase = function(){};
            this.setContentVideoElement = function(){};
            this.setVideoState = function(){};
            this.dispose = function(){};
          }
          return fwContext;
        };
      }
    }
  }
};
