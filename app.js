"use strict";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  modal = $("#modal");
const PAIRS = Array.from({ length: 3 }, (_, a) =>
  Array.from({ length: 3 }, (_, b) => [a, b]),
)
  .flat()
  .filter(([a, b]) => a !== b);
const STRUCTURES = [
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 0],
    [3, 1],
    [3, 2],
  ],
  LABELS = [
    "full name",
    "3-letter code",
    "1-letter code",
    "skeletal structure",
  ];
const MODES = {
  mixed: "Mixed",
  codes: "Names & Codes",
  structures: "Structures",
  draw: "Drawing",
};
const SAVE_KEY =
  "amino-dash:v1:" + location.pathname.replace(/index\.html$/, "");
const clone = (x) => JSON.parse(JSON.stringify(x)),
  shuffle = (a) => {
    const out = a.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  },
  key = (c) => c.join(":"),
  day = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
function fresh() {
  return {
    version: 1,
    memory: {},
    retry: [],
    turn: 0,
    totalXP: 0,
    answers: 0,
    fullCorrect: 0,
    rounds: 0,
    medals: 0,
    bestStreak: 0,
    bests: {},
    days: {},
    history: [],
    settings: { speed: true },
  };
}
function validKey(k) {
  return (
    /^(?:[0-9]|1[0-9]):[0-3]:[0-4]$/.test(k) &&
    (([i, a, b]) =>
      PAIRS.concat(STRUCTURES, [[0, 4]]).some((p) => p[0] === a && p[1] === b))(
      k.split(":").map(Number),
    )
  );
}
function validate(v) {
  if (!v || v.version !== 1) throw Error("This save format is not supported.");
  const n = fresh(),
    num = (x, max = 1e12) =>
      typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= max;
  if (
    !v.memory ||
    typeof v.memory !== "object" ||
    Array.isArray(v.memory) ||
    Object.keys(v.memory).length > 260
  )
    throw Error("Invalid card progress.");
  for (const [k, a] of Object.entries(v.memory)) {
    if (
      !validKey(k) ||
      !Array.isArray(a) ||
      a.length !== 2 ||
      !num(a[0], 8) ||
      !num(a[1], 1e12)
    )
      throw Error("Invalid card progress.");
    n.memory[k] = a.slice();
  }
  for (const k of [
    "turn",
    "totalXP",
    "answers",
    "fullCorrect",
    "rounds",
    "medals",
    "bestStreak",
  ]) {
    if (!Number.isSafeInteger(v[k]) || !num(v[k]))
      throw Error("Invalid score data.");
    n[k] = v[k];
  }
  if (!Array.isArray(v.retry) || v.retry.length > 260)
    throw Error("Invalid retry queue.");
  n.retry = v.retry.map((r) => {
    if (!r || !validKey(r.key) || !Number.isSafeInteger(r.due) || !num(r.due))
      throw Error("Invalid retry card.");
    return { key: r.key, due: r.due };
  });
  if (!v.bests || typeof v.bests !== "object")
    throw Error("Invalid personal bests.");
  for (const [k, x] of Object.entries(v.bests)) {
    if (!Object.hasOwn(MODES, k) || !Number.isSafeInteger(x) || !num(x))
      throw Error("Invalid personal best.");
    n.bests[k] = x;
  }
  if (
    !v.days ||
    typeof v.days !== "object" ||
    Object.keys(v.days).length > 20000
  )
    throw Error("Invalid practice dates.");
  for (const [d, x] of Object.entries(v.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isSafeInteger(x) || !num(x))
      throw Error("Invalid practice day.");
    n.days[d] = x;
  }
  if (!Array.isArray(v.history) || v.history.length > 50)
    throw Error("Invalid round history.");
  n.history = v.history.map((h) => {
    if (
      !h ||
      !Object.hasOwn(MODES, h.mode) ||
      !num(h.score) ||
      !num(h.correct, 12) ||
      !num(h.seconds, 1e9) ||
      typeof h.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(h.date)
    )
      throw Error("Invalid round history.");
    return {
      mode: h.mode,
      score: h.score,
      correct: h.correct,
      seconds: h.seconds,
      date: h.date,
    };
  });
  n.settings = { speed: v.settings?.speed !== false };
  return n;
}
let save = fresh(),
  blocked = false,
  storageOK = true,
  round = null,
  state = "home",
  editor = null,
  ready = 0;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) save = validate(JSON.parse(raw));
} catch (e) {
  blocked = true;
  storageOK = false;
  $("#storage-warning").textContent =
    "Local save data could not be read. Use Save / restore to import or inspect backups.";
}
function persist() {
  if (blocked) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    storageOK = true;
    $("#storage-warning").textContent = "";
    return true;
  } catch {
    storageOK = false;
    $("#storage-warning").textContent =
      "Browser storage is unavailable or full. Export a backup before closing.";
    return false;
  }
}
function img(i, cls = "structure", alt = "Amino acid skeletal structure") {
  return `<img class="${cls}" src="assets/${i}.svg" alt="${alt}" data-zoom="${i}">`;
}
function zoom(i) {
  $("#modal-body").innerHTML =
    `<h2>Structure</h2>${img(i)}<p>Neutral form · Carbon-bound hydrogen implicit</p>`;
  modal.showModal();
}
function bindZoom() {
  app.querySelectorAll("[data-zoom]").forEach((el) => {
    el.oncontextmenu = (e) => {
      e.preventDefault();
      zoom(+el.dataset.zoom);
    };
    if (!el.closest(".choice")) {
      el.tabIndex = 0;
      el.onclick = () => zoom(+el.dataset.zoom);
      el.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          zoom(+el.dataset.zoom);
        }
      };
    }
  });
}
function trained() {
  return Object.entries(save.memory).filter(
    ([k, v]) => +k.split(":")[1] < 3 && +k.split(":")[2] < 3 && v[0] >= 2,
  ).length;
}
function streakDays() {
  let d = new Date(),
    n = 0;
  if (!save.days[day()]) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 20000; i++) {
    let k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!save.days[k]) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
