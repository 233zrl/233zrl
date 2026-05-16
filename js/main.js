//我要解决部分配置编辑过后需要刷新页面的问题()，然后将apikey也统一到 ConfigManager 中管理

// 在主应用 (main.js) 中：
class ChatApp {
  constructor() {
    // 配置管理器，所有配置都通过它读写
    this.configManager = new ConfigManager(window.defaultConfig)

    // 通用配置
    this.useStream = this.configManager.get('useStream')
    this.useLocalStorage = this.configManager.get('useLocalStorage')
    this.maxRounds = this.configManager.get('maxRounds')
    this.roundsCycle = this.configManager.get('roundsCycle')
    this.DEFAULT_SYSTEMS = this.configManager.get('DEFAULT_SYSTEMS')

    // 迁移旧版扁平 API 配置 → provider 架构
    this._migrateOldConfig()

    // 从激活的 provider 读取 API 参数
    const provider = this._getActiveProvider()

    // 快捷回复参数
    this.quickReplyMaxRounds = 0

    // 其它初始化...
    this.ui = new UIController()
    this.api = new ApiClient(provider.apiKey, provider.apiUrl)
    this.messages = new Messages()
    this.chatsDB = new LocalArrayDB('chats')
    this.currentChatIndex = localStorage.getItem('currentChatIndex') || 0

    // 绑定回调
    this.bindUICallbacks()
    // 初始化
    this.init()
  }
  //初始化
  async init() {
    //本地数据初始化
    if (this._checkLocalStorage()) await this.initDB()
    //回到底部
    this.ui.scrollToBottom()
  }
  //用到索引这里可以改成 默认flase 代码判断参数，如果没传（flase）就 this.currentChatIndex当前页码？
  // 本地存储(indexedDB)初始化
  async initDB(index = false) {
    // 获取有效索引
    index = this._getIndex(index)
    try {
      // 初始化数据库
      await this.chatsDB.init()

      // 检查是否有聊天记录，如果有判断index是否越界，如果无则创建一个新的聊天
      const chats = await this.chatsDB.getAll()
      if (chats.length > 0) {
        // 如果index越界则取第一个
        if (index >= chats.length) {
          index = 0
        }
      } else {
        // 如果没有聊天记录，创建一个新的
        // await this.chatsDB.push(this.messages)
        await this.addNewChat('未命名会话', this.DEFAULT_SYSTEMS)// 默认创建一个未命名会话
      }
      //加载指定索引的聊天记录
      await this.loadChatByIndex(index)
      return
    } catch (e) {
      console.error('初始化数据库失败:', e)
      this.ui.showError('初始化数据库失败，请检查浏览器支持情况')
    }
  }
  //绑定UI回调
  bindUICallbacks() {
    //顶部导航栏
    this.ui.onAddPrompt = () => this.addSystemPrompt() // 添加系统提示
    this.ui.onSetPrompt = () => this.showSystemList() // 管理提示词
    this.ui.onManageFakeTC = () => this.showFakeTCList() // 思维链提示词
    this.ui.onClearChat = () => this.clearCurrentChat() // 清空当前聊天
    this.ui.onDeleteChat = () => this.deleteCurrentChat() // 删除当前聊天
    this.ui.onSwitchChat = () => this.showChatList() // 切换聊天列表
    this.ui.onEditConfig = () => this.editConfig() // 编辑可配置项
    this.ui.onSetApiKey = () => this.setApiKey() // 设置API Key
    this.ui.onQuickConfig = () => this.quickConfig() // 快捷配置
    this.ui.onDownloadChat = () => this.downloadChat() //下载聊天记录
    this.ui.onUploadChat = () => this.uploadChat() //上传聊天记录
    //上下文菜单
    this.ui.onUndo = (id) => this.undoMessage(id) // 撤回消息
    this.ui.onCopy = (id) => this.copyMessage(id) // 复制消息
    this.ui.onEdit = (id) => this.editMessage(id) // 编辑消息
    this.ui.onCopyAll = (id) => this.copyMessageAll(id) // 复制全文
    // 底部
    this.ui.onInterrupt = () => this.interruptGenerate() // 中断生成
    this.ui.onScrollToBottom = () => this.ui.scrollToBottom() // 滚动到底部
    this.ui.onSubmit = (content) => this.sendMessage(content) // 发送消息
    this.ui.onAddChat = () => this.onAddChat() // 新增聊天
    this.ui.onQuickReplyClick = () => this.toggleQuickReplyPanel() // 打开快捷回复面板
    this.ui.onDownloadChat = () => this.downloadChat() //下载聊天记录
  }
  // 根据索引加载聊天记录
  async loadChatByIndex(index = false) {
    //初始化
    await this.chatsDB.init()
    // 获取有效索引
    index = this._getIndex(index)
    try {
      const chats = await this.chatsDB.getAll()
      if (index < 0 || index >= chats.length) {
        throw new Error('无效的聊天索引')
      }
      // 切换页码并保存
      this.currentChatIndex = index
      localStorage.setItem('currentChatIndex', index)

      // 清空当前消息
      this.messages.clearMessages()
      // 加载指定索引的聊天记录
      this.messages.messages = chats[index].messages || []
      this.messages.systems = chats[index].systems || []
      this.messages.hintData = chats[index].hintData || { name: `未命名会话${index + 1}` }
      this.messages.fakeToolCalls = chats[index].fakeToolCalls || []
      this.messages.useReasoning = chats[index].useReasoning !== false
      // 刷新 UI
      this.ui.renderMessageList(this.messages.messages)
      // 更新显示的Name
      this.ui.setNavChatName(this.messages.hintData.name || '未命名会话')
      // 没什么用，但是异步函数需要它
      return this.messages
    } catch (e) {
      console.error('加载聊天记录失败:', e)
      this.ui.showError(e.message || '加载聊天记录失败')
    }
  }
  // 根据索引保存聊天记录（全量）
  async saveChatByIndex(index = false) {
    //初始化
    await this.chatsDB.init()
    // 获取有效索引
    index = this._getIndex(index)
    try {
      const { messages, systems, hintData, fakeToolCalls, useReasoning } = this.messages
      // 把他们打包成一个对象
      const chatData = {
        messages,
        systems,
        hintData,
        fakeToolCalls: fakeToolCalls || [],
        useReasoning: useReasoning !== undefined ? useReasoning : true,
      }
      // 保存聊天记录到数据库
      await this.chatsDB.update(index, chatData)
      console.log('聊天记录已保存')
    } catch (e) {
      console.error('保存聊天记录失败:', e)
      this.ui.showError(e.message || '保存聊天记录失败')
    }
  }
  // 通用方法：添加一个完整的聊天对象到本地存储
  // chatObj: { messages, systems, hintData }，可用于导入/复制聊天
  async addChatObject(chatObj = {}) {
    // 检查是否正在生成中，防止并发冲突
    if (this._checkGenerating()) return
    // 检查是否开启本地存储
    if (!this._checkLocalStorage()) return

    // 获取当前聊天总数，用于生成默认名称
    const chats = await this.chatsDB.getAll();
    const length = chats.length;

    // 构建新聊天对象，确保结构完整
    const newChat = {
      messages: Array.isArray(chatObj.messages) ? chatObj.messages : [],
      systems: Array.isArray(chatObj.systems) ? chatObj.systems : [],
      fakeToolCalls: Array.isArray(chatObj.fakeToolCalls) ? chatObj.fakeToolCalls : [],
      // hintData 至少要有 name 字段
      hintData: {
        ...(typeof chatObj.hintData === 'object' ? chatObj.hintData : {}),
        name: chatObj.hintData?.name || chatObj.name || `未命名会话${length + 1}`
      }
    }

    try {
      // 添加到本地数据库
      await this.chatsDB.push(newChat)
      console.log('新聊天记录已添加:', newChat.hintData.name)
      // 自动切换到新建的聊天
      await this.loadChatByIndex(length)
    } catch (e) {
      console.error('添加新聊天记录失败:', e)
      this.ui.showError(e.message || '添加新聊天记录失败')
    }
  }

