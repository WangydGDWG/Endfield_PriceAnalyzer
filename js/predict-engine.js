//  __      __                                        __     
// /\ \  __/\ \                                      /\ \    
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \   
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \  
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \ 
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/       
//                                    \_/__/    \_/__/         

//核心代码！！！能跑就别乱动！！！！！
//
// v6 拟合引擎
// ────────────────────────────────────────────────────────────
// 旧版按“相邻两周 (wᵢ→wᵢ₊₁) 的模板编号取交集”收敛 ε：
//   · 模板编号每周独立随机，跨周交集在概念上就是错的；
//   · 3 周以上时交集经常为空，于是退回第一对的结果 → 换两周数据结果全变；
//   · 单周四舍五入误差被逐周放大，5 周以上开始“紊乱”；
//   · 没有任何影子数据判据。
//
// 新版把不变量改成 ε 本身（每人每物品固定），做全局一致性拟合：
//   1. 每个可用周 × 每个模板反推出 8 组 ε 假设；
//   2. 用“该 ε 能否同时解释所有周”给假设打分，取解释周数最多、
//      支撑天数最多、残差最小的一组（与录入顺序完全无关）；
//   3. 对一致周按 (Tᵢ·Xᵢ)² 加权平均 ε，消除单周取整噪声；
//   4. 只有“每天至少两周独立观测 + 解唯一”才判定 LOCKED，
//      否则给出候选并说明原因，绝不假装锁定；
//   5. 不一致的周按影子判据逐天定位：能被同一 ε + 某模板解释的
//      天视为干净天，偏离超过容差的天标记为影子天，并输出修正值。
// ────────────────────────────────────────────────────────────

// ══════════════════════════════════════
// FIT CONFIG
// ══════════════════════════════════════
const FIT = {
  MIN_USABLE_DAYS: 3,      // 少于 3 天的周不参与母本周假设
  MIN_CLEAN_WEEKS: 2,      // 至少两周一致才算跨周验证
  MIN_DAY_SUPPORT: 2,      // 每一天至少被两个干净周独立观测到
  MIN_TOTAL_OBS: 9,        // 干净周合计至少 9 个观测点
  MIN_MAX_WEEK_OBS: 5,     // 至少有一个干净周观测到 5 天以上
  PRICE_TOL_ABS: 2,        // 允许的整数取整误差（单位：价格）
  PRICE_TOL_REL: 0.0008,   // 高价时的相对容差
  SHADOW_TOL_ABS: 5,       // 超过该偏差才判为影子天
  SHADOW_TOL_REL: 0.0018,  // 高价时的影子判定相对阈值
  EPS_CLUSTER_TOL: 8e-4,   // 两个 ε 候选视为同一解的距离
  MAX_ITER: 6,
  MAX_CANDIDATES: 8,
  CACHE_LIMIT: 240,
};

const ANALYSIS_CACHE = new Map();

// ══════════════════════════════════════
// SMALL HELPERS
// ══════════════════════════════════════
function clampEpsilon(e) {
  return Math.max(-0.5, Math.min(0.5, e));
}

function observedIndices(prices) {
  const out = [];
  for (let i = 0; i < 7; i++) if (prices[i] != null) out.push(i);
  return out;
}

function observedCount(prices) {
  return observedIndices(prices).length;
}

function priceTolerance(p) {
  return Math.max(FIT.PRICE_TOL_ABS, FIT.PRICE_TOL_REL * Math.abs(p));
}

function shadowTolerance(p) {
  return Math.max(FIT.SHADOW_TOL_ABS, FIT.SHADOW_TOL_REL * Math.abs(p));
}

// 统一成 7 天数组，过滤非法值
function normalizePrices(prices) {
  const src = Array.isArray(prices) ? prices : [];
  return Array.from({ length: 7 }, (_, i) => {
    const p = Number(src[i]);
    return Number.isFinite(p) && p > 0 ? p : null;
  });
}

function dedupeAndSortRecords(records) {
  const byWeek = new Map();
  records.forEach(r => {
    if (!r || !r.week) return;
    const prices = normalizePrices(r.prices);
    const prev = byWeek.get(r.week);
    if (!prev) {
      byWeek.set(r.week, { week: r.week, item: r.item, prices });
      return;
    }
    // 同一周重复记录：逐天取“有值优先”，避免导入合并产生双份
    prev.prices = prev.prices.map((p, i) => (p != null ? p : prices[i]));
  });
  return sortByWeek([...byWeek.values()], r => r.week);
}

