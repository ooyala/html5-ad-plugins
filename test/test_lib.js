global.SRC_ROOT = '../../js/';
global.COMMON_SRC_ROOT = '../../html5-common/js/';
global.TEST_ROOT = '../../test/';
global.OO = {
  publicApi: {}, platform: 'MacIntel', os: {}, browser: { version: 1, webkit: true }, TEST_TEST_TEST: true,
};

global.jsdom = require('jsdom');

const { JSDOM } = jsdom;
const dom = new JSDOM('<html><head></head><body>howdy</body></html>');
global.window = dom.window;
global.document = dom.window.document;

global.$ = require('jquery');

global.window.$ = global.$;
global.window.open = function () {};
global.expect = require('expect.js');
require('../html5-common/js/utils/InitModules/InitOOUnderscore.js');

global._ = window._;
require('../html5-common/js/utils/InitModules/InitOOHazmat.js');
require('../html5-common/js/utils/InitModules/InitOOPlayerParamsDefault.js');
