"use strict";

var os = require('os');

module.exports = function PictureServiceModule(pb) {

    var ContentViewLoaderModule  = require('./lib/content_view_loader');

    var ContentViewLoader = ContentViewLoaderModule(pb);
    var ContentViewLoader_Backup;


    /**
     * PictureService - A PictureService site theme for PencilBlue
     *
     * @author Blake Callens <blake@pencilblue.org>
     * @copyright 2014 PencilBlue, LLC
     */
    function PictureService(){}

    /**
     * Called when the application is being installed for the first time.
     *
     * @param cb A callback that must be called upon completion.  cb(err, result).
     * The result is ignored
     */
    PictureService.onInstall = function(cb) {
        var pluginService = new pb.PluginService();
        var tempPath = os.tmpdir();
        pluginService.setSetting("Picture_Service_Cache_Path", tempPath, "PencilBlue-Picture-Service", function(){});

        cb(null, true);
    };

    /**
     * Called when the application is uninstalling this plugin.  The plugin should
     * make every effort to clean up any plugin-specific DB items or any in function
     * overrides it makes.
     *
     * @param cb A callback that must be called upon completion.  cb(err, result).
     * The result is ignored
     */
    PictureService.onUninstall = function(cb) {
        cb(null, true);
    };

    /**
     * Called when the application is starting up. The function is also called at
     * the end of a successful install. It is guaranteed that all core PB services
     * will be available including access to the core DB.
     *
     * @param cb A callback that must be called upon completion.  cb(err, result).
     * The result is ignored
     */
    PictureService.onStartup = function(cb) {
        var pluginService = new pb.PluginService();
        ContentViewLoader_Backup = pb.ContentViewLoader;
////PencilBlue-Picture-Service  adrian
        pluginService.getSettingsKV ('PencilBlue-Picture-Service', function(err, settings) {
            var gallery_enabled;
            if(err) {
                pb.log.error("getSettingsKV failed: " + err.description);
                gallery_enabled = true;
            }
            else {
                gallery_enabled = settings.Gallery_Enabled.toLowerCase().trim() === 'true';
            }
            if (gallery_enabled) {
                pb.ContentViewLoader = ContentViewLoader;
            }
            
            cb(null, true);
        });
    };

    /**
     * Called when the application is gracefully shutting down.  No guarantees are
     * provided for how much time will be provided the plugin to shut down.
     *
     * @param cb A callback that must be called upon completion.  cb(err, result).
     * The result is ignored
     */
    PictureService.onShutdown = function(cb) {
        pb.ContentViewLoader = ContentViewLoader_Backup;
        cb(null, true);
    };

    //exports
    return PictureService;
};
