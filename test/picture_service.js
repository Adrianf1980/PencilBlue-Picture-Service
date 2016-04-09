
var pb = require('./mockups/pb').getMockPB();
var assert = require('chai').assert;
var rewire = require('rewire');
var sinon = require('sinon');
var fs_mock = require('./mockups/fs');
var PictureServiceModule, PictureService, pictureServiceInstance;
var sharp = require('sharp');

PictureServiceModule = rewire("../services/picture_service.js");
PictureServiceModule.__set__("fs", fs_mock);

PictureService = PictureServiceModule(pb);
pictureServiceInstance = new PictureService();

describe('Service compliance check', function() {
  it('should have a name of "PictureService"', function () {
    assert.equal(PictureService.getName(), "PictureService");
  });
  it('should have an init procedure that call the callback', function () {
    var cb = sinon.spy();
    PictureService.init(cb);
    assert.isTrue(cb.called);
  });
});

describe('Helpers', function() {
  describe('getPicDimensions', function () {
    var getPicDimensions = PictureServiceModule.__get__("getPicDimensions");

    it('should resize by height correctly', function () {
      var metadata = {width: 800, height: 600};
      var demandedSize = {width: 600};
      var newDimensions = getPicDimensions(metadata, demandedSize);
      assert.equal(newDimensions.height, 450);
      assert.equal(newDimensions.width, 600);
    });

    it('should resize by width correctly', function () {
      var metadata = {width: 800, height: 600};
      var demandedSize = {height: 240};
      var newDimensions = getPicDimensions(metadata, demandedSize);
      assert.equal(newDimensions.width, 320);
      assert.equal(newDimensions.height, 240);
    });

// TODO
// check if needed
/*
    it('should resize by width and height correctly', function () {
      var metadata = {width: 800, height: 600};
      var demandedSize = {height: 300, width: 300};
      var newDimensions = getPicDimensions(metadata, demandedSize);
      assert.equal(newDimensions.width, 300);
      assert.equal(newDimensions.height, 300);
      assert.equal(newDimensions.left, 50); //250
      assert.equal(newDimensions.top, 0 ); //150
    });
*/
  });


  describe('getCachePath', function () {
    var getCachePath = PictureServiceModule.__get__("getCachePath");

    it('should return correct pathname for no width and height', function () {
      var mediaPath = "/media/2014/11/dlfkasdjfdsdf.jpg";
      var expectedSize = {};
      var pathPrefix = "/tmp/";
      var cachePath = getCachePath(mediaPath, expectedSize, pathPrefix);

      assert.equal(cachePath, "/tmp/media-2014-11-dlfkasdjfdsdf.jpg");
    });
    it('should return correct pathname for width', function () {
      var mediaPath = "/media/2014/11/dlfkasdjfdsdf.jpg";
      var expectedSize = {width: 123};
      var pathPrefix = "/tmp";
      var cachePath = getCachePath(mediaPath, expectedSize, pathPrefix);

      assert.equal(cachePath, "/tmp/media-2014-11-dlfkasdjfdsdf-w123.jpg");
    });
    it('should return correct pathname for height', function () {
      var mediaPath = "/media/2014/11/dlfkasdjfdsdf.jpg";
      var expectedSize = {height: 123};
      var pathPrefix = "/tmp/";
      var cachePath = getCachePath(mediaPath, expectedSize, pathPrefix);

      assert.equal(cachePath, "/tmp/media-2014-11-dlfkasdjfdsdf-h123.jpg");
    });
    it('should return correct pathname for width and height', function () {
      var mediaPath = "/media/2014/11/dlfkasdjfdsdf.jpg";
      var expectedSize = {width: 123, height: 456};
      var pathPrefix = "/tmp";
      var cachePath = getCachePath(mediaPath, expectedSize, pathPrefix);

      assert.equal(cachePath, "/tmp/media-2014-11-dlfkasdjfdsdf-w123-h456.jpg");
    });
  });
});


describe('PictureService', function() {
  describe('getPictureStream', function () {
    it('callback should be called only once', function () {
      var getPictureFromCache = PictureServiceModule.__get__("getPictureFromCache");
      sinon.spy(pictureServiceInstance, "getPictureStream");
      var cb = sinon.spy();
      var mediaPath = '/media/2015/11/IS_EXISTING.jpg';
      pictureServiceInstance.getPictureStream(mediaPath, {width: 300}, cb);
      assert.isTrue(cb.calledOnce);
      assert.isTrue(pictureServiceInstance.getPictureStream.calledOnce);
    });

    it('it should have the right output size and format', function (done) {
      var cb = function(err, stream, info) {
        var pipeline = sharp();
        pipeline.metadata(function(err, metadata) {
          assert.equal(info.source, "storage");
          assert.equal(metadata.format, 'jpeg');
          assert.equal(metadata.width, 300);
          assert.equal(metadata.height, 300);
          done();
        }).on('error', function(err) {
          throw err;
        });
        stream.pipe(pipeline);
      };
      var mediaPath = '/media/2015/11/NOT_EXISTING.jpg';
      pictureServiceInstance.getPictureStream(mediaPath, {width: 300}, cb);
    });

    it('it should be streamed from cache', function (done) {
      var cb = function(err, stream, info) {
        var pipeline = sharp();
        pipeline.metadata(function(err, metadata) {
          assert.equal(info.source, "cache");
          done();
        }).on('error', function(err) {
          throw err;
        });
        stream.pipe(pipeline);
      };
      var mediaPath = '/media/2015/11/IS_EXISTING.jpg';
      pictureServiceInstance.getPictureStream(mediaPath, {width: 300}, cb);
    });

    it('it should be streamed from storage', function (done) {
      var cb = function(err, stream, info) {
        var pipeline = sharp();
        pipeline.metadata(function(err, metadata) {
          assert.equal(info.source, "storage");
          done();
        }).on('error', function(err) {
          throw err;
        });
        stream.pipe(pipeline);
      };
      var mediaPath = '/media/2015/11/NOT_EXISTING.jpg';
      pictureServiceInstance.getPictureStream(mediaPath, {width: 300}, cb);
    });

    it('it should fail on unsupported filetypes', function (done) {
      var cb = function(err, stream, info) {
        assert.isTrue(err !== null);
        done();
      };
      var mediaPath = '/media/2015/11/NOT_EXISTING_CAT_TIF.jpg';
      pictureServiceInstance.getPictureStream(mediaPath, {width: 300}, cb);
    });
  });
});
