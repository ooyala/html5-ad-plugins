/*
 * Unit test class for the Vast Parser
 * https://github.com/Automattic/expect.js
 */
OO.log = () => {};
const fs = require('fs');
const VastParser = require('../../utils/vast_parser');


describe('VAST parser', () => {
  let vastParser;

  // TODO: test all VAST examples with snaphots
  /* eslint-disable max-len */
  const linearXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_linear.xml'), 'utf8');
  const linearXML2AdsString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_linear_2_ads.xml'), 'utf8');
  const nonLinearXMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_overlay.xml'), 'utf8');
  const wrapper1XMLString = fs.readFileSync(require.resolve('../unit-test-helpers/mock_responses/vast_wrapper_1.xml'), 'utf8');
  /* eslint-enable max-len */

  const linearXML = $.parseXML(linearXMLString);
  const linearXML2Ads = $.parseXML(linearXML2AdsString);
  const nonLinearXML = $.parseXML(nonLinearXMLString);
  const wrapper1XML = $.parseXML(wrapper1XMLString);

  const linearXMLParsed = require('../unit-test-helpers/vast_parsed/vast_linear.json');
  const linearXML2AdsParsed = require('../unit-test-helpers/vast_parsed/vast_linear_2_ads.json');
  const nonLinearXMLParsed = require('../unit-test-helpers/vast_parsed/vast_overlay.json');
  const wrapper1XMLParsed = require('../unit-test-helpers/vast_parsed/vast_wrapper_1.json');

  beforeEach(() => {
    vastParser = new VastParser();
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
    const result = vastParser.parser(linearXML2Ads);
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
    expect(vastParser.parser('asdf')).to.eql(null);
    expect(vastParser.parser(null)).to.eql(null);
  });
});