  // 封装方法：只传 name 和 systems，自动补全结构
  // 适合普通新建聊天时调用
  async addNewChat(name = '', systems = []) {
    // 调用通用方法，自动补全结构
    return this.addChatObject({
      messages: [],
      systems: systems || [],
      hintData: { name: name }
    })
  }

  // 编辑聊天标题
  async editChatTitle(index) {

    // 先根据索引获取有效的聊天记录，不然会改错。
    await this.loadChatByIndex(index)

    // 输入框
    this.ui.showInputDialog({
      title: '编辑聊天标题',
      placeholder: '请输入新的聊天标题',
      value: this.messages.hintData.name || `未命名会话${index + 1}`,
      onConfirm: async (newTitle) => {
        // 检查是否正在生成中
        if (this._checkGenerating()) return

        // 更新标题
        this.messages.setName(newTitle)
        // 刷新 UI
        this.ui.renderMessageList(this.messages.messages)
        // 更新显示的name
        this.ui.setNavChatName(newTitle)

        // 保存到本地存储
        if (this._checkLocalStorage()) {
          await this.saveChatByIndex(index);
        }
      },
    })
  }

  // 聊天列表弹窗入口
  async showChatList() {
    // 获取所有聊天记录
    const chatList = await this.chatsDB.getAll();

    // 调试输出，确认结构
    console.log('chatList:', chatList);

    // 兼容历史数据，确保每条都有 hintData 字段
    chatList.forEach((item, idx) => {
      if (!item.hintData) item.hintData = { name: `未命名会话${idx + 1}` };
    });

    // 调用 UI 弹窗
    this.ui.showChatListDialog(chatList, {
      // onSwitch 指定切换聊天的回调
      onSwitch: async (index) => {

        await this.loadChatByIndex(index);
        this.ui.dialog.close();

      },
      // pnEdit 和 onDelete 分别指定编辑和删除聊天的回调
      onEdit: (index) => {
        this.editChatTitle(index);
      },
      onDelete: async (index) => {

        await this.deleteCurrentChat(index)

      },
      onAddChat: async () => {
        // 新增聊天
        await this.onAddChat();
      },
      onCopyChat: async (index) => {

        // 调用复制聊天方法
        await this.copyChat(index);

      }
    });
  }
  // 提示词列表弹窗入口
  async showSystemList() {
    // 检查是否正在生成中
    if (this._checkGenerating()) return

    const systems = this.messages.systems || []


    // 定义编辑、开关、删除、添加的回调
    const onEdit = (index) => {
      // 编辑系统提示
      this.ui.showInputDialog({
        title: '编辑系统提示',
        placeholder: '请输入新的系统提示内容',
        value: systems[index]?.content || '',
        onConfirm: (newContent) => {
          // 更新系统提示内容
          this.messages.setSystemContent(index, newContent)
          // 刷新 UI
          this.showSystemList()
          // 保存到本地存储
          if (this._checkLocalStorage()) this.saveChatByIndex()
        }
      })
    }
    const onToggle = (index) => {
      // 切换系统提示开关状态
      this.messages.toggleSystemOpen(index)
      // 刷新 UI
      this.showSystemList()
      // 保存到本地存储
      if (this._checkLocalStorage()) this.saveChatByIndex()
    }
    const onDelete = (index) => {
      // 删除系统提示
      this.messages.deleteSystem(index)
      // 刷新 UI
      this.showSystemList()
      // 保存到本地存储
      if (this._checkLocalStorage()) this.saveChatByIndex()
    }
    const onAdd = () => {
      //打开添加提示的输入弹窗
      this.addSystemPrompt(true)

    }

    // 先打开看一眼
    this.ui.showSystemListDialog(systems, { onEdit, onToggle, onDelete, onAdd })

  }

