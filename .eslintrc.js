module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: 'airbnb-base',
  globals: {

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
    "no-underscore-dangle": "warn", // 341
    "no-undef": "warn", // 2443 expect
    "camelcase": "warn",
    "no-shadow": "warn", // 18
    "global-require": "warn", // 15
    "no-prototype-builtins": "warn", // 14
    "no-restricted-globals": "warn", // 4
    // "no-restricted-syntax": "warn", // 6
    "prefer-rest-params": "warn", // 14
  },
};
