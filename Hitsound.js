const Clonable = require('./Clonable.js');
let ac;
class Hitsound extends Clonable {
  constructor(url){
    super();
    if(!ac) throw 'AC is uninitialized';
    this.b = null;
    fetch('./assets/p.wav')
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => ac.decodeAudioData(arrayBuffer))
      .then(ab => this.b = ab);
  }
  play(t){
    if(!this.b) throw 'buffer is not loaded yet';
    const source = ac.createBufferSource();
    source.buffer = this.b;
    source.connect(ac.destination);
    source.start(t || 0);
  }
  static setAudioContext(a){
    ac = a;
  }
}
module.exports = Hitsound;
