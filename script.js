const HERO_IMAGE = "images/our-photo.jpg";
const HERO_FOCUS = "50% 35%";


const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const NS = "http://www.w3.org/2000/svg";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = (n) => Math.round(n * 100) / 100;

function svgEl(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const T = {
  settle: 0.6,     
  whisperIn: 0.4,
  whisperOut: 3.1,
  frame: 2.9,      
  card: 3.8,       
  alive: 4.6,      
};


function initPortrait() {
  const fig = $("#portrait");
  const img = $("#heroImg");

  img.style.objectPosition = HERO_FOCUS;
  img.addEventListener("load", () => fig.classList.add("has-photo"), { once: true });
  img.addEventListener("error", () => fig.classList.add("no-photo"), { once: true });
  img.src = HERO_IMAGE;

  if (!finePointer || reduceMotion) return;

  fig.addEventListener("pointermove", (e) => {
    const r = fig.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    fig.style.setProperty("--rx", `${r2(-y * 4)}deg`);
    fig.style.setProperty("--ry", `${r2(x * 5)}deg`);
    fig.style.setProperty("--px", `${r2(-x * 8)}px`);
    fig.style.setProperty("--py", `${r2(-y * 8)}px`);
  });
  fig.addEventListener("pointerleave", () => {
    ["--rx", "--ry", "--px", "--py"].forEach((p) => fig.style.removeProperty(p));
  });
}


function initRunaway(onYes) {
  const yes = $("#yes");
  const no = $("#no");
  const or = $("#or");

  const lines = ["no", "nope", "not that one", "try again", "nice try", "the other one", "still no", "wrong button", "just press yes"];
  const EDGE = 14;        
  const TRIGGER = 46;     
  const YES_BUFFER = 28;  

  let loose = false;
  let done = false;
  let attempts = 0;
  let lastMove = 0;
  let box = null; 

  const viewport = () => {
    const v = window.visualViewport;
    return v
      ? { x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height }
      : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  };
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;


  function cutLoose() {
    const r = no.getBoundingClientRect();
    const spacer = document.createElement("span");
    spacer.className = "no-spacer";
    spacer.style.width = `${r.width}px`;
    spacer.style.height = `${r.height}px`;
    no.replaceWith(spacer);
    document.body.appendChild(no); 

    no.classList.add("is-loose");
    no.style.transform = `translate(${r.left}px, ${r.top}px)`;
    box = { x: r.left, y: r.top, w: r.width, h: r.height };
    no.getBoundingClientRect(); 
    no.classList.add("is-moving");
    or.classList.add("is-gone");
    loose = true;
  }

  function pickSpot(px, py, w, h) {
    const v = viewport();
    const minX = v.x + EDGE;
    const minY = v.y + EDGE;
    const maxX = Math.max(minX, v.x + v.w - w - EDGE);
    const maxY = Math.max(minY, v.y + v.h - h - EDGE);

    const y0 = yes.getBoundingClientRect();
    const avoid = {
      left: y0.left - YES_BUFFER, right: y0.right + YES_BUFFER,
      top: y0.top - YES_BUFFER, bottom: y0.bottom + YES_BUFFER,
    };

    const ideal = Math.min(v.w, v.h) * 0.42;
    let best = null;
    let bestScore = -Infinity;

    for (let i = 0; i < 60; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (overlaps({ left: x, top: y, right: x + w, bottom: y + h }, avoid)) continue;

      const fromPointer = Math.hypot(x + w / 2 - px, y + h / 2 - py);
      if (fromPointer < 120 && i < 45) continue; 

      const fromLast = Math.hypot(x - box.x, y - box.y);
      const score = -Math.abs(fromPointer - ideal) + Math.min(fromLast, 180) * 0.6 + Math.random() * 40;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    if (best) return best;

    const corners = [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]]
      .filter(([x, y]) => !overlaps({ left: x, top: y, right: x + w, bottom: y + h }, avoid))
      .sort((a, b) => Math.hypot(b[0] - px, b[1] - py) - Math.hypot(a[0] - px, a[1] - py));
    const [x, y] = corners[0] || [minX, minY];
    return { x, y };
  }

  function run(px, py) {
    if (done) return;
    const now = performance.now();
    if (now - lastMove < 140) return; 
    lastMove = now;

    if (!loose) cutLoose();
    attempts += 1;
    no.textContent = lines[Math.min(attempts, lines.length - 1)];

    const w = no.offsetWidth;
    const h = no.offsetHeight;
    if (px == null) { px = box.x + box.w / 2; py = box.y + box.h / 2; }

    const spot = pickSpot(px, py, w, h);
    box = { x: spot.x, y: spot.y, w, h };
    const tilt = r2(Math.random() * 12 - 6);
    no.style.transform = `translate(${r2(spot.x)}px, ${r2(spot.y)}px) rotate(${tilt}deg)`;

    yes.style.setProperty("--grow", (1 + Math.min(attempts, 8) * 0.025).toFixed(3));
  }

  document.addEventListener("pointermove", (e) => {
    if (done || e.pointerType === "touch") return;
    const r = loose
      ? { left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h }
      : no.getBoundingClientRect();
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
    if (Math.hypot(dx, dy) < TRIGGER) run(e.clientX, e.clientY);
  }, { passive: true });

  no.addEventListener("pointerenter", (e) => {
    if (performance.now() - lastMove < 450) return; 
    run(e.clientX, e.clientY);
  });

  no.addEventListener("pointerdown", (e) => { e.preventDefault(); run(e.clientX, e.clientY); });
  no.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.touches[0];
    run(t.clientX, t.clientY);
  }, { passive: false });
  no.addEventListener("click", (e) => { e.preventDefault(); e.stopImmediatePropagation(); run(); });
  no.addEventListener("keydown", (e) => e.preventDefault());
  no.addEventListener("focus", () => { no.blur(); run(); });

  window.addEventListener("resize", () => {
    if (!loose || done) return;
    const v = viewport();
    box.x = clamp(box.x, v.x + EDGE, v.x + v.w - box.w - EDGE);
    box.y = clamp(box.y, v.y + EDGE, v.y + v.h - box.h - EDGE);
    no.style.transform = `translate(${r2(box.x)}px, ${r2(box.y)}px)`;
  });

  yes.addEventListener("click", () => {
    if (done) return;
    done = true;
    no.classList.add("is-gone");
    setTimeout(() => no.remove(), 500);
    onYes();
  });
}

