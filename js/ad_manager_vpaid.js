/*
 * @name Ad Manager for VPaid 2.0 ads
 * @module js/ad_manager_vpaid.js
 * @author Ooyala / Playback Integration
 * @version 0.1
 */

'use strict';

require('../html5-common/js/utils/InitModules/InitOO.js');
require('../html5-common/js/utils/InitModules/InitOOJQuery.js');
require('../html5-common/js/utils/InitModules/InitOOUnderscore.js');
require('../html5-common/js/utils/InitModules/InitOOHazmat.js');
require('../html5-common/js/utils/InitModules/InitOOPlayerParamsDefault.js');

require('../html5-common/js/utils/constants.js');
require('../html5-common/js/utils/utils.js');
require('../html5-common/js/utils/environment.js');

OO.Ads.manager(function(_, $) {
  /**
   * @class VPaid
   * @classDesc The VPaid Ads Manager class, registered as an ads manager with the ad manager controller.
   * @public
   * @property {string} name The name of the ad manager. This should match the name used by the server to
   *                         provide metadata.
   * @property {boolean} ready Should be set to false initially.  Should be set to true when the ad manager
   *                           has loaded all external files and metadata to notify the controller that the
   *                           ad manager is ready for the user to hit play.
   * @property {object} videoRestrictions Optional property that represents restrictions on the video plugin
   *   used.  ex. {"technology":OO.VIDEO.TECHNOLOGY.HTML5, "features":[OO.VIDEO.FEATURE.VIDEO_OBJECT_TAKE]}
   */
  var VPaid = function() {
    this.name                           = 'vpaid-ads-manager';
    this.ready                          = false;
    this.amc                            = null;
    this.videoRestrictions              = { technology: OO.VIDEO.TECHNOLOGY.HTML5,
                                            features: [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_GIVE] };
    this.embedCode                      = 'unkown';

    this.adURLOverride                  = '';
    this.allAdInfo                      = null;
    this.showLinearAdSkipButton         = false;
    var iframe                          = null;
    var timeline                        = [];

    // ad settings
    var adPlaying                       = false;
    var transitionFromNonLinearVideo    = false;
    var adLoaded                        = false;
    var adRequestType                   = 'adRequest';

    // VAST constants
    var VERSION_MAJOR_2                 = '2';
    var VERSION_MAJOR_3                 = '3';
    var SUPPORTED_VERSIONS              = [VERSION_MAJOR_2, VERSION_MAJOR_3];
    var FEATURES                        = { SKIP_AD : 'skipAd', PODDED_ADS : 'poddedAds',
                                            AD_FALLBACK : 'adFallback' };
    var SUPPORTED_FEATURES              = {};
    SUPPORTED_FEATURES[VERSION_MAJOR_2] = [];
    SUPPORTED_FEATURES[VERSION_MAJOR_3] = [FEATURES.SKIP_AD, FEATURES.PODDED_ADS, FEATURES.AD_FALLBACK];
    this.loaderId                       = 'OoVastAdsLoader' + _.uniqueId;

    // VPAID variables
    this._slot                          = null;
    this._videoSlot                     = null;
    this._videoSlotCanAutoPlay          = true;
    this.environmentVariables           = {};
    this._eventsCallbacks               = {};
    this._parameters                    = {};

    var VPAID_EVENTS                    = {
                                            AD_LOADED                 : 'AdLoaded',
                                            AD_STARTED                : 'AdStarted',
                                            AD_STOPPED                : 'AdStopped',
                                            AD_SKIPPED                : 'AdSkipped',
                                            AD_SKIPPABLE_STATE_CHANGE : 'AdSkippableStateChange',
                                            AD_DURATION_CHANGE        : 'AdDurationChange',
                                            AD_SIZE_CHANGE            : 'AdSizeChange',
                                            AD_LINEAR_CHANGE          : 'AdLinearChange',
                                            AD_INTERACTION            : 'AdInteraction',
                                            AD_IMPRESSION             : 'AdImpression',
                                            AD_CLICK_THRU             : 'AdClickThru',
                                            AD_PAUSED                 : 'AdPaused',
                                            AD_PLAYING                : 'AdPlaying',
                                            AD_VIDEO_START            : 'AdVideoStart',
                                            AD_VIDEO_COMPLETE         : 'AdVideoComplete',
                                            AD_ERROR                  : 'AdError',
                                            AD_LOG                    : 'AdLog',
                                            AD_REMAINING_TIME_CHANGE  : 'AdRemainingTimeChange',
                                            AD_VIDEO_FIRST_QUARTILE   : 'AdVideoFirstQuartile',
                                            AD_VIDEO_MIDPOINT         : 'AdVideoMidpoint',
                                            AD_VIDEO_THIRD_QUARTILE   : 'AdVideoThirdQuartile',
                                            AD_USER_ACCEPT_INVITATION : 'AdUserAcceptInvitation',
                                            AD_VOLUME_CHANGE          : 'AdVolumeChange',
                                            AD_USER_MINIMIZE          : 'AdUserMinimize'
                                          };

    // If `false` prerolls won't load until intialPlay
    this.preload                          = true;
    this.currentAd                        = {};
    this.currentPreloadedAd               = null;
    this.currentAdBeingLoaded             = null;
    this.ended                            = false;

    // VAST Parsed variables
    this.format                           = null;
    this.node                             = null;
    this.ads                              = {};
    this.isPoddedAd                       = false;
    this.adPodPrimary                     = null;
    var nextAd                            = null;
    var runNextAdCb                       = null;

    /**
     * Called by the Ad Manager Controller.  Use this function to initialize, create listeners, and load
     * remote JS files.
     * @method AdManager#initialize
     * @public
     * @param {object} adManagerController A reference to the Ad Manager Controller.
     * @param {string} playerId The unique player identifier of the player initializing the class
     */
    this.initialize = function(adManagerController, playerId) {
      this.amc = adManagerController;
      this.amc.addPlayerListener(this.amc.EVENTS.INITIAL_PLAY_REQUESTED, _.bind(this.initialPlay, this));
      this.amc.addPlayerListener(this.amc.EVENTS.FULLSCREEN_CHANGED, _.bind(_onFullscreenChanged, this));
      this.amc.addPlayerListener(this.amc.EVENTS.SIZE_CHANGED, _onSizeChanged);
    };

    /**
     * Callback when the media file is loaded. Once is loaded we can initialize the ad
     * @private
     */
    var _initializeAd = _.bind(function() {
      var eventName,
          environmentVariables,
          viewMode,
          creativeData = {};

      this.currentAd = _.extend({
        adParams: this.currentPreloadedAd.ad.adParams,
        customData: this.currentPreloadedAd.ad.customData
      }, this.currentPreloadedAd);

      this.currentAd.ad = iframe.contentWindow.getVPAIDAd();

      // Subscribe to ad unit events
      for (eventName in VPAID_EVENTS) {
        this.currentAd.ad.subscribe(_.bind(_onAdEvent, this, VPAID_EVENTS[eventName]),
            VPAID_EVENTS[eventName], this);
      }

      this._slot = _createUniqueElement();
      this._videoSlot = this.amc.ui.adVideoElement[0];

      environmentVariables = _.extend({
        slot: this._slot,
        videoSlot: this._videoSlot,
        videoSlotCanAutoPlay: true
      }, this.environmentVariables);

      this._properties = {
        adWidth: this._slot.offsetWidth,
        adHeight: this._slot.offsetHeight,
        adDesiredBitrate: 600,
      };

      viewMode = _getFsState() ? 'fullscreen' : 'normal';
      creativeData = {
        AdParameters: this.currentAd.adParams
      };

      this.initAd(this._properties['adWidth'], this._properties['adHeight'], viewMode,
                  this._properties['adDesiredBitrate'], environmentVariables, creativeData);
    }, this);

    /**
     * Registered as a callback with the AMC, which gets called by the Ad Manager Controller when the play button is hit
     * or the video automatically plays the first time. Here it will try to load the rest of the vast ads at this point
     * if there any. This function should only be used if you need to do something the first time the user hits play.
     * @public
     * @method VPaid#initialPlay
     */
    this.initialPlay = function() {
      this.loadAllAds();
    };

    /**
     * Initializes the ad by sending the data to the ad unit.
     * @public
     * @method VPaid#initAd
     * @param {int} width Width of the slot where the ad will be placed
     * @param {int} height Height of the slot where the ad will be placed
     * @param {string} viewMode Can be either `normal` or `fullscreen`
     * @param {int} desiredBitrate The bitrate for the ad
     * @param {object} creativeData Contains the aditional ad parameters for the ad
     * @param {object} environmentVars Contains the slot and videoSlot elements
     */
    this.initAd = function(width, height, viewMode, desiredBitrate, creativeData, environmentVars) {
      if (!_isValidVPaid()) {
        OO.log('VPaid Ad Unit is not valid.')
        return;
      }
      this.currentAd.ad.initAd(width, height, viewMode, desiredBitrate, environmentVars, creativeData);
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, the ui has been setup and the values
     * in amc.ui are ready to be used.
     * @method VPaid#registerUi
     * @public
     */
    this.registerUi = function() {
      this.amc.ui.createAdVideoElement({'mp4' : ''}, this.videoRestrictions);
    };

    /**
     * Called by Ad Manager Controller.  When this function is called, all movie and server metadata are
     * ready to be parsed.
     * This metadata may contain the adTagUrl and other ad manager and movie specific configuration.
     * @method VPaid#loadMetadata
     * @public
     * @param {object} adManagerMetadata Ad manager specific metadata.
     * @param {object} backlotBaseMetadata Base metadata from Ooyala Backlot.
     * @param {object} movieMetadata Metadata for the main video.
     */
    this.loadMetadata = function(adManagerMetadata, backlotBaseMetadata, movieMetadata) {
      this.embedCode = this.amc.currentEmbedCode;
      this.allAdInfo = adManagerMetadata.all_ads;
      this.pageSettings = this.amc.pageSettings;
      if (this.pageSettings && this.pageSettings.tagUrl) {
        this.adURLOverride = this.pageSettings.tagUrl;
      }
      _setAdManagerToReady();
      if (this.preload) {
        this.loadPreRolls();
      }
    };

    /**
     * Called once per video by Ad Manager Controller once the ad manager has set its ready flag to true.
     * This function asks the ad manager to return a list of all ads to the controller for addition in the
     * timeline.  If the list of ads is not available at this time, return [] or null and call
     * [AdManagerController].appendToTimeline() when the ads become available.
     * The duration and position of each ad should be specified in seconds.
     * @method VPaid#buildTimeline
     * @public
     * @returns {OO.AdManagerController#Ad[]} timeline A list of the ads to play for the current video
     */
    this.buildTimeline = function() {
      var timeline = [],
          ad;

      // If not preloading, create a false ad so we wait for prerolls to load.
      if (!this.preload) {
        ad = new this.amc.Ad({
          position: 0,
          duration: 0,
          adManager: this.name,
          ad: { type: adRequestType },
          adType: this.amc.ADTYPE.LINEAR_OVERLAY
        });

        timeline.push(ad);
      }

      return timeline;
    };

    /**
     * Opens a page based on the clickthrough url when the user click on the Ad.
     * @public
     * @method VPaid#playerClicked
     * @param {object} amcAd Ad wrapper that is sent from the Ad Manager Controller that contains the data
     * @param {boolean} showPage If set to true then we show the page, if it is false then we don't show the page
     */
    this.playerClicked = function(clickedAd, showPage) {
      if (!showPage) {
        return;
      }
      var highLevelClickThroughUrl = clickedAd.ad.data && clickedAd.ad.data.clickThrough;
      var adSpecificClickThroughUrl = null;
      var ooyalaClickUrl = clickedAd.click_url;

      if (clickedAd.isLinear) {
        adSpecificClickThroughUrl = clickedAd.ad.customData.videoClickTracking.clickThrough;
      } else {
        adSpecificClickThroughUrl = clickedAd.ad.customData.videoClickTracking.nonLinearClickThrough;
      }

      if (highLevelClickThroughUrl || ooyalaClickUrl || adSpecificClickThroughUrl) {
        this.openUrl(highLevelClickThroughUrl);
        this.openUrl(ooyalaClickUrl);
        this.openUrl(adSpecificClickThroughUrl);
      }
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should play the ad or group of podded ads passed to
     * the function as a parameter.
     * @method VPaid#playAd
     * @public
     * @param {object} ad The ad object to play.
     */
    this.playAd = function(ad) {
      // Stop fake ad, delay avoids issues with next preroll
      if (ad.ad.type == adRequestType) {
        _.delay(_.bind(function() {
          this.amc.notifyPodStarted(ad.id, 1);
          this.amc.notifyPodEnded(ad.id);
        }, this), 0);
      } else {
        this.currentPreloadedAd = ad;
        _getFrame();
      }
    };

    /**
     * Once Ad Playback started
     * @private
     * @method VPaid#_onPlayStarted
     */
    var _onPlayStarted = _.bind(function() {
      initSkipAdOffset(this.currentAd);
      adPlaying = true;
    }, this);

    /**
     * Checks if there is any companion ads associated with the ad and if one is found, it will call the Ad Manager
     * Controller to show it.
     * @public
     * @method VPaid#checkCompanionAds
     */
    this.checkCompanionAds = function(ad) {
      var customData = ad.customData,
          adUnitCompanions = ad.ad.getAdCompanions(),
          companions;

      // If vast template has no companions (has precedence), check the adCompanions property from the ad Unit
      companions = !_.isNull(customData) && !_.isEmpty(customData.companion) ? customData.companion : adUnitCompanions;
      if (_.isEmpty(companions)) {
        return;
      }

      this.amc.showCompanion(companions);
     };

   /**
     * This is called by the Ad Manager Controller when it needs to cancel an Ad due to a timeout or skip button.
     * @public
     * @method VPaid#cancelAd
     * @param {object} ad The Ad that needs to be cancelled
     * @param {object} params An object containing information about the cancellation
     *                        code : The amc.AD_CANCEL_CODE for the cancellation
     */
    this.cancelAd = function(ad, params) {
      //TODO: add timeout logic if needed here as well.
      if (!this.amc || !this.amc.ui || !ad) {
        return;
      }
      if(params && params.code === this.amc.AD_CANCEL_CODE.TIMEOUT) {
        failedAd();
      } else {
        if (params && params.code === this.amc.AD_CANCEL_CODE.SKIPPED && this.currentAd) {
          // Notify Ad Unit that we are skipping the ad
          this.currentAd.ad.skipAd();
        }
        if (ad.isLinear) {
          this.adVideoEnded();
        } else {
          _stopAd();
        }
      }
    };

    /**
     * Called when the ad starts playback.
     * @public
     * @method VPaid#adVideoPlaying
     */
    this.adVideoPlaying = function() {
      if (this.currentAd && this.currentAd.ad && this.currentAd.customData.nextAdInPod) {
        var metadata = this.currentAd.customData.nextAdInPod;
        if (metadata) {
          nextAd = generateAd(metadata);
        }
      }
    };

    /**
     * When the ad is finished playing we need to call the AMC callback that was provided to let the AMC know that the
     * ad is finished playing.
     * @public
     * @method VPaid#adVideoEnded
     */
    this.adVideoEnded = function() {
      if (this.currentAd) {
        _stopAd();
      }
      runNextAdCb = _.bind(function() {
        if (nextAd) {
          var ad = nextAd;
          nextAd = null;
          _resetAdState();
          this.amc.forceAdToPlay(this.name, ad.ad, ad.adType, ad.streams);
        }
      }, this);
    };

    /**
     * Once Ad Playback stopped
     * @private
     * @method VPaid#_stopAd
     */
    var _stopAd = _.bind(function() {
      var currentAd = this.currentAd;
      if (currentAd && currentAd.ad) {
        currentAd.ad.stopAd();
      }
    }, this);

    /**
     * Start current ad
     * @private
     * @method VPaid#_beginAd
     */
    var _beginAd = _.bind(function() {
      var ad = this.currentAd.ad,
          adLinear = ad.getAdLinear();

      _onPlayStarted();

      if (adLinear) {
        if (this.adPodPrimary === null) {
          this.adPodPrimary = this.currentAd;
          this.amc.notifyPodStarted(this.currentAd.id, this.currentAd.customData.adPodLength);
        }

        this.amc.notifyLinearAdStarted(this.currentAd.id, {
          name: this.currentAd.customData.adTitle,
          duration : ad.getAdDuration(),
          clickUrl: _hasClickUrl(this.currentAd),
          indexInPod: this.currentAd.customData.sequence,
          skippable : ad.getAdSkippableState()
        });
      } else {
        this.amc.sendURLToLoadAndPlayNonLinearAd(this.currentAd, this.currentAd.id, null);
      }

      // Should check for companionAds on the VAST template
      this.checkCompanionAds(this.currentAd);
    }, this);

    /**
     * Ends an ad. Notifies the AMC about the end of the ad. If it is the last linear ad in the pod,
     * will also notify the AMC of the end of the ad pod.
     * @private
     * @method VPaid#_endAd
     * @param {object} ad The ad to end
     * @param {boolean} failed If true, the ending of this ad was caused by a failure
     */
    var _endAd = _.bind(function(ad, failed) {
      var isLinear = ad.ad.getAdLinear();
      if (this.currentAd && ad) {
        if (isLinear) {
          this.amc.notifyLinearAdEnded(ad.id);

          // To be safe, if ad unit doesn't send AD_LINEAR_CHANGED to end the ad.
          if (transitionFromNonLinearVideo) {
            this.amc.ui.transitionToMainContent(true, false);
            transitionFromNonLinearVideo = false;
            this.amc.notifyNonlinearAdEnded(ad.id);
          }

          var allPodsPlayed = parseInt(ad.customData.sequence) === ad.customData.adPodLength;
          if((!failed && allPodsPlayed) || ad.customData.sequence === null) {
            this.amc.notifyPodEnded(this.adPodPrimary.id);
            this.adPodPrimary = null;
            this.currentPreloadedAd   = null;
          }
        } else {
          this.amc.notifyNonlinearAdEnded(ad.id);
        }

        if (typeof runNextAdCb === 'function') {
          runNextAdCb();
          runNextAdCb = null;
        } else {
          _resetAdState();
        }
      }
    }, this);

    /**
     * When the ad fails to play we need to call the AMC callback that was provided to let the AMC know that the
     * ad is finished playing and we need to follow the process for cleaning up after an ad fails.
     * @public
     * @method VPaid#adVideoError
     * @param {object} adWrapper The current Ad's metadata
     * @param {number} errorCode The error code associated with the VTC error
     */
    this.adVideoError = function(ad, errorCode) {
      // VTC will pause the ad when the video element loses focus
      OO.log('VPaid: Ad failed to play with error code:' + errorCode);
      failedAd();
    };

    /**
     * Gets current ad format, which is either Linear or NonLinear
     * @private
     * @method VPaid#_getFormat
     * @return {object} Ad format
     */
    var _getFormat = _.bind(function() {
      var format, name, node;
      node = this.$_node[0].getElementsByTagName('Linear')[0];
      if (!node) {
        node = this.$_node[0].getElementsByTagName('NonLinear')[0];
      }
      if (!node) {
        return;
      }
      name = node.nodeName;
      format = name === 'Linear' ? 'Linear' : 'NonLinear';
      return format;
    }, this);

    /**
     * Takes an ad and adds it to the timeline by calling appenedToTimeline which is an Ad Manager Controller function.
     * Also the properties of whether an ad is linear or not, and whether or not the marquee should show are set here.
     * @private
     * @method VPaid#addToTimeline
     * @param {object} ad The ad metadata that is being added to the timeline.
     */
    var addToTimeline = _.bind(function(ad) {
      if (!ad) return;
      var timeline = [], type, duration, newAd;

      var newAd = generateAd(ad);
      timeline.push(newAd);

      this.amc.appendToTimeline(timeline);
    }, this);

    /**
     * Generates a parsed VPaid ad to load.
     * @private
     * @method VPaid#_getVPaidCreative
     * @param {object} adLoaded Current ad loaded metadata.
     * @param {XMLDocument} adXml Current ad xml
     * @param {string} Current vast version
     * @return {object} Parsed vpaid's metadata ad
     */
    var _getVpaidCreative = _.bind(function(adLoaded, adXml, version) {
      var adParams = '{}';

      this.$_node = $(adXml);
      this.format = _getFormat();
      var isLinear = this.format === 'Linear';

      var $node = this.$_node.find(this.format);
      if (!$node.length) {
        return;
      }

      var $paramsNode = $node.find('AdParameters');
      var $mediaNode = isLinear ? $node.find('MediaFile') : $node.find('StaticResource');
      var $companionsNode = this.$_node.find('CompanionAds');
      var $validNode = isLinear ? $mediaNode : $node;

      if (!$mediaNode.length || !_isValidCreative($validNode, isLinear)) {
        OO.log('VPaid: No valid media source, either is not a VPaid Ad or ad unit is not in javascript format.');
        return;
      }

      if ($paramsNode.length) {
        adParams = _cleanString($paramsNode.text());
      }

      var mediaFile = {
        url: $mediaNode.text(),
        type: $mediaNode.attr('type') || $mediaNode.attr('creativeType')
      };

      $mediaNode = isLinear ? $mediaNode : $mediaNode.parent();
      mediaFile = _.extend(mediaFile, {
        width: Number($mediaNode.attr('width')),
        height: Number($mediaNode.attr('height')),
        tracking: this._getTracking($mediaNode[0])
      });

      var impressions = this._getImpressions();
      var tracking = this._getTracking(isLinear ? $node[0] : $node.parent()[0]);
      var errorTracking = _cleanString(this.$_node.find('Error').text());
      var videoClickTracking;
      if (isLinear) {
        videoClickTracking = {
          clickTracking: _cleanString(this.$_node.find('ClickTracking').text()),
          clickThrough: _cleanString(this.$_node.find('ClickThrough').text()),
          customClick: _cleanString(this.$_node.find('CustomClick').text())
        };
      } else {
        videoClickTracking = {
          nonLinearClickThrough: _cleanString(this.$_node.find('NonLinearClickThrough').text())
        }
      }

      var sequence = this.$_node.attr('sequence');
      var adPodLength = this.$_node.parent().find('[sequence] Linear').length;
      if (!supportsPoddedAds(version) || !_.isNumber(parseInt(sequence))) {
        sequence = null;
      }

      var companionAds = [];
      var companions = $companionsNode.find('Companion');
      if (companions.length !== 0) {
        companions.each(function(i, v){
          companionAds.push(parseCompanionAd($(v)));
        });
      }

      var data = {
        companion: companionAds,
        adTitle: _cleanString(this.$_node.find('AdTitle').text()),
        tracking: tracking,
        impressions: impressions,
        error: errorTracking,
        videoClickTracking: videoClickTracking,
        version: version,
        position: adLoaded.position / 1000,
        duration: isLinear ? OO.timeStringToSeconds(this.$_node.find('Duration').text()) : 0,
        type: isLinear ? this.amc.ADTYPE.LINEAR_VIDEO : this.amc.ADTYPE.NONLINEAR_OVERLAY,
        sequence: sequence || null,
        adPodLength: adPodLength ? adPodLength : 1,
        skipOffset: $node.attr('skipoffset') || null
      };

      return {
        mediaFile: mediaFile,
        adParams: adParams,
        data: data,
        adSequenceType: !!sequence ? 'podded' : 'standalone'
      };
    }, this);

    /**
     * Get tracking events.
     * @public
     * @method VPaid#_getImpressions
     * @return {array} Array with impressions urls
     */
    this._getImpressions = function() {
      var impressions, node, nodes, _i, _len;
      impressions = [];
      nodes = this.$_node[0].getElementsByTagName('Impression');
      for (_i = 0, _len = nodes.length; _i < _len; _i++) {
        node = nodes[_i];
        impressions.push({
          url: node.textContent
        });
      }
      return impressions;
    };

    /**
     * Get tracking events.
     * @public
     * @method VPaid#_getTracking
     * @param {object} parent DOM Element to look for tracking events
     * @return {array} Array with tracking events and urls
     */
    this._getTracking = function(parent) {
      var node, nodes, tracking, _i, _len;
      tracking = [];
      nodes = parent.getElementsByTagName('Tracking');
      if (!nodes) {
        return;
      }
      for (_i = 0, _len = nodes.length; _i < _len; _i++) {
        node = nodes[_i];
        tracking.push({
          event: node.getAttribute('event'),
          url: node.textContent
        });
      }
      return tracking;
    };

    /**
     * Send impressions.
     * @public
     * @method VPaid#_sendError
     */
    this._sendError = function() {
      if (this.currentAd && this.currentAd.customData) {
        var error = this.currentAd.customData.error;
        if (error) {
          OO.pixelPing(error);
        }
      }
    };

    /**
     * Send impressions.
     * @public
     * @method VPaid#_sendImpressions
     */
    this._sendImpressions = function() {
      if (this.currentAd && this.currentAd.customData) {
        var impressions = this.currentAd.customData.impressions;
        _.each(impressions, function(impression) {
          if (impression && impression.url) {
            OO.pixelPing(impression.url);
          }
        });
      }
    };

    /**
     * Send tracking events.
     * @public
     * @method VPaid#_sendTracking
     * @param {string} type Event name to be send
     */
    this._sendTracking = function(type) {
      if (this.currentAd && this.currentAd.customData) {
        var tracking = this.currentAd.customData.tracking,
            currentEvent;
        if (tracking) {
          currentEvent = _.find(tracking, function(item, index) {
            return item.event == type
          });

          if (currentEvent && currentEvent.url) {
            OO.pixelPing(currentEvent.url);
          }
        }
      }
    };

    /**
     * Send click tracking event.
     * @public
     * @method VPaid#_sendClickTracking
     * @param {object} ad Ad to look for the tracking url
     */
    this._sendClickTracking = function(ad) {
      if (ad && ad.customData && ad.customData.videoClickTracking) {
        var clickTracking = ad.customData.videoClickTracking.clickTracking;
        if (clickTracking){
          OO.pixelPing(clickTracking);
        }
      }
    };

    /**
     * Stops the ad and notify AMC, if fallback ad exists play it instead of the failed ad.
     * @private
     * @method VPaid#failedAd
     */
    var failedAd = _.bind(function() {
      var metadata = null;
      var badAd = this.currentAd;
      this.currentAd = null;

      if (badAd) {
        if(badAd.ad && badAd.ad.fallbackAd) {
          metadata = badAd.ad.fallbackAd;
        }
        _endAd(badAd, true);
        //force fallback ad to play if it exists
        //otherwise end the ad pod
        if (metadata) {
          var ad = generateAd(metadata);
          this.amc.forceAdToPlay(this.name, ad.ad, ad.adType, ad.streams);
        } else {
          this.adPodPrimary = null;
          if (badAd.ad.getAdLinear()) {
            this.amc.notifyLinearAdEnded(badAd.id);
          } else {
            this.amc.notifyNonlinearAdEnded(badAd.id);
          }
          $(this._slot).remove();
          this.amc.notifyPodEnded(badAd.id);
        }
      }
    }, this);

    /**
     * When the vast Ad is loaded correctly it will call this callback. Here the data is parsed to see if it is a linear
     * or nonLinear Ad. It will pull the tracking, impression, companion and clicking information. Then merge the results
     * and send it to the correct handler based on if it is Linear or not.
     * @public
     * @method VPaid#_onVastResponse
     * @param {object} adLoaded The ad loaded object and metadata.
     * @param {XMLDocument} xml The xml returned from loading the ad.
     */
    this._onVastResponse = function(adLoaded, xml) {
      if (!isValidVastXML(xml)) {
        return;
      }
      var version = getVastVersion(xml);
      var parsedAds = _parseAds(adLoaded, xml, version);
      // Will group ads by `podded` or `standalone` type
      var ads = _.groupBy(parsedAds, 'adSequenceType');
      _processToTimeline(ads, version);
    };

    /**
     * Generates a list of parsed creatives
     * @private
     * @method VPaid#_processToTimeline
     * @param {array} ads Split list of podded (sorted by sequence) and standalone ads
     * @param {string} Current vast version
     */
    var _processToTimeline = _.bind(function(ads, version) {
      var fallbackAd = null;
      var previousAdUnit = null;
      var timelineAd;
      if (ads.podded && ads.podded.length > 0) {
        if(supportsAdFallback(version) && ads.standalone && ads.standalone.length > 0) {
          fallbackAd = ads.standalone[0];
        }

        _.each(ads.podded, function(ad) {
          if (fallbackAd) {
            ad.data.fallbackAd = fallbackAd;
          }

          if (previousAdUnit) {
            previousAdUnit.data.nextAdInPod = ad;
          }
          previousAdUnit = ad;
        });
        timelineAd = ads.podded[0];
      } else {
        if (ads.standalone) {
          timelineAd = ads.standalone[0];
        }
      }

      if (!_.isEmpty(timelineAd)) {
        addToTimeline(timelineAd);
      } else {
        failedAd();
      }
    }, this);

    /**
     * Generates a list of parsed creatives
     * @private
     * @method VPaid#_parseAds
     * @param {object} adLoaded Current ad beign loaded
     * @param {XMLDocument} vastXML Current vast xml
     * @param {string} Current vast version
     * @return {array} List of parsed creatives
     */
    var _parseAds = _.bind(function(adLoaded, vastXML, version) {
      var result  = [];

      $(vastXML).find('Ad').each(function(index, value) {
        var singleAd = _getVpaidCreative(adLoaded, this, version);
        if (singleAd) {
          result.push(singleAd);
        }
      });

      result =  _.sortBy(result, function(pod) { return pod.data.sequence });
      return result;
    }, this);

    /**
     * Check wether or not a vpaid ad is valid by checking the ad type and make sure is VPaid
     * @method VPaid#_isValidVPaid
     * @private
     * @return {boolean} VPaid validated value
     */
    var _isValidCreative = function(node, isLinear) {
      var apiFramework = node.attr('apiFramework') === 'VPAID';
      var creativeType = isLinear ? node.attr('type') : node.find('StaticResource').attr('creativeType');
      return apiFramework && creativeType === 'application/javascript';
    };

    /**
     * While getting the ad data the manager needs to parse the companion ad data as well and add it to the object.
     * @private
     * @method VPaid#parseCompanionAd
     * @param {xml} companionAdXML Xml that contains the companion ad data.
     * @returns {object} Ad object with companion ad.
     */
    var parseCompanionAd = _.bind(function(companionAdXml) {
      var result = { tracking: {} };
      var staticResource = _cleanString(companionAdXml.find('StaticResource').text());
      var iframeResource = _cleanString(companionAdXml.find('IFrameResource').text());
      var htmlResource = _cleanString(companionAdXml.find('HTMLResource').text());

      result.tracking = this._getTracking(companionAdXml[0]);

      result = {
        width: companionAdXml.attr('width'),
        height: companionAdXml.attr('height'),
        expandedWidth: companionAdXml.attr('expandedWidth'),
        expandedHeight: companionAdXml.attr('expandedHeight'),
        CompanionClickThrough: companionAdXml.find('CompanionClickThrough').text()
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
     * Listen and executes events sent by the ad unit
     * @private
     * @method VPaid#_onAdEvent
     * @param {string} eventName Name of the event to process
     */
    var _onAdEvent = _.bind(function(eventName) {
      switch(eventName) {
        case VPAID_EVENTS.AD_LOADED:
          adLoaded = true;
          this.currentAd.ad.startAd();
          // Added to make sure we display videoSlot correctly
          this._videoSlot.style.zIndex = 10001;
        break;

        case VPAID_EVENTS.AD_STARTED:
          _onSizeChanged();
          _beginAd();
          this._sendTracking('creativeView');
        break;

        case VPAID_EVENTS.AD_IMPRESSION:
          this._sendImpressions();
        break;

        case VPAID_EVENTS.AD_CLICK_THRU:
          var url = arguments[1];
          var playerHandles = arguments[3];
          // Refer to IAB 2.5.4 How to handle VPAID clicks in VAST context
          if (playerHandles) {
            if (url) {
              this.openUrl(url);
            } else {
              this.amc.adsClicked();
            }
          }
          this._sendClickTracking();
        break;

        case VPAID_EVENTS.AD_VIDEO_START:
          this._sendTracking('start');
        break;

        case VPAID_EVENTS.AD_VIDEO_FIRST_QUARTILE:
          this._sendTracking('firstQuartile');
        break;

        case VPAID_EVENTS.AD_VIDEO_MIDPOINT:
          this._sendTracking('midpoint');
        break;

        case VPAID_EVENTS.AD_VIDEO_THIRD_QUARTILE:
          this._sendTracking('thirdQuartile');
        break;

        case VPAID_EVENTS.AD_VIDEO_COMPLETE:
          this._sendTracking('complete');
          // Manually call stopAd, to be safe if ad unit doesn't send it
          _stopAd();
        break;

        case VPAID_EVENTS.AD_STOPPED:
          if (this.currentAd) {
            _endAd(this.currentAd, false);
          }
        break;

        case VPAID_EVENTS.AD_INTERACTION:
          this._sendTracking('interaction');
        break;

        case VPAID_EVENTS.AD_ERROR:
          OO.log('VPaid: Ad unit error: ' + arguments[1]);
          this._sendTracking('error');
          this._sendError();
          _stopAd();
        break;

        case VPAID_EVENTS.AD_DURATION_CHANGE:
          var remainingTime = this.currentAd.ad.getAdRemainingTime();
          if (!duration) {
            _stopAd();
          }
        break;

        case VPAID_EVENTS.AD_SKIPPED:
          this._sendTracking('skip');
          // Only required if VPaid version < 2.0
          // _stopAd();
        break;

        case VPAID_EVENTS.AD_SKIPPABLE_STATE_CHANGE:
          var skipState = this.currentAd.ad.getAdSkippableState();
          this.amc.showSkipVideoAdButton(skipState, '0');
        break;

        case VPAID_EVENTS.AD_LINEAR_CHANGE:
          var adLinear = this.currentAd.ad.getAdLinear();
          transitionFromNonLinearVideo = true;
          if (adLinear) {
            _beginAd();
            this.amc.ui.transitionToAd();
          }
        break;

        case VPAID_EVENTS.AD_VOLUME_CHANGE:
          var volume = this.currentAd.ad.getAdVolume();
          if (volume) {
            this._sendTracking('unmute');
          } else {
            this._sendTracking('mute');
          }
        break;

        case VPAID_EVENTS.AD_USER_ACCEPT_INVITATION:
          this._sendTracking('acceptInvitation');
        break;

        case VPAID_EVENTS.AD_USER_MINIMIZE:
          this._sendTracking('collapse');
        break;

        case VPAID_EVENTS.AD_USER_CLOSE:
          this._sendTracking('close');
        break;

        case VPAID_EVENTS.AD_PAUSED:
          this._sendTracking('pause');
        break;

        case VPAID_EVENTS.AD_PLAYING:
          this._sendTracking('resume');
        break;
      };
    }, this);

    /**
     * Determine if a Vast ad is skippable, and if so, when the skip ad button should be displayed.
     * Notifies AMC of the result.
     * @private
     * @method VPaid#initSkipAdOffset
     * @param {object} adWrapper The current Ad's metadata
     */
    var initSkipAdOffset = _.bind(function(adWrapper) {
      var adSkippableState = adWrapper.ad.getAdSkippableState();
      if (supportsSkipAd(adWrapper.customData.version)) {
        var skipOffset = adWrapper.customData.skipOffset;
        if (skipOffset) {
          if (skipOffset.indexOf('%') === skipOffset.length - 1) {
            this.amc.showSkipVideoAdButton(true, skipOffset, true);
          } else {
            //Vast format: HH:MM:SS.mmm
            var splits = skipOffset.split(':');
            var hh = splits[0];
            var mm = splits[1];
            var ss = splits[2];
            var ms = 0;
            var secondsSplits = ss.split('.');
            if (secondsSplits.length === 2) {
              ss = secondsSplits[0];
              ms = secondsSplits[1];
            }
            var offset = +ms + (+ss * 1000) + (+mm * 60 * 1000) + (+hh * 60 * 60 * 1000);
            //Provide the offset to the AMC in seconds
            offset = Math.round(offset / 1000);
            this.amc.showSkipVideoAdButton(true, offset.toString());
          }
        } else {
          this.amc.showSkipVideoAdButton(adSkippableState,
                this.amc.adManagerSettings['linearAdSkipButtonStartTime'].toString());
        }
      } else {
        //For Vast versions that don't support the skipoffset attribute, we want
        //to listen for the ad unit's skippable state
        this.amc.showSkipVideoAdButton(adSkippableState,
              this.amc.adManagerSettings['linearAdSkipButtonStartTime'].toString());
      }
    }, this);

     /** Checks to see if the current metadata contains any ads that are pre-rolls and of type vast, if there are any
     * then it will load the ads.
     * @public
     * @method VPaid#loadPreRolls
     */
    this.loadPreRolls = function() {
      findAndLoadAd('pre');
    };

    /**
     * Checks the metadata for any remaining ads of type vast that are not pre-rolls,
     * if it finds any then it will load them.
     * @public
     * @method VPaid#loadAllVastAds
     */
    this.loadAllAds = function() {
      findAndLoadAd(this.preload ? 'midPost' : 'all');
    };

   /**
     * Finds ads based on the position provided to the function.
     * @private
     * @method VPaid#findAndLoadAd
     * @param {string} position The position of the ad to be loaded. 'pre' (preroll), 'midPost' (midroll and post rolls)
     * 'all' (all positions).
     * @returns {boolean} returns true if it found an ad or ads to load otherwise it returns false. This is only used for
     * unit tests.
     */
    var findAndLoadAd = _.bind(function(position) {
      var loadedAds = false;

      if (!this.allAdInfo || this.allAdInfo.length < 1) return loadedAds;
      for (var i = 0; i < this.allAdInfo.length; i++) {
        var ad = this.allAdInfo[i];
          if (this.adURLOverride) {
            ad.tag_url = this.adURLOverride;
          }
          if (position && ((position == 'pre' && ad.position == 0) || (position == 'midPost' && ad.position > 0)
            || (position == 'all'))) {
            this.currentAdBeingLoaded = ad;
            this.loadUrl(ad.tag_url);
            loadedAds = true;
          }
        }
      return loadedAds;
    }, this);

    /**
     * Generates an AdManagerController (AMC) Ad object from the provided metadata.
     * @private
     * @method VPaid#generateAd
     * @param {object} metadata The ad metadata to be used for the AMC Ad object
     * @return {object} The AMC Ad object
     */
    var generateAd = _.bind(function(ad) {
      ad.customData = ad.data;

      var newAd = new this.amc.Ad({
        position: ad.data.position,
        duration: ad.data.duration,
        adManager: this.name,
        ad: ad,
        adType: ad.data.type,
        streams: {'mp4' : ''}
      });

      return newAd;
    }, this);

    /**
     * Set variables to its default state
     * @private
     * @method VPaid#_resetAdState
     */
    var _resetAdState = _.bind(function() {
      _removeListeners(this.currentAd.ad);
      this.currentAd            = null;
      this.currentAdBeingLoaded = null;
      this.format               = null;
      this.node                 = null;
      adLoaded                  = false;
      adPlaying                 = false;
    }, this);

    /**
     * Returns the Vast version of the provided XML.
     * @private
     * @method VPaid#getVastVersion
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {string} The Vast version.
     */
    var getVastVersion = _.bind(function(vastXML) {
      return $(vastXML.firstChild).attr('version');
    }, this);

    /**
     * Returns the Vast major version. For example, the '3' in 3.0.
     * @private
     * @method VPaid#getMajorVersion
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
     * @method VPaid#supportsVersion
     * @param {string} version The Vast version as parsed from the XML
     * @returns {boolean} true if the version is supported by this ad manager, false otherwise.
     */
    var supportsVersion = _.bind(function(version) {
      return _.contains(SUPPORTED_VERSIONS, getMajorVersion(version));
    }, this);

    /**
     * Checks to see if the given Vast version supports the skip ad functionality, as per Vast specs
     * for different versions.
     * @private
     * @method VPaid#supportsSkipAd
     * @param {string} version The Vast version as parsed from the XML
     * @returns {boolean} true if the skip ad functionality is supported in the specified Vast version,
     *                    false otherwise.
     */
    var supportsSkipAd = _.bind(function(version) {
      return _.contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.SKIP_AD);
    }, this);

    /**
     * Checks to see if the given Vast version supports the podded ads functionality, as per Vast specs
     * for different versions.
     * @private
     * @method VPaid#supportsPoddedAds
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
     * @method VPaid#supportsAdFallback
     * @returns {boolean} true if the ad fallback functionality is supported in the specified Vast version,
     *                    false otherwise
     */
    var supportsAdFallback = _.bind(function(version) {
      return _.contains(SUPPORTED_FEATURES[getMajorVersion(version)], FEATURES.AD_FALLBACK);
    }, this);

    /**
     * Remove any new lines, line breaks and spaces from string.
     * @private
     * @method VPaid#_cleanString
     * @return {string} String with no spaces
     */
    var _cleanString = function(string) {
      return string.replace(/\r?\n|\r/g, '').trim();
    };

    /**
     * Check for clickthrough url
     * @private
     * @method VPaid#_hasClickUrl
     * @return {object} Ad to look for the clickthrough
     */
    var _hasClickUrl = function(ad) {
      if (ad && ad.customData) {
        var  videoClickTracking = ad.customData.videoClickTracking;
        if (videoClickTracking.clickThrough) {
          return videoClickTracking.clickThrough.length > 0;
        }
      }
      return false;
    };
    /**
     * Check wether or not a vpaid ad is valid by checking the version and the minimum required functions
     * @method VPaid#_isValidVPaid
     * @private
     * @return {boolean} VPaid validated value
     */
    var _isValidVPaid = _.bind(function() {
      var creative = this.currentAd.ad,
          vpaidVersion = parseInt(creative.handshakeVersion('2.0')),
          isValid = true;

      if (vpaidVersion !== 2) {
        OO.log('VPaid Ad Unit version is not supported.');
        isValid = false;
      }

      var requiredFunctions = ['handshakeVersion', 'initAd', 'startAd', 'stopAd', 'skipAd', 'resizeAd',
                               'pauseAd', 'resumeAd', 'expandAd', 'collapseAd', 'subscribe', 'unsubscribe'];
      _.each(requiredFunctions, function(fn) {
        if (!fn && typeof fn !== 'function') {
          isValid = false;
          OO.log('VPaid Ad Unit is missing function: ' + fn);
        }
      });

      return isValid;
    }, this);

    /**
     * Helper function to verify that XML is valid
     * @public
     * @method VPaid#isValidVastXML
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {boolean} Returns true if the xml is valid otherwise it returns false.
     */
    var isValidVastXML = function(vastXML) {
      return isValidRootTagName(vastXML) && isValidVastVersion(vastXML);
    };

    /**
     * Helper function to verify XML has valid VAST root tag.
     * @public
     * @method VPaid#isValidRootTagName
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {boolean} Returns true if the root tag is valid otherwise it returns false.
     */
    var isValidRootTagName = function(vastXML) {
      var rootTagName = (vastXML && vastXML.firstChild) ? vastXML.firstChild.tagName || '' : '';
      if (rootTagName.toUpperCase() != 'VAST') {
        OO.log('VPaid: Invalid VAST XML for Tag Name: ' + rootTagName);
        return false;
      }
      return true;
    };

    /**
     * Helper function to verify XML is a valid VAST version.
     * @public
     * @method VPaid#isValidVastVersion
     * @param {XMLDocument} vastXML Contains the vast ad data to be parsed
     * @returns {boolean} Returns true if the VAST version is valid otherwise it returns false.
     */
    var isValidVastVersion = function(vastXML) {
      var version = getVastVersion(vastXML);
      if (!supportsVersion(version)) {
        OO.log('VPaid: Invalid VAST Version: ' + version);
        return false;
      }
      return true;
    };

    /**
     * Creates a new slot for each ad unit with unique id to avoid conflicts between ads.
     * @private
     * @return {object} A DOM element with unique id.
     */
    var _createUniqueElement = _.bind(function() {
      var element = null,
          parent = this.amc.ui.playerSkinPluginsElement ?
                              this.amc.ui.playerSkinPluginsElement[0] : this.amc.ui.pluginsElement[0];

      element = document.createElement('div');
      element.id = _.uniqueId('pluginElement_');
      element.style.width = '100%';
      element.style.height = '100%';
      parent.insertBefore(element, parent.firstChild);
      return element;
    }, this);

    /**
     * Used to generate a frame to load ad media files.
     * @private
     */
    var _getFrame = function() {
      iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.onload = _onIframeLoaded;
      document.body.appendChild(iframe);
    };

    /**
     * Callback when the frame is loaded.
     * @private
     */
    var _onIframeLoaded = _.bind(function() {
      var loader = iframe.contentWindow.document.createElement('script');
      loader.src = _cleanString(this.currentPreloadedAd.ad.mediaFile.url);
      loader.onload = _initializeAd;
      loader.onerror = this.destroy;
      iframe.contentWindow.document.body.appendChild(loader);
    }, this);

    /**
     * Gets Current Fullscreen state
     * @private
     * @method VPaid#_getFsState
     */
   var _getFsState = _.bind(function() {
      var fs;

      if (document.fullscreen != null) {
        fs = document.fullscreen;
      } else if (document.mozFullScreen != null) {
        fs = document.mozFullScreen;
      } else if (document.webkitIsFullScreen != null) {
        fs = document.webkitIsFullScreen;
      } else if (document.msFullscreenElement != null) {
        fs = document.msFullscreenElement !== null;
      }

      if (fs == null) {
        fs = false;
      }

      return fs;
    }, this);

    /**
     * Callback for Ad Manager Controller. Handles going into and out of fullscreen mode.
     * @public
     * @method VPaid#onFullScreenChanged
     * @param {boolean} shouldEnterFullscreen True if going into fullscreen
     */
    var _onSizeChanged = _.bind(function() {
      var viewMode = _getFsState() ? 'fullscreen' : 'normal';
      var width = viewMode === 'fullscreen' ? window.screen.width : this._slot.offsetWidth;
      var height = viewMode === 'fullscreen' ? window.screen.height : this._slot.offsetHeight;
      this.resize(width, height, viewMode);
    }, this);

    /**
     * Callback for Ad Manager Controller. Handles going into and out of fullscreen mode.
     * @private
     * @method VPaid#onFullScreenChanged
     */
    var _onFullscreenChanged = function() {
      _onSizeChanged();
    };

    /**
     * Remove ad listeners
     * @private
     * @method VPaid#_removeListeners
     */
    var _removeListeners = function(currentAd) {
      var eventName;
      for (eventName in VPAID_EVENTS) {
        currentAd.unsubscribe(eventName);
      }
    };
    /**
     * Sets ad manager to the ready state
     * @private
     * @method VPaid#onFullScreenChanged
     */
    var _setAdManagerToReady = _.bind(function() {
      this.ready = true;
      this.amc.onAdManagerReady(this.name);
    }, this);

    /**
     * Resizes the ad slot.
     * @public
     * @method VPaid#resize
     * @param {integer} width New width to resize to
     * @param {integer} height New height to resize to
     * @param {string} viewMode Can take values: fullscreen or normal
     */
    this.resize = function(width, height, viewMode) {
      if (this.currentAd && this.currentAd.ad) {
        this.currentAd.ad.resizeAd(width, height, viewMode);
      }
    };

    /**
     * Pauses the ad element.
     * @public
     * @method VPaid#pauseAd
     * @param {object} ad The current ad data
     */
    this.pauseAd = function(ad) {
      // Need to notify the ad unit that the player was paused
      if (this.currentAd && this.currentAd.ad) {
        this.currentAd.ad.pauseAd();
      }
    };

    /**
     * Resume the ad element.
     * @public
     * @method VPaid#resumeAd
     * @param {object} ad The current ad data
     */
    this.resumeAd = function(ad) {
      // Need to notify the ad unit that the player was resumed
      if (this.currentAd && this.currentAd.ad) {
        this.currentAd.ad.resumeAd();
      }
    };

    this.skipAd = function(ad) {

    };
    /**
     * Opens a new page pointing to the URL provided.
     * @public
     * @method VPaid#openUrl
     * @param {string} url The url that we need to open in a new page
     */
    this.openUrl = function(url) {
      if (!url || typeof url !== 'string') {
        return;
      }
      window.open(url);
    };

    /**
     * Calls _ajax to load the Ad via the url provided.
     * @public
     * @method VPaid#loadUrl
     * @param {string} url The Ad creative url.
     */
    this.loadUrl = function(url) {
      this.vastUrl = url;
      this._ajax(url, this._onVastError, 'xml');
    };

    /**
     * Attempts to load the Ad after normalizing the url.
     * @public
     * @method VPaid#_ajax
     * @param {string} url The url that contains the Ad creative
     * @param {function} errorCallback callback in case there is an error in loading.
     * @param {string} dataType Type of data, currently either "xml" if vast fails to load and "script" if it loads
     * successfully.
     * @param {object} loadingAd The current Ad metadata that is being loaded.
     */
    this._ajax = function(url, errorCallback, dataType, loadingAd) {
      $.ajax({
        url: OO.getNormalizedTagUrl(url, this.embedCode),
        type: 'GET',
        beforeSend: function(xhr) {
          xhr.withCredentials = true;
        },
        dataType: dataType,
        crossDomain: true,
        cache:false,
        success: (dataType == 'script') ? function() {} : _.bind(this._onVastResponse, this, loadingAd
          || this.currentAdBeingLoaded),
        error: _.bind(errorCallback, this, loadingAd || this.currentAdBeingLoaded)
      });
      this.currentAdBeingLoaded = null;
    };

    /**
     * If the Ad failed to load, then the Vast manager will try to load the Ad again. This time it will create a new url
     * using a proxy url, if one is set in the player params, attach an encoded original url as a parameter, then
     * it will return the new Url to be used. If a proxy url was not provided then one is created and returned.
     * @public
     * @method VPaid#_getProxyUrl
     * @returns {string} the proxy url with all the data and encoding that is necessary to make it able to be used for loading.
     */
    this._getProxyUrl = function() {
      OO.publicApi = OO.publicApi || {};
      OO.publicApi[this.loaderId()] = _.bind(this._onVastProxyResult, this);
      if (OO.playerParams.vast_proxy_url) {
        return [OO.playerParams.vast_proxy_url, '?callback=OO.', this.loaderId, '&tag_url=',
            encodeURI(this.vastUrl), '&embed_code=', this.embedCode].join('');
      }
      return OO.URLS.VAST_PROXY({
          cb: 'OO.' + this.loaderId,
          embedCode: this.embedCode,
          expires: (new Date()).getTime() + 1000,
          tagUrl: encodeURI(this.vastUrl)
      });
    };

    /**
     * If using the proxy url doesn't fail, then we parse the data into xml and call the vastResponse callback.
     * @public
     * @method VPaid#_onVastProxyResult
     * @param {string} value The new proxy url to use and try to load the ad again with.
     */
    this._onVastProxyResult = function(value) {
      var xml = $.parseXML(value);
      this._onVastResponse(this.currentAdBeingLoaded, xml);
    };

   /**
     *  If the Ad fails to load this callback is called. It will try to load again using a proxy url.
     *  @public
     *  @method VPaid#_onVastError
     */
    this._onVastError = function() {
      OO.log('VPaid: Direct Ajax Failed Error');
      this._ajax(this._getProxyUrl(), this._onFinalError, 'script');
    };

    /**
     * If the ad fails to load a second time, this callback is called and triggers an error message, but doesn't try to
     * reload the ad.
     * @public
     * @method VPaid#_onFinalError
     */
    this._onFinalError = function() {
      OO.log('VPaid: Proxy Ajax Failed Error');
      failedAd();
    };

    /**
     * Called by Ad Manager Controller.  The ad manager should destroy itself.  It will be unregistered by
     * the Ad Manager Controller.
     * @method VPaid#destroy
     * @public
     */
    this.destroy = function() {
      // Stop any running ads
      this.cancelAd();
      this.ready = false;
    };
  };

  return new VPaid();
});
