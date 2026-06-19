// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
document.querySelectorAll('.day-inp').forEach(inp => {
  const day = parseInt(inp.dataset.day);

  inp.addEventListener('input', () => {
    inp.classList.remove('err');
    inp.classList.toggle('filled', inp.value.trim() !== '');
  });

  inp.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = inp.value.trim().replace(/[^\d.]/g,'');
    if (v === '') {
      focusDay(day + 1);
      return;
    }
    const ok = saveSingleDay(day, v);
    if (ok) {
      inp.classList.add('filled'); inp.classList.remove('err');
      focusDay(day + 1);
    } else {
      inp.classList.add('err');
    }
  });
});

function focusDay(dayIndex) {
  const inputs = document.querySelectorAll('.day-inp');
  if (dayIndex >= inputs.length) return;
  const target = inputs[dayIndex];
  target.focus();
  target.select();
}

document.getElementById('modal-name').addEventListener('keydown', e => {
  if (e.key==='Enter') confirmAddAccount();
});

document.getElementById('inp-week').addEventListener('change', onInpWeekChange);
document.getElementById('inp-item').addEventListener('change', onInpItemChange);

renderHome();
