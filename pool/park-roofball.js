// Roof ball, in the park, at the boys' bathhouse where it was played.
// You hit or kick a playground ball up onto the roof. The roof slopes down toward the deck, so the ball comes back.
// It can bounce anywhere on the slope, but if it goes over the peak it's gone and you lose the point. Coming back it can
// bounce on the deck one time. Then the other player has to hit or kick it back up. Same rules and the same feel as the
// game on the pool page (pool-roofball.js); here it is played in meters, with real people, a real roof and a real ball.
import * as THREE from 'three';

export function createRoofBall(o){
  const {scene, camera, X, Z} = o;
  // ---- the court, in meters. x runs east toward the bathhouse wall, y is up. Everything is played in the plane z = ZC. ----
  const WALLX = X(420), XE = WALLX - 0.25, ZC = Z(262.5), GY = 0.047, R = 0.16, G = 22, H = 1 / 240;   // H: the ball moves in steps this small, always, so a guess about where it will go is exact
  const EAVE = [XE, 3.5], PEAK = [XE + 7.78, 5.8], SOFFIT = 3.4;
  const RLEN = Math.hypot(PEAK[0] - EAVE[0], PEAK[1] - EAVE[1]), DX = (PEAK[0] - EAVE[0]) / RLEN, DY = (PEAK[1] - EAVE[1]) / RLEN, NX = -DY, NY = DX;   // up the slope, and straight off it
  const MINX = XE - 10.9, MAXX = XE - 0.55, HOME = [XE - 6.3, XE - 3.2], CLOSE = XE - 2.1, FENCE = XE - 11.6, LANE = 0.7;
  // a hit is softer and loftier, a kick is harder and flatter. Both land farther up the roof the longer you hold.
  // (tuned on this roof: a hit goes over the peak in about the top fifth of the wind-up, a kick in about the top third)
  const SHOT = {hit: {t0: 0.08, t1: 0.92, vmax: 20, loft: 0.12}, kick: {t0: 0.14, t1: 0.86, vmax: 23, loft: 0}};
  const CHARGE_SECS = 0.6, SWING_SECS = 0.24, RALLY_BADGE = 10;
  const OPPS = {
    em: {name: 'Em', speed: 4.7, err: 0.2, late: 0.14, react: 0.3, say: {mine: ['My point!', 'Yes!', 'Got it!'], yours: ['Nice one!', 'Good hit!', 'Whoa, nice!'], over: ['Too far! Oops.', 'Over the peak. Oops!'], win: ['Good game!'], lose: ['Good game! You got me.']}},
    mel: {name: 'Mel', speed: 4.3, err: 0.24, late: 0.16, react: 0.34, say: {mine: ['I got one!', 'Ha!'], yours: ['Wait, really? Nice.', 'Good one!'], over: ['Oops. Too much roof.'], win: ['I won? I won!'], lose: ['Good game! Again?']}},
    guard: {name: 'Lifeguard', speed: 5.6, err: 0.12, late: 0.06, react: 0.16, say: {mine: ['Point.', 'Mine.'], yours: ['Nice.', 'Good one.'], over: ['Too much roof.'], win: ['Good game.'], lose: ['Good game. You earned it.']}}
  };
  let S = null, hold = null, TO = 7, view = 'back'; const keys = {};

  // ---- what you see: the ball, the ring you stand in, the ring where the ball is coming down ----
  // a yellow playground ball, so it reads against the red roof, the brick, the deck and the sky
  const ballTex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#ffd21a'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = 'rgba(176,120,0,.55)'; g.lineWidth = 1.6; for (let i = -10; i < 24; i++){ g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i * 16 + 128, 0); g.lineTo(i * 16, 128); g.stroke(); }   // the cross-hatch grip
    g.fillStyle = '#e8590c'; g.fillRect(0, 52, 256, 24); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 50, 256, 2); g.fillRect(0, 76, 256, 2);   // one stripe around the middle, so you can see it spin
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), new THREE.MeshStandardMaterial({map: ballTex, roughness: 0.45, metalness: 0, emissive: '#6b4a00', emissiveIntensity: 0.35})); ball.castShadow = true; ball.userData.dyn = true; scene.add(ball);
  // where it's been, for a moment: a few fading dots behind the ball, so your eye can follow it against the roof
  const dotTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(0.5, 'rgba(255,214,60,.55)'); gr.addColorStop(1, 'rgba(255,214,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  const TRAIL = 9, trail = [], trailAt = []; for (let i = 0; i < TRAIL; i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({map: dotTex, transparent: true, depthWrite: false, opacity: 0})); s.visible = false; s.userData.dyn = true; scene.add(s); trail.push(s); }
  const SPOT = [XE - 5, ZC + 1.4]; ball.position.set(SPOT[0], GY + R, SPOT[1]);
  const softRing = (inner, col) => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 64 * inner, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,.95)'); gr.addColorStop(0.7, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(cv), color: col, transparent: true, opacity: 0.8, depthWrite: false})); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData.dyn = true; m.renderOrder = 2; scene.add(m); return m; };
  const ring = softRing(0.72, '#ffffff'), landRing = softRing(0.66, '#ffffff'), landDot = softRing(0.05, '#ffffff');
  const tag = o.label ? o.label('Roof ball') : null; if (tag){ tag.position.set(SPOT[0], 0.95, SPOT[1]); tag.userData.dyn = true; tag.visible = false; scene.add(tag); }

  // ---- the page around it ----
  const css = document.createElement('style'); css.textContent = `
    .rbh{position:fixed;inset:0;z-index:9;pointer-events:none;display:none;font-family:var(--font)}
    body.rb .rbh{display:block}
    body.rb .walk-ui,body.rb .hint{display:none!important}
    .rb-score{position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:9px 18px;border-radius:999px;background:rgba(27,29,36,.9);color:#fff;box-shadow:0 10px 30px rgba(20,30,50,.25);font:800 15px/1 var(--font);white-space:nowrap}
    .rb-score b{font:900 30px/1 var(--font);min-width:32px;text-align:center;font-variant-numeric:tabular-nums}.rb-score b.me{color:#FF2E88}.rb-score b.them{color:#22d3ee}.rb-score i{font-style:normal;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#aab0bd}
    .rb-score b.bump{animation:rbBump .35s}@keyframes rbBump{40%{transform:scale(1.35)}}
    .rb-msg{position:absolute;top:74px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:999px;background:rgba(255,255,255,.96);font:800 16px/1.2 var(--font);color:#1b1d24;opacity:0;transition:opacity .2s;white-space:nowrap;max-width:calc(100vw - 28px);overflow:hidden;text-overflow:ellipsis;box-shadow:0 6px 18px rgba(20,30,50,.14)}.rb-msg.on{opacity:1}
    .rb-rally{position:absolute;top:22px;left:16px;padding:8px 13px;border-radius:999px;background:rgba(255,255,255,.92);font:800 13px/1 var(--font);color:#1b1d24;opacity:0;transition:opacity .2s}.rb-rally.on{opacity:1}.rb-rally b{color:#FF2E88;font-weight:900}
    .rb-say{position:absolute;padding:8px 14px;border-radius:16px 16px 16px 4px;background:#fff;font:800 15px/1.2 var(--font);color:#1b1d24;box-shadow:0 6px 18px rgba(20,30,50,.18);transform:translate(-12%,-100%);opacity:0;transition:opacity .2s;white-space:nowrap}.rb-say.on{opacity:1}
    .rb-help{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);padding:9px 16px;border-radius:999px;background:rgba(27,29,36,.82);color:#fff;font:700 13px/1 var(--font);white-space:nowrap}
    .rb-help kbd{display:inline-block;min-width:22px;padding:3px 6px;border-radius:6px;background:#fff;color:#1b1d24;font:800 12px/1 var(--font);text-align:center;margin:0 2px}
    body.touch .rb-help{display:none}
    .rb-top{position:absolute;top:14px;right:14px;display:flex;gap:8px;pointer-events:auto}
    .rb-charge{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);width:min(260px,62vw);opacity:0;transition:opacity .15s}.rb-charge.on{opacity:1}
    .rb-charge div{position:relative;height:14px;border-radius:999px;background:rgba(27,29,36,.55);overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,.7)}
    .rb-charge i{display:block;height:100%;width:0;background:linear-gradient(90deg,#22d3ee,#a3e635 55%,#FF2E88);border-radius:999px}
    .rb-charge u{position:absolute;top:0;bottom:0;right:0;width:9%;background:repeating-linear-gradient(45deg,rgba(255,255,255,.55) 0 3px,transparent 3px 6px)}
    .rb-charge span{display:flex;justify-content:space-between;margin-top:5px;font:800 11px/1 var(--font);letter-spacing:.04em;text-transform:uppercase;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
    .rb-pad{position:absolute;left:0;right:0;bottom:calc(20px + env(safe-area-inset-bottom));display:none;justify-content:space-between;padding:0 16px;pointer-events:none}
    body.touch .rb-pad{display:flex}
    .rb-pad span{display:flex;gap:10px}.rb-pad button{pointer-events:auto;border:0;border-radius:50%;width:74px;height:74px;font:900 15px var(--font);color:#fff;background:rgba(27,29,36,.82);box-shadow:0 8px 24px rgba(20,30,50,.2);touch-action:none;-webkit-user-select:none;user-select:none}
    .rb-pad button:active{transform:scale(.94)}
    .rb-pad button.hit{background:#FF2E88}.rb-pad button.kick{background:#2457d6}
    body.touch .rb-charge{bottom:calc(112px + env(safe-area-inset-bottom))}
    @media (max-width:700px){.rb-score{top:10px;padding:8px 15px;gap:10px;font-size:14px}.rb-score b{font-size:26px;min-width:26px}.rb-top{top:62px;right:10px}.rb-top .pill{min-height:38px}.rb-rally{top:66px;left:10px}.rb-msg{top:112px;font-size:14px;white-space:normal;text-align:center;width:max-content}body.rb .notes{top:160px}}
    .rb-fade{position:fixed;inset:0;z-index:19;background:#eaf6ff;opacity:0;pointer-events:none}.rb-fade.go{animation:rbFade .5s ease-out}@keyframes rbFade{0%{opacity:1}35%{opacity:1}100%{opacity:0}}
    .rb-pick h2{margin:0 0 6px;font:900 24px/1.1 var(--font)}.rb-pick p{margin:0 0 14px;font:600 15px/1.5 var(--font);color:#3b4050}.rb-pick .gate-row{margin-bottom:10px}
    .rb-pick small{display:block;font:700 12px/1.4 var(--font);color:#5b6170}
    .rb-pick ol{margin:0 0 14px;padding:0;list-style:none;display:grid;gap:6px;counter-reset:rb}.rb-pick ol li{counter-increment:rb;display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:start;font:700 14px/1.35 var(--font);color:#1b1d24}
    .rb-pick ol li::before{content:counter(rb);display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(255,46,136,.12);color:#FF2E88;font:900 12px/1 var(--font)}
    .rb-pick .seg{display:inline-flex;border-radius:999px;background:#f1f3f6;padding:3px;margin-bottom:14px}.rb-pick .seg button{border:0;background:none;border-radius:999px;padding:9px 14px;font:800 13px var(--font);cursor:pointer;color:#1b1d24;white-space:nowrap;flex:none}.rb-pick .seg button.on{background:#1b1d24;color:#fff}`;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.className = 'rbh'; hud.innerHTML = `
    <div class="rb-score" role="status" aria-live="polite"><span>You</span><b class="me" id="rb-you">0</b><i>first to <span id="rb-to">7</span></i><b class="them" id="rb-them">0</b><span id="rb-name">Em</span></div>
    <div class="rb-rally" id="rb-rally"></div>
    <div class="rb-msg" id="rb-msg" role="status"></div><div class="rb-say" id="rb-say"></div>
    <div class="rb-top"><button class="pill" id="rb-view" type="button" aria-label="Change the view">View</button><button class="pill" id="rb-quit" type="button">Leave</button></div>
    <div class="rb-charge" id="rb-charge"><div><i></i><u></u></div><span><em style="font-style:normal">low on the roof</em><em style="font-style:normal">over the peak</em></span></div>
    <div class="rb-help" id="rb-help"></div>
    <div class="rb-pad"><span><button id="rb-l" type="button" aria-label="Back from the wall">&#9660;</button><button id="rb-r" type="button" aria-label="Toward the wall">&#9650;</button></span><span><button id="rb-kick" class="kick" type="button">Kick</button><button id="rb-hit" class="hit" type="button">Hit</button></span></div>`;
  document.body.appendChild(hud);
  const fade = document.createElement('div'); fade.className = 'rb-fade'; document.body.appendChild(fade);
  const pick = document.createElement('div'); pick.className = 'gate'; pick.setAttribute('role', 'dialog'); pick.setAttribute('aria-modal', 'true'); pick.setAttribute('aria-label', 'Roof ball'); pick.innerHTML = `<div class="gate-card rb-pick"><h2>Roof ball</h2>
    <p>The game from the boys' bathhouse wall. One ball, one roof, two players.</p>
    <ol><li>Hit or kick the ball up on the roof. It rolls back down.</li><li>It gets one bounce on the deck. Then the other player sends it back up.</li><li>Over the peak, or short of the roof, and you lose the point.</li></ol>
    <div class="seg" id="rb-len" role="group" aria-label="Game length"><button type="button" data-to="7" class="on">Quick game, to 7</button><button type="button" data-to="15">Full game, to 15</button></div>
    <div class="gate-row" id="rb-opps"></div><div class="gate-row"><button class="pill" type="button" id="rb-no">Not now</button></div><small id="rb-note"></small></div>`;
  document.body.appendChild(pick);
  const q = id => document.getElementById(id), ui = {you: q('rb-you'), them: q('rb-them'), name: q('rb-name'), to: q('rb-to'), msg: q('rb-msg'), say: q('rb-say'), charge: q('rb-charge'), opps: q('rb-opps'), note: q('rb-note'), help: q('rb-help'), rally: q('rb-rally'), l: q('rb-l'), r: q('rb-r')};
  function setMsg(t, secs = 1.6){ ui.msg.textContent = t; ui.msg.classList.add('on'); clearTimeout(setMsg.t); setMsg.t = setTimeout(() => ui.msg.classList.remove('on'), secs * 1000); }
  function bubble(kind){ if (!S) return; const lines = S.o.say[kind]; if (!lines) return; S.bubble = {text: lines[Math.floor(Math.random() * lines.length)], t: 2.2}; ui.say.textContent = S.bubble.text; ui.say.classList.add('on'); }
  const bumpEl = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  function setView(v){ view = v === 'corner' ? 'corner' : 'back';
    ui.help.innerHTML = '<kbd>W</kbd><kbd>S</kbd> to the wall and back &nbsp; hold <kbd>J</kbd> hit &nbsp; hold <kbd>K</kbd> kick &nbsp; <kbd>Space</kbd> either &nbsp; <kbd>V</kbd> view'; camSnap = true; }

  // ---- the ball ----
  // Move a ball one small step. Says what it ran into: 'roof', 'deck', 'wall' (the eave, the soffit or the bathhouse wall), 'over' (the peak), or nothing.
  function fly(b, dt){
    let ev = null; b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x > PEAK[0] + 0.1) return 'over';
    const t = ((b.x - EAVE[0]) * DX + (b.y - EAVE[1]) * DY) / RLEN, tc = Math.max(0, Math.min(1, t)), cx = EAVE[0] + DX * RLEN * tc, cy = EAVE[1] + DY * RLEN * tc, ox = b.x - cx, oy = b.y - cy, d = Math.hypot(ox, oy);
    if (d < R && b.y > SOFFIT && (ox * NX + oy * NY > 0 || tc === 0)){
      const onTop = ox * NX + oy * NY > 0, nx = d > 1e-4 ? ox / d : NX, ny = d > 1e-4 ? oy / d : NY; b.x = cx + nx * R; b.y = cy + ny * R;
      let vn = b.vx * nx + b.vy * ny;
      if (vn < 0){ const tx = -ny, ty = nx; let vt = b.vx * tx + b.vy * ty; if (-vn < 1.6){ vn = 0; vt *= 1 - 0.5 * dt; } else { vn = -vn * 0.55; vt *= 0.7; }   // too soft to bounce: it rolls down the slope. Shingles grab a rubber ball.
        b.vx = vn * nx + vt * tx; b.vy = vn * ny + vt * ty; ev = onTop ? 'roof' : 'wall'; }
    }
    if (b.vx > 0 && b.x + R >= EAVE[0] && b.x < EAVE[0] && b.y < EAVE[1] - 0.03 && b.y > SOFFIT - R * 0.5){ b.x = EAVE[0] - R; b.vx = -Math.abs(b.vx) * 0.5; ev = 'wall'; }   // the fascia board
    if (b.vy > 0 && b.x > EAVE[0] && b.x < WALLX + R && b.y + R >= SOFFIT && b.y < SOFFIT){ b.y = SOFFIT - R; b.vy = -Math.abs(b.vy) * 0.5; ev = 'wall'; }                      // the soffit under the eave
    if (b.vx > 0 && b.x + R >= WALLX && b.y < SOFFIT){ b.x = WALLX - R; b.vx = -Math.abs(b.vx) * 0.5; ev = 'wall'; }                                                           // the wall
    if (b.x - R < FENCE && b.vx < 0){ b.x = FENCE + R; b.vx = Math.abs(b.vx) * 0.6; }
    if (b.y - R <= GY && b.vy < 0){ b.y = GY + R; b.vy = -b.vy * 0.72; b.vx *= 0.88; ev = 'deck'; }
    return ev;
  }
  function point(winner, why){
    S.score[winner]++; S.phase = 'point'; S.pause = 1.7; S.ball.live = false; S.land = null; const mine = winner === 0;
    setMsg(why + (mine ? ' Your point.' : ' ' + S.o.name + "'s point."), 1.7); bubble(!mine ? 'mine' : why === 'Over the peak.' ? 'over' : 'yours');
    ui.you.textContent = S.score[0]; ui.them.textContent = S.score[1]; bumpEl(mine ? ui.you : ui.them); if (o.sfx) o.sfx(mine ? 'good' : 'miss');
    const W = S.act[winner], L = S.act[1 - winner]; if (W.set) W.set('cheer'); S.cheer = 1.25; S.cheerer = winner; if (o.gesture) o.gesture(L, 'shrug', true);
    if (S.score[winner] >= TO){ S.over = true; S.pause = 0; setMsg(mine ? `You win, ${S.score[0]} to ${S.score[1]}.` : `${S.o.name} wins, ${S.score[1]} to ${S.score[0]}.`, 6); bubble(mine ? 'lose' : 'win'); if (o.sfx) o.sfx(mine ? 'win' : 'lose');
      if (!S.told){ S.told = true; if (o.report) o.report('game', {won: mine, you: S.score[0], them: S.score[1], rally: S.bestRally, opp: S.opp, to: TO}); } const game = S; setTimeout(() => { if (S === game && S.over) showPick(true); }, 2400); }
    else S.nextServer = winner;
  }
  const fault = why => point(1 - S.hitter, why);
  function stepBall(dt){ const b = S.ball; if (!b.live) return; const ev = fly(b, dt); b.spin += b.vx * dt / R;
    if (ev && o.sfx) o.sfx(ev === 'deck' ? 'bounce' : ev === 'roof' ? 'thud' : ev === 'over' ? null : 'tick');
    if (ev === 'over'){ fault('Over the peak.'); return; }
    if (ev === 'roof'){ if (!S.touched){ S.touched = true; S.bounces = 0; S.sinceRoof = 0; } }
    else if (ev === 'wall'){ if (!S.touched){ fault("Didn't make the roof."); return; } }
    else if (ev === 'deck'){ if (!S.touched){ fault("Didn't make the roof."); return; } S.bounces++; if (S.bounces >= 2){ point(S.hitter, 'Two bounces.'); return; } }
    if (S.touched){ S.sinceRoof += dt; if (S.sinceRoof > 9) point(S.hitter, 'Two bounces.'); } }

  // ---- hitting ----
  const Pl = i => i === 0 ? S.you : S.them;
  function reach(p, type, b){ const dx = Math.abs(b.x - (p.x + 0.3)), h = b.y - GY; return type === 'hit' ? dx <= 1.15 && h >= 0.55 && h <= 2.3 : dx <= 1.2 && h >= -0.05 && h <= 0.88; }
  const smartType = b => b.y - GY < 0.82 ? 'kick' : 'hit';
  const aimT = (type, c) => { const k = SHOT[type]; return k.t0 + k.t1 * Math.max(0, Math.min(1, c)); };
  function launch(b, type, c, wobble){ const k = SHOT[type], t = aimT(type, c), tx = EAVE[0] + DX * RLEN * t, ty = EAVE[1] + DY * RLEN * t + R, D = tx - b.x, T = Math.max(0.72, Math.min(1.15, 0.62 + D / 26.4)) + k.loft;
    let vx = D / T, vy = (ty - b.y) / T + 0.5 * G * T; const sp = Math.hypot(vx, vy); if (sp > k.vmax){ vx *= k.vmax / sp; vy *= k.vmax / sp; }   // too far away for that swing: it comes up short
    const w = 1 + (wobble || 0); b.vx = vx * w; b.vy = vy * w; b.live = true; }
  // where a ball in the air ends up: 'over', 'short', or 'good' and the spot on the deck where it comes down
  // (top is where it is at the top of that one bounce: the easy place to hit it)
  function forecast(x, y, vx, vy, touched, whole){ const b = {x, y, vx, vy}; let land = null;
    for (let t = 0; t < 9; t += H){ const ev = fly(b, H); if (ev === 'over') return {r: 'over'}; if (ev === 'roof') touched = true; else if (ev === 'wall' && !touched) return {r: 'short'};
      else if (ev === 'deck'){ if (!touched) return {r: 'short'}; if (!whole || land !== null) return {r: 'good', x: land === null ? b.x : land, top: b.x}; land = b.x; }
      if (land !== null && b.vy <= 0) return {r: 'good', x: land, top: b.x}; }
    return land !== null ? {r: 'good', x: land, top: b.x} : {r: 'short'}; }
  function outcome(x, y, type, c){ const b = {x, y, vx: 0, vy: 0}; launch(b, type, c, 0); return forecast(b.x, b.y, b.vx, b.vy, false, false).r; }
  // the swing: a kick for a low one, fists up from the knees for one at the waist, a two-hand push off the fingertips for one over your head
  const swingOf = (A, type, b) => type === 'kick' ? 'kick' : (b.y - GY) / (A.size || 1) > 1.45 ? 'set' : 'bump';
  function strike(i, type, c){ const p = Pl(i), b = S.ball; p.swing = SWING_SECS; p.swingType = type; const A = S.act[i]; if (A.set){ const wound = A.state === 'windK' || A.state === 'windH'; A.set(swingOf(A, type, S.phase === 'serve' ? {y: GY + 1.18} : b)); A.stT = type === 'kick' ? (wound ? 0.12 : 0.05) : 0; }   // already wound up: straight into the swing
    if (S.phase === 'serve'){ if (S.server !== i) return false; b.x = p.x + 0.45; b.y = GY + (type === 'kick' ? 0.32 : 1.18); }
    else { if (S.phase !== 'play' || S.hitter === i || !S.touched || !reach(p, type, b)) return false; S.rally++; }
    launch(b, type, c, (Math.random() - 0.5) * 0.03); S.bestRally = Math.max(S.bestRally, S.rally); if (S.rally === RALLY_BADGE && o.report) o.report('rally', {rally: RALLY_BADGE}); if (o.sfx) o.sfx(type === 'kick' ? 'kick' : 'pop');
    S.phase = 'play'; S.hitter = i; S.touched = false; S.bounces = 0; S.sinceRoof = 0; S.acc = 0;
    const f = i === 1 ? forecast(b.x, b.y, b.vx, b.vy, false, true) : null; S.land = f && f.r === 'good' ? {x: Math.max(FENCE + 0.3, f.x), stand: Math.max(MINX, Math.min(MAXX, f.top - 0.3))} : null;   // where it will come down, and where to stand to hit it off the bounce
    ui.rally.innerHTML = S.rally >= 2 ? `Rally <b>${S.rally}</b>` : ''; ui.rally.classList.toggle('on', S.rally >= 2);
    const other = Pl(1 - i), sk = S.auto[1 - i]; S.you.plan = S.them.plan = null; other.skip = false; other.fresh = true; other.think = sk ? sk.react : 0; return true; }
  // you let go: the swing stays live for a moment, so a near miss on timing still connects
  function release(){ if (!S || S.over || !hold) return; const c = Math.min(1, hold.t / CHARGE_SECS), smart = hold.type === 'smart'; let ty = hold.type; const you = S.you; hold = null; if (smart) ty = S.phase === 'serve' ? 'hit' : smartType(S.ball); you.charge = 0; if (!strike(0, ty, c)) you.pending = {type: ty, c, t: SWING_SECS, smart}; }
  function press(type, src){ if (!S || S.over || hold || S.auto[0]) return; hold = {type, t: 0, src: src || null}; }

  // ---- the other player ----
  // Run the ball forward and find the best moment to hit it: after it's been on the roof, somewhere they can get to in time.
  function planFor(i){ const me = Pl(i), sk = S.auto[i] || OPPS.guard, b = {x: S.ball.x, y: S.ball.y, vx: S.ball.vx, vy: S.ball.vy}; let touched = S.touched, bounces = S.bounces, best = null; const dt = H * 2;
    for (let t = 0; t < 6; t += dt){ let ev = fly(b, H); const e2 = fly(b, H); ev = ev === 'over' || e2 === 'over' ? 'over' : (ev === 'deck' || e2 === 'deck' ? 'deck' : ev || e2); if (ev === 'over') return null; if (ev === 'roof') touched = true; else if (ev === 'wall' && !touched) return null; else if (ev === 'deck'){ if (!touched) return null; bounces++; if (bounces >= 2) break; }
      if (!touched) continue; const h = b.y - GY, type = h >= 0.64 && h <= 2.2 ? 'hit' : h >= 0.04 && h <= 0.78 ? 'kick' : null; if (!type) continue;
      const x = Math.max(MINX, Math.min(MAXX, b.x - 0.3)), need = Math.abs(x - me.x) / sk.speed + 0.04; if (need > t || Math.abs(b.x - 0.3 - x) > 0.76) continue;
      const sc = (type === 'hit' ? 2 - Math.abs(h - 1.15) * 1.5 : 0) + (bounces === 1 ? 2 : 0) - Math.abs(b.vy) / 7 - (t - need) * 0.15 - (b.x > CLOSE ? 6 : 0);   // off the bounce, about chest high and not moving fast, is the easy one. Not from in under the eave.
      if (!best || sc > best.sc) best = {sc, x, t, type}; }
    return best; }
  // How hard to swing from where the ball is. Mostly a shot that lands. When they slip, one that doesn't; if every swing from there would land, they just miss the ball (-1).
  function chooseCharge(type, sk, serving){ const b = S.ball, good = [], bad = []; for (let c = 0.05; c <= 1; c += 0.08) (outcome(b.x, b.y, type, c) === 'good' ? good : bad).push(c);
    const slip = Math.random() < sk.err * (serving ? 0.5 : 1); if (slip && !bad.length && !serving) return -1; const from = (slip && bad.length) || !good.length ? bad : good; return from[Math.floor(Math.random() * from.length)] + (Math.random() - 0.5) * 0.06; }
  function move(p, tx, speed, dt){ const d = tx - p.x; if (Math.abs(d) < 0.05){ p.moving = false; return; } const s = Math.sign(d) * Math.min(Math.abs(d), speed * dt); p.x = Math.max(MINX, Math.min(MAXX, p.x + s)); p.moving = true; p.dir = Math.sign(d); }
  function stepAuto(i, dt){ const me = Pl(i), b = S.ball, sk = S.auto[i];
    if (S.phase === 'serve'){ if (S.server !== i){ move(me, HOME[i], sk.speed * 0.7, dt); return; } S.serveT += dt; const sx = XE - 5.6 + ((S.score[0] + S.score[1]) % 3) * 1.1; move(me, sx, sk.speed, dt);
      if (S.serveT > 0.9 && Math.abs(me.x - sx) < 0.12){ b.x = me.x + 0.45; b.y = GY + 1.18; strike(i, 'hit', chooseCharge('hit', sk, true)); } return; }
    if (S.phase !== 'play' || S.hitter === i){ move(me, HOME[i], sk.speed * 0.7, dt); return; }     // not their ball: back to a ready spot
    if (me.skip){ move(me, Math.max(MINX, Math.min(MAXX, b.x - 2.2)), sk.speed * 0.6, dt); return; }   // didn't read this one
    me.think -= dt; if (me.think <= 0){ me.plan = planFor(i); me.think = 0.25; if (me.plan) me.plan.at = S.time + me.plan.t; if (me.fresh){ me.fresh = false; if (Math.random() < sk.late){ me.skip = true; return; } } }
    move(me, me.plan ? me.plan.x : Math.max(MINX, Math.min(MAXX, b.x - 0.3)), sk.speed, dt);
    const type = reach(me, 'hit', b) ? 'hit' : reach(me, 'kick', b) ? 'kick' : null;
    if (type && S.touched && (me.plan ? S.time >= me.plan.at - 0.06 : S.bounces === 1 && b.vy < 0)){ const c = chooseCharge(type, sk); if (c < 0){ me.swing = SWING_SECS; me.swingType = type; me.skip = true; const A = S.act[i]; if (A.set){ A.set(swingOf(A, type, b)); A.stT = 0; } } else strike(i, type, c); } }

  // ---- you ----
  const padNow = () => { const gps = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of gps) if (p && p.connected) return p; return null; };
  const PADMAP = [[0, 'smart'], [2, 'hit'], [1, 'kick']]; let padWas = {};
  function stepYou(dt){ const you = S.you; let dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    const gp = padNow(); if (gp){ const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, v = Math.abs(ax) > Math.abs(ay) ? ax : -ay; if (Math.abs(v) > 0.3) dir = Math.sign(v);
      PADMAP.forEach(([bi, type]) => { const on = !!(gp.buttons[bi] && gp.buttons[bi].pressed); if (on && !padWas[bi]) press(type, 'pad' + bi); else if (!on && padWas[bi] && hold && hold.src === 'pad' + bi) release(); padWas[bi] = on; }); }
    if (dir) move(you, you.x + dir * 2, 6.6, dt); else you.moving = false;
    if (hold){ hold.t += dt; you.charge = Math.min(1, hold.t / CHARGE_SECS); }
    if (you.pending){ const pd = you.pending; pd.t -= dt; if (strike(0, pd.smart && S.phase === 'play' ? smartType(S.ball) : pd.type, pd.c) || pd.t <= 0) you.pending = null; } }
  const toServe = who => { S.phase = 'serve'; S.server = who; S.hitter = who; S.touched = false; S.bounces = 0; S.rally = 0; S.serveT = 0; S.land = null; S.ball.live = false; S.ball.vx = S.ball.vy = 0; S.you.plan = S.them.plan = null; ui.rally.classList.remove('on');
    if (who === 0 && !S.auto[0]) setMsg(S.score[0] + S.score[1] === 0 ? 'Your serve. Hold to wind up, let go to hit.' : 'Your serve.', S.score[0] + S.score[1] === 0 ? 3.2 : 1.4); };
  const mkP = x => ({x, swing: 0, swingType: null, charge: 0, moving: false, dir: 1, plan: null, think: 0, pending: null, skip: false, fresh: false});

  // ---- drawing it: the two players, the ball, the rings, the camera ----
  const v3 = new THREE.Vector3(), look = new THREE.Vector3(), lookTo = new THREE.Vector3(); let camSnap = true;
  function pose(i, dt){ const p = Pl(i), A = S.act[i], zz = ZC + (i === 0 ? LANE : -LANE); A.g.position.set(p.x, 0, zz);
    const face = p.moving && p.swing <= 0 ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI / 2 + (i === 0 ? -0.3 : 0.3);   // running: the way they run. Set: toward the roof, opened up a little to the other player
    let d = face - A.g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; A.g.rotation.y += d * Math.min(1, dt * 14);
    if (p.swing > 0 || (A.stT < 0.42 && (A.state === 'kick' || A.state === 'bump' || A.state === 'set'))){ /* the swing plays out */ } else if (S.cheer > 0 && S.cheerer === i){ /* a point won */ }
    else if (i === 0 && hold && !p.moving && A.set){ A.windup = p.charge; A.set(hold.type === 'kick' ? 'windK' : 'windH'); }   // holding: winding up
    else if (A.set) A.set(p.moving ? 'jog' : (S.over ? 'idle' : 'ready'), 1);
    if (A.face) A.face.target = S.over ? null : ball.position; if (A.tick) A.tick(dt); }
  // Two ways to watch. From behind you: the roof faces you, the ball comes back at you, and the camera follows you up and back.
  // From the corner: the whole court from the deck side, a little above it all.
  function cam(dt){ const tall = camera.aspect < 1, b = S.ball, lift = Math.max(0, Math.min(1.3, (b.y - 4.4) * 0.38));
    if (view === 'back'){ v3.set(Math.max(FENCE - 9, S.you.x - (tall ? 9.8 : 8.6)), tall ? 5.6 : 5.3, ZC + 0.1); lookTo.set(XE + 0.6, 1.65 + lift, ZC); }
    else { const d = tall ? 17 : 12.5; v3.set(XE - 5.4 - d * 0.6, 4.6 + d * 0.2, ZC + d * 0.74); lookTo.set(XE - 0.6, 2.2 + lift * 0.6, ZC - 0.8); }
    const k = camSnap ? 1 : 1 - Math.exp(-dt * 4.5); camSnap = false; camera.position.lerp(v3, k); look.lerp(lookTo, k); camera.lookAt(look); }
  function draw(dt){ const b = S.ball; ball.visible = true; ball.position.set(b.x, b.y, ZC + (S.phase === 'serve' ? (S.server === 0 ? LANE * 0.55 : -LANE * 0.55) : 0)); ball.rotation.z = -b.spin;
    if (b.live){ trailAt.unshift([b.x, b.y]); if (trailAt.length > TRAIL * 2) trailAt.length = TRAIL * 2; } else trailAt.length = 0;
    trail.forEach((s, i) => { const p = trailAt[(i + 1) * 2 - 1]; s.visible = !!p; if (p){ const f = 1 - i / TRAIL; s.position.set(p[0], p[1], ZC); s.scale.setScalar(R * (1.7 * f + 0.5)); s.material.opacity = 0.34 * f * f; } });
    pose(0, dt); pose(1, dt);
    const ch = S.you.charge || 0, canHit = S.phase === 'play' && S.hitter === 1 && S.touched && (reach(S.you, 'hit', b) || reach(S.you, 'kick', b));
    ui.charge.classList.toggle('on', ch > 0.02); ui.charge.querySelector('i').style.width = Math.round(ch * 100) + '%';
    ring.visible = !S.over && !S.auto[0]; ring.position.set(S.you.x + 0.1, GY + 0.012, ZC + LANE); ring.scale.setScalar(1.25 + ch * 0.75); ring.material.color.set(canHit ? '#a3e635' : ch > 0.02 ? '#FF2E88' : '#ffffff'); ring.material.opacity = canHit || ch > 0.02 ? 0.95 : 0.45;
    const L = S.phase === 'play' && S.hitter === 1 && !S.auto[0] ? S.land : null, set = L && Math.abs(S.you.x - L.stand) < 0.4;   // a ring where to stand for the easy hit, and a mark where the ball comes down first
    landRing.visible = !!L; if (L){ landRing.position.set(L.stand + 0.1, GY + 0.014, ZC + LANE); landRing.scale.setScalar(1.5 * (set ? 1 : 0.94 + Math.sin(S.time * 9) * 0.08)); landRing.material.color.set(set ? '#a3e635' : '#FF2E88'); landRing.material.opacity = set ? 0.5 : 0.9; }
    landDot.visible = !!L && S.bounces === 0; if (landDot.visible){ landDot.position.set(L.x, GY + 0.013, ZC); landDot.scale.setScalar(0.55); landDot.material.opacity = 0.55; }
    if (S.bubble){ const A = S.act[1]; if (A.head) A.head.getWorldPosition(v3); else { v3.copy(A.g.position); v3.y += 1.5; } v3.y += 0.42; v3.project(camera); ui.say.style.left = ((v3.x * 0.5 + 0.5) * innerWidth) + 'px'; ui.say.style.top = ((-v3.y * 0.5 + 0.5) * innerHeight) + 'px'; }
    cam(dt); }
  function step(dt){ if (!S) return; S.time += dt;
    if (S.bubble){ S.bubble.t -= dt; if (S.bubble.t <= 0){ S.bubble = null; ui.say.classList.remove('on'); } }
    if (S.you.swing > 0) S.you.swing -= dt; if (S.them.swing > 0) S.them.swing -= dt; if (S.cheer > 0) S.cheer -= dt;
    if (!S.over){ if (!S.auto[0]) stepYou(dt);
      if (S.phase === 'point'){ S.pause -= dt; if (S.pause <= 0) toServe(S.nextServer); }
      else { if (S.phase === 'serve'){ const sv = Pl(S.server); S.ball.x = sv.x + 0.45; S.ball.y = GY + 1.18 + Math.sin(S.time * 5) * 0.04; }
        if (S.auto[0]) stepAuto(0, dt); stepAuto(1, dt); S.acc += dt; let n = 0; while (S.acc >= H && S.phase === 'play' && n++ < 40){ stepBall(H); S.acc -= H; } if (S.phase !== 'play') S.acc = 0; } }
    draw(dt); }

  // ---- starting and stopping ----
  let saved = null, lenTo = 7;
  const kidFor = me => me === 'em' ? 'mel' : 'em';
  function showPick(again){ pick.classList.add('on'); const list = [kidFor(o.who()), 'guard']; ui.opps.innerHTML = '';
    list.forEach(id => { const b = document.createElement('button'); b.className = 'pill ink'; b.type = 'button'; b.textContent = 'Play ' + (id === 'guard' ? 'a lifeguard' : OPPS[id].name) + (again && S && S.opp === id ? ' again' : ''); b.onclick = () => start(id); ui.opps.appendChild(b); });
    ui.note.textContent = `${OPPS[list[0]].name} is quick, but slips now and then. The lifeguard does not slip much.`; const first = ui.opps.querySelector('button'); if (first) first.focus(); }
  pick.querySelectorAll('#rb-len button').forEach(b => b.addEventListener('click', () => { lenTo = +b.dataset.to; pick.querySelectorAll('#rb-len button').forEach(x => x.classList.toggle('on', x === b)); }));
  q('rb-no').onclick = () => { pick.classList.remove('on'); if (S) close(); };
  pick.addEventListener('click', e => { if (e.target === pick){ pick.classList.remove('on'); if (S) close(); } });
  const flash = () => { fade.classList.remove('go'); void fade.offsetWidth; fade.classList.add('go'); };   // a quick wash of light over the cut to the court and back
  function seat(n){ n.rb = true; n.busy = true; n.inWater = false; n.moving = false; n.plan = null; n.wps = null; n.y = 0; n.flip = 0; if (n.a.g){ n.a.g.rotation.x = 0; n.a.g.rotation.z = 0; } if (n.tag) n.tag.visible = false; }
  function unseat(n, x){ if (!n) return; n.rb = false; n.busy = false; n.x = x; n.z = ZC - LANE; n.y = 0; n.a.g.position.set(n.x, 0, n.z); n.plan = null; n.wps = null; n.arrived = false; n.hold = 0; if (n.a.set) n.a.set('idle'); if (n.a.face) n.a.face.target = null; }
  function start(opp){ pick.classList.remove('on'); TO = lenTo; ui.to.textContent = TO; const n = o.npc(opp), you = o.player();
    if (saved && saved.n !== n) unseat(saved.n, S ? S.them.x : HOME[1]); if (!saved) saved = {me: o.where()}; saved.n = n; seat(n);
    S = {opp, o: OPPS[opp], score: [0, 0], server: 0, rally: 0, bestRally: 0, over: false, told: false, time: 0, acc: 0, auto: [null, OPPS[opp]], you: mkP(HOME[0]), them: mkP(HOME[1]), act: [you, n.a], ball: {x: 0, y: 0, vx: 0, vy: 0, live: false, spin: 0},
      phase: 'serve', hitter: 0, touched: false, bounces: 0, sinceRoof: 0, pause: 0, bubble: null, serveT: 0, nextServer: 0, cheer: 0, cheerer: 0, land: null};
    ui.you.textContent = '0'; ui.them.textContent = '0'; ui.name.textContent = OPPS[opp].name; ui.rally.classList.remove('on'); hold = null; keys.left = keys.right = false; padWas = {}; you.g.rotation.x = 0; you.g.rotation.z = 0; you.g.scale.setScalar(you.size || 1);
    if (!document.body.classList.contains('rb')){ setView(view); flash(); } camSnap = true; if (tag) tag.visible = false;
    document.body.classList.add('rb'); if (o.shadow) o.shadow([XE - 1.5, ZC, 17]); if (o.enter) o.enter(); toServe(0); if (o.report) o.report('start', {opp}); }
  function close(){ pick.classList.remove('on'); if (!S && !saved) return; const sv = saved, themX = S ? S.them.x : HOME[1], youX = S ? S.you.x : HOME[0]; if (sv) unseat(sv.n, themX); S = null; hold = null; saved = null;
    ring.visible = false; landRing.visible = false; landDot.visible = false; trail.forEach(s => { s.visible = false; }); trailAt.length = 0; ui.say.classList.remove('on'); ui.msg.classList.remove('on'); ball.position.set(SPOT[0], GY + R, SPOT[1]); ball.rotation.set(0, 0, 0); document.body.classList.remove('rb'); flash();
    if (o.shadow) o.shadow(null); if (o.leave) o.leave(Math.min(youX, SPOT[0] - 1.1), ZC + LANE, sv); }
  q('rb-quit').onclick = close; q('rb-view').onclick = () => setView(view === 'back' ? 'corner' : 'back');
  // keyboard: arrows or W A S D to move, J to hit, K to kick, Space does whichever fits, V changes the view
  const KEYMAP = {j: 'hit', z: 'hit', k: 'kick', x: 'kick', ' ': 'smart'}, lower = e => e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const LEFT = ['ArrowLeft', 'ArrowDown', 'a', 's'], RIGHT = ['ArrowRight', 'ArrowUp', 'd', 'w'];
  addEventListener('keydown', e => { if (!S){ if (pick.classList.contains('on') && e.key === 'Escape'){ pick.classList.remove('on'); e.stopImmediatePropagation(); } return; } if (e.ctrlKey || e.metaKey || e.altKey) return; const key = lower(e); e.stopImmediatePropagation();
    if (key === 'Escape'){ if (pick.classList.contains('on') && !S.over) pick.classList.remove('on'); else close(); return; } if (pick.classList.contains('on')) return;
    if (S.over){ if (key === 'Enter'){ e.preventDefault(); start(S.opp); } return; }
    if (LEFT.includes(key)){ keys.left = true; e.preventDefault(); } else if (RIGHT.includes(key)){ keys.right = true; e.preventDefault(); } else if (key === 'v' || key === 'c'){ if (!e.repeat) setView(view === 'back' ? 'corner' : 'back'); }
    else if (KEYMAP[key]){ e.preventDefault(); if (!e.repeat && !hold) press(KEYMAP[key], 'key' + key); } }, true);
  addEventListener('keyup', e => { if (!S) return; const key = lower(e); if (LEFT.includes(key)) keys.left = false; else if (RIGHT.includes(key)) keys.right = false; else if (hold && hold.src === 'key' + key) release(); }, true);
  addEventListener('blur', () => { keys.left = keys.right = false; hold = null; if (S) S.you.charge = 0; });
  const padHold = (el, down, up) => { el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {} down(); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => el.addEventListener(t, up)); el.addEventListener('contextmenu', e => e.preventDefault()); };
  padHold(ui.l, () => { keys.left = true; }, () => { keys.left = false; }); padHold(ui.r, () => { keys.right = true; }, () => { keys.right = false; });
  padHold(q('rb-hit'), () => press('hit', 'btn'), () => { if (hold && hold.type === 'hit' && hold.src === 'btn') release(); }); padHold(q('rb-kick'), () => press('kick', 'btn'), () => { if (hold && hold.type === 'kick' && hold.src === 'btn') release(); });

  return {spot: SPOT, center: [XE - 3, ZC], get active(){ return !!S; }, get picking(){ return !S && pick.classList.contains('on'); }, get state(){ return S; }, get view(){ return view; }, setView,
    // not in a game: is the player standing by the ball, and should its name show
    idle: (x, z) => { const d = Math.hypot(x - SPOT[0], z - SPOT[1]); if (tag) tag.visible = !S && d < 24 && d >= 3.0; return !S && d < 3.0 ? d : -1; },   // the name shows from across the deck; up close the prompt takes over
    open: () => { if (!S) showPick(false); }, close, step, start, press, release, strike, fly, outcome, forecast, planFor, launch,
    auto: sk => { if (S) S.auto[0] = sk ? (OPPS[sk] || sk) : null; }, K: {XE, ZC, EAVE, PEAK, WALLX, MINX, MAXX, R, GY, H, HOME}};
}
