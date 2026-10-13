"use strict";
// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
};
const cleanName = s => String(s || "").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 20) || "Summoner";
const pct = x => Math.round(x * 100) + "%";
const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const DIFF_LABEL = { easy: "Iron", normal: "Gold", hard: "Challenger" };
const DIFF_NOTE = {
  easy: "Bots pick almost at random and often end up off-role.",
  normal: "Bots draft sensibly with a little chaos.",
  hard: "Bots draft for team comp, hunt counter-picks and rarely misplay.",
};

const IMG_VER = "16.20.1";
const iconUrl = id => `https://ddragon.leagueoflegends.com/cdn/${IMG_VER}/img/champion/${encodeURIComponent(id)}.png`;
const artUrl = id => `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${encodeURIComponent(id)}_0.jpg`;
const splashUrl = id => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(id)}_0.jpg`;
const fallbackSrc = n => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#0a1428"/><text x="20" y="27" font-size="18" text-anchor="middle" fill="#c8aa6e" font-family="Georgia,serif">${n.charAt(0)}</text></svg>`);
function champImg(id, cls = "") {
  const c = CH[id] || { name: "?" };
  return `<img class="${cls}" src="${iconUrl(id)}" alt="${esc(c.name)}" title="${esc(c.name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSrc(c.name)}'">`;
}

// ---------- State ----------
const App = {
  view: "home", mode: null, name: store.get("rd_name") || "", modal: null, busy: null,
  settings: { size: 8, diff: "normal", duelDiff: "normal", timer: 45 },
  tour: null, myTeam: 0, watch: null, draft: null, plan: null,
  net: null, code: "", me: 0, guest: null, lobby: null,
  S: null, series: null, seriesId: null, seenGame: -1, deadline: 0, timerKey: null, timers: {}, picking: false,
  joinCode: (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5),
};
const isDuel = () => App.mode === "duel-bot" || App.mode === "host" || App.mode === "guest";
const myName = () => cleanName(App.name);
const HERO = rand(["Jinx", "Ahri", "Yasuo", "Darius", "Thresh", "Kaisa", "LeeSin", "Ezreal", "Akali", "Viego"]);

// ---------- Rendering ----------
const VIEWS = { home: vHome, draft: vDraft, roles: vRoles, plan: vPlan, bracket: vBracket, match: vMatch, end: vEnd,
  lobby: vLobby, duel: vDuel, dwait: vDwait, series: vSeries };
let feedTimer = null;

function render() {
  document.body.dataset.view = App.view;
  $("#app").innerHTML = VIEWS[App.view]() +
    (App.busy ? `<div class="busy"><div class="spinner big"></div><p>${esc(App.busy)}</p></div>` : "");
}
function go(view) {
  stopFeed();
  App.view = view;
  render();
  window.scrollTo(0, 0);
  if (view === "match") startFeed();
}
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.classList.add("out"), 3000);
  setTimeout(() => el.remove(), 3500);
}
function seg(key, opts, label, readonly = false, disabled = () => false) {
  const cur = App.settings[key];
  return `<div class="seg">${opts.map(o => `<button class="${o === cur ? "on" : ""}" ${readonly || disabled(o) ? "disabled" : ""}
    onclick="setSetting('${key}',${typeof o === "number" ? o : `'${o}'`})">${label(o)}</button>`).join("")}</div>`;
}
function setSetting(k, v) {
  App.settings[k] = v;
  if (App.mode === "host") syncLobby();
  render();
}
function setName(v) { App.name = v; store.set("rd_name", v); }
const secsLeft = () => Math.max(0, Math.ceil((App.deadline - Date.now()) / 1000));
const timerHtml = () => (App.deadline ? `<div class="timer ${secsLeft() <= 10 ? "low" : ""}" id="timer">${secsLeft()}</div>` : "");
setInterval(() => {
  const el = document.getElementById("timer");
  if (!el || !App.deadline) return;
  const s = secsLeft();
  el.textContent = s;
  el.classList.toggle("low", s <= 10);
}, 250);

// ---------- Home ----------
function initBg() {
  const pool = shuffle(CHAMPS).slice(0, 27);
  $("#bg").innerHTML = [0, 1, 2].map(i => {
    const set = pool.slice(i * 9, i * 9 + 9);
    return `<div class="bg-row r${i}">${set.concat(set).map(c => `<img src="${artUrl(c.id)}" alt="">`).join("")}</div>`;
  }).join("");
}
function vHome() {
  return `<section class="home">
    <header class="hero">
      <div class="kicker"><span></span>A League of Legends draft game<span></span></div>
      <h1 class="logo">RIFT<em>DRAFT</em></h1>
      <p class="tagline">Four champions appear. You keep one. Do it five times, set your lanes, and let the AI analyst decide who rules the Rift.</p>
      <label class="field name-field"><span>Summoner name</span>
        <input id="nm" maxlength="20" autocomplete="off" placeholder="Enter your name" value="${esc(App.name)}" oninput="setName(this.value)"></label>
    </header>
    <div class="modes">
      <button class="mode featured" onclick="openModal('solo')">
        <div class="feat-art" style="background-image:url('${splashUrl(HERO)}')"></div>
        <div class="feat-body">
          <span class="badge">Main mode</span>
          <h3>Solo Gauntlet</h3>
          <p>Draft a squad and battle through a 4, 8 or 16-team bracket of bot teams. One loss and you're out.</p>
          <span class="mode-cta">Play now <i>→</i></span>
        </div>
      </button>
      <div class="mode-stack">
        <button class="mode" onclick="openModal('duelbot')">
          <div class="mode-ic">${ICONS.swords}</div>
          <div><h3>Practice Duel</h3><p>Best of 3 against a bot, taking turns to pick.</p></div>
        </button>
        <button class="mode" onclick="hostOnline()">
          <div class="mode-ic">${ICONS.host}</div>
          <div><h3>Host Online Duel</h3><p>Create a room, then send the code to a friend.</p></div>
        </button>
        <div class="mode join-mode ${App.joinCode ? "invited" : ""}">
          <div class="mode-ic">${ICONS.join}</div>
          <div class="grow"><h3>${App.joinCode ? "You've been invited" : "Join Online Duel"}</h3>
            <div class="join-row"><input id="jc" maxlength="5" placeholder="CODE" value="${esc(App.joinCode)}" autocomplete="off"
              oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key==='Enter')joinOnline()">
            <button class="btn primary" onclick="joinOnline()">Join</button></div></div>
        </div>
      </div>
    </div>
    <div class="steps">
      <div class="step"><b>01</b><h4>Draft</h4><p>Pick one of four random champions, five times. In duels you take turns and no champion is ever offered twice.</p></div>
      <div class="step"><b>02</b><h4>Lanes &amp; game plan</h4><p>Click role icons to set lanes, then choose how your team plays: dive, front to back, poke, split push or pick.</p></div>
      <div class="step"><b>03</b><h4>Battle</h4><p>The AI analyst plays out every game from first blood to the Nexus, weighing comps, counters and whose game plan works.</p></div>
    </div>
    <footer>Rift Draft is a fan project and isn't endorsed by Riot Games. League of Legends and all champion art are © Riot Games.</footer>
  </section>${App.modal ? vModal() : ""}`;
}
function openModal(m) { App.modal = m; render(); }
function closeModal() { App.modal = null; render(); }
function vModal() {
  const solo = App.modal === "solo";
  const dk = solo ? "diff" : "duelDiff";
  return `<div class="modal-back" onclick="if(event.target===this)closeModal()"><div class="modal">
    <div class="kicker">${solo ? "Tournament vs bots" : "Best of 3 vs a bot"}</div>
    <h2>${solo ? "Solo Gauntlet" : "Practice Duel"}</h2>
    ${solo ? `<div class="setting"><span>Bracket size</span>${seg("size", [4, 8, 16], n => `${n} teams`)}</div>` : ""}
    <div class="setting"><span>Bot difficulty</span>${seg(dk, ["easy", "normal", "hard"], d => DIFF_LABEL[d])}
      <p class="note">${DIFF_NOTE[App.settings[dk]]}</p></div>
    ${solo ? "" : `<p class="note">You and the bot take turns picking (Blue: 1, 4, 5, 8, 9 · Red: 2, 3, 6, 7, 10). Sides swap each game.</p>`}
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn primary" onclick="${solo ? "startSolo()" : "startDuelBot()"}">Start draft</button></div>
  </div></div>`;
}