  // ========== 思维链提示词管理 ==========
  async showFakeTCList() {
    if (this._checkGenerating()) return

    const list = this.messages.fakeToolCalls || []
    const self = this

    const onEdit = (index) => {
      const tc = list[index]
      self.ui.dialog.show({
        title: '编辑思维链提示',
        content: [
          { type: 'text', name: 'toolName', label: '工具名称', value: tc.toolName, placeholder: 'think' },
          { type: 'textarea', name: 'thinking', label: '思维链', value: tc.thinking || '', placeholder: '模型会看到这段"内心独白"……', rows: 3 },
          { type: 'textarea', name: 'toolResult', label: '工具返回结果', value: tc.toolResult, placeholder: 'OK', rows: 3 },
          { type: 'textarea', name: 'note', label: '备注', value: tc.note || '', placeholder: '可选', rows: 2 },
        ],
        buttons: [
          { text: '取消', type: 'default', onClick: () => self.ui.dialog.close() },
          { text: '保存', type: 'primary', submit: true }
        ],
        onSubmit: (formData) => {
          self.messages.setFakeTC(index, {
            toolName: formData.toolName,
            thinking: formData.thinking,
            toolResult: formData.toolResult,
            note: formData.note,
          })
          self.ui.dialog.close()
          self.showFakeTCList()
          if (self._checkLocalStorage()) self.saveChatByIndex()
        }
      })
    }

    const onToggle = (index) => {
      self.messages.toggleFakeTCOpen(index)
      self.showFakeTCList()
      if (self._checkLocalStorage()) self.saveChatByIndex()
    }

    const onDelete = (index) => {
      self.messages.deleteFakeTC(index)
      self.showFakeTCList()
      if (self._checkLocalStorage()) self.saveChatByIndex()
    }

    const onMove = (index, dir) => {
      self.messages.moveFakeTC(index, dir)
      self.showFakeTCList()
      if (self._checkLocalStorage()) self.saveChatByIndex()
    }

    const onAdd = () => {
      self.ui.dialog.show({
        title: '新增思维链提示',
        content: [
          { type: 'text', name: 'toolName', label: '工具名称', value: 'think', placeholder: 'think' },
          { type: 'textarea', name: 'thinking', label: '思维链', value: '', placeholder: '模型会看到这段"内心独白"……', rows: 3 },
          { type: 'textarea', name: 'toolResult', label: '工具返回结果', value: 'OK', placeholder: 'OK', rows: 3 },
          { type: 'textarea', name: 'note', label: '备注', value: '', placeholder: '可选', rows: 2 },
        ],
        buttons: [
          { text: '取消', type: 'default', onClick: () => self.ui.dialog.close() },
          { text: '添加', type: 'primary', submit: true }
        ],
        onSubmit: (formData) => {
          self.messages.FakeTCpush({
            toolName: formData.toolName,
            thinking: formData.thinking,
            toolResult: formData.toolResult,
            note: formData.note,
          })
          self.ui.dialog.close()
          self.showFakeTCList()
          if (self._checkLocalStorage()) self.saveChatByIndex()
        }
      })
    }

    self.ui.showFakeTCListDialog(list, {
      useReasoning: self.messages.useReasoning,
      onToggleReasoning: () => {
        self.messages.toggleReasoning()
        self.showFakeTCList()
        if (self._checkLocalStorage()) self.saveChatByIndex()
      },
      onEdit, onToggle, onDelete, onMove, onAdd
    })
  }

  //如果生成状态在生成中被 改变为false 可以中断生成
  // 普通请求
  async sendNormalRequest(requestBody) {
    // 如果使用免费配置，覆盖部分配置
    const useFreeConfig = window.useFreeConfig || false;
    const cfg = this._getApiConfig();
    const apiUrl = useFreeConfig ? 'https://api.pianren.top/api/chat' : cfg.apiUrl;
    const apiKey = useFreeConfig ? '' : cfg.apiKey;
    const api = new ApiClient(apiKey, apiUrl);

    let reply = ''
    try {
      const res = await api.send(requestBody)
      const { role, content, reasoning_content } = res.choices?.[0]?.message
      reply = content || '无回复'
      this.messages.Mpush({ role: 'assistant', content: reply, reasoning_content })
      this.ui.renderNewMessage({ role: 'assistant', content: reply, reasoning_content })
      //本地存储
      if (this._checkLocalStorage()) this.saveChatByIndex()
    } catch (e) {
      // === 新增：中断后保存已生成内容 ===
      if (reply && reply.trim()) {
        this.messages.Mpush('assistant', reply)
        this.ui.renderNewMessage({ role: 'assistant', content: reply })
        //本地存储
        if (this._checkLocalStorage()) this.saveChatByIndex()
      }
      this.ui.showError(e.message || '请求失败')
    }
  }

  // 流式请求
  async sendStreamRequest(requestBody) {
    // 如果使用免费配置，覆盖部分配置
    const useFreeConfig = window.useFreeConfig || false;
    const cfg = this._getApiConfig();
    const apiUrl = useFreeConfig ? 'https://api.pianren.top/api/chat' : cfg.apiUrl;
    const apiKey = useFreeConfig ? '' : cfg.apiKey;
    const api = new ApiClient(apiKey, apiUrl);
    let lastText = ''
    let tempIndex = this.messages.messages.length
    // 先插入一条空的 assistant 消息作为占位
    this.ui.createOrUpdateMessage({ role: 'assistant', content: '' }, tempIndex)
    try {
      await api.strSend(
        requestBody,
        (message) => {
          const { content, reasoning_content } = message
          // 只更新最后一条 assistant 消息

          this.ui.createOrUpdateMessage({ role: 'assistant', content, reasoning_content }, tempIndex)
          lastText = content
        },
        (message) => {
          const { content, reasoning_content } = message
          // 最终只入库一次，并全量刷新
          this.messages.Mpush({ role: 'assistant', content, reasoning_content })
          this.ui.renderMessageList(this.messages.messages)

          //本地存储
          if (this._checkLocalStorage()) this.saveChatByIndex()

          //打印一下看看
          console.log('流式请求完成:', content, '\n\n', reasoning_content)
        }
      )
    } catch (e) {
      // === 新增：中断后保存已生成内容 ===
      if (lastText && lastText.trim()) {
        this.messages.Mpush('assistant', lastText)
        this.ui.renderMessageList(this.messages.messages)
        //本地存储
        if (this._checkLocalStorage()) this.saveChatByIndex()
      }
      this.ui.showError(e.message || '请求失败')
    }
  }

