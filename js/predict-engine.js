//  __      __                                        __     
// /\ \  __/\ \                                      /\ \    
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \   
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \  
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \ 
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/       
//                                    \_/__/    \/__/         

//核心代码！！！能跑就别乱动！！！！！

// ══════════════════════════════════════
// ALGORITHM
// ══════════════════════════════════════

// ε_i = (P_i / T^(n)_i - 1) / X^(n)
function computeEpsilonVec(weekPrices, tpl) {
  return weekPrices.map((p, i) =>
    p != null ? (p / tpl.grid[i] - 1) / tpl.coeff : null
  );
}

// P_i = T^(n)_i × (1 + X^(n) × ε_i)
// fallbackEpsilonVec: 当本周 ε_i 为 null（未观测天）时使用历史锁定 ε 补位
function predict(epsilonVec, targetTpl, fallbackEpsilonVec) {
  return targetTpl.grid.map((g, i) => {
    let e = epsilonVec[i];
    if (e == null && fallbackEpsilonVec) e = fallbackEpsilonVec[i];
    if (e == null) e = 0;
    // 加这一行：ε 超出合理范围时截断，防止单天噪声放大
    e = Math.max(-0.5, Math.min(0.5, e));
    return Math.round(g * (1 + targetTpl.coeff * e));
  });
}

function matchResidual(predicted, weekPrices) {
  let sum = 0, count = 0;
  weekPrices.forEach((p, i) => {
    if (p != null) {
      const diff = (predicted[i] - p) / p;
      sum += diff * diff;
      count++;
    }
  });
  return count > 0 ? sum / count : Infinity;
}

function enumEpsilonCandidates(weekPrices) {
  return TEMPLATES.map(tpl => ({
    srcTpl: tpl,
    epsilonVec: computeEpsilonVec(weekPrices, tpl)
  }));
}

function enumAllPredictions(epsilonCandidates) {
  const results = [];
  epsilonCandidates.forEach(candidate => {
    TEMPLATES.forEach(targetTpl => {
      results.push({
        srcTpl: candidate.srcTpl,
        targetTpl,
        epsilonVec: candidate.epsilonVec,
        predicted: predict(candidate.epsilonVec, targetTpl)
      });
    });
  });
  return results;
}

function filterPredictions(predictions, weekPrices) {
  const scored = predictions
    .map(p => ({ ...p, residual: matchResidual(p.predicted, weekPrices) }))
    .sort((a, b) => a.residual - b.residual);
  if (!scored.length) return [];
  const dynamicThreshold = Math.max(scored[0].residual * 5, MATCH_THRESHOLD);
  const filtered = scored.filter(p => p.residual <= dynamicThreshold);
  return filtered.length > 0 ? filtered : [scored[0]];
}

function filterEightPredictions(eightPredictions, currentWeekPrices) {
  if (!currentWeekPrices.some(p => p != null)) {
    return eightPredictions.map(p => ({ ...p, eliminated: false, residual: null, confidence: null }));
  }
  const scored = eightPredictions
    .map(p => ({ ...p, residual: matchResidual(p.predicted, currentWeekPrices) }))
    .sort((a, b) => a.residual - b.residual);
  const minRes = scored[0].residual;
  const dynamicThreshold = Math.max(minRes * 5, MATCH_THRESHOLD);
  return scored.map(p => ({
    ...p,
    eliminated: p.residual > dynamicThreshold,
    confidence: minRes < 1e-9 ? 1.0 : Math.min(1, minRes / p.residual)
  }));
}

