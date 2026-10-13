"use strict";
// Game rules: drafting, counter matchups, match simulation, tournament bracket and Bo3 series.
// Everything here is plain data in / plain data out so the host can run it and send results to players.

const ROLES = ["Top", "Jungle", "Mid", "ADC", "Support"];
const ROLE_LABEL = { Top: "Top", Jungle: "Jungle", Mid: "Mid", ADC: "Bot", Support: "Support" };
const CLASS_NAME = { T: "Tank", F: "Fighter", A: "Assassin", M: "Mage", K: "Marksman", E: "Enchanter" };
const CH = Object.create(null);
CHAMPS.forEach(c => (CH[c.id] = c));
const isChamp = id => typeof id === "string" && id in CH;

const rand = a => a[Math.floor(Math.random() * a.length)];
const ri = n => Math.floor(Math.random() * n);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sig = x => 1 / (1 + Math.exp(-x));
function wpick(pairs) {
  let x = Math.random() * pairs.reduce((s, p) => s + p[1], 0);
  for (const p of pairs) if ((x -= p[1]) <= 0) return p[0];
  return pairs[pairs.length - 1][0];
}
const PERMS = (function perms(a) { return a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])); })(ROLES);

// ---------- Roles ----------
const fitMult = (c, r) => (c.roles[0] === r ? 1 : c.roles.includes(r) ? 0.95 : 0.72);
const champValue = c => (c.early + c.late + c.tf) / 3 + c.cc * 0.1 + c.front * 0.05;

function bestRoles(picks) {
  const out = {};
  if (!picks.length) return out;
  let best = PERMS[0], bs = -1;
  for (const p of PERMS) {
    let s = 0;
    picks.forEach((id, i) => { const c = CH[id]; s += c.roles[0] === p[i] ? 3 : c.roles.includes(p[i]) ? 2 : 0; });
    if (s > bs) { bs = s; best = p; }
  }
  picks.forEach((id, i) => (out[best[i]] = id));
  return out;
}
function neededRoles(picks) {
  const r = bestRoles(picks);
  return ROLES.filter(role => !(r[role] && CH[r[role]].roles.includes(role)));
}
function validRoles(picks, roles) {
  if (!roles || typeof roles !== "object") return null;
  const out = {};
  for (const r of ROLES) { if (!picks.includes(roles[r])) return null; out[r] = roles[r]; }
  return new Set(Object.values(out)).size === 5 ? out : null;
}

// Three options; at least one fills a role the team still needs.
function makeOptions(pool, picks) {
  const need = neededRoles(picks);
  const fit = shuffle(pool.filter(c => c.roles.some(r => need.includes(r))));
  const first = fit[0] || rand(pool);
  return shuffle([first, ...shuffle(pool.filter(c => c !== first)).slice(0, 2)]).map(c => c.id);
}
function rollOptions(picks, exclude = []) {
  const bad = new Set([...picks, ...exclude]);
  let pool = CHAMPS.filter(c => !bad.has(c.id));
  if (pool.length < 3) pool = CHAMPS.filter(c => !picks.includes(c.id));
  return makeOptions(pool, picks);
}

// ---------- Counters ----------
const hasCounter = (a, b) => Object.prototype.hasOwnProperty.call(COUNTERS, a) && COUNTERS[a].includes(b);
// Class-vs-class lane edges: ARCH[x][y] is x's edge over y.
const ARCH = { A: { M: 1.5, K: 1.5, E: 1 }, T: { A: 1.5 }, F: { A: 0.8, T: 1 }, E: { A: 0.5 }, M: { F: 0.6, T: 0.5 }, K: { T: 0.8 } };
const ARCH_WHY = {
  "A>M": "assassin dives the immobile mage", "A>K": "assassin deletes the marksman", "A>E": "assassin bursts the enchanter",
  "T>A": "tank soaks the assassin's burst", "F>A": "fighter outlasts the assassin", "F>T": "fighter shreds the tank",
  "E>A": "enchanter peels the dive", "M>F": "mage kites the fighter", "M>T": "mage pokes the tank down", "K>T": "marksman melts the tank",
};