// ---------- Draft (shared) ----------
function stat(label, v) { return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v * 10}%"></i></div><b>${v}</b></div>`; }
function champCard(id, i, myPicks, enemyPicks) {
  const c = CH[id], need = neededRoles(myPicks);
  const beats = enemyPicks.filter(e => hasCounter(id, e)), fears = enemyPicks.filter(e => hasCounter(e, id));
  return `<button class="ccard" style="--d:${i * 90}ms" onclick="pickChamp(${i})">
    <div class="ccard-art" style="background-image:url('${artUrl(c.id)}')"></div>
    <span class="key">${i + 1}</span>
    <div class="ccard-body">
      <div class="ccard-roles">${c.roles.map(r => `<span class="rchip ${need.includes(r) ? "need" : ""}">${roleIcon(r)}${ROLE_LABEL[r]}</span>`).join("")}</div>
      <h3>${esc(c.name)}</h3>
      <div class="ccard-meta"><span class="dmg ${c.dmg}">${c.dmg}</span><span class="tagx">${CLASS_NAME[c.cls]}</span><span class="tagx">${c.range === "r" ? "Ranged" : "Melee"}</span></div>
      ${beats.length || fears.length ? `<div class="ctags">${beats.map(e => `<span class="ctag good">Counters ${esc(CH[e].name)}</span>`).join("")}${fears.map(e => `<span class="ctag bad">Countered by ${esc(CH[e].name)}</span>`).join("")}</div>` : ""}
      <div class="stats">${stat("Early", c.early)}${stat("Late", c.late)}${stat("Teamfight", c.tf)}${stat("Frontline", c.front)}${stat("CC", c.cc)}</div>
    </div></button>`;
}
function startSolo() {
  resetSession();
  App.mode = "solo";
  App.draft = { picks: [], options: rollOptions([]), rerolls: 1, assign: {} };
  go("draft");
}
function vDraft() {
  const d = App.draft, need = neededRoles(d.picks);
  return `<section class="page draft">
    <div class="draft-top">
      <div><div class="kicker">Champion select</div><h2>Pick ${d.picks.length + 1} <span class="muted">of 5</span></h2></div>
      <div class="need"><span class="muted small">Open roles</span>${ROLES.map(r => `<span class="need-r ${need.includes(r) ? "" : "filled"}" title="${ROLE_LABEL[r]}">${roleIcon(r)}</span>`).join("")}</div>
    </div>
    <div class="ccards">${d.options.map((id, i) => champCard(id, i, d.picks, [])).join("")}</div>
    <div class="draft-foot">
      <div class="slots">${[0, 1, 2, 3, 4].map(i => { const id = d.picks[i]; return id ? `<div class="slot filled">${champImg(id)}</div>` : `<div class="slot ${i === d.picks.length ? "next" : ""}">${i + 1}</div>`; }).join("")}</div>
      <button class="btn" ${d.rerolls ? "" : "disabled"} onclick="reroll()">↻ Reroll options (${d.rerolls})</button>
    </div>
  </section>`;
}
function animatePick(i, cb) {
  document.querySelectorAll(".ccard").forEach((el, j) => el.classList.add(j === i ? "chosen" : "faded"));
  setTimeout(cb, 420);
}
function pickChamp(i) {
  if (App.picking) return;
  App.picking = true;
  animatePick(i, () => {
    App.picking = false;
    if (isDuel()) return act({ t: "pick", i });
    const d = App.draft;
    d.picks.push(d.options[i]);
    if (d.picks.length === 5) go("roles");
    else { d.options = rollOptions(d.picks); render(); }
  });
}
function reroll() {
  if (isDuel()) return act({ t: "reroll" });
  const d = App.draft;
  if (d.rerolls < 1) return;
  d.rerolls--;
  d.options = rollOptions(d.picks, d.options);
  render();
}
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || !["1", "2", "3", "4"].includes(e.key)) return;
  if (document.querySelector(".ccard") && !App.picking) pickChamp(+e.key - 1);
});

