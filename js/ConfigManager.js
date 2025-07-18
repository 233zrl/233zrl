
// 配置管理类，负责读取、保存、合并配置项
class ConfigManager {
  constructor(defaultConfig) {
    const userConfig = JSON.parse(localStorage.getItem('userConfig') || '{}')
    this.config = Object.assign({}, defaultConfig, userConfig)
  }

  // 获取指定配置项的值
  get(key) {
    return this.config[key]
  }

  // 设置指定配置项的值，并保存到本地存储
  set(key, value) {
    this.config[key] = value
    localStorage.setItem('userConfig', JSON.stringify(this.config))
  }

  // 获取所有配置项
  getAll() {
    return this.config
  }

  // 批量设置配置项，并保存到本地存储
  setAll(newConfig) {
    this.config = Object.assign(this.config, newConfig)
    localStorage.setItem('userConfig', JSON.stringify(this.config))
  }
}