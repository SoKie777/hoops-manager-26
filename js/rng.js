var BM = globalThis.BM = globalThis.BM || {};

// Générateur pseudo-aléatoire déterministe (mulberry32) : l'état est sauvegardé avec la partie.
BM.RNG = function (seed) {
  this.s = (seed >>> 0) || 1;
};

BM.RNG.prototype.next = function () {
  var t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

BM.RNG.prototype.range = function (a, b) {
  return a + (b - a) * this.next();
};

BM.RNG.prototype.int = function (a, b) {
  return a + Math.floor(this.next() * (b - a + 1));
};

BM.RNG.prototype.chance = function (p) {
  return this.next() < p;
};

BM.RNG.prototype.pick = function (arr) {
  return arr[Math.floor(this.next() * arr.length)];
};

BM.RNG.prototype.gauss = function (mean, sd) {
  var u = 1 - this.next(), v = this.next();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

BM.RNG.prototype.weighted = function (items, weightFn) {
  var total = 0, w = items.map(function (it) { var x = Math.max(0, weightFn(it)); total += x; return x; });
  if (total <= 0) return this.pick(items);
  var r = this.next() * total;
  for (var i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};

BM.RNG.prototype.shuffle = function (arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(this.next() * (i + 1)), t = arr[i];
    arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};

BM.RNG.prototype.toJSON = function () { return { s: this.s }; };
