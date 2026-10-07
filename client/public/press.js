/**
 * Press: a stamping press on a heavy base. The pointer's height drives the stamp
 * down, and as it lands a card rises out of the slot in front of it with a hole
 * punched and three rules struck across it. The read-out names the card.
 *
 * The pattern: one continuous input. Where the pointer is sets how far the press
 * has come; a spring carries the stamp, because the target moves every frame. The
 * card's own plane never moves, so nothing can chase itself. The slider is how
 * hard the press bears down, which is how proud a finished card stands.
 */
const {
  Cam, clamp, fillet, fit, lerp, poly, proj, rad, seg,
  stepS, disposer, mk, place, pointer, reflect, register, solid, put, prism, rings,
} = HL;

const BX = 40, BY = 27, BZ = 9;          // the base
const COL_Y = -BY + 7;                    // the column stands at the back
const HEAD_Z = 39, HEAD_T = 7;            // the head slab it hangs from
const CW = 30, CH = 17;                   // a card
const CARD_Y = 11;                        // the slot's mouth, at the front

const SHAPE = fillet(
  [[0, 0], [CW, 0], [CW, CH - 4], [CW / 2 + 4, CH], [CW / 2 - 4, CH], [0, CH - 4]],
  [1.6, 1.6, 1.2, 1.8, 1.8, 1.2],
);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let force = value;

  const C = Cam(45, 0.5, 2.02);
  fit(C, [
    [-BX - 4, -BY - 4, 0], [BX + 4, BY + 4, 0],
    [-BX - 4, -BY - 4, HEAD_Z + HEAD_T], [BX + 4, BY + 4, HEAD_Z + HEAD_T],
    [-BX - 4, BY + 4, BZ + 14 + CH * 0.4],
  ], 200, 166);
  const P = proj(C), front = HL.facing(C);

  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, HL.rrect(-BX, -BY, BX, BY, 7, 6), 0, 14);

  // the base, then the column and head behind it, all standing still
  const [bring, bcrease] = rings(-BX, -BY, BX, BY, 7, 2);
  put(solid(g), prism(P, front, bring, bcrease, 0, BZ));
  for (const [x0, y0, x1, y1, z0, z1] of [
    [-8, COL_Y - 7, 8, COL_Y + 7, BZ, HEAD_Z],
    [-15, COL_Y - 9, 15, COL_Y + 5, HEAD_Z, HEAD_Z + HEAD_T],
  ]) {
    const [ring, inner] = rings(x0, y0, x1, y1, 3, 1.2);
    put(solid(g), prism(P, front, ring, inner, z0, z1));
  }

  // the slot in the base's front, and the mark the press strikes
  const slot = mk("path", { class: "nf lo" }, g);
  slot.setAttribute("d", seg(P(-CW / 2 - 2, CARD_Y + CH, BZ), P(CW / 2 + 2, CARD_Y + CH, BZ)));

  // the stamp, which does the moving
  const stampG = mk("g", {}, g);
  const stampSil = mk("path", { class: "sil" }, stampG);
  const stampCrease = mk("path", { class: "nf lo" }, stampG);
  const punch = mk("circle", { r: 1.5, class: "dot off" }, stampG);

  // the card, which comes up out of the slot
  const cardG = mk("g", {}, g);
  const cardSil = mk("path", { class: "sil" }, cardG);
  const cardCrease = mk("path", { class: "nf lo" }, cardG);
  const cardRules = mk("path", { class: "nf" }, cardG);
  const cardPunch = mk("circle", { r: 1.6, class: "dot off" }, cardG);

  const press = HL.spring(0);

  /** The stamp at `p` of its travel, and the card risen `rise` out of the slot. */
  function draw(p, rise) {
    const z = lerp(HEAD_Z - 13, BZ + CH * 0.5, p);
    const sx = -CW / 2 - 5, sy = COL_Y - 7, sw = CW + 10, sd = 22;
    const [ring, inner] = rings(sx, sy, sx + sw, sy + sd, 2.5, 1.1);
    const s = prism(P, front, ring, inner, z, z + 5);
    stampSil.setAttribute("d", s.sil);
    stampCrease.setAttribute("d", s.crease);
    place(punch, P(0, sy + sd / 2, z + 5.4));

    // the card is the same tagged shape the rack and the wall carry
    const ox = -CW / 2, oy = CARD_Y, cz = BZ - 4 + rise;
    const corner = (u, v) => P(ox + u, oy + v, cz);
    cardSil.setAttribute("d", poly(SHAPE.map((q) => corner(q[0], q[1]))));
    cardCrease.setAttribute("d", seg(corner(CW / 2 - 4, CH - 2.4), corner(CW / 2 + 4, CH - 2.4)));
    cardRules.setAttribute("d", [4.4, 8.2, 12].map((v) => seg(corner(3.6, CH - v), corner(CW - 3.6, CH - v))).join(""));
    place(cardPunch, corner(CW / 2, 3.4));
  }

  const B = register(stage, () => {
    draw(press.x, force * clamp(press.x * 1.15, 0, 1));
    return stepS(press, 1 / 60);
  });
  bag.add(B.unregister);

  /**
   * How far down the press has come, from the pointer's own height. The mapping is
   * in viewBox units and never moves, so a card rising cannot move the target.
   */
  function depth([sx, sy]) {
    return clamp((sy - 58) / 130, 0, 1);
  }

  const caption = (p) => (p > 0.42 ? "card 01" : "rest");

  function setPress(p) {
    press.t = p;
    const done = p > 0.42;
    cardSil.classList.toggle("hi", done);
    cardPunch.classList.toggle("dot", done);
    cardPunch.classList.toggle("off", !done);
    punch.classList.toggle("dot", !done);
    punch.classList.toggle("off", done);
    read.textContent = caption(p);
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setPress(depth(p)), leave: () => setPress(0) }));
  bag.add(() => svg.replaceChildren());

  draw(0, 0);
  setPress(0);

  return {
    // the slider is how hard the press bears down: it sets how proud a card stands
    set: (v) => { force = v; draw(press.x, force * clamp(press.x * 1.15, 0, 1)); },
    focus: (i) => setPress(i >= 0 ? 1 : 0),
    destroy: bag.dispose,
  };
}

hairline({
  name: "press",
  means: "A stamping press. The pointer's height drives the stamp down and a card rises finished out of the slot; the read-out names it.",
  rules: [1, 3, 4, 5, 8],
  range: [4, 10, 14],
  mount,
});
