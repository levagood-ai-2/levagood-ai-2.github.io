// The deck radio, in the park. The same real stations and the same saved station and volume as the pool page.
// It is off when you arrive. Tap it on, and it gets louder as you walk up to it and fades as you walk away.
export function createParkRadio(o){
  const STATIONS = [
    {id: 'wnic', label: '100.3 WNIC', url: 'https://stream.revma.ihrhls.com/zc1153'},
    {id: 'klove', label: '102.7 K-LOVE', url: 'https://maestro.emfcdn.com/stream_for/k-love/web/aac'},
    {id: 'air1', label: 'Air1', url: 'https://maestro.emfcdn.com/stream_for/air1/web/aac'},
    {id: 'moody', label: 'Moody Radio', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WMBIFM.mp3'},
    {id: 'afr', label: 'American Family Radio', url: 'https://mediaserver3.afa.net:8443/talk.mp3'}
  ];
  const KEY = 'levagood-radio-v1'; let prefs = {station: 'wnic', vol: 0.7};
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') prefs = Object.assign(prefs, s); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} };
  let idx = Math.max(0, STATIONS.findIndex(s => s.id === prefs.station)), on = false, near = 1;
  prefs.vol = Math.max(0, Math.min(1, +prefs.vol || 0));
  const audio = new Audio(); audio.preload = 'none';

  const css = document.createElement('style');
  css.textContent = '#pk-radio{position:fixed;right:12px;top:56px;z-index:5;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:12px;background:rgba(14,18,30,.78);color:#fff;font:600 12px/1 "Inter Tight",system-ui,sans-serif;backdrop-filter:blur(6px)}'
    + '#pk-radio button{appearance:none;border:0;border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font:700 13px/1 inherit;min-width:30px;height:30px;padding:0 8px;cursor:pointer}'
    + '#pk-radio button:hover{background:rgba(255,255,255,.22)}#pk-radio .on{background:#2FAE5A}#pk-radio .lbl{min-width:92px;text-align:center;opacity:.9}'
    + '#pk-radio.off .lbl,#pk-radio.off .st,#pk-radio.off .vl{display:none}'
    + '@media (max-width:700px){#pk-radio{right:8px}#pk-radio .lbl{min-width:70px}}';
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'pk-radio'; el.className = 'off'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Deck radio');
  el.innerHTML = '<button class="pw" aria-pressed="false" aria-label="Deck radio power">Radio</button><button class="st" data-d="-1" aria-label="Station down">&lsaquo;</button><span class="lbl"></span><button class="st" data-d="1" aria-label="Station up">&rsaquo;</button><button class="vl" data-v="-0.1" aria-label="Volume down">&minus;</button><button class="vl" data-v="0.1" aria-label="Volume up">+</button>';
  document.body.appendChild(el);
  const lbl = el.querySelector('.lbl'), pw = el.querySelector('.pw');
  const level = () => { audio.volume = Math.max(0, Math.min(1, prefs.vol * near)); };
  function paint(msg){ el.classList.toggle('off', !on); pw.classList.toggle('on', on); pw.setAttribute('aria-pressed', String(on)); lbl.textContent = msg || STATIONS[idx].label; }
  function play(){ audio.src = STATIONS[idx].url; level(); paint('Tuning…'); const p = audio.play(); if (p && p.catch) p.catch(() => { if (on) paint('No signal'); }); }
  function stop(){ audio.pause(); audio.removeAttribute('src'); audio.load(); }
  audio.addEventListener('playing', () => { if (on) paint(); });
  audio.addEventListener('error', () => { if (on) paint('No signal'); });
  pw.addEventListener('click', () => { on = !on; if (on) play(); else stop(); paint(); });
  el.querySelectorAll('.st').forEach(b => b.addEventListener('click', () => { idx = (idx + (+b.dataset.d) + STATIONS.length) % STATIONS.length; prefs.station = STATIONS[idx].id; save(); if (on) play(); else paint(); }));
  el.querySelectorAll('.vl').forEach(b => b.addEventListener('click', () => { prefs.vol = Math.round(Math.max(0, Math.min(1, prefs.vol + (+b.dataset.v))) * 10) / 10; save(); level(); }));
  for (const t of ['keydown', 'keyup', 'pointerdown']) el.addEventListener(t, e => e.stopPropagation());   // the radio's buttons are not the walking keys
  // walk away and it fades; it never goes fully silent on the deck, and it is quiet from across the park
  setInterval(() => { if (!on || !o.where) return; const w = o.where(), d = Math.hypot(w[0] - o.pos[0], w[1] - o.pos[1]); near = Math.max(0.12, Math.min(1, 1.15 - d / 45)); level(); }, 400);
  paint();
  return {get on(){ return on; }, el, stations: STATIONS};
}
