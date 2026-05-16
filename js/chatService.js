//=========================================
//Messages部分 负责操控messages数组。

//俺寻思与ai聊天主要操控这个，那我给他写一个构造函数，应该没问题。

//创建 Messages构造函数，用来构造messages数组。
class Messages {
  constructor() {
    this.messages = []
    this.systems = []
    this.tools = []
    this.hintData = {
      name: '',
      
    }
    // 思维链提示词
    this.fakeToolCalls = []
    // 推理模式开关（全局，影响所有思维链提示词注入方式）
    this.useReasoning = true
  }

  //Mpush方法，修改messages数组，推送新消息
  Mpush(role, content, reasoning_content) {
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
  Spush(content, open = true) {
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
  // ===== 伪造工具调用链管理 =====
  // 推入一条伪造工具调用
  FakeTCpush({ toolName = 'think', thinking = '', toolResult = 'OK', note = '', open = true } = {}) {
    const id = 'ftc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    return this.fakeToolCalls.push({ id, open, toolName, thinking, toolResult, note })
  }
  // 切换开关
  toggleFakeTCOpen(index) {
    if (index < 0 || index >= this.fakeToolCalls.length) throw new Error(`无效的伪造工具调用索引: ${index}`)
    this.fakeToolCalls[index].open = !this.fakeToolCalls[index].open
  }
  // 修改指定条
  setFakeTC(index, updates) {
    if (index < 0 || index >= this.fakeToolCalls.length) throw new Error(`无效的伪造工具调用索引: ${index}`)
    Object.assign(this.fakeToolCalls[index], updates)
  }
  // 删除指定条
  deleteFakeTC(index) {
    if (index < 0 || index >= this.fakeToolCalls.length) throw new Error(`无效的伪造工具调用索引: ${index}`)
    this.fakeToolCalls.splice(index, 1)
  }
  // 上移 / 下移
  moveFakeTC(index, direction) {
    if (index < 0 || index >= this.fakeToolCalls.length) throw new Error(`无效的伪造工具调用索引: ${index}`)
    const target = index + (direction === 'up' ? -1 : 1)
    if (target < 0 || target >= this.fakeToolCalls.length) return
    const tmp = this.fakeToolCalls[index]
    this.fakeToolCalls[index] = this.fakeToolCalls[target]
    this.fakeToolCalls[target] = tmp
  }
  // 获取开启的伪造工具调用
  getOpenFakeTCs() {
    return this.fakeToolCalls.filter(item => item?.open !== false)
  }
  // 切换全局推理模式
  toggleReasoning() {
    this.useReasoning = !this.useReasoning
    return this.useReasoning
  }
  //parameters的构造方法，辅助构造工具信息
  constructParameters(array) {
    // 参数可以是数组或对象，统一转换为数组处理
    let paramsArray = [];
    
    if (Array.isArray(array)) {
      paramsArray = array;
    } else if (typeof array === 'object' && array !== null) {
      // 单个参数对象转为数组
      paramsArray = [array];
    } else {
      throw new Error(`
        [系统提示异常] 检测到无效的参数格式
        原因: 参数必须是数组或对象
        代码: INVALID_PARAMETERS_FORMAT
        建议: 传入格式为 {name, type, description} 的对象或该对象的数组
      `);
    }
    
    // 验证并转换参数格式
    const parameters = {};
    
    for (let i = 0; i < paramsArray.length; i++) {
      const param = paramsArray[i];
      
      // 验证必要字段
      if (!param?.name?.trim()) {
        throw new Error(`
          [系统提示异常] 检测到空参数名称
          位置: 第 ${i + 1} 个参数
        `);
      }
      
      if (!param?.type?.trim()) {
        throw new Error(`
          [系统提示异常] 检测到空参数类型
          位置: 参数 "${param.name}"
        `);
      }
      
      if (!param?.description?.trim()) {
        throw new Error(`
          [系统提示异常] 检测到空参数描述
          位置: 参数 "${param.name}"
        `);
      }
      
      // 转换为OpenAI工具参数格式
      parameters[param.name] = {
        type: param.type,
        description: param.description
      };
    }
    
    return {
      type: 'object',
      properties: parameters,
      required: Object.keys(parameters)
    };
  }
  //Messages的tool构造方法，可以帮助我们构造工具信息
  constructTool({ name, description, parameters }) {
    if (!name?.trim()) {
      throw new Error(`
        [系统提示异常] 检测到空工具名称
    `)
    }
    if (!description?.trim()) {
      throw new Error(`
        [系统提示异常] 检测到空工具描述
    `)
    }
    
    // 验证参数格式，使用constructParameters方法统一处理
    let processedParameters;
    try {
      processedParameters = this.constructParameters(parameters);
    } catch (error) {
      throw new Error(`
        [系统提示异常] 工具参数验证失败
        工具名称: ${name}
        错误详情: ${error.message}
      `);
    }
    
    // 返回OpenAI工具格式
    return {
      type: 'function',
      function: {
        name,
        description,
        parameters: processedParameters
      }
    };
  }

  // 工具数组的推送方法
  Tpush(tool) {
    // 支持直接传入构造好的工具对象
    if (typeof tool === 'object' && tool !== null) {
      // 验证工具格式
      if (!tool.type || tool.type !== 'function') {
        throw new Error(`
          [系统提示异常] 检测到无效的工具类型
          期望: 'function'
          实际: '${tool.type || 'undefined'}'
        `);
      }
      
      if (!tool.function?.name?.trim()) {
        throw new Error(`
          [系统提示异常] 检测到空工具名称
        `);
      }
      
      return this.tools.push(tool);
    }
    
    // 也支持传入constructTool的参数格式
    if (tool.name && tool.description && tool.parameters) {
      const constructedTool = this.constructTool(tool);
      return this.tools.push(constructedTool);
    }
    
    throw new Error(`
      [系统提示异常] 检测到无效的工具格式
      支持格式:
        1. 构造好的工具对象 {type: 'function', function: {...}}
        2. 工具参数对象 {name, description, parameters}
    `);
  }

  // 三合一方法：构造工具并推送到工具数组
  Toolpush(name, description, parameters) {
    if (!name?.trim()) {
      throw new Error(`
        [系统提示异常] 检测到空工具名称
      `);
    }
    
    if (!description?.trim()) {
      throw new Error(`
        [系统提示异常] 检测到空工具描述
      `);
    }
    
    // 使用constructTool构造工具
    const tool = this.constructTool({ name, description, parameters });
    
    // 推送到工具数组
    return this.tools.push(tool);
  }
  

  //messages数组的撤回方法，撤回到指定索引之上的assistant消息
  Mundo(index) {
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
  MsetContent(index, content) {
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
  clearMessages() {
    this.messages = []
  }

  //设置hintData的name属性
  setName(name) {
    if (!name?.trim()) {
      throw new Error(`
        [系统提示异常] 检测到空名称
    `)
    }
    this.hintData.name = name
  }

  //切换systems数组中指定索引的系统提示的开启状态
  toggleSystemOpen(index) {
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
  setSystemContent(index, content) {
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
  deleteSystem(index) {
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
  getOpenSystems() {
    return this.systems.filter(item => item?.open !== false)
  }

  // 获取最近 N - 周期 轮消息（每轮2条，用户+AI），baseRounds 为基础轮数，cycleRounds 为周期轮数
  getRecentMessages(baseRounds, cycleRounds) {
    // 1. 格式化消息（保留role和content）
    const messages = this.messages.map(item => ({
      role: item.role,
      content: item.content
    }));
    const msgTotal = messages.length; // 信息总数（如20轮对话→40）
    const totalRounds = msgTotal / 2; // 总轮数（信息数÷2）

    // 2. 基础轮数无效时，返回全部
    if (!baseRounds || isNaN(baseRounds) || baseRounds <= 0) {
      return messages;
    }

    // 3. 按你的规则计算（以“轮数”为基准）
    // 步骤1：周期轮数在“总轮数”中的最大倍数（如周期5，总轮20→最大倍数20）
    const maxCycleRoundMultiple = cycleRounds > 0
      ? Math.floor(totalRounds / cycleRounds) * cycleRounds
      : 0;
    // 步骤2：实际轮数 = 基础轮数 +（总轮数 - 最大周期倍数）（你的例子：5 + (20-20)=5）
    const actualRounds = baseRounds + (totalRounds - maxCycleRoundMultiple);
    // 步骤3：映射到信息数→实际信息数=实际轮数×2；n=信息总数-实际信息数（你的例子：40 - 5×2=30）
    const actualMsgCount = actualRounds * 2;
    const n = Math.max(msgTotal - actualMsgCount, 0); // 确保n≥0

    // 调试验证（20轮对话举例）
    console.log(`总轮数：${totalRounds}，信息总数：${msgTotal}`);
    console.log(`周期最大倍（轮数）：${maxCycleRoundMultiple}，实际轮数：${actualRounds}`);
    console.log(`实际信息数：${actualMsgCount}，n：${n}`); // 输出n=30

    // 4. 返回从n开始的消息（20轮举例：slice(30)→取最后10条信息=最后5轮）
    return messages.slice(n);
  }

  // 获取所有消息（系统提示 + 对话记录 + 伪造工具调用链）
  getMessages(baseRounds, cycleRounds) {
    // 1. 系统提示
    const systems = this.getOpenSystems()
    // 2. 对话记录
    const messages = this.getRecentMessages(baseRounds, cycleRounds)
    // 3. 伪造工具调用链（放在消息之后，模型会在回复前"看到"这些调用）
    const fakeMsgs = []
    const openFakes = this.getOpenFakeTCs()
    let callIdx = 0
    openFakes.forEach(tc => {
      callIdx++
      const callId = `fake_tc_${callIdx}`
      const thinking = tc.thinking || ''
      const result = tc.toolResult || 'OK'
      if (this.useReasoning) {
        // 推理模型：reasoning_content + tool_calls + tool 返回
        fakeMsgs.push({
          role: 'assistant',
          content: null,
          reasoning_content: thinking,
          tool_calls: [{
            id: callId,
            type: 'function',
            function: { name: tc.toolName, arguments: '{}' }
          }]
        })
        fakeMsgs.push({
          role: 'tool',
          tool_call_id: callId,
          content: result
        })
      } else {
        // 普通模型：content + tool_calls + tool 返回
        fakeMsgs.push({
          role: 'assistant',
          content: thinking,
          tool_calls: [{
            id: callId,
            type: 'function',
            function: { name: tc.toolName, arguments: '{}' }
          }]
        })
        fakeMsgs.push({
          role: 'tool',
          tool_call_id: callId,
          content: result
        })
      }
    })
    // 合并返回：system → 对话 → 伪造工具调用链
    return [
      ...systems,
      ...messages,
      ...fakeMsgs
    ]
  }


  // 1. 导出为标准对象（带版本号）负责转化成json后保存本地
  toExportData() {
    // 返回符合格式的对象
    return {
      // 版本号
      __format_version: 1,
      // 有效载荷
      payload: {
        messages: JSON.parse(JSON.stringify(this.messages)),
        systems: JSON.parse(JSON.stringify(this.systems)),
        hintData: JSON.parse(JSON.stringify(this.hintData)),
        fakeToolCalls: JSON.parse(JSON.stringify(this.fakeToolCalls)),
        useReasoning: this.useReasoning,
      }
    }
  }

  // 2. 从对象导入（兼容所有历史格式）暂时无用，会覆盖记录
  importFromData(data) {
    // 解析对象
    const obj = typeof data === 'string' ? JSON.parse(data) : data
    // 转化为当前格式
    const parsed = Messages.parseCompatible(obj)
    // 赋值
    this.messages = parsed.messages
    this.systems = parsed.systems
    this.hintData = parsed.hintData
    this.fakeToolCalls = parsed.fakeToolCalls || []
    this.tools = parsed.tools || []
    this.useReasoning = parsed.useReasoning !== false
  }

  // 3. 兼容老格式的解析/转换辅助函数（静态）
  parseCompatible(obj) {
    // 新格式
    if (obj?.__format_version === 1 && obj.payload) {
      return {
        messages: obj.payload.messages || [],
        systems: obj.payload.systems || [],
        hintData: obj.payload.hintData || { name: '' },
        fakeToolCalls: obj.payload.fakeToolCalls || [],
      }
    }
    throw new Error('无法识别的聊天数据格式')
  }

}

//=========================================
//ChatRequestBuilder 部分 负责构建请求体

//参数：模型，对话信息（可以配合构造函数Messages），其他参数
class ChatRequestBuilder {
  constructor(model, messages, initialConfig = {}) {
    this.model = model
    this.messages = messages
    this.initialConfig = {
      ...initialConfig
    }
  }

  toJSON() {
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
}

//=========================================
//ApiClient 部分 负责通过http请求调用对话api

//参数：apikey
class ApiClient {
  constructor(apiKey, apiUrl = 'https://api.deepseek.com/v1/chat/completions') {
    this.apiKey = apiKey
    this.url = apiUrl
    this.isGenerating = false
    this.abortController = null
  }

  //设置APIKey方法
  setApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('无效的API Key')
    }
    this.apiKey = apiKey
  }

  //设置APIUrl方法
  setApiUrl(apiUrl) {
    if (!apiUrl || typeof apiUrl !== 'string') {
      throw new Error('无效的API URL')
    }
    this.url = apiUrl
  }

  //参数：请求体json，或对象
  // 普通请求（支持中断和状态管理）
  async send(body) {
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
  async strSend(body, onProgress = () => { }, onDone = () => { }) {
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
  interrupt() {
    if (this.isGenerating && this.abortController) {
      this.abortController.abort()
      this.isGenerating = false
    }
  }

  // 封装请求体处理方法
  _buildRequestBody(body) {
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

  // 兼容老格式的解析/转换辅助函数（静态）
  static parseCompatible(obj) {
    // 新格式
    if (obj?.__format_version === 1 && obj.payload) {
      return {
        messages: obj.payload.messages || [],
        systems: obj.payload.systems || [],
        hintData: obj.payload.hintData || { name: '' },
        tools: obj.payload.tools || [],
        fakeToolCalls: obj.payload.fakeToolCalls || [],
        useReasoning: obj.payload.useReasoning !== false,
      }
    }
    
    // 旧格式（没有版本号）
    if (obj?.messages && Array.isArray(obj.messages)) {
      return {
        messages: obj.messages || [],
        systems: obj.systems || [],
        hintData: obj.hintData || { name: '' },
        tools: obj.tools || [],
        fakeToolCalls: obj.fakeToolCalls || [],
        useReasoning: obj.useReasoning !== false,
      }
    }
    
    throw new Error('无法识别的聊天数据格式')
  }
}