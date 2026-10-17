var BM = globalThis.BM = globalThis.BM || {};

// "Juice" : sons synthétisés (aucun fichier audio), vibrations, compteurs animés, confettis.
BM.Juice = (function () {
  var ctx = null, enabled = true, master = null;
  try { enabled = localStorage.getItem('hoops_sound') !== 'off'; } catch (e) { /* stockage indisponible */ }
  var reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function audio() {
    if (!enabled) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    var c = audio(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, q, attack) {
    var c = audio(); if (!c) return;
    var len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 3000; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  var SOUNDS = {
    tap: function () { tone(880, 0.05, 'triangle', 0.08, 660); },
    nav: function () { tone(520, 0.07, 'sine', 0.1, 780); },
    open: function () { tone(330, 0.12, 'sine', 0.08, 660); },
    swish: function () { noise(0.28, 0.25, 4500, 0.6, 0.02); },
    cheer: function () { noise(1.3, 0.22, 1400, 0.4, 0.25); noise(0.3, 0.2, 4500, 0.6, 0.02); },
    whistle: function () { tone(2900, 0.35, 'sine', 0.12, 2700); },
    buzzer: function () { tone(220, 0.7, 'sawtooth', 0.12); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.25, 'triangle', 0.15); }, i * 110); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { setTimeout(function () { tone(f, 0.3, 'sine', 0.12); }, i * 160); }); },
    coin: function () { tone(988, 0.08, 'square', 0.06); setTimeout(function () { tone(1319, 0.2, 'square', 0.06); }, 80); }
  };

  function sound(name) { if (enabled && SOUNDS[name]) { try { SOUNDS[name](); } catch (e) { /* audio indisponible */ } } }

  function haptic(kind) {
    var cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    try {
      if (cap) cap.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
      else if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 40 : kind === 'medium' ? 20 : 8);
    } catch (e) { /* vibreur indisponible */ }
  }

  // Compte animé de 0 à la valeur cible pour chaque [data-count].
  function countUp(root) {
    var els = (root || document).querySelectorAll('[data-count]');
    els.forEach(function (el) {
      var target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suffix = el.dataset.suffix || '';
      if (reduced || isNaN(target)) { el.textContent = target.toFixed(dec) + suffix; return; }
      var t0 = performance.now(), dur = 700;
      (function step(now) {
        var u = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - u, 3);
        el.textContent = (target * k).toFixed(dec) + suffix;
        if (u < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  function confetti(colors) {
    if (reduced) return;
    var c = document.createElement('canvas');
    c.className = 'confetti';
    document.body.appendChild(c);
    var dpr = window.devicePixelRatio || 1, w = innerWidth, h = innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    var x = c.getContext('2d'); x.scale(dpr, dpr);
    var parts = [];
    for (var i = 0; i < 140; i++) {
      parts.push({ x: w / 2 + (Math.random() - 0.5) * 80, y: h * 0.35, vx: (Math.random() - 0.5) * 14, vy: -6 - Math.random() * 12,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, s: 5 + Math.random() * 6, c: colors[i % colors.length] });
    }
    var t0 = performance.now();
    (function frame(now) {
      var t = (now - t0) / 1000;
      x.clearRect(0, 0, w, h);
      parts.forEach(function (p) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.max(0, 1 - t / 2.6);
        x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
      });
      if (t < 2.6) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  return {
    sound: sound,
    haptic: haptic,
    countUp: countUp,
    confetti: confetti,
    reduced: reduced,
    isOn: function () { return enabled; },
    toggle: function () {
      enabled = !enabled;
      try { localStorage.setItem('hoops_sound', enabled ? 'on' : 'off'); } catch (e) { /* stockage indisponible */ }
      return enabled;
    }
  };
})();
