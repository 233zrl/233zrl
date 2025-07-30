//=========================================
//Messages部分 负责操控messages数组。

//俺寻思与ai聊天主要操控这个，那我给他写一个构造函数，应该没问题。

//创建 Messages构造函数，未来用来操控messages数组。
function Messages() {
  this.messages = []
  this.systems = []
  this.hintData = {
    name: '',
    toolState: {
      currentTime: '同步失败', // 当前时间
      currentTime_TS: 0, // 当前时间戳
    }
  }
}
//Messages的Mpush方法，可以推元素进入对话数组,兼容直接传入对象作为参数
//Messages的Mpush方法，可以推元素进入对话数组,兼容直接传入对象作为参数
Messages.prototype.Mpush = function (role, content, reasoning_content) {
  // 支持直接传对象
  if (typeof role === 'object' && role !== null) {
    const { role: r, content: c, reasoning_content: rc } = role
    if (!c?.trim()) {
      throw new Error(`
        [系统提示异常] 检测到空对话
      `)
    }
    return this.messages.push({ role: r, content: c, reasoning_content: rc })
  }

  if (!content?.trim()) {
    throw new Error(`
        [系统提示异常] 检测到空对话
    `)
  }
  // 支持传递reasoning_content
  return this.messages.push({ role, content, reasoning_content })
}
//Messages的Spush方法，可以推元素进入系统提示信息数组
Messages.prototype.Spush = function (content, open = true) {
  if (!content?.trim()) {
    throw new Error(`
        [系统提示异常] 检测到空提示词
        --------------------------
        原因: 传入的提示词内容为空或仅包含空格
        代码: EMPTY_SYSTEM_PROMPT
        建议操作: 
          1. 检查调用Spush的位置
          2. 确认传入参数有效性
          3. 添加非空校验逻辑
    `)
  }
  //return用于返回push的返回值数组长度，如果后面要接着新代码，可以直接更改为返回数组长度。
  return this.systems.push({ role: 'system', content, open })
}
//messages数组的撤回方法，撤回到指定索引之上的assistant消息
Messages.prototype.Mundo = function (index) {
  if (index < 0 || index >= this.messages.length) {
    throw new Error(`
        [系统提示异常] 检测到无效的撤回索引
    `)
  }
  // 从当前数组最后一个元素开始撤回，直到index之上最后一条为assistant
  // 先删到index
  this.messages.splice(index, this.messages.length - index)
  // 删到最后一个为assistant即停止
  for (let i = this.messages.length - 1; i >= 0; i--) {
    if (this.messages[i].role === 'assistant') {
      this.messages.splice(i + 1, this.messages.length - i - 1)
      break
    }
  }
  // 如果没有assistant，直接清空
  if (this.messages.length === 0) {
    this.messages = []
  }
}
//MsetContent方法，修改指定索引的消息内容
Messages.prototype.MsetContent = function (index, content) {
  if (index < 0 || index >= this.messages.length) {
    throw new Error(`
        [系统提示异常] 检测到无效的修改索引
    `)
  }
  if (!content?.trim()) {
    throw new Error(`
        [系统提示异常] 检测到空对话
    `)
  }
  this.messages[index].content = content
}
//清空Messages的消息数组
Messages.prototype.clearMessages = function () {
  this.messages = []
}
//设置hintData的name属性
Messages.prototype.setName = function (name) {
  if (!name?.trim()) {
    throw new Error(`
        [系统提示异常] 检测到空名称
    `)
  }
  this.hintData.name = name
}
//切换systems数组中指定索引的系统提示的开启状态
Messages.prototype.toggleSystemOpen = function (index) {
  if (index < 0 || index >= this.systems.length) {
    throw new Error(`
        [系统提示异常] 检测到无效的系统提示索引
    `)
  }
  // 切换开关状态
  console.log(`切换系统提示 ${index} 的开启状态`)
  if (this.systems[index].open === undefined) {
    this.systems[index].open = true // 默认开启
  }
  this.systems[index].open = !this.systems[index].open
  console.log(`系统提示 ${index} 的开启状态已切换为 ${this.systems[index].open}`)
}
//设置系统提示的content内容
Messages.prototype.setSystemContent = function (index, content) {
  if (index < 0 || index >= this.systems.length) {
    throw new Error(`
        [系统提示异常] 检测到无效的系统提示索引
    `)
  }
  if (!content?.trim()) {
    throw new Error(`
        [系统提示异常] 检测到空系统提示内容
    `)
  }
  this.systems[index].content = content
}
// 删除指定索引的系统提示
Messages.prototype.deleteSystem = function (index) {
  // 检查索引有效性
  if (index < 0 || index >= this.systems.length) {
    throw new Error(`
        [系统提示异常] 检测到无效的系统提示索引
    `)
  }
  // 删除指定索引的系统提示
  this.systems.splice(index, 1)
}
// 获取开启的系统提示
Messages.prototype.getOpenSystems = function () {
  return this.systems.filter(item => item?.open !== false)
}

// 获取 hintData 生成的系统提示对象
Messages.prototype.getHintSystem = function () {

  const { currentTime } = Utils.updateCurrentTime(this.hintData?.toolState) // 自动更新时间
  return {
    role: 'system',
    content: `
    你的名字是：${this.hintData.name || '未知'}，现实实时 时间：${currentTime}，时间戳：废弃
    `,
    open: true
  }
}

