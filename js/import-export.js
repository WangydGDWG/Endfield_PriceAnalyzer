// ══════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════
function openExportModal() {
  const accounts = getAccounts();
  const list = document.getElementById('exportCheckList');
  list.innerHTML = accounts.map(acc => {
    const recs = getRecords(acc);
    const items = [...new Set(recs.map(r => r.item))];
    const pts = recs.reduce((s,r) => s + r.prices.filter(p=>p!=null).length, 0);
    const meta = getAccountMeta(acc);
    const created = meta.created ? new Date(meta.created).toLocaleDateString('zh-CN') : '—';
    return `<div class="export-check-item" id="eci-${esc(acc)}" data-acc="${esc(acc)}" onclick="toggleExportItem('${esc(acc)}')">
      <div style="flex:1">
        <div class="ec-name">${esc(acc)}</div>
        <div class="ec-meta">${items.length} 物品 · ${pts} 数据点 · 创建于 ${created}</div>
      </div>
      <div id="eck-${esc(acc)}" style="font-size:18px;color:var(--textd);flex-shrink:0;width:24px;text-align:center">○</div>
    </div>`;
  }).join('');
  updateExportCount();
  document.getElementById('exportModalOverlay').classList.add('open');
}

function toggleExportItem(acc) {
  const item = document.getElementById(`eci-${acc}`);
  const mark = document.getElementById(`eck-${acc}`);
  if (!item || !mark) return;
  const isSelected = item.classList.contains('selected');
  item.classList.toggle('selected', !isSelected);
  mark.textContent = isSelected ? '○' : '●';
  mark.style.color = isSelected ? 'var(--textd)' : 'var(--accent)';
  updateExportCount();
}

function closeExportModal() {
  document.getElementById('exportModalOverlay').classList.remove('open');
}

function updateExportCount() {
  const checked = document.querySelectorAll('.export-check-item.selected').length;
  document.getElementById('exportSelCount').textContent = `已选 ${checked} 个`;
}

function toggleSelectAll() {
  const items = document.querySelectorAll('.export-check-item');
  const allSelected = [...items].every(i => i.classList.contains('selected'));
  items.forEach(item => {
    const acc = item.dataset.acc;
    const mark = document.getElementById(`eck-${acc}`);
    item.classList.toggle('selected', !allSelected);
    if (mark) { mark.textContent = allSelected ? '○' : '●'; mark.style.color = allSelected ? 'var(--textd)' : 'var(--accent)'; }
  });
  updateExportCount();
}

function confirmExport() {
  const selected = [...document.querySelectorAll('.export-check-item.selected')].map(i => i.dataset.acc);
  if (!selected.length) { notify('请至少选择一个账号','var(--red)'); return; }
  const d = load();
  const payload = {
    _type: 'ENDFIELD_PRICE_DATA',
    _version: 5,
    _exported: new Date().toISOString(),
    _accounts_exported: selected,
    accounts: selected,
    accountMeta: Object.fromEntries(selected.map(a => [a, (d.accountMeta||{})[a]||{}])),
    records: Object.fromEntries(selected.map(a => [a, (d.records||{})[a]||[]]))
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0,10);
  const suffix = selected.length === 1 ? `_${selected[0]}` : `_${selected.length}accounts`;
  a.href = url; a.download = `endfield${suffix}_${ts}.efdata`; a.click();
  URL.revokeObjectURL(url);
  closeExportModal();
  notify(`已导出 ${selected.length} 个账号`);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      if (payload._type !== 'ENDFIELD_PRICE_DATA') throw new Error('格式错误');
      const msg = `导入将与现有数据合并（相同账号的记录取并集）。\n文件导出时间：${payload._exported||'未知'}\n包含账号：${(payload.accounts||[]).join(', ')}`;
      openConfirmModal(msg, () => {
        const cur = load();
        const existAcc = cur.accounts||[];
        const newAcc = payload.accounts||[];
        const merged = [...new Set([...existAcc, ...newAcc])];
        const curMeta = cur.accountMeta||{};
        const newMeta = payload.accountMeta||{};
        const mergedMeta = {...newMeta, ...curMeta};
        const curRecs = cur.records||{};
        const newRecs = payload.records||{};
        const mergedRecs = {...curRecs};
        Object.entries(newRecs).forEach(([acc, recs]) => {
          if (!mergedRecs[acc]) { mergedRecs[acc] = recs; return; }
          recs.forEach(nr => {
            const existing = mergedRecs[acc].find(r => r.item===nr.item && r.week===nr.week);
            if (!existing) { mergedRecs[acc].push(nr); return; }
            nr.prices.forEach((p,i) => { if (existing.prices[i]==null && p!=null) existing.prices[i]=p; });
          });
        });
        save({ accounts: merged, accountMeta: mergedMeta, records: mergedRecs });
        renderHome();
        notify(`导入完成，共 ${merged.length} 个账号`);
      });
    } catch(err) {
      notify(`导入失败：${err.message}`, 'var(--red)');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}
