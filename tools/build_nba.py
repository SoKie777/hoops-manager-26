"""Convertit les pages Basketball-Reference (stats 2025-26 + contrats 2026-27) en js/nba-data.js.

Usage : python -I tools/build_nba.py <dossier_html> <sortie.js>
Le dossier doit contenir leagues_NBA_2026_per_game.html, leagues_NBA_2026_advanced.html, contracts_players.html.
Les noms de famille sont modifiés (une voyelle doublée).
"""
import json
import os
import re
import sys
import unicodedata

SRC, OUT = sys.argv[1], sys.argv[2]

# Équipes NBA -> villes africaines (conférences conservées).
TEAMS = {
    'ATL': ('Abidjan', 'Hawks', 'ABJ', 'E', '#e03a3e'),
    'BOS': ('Brazzaville', 'Celtics', 'BZV', 'E', '#008348'),
    'BRK': ('Bujumbura', 'Nets', 'BUJ', 'E', '#555555'),
    'CHO': ('Casablanca', 'Hornets', 'CAS', 'E', '#1d8cab'),
    'CHI': ('Le Caire', 'Bulls', 'CAI', 'E', '#ce1141'),
    'CLE': ('Conakry', 'Cavaliers', 'CKY', 'E', '#860038'),
    'DET': ('Djibouti', 'Pistons', 'DJI', 'E', '#c8102e'),
    'IND': ('Addis-Abeba', 'Pacers', 'ADD', 'E', '#fdbb30'),
    'MIA': ('Marrakech', 'Heat', 'MRK', 'E', '#98002e'),
    'MIL': ('Malabo', 'Bucks', 'MAL', 'E', '#00471b'),
    'NYK': ('Nairobi', 'Knicks', 'NBO', 'E', '#f58426'),
    'ORL': ('Lomé', 'Magic', 'LOM', 'E', '#0077c0'),
    'PHI': ('Freetown', '76ers', 'FNA', 'E', '#006bb6'),
    'TOR': ('Tunis', 'Raptors', 'TUN', 'E', '#ce1141'),
    'WAS': ('Windhoek', 'Wizards', 'WDH', 'E', '#002b5c'),
    'DAL': ('Dar es Salaam', 'Mavericks', 'DAR', 'W', '#00538c'),
    'DEN': ('Douala', 'Nuggets', 'DLA', 'W', '#fec524'),
    'GSW': ('Yamoussoukro', 'Warriors', 'YAM', 'W', '#1d428a'),
    'HOU': ('Harare', 'Rockets', 'HRE', 'W', '#ce1141'),
    'LAC': ('Luanda', 'Clippers', 'LAD', 'W', '#c8102e'),
    'LAL': ('Lagos', 'Lakers', 'LOS', 'W', '#552583'),
    'MEM': ('Maputo', 'Grizzlies', 'MPM', 'W', '#5d76a9'),
    'MIN': ('Mombasa', 'Timberwolves', 'MBA', 'W', '#236192'),
    'NOP': ('Nouakchott', 'Pelicans', 'NKC', 'W', '#85714d'),
    'OKC': ('Ouagadougou', 'Thunder', 'OUA', 'W', '#007ac1'),
    'PHO': ('Accra', 'Suns', 'ACC', 'W', '#e56020'),
    'POR': ('Port-Louis', 'Trail Blazers', 'PLU', 'W', '#e03a3e'),
    'SAC': ('Kinshasa', 'Kings', 'KIN', 'W', '#5a2d81'),
    'SAS': ('Dakar', 'Spurs', 'DKR', 'W', '#8a8d8f'),
    'UTA': ('Kampala', 'Jazz', 'KLA', 'W', '#6b3fa0'),
}
ALIASES = {'BKN': 'BRK', 'CHA': 'CHO', 'PHX': 'PHO'}
POS = {'PG': 'MEN', 'SG': 'ARR', 'SF': 'AIL', 'PF': 'AF', 'C': 'PIV'}
VOWELS = 'aeiouyAEIOUYàâäéèêëîïôöùûüáíóúýčćšžđ'


