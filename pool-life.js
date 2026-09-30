// pool-life.js: the living part of the Levagood Pool page.
// leva runs the place on his own. He watches the water, decides what needs doing, and goes and does it.
// Ari the beagle, M and Mel share the deck with him, and everybody learns from everybody.
// pool.html hands over its canvases and the leva object with PoolLife.init(api), then calls
// PoolLife.step(dt) and PoolLife.drawCast() once a frame. The chat (leva-chat.js) talks to leva through PoolLife too.
(function(){
  'use strict';

  var DECK_RLE = "1427,a,2,a,1,a,2,9,2,4,1,8,2,7,1,a,2,a,104,35,2,4,1,8,2,1f,fe,3b,1,13,18,3,fb,a,1c,e,5,5,1,13,18,3,f8,d,1c,e,5,5,1,1,f,3,1a,1,f4,11,1c,18,1,1,f,3,1a,1,f2,13,1c,18,1,1,f,3,1a,1,f0,15,6,1,d,1,8,17,1,1,f,3,1a,1,ed,18,7,1,d,1,7,17,1,1,f,3,1a,1,eb,1a,4,1,2,1,a,1,2,1,6,1,1,16,1,1,f,3,1a,1,e9,7,5,10,5,2,c,2,9,16,1,1,11,1,102,9,6,f,1d,17,1,1,f,3,1a,1,e5,3,5,3,6,f,1c,1,1,15,2,1,f,3,1a,1,e4,4,5,3,6,f,1c,17,2,1,f,3,1a,1,e5,3,5,3,6,f,1d,17,1,1,f,3,1a,1,e5,3,5,3,6,f,1d,17,1,1,f,3,1a,1,df,1,5,3,5,3,6,4,4,7,1c,1,1,16,1,1,11,1,1a,1,de,2,5,3,5,3,6,2,8,5,1d,17,1,1,12,1b,de,2,5,3,5,3,6,1,a,4,1d,17,1,1,12,14,4,3,de,2,5,3,5,3,6,1,b,3,1c,1,1,16,1,3,1,b,3,15,4,3,de,2,5,3,5,3,12,3,1c,18,1,3,1,b,1,17,4,3,de,2,5,3,5,8,d,3,1d,17,1,2,9,1c,4,3,de,2,6,2,6,8,e,1,1e,16,1,2,a,1c,3,3,d6,2,6,2,5,11,c,6,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,16,1,2,9,23,d5,3,6,2,5,12,b,6,1,1,1,1,2,1,1,1,1,1,2,1,1,1,4,1,1,1,1,1,1,16,2,2,9,22,d5,4,6,19,b,36,2,2,9,22,d4,5,6,1a,8,1,1,37,1,2,9,23,d2,b,1,1c,4,3,1,37,1,2,9,23,d1,30,1,37,1,2,9,23,d0,31,1,37,1,2,9,23,d0,69,1,2,9,23,cf,69,2,2,a,a,2,a,2,a,ce,6a,2f,8,c6,88,7,9,1,9,c5,5f,4,26,7,9,1,9,c4,60,5,25,7,9,1,9,c4,60,5,25,7,9,1,9,c3,17,7,43,5,25,7,9,1,9,c2,18,7,6d,7,9,1,9,c2,18,2,3,2,7d,1,9,c1,19,2,3,2,1,1,7b,1,9,c1,19,2,3,2,1,1,1,2,2,4,b,2,2,4,18,2,2,4,3f,1,9,c0,1a,7,1,1,1,2,2,1,1,1,c,2,2,2,1,1,18,2,2,1,1,1,19,6,21,1,9,bf,1b,7,1,4,2,1,1,1,d,1,2,1,2,1,19,1,2,1,1,1,19,6,21,1,9,be,24,1,54,2,2,2,21,1,9,be,12,1b,b,2e,13,2,2,2,21,1,9,bd,b,1,7,2,2,2,2,2,2,2,2,2,2,2,2,3,b,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,13,9,1e,1,9,bd,d,1,5,1b,b,1,1,2a,1,1,13,6,21,1,9,bc,14,1,1,17,1,1,b,2e,3a,1,9,bc,14,1,1,17,1,1,b,2e,3a,1,9,bb,15,1b,b,1,1,2a,1,1,3a,1,9,bb,15,1b,8,35,36,1,9,ba,16,1,1,17,1,1,8,35,36,1,9,ba,f,20,1,1,8,1,3,1,1,2b,3,1,36,1,9,b9,10,22,8,1,4,2a,1,1,3,1,b,4,27,1,9,b9,10,22,8,35,b,3,1,5,22,1,9,b8,11,20,1,1,b,2e,f,1,1,3,2,5,1f,1,9,b8,18,1,1,17,1,1,b,2e,f,1,1,7,2,3,1d,1,9,b8,18,1b,b,1,1,2a,1,1,f,b,2,3,1b,1,5,bb,19,1b,b,1,1,2a,1,1,f,11,1a,1,5,bb,19,1,1,17,1,1,b,2e,f,1,1,11,18,1,5,ba,1a,1,1,17,1,1,b,2e,f,1,1,f,1,2,17,1,5,ba,1a,1b,b,1,1,2a,1,1,f,15,16,1,5,ba,1a,1b,b,1,1,2a,1,1,f,13,1,2,15,1,5,ba,1a,1,1,17,1,1,b,2e,f,1,1,15,14,1,5,ba,10,7,3,1,1,17,1,1,b,2e,f,1,1,13,1,2,13,1,5,b9,d,29,b,1,1,2a,1,1,f,19,12,1,5,b9,11,25,b,1,1,2a,1,1,f,17,1,1,12,1,5,b8,12,23,1,1,b,2e,f,1,1,18,11,1,5,b8,e,27,1,1,b,2e,f,1,1,19,10,1,5,b8,12,7,2,2,1,19,b,1,1,2a,1,1,f,1b,10,1,5,b8,1c,1,1,19,b,1,1,2a,1,1,f,1c,f,1,2,ba,1d,1,1,17,1,1,b,2e,f,1,1,18,1,2,e,1,2,1,6,b3,1d,1,1,17,1,1,b,2e,f,1,1,1b,e,1,2,1,6,b3,1d,1b,b,1,1,2a,1,1,f,1b,1,1,e,1,2,1,6,b3,1d,1b,b,1,1,2a,1,1,f,1c,1,1,d,1,2,ba,1d,1,1,17,1,1,b,2e,f,1,1,1c,d,1,2,b9,1e,1,1,17,1,1,b,2e,f,1,1,1d,c,1,2,1,6,b2,14,7,3,1b,b,1,1,2a,1,1,f,1f,c,1,2,1,6,b2,10,29,b,1,1,2a,1,1,f,1f,c,1,2,1,6,b2,14,23,1,1,6,33,f,1,1,1b,1,2,b,1,2,1,6,b2,14,23,1,1,6,33,f,1,1,1c,1,1,b,1,2,1,6,b2,10,29,6,6,1,2a,1,1,f,20,b,1,2,1,6,b2,14,7,3,1,1,19,6,6,1,2a,1,1,f,20,b,1,2,1,6,b2,6,b,d,1,1,17,1,1,6,33,f,1,1,1c,1,1,b,1,2,1,6,b1,7,b,d,1,1,17,1,1,6,33,f,1,1,1c,1,1,b,1,2,1,6,b1,7,b,d,1b,6,6,1,2a,1,1,f,1f,1,1,a,1,2,1,6,b2,6,b,d,1b,6,6,1,2a,1,1,f,1f,1,1,a,1,2,1,6,b2,6,b,d,1,1,17,1,1,6,33,f,1,1,1f,a,1,2,1,6,b1,d,1,11,1,1,17,1,1,6,33,f,1,1,1f,a,1,2,1,6,b1,1f,1b,6,6,1,2a,1,1,f,1f,1,1,a,1,2,1,6,b1,1f,1b,6,6,1,2a,1,1,f,1f,1,1,a,1,2,b8,18,20,1,1,6,33,f,1,1,1f,a,1,8,b2,18,20,1,1,6,33,f,1,1,1f,a,1,8,b2,18,22,6,6,1,2c,f,1f,1,1,a,1,8,b2,18,22,6,6,1,2a,1,1,f,20,b,1,8,b2,1f,1,1,1d,2,33,f,1,1,1c,1,1,b,1,8,b2,8,c,b,1,1,1d,2,33,f,1,1,1c,1,1,b,1,8,b2,8,c,b,1b,3,1,7,1,1,2c,f,20,b,1,8,b3,7,c,b,1b,3,1,2,6,1,2c,f,20,b,1,8,b3,7,c,b,1,1,1d,2,33,f,1,1,1b,1,2,b,1,8,b3,7,c,b,1,1,17,1,1,6,33,f,1,1,1b,1,1,c,1,8,b3,c,1,11,2,2,2,2,2,2,2,2,2,2,2,2,3,6,6,1,2a,1,1,f,1f,c,1,8,b3,1e,1b,b,1,1,2c,f,1f,c,1,8,b3,10,7,2d,2e,f,1,1,1c,d,1,9,b2,10,7,2d,2e,f,1,1,1c,d,1,9,b2,10,7,11,7,15,1,1,2a,1,1,f,1b,1,1,e,1,9,b3,f,7,11,7,15,1,1,2a,1,1,f,1b,1,1,e,1,9,b3,f,7,11,2,3,2,15,2e,f,1,1,18,1,2,e,1,9,b3,f,7,11,2,3,2,1,1,13,2e,f,1,1,18,1,1,f,1,9,b4,7,b,14,7,1,1,13,1,1,2a,1,1,f,1b,10,1,9,b4,7,b,14,7,1,1,13,1,1,2a,1,1,f,18,1,2,10,1,9,b4,7,b,1c,1,a,7,2,2e,f,1,1,18,11,1,9,b4,7,b,1c,1,a,7,2,2e,f,1,1,17,12,1,9,b4,7,b,1c,1,a,2,3,2,2,1,1,2a,1,1,f,19,12,1,9,b4,a,1,2e,2,3,2,2,1,1,2a,1,1,f,18,13,1,9,b5,38,7,2,2e,f,1,1,15,14,1,9,b5,38,7,2,2e,f,1,1,14,15,1,9,b5,3b,7,1,2a,1,1,f,15,16,1,9,b5,41,1,1,2a,1,1,f,14,17,1,9,b6,11,4,2b,2e,f,1,1,11,18,1,9,b6,f,8,29,2e,f,1,1,b,2,2,1a,1,9,b7,d,a,28,1,1,2a,1,1,f,b,2,3,1b,1,9,b7,5,12,28,1,1,2a,1,1,f,8,1,5,1d,1,9,b7,5,13,27,2e,f,1,1,3,2,5,1f,1,9,b8,4,13,24,35,b,1,2,6,22,1,9,b8,4,13,24,35,b,4,27,1,9,b8,4,13,24,1,4,2a,1,1,3,1,36,1,9,b9,5,1,5,a,25,1,3,1,1,2b,3,1,36,1,9,b9,b,a,25,35,c,2,1,1,2,a,1,1,18,1,9,ba,b,c,25,1,1,2a,1,1,10,4,2,2,1,3,1,5,18,1,9,ba,d,4,2b,1,1,2a,1,1,10,4,2,c,22,bb,e,3,2a,2e,44,bb,d,5,29,2e,44,bc,3a,1,1,2a,1,1,26,4,2,c,c,bc,3a,1,1,2a,1,1,26,4,2,1,1,8,1,1,c,bd,1,b,2d,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,26,2,1,1,3,b,c,bd,1,b,2d,2e,2f,4,9,1,7,c9,97,1,7,c9,9f,c9,2e,2,2,4,18,2,2,4,49,c0,37,2,2,2,1,1,18,2,2,1,1,1,4a,c0,37,2,2,1,2,1,18,2,2,1,1,1,4a,c2,a6,c2,3,b,20,2,76,c2,3,b,1f,4,75,c3,2,b,1e,6,74,c4,1,b,1e,6,74,c4,1,b,1f,4,75,c6,4,5,21,2,6e,1,7,c6,5,4,99,c7,4,4,92,cf,3,c,8a,d0,3,1,2,8,8a,d0,3,c,89,d2,1,b,8a,d2,1,b,7,5,3,5,3,5,3,5,3,5,5e,d3,a,1,7,5,3,5,3,5,3,5,3,5,5e,d4,11,5,3,5,3,5,3,5,3,5,5e,d5,10,5,3,5,3,5,3,5,3,5,5e,d8,d,5,3,5,3,5,3,5,3,5,5e,d8,d,5,3,5,3,5,3,5,3,5,5e,d9,c,5,3,5,3,5,3,5,3,5,5e,da,b,5,3,5,3,5,3,5,3,5,5e,db,a,5,3,5,3,5,3,5,3,5,5e,dc,9,5,3,5,3,5,3,5,3,5,5d,df,7,6,2,e,2,6,2,6,5c,e0,a,1,6,8,9,1,66,e1,e,a,6f,e2,d,a,6f,e4,a,c,6d,e6,9,c,6e,e7,7,c,6e,e9,5,c,6e,ec,3,a,6f,ed,2,a,6f,ef,1,8,70,f6,71,fc,65,5,2,f9,68,5,3,fb,1,1,6b,fe,69,104,64,10d,4,2,a,1,a,2,a,1,a,2,a,1,a,2,a,1,6,1175";
  var WATER_RLE = "5775,15,11,28,11a,15,11,28,11a,15,11,28,11a,15,12,26,11b,15,12,26,122,e,12,26,122,e,12,26,122,e,12,26,122,e,11,28,11a,15,11,28,11a,15,11,28,11a,15,11,28,11a,15,11,28,11a,15,11,28,11a,15,11,28,15,1,104,15,11,28,16,1,103,15,11,28,15,5,1,1,fe,15,11,28,15,6,1,1,107,b,11,28,15,9,1,1,104,b,11,28,15,a,105,b,11,28,15,b,1,1,102,b,11,28,15,c,1,1,f7,15,11,28,15,f,f6,15,11,28,15,e,f7,15,11,28,15,5,2,8,1,1,f4,15,11,28,15,5,2,9,f5,15,11,28,15,5,2,a,f4,15,11,28,15,5,2,b,f3,15,11,28,15,5,2,c,f2,15,11,28,15,5,2,b,f3,15,11,28,15,5,2,c,fc,b,11,28,15,5,2,d,fb,b,4e,5,2,e,fa,b,11,1,1,25,16,5,2,d,fb,b,11,1,3c,5,2,e,f0,15,11,1,1,25,16,5,2,d,f1,15,12,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,17,5,2,e,f0,15,15,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,17,5,2,f,ef,15,11,1,3c,d,6,2,f0,15,11,1,1,25,16,c,8,2,ef,15,11,28,15,b,b,1,ee,15,12,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,14,b,a,1,ef,15,11,1,1,25,16,b,a,2,ee,15,11,1,3c,b,a,1,f6,e,11,1,1,25,16,b,b,1,f5,e,12,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,17,b,a,1,f6,e,12,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,17,c,8,1,f7,e,11,1,1,25,16,d,6,1,1,1,ef,14,12,1,3c,15,f0,14,12,1,1,25,16,14,f1,14,13,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,17,15,f0,14,16,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,17,14,f1,14,12,1,3c,15,116,1,1,25,16,14,117,28,15,13,155,12,119,28,15,13,118,28,15,12,119,28,15,11,11a,28,15,10,11b,28,15,f,1,1,11a,28,15,e,11d,28,15,6,4,3,1,1,11c,28,15,5,6,1,11f,28,15,5,7,1,11e,28,15,5,126,28,15,5,126,28,15,4,1,1,125,28,15,3,1,1,126,28,140,28,140,28,140,28,140,28,140,28,140,28,140,28,141,26,142,26,142,26,142,26,142,26,141,28,140,28,140,28,140,28,140,28,569d";
  var CAST = {"m_s0":[0,0,21,33,10,32],"m_n0":[22,0,21,33,10,32],"m_e0":[44,0,21,33,10,32],"m_w0":[66,0,21,33,10,32],"m_s1":[88,0,21,33,10,32],"m_n1":[110,0,21,33,10,32],"m_e1":[132,0,21,33,10,32],"m_w1":[154,0,21,33,10,32],"m_s":[176,0,21,33,10,32],"m_n":[198,0,21,33,10,32],"m_e":[220,0,21,33,10,32],"m_w":[0,34,21,33,10,32],"m_swim0":[22,34,23,19,11,15],"m_swim1":[46,34,23,19,11,15],"m_float":[70,34,33,21,16,10],"m_tuck":[104,34,21,27,10,25],"m_sit":[126,34,21,33,10,29],"m_wave":[148,34,21,33,10,32],"mel_s0":[170,34,21,29,10,28],"mel_n0":[192,34,21,29,10,28],"mel_e0":[214,34,21,29,10,28],"mel_w0":[0,68,21,29,10,28],"mel_s1":[22,68,21,29,10,28],"mel_n1":[44,68,21,29,10,28],"mel_e1":[66,68,21,29,10,28],"mel_w1":[88,68,21,29,10,28],"mel_s":[110,68,21,29,10,28],"mel_n":[132,68,21,29,10,28],"mel_e":[154,68,21,29,10,28],"mel_w":[176,68,21,29,10,28],"mel_swim0":[198,68,23,19,11,15],"mel_swim1":[222,68,23,19,11,15],"mel_float":[0,98,33,21,16,10],"mel_tuck":[34,98,21,27,10,25],"mel_sit":[56,98,21,32,10,28],"mel_wave":[78,98,21,29,10,28],"ari_e0":[100,98,31,21,15,18],"ari_w0":[132,98,31,21,15,18],"ari_e1":[164,98,31,21,15,18],"ari_w1":[196,98,31,21,15,18],"ari_sniff_e":[0,131,31,21,15,18],"ari_sniff_w":[32,131,31,21,15,18],"ari_happy_e":[64,131,31,21,15,18],"ari_happy_w":[96,131,31,21,15,18],"ari_sit_e":[128,131,31,21,13,19],"ari_sit_w":[160,131,31,21,17,19],"ari_sleep_e":[192,131,30,17,13,15],"ari_sleep_w":[223,131,30,17,16,15],"ari_swim_e0":[0,153,31,15,18,11],"ari_swim_w0":[32,153,31,15,12,11],"ari_s0":[64,153,21,21,10,19],"ari_n0":[86,153,21,21,10,19],"ari_swim_e1":[108,153,31,15,18,11],"ari_swim_w1":[140,153,31,15,12,11],"ari_s1":[172,153,21,21,10,19],"ari_n1":[194,153,21,21,10,19]};
  var GW = 360, GH = 210, N = GW * GH;
  // test the deck faster with ?fast=4 (up to 10), the same way ?time= and ?open= test the clock
  var FAST = Math.max(1, Math.min(10, +new URLSearchParams(location.search).get('fast') || 1));

  // ================= the deck as a grid =================
  // one cell is 2 x 2 map pixels. DECK is concrete you can walk on, WATER is water you can swim in.
  function unrle(s){
    var g = new Uint8Array(N), i = 0, v = 0, parts = s.split(',');
    for (var k = 0; k < parts.length; k++){ var n = parseInt(parts[k], 16); if (v) g.fill(1, i, i + n); i += n; v ^= 1; }
    return g;
  }
  function erode(src, r){
    var out = new Uint8Array(N), offs = [];
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 0.5) offs.push(dx, dy);
    for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++){
      var i = y * GW + x; if (!src[i]) continue;
      var ok = 1;
      for (var k = 0; k < offs.length; k += 2){
        var xx = x + offs[k], yy = y + offs[k + 1];
        if (xx < 0 || yy < 0 || xx >= GW || yy >= GH || !src[yy * GW + xx]){ ok = 0; break; }
      }
      out[i] = ok;
    }
    return out;
  }
  var DECK = unrle(DECK_RLE), WATER = unrle(WATER_RLE);
  var BIG = erode(DECK, 2), SMALL = erode(DECK, 1), SWIM = erode(WATER, 2);
  function cellIdx(x, y){ var gx = Math.floor(x / 2), gy = Math.floor(y / 2); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return -1; return gy * GW + gx; }
  function on(mask, x, y){ var i = cellIdx(x, y); return i >= 0 && mask[i] === 1; }
  function snap(mask, x, y){
    var gx = Math.max(0, Math.min(GW - 1, Math.floor(x / 2))), gy = Math.max(0, Math.min(GH - 1, Math.floor(y / 2)));
    if (mask[gy * GW + gx]) return [gx * 2 + 1, gy * 2 + 1];
    for (var r = 1; r < 60; r++){
      var best = null, bd = 1e9;
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++){
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        var xx = gx + dx, yy = gy + dy;
        if (xx < 0 || yy < 0 || xx >= GW || yy >= GH || !mask[yy * GW + xx]) continue;
        var d = dx * dx + dy * dy; if (d < bd){ bd = d; best = [xx * 2 + 1, yy * 2 + 1]; }
      }
      if (best) return best;
    }
    return [x, y];
  }
  function los(mask, x0, y0, x1, y1){
    var dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) + 1;
    for (var i = 0; i <= n; i++){ var t = i / n; if (!on(mask, x0 + dx * t, y0 + dy * t)) return false; }
    return true;
  }
  // A* over the grid, 8 ways, no cutting corners, then pulled straight wherever the path can see ahead
  var gS = new Float32Array(N), from = new Int32Array(N), seen = new Uint32Array(N), shut = new Uint32Array(N), gen = 0;
  var HMAX = N * 4, heapI = new Int32Array(HMAX), heapF = new Float32Array(HMAX), hn = 0;
  var DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  function hpush(i, f){
    if (hn >= HMAX) return;
    var k = hn++; heapI[k] = i; heapF[k] = f;
    while (k > 0){ var p = (k - 1) >> 1; if (heapF[p] <= heapF[k]) break; var ti = heapI[p], tf = heapF[p]; heapI[p] = heapI[k]; heapF[p] = heapF[k]; heapI[k] = ti; heapF[k] = tf; k = p; }
  }
  function hpop(){
    var top = heapI[0]; hn--;
    if (hn > 0){
      heapI[0] = heapI[hn]; heapF[0] = heapF[hn];
      var k = 0;
      for (;;){
        var l = 2 * k + 1, r = l + 1, m = k;
        if (l < hn && heapF[l] < heapF[m]) m = l; if (r < hn && heapF[r] < heapF[m]) m = r;
        if (m === k) break;
        var ti = heapI[m], tf = heapF[m]; heapI[m] = heapI[k]; heapF[m] = heapF[k]; heapI[k] = ti; heapF[k] = tf; k = m;
      }
    }
    return top;
  }
  function path(mask, sx, sy, tx, ty){
    var s = snap(mask, sx, sy), t = snap(mask, tx, ty);
    var si = cellIdx(s[0], s[1]), ti = cellIdx(t[0], t[1]);
    if (si < 0 || ti < 0) return [[tx, ty]];
    var tgx = ti % GW, tgy = (ti / GW) | 0;
    function h(i){ var dx = Math.abs(i % GW - tgx), dy = Math.abs(((i / GW) | 0) - tgy); return dx + dy - 0.5858 * Math.min(dx, dy); }
    gen++; hn = 0; gS[si] = 0; seen[si] = gen; from[si] = -1; hpush(si, h(si));
    var found = false, iters = 0;
    while (hn){
      var cur = hpop(); if (shut[cur] === gen) continue; shut[cur] = gen;
      if (cur === ti){ found = true; break; }
      if (++iters > 70000) break;
      var cx = cur % GW, cy = (cur / GW) | 0;
      for (var k = 0; k < 8; k++){
        var nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        var ni = ny * GW + nx; if (!mask[ni] || shut[ni] === gen) continue;
        if (k >= 4 && (!mask[cy * GW + nx] || !mask[ny * GW + cx])) continue;
        var ng = gS[cur] + (k >= 4 ? 1.4142 : 1);
        if (seen[ni] !== gen || ng < gS[ni]){ seen[ni] = gen; gS[ni] = ng; from[ni] = cur; hpush(ni, ng + h(ni)); }
      }
    }
    if (!found) return [[t[0], t[1]]];
    var cells = []; for (var c = ti; c !== -1; c = from[c]) cells.push(c);
    cells.reverse();
    var pts = cells.map(function(i){ return [(i % GW) * 2 + 1, ((i / GW) | 0) * 2 + 1]; });
    var out = [], a = 0;
    while (a < pts.length - 1){
      var last = a + 1;
      for (var b = a + 2; b < pts.length; b += 2){ if (los(mask, pts[a][0], pts[a][1], pts[b][0], pts[b][1])) last = b; else break; }
      if (last < pts.length - 1 && los(mask, pts[a][0], pts[a][1], pts[pts.length - 1][0], pts[pts.length - 1][1])) last = pts.length - 1;
      out.push(pts[last]); a = last;
    }
    if (!out.length) out.push(pts[pts.length - 1]);
    return out;
  }

  // ================= places on the deck =================
  var POOLS = {
    dive: {name: 'the diving well', box: [132, 116, 188, 238]},
    lap: {name: 'the lap pool', box: [206, 116, 304, 306]},
    zero: {name: 'the zero depth', box: [326, 132, 402, 284]}
  };
  function poolAt(x, y){
    for (var k in POOLS){ var b = POOLS[k].box; if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return k; }
    return null;
  }
  function randomWater(pool, near, radius){
    var b = POOLS[pool].box;
    for (var tries = 0; tries < 80; tries++){
      var x = near ? near[0] + (Math.random() * 2 - 1) * radius : b[0] + Math.random() * (b[2] - b[0]);
      var y = near ? near[1] + (Math.random() * 2 - 1) * radius : b[1] + Math.random() * (b[3] - b[1]);
      if (poolAt(x, y) === pool && on(SWIM, x, y)) return [x, y];
    }
    return snap(SWIM, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  }
  // where you get in and out; deck spots for small feet, water spots just off the edge
  var SPOTS = {
    zero: {pool: 'zero', deck: [408, 212], water: [383, 232]},
    lapN: {pool: 'lap', deck: [255, 109], water: [255, 132]},
    lapS: {pool: 'lap', deck: [255, 313], water: [255, 292]},
    dive: {pool: 'dive', deck: [171, 241], water: [165, 224]}
  };
  var SPOT_NAME = {zero: 'the zero depth', lapN: 'the shallow end of the lap pool', lapS: 'the deep end of the lap pool', dive: 'the diving well'};
  var PLACES = {
    pump: {door: [250, 86], inside: [250, 73], name: 'the pump room'},
    office: {door: [411, 176], inside: [432, 176], name: 'the office'},
    pit: {door: [411, 194], inside: [432, 194], name: 'the pit'},
    arcade: {door: [411, 222], inside: [432, 222], name: 'the guard shack'},
    gate: {door: [416, 190], inside: [440, 190], name: 'the front gate'}
  };
  var KIT_SPOTS = {lap: [[263, 109, 'e'], [247, 313, 'w']], zero: [[409, 213, 'w']], dive: [[171, 241, 'w']]};
  var VAC = [317, 211], GATE_SPOT = [371, 107];
  var TOWELS = {m: [351, 331], mel: [373, 337]};

  // ================= the deck's memory =================
  // kept in this browser, so the deck picks up where it left off next time you visit
  var KEY = 'levagood-deck-v1';
  function today(){ var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function freshDay(){ return {ariSwims: 0, ariTime: 0, leaves: 0, tests: 0, fixes: 0, reminders: 0}; }
  var MEM = {
    v: 1, day: today(), today: freshDay(), visits: 0,
    ari: {spots: {zero: 0.5, lapN: 0.5, lapS: 0.5, dive: 0.5}, best: null, sit: 0, paw: 0},
    leva: {seen: {zero: 0, lapN: 0, lapS: 0, dive: 0}, watch: null, jokes: []},
    m: {cannonball: 1, float: 0.2, handstand: 0.75, run: 0.55, facts: 0},
    mel: {cannonball: 0.1, float: 1, handstand: 0.2, run: 0.2, facts: 0},
    chem: null, log: [], visitor: {name: '', chats: 0, topics: {}}
  };
  function load(){
    try {
      var raw = localStorage.getItem(KEY); if (!raw) return;
      var m = JSON.parse(raw); if (!m || m.v !== 1) return;
      for (var k in MEM) if (m[k] !== undefined) MEM[k] = m[k];
    } catch (e) {}
    if (MEM.day !== today()){ MEM.day = today(); MEM.today = freshDay(); }
  }
  var saveAt = 0;
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(MEM)); } catch (e) {} }
  function log(text, who){
    MEM.log.push({t: Date.now(), who: who || 'leva', text: text});
    if (MEM.log.length > 40) MEM.log.splice(0, MEM.log.length - 40);
    save(); boardDirty = true;
  }

  // ================= the water =================
  var W = {ph: 7.7, cl: 1.4, dirt: 0.3, target: null, measured: null, leaves: [], leafClock: 6, fixPending: null, lastTest: -999, lastReport: 0, lastVac: -999, lastGate: '', clock: 0};
  function chemStep(dt, open){
    var m = dt / 60;
    if (W.target){
      var k = Math.min(1, dt / Math.max(1, W.target.left));
      W.ph += (W.target.ph - W.ph) * k; W.cl += (W.target.cl - W.cl) * k; W.target.left -= dt;
      if (W.target.left <= 0) W.target = null;
    } else {
      W.ph += (open ? 0.035 : 0.018) * m;
      W.cl -= (open ? (api.isNight() ? 0.03 : 0.07) : 0.02) * m;
    }
    W.ph = Math.max(6.8, Math.min(8.3, W.ph)); W.cl = Math.max(0, Math.min(6, W.cl));
    W.dirt = Math.min(1, W.dirt + (open ? 0.012 : 0.004) * m);
    // leaves blow in off the park trees
    W.leafClock -= dt;
    if (W.leafClock <= 0){
      W.leafClock = (api.isNight() ? 22 : 12) + Math.random() * 12;
      if (W.leaves.length < 14){
        var r = Math.random(), pool = r < 0.55 ? 'lap' : r < 0.8 ? 'dive' : 'zero', p = randomWater(pool);
        W.leaves.push({x: p[0], y: p[1], vx: 0, vy: 0, pool: pool, c: ['#6b8e23', '#8a6a3a', '#a7c957', '#b5651d'][Math.floor(Math.random() * 4)], k: Math.random() * 6.28, grab: 0});
      }
    }
    W.leaves.forEach(function(l){
      l.k += dt * 0.4;
      l.vx += (Math.cos(l.k) * 0.6 - l.vx) * dt; l.vy += (Math.sin(l.k * 0.7) * 0.4 - l.vy) * dt;
      var nx = l.x + l.vx * dt, ny = l.y + l.vy * dt;
      if (poolAt(nx, ny) === l.pool && on(SWIM, nx, ny)){ l.x = nx; l.y = ny; } else { l.k += 1.6; }
    });
  }
  function drawLeaves(ctx){
    W.leaves.forEach(function(l){
      var x = Math.round(l.x), y = Math.round(l.y);
      ctx.fillStyle = 'rgba(20,40,60,.18)'; ctx.fillRect(x + 1, y + 1, 3, 2);
      ctx.fillStyle = l.c; ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + (Math.cos(l.k) > 0 ? 2 : 0), y - 1, 1, 1);
    });
    // a green tint creeps into the water if the chlorine runs low; leva does not let it get far
    var g = Math.max(0, (0.9 - W.cl) / 0.9) * 0.28;
    if (g > 0.01){
      if (!tintCanvas){
        tintCanvas = document.createElement('canvas'); tintCanvas.width = 720; tintCanvas.height = 420;
        var tc = tintCanvas.getContext('2d'); tc.fillStyle = 'rgb(80,140,40)';
        for (var i = 0; i < N; i++) if (WATER[i]) tc.fillRect((i % GW) * 2, ((i / GW) | 0) * 2, 2, 2);
      }
      ctx.save(); ctx.globalAlpha = g; ctx.drawImage(tintCanvas, 0, 0); ctx.restore();
    }
  }
  var tintCanvas = null;
  function readingsOk(ph, cl){ return ph >= 7.3 && ph <= 7.7 && cl >= 1.5 && cl <= 3.5; }
  function fmt(n, d){ return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }

  // ================= speech bubbles and little effects =================
  var bubbleLayer = null, bubbles = [], fx = [], splashes = [];
  var NAME = {leva: 'leva', ari: 'Ari', m: 'M', mel: 'Mel'};
  function say(who, text, dur){
    if (!bubbleLayer || reduce) return;
    bubbles = bubbles.filter(function(b){ if (b.who === who){ b.el.remove(); return false; } return true; });
    var el = document.createElement('div'); el.className = 'bub bub-' + who;
    var nm = document.createElement('b'); nm.textContent = NAME[who]; el.appendChild(nm);
    el.appendChild(document.createTextNode(text));
    bubbleLayer.appendChild(el);
    bubbles.push({who: who, el: el, left: dur || Math.min(6.5, 1.8 + text.length * 0.055)});
    spoke(who, text);
  }
  // a conversation: lines play one after another, each waits for the last to be read
  var threads = [];
  function convo(lines, urgent){
    var th = {items: lines.map(function(l){ return {who: l[0], text: l[1], pause: l[2] || 0, fn: l[3]}; }), wait: 0, born: W.clock};
    if (urgent){
      var who = {}; th.items.forEach(function(i){ if (i.who) who[i.who] = 1; });
      threads.forEach(function(t){ t.items = t.items.filter(function(i){ return !who[i.who]; }); });
    }
    threads.push(th);
  }
  function speaking(who){ for (var i = 0; i < bubbles.length; i++) if (bubbles[i].who === who && bubbles[i].left > 0.5) return true; return false; }
  function talkStep(dt){
    threads = threads.filter(function(th){
      if (th.wait > 0){ th.wait -= dt; return true; }
      if (!th.items.length || W.clock - th.born > 30) return false;
      var it = th.items[0];
      if (it.who && kids[it.who] && !kids[it.who].here){ th.items.shift(); return true; }
      if (it.who && speaking(it.who) && !th.mine) return true;
      th.items.shift(); th.mine = true;
      if (it.fn) it.fn();
      if (it.text){ say(it.who, it.text); th.wait = Math.min(5.5, 1.5 + it.text.length * 0.05) + it.pause; }
      else th.wait = it.pause;
      return true;
    });
  }
  function bubbleStep(dt){
    bubbles = bubbles.filter(function(b){
      b.left -= dt;
      if (b.left <= 0){ b.el.classList.add('bye'); setTimeout(function(){ b.el.remove(); }, 250); return false; }
      var a = ACT[b.who], p = a ? headOf(a) : null;
      if (!p){ b.el.style.display = 'none'; return true; }
      b.el.style.display = ''; b.el.style.left = p[0] + 'px'; b.el.style.top = p[1] + 'px';
      return true;
    });
  }
  function headOf(a){
    if (a.id === 'leva'){
      if (lv.hidden){ var pl = PLACES[B.inside || 'pump']; return [pl.door[0] * 2, pl.door[1] * 2 - 30]; }
      return [lv.x * 2, lv.y * 2 - 60];
    }
    if (a.hidden) return null;
    var h = a.id === 'ari' ? (a.inWater ? 16 : 26) : (a.inWater ? 24 : (a.pose === 'sit' ? 30 : 36));
    return [a.x * 2, a.y * 2 - h];
  }
  function heart(x, y){ fx.push({k: 'heart', x: x, y: y, t: 0, life: 1.4}); }
  function drops(x, y, n){ for (var i = 0; i < n; i++){ var a = Math.random() * 6.28, v = 30 + Math.random() * 40; fx.push({k: 'drop', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 25, t: 0, life: 0.7 + Math.random() * 0.3}); } }
  function zzz(x, y){ fx.push({k: 'z', x: x, y: y, t: 0, life: 2.4}); }
  function splash(x, y, big){ splashes.push({x: x, y: y, t: 0, big: !!big}); }
  function fxStep(dt, lc){
    fx = fx.filter(function(f){
      f.t += dt; if (f.t >= f.life) return false;
      var a = 1 - f.t / f.life;
      if (f.k === 'heart'){ drawHeartPx(lc, f.x * 2, f.y * 2 - 30 - f.t * 22, 2, a); }
      else if (f.k === 'drop'){ f.x += f.vx * dt / 2; f.y += f.vy * dt / 2; f.vy += 140 * dt; lc.fillStyle = 'rgba(170,225,255,' + a + ')'; lc.fillRect(Math.round(f.x * 2), Math.round(f.y * 2), 3, 3); }
      else if (f.k === 'z'){ lc.fillStyle = 'rgba(40,50,90,' + a + ')'; lc.font = '10px Silkscreen, monospace'; lc.fillText('z', f.x * 2 + 8 + f.t * 6, f.y * 2 - 18 - f.t * 12); }
      return true;
    });
  }
  function splashStep(dt, ctx){
    splashes = splashes.filter(function(s){
      s.t += dt; if (s.t > 0.75) return false;
      var n = Math.min(2, Math.floor(s.t * 4));
      api.draw('splash' + n, s.x - 10, s.y - 12);
      if (s.big && s.t < 0.5) api.draw('splash' + Math.min(2, n + 1), s.x - 14 + (s.t * 12 | 0), s.y - 16);
      return true;
    });
  }
  var HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  function drawHeartPx(c, cx, cy, px, alpha){
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
    var w = 7 * px, h = 6 * px, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    c.fillStyle = '#FF2E88';
    for (var r = 0; r < 6; r++) for (var q = 0; q < 7; q++) if (HEART[r][q] === 'X') c.fillRect(x0 + q * px, y0 + r * px, px, px);
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x0 + px, y0 + px, px, px);
    c.restore();
  }
  function beat(t){ var p = (t % 1.1) / 1.1; return p < 0.08 ? 1 + p / 0.08 * 0.18 : p < 0.16 ? 1.18 - (p - 0.08) / 0.08 * 0.18 : p < 0.3 ? 1 + (p - 0.16) / 0.14 * 0.09 : p < 0.4 ? 1.09 - (p - 0.3) / 0.1 * 0.09 : 1; }

  // ================= moving around =================
  function faceOf(dx, dy, prev){
    if (Math.abs(dx) > Math.abs(dy) * 1.15) return dx > 0 ? 'e' : 'w';
    if (Math.abs(dy) > Math.abs(dx) * 1.15) return dy > 0 ? 's' : 'n';
    return prev || 's';
  }
  function moveTo(a, tx, ty, speed, dt){
    var dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), m = speed * dt;
    if (d <= m){ a.x = tx; a.y = ty; return true; }
    a.x += dx / d * m; a.y += dy / d * m; a.face = faceOf(dx, dy, a.face); a.t += dt * speed / 13;
    return false;
  }
  function follow(a, dt, speed){
    if (!a.path || !a.path.length) return true;
    var p = a.path[0];
    if (moveTo(a, p[0], p[1], speed, dt)){ a.path.shift(); return !a.path.length; }
    return false;
  }
  function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }

  // steps a plan is made of. Every character runs the same little plan machine.
  function go(x, y, o){ return Object.assign({k: 'go', x: x, y: y}, o || {}); }
  function act(name, wait, o){ return Object.assign({k: 'act', act: name, wait: wait}, o || {}); }
  function fn(f){ return {k: 'fn', f: f}; }
  function wait(s){ return {k: 'act', act: null, wait: s}; }
  function until(c, max){ return {k: 'until', c: c, max: max || 30}; }
  function line(who, text){ return fn(function(){ say(who, text); }); }
  function runPlan(a, dt){
    if (a.wait > 0){
      a.wait -= dt; if (a.tick) a.tick(dt);
      if (a.wait > 0) return;
      a.wait = 0; a.tick = null; a.si++;
    }
    if (!a.plan || a.si >= a.plan.length){ a.plan = null; return 'done'; }
    var st = a.plan[a.si];
    if (st.k === 'go'){
      if (!st.started){ st.started = true; a.act = null; a.hidden = false; a.running = !!st.run; a.path = path(a.mask, a.x, a.y, st.x, st.y); if (st.tool !== undefined) a.tool = st.tool; }
      a.moving = true;
      var sp = st.speed || a.speed;
      if (follow(a, dt, sp)){ a.moving = false; if (st.face) a.face = st.face; a.si++; }
      return;
    }
    a.moving = false;
    if (st.k === 'straight'){
      if (!st.started){ st.started = true; a.act = null; if (st.show) a.hidden = false; }
      if (moveTo(a, st.x, st.y, st.speed || a.speed, dt)){ if (st.hide) a.hidden = true; a.si++; }
      return;
    }
    if (st.k === 'act'){
      a.act = st.act; if (st.face) a.face = st.face; a.hidden = !!st.hide; a.tick = st.tick || null;
      a.wait = typeof st.wait === 'function' ? st.wait() : st.wait; if (a.id === 'leva') lv.vt = 0;
      if (a.wait <= 0){ a.wait = 0; a.si++; }
      return;
    }
    if (st.k === 'fn'){ a.si++; st.f(a); return; }
    if (st.k === 'until'){ st.el = (st.el || 0) + dt; if (st.c(a) || st.el > st.max) a.si++; return; }
    if (st.k === 'custom'){ if (st.step(a, dt, st)) a.si++; return; }
  }
  function setPlan(a, steps){ a.plan = steps; a.si = 0; a.wait = 0; a.tick = null; a.path = null; a.act = null; a.moving = false; }

  // ================= the cast =================
  var api = null, lv = null, castImg = null, reduce = false, ready = false, T = 0;
  // leva's brain sits beside the leva object the page already draws
  var B = {id: 'leva', task: 'starting', inside: 'pump', lastPick: {}, talking: 0, thinking: false, rescue: null, busyLine: 0, walkRemind: 0, patrolFav: null};
  var ari = {id: 'ari', x: 262, y: 96, face: 'e', t: 0, mask: SMALL, speed: 16, task: 'waking up', inWater: false, pool: null, pose: 'stand', swimCool: 25, noticed: false, hold: 0};
  var kids = {
    m: {id: 'm', x: TOWELS.m[0], y: TOWELS.m[1], face: 's', t: 0, mask: SMALL, speed: 12, task: 'on her towel', pose: 'sit', inWater: false, pool: null, hidden: false, here: false, cool: 4},
    mel: {id: 'mel', x: TOWELS.mel[0], y: TOWELS.mel[1], face: 's', t: 0, mask: SMALL, speed: 11, task: 'on her towel', pose: 'sit', inWater: false, pool: null, hidden: false, here: false, cool: 9}
  };
  var ACT = {leva: B, ari: ari, m: kids.m, mel: kids.mel};
  var lesson = null;
  var KID_START = {lastLesson: -25, lastQ: 12, lastJ: 45, lastAri: 5};

  // ---------------- leva ----------------
  function levaPlan(steps, task){
    B.task = task; setPlan(B, steps);
  }
  function leaveBuilding(){
    if (!lv.hidden) return [];
    var pl = PLACES[B.inside] || PLACES.pump;
    return [fn(function(){ lv.x = pl.inside[0]; lv.y = pl.inside[1]; }), {k: 'straight', x: pl.door[0], y: pl.door[1], show: true, speed: 13}];
  }
  function enter(place, actName, secs, tick){
    var pl = PLACES[place];
    return [go(pl.door[0], pl.door[1]), {k: 'straight', x: pl.inside[0], y: pl.inside[1], hide: true, speed: 13},
      fn(function(){ B.inside = place; }), act(actName, secs, {hide: true, tick: tick})];
  }
  function out(place){ var pl = PLACES[place]; return {k: 'straight', x: pl.door[0], y: pl.door[1], show: true, speed: 13}; }

  function planTest(pool, why){
    var spots = KIT_SPOTS[pool], s = spots[Math.floor(Math.random() * spots.length)];
    return leaveBuilding().concat([
      go(s[0], s[1], {tool: null}),
      act('kit', 4.5, {face: s[2]}),
      fn(function(){ finishTest(pool, why); })
    ]);
  }
  function finishTest(pool, why){
    var ph = Math.round((W.ph + (Math.random() - 0.5) * 0.06) * 10) / 10, cl = Math.round((W.cl + (Math.random() - 0.5) * 0.1) * 10) / 10;
    W.measured = {ph: ph, cl: cl, at: Date.now(), clock: W.clock, pool: pool};
    W.lastTest = W.clock; MEM.today.tests++;
    var need = [];
    if (ph > 7.7) need.push('ph-down'); if (ph < 7.3) need.push('ph-up');
    if (cl < 1.5) need.push('cl-up'); if (cl > 3.5) need.push('cl-down');
    var read = 'pH ' + fmt(ph, 1) + ', chlorine ' + fmt(cl, 1) + ' ppm.';
    if (need.length){
      W.fixPending = {need: need, ph: ph, cl: cl};
      var what = need.indexOf('ph-down') >= 0 ? 'pH is running high.' : need.indexOf('ph-up') >= 0 ? 'pH is low.' : need.indexOf('cl-up') >= 0 ? 'Chlorine is low.' : 'Chlorine is high.';
      say('leva', read + ' ' + what + ' Pump room.');
      log('leva tested ' + POOLS[pool].name + '. ' + read + ' ' + what, 'leva');
    } else {
      say('leva', read + ' Good water.');
      log('leva tested ' + POOLS[pool].name + '. ' + read + ' All good.', 'leva');
    }
    if (why) why(ph, cl);
  }
  function planFix(){
    var f = W.fixPending;
    return leaveBuilding().concat(enter('pump', 'pump', 8)).concat([
      fn(function(){
        var bits = [];
        if (f.need.indexOf('ph-down') >= 0) bits.push('added a little acid to bring the pH down from ' + fmt(f.ph, 1));
        if (f.need.indexOf('ph-up') >= 0) bits.push('added soda ash to bring the pH up from ' + fmt(f.ph, 1));
        if (f.need.indexOf('cl-up') >= 0) bits.push('turned up the chlorine feeder from ' + fmt(f.cl, 1) + ' ppm');
        if (f.need.indexOf('cl-down') >= 0) bits.push('turned the chlorine feeder down from ' + fmt(f.cl, 1) + ' ppm');
        W.target = {ph: 7.5, cl: 2.4, left: 80}; W.fixPending = null; MEM.today.fixes++;
        log('leva ' + bits.join(' and ') + '.', 'leva');
      }),
      out('pump'),
      line('leva', 'Should read right in a couple minutes.')
    ]);
  }
  function planSkim(pool){
    var list = W.leaves.filter(function(l){ return l.pool === pool; });
    if (!list.length) return null;
    var got = 0, steps = leaveBuilding();
    list.sort(function(a, b){ return Math.hypot(a.x - lv.x, a.y - lv.y) - Math.hypot(b.x - lv.x, b.y - lv.y); });
    list.slice(0, 5).forEach(function(leaf){
      steps.push({k: 'custom', step: function(a, dt, st){
        if (W.leaves.indexOf(leaf) < 0) return true;
        if (!st.spot){ st.spot = snap(BIG, leaf.x, leaf.y); st.path = path(BIG, lv.x, lv.y, st.spot[0], st.spot[1]); B.tool = 'skim'; }
        if (st.path.length){ a.path = st.path; follow(a, dt, 11); B.net = null; return false; }
        // sweep the net out to the leaf
        st.el = (st.el || 0) + dt;
        var reach = Math.hypot(leaf.x - lv.x, leaf.y - lv.y);
        if (reach > 54){ return st.el > 0.5; }
        B.net = [leaf.x, leaf.y]; lv.face = faceOf(leaf.x - lv.x, leaf.y - lv.y, lv.face);
        if (st.el > 1.3){
          W.leaves = W.leaves.filter(function(l){ var hit = l === leaf || Math.hypot(l.x - leaf.x, l.y - leaf.y) < 9; if (hit) got++; return !hit; });
          B.net = null; return true;
        }
        return false;
      }});
    });
    steps.push(fn(function(){
      B.tool = null; B.net = null;
      if (got){ MEM.today.leaves += got; log('leva skimmed ' + got + (got === 1 ? ' leaf' : ' leaves') + ' off ' + POOLS[pool].name + '.', 'leva'); }
    }));
    return steps;
  }
  function planRescue(){
    var called = false;
    return leaveBuilding().concat([{k: 'custom', step: function(a, dt, st){
      if (!ari.inWater){ return true; }
      st.re = (st.re || 0) - dt;
      if (st.re <= 0 || !a.path){
        st.re = 1.1;
        st.spot = snap(BIG, ari.x, ari.y);
        a.path = path(BIG, lv.x, lv.y, st.spot[0], st.spot[1]);
      }
      var near = Math.hypot(ari.x - lv.x, ari.y - lv.y);
      if (a.path && a.path.length) follow(a, dt, 17);
      if (near < 30 && (!a.path || !a.path.length)){ liftAri(); return true; }
      return false;
    }}]);
  }
  function planReport(){ return leaveBuilding().concat(enter('office', 'report', 4)).concat([out('office'), fn(function(){ W.lastReport = W.clock; })]); }
  function planVac(){
    return leaveBuilding().concat([go(VAC[0], VAC[1], {tool: null}), act('vac', 14, {face: 'w', tick: function(dt){ W.dirt = Math.max(0, W.dirt - dt * 0.05); }}),
      fn(function(){ W.lastVac = W.clock; log('leva vacuumed the floor of the lap pool.', 'leva'); })]);
  }
  function planGate(){ return leaveBuilding().concat([go(GATE_SPOT[0], GATE_SPOT[1]), act('gate', 2.5, {face: 'n'}), fn(function(){ W.lastGate = today(); log('leva chained the park gate for the night.', 'leva'); })]); }
  function planPit(){ return leaveBuilding().concat(enter('pit', 'pit', 6 + Math.random() * 4)).concat([out('pit')]); }
  function planArcade(){ return leaveBuilding().concat(enter('arcade', 'arcade', 8 + Math.random() * 20)).concat([out('arcade')]); }
  function planRest(){ return leaveBuilding().concat(enter('pump', 'pump', api.isOpen() ? 5 + Math.random() * 4 : 8 + Math.random() * 8)).concat([out('pump')]); }
  function planWatch(spotKey, secs){
    var s = SPOTS[spotKey], p = snap(BIG, s.deck[0] + (Math.random() - 0.5) * 20, s.deck[1] + (Math.random() - 0.5) * 12);
    var face = faceOf(s.water[0] - p[0], s.water[1] - p[1], 's');
    return leaveBuilding().concat([go(p[0], p[1], {tool: null}), act('watch', secs, {face: face})]);
  }
  function planKids(){
    var k = kids.m.inWater ? kids.m : kids.mel.inWater ? kids.mel : kids.m;
    var p = snap(BIG, k.x + (k.inWater ? 0 : 18), k.y + (k.inWater ? 0 : -10));
    return leaveBuilding().concat([go(p[0], p[1], {tool: null}), act('watch', 8 + Math.random() * 6, {face: faceOf(k.x - p[0], k.y - p[1], 's')})]);
  }
  function favSpot(){
    var best = null, n = 1;
    for (var k in MEM.leva.seen) if (MEM.leva.seen[k] > n){ n = MEM.leva.seen[k]; best = k; }
    return best;
  }
  function pickLeva(){
    var open = api.isOpen(), night = api.isNight(), C = W.clock, options = [];
    function add(name, score, planFn){ options.push({name: name, score: score + Math.random() * 8 - (B.lastPick[name] && C - B.lastPick[name] < 20 ? 25 : 0), plan: planFn}); }
    if (W.fixPending) add('fix', 70, function(){ return {steps: planFix(), task: 'adjusting the chemicals in the pump room'}; });
    var since = C - W.lastTest, every = open ? 150 : 240;
    add('test', since > every ? 42 + (since - every) / 10 : (W.lastTest < 0 && C > 14 ? 55 : 0), function(){ var p = ['lap', 'zero', 'dive'][Math.floor(Math.random() * 3)]; return {steps: planTest(p), task: 'testing ' + POOLS[p].name}; });
    var byPool = {}; W.leaves.forEach(function(l){ byPool[l.pool] = (byPool[l.pool] || 0) + 1; });
    var worst = null; for (var k in byPool) if (!worst || byPool[k] > byPool[worst]) worst = k;
    if (worst && byPool[worst] >= (open ? 3 : 2)) add('skim', 22 + byPool[worst] * 5, function(){ return {steps: planSkim(worst), task: 'skimming leaves off ' + POOLS[worst].name}; });
    if (open) add('report', C - W.lastReport > 220 ? 36 : 0, function(){ return {steps: planReport(), task: 'reporting to the office'}; });
    if (!open && W.lastGate !== today()) add('gate', 48, function(){ return {steps: planGate(), task: 'chaining the park gate'}; });
    if (!open && W.dirt > 0.25 && C - W.lastVac > 240) add('vac', 34 + W.dirt * 20, function(){ return {steps: planVac(), task: 'vacuuming the lap pool'}; });
    var fav = favSpot();
    if (fav && !ari.inWater) add('patrol', 20, function(){ return {steps: planWatch(fav, 10 + Math.random() * 8), task: 'keeping an eye on ' + SPOT_NAME[fav]}; });
    if (open && (kids.m.inWater || kids.mel.inWater)) add('kids', 24, function(){ return {steps: planKids(), task: 'watching M and Mel swim'}; });
    if (!open){ add('pit', 10, function(){ return {steps: planPit(), task: 'checking the pit'}; }); if (night) add('arcade', 9, function(){ return {steps: planArcade(), task: 'playing invaders in the guard shack'}; }); }
    add('rest', 12, function(){ return {steps: planRest(), task: 'checking the pumps'}; });
    options.sort(function(a, b){ return b.score - a.score; });
    for (var i = 0; i < options.length; i++){
      var o = options[i], p = o.plan();
      if (p && p.steps){ B.lastPick[o.name] = C; levaPlan(p.steps, p.task); return; }
    }
  }
  function stepLeva(dt){
    if (!ready) return;
    dt *= FAST;
    if (B.talking > 0){
      B.talking -= dt;
      if (!B.rescue){
        lv.act = 'talk'; lv.hidden = false;
        lv.face = B.talkTo ? faceOf(B.talkTo.x - lv.x, B.talkTo.y - lv.y, 's') : 's';
        if (B.talking <= 0){ B.talkTo = null; syncLeva(); }
        return;
      }
    }
    if (runPlan(B, dt) === 'done'){ B.rescue = null; pickLeva(); }
    syncLeva();
  }
  // B carries the plan; lv is the object the page draws. Keep them in step.
  function syncLeva(){ lv.act = B.act || null; lv.hidden = !!B.hidden; lv.face = B.face || lv.face; lv.x = B.x; lv.y = B.y; lv.tool = B.tool || null; lv.net = B.net || null; lv.thinking = B.thinking; }
  Object.defineProperty(B, 'x', {get: function(){ return lv.x; }, set: function(v){ lv.x = v; }});
  Object.defineProperty(B, 'y', {get: function(){ return lv.y; }, set: function(v){ lv.y = v; }});
  Object.defineProperty(B, 't', {get: function(){ return lv.t; }, set: function(v){ lv.t = v; }});
  B.mask = BIG; B.speed = 13;

  // ---------------- Ari ----------------
  var RESCUE = [
    {call: [['leva', 'Ari. Out of the pool.'], ['ari', 'Five more minutes?']], after: [['leva', 'Zero more minutes.']]},
    {call: [["leva", "Ari, beagles aren't allowed in the pool."], ['ari', "I'm not a beagle. I'm a lifeguard."]], after: [['leva', 'Lifeguards have whistles.'], ['ari', 'I have a collar.']]},
    {call: [['leva', 'Ari. We talked about this.'], ["ari", "We did? I wasn't listening."]], after: [['leva', 'I know, buddy.']]},
    {call: [['leva', 'Out, buddy. Rules are rules.'], ['ari', 'Who wrote the rules?']], after: [["leva", "I did. They're on the sign by the front counter."]]},
    {when: 'vac', call: [['leva', 'Ari. I just vacuumed that.'], ['ari', "And I'm helping. Doggy paddle."]], after: [["leva", "That's not how that works."]]},
    {call: [['leva', 'Fur in the filter again, Ari?'], ['ari', "It's fur. Very different from hair."]], after: [["leva", "Not to the filter it isn't."]]},
    {call: [['leva', 'Ari, out. You know the rule.'], ['ari', 'The sign says no running. I was swimming.']], after: [['leva', 'Nice try. Out.']]},
    {when: 'zero', call: [["leva", "Ari, it's the zero depth, not zero rules."], ['ari', 'Worth a shot.']], after: [['leva', 'It always is with you.']]},
    {when: 'night', call: [["leva", "Ari, it's after close."], ['ari', "That's when the water's warmest."]], after: [['leva', 'Still no.']]},
    {when: 'fav', call: [["leva", "Knew you'd be here."], ['ari', 'How?']], after: [["leva", "You always pick this spot. I pay attention."]]},
    {when: 'sit', call: [['leva', 'Ari. Out.'], ['ari', 'Sitting! Mel taught me.']], after: [['leva', 'Out first. Then sit.']]}
  ];
  var AFTER = [
    [['leva', "Let's get you dried off."]],
    [['leva', 'Thanks, buddy. Really.'], ['ari', "You're welcome!"]],
    [['ari', 'Can I get my own pool?'], ["leva", "Maybe a kiddie pool. Once it's in the budget."]],
    [['leva', 'Good boy. Now stay on the deck.'], ['ari', 'Define stay.']]
  ];
  var lastRescue = -1;
  function pickRescue(spot){
    var fav = favSpot(), night = !api.isOpen();
    var ok = RESCUE.filter(function(r, i){
      if (i === lastRescue) return false;
      if (r.when === 'zero') return spot === 'zero';
      if (r.when === 'vac') return W.clock - W.lastVac < 600;
      if (r.when === 'night') return night;
      if (r.when === 'fav') return fav === spot;
      if (r.when === 'sit') return MEM.ari.sit >= 1;
      return true;
    });
    var r = ok[Math.floor(Math.random() * ok.length)] || RESCUE[0]; lastRescue = RESCUE.indexOf(r); return r;
  }
  function ariPlan(steps, task){ ari.task = task; setPlan(ari, steps); }
  function pickSpot(){
    // Ari weighs what has worked for him, and how far each spot is from leva right now
    var keys = Object.keys(SPOTS), ws = keys.map(function(k){
      var s = SPOTS[k], far = lv.hidden ? 1 : Math.min(1, Math.hypot(s.deck[0] - lv.x, s.deck[1] - lv.y) / 160);
      return Math.exp(3 * MEM.ari.spots[k]) * (0.3 + far);
    });
    var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum;
    for (var i = 0; i < keys.length; i++){ r -= ws[i]; if (r <= 0) return keys[i]; }
    return keys[0];
  }
  function planSneak(){
    var key = pickSpot(), s = SPOTS[key];
    ari.spot = key;
    return [
      go(s.deck[0], s.deck[1], {speed: 19}),
      {k: 'custom', step: function(a, dt, st){ return hop(a, dt, st, s.water, 'swim', false); }},
      fn(function(){ a_inWater(key); }),
      {k: 'custom', step: function(a, dt, st){
        // paddle around near the edge; swim toward leva once he is on his way
        st.el = (st.el || 0) + dt;
        if (!ari.inWater) return true;
        if (ari.hold > 0){ ari.hold -= dt; return false; }
        if (B.rescue && Math.hypot(lv.x - ari.x, lv.y - ari.y) < 90){
          var tgt = snap(SWIM, lv.x, lv.y);
          if (poolAt(tgt[0], tgt[1]) === s.pool) moveTo(a, tgt[0], tgt[1], 7, dt);
          return false;
        }
        if (!st.tgt || moveTo(a, st.tgt[0], st.tgt[1], 6, dt)) st.tgt = randomWater(s.pool, s.water, 26);
        if (st.el > 40){ climbOut(s); return true; }
        return false;
      }}
    ];
  }
  function a_inWater(key){
    ari.inWater = true; ari.pool = SPOTS[key].pool; ari.noticed = false; ari.enterClock = W.clock; ari.pose = 'swim';
    ari.task = 'swimming in ' + SPOT_NAME[key] + '. Not allowed.';
    MEM.today.ariSwims++; boardDirty = true;
  }
  function climbOut(s){
    // nobody came, so he let himself out
    var secs = W.clock - ari.enterClock;
    learnSpot(ari.spot, secs);
    ari.inWater = false; ari.pose = 'stand';
    var p = snap(SMALL, s.deck[0], s.deck[1]); ari.x = p[0]; ari.y = p[1];
    drops(ari.x, ari.y - 6, 10); splash(ari.x, ari.y - 4);
    log('Ari swam in ' + SPOT_NAME[ari.spot] + ' for ' + Math.round(secs) + ' seconds and let himself out.', 'ari');
    ariPlan([act('shake', 1.2), wait(1)], 'drying off');
  }
  function learnSpot(key, secs){
    var r = Math.min(1, secs / 30), before = bestSpot();
    MEM.ari.spots[key] += 0.35 * (r - MEM.ari.spots[key]);
    MEM.today.ariTime += secs;
    var after = bestSpot();
    if (after && after !== before && MEM.ari.best !== after){
      MEM.ari.best = after;
      log('Ari has figured out ' + SPOT_NAME[after] + ' gets him the most swim time. He goes there first now.', 'ari');
    }
  }
  function bestSpot(){
    var best = null, v = -1, second = -1;
    for (var k in MEM.ari.spots){ var s = MEM.ari.spots[k]; if (s > v){ second = v; v = s; best = k; } else if (s > second) second = s; }
    return v - second > 0.12 ? best : null;
  }
  function liftAri(){
    var secs = W.clock - ari.enterClock, key = ari.spot;
    learnSpot(key, secs);
    MEM.leva.seen[key] = (MEM.leva.seen[key] || 0) + 1;
    var fav = favSpot();
    if (fav && MEM.leva.watch !== fav){ MEM.leva.watch = fav; log('leva noticed Ari keeps picking ' + SPOT_NAME[fav] + '. He is watching it closer now.', 'leva'); }
    // up and out, next to leva, on the deck side
    var p = snap(SMALL, lv.x + (lv.face === 'w' ? 12 : lv.face === 'e' ? -12 : 10), lv.y + (lv.face === 'n' ? 10 : lv.face === 's' ? -8 : 4));
    var r = B.rescue;
    ariPlan([
      {k: 'custom', step: function(a, dt, st){ return hop(a, dt, st, p, 'lift', true); }},
      fn(function(){ ari.inWater = false; ari.pose = 'stand'; ari.face = ari.x < lv.x ? 'e' : 'w'; drops(ari.x, ari.y - 6, 12); }),
      act('shake', 1.3, {tick: function(){ if (Math.random() < 0.3) drops(ari.x, ari.y - 6, 2); }}),
      act(MEM.ari.sit >= 1 ? 'sit' : 'happy', 3.2),
      wait(0.5)
    ], 'drying off');
    MEM.today.reminders++;
    log('Ari snuck into ' + SPOT_NAME[key] + '. leva had him out in ' + Math.round(secs) + ' seconds.', 'leva');
    var tail = (r && r.after) || [];
    var extra = AFTER[Math.floor(Math.random() * AFTER.length)];
    if (MEM.ari.paw >= 1 && Math.random() < 0.5) extra = [['ari', 'Shake?'], ['leva', 'Nice try.']];
    convo([[null, null, 1.2]].concat(tail).concat(Math.random() < 0.6 ? extra : []));
    ari.swimCool = (api.isOpen() ? 50 : 70) + Math.random() * 50;
  }
  // a hop from the deck into the water, or back out, with a little arc and a splash
  function hop(a, dt, st, to, kind, outOfWater){
    if (!st.from){ st.from = [a.x, a.y]; st.t = 0; a.hopping = kind; a.face = faceOf(to[0] - a.x, to[1] - a.y, a.face); }
    st.t += dt / (kind === 'tuck' ? 0.75 : 0.55);
    var t = Math.min(1, st.t);
    a.x = st.from[0] + (to[0] - st.from[0]) * t; a.y = st.from[1] + (to[1] - st.from[1]) * t;
    a.lift = Math.sin(t * Math.PI) * (kind === 'tuck' ? 16 : 9);
    if (t >= 1){ a.lift = 0; a.hopping = null; if (!outOfWater) splash(to[0], to[1], kind === 'tuck'); return true; }
    return false;
  }
  function pickAri(){
    var open = api.isOpen(), night = api.isNight();
    var levaFar = lv.hidden || Math.hypot(lv.x - ari.x, lv.y - ari.y) > 70;
    if (ari.swimCool <= 0 && levaFar && !B.rescue && Math.random() < 0.6) return ariPlan(planSneak(), 'up to something');
    var r = Math.random(), kidsHere = kids.m.here && !kids.m.inWater && !lesson;
    if (kidsHere && r < 0.22){
      var k = Math.random() < 0.6 ? kids.mel : kids.m;
      var p = snap(SMALL, k.x + 12, k.y + 2);
      return ariPlan([go(p[0], p[1], {speed: 18}), fn(function(){ ari.face = 'w'; }), act('happy', 4 + Math.random() * 3)], 'visiting ' + NAME[k.id]);
    }
    if (!lv.hidden && r < 0.5){
      return ariPlan([{k: 'custom', step: function(a, dt, st){
        st.el = (st.el || 0) + dt; if (lv.hidden || st.el > 18 + Math.random() * 2) return true;
        var d = Math.hypot(lv.x - a.x, lv.y - a.y);
        if (d > 20){ st.re = (st.re || 0) - dt; if (st.re <= 0 || !a.path || !a.path.length){ st.re = 0.8; a.path = path(SMALL, a.x, a.y, lv.x - 12, lv.y + 4); } a.moving = true; follow(a, dt, 17); }
        else { a.moving = false; a.face = lv.x > a.x ? 'e' : 'w'; }
        return false;
      }}], 'following leva');
    }
    if ((night || !open) && r < 0.75){
      var den = snap(SMALL, 262 + Math.random() * 16, 92);
      return ariPlan([go(den[0], den[1], {speed: 12}), act('sleep', 18 + Math.random() * 24, {tick: function(){ if (Math.random() < 0.02) zzz(ari.x, ari.y); }})], 'napping by the pump room');
    }
    if (r < 0.62 && !night){
      var shade = [[208, 76], [122, 284], [192, 376]][Math.floor(Math.random() * 3)], sp = snap(SMALL, shade[0] + 10, shade[1] + 6);
      return ariPlan([go(sp[0], sp[1], {speed: 12}), act('sleep', 12 + Math.random() * 12, {tick: function(){ if (Math.random() < 0.015) zzz(ari.x, ari.y); }})], 'napping in the shade');
    }
    var tx = ari.x + (Math.random() - 0.5) * 160, ty = ari.y + (Math.random() - 0.5) * 110, q = snap(SMALL, tx, ty);
    ariPlan([go(q[0], q[1], {speed: 14}), act('sniff', 1.5 + Math.random() * 2.5)], 'sniffing around the deck');
  }
  function stepAri(dt){
    ari.swimCool -= dt;
    if (runPlan(ari, dt) === 'done') pickAri();
    // leva notices a beagle in the pool: right away if he can see it, a little later if he only hears it
    if (ari.inWater && !ari.noticed){
      ari.noticeT = (ari.noticeT || 0) + dt;
      var d = Math.hypot(lv.x - ari.x, lv.y - ari.y), fav = MEM.leva.watch === ari.spot;
      var need = lv.hidden ? 10 : d < 120 ? 3 : d < 220 ? 5 : 7;
      if (fav) need *= 0.6;
      if (ari.noticeT > need){
        ari.noticed = true; ari.noticeT = 0;
        var r = pickRescue(ari.spot); B.rescue = r;
        levaPlan(planRescue(), 'getting Ari out of the pool');
        convo(r.call, true);
      }
    }
    if (ari.act === 'sit' || ari.act === 'sleep') ari.pose = ari.act; else if (!ari.inWater) ari.pose = 'stand';
  }

  // ---------------- M and Mel ----------------
  var SKILL = {cannonball: {spot: 'dive', verb: 'the cannonball'}, float: {spot: 'zero', verb: 'the back float'}, handstand: {spot: 'lapN', verb: 'the handstand'}};
  var QA = [
    ['Why does the pool smell like chlorine?', "That smell is chloramines. It means the chlorine's busy. Clean water barely smells."],
    ['What is pH?', 'How acid or base the water is. We keep it between 7.2 and 7.8. Easy on your eyes.', 'test'],
    ['Why do my eyes sting?', "Usually it's the pH, not the chlorine. I'll check it.", 'test'],
    ['How deep is the diving well?', 'Twelve feet. Feet first until you know the water.'],
    ["Why can't we run on the deck?", 'Wet concrete is slick. Most pool injuries happen on the deck, not in the water.'],
    ['Where does the water go?', 'Drains and skimmers, through the pump, through the filters, back out the returns.'],
    ['Can Ari swim with us?', "Not in this pool. Dog fur clogs the filters. And rules are rules."],
    ['What does a lifeguard look for?', "Somebody quiet and upright who isn't getting anywhere. Drowning is usually silent."],
    ['What are the ropes for?', "Lane lines. They calm the waves so swimmers go faster."],
    ['Why do you test the water so much?', "Sun and swimmers use up chlorine all day. You can't fix what you don't measure."]
  ];
  var JOKES = [
    ['Why do fish live in salt water?', 'Because pepper makes them sneeze!'],
    ['What do you call a dog that does magic?', 'A labracadabrador!'],
    ['Why did the oyster not share?', 'Because it was shellfish!'],
    ['What did the ocean say to the beach?', 'Nothing. It just waved!']
  ];
  function kidPlan(k, steps, task){ k.task = task; setPlan(k, steps); }
  function swimSteps(k, spotKey, secs, show){
    var s = SPOTS[spotKey];
    var steps = [
      kidGo(k, s.deck[0] + (k.id === 'm' ? -6 : 6), s.deck[1]),
      {k: 'custom', step: function(a, dt, st){ if (!st.to) st.to = randomWater(s.pool, s.water, 8); return hop(a, dt, st, st.to, show === 'cannonball' ? 'tuck' : 'hop', false); }},
      fn(function(){ k.inWater = true; k.pool = s.pool; k.pose = 'swim'; })
    ];
    if (show === 'float') steps.push(act('float', 5));
    if (show === 'handstand') steps.push(act('handstand', 3.5));
    steps.push({k: 'custom', step: function(a, dt, st){
      st.el = (st.el || 0) + dt;
      if (!st.tgt || moveTo(a, st.tgt[0], st.tgt[1], 9, dt)) st.tgt = randomWater(s.pool, s.water, 36);
      return st.el > secs;
    }});
    steps.push({k: 'custom', step: function(a, dt, st){ return moveTo(a, s.water[0], s.water[1], 10, dt); }});
    steps.push({k: 'custom', step: function(a, dt, st){ if (!st.p) st.p = snap(SMALL, s.deck[0] + (k.id === 'm' ? -6 : 6), s.deck[1]); return hop(a, dt, st, st.p, 'hop', true); }});
    steps.push(fn(function(){ k.inWater = false; k.pool = null; k.pose = 'walk'; drops(k.x, k.y - 10, 6); }));
    return steps;
  }
  function towelSteps(k, secs){
    var t = TOWELS[k.id];
    return [kidGo(k, t[0], t[1]), fn(function(){ k.face = 's'; k.task = 'on her towel'; }), act('sit', secs)];
  }
  function kidGo(k, x, y){ var run = Math.random() < MEM[k.id].run; return go(x, y, {speed: run ? 26 : k.speed, run: run}); }
  function pickKid(k){
    if (!api.isOpen()){ leaveKid(k); return; }
    if (lesson && W.clock - lesson.at > 100) lesson = null;
    if (lesson) return;
    var other = k.id === 'm' ? kids.mel : kids.m, free = !other.plan || other.task === 'on her towel';
    var r = Math.random();
    // a lesson, when one of them knows something the other does not
    if (free && !other.inWater && r < 0.35 && W.clock - pickKid.lastLesson > 45){
      var gaps = Object.keys(SKILL).map(function(s){ return {s: s, gap: MEM[k.id][s] - MEM[other.id][s]}; }).filter(function(g){ return Math.abs(g.gap) > 0.3; });
      if (gaps.length){ var g = gaps[Math.floor(Math.random() * gaps.length)]; startLesson(g.gap > 0 ? k : other, g.gap > 0 ? other : k, g.s); return; }
    }
    if (k.id === 'mel' && r < 0.5 && !lv.hidden && !B.rescue && B.talking <= 0 && W.clock - pickKid.lastQ > 55){ pickKid.lastQ = W.clock; return askLeva(k); }
    if (k.id === 'm' && r < 0.45 && !lv.hidden && !B.rescue && B.talking <= 0 && MEM.leva.jokes.length < JOKES.length && W.clock - pickKid.lastJ > 90){ pickKid.lastJ = W.clock; return tellJoke(k); }
    if (r < 0.6 && !ari.inWater && ari.task !== 'up to something' && W.clock - pickKid.lastAri > 40){ pickKid.lastAri = W.clock; return trainAri(k); }
    if (r < 0.85){
      var spot = k.id === 'm' ? (Math.random() < 0.5 ? 'lapN' : 'lapS') : (Math.random() < 0.7 ? 'zero' : 'lapN');
      return kidPlan(k, swimSteps(k, spot, 14 + Math.random() * 16).concat(towelSteps(k, 6 + Math.random() * 6)), 'swimming in ' + POOLS[SPOTS[spot].pool].name);
    }
    kidPlan(k, towelSteps(k, 8 + Math.random() * 8), 'on her towel');
  }
  Object.assign(pickKid, KID_START);
  function startLesson(teacher, learner, skill){
    pickKid.lastLesson = W.clock;
    var sk = SKILL[skill], spot = sk.spot;
    lesson = {teacher: teacher, learner: learner, skill: skill, phase: 'gather', at: W.clock};
    var intro = {cannonball: [[teacher.id, NAME[learner.id] + ', watch this. Cannonball!']], float: [[teacher.id, 'Lie back. Point your toes. Like this.']], handstand: [[teacher.id, 'Handstand contest!']]}[skill];
    var tsk = 'teaching ' + NAME[learner.id] + ' ' + sk.verb, lsk = 'learning ' + sk.verb + ' from ' + NAME[teacher.id];
    var s = SPOTS[spot];
    kidPlan(teacher, [go(s.deck[0] - 6, s.deck[1], {speed: teacher.speed}), until(function(){ return !learner.plan || learner.si >= 1 && !learner.moving; }, 25),
      fn(function(){ convo(intro); }), wait(1.2)].concat(swimSteps(teacher, spot, 5, skill).slice(1, 3))
      .concat(skill === 'cannonball' ? [] : [act(skill, skill === 'float' ? 5 : 3.5)])
      .concat([fn(function(){ lesson.phase = 'try'; }), until(function(){ return lesson && lesson.phase === 'done'; }, 30)])
      .concat(swimSteps(teacher, spot, 8).slice(3)).concat(towelSteps(teacher, 8)), tsk);
    kidPlan(learner, [go(s.deck[0] + 8, s.deck[1], {speed: learner.speed}), until(function(){ return lesson && lesson.phase === 'try'; }, 40),
      fn(function(){ say(learner.id, 'Okay. My turn.'); }), wait(1)].concat(swimSteps(learner, spot, 5, skill).slice(1, 3))
      .concat(skill === 'cannonball' ? [] : [act(skill, skill === 'float' ? 4 : 3)])
      .concat([fn(function(){ finishLesson(); })]).concat(swimSteps(learner, spot, 8).slice(3)).concat(towelSteps(learner, 8)), lsk);
  }
  function finishLesson(){
    var L = lesson; if (!L) return;
    var m = MEM[L.learner.id], before = m[L.skill];
    m[L.skill] = Math.min(1, before + 0.14 + Math.random() * 0.12);
    var sk = SKILL[L.skill];
    if (m[L.skill] >= 1 && before < 1){
      var lines = {cannonball: [[L.learner.id, 'I did it! Did you see the splash?'], [L.teacher.id, 'Told you!']],
        float: [[L.learner.id, "I'm floating! Look!"], [L.teacher.id, 'Toes up. Perfect.']],
        handstand: [[L.learner.id, 'My legs were straight!'], [L.teacher.id, 'They were! Mostly!']]}[L.skill];
      convo(lines);
      if (!lv.hidden && Math.hypot(lv.x - L.learner.x, lv.y - L.learner.y) < 200) convo([['leva', 'Nice work, ' + NAME[L.learner.id] + '.']]);
      log(NAME[L.learner.id] + ' learned ' + sk.verb + ' from ' + NAME[L.teacher.id] + '.', L.learner.id);
    } else {
      var tries = {cannonball: [[L.learner.id, 'That was more of a belly flop.'], [L.teacher.id, 'Again! Tuck your knees.']],
        float: [[L.learner.id, 'I keep sinking.'], [L.teacher.id, 'Chin up. Breathe in.']],
        handstand: [[L.learner.id, 'Were my legs straight?'], [L.teacher.id, 'They were a little straight.']]}[L.skill];
      convo(tries);
      log(NAME[L.learner.id] + ' practiced ' + sk.verb + ' with ' + NAME[L.teacher.id] + '. Getting closer.', L.learner.id);
    }
    L.phase = 'done'; save();
    setTimeout(function(){ if (lesson === L) lesson = null; }, 4000);
  }
  function approach(k, target, near, dx, giveUp){
    return {k: 'custom', step: function(a, dt, st){
      st.el = (st.el || 0) + dt;
      if (giveUp() || st.el > 30){ st.failed = true; k.missed = true; return true; }
      st.re = (st.re || 0) - dt;
      var t = target();
      if (st.re <= 0 || !a.path || !a.path.length){ st.re = 1; var p = snap(SMALL, t.x + dx, t.y + 4); a.path = path(SMALL, a.x, a.y, p[0], p[1]); }
      a.moving = true; follow(a, dt, a.speed);
      if (Math.hypot(t.x - a.x, t.y - a.y) < near){ k.missed = false; return true; }
      return false;
    }};
  }
  function askLeva(k){
    var q = QA[(MEM.mel.facts + Math.floor(Math.random() * 3)) % QA.length];
    kidPlan(k, [
      approach(k, function(){ return lv; }, 22, 14, function(){ return lv.hidden || !!B.rescue; }),
      fn(function(){
        if (k.missed) return;
        k.face = lv.x > k.x ? 'e' : 'w'; if (!lv.hidden && !B.rescue){ B.talking = Math.max(B.talking, 7); B.talkTo = k; B.talkWith = 'Mel'; }
        convo([['mel', 'leva? ' + q[0]], ['leva', q[1], 0, function(){
          MEM.mel.facts++;
          if (q[2] === 'test' && !B.rescue){ setTimeout(function(){ levaPlan(planTest('zero'), 'testing the zero depth for Mel'); }, 2500); }
        }]]);
        log('Mel asked leva: ' + q[0] + ' He told her.', 'mel');
      }),
      act('listen', 7),
      fn(function(){ if (MEM.mel.facts >= 3 && Math.random() < 0.5) convo([['mel', 'M, did you know pH should be 7.2 to 7.8?'], ['m', 'Nerd.'], ['mel', 'Smart nerd.']]); })
    ].concat(towelSteps(k, 6)), 'asking leva a question');
  }
  function tellJoke(k){
    var j = JOKES[MEM.leva.jokes.length % JOKES.length];
    kidPlan(k, [
      approach(k, function(){ return lv; }, 22, -14, function(){ return lv.hidden || !!B.rescue; }),
      fn(function(){
        if (k.missed) return;
        k.face = lv.x > k.x ? 'e' : 'w'; if (!lv.hidden && !B.rescue){ B.talking = Math.max(B.talking, 9); B.talkTo = k; B.talkWith = 'M'; }
        convo([['m', 'leva! ' + j[0]], ["leva", "I don't know. Why?"], ['m', j[1]], ['leva', "Ha. I'm keeping that one.", 0, function(){
          if (MEM.leva.jokes.indexOf(j[0]) < 0){ MEM.leva.jokes.push(j[0]); log('M taught leva a joke. He is keeping it.', 'm'); }
        }]]);
      }),
      act('listen', 9)
    ].concat(towelSteps(k, 6)), 'telling leva a joke');
  }
  function trainAri(k){
    var trick = k.id === 'mel' ? 'sit' : 'paw';
    kidPlan(k, [
      approach(k, function(){ return ari; }, 18, 12, function(){ return ari.inWater || !!ari.hopping; }),
      fn(function(){
        if (k.missed){
          // Ari went in the pool instead. The kids tell on him.
          if (ari.inWater && !ari.noticed){ convo([[k.id, "leva! Ari's in the pool again!"]]); ari.noticeT = 99; log(NAME[k.id] + ' told on Ari.', k.id); }
          return;
        }
        ariPlan([act(null, 8)], 'playing with ' + NAME[k.id]);
        k.face = ari.x > k.x ? 'e' : 'w'; ari.face = k.x > ari.x ? 'e' : 'w';
        var p = MEM.ari[trick], ok = Math.random() < Math.max(0.3, p);
        MEM.ari[trick] = Math.min(1, p + (ok ? 0.2 : 0.1));
        var cmd = trick === 'sit' ? 'Ari, sit!' : 'Ari, shake!';
        var reply = ok ? (trick === 'sit' ? 'Did I do it?' : 'Like this?') : (trick === 'sit' ? 'Sit? I thought you said snack.' : 'Is it snack time?');
        convo([[k.id, cmd], ['ari', reply, 0, function(){ if (ok) ari.act = trick === 'sit' ? 'sit' : 'happy'; heart(ari.x, ari.y); }], [k.id, ok ? 'Good boy!' : 'Close enough. Good boy.']]);
        if (MEM.ari[trick] >= 1 && p < 1) log(NAME[k.id] + ' taught Ari to ' + (trick === 'sit' ? 'sit' : 'shake') + '. He tries it on leva now.', k.id);
        heart(k.x, k.y);
      }),
      act('listen', 6)
    ].concat(towelSteps(k, 6)), 'teaching Ari a trick');
  }
  function leaveKid(k){
    if (!k.here) return;
    if (k.leaving) return;
    k.leaving = true; lesson = null;
    var steps = [];
    if (k.inWater){ steps = [{k: 'custom', step: function(a, dt, st){ if (!st.p){ st.p = snap(SMALL, a.x, a.y); } return hop(a, dt, st, st.p, 'hop', true); }}, fn(function(){ k.inWater = false; k.pose = 'walk'; })]; }
    if (k.id === 'm') convo([['m', 'Bye leva! Bye Ari!'], ['leva', 'See you tomorrow. Walk to the gate.']]);
    kidPlan(k, steps.concat([go(PLACES.gate.door[0], PLACES.gate.door[1] + (k.id === 'm' ? -3 : 3), {speed: 12}), {k: 'straight', x: PLACES.gate.inside[0], y: PLACES.gate.inside[1], hide: true, speed: 12},
      fn(function(){ k.here = false; k.hidden = true; k.leaving = false; k.task = 'home for the night'; })]), 'heading home');
  }
  function arriveKid(k, walkIn){
    k.here = true; k.hidden = false; k.leaving = false;
    if (!walkIn){ var t = TOWELS[k.id]; k.x = t[0]; k.y = t[1]; kidPlan(k, [fn(function(){ k.face = 's'; }), act('sit', k.cool)], 'on her towel'); return; }
    k.x = PLACES.gate.inside[0]; k.y = PLACES.gate.inside[1];
    kidPlan(k, [{k: 'straight', x: PLACES.gate.door[0], y: PLACES.gate.door[1], show: true, speed: 12}].concat(towelSteps(k, 5)), 'coming in');
    if (k.id === 'm') convo([['m', 'Morning, leva!'], ['leva', 'Morning. Walk, please.']]);
  }
  function stepKids(dt){
    var open = api.isOpen();
    ['m', 'mel'].forEach(function(id){
      var k = kids[id];
      if (open && !k.here) arriveKid(k, W.clock > 3);
      if (!open && k.here && !k.leaving) leaveKid(k);
      if (!k.here) return;
      if (runPlan(k, dt) === 'done') pickKid(k);
      // leva reminds anybody running on the deck
      if (k.moving && k.running && !k.inWater && !lv.hidden && !B.rescue && Math.hypot(lv.x - k.x, lv.y - k.y) < 150 && W.clock - B.walkRemind > 12){
        B.walkRemind = W.clock; k.running = false;
        if (k.plan && k.plan[k.si] && k.plan[k.si].k === 'go') k.plan[k.si].speed = k.speed;
        var lines = [['Walk, please.', 'Sorry, leva!'], ['Walking feet, ' + NAME[id] + '.', 'Okay!'], ['Easy. Wet deck.', 'Walking!']][Math.floor(Math.random() * 3)];
        convo([['leva', lines[0]], [id, lines[1]]], true);
        var before = MEM[id].run; MEM[id].run = Math.max(0.03, before * 0.75); MEM.today.reminders++;
        if (before >= 0.15 && MEM[id].run < 0.15) log(NAME[id] + ' walks on the deck now. Mostly. leva has been on her about it.', id);
      }
      if (k.act === 'sit') k.pose = 'sit'; else if (k.act === 'float') k.pose = 'float'; else if (k.act === 'handstand') k.pose = 'handstand';
      else if (k.inWater) k.pose = 'swim'; else k.pose = 'walk';
    });
  }

  // ================= drawing the cast =================
  function spr(c, name, X, Y, alpha){
    var a = CAST[name]; if (!a) return;
    if (alpha != null){ c.save(); c.globalAlpha = alpha; }
    c.drawImage(castImg, a[0], a[1], a[2], a[3], Math.round(X - a[4]), Math.round(Y - a[5]), a[2], a[3]);
    if (alpha != null) c.restore();
  }
  function shadow(c, X, Y, rx){ c.fillStyle = 'rgba(12,14,28,.2)'; c.beginPath(); c.ellipse(X + 1, Y + 1, rx, rx * 0.3, 0, 0, Math.PI * 2); c.fill(); }
  function ripple(c, X, Y, rx){
    var w = Math.sin(T * 3 + X) * 1.5;
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(X, Y, rx + w, (rx + w) * 0.32, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(X, Y + 1, rx + 6 + w, (rx + 6 + w) * 0.32, 0, 0, Math.PI * 2); c.stroke();
  }
  function drawAri(c){
    var X = ari.x * 2, Y = ari.y * 2 - (ari.lift || 0) * 2, f = Math.floor(ari.t * 5) % 2, side = ari.face === 'w' ? 'w' : 'e';
    if (ari.hopping === 'lift'){ spr(c, 'ari_s0', X, Y); return; }
    if (ari.inWater || ari.hopping === 'swim'){
      if (ari.hopping) { spr(c, 'ari_' + side + '0', X, Y); return; }
      ripple(c, X + (side === 'e' ? 6 : -6), Y, 16); spr(c, 'ari_swim_' + side + (Math.floor(T * 3) % 2), X, Y);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(X + (side === 'e' ? 14 : -18), Y - 2 + (Math.floor(T * 3) % 2), 4, 2); return;
    }
    shadow(c, X, Y, 12);
    if (ari.act === 'shake'){ spr(c, 'ari_' + side + '0', X + (Math.floor(T * 30) % 2 ? 1.5 : -1.5), Y); return; }
    if (ari.act === 'sleep'){ spr(c, 'ari_sleep_' + side, X, Y); return; }
    if (ari.act === 'sit'){ spr(c, 'ari_sit_' + side, X, Y); return; }
    if (ari.act === 'sniff'){ spr(c, 'ari_sniff_' + side, X, Y); return; }
    if (ari.act === 'happy' || (!ari.moving && ari.act)){ spr(c, 'ari_happy_' + side, X, Y); return; }
    if (!ari.moving){ spr(c, 'ari_' + side + '0', X, Y); return; }
    if (ari.face === 'n' || ari.face === 's') spr(c, 'ari_' + ari.face + f, X, Y);
    else spr(c, 'ari_' + side + f, X, Y);
  }
  function drawKid(c, k){
    if (!k.here || k.hidden) return;
    var X = k.x * 2, Y = k.y * 2 - (k.lift || 0) * 2, n = k.id, f = Math.floor(k.t * 4) % 2;
    if (k.hopping){ spr(c, n + (k.hopping === 'tuck' ? '_tuck' : '_s' + f), X, Y); return; }
    if (k.pose === 'float'){ spr(c, n + '_float', X, Y); ripple(c, X, Y + 1, 18); return; }
    if (k.pose === 'handstand'){
      c.fillStyle = '#f4cdb2'; c.fillRect(X - 5, Y - 18, 4, 16); c.fillRect(X + 1, Y - 18, 4, 16);
      c.fillStyle = '#dba887'; c.fillRect(X - 6, Y - 20, 5, 3); c.fillRect(X + 1, Y - 20, 5, 3);
      c.strokeStyle = '#2a1c18'; c.lineWidth = 1; c.strokeRect(X - 5.5, Y - 20.5, 11, 19);
      ripple(c, X, Y, 11); return;
    }
    if (k.inWater){ spr(c, n + '_swim' + (Math.floor(T * 2.4 + (n === 'm' ? 0 : 0.5)) % 2), X, Y); ripple(c, X, Y + 1, 13); return; }
    shadow(c, X, Y, 8);
    if (k.pose === 'sit'){ spr(c, n + '_sit', X, Y); return; }
    if (k.act === 'wave'){ spr(c, n + '_wave', X, Y); return; }
    spr(c, n + '_' + k.face + (k.moving ? f : ''), X, Y);
  }
  function drawTowels(ctx){
    if (!kids.m.here && !kids.mel.here) return;
    [['m', '#d7263b', '#ffffff'], ['mel', '#8fe0c0', '#ffffff']].forEach(function(t){
      var p = TOWELS[t[0]], x = Math.round(p[0] - 5), y = Math.round(p[1] - 12);
      ctx.fillStyle = 'rgba(20,24,40,.18)'; ctx.fillRect(x + 1, y + 1, 10, 16);
      for (var r = 0; r < 16; r++){ ctx.fillStyle = Math.floor(r / 2) % 2 ? t[2] : t[1]; ctx.fillRect(x, y + r, 10, 1); }
    });
  }
  function drawLevaExtras(c){
    if (lv.hidden) return;
    var X = lv.x * 2, Y = lv.y * 2;
    if (B.thinking){ var s = beat(T); drawHeartPx(c, X, Y - 70, 3 * s, 1); }
  }
  function drawCast(c){
    if (!ready) return false;
    var list = [{y: lv.y, d: function(){ lv.drawSelf(); drawLevaExtras(c); }}, {y: ari.y, d: function(){ drawAri(c); }}];
    ['m', 'mel'].forEach(function(id){ var k = kids[id]; list.push({y: k.y + (k.inWater ? -2 : 0), d: function(){ drawKid(c, k); }}); });
    list.sort(function(a, b){ return a.y - b.y; });
    list.forEach(function(o){ o.d(); });
    fxStep(lastDt, c);
    return true;
  }

  // ================= the loop =================
  var lastDt = 0, boardDirty = true, boardClock = 0;
  function step(dt, t){
    if (!ready) return;
    dt *= FAST;
    lastDt = dt; T += dt; W.clock += dt;
    var open = api.isOpen();
    chemStep(dt, open);
    drawTowels(api.ctx);
    drawLeaves(api.ctx);
    splashStep(dt, api.ctx);
    stepAri(dt);
    stepKids(dt);
    talkStep(dt);
    bubbleStep(dt);
    saveAt -= dt; if (saveAt <= 0){ saveAt = 20; MEM.chem = {ph: W.ph, cl: W.cl, measured: W.measured}; save(); }
    boardClock -= dt; if (boardClock <= 0 || boardDirty){ boardClock = 1; boardDirty = false; renderBoard(); }
  }

  // ================= the board under the map =================
  var board = null;
  function ago(ts){ if (!ts) return ''; var s = (Date.now() - ts) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' d ago'; }
  function clock(ts){ var d = new Date(ts); var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm'); }
  function gauge(el, v, lo, hi, okLo, okHi){
    if (!el) return;
    var pct = function(x){ return Math.max(0, Math.min(100, (x - lo) / (hi - lo) * 100)); };
    el.style.setProperty('--ok-l', pct(okLo) + '%'); el.style.setProperty('--ok-r', (100 - pct(okHi)) + '%');
    if (v == null){ el.classList.add('none'); return; }
    el.classList.remove('none'); el.style.setProperty('--v', pct(v) + '%');
    el.classList.toggle('off', v < okLo || v > okHi);
  }
  function renderBoard(){
    if (!board) return;
    var m = W.measured;
    board.ph.textContent = m ? fmt(m.ph, 1) : '--';
    board.cl.textContent = m ? fmt(m.cl, 1) : '--';
    gauge(board.phg, m ? m.ph : null, 6.8, 8.2, 7.2, 7.8);
    gauge(board.clg, m ? m.cl : null, 0, 5, 1, 3);
    board.tested.textContent = m ? 'Tested ' + ago(m.at) + ' at ' + POOLS[m.pool].name + '.' : 'Not tested yet. leva will get to it.';
    board.leaves.textContent = String(W.leaves.length);
    board.today.textContent = MEM.today.tests + (MEM.today.tests === 1 ? ' test' : ' tests') + ', ' + MEM.today.leaves + ' leaves skimmed, ' + MEM.today.ariSwims + (MEM.today.ariSwims === 1 ? ' beagle' : ' beagles') + ' pulled from the pool.';
    board.s.leva.textContent = B.talking > 0 && !B.rescue ? 'Talking with ' + (B.talkWith || 'you') : cap(B.task);
    board.s.ari.textContent = cap(ari.task);
    board.s.m.textContent = kids.m.here ? cap(kids.m.task) : 'Home for the night. Back when the pool opens.';
    board.s.mel.textContent = kids.mel.here ? cap(kids.mel.task) : 'Home for the night. Back when the pool opens.';
    board.k.leva.textContent = MEM.leva.watch ? 'Watches ' + SPOT_NAME[MEM.leva.watch] + ' closest. Knows ' + MEM.leva.jokes.length + (MEM.leva.jokes.length === 1 ? ' joke from M.' : ' jokes from M.') : (MEM.leva.jokes.length ? 'Knows ' + MEM.leva.jokes.length + (MEM.leva.jokes.length === 1 ? ' joke from M.' : ' jokes from M.') : 'Still learning where Ari likes to sneak in.');
    var tricks = []; if (MEM.ari.sit >= 1) tricks.push('sit, from Mel'); if (MEM.ari.paw >= 1) tricks.push('shake, from M');
    board.k.ari.textContent = (tricks.length ? 'Knows ' + tricks.join(' and ') + '. ' : 'Learning tricks from M and Mel. ') + (MEM.ari.best ? 'Favorite spot: ' + SPOT_NAME[MEM.ari.best] + '.' : 'Still picking a favorite spot.');
    board.k.m.textContent = skillLine('m');
    board.k.mel.textContent = skillLine('mel') + (MEM.mel.facts ? ' Has asked leva ' + MEM.mel.facts + (MEM.mel.facts === 1 ? ' question.' : ' questions.') : '');
    var items = MEM.log.slice(-7).reverse();
    var sig = items.map(function(i){ return i.t; }).join(',');
    if (sig !== board.sig){
      board.sig = sig; board.log.textContent = '';
      if (!items.length){ var li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Nothing yet today. Give it a minute.'; board.log.appendChild(li); }
      items.forEach(function(i){
        var li = document.createElement('li'), tm = document.createElement('time');
        li.className = 'w-' + i.who; tm.textContent = clock(i.t);
        li.appendChild(tm); li.appendChild(document.createTextNode(i.text)); board.log.appendChild(li);
      });
    }
  }
  function skillLine(id){
    var s = MEM[id], got = [], work = [];
    Object.keys(SKILL).forEach(function(k){ (s[k] >= 1 ? got : work).push(SKILL[k].verb.replace('the ', '')); });
    return (got.length ? 'Can do ' + got.join(', ') + '.' : '') + (work.length ? ' Working on ' + work.join(', ') + '.' : ' Knows every trick on the deck.');
  }
  function cap(s){ s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function spoke(who, text){ if (window.PoolLifeSpoke) window.PoolLifeSpoke(who, text); }

  // ================= setup =================
  function init(a){
    api = a; lv = a.leva; reduce = !!a.reduce;
    load();
    MEM.visits++;
    if (MEM.chem){ W.ph = MEM.chem.ph; W.cl = MEM.chem.cl; W.measured = MEM.chem.measured || null; }
    else { W.ph = 7.72 + Math.random() * 0.06; W.cl = 1.25 + Math.random() * 0.15; }
    // drift a little for the time you were gone, so there is something to do when you come back
    W.ph = Math.min(7.95, W.ph + 0.08); W.cl = Math.max(0.9, W.cl - 0.25);
    bubbleLayer = document.getElementById('bubbles');
    board = {
      ph: document.getElementById('b-ph'), cl: document.getElementById('b-cl'), phg: document.getElementById('g-ph'), clg: document.getElementById('g-cl'),
      tested: document.getElementById('b-tested'), leaves: document.getElementById('b-leaves'), today: document.getElementById('b-today'), log: document.getElementById('b-log'),
      s: {leva: document.getElementById('s-leva'), ari: document.getElementById('s-ari'), m: document.getElementById('s-m'), mel: document.getElementById('s-mel')},
      k: {leva: document.getElementById('k-leva'), ari: document.getElementById('k-ari'), m: document.getElementById('k-m'), mel: document.getElementById('k-mel')}
    };
    if (!board.ph) board = null;
    for (var i = 0; i < 4; i++){ var p = randomWater(['lap', 'lap', 'dive', 'zero'][i]); W.leaves.push({x: p[0], y: p[1], vx: 0, vy: 0, pool: ['lap', 'lap', 'dive', 'zero'][i], c: ['#6b8e23', '#8a6a3a', '#a7c957', '#b5651d'][i], k: i * 1.7}); }
    var im = new Image();
    im.onload = function(){
      castImg = im; ready = true;
      lv.hidden = false; lv.x = PLACES.pump.door[0]; lv.y = PLACES.pump.door[1]; lv.act = null;
      levaPlan([act('watch', 2.5, {face: 's'})], 'starting his rounds');
      var den = snap(SMALL, 270, 94); ari.x = den[0]; ari.y = den[1];
      ariPlan([act('happy', 3)], 'wagging');
      if (api.isOpen()){ arriveKid(kids.m, false); arriveKid(kids.mel, false); }
      else { kids.m.task = kids.mel.task = 'home for the night'; kids.m.hidden = kids.mel.hidden = true; }
      if (!MEM.log.length) log('A new day at Levagood Pool.', 'leva');
      if (MEM.visitor.name) setTimeout(function(){ say('leva', 'Welcome back, ' + MEM.visitor.name + '.'); }, 1800);
      renderBoard();
      if (reduce) staticFrame();
    };
    im.onerror = function(){ console.error('leva pool: could not load pool/cast.png'); };
    im.src = 'pool/cast.png?v=1';
    document.addEventListener('visibilitychange', function(){ if (document.hidden){ MEM.chem = {ph: W.ph, cl: W.cl, measured: W.measured}; save(); } });
  }
  function staticFrame(){
    // with reduced motion there is one still frame: leva on the deck, Ari by the pump room, M and Mel on their towels
    lv.hidden = false; lv.x = 263; lv.y = 109; lv.act = 'kit'; lv.face = 'e';
    ari.act = 'sleep';
    if (api.redraw) api.redraw();
  }

  // ================= what the chat can see and ask =================
  var chat = {
    snapshot: function(){
      var m = W.measured, fav = favSpot();
      return {
        open: api ? api.isOpen() : true, time: api ? (api.isNight() ? 'night' : api.isDusk() ? 'dusk' : 'day') : 'day',
        measured: m ? {ph: m.ph, cl: m.cl, pool: POOLS[m.pool].name, ago: ago(m.at)} : null,
        leaves: W.leaves.length, levaTask: B.task, levaHidden: lv ? lv.hidden : false,
        ari: {task: ari.task, inWater: ari.inWater, where: ari.inWater ? SPOT_NAME[ari.spot] : null, swims: MEM.today.ariSwims, best: MEM.ari.best ? SPOT_NAME[MEM.ari.best] : null, sit: MEM.ari.sit >= 1, paw: MEM.ari.paw >= 1},
        watch: fav ? SPOT_NAME[fav] : null,
        m: {here: kids.m.here, task: kids.m.task, skills: skillLine('m')}, mel: {here: kids.mel.here, task: kids.mel.task, skills: skillLine('mel'), facts: MEM.mel.facts},
        jokes: MEM.leva.jokes.map(function(q){ for (var i = 0; i < JOKES.length; i++) if (JOKES[i][0] === q) return JOKES[i]; return [q, '']; }), today: Object.assign({}, MEM.today),
        log: MEM.log.slice(-8).map(function(l){ return clock(l.t) + ' ' + l.text; }),
        visitor: MEM.visitor
      };
    },
    // the chat window opened or a message went out: leva stops and faces you
    attend: function(secs){
      if (!ready) return 'no';
      if (B.rescue) return 'busy';
      if (lv.hidden){ levaPlan(leaveBuilding().concat([act('talk', secs || 10, {face: 's'})]), 'coming out to talk'); B.talking = 0; return 'coming'; }
      B.talking = Math.max(B.talking, secs || 10); B.talkTo = null; B.talkWith = 'you'; return 'ok';
    },
    think: function(on){ B.thinking = !!on; if (on && !B.rescue){ B.talking = Math.max(B.talking, 12); B.talkTo = null; B.talkWith = 'you'; } },
    say: function(text){ if (ready) say('leva', text.length > 90 ? text.slice(0, 87).replace(/\s+\S*$/, '') + '...' : text); },
    // things you can ask leva to go do on the deck
    doTask: function(what){
      if (!ready) return false;
      if (B.rescue && what !== 'ari') return 'busy';
      B.talking = 0;
      if (what === 'test'){ var p = ['lap', 'zero', 'dive'][Math.floor(Math.random() * 3)]; levaPlan(planTest(p), 'testing ' + POOLS[p].name + ' for you'); return true; }
      if (what === 'skim'){ var pools = {}; W.leaves.forEach(function(l){ pools[l.pool] = (pools[l.pool] || 0) + 1; }); var w = Object.keys(pools).sort(function(a, b){ return pools[b] - pools[a]; })[0]; if (!w) return 'clean'; levaPlan(planSkim(w), 'skimming ' + POOLS[w].name + ' for you'); return true; }
      if (what === 'pump'){ levaPlan(planRest(), 'checking the pumps'); return true; }
      if (what === 'ari'){ if (ari.inWater){ ari.noticeT = 99; return true; } var p2 = snap(BIG, ari.x + 14, ari.y); levaPlan(leaveBuilding().concat([go(p2[0], p2[1]), act('watch', 5, {face: ari.x < p2[0] ? 'w' : 'e'})]), 'checking on Ari'); setTimeout(function(){ convo([['leva', 'Hey, buddy.'], ['ari', 'Hi! Are we swimming?'], ['leva', 'No.']]); }, 4000); return true; }
      if (what === 'wave'){ levaPlan(leaveBuilding().concat([act('talk', 4, {face: 's'})]), 'waving at you'); say('leva', 'Hey there!'); return true; }
      return false;
    },
    remember: function(k, v){ if (k === 'name'){ MEM.visitor.name = v; } if (k === 'topic'){ MEM.visitor.topics[v] = (MEM.visitor.topics[v] || 0) + 1; } if (k === 'chat') MEM.visitor.chats++; save(); },
    forget: function(){ MEM.visitor = {name: '', chats: 0, topics: {}}; save(); },
    ready: function(){ return ready; }
  };

  window.PoolLife = {init: init, step: step, drawCast: drawCast, stepLeva: stepLeva, chat: chat, drawHeart: drawHeartPx};
})();