function analysisKey(records) {
  return records
    .map(r => `${r.item || ''}\u0001${r.week}\u0001${normalizePrices(r.prices).map(p => (p == null ? '-' : p)).join(',')}`)
    .sort()
    .join('\u0002');
}

// ══════════════════════════════════════
// FORMULAS
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
    e = clampEpsilon(e);
    return Math.round(g * (1 + targetTpl.coeff * e));
  });
}

// residual = mean((P_pred - P_actual)² / P_actual²)
function matchResidual(predicted, weekPrices, ignoreMask) {
  let sum = 0, count = 0;
  weekPrices.forEach((p, i) => {
    if (p == null || (ignoreMask && ignoreMask[i])) return;
    const diff = (predicted[i] - p) / p;
    sum += diff * diff;
    count++;
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

// 本周 8 组候选的实时过滤。
// opts.ignoreMask[i] = true 时忽略该天（影子天 / 明确不参与比较的天）
function filterEightPredictions(eightPredictions, currentWeekPrices, opts) {
  const ignoreMask = opts && opts.ignoreMask;
  const hasObs = currentWeekPrices.some((p, i) => p != null && !(ignoreMask && ignoreMask[i]));
  if (!hasObs) {
    return eightPredictions.map(p => ({ ...p, eliminated: false, residual: null, confidence: null }));
  }
  const scored = eightPredictions
    .map(p => ({ ...p, residual: matchResidual(p.predicted, currentWeekPrices, ignoreMask) }))
    .sort((a, b) => a.residual - b.residual);
  const minRes = scored[0].residual;
  const dynamicThreshold = Math.max(minRes * 5, MATCH_THRESHOLD);
  return scored.map(p => ({
    ...p,
    eliminated: p.residual > dynamicThreshold,
    confidence: minRes < 1e-9 ? 1.0 : Math.min(1, minRes / Math.max(p.residual, 1e-12))
  }));
}

// ══════════════════════════════════════
// GLOBAL EPSILON CONSENSUS
// ══════════════════════════════════════
// 给定 ε，找最像的模板
function bestTemplateFor(eps, prices) {
  let best = null;
  TEMPLATES.forEach(tpl => {
    const pred = predict(eps, tpl);
    let maxAbs = 0, sumSq = 0, n = 0;
    for (let i = 0; i < 7; i++) {
      if (prices[i] == null) continue;
      const d = Math.abs(pred[i] - prices[i]);
      if (d > maxAbs) maxAbs = d;
      sumSq += d * d;
      n++;
    }
    const rms = n ? Math.sqrt(sumSq / n) : Infinity;
    if (!best ||
      rms < best.rms - 1e-12 ||
      (Math.abs(rms - best.rms) <= 1e-12 && maxAbs < best.maxAbs) ||
      (Math.abs(rms - best.rms) <= 1e-12 && maxAbs === best.maxAbs && tpl.id < best.tpl.id)) {
      best = { tpl, pred, rms, maxAbs, n };
    }
  });
  return best;
}

function isCompatible(pred, prices) {
  for (let i = 0; i < 7; i++) {
    if (prices[i] == null) continue;
    if (Math.abs(pred[i] - prices[i]) > priceTolerance(prices[i])) return false;
  }
  return true;
}

// 一个 ε 假设能解释多少周
function evaluateEpsilon(eps, weeks) {
  const assign = [];
  let cleanCount = 0, support = 0, errSum = 0;
  weeks.forEach(w => {
    const bt = bestTemplateFor(eps, w.prices);
    const ok = bt && isCompatible(bt.pred, w.prices);
    let common = 0;
    for (let i = 0; i < 7; i++) {
      if (eps[i] != null && w.prices[i] != null) common++;
    }
    if (ok) {
      cleanCount++;
      support += common;
      errSum += bt.rms;
    }
    assign.push({ week: w.week, prices: w.prices, tpl: bt ? bt.tpl : null, rms: bt ? bt.rms : Infinity, maxAbs: bt ? bt.maxAbs : Infinity, ok, common });
  });
  return { eps, assign, clean: assign.filter(a => a.ok), cleanCount, support, errSum };
}

function tieKeyOf(srcWeek, srcTplId) {
  return `${srcWeek}\u0001${String(srcTplId).padStart(2, '0')}`;
}

function isBetterEvaluation(a, b) {
  if (!b) return true;
  if (a.cleanCount !== b.cleanCount) return a.cleanCount > b.cleanCount;
  if (a.support !== b.support) return a.support > b.support;
  if (Math.abs(a.errSum - b.errSum) > 1e-9) return a.errSum < b.errSum;
  return a.tieKey < b.tieKey;
}

function refineEpsilon(initialEps, weeks) {
  let eps = initialEps.slice();
  let evalResult = evaluateEpsilon(eps, weeks);
  let bestEval = evalResult;
  let bestEps = eps.slice();

  for (let iter = 0; iter < FIT.MAX_ITER; iter++) {
    const clean = evalResult.clean;
    if (!clean.length) break;

    for (let i = 0; i < 7; i++) {
      let wsum = 0, vsum = 0;
      clean.forEach(a => {
        const p = a.prices[i];
        if (p == null || !a.tpl) return;
        const e = (p / a.tpl.grid[i] - 1) / a.tpl.coeff;
        const w = Math.pow(a.tpl.grid[i] * a.tpl.coeff, 2);
        wsum += w;
        vsum += w * e;
      });
      if (wsum > 0) eps[i] = vsum / wsum;
    }

    const next = evaluateEpsilon(eps, weeks);
    if (isBetterEvaluation(next, bestEval)) {
      bestEval = next;
      bestEps = eps.slice();
    }
    const stable = Math.abs(next.cleanCount - evalResult.cleanCount) === 0 &&
      Math.abs(next.support - evalResult.support) === 0 &&
      Math.abs(next.errSum - evalResult.errSum) < 1e-12;
    evalResult = next;
    if (stable) break;
  }
  return { eps: bestEps, evaluation: bestEval };
}

// 两个 ε 是否属于同一组解
function sameEpsilon(a, b, tol) {
  const t = tol == null ? FIT.EPS_CLUSTER_TOL : tol;
  for (let i = 0; i < 7; i++) {
    if (a[i] == null && b[i] == null) continue;
    if (a[i] == null || b[i] == null) return false;
    if (Math.abs(a[i] - b[i]) > t) return false;
  }
  return true;
}

// 收集仍然可能成立的 ε 候选（用于 pending 展示）
function collectCandidates(evaluatedHyps, bestEval) {
  const bestCleanWeeks = new Set(bestEval.clean.map(a => a.week));
  const pool = [];

  evaluatedHyps.forEach(h => {
    if (h.evaluation.cleanCount < bestEval.cleanCount) return;

    if (bestCleanWeeks.size > 0) {
      // 必须能解释最佳解中的每一周，避免把无关假设混进来
      const ids = new Set(h.evaluation.clean.map(a => a.week));
      let covers = true;
      bestCleanWeeks.forEach(id => { if (!ids.has(id)) covers = false; });
      if (!covers) return;
    }

    pool.push({
      eps: h.eps,
      srcTpl: h.tpl,
      srcWeek: h.week,
      cleanCount: h.evaluation.cleanCount,
      support: h.evaluation.support,
      errSum: h.evaluation.errSum
    });
  });

  if (!pool.length) {
    pool.push({
      eps: bestEval.eps,
      srcTpl: bestEval.clean.length ? bestEval.clean[bestEval.clean.length - 1].tpl : TEMPLATES[0],
      srcWeek: bestEval.clean.length ? bestEval.clean[bestEval.clean.length - 1].week : '',
      cleanCount: bestEval.cleanCount,
      support: bestEval.support,
      errSum: bestEval.errSum
    });
  }

  pool.sort((a, b) =>
    (b.cleanCount - a.cleanCount) ||
    (b.support - a.support) ||
    (a.errSum - b.errSum) ||
    String(a.srcWeek).localeCompare(String(b.srcWeek)) ||
    (a.srcTpl.id - b.srcTpl.id)
  );

  const clusters = [];
  pool.forEach(c => {
    const hit = clusters.find(cl => sameEpsilon(cl.eps, c.eps));
    if (!hit) clusters.push(c);
  });
  return clusters.slice(0, FIT.MAX_CANDIDATES);
}

// ══════════════════════════════════════
// SHADOW DATA
// ══════════════════════════════════════
// 影子判据落地：
//   · 用共识 ε 预测该周，能被某个模板解释的天 = 干净天；
//   · 偏离超过容差的天 = 影子天（影子是对超限数据的修正）；
//   · 干净天不足以确认模板时，不硬判，标记为 unresolved / insufficient。
function classifyShadowWeek(eps, week) {
  const prices = week.prices;
  const nObs = observedCount(prices);
  if (nObs === 0) {
    return { status: 'empty', template: null, corrected: null, shadowDays: [], cleanDays: [], maxAbs: null };
  }
  if (nObs < 2) {
    return { status: 'insufficient', template: null, corrected: null, shadowDays: [], cleanDays: [observedIndices(prices)[0]], maxAbs: null };
  }

  let best = null;
  TEMPLATES.forEach(tpl => {
    const q = predict(eps, tpl);
    const shadowDays = [];
    const cleanDays = [];
    let penalty = 0;
    for (let i = 0; i < 7; i++) {
      if (prices[i] == null) continue;
      const d = Math.abs(q[i] - prices[i]);
      if (d > shadowTolerance(prices[i])) {
        shadowDays.push({
          day: i,
          observed: prices[i],
          corrected: q[i],
          delta: q[i] - prices[i],
          epsKnown: eps[i] != null
        });
        penalty += d;
      } else {
        cleanDays.push(i);
      }
    }
    const score = cleanDays.length * 1e6 - penalty;
    if (!best || score > best.score || (score === best.score && tpl.id < best.tpl.id)) {
      best = { tpl, q, shadowDays, cleanDays, penalty, score };
    }
  });

  const needed = Math.max(2, Math.ceil(nObs * 0.5));
  let status;
  if (best.shadowDays.length === 0) status = 'clean_partial';
  else if (best.cleanDays.length >= needed && best.shadowDays.every(d => d.epsKnown)) status = 'shadow';
  else if (best.cleanDays.length >= 1) status = 'partial';
  else status = 'unresolved';

  return {
    status,
    template: status === 'unresolved' ? null : best.tpl,
    corrected: status === 'unresolved' ? null : best.q,
    shadowDays: status === 'unresolved' ? [] : best.shadowDays,
    cleanDays: best.cleanDays,
    maxAbs: best.shadowDays.reduce((m, d) => Math.max(m, Math.abs(d.delta)), 0)
  };
}

// ══════════════════════════════════════
// MAIN ENTRY
// ══════════════════════════════════════
function analyzeItem(records) {
  if (!records || !records.length) return null;

  const cacheKey = analysisKey(records);
  const cached = ANALYSIS_CACHE.get(cacheKey);
  if (cached) return cached;

  const result = computeAnalysis(records);
  if (result) {
    ANALYSIS_CACHE.set(cacheKey, result);
    if (ANALYSIS_CACHE.size > FIT.CACHE_LIMIT) {
      ANALYSIS_CACHE.delete(ANALYSIS_CACHE.keys().next().value);
    }
  }
  return result;
}

function computeAnalysis(records) {
  const weekData = dedupeAndSortRecords(records);
  if (!weekData.length) return null;

  const weekCount = weekData.length;
  const usable = weekData.filter(w => observedCount(w.prices) >= FIT.MIN_USABLE_DAYS);

  // ── 只有一周（或不足两周可交叉验证）：穷举 64 组 ──
  if (usable.length < 2) {
    let base = usable[0];
    if (!base) {
      base = weekData.reduce((a, b) =>
        observedCount(b.prices) > observedCount(a.prices) ? b : a
      );
    }
    const candidates = enumEpsilonCandidates(base.prices);
    const predictions = enumAllPredictions(candidates);
    const weekFits = {};
    weekData.forEach(w => {
      weekFits[w.week] = {
        status: 'unverified',
        template: null,
        corrected: null,
        shadowDays: [],
        cleanDays: [],
        observedCount: observedCount(w.prices)
      };
    });
    return {
      stage: 'first_week',
      pendingReason: 'single',
      week: base.week,
      weekCount,
      candidateCount: candidates.length,
      candidates,
      predictions,
      epsilonVec: null,
      rawEpsilonVec: null,
      epsilonKnown: Array(7).fill(false),
      daySupport: Array(7).fill(0),
      lockedSrcTpl: null,
      lockedTargetTpl: null,
      eightPredictions: null,
      allCandidatesPredictions: null,
      cleanWeeks: [],
      shadowWeeks: [],
      weekFits,
      fitResidual: null,
      convergenceRounds: 0
    };
  }

  // ── 1. 枚举“周 × 模板”的 ε 假设 ──
  const evaluatedHyps = [];
  usable.forEach(w => {
    TEMPLATES.forEach(tpl => {
      const eps = computeEpsilonVec(w.prices, tpl);
      if (eps.filter(e => e != null).length < FIT.MIN_USABLE_DAYS) return;
      const ev = evaluateEpsilon(eps, usable);
      evaluatedHyps.push({
        eps,
        tpl,
        week: w.week,
        tieKey: tieKeyOf(w.week, tpl.id),
        evaluation: ev
      });
    });
  });

  if (!evaluatedHyps.length) {
    return computeAnalysis(records.filter(r => observedCount(normalizePrices(r.prices)) < FIT.MIN_USABLE_DAYS));
  }

  // ── 2. 选出解释力最强的假设（与录入顺序无关）──
  let bestHyp = null;
  evaluatedHyps.forEach(h => {
    if (isBetterEvaluation(h.evaluation, bestHyp ? bestHyp.evaluation : null)) bestHyp = h;
  });

  // ── 3. 用所有一致周加权平均 ε，迭代到稳定 ──
  const refined = refineEpsilon(bestHyp.eps, usable);
  let eps = refined.eps;
  let bestEval = evaluateEpsilon(eps, usable);

  // 迭代后若变差，退回原始最优
  if (!isBetterEvaluation(bestEval, bestHyp.evaluation)) {
    eps = bestHyp.eps.slice();
    bestEval = bestHyp.evaluation;
  }

  const clean = bestEval.clean;

  // ── 4. 覆盖度 / 唯一性 / 多样性检查 ──
  const daySupport = Array(7).fill(0);
  const knownMask = Array(7).fill(false);
  clean.forEach(a => {
    for (let i = 0; i < 7; i++) {
      if (a.prices[i] != null) {
        daySupport[i]++;
        knownMask[i] = true;
      }
    }
  });
  const knownCount = knownMask.filter(Boolean).length;
  const minDaySupport = Math.min(...daySupport);
  const totalObs = clean.reduce((s, a) => s + observedCount(a.prices), 0);
  const maxWeekObs = clean.reduce((m, a) => Math.max(m, observedCount(a.prices)), 0);
  const distinctPrices = new Set(clean.map(a => a.prices.join(','))).size;
  const distinctTemplates = new Set(clean.map(a => (a.tpl ? a.tpl.id : 0))).size;

  let unique = true;
  if (clean.length >= FIT.MIN_CLEAN_WEEKS) {
    // 是否存在另一个能解释同一批周的 ε？
    // 典型歧义：两周用了同一个模板 → 价格向量相同，任何模板都能自洽。
    const cleanIds = new Set(clean.map(a => a.week));
    evaluatedHyps.forEach(h => {
      if (!unique) return;
      if (h.evaluation.cleanCount !== clean.length) return;
      const ids = new Set(h.evaluation.clean.map(a => a.week));
      if (ids.size !== cleanIds.size) return;
      for (const id of ids) if (!cleanIds.has(id)) return;
      if (!sameEpsilon(h.eps, eps, 5e-4) &&
          Math.abs(h.evaluation.errSum - bestEval.errSum) < 0.5) {
        unique = false;
      }
    });
  }

  const strong =
    clean.length >= FIT.MIN_CLEAN_WEEKS &&
    knownCount === 7 &&
    minDaySupport >= FIT.MIN_DAY_SUPPORT &&
    totalObs >= FIT.MIN_TOTAL_OBS &&
    maxWeekObs >= FIT.MIN_MAX_WEEK_OBS &&
    distinctTemplates >= 2 &&
    distinctPrices >= 2 &&
    unique;

  const stage = strong ? 'locked' : 'pending';

  let pendingReason = null;
  if (!strong) {
    if (clean.length < FIT.MIN_CLEAN_WEEKS) pendingReason = 'conflict';
    else if (!unique || distinctTemplates < 2 || distinctPrices < 2) pendingReason = 'ambiguous';
    else if (knownCount < 7 || minDaySupport < FIT.MIN_DAY_SUPPORT) pendingReason = 'weak';
    else pendingReason = 'ambiguous';
  }

  // ── 5. 影子周识别与修正 ──
  const cleanWeekSet = new Set(clean.map(a => a.week));
  const weekFits = {};
  const shadowWeeks = [];

  weekData.forEach(w => {
    const cleanHit = clean.find(a => a.week === w.week);
    if (cleanHit) {
      weekFits[w.week] = {
        status: 'clean',
        template: cleanHit.tpl,
        corrected: predict(eps, cleanHit.tpl),
        shadowDays: [],
        cleanDays: observedIndices(w.prices),
        observedCount: observedCount(w.prices),
        residual: cleanHit.rms
      };
      return;
    }
    if (!cleanWeekSet.has(w.week)) {
      const shadow = classifyShadowWeek(eps, w);
      weekFits[w.week] = {
        status: shadow.status,
        template: shadow.template,
        corrected: shadow.corrected,
        shadowDays: shadow.shadowDays,
        cleanDays: shadow.cleanDays,
        observedCount: observedCount(w.prices),
        residual: shadow.maxAbs
      };
      if ((shadow.status === 'shadow' || shadow.status === 'partial') && shadow.shadowDays.length > 0) {
        shadowWeeks.push({
          week: w.week,
          status: shadow.status,
          template: shadow.template,
          shadowDays: shadow.shadowDays,
          corrected: shadow.corrected
        });
      }
    }
  });

  // ── 6. 本周 8 组预测 ──
  const latestClean = clean.length ? clean[clean.length - 1] : null;
  const eightPredictions = TEMPLATES.map(tpl => ({
    targetTpl: tpl,
    epsilonVec: eps,
    predicted: predict(eps, tpl)
  }));

  // ── 7. pending 时的候选解 ──
  let allCandidatesPredictions = null;
  let candidateCount = 1;
  if (!strong) {
    const candidates = collectCandidates(evaluatedHyps, {
      clean: clean,
      cleanCount: bestEval.cleanCount,
      support: bestEval.support,
      errSum: bestEval.errSum,
      eps
    });
    candidateCount = Math.max(1, candidates.length);
    if (candidates.length > 1) {
      allCandidatesPredictions = candidates.map(c => ({
        srcTpl: c.srcTpl,
        residual: c.errSum,
        epsilonVec: c.eps,
        eight: TEMPLATES.map(tpl => ({
          targetTpl: tpl,
          epsilonVec: c.eps,
          predicted: predict(c.eps, tpl)
        }))
      }));
    }
  }

  const result = {
    stage,
    pendingReason,
    week: latestClean ? latestClean.week : (weekData[weekData.length - 1] || {}).week,
    weekCount,
    candidateCount,
    epsilonVec: eps,
    rawEpsilonVec: bestHyp.eps,
    epsilonKnown: knownMask,
    daySupport,
    lockedSrcTpl: latestClean ? latestClean.tpl : bestHyp.tpl,
    lockedTargetTpl: null,
    eightPredictions,
    allCandidatesPredictions,
    cleanWeeks: clean.map(a => a.week),
    shadowWeeks,
    weekFits,
    fitResidual: clean.length ? Math.sqrt(clean.reduce((s, a) => s + a.rms * a.rms, 0) / clean.length) : null,
    convergenceRounds: clean.length,
    hasCompleteWeek: weekData.some(w => observedCount(w.prices) === 7)
  };

  return result;
}

// 保留旧接口；新版 analyzeItem 已内置数据提纯、唯一性校验与影子修正，
// 不再需要“完整周 / 全量数据各跑一次再取候选更少者”的双重计算。
function analyzeItemSafe(records) {
  return analyzeItem(records);
}
