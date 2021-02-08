let PATH;
const { ipcRenderer } = window.require('electron');
ipcRenderer.on('DIR', (e, d) => PATH = d);
ipcRenderer.on('IMPORT', (e, d) => parse(d));
// ipcRenderer.on('AUDIO', (e, d) => parseAudio(d));

const ac = new (window.AudioContext || window.webkitAudioContext)();
let songAudio, audioBuffer;
let currentTime, mouseTime;
let d = 2;      // divisor
let z = 1;      // zoom, ms/px
let yo;         // y offset
let VCache = new Uint16Array(4096), VCacheStart, VCacheEnd; // VisualizationCache
let VImage, VImageStart, VImageEnd;

const metadata = {};
function parse(d){
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
        case "timingpoints":

      }
    }
  })
  console.log(metadata);
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
      buildVCache(0);
      buildVImage(0);
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
  VCacheEnd = VCacheStart + (VCache.length - 2*height)*z;
  console.log("cache built", VCacheStart, currentTime, VCacheEnd);
}
function buildVImage(ms, k){
  k = k || 1;
/* TODO: probably could optimize by using 3 images instead of one big one but that requires EFFORT */
  VImageStart = (ms = Math.max(0, Math.floor(ms-height*z)));
  if(ms < VCacheStart || ms > VCacheEnd) buildVCache(ms);
  const img = createImage(100, height*3);
  const c = color(0, 90, 102);
  img.loadPixels();
  let y = img.height;
  const start = (ms-VCacheStart)/z;
  for(let i = 0; i < height*3; i ++, y --)
    for(let x = Math.min(img.width, (k*VCache[start+i]/65535*200)|0); x >= 0; x --)
      img.set(x, y, c);

  img.updatePixels();
  VImage = img;
  VImageEnd = VImageStart + 2*height*z;
  console.log('image created', VImageStart, currentTime, VImageEnd);
}
function rebuildWaveform(ms, k){
  buildVCache(ms);
  buildVImage(ms, k || 1);
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
}
function keyPressed(){
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
      rebuildWaveform(songAudio.currentTime);
      break;
    case 189: // -
      z *= 2;
      rebuildWaveform(songAudio.currentTime);
      break;
  }
}
function draw(){
  if(!songAudio) return noLoop();
  currentTime = (songAudio.currentTime*1000)|0;
  clear();

  if(currentTime < VImageStart || currentTime > VImageEnd) buildVImage(currentTime);
  push();
  translate(50, yo+(currentTime-VImageStart)/z - height*1.5);
  scale(-1, 1);
  image(VImage, 0, 0);
  pop();
  image(VImage, 150, yo+(currentTime-VImageStart)/z - height*1.5);


  noStroke();
  fill(0);
  text([~~frameRate(), currentTime, (currentTime-VImageStart)/z, z, VCacheStart, VCacheEnd, VImageStart, VImageEnd].join('\n'), 800,600);
  text('fps\nt=\nwaveform pos\nms/px (z)\nVCache LowerBound\nVCache UpperBound\nVImage LowerBound\nVImage UpperBound', 700, 600);
  rect(100, yo+2, 200, 4);
}
