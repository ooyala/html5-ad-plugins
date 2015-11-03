UNIT_TESTS = test/unit-tests/*.js
REPORTER = tap
MOCHA_BIN = ./node_modules/.bin/mocha
MOCHA = ./node_modules/.bin/_mocha
UGLIFY_BIN = ./node_modules/.bin/uglifyjs

test:
	@NODE_ENV=test $(MOCHA_BIN) \
      --timeout 3500 \
      --require test/test_lib.js \
      --reporter $(REPORTER) \
      $(UNIT_TESTS)

test-debug:
	@NODE_ENV=test $(MOCHA_BIN) \
      --timeout 3500 \
      --require test/test_lib.js \
      --reporter $(REPORTER) \
      --debug --bail \
      $(UNIT_TESTS)

.PHONY: test