// ---------- Lanes (shared) ----------
function setRole(id, role) {
  const a = App.draft.assign, prev = a[id];
  const other = Object.keys(a).find(k => a[k] === role && k !== id);
  if (prev === role) delete a[id];
  else {
    if (other) { if (prev) a[other] = prev; else delete a[other]; }
    a[id] = role;
  }
  render();
}
function autoAssign() {
  const r = bestRoles(App.draft.picks);
  App.draft.assign = Object.fromEntries(Object.entries(r).map(([role, id]) => [id, role]));
  render();
}
function clearAssign() { App.draft.assign = {}; render(); }
function enemyContext() {
  if (!isDuel()) return null;
  const S = App.series, G = S.games[S.games.length - 1], op = 1 - App.me;
  return { S, G, op, picks: G.picks[op], guess: bestRoles(G.picks[op]) };
}
function roleRow(id, ctx) {
  const c = CH[id], a = App.draft.assign, cur = a[id];
  const fit = !cur ? `<span class="fit none">Pick a lane</span>`
    : c.roles[0] === cur ? `<span class="fit main">Main role</span>`
    : c.roles.includes(cur) ? `<span class="fit sec">Secondary role</span>`
    : `<span class="fit off">Off-role (−28% power)</span>`;
  let mu = "";
  if (ctx && cur) {
    const e = ctx.guess[cur], m = matchup(id, e, cur);
    const cls = m.s >= 1 ? "good" : m.s <= -1 ? "bad" : "";
    mu = `<span class="mu ${cls}">vs ${esc(CH[e].name)}: ${m.s >= 1 ? "favoured" : m.s <= -1 ? "unfavoured" : "even"}</span>`;
  }
  return `<div class="rrow ${cur ? "set" : ""}">
    <div class="rrow-champ">${champImg(id, "rimg")}<div><b>${esc(c.name)}</b>${fit}${mu}</div></div>
    <div class="rbtns">${ROLES.map(r => {
      const owner = Object.keys(a).find(k => a[k] === r);
      const cls = [cur === r ? "on" : "", c.roles.includes(r) ? "nat" : "", owner && owner !== id ? "taken" : ""].join(" ");
      const tip = ROLE_LABEL[r] + (owner && owner !== id ? ` (swap with ${CH[owner].name})` : "");
      return `<button class="rbtn ${cls}" title="${esc(tip)}" onclick="setRole('${id}','${r}')">${roleIcon(r)}<span>${ROLE_LABEL[r]}</span></button>`;
    }).join("")}</div>
  </div>`;
}
function vRoles() {
  const d = App.draft, a = d.assign, ctx = enemyContext();
  const done = Object.keys(a).length === 5;
  const roles = {};
  for (const id in a) roles[a[id]] = id;
  const cs = d.picks.map(id => CH[id]);
  const ad = cs.filter(c => c.dmg === "AD").length, front = cs.reduce((s, c) => s + c.front, 0), cc = cs.reduce((s, c) => s + c.cc, 0);
  let gradeBox = `<p class="muted small">Assign all five lanes to see your team rating.</p>`;
  if (done) {
    const p = teamProfile(roles), g = gradeOf(p.power);
    let lanesLine = "";
    if (ctx) {
      const lm = laneMatchups({ roles }, { roles: ctx.guess });
      lanesLine = `<li>Favoured in ${lm.filter(l => l.adv >= 1).length} of 5 lanes vs their likely setup</li>`;
    }
    gradeBox = `<div class="grade-box"><div class="grade ${g}">${g}</div><ul class="notes">${lanesLine}${p.notes.map(n => `<li class="${n.bad ? "bad" : ""}">${esc(n.t)}</li>`).join("") || "<li>Well-rounded composition</li>"}</ul></div>`;
  }
  const pins = ROLES.map(r => {
    const id = roles[r], [x, y] = MAP_POS[r];
    return id ? `<div class="pin ${CH[id].roles.includes(r) ? "" : "off"}" style="left:${x}%;top:${y}%" title="${esc(CH[id].name)} (${ROLE_LABEL[r]})">${champImg(id)}</div>`
      : `<div class="pin empty" style="left:${x}%;top:${y}%" title="${ROLE_LABEL[r]}">${roleIcon(r)}</div>`;
  }).join("");
  return `<section class="page roles">
    ${ctx ? seriesBar(ctx.S, ctx.S.games.length - 1, scoreBefore(ctx.S, ctx.S.games.length - 1)) : ""}
    <div class="page-head row-between"><div><div class="kicker">Lane assignment</div><h2>Set your lanes</h2>
      <p class="muted">Click a role icon to send each champion to a lane. Icons with a gold dot are that champion's natural roles.</p></div>
      ${ctx ? timerHtml() : ""}</div>
    <div class="roles-grid">
      <div>
        <div class="rlist">${d.picks.map(id => roleRow(id, ctx)).join("")}</div>
        <div class="row-actions"><button class="btn" onclick="autoAssign()">Auto-assign</button><button class="btn ghost" onclick="clearAssign()">Clear</button></div>
        ${ctx ? enemyPanel(ctx) : ""}
      </div>
      <div class="side">
        <div class="panel map-panel"><div class="panel-h">Summoner's Rift</div><div class="map">${MAP_SVG}${pins}</div></div>
        <div class="panel analysis"><div class="panel-h">Team analysis</div>
          <div class="meter-row"><span>Damage</span><div class="split">${ad ? `<i class="ad" style="flex:${ad}">AD ${ad}</i>` : ""}${5 - ad ? `<i class="ap" style="flex:${5 - ad}">AP ${5 - ad}</i>` : ""}</div></div>
          <div class="meter-row"><span>Frontline</span><div class="mbar"><i style="width:${Math.min(100, front / 30 * 100)}%"></i></div></div>
          <div class="meter-row"><span>Crowd control</span><div class="mbar"><i style="width:${Math.min(100, cc / 45 * 100)}%"></i></div></div>
          ${gradeBox}
        </div>
        <button class="btn primary big lock" ${done && !d.locked ? "" : "disabled"} onclick="lockIn()">${d.locked ? "Locking in…" : "Lock in"}</button>
      </div>
    </div>
  </section>`;
}
function enemyPanel(ctx) {
  const mine = App.draft.picks, locked = !!ctx.G.roles[ctx.op];
  return `<div class="panel enemy"><div class="panel-h row-between"><span>Enemy draft: ${esc(ctx.S.players[ctx.op].name)}</span>
      <span class="status ${locked ? "good" : ""}">${locked ? "Locked in" : "Choosing lanes…"}</span></div>
    <div class="elist">${ROLES.map(r => {
      const id = ctx.guess[r], c = CH[id];
      const threats = mine.filter(m => hasCounter(id, m)).map(m => CH[m].name);
      const prey = mine.filter(m => hasCounter(m, id)).map(m => CH[m].name);
      return `<div class="erow">${champImg(id)}<div class="grow"><b>${esc(c.name)}</b><small>Likely ${ROLE_LABEL[r]} · ${CLASS_NAME[c.cls]}</small>
        ${threats.length ? `<small class="bad">Counters your ${esc(threats.join(", "))}</small>` : ""}
        ${prey.length ? `<small class="good">Countered by your ${esc(prey.join(", "))}</small>` : ""}</div></div>`;
    }).join("")}</div></div>`;
}
function lockIn() {
  const d = App.draft;
  if (Object.keys(d.assign).length < 5 || d.locked) return;
  const roles = {};
  for (const id in d.assign) roles[d.assign[id]] = id;
  if (isDuel()) { d.locked = true; render(); return act({ t: "roles", roles }); }
  App.tour = newTournament({ name: myName(), picks: d.picks, roles }, App.settings.size, App.settings.diff);
  App.myTeam = 0;
  go("bracket");
}