def table_rows(name):
    html = open(os.path.join(SRC, name), encoding='utf-8').read()
    out = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.S):
        pid = re.search(r'data-append-csv="([^"]+)"', row)
        cells = dict((k, re.sub(r'<[^>]+>', '', v).strip()) for k, v in re.findall(r'<t[dh][^>]*data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', row, re.S))
        if pid and cells:
            cells['id'] = pid.group(1)
            out.append(cells)
    return out


def num(v, default=0.0):
    try:
        return float(str(v).replace('$', '').replace(',', ''))
    except ValueError:
        return default


def team_code(t):
    t = ALIASES.get(t, t)
    return t if t in TEAMS else None


def double_in(word):
    i = 0
    while i < len(word):
        ch = word[i]
        base = unicodedata.normalize('NFD', ch)[0].lower()
        if base in 'aeiouy':
            if i + 1 < len(word) and word[i + 1].lower() == ch.lower():
                i += 2  # voyelle déjà doublée : on passe à la suivante
                continue
            return word[:i + 1] + ch.lower() + word[i + 1:]
        i += 1
    return None


def double_vowel(name):
    """Double une voyelle du nom de famille (ex. Curry -> Cuurry), sinon du prénom."""
    parts = name.split(' ', 1)
    if len(parts) < 2:
        return double_in(name) or name
    first, last = parts
    new_last = double_in(last)
    if new_last:
        return first + ' ' + new_last
    # Toutes les voyelles sont déjà doublées (ex. Green) : on triple la première.
    for i, ch in enumerate(last):
        if unicodedata.normalize('NFD', ch)[0].lower() in 'aeiouy':
            return first + ' ' + last[:i + 1] + ch.lower() + last[i + 1:]
    return name


def load_season(year):
    pg, adv = {}, {}
    for r in table_rows('leagues_NBA_%d_per_game.html' % year):
        pg.setdefault(r['id'], r)
    for r in table_rows('leagues_NBA_%d_advanced.html' % year):
        adv.setdefault(r['id'], r)
    return pg, adv


# Saison 2025-26 en priorité ; 2024-25 pour les joueurs absents ou peu utilisés (blessures longues).
per_game, advanced = load_season(2026)
season_age_offset = dict((pid, 1) for pid in per_game)
if os.path.exists(os.path.join(SRC, 'leagues_NBA_2025_per_game.html')):
    pg25, adv25 = load_season(2025)
    for pid, r in pg25.items():
        cur = per_game.get(pid)
        mp_cur = num(cur.get('games')) * num(cur.get('mp_per_g')) if cur else 0
        mp_old = num(r.get('games')) * num(r.get('mp_per_g'))
        if mp_cur < 300 and mp_old > mp_cur * 2:
            per_game[pid] = r
            advanced[pid] = adv25.get(pid, {})
            season_age_offset[pid] = 2

contracts = {}
for r in table_rows('contracts_players.html'):
    code = team_code(r.get('team_id', ''))
    if not code or r['id'] in contracts:
        continue
    years = [num(r.get('y%d' % k)) for k in range(1, 7)]
    n = 0
    for y in years:
        if y > 0:
            n += 1
        else:
            break
    if years[0] <= 0:
        continue
    contracts[r['id']] = {'team': code, 'salary': round(years[0] / 1000), 'years': max(1, n), 'name': r['player']}

