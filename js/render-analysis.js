//  __      __                                        __     
// /\ \  __/\ \                                      /\ \    
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \   
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \  
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \ 
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/       
//                                    \_/__/    \_/__/         

// ══════════════════════════════════════
// ANALYSIS
// ══════════════════════════════════════

// 取某一周的拟合详情（干净 / 影子 / 未验证）
function getWeekFit(result, week) {
  if (!result || !result.weekFits || !week) return null;
  return result.weekFits[week] || null;
}

// 影子天掩码：过滤本周模板时忽略这些天（它们不能代表真实模板）
function shadowIgnoreMask(fit) {
  const mask = Array(7).fill(false);
  if (fit && Array.isArray(fit.shadowDays)) {
    fit.shadowDays.forEach(d => { mask[d.day] = true; });
  }
  return mask;
}

function pendingReasonText(result) {
  const reason = result && result.pendingReason;
  if (reason === 'conflict') {
    return '数据之间存在冲突：可能存在影子周，或某天价格录错。系统已保留最一致的解，但不会假装锁定。';
  }
  if (reason === 'ambiguous') {
    return 'ε 存在多组等价解（常见于两周使用了同一个模板）。再录入一周不同模板的数据即可唯一确定。';
  }
  if (reason === 'weak') {
    const weakDays = (result.daySupport || []).map((n, i) => n < 2 ? DAYS[i] : null).filter(Boolean);
    const tail = weakDays.length ? `（${weakDays.join('、')}仅有单周观测）` : '';
    return `ε 已基本收敛，但仍有天缺少第二周交叉验证${tail}。补录这些天的数据后可锁定。`;
  }
  return '继续录入新周数据可进一步缩小候选范围。';
}

function formatPred(val, defaultClass = '', range) {
  const r = range || DEFAULT_PRICE_RANGE;
  if (val < r.min || val > r.max) {
    return `<span class="${defaultClass}" style="color:var(--red)!important" title="预测数据超过范围(${r.min}-${r.max})，不准确">${val.toLocaleString()}</span>`;
  }
  return `<span class="${defaultClass}">${val.toLocaleString()}</span>`;
}

// 候选卡片内 7 列并排，去掉千分位避免数字互相挤压
function formatPredCompact(val, defaultClass = '', range) {
  const r = range || DEFAULT_PRICE_RANGE;
  const out = val < r.min || val > r.max;
  const title = out ? ` title="预测数据超过范围(${r.min}-${r.max})，不准确"` : '';
  const style = out ? ' style="color:var(--red)!important"' : '';
  return `<span class="${defaultClass}"${style}${title}>${val}</span>`;
}

