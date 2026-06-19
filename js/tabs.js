// ══════════════════════════════════════
// TAB SWITCHING
// ══════════════════════════════════════
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  const labels = { overview:'总览', main:'分析', data:'数据', detail:'详细信息' };
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.textContent.trim() === labels[name]) b.classList.add('active');
  });
  if (name === 'detail') renderDetail();
  if (name === 'overview') initOverview();
  if (name === 'data') {
    // Sync data tab filters from inp controls (analysis tab state)
    const item = document.getElementById('inp-item').value;
    const week = document.getElementById('inp-week').value;
    document.getElementById('data-sel-item').value = item;
    document.getElementById('data-sel-week').value = week;
    renderTable();
    renderDataTabDetails();
  }
  if (name === 'main') {
    // Sync inp controls from data tab filters
    const item = document.getElementById('data-sel-item').value;
    const week = document.getElementById('data-sel-week').value;
    if (item) document.getElementById('inp-item').value = item;
    if (week) document.getElementById('inp-week').value = week;
    // Trigger full sync (populates day inputs and rerenders)
    onInpWeekChange();
  }
}
