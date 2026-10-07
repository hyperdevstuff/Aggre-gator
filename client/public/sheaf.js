/**
 * Sheaf: a shelf of three banded bundles, each one collection tied up. The
 * bundle nearest the pointer is lifted clear of the shelf, band and all, and the
 * others lean back a little as it goes; leave it and it settles back down. The
 * read-out names it: `bundle 2`.
 *
 * The pattern: discrete items, where the answer is a departure rather than a
 * lean. The pointer is tested where each bundle sits on the shelf, a plane that
 * never moves, so a bundle rising cannot change the choice. The rise is a
 * spring, because it follows the pointer coming and going; the lean is a tween,
 * because that is a discrete change.
 */
const {
  Cam, clamp, facing, fit, poly, proj, rad, rrect, seg,
  tdone, tset, tval, tween, spring, stepS, disposer, mk, place, pointer, reflect, register, solid, put, prism, rings,
} = HL;

const N = 3, W = 30, D = 22, SHEETS = 5, ST = 4.6;
const SW = W + 5;                       // one bundle's pitch along the shelf
const X0 = -9, Y0 = -9, X1 = N * SW + W + 11, Y1 = D + 15, SHELF_H = 3.6;
const TOP = SHELF_H + SHEETS * ST;

/** Bundle i's foot on the shelf. */
const foot = (i) => [i * SW + 9, 7];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let rise = value;

  const C = Cam(45, 0.5, 1.58);
  fit(C, [[X0, Y0, 0], [X1, Y1, 0], [X0, Y0, TOP + 30], [X1, Y1, TOP + 30], [X0, Y1, 0], [X1, Y0, 0]], 200, 166);
  const P = proj(C), front = facing(C);
  const SHELF = rrect(X0, Y0, X1, Y1, 4, 6);

  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, SHELF, 0, 12);
  const [sring, sinner] = rings(X0, Y0, X1, Y1, 4, 1.6);
  put(solid(g), prism(P, front, sring, sinner, 0, SHELF_H));

  // far bundle first, so a rising one is always painted over those behind it
  const bundles = [];
  for (let i = N - 1; i >= 0; i--) {
    const [x, y] = foot(i);
    const grp = mk("g", {}, g);
    const b = {
      i, x, y, grp,
      sheets: [],
      side: mk("path", { class: "lo" }, grp),
      crease: mk("path", { class: "nf lo" }, grp),
      band: mk("path", { class: "sil" }, grp),
      bandCrease: mk("path", { class: "nf lo" }, grp),
      dot: mk("circle", { r: 1.7, class: "dot off" }, grp),
      up: spring(0), lean: tween(0),
    };
    for (let k = 0; k < SHEETS; k++) b.sheets.push(mk("path", { class: "sil" }, grp));
    bundles.push(b);
  }

  /**
   * Bundle b, risen by `up` and leaned `th` degrees about its foot. `w` is a point
   * on its own plane: u across the bundle, v up it, h out of it. Each sheet is a
   * real plate, one on the next, so the edges step the way a bound stack does.
   */
  function draw(b, up, th) {
    const s = Math.sin(rad(th)), c = Math.cos(rad(th));
    const base = SHELF_H + up;
    const w = (u, v, h) => P(b.x + u * c + h * s, b.y + u * s - h * c, base + v * c);
    for (let k = 0; k < SHEETS; k++) {
      const z = k * ST;
      // a sheet seen edge on: its thickness across, then its top face, which is
      // the only part of a flat sheet the camera above actually sees
      b.sheets[k].setAttribute("d",
        poly([w(0, z, 0), w(W, z, 0), w(W, z, ST), w(0, z, ST)])
        + poly([w(0, z + ST, 0), w(W, z + ST, 0), w(W, z + ST, D), w(0, z + ST, D)]));
    }
    // the near spine, so the stack reads as one bound object rather than loose sheets
    b.side.setAttribute("d", seg(w(0, 0, 0), w(0, SHEETS * ST, 0)));
    b.crease.setAttribute("d", seg(w(2.5, SHEETS * ST * 0.5, 0.3), w(2.5, SHEETS * ST, 0.3)));
    // The band: a loop of one unit's width going right round the stack, at a
    // quarter of its height, standing a little proud of it on every side.
    const bv = SHEETS * ST * 0.34, t = 1.6, m = 0.9;
    const loop = [
      w(0, bv, -m), w(W, bv, -m), w(W, bv, D + m), w(0, bv, D + m),
      w(0, bv + t, -m), w(W, bv + t, -m), w(W, bv + t, D + m), w(0, bv + t, D + m),
    ];
    b.band.setAttribute("d", poly(loop));
    // and the two edges that read as the band's rims, front and back
    b.bandCrease.setAttribute("d",
      seg(w(0, bv, -m), w(0, bv + t, -m))
      + seg(w(0, bv, D + m), w(0, bv + t, D + m)));
    place(b.dot, w(W / 2, SHEETS * ST * 0.72, 0.4));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of bundles) {
      draw(b, b.up.x, tval(b.lean, now));
      if (stepS(b.up, 1 / 60) || !tdone(b.lean, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  const caption = (a) => (a < 0 ? "rest" : "bundle " + (a + 1));

  /** Lifts bundle a clear of the shelf (-1 sets it down); the others lean back as it goes. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    for (const b of bundles) {
      const on = b.i === a;
      const near = a >= 0 ? clamp(1 - Math.abs(b.i - a) / 1.8, 0, 1) : 0;
      b.up.t = a < 0 ? 0 : on ? rise : near * rise * 0.12;
      tset(b.lean, a < 0 ? 0 : on ? 0 : near * 9, now, Math.abs(b.i - from) * 34);
      for (const sh of b.sheets) sh.classList.toggle("hi", on);
      b.band.classList.toggle("hi", on);
      // one bright mark at rest, on the middle bundle; it gives the bright up when one is chosen
      b.dot.classList.toggle("dot", on || (a < 0 && b.i === 1));
      b.dot.classList.toggle("m", !on && a >= 0 && b.i === 1);
      b.dot.classList.toggle("off", !on && !(a >= 0 && b.i === 1));
    }
    read.textContent = caption(a);
    B.wake();
  }

  /** The bundle nearest a world point, read on the shelf, which never moves. */
  function hit([wx, wy]) {
    let best = -1, bd = 1e9;
    for (const b of bundles) {
      const d = Math.hypot(wx - (b.x + W / 2), wy - (b.y + D / 2));
      if (d < bd) { bd = d; best = b.i; }
    }
    return best;
  }

  bag.add(pointer(stage, {
    move: (p) => setActive(hit(HL.unproj(C, p[0], p[1], SHELF_H + 6))),
    leave: () => setActive(-1),
  }));
  bag.add(() => svg.replaceChildren());

  for (const b of bundles) draw(b, 0, 0);
  setActive(-1);

  return {
    set: (v) => { rise = v; const keep = act; act = -2; setActive(keep); },
    focus: setActive,
    destroy: bag.dispose,
  };
}

hairline({
  name: "sheaf",
  means: "A shelf of three banded bundles. The one nearest the pointer is lifted clear and the other two lean back; the read-out names it.",
  rules: [1, 2, 3, 5, 8],
  range: [0, 14, 28],
  mount,
});
