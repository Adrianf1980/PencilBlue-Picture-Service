"use strict";

var util = require('util');
module.exports.getMockPB = function () {
  var pluginService = require('./plugin_service')();
  var mediaService = require('./media_service')();
  var pb = {
    log: {
      info: function () {},
      error: function () {},
      debug: function() {}
    },
    PluginService: pluginService,
    MediaService: mediaService,
    util : util
  };
  return pb;
};