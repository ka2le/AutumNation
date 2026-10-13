"""When each upgrade step was bought, what it cost against income then, and its payback.

    python tools/balance/buys.py "<runs glob>" [all]

bought = runs that bought it / runs; min@ = average game minute; inc/min = income over the 3 minutes before;
save = cost / inc (minutes of income it took); pb@buy = payback in minutes the player worked out when it bought it
(price upgrades only). Price steps no run ever bought are listed as never. Pass 'all' to list robot/helper/tech buys too."""
import json, sys, glob, collections
MAXL = {'leafPrice': 7, 'bagPrice': 13, 'cleanup': 3, 'metalPrice': 6, 'honeyPrice': 6, 'giftPrice': 2, 'smeltSpeed': 3, 'ingotGrade': 5, 'slag': 3, 'market': 3}
BIG = ('land', 'plant', 'bagger', 'hive', 'metalSlot', 'honeyPack', 'shaft', 'robot', 'miner')
show_all = len(sys.argv) > 2 and sys.argv[2] == 'all'
runs = [json.load(open(f)) for f in sorted(glob.glob(sys.argv[1]))]
T = collections.defaultdict(list)
for d in runs:
    sn = d['snaps']; lv = collections.Counter()
    for t, i, key, ri, cost, why, *pb in d['log']:
        if i in ('rup', 'hup') and not show_all: continue
        k = ('tech:' + key) if i == 'tech' else (key + ('#' + str(ri) if ri is not None else '')) if i in ('rup', 'hup') else key if i in ('up', 'gen', 'hiveUp') else i
        lv[k] += 1
        m = min(int(t//60), len(sn) - 1); inc = (sn[m]['cash'] - sn[max(0, m - 3)]['cash'])/3
        T[(k, lv[k])].append((t/60, cost, inc, pb[0] if pb else None))
    for k, mx in MAXL.items():
        for L in range(lv[k] + 1, mx + 1): T[(k, L)].append((None, None, None, None))
keys = [k for k in T if show_all or k[0] in MAXL or k[0] in BIG or k[0] in ('bin', 'truck', 'metalBin', 'hiveTank', 'hiveStore', 'hopper') or k[0].startswith('tech:')]
print(f"{'upgrade':16s}{'lv':>3}{'bought':>8}{'min@':>7}{'cost':>8}{'inc/min':>9}{'save':>7}{'pb@buy':>7}")
for k in sorted(keys, key=lambda k: min([x[0] for x in T[k] if x[0] is not None] or [999])):
    R = [x for x in T[k] if x[0] is not None]; n = len(R)
    if not n: print(f"{k[0]:16s}{k[1]:3d}{0:5d}/{len(T[k])}   never"); continue
    tm = sum(x[0] for x in R)/n; c = R[0][1]; inc = sum(x[2] for x in R)/n; pbs = [x[3] for x in R if x[3]]
    print(f"{k[0]:16s}{k[1]:3d}{n:5d}/{len(T[k])}{tm:7.1f}{c:8.0f}{inc:9.0f}{c/max(inc, .01):7.1f}" + (f"{sum(pbs)/len(pbs):7.1f}" if pbs else ''))
