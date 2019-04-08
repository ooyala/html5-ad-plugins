OO.plugin('heartbeat', (OO) => {
  /**
   * Log.
   * @param {arrays} args The array of function arguments.
   */
  const log = function (...args) {
    OO.log.apply(this, ['heartbeat:', ...args]);
  };

  /**
   * @class heartbeat
   * @constructor
   * @param {object} mb The message bus object.
   * @classDesc The heartbeat class.
   */
  const heartbeat = function (mb) {
    const _this = this;
    let config = {};

    const DEFAULT_CONFIG = Object.freeze({
      Interval: 10 * 1000,
      ReportingPathPattern: '<hostname>/v1/vod_playback_pos/<embed_code>?ssai_guid=<ssai_guid>',
    });

    // constants
    _this.CONSTANTS = Object.freeze({
      HA_ASSET_FLAG: 'ha_enabled',
      HA_IGNORE_MAX_FLAG: 'ha_ignore_max_timeout',
      DEFAULT_SEGMENT_LENGTH: 4,
      PROXY_REFRESH_TIME: 6,
    });

    let streamUrl = '';
    let ssaiGuid = '';
    let embedCode = '';

    let playheadPosition = 0;
    const hostname = '//ssai.ooyala.com';
    let reportingPaused = false;

    let heartbeatTimer = 0;

    /**
     * Stops the interval from heartbeatTimer.
     */
    function stopHeartBeat() {
      clearInterval(heartbeatTimer);
    }

    /**
     * Report Heart Beat.
     */
    function reportHeartBeat() {
      if (reportingPaused) {
        return;
      }

      const reportUrl = config.ReportingPathPattern
        .replace(/<hostname>/g, hostname)
        .replace(/<embed_code>/g, embedCode)
        .replace(/<ssai_guid>/g, ssaiGuid);

      const data = {
        playheadpos: parseInt(playheadPosition, 10),
        pingfrequency: parseInt(config.Interval / 1000, 10),
      };

      fetch(reportUrl, {
        method: 'post',
        body: JSON.stringify(data),
      }).then(() => {
        log('Heartbeat was sent successfully');
      });
    }

    /**
     * Sets outer scope variable to a timer.
     * Stops another timer if has been working before.
     */
    function startHeartBeat() {
      stopHeartBeat();
      heartbeatTimer = setInterval(reportHeartBeat, config.Interval);
    }

    /**
     * Parse Guid.
     * @param {string} url The streamUrl.
     * @returns {string} Guid extracted from URL or empty string.
     */
    function parseGuid(url) {
      const reg = new RegExp(/ssai_guid=([^&?]*)/g);
      const result = reg.exec(url);

      if (result.length && result[1]) {
        return result[1];
      }
      return '';
    }

    /**
     * Callback for when we receive the VC_WILL_PLAY event from the AMC.
     * @param {string} eventName The name of the eventName.
     * @param {string} videoId The id of the video.
     * @param {string} url The url string.
     * @private
     * @method heartbeat#_onVcWillPlay
     */
    function _onVcWillPlay(eventName, videoId, url) {
      streamUrl = url || '';
      ssaiGuid = parseGuid(streamUrl);
      if (ssaiGuid) {
        reportHeartBeat();
        startHeartBeat();
      }
    }

    /**
     * Callback for when we receive the PLAYHEAD_TIME_CHANGED event from the AMC.
     * @param {string} eventName The name of the eventName.
     * @param {number} currentTime The current time.
     * @private
     * @method heartbeat#_onPlayheadTimeChange
     */
    function _onPlayheadTimeChange(eventName, currentTime) {
      playheadPosition = currentTime || 0;
    }

    /**
     * Callback for when we receive the EMBED_CODE_CHANGED event from the AMC.
     * @param {string} event The name of the event.
     * @param {string} theEmbedCode The embed code.
     * @private
     * @method heartbeat#_onEmbedCodeChanged
     */
    function _onEmbedCodeChanged(event, theEmbedCode) {
      embedCode = theEmbedCode || '';
    }

    /**
     * Callback for when we receive the PAUSE event from the AMC.
     * @private
     * @method heartbeat#_onPause
     */
    function _onPause() {
      reportingPaused = true;
    }

    /**
     * Callback for when we receive the PLAY event from the AMC.
     * @private
     * @method heartbeat#_onPlay
     */
    function _onPlay() {
      reportingPaused = false;
    }

    /**
     * Callback for when we receive the VC_PLAYED event from the AMC.
     * @private
     * @method heartbeat#_onPlayed
     */
    function _onPlayed() {
      reportingPaused = false;
      reportHeartBeat();
      stopHeartBeat();
    }

    /**
     * Build Config.
     * @param {object} configuration The configuration object
     * @returns {object} _config object
     */
    function buildConfig(configuration) {
      const _config = Object.assign({}, DEFAULT_CONFIG, configuration);

      if (!_config.segmentLength) {
        _config.maxSegmentsToCheck = _config.maxSegmentsToCheck || DEFAULT_CONFIG.maxSegmentsToCheck;
      } else {
        _config.maxSegmentsToCheck = -1;
      }
      return _config;
    }

    /**
     * Destroy.
     */
    function destroy() {
      stopHeartBeat();
      mb.unsubscribe(OO.EVENTS.VC_WILL_PLAY, 'heartbeat');
      mb.unsubscribe(OO.EVENTS.DESTROY, 'heartbeat');
      mb.unsubscribe(OO.EVENTS.EMBED_CODE_CHANGED, 'heartbeat');
      mb.unsubscribe(OO.EVENTS.PLAYHEAD_TIME_CHANGED, 'heartbeat');
      mb.unsubscribe(OO.EVENTS.PAUSE, 'heartbeat');
      mb.unsubscribe(OO.EVENTS.PLAY, 'heartbeat');
      mb.unsubscribe(OO.EVENTS.VC_PLAYED, 'hearbeat');
      log('destroy');
    }

    /**
     * Initialize.
     */
    function initialize() {
      config = buildConfig(config);

      // events subscribe
      mb.subscribe(OO.EVENTS.VC_WILL_PLAY, 'heartbeat', _onVcWillPlay);
      mb.subscribe(OO.EVENTS.EMBED_CODE_CHANGED, 'heartbeat', _onEmbedCodeChanged);
      mb.subscribe(OO.EVENTS.PLAYHEAD_TIME_CHANGED, 'heartbeat', _onPlayheadTimeChange);
      mb.subscribe(OO.EVENTS.PAUSE, 'heartbeat', _onPause);
      mb.subscribe(OO.EVENTS.PLAY, 'heartbeat', _onPlay);
      mb.subscribe(OO.EVENTS.VC_PLAYED, 'hearbeat', _onPlayed);
      mb.subscribe(OO.EVENTS.DESTROY, 'heartbeat', destroy);
      log('initialization completed', config);
    }

    initialize();
  };

  return heartbeat;
});
