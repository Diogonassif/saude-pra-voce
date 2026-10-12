// Motor de animação por tempo: frame(t) desenha o vídeo no instante t (segundos).
// .scene[data-s][data-e]  · filhos [data-in] (atraso dentro da cena) · [data-type] (digita o texto) · [data-count] (conta até o valor)
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
const back = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const clamp = (x) => Math.max(0, Math.min(1, x));
const TOTAL = +document.body.dataset.total;
const brl = (v, d = 2) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
document.querySelectorAll('[data-type]').forEach((el) => { el.dataset.full = el.textContent; el.textContent = ''; });

function frame(t) {
  document.querySelector('.bar i').style.width = (clamp(t / TOTAL) * 100) + '%';
  document.querySelectorAll('.scene').forEach((sc) => {
    const s = +sc.dataset.s, e = +sc.dataset.e, l = t - s;
    if (t < s - 0.01 || t > e + 0.01) { sc.style.opacity = 0; return; }
    const fin = clamp(l / 0.45), fout = clamp((e - t) / 0.45);
    const o = Math.min(ease(fin), sc.dataset.last ? 1 : ease(fout));
    sc.style.opacity = o;
    sc.style.transform = `translateY(${(1 - ease(fin)) * 60 - (1 - (sc.dataset.last ? 1 : ease(fout))) * 60}px)`;
    sc.querySelectorAll('[data-in]').forEach((el) => {
      const p = clamp((l - +el.dataset.in) / (+el.dataset.dur || 0.6));
      const k = el.dataset.fx || 'up';
      el.style.opacity = ease(p);
      if (k === 'up') el.style.transform = `translateY(${(1 - ease(p)) * 50}px)`;
      if (k === 'pop') el.style.transform = `scale(${0.6 + 0.4 * back(p)})`;
      if (k === 'left') el.style.transform = `translateX(${(1 - ease(p)) * -120}px)`;
      if (k === 'right') el.style.transform = `translateX(${(1 - ease(p)) * 120}px)`;
      if (k === 'drop') el.style.transform = `translateY(${(1 - back(p)) * -160}px)`;
    });
    sc.querySelectorAll('[data-type]').forEach((el) => {
      const a = +el.dataset.type, full = el.dataset.full, sp = +el.dataset.speed || 0.09;
      const n = Math.max(0, Math.min(full.length, Math.floor((l - a) / sp)));
      el.textContent = full.slice(0, n);
      el.style.setProperty('--cur', l > a - 0.3 && n < full.length + 6 && Math.floor(l * 2.4) % 2 === 0 ? 1 : 0);
    });
    sc.querySelectorAll('[data-count]').forEach((el) => {
      const a = +el.dataset.at, d = +el.dataset.d || 1.2, v = +el.dataset.count;
      el.textContent = brl(v * ease(clamp((l - a) / d)), +el.dataset.dec || 0);
    });
    sc.querySelectorAll('[data-on]').forEach((el) => el.classList.toggle('on', l >= +el.dataset.on));
  });
}
window.frame = frame;
