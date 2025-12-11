//我要解决部分配置编辑过后需要刷新页面的问题()，然后将apikey也统一到 ConfigManager 中管理

// 在主应用 (main.js) 中：
class ChatApp {
  constructor() {
    // 配置管理器，所有配置都通过它读写
    this.configManager = new ConfigManager(window.defaultConfig)

    // 读取配置项
    this.useStream = this.configManager.get('useStream')
    this.useLocalStorage = this.configManager.get('useLocalStorage')
    this.maxRounds = this.configManager.get('maxRounds')
    this.roundsCycle = this.configManager.get('roundsCycle')
    this.DEFAULT_SYSTEMS = this.configManager.get('DEFAULT_SYSTEMS')
    this.API_URL_CHAT = this.configManager.get('API_URL_CHAT')
    this.MODEL_NAME_CHAT = this.configManager.get('MODEL_NAME_CHAT')
    this.API_KEY = this.configManager.get('API_KEY')

    //快捷回复API参数
    this.quickReplyUrl = this.configManager.get('API_URL_CHAT')
    this.quickReplyModel = this.configManager.get('MODEL_NAME_CHAT')
    this.quickReplyKey = this.configManager.get('API_KEY')
    this.quickReplyMaxRounds = 0




    // 其它初始化...
    this.ui = new UIController()
    this.api = new ApiClient(this.API_KEY, this.API_URL_CHAT)
    this.messages = new Messages()
    this.chatsDB = new LocalArrayDB('chats')
    this.currentChatIndex = localStorage.getItem('currentChatIndex') || 0

    // 绑定回调
    //顶部导航栏
    this.ui.onAddPrompt = () => this.addSystemPrompt() // 添加系统提示
    this.ui.onSetPrompt = () => this.showSystemList() // 管理提示词-- --暂无
    this.ui.onClearChat = () => this.clearCurrentChat() // 清空当前聊天
    this.ui.onDeleteChat = () => this.deleteCurrentChat() // 删除当前聊天
    this.ui.onSwitchChat = () => this.showChatList() // 切换聊天列表
    this.ui.onEditConfig = () => this.editConfig() // 编辑可配置项
    this.ui.onSetApiKey = () => this.setApiKey() // 设置API Key
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

    // 初始化
    this.init()
  }
  //初始化
  async init() {
    // 检查是否有API Key
    //读取一下以前的存储位置

    if (localStorage.getItem('apiKey')) {
      this.API_KEY = localStorage.getItem('apiKey')
      this.configManager.set('API_KEY', this.API_KEY)
      localStorage.removeItem('apiKey') // 删除旧的存储位置
    }
    if (!this.API_KEY || this.API_KEY === '') {
      this.ui.showError('请先设置API Key')
    }

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
      // 兼容历史数据，确保 toolState 存在
      if (!this.messages.hintData.toolState) {
        this.messages.hintData.toolState = {
          currentTime: '同步失败',
          currentTime_TS: 0,
        }
      }
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
      const { messages, systems, hintData } = this.messages
      // 把他们打包成一个对象
      const chatData = {
        messages,
        systems,
        hintData,
      }
      // 保存聊天记录到数据库
      await this.chatsDB.update(index, chatData)
      console.log('聊天记录已保存')
    } catch (e) {
      console.error('保存聊天记录失败:', e)
      this.ui.showError(e.message || '保存聊天记录失败')
    }
  }
  // 新增聊天数据
  async addNewChat(name = '', systems = []) {
    // 检查是否正在生成中
    if (this._checkGenerating()) return
    // 检查是否开启本地存储
    if (!this._checkLocalStorage()) return

    //根据name、默认systems创建一个新的聊天记录

    //获取长度
    const chats = await this.chatsDB.getAll();
    const length = chats.length;

    const newChat = {
      messages: [],
      systems: systems || [],
      hintData: { name: name || `未命名会话${length + 1}` },
    }

    // 将新的聊天记录添加到数据库
    try {
      await this.chatsDB.push(newChat)
      console.log('新聊天记录已添加:', newChat.hintData.name)

      // 切换到新聊天记录
      await this.loadChatByIndex(length)
    } catch (e) {
      console.error('添加新聊天记录失败:', e)
      this.ui.showError(e.message || '添加新聊天记录失败')
    }
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

  //如果生成状态在生成中被 改变为false 可以中断生成
  // 普通请求
  async sendNormalRequest(requestBody) {
    // 如果使用免费配置，覆盖部分配置
    const useFreeConfig = window.useFreeConfig || false;
    const apiUrl = useFreeConfig ? 'https://api.pianren.top/api/chat' : this.API_URL_CHAT;
    const apiKey = useFreeConfig ? '' : (this.API_KEY);
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
    const apiUrl = useFreeConfig ? 'https://api.pianren.top/api/chat' : this.API_URL_CHAT;
    const apiKey = useFreeConfig ? '' : (this.API_KEY);
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
    const useFreeConfig = window.useFreeConfig || false;
    const maxRounds = useFreeConfig ? 40 : this.maxRounds;
    const modelName = useFreeConfig ? 'deepseek-chat' : this.MODEL_NAME_CHAT;


    // 构建请求体，动态决定是否流式

    console.log(this.messages.getMessages(this.maxRounds, this.roundsCycle))
    const requestBody = new ChatRequestBuilder(
      modelName,
      this.messages.getMessages(maxRounds, 25),
      { stream: isStream, temperature: 0.5, top_P: 0.95 })


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
    const requestBody = new ChatRequestBuilder(
      this.quickReplyModel,
      quickMessages.getMessages(this.quickReplyMaxRounds),
      { stream: false, temperature: 0.7, top_P: 0.9, type: 'json_array' },
      this.quickReplyKey,
      this.quickReplyUrl
    )
    //发送请求
    try {
      const api = new ApiClient(this.quickReplyKey, this.quickReplyUrl)
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
      { type: 'number', name: 'roundsCycle', label: '对话轮数周期(0当无限)本功能旨在防止因为限制上文频繁变动上下文导致无法命中缓存导致成本增加，周期轮数就是超过最大轮数后每多少轮变动一次上下文', value: currentConfig.roundsCycle },
      { type: 'text', name: 'API_URL_CHAT', label: '对话API请求地址', value: currentConfig.API_URL_CHAT },
      { type: 'text', name: 'MODEL_NAME_CHAT', label: '对话模型名称', value: currentConfig.MODEL_NAME_CHAT },
      { type: 'text', name: 'API_KEY', label: 'API Key', value: currentConfig.API_KEY },
      // { type: 'textarea', name: 'DEFAULT_SYSTEMS', label: '默认系统提示词',value: , rows: 5 }
    ]
    //

    // 打开配置编辑弹窗
    this.ui.dialog.show(
      {
        title: '编辑配置(部分需要重启生效)',
        content,
        buttons: [
          { text: "取消", type: "default", onClick: () => this.ui.dialog.close() },
          { text: '保存', type: 'primary', submit: true }
        ],
        onSubmit: (formData) => {
          console.log(formData)
          // 声明一下
          const { useStream, useLocalStorage, maxRounds } = formData
          // 更新配置
          this.updateConfig(formData)
          // 解决部分配置编辑过后需要刷新页面(参数被写死)的问题
          this.api.setApiKey(formData.API_KEY)
          this.api.setApiUrl(formData.API_URL_CHAT)
          // 关闭弹窗
          this.ui.dialog.close()
        }
      }
    )
  }
  //设置API Key
  setApiKey() {
    const onConfirm = (apiKey) => {

      // 设置 API Key
      this.api.setApiKey(apiKey)
      // 更新配置管理器中的 API Key
      this.configManager.set('API_KEY', apiKey)
      console.log('API Key 已设置:', apiKey)

      // 提示成功
      this.ui.showSuccess('API Key 设置成功')
    }
    //通用输入框
    this.ui.showInputDialog({ title: '请输入Api Key', placeholder: '请输入Api Key', value: '', onConfirm })

  }
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
  // 修改配置
  updateConfig(newConfig) {
    // 批量更新配置
    this.configManager.setAll(newConfig)
    // 同步到实例属性
    this.useStream = this.configManager.get('useStream')
    this.useLocalStorage = this.configManager.get('useLocalStorage')
    this.maxRounds = this.configManager.get('maxRounds')
    this.DEFAULT_SYSTEMS = this.configManager.get('DEFAULT_SYSTEMS')
    this.MODEL_NAME_CHAT = this.configManager.get('MODEL_NAME_CHAT')
    // 其它需要同步的属性也可以加
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