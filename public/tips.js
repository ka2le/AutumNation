// V37: one tooltip for the whole game, in the same paper-and-kraft look as the goal pills' tips.
// Every `title` attribute anywhere on the page (cards, HUD, buttons, task chips…) is moved to `data-tip` as soon as it
// appears (a MutationObserver), so the browser's plain white tooltip never shows. Instead:
//   - mouse: hover something with a tip and it shows after a short pause (straight away when moving between tips);
//   - touch: tap something with a tip to show it, tap it again (or anywhere else) to hide it. Buttons and other things
//     that do something on a tap keep doing that; for those, press and hold to see the tip. A greyed-out (locked)
//     button shows its tip on a tap, since a tap does nothing there.
// The tip follows a card being redrawn (the row is found again at the same spot) and goes when its card closes.
(function(){
  'use strict';
  const box = document.createElement('div');
  box.id = 'tipBox'; box.setAttribute('role', 'tooltip'); box.hidden = true;
  const HOLD_MS = 420, HOVER_MS = 380, MOVE_TOL = 9;
  let cur = null;   // { el, text, touch, x, y }
  let lastHide = 0;

  // --- titles → data-tip --------------------------------------------------------------------------------------------
  function strip(el){
    const t = el.getAttribute('title');
    if (t == null) return;
    el.removeAttribute('title');
    if (t) el.setAttribute('data-tip', t); else el.removeAttribute('data-tip');
    if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t);
  }
  function sweep(root){
    if (root.nodeType !== 1) return;
    if (root.hasAttribute('title') && !(root instanceof SVGElement && root.tagName === 'title')) strip(root);
    root.querySelectorAll('[title]').forEach(strip);
  }
  const mo = new MutationObserver(list => {
    for (const m of list){
      if (m.type === 'attributes'){ if (m.target.nodeType === 1 && m.target.hasAttribute('title')) strip(m.target); }
      else for (const n of m.addedNodes) sweep(n);
    }
  });

  // --- finding what a point is over -----------------------------------------------------------------------------------
  const tipOf = el => el && el.closest ? el.closest('[data-tip],[title]') : null;
  const textOf = el => { if (el.hasAttribute('title')) strip(el); return (el.getAttribute('data-tip') || '').trim(); };
  const INTERACTIVE = 'button,a[href],input,select,textarea,label,[data-act],.chip,[role="button"],[role="option"]';
  function acts(target, tipEl){
    // does a tap here do something of its own (so the tip waits for a long press)?
    const a = target.closest(INTERACTIVE);
    if (!a || !(a === tipEl || a.contains(tipEl) || tipEl.contains(a))) return false;
    if (a.disabled || a.getAttribute('aria-disabled') === 'true') return false;   // locked: a tap only says why
    return true;
  }

  // --- showing ----------------------------------------------------------------------------------------------------------
  function place(){
    if (!cur) return;
    const r = cur.el.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight, M = 8, G = 8;
    box.style.left = '0px'; box.style.top = '0px';
    const b = box.getBoundingClientRect();
    let x = r.left + r.width/2 - b.width/2;
    x = Math.max(M, Math.min(vw - M - b.width, x));
    const above = r.top - G - b.height, below = r.bottom + G;
    // fingers cover what's under them, so touch tips prefer above; the mouse pointer sits on top, so mouse tips go below
    let y, up;
    if (cur.touch) { up = above >= M || below + b.height > vh - M; }
    else { up = below + b.height > vh - M && above >= M; }
    y = up ? Math.max(M, above) : Math.min(vh - M - b.height, below);
    box.classList.toggle('up', up);
    box.style.left = Math.round(x) + 'px'; box.style.top = Math.round(y) + 'px';
    // the little point on the box aims at the middle of the thing
    box.style.setProperty('--ax', Math.round(Math.max(12, Math.min(b.width - 12, r.left + r.width/2 - x))) + 'px');
  }
  function show(el, text, touch){
    const r = el.getBoundingClientRect();
    cur = { el, text, touch, x: r.left + r.width/2, y: r.top + r.height/2 };
    box.textContent = text;
    box.hidden = false; box.classList.remove('on');
    place();
    void box.offsetWidth; box.classList.add('on');
  }
  function hide(){
    if (!cur) return;
    cur = null; lastHide = performance.now();
    box.classList.remove('on'); box.hidden = true;
  }

  // keep the tip on its thing through card redraws; drop it when the thing is gone
  function follow(){
    if (!cur) return;
    if (!cur.el.isConnected){
      const at = document.elementFromPoint(cur.x, cur.y), t = tipOf(at);
      if (t && textOf(t) === cur.text) cur.el = t;
      else { hide(); return; }
    }
    const r = cur.el.getBoundingClientRect();
    if (!r.width && !r.height){ hide(); return; }
    cur.x = r.left + r.width/2; cur.y = r.top + r.height/2;
    place();
  }

  // --- mouse --------------------------------------------------------------------------------------------------------
  let mx = -1, my = -1, mouseIn = false, mouseDown = false, pend = null, pendT = 0;
  function hoverTick(){
    if (!mouseIn || mouseDown){ pend = null; if (cur && !cur.touch) hide(); return; }
    const at = document.elementFromPoint(mx, my), t = tipOf(at), text = t ? textOf(t) : '';
    if (!text){ pend = null; if (cur && !cur.touch) hide(); return; }
    if (cur && cur.text === text && (cur.el === t || !cur.el.isConnected)){ cur.el = t; return; }
    const warm = (cur && !cur.touch) || performance.now() - lastHide < 400;
    if (warm){ show(t, text, false); pend = null; return; }
    if (!pend || pend.text !== text){ pend = { el: t, text }; pendT = performance.now(); return; }
    pend.el = t;
    if (performance.now() - pendT >= HOVER_MS){ show(t, text, false); pend = null; }
  }

  // --- touch / pen ----------------------------------------------------------------------------------------------------
  let down = null, eatClick = false;
  function onDown(e){
    if (e.pointerType === 'mouse'){ mouseDown = true; hide(); return; }
    eatClick = false;
    let t = tipOf(e.target);
    // on a card row, a tap on its picture or its numbers shows the row's tip too (the name is a small target on a phone)
    if (!t && e.target.closest){ const row = e.target.closest('#card .row'); if (row && !e.target.closest(INTERACTIVE)) t = row.querySelector('.n[data-tip]'); }
    const text = t ? textOf(t) : '';
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, t, text, act: t ? acts(e.target, t) : false, held: false, timer: 0 };
    if (t && text && down.act){
      const d = down;
      d.timer = setTimeout(() => { if (down === d){ d.held = true; eatClick = true; show(d.t, d.text, true); } }, HOLD_MS);
    }
  }
  function onMove(e){
    if (e.pointerType === 'mouse'){ mx = e.clientX; my = e.clientY; mouseIn = true; return; }
    if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > MOVE_TOL){
      clearTimeout(down.timer);
      if (!down.held) down = null;
      else { down = null; hide(); }   // a held press that turns into a drag (a task chip): let the drag have the screen
    }
  }
  function onUp(e){
    if (e.pointerType === 'mouse'){ mouseDown = false; return; }
    const d = down; down = null;
    if (!d || e.pointerId !== d.id){ return; }
    clearTimeout(d.timer);
    if (d.held) return;                       // the long press already showed it; leave it up until the next tap
    if (d.t && d.text && !d.act){
      if (cur && cur.text === d.text) hide();   // tap it again: gone
      else show(d.t, d.text, true);
      return;
    }
    hide();                                     // a tap anywhere else puts it away
  }
  function onClick(e){
    if (eatClick){ eatClick = false; e.preventDefault(); e.stopPropagation(); }
  }

  function init(){
    document.body.appendChild(box);
    const h = document.getElementById('hCash');   // the cash tag's "Cash" tip would only get in the way of its triple tap
    if (h && h.getAttribute('title') === 'Cash'){ h.removeAttribute('title'); h.setAttribute('aria-label', 'Cash'); }
    sweep(document.body);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
    addEventListener('pointerdown', onDown, true);
    addEventListener('pointermove', onMove, { capture: true, passive: true });
    addEventListener('pointerup', onUp, true);
    addEventListener('pointercancel', e => { if (down && e.pointerId === down.id){ clearTimeout(down.timer); down = null; } }, true);
    addEventListener('click', onClick, true);
    addEventListener('contextmenu', e => { if (eatClick || (cur && cur.touch)) e.preventDefault(); }, true);
    document.addEventListener('mouseleave', () => { mouseIn = false; });
    addEventListener('blur', () => { mouseIn = false; hide(); });
    // a card body scrolling (or putting its scroll back after a redraw): the tip moves with its row, and goes once the row
    // has scrolled out of sight
    addEventListener('scroll', e => {
      if (!cur || !e.target.contains || !e.target.contains(cur.el)) return;
      const c = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : null, r = cur.el.getBoundingClientRect(), y = r.top + r.height/2;
      if (c && (y < c.top || y > c.bottom)) hide(); else follow();
    }, true);
    addEventListener('wheel', () => { if (cur && cur.touch) hide(); }, { capture: true, passive: true });
    addEventListener('resize', hide);
    addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    setInterval(() => { hoverTick(); follow(); }, 90);
  }
  if (document.body) init(); else addEventListener('DOMContentLoaded', init);
})();