# ------------------------------------------------------------------ métriques
players = []
for pid, pg in per_game.items():
    adv = advanced.get(pid, {})
    g = num(pg.get('games'))
    mpg = num(pg.get('mp_per_g'))
    mp = g * mpg
    if mp < 60:
        continue
    f36 = 36.0 / max(mpg, 1)
    fg3, fg3a = num(pg.get('fg3_per_g')) * g, num(pg.get('fg3a_per_g')) * g
    fg2, fg2a = num(pg.get('fg2_per_g')) * g, num(pg.get('fg2a_per_g')) * g
    ft, fta = num(pg.get('ft_per_g')) * g, num(pg.get('fta_per_g')) * g
    m = {
        'id': pid, 'name': pg['name_display'], 'age': int(num(pg.get('age'), 25)) + season_age_offset.get(pid, 1),
        'pos': POS.get(pg.get('pos', 'SF').split('-')[0], 'AIL'), 'mp': mp, 'mpg': mpg, 'g': g,
        'p3': (fg3 + 0.35 * 25) / (fg3a + 25),
        'p2': (fg2 + 0.52 * 40) / (fg2a + 40),
        'pft': (ft + 0.76 * 20) / (fta + 20),
        'fg3a36': num(pg.get('fg3a_per_g')) * f36,
        'fta36': num(pg.get('fta_per_g')) * f36,
        'pts36': num(pg.get('pts_per_g')) * f36,
        'ast36': num(pg.get('ast_per_g')) * f36,
        'reb36': num(pg.get('trb_per_g')) * f36,
        'ast_pct': num(adv.get('ast_pct')), 'usg': num(adv.get('usg_pct'), 18),
        'tov_pct': num(adv.get('tov_pct'), 12), 'trb_pct': num(adv.get('trb_pct')),
        'orb_pct': num(adv.get('orb_pct')), 'drb_pct': num(adv.get('drb_pct')),
        'stl_pct': num(adv.get('stl_pct')), 'blk_pct': num(adv.get('blk_pct')),
        'dbpm': num(adv.get('dbpm')), 'bpm': num(adv.get('bpm')), 'ts': num(adv.get('ts_pct'), 0.55),
        'ws': num(adv.get('ws')),
        'stats': [round(num(pg.get(k)), 1) for k in ('pts_per_g', 'trb_per_g', 'ast_per_g', 'stl_per_g', 'blk_per_g')] + [int(g)],
    }
    m['ast_tov'] = num(pg.get('ast_per_g')) / max(0.3, num(pg.get('tov_per_g')))
    players.append(m)

ref = [p for p in players if p['mp'] >= 500]


def pct(key, value):
    vals = sorted(p[key] for p in ref)
    lo = sum(1 for v in vals if v < value)
    return lo / max(1, len(vals) - 1)


POS_SIZE = {'MEN': 0.25, 'ARR': 0.35, 'AIL': 0.5, 'AF': 0.68, 'PIV': 0.85}
POS_SPEED = {'MEN': 0.78, 'ARR': 0.7, 'AIL': 0.58, 'AF': 0.42, 'PIV': 0.3}


