
    //读取DB里的聊天数据添加到页面中显示，以及操作方法
    function MsgListDB() {
      this.ArrayDB = chatArray
    }
    //把数据显示到页面中
    MsgListDB.prototype.attachListUI = async function(mustSelect = false) {
      //先获得列表数据
      const arrList = await this.getChatList()
      //在页面中新建一个dialog
      const dialog = createEl('dialog', document.body)
      dialog.classList.add('chatList')
      //创建其内需要的元素
      const p = createEl('p', dialog, '聊天列表(点此关闭)')
      const ul = createEl('ul', dialog, arrList)
      const div = createEl('div', dialog)
      //判断是否为必须选择模式
      if (mustSelect) {
        p.innerHTML = '聊天列表(必须选择)'
      }
      //给p添加关闭方法
      p.addEventListener('click', () => {
        //判断是否为必须选择模式。如果是则不能退出。
        if (mustSelect) return
        dialog.remove()
      })
      //给div内部添加'增加'按钮
      const addChatBtn = createEl('button', div, '增加')
      //给增加按钮，添加点击事件:增加
      addChatBtn.addEventListener('click', async () => {
        //用户输入聊天名称
        const name = prompt('请输入聊天名称')
        //不能为空
        if (name === null) { return } else if (!name) return alert('输入不能为空')
        //进行一个强劲的添加
        await this.ArrayDB.push({
          hintData: { name: name },
          ...defChatData
        })
        //刷新一下列表
        ul.innerHTML = await this.getChatList()
      })
      //最后最重磅的一步，给ul添加事件委托。
      ul.addEventListener('click', function(e) {
        if (e.target.tagName === 'LI') {
          //获取id
          indexDB = +e.target.dataset.id
          //下标存入本地
          localStorage.setItem('indexDB', +e.target.dataset.id)
          //打开这个页面
          initializeChatSystem(indexDB)
          //判断一下是否为必须选择模式，如果是则删除dialog。
          if (mustSelect) { dialog.remove() }
        }
      })
      //打开它
      dialog.showModal()
      
    }
    MsgListDB.prototype.getChatList = async function() {
      //处理一下获取来的数据
      const list = await this.ArrayDB.getAll()
      //处理成字符串
      const arrList = list.map((arr, index) => {
        return `
        <li data-id="${index}">${arr.hintData.name ? arr.hintData.name : '没有设置'}</li>
        `
      }).join('')
      //返回结果
      return arrList
    }
    //删除第条indexDB聊天
    MsgListDB.prototype.removeIndexDB = async function() {
      if (confirm(`是否删除数据${indexDB}（第${indexDB + 1}条）`)) {
        //删除
        chatArray.splice(indexDB, 1);
        //显示选项
        this.attachListUI(true)
        //刷新页面
        //initializeChatSystem()
        //刷新聊天
        //renderMessages(messages.messages) 
      }
    }
   //修改聊天条目的方法