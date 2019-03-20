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
        "ignoreRegExpLiterals": true
      }
    ],
    "no-underscore-dangle": "warn",
    "vars-on-top": "warn",
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
    "block-scoped-var": "warn",
    "guard-for-in": "warn",
    "no-restricted-syntax": "warn",
    "default-case": "warn",
    "prefer-rest-params": "warn",
    "no-bitwise": "warn",
    "no-unreachable": "warn",
    "semi-style": "warn",
    "no-mixed-spaces-and-tabs": "warn",
    "no-tabs": "warn",
    "eqeqeq": "warn",
    "no-empty": "warn",
    "no-continue": "warn",
    "brace-style": "warn",
    "no-unused-expressions": "warn",
    "no-lonely-if": "warn",
    "prefer-spread": "warn",
    "operator-linebreak": "warn",
    "no-fallthrough": "warn",
    "no-mixed-operators": "warn",
    "no-loop-func": "warn",
    "no-case-declarations": "warn",
  },
};