// Positive score = a is favoured over b. `role` set = same-lane matchup, null = cross-map interaction.
function matchup(aId, bId, role) {
  const a = CH[aId], b = CH[bId];
  let s = 0;
  const why = [];
  if (hasCounter(aId, bId)) { s += role ? 2.5 : 0.6; why.push({ s: 1, t: `${a.name} hard-counters ${b.name}` }); }
  if (hasCounter(bId, aId)) { s -= role ? 2.5 : 0.6; why.push({ s: -1, t: `${b.name} hard-counters ${a.name}` }); }
  if (role) {
    const x = (ARCH[a.cls] || {})[b.cls] || 0, y = (ARCH[b.cls] || {})[a.cls] || 0;
    if (x) { s += x; why.push({ s: 1, t: cap(ARCH_WHY[a.cls + ">" + b.cls]) }); }
    if (y) { s -= y; why.push({ s: -1, t: cap(ARCH_WHY[b.cls + ">" + a.cls]) }); }
    if ((role === "Top" || role === "Mid") && a.range !== b.range) {
      const d = a.range === "r" ? 0.8 : -0.8;
      s += d;
      why.push({ s: Math.sign(d), t: `${d > 0 ? a.name : b.name} bullies the melee laner from range` });
    }
  }
  return { s, why };
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ""; }

function laneMatchups(A, B) {
  return ROLES.map(r => {
    const m = matchup(A.roles[r], B.roles[r], r);
    const top = m.why.slice().sort((x, y) => Math.abs(y.s) - Math.abs(x.s))[0];
    return { role: r, adv: Math.round(m.s * 10) / 10, why: m.s === 0 ? "Even matchup" : (m.why.find(w => Math.sign(w.s) === Math.sign(m.s)) || top).t };
  });
}
function teamCounters(A, B) {
  let s = 0;
  for (const ra of ROLES) for (const rb of ROLES) if (ra !== rb) s += matchup(A.roles[ra], B.roles[rb], null).s;
  return s;
}

// ---------- Team analysis ----------
function teamProfile(roles) {
  let early = 0, late = 0, tf = 0, ad = 0, ap = 0, front = 0, cc = 0;
  const off = [];
  for (const r of ROLES) {
    const c = CH[roles[r]], m = fitMult(c, r);
    if (m < 0.9) off.push({ name: c.name, role: r });
    early += c.early * m; late += c.late * m; tf += c.tf * m;
    front += c.front; cc += c.cc;
    c.dmg === "AD" ? ad++ : ap++;
  }
  let comp = 0;
  const notes = [];
  if (!ad || !ap) { comp -= 4; notes.push({ bad: 1, t: `All ${ap ? "AP" : "AD"} damage, so it's easy to itemise against` }); }
  else if (Math.min(ad, ap) >= 2) { comp += 2; notes.push({ t: "Balanced AD/AP damage" }); }
  if (front < 12) { comp -= 3; notes.push({ bad: 1, t: "Paper-thin frontline" }); }
  else if (front >= 20) { comp += 2; notes.push({ t: "Rock-solid frontline" }); }
  if (cc >= 36) { comp += 2; notes.push({ t: "Loaded with crowd control" }); }
  else if (cc < 24) { comp -= 2; notes.push({ bad: 1, t: "Very little crowd control" }); }
  if (early - late >= 6) notes.push({ t: "Wants to end early" });
  else if (late - early >= 6) notes.push({ t: "Scales hard into the late game" });
  off.forEach(o => notes.push({ bad: 1, t: `${o.name} is off-role in ${ROLE_LABEL[o.role]}` }));
  const power = early * 0.3 + late * 0.4 + tf * 0.4 + comp * 1.5;
  return { early, late, tf, ad, ap, front, cc, comp, notes, off, power };
}
const gradeOf = p => (p >= 46 ? "S" : p >= 43 ? "A" : p >= 40 ? "B" : p >= 36.5 ? "C" : "D");