function home() {
  state = "home";
  round = null;
  let today = save.days[day()] || 0;
  app.innerHTML = `<section class="hero"><div><span class="eyebrow">Practice</span><h1>Amino Acids</h1><p>Review structures, 3-letter codes, 1-letter codes, and names for all 20 standard amino acids.</p><div class="stats"><div class="stat"><strong>${save.totalXP.toLocaleString()}</strong><small>Total XP</small></div><div class="stat"><strong>${streakDays()}</strong><small>Day streak</small></div><div class="stat"><strong>${save.medals}</strong><small>Medals</small></div></div></div><aside class="panel"><div class="row"><span class="eyebrow">Daily Target</span><span class="tag">${today >= 24 ? "COMPLETE" : "24 ANSWERS"}</span></div><h2>${Math.min(today, 24)} <span class="muted">/ 24</span></h2><div class="progress"><div style="width:${Math.min(100, (today / 24) * 100)}%"></div></div><p>${today >= 24 ? "Target reached for today." : "Answer 24 cards to hit the daily target."}</p><hr style="border:0;border-top:1px solid var(--line)"><small>Mastered prompts</small><div class="row"><strong>${trained()} / 120 directions</strong><span class="gold">Level ${1 + Math.floor(save.totalXP / 2000)}</span></div></aside></section><div class="row"><h2>Select Mode</h2><span class="tag">12 QUESTIONS / ROUND</span></div><section class="modes">${[
    ["mixed", "↔", "6 name/code questions + 6 structure questions"],
    ["codes", "Aa", "Names and codes in all directions"],
    ["structures", "⌬", "Match skeletal structures to names and codes"],
    ["draw", "✎", "Draw structures from memory and self-grade"],
  ]
    .map(
      ([m, ic, txt]) =>
        `<button class="mode" data-start="${m}"><span class="icon">${ic}</span><strong>${MODES[m]} <span style="float:right">↗</span></strong><small>${txt}</small><small>Best:${save.bests[m] || 0} pts</small></button>`,
    )
    .join(
      "",
    )}</section><div class="row" style="margin-top:24px"><p>Missed cards return after several steps. Mastered cards switch to typed input.</p><label class="switch"><input id="speed" type="checkbox" ${save.settings.speed ? "checked" : ""}> Speed bonus</label></div><details class="panel"><summary>Progress & History</summary><p>${save.answers} total answers · ${save.fullCorrect} fully correct · ${save.rounds} rounds completed · Best streak: ${save.bestStreak}</p>${
    save.history.length
      ? `<table class="history"><thead><tr><th>Date / Mode</th><th>Result</th><th>Score</th></tr></thead><tbody>${save.history
          .slice(0, 10)
          .map(
            (h) =>
              `<tr><td>${h.date}<br><small>${MODES[h.mode]}</small></td><td>${h.correct}/12</td><td>${h.score}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : "<p>No completed rounds yet.</p>"
  }</details><p><small>Neutral skeletal forms, backbone below and side chain above. Stereo shown for L-threonine and L-isoleucine. Enter: mixed round · Esc: menu</small></p>`;
  app
    .querySelectorAll("[data-start]")
    .forEach((b) => (b.onclick = () => start(b.dataset.start)));
  $("#speed").onchange = (e) => {
    save.settings.speed = e.target.checked;
    persist();
  };
}
function start(mode) {
  round = {
    mode,
    done: 0,
    correct: 0,
    score: 0,
    streak: 0,
    started: Date.now(),
    recent: [],
    mix: [],
  };
  for (let n = 0; n < 3; n++)
    round.mix.push(...shuffle(["codes", "codes", "to", "from"]));
  next();
}
function choose() {
  let pairs =
    round.mode === "draw"
      ? [[0, 4]]
      : round.mode === "structures"
        ? STRUCTURES
        : PAIRS;
  if (round.mode === "mixed") {
    let k = round.mix[round.done];
    pairs =
      k === "codes"
        ? PAIRS
        : STRUCTURES.filter((p) => (p[1] === 3) === (k === "to"));
  }
  let cards = AA.flatMap((_, i) => pairs.map(([a, b]) => [i, a, b])),
    keys = new Set(cards.map(key));
  let retry = save.retry
    .filter((r) => r.due <= save.turn && keys.has(r.key))
    .sort((a, b) => a.due - b.due)[0];
  if (retry) return retry.key.split(":").map(Number);
  let pending = new Set(save.retry.map((r) => r.key)),
    pool = cards.filter(
      (c) => !pending.has(key(c)) && !round.recent.includes(c[0]),
    );
  if (!pool.length) pool = cards.filter((c) => !round.recent.includes(c[0]));
  if (!pool.length) pool = cards;
  let weights = pool.map((c) => {
    let [level, seen] = save.memory[key(c)] || [0, 0];
    return (
      (1 +
        (seen
          ? Math.min(4, Math.max(0, (Date.now() / 1000 - seen) / 86400))
          : 0)) /
      (1 + level)
    );
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  return pool.find((c, i) => (r -= weights[i]) < 0) || pool.at(-1);
}
function next() {
  if (round.done === 12) {
    finish();
    return;
  }
  save.turn++;
  round.card = choose();
  round.recent.push(round.card[0]);
  round.recent = round.recent.slice(-3);
  let [i, a, b] = round.card,
    level = (save.memory[key(round.card)] || [0])[0];
  state =
    round.mode === "draw" ? "draw" : level >= 2 && b < 3 ? "type" : "choice";
  round.answer = b < 3 ? AA[i][b] : i;
  app.innerHTML = `<section class="question"><div class="row"><span class="eyebrow">${MODES[round.mode]}</span><span>${round.done + 1} / 12 &nbsp; · &nbsp; ${round.score} pts &nbsp; · &nbsp; <span class="gold">${round.streak} streak</span></span></div><div class="progress"><div style="width:${(round.done / 12) * 100}%"></div></div><div class="prompt"><span class="tag">${state === "draw" ? "DRAW STRUCTURE" : state === "type" ? "TYPE ANSWER" : "SELECT " + LABELS[b].toUpperCase()}</span>${a === 3 ? img(i) : `<h1>${AA[i][a]}</h1>`}</div><div id="answer-area"></div></section>`;
  const area = $("#answer-area");
  if (state === "draw") {
    area.innerHTML = `<div id="editor"></div><label class="switch"><input type="checkbox" id="paper"> Drawing on paper</label><p><small>Start at the central alpha carbon. For proline, connect side chain to N and set NH2 to NH. Include wedges/dashes for threonine and isoleucine.</small></p><button class="primary" id="reveal">Reveal & check</button>`;
    editor = new MoleculeEditor($("#editor"));
    $("#paper").onchange = (e) => ($("#editor").hidden = e.target.checked);
    $("#reveal").onclick = reveal;
  } else if (state === "type") {
    area.innerHTML = `<form id="answer-form"><label for="typed" class="muted">${LABELS[b]}</label><input id="typed" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type answer"><div class="actions"><button class="primary" type="submit">Submit</button><button type="button" id="teach">Show answer</button></div></form>`;
    $("#answer-form").onsubmit = (e) => {
      e.preventDefault();
      submit();
    };
    $("#teach").onclick = () => grade(0);
    $("#typed").focus();
  } else {
    round.options = shuffle([
      ...shuffle(
        AA.map((v, j) => (b === 3 ? j : v[b])).filter(
          (v) => v !== round.answer,
        ),
      ).slice(0, 3),
      round.answer,
    ]);
    area.innerHTML = `<div class="choices">${round.options.map((v, n) => `<button class="choice" data-pick="${n}"><b>${n + 1}</b>${b === 3 ? img(v, "structure", `Option ${n + 1}`) : v}</button>`).join("")}</div><p><small>Select 1–4 or click.${b === 3 ? " Right-click to zoom." : ""}</small></p>`;
    app
      .querySelectorAll("[data-pick]")
      .forEach((btn) => (btn.onclick = () => pick(+btn.dataset.pick)));
  }
  bindZoom();
  round.asked = performance.now();
  window.scrollTo(0, 0);
}
function pick(n) {
  if (state === "choice") grade(round.options[n] === round.answer ? 1 : 0);
}
function submit() {
  if (state !== "type") return;
  let v = $("#typed").value.trim().toLowerCase().replace(/\s+/g, " ");
  v = { aspartate: "aspartic acid", glutamate: "glutamic acid" }[v] || v;
  grade(v === round.answer.toLowerCase() ? 1 : 0);
}
function reveal() {
  if (state !== "draw") return;
  state = "judge";
  let paper = $("#paper").checked;
  editor.selected = null;
  editor.draw();
  const own = editor.svg.outerHTML;
  let i = round.card[0];
  $("#answer-area").innerHTML =
    `<div class="compare">${paper ? "" : `<div><h3>Your drawing</h3><div class="editor-wrap">${own}</div></div>`}<div><h3>Reference</h3>${img(i)}</div></div><p>${AA[i][3]}</p><p>Compare bonds, atom labels, rings, and stereochemistry. Grade your accuracy:</p><div class="credit">${[0, 0.25, 0.5, 0.75, 1].map((c) => `<button data-credit="${c}" class="${c === 1 ? "primary" : ""}">${c * 100}%</button>`).join("")}</div><p><small>Scores under 100% will re-queue this card later in practice.</small></p>`;
  app
    .querySelectorAll("[data-credit]")
    .forEach((b) => (b.onclick = () => grade(+b.dataset.credit)));
  bindZoom();
}
function grade(credit) {
  if (!["choice", "type", "judge"].includes(state)) return;
  state = "feedback";
  let k = key(round.card),
    i = round.card[0],
    level = save.memory[k]?.[0] || 0;
  save.memory[k] = [
    credit === 1
      ? Math.min(8, level + 1)
      : credit === 0
        ? 0
        : Math.min(8, level + credit * 0.5),
    Date.now() / 1000,
  ];
  save.retry = save.retry.filter((r) => r.key !== k);
  if (credit < 1) save.retry.push({ key: k, due: save.turn + 3 });
  round.done++;
  round.correct += credit;
  round.streak = credit === 1 ? round.streak + 1 : 0;
  let points =
    credit === 1
      ? 100 + 20 * Math.min(5, round.streak - 1)
      : Math.round(100 * credit);
  if (credit === 1 && round.mode !== "draw" && save.settings.speed)
    points += Math.max(
      0,
      30 - Math.floor((performance.now() - round.asked) / 1000) * 5,
    );
  round.score += points;
  save.totalXP += points;
  save.answers++;
  save.fullCorrect += credit === 1 ? 1 : 0;
  save.bestStreak = Math.max(save.bestStreak, round.streak);
  let before = save.days[day()] || 0;
  save.days[day()] = before + 1;
  persist();
  ready = performance.now() + (credit === 1 ? 250 : 800);
  app.innerHTML = `<section class="question feedback celebrate"><span class="eyebrow">${round.done} / 12 · ${round.score} pts</span><h1>${credit === 1 ? `+${points} · Correct` : credit > 0 ? `+${points} · Partial` : "Incorrect"}</h1><h2>${AA[i].slice(0, 3).join(" · ")}</h2>${img(i)}<p>${AA[i][3]}</p><small>${i === 11 ? "L-threonine: 2S, 3R" : i === 4 ? "L-isoleucine: 2S, 3S" : "Neutral skeletal form · C / carbon-bound H implicit"}</small><p>${credit === 1 ? (round.streak >= 3 ? `${round.streak} correct in a row.` : "") : credit > 0 ? `${credit * 100}% credit awarded. This card will repeat.` : "This card will return later in practice."}</p>${before < 24 && save.days[day()] >= 24 ? '<p class="gold">Daily target reached (24 answers).</p>' : ""}<button class="primary" id="next">${round.done === 12 ? "View Summary" : "Next Card"} →</button></section>`;
  $("#next").onclick = () => {
    if (performance.now() >= ready) next();
  };
  bindZoom();
}
function finish() {
  state = "end";
  save.rounds++;
  const medal =
      round.correct === 12
        ? "Gold"
        : round.correct >= 10
          ? "Silver"
          : "Complete",
    old = save.bests[round.mode] || 0,
    isBest = round.score > old;
  save.bests[round.mode] = Math.max(old, round.score);
  if (round.correct >= 10) save.medals++;
  let seconds = Math.round((Date.now() - round.started) / 1000);
  save.history.unshift({
    date: day(),
    mode: round.mode,
    correct: round.correct,
    score: round.score,
    seconds,
  });
  save.history = save.history.slice(0, 50);
  persist();
  app.innerHTML = `<section class="question panel feedback celebrate"><span class="eyebrow">${MODES[round.mode]} · Finished</span><h1 class="gold">${medal}</h1><h2>${round.correct} / 12 ${round.mode === "draw" ? "credit" : "correct"}</h2><div class="stats"><div class="stat"><strong>${round.score}</strong><small>Points</small></div><div class="stat"><strong>${seconds}s</strong><small>Time</small></div><div class="stat"><strong>${save.bests[round.mode]}</strong><small>Best</small></div></div><p class="gold">${isBest ? "New best score." : `Current best: ${save.bests[round.mode]} pts`}</p><p>Completed round. Missed cards will cycle into future rounds.</p><div class="actions" style="justify-content:center"><button class="primary" id="again">Play again</button><button id="menu">Main menu</button></div></section>`;
  $("#again").onclick = () => start(round.mode);
  $("#menu").onclick = home;
}
function atlas() {
  state = "atlas";
  round = null;
  app.innerHTML = `<div class="row"><div><span class="eyebrow">Index</span><h1>Amino Acids Reference</h1></div><span class="tag">${trained()} / 120 MASTERED</span></div><p>Click any card to inspect structure and side-chain details. Progress bars indicate recall level.</p><div class="atlas">${AA.map(
    (v, i) => {
      let level = Object.entries(save.memory)
        .filter(([k]) => +k.split(":")[0] === i)
        .reduce((s, [k, v]) => s + v[0], 0);
      return `<button data-aa="${i}">${img(i)}<strong>${v[0]}</strong><small>${v[1]} ·${v[2]}</small><div class="progress"><div style="width:${(level / 104) * 100}%"></div></div></button>`;
    },
  ).join("")}</div>`;
  app.querySelectorAll("[data-aa]").forEach(
    (b) =>
      (b.onclick = () => {
        let i = +b.dataset.aa;
        $("#modal-body").innerHTML =
          `<span class="eyebrow">${AA[i][1]} · ${AA[i][2]}</span><h2>${AA[i][0]}</h2>${img(i)}<p>${AA[i][3]}</p><p>${i === 4 ? "L-isoleucine: 2S, 3S" : i === 11 ? "L-threonine: 2S, 3R" : "Neutral form; alpha stereochemistry unspecified."}</p>`;
        modal.showModal();
      }),
  );
}
// FNV-1a detects accidental copy corruption; this is not encryption or authentication.
function checksum(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function encode(v) {
  let raw = JSON.stringify(v),
    payload = btoa(raw)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `AD1.${payload}.${checksum(payload)}`;
}
function decode(code) {
  if (code.length > 2000000) throw Error("Save data too large.");
  let parts = code.replace(/\s/g, "").split(".");
  if (
    parts.length !== 3 ||
    parts[0] !== "AD1" ||
    checksum(parts[1]) !== parts[2]
  )
    throw Error(
      "Code is invalid or incomplete. Verify the entire string was copied.",
    );
  return validate(
    JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))),
  );
}
function download(name, txt) {
  const url = URL.createObjectURL(new Blob([txt], { type: "text/plain" })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function backup() {
  const code = encode(save);
  $("#modal-body").innerHTML =
    `<h2>Backup & Restore</h2><p>Progress is saved locally in this browser. Export a backup before clearing site data or switching browsers.</p><label for="export-code">Current export code</label><textarea id="export-code" readonly spellcheck="false"></textarea><div class="actions"><button id="copy" class="primary">Copy code</button><button id="download">Download backup file</button>${blocked ? '<button id="raw">Download unreadable local data</button>' : ""}</div><p class="toast" id="save-status" role="status"></p><hr style="border:0;border-top:1px solid var(--line)"><h3>Import Backup</h3><p>Paste an AD1 export code or valid legacy JSON to restore progress.</p><textarea id="import-code" placeholder="AD1... or JSON" spellcheck="false" aria-label="Progress code to restore"></textarea><button id="review" style="margin-top:12px">Review backup</button><div id="review-area" role="status"></div>`;
  $("#export-code").value = code;
  $("#copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      $("#save-status").textContent = "Copied to clipboard.";
    } catch {
      $("#export-code").select();
      $("#save-status").textContent = "Select and press Ctrl+C (⌘C) to copy.";
    }
  };
  $("#download").onclick = () => download("amino-dash-progress.txt", code);
  if ($("#raw"))
    $("#raw").onclick = () => {
      try {
        download(
          "amino-dash-unreadable-save.txt",
          localStorage.getItem(SAVE_KEY) || "",
        );
      } catch {
        $("#save-status").textContent = "Browser storage cannot be accessed.";
      }
    };
  $("#review").onclick = () => {
    try {
      let raw = $("#import-code").value.trim(),
        candidate;
      if (raw.startsWith("{")) {
        let legacy = JSON.parse(raw);
        if (legacy.version) candidate = validate(legacy);
        else {
          candidate = fresh();
          if (
            !legacy ||
            Array.isArray(legacy) ||
            Object.keys(legacy).length > 260
          )
            throw Error("Invalid JSON format.");
          for (let [k, v] of Object.entries(legacy)) {
            if (
              !validKey(k) ||
              !Array.isArray(v) ||
              v.length !== 2 ||
              !v.every(
                (x) => typeof x === "number" && Number.isFinite(x) && x >= 0,
              )
            )
              throw Error("Invalid card data.");
            candidate.memory[k] = [Math.min(8, v[0]), v[1]];
          }
          candidate = validate(candidate);
        }
      } else candidate = decode(raw);
      $("#review-area").innerHTML =
        `<div class="panel" style="margin-top:14px"><h3>Backup Summary</h3><p>${candidate.totalXP} XP · ${candidate.rounds} completed rounds · ${Object.keys(candidate.memory).length} cards recorded</p><p>Restoring will replace existing data in this browser session.</p><button id="confirm-restore" class="primary">Confirm & restore</button></div>`;
      $("#confirm-restore").onclick = () => {
        save = candidate;
        blocked = false;
        const stored = persist();
        modal.close();
        home();
        if (!stored)
          $("#storage-warning").textContent =
            "Backup active for this session, but local storage could not be updated.";
      };
    } catch (e) {
      $("#review-area").textContent = "Could not parse backup: " + e.message;
    }
  };
  modal.showModal();
}
$("#close-modal").onclick = () => modal.close();
$("#home").onclick = home;
$("#brand").onclick = (e) => {
  e.preventDefault();
  home();
};
$("#atlas").onclick = atlas;
$("#backup").onclick = backup;
document.addEventListener("keydown", (e) => {
  if (modal.open) return;
  if (e.key === "Escape") {
    home();
    return;
  }
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(
      document.activeElement.tagName,
    )
  )
    return;
  if (state === "choice" && /^[1-4]$/.test(e.key)) {
    e.preventDefault();
    pick(+e.key - 1);
  } else if (e.key === "Enter" || e.code === "Space") {
    e.preventDefault();
    if (state === "home" && e.key === "Enter") start("mixed");
    else if (state === "end" && e.key === "Enter") start(round.mode);
    else if (state === "draw") reveal();
    else if (state === "feedback" && performance.now() >= ready) next();
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === SAVE_KEY) {
    blocked = true;
    $("#storage-warning").textContent =
      "Progress updated in another tab. Reload this page to load the newest save.";
  }
});
home();
