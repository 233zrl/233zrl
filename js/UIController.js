class UIController {
  constructor() {
    // 初始化弹窗管理器
    this.dialog = new DialogManager()
    // DOM 元素
    this.nav = document.querySelector('.nav')
    this.chatList = document.querySelector('.list')
    this.input = document.querySelector('.inputBox .input')
    this.submit = document.querySelector('.inputArea .submit')
    this.contextMenu = document.querySelector('.ContextMenu')
    this.toolbar = document.querySelector('.toolbar') // 工具栏小按钮行
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
        "clear-chat": () => this.onClearChat?.(),
        "delete-chat": () => this.onDeleteChat?.(),
        "set-ApiKey": () => this.onSetApiKey?.(),
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
      'edit': () => this.onEdit?.(this.selectedMessageId)
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
        { type: 'text', name: 'input', placeholder, value, required: true, autofocus: true }
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
  showChatListDialog(chatList, { onSwitch, onEdit, onDelete, onAddChat }) {
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

  // 制造一条消息并根据参数加入到消息列表
  _createMessageItem(item, index) {
    //创建li元素
    const li = document.createElement('li')
    li.dataset.id = index
    li.classList.add(item.role)
    //创建div元素
    const div = document.createElement('div')
    div.innerHTML = this.md.render(item.content)
    //添加到li元素
    li.appendChild(div)
    //添加到消息列表缓存
    this.messageList[index] = li
    //返回li元素
    return li
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
  // 刷新单条消息
  refreshMessage(index, message) {
    const li = this.messageList[index]
    if (li) {
      const div = li.querySelector('div')
      if (div) {
        div.innerHTML = this.md.render(message.content)
      }
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

  getFormData() {
    if (!this.currentDialog) return null;
    const form = this.currentDialog.querySelector('form');
    if (!form) return null;

    const formData = new FormData(form);
    return Object.fromEntries(formData.entries());
  }

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
    input.value = field.value || '';
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
}