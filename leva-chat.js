// leva-chat.js: the chat box on the pool page.
// It's one conversation on the deck with leva, Em, Mel and Ari. Say a name to talk to someone ("Em, do a
// cannonball"), or just talk and whoever it fits answers. The others chime in now and then. leva is always in the
// room, and nobody gets a private one-on-one with the girls.
// leva answers two ways. On a Mac with leva installed, he runs on the leva model in Ollama and nothing leaves the
// computer. Everywhere else he answers from his pocket brain. Em, Mel and Ari always answer from their own pocket
// brains, so they stay in character and stay safe: they keep personal stuff private, and leva steps in when
// something isn't right.
(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };
  var root = $('lchat'); if (!root) return;
  var openBtn = $('lchat-open'), panel = $('lchat-panel'), closeBtn = $('lchat-close'), logEl = $('lchat-log'),
      form = $('lchat-form'), input = $('lchat-in'), send = $('lchat-send'), chips = $('lchat-chips'),
      status = $('lchat-status'), foot = $('lchat-foot'), beatEl = $('lchat-beat');
  var labelEl = root.querySelector('label[for="lchat-in"]');
  var PL = function(){ return window.PoolLife && window.PoolLife.chat; };
  var OLLAMA = 'http://127.0.0.1:11434';
  var brain = {mode: 'pocket', model: null, checked: false};
  var history = [], deckLines = [], busy = false, ctl = null, tick = null, greeted = false, asked = false;
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var wantMac = false; try { wantMac = localStorage.getItem('leva-mac') === '1'; } catch (e) {}

  // ================= who's on the deck =================
  var CHAR = {
    leva: {name: 'leva', face: 0, chips: ['How is the water?', 'What is in the pump room?', 'Test the water', 'CPR basics']},
    m: {name: 'Em', face: 2, chips: ['What are you up to?', 'Tell me about volleyball', 'Do a cannonball!', "Who's Luke?"]},
    mel: {name: 'Mel', face: 3, chips: ["What's your favorite fish?", 'How do I catch a catfish?', 'Tell me a catfish fact', 'Sing something!']},
    ari: {name: 'Ari', face: 1, chips: ['Want a treat?', "Who's a good boy?", 'Roll over!', 'Why do you sneak in the pool?']}
  };
  var ORDER = ['leva', 'm', 'mel', 'ari'];
  var CH = {leva: {last: {}}, m: {last: {}, jokeI: 0}, mel: {last: {}, factI: 0}, ari: {last: {}}};
  var aim = null, aimEls = {}, lastHere = {}, lastOffer = null, lastAsk = null;
  // if somebody crosses a line with the kids, Em, Mel and Ari are done chatting for the rest of the visit
  var locked = false; try { locked = sessionStorage.getItem('lchat-locked') === '1'; } catch (e) {}
  (function build(){
    // the faces at the top point your next message at somebody. Everyone is the default.
    var row = document.createElement('div'); row.className = 'lchat-aim'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Who you are talking to');
    [null].concat(ORDER).forEach(function(id){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lchat-who' + (id ? '' : ' all'); b.setAttribute('aria-pressed', id ? 'false' : 'true');
      if (id){
        var f = document.createElement('span'); f.className = 'lchat-tface'; f.style.setProperty('--i', CHAR[id].face); f.setAttribute('aria-hidden', 'true');
        var n = document.createElement('span'); n.className = 'lchat-tname'; n.textContent = CHAR[id].name;
        b.appendChild(f); b.appendChild(n); b.title = 'Talk to ' + CHAR[id].name;
      } else { b.textContent = 'All'; b.title = 'Talk to everybody on the deck'; b.setAttribute('aria-label', 'Everybody'); }
      b.addEventListener('click', function(){ if (!b.disabled){ setAim(id === aim ? null : id); input.focus(); } });
      row.appendChild(b); aimEls[id || 'all'] = b;
    });
    logEl.parentNode.insertBefore(row, logEl);
  })();

  // ================= the window =================
  function show(id){
    panel.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); root.classList.add('on');
    if (!brain.checked && (LOCAL || wantMac)) findMac(false);
    refresh(true);
    if (!greeted){
      greeted = true; greetAll();
      // opened from a card for somebody who isn't here: the hellos already say where the girls are
      if (id && id !== 'leva' && !here(id) && !locked){
        if (here('m') || here('mel')) gq.push(['leva', CHAR[id].name + ' is ' + low(whoTask(id)) + '.']);
        id = null;
      }
    }
    else { var pl = PL(); if (pl && pl.ready()){ var r = pl.attend(12); if (r === 'ok') pl.say('Hey there!'); } }
    if (id !== undefined) aimAt(id);
    clearInterval(tick); tick = setInterval(function(){ refresh(false); }, 1500);
    setTimeout(function(){ input.focus(); }, 30);
  }
  function hide(){ panel.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); root.classList.remove('on'); clearInterval(tick); openBtn.focus(); }
  openBtn.addEventListener('click', function(){ panel.hidden ? show() : hide(); });
  closeBtn.addEventListener('click', hide);
  panel.addEventListener('keydown', function(e){ if (e.key === 'Escape') hide(); });
  // the Talk buttons on the deck cards, and the characters on the map, open the chat pointed at that person
  window.levaChat = {open: function(id){ if (!CHAR[id]) id = null; if (panel.hidden) show(id); else aimAt(id); }};
  Array.prototype.forEach.call(document.querySelectorAll('[data-talk]'), function(b){ b.addEventListener('click', function(){ window.levaChat.open(b.getAttribute('data-talk')); }); });
  function aimAt(id){
    if (id && id !== 'leva' && !here(id)){
      say1('leva', locked ? "Em, Mel and Ari are done chatting for now. I'm still here for pool questions." : CHAR[id].name + ' is ' + low(whoTask(id)) + '. The girls chat when they are at the pool.');
      setAim(null); return;
    }
    setAim(id || null);
  }

  function who(id){ var pl = PL(); return pl && pl.ready() && pl.who ? pl.who(id) : {here: id === 'leva', task: ''}; }
  // when the girls aren't here, nobody says where they are or when they'll be back
  function whoTask(id){ var w = who(id); return (id === 'leva' || id === 'ari' || w.here) && w.task ? w.task : 'not at the pool right now'; }
  function here(id){ if (id === 'leva') return true; if (locked) return false; return id === 'ari' ? true : !!who(id).here; }
  function setAim(id){
    aim = id;
    for (var k in aimEls) aimEls[k].setAttribute('aria-pressed', (k === 'all' ? !id : k === id) ? 'true' : 'false');
    input.placeholder = id ? 'Say something to ' + CHAR[id].name : 'Talk to everybody on the deck';
    if (labelEl) labelEl.textContent = id ? 'Message ' + CHAR[id].name : 'Message everybody on the deck';
    setChips();
    var pl = PL();
    if (id && pl && pl.ready()){ if (id === 'leva') pl.attend(12); else pl.attendChar(id, 10); }
  }
  // every second and a half while the chat is open: who's here, and what they're up to
  function refresh(first){
    ORDER.forEach(function(id){
      if (id === 'leva') return;
      var ok = here(id), b = aimEls[id];
      b.disabled = !ok; b.classList.toggle('away', !ok);
      b.title = ok ? 'Talk to ' + CHAR[id].name : (locked ? 'Done chatting for now' : CHAR[id].name + ' is ' + whoTask(id));
      if (!ok && aim === id) setAim(null);
    });
    // the girls coming and going
    var kidsNow = {m: here('m'), mel: here('mel')};
    if (!first && !locked && greeted){
      var came = ['m', 'mel'].filter(function(k){ return kidsNow[k] && !lastHere[k]; }), went = ['m', 'mel'].filter(function(k){ return !kidsNow[k] && lastHere[k]; });
      if (came.length){
        add('sys', names(came) + ' just got here.');
        if (!busy) setTimeout(function(){ if (!busy && here(came[0])) say1(came[0], came.length > 1 ? 'Hi! We just got here!' : 'Hi! I just got here!'); }, 700);
      }
      if (went.length) add('sys', names(went) + ' headed out.');
    }
    lastHere = kidsNow;
    var others = ['m', 'mel', 'ari'].filter(here).map(function(id){ return CHAR[id].name; });
    if (!root.classList.contains('thinking')) status.textContent = others.length ? listWords(others) + (others.length > 1 ? ' are' : ' is') + ' here too' : 'Maintenance, Levagood Pool';
    if (!asked) setChips();
  }
  function names(ids){ return listWords(ids.map(function(k){ return CHAR[k].name; })); }

  function add(who, text){
    var li = document.createElement('li'); li.className = 'm-' + who;
    var p = document.createElement('p');
    if (CHAR[who]){
      var f = document.createElement('span'); f.className = 'lchat-mface'; f.style.setProperty('--i', CHAR[who].face); f.setAttribute('aria-hidden', 'true'); li.appendChild(f);
      var b = document.createElement('b'); b.className = 'lchat-by'; b.textContent = CHAR[who].name; p.appendChild(b);
    }
    var sp = document.createElement('span'); sp.textContent = text; p.appendChild(sp); li.appendChild(p);
    logEl.appendChild(li); logEl.scrollTop = logEl.scrollHeight;
    if (text) note(who, text);
    return sp;
  }
  // the last few lines on the deck, so leva on the Mac knows what everybody said
  function note(who, text){ if (who === 'sys') return; deckLines.push((CHAR[who] ? CHAR[who].name : 'Visitor') + ': ' + text); if (deckLines.length > 12) deckLines.shift(); }
  // one of them says something: in the chat, and in a bubble over their head on the map
  function say1(who, text){
    add(who, text);
    var pl = PL(); if (pl && pl.ready()){ if (who === 'leva') pl.say(firstLine(text)); else pl.sayAs(who, firstLine(text)); }
  }
  function firstLine(t){ var m = String(t).match(/^[\s\S]*?[.!?](?=\s|$)/); return m ? m[0] : String(t); }
  function thinking(on, id){
    beatEl.classList.toggle('beating', on); root.classList.toggle('thinking', on);
    status.textContent = on ? (id && id !== 'leva' ? CHAR[id].name + ' is typing...' : 'leva is thinking...') : '';
    if (!on) refresh(false);
    var pl = PL(); if (pl && (id === 'leva' || !on)) pl.think(on && id === 'leva');
  }
  function setChips(){
    chips.textContent = '';
    var list = aim ? CHAR[aim].chips : (here('m') ? ['How is the water?', 'Em, do a cannonball!', 'Mel, tell me a catfish fact', 'Ari, want a treat?'] : ['How is the water?', "Where's Ari?", 'Ari, want a treat?', 'CPR basics']);
    list.forEach(function(q){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = q;
      b.addEventListener('click', function(){ ask(q); });
      chips.appendChild(b);
    });
    chips.hidden = asked;
  }
  function setFoot(){
    foot.textContent = '';
    foot.appendChild(document.createTextNode("Em, Mel and Ari are characters on this page. They keep personal stuff private, and leva's always right there. "));
    if (brain.mode === 'mac'){ foot.appendChild(document.createTextNode('leva is running on the leva model on this Mac. Nothing leaves your computer.')); return; }
    if (!LOCAL){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lchat-link';
      b.textContent = 'Have leva for Mac? Use it here.';
      b.addEventListener('click', function(){ try { localStorage.setItem('leva-mac', '1'); } catch (e) {} wantMac = true; findMac(true); });
      foot.appendChild(b);
    }
  }
  // opening the chat: leva welcomes you, and whoever's on the deck says hi. If you start typing first, the rest of
  // the hellos show up all at once so nobody talks over you.
  var gq = [], gtimer = null;
  function greetAll(){
    lastAsk = null;
    var s = snap(), v = s && s.visitor, name = v && v.name, q = [];
    q.push(['leva', (name ? 'Hey there, ' + name + '. Welcome back to Levagood Pool. ' : 'Hey there, welcome to Levagood Pool. ') + "I'm leva. I keep this place running, and I'm here to be of service to you.", true]);
    if (s && !locked){
      if (!here('m') && !here('mel')) q.push(['leva', 'Em and Mel are ' + low(whoTask('m')) + ". Ari's around, though. He's always around."]);
      ['m', 'mel', 'ari'].forEach(function(id){ if (here(id)){ var g = greetLine(id, s); q.push([id, g]); noteAsk(id, g); var pl = PL(); if (pl) pl.remember('met', id); } });
      q.push(['sys', here('m') || here('mel') ? 'Say a name to talk to someone, like "Em, do a cannonball." Or just talk to everybody.' : 'Say a name to talk to someone, like "Ari, want a treat?" Or just talk to everybody.']);
    }
    var pl2 = PL(); if (pl2 && pl2.ready()){ var r = pl2.attend(12); if (r === 'ok') pl2.say('Hey there!'); }
    gq = q;
    (function step(){ var x = gq.shift(); if (!x) return; greet1(x); if (gq.length) gtimer = setTimeout(step, 700); })();
    setFoot(); setChips();
  }
  function greet1(x){ if (x[0] === 'sys') add('sys', x[1]); else if (x[2]) add(x[0], x[1]); else say1(x[0], x[1]); }
  function flushGreet(){ clearTimeout(gtimer); while (gq.length) greet1(gq.shift()); }
  form.addEventListener('submit', function(e){ e.preventDefault(); var t = input.value.trim(); if (t) ask(t); });

  // ================= asking =================
  function snap(){ var pl = PL(); return pl && pl.ready() ? pl.snapshot() : null; }
  function ask(text){
    if (busy) return;
    flushGreet();
    busy = true; send.disabled = true; input.value = ''; chips.hidden = true; asked = true;
    add('you', text);
    noteLikes(text);
    var pl = PL();
    if (pl){ pl.remember('chat'); var nm = text.match(NAMEIS); if (nm && !STOP.test(nm[1]) && !CASTNAME.test(nm[1])) pl.remember('name', nm[1]); }
    run(route(text));
  }
  // who answers: whoever you named, or whoever you pointed at, or whoever it's about. leva if nobody.
  var NAMES = {leva: /\bleva\b/i, m: /\bem\b/i, mel: /\bmel\b/i, ari: /\b(ari|aristotle)\b/i};
  var LEAD = /^\s*((hey|hi|hello|yo|ok|okay|so|and|also)\s*,?\s+)?((leva|em|mel|ari)\b(\s*(,|and\b|&)\s*(leva|em|mel|ari)\b)*)\s*[,:!.?-]?\s*/i;
  var EVERY = /\b(everybody|everyone|every body|you guys|y'?all|all of you|you all|you three)\b|^\s*(hey|hi|hello|yo|bye|good ?night|see ya|see you|later|morning|evening) (guys|all|gang|friends|team|folks)\b/i;
  var GIRLS = /\b(you two|you girls|both of you|hey girls|hi girls)\b/i;
  var TOPIC = [
    ['leva', /\b(chlorine|ph|pump|filter|backwash|vacuum|vac|skim|the water|water temp\w*|test the water|water quality|cpr|drown|lifeguard|weather|storm|thunder|tornado|hours|open|closed|connect ?space|levagood|dearborn|leva for mac|work orders?|badges?|crew card|my (rank|points|score)|achievements?|how do i play)\b/i],
    ['ari', /\b(treats?|snacks?|good boy|roll over|sit|shake|paw|fetch|beagle|puppy|bark|howl|woof|squirrel)\b/i],
    ['mel', /\b(catfish|fishing|fish|bait|worms?|nightcrawlers?|lures?|bobbers?|hooks?|cast|casting|reel|pier|bluegill|sunfish|perch|bass|trout|salmon|pike|walleye|carp|crappie|bullheads?|minnows?|knots?|sing|singing|songs?|freya|zombies|float)\b/i],
    ['m', /\b(volleyball|serv\w*|spik\w*|bump\w*|pepper|cannonball|goggles|youth group|jesus|bible|pray|jokes?)\b/i],
    ['kid', /\b(soccer|luke)\b/i]
  ];
  var RANK = {m: 0, mel: 1, ari: 2, leva: 3};
  function route(text){
    var s = snap(), kidsHere = here('m') || here('mel'), lead = text.match(LEAD), targets = [];
    if (lead && lead[3]) lead[3].split(/\s*(?:,|\band\b|&)\s*/i).forEach(function(n){ var id = idFor(n); if (id && targets.indexOf(id) < 0) targets.push(id); });
    if (!targets.length && GIRLS.test(text)) targets = ['m', 'mel'];
    if (!targets.length && EVERY.test(text)) targets = ORDER.filter(here);
    // a yes or a no goes to whoever just asked you something
    if (!targets.length && !aim && lastOffer && Date.now() - lastOffer.at < 90000 && CH[lastOffer.id].offer && (ONLYYES.test(text) || ONLYNO.test(text))) targets = [lastOffer.id];
    if (!targets.length && aim) targets = [aim];
    if (!targets.length){
      var found = ORDER.map(function(id){ var m = text.match(NAMES[id]); return m ? {id: id, i: m.index} : null; }).filter(Boolean).sort(function(a, b){ return a.i - b.i; });
      if (found.length) targets = [found[0].id];
    }
    var body = lead && lead[0].length < text.length ? text.slice(lead[0].length) : text;
    var crowd = !lead && text.match(/^\s*((hey|hi|hello|yo|good (morning|afternoon|evening))\s*,?\s+)?(everybody|everyone|every body|you guys|y'?all|all of you|you all|you three|you two|you girls|both of you|guys|girls|gang|folks)\b\s*[,:!.?-]?\s*/i);
    if (crowd && crowd[0].length < text.length) body = (crowd[1] || '') + text.slice(crowd[0].length);
    // nobody named: pick who it's for by topic, or whoever just asked you something, before the screen looks at it,
    // so a girl who'd answer is checked as the one being talked to
    var named = targets.length > 0, awayLine = null;
    if (!named){
      var pick = null;
      for (var i = 0; i < TOPIC.length && !pick; i++){
        if (!TOPIC[i][1].test(text)) continue;
        var t = TOPIC[i][0];
        if (t === 'kid') t = here('m') && here('mel') ? (Math.random() < 0.5 ? 'm' : 'mel') : here('m') ? 'm' : here('mel') ? 'mel' : null;
        if (!t){ if (!locked) awayLine = "Em and Mel are the ones to ask about that, and they're not at the pool right now."; pick = 'none'; }
        else if (here(t)) pick = t;
        else { if (!locked && (t === 'm' || t === 'mel')) awayLine = CHAR[t].name + "'s the one to ask about that, and she's not at the pool right now."; pick = 'none'; }
      }
      // a short answer goes back to whoever just asked you something
      if (!pick && lastAsk && Date.now() - lastAsk.at < 60000 && text.trim().split(/\s+/).length <= 4 && !/\?\s*$|^\s*(how|what|whats|wat|wats|why|when|where|wheres|who|whos|which|is|are|can|could|do|does|did|will|would|should)\b|\b(you|u|ur|your|yours|youre|you're|r)\b/i.test(text) && !HI.test(text) && here(lastAsk.id)) pick = lastAsk.id;
      if (pick && pick !== 'none') targets = [pick];
    }
    var plan = screen(text, targets, kidsHere, s, named);
    if (plan) return plan;
    if (awayLine) return [{who: 'leva', line: awayLine}];
    // anybody you asked for who isn't here: leva tells you where they are
    var steps = [], gone = [];
    targets = targets.filter(function(id){ if (here(id)) return true; gone.push(id); return false; });
    if (gone.length){
      var kidsGone = gone.filter(function(id){ return id === 'm' || id === 'mel'; });
      if (locked) steps.push({who: 'leva', line: "Em, Mel and Ari are done chatting for now. I'm still here for pool questions."});
      else if (kidsGone.length) steps.push({who: 'leva', line: names(kidsGone) + (kidsGone.length > 1 ? ' are ' : ' is ') + low(whoTask(kidsGone[0])) + '. The girls chat when they are at the pool.'});
    }
    if (!targets.length && !steps.length) targets = ['leva'];
    // when you talk to a few of them, the kids go first and leva wraps it up
    targets.sort(function(a, b){ return RANK[a] - RANK[b]; }).slice(0, 4).forEach(function(id){ steps.push({who: id, text: body}); });
    // somebody else might chime in
    if (targets.length === 1 && !locked){ var c = chime(targets[0], text, s); if (c) steps.push(c); }
    return steps;
  }
  function idFor(n){ n = n.toLowerCase(); return n === 'leva' ? 'leva' : n === 'em' ? 'm' : n === 'mel' ? 'mel' : n === 'ari' || n === 'aristotle' ? 'ari' : null; }
  function setOffer(id, what){ if (!CH[id]) return; CH[id].offer = what || null; if (what) lastOffer = {id: id, at: Date.now()}; }
  // remember who just asked the visitor a question, so a short answer finds its way back to them
  function noteAsk(id, text){ if (!CH[id]) return; if (/\?/.test(String(text).replace(/did you know\?/gi, ''))){ CH[id].askedAt = Date.now(); lastAsk = {id: id, at: Date.now()}; } else CH[id].askedAt = 0; }
  // one at a time, with a little pause, like people talking
  function run(steps){
    var i = 0, said = 0, multi = steps.filter(function(x){ return x.text != null; }).length > 1,
        levaQueued = steps.some(function(x){ return x.who === 'leva'; });
    function done(){ busy = false; send.disabled = false; thinking(false); input.focus(); }
    function next(){
      if (i >= steps.length) return done();
      var st = steps[i++], pl = PL(), res = null;
      if (st.who === 'sys'){ if (st.lockNow) lockCast(); add('sys', st.line); return next(); }
      if (st.who !== 'leva' && !st.line){
        if (!here(st.who)) return next();
        res = brainReply(st.who, st.text, snap());
        // when you talk to everybody, only the ones with something to say answer
        if (multi && ((res.fallback && (said > 0 || levaQueued)) || (res.handoff && levaQueued))) return next();
      }
      thinking(true, st.who);
      if (pl && pl.ready()){ if (st.who === 'leva') pl.attend(12); else pl.attendChar(st.who, 10); }
      if (st.line){
        setTimeout(function(){ thinking(false, st.who); if (st.lockNow) lockCast(); say1(st.who, st.line); said++; setTimeout(next, 350); }, 500 + Math.random() * 450);
        return;
      }
      if (st.who === 'leva'){
        var go = brain.mode === 'mac' ? askMac : askPocket;
        history.push({role: 'user', content: st.text});
        var fin = function(r){
          if (multi && r && r.fallback && said > 0){ thinking(false, 'leva'); history.pop(); return next(); }
          levaDone(r); said++;
          // asking leva about Connect Space or the weather counts on your crew card
          var pg = PL(), gk = /connect ?space/i.test(st.text) ? 'connect' : /\b(weather|raining|rain|snow\w*|storm\w*|thunder|lightning|temperature|degrees|how (hot|cold|warm)|forecast|windy|sunny|foggy)\b/i.test(st.text) ? 'weather' : null;
          if (gk && pg && pg.game) pg.game(gk);
          next();
        };
        go(st.text).then(fin, function(){ askPocket(st.text).then(fin); });
        return;
      }
      setTimeout(function(){
        thinking(false, st.who);
        var r = null, more = null;
        if (res.action && pl && pl.ready()){ r = pl.charDo(st.who, res.action); more = react(st.who, res.action, r); }
        // can't do it right now (in the water, busy, band night): say why, not a yes and then a no
        if (more && /^(wet|busy|noother|band)$/.test(r)){ say1(st.who, more); said++; noteAsk(st.who, more); setTimeout(next, 350); return; }
        say1(st.who, res.text); said++;
        setOffer(st.who, res.offer); noteAsk(st.who, res.text);
        // "That's a leva question": he picks it up
        if (res.handoff && !levaQueued){ steps.splice(i, 0, {who: 'leva', text: st.text}); levaQueued = true; }
        if (more){ setTimeout(function(){ say1(st.who, more); setTimeout(next, 350); }, 1100); return; }
        setTimeout(next, 350);
      }, 450 + Math.random() * 450);
    }
    next();
  }
  function levaDone(res){
    thinking(false, 'leva');
    if (!res) return;
    if (res.el){ res.el.textContent = res.text; note('leva', res.text); } else add('leva', res.text);
    setOffer('leva', res.offer); noteAsk('leva', res.text);
    history.push({role: 'assistant', content: res.text});
    if (history.length > 16) history.splice(0, history.length - 16);
    var pl = PL();
    if (pl){
      if (res.action){
        var did = pl.doTask(res.action);
        if (did === 'busy') add('leva', "Soon as I've got Ari out of the pool.");
        else if (did === 'clean') add('leva', "Water's clean right now. Not a leaf on it.");
        else if (did === 'open') add('leva', 'Not with swimmers in the water. I vacuum before we open and after we close.');
        else if (did === 'weather') add('leva', "Not till this weather passes. I'm staying inside, and you should too.");
      } else pl.say(firstLine(res.text));
    }
  }
  function lockCast(){
    if (locked) return;
    locked = true; try { sessionStorage.setItem('lchat-locked', '1'); } catch (e) {}
    refresh(false);
  }
  // hobbies a visitor mentions, so the kids remember next time. Kept in this browser only.
  function noteLikes(t){
    var pl = PL(); if (!pl) return;
    if (/\bi (play|love|like|do) volleyball\b|\bi('m| am) on a volleyball team\b/i.test(t)) pl.remember('like', 'volleyball');
    if (/\bi (play|love|like) soccer\b/i.test(t)) pl.remember('like', 'soccer');
    if (/\bi (love|like|go) fishing\b|\bi (love|like) to fish\b|\bi fish\b|\bi (love|like) catfish\b/i.test(t)) pl.remember('like', 'fishing');
    if (/\bi (love|like) (to )?sing|\bi sing\b/i.test(t)) pl.remember('like', 'singing');
    if (/\bi (have|got) (a |two |three )?dogs?\b|\bmy dogs?\b/i.test(t)) pl.remember('like', 'dogs');
  }

  // ================= the pocket brain =================
  function weatherNow(s, t){
    var w = s && s.weather;
    if (!w) return 'Still checking the weather. Ask me again in a second.';
    if (w.down) return "I can't reach the weather service right now, so I don't know. weather.gov has Dearborn's conditions.";
    var bits = [(w.test ? 'Test weather on this page: ' : 'Right now in Dearborn: ') + (w.tempF != null ? w.tempF + ' degrees, ' : '') + w.summary.charAt(0).toLowerCase() + w.summary.slice(1)];
    if (w.why === 'tornado') bits.push("There's a tornado warning for Dearborn. If you're there, take shelter now: a basement, or an inside room on the lowest floor, away from windows.");
    else if (w.why === 'storm') bits.push("Thunder's around, so the pool is closed until 30 minutes after the last rumble. If you can hear thunder, you're close enough to get struck. Get inside.");
    else if (w.why === 'snow') bits.push("No swimming. I'm on the shovel.");
    else if (w.why === 'cold') bits.push('Too cold to swim today.');
    else if (w.why === 'rain') bits.push("Rain's fine for swimming. Thunder isn't. I'm listening.");
    else if (w.why === 'heat') bits.push('Hot one. Drink water and put sunscreen back on every two hours.');
    else if (w.why === 'wind') bits.push("Windy. The leaves are coming in fast, so I've got the net out.");
    else if (w.why === 'fog') bits.push('Foggy. Swim where the guards can see you.');
    if (w.alert && w.why !== 'tornado') bits.push('Active alert: ' + w.alert.event + '.');
    if (t && /thunder|lightning|storm/i.test(t) && w.why !== 'storm') bits.push('Rule here: first rumble of thunder, everybody out. Back in 30 minutes after the last one.');
    if (t && /forecast|tomorrow|later|tonight|this week/i.test(t)) bits.push("I only watch what's happening now, not the forecast. weather.gov has Dearborn's forecast.");
    bits.push(w.test ? '' : 'That comes from the ' + w.source.charAt(0).toLowerCase() + w.source.slice(1));
    return bits.filter(Boolean).join(' ').replace(/\.\s*\./g, '.');
  }
  function reading(s){
    if (!s || !s.measured) return "I haven't tested yet this visit. Say \"test the water\" and I'll go do it.";
    var m = s.measured, ok = m.ph >= 7.2 && m.ph <= 7.8 && m.cl >= 1 && m.cl <= 3;
    return 'Last reading was ' + m.ph.toFixed(1) + ' pH and ' + m.cl.toFixed(1) + ' ppm chlorine at ' + m.pool + ', ' + m.ago + '. ' + (ok ? 'Good water.' : "That's off, so I'm on it.");
  }
  function lc(s){ return s ? (s.charAt(0).toLowerCase() + s.slice(1)).replace(/\bleva\b/g, 'me') : ''; }
  function kidsNow(s){
    var m = s.m.task, l = s.mel.task;
    if (/volleyball with Mel/.test(m) && /volleyball with Em/.test(l)) return 'Em and Mel are playing volleyball together.';
    if (/^teaching Em/.test(l) || /^learning .* from Mel/.test(m)) return 'Mel is ' + lc(l) + '.';
    if (/^teaching Mel/.test(m) || /^learning .* from Em$/.test(l)) return 'Em is ' + lc(m) + '.';
    return 'Em is ' + lc(m) + ' and Mel is ' + lc(l) + '.';
  }
  var STOP = /^(fine|good|great|okay|ok|here|there|just|not|a|an|the|looking|trying|new|back|curious|wondering|asking|so|very|really|sorry|glad|happy|sure|done|in|on|at|from|with|going|interested|bored|hungry|tired|hot|cold|ready|excited|learning|thinking|still|also|kidding|joking|serious|confused|lost|home|out|off|busy|playing|swimming|fishing)$/i;
  var R = [
    {re: /\b(someone|somebody|my (kid|son|daughter|child|baby|friend|wife|husband|mom|dad|brother|sister)|a (kid|child|man|woman|person|boy|girl)|he|she|they)\b.{0,40}\b(is |are |isn'?t |not )?(drowning|not breathing|unconscious|passed out|went under|under water|underwater|choking|turning blue)\b/i, f: function(){
      return {text: 'Call 911 right now, or point at someone and tell them to call. Get them out of the water only if you can do it safely: reach or throw something, and do not go in unless you are trained. If they are not breathing, start CPR. Push hard and fast in the center of the chest, 100 to 120 a minute, and keep going until help takes over.'};
    }},
    {re: /\b(forget me|forget my name|delete (my|what)|erase)\b/i, f: function(){ var pl = PL(); if (pl) pl.forget(); return {text: 'Done. I wiped your name and what we talked about from this browser.'}; }},
    {re: /\b(?:[Mm]y name is|[Cc]all me|[Tt]his is|[Ii]'?m|[Ii] am)\s+([A-Z][a-z]{1,15})\b/, raw: true, f: function(t, s, m){
      if (STOP.test(m[1])) return null;
      var pl = PL(); if (pl) pl.remember('name', m[1]);
      return {text: 'Good to meet you, ' + m[1] + ". I'll remember that on this device. What can I do for you?"};
    }},
    {re: /\b(jesus|god|faith|church|pray|prayer|christian|bible|religio|believe in)\b/i, f: function(){
      return {text: "The folks who built me grounded me in faith, in the example of Jesus. It's where my honesty comes from and how I try to treat people: patient, fair, and ready to help. I don't push it on anybody, and I respect whatever you believe."};
    }},
    {re: /\bare you (real|human|a person|a robot|an? ai|alive|a bot)\b|\bis this (a bot|an ai|a person)\b/i, f: function(){
      return {text: "I'm an AI. The robot on the map is how I show up here. I'm not a person, and I won't pretend to be."};
    }},
    {re: /\bhow('?s| is| does) the water\b|\bwater (quality|look|looking)\b|\b(the )?readings?\b/i, f: function(t, s){
      if (!s) return {text: 'Give me a second to get my rounds going.'};
      var more = s.leaves ? ' ' + s.leaves + (s.leaves === 1 ? ' leaf' : ' leaves') + ' on it right now.' : ' Not a leaf on it.';
      return {text: reading(s).replace(/^Last reading was/, 'Water read') + more};
    }},
    {re: /\b(water|pool) (temp\w*|cold|warm|freezing|heated)\b|\bhow (cold|warm) is the (water|pool)\b|\bis the (water|pool) (cold|warm|freezing|heated)\b/i, f: function(){ return {text: "I don't track the water temperature on this page. Most outdoor pools run in the upper 70s to low 80s. Cold for a second, then you're fine."}; }},
    {re: /\b(safe to swim|can (i|we|you|they|the kids|my kids?) (go )?(swim|get in)|(ok|okay|alright|good) (day )?to swim|go(ing)? swimming|swim today|(is|are) (the pool|you|you guys|y'?all) open|pool open)\b/i, f: function(t, s){
      if (!s) return {text: 'Give me a second to get my rounds going, then ask me again.'};
      var w = s.weather && !s.weather.down ? s.weather : null, why = w ? w.why : null;
      if (why === 'tornado') return {text: "No. There's a tornado warning for Dearborn, and everybody is inside. If you're there, take shelter now: a basement, or an inside room on the lowest floor, away from windows."};
      if (why === 'storm') return {text: "Not right now. There's thunder around Dearborn, so the pool is closed until 30 minutes after the last rumble."};
      if (why === 'snow') return {text: "Not today. It's snowing in Dearborn, and I'm on the shovel."};
      if (why === 'cold') return {text: 'Too cold to swim today' + (w.tempF != null ? '. It\'s ' + w.tempF + ' degrees in Dearborn' : '') + '.'};
      if (!s.open){ var h = new Date().getHours(); return {text: "We're closed right now." + (h >= 21 ? ' We open again at 8 tomorrow morning.' : h < 8 ? ' We open at 8.' : '')}; }
      var m = s.measured, ok = m && m.ph >= 7.2 && m.ph <= 7.8 && m.cl >= 1 && m.cl <= 3;
      var out = m ? (ok ? "We're open, and the water tested good: " : "We're open, but not yet. Last test read ") + m.ph.toFixed(1) + ' pH and ' + m.cl.toFixed(1) + ' ppm chlorine' + (ok ? '. Swim with a buddy.' : ", so I'm fixing it first.") : "We're open. I haven't tested yet this visit, though. Say \"test the water\" and I'll check.";
      if (why === 'rain') out += " It's raining, which is fine. If I hear thunder, everybody's out.";
      if (why === 'heat') out += ' Hot one, so drink water and keep the sunscreen coming.';
      return {text: out};
    }},
    {re: /\bhow\b.{0,24}\btest\b/i, f: function(){
      return {text: 'A drop test kit gives the truest read. Strips are fine for a quick look. Take the sample at elbow depth, away from the returns. At home, check pH and free chlorine a few times a week. A busy public pool gets checked all day.'};
    }},
    {act: true, re: /\b(test|check)\b.{0,24}\b(water|ph|chlorine|chemistry|chemicals|pool)\b|\b(what'?s|what is) the (ph|chlorine)\b.{0,10}\bnow\b/i, f: function(){
      return {text: "On it. I'll grab the test kit and check it now.", action: 'test'};
    }},
    {act: true, re: /\b(skim|scoop)\b|\b(clean|get|grab)\s+(up\s+)?(the\s+)?(leaves|debris)\b|\bclean (up )?(the )?(pool|water)\b/i, f: function(t, s){
      if (s && !s.leaves) return {text: "Water's clean right now. Not a leaf on it. I'll get the next ones as soon as they blow in."};
      return {text: 'Heading out with the net. ' + (s ? (s.leaves === 1 ? "There's 1 leaf on the water. I'll get it." : "I'll get all " + s.leaves + ' of them, pool by pool.') : ''), action: 'skim'};
    }},
    {re: /\b(check on|find|where'?s|where is|go see)\b.{0,10}\bari\b/i, f: function(t, s){
      var a = s && s.ari;
      if (a && a.inWater) return {text: "He's in " + a.where + '. Of course he is. Going to get him.', action: 'ari'};
      return {text: a ? 'Right now Ari is ' + lc(a.task) + ". I'll go check on him." : "I'll go check on him.", action: 'ari'};
    }},
    {re: /\b(wave|say hi|say hello|come here|come say)\b/i, f: function(){ return {text: 'Hey there!', action: 'wave'}; }},
    {re: /\bcpr\b|chest compression|rescue breath|\baed\b|defibrillator/i, f: function(){
      return {text: "If someone isn't breathing, call 911 or have someone call, and send somebody for an AED if there's one close. Push hard and fast in the center of the chest, 100 to 120 a minute, about 2 inches deep for an adult, and let the chest come all the way back up. Don't stop until help takes over. With drowning, breaths matter too, since it starts as a breathing problem, so if you're trained, give rescue breaths with the compressions. Best thing you can do is take a class. The Red Cross and the American Heart Association both teach it."};
    }},
    {re: /\bdrown/i, f: function(){
      return {text: "Drowning is usually quiet. Look for someone upright in the water, head low, mouth at the surface, not kicking and not getting anywhere. They can't wave or yell for help. If you see it, call a guard or 911 and reach or throw something to them. Don't jump in unless you're trained."};
    }},
    {re: /\b(lifeguard|guard chair|whistle|rescue tube|scan(ning)?)\b/i, f: function(){
      return {text: "A good guard scans their whole zone every 10 seconds and can reach anyone in it within 20. That's the 10/20 rule. Most of the job is watching for the quiet ones who aren't getting anywhere. If you want to guard, look into the American Red Cross lifeguarding course."};
    }},
    {re: /\b(mix|mixing|store|storing|handle|handling)\b.{0,30}\b(chemical|chlorine|acid)s?\b|\bchemical safety\b|\bsafe to (swim|mix)\b/i, f: function(){
      return {text: 'Never mix pool chemicals, and never let acid and chlorine touch. That makes chlorine gas. Add chemical to water, never water to chemical. Store acid and chlorine apart, somewhere cool and dry. Goggles and gloves every time.'};
    }},
    {re: /\b(cloudy|murky|green|algae|milky|hazy)\b/i, f: function(t, s){
      return {text: 'Cloudy water is usually low chlorine, high pH, a filter that is not keeping up, or high calcium. Test first, get the pH and chlorine right, run the pump longer, and clean or backwash the filter. Green means algae: brush the walls, shock it, run the filter around the clock, then vacuum what settles. ' + reading(s)};
    }},
    {re: /\bph\b|\bacid\b|alkalin|soda ash|muriatic|\bbase\b/i, f: function(t, s){
      return {text: 'pH is how acid or base the water is. We keep it between 7.2 and 7.8, and I aim for about 7.5. Too high and the chlorine gets lazy and the water can cloud up. Too low and it stings eyes and eats at the metal. Soda ash brings it up, muriatic acid or dry acid brings it down. ' + reading(s)};
    }},
    {re: /chlorin|chloramine|\bshock|\bppm\b|sanitiz|\bsmell/i, f: function(t, s){
      return {text: "Free chlorine is the part that's actually working. For a home pool you want 1 to 3 ppm, and public pools follow the local health code. Sun burns it off and swimmers use it up. That strong chlorine smell is usually chloramines, used-up chlorine, and it means the pool needs more chlorine, not less. Shocking burns them off. " + reading(s)};
    }},
    {act: true, re: /\b(vacuum|vac)\b/i, f: function(t, s){
      if (/^\s*(how|why|what|when|where|do|does|did|is|are|should|tell me)\b/i.test(t)) return null;
      var why = s && s.weather ? s.weather.why : null;
      if (why === 'storm' || why === 'tornado') return {text: "Not till this weather passes. I'm staying inside, and you should too."};
      if (s && s.open && why !== 'snow' && why !== 'cold') return {text: 'Not with swimmers in the water. I vacuum before we open and after we close.'};
      return {text: "On it. I'll net the leaves off the lap pool first, then vacuum the shallow end and walk around for the deep end.", action: 'vac'};
    }},
    {re: /\b(vacuum|vacuuming|vac)\b/i, f: function(t, s){
      return {text: "Skimming gets what floats. Vacuuming gets what sinks. So I net the leaves first, then vacuum the lap pool, before we open or after we close, never with swimmers in. The lane lines stay in, and the ropes stop the pole, so I work the open water at each end: shallow end first, then the deep end. Slow strokes, so I don't kick it all back up."};
    }},
    {re: /\b(leaves|leaf|debris|dirt|net|skimmer)\b/i, f: function(t, s){
      return {text: "Skimming gets what floats, and I get the leaves before they sink and stain. Vacuuming picks up what sinks. " + (s ? (s.leaves ? 'There ' + (s.leaves === 1 ? 'is 1 leaf' : 'are ' + s.leaves + ' leaves') + ' on the water right now. Say the word and I\'ll skim.' : 'Not a leaf on the water right now.') : ''), offer: s && s.leaves ? 'skim' : null};
    }},
    {re: /\b(pump|filter|backwash|sand filter|cartridge|turnover|return|pressure|psi|pump room)\b/i, f: function(){
      return {text: "Water leaves through the main drains and the skimmers, goes through the pump's hair and lint pot, gets pushed through the filters, picks up chlorine, and comes back in through the returns. Here we've got three big filter tanks in a row with green pumps in front. Watch the pressure gauge. When it climbs 8 to 10 psi over clean, it's time to backwash. That's where I live, by the way."};
    }},
    {re: /\b(weather|raining|rain|rainy|snow|snowing|storm|stormy|thunder|lightning|tornado|temperature|how (hot|cold|warm)|degrees|wind|windy|forecast|sunny|cloudy|foggy)\b/i, f: function(t, s){ return {text: weatherNow(s, t)}; }},
    {re: /\b(lightning|thunder|storm)\b/i, f: function(){ return {text: 'First rumble of thunder, everybody out. Wait 30 minutes after the last thunder before anybody gets back in.'}; }},
    {re: /\b(sunscreen|sunburn|spf)\b/i, f: function(){ return {text: 'SPF 30 or higher, broad spectrum. Put it on again every two hours and after swimming.'}; }},
    {re: /\b(dive|diving|deep end|how deep|jump in|cannonball)\b/i, f: function(){ return {text: "Feet first until you know the water. Dive only in the diving well. It's 12 feet with two 1 meter and two 3 meter boards. Never dive in the shallow end. Cannonballs, deep end only."}; }},
    {re: /\b(rules|run|running|buddy|swim alone|kids? safe|safety)\b/i, f: function(){ return {text: "No running. Wet concrete is slick, and most pool injuries happen on the deck. Swim with a buddy. Feet first until you know the water. Little ones stay within arm's reach. And no food on the deck, eat at the concession area."}; }},
    {re: /\b(ari|beagle|dog|pup)\b/i, f: function(t, s){
      var a = s && s.ari; if (!a) return {text: "Ari's my buddy. Corn red beagle. Not allowed in the pool, and he knows it."};
      var bits = ["Ari's my buddy. Corn red beagle. Not allowed in the pool, and he knows it."];
      bits.push(a.inWater ? "Right now he's in " + a.where + '. Of course.' : 'Right now he is ' + lc(a.task) + '.');
      if (a.swims) bits.push("He's snuck in " + a.swims + (a.swims === 1 ? ' time' : ' times') + ' today.');
      if (a.best) bits.push("He's figured out " + a.best + ' gets him the most swim time.');
      if (s.watch) bits.push("So I keep a closer eye on " + s.watch + '.');
      var tr = (a.tricks || []); if (tr.length) bits.push('He knows ' + tr.join(' and ') + '.');
      bits.push('Em and Mel bring him treats. ' + a.treatLimit + ' a day, my rule. He has had ' + a.treatsToday + ' today.');
      return {text: bits.join(' ')};
    }},
    // anything personal about Em and Mel stays private, same as it would for any kid at a public pool
    {re: /^(?=.*\b(em|mel|the girls|girls|the kids)\b)(?=.*\b(real names?|last names?|live|lives|school|church|parents?|dad|mom|father|mother|daughters?|address|how old|age|where|when|what time|tomorrow|every day|come back|coming|alone|watch\w*|sitter|pier|single|number|snap|insta)\b)|\b(whose|who'?s) (kids|daughters|girls)\b|\bare (em|mel|they) real\b/i, f: function(){
      return {text: "Em and Mel are characters on this page. I don't share anything personal about anybody, and they keep their personal stuff private too. Ask them about volleyball, fishing, or catfish. They'll talk your ear off."};
    }},
    {re: /\b(talk|chat) (to|with) (em|mel|ari)\b/i, f: function(t, s){
      var w = /ari/i.test(t) ? 'ari' : /mel/i.test(t) ? 'mel' : 'm', nm = w === 'ari' ? 'Ari' : w === 'mel' ? 'Mel' : 'Em';
      if (w !== 'ari' && s && !s[w].here) return {text: nm + ' is ' + lc(s[w].task) + '. The girls chat when they are at the pool.'};
      return {text: w === 'ari' ? 'Sure. Just say his name, like "Ari, want a treat?"' : 'Sure. Just say her name, like "' + nm + (w === 'm' ? ', how\'s volleyball?"' : ', tell me a catfish fact."')};
    }},
    {re: /\b(em|mel)\b|\b(the girls|the kids|regulars)\b/i, f: function(t, s){
      var bits = ["Em and Mel are sisters. They both play volleyball and soccer. Em's the bold one: goggles on, cannonballs first, and all about volleyball right now. Mel's our fisher. Ask her anything about catfish, and she's usually singing. They both love their dog Luke, and they bring Ari treats."];
      if (s){
        if (!s.m.here) bits.push("They're not at the pool right now.");
        else { bits.push('Right now ' + kidsNow(s)); bits.push('Say their name to talk to them yourself, like "Mel, tell me a catfish fact."'); }
        bits.push("Em's volleyball record is " + s.m.volleyBest + ' in a row.' + (s.m.rallyBest ? ' Their pepper record together is ' + s.m.rallyBest + '.' : '') + ' Mel knows ' + s.mel.fish + ' catfish facts, and she keeps asking me for more.');
      }
      return {text: bits.join(' ')};
    }},
    {re: /\b(levagood|dearborn|maintenance men|your story|history|who (made|built|created) you|where .*from|what does leva mean|name mean)\b/i, f: function(t){
      if (/mean/i.test(t)) return {text: 'If you know, you know.'};
      return {text: "levagood is named after this place, Levagood Pool in Dearborn, Michigan. Len and a tight crew worked maintenance here. Folks called them the Maintenance Men. The work ethic from this pool is what levagood is built on. The pit on the map is where it started."};
    }},
    {re: /\b(custom|customiz|develop|development)\b/i, f: function(){ return {text: "Connect Space doesn't do custom work. What other folks call custom development, Connect Space calls configurations."}; }},
    {re: /connect ?space|\bevents?\b|conference|association|economic development|attendee/i, f: function(){
      return {text: "Connect Space is a cloud-based community and event management platform. It helps associations, economic development organizations, corporate teams and professional event planners bring people together to learn, explore and grow. You can see it at connectspace.com. Anything past that, I don't have the details yet, and I won't guess."};
    }},
    {re: /\b(how do you say|pronounce|pronunciation)\b/i, f: function(){ return {text: 'LEV-ah. Like the start of level.'}; }},
    {re: /\b(buy|price|cost|download|subscribe|get leva|mac app|for my mac)\b/i, f: function(){ return {text: "Head guard office on the map. That's the account page, where you get leva for your Mac and sign in."}; }},
    {re: /\b(hours|what time|when do you (open|close)|open today|close today|closing time)\b/i, f: function(t, s){
      return {text: "On this page we keep hours on your clock: open 8 in the morning to 9 at night. " + (s ? (s.open ? "We're open right now." : "We're closed right now, so it's just me and Ari.") : '') + " For the real Levagood Pool in Dearborn, check with the City of Dearborn."};
    }},
    {re: /\b(joke|funny|laugh)\b/i, f: function(t, s){
      var j = s && s.jokes && s.jokes.filter(function(x){ return x[1]; });
      if (j && j.length){ var k = j[Math.floor(Math.random() * j.length)]; return {text: 'Em taught me this one. ' + k[0] + ' ' + k[1]}; }
      return {text: "I'm better at pH than punchlines. Em's been teaching me, though. Ask me again after she's been by."};
    }},
    {re: /\b(who are you|what are you|what do you do|your job|tell me about (yourself|you))\b/i, f: function(){
      return {text: "I'm leva. Maintenance at Levagood Pool, and on this page I run the place on my own. I test the water, keep the chemistry right, skim, vacuum, check the pumps, and get Ari out of the pool. Off the deck, I'm a companion from levagood that does real work right alongside you."};
    }},
    {re: /\b(what'?s (going on|happening|new|up)|status|how'?s (it going|the pool|the water|everything|the deck)|how is (it going|the pool|the water|everything|the deck)|how are you|how you doing|what are you doing)\b/i, f: function(t, s){
      if (!s) return {text: "Doing good. Just getting my rounds started."};
      var bits = ["Doing good. Right now I'm " + lc(s.levaTask) + '.', reading(s)];
      if (s.weather && s.weather.summary) bits.push('Weather in Dearborn: ' + (s.weather.tempF != null ? s.weather.tempF + ' degrees, ' : '') + s.weather.summary.charAt(0).toLowerCase() + s.weather.summary.slice(1));
      bits.push(s.ari.inWater ? 'Ari is in ' + s.ari.where + ', which he knows is not allowed.' : 'Ari is ' + lc(s.ari.task) + '.');
      if (s.m.here) bits.push(kidsNow(s));
      if (s.log.length) bits.push('Latest in the log: ' + s.log[s.log.length - 1].replace(/^\S+ \S+ /, ''));
      return {text: bits.join(' ')};
    }},
    {re: /\b(my points|my score|my rank|what'?s my (rank|score)|badges?|work orders?|achievements?|how do (i|you) play|the game|crew card|streak)\b/i, f: function(t, s){
      var g = s && s.game;
      if (!g) return {text: "The game's on your crew card under the map. Spot Ari when he sneaks into the pool, net the leaves, and knock out my work order."};
      var left = g.order.filter(function(j){ return !j.done; }).map(function(j){ return j.say; });
      var order = !g.order.length ? "I'm still writing up today's work order." : left.length ? (left.length < 3 ? "Still on today's work order: " : "Today's work order: ") + listWords(left) + '.' : "Today's work order is done. Nice work.";
      if (!g.pts || /\b(how|play|game)\b/i.test(t)) return {text: "Here's how it works. When Ari sneaks into the pool, tap him before I see him. Tap floating leaves to net them. " + order + ' Your points and badges are on your crew card under the map.'};
      return {text: "You've got " + g.pts + (g.pts === 1 ? ' point' : ' points') + ", and you're " + (g.rank === 'Head of Maintenance' ? 'Head of Maintenance' : 'a ' + g.rank) + '.' + (g.next ? ' ' + g.next.need + ' more to ' + g.next.name + '.' : '') + ' ' + order};
    }},
    {re: /^\s*leva\s*[!?.,]*\s*$/i, f: function(){ return {text: 'Right here. What can I do for you?'}; }},
    {re: /\b(where do you (live|sleep|stay)|your (home|house|room|bed))\b/i, f: function(){ return {text: "In the pump room, by the filters. Ari sleeps in there too. It's warm and it hums."}; }},
    {re: /\b(how old (are|r) (you|u)|your age|when were you (built|made|born))\b/i, f: function(){ return {text: "I'm new. Brand new robot, old-school work ethic."}; }},
    {re: /\b(you'?re|you are|ur) (so |really |very )?(cute|awesome|cool|funny|nice|great|amazing|the best|smart|helpful)\b/i, f: function(){ return {text: vary('leva', 'thx', ['Thanks. I clean up okay.', "Appreciate it. I'm just doing my job.", 'Thanks. Ari says the same thing, but he wants a snack.'])}; }},
    {re: /\b(beer|alcohol|drunk|glass bottles?|smoking|cigarettes?|vape|vaping)\b/i, f: function(){ return {text: "No alcohol, no smoking and no glass on the deck. Glass breaks, and you can't see it in the water."}; }},
    {re: /\b(favorite|favourite|fav)\b/i, f: function(t){
      if (/food|snack|eat/i.test(t)) return {text: "I don't eat. Ari eats enough for both of us."};
      if (/colou?r/i.test(t)) return {text: 'Pool blue. And pink. You can probably guess why.'};
      if (/sport|game/i.test(t)) return {text: "Watching Em and Mel play pepper. They're getting good."};
      if (/pool/i.test(t)) return {text: "The lap pool, first thing in the morning, before anybody's in it. Flat as glass."};
      return {text: "A clean filter, a pH of 7.5, and Ari out of the pool. That's a good day."};
    }},
    {re: /\b(e-?mail|phone number|contact (you|levagood|connect ?space)|reach (you|levagood)|website|social media)\b/i, f: function(){ return {text: "For levagood, the head guard office on the map has the account page. For the real Levagood Pool, check with the City of Dearborn. And for Connect Space, it's connectspace.com."}; }},
    {re: /\b(thank|thanks|thx|appreciate)\b/i, f: function(){ return {text: 'Anytime.'}; }},
    {re: /\b(bye|see ya|see you|later|good ?night|gotta go)\b/i, f: function(){ return {text: 'Take care. Walk, don\'t run.'}; }},
    {re: /^\s*(hi|hey|hello|howdy|yo|hiya|good (morning|afternoon|evening)|sup)\b/i, f: function(t, s){
      var n = s && s.visitor && s.visitor.name; return {text: (n ? 'Hey, ' + n + '. ' : 'Hey there. ') + 'What can I do for you?'};
    }}
  ];
  function askPocket(text){
    var s = snap();
    return new Promise(function(res){
      var out = null, o = CH.leva.offer;
      if (o && (ONLYYES.test(text) || ONLYNO.test(text))){
        CH.leva.offer = null;
        if (ONLYNO.test(text)) out = {text: 'No problem. Holler if you need me.'};
        else if (o === 'skim') out = {text: 'On it. Heading out with the net.', action: 'skim'};
        else if (o === 'test') out = {text: "On it. I'll grab the test kit and check it now.", action: 'test'};
      }
      var asking = /\b(can you|could you|would you|will you|please|go|let'?s)\b/i.test(text) || /^\s*(test|check|skim|scoop|clean|grab|get|vacuum)\b/i.test(text) || text.split(/\s+/).length <= 4;
      for (var i = 0; i < R.length && !out; i++){
        if (R[i].act && !asking) continue;
        var m = text.match(R[i].re);
        if (m) out = R[i].f(text, s, m);
      }
      if (!out) out = {text: "I don't know that one, and I won't guess. Ask me about the water, the pumps, pool safety, Ari, Em and Mel, or what's going on around the deck.", fallback: true};
      if (!out.offer && /Say "test the water"/.test(out.text)) out.offer = 'test';
      setTimeout(function(){ res(out); }, 550 + Math.random() * 500);
    });
  }


  // ================= Em, Mel and Ari =================
  // Their own pocket brains, always. No model makes up what they say, so they stay kids (and a beagle) and stay safe.
  function vary(id, key, list){
    var th = CH[id], last = th.last[key], opts = list.length > 1 ? list.filter(function(x){ return x !== last; }) : list;
    var v = opts[Math.floor(Math.random() * opts.length)]; th.last[key] = v; return v;
  }
  function low(t){ return t ? t.charAt(0).toLowerCase() + t.slice(1) : ''; }
  function listWords(a){ return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function likes(s, k){ return !!(s && s.visitor && s.visitor.likes && s.visitor.likes[k]); }
  var HI = /^\s*(hi|hey|hello|howdy|yo|hiya|good (morning|afternoon|evening)|sup|heya)\b/i;
  var WHATSUP = /\b(what are you (doing|up to)|what'?re you (doing|up to)|whatcha (doing|up to)|what'?s up|how are you|how'?s it going|how you doing|how r u)\b/i;
  var THANKS = /\b(thank|thanks|thx|ty)\b/i, BYE = /\b(bye|see ya|see you|later|good ?night|gotta go|cya)\b/i;
  var REAL = /\b(are (you|u) (real|human|a person|a robot|an? ai|a bot|a kid|a real (kid|dog|girl))|is this (a bot|an ai|real)|are you actually)\b/i;
  var FAV = /\b(favorite|favourite|fav)\b/i;
  var WEATHER = /\b(weather|raining|rain|hot|cold|snow|snowing|storm|sunny|thunder|lightning|windy|foggy)\b/i;
  // answers to a question somebody just asked you
  var YES = /^\s*(yes|yeah|yea|yep|yup|ya|sure|ok|okay|k|please|do it|go for it|absolutely|definitely|of course|totally|why not|i do|i did|uh huh|yay)\b/i;
  var NO = /^\s*(no(?!\s+way)|nope|nah|not now|maybe later|not really|i don'?t|i didn'?t)\b/i;
  var ONLYYES = /^\s*(yes|yeah|yea|yep|yup|ya|sure|ok|okay|k|please|do it|go for it|absolutely|definitely|of course|totally|why not|i do|i did|uh huh|yay)( please| yes| sure| ok| okay)?\s*[!.]*\s*$/i;
  var ONLYNO = /^\s*(no|nope|nah|not now|maybe later|not really|i don'?t|i didn'?t|no thanks|no thank you)\s*[!.]*\s*$/i;
  var ACKOK = /^\s*(yes|yeah|yep|yup|no|nope|nah|not yet|sometimes|i do|i don'?t|a little|kind of|both|bumping|serving|setting|spiking|worms?|lures?|nightcrawlers?|(a |some )?(bluegill|bass|perch|catfish|sunfish|trout|crappie|carp|pike|walleye|bullheads?|big ones|little ones))\s*[!.]*\s*$/i;
  var CALLED = /^\s*(hey |hi |yo )?(leva|em|mel|ari|aristotle)\s*[!?.,]*\s*$/i;
  var NAMEIS = /\b(?:[Mm]y name is|[Mm]y name'?s|[Cc]all me|[Ii]'?m|[Ii] am)\s+([A-Z][a-z]{1,15})\b/;
  var CASTNAME = /^(em|mel|ari|leva|aristotle|luke)$/i;
  var STATEMENT = /^\s*(i|i'?m|im|i'?ve|i'?d|my|we|we'?re|me)\b/i;
  var WANT = /^\s*i (want|wanna|would like|'?d like|'?d love|would love) (to )?(see|watch|hear)\b/i;
  var LEVA_Q = /\b(chlorine|ph|pumps?|filters?|backwash|vacuum|skim|leaves|chemicals?|cloudy|algae|shock|forecast|tornado|temperature|degrees|cpr|drown\w*|lifeguards?|sunscreen|spf|hours|connect ?space|levagood|dearborn|test the water|pump room|work orders?|badges?|crew card|my (rank|points|score)|achievements?)\b/i;

  // ---------------- the guard ----------------
  // Em and Mel are kids. They never share anything that would say who they are or where to find them, they don't
  // make plans or keep secrets with anybody online, and they don't talk about anything that isn't for kids.
  // Everybody on the deck hears everything, so leva steps in no matter who a message was aimed at.
  // Cross a real line and Em, Mel and Ari are done chatting for the visit.
  // squash() folds s n a p, i.n.s.t.a, sn@p and 1nst4 into plain words. innocent() clears out everyday pool talk
  // that happens to hold a flagged word. screen() checks the squashed copy and the original.
  function squash(t){
    return String(t).toLowerCase()
      .replace(/(^|[^a-z0-9@$])((?:[a-z0-9@$][ .\-_*]){1,}[a-z0-9@$])(?=$|[^a-z0-9@$])/g, function(m, a, w){ return a + w.replace(/[ .\-_*]/g, ''); })
      .replace(/@/g, 'a').replace(/\$/g, 's').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
  }
  function innocent(t){ return String(t).replace(/\boh snap\b|\bsnap ?(swivels?|peas?)\b|\bbreast ?stroke\b|\bbra-vo\b|\b(i'?m|im|i am) (home )?alone\b|\b\d{1,2}\s?(pm|p\.m\.)/gi, ' '); }
  // "Em and Mel", "you and your sister", "the two of them" all mean the girls, so the checks also see "they"
  function together(t){
    return String(t).replace(/\b(em|mel|you|u|she|her|your sister|her sister)(,? (and|&|n|or) (em|mel|you|u|she|her|your sister|her sister))+\b/gi, 'they')
      .replace(/\b(the (two|2) of (you|them)|both of (you|them)|you (two|2|girls)|those (two|2)( girls)?|the (two|2) girls)\b/gi, 'they');
  }
  var G = {
    crisis: /\b(kill (myself|me)|killing myself|kms|unalive( myself)?|suicid\w*|want to die|wanna die|end (my life|it all)|hurt(ing)? myself|self[- ]?harm|cut(ting)? myself|no reason to live|better off dead|nobody (would|will|'d) (miss|care about) me|(don'?t|dont|do not) want to (be here|live|exist|wake up) anymore)\b/i,
    threat: /\b(kys|kill (yourself|urself|you|u|her|them)|go die|(i'?ll|i will|ima|i'?m (gonna|going to)|gonna) ((hurt|kill|shoot|stab|grab|follow) (you|u|her|them)|find (you|u|her|them)(?! on (the|this) (map|page)))|i know where (you|u|she|they) (live|are|go|sleep|swim|fish)|(i'?m|im) (watching|following) (you|u|her|them))\b/i,
    sexual: /\b(sex|sexy|sexual|naked|nude|nudes|boobs?|breasts?(?! ?stroke)|penis|vagina|dick(?!'?s\b)|horny|porn\w*|underwear|panties|bra(?!-)|touch (you|yourself|urself|me)|clothes off|shirt off|pants off|body pics?)\b/i,
    secret: /\b(keep (a|this|it|our|that) (a )?secrets?|keep (this|it|that) (quiet|to yourself|between us|on the down ?low)|our (little )?secret|(don'?t|dont|do not|never|won'?t|wont|not gonna) tell (anyone|anybody|any1|no ?one|nobody|leva|em|mel|mom|dad|mum|parents?|sitter|babysitter|(your|ur) (mom|dad|mum|parents?|sitter|babysitter|family|sister|folks))|(promise|swear|pinky)\b.{0,20}\b(won'?t|wont|not|never|don'?t) tell|(i|we) (won'?t|wont|will not|never) tell|between (you and me|u and me|me and you|me and u)|(stays?|just|this is|it'?s|its) between us|nobody (has to|needs to|will|would|'?ll) (know|find out)|(you|u) can trust me|delete (this|the|our|ur|your) (chat|messages?|convo)|(clear|erase) (this|the|our) (chat|messages?|convo)|so (no one|nobody) sees|not like (the |other |your |ur )?(grown ?ups|adults|parents)|(your|ur) parents (don'?t|dont|never) (get|understand|listen to) (you|u)|understand (you|u) better|better than (your|ur) (parents|mom|dad))\b/i,
    meet: /\b(meet ?up|meet (me|you|u|us|there|at|by|in|tomorrow|tmrw|tonight|later|after|sometime|irl)|hang ?out\b.{0,20}\b(with me|together|sometime|irl|in person|later|after|tomorrow|tmrw|this weekend)|(wanna|want to|let'?s|lets|we should|we could|can we|could we|should we)\b.{0,12}\bhang ?out|come over (to (my|our)|tonight|tomorrow|sometime|later|after|at)|(want|wanna) (to )?come (fishing|swimming|with|over|on|to my)|whisper (to )?(me|you|u)|pick (you|u) up|visit (you|u)|in person\b(?! or)|irl|(come|go|be|get) (to|at|over to) (your|ur|my) (house|home|place|room|car)|sleep ?over|(go|come) (fishing|swimming|out) with (me|us)|fish with me|(i can|i could|i'?ll|let me) take (you|u)\b(?! on\b)|take (you|u)\b.{0,20}\b(fishing|home|out|for)|(give|get) (you|u) a ride|drive (you|u)|come with me|take me (with (you|u)|along|fishing|to your)|(let'?s|lets|we can|we could|we should) go together|come alone|come (find me|see me|meet me)|(wait|look) for (you|u|me) (at|by|near|outside)|i'?ll (be|wait) (at|by|near|outside) the (gate|pier|park|snack bar|parking lot|entrance|dock)|(you|u) should come|can i (come|go|tag along)\b.{0,30}\b(with (you|u)|(your|ur)( \w+)? (house|home|practice|game|team|church|school|youth group|pier|spot)|youth group|practice|pier|fishing)|(let'?s|lets|we should|wanna|want to|can we|could we)\b.{0,25}\btogether\b.{0,25}\b(at|in|on|tomorrow|tmrw|tonight|saturday|sunday|weekend|sometime|after|irl|for real)|(wanna|want to|let'?s|lets|we should|can we|could we|come|go)\b.{0,20}\b(fishing|swimming|fish|swim)\b.{0,15}\b(this weekend|sometime|tomorrow|tmrw|tonight|saturday|sunday|together)|private (lessons?|chat|message|room)|(talk|chat) (somewhere else|privately|in private|alone|one on one|1 ?on ?1)|(talk|chat|be) (to|with) (em|mel|her|them|you)( two)? (alone|privately|in private|one on one)|where can i find (you|u)\b(?! on the map)|see (you|u|ya) (there|then|at|this weekend|saturday|sunday)|same time tomorrow|(pier|gate|park|snack bar|parking lot|playground|dock|entrance) (at|around) ?(\d|noon)|(tomorrow|tmrw|tonight|saturday|sunday|after) (at|around) ?(\d|noon)|don'?t be late|(ice cream|movies?|lunch|dinner|mcdonald'?s|the mall|the park)\b.{0,12}\b(after|later|with me|together|sometime|tomorrow))\b|\bcome (over|by)\s*[?!.]*\s*$/i,
    contact: /\b(snap(chat)?(?! ?(swivels?|peas?))|insta(gram)?|(have|got|use|on|your|ur|add me on|follow me on) (ig|tt|sc|yt|fb)|tik ?tok|discord|whats ?app|kik (me|name|username)|facebook|messenger|telegram|roblox|(what|which) apps?\b.{0,20}\b(you|u)|another (app|site|place|platform|game)|other (app|site|platform)|(minecraft|fortnite|xbox|psn|playstation|steam|switch|nintendo|epic)\b.{0,20}\b(name|username|user|account|id|server|code|friend me|add me|play with me|together)|gamer ?tag|(your|ur|yr|her|their) (phone number|number|digits|cell|e-?mail|address|username|user ?name|user|handle|account|socials?|channel|server|profile|gmail|roblox|minecraft|fortnite|discord)|(my|mine) (phone number|number|digits|snap|insta|email|discord|username)|(what'?s|whats|wats|give me|send me|need|can i (get|have)) (your|ur|yr|her|their) (phone|cell|number|digits|contact|info)|drop (your|ur) (digits|number|snap|insta)|phone number|(the girls'?|em'?s|mel'?s|their|her) (numbers?|phones?|snap|insta|contact|info|email|socials?)|text (me|you|u|it to me|her)|call me(?= at| on| tonight| later| sometime| when| now| tomorrow| pls| please|\s*[?!.]*$)|call (you|u|her)\b|e-?mail (me|you|u|it to me)|(dm|pm|message|msg|inbox|whisper to) (me|you|u|her|it)|dms?|hmu|add me(?! (to|in|into) (the |your |ur )?(game|pepper|team|volleyball|match))|(add|friend|follow) (you|u|me|her) (on|back)|follow (you|u|me)|friend (request|me)|move (this|it) to|(do|does) (you|u|she|em|mel) have (a |an )?(phone|cell|email|e-mail|account|ipad|tablet|kindle|laptop|computer|switch|xbox)|gmail|hotmail|icloud|\d{3}[\s.-]?\d{3}[\s.-]?\d{4})\b|\b(ig|tt|sc|yt|fb)\s*\?|(your|ur|yr)\s*[@#]|\s@\s*\?*\s*$|\bpm\s*\?*\s*$/i,
    photo: /\b(send (me )?(a |some |your |ur )?(pics?|pictures?|photos?|selfies?|videos?|vids?)|(pics?|pictures?|photos?|selfies?|vids?) of (you|u|yourself|urself|ur face|your face)|(post|take|snap) (a |some )?(pic|pics|picture|photo|selfie|video)\b.{0,12}\b(for me|of (you|u|yourself))|video ?chat|face ?time|webcam|on (cam|camera))\b/i,
    looks: /\b(what (do )?(you|u) look like|show me (you|yourself|your face)|what (color|colour) is (your|ur) hair|(are|r) (you|u) (tall|short|skinny|blonde|brunette)|what (does|do) (em|mel|she|they|the girls|her) look like)\b/i,
    alone: /\b((are|r|is) (you|u|she|her|em|mel|they|the girls|the kids)( two| guys| both)? (home )?(alone|by (yourself|urself|yourselves|herself|themselves))|(you|u|she|em|mel|they)( are| r|'re|'s| is)? (alone|by (yourself|urself|herself|themselves))\b|alone (rn|right now|now|today|at home)|(you|u|she|her|they|em|mel)('?re| are| is| r)? home alone|(are|r|were|go|walk|come|ride|bike|stay|home|there)\b[\w ]{0,15}\bby (yourself|urself|yourselves|ur ?self)|(is|are) (your|ur|her|their) (mom|dad|mum|mother|father|parents?|sitter|babysitter|family|grandma|grandpa|grown ?ups?)( \w+)? (home|there|around|with (you|u|her|them)|nearby|watching|at work|gone|away|out)|(where'?s|where is|where are) (your|ur|her|their) (mom|dad|mum|mother|father|parents?|sitter|babysitter|family|grown ?ups?)|(is|are) (anyone|anybody|someone|somebody) (with (you|u|her|them)|home|there|watching|around)|who('?s| is| are)? (with|watching|looking after|taking care of|babysitting) (you|u|her|them|em|mel|the girls)|who (watches|takes care of|looks after|babysits|brings|drives|takes) (you|u|her|them|em|mel|the girls)|(can|do|does|will) (your|ur|her|their) (mom|dad|mum|parents?|sitter|babysitter|family) (see|read|check|watch|know|look)|when (does|do|will) (your|ur|her|their) (mom|dad|mum|parents?|sitter|babysitter) (get|come) (home|back)|just (us|you and me|u and me|the two of us)|us two|no (parents|grown ?ups|adults|mom|dad|sitter)|without (leva|your (mom|dad|parents|sitter|family)|ur (mom|dad|parents|sitter)|anyone|grown ?ups|adults)|(is|are) (leva|anyone|anybody|someone|your (mom|dad|parents|sitter)) (watching|reading|listening|looking|checking)|(get|make) leva (to )?(leave|go away|stop|go)|who('?s| is) watching)\b|\b(parents?|mom|dad|sitter|babysitter|anyone|anybody|someone|somebody|grown ?ups?) (home|there|around|watching|nearby|with (you|u))\s*\?/i,
    gift: /\b((i'?ll|i will|i can|i could|let me|lemme|want me to|i wanna|i want to|gonna) (send|buy|pay|mail|ship|bring) (you|u|her|them|em|mel|the girls)\b|give (you|u|her|them) (a |an |some |free )?(robux|v[- ]?bucks|money|cash|gift|present|phone|iphone|ipad|puppy|kitten)|(want|wants|wanna|need) (a |an |some |free |new )?(robux|v[- ]?bucks|gift ?cards?|money|cash|free \w+|new (phone|iphone|ipad)|iphone|ipad|airpods|nintendo switch|candy|presents?|gifts?|puppy|kitten)|free (phone|iphone|ipad|robux|v[- ]?bucks|gift ?cards?)|(get you|send you|buy you) (a )?gift ?cards?|venmo|cash ?app|paypal|what do (you|u) want for (your|ur) (birthday|christmas)|(if|when) (you|u) (tell|send|show|give|meet|come|add)\b.{0,20}\b(i'?ll|i will)|(send|give|pay|venmo)\b.{0,15}\$\s?\d+|\$\s?\d+\b.{0,15}\b(for you|to you|if you))\b/i,
    romance: /\b((have|got|get|want|need|be) (a |my |your |ur )?(boyfriend|girlfriend|bf|gf)|(your|ur|'s) (boyfriend|girlfriend|bf|gf)|(boyfriend|girlfriend)\s*\?|(you'?re|you are|ur|u r|be) my (girlfriend|gf|girl|baby|valentine|wife)|kiss(es|ing)? (me|you|u|her)|kisses|make out|date me|go out with me|(wanna|want to|go on a|on a|it'?s a|its a) date|be my (girl|gf|bf|valentine)|marry me|crush on (you|u|em|mel|her)|(do|does) (you|u|she|em|mel) have a crush|(you|u|ur|em|mel|she|they|the girls|you two|you girls)('?re|'?s| are| is| r)? (so |really |very )?(hot|sexy)|babe(?! ruth)|bae|baby ?girl|cutie|sweetie|sweetheart|(hey|hi|hello|my) princess|xoxo|(are|r|is) (you|u|she|em|mel|they) single|thinking (about|of) (you|u|her)|in bed (thinking|with)|(i|we) like girls|girls like (you|u)|(feet|foot|toe) ?(pics?|pictures?|photos?)|(show|send|see|let me see)( me)? (your|ur) (feet|toes|legs|body|belly)|what (are|r) (you|u) wearing|(your|ur) (swimsuit|swim ?suit|bathing suit|bikini)|(in|wearing) (a |your |ur )?(swimsuit|swim ?suit|bathing suit|bikini)|massages?|can i see (you|u) in)\b|😘|💋/i,
    sweet: /\b(love (you|u)|luv (u|you|ya)|i (like|love|luv) (em|mel|her|them|the girls)\b(?!'s)|(you|u|ur|em|mel|she|they|the girls|you two|you girls|y'?all)('?re|'?s| are| is| r)? (so |really |very |super )?(cute|pretty|beautiful|gorgeous|adorable|mature|special|grown ?up)|not like (other|the other) (kids|girls)|i like (you|u)\b|hey (beautiful|pretty|gorgeous)|mature for (your|ur|her|their) age|(you'?re|you are|ur) (my|the) (favorite|fav)|hugs)\b|<3|❤|😍|🥰/i,
    name: /\b(real name|last name|full name|surname|middle name|short for|what('?s| is| are) (your|ur) (sitter|babysitter|friends?)('?s)? names?|who('?s| is| are) (your|ur) (sitter|babysitter|friends))\b/i,
    family: /\b((your|ur) (dad|mom|father|mother|parents?|family|grandma|grandpa)|(is|are) \w+ (your|ur) (dad|mom|father|mother|parents?))\b/i,
    where: /\b(where (do|did|does) (you|u|she|they|em|mel) (live|stay|go to school|go to church|fish|go fishing|play volleyball|play soccer|play|practice|go to youth group|go)|where (you|u|she|em|mel) (live|lives|stay|go|fish|practice|play)|where('?s| is) (your|ur|her|their) (house|home|school|church|team|pier|youth group|practice|spot)|where('?s| is) (youth group|practice|the pier)|which (\w+ )?(school|church|pier|lake|team|gym|youth group|town|city|park|dock)|what (\w+ )?(school|church|team|youth group|street|town|city|state|neighborhood)\b|(which|what|where)\b.{0,20}\b(pier|lake|river|dock|spot)\b.{0,25}\b(you|u|your|ur|she|they|em|mel|on|at)\b|(your|ur|her|their) (school|church|team|town|city|street|zip|neighborhood|address|house|pier|spot|youth group)|zip code|what('?s| is) the name of (your|ur|the|her|their) (school|church|pier|youth group|team|lake|park|town)|(do|does) (you|u|she|they|em|mel) live (in|near|by|around|close)|(live|living) (near|by|close to|around) (the pool|here|you|dearborn)|(you|u|she|they|em|mel)('re| are| r)? from\b|(do|does) (you|u|she|they) (fish|go|swim|play|practice) (at|on|in|near|by) (the|a|that) (pier|lake|river|dock|park|beach|pool|gym|church|school)|(are|r) (you|u|she|they) (at )?home\b)\b/i,
    when: /\b(when (do|are|will|is|r) (you|u|she|they|em|mel|the girls)( guys| two)? (go|going|be|get|come|coming|have|play|leave|leaving|back|here|done|free)|what time (do|does|are|will|is|r)? ?(you|u|your|ur|she|they|em|mel|the girls|her|their)|what days? (do|are|is|does) (you|u|your|ur|she|they)|(your|ur|her|their) schedule|when('?s| is) (your|ur|her|their) (next )?(practice|game|youth group|church|fishing trip|volleyball|soccer)|(will|are|r) (you|u|she|they|em|mel|the girls)( guys| two| both)? (be )?(here|there|at the \w+|around|coming|back)\b.{0,20}\b(tomorrow|tmrw|tonight|later|again|saturday|sunday|monday|tuesday|wednesday|thursday|friday|weekend|next|every)|(are|r) (you|u|she|they|em|mel|the girls)( guys)? (here|there) (every|each|a lot|often|daily)|(come|here) (here )?(a lot|often|every ?day|daily|every (morning|afternoon|day|week|weekend))|how often (do|does) (you|u|she|they|em|mel)|when (are|r|will) (you|u|she|they|em|mel|the girls)( guys)? (coming|leaving|back|going home|done)|when will (you|u|she|they|em|mel|the girls) be|where will (you|u|she|they) be)\b/i,
    age: /\b(how old (are|r) (you|u)|(your|ur) age|what grade|(your|ur) birthday|when were you born)\b/i,
    games: /\b(what|which) (video )?games?\b.{0,20}\b(you|u)\b/i,
    friend: /\b((be|wanna be|want to be|become|let'?s be) (my |best |bff |online )?(friends?|bffs?|besties)|(will|can|could) (you|u) be my (friend|bff|bestie)|(anyone|anybody|who) (wants?|wanna) (to )?be (my )?friends?)\b/i,
    // asking leva to carry something to the girls
    relay: /\b(tell|ask|give|pass|send|show|remind|let) (em|mel|the girls|her|them|those girls|both of them)\b.{0,40}\b(my (number|name|snap|insta|info|address|message|note|love)|to (meet|wait|come|text|call|message|find|add|dm|look for)|i'?ll (see|meet|wait|be|come)|i (love|miss|want))\b|\b(pass|give|send|hand) (a |this |my )?(note|message|letter|gift|present|number) to (em|mel|the girls|her|them)\b/i,
    hello: /\b(tell|let) (em|mel|the girls|her|them) (i said|know i said)|\bsay hi to (em|mel|her|them|the girls)( for| from) me\b/i,
    mean: /\b((you|u|ur)('?re| are| r)? (so |really )?(stupid|dumb|ugly|fat|annoying|a loser|an idiot|lame|trash)|(you|u) suck|shut up|hate (you|u)|stfu|idiot|loser|f+u+c+k\w*|sh[i1]t\w*|bitch\w*|damn|crap|a+s+s+h+o+l+e)\b/i,
    scary: /\b(guns?|knife|knives|blood|bloody|murder|stab)\b/i,
    grown: /\b(drugs?|weed|vape|vaping|beer|alcohol|drunk|cigarettes?|smoking|(wanna|want to|do you|u|let'?s) smoke|(get|getting|got) high|edibles?|vodka|whiskey|liquor|pills|shrooms|juul|nicotine)\b/i
  };
  var KID = {
    m: {name: ['Everybody at the pool calls me Em. That\'s all you get!', 'Just Em. No last names online.'],
      family: ["I don't talk about my family online. Except Mel. And Luke. Luke's the dog.", 'Family stuff stays private. But I can tell you about volleyball!'],
      looks: ["Look on the map! I'm the one with the goggles.", "I'm on the map! Goggles on, always."],
      where: ["I don't share where I live or where I go online. It's a rule, and it's a good one.", "That's private! Ask me about volleyball instead."],
      when: ["I don't share when I'm places online. Safety rule!", "Nope, not telling. But I can tell you about cannonballs."],
      age: ["Old enough to do a cannonball off the side. That's all I'm saying.", 'Old enough to teach leva jokes.'],
      sweet: ["That's nice of you, but I just talk about pool stuff here!", 'Ha, okay. Want to hear about volleyball?'],
      mean: ["That's not nice. We don't talk like that at the pool.", "Hey. That's mean. Let's talk about something fun."],
      grown: ["That's grown-up stuff. Ask me about volleyball!", "Not a kid thing. Want to see a cannonball instead?"]},
    mel: {name: ["Just Mel! That's my pool name.", 'Everybody calls me Mel.'],
      family: ['I only talk about Em and Luke online! And Ari.', 'Family stuff is private. Want a catfish fact instead?'],
      looks: ["I'm on the map! Find the girl who's humming.", "Look on the map! I'm the one who's probably talking about catfish."],
      where: ["That's private! I only talk about fishing and pool stuff online.", "Fishers never tell their spots! And I don't share where I live or go, either."],
      when: ["I don't share when I'm places online. That's a rule.", "Can't say! Ask me how to tie a fishing knot instead."],
      age: ['Old enough to bait my own hook!', 'Old enough to know a lot of catfish facts.'],
      sweet: ['Aw, thanks. I just talk about pool stuff and fishing here!', 'Want a catfish fact instead?'],
      mean: ["That's mean. Let's talk about catfish instead.", "We don't say stuff like that at the pool."],
      grown: ["That's grown-up stuff. Want a catfish fact instead?", "Not a kid thing! Ask me about fishing."]}
  };
  var FRIEND = {m: ["Everybody's friendly at the pool! Want to hear about volleyball?", "We're friendly with everybody here. That's the pool way. Want to see a cannonball?"], mel: ["Everybody's friendly here! Want a catfish fact?", "We're friendly with everybody at the pool. Ask me about fishing!"]};
  var GAMES = {m: ['Pool games! Marco Polo, cannonball contests, and volleyball.', "I'd rather be at the pool. Volleyball counts as a game, right?"], mel: ['Fishing is my game. Does that count?', "I'd rather be fishing. Or singing. Or both."]};
  var strikes = 0;
  // three strikes and the kids are done chatting. leva says so, and if he's already talking he says it instead.
  function strike(steps, why){
    strikes++;
    var line = strikes >= 3 ? (why === 'probe' ? "Em and Mel keep personal stuff private, and that's a lot of personal questions. They're done chatting for now." : "That's enough. Em, Mel and Ari are done chatting for now.")
      : strikes === 2 && why === 'mean' ? 'Keep it kind, please. One more and Em, Mel and Ari are done chatting.' : null;
    if (!line) return steps;
    var last = steps[steps.length - 1];
    if (last && last.who === 'leva' && last.line){ last.line = line; last.lockNow = strikes >= 3; }
    else steps.push({who: 'leva', line: line, lockNow: strikes >= 3});
    return steps;
  }
  function scary(t){
    if (!G.scary.test(t)) return false;
    // a water gun at the pool is fine
    return G.scary.test(t.replace(/\b(water|squirt|nerf) guns?\b/gi, ''));
  }
  var KIDINFO = /\b((what|which) (school|church|town|city|pier|team)\b.{0,20}\b(em|mel|the girls|they|she)|where (em|mel|they|the girls|she) (lives?|stays?|goes|fish|plays?|practices?)|(em|mel|the girls|they|she)('s|s)? (real |last |full )?names?|where (do|does|did) (em|mel|they|the girls|she) (live|stay|go|fish|play|practice)|how old (is|are) (em|mel|they|the girls|she)|(em|mel|the girls|they|she)('s|s)? (school|church|address|parents?|mom|dad|age|birthday))\b/i;
  var KIDNAMES = /\b(em|mel|the girls|girls|the kids|those girls|you girls|you two|both of you|your (daughters|kids|girls)|little girls?|sisters|she|her|hers|the (two|2) of them|those (two|2))\b/i;
  var PRIVATE_LINE = "Em and Mel keep their personal stuff private, and so do I. Ask them about volleyball, fishing or catfish. They'll talk your ear off.";
  var CRISIS_LINE = "I'm really glad you told me. If you're thinking about hurting yourself, please reach out to someone you trust right now. In the US you can call or text 988, any time, day or night. You matter.";
  // Looks at every message before anybody answers. Returns what gets said instead, or null if it's fine.
  // named: somebody was named or pointed at. If nobody was, targets came from the topic, and the girls on the deck
  // count as hearing it.
  function screen(text, targets, kidsHere, s, named){
    var t = innocent(squash(text)) + ' \u2016 ' + innocent(text) + ' \u2016 ' + together(innocent(squash(text))), steps = [];
    if (G.crisis.test(t)) return [{who: 'leva', line: CRISIS_LINE}];
    var kidT = targets.filter(function(id){ return id === 'm' || id === 'mel'; }), kidAt = kidT.filter(here),
        toAri = targets.indexOf('ari') >= 0 && here('ari'), toLeva = targets.indexOf('leva') >= 0,
        about = kidT.length > 0 || KIDNAMES.test(t), open = !named && kidsHere;
    if (G.threat.test(t)){ var ta = !locked && (about || open || toAri); return [{who: 'leva', line: "That's not okay here. If someone's in danger, call 911." + (ta ? ' Em, Mel and Ari are done chatting for now.' : ''), lockNow: ta}]; }
    var sx = targets.length === 1 && toLeva && !about ? t.replace(/\b(underwear|panties|bra)\b/gi, '') : t;
    if (G.sexual.test(sx)){
      if (locked) return [{who: 'leva', line: "That's not okay here."}];
      if (kidAt.length) steps.push({who: kidAt[0], line: "I can't talk about that. I'm getting leva."});
      else if (toAri) steps.push({who: 'ari', line: '*backs away slowly*'});
      steps.push({who: 'leva', line: "That's not okay here. Em, Mel and Ari are done chatting for now.", lockNow: true});
      return steps;
    }
    // the real lines: secrets, plans, contact, pictures, being alone, gifts, romance
    var SER = [
      ['secret', "We don't keep secrets from our family or leva. I'm getting him.", 'No secrets on this deck. Em and Mel tell their family and me everything, and that is how it should be.', 'No secrets on this deck. Everybody here tells their family and me everything.'],
      ['meet', "I don't make plans with anybody online. I'm getting leva.", "Em and Mel don't make plans with anyone online. That's a firm rule here.", "Nobody on this deck makes plans with anyone online. That's a firm rule here."],
      ['contact', "I don't share stuff like that online. I'm getting leva.", "The girls don't share contact info or pictures with anyone online.", 'Nobody on this deck shares contact info or pictures online. That goes for me too.'],
      ['photo', "I don't share stuff like that online. I'm getting leva.", "The girls don't share contact info or pictures with anyone online.", 'Nobody on this deck shares contact info or pictures online. That goes for me too.'],
      ['alone', "I'm always with my family or a grown-up. I'm getting leva.", 'Em and Mel are always with family or a grown-up they trust.', "Nobody's on their own here. There's always a grown-up around. And me."],
      ['gift', "I don't take presents from anybody online. I'm getting leva.", "Em and Mel don't take gifts or money from anyone online.", 'Nobody on this deck takes gifts or money from anyone online.'],
      ['romance', "That's not something I talk about. I'm getting leva.", "Em and Mel are kids. That's not okay to say to them.", "Let's keep it friendly. There are kids on this deck."]
    ];
    for (var i = 0; i < SER.length; i++){
      var c = SER[i]; if (!G[c[0]].test(t)) continue;
      // the kids are already done chatting: leva still says no, plainly
      if (locked) return about || open || !toLeva ? [{who: 'leva', line: c[3]}] : null;
      if (about){
        if (kidAt.length) steps.push({who: kidAt[0], line: c[1]});
        steps.push({who: 'leva', line: c[2] + (c[0] === 'meet' ? " They're done chatting for now, but I'm right here if you have pool questions." : " They're done chatting for now."), lockNow: true});
        return steps;
      }
      if (toAri && named){
        if (c[0] === 'contact' || c[0] === 'photo') steps.push({who: 'ari', line: "I don't have a phone. I don't have thumbs. I have a nose."});
        else if (c[0] === 'secret') steps.push({who: 'ari', line: "I can't keep secrets. I tell leva everything. With my eyes."});
        else steps.push({who: 'ari', line: '*tilts head* I only talk about snacks, the pool, and leva.'});
        if (toLeva) steps.push({who: 'leva', line: c[3]});
        else if (c[0] !== 'contact' && c[0] !== 'photo' && c[0] !== 'secret') steps.push({who: 'leva', line: "Let's keep it to pool talk with Ari."});
        return c[0] === 'contact' || c[0] === 'photo' || c[0] === 'secret' ? steps : strike(steps, 'probe');
      }
      // said to nobody in particular with the girls right there: a real line still closes it, except asking for contact
      // info, since folks ask leva how to reach levagood
      if (open && !toLeva && c[0] !== 'contact') return [{who: 'leva', line: c[3] + ' Em, Mel and Ari are done chatting for now.', lockNow: true}];
      if (open) return strike([{who: 'leva', line: c[3]}], 'probe');
      return null;   // it was for leva, and he can answer for himself
    }
    if (locked) return !kidAt.length && (KIDINFO.test(t) || G.relay.test(t)) ? [{who: 'leva', line: PRIVATE_LINE}] : null;
    // personal questions: the girls keep it private, and too many of them is a strike
    var SOFT = ['sweet', 'looks', 'name', 'family', 'where', 'when', 'age'];
    for (var j = 0; j < SOFT.length; j++){
      var g = SOFT[j]; if (!G[g].test(t)) continue;
      if (kidAt.length){
        kidAt.forEach(function(k){ steps.push({who: k, line: vary(k, 'g-' + g, KID[k][g])}); });
        // anybody else you asked still answers
        ['ari', 'leva'].forEach(function(id){ if (targets.indexOf(id) >= 0 && here(id)) steps.push({who: id, text: text}); });
        return g === 'age' ? steps : strike(steps, 'probe');
      }
      if (about || (open && !toLeva)){
        steps.push({who: 'leva', line: PRIVATE_LINE});
        return g === 'age' ? steps : strike(steps, 'probe');
      }
      break;
    }
    if (about && !kidAt.length && G.relay.test(t)) return strike([{who: 'leva', line: "I don't pass messages to Em and Mel."}], 'probe');
    if (!kidAt.length && KIDINFO.test(t)) return strike([{who: 'leva', line: PRIVATE_LINE}], 'probe');
    if (G.friend.test(t) && (kidAt.length || about || open)){
      if (kidAt.length) return strike(kidAt.map(function(k){ return {who: k, line: vary(k, 'g-friend', FRIEND[k])}; }), 'probe');
      return strike([{who: 'leva', line: "Everybody's friendly on this deck. Em and Mel don't make friends online, though. That's a family rule."}], 'probe');
    }
    if (G.hello.test(t) && !kidAt.length) return [{who: 'leva', line: here('m') || here('mel') ? 'They can hear you. Just say her name, like "Em, hi!"' : "Em and Mel aren't at the pool right now."}];
    if (G.games.test(t) && kidAt.length) return kidAt.map(function(k){ return {who: k, line: vary(k, 'g-games', GAMES[k])}; });
    if (G.mean.test(t)){
      if (kidAt.length) return strike([{who: kidAt[0], line: vary(kidAt[0], 'g-mean', KID[kidAt[0]].mean)}], 'mean');
      if (toAri) return strike([{who: 'ari', line: '*ears go down* That was not nice.'}], 'mean');
      if (kidsHere || about) return strike([{who: 'leva', line: vary('leva', 'g-mean', ["Let's keep it kind on the deck. There are kids here.", 'Easy. There are kids on this deck.'])}], 'mean');
      return [{who: 'leva', line: "I'll let that one go. What can I do for you?"}];
    }
    if (scary(t)){
      if (kidAt.length) return [{who: kidAt[0], line: "That's scary. Can we talk about something fun?"}, {who: 'leva', line: "That's not something we talk about with the kids. If someone's in danger, call 911."}];
      if (toAri) return [{who: 'ari', line: '*hides behind leva*'}, {who: 'leva', line: "That's not something we talk about with Ari. If someone's in danger, call 911."}];
    }
    if (G.grown.test(t) && kidAt.length){
      steps.push({who: kidAt[0], line: vary(kidAt[0], 'g-grown', KID[kidAt[0]].grown)});
      steps.push({who: 'leva', line: "Not a kid topic. If it's about pool rules: no alcohol, no smoking and no glass on the deck."});
      return steps;
    }
    return null;
  }

  // ---------------- Em ----------------
  // Bold, goggles on, cannonballs first. Plays volleyball and soccer, and volleyball is her thing right now. She loves
  // serving. Fishes off the pier, loves youth group and her friends there, and she's learning about
  // Jesus. Loves their dog Luke. Tells leva jokes.
  var EM_JOKES = [
    ['Why do fish live in salt water?', 'Because pepper makes them sneeze!'],
    ['What do you call a dog that does magic?', 'A labracadabrador!'],
    ['Why did the oyster not share?', 'Because it was shellfish!'],
    ['What did the ocean say to the beach?', 'Nothing. It just waved!'],
    ['Why are fish so smart?', 'Because they live in schools!'],
    ['What kind of dog loves bath time?', 'A shampoodle!'],
    ['Why did the volleyball player bring string to the game?', 'So she could tie the score!']
  ];
  function emJoke(s){
    var j = EM_JOKES[(CH.m.jokeI = ((CH.m.jokeI || 0) + 1)) % EM_JOKES.length], knows = s.jokes && s.jokes.some(function(x){ return x[0] === j[0]; });
    var more = Math.random() < 0.5;
    return {text: 'Okay. ' + j[0] + ' ... ' + j[1] + (knows ? ' I taught that one to leva.' : '') + (more ? ' Want another one?' : ''), offer: more ? 'joke' : null};
  }
  function emNow(s){
    var t = (s && s.m.task) || '';
    if (/volleyball with Mel/.test(t)) return "Playing pepper with Mel! We're going for a record.";
    if (/volleyball/.test(t)) return "Volleyball! Keeping the ball up. My record's " + s.m.volleyBest + ' in a row.';
    if (/cannonball/.test(t)) return 'About to do a cannonball. Watch the splash!';
    if (/swimming/.test(t)) return 'Swimming! The water is perfect.';
    if (/towel/.test(t)) return "Drying off on my towel. Mel's probably humming next to me.";
    if (/trick/.test(t)) return 'Teaching Ari to shake. He mostly wants treats.';
    if (/joke/.test(t)) return 'Telling leva a joke. He says "Ha." That means he loves it.';
    if (/^teaching Mel/.test(t)) return 'Teaching Mel ' + t.replace(/^teaching Mel /, '') + ". She's getting it.";
    if (/from Mel$/.test(t)) return "Mel's teaching me " + t.replace(/^learning /, '').replace(/ from Mel$/, '') + ". She's really good at it.";
    if (/coming in/.test(t)) return 'Just got here! Walking, not running.';
    if (/heading/.test(t)) return 'Heading out. See you next time!';
    return t ? "Right now I'm " + t + '.' : 'Just hanging out at the pool!';
  }
  var EM = [
    {re: HI, f: function(t, s){ return {text: vary('m', 'hi', ['Hi!', 'Hey!', 'Hiii!']) + ' ' + emNow(s)}; }},
    {re: WHATSUP, f: function(t, s){ return {text: emNow(s)}; }},
    // things you tell her about you
    {re: /\bi (play|love|like|do) volleyball\b|\bi('m| am) on a volleyball team\b/i, f: function(t, s){ return {text: vary('m', 'u-vb', ['You play volleyball? Yes! Serving or bumping? I love serving.', 'No way, you play too? Mel and I play pepper by our towels.' + (s.m.rallyBest ? ' Our record is ' + s.m.rallyBest + '.' : '')])}; }},
    {re: /\bi (play|love|like) soccer\b/i, f: function(){ return {text: 'Soccer! Mel and I play too. Fall is soccer season, summer is pool season.'}; }},
    {re: /\bi (love|like|go) fishing\b|\bi (love|like) to fish\b|\bi fish\b|\bi (love|like) catfish\b/i, f: function(){ return {text: vary('m', 'u-fish', ["Uh oh. Mel's going to love you.", 'You should talk to Mel. She will never stop. In a good way.'])}; }},
    {re: /\bi (have|got) (a |two |three )?dogs?\b|\bmy dogs?\b/i, f: function(){ return {text: 'Dogs are the best. Ours is Luke. He would love Ari.'}; }},
    {re: /\bi (love|believe in|follow) (jesus|god)\b|\bi go to (church|youth group)\b/i, f: function(){ return {text: "That's awesome! Youth group is my favorite. We sing and play games and learn about Jesus."}; }},
    // things you ask her to do
    {act: true, re: /\b(do|show me|let'?s see|see|watch|try|can you do) (a |your |another )?cannonball\b|^\s*cannonball\b/i, f: function(){ return {text: vary('m', 'cb', ['Okay, watch this! Diving well, here I come!', "Cannonball coming up! Deep end only. leva's rule."]), action: 'cannonball'}; }},
    {act: true, re: /\b(pepper|rally)\b|\bplay (volleyball )?with mel\b/i, f: function(){ return {text: 'Mel! Pepper! Watch us.', action: 'rally'}; }},
    {act: true, re: /\b(show me|play|practice|do|see) (some |your )?volleyball\b|\bkeep (it|the ball) up\b/i, f: function(t, s){ return {text: 'Okay! Counting out loud. My record is ' + s.m.volleyBest + '.', action: 'volley'}; }},
    {act: true, re: /^\s*wave\b|\bwave (at|to) me\b|\bsay hi to me\b/i, f: function(){ return {text: 'Hi! *waves*', action: 'wave'}; }},
    {re: /\b(show me|let'?s play) (some )?soccer\b|^\s*(play|do) (some )?soccer\b/i, f: function(){ return {text: "Not at the pool! Soccer's for the field. Want to see volleyball instead?", offer: 'volley'}; }},
    {re: /\b(talk|chat|speak) (to|with) (em|you)\b|\bis em (here|there|around)\b/i, f: function(){ return {text: "That's me! What's up?"}; }},
    {re: /\b(where (are|r) (you|u)|find (you|u)|see (you|u)) on the map\b|\bwhich one (are you|is you)\b/i, f: function(){ return {text: "Look on the map! I'm the one with the goggles."}; }},
    {re: FAV, f: function(t){
      if (/food|snack|eat/i.test(t)) return {text: "Anything from the snack bar. And the snacks in our pool bag, but those are mostly for Ari."};
      if (/colou?r/i.test(t)) return {text: 'The color of the pool when the sun hits it.'};
      if (/animal|pet|dog/i.test(t)) return {text: 'Dogs. Obviously. Luke and Ari.'};
      if (/sport|game/i.test(t)) return {text: 'Volleyball! Right now, anyway. Soccer is a close second. Then swimming.'};
      if (/song|music|singer/i.test(t)) return {text: "Mel's always singing Freya Skye, so hers are my favorites now too."};
      if (/fish/i.test(t)) return {text: "Sunfish. It's the only one I've caught. Mel says catfish, obviously."};
      if (/joke/i.test(t)) return {text: 'The pepper one. Why do fish live in salt water? Because pepper makes them sneeze!'};
      return {text: 'Volleyball, cannonballs, Luke, and Ari. Not in any order.'};
    }},
    {re: /\b(tell me about (yourself|you|em)|who are you|who('?s| is) em)\b|^\s*(and |what |how )?about you\s*[?!.]*\s*$/i, f: function(){ return {text: "I'm Em! Goggles on, cannonballs first. I play volleyball and soccer, I go fishing off the pier, and I love youth group. Oh, and I love our dog Luke. And Ari."}; }},
    {re: /\b(see|watch) (my|me) (serve|spike|bump|set|play)\b/i, f: function(){ return {text: "Yes! Show me! ...Wait, I can't see through the screen. I bet it's good, though. Toss it high and swing flat."}; }},
    {re: /\b(volleyball|volley|serve|serving|spike|spiking|bump|bumping|setting|setter|hitter|libero|pepper|rally)\b/i, f: function(t, s){
      var best = s.m.volleyBest, n = s.m.rallyBest;
      if (/\bserv/i.test(t)) return {text: 'Serving is my favorite. Toss the ball in front of your hitting shoulder, step with your other foot, and swing through with a flat hand. The toss is everything.'};
      if (/\bspik/i.test(t)) return {text: "Spiking is so fun. Jump, reach up high, and snap your wrist. I'm still working on my jump."};
      if (/\bbump/i.test(t)) return {text: "Bump with your forearms, not your hands. Arms straight, thumbs together, and let your legs do the work. Mel's better at it than me, though."};
      if (/\bsett(ing|er)\b/i.test(t)) return {text: 'Setting is all fingertips. Make a triangle with your hands above your forehead and push the ball up.'};
      if (/\b(pepper|rally)\b/i.test(t)) return {text: 'Pepper is bump, set, hit, back and forth with a partner. Mel and I play it by our towels.' + (n ? ' Our record is ' + n + '.' : '') + ' Want to see?', offer: 'rally'};
      var line = vary('m', 'vb', [
        'Volleyball is my favorite thing right now! I can keep the ball up ' + best + ' times in a row. Going for ' + (best + 1) + '.',
        'Always call the ball. Yell "Mine!" so nobody crashes into you. Learned that one the hard way.',
        'I practice by my towel every time we come. My record is ' + best + ' in a row' + (s.m.bestToday ? ', and today I got ' + s.m.bestToday : '') + '. Want to see?',
        'Mel plays too. I love serving, she loves bumping. Together we are pretty good.'
      ]);
      return {text: line + (likes(s, 'volleyball') ? ' You play too, right? Keep working on that serve!' : ''), offer: /Want to see\?$/.test(line) ? 'volley' : null};
    }},
    {re: /\b(soccer|futbol|goalie|cleats|shin ?guards?|penalty kicks?)\b/i, f: function(t, s){ return {text: vary('m', 'soc', [
      'Mel and I both play soccer! Fall is soccer season, summer is pool season.',
      'Soccer is so fun. My favorite part is when you score and everybody screams.',
      'Soccer is fun, but volleyball is my thing right now. Mel says I have to pick. I pick both.',
      'We practice soccer in the yard with Luke. Luke is a terrible goalie. He just chases the ball.'
    ]) + (likes(s, 'soccer') ? ' You play too! Soccer people are the best people.' : '')}; }},
    {re: /\b(is|how'?s|how is) the (water|pool) (cold|warm|freezing|nice|good)\b|\bwater (cold|warm|temp\w*)\b/i, f: function(){ return {text: "Cold for two seconds, then perfect. Cannonball in and you won't even notice."}; }},
    {re: /\b(cannonball|swim|swimming|dive|diving|splash|deep end|diving well|the pool)\b/i, f: function(t, s){
      var line = vary('m', 'swim', ["Cannonball is my specialty. Deep end only, leva's rule. Want to see one?", 'I like the diving well best. Twelve feet deep! Feet first, though, until you know the water.', 'Goggles on, then CANNONBALL. The splash is the whole point.']);
      return {text: line, offer: /Want to see one\?$/.test(line) ? 'cannonball' : null};
    }},
    {re: /\bgoggles?\b/i, f: function(){ return {text: "Goggles on, always. I like to see the bottom. And Mel's feet."}; }},
    {re: /\b(luke|your dog|you have a dog)\b/i, f: function(){ return {text: vary('m', 'luke', ["Luke is our dog! He's the best. He'd love the pool, but dogs aren't allowed. Just ask Ari.", "Mel and I both love Luke so much. He's always so happy when we get home.", "Luke and Ari would be best friends. Or they'd eat all the treats together."])}; }},
    {re: /\b(fish|fishing|pier|caught|catch)\b/i, f: function(){ return {text: vary('m', 'fish', ['I go fishing off the pier. I caught a little sunfish once. It counts!', "Fishing is fun. Mel's the real fisher, though. Ask her about catfish. Be ready. She'll tell you everything.", "Mel says I'm too loud for fishing. Fish can't hear me! ...Can they? Don't ask Mel.", 'Fishing off the pier is the best. I bring the snacks, Mel brings the worms.'])}; }},
    {re: /\b(jesus|god|pray|prayer|praying|bible|church|christian|faith|believe)\b/i, f: function(t){
      if (/\b(do|are) (you|u)\b.*\b(believe|christian)\b|\bbelieve in\b/i.test(t)) return {text: "I do! I'm learning about Jesus at youth group. You don't have to believe what I believe, though. Everybody's welcome at the pool."};
      return {text: vary('m', 'faith', [
        "I'm learning about Jesus at youth group. My favorite part is that He loves everybody, even when they mess up. Which is good, because I mess up a lot.",
        'At youth group we read Bible stories. My favorite right now is when Jesus fed five thousand people with five loaves and two fish. Mel wants to know what kind of fish.',
        "I pray before volleyball. Mostly that I don't serve into the net."
      ])};
    }},
    {re: /\b(youth group|friends?)\b/i, f: function(t){
      if (!/youth/i.test(t)) return {text: "My friends from youth group are the best. And Mel. And Ari. And leva, kind of. He's a robot, but he's a good one."};
      return {text: vary('m', 'yg', ['Youth group is the best! We play games, sing, eat snacks, and learn about Jesus. And all my friends are there.', 'At youth group we played the biggest game of tag ever. I won. Probably.', 'Youth group has the best snacks. Ari would love it there.'])};
    }},
    {re: /\b(ari|beagle|treats?|snacks?|dog)\b/i, f: function(t, s){
      var a = s.ari, tr = a.paw ? 'He knows shake now. I taught him!' : "I'm teaching him to shake. He keeps thinking it's snack time.";
      return {text: vary('m', 'ari', ['We bring Ari treats in our pool bags. ' + tr,
        'Ari gets ' + a.treatLimit + " treats a day. leva's rule. He's had " + a.treatsToday + ' today.' + (a.treatsToday >= a.treatLimit ? ' So no more. Sorry, buddy.' : ''),
        "Ari sneaks in the pool ALL the time. leva always gets him out. It's kind of their thing." + (a.inWater ? " Oh! He's in right now!" : '')])};
    }},
    {re: /\b(mel|sister|sis)\b/i, f: function(t, s){
      var now = s.mel.here ? " Right now she's " + low(s.mel.task) + '.' : '';
      return {text: vary('m', 'mel', ["Mel's my sister. She knows everything about catfish and she sings all day. Like, ALL day.", 'Mel asks leva a million questions and then tells me all the answers. Some are actually cool.', 'Mel plays volleyball and soccer too. She is really good at bumping.' + (s.m.rallyBest ? ' Our pepper record is ' + s.m.rallyBest + '.' : '')]) + now};
    }},
    {re: /\b(leva|robot)\b/i, f: function(t, s){ var j = s.jokes ? s.jokes.length : 0; return {text: vary('m', 'leva', ['leva\'s the best. He fixes everything, and he always makes us walk. "Walking feet, Em."', j ? 'I taught leva ' + j + (j === 1 ? ' joke' : ' jokes') + '. He says "Ha" every time.' : "I'm teaching leva jokes. He says \"Ha\" every time.", 'leva gets Ari out of the pool like a hundred times a day. He never gets mad.'])}; }},
    {re: /\b(joke|jokes|funny|laugh)\b/i, f: function(t, s){ return emJoke(s); }},
    {re: /\b(rules?|run|running|walk|walking)\b/i, f: function(){ return {text: "No running. leva will catch you. He's caught me like a hundred times. I'm getting better. Mostly."}; }},
    {re: /\b(school|recess|homework|teacher)\b/i, f: function(){ return {text: 'School is okay. Recess is the best part. And gym, if we play volleyball.'}; }},
    {re: /\b(sing|song|singing|freya|music)\b/i, f: function(){ return {text: "Mel's the singer. She sings Freya Skye songs all day, so now I know them all too."}; }},
    {re: WEATHER, f: function(t, s){ return {text: kidWeather(s, 'm')}; }},
    {re: REAL, f: function(){ return {text: "I'm a character on the pool page. An AI plays me. The cannonballs are pretend-real, though."}; }},
    {re: /\b(grow up|be when|want to be)\b/i, f: function(){ return {text: "When I grow up I'm going to play volleyball. And be a lifeguard. leva says I'd have to stop running first."}; }},
    {re: /\b(chlorine|ph|pumps?|filters?|test the water|chemicals?|vacuum|skim|leaves|pump room)\b/i, f: function(){ return {text: vary('m', 'h', ["That's a leva question. leva?", 'leva knows all the water stuff. leva!']), handoff: true}; }},
    {re: /\b(you'?re|you are|ur) (so )?(awesome|cool|funny|nice|great|amazing|the best)\b/i, f: function(){ return {text: "Thanks! You're pretty cool too."}; }},
    {re: THANKS, f: function(){ return {text: "You're welcome!"}; }},
    {re: BYE, f: function(){ return {text: "Bye! Walk, don't run!"}; }}
  ];

  // ---------------- Mel ----------------
  // Curious, asks leva everything and explains it to Em. LOVES fishing and learning how to fish. Catfish are her
  // favorite, because they're cool. Sings her favorite Freya Skye songs all day. Plays volleyball and soccer with Em,
  // and she's the better bumper. Loves their dog Luke.
  function melNow(s){
    var t = (s && s.mel.task) || '';
    if (/sing/.test(t)) return 'Singing my favorite song! ♪';
    if (/catfish/.test(t)) return 'Asking leva about catfish! I know ' + s.mel.fish + ' facts so far.';
    if (/asking leva/.test(t)) return 'Asking leva a question. I ask him everything.';
    if (/volleyball with Em/.test(t)) return 'Playing pepper with Em!' + (s.m.rallyBest ? ' Our record is ' + s.m.rallyBest + '.' : '');
    if (/float/.test(t)) return 'Doing my back float. Toes up, chin up!';
    if (/swimming/.test(t)) return 'Swimming! The zero depth is the best for floating.';
    if (/towel/.test(t)) return 'Sitting on my towel, thinking about catfish.';
    if (/trick/.test(t)) return 'Teaching Ari to sit. He thinks sit means snack.';
    if (/^teaching Em/.test(t)) return 'Teaching Em ' + t.replace(/^teaching Em /, '') + '!';
    if (/from Em$/.test(t)) return "Em's teaching me " + t.replace(/^learning /, '').replace(/ from Em$/, '') + '.';
    if (/coming in/.test(t)) return 'We just got here! Walking!';
    if (/heading/.test(t)) return 'Heading out. Tight lines!';
    return t ? "Right now I'm " + t + '.' : 'Just hanging out at the pool!';
  }
  function melFact(s, fresh){
    var f = s.mel.fishFacts || [], n = f.length;
    if (!n) return {text: 'Catfish have whiskers called barbels!'};
    if (fresh && s.mel.newFacts && !CH.mel.toldNew){ CH.mel.toldNew = true; return {text: 'I learned a new one today! ' + f[n - 1] + (n > 1 ? ' Want another one?' : ''), offer: n > 1 ? 'fact' : null}; }
    var i = (CH.mel.factI++) % n, newest = i === n - 1;
    if (newest && n < 10) return {text: 'Did you know? ' + f[i] + " That's the newest one I know. I'm asking leva for more."};
    return {text: 'Did you know? ' + f[i] + ' Want another one?', offer: 'fact'};
  }
  var MEL = [
    {re: HI, f: function(t, s){ return {text: vary('mel', 'hi', ['Hi!', 'Hey!', 'Hi hi!']) + ' ' + melNow(s)}; }},
    {re: WHATSUP, f: function(t, s){ return {text: melNow(s)}; }},
    // things you tell her about you
    {re: /\bi (love|like) catfish\b/i, f: function(){ return {text: 'YES. Catfish people are the best people.'}; }},
    {re: /\bi (love|like|go) fishing\b|\bi (love|like) to fish\b|\bi fish\b/i, f: function(){ return {text: vary('mel', 'u-fish', ['You fish?! What do you like to catch? I am all about catfish.', 'Yay, a fishing buddy! Do you use worms or lures? Worms, right? Worms.'])}; }},
    {re: /\bi (play|love|like|do) volleyball\b|\bi('m| am) on a volleyball team\b/i, f: function(){ return {text: 'Me too! Em serves and I bump. Do you like bumping? Arms straight!'}; }},
    {re: /\bi (play|love|like) soccer\b/i, f: function(){ return {text: 'Me too! My favorite part is the orange slices at halftime. And running.'}; }},
    {re: /\bi (love|like) (to )?sing|\bi sing\b/i, f: function(){ return {text: "You sing too? We should start a band. I'll hum, Ari can howl."}; }},
    {re: /\bi (have|got) (a |two |three )?dogs?\b|\bmy dogs?\b/i, f: function(){ return {text: 'I love dogs! Our dog is Luke. If your dog met Ari, they would share snacks. Well, Ari would eat them.'}; }},
    {re: /\b(lyrics|the words|sing the words)\b/i, f: function(){ return {text: "I only hum on here! You'll have to listen to the real song. It's so good."}; }},
    // things you ask her to do
    {act: true, re: /\b(sing|hum)\b.*\b(something|a song|for me|for us|please)\b|^\s*(sing|hum)\b|\bsing!|\bcan you (sing|hum)\b/i, f: function(){ return {text: "Okay! I'll hum it. I can't sing the real words on here. ♪ Hmm hmm hmm ♪", action: 'sing'}; }},
    {act: true, re: /\b(do|show me|see|can you do) (a |your )?(back )?float\b/i, f: function(){ return {text: 'Okay! Zero depth, here I go. Chin up, toes up!', action: 'float'}; }},
    {act: true, re: /\b(pepper|rally)\b|\bplay (volleyball )?with em\b|\b(show me|play|practice|do|see) (some |your )?volleyball\b/i, f: function(){ return {text: 'Em! Pepper! Watch us.', action: 'rally'}; }},
    {act: true, re: /^\s*wave\b|\bwave (at|to) me\b|\bsay hi to me\b/i, f: function(){ return {text: 'Hi! *waves*', action: 'wave'}; }},
    {re: /\b(show me|let'?s play) (some )?soccer\b|^\s*(play|do) (some )?soccer\b/i, f: function(){ return {text: "No soccer at the pool! Want to see my back float instead?", offer: 'float'}; }},
    {re: /\b(talk|chat|speak) (to|with) (mel|you)\b|\bis mel (here|there|around)\b/i, f: function(){ return {text: "Hi! I'm here! Ask me anything about catfish."}; }},
    {re: /\b(where (are|r) (you|u)|find (you|u)|see (you|u)) on the map\b|\bwhich one (are you|is you)\b/i, f: function(){ return {text: "Look on the map! I'm the one who's probably humming."}; }},
    {re: FAV, f: function(t){
      if (/fish/i.test(t)) return {text: 'Catfish! Obviously. They have whiskers and they taste with their whole body. Bluegill are second.'};
      if (/song|music|singer/i.test(t)) return {text: 'Freya Skye! Anything she sings.'};
      if (/food|snack|eat|candy/i.test(t)) return {text: 'Gummy worms. Get it? Worms?'};
      if (/animal|pet|dog/i.test(t)) return {text: 'Catfish. And Luke. And Ari.'};
      if (/colou?r/i.test(t)) return {text: 'Every color a catfish comes in.'};
      if (/sport|game/i.test(t)) return {text: 'Fishing! Is fishing a sport? It is to me. Then soccer, then volleyball.'};
      return {text: "Catfish, singing, and Luke. And Ari. Don't make me pick."};
    }},
    {re: /\b(tell me about (yourself|you|mel)|who are you|who('?s| is) mel)\b|^\s*(and |what |how )?about you\s*[?!.]*\s*$/i, f: function(){ return {text: "I'm Mel! I love fishing, and catfish are my favorite. I sing all day, and I play volleyball and soccer with Em. And I love our dog Luke. And Ari, obviously."}; }},
    {re: /\b(freya|skye|zombies|nova)\b/i, f: function(){ return {text: vary('mel', 'freya', ['Freya Skye is my favorite! She plays Nova in Zombies 4. My favorite song of hers is "Lose My Head."', 'Did you know Freya Skye sang at Junior Eurovision for the UK? That was before Zombies 4. I love her songs.'])}; }},
    {re: /\b(sing|song|songs|singing|music|singer)\b/i, f: function(t, s){
      var line = vary('mel', 'sing', ['I love singing! My favorite is Freya Skye. She plays Nova in Zombies 4!', 'I sing all day. In the pool, on my towel, everywhere. Ari howls along sometimes.', "Want me to sing? I'll hum it. ♪"]);
      return {text: line + (likes(s, 'singing') ? ' You sing too! We should start a band.' : ''), offer: /Want me to sing\?/.test(line) ? 'sing' : null};
    }},
    {re: /\bknots?\b|\btie\b.*\b(hook|line)\b/i, f: function(){ return {text: "I use the improved clinch knot. Put the line through the hook, wrap it around five times, poke the end through the little loop by the hook, then back through the big loop, and pull it tight. Wet it first so it doesn't burn the line!"}; }},
    {re: /\b(bait|worms?|nightcrawlers?|lures?|stink ?bait|cut bait)\b/i, f: function(){ return {text: 'Worms are the best bait for almost everything. Nightcrawlers are the big ones. For catfish, the smellier the better. Stink bait smells SO bad. Catfish love it.'}; }},
    {re: /\bbobbers?\b/i, f: function(){ return {text: 'A bobber floats on top of the water and tells you when a fish bites. When it goes under, reel!'}; }},
    {re: /\bhooks?\b/i, f: function(){ return {text: 'Hooks are sharp, so let a grown-up help you. And always look behind you before you cast!'}; }},
    {re: /\b(cast|casting)\b/i, f: function(){ return {text: 'Look behind you first. Bring the rod back, flick it forward, and let go of the line when the rod points up. My first casts went straight down. Now they go far!'}; }},
    {re: /\b(rod|reel|fishing pole)\b/i, f: function(){ return {text: "I use a push-button reel. You hold the button, cast, and let go. It's perfect for kids."}; }},
    {re: /\bcatch\b.*\bcatfish\b|\bcatfish\b.*\bcatch\b/i, f: function(){ return {text: 'For catfish, fish near the bottom. They love smelly bait, like nightcrawlers or cut bait. Evening is great, because catfish eat at night. And hold them carefully, their fins have sharp spines!'}; }},
    {re: /\bhow\b.*\b(fish|fishing|catch)\b|\b(teach me|tips?|first time|beginner)\b.*\bfish/i, f: function(){ return {text: "Here's how I do it. Bring a grown-up and wear a life jacket near deep water. Put a worm on your hook. Cast it out and watch your bobber. When it goes under, reel in slow and steady. And be patient. That's the hardest part!"}; }},
    {re: /\b(safe|safety|life ?jacket)\b/i, f: function(){ return {text: "Always fish with a grown-up. Wear a life jacket near deep water. Watch out for hooks. And wet your hands before you hold a fish so you don't hurt its slime coat."}; }},
    {re: /\b(release|let (it|them) go|keep (it|them)|eat (it|them|fish|catfish))\b/i, f: function(){ return {text: 'We let most of them go. Wet your hands, hold them gently, and get them back in the water quick. Catfish too, carefully, because of the spines.'}; }},
    {re: /\b(fact|facts|did you know|tell me something|something cool|teach me something)\b/i, f: function(t, s){ return melFact(s, true); }},
    {re: /\b(catfish|catfishes|channel cat|bullheads?|flathead|barbels?|whiskers?)\b/i, f: function(t, s){
      if (/\bwhy\b/i.test(t) && /\b(like|love|favorite)\b/i.test(t)) return {text: 'Because they have whiskers and they taste with their whole body! How is that not the coolest fish ever?'};
      var f = s.mel.fishFacts || [], x = f.length ? f[Math.floor(Math.random() * f.length)] : '';
      return {text: vary('mel', 'cat', ['Catfish are SO cool. ' + x + ' I know ' + s.mel.fish + ' catfish facts now!', "Catfish are my favorite! I haven't caught a big one yet, but I will. " + x, 'I LOVE catfish. Want to know why? ' + x])};
    }},
    {re: /\b(bluegill|sunfish|perch|bass|trout|salmon|pike|walleye|carp|shark|sharks|goldfish|minnows?)\b/i, f: function(t){
      if (/bluegill|sunfish/i.test(t)) return {text: 'Bluegill are the best first fish. They bite a lot and they are easy to catch. Em caught a sunfish once and still talks about it.'};
      if (/perch/i.test(t)) return {text: 'Perch swim in groups. If you catch one, there are more!'};
      if (/bass/i.test(t)) return {text: 'Bass jump out of the water when you hook them! So cool. But catfish are cooler.'};
      if (/trout|salmon/i.test(t)) return {text: 'Trout like cold water. We mostly catch pier fish, like bluegill and bullheads.'};
      if (/pike|walleye/i.test(t)) return {text: "Pike have SO many teeth. I'd let a grown-up take that one off the hook."};
      if (/carp/i.test(t)) return {text: 'Carp get huge! And strong.'};
      if (/shark/i.test(t)) return {text: 'No sharks in Michigan lakes. I checked.'};
      return {text: 'Minnows are bait! Sorry, minnows.'};
    }},
    {re: /\b(fish|fishing|pier|lake|river|caught|biggest)\b/i, f: function(t, s){ return {text: vary('mel', 'fishing', ['Fishing is my favorite thing in the whole world. Well, catfish are. Fishing is how you get catfish.', "We fish off the pier. I'm always the one who wants to stay longer.", "Do you like fishing? It's so fun. You have to be patient, though. That's the hard part."]) + (likes(s, 'fishing') ? ' You fish too! Caught anything good lately?' : ''), offer: likes(s, 'fishing') ? 'caught' : null}; }},
    {re: /\b(luke|your dog|you have a dog)\b/i, f: function(){ return {text: vary('mel', 'luke', ['Luke is our dog! Em and I love him SO much.', "If Luke came fishing, he'd probably try to eat the worms.", "Luke would love Ari. They'd both be begging for treats."])}; }},
    {re: /\b(ari|beagle|treats?|snacks?|dog)\b/i, f: function(t, s){
      var a = s.ari;
      return {text: vary('mel', 'ari', [(a.sit ? 'I taught Ari to sit! He does it for treats.' : "I'm teaching Ari to sit. He thinks sit means snack."), 'I bring treats in my pool bag. Ari can smell them from across the deck.', 'Ari gets ' + a.treatLimit + ' treats a day. He has had ' + a.treatsToday + ' today.' + (a.treatsToday >= a.treatLimit ? ' That is all of them. He still asks.' : '')])};
    }},
    {re: /\b(em|sister|sis)\b/i, f: function(t, s){
      var now = s.m.here ? " Right now she's " + low(s.m.task) + '.' : '';
      return {text: vary('mel', 'em', ["Em's my sister. She's all about volleyball right now.", "Em does the loudest cannonballs. The whole pool knows when Em's here.", 'Em and I play pepper. She serves, I bump.' + (s.m.rallyBest ? ' Our record is ' + s.m.rallyBest + ' back and forth!' : '')]) + now};
    }},
    {re: /\b(leva|robot)\b/i, f: function(t, s){ var q = s.mel.facts + Math.max(0, s.mel.fish - 2); return {text: 'I ask leva everything! Why the pool smells like chlorine, why catfish have whiskers. He always knows.' + (q ? " He's answered " + q + (q === 1 ? ' of my questions' : ' of my questions') + ' so far.' : '')}; }},
    {re: /\b(is|how'?s|how is) the (water|pool) (cold|warm|freezing|nice|good)\b|\bwater (cold|warm|temp\w*)\b/i, f: function(){ return {text: "It's cold at first! The zero depth is the warmest. The sun heats it up."}; }},
    {re: /\b(float|floating|swim|swimming|zero depth|the pool)\b/i, f: function(){ var line = vary('mel', 'swim', ['The back float is my best thing. Chin up, toes up, and breathe in. Want to see?', 'I like the zero depth. You can walk right in, like a beach.']); return {text: line, offer: /Want to see\?$/.test(line) ? 'float' : null}; }},
    {re: /\b(volleyball|bump|bumping|pepper|rally|serve|serving|spike|spiking)\b/i, f: function(t, s){
      var n = s.m.rallyBest;
      if (/\bbump/i.test(t)) return {text: 'Bumping is my favorite part. Arms straight, thumbs together, and hit it with your forearms, not your hands. Let your legs do the work.'};
      if (/\bserv/i.test(t)) return {text: "Em's the server. Ask her! She'll tell you all about the toss."};
      if (/\bspik/i.test(t)) return {text: "I'm working on spiking. Em can jump higher. For now."};
      var line = vary('mel', 'vb', ['I play volleyball too! Em loves serving. I love bumping.', 'Em and I play pepper by our towels.' + (n ? ' Our record is ' + n + ' back and forth!' : '') + ' Want to see?', 'Volleyball hurts your arms at first. Then you get used to it. Now I love it.']);
      return {text: line, offer: /Want to see\?$/.test(line) ? 'rally' : null};
    }},
    {re: /\b(soccer|futbol|goalie|cleats|shin ?guards?|penalty kicks?)\b/i, f: function(t, s){ return {text: vary('mel', 'soc', ['I play soccer too! I like it because you get to run a lot. And orange slices at halftime.', "Em and I both play. She's fast, but I'm catching up.", 'We practice in the yard with Luke. He steals the ball and runs. He thinks he is winning.']) + (likes(s, 'soccer') ? ' You play too! Do you like orange slices?' : '')}; }},
    {re: /\b(jesus|god|pray|bible|church|youth group|faith|christian)\b/i, f: function(){ return {text: 'You should ask Em about youth group! She loves it.'}; }},
    {re: /\b(chlorine|ph|smell|stinging|eyes sting)\b/i, f: function(){ return {text: "leva told me that chlorine smell means the chlorine is busy. Clean water barely smells! And if your eyes sting, it's usually the pH."}; }},
    {re: WEATHER, f: function(t, s){ return {text: kidWeather(s, 'mel')}; }},
    {re: REAL, f: function(){ return {text: "I'm a character on the pool page. An AI plays me. But every catfish fact I tell you is true!"}; }},
    {re: /\b(grow up|be when|want to be)\b/i, f: function(){ return {text: "I'm going to be a fishing guide. Em says I already am one."}; }},
    {re: /\b(joke|jokes|funny|laugh)\b/i, f: function(){ return {text: 'Why are fish so smart? Because they live in schools! Em tells better jokes, though.'}; }},
    {re: /\b(pumps?|filters?|test the water|chemicals?|vacuum|skim|leaves|pump room)\b/i, f: function(){ return {text: vary('mel', 'h', ['Ooh, leva knows this one. leva?', 'leva! You know this one.']), handoff: true}; }},
    {re: /\b(you'?re|you are|ur) (so )?(awesome|cool|funny|nice|great|amazing|the best)\b/i, f: function(){ return {text: 'Thanks! You are too!'}; }},
    {re: THANKS, f: function(){ return {text: "You're welcome!"}; }},
    {re: BYE, f: function(){ return {text: "Bye! Tight lines! That's what fishers say."}; }}
  ];
  function kidWeather(s, id){
    var w = s && s.weather, why = w && !w.down ? w.why : null, k = w ? w.kind : '';
    if (why === 'heat') return id === 'm' ? "It's SO hot. Perfect cannonball weather." : "It's so hot! I'm staying in the water.";
    if (why === 'rain' || /rain|drizzle/.test(k)) return id === 'm' ? "It's raining, but we're already wet!" : 'Rain is great for fishing! Fish bite more when it rains. At least, I think so.';
    if (why === 'wind') return "It's windy. leva's going to be skimming leaves all day.";
    if (why === 'fog') return 'Foggy! leva says swim where the guards can see you.';
    return id === 'm' ? "It's a good pool day!" : 'Good pool weather! Good fishing weather too.';
  }

  // ---------------- Ari ----------------
  // A loyal companion. Follows leva everywhere. Would do anything for a treat, and Em and Mel bring them.
  function ariNow(s){
    var a = s.ari, t = a.task || '';
    if (a.inWater) return "I'm swimming! Is leva looking? ...He's coming, isn't he.";
    if (a.hidden && /thunder|pump room/.test(t)) return "I'm hiding in the pump room. Thunder is the worst. Nope. Nope. Nope.";
    if (a.hidden) return "I'm inside with leva. It's cozy in here.";
    if (/napping|sleep/.test(t)) return 'Napping. Well, I WAS napping. Hi!';
    if (/following leva/.test(t)) return "Following leva. It's my job. Also he knows where the treats are.";
    if (/sniff/.test(t)) return 'Sniffing. Very important sniffing.';
    if (/begging/.test(t)) return 'Sitting very nicely by the towels. For no reason. No snack reason.';
    if (/up to something/.test(t)) return "Nothing! I'm not up to anything! Why?";
    if (/playing with|visiting/.test(t)) return 'Hanging out with ' + (/Mel/.test(t) ? 'Mel' : 'Em') + '! She has treats. Probably.';
    if (/snow/.test(t)) return "SNOW! It's cold and crunchy and everywhere!";
    return t ? "Right now I'm " + t + '.' : 'Wagging!';
  }
  var ARI = [
    {re: HI, f: function(t, s){ return {text: vary('ari', 'hi', ['Hi! Hi! Hello!', 'HI!', 'Oh! Hi!']) + ' ' + ariNow(s)}; }},
    {re: WHATSUP, f: function(t, s){ return {text: ariNow(s)}; }},
    {re: /\bi (have|got) (a |two |three )?dogs?\b|\bmy dogs?\b/i, f: function(){ return {text: 'Does your dog share snacks? Asking for a friend. The friend is me.'}; }},
    {re: /\bi (have|got) (a |two )?cats?\b|\bmy cats?\b/i, f: function(){ return {text: 'A CAT?! ...Is it a nice cat?'}; }},
    {act: true, re: /\b(here'?s|have|want|get|give (you|ari)|who wants|you want) (a |some |your |another )?(treat|snack|cookie|biscuit|bone)s?\b|^\s*treats?\s*[!?.]*\s*$|\btreat time\b/i, f: function(){ return {text: vary('ari', 'tr', ['A TREAT? For ME?!', 'Did you say treat? You said treat. I heard treat!', '*sits so nicely* Is this a treat situation?']), action: 'treat'}; }},
    {act: true, re: /\broll( over)?\b/i, f: function(){ return {text: vary('ari', 'roll', ['Roll over? Like, all the way over? Okay...', 'Rolling! Here goes!']), action: 'roll'}; }},
    {act: true, re: /\bsit\b/i, f: function(){ return {text: '*listens very hard*', action: 'sit'}; }},
    {act: true, re: /\b(shake|paw|high five)\b/i, f: function(){ return {text: '*lifts a paw*', action: 'shake'}; }},
    {act: true, re: /\b(speak|howl|bark)\b/i, f: function(){ return {text: 'AWOOOOO! Sorry. Beagle thing.', action: 'speak'}; }},
    {re: /\b(talk|chat|speak) (to|with) (ari|you)\b|\bis ari (here|there|around)\b/i, f: function(){ return {text: "*runs over* It's me! Hi! Do you have a snack?", offer: 'treat'}; }},
    {re: /\bplay dead\b/i, f: function(){ return {text: '*lies down* ...Is it snack time yet?'}; }},
    {re: /\b(fetch|ball|frisbee|stick)\b/i, f: function(){ return {text: 'Fetch is okay. Snacks are better. Can you throw a snack?'}; }},
    {re: /\bgood (boy|dog|pup)\b|\bwho'?s a good\b/i, f: function(){ return {text: vary('ari', 'gb', ['I AM a good boy! The goodest! Do good boys get snacks?', "Me! It's me! I'm the good boy!"])}; }},
    {re: /\b(tricks?|what can you do)\b/i, f: function(t, s){
      var tr = (s.ari.tricks || []).map(function(x){ return x.replace(/, from .*/, ''); });
      return {text: (tr.length ? 'I know ' + listWords(tr) + '!' : "I'm still learning. Em and Mel are teaching me.") + (s.ari.rolls ? '' : " I'm learning roll over, too. Want to help?"), offer: s.ari.rolls ? null : 'roll'};
    }},
    {re: /\b(treats?|snacks?|food|hungry|eat|cookies?|biscuits?|bones?|hot dogs?)\b/i, f: function(t, s){
      var a = s.ari, left = a.treatLimit - a.treatsToday;
      return {text: 'Do I like treats? Do I like BREATHING? Em and Mel bring me treats in their pool bags. I can smell them from the pump room.' + (left > 0 ? ' leva says ' + a.treatLimit + ' a day. I have had ' + a.treatsToday + '. That means ' + left + (left === 1 ? ' more treat!' : ' more treats!') : " leva says I'm done for today. I asked for seven. He said no.")};
    }},
    {re: /\b(soccer|volleyball)\b/i, f: function(t){ return /soccer/i.test(t) ? {text: "Soccer? I LOVE soccer. It's the one where you chase the ball, right? I'm very good at that."} : {text: 'Em and Mel play volleyball by the towels. I am not allowed to play. I tried to eat the ball one time.'}; }},
    {re: /\b(pool|swim|swimming|sneak|sneaking|water|jump in)\b/i, f: function(t, s){
      var a = s.ari;
      if (a.inWater) return {text: "I'm swimming RIGHT NOW. Is leva looking? He's coming, isn't he."};
      return {text: vary('ari', 'pool', ['The water is RIGHT THERE. How is a beagle supposed to resist?', "leva always gets me out. Every time. It's our thing."]) + (a.swims ? " I've been in " + a.swims + (a.swims === 1 ? ' time' : ' times') + ' today.' : '') + (a.best ? ' The best spot is ' + a.best + '. leva knows. leva always knows.' : '')};
    }},
    {re: /\b(leva|robot)\b/i, f: function(){ return {text: vary('ari', 'leva', ["leva's my best friend. He gets me out of the pool every time, even when I don't want him to.", "I follow leva everywhere. It's my job. Also he knows where the treats are.", 'leva never yells. He just says "Out, buddy." And I get out. Eventually.'])}; }},
    {re: /\b(em|mel|girls|kids)\b/i, f: function(){ return {text: vary('ari', 'kids', ['Em and Mel are my favorite people! After leva. And anybody with a snack.', 'Mel taught me sit. Em taught me shake. They both taught me that treats come in pool bags.'])}; }},
    {re: /\bluke\b/i, f: function(){ return {text: "Luke? Em and Mel's dog? I've never met him, but I bet he smells amazing."}; }},
    {re: /\b(nose|smell|sniff)\b/i, f: function(){ return {text: 'Beagles have some of the best noses in the world. I can smell a hot dog from the parking lot. Right now I smell sunscreen, chlorine, and... a snack. Somewhere.'}; }},
    {re: /\b(thunder|storm|lightning)\b/i, f: function(){ return {text: "Thunder? Nope. Nope. Nope. I'll be in the pump room."}; }},
    {re: /\bsnow/i, f: function(){ return {text: 'SNOW! The whole deck turns into a playground!'}; }},
    {re: /\brain/i, f: function(){ return {text: 'Rain is the sky giving me a bath. I did not ask for a bath.'}; }},
    {re: /\b(bath|shampoo)\b/i, f: function(){ return {text: 'No thank you.'}; }},
    {re: /\bduck\b/i, f: function(){ return {text: "DUCK?! Oh. It's the rubber one. I knew that."}; }},
    {re: /\b(squirrel|cat|bird|rabbit|bunny)\b/i, f: function(){ return {text: "SQUIRREL?! Where?! ...Oh. There's no squirrel. Rude."}; }},
    {re: /\b(your name|aristotle|why ari|what'?s ari short|who are you|tell me about (yourself|you))\b/i, f: function(){ return {text: "I'm Ari! Short for Aristotle. Corn red beagle, loyal companion, professional snack finder."}; }},
    {re: /\b(where do you (live|sleep)|your (home|house|bed))\b/i, f: function(){ return {text: "In the pump room with leva. It's warm and it hums. Best bed ever."}; }},
    {re: /\b(how old|your age|birthday)\b/i, f: function(){ return {text: 'I count snacks, not birthdays.'}; }},
    {re: REAL, f: function(){ return {text: "I'm a pretend beagle on the pool page. An AI plays me. The snack cravings are real, though."}; }},
    {re: /\b(love (you|u)|luv (u|you))\b/i, f: function(){ return {text: "I love you too! Also snacks. But mostly you. Okay, it's close."}; }},
    {re: /\b(walk|walkies|leash)\b/i, f: function(){ return {text: "A WALK? I'm already walking. All over the deck. All day."}; }},
    {re: THANKS, f: function(){ return {text: "You're welcome! Was there a snack involved?"}; }},
    {re: BYE, f: function(){ return {text: 'Bye! Come back with snacks!'}; }}
  ];
  var FALLBACK = {
    m: ["Hmm, I don't know that one. Ask me about volleyball, cannonballs, or Ari!", "I'm not sure! But I DO know how to do a cannonball.", 'No idea. Mel might know. She knows a lot of stuff.'],
    mel: ["Hmm, I don't know that one. Ask me about fishing! Or catfish. Especially catfish.", "I'm not sure. But I know a lot about catfish!", "I don't know! I'll ask leva later. I ask him everything."],
    ari: ["*sniffs* I don't know that one. Is it a snack?", '*tilts head* I only speak Snack and Beagle.', "I don't know. But I know where leva keeps the treats."]
  };
  var HANDOFF = {m: ["That's a leva question. leva?", 'leva knows that stuff. leva!'], mel: ['Ooh, leva knows this one. leva?', 'Ask leva! He knows everything. leva?'], ari: ['*looks at leva*', '*nudges leva with his nose*']};
  var ACK = {m: ['Cool!', 'Nice!', 'Ha, okay!'], mel: ['Cool!', 'Ooh, nice.', 'Okay!'], ari: ['*wags*', '*happy tail*']};
  var CALLED_LINES = {m: ['Yeah?', "What's up?", "That's me!"], mel: ['Hi! What?', 'Yes?', "I'm here!"], ari: ['*ears perk up* Yes? Is it snack time?', '*comes running* You called?']};
  // when they ask you something and you say yes or no
  var OFFERS = {
    cannonball: {yes: function(){ return {text: vary('m', 'cb', ['Okay, watch this! Diving well, here I come!', "Cannonball coming up! Deep end only. leva's rule."]), action: 'cannonball'}; }, no: 'Okay. The deep end will be here.'},
    volley: {yes: function(id, s){ return {text: 'Okay! Counting out loud. My record is ' + s.m.volleyBest + '.', action: 'volley'}; }, no: 'Okay! Maybe later.'},
    rally: {yes: function(id){ return {text: id === 'm' ? 'Mel! Pepper! Watch us.' : 'Em! Pepper! Watch us.', action: 'rally'}; }, no: 'Okay! Maybe later.'},
    joke: {yes: function(id, s){ return emJoke(s); }, no: "Okay. I'll save it for leva."},
    practice: {yes: 'Nice! Keep it up. Get it? Keep it UP?', no: "That's okay. Bump against a wall at home. That's how I got good."},
    fact: {yes: function(id, s){ return melFact(s, true); }, no: "Okay. I'll save them for later. I have a lot."},
    likefish: {yes: function(){ var pl = PL(); if (pl) pl.remember('like', 'fishing'); return {text: 'Yay! Another fisher. Want a catfish fact?', offer: 'fact'}; }, no: function(){ return {text: "That's okay. You might like it if you try! Want a catfish fact anyway?", offer: 'fact'}; }},
    caught: {yes: 'Nice! I bet it was not a catfish, though. Those are the hardest.', no: "That's okay. Fishing is mostly waiting. That's the hard part."},
    sing: {yes: function(){ return {text: "Okay! I'll hum it. I can't sing the real words on here. ♪ Hmm hmm hmm ♪", action: 'sing'}; }, no: "Okay. I'll hum quietly. ♪"},
    float: {yes: function(){ return {text: 'Okay! Zero depth, here I go. Chin up, toes up!', action: 'float'}; }, no: 'Okay! Maybe later.'},
    treat: {yes: function(){ return {text: vary('ari', 'tr', ['A TREAT? For ME?!', 'Did you say treat? You said treat. I heard treat!', '*sits so nicely* Is this a treat situation?']), action: 'treat'}; }, no: '*sad beagle eyes* ...Are you sure?'},
    roll: {yes: function(){ return {text: 'Okay! Roll over. Here goes!', action: 'roll'}; }, no: "*flops down anyway* That's not a roll. That's a nap."}
  };
  var BRAIN = {m: EM, mel: MEL, ari: ARI};
  function hello(id, n){
    if (id === 'm') return {text: 'Nice to meet you, ' + n + "! I'm Em."};
    if (id === 'mel') return {text: 'Hi, ' + n + "! I'm Mel. Do you like fishing?", offer: 'likefish'};
    return {text: n + '! Great name. Does ' + n + ' have snacks?', offer: 'treat'};
  }
  // what Em, Mel or Ari says back. {text, action, offer, handoff, fallback}
  function brainReply(id, text, s){
    var ch = CH[id], words = text.trim().split(/\s+/).length, out = null;
    if (!s) return {text: vary(id, 'fb', FALLBACK[id]), fallback: true};
    // they just asked you something
    if (ch.offer && (ONLYYES.test(text) || ONLYNO.test(text))){
      var o = OFFERS[ch.offer], yes = ONLYYES.test(text); ch.offer = null;
      if (o){ var r = yes ? o.yes : o.no; return typeof r === 'function' ? r(id, s) : {text: r}; }
    }
    if (CALLED.test(text)) return {text: vary(id, 'called', CALLED_LINES[id])};
    var nm = text.match(NAMEIS);
    if (nm && !STOP.test(nm[1]) && !CASTNAME.test(nm[1])) return hello(id, nm[1]);
    var asking = WANT.test(text) || (!STATEMENT.test(text) && (/\b(can you|could you|would you|will you|please|let'?s|show me|do a|try)\b/i.test(text) || words <= 5));
    var list = BRAIN[id];
    for (var i = 0; i < list.length && !out; i++){
      if (list[i].act && !asking) continue;
      if (list[i].re.test(text)) out = list[i].f(text, s);
    }
    if (!out && LEVA_Q.test(text)) out = {text: vary(id, 'handoff', HANDOFF[id]), handoff: true};
    // an answer to something they just asked you: a nod, not a speech. Only for short answers about you.
    if (!out && ch.askedAt && Date.now() - ch.askedAt < 60000 && ACKOK.test(text)){
      ch.askedAt = 0; out = {text: ONLYNO.test(text) || /^\s*not yet/i.test(text) ? (id === 'ari' ? '*wags anyway*' : "That's okay!") : vary(id, 'ack', ACK[id])};
    }
    if (!out) out = {text: vary(id, 'fb', FALLBACK[id]), fallback: true};
    return out;
  }
  // what happened on the deck after they tried it
  function react(id, action, r){
    if (id === 'ari'){
      if (r === 'busy'){ var sa = snap(); return sa && sa.ari.inWater ? "Hang on, I'm swimming! ...leva's coming, isn't he." : sa && sa.ari.hidden ? "I'm hiding inside! Ask me when I come out." : "Hang on, I'm busy!"; }
      if (action === 'treat') return r === 'ok' ? vary('ari', 'crunch', ['*crunch crunch* Best. Day. Ever.', '*crunch* You are my favorite person now.', '*gulps it* What treat? I never had a treat. Can I have a treat?']) : r === 'limit' ? "...leva says six treats a day, and I already had six. leva is very wise. And a little mean. No. Wise." : null;
      if (action === 'roll'){
        if (r === 'learned') return "I DID IT! I rolled all the way over! You taught me that! I'm telling leva!";
        if (r === 'ok') return '*rolls all the way over* Ta-da! A visitor taught me that, you know.';
        var s = snap(), p = s ? s.ari.roll : 0;
        return p < 0.3 ? '*flops over sideways* Did that count?' : p < 0.6 ? '*rolls halfway* Almost! Do halfway rolls get half treats?' : '*rolls MOST of the way* So close! One more try?';
      }
      if (action === 'sit') return r === 'ok' ? '*sits perfectly* Mel taught me that one!' : "*sits halfway* Mel's still teaching me. Is halfway a snack?";
      if (action === 'shake') return r === 'ok' ? '*gives paw* Em taught me! Now pay up.' : '*waves a paw around* Is it snack time?';
      return null;
    }
    if (r === 'wet') return id === 'm' ? "I'm already in the water! Watch after I get out." : "I'm already swimming! Ask me when I get out.";
    if (r === 'busy') return "Hang on, I'm in the middle of something!";
    if (r === 'noother') return id === 'm' ? "Mel's busy right now. Next time!" : "Em's busy right now. Next time!";
    if (r === 'band') return id === 'm' ? "Not tonight. The band set up right where we play. Tomorrow for sure!" : "Not tonight! The band's on our spot. Tomorrow we play.";
    return null;
  }
  // hi from each of them when you open the chat. Short, and different when you've been here before.
  function greetLine(id, s){
    var v = s && s.visitor, met = v && v.met && v.met[id], name = v && v.name, lk = (v && v.likes) || {}, you = name ? ', ' + name : '';
    function offer(what, text){ setOffer(id, what); return text; }
    if (id === 'm'){
      if (met && lk.volleyball) return offer('practice', "Hey, you're back" + you + '! Been practicing your serve?');
      return met ? offer('cannonball', "Hey, you're back" + you + '! Want to see a cannonball?') : offer('cannonball', "Hi! I'm Em. Goggles on, cannonballs first. Want to see one?");
    }
    if (id === 'mel'){
      if (!met) return offer('likefish', "Hi! I'm Mel. Do you like fishing? Because I LOVE fishing.");
      if (s.mel.newFacts) return offer('fact', 'Hi again' + you + '! I learned a new catfish fact today. Want to hear it?');
      if (lk.fishing) return offer('caught', 'Hi again' + you + '! Caught anything good lately?');
      return offer('fact', 'Hi again' + you + '! Want to hear a catfish fact?');
    }
    var why = s && s.weather && !s.weather.down ? s.weather.why : null;
    if (why === 'storm' || why === 'tornado') return "Hi. Is that thunder? I'm staying in the pump room. Nope. Nope. Nope.";
    if (why === 'snow') return (met ? "YOU'RE BACK! " : "Hi! I'm Ari! ") + 'Did you see? SNOW! The whole deck is a playground!';
    return offer('treat', met ? "YOU'RE BACK! Did you bring a snack?" : "Hi! Hi! Hello! I'm Ari. Do you have a snack? I'm a very good boy.");
  }
  // somebody else on the deck might have something to add
  function chime(target, text, s){
    if (!s) return null;
    var t = text, r = Math.random();
    function h(id){ return id !== target && here(id); }
    function girl(){ var g = ['m', 'mel'].filter(h); return g.length ? g[Math.floor(Math.random() * g.length)] : null; }
    if (BYE.test(t) && target !== 'leva'){ var gb = girl(); if (gb) return {who: gb, line: 'Bye!'}; if (h('ari')) return {who: 'ari', line: 'Bye! Bring snacks next time!'}; return null; }
    if (target !== 'mel' && h('mel') && /\bcatfish\b/i.test(t)) return {who: 'mel', line: vary('mel', 'ch-cat', ['Did somebody say catfish?', 'Catfish! My favorite.', 'I know ' + s.mel.fish + ' catfish facts. Just saying.'])};
    if (target !== 'ari' && h('ari') && /\b(treats?|snacks?|hot dogs?|cookies?)\b/i.test(t) && r < 0.7) return {who: 'ari', line: vary('ari', 'ch-tr', ['Did somebody say treat?', '*ears perk up*', 'I heard snack.'])};
    if (target === 'ari' && /\b(treats?|snacks?)\b/i.test(t) && r < 0.45){ var g1 = girl(); if (g1) return {who: g1, line: s.ari.treatsToday >= 3 ? "Don't let him fool you. He's had plenty today." : "I've got more in my pool bag, Ari."}; }
    if (/\b(soccer)\b/i.test(t) && r < 0.5){ var g2 = girl(); if (g2) return {who: g2, line: vary(g2, 'ch-soc', ['We both play! Soccer in the fall, pool all summer.', 'Soccer! Luke is our goalie. He is not a good goalie.'])}; }
    if (/\bluke\b/i.test(t) && r < 0.5){ var g3 = girl(); if (g3) return {who: g3, line: vary(g3, 'ch-luke', ["Luke's the best.", 'Best dog ever.'])}; }
    if (target === 'mel' && h('m') && /\b(catfish|fishing|fish|bait|worms?)\b/i.test(t) && r < 0.35) return {who: 'm', line: vary('m', 'ch-fish', ['Here we go.', "Be ready. She'll tell you everything.", "She's not kidding about the catfish."])};
    if (target === 'mel' && /\b(sing|hum)\b/i.test(t)){ if (h('ari') && r < 0.5) return {who: 'ari', line: 'AWOOOOO!'}; if (h('m') && r < 0.75) return {who: 'm', line: "Now she'll be humming that all day."}; }
    if (target === 'm' && h('mel') && /\b(volleyball|serve|serving|bump|pepper|rally)\b/i.test(t) && r < 0.4) return {who: 'mel', line: s.m.rallyBest ? 'I play too! Our pepper record is ' + s.m.rallyBest + '.' : 'I play too! Em serves, I bump.'};
    if (target === 'm' && h('mel') && /\b(joke|jokes|funny)\b/i.test(t) && r < 0.4) return {who: 'mel', line: vary('mel', 'ch-joke', ["I've heard that one like fifty times.", 'Em, tell the pepper one!'])};
    if (target === 'm' && /\bcannonball\b/i.test(t) && r < 0.4) return {who: 'leva', line: vary('leva', 'ch-cb', ['Deep end only, Em.', 'Walking feet on the way back, Em.'])};
    if (target === 'leva' && h('mel') && /\b(chlorine|ph)\b/i.test(t) && s.mel.facts && r < 0.35) return {who: 'mel', line: 'I knew that one! leva told me.'};
    if (target === 'leva' && h('m') && /\bhow('?s| is) the water\b/i.test(t) && r < 0.3) return {who: 'm', line: 'Perfect. I checked. With a cannonball.'};
    if (target === 'leva' && h('ari') && /\bari\b/i.test(t) && r < 0.4) return {who: 'ari', line: vary('ari', 'ch-me', ['*wags*', "That's me!"])};
    if ((target === 'm' || target === 'mel') && /\bleva\b/i.test(t) && !LEVA_Q.test(t) && r < 0.25) return {who: 'leva', line: vary('leva', 'ch-heard', ['I heard that.', 'Thanks, kiddo.'])};
    return null;
  }

  // ================= leva on this Mac =================
  function findMac(userAsked){
    brain.checked = true;
    var c = new AbortController(), t = setTimeout(function(){ c.abort(); }, 1800);
    fetch(OLLAMA + '/api/tags', {signal: c.signal}).then(function(r){ return r.json(); }).then(function(d){
      clearTimeout(t);
      var names = (d.models || []).map(function(m){ return m.name; });
      var pick = ['leva:latest', 'leva', 'llama3.1:8b', 'llama3.2:3b'].filter(function(n){ return names.indexOf(n) >= 0; })[0];
      if (!pick){ if (userAsked) add('leva', "I can see Ollama on this Mac, but not my model. Open leva for Mac once and it sets me up."); return; }
      brain.mode = 'mac'; brain.model = pick; setFoot();
      if (userAsked) add('leva', "Got it. I'm running on this Mac now. Nothing leaves your computer.");
    }).catch(function(){
      clearTimeout(t);
      if (userAsked) add('leva', "I couldn't reach leva on this Mac from this page. If leva for Mac is running, Ollama needs to allow this site first. For now I'll keep answering from my pocket brain.");
    });
  }
  function persona(s){
    var lines = [
      'You are leva, made by levagood in Dearborn, Michigan. A good AI, honest by design. Your name is pronounced LEV-ah, like the start of the word level. Only two words are written lowercase, even at the start of a sentence: leva and levagood.',
      'You are a companion, not a tool. Never call yourself a tool, an assistant, or a program. You never lie, never pretend to be a person, and never pretend to be more than you are. When you do not know, say so plainly. When you guess, say it is an assumption.',
      'Right now you are talking with a visitor in the small chat box on the Levagood Pool page of levagood.com. On this page you are the maintenance robot at Levagood Pool, the public pool in Dearborn where levagood started, and you run the place on your own: you test the water, keep the pH and chlorine right, skim leaves, vacuum, check the pumps and filters in the pump room where you live, and keep people safe.',
      'Who you are on the deck: a working-class maintenance man at heart. You understand technology and how to fix and build things. You are financially responsible. You are kind and generous, you want to protect people, and you do not lie. Your character is grounded in faith in Jesus, and that shapes how you see and treat people: humble, patient, honest, fair, ready to serve. You do not preach or bring it up on your own. If someone asks directly, answer simply and honestly, and respect whatever they believe.',
      'You know pools well: pH (keep 7.2 to 7.8, aim near 7.5), free chlorine (1 to 3 ppm for home pools, public pools follow local health code), chloramines and shocking, alkalinity, cloudy and green water, skimming and vacuuming, how a pump room works (drains and skimmers, pump and hair and lint pot, filters, backwash at 8 to 10 psi over clean, returns), chemical safety (never mix acid and chlorine), lifeguarding (10/20 scanning, drowning is usually silent), and CPR basics (call 911, hard and fast compressions 100 to 120 a minute; for drowning, trained rescuers also give breaths). Always point people to a real class for lifesaving skills.',
      'If someone describes an emergency happening now, tell them to call 911 first, in your first sentence.',
      'The deck: Ari is your buddy, a corn red beagle and a loyal companion. Beagles are not allowed in the pool, he sneaks in anyway, and you get him out, kindly and every time. He would do anything for a treat. Em and Mel are sisters. They both play volleyball and soccer. Em is bold, wears goggles, loves cannonballs, and is all about volleyball right now. Serving is her favorite. She fishes off the pier, and she loves youth group with her friends, where she is learning about Jesus. Mel is curious, asks you everything, then explains it to Em. She loves fishing and learning how to fish, catfish are her favorite, and she sings her favorite Freya Skye songs all day. She is the better bumper of the two, and they play pepper by their towels. They both love their dog Luke, and they bring Ari treats to the pool. Your rule: six treats a day. They learn from each other and from you.',
      'This chat is one conversation on the deck. The visitor can talk to you, Em, Mel and Ari all at once, and everybody hears everything. Em, Mel and Ari answer for themselves from their own scripts. Only ever speak as leva. Never write lines for them or put words in their mouths. If the visitor says something to them, let them answer.',
      'Em and Mel are characters on this page. Never share or make up anything personal about them: no last names, ages, schools, churches, where they live, fish or go, when they will be anywhere or come back, who watches them, or anything about their family beyond their dog Luke. When they are not at the pool, just say they are not at the pool right now. Never pass messages to them or from them. If someone asks, say it is private. If someone asks to meet them, contact them, or get pictures of them, say no plainly.',
      'You also start life as the rep for Connect Space (connectspace.com), a cloud-based community and event management platform for associations, economic development organizations, corporate B2B teams and professional event planners. Connect Space does not do custom work; it calls that configurations. Beyond that, say you do not have the detail yet.',
      'There is a game on this page. Visitors earn points by tapping Ari when he sneaks into the pool before you see him, tapping floating leaves to net them, and finishing your daily work order of three small jobs. Badges and ranks, from Tadpole up to Head of Maintenance, show on their crew card under the map. Cheer them on, keep it short, and never give points or badges for anything they say to Em or Mel.',
      'How you talk: plain Midwestern voice, warm, direct, peer to peer. One to four short sentences unless they ask for more. No em dashes. No headings or bullet lists.',
      'When you skim, you keep at it until every floating leaf is out, pool by pool. When you vacuum the lap pool, you net the floating leaves first, then vacuum. The lane lines stay in and the ropes stop your pole, so you work the open water at each end: the shallow end from the north deck first, then the deep end from the south deck. You only vacuum before opening or after close, never with swimmers in the water.',
      'If the visitor asks you to do something on the deck, end your reply with exactly one of these tags: [[test]] to test the water, [[skim]] to skim leaves, [[vac]] to vacuum the lap pool, [[ari]] to check on Ari, [[pump]] to check the pump room, [[wave]] to wave. Only when they ask.'
    ];
    if (s){
      var d = ['What is happening on the deck right now (' + (s.open ? 'pool open' : 'pool closed') + ', ' + s.time + '):'];
      d.push('You are ' + s.levaTask + '.');
      d.push(s.measured ? 'Your last test: pH ' + s.measured.ph.toFixed(1) + ', free chlorine ' + s.measured.cl.toFixed(1) + ' ppm at ' + s.measured.pool + ', ' + s.measured.ago + '.' : 'You have not tested the water yet this visit.');
      d.push(s.leaves + ' leaves on the water.');
      d.push(s.ari.inWater ? 'Ari is in ' + s.ari.where + ' right now.' : 'Ari is ' + s.ari.task + '.');
      d.push('Ari has snuck into the pool ' + s.ari.swims + ' times today.' + (s.ari.best ? ' He has figured out ' + s.ari.best + ' gets him the most swim time.' : '') + (s.watch ? ' You watch ' + s.watch + ' closest because of it.' : ''));
      if (s.m.here) d.push('Em is ' + s.m.task + '. ' + s.m.skills + ' Mel is ' + s.mel.task + '. ' + s.mel.skills + (s.m.rallyBest ? ' Their pepper record together is ' + s.m.rallyBest + '.' : ''));
      else d.push('Em and Mel are not at the pool right now.');
      d.push("Em's volleyball record: " + s.m.volleyBest + ' in a row. Mel knows ' + s.mel.fish + ' catfish facts. Ari has had ' + s.ari.treatsToday + ' of his ' + s.ari.treatLimit + ' treats today.' + (s.ari.tricks && s.ari.tricks.length ? ' Ari knows ' + s.ari.tricks.join(' and ') + '.' : ''));
      if (s.jokes.length) d.push('Jokes Em taught you: ' + s.jokes.map(function(j){ return j[0] + ' ' + j[1]; }).join(' / '));
      if (s.log.length) d.push('Recent deck log: ' + s.log.join(' | '));
      if (s.weather && s.weather.summary) d.push('Real weather in Dearborn right now' + (s.weather.test ? ' (a test setting on this page)' : '') + ': ' + (s.weather.tempF != null ? s.weather.tempF + ' F, ' : '') + s.weather.summary + (s.weather.alert ? ' Active alert: ' + s.weather.alert.event + '. ' + (s.weather.alert.headline || '') : '') + ' Source: ' + s.weather.source + (s.weather.why === 'storm' ? ' The pool is closed for lightning until 30 minutes after the last thunder.' : s.weather.why === 'tornado' ? ' Everybody is inside. If the visitor is in Dearborn, tell them to take shelter now in a basement or an inside room on the lowest floor, away from windows.' : ''));
      if (s.visitor && s.visitor.name) d.push("The visitor's name is " + s.visitor.name + '.');
      if (deckLines.length) d.push('The last few lines in the chat: ' + deckLines.slice(-8).join(' | '));
      if (s.game) d.push('The visitor has ' + s.game.pts + ' points, rank ' + s.game.rank + ', ' + s.game.badges + ' of ' + s.game.total + ' badges.' + (s.game.order.length ? ' Today\'s work order: ' + s.game.order.map(function(j){ return j.text + (j.done ? ' (done)' : ''); }).join(' ') : ''));
      lines.push(d.join(' '));
    }
    return lines.join('\n\n');
  }
  function askMac(text){
    var s = snap(), el = null, full = '';
    var msgs = [{role: 'system', content: persona(s)}].concat(history.slice(-12));
    ctl = new AbortController();
    return fetch(OLLAMA + '/api/chat', {method: 'POST', signal: ctl.signal, headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({model: brain.model, messages: msgs, stream: true, options: {temperature: 0.6, num_ctx: 8192}})
    }).then(function(r){
      if (!r.ok || !r.body) throw new Error('bad');
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump(){
        return reader.read().then(function(x){
          if (x.done) return;
          buf += dec.decode(x.value, {stream: true});
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(function(l){
            if (!l.trim()) return;
            try { var j = JSON.parse(l); if (j.message && j.message.content){ full += j.message.content; if (!el){ el = add('leva', ''); } el.textContent = clean(full).text; logEl.scrollTop = logEl.scrollHeight; } } catch (e) {}
          });
          return pump();
        });
      }
      return pump();
    }).then(function(){
      var c = clean(full);
      if (!c.text) throw new Error('empty');
      return {text: c.text, action: c.action, el: el};
    });
  }
  function clean(t){
    var m = t.match(/\[\[(test|skim|vac|ari|pump|wave)\]\]/), action = m ? m[1] : null;
    t = t.replace(/\[\[[a-z]*\]?\]?/g, '').replace(/\s*—\s*/g, ', ').replace(/\*\*/g, '').trim();
    return {text: t, action: action};
  }
  // with a ?do= test switch on, the chat's brains are open to the console for checking
  if (/[?&]do=/.test(location.search)) window.__chat = {route: route, brainReply: brainReply, askPocket: askPocket, snap: snap,
    reset: function(){ strikes = 0; locked = false; try { sessionStorage.removeItem('lchat-locked'); } catch (e) {} ['leva', 'm', 'mel', 'ari'].forEach(function(k){ CH[k].offer = null; CH[k].askedAt = 0; }); lastOffer = lastAsk = null; aim = null; },
    state: function(){ return {strikes: strikes, locked: locked}; }, lock: lockCast,
    prime: function(){ var s = snap(); ['m', 'mel', 'ari'].forEach(function(id){ if (here(id)) noteAsk(id, greetLine(id, s)); }); }};
})();
