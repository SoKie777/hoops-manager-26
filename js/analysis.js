var BM = globalThis.BM = globalThis.BM || {};

// Analyse d'après-match : pourquoi on a gagné ou perdu, en points estimés.
// Chaque facteur compare les deux équipes ; on garde ceux qui ont pesé en faveur du vainqueur.
(function () {
  var EXP3 = 0.365; // réussite à 3 pts attendue (moyenne de la ligue)

  function totals(m, side) {
    var t = { oreb: 0, dreb: 0, tov: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, fga: 0, fgm: 0, stl: 0, bench: 0, top: null };
    m.roster[side].forEach(function (p) {
      var b = m.box[p.id];
      ['oreb', 'dreb', 'tov', 'tpm', 'tpa', 'ftm', 'fta', 'fga', 'fgm', 'stl'].forEach(function (k) { t[k] += b[k]; });
      if (m.starters0[side].indexOf(p.id) < 0) t.bench += b.pts;
      if (!t.top || b.pts > m.box[t.top.id].pts) t.top = p;
    });
    // Réussite attendue des tireurs à 3 pts, d'après leur attribut.
    var exp = 0;
    m.roster[side].forEach(function (p) { exp += m.box[p.id].tpa * BM.clamp(EXP3 + (p.attrs.tir3 - 13) * 0.012, 0.25, 0.45); });
    t.exp3 = exp;
    return t;
  }

  function pct(a, b) { return b ? Math.round(a / b * 100) + ' %' : '-'; }
  function qName(q) { return q > 4 ? 'en prolongation' : q === 1 ? 'au 1er quart-temps' : 'au ' + q + 'e quart-temps'; }

  // us : camp du point de vue (utilisateur), ou 0 par défaut. Renvoie { won, factors: [{ pts, good, t }] }.
  BM.explainMatch = function (m, us) {
    if (us === undefined || us < 0) us = 0;
    var them = 1 - us, g = m.g;
    var A = totals(m, us), B = totals(m, them);
    var won = m.score[us] > m.score[them];
    var F = [];
    // f : avantage (en points) pour « us ». goodTxt : texte si favorable, badTxt sinon.
    var add = function (key, f, goodTxt, badTxt) { F.push({ k: key, pts: f, good: f > 0, t: f > 0 ? goodTxt : badTxt }); };

    var dO = A.oreb - B.oreb;
    add('reb', dO * 1.1, 'Domination au rebond offensif (' + A.oreb + ' contre ' + B.oreb + ') : des secondes chances en série.',
      'Perdu au rebond : ' + B.oreb + ' rebonds offensifs concédés (contre ' + A.oreb + ').');

    var dT = B.tov - A.tov;
    add('tov', dT * 1.15, 'Ballon protégé : ' + A.tov + ' pertes seulement contre ' + B.tov + ' pour eux.',
      'Trop de pertes de balle : ' + A.tov + ' contre ' + B.tov + ' (' + B.stl + ' interceptions adverses).');

    var luck = ((A.tpm - A.exp3) - (B.tpm - B.exp3)) * 3;
    add('luck3', luck, 'Adresse au-dessus de vos standards à 3 pts (' + A.tpm + '/' + A.tpa + ', ' + pct(A.tpm, A.tpa) + ') : soirée réussie.',
      B.tpm - B.exp3 > A.exp3 - A.tpm ? 'Ils ont été inhabituellement adroits à 3 pts (' + B.tpm + '/' + B.tpa + ', ' + pct(B.tpm, B.tpa) + ') : ça arrive.'
        : 'Soirée sans réussite à 3 pts (' + A.tpm + '/' + A.tpa + ', ' + pct(A.tpm, A.tpa) + ') malgré des tirs pris.');

    add('ft', A.ftm - B.ftm, 'Avantage aux lancers francs (' + A.ftm + '/' + A.fta + ' contre ' + B.ftm + '/' + B.fta + ').',
      'Écart aux lancers francs : ' + B.ftm + '/' + B.fta + ' pour eux, ' + A.ftm + '/' + A.fta + ' pour vous.');

    // Adéquation tactique : avantage offensif de chaque camp contre la défense adverse, sur environ 85 tirs.
    var eA = m.edge[us], eB = m.edge[them];
    var tac = ((eA.off - eB.def) - (eB.off - eA.def)) * 85 * 2.1;
    var mySys = BM.SYSTEMS[m.tac[us].system], oppSys = BM.SYSTEMS[m.tac[them].system];
    var myTeam = m.side[us], oppTeam = m.side[them];
    var why = function (team, tac) {
      var fit = BM.systemFit(g, team, tac.system), fam = Math.round(BM.familiarity(team, 'off', tac.system));
      var dfit = BM.schemeFit(g, team, tac.defense), dfam = Math.round(BM.familiarity(team, 'def', tac.defense));
      var low = [];
      if (fit < 45) low.push('le ' + BM.SYSTEMS[tac.system].l + ' convient mal à l\'effectif (adéquation ' + fit + ')');
      if (fam < 55) low.push('le ' + BM.SYSTEMS[tac.system].l + ' n\'est pas encore maîtrisé (familiarité ' + fam + ')');
      if (dfit < 45) low.push('la défense ' + BM.SCHEMES[tac.defense].l + ' ne colle pas aux joueurs (adéquation ' + dfit + ')');
      if (dfam < 55) low.push('la défense ' + BM.SCHEMES[tac.defense].l + ' manque de rodage (familiarité ' + dfam + ')');
      return low;
    };
    var myLow = why(myTeam, m.tac[us]);
    add('tac', tac, 'Votre plan de jeu était mieux adapté : ' + BM.tacticLabel(mySys) + ' contre leur ' + oppSys.l + '.',
      'Leur tactique était mieux adaptée' + (myLow.length ? ' : ' + myLow.join(', ') + '.' : ' : leur ' + BM.tacticLabel(oppSys) + ' colle mieux à leur effectif.'));

    // Fatigue au 4e quart-temps.
    if (m.q4n > 0 && m.qs.length >= 4) {
      var enA = m.q4en[us] / m.q4n, enB = m.q4en[them] / m.q4n;
      var q4 = (m.qs[3][us] - m.qs[2][us]) - (m.qs[3][them] - m.qs[2][them]);
      var dE = enA - enB;
      if (Math.abs(dE) >= 5 && (dE > 0) === (q4 > 0)) {
        var f = (dE > 0 ? 1 : -1) * Math.min(Math.abs(q4), Math.abs(dE) * 0.4);
        add('fatigue', f, 'Plus frais dans le money time : énergie moyenne ' + Math.round(enA) + ' % contre ' + Math.round(enB) + ' %, 4e quart-temps gagné de ' + q4 + '.',
          'Fatigue au 4e quart-temps : énergie moyenne ' + Math.round(enA) + ' % contre ' + Math.round(enB) + ' %, quart-temps perdu de ' + (-q4) + '.');
      }
    }

    // Talent sur le papier (8 meilleurs joueurs disponibles).
    var str = function (i) {
      var r = m.roster[i].map(function (p) { return BM.ovrRaw(p); }).sort(function (a, b) { return b - a; }).slice(0, 8);
      return r.reduce(function (s, x) { return s + x; }, 0) / Math.max(1, r.length);
    };
    var dS = str(us) - str(them);
    add('talent', dS * 5, 'Effectif plus fort sur le papier (note moyenne ' + Math.round(str(us) * 5) + ' contre ' + Math.round(str(them) * 5) + ').',
      'Leur effectif était plus fort sur le papier (note moyenne ' + Math.round(str(them) * 5) + ' contre ' + Math.round(str(us) * 5) + ').');

    // Banc.
    add('bench', (A.bench - B.bench) * 0.35, 'Le banc a fait la différence : ' + A.bench + ' pts contre ' + B.bench + '.',
      'Banc dominé : ' + B.bench + ' pts pour leurs remplaçants contre ' + A.bench + '.');

    // Série décisive.
    var rA = m.bestRun[us], rB = m.bestRun[them];
    if (Math.max(rA.pts, rB.pts) >= 10) {
      var mine = rA.pts >= rB.pts, r = mine ? rA : rB;
      add('run', (mine ? 1 : -1) * r.pts * 0.45, 'Un ' + r.pts + '-0 ' + qName(r.q) + ' a fait basculer le match.',
        'Leur ' + r.pts + '-0 ' + qName(r.q) + ' a fait basculer le match.');
    }

    // Exclusions et blessures pendant la rencontre.
    var lost = function (i) {
      return m.roster[i].filter(function (p) { return m.out[p.id] && m.box[p.id].sec < 30 * 60 && BM.ovrRaw(p) >= 14; });
    };
    var la = lost(us), lb = lost(them);
    if (la.length || lb.length) {
      var who = function (arr) { return arr.map(function (p) { return BM.shortName(p) + (m.box[p.id].pf >= BM.FOUL_OUT ? ' (6 fautes)' : ' (blessé)'); }).join(', '); };
      add('out', (lb.length - la.length) * 4, 'Ils ont perdu ' + who(lb) + ' en cours de match.', 'Vous avez perdu ' + who(la) + ' en cours de match.');
    }

    // Les leaders de la soirée.
    var tA = A.top ? m.box[A.top.id].pts : 0, tB = B.top ? m.box[B.top.id].pts : 0;
    if (Math.max(tA, tB) >= 30) {
      var me = tA >= tB, p = me ? A.top : B.top, pts = me ? tA : tB;
      add('star', (me ? 1 : -1) * (pts - 22) * 0.4, BM.shortName(p) + ' a pris feu : ' + pts + ' pts.', BM.shortName(p) + ' vous a fait mal : ' + pts + ' pts.');
    }

    // Avantage du terrain (environ 3 pts en NBA).
    add('home', us === 0 ? 1.5 : -1.5, 'L\'avantage du terrain a joué.', 'Match à l\'extérieur, face à leur public.');

    var winSign = won ? 1 : -1;
    var keys = F.filter(function (x) { return x.pts * winSign > 0.6; }).sort(function (a, b) { return Math.abs(b.pts) - Math.abs(a.pts); });
    var other = F.filter(function (x) { return x.pts * winSign < -0.6 && x.k !== 'home'; }).sort(function (a, b) { return Math.abs(b.pts) - Math.abs(a.pts); });
    var margin = Math.abs(m.score[us] - m.score[them]);
    return {
      won: won, margin: margin,
      close: margin <= 3,
      keys: keys.slice(0, 3).map(function (x) { return { k: x.k, t: x.t, pts: Math.round(Math.abs(x.pts) * 10) / 10 }; }),
      plus: other.slice(0, 1).map(function (x) { return { k: x.k, t: x.t, pts: Math.round(Math.abs(x.pts) * 10) / 10 }; })
    };
  };
})();
