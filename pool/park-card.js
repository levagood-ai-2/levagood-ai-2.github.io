// Your crew card, in the park. The same points, swim levels and badges as the pool page.
// The park keeps a ledger of what you earn here, in its own save. The pool page adds that to the card the next time it opens.
// The park never writes the card itself; it only reads it, so the number you see here is the number you'll see there.
export function createCard(o){
  const LC = window.LevaCard, {save, store} = o, W = LC.PARK;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const sfx = n => { if (o.sfx) o.sfx(n); };
  save.pts = Math.max(0, +save.pts || 0); save.badges = save.badges || {};
  save.n = Object.assign({met: {}, fives: 0, jumps: {}, roof: 0, roofWins: 0, fetch: 0, pets: 0, lists: 0, talks: 0}, save.n || {});
  (save.jumpsDone || []).forEach(s => { save.n.jumps[s] = 1; });   // jumps you'd already done before there was a card
  let DK = LC.deck(), ready = false, open = false;
  const BADGE = {}, SHOWN = LC.PARK_BADGES.concat(LC.SHARED_BADGES); SHOWN.forEach(b => { BADGE[b.id] = b; });
  const has = id => !!(save.badges[id] || DK.badges[id]);
  const total = () => DK.pts + Math.max(0, save.pts - DK.seen);   // the card, plus whatever the park has that the card hasn't picked up yet
  const level = () => LC.levelOf(total());
  function day(){ if (!save.daily || save.daily.day !== LC.today()) save.daily = {day: LC.today(), social: 0, play: 0, jump: 0, met: {}}; if (!save.daily.met) save.daily.met = {}; return save.daily; }
  function capped(kind, pts){ const d = day(), had = +d[kind] || 0, give = Math.max(0, Math.min(pts, W.cap[kind] - had)); d[kind] = had + give; return give; }

  // ---- what you see: little notes at the top when something happens ----
  const css = document.createElement('style'); css.textContent = `
    .px-icon{image-rendering:pixelated;image-rendering:crisp-edges;display:block}
    .notes{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:8;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:max-content;max-width:calc(100vw - 28px)}
    body.rb .notes{top:126px}
    .note{display:flex;align-items:center;gap:10px;padding:9px 18px 9px 10px;border-radius:999px;background:var(--ink);color:#fff;box-shadow:0 10px 30px rgba(20,30,50,.25);font:800 15px/1.25 var(--font);animation:noteIn .3s cubic-bezier(.2,.9,.3,1.25);transition:opacity .35s,transform .35s;max-width:100%}
    .note.out{opacity:0;transform:translateY(-8px)}
    .note .px-icon{width:30px;height:30px;flex:none}
    .note .nt{display:flex;flex-direction:column;gap:2px;min-width:0}.note .nt i{font:800 10px/1 var(--font);letter-spacing:.08em;text-transform:uppercase;font-style:normal;opacity:.72}.note .nt b{font-weight:800}
    .note em{font-style:normal;font-weight:900;color:#ffd84a;margin-left:2px;white-space:nowrap}
    .note.plain{padding:11px 20px;text-align:center}
    .note.find{background:var(--pink);padding:11px 20px}.note.find em{color:#fff}
    .note.hint{background:var(--card);color:var(--ink);padding:12px 20px;text-align:center;font-size:16px;box-shadow:0 6px 24px rgba(20,30,50,.16)}
    .note.gold{box-shadow:0 0 0 2px #ffd84a,0 10px 30px rgba(20,30,50,.3)}
    .note.big{padding:12px 24px 12px 12px;font-size:19px;box-shadow:0 0 0 3px var(--pink),0 14px 40px rgba(20,30,50,.35)}.note.big .px-icon{width:44px;height:44px}
    @keyframes noteIn{from{opacity:0;transform:translateY(-12px) scale(.96)}to{opacity:1;transform:none}}
    .card-chip{gap:9px;padding:0 15px 0 8px;position:relative;overflow:hidden;text-align:left}
    .card-chip .px-icon{width:30px;height:30px;flex:none}
    .card-chip .cc-t{display:flex;flex-direction:column;gap:3px}.card-chip .cc-t b{font:900 14px/1 var(--font);white-space:nowrap}.card-chip .cc-t i{font:700 11px/1 var(--font);color:var(--mute);font-style:normal;white-space:nowrap}
    .card-chip .cc-m{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(27,29,36,.08)}.card-chip .cc-m u{display:block;height:100%;background:var(--pink);width:0;transition:width .6s}
    .card-chip.bump{animation:chipBump .5s}
    .card-chip .cc-dot{position:absolute;top:5px;left:31px;width:10px;height:10px;border-radius:50%;background:var(--pink);box-shadow:0 0 0 2px #fff;display:none}.card-chip.todo .cc-dot{display:block}
    @keyframes chipBump{30%{transform:scale(1.07)}}
    @media (max-width:700px){.card-chip{padding:0 12px 0 6px;gap:7px}.card-chip .cc-t i{display:none}.card-chip .px-icon{width:26px;height:26px}.card-chip .cc-dot{left:25px}}
    #card .cc-level{display:flex;align-items:center;gap:14px;margin:2px 0 10px}#card .cc-level .px-icon{width:60px;height:60px;flex:none}
    #card .cc-level b{display:block;font:900 20px/1.1 var(--font)}#card .cc-level span{display:block;margin-top:4px;color:var(--mute);font-weight:700}
    #card .cc-meter{height:12px;border-radius:999px;background:rgba(27,29,36,.08);overflow:hidden}#card .cc-meter i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#FF2E88,#ff7ab3);transition:width .6s}
    #card h4{display:flex;justify-content:space-between;align-items:baseline}#card h4 span{letter-spacing:0;text-transform:none;font-weight:700}
    #card .cc-jobs{display:grid;gap:6px}#card .cc-jobs li{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:9px 12px;border-radius:12px;background:rgba(27,29,36,.05)}
    #card .cc-jobs u{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(27,29,36,.25);display:grid;place-items:center;text-decoration:none}
    #card .cc-jobs li.done{background:rgba(63,163,77,.13)}#card .cc-jobs li.done u{background:#3fa34d;box-shadow:none}
    #card .cc-jobs li.done u::after{content:"";width:9px;height:5px;border-left:2.5px solid #fff;border-bottom:2.5px solid #fff;transform:rotate(-45deg) translate(1px,-1px)}
    #card .cc-jobs span em{font-style:normal;color:var(--mute);font-weight:700}
    #card .cc-jobs li>em{font-style:normal;font-weight:900;color:var(--pink)}#card .cc-jobs li.done>em{color:#2c7a39}
    #card .cc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#card .cc-stats div{padding:10px 6px;border-radius:12px;background:rgba(34,211,238,.11);text-align:center}
    #card .cc-stats b{display:block;font:900 17px/1 var(--font)}#card .cc-stats span{display:block;margin-top:4px;font:700 11px/1.2 var(--font);color:var(--mute)}
    #card .cc-badges{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    #card .cc-badge{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:12px;background:rgba(27,29,36,.05);text-align:center;font:800 11px/1.2 var(--font);border:0;color:var(--ink);cursor:pointer}
    #card .cc-badge .px-icon{width:36px;height:36px}
    #card .cc-badge.locked{color:var(--mute)}#card .cc-badge.locked .px-icon{filter:grayscale(1);opacity:.35}
    #card .cc-badge.new{box-shadow:0 0 0 2px #ffd84a}#card .cc-badge.sel{background:rgba(255,46,136,.12)}
    #card .cc-about{min-height:36px;margin:8px 0 0;padding:9px 12px;border-radius:12px;background:rgba(27,29,36,.05);font:700 13px/1.35 var(--font)}
    #card .cc-foot{margin:14px 0 2px}#card .cc-foot a{color:var(--pink);font-weight:800}`;
  document.head.appendChild(css);
  const notes = el('div', 'notes'); notes.setAttribute('role', 'status'); notes.setAttribute('aria-live', 'polite'); document.body.appendChild(notes);
  // a note: {kind, title, pts, icon, tone, secs}. tone: plain, find, hint, gold, big.
  function note(n){ const secs = n.secs || 3.4, d = el('div', 'note' + (n.tone ? ' ' + n.tone : (n.icon || n.kind ? '' : ' plain'))); if (n.icon) d.appendChild(LC.icon(n.icon));
    const t = el('span', 'nt'); if (n.kind) t.appendChild(el('i', null, n.kind)); t.appendChild(el('b', null, n.title)); d.appendChild(t); if (n.pts) d.appendChild(el('em', null, '+' + n.pts));
    if (n.tone === 'hint'){ [...notes.querySelectorAll('.note.hint')].forEach(x => x.remove()); } notes.appendChild(d); while (notes.children.length > 4) notes.firstChild.remove();
    setTimeout(() => d.classList.add('out'), secs * 1000); setTimeout(() => d.remove(), secs * 1000 + 400); return d; }

  // ---- points, levels, badges ----
  function award(pts){ if (!pts) return; const was = level(); save.pts += pts; store(); const now = level(); refresh(true); if (now > was) levelUp(now); }
  function levelUp(now){ const n = now + 1; note({kind: 'Level ' + n, title: LC.LEVELS[now][0], icon: 'cap' + n, tone: 'big', secs: 5}); sfx('level'); if (o.onLevel) o.onLevel(n, LC.LEVELS[now][0]); }
  function badge(id){ const b = BADGE[id]; if (!b || has(id)) return false; save.badges[id] = Date.now(); save.fresh = id; note({kind: 'Badge', title: b.name, pts: b.pts, icon: b.icon, tone: 'gold', secs: 4.6}); sfx('badge'); award(b.pts); return true; }

  // ---- today at the park: three things to do, the same three for everybody that day ----
  const JOBS = {
    jump3: {g: 'a', text: 'Jump in the pool 3 times.', need: 3},
    high: {g: 'a', text: 'Go off a high dive.', need: 1},
    star: {g: 'a', text: 'Find a star.', need: 1, ok: () => !o.starsLeft || o.starsLeft() > 0},
    hello: {g: 'b', text: 'Say hi to 3 of the crew.', need: 3},
    five: {g: 'b', text: 'Get a high five from Em or Mel.', need: 1},
    talk: {g: 'b', text: 'Ask somebody a question.', need: 1},
    inside: {g: 'b', text: 'Look inside how somebody thinks.', need: 1},
    roofball: {g: 'c', text: 'Play a game of roof ball.', need: 1},
    fetch: {g: 'c', text: 'Throw a toy for Ari or Luke.', need: 1},
    pet: {g: 'c', text: 'Pet a dog.', need: 1},
    guard: {g: 'c', text: 'Wave at a lifeguard.', need: 1}
  };
  function newList(){ const rnd = LC.seeded('park list ' + LC.today());
    const ids = ['a', 'b', 'c'].map(g => { const all = Object.keys(JOBS).filter(id => JOBS[id].g === g), pickFrom = all.filter(id => !JOBS[id].ok || JOBS[id].ok()), first = all[Math.floor(rnd() * all.length)]; return pickFrom.includes(first) ? first : pickFrom[0]; });
    save.list = {day: LC.today(), jobs: ids.map(id => ({id, n: 0})), done: false}; store(); }
  function listNow(){ if (!save.list || save.list.day !== LC.today() || !save.list.jobs.every(j => JOBS[j.id])) newList(); return save.list; }
  function job(id, n = 1){ if (!ready) return; const L = listNow(); let changed = false;
    L.jobs.forEach(j => { const need = JOBS[j.id].need; if (j.id !== id || j.n >= need) return; j.n = Math.min(need, j.n + n); changed = true;
      if (j.n >= need){ note({kind: 'Park list', title: JOBS[j.id].text.replace(/\.$/, ''), pts: W.job, icon: 'clip'}); sfx('good'); award(W.job); } });
    if (!L.done && L.jobs.every(j => j.n >= JOBS[j.id].need)){ L.done = true; save.n.lists++; note({kind: 'Park list done', title: "That's the whole list", pts: W.list, icon: 'tree', tone: 'gold', secs: 4.6}); award(W.list); badge('parklist'); }
    if (changed){ store(); refresh(); } }

  // ---- the park tells the card what happened; what it's worth is decided here ----
  function credit(kind, v){ const d = day();
    if (kind === 'hello'){ if (!d.met[v]){ d.met[v] = 1; award(capped('social', W.hello)); job('hello'); } if (!save.n.met[v]){ save.n.met[v] = 1; if (o.crewIds && o.crewIds().every(id => save.n.met[id])) badge('crew'); } }
    else if (kind === 'five'){ save.n.fives++; award(capped('social', W.five)); badge('highfive'); job('five'); }
    else if (kind === 'guard') job('guard');
    else if (kind === 'talk'){ save.n.talks++; award(capped('social', W.talk)); job('talk'); }
    else if (kind === 'inside') job('inside');
    else if (kind === 'pet'){ save.n.pets++; award(capped('social', W.pet)); job('pet'); }
    else if (kind === 'fetch'){ save.n.fetch++; award(capped('social', W.fetch)); badge('fetch'); job('fetch'); }
    else if (kind === 'star'){ sfx('star'); note({kind: 'Star', title: v.have + ' of ' + v.total, pts: W.star, icon: 'star'}); award(W.star); job('star'); if (v.left === 0) badge('stars'); }
    else if (kind === 'found'){ award(v.pts); if (v.left === 0) badge('mind'); }
    else if (kind === 'jump'){ job('jump3'); if (v.high) job('high'); award(capped('jump', W.jump)); const all = o.jumpStyles ? o.jumpStyles() : [];
      if (v.style && all.includes(v.style) && !save.n.jumps[v.style]){ save.n.jumps[v.style] = 1; note({kind: 'New jump', title: v.label || v.style, pts: W.newJump, icon: 'splash'}); award(W.newJump); if (all.every(s => save.n.jumps[s])) badge('jumps'); } }
    else if (kind === 'roofball' && v){
      if (v.kind === 'rally'){ if (+v.rally >= 10) badge('rally'); }
      else if (v.kind === 'game'){ const full = +v.to >= 15, won = !!v.won; save.n.roof++; if (won) save.n.roofWins++; d.roof = (+d.roof || 0) + 1; job('roofball');
        const p = capped('play', won ? (full ? W.roofWon : W.roofQuickWon) : (full ? W.roofPlayed : W.roofQuickPlayed));
        if (p){ note({kind: 'Roof ball', title: won ? `You won, ${v.you} to ${v.them}` : `Good game, ${v.you} to ${v.them}`, pts: p, icon: 'roof'}); award(p); } if (won) badge('roofball'); } }
    store(); refresh(); }

  // ---- the chip in the bar, and the card behind it ----
  const chip = el('button', 'pill card-chip'); chip.type = 'button'; chip.id = 'card-chip'; chip.setAttribute('aria-haspopup', 'dialog'); chip.setAttribute('aria-expanded', 'false');
  const chipIcon = el('span'), chipT = el('span', 'cc-t'), chipB = el('b'), chipI = el('i'), chipM = el('span', 'cc-m'), chipU = el('u'); chipT.appendChild(chipB); chipT.appendChild(chipI); chipM.appendChild(chipU);
  chip.appendChild(chipIcon); chip.appendChild(chipT); chip.appendChild(chipM); chip.appendChild(el('span', 'cc-dot'));
  const bar = document.querySelector('.bar'), logo = bar && bar.querySelector('.logo'); if (bar) bar.insertBefore(chip, logo ? logo.nextSibling : bar.firstChild);
  const panel = el('aside', 'inside'); panel.id = 'card'; panel.setAttribute('aria-label', 'Your crew card'); panel.innerHTML = '<header><b>Crew card</b><button type="button" id="card-x" aria-label="Close">✕</button></header><div class="scroll" id="card-body"></div>'; document.body.appendChild(panel);
  const body = panel.querySelector('#card-body'); let capNow = 0, aboutId = null;
  function refresh(bump){ const t = total(), li = LC.levelOf(t), L = LC.LEVELS[li], nx = LC.LEVELS[li + 1];
    if (capNow !== li + 1){ capNow = li + 1; chipIcon.innerHTML = ''; chipIcon.appendChild(LC.icon('cap' + capNow)); }
    chipB.textContent = 'Level ' + (li + 1); chipI.textContent = L[0] + ' · ' + t + (t === 1 ? ' pt' : ' pts'); chipU.style.width = (nx ? Math.max(3, Math.round((t - L[1]) / (nx[1] - L[1]) * 100)) : 100) + '%';
    chip.setAttribute('aria-label', `Your crew card. Level ${li + 1}, ${L[0]}, ${t} points.`);
    chip.classList.toggle('todo', ready && !listNow().done && !open);
    if (bump){ chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump'); }
    if (open) render(); }
  function render(){ const t = total(), li = LC.levelOf(t), L = LC.LEVELS[li], nx = LC.LEVELS[li + 1], list = listNow(), st = o.stats ? o.stats() : {};
    body.innerHTML = ''; const lv = el('div', 'cc-level'); lv.appendChild(LC.icon('cap' + (li + 1))); const lt = el('div'); lt.appendChild(el('b', null, `Level ${li + 1}: ${L[0]}`)); lt.appendChild(el('span', null, t + (t === 1 ? ' point' : ' points') + (DK.team ? ' · Swim Team' : ''))); lv.appendChild(lt); body.appendChild(lv);
    const m = el('div', 'cc-meter'), mi = el('i'); mi.style.width = (nx ? Math.round((t - L[1]) / (nx[1] - L[1]) * 100) : 100) + '%'; m.appendChild(mi); body.appendChild(m);
    body.appendChild(el('p', 'small', nx ? `${nx[1] - t} more to Level ${li + 2}: ${nx[0]}.` : 'Top level. The Swim Team tryout is on the pool page.'));
    const h1 = el('h4', null, 'Today at the park'); h1.appendChild(el('span', null, list.jobs.filter(j => j.n >= JOBS[j.id].need).length + ' of 3')); body.appendChild(h1);
    const ul = el('ul', 'cc-jobs'); list.jobs.forEach(j => { const J = JOBS[j.id], fin = j.n >= J.need, li2 = el('li', fin ? 'done' : ''); li2.appendChild(el('u')); const s = el('span', null, J.text); if (J.need > 1 && !fin) s.appendChild(el('em', null, ` ${j.n} of ${J.need}`)); li2.appendChild(s); li2.appendChild(el('em', null, '+' + W.job)); ul.appendChild(li2); }); body.appendChild(ul);
    body.appendChild(el('p', 'small', list.done ? 'All three done. A new list comes tomorrow.' : `Finish all three for ${W.list} more.`));
    body.appendChild(el('h4', null, 'Around the park')); const sg = el('div', 'cc-stats');
    [[`${st.stars || 0} / ${st.starTotal || 0}`, 'stars'], [`${st.found || 0} / ${st.foundTotal || 0}`, 'discoveries'], [String(save.n.roofWins || 0), save.n.roofWins === 1 ? 'roof ball win' : 'roof ball wins']].forEach(([b, s]) => { const d = el('div'); d.appendChild(el('b', null, b)); d.appendChild(el('span', null, s)); sg.appendChild(d); }); body.appendChild(sg);
    const h2 = el('h4', null, 'Park badges'); h2.appendChild(el('span', null, SHOWN.filter(b => has(b.id)).length + ' of ' + SHOWN.length)); body.appendChild(h2);
    const bg = el('div', 'cc-badges'), about = el('p', 'cc-about', 'Tap a badge to see how to earn it.');
    SHOWN.forEach(b => { const got = has(b.id), tile = el('button', 'cc-badge' + (got ? '' : ' locked') + (save.fresh === b.id ? ' new' : '') + (aboutId === b.id ? ' sel' : '')); tile.type = 'button'; tile.appendChild(LC.icon(b.icon)); tile.appendChild(el('span', null, b.name)); tile.setAttribute('aria-label', `${b.name}. ${got ? 'Earned.' : 'Not yet.'} ${b.desc}`);
      tile.onclick = () => { aboutId = b.id; bg.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); tile.classList.add('sel'); about.textContent = `${b.name}: ${b.desc} ${got ? 'You have it.' : 'Worth ' + b.pts + '.'}`; }; if (aboutId === b.id) about.textContent = `${b.name}: ${b.desc} ${got ? 'You have it.' : 'Worth ' + b.pts + '.'}`; bg.appendChild(tile); });
    body.appendChild(bg); body.appendChild(about);
    const foot = el('p', 'small cc-foot'); foot.appendChild(document.createTextNode('These are the same points, swim levels and badges as the pool page. ')); const a = el('a', null, 'Open the pool page'); a.href = 'pool.html'; foot.appendChild(a); foot.appendChild(document.createTextNode(' to see the whole card.')); body.appendChild(foot); }
  function show(on){ if (on === open) return; open = on; panel.classList.toggle('on', on); chip.setAttribute('aria-expanded', on); if (on){ if (o.onOpen) o.onOpen(); DK = LC.deck(); render(); chip.classList.remove('todo'); panel.querySelector('#card-x').focus({preventScroll: true}); } else { save.fresh = null; if (o.onClose) o.onClose(); refresh(); } }
  chip.addEventListener('click', () => show(!open)); panel.querySelector('#card-x').addEventListener('click', () => show(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && open) show(false); });
  // the pool page changed the card in another tab, or you came back to this one
  addEventListener('storage', e => { if (e.key === LC.DECK_KEY){ DK = LC.deck(); refresh(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden){ DK = LC.deck(); refresh(); } });
  refresh();

  return {note, award, badge, credit, job, refresh, total, level, has, JOBS, get open(){ return open; }, show, close: () => show(false),
    // you just pressed Play: once a day, a word that there's a list
    hello(){ if (!ready) return; const L = listNow(); if (L.told || L.done) return; L.told = true; store(); note({kind: 'Today at the park', title: 'Three things to do. They are on your crew card.', icon: 'clip', secs: 5.5}); },
    // the park is built: write up today's list, and hand out anything you'd already earned before badges existed
    ready(){ ready = true; listNow(); const st = o.stats ? o.stats() : {}; if (st.starTotal && st.stars >= st.starTotal) badge('stars'); if (st.foundTotal && st.found >= st.foundTotal) badge('mind'); const all = o.jumpStyles ? o.jumpStyles() : []; if (all.length && all.every(s => save.n.jumps[s])) badge('jumps'); store(); refresh(); },
    list: () => listNow()};
}
