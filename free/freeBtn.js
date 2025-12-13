// 不为其他js文件提供服务，方便维护
// 仅提供免费使用按钮的功能
document.addEventListener('DOMContentLoaded', function () {

  // 创建按钮
  const freeBtn = document.createElement('button')
  freeBtn.textContent = '对话免费模式'
  freeBtn.classList.add('left')
  // 创建配置
  
  // 初始状态样式
  freeBtn.style.border = '#f44336 solid 2px' // 红色表示关闭

  // 定义开和关的行为
  function on() {
    freeBtn.textContent = '免费模式'
    freeBtn.style.border = '#4CAF50 solid 2px' // 绿色表示开启
    window.useFreeConfig = true; // 全局变量，表示使用免费配置

    window.app.ui.showToast('请注意！该模式不支持快捷回复', 3000)
  }
  function off() {
    freeBtn.textContent = '免费模式'
    freeBtn.style.border = '#f44336 solid 2px' // 红色表示关闭
    window.useFreeConfig = false; // 全局变量，表示不使用免费配置
  }



  // 使用ui管理器的开关按钮方法
  const toggleBtn = new ToggleButton(freeBtn, on, off)

  //这里是结尾，提前写一下添加到页面
  const toolbar = document.querySelector('.toolbar')
  toolbar.appendChild(freeBtn)

})