function analyse(A, B) {
  const pa = teamProfile(A.roles), pb = teamProfile(B.roles);
  const lanes = laneMatchups(A, B);
  const laneSum = lanes.reduce((s, l) => s + l.adv, 0);
  const tc = teamCounters(A, B);
  const logit = (pa.power - pb.power) / 5 + laneSum * 0.12 + tc * 0.25;
  const won = lanes.filter(l => l.adv >= 1).length, lost = lanes.filter(l => l.adv <= -1).length;
  if (won >= 3) pa.notes.unshift({ t: `Favoured in ${won} of 5 lane matchups` });
  if (lost >= 3) pb.notes.unshift({ t: `Favoured in ${lost} of 5 lane matchups` });
  if (tc >= 1.2) pa.notes.push({ t: "Counter-picks the enemy comp" });
  if (tc <= -1.2) pb.notes.push({ t: "Counter-picks the enemy comp" });
  return { pa, pb, lanes, laneSum, tc, pre: sig(logit) };
}

// ---------- Match simulation (the "AI analyst") ----------
const LANE = { Top: "top lane", Jungle: "the jungle", Mid: "mid lane", ADC: "bot lane", Support: "bot lane" };
const DRAGONS = ["Infernal", "Mountain", "Ocean", "Cloud", "Hextech", "Chemtech"];
const SPOTS = ["the dragon pit", "Baron pit", "mid lane", "the blue-side jungle", "the red-side jungle", "top-side river", "bot-side river"];
const CC_WORDS = ["hook", "stun", "knock-up", "root", "charm", "engage"];
const KILLW = { Top: 2, Jungle: 2, Mid: 3, ADC: 3.5, Support: 0.8 };
const MULTI = { 3: "picks up a TRIPLE KILL", 4: "rips through them for a QUADRA KILL", 5: "gets the PENTAKILL" };
const COUNTER_LINES = [
  (k, v, l) => `Textbook counter-pick. ${k} bullies ${v} off the wave and takes the kill in ${l}.`,
  (k, v) => `${v} never wanted this matchup. ${k} punishes every last-hit attempt and gets the kill.`,
  (k, v, l) => `The draft pays off: ${k} wins every trade against ${v} in ${l}, then finishes the job.`,
];
const SOLO = [
  (k, v, l) => `${k} outplays ${v} in a 1v1 in ${l}. Solo kill!`,
  (k, v) => `${k} hits level 6 first and all-ins ${v}.`,
  (k, v, l) => `${v} overextends in ${l} and ${k} punishes it hard.`,
  (k, v, l) => `${k} dodges everything and takes ${v} down in ${l}.`,
];

