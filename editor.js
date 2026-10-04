/* Small, dependency-free SVG molecular sketcher. Connectivity is graded against the molecular graphs in data.js. */
class MoleculeEditor {
  constructor(host) {
    this.host = host;
    this.tool = "single";
    this.element = "C";
    this.undoStack = [];
    this.redoStack = [];
    this.selected = null;
    this.reset(false);
    this.mount();
  }
  reset(record = true) {
    if (record) this.snapshot();
    this.atoms = [
      { x: 230, y: 480, e: "NH2" },
      { x: 310, y: 440, e: "C" },
      { x: 390, y: 480, e: "C" },
      { x: 390, y: 550, e: "O" },
      { x: 470, y: 440, e: "OH" },
    ];
    this.bonds = [
      { a: 0, b: 1, t: "single" },
      { a: 1, b: 2, t: "single" },
      { a: 2, b: 3, t: "double" },
      { a: 2, b: 4, t: "single" },
    ];
    this.selected = null;
    if (this.svg) this.draw();
  }
  state() {
    return JSON.stringify({ atoms: this.atoms, bonds: this.bonds });
  }
  snapshot() {
    this.undoStack.push(this.state());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }
  restore(s) {
    Object.assign(this, JSON.parse(s));
    this.selected = null;
    this.draw();
  }
  undo() {
    if (this.undoStack.length) {
      this.redoStack.push(this.state());
      this.restore(this.undoStack.pop());
    }
  }
  redo() {
    if (this.redoStack.length) {
      this.undoStack.push(this.state());
      this.restore(this.redoStack.pop());
    }
  }
  mount() {
    this.host.innerHTML = `<div class="editor-wrap"><div class="toolbar" role="toolbar" aria-label="Molecule tools">${[
      ["single", "Bond"],
      ["double", "Double"],
      ["triple", "Triple"],
      ["wedge", "Wedge"],
      ["dash", "Dash"],
      ["atom", "Atom"],
      ["ring5", "5-ring"],
      ["ring6", "6-ring"],
      ["benzene", "Benzene"],
      ["move", "Move"],
      ["erase", "Erase"],
    ]
      .map(
        ([t, l]) =>
          `<button type="button" data-tool="${t}" aria-pressed="false">${l}</button>`,
      )
      .join(
        "",
      )}<select aria-label="Atom label">${["C", "N", "NH", "NH2", "NH3+", "NH2+", "NH+", "O", "OH", "S", "SH", "H", "N+", "O−"].map((e) => `<option>${e}</option>`).join("")}</select><button type="button" data-action="undo">Undo</button><button type="button" data-action="redo">Redo</button><button type="button" data-action="reset">Backbone</button></div><svg class="drawing" viewBox="0 0 700 580" role="img" aria-label="Molecule drawing canvas. Use pointer to draw; paper mode is available below."></svg></div><p class="editor-help">Drag from an atom to draw a bond; release on another atom to connect. Click a bond to change its type (click a wedge/dash again to reverse it). Atom tool: choose a label, then click an atom. Ring tool: click an atom to attach a ring, or empty space for a new ring. Move atoms to arrange your drawing. Carbon and its H are implicit.</p>`;
    this.svg = this.host.querySelector("svg");
    this.host.querySelectorAll("[data-tool]").forEach(
      (b) =>
        (b.onclick = () => {
          this.tool = b.dataset.tool;
          this.selectTool();
        }),
    );
    this.host.querySelector("select").onchange = (e) => {
      this.element = e.target.value;
      this.tool = "atom";
      this.selectTool();
    };
    this.host.querySelector("[data-action=undo]").onclick = () => this.undo();
    this.host.querySelector("[data-action=redo]").onclick = () => this.redo();
    this.host.querySelector("[data-action=reset]").onclick = () => this.reset();
    this.svg.onpointerdown = (e) => this.down(e);
    this.svg.onpointermove = (e) => this.move(e);
    this.svg.onpointerup = (e) => this.up(e);
    this.svg.onpointercancel = () => {
      if (this.drag?.moving) this.restore(this.drag.before);
      this.drag = null;
      this.draw();
    };
    this.selectTool();
    this.draw();
  }
  selectTool() {
    this.host.querySelectorAll("[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === this.tool);
      b.setAttribute("aria-pressed", b.dataset.tool === this.tool);
    });
  }
  pos(e) {
    const p = this.svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(this.svg.getScreenCTM().inverse());
  }
  near(p) {
    let found = -1,
      d = 22;
    this.atoms.forEach((a, i) => {
      let v = Math.hypot(a.x - p.x, a.y - p.y);
      if (v < d) {
        d = v;
        found = i;
      }
    });
    return found;
  }
  bondNear(p) {
    return this.bonds.findIndex((b) => {
      const a = this.atoms[b.a],
        c = this.atoms[b.b],
        dx = c.x - a.x,
        dy = c.y - a.y,
        t = Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
          ),
        );
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < 12;
    });
  }
  down(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.svg.setPointerCapture(e.pointerId);
    let p = this.pos(e),
      i = this.near(p),
      j = this.bondNear(p);
    this.selected = i >= 0 ? i : null;
    if (this.tool === "move") {
      if (i >= 0) {
        this.snapshot();
        this.drag = {
          i,
          start: p,
          moving: true,
          before: this.undoStack.at(-1),
        };
      }
      this.draw();
      return;
    }
    if (this.tool === "erase") {
      if (i >= 0 || j >= 0) {
        this.snapshot();
        if (i >= 0) {
          this.atoms.splice(i, 1);
          this.bonds = this.bonds
            .filter((b) => b.a !== i && b.b !== i)
            .map((b) => ({
              ...b,
              a: b.a > i ? b.a - 1 : b.a,
              b: b.b > i ? b.b - 1 : b.b,
            }));
        } else this.bonds.splice(j, 1);
        this.selected = null;
      }
      this.draw();
      return;
    }
    if (this.tool === "atom") {
      this.snapshot();
      if (i >= 0) this.atoms[i].e = this.element;
      else this.atoms.push({ x: p.x, y: p.y, e: this.element });
      this.draw();
      return;
    }
    if (["ring5", "ring6", "benzene"].includes(this.tool)) {
      this.snapshot();
      this.ring(i, p);
      this.draw();
      return;
    }
    if (i < 0 && j >= 0) {
      this.snapshot();
      const b = this.bonds[j];
      if (b.t === this.tool && ["wedge", "dash"].includes(this.tool))
        [b.a, b.b] = [b.b, b.a];
      b.t = this.tool;
      this.draw();
      return;
    }
    this.drag = { i, start: p, end: p };
    this.draw();
  }
  move(e) {
    if (!this.drag) return;
    let p = this.pos(e);
    if (this.drag.moving) {
      this.atoms[this.drag.i].x = Math.max(20, Math.min(680, p.x));
      this.atoms[this.drag.i].y = Math.max(20, Math.min(560, p.y));
    } else this.drag.end = p;
    this.draw();
  }
  up(e) {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    if (d.moving) {
      this.draw();
      return;
    }
    let p = this.pos(e);
    if (Math.hypot(p.x - d.start.x, p.y - d.start.y) < 8) {
      this.draw();
      return;
    }
    this.snapshot();
    let a = d.i;
    if (a < 0) {
      a = this.atoms.length;
      this.atoms.push({ x: d.start.x, y: d.start.y, e: "C" });
    }
    let b = this.near(p);
    if (b === a) {
      this.draw();
      return;
    }
    if (b < 0) {
      let origin = this.atoms[a],
        angle =
          (Math.round(
            Math.atan2(p.y - origin.y, p.x - origin.x) / (Math.PI / 6),
          ) *
            Math.PI) /
          6;
      let len = Math.min(
        100,
        Math.max(48, Math.hypot(p.x - origin.x, p.y - origin.y)),
      );
      b = this.atoms.length;
      this.atoms.push({
        x: Math.max(15, Math.min(685, origin.x + len * Math.cos(angle))),
        y: Math.max(15, Math.min(565, origin.y + len * Math.sin(angle))),
        e: "C",
      });
    }
    let old = this.bonds.find(
      (bond) =>
        (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a),
    );
    if (old) old.t = this.tool;
    else this.bonds.push({ a, b, t: this.tool });
    this.selected = b;
    this.draw();
  }
  ring(i, p) {
    const n = this.tool === "ring5" ? 5 : 6,
      r = 52;
    let start = i >= 0 ? this.atoms[i] : p;
    let ids = [];
    let cx = start.x,
      cy = start.y - r;
    for (let k = 0; k < n; k++) {
      if (k === 0 && i >= 0) {
        ids.push(i);
        continue;
      }
      ids.push(this.atoms.length);
      this.atoms.push({
        x: cx + r * Math.cos(Math.PI / 2 + (k * 2 * Math.PI) / n),
        y: cy + r * Math.sin(Math.PI / 2 + (k * 2 * Math.PI) / n),
        e: "C",
      });
    }
    for (let k = 0; k < n; k++)
      this.bonds.push({
        a: ids[k],
        b: ids[(k + 1) % n],
        t: this.tool === "benzene" && k % 2 === 0 ? "double" : "single",
      });
  }
  markup() {
    let out = "";
    const line = (x, y, X, Y, w = 2) =>
      `<line x1="${x}" y1="${y}" x2="${X}" y2="${Y}" stroke="#192e26" stroke-width="${w}" stroke-linecap="round"/>`;
    this.bonds.forEach((b) => {
      const a = this.atoms[b.a],
        c = this.atoms[b.b],
        len = Math.hypot(c.x - a.x, c.y - a.y) || 1,
        nx = -(c.y - a.y) / len,
        ny = (c.x - a.x) / len;
      if (b.t === "wedge")
        out += `<polygon points="${a.x},${a.y} ${c.x + nx * 7},${c.y + ny * 7} ${c.x - nx * 7},${c.y - ny * 7}" fill="#192e26"/>`;
      else if (b.t === "dash") {
        for (let t = 0.12; t < 1; t += 0.12)
          out += line(
            a.x + (c.x - a.x) * t - nx * 7 * t,
            a.y + (c.y - a.y) * t - ny * 7 * t,
            a.x + (c.x - a.x) * t + nx * 7 * t,
            a.y + (c.y - a.y) * t + ny * 7 * t,
          );
      } else {
        const offsets =
          b.t === "double" ? [-3, 3] : b.t === "triple" ? [-5, 0, 5] : [0];
        offsets.forEach(
          (o) =>
            (out += line(
              a.x + nx * o,
              a.y + ny * o,
              c.x + nx * o,
              c.y + ny * o,
            )),
        );
      }
    });
    this.atoms.forEach((a, i) => {
      if (a.e !== "C" || !this.bonds.some((b) => b.a === i || b.b === i))
        out += `<text x="${a.x}" y="${a.y + 6}" text-anchor="middle">${a.e}</text>`;
    });
    return out;
  }
  draw() {
    this.svg.innerHTML =
      this.markup() +
      (this.selected !== null && this.atoms[this.selected]
        ? `<circle cx="${this.atoms[this.selected].x}" cy="${this.atoms[this.selected].y}" r="14" fill="none" stroke="#88b049" stroke-width="2"/>`
        : "") +
      (this.drag && !this.drag.moving
        ? `<line x1="${this.drag.start.x}" y1="${this.drag.start.y}" x2="${this.drag.end.x}" y2="${this.drag.end.y}" stroke="#83a64d" stroke-dasharray="5 5"/>`
        : "");
  }
  freeze() {
    this.host.querySelector(".toolbar").hidden = true;
    this.host.querySelector(".editor-help").hidden = true;
    this.svg.onpointerdown =
      this.svg.onpointermove =
      this.svg.onpointerup =
        null;
    this.selected = null;
    this.draw();
  }
}
