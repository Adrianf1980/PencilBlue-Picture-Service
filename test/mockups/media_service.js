"use strict";

var catPicStreamService = require('./cat_pictures_stream_service');

module.exports = function PluginServiceModule() {
  var MediaService = function(){};

  MediaService.prototype.getContentStreamByPath = function(mediaPath, cb) {
  	var stream = catPicStreamService.getCatPicStream(mediaPath);
	cb(null, stream);
  };

  return MediaService;
};