function analyzeItem(records) {
  if (!records.length) return null;
  const weekData = records.map(r => ({ week: r.week, prices: r.prices }));

  if (weekData.length === 1) {
    const candidates = enumEpsilonCandidates(weekData[0].prices);
    const predictions = enumAllPredictions(candidates);
    return {
      stage: 'first_week',
      week: weekData[0].week,
      candidates,
      predictions,
      epsilonVec: null,
      lockedSrcTpl: null
    };
  }

  let candidateSet = null;
  for (let i = 0; i < weekData.length - 1; i++) {
    const w1 = weekData[i];
    const w2 = weekData[i + 1];
    const epsilonCandidates = enumEpsilonCandidates(w1.prices);
    const predictions = enumAllPredictions(epsilonCandidates);
    const matched = filterPredictions(predictions, w2.prices);
    if (!matched.length) continue;

    const thisRound = new Map();
    matched.forEach(m => {
      const key = m.srcTpl.id;
      if (!thisRound.has(key) || m.residual < thisRound.get(key).residual)
        thisRound.set(key, m);
    });

    if (candidateSet === null) {
      candidateSet = thisRound;
    } else {
      const intersection = new Map();
      thisRound.forEach((val, key) => {
        if (candidateSet.has(key)) {
          const prev = candidateSet.get(key);
          intersection.set(key, val.residual < prev.residual ? val : prev);
        }
      });
      // 原来：candidateSet = intersection.size > 0 ? intersection : thisRound;
      // 修复：交集为空则保留旧集合，本轮视为噪声跳过
      if (intersection.size > 0) candidateSet = intersection;
    }
  }

  if (!candidateSet || candidateSet.size === 0) {
    const latest = weekData[weekData.length - 1];
    const candidates = enumEpsilonCandidates(latest.prices);
    const predictions = enumAllPredictions(candidates);
    return {
      stage: 'first_week',
      week: latest.week,
      candidates,
      predictions,
      epsilonVec: null,
      lockedSrcTpl: null
    };
  }

  const best = [...candidateSet.values()].sort((a, b) => a.residual - b.residual)[0];
  const hasComplete = weekData.some(w => w.prices.every(p => p != null));
  // 必须拥有完整的一周数据，且候选集唯一，才算真正锁定
  const isUnique = candidateSet.size === 1 && hasComplete;

  // 计算"完整 ε"：从所有完整周中找到与 best.srcTpl 残差最小的那个周重新拟合，
  // 确保 epsilonVec 全部7天都有值，用于总览中未观测天的预测补位。
  let fullEpsilonVec = best.epsilonVec;
  const completeWeeks = weekData.filter(w => w.prices.every(p => p != null));
  if (completeWeeks.length > 0) {
    // 从完整周重新推导 ε 也要保证7天全不为 null
    fullEpsilonVec = computeEpsilonVec(completeWeeks[completeWeeks.length - 1].prices, best.srcTpl);
  }

  const eightPredictions = TEMPLATES.map(tpl => ({
    targetTpl: tpl,
    epsilonVec: best.epsilonVec,
    predicted: predict(best.epsilonVec, tpl, fullEpsilonVec)
  }));

  // 当 pending 时，为每个候选 srcTpl 分别生成 8 组预测，供 UI 分组展示
  const allCandidatesPredictions = isUnique ? null : [...candidateSet.values()]
    .sort((a, b) => a.residual - b.residual)
    .map(candidate => {
      // 为该候选计算完整 ε（若有完整历史周则从中推导）
      let candFullEps = candidate.epsilonVec;
      if (completeWeeks.length > 0) {
        candFullEps = computeEpsilonVec(completeWeeks[completeWeeks.length - 1].prices, candidate.srcTpl);
      }
      return {
        srcTpl: candidate.srcTpl,
        residual: candidate.residual,
        epsilonVec: candFullEps,
        eight: TEMPLATES.map(tpl => ({
          targetTpl: tpl,
          epsilonVec: candFullEps,
          predicted: predict(candFullEps, tpl, candFullEps)
        }))
      };
    });

  return {
    stage: isUnique ? 'locked' : 'pending',
    epsilonVec: fullEpsilonVec,   // 展示和预测均用完整 ε（从完整历史周推导，无 null）
    rawEpsilonVec: best.epsilonVec, // 保留原始（可能含 null 的）ε 供调试
    lockedSrcTpl: best.srcTpl,
    lockedTargetTpl: best.targetTpl,
    eightPredictions,
    allCandidatesPredictions, // pending 时存放所有候选的完整预测（null 表示已锁定）
    weekCount: weekData.length,
    candidateCount: candidateSet.size
  };
}