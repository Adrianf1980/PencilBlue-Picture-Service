"use strict";

/* ****************************************************************
* Dependencies
* **************************************************************** */
var fs = require('fs');
var uid = require('uid');
var sharp = require('sharp');
var constants   = require('../lib/constants');


/* ****************************************************************
* CONSTANTS
* **************************************************************** */

var TEMP_CACHE_SUBFOLDER = constants.temp_cache_subfolder;


/* ****************************************************************
* Variables
* **************************************************************** */
var pb = null;


/* ****************************************************************
* Helpers
* **************************************************************** */
var getCacheDir = function(pathPrefix) {
  var pathPrefixOut = pathPrefix + (pathPrefix.slice(-1) === '/' ? '' : '/' );
  return pathPrefixOut + TEMP_CACHE_SUBFOLDER + "/";
};

var getCachePath = function(mediaPath, expectedSize, pathPrefix) {
  var re = /(?:\.([^.]+))?$/;
  var extension = re.exec(mediaPath)[1];
  var mediaPathOut = (mediaPath.substring(0,1) === '/' ? mediaPath.substring(1) : mediaPath );

  if (extension === undefined) {
    extension = '';
  }
  else {
    mediaPathOut = mediaPathOut.substring(0,mediaPathOut.length - extension.length-1).replace(/\//g, '-');
    extension = '.' + extension;
  }

  if(expectedSize.width !== undefined) {
      mediaPathOut += '-w'+ expectedSize.width;
  }
  if(expectedSize.height !== undefined) {
      mediaPathOut += '-h'+ expectedSize.height;
  }
  if(expectedSize.width === undefined && expectedSize.height === undefined) {
    if(expectedSize.maxWidth !== undefined) {
        mediaPathOut += '-mw'+ expectedSize.maxWidth;
    }
    else if(expectedSize.maxHeight !== undefined) {
        mediaPathOut += '-mh'+ expectedSize.maxHeight;
    }
  }
  if(expectedSize.quality !== undefined) {
      mediaPathOut += '-q'+ expectedSize.quality;
  }
  mediaPathOut = getCacheDir(pathPrefix) + mediaPathOut + extension;
  return mediaPathOut;
};

var getPicDimensions = function(metadata, demandedSize) {
    if(demandedSize.width === undefined && demandedSize.height === undefined) {
      if(demandedSize.maxWidth === undefined && demandedSize.maxHeight === undefined) {
        return {width: metadata.width, height: metadata.height, quality: demandedSize.quality};
      }
      else {
        if(demandedSize.maxWidth !== undefined) {
          if (metadata.width > demandedSize.maxWidth) {
            demandedSize.width = demandedSize.maxWidth;
          }
        }
        else if(demandedSize.maxHeight !== undefined) {
          if (metadata.height > demandedSize.maxHeight) {
            demandedSize.height = demandedSize.maxHeight;
          }
        }
      }
    } 
    if (demandedSize.height === undefined) {
      return {width: demandedSize.width, height: Math.round(metadata.height * demandedSize.width/metadata.width), quality: demandedSize.quality};
    }
    if (demandedSize.width === undefined) {
      return {width: Math.round(metadata.width * demandedSize.height/metadata.height), height: demandedSize.height, quality: demandedSize.quality}; 
    }
    return {width: demandedSize.width, height: demandedSize.height, quality: demandedSize.quality};
};

var getPictureFromStorage = function(mediaPath, expectedSize, cachePath, settings, cb) {
  // establish temp subfolder if needed

  var tempDir = getCacheDir(settings.Picture_Service_Cache_Path);
  var tempPath = tempDir + uid(20);

  settings.Do_Cache = settings.Do_Cache.toLowerCase();

  if (settings.Do_Cache !== "true" || settings.Picture_Service_Cache_Path === '') {
      settings.Do_Cache = "false";
      getStorageStreamAndCache(mediaPath, expectedSize, null, null, settings, cb);
      return;
  }

  fs.stat(tempDir, function(err, stats){
    if(err === null && stats.isDirectory()) {
      getStorageStreamAndCache(mediaPath, expectedSize, cachePath, tempPath, settings, cb);
    }
    else if (err && err.code !== "ENOENT") {
      settings.Do_Cache = "false";
      getStorageStreamAndCache(mediaPath, expectedSize, null, null, settings, cb);
    }
    else {
      fs.mkdir(tempDir, function(err) {
        if (err) {
          settings.Do_Cache = "false";
        }
        getStorageStreamAndCache(mediaPath, expectedSize, cachePath, tempPath, settings, cb);
      });
    }
  });
};

var getStorageStreamAndCache = function(mediaPath, expectedSize, cachePath, tempPath, settings, cb) {
  var mservice  = new pb.MediaService();
  var wstream, wstreamInfo;

  if (settings.Do_Cache === "true") {
    wstream = fs.createWriteStream(tempPath, {encoding: 'binary'});
    wstreamInfo = fs.createWriteStream(tempPath + ".json");
    wstream.on('finish', function() {
      //renaming at the end for avoiding that two processes write simoultanously to the same file.
      fs.rename(tempPath, cachePath, function(err) {
        if (err)
          pb.log.warn("Rewrite tempFile failed, descpription: " + err.description);
      });
    });
    wstreamInfo.on('finish', function() {
      //renaming at the end for avoiding that two processes write simoultanously to the same file.
      fs.rename(tempPath + ".json", cachePath + ".json", function(err) {
        if (err)
          pb.log.warn("Rewrite temp info file failed, descpription: " + err.description);
      });
    });
  }

  mservice.getContentStreamByPath(mediaPath, function(err, mstream) {
    if(err) {
      cb(err, null, null);
      return;
    }

    // TODO
    // https://github.com/lovell/sharp/issues/236 once implemented, should allow for something more elegant. Discussed in #314
    var pipeline = sharp();
    pipeline.metadata(function(err, metadata){
        if(err) {
          pb.log.error("Second metadata failed: " + err.description);
          cb(new Error(null, "Fetching Metadata failed"), null, null);
          return;
        }        
        if(metadata.format !== 'jpeg' && 
            metadata.format !== 'png' && 
            metadata.format !== 'webp' &&
            metadata.format !== 'gif') { 
            cb(new Error(null, "file type not supported"), null, null);
            return; 
        }
        mservice.getContentStreamByPath(mediaPath, function(err, mstream2) {
            var dimensions = getPicDimensions(metadata, expectedSize);
            var pipeline2 = sharp();
            var pipelineFs;
            var pipelineCb;

            if(err) {
              cb(err, null, null);
              pb.log.error("Second mediastream failed: " + err.description);
              return;
            }        

            pipeline2.resize(dimensions.width, dimensions.height);
            if(dimensions.quality)
              pipeline2.quality(dimensions.quality);
            pipelineCb = pipeline2.clone();

            if (settings.Do_Cache === "true") {
              pipelineFs = pipeline2.clone();
              pipelineFs.pipe(wstream);

              metadata.exif = undefined;
              metadata.width = dimensions.width;
              metadata.height = dimensions.height;
              wstreamInfo.write(JSON.stringify(metadata), function() {
                wstreamInfo.end();
              });
            }

            cb(null, pipelineCb, {source: "storage", mimeType: "image/" + metadata.format, metadata: metadata});

            mstream2.pipe(pipeline2);

        });                    
      });
      mstream.pipe(pipeline);
  });  
};

var getPictureFromCache = function(cachePath, cb) {
  fs.readFile(cachePath + ".json", function (err, data) {
    if(err) {
      cb(err, null, null);
      pb.log.error("Reading metadata json file failed: " + err.description);
      return;
    }        
    var metadata = JSON.parse(data);

    fs.stat(cachePath, function(err, stats){
      if(err) {
        cb(err, null, null);
        pb.log.error("Reading metadata json file failed: " + err.description);
        return;
      }        

      // Next line must not have the option {encoding: 'binary'}
      // http://stackoverflow.com/questions/33976205/nodejs-binary-fs-createreadstream-streamed-as-utf-8
      var rstream = fs.createReadStream(cachePath);
      cb(null, rstream, {source: "cache", streamLength: stats.size, mimeType: "image/" + metadata.format, metadata: metadata});
    });
  });
};


module.exports = function(PB) {
    
    /**
     * TextService - An example of a service that generates random text.
     * 
     * @author Brian Hyder <brian@pencilblue.org>
     * @copyright 2015 PencilBlue, LLC.  All Rights Reserved
     * @class TextService
     * @constructor
     */
    //function TestService() {}

    //constants
    /**
     * A listing of the possible characters that can be a part of the random string 
     * generation
     * @static
     * @readonly
     * @property POSSIBLE
     * @type {String}
     */
    //var POSSIBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    /**
     * This function is called when the service is being setup by the system.  It is 
     * responsible for any setup that is needed when first created.  The services 
     * are all instantiated at once and are not added to the platform untill all 
     * initialization is complete.  Relying on other plugin services in the 
     * initialization could result in failure.
     * 
     * @static
     * @method init
     * @param cb A callback that should provide one argument: cb(error) or cb(null) 
     * if initialization proceeded successfully.
     */
   // TestService.init = function(cb) {
//        pb.log.debug("TestService: Initialized");
  //      cb(null, true);
//    };

    /**
     * A service interface function designed to allow developers to name the handle 
     * to the service object what ever they desire. The function must return a 
     * valid string and must not conflict with the names of other services for the 
     * plugin that the service is associated with.
     *
     * @static
     * @method getName
     * @return {String} The service name
     */
  //  TestService.getName = function() {
    //    return "test service";
//    };

    /**
     * Generates a random string of 5 characters.  The service functions can return 
     * values or use call backs.  There is no standard for how a service should 
     * provide functionality.  The only requirement is that an instance be provided 
     * as the exported object with the understanding that services should be 
     * stateless.  
     * 
     * @method getText
     * @return {String}
     */
  //  TestService.prototype.getText = function() {

    //    var text = "";
    //    for (var i = 0; i < 50; i++) {
      //      text += POSSIBLE.charAt(Math.floor(Math.random() * POSSIBLE.length));
    //    }
      //  return text;
    //};

    pb = PB;
    function PictureService(){}
     PictureService.init = function(cb) {
        pb.log.debug("PictureService: Initialized");
        cb(null, true);
    };
     

  PictureService.getName = function(){
    return "PictureService";
  };
  
  PictureService.prototype.getUrlPrefix = function(){
    constants.url_prefix();
  };

    PictureService.prototype.getPictureStream = function(mediaPath, expectedSize, cb){
    expectedSize.width     = (expectedSize.width     !== undefined ? Math.round(parseInt(expectedSize.width)) : undefined);
    expectedSize.height    = (expectedSize.height    !== undefined ? Math.round(parseInt(expectedSize.height)) : undefined);
    expectedSize.maxWidth  = (expectedSize.maxWidth  !== undefined ? Math.round(parseInt(expectedSize.maxWidth)) : undefined);
    expectedSize.maxHeight = (expectedSize.maxHeight !== undefined ? Math.round(parseInt(expectedSize.maxHeight)) : undefined);
    expectedSize.quality   = (expectedSize.quality   !== undefined ? Math.round(parseInt(expectedSize.quality)) : undefined);
    expectedSize.width     = (isNaN(expectedSize.width)     ? undefined : expectedSize.width);
    expectedSize.height    = (isNaN(expectedSize.height)    ? undefined : expectedSize.height);
    expectedSize.maxWidth  = (isNaN(expectedSize.maxWidth)  ? undefined : expectedSize.maxWidth);
    expectedSize.maxHeight = (isNaN(expectedSize.maxHeight) ? undefined : expectedSize.maxHeight);
    expectedSize.quality   = (isNaN(expectedSize.quality)   ? undefined : expectedSize.quality);

    var self = this;
    var cachePath, pluginService;

    pluginService = new pb.PluginService();
    pluginService.getSettingsKV ('PencilBlue-Picture-Service', function(err, settings) {
      if(err) {
        cb(err, null, null);
        return;
      }

      cachePath = getCachePath(mediaPath, expectedSize, settings.Picture_Service_Cache_Path);
      fs.access(cachePath, fs.R_OK, function (err) {
        if (err)
          getPictureFromStorage(mediaPath, expectedSize, cachePath, settings, cb);
        else {
          fs.access(cachePath + ".json", fs.R_OK, function (err) {
            if (err)
              getPictureFromStorage(mediaPath, expectedSize, cachePath, settings, cb);
            else
              getPictureFromCache(cachePath, cb);
          });
        }
      });
    });
  };
    
    
    //exports
    return PictureService;
};