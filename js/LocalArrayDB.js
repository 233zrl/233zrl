class LocalArrayDB {
  constructor(type = 'requests') {
    this.dbName = 'ChatStreamDB';
    this.storeName = type;
    this.db = null;
    this.cache = []; // 直接存储对象
    this.initialized = false;
  }

  // 初始化数据库
  async init() {
    if (this.initialized) return;

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

        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().catch(() => { });
        }

        this.initialized = true;
        resolve();
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  // 确保数据库已初始化
  async ensureInit() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // 获取全部数据
  async getAll() {
    await this.ensureInit();
    return [...this.cache]; // 返回副本
  }

  // 添加数据
  async push(item) {
    await this.ensureInit();

    // 处理无效输入
    if (item === undefined || item === null) {
      console.warn('Attempted to push undefined or null value');
      return;
    }

    // 直接存储对象
    await this._addToDB(item);
    this.cache.push(item);
  }

  // 删除最后一条数据
  async pop() {
    await this.ensureInit();
    if (this.cache.length === 0) return null;

    const lastItem = this.cache.pop();
    await this._removeLastFromDB();
    return lastItem;
  }

  // 类似数组的splice方法
  async splice(start, deleteCount, ...items) {
    await this.ensureInit();

    // 过滤无效项
    const validItems = items.filter(item => item !== undefined && item !== null);

    // 内存操作
    const deleted = this.cache.splice(start, deleteCount, ...validItems);

    // 数据库同步
    await this._rebuildDB();
    return deleted;
  }

  // 更新指定位置数据
  async update(index, newItem) {
    await this.ensureInit();

    if (index < 0 || index >= this.cache.length) {
      throw new Error(`索引越界: ${index} (长度: ${this.cache.length})`);
    }

    if (newItem === undefined || newItem === null) {
      throw new Error('不能更新为 undefined 或 null');
    }

    // 更新内存缓存
    this.cache[index] = newItem;

    // 同步到数据库
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.openCursor();
    let currentIndex = 0;

    await new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve();
          return;
        }

        if (currentIndex === index) {
          const updateRequest = cursor.update({ id: cursor.key, data: newItem });
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => {
            console.error('更新失败:', updateRequest.error);
            reject(updateRequest.error);
          };
        } else {
          currentIndex++;
          cursor.continue();
        }
      };

      request.onerror = (event) => {
        console.error('游标错误:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // 清空数据
  async clear() {
    await this.ensureInit();

    this.cache = [];
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.clear();

    await new Promise((resolve, reject) => {
      request.onsuccess = resolve;
      request.onerror = reject;
    });
  }

  // 私有方法：同步内存缓存
  async _syncCache() {
    const transaction = this.db.transaction(this.storeName, 'readonly');
    const store = transaction.objectStore(this.storeName);
    const request = store.getAll();

    const result = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });

    // 确保所有数据都是对象
    this.cache = result.map(item => {
      // 如果是从旧版本迁移的数据，data 可能是字符串
      if (typeof item.data === 'string') {
        try {
          return JSON.parse(item.data);
        } catch (e) {
          console.warn('解析旧数据失败，保留原始值:', item.data);
          return item.data;
        }
      }
      return item.data;
    });
  }

  // 私有方法：添加数据到数据库
  async _addToDB(data) {
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.add({ data });

    await new Promise((resolve, reject) => {
      request.onsuccess = resolve;
      request.onerror = reject;
    });
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
          const deleteRequest = cursor.delete();
          deleteRequest.onsuccess = resolve;
          deleteRequest.onerror = reject;
        } else {
          resolve(); // 没有数据可删除
        }
      };
      request.onerror = reject;
    });
  }

  // 私有方法：重建数据库
  async _rebuildDB() {
    const transaction = this.db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const clearRequest = store.clear();

    // 先清空存储
    await new Promise((resolve, reject) => {
      clearRequest.onsuccess = resolve;
      clearRequest.onerror = reject;
    });

    // 批量添加所有缓存项
    const addPromises = this.cache.map(data => {
      return new Promise((resolve, reject) => {
        const request = store.add({ data });
        request.onsuccess = resolve;
        request.onerror = reject;
      });
    });

    await Promise.all(addPromises);
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