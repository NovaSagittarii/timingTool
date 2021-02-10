const Clonable = require('./Clonable.js');
class TimingPoint extends Clonable {
  constructor(parent, to, mspb, m, ss, si, v, i, k){
    super();
    this.parent = parent || this;
    this.t = to;
    this.mspb = mspb > 0 ? mspb : -100/mspb
    if(parent !== null){
      this.bpm = parent.bpm;
      this.sbpm = parent.sbpm; // snapping bpm (used to determine if editor should ignore BPM TPs)
    } else i = 1;
    this.m = m;    // meter
    this.ss = ss;  // sample set
    this.si = si;  // sample index
    this.v = v|0;  // volume
    this.i = !!parseInt(i);  // inherited ?
    this.a = (this.mspb > 12 && this.mspb < 4000); // active/inactive (inactive Red TPs still affect speed but do not set the bpm) 12mspb ~ 5000bpm; 4000mspb ~ 15bpm. [ this.a !== (this.bpm !== this.sbpm) ]
    this.k = !!k;  // kiai ?
    // this._id = (_nid ++).toString(36);
    if(this.i) this.bpm = Float64Array.of(60000/mspb);
    if(this.i && this.a) this.sbpm = this.bpm;
  }
  align(TP){
    let _0 = false;
    for(let i = TP.indexOf(this)+1; i < TP.length; i ++){
      if(i < 0) throw 'Timingpoint not present in array';
      if(!i || (TP[i].i && TP[i].a)) break;
      if(TP[i].i && !TP[i].a) _0 = true;
      if(!_0) TP[i].bpm = this.bpm; // do not keep updating actual BPM speed of TPs after encounter "ignored BPM TP"
      TP[i].sbpm  = this.sbpm;
    }
  }
  static fromString(parent, str){
    return new TimingPoint(parent, ...(str.split(',').map(e => parseFloat(e) || parseInt(e))));
  }
  static sortByTime(a, b){
    return (a.t - b.t) || (b.i - a.i);
  }
}
module.exports = TimingPoint;
