//  __      __                                        __     
// /\ \  __/\ \                                      /\ \    
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \   
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \  
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \ 
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/       
//                                    \_/__/    \/__/         

//总览页面渲染核心代码

// ══════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════
function initOverview() {
  const sel = document.getElementById('ov-week-sel');
  const stdWeeks = buildWeekOptions();
  const prevVal = sel.value;
  sel.innerHTML = stdWeeks.map(w => `<option value="${esc(w)}">${shortWeekLabel(w)}</option>`).join('');
  if (stdWeeks.includes(prevVal)) sel.value = prevVal;
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

function getOrderedItems(recs) {
  const items = [...new Set(recs.map(r => r.item))];
  const order = getItemOrder(currentAccount);
  const ordered = order.filter(i => items.includes(i));
  const extras = items.filter(i => !ordered.includes(i));
  return [...ordered, ...extras];
}

const TAG_LABELS = { medium: '适中', large: '较大', xlarge: '极大' };
const TAG_CYCLE = [null, 'medium', 'large', 'xlarge'];

function tagBadgeHtml(item) {
  const tag = getItemTag(currentAccount, item);
  const cls = tag ? `tag-${tag}` : 'tag-none';
  const label = tag ? TAG_LABELS[tag] : '+标签';
  return `<span class="ov-tag ${cls}" onclick="event.stopPropagation();cycleItemTag('${esc(item)}')" title="点击切换：适中/较大/极大">${label}</span>`;
}

function cycleItemTag(item) {
  const cur = getItemTag(currentAccount, item);
  const idx = TAG_CYCLE.indexOf(cur);
  const next = TAG_CYCLE[(idx + 1) % TAG_CYCLE.length];
  setItemTag(currentAccount, item, next);
  renderOverview();
}

function renderRefreshWarning() {
  const box = document.getElementById('ov-refresh-warning');
  if (!box) return;
  const now = new Date();
  if (!isPreRefreshWindow(now)) { box.innerHTML = ''; return; }
  const todayLabel = formatCNDateFull(now);
  const gameDayLabel = formatCNDateFull(getGameDate(now));
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  box.innerHTML = `<div class="delta-banner pending">
    <span style="font-size:16px">⚠</span>
    <span>今天（${todayLabel}）数据尚未刷新（游戏于每日 04:00 刷新数据，当前 ${hh}:${mm}），请仍按 ${gameDayLabel} 的数据填写。</span>
  </div>`;
}

function renderOverview() {
  renderRefreshWarning();
  const week = document.getElementById('ov-week-sel').value;
  const recs = getRecords(currentAccount);
  const items = getOrderedItems(recs);
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
    const priceRange = getItemPriceRange(currentAccount, item);

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
          onblur="ovBlurSave('${esc(item)}','${esc(week)}',${i})"
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
        if (pred < priceRange.min || pred > priceRange.max) {
          extraStyle = 'color:var(--red)!important';
          title = ` title="预测数据超过范围(${priceRange.min}-${priceRange.max})，不准确"`;
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
        <div class="ov-item-name" style="color:#000;">
          <span class="ov-drag-handle" style="color:rgba(0,0,0,0.5)" draggable="true">⠿</span>
          ${esc(item)}
          ${tagBadgeHtml(item)}
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
        <div class="ov-item-name">
          <span class="ov-drag-handle" draggable="true">⠿</span>
          ${esc(item)}
          ${tagBadgeHtml(item)}
          <button class="ov-rename-btn" onclick="renameItem('${esc(item)}')">✎</button><button class="ov-rename-btn" style="color:var(--red)" onclick="deleteItem('${esc(item)}')">✕</button>
        </div>
        <div class="ov-status" style="color:${statusColor};border-color:${statusColor}">${statusLabel}</div>
      </div>
      <div class="ov-body-inner">
        <div style="font-size:11px;color:var(--textd);font-family:var(--mono);margin-bottom:6px">快速录入 · 自动保存并跳转</div>
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

    return `<div class="ov-card${isLocked?' locked':''}" data-item="${esc(item)}">${cardContent}</div>`;
  }).join('');

  grid.innerHTML = html + `<div class="ov-add-item" onclick="promptCreateItem()"><span style="font-size:24px">+</span><span>快速添加物品</span></div>`;

  requestAnimationFrame(() => { renderAllPriceCharts(); attachOvDragHandlers(); });
}

// ============================================================
// 拖拽排序
// ============================================================
let _ovDragItem = null;
let _ovDragStartX = 0;
let _ovDragStartY = 0;
let _ovIsTouchDrag = false;
let _ovDragGhost = null;

