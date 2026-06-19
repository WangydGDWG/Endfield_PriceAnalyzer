(function(){
  const footer = document.getElementById('site-footer');

  // Patch showView / goHome / openAccount to toggle footer state
  const _origSwitchView = window.showView || null;

  function updateFooter() {
    const homeActive  = document.getElementById('home').classList.contains('active');
    footer.classList.toggle('visible', homeActive);
  }

  // Intercept goHome / openAccount by wrapping after DOMContentLoaded
  const origGoHome = window.goHome;
  window.goHome = function(){ if(origGoHome) origGoHome.apply(this,arguments); updateFooter(); };

  const origOpenAccount = window.openAccount;
  window.openAccount = function(){ if(origOpenAccount) origOpenAccount.apply(this,arguments); updateFooter(); };

  const origSwitchTab = window.switchTab;
  window.switchTab = function(){ if(origSwitchTab) origSwitchTab.apply(this,arguments); updateFooter(); };

  // Initial state
  updateFooter();
})();

// 加载进度条兜底：全部资源加载完成后强制隐藏
window.addEventListener('load', function(){ if (typeof __loaderDone === 'function') __loaderDone(); });
