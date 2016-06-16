(function(OO,_,$) {

  var VastParser = function() {

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
        var singleAd = _getVpaidCreative(this, version, adLoaded);
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
  };

  OO.VastParser = new VastParser();

}(OO, OO._, OO.$));
