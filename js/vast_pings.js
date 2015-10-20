  (function(OO, _, $){
    /*
     *  AdsManager will manage the Ads config load and notify playback controller when they are ready.
     *  It will intercept willFetchAds event, and send adFetched event to notify playbck to continue.
     *  PlaybackController will timeout if willFetchAds does not return in OO.playerParams.maxAdsTimeout
     *  seconds.
     */

    var VastPings = function(messageBus, id) {
      if (!OO.requiredInEnvironment('ads')) {return;}
      this.Id = id;
      this.mb = messageBus;

      this.currentVastAd = null;
      this.pingedKey = {};
      this.pauseClicked = false;
      this.isMuted = false;
      // TODO, handle error: when valid vast comes back, but no stream can be played:
      OO.StateMachine.create({
        initial:'Init',
        messageBus:this.mb,
        moduleName:'vastPings',
        target:this,
        events:[
          {name:OO.EVENTS.PLAY_STREAM,                  from:'*'},
          {name:OO.EVENTS.PLAY_MIDROLL_STREAM,          from:'*'},
          {name:OO.EVENTS.STREAM_PLAYED,                from:'*'},
          {name:OO.EVENTS.MIDROLL_STREAM_PLAYED,        from:'*'},

          {name:OO.EVENTS.FULLSCREEN_CHANGED,           from:'*'},
          {name:OO.EVENTS.VOLUME_CHANGED,               from:'*'},

          {name:OO.EVENTS.PAUSED,                       from:'*'},
          {name:OO.EVENTS.PLAYHEAD_TIME_CHANGED,        from:'*'},
          {name:OO.EVENTS.ADS_CLICKED,                  from:'*'}
        ]
      });

    };

    _.extend(VastPings.prototype, {
      onFullscreenChanged: function(event, isFullScreen) {
        if (this.currentVastAd == null) { return; }
        this._vastTrackings(isFullScreen ? 'fullscreen' : 'collapse');
      },

      onVolumeChanged: function(event, volume) {
        if (this.currentVastAd == null) { return; }
        var isMuted = (volume == 0);
        this._vastTrackings( (isMuted && !this.isMuted) ? 'mute' : 'unmute');
        this.isMuted = isMuted;
      },

      onAdsClicked: function() {
        if (this.currentVastAd) {
          var clickTracking = this.currentVastAd.data && this.currentVastAd.data.linear &&
             this.currentVastAd.data.linear.ClickTracking;
          OO.log("Click Tracking:", clickTracking);
          if (clickTracking) { OO.pixelPings(clickTracking); }
        }
      },

      onPaused: function() {
        this.pauseClicked = true;
        if (this.currentVastAd) {
          this._vastTrackings('pause');
        }
      },

      onPlayStream: function(event, url, item) {
        if (this.pauseClicked) {
          this._itemResumePlay(item);
        } else {
          this._itemStartPlay(item);
        }
      },

      onPlayMidrollStream: function(event, url, item) {
        if (this.pauseClicked) {
          this._itemResumePlay(item);
        } else {
          this._itemStartPlay(item);
        }
      },

      onStreamPlayed: function(event) {
        this._itemPlayed();
      },

      onMidrollStreamPlayed: function(event, mainVideoPlayhead) {
        this._itemPlayed();
      },

      onPlayheadTimeChanged: function(event, time, duration) {
        if (this.currentVastAd == null || duration == 0) { return; }
        // send percentile pings.
        if (time > duration * 0.75) {
          this._vastTrackings('thirdQuartile');
        } else if (time > duration * 0.50) {
          this._vastTrackings('midpoint');
        } else if (time > duration * 0.25) {
          this._vastTrackings('firstQuartile');
        }
      },

      _itemStartPlay: function(item) {
        if (!item || item.type != "ad" || !item.item) { return; }
        this.currentVastAd = item.item;
        // ping urls, this will make sure Ooyala tracking_url is also pinged.
        OO.pixelPings(this.currentVastAd.tracking_url);

        if (item.item.type != "vast") { return; }
        if (this.currentVastAd.data) {
          this.pingedKey = {};
          OO.pixelPings(this.currentVastAd.data.impression);
          this._vastTrackings('start');
          this._vastTrackings('creativeView');
        }
        this.pauseClicked = false;
      },

      _itemResumePlay: function(item) {
        if (this.currentVastAd) {
          this._vastTrackings('resume');
        }
        this.pauseClicked = false;
      },

      _itemPlayed: function() {
        if (this.currentVastAd && this.currentVastAd.data && this.currentVastAd.data.tracking) {
          OO.pixelPings(this.currentVastAd.data.tracking.complete);
        }
        this._vastTrackings('complete');
        this.currentVastAd = null;
      },

      _vastTrackings: function(key) {
        // make sure we only send each ping once for each vast ads.
        if (this.pingedKey[key] == 1) { return; }
        this.pingedKey[key] = 1;
        if (this.currentVastAd && this.currentVastAd.data && this.currentVastAd.data.tracking) {
          OO.pixelPings(this.currentVastAd.data.tracking[key]);
        }
      },

      __placeholder: true
    });

    OO.registerModule('vastPings', function(messageBus, id) {
      return new VastPings(messageBus, id);
    });

  }(OO, OO._, OO.$));
