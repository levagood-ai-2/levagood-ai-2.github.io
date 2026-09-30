// leva-chat.js: the small chat box on the pool page.
// leva answers two ways. On a Mac with leva installed, he runs on the leva model in Ollama and
// nothing leaves the computer. Everywhere else he answers from his pocket brain: what he knows about
// pools, water, safety, this deck and levagood, plus whatever is happening on the map right now.
(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };
  var root = $('lchat'); if (!root) return;
  var openBtn = $('lchat-open'), panel = $('lchat-panel'), closeBtn = $('lchat-close'), logEl = $('lchat-log'),
      form = $('lchat-form'), input = $('lchat-in'), send = $('lchat-send'), chips = $('lchat-chips'),
      status = $('lchat-status'), foot = $('lchat-foot'), beatEl = $('lchat-beat');
  var PL = function(){ return window.PoolLife && window.PoolLife.chat; };
  var OLLAMA = 'http://127.0.0.1:11434';
  var brain = {mode: 'pocket', model: null, checked: false};
  var history = [], busy = false, greeted = false, ctl = null;
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var wantMac = false; try { wantMac = localStorage.getItem('leva-mac') === '1'; } catch (e) {}

  // ================= the window =================
  function show(){
    panel.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); root.classList.add('on');
    if (!greeted){ greeted = true; greet(); }
    if (!brain.checked && (LOCAL || wantMac)) findMac(false);
    var pl = PL(); if (pl && pl.ready()){ var r = pl.attend(12); if (r === 'ok') pl.say('Hey there!'); }
    setTimeout(function(){ input.focus(); }, 30);
  }
  function hide(){ panel.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); root.classList.remove('on'); openBtn.focus(); }
  openBtn.addEventListener('click', function(){ panel.hidden ? show() : hide(); });
  closeBtn.addEventListener('click', hide);
  panel.addEventListener('keydown', function(e){ if (e.key === 'Escape') hide(); });

  function add(who, text){
    var li = document.createElement('li'); li.className = 'm-' + who;
    var p = document.createElement('p'); p.textContent = text; li.appendChild(p);
    logEl.appendChild(li); logEl.scrollTop = logEl.scrollHeight;
    return p;
  }
  function thinking(on){
    beatEl.classList.toggle('beating', on); root.classList.toggle('thinking', on);
    status.textContent = on ? 'Thinking...' : statusLine();
    var pl = PL(); if (pl) pl.think(on);
  }
  function statusLine(){ return brain.mode === 'mac' ? 'On your Mac' : 'Maintenance, Levagood Pool'; }
  function setFoot(){
    foot.textContent = '';
    if (brain.mode === 'mac'){ foot.appendChild(document.createTextNode('Running on the leva model on this Mac. Nothing leaves your computer.')); return; }
    foot.appendChild(document.createTextNode('Pocket brain: leva answers from what he knows about pools, safety and this deck. '));
    if (!LOCAL){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'lchat-link';
      b.textContent = 'Have leva for Mac? Use it here.';
      b.addEventListener('click', function(){ try { localStorage.setItem('leva-mac', '1'); } catch (e) {} wantMac = true; findMac(true); });
      foot.appendChild(b);
    }
  }
  function greet(){
    var s = snap(), name = s && s.visitor && s.visitor.name;
    add('leva', (name ? 'Hey there, ' + name + '. Welcome back to Levagood Pool. ' : 'Hey there, welcome to Levagood Pool. ') + "I'm leva. I keep this place running, and I'm here to be of service to you.");
    ['How is the water?', "Where's Ari?", 'What is in the pump room?', 'CPR basics'].forEach(function(q){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = q;
      b.addEventListener('click', function(){ ask(q); });
      chips.appendChild(b);
    });
    setFoot();
  }
  form.addEventListener('submit', function(e){ e.preventDefault(); var t = input.value.trim(); if (t) ask(t); });

  // ================= asking =================
  function snap(){ var pl = PL(); return pl && pl.ready() ? pl.snapshot() : null; }
  function ask(text){
    if (busy) return;
    busy = true; send.disabled = true; input.value = ''; chips.hidden = true;
    add('you', text);
    history.push({role: 'user', content: text});
    var pl = PL();
    if (pl){ pl.remember('chat'); var r = pl.attend(14); }
    thinking(true);
    var go = brain.mode === 'mac' ? askMac : askPocket;
    go(text).then(function(res){ finish(res); }, function(){ askPocket(text).then(finish); });
  }
  function finish(res){
    thinking(false); busy = false; send.disabled = false;
    if (!res) return;
    if (res.el) res.el.textContent = res.text; else add('leva', res.text);
    history.push({role: 'assistant', content: res.text});
    if (history.length > 16) history.splice(0, history.length - 16);
    var pl = PL();
    if (pl){
      var first = res.text.split(/(?<=[.!?])\s/)[0];
      if (res.action){
        var did = pl.doTask(res.action);
        if (did === 'busy') add('leva', "Soon as I've got Ari out of the pool.");
        else if (did === 'clean') add('leva', "Water's clean right now. Not a leaf on it.");
        else if (did === 'open') add('leva', 'Not with swimmers in the water. I vacuum before we open and after we close.');
        else if (did === 'weather') add('leva', "Not till this weather passes. I'm staying inside, and you should too.");
      } else pl.say(first);
    }
    input.focus();
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
    if (/^teaching M/.test(l) || /^learning .* from Mel/.test(m)) return 'Mel is ' + lc(l) + '.';
    if (/^teaching Mel/.test(m) || /^learning .* from M$/.test(l)) return 'M is ' + lc(m) + '.';
    return 'M is ' + lc(m) + ' and Mel is ' + lc(l) + '.';
  }
  var STOP = /^(fine|good|great|okay|ok|here|just|not|a|an|the|looking|trying|new|back|curious|wondering|asking|so|very|really|sorry|glad|happy|sure|done|in|on|at|from|with|going|interested|from)$/i;
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
      return {text: 'Heading out with the net. ' + (s ? s.leaves + (s.leaves === 1 ? ' leaf' : ' leaves') + ' on the water right now.' : ''), action: 'skim'};
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
      return {text: "Grabbing the pole. Shallow end first, then I'll walk around and do the deep end.", action: 'vac'};
    }},
    {re: /\b(vacuum|vacuuming|vac)\b/i, f: function(t, s){
      return {text: "Skimming gets what floats. Vacuuming gets what sinks. I do the lap pool before we open or after we close, never with swimmers in. The lane lines stay in, and the ropes stop the pole, so I work the open water at each end: shallow end first, then the deep end. Slow strokes, so I don't kick it all back up."};
    }},
    {re: /\b(leaves|leaf|debris|dirt|net|skimmer)\b/i, f: function(t, s){
      return {text: "Skimming gets what floats, and I get the leaves before they sink and stain. Vacuuming picks up what sinks. " + (s ? 'There ' + (s.leaves === 1 ? 'is 1 leaf' : 'are ' + s.leaves + ' leaves') + ' on the water right now. Say the word and I\'ll skim.' : '')};
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
      if (a.sit) bits.push('Mel taught him to sit.');
      return {text: bits.join(' ')};
    }},
    {re: /\bmel\b|(^|[\s,])M([\s,?!.]|$)|\b(the girls|the kids|regulars)\b/i, f: function(t, s){
      var bits = ["M and Mel are regulars. M's the bold one, goggles on, cannonballs first. Mel asks me everything, then explains it to M."];
      if (s){
        if (!s.m.here) bits.push("They're home for the night. They'll be back when we open.");
        else bits.push('Right now ' + kidsNow(s));
        bits.push('M: ' + s.m.skills.trim() + ' Mel: ' + s.mel.skills.trim());
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
      if (j && j.length){ var k = j[Math.floor(Math.random() * j.length)]; return {text: 'M taught me this one. ' + k[0] + ' ' + k[1]}; }
      return {text: "I'm better at pH than punchlines. M's been teaching me, though. Ask me again after she's been by."};
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
    {re: /\b(thank|thanks|thx|appreciate)\b/i, f: function(){ return {text: 'Anytime.'}; }},
    {re: /\b(bye|see ya|see you|later|good ?night|gotta go)\b/i, f: function(){ return {text: 'Take care. Walk, don\'t run.'}; }},
    {re: /^\s*(hi|hey|hello|howdy|yo|hiya|good (morning|afternoon|evening)|sup)\b/i, f: function(t, s){
      var n = s && s.visitor && s.visitor.name; return {text: (n ? 'Hey, ' + n + '. ' : 'Hey there. ') + 'What can I do for you?'};
    }}
  ];
  function askPocket(text){
    var s = snap();
    return new Promise(function(res){
      var out = null;
      var asking = /\b(can you|could you|would you|will you|please|go|let'?s)\b/i.test(text) || /^\s*(test|check|skim|scoop|clean|grab|get|vacuum)\b/i.test(text) || text.split(/\s+/).length <= 4;
      for (var i = 0; i < R.length && !out; i++){
        if (R[i].act && !asking) continue;
        var m = text.match(R[i].re);
        if (m) out = R[i].f(text, s, m);
      }
      if (!out) out = {text: "I don't know that one, and I won't guess. Ask me about the water, the pumps, pool safety, Ari, M and Mel, or what's going on around the deck."};
      setTimeout(function(){ res(out); }, 550 + Math.random() * 500);
    });
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
      brain.mode = 'mac'; brain.model = pick; status.textContent = statusLine(); setFoot();
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
      'The deck: Ari is your buddy, a corn red beagle. Beagles are not allowed in the pool, he sneaks in anyway, and you get him out, kindly and every time. M and Mel are two regulars. M is bold, wears goggles, loves cannonballs. Mel is curious, asks you everything, then explains it to M. They learn from each other and from you.',
      'You also start life as the rep for Connect Space (connectspace.com), a cloud-based community and event management platform for associations, economic development organizations, corporate B2B teams and professional event planners. Connect Space does not do custom work; it calls that configurations. Beyond that, say you do not have the detail yet.',
      'How you talk: plain Midwestern voice, warm, direct, peer to peer. One to four short sentences unless they ask for more. No em dashes. No headings or bullet lists.',
      'When you vacuum the lap pool, the lane lines stay in and the ropes stop your pole, so you work the open water at each end: the shallow end from the north deck first, then the deep end from the south deck. You only vacuum before opening or after close, never with swimmers in the water.',
      'If the visitor asks you to do something on the deck, end your reply with exactly one of these tags: [[test]] to test the water, [[skim]] to skim leaves, [[vac]] to vacuum the lap pool, [[ari]] to check on Ari, [[pump]] to check the pump room, [[wave]] to wave. Only when they ask.'
    ];
    if (s){
      var d = ['What is happening on the deck right now (' + (s.open ? 'pool open' : 'pool closed') + ', ' + s.time + '):'];
      d.push('You are ' + s.levaTask + '.');
      d.push(s.measured ? 'Your last test: pH ' + s.measured.ph.toFixed(1) + ', free chlorine ' + s.measured.cl.toFixed(1) + ' ppm at ' + s.measured.pool + ', ' + s.measured.ago + '.' : 'You have not tested the water yet this visit.');
      d.push(s.leaves + ' leaves on the water.');
      d.push(s.ari.inWater ? 'Ari is in ' + s.ari.where + ' right now.' : 'Ari is ' + s.ari.task + '.');
      d.push('Ari has snuck into the pool ' + s.ari.swims + ' times today.' + (s.ari.best ? ' He has figured out ' + s.ari.best + ' gets him the most swim time.' : '') + (s.watch ? ' You watch ' + s.watch + ' closest because of it.' : ''));
      if (s.m.here) d.push('M is ' + s.m.task + '. ' + s.m.skills + ' Mel is ' + s.mel.task + '. ' + s.mel.skills);
      else d.push('M and Mel are home for the night.');
      if (s.jokes.length) d.push('Jokes M taught you: ' + s.jokes.map(function(j){ return j[0] + ' ' + j[1]; }).join(' / '));
      if (s.log.length) d.push('Recent deck log: ' + s.log.join(' | '));
      if (s.weather && s.weather.summary) d.push('Real weather in Dearborn right now' + (s.weather.test ? ' (a test setting on this page)' : '') + ': ' + (s.weather.tempF != null ? s.weather.tempF + ' F, ' : '') + s.weather.summary + (s.weather.alert ? ' Active alert: ' + s.weather.alert.event + '. ' + (s.weather.alert.headline || '') : '') + ' Source: ' + s.weather.source + (s.weather.why === 'storm' ? ' The pool is closed for lightning until 30 minutes after the last thunder.' : s.weather.why === 'tornado' ? ' Everybody is inside. If the visitor is in Dearborn, tell them to take shelter now in a basement or an inside room on the lowest floor, away from windows.' : ''));
      if (s.visitor && s.visitor.name) d.push("The visitor's name is " + s.visitor.name + '.');
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
})();
