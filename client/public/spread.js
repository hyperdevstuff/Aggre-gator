/**
 * Spread: seven cards in an arc on a low plinth, the run bowing so its middle card
 * stands nearest the reader. The card under the pointer rises off the arc and squares
 * up to face front, and the cards either side ease apart along the arc to open a gap
 * around it, staggered by distance. One hole is punched near each card's top corner,
 * in one of three heights, so a card is identifiable without a word; at rest the
 * middle card carries the bright mark and the pointer takes it. The slider is the
 * lift, in world units.
 *
 * Riffle's family — one of many — but the object is a curve, not rows in a tray.
 * Where riffle leans the neighbours away, this parts them along the arc, so the
 * gesture opens a hole in the run. The hit test reads each card's rest quad, so a
 * card rising from under the pointer cannot flip the choice.
 */
const {
  Cam, clamp, facing, fillet, fit, poly, proj, rad, seg,
  tdone, tset, tval, tween, disposer, mk, place, pointer, reflect, register,
  solid, put, prism, rings,
} = HL;

const N = 7, W = 26, H = 44, T = 1.4;      // a card
// The camera looks down the x+y diagonal, so a card turned 45° in world is exactly
// edge-on to it: the arc stays inside 28° at the ends, foreshortening a card by 12%.
const R = 105, SPREAD = 9.5, MID = 3;      // the arc, and the card lit at rest
const SQUARE = 12, LIFT = 24;              // how far the run opens, and the card's lift
const STEP = 34, PLINTH = 9;               // stagger per card of distance, and the plinth's depth
// The plinth, cut to the run's span: the ends sit forward, so it reaches nearer the
// reader than a plain rectangle.
const PLAZA = [-62, -26, 62, 20];

/**
 * Card i's angle on the arc. The run bows so its middle card stands nearest the
 * reader and its ends recede, as a hand of cards fans on a table.
 */
const arc = (i) => rad((i - MID) * SPREAD);

