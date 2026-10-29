//  __      __                                        __     
// /\ \  __/\ \                                      /\ \    
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \   
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \  
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \ 
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/       
//                                    \_/__/    \/__/         

//数据和图像渲染相关的核心代码，能跑就别乱动！！！！

// ══════════════════════════════════════
// DATA TAB DYNAMIC DETAILS
// ══════════════════════════════════════
function renderDataTabDetails() {
  const selItem = document.getElementById('data-sel-item').value;
  const selWeek = document.getElementById('data-sel-week').value;
  const container = document.getElementById('data-dynamic-details');

  if (!selItem) {
    container.innerHTML = '<div class="empty-hint" style="margin-bottom:16px">请在筛选器选择物品以查看详细数据</div>';
    return;
  }

  const recs = getRecords(currentAccount);
  const itemRecs = recs.filter(r => r.item === selItem);
  
  if (!itemRecs.length) {
    container.innerHTML = '<div class="empty-hint" style="margin-bottom:16px">该物品暂无数据</div>';
    return;
  }

  const result = analyzeItemSafe(itemRecs, currentAccount, selItem);
  const hasComplete = hasCompleteWeek(recs, selItem);
  const focusRec = selWeek ? itemRecs.find(r => r.week === selWeek) : null;
  const currentWeekPrices = focusRec ? focusRec.prices : Array(7).fill(null);
  const weekFit = getWeekFit(result, selWeek);
  const ignoreMask = shadowIgnoreMask(weekFit);
  const filterPrices = currentWeekPrices.map((p, i) => ignoreMask[i] ? null : p);
  const shadowDays = weekFit && Array.isArray(weekFit.shadowDays) ? weekFit.shadowDays : [];
  const priceRange = getItemPriceRange(currentAccount, selItem);

  let html = '';

  html += `<div class="detail-section" style="margin-bottom:20px">
    <div class="detail-section-title" data-en="FIT STATUS">ε 向量与拟合状态</div>`;
    
  html += `<div style="margin-bottom:16px">
    <div style="font-family:var(--disp);font-size:15px;font-weight:600;color:var(--textb);letter-spacing:1px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      ${esc(selItem)}
      <span style="font-size:14px;font-family:var(--mono);border:1px solid;padding:1px 8px;${result&&result.isFrozen?'color:var(--green);border-color:var(--green)':result&&result.stage==='locked'?'color:var(--green);border-color:var(--green)':result&&result.stage==='pending'?'color:var(--accent);border-color:var(--accent)':'color:var(--textd);border-color:var(--textd)'}">
        ${result&&result.isFrozen?'ε FROZEN':result&&result.stage==='locked'?'ε LOCKED':result&&result.stage==='pending'?'ε PENDING':'ε UNKNOWN'}
      </span>
      ${!hasComplete?'<span style="font-size:14px;font-family:var(--mono);color:var(--textd);border:1px solid var(--textd);padding:1px 8px">无完整周</span>':''}
    </div>`;

  if (result && (result.stage === 'locked' || result.stage === 'pending') && result.epsilonVec) {
    html += `<div style="overflow-x:auto;margin-bottom:10px"><table class="eps-table">
      <thead><tr><th>天</th>${DAYS.map(d=>`<th>${d.replace('周','')}</th>`).join('')}</tr></thead>
      <tbody>
        <tr>
          <td>ε<sub>i</sub></td>
          ${result.epsilonVec.map(e => {
            if (e == null) return `<td class="null-val">—</td>`;
            const cls = e > 0.001 ? 'pos' : e < -0.001 ? 'neg' : 'zero';
            return `<td class="${cls}">${e.toFixed(5)}</td>`;
          }).join('')}
        </tr>
      </tbody>
    </table></div>`;

    html += `<div style="font-size:13px;font-family:var(--mono);color:var(--textd);margin-bottom:6px">
      最佳拟合模板：<span style="color:var(--teal)">T${result.lockedSrcTpl.id}·${result.lockedSrcTpl.name}</span>
      &nbsp;X=${result.lockedSrcTpl.coeff}
      &nbsp;·&nbsp;基于 ${result.weekCount} 周数据
      &nbsp;·&nbsp;一致周 ${result.convergenceRounds||0}
      ${result.stage==='pending'?`&nbsp;·&nbsp;<span style="color:var(--accent)">候选 ${result.candidateCount} 组</span>`:''}
    </div>`;

    // 历史周数据折线图（向量未锁定时不显示）
    if (result.stage === 'locked' || result.stage === 'pending') {
      html += `<div class="price-chart-wrap" style="margin-bottom:16px;">
        <canvas id="data-history-chart" style="display:block; width:100%; height:150px;"></canvas>
      </div>`;
    }

  } else {
    html += `<div style="font-size:13px;color:var(--textd);font-family:var(--mono);padding:10px 0">
      ${!hasComplete ? '需要至少2天数据才能参与收敛。' : 'ε 尚未收敛，请录入更多周数据。'}
    </div>`;
    html += `<div style="overflow-x:auto"><table class="eps-table">
      <thead><tr><th style="min-width:110px">周次</th>${DAYS.map(d=>`<th>${d.replace('周','')}</th>`).join('')}<th>天数</th></tr></thead>
      <tbody>`;
    itemRecs.forEach((rec, idx) => {
      const nonNull = rec.prices.filter(p => p != null).length;
      const complete = nonNull === 7;
      const isLast = idx === itemRecs.length - 1;
      html += `<tr>
        <td style="font-size:13px;white-space:nowrap">
          <div style="font-family:var(--mono);color:var(--textb);margin-bottom:3px">${esc(rec.week)}</div>
        </td>
        ${rec.prices.map(p => p!=null ? `<td style="color:var(--teal)">${p.toLocaleString()}</td>` : `<td class="null-val">—</td>`).join('')}
        <td>${complete?'<span style="color:var(--green)">✓7</span>':`<span style="color:var(--textd)">${nonNull}/7</span>`}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }
  html += `</div></div>`;

  // ══════════════════════════════════════
  // 影子数据修正明细
  // ══════════════════════════════════════
  if (result && result.shadowWeeks && result.shadowWeeks.length) {
    html += `<div class="detail-section" style="margin-bottom:24px">
      <div class="detail-section-title" style="color:var(--red)" data-en="SHADOW CORRECTION">影子数据修正明细</div>
      <div style="font-size:13px;font-family:var(--mono);color:var(--textd);line-height:1.8;margin-bottom:14px;padding:8px 12px;background:var(--bg3);border-left:2px solid var(--red)">
        影子天不参与 ε 拟合与模板过滤；“修正值” = 同模板格点 × (1 + X × 共识 ε)。
        原始记录不会被改写，修正仅用于分析与预测。
      </div>`;
    result.shadowWeeks.forEach(sw => {
      const isSel = sw.week === selWeek;
      html += `<div class="shadow-week${sw.status === 'partial' ? ' low-conf' : ''}" style="${isSel ? 'outline:1px solid var(--accent);' : ''}">
        <div class="shadow-week-head">
          <span class="shadow-week-label">${esc(sw.week)}</span>
          ${sw.template ? `<span class="shadow-week-tpl">T${sw.template.id} · ${sw.template.name}（X=${sw.template.coeff}）</span>` : ''}
          <span class="shadow-week-count">${sw.shadowDays.length} 天影子${sw.status === 'partial' ? ' · 低置信' : ''}</span>
        </div>`;
      if (sw.shadowDays.length) {
        html += `<div class="shadow-day-list">`;
        sw.shadowDays.forEach(d => {
          const sign = d.delta > 0 ? '+' : '';
          html += `<div class="shadow-day">
            <span class="shadow-day-name">${DAYS[d.day]}</span>
            <span class="shadow-day-orig">${d.observed.toLocaleString()}</span>
            <span class="shadow-day-arrow">→</span>
            <span class="shadow-day-fix">${d.corrected.toLocaleString()}</span>
            <span class="shadow-day-delta ${d.delta >= 0 ? 'up' : 'down'}">${sign}${d.delta.toLocaleString()}</span>
            ${d.epsKnown === false ? '<span class="shadow-day-warn" title="该天 ε 未被任何干净周观测，修正值按 ε=0 估算">ε?</span>' : ''}
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  }

  // 仅在 ε 已锁定或收敛中时显示候选解
  if (result && (result.stage === 'locked' || result.stage === 'pending')) {
    html += `<div class="detail-section" style="margin-bottom:24px">
      <div class="detail-section-title" data-en="CANDIDATES">本周拟合候选解 ${selWeek ? `<span style="font-weight:400;color:var(--textd);font-size:13px">· ${esc(selWeek)}</span>` : ''}</div>`;

    const eight = filterEightPredictions(result.eightPredictions, filterPrices);
    const remaining = eight.filter(p => !p.eliminated);
    html += `<div style="font-size:13px;font-family:var(--mono);color:var(--textd);margin-bottom:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:8px 12px;background:var(--bg3);border-left:2px solid var(--teal)">
      <span>ε = [${result.epsilonVec.map(e=>e!=null?e.toFixed(4):'—').join(', ')}]</span>
      <span style="color:${remaining.length===1?'var(--green)':remaining.length===0?'var(--red)':'var(--accent)'}">候选 ${remaining.length} / 8</span>
      ${result.stage==='pending'?'<span style="color:var(--accent)">· ε 收敛中</span>':''}
      ${shadowDays.length?`<span style="color:var(--red)">· 已忽略 ${shadowDays.length} 个影子天</span>`:''}
      ${result.isFrozen?'<span style="color:var(--green)">· ε 已冻结</span>':''}
    </div>
    <div class="detail-fn-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">`;

    eight.forEach((p, idx) => {
      const isElim = p.eliminated;
      const isConfirmed = !isElim && remaining.length === 1;
      const pmax=Math.max(...p.predicted), pmaxI=p.predicted.indexOf(pmax);
      const pmin=Math.min(...p.predicted), pminI=p.predicted.indexOf(pmin);
      const residualPct = p.residual != null ? (Math.sqrt(p.residual)*100).toFixed(3)+'%' : '—';
      const accentColor = isElim ? 'var(--textd)' : isConfirmed ? 'var(--green)' : 'var(--teal)';
      const statusLabel = isElim ? '已排除' : isConfirmed ? '✓ 唯一候选' : '候选';

      html += `<div style="border:1px solid ${isElim?'var(--border)':isConfirmed?'var(--green)':'var(--teal)'};background:var(--bg2);opacity:${isElim?'0.45':'1'};display:flex;flex-direction:column">
        <div style="padding:8px 12px;background:${isConfirmed?'rgba(82,214,138,0.08)':isElim?'transparent':'rgba(91,207,250,0.05)'};border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-family:var(--mono);font-size:14px;color:${accentColor};font-weight:bold">T${p.targetTpl.id} · ${p.targetTpl.name}</span>
          <span style="font-family:var(--mono);font-size:12px;color:var(--textd)">X=${p.targetTpl.coeff}</span>
          <span style="margin-left:auto;font-family:var(--mono);font-size:11px;padding:1px 7px;border:1px solid ${accentColor};color:${accentColor}">${statusLabel}</span>
        </div>
        <div style="padding:10px 12px;flex:1">
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:8px">
            ${DAYS.map((d,i)=>{
              const obs = currentWeekPrices[i];
              const pred = p.predicted[i];
              const isObs = obs != null;
              const isShadow = ignoreMask[i];
              const mismatch = isElim && isObs && !isShadow && Math.abs(pred-obs)/obs >= 0.003;
              const valColor = isShadow ? 'var(--red)' : mismatch ? 'var(--red)' : isObs ? 'var(--teal)' : i===pmaxI ? 'var(--green)' : i===pminI ? 'var(--red)' : 'var(--textb)';
              return `<div style="text-align:center;background:var(--bg3);padding:4px 2px">
                <div style="font-size:10px;color:var(--textd);font-family:var(--mono)">${d.replace('周','')}${isShadow?'<span class="shadow-mark">影</span>':''}</div>
                <div style="font-family:var(--mono);font-size:13px;color:${valColor};font-weight:${isConfirmed||isObs?'bold':'normal'}">${isObs?obs.toLocaleString():formatPredCompact(pred,'',priceRange)}</div>
                ${isObs?`<div style="font-size:9px;color:var(--textd)">${isShadow?'(影)':'(实)'}</div>`:`<div style="font-size:9px;color:var(--textd)">(预)</div>`}
              </div>`;
            }).join('')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:var(--mono);font-size:12px">
            <div style="color:var(--green)">▲ ${DAYS[pmaxI].replace('周','')} ${pmax.toLocaleString()}</div>
            <div style="color:var(--red)">▼ ${DAYS[pminI].replace('周','')} ${pmin.toLocaleString()}</div>
            <div style="color:var(--textd);text-align:right">RMSE ${residualPct}</div>
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
    html += `</div>`;
  }
  container.innerHTML = html;

  // 绘制历史折线图（如果存在canvas）
  if (result && (result.stage === 'locked' || result.stage === 'pending') && result.eightPredictions) {
    const eightPreds = result.eightPredictions;
    const selWeekPrices = filterPrices;
    setTimeout(() => {
      drawDataHistoryChart('data-history-chart', itemRecs, eightPreds, selWeek, selWeekPrices, shadowDays);
    }, 80);
  }
}

function drawDataHistoryChart(canvasId, allRecs, eightPredictions, selectedWeek, selectedWeekPrices, shadowDays) {

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // ===== Hover状态 =====
  if (typeof drawDataHistoryChart.hoverLineIndex === 'undefined') {
    drawDataHistoryChart.hoverLineIndex = -1;
  }

  if (typeof drawDataHistoryChart.hoverPoint === 'undefined') {
    drawDataHistoryChart.hoverPoint = null;
  }

  const hoverLineIndex = drawDataHistoryChart.hoverLineIndex;
  const hoverPoint = drawDataHistoryChart.hoverPoint;

  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.parentElement.getBoundingClientRect();

  const W = rect.width || canvas.offsetWidth || 600;

  const MARGIN = {
    top: 24,
    right: 52,
    bottom: 56,
    left: 46
  };

  const H = 260;

  const PLOT_W = W - MARGIN.left - MARGIN.right;
  const PLOT_H = H - MARGIN.top - MARGIN.bottom;

  canvas.width = W * dpr;
  canvas.height = H * dpr;

  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');

  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  // ===== Y轴范围 =====

  const Y_MIN = 300;
  const Y_MAX = 5500;

  function valToY(v) {
    return MARGIN.top + PLOT_H - (
      (v - Y_MIN) / (Y_MAX - Y_MIN)
    ) * PLOT_H;
  }

  function dayToX(i) {
    return MARGIN.left + (i / 6) * PLOT_W;
  }

  const cs = getComputedStyle(document.documentElement);

  const MONO_FONT = `'JetBrains Mono', monospace`;

  const GREEN = (
    cs.getPropertyValue('--green') || '#52d68a'
  ).trim();

  const RED = (
    cs.getPropertyValue('--red') || '#e05c6a'
  ).trim();

  // ===== 辅助线 =====

  const GUIDES = [
    {
      val: 4500,
      color: 'rgba(232,140,60,0.70)',
      labelColor: 'rgba(232,140,60,0.85)',
      dash: [4,3]
    },
    {
      val: 2000,
      color: 'rgba(255,255,255,0.50)',
      labelColor: 'rgba(255,255,255,0.55)',
      dash: [5,3]
    },
    {
      val: 1000,
      color: 'rgba(91,156,246,0.70)',
      labelColor: 'rgba(91,156,246,0.85)',
      dash: [4,3]
    }
  ];

  GUIDES.forEach(g => {

    const y = valToY(g.val);

    ctx.save();

    ctx.setLineDash(g.dash);

    ctx.strokeStyle = g.color;
    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(MARGIN.left + PLOT_W, y);

    ctx.stroke();

    ctx.setLineDash([]);

    ctx.font = `8px ${MONO_FONT}`;
    ctx.fillStyle = g.labelColor;

    ctx.textAlign = 'left';

    ctx.fillText(
      g.val.toString(),
      MARGIN.left + PLOT_W + 4,
      y + 3
    );

    ctx.restore();
  });

  // ===== 网格 =====

  [1000,2000,3000,4000,5000].forEach(v => {

    if ([1000,2000,4500].includes(v)) return;

    const y = valToY(v);

    ctx.save();

    ctx.setLineDash([2,5]);

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(MARGIN.left + PLOT_W, y);

    ctx.stroke();

    ctx.restore();
  });

  // ===== X轴分隔 =====

  for (let i = 0; i < 7; i++) {

    const x = dayToX(i);

    ctx.save();

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;

    ctx.setLineDash([2,4]);

    ctx.beginPath();

    ctx.moveTo(x, MARGIN.top);
    ctx.lineTo(x, MARGIN.top + PLOT_H);

    ctx.stroke();

    ctx.restore();
  }

  // ===== 颜色 =====

  const PRED_COLORS = [
    '#5b9cf6',
    '#e88c3c',
    '#3dd9b3',
    '#e8b84b',
    '#e05c6a',
    '#52d68a',
    '#c084fc',
    '#fb923c',
  ];

  const hasSelectedWeek = !!selectedWeek;

  const renderPredictions = hasSelectedWeek
    ? filterEightPredictions(
        eightPredictions,
        selectedWeekPrices || Array(7).fill(null)
      )
    : eightPredictions;

  // ===== 预测线 =====

  renderPredictions.forEach((pred, idx) => {

    const pts = pred.predicted;

    const color =
      PRED_COLORS[idx % PRED_COLORS.length];

    const isElim = !!pred.eliminated;

    ctx.save();

    // ===== Hover效果 =====

    const shouldHighlightPrediction =
      hasSelectedWeek && !isElim;

    if (hoverLineIndex === -1) {

      // 筛选后高亮非淘汰模板
      if (shouldHighlightPrediction) {

        ctx.globalAlpha = 0.95;

      } else {

        ctx.globalAlpha =
          isElim ? 0.10 : 0.22;
      }

    } else {

      ctx.globalAlpha =
        hoverLineIndex === idx
          ? (isElim ? 0.35 : 1)
          : 0.05;
    }

    ctx.strokeStyle = color;

    ctx.lineWidth =
      hoverLineIndex === idx
        ? 4
        : (isElim ? 1.2 : 2);

    ctx.lineJoin = 'round';

    if (isElim) {
      ctx.setLineDash([4,4]);
    }

    // ===== 折线 =====

    ctx.beginPath();

    for (let i = 0; i < 7; i++) {

      const x = dayToX(i);
      const y = valToY(pts[i]);

      i === 0
        ? ctx.moveTo(x, y)
        : ctx.lineTo(x, y);
    }

    ctx.stroke();

    ctx.setLineDash([]);

    // ===== 节点 =====

    pts.forEach((v, i) => {

      const x = dayToX(i);
      const y = valToY(v);

      const shouldShowPredictionDetails =
        hasSelectedWeek && !isElim;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        hoverLineIndex === idx
          ? 5
          : (isElim ? 2 : 3.5),
        0,
        Math.PI * 2
      );

      ctx.fillStyle = color;

      ctx.fill();

      // 白描边
      if (shouldShowPredictionDetails || hoverLineIndex === idx) {

        ctx.strokeStyle = '#fff';

        ctx.lineWidth =
          hoverLineIndex === idx
            ? 1.5
            : 1;

        ctx.stroke();
      }

      // 数值标注
      if (shouldShowPredictionDetails || hoverLineIndex === idx) {

        const labelY =
          y > MARGIN.top + 18
            ? y - 10
            : y + 16;

        ctx.font =
          hoverLineIndex === idx
            ? `bold 12px ${MONO_FONT}`
            : `10px ${MONO_FONT}`;

        ctx.fillStyle = color;

        ctx.textAlign = 'center';

        ctx.fillText(
          Math.round(v).toLocaleString(),
          x,
          labelY
        );
      }
    });

    // ===== T编号 =====

    if (!isElim) {

      const ex = dayToX(6);
      const ey = valToY(pts[6]);

      ctx.font = `bold 9px ${MONO_FONT}`;

      ctx.fillStyle = color;

      ctx.textAlign = 'left';

      ctx.fillText(
        `T${pred.targetTpl ? pred.targetTpl.id : idx+1}`,
        ex + 6,
        ey + 3
      );
    }

    ctx.restore();
  });

  // ===== 实测值 =====

  if (hasSelectedWeek) {

    const selRec = allRecs.find(
      r => r.week === selectedWeek
    );

    if (selRec) {

      const shadowSet = new Set(
        Array.isArray(shadowDays)
          ? shadowDays.map(d => (typeof d === 'number' ? d : d.day))
          : []
      );

      const pts = selRec.prices.map((p, i) =>
        p != null
          ? {
              x: dayToX(i),
              y: valToY(p),
              v: p,
              shadow: shadowSet.has(i)
            }
          : null
      );

      const connected = pts.filter(Boolean);

      if (connected.length >= 2) {

        ctx.save();

        // 先画一条贯穿实测点的虚线，提示“原始记录”的连续性
        ctx.strokeStyle = 'rgba(255,255,255,0.20)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        let first = true;
        connected.forEach(pt => {
          first ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
          first = false;
        });
        ctx.stroke();
        ctx.restore();

        // 干净天：原有绿色实线
        const cleanPts = connected.filter(pt => !pt.shadow);
        if (cleanPts.length >= 2) {
          ctx.save();
          ctx.strokeStyle = GREEN;
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.shadowColor = GREEN;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          cleanPts.forEach((pt, idx) => {
            idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
          ctx.restore();
        }
      }

      pts.forEach(pt => {

        if (!pt) return;

        const color = pt.shadow ? RED : GREEN;

        ctx.save();

        ctx.beginPath();

        if (pt.shadow) {
          // 影子天画成菱形，提醒“这不是真实格点”
          const r = 5;
          ctx.moveTo(pt.x, pt.y - r);
          ctx.lineTo(pt.x + r, pt.y);
          ctx.lineTo(pt.x, pt.y + r);
          ctx.lineTo(pt.x - r, pt.y);
          ctx.closePath();
        } else {
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        }

        ctx.fillStyle = color;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.6;

        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        const labelY =
          pt.y > MARGIN.top + 18
            ? pt.y - 12
            : pt.y + 16;

        ctx.font = `bold 9px ${MONO_FONT}`;

        ctx.fillStyle = color;

        ctx.textAlign = 'center';

        ctx.fillText(
          (pt.shadow ? '影 ' : '') + pt.v.toLocaleString(),
          pt.x,
          labelY
        );

        ctx.restore();
      });
    }
  }

  // ===== 历史周 =====

  allRecs.forEach(rec => {

    if (rec.week === selectedWeek) return;

    const pts = rec.prices
      .map((p, i) =>
        p != null
          ? {
              x: dayToX(i),
              y: valToY(p)
            }
          : null
      )
      .filter(Boolean);

    if (pts.length < 1) return;

    ctx.save();

    ctx.globalAlpha = 0.12;

    if (pts.length >= 2) {

      ctx.strokeStyle = '#ffffff';

      ctx.lineWidth = 1;

      ctx.beginPath();

      let first = true;

      rec.prices.forEach((p, i) => {

        if (!p) return;

        const x = dayToX(i);
        const y = valToY(p);

        first
          ? ctx.moveTo(x, y)
          : ctx.lineTo(x, y);

        first = false;
      });

      ctx.stroke();
    }

    pts.forEach(pt => {

      ctx.beginPath();

      ctx.arc(
        pt.x,
        pt.y,
        2,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = 'rgba(255,255,255,0.55)';

      ctx.fill();
    });

    ctx.restore();
  });

  // ===== 星期 =====

  const dayNames = ['一','二','三','四','五','六','日'];

  for (let i = 0; i < 7; i++) {

    const x = dayToX(i);

    ctx.save();

    ctx.font = `11px ${MONO_FONT}`;

    ctx.fillStyle = 'rgba(255,255,255,0.50)';

    ctx.textAlign = 'center';

    ctx.fillText(
      dayNames[i],
      x,
      H - 8
    );

    ctx.restore();
  }

  // ===== 图例 =====

  const LEGEND_Y = H - 34;

  const legendItems = eightPredictions.map((pred, idx) => ({
    color: PRED_COLORS[idx % PRED_COLORS.length],
    label: `T${pred.targetTpl ? pred.targetTpl.id : idx+1}`,
  }));

  ctx.save();

  ctx.fillStyle = 'rgba(8,10,14,0.72)';

  ctx.fillRect(
    MARGIN.left,
    LEGEND_Y - 12,
    PLOT_W,
    28
  );

  ctx.restore();

  const itemW = PLOT_W / legendItems.length;

  legendItems.forEach((item, idx) => {

    const lx =
      MARGIN.left + idx * itemW + 8;

    const ly = LEGEND_Y + 5;

    ctx.save();

    ctx.fillStyle = item.color;

    ctx.fillRect(
      lx,
      ly - 8,
      16,
      5
    );

    ctx.font = `bold 10px ${MONO_FONT}`;

    ctx.fillStyle = item.color;

    ctx.textAlign = 'left';

    ctx.fillText(
      item.label,
      lx + 22,
      ly
    );

    ctx.restore();
  });

  // ===== Tooltip =====

  if (hoverPoint) {

    const {
      tpl,
      value,
      day,
      x,
      y,
      color
    } = hoverPoint;

    const dayNames = [
      '周一',
      '周二',
      '周三',
      '周四',
      '周五',
      '周六',
      '周日'
    ];

    const lines = [
      `T${tpl ? tpl.id : '?'}`,
      tpl ? tpl.name : '',
      dayNames[day],
      `${Math.round(value).toLocaleString()}`
    ];

    ctx.save();

    ctx.font = `bold 10px ${MONO_FONT}`;

    const width =
      Math.max(
        ...lines.map(
          t => ctx.measureText(t).width
        )
      ) + 20;

    const height = 68;

    let tx = x + 14;
    let ty = y - 18;

    if (tx + width > W - 8) {
      tx = x - width - 14;
    }

    if (ty < 8) {
      ty = 8;
    }

    ctx.fillStyle = 'rgba(8,10,14,0.94)';

    ctx.strokeStyle = color;

    ctx.lineWidth = 1.5;

    ctx.beginPath();

    ctx.roundRect(
      tx,
      ty,
      width,
      height,
      8
    );

    ctx.fill();
    ctx.stroke();

    lines.forEach((t, i) => {

      ctx.fillStyle =
        i === 3
          ? color
          : 'rgba(255,255,255,0.92)';

      ctx.fillText(
        t,
        tx + 10,
        ty + 16 + i * 14
      );
    });

    ctx.restore();
  }

  // ===== Hover检测 =====

  canvas.onmousemove = e => {

    const rect =
      canvas.getBoundingClientRect();

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found = -1;
    let foundPoint = null;

    let bestDist = 9999;

    renderPredictions.forEach((pred, idx) => {

      pred.predicted.forEach((v, i) => {

        const x = dayToX(i);
        const y = valToY(v);

        const d =
          Math.hypot(mx - x, my - y);

        if (d < bestDist && d < 18) {

          bestDist = d;

          found = idx;

          foundPoint = {
            tpl: pred.targetTpl,
            value: v,
            day: i,
            x,
            y,
            color: PRED_COLORS[
              idx % PRED_COLORS.length
            ]
          };
        }
      });
    });

    if (
      found !== drawDataHistoryChart.hoverLineIndex
    ) {

      drawDataHistoryChart.hoverLineIndex = found;

      drawDataHistoryChart.hoverPoint = foundPoint;

      drawDataHistoryChart(
        canvasId,
        allRecs,
        eightPredictions,
        selectedWeek,
        selectedWeekPrices,
        shadowDays
      );
    }
  };

  canvas.onmouseleave = () => {

    drawDataHistoryChart.hoverLineIndex = -1;

    drawDataHistoryChart.hoverPoint = null;

    drawDataHistoryChart(
      canvasId,
      allRecs,
      eightPredictions,
      selectedWeek,
      selectedWeekPrices,
      shadowDays
    );
  };
}

// ══════════════════════════════════════
// SPARKLINE
// ══════════════════════════════════════
function drawSparkline(id, vals, color='#e8b84b') {
  const c = document.getElementById(id); if (!c) return;
  const w = c.offsetWidth||120, h = 28;
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const mn=Math.min(...vals), mx=Math.max(...vals), range=mx-mn||1;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.lineJoin='round';
  ctx.beginPath();
  vals.forEach((v,i) => {
    const x=(i/(vals.length-1))*(w-4)+2;
    const y=h-2-((v-mn)/range)*(h-4);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();
  ctx.fillStyle=color;
  vals.forEach((v,i) => {
    const x=(i/(vals.length-1))*(w-4)+2;
    const y=h-2-((v-mn)/range)*(h-4);
    ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill();
  });
}
