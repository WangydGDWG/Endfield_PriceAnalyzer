function openAboutModal() {
  document.getElementById('aboutModalOverlay').classList.add('open');
}

let _inputModalCallback = null;
function openInputModal(title, labelText, defaultVal, callback) {
  document.getElementById('inputModalTitle').textContent = title;
  document.getElementById('inputModalLabel').textContent = labelText;
  const field = document.getElementById('inputModalField');
  field.value = defaultVal || '';
  _inputModalCallback = callback;
  document.getElementById('inputModalOverlay').classList.add('open');
  setTimeout(() => { field.focus(); field.select(); }, 100);
}
function closeInputModal() {
  document.getElementById('inputModalOverlay').classList.remove('open');
  _inputModalCallback = null;
}
function confirmInputModal() {
  const val = document.getElementById('inputModalField').value;
  // 【核心修复】先转存 callback 引用，防止被 close 函数清除
  const cb = _inputModalCallback;
  closeInputModal();
  if (cb) { cb(val); }
}
document.getElementById('inputModalField').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmInputModal();
  if (e.key === 'Escape') closeInputModal();
});

let _confirmModalCallback = null;
function openConfirmModal(text, callback) {
  document.getElementById('confirmModalText').textContent = text;
  _confirmModalCallback = callback;
  document.getElementById('confirmModalOverlay').classList.add('open');
}
function closeConfirmModal() {
  document.getElementById('confirmModalOverlay').classList.remove('open');
  _confirmModalCallback = null;
}
function doConfirmModal() {
  // 修正引用丢失BUG：先转存callback，再关闭弹窗
  const cb = _confirmModalCallback;
  closeConfirmModal();
  if (cb) { cb(); }
}
