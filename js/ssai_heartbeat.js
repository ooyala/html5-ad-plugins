OO.plugin('heartbeat', function(OO, _, $) {
  var log = function() {
    OO.log.apply(this, $.merge(['heartbeat:'], arguments));
  };

  var heartbeat = function(mb) {
    var _this = this;
    var config = {};

    var DEFAULT_CONFIG = Object.freeze({
      Interval: 10 * 1000,
      ReportingPathPattern: '<hostname>/v1/vod_playback_pos/<embed_code>?ssai_guid=<ssai_guid>'
    });

    //constants
    _this.CONSTANTS = Object.freeze({
      HA_ASSET_FLAG: 'ha_enabled',
      HA_IGNORE_MAX_FLAG: 'ha_ignore_max_timeout',
      DEFAULT_SEGMENT_LENGTH: 4,
      PROXY_REFRESH_TIME: 6,
    });

    var streamUrl = '';
    var ssaiGuid = '';
    var embedCode = '';

    var movieDuration = 0;
    var playheadPosition = 0;
    var hostname = '//ssai.ooyala.com';
    var reportingPaused = false;

    var heartbeatTimer = 0;

    initialize();

    function initialize() {
      config = buildConfig(config);

      //events subscribe
      mb.subscribe(OO.EVENTS.VC_WILL_PLAY, 'heartbeat', _onVcWillPlay);
      mb.subscribe(OO.EVENTS.EMBED_CODE_CHANGED, 'heartbeat', _onEmbedCodeChanged);
      mb.subscribe(OO.EVENTS.PLAYHEAD_TIME_CHANGED, 'heartbeat', _onPlayheadTimeChange);
      mb.subscribe(OO.EVENTS.PAUSE, 'heartbeat', _onPause);
      mb.subscribe(OO.EVENTS.PLAY, 'heartbeat', _onPlay);
      mb.subscribe(OO.EVENTS.VC_PLAYED, 'hearbeat', _onPlayed);
      mb.subscribe(OO.EVENTS.DESTROY, 'heartbeat', destroy)
      
      log('initialization completed', config);
    }

    function stopHeartBeat() {
      clearInterval(heartbeatTimer);
    }

    function startHeartBeat() {
      stopHeartBeat();
      heartbeatTimer = setInterval(reportHeartBeat, config.Interval);
    }

    function reportHeartBeat() {
      if(reportingPaused){
        return;
      }

      var reportingURL = config.ReportingPathPattern.replace(/<hostname>/g, hostname).replace(/<embed_code>/g, embedCode).replace(/<ssai_guid>/g, ssaiGuid);
      
      var data = {
        playheadpos: parseInt(playheadPosition),
        pingfrequency: parseInt(config.Interval / 1000)
      };

      $.ajax({
        url: reportingURL,
        type: 'POST',
        data: JSON.stringify(data),
        contentType: 'text/plain',
        dataType: 'text',
        success:function(){
          log('Heartbeat was sent successfully');
        }
      });

    }

    function parseGUID(url) {
      var reg = new RegExp(/ssai_guid=([^&?]*)/g);
      var result = reg.exec(url);

      if (result.length && result[1]) {
        return result[1];
      }
      return '';
    }

    function _onVcWillPlay(event, videoId, url) {
      streamUrl = url || '';
      ssaiGuid = parseGUID(streamUrl);
      if (ssaiGuid) {
        reportHeartBeat();
        startHeartBeat();
      }
    }

    function _onPlayheadTimeChange(event, currentTime, duration) {
      movieDuration = duration || 0;
      playheadPosition = currentTime || 0;
    }

    function _onEmbedCodeChanged(event, theEmbedCode){
      embedCode = theEmbedCode || '';
    }

    function _onPause(){
      reportingPaused = true;
    }

    function _onPlay(){
      reportingPaused = false;
    }

    function _onPlayed(){
      reportingPaused = false;
      reportHeartBeat();
      stopHeartBeat();
    }

    function buildConfig(configuration) {
      var _config = $.extend($.extend({}, DEFAULT_CONFIG), configuration);

      if (!_config.segmentLength) {
        _config.maxSegmentsToCheck = _config.maxSegmentsToCheck || DEFAULT_CONFIG.maxSegmentsToCheck;
      } else {
        _config.maxSegmentsToCheck = -1;
      }
      return _config;
    }

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
  };
  
  return heartbeat;
});