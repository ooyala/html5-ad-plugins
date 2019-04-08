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
    "func-names": 0,
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
    "no-underscore-dangle": 0,
    // "consistent-return": [
    //   "error", {
    //     "treatUndefinedAsUnspecified": false
    //   }
    // ],
    "require-jsdoc": [
      "error",
      {
      "require": {
        "FunctionDeclaration": true,
        "MethodDefinition": true,
        "ClassDeclaration": true,
        "ArrowFunctionExpression": true,
        "FunctionExpression": true
      }
    }],
    "valid-jsdoc": [
      "error",
      {
        "prefer": {
          "return": "returns"
        },
        "requireReturn": false
      }
    ],
  },
};