// ---------- Solo tournament ----------
function teamStatus(t, i) {
  if (t.champion === i) return { cls: "gold", text: "Champions", r: -1 };
  for (let r = 0; r < t.rounds.length; r++) {
    const m = t.rounds[r].find(m => m.a === i || m.b === i);
    if (m && m.w != null && m.w !== i) return { cls: "bad", text: `Out in ${roundName(t, r)}`, r };
  }
  return { cls: "good", text: "Still alive", r: -1 };
}
function lineupMini(roles) {
  return `<div class="lineup-mini">${ROLES.map(r => {
    const id = roles[r];
    return `<div class="lm"><span class="lm-r">${roleIcon(r)}</span>${champImg(id)}<span>${esc(CH[id].name)}</span>${CH[id].roles.includes(r) ? "" : `<em class="off">off-role</em>`}</div>`;
  }).join("")}</div>`;
}
const teamTitle = t => esc(ROLES.map(r => `${ROLE_LABEL[r]}: ${CH[t.roles[r]].name}`).join(" · "));
function vBracket() {
  const t = App.tour, nR = Math.log2(t.size), cur = t.rounds.length - 1;
  const cols = [];
  for (let r = 0; r < nR; r++) {
    const R = t.rounds[r], count = t.size / 2 ** (r + 1), ms = [];
    for (let i = 0; i < count; i++) ms.push(R ? R[i] : null);
    cols.push(`<div class="bcol"><div class="bcol-h">${roundName(t, r)}</div><div class="bcol-m">${ms.map((m, i) => bMatch(m, r, i, r === cur && t.champion == null)).join("")}</div></div>`);
  }
  const champ = t.champion != null ? t.teams[t.champion] : null;
  cols.push(`<div class="bcol champ-col"><div class="bcol-h">Champion</div><div class="bcol-m">
    <div class="bchamp ${champ ? "won" : ""}">${ICONS.trophy}<span>${champ ? esc(champ.name) : "TBD"}</span></div></div></div>`);
  const st = teamStatus(t, App.myTeam);
  return `<section class="page bracket-page">
    <div class="page-head"><div class="kicker">${t.size}-team bracket · ${DIFF_LABEL[t.diff]} bots</div>
      <h2>${champ ? "Tournament complete" : roundName(t, cur)}</h2></div>
    <div class="bracket-wrap"><div class="bracket">${cols.join("")}</div></div>
    <div class="bracket-bottom">
      <div class="panel"><div class="panel-h row-between"><span>Your team</span><span class="status ${st.cls}">${st.text}</span></div>
        <h3 class="team-title">${esc(t.teams[App.myTeam].name)}</h3>${lineupMini(t.teams[App.myTeam].roles)}</div>
      ${actionPanel(st)}
    </div>
  </section>`;
}
function bMatch(m, r, i, upcoming) {
  if (!m) return `<div class="bm empty"><div class="bt"><span class="bt-n">TBD</span></div><div class="bt"><span class="bt-n">TBD</span></div></div>`;
  const last = m.res ? m.res.events[m.res.events.length - 1] : null;
  const row = (ti, k) => {
    const tm = App.tour.teams[ti];
    const cls = [m.w == null ? "" : m.w === ti ? "win" : "lose", ti === App.myTeam ? "me" : ""].join(" ");
    return `<div class="bt ${cls}" title="${teamTitle(tm)}"><span class="bt-n">${esc(tm.name)}</span><span class="bt-k">${last ? last[k] : ""}</span></div>`;
  };
  return `<div class="bm ${m.res ? "played" : ""} ${upcoming && !m.res ? "upcoming" : ""}" ${m.res ? `onclick="watchTour(${r},${i})"` : ""}>${row(m.a, "ka")}${row(m.b, "kb")}</div>`;
}
function actionPanel(st) {
  const t = App.tour;
  if (t.champion != null) {
    return `<div class="panel action"><div class="panel-h">Tournament over</div>
      <p class="big-line"><b>${esc(t.teams[t.champion].name)}</b> are the champions.</p>
      <div class="btn-row"><button class="btn primary" onclick="go('end')">Trophy ceremony</button>
      <button class="btn" onclick="startSolo()">Play again</button><button class="btn ghost" onclick="leave()">Home</button></div></div>`;
  }
  const rn = roundName(t, t.rounds.length - 1), out = st.r >= 0;
  return `<div class="panel action"><div class="panel-h">Up next</div>
    <p class="big-line">${out ? "You've been knocked out." : rn}</p>
    <p class="muted small">${out ? "Keep watching to see who lifts the trophy, or skip straight to the end." : "Click a played match in the bracket to rewatch it."}</p>
    <div class="btn-row"><button class="btn primary big" onclick="${out ? "playNext()" : "openPlan()"}">Play ${rn}</button>
    ${out ? `<button class="btn" onclick="simToEnd()">Skip to the end</button>` : ""}<button class="btn ghost" onclick="leave()">Quit</button></div></div>`;
}
// ---------- Game plan (shared) ----------
function openPlan() {
  App.plan = { style: App.tour.teams[App.myTeam].style || null };
  go("plan");
}
function planCtx() {
  if (isDuel()) {
    const S = App.series, gi = S.games.length - 1, G = S.games[gi], op = 1 - App.me;
    return { duel: true, mine: G.roles[App.me], enemyName: S.players[op].name, enemyRoles: bestRoles(G.picks[op]),
      head: seriesBar(S, gi, scoreBefore(S, gi)), kicker: `Game ${gi + 1} · Before you load in` };
  }
  const t = App.tour, cur = t.rounds.length - 1, m = t.rounds[cur].find(x => x.a === App.myTeam || x.b === App.myTeam);
  const opp = t.teams[m.a === App.myTeam ? m.b : m.a];
  return { duel: false, mine: t.teams[App.myTeam].roles, enemyName: opp.name, enemyRoles: opp.roles, head: "", kicker: `${roundName(t, cur)} · Before you load in` };
}
const styleNames = list => list.map(x => STYLES[x].name).join(" and ");
function vPlan() {
  const c = planCtx(), sel = App.plan.style, fits = styleFits(c.mine), rec = bestStyle(c.mine);
  const lean = bestStyle(c.enemyRoles), leanFit = styleFit(c.enemyRoles, lean);
  const cards = STYLE_ORDER.map((s, i) => {
    const st = STYLES[s], f = Math.round(fits[s] * 100);
    const weak = STYLE_ORDER.filter(x => styleBeats(x, s));
    const badges = (s === rec ? `<span class="pbadge rec">Best fit</span>` : "") +
      (styleBeats(s, lean) ? `<span class="pbadge good">Counters their lean</span>` : "") +
      (styleBeats(lean, s) ? `<span class="pbadge bad">Risky vs their lean</span>` : "");
    return `<button class="plan-card ${sel === s ? "on" : ""}" style="--d:${i * 60}ms" onclick="pickStyle('${s}')">
      <div class="plan-top"><span class="plan-ic">${styleIcon(s)}</span><div class="grow"><h3>${st.name}</h3><p>${st.desc}</p></div></div>
      <div class="plan-fit"><span>Team fit</span><div class="mbar"><i style="width:${f}%"></i></div><b>${f}%</b></div>
      <div class="plan-champs">${ROLES.map(r => {
        const id = c.mine[r], cf = champStyleFit(id, s);
        return `<span class="pc ${cf >= 1 ? "great" : cf >= 0.45 ? "ok" : "no"}" title="${esc(CH[id].name)}: ${cf >= 1 ? "perfect fit" : cf >= 0.45 ? "decent fit" : "poor fit"}">${champImg(id)}</span>`;
      }).join("")}</div>
      <div class="plan-rps"><span class="good">Beats ${styleNames(st.beats)}</span><span class="bad">Weak to ${styleNames(weak)}</span></div>
      ${badges ? `<div class="pbadges">${badges}</div>` : ""}
    </button>`;
  }).join("");
  const counters = STYLE_ORDER.filter(x => styleBeats(x, lean));
  return `<section class="page plan">${c.head}
    <div class="page-head row-between"><div><div class="kicker">${c.kicker}</div><h2>Choose your game plan</h2>
      <p class="muted">How will your team play? Your champions decide how well you can pull each plan off, and some plans counter others.</p></div>
      ${c.duel ? timerHtml() : ""}</div>
    <div class="plan-grid">
      <div class="plan-cards">${cards}</div>
      <div class="side">
        <div class="panel scout"><div class="panel-h">Scouting report</div>
          <h3 class="scout-name">${esc(c.enemyName)}</h3>
          <div class="scout-champs">${ROLES.map(r => champImg(c.enemyRoles[r])).join("")}</div>
          <p class="scout-lean">${styleIcon(lean)}<span>Their champions lean towards <b>${STYLES[lean].name}</b> (${Math.round(leanFit * 100)}% fit).</span></p>
          <p class="muted small">${c.duel ? "They pick their plan in secret, just like you. " : ""}${styleNames(counters)} would counter it.</p>
        </div>
        <div class="panel legend"><div class="panel-h">Who beats who</div>
          <ul>${STYLE_ORDER.map(x => `<li>${styleIcon(x)}<b>${STYLES[x].name}</b><span>beats ${styleNames(STYLES[x].beats)}</span></li>`).join("")}</ul>
        </div>
      </div>
    </div>
    <div class="plan-actions"><button class="btn primary big" ${sel && !App.plan.locked ? "" : "disabled"} onclick="confirmPlan()">
      ${App.plan.locked ? "Loading in…" : sel ? `Load in with ${STYLES[sel].name}` : "Pick a game plan"}</button></div>
  </section>`;
}
function pickStyle(s) { if (App.plan && !App.plan.locked) { App.plan.style = s; render(); } }
function confirmPlan() {
  const s = App.plan.style;
  if (!isStyle(s) || App.plan.locked) return;
  if (isDuel()) { App.plan.locked = true; render(); return act({ t: "style", style: s }); }
  App.tour.teams[App.myTeam].style = s;
  playNext();
}
function playNext() {
  const t = App.tour;
  playRound(t);
  const R = t.rounds[t.played];
  const mi = R.findIndex(m => m.a === App.myTeam || m.b === App.myTeam);
  watchTour(t.played, mi < 0 ? 0 : mi);
}
function simToEnd() {
  while (App.tour.champion == null) playRound(App.tour);
  go("end");
}
function watchTour(r, m) { App.watch = { kind: "tour", r, m }; go("match"); }
function confetti() {
  const colors = ["#c8aa6e", "#f0e6d2", "#0ac8b9", "#ffd76a", "#4ea4ff"];
  return `<div class="confetti">${Array.from({ length: 60 }, () => `<i style="left:${Math.random() * 100}%;background:${rand(colors)};animation-delay:${(Math.random() * 3).toFixed(2)}s;animation-duration:${(3 + Math.random() * 3).toFixed(2)}s;transform:rotate(${ri(360)}deg)"></i>`).join("")}</div>`;
}
function vEnd() {
  const t = App.tour, w = t.teams[t.champion], mine = App.myTeam === t.champion, st = teamStatus(t, App.myTeam);
  return `<section class="page end">${mine ? confetti() : ""}
    <div class="trophy">${ICONS.trophy}</div>
    <div class="kicker">${t.size}-team tournament champions</div>
    <h1 class="logo champ-name">${esc(w.name)}</h1>
    <p class="tagline">${mine ? "Your draft conquered the Rift. Take a bow, summoner." : `Your team went out in the ${st.r >= 0 ? roundName(t, st.r) : "bracket"}. The Rift remembers.`}</p>
    <div class="lineup">${ROLES.map((r, i) => {
      const c = CH[w.roles[r]];
      return `<div class="lcard" style="--d:${i * 110}ms;background-image:url('${artUrl(c.id)}')"><div class="lcard-b"><span class="lrole">${roleIcon(r)}</span><b>${esc(c.name)}</b><small>${ROLE_LABEL[r]}</small></div></div>`;
    }).join("")}</div>
    <div class="btn-row center"><button class="btn primary big" onclick="startSolo()">Play again</button>
      <button class="btn" onclick="go('bracket')">View bracket</button><button class="btn ghost" onclick="leave()">Home</button></div>
  </section>`;
}

