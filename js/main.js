

// 在主应用 (main.js) 中：
class ChatApp {
  constructor() {
    // 配置管理器，所有配置都通过它读写
    this.configManager = new ConfigManager(window.defaultConfig)

    // 读取配置项
    this.useStream = this.configManager.get('useStream')
    this.useLocalStorage = this.configManager.get('useLocalStorage')
    this.maxRounds = this.configManager.get('maxRounds')
    this.DEFAULT_SYSTEMS = this.configManager.get('DEFAULT_SYSTEMS')
    this.API_URL_CHAT = this.configManager.get('API_URL_CHAT')
    this.MODEL_NAME_CHAT = this.configManager.get('MODEL_NAME_CHAT')


    // 其它初始化...
    this.ui = new UIController()
    this.api = new ApiClient(localStorage.getItem('apiKey'), this.API_URL_CHAT)
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

    // 初始化
    this.init()
  }
  //初始化
  async init() {
    // 检查是否有API Key
    if (!this.api.apiKey) {
      this.ui.showError('请先设置API Key')
      return
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
    let reply = ''
    try {
      const res = await this.api.send(requestBody)
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
    let lastText = ''
    let tempIndex = this.messages.messages.length
    // 先插入一条空的 assistant 消息作为占位
    this.ui.createOrUpdateMessage({ role: 'assistant', content: '' }, tempIndex)
    try {
      await this.api.strSend(
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

    // 构建请求体，动态决定是否流式
    const requestBody = new ChatRequestBuilder(
      this.MODEL_NAME_CHAT,
      this.messages.getMessages(this.maxRounds),
      { stream: isStream, temperature: 0.5, top_P: 0.95 })


    if (isStream) {
      this.sendStreamRequest(requestBody)
    } else {
      this.sendNormalRequest(requestBody)
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
      { type: 'text', name: 'API_URL_CHAT', label: '对话API请求地址', value: currentConfig.API_URL_CHAT },
      { type: 'text', name: 'MODEL_NAME_CHAT', label: '对话模型名称', value: currentConfig.MODEL_NAME_CHAT },
      // { type: 'textarea', name: 'DEFAULT_SYSTEMS', label: '默认系统提示词',value: , rows: 5 }
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
          // 声明一下
          const { useStream, useLocalStorage, maxRounds } = formData
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

      // 设置 API Key
      this.api.setApiKey(apiKey)
      localStorage.setItem('apiKey', apiKey) // 保存到本地存储
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
    const div = this.ui.messageList[id]?.querySelector('div')
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
    if (this._checkGenerating()) return

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
    // 其它需要同步的属性也可以加
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