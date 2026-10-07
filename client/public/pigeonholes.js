/**
 * Pigeonholes: a sorting wall of nine pockets in three rows. The card in the
 * pocket nearest the pointer slides clear of the slot and its row steps forward,
 * so the wall reads as three tiers of nesting. The read-out names the pocket as
 * row and column: `slot 2·3`.
 *
 * The pattern: discrete items in a wall. The pocket under the pointer is found
 * from the wall's own grid, read at each pocket's own mid height, so a card
 * sliding out cannot change the answer. One tween per card, staggered by how far
 * the pocket is from the chosen one, spreads the gesture along the row. The
 * slider is how far a chosen card stands clear of the wall, in world units.
 */
const {
  Cam, clamp, facing, fillet, fit, poly, proj, rad, seg,
  tdone, tset, tval, tween, disposer, mk, place, pointer, register, solid, put, prism, rings,
} = HL;

const ROWS = 3, COLS = 3, GAP = 38, W = 30, H = 20, WT = 2;
const WALL_H = 74, TIP = 26;

/** Pocket r,c: [x, z] of its mouth's foot on the wall's face. */
const pocket = (r, c) => [c * GAP + 5, 6 + r * 23];
const X1 = COLS * GAP + 5 + W, Z1 = 6 + (ROWS - 1) * 23 + H;

const SHAPE = fillet(
  [[0, 0], [W, 0], [W, H - 4], [W / 2 + 3.2, H], [W / 2 - 3.2, H], [0, H - 4]],
  [1.4, 1.4, 1.1, 1.6, 1.6, 1.1],
);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value;

  const C = Cam(45, 0.5, 1.56);
  fit(C, [[-6, -6, 0], [X1 + 6, 8, 0], [-6, -6, Z1 + 18], [X1 + 6, 8, Z1 + 18], [X1 + 6, 30, 0]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [bring, bcrease] = rings(-6, -6, X1 + 6, 8, 4, 1.8);
  put(solid(g), prism(P, front, bring, bcrease, 0, WALL_H));
  // a lip along the wall's crown, so the slab reads as a built thing
  const [lring, linner] = rings(-6, -6, X1 + 6, 2, 2, 0.9);
  put(solid(g), prism(P, front, lring, linner, WALL_H - 4, WALL_H));

  const slots = [];
  for (let r = ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    const [x, z] = pocket(r, c);
    const grp = mk("g", {}, g);
    // the pocket mouth, flush with the face: a plate with a sill under it
    const [ring, inner] = rings(x, -1.4, x + W, 0.6, 2.5, 1);
    put(solid(grp), prism(P, front, ring, inner, z, z));
    const sill = mk("path", { class: "nf lo", d: seg(P(x + 2, 0.6, z + 0.4), P(x + W - 2, 0.6, z + 0.4)) }, grp);

    const card = mk("g", {}, g);
    const back = mk("path", { class: "lo" }, card);
    const face = mk("path", { class: "sil" }, card);
    const rules = mk("path", { class: "nf" }, card);
    const punch = mk("circle", { r: 1.5, class: "dot off" }, card);
    slots.push({ i, r, c, x, z, sill, back, face, rules, punch, out: tween(0), tip: tween(0) });
  }

  /**
   * Card in pocket (x,z), standing `o` clear of the face and tipped `tp` degrees
   * back into it. u runs across the face, v up it, d along its own normal, so the
   * card slides out of the pocket the way a card comes out of a card pocket.
   */
  function pose(s, o, tp) {
    const a = rad(tp), sn = Math.sin(a), cs = Math.cos(a);
    const w = (u, v, d) => P(s.x + u, -(v * sn) + (d + o) * cs, s.z + v * cs + (d + o) * sn);
    return {
      back: poly(SHAPE.map((q) => w(q[0], q[1], -WT))),
      face: poly(SHAPE.map((q) => w(q[0], q[1], WT))),
      rules: [4.6, 8.4, 12.2].map((v) => seg(w(3.4, H - v, WT), w(W - 3.4, H - v, WT))).join(""),
      punch: w(W / 2, H - 2.6, WT),
    };
  }

  function draw(s, o, tp) {
    const q = pose(s, o, tp);
    s.back.setAttribute("d", q.back);
    s.face.setAttribute("d", q.face);
    s.rules.setAttribute("d", q.rules);
    place(s.punch, q.punch);
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const s of slots) {
      draw(s, tval(s.out, now), tval(s.tip, now));
      if (!tdone(s.out, now) || !tdone(s.tip, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  const caption = (a) => (a < 0 ? "rest" : "slot " + (slots[a].r + 1) + "·" + (slots[a].c + 1));

  /** Slides card a clear of its pocket (-1 lets them all back); its row's others ease forward a little. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    const ar = a >= 0 ? slots[a].r : -1;
    for (const s of slots) {
      const on = s.i === a;
      const near = a >= 0 && s.r === ar ? clamp(1 - Math.abs(s.c - slots[a].c) / 2.6, 0, 1) : 0;
      const k = a < 0 ? 0 : on ? 1 : near * 0.28;
      tset(s.out, reach * clamp(k, 0, 1), now, Math.abs(s.i - from) * 34);
      tset(s.tip, a < 0 ? 0 : on ? TIP : near * TIP * 0.4, now, Math.abs(s.i - from) * 34);
      s.face.classList.toggle("hi", on);
      // one bright mark at rest, on the middle pocket; it gives the bright up when one is chosen
      s.punch.classList.toggle("dot", on || (a < 0 && s.i === 4));
      s.punch.classList.toggle("m", !on && a >= 0 && s.i === 4);
      s.punch.classList.toggle("off", !on && !(a >= 0 && s.i === 4));
    }
    read.textContent = caption(a);
    B.wake();
  }

  /**
   * The pocket whose mouth holds the pointer, read at that pocket's own mid
   * height. Each is a different plane, and none of them moves.
   */
  function hit([sx, sy]) {
    let best = -1, bd = 1e9;
    for (const s of slots) {
      const [wx, wy] = HL.unproj(C, sx, sy, s.z + H / 2);
      const d = Math.hypot(wx - (s.x + W / 2), wy);
      if (d < bd) { bd = d; best = s.i; }
    }
    return best;
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  for (const s of slots) draw(s, 0, 0);
  setActive(-1);

  return {
    set: (v) => { reach = v; const keep = act; act = -2; setActive(keep); },
    focus: setActive,
    destroy: bag.dispose,
  };
}

hairline({
  name: "pigeonholes",
  means: "A wall of nine pockets in three rows. The card nearest the pointer slides clear and its row steps forward; the read-out gives the row.",
  rules: [1, 2, 3, 5, 8],
  range: [0, 7, 14],
  mount,
});
