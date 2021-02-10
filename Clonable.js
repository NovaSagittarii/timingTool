class Clonable {
  constructor(){

  }
  clone(){
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }
}
module.exports = Clonable;