// 获取最近 N 轮消息（每轮2条，用户+AI），rounds为0或无效时返回全部
Messages.prototype.getRecentMessages = function (rounds) {
  //先格式化
  const messages = this.messages.map((item) => {
    //确保发送的消息格式正确
    const { role, content } = item
    return {
      role,
      content
    }
  })

  if (rounds === undefined || rounds === null || rounds === 0 || isNaN(rounds)) {
    return messages
  }
  const total = this.messages.length
  const n = Math.max(0, total - rounds * 2)

  return messages.slice(n)
}

// 获取所有消息（系统提示+hint+用户消息）
Messages.prototype.getMessages = function (rounds) {
  // 先获取开启的系统提示
  const systems = this.getOpenSystems()
  // 加入 hintData
  systems.unshift(this.getHintSystem())
  // 获取消息片段
  const messages = this.getRecentMessages(rounds)
  // 合并返回
  return [
    ...systems,
    ...messages
  ]
}




//=========================================
//ChatRequestBuilder 部分 负责构建请求体

//这样就可以通过构造函数构建请求体json了

//参数：模型，对话信息（可以配合构造函数Messages），其他参数
function ChatRequestBuilder(model, messages, initialConfig = {}) {
  this.model = model
  this.messages = messages
  this.initialConfig = {
    ...initialConfig
  }
}
ChatRequestBuilder.prototype.toJSON = function () {
  let jsonData = {
    model: this.model,
    ...this.initialConfig
  }
  //判断messages是否有getMessages方法
  // 情况1：是的话调用getMessages方法

  if (typeof this.messages?.getMessages === 'function') {
    jsonData.messages = this.messages.getMessages()
  }
  // 情况2：如果是普通数组则直接加入
  else if (Array.isArray(this.messages) && this.messages !== null) {
    jsonData.messages = this.messages
  } else {
    throw new Error('bro,ChatRequestBuilder的第二个参数，你传的什么东西')
  }
  return JSON.stringify(jsonData)
}


//=========================================
//ApiClient 部分 负责通过http请求调用对话api

//参数：apikey
function ApiClient(apiKey, apiUrl = 'https://api.deepseek.com/v1/chat/completions') {
  this.apiKey = apiKey
  this.url = apiUrl
  this.isGenerating = false
  this.abortController = null
}

//设置APIKey方法
ApiClient.prototype.setApiKey = function (apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('无效的API Key')
  }
  this.apiKey = apiKey
}

//参数：请求体json，或对象
// 普通请求（支持中断和状态管理）
ApiClient.prototype.send = async function (body) {
  this.isGenerating = true
  this.abortController = new AbortController()
  try {
    let requestBody = this._buildRequestBody(body)
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: requestBody,
      signal: this.abortController.signal // 支持中断
    })
    if (!res.ok) throw new Error('请求失败')
    return await res.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('请求被中断')
    }
    throw error
  } finally {
    this.isGenerating = false
    this.abortController = null
  }
}

// 流式请求（支持中断和状态管理）
ApiClient.prototype.strSend = async function (body, onProgress = () => { }, onDone = () => { }) {
  this.isGenerating = true
  this.abortController = new AbortController()
  try {
    let requestBody = this._buildRequestBody(body)
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: requestBody,
      signal: this.abortController.signal // 支持中断
    })
    if (!res.ok) throw new Error('请求失败')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const message = {
      content: '',
      reasoning_content: '',
    }
    let interrupted = false

    // 主循环，逐步读取流数据
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 拆分为多段，每段处理
      let lines = buffer.split(/(\r?\n){2,}/)
      buffer = lines.pop() || '' // 剩余未处理部分留到下次

      for (let rawChunk of lines) {
        const cleanChunk = rawChunk.trim().replace(/^data: /, '')
        if (!cleanChunk) continue
        if (cleanChunk === '[DONE]') {
          onDone({ ...message })
          return
        }
        try {
          const obj = JSON.parse(cleanChunk)
          // 累加主内容
          if (obj.choices?.[0]?.delta?.content) {
            message.content += obj.choices[0].delta.content
          }
          // 累加思维链内容
          if (obj.choices?.[0]?.delta?.reasoning_content) {
            message.reasoning_content += obj.choices[0].delta.reasoning_content
          }
        } catch (e) {
          // 忽略解析错误
        }
      }

      onProgress({ ...message })

      // 检查是否被中断
      if (!this.isGenerating) {
        interrupted = true
        break
      }
    }

    if (interrupted) throw new Error('请求被中断')
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('请求被中断')
    }
    throw error
  } finally {
    this.isGenerating = false
    this.abortController = null
  }
}

// 中断方法
ApiClient.prototype.interrupt = function () {
  if (this.isGenerating && this.abortController) {
    this.abortController.abort()
    this.isGenerating = false
  }
}
// 封装请求体处理方法
ApiClient.prototype._buildRequestBody = function (body) {
  if (typeof body?.toJSON === 'function') {
    return body.toJSON();
  } else if (typeof body === 'object' && body !== null) {
    return JSON.stringify(body);
  } else if (typeof body === 'string') {
    try {
      JSON.parse(body);
      return body;
    } catch {
      throw new Error('字符串不是有效的JSON格式');
    }
  } else {
    throw new Error('无效的请求体类型，应传入对象或JSON字符串');
  }
}