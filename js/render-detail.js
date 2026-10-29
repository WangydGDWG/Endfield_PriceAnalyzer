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
// RENDER DETAIL 
// ══════════════════════════════════════
function renderDetail() {
  const container = document.getElementById('detail-body');
  
  let html = '';

  html += `<div class="detail-section">
    <div class="detail-section-title" data-en="ALGORITHM">§ 1 · 算法公式说明</div>
    <div class="formula-box">
      <div class="fml-comment">// 价格生成公式（YJ的小杯代码）</div>
      <div><span class="fml-key">P<sub>i</sub></span> = <span class="fml-val">T<sup>(n)</sup><sub>i</sub></span> × ( 1 + <span class="fml-val">X<sup>(n)</sup></span> × <span class="fml-key">ε<sub>i</sub></span> )</div>
      <div style="margin-top:8px" class="fml-comment">// ε 反推公式</div>
      <div><span class="fml-key">ε<sub>i</sub></span> = ( <span class="fml-val">P<sub>i</sub></span> / <span class="fml-val">T<sup>(n)</sup><sub>i</sub></span> − 1 ) / <span class="fml-val">X<sup>(n)</sup></span></div>
      <div style="margin-top:8px" class="fml-comment">// 残差评分（归一化均方值，越小越好）</div>
      <div>residual = <span class="fml-key">mean</span>( ( <span class="fml-val">P<sub>predicted</sub></span> − <span class="fml-val">P<sub>actual</sub></span> )<sup>2</sup> / <span class="fml-val">P<sub>actual</sub></span><sup>2</sup> )</div>
      <div style="margin-top:8px" class="fml-comment">// RMSE</div>
      <div>RMSE% = √<span class="fml-result">residual</span> × 100%</div>
    </div>
    <div class="def-grid">
      <div class="def-term">P<sub>i</sub></div><div class="def-desc">第 i 天的实际价格（玩家观测值）</div>
      <div class="def-term">T<sup>(n)</sup><sub>i</sub></div><div class="def-desc">第 n 号模板第 i 天的格点价格（全服固定），定义在 <code style="color:var(--accent)">TEMPLATES[i].grid</code></div>
      <div class="def-term">X<sup>(n)</sup></div><div class="def-desc">第 n 号模板的偏差系数（只取 4 / 5 / 6），定义在 <code style="color:var(--accent)">TEMPLATES[i].coeff</code></div>
      <div class="def-term">ε<sub>i</sub></div><div class="def-desc">标准化相对偏差向量的第 i 个分量，每人每物品初始化时固定，跨周不变</div>
      <div class="def-term">n</div><div class="def-desc">本周随机选取的模板编号（1–8），每周独立随机</div>
    </div>
  </div>`;

  html += `<div class="detail-section">
    <div class="detail-section-title" data-en="FUNCTIONS">§ 2 · 工具核心算法函数实现</div>
    
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
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 某个可用周的 8 种模板假设 → 8 组 ε 候选</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：一周的实测价格<br>
            <span style="color:var(--teal)">输出</span>：长度为 8 的数组，每项为 {srcTpl, epsilonVec}
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            遍历全部 8 个 TEMPLATES，对每个模板调用<br>
            &nbsp;&nbsp;<code style="color:var(--accent)">computeEpsilonVec(weekPrices, tpl)</code><br>
            假设"该周用的是模板 n"，反推出对应的 ε
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
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--green)">refineEpsilon(initialEps, weeks)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">一致周加权平均 ε</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 用所有一致周重新估计每一天的 ε</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：初始 ε + 全部可用周<br>
            <span style="color:var(--teal)">输出</span>：加权平均后的 ε，以及每轮的一致周/残差
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            对第 i 天：<br>
            &nbsp;&nbsp;<code style="color:var(--accent)">ε̄ᵢ = Σ (Tᵢ·Xᵢ)² · εᵢ / Σ (Tᵢ·Xᵢ)²</code><br>
            取整噪声被多周平均抵消，迭代至一致周集合稳定。
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
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 全局 ε 共识拟合，跨周验证并识别影子周</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：某物品的全部历史记录<br>
            <span style="color:var(--teal)">输出</span>：{ stage, epsilonVec, eightPredictions, weekFits, shadowWeeks, ... }
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            <span style="color:var(--accent)">若只有1周数据</span>：<br>
            &nbsp;&nbsp;返回 stage='first_week'，全部 64 组穷举<br>
            <span style="color:var(--accent)">若 ≥2 周</span>：<br>
            &nbsp;&nbsp;每周 × 8 模板 → 8 组 ε 假设<br>
            &nbsp;&nbsp;按“能解释的周数 / 支撑天数 / 残差”全局打分<br>
            &nbsp;&nbsp;对一致周按 (Tᵢ·Xᵢ)² 加权平均 ε，迭代至稳定<br>
            &nbsp;&nbsp;每天至少两周独立观测且解唯一 → stage='locked'<br>
            &nbsp;&nbsp;否则 stage='pending'，并给出候选与原因
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--red);background:var(--bg2);grid-column:1/-1">
        <div style="padding:10px 14px;border-bottom:1px solid var(--red);background:rgba(224,92,106,0.05);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--red)">classifyShadowWeek(eps, week)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">影子周定位与修正</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 用共识 ε 反推该周，逐天判断是否偏离预期</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">输入</span>：共识 ε + 某一周实测价格<br>
            <span style="color:var(--teal)">输出</span>：{ status, template, shadowDays, corrected }
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            对每个模板计算预测值 Qᵢ = Tᵢ × (1 + X × εᵢ)：<br>
            &nbsp;&nbsp;|Qᵢ − Pᵢ| ≤ 容差 → 干净天<br>
            &nbsp;&nbsp;|Qᵢ − Pᵢ| &gt; 容差 → 影子天，修正值取 Qᵢ<br>
            干净天不足以确认模板时标记 partial / unresolved，不硬判。
          </div>
        </div>
      </div>
      
      <div style="border:1px solid var(--border);background:var(--bg2);grid-column:1/-1">
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--bg3);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:bold;color:var(--textb)">analyzeItemSafe(records)</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--textd)">带缓存的安全入口（总览 / 分析 / 数据页调用）</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.8;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:8px;font-size:12px">// 同一份数据只计算一次</div>
          <div style="margin-bottom:6px">
            <span style="color:var(--accent)">缓存键</span>：物品 + 周次 + 7 天价格（排序后）<br>
            <span style="color:var(--green)">收益</span>：一次保存会触发总览、分析、数据页多次查询，缓存后只算一次。
          </div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            新版 analyzeItem 已内置数据提纯、唯一性校验与影子修正，
            不再需要“完整周 / 全量数据各跑一次、取候选更少者”的旧策略。
          </div>
        </div>
      </div>
      
    </div>
  </div>`;

  html += `<div class="detail-section">
    <div class="detail-section-title" data-en="TEMPLATES">§ 3 · 8个价格模板（格点数据）</div>
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
    <div class="detail-section-title" data-en="WEEK TYPES">§ 4 · 计算与校准原理 — 三种周类型详解</div>

    <div style="font-family:var(--mono);font-size:13px;color:var(--textd);line-height:1.8;margin-bottom:18px;padding:10px 14px;border-left:2px solid var(--border)">
      系统把所有历史周放在一起做"全局一致性拟合"：同一 ε 应该能解释每一周（每周只是换了模板）。
      每一条历史周数据在算法中扮演不同角色，以下三类反映了它对最终 ε 的贡献方式。
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:20px">

      <div style="border:1px solid var(--accent);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--accent);background:rgba(232,184,75,0.06);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:11px;padding:1px 7px;border:1px solid var(--accent);color:var(--accent)">候选周</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--accent)">Hypothesis Week</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.9;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:6px;font-size:12px">// 每个可用周 × 8 个模板 → 8 组 ε 假设</div>
          <div style="margin-bottom:6px">把该周实测价格代入反推公式，在 8 种模板假设下各得到一组 ε。
            这些假设不直接决定结果，而是交给全局打分器比较。</div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            需要：≥3 天有效数据<br>
            算法函数：<code style="color:var(--accent)">computeEpsilonVec()</code> → 8 组 ε<br>
            评估函数：<code style="color:var(--accent)">evaluateEpsilon()</code>
          </div>
        </div>
      </div>

      <div style="border:1px solid var(--teal);background:var(--bg2)">
        <div class="detail-fn-header" style="padding:10px 14px;border-bottom:1px solid var(--teal);background:rgba(91,207,250,0.05);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:11px;padding:1px 7px;border:1px solid var(--teal);color:var(--teal)">一致周</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--teal)">Consensus Week</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.9;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:6px;font-size:12px">// 能被同一个 ε 解释的周</div>
          <div style="margin-bottom:6px">一致周共享同一个 ε，系统按 (Tᵢ·Xᵢ)² 加权平均各天的 ε，
            抵消单周取整噪声。它们也是识别影子周的参照系。</div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            锁定条件：每天至少 2 周独立观测、解唯一<br>
            算法函数：<code style="color:var(--teal)">refineEpsilon()</code><br>
            校验函数：<code style="color:var(--teal)">sameEpsilon()</code>
          </div>
        </div>
      </div>

      <div style="border:1px solid var(--red);background:var(--bg2)">
        <div style="padding:10px 14px;border-bottom:1px solid var(--red);background:rgba(224,92,106,0.05);display:flex;align-items:center;gap:8px">
          <span style="font-family:var(--mono);font-size:11px;padding:1px 7px;border:1px solid var(--red);color:var(--red)">影子周</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--red)">Shadow Week</span>
        </div>
        <div style="padding:12px 14px;font-family:var(--mono);font-size:13px;line-height:1.9;color:var(--text)">
          <div style="color:var(--textd);margin-bottom:6px;font-size:12px">// 无法被共识 ε 完全解释的周</div>
          <div style="margin-bottom:6px">用共识 ε 反推该周，偏离超过容差的天标记为影子天。
            影子天不参与 ε 拟合与模板过滤，但会给出"实测 → 修正"对照。</div>
          <div style="color:var(--textd);font-size:12px;margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
            典型情形：超限修正 / 单天录错 / 数据冲突<br>
            算法函数：<code style="color:var(--red)">classifyShadowWeek()</code><br>
            输出：shadowDays / corrected / 低置信标记
          </div>
        </div>
      </div>

    </div>

    <div style="border:1px solid var(--border);background:var(--bg3);padding:14px 16px;font-family:var(--mono);font-size:13px;line-height:1.9;color:var(--textd)">
      <div style="color:var(--textb);margin-bottom:8px;font-size:14px">收敛路径示意</div>
      <div style="overflow-x:auto;white-space:nowrap">
        <span style="color:var(--accent)">W1..Wn[8n 组 ε 假设]</span>
        <span style="color:var(--border)"> ─────→ </span>
        <span style="color:var(--teal)">全局打分[一致周]</span>
        <span style="color:var(--border)"> ─────→ </span>
        <span style="color:var(--teal)">加权平均[共识 ε]</span>
        <span style="color:var(--border)"> ─────→ </span>
        <span style="color:var(--textd)">LOCKED / PENDING</span>
      </div>
      <div style="margin-top:8px">
        W1..Wn 各自 × 8 模板 → 8n 组 ε 假设 →
        按“解释周数 / 支撑天数 / 残差”全局选出共识 ε →
        一致周加权平均消除取整噪声 →
        每天都至少两周独立观测且解唯一时 <span style="color:var(--green)">ε LOCKED</span>
      </div>
      <div style="margin-top:8px;color:var(--textd);font-size:12px">
        一般情况下，两周完整且使用了不同模板即可锁定；只有一周完整 + 另一周数据时，
        系统会保留候选并提示补录，而不是给出可能错误的“锁定”。
      </div>
      <div style="margin-top:8px;color:var(--textd);font-size:12px">
        注意：同一模板重复出现的两周价格向量会完全相同，此时模板不可辨识，
        系统会标记为歧义而不是假装锁定。这正是旧版“换两周结果全变”的根源之一。
      </div>
    </div>
  </div>`;

  html += `<div class="detail-section">
    <div class="detail-section-title" data-en="SHADOW DATA">§ 5 · 影子数据判据与本工具的处理</div>

    <div style="font-family:var(--mono);font-size:13px;color:var(--text);line-height:1.9">
      <div style="color:var(--textd);font-size:12px;margin-bottom:8px">// 视频中的定义（价格向量 P₁、P₂）</div>
      <div style="padding:10px 14px;border-left:2px solid var(--red);background:var(--bg3);margin-bottom:14px">
        P₁ ~ P₂ ⇔ ∃m,n ∈ {1..8}，使 ε(P₁,m) = ε(P₂,n)<br>
        同偏差性具有自反性、对称性、传递性；不满足则为异偏差性。<br>
        约 1/5 的周之间是异偏差的，其中偏离预期的具体价格称为影子数据。
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:16px">
        <div style="border:1px solid var(--red);background:var(--bg2);padding:12px 14px">
          <div style="color:var(--red);font-weight:bold;margin-bottom:6px">影子判据 1</div>
          (P₁ ≁ P₂) ∧ (P₁ 不含影子) ⇒ P₂ 含影子
          <div style="color:var(--textd);font-size:12px;margin-top:6px">已知一个干净周，与它异偏差的周必含影子。</div>
        </div>
        <div style="border:1px solid var(--red);background:var(--bg2);padding:12px 14px">
          <div style="color:var(--red);font-weight:bold;margin-bottom:6px">影子判据 2</div>
          对于有偏差数据的两个 ε，更小的那个包含影子。
          <div style="color:var(--textd);font-size:12px;margin-top:6px">用于在两组偏差解之间判断哪一组被“超限修正”污染。</div>
        </div>
        <div style="border:1px solid var(--green);background:var(--bg2);padding:12px 14px">
          <div style="color:var(--green);font-weight:bold;margin-bottom:6px">不含影子的判定</div>
          (P₁ ~ P₂) ∧ (P₁ ≠ P₂) ⇒ P₁、P₂ 不含影子
          <div style="color:var(--textd);font-size:12px;margin-top:6px">两个不同价格向量若能用同一 ε 解释，则都不含影子。</div>
        </div>
      </div>

      <div style="color:var(--textd);font-size:12px;margin-bottom:8px">// 工具中的落地方式</div>
      <div style="padding:10px 14px;background:var(--bg3);border-left:2px solid var(--accent);line-height:1.9">
        1. 先用全局共识找出“一致周”，它们共享同一个 ε，视为干净周。<br>
        2. 对每个不一致周，用共识 ε 反推 8 个模板的应有价格。<br>
        3. 能被某个模板解释的天 = 干净天；偏离超过容差的天 = 影子天。<br>
        4. 影子天不参与 ε 拟合与模板过滤，并给出“实测 → 修正”对照。<br>
        5. 原始记录永不改写，修正只用于分析与预测。
      </div>

      <div style="margin-top:14px;padding:10px 14px;border:1px dashed var(--border);color:var(--textd);font-size:12px;line-height:1.8">
        <strong style="color:var(--accent)">边界说明：</strong>
        如果某个影子天只被一条记录观测到，没有任何第二周可以对照，它在数学上不可判别；
        系统不会把它硬标成影子，而会通过“每天至少两周独立观测”的锁定条件避免污染 ε。
        同理，同一模板重复出现的两周价格完全相同，模板不可辨识，系统会保留候选而不是错误锁定。
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

// analyzeItemSafe 已移至 predict-engine.js：
// 新版 analyzeItem 内置数据提纯、全局 ε 共识、唯一性校验与影子修正，
// 不再需要“完整周 / 全量数据各跑一次、取候选更少者”的旧策略。