/** A card's outline in its own plane: u across, v up. The top-right corner is cut. */
const SHAPE = fillet(
  [[-W / 2, 0], [W / 2, 0], [W / 2, H - 6], [W / 2 - 6, H], [-W / 2, H]],
  [1.2, 1.2, 1, 1.7, 1.7],
);
const holeV = (i) => H - 8 - (i % 3) * 6;   // three heights, so the holes step across the run
/** The struck rules as [v, u0, u1]; v null rides just under that card's hole. */
const RULES = [[null, -W / 2 + 4, W / 2 - 5], [H - 22, -W / 2 + 4, W / 2 - 5], [H - 28, -W / 2 + 4, W / 2 - 9]];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value;

  // Fitted with the chosen card highest, so the frame holds at both slider ends.
  const [px0, py0, px1, py1] = PLAZA, C = Cam(45, 0.5, 1.82);
  fit(C, [
    [px0, py0, 0], [px1, py1, 0], [-56, 14, 0], [56, 14, 0],
    [-52, -10, H + LIFT + 4], [52, -10, H + LIFT + 4],
  ], 200, 158);
  const P = proj(C), front = facing(C);
  const [bring, bcrease] = rings(px0, py0, px1, py1, 9, 2.4);
  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, bring, bcrease, -PLINTH, 0));
  reflect(svg, g, P, front, bring, -PLINTH, 13);

  /** The projector for a card at angle `th`, turned `turn` and raised `lift`. */
  const seat = (th, turn, lift) => {
    const ct = Math.cos(turn), st = Math.sin(turn);
    const nx = -Math.sin(turn), ny = Math.cos(turn);
    const x = R * Math.sin(th), y = R * (Math.cos(th) - 1);
    return (u, v, o = 0) => P(x + u * ct + nx * o, y + u * st + ny * o, v + lift);
  };

  // Each card's rest quad and centre, read by the hit test. They never move, so a
  // card rising from under the pointer cannot hand its hit to a neighbour. The
  // cards stand on edge, so the pointer's height is world z, which a horizontal
  // unprojection discards — hence screen space, not world.
  const rest = [...Array(N).keys()].map((i) => {
    const at = seat(arc(i), arc(i), 0), quad = SHAPE.map((q) => at(q[0], q[1]));
    const mean = (f) => quad.reduce((s, q) => s + q[f], 0) / quad.length;
    return { quad, cx: mean(0), cy: mean(1) };
  });

  const cards = [];
  // Back to front along the arc, so a nearer card is painted last and covers the
  // one behind it.
  for (const i of [...Array(N).keys()].sort((a, b) => arc(a) - arc(b))) {
    const grp = mk("g", {}, g);
    cards[i] = {
      back: mk("path", { class: "lo" }, grp),
      face: mk("path", { class: "sil" }, grp),
      rules: mk("path", { class: "nf lo" }, grp),
      hole: mk("circle", { r: 1.35, class: "dot off" }, grp),
      lift: tween(0), splay: tween(0), square: tween(0),
    };
  }

  /** Card i at its three animated values: `u` across, `v` up, `o` out of its face. */
  function pose(i, lift, splay, square) {
    const th = arc(i) + rad(splay), w = seat(th, th * (1 - square), lift);
    const rule = ([v, u0, u1]) => seg(w(u0, v ?? holeV(i) - 4, -T), w(u1, v ?? holeV(i) - 4, -T));
    return {
      back: poly(SHAPE.map((q) => w(q[0], q[1], T))),
      face: poly(SHAPE.map((q) => w(q[0], q[1], -T))),
      rules: RULES.map(rule).join(""),
      hole: w(-W / 2 + 6.5, holeV(i), -T - 0.2),
    };
  }

  // Rule 07: a path is not rewritten on a frame where its value did not change.
  function draw(i, lift, splay, square) {
    const c = cards[i], q = pose(i, lift, splay, square);
    if (q.face === c.last) return;
    c.last = q.face;
    c.back.setAttribute("d", q.back);
    c.face.setAttribute("d", q.face);
    c.rules.setAttribute("d", q.rules);
    place(c.hole, q.hole);
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (let i = 0; i < N; i++) {
      const c = cards[i];
      draw(i, tval(c.lift, now), tval(c.splay, now), tval(c.square, now));
      if (!tdone(c.lift, now) || !tdone(c.splay, now) || !tdone(c.square, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;

  /** How much card i answers a, falling off over `span` cards each way. */
  const near = (i, a, span = 2.2) => (a < 0 ? 0 : clamp(1 - Math.abs(i - a) / span, 0, 1));

  /** Card a rises, squares up and opens a gap in the run; -1 closes it. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;

    for (let i = 0; i < N; i++) {
      const c = cards[i], on = a >= 0 && i === a, k = near(i, a);
      const away = a < 0 ? 0 : Math.sign(arc(i) - arc(a));
      const delay = Math.abs(i - from) * STEP;

      tset(c.lift, a < 0 ? 0 : on ? reach : k * reach * 0.22, now, delay);
      // Only the immediate neighbours part: a wider gap would slide the far cards
      // along the arc until they left the plinth.
      tset(c.splay, a < 0 ? 0 : away * near(i, a, 1.6) * SQUARE * clamp(reach / LIFT, 0, 1), now, delay);
      tset(c.square, on ? 1 : 0, now, delay);

      // One bright mark: the middle card holds it at rest and gives it up.
      c.face.classList.toggle("hi", on);
      c.hole.classList.toggle("dot", on || (a < 0 && i === MID));
      c.hole.classList.toggle("m", !on && a >= 0 && i === MID);
      c.hole.classList.toggle("off", !on && !(a >= 0 && i === MID));
    }

    read.textContent = a < 0 ? "rest" : String(a + 1).padStart(2, "0");
    B.wake();
  }

  /** The card whose rest quad holds the pointer. Quads overlap, so nearest centre wins. */
  function hit([sx, sy]) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) {
      if (!inPoly(sx, sy, rest[i].quad)) continue;
      const d = Math.hypot(sx - rest[i].cx, sy - rest[i].cy);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /** Crossing count: an odd number of edges straddling a horizontal ray means inside. */
  function inPoly(x, y, pts) {
    let n = 0;
    for (let k = 0, m = pts.length - 1; k < pts.length; m = k++) {
      const a = pts[k], b = pts[m];
      n += a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0] ? 1 : 0;
    }
    return n % 2 === 1;
  }
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  for (let i = 0; i < N; i++) draw(i, 0, 0, 0);
  setActive(-1);

  return {
    // The slider is the lift, so a new value has to retarget the card already up.
    set: (v) => { reach = v; const keep = act; act = -2; setActive(keep); },
    focus: setActive,
    destroy: bag.dispose,
  };
}

hairline({
  name: "spread",
  means: "Seven cards in an arc. The card under the pointer rises and squares up, and the run opens a gap around it; the read-out gives its number.",
  rules: [1, 2, 3, 5, 8],
  range: [0, 12, 26],
  mount,
});