"""Payback of every remaining price step, worked out from what each kind of thing sold for in a stretch of a run.

    python tools/balance/payback.py "<runs glob>" <from minute> <to minute>

Reads prices and multipliers straight from public/game.js (UP and GEN.market), takes the levels each run had at
<to minute>, and for every step not yet bought: gain = money a minute from the things it multiplies x (next/now - 1)
(cleanup: leaves sold a minute x extra bonus / 100), payback = cost / gain. Later steps of a track assume the earlier
ones were bought (same volume, higher price). Volume is held fixed, so this is right for price steps and wrong for
anything that changes throughput (Hotter furnace is shown with a warning). Use it on a flat stretch (the plateau) to
find steps that never pay back, or on a stage to see what a player there should buy next."""
import json, sys, glob, re, os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, '..', '..', 'public', 'game.js'), encoding='utf-8').read()
def entry(key):
    # the text of one UP entry: from 'key: {' to the next line that starts another entry (some span two lines)
    m = re.search(r'\n\s*' + key + r':\s*\{', src); rest = src[m.end():]
    n = re.search(r'\n\s*\w+:\s*\{|\n\};', rest)
    return rest[:n.start()]
def arr(key, field):
    m = re.search(field + r':\[([^\]]*)\]', entry(key))
    return [float(x) for x in m.group(1).split(',')] if m else None
TR = {}
for k in ['bagPrice', 'metalPrice', 'honeyPrice', 'giftPrice', 'smeltSpeed', 'ingotGrade', 'slag', 'cleanup']:
    TR[k] = (arr(k, 'costs'), arr(k, 'vals'))
lp = re.search(r"leafPrice:\s*\{[^\n]*?base:([\d.]+), mul:([\d.]+)", src)
def nice(v): return round(v*20)/20 if v < 1 else round(v*4)/4 if v < 20 else round(v)
TR['leafPrice'] = ([nice(float(lp.group(1))*float(lp.group(2))**l) for l in range(5)], [1.2**l for l in range(6)])
mk = re.search(r"market:\s*\{[^\n]*?cost:\[([^\]]*)\]", src)
TR['market'] = ([float(x) for x in mk.group(1).split(',')], [1, 1.1, 1.2, 1.3])
SRC = {'leafPrice': ['leaf', 'bag'], 'bagPrice': ['bag'], 'metalPrice': ['metal', 'ingot'], 'honeyPrice': ['jar', 'gift'], 'giftPrice': ['gift'],
       'ingotGrade': ['ingot'], 'slag': ['ingot'], 'smeltSpeed': ['ingot'], 'market': ['leaf', 'bag', 'metal', 'ingot', 'jar', 'gift', 'clean']}
runs = [json.load(open(f)) for f in sorted(glob.glob(sys.argv[1]))]
a_m, b_m = int(sys.argv[2]), int(sys.argv[3])
rows = {}
for d in runs:
    sn = d['snaps']; a, b = sn[a_m], sn[min(b_m, len(sn) - 1)]; dt = (b['t'] - a['t'])/60
    r = {k: (b['src'][k] - a['src'][k])/dt for k in b['src']}; inc = (b['cash'] - a['cash'])/dt
    for k, (costs, vals) in TR.items():
        L = (b['gen'].get('market', 0) if k == 'market' else b['lv'].get(k, 0))
        money = r['nL'] if k == 'cleanup' else sum(r[s] for s in SRC[k])
        for l in range(L, len(costs)):
            if k == 'cleanup': g = money*(vals[l + 1] - vals[l])/100
            elif k == 'slag': g = money*((1 + vals[l + 1])/(1 + vals[l]) - 1); money *= (1 + vals[l + 1])/(1 + vals[l])
            else: g = money*(vals[l + 1]/vals[l] - 1); money *= vals[l + 1]/vals[l]
            rows.setdefault((k, l + 1), []).append((costs[l], g, inc))
print(f'{len(runs)} runs, minutes {a_m}-{b_m}')
print(f"{'step':16s}{'cost':>8}{'gain/min':>10}{'payback':>9}{'save':>7}")
for (k, l), v in sorted(rows.items(), key=lambda x: (x[0][0], x[0][1])):
    c = v[0][0]; g = sum(x[1] for x in v)/len(v); inc = sum(x[2] for x in v)/len(v)
    pb = c/g if g > 0 else float('inf')
    print(f"{k + ' ' + str(l):16s}{c:8.0f}{g:10.1f}{pb:9.1f}{c/inc:7.1f}" + ('  <- over 5' if pb > 5 else '') + ('  (only if smelters are busy)' if k == 'smeltSpeed' else ''))