  // 发送消息，支持参数控制流式，对话轮数限制
  sendMessage(content, isStream = this.useStream) {

    // 检查是否正在生成中
    if (this._checkGenerating()) return
    // 检查内容是否为空
    if (!content?.trim()) return
    this.messages.Mpush('user', content)
    this.ui.renderNewMessage({ role: 'user', content })

    // 如果使用免费配置，覆盖部分配置
    const cfg = this._getApiConfig();
    const useFreeConfig = window.useFreeConfig || false;
    const maxRounds = useFreeConfig ? 40 : cfg.maxRounds;
    const modelName = useFreeConfig ? 'deepseek-chat' : cfg.modelName;

    // 构建请求体，动态决定是否流式
    console.log(this.messages.getMessages(cfg.maxRounds, cfg.roundsCycle))
    const requestBody = new ChatRequestBuilder(
      modelName,
      this.messages.getMessages(maxRounds, 25),
      { stream: isStream, temperature: 0.5, top_P: 0.95  })


    if (isStream) {
      this.sendStreamRequest(requestBody)
    } else {
      this.sendNormalRequest(requestBody)
    }
  }
  //得到快捷回复
  async getQuickReplies() {
    //新建messages实例
    const quickMessages = new Messages()
    //深拷贝数据
    quickMessages.messages = JSON.parse(JSON.stringify(this.messages.messages))
    const systems = JSON.parse(JSON.stringify(this.messages.systems))

    //处理数据，使AI可以区分user和assistant
    quickMessages.messages.forEach(msg => {
      if (msg.role === 'user') {
        msg.content = `user:${msg.content}`
        msg.role = 'assistant' //把user都改成assistant
      } else if (msg.role === 'assistant') {
        msg.content = `assistant:${msg.content}`
        msg.role = 'user' //把assistant都改成user
      }
    })
    //加入伪装的user系统提示
    const systemContent = `${systems.map(system => { return `assistant:{${system?.content || ''}}` }).join(',')} 这些是从系统提示继承的内容，一般认为只会影响AI，除非特殊说明以上内容只对ai方有效，仅做信息共享，你不需要模仿。`
    quickMessages.messages.unshift({ role: 'user', content: systemContent })

    //获得页码加入提示词防止命中缓存，生成一样的回复
    const page = Utils.getLatestQuickReplies(this.messages.messages)?.page || 0
    //规定回复格式
    const prompt = `这是第${page}次请求，请不要生成一样的回复。请基于以上聊天记录，模仿user的语气和意图，主动推进进度，生成3条快捷回复选项，回复格式: ["回复1","回复2","回复3"] 只能返回json格式的数组`
    quickMessages.Spush(prompt)
    quickMessages.Mpush('user', prompt)
    //构建请求体
    const cfg = this._getApiConfig();
    const requestBody = new ChatRequestBuilder(
      cfg.modelName,
      quickMessages.getMessages(this.quickReplyMaxRounds),
      { stream: false, temperature: 0.7, top_P: 0.9, type: 'json_array' }
    )
    //发送请求
    try {
      const api = new ApiClient(cfg.apiKey, cfg.apiUrl)
      // 发送请求
      const res = await api.send(requestBody)
      console.log(requestBody)
      const { content } = res.choices?.[0]?.message
      //尝试解析json
      let replies = []
      try {
        replies = JSON.parse(content)
        console.log('解析后的快捷回复:', replies)
        if (!Array.isArray(replies)) throw new Error('解析结果不是数组')
      } catch (e) {
        console.error('解析快捷回复失败:', e)
        this.ui.showError('快捷回复解析失败，返回内容格式不正确')
        return []
      }
      return replies
    } catch (e) {
      this.ui.showError(e.message || '快捷回复请求失败')
      return []
    }
  }

