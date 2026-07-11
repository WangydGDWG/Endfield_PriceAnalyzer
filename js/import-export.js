//  __      __                                        __     
// /\ \  __/\ \                                      /\ \    
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \   
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \  
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \ 
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/       
//                                    \_/__/    \/__/         

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
    _version: 6,
    _exported: new Date().toISOString(),
    _accounts_exported: selected,
    accounts: selected,
    accountMeta: Object.fromEntries(selected.map(a => [a, (d.accountMeta||{})[a]||{}])),
    records: Object.fromEntries(selected.map(a => [a, (d.records||{})[a]||[]])),
    itemOrder: Object.fromEntries(selected.map(a => [a, (d.itemOrder||{})[a]||[]])),
    itemMeta: Object.fromEntries(selected.map(a => [a, (d.itemMeta||{})[a]||{}]))
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
        const curOrder = cur.itemOrder||{};
        const newOrder = payload.itemOrder||{};
        const mergedOrder = {...curOrder};
        Object.entries(newOrder).forEach(([acc, order]) => {
          if (!mergedOrder[acc] || !mergedOrder[acc].length) { mergedOrder[acc] = order; return; }
          mergedOrder[acc] = [...new Set([...mergedOrder[acc], ...order])];
        });
        const curItemMeta = cur.itemMeta||{};
        const newItemMeta = payload.itemMeta||{};
        const mergedItemMeta = {...curItemMeta};
        Object.entries(newItemMeta).forEach(([acc, meta]) => {
          mergedItemMeta[acc] = {...(meta||{}), ...(mergedItemMeta[acc]||{})};
        });
        save({ accounts: merged, accountMeta: mergedMeta, records: mergedRecs, itemOrder: mergedOrder, itemMeta: mergedItemMeta });
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

// ══════════════════════════════════════
// BASE64 IMPORT / EXPORT（安卓兼容模式）
// ══════════════════════════════════════