// A = blue side, B = red side. Text uses *Champion* and §a/§b markers that the UI turns into styled names.
function simulate(A, B) {
  const an = analyse(A, B), { pa, pb } = an;
  const L0 = Math.log(an.pre / (1 - an.pre));
  const lane = Object.fromEntries(an.lanes.map(l => [l.role, l.adv]));
  const ev = [];
  let ka = 0, kb = 0, gold = 0;
  const ck = {};
  const T = s => (s === "a" ? A : B), O = s => (s === "a" ? "b" : "a"), sg = s => (s === "a" ? 1 : -1);
  const C = (s, r) => `*${CH[T(s).roles[r]].name}*`;
  const noise = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
  const side = adv => (Math.random() < sig(adv) ? "a" : "b");
  const killer = s => wpick(ROLES.map(r => [r, KILLW[r] * (0.6 + CH[T(s).roles[r]].late / 10)]));
  let clock = 0;
  const add = (time, s, text, kills = [], obj = 0) => {
    time = clock = Math.max(time, clock + 25 + ri(40));
    for (const k of kills) { k[0] === "a" ? ka++ : kb++; ck[k] = (ck[k] || 0) + 1; gold += sg(k[0]) * 300; }
    if (obj) gold += sg(s) * obj;
    const wp = Math.min(0.97, Math.max(0.03, sig(L0 * 0.7 + gold / 2600)));
    ev.push({ time, side: s, text, k: kills, ka, kb, gold: Math.round(gold), wp: Math.round(wp * 1000) / 1000 });
  };

  // Early game: lane matchups decide who gets ahead.
  const dE = (pa.early - pb.early) / 5;
  let fb = false, s;
  if (Math.random() < 0.18) {
    s = side(dE + noise() * 0.5);
    const k = rand(["Jungle", "Support", "Mid"]);
    add(80 + ri(40), s, `Level 1 invade! ${C(s, k)} catches ${C(O(s), rand(["Jungle", "Support", "ADC"]))} in the jungle. First Blood to §${s}.`, [s + ":" + k]);
    fb = true;
  }
  {
    const l = rand(["Top", "Mid", "ADC"]);
    s = side(dE * 0.6 + lane[l] * 0.35 + lane.Jungle * 0.3 + noise() * 0.6);
    const k = Math.random() < 0.55 ? "Jungle" : l;
    add(210 + ri(200), s, `${C(s, "Jungle")} ganks ${LANE[l]}${fb ? "" : " for First Blood"}! ${k === "Jungle" ? C(s, "Jungle") + " takes the kill on" : C(s, l) + " finishes off"} ${C(O(s), l)}.`, [s + ":" + k]);
  }
  s = side(dE * 0.8 + lane.Jungle * 0.25 + gold / 3000 + noise() * 0.5);
  add(330 + ri(60), s, `The first ${rand(DRAGONS)} Drake goes to §${s}.`, [], 250);
  const n = 1 + ri(2), used = [];
  for (let i = 0; i < n; i++) {
    const l = wpick([["Top", 1 + Math.abs(lane.Top)], ["Mid", 1 + Math.abs(lane.Mid)], ["ADC", 1 + Math.abs(lane.ADC + lane.Support)]].filter(x => !used.includes(x[0])));
    used.push(l);
    const adv = l === "ADC" ? (lane.ADC + lane.Support) * 0.5 : lane[l];
    s = side(dE * 0.5 + adv * 0.6 + gold / 3000 + noise() * 0.6);
    const t = 480 + i * 150 + ri(90);
    const counter = sg(s) * adv >= 2;
    if (l === "ADC") {
      const two = Math.random() < 0.45, kills = [s + ":ADC"];
      if (two) kills.push(s + ":" + (Math.random() < 0.5 ? "ADC" : "Support"));
      add(t, s, counter
        ? `The bot lane matchup is a nightmare for §${O(s)}. ${C(s, "ADC")} and ${C(s, "Support")} ${two ? "take a double kill" : "zone them off the wave and pick up a kill"}.`
        : `Bot lane 2v2: ${C(s, "ADC")} and ${C(s, "Support")} ${two ? "take a double kill" : "win the trade and pick up a kill"}!`, kills);
    } else {
      add(t, s, counter
        ? rand(COUNTER_LINES)(C(s, l), C(O(s), l), LANE[l])
        : rand(SOLO)(C(s, l), C(O(s), l), LANE[l]), [s + ":" + l]);
    }
  }
  s = side(dE * 0.6 + gold / 2500 + noise() * 0.5);
  add(840 + ri(60), s, `Rift Herald for §${s}, smashed into ${rand(["top", "mid", "bot"])} lane. First turret falls.`, [], 650);

  // Mid game: teamfighting, comp and counters.
  const dM = ((pa.early + pa.late) - (pb.early + pb.late)) / 10 + (pa.tf - pb.tf) / 5 + (pa.comp - pb.comp) / 3 + an.tc * 0.3;
  s = side(dM + gold / 2600 + noise());
  {
    const wk = 2 + ri(3), lk = ri(Math.min(3, wk));
    const kills = [...Array(wk)].map(() => s + ":" + killer(s)).concat([...Array(lk)].map(() => O(s) + ":" + killer(O(s))));
    add(1020 + ri(240), s, `Teamfight in ${rand(SPOTS)}! It goes ${wk} for ${lk} in favour of §${s}${wk === 5 ? ". ACE!" : "."}`, kills);
  }
  s = side(dM + gold / 2600 + noise());
  {
    const cr = ROLES.slice().sort((x, y) => CH[T(s).roles[y]].cc - CH[T(s).roles[x]].cc)[0];
    add(1320 + ri(150), s, `${C(s, cr)} lands a huge ${rand(CC_WORDS)} on ${C(O(s), rand(["Mid", "ADC", "Support", "Jungle"]))}. Caught and deleted.`, [s + ":" + killer(s)]);
  }
  s = side(dM * 0.7 + gold / 2400 + noise() * 0.6);
  add(1500 + ri(120), s, `The inner ${rand(["top", "mid", "bot"])} turret falls to §${s}.`, [], 550);
  if (Math.random() < 0.6) { s = side(dM + gold / 2600 + noise()); add(1640 + ri(120), s, `${rand(DRAGONS)} Dragon Soul for §${s}!`, [], 500); }

  // Late game: decides the winner.
  const dF = L0 + (pa.late - pb.late) / 8 + gold / 2400 + noise();
  const w = side(dF), l = O(w);
  const bs = Math.random() < 0.75 ? w : l;
  if (Math.random() < 0.1) add(1800 + ri(150), O(bs), `${C(O(bs), "Jungle")} STEALS BARON out from under §${bs}!`, [], 1200);
  else {
    const wk = 1 + ri(2);
    add(1800 + ri(150), bs, `The fight at Baron goes ${wk} for 0 to §${bs}. Baron Nashor secured.`, [...Array(wk)].map(() => bs + ":" + killer(bs)), 1500);
  }
  if (sg(w) * gold < -2500) add(2050 + ri(80), w, `A face-check into an unwarded bush costs §${l} their ${(Math.abs(gold) / 1000).toFixed(1)}k gold lead. Massive throw!`, [w + ":" + killer(w), w + ":" + killer(w)]);
  const carry = wpick(["Top", "Mid", "ADC", "Jungle"].map(r => [r, CH[T(w).roles[r]].late + CH[T(w).roles[r]].tf]));
  const ck_ = 3 + (Math.random() < 0.35 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0);
  const fk = [...Array(ck_)].map(() => w + ":" + carry);
  for (let i = ck_; i < 5; i++) fk.push(w + ":" + wpick(ROLES.filter(r => r !== carry).map(r => [r, KILLW[r]])));
  for (let i = ri(3); i > 0; i--) fk.push(l + ":" + killer(l));
  const tEnd = 2150 + ri(500);
  add(tEnd, w, `Final teamfight! ${C(w, carry)} ${MULTI[ck_]}${ck_ < 5 ? ` and the rest is cleanup for §${w}` : ""}.`, fk);
  add(tEnd + 40 + ri(30), w, `The Nexus falls. GG, and victory to §${w}!`);
  ev[ev.length - 1].wp = w === "a" ? 1 : 0;

  const mvpRole = ROLES.slice().sort((x, y) => (ck[w + ":" + y] || 0) - (ck[w + ":" + x] || 0))[0];
  return {
    pre: Math.round(an.pre * 1000) / 1000, winner: w, events: ev, lanes: an.lanes,
    mvp: { side: w, role: mvpRole, kills: ck[w + ":" + mvpRole] || 0 },
    notes: { a: pa.notes, b: pb.notes }, grade: { a: gradeOf(pa.power), b: gradeOf(pb.power) },
  };
}

