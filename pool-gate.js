// The pool's front gate. Anyone can watch the pool. Playing, talking with the crew,
// and running the radio take a free leva sign-in (the same email link as account.html).
// Loaded before the other pool scripts so its listeners run first.
(function(){
  'use strict';
  var API = (function(){ try { return localStorage.getItem('leva_api') || (/^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? 'http://127.0.0.1:8797' : 'https://api.levagood.com'); } catch (e) { return 'https://api.levagood.com'; } })();
  function session(){ try { return localStorage.getItem('leva_session') || ''; } catch (e) { return ''; } }
  function signedIn(){ return !!session(); }

  // what's behind the gate, and what the gate says when you try it
  var WHY = {
    talk:    ['TALK TO THE CREW', "leva would love to talk. He just likes to know who's on the deck first."],
    ari:     ['SAY HI TO ARI', "Ari's happy to see you. Sign in and he'll come over for a treat."],
    games:   ['THE GUARD SHACK', 'Invaders and roof ball are for members. Sign in and grab a paddle.'],
    radio:   ['THE DECK RADIO', 'Only crew touches the radio. Sign in and pick the station.'],
    deck:    ['GRAB A NET', 'Netting leaves and earning points is crew work. Sign in and get on the deck.'],
    towel:   ['YOUR TOWEL', 'Sign in and the chair by the lap pool is yours.']
  };
  function reasonFor(t){
    if (t.closest('.cast-spot')){ var l = (t.closest('.cast-spot').getAttribute('aria-label') || '').toLowerCase(); return l.indexOf('ari') === 0 ? 'ari' : 'talk'; }
    if (t.closest('#lchat-open, [data-talk]')) return 'talk';
    if (t.closest('#play-invaders, [data-roofball]')) return 'games';
    if (t.closest('#crew-towel-pick')) return 'towel';
    var radio = t.closest('#radio');
    if (radio){
      // turning it down or off is always allowed; nobody should be stuck with it
      if (t.closest('#r-voldn, #r-volgrp')) return null;
      if (t.closest('#r-power') && radio.getAttribute('data-state') !== 'off') return null;
      if (t.closest('#r-power, #r-down, #r-up, #r-dial, #r-lcd, #r-panel')) return 'radio';
      return null;
    }
    var stage = t.closest('#stage');
    if (stage){
      // the buildings still open for a look; a tap on the water or the deck is crew work
      if (t.closest('[data-room], a, .spot')) return null;
      return 'deck';
    }
    return null;
  }

  // ---- the look: the arcade cabinet the rooms already use, so it feels like part of the pool
  var css = '' +
    '.gate-band{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;width:calc(100% - 32px);max-width:1248px;margin:0 auto 16px;padding:12px 14px;background:#0A0A0A;color:#fff;border:2px solid #0A0A0A;box-shadow:4px 4px 0 var(--pink,#FF2E88)}' +
    '.gate-band[hidden]{display:none}' +
    '.gate-band p{margin:0;font-size:15px;line-height:1.45}' +
    '.gate-band b{font-family:Silkscreen,monospace;font-weight:400;font-size:11px;letter-spacing:.14em;color:#FF96C8;display:block;margin-bottom:2px}' +
    '.gate-band button{font:800 14px/1 "Inter Tight",system-ui,sans-serif;padding:12px 16px;min-height:44px;background:var(--pink,#FF2E88);color:#fff;border:2px solid var(--pink,#FF2E88);cursor:pointer;white-space:nowrap}' +
    '.gate-band button:hover{background:#fff;color:#0A0A0A;border-color:#fff}' +
    '.gate-band button:focus-visible,.gate-form button:focus-visible{outline:3px solid var(--cyan,#00F0FF);outline-offset:2px}' +
    '.gate .arcade-cab{width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto}' +
    '.gate-body{background:#fff;color:#0A0A0A;padding:18px 18px 16px}' +
    '.gate-body h2{font-size:22px;line-height:1.2;font-weight:900;letter-spacing:-.02em;margin:0 0 8px}' +
    '.gate-body p{font-size:15px;line-height:1.5;margin:0 0 12px;color:#0A0A0A}' +
    '.gate-body ul{margin:0 0 14px 18px;font-size:14px;line-height:1.5;color:#5F5F66}' +
    '.gate-form{display:flex;gap:8px}' +
    '.gate-form input{flex:1;min-width:0;font:500 16px/1.2 "Inter Tight",system-ui,sans-serif;color:#0A0A0A;padding:11px 12px;border:2px solid #0A0A0A;border-radius:0;outline:0;background:#fff}' +
    '.gate-form input:focus{box-shadow:3px 3px 0 var(--pink,#FF2E88)}' +
    '.gate-form button{font:800 14px/1 "Inter Tight",system-ui,sans-serif;padding:0 14px;min-height:44px;background:#0A0A0A;color:#fff;border:2px solid #0A0A0A;cursor:pointer}' +
    '.gate-form button:hover{background:var(--pink,#FF2E88);border-color:var(--pink,#FF2E88)}' +
    '.gate-form button:disabled{opacity:.45;cursor:default}' +
    '.gate-msg{min-height:1.4em;margin:10px 0 0 !important;font-size:14px !important;color:#5F5F66 !important}' +
    '.gate-msg.ok{color:#0A0A0A !important;font-weight:600}' +
    '.gate-msg.bad{color:#C2185B !important}' +
    '.gate-fine{font-size:12px !important;color:#5F5F66 !important;margin:12px 0 0 !important}' +
    '.gate-fine a{color:#0A0A0A}' +
    '@media(max-width:480px){.gate-form{flex-direction:column}.gate-form button{min-height:46px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var ov, band, lastFocus;
  function build(){
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'arcade gate'; ov.id = 'gate'; ov.hidden = true;
    ov.innerHTML =
      '<div class="arcade-cab" role="dialog" aria-modal="true" aria-labelledby="gate-title">' +
        '<div class="arcade-top"><span class="arcade-title" id="gate-tag">MEMBERS ON THE DECK</span><button type="button" class="arcade-close" id="gate-close" aria-label="Close">×</button></div>' +
        '<div class="gate-body">' +
          '<h2 id="gate-title">Come on in. It’s free.</h2>' +
          '<p id="gate-why"></p>' +
          '<ul><li>Talk with leva, Em, Mel and Ari</li><li>Play roof ball and Invaders</li><li>Earn points, swim levels, badges and your own towel</li><li>Run the deck radio</li></ul>' +
          '<form class="gate-form" id="gate-form" novalidate>' +
            '<label class="sr" for="gate-email">Your email</label>' +
            '<input type="email" id="gate-email" autocomplete="email" inputmode="email" placeholder="you@email.com" required>' +
            '<button type="submit" id="gate-send">Email me a link</button>' +
          '</form>' +
          '<p class="gate-msg" id="gate-msg" aria-live="polite"></p>' +
          '<p class="gate-fine">No password. We email you a link, you click it, and this page opens up on its own. Watching stays free for everyone. 13 and up. <a href="privacy.html">Privacy</a></p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#gate-close').addEventListener('click', close);
    ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
    ov.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
    ov.querySelector('#gate-form').addEventListener('submit', send);
  }
  function open(why){
    build();
    var w = WHY[why] || WHY.talk;
    ov.querySelector('#gate-tag').textContent = w[0];
    ov.querySelector('#gate-why').textContent = w[1] + ' You can watch the pool as long as you like.';
    lastFocus = document.activeElement;
    ov.hidden = false;
    var inp = ov.querySelector('#gate-email');
    try { var em = localStorage.getItem('leva_gate_email'); if (em && !inp.value) inp.value = em; } catch (e) {}
    setTimeout(function(){ inp.focus(); }, 30);
  }
  function close(){ if (!ov || ov.hidden) return; ov.hidden = true; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }

  function send(e){
    e.preventDefault();
    var inp = ov.querySelector('#gate-email'), btn = ov.querySelector('#gate-send'), msg = ov.querySelector('#gate-msg');
    var email = inp.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ msg.textContent = 'That email doesn’t look right.'; msg.className = 'gate-msg bad'; inp.focus(); return; }
    btn.disabled = true; msg.textContent = 'Sending…'; msg.className = 'gate-msg';
    try { localStorage.setItem('leva_next', 'pool.html'); localStorage.setItem('leva_gate_email', email); } catch (x) {}
    fetch(API + '/auth/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: email, from: 'pool'})})
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ return {ok: r.ok && d.ok !== false, d: d}; }); })
      .then(function(res){
        btn.disabled = false;
        if (res.ok){ msg.textContent = 'Sent to ' + email + '. Open the link on this device. It works once and expires in 20 minutes.'; msg.className = 'gate-msg ok'; }
        else { msg.textContent = (res.d && res.d.error) || 'Couldn’t send the link. Try again in a minute.'; msg.className = 'gate-msg bad'; }
      })
      .catch(function(){ btn.disabled = false; msg.textContent = 'Couldn’t reach levagood. Check your connection and try again.'; msg.className = 'gate-msg bad'; });
  }

  // the band above the map, so people know before they tap
  function makeBand(){
    var park = document.querySelector('.park'); if (!park || band) return;
    band = document.createElement('div'); band.className = 'gate-band'; band.id = 'gate-band';
    band.innerHTML = '<p><b>You’re watching</b>Sign in free to talk with leva and the crew, play roof ball and Invaders, and earn your swim levels.</p><button type="button" id="gate-band-btn">Sign in free</button>';
    var row = park.querySelector('.scorebar-row'); park.insertBefore(band, row || park.firstChild);
    band.querySelector('#gate-band-btn').addEventListener('click', function(){ open('talk'); });
  }
  function paint(){
    var inn = signedIn();
    document.documentElement.classList.toggle('pool-guest', !inn);
    if (band) band.hidden = inn;
    if (inn && ov && !ov.hidden) close();
  }

  // the gate itself: capture phase, before any game, chat or radio code sees the tap
  function stop(e){
    if (signedIn() || !e.target || !e.target.closest) return;
    if (ov && ov.contains(e.target)) return;
    if (band && band.contains(e.target)) return;
    var why = reasonFor(e.target);
    if (!why) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (e.type === 'click') open(why);
  }
  window.addEventListener('click', stop, true);
  window.addEventListener('pointerdown', function(e){
    // the roof ball and Invaders pads start on pointerdown, so the gate has to catch that too
    if (signedIn() || !e.target || !e.target.closest) return;
    if (e.target.closest('#rb-pad, #si, #rb')) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
  }, true);

  // a sign-in in another tab (the email link) opens this one up on its own
  window.addEventListener('storage', function(e){ if (e.key === 'leva_session') paint(); });
  window.addEventListener('focus', paint);

  function start(){
    makeBand(); paint();
    // belt and braces: anything that opens the chat in code goes through the gate too
    if (window.levaChat && window.levaChat.open && !window.levaChat.gated){
      var raw = window.levaChat.open;
      window.levaChat.open = function(id){ if (!signedIn()){ open(id === 'ari' ? 'ari' : 'talk'); return; } return raw.apply(this, arguments); };
      window.levaChat.gated = true;
    }
    // a stale session (signed out everywhere, or expired) goes back to watching
    var t = session();
    if (t) fetch(API + '/me', {headers: {Authorization: 'Bearer ' + t}}).then(function(r){
      if (r.status === 401){ try { localStorage.removeItem('leva_session'); } catch (x) {} paint(); }
    }).catch(function(){});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.levaGate = {open: open, signedIn: signedIn};
})();