const BRANCH_A = {
  id: "a",
  box: [-40, -820, 860, 860],
  stems: [
    {
      d: "M-30 30C30-90 0-230 60-370S170-580 120-740",
      width: 3.4, at: 0, dur: 2.1, leafLen: 112,
      leaves: [[.1, 1], [.18, -1], [.27, 1], [.37, -1], [.46, 1], [.6, 1], [.68, -1], [.77, 1]],
      trumpets: [[.52, -1, .85]],
      buds: [[.86, -1, 1]],
      end: { type: "open", size: 1.05, tilt: 0 },
    },
    {
      d: "M-20 20C60-60 150-120 230-220S340-390 420-430",
      width: 2.6, at: 0.15, dur: 1.8, leafLen: 92,
      leaves: [[.14, 1], [.26, -1], [.4, 1], [.54, -1], [.68, 1]],
      end: { type: "open", size: .8, tilt: 15 },
    },
    {
      d: "M-30 30C110-20 240-70 380-80S620-60 780-150",
      width: 3, at: 0.3, dur: 2.0, leafLen: 100,
      leaves: [[.1, -1], [.2, 1], [.31, -1], [.42, 1], [.53, -1], [.66, 1], [.74, -1]],
      trumpets: [[.6, -1, .8]],
      buds: [[.83, -1, .9]],
      end: { type: "trumpet", size: 1, nod: -25 },
    },
  ],
  curls: [
    { d: "M62-380C150-410 215-360 200-310C188-272 136-278 138-312C140-334 168-338 175-320", at: 0.9, dur: 1.5 },
    { d: "M380-80C400-160 490-200 535-165C568-140 555-98 522-100C500-102 498-124 514-130", at: 1.1, dur: 1.5 },
  ],
};