// ---------- Bots ----------
function botDraft(diff) {
  const picks = [];
  let rerolls = diff === "hard" ? 2 : 0;
  while (picks.length < 5) {
    const opts = rollOptions(picks), need = neededRoles(picks), cs = picks.map(x => CH[x]);
    const score = id => {
      const c = CH[id];
      if (diff === "easy") return Math.random();
      let s = champValue(c) + (c.roles.some(r => need.includes(r)) ? 4 : 0);
      if (diff === "hard") {
        const ad = cs.filter(x => x.dmg === "AD").length, ap = cs.length - ad;
        if (c.dmg === "AP" && ap < 2 && ad >= 2) s += 1.5;
        if (c.dmg === "AD" && ad < 2 && ap >= 2) s += 1.5;
        if (cs.reduce((a, x) => a + x.front, 0) < 10 && c.front >= 7) s += 1.5;
        s += Math.random() * 0.5;
      } else s += Math.random() * 3;
      return s;
    };
    const best = opts.map(id => [score(id), id]).sort((a, b) => b[0] - a[0])[0][1];
    if (diff === "hard" && rerolls > 0 && champValue(CH[best]) < 6.5) { rerolls--; continue; }
    picks.push(best);
  }
  return { picks, roles: bestRoles(picks) };
}
function botChoosePick(G, p, diff) {
  const opp = G.picks[1 - p], need = neededRoles(G.picks[p]);
  const w = diff === "hard" ? 1 : diff === "easy" ? 0 : 0.5;
  const score = id => {
    const c = CH[id];
    if (diff === "easy") return Math.random() + (c.roles.some(r => need.includes(r)) ? 0.5 : 0);
    let s = champValue(c) + (c.roles.some(r => need.includes(r)) ? 4 : 0);
    for (const o of opp) s += w * ((hasCounter(id, o) ? 1.5 : 0) - (hasCounter(o, id) ? 1.5 : 0));
    return s + Math.random() * (diff === "hard" ? 0.5 : 2.5);
  };
  return G.options.map((id, i) => [score(id), i]).sort((a, b) => b[0] - a[0])[0][1];
}
function botRoles(G, p, diff) {
  if (diff !== "hard") return bestRoles(G.picks[p]);
  const guess = bestRoles(G.picks[1 - p]);
  let best = null, bs = -1e9;
  for (const perm of PERMS) {
    const roles = {};
    let s = 0;
    G.picks[p].forEach((id, i) => { roles[perm[i]] = id; const c = CH[id]; s += c.roles[0] === perm[i] ? 3 : c.roles.includes(perm[i]) ? 2 : -2; });
    for (const r of ROLES) s += matchup(roles[r], guess[r], r).s * 0.5;
    if (s > bs) { bs = s; best = roles; }
  }
  return best;
}

