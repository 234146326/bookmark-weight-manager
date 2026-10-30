document.addEventListener('DOMContentLoaded', async () => {
  const listContainer = document.getElementById('listContainer');
  const searchInput = document.getElementById('searchInput');
  const openOptionsBtn = document.getElementById('openOptions');

  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  let bookmarksData = []; // 存储所有有权重的书签

  async function loadData() {
    chrome.storage.local.get(['weights'], async (data) => {
      let weights = data.weights || {};
      
      // 获取全部书签以便匹配标题
      chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
        let bookmarkMap = {}; // url -> title
        function traverse(nodes) {
          for (let node of nodes) {
            if (node.url) {
              bookmarkMap[node.url.trim()] = node.title || node.url;
            }
            if (node.children) {
              traverse(node.children);
            }
          }
        }
        traverse(bookmarkTreeNodes);

        bookmarksData = [];
        for (let url in weights) {
          let w = weights[url];
          if (w > 0) { // 无权重的网址不在清单内
            let title = bookmarkMap[url] || url;
            bookmarksData.push({ url, title, weight: w });
          }
        }

        // 按权重降序排列
        bookmarksData.sort((a, b) => b.weight - a.weight);

        renderList(bookmarksData);
      });
    });
  }

  function renderList(data) {
    if (data.length === 0) {
      listContainer.innerHTML = '<div class="empty-tip">暂无有权重的书签网址</div>';
      return;
    }

    listContainer.innerHTML = '';
    data.forEach(item => {
      let div = document.createElement('div');
      div.className = 'bookmark-item';
      div.innerHTML = `
        <div class="item-header">
          <a class="item-title" href="${item.url}" target="_blank" title="${item.title}">${item.title}</a>
          <span class="item-weight">权重: ${item.weight}</span>
        </div>
        <div class="item-url">${item.url}</div>
        <div class="item-actions">
          <button class="action-btn" data-action="rewrite" data-url="${item.url}">重写权重</button>
          <button class="action-btn delete" data-action="delete" data-url="${item.url}">删除权重</button>
        </div>
      `;
      listContainer.appendChild(div);
    });

    // 绑定点击打开网址事件
    listContainer.querySelectorAll('.item-title').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: el.getAttribute('href') });
      });
    });

    // 绑定操作按钮事件
    listContainer.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let action = btn.getAttribute('data-action');
        let url = btn.getAttribute('data-url');

        if (action === 'delete') {
          if (confirm(`确定要清空该网址的权重吗？`)) {
            await updateWeightValue(url, 0, true);
          }
        } else if (action === 'rewrite') {
          let newW = prompt('请输入新的权重数值（整数）：', '');
          if (newW !== null && !isNaN(newW)) {
            await updateWeightValue(url, parseInt(newW), false);
          }
        }
      });
    });
  }

  async function updateWeightValue(url, value, isDelete) {
    chrome.storage.local.get(['weights'], async (data) => {
      let weights = data.weights || {};
      if (isDelete || value <= 0) {
        delete weights[url];
      } else {
        weights[url] = value;
      }
      await chrome.storage.local.set({ weights: weights });
      loadData();
    });
  }

  // 搜索过滤支持
  searchInput.addEventListener('input', (e) => {
    let keyword = e.target.value.toLowerCase();
    let filtered = bookmarksData.filter(item => 
      item.title.toLowerCase().includes(keyword) || item.url.toLowerCase().includes(keyword)
    );
    renderList(filtered);
  });

  loadData();
});
