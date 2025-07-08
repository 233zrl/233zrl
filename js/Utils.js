class Utils {
  static updateCurrentTime(obj) {
    if (!obj) return {
      currentTime: '同步失败',
      currentTime_TS: 0,
    }
    const now = new Date()
    obj.currentTime = now.toLocaleString()
    obj.currentTime_TS = now.getTime()
    return obj
  }
}