const BRANCH_B = {
  id: "b",
  box: [-660, -30, 700, 700],
  stems: [
    {
      d: "M30-30C-80 30-200 50-320 70S-520 60-620 120",
      width: 2.8, at: 0.45, dur: 1.8, leafLen: 90,
      leaves: [[.12, -1], [.22, 1], [.34, -1], [.46, 1], [.58, -1], [.7, 1]],
      buds: [[.8, -1, .85]],
      end: { type: "trumpet", size: .9, nod: -40 },
    },
    {
      d: "M30-30C-30 70-40 190-100 310S-170 480-130 600",
      width: 2.8, at: 0.6, dur: 1.8, leafLen: 90,
      leaves: [[.12, 1], [.24, -1], [.36, 1], [.48, -1], [.6, 1], [.72, -1]],
      trumpets: [[.5, 1, .75]],
      end: { type: "open", size: .85, tilt: 0 },
    },
  ],
  curls: [
    { d: "M-100 310C-180 330-230 290-215 250C-205 222-168 226-170 250C-171 264-155 268-148 258", at: 1.3, dur: 1.3 },
  ],
};

const EASE_GROW = "cubic-bezier(.33,.67,.67,1)"; 
const EASE_SOFT = "cubic-bezier(.2,.8,.25,1)";
const EASE_SPRING = "cubic-bezier(.3,1.25,.5,1)";

function play(node, at, dur, frames, easing = EASE_SOFT) {
  node.animate(frames, { delay: at * 1000, duration: dur * 1000, easing, fill: "backwards" });
}
function drawLine(path, at, dur, easing = EASE_GROW) {
  const len = path.getTotalLength();
  const dash = `${len} ${len + 12}`;
  play(path, at, dur, [
    { strokeDasharray: dash, strokeDashoffset: len + 6 },
    { strokeDasharray: dash, strokeDashoffset: 0 },
  ], easing);
}
function setSway(node, base) {
  node.style.setProperty("--sd", `${r2(base + Math.random() * 3)}s`);
  node.style.setProperty("--sdl", `${r2(-Math.random() * 6)}s`);
}
function leafShape(parent, x, y, rot, L, W, bend, light) {
  const place = svgEl("g", { transform: `translate(${r2(x)} ${r2(y)}) rotate(${r2(rot)})` }, parent);
  const sway = svgEl("g", { class: "sway sway--leaf" }, place);
  const g = svgEl("g", { class: "grow" }, sway);
  svgEl("path", {
    class: light ? "leaf leaf--light" : "leaf",
    d: `M0 0C${r2(W)} ${r2(-L * .22)} ${r2(W * .75 + bend * .5)} ${r2(-L * .7)} ${r2(bend)} ${r2(-L)}` +
       `C${r2(-W * .75 + bend * .5)} ${r2(-L * .7)} ${r2(-W)} ${r2(-L * .22)} 0 0Z`,
  }, g);
  svgEl("path", { class: "leaf-vein", d: `M0 ${r2(-L * .05)}Q${r2(bend * .3)} ${r2(-L * .5)} ${r2(bend * .9)} ${r2(-L * .92)}` }, g);
  setSway(sway, 5.5);
  return g;
}

