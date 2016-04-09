"use strict";

var catPicStreamService = require('./cat_pictures_stream_service');
var streamBuffers = require('stream-buffers');

module.exports = {
  access: function(cachePath, what, cb) {
    if(cachePath.match(/NOT_EXISTING/g)) {
      cb(new Error());
    }
    else {
      cb(null);
    }
  },
  createReadStream: function(cachePath)  {
    return catPicStreamService.getCatPicStream(cachePath);
  },
  createWriteStream: function() {
    return new streamBuffers.WritableStreamBuffer();
  },
  R_OK: "R_OK"
};

