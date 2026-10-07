/**
 * Rack: nine pegs on a board, a clipped link hanging from most of them. The peg
 * nearest the pointer holds its card up and out; the ones around it tip toward
 * it a little, less with distance. The read-out names the peg and its row:
 * `peg 05 · 02`.
 *
 * The pattern: a field of discrete items. The hit test reads the board's plane
 * at peg-crown height, which never moves, and tweens carry each card to its new
 * angle, so a card lifting out from under the pointer cannot flip the choice.
 * The slider is how many pegs are loaded — the figure's own number, and the one
 * a scroll position maps onto.
 */
const {
  Cam, clamp, facing, fillet, fit, lerp, poly, proj, rad, rrect, seg,
  tdone, tset, tval, tween, disposer, mk, place, pointer, reflect, register, solid, put, prism, rings,
} = HL;

const COLS = 3, PEG = 38, PR = 4.2, PH = 15, BZ = 3;
const CW = 26, CH = 18, CT = 1.2;
// The card hangs from the peg crown. Its angle t is measured from flat: 0 lies it
// face-down against the board, 90 stands it upright. Around 55 reads as clipped
// to a stand, and shows enough face for the lines on it to be legible.
const REST = 54, TIP = 66, LIFT_T = 84, LIFT = 7, STEP = 30;

const at = (c, r) => [c * PEG + PEG / 2, r * PEG + PEG / 2];
const key = (c, r) => r * COLS + c;

/** A link card: a clipped tag, rounded, with a punched hole and three rules. */
const SHAPE = fillet(
  [[0, 0], [CW, 0], [CW, CH - 5], [CW / 2 + 4, CH], [CW / 2 - 4, CH], [0, CH - 5]],
  [1.6, 1.6, 1.2, 1.8, 1.8, 1.2],
);