function tepal(parent, angle, P, W, bend, k, kind, rand, spots) {
  const place = svgEl("g", { transform: `rotate(${r2(angle)})` }, parent);
  const g = svgEl("g", { class: "grow" }, place);
  svgEl("path", {
    class: `petal petal--${kind}`,
    d: `M0 0C${r2(W * k)} ${r2(-P * .3)} ${r2(W * .85 + bend * .3)} ${r2(-P * .78)} ${r2(bend)} ${r2(-P)}` +
       `C${r2(-W * .85 + bend * .3)} ${r2(-P * .78)} ${r2(-W * k)} ${r2(-P * .3)} 0 0Z`,
  }, g);
  if (kind !== "back") {
    svgEl("path", {
      class: "petal-throat",
      d: `M0 0C${r2(W * k * .5)} ${r2(-P * .12)} ${r2(W * .28)} ${r2(-P * .28)} 0 ${r2(-P * .4)}` +
         `C${r2(-W * .28)} ${r2(-P * .28)} ${r2(-W * k * .5)} ${r2(-P * .12)} 0 0Z`,
    }, g);
  }
  svgEl("path", { class: "petal-vein", d: `M0 ${r2(-P * .08)}Q${r2(bend * .35 + W * .05)} ${r2(-P * .52)} ${r2(bend * .9)} ${r2(-P * .9)}` }, g);
  [-1, 1].forEach((s) => svgEl("path", {
    class: "petal-vein petal-vein--side",
    d: `M${r2(s * W * .12)} ${r2(-P * .14)}Q${r2(s * W * .42 + bend * .3)} ${r2(-P * .5)} ${r2(s * W * .1 + bend * .75)} ${r2(-P * .8)}`,
  }, g));
  if (spots) {
    for (let i = 0; i < 3; i++) {
      svgEl("circle", { class: "petal-spot", cx: r2((rand() - .5) * W * .45), cy: r2(-P * (.2 + rand() * .2)), r: r2(.8 + rand() * .7) }, g);
    }
  }
  return g;
}

function openLily(parent, x, y, rot, size, rand) {
  const place = svgEl("g", { transform: `translate(${r2(x)} ${r2(y)}) rotate(${r2(rot)}) scale(1 .84)` }, parent);
  const sway = svgEl("g", { class: "sway sway--head" }, place);
  setSway(sway, 6.5);
  const P = 96 * size;

  const outer = [0, 120, 240].map((a) => tepal(sway, a + rand() * 10 - 5, P, P * .22, (rand() * .16 - .08) * P, .95, "outer", rand, true));
  const inner = [60, 180, 300].map((a) => tepal(sway, a + rand() * 10 - 5, P * .93, P * .29, (rand() * .14 - .07) * P, .95, "inner", rand, true));
  const throat = svgEl("circle", { class: "petal-throat", r: r2(P * .1) }, sway);

  const stamens = [];
  for (let i = 0; i < 6; i++) {
    const holder = svgEl("g", { transform: `rotate(${r2(i * 60 + 30 + rand() * 14 - 7)})` }, sway);
    const g = svgEl("g", { class: "grow" }, holder);
    const len = P * (.5 + rand() * .12);
    const cx = (rand() * .1 - .05) * P;
    svgEl("path", { class: "filament", d: `M0 0Q${r2(cx)} ${r2(-len * .55)} ${r2(cx * .6)} ${r2(-len)}` }, g);
    svgEl("ellipse", {
      class: "anther", cx: r2(cx * .6), cy: r2(-len), rx: r2(P * .03), ry: r2(P * .075),
      transform: `rotate(${r2(70 + rand() * 40)} ${r2(cx * .6)} ${r2(-len)})`,
    }, g);
    stamens.push(g);
  }
  const pHolder = svgEl("g", { transform: `rotate(${r2(rand() * 40 - 20)})` }, sway);
  const pistil = svgEl("g", { class: "grow" }, pHolder);
  svgEl("path", { class: "pistil", d: `M0 0Q${r2(P * .05)} ${r2(-P * .35)} 0 ${r2(-P * .64)}` }, pistil);
  svgEl("circle", { class: "stigma", cx: 0, cy: r2(-P * .66), r: r2(P * .045) }, pistil);

  return { outer, inner, throat, stamens, pistil };
}

function playOpenLily(b, at) {
  const unfurl = [{ transform: "scale(.3, .02)", opacity: 0 }, { opacity: 1, offset: .25 }, { transform: "scale(1, 1)", opacity: 1 }];
  const sprout = [{ transform: "scale(.2, 0)", opacity: 0 }, { transform: "scale(1, 1)", opacity: 1 }];
  b.outer.forEach((p, i) => play(p, at + i * .07, 1.15, unfurl, EASE_SPRING));
  b.inner.forEach((p, i) => play(p, at + .2 + i * .07, 1.1, unfurl, EASE_SPRING));
  play(b.throat, at + .3, .6, [{ opacity: 0 }, { opacity: 1 }]);
  b.stamens.forEach((s, i) => play(s, at + .62 + i * .045, .7, sprout));
  play(b.pistil, at + .58, .7, sprout);
}