(function injectDragStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* 拖拽手柄悬停提示 */
    .ov-drag-handle {
      cursor: grab;
      transition: opacity 0.2s ease;
      user-select: none;
      -webkit-user-select: none;
    }
    .ov-drag-handle:hover {
      opacity: 0.8;
    }
    .ov-drag-handle:active {
      cursor: grabbing;
    }
    
    /* 卡片拖拽状态 */
    .ov-card.dragging {
      opacity: 0.4;
      transform: scale(0.95);
      transition: opacity 0.2s ease, transform 0.2s ease;
      box-shadow: 0 0 20px rgba(0,0,0,0.3);
      z-index: 1000;
    }
    
    /* 拖拽幽灵元素（跟随鼠标的副本） */
    .ov-drag-ghost {
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.85;
      transform: scale(1.02) rotate(2deg);
      transition: none;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      border: 2px solid var(--accent);
      border-radius: 12px;
      background: var(--bg2);
      padding: 12px 16px;
      font-family: var(--mono);
      font-size: 14px;
      color: var(--text);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* 目标卡片高亮 - 插入位置指示 */
    .ov-card.drag-over {
      border-color: var(--accent) !important;
      box-shadow: 0 0 0 2px var(--accent), 0 0 20px rgba(91, 156, 246, 0.15) !important;
      transform: scale(1.02);
      transition: all 0.15s ease;
    }
    
    /* 目标卡片高亮 - 插入指示线（上/下） */
    .ov-card.drag-over-before {
      border-top: 3px solid var(--accent) !important;
      border-top-color: var(--accent) !important;
    }
    .ov-card.drag-over-after {
      border-bottom: 3px solid var(--accent) !important;
      border-bottom-color: var(--accent) !important;
    }
    
    /* 卡片插入动画 */
    .ov-card.inserting {
      animation: cardInsert 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    @keyframes cardInsert {
      0% {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    /* 卡片移除动画 */
    .ov-card.removing {
      animation: cardRemove 0.25s ease forwards;
    }
    
    @keyframes cardRemove {
      0% {
        opacity: 1;
        transform: scale(1);
      }
      100% {
        opacity: 0;
        transform: scale(0.8);
      }
    }
    
    /* 网格布局平滑过渡 */
    #ov-grid {
      transition: all 0.2s ease;
    }
    
    /* 拖拽时其他卡片的位移动画 */
    .ov-card.shifting {
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  `;
  document.head.appendChild(style);
})();

function attachOvDragHandlers() {
  const grid = document.getElementById('ov-grid');
  const cards = [...grid.querySelectorAll('.ov-card')];

  cards.forEach(card => {
    const handle = card.querySelector('.ov-drag-handle');
    if (!handle) return;

    // ===== 鼠标拖拽 =====
    handle.addEventListener('dragstart', (e) => {
      _ovDragItem = card.dataset.item;
      _ovIsTouchDrag = false;
      card.classList.add('dragging');
      
      createDragGhost(card, e.clientX, e.clientY);
      
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', _ovDragItem); } catch (err) {}
      
      try {
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 1;
        dummyCanvas.height = 1;
        e.dataTransfer.setDragImage(dummyCanvas, 0, 0);
      } catch (err) {}
      
      try { if (navigator.vibrate) navigator.vibrate(5); } catch (e) {}
    }, { passive: true });

    handle.addEventListener('drag', (e) => {
      if (_ovDragGhost && e.clientX > 0 && e.clientY > 0) {
        _ovDragGhost.style.left = (e.clientX + 15) + 'px';
        _ovDragGhost.style.top = (e.clientY + 15) + 'px';
      }
    }, { passive: true });

    handle.addEventListener('dragend', () => {
      cleanupDrag();
    }, { passive: true });

    card.addEventListener('dragover', (e) => {
      if (!_ovDragItem || _ovDragItem === card.dataset.item || _ovIsTouchDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const rect = card.getBoundingClientRect();
      const yPos = (e.clientY - rect.top) / rect.height;
      
      card.classList.remove('drag-over-before', 'drag-over-after');
      if (yPos < 0.5) {
        card.classList.add('drag-over-before');
      } else {
        card.classList.add('drag-over-after');
      }
      card.classList.add('drag-over');
    }, { passive: false });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
    }, { passive: true });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
      if (_ovIsTouchDrag) return;
      
      const target = card.dataset.item;
      if (!_ovDragItem || _ovDragItem === target) {
        cleanupDrag();
        return;
      }
      
      const rect = card.getBoundingClientRect();
      const yPos = (e.clientY - rect.top) / rect.height;
      const insertAfter = yPos >= 0.5;
      
      performDragMove(_ovDragItem, target, insertAfter);
      cleanupDrag();
    }, { passive: false });

    // ===== 触屏拖拽（移动端） =====
    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;
    let touchGhost = null;
    let touchTargetCard = null;

    handle.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      _ovDragStartX = touch.clientX;
      _ovDragStartY = touch.clientY;
      _ovDragItem = card.dataset.item;
      _ovIsTouchDrag = true;
      isDragging = false;
      touchTargetCard = null;
      
      card.classList.add('dragging');
      
      try { if (navigator.vibrate) navigator.vibrate(5); } catch (e) {}
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!_ovDragItem) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      
      if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        isDragging = true;
        touchGhost = createDragGhost(card, touch.clientX, touch.clientY);
      }
      
      if (!isDragging) return;
      if (touchGhost) {
        touchGhost.style.left = (touch.clientX + 15) + 'px';
        touchGhost.style.top = (touch.clientY + 15) + 'px';
      }
      
      document.querySelectorAll('.ov-card').forEach(c => {
        c.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
      });
      
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const overCard = el && el.closest('.ov-card');
      if (overCard && overCard.dataset.item !== _ovDragItem) {
        touchTargetCard = overCard;
        const rect = overCard.getBoundingClientRect();
        const yPos = (touch.clientY - rect.top) / rect.height;
        if (yPos < 0.5) {
          overCard.classList.add('drag-over-before');
        } else {
          overCard.classList.add('drag-over-after');
        }
        overCard.classList.add('drag-over');
      }
    }, { passive: false });

    handle.addEventListener('touchend', (e) => {
      if (!_ovDragItem) {
        cleanupDrag();
        return;
      }
      
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const overCard = el && el.closest('.ov-card');
      
      document.querySelectorAll('.ov-card').forEach(c => {
        c.classList.remove('dragging', 'drag-over', 'drag-over-before', 'drag-over-after');
      });
      
      if (touchGhost) {
        touchGhost.remove();
        touchGhost = null;
      }
      
      if (isDragging && overCard && overCard.dataset.item !== _ovDragItem) {
        const rect = overCard.getBoundingClientRect();
        const yPos = (touch.clientY - rect.top) / rect.height;
        const insertAfter = yPos >= 0.5;
        performDragMove(_ovDragItem, overCard.dataset.item, insertAfter);
      }
      
      _ovDragItem = null;
      _ovIsTouchDrag = false;
      isDragging = false;
      touchTargetCard = null;
    }, { passive: true });
  });
}

function createDragGhost(card, x, y) {
  if (_ovDragGhost) {
    _ovDragGhost.remove();
    _ovDragGhost = null;
  }
  
  const itemName = card.dataset.item;
  const ghost = document.createElement('div');
  ghost.className = 'ov-drag-ghost';
  ghost.textContent = '⠿ ' + itemName;
  ghost.style.left = (x + 15) + 'px';
  ghost.style.top = (y + 15) + 'px';
  document.body.appendChild(ghost);
  _ovDragGhost = ghost;
  
  return ghost;
}

function cleanupDrag() {
  document.querySelectorAll('.ov-card').forEach(c => {
    c.classList.remove('dragging', 'drag-over', 'drag-over-before', 'drag-over-after');
  });
  if (_ovDragGhost) {
    _ovDragGhost.remove();
    _ovDragGhost = null;
  }
  _ovDragItem = null;
}

/**
 * 执行拖拽移动（带动画）- 修复版
 * @param {string} dragItem
 * @param {string} targetItem
 * @param {boolean} insertAfter
 */
function performDragMove(dragItem, targetItem, insertAfter) {
  const recs = getRecords(currentAccount);
  const items = getOrderedItems(recs);
  
  const dragIdx = items.indexOf(dragItem);
  const targetIdx = items.indexOf(targetItem);
  
  if (dragIdx === -1 || targetIdx === -1 || dragIdx === targetIdx) return;
  
  const withoutDrag = items.filter(i => i !== dragItem);
  
  const targetPos = withoutDrag.indexOf(targetItem);
  
  let insertPos;
  if (dragIdx < targetIdx) {
    insertPos = targetPos + 1;
  } else {
    insertPos = targetPos;
  }
  
  if (insertPos < 0) insertPos = 0;
  if (insertPos > withoutDrag.length) insertPos = withoutDrag.length;
  const newItems = [...withoutDrag];
  newItems.splice(insertPos, 0, dragItem);
  saveItemOrder(currentAccount, newItems);
  renderOverview();
  
  try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
}

/**
 * 根据方向移动（兼容旧接口）
 */
function moveItemByDirection(dragItem, targetItem) {
  const recs = getRecords(currentAccount);
  const items = getOrderedItems(recs);
  const dragIdx = items.indexOf(dragItem);
  const targetIdx = items.indexOf(targetItem);
  if (dragIdx === -1 || targetIdx === -1) return;
  const insertAfter = dragIdx < targetIdx;
  performDragMove(dragItem, targetItem, insertAfter);
}

/**
 * 移动到目标之前（兼容旧接口）
 */
function moveItemBefore(dragItem, targetItem) {
  performDragMove(dragItem, targetItem, false);
}

// ============================================================
// ovEnter - 按 Enter 时清空数据并跳转
// ============================================================
function ovEnter(event, item, dayIndex) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  
  const inp = document.getElementById(`ov-inp-${item}-${dayIndex}`);
  if (!inp) return;
  
  const v = inp.value.trim().replace(/[^\d.]/g, '');
  
  if (v === '') {
    const week = document.getElementById('ov-week-sel').value;
    if (week) {
      const recs = getRecords(currentAccount);
      const rec = recs.find(r => r.item === item && r.week === week);
      if (rec && rec.prices[dayIndex] !== null) {
        rec.prices[dayIndex] = null;
        saveRecords(currentAccount, recs);
        inp.classList.remove('filled');
        updateAccountView();
        renderOverview();
      }
    }
    setTimeout(function() {
      const nextId = `ov-inp-${item}-${dayIndex + 1}`;
      const next = document.getElementById(nextId);
      if (next) {
        next.focus();
        next.select();
      } else {
        const recs2 = getRecords(currentAccount);
        const items = [...new Set(recs2.map(r => r.item))];
        const idx = items.indexOf(item);
        if (idx >= 0 && idx < items.length - 1) {
          const nextItemId = `ov-inp-${items[idx + 1]}-0`;
          const nextItem = document.getElementById(nextItemId);
          if (nextItem) {
            nextItem.focus();
            nextItem.select();
          }
        }
      }
    }, 100);
    return;
  }
  
  inp.blur();
}

// ============================================================
// ovBlurSave - 失去焦点时自动保存并跳转
// ============================================================
function ovBlurSave(item, week, dayIndex) {
  if (!week) return;
  
  const inp = document.getElementById(`ov-inp-${item}-${dayIndex}`);
  if (!inp) return;
  
  const v = inp.value.trim().replace(/[^\d.]/g, '');
  
  if (v === '') {
    inp.classList.remove('filled');
    return;
  }
  
  const price = validatePrice(v);
  if (price === null) {
    inp.classList.add('err');
    return;
  }
  
  const recs = getRecords(currentAccount);
  let rec = recs.find(r => r.item === item && r.week === week);
  if (!rec) {
    rec = { item: item, week: week, prices: Array(7).fill(null) };
    recs.push(rec);
  }
  rec.prices[dayIndex] = price;
  saveRecords(currentAccount, recs);
  
  inp.classList.add('filled');
  inp.classList.remove('err');
  
  updateAccountView();
  renderOverview();
  
  setTimeout(function() {
    const nextId = `ov-inp-${item}-${dayIndex + 1}`;
    const next = document.getElementById(nextId);
    if (next) {
      next.focus();
      next.select();
    } else {
      const recs2 = getRecords(currentAccount);
      const items = [...new Set(recs2.map(r => r.item))];
      const idx = items.indexOf(item);
      if (idx >= 0 && idx < items.length - 1) {
        const nextItemId = `ov-inp-${items[idx + 1]}-0`;
        const nextItem = document.getElementById(nextItemId);
        if (nextItem) {
          nextItem.focus();
          nextItem.select();
        }
      }
    }
  }, 50);
}

// ============================================================
// ovSaveAll - 手动保存全部
// ============================================================
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

// ============================================================
// PRICE CHART RENDERER
// ============================================================
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
    const MONO_FONT = `'JetBrains Mono', monospace`;

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

    const points = prices.map((price, i) => {
      return {
        x: i * COL + COL / 2,
        y: valToY(price),
        price
      };
    });

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

    points.forEach((p, i) => {
      const isMax = i === pmaxIdx;
      const isMin = i === pminIdx;
      const pointColor = isMax ? GREEN : isMin ? RED : '#ffffff';

      ctx.beginPath();
      ctx.arc(p.x, p.y, isMax || isMin ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = pointColor;
      ctx.fill();

      if (isMax || isMin) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = pointColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = pointColor;
        ctx.fill();
        ctx.restore();
      }

      ctx.font = `9px ${MONO_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = pointColor;
      ctx.fillText(p.price.toLocaleString(), p.x, p.y - 10);
    });

    const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
    ctx.font = `9px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    prices.forEach((_, i) => {
      const cx = i * COL + COL / 2;
      const isMax = i === pmaxIdx;
      const isMin = i === pminIdx;
      ctx.fillStyle = isMax ? GREEN : isMin ? RED : 'rgba(255,255,255,0.38)';
      ctx.fillText(dayNames[i], cx, H - 3);
    });
  });
}