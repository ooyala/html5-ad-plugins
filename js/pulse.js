/*
 * Pulse ad player ad manager
 *
 * version 4.3.3
 */

(function(_, $)
{

    var pulseAdManagers = {};

    OO.Ads.manager(function(_, $) {
        /**
         * @class PulseAdManager
         * @classDesc The Pulse Ad Manager class.
         * @public
         */
        var PulseAdManager = function() {
            this.name = "videoplaza-ads-manager";// mandatory to get the ad set info from Backlot
            this.ready = false; // Also mandatory so the player knows if the ad manager is ready
            this.sharedVideoElement = null;//element we will share with the player on iphone
            this._contentMetadata = {};
            this._requestSettings = {};
            this._pulseHost = null;
            this._isControllingVideo = false;
            this.ui = null;

            var session = null;
            var isWaitingForPrerolls = false;
            var isInAdMode = false;
            var waitingForContentPause = false;
            var podStarted = null;
            var isFullscreen = false;
            var adPlayer = null; // pulse ad player
            var showAdTitle = false;
            var preferredRenderingMode = null;
            var amc  = null;
            var pulseSDKUrl = "/proxy/pulse-sdk-html5/2.1/latest.min.js";
            var adModuleJsReady = false;

            /**
             * Ad manager init
             *
             * Register the event listeners for everything the ad player will need
             * @param adManagerController
             * @param playerId
             */
            this.initialize = function(adManagerController, playerId) {
                amc = adManagerController; // the AMC is how the code interacts with the player
                pulseAdManagers[playerId] = this;

                // Add any player event listeners now
                amc.addPlayerListener(amc.EVENTS.CONTENT_CHANGED, _.bind(_onContentChanged, this));
                amc.addPlayerListener(amc.EVENTS.INITIAL_PLAY_REQUESTED, _.bind(_onInitialPlay, this));
                amc.addPlayerListener(amc.EVENTS.PLAY_STARTED, _.bind(_onPlayStarted, this));
                amc.addPlayerListener(amc.EVENTS.CONTENT_COMPLETED, _.bind(_onContentFinished, this));
                amc.addPlayerListener(amc.EVENTS.SIZE_CHANGED, _.bind(_onSizeChanged, this));
                amc.addPlayerListener(amc.EVENTS.FULLSCREEN_CHANGED, _.bind(_onFullscreenChanged, this));
                amc.addPlayerListener(amc.EVENTS.REPLAY_REQUESTED, _.bind(_onReplay, this));
            };

            this.getAdPlayer = function() {
                return adPlayer;
            }

            /**
             * Called by the AMF when the UI is ready.
             */
            this.registerUi = function() {
                this.ui = amc.ui;

                if (amc.ui.useSingleVideoElement && !this.sharedVideoElement && amc.ui.ooyalaVideoElement[0] &&
                    (amc.ui.ooyalaVideoElement[0].className === "video")) {
                    this.sharedVideoElement = this.ui.ooyalaVideoElement[0];
                }
            }


            function mergeCommaSeparatedListsBase(a, b){
                if(a){
                    if(b){
                        return a +"," + b;
                    }    else{
                        return a;
                    }
                } else {
                    return b;
                }
            }

            function removeUndefinedElements(args){
                var retArray = []
                for(var i = 0, n = args.length; i < n; i++){
                    if(args[i]){
                        retArray.push(args[i]);
                    }
                }
                return retArray;
            }

            function mergeCommaSeparatedStrings(){
                //Remove the undefined element first
                var params = removeUndefinedElements(arguments);
                var argsLentgh = params.length;

                switch (argsLentgh){
                    case 0:
                        return undefined;
                        break;
                    case 1:
                        return params[0];
                        break;
                    case 2:
                        return mergeCommaSeparatedListsBase(params[0], params[1]);
                        break;
                    default:
                        return mergeCommaSeparatedListsBase(params.shift(), mergeCommaSeparatedStrings(params));
                        break;
                }
            }

            function getInsertionPointTypeFromAdPosition(position){
                var PREROLL = 1;
                var INSTREAM = 2;
                var POSTROLL = 4;

                var pos = parseInt(position);
                var insertPointFiler = [];

                if(pos & PREROLL){
                    insertPointFiler.push("onBeforeContent");
                }
                if(pos & INSTREAM){
                    insertPointFiler.push("playbackPosition");
                    insertPointFiler.push("playbackTime");
                }
                if(pos & POSTROLL){
                    insertPointFiler.push("onContentEnd");
                }

                return (insertPointFiler.length !== 0 ? insertPointFiler.join(",") : null);
            }

            function safeSplit(array, char){
                if(array){
                    return array.split(char)
                } else {
                    return null;
                }
            }

            function safeMap(array, func){
                if(array){
                    return array.map(func);
                } else {
                    return null;
                }
            }

            function cleanObject(obj){
                for (var prop in obj){
                    if(obj[prop] === null || obj[prop] === undefined){
                        delete  obj[prop];
                    }
                }
            }

            function safeParseInt(string){
                var val = parseInt(string);
                if(!val || isNaN(val)){
                    return null;
                } else {
                    return val;
                }
            }

            function getFlashVersion() {
                // ie
                try
                {
                    try
                    {
                        var axo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash.6');
                        try
                        {
                            axo.AllowScriptAccess = 'always';
                        }
                        catch(e)
                        {
                            return '6,0,0';
                        }
                    }
                    catch(e) {}
                    return new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version').replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];
                    // other browsers
                }
                catch(e) {
                    try
                    {
                        if (navigator.mimeTypes["application/x-shockwave-flash"].enabledPlugin) {
                            return (navigator.plugins["Shockwave Flash 2.0"] || navigator.plugins["Shockwave Flash"]).description.replace(/\D+/g, ",").match(/^,?(.+),?$/)[1];
                        }
                    }
                    catch(e) {}
                }
                return '0,0,0';
            }

            function getByPriority(){
                for (var i = 0,n = arguments.length; i < n; i++){
                    if(arguments[i] || arguments[i] === ""){
                        return arguments[i];
                    }
                }
                //If none of the passed objects exist
                return null;
            }

            function getProtocolFromPulseHost(host){
                if(host.indexOf("https") === 0){ //Then it starts with https
                    return "https://"
                } else {
                    return "http://"
                }
            }

            function getPulseAccount(host){
                var regEx = /(?:https?:\/\/)?(.*)\/?/;
                return host.match(regEx)[1];

            }

            function getCategoryFromPlayerLevelShares(shares){
                //Category is the first element
                var values = safeSplit(shares,",");
                if(values && values.length !== 0){
                    return values[0];
                }
            }

            function getContentPartnerFromPlayerLevelShares(shares){
                //Category is the first element
                var values = safeSplit(shares,",");
                if(values && values.length === 2){
                    return values[1];
                }
            }

            /**
             * Called by Ad Manager Controller.  When this function is called, all movie and server metadata are
             * ready to be parsed.
             * This metadata may contain the adTagUrl and other ad manager and movie specific configuration.
             * @method AdManager#loadMetadata
             * @public
             * @param {object} adManagerMetadata Ad manager-specific metadata
             * @param {object} backlotBaseMetadata Base metadata from Ooyala Backlot
             * @param {object} movieMetadata Metadata for the main video
             */
            this.loadMetadata = function(adManagerMetadata, backlotBaseMetadata, movieMetadata) {
                this.ready = true;
                preferredRenderingMode = adManagerMetadata.pulse_rendering_mode || "HTML5_FIRST" ;
                var protocol, pulse_account_name;
                this._pulseHost = adManagerMetadata.pulse_host ||backlotBaseMetadata.pulse_host || backlotBaseMetadata.vpHost|| adManagerMetadata.vpDomain;
                this._deviceContainer = adManagerMetadata.pulse_device_container;
                this._persistentId = adManagerMetadata.pulse_persistent_id;
                showAdTitle = adManagerMetadata.pulse_show_ad_title || false;
                protocol = getProtocolFromPulseHost(this._pulseHost);
                pulse_account_name = getPulseAccount(this._pulseHost);

                //Load the Pulse SDK if not already included
                if(!OO.Pulse){
                    amc.loadAdModule(this.name, protocol + pulse_account_name + pulseSDKUrl, _.bind(function(success) {
                        adModuleJsReady = success;
                        if(isWaitingForPrerolls){
                            _onInitialPlay.call(this);
                        }
                    }, this));
                } else {
                    adModuleJsReady = true;
                    if(isWaitingForPrerolls){
                        _onInitialPlay.call(this);
                    }
                }



                //The request settings and content metadata are going to be assembled progressively here

                //First we fill the integration-only metadata
                this._requestSettings = {
                    height:   adManagerMetadata.pulse_height,
                    width:   adManagerMetadata.pulse_width,
                    maxBitRate:   adManagerMetadata.pulse_max_bitrate
                };

                //Then the parameters that always overriden by the custom metadata or the integration metadata are set
                this._contentMetadata.category = getByPriority(
                    adManagerMetadata.pulse_category ,
                    backlotBaseMetadata.pulse_category ,
                    backlotBaseMetadata.vpCategory ,
                    getCategoryFromPlayerLevelShares(adManagerMetadata.playerLevelShares) ,
                    adManagerMetadata.category);

                this._contentMetadata.contentForm = getByPriority(
                    adManagerMetadata.pulse_content_form,
                    backlotBaseMetadata.pulse_content_form,
                    (movieMetadata.duration/1000 > adManagerMetadata.longFormLimit  ? 'longForm' : 'shortForm'));

                this._contentMetadata.contentPartner = getByPriority(
                    adManagerMetadata.pulse_content_partner,
                    backlotBaseMetadata.pulse_content_partner,
                    getContentPartnerFromPlayerLevelShares(adManagerMetadata.playerLevelShares));

                this._requestSettings.referrerUrl = getByPriority(
                    adManagerMetadata.pulse_referrer_url,
                    backlotBaseMetadata.pulse_referrer_url);

                this._requestSettings.linearSlotSize = getByPriority(
                    adManagerMetadata.pulse_linear_slot_size,
                    safeParseInt(backlotBaseMetadata.pulse_linear_slot_size));

                this._contentMetadata.id = getByPriority(
                    adManagerMetadata.pulse_content_id,
                    backlotBaseMetadata.pulse_content_id,
                    adManagerMetadata.embedCode);

                this._contentMetadata.duration  =getByPriority(
                    adManagerMetadata.pulse_duration,
                    safeParseInt(backlotBaseMetadata.pulse_duration),
                    movieMetadata.duration /1000);

                this._contentMetadata.customParameters = adManagerMetadata.pulse_custom_parameters;

                this._requestSettings.vptpTicketData =  adManagerMetadata.pulse_vptp_data;

                this._requestSettings.linearPlaybackPositions =
                    safeMap(safeSplit(getByPriority(adManagerMetadata.pulse_linear_cuepoints,
                        backlotBaseMetadata.pulse_linear_cuepoints,
                        backlotBaseMetadata.cuepoints,
                        adManagerMetadata.playerLevelCuePoints),","), Number) ;

                this._requestSettings.nonlinearPlaybackPositions =
                    safeMap(safeSplit(getByPriority(adManagerMetadata.pulse_non_linear_cuepoints,
                        backlotBaseMetadata.pulse_non_linear_cuepoints,
                        adManagerMetadata.nonLinearAdBreaks),","),Number);

                if(adManagerMetadata.all_ads) {
                    this._requestSettings.insertionPointFilter =
                        safeSplit(getByPriority(adManagerMetadata.pulse_insertion_point_filter ||
                            backlotBaseMetadata.pulse_insertion_point_filter ||
                            getInsertionPointTypeFromAdPosition(adManagerMetadata.all_ads[0].position)), ",");
                } else {
                    this._requestSettings.insertionPointFilter =
                        safeSplit(getByPriority(adManagerMetadata.pulse_insertion_point_filter,
                            backlotBaseMetadata.pulse_insertion_point_filter), ",");
                }
                //If pulse_override_metadata is true, the integration metadata will be given priority over the backlot ad set and custom metadata
                if(adManagerMetadata.pulse_override_metadata){
                    this._contentMetadata.flags =
                        safeSplit(getByPriority(adManagerMetadata.pulse_flags,
                            backlotBaseMetadata.pulse_flags,
                            adManagerMetadata.playerLevelFlags),",");

                    this._contentMetadata.tags =
                        safeSplit(getByPriority(adManagerMetadata.pulse_tags,
                            backlotBaseMetadata.pulse_tags,
                            backlotBaseMetadata.vpTags,
                            adManagerMetadata.playerLevelTags), ",");

                }else {
                    this._contentMetadata.flags = safeSplit(mergeCommaSeparatedStrings(
                        adManagerMetadata.pulse_flags,
                        backlotBaseMetadata.pulse_flags,
                        adManagerMetadata.playerLevelFlags), ",");

                    this._contentMetadata.tags = safeSplit(mergeCommaSeparatedStrings(
                        adManagerMetadata.pulse_tags,
                        backlotBaseMetadata.pulse_tags,
                        backlotBaseMetadata.vpTags,
                        adManagerMetadata.playerLevelTags), ",");
                }

                //Due to some SDK bugs?, remove all the undefined or null properties from the request objects
                cleanObject(this._contentMetadata);
                cleanObject(this._requestSettings);
            };

            /**
             * Mandatory method. We just return a placeholder ad that will prevent the content from starting. It will allow
             * the SDK to start the session and return if actual ads are present or not
             * @returns {array}
             */
            this.buildTimeline = function() {
                return [ makePlaceholderAd.call(this,"adRequest", 0)];
                //return [ ];
            };

            function makePlaceholderAd(type,position){
                var streams = {};
                streams[OO.VIDEO.ENCODING.IMA] = "";
                return new amc.Ad({
                    position: position,
                    duration: 42,
                    adManager: this.name,
                    ad: {type: type, placeholder : true},
                    streams: streams,
                    adType: amc.ADTYPE.LINEAR_VIDEO
                })
            }


            /**
             * Mandatory method. Called by the AMF when an ad play has been requested
             * @param v4ad
             */
            this.playAd = function(v4ad) {
                podStarted = v4ad.id;
                isInAdMode = true;
                this._isInPlayAd = true;

                if(adPlayer){
                    adPlayer.contentPaused();
                }

                if(this._mustExitAdMode){
                    this._mustExitAdMode = false;
                    this.notifyAdPodEnded();

                    if(adPlayer){
                        adPlayer.contentStarted();
                    }
                    amc.addPlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onMainVideoTimeUpdate);
                }
            };

            /**
             * When an ad is camceled
             * @param ad v4ad
             * @param params error code
             */
            this.cancelAd = function(ad,params) {
                //Only skip can happen
                if(params.code === "skipped") {
                    adPlayer.skipButtonClicked();
                } else {
                    if(session){
                        session.stopAdBreak();
                    }
                }
            };

            /**
             * Pause the ad player
             * @param ad v4 ad
             */
            this.pauseAd = function(ad) {
                if(adPlayer){
                    adPlayer.pause();
                }

            };

            /**
             * Resume the v4ad
             * @param ad
             */
            this.resumeAd = function(ad) {
                if(adPlayer){
                    adPlayer.play();
                }

            };

            /**
             * <i>Optional.</i><br/>
             * Called when player clicks on the tap frame, if tap frame is disabled, then this function will not be
             * called
             * @method AdManager#playerClicked
             * @public
             */
            this.playerClicked = function(amcAd, showPage) {
                var clickThroughURL = this._currentAd.getClickthroughURL();
                if(clickThroughURL){
                    this.openClickThrough(clickThroughURL);
                }
            };

            /**
             * Called by Ad Manager Controller.  The ad manager should destroy itself.  It will be unregistered by
             * the Ad Manager Controller.
             * @method AdManager#destroy
             * @public
             */
            this.destroy = function() {
                // Stop any running ads
                if(adPlayer){
                    adPlayer.destroy();
                }
            };

            this.registerVideoControllerWrapper = function(videoPlugin)
            {
                this.videoControllerWrapper = videoPlugin;
            }

            var _onContentChanged = function() {
                //Not needed rn
            };

            this.notifyAdPodStarted = function(id, adCount){
                if(!podStarted) {
                    podStarted = id;
                }
                amc.notifyPodStarted(podStarted, adCount);
            }

            this.notifyAdPodEnded = function(){
                var podEndedId = podStarted;
                podStarted = null;
                amc.notifyPodEnded(podEndedId);
            }

            this.startContentPlayback = function() {
                isWaitingForPrerolls = false;

                if(isInAdMode){
                    this.notifyAdPodEnded();
                    if(adPlayer){
                        adPlayer.contentStarted();
                    }

                    isInAdMode = false;
                    amc.addPlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onMainVideoTimeUpdate);
                } else {
                    //This happens if the change to ad mode hasn't been done yet.
                    //Raise a flag that will be read when entering ad mode
                    this._mustExitAdMode = true;
                }
            };

            this.pauseContentPlayback = function () {
                //ui.ooyalaVideoElement.off("timeupdate",_onMainVideoTimeUpdate);
                amc.removePlayerListener(amc.EVENTS.PLAYHEAD_TIME_CHANGED, _onMainVideoTimeUpdate);

                if(!isWaitingForPrerolls)
                {
                    setTimeout(playPlaceholder,1);
                }

                if(this.ui.useSingleVideoElement && !this._isControllingVideo){
                    waitingForContentPause = true;

                }

                if(isInAdMode || (isWaitingForPrerolls && ! this.ui.useSingleVideoElement)){
                    return true;
                }
                return false;
            };

            this.illegalOperationOccurred = function(msg) {
                //console.log(msg);
            };
            this.sessionEnded = function () {
                amc.adManagerDoneControllingAds();
            };

            this.openClickThrough = function(url){
                window.open(url);
                if(adPlayer){
                    adPlayer.adClickThroughOpened();
                }

            }
            var playPlaceholder = _.bind(function () {
                var streams = {};
                streams[OO.VIDEO.ENCODING.IMA] = "";
                amc.forceAdToPlay(this.name,
                    {placeholder: true }
                    , amc.ADTYPE.LINEAR_VIDEO, streams)
            }, this);


            var _onMainVideoTimeUpdate = _.bind(function (event,playheadTime, duration){
                if(adPlayer)
                    adPlayer.contentPositionChanged(playheadTime);
            }, this);

            var _onPlayStarted = function() {
                if(adPlayer)
                    adPlayer.contentStarted();
            };

            var _onContentFinished = function(){
                this._contentFinished = true;
                if(adPlayer)
                    adPlayer.contentFinished();
            };

            var _onFullscreenChanged = function(event, shouldEnterFullscreen)
            {
                isFullscreen = shouldEnterFullscreen;
                _onSizeChanged();
            };

            var _onReplay = function(){
                this._contentFinished = false;
                _onInitialPlay.call(this);
            };

            var _onSizeChanged = function(event, width, height) {
                if(adPlayer) {
                    adPlayer.resize(-1,
                        -1, isFullscreen);
                    setTimeout(function(){
                        adPlayer.resize(-1,
                            -1, isFullscreen);
                    },500);
                }
            };

            this.tryInitAdPlayer = function(){
                var flashVersion = getFlashVersion().split(',').shift();

                if(this.ui && adModuleJsReady) {

                    if (!adPlayer) {
                        var renderingMode = flashVersion >=11 ? OO.Pulse.AdPlayer.Settings.RenderingMode.HTML5_FIRST : OO.Pulse.AdPlayer.Settings.RenderingMode.HTML5_ONLY;
                        OO.Pulse.setPulseHost(this._pulseHost, this._deviceContainer, this._persistentId);
                        adPlayer = OO.Pulse.createAdPlayer(amc.ui.playerSkinPluginsElement ? amc.ui.playerSkinPluginsElement[0] : amc.ui.pluginsElement[0],
                            {
                                VPAIDViewMode: OO.Pulse.AdPlayer.Settings.VPAIDViewMode.NORMAL,
                                renderingMode: preferredRenderingMode || renderingMode
                            }, this.sharedVideoElement);

                        //We register all the event listeners we will need
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_BREAK_FINISHED, _.bind(_onAdBreakFinished,this));
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_BREAK_STARTED, _.bind(_onAdBreakStarted,this));
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_FINISHED, _.bind(_onAdFinished,this));
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_SKIPPED, _.bind(_onAdSkipped,this));
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_STARTED, _.bind(_onAdStarted,this));
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_PROGRESS, _.bind(_onAdTimeUpdate,this));
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.AD_CLICKED, _.bind(_onAdClicked,this));
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_PAUSED, _.bind(_onAdPaused,this));
                        adPlayer.addEventListener(OO.Pulse.AdPlayer.Events.LINEAR_AD_PLAYING, _.bind(_onAdPlaying,this));
                    }
                }
            };


            var _onInitialPlay = function() {
                isWaitingForPrerolls = true;
                amc.adManagerWillControlAds();
                if(adModuleJsReady){
                    if(!adPlayer){
                        this.tryInitAdPlayer();
                    }
                    OO.Pulse.setLogListener(function(logItem) {
                        // //console.log('> ' + logItem.source + ': ' + logItem.message);
                    });
                    session = OO.Pulse.createSession(this._contentMetadata, this._requestSettings);
                    //We start the Pulse session
                    if(adPlayer){
                        adPlayer.startSession(session, this);
                    }

                }
            };

            var _onAdFinished = function(){
                amc.notifyLinearAdEnded(1);
            };

            var _onAdSkipped = function(){
                amc.notifyLinearAdEnded(1);
            };

            var _onAdBreakFinished = function(){
                this._currentAdBreak = null;
                this.notifyAdPodEnded();
            };

            var _onAdBreakStarted = function(event,eventData) {
                adPlayer.resize(-1,
                    -1, isFullscreen);
                this._currentAdBreak = eventData.adBreak;
                this.notifyAdPodStarted(this._adBreakId,this._currentAdBreak.getPlayableAdsTotal());

            };

            var _onAdClicked = function (event,eventData) {
                this.videoControllerWrapper.togglePlayPause();
            };
            var _onAdPaused = function(event,metadata){
                this.videoControllerWrapper.raisePauseEvent();
            }

            var _onAdPlaying = function(event,metadata){
                this.videoControllerWrapper.raisePlayingEvent();
            }
            var _onAdTimeUpdate = function(event, eventData) {

                var duration = eventData.duration ? eventData.duration :this.currentAd.getCoreAd().creatives[0].duration;
                this.videoControllerWrapper.raiseTimeUpdate(eventData.position, duration);
            };

            var _onAdStarted = function(event, eventData) {
                this._currentAd = eventData.ad;

                var clickThroughURL =  this._currentAd.getClickthroughURL();
                var skipOffset = this._currentAd.getSkipOffset();
                var name = null;

                if(this._showAdTitle){
                    name = this._currentAd.getCoreAd().title;
                }

                amc.notifyLinearAdStarted(1,
                    {duration: this._currentAd.getCoreAd().creatives[0].duration,
                        name: name,
                        indexInPod: eventData.adPosition,
                        skippable:this._currentAd.isSkippable(),
                        hasClickUrl: clickThroughURL ? true : false});

                if(this._currentAd.isSkippable()) {
                    amc.showSkipVideoAdButton(true, skipOffset.toString());
                }
                else {
                    amc.showSkipVideoAdButton(false);
                }
                adPlayer.resize(-1,
                    -1, isFullscreen);
            };
        }
        return new PulseAdManager();
    });

    //Pulse Video plugin
    var PulsePlayerFactory = function() {
        this.adManager = {};
        this.name = "PulseVideoTech";
        this.encodings = [OO.VIDEO.ENCODING.IMA];
        this.features = [OO.VIDEO.FEATURE.VIDEO_OBJECT_SHARING_TAKE];
        this.technology = OO.VIDEO.TECHNOLOGY.HTML5 ;
        this.ready = true;

        /**
         * Creates a video player instance using PulseVideoWrapper.
         * @public
         * @method TemplateVideoFactory#create
         * @param {object} parentContainer The jquery div that should act as the parent for the video element
         * @param {string} domId The dom id of the video player instance to create
         * @param {object} ooyalaVideoController A reference to the video controller in the Ooyala player
         * @param {object} css The css to apply to the video element
         * @param {string} playerId The unique player identifier of the player creating this instance
         * @returns {object} A reference to the wrapper for the newly created element
         */
        this.create = function(parentContainer, domId, ooyalaVideoController, css, playerId) {
            var pulseAdManager = pulseAdManagers[playerId];
            var wrapper = new PulseVideoWrapper(pulseAdManager);
            wrapper.controller = ooyalaVideoController;
            wrapper.subscribeAllEvents();
            return wrapper;
        };

        this.createFromExisting = function(domId, ooyalaVideoController, playerId)
        {
            var pulseAdManager = pulseAdManagers[playerId];
            var wrapper = new PulseVideoWrapper(pulseAdManager);

            pulseAdManager.sharedVideoElement = $("#" + domId)[0];
            wrapper.controller = ooyalaVideoController;
            wrapper.subscribeAllEvents();

            return wrapper;
        };
        /**
         * Destroys the video technology factory.
         * @public
         * @method TemplateVideoFactory#destroy
         */
        this.destroy = function() {
            this.encodings = [];
            this.create = function() {};
        };

        /**
         * Represents the max number of support instances of video elements that can be supported on the
         * current platform. -1 implies no limit.
         * @public
         * @property TemplateVideoFactory#maxSupportedElements
         */
        this.maxSupportedElements = -1;

    };


    var PulseVideoWrapper = function(adManager) {
        var _adManager = adManager;

        this.controller = {};
        this.isPlaying = false;

        /************************************************************************************/
        // Required. Methods that Video Controller, Destroy, or Factory call
        /************************************************************************************/

        /**
         * Hands control of the video element off to another plugin.
         * This function is only needed if the feature OO.VIDEO.FEATURE.VIDEO_OBJECT_GIVE or
         * OO.VIDEO.FEATURE.VIDEO_OBJECT_TAKE is supported.
         * @public
         * @method PulseVideoWrapper#sharedElementGive
         */
        this.sharedElementGive = function() {
            setTimeout(function(){
                _adManager.sharedVideoElement.style.display = "block";
                _adManager.sharedVideoElement.play();
            }, 100);
            _adManager.sharedVideoElement.style.visibility ="hidden";
            _adManager._isControllingVideo = false;
        };

        /**
         * Takes control of the video element from another plugin.
         * This function is only needed if the feature OO.VIDEO.FEATURE.VIDEO_OBJECT_GIVE or
         * OO.VIDEO.FEATURE.VIDEO_OBJECT_TAKE is supported.
         * @public
         * @method PulseVideoWrapper#sharedElementTake
         */
        this.sharedElementTake = function() {
            _adManager.sharedVideoElement.crossorigin = null;
            _adManager._isControllingVideo = true;
            _adManager.sharedVideoElement.style.visibility ="visible";
            if(_adManager && _adManager._waitingForContentPause) {
                _adManager._waitingForContentPause = false;
            }
        };

        /**
         * Subscribes to all events raised by the video element.
         * This is called by the Factory during creation.
         * @public
         * @method PulseVideoWrapper#subscribeAllEvents
         */
        this.subscribeAllEvents = function() {
            _adManager.registerVideoControllerWrapper(this);
        };

        /**
         * Unsubscribes all events from the video element.
         * This function is not required but can be called by the destroy function.
         * @private
         * @method PulseVideoWrapper#unsubscribeAllEvents
         */
        var unsubscribeAllEvents = _.bind(function() {

        }, this);

        /**
         * Sets the url of the video.
         * @public
         * @method PulseVideoWrapper#setVideoUrl
         * @param {string} url The new url to insert into the video element's src attribute
         * @param {string} encoding The encoding of video stream, possible values are found in OO.VIDEO.ENCODING (unused here)
         * @param {boolean} live True if it is a live asset, false otherwise (unused here)
         * @returns {boolean} True or false indicating success
         */
        this.setVideoUrl = function(url) {
            return true;
        };

        /**
         * Loads the current stream url in the video element; the element should be left paused.  This function
         * is generally called when preloading a stream before triggering play.  Load may not be called before
         * play.
         * @public
         * @method PulseVideoWrapper#load
         * @param {boolean} rewind True if the stream should be setup to play as if from the beginning.  When
         *   true, if initial time has not been set, or if the stream has already been played, set the stream
         *   position to 0.
         */
        this.load = function(rewind) {
        };

        /**
         * Sets the initial time of the video playback.  This value should not be used on replay.
         * @public
         * @method PulseVideoWrapper#setInitialTime
         * @param {number} initialTime The initial time of the video (seconds)
         */
        this.setInitialTime = function(initialTime) {
        };


        this.togglePlayPause = function(){
            if(this.isPlaying)
                this.pause();
            else
                this.play();
        }
        /**
         * Triggers playback on the video element.  If the 'load' function was not already called and the stream
         * is not loaded, trigger a load now.
         * @public
         * @method PulseVideoWrapper#play
         */
        this.play = function() {
            if(_adManager) {
                _adManager.resumeAd();
                this.isPlaying = true;
                this.raisePlayingEvent();
            }
        };


        /**
         * Triggers a pause on the video element.
         * @public
         * @method PulseVideoWrapper#pause
         */
        this.pause = function() {
            if(_adManager) {
                _adManager.pauseAd();
                this.isPlaying = false;
                this.raisePauseEvent();
            }
        };

        /**
         * Triggers a seek on the video element.
         * @public
         * @method PulseVideoWrapper#seek
         * @param {number} time The time to seek the video to (in seconds)
         */
        this.seek = function(time) {
            if(_adManager && _adManager.getAdPlayer()) {
                _adManager.getAdPlayer().seek(time);
            }
        };

        /**
         * Triggers a volume change on the video element.
         * @public
         * @method PulseVideoWrapper#setVolume
         * @param {number} volume A number between 0 and 1 indicating the desired volume percentage
         */
        this.setVolume = function(volume) {
            if(_adManager && _adManager.getAdPlayer()) {
                _adManager.getAdPlayer().setVolume(volume);
            }
        };

        /**
         * Gets the current time position of the video.
         * @public
         * @method PulseVideoWrapper#getCurrentTime
         * @returns {number} The current time position of the video (seconds)
         */
        this.getCurrentTime = function() {
        };

        /**
         * Applies the given css to the video element.
         * @public
         * @method PulseVideoWrapper#applyCss
         * @param {object} css The css to apply in key value pairs
         */
        this.applyCss = function(css) {
            if(_adManager.sharedVideoElement){
                $(_adManager.sharedVideoElement).css(css);
            }
        };

        /**
         * Destroys the individual video element.
         * @public
         * @method PulseVideoWrapper#destroy
         */
        this.destroy = function() {
            // Pause the video
            // Reset the source
            // Unsubscribe all events
            unsubscribeAllEvents();
            // Remove the element
        };

        /**
         * Sets the closed captions on the video element.
         * @public
         * @method PulseVideoWrapper#setClosedCaptions
         * @param {string} language The language of the closed captions. Set to null to remove captions.
         * @param {object} closedCaptions The closedCaptions object
         * @param {object} params The params to set with closed captions
         */
        this.setClosedCaptions = function(language, closedCaptions, params) {
        };

        /**
         * Sets the closed captions mode on the video element.
         * @public
         * @method PulseVideoWrapper#setClosedCaptionsMode
         * @param {string} mode The mode to set the text tracks element. One of ("disabled", "hidden", "showing").
         */
        this.setClosedCaptionsMode = function(mode) {
        };

        /**
         * Sets the crossorigin attribute on the video element.
         * @public
         * @method PulseVideoWrapper#setCrossorigin
         * @param {string} crossorigin The value to set the crossorigin attribute.
         */
        this.setCrossorigin = function(crossorigin) {
        };

        // **********************************************************************************/
        // Example callback methods
        // **********************************************************************************/

        this.raisePlayEvent = function(event) {
            this.controller.notify(this.controller.EVENTS.PLAY, { url: event.target.src });
        };

        this.raisePlayingEvent = function() {
            this.controller.notify(this.controller.EVENTS.PLAYING);
        };

        this.raiseEndedEvent = function() {
            this.controller.notify(this.controller.EVENTS.ENDED);
        };

        this.raiseErrorEvent = function(event) {
            var code = event.target.error ? event.target.error.code : -1;
            this.controller.notify(this.controller.EVENTS.ERROR, { "errorcode" : code });
        };

        this.raiseSeekingEvent = function() {
            this.controller.notify(this.controller.EVENTS.SEEKING);
        };

        this.raiseSeekedEvent = function() {
            this.controller.notify(this.controller.EVENTS.SEEKED);
        };

        this.raisePauseEvent = function() {
            this.controller.notify(this.controller.EVENTS.PAUSED);
        };

        this.raiseRatechangeEvent = function() {
            this.controller.notify(this.controller.EVENTS.RATE_CHANGE);
        };

        this.raiseStalledEvent = function() {
            this.controller.notify(this.controller.EVENTS.STALLED);
        };

        this.raiseVolumeEvent = function(event) {
            this.controller.notify(this.controller.EVENTS.VOLUME_CHANGE, { "volume" : event.target.volume });
        };

        this.raiseWaitingEvent = function() {
            this.controller.notify(this.controller.EVENTS.WAITING);
        };

        this.raiseTimeUpdate = function(position, duration) {

            this.controller.notify(this.controller.EVENTS.TIME_UPDATE,
                { "currentTime" : position,
                    "duration" : duration,
                    "buffer" : duration,
                    "seekRange" : { "begin" : 0, "end" : 10 } });
        };

        this.raiseDurationChange = function(event) {
            this.raisePlayhead(this.controller.EVENTS.DURATION_CHANGE, event);
        };

        this.raisePlayhead = _.bind(function(eventname, event) {
            this.controller.notify(eventname,
                { "currentTime" : event.target.currentTime,
                    "duration" : event.target.duration,
                    "buffer" : 10,
                    "seekRange" : { "begin" : 0, "end" : 10 } });
        }, this);

        this.raiseProgress = function(event) {
            this.controller.notify(this.controller.EVENTS.PROGRESS,
                { "currentTime": event.target.currentTime,
                    "duration": event.target.duration,
                    "buffer": 10,
                    "seekRange": { "begin": 0, "end": 10 } });
        };

        this.raiseCanPlayThrough = function() {
            this.controller.notify(this.controller.EVENTS.BUFFERED);
        };

        this.raiseFullScreenBegin = function(event) {
            this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                { "_isFullScreen" : true, "paused" : event.target.paused });
        };

        this.raiseFullScreenEnd = function(event) {
            this.controller.notify(this.controller.EVENTS.FULLSCREEN_CHANGED,
                { "_isFullScreen" : false, "paused" : event.target.paused });
        };
    };

    OO.Video.plugin(new PulsePlayerFactory());
}(OO._, OO.$));