  //侧边栏
  // 添加系统提示
  addSystemPrompt(showSystemList) {
    // 检查是否正在生成中
    if (this._checkGenerating()) return

    // 构建系统提示输入框配置
    const config = {
      title: '添加系统提示',
      content: [
        { label: '内容', type: 'textarea', name: 'content', placeholder: '请输入系统提示内容', required: true },
      ],
      buttons: [
        { text: "取消", type: "default", onClick: () => this.ui.dialog.close() },
        { text: '添加', type: 'primary', submit: true }
      ],
      onSubmit: (formData) => {
        // 添加
        this.messages.Spush(formData.content)
        // 判断是否本地存储 是则保存
        if (this._checkLocalStorage()) this.saveChatByIndex()
        // 关闭弹窗
        this.ui.dialog.close()
        //判断showSystemList 是否启用
        if (showSystemList) {
          this.showSystemList()
        }
      }
    }
    // 打开弹窗
    this.ui.dialog.show(config)
  }
  // 清空当前聊天
  clearCurrentChat() {
    // 检查是否正在生成中
    if (this._checkGenerating()) return

    // 定义确认回调
    const onConfirm = () => {
      // 清空消息列表
      this.messages.clearMessages()
      // 刷新 UI
      this.ui.renderMessageList(this.messages.messages)
      // 判断是否本地存储 是则保存
      if (this._checkLocalStorage()) this.saveChatByIndex()
    }
    const onCancel = () => {
      // 取消清空操作
      console.log('清空操作已取消')
    }

    // 弹出警示框弹窗
    this.ui.showConfirm('是否确定清空聊天？', '警告', onConfirm, onCancel)
  }
  // 删除本地聊天并清空当前聊天
  async deleteCurrentChat(index = false) {
    // 检查是否正在生成中
    if (this._checkGenerating()) return
    //检查是否开启本地存储
    if (!this._checkLocalStorage()) return
    // 获取有效索引
    index = this._getIndex(index)
    // 弹出确认弹窗
    this.ui.showConfirm(
      '确定要删除该聊天记录吗？此操作不可恢复！',
      '删除确认',
      async () => {
        // 用户确认后再执行删除
        index = this._getIndex(index)
        try {
          await this.chatsDB.splice(index, 1);
          console.log('聊天记录已删除');

          const chats = await this.chatsDB.getAll();
          if (chats.length === 0) {
            // 如果全部删除了，自动新建一个聊天
            await this.addNewChat('未命名会话', this.DEFAULT_SYSTEMS);
            // 切换到新建的聊天
            await this.loadChatByIndex(0);
          } else if (index === this.currentChatIndex) {
            // 当前索引等于当前页码，切换到前一个
            this.currentChatIndex = Math.max(0, this.currentChatIndex - 1)
            localStorage.setItem('currentChatIndex', this.currentChatIndex)
            await this.loadChatByIndex(this.currentChatIndex)

          }

        } catch (e) {
          console.error('删除聊天记录失败:', e);
          this.ui.showError(e.message || '删除聊天记录失败');
        }
      },
      () => {
        // 用户取消，无需操作
      }
    )
  }
  // 编辑配置
  editConfig() {
    // 检查是否正在生成中
    if (this._checkGenerating()) return

    // 获取当前配置
    const currentConfig = this.configManager.getAll()

    const content = [
      { type: 'switch', name: 'useStream', label: '开启流式回复', value: currentConfig.useStream },
      { type: 'switch', name: 'useLocalStorage', label: '开启本地存储(不建议关)', value: currentConfig.useLocalStorage },
      { type: 'number', name: 'maxRounds', label: '最大对话轮数(0当无限)', value: currentConfig.maxRounds },
      { type: 'number', name: 'roundsCycle', label: '对话轮数周期(0当无限)', value: currentConfig.roundsCycle },
      { type: 'html', html: '<p style="color:#E9C000;font-size:12px;">💡 API地址/Key/模型请用 <b>⚡快捷配置</b></p>' },
    ]
    //

    // 打开配置编辑弹窗
    this.ui.dialog.show(
      {
        title: '编辑配置',
        content,
        buttons: [
          { text: "取消", type: "default", onClick: () => this.ui.dialog.close() },
          { text: '保存', type: 'primary', submit: true }
        ],
        onSubmit: (formData) => {
          console.log(formData)
          // 更新配置
          this.updateConfig(formData)
          // 关闭弹窗
          this.ui.dialog.close()
        }
      }
    )
  }
  //设置API Key
  setApiKey() {
    const onConfirm = (apiKey) => {
      const providers = this.configManager.get('providers') || []
      const activeId = this.configManager.get('activeProviderId')
      const p = providers.find(x => x.id === activeId)
      if (p) {
        p.apiKey = apiKey
        this._saveProviders(providers)
      }
      this.api.setApiKey(apiKey)
      this.ui.showSuccess('API Key 设置成功')
    }
    //通用输入框
    this.ui.showInputDialog({ title: '请输入Api Key', placeholder: '请输入Api Key', value: '', onConfirm })
  }
  // 下载聊天记录
  async downloadChat() {
    // 检查是否正在生成中
    if (this._checkGenerating()) return
    //使用 messages 方法导出聊天记录，然后通过 Utils 下载
    const chatData = this.messages.toExportData()
    //转成字符串
    const chatDataStr = JSON.stringify(chatData, null, 2)
    Utils.downloadFile(`${this.messages.hintData.name || 'chat'}.json`, chatData)
  }
  // 上传聊天记录
  async uploadChat() {
    // 检查是否正在生成中
    if (this._checkGenerating()) return
    // 使用 Utils 打开文件选择对话框并读取 JSON 文件
    const file = await Utils.pickLocalFile()
    const chatData = await Utils.readFileAsText(file)
    // 解析 JSON
    let parsedData
    try {
      //解析数据
      parsedData = JSON.parse(chatData)
    } catch (e) {
      // 解析失败
      this.ui.showError('无效的聊天记录文件')
      return
    }
    // 解析为messages通用格式
    const { messages, systems, hintData, fakeToolCalls } = this.messages.parseCompatible(parsedData)
    // 新建聊天记录
    await this.addChatObject({
      messages,
      systems,
      hintData,
      fakeToolCalls: fakeToolCalls || [],
    })
    // 切换到新建的聊天
    const chats = await this.chatsDB.getAll()
    await this.loadChatByIndex(chats.length - 1)
    // 刷新 UI
    this.ui.renderMessageList(this.messages.messages)
    // 提示成功
    this.ui.showSuccess('聊天记录上传成功')

  }


