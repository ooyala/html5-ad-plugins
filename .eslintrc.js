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
    "vars-on-top": 0,
    "no-underscore-dangle": "warn",
    "no-use-before-define": "warn",
    "consistent-return": "warn",
    "no-undef": "warn",
    "no-unused-vars": "warn",
    "radix": "warn",
    "no-redeclare": "warn",
    "func-names": "warn",
    "camelcase": "warn",
    "no-plusplus": "warn",
    "new-cap": "warn",
    "prefer-destructuring": "warn",
    "no-shadow": "warn",
    "global-require": "warn",
    "import/no-dynamic-require": "warn",
    "no-param-reassign": "warn",
    "no-prototype-builtins": "warn",
    "no-restricted-globals": "warn",
    "no-restricted-syntax": "warn",
    "prefer-rest-params": "warn",
    "no-unreachable": "warn",
    "no-continue": "warn",
    "no-unused-expressions": "warn",
    "prefer-spread": "warn",
    "no-mixed-operators": "warn",
  },
};
