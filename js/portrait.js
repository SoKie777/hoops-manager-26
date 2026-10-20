var BM = globalThis.BM = globalThis.BM || {};

// Portraits de joueurs façon FM26 : buste illustré, généré de façon déterministe à partir de l'identité du joueur.
// Aucune photo réelle : teint, coiffure, barbe, bandeau et maillot aux couleurs du club.
(function () {
  var SKIN = ['#f3d0b0', '#e2b28c', '#c99068', '#b07650', '#94603e', '#7a4a2f', '#633b25', '#4f2e1d', '#3f2417'];
  var SKIN_W = [3, 4, 6, 8, 11, 13, 13, 10, 6]; // répartition proche de la ligue
  var HAIR = ['#14100e', '#1f1712', '#3a271b', '#5b3a22', '#8a5a2b', '#c8a063', '#7a3b1e'];
  var cache = {};

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Générateur local : chaque appel donne un nouveau nombre dans [0, 1).
  function seq(seed) {
    var s = seed || 1;
    return function () { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0; s ^= s >>> 13; return ((s >>> 0) % 100000) / 100000; };
  }
  function pickW(r, w) {
    var t = w.reduce(function (a, b) { return a + b; }, 0), x = r() * t;
    for (var i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
    return w.length - 1;
  }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var m = function (c) { return Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f); };
    return '#' + ((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1);
  }

  // Traits du joueur, stables d'une partie à l'autre (nom + date de naissance approchée).
  BM.looks = function (p) {
    var r = seq(hash((p.first || '') + '|' + (p.last || '') + '|' + (p.pos || '')));
    var skin = pickW(r, SKIN_W);
    var light = skin <= 2;
    var hairColor = light ? pickW(r, [3, 3, 4, 4, 3, 2, 1]) : pickW(r, [10, 6, 2, 1, 0, 0, 0]);
    var style = light ? pickW(r, [1, 3, 4, 1, 0, 1, 1, 2, 4, 0]) : pickW(r, [2, 4, 4, 3, 2, 3, 2, 2, 0, 2]);
    return {
      skin: skin, hairColor: hairColor, style: style,
      beard: pickW(r, [4, 3, 2, 3, 2]),
      face: 0.92 + r() * 0.16, jaw: r(), brow: r() * 2 - 1,
      headband: r() < 0.12, hbWhite: r() < 0.5,
      eyes: r() < 0.5 ? 1 : 0
    };
  };

  function hairSvg(L, col, age) {
    var c = age >= 34 ? shade(col, 0.35) : col;
    switch (L.style) {
      case 0: return ''; // crâne rasé
      case 1: return '<path d="M32 47 Q32 26 50 25 Q68 26 68 47 Q66 36 50 34 Q34 36 32 47Z" fill="' + c + '" opacity=".55"/>';
      case 2: return '<path d="M31 48 Q30 23 50 22 Q70 23 69 48 Q67 34 58 32 Q50 35 42 32 Q33 34 31 48Z" fill="' + c + '"/>';
      case 3: return '<path d="M32 46 L33 22 Q50 14 67 22 L68 46 Q66 32 50 31 Q34 32 32 46Z" fill="' + c + '"/>';
      case 4: return '<circle cx="50" cy="34" r="25" fill="' + c + '"/>';
      case 5: // tresses / dreads
        var s = '<path d="M30 50 Q29 22 50 21 Q71 22 70 50 Q68 33 50 32 Q32 33 30 50Z" fill="' + c + '"/>';
        for (var i = 0; i < 7; i++) {
          var x = 31 + i * 6.3, len = 18 + (i % 3) * 4;
          if (x > 40 && x < 60) continue;
          s += '<path d="M' + x + ' 34 q' + (x < 50 ? -2 : 2) + ' ' + len / 2 + ' 0 ' + len + '" stroke="' + c + '" stroke-width="3.4" stroke-linecap="round" fill="none"/>';
        }
        return s;
      case 6: return '<path d="M31 46 Q31 24 50 23 Q69 24 69 46 Q67 33 50 33 Q33 33 31 46Z" fill="' + c + '"/><path d="M36 28 Q50 24 64 28" stroke="' + shade(c, 0.25) + '" stroke-width="1" fill="none" opacity=".6"/>';
      case 7: // boucles sur le dessus
        var t = '<path d="M32 46 Q32 30 50 29 Q68 30 68 46 Q66 36 50 35 Q34 36 32 46Z" fill="' + c + '"/>';
        [[38, 27], [45, 23], [53, 23], [60, 26], [42, 30], [57, 30], [50, 27]].forEach(function (q) { t += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="5" fill="' + c + '"/>'; });
        return t;
      case 8: return '<path d="M31 47 Q28 20 52 21 Q72 22 69 44 Q62 30 46 31 Q38 33 31 47Z" fill="' + c + '"/><path d="M40 25 Q55 21 66 30" stroke="' + shade(c, 0.3) + '" stroke-width="1.2" fill="none" opacity=".5"/>';
      case 9: // nattes plaquées
        var b = '<path d="M31 47 Q30 23 50 22 Q70 23 69 47 Q67 34 50 33 Q33 34 31 47Z" fill="' + c + '"/>';
        for (var j = 0; j < 5; j++) b += '<path d="M' + (38 + j * 6) + ' 34 Q' + (37 + j * 6.5) + ' 26 ' + (40 + j * 5) + ' 22" stroke="' + shade(c, 0.22) + '" stroke-width="1" fill="none"/>';
        return b;
    }
    return '';
  }

  function beardSvg(L, col, skinDark) {
    switch (L.beard) {
      case 0: return '';
      case 1: return '<path d="M34 60 Q36 78 50 80 Q64 78 66 60 Q62 72 50 73 Q38 72 34 60Z" fill="' + col + '" opacity=".28"/>';
      case 2: return '<path d="M44 70 Q50 81 56 70 Q53 74 50 74 Q47 74 44 70Z" fill="' + col + '"/><path d="M44 66 Q50 64 56 66" stroke="' + col + '" stroke-width="1.6" fill="none"/>';
      case 3: return '<path d="M33 58 Q34 80 50 82 Q66 80 67 58 Q64 70 57 70 Q50 66 43 70 Q36 70 33 58Z" fill="' + col + '"/>';
      case 4: return '<path d="M44 66.2 Q50 63.6 56 66.2" stroke="' + col + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    }
    return '';
  }

  // Renvoie le SVG du portrait. size : taille d'affichage en pixels.
  BM.portrait = function (p, team, size) {
    size = size || 64;
    var key = p.id + '|' + (team ? team.id : '-') + '|' + (p.age >= 34 ? 1 : 0) + '|' + (p.number || '');
    var body = cache[key];
    if (!body) {
      var L = BM.looks(p), skin = SKIN[L.skin], dark = shade(skin, -0.22), hair = HAIR[L.hairColor];
      var col = team ? team.color : '#5c677d', id = 'pt' + p.id;
      var rx = 17.5 * L.face, ry = 22, jawY = 66 + L.jaw * 4;
      var num = p.number || ((hash(p.last || '') % 45) + 0);
      var brow = 47 + L.brow * 0.8;
      body = '<defs><radialGradient id="' + id + 'b" cx="50%" cy="28%" r="78%"><stop offset="0" stop-color="' + shade(col, 0.28) + '"/><stop offset=".55" stop-color="' + shade(col, -0.35) + '"/><stop offset="1" stop-color="#070a10"/></radialGradient>' +
        '<linearGradient id="' + id + 'j" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + shade(col, 0.14) + '"/><stop offset="1" stop-color="' + shade(col, -0.38) + '"/></linearGradient>' +
        '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + shade(skin, 0.08) + '"/><stop offset="1" stop-color="' + shade(skin, -0.08) + '"/></linearGradient>' +
        '<clipPath id="' + id + 'c"><rect x="10" y="12" width="80" height="96" rx="12"/></clipPath></defs>' +
        '<g clip-path="url(#' + id + 'c)"><rect width="100" height="120" fill="url(#' + id + 'b)"/>' +
        '<circle cx="50" cy="24" r="34" fill="' + shade(col, 0.45) + '" opacity=".14"/>' +
        // Cou et ombre sous le menton.
        '<path d="M41.5 73 L41.5 91 Q50 96 58.5 91 L58.5 73Z" fill="' + dark + '"/>' +
        '<path d="M42 74 Q50 83 58 74 L58 80 Q50 86 42 80Z" fill="rgba(0,0,0,.22)"/>' +
        // Épaules et maillot NBA.
        '<path d="M4 120 Q6 97 23 91 Q34 87 41 85 Q50 96 59 85 Q66 87 77 91 Q94 97 96 120Z" fill="url(#' + id + 'j)"/>' +
        '<path d="M18 93 Q33 88 41 85 L41 88 Q32 91 18 96Z" fill="rgba(255,255,255,.14)"/>' +
        '<path d="M40.5 85.5 Q50 98.5 59.5 85.5" stroke="#fff" stroke-width="2.6" fill="none" opacity=".92"/>' +
        '<path d="M41.8 87.2 Q50 99.6 58.2 87.2" stroke="' + shade(col, -0.45) + '" stroke-width="1.1" fill="none" opacity=".7"/>' +
        '<path d="M24 91 Q21.5 104 25.5 120 M76 91 Q78.5 104 74.5 120" stroke="#fff" stroke-width="1.8" fill="none" opacity=".42"/>' +
        '<text x="50" y="105.5" text-anchor="middle" font-family="Barlow Condensed, Arial, sans-serif" font-weight="800" font-size="11" fill="#fff" opacity=".95" letter-spacing=".5">' + num + '</text>' +
        (L.style === 4 || L.style === 5 ? hairSvg(L, hair, p.age) : '') +
        // Oreilles et tête.
        '<ellipse cx="' + (50 - rx) + '" cy="55" rx="3.4" ry="5.2" fill="' + dark + '"/><ellipse cx="' + (50 + rx) + '" cy="55" rx="3.4" ry="5.2" fill="' + dark + '"/>' +
        '<path d="M' + (50 - rx) + ' 50 Q' + (50 - rx) + ' 27 50 27 Q' + (50 + rx) + ' 27 ' + (50 + rx) + ' 50 Q' + (50 + rx) + ' ' + jawY + ' 50 ' + (jawY + 9) + ' Q' + (50 - rx) + ' ' + jawY + ' ' + (50 - rx) + ' 50Z" fill="url(#' + id + 's)"/>' +
        '<path d="M' + (50 - rx + 2.5) + ' 38 Q' + (50 - rx + 1) + ' 52 ' + (50 - rx + 4.5) + ' ' + (jawY - 1) + '" stroke="rgba(255,255,255,.18)" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
        '<path d="M' + (50 + rx - 4) + ' 40 Q' + (50 + rx) + ' 56 ' + (50 + rx - 6) + ' ' + (jawY + 2) + ' Q' + (50 + rx - 1) + ' 54 ' + (50 + rx - 4) + ' 40Z" fill="' + dark + '" opacity=".36"/>' +
        (L.style !== 4 && L.style !== 5 ? hairSvg(L, hair, p.age) : (L.style === 5 ? '<path d="M' + (50 - rx) + ' 46 Q50 30 ' + (50 + rx) + ' 46 Q50 36 ' + (50 - rx) + ' 46Z" fill="' + hair + '"/>' : '<path d="M' + (50 - rx + 1) + ' 44 Q50 31 ' + (50 + rx - 1) + ' 44 Q50 37 ' + (50 - rx + 1) + ' 44Z" fill="' + hair + '"/>')) +
        (L.headband ? '<path d="M' + (50 - rx - 0.5) + ' 41 Q50 35 ' + (50 + rx + 0.5) + ' 41 L' + (50 + rx + 0.5) + ' 45.5 Q50 39.5 ' + (50 - rx - 0.5) + ' 45.5Z" fill="' + (L.hbWhite ? '#f1f3f5' : col) + '"/><path d="M' + (50 - rx) + ' 43.2 Q50 37.3 ' + (50 + rx) + ' 43.2" stroke="rgba(255,255,255,.32)" stroke-width=".9" fill="none"/>' : '') +
        // Sourcils, yeux avec éclat de pupille, nez, bouche.
        '<path d="M39.8 ' + (brow + 0.6) + ' Q44 ' + (brow - 1.3) + ' 47.2 ' + brow + ' M52.8 ' + brow + ' Q56 ' + (brow - 1.3) + ' 60.2 ' + (brow + 0.6) + '" stroke="' + shade(hair, -0.1) + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="43.6" cy="52" rx="3.2" ry="' + (L.eyes ? 1.75 : 2.05) + '" fill="#f8f4ee"/><ellipse cx="56.4" cy="52" rx="3.2" ry="' + (L.eyes ? 1.75 : 2.05) + '" fill="#f8f4ee"/>' +
        '<circle cx="44" cy="52.1" r="1.6" fill="#24170f"/><circle cx="56.8" cy="52.1" r="1.6" fill="#24170f"/>' +
        '<circle cx="43.4" cy="51.5" r=".55" fill="#fff" opacity=".88"/><circle cx="56.2" cy="51.5" r=".55" fill="#fff" opacity=".88"/>' +
        '<path d="M48.4 53.8 Q47.2 60.5 48.9 61.6 Q50 62.3 51.1 61.6 Q52.8 60.5 51.6 53.8" stroke="' + shade(skin, -0.34) + '" stroke-width="1.15" fill="none" stroke-linecap="round"/>' +
        '<path d="M45.2 66.6 Q50 68.7 54.8 66.6" stroke="' + shade(skin, -0.46) + '" stroke-width="1.55" fill="none" stroke-linecap="round"/>' +
        '<path d="M47 68.5 Q50 69.5 53 68.5" stroke="' + shade(skin, -0.25) + '" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".6"/>' +
        beardSvg(L, hair, dark) +
        '<rect x="10" y="12" width="80" height="96" rx="12" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.4"/></g>';
      cache[key] = body;
    }
    return '<svg class="portrait" viewBox="10 12 80 96" width="' + size + '" height="' + Math.round(size * 1.2) + '" aria-hidden="true">' + body + '</svg>';
  };

  // Radar hexagonal 6 axes du profil d'un joueur (échelle 1-20 par pôle).
  BM.radarAxes = function (p) {
    var a = p.attrs;
    return [
      { l: 'TIR EXT.', v: a.tir3 * 0.55 + a.tirMi * 0.3 + a.lf * 0.15 },
      { l: 'FINITION', v: a.fin * 0.55 + a.det * 0.25 + a.for * 0.2 },
      { l: 'CRÉATION', v: a.pas * 0.45 + a.drb * 0.35 + a.qi * 0.2 },
      { l: 'DÉFENSE', v: Math.max(a.defE, a.defI) * 0.45 + (a.defE + a.defI) * 0.15 + Math.max(a.int, a.ctr) * 0.25 },
      { l: 'PHYSIQUE', v: a.vit * 0.3 + a.det * 0.25 + a.for * 0.2 + a.end * 0.25 },
      { l: 'MENTAL', v: a.qi * 0.35 + a.sf * 0.25 + a.act * 0.25 + a.lead * 0.15 }
    ];
  };

  BM.radarSvg = function (p, color, size) {
    size = size || 190;
    var axes = BM.radarAxes(p), col = color || '#ff7a1a';
    var cx = 110, cy = 96, R = 64;
    var pt = function (i, r) {
      var ang = -Math.PI / 2 + i * Math.PI * 2 / 6;
      return [+(cx + Math.cos(ang) * r).toFixed(1), +(cy + Math.sin(ang) * r).toFixed(1)];
    };
    var rings = [0.33, 0.66, 1].map(function (k) {
      var pts = axes.map(function (_, i) { return pt(i, R * k).join(','); }).join(' ');
      return '<polygon points="' + pts + '" fill="none" stroke="rgba(255,255,255,' + (k === 1 ? '.18' : '.08') + ')" stroke-width="1"/>';
    }).join('');
    var spokes = axes.map(function (_, i) {
      var p2 = pt(i, R);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p2[0] + '" y2="' + p2[1] + '" stroke="rgba(255,255,255,.09)" stroke-width="1"/>';
    }).join('');
    var polyPts = axes.map(function (ax, i) {
      var u = BM.clamp((ax.v - 3) / 16.5, 0.12, 1);
      return pt(i, R * u).join(',');
    }).join(' ');
    var dots = axes.map(function (ax, i) {
      var u = BM.clamp((ax.v - 3) / 16.5, 0.12, 1), d = pt(i, R * u), lp = pt(i, R + 19);
      var val = Math.round(ax.v * 5);
      return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="3.2" fill="#fff" stroke="' + col + '" stroke-width="2"/>' +
        '<text x="' + lp[0] + '" y="' + (lp[1] - 3) + '" text-anchor="middle" font-family="Barlow Condensed, system-ui, sans-serif" font-weight="800" font-size="9.5" fill="rgba(238,242,246,.72)" letter-spacing=".4">' + ax.l + '</text>' +
        '<text x="' + lp[0] + '" y="' + (lp[1] + 8) + '" text-anchor="middle" font-family="Barlow Condensed, system-ui, sans-serif" font-weight="800" font-size="11.5" fill="#fff">' + val + '</text>';
    }).join('');
    return '<svg class="radar-svg" viewBox="0 0 220 192" width="' + size + '" height="' + Math.round(size * 192 / 220) + '" aria-label="Profil radar">' +
      rings + spokes +
      '<polygon points="' + polyPts + '" fill="' + col + '" fill-opacity=".28" stroke="' + col + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      dots + '</svg>';
  };
})();
