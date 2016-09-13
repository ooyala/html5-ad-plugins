/*
 * Unit test class for the Vast Ad Manager
 * https://github.com/Automattic/expect.js
 */

var adManagerUtils = require("../../utils/ad_manager_utils.js");

describe('Ad Manager Utility Class:', function()
{

  it('Time Stamps Should Be Converted to Milliseconds', function()
  {
    var milliseconds;

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:00:00");
    expect(milliseconds).to.be(0);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:00:01");
    expect(milliseconds).to.be(1000);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:00:10");
    expect(milliseconds).to.be(10000);

    // accepts numbers greater than the typical HH:MM:SS maximums
    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:00:150");
    expect(milliseconds).to.be(150000);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:03:01");
    expect(milliseconds).to.be(181000);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:03:10");
    expect(milliseconds).to.be(190000);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:11:10");
    expect(milliseconds).to.be(670000);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:90:10");
    expect(milliseconds).to.be(5410000);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("01:00:01");
    expect(milliseconds).to.be(3601000);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("10:01:01");
    expect(milliseconds).to.be(36061000);

    // test negatives
    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("10:-01:00");
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("-10:00:00");
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("10:01:-01");
    expect(milliseconds).to.be(null);

    // -0 is valid
    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:01:-00");
    expect(milliseconds).to.be(60000);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:00");
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("00:00:00:00");
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds(":00:00");
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds("banana:00:00");
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds(":");
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds(0);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds(false);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds({});
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds(null);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertTimeStampToMilliseconds(undefined);
    expect(milliseconds).to.be(null);
  });

  it('Percents Should Be Converted to Milliseconds', function()
  {
    var milliseconds;

    milliseconds = adManagerUtils.convertPercentToMilliseconds("50%", 1);
    expect(milliseconds).to.be(500);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("1%", 1);
    expect(milliseconds).to.be(10);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("100%", 1);
    expect(milliseconds).to.be(1000);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("0%", 100);
    expect(milliseconds).to.be(0);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("75%", 100);
    expect(milliseconds).to.be(75000);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("0.25%", 100);
    expect(milliseconds).to.be(250);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("-75%", 100);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("-20%", 100);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("-0%", 100);
    expect(milliseconds).to.be(0);

    milliseconds = adManagerUtils.convertPercentToMilliseconds({}, 100);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds(null, null);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("100%", undefined);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds(undefined, 100);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds(null, 100);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds("100%", null);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds(false, null);
    expect(milliseconds).to.be(null);

    milliseconds = adManagerUtils.convertPercentToMilliseconds(false, 50);
    expect(milliseconds).to.be(null);
  });

});
