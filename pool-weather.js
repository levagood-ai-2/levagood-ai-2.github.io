// pool-weather.js: real Dearborn weather on the Levagood Pool map.
// Conditions come from the National Weather Service (api.weather.gov, free open data): the latest
// observation at Detroit Metro (KDTW) and any active alerts for Dearborn. If it rains in Dearborn,
// it rains on the deck. Thunder clears the pool. Snow piles up and leva shovels it. A tornado warning
// sends everybody inside and puts the warning above the map.
// Test any weather with ?wx= and one of: clear clouds fog drizzle rain downpour storm snow blizzard sleet wind heat cold tornado
(function(){
  'use strict';
  var POINT = '42.3223,-83.1763', STATION = 'KDTW', STATION_NAME = 'Detroit Metro';
  var OBS_URL = 'https://api.weather.gov/stations/' + STATION + '/observations/latest';
  var ALERT_URL = 'https://api.weather.gov/alerts/active?point=' + POINT;
  var TEST = (new URLSearchParams(location.search).get('wx') || '').toLowerCase();

  var W = window.PoolWeather = {
    kind: 'clear', intensity: 0, cover: 0, tempF: null, windMph: 0, gustMph: 0, windFrom: null,
    words: '', observedAt: null, alert: null, alerts: [], thunderAt: 0, flashAt: 0, snow: 0,
    ok: false, failed: false, test: TEST || null, station: STATION_NAME,
    closedForWeather: closedForWeather, reason: reason, clearSnow: clearSnow, pawPrint: pawPrint,
    init: init, step: step
  };

  // ================= reading the weather =================
  var COVER = {FEW: 0.2, SCT: 0.45, BKN: 0.75, OVC: 1, VV: 1};
  function parseMetar(raw){
    var out = {codes: [], cover: 0};
    if (!raw) return out;
    var toks = raw.trim().split(/\s+/), rmk = toks.indexOf('RMK');
    if (rmk > 0) toks = toks.slice(0, rmk);
    toks.slice(2).forEach(function(t){
      var c = t.match(/^(FEW|SCT|BKN|OVC|VV)\d{3}/);
      if (c){ out.cover = Math.max(out.cover, COVER[c[1]]); return; }
      var w = t.match(/^(-|\+|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)*)$/);
      if (w && (w[2] || w[3])) out.codes.push({mod: w[1] || '', desc: w[2] || '', ph: w[3] || ''});
    });
    return out;
  }
  function level(c){ return c.mod === '+' ? 1 : c.mod === '-' ? 0.35 : 0.65; }
  function decide(m){
    var here = m.codes.filter(function(c){ return c.mod !== 'VC'; });
    function any(list, re){ return list.filter(function(c){ return re.test(c.desc + c.ph); }); }
    var fc = any(m.codes, /FC/), ts = any(m.codes, /TS/);
    var sn = any(here, /SN|SG/), rn = any(here, /RA/), dz = any(here, /DZ/), ice = any(here, /PL|IC|GR|GS|FZRA|FZDZ/), fog = any(here, /FG|BR/), haze = any(here, /HZ|FU/);
    var wet = rn.concat(dz).concat(sn).concat(ice), top = wet.reduce(function(a, c){ return Math.max(a, level(c)); }, 0);
    if (fc.length) return {kind: 'tornado', intensity: 1};
    if (ts.length) return {kind: 'storm', intensity: Math.max(0.45, top)};
    if (ice.length || (sn.length && rn.length)) return {kind: 'sleet', intensity: Math.max(0.4, top)};
    if (sn.length) return {kind: 'snow', intensity: top};
    if (rn.length) return {kind: 'rain', intensity: top};
    if (dz.length) return {kind: 'drizzle', intensity: 0.25};
    if (fog.length) return {kind: 'fog', intensity: any(fog, /FG/).length ? 0.85 : 0.45};
    if (haze.length) return {kind: 'fog', intensity: 0.25};
    return {kind: m.cover >= 0.45 ? 'clouds' : 'clear', intensity: m.cover};
  }
  function fromWords(t){
    t = (t || '').toLowerCase();
    if (/tornado|funnel/.test(t)) return {kind: 'tornado', intensity: 1};
    if (/thunder/.test(t)) return {kind: 'storm', intensity: 0.65};
    if (/sleet|freezing|ice pellet|hail/.test(t)) return {kind: 'sleet', intensity: 0.5};
    if (/snow/.test(t)) return {kind: 'snow', intensity: /heavy/.test(t) ? 1 : /light/.test(t) ? 0.35 : 0.65};
    if (/rain|shower/.test(t)) return {kind: 'rain', intensity: /heavy/.test(t) ? 1 : /light/.test(t) ? 0.35 : 0.65};
    if (/drizzle/.test(t)) return {kind: 'drizzle', intensity: 0.25};
    if (/fog|mist/.test(t)) return {kind: 'fog', intensity: 0.6};
    if (/overcast|cloudy/.test(t)) return {kind: 'clouds', intensity: /mostly|overcast/.test(t) ? 0.85 : 0.5};
    return null;
  }
  var WORDS = {clear: 'Clear', clouds: 'Cloudy', fog: 'Fog', drizzle: 'Drizzle', rain: 'Rain', storm: 'Thunderstorm', snow: 'Snow', sleet: 'Sleet and freezing rain', tornado: 'Tornado'};
  function describe(k, i){
    if (k === 'rain' || k === 'snow') return i >= 0.9 ? 'Heavy ' + k : i <= 0.4 ? 'Light ' + k : WORDS[k];
    if (k === 'clouds') return i >= 0.9 ? 'Overcast' : i >= 0.7 ? 'Mostly cloudy' : 'Partly cloudy';
    if (k === 'clear') return i >= 0.15 ? 'Mostly clear' : 'Clear';
    return WORDS[k];
  }
  function applyObs(p){
    // the five-minute reports often leave the raw METAR empty; rebuild it from the structured fields
    var raw = p.rawMessage;
    if (!raw){
      var toks = ['KDTW', '000000Z'];
      (p.presentWeather || []).forEach(function(w){ if (w && w.rawString) toks.push(w.rawString); });
      (p.cloudLayers || []).forEach(function(c){ if (c && c.amount && COVER[c.amount]) toks.push(c.amount + '000'); });
      raw = toks.length > 2 ? toks.join(' ') : '';
    }
    var m = parseMetar(raw), d = decide(m), t = fromWords(p.textDescription);
    // the codes come first; the plain words fill in when the codes say nothing
    if (t && (d.kind === 'clear' || d.kind === 'clouds') && (t.kind !== 'clouds' || !m.cover)) d = t;
    var when = p.timestamp ? Date.parse(p.timestamp) : Date.now();
    if (Date.now() - when > 3 * 3600000){ W.ok = false; W.failed = true; return; }
    W.kind = d.kind; W.intensity = d.intensity; W.cover = m.cover;
    W.tempF = p.temperature && p.temperature.value != null ? Math.round(p.temperature.value * 9 / 5 + 32) : null;
    W.windMph = p.windSpeed && p.windSpeed.value != null ? Math.round(p.windSpeed.value * 0.6214) : 0;
    W.gustMph = p.windGust && p.windGust.value != null ? Math.round(p.windGust.value * 0.6214) : 0;
    W.windFrom = p.windDirection ? p.windDirection.value : null;
    W.observedAt = when;
    W.words = p.textDescription || describe(W.kind, W.intensity);
    if (W.kind === 'storm') W.thunderAt = Math.max(W.thunderAt, W.observedAt);
    if (!W.ok && (W.kind === 'snow' || W.kind === 'sleet')) prefillSnow(0.35 + 0.3 * W.intensity);
    W.ok = true; W.failed = false;
  }
  function prefillSnow(amount){
    if (!snowCx || !deckCells) return;
    snowCx.fillStyle = 'rgba(250,252,255,.55)';
    var n = Math.round(deckCells.length * amount * 1.6);
    for (var i = 0; i < n; i++){ var c = deckCells[Math.floor(Math.random() * deckCells.length)]; snowCx.fillRect((c % world.GW) * 2, ((c / world.GW) | 0) * 2, 2, 2); }
    W.snow = Math.max(W.snow, amount);
  }
  var RANK = [/^Tornado Warning/, /^Severe Thunderstorm Warning/, /^Tornado Watch/, /^Severe Thunderstorm Watch/, /Warning$/, /Watch$/, /./];
  function rank(ev){ for (var i = 0; i < RANK.length; i++) if (RANK[i].test(ev)) return i; return 9; }
  function applyAlerts(features){
    W.alerts = (features || []).map(function(f){ var p = f.properties || {}; return {event: p.event || 'Weather alert', headline: p.headline || '', ends: p.ends || p.expires || null, severity: p.severity || ''}; })
      .sort(function(a, b){ return rank(a.event) - rank(b.event); });
    W.alert = W.alerts[0] || null;
  }
  function getJSON(url){
    return fetch(url, {headers: {Accept: 'application/geo+json'}, cache: 'no-cache'}).then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  var obsTimer = null, alertTimer = null;
  function pollObs(){
    if (document.hidden){ obsTimer = setTimeout(pollObs, 60000); return; }
    getJSON(OBS_URL).then(function(j){ applyObs(j.properties || {}); changed(); }, function(){ W.failed = !W.ok; changed(); })
      .then(function(){ obsTimer = setTimeout(pollObs, 8 * 60000); });
  }
  function pollAlerts(){
    if (document.hidden){ alertTimer = setTimeout(pollAlerts, 60000); return; }
    getJSON(ALERT_URL).then(function(j){ applyAlerts(j.features); changed(); }, function(){})
      .then(function(){ alertTimer = setTimeout(pollAlerts, 3 * 60000); });
  }
  var TESTS = {
    clear: {kind: 'clear', intensity: 0, tempF: 82, windMph: 6},
    clouds: {kind: 'clouds', intensity: 0.9, tempF: 74, windMph: 9},
    fog: {kind: 'fog', intensity: 0.8, tempF: 61, windMph: 2},
    drizzle: {kind: 'drizzle', intensity: 0.25, tempF: 66, windMph: 5},
    rain: {kind: 'rain', intensity: 0.65, tempF: 70, windMph: 10},
    downpour: {kind: 'rain', intensity: 1, tempF: 71, windMph: 14},
    storm: {kind: 'storm', intensity: 0.9, tempF: 76, windMph: 18, gustMph: 34},
    snow: {kind: 'snow', intensity: 0.65, tempF: 29, windMph: 8},
    blizzard: {kind: 'snow', intensity: 1, tempF: 22, windMph: 30, gustMph: 45},
    sleet: {kind: 'sleet', intensity: 0.6, tempF: 32, windMph: 12},
    wind: {kind: 'clouds', intensity: 0.6, tempF: 68, windMph: 28, gustMph: 44},
    heat: {kind: 'clear', intensity: 0, tempF: 93, windMph: 4},
    cold: {kind: 'clouds', intensity: 0.7, tempF: 52, windMph: 11},
    tornado: {kind: 'tornado', intensity: 1, tempF: 74, windMph: 40, gustMph: 65,
      alert: {event: 'Tornado Warning', headline: 'Test only. This is not a real warning.', ends: null, severity: 'Extreme'}}
  };
  function useTest(){
    var t = TESTS[TEST] || TESTS.clear;
    W.kind = t.kind; W.intensity = t.intensity; W.tempF = t.tempF; W.windMph = t.windMph; W.gustMph = t.gustMph || 0; W.windFrom = 270;
    W.words = describe(W.kind, W.intensity); W.observedAt = Date.now(); W.ok = true;
    W.alert = t.alert || null; W.alerts = t.alert ? [t.alert] : [];
    if (W.kind === 'storm') W.thunderAt = Date.now();
    if (W.kind === 'snow' || W.kind === 'sleet') prefillSnow(W.kind === 'snow' ? 0.3 + 0.4 * W.intensity : 0.25);
    changed();
  }

  // ================= what the weather means on the deck =================
  function stormy(){ return W.kind === 'storm' || (W.thunderAt && Date.now() - W.thunderAt < 30 * 60000) || (W.alert && /^Severe Thunderstorm Warning/.test(W.alert.event)); }
  function tornado(){ return W.kind === 'tornado' || !!(W.alert && /^Tornado Warning/.test(W.alert.event)); }
  function closedForWeather(){ return tornado() || stormy() || W.kind === 'snow' || W.kind === 'sleet' || (W.tempF != null && W.tempF < 60); }
  function reason(){
    if (tornado()) return 'tornado';
    if (stormy()) return 'storm';
    if (W.kind === 'snow' || W.kind === 'sleet') return 'snow';
    if (W.tempF != null && W.tempF < 60) return 'cold';
    if (W.kind === 'rain' || W.kind === 'drizzle') return 'rain';
    if (W.tempF != null && W.tempF >= 88) return 'heat';
    if (W.windMph >= 22 || W.gustMph >= 32) return 'wind';
    if (W.kind === 'fog' && W.intensity >= 0.6) return 'fog';
    return null;
  }
  W.stormy = stormy; W.tornado = tornado;

  // ================= the board and the warning banner =================
  var listeners = [];
  W.onChange = function(fn){ listeners.push(fn); };
  function compass(d){ if (d == null) return ''; return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(((d % 360) + 360) % 360 / 45) % 8]; }
  function ago(ts){ var s = (Date.now() - ts) / 1000; if (s < 90) return 'just now'; if (s < 5400) return Math.round(s / 60) + ' min ago'; return Math.round(s / 3600) + ' h ago'; }
  function until(ts){ if (!ts) return ''; var d = new Date(ts); var h = d.getHours(), m = d.getMinutes(); return ' until ' + (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm'); }
  W.summary = function(){
    if (!W.ok) return W.failed ? "Can't reach the weather service right now." : 'Checking the weather...';
    var bits = [W.words || describe(W.kind, W.intensity)];
    if (W.windMph) bits.push('wind ' + W.windMph + ' mph' + (W.windFrom != null ? ' from the ' + compass(W.windFrom) : '') + (W.gustMph ? ', gusts to ' + W.gustMph : ''));
    return bits.join(', ') + '.';
  };
  W.source = function(){
    if (W.test) return 'Test weather: ' + W.test + '. Take ?wx= off the address for the real thing.';
    if (!W.ok) return 'National Weather Service, ' + STATION_NAME + '.';
    return 'National Weather Service at ' + STATION_NAME + ', ' + ago(W.observedAt) + '.';
  };
  var SAFE = {
    'Tornado Warning': "If you're in Dearborn, take shelter now: a basement, or an inside room on the lowest floor, away from windows.",
    'Severe Thunderstorm Warning': "If you're in Dearborn, get inside a sturdy building and stay away from windows.",
    'Tornado Watch': 'Conditions are right for tornadoes. Know where you would take shelter.',
    'Flash Flood Warning': "Never drive or walk through flood water. Turn around, don't drown."
  };
  function changed(){
    var b = document.getElementById('b-temp');
    if (b) b.textContent = W.tempF != null ? W.tempF + '°' : '--';
    var d = document.getElementById('b-wxdesc'); if (d) d.textContent = W.summary();
    var s = document.getElementById('b-wxsrc'); if (s) s.textContent = W.source();
    var r = document.getElementById('b-wxpool');
    if (r && !W.ok){ r.textContent = ''; r.className = 'wx-pool'; }
    else if (r){
      var why = reason();
      r.textContent = why === 'tornado' ? 'Everybody is inside until the warning ends.' : why === 'storm' ? 'Pool is closed for lightning until 30 minutes after the last thunder.'
        : why === 'snow' ? 'No swimming. leva is shoveling.' : why === 'cold' ? 'Too cold to swim today.' : why === 'rain' ? 'Rain is fine. Thunder is not. leva is listening.'
        : why === 'heat' ? 'Hot one. Drink water and reapply sunscreen.' : why === 'wind' ? 'Windy. Leaves everywhere, so leva has the net out.'
        : why === 'fog' ? 'Foggy. Swim where the guards can see you.' : 'Good weather for the pool.';
      r.className = 'wx-pool' + (why === 'tornado' || why === 'storm' ? ' bad' : '');
    }
    var bn = document.getElementById('wx-alert');
    if (bn){
      var a = W.alert;
      bn.hidden = !a;
      if (a){
        var warn = /Warning$/.test(a.event), watch = /Watch$/.test(a.event);
        bn.className = 'wx-alert ' + (warn ? 'warn' : watch ? 'watch' : 'advisory');
        document.getElementById('wx-alert-title').textContent = a.event + ' for Dearborn' + until(a.ends);
        document.getElementById('wx-alert-text').textContent = (a.headline ? a.headline + ' ' : '') + (SAFE[a.event] || '');
      }
    }
    listeners.forEach(function(fn){ try { fn(W); } catch (e) {} });
  }

  // ================= drawing it =================
  var cv = null, cx = null, world = null, snowCv = null, snowCx = null, deckCells = null, waterCells = null;
  var drops = [], flakes = [], rings = [], debris = [], fogs = [], flash = 0, nextFlash = 2.5, bolt = null, T = 0;
  function init(canvas, w){
    cv = canvas; cx = cv.getContext('2d'); world = w;
    snowCv = document.createElement('canvas'); snowCv.width = 720; snowCv.height = 420; snowCx = snowCv.getContext('2d');
    deckCells = []; waterCells = [];
    for (var i = 0; i < w.N; i++){ if (w.DECK[i]) deckCells.push(i); if (w.SWIM[i]) waterCells.push(i); }
    for (var k = 0; k < 6; k++) fogs.push({x: Math.random() * 1440, y: Math.random() * 840, r: 180 + Math.random() * 220, v: 6 + Math.random() * 10});
    if (TEST) useTest(); else { changed(); pollObs(); pollAlerts(); }
  }
  function clearSnow(x, y, r){
    if (!snowCx || W.snow <= 0) return;
    snowCx.save(); snowCx.globalCompositeOperation = 'destination-out'; snowCx.beginPath(); snowCx.arc(x, y, r, 0, Math.PI * 2); snowCx.fill(); snowCx.restore();
    // each pass clears a thin strip; count it against the whole deck
    W.snow = Math.max(0, W.snow - W.snow * r * 0.5 / 73000);
  }
  function pawPrint(x, y, side){
    if (!snowCx || W.snow < 0.08) return;
    snowCx.save(); snowCx.globalCompositeOperation = 'destination-out'; snowCx.fillStyle = 'rgba(0,0,0,.85)';
    snowCx.fillRect(Math.round(x + (side ? 1 : -2)), Math.round(y), 1, 1); snowCx.restore();
  }
  function windPush(){ var from = W.windFrom == null ? 270 : W.windFrom, to = (from + 180) * Math.PI / 180; return Math.sin(to) * Math.min(1, W.windMph / 30); }
  function fillTo(list, n, make){ while (list.length < n) list.push(make(true)); if (list.length > n) list.length = n; }
  function step(dt, night){
    if (!cx) return;
    T += dt;
    cx.clearRect(0, 0, 1440, 840);
    var k = W.kind, I = W.intensity, push = windPush(), dim = night ? 0.5 : 1;
    // the sky over the whole park
    var tint = {clouds: [30, 40, 60, 0.12 * I], fog: [226, 231, 237, 0.28 * I], drizzle: [40, 55, 80, 0.14], rain: [40, 55, 80, 0.14 + 0.14 * I],
      storm: [22, 28, 48, 0.36], snow: [228, 234, 244, 0.1 + 0.08 * I], sleet: [60, 75, 95, 0.22], tornado: [44, 68, 38, 0.46]}[k];
    if (tint){ cx.fillStyle = 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',' + (tint[3] * (k === 'fog' || k === 'snow' ? 1 : dim)).toFixed(3) + ')'; cx.fillRect(0, 0, 1440, 840); }
    if (k === 'clear' && W.tempF != null && W.tempF >= 88 && !night){ cx.fillStyle = 'rgba(255,170,60,.06)'; cx.fillRect(0, 0, 1440, 840); }
    // snow on the deck: it piles up while it snows and melts when it warms up
    var snowing = k === 'snow' || (k === 'sleet' && I > 0.3);
    if (snowing){
      var want2 = I * 90 * dt, n = Math.floor(want2) + (Math.random() < want2 % 1 ? 1 : 0);
      snowCx.fillStyle = 'rgba(250,252,255,.55)';
      for (var s = 0; s < n; s++){ var c = deckCells[Math.floor(Math.random() * deckCells.length)]; snowCx.fillRect((c % world.GW) * 2, ((c / world.GW) | 0) * 2, 2, 2); }
      W.snow = Math.min(1, W.snow + I * dt / 240);
    } else if (W.snow > 0 && (W.tempF == null || W.tempF > 33)){
      snowCx.save(); snowCx.globalCompositeOperation = 'destination-out'; snowCx.fillStyle = 'rgba(0,0,0,' + Math.min(1, dt * 0.02).toFixed(4) + ')'; snowCx.fillRect(0, 0, 720, 420); snowCx.restore();
      W.snow = Math.max(0, W.snow - dt / 400);
    }
    if (W.snow > 0.001){ cx.imageSmoothingEnabled = false; cx.drawImage(snowCv, 0, 0, 1440, 840); }
    // rain: streaks across the park, rings on the pools
    var rainy = k === 'rain' || k === 'drizzle' || k === 'storm' || k === 'sleet' || k === 'tornado';
    var want = rainy ? Math.round((k === 'drizzle' ? 90 : 120 + 520 * I) * (k === 'tornado' ? 1.3 : 1)) : 0;
    fillTo(drops, want, function(){ return {x: Math.random() * 1500 - 30, y: Math.random() * 840, v: 650 + Math.random() * 350, l: 9 + Math.random() * 9}; });
    if (drops.length){
      var slant = push * 0.45 + (k === 'tornado' ? 0.8 : 0);
      cx.strokeStyle = night ? 'rgba(190,210,255,.5)' : 'rgba(215,228,250,.55)'; cx.lineWidth = k === 'drizzle' ? 1 : 1.3;
      cx.beginPath();
      drops.forEach(function(d){
        d.y += d.v * dt; d.x += d.v * slant * dt;
        if (d.y > 850 || d.x > 1470 || d.x < -40){ d.y = -20 - Math.random() * 60; d.x = Math.random() * 1500 - 30; }
        cx.moveTo(d.x, d.y); cx.lineTo(d.x - d.l * slant, d.y - d.l);
      });
      cx.stroke();
      var spawn = (k === 'drizzle' ? 6 : 12 + 40 * I) * dt;
      while (spawn > 0){ if (Math.random() < spawn){ var wc = waterCells[Math.floor(Math.random() * waterCells.length)]; rings.push({x: (wc % world.GW) * 4 + 2, y: ((wc / world.GW) | 0) * 4 + 2, t: 0}); } spawn -= 1; }
    }
    rings = rings.filter(function(r){
      r.t += dt; if (r.t > 0.6) return false;
      var p = r.t / 0.6; cx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - p)).toFixed(3) + ')'; cx.lineWidth = 1;
      cx.beginPath(); cx.ellipse(r.x, r.y, 2 + p * 9, (2 + p * 9) * 0.45, 0, 0, Math.PI * 2); cx.stroke();
      return true;
    });
    // snow falling
    var wantF = snowing ? Math.round(80 + 380 * I) : 0;
    fillTo(flakes, wantF, function(){ return {x: Math.random() * 1500 - 30, y: Math.random() * 840, v: 35 + Math.random() * 45, ph: Math.random() * 6.28, s: Math.random() < 0.3 ? 3 : 2}; });
    if (flakes.length){
      cx.fillStyle = 'rgba(255,255,255,.92)';
      flakes.forEach(function(f){
        f.y += f.v * dt; f.x += (Math.sin(T * 1.6 + f.ph) * 14 + push * 60) * dt;
        if (f.y > 850){ f.y = -10; f.x = Math.random() * 1500 - 30; }
        if (f.x > 1470) f.x = -20; if (f.x < -30) f.x = 1460;
        cx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
      });
    }
    // fog rolls through in soft banks
    if (k === 'fog'){
      fogs.forEach(function(f){
        f.x += f.v * dt; if (f.x - f.r > 1440) f.x = -f.r;
        var g = cx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, 'rgba(236,240,245,' + (0.4 * I).toFixed(3) + ')'); g.addColorStop(1, 'rgba(236,240,245,0)');
        cx.fillStyle = g; cx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      });
    }
    // wind carries leaves and twigs across; a tornado carries a lot of them
    var gusty = k === 'tornado' ? 90 : W.gustMph >= 30 || W.windMph >= 22 ? 14 : 0;
    fillTo(debris, gusty, function(){ return {x: Math.random() * 1440, y: Math.random() * 840, v: 220 + Math.random() * 380, ph: Math.random() * 6.28, c: ['#6b8e23', '#8a6a3a', '#a7c957', '#5a4630'][Math.floor(Math.random() * 4)]}; });
    debris.forEach(function(p){
      var dir = k === 'tornado' ? 1 : (push >= 0 ? 1 : -1);
      p.x += p.v * dir * dt; p.y += Math.sin(T * 3 + p.ph) * 60 * dt; p.ph += dt * 2;
      if (p.x > 1460) p.x = -10; if (p.x < -20) p.x = 1450;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.ph * 2); cx.fillStyle = p.c; cx.fillRect(-2, -1, 4, 2); cx.restore();
    });
    // lightning
    if (k === 'storm' || k === 'tornado'){
      nextFlash -= dt;
      if (nextFlash <= 0){
        flash = 1; nextFlash = 7 + Math.random() * 16; W.flashAt = Date.now(); W.thunderAt = Date.now();
        if (Math.random() < 0.6){
          var bx = 150 + Math.random() * 1140, by = 0, pts = [[bx, by]];
          while (by < 260 + Math.random() * 260){ by += 18 + Math.random() * 26; bx += (Math.random() - 0.5) * 60; pts.push([bx, by]); }
          bolt = pts;
        } else bolt = null;
      }
    }
    if (flash > 0){
      if (bolt && flash > 0.45){
        cx.strokeStyle = 'rgba(255,255,255,' + flash.toFixed(3) + ')'; cx.lineWidth = 3; cx.shadowColor = 'rgba(190,210,255,.9)'; cx.shadowBlur = 16;
        cx.beginPath(); bolt.forEach(function(p, i){ i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }); cx.stroke(); cx.shadowBlur = 0;
      }
      cx.fillStyle = 'rgba(245,248,255,' + (0.55 * flash * flash).toFixed(3) + ')'; cx.fillRect(0, 0, 1440, 840);
      flash = Math.max(0, flash - dt * 3.2);
    }
  }
})();
