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
// NOTIFICATION
// ══════════════════════════════════════
function notify(msg, color='var(--teal)') {
  const el = document.getElementById('notif');
  el.textContent = msg; el.style.borderColor = color; el.style.color = color;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

// ══════════════════════════════════════
// HOME
// ══════════════════════════════════════
let currentAccount = null;

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function renderHome() {
  const accounts = getAccounts();
  const grid = document.getElementById('accountGrid');
  const cards = accounts.map((acc, idx) => {
    const recs = getRecords(acc);
    const items = [...new Set(recs.map(r => r.item))];
    const totalPts = recs.reduce((s,r) => s + r.prices.filter(p=>p!=null).length, 0);
    const meta = getAccountMeta(acc);
    const created = meta.created ? new Date(meta.created).toLocaleDateString('zh-CN') : '—';
    const itemList = items.length ? items.map(i => esc(i)).join(' · ') : '暂无物品';
    return `<div class="account-card" onclick="openAccount('${esc(acc)}')">
      <div class="ac-name"><span class="ac-no">${String(idx + 1).padStart(2, '0')}</span>${esc(acc)}</div>
      <div class="ac-meta" style="margin-top:8px">${itemList}</div>
      <div class="ac-meta" style="margin-top:6px">${totalPts} 数据点 · ${recs.length} 周记录</div>
      <div class="ac-meta" style="margin-top:4px;color:var(--textd)">创建于 ${created}</div>
    </div>`;
  }).join('');
  grid.innerHTML = cards + `<div class="add-account-card" onclick="openAddAccount()"><span style="font-size:20px">+</span><span>新增账号</span></div>`;
}

function openAddAccount() {
  document.getElementById('modal-name').value = '';
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 100);
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
function confirmAddAccount() {
  const name = document.getElementById('modal-name').value.trim();
  if (!name) { notify('请输入账号名称','var(--red)'); return; }
  const accounts = getAccounts();
  if (accounts.includes(name)) { notify('账号已存在','var(--accent)'); return; }
  accounts.push(name); saveAccounts(accounts);
  saveAccountMeta(name, { created: new Date().toISOString() });
  closeModal(); renderHome();
  notify(`已创建账号: ${name}`);
}
function goHome() {
  document.getElementById('home').classList.add('active');
  document.getElementById('account-view').classList.remove('active');
  currentAccount = null; renderHome();
}

// ══════════════════════════════════════
// ACCOUNT VIEW
// ══════════════════════════════════════
function openAccount(name) {
  currentAccount = name;
  document.getElementById('home').classList.remove('active');
  document.getElementById('account-view').classList.add('active');
  document.getElementById('av-name').textContent = name;
  
  document.querySelectorAll('.day-inp').forEach(i => { i.value=''; i.classList.remove('filled','err'); });
  document.getElementById('inp-msg').textContent = '';
  document.getElementById('sel-item').value = '';
  document.getElementById('sel-week').value = '';
  document.getElementById('data-sel-item').value = '';
  document.getElementById('data-sel-week').value = '';
  
  // 总览作为主Tab
  switchTab('overview');
  populateWeekSelect('inp-week');
  updateAccountView();
}
function deleteCurrentAccount() {
  openConfirmModal(`确认删除账号 "${currentAccount}" 及所有数据？此操作不可撤销。`, () => {
    saveAccounts(getAccounts().filter(a => a !== currentAccount));
    const d = load(); if (d.records) delete d.records[currentAccount]; save(d);
    notify('账号已删除','var(--red)');
    goHome();
  });
}
function isTabActive(name) {
  const el = document.getElementById('tab-' + name);
  return !!el && el.classList.contains('active');
}

function updateAccountView() {
  if (!currentAccount) return;
  const recs = getRecords(currentAccount);
  const items = [...new Set(recs.map(r => r.item))];
  const weeks = [...new Set(recs.map(r => r.week))];
  document.getElementById('av-sub').textContent =
    `${items.length} 物品 · ${recs.length} 周记录 · ${recs.reduce((s,r)=>s+r.prices.filter(p=>p!=null).length,0)} 数据点`;
  
  const si = document.getElementById('sel-item');
  const sw = document.getElementById('sel-week');
  const dsi = document.getElementById('data-sel-item');
  const dsw = document.getElementById('data-sel-week');
  const inpi = document.getElementById('inp-item');

  const pvi = inpi.value;
  const pvw = document.getElementById('inp-week').value;
  const itemHtml = '<option value="">-- 选择物品 --</option>' + items.map(i=>`<option value="${esc(i)}">${esc(i)}</option>`).join('');
  si.innerHTML = itemHtml; dsi.innerHTML = itemHtml; inpi.innerHTML = itemHtml;
  
  const stdWeeks = buildWeekOptions();
  const allWeeks = [...new Set([...stdWeeks, ...weeks])];
  const weekHtml = '<option value="">-- 选择周次 --</option>' + allWeeks.map(w=>`<option value="${esc(w)}">${esc(w)}</option>`).join('');
  sw.innerHTML = weekHtml; dsw.innerHTML = weekHtml;

  if (items.includes(pvi)) { si.value = pvi; dsi.value = pvi; inpi.value = pvi; }
  if (allWeeks.includes(pvw)) { sw.value = pvw; dsw.value = pvw; }
  
  // 只重绘当前可见的分析/数据页；详情页是静态说明，切换到该 Tab 时再渲染。
  // 这能避免每次保存都重建整页 HTML 与图表。
  renderTable();
  if (isTabActive('main')) renderAnalysis();
  if (isTabActive('data')) renderDataTabDetails();
}
function onSelChange() { 
  document.getElementById('data-sel-item').value = document.getElementById('sel-item').value;
  document.getElementById('data-sel-week').value = document.getElementById('sel-week').value;
  renderTable();
  renderAnalysis(); 
  renderDataTabDetails();
}

function onDataSelChange() {
  const item = document.getElementById('data-sel-item').value;
  const week = document.getElementById('data-sel-week').value;
  document.getElementById('sel-item').value = item;
  document.getElementById('sel-week').value = week;
  if (item) document.getElementById('inp-item').value = item;
  if (week) document.getElementById('inp-week').value = week;
  renderTable();
  renderAnalysis();
  renderDataTabDetails();
}

function onInpWeekChange() {
  const item = document.getElementById('inp-item').value;
  const week = document.getElementById('inp-week').value;

  // 向所有控制器同步物品
  document.getElementById('sel-item').value = item;
  document.getElementById('sel-week').value = week;
  document.getElementById('data-sel-item').value = item;
  document.getElementById('data-sel-week').value = week;

  // 未选中周数时禁止录入价格
  if (!week) {
    document.querySelectorAll('.day-inp').forEach(inp => {
      inp.value = '';
      inp.classList.remove('filled','err');
      inp.disabled = true;
      inp.style.opacity = '0.35';
      inp.style.cursor = 'not-allowed';
    });
    renderTable();
    renderAnalysis();
    renderDataTabDetails();
    return;
  }

  // 选中周数时再次开放录入
  document.querySelectorAll('.day-inp').forEach(inp => {
    inp.disabled = false;
    inp.style.opacity = '';
    inp.style.cursor = '';
  });

  if (!item) {
    renderTable();
    renderAnalysis();
    renderDataTabDetails();
    return;
  }

  const recs = getRecords(currentAccount);
  const rec = recs.find(r => r.item === item && r.week === week);
  document.querySelectorAll('.day-inp').forEach(inp => {
    const day = parseInt(inp.dataset.day);
    if (rec && rec.prices[day] != null) {
      inp.value = rec.prices[day];
      inp.classList.add('filled');
      inp.classList.remove('err');
    } else {
      inp.value = '';
      inp.classList.remove('filled','err');
    }
  });
  renderTable();
  renderAnalysis();
  renderDataTabDetails();
}
function onInpItemChange() {
  const item = document.getElementById('inp-item').value;
  document.getElementById('sel-item').value = item;
  document.getElementById('data-sel-item').value = item;
  onInpWeekChange();
}
