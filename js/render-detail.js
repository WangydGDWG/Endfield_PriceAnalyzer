// ══════════════════════════════════════
// RENDER DETAIL (只保留底层机制说明)
// ══════════════════════════════════════
function renderDetail() {
  const container = document.getElementById('detail-body');
  
  let html = '';

  html += `<div class="detail-section">
    <div class="detail-section-title">§ 1 · 算法公式说明</div>
    <div class="formula-box">
      <div class="fml-comment">// 价格生成公式（正向）</div>
      <div><span class="fml-key">P<sub>i</sub></span> = <span class="fml-val">T<sup>(n)</sup><sub>i</sub></span> × ( 1 + <span class="fml-val">X<sup>(n)</sup></span> × <span class="fml-key">ε<sub>i</sub></span> )</div>
      <div style="margin-top:8px" class="fml-comment">// ε 反推公式（逆向，从实测价格求个人系数）</div>
      <div><span class="fml-key">ε<sub>i</sub></span> = ( <span class="fml-val">P<sub>i</sub></span> / <span class="fml-val">T<sup>(n)</sup><sub>i</sub></span> − 1 ) / <span class="fml-val">X<sup>(n)</sup></span></div>
      <div style="margin-top:8px" class="fml-comment">// 残差评分（归一化均方值，越小越匹配）</div>
      <div>residual = <span class="fml-key">mean</span>( ( <span class="fml-val">P<sub>predicted</sub></span> − <span class="fml-val">P<sub>actual</sub></span> )<sup>2</sup> / <span class="fml-val">P<sub>actual</sub></span><sup>2</sup> )</div>
      <div style="margin-top:8px" class="fml-comment">// RMSE 展示值（在 UI 中开方并转为百分比）</div>
      <div>RMSE% = √<span class="fml-result">residual</span> × 100%</div>
    </div>
    <div class="def-grid">
      <div class="def-term">P<sub>i</sub></div><div class="def-desc">第 i 天的实际价格（玩家观测值）</div>
      <div class="def-term">T<sup>(n)</sup><sub>i</sub></div><div class="def-desc">第 n 号模板第 i 天的格点价格（全服固定，整百数），定义在 <code style="color:var(--accent)">TEMPLATES[i].grid</code></div>
      <div class="def-term">X<sup>(n)</sup></div><div class="def-desc">第 n 号模板的偏差系数（只取 4 / 5 / 6），定义在 <code style="color:var(--accent)">TEMPLATES[i].coeff</code></div>
      <div class="def-term">ε<sub>i</sub></div><div class="def-desc">标准化相对偏差向量的第 i 个分量，每人每物品初始化时固定，跨周不变</div>
      <div class="def-term">n</div><div class="def-desc">本周随机选取的模板编号（1–8），每周独立随机</div>
    </div>
  </div>`;

  html += `<div class="detail-section">
    <div class="detail-section-title">§ 2 · 核心算法函数实现</div>
    
    <div class="detail-fn-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px;margin-bottom:20px">
      
      <div style="border:1px solid var(--teal);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--teal);background:rgba(91,207,250,0.05);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--teal)">computeEpsilonVec(weekPrices, tpl)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">反推 ε 向量</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 对应公式：εᵢ = (Pᵢ / Tᵢ − 1) / X</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：一周7天的实测价格 + 一个模板对象<br>
            <span style="color:var(--teal)">输出</span>：长度为7的 ε 向量，空缺天对应位置为 null
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            对每一天 i：若 Pᵢ 不为 null，则<br>
            &nbsp;&nbsp;<code style="color:var(--accent)">(Pᵢ / tpl.grid[i] - 1) / tpl.coeff</code><br>
            否则返回 null
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--teal);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--teal);background:rgba(91,207,250,0.05);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--teal)">predict(epsilonVec, targetTpl)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">正向预测价格</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 对应公式：Pᵢ = Tᵢ × (1 + X × εᵢ)</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：已知 ε 向量 + 目标模板对象<br>
            <span style="color:var(--teal)">输出</span>：长度为7的预测价格数组（四舍五入取整）
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            对每一天 i：若 εᵢ 为 null 则取 0，计算<br>
            &nbsp;&nbsp;<code style="color:var(--accent)">Math.round(targetTpl.grid[i] * (1 + targetTpl.coeff * εᵢ))</code>
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--teal);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--teal);background:rgba(91,207,250,0.05);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--teal)">matchResidual(predicted, weekPrices)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">计算残差评分</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 对应公式：mean((ΔP/P)²)</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：预测价格数组 + 实测价格数组<br>
            <span style="color:var(--teal)">输出</span>：归一化均方残差值（越小越匹配，无数据则 Infinity）
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            只计算有实测值的日期：<br>
            &nbsp;&nbsp;<code style="color:var(--accent)">diff = (predicted[i] - p) / p</code><br>
            &nbsp;&nbsp;<code style="color:var(--accent)">sum += diff × diff; count++</code><br>
            最终返回 sum / count（内部不开根号，展示时在 UI 中做 √...×100%）
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--accent);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--accent);background:rgba(232,184,75,0.06);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--accent)">enumEpsilonCandidates(weekPrices)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">枚举 ε 候选集</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 母本周的 8 种模板假设 → 8 组 ε 候选</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：一周的实测价格<br>
            <span style="color:var(--teal)">输出</span>：长度为 8 的数组，每项为 {srcTpl, epsilonVec}
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            遍历全部 8 个 TEMPLATES，对每个模板调用<br>
            &nbsp;&nbsp;<code style="color:var(--accent)">computeEpsilonVec(weekPrices, tpl)</code><br>
            假设"母本周用的是模板 n"，反推出对应的 ε
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--accent);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--accent);background:rgba(232,184,75,0.06);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--accent)">enumAllPredictions(epsilonCandidates)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">穷举全组合预测</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 8 组 ε × 8 个目标模板 = 64 组预测</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：ε 候选数组（长度 ≤ 8）<br>
            <span style="color:var(--teal)">输出</span>：64 个预测对象 {srcTpl, targetTpl, epsilonVec, predicted}
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            双重循环：<br>
            &nbsp;&nbsp;外层遍历 ε 候选<br>
            &nbsp;&nbsp;内层遍历 8 个 TEMPLATES<br>
            &nbsp;&nbsp;对每个组合调用 <code style="color:var(--accent)">predict(ε, targetTpl)</code>
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--green);background:var(--bg2)">
        <div style="padding:10px 14px;border-bottom:1px solid var(--green);background:rgba(82,214,138,0.06);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--green)">filterPredictions(predictions, weekPrices)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">残差筛选与收敛</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 用校验周价格淘汰不匹配的预测</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：64 组预测 + 校验周实测价格<br>
            <span style="color:var(--teal)">输出</span>：按残差升序排列的匹配项数组
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            对每组预测调用 <code style="color:var(--accent)">matchResidual(pred, weekPrices)</code><br>
            <span style="color:var(--green)">动态阈值</span> = max(最优残差 × 5, 0.003)<br>
            只保留残差 ≤ 阈值的预测项
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--green);background:var(--bg2)">
        <div style="padding:10px 14px;border-bottom:1px solid var(--green);background:rgba(82,214,138,0.06);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--green)">filterEightPredictions(predictions, currentWeekPrices)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">本周模板过滤</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 用本周零散数据排除不可能的模板</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：8 组预测 + 本周实测数据（可能不完整）<br>
            <span style="color:var(--teal)">输出</span>：带 eliminated 标记的 8 组预测
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            若本周无任何实测，全部保留为候选<br>
            否则计算残差 → 动态阈值 → 超标则标记 eliminated<br>
            附加计算 confidence = minResidual / 该组残差
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--border);background:var(--bg2)">
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--bg3);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--textb)">analyzeItem(records)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">主分析入口</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 跨周交叉验证收敛 ε，返回分析结果</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：某物品的全部历史记录<br>
            <span style="color:var(--teal)">输出</span>：{ stage, epsilonVec, eightPredictions, ... }
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            <span style="color:var(--accent)">若只有1周数据</span>：<br>
            &nbsp;&nbsp;返回 stage='first_week'，全部 64 组穷举<br>
            <span style="color:var(--accent)">若 ≥2 周</span>：<br>
            &nbsp;&nbsp;按时间顺序两两配对 (wᵢ → wᵢ₊₁)<br>
            &nbsp;&nbsp;母本周反推 ε → 校验周筛选 → 多轮取交集<br>
            &nbsp;&nbsp;交集唯一且有完整周 → stage='locked'<br>
            &nbsp;&nbsp;交集不唯一 → stage='pending'
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--border);background:var(--bg2);grid-column:1/-1">
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--bg3);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--accent)">analyzeItemSafe(records)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">智能增强入口（总览 / 分析 Tab 调用）</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 在 analyzeItem 基础上增加"数据提纯"逻辑</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">策略</span>：从全量数据中挑出"完整周"和"近似周"（缺1~2天），分别用这些优质数据和全量数据各跑一次 analyzeItem，取候选数更少的那个结果。
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            <span style="color:var(--green)">安全规则</span>：若没有任何完整周，即使优质数据算出 locked，也强制降级为 pending<br>
            <span style="color:var(--textd)">解决了什么问题</span>：避免因数据中夹杂零散周而导致已收敛的 ε 被误判为未收敛
          </div>
        </div>
      </div>
      
    </div>
  </div>`;

  html += `<div class="detail-section">
    <div class="detail-section-title">§ 3 · 8个价格模板（格点数据）</div>
    <div style="overflow-x:auto">
    <table class="tpl-table">
      <thead><tr>
        <th>编号</th><th>名称</th>
        <th>周一</th><th>周二</th><th>周三</th><th>周四</th><th>周五</th><th>周六</th><th>周日</th>
        <th>X</th><th>最高天</th><th>最低天</th>
      </tr></thead>
      <tbody>`;
  TEMPLATES.forEach(tpl => {
    const mx = Math.max(...tpl.grid), mxi = tpl.grid.indexOf(mx);
    const mn = Math.min(...tpl.grid), mni = tpl.grid.indexOf(mn);
    html += `<tr>
      <td>T${tpl.id}</td>
      <td style="color:var(--teal)">${tpl.name}</td>
      ${tpl.grid.map((g,i) => `<td style="${i===mxi?'color:var(--green);font-weight:bold':i===mni?'color:var(--red)':''}">${g.toLocaleString()}</td>`).join('')}
      <td class="x-coeff">${tpl.coeff}</td>
      <td style="color:var(--green)">${DAYS[mxi].replace('周','')} ${mx.toLocaleString()}</td>
      <td style="color:var(--red)">${DAYS[mni].replace('周','')} ${mn.toLocaleString()}</td>
    </tr>`;
  });
  html += `</tbody></table></div>
  </div>`;

  html += `<div class="detail-section">
    <div class="detail-section-title">§ 4 · 计算与校准原理 — 三种周类型详解</div>

    <div style="font-family:var(--mono);font-size:13px;color:var(--textd);line-height:1.8;margin-bottom:18px;padding:10px 14px;border-left:2px solid var(--border)">
      系统通过"跨周交叉验证"逐步收敛 ε 向量。每一条历史周数据在算法中都扮演不同角色，以下三种分类反映了每周数据对最终 ε 锁定的贡献方式。
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:20px">

      <div style="border:1px solid var(--accent);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--accent);background:rgba(232,184,75,0.06);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:11px;padding:1px 7px;border:1px solid var(--accent);color:var(--accent)">母本周</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--accent)">Source Week</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.9;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:6px;font-size:12px">// 在跨周对 (w_i → w_{i+1}) 中担任 w_i</div>
          <div style="margin-bottom:6px">母本周的实测价格被代入公式，在 8 种模板假设下<span style="color:var(--accent)">反推出 8 种 ε 候选向量</span>，作为下一周预测的输入。</div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            需要：≥5天有效数据（完整 or 近完整）<br>
            算法函数：<code style="color:var(--accent)">enumEpsilonCandidates(w_i)</code> → 8 组 ε<br>
            然后：<code style="color:var(--accent)">enumAllPredictions(ε候选)</code> → 64 组下周预测
          </div>
        </div>
      </div>

      <div style="border:1px solid var(--teal);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--teal);background:rgba(91,207,250,0.05);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:11px;padding:1px 7px;border:1px solid var(--teal);color:var(--teal)">校验周</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--teal)">Filter Week</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.9;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:6px;font-size:12px">// 在跨周对 (w_i → w_{i+1}) 中担任 w_{i+1}</div>
          <div style="margin-bottom:6px">校验周的实测价格被用于<span style="color:var(--teal)">筛选并淘汰</span>母本周产生的 ε 候选，残差超标的候选在此被排除。多轮判断的结果取交集，交集越小则 ε 越收敛。</div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            需要：≥5天有效数据<br>
            算法函数：<code style="color:var(--teal)">filterPredictions(preds, w_{i+1})</code><br>
            计算每组预测的 <code style="color:var(--teal)">matchResidual()</code> → 动态阈值淘汰
          </div>
        </div>
      </div>

      <div style="border:1px solid var(--border);background:var(--bg2)">
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--bg3);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:11px;padding:1px 7px;border:1px solid var(--textd);color:var(--textd)">数据周</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--textd)">Data Week</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.9;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:6px;font-size:12px">// 数据不足以参与跨周对，或为最末当前周</div>
          <div style="margin-bottom:6px">数据周的少量价格片段不参与 ε 的跨周收敛，但会被传入 <code style="color:var(--textd)">filterEightPredictions</code>，对本周 8 种候选模板做<span style="color:var(--text)">临时实时过滤</span>，缩小当前预测范围。</div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            典型情形：本周仅录入1-3天 / 最末一周<br>
            算法函数：<code>filterEightPredictions(eightPredictions, currentWeekPrices)</code><br>
            不影响 ε 收敛，仅用于本周模板候选的实时排除
          </div>
        </div>
      </div>

    </div>

    <div style="border:1px solid var(--border);background:var(--bg3);padding:14px 16px;font-family:var(--mono);font-size:13px;line-height:1.9;color:var(--textd)">
      <div style="color:var(--textb);margin-bottom:8px;font-size:14px">收敛路径示意</div>
      <div style="overflow-x:auto;white-space:nowrap">
        <span style="color:var(--accent)">W1[数据源]</span>
        <span style="color:var(--border)"> ─────→ </span>
        <span style="color:var(--teal)">W2[过滤+校准]</span>
        <span style="color:var(--border)"> ─────→ </span>
        <span style="color:var(--teal)">W3[验证]</span>
        <span style="color:var(--border)"> ─────→ </span>
        <span style="color:var(--textd)">W4[数据（本周）]</span>
      </div>
      <div style="margin-top:8px">
        W1 产生 8 组 ε 假设 → W2 保留匹配的子集（母本周同时为下一对出题） → W3 再次过滤取交集
        → 交集唯一时 <span style="color:var(--green)">ε LOCKED</span> → W4 的零散数据进一步锁定本周模板
      </div>
      <div style="margin-top:8px;color:var(--textd);font-size:12px">
        一般情况下，仅需一个完整母本周+第二周2天数据即可锁定ε
      </div>
      <div style="margin-top:8px;color:var(--textd);font-size:12px">
        注意：中间周（W2、W3）同时担任母本周和校验周，是收敛效率最高的数据。
        录入完整周数据（7天）能显著加速 ε 锁定。
      </div>
    </div>
  </div>`;

  container.innerHTML = html;
}

