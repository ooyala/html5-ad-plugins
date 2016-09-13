/**
 * @public
 * @class AdManagerUtils
 * @classdesc Provides utility/helper functions for ad managers.
 */
var AdManagerUtils = function()
{

  /**
   * Converts the hh:mm:ss timestamp into milliseconds.
   * @public
   * @method AdManagerUtils#convertTimeStampToMilliseconds
   * @param {string} timeString The timestamp string (format: hh:mm:ss / hh:mm:ss.mmm)
   * @returns {number|null} The number of milliseconds the timestamp represents. Returns null
   * if an error occurs.
   */
  this.convertTimeStampToMilliseconds = function(timeString)
  {
    var milliseconds = null;

    if (!_.isString(timeString) || !_isValidHms(timeString))
    {
      _logError("convertTimeStampToMilliseconds: invalid timeString received. Value was: "
                + timeString);
    }
    else
    {
      var hms = timeString.split(":");
      // + unary operator converts string to number
      var hoursInSeconds = +hms[0] * 60 * 60;
      var minutesInSeconds = +hms[1] * 60;
      var seconds = +hms[2];
      milliseconds = (hoursInSeconds + minutesInSeconds + seconds) * 1000;
    }
    return milliseconds;
  };

  /**
   * Takes the percentage of a number, the total video duration represented in seconds, and returns
   * that percentage in milliseconds.
   * @public
   * @method AdManagerUtils#convertPercentToMilliseconds
   * @param {string} timeString The string that represents a percentage (format: [0, 100]%)
   * @param {number} totalDuration The duration of the video - represented in seconds
   * @returns {number} The number of milliseconds the percentage represents.
   */
  this.convertPercentToMilliseconds = function(timeString, totalDuration)
  {
    var milliseconds = null;
    var percent = null;
    var validString = _.isString(timeString);
    var validNumber = _.isNumber(totalDuration);

    if (validString)
    {
      percent = timeString.replace("%", "");
      percent = parseFloat(percent);
      if (!_.isFinite(percent) || (percent < 0))
      {
        validString = false;
        _logError("convertPercentToMilliseconds: invalid percentage was received. Value was: "
                  + timeString);
      }
    }
    else
    {
      _logError("convertPercentToMilliseconds: invalid timeString received. Value was: "
                + timeString);
    }

    if (!validNumber)
    {
      _logError("convertPercentToMilliseconds: invalid totalDuration was received. Value was: "
                + totalDuration);
    }

    if (validString && validNumber)
    {
      // simplification of: (totalDuration * percent / 100) * 1000
      milliseconds = +(totalDuration) * percent * 10;
    }
    return milliseconds;
  };

  /**
   * Helper function to validate that a string is (pseudo) valid hh:mm:ss format.
   * @private
   * @method AdManagerUtils#_isValidHms
   * @param {string} hms The hh:mm:ss string
   * @returns {boolean} true if the hh:mm:ss string is valid. Returns false if otherwise.
   */
  var _isValidHms = _.bind(function(hms)
  {
    var result = false;
    if (hms)
    {
      var hmsArray = hms.split(":");
      if (hmsArray.length === 3)
      {
        var validHms = true;
        for (var i = 0; i < hmsArray.length; i++)
        {
          var convertNum = parseInt(hmsArray[i]);
          if (!_.isFinite(convertNum) || (convertNum < 0))
          {
            validHms = false;
            break;
          }
        }
        result = validHms;
      }
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