function trumpetLily(parent, x, y, rot, size, rand) {
  const place = svgEl("g", { transform: `translate(${r2(x)} ${r2(y)}) rotate(${r2(rot)})` }, parent);
  const sway = svgEl("g", { class: "sway sway--head" }, place);
  setSway(sway, 6.5);
  const whole = svgEl("g", { class: "grow" }, sway);
  const T = 108 * size;

  svgEl("path", {
    class: "calyx",
    d: `M-3 1C-4.5 ${r2(-T * .06)} -2.5 ${r2(-T * .13)} 0 ${r2(-T * .15)}C2.5 ${r2(-T * .13)} 4.5 ${r2(-T * .06)} 3 1Z`,
  }, whole);
  const head = svgEl("g", { transform: `translate(0 ${r2(-T * .1)})` }, whole);

  tepal(head, 0, T, T * .3, 0, .28, "back", rand, false);
  const sides = [-1, 1].map((sd) => tepal(head, sd * 16, T * .96, T * .27, sd * T * .16, .28, "outer", rand, false));

  const stamens = svgEl("g", { class: "grow" }, head);
  [-1, 0, 1].forEach((k) => {
    const ex = k * T * .14;
    const ey = -T * 1.1;
    svgEl("path", { class: "filament", d: `M0 ${r2(-T * .3)}Q${r2(ex * .4)} ${r2(-T * .75)} ${r2(ex)} ${r2(ey)}` }, stamens);
    svgEl("ellipse", {
      class: "anther", cx: r2(ex), cy: r2(ey), rx: r2(T * .025), ry: r2(T * .06),
      transform: `rotate(${r2(k * 30 + 80)} ${r2(ex)} ${r2(ey)})`,
    }, stamens);
  });
  tepal(head, 2, T * .9, T * .23, T * .03, .28, "front", rand, false);

  return { whole, sides, stamens };
}

function playTrumpet(t, at) {
  play(t.whole, at, .9, [{ transform: "scale(.15, 0)", opacity: 0 }, { opacity: 1, offset: .3 }, { transform: "scale(1, 1)", opacity: 1 }]);
  t.sides.forEach((p, i) => play(p, at + .45, 1.1, [
    { transform: `rotate(${i ? -14 : 14}deg) scaleY(.8)` },
    { transform: "rotate(0deg) scaleY(1)" },
  ], EASE_SPRING));
  play(t.stamens, at + .85, .7, [{ transform: "scale(.3, 0)", opacity: 0 }, { transform: "scale(1, 1)", opacity: 1 }]);
}

function budShape(parent, x, y, rot, L, W) {
  const place = svgEl("g", { transform: `translate(${r2(x)} ${r2(y)}) rotate(${r2(rot)})` }, parent);
  const sway = svgEl("g", { class: "sway sway--leaf" }, place);
  setSway(sway, 5);
  const g = svgEl("g", { class: "grow" }, sway);
  svgEl("path", {
    class: "bud",
    d: `M0 0C${r2(W * .5)} ${r2(-L * .18)} ${r2(W)} ${r2(-L * .55)} ${r2(W * .42)} ${r2(-L * .9)}` +
       `Q0 ${r2(-L * 1.05)} ${r2(-W * .42)} ${r2(-L * .9)}C${r2(-W)} ${r2(-L * .55)} ${r2(-W * .5)} ${r2(-L * .18)} 0 0Z`,
  }, g);
  svgEl("path", { class: "bud-line", d: `M0 ${r2(-L * .12)}Q${r2(W * .25)} ${r2(-L * .5)} 0 ${r2(-L * .97)}` }, g);
  svgEl("path", { class: "bud-line", d: `M${r2(-W * .35)} ${r2(-L * .3)}Q${r2(-W * .2)} ${r2(-L * .6)} ${r2(-W * .1)} ${r2(-L * .9)}` }, g);
  return g;
}

