// 配置管理类，负责读取、保存、合并配置项
function ConfigManager(defaultConfig) {
  // 读取本地配置（如果有），并与默认配置合并，缺失项自动补齐
  const userConfig = JSON.parse(localStorage.getItem('userConfig') || '{}')
  this.config = Object.assign({}, defaultConfig, userConfig)
}

ConfigManager.prototype.get = function (key) {
  return this.config[key]
}

ConfigManager.prototype.set = function (key, value) {
  this.config[key] = value
  localStorage.setItem('userConfig', JSON.stringify(this.config))
}

ConfigManager.prototype.getAll = function () {
  return this.config
}

ConfigManager.prototype.setAll = function (newConfig) {
  this.config = Object.assign(this.config, newConfig)
  localStorage.setItem('userConfig', JSON.stringify(this.config))
}