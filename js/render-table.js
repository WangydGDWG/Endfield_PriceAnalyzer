//  __      __                                        __     
// /\ \  __/\ \                                      /\ \    
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \   
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \  
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \ 
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/       
//                                    \_/__/    \/__/         

//添加记录和渲染表格的核心代码

// ══════════════════════════════════════
// ADD RECORD
// ══════════════════════════════════════
const PRICE_MIN = 300, PRICE_MAX = 5500;

function validatePrice(v) {
  const n = Number(v);
  return !isNaN(n) && n >= PRICE_MIN && n <= PRICE_MAX ? n : null;
}

function saveSingleDay(dayIndex, priceVal) {
  const item = document.getElementById('inp-item').value;
  const week = document.getElementById('inp-week').value;
  const msg  = document.getElementById('inp-msg');
  if (!item || !week) { msg.style.color='var(--red)'; msg.textContent='请先选择物品名称和周次'; return false; }
  const price = validatePrice(priceVal);
  if (price === null) {
    msg.style.color='var(--red)';
    msg.textContent=`价格需在 ${PRICE_MIN}～${PRICE_MAX} 之间`;
    return false;
  }
  const recs = getRecords(currentAccount);
  let rec = recs.find(r => r.item===item && r.week===week);
  if (!rec) {
    rec = {item, week, prices: Array(7).fill(null)};
    recs.push(rec);
  }
  rec.prices[dayIndex] = price;
  saveRecords(currentAccount, recs);
  msg.style.color='var(--teal)';
  msg.textContent=`✓ ${['周一','周二','周三','周四','周五','周六','周日'][dayIndex]} ${price.toLocaleString()} 已保存`;
  setTimeout(()=>msg.textContent='', 2000);
  
  document.getElementById('sel-item').value = item;
  document.getElementById('sel-week').value = week;
  document.getElementById('data-sel-item').value = item;
  document.getElementById('data-sel-week').value = week;
  
  updateAccountView();
  return true;
}

function addRecord() {
  const item = document.getElementById('inp-item').value;
  const week = document.getElementById('inp-week').value;
  const msg  = document.getElementById('inp-msg');
  if (!item || !week) { msg.style.color='var(--red)'; msg.textContent='物品和周次为必填'; return; }
  const prices = [];
  let hasErr = false;
  document.querySelectorAll('.day-inp').forEach(inp => {
    const v = inp.value.trim().replace(/[^\d.]/g,'');
    if (v === '') { prices.push(null); return; }
    const n = validatePrice(v);
    if (n === null) { inp.classList.add('err'); hasErr = true; prices.push(null); }
    else { inp.classList.remove('err'); prices.push(n); }
  });
  if (hasErr) { msg.style.color='var(--red)'; msg.textContent=`价格需在 ${PRICE_MIN}～${PRICE_MAX} 之间`; return; }
  if (prices.every(p => p == null)) { msg.style.color='var(--red)'; msg.textContent='至少填入一天价格'; return; }
  const recs = getRecords(currentAccount);
  const existing = recs.find(r => r.item===item && r.week===week);
  if (existing) {
    prices.forEach((p,i) => { if (p != null) existing.prices[i] = p; });
    msg.style.color='var(--accent)'; msg.textContent='已合并到现有记录';
  } else {
    recs.push({item, week, prices});
    msg.style.color='var(--teal)'; msg.textContent='✓ 记录已添加';
  }
  saveRecords(currentAccount, recs);
  
  document.getElementById('sel-item').value = item;
  document.getElementById('sel-week').value = week;
  document.getElementById('data-sel-item').value = item;
  document.getElementById('data-sel-week').value = week;
  
  updateAccountView();
  onInpWeekChange(); 
  
  setTimeout(() => msg.textContent='', 2500);
}

// ══════════════════════════════════════
// TABLE
// ══════════════════════════════════════
function renderTable() {
  const selItem = document.getElementById('data-sel-item').value;
  let recsOrig = getRecords(currentAccount);
  let recs = [...recsOrig];
  
  if (selItem) {
    recs = recs.filter(r => r.item === selItem);
  } else {
    recs.sort((a, b) => a.item.localeCompare(b.item) || b.week.localeCompare(a.week));
  }

  const tbody = document.getElementById('data-tableBody');
  const empty = document.getElementById('data-table-empty');
  if (!recs.length) { tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';
  
  function shortWeek(w) {
    const m = w.match(/第\d+周/);
    return m ? m[0] : w;
  }
  
  tbody.innerHTML = recs.map(r =>
    `<tr>
      <td style="color:var(--textb)">${esc(r.item)}</td>
      <td style="font-size:13px;color:var(--accent)">${shortWeek(r.week)}</td>
      ${r.prices.map(p=>`<td style="color:${p!=null?'var(--teal)':'var(--textd)'}">${p!=null?p.toLocaleString():'—'}</td>`).join('')}
      <td><button class="del-btn" onclick="deleteRecord('${esc(r.item)}', '${esc(r.week)}')">✕</button></td>
    </tr>`
  ).join('');
}

function deleteRecord(item, week) {
  let recs = getRecords(currentAccount);
  recs = recs.filter(r => !(r.item === item && r.week === week));
  saveRecords(currentAccount, recs);
  updateAccountView();
  notify('已删除记录','var(--red)');
}