function mountBranch(stage, data, scale, rand, animate) {
  const [, , vw, vh] = data.box;
  const svg = svgEl("svg", { viewBox: data.box.join(" "), class: `branch branch--${data.id}` }, stage);
  svg.style.width = `${r2(vw * scale)}px`;
  svg.style.height = `${r2(vh * scale)}px`;

  const layerStems = svgEl("g", {}, svg);
  const layerLeaves = svgEl("g", {}, svg);
  const layerHeads = svgEl("g", {}, svg);

  (data.curls || []).forEach((c) => {
    const p = svgEl("path", { class: "curl", d: c.d }, layerStems);
    if (animate) drawLine(p, c.at, c.dur);
  });

  data.stems.forEach((st) => {
    const path = svgEl("path", { class: "stem", d: st.d, "stroke-width": st.width }, layerStems);
    const len = path.getTotalLength();
    const pt = (t) => path.getPointAtLength(len * clamp(t, 0, 1));
    const angle = (t) => {
      const a = pt(t - .004);
      const b = pt(t + .004);
      return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    };
    const reach = (t) => st.at + st.dur * (1 - Math.sqrt(1 - Math.min(t, .999)));

    if (animate) drawLine(path, st.at, st.dur);

    st.leaves.forEach(([t, side]) => {
      const p = pt(t);
      const rot = angle(t) + 90 + side * (36 + rand() * 18);
      const L = st.leafLen * (.75 + rand() * .45) * (1 - t * .35);
      const W = L * (.17 + rand() * .05);
      const bend = side * L * (.08 + rand() * .1);
      const leaf = leafShape(layerLeaves, p.x, p.y, rot, L, W, bend, rand() > .6);
      if (animate) {
        play(leaf, reach(t) + .05, .8, [
          { transform: `rotate(${-side * 20}deg) scale(.05, 0)`, opacity: 0 },
          { opacity: 1, offset: .3 },
          { transform: "rotate(0deg) scale(1, 1)", opacity: 1 },
        ]);
      }
    });

    (st.buds || []).forEach(([t, side, size]) => {
      const p = pt(t);
      const holder = svgEl("g", { transform: `translate(${r2(p.x)} ${r2(p.y)}) rotate(${r2(angle(t) + 90 + side * 42)})` }, layerHeads);
      const pl = 30 * size;
      const ped = svgEl("path", { class: "pedicel", "stroke-width": 1.6, d: `M0 0C0 ${r2(-pl * .45)} ${side * 3} ${r2(-pl * .8)} ${side * 7} ${r2(-pl)}` }, holder);
      const bud = budShape(holder, side * 7, -pl, side * 14, 46 * size, 10 * size);
      if (animate) {
        const t0 = reach(t);
        drawLine(ped, t0, .5);
        play(bud, t0 + .35, .9, [{ transform: "scale(.1, 0)", opacity: 0 }, { opacity: 1, offset: .3 }, { transform: "scale(1, 1)", opacity: 1 }]);
      }
    });

    (st.trumpets || []).forEach(([t, side, size]) => {
      const p = pt(t);
      const holder = svgEl("g", { transform: `translate(${r2(p.x)} ${r2(p.y)}) rotate(${r2(angle(t) + 90 + side * 48)})` }, layerHeads);
      const pl = 38 * size;
      const ped = svgEl("path", { class: "pedicel", "stroke-width": 1.8, d: `M0 0C0 ${r2(-pl * .45)} ${side * 4} ${r2(-pl * .8)} ${side * 8} ${r2(-pl)}` }, holder);
      const lily = trumpetLily(holder, side * 8, -pl, side * 30, size, rand);
      if (animate) {
        const t0 = reach(t);
        drawLine(ped, t0, .6);
        playTrumpet(lily, t0 + .45);
      }
    });

    if (st.end) {
      const p = pt(1);
      const a = angle(1);
      if (st.end.type === "open") {
        const lily = openLily(layerHeads, p.x, p.y, a + 90 + st.end.tilt, st.end.size, rand);
        if (animate) playOpenLily(lily, reach(1) - .2);
      } else {
        const lily = trumpetLily(layerHeads, p.x, p.y, a + 90 + st.end.nod, st.end.size, rand);
        if (animate) playTrumpet(lily, reach(1) - .15);
      }
    }
  });
}