function renderShadowPanel(result) {
  if (!result || !result.shadowWeeks || !result.shadowWeeks.length) return '';

  let html = `<div class="panel shadow-accent">`;
  html += `<div class="panel-title" style="color:var(--red)" data-en="SHADOW CORRECTION">影子数据识别与修正</div>`;
  html += `<div style="font-size:13px;font-family:var(--mono);color:var(--textd);line-height:1.7;margin-bottom:10px">
    以下周无法被共识 ε 完全解释，判定为含影子数据。影子天不参与 ε 拟合与模板过滤，
    其“修正值”是按同模板 + 共识 ε 反推的应有价格。
  </div>`;

  result.shadowWeeks.forEach(sw => {
    const tpl = sw.template;
    const days = sw.shadowDays || [];
    const lowConf = sw.status === 'partial';
    html += `<div class="shadow-week${lowConf ? ' low-conf' : ''}">
      <div class="shadow-week-head">
        <span class="shadow-week-label">${esc(sw.week)}</span>
        ${tpl ? `<span class="shadow-week-tpl">T${tpl.id} · ${tpl.name}（X=${tpl.coeff}）</span>` : ''}
        <span class="shadow-week-count">${days.length} 天影子${lowConf ? ' · 低置信' : ''}</span>
      </div>`;

    if (days.length) {
      html += `<div class="shadow-day-list">`;
      days.forEach(d => {
        const delta = d.delta != null ? d.delta : (d.corrected - d.observed);
        const sign = delta > 0 ? '+' : '';
        html += `<div class="shadow-day">
          <span class="shadow-day-name">${DAYS[d.day]}</span>
          <span class="shadow-day-orig">${d.observed.toLocaleString()}</span>
          <span class="shadow-day-arrow">→</span>
          <span class="shadow-day-fix">${d.corrected.toLocaleString()}</span>
          <span class="shadow-day-delta ${delta >= 0 ? 'up' : 'down'}">${sign}${delta.toLocaleString()}</span>
          ${d.epsKnown === false ? '<span class="shadow-day-warn" title="该天 ε 未被任何干净周观测，修正值按 ε=0 估算">ε?</span>' : ''}
        </div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="font-size:12px;color:var(--textd);font-family:var(--mono)">该周数据不足以定位具体影子天。</div>`;
    }
    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

function renderAnalysis() {
  const item = document.getElementById('sel-item').value;
  const week = document.getElementById('sel-week').value;
  const right = document.getElementById('analysis-right');
  if (!item) { right.innerHTML='<div class="empty-hint" style="margin-top:40px">请选择物品以开始分析</div>'; return; }
  const recs = getRecords(currentAccount).filter(r => r.item === item);
  if (!recs.length) { right.innerHTML='<div class="empty-hint">该物品暂无数据</div>'; return; }

  const hasComplete = hasCompleteWeek(recs, item);
  const result = analyzeItemSafe(recs);
  if (!result) { right.innerHTML='<div class="empty-hint">分析失败，请检查数据</div>'; return; }

  const focusRec = week ? recs.find(r => r.week === week) : null;
  const currentWeekPrices = focusRec ? focusRec.prices : Array(7).fill(null);
  const weekFit = getWeekFit(result, week);
  const ignoreMask = shadowIgnoreMask(weekFit);
  const filterPrices = currentWeekPrices.map((p, i) => ignoreMask[i] ? null : p);
  const hasCurrentObs = currentWeekPrices.some(p => p != null);
  const hasEffectiveObs = filterPrices.some(p => p != null);
  const priceRange = getItemPriceRange(currentAccount, item);

  let html = '';

  if (!hasComplete && result.stage !== 'locked') {
    html += `<div style="padding:12px 16px;margin-bottom:16px;border:1px solid var(--accent);background:rgba(232,184,75,.06);font-family:var(--mono);font-size:13px;color:var(--accent);display:flex;gap:10px;align-items:flex-start">
      <span style="font-size:16px;flex-shrink:0">⚠</span>
      <div><strong style="display:block;margin-bottom:2px">需要至少一周完整数据才能准确拟合</strong>
      请录入某一周全部7天的价格。完整数据录入后系统将自动重新拟合 ε 向量，预测精度将显著提升。</div>
    </div>`;
  }

  if (result.stage === 'locked') {
    html += `<div class="delta-banner locked">
      <span class="db-icon">🔒</span>
      <div class="db-text">
        <strong>ε 向量已锁定 — 可直接输出本周8组可能价格</strong>
        基于 ${result.weekCount} 周跨周验证 · 最近确认模板：T${result.lockedSrcTpl.id}·${result.lockedSrcTpl.name}
        ${result.shadowWeeks && result.shadowWeeks.length ? ` · <span style="color:var(--red)">已识别并修正 ${result.shadowWeeks.length} 周影子数据</span>` : ''}
      </div>
    </div>`;
  } else if (result.stage === 'pending') {
    html += `<div class="delta-banner pending">
      <span class="db-icon">⏳</span>
      <div class="db-text">
        <strong>ε 收敛中 — 剩余候选 ${result.candidateCount} 组</strong>
        ${pendingReasonText(result)}
      </div>
    </div>`;
  } else {
    html += `<div class="delta-banner insufficient">
      <span class="db-icon">⏳</span>
      <div class="db-text">
        <strong>ε 未锁定 — 当前输出64组穷举预测</strong>
        录入下一周实测价格后可锁定 ε。
      </div>
    </div>`;
  }

  if ((result.stage === 'locked' || result.stage === 'pending') && result.epsilonVec) {
    html += `<div class="panel">`;
    html += `<div class="panel-title" data-en="EPSILON VECTOR">ε 向量（每人每物品固定）</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px">`;
    DAYS.forEach((d, i) => {
      const e = result.epsilonVec[i];
      const support = result.daySupport ? result.daySupport[i] : 0;
      const weak = support < 2;
      const color = e == null ? 'var(--textd)' : e > 0 ? 'var(--green)' : e < 0 ? 'var(--red)' : 'var(--textb)';
      html += `<div style="text-align:center;background:var(--bg3);padding:6px 2px;border:1px solid ${weak ? 'var(--accent)' : 'var(--border)'}" title="由 ${support} 周交叉验证">
        <div style="font-size:13px;color:var(--textd);font-family:var(--mono)">${d.replace('周','')}</div>
        <div style="font-family:var(--mono);font-size:13px;color:${color};margin-top:2px">${e!=null?e.toFixed(4):'—'}</div>
        <div style="font-size:9px;color:${weak ? 'var(--accent)' : 'var(--textd)'};font-family:var(--mono);margin-top:1px">${support ? support+'周' : '待验证'}</div>
      </div>`;
    });
    html += `</div>`;
    html += `<div class="rrow"><span class="rlabel">最近确认模板</span><span class="rval info">T${result.lockedSrcTpl.id} · ${result.lockedSrcTpl.name}（X=${result.lockedSrcTpl.coeff}）</span></div>`;
    if (result.stage === 'pending') {
      html += `<div class="rrow"><span class="rlabel">剩余候选数</span><span class="rval warn">${result.candidateCount} 组（继续录入数据收敛）</span></div>`;
    }
    html += `</div>`;
  }

  html += renderShadowPanel(result);

  if (result.stage === 'locked' || result.stage === 'pending') {
    // pending 且有多个候选时，分组显示每个候选的 8 组预测
    const hasPendingMulti = result.stage === 'pending' && result.allCandidatesPredictions && result.allCandidatesPredictions.length > 1;
    const sparkSpecs = [];

    if (hasPendingMulti) {
      // 计算每组候选中所有 8 组预测在本周实测下的幸存情况（跨候选汇总）
      const allEightByCandidate = result.allCandidatesPredictions.map(cand => {
        const eight = filterEightPredictions(cand.eight, filterPrices);
        return {
          srcTpl: cand.srcTpl,
          residual: cand.residual,
          eight,
          remaining: eight.filter(p => !p.eliminated)
        };
      });

      const totalRemaining = allEightByCandidate.reduce((sum, cand) => sum + cand.remaining.length, 0);
      const totalPossible = allEightByCandidate.length * 8;

      html += `<div class="panel green-accent">`;
      html += `<div class="panel-title" data-en="PRICE CANDIDATES">本周全部价格可能（${result.candidateCount} 个ε候选 × 8组模板）</div>`;
      html += `<div style="font-size:13px;font-family:var(--mono);margin-bottom:12px;color:var(--textd)">
        ε 收敛中（${result.candidateCount} 组候选），以下按每个 ε 假设分别列出8种本周可能。
        ${hasEffectiveObs ? `已用本周实测排除，剩余 ${totalRemaining}/${totalPossible}` : '录入本周任意一天实测后可缩小候选范围'}
        ${weekFit && weekFit.shadowDays && weekFit.shadowDays.length ? '<span style="color:var(--red)"> · 影子天已忽略</span>' : ''}
        <span style="color:var(--accent)"> · 录入更多数据可收敛 ε</span>
      </div>`;

      allEightByCandidate.forEach((cand, ci) => {
        const remaining = cand.remaining;
        const accentColor = ci === 0 ? 'var(--accent)' : 'var(--teal)';
        html += `<div style="margin-bottom:18px;border:1px solid ${accentColor};border-radius:0;padding:10px 10px 6px">`;
        html += `<div style="font-family:var(--mono);font-size:13px;color:${accentColor};margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="border:1px solid ${accentColor};padding:1px 7px">候选 ${ci+1}/${result.candidateCount}</span>
          <span>ε 来自 T${cand.srcTpl.id}·${cand.srcTpl.name}（X=${cand.srcTpl.coeff}）</span>
          ${hasEffectiveObs ? `<span style="margin-left:auto;color:var(--textd)">剩余 ${remaining.length}/8</span>` : ''}
        </div>`;
        html += `<div class="poss-grid">`;
        cand.eight.forEach((p, pi) => {
          const isConfirmed = !p.eliminated && remaining.length === 1;
          const statusCls = p.eliminated ? 'eliminated' : isConfirmed ? 'confirmed' : 'candidate';
          const statusLabel = p.eliminated ? '已排除'
            : isConfirmed ? '✓ 唯一候选'
            : p.confidence != null ? `置信 ${(p.confidence*100).toFixed(0)}%` : '候选';
          const pmax = Math.max(...p.predicted), pmaxI = p.predicted.indexOf(pmax);
          const pmin = Math.min(...p.predicted), pminI = p.predicted.indexOf(pmin);
          const sparkId = `ps-c${ci}-t${p.targetTpl.id}`;
          sparkSpecs.push({ id: sparkId, vals: p.predicted, eliminated: p.eliminated, unique: remaining.length === 1 });

          html += `<div class="poss-card ${statusCls}">
            <canvas class="spark" id="${sparkId}"></canvas>
            <div class="poss-card-header">
              <span class="poss-name">T${p.targetTpl.id}·${p.targetTpl.name}</span>
              <span class="poss-coeff">X=${p.targetTpl.coeff}</span>
            </div>
            <div class="poss-prices">`;
          DAYS.forEach((d, i) => {
            const isObs = currentWeekPrices[i] != null;
            const isShadow = ignoreMask[i];
            const isMismatch = p.eliminated && isObs && !isShadow;
            const cls = isShadow ? 'shadow' : isMismatch ? 'mismatch' : isObs ? 'obs' : 'predicted';
            html += `<div class="pp-cell">
              <div class="pp-day">${d.replace('周','')}${isShadow ? '<span class="shadow-mark">影</span>' : ''}</div>
              <div class="pp-val">${formatPredCompact(p.predicted[i], cls, priceRange)}</div>
            </div>`;
          });
          html += `</div>
            <div style="font-size:14px;font-family:var(--mono);margin-top:4px;display:flex;gap:6px;justify-content:center">
              <span style="color:var(--green)">▲${DAYS[pmaxI]} ${pmax.toLocaleString()}</span>
              <span style="color:var(--red)">▼${DAYS[pminI]} ${pmin.toLocaleString()}</span>
            </div>
            <div class="poss-status">${statusLabel}</div>
          </div>`;
        });
        html += `</div>`;
        if (remaining.length === 1) {
          const u = remaining[0];
          html += `<div class="highlight-box" style="margin-top:8px">
            <div class="hb-title">✓ 此候选下本周模板唯一确定：T${u.targetTpl.id} · ${u.targetTpl.name}（X=${u.targetTpl.coeff}）</div>
          </div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;

    } else {
      // locked 或 pending 只有1个候选：原有逻辑
      const eight = filterEightPredictions(result.eightPredictions, filterPrices);
      const remaining = eight.filter(p => !p.eliminated);

      html += `<div class="panel green-accent">`;
      html += `<div class="panel-title" data-en="PRICE CANDIDATES">本周全部价格可能（8组）</div>`;
      html += `<div style="font-size:13px;font-family:var(--mono);margin-bottom:10px;color:var(--textd)">
        ${hasEffectiveObs
          ? `已用本周实测排除，剩余候选 ${remaining.length}/8`
          : '录入本周任意一天实测后可缩小候选范围'}
        ${weekFit && weekFit.shadowDays && weekFit.shadowDays.length ? '<span style="color:var(--red)"> · 影子天已忽略</span>' : ''}
        ${result.stage==='pending' ? ' · <span style="color:var(--accent)">ε 仍在收敛，预测为最优估算</span>' : ''}
      </div>`;

      html += `<div class="poss-grid">`;
      eight.forEach(p => {
        const isConfirmed = !p.eliminated && remaining.length === 1;
        const statusCls = p.eliminated ? 'eliminated' : isConfirmed ? 'confirmed' : 'candidate';
        const statusLabel = p.eliminated ? '已排除'
          : isConfirmed ? '✓ 唯一候选'
          : p.confidence != null ? `置信 ${(p.confidence*100).toFixed(0)}%` : '候选';
        const pmax = Math.max(...p.predicted), pmaxI = p.predicted.indexOf(pmax);
        const pmin = Math.min(...p.predicted), pminI = p.predicted.indexOf(pmin);

        html += `<div class="poss-card ${statusCls}">
          <canvas class="spark" id="ps-${p.targetTpl.id}"></canvas>
          <div class="poss-card-header">
            <span class="poss-name">T${p.targetTpl.id}·${p.targetTpl.name}</span>
            <span class="poss-coeff">X=${p.targetTpl.coeff}</span>
          </div>
          <div class="poss-prices">`;
        DAYS.forEach((d, i) => {
          const isObs = currentWeekPrices[i] != null;
          const isShadow = ignoreMask[i];
          const isMismatch = p.eliminated && isObs && !isShadow;
          const cls = isShadow ? 'shadow' : isMismatch ? 'mismatch' : isObs ? 'obs' : 'predicted';
          html += `<div class="pp-cell">
            <div class="pp-day">${d.replace('周','')}${isShadow ? '<span class="shadow-mark">影</span>' : ''}</div>
            <div class="pp-val">${formatPredCompact(p.predicted[i], cls, priceRange)}</div>
          </div>`;
        });
        html += `</div>
          <div style="font-size:14px;font-family:var(--mono);margin-top:4px;display:flex;gap:6px;justify-content:center">
            <span style="color:var(--green)">▲${DAYS[pmaxI]} ${pmax.toLocaleString()}</span>
            <span style="color:var(--red)">▼${DAYS[pminI]} ${pmin.toLocaleString()}</span>
          </div>
          <div class="poss-status">${statusLabel}</div>
        </div>`;
        sparkSpecs.push({ id: `ps-${p.targetTpl.id}`, vals: p.predicted, eliminated: p.eliminated, unique: remaining.length === 1 });
      });
      html += `</div>`;

      if (remaining.length === 1) {
        const u = remaining[0];
        html += `<div class="highlight-box">
          <div class="hb-title">✓ 本周模板已唯一确定：T${u.targetTpl.id} · ${u.targetTpl.name}（X=${u.targetTpl.coeff}）</div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:6px">
            ${DAYS.map((d,i)=>`<div style="text-align:center;background:var(--bg3);padding:4px 2px">
              <div style="font-size:13px;color:var(--textd)">${d.replace('周','')}</div>
              <div style="font-family:var(--mono);font-size:13px;color:${ignoreMask[i] ? 'var(--red)' : 'var(--green)'};font-weight:bold">${formatPred(u.predicted[i], '', priceRange)}</div>
            </div>`).join('')}
          </div>
        </div>`;
      } else if (hasCurrentObs && remaining.length === 0) {
        html += `<div style="color:var(--red);font-family:var(--mono);font-size:13px;margin-top:8px">
          ⚠ 所有模板均被排除 — 可能存在影子数据，已保留最优匹配作为参考。
        </div>`;
      }
      html += `</div>`;
    }

    // 延迟绘制 sparkline（DOM 插入后才能拿到 canvas 宽度）
    setTimeout(() => {
      sparkSpecs.forEach(s => {
        const color = s.eliminated ? '#2a2a2a'
          : s.unique ? '#52d68a'
          : '#e8b84b';
        drawSparkline(s.id, s.vals, color);
      });
    }, 60);
  }

  if (result.stage === 'first_week') {
    html += `<div class="panel teal-accent">`;
    html += `<div class="panel-title" data-en="ENUMERATION">64组穷举预测（本周8组ε × 8个模板）</div>`;
    html += `<div style="font-size:13px;color:var(--textd);font-family:var(--mono);margin-bottom:12px">
      下周实际价格必然符合以下某一组。录入下周数据后可锁定 ε。
    </div>`;
    TEMPLATES.forEach(srcTpl => {
      const group = result.predictions.filter(p => p.srcTpl.id === srcTpl.id);
      html += `<div style="margin-bottom:16px">`;
      html += `<div style="font-family:var(--mono);font-size:14px;color:var(--accent);margin-bottom:6px;letter-spacing:1px">
        本周若为 T${srcTpl.id}·${srcTpl.name}（X=${srcTpl.coeff}）→ 下周8种预测：
      </div>`;
      html += `<div class="first-week-group-grid">`;
      group.forEach(p => {
        const pmax=Math.max(...p.predicted),pmaxI=p.predicted.indexOf(pmax);
        const pmin=Math.min(...p.predicted),pminI=p.predicted.indexOf(pmin);
        html += `<div style="background:var(--bg3);border:1px solid var(--border);padding:8px">
          <div style="font-family:var(--mono);font-size:14px;color:var(--teal);margin-bottom:4px">→T${p.targetTpl.id}·${p.targetTpl.name}</div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">`;
        DAYS.forEach((d,i) => {
          html += `<div style="text-align:center">
            <div style="font-size:10px;color:var(--textd);font-family:var(--mono)">${d.replace('周','')}</div>
            <div style="font-family:var(--mono);font-size:14px;color:var(--textb)">${formatPredCompact(p.predicted[i], '', priceRange)}</div>
          </div>`;
        });
        html += `</div>
          <div style="font-size:13px;font-family:var(--mono);margin-top:3px;display:flex;gap:4px">
            <span style="color:var(--green)">▲${DAYS[pmaxI]} ${pmax.toLocaleString()}</span>
            <span style="color:var(--red)">▼${DAYS[pminI]} ${pmin.toLocaleString()}</span>
          </div>
        </div>`;
      });
      html += `</div></div>`;
    });
    html += `</div>`;
  }

  right.innerHTML = html;
}
