global.SRC_ROOT = '../../js/';
global.COMMON_SRC_ROOT = '../../html5-common/js/'
global.TEST_ROOT = '../../test/';
global.OO = { publicApi: {}, platform: 'MacIntel', os: {}, browser: { version:1, webkit:true }, TEST_TEST_TEST: true};

global.TestHelper = {
  runFileInThisContext: function(file_name) {
    fileContents = require("fs").readFileSync(require.resolve(file_name), "utf8");
    require("vm").runInThisContext(fileContents);
  }
}

global.jsdom = require("jsdom");
global.document = jsdom.jsdom("<html><head></head><body>howdy</body></html>");
global.window = document.createWindow();

// The function setTimeout from jsdom is not working, this overwrites the function with the function defined
// by node
global.window.setTimeout = setTimeout;
global.navigator = window.navigator;

global.expect = require('expect.js');

// a wrapper domparser simulating Mozilla DOMParser in the browser:
window.DOMParser = function() {};
require("../html5-common/js/utils/InitModules/InitOOUnderscore.js");

OO._.extend(window.DOMParser.prototype, {
  parseFromString: function(data, type) {
    return jsdom.jsdom(data, jsdom.level(3, 'core'));
  }
});
OO.log = console.log;
// In a browser environment, all of the properties of "window" (like navigator) are in the global scope:
OO._.extend(global, window);

require("../html5-common/js/utils/InitModules/InitOOJQuery.js"); //this needs to come after the extend(global, window) line above otherwise $ gets set to undefined.
require("../html5-common/js/utils/InitModules/InitOOHazmat.js");
require("../html5-common/js/utils/InitModules/InitOOPlayerParamsDefault.js");
