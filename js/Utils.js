class Utils {
  // 更新当前时间 -- 废弃
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

  // 生成文件（返回 { blob, url }）
  // fileName: 文件名（如 "example.txt"）
  // content: 文本或对象（对象会自动 JSON.stringify）
  // options: { mimeType: 'text/plain;charset=utf-8' }
  static createFile(fileName, content, options = {}) {
    const mimeType = options.mimeType || 'text/plain;charset=utf-8';
    let data = content;
    // 自动将对象转为 JSON 字符串，便于导出配置等
    if (typeof content === 'object' && content !== null) {
      try {
        data = JSON.stringify(content, null, 2);
      } catch (e) {
        data = String(content);
      }
    } else {
      data = String(content ?? '');
    }
    const blob = new Blob([data], { type: mimeType });
    const url = (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(blob) : null;
    return { blob, url, fileName, mimeType };
  }

  // 下载文件（会自动处理 Blob URL 或 dataURI 兼容）
  // fileName: 文件名（如 "example.txt"）
  // content: 文本或对象（对象会自动 JSON.stringify）
  // options: { mimeType: 'text/plain;charset=utf-8' }
  // onSuccess/onError: 可选回调
  static downloadFile(fileName, content, options = {}, onSuccess, onError) {
    try {
      const { blob, url } = Utils.createFile(fileName, content, options);
      // 优先使用 Blob URL
      if (url) {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName || 'download.txt';
        document.body.appendChild(a);
        a.click();
        // 清理
        document.body.removeChild(a);
        setTimeout(() => {
          try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        }, 100);
        onSuccess?.();
        return;
      }
      // 兼容：使用 data URI
      const reader = new FileReader();
      reader.onload = function () {
        const dataUrl = reader.result;
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = dataUrl;
        a.download = fileName || 'download.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        onSuccess?.();
      };
      reader.onerror = function (err) {
        onError?.(err?.message || '读取文件失败');
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      onError?.(err?.message || '下载失败');
    }
  }


  // 从本地 File/Blob 读取文本。返回 Promise<string>
  // file: File | Blob | FileList | Array（若为 FileList/Array 则取第一个）
  // options: { encoding: 'utf-8' }
  static readFileAsText(file, options = {}) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('没有提供 file'));
        return;
      }
      // 支持 FileList 或 Array，取第一个
      if (file instanceof FileList || Array.isArray(file)) {
        file = file[0];
      }
      if (!(file instanceof Blob)) {
        reject(new Error('参数不是 File/Blob'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve(String(reader.result ?? ''));
      };
      reader.onerror = () => {
        reject(new Error(reader.error?.message || '读取文件失败'));
      };
      const encoding = options.encoding || 'utf-8';
      try {
        reader.readAsText(file, encoding);
      } catch (err) {
        reject(err);
      }
    });
  }

  // 快速打开本地文件选择器并返回所选文件（默认单文件）
  // options: { accept: '.txt,.json,text/*', multiple: false }
  // 返回 Promise<File>（multiple=false）或 Promise<File[]>（multiple=true）
  static pickLocalFile(options = {}) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options.accept) input.accept = options.accept;
      if (options.multiple) input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);

      const cleanup = () => {
        input.removeEventListener('change', onChange);
        document.body.removeChild(input);
      };

      const onChange = () => {
        const files = input.files;
        if (!files || files.length === 0) {
          cleanup();
          reject(new Error('未选择文件'));
          return;
        }
        if (options.multiple) {
          const arr = Array.from(files);
          cleanup();
          resolve(arr);
        } else {
          const f = files[0];
          cleanup();
          resolve(f);
        }
      };

      input.addEventListener('change', onChange);
      // 触发选择器
      input.click();
    });
  }

}