def attrs_for(m):
    P = lambda k: pct(k, m[k])
    exp = min(1, max(0, (m['age'] - 20) / 13.0))
    youth = 1 - min(1, max(0, (m['age'] - 28) / 9.0))
    size, speed = POS_SIZE[m['pos']], POS_SPEED[m['pos']]
    v = {
        'tir3': 0.65 * P('p3') + 0.35 * P('fg3a36'),
        'tirMi': 0.4 * P('pft') + 0.3 * P('p3') + 0.3 * P('p2'),
        'fin': 0.45 * P('p2') + 0.3 * P('fta36') + 0.25 * P('pts36'),
        'lf': P('pft'),
        'pas': 0.6 * P('ast_pct') + 0.4 * P('ast36'),
        'drb': 0.4 * P('usg') + 0.35 * P('ast_pct') + 0.25 * (1 - P('tov_pct')),
        'reb': 0.5 * P('trb_pct') + 0.5 * P('reb36'),
        'defE': 0.4 * P('stl_pct') + 0.35 * P('dbpm') + 0.25 * (1 - size),
        'defI': 0.35 * P('blk_pct') + 0.35 * P('drb_pct') + 0.3 * P('dbpm'),
        'ctr': P('blk_pct'),
        'int': P('stl_pct'),
        'qi': 0.5 * P('bpm') + 0.3 * P('ast_tov') + 0.2 * exp,
        'sf': 0.5 * P('pft') + 0.3 * P('ts') + 0.2 * exp,
        'act': 0.5 * P('orb_pct') + 0.5 * P('mpg'),
        'lead': 0.5 * exp + 0.5 * P('ws'),
        'vit': 0.6 * speed + 0.25 * P('stl_pct') + 0.15 * youth,
        'det': 0.5 * P('blk_pct') + 0.3 * P('orb_pct') + 0.2 * youth,
        'for': 0.6 * size + 0.4 * P('drb_pct'),
        'end': 0.6 * P('mpg') + 0.4 * youth,
    }
    quality = 0.5 * P('bpm') + 0.5 * P('mpg')
    shift = (quality - 0.5) * 5
    trust = min(1.0, m['mp'] / 800.0)  # petit échantillon : on resserre vers la moyenne
    out = {}
    for k, x in v.items():
        val = 2 + 16 * x + shift
        val = 9 + (val - 9) * trust
        out[k] = int(max(1, min(20, round(val))))
    grav = {
        'off': 0.55 * P('fg3a36') + 0.45 * P('p3') - 0.15 * P('usg') + 0.15,
        'on': 0.45 * P('usg') + 0.3 * P('pts36') + 0.25 * P('ast_pct'),
        'def': 0.35 * P('dbpm') + 0.35 * max(P('blk_pct'), P('stl_pct')) + 0.3 * P('drb_pct'),
    }
    g = {k: int(max(1, min(20, round(9 + ((2 + 17 * x + shift * 0.6) - 9) * trust)))) for k, x in grav.items()}
    return out, g


ATTR_KEYS = ['tir3', 'tirMi', 'fin', 'lf', 'pas', 'drb', 'reb', 'defE', 'defI', 'ctr', 'int', 'qi', 'sf', 'act', 'lead', 'vit', 'det', 'for', 'end']

result = []
seen = set()
for m in players:
    a, gv = attrs_for(m)
    c = contracts.get(m['id'])
    team = c['team'] if c else None
    if not c and m['mp'] < 300:
        continue  # agents libres anecdotiques
    result.append({
        'n': double_vowel(m['name']), 'age': m['age'], 'pos': m['pos'], 't': team,
        'sal': c['salary'] if c else None, 'yrs': c['years'] if c else None,
        'a': [a[k] for k in ATTR_KEYS], 'g': [gv['off'], gv['on'], gv['def']], 's': m['stats'],
    })
    seen.add(m['id'])

# Joueurs sous contrat sans statistiques 2025-26 (rookies, blessés longue durée) : profil générique selon le salaire.
rookies = [(pid, c) for pid, c in contracts.items() if pid not in seen]
for pid, c in rookies:
    result.append({'n': double_vowel(c['name']), 'age': None, 'pos': None, 't': c['team'], 'sal': c['salary'], 'yrs': c['years'], 'a': None, 'g': None, 's': None})

teams = [{'code': k, 'city': v[0], 'nick': v[1], 'short': v[2], 'conf': v[3], 'color': v[4]} for k, v in TEAMS.items()]
data = {'season': '2026-27', 'source': 'Basketball-Reference (stats 2025-26, contrats 2026-27)', 'attrKeys': ATTR_KEYS, 'teams': teams, 'players': result}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Généré par tools/build_nba.py — ne pas modifier à la main.\n')
    f.write('var BM = globalThis.BM = globalThis.BM || {};\nBM.NBA = ')
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')

by_team = {}
for p in result:
    by_team[p['t']] = by_team.get(p['t'], 0) + 1
print('joueurs :', len(result), '| sans stats :', len(rookies), '| agents libres :', by_team.get(None, 0))
print('effectifs :', sorted((k, v) for k, v in by_team.items() if k))
