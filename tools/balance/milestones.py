"""Average minute of the big steps, one line per set of runs (compare before/after).

    python tools/balance/milestones.py "<runs glob>" ["<other runs glob>" ...]"""
import json, sys, glob, statistics as st
M = {'robot2': ('robot', 1), 'bagger': ('bagger', 1), 'hive': ('hive', 1), 'metal': ('metalSlot', 1), 'meadow': ('land', 1),
     'plant': ('plant', 1), 'orchard': ('land', 2), 'robot10': ('robot', 9)}
CAP = ('bin', 'truck', 'metalBin', 'hiveTank', 'hiveStore', 'hopper')
for g in sys.argv[1:]:
    runs = [json.load(open(f)) for f in sorted(glob.glob(g))]
    out = {}
    for name, (kind, nth) in M.items():
        ts = []
        for d in runs:
            c = 0
            for t, i, *_ in d['log']:
                if i == kind:
                    c += 1
                    if c == nth: ts.append(t/60); break
        if ts: out[name] = st.mean(ts)
    last = [max([t for t, i, k, *_ in d['log'] if i in ('up', 'gen') and k not in CAP] or [0])/60 for d in runs]
    out['last price step'] = st.mean(last)
    print(g, '  ' + '  '.join(f'{k} {v:.0f}' for k, v in out.items()))