/** Card on peg (x,y) at angle `t`, raised by `lift`. u across, v down, d through. */
function pose(P, x, y, t, lift) {
  const s = Math.sin(rad(t)), c = Math.cos(rad(t));
  const w = (u, v, d) => P(x + u, y + v * s + d, PH + lift - v * c);
  const rules = [5.4, 9, 12.6].map((v) => seg(w(4.4, v, CT), w(CW - 4.4, v, CT))).join("");
  return {
    back: poly(SHAPE.map((p) => w(p[0], p[1], -CT))),
    face: poly(SHAPE.map((p) => w(p[0], p[1], CT))),
    rules: seg(w(4.4, CH - 6.2, CT), w(CW - 4.4, CH - 6.2, CT)) + rules,
    punch: w(CW / 2, 2.6, CT),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let load = value;

  // Which pegs carry a card, in the order they fill. Not a sweep of the grid:
  // at rest the board has a full corner, a bare corner and a gap between them.
  const ORDER = [4, 1, 7, 3, 0, 6, 8, 2, 5];

  const C = Cam(45, 0.5, 1.62);
  const X0 = -11, Y0 = -11, X1 = COLS * PEG + 11, Y1 = COLS * PEG + 11;
  fit(C, [[X0, Y0, 0], [X1, Y1, 0], [X0, Y0, PH + LIFT], [X1, Y1, PH + LIFT], [X0, Y1, 0], [X1, Y0, 0]], 200, 166);
  const P = proj(C), front = facing(C);
  const BOARD = rrect(X0, Y0, X1, Y1, 6, 6);

  const bg = mk("g", {}, svg);
  reflect(svg, bg, P, front, BOARD, 0, 14);
  const bs = solid(bg);
  const [bring, bcrease] = rings(X0, Y0, X1, Y1, 6, 1.8);
  put(bs, prism(P, front, bring, bcrease, 0, BZ));

  const cards = new Map();
  const pegs = [];
  const order = [];
  for (let r = 0; r < COLS; r++) for (let c = 0; c < COLS; c++) order.push(c + r * COLS);
  order.sort((a, b) => { const [ax, ay] = at(a % COLS, (a / COLS) | 0), [bx, by] = at(b % COLS, (b / COLS) | 0); return ax + ay - (bx + by); });
  for (const i of order) {
    const c = i % COLS, r = (i / COLS) | 0, [x, y] = at(c, r);
    const grp = mk("g", {}, bg);
    const s = solid(grp);
    // the peg: an upright post, and a notch cut into its crown
    const [ring, inner] = rings(x - PR, y - PR, x + PR, y + PR, PR, 1);
    put(s, prism(P, front, ring, inner, BZ, PH));
    pegs.push(mk("path", { class: "nf lo", d: seg(P(x - PR + 1.6, y, PH + 0.4), P(x + PR - 1.6, y, PH + 0.4)) }, grp));
    cards.set(i, {
      c, r, x, y, grp: null, back: null, face: null, rules: null, punch: null,
      t: tween(REST + ((c * 2 + r) % 3) * 3), lift: tween(0),
    });
  }

  function attach(cd) {
    cd.grp = mk("g", {}, bg);
    cd.back = mk("path", { class: "lo" }, cd.grp);
    cd.face = mk("path", { class: "sil" }, cd.grp);
    cd.rules = mk("path", { class: "nf" }, cd.grp);
    cd.punch = mk("circle", { r: 1.5, class: "dot off" }, cd.grp);
  }
  function draw(cd, t, lift) {
    if (!cd.grp) return;
    const q = pose(P, cd.x, cd.y, t, lift);
    cd.back.setAttribute("d", q.back);
    cd.face.setAttribute("d", q.face);
    cd.rules.setAttribute("d", q.rules);
    place(cd.punch, q.punch);
  }

  const held = () => new Set(ORDER.slice(0, clamp(Math.round(load), 0, ORDER.length)));

  function sync() {
    const h = held();
    for (const [i, cd] of cards) {
      const has = h.has(i);
      if (has && !cd.grp) attach(cd);
      if (!has && cd.grp) { cd.grp.remove(); cd.grp = null; cd.punch = null; }
    }
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const cd of cards.values()) {
      draw(cd, tval(cd.t, now), tval(cd.lift, now));
      if (!tdone(cd.t, now) || !tdone(cd.lift, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  const rest = (cd) => REST + ((cd.c * 2 + cd.r) % 3) * 3;
  const caption = (a) => {
    if (a < 0) return "rest";
    const cd = cards.get(a);
    return "peg " + String(a + 1).padStart(2, "0") + " · " + String(cd.r + 1).padStart(2, "0");
  };

  /** Holds card a up (-1 lets them all back). Cards in reach tip toward it, less with distance. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    const ac = a >= 0 ? cards.get(a) : null;
    for (const [i, cd] of cards) {
      const d = ac ? Math.hypot(cd.c - ac.c, cd.r - ac.r) : 99;
      const near = clamp(1 - d / 2.2, 0, 1);
      const on = i === a;
      tset(cd.t, a < 0 ? rest(cd) : on ? LIFT_T : lerp(rest(cd), TIP, near * 0.7), now, Math.abs(i - from) * STEP);
      tset(cd.lift, a < 0 ? 0 : on ? LIFT : near * LIFT * 0.3, now, Math.abs(i - from) * STEP);
      if (cd.face) {
        cd.face.classList.toggle("hi", on);
        // the bright mark sits on one card: the rest mark at rest, the choice when chosen
        cd.punch.classList.toggle("dot", on || (a < 0 && i === ORDER[0]));
        cd.punch.classList.toggle("m", !on && a >= 0 && i === ORDER[0]);
        cd.punch.classList.toggle("off", !on && !(a >= 0 && i === ORDER[0]));
      }
    }
    read.textContent = caption(a);
    B.wake();
  }

  /** Nearest loaded peg to a world point, read on the plane at peg-crown height. */
  function hit([wx, wy]) {
    let best = -1, bd = 1e9;
    for (const i of held()) {
      const cd = cards.get(i);
      const d = Math.hypot(wx - cd.x, wy - cd.y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  bag.add(pointer(stage, {
    move: (p) => setActive(hit(HL.unproj(C, p[0], p[1], PH))),
    leave: () => setActive(-1),
  }));
  bag.add(() => svg.replaceChildren());

  sync();
  for (const cd of cards.values()) draw(cd, tval(cd.t, 0), 0);
  setActive(-1);

  return {
    set: (v) => {
      load = v; sync();
      const now = performance.now();
      for (const cd of cards.values()) draw(cd, tval(cd.t, now), tval(cd.lift, now));
      B.wake();
    },
    focus: setActive,
    destroy: bag.dispose,
  };
}

hairline({
  name: "rack",
  means: "Nine pegs on a board, a link clipped to most. The nearest holds its card up; those around it tip toward it, less with distance.",
  rules: [1, 2, 3, 5, 8],
  range: [4, 6, 9],
  mount,
});