  // 上下文菜单
  // 撤回消息
  undoMessage(id) {
    // 检查是否正在生成中
    if (this._checkGenerating()) return

    this.messages.Mundo(id)
    this.ui.renderMessageList(this.messages.messages)
  }
  // 复制消息
  copyMessage(id) {
    // 检查是否正在生成中
    if (this._checkGenerating()) return

    // 或者直接从页面中获取？
    const div = this.ui.messageList[id]?.querySelector('.message-content')
    const text = div ? div.innerText || div.textContent : '无内容'

    // 构建复制弹窗配置
    const config = {
      title: '复制',
      content: [
        { label: '内容', type: 'textarea', name: 'name', placeholder: '不是你怎么给删了？', required: true, value: text },
      ],
    }
    // 打开弹窗
    this.ui.dialog.show(config)
  }
  // 编辑消息
  editMessage(id) {
    if (this._checkGenerating()) return;

    const message = this.messages.messages[id];
    const content = message?.content || '无内容';

    this.ui.dialog.show({
      title: '编辑消息',
      content: [
        {
          type: 'textarea',
          name: 'content', // 字段名必须与获取时的键名一致
          label: '内容',
          value: content,
          placeholder: '输入修改内容...',
          required: true,
          rows: 8
        }
      ],
      buttons: [
        { text: "取消", type: "default", onClick: () => this.ui.dialog.close() },
        { text: '确定', type: 'primary', submit: true }
      ],
      onSubmit: (formData) => {
        console.log(id, formData, this.messages.messages)
        this.messages.MsetContent(id, formData.content)
        this.ui.refreshMessage(id, this.messages.messages[id])
        // 判断是否本地存储 是则保存
        if (this._checkLocalStorage()) this.saveChatByIndex()
        this.ui.dialog.close();
      }
    });
  }
  // 复制全文
  copyMessageAll(id) {
    // if (this._checkGenerating()) return

    const msg = this.messages.messages[id]
    const text = msg ? msg.content : '无内容'

    Utils.copyToClipboard(
      text,
      () => this.ui.showToast('已复制'),
      (err) => this.ui.showToast(err)
    )
  }
  //新增聊天
  onAddChat() {
    // 检查是否正在生成中
    if (this._checkGenerating()) return
    // 检查是否开启本地存储
    if (!this._checkLocalStorage()) return

    // 默认提示词
    const defaultSystems = this.DEFAULT_SYSTEMS
    // 定义确认回调
    const onConfirm = (name) => {
      // 调用新增聊天方法
      this.addNewChat(name, defaultSystems)
    }
    this.ui.showInputDialog({ title: '输入聊天名称', placeholder: '聊天名称', value: '', onConfirm })
  }
  // 复制聊天记录
  async copyChat(index) {
    // 检查是否正在生成中
    if (this._checkGenerating()) return
    // 检查是否开启本地存储
    if (!this._checkLocalStorage()) return

    // 切换到指定索引的聊天记录
    await this.loadChatByIndex(index)
    // 深拷贝当前聊天记录
    const chatData = JSON.parse(JSON.stringify({
      messages: this.messages.messages,
      systems: this.messages.systems,
      hintData: this.messages.hintData,
      fakeToolCalls: this.messages.fakeToolCalls,
    }))
    // 新建聊天记录
    await this.addChatObject(chatData)
    // 切换到新建的聊天
    const chats = await this.chatsDB.getAll()
    await this.loadChatByIndex(chats.length - 1)
    // 刷新 UI
    this.ui.renderMessageList(this.messages.messages)
    // 刷新弹窗
    this.showChatList()
  }
  // ==================== Provider 管理 ====================

  // 获取当前激活的服务商
  _getActiveProvider() {
    const providers = this.configManager.get('providers') || []
    const activeId = this.configManager.get('activeProviderId')
    const found = providers.find(p => p.id === activeId)
    if (found) return found
    // 降级：返回第一个 provider，或空占位
    if (providers.length > 0) return providers[0]
    return { id: '', name: '未配置', apiUrl: '', apiKey: '', models: [], selectedModel: '' }
  }

  // 保存 provider 列表
  _saveProviders(providers) {
    this.configManager.set('providers', providers)
  }

  // 迁移旧版扁平 API 配置 → provider
  _migrateOldConfig() {
    const oldKey = this.configManager.get('API_KEY')
    const oldUrl = this.configManager.get('API_URL_CHAT')
    const oldModel = this.configManager.get('MODEL_NAME_CHAT')
    if (!oldKey && !oldUrl) return // 没旧数据，跳过

    const providers = this.configManager.get('providers') || []
    const deepseek = providers.find(p => p.id === 'deepseek')
    if (deepseek) {
      if (oldKey) deepseek.apiKey = oldKey
      if (oldUrl) deepseek.apiUrl = oldUrl
      if (oldModel) deepseek.selectedModel = oldModel
      this._saveProviders(providers)
    }
    // 清除旧字段
    this.configManager.set('API_KEY', '')
    this.configManager.set('API_URL_CHAT', '')
    this.configManager.set('MODEL_NAME_CHAT', '')
  }

  // 实时获取 API 配置
  _getApiConfig() {
    const p = this._getActiveProvider()
    return {
      apiKey: p.apiKey,
      apiUrl: p.apiUrl,
      modelName: p.selectedModel,
      useStream: this.configManager.get('useStream'),
      maxRounds: this.configManager.get('maxRounds'),
      roundsCycle: this.configManager.get('roundsCycle'),
    }
  }

  // 修改配置
  updateConfig(newConfig) {
    // 批量更新配置
    this.configManager.setAll(newConfig)
    // 同步到实例属性
    this.useStream = this.configManager.get('useStream')
    this.useLocalStorage = this.configManager.get('useLocalStorage')
    this.maxRounds = this.configManager.get('maxRounds')
    this.roundsCycle = this.configManager.get('roundsCycle')
    this.DEFAULT_SYSTEMS = this.configManager.get('DEFAULT_SYSTEMS')
    // 同步 apiClient
    const p = this._getActiveProvider()
    this.api.setApiKey(p.apiKey)
    this.api.setApiUrl(p.apiUrl)
  }

  // ==================== 快捷配置弹窗 ====================

