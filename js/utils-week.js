// ══════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════
const TEMPLATES = [
  {id:1,name:'逐渐上升',  grid:[1600,2000,2200,2600,3000,3200,3400],coeff:5},
  {id:2,name:'逐渐下降',  grid:[2200,2000,1800,1700,1500,1200,1100],coeff:5},
  {id:3,name:'先降后升',  grid:[2400,2000,1600,1400,1600,2000,2200],coeff:5},
  {id:4,name:'先升后降',  grid:[1800,2000,2600,3000,3400,2600,2000],coeff:5},
  {id:5,name:'奇高小震',  grid:[2000,1600,2400,1600,2400,1600,2400],coeff:4},
  {id:6,name:'偶高小震',  grid:[2000,2400,1600,2400,1600,2400,1600],coeff:4},
  {id:7,name:'奇高大震',  grid:[2200,1400,3000,1200,3600,1000,4000],coeff:6},
  {id:8,name:'偶高大震',  grid:[2200,3000,1600,3600,1200,4000,1000],coeff:6},
];
const DAYS = ['周一','周二','周三','周四','周五','周六','周日'];
const MATCH_THRESHOLD = 0.003;

// ══════════════════════════════════════
// WEEK LABELS
// ══════════════════════════════════════
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function getMondayOfWeek(offset) {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1) + offset * 7);
  monday.setHours(0,0,0,0);
  return monday;
}
function weekLabel(offset) {
  const mon = getMondayOfWeek(offset);
  const y = mon.getFullYear();
  const m = mon.getMonth() + 1;
  const d = mon.getDate();
  const wn = getWeekNumber(mon);
  return `${y}-${m}-${d}（第${wn}周）`;
}
function buildWeekOptions() {
  const opts = [];
  for (let i = 0; i >= -4; i--) opts.push(weekLabel(i));
  return opts;
}
function populateWeekSelect(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const opts = buildWeekOptions();
  sel.innerHTML = '<option value="">-- 选择周次 --</option>' + opts.map(o => `<option value="${o}">${o}</option>`).join('');
}
