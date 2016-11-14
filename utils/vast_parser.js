var VastParser = function() {

  this.errorInfo = {};
  this.wrapperParentId = null;

  var VERSION_MAJOR_2 = '2';
  var VERSION_MAJOR_3 = '3';
  var SUPPORTED_VERSIONS = [VERSION_MAJOR_2, VERSION_MAJOR_3];
  var FEATURES = {
    SKIP_AD : "skipAd",
    PODDED_ADS : "poddedAds",
    AD_FALLBACK : "adFallback"
  };
  var SUPPORTED_FEATURES = {};
  SUPPORTED_FEATURES[VERSION_MAJOR_2] = [];
  SUPPORTED_FEATURES[VERSION_MAJOR_3] = [FEATURES.SKIP_AD, FEATURES.PODDED_ADS, FEATURES.AD_FALLBACK];

  var AD_TYPE = {
    INLINE : "InLine",
    WRAPPER : "Wrapper"
  };

  /**
   * Used to keep track of what events that are tracked for vast.
   */
  var TrackingEvents = ['creativeView', 'start', 'midpoint', 'firstQuartile', 'thirdQuartile', 'complete',
  'mute', 'unmute', 'pause', 'rewind', 'resume', 'fullscreen', 'exitFullscreen', 'expand', 'collapse', 'acceptInvitation',
  'close', 'skip' ];

  /**
   * The xml needs to get parsed and and an array of ad objects is returned.
   * @public
   * @method VastParser#parser
   * @param {XMLDocument} vastXML The xml that contains the ad data
   * @param {object} adLoaded The ad loaded object and metadata
   * @returns {object[]} An array containing the ad(s) if ads are found, otherwise it returns null.
   */
  this.parser = function(vastXML, adLoaded) {
    var jqueryAds =  $(vastXML).find("Ad");
    if (!this.checkNoAds(vastXML, jqueryAds)){
      // need to get error tracking information early in case error events need to be reported
      // before the ad object is created
      this.getErrorTrackingInfo(vastXML, jqueryAds);
    }

    if (!this.isValidVastXML(vastXML)) {
      return null;
    }
    var result = {
      podded : [],
      standalone : []
    };
    //parse the ad objects from the XML
    var ads = this.parseAds(vastXML, adLoaded);
    //check to see if any ads are sequenced (are podded)
    _.each(ads, _.bind(function(ad) {
      var sequence = typeof ad.sequence !== 'undefined' && _.isNumber(parseInt(ad.sequence)) ? ad.sequence : null;
      var version = typeof ad.version !== 'undefined' ? ad.version : null;
      if (supportsPoddedAds(version) && sequence) {
        //Assume sequences will start from 1
        result.podded[+sequence - 1] = ad;
      } else {
        //store ad as a standalone ad
        result.standalone.push(ad);
      }
    }, this));

    return result;
  };

  /**
   * Parses ad objects from the Vast XML.
   * @public
   * @method VastParser#parseAds
   * @param {xml} vastXML The xml that contains the ad data
   * @return {object[]} An array of ad objects
   * @param {object} adLoaded The ad loaded object and metadata
   */
  this.parseAds = function(vastXML, adLoaded) {
    var result = [];
    var version = getVastVersion(vastXML);
    $(vastXML).find("Ad").each(function() {
      //no vpaid for ssai yet
      //var singleAd = _getVpaidCreative(this, version, adLoaded);
      var singleAd = null;
      //if there is no vpaid creative, parse as regular vast
      if (!singleAd) {
        singleAd = vastAdSingleParser(this, version);
      }
      if (singleAd) {
        result.push(singleAd);
      }
    });
    return result;
  };

  /**
   * Takes the xml and ad type and find the ad within the xml and returns it.
   * @private
   * @method VastParser#vastAdSingleParser
   * @param {XMLDocument} xml The xml that contains the ad data
   * @param {number} version The Vast version
   * @returns {object} The ad object otherwise it returns 1.
   */
  var vastAdSingleParser = _.bind(function(xml, version) {
    var result = getVastTemplate();
    var jqueryXML = $(xml);
    var inline = jqueryXML.find(AD_TYPE.INLINE);
    var wrapper = jqueryXML.find(AD_TYPE.WRAPPER);

    if (inline.size() > 0) {
      result.type = AD_TYPE.INLINE;
    } else if (wrapper.size() > 0) {
      result.type = AD_TYPE.WRAPPER;
    } else {
      //TODO: See if returning null here is valid
      return null;
    }

    result.version = version;

    var linear = jqueryXML.find("Linear").eq(0);
    var nonLinearAds = jqueryXML.find("NonLinearAds");

    if (result.type === AD_TYPE.WRAPPER) { result.VASTAdTagURI = jqueryXML.find("VASTAdTagURI").text(); }
    result.error = filterEmpty(jqueryXML.find("Error").map(function() { return $(this).text(); }));
    result.impression = filterEmpty(jqueryXML.find("Impression").map(function() { return $(this).text(); }));
    result.title = _.first(filterEmpty(jqueryXML.find("AdTitle").map(function() { return $(this).text(); })));

    if (linear.size() > 0) { result.linear = parseLinearAd(linear); }
    if (nonLinearAds.size() > 0) { result.nonLinear = parseNonLinearAds(nonLinearAds); }
    jqueryXML.find("Companion").map(function(i, v){
      result.companion.push(parseCompanionAd($(v)));
      return 1;
    });

    var sequence = jqueryXML.attr("sequence");
    if (typeof sequence !== 'undefined') {
      result.sequence = sequence;
    }

    var id = jqueryXML.attr("id");
    if (typeof id !== 'undefined') {
      result.id = id;
    }

    return result;
  }, this);

  /**
   * The xml needs to be parsed to grab all the linear data of the ad and create an object.
   * @private
   * @method VastParser#parseLinearAd
   * @param {XMLDocument} linearXml The xml containing the ad data to be parsed
   * @returns {object} An object containing the ad data.
   */
  var parseLinearAd = _.bind(function(linearXml) {
    var result = {
      tracking: {},
      // clickTracking needs to be remembered because it can exist in wrapper ads
      clickTracking: filterEmpty($(linearXml).find("ClickTracking").map(function() { return $(this).text(); })),
      //There can only be one clickthrough as per Vast 2.0/3.0 specs and XSDs
      clickThrough: $(linearXml).find("ClickThrough").text(),
      customClick: filterEmpty($(linearXml).find("CustomClick").map(function() { return $(this).text(); }))
    };

    result.skipOffset = $(linearXml).attr("skipoffset");

    var mediaFile = linearXml.find("MediaFile");

    parseTrackingEvents(result.tracking, linearXml);
    if (mediaFile.size() > 0) {
      result.mediaFiles = filterEmpty(mediaFile.map(function(i,v) {
        return {
          type: $(v).attr("type").toLowerCase(),
          url: $.trim($(v).text()),
          bitrate: $(v).attr("bitrate"),
          width: $(v).attr("width"),
          height: $(v).attr("height")
        };
      }));
      result.duration = linearXml.find("Duration").text();
    }

    return result;
  }, this);

  /**
   * The xml needs to be parsed in order to grab all the non-linear ad data.
   * @private
   * @method VastParser#parseNonLinearAd
   * @param {XMLDocument} nonLinearAdsXml Contains the ad data that needs to be parsed
   * @returns {object} An object that contains the ad data.
   */
  var parseNonLinearAds = _.bind(function(nonLinearAdsXml) {
    var result = { tracking: {} };
    var nonLinear = nonLinearAdsXml.find("NonLinear").eq(0);

    parseTrackingEvents(result.tracking, nonLinearAdsXml);

    if (nonLinear.size() > 0) {
      var staticResource = nonLinear.find("StaticResource");
      var iframeResource = nonLinear.find("IFrameResource");
      var htmlResource = nonLinear.find("HTMLResource");
      result.width = nonLinear.attr("width");
      result.height = nonLinear.attr("height");
      result.expandedWidth = nonLinear.attr("expandedWidth");
      result.expandedHeight = nonLinear.attr("expandedHeight");
      result.scalable = nonLinear.attr("scalable");
      result.maintainAspectRatio = nonLinear.attr("maintainAspectRatio");
      result.minSuggestedDuration = nonLinear.attr("minSuggestedDuration");
      result.nonLinearClickThrough = nonLinear.find("NonLinearClickThrough").text();
      result.nonLinearClickTracking = filterEmpty($(nonLinearAdsXml).
                                      find("NonLinearClickTracking").
                                      map(function() { return $(this).text(); }));

      if (staticResource.size() > 0) {
        _.extend(result, { type: "static", data: staticResource.text(), url: staticResource.text() });
      } else if (iframeResource.size() > 0) {
        _.extend(result, { type: "iframe", data: iframeResource.text(), url: iframeResource.text() });
      } else if (htmlResource.size() > 0) {
        _.extend(result, { type: "html", data: htmlResource.text(), htmlCode: htmlResource.text() });
      }
    }

    return result;
  }, this);
  /**
   * This should be the first thing that happens in the parser function: check if the vast XML has no ads.
   * If it does not have ads, track error urls
   * @public
   * @method VastParser#checkNoAds
   * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
   * @param {object} ads A jQuery object which contains the collection of ad elements found
   * @returns {boolean} true if there are no ads, false otherwise.
   */
  this.checkNoAds = function(vastXML, ads) {
    // if there are no ads in ad response then track error
    if (ads.length === 0) {
      OO.log("VAST: No ads in XML");
      // there could be an <Error> element in the vast response
      var noAdsErrorURL = $(vastXML).find("Error").text();
      if (noAdsErrorURL) {
        this.pingErrorURL(this.ERROR_CODES.WRAPPER_NO_ADS, noAdsErrorURL);
      }
      // if the ad response came from a wrapper, then go up the chain and ping those error urls
      //this.trackError(this.ERROR_CODES.WRAPPER_NO_ADS, this.wrapperParentId);
      return true;
    }
    return false;
  };

  /**
   * Helper function to ping error URL. Replaces error macro if it exists.
   * @public
   * @method VastParser#pingErrorURL
   * @param {number} code Error code
   * @param {string} url URL to ping
   */
  this.pingErrorURL = function(code, url) {
    url = url.replace(/\[ERRORCODE\]/, code);
    OO.pixelPing(url);
  };

  /**
   * Helper function to ping error URLs.
   * @public
   * @method VastParser#pingErrorURLs
   * @param {number} code Error code
   * @param {string[]} urls URLs to ping
   */
  this.pingErrorURLs = function(code, urls) {
    _.each(urls, function() {
      this.pingErrorURL(code, url);
    }, this);
  };

  /**
   * Helper function to grab error information. vastAdSingleParser already grabs error data while
   * creating ad object, but some errors may occur before the object is created.
   * Note: <Error> can only live in three places: directly under <VAST>, <Ad>, or <Wrapper> elements.
   * <Error> tags are also optional so they may not always exist.
   * @public
   * @method VastParser#getErrorTrackingInfo
   * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
   * @param {object} ads A jQuery object which contains the collection of ad elements found
   */
  this.getErrorTrackingInfo = function(vastXML, ads) {
    _.each(ads, function(ad) {
      var error = {
        errorURLs: [],
        wrapperParentId: this.wrapperParentId || null
      };

      var errorElement = $(ad).find("Error");
      if (errorElement.length > 0){
        error.errorURLs = [errorElement.text()];
      }
      var adId = $(ad).prop("id");
      this.errorInfo[adId] = error;
    }, this);
  };

  /**
   * Helper function to verify that XML is valid
   * @public
   * @method VastParser#isValidVastXML
   * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
   * @returns {boolean} Returns true if the xml is valid otherwise it returns false.
   */
  this.isValidVastXML = function(vastXML) {
    return this.isValidRootTagName(vastXML) && this.isValidVastVersion(vastXML);
  };

  /**
   * Helper function to verify XML has valid VAST root tag.
   * @public
   * @method VastParser#isValidRootTagName
   * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
   * @returns {boolean} Returns true if the root tag is valid otherwise it returns false.
   */
  this.isValidRootTagName = function(vastXML) {
    if (!getVastRoot(vastXML)) {
      OO.log("VAST: Invalid VAST XML");
      //this.trackError(this.ERROR_CODES.SCHEMA_VALIDATION, this.wrapperParentId);
      return false;
    }
    return true;
  };

  /**
   * Helper function to verify XML is a valid VAST version.
   * @public
   * @method VastParser#isValidVastVersion
   * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
   * @returns {boolean} Returns true if the VAST version is valid otherwise it returns false.
   */
  this.isValidVastVersion = function(vastXML) {
    var version = getVastVersion(vastXML);
    if (!supportsVersion(version)) {
      OO.log("VAST: Invalid VAST Version: " + version);
      //this.trackError(this.ERROR_CODES.VERSION_UNSUPPORTED, this.wrapperParentId);
      return false;
    }
    return true;
  };

  /**
   * Returns the Vast version of the provided XML.
   * @private
   * @method VastParser#getVastVersion
   * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
   * @returns {string} The Vast version.
   */
  var getVastVersion = _.bind(function(vastXML) {
    var vastTag = getVastRoot(vastXML);
    return $(vastTag).attr('version');
  }, this);

  /**
   * Helper function to get the VAST root element.
   * @private
   * @method VastParser#getVastRoot
   * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
   * @returns {object} null if a VAST tag is absent, or if there are multiple VAST tags. Otherwise,
   * returns the VAST root element.
   */
  var getVastRoot = _.bind(function(vastXML) {
    var vastRootElement = $(vastXML).find("VAST");
    if (vastRootElement.length === 0) {
      OO.log("VAST: No VAST tags in XML");
      return null;
    }
    else if (vastRootElement.length > 1) {
      OO.log("VAST: Multiple VAST tags in XML");
      return null;
    }
    return vastRootElement[0];
  }, this);

  /**
   * Returns the Vast major version. For example, the '3' in 3.0.
   * @private
   * @method VastParser#getMajorVersion
   * @param {string} version The Vast version as parsed from the XML
   * @returns {string} The major version.
   */
  var getMajorVersion = _.bind(function(version) {
    if(typeof version === 'string') {
      return version.split('.')[0];
    }
  }, this);

  /**
   * Checks to see if this ad manager supports a given Vast version.
   * @private
   * @method VastParser#supportsVersion
   * @param {string} version The Vast version as parsed from the XML
   * @returns {boolean} true if the version is supported by this ad manager, false otherwise.
   */
  var supportsVersion = _.bind(function(version) {
    return _.contains(SUPPORTED_VERSIONS, getMajorVersion(version));
  }, this);

  /**
   * Checks to see if the given Vast version supports the podded ads functionality, as per Vast specs
   * for different versions.
   * @private
   * @method VastParser#supportsPoddedAds
   * @returns {boolean} true if the podded ads functionality is supported in the specified Vast version,
   *                    false otherwise
   */
  var supportsPoddedAds = _.bind(function(version) {
    return _.contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.PODDED_ADS);
  }, this);

  /**
   * Checks to see if the given Vast version supports the ad fallback functionality, as per Vast specs
   * for different versions.
   * @private
   * @method VastParser#supportsAdFallback
   * @returns {boolean} true if the ad fallback functionality is supported in the specified Vast version,
   *                    false otherwise
   */
  var supportsAdFallback = _.bind(function(version) {
    return _.contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.AD_FALLBACK);
  }, this);

  /**
   * Default template to use when creating the vast ad object.
   * @private
   * @method VastParser#getVastTemplate
   * @returns {object} The ad object that is formated to what we expect vast to look like.
   */
  var getVastTemplate = _.bind(function() {
    return {
      error: [],
      impression: [],
      // Note: This means we only support at most 1 linear and 1 non-linear ad
      linear: {},
      nonLinear: {},
      companion: []
    };
  }, this);

  /**
   * Helper function to remove empty items.
   * @private
   * @method VastParser#filterEmpty
   * @param {Array} array An array that is the be checked if it is empty
   * @returns {Array} The filtered array.
   */
  var filterEmpty = _.bind(function(array) {
    return _.without(array, null, "");
  }, this);

  /**
   * While getting the ad data the manager needs to parse the companion ad data as well and add it to the object.
   * @private
   * @method VastParser#parseCompanionAd
   * @param {XMLDocument} companionAdXML XML that contains the companion ad data
   * @returns {object} The ad object with companion ad.
   */
  var parseCompanionAd = _.bind(function(companionAdXml) {
    var result = { tracking: {} };
    var staticResource = _cleanString(companionAdXml.find('StaticResource').text());
    var iframeResource = _cleanString(companionAdXml.find('IFrameResource').text());
    var htmlResource = _cleanString(companionAdXml.find('HTMLResource').text());

    parseTrackingEvents(result.tracking, companionAdXml, ["creativeView"]);

    result = {
      tracking: result.tracking,
      width: companionAdXml.attr('width'),
      height: companionAdXml.attr('height'),
      expandedWidth: companionAdXml.attr('expandedWidth'),
      expandedHeight: companionAdXml.attr('expandedHeight'),
      companionClickThrough: companionAdXml.find('CompanionClickThrough').text()
    };

    if (staticResource.length) {
      _.extend(result, { type: 'static', data: staticResource, url: staticResource });
    } else if (iframeResource.length) {
      _.extend(result, { type: 'iframe', data: iframeResource, url: iframeResource });
    } else if (htmlResource.length) {
      _.extend(result, { type: 'html', data: htmlResource, htmlCode: htmlResource });
    }

    return result;
  }, this);

  /**
   * Checks if there is any companion ads associated with the ad and if one is found, it will call the Ad Manager
   * Controller to show it.
   * @public
   * @method VastParser#checkCompanionAds
   * @param {object} adInfo The Ad metadata
   */
  this.checkCompanionAds = function(adInfo) {
    var data = adInfo.data,
        adUnitCompanions = currentAd.vpaidAd ? _safeFunctionCall(currentAd.vpaidAd, "getAdCompanions") : null,
        companions;

    // If vast template has no companions (has precedence), check the adCompanions property from the ad Unit
    // This rules is only for VPaid, it will take data.companion otherwise anyway
    companions = data && !_.isEmpty(data.companion) ? data.companion : adUnitCompanions;

    if (_.isEmpty(companions)) {
      return;
    }

    this.amc.showCompanion(companions);
  };

  /**
   * The xml is parsed to find any tracking events and then returned as part of an object.
   * @private
   * @method VastParser#parseTrackingEvents
   * @param {object} tracking The tracking object to be mutated
   * @param {XMLDocument} xml The data of the ad with tracking info
   * @param {string[]} trackingEvents List of events that are tracked, if null then it uses the global one
   * @returns {object} An array of tracking items.
   */
  var parseTrackingEvents = _.bind(function(tracking, xml, trackingEvents) {
    var events = trackingEvents || TrackingEvents;
    _.each(events, function(item) {
      var sel = "Tracking[event=" + item + "]";
      tracking[item] = filterEmpty(xml.find(sel).map(function(i, v) { return $(v).text(); }));
    }, {});
  }, this);

  /**
   * Remove any new lines, line breaks and spaces from string.
   * @private
   * @method VastParser#_cleanString
   * @return {string} String with no spaces
   */
  var _cleanString = function(string) {
    return string.replace(/\r?\n|\r/g, '').trim();
  };
};

module.exports = new VastParser();
