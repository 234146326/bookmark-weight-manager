// 默认权重规则与存储初始化
const DEFAULT_RULES = {
  stayTimeMinutes: 60,      // 常驻浏览器触发时间（分钟）
  stayTimeBonus: 5,         // 常驻加分
  openCountBonus: 1         // 每次重复打开加分
};

// 记录标签页激活时间与对应的URL
// 结构: { tabId: { url: string, startTime: number } }
let activeTabs = {};

// 初始化或读取规则
async function getRules() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['weightRules', 'weights'], (data) => {
      let rules = data.weightRules || DEFAULT_RULES;
      resolve(rules);
    });
  });
}

// 获取所有书签的URL集合，用于快速判断是否是书签
async function getBookmarkUrls() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      let urls = new Set();
      function traverse(nodes) {
        for (let node of nodes) {
          if (node.url) {
            // 规范化URL，去除尾随斜杠或协议差异以方便匹配
            urls.add(node.url.trim());
          }
          if (node.children) {
            traverse(node.children);
          }
        }
      }
      traverse(bookmarkTreeNodes);
      resolve(urls);
    });
  });
}

// 增加权重的通用函数
async function addWeight(url, points) {
  if (!url) return;
  // 仅对属于书签的网址进行权重管理
  let bookmarkUrls = await getBookmarkUrls();
  // 简单的标准化匹配
  let matchedBookmark = null;
  for (let bUrl of bookmarkUrls) {
    if (url.startsWith(bUrl) || bUrl.startsWith(url)) {
      matchedBookmark = bUrl;
      break;
    }
  }

  if (!matchedBookmark) return; // 不是书签则忽略

  chrome.storage.local.get(['weights'], async (data) => {
    let weights = data.weights || {};
    weights[matchedBookmark] = (weights[matchedBookmark] || 0) + points;
    await chrome.storage.local.set({ weights: weights });
  });
}

// 监听标签页更新（打开/加载完成）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    // 1. 重复打开加1分
    let rules = await getRules();
    await addWeight(tab.url, rules.openCountBonus);

    // 2. 记录常驻计时开始
    activeTabs[tabId] = {
      url: tab.url,
      startTime: Date.now()
    };
  }
});

// 监听标签页关闭或切换，计算常驻时间
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  checkStayTime(tabId);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  // 当切换标签时，可以对上一个标签结算或者重置计时（简易实现：以标签关闭或更新为准）
});

async function checkStayTime(tabId) {
  if (activeTabs[tabId]) {
    let info = activeTabs[tabId];
    let durationMinutes = (Date.now() - info.startTime) / 1000 / 60;
    let rules = await getRules();
    
    if (durationMinutes >= (rules.stayTimeMinutes || 60)) {
      await addWeight(info.url, rules.stayTimeBonus || 5);
    }
    delete activeTabs[tabId];
  }
}

// 定期检查长期开着的标签 (每隔1分钟检查一次)
chrome.alarms.create('checkStayAlarm', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkStayAlarm') {
    let rules = await getRules();
    let thresholdMs = (rules.stayTimeMinutes || 60) * 60 * 1000;
    let now = Date.now();

    for (let tabId in activeTabs) {
      let info = activeTabs[tabId];
      if (now - info.startTime >= thresholdMs) {
        await addWeight(info.url, rules.stayTimeBonus || 5);
        // 加上后重置计时，避免重复持续加分
        info.startTime = now; 
      }
    }
  }
});