// ---------- Tournament (solo vs bots) ----------
function newTournament(entry, size, diff) {
  const names = shuffle(BOT_NAMES);
  const teams = [{ name: entry.name, human: true, picks: entry.picks, roles: entry.roles }];
  while (teams.length < size) teams.push({ name: names.pop(), human: false, ...botDraft(diff) });
  const order = shuffle(teams.map((_, i) => i));
  const r0 = [];
  for (let i = 0; i < size; i += 2) r0.push({ a: order[i], b: order[i + 1], w: null, res: null });
  return { size, diff, teams, rounds: [r0], played: null, champion: null };
}
function playRound(t) {
  const idx = t.rounds.length - 1, R = t.rounds[idx];
  for (const m of R) { m.res = simulate(t.teams[m.a], t.teams[m.b]); m.w = m.res.winner === "a" ? m.a : m.b; }
  t.played = idx;
  if (R.length === 1) t.champion = R[0].w;
  else {
    const next = [];
    for (let i = 0; i < R.length; i += 2) next.push({ a: R[i].w, b: R[i + 1].w, w: null, res: null });
    t.rounds.push(next);
  }
}
function roundName(t, r) {
  const n = t.size / 2 ** (r + 1);
  return n === 1 ? "Grand Final" : n === 2 ? "Semifinals" : n === 4 ? "Quarterfinals" : "Round of 16";
}

