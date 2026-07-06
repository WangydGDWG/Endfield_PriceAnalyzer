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
// ANALYSIS
// ══════════════════════════════════════
function formatPred(val, defaultClass = '') {
  if (val < 300 || val > 5500) {
    return `<span class="${defaultClass}" style="color:var(--red)!important" title="预测数据超过范围(300-5500)，不准确">${val.toLocaleString()}</span>`;
  }
  return `<span class="${defaultClass}">${val.toLocaleString()}</span>`;
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
  const hasCurrentObs = currentWeekPrices.some(p => p != null);

  let html = '';

  if (!hasComplete) {
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
        基于 ${result.weekCount} 周跨周验证 · 上周确认模板：T${result.lockedSrcTpl.id}·${result.lockedSrcTpl.name}
      </div>
    </div>`;
  } else if (result.stage === 'pending') {
    html += `<div class="delta-banner pending">
      <span class="db-icon">⏳</span>
      <div class="db-text">
        <strong>ε 收敛中 — 剩余候选 ${result.candidateCount} 组</strong>
        已有 ${result.weekCount} 周数据，继续录入新周数据可进一步缩小候选范围。
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
    html += `<div class="panel-title">ε 向量（每人每物品固定）</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px">`;
    DAYS.forEach((d, i) => {
      const e = result.epsilonVec[i];
      const color = e == null ? 'var(--textd)' : e > 0 ? 'var(--green)' : e < 0 ? 'var(--red)' : 'var(--textb)';
      html += `<div style="text-align:center;background:var(--bg3);padding:6px 2px;border:1px solid var(--border)">
        <div style="font-size:13px;color:var(--textd);font-family:var(--mono)">${d.replace('周','')}</div>
        <div style="font-family:var(--mono);font-size:13px;color:${color};margin-top:2px">${e!=null?e.toFixed(4):'—'}</div>
      </div>`;
    });
    html += `</div>`;
    html += `<div class="rrow"><span class="rlabel">最佳匹配模板</span><span class="rval info">T${result.lockedSrcTpl.id} · ${result.lockedSrcTpl.name}（X=${result.lockedSrcTpl.coeff}）</span></div>`;
    if (result.stage === 'pending') {
      html += `<div class="rrow"><span class="rlabel">剩余候选数</span><span class="rval warn">${result.candidateCount} 组（继续录入数据收敛）</span></div>`;
    }
    html += `</div>`;
  }

  if (result.stage === 'locked' || result.stage === 'pending') {
    // pending 且有多个候选时，分组显示每个候选的 8 组预测
    const hasPendingMulti = result.stage === 'pending' && result.allCandidatesPredictions && result.allCandidatesPredictions.length > 1;

    if (hasPendingMulti) {
      // 计算每组候选中所有 8 组预测在本周实测下的幸存情况（跨候选汇总）
      const allEightByCandidate = result.allCandidatesPredictions.map(cand => ({
        srcTpl: cand.srcTpl,
        residual: cand.residual,
        eight: filterEightPredictions(cand.eight, currentWeekPrices)
      }));

      // 汇总所有候选的幸存预测数（用于顶部统计）
      const totalRemaining = allEightByCandidate.reduce((sum, cand) => {
        return sum + cand.eight.filter(p => !p.eliminated).length;
      }, 0);
      const totalPossible = allEightByCandidate.length * 8;

      html += `<div class="panel green-accent">`;
      html += `<div class="panel-title">本周全部价格可能（${result.candidateCount} 个ε候选 × 8组模板）</div>`;
      html += `<div style="font-size:13px;font-family:var(--mono);margin-bottom:12px;color:var(--textd)">
        ε 收敛中（${result.candidateCount} 组候选），以下按每个 ε 假设分别列出8种本周可能。
        ${hasCurrentObs ? `已用本周实测排除，剩余 ${totalRemaining}/${totalPossible}` : '录入本周任意一天实测后可缩小候选范围'}
        <span style="color:var(--accent)"> · 录入更多数据可收敛 ε</span>
      </div>`;

      allEightByCandidate.forEach((cand, ci) => {
        const remaining = cand.eight.filter(p => !p.eliminated);
        const accentColor = ci === 0 ? 'var(--accent)' : 'var(--teal)';
        html += `<div style="margin-bottom:18px;border:1px solid ${accentColor};border-radius:0;padding:10px 10px 6px">`;
        html += `<div style="font-family:var(--mono);font-size:13px;color:${accentColor};margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="border:1px solid ${accentColor};padding:1px 7px">候选 ${ci+1}/${result.candidateCount}</span>
          <span>ε 来自 T${cand.srcTpl.id}·${cand.srcTpl.name}（X=${cand.srcTpl.coeff}）</span>
          ${hasCurrentObs ? `<span style="margin-left:auto;color:var(--textd)">剩余 ${remaining.length}/8</span>` : ''}
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
          html += `<div class="poss-card ${statusCls}">
            <canvas class="spark" id="${sparkId}"></canvas>
            <div class="poss-card-header">
              <span class="poss-name">T${p.targetTpl.id}·${p.targetTpl.name}</span>
              <span class="poss-coeff">X=${p.targetTpl.coeff}</span>
            </div>
            <div class="poss-prices">`;
          DAYS.forEach((d, i) => {
            const isObs = currentWeekPrices[i] != null;
            const isMismatch = p.eliminated && isObs;
            const cls = isMismatch ? 'mismatch' : isObs ? 'obs' : 'predicted';
            html += `<div class="pp-cell">
              <div class="pp-day">${d.replace('周','')}</div>
              <div class="pp-val">${formatPred(p.predicted[i], cls)}</div>
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
      const eight = filterEightPredictions(result.eightPredictions, currentWeekPrices);
      const remaining = eight.filter(p => !p.eliminated);

      html += `<div class="panel green-accent">`;
      html += `<div class="panel-title">本周全部价格可能（8组）</div>`;
      html += `<div style="font-size:13px;font-family:var(--mono);margin-bottom:10px;color:var(--textd)">
        ${hasCurrentObs
          ? `已用本周实测排除，剩余候选 ${remaining.length}/8`
          : '录入本周任意一天实测后可缩小候选范围'}
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
          const isMismatch = p.eliminated && isObs;
          const cls = isMismatch ? 'mismatch' : isObs ? 'obs' : 'predicted';
          html += `<div class="pp-cell">
            <div class="pp-day">${d.replace('周','')}</div>
            <div class="pp-val">${formatPred(p.predicted[i], cls)}</div>
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
        html += `<div class="highlight-box">
          <div class="hb-title">✓ 本周模板已唯一确定：T${u.targetTpl.id} · ${u.targetTpl.name}（X=${u.targetTpl.coeff}）</div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:6px">
            ${DAYS.map((d,i)=>`<div style="text-align:center;background:var(--bg3);padding:4px 2px">
              <div style="font-size:13px;color:var(--textd)">${d.replace('周','')}</div>
              <div style="font-family:var(--mono);font-size:13px;color:var(--green);font-weight:bold">${formatPred(u.predicted[i], '')}</div>
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
  }

  if (result.stage === 'first_week') {
    html += `<div class="panel teal-accent">`;
    html += `<div class="panel-title">64组穷举预测（本周8组ε × 8个模板）</div>`;
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
            <div style="font-family:var(--mono);font-size:14px;color:var(--textb)">${formatPred(p.predicted[i], '')}</div>
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

  setTimeout(() => {
    if (result.stage === 'locked' || result.stage === 'pending') {
      const hasPendingMulti = result.stage === 'pending' && result.allCandidatesPredictions && result.allCandidatesPredictions.length > 1;
      if (hasPendingMulti) {
        result.allCandidatesPredictions.forEach((cand, ci) => {
          const eight = filterEightPredictions(cand.eight, currentWeekPrices);
          const rem = eight.filter(x => !x.eliminated);
          eight.forEach(p => {
            const color = p.eliminated ? '#2a2a2a'
              : rem.length === 1 ? '#52d68a'
              : '#e8b84b';
            drawSparkline(`ps-c${ci}-t${p.targetTpl.id}`, p.predicted, color);
          });
        });
      } else {
        const eight = filterEightPredictions(result.eightPredictions, currentWeekPrices);
        const rem = eight.filter(x => !x.eliminated);
        eight.forEach(p => {
          const color = p.eliminated ? '#2a2a2a'
            : rem.length === 1 ? '#52d68a'
            : '#e8b84b';
          drawSparkline(`ps-${p.targetTpl.id}`, p.predicted, color);
        });
      }
    }
  }, 60);
}
