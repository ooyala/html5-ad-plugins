const {
  extend,
  filter,
  rest,
  last,
} = require('underscore');

(function (OO) {
  extend(OO.MessageBus.prototype, {
    // eslint-disable-next-line require-jsdoc
    published(event) {
      const matches = filter(this._messageHistory, msg => msg[0] === 'publish' && msg[1] === event);
      return rest(last(matches) || []);
    },

    __end_marker: true,
  });
}(OO));