const Garden = {
  size: { w: 0, h: 0 },

  build(animate) {
    const stage = $("#stage");
    stage.innerHTML = "";
    stage.classList.remove("is-alive");
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    this.size = { w, h };

    const scale = clamp(Math.min(w, h) / 1000, .36, .92);
    const rand = seeded(25);
    mountBranch(stage, BRANCH_A, scale, rand, animate);
    mountBranch(stage, BRANCH_B, scale * .78, rand, animate);
    this.buildEdgeFrame(animate);

    if (animate) setTimeout(() => stage.classList.add("is-alive"), T.alive * 1000);
    else if (!reduceMotion) stage.classList.add("is-alive");
  },

  buildEdgeFrame(animate) {
    const host = $("#edgeFrame");
    host.innerHTML = "";
    const w = host.clientWidth;
    const h = host.clientHeight;
    const small = w < 640;
    const i = small ? 9 : 16;
    const r = small ? 12 : 20;
    const notched = (x0, y0, x1, y1) =>
      `M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 0 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 0 ${x1 - r} ${y1}` +
      `H${x0 + r}A${r} ${r} 0 0 0 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 0 ${x0 + r} ${y0}Z`;

    const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none" }, host);
    const lines = [
      svgEl("path", { class: "frame-line", d: notched(i, i, w - i, h - i) }, svg),
      svgEl("path", { class: "frame-line frame-line--thin", d: notched(i + 5, i + 5, w - i - 5, h - i - 5) }, svg),
    ];
    const dots = [[i, i], [w - i, i], [w - i, h - i], [i, h - i]]
      .map(([cx, cy]) => svgEl("circle", { class: "frame-dot", cx, cy, r: small ? 1.8 : 2.4 }, svg));

    if (animate) {
      lines.forEach((p, k) => drawLine(p, T.frame + k * .12, 1.3, EASE_SOFT));
      dots.forEach((d, k) => play(d, T.frame + 1 + k * .06, .5, [{ opacity: 0 }, { opacity: .75 }]));
    }
  },
};


let revealed = false;

function startReveal() {
  document.body.classList.add("is-leaving");
  const settle = reduceMotion ? 250 : T.settle * 1000;

  setTimeout(() => {
    $("#invite").hidden = true;
    document.body.classList.remove("locked", "is-leaving");
    window.scrollTo(0, 0);

    $("#letter").hidden = false;
    $("#stage").hidden = false;
    $("#edgeFrame").hidden = false;

    requestAnimationFrame(() => {
      const animate = !reduceMotion;
      Garden.build(animate);
      $("#stage").classList.add("is-on");
      revealed = true;

      if (animate) {
        const whisper = $("#whisper");
        setTimeout(() => whisper.classList.add("is-shown"), T.whisperIn * 1000);
        setTimeout(() => whisper.classList.remove("is-shown"), T.whisperOut * 1000);
      }
      setTimeout(showPlan, animate ? T.card * 1000 : 100);
    });
  }, settle);
}

function showPlan() {
  $("#card").classList.add("is-in");
  setTimeout(() => {
    const io = new IntersectionObserver((entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        .forEach((e, k) => {
          e.target.style.setProperty("--i", k);
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
    }, { threshold: .2, rootMargin: "0px 0px -5% 0px" });
    $$(".ink").forEach((n) => io.observe(n));
  }, reduceMotion ? 0 : 450);
}

let resizeTimer;
window.addEventListener("resize", () => {
  if (!revealed) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const stage = $("#stage");
    const dw = Math.abs(stage.clientWidth - Garden.size.w);
    const dh = Math.abs(stage.clientHeight - Garden.size.h);
    if (dw > 40 || dh > 140) Garden.build(false);
  }, 220);
});


function shapeSeal() {
  const rand = seeded(9);
  const n = 22;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 44 + (rand() - .5) * 5 + (i % 6 === 0 ? 2.5 : 0);
    pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
  }
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)} ` +
         `${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  $("#sealEdge").setAttribute("d", `${d}Z`);
}

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

initPortrait();
shapeSeal();
initRunaway(startReveal);

$("#again").addEventListener("click", () => {
  window.scrollTo(0, 0);
  window.location.reload();
});
