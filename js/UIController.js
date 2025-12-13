class UIController {
  constructor() {
    // 初始化弹窗管理器
    this.dialog = new DialogManager()
    // DOM 元素
    this.nav = document.querySelector('.nav')
    this.navChatName = this.nav.querySelector('.navChatName') //聊天的Name显示区域
    this.chatList = document.querySelector('.list')
    this.input = document.querySelector('.inputBox .input')
    this.submit = document.querySelector('.inputArea .submit')
    this.contextMenu = document.querySelector('.ContextMenu')
    this.toolbar = document.querySelector('.toolbar') // 工具栏小按钮行
    this.inputPanel = document.querySelector('.inputPanel') // 输入面板
    this.quickReply = document.querySelector('.quick-reply-panel-btn') // 快捷回复按钮
    this.quickReplyPanel = document.querySelector('.quick-reply-panel') // 快捷回复列表盒子

    // 消息列表缓存
    this.messageList = []

    // Markdown渲染器
    this.md = window.markdownit({
      breaks: true,
      linkify: true,
      html: true
    })

    // 状态缓存 : 长按目标 
    this.lastLongPressTarget = null

    // 初始化事件
    this._bindEvents()
  }

  // 统一事件绑定入口
  _bindEvents() {
    // 导航栏事件
    this.nav.addEventListener('click', this._handleNavClick.bind(this))

    // 消息列表事件
    this.chatList.addEventListener('contextmenu', this._handleContextMenu.bind(this))

    // 输入事件
    this.submit.addEventListener('click', this._handleSubmit.bind(this))
    this.input.addEventListener('keydown', this._handleKeydown.bind(this))
    this._handleTextareaAutoResize() //文本域自适应高度
    this._toggleSubmitBtn() //处理切换按钮状态事件

    // 上下文菜单
    this.contextMenu.addEventListener('click', this._handleMenuAction.bind(this))

    // 工具栏小按钮事件
    this.toolbar.addEventListener('click', this._handleToolbarClick.bind(this))

    // 快捷回复按钮事件
    this.quickReply.addEventListener('click', this._handleQuickReplyClick.bind(this))

    // cot-placeholder 折叠/展开事件
    this.chatList.addEventListener('click', this.toggleCotCollapse.bind(this))
  }
  // 处理导航栏点击事件
  _handleNavClick(e) {
    const target = e.target

    //判断是否为setBtn 内的按钮
    if (target.closest('.setBtn button')) {
      const button = target.closest('button')
      const action = button.dataset.action

      const actionMap = {

        "add-prompt": () => this.onAddPrompt?.(),
        "set-prompt": () => this.onSetPrompt?.(),
        "clear-chat": () => this.onClearChat?.(),
        "delete-chat": () => this.onDeleteChat?.(),
        "edit-config": () => this.onEditConfig?.(),
        "set-ApiKey": () => this.onSetApiKey?.(),
        "downChat": () => this.onDownloadChat?.(),
        "upChat": () => this.onUploadChat?.(),
      }

      // 执行操作或提示未知类型
      console.log(action)
      const fn = actionMap[action]
      fn ? fn() : console.warn(`未知操作类型: ${action}`)

      return
    }

    /// 处理切换聊天按钮
    if (target.closest('.toggleBtn')) {
      this.onSwitchChat?.();
    }
  }
  // 处理长按事件
  _handleContextMenu(e) {
    e.preventDefault()

    const messageItem = e.target.closest('li')
    if (!messageItem) return

    // 显示菜单
    this.contextMenu.style.left = `${e.clientX}px`
    this.contextMenu.style.top = `${e.clientY}px`
    this.contextMenu.showModal()

    // 保存选中消息ID
    this.selectedMessageId = messageItem.dataset.id

    //点击就关
    document.addEventListener('click', () => { this.contextMenu.close() })
  }
  // 手动触发input事件
  _oninput(element) {
    const inputEvent = new Event('input')
    element.dispatchEvent(inputEvent)
  }
  // 处理提交事件
  _handleSubmit() {
    const content = this.input.value
    if (!content) return

    this.onSubmit?.(content)
    this.input.value = ''
    //清空之后手动触发一次input
    this._oninput(this.input)
  }
  // 处理键盘ctrl + Enter事件
  _handleKeydown(e) {
    if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this._handleSubmit()
    }
  }
  // 处理自适应文本域高度事件
  _handleTextareaAutoResize() {
    //监听输入事件
    this.input.addEventListener('input', (e) => {
      const target = e.target
      //重置高度
      target.style.height = '32px'
      //设置高度
      e.target.style.height = e.target.scrollHeight + 'px'
    })
  }
  // 处理切换按钮状态事件 
  _toggleSubmitBtn() {
    //监听输入事件
    this.input.addEventListener('input', (e) => {
      const target = e.target
      const submit = this.submit
      //判断是否不为空，是则添加类名，否则删除。
      if (target.value !== '') {
        submit.classList.add('submit-action')
      } else {
        submit.classList.remove('submit-action')
      }
    })
  }
  // 处理上下文菜单操作事件
  _handleMenuAction(e) {
    //获取点击到按钮的自定义属性
    const action = e.target.closest('li')?.dataset.action

    const actionMap = {
      'undo': () => this.onUndo?.(this.selectedMessageId),
      'copy': () => this.onCopy?.(this.selectedMessageId),
      'edit': () => this.onEdit?.(this.selectedMessageId),
      'copy-all': () => this.onCopyAll?.(this.selectedMessageId),
    }
    // 执行操作
    actionMap[action]?.()

    // 关闭菜单
    this.contextMenu.close()
  }
  // 处理toolbar小按钮点击事件
  _handleToolbarClick(e) {
    const target = e.target.closest('button')
    if (!target) return

    const action = target.dataset.action
    const actionMap = {
      'to-bottom': () => this.onScrollToBottom?.(),
      'add-chat': () => this.onAddChat?.(),
    }

    // 执行操作或提示未知类型
    const fn = actionMap[action]
    fn ? fn() : console.warn(`未知操作类型: ${action}`)
  }

  //滚动到chatList最底部
  scrollToBottom() {
    this.chatList.scrollTo({
      top: this.chatList.scrollHeight,
      behavior: 'smooth' // 平滑滚动动画
    });
  }
  // 处理快捷回复按钮点击事件
  _handleQuickReplyClick() {
    this.onQuickReplyClick?.()
  }

  // cot-placeholder 折叠/展开事件
  toggleCotCollapse(e) {
    const cot = e.target.closest('.cot-placeholder');
    if (cot) {
      cot.dataset.collapse = (cot.dataset?.collapse === 'true' ? 'false' : 'true');
    }
  }


  // 开启指定类型的面板
  openPanel(type) {
    this.closePanel();

    const panel = this.inputPanel.querySelector(`.${type}`);
    const btn = document.querySelector(`.${type}-btn`); // 新增按钮选择

    if (panel && btn) {
      panel.dataset.visible = 'true';
      btn.dataset.active = 'true'; // 同步按钮状态

      const closeHandler = (e) => {
        // 排除面板、按钮及其子元素
        if (!this.inputPanel.contains(e.target) &&
          !btn.contains(e.target)) {
          this.closePanel();
          document.removeEventListener('click', closeHandler);
        }
      };

      document.addEventListener('click', closeHandler, true);

      // 同时阻止按钮和面板的冒泡
      [panel, btn].forEach(el => {
        el.querySelectorAll('*').forEach(child => {
          child.addEventListener('click', e => e.stopPropagation());
        });
      });
    }
  }

  // 关闭所有面板
  closePanel() {
    document.querySelectorAll('.panels').forEach(panel => {
      panel.dataset.visible = 'false';
    });
    // 同时关闭所有关联按钮的状态
    document.querySelectorAll('.panels-btn').forEach(btn => {
      btn.dataset.active = 'false';
    });
  }
  //isPanelOpen(type) 方法判断面板是否打开
  isPanelOpen(type) {
    const panel = this.inputPanel.querySelector(`.${type}`);
    return panel && panel.dataset.visible === 'true';
  }

  // 快捷回复结构 {page:0,replies:[['回复1','回复2','回复3']...]}
  // 渲染快捷回复数据
  renderQuickReplies(data) {

    if (!data) {
      console.warn('无效的快捷回复数据')
      return
    }

    // 清空现有列表
    this.quickReplyPanel.querySelector('ul').innerHTML = ''

    //获取页码
    const page = data.page || 0

    // 遍历数据并渲染
    data.replies[page]?.forEach((reply, index) => {
      const li = document.createElement('li')
      li.textContent = reply
      li.className = 'quick-reply-item'
      li.addEventListener('click', () => {
        this.input.value = reply // 设置输入框内容
        this._oninput(this.input) // 手动触发input事件
      })
      this.quickReplyPanel.querySelector('ul').appendChild(li)
    })

    //更新页码显示
    const shuffleBtn = this.quickReplyPanel.querySelector('.quick-reply-shuffle')
    shuffleBtn.textContent = `换一换 (${page + 1}/${data.replies.length})`
  }


  // 错误提示框
  showError(message, title = '错误') {
    this.dialog.show({
      title,
      content: message,
      buttons: [
        { text: '关闭', type: 'default', onClick: () => this.dialog.close() }
      ]
    })
  }
  //通用提示框
  showSuccess(message, title = '提示') {
    this.dialog.show({
      title,
      content: message,
      buttons: [
        { text: '关闭', type: 'default', onClick: () => this.dialog.close() }
      ]
    })
  }
  //可选确认取消的警示框
  showConfirm(message, title = '确认', onConfirm, onCancel) {
    this.dialog.show({
      title,
      content: message,
      buttons: [
        { text: '取消', type: 'default', onClick: () => { this.dialog.close(); onCancel?.() } },
        { text: '确认', type: 'primary', onClick: () => { this.dialog.close(); onConfirm?.() } }
      ]
    })
  }

  // 通用输入框
  showInputDialog({ title, placeholder, value = '', onConfirm, onCancel }) {
    this.dialog.show({
      title,
      content: [
        { type: 'textarea', name: 'input', placeholder, value, required: true, autofocus: true }
      ],
      buttons: [
        { text: '取消', type: 'default', onClick: () => { this.dialog.close(); onCancel?.() } },
        {
          text: '确认', type: 'primary', submit: true, onClick: () => {
            const data = this.dialog.getFormData();
            this.dialog.close();
            onConfirm?.(data.input);
          }
        }
      ]
    });
  }

  // 显示聊天列表管理弹窗
  showChatListDialog(chatList, { onSwitch, onEdit, onDelete, onAddChat, onCopyChat }) {
    this.dialog.show({
      title: '聊天记录管理',
      list: {
        items: chatList.map((item, idx) => ({
          ...item,
          title: item.hintData?.name || `未命名会话${idx + 1}`,
          idx
        })),
        displayField: 'title',
        searchable: true,
        renderItem: (item) => {
          const div = document.createElement('div');
          div.className = 'list-item-content';
          div.innerHTML = `<strong>${item.title}</strong>`;
          return div;
        }
      },
      buttons: [
        {
          text: '切换',
          type: 'primary',
          actionType: 'item-action',
          onClick: async (item, index) => {
            await onSwitch?.(item.idx);
            this.dialog.close();
          }
        },
        {
          text: '增加',
          type: '',
          onClick: async () => {
            onAddChat?.()
          }
        },
        {
          text: '复制',
          type: '',
          actionType: 'item-action',
          onClick: async (item) => {
            onCopyChat?.(item.idx);
          }
        },
        {
          text: '编辑',
          type: 'default',
          actionType: 'item-action',
          onClick: (item, index) => {
            onEdit?.(item.idx);
          }
        },
        {
          text: '删除',
          type: 'danger',
          actionType: 'item-action',
          onClick: async (item, index) => {
            await onDelete?.(item.idx);
          }
        },
        {
          text: '关闭',
          type: 'default',
          onClick: () => this.dialog.close()
        }
      ]
    });
  }
  // 显示提示词列表管理弹窗
  showSystemListDialog(systemList, { onEdit, onToggle, onDelete, onAdd }) {
    const items = systemList.map((item, index) => {
      return {
        id: index,
        content: item.content,
        open: item?.open !== false ? '开启' : '关闭' // open不存在时默认为true item?.open 不存在时为undefined 存在时 为true 或 false 所以用 !== false 
      }
    })

    console.log('items:', items)

    const config = {
      title: '提示词列表',
      list: {
        items: items,
        searchable: true,
        renderItem: (item) => {
          const div = document.createElement('div')
          div.className = 'list-item-content'
          div.innerHTML = `
        <strong style="line-height:1.2;height: calc(1em * 1.2);overflow:hidden;">${item.content}</strong>
        <span class="status">${item.open}</span>
      `
          return div
        },
      },
      //编辑，开关，删除，取消。
      buttons: [
        {
          text: '编辑',
          type: 'default',
          actionType: 'item-action',
          onClick: (item, index) => {
            //调用编辑方法
            onEdit?.(item.id)
          }
        },
        {
          text: '开/关',
          type: 'default',
          actionType: 'item-action',
          onClick: (item, index) => {
            //调用开关方法
            onToggle?.(item.id)
          }
        },
        {
          text: '删除',
          type: 'danger',
          actionType: 'item-action',
          onClick: (item, index) => {
            //调用删除方法
            onDelete?.(item.id)
          }
        },
        {
          text: '添加',
          type: 'default',
          // actionType: 'item-action',
          onClick: (item, index) => {
            //调用添加方法
            onAdd?.()
          }
        },
        {
          text: '取消',
          type: 'default',
          onClick: () => this.dialog.close()
        }
      ]
    }

    this.dialog.show(config)
  }
  // 显示Toast消息
  showToast(message, duration = 2000) {
    // 创建或复用Toast元素
    if (!this.toastElement) {
      this.toastElement = document.createElement('div');
      this.toastElement.className = 'toast-message';
      Object.assign(this.toastElement.style, {
        opacity: '0',
        transition: 'opacity 0.3s'
      });
      document.body.appendChild(this.toastElement);
    }

    // 显示Toast
    this.toastElement.textContent = message;
    this.toastElement.style.opacity = '1';

    // 自动隐藏
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastElement.style.opacity = '0';
    }, duration);
  }

  // 制造一条消息并根据参数加入到消息列表
  _createMessageItem(item, index) {
    const li = document.createElement('li');
    li.dataset.id = index;
    li.classList.add(item.role);
    this.messageList[index] = li;


    // 提前划分思维链区域（无样式）
    let cotDiv = li.querySelector('.cot-placeholder');
    if (!cotDiv) {
      cotDiv = document.createElement('div');
      cotDiv.className = 'cot-placeholder'; // 仅作占位，无样式
      cotDiv.setAttribute('data-collapse', 'false'); // 默认收起
      li.appendChild(cotDiv);
    }
    // 渲染内容
    const div = document.createElement('div');
    div.className = 'message-content';
    div.innerHTML = this.md.render(item.content);
    li.appendChild(div);

    // 如果有思维链，调用_createCotElement/_updateCotElement
    if (item.reasoning_content) {
      if (item.reasoning_content) {
        this._createCotElement(item.reasoning_content, index);
      } else {
        // 没内容时清空占位
        cotDiv.innerHTML = '';
      }
    }

    return li;
  }
  // 刷新单条消息
  refreshMessage(index, message) {
    const li = this.messageList[index];
    // 如果有思维链，创建或更新
    if (message.reasoning_content) {
      this._createOrUpdateCotElement(message.reasoning_content, index);
    }
    // 更新内容
    if (li) {
      const div = li.querySelector('.message-content');
      if (div) {
        div.innerHTML = this.md.render(message.content);
      }
    }
  }

  // 1.创建思维链元素（有样式），插入到占位区，并返回节点
  _createCotElement(cotStr, index) {
    // 如果没有内容则不创建
    const li = this.messageList[index];
    if (!li) return null;
    // 如果没有提前划分思维链区域，则不创建
    let cotDiv = li.querySelector('.cot-placeholder');
    if (!cotDiv) return null;
    // 创建有样式的内容
    const cotBlock = document.createElement('div');
    cotBlock.className = 'cot-block';
    cotBlock.innerHTML = `
    <div class="cot-title">思维链</div>
    <div class="cot-content">${cotStr}</div>
  `;
    cotDiv.innerHTML = ''; // 清空占位
    cotDiv.appendChild(cotBlock);
    return cotBlock;
  }

  // 2.修改指定消息的思维链内容
  _updateCotElement(index, cotStr) {
    const li = this.messageList[index];
    if (!li) return;
    const cotContent = li.querySelector('.cot-block .cot-content');
    if (cotContent) {
      cotContent.textContent = cotStr;
    }
  }

  // 3. 创建或更新思维链（如果有则更新，否则创建）
  _createOrUpdateCotElement(cotStr, index) {
    const li = this.messageList[index];
    if (!li) return;
    let cotDiv = li.querySelector('.cot-placeholder');
    if (!cotDiv) return;
    let cotBlock = cotDiv.querySelector('.cot-block');
    if (cotBlock) {
      // 已有则更新
      const cotContent = cotBlock.querySelector('.cot-content');
      if (cotContent) cotContent.textContent = cotStr;
    } else {
      // 没有则创建
      this._createCotElement(cotStr, index);
    }
  }

  // 如果未来要限制消息列表的长度，可以通过修改传参来实现，因为这样做其他方法不需要改动
  // 全量渲染/刷新 消息列表
  renderMessageList(messages) {
    this.chatList.innerHTML = '' // 清空列表
    this.messageList = [] // 清空缓存

    // 遍历消息列表，创建消息项并添加到列表中
    messages.forEach((item, index) => {
      const li = this._createMessageItem(item, index)
      this.chatList.appendChild(li)
    })
  }
  // 创建或更新消息项
  createOrUpdateMessage(message, index) {
    // 如果索引存在，更新消息
    if (this.messageList[index]) {
      this.refreshMessage(index, message)
    } else {
      // 否则创建新消息
      this.renderNewMessage(message)
    }
  }
  // 渲染单条新消息
  renderNewMessage(message) {
    //创建并添加
    const li = this._createMessageItem(message, this.messageList.length)
    this.chatList.appendChild(li)
  }

  //设置页面中的navChatName
  setNavChatName(name) {
    this.navChatName.innerHTML = name
  }

}
//预计改成一个类，因为我想起来函数只能用一次
class ToggleButton {
  constructor(element, on, off) {
    // 如果传入的是选择器字符串，则查询元素
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }

    // 绑定点击事件和开启关闭的回调函数
    if (element) {
      element.addEventListener('click', () => {
        const isOn = element.dataset.state === 'on';
        if (isOn) {
          element.dataset.state = 'off';
          off?.();
        } else {
          element.dataset.state = 'on';
          on?.();
        }
      })
    }
  }
}


// 弹窗管理器------------------------------------------------------------------
/**
  * DialogManager
  * 用于创建和管理弹窗
  * @param {Object} config - 弹窗配置
  * @param {string} config.title - 弹窗标题
  * @param {string|HTMLElement} config.content - 弹窗内容
  * @param {Array} config.buttons - 按钮配置数组
  * @param {function} config.onCancel - 取消按钮回调函数
  * @param {function} config.onConfirm - 确认按钮回调函数
*/
//写法参考：
/*
const config = {
  title: '提示',
  content: [
    { label: '姓名', type: 'text', name: 'name', placeholder: '请输入姓名', required: true },
    { label: '性别', type: 'select],
  buttons: [
    { text: '取消', type: 'cancel', onClick: () => console.log('取消') },
    { text: '确定', type: 'confirm', onClick: () => console.log('确定') }
  ],
  onCancel: () => console.log('关闭'),
  onConfirm: () => console.log('确认')
}
*/
class DialogManager {
  constructor() {
    this.currentDialog = null;
    this.selectedItem = null;
  }