// ---------- Match viewer (shared) ----------
function scoreBefore(S, g) { return [0, 1].map(p => S.games.slice(0, g).filter(x => x.winner === p).length); }
function matchCtx() {
  const w = App.watch;
  if (w.kind === "tour") {
    const t = App.tour, M = t.rounds[w.r][w.m];
    const others = t.rounds[w.r].map((x, i) => {
      if (i === w.m) return "";
      const last = x.res.events[x.res.events.length - 1];
      return `<button class="om" onclick="watchTour(${w.r},${i})"><span class="${x.w === x.a ? "w" : "l"}">${esc(t.teams[x.a].name)}</span><b>${last.ka} – ${last.kb}</b><span class="${x.w === x.b ? "w" : "l"}">${esc(t.teams[x.b].name)}</span></button>`;
    }).join("");
    return { A: t.teams[M.a], B: t.teams[M.b], res: M.res, mySide: M.a === App.myTeam ? "a" : M.b === App.myTeam ? "b" : null,
      kicker: `${roundName(t, w.r)} · Match ${w.m + 1}`, head: "", others, othersTitle: `Other ${roundName(t, w.r)} results` };
  }
  const S = App.series, G = S.games[w.g], bp = G.blue, rp = 1 - bp;
  return { A: { name: S.players[bp].name, roles: G.roles[bp] }, B: { name: S.players[rp].name, roles: G.roles[rp] }, res: G.res,
    mySide: bp === App.me ? "a" : "b", kicker: `Game ${w.g + 1} · Best of 3`, head: seriesBar(S, w.g, scoreBefore(S, w.g)), others: "", othersTitle: "" };
}
function richText(s, A, B) {
  return esc(s).replace(/\*([^*]+)\*/g, '<b class="cn">$1</b>').replace(/§([ab])/g, (_, x) => `<b class="tn t-${x}">${esc((x === "a" ? A : B).name)}</b>`);
}
function roster(T, s, mySide) {
  return `<div class="roster ${s}">${ROLES.map(r => {
    const id = T.roles[r], off = !CH[id].roles.includes(r);
    return `<div class="rp"><div class="rp-img">${champImg(id)}<span class="rp-role">${roleIcon(r)}</span></div>
      <div class="rp-n"><b>${esc(CH[id].name)}</b><small class="${off ? "off" : ""}">${ROLE_LABEL[r]}${off ? " · off-role" : ""}</small></div>
      <span class="rp-k" id="k-${s}-${r}">0</span></div>`;
  }).join("")}</div>`;
}
function analystCard(T, res, s) {
  const g = res.grade[s], notes = res.notes[s];
  return `<div class="panel an-card"><div class="panel-h">Analyst: <span class="t-${s}">${esc(T.name)}</span></div>
    <div class="an"><div class="grade ${g}">${g}</div><ul class="notes">${notes.length ? notes.map(n => `<li class="${n.bad ? "bad" : ""}">${esc(n.t)}</li>`).join("") : "<li>Well-rounded composition</li>"}</ul></div></div>`;
}
function lanesPanel(c) {
  return `<div class="panel lanes"><div class="panel-h">Lane matchups</div>${c.res.lanes.map(l => {
    const a = c.A.roles[l.role], b = c.B.roles[l.role], w = Math.min(Math.abs(l.adv) / 4, 1) * 50;
    const fav = l.adv >= 1 ? "a" : l.adv <= -1 ? "b" : "";
    return `<div class="lane ${fav ? "fav-" + fav : ""}">
      <div class="ln-c a">${champImg(a)}<b>${esc(CH[a].name)}</b></div>
      <div class="ln-mid"><span class="ln-role">${roleIcon(l.role)}</span><div class="ln-bar"><i class="${l.adv > 0 ? "a" : "b"}" style="width:${w}%"></i></div></div>
      <div class="ln-c b"><b>${esc(CH[b].name)}</b>${champImg(b)}</div>
      <div class="ln-why">${esc(l.why)}</div></div>`;
  }).join("")}</div>`;
}
function planChip(res, s) {
  const x = res.styles && res.styles[s];
  return x && STYLES[x.id] ? `<span class="sb-style">${styleIcon(x.id)}${STYLES[x.id].name} · ${Math.round(x.fit * 100)}% fit</span>` : "";
}
function vMatch() {
  const c = matchCtx(), res = c.res;
  return `<section class="page match">
    ${c.head}
    <div class="match-kicker kicker">${c.kicker}</div>
    <div class="scoreboard">
      <div class="sb-team a"><span class="sb-side">Blue side${c.mySide === "a" ? " · You" : ""}</span><h3>${esc(c.A.name)}</h3>${planChip(res, "a")}</div>
      <div class="sb-mid"><div class="sb-k"><span id="ka">0</span><i>${ICONS.swords}</i><span id="kb">0</span></div>
        <div class="sb-clock" id="clk">00:00</div><div class="sb-gold" id="gold">Gold even</div></div>
      <div class="sb-team b"><span class="sb-side">${c.mySide === "b" ? "You · " : ""}Red side</span><h3>${esc(c.B.name)}</h3>${planChip(res, "b")}</div>
    </div>
    <div class="wp"><div class="wp-bar"><i id="wpbar" style="width:${res.pre * 100}%"></i></div>
      <div class="wp-l"><span id="wpa">${pct(res.pre)}</span><span class="muted">Win probability</span><span id="wpb">${pct(1 - res.pre)}</span></div></div>
    <div class="match-grid">
      ${roster(c.A, "a")}
      <div class="panel feed-wrap"><div class="panel-h row-between"><span>Live commentary</span><button class="btn tiny" id="skip" onclick="skipFeed()">Skip ▸▸</button></div>
        <div class="feed" id="feed"><div class="feed-empty">The minions are spawning…</div></div></div>
      ${roster(c.B, "b")}
    </div>
    <div class="match-actions"><button class="btn primary big" id="cont" disabled onclick="continueFromMatch()">Continue</button></div>
    <div class="analysis-row">${analystCard(c.A, res, "a")}${lanesPanel(c)}${analystCard(c.B, res, "b")}</div>
    ${c.others ? `<div class="others"><div class="panel-h">${c.othersTitle}</div><div class="om-list">${c.others}</div></div>` : ""}
    <div id="banner"></div>
  </section>`;
}
function startFeed() {
  App.feedI = 0;
  App.feedK = {};
  App.feedCtx = matchCtx();
  feedTimer = setInterval(feedStep, 1150);
  setTimeout(feedStep, 400);
}
function stopFeed() { clearInterval(feedTimer); feedTimer = null; }
function feedStep() {
  if (!feedTimer) return;
  const ev = App.feedCtx.res.events;
  if (App.feedI >= ev.length) return finishFeed();
  showEvent(ev[App.feedI++]);
}
function showEvent(e) {
  const { A, B } = App.feedCtx, feed = $("#feed");
  if (!feed) return;
  const empty = feed.querySelector(".feed-empty");
  if (empty) empty.remove();
  feed.insertAdjacentHTML("beforeend", `<div class="fe ${e.side ? "s-" + e.side : ""}"><span class="fe-t">${fmtTime(e.time)}</span><p>${richText(e.text, A, B)}</p></div>`);
  feed.scrollTop = feed.scrollHeight;
  $("#ka").textContent = e.ka;
  $("#kb").textContent = e.kb;
  $("#clk").textContent = fmtTime(e.time);
  $("#gold").textContent = Math.abs(e.gold) < 500 ? "Gold even" : `${e.gold > 0 ? "Blue" : "Red"} +${(Math.abs(e.gold) / 1000).toFixed(1)}k gold`;
  $("#gold").className = "sb-gold " + (Math.abs(e.gold) < 500 ? "" : e.gold > 0 ? "a" : "b");
  $("#wpbar").style.width = e.wp * 100 + "%";
  $("#wpa").textContent = pct(e.wp);
  $("#wpb").textContent = pct(1 - e.wp);
  for (const k of e.k) {
    App.feedK[k] = (App.feedK[k] || 0) + 1;
    const el = document.getElementById("k-" + k.replace(":", "-"));
    if (el) { el.textContent = App.feedK[k]; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
  }
}
function skipFeed() {
  if (!feedTimer) return;
  const ev = App.feedCtx.res.events;
  while (App.feedI < ev.length) showEvent(ev[App.feedI++]);
  finishFeed();
}
function finishFeed() {
  stopFeed();
  const cont = $("#cont"), skip = $("#skip");
  if (cont) cont.disabled = false;
  if (skip) skip.remove();
  const { A, B, res, mySide } = App.feedCtx, W = res.winner === "a" ? A : B;
  const mvpId = W.roles[res.mvp.role];
  const title = mySide ? (res.winner === mySide ? "Victory" : "Defeat") : `${esc(W.name)} win`;
  const cls = mySide ? (res.winner === mySide ? "victory" : "defeat") : "neutral";
  setTimeout(() => {
    const b = $("#banner");
    if (!b) return;
    b.innerHTML = `<div class="banner ${cls}" onclick="this.remove()"><div class="banner-in"><h2>${title}</h2><div class="line"></div>
      <p>${champImg(mvpId)}<span>MVP: <b>${esc(CH[mvpId].name)}</b> · ${res.mvp.kills} kills</span></p><small>Click anywhere to continue</small></div></div>`;
    setTimeout(() => { const el = b.querySelector(".banner"); if (el) el.classList.add("out"); }, 3200);
    setTimeout(() => { const el = b.querySelector(".banner"); if (el) el.remove(); }, 3700);
  }, 350);
}
function continueFromMatch() {
  const w = App.watch;
  if (w.kind === "tour") {
    const t = App.tour;
    return go(t.champion != null && w.r === t.played ? "end" : "bracket");
  }
  const S = App.series, last = S.games.length - 1;
  if (S.winner != null) return go("series");
  if (w.g === last && S.phase === "result") {
    go("dwait");
    if (!S.ready[App.me]) act({ t: "next" });
    return;
  }
  go(duelRoute());
}

// ---------- Duel: shared views ----------
function seriesBar(S, g, score) {
  const pips = n => [0, 1].map(i => `<i class="${i < n ? "on" : ""}"></i>`).join("");
  const P = i => `<div class="sbar-p ${i ? "r" : ""} ${App.me === i ? "me" : ""}"><b>${esc(S.players[i].name)}</b>${App.me === i ? `<em>You</em>` : ""}<span class="pips">${pips(score[i])}</span></div>`;
  return `<div class="sbar">${P(0)}<div class="sbar-mid"><span>Best of 3</span><b>Game ${g + 1}</b></div>${P(1)}</div>`;
}
function duelRoute() {
  const S = App.series, G = S.games[S.games.length - 1];
  if (S.phase === "draft") return "duel";
  if (S.phase === "roles") return G.roles[App.me] ? "dwait" : "roles";
  if (S.phase === "plan") return G.styles[App.me] ? "dwait" : "plan";
  return S.winner != null ? "series" : "dwait";
}
function syncDuelView() {
  const S = App.series;
  if (!S) return;
  const fresh = App.seriesId !== S.id;
  if (fresh) { App.seriesId = S.id; App.seenGame = -1; }
  const gi = S.games.length - 1, G = S.games[gi];
  if (S.phase === "result" && App.seenGame < gi) { App.seenGame = gi; App.watch = { kind: "duel", g: gi }; return go("match"); }
  if (!fresh && App.view === "match") return; // don't interrupt a game that's playing out
  const v = duelRoute();
  if (v === "roles" && (!App.draft || App.draft.gi !== gi || App.draft.sid !== S.id)) App.draft = { picks: [...G.picks[App.me]], assign: {}, gi, sid: S.id };
  if (v === "plan" && (!App.plan || App.plan.gi !== gi || App.plan.sid !== S.id)) App.plan = { style: null, gi, sid: S.id };
  if (App.view === v) render(); else go(v);
}
function nextTurnText(G, me) {
  for (let i = G.turn + 1; i < 10; i++) {
    const who = PICK_ORDER[i] === "B" ? G.blue : 1 - G.blue;
    if (who === me) return i === G.turn + 1 ? "You're up next." : `Your next pick is in ${i - G.turn} turns.`;
  }
  return "That's the last pick of the draft.";
}
function vDuel() {
  const S = App.series, gi = S.games.length - 1, G = S.games[gi], me = App.me, op = 1 - me, p = pickerOf(G), mine = p === me;
  const col = x => {
    const side = G.blue === x ? "blue" : "red", picks = G.picks[x];
    return `<div class="tcol ${side} ${x === me ? "mine" : ""}">
      <div class="tcol-h"><span class="side">${side === "blue" ? "Blue side" : "Red side"}</span><b>${esc(S.players[x].name)}</b>${x === me ? `<em class="tag">You</em>` : ""}</div>
      ${[0, 1, 2, 3, 4].map(k => {
        const id = picks[k], live = !id && k === picks.length && p === x;
        return id ? `<div class="pslot filled">${champImg(id)}<div><b>${esc(CH[id].name)}</b><small>${CH[id].roles.map(r => ROLE_LABEL[r]).join(" / ")}</small></div></div>`
          : `<div class="pslot ${live ? "live" : ""}"><span>${live ? "Picking…" : ""}</span></div>`;
      }).join("")}</div>`;
  };
  const order = PICK_ORDER.map((s, i) => {
    const who = s === "B" ? G.blue : 1 - G.blue;
    return `<span class="po ${s === "B" ? "b" : "r"} ${i < G.turn ? "done" : ""} ${i === G.turn ? "now" : ""} ${who === me ? "me" : ""}" title="${esc(S.players[who].name)}">${i + 1}</span>`;
  }).join("");
  let center;
  if (mine) {
    center = `<div class="turn-h"><div><div class="kicker">Your pick</div><h2>Choose a champion</h2></div>${timerHtml()}</div>
      <div class="ccards compact">${G.options.map((id, i) => champCard(id, i, G.picks[me], G.picks[op])).join("")}</div>
      <div class="turn-foot"><span class="muted small">Only you can see these, and they won't be offered again this game.</span>
        <button class="btn" ${G.rerolls[me] ? "" : "disabled"} onclick="reroll()">↻ Reroll (${G.rerolls[me]})</button></div>`;
  } else {
    const taken = new Set([...G.picks[0], ...G.picks[1]]);
    const intel = G.picks[op].map(e => {
      const answers = CHAMPS.filter(c => hasCounter(c.id, e) && !taken.has(c.id)).slice(0, 4).map(c => c.name);
      return answers.length ? `<li>${champImg(e)}<span><b>${esc(CH[e].name)}</b> is countered by ${esc(answers.join(", "))}</span></li>` : "";
    }).join("");
    center = `<div class="opp-turn"><div class="spinner big"></div><h2>${esc(S.players[op].name)} is picking…</h2>${timerHtml()}
      <p class="muted">${nextTurnText(G, me)}</p>
      ${intel ? `<div class="intel"><div class="panel-h">Counter intel</div><ul>${intel}</ul></div>` : ""}</div>`;
  }
  return `<section class="page duel">${seriesBar(S, gi, scoreBefore(S, gi))}
    <div class="porder">${order}</div>
    <div class="duel-grid">${col(G.blue)}<div class="dcenter">${center}</div>${col(1 - G.blue)}</div>
  </section>`;
}
function vDwait() {
  const S = App.series, gi = S.games.length - 1, G = S.games[gi], op = 1 - App.me, opn = esc(S.players[op].name);
  const lanes = S.phase === "roles", plan = S.phase === "plan", pre = lanes || plan;
  const mine = G.roles[App.me] && G.roles[App.me] !== "locked" ? G.roles[App.me] : null;
  const myPlan = plan && isStyle(G.styles[App.me]) ? G.styles[App.me] : null;
  return `<section class="page dwait">${seriesBar(S, gi, pre ? scoreBefore(S, gi) : S.score)}
    <div class="panel wait-card"><div class="spinner big"></div>
      <h2>${lanes ? "Lanes locked in" : plan ? "Game plan locked in" : "Ready for the next game"}</h2>
      <p class="muted">${lanes ? `Waiting for ${opn} to lock in their lanes…` : plan ? `Waiting for ${opn} to choose their game plan…` : `Waiting for ${opn} to ready up for Game ${gi + 2}…`}</p>
      ${myPlan ? `<p class="scout-lean">${styleIcon(myPlan)}<span>You're going with <b>${STYLES[myPlan].name}</b>.</span></p>` : ""}
      ${pre ? timerHtml() : ""}
      ${mine ? `<div class="wait-lineup">${lineupMini(mine)}</div>` : ""}
      <button class="btn ghost" onclick="leave()">Leave</button>
    </div></section>`;
}
function vSeries() {
  const S = App.series, w = S.winner, me = App.me, won = w === me;
  const games = S.games.map((g, i) => {
    const last = g.res.events[g.res.events.length - 1];
    const mvpId = g.roles[g.res.mvp.side === "a" ? g.blue : 1 - g.blue][g.res.mvp.role];
    return `<button class="game-row" onclick="watchGame(${i})"><span class="gr-n">Game ${i + 1}</span>
      <span class="gr-w ${g.winner === me ? "good" : "bad"}">${esc(S.players[g.winner].name)} won</span>
      <span class="gr-k">${last.ka}–${last.kb} · ${fmtTime(last.time)}</span>
      <span class="gr-mvp">${champImg(mvpId)}MVP</span><span class="gr-go">Rewatch ▸</span></button>`;
  }).join("");
  return `<section class="page end series-end">${won ? confetti() : ""}
    <div class="trophy ${won ? "" : "dim"}">${won ? ICONS.trophy : ICONS.swords}</div>
    <div class="kicker">Best of 3 · Series over</div>
    <h1 class="logo champ-name ${won ? "" : "defeat"}">${won ? "Victory" : "Defeat"}</h1>
    <p class="tagline">${won ? `You beat ${esc(S.players[1 - me].name)} ${S.score[me]}–${S.score[1 - me]}.` : `${esc(S.players[w].name)} takes the series ${S.score[w]}–${S.score[1 - w]}.`}</p>
    <div class="final-score"><div class="${w === 0 ? "win" : ""}"><b>${esc(S.players[0].name)}</b><span>${S.score[0]}</span></div><i>–</i>
      <div class="${w === 1 ? "win" : ""}"><span>${S.score[1]}</span><b>${esc(S.players[1].name)}</b></div></div>
    <div class="games">${games}</div>
    <div class="btn-row center">
      ${App.mode === "guest" ? `<p class="waiting"><span class="spinner"></span>Waiting for the host to start a rematch…</p>` : `<button class="btn primary big" onclick="rematch()">Rematch</button>`}
      ${App.mode === "host" ? `<button class="btn" onclick="hostBackToLobby()">Back to lobby</button>` : ""}
      <button class="btn ghost" onclick="leave()">${App.mode === "duel-bot" ? "Home" : "Leave"}</button>
    </div></section>`;
}
function watchGame(i) { App.watch = { kind: "duel", g: i }; go("match"); }
function rematch() { if (App.mode === "duel-bot") startDuelBot(); else if (App.mode === "host") hostStartSeries(); }

// ---------- Duel: authority (host or practice) ----------
// The host's browser owns the series state (App.S). Players send actions; the host applies them and publishes views.
function act(m) {
  if (App.mode === "guest") App.net.toHost(m);
  else duelAct(0, m);
}
function duelAct(p, m) {
  const S = App.S;
  if (!S || !m) return;
  let ok = false;
  if (m.t === "pick") ok = seriesPick(S, p, m.i | 0);
  else if (m.t === "reroll") ok = seriesReroll(S, p);
  else if (m.t === "roles") ok = seriesRoles(S, p, m.roles);
  else if (m.t === "style") ok = seriesStyle(S, p, m.style);
  else if (m.t === "next") ok = seriesReady(S, p);
  if (ok) publish();
  else if (p === App.me) { if (App.draft) App.draft.locked = false; if (App.plan) App.plan.locked = false; }
}
function publish() {
  const S = App.S;
  if (!S) return;
  armTimer();
  App.series = seriesView(S, 0);
  App.deadline = S.deadline;
  if (App.mode === "host" && App.guest) App.net.send(App.guest.id, { t: "series", s: seriesView(S, 1), left: S.deadline ? S.deadline - Date.now() : 0 });
  syncDuelView();
  scheduleBot();
}
function clearTimers() { clearTimeout(App.timers.turn); clearTimeout(App.timers.bot); }
function armTimer() {
  const S = App.S, G = curGame(S), key = `${S.id}:${S.games.length}:${S.phase}:${G.turn}`;
  if (key === App.timerKey) return;
  App.timerKey = key;
  clearTimeout(App.timers.turn);
  S.deadline = 0;
  if (!S.timer) return;
  const ms = S.phase === "draft" ? S.timer * 1000 : S.phase === "roles" ? Math.max(60, S.timer * 2) * 1000
    : S.phase === "plan" ? Math.max(30, S.timer) * 1000 : 0;
  if (!ms) return;
  S.deadline = Date.now() + ms;
  App.timers.turn = setTimeout(onTurnTimeout, ms + 250);
}
function onTurnTimeout() {
  const S = App.S;
  if (!S) return;
  const G = curGame(S);
  if (S.phase === "draft") {
    const p = pickerOf(G);
    seriesPick(S, p, botChoosePick(G, p, "normal"));
    tellPlayer(p, "Time's up! A champion was picked for you.");
  } else if (S.phase === "roles") {
    [0, 1].forEach(p => { if (!G.roles[p]) seriesRoles(S, p, bestRoles(G.picks[p])); });
  } else if (S.phase === "plan") {
    [0, 1].forEach(p => {
      if (G.styles[p]) return;
      seriesStyle(S, p, bestStyle(G.roles[p]));
      tellPlayer(p, "Time's up! You'll play your best-fit game plan.");
    });
  } else return;
  publish();
}
function tellPlayer(p, msg) {
  if (p === App.me) toast(msg);
  else if (App.mode === "host" && App.guest) App.net.send(App.guest.id, { t: "toast", msg });
}
function scheduleBot() {
  const S = App.S;
  if (!S || !S.players[1].bot) return;
  clearTimeout(App.timers.bot);
  const G = curGame(S);
  if (S.phase === "draft" && pickerOf(G) === 1) {
    const turn = G.turn;
    App.timers.bot = setTimeout(() => {
      if (App.S === S && curGame(S) === G && S.phase === "draft" && G.turn === turn) { seriesPick(S, 1, botChoosePick(G, 1, S.diff)); publish(); }
    }, 900 + ri(900));
  } else if (S.phase === "roles" && !G.roles[1]) {
    App.timers.bot = setTimeout(() => {
      if (App.S === S && S.phase === "roles" && !G.roles[1]) { seriesRoles(S, 1, botRoles(G, 1, S.diff)); publish(); }
    }, 1500);
  } else if (S.phase === "plan" && !G.styles[1]) {
    App.timers.bot = setTimeout(() => {
      if (App.S === S && S.phase === "plan" && !G.styles[1]) { seriesStyle(S, 1, botStyle(G.roles[1], bestRoles(G.picks[0]), S.diff)); publish(); }
    }, 1500);
  } else if (S.phase === "result" && S.winner == null) S.ready[1] = true;
}
function startDuelBot() {
  resetSession();
  App.mode = "duel-bot";
  App.me = 0;
  App.S = newSeries([{ name: myName() }, { name: rand(BOT_NAMES), bot: true }], { timer: 0, diff: App.settings.duelDiff });
  publish();
}

// ---------- Duel: online lobby ----------
async function hostOnline() {
  App.busy = "Creating a room…";
  render();
  try {
    const net = await Net.create();
    resetSession();
    Object.assign(App, { net, mode: "host", code: net.code, me: 0 });
    net.on("message", hostHandle);
    net.on("leave", hostLeave);
    App.busy = null;
    syncLobby();
    go("lobby");
  } catch (e) {
    App.busy = null;
    render();
    toast("Couldn't create a room: " + e.message);
  }
}
async function joinOnline() {
  const code = (($("#jc") || {}).value || "").trim().toUpperCase();
  if (code.length < 4) return toast("Enter the room code from your friend");
  App.busy = `Joining room ${code}…`;
  render();
  try {
    const net = await Net.join(code);
    resetSession();
    Object.assign(App, { net, mode: "guest", code: net.code || code, me: 1 });
    net.on("message", (_, m) => guestHandle(m));
    net.on("close", reason => { if (App.net === net) { toast(reason || "Disconnected"); leave(); } });
    net.toHost({ t: "hello", name: myName() });
    App.busy = null;
    go("lobby");
  } catch (e) {
    App.busy = null;
    render();
    toast(e.message || "Couldn't join that room");
  }
}
function hostHandle(from, m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "hello") {
    if (App.guest && App.guest.id !== from) return App.net.send(from, { t: "error", msg: "That room already has two players." });
    App.guest = { id: from, name: cleanName(m.name) };
    toast(`${App.guest.name} joined your room`);
    syncLobby();
    return;
  }
  if (App.guest && from === App.guest.id) duelAct(1, m);
}
function hostLeave(id) {
  if (!App.guest || App.guest.id !== id) return;
  toast(`${App.guest.name} left the room`);
  App.guest = null;
  if (App.S) { clearTimers(); App.S = null; App.series = null; App.seriesId = null; }
  syncLobby();
  if (App.view !== "lobby") go("lobby");
}
function syncLobby() {
  App.lobby = { host: myName(), guest: App.guest ? App.guest.name : null, timer: App.settings.timer };
  if (App.guest) App.net.send(App.guest.id, { t: "lobby", ...App.lobby });
  if (App.view === "lobby") render();
}
function hostStartSeries() {
  if (!App.guest) return;
  clearTimers();
  App.timerKey = null;
  App.S = newSeries([{ name: myName() }, { name: App.guest.name }], { timer: App.settings.timer });
  publish();
}
function hostBackToLobby() {
  clearTimers();
  Object.assign(App, { S: null, series: null, seriesId: null });
  if (App.guest) App.net.send(App.guest.id, { t: "reset" });
  syncLobby();
  go("lobby");
}
function guestHandle(m) {
  if (!m || typeof m !== "object") return;
  if (m.t === "lobby") { App.lobby = m; if (App.view === "lobby") render(); }
  else if (m.t === "series" && m.s) { App.series = m.s; App.deadline = m.left ? Date.now() + m.left : 0; syncDuelView(); }
  else if (m.t === "reset") { Object.assign(App, { series: null, seriesId: null }); go("lobby"); toast("The host went back to the lobby"); }
  else if (m.t === "toast" && typeof m.msg === "string") toast(m.msg);
  else if (m.t === "error") { toast(m.msg); leave(); }
}
function copyInvite() {
  const link = location.origin + location.pathname + "?room=" + App.code;
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
    .then(() => toast("Invite link copied"), () => toast("Couldn't copy. Share the code instead."));
}
function vLobby() {
  const L = App.lobby || {}, host = App.mode === "host";
  const timerLabel = n => (n ? `${n}s` : "Off");
  const guestSlot = L.guest
    ? `<div class="vs-slot red"><div class="av">${esc(L.guest.charAt(0))}</div><b>${esc(L.guest)}</b>${App.mode === "guest" ? `<em class="tag">You</em>` : ""}</div>`
    : `<div class="vs-slot red empty"><div class="spinner"></div><b>Waiting for an opponent…</b><small>Send them the code or invite link</small></div>`;
  return `<section class="page lobby">
    <div class="page-head center"><div class="kicker">Online duel · Best of 3</div><h2>Lobby</h2></div>
    <div class="panel lobby-card">
      <div class="invite"><div><div class="panel-h">Room code</div><div class="code-big">${esc(App.code)}</div></div>
        <button class="btn" onclick="copyInvite()">Copy invite link</button></div>
      <div class="versus">
        <div class="vs-slot blue"><div class="av">${esc((L.host || "?").charAt(0))}</div><b>${esc(L.host || "Host")}</b><em class="tag gold">Host</em>${host ? `<em class="tag">You</em>` : ""}</div>
        <div class="vs-mid">VS</div>${guestSlot}
      </div>
      <div class="setting"><span>Pick timer</span>${host ? seg("timer", [0, 30, 45, 60], timerLabel) : `<div class="seg"><button class="on" disabled>${timerLabel(L.timer)}</button></div>`}</div>
      <ul class="format">
        <li>You take turns picking: Blue gets picks 1, 4, 5, 8 and 9, Red gets 2, 3, 6, 7 and 10.</li>
        <li>No champion is offered twice in a game, and only the picker sees their options.</li>
        <li>Sides swap for Game 2. The loser of Game 2 gets Blue side (first pick) in Game 3.</li>
        <li>After lanes, each player secretly picks a game plan: Dive, Front to Back, Poke, Split Push or Pick.</li>
        <li>Lane counters, team comps and whose game plan works all feed the AI analyst's verdict.</li>
      </ul>
      <div class="btn-row center">
        ${host ? `<button class="btn primary big" ${L.guest ? "" : "disabled"} onclick="hostStartSeries()">Start series</button>`
          : `<p class="waiting"><span class="spinner"></span>Waiting for the host to start the series…</p>`}
        <button class="btn ghost" onclick="leave()">Leave room</button>
      </div>
      <p class="muted small center">Connected ${App.net && App.net.kind === "server" ? "through the game server" : "peer-to-peer"}.</p>
    </div>
  </section>`;
}

// ---------- Session ----------
function resetSession() {
  clearTimers();
  Object.assign(App, { mode: null, modal: null, tour: null, watch: null, draft: null, code: "", guest: null, lobby: null,
    S: null, series: null, seriesId: null, seenGame: -1, deadline: 0, timerKey: null, picking: false });
}
function leave() {
  const n = App.net;
  App.net = null;
  try { if (n) n.close(); } catch (e) { /* already closed */ }
  resetSession();
  try { if (location.search) history.replaceState(null, "", location.pathname); } catch (e) { /* file:// */ }
  App.joinCode = "";
  go("home");
}
window.addEventListener("beforeunload", e => {
  if ((App.mode === "host" && App.guest) || (App.mode === "guest" && App.series)) { e.preventDefault(); e.returnValue = ""; }
});

initBg();
go("home");
