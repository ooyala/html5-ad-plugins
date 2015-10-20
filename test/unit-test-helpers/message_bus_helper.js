(function(OO,_) {

  _.extend(OO.MessageBus.prototype,  {
    published: function(event) {
      var matches = _.filter(this._messageHistory, function(msg) { return msg[0] === 'publish' && msg[1] === event; }); 
      return _.rest(_.last(matches) || []);
    },
    
    __end_marker: true
  });

}(OO,OO._));