// ══════════════════════════════════════
function hasCompleteWeek(records, item) {
  return records
    .filter(r => r.item === item)
    .some(r => r.prices.every(p => p != null));
}

function analyzeItemSafe(records) {
  if (!records.length) return null;

  const completeRecs  = records.filter(r => r.prices.every(p => p != null));
  const nearComplRecs = records.filter(r => {
    const missing = r.prices.filter(p => p == null).length;
    return missing >= 1 && missing <= 2;
  });

  if (completeRecs.length === 0 && nearComplRecs.length === 0) {
    let res = analyzeItem(records);
    // 强制兜底：没有完整数据时阶段标记收敛中
    if (res && res.stage === 'locked') res.stage = 'pending';
    return res;
  }
  if (completeRecs.length === records.length) return analyzeItem(records);

  const fitRecs = completeRecs.length > 0 ? completeRecs : nearComplRecs;

  const fitResult  = analyzeItem(fitRecs);
  const fullResult = analyzeItem(records);

  const hasComplete = records.some(r => r.prices.every(p => p != null));

  let finalResult = null;
  if (!fullResult || fullResult.stage === 'first_week') finalResult = fitResult || analyzeItem(records);
  else if (!fitResult  || fitResult.stage  === 'first_week') finalResult = fullResult;
  else {
    const fitCand  = fitResult.candidateCount  ?? 8;
    const fullCand = fullResult.candidateCount ?? 8;
    finalResult = fullCand <= fitCand ? fullResult : fitResult;
  }

  if (!hasComplete && finalResult && finalResult.stage === 'locked') {
    finalResult.stage = 'pending';
  }

  return finalResult;
}