// ---------- Best-of-3 series (1v1, alternating picks) ----------
// Pick order follows pro draft: B R R B B R R B B R. No champion is ever offered twice within a game.
const PICK_ORDER = ["B", "R", "R", "B", "B", "R", "R", "B", "B", "R"];
const curGame = S => S.games[S.games.length - 1];
const pickerOf = G => (G.turn >= 10 ? -1 : PICK_ORDER[G.turn] === "B" ? G.blue : 1 - G.blue);

function newSeries(players, opts = {}) {
  const S = { id: Math.random().toString(36).slice(2, 9), players, score: [0, 0], games: [], winner: null,
    timer: opts.timer || 0, diff: opts.diff || "normal", phase: "draft", ready: [false, false], deadline: 0 };
  startGame(S);
  return S;
}
function startGame(S) {
  const n = S.games.length;
  // Game 1: host on blue. Game 2: swap. Game 3: loser of game 2 gets blue side (first pick).
  const blue = n === 0 ? 0 : n === 1 ? 1 : S.games[1].winner === 0 ? 1 : 0;
  S.games.push({ blue, picks: [[], []], roles: [null, null], shown: [], turn: 0, options: [], rerolls: [1, 1], res: null, winner: null });
  S.phase = "draft";
  S.ready = [false, false];
  rollTurn(S);
}
function rollTurn(S) {
  const G = curGame(S), seen = new Set(G.shown);
  G.options = makeOptions(CHAMPS.filter(c => !seen.has(c.id)), G.picks[pickerOf(G)]);
  G.shown.push(...G.options);
}
function seriesPick(S, p, i) {
  const G = curGame(S);
  if (S.phase !== "draft" || pickerOf(G) !== p || !G.options[i]) return false;
  G.picks[p].push(G.options[i]);
  G.turn++;
  if (G.turn >= 10) { G.options = []; S.phase = "roles"; } else rollTurn(S);
  return true;
}
function seriesReroll(S, p) {
  const G = curGame(S);
  if (S.phase !== "draft" || pickerOf(G) !== p || G.rerolls[p] < 1) return false;
  G.rerolls[p]--;
  rollTurn(S);
  return true;
}
function seriesRoles(S, p, roles) {
  const G = curGame(S);
  if (S.phase !== "roles" || G.roles[p]) return false;
  const v = validRoles(G.picks[p], roles);
  if (!v) return false;
  G.roles[p] = v;
  if (G.roles[0] && G.roles[1]) resolveGame(S);
  return true;
}
function resolveGame(S) {
  const G = curGame(S), bp = G.blue, rp = 1 - bp;
  G.res = simulate({ name: S.players[bp].name, roles: G.roles[bp] }, { name: S.players[rp].name, roles: G.roles[rp] });
  G.winner = G.res.winner === "a" ? bp : rp;
  S.score[G.winner]++;
  if (S.score[G.winner] >= 2) S.winner = G.winner;
  S.phase = "result";
  S.ready = [false, false];
}
function seriesReady(S, p) {
  if (S.phase !== "result" || S.winner != null || S.ready[p]) return false;
  S.ready[p] = true;
  if (S.ready[0] && S.ready[1]) startGame(S);
  return true;
}
// What player p is allowed to see: no opponent options, no hidden opponent lanes, no shown-pool.
function seriesView(S, p) {
  const v = JSON.parse(JSON.stringify(S));
  v.games.forEach(g => delete g.shown);
  const G = v.games[v.games.length - 1];
  if (pickerOf(G) !== p) G.options = [];
  if (!G.res) G.roles = G.roles.map((r, i) => (i === p ? r : r ? "locked" : null));
  return v;
}
