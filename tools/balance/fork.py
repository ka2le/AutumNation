"""Counterfactual test: take the save state a recorded run had at a given minute, change something, and measure
income for 6 minutes (after 2 minutes to settle) against the unchanged state. Every variant uses the same random
seeds, so differences are mostly the change itself, not luck.

    python tools/balance/fork.py <run.json> <minute: a multiple of 10> <variants.js> <out.js> [reps, default 3]
    node tools/balance/run.js <out.js> <result.json>
    python tools/balance/fork.py --show <result.json>

variants.js is a JS object literal of name: S => { change the save state S }. The first one should be base: S => {}.
See fork-variants-example.js."""
import json, sys
SRC = ['leaf', 'bag', 'metal', 'ingot', 'jar', 'gift', 'clean']
if sys.argv[1] == '--show':
    d = json.load(open(sys.argv[2])); b = None
    for v, o in d.items():
        inc = sum(sum(x[s] for s in SRC) for x in o)/len(o)
        b = inc if b is None else b
        print(f"{v:32s} {inc:8.0f}/min {inc - b:+7.0f}  " + ' '.join(f"{s}:{sum(x[s] for x in o)/len(o):.0f}" for s in SRC + ['nL', 'nI', 'nJ']))
    sys.exit()
runfile, minute, varjs, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
reps = int(sys.argv[5]) if len(sys.argv) > 5 else 3
d = json.load(open(runfile))
st = [s['state'] for s in d['snaps'] if s['state'] and round(s['t']/60) == minute]
if not st: sys.exit('no saved state at minute %d (states are kept every 10 minutes)' % minute)
js = r"""
(() => {
const Y = __leafYard;
function rng(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R0 = Math.random, st = %s, S0 = JSON.parse(st);
const vars = %s;
const res = {};
for (const v in vars){ res[v] = [];
  for (let r=0;r<%d;r++){
    Math.random = rng(1000 + r*7919); let src0 = null;
    window.__src={leaf:0,bag:0,metal:0,ingot:0,jar:0,gift:0,clean:0,nL:0,nM:0,nI:0,nJ:0};
    Y.sim(480, { noBuy: true, setup: S => { const s = JSON.parse(st); for (const k in s) S[k] = s[k]; vars[v](S); }, probe: () => { const S = Y.state(); if (!src0 && S.t >= S0.t + 120) src0 = Object.assign({}, window.__src); } });
    Math.random = R0; const o = {}; for (const k in window.__src) o[k] = (window.__src[k] - src0[k])/6; res[v].push(o);
  }
}
return JSON.stringify(res);
})()
""" % (json.dumps(st[0]), open(varjs).read(), reps)
open(out, 'w', encoding='utf-8').write(js)
