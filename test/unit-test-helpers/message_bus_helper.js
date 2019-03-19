const {
  extend,
  filter,
  rest,
  last,
} = require('underscore');

(function(OO) {

  extend(OO.MessageBus.prototype,  {
    published: function(event) {
      var matches = filter(this._messageHistory, function(msg) { return msg[0] === 'publish' && msg[1] === event; });
      return rest(last(matches) || []);
    },

    __end_marker: true
  });

}(OO));

