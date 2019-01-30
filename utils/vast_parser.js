const {
  each,
  isNumber,
  compose,
  map,
  first,
  extend,
  contains,
  bind,
  without,
} = require('underscore')

var VastParser = function() {

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
  var TRACKING_EVENTS = ['creativeView', 'start', 'midpoint', 'firstQuartile', 'thirdQuartile', 'complete',
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
    if (!vastXML || !this.isValidVastXML(vastXML)) {
      return null;
    }

    var ads = vastXML.querySelectorAll("Ad");

    var result = {
      podded : [],
      standalone : []
    };
    //parse the ad objects from the XML
    var ads = this.parseAds(vastXML, adLoaded);
    //check to see if any ads are sequenced (are podded)
    each(ads, function(ad) {
      var sequence = typeof ad.sequence !== 'undefined' && isNumber(parseInt(ad.sequence)) ? ad.sequence : null;
      var version = typeof ad.version !== 'undefined' ? ad.version : null;
      if (supportsPoddedAds(version) && sequence) {
        //Assume sequences will start from 1
        result.podded[+sequence - 1] = ad;
      } else {
        //store ad as a standalone ad
        result.standalone.push(ad);
      }
    });

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
    var version = getVastVersion(vastXML);
    return compose(
      (ads) => map(ads, (ad) => vastAdSingleParser(ad, version)),
      Array.from,
    )(vastXML.querySelectorAll("Ad"));
  };

  /**
   * Takes the xml and ad type and find the ad within the xml and returns it.
   * @private
   * @method VastParser#vastAdSingleParser
   * @param {XMLDocument} xml The xml that contains the ad data
   * @param {number} version The Vast version
   * @returns {object} The ad object otherwise it returns 1.
   */
  var vastAdSingleParser = function(xml, version) {
    var result = getVastTemplate();
    var inline = xml.querySelectorAll(AD_TYPE.INLINE);
    var wrapper = xml.querySelectorAll(AD_TYPE.WRAPPER);

    if (inline.length > 0) {
      result.type = AD_TYPE.INLINE;
    } else if (wrapper.length > 0) {
      result.type = AD_TYPE.WRAPPER;
    } else {
      //TODO: See if returning null here is valid
      return null;
    }

    result.version = version;

    var linear = xml.querySelector("Linear");
    var nonLinearAds = xml.querySelector("NonLinearAds");

    if (result.type === AD_TYPE.WRAPPER) {
      result.vastAdTagUri = getNodeTextContent(xml, "VASTAdTagURI");
    }

    result.error = compose(
      mapWithoutEmpty(node => node.textContent),
      Array.from,
    )(xml.querySelectorAll("Error"));

    result.impression = compose(
      mapWithoutEmpty(node => node.textContent),
      Array.from,
    )(xml.querySelectorAll("Impression"));

    result.title = compose(
      first,
      mapWithoutEmpty(node => node.textContent),
      Array.from,
    )(xml.querySelectorAll("AdTitle"));

    if (linear) { result.linear = parseLinearAd(linear); }
    if (nonLinearAds) { result.nonLinear = parseNonLinearAds(nonLinearAds); }

    result.companion = compose(
      (array) => map(array, node => parseCompanionAd(node)),
      Array.from,
    )(xml.querySelectorAll('Companion'))

    var sequence = safeGetAttribute(xml, 'sequence');
    if (typeof sequence !== 'undefined') {
      result.sequence = sequence;
    }

    result.id = safeGetAttribute(xml, 'id');

    return result;
  };

  /**
   * The xml needs to be parsed to grab all the linear data of the ad and create an object.
   * @private
   * @method VastParser#parseLinearAd
   * @param {XMLDocument} linearXml The xml containing the ad data to be parsed
   * @returns {object} An object containing the ad data.
   */
  var parseLinearAd = function(linearXml) {
    var result = {
      tracking: parseTrackingEvents(linearXml),
      // clickTracking needs to be remembered because it can exist in wrapper ads
      clickTracking: compose(
        mapWithoutEmpty(node => node.textContent),
        Array.from,
      )(linearXml.querySelectorAll('ClickTracking')),
      //There can only be one clickthrough as per Vast 2.0/3.0 specs and XSDs
      clickThrough: getNodeTextContent(linearXml, 'ClickThrough'),
      customClick: compose(
        mapWithoutEmpty(node => node.textContent),
        Array.from,
      )(linearXml.querySelectorAll('CustomClick')),
      skipOffset: safeGetAttribute(linearXml, 'skipoffset'),
    };

    var mediaFiles = linearXml.querySelectorAll("MediaFile");

    if (mediaFiles.length > 0) {
      result.mediaFiles = compose(
        mapWithoutEmpty((mediaFile) => ({
          type: mediaFile.getAttribute("type").toLowerCase(),
          url: mediaFile.textContent.trim(),
          bitrate: mediaFile.getAttribute("bitrate"),
          width: mediaFile.getAttribute("width"),
          height: mediaFile.getAttribute("height")
        }),
        Array.from,
      ))(mediaFiles);
      result.duration = getNodeTextContent(linearXml, "Duration");
    }

    return result;
  };

  /**
   * The xml needs to be parsed in order to grab all the non-linear ad data.
   * @private
   * @method VastParser#parseNonLinearAd
   * @param {XMLDocument} nonLinearAdsXml Contains the ad data that needs to be parsed
   * @returns {object} An object that contains the ad data.
   */
  var parseNonLinearAds = function(nonLinearAdsXml) {
    var result = {
      tracking: parseTrackingEvents(nonLinearAdsXml)
    };

    var nonLinear = nonLinearAdsXml.querySelector("NonLinear");

    if (!nonLinear) {
      return result;
    }
    var staticResource = nonLinear.querySelector("StaticResource");
    var iframeResource = nonLinear.querySelector("IFrameResource");
    var htmlResource = nonLinear.querySelector("HTMLResource");

    result.width = safeGetAttribute(nonLinear, "width");
    result.height = safeGetAttribute(nonLinear, "height");
    result.expandedWidth = safeGetAttribute(nonLinear, "expandedWidth");
    result.expandedHeight = safeGetAttribute(nonLinear, "expandedHeight");
    result.scalable = safeGetAttribute(nonLinear, "scalable");
    result.maintainAspectRatio = safeGetAttribute(nonLinear, "maintainAspectRatio");
    result.minSuggestedDuration = safeGetAttribute(nonLinear, "minSuggestedDuration");
    result.nonLinearClickThrough = getNodeTextContent(nonLinear, "NonLinearClickThrough");

    result.nonLinearClickTracking = compose(
      mapWithoutEmpty(node => node.textContent),
      Array.from,
    )(nonLinearAdsXml.querySelectorAll('NonLinearClickTracking'))

    if (staticResource) {
      extend(result, {
        type: "static",
        data: staticResource.textContent,
        url: staticResource.textContent
      });
    }
    if (iframeResource) {
      extend(result, {
        type: "iframe",
        data: iframeResource.textContent,
        url: iframeResource.textContent
      });
    }
    if (htmlResource) {
      extend(result, {
        type: "html",
        data: htmlResource.textContent,
        htmlCode: htmlResource.textContent
      });
    }

    return result;
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
      //this.trackError(PARSE_ERRORS.SCHEMA_VALIDATION, this.wrapperParentId);
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
      //this.trackError(PARSE_ERRORS.VERSION_UNSUPPORTED, this.wrapperParentId);
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
  var getVastVersion = function(vastXML) {
    var vastTag = getVastRoot(vastXML);
    if (!vastTag) {
      return null;
    }
    return safeGetAttribute(vastTag, 'version');
  };

  /**
   * Helper function to get the VAST root element.
   * @private
   * @method VastParser#getVastRoot
   * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
   * @returns {object} null if a VAST tag is absent, or if there are multiple VAST tags. Otherwise,
   * returns the VAST root element.
   */
  var getVastRoot = function(vastXML) {
    try {

      var vastRootElement = vastXML.querySelectorAll("VAST");
      if (vastRootElement.length === 0) {
        OO.log("VAST: No VAST tags in XML");
        return null;
      }
      if (vastRootElement.length > 1) {
        OO.log("VAST: Multiple VAST tags in XML");
        return null;
      }
      return vastRootElement[0];
    } catch (error) {
      return null;
    }
  };

  /**
   * Returns the Vast major version. For example, the '3' in 3.0.
   * @private
   * @method VastParser#getMajorVersion
   * @param {string} version The Vast version as parsed from the XML
   * @returns {string} The major version.
   */
  var getMajorVersion = function(version) {
    if(typeof version === 'string') {
      return version.split('.')[0];
    }
  };

  /**
   * Checks to see if this ad manager supports a given Vast version.
   * @private
   * @method VastParser#supportsVersion
   * @param {string} version The Vast version as parsed from the XML
   * @returns {boolean} true if the version is supported by this ad manager, false otherwise.
   */
  var supportsVersion = function(version) {
    return contains(SUPPORTED_VERSIONS, getMajorVersion(version));
  };

  /**
   * Checks to see if the given Vast version supports the podded ads functionality, as per Vast specs
   * for different versions.
   * @private
   * @method VastParser#supportsPoddedAds
   * @returns {boolean} true if the podded ads functionality is supported in the specified Vast version,
   *                    false otherwise
   */
  var supportsPoddedAds = bind(function(version) {
    return contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.PODDED_ADS);
  }, this);

  /**
   * Checks to see if the given Vast version supports the ad fallback functionality, as per Vast specs
   * for different versions.
   * @private
   * @method VastParser#supportsAdFallback
   * @returns {boolean} true if the ad fallback functionality is supported in the specified Vast version,
   *                    false otherwise
   */
  var supportsAdFallback = bind(function(version) {
    return contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.AD_FALLBACK);
  }, this);

  /**
   * Default template to use when creating the vast ad object.
   * @private
   * @method VastParser#getVastTemplate
   * @returns {object} The ad object that is formated to what we expect vast to look like.
   */
  var getVastTemplate = bind(function() {
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
   * Helper function to map through array and filter empty items.
   * @private
   * @method VastParser#mapWithoutEmpty
   * @param {Array} array
   * @param {Function} mapperFn mapper function
   * @returns {Array} The filtered array.
   */
  var mapWithoutEmpty = mapperFn => array => {
    return compose(
      filterEmpty,
      (arr) => map(arr, mapperFn),
    )(array);
  };

  /**
   * Helper function to remove empty items.
   * @private
   * @method VastParser#filterEmpty
   * @param {Array} array An array that is the be checked if it is empty
   * @returns {Array} The filtered array.
   */
  var filterEmpty = array => {
    return without(array, null, "");
  };

  /**
   * Helper function to get node attribute value.
   * @private
   * @method VastParser#safeGetAttribute
   * @param {HTMLElement} parentNode DOM element object
   * @param {String} attribute Attribute name
   * @returns {String | void} Attribute value
   */
  var safeGetAttribute = (node, attribute) => {
    if (!node) {
      return;
    }
    const attributeValue = node.getAttribute(attribute);
    if (attributeValue === null) {
      return;
    }

    return node.getAttribute(attribute);
  };

  /**
   * Helper function to get text content of node.
   * @private
   * @method VastParser#getNodeTextContent
   * @param {HTMLElement} parentNode Parent DOM element object
   * @param {String | void} selector Selector to find
   * @returns {String | void} Text content
   */
  var getNodeTextContent = (parentNode, selector) => {
    if (!selector) {
      return parentNode.textContent || undefined;
    }
    var childNode = parentNode.querySelector(selector);
    if (!childNode) {
      return;
    }
    return childNode.textContent || undefined;
  };

  /**
   * While getting the ad data the manager needs to parse the companion ad data as well and add it to the object.
   * @private
   * @method VastParser#parseCompanionAd
   * @param {XMLDocument} companionAdXML XML that contains the companion ad data
   * @returns {object} The ad object with companion ad.
   */
  var parseCompanionAd = function(companionAdXml) {
    var staticResource = _cleanString(getNodeTextContent(companionAdXml, 'StaticResource'));
    var iframeResource = _cleanString(getNodeTextContent(companionAdXml, 'IFrameResource'));
    var htmlResource = _cleanString(getNodeTextContent(companionAdXml, 'HTMLResource'));

    var result = {
      tracking: parseTrackingEvents(companionAdXml, ["creativeView"]),
      width: safeGetAttribute(companionAdXml, 'width'),
      height: safeGetAttribute(companionAdXml, 'height'),
      expandedWidth: safeGetAttribute(companionAdXml, 'expandedWidth'),
      expandedHeight: safeGetAttribute(companionAdXml, 'expandedHeight'),
      companionClickThrough: getNodeTextContent(companionAdXml, 'CompanionClickThrough'),
    };

    if (staticResource) {
      extend(result, {
        type: 'static',
        data: staticResource,
        url: staticResource
      });
    } else if (iframeResource) {
      extend(result, {
        type: 'iframe',
        data: iframeResource,
        url: iframeResource
      });
    } else if (htmlResource) {
      extend(result, {
        type: 'html',
        data: htmlResource,
        htmlCode: htmlResource
      });
    }

    return result;
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
  var parseTrackingEvents = (xml, events = TRACKING_EVENTS) => {
    var result = events.reduce((acc, event) => {
      var sel = "Tracking[event=" + event + "]";
      var item = compose(
        mapWithoutEmpty(node => node.textContent),
        Array.from,
      )(xml.querySelectorAll(sel));
      return {...acc, [event]: item};
    }, {});

    return result;
  };

  /**
   * Remove any new lines, line breaks and spaces from string.
   * @private
   * @method VastParser#_cleanString
   * @return {string} String with no spaces
   */
  var _cleanString = function(string) {
    if (!string) {
      return '';
    }
    return string.replace(/\r?\n|\r/g, '').trim();
  };
};

module.exports = VastParser;
