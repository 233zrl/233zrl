class Utils {
  static updateCurrentTime(obj) {
    if (!obj) return {
      currentTime: '初始化时间',
      // currentTime_TS: 0,
    }
    console.log('更新当前时间:', obj)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0') // 月份从0开始
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')

    obj.currentTime = `${year}年${month}月${day}日 ${hours}时` // 格式化为 YYYY-MM-DD HH

    // obj.currentTime = now.toLocaleString()
    // obj.currentTime_TS = now.getTime()
    return obj
  }

  // 通用复制到剪贴板
  static copyToClipboard(text, onSuccess, onError) {
    if (!text) {
      onError?.('没有可复制的内容')
      return
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        onSuccess?.()
      }).catch(() => {
        onError?.('复制失败，请检查浏览器权限')
      })
    } else {
      // 兼容老浏览器
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        onSuccess?.()
      } catch {
        onError?.('复制失败')
      }
      document.body.removeChild(textarea)
    }
  }

  // 获取最新一条消息的快捷回复
  static getLatestQuickReplies(messages) {
    const lastIndex = messages.length - 1;
    return messages[lastIndex]?.quickReplies || null;
  }

  // 设置最新一条消息的快捷回复
  static setLatestQuickReplies(messages, quickReplies) {
    const lastIndex = messages.length - 1;
    if (messages[lastIndex]) {
      messages[lastIndex].quickReplies = quickReplies;
    }
  }
}