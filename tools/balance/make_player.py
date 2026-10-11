"""Builds a page script that plays one game with tools/balance-player.js and records everything the reports need.

    python tools/balance/make_player.py <seconds> <out.js> [PAYBACK]

The output, run with run.js, is JSON: {txt: the player's own printout, snaps: one per game minute (cash, money and
counts per kind of thing sold, levels, robots, land...; the full save state every 10 minutes for fork.py),
log: every purchase [t, id, key, robot, cost, why, payback]}."""
import sys, os
secs = sys.argv[1]; out = sys.argv[2]; payback = sys.argv[3] if len(sys.argv) > 3 else '5'
here = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(here, '..', 'balance-player.js'), encoding='utf-8').read()
a = "const S = Y.state(), R = Y.robots(), B = Y.bees();"
assert s.count(a) == 1, 'balance-player.js changed: update make_player.py'
s = s.replace(a, a + """
  if (S.t >= window.__nextSnap){ window.__nextSnap += 60; window.__snaps.push({t:S.t, cash:S.totals.cash, src:Object.assign({}, window.__src), lv:Object.assign({}, S.lv), gen:Object.assign({}, S.gen), hup:Object.assign({}, S.hive.up), bees:S.hive.bees, robots:S.robots.length, land:S.land, miners:S.miners.length, shafts:S.shafts.length, plant:S.plant.built, bag:S.bag.built, hive:S.hive.built, blowers:S.blowers.length, shakers:S.shakers.length, tech:Object.keys(S.tech), smelters: Y.robots().filter(r => S.robots[r.id].prio[0][0] === 'smelt').length, smeltBusy: Y.robots().filter(r => r.st === 'smelt').length, state: Math.round(S.t) % 600 < 1 ? JSON.stringify(S) : null}); }""")
a = "Y.buy(o); log.push("
assert s.count(a) == 1, 'balance-player.js changed: update make_player.py'
s = s.replace(a, "Y.buy(o); window.__log.push([S.t, o.id, o.key||'', o.ri, o.cost, why, o.payback||null]); log.push(")
s = s.rstrip().rstrip(';')
s = ("(() => { window.__src={leaf:0,bag:0,metal:0,ingot:0,jar:0,gift:0,clean:0,nL:0,nM:0,nI:0,nJ:0}; window.__snaps=[]; window.__log=[]; window.__nextSnap=0; "
     "window.SIMT=%s; window.MARK=600; window.PAYBACK=%s; const txt = " % (secs, payback) + s +
     "; return JSON.stringify({txt, snaps: window.__snaps, log: window.__log}); })()")
open(out, 'w', encoding='utf-8').write(s)
