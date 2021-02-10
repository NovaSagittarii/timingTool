let PATH;
const { ipcRenderer } = window.require('electron');
ipcRenderer.on('DIR', (e, d) => PATH = d);
ipcRenderer.on('IMPORT', (e, d) => parse(d));
ipcRenderer.on('TITLE', (e, d) => document.title = "editing | " + d);
// ipcRenderer.on('AUDIO', (e, d) => parseAudio(d));

const SETTINGS = {
  INVERTED_SCROLL: false,
};

const Hitsound = require('./Hitsound.js');
const TimingPoint = require('./TimingPoint.js');

const ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
Hitsound.setAudioContext(ac);
const keys = [];
let songAudio, audioBuffer;
let currentTime, mouseTime;
let d = 2;      // divisor
let z = 1;      // zoom, ms/px
let yo;         // y offset
let VCache = new Uint16Array(4096), VCacheStart, VCacheEnd; // VisualizationCache
let VImage, VImageStart, VImageEnd;
let TP = [], aTP = [];

const metadata = {};
function parse(d){
  TP.splice(0);
  TP.push(new TimingPoint(null, -500, 500));
  let mode = '';
  d.split('\r\n').forEach(l => {
    if(l[0] === '[') metadata[mode = l.substring(1, l.length-1).toLowerCase()] = {};
    else if(!mode || !l) return;
    else {
      switch(mode){
        case "general":
        case "editor":
        case "metadata":
        case "difficulty":
          const v = l.split(':');
          metadata[mode][v[0]] = v[1].trim();
          break;
        case "timingpoints":
          if(l) TP.push(TimingPoint.fromString(TP[TP.length-1], l));
      }
    }
  });
  TP.splice(0, 1); // remove first one
  TP.sort(TimingPoint.sortByTime);
  aTP = TP.filter(tp => tp.i);
  ctp = TP[ctpi = 0];
  alignCurrentTimingPoint();
  // console.log(metadata);
  parseAudio('file://' + PATH + '/' + metadata.general.AudioFilename);
  // ipcRenderer.invoke('AUDIO', metadata.general.AudioFilename);
}
function parseAudio(url){
  songAudio = new Audio(url);
  fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => ac.decodeAudioData(arrayBuffer))
    .then(audioBuffer_ => {
      audioBuffer = audioBuffer_;
      buildWaveform(0);
      loop();
    });
  // https://css-tricks.com/making-an-audio-waveform-visualizer-with-vanilla-javascript/ actual godsend
}
function buildVCache(ms){
  VCacheStart = ms = Math.max(0, Math.floor(ms-height*z));
  const raw = audioBuffer.getChannelData(0);
  const blockSize = (audioBuffer.sampleRate / (1000/z))|0;
  const start = Math.floor(audioBuffer.sampleRate * ms / 1000 / blockSize)*blockSize;
  for(let i = 0; i < VCache.length; i ++){
    let sum = 0;
    for(let j = 0; j < blockSize; j ++) sum += Math.abs(raw[start + i*blockSize+j])
    VCache[i] = sum / blockSize * 65535;
  }
  VCacheEnd = VCacheStart + (VCache.length - 3*height)*z;
  console.log("cache built", VCacheStart, currentTime, VCacheEnd);
}
function buildVImage(ms, k){
  k = k || 1;
  /* TODO: probably could optimize by using 3 images instead of one big one but that requires EFFORT */
  if(ms < VCacheStart || ms > VCacheEnd) buildVCache(ms);
  VImageStart = (ms = Math.max(0, Math.floor(ms-height*z)));
  const img = createImage(100, height*3);
  const c = color(0, 90, 102);
  img.loadPixels();
  let y = img.height;
  const start = Math.floor((ms-VCacheStart)/z);
  for(let i = 0; i < height*3; i ++, y --)
    for(let x = Math.min(img.width, (k*VCache[start+i]/65535*200)|0); x >= 0; x --)
      img.set(x, y, c);

  img.updatePixels();
  VImage = img;
  VImageEnd = VImageStart + 2*height*z;
  console.log('image created', VImageStart, currentTime, VImageEnd);
}
function buildWaveform(ms, k){
  buildVCache(ms);
  buildVImage(ms, k || 1);
}

