/**
 * @public
 * @class AdManagerUtils
 * @classdesc Provides utility/helper functions for ad managers.
 */
var AdManagerUtils = function()
{

  /**
   * Helper function to convert the HMS timestamp into milliseconds.
   * @private
   * @method AdManagerUtils#_convertTimeStampToMilliseconds
   * @param {string} timeString The timestamp string (format: hh:mm:ss / hh:mm:ss.mmm)
   * @returns {number||null} The number of milliseconds the timestamp represents. Returns null
   * if an error occurs.
   */
  this.convertTimeStampToMilliseconds = function(timeString)
  {
    var milliseconds = null;
    if (timeString && _.isString(timeString))
    {
      var hms = timeString.split(":");
      // + unary operator converts string to number
      var hoursInSeconds = +hms[0] * 60 * 60;
      var minutesInSeconds = +hms[1] * 60;
      var seconds = +hms[2];
      milliseconds = (hoursInSeconds + minutesInSeconds + seconds) * 1000;
    }
    else
    {
      _logError("convertTimeStampToMilliseconds: malformed timeString received. Value was: "
                    + timeString);
    }
    return milliseconds;
  };

  /**
   * Helper function to convert a percentage representing time into milliseconds.
   * @private
   * @method AdManagerUtils#_convertPercentToMilliseconds
   * @param {string} timeString The string that represents a percentage (format: [0, 100]%)
   * @param {number} movieDuration The duration of the video - represented in seconds
   * @returns {number} The number of milliseconds the percentage represents.
   */
  this.convertPercentToMilliseconds = function(timeString, movieDuration)
  {
    var milliseconds = null;
    if (_isValidTimeString(timeString) && _isValidMovieDuration(movieDuration))
    {
      var percent = timeString.replace("%", "");
      // simplification of: (movieDuration * percent / 100) * 1000
      milliseconds = +(movieDuration) * percent * 10;
    }
    return milliseconds;
  };

  /**
   * Helper function to determine if a time stamp string is valid.
   * @private
   * @method AdManagerUtils#_isValidTimeString
   * @param {string} timeString The string that represents a percentage (format: [0, 100]%)
   * @returns {boolean} true if the time stamp string is valid. Returns false if otherwise.
   */
  var _isValidTimeString = _.bind(function(timeString)
  {
    var result = true;
    if (!timeString || !_.isString(timeString))
    {
      _logError("convertPercentToMilliseconds: malformed timeString received. Value was: "
               + timeString);
      result = false;
    }
    return result;
  }, this);

  /**
   * Helper function to determine if the movie duration is valid.
   * @private
   * @method AdManagerUtils#_isValidMovieDuration
   * @param {number} movieDuration The duration of the video - represented in seconds
   * @returns {boolean} true if the movie duration string is valid. Returns false if otherwise.
   */
  var _isValidMovieDuration = _.bind(function(movieDuration)
  {
    var result = true;
    if (!movieDuration || !_.isNumber(movieDuration))
    {
      _logError("convertPercentToMilliseconds: malformed movieDuration received. Value was: "
               + movieDuration);
      result = false;
    }
    return result;
  }, this);

  /**
   * Helper function to log AdManagerUtils errors.
   * @private
   * @method AdManagerUtils#_logError
   * @param {string} errorMessage The error message
   */
  var _logError = _.bind(function(errorMessage)
  {
    OO.log("AdManagerUtils: " + errorMessage);
  }, this);
};

// export as Singleton
module.exports = new AdManagerUtils();
