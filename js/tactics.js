var BM = globalThis.BM = globalThis.BM || {};

// Tactiques basket réelles, sur le modèle des formations + rôles de FM :
// un système offensif, un schéma défensif, un rôle par joueur, une adéquation de l'effectif et une familiarité qui se travaille.
(function () {
  var avg = function (arr, fn) { return arr.length ? arr.reduce(function (s, x) { return s + fn(x); }, 0) / arr.length : 10; };
  var best = function (arr, fn) { return arr.length ? Math.max.apply(null, arr.map(fn)) : 10; };
  var mix = function (p, w) { var s = 0, t = 0; for (var k in w) { s += p.attrs[k] * w[k]; t += w[k]; } return s / t; };
  var guards = function (ps) { return ps.filter(function (p) { return p.pos === 'MEN' || p.pos === 'ARR'; }); };
  var bigs = function (ps) { return ps.filter(function (p) { return p.pos === 'AF' || p.pos === 'PIV'; }); };

  BM.SYSTEMS = {
    pnr: {
      l: 'Pick & Roll', goal: 'le duo meneur-pivot', d: 'Écran pour le porteur, le pivot plonge ou s\'écarte. Les shooteurs punissent les aides.',
      shot: { rim: 1.15, mid: 1.1, three: 1 }, ast: 0.05, roles: ['org', 'scoreur', 'roll', 'shooteur', '3d'],
      fit: function (ps) {
        return best(guards(ps), function (p) { return mix(p, { pas: 1, drb: 1, qi: 1 }); }) * 0.45 +
          best(bigs(ps), function (p) { return mix(p, { fin: 1, det: 1, vit: 0.5 }); }) * 0.3 + avg(ps, function (p) { return p.attrs.tir3; }) * 0.25;
      }
    },
    motion: {
      l: 'Motion 5-Out', goal: 'tirs à 3 pts ouverts', d: 'Cinq joueurs écartés, passes et coupes : le ballon trouve le tir ouvert.',
      shot: { rim: 0.95, mid: 0.8, three: 1.35 }, ast: 0.1, roles: ['shooteur', '3d', 'stretch', 'pointfwd', 'pivotcreateur'],
      fit: function (ps) {
        return avg(ps, function (p) { return p.attrs.qi; }) * 0.3 + avg(ps, function (p) { return p.attrs.pas; }) * 0.25 + avg(ps, function (p) { return p.attrs.tir3; }) * 0.45;
      }
    },
    iso: {
      l: 'Isolation', goal: 'la star règle ça seule', d: 'Tout passe par la star : un contre un, tirs créés en dribble.',
      shot: { rim: 1.05, mid: 1.3, three: 0.95 }, ast: -0.15, star: 1.8, roles: ['scoreur', '3d', 'shooteur', 'roll'],
      fit: function (ps) {
        var s = ps.map(function (p) { return mix(p, { tirMi: 1, drb: 1, fin: 1, sf: 1 }); }).sort(function (a, b) { return b - a; });
        return (s[0] || 10) * 0.65 + (s[1] || 10) * 0.15 + avg(ps, function (p) { return p.attrs.tir3; }) * 0.2;
      }
    },
    post: {
      l: 'Poste bas', goal: 'tout pour l\'intérieur', d: 'On nourrit l\'intérieur dos au panier, les extérieurs coupent ou attendent la ressortie.',
      shot: { rim: 1.4, mid: 1.05, three: 0.75 }, ast: 0, bigs: 1.4, roles: ['poste', 'protecteur', 'shooteur', '3d', 'org'],
      fit: function (ps) {
        return best(bigs(ps), function (p) { return mix(p, { fin: 1, for: 1, qi: 0.5 }); }) * 0.6 + avg(ps, function (p) { return p.attrs.tir3; }) * 0.2 +
          best(bigs(ps), function (p) { return p.attrs.pas; }) * 0.2;
      }
    },
    run: {
      l: 'Run & Gun', goal: 'courir, tirer vite', d: 'Tir dans les sept premières secondes : transition, tirs rapides, beaucoup de possessions.',
      shot: { rim: 1.1, mid: 0.85, three: 1.2 }, ast: 0, transition: 0.15, pace: 12, roles: ['scoreur', 'slasher', 'shooteur', 'roll', 'pointfwd'],
      fit: function (ps) { return avg(ps, function (p) { return p.attrs.vit; }) * 0.4 + avg(ps, function (p) { return p.attrs.end; }) * 0.3 + avg(ps, function (p) { return p.attrs.fin; }) * 0.3; }
    },
    princeton: {
      l: 'Princeton', goal: 'coupes au cercle, peu de pertes', d: 'Lecture, passes des intérieurs en tête de raquette, coupes arrière : peu de pertes.',
      shot: { rim: 1.25, mid: 0.9, three: 1.05 }, ast: 0.1, tov: -0.02, roles: ['pivotcreateur', 'pointfwd', 'slasher', 'shooteur', 'org'],
      fit: function (ps) {
        return avg(ps, function (p) { return p.attrs.qi; }) * 0.35 + avg(ps, function (p) { return p.attrs.pas; }) * 0.3 + best(bigs(ps), function (p) { return p.attrs.pas; }) * 0.35;
      }
    }
  };

  BM.SCHEMES = {
    drop: {
      l: 'Drop', goal: 'fermer le cercle', d: 'Le pivot recule pour protéger le cercle : on concède les pull-ups à mi-distance.',
      fit: function (ps) { return best(bigs(ps), function (p) { return mix(p, { ctr: 1, defI: 1 }); }) * 0.7 + avg(guards(ps), function (p) { return p.attrs.defE; }) * 0.3; }
    },
    switch: {
      l: 'Switch', goal: 'aucun tir ouvert', d: 'On change sur tous les écrans : coupe les tirs extérieurs, expose les mismatchs au poste.',
      fit: function (ps) { return avg(ps, function (p) { return Math.min(p.attrs.defE, p.attrs.defI); }) * 0.65 + avg(ps, function (p) { return p.attrs.vit; }) * 0.35; }
    },
    blitz: {
      l: 'Blitz', goal: 'voler des ballons', d: 'Prise à deux sur le porteur : provoque des pertes, ouvre des tirs après rotation.',
      fit: function (ps) { return avg(ps, function (p) { return p.attrs.int; }) * 0.4 + avg(ps, function (p) { return p.attrs.vit; }) * 0.3 + avg(ps, function (p) { return p.attrs.end; }) * 0.3; }
    },
    zone: {
      l: 'Zone 2-3', goal: 'raquette fermée, 3 pts concédés', d: 'Protège la raquette et le rebond, concède des tirs à 3 points.',
      fit: function (ps) { return avg(bigs(ps), function (p) { return mix(p, { defI: 1, reb: 1, ctr: 0.5 }); }) * 0.5 + avg(ps, function (p) { return p.attrs.qi; }) * 0.5; }
    },
    press: {
      l: 'Press', goal: 'pertes et fatigue', d: 'Pression dès la remise en jeu : pertes provoquées, fatigue des deux côtés.',
      fit: function (ps) { return avg(ps, function (p) { return p.attrs.int; }) * 0.4 + avg(ps, function (p) { return p.attrs.vit; }) * 0.3 + avg(ps, function (p) { return p.attrs.end; }) * 0.3; }
    }
  };

  // Rôles NBA : attributs clés (adéquation en étoiles) et effets en match.
  BM.ROLES = {
    org: { l: 'Meneur organisateur', pos: ['MEN', 'ARR'], key: { pas: 3, qi: 3, drb: 2 }, usage: 0.9, ast: 0.08 },
    scoreur: { l: 'Créateur scoreur', pos: ['MEN', 'ARR', 'AIL'], key: { tirMi: 2, tir3: 2, drb: 2, sf: 1, fin: 1 }, usage: 1.35, shot: { mid: 1.25 } },
    '3d': { l: '3&D', pos: ['ARR', 'AIL', 'AF'], key: { tir3: 3, defE: 3, int: 1 }, usage: 0.75, shot: { three: 1.5, mid: 0.7 }, perimeter: 0.015 },
    shooteur: { l: 'Shooteur (catch & shoot)', pos: ['MEN', 'ARR', 'AIL'], key: { tir3: 4, sf: 1, lf: 1 }, usage: 0.85, shot: { three: 1.8, rim: 0.6 } },
    slasher: { l: 'Slasher', pos: ['MEN', 'ARR', 'AIL'], key: { fin: 3, vit: 2, det: 2, drb: 1 }, usage: 1.05, shot: { rim: 1.6, three: 0.7 } },
    pointfwd: { l: 'Ailier créateur', pos: ['AIL', 'AF'], key: { pas: 3, drb: 2, qi: 2, fin: 1 }, usage: 1.1, ast: 0.06 },
    stretch: { l: 'Stretch 4/5', pos: ['AF', 'PIV'], key: { tir3: 3, reb: 1, defI: 1 }, usage: 0.9, shot: { three: 1.8, rim: 0.7 } },
    roll: { l: 'Rim runner / roll man', pos: ['AF', 'PIV'], key: { fin: 3, det: 3, vit: 1 }, usage: 0.95, shot: { rim: 1.6, mid: 0.6, three: 0.3 } },
    protecteur: { l: 'Protecteur de cercle', pos: ['AF', 'PIV'], key: { ctr: 4, defI: 3, reb: 2 }, usage: 0.7, shot: { three: 0.5 }, rim: 0.015 },
    pivotcreateur: { l: 'Pivot créateur', pos: ['AF', 'PIV'], key: { pas: 3, qi: 3, fin: 2 }, usage: 1.1, ast: 0.06 },
    poste: { l: 'Joueur de poste bas', pos: ['AF', 'PIV'], key: { fin: 3, for: 3, tirMi: 1 }, usage: 1.15, shot: { rim: 1.4, mid: 1.15, three: 0.5 } },
    stopper: { l: 'Défenseur stopper', pos: ['MEN', 'ARR', 'AIL', 'AF'], key: { defE: 4, int: 2, vit: 2 }, usage: 0.7, perimeter: 0.02 }
  };

  // Adéquation d'un joueur à un rôle, en étoiles (0 à 5).
  BM.roleStars = function (p, roleId) {
    var r = BM.ROLES[roleId];
    if (!r) return 0;
    var s = mix(p, r.key) - (r.pos.indexOf(p.pos) < 0 ? 2 : 0);
    return Math.round(BM.clamp((s - 8) / 2.2, 0, 5) * 2) / 2;
  };

  // Départage des rôles quand plusieurs sont au maximum : profil d'usage réel (gravité) et spécialités.
  var hub = function (gr) { return Math.max(0, gr.on - 12); };
  var ROLE_BIAS = {
    scoreur: function (p, gr) { return 0.08 * (gr.on - 10); },
    org: function (p, gr) { return 0.08 * (p.attrs.pas - (p.attrs.tirMi + p.attrs.tir3) / 2) + 0.03 * (gr.on - 10); },
    shooteur: function (p, gr) { return 0.08 * (gr.off - gr.on); },
    slasher: function (p) { return 0.05 * (p.attrs.fin - p.attrs.tir3); },
    '3d': function (p, gr) { return 0.05 * (p.attrs.defE - p.attrs.drb) - 0.05 * hub(gr); },
    protecteur: function (p, gr) { return 0.06 * (p.attrs.ctr - p.attrs.pas) - 0.08 * hub(gr); },
    stopper: function (p, gr) { return 0.05 * (p.attrs.defE - p.attrs.tirMi) - 0.1 * hub(gr); },
    pivotcreateur: function (p, gr) { return 0.08 * (p.attrs.pas - p.attrs.ctr) + 0.03 * (gr.on - 10); },
    pointfwd: function (p, gr) { return 0.05 * (gr.on - 10); },
    poste: function (p) { return 0.04 * (p.attrs.for - p.attrs.tir3); },
    stretch: function (p) { return 0.06 * (p.attrs.tir3 - p.attrs.fin); },
    roll: function (p) { return 0.05 * (p.attrs.det - p.attrs.pas); }
  };

  BM.bestRole = function (p) {
    var bestId = null, bestS = -1, gr = BM.gravityBase(p);
    Object.keys(BM.ROLES).forEach(function (id) {
      var r = BM.ROLES[id], raw = mix(p, r.key) - (r.pos.indexOf(p.pos) < 0 ? 2 : 0);
      var s = raw + (r.pos.indexOf(p.pos) >= 0 ? 0.25 : 0) + (ROLE_BIAS[id] ? ROLE_BIAS[id](p, gr) : 0);
      if (s > bestS) { bestS = s; bestId = id; }
    });
    return bestId;
  };

  BM.roleOf = function (team, p) {
    var r = team.tactics.roles && team.tactics.roles[p.id];
    return r && BM.ROLES[r] ? r : BM.bestRole(p);
  };

  // Rotation : les huit joueurs les plus utilisés selon le plan de minutes.
  BM.rotationPlayers = function (g, team) {
    var mins = team.tactics.minutes || {};
    return BM.availablePlayers(g, team).sort(function (a, b) { return (mins[b.id] || 0) - (mins[a.id] || 0) || BM.ovrRaw(b) - BM.ovrRaw(a); }).slice(0, 8);
  };

  // Adéquation (0-100) de l'effectif à un système ou un schéma, normalisée sur toute la ligue (50 = moyenne NBA),
  // plus un petit bonus si les rôles prévus par le système sont présents dans la rotation.
  var rawSystem = function (g, team, id) {
    var ps = BM.rotationPlayers(g, team), sys = BM.SYSTEMS[id];
    var roles = ps.map(function (p) { return BM.roleOf(team, p); });
    var hits = sys.roles.filter(function (r) { return roles.indexOf(r) >= 0; }).length;
    return sys.fit(ps) + hits * 0.12;
  };
  var rawScheme = function (g, team, id) { return BM.SCHEMES[id].fit(BM.rotationPlayers(g, team)); };

  // Moyenne et écart-type de la ligue, recalculés une fois par jour de jeu.
  var leagueStats = function (g) {
    var key = g.season + ':' + g.day;
    if (g._fitStats && g._fitStats.key === key) return g._fitStats;
    var st = { key: key, sys: {}, sch: {} };
    var calc = function (map, raw, out) {
      Object.keys(map).forEach(function (id) {
        var v = g.teams.map(function (t) { return raw(g, t, id); });
        var m = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
        var sd = Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / v.length) || 1;
        out[id] = { m: m, sd: sd };
      });
    };
    calc(BM.SYSTEMS, rawSystem, st.sys);
    calc(BM.SCHEMES, rawScheme, st.sch);
    Object.defineProperty(g, '_fitStats', { value: st, writable: true, enumerable: false, configurable: true });
    return st;
  };

  BM.systemFit = function (g, team, sysId) {
    var s = leagueStats(g).sys[sysId];
    return Math.round(BM.clamp(50 + (rawSystem(g, team, sysId) - s.m) / s.sd * 18, 0, 100));
  };

  BM.schemeFit = function (g, team, schId) {
    var s = leagueStats(g).sch[schId];
    return Math.round(BM.clamp(50 + (rawScheme(g, team, schId) - s.m) / s.sd * 18, 0, 100));
  };

  BM.familiarity = function (team, kind, id) {
    var f = team.fam && team.fam[kind];
    return f && f[id] !== undefined ? f[id] : 40;
  };

  // Familiarité : le système et le schéma en place progressent, les autres s'oublient lentement.
  BM.growFamiliarity = function (team, amount) {
    team.fam = team.fam || { off: {}, def: {} };
    [['off', BM.SYSTEMS, team.tactics.system], ['def', BM.SCHEMES, team.tactics.defense]].forEach(function (x) {
      var f = team.fam[x[0]];
      Object.keys(x[1]).forEach(function (id) {
        var v = f[id] === undefined ? 40 : f[id];
        f[id] = id === x[2] ? Math.min(100, v + amount) : Math.max(30, v - 0.08);
      });
    });
  };

  // Efficacité globale d'une tactique (utilisée par le moteur) : adéquation + familiarité, centrée sur 0.
  BM.tacticEdge = function (g, team) {
    var t = team.tactics;
    return {
      off: (BM.systemFit(g, team, t.system) - 50) / 2000 + (BM.familiarity(team, 'off', t.system) - 65) / 4500,
      def: (BM.schemeFit(g, team, t.defense) - 50) / 2000 + (BM.familiarity(team, 'def', t.defense) - 65) / 4500
    };
  };

  BM.bestTactic = function (g, team) {
    var pick = function (map, fitFn, kind) {
      var bestId = null, bestV = -1;
      Object.keys(map).forEach(function (id) {
        var v = fitFn(g, team, id) + BM.familiarity(team, kind, id) * 0.15;
        if (v > bestV) { bestV = v; bestId = id; }
      });
      return bestId;
    };
    return { system: pick(BM.SYSTEMS, BM.systemFit, 'off'), defense: pick(BM.SCHEMES, BM.schemeFit, 'def') };
  };

  // Attribue un rôle aux joueurs qui n'en ont pas (meilleure adéquation).
  BM.ensureRoles = function (g, team) {
    team.tactics.roles = team.tactics.roles || {};
    BM.roster(g, team).forEach(function (p) {
      if (!BM.ROLES[team.tactics.roles[p.id]]) team.tactics.roles[p.id] = BM.bestRole(p);
    });
  };

  // Libellé complet : nom du système et objectif en clair, par exemple « Princeton (coupes au cercle, peu de pertes) ».
  BM.tacticLabel = function (x) { return x.l + (x.goal ? ' (' + x.goal + ')' : ''); };
  BM.TACTIC_OPTIONS.system = Object.keys(BM.SYSTEMS).map(function (k) { var x = BM.SYSTEMS[k]; return { v: k, l: BM.tacticLabel(x), s: x.l, d: x.d }; });
  BM.TACTIC_OPTIONS.defense = Object.keys(BM.SCHEMES).map(function (k) { var x = BM.SCHEMES[k]; return { v: k, l: BM.tacticLabel(x), s: x.l, d: x.d }; });

  // Anciennes sauvegardes : focus/défense "homme" -> systèmes et schémas réels.
  BM.migrateTactics = function (g, team) {
    var t = team.tactics;
    if (!t.system || !BM.SYSTEMS[t.system]) t.system = { exterieur: 'motion', interieur: 'post' }[t.focus] || 'pnr';
    if (!BM.SCHEMES[t.defense]) t.defense = 'drop';
    if (!team.fam) {
      team.fam = { off: {}, def: {} };
      team.fam.off[t.system] = 75;
      team.fam.def[t.defense] = 75;
    }
    BM.ensureRoles(g, team);
  };
})();
