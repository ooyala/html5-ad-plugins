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
    "no-underscore-dangle": "warn",
    "consistent-return": "warn",
    "no-undef": "warn",
    "no-redeclare": "warn",
    "camelcase": "warn",
    "prefer-destructuring": "warn",
    "no-shadow": "warn",
    "global-require": "warn",
    "import/no-dynamic-require": "warn",
    "no-prototype-builtins": "warn",
    "no-restricted-globals": "warn",
    "no-restricted-syntax": "warn",
    "prefer-rest-params": "warn",
  },
};