// UTF-8 安全的 Base64 编解码
function _toBase64UTF8(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(_, p1) {
    return String.fromCharCode(parseInt(p1, 16));
  }));
}
function _fromBase64UTF8(b64) {
  try {
    return decodeURIComponent(atob(b64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch(e) {
    throw new Error('Base64 解码失败，请确认文本完整无误');
  }
}

// 从导出模态框生成 Base64 文本（替代下载文件）
function confirmExportBase64() {
  const selected = [...document.querySelectorAll('.export-check-item.selected')].map(i => i.dataset.acc);
  if (!selected.length) { notify('请至少选择一个账号', 'var(--red)'); return; }
  const d = load();
  const payload = {
    _type: 'ENDFIELD_PRICE_DATA',
    _version: 6,
    _exported: new Date().toISOString(),
    _accounts_exported: selected,
    accounts: selected,
    accountMeta: Object.fromEntries(selected.map(a => [a, (d.accountMeta||{})[a]||{}])),
    records: Object.fromEntries(selected.map(a => [a, (d.records||{})[a]||[]])),
    itemOrder: Object.fromEntries(selected.map(a => [a, (d.itemOrder||{})[a]||[]])),
    itemMeta: Object.fromEntries(selected.map(a => [a, (d.itemMeta||{})[a]||{}]))
  };
  const b64 = _toBase64UTF8(JSON.stringify(payload));
  closeExportModal();
  document.getElementById('b64ExportTextarea').value = b64;
  document.getElementById('b64ExportInfo').textContent =
    `已包含 ${selected.length} 个账号 · ${b64.length} 字符`;
  document.getElementById('b64ExportModalOverlay').classList.add('open');
}

function closeB64ExportModal() {
  document.getElementById('b64ExportModalOverlay').classList.remove('open');
}

function copyB64ExportText() {
  const el = document.getElementById('b64ExportTextarea');
  el.select();
  el.setSelectionRange(0, 99999); // 兼容移动端
  const text = el.value;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(function() { notify('已复制到剪贴板'); })
      .catch(function() {
        try { document.execCommand('copy'); notify('已复制到剪贴板'); }
        catch(e) { notify('请手动长按文本框全选后复制', 'var(--red)'); }
      });
  } else {
    try { document.execCommand('copy'); notify('已复制到剪贴板'); }
    catch(e) { notify('请手动长按文本框全选后复制', 'var(--red)'); }
  }
}

// 打开 Base64 导入弹窗
function openB64ImportModal() {
  document.getElementById('b64ImportTextarea').value = '';
  document.getElementById('b64ImportModalOverlay').classList.add('open');
  setTimeout(function() {
    document.getElementById('b64ImportTextarea').focus();
  }, 120);
}

function closeB64ImportModal() {
  document.getElementById('b64ImportModalOverlay').classList.remove('open');
}

function confirmB64Import() {
  const raw = document.getElementById('b64ImportTextarea').value.trim();
  if (!raw) { notify('请粘贴 Base64 数据', 'var(--red)'); return; }
  let payload;
  try {
    const json = _fromBase64UTF8(raw);
    payload = JSON.parse(json);
    if (payload._type !== 'ENDFIELD_PRICE_DATA') throw new Error('格式不匹配，请确认是否为本工具导出的数据');
  } catch(err) {
    notify('解析失败：' + err.message, 'var(--red)');
    return;
  }
  const msg = '导入将与现有数据合并（相同账号的记录取并集）。\n导出时间：' + (payload._exported||'未知') +
              '\n包含账号：' + (payload.accounts||[]).join(', ');
  closeB64ImportModal();
  openConfirmModal(msg, function() {
    const cur = load();
    const existAcc = cur.accounts||[];
    const newAcc = payload.accounts||[];
    const merged = [...new Set([...existAcc, ...newAcc])];
    const curMeta = cur.accountMeta||{};
    const newMeta = payload.accountMeta||{};
    const mergedMeta = Object.assign({}, newMeta, curMeta);
    const curRecs = cur.records||{};
    const newRecs = payload.records||{};
    const mergedRecs = Object.assign({}, curRecs);
    Object.entries(newRecs).forEach(function([acc, recs]) {
      if (!mergedRecs[acc]) { mergedRecs[acc] = recs; return; }
      recs.forEach(function(nr) {
        const existing = mergedRecs[acc].find(function(r) { return r.item===nr.item && r.week===nr.week; });
        if (!existing) { mergedRecs[acc].push(nr); return; }
        nr.prices.forEach(function(p, i) { if (existing.prices[i]==null && p!=null) existing.prices[i]=p; });
      });
    });
    const curOrder = cur.itemOrder||{};
    const newOrder = payload.itemOrder||{};
    const mergedOrder = Object.assign({}, curOrder);
    Object.entries(newOrder).forEach(function([acc, order]) {
      if (!mergedOrder[acc] || !mergedOrder[acc].length) { mergedOrder[acc] = order; return; }
      mergedOrder[acc] = [...new Set([...mergedOrder[acc], ...order])];
    });
    const curItemMeta = cur.itemMeta||{};
    const newItemMeta = payload.itemMeta||{};
    const mergedItemMeta = Object.assign({}, curItemMeta);
    Object.entries(newItemMeta).forEach(function([acc, meta]) {
      mergedItemMeta[acc] = Object.assign({}, meta||{}, mergedItemMeta[acc]||{});
    });
    save({ accounts: merged, accountMeta: mergedMeta, records: mergedRecs, itemOrder: mergedOrder, itemMeta: mergedItemMeta });
    renderHome();
    notify('导入完成，共 ' + merged.length + ' 个账号');
  });
}

// ══════════════════════════════════════
// 导入下拉菜单控制
// ══════════════════════════════════════
function toggleImportDropdown() {
  document.getElementById('importDropdownMenu').classList.toggle('open');
}
function closeImportDropdown() {
  const m = document.getElementById('importDropdownMenu');
  if (m) m.classList.remove('open');
}
// 点击菜单外部时关闭
document.addEventListener('click', function(e) {
  const dd = document.getElementById('importDropdown');
  if (dd && !dd.contains(e.target)) closeImportDropdown();
});
