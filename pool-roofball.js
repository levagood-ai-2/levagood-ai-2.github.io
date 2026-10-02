// Roof ball, the way we played it on the boys' bathhouse roof.
// You hit or kick a four square ball up onto the roof. The roof slopes down toward the deck, so the ball comes back.
// It can bounce anywhere on the slope, but if it goes over the peak it's gone and you lose the point. Coming back,
// it can bounce on the deck one time. Then the other player has to hit or kick it back up. First to 15.
(function(){
  'use strict';
  var ov = document.getElementById('roofball'), C = document.getElementById('rb');
  if (!ov || !C) return;
  var ctx = C.getContext('2d');
  var q = function(id){ return document.getElementById(id); };
  var ui = {close: q('rb-close'), pick: q('rb-pick'), pad: q('rb-pad'), live: q('rb-live'), em: q('rb-em'), guard: q('rb-guard'),
    left: q('rb-left'), right: q('rb-right'), hit: q('rb-hit'), kick: q('rb-kick')};

  // ---- the court (canvas units) ----
  var W = 560, H = 420, GY = 372, R = 9, G = 820, FENCE = 14, TO = 15;
  var EAVE = [318, 220], PEAK = [524, 128], WALL = 338, SOFFIT = 232;
  var RLEN = Math.hypot(PEAK[0] - EAVE[0], PEAK[1] - EAVE[1]);
  var DX = (PEAK[0] - EAVE[0]) / RLEN, DY = (PEAK[1] - EAVE[1]) / RLEN;   // up the slope
  var NX = DY, NY = -DX;                                                   // straight off the roof, up and toward the deck
  var MINX = 30, MAXX = 304, HOME = [150, 236], CLOSE = 262;   // past CLOSE you're in under the eave
  // A hit is softer and loftier, a kick is harder and flatter. Both land farther up the roof the longer you hold.
  // t0 is where a tap lands (0 is the eave, 1 is the peak) and t1 is how much farther a full wind-up goes.
  var SHOT = {hit: {t0: 0.08, t1: 1.02, vmax: 740, loft: 0.12}, kick: {t0: 0.3, t1: 0.95, vmax: 840, loft: 0}};
  var CHARGE_SECS = 0.6, SWING_SECS = 0.22, RALLY_BADGE = 10;
  // the other players. err is how often they slip on a swing, late is how often they just don't get to the ball
  var OPPS = {
    em: {name: 'Em', speed: 150, err: 0.2, late: 0.14, react: 0.3,
      say: {mine: ['My point!', 'Yes!', 'Got it!'], yours: ['Nice one!', 'Good hit!', 'Whoa, nice!'], over: ['Too far! Oops.', 'Over the peak. Oops!'], win: ['Good game!'], lose: ['Good game! You got me.']}},
    guard: {name: 'Guard', speed: 185, err: 0.12, late: 0.06, react: 0.16,
      say: {mine: ['Point.', 'Mine.'], yours: ['Nice.', 'Good one.'], over: ['Too much roof.'], win: ['Good game.'], lose: ['Good game. You earned it.']}}
  };

  var S = null, raf = null, lastT = 0, opener = null;
  var keys = {}, pointerX = null, hold = null;   // hold: {type, t} while a button or key is down

  function newGame(oppId){
    S = {opp: oppId, o: OPPS[oppId], score: [0, 0], server: 0, rally: 0, bestRally: 0, over: false, told: false, time: 0, auto: [null, OPPS[oppId]],
      you: mkPlayer(HOME[0]), them: mkPlayer(HOME[1]),
      ball: {x: 0, y: 0, vx: 0, vy: 0, live: false, spin: 0},
      phase: 'serve', hitter: 0, touched: false, bounces: 0, sinceRoof: 0, pause: 0, msg: '', msgT: 0, bubble: null, serveT: 0, nextServer: 0, log: []};
    toServe(0);
  }
  function mkPlayer(x){ return {x: x, swing: 0, swingType: null, charge: 0, walk: 0, moving: false, plan: null, think: 0, pending: null, skip: false, fresh: false}; }
  function P(i){ return i === 0 ? S.you : S.them; }
  function toServe(who){
    S.phase = 'serve'; S.server = who; S.hitter = who; S.touched = false; S.bounces = 0; S.rally = 0; S.serveT = 0;
    S.ball.live = false; S.ball.vx = S.ball.vy = 0;
    S.you.plan = S.them.plan = null;
  }
  function announce(t){ if (ui.live && ui.live.textContent !== t) ui.live.textContent = t; }
  function bubble(kind){
    var lines = S.o.say[kind]; if (!lines) return;
    S.bubble = {text: lines[Math.floor(Math.random() * lines.length)], t: 2.2};
  }

  // ---- the ball ----
  // Move a ball one small step. Says what it ran into: 'roof', 'deck', 'wall' (the eave or the bathhouse wall), 'over' (the peak), or nothing.
  function fly(b, dt){
    var ev = null;
    b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x > PEAK[0] + 2) return 'over';
    // the roof: closest point on the slope from the eave to the peak
    var t = ((b.x - EAVE[0]) * DX + (b.y - EAVE[1]) * DY) / RLEN, tc = Math.max(0, Math.min(1, t));
    var cx = EAVE[0] + DX * RLEN * tc, cy = EAVE[1] + DY * RLEN * tc, ox = b.x - cx, oy = b.y - cy, d = Math.hypot(ox, oy);
    if (d < R && b.y < SOFFIT && (ox * NX + oy * NY > 0 || tc === 0)){
      var onTop = ox * NX + oy * NY > 0;
      var nx = d > 0.001 ? ox / d : NX, ny = d > 0.001 ? oy / d : NY;
      b.x = cx + nx * R; b.y = cy + ny * R;
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0){
        var tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
        if (-vn < 60){ vn = 0; vt *= 1 - 0.5 * dt; }      // too soft to bounce: it rolls down the slope
        else { vn = -vn * 0.6; vt *= 0.86; }
        b.vx = vn * nx + vt * tx; b.vy = vn * ny + vt * ty;
        ev = onTop ? 'roof' : 'wall';                     // catching the edge of the eave from below doesn't count
      }
    }
    // the fascia board, the soffit under the eave, and the wall
    if (b.vx > 0 && b.x + R >= EAVE[0] && b.x < EAVE[0] && b.y > EAVE[1] + 2 && b.y < SOFFIT + R * 0.5){ b.x = EAVE[0] - R; b.vx = -Math.abs(b.vx) * 0.5; ev = 'wall'; }
    if (b.vy < 0 && b.x > EAVE[0] && b.x < WALL + R && b.y - R <= SOFFIT && b.y > SOFFIT){ b.y = SOFFIT + R; b.vy = Math.abs(b.vy) * 0.5; ev = 'wall'; }
    if (b.vx > 0 && b.x + R >= WALL && b.y > SOFFIT){ b.x = WALL - R; b.vx = -Math.abs(b.vx) * 0.5; ev = 'wall'; }
    if (b.x - R < FENCE && b.vx < 0){ b.x = FENCE + R; b.vx = Math.abs(b.vx) * 0.6; }
    // the deck
    if (b.y + R >= GY && b.vy > 0){ b.y = GY - R; b.vy = -b.vy * 0.72; b.vx *= 0.88; ev = 'deck'; }
    return ev;
  }
  function point(winner, why){
    S.score[winner]++; S.phase = 'point'; S.pause = 1.3; S.ball.live = false;
    var mine = winner === 0;
    S.log.push({to: winner, why: why, rally: S.rally});
    S.msg = why + (mine ? ' Your point.' : ' ' + S.o.name + "'s point."); S.msgT = 1.3;
    bubble(!mine ? 'mine' : why === 'Over the peak.' ? 'over' : 'yours');
    announce(S.msg + ' You ' + S.score[0] + ', ' + S.o.name + ' ' + S.score[1] + '.');
    if (S.score[winner] >= TO){
      S.over = true; S.pause = 0;
      S.msg = mine ? 'You win, ' + S.score[0] + ' to ' + S.score[1] + '.' : S.o.name + ' wins, ' + S.score[1] + ' to ' + S.score[0] + '.';
      bubble(mine ? 'lose' : 'win');
      announce(S.msg + ' Press Enter to play again.');
      if (!S.told){ S.told = true; tell('game', {won: mine, you: S.score[0], them: S.score[1], rally: S.bestRally, opp: S.opp}); }
      showPick(true);
    } else S.nextServer = winner;
  }
  function fault(why){ point(1 - S.hitter, why); }
  function stepBall(dt){
    var b = S.ball; if (!b.live) return;
    var ev = fly(b, dt); b.spin += b.vx * dt * 0.02;
    if (ev === 'over'){ fault('Over the peak.'); return; }
    if (ev === 'roof'){ if (!S.touched){ S.touched = true; S.bounces = 0; S.sinceRoof = 0; } }
    else if (ev === 'wall'){ if (!S.touched){ fault("Didn't make the roof."); return; } }
    else if (ev === 'deck'){
      if (!S.touched){ fault("Didn't make the roof."); return; }
      S.bounces++;
      if (S.bounces >= 2){ point(S.hitter, 'Two bounces.'); return; }
    }
    if (S.touched){ S.sinceRoof += dt; if (S.sinceRoof > 9) point(S.hitter, 'Two bounces.'); }
  }

  // ---- hitting ----
  function reach(p, type, b){
    var dx = Math.abs(b.x - (p.x + 8));
    if (type === 'hit') return dx <= 30 && b.y >= GY - 100 && b.y <= GY - 24;
    return dx <= 32 && b.y >= GY - 38 && b.y <= GY + 2;
  }
  function smartType(b){ return b.y > GY - 36 ? 'kick' : 'hit'; }
  // where on the roof a shot is aimed: 0 is the eave, 1 is the peak, past 1 is over the top
  function aimT(type, c){ var k = SHOT[type]; return k.t0 + k.t1 * Math.max(0, Math.min(1, c)); }
  function launch(b, type, c, wobble){
    var k = SHOT[type], t = aimT(type, c);
    var tx = EAVE[0] + DX * RLEN * t, ty = EAVE[1] + DY * RLEN * t - R;
    var D = tx - b.x, T = Math.max(0.8, Math.min(1.3, 0.7 + D / 700)) + k.loft;
    var vx = D / T, vy = (ty - b.y) / T - 0.5 * G * T, sp = Math.hypot(vx, vy);
    if (sp > k.vmax){ vx *= k.vmax / sp; vy *= k.vmax / sp; }   // too far away for that swing: it comes up short
    var w = 1 + (wobble || 0);
    b.vx = vx * w; b.vy = vy * w; b.live = true;
  }
  // Where a shot would end up from here: 'good' (on the roof and back down), 'over' or 'short'
  function outcome(x, y, type, c){
    var b = {x: x, y: y, vx: 0, vy: 0}, touched = false; launch(b, type, c, 0);
    for (var t = 0; t < 7; t += 1 / 120){
      var ev = fly(b, 1 / 120);
      if (ev === 'over') return 'over';
      if (ev === 'roof') touched = true;
      else if (ev === 'wall' && !touched) return 'short';
      else if (ev === 'deck') return touched ? 'good' : 'short';
    }
    return 'short';
  }
  function strike(i, type, c){
    var p = P(i), b = S.ball;
    p.swing = SWING_SECS; p.swingType = type;
    if (S.phase === 'serve'){
      if (S.server !== i) return false;
      b.x = p.x + 12; b.y = type === 'kick' ? GY - 14 : GY - 52;
    } else {
      if (S.phase !== 'play' || S.hitter === i || !S.touched || !reach(p, type, b)) return false;
      S.rally++;
    }
    launch(b, type, c, (Math.random() - 0.5) * 0.03);
    S.bestRally = Math.max(S.bestRally, S.rally);
    if (S.rally === RALLY_BADGE) tell('rally', {rally: RALLY_BADGE});
    S.phase = 'play'; S.hitter = i; S.touched = false; S.bounces = 0; S.sinceRoof = 0;
    // the other player takes a beat to read it
    var other = P(1 - i), sk = S.auto[1 - i];
    S.you.plan = S.them.plan = null; other.skip = false; other.fresh = true; other.think = sk ? sk.react : 0;
    return true;
  }
  // you let go of the button: the swing stays live for a moment, so a near miss on timing still connects
  function release(){
    if (!S || S.over || !hold) return;
    var c = Math.min(1, hold.t / CHARGE_SECS), smart = hold.type === 'smart', ty = hold.type, you = S.you; hold = null;
    if (smart) ty = S.phase === 'serve' ? 'hit' : smartType(S.ball);
    you.charge = 0;
    if (!strike(0, ty, c)) you.pending = {type: ty, c: c, t: SWING_SECS, smart: smart};
  }
  function press(type){
    if (!S || S.over || hold) return;
    hold = {type: type, t: 0};
  }

  // ---- the other player ----
  // Run the ball forward and find the best moment to hit it: after it's been on the roof, somewhere I can get to in time.
  function planFor(i){
    var me = P(i), o = S.auto[i] || OPPS.guard, b = {x: S.ball.x, y: S.ball.y, vx: S.ball.vx, vy: S.ball.vy}, touched = S.touched, bounces = S.bounces, best = null, dt = 1 / 90;
    for (var t = 0; t < 6; t += dt){
      var ev = fly(b, dt);
      if (ev === 'over') return null;
      if (ev === 'roof') touched = true;
      else if (ev === 'wall' && !touched) return null;
      else if (ev === 'deck'){ if (!touched) return null; bounces++; if (bounces >= 2) break; }
      if (!touched) continue;
      var type = b.y >= GY - 96 && b.y <= GY - 28 ? 'hit' : b.y >= GY - 34 && b.y <= GY - 2 ? 'kick' : null;
      if (!type) continue;
      var x = Math.max(MINX, Math.min(MAXX, b.x - 8)), need = Math.abs(x - me.x) / o.speed + 0.04;
      if (need > t || Math.abs(b.x - 8 - x) > 20) continue;
      // slow and high is the easy one, and not from in under the eave, where nothing makes the roof
      var sc = (type === 'hit' ? 2 : 0) + (bounces === 1 ? 2 : 0) - Math.abs(b.vy) / 260 - (t - need) * 0.15 - (b.x > CLOSE ? 6 : 0);
      if (!best || sc > best.sc) best = {sc: sc, x: x, t: t, type: type};
    }
    return best;
  }
  // How hard to swing from where the ball is. Mostly a shot that lands. When they slip, it's one that doesn't,
  // and if every swing from there would land, they just miss the ball (that comes back as -1).
  function chooseCharge(type, o, serving){
    var b = S.ball, good = [], bad = [];
    for (var c = 0.05; c <= 1; c += 0.08) (outcome(b.x, b.y, type, c) === 'good' ? good : bad).push(c);
    var slip = Math.random() < o.err * (serving ? 0.5 : 1);
    if (slip && !bad.length && !serving) return -1;
    var from = (slip && bad.length) || !good.length ? bad : good;
    return from[Math.floor(Math.random() * from.length)] + (Math.random() - 0.5) * 0.06;
  }
  function stepAuto(i, dt){
    var me = P(i), b = S.ball, o = S.auto[i];
    if (S.phase === 'serve'){
      if (S.server !== i){ move(me, HOME[i], o.speed * 0.7, dt); return; }
      S.serveT += dt;
      var sx = 170 + ((S.score[0] + S.score[1]) % 3) * 30;
      move(me, sx, o.speed, dt);
      if (S.serveT > 0.8 && Math.abs(me.x - sx) < 3){ b.x = me.x + 12; b.y = GY - 52; strike(i, 'hit', chooseCharge('hit', o, true)); }
      return;
    }
    if (S.phase !== 'play' || S.hitter === i){ move(me, HOME[i], o.speed * 0.7, dt); return; }   // not my ball: back to a ready spot
    if (me.skip){ move(me, Math.max(MINX, Math.min(MAXX, b.x - 60)), o.speed * 0.6, dt); return; }   // didn't read this one
    me.think -= dt;
    if (me.think <= 0){
      me.plan = planFor(i); me.think = 0.25; if (me.plan) me.plan.at = S.time + me.plan.t;
      if (me.fresh){ me.fresh = false; if (Math.random() < o.late){ me.skip = true; return; } }
    }
    move(me, me.plan ? me.plan.x : Math.max(MINX, Math.min(MAXX, b.x - 8)), o.speed, dt);
    var type = reach(me, 'hit', b) ? 'hit' : reach(me, 'kick', b) ? 'kick' : null;
    // swing at the planned moment, or take what's there if the plan fell through and the ball's about to get away
    if (type && S.touched && (me.plan ? S.time >= me.plan.at - 0.06 : S.bounces === 1 && b.vy > 0)){
      var c = chooseCharge(type, o);
      if (c < 0){ me.swing = SWING_SECS; me.swingType = type; me.skip = true; }   // swung and missed
      else strike(i, type, c);
    }
  }
  function move(p, tx, speed, dt){
    var d = tx - p.x; if (Math.abs(d) < 1.5){ p.moving = false; return; }
    var s = Math.sign(d) * Math.min(Math.abs(d), speed * dt); p.x = Math.max(MINX, Math.min(MAXX, p.x + s)); p.walk += Math.abs(s); p.moving = true;
  }

  // ---- one tick ----
  function stepYou(dt){
    var you = S.you, dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    if (dir){ move(you, you.x + dir * 40, 225, dt); pointerX = null; }
    else if (pointerX != null) move(you, Math.max(MINX, Math.min(MAXX, pointerX - 8)), 225, dt);
    else you.moving = false;
    if (hold){ hold.t += dt; you.charge = Math.min(1, hold.t / CHARGE_SECS); }
    if (you.pending){
      var pd = you.pending; pd.t -= dt;
      if (strike(0, pd.smart && S.phase === 'play' ? smartType(S.ball) : pd.type, pd.c) || pd.t <= 0) you.pending = null;
    }
  }
  function step(dt){
    if (!S) return;
    S.time += dt;
    if (S.msgT > 0) S.msgT -= dt;
    if (S.bubble){ S.bubble.t -= dt; if (S.bubble.t <= 0) S.bubble = null; }
    if (S.you.swing > 0) S.you.swing -= dt;
    if (S.them.swing > 0) S.them.swing -= dt;
    if (S.over) return;
    if (!S.auto[0]) stepYou(dt);
    if (S.phase === 'point'){ S.pause -= dt; if (S.pause <= 0) toServe(S.nextServer); return; }
    if (S.phase === 'serve'){ var sv = P(S.server); S.ball.x = sv.x + 12; S.ball.y = GY - 52 + Math.sin(S.time * 5) * 2; }
    if (S.auto[0]) stepAuto(0, dt);
    stepAuto(1, dt);
    var n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (var i = 0; i < n && S.phase === 'play'; i++) stepBall(dt / n);
  }

  // ---- drawing ----
  function px(x, y, w, h, c){ ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function drawScene(){
    px(0, 0, W, H, '#9fd8f5');
    // a few clouds
    [[60, 50, 46], [200, 30, 34], [430, 60, 40]].forEach(function(c){ px(c[0], c[1], c[2], 10, '#ffffff'); px(c[0] + 8, c[1] - 6, c[2] - 18, 6, '#ffffff'); px(c[0] + 4, c[1] + 10, c[2] - 10, 4, '#e9f6ff'); });
    // trees past the fence
    px(0, GY - 70, 26, 70, '#3fa34d'); px(4, GY - 86, 30, 20, '#57b85f'); px(0, GY - 40, 14, 40, '#2e7d3a');
    // the bathhouse: block wall, a door, the sign
    px(WALL, SOFFIT, W - WALL, GY - SOFFIT, '#d8cbb4');
    for (var y = SOFFIT + 14; y < GY; y += 14) px(WALL, y, W - WALL, 1, '#bfb096');
    for (var r2 = 0, yy = SOFFIT; yy < GY; yy += 14, r2++) for (var x = WALL + (r2 % 2 ? 14 : 0); x < W; x += 28) px(x, yy, 1, 14, '#bfb096');
    px(430, GY - 86, 46, 86, '#5b3a22'); px(434, GY - 82, 38, 78, '#7a4e2d'); px(466, GY - 44, 4, 4, '#FFD23A');
    px(418, GY - 108, 70, 16, '#1b2a4a'); ctx.fillStyle = '#ffffff'; ctx.font = '10px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.fillText('BOYS', 453, GY - 96);
    // the roof: it slopes down to the eave on the deck side, up to the peak, and falls away on the far side
    ctx.fillStyle = '#6b3d26'; ctx.beginPath(); ctx.moveTo(EAVE[0] - 2, EAVE[1] + 2); ctx.lineTo(PEAK[0], PEAK[1]); ctx.lineTo(W, PEAK[1] + 16); ctx.lineTo(W, SOFFIT); ctx.lineTo(EAVE[0] - 2, SOFFIT); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5234'; ctx.beginPath(); ctx.moveTo(EAVE[0] - 2, EAVE[1]); ctx.lineTo(PEAK[0], PEAK[1] - 1); ctx.lineTo(PEAK[0], PEAK[1] + 7); ctx.lineTo(EAVE[0] - 2, EAVE[1] + 8); ctx.closePath(); ctx.fill();
    for (var s = 0.08; s < 1; s += 0.085){ var sx = EAVE[0] + DX * RLEN * s, sy = EAVE[1] + DY * RLEN * s; px(sx, sy + 8, 2, Math.max(2, SOFFIT - sy - 12), '#5a3220'); }
    px(EAVE[0] - 4, EAVE[1], 4, SOFFIT - EAVE[1], '#e8e2d2');           // the fascia board
    px(PEAK[0] - 2, PEAK[1] - 4, 6, 6, '#3c2416');                       // the ridge cap
    // the deck
    px(0, GY, W, H - GY, '#cdccc4');
    for (var gx = 0; gx < W; gx += 40) px(gx, GY, 1, H - GY, '#b3b2a8');
    px(0, GY, W, 2, '#a7a69d'); px(0, GY + 24, W, 1, '#b3b2a8');
    // the fence post at the edge
    px(FENCE - 6, GY - 60, 4, 60, '#9aa0a8'); px(FENCE - 8, GY - 60, 8, 3, '#8d8f93');
  }
  var SKIN = '#f4cdb2', SKIN2 = '#dba887';
  var LOOKS = {
    you: {hair: '#4a3728', shirt: '#FF2E88', shorts: '#1b2a4a', trim: '#ffffff'},
    em: {hair: '#8e6340', shirt: '#f6f6fb', shorts: '#26358c', trim: '#d7263b'},
    guard: {hair: '#c9a15a', shirt: '#d7263b', shorts: '#d7263b', trim: '#ffffff', cross: true, visor: true}
  };
  function shadow(p){ ctx.fillStyle = 'rgba(12,14,28,.2)'; ctx.beginPath(); ctx.ellipse(p.x, GY + 2, 16, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  function drawPerson(p, look){
    var s = 2.5, x0 = p.x - 7 * s, y0 = GY - 27 * s, f = p.moving ? Math.floor(p.walk / 9) % 2 : 0;
    var r = function(x, y, w, h, c){ px(x0 + x * s, y0 + y * s, w * s, h * s, c); };
    shadow(p);
    // legs
    if (p.swing > 0 && p.swingType === 'kick'){ r(3, 21, 3, 6, SKIN); r(7, 21, 7, 3, SKIN); r(13, 20, 2, 3, SKIN2); }
    else { r(3, 21, 3, f ? 5 : 6, SKIN); r(7, 21, 3, f ? 6 : 5, SKIN); r(3, 26, 4, 1, SKIN2); r(7, 26, 4, 1, SKIN2); }
    r(3, 17, 8, 4, look.shorts);
    r(3, 8, 8, 9, look.shirt); r(3, 15, 8, 1, look.trim);
    if (look.cross){ r(6, 10, 2, 5, '#ffffff'); r(5, 12, 4, 1.5, '#ffffff'); }
    // the arm
    if (p.swing > 0 && p.swingType === 'hit'){ r(9, 3, 2, 6, SKIN); r(10, 1, 3, 3, SKIN2); }
    else if (p === S.you && hold){ r(8, 9, 2, 5, SKIN); r(6, 13, 3, 2, SKIN2); }
    else r(8, 9, 2, 7, SKIN);
    // the head
    r(3, 0, 8, 8, SKIN); r(3, 0, 8, 3, look.hair); r(2, 1, 2, 6, look.hair); r(8, 3, 1, 2, '#1d1412'); r(9, 6, 2, 1, '#b8424c');
    if (look.visor){ r(3, 0, 8, 2, '#ffffff'); r(9, 2, 4, 1, '#ffffff'); }
  }
  // Em is the same Em as out on the deck, twice the size
  function drawEm(p){
    var sp = window.PoolLife && window.PoolLife.sprite;
    var name = p.swing > 0 ? (p.swingType === 'hit' ? 'm_wave' : 'm_e1') : p.moving ? 'm_e' + (Math.floor(p.walk / 9) % 2) : 'm_e';
    var a = sp ? sp(name) : null;
    if (!a){ drawPerson(p, LOOKS.em); return; }
    shadow(p);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(a.img, a.r[0], a.r[1], a.r[2], a.r[3], Math.round(p.x - a.r[4] * 2), Math.round(GY - a.r[5] * 2), a.r[2] * 2, a.r[3] * 2);
  }
  function drawBall(){
    var b = S.ball, x = Math.round(b.x), y = Math.round(b.y);
    var sh = Math.max(0.25, 1 - (GY - b.y) / 300);
    ctx.fillStyle = 'rgba(12,14,28,' + (0.22 * sh) + ')'; ctx.beginPath(); ctx.ellipse(x, GY + 2, R * sh + 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (y < -R){ px(x - 4, 4, 8, 3, '#d7263b'); px(x - 2, 7, 4, 3, '#d7263b'); return; }   // up out of sight: a marker at the top
    ctx.fillStyle = '#0A0A0A'; ctx.beginPath(); ctx.arc(x, y, R + 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7263b'; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    // the seam turns as it rolls
    ctx.strokeStyle = '#8f1524'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, R * 0.55, b.spin, b.spin + Math.PI); ctx.stroke();
    ctx.fillStyle = '#ff8b97'; ctx.fillRect(x - 4, y - 5, 3, 2);
  }
  function holdType(){ return !hold ? null : hold.type !== 'smart' ? hold.type : S.phase === 'serve' ? 'hit' : smartType(S.ball); }
  function drawHud(){
    ctx.font = '12px Silkscreen, monospace'; ctx.textAlign = 'left';
    var nm = S.o.name.toUpperCase() + ' ' + S.score[1], nw = ctx.measureText(nm).width;
    px(10, 10, 96 + nw, 26, '#0A0A0A'); ctx.fillStyle = '#00F0FF'; ctx.fillText('YOU ' + S.score[0], 20, 28); ctx.fillStyle = '#FF96C8'; ctx.fillText(nm, 92, 28);
    ctx.fillStyle = '#1b2a4a'; ctx.font = '9px Silkscreen, monospace'; ctx.fillText('FIRST TO ' + TO, 12, 50);
    if (S.rally >= 3 && S.phase === 'play') ctx.fillText('RALLY ' + S.rally, 12, 64);
    // how hard you're winding up. The pink end is where it's likely going over the peak.
    var you = S.you;
    if (hold){
      var bx = you.x - 22, by = GY - 92, k = SHOT[holdType()], danger = Math.max(0, Math.min(1, (0.92 - k.t0) / k.t1));
      px(bx - 1, by - 1, 46, 8, '#0A0A0A'); px(bx, by, 44, 6, '#ffffff'); px(bx + 44 * danger, by, 44 * (1 - danger), 6, '#ffb3bd');
      px(bx, by, 44 * you.charge, 6, you.charge > danger ? '#d7263b' : '#FF2E88');
    }
    if (S.bubble){
      var t = S.bubble.text; ctx.font = '10px Silkscreen, monospace'; var w = ctx.measureText(t).width + 14, ox = Math.max(8, Math.min(W - w - 8, S.them.x - w / 2)), oy = GY - 104;
      px(ox - 2, oy - 2, w + 4, 22, '#0A0A0A'); px(ox, oy, w, 18, '#ffffff'); ctx.fillStyle = '#0A0A0A'; ctx.textAlign = 'left'; ctx.fillText(t, ox + 7, oy + 13);
    }
    if (S.msgT > 0 || S.over){
      ctx.font = '14px Silkscreen, monospace'; ctx.textAlign = 'center'; var mw = ctx.measureText(S.msg).width + 28;
      px(W / 2 - mw / 2 - 2, 76, mw + 4, 34, '#FF2E88'); px(W / 2 - mw / 2, 78, mw, 30, '#0A0A0A'); ctx.fillStyle = '#ffffff'; ctx.fillText(S.msg, W / 2, 98);
    }
    if (S.phase === 'serve' && !S.over && S.msgT <= 0){
      ctx.font = '10px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#1b2a4a';
      ctx.fillText(S.server === 0 ? 'YOUR SERVE. HOLD, THEN LET GO.' : S.o.name.toUpperCase() + ' SERVES.', 170, 92);
    }
  }
  function drawTitle(){
    drawScene();
    px(W / 2 - 206, 96, 412, 150, '#FF2E88'); px(W / 2 - 203, 99, 406, 144, '#0A0A0A');
    ctx.textAlign = 'center'; ctx.fillStyle = '#00F0FF'; ctx.font = '22px Silkscreen, monospace'; ctx.fillText('ROOF BALL', W / 2, 132);
    ctx.fillStyle = '#ffffff'; ctx.font = '10px Silkscreen, monospace';
    ['HIT OR KICK THE BALL UP ON THE ROOF.', 'OVER THE PEAK AND YOU LOSE THE POINT.', 'ONE BOUNCE ON THE DECK, THEN IT GOES BACK UP.', 'FIRST TO 15. PICK WHO YOU PLAY BELOW.'].forEach(function(l, i){ ctx.fillText(l, W / 2, 160 + i * 20); });
  }
  function draw(){
    if (!S){ drawTitle(); return; }
    drawScene();
    if (S.opp === 'em') drawEm(S.them); else drawPerson(S.them, LOOKS.guard);
    drawPerson(S.you, LOOKS.you);
    if (S.ball.live || S.phase === 'serve') drawBall();
    drawHud();
  }
  function loop(now){
    var dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000)); lastT = now;
    step(dt); draw();
    raf = ov.hidden ? null : requestAnimationFrame(loop);
  }

  // ---- the page around it ----
  // The game only reports what happened. The crew card decides what it's worth, so the points can move to the server later.
  function tell(kind, d){ var det = {kind: kind}; for (var k in d) det[k] = d[k]; try { window.dispatchEvent(new CustomEvent('leva-roofball', {detail: det})); } catch (e) {} }
  function emHere(){ try { return !!(window.PoolLife && window.PoolLife.chat && window.PoolLife.chat.who('m').here); } catch (e) { return false; } }
  function showPick(again){
    ui.pick.hidden = false; ui.pad.hidden = true;
    var here = emHere();
    ui.em.disabled = !here; ui.em.textContent = here ? (again ? 'Play Em again' : 'Play Em') : "Em's not at the pool";
    ui.guard.textContent = again ? 'Play a lifeguard again' : 'Play a lifeguard';
  }
  function start(opp){
    newGame(opp); ui.pick.hidden = true; ui.pad.hidden = false; hold = null; keys = {}; pointerX = null;
    announce('Roof ball against ' + S.o.name + '. First to ' + TO + '. Your serve.');
    try { C.focus(); } catch (e) {}
  }
  function open(){
    opener = document.activeElement; ov.hidden = false; S = null; showPick(false); draw();
    lastT = performance.now(); if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    (ui.em.disabled ? ui.guard : ui.em).focus();
  }
  function close(){
    ov.hidden = true; if (raf) cancelAnimationFrame(raf); raf = null; hold = null; keys = {};
    if (opener && opener.focus) opener.focus();
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-roofball]'), function(b){ b.addEventListener('click', open); });
  ui.close.addEventListener('click', close);
  ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
  ui.em.addEventListener('click', function(){ if (!ui.em.disabled) start('em'); });
  ui.guard.addEventListener('click', function(){ start('guard'); });
  function toX(e){ var r = C.getBoundingClientRect(); return (e.clientX - r.left) * (W / r.width); }
  // mouse: the player follows the pointer, and holding the button winds up a swing. Touch: drag to move, buttons to swing.
  C.addEventListener('mousemove', function(e){ if (S && !S.over) pointerX = toX(e); });
  C.addEventListener('mousedown', function(e){ if (!S || S.over) return; e.preventDefault(); pointerX = toX(e); press('smart'); });
  window.addEventListener('mouseup', function(){ if (hold && hold.type === 'smart' && !hold.key) release(); });
  C.addEventListener('touchstart', function(e){ if (!S || S.over) return; e.preventDefault(); pointerX = toX(e.touches[0]); }, {passive: false});
  C.addEventListener('touchmove', function(e){ if (!S || S.over) return; e.preventDefault(); pointerX = toX(e.touches[0]); }, {passive: false});
  function padHold(el, down, up){
    if (window.PointerEvent){
      el.addEventListener('pointerdown', function(e){ e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {} down(); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(t){ el.addEventListener(t, function(){ up(); }); });
    } else {   // older phones
      el.addEventListener('touchstart', function(e){ e.preventDefault(); down(); }, {passive: false});
      ['touchend', 'touchcancel'].forEach(function(t){ el.addEventListener(t, function(e){ e.preventDefault(); up(); }); });
      el.addEventListener('mousedown', function(e){ e.preventDefault(); down(); });
      window.addEventListener('mouseup', function(){ up(); });
    }
    el.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }
  padHold(ui.left, function(){ keys.left = true; }, function(){ keys.left = false; });
  padHold(ui.right, function(){ keys.right = true; }, function(){ keys.right = false; });
  padHold(ui.hit, function(){ press('hit'); }, function(){ if (hold && hold.type === 'hit' && !hold.key) release(); });
  padHold(ui.kick, function(){ press('kick'); }, function(){ if (hold && hold.type === 'kick' && !hold.key) release(); });
  // keyboard: arrows or A and D to move, J to hit, K to kick, Space does whichever fits
  var KEYMAP = {j: 'hit', z: 'hit', k: 'kick', x: 'kick', ' ': 'smart'};
  function lower(e){ return e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key; }
  window.addEventListener('keydown', function(e){
    if (ov.hidden) return;
    if (e.key === 'Escape'){ close(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(BUTTON|INPUT|A)$/.test(e.target.tagName) && (e.key === ' ' || e.key === 'Enter')) return;   // let buttons be buttons
    if (!S) return;
    var key = lower(e);
    if (S.over){ if (key === 'Enter'){ e.preventDefault(); start(S.opp === 'em' && !emHere() ? 'guard' : S.opp); } return; }
    if (key === 'ArrowLeft' || key === 'a'){ keys.left = true; e.preventDefault(); }
    else if (key === 'ArrowRight' || key === 'd'){ keys.right = true; e.preventDefault(); }
    else if (KEYMAP[key]){ e.preventDefault(); if (!e.repeat && !hold){ press(KEYMAP[key]); if (hold) hold.key = key; } }
  });
  window.addEventListener('keyup', function(e){
    if (ov.hidden) return;
    var key = lower(e);
    if (key === 'ArrowLeft' || key === 'a') keys.left = false;
    else if (key === 'ArrowRight' || key === 'd') keys.right = false;
    else if (hold && hold.key === key) release();
  });
  window.addEventListener('blur', function(){ keys = {}; hold = null; if (S) S.you.charge = 0; });

  // with a ?do= test switch on, the game is open to the console for checking
  if (/[?&]do=/.test(location.search)) window.__roofball = {
    open: open, close: close, start: start, step: step, draw: draw, press: press, release: release, strike: strike, launch: launch, fly: fly, outcome: outcome, planFor: planFor, aimT: aimT, reach: reach,
    state: function(){ return S; }, held: function(){ return hold; }, keys: function(){ return keys; }, OPPS: OPPS,
    K: {W: W, H: H, GY: GY, R: R, EAVE: EAVE, PEAK: PEAK, WALL: WALL, TO: TO, SHOT: SHOT, MINX: MINX, MAXX: MAXX},
    // let a computer player take your side too, to check that whole games play out
    auto: function(skill){ S.auto[0] = skill ? (OPPS[skill] || skill) : null; }
  };
})();
