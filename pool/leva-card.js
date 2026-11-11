// leva-card.js: the pieces of your crew card that the pool page and the park both use.
// The pool page owns the card: your points, your swim level, your badges. The park keeps a ledger of what you earned there,
// and the pool page adds it in the next time it opens. Both pages read these same tables, so they always agree.
(function(){
  var PAL = {"k":"#0A0A0A","w":"#FFFFFF","p":"#FF2E88","q":"#FF96C8","c":"#16B8D0","d":"#9FE7F2","b":"#2f6fd6","e":"#9cc3ff","g":"#3fa34d","h":"#a7d957","y":"#FFD23A","o":"#F28C28","r":"#b4501f","s":"#e8a86a","n":"#6b4424","a":"#8f96a3","l":"#d9dbe3","v":"#8C6BFF","m":"#1b2a4a","R":"#d7263b","u":"#5d6675"};
  // 10 by 10 pixel icons, in the palette above. A dot is see-through.
  var ICONS = {
    "cap1": ["...dddd...",".ddwddddd.",".dddddddd.","dddddkdddd","ddddkkdddd","dddddkdddd","dddddkdddd","ddddkkkddd","dddddddddd",".........."],
    "cap2": ["...yyyy...",".yywyyyyy.",".yyyyyyyy.","yyyykkkyyy","yyyyyykyyy","yyyykkkyyy","yyyykyyyyy","yyyykkkyyy","yyyyyyyyyy",".........."],
    "cap3": ["...oooo...",".oowooooo.",".oooooooo.","ooookkkooo","ooooookooo","oooookkooo","ooooookooo","ooookkkooo","oooooooooo",".........."],
    "cap4": ["...RRRR...",".RRqRRRRR.",".RRRRRRRR.","RRRRwRwRRR","RRRRwRwRRR","RRRRwwwRRR","RRRRRRwRRR","RRRRRRwRRR","RRRRRRRRRR",".........."],
    "cap5": ["...pppp...",".ppqppppp.",".pppppppp.","ppppwwwppp","ppppwppppp","ppppwwwppp","ppppppwppp","ppppwwwppp","pppppppppp",".........."],
    "cap6": ["...vvvv...",".vvevvvvv.",".vvvvvvvv.","vvvvwwwvvv","vvvvwvvvvv","vvvvwwwvvv","vvvvwvwvvv","vvvvwwwvvv","vvvvvvvvvv",".........."],
    "cap7": ["...bbbb...",".bbebbbbb.",".bbbbbbbb.","bbbbwwwbbb","bbbbbbwbbb","bbbbbbwbbb","bbbbbwbbbb","bbbbbwbbbb","bbbbbbbbbb",".........."],
    "cap8": ["...gggg...",".gghggggg.",".gggggggg.","ggggwwwggg","ggggwgwggg","ggggwwwggg","ggggwgwggg","ggggwwwggg","gggggggggg",".........."],
    "cap9": ["...mmmm...",".mmummmmm.",".mmmmmmmm.","mmmmwwwmmm","mmmmwmwmmm","mmmmwwwmmm","mmmmmmwmmm","mmmmwwwmmm","mmmmmmmmmm",".........."],
    "cap10": ["...kkkk...",".kkukkkkk.",".kkkkkkkk.","kkkykyyykk","kkyykykykk","kkkykykykk","kkkykykykk","kkkykyyykk","kkkkkkkkkk",".........."],
    "star": ["....yy....","....yy....","...yyyy...","yyyyyyyyyy",".yyyyyyyy.","..yyyyyy..","..yyyyyy..",".yyy..yyy.",".yy....yy.",".........."],
    "roof": ["RR........","RR........",".......rr.",".....rrrr.","...rrrrrr.",".rrrrrrrr.","..llllll..","..llnnll..","..llnnll..",".........."],
    "rally": ["..RRRRRR..",".RRRRRRRR.","RRRRRRRRRR","RRRwRwwwRR","RRwwRwRwRR","RRRwRwRwRR","RRRwRwRwRR","RRRwRwwwRR",".RRRRRRRR.","..RRRRRR.."],
    "clip": ["...nnnn...",".nnaaaann.",".nwwwwwwn.",".nwmmmmwn.",".nwwwwwwn.",".nwmmmmwn.",".nwwwwwwn.",".nwmmmwwn.",".nwwwwwwn.",".nnnnnnnn."],
    "team": ["...ymmy...",".yywmmyyy.",".yyymmyyy.","yyyymmyyyy","yyyymmyyyy","yyyymmyyyy","yyyymmyyyy","yyyymmyyyy","yyyymmyyyy",".........."],
    "paw": ["..rr..rr..","..rr..rr..","rr......rr","rr......rr","...rrrr...","..rrrrrr..",".rrrrrrrr.",".rrrrrrrr.","..rr..rr..",".........."],
    "splash": ["....c.....","..c.c..c..","...ccc.c..","c..ccc....",".c.cdc.c..","..cdddc...",".cddddddc.","cddddddddc","dddddddddd",".........."],
    "talk": ["..........",".pppppppp.","pppppppppp","ppwppwppwp","pppppppppp",".pppppppp.","..pp......","..p.......","..........",".........."],
    "tree": ["....gg....","...gggg...","..gghggg..",".gggggggg.",".gghggggg.","..gggggg..","...gggg...","....nn....","....nn....","...nnnn..."],
    "hand": ["..s.s.s...","..s.s.s.s.","..s.s.s.s.","..s.s.s.s.","s.sssssss.","ss.ssssss.",".ssssssss.","..sssssss.","...sssss..","...sssss.."],
    "board": ["..........","....ww....","...w..w...","..w....w..","bbbbb...w.",".a......w.",".a.....d..",".a..d.ddd.","cccccccccc","cccccccccc"],
    "bulb": ["...yyyy...","..yyyyyy..",".yyywwyyy.",".yywyyyyy.",".yyyyyyyy.","..yyyyyy..","...yyyy...","...aaaa...","...aaaa...","....aa...."],
    "crew": ["..........","..ss...ss.",".ssss.ssss",".ssss.ssss","..ss...ss.",".pppp.vvvv","pppppvvvvv","pppppvvvvv","pppppvvvvv",".........."],
    "tball": ["...hhhh...","..hhhhhw..",".hhhhhwhh.","hhhhhwhhhh","hhhhwhhhhh","hhhwhhhhhh","hhwhhhhhhh",".whhhhhhh.","..hhhhhh..","...hhhh..."],
    "stars": ["y.......y.","....yy....","....yy....",".yyyyyyyy.","..yyyyyy..","...yyyy...","..yyyyyy..","..yy..yy..","y........y",".........."]
  };
  // swim levels: your points move you up one swim skill at a time (the pool page keeps the same list)
  var LEVELS = [["Bubbles", 0], ["Floater", 50], ["Glider", 125], ["Kicker", 250], ["Freestyle", 400], ["Side Breather", 600], ["Backstroke", 850], ["Breaststroke", 1150], ["Deep Water", 1500], ["Butterfly", 2000]];
  // badges you earn in the park. They sit on the crew card next to the ones from the pool page.
  var PARK_BADGES = [
    {id: 'highfive', name: 'High Five', desc: 'Get a high five from Em or Mel in the park.', pts: 10, icon: 'hand', park: true},
    {id: 'crew', name: 'Met the Crew', desc: 'Say hi to everybody in the park.', pts: 25, icon: 'crew', park: true},
    {id: 'fetch', name: 'Good Throw', desc: 'Throw a toy for Ari or Luke in the park.', pts: 15, icon: 'tball', park: true},
    {id: 'jumps', name: 'Off the Board', desc: 'Do all four jumps into the pool: cannonball, pencil, front flip, back flip.', pts: 30, icon: 'board', park: true},
    {id: 'parklist', name: 'Park Regular', desc: 'Finish a whole park list in one day.', pts: 20, icon: 'tree', park: true},
    {id: 'stars', name: 'Star Catcher', desc: 'Find every star in the park.', pts: 60, icon: 'stars', park: true},
    {id: 'mind', name: 'Mind Reader', desc: 'Make all 8 discoveries about how the crew thinks.', pts: 60, icon: 'bulb', park: true}
  ];
  // two badges the park and the pool page share: you can win them in either place
  var SHARED_BADGES = [
    {id: 'roofball', name: 'Roof Ball', desc: 'Win a game of roof ball off the bathhouse roof.', pts: 40, icon: 'roof'},
    {id: 'rally', name: 'Long Rally', desc: 'Keep a roof ball rally going for 10 hits.', pts: 25, icon: 'rally'}
  ];
  // what things are worth in the park, and the most a day can pay for each kind of thing
  var PARK = {star: 10, hello: 2, five: 3, talk: 2, pet: 1, fetch: 2, jump: 1, newJump: 5, roofPlayed: 10, roofWon: 30, roofQuickPlayed: 5, roofQuickWon: 15, job: 15, list: 30,
    cap: {social: 20, play: 60, jump: 10}};
  var DECK_KEY = 'levagood-deck-v1', PARK_KEY = 'leva_park_game';
  function levelOf(p){ var i = 0; for (var k = 0; k < LEVELS.length; k++) if (p >= LEVELS[k][1]) i = k; return i; }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  // the same numbers for everybody on the same day
  function seeded(str){
    var h = 2166136261; for (var i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function(){ h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // a pixel icon with a one pixel black outline, the way the crew card draws them
  function icon(name){
    var c = document.createElement('canvas'); c.className = 'px-icon'; c.setAttribute('aria-hidden', 'true'); c.width = 12; c.height = 12;
    var g = c.getContext('2d'), rows = ICONS[name] || ICONS.star, on = [], x, y;
    for (y = 0; y < 12; y++){ on[y] = []; for (x = 0; x < 12; x++) on[y][x] = y > 0 && y < 11 && x > 0 && x < 11 && rows[y - 1].charAt(x - 1) !== '.'; }
    for (y = 0; y < 12; y++) for (x = 0; x < 12; x++){
      if (on[y][x]){ g.fillStyle = PAL[rows[y - 1].charAt(x - 1)]; g.fillRect(x, y, 1, 1); }
      else if ((on[y - 1] && on[y - 1][x]) || (on[y + 1] && on[y + 1][x]) || on[y][x - 1] || on[y][x + 1]){ g.fillStyle = '#0A0A0A'; g.fillRect(x, y, 1, 1); }
    }
    return c;
  }
  // what the pool page has on your card right now (the park only ever reads this)
  function deck(){
    var none = {pts: 0, badges: {}, seen: 0, team: false, streak: 0, has: false};
    try {
      var m = JSON.parse(localStorage.getItem(DECK_KEY) || 'null'), g = m && m.v === 1 && m.game; if (!g) return none;
      return {pts: +g.pts || 0, badges: g.badges || {}, seen: (g.park && +g.park.pts) || 0, team: !!g.team, streak: (g.streak && +g.streak.n) || 0, has: true};
    } catch (e) { return none; }
  }
  // what you've earned in the park (the pool page only ever reads this)
  function ledger(){
    try { var s = JSON.parse(localStorage.getItem(PARK_KEY) || 'null'); return s ? {pts: Math.max(0, +s.pts || 0), badges: s.badges || {}, roofToday: !!(s.daily && s.daily.day === today() && +s.daily.roof > 0)} : null; } catch (e) { return null; }
  }
  window.LevaCard = {PAL: PAL, ICONS: ICONS, LEVELS: LEVELS, PARK_BADGES: PARK_BADGES, SHARED_BADGES: SHARED_BADGES, PARK: PARK, DECK_KEY: DECK_KEY, PARK_KEY: PARK_KEY,
    levelOf: levelOf, today: today, seeded: seeded, icon: icon, deck: deck, ledger: ledger};
})();
