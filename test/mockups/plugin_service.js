

module.exports = function PluginServiceModule() {
  function PluginService(){}

  PluginService.prototype.getSettingsKV = function(pluginName, cb) {
	cb(null, {Picture_Service_Cache_Path: '/tmp'});
  };

  return PluginService;
};