  show(config) {
    this.close();
    this.selectedItem = null;

    const dialog = document.createElement('dialog');
    dialog.className = 'custom-dialog';
    this.currentDialog = dialog;

    const form = document.createElement('form');
    form.className = 'dialog-form';
    form.innerHTML = `
      <div class="dialog-header">
        <h3>${config.title}</h3>
        <button type="button" class="close-btn">&times;</button>
      </div>
      <div class="dialog-body"></div>
      <div class="dialog-footer"></div>
    `;

    const body = form.querySelector('.dialog-body');

    // 支持列表模式
    if (config.list) {
      body.appendChild(this._createList(config.list));
    }
    // 支持表单模式
    else if (config.content && Array.isArray(config.content)) {
      config.content.forEach(field => {
        body.appendChild(this._createFormField(field));
      });
    }
    // 支持纯内容模式
    else if (config.content) {
      body.appendChild(
        typeof config.content === 'string'
          ? this._createTextContent(config.content)
          : config.content
      );
    }

    const footer = form.querySelector('.dialog-footer');
    config.buttons?.forEach(btn => {
      footer.appendChild(this._createButton(btn));
    });

    this._bindDialogEvents(form, config);

    dialog.appendChild(form);
    document.body.appendChild(dialog);
    dialog.showModal();
    return dialog;
  }

  _createList(listConfig) {
    const container = document.createElement('div');
    container.className = 'dialog-list';

    if (listConfig.searchable) {
      const searchBox = document.createElement('input');
      searchBox.type = 'text';
      searchBox.placeholder = '搜索...';
      searchBox.className = 'list-search';
      searchBox.addEventListener('input', (e) => {
        this._filterList(e.target.value, container);
      });
      container.appendChild(searchBox);
    }

    const list = document.createElement('ul');
    list.className = 'list-items';
    container.appendChild(list);

    listConfig.items.forEach((item, index) => {
      const li = document.createElement('li');
      li.dataset.index = index;

      if (listConfig.renderItem) {
        li.appendChild(listConfig.renderItem(item));
      } else {
        const displayText = item[listConfig.displayField || 'title'] || item;
        li.innerHTML = `<div class="list-item-content">${displayText}</div>`;
      }

      li.addEventListener('click', () => {
        list.querySelectorAll('li.selected').forEach(el => {
          el.classList.remove('selected');
        });

        li.classList.add('selected');
        this.selectedItem = { item, index };

        if (listConfig.onItemSelect) {
          listConfig.onItemSelect(item, index);
        }
      });

      list.appendChild(li);
    });

    return container;
  }

  _filterList(query, container) {
    const list = container.querySelector('.list-items');
    const items = list.querySelectorAll('li');
    const lowerQuery = query.toLowerCase();

    items.forEach(li => {
      const text = li.textContent.toLowerCase();
      li.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
  }

  close() {
    if (this.currentDialog) {
      this.currentDialog.close();
      this.currentDialog.remove();
      this.currentDialog = null;
    }
  }

  // getFormData() {
  //   if (!this.currentDialog) return null;
  //   const form = this.currentDialog.querySelector('form');
  //   if (!form) return null;

  //   const formData = new FormData(form);
  //   return Object.fromEntries(formData.entries());
  // }

  getSelectedItem() {
    return this.selectedItem;
  }

  _createFormField(field) {
    const container = document.createElement('div');
    container.className = 'form-field';

    if (field.label) {
      const label = document.createElement('label');
      label.textContent = field.label;
      container.appendChild(label);
    }

    const input = this._createInput(field);
    container.appendChild(input);
    return container;
  }

  _createInput(field) {
    let input;
    switch (field.type) {
      case 'textarea':
        input = document.createElement('textarea');
        input.rows = field.rows || 4;
        break;
      case 'select':
        input = document.createElement('select');
        field.options?.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          input.appendChild(option);
        });
        break;
      default:
        input = document.createElement('input');
        input.type = field.type || 'text';
    }

    input.name = field.name || '';
    input.placeholder = field.placeholder || '';
    input.value = field.value !== undefined && field.value !== null ? field.value : '';
    if (field.required) input.required = true;
    if (field.autofocus) input.autofocus = true;

    return input;
  }

  _createButton(btn) {
    const button = document.createElement('button');
    button.textContent = btn.text;
    button.className = `dialog-btn ${btn.type || 'default'}`;
    button.type = btn.submit ? 'submit' : 'button';

    if (btn.actionType === 'item-action') {
      button.addEventListener('click', (e) => {
        if (!this.selectedItem) {
          alert('请先选择一个项目');
          return;
        }
        btn.onClick(this.selectedItem.item, this.selectedItem.index);
      });
    }
    else if (btn.onClick) {
      button.addEventListener('click', (e) => {
        if (btn.action === 'close') this.close();
        btn.onClick(e);
      });
    }

    return button;
  }

  _createTextContent(html) {
    const div = document.createElement('div');
    div.className = 'dialog-text-content';
    div.innerHTML = html;
    return div;
  }

  _bindDialogEvents(form, config) {
    const dialog = this.currentDialog;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (config.onSubmit) {
        config.onSubmit(this.getFormData());
      }
    });

    form.querySelector('.close-btn').addEventListener('click', () => {
      dialog.close();
      config.onCancel?.();
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.close();
        config.onCancel?.();
      }
    });
  }
  _createInput(field) {
    let input;
    switch (field.type) {
      case 'textarea':
        input = document.createElement('textarea');
        input.rows = field.rows || 4;
        break;
      case 'select':
        input = document.createElement('select');
        field.options?.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          input.appendChild(option);
        });
        break;
      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
        if (field.step !== undefined) input.step = field.step;
        input.value = field.value !== undefined ? field.value : ''; // 显式设置默认值
        break;
      case 'checkbox':
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(field.value);
        break;
      case 'switch':
        input = this._createSwitch(field);
        break;
      default:
        input = document.createElement('input');
        input.type = field.type || 'text';
    }

    // 设置通用属性
    input.name = field.name || '';

    // 对于非布尔类型设置值
    if (field.type !== 'checkbox' && field.type !== 'switch') {
      input.value = field.value !== undefined && field.value !== null ? field.value : '';
      input.placeholder = field.placeholder || '';
    }

    if (field.required) input.required = true;
    if (field.autofocus) input.autofocus = true;

    return input;
  }

  // 创建开关元素（修复版）
  _createSwitch(field) {
    const container = document.createElement('label');
    container.className = 'switch-container';

    // 创建隐藏的复选框（用于状态管理）
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(field.value);
    input.name = field.name || '';
    input.className = 'switch-input';

    // 创建滑块
    const slider = document.createElement('span');
    slider.className = 'switch-slider';

    // 创建标签文本
    // const labelText = document.createElement('span');
    // labelText.className = 'switch-label';
    // labelText.textContent = field.label || '';

    // 组装结构
    container.appendChild(input);
    container.appendChild(slider);
    // container.appendChild(labelText);

    return container;
  }

  // 修改后的 getFormData 方法，支持类型转换
  getFormData() {
    if (!this.currentDialog) return null;
    const form = this.currentDialog.querySelector('form');
    if (!form) return null;

    const result = {};
    // 遍历所有带 name 的表单元素
    form.querySelectorAll('[name]').forEach(element => {
      const name = element.name;
      if (!name) return;

      // switch/checkbox
      if (element.type === 'checkbox') {
        result[name] = element.checked;
      }
      // number
      else if (element.type === 'number') {
        result[name] = element.value === '' ? '' : parseFloat(element.value);
      }
      // 其它类型
      else {
        result[name] = element.value;
      }
    });

    return result;
  }
}