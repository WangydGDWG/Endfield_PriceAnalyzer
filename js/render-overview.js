// ══════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════
function initOverview() {
  const sel = document.getElementById('ov-week-sel');
  const stdWeeks = buildWeekOptions();
  const recs = getRecords(currentAccount);
  const recordedWeeks = [...new Set(recs.map(r => r.week))];
  const allWeeks = [...new Set([...stdWeeks, ...recordedWeeks])];
  const prevVal = sel.value;
  sel.innerHTML = allWeeks.map(w => `<option value="${esc(w)}">${shortWeekLabel(w)}</option>`).join('');
  if (allWeeks.includes(prevVal)) sel.value = prevVal;
  renderOverview();
}

function shortWeekLabel(w) {
  const m = w.match(/第(\d+)周/);
  return m ? `第${m[1]}周` : w;
}

function promptCreateItem() {
  openInputModal('新增物品', '请输入物品名称：', '', (name) => {
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const recs = getRecords(currentAccount);
    const week = document.getElementById('ov-week-sel').value;
    if (recs.some(r => r.item === trimmed && r.week === week)) {
      notify('该周已存在此物品', 'var(--accent)');
      return;
    }
    recs.push({ item: trimmed, week: week, prices: Array(7).fill(null) });
    saveRecords(currentAccount, recs);
    renderOverview();
    updateAccountView();
    notify(`已创建物品: ${trimmed}`);
  });
}

function renameItem(oldName) {
  openInputModal('重命名物品', `将物品 "${oldName}" 重命名为：`, oldName, (newName) => {
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const recs = getRecords(currentAccount);
    recs.forEach(r => {
      if (r.item === oldName) r.item = newName.trim();
    });
    saveRecords(currentAccount, recs);
    updateAccountView();
    renderOverview();
    notify(`已重命名为 ${newName.trim()}`);
  });
}

function deleteItem(itemName) {
  openConfirmModal(`确认删除物品 "${itemName}" 的所有数据？此操作不可撤销。`, () => {
    const recs = getRecords(currentAccount).filter(r => r.item !== itemName);
    saveRecords(currentAccount, recs);
    updateAccountView();
    renderOverview();
    notify(`已删除物品: ${itemName}`, 'var(--red)');
  });
}

