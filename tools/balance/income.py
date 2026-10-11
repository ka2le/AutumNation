"""Income a minute and where it comes from, averaged over runs.

    python tools/balance/income.py "<runs glob>" [step minutes, default 10]

Columns: income a minute over the last <step> minutes; money a minute per kind (leaf = loose leaves, bag, clean =
cleanup bonus, metal = raw chunks, ingot, jar, gift); volumes a minute (nL leaves sold incl. bagged, nM metal chunks,
nI ingots, nJ jars incl. gift jars); and the yard (robots, land 0-2, miners, shafts, bees)."""
import json, sys, glob
runs = [json.load(open(f)) for f in sorted(glob.glob(sys.argv[1]))]
step = int(sys.argv[2]) if len(sys.argv) > 2 else 10
K = ['leaf', 'bag', 'clean', 'metal', 'ingot', 'jar', 'gift', 'nL', 'nM', 'nI', 'nJ']
M = ['robots', 'land', 'miners', 'shafts', 'bees']
print(f'{len(runs)} runs')
print('min   $/min  | ' + ' '.join(f'{k:>6}' for k in K) + ' | ' + ' '.join(f'{m:>6}' for m in M))
n = min(len(r['snaps']) for r in runs)
for i in range(step, n, step):
    agg = {k: 0 for k in K}; inc = 0; meta = {m: 0 for m in M}
    for r in runs:
        a, b = r['snaps'][i - step], r['snaps'][i]; dt = (b['t'] - a['t'])/60
        inc += (b['cash'] - a['cash'])/dt/len(runs)
        for k in K: agg[k] += (b['src'][k] - a['src'][k])/dt/len(runs)
        for m in M: meta[m] += b[m]/len(runs)
    print(f"{i:3d} {inc:8.0f} | " + ' '.join(f'{agg[k]:6.0f}' for k in K) + ' | ' + ' '.join(f'{meta[m]:6.1f}' for m in M))
print('earned by the end', [round(r['snaps'][-1]['cash']) for r in runs])
