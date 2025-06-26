class LocalArrayDB {
  constructor(type = 'requests') {
    this.dbName = 'ChatStreamDB';
    this.storeName = type; // 根据类型区分存储空间
    this.db = null;
    this.cache = []; // 内存缓存
  }

  // 初始化数据库
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('requests')) {
          db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('chats')) {
          db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        await this._syncCache();
        
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
        
        resolve();
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  // 获取全部数据（返回解析后的JSON数组）
  async getAll() {
    await this._syncCache();
    return this.cache.map(str => JSON.parse(str));
  }

  // 添加数据（支持对象或JSON字符串）
  async push(item) {
    const jsonStr = typeof item === 'string' ? item : JSON.stringify(item);
    await this._addToDB(jsonStr);
    this.cache.push(jsonStr);
  }

  // 删除最后一条数据
  async pop() {
    if (this.cache.length === 0) return null;
    const lastItem = this.cache.pop();
    await this._removeLastFromDB();
    return JSON.parse(lastItem);
  }

  // 类似数组的splice方法
  async splice(start, deleteCount, ...items) {
    // 获取要插入的JSON字符串
    const insertItems = items.map(item =>
      typeof item === 'string' ? item : JSON.stringify(item)
    );

    // 内存操作
    const deleted = this.cache.splice(start, deleteCount, ...insertItems);

    // 数据库同步
    await this._rebuildDB();
    return deleted.map(str => JSON.parse(str));
  }

  // 更新指定位置数据
  async update(index, newItem) {
    if (index < 0 || index >= this.cache.length) throw new Error('索引越界');

    // 将新数据转换为 JSON 字符串
    const jsonStr = typeof newItem === 'string' ? newItem : JSON.stringify(newItem);

    // 更新内存缓存
    this.cache[index] = jsonStr;

    // 同步到数据库
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.openCursor();
    let currentIndex = 0;

    await new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (currentIndex === index) {
            // 更新当前记录
            const updateRequest = cursor.update({ id: cursor.key, data: jsonStr });
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = reject;
          } else {
            currentIndex++;
            cursor.continue();
          }
        } else {
          resolve(); // 如果没有找到对应的索引，直接返回
        }
      };
      request.onerror = reject;
    });
  }

  // 清空数据
  async clear() {
    this.cache = [];
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    store.clear();
    await transaction.complete;
  }

  // 私有方法：同步内存缓存
  async _syncCache() {
    const transaction = this.db.transaction(this.storeName, 'readonly');
    const store = transaction.objectStore(this.storeName);
    const request = store.getAll();

    this.cache = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result.map(item => item.data));
      request.onerror = (e) => reject(e);
    });
  }

  // 私有方法：添加数据到数据库
  async _addToDB(data) {
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    store.add({ data });
    await transaction.complete;
  }

  // 私有方法：删除最后一条数据库记录
  async _removeLastFromDB() {
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.openCursor(null, 'prev');

    await new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          resolve();
        }
      };
      request.onerror = reject;
    });
  }

  // 私有方法：重建数据库（用于splice等复杂操作）
  async _rebuildDB() {
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);

    // 清空现有数据
    store.clear();

    // 重新插入缓存数据
    this.cache.forEach(data => {
      store.add({ data });
    });

    await transaction.complete;
  }
}
/*
// 删除最后一条
await requestDB.pop();
*/

/*
// 使用示例 -------------------------------------------------

// 1. 初始化请求存储
// 创建一个专门用于存储请求体的数据库实例
// 参数 'requests' 表示这个实例将操作名为 'requests' 的存储空间
//可选'chats'
const requestDB = new LocalArrayDB('requests');

// 初始化数据库（可选，如果不手动初始化，第一次操作时会自动初始化）
// 初始化完成后，数据库就可以正常使用了
await requestDB.init();

// 2. 初始化聊天存储
// 创建一个专门用于存储聊天记录的数据库实例
// 参数 'chats' 表示这个实例将操作名为 'chats' 的存储空间
const chatDB = new LocalArrayDB('chats');

// 初始化聊天记录数据库
await chatDB.init();

// 3. 添加数据
// 向请求体数据库中添加一条请求数据
// 参数可以是一个对象或 JSON 字符串，这里传入一个对象
// 方法会自动将对象转换为 JSON 字符串存储
// 无返回值
await requestDB.push({ model: 'gpt-4', prompt: 'Hello' });

// 向聊天记录数据库中添加一条聊天数据
// 参数可以是一个对象或 JSON 字符串，这里传入一个对象
// 方法会自动将对象转换为 JSON 字符串存储
// 无返回值
await chatDB.push({ user: 'AI', text: '你好！有什么可以帮助您的？' });

// 4. 获取全部数据
// 获取请求体数据库中的所有数据
// 返回一个数组，数组中的每个元素是解析后的 JavaScript 对象
// 例如：[{ model: 'gpt-4', prompt: 'Hello' }]
console.log(await requestDB.getAll());

// 获取聊天记录数据库中的所有数据
// 返回一个数组，数组中的每个元素是解析后的 JavaScript 对象
// 例如：[{ user: 'AI', text: '你好！有什么可以帮助您的？' }]
console.log(await chatDB.getAll());

// 5. 使用 splice 方法
// 在聊天记录数据库中，从索引 0 开始删除 1 条数据，并插入新数据
// 参数：
//   - 第一个参数：起始索引（从 0 开始）
//   - 第二个参数：要删除的数据条数
//   - 后续参数：要插入的新数据（可以是对象或 JSON 字符串）
// 返回被删除的数据（解析后的对象数组）
await chatDB.splice(0, 1, { user: 'AI', text: '您好！我是助手' });

// 6. 更新数据
// 更新聊天记录数据库中索引为 0 的数据
// 参数：
//   - 第一个参数：要更新的数据索引（从 0 开始）
//   - 第二个参数：新数据（可以是对象或 JSON 字符串）
// 无返回值
await chatDB.update(0, { user: 'AI', text: '您好！有什么可以帮您？' });

// 7. 删除最后一条数据
// 删除请求体数据库中的最后一条数据
// 无参数
// 返回被删除的数据（解析后的对象）
await requestDB.pop();
*/