function renderOverview() {
  const week = document.getElementById('ov-week-sel').value;
  const recs = getRecords(currentAccount);
  const items = [...new Set(recs.map(r => r.item))];
  const grid = document.getElementById('ov-grid');
  document.getElementById('ov-week-label').textContent = week || '';

  if (!items.length) {
    grid.innerHTML = `<div class="ov-add-item" onclick="promptCreateItem()"><span style="font-size:24px">+</span><span>快速添加物品</span></div>`;
    return;
  }

  const html = items.map(item => {
    const itemRecs = recs.filter(r => r.item === item);
    const result = analyzeItemSafe(itemRecs);
    const focusRec = week ? itemRecs.find(r => r.week === week) : null;
    const currentPrices = focusRec ? focusRec.prices : Array(7).fill(null);
    const isLocked = result && result.stage === 'locked';
    const isPending = result && result.stage === 'pending';

    const statusColor = isLocked ? 'var(--green)' : isPending ? 'var(--accent)' : 'var(--textd)';
    const statusLabel = isLocked ? 'ε 已锁定' : isPending ? `收敛中 ${result.candidateCount}/8` : '数据不足';

    let predPrices = Array(7).fill(null);
    let predLabel = '暂无预测';
    let candidateCount = 0;

    if (result && (isLocked || isPending) && result.eightPredictions) {
      const eight = filterEightPredictions(result.eightPredictions, currentPrices);
      const remaining = eight.filter(p => !p.eliminated);
      candidateCount = remaining.length;
      if (remaining.length === 1) {
        predPrices = remaining[0].predicted;
        predLabel = isLocked ? '✓ 唯一确定' : '本周唯一候选 (ε收敛中)';
      } else if (remaining.length > 0) {
        predPrices = remaining[0].predicted;
        predLabel = `${remaining.length} 组候选`;
      }
    }

    const isFullyConfirmed = isLocked && candidateCount === 1;

    const dayInputs = DAYS.map((d, i) => {
      const obs = currentPrices[i];
      return `<div class="ov-day-cell">
        <div class="ov-day-label">${d.replace('周','')}</div>
        <input type="text" inputmode="numeric"
          class="ov-day-input${obs!=null?' filled':''}"
          id="ov-inp-${esc(item)}-${i}"
          value="${obs!=null?obs:''}"
          placeholder="—"
          onkeydown="ovEnter(event,'${esc(item)}',${i})"
          oninput="this.classList.toggle('filled',this.value.trim()!=='')">
      </div>`;
    }).join('');

    const predCells = DAYS.map((d, i) => {
      const obs = currentPrices[i];
      const pred = predPrices[i];
      let val = '—', cls = 'unknown', extraStyle='', title='';
      if (obs != null) { 
        val = obs.toLocaleString(); 
        cls = 'obs'; 
      }
      else if (pred != null) {
        val = pred.toLocaleString();
        cls = candidateCount === 1 ? 'confirmed' : 'candidate';
        if (pred < 300 || pred > 5500) {
          extraStyle = 'color:var(--red)!important';
          title = ' title="预测数据超过范围(300-5500)，不准确"';
        }
      }
      return `<div class="ov-pred-cell" ${title}>
        <div class="ov-pred-day">${d.replace('周','')}</div>
        <div class="ov-pred-val ${cls}" style="${extraStyle}">${val}</div>
      </div>`;
    }).join('');

    let hlHtml = '';
    if (candidateCount > 0) {
      const pmax = Math.max(...predPrices);
      const pmin = Math.min(...predPrices);
      const dmax = DAYS[predPrices.indexOf(pmax)];
      const dmin = DAYS[predPrices.indexOf(pmin)];
      hlHtml = `<div style="font-size:12px;font-family:var(--mono);color:var(--textd);margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;">
        <span style="color:var(--green)">▲ ${dmax}最高 ${pmax.toLocaleString()}</span>
        <span style="color:var(--red)">▼ ${dmin}最低 ${pmin.toLocaleString()}</span>
      </div>`;
    }

    let cardContent = '';
    if (isFullyConfirmed) {
      const pmax = Math.max(...predPrices);
      const pmin = Math.min(...predPrices);
      const dmax = DAYS[predPrices.indexOf(pmax)];
      const dmin = DAYS[predPrices.indexOf(pmin)];

      cardContent = `
      <div class="ov-card-header" style="background:var(--green); border-bottom:none;">
        <div class="ov-item-name" style="color:#000;">${esc(item)}
          <button class="ov-rename-btn" style="color:rgba(0,0,0,0.6)" onclick="renameItem('${esc(item)}')">✎</button>
          <button class="ov-rename-btn" style="color:rgba(0,0,0,0.6)" onclick="deleteItem('${esc(item)}')">✕</button>
        </div>
        <div class="ov-status" style="color:#000;border-color:#000">${statusLabel}</div>
      </div>
      <div class="ov-body-inner">
        <div class="ov-pred-section" style="margin-top:0; border-top:none; padding-top:4px;">
          <div class="ov-pred-label" style="color:var(--green); font-weight:bold; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px;">
            <span>${predLabel}</span>
            <span style="font-size:11px; font-weight:normal; display:flex; gap:10px; font-family:var(--mono);">
              <span style="color:var(--green)">▲ ${dmax}最高 ${pmax.toLocaleString()}</span>
              <span style="color:var(--red)">▼ ${dmin}最低 ${pmin.toLocaleString()}</span>
            </span>
          </div>
          <div class="ov-pred-grid" id="ov-pred-grid-${esc(item)}">${predCells}</div>
          <div class="price-chart-wrap">
          <canvas id="price-chart-${esc(item)}"
            style="display:block; width:100%; height:80px;"
            data-prices="${predPrices.join(',')}"
          ></canvas>
          </div>
        </div>
      </div>`;
    } else {
      cardContent = `
      <div class="ov-card-header">
        <div class="ov-item-name">${esc(item)} <button class="ov-rename-btn" onclick="renameItem('${esc(item)}')">✎</button><button class="ov-rename-btn" style="color:var(--red)" onclick="deleteItem('${esc(item)}')">✕</button></div>
        <div class="ov-status" style="color:${statusColor};border-color:${statusColor}">${statusLabel}</div>
      </div>
      <div class="ov-body-inner">
        <div style="font-size:11px;color:var(--textd);font-family:var(--mono);margin-bottom:6px">快速录入 · 按 Enter 保存并跳下一天</div>
        <div class="ov-quick-inp">${dayInputs}</div>
        <button class="btn btn-sm ov-save-btn btn-teal" onclick="ovSaveAll('${esc(item)}','${esc(week)}')">保存本周数据</button>
        <div class="ov-pred-section">
          <div class="ov-pred-label">${predLabel}
            <span style="float:right;color:var(--textd)">
              ${candidateCount===1?'':candidateCount>0?`剩余 ${candidateCount}/8 候选`:''}
            </span>
          </div>
          <div class="ov-pred-grid">${predCells}</div>
          ${hlHtml}
        </div>
      </div>`;
    }

    return `<div class="ov-card${isLocked?' locked':''}">${cardContent}</div>`;
  }).join('');

  grid.innerHTML = html + `<div class="ov-add-item" onclick="promptCreateItem()"><span style="font-size:24px">+</span><span>快速添加物品</span></div>`;

  // 渲染所有价格图表
  requestAnimationFrame(() => { renderAllPriceCharts(); });
}

function ovEnter(event, item, dayIndex) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const week = document.getElementById('ov-week-sel').value;
  const inp = document.getElementById(`ov-inp-${item}-${dayIndex}`);
  const v = inp ? inp.value.trim().replace(/[^\d.]/g,'') : '';
  let saved = false;

  if (v !== '') {
    const price = validatePrice(v);
    if (price !== null) {
      const recs = getRecords(currentAccount);
      let rec = recs.find(r => r.item===item && r.week===week);
      if (!rec) { rec={item,week,prices:Array(7).fill(null)}; recs.push(rec); }
      rec.prices[dayIndex] = price;
      saveRecords(currentAccount, recs);
      saved = true;
    } else {
      if (inp) inp.classList.add('err');
      return;
    }
  }

  // 【核心修复】计算下一个焦点 ID。必须在 renderOverview() 销毁 DOM 前计算
  let nextId = `ov-inp-${item}-${dayIndex+1}`;
  if (!document.getElementById(nextId)) {
    const recs = getRecords(currentAccount);
    const items = [...new Set(recs.map(r=>r.item))];
    const idx = items.indexOf(item);
    if (idx < items.length-1) {
      nextId = `ov-inp-${items[idx+1]}-0`;
    } else {
      nextId = null;
    }
  }

  if (saved) {
    updateAccountView(); 
    renderOverview(); // 强制刷新总览 UI
  } else if (inp) {
    inp.classList.remove('filled');
  }

  // 待 DOM 渲染完毕后，根据预判的 ID 重新聚焦
  if (nextId) {
    const next = document.getElementById(nextId);
    if (next) { next.focus(); next.select(); }
  }
}
// ══════════════════════════════════════
// PRICE CHART RENDERER
// ══════════════════════════════════════
function renderAllPriceCharts() {
  document.querySelectorAll('canvas[id^="price-chart-"]').forEach(canvas => {
    const prices = canvas.dataset.prices.split(',').map(Number);
    if (prices.length !== 7) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const W = rect.width || canvas.offsetWidth || 300;
    const DAY_LABEL_H = 16;
    const H = 150;
    const CHART_H = H - DAY_LABEL_H;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const Y_MIN = 300;
    const Y_MAX = 5500;
    const BASE = 2000;
    const GUIDE_LOW = 1000;
    const GUIDE_HIGH = 4500;

    function valToY(v) {
      return CHART_H - (v - Y_MIN) / (Y_MAX - Y_MIN) * CHART_H;
    }

    const baseYMapped = valToY(BASE);
    const lowYMapped = valToY(GUIDE_LOW);
    const highYMapped = valToY(GUIDE_HIGH);

    const COL = W / 7;

    const cs = getComputedStyle(document.documentElement);
    const RED = (cs.getPropertyValue('--red') || '#e05c6a').trim();
    const GREEN = (cs.getPropertyValue('--green') || '#52d68a').trim();
    const MONO_FONT = `'Share Tech Mono', monospace`;

    // — 辅助线：4500
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(232,140,60,0.70)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, highYMapped);
    ctx.lineTo(W - 10, highYMapped);
    ctx.stroke();

    ctx.font = `7px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(232,140,60,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText('4500', W - 30, highYMapped - 2);

    ctx.restore();

    // — 辅助线：2000
    ctx.save();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.50)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, baseYMapped);
    ctx.lineTo(W - 10, baseYMapped);
    ctx.stroke();

    ctx.font = `7px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText('2000', W - 30, baseYMapped - 2);

    ctx.restore();

    // — 辅助线：1000
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(91,156,246,0.70)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, lowYMapped);
    ctx.lineTo(W - 10, lowYMapped);
    ctx.stroke();

    ctx.font = `7px ${MONO_FONT}`;
    ctx.fillStyle = 'rgba(91,156,246,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText('1000', W - 30, lowYMapped - 2);

    ctx.restore();

    const pmaxIdx = prices.indexOf(Math.max(...prices));
    const pminIdx = prices.indexOf(Math.min(...prices));

    // — 数据点
    const points = prices.map((price, i) => {
      return {
        x: i * COL + COL / 2,
        y: valToY(price),
        price
      };
    });

    // — 面积渐变
    ctx.save();

    const grad = ctx.createLinearGradient(0, 0, 0, CHART_H);
    grad.addColorStop(0, 'rgba(120,220,255,0.20)');
    grad.addColorStop(1, 'rgba(120,220,255,0.00)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.lineTo(points[points.length - 1].x, CHART_H);
    ctx.lineTo(points[0].x, CHART_H);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();

    // — 折线
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // — 节点 + 数值
    points.forEach((p, i) => {
      const isMax = i === pmaxIdx;
      const isMin = i === pminIdx;

      const pointColor = isMax
        ? GREEN
        : isMin
          ? RED
          : '#ffffff';

      // 节点
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        isMax || isMin ? 4.5 : 3,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = pointColor;
      ctx.fill();

      // 发光
      if (isMax || isMin) {
        ctx.save();

        ctx.shadowBlur = 10;
        ctx.shadowColor = pointColor;

        ctx.beginPath();
        ctx.arc(
          p.x,
          p.y,
          4.5,
          0,
          Math.PI * 2
        );

        ctx.fillStyle = pointColor;
        ctx.fill();

        ctx.restore();
      }

      // 价格数字
      ctx.font = `9px ${MONO_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = pointColor;

      ctx.fillText(
        p.price.toLocaleString(),
        p.x,
        p.y - 10
      );
    });

    // — X轴星期
    const dayNames = ['一', '二', '三', '四', '五', '六', '日'];

    ctx.font = `9px ${MONO_FONT}`;
    ctx.textAlign = 'center';

    prices.forEach((_, i) => {
      const cx = i * COL + COL / 2;

      const isMax = i === pmaxIdx;
      const isMin = i === pminIdx;

      ctx.fillStyle = isMax
        ? GREEN
        : isMin
          ? RED
          : 'rgba(255,255,255,0.38)';

      ctx.fillText(dayNames[i], cx, H - 3);
    });
  });
}

function ovSaveAll(item, week) {
  if (!week) { notify('请先选择周次','var(--red)'); return; }
  const recs = getRecords(currentAccount);
  let rec = recs.find(r => r.item===item && r.week===week);
  if (!rec) { rec={item,week,prices:Array(7).fill(null)}; recs.push(rec); }
  let saved = 0, errDays = [];
  DAYS.forEach((_,i) => {
    const inp = document.getElementById(`ov-inp-${item}-${i}`);
    if (!inp) return;
    const v = inp.value.trim().replace(/[^\d.]/g,'');
    if (v === '') return;
    const price = validatePrice(v);
    if (price !== null) { rec.prices[i] = price; saved++; inp.classList.add('filled'); inp.classList.remove('err'); }
    else { inp.classList.add('err'); errDays.push(DAYS[i]); }
  });
  if (errDays.length) { notify(`价格范围错误: ${errDays.join(',')}`, 'var(--red)'); return; }
  saveRecords(currentAccount, recs);
  updateAccountView();
  renderOverview();
  notify(`${item} · ${shortWeekLabel(week)} · 已保存 ${saved} 天`);
}
