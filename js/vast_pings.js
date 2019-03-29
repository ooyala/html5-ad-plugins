
(function (OO) {
  /*
   *  AdsManager will manage the Ads config load and notify playback controller when they are ready.
   *  It will intercept willFetchAds event, and send adFetched event to notify playbck to continue.
   *  PlaybackController will timeout if willFetchAds does not return in OO.playerParams.maxAdsTimeout
   *  seconds.
   */

  /**
   * @class VastPings
   * @classDesc The Vast Pings class.
   * @param {object} messageBus The message bus object.
   * @param {*} id The id.
   * @constructor
   */
  const VastPings = function (messageBus, id) {
    if (!OO.requiredInEnvironment('ads')) { return; }
    this.Id = id;
    this.mb = messageBus;

    this.currentVastAd = null;
    this.pingedKey = {};
    this.pauseClicked = false;
    this.isMuted = false;
    // TODO, handle error: when valid vast comes back, but no stream can be played:
    OO.StateMachine.create({
      initial: 'Init',
      messageBus: this.mb,
      moduleName: 'vastPings',
      target: this,
      events: [
        { name: OO.EVENTS.PLAY_STREAM, from: '*' },
        { name: OO.EVENTS.PLAY_MIDROLL_STREAM, from: '*' },
        { name: OO.EVENTS.STREAM_PLAYED, from: '*' },
        { name: OO.EVENTS.MIDROLL_STREAM_PLAYED, from: '*' },

        { name: OO.EVENTS.FULLSCREEN_CHANGED, from: '*' },
        { name: OO.EVENTS.VOLUME_CHANGED, from: '*' },

        { name: OO.EVENTS.PAUSED, from: '*' },
        { name: OO.EVENTS.PLAYHEAD_TIME_CHANGED, from: '*' },
        { name: OO.EVENTS.ADS_CLICKED, from: '*' },
      ],
    });
  };

  Object.assign(VastPings.prototype, {

    /**
     * Callback for when we receive the FULLSCREEN_CHANGED event from the AMC.
     * @public
     * @method VastPings#onFullscreenChanged
     * @param {string} eventName The name of the event for which this callback is called.
     * @param {boolean} isFullScreen True if entering fullscreen mode and false when exiting.
     */
    onFullscreenChanged(eventName, isFullScreen) {
      if (this.currentVastAd == null) { return; }
      this._vastTrackings(isFullScreen ? 'fullscreen' : 'collapse');
    },

    /**
     * Callback for when we receive the VOLUME_CHANGED event from the AMC.
     * @public
     * @method VastPings#onVolumeChanged
     * @param {string} eventName The name of the event for which this callback is called.
     * @param {number} volume The current volume level.
     */
    onVolumeChanged(eventName, volume) {
      if (this.currentVastAd == null) { return; }
      const isMuted = (volume === 0);
      this._vastTrackings((isMuted && !this.isMuted) ? 'mute' : 'unmute');
      this.isMuted = isMuted;
    },

    /**
     * Callback for when we receive the ADS_CLICKED event from the AMC.
     * @public
     * @method VastPings#onAdsClicked
     */
    onAdsClicked() {
      if (this.currentVastAd) {
        const clickTracking = this.currentVastAd.data && this.currentVastAd.data.linear
             && this.currentVastAd.data.linear.ClickTracking;
        OO.log('Click Tracking:', clickTracking);
        if (clickTracking) { OO.pixelPings(clickTracking); }
      }
    },

    /**
     * On paused.
     * @public
     */
    onPaused() {
      this.pauseClicked = true;
      if (this.currentVastAd) {
        this._vastTrackings('pause');
      }
    },

    /**
     * On play stream.
     * @param {string} eventName The name of event.
     * @param {string} url The stream url.
     * @param {object} item The item object.
     * @public
     */
    onPlayStream(eventName, url, item) {
      if (this.pauseClicked) {
        this._itemResumePlay(item);
      } else {
        this._itemStartPlay(item);
      }
    },

    /**
     * On play midroll stream.
     * @param {string} eventName The name of event.
     * @param {string} url The stream url.
     * @param {object} item The item object.
     * @public
     */
    onPlayMidrollStream(eventName, url, item) {
      if (this.pauseClicked) {
        this._itemResumePlay(item);
      } else {
        this._itemStartPlay(item);
      }
    },

    /**
     * On stream played.
     */
    onStreamPlayed() {
      this._itemPlayed();
    },

    /**
     * On midroll stream played
     */
    onMidrollStreamPlayed() {
      this._itemPlayed();
    },

    /**
     * Callback for when we receive the PLAYHEAD_TIME_CHANGED event from the AMC.
     * @method VastPings#onPlayheadTimeChanged
     * @param {string} eventName The name of the event for which this callback is called
     * @param {number} time The total amount main video playback time (seconds)
     * @param {number} duration Duration of the live video (seconds).
     * @public
     */
    onPlayheadTimeChanged(eventName, time, duration) {
      if (this.currentVastAd == null || duration === 0) { return; }
      // send percentile pings.
      if (time > duration * 0.75) {
        this._vastTrackings('thirdQuartile');
      } else if (time > duration * 0.50) {
        this._vastTrackings('midpoint');
      } else if (time > duration * 0.25) {
        this._vastTrackings('firstQuartile');
      }
    },

    /**
     * Item start play.
     * @param {object} item The item object.
     * @private
     */
    _itemStartPlay(item) {
      if (!item || item.type !== 'ad' || !item.item) { return; }
      this.currentVastAd = item.item;
      // ping urls, this will make sure Ooyala tracking_url is also pinged.
      OO.pixelPings(this.currentVastAd.tracking_url);

      if (item.item.type !== 'vast') { return; }
      if (this.currentVastAd.data) {
        this.pingedKey = {};
        OO.pixelPings(this.currentVastAd.data.impression);
        this._vastTrackings('start');
        this._vastTrackings('creativeView');
      }
      this.pauseClicked = false;
    },

    /**
     * Item resume play.
     * @private
     */
    _itemResumePlay() {
      if (this.currentVastAd) {
        this._vastTrackings('resume');
      }
      this.pauseClicked = false;
    },

    /**
     * Item played.
     * @private
     */
    _itemPlayed() {
      if (this.currentVastAd && this.currentVastAd.data && this.currentVastAd.data.tracking) {
        OO.pixelPings(this.currentVastAd.data.tracking.complete);
      }
      this._vastTrackings('complete');
      this.currentVastAd = null;
    },

    /**
     * Vast trackings.
     * @param {string} key The pinged key.
     * @private
     */
    _vastTrackings(key) {
      // make sure we only send each ping once for each vast ads.
      if (this.pingedKey[key] === 1) { return; }
      this.pingedKey[key] = 1;
      if (this.currentVastAd && this.currentVastAd.data && this.currentVastAd.data.tracking) {
        OO.pixelPings(this.currentVastAd.data.tracking[key]);
      }
    },

    __placeholder: true,
  });

  OO.registerModule('vastPings', (messageBus, id) => new VastPings(messageBus, id));
}(OO));