let ctp, ctpi, ctpStart, ctpEnd;
function alignCurrentTimingPoint(){
  let temp = ctpi;
  while(ctpi > 0 && currentTime < TP[ctpi].t) ctpi --;
  while(ctpi < TP.length-1 && currentTime >= TP[ctpi+1].t) ctpi ++;
  if(songAudio && !songAudio.paused && temp < ctpi) metronome.play();
  ctpStart = TP[ctpi].t;
  temp = TP[ctpi+1];
  ctpEnd = temp ? temp.t : Infinity;
}

function setup(){
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-wrapper');
  noLoop();

  frameRate(240);
  imageMode(CENTER);
  strokeCap(SQUARE);
  textAlign(CENTER, CENTER);
  rectMode(CENTER);
  drawingContext.imageSmoothingEnabled = false;
  yo = Math.min(height - 100, height - (height>>3))|0;

  console.log("AC Base latency %sms", (ac.baseLatency*1000)|0);
}

const metronome = new Hitsound('./assets/p.wav');
function keyPressed(){
  keys[keyCode] = true;
  if(!songAudio) return;
  switch(keyCode){
    case 8: // backspace
      songAudio.currentTime = 0;
      break;
    case 32: // space
      if(songAudio.paused) songAudio.play();
      else songAudio.pause();
      break;
    case 187: // = [+]
      z /= 2;
      buildWaveform(currentTime);
      break;
    case 189: // -
      z *= 2;
      buildWaveform(currentTime);
      break;
    case 65: // a
      metronome.play();
      break;
  }
}
function keyReleased(){
  keys[keyCode] = false;
}
function mouseWheel(event){
  if(keys[17]){
    if(event.delta > 0) // /= 2
      d = Math.max(1, keys[ALT] ? d-1 : (d%2==0 ? d/2 : d));
    else // *= 2
      d = Math.min(64, keys[ALT] ? d+1 : d*2);
  }else{
    const mspb = keys[18] ? 1 : ctp.mspb / (keys[16] ? 1 : d);
    if(event.delta < 0 == SETTINGS.INVERTED_SCROLL)
      songAudio.currentTime = (Math.round((currentTime - ctp.t -0.25) / mspb - 0.5) * mspb + ctp.t)/1000;
    else
      songAudio.currentTime = Math.min(ctpEnd, Math.ceil((currentTime - ctp.t +0.25) / mspb + 0.5) * mspb + ctp.t)/1000;
  }
}
let VImagePos, t0, t1;
function draw(){
  if(!songAudio) return noLoop();
  currentTime = (songAudio.currentTime*1000)|0;
  t1 = currentTime + yo*z;
  t0 = t1 - height*z;
  clear();

  if(currentTime < VImageStart || currentTime > VImageEnd) buildVImage(currentTime);
  push();
  translate(50, VImagePos = (yo+(currentTime-VImageStart)/z - height*1.5)|0);
  scale(-1, 1);
  image(VImage, 0, 0);
  pop();
  image(VImage, 150, VImagePos);

  if(currentTime < ctpStart || currentTime >= ctpEnd) alignCurrentTimingPoint();

  strokeWeight(1);
  for(let i = 0; i < aTP.length; i ++){
    const tp = aTP[i];
    const next = aTP[i+1];
    const end = next ? next.t : t1;
    if(end < t0) continue;
    const mspb = tp.mspb;
    const start = t0 < tp.t ? tp.t : tp.t + Math.floor((t0-tp.t) / mspb) * mspb;
    if(start > t1) break;
    let j = 0;
    for(let t = start; t < end; t += mspb/d){
      stroke(['#000', '#F00', '#00F'][j++ % d] || '#AAA');
      const YPOS = ((currentTime - t)/z + yo)|0;
      line(0, YPOS, 200, YPOS);
      if(j === 1){
        line(200, YPOS, 300, YPOS);
        fill(0);
        noStroke();
        text(tp.bpm[0].toFixed(1) + 'bpm', 300, YPOS);
      }
    }
  }

  noStroke();
  fill(0);
  text([frameRate()|0, currentTime, d, VImagePos, z, VCacheStart, VCacheEnd, VImageStart, VImageEnd].join('\n'), 800,600);
  text('fps\nt=\nd=\nwaveform pos\nms/px (z)\nVCache LowerBound\nVCache UpperBound\nVImage LowerBound\nVImage UpperBound', 700, 600);
  rect(100, yo+2, 200, 4);
}
