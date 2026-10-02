// The deck radio. We always had the radio on during pool hours, so it comes on when the pool opens and goes off at
// close. The power button turns it on or off anytime, and the dial changes the station. These are real stations,
// played live from each station's own published stream. Nothing is recorded or stored here.
(function(){
  'use strict';
  // Detroit FM stations sit on the dial at their frequency. The ones without a Detroit signal live in the WEB band
  // at the end of the dial, the way an internet radio adds them after FM.
  var STATIONS = [
    {id: 'wnic', freq: '100.3', mhz: 100.3, call: 'WNIC', about: "Detroit's variety: the 80s, the 90s and today", url: 'https://stream.revma.ihrhls.com/zc1153'},
    {id: 'klove', freq: '102.7', mhz: 102.7, call: 'K-LOVE', about: 'Positive, encouraging Christian music', url: 'https://maestro.emfcdn.com/stream_for/k-love/web/aac'},
    {id: 'air1', web: true, call: 'AIR1', name: 'Air1', about: 'Worship music', url: 'https://maestro.emfcdn.com/stream_for/air1/web/aac'},
    {id: 'moody', web: true, call: 'MOODY', name: 'Moody Radio', about: 'Christian teaching and music, from WMBI Chicago', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WMBIFM.mp3'},
    {id: 'afr', web: true, call: 'AFR', name: 'American Family Radio', about: 'Christian talk and teaching', url: 'https://mediaserver3.afa.net:8443/talk.mp3'}
  ];
  // how a station reads out loud: 100.3 WNIC, Air1, Moody Radio
  STATIONS.forEach(function(s){ s.label = s.freq ? s.freq + ' ' + s.call : s.name; });
  var KEY = 'levagood-radio-v1';
  var prefs = {station: 'wnic', vol: 0.7, auto: true, offDay: ''};
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') for (var k in prefs) if (saved[k] !== undefined) prefs[k] = saved[k]; } catch (e) {}
  if (!STATIONS.some(function(s){ return s.id === prefs.station; })) prefs.station = 'wnic';
  prefs.vol = Math.round(Math.max(0, Math.min(1, +prefs.vol || 0)) * 10) / 10;
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function station(){ for (var i = 0; i < STATIONS.length; i++) if (STATIONS[i].id === prefs.station) return STATIONS[i]; return STATIONS[0]; }
  function poolOpen(){ var p = document.querySelector('.park'); return !!(p && p.dataset.open === '1'); }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = document.getElementById('radio'); if (!root) return;
  var q = function(id){ return document.getElementById(id); };
  var ui = {power: q('r-power'), down: q('r-down'), up: q('r-up'), dial: q('r-dial'), needle: q('r-needle'), lcd: q('r-lcd'), freq: q('r-freq'), call: q('r-call'),
    panel: q('r-panel'), list: q('r-list'), auto: q('r-auto'), vol: q('r-vol'), live: q('r-live'), volGrp: q('r-volgrp'), volDn: q('r-voldn'), volUp: q('r-volup'), meter: q('r-vmeter'), volLbl: q('r-vollbl')};

  // ---- the sound ----
  var audio = new Audio(); audio.preload = 'none'; audio.volume = prefs.vol;
  // off, waiting (it should be on, but the browser needs one tap first), tuning (connecting), on, nosignal
  var state = 'off', wantOn = false, retries = 0, retryT = null, stallT = null, flashT = null;
  function setState(s){
    state = s;
    root.dataset.state = s;
    ui.power.setAttribute('aria-pressed', String(wantOn));
    var st = station();
    clearTimeout(flashT); flashT = null;
    ui.call.textContent = s === 'waiting' ? 'TAP TO PLAY' : s === 'nosignal' ? 'NO SIGNAL' : s === 'tuning' ? 'TUNING' : s === 'off' ? 'OFF' : st.call;
    var say = s === 'on' ? 'Radio on, ' + st.label + '.' : s === 'waiting' ? 'The radio is on for pool hours. Tap or click anywhere on the page to hear it.' : s === 'nosignal' ? "Can't reach " + st.call + ' right now.' : s === 'off' ? 'Radio off.' : '';
    if (say && ui.live.textContent !== say) ui.live.textContent = say;
    ui.power.title = wantOn ? 'Turn the radio off' : 'Turn the radio on';
  }
  function stopAudio(){
    clearTimeout(stallT); stallT = null;
    try { audio.pause(); } catch (e) {}
    // dropping the source closes the stream, so nothing downloads while the radio is off
    audio.removeAttribute('src'); try { audio.load(); } catch (e) {}
  }
  function start(){
    clearTimeout(retryT); retryT = null;
    stopAudio();
    if (!wantOn) return;
    audio.src = station().url; audio.volume = prefs.vol;
    setState('tuning');
    var p;
    try { p = audio.play(); } catch (e) { p = null; }
    if (p && p.catch) p.catch(function(e){
      if (!wantOn) return;
      if (e && e.name === 'NotAllowedError'){ stopAudio(); setState('waiting'); armGesture(); }
      else if (e && e.name !== 'AbortError') noSignal();
    });
    stallT = setTimeout(function(){ if (wantOn && state === 'tuning') noSignal(); }, 15000);
  }
  function noSignal(){
    stopAudio();
    if (!wantOn) return;
    setState('nosignal');
    if (retries < 3){ retries++; retryT = setTimeout(start, 6000 * retries); }
  }
  audio.addEventListener('playing', function(){ clearTimeout(stallT); stallT = null; retries = 0; if (wantOn) setState('on'); });
  audio.addEventListener('error', function(){ if (wantOn && audio.getAttribute('src')) noSignal(); });
  // a live stream shouldn't end; if it does, or it stalls for a while, pick it back up
  audio.addEventListener('ended', function(){ if (wantOn) start(); });
  audio.addEventListener('waiting', function(){ if (!wantOn) return; clearTimeout(stallT); stallT = setTimeout(function(){ if (wantOn && state !== 'off') start(); }, 12000); });

  // the first tap, click or key anywhere on the page starts it, since browsers won't play sound before that
  var armed = false;
  function onGesture(e){
    if (e && e.target && e.target.closest && e.target.closest('#r-power')) return; // the power button handles itself
    disarm();
    if (wantOn && state === 'waiting') start();
  }
  function armGesture(){ if (armed) return; armed = true; ['pointerup', 'touchend', 'keydown', 'click'].forEach(function(t){ document.addEventListener(t, onGesture, true); }); }
  function disarm(){ if (!armed) return; armed = false; ['pointerup', 'touchend', 'keydown', 'click'].forEach(function(t){ document.removeEventListener(t, onGesture, true); }); }

  function powerOn(manual){
    wantOn = true; retries = 0;
    if (manual && prefs.offDay){ prefs.offDay = ''; save(); }
    start();
  }
  function powerOff(manual){
    wantOn = false; disarm(); clearTimeout(retryT); retryT = null;
    // turned off by hand during pool hours: it stays off for the rest of today
    if (manual && prefs.auto && poolOpen()){ prefs.offDay = today(); save(); }
    stopAudio(); setState('off');
  }

  // ---- a little static between stations ----
  var actx = null;
  function crackle(){
    if (reduce || !prefs.vol) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var n = Math.floor(actx.sampleRate * 0.28), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = actx.createBufferSource(), g = actx.createGain(); g.gain.value = 0.08 * prefs.vol;
      src.buffer = buf; src.connect(g); g.connect(actx.destination); src.start();
    } catch (e) {}
  }
  function tuneTo(id){
    if (id === prefs.station) return;
    prefs.station = id; save(); drawDial(); renderList();
    if (wantOn && state !== 'waiting'){ crackle(); start(); } else setState(state);
  }
  function step(dir){
    var i = 0; STATIONS.forEach(function(s, k){ if (s.id === prefs.station) i = k; });
    tuneTo(STATIONS[(i + dir + STATIONS.length) % STATIONS.length].id);
  }

  // ---- the dial ----
  // FM 88 to 108 takes the first 80 percent of the dial, and the WEB band the rest
  var LO = 88, HI = 108, FM = 0.8, WEB = STATIONS.filter(function(s){ return s.web; });
  function pos(s){ return s.web ? FM + (1 - FM) * (WEB.indexOf(s) + 0.5) / WEB.length : FM * (s.mhz - LO) / (HI - LO); }
  function pct(f){ return (f * 100).toFixed(2) + '%'; }
  var tag = document.createElement('span'); tag.className = 'r-tag'; ui.dial.appendChild(tag);
  var band = document.createElement('span'); band.className = 'r-web'; band.textContent = 'WEB'; band.style.left = pct(FM); ui.dial.appendChild(band);
  STATIONS.forEach(function(s){ var m = document.createElement('span'); m.className = 'r-pip'; m.dataset.id = s.id; m.style.left = pct(pos(s)); ui.dial.appendChild(m); });
  function drawDial(){
    var st = station(), f = pos(st);
    ui.needle.style.left = pct(f);
    // FM stations show their frequency by the needle. For a web station the WEB band lights up and the readout names it.
    tag.textContent = st.freq || ''; tag.style.left = pct(f); tag.hidden = !!st.web;
    tag.className = 'r-tag' + (f < 0.12 ? ' edge-l' : f > 0.88 ? ' edge-r' : '');
    band.classList.toggle('on', !!st.web);
    ui.freq.textContent = st.freq || 'WEB';
    ui.dial.querySelectorAll('.r-pip').forEach(function(m){ m.classList.toggle('on', m.dataset.id === st.id); });
    ui.lcd.setAttribute('aria-label', 'Radio stations. Tuned to ' + st.label + '.');
  }
  // click or tap anywhere on the dial and it tunes to the closest station
  ui.dial.addEventListener('click', function(e){
    var r = ui.dial.getBoundingClientRect(); if (!r.width) return;
    var f = (e.clientX - r.left) / r.width, best = STATIONS[0];
    STATIONS.forEach(function(s){ if (Math.abs(pos(s) - f) < Math.abs(pos(best) - f)) best = s; });
    tuneTo(best.id);
  });
  ui.down.addEventListener('click', function(){ step(-1); });
  ui.up.addEventListener('click', function(){ step(1); });
  // waiting on a tap: the power button is that tap. Otherwise it's a plain on and off.
  ui.power.addEventListener('click', function(){ if (state === 'waiting'){ disarm(); start(); return; } if (wantOn) powerOff(true); else powerOn(true); });

  // ---- the station list, the pool hours switch and the volume ----
  function renderList(){
    ui.list.textContent = '';
    STATIONS.forEach(function(s){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'r-st'; b.setAttribute('aria-pressed', String(s.id === prefs.station));
      var t = document.createElement('b'); t.textContent = s.label; var a = document.createElement('span'); a.textContent = s.about;
      b.appendChild(t); b.appendChild(a);
      b.addEventListener('click', function(){ tuneTo(s.id); if (!wantOn) powerOn(true); });
      ui.list.appendChild(b);
    });
  }
  function openPanel(show){
    ui.panel.hidden = !show; ui.lcd.setAttribute('aria-expanded', String(show));
    if (show){ var b = ui.list.querySelector('[aria-pressed="true"]'); if (b) b.focus(); }
  }
  ui.lcd.addEventListener('click', function(){ openPanel(ui.panel.hidden); });
  document.addEventListener('click', function(e){ if (!ui.panel.hidden && !root.contains(e.target)) openPanel(false); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !ui.panel.hidden){ openPanel(false); ui.lcd.focus(); } });
  ui.auto.checked = !!prefs.auto;
  ui.auto.addEventListener('change', function(){ prefs.auto = ui.auto.checked; prefs.offDay = ''; save(); });
  // ---- volume: the down and up buttons step it a tenth at a time, and the meter shows where it's at ----
  // (an iPhone only lets its own side buttons set the volume, so there the buttons step aside)
  var canVol = (function(){ try { var a = new Audio(); a.volume = 0.5; return Math.abs(a.volume - 0.5) < 0.01; } catch (e) { return false; } })();
  function drawVol(){
    var n = Math.round(prefs.vol * 10), bars = ui.meter ? ui.meter.children : [];
    for (var i = 0; i < bars.length; i++){ bars[i].style.height = (4 + i * 1.5) + 'px'; bars[i].className = i < n ? 'on' : ''; }
    if (ui.vol) ui.vol.value = String(prefs.vol);
    if (ui.volDn) ui.volDn.setAttribute('aria-disabled', String(n <= 0));
    if (ui.volUp) ui.volUp.setAttribute('aria-disabled', String(n >= 10));
  }
  function setVol(v, quiet){
    v = Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
    prefs.vol = v; audio.volume = v; save(); drawVol();
    if (quiet) return;
    // the readout shows the new volume for a second, then goes back to the station
    ui.call.textContent = 'VOL ' + Math.round(v * 10); ui.live.textContent = 'Volume ' + Math.round(v * 10) + ' of 10.';
    clearTimeout(flashT); flashT = setTimeout(function(){ flashT = null; setState(state); }, 1200);
  }
  if (!canVol){ if (ui.volGrp) ui.volGrp.hidden = true; if (ui.volLbl) ui.volLbl.hidden = true; }
  if (ui.volDn) ui.volDn.addEventListener('click', function(){ setVol(prefs.vol - 0.1); });
  if (ui.volUp) ui.volUp.addEventListener('click', function(){ setVol(prefs.vol + 0.1); });
  ui.vol.addEventListener('input', function(){ setVol(+ui.vol.value, true); });
  drawVol();

  // ---- pool hours: on at open, off at close ----
  var wasOpen = poolOpen();
  function checkHours(){
    var open = poolOpen(); if (open === wasOpen) return;
    wasOpen = open;
    if (!prefs.auto) return;
    if (open){ if (prefs.offDay !== today() && !wantOn) powerOn(false); }
    else if (wantOn) powerOff(false);
  }
  var park = document.querySelector('.park');
  if (park && window.MutationObserver) new MutationObserver(checkHours).observe(park, {attributes: true, attributeFilter: ['data-open']});
  setInterval(checkHours, 30000);

  renderList(); drawDial(); setState('off');
  if (prefs.auto && poolOpen() && prefs.offDay !== today()) powerOn(false);

  // what the map and the chat can ask
  window.levaRadio = {
    isOn: function(){ return state === 'on'; },
    info: function(){ var st = station(); return {on: state === 'on', state: state, wantOn: wantOn, label: st.label, freq: st.freq || '', call: st.call, about: st.about, auto: !!prefs.auto, vol: prefs.vol}; },
    stations: STATIONS
  };
})();
