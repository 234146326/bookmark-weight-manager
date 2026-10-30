document.addEventListener('DOMContentLoaded', () => {
  const stayTimeMinutesInput = document.getElementById('stayTimeMinutes');
  const stayTimeBonusInput = document.getElementById('stayTimeBonus');
  const openCountBonusInput = document.getElementById('openCountBonus');
  const saveBtn = document.getElementById('saveBtn');
  const statusMsg = document.getElementById('statusMsg');

  // 加载当前设置
  chrome.storage.local.get(['weightRules'], (data) => {
    let rules = data.weightRules || {
      stayTimeMinutes: 60,
      stayTimeBonus: 5,
      openCountBonus: 1
    };
    stayTimeMinutesInput.value = rules.stayTimeMinutes;
    stayTimeBonusInput.value = rules.stayTimeBonus;
    openCountBonusInput.value = rules.openCountBonus;
  });

  // 保存设置并立即生效
  saveBtn.addEventListener('click', () => {
    let rules = {
      stayTimeMinutes: parseInt(stayTimeMinutesInput.value) || 60,
      stayTimeBonus: parseInt(stayTimeBonusInput.value) || 5,
      openCountBonus: parseInt(openCountBonusInput.value) || 1
    };

    chrome.storage.local.set({ weightRules: rules }, () => {
      statusMsg.style.display = 'inline';
      setTimeout(() => {
        statusMsg.style.display = 'none';
      }, 2000);
    });
  });
});
