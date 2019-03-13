/*
 * Unit test class for the Vast Parser
 * https://github.com/Automattic/expect.js
 */
OO.log = () => {};
const VastParser = require('../../utils/vast_parser');

var fs = require("fs");

describe('VAST parser', () => {

  let vastParser;

  // TODO: test all VAST examples with snaphots
  var linearXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_linear.xml"), "utf8");
  var linearXML2AdsString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_linear_2_ads.xml"), "utf8");
  var nonLinearXMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_overlay.xml"), "utf8");
  var wrapper1XMLString = fs.readFileSync(require.resolve("../unit-test-helpers/mock_responses/vast_wrapper_1.xml"), "utf8");

  var linearXML = $.parseXML(linearXMLString);
  var linearXML2Ads = $.parseXML(linearXML2AdsString);
  var nonLinearXML = $.parseXML(nonLinearXMLString);
  var wrapper1XML = $.parseXML(wrapper1XMLString);

  var linearXMLParsed = require("../unit-test-helpers/vast_parsed/vast_linear.json");
  var linearXML2AdsParsed = require("../unit-test-helpers/vast_parsed/vast_linear_2_ads.json");
  var nonLinearXMLParsed = require("../unit-test-helpers/vast_parsed/vast_overlay.json");
  var wrapper1XMLParsed = require("../unit-test-helpers/vast_parsed/vast_wrapper_1.json");

  beforeEach(() => {
    vastParser = new VastParser()
  });

  //   ------   TESTS   ------

  it('should initialize VastParser without errors', () => {
    expect(vastParser).to.be.ok();
  });

  it('should parse linear vast xml', () => {
    const result = vastParser.parser(linearXML);
    expect(JSON.stringify(result)).to.eql(JSON.stringify(linearXMLParsed));
  });

  it('Vast 2.0: should play multiple ads if multiple ads are defined', () => {
    var result = vastParser.parser(linearXML2Ads);
    expect(JSON.stringify(result)).to.eql(JSON.stringify(linearXML2AdsParsed));
  });

  it('should parse non linear vast xml', () => {
    const result = vastParser.parser(nonLinearXML);
    expect(JSON.stringify(result)).to.eql(JSON.stringify(nonLinearXMLParsed));
  });

  it('should parse wrapper vast xml', () => {
    const result = vastParser.parser(wrapper1XML);
    expect(JSON.parse(JSON.stringify(result))).to.eql(wrapper1XMLParsed);
  });

  it('Should not fail with invalid VAST xml', () => {
    expect(vastParser.parser('asdf')).to.eql(null)
    expect(vastParser.parser(null)).to.eql(null)
  });

});
