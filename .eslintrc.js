module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: 'airbnb-base',
  // TODO: delete when we go to jest.
  globals: {
    expect: 0,
    OO: 0,
    it: 0,
    describe: 0,
    _: 0,
    $: 0,
    after: 0,
    before: 0,
    beforeEach: 0,
    afterEach: 0,
    tv: 0,
    ActiveXObject: 0,
    startAfterLoad: 0,
    google: 0,
    TEST_ROOT: 0,
    COMMON_SRC_ROOT: 0,
    FakeAmc: 0,
    SRC_ROOT: 0,
    fwContext: 0,
    AdInstance: 0,
    getTemporalSlots: 0,
    fwParams: 0,
    setVideoAsset: 0,
    jsdom: 0,
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "max-len": [
      "error", 110,
      {
        "ignoreComments": true,
        "ignorePattern": "if \\(\/\\(\\w*|\\)\/",
        "ignoreUrls": true,
        "ignoreRegExpLiterals": true,
        "ignoreTemplateLiterals": true
      }
    ],
    "no-plusplus": [
      "error",
      {
        "allowForLoopAfterthoughts": true
      }
    ],
    "no-param-reassign": [
      "error",
      {
        "props": false
      }
    ],
    "vars-on-top": 0,
    "import/no-dynamic-require": "warn",
    "no-underscore-dangle": "warn",
    "camelcase": "warn",
    "no-shadow": "warn",
    "global-require": "warn",
    "no-prototype-builtins": "warn",
    "no-restricted-globals": "warn",
    "prefer-rest-params": "warn",
  },
};