  async quickConfig() {
    if (this._checkGenerating()) return

    const self = this
    const providers = JSON.parse(JSON.stringify(this.configManager.get('providers') || []))
    let currentAid = this.configManager.get('activeProviderId')

    // ---- DOM 快捷函数（DialogManager 只设 name，不设 id，所以用 name 选择器）----
    const $ = (sel) => document.querySelector(sel)
    const $id = (id) => document.getElementById(id)

    const getUrlInput = () => $('[name="apiUrl"]')
    const getKeyInput = () => $('[name="apiKey"]')
    const getModelSelect = () => $id('quickCfgModel')
    const getStatusEl = () => $id('quickCfgStatus')
    const getTabsEl = () => $id('quickCfgTabs')
    const getDelBtn = () => $id('quickCfgDelBtn')
    const getFetchBtn = () => $id('quickCfgFetchBtn')
    const getAddBtn = () => $id('quickCfgAddBtn')
    const getHiddenAid = () => $id('quickCfgActiveId')

    // 获取当前 activeId 对应的 provider，降级取第一个
    const curProvider = () => providers.find(x => x.id === currentAid) || providers[0] || {}

    // ---- 渲染函数 ----
    const renderTabs = () => {
      const tabsEl = getTabsEl()
      if (!tabsEl) return
      tabsEl.innerHTML = providers.map(prv => {
        const isActive = prv.id === currentAid
        const style = isActive
          ? 'background:#E9C000;color:#1a1a2e;font-weight:bold;'
          : 'background:#333;color:#ccc;'
        return `<button type="button" data-pid="${prv.id}" style="margin:2px;padding:4px 10px;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:12px;${style}">${prv.name}</button>`
      }).join('') + `<button type="button" id="quickCfgAddBtn" style="margin:2px;padding:4px 8px;background:#4CAF50;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">+</button>`
    }

    const renderDetail = () => {
      const p = curProvider()
      const urlInput = getUrlInput()
      const keyInput = getKeyInput()
      const modelSelect = getModelSelect()
      const statusEl = getStatusEl()
      const delBtn = getDelBtn()
      if (urlInput) urlInput.value = p.apiUrl || ''
      if (keyInput) keyInput.value = p.apiKey || ''
      if (delBtn) delBtn.style.display = providers.length <= 1 ? 'none' : ''
      if (statusEl) statusEl.innerHTML = ''
      if (modelSelect) {
        const models = p.models || []
        if (models.length) {
          modelSelect.innerHTML = models.map(m =>
            `<option value="${m.id}" ${m.id === p.selectedModel ? 'selected' : ''}>${m.id}${m.owned_by ? ` (${m.owned_by})` : ''}</option>`
          ).join('')
          modelSelect.disabled = false
        } else {
          modelSelect.innerHTML = '<option>请先获取模型列表</option>'
          modelSelect.disabled = true
        }
      }
    }

    // 切换服务商
    const switchTo = (pid) => {
      const idx = providers.findIndex(x => x.id === pid)
      if (idx === -1) return
      // 先写回当前表单值
      const urlInput = getUrlInput()
      const keyInput = getKeyInput()
      const old = providers.find(x => x.id === currentAid)
      if (old) {
        if (urlInput) old.apiUrl = urlInput.value
        if (keyInput) old.apiKey = keyInput.value
      }
      // 切换
      currentAid = providers[idx].id
      renderAll()
    }

    const renderAll = () => {
      const hidden = getHiddenAid()
      if (hidden) hidden.value = currentAid
      renderTabs()
      renderDetail()
      bindEvents()
    }

    const bindEvents = () => {
      // 标签点击
      getTabsEl()?.querySelectorAll('button[data-pid]').forEach(btn => {
        btn.onclick = () => switchTo(btn.dataset.pid)
      })
      // + 添加
      const addBtn = getAddBtn()
      if (addBtn) {
        addBtn.onclick = () => {
          const name = prompt('服务商名称（如 OpenAI / 火山引擎）')
          if (!name) return
          const url = prompt('API 地址（完整 chat/completions 路径）', 'https://api.openai.com/v1/chat/completions')
          if (!url) return
          const key = prompt('API Key（可选，稍后填）') || ''
          const newId = 'provider_' + Date.now()
          providers.push({ id: newId, name, apiUrl: url, apiKey: key, models: [], selectedModel: '' })
          switchTo(newId)
        }
      }
      // 删除
      const delBtn = getDelBtn()
      if (delBtn) {
        delBtn.onclick = () => {
          const p = curProvider()
          if (providers.length <= 1) { self.ui.showError('至少保留一个服务商'); return }
          if (!confirm(`确定删除「${p.name}」？`)) return
          const idx = providers.findIndex(x => x.id === currentAid)
          providers.splice(idx, 1)
          switchTo(providers[0].id)
        }
      }
      // 获取模型
      const fetchBtn = getFetchBtn()
      if (fetchBtn) {
        fetchBtn.onclick = async () => {
          const urlInput = getUrlInput()
          const keyInput = getKeyInput()
          const modelSelect = getModelSelect()
          const statusEl = getStatusEl()
          const baseUrl = urlInput?.value?.trim()
          const apiKey = keyInput?.value?.trim()

          if (!baseUrl) { self.ui.showError('请填写API地址'); return }
          if (!apiKey) { self.ui.showError('请填写API Key'); return }

          statusEl.textContent = '⏳ 正在获取模型列表...'
          fetchBtn.disabled = true
          modelSelect.disabled = true

          try {
            const modelsUrl = baseUrl.replace(/\/chat\/completions$/, '/models')
            const res = await fetch(modelsUrl, {
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            const models = data.data || []
            if (!models.length) throw new Error('返回的模型列表为空')

            const cur = curProvider()
            cur.models = models.map(m => ({ id: m.id, owned_by: m.owned_by }))
            if (!cur.selectedModel && models.length) cur.selectedModel = models[0].id
            renderDetail()
            statusEl.innerHTML = `<span style="color:#4CAF50;">✅ 获取到 ${models.length} 个模型</span>`
          } catch (e) {
            statusEl.innerHTML = `<span style="color:#f44336;">❌ 获取失败: ${e.message}</span>`
            modelSelect.disabled = true
          } finally {
            fetchBtn.disabled = false
          }
        }
      }
    }

    // 显示弹窗
    this.ui.dialog.show({
      title: '服务商 & 模型管理',
      content: [
        { type: 'html', html: '<div id="quickCfgTabs" style="margin-bottom:8px;display:flex;flex-wrap:wrap;align-items:center;"></div>' },
        { type: 'html', html: '<div id="quickCfgStatus" style="color:#E9C000;font-size:12px;min-height:18px;margin-bottom:4px;"></div>' },
        { type: 'text', name: 'apiUrl', label: 'API地址 (chat/completions)', value: '', placeholder: 'https://api.deepseek.com/v1/chat/completions' },
        { type: 'text', name: 'apiKey', label: 'API Key', value: '', placeholder: 'sk-...' },
        { type: 'html', html: '<div style="text-align:right;margin:6px 0;"><button type="button" id="quickCfgFetchBtn" style="background:#E9C000;color:#1a1a2e;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:12px;">📡 获取模型列表</button></div>' },
        { type: 'html', html: '<label style="display:block;margin-bottom:4px;font-size:13px;color:#B0C0C0;">模型</label>' },
        { type: 'html', html: '<select id="quickCfgModel" style="width:100%;padding:8px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;font-size:13px;" disabled><option>请先获取模型列表</option></select>' },
        { type: 'html', html: '<input type="hidden" id="quickCfgActiveId" value="' + currentAid + '">' },
      ],
      buttons: [
        { text: '删除', type: 'danger', id: 'quickCfgDelBtn', onClick: () => {} },  // 由 bindEvents 接管
        { text: '取消', type: 'default', onClick: () => this.ui.dialog.close() },
        { text: '保存', type: 'primary', submit: true }
      ],
      onSubmit: (formData) => {
        // 把当前表单值写回 providers
        const p = curProvider()
        if (p) {
          p.apiUrl = formData.apiUrl
          p.apiKey = formData.apiKey
        }
        // 获取选中模型
        const modelSelect = getModelSelect()
        const selectedModel = modelSelect?.value
        if (selectedModel && selectedModel !== '请先获取模型列表') {
          if (p) p.selectedModel = selectedModel
        }
        // 保存到 configManager
        this._saveProviders(providers)
        this.configManager.set('activeProviderId', currentAid)
        // 同步 apiClient
        const active = curProvider()
        this.api.setApiKey(active.apiKey)
        this.api.setApiUrl(active.apiUrl)
        this.ui.dialog.close()
        this.ui.showSuccess(`已切换到「${active.name}」`)
      },
      onOpen: () => {
        renderAll()
        // 删除按钮特殊处理（DialogManager 的 submit 机制会让 type=button 也触发表单事件，需要 clone 覆盖）
        const delBtn = getDelBtn()
        if (delBtn) {
          const newBtn = delBtn.cloneNode(true)
          delBtn.parentNode.replaceChild(newBtn, delBtn)
        }
      }
    })
  }
  // 打开快捷回复面板
  async openQuickReplyPanel() {
    // 检查是否正在生成中
    if (this._checkGenerating()) return

    //打开快捷回复面板
    this.ui.openPanel('quick-reply-panel')
    //先判断该进度是否已有快捷回复
    const quickReplies = Utils.getLatestQuickReplies(this.messages.messages)
    if (quickReplies?.replies?.[0]) {

      // 如果有快捷回复，直接渲染
      this.ui.renderQuickReplies(quickReplies)
      return
    }

    // 如果没有快捷回复，先获取新的快捷回复
    const latestReplies = await this.fetchQuickReplies()
    // 渲染快捷回复
    this.ui.renderQuickReplies(latestReplies)
  }
  // 关闭快捷回复面板
  closeQuickReplyPanel() {
    this.ui.closePanel()
  }
  //切换快捷回复面板的显示状态
  toggleQuickReplyPanel() {


    //获取一下按钮
    // const btn = document.querySelector('.quick-reply')
    //isPanelOpen 方法判断面板是否打开
    if (this.ui.isPanelOpen('quick-reply-panel')) {
      // btn.dataset.active = 'false'
      this.closeQuickReplyPanel()
    } else {
      // btn.dataset.active = 'true'
      this.openQuickReplyPanel()
    }
  }
  // 快捷回复结构 {page:0,replies:[['回复1','回复2','回复3']...]}
  //构建完整快速回复结构 已有数据则添加，未有则创建
  buildQuickReplyData(replies) {
    // 检查是否为数组
    if (!Array.isArray(replies)) {
      console.warn('快捷回复数据格式不正确，应为数组')
      return { page: 0, replies: ['失败'] }
    }
    // 获取最新一条消息的快捷回复数据
    const latestReplies = Utils.getLatestQuickReplies(this.messages.messages)
    // 如果已有快捷回复数据，则合并
    if (latestReplies && Array.isArray(latestReplies.replies)) {
      // 合并新的回复
      latestReplies.replies.push(replies)
      // 修改页码
      latestReplies.page = latestReplies.replies.length - 1
      return latestReplies
    }
    // 如果没有快捷回复数据，则创建新的
    return { page: 0, replies: [replies] }
  }
  // 获取快捷回复并构建数据
  async fetchQuickReplies() {
    // 按照格式渲染三个加载中的提示
    this.ui.renderQuickReplies({ page: 0, replies: [['加载中...', '加载中...', '加载中...']] })
    // 获取快捷回复
    const replies = await this.getQuickReplies()
    // 如果获取失败或为空，返回错误提示
    if (replies.length === 0) {
      // 如果获取失败，显示错误提示
      this.ui.renderQuickReplies({ page: 0, replies: [['获取失败']] })
      return { page: 0, replies: ['获取失败'] }
    }
    // 构建完整快捷回复数据
    const quickReplyData = this.buildQuickReplyData(replies)
    // 保存到最新消息中
    Utils.setLatestQuickReplies(this.messages.messages, quickReplyData)
    //返回结果
    return quickReplyData
  }


  // 检查生成中
  _checkGenerating() {
    if (!this.api.isGenerating) return false
    alert('正在生成回复，请稍候…')
    return true
  }
  // 检查是否开启保存
  _checkLocalStorage() {
    if (!this.useLocalStorage) {
      // 未来给关闭本地存储的操作做这个提示，给这个提示一直谈弹窗。
      // alert('当前未开启本地存储，请在设置中开启，如果不需要本地存储请无视此提示。')
      return false
    }
    return true
  }

  // 工具方法：获取有效索引
  _getIndex(index) {
    // 当索引无效时使用currentChatIndex 或者 0
    // undefined/null/false/空字符串都用当前页码
    if (index === undefined || index === null || index === false || index === '') {
      return Number(this.currentChatIndex) || 0;
    }
    return Number(index);
  }

  // 新增：中断生成
  interruptGenerate() {
    this.api.interrupt()
  }


}

// 实例化并挂载到全局（让 UI 能用到）
window.app = new ChatApp()