// @ts-nocheck
/* Tribute & Treaty screens, carried over from the single-file prototype (checkpoint option 1).
   Rendering is unchanged string templates; all persistence now goes through `api` (server functions).
   Phases 2–3 will replace these screens with React components. */
import QRCode from "qrcode";
import { COURSE_SOURCES, ERAS, KINDS, ORDERS, POLICY, blankDesign, courseOf, sampleDesign, srcFromCourse, uid } from "./data";
import { openingOf, startState, blankOpening, CLAIMS, CLAIM_LABEL, claimLabel, AUDIT_MIN, auditOk, cleanAudit, EVIDENCE_LABEL, evidenceStatus, openReasonList, GENRES, GENRE_LABEL, PASS_WHY_MIN, passWhyOk, QUOTE_MAX, READING_MIN, allowedReadings, countsAsPrimary, genreOf, ballotOf, evidenceMissing, canTake, checks, chronology, eraRange, historyRows, isCourse, missingReadings, newState, num, readingOf, resolveMove, roundSummary, eventForRound, sourceOutOfEra, upgradeDesign, yearFor } from "./logic";
import { moveFromThinking, npcBallot, ruleThinking } from "./npc";
import { TA_TAGS, facilitatorPrompts, pauseAfter, talkItThrough } from "./debrief";
import { manualHtml } from "./manual";
import { NOT_GRADED, recordFileName, transcriptCsv, transcriptMarkdown } from "./record";
import { citableSources, glossaryFor, holderOf, realVsChosen, roundInfo, roundSourceIds, seatChanges, seatLabel } from "./rounds";
import { todayDesign } from "./today";
import type { Api } from "./api";

const COLORS = ["--a1","--a2","--a3","--a4","--a5","--a6","--a7","--a8"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const initials = n => String(n||"?").replace(/\(.*?\)/g,"").split(/\s+/).filter(w=>w && /[A-Za-zÀ-ỹ]/.test(w[0]) && !/^(of|the|at|and)$/i.test(w)).slice(0,2).map(w=>w[0].toUpperCase()).join("") || "?";
const fmtYears = (a,b) => { const f = y => y<0 ? (-y)+" BCE" : String(y); return a===b ? f(a) : f(a)+"–"+f(b); };
const STATUS_LABEL = {pending:"Awaiting instructor review", approved:"Approved for class", changes:"Changes requested", draft:"Draft", sandbox:"Sandbox example"};
const STEPS = ["World and era","Map","Actors","Resources and victory","Sources","Diplomatic actions","Historical events","Anachronism traps","Review and submit"];

export function mountApp(root: HTMLElement, api: Api): () => void {
  const $ = s => root.querySelector(s);
  /* ---------- state ---------- */
  let drafts = store.get("tt.drafts", null);
  if(!Array.isArray(drafts) || !drafts.length) drafts = [sampleDesign(), todayDesign()];
  drafts.forEach(d=>{
    if(d.sample){ d.sandbox = true; delete d.sample; }
    upgradeDesign(d);
    d.sources.forEach(s=>{ if(s.year==null) s.year = ""; if(s.where==null) s.where = s.key ? "Course reader / assigned text" : ""; if(s.fit==null) s.fit = ""; if(s.key && courseOf(s.key)){ const c = courseOf(s.key); s.type = c.type; s.citation = c.citation; } });
  });
  { const fresh = sampleDesign(); const i = drafts.findIndex(d=>d.gid===fresh.gid); if(i>=0) drafts[i] = fresh; }
  { const fresh = todayDesign(); const i = drafts.findIndex(d=>d.gid===fresh.gid); if(i>=0) drafts[i] = fresh; else drafts.splice(Math.min(1, drafts.length), 0, fresh); }
  let curId = store.get("tt.cur", drafts[0].gid);
  if(!drafts.find(d=>d.gid===curId)) curId = drafts[0].gid;
  let step = store.get("tt.step", 0);
  let mapTool = {sel:null};
  let lib = {games:[], loaded:false, err:""};
  let subs = {};                       // submission id -> {status, note, feedback}
  let instr = {passcode: sessionStore("tt.pass"), items:null, err:"", open:false};
  let nick = store.get("tt.nick", "");
  let play = null;                     // local pass-and-play or live host
  let join = null;                     // phone player
  let unsubs = [];
  let disposed = false;
  { const saved = store.get("tt.local", null); if(saved && saved.mode==="local" && saved.d){ upgradeDesign(saved.d); if(!Array.isArray(saved.history)) saved.history = []; play = saved; } }
  const cur = () => drafts.find(d=>d.gid===curId);
  let saveT;
  function saveDrafts(){ clearTimeout(saveT); saveT = setTimeout(()=>{ store.set("tt.drafts", drafts); store.set("tt.cur", curId); }, 250); }
  function saveLocal(){ if(play && play.mode==="local") store.set("tt.local", {...play, voices:{}}); }
  function sessionStore(k){ try{ return sessionStorage.getItem(k) || ""; }catch(e){ return ""; } }
  function setPath(obj, path, val){ const ks = path.split("."); let o = obj; for(let i=0;i<ks.length-1;i++){ if(o[ks[i]]==null && ks[i]==="readings") o[ks[i]] = {}; o = o[ks[i]]; if(o==null) return; } o[ks[ks.length-1]] = val; }
  function getPath(obj, path){ return path.split(".").reduce((o,k)=>o==null?o:o[k], obj); }
  const resIdx = (d,k) => Math.max(0, d.resources.findIndex(r=>r.key===k)) % 4;
  const resName = (d,k) => (d.resources.find(r=>r.key===k)||{}).name||k;
  const actorById = (d,id) => d.actors.find(a=>a.id===id);
  const colorOf = (d,id) => COLORS[Math.max(0,d.actors.findIndex(a=>a.id===id))%8];
  const shortCite = s => { const c = (s.key && courseOf(s.key) ? (courseOf(s.key).starred?"*":"") : "") + (s.citation||"Untitled"); return c.length>80 ? c.slice(0,78)+"…" : c; };
  const placeName = (d,t) => { if(!t) return ""; const p = d.map.places.find(p=>p.c===t[0]&&p.r===t[1]); return p?p.name:""; };
  const joinUrl = code => location.origin + "/#join-" + code;

  /* ---------- data loading ---------- */
  async function loadLibrary(){
    const r = await api.listLibrary();
    if(r.ok){ lib.games = r.games; lib.err = ""; } else lib.err = r.error;
    lib.loaded = true; softRender();
  }
  async function loadSubs(){
    const items = drafts.filter(d=>d.submission).map(d=>({id:d.submission.id, editKey:d.submission.editKey}));
    if(!items.length) return;
    const r = await api.mySubmissions({items});
    if(r.ok){ subs = {}; r.items.forEach(it=>{ subs[it.id] = it; }); softRender(); }
  }
  function softRender(){
    if(disposed) return;
    const a = document.activeElement;
    if(a && root.contains(a) && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName)) return;
    render();
  }

  /* ---------- routing ---------- */
  function view(){
    const h = location.hash.slice(1);
    if(/^join(-[A-Z0-9]{0,6})?$/i.test(h)) return "join";
    return ["library","design","play"].includes(h) ? h : "library";
  }
  let stageOn = false;
  function render(){
    if(disposed) return;
    const v = view();
    document.body.classList.toggle("phone", v==="join");
    stageOn = false;
    const body = v==="library"?renderLibrary():v==="design"?renderDesign():v==="play"?renderPlay():renderJoin();
    document.body.classList.toggle("stage", stageOn);
    root.innerHTML = header(v) + `<main class="wrap" id="app">${body}</main>`;
    if(v==="play") afterPlayRender();
  }
  function header(v){
    return `<header class="top"><div class="wrap">
      <div class="brand"><b>The Diplomatic Sandbox</b><span>EALC 1711 · Game workshop</span></div>
      <nav class="tabs" aria-label="Views">${["library","design","play"].map(x=>`<a href="#${x}" ${x===v?'aria-current="page"':""}>${x[0].toUpperCase()+x.slice(1)}</a>`).join("")}</nav>
    </div></header>`;
  }

  /* ---------- LIBRARY ---------- */
  function draftStatus(d){
    if(d.sandbox) return "sandbox";
    if(d.submission && subs[d.submission.id]) return subs[d.submission.id].status;
    return d.submission ? "pending" : "draft";
  }
  function gameCard(d, opts){
    const c = checks(d), done = c.filter(x=>x.ok).length;
    const st = opts.status || draftStatus(d);
    const ref = opts.libId ? `data-lib="${esc(opts.libId)}"` : `data-gid="${esc(d.gid)}"`;
    return `<article class="frame gcard">
      <div class="band"><span class="eyebrow">${esc(d.era.start)}${d.era.end!==""?"–"+esc(d.era.end):""}</span><span class="status ${st}">${esc(STATUS_LABEL[st])}</span></div>
      <div class="body">
        <h3>${esc(d.title||"Untitled world")}</h3>
        ${d.subtitle?`<p class="small muted">${esc(d.subtitle)}</p>`:""}
        <div class="meta"><span class="pill info">${d.actors.filter(a=>a.playable).length} courts</span><span class="pill info">${d.actions.length} actions</span><span class="pill ${done===c.length?"ok":"warn"}">${done}/${c.length} checks</span></div>
        ${opts.author?`<p class="small muted">Designed by ${esc(opts.author)}</p>`:""}
        <div class="actions">
          <button class="primary" data-act="host" ${ref}>${opts.libId?"Host live game":"Host live test"}</button>
          <button data-act="local" ${ref}>Pass and play</button>
          ${opts.libId?`<button class="ghost" data-act="remix" data-lib="${esc(opts.libId)}">Remix</button>`:`<button class="ghost" data-act="open-draft" data-gid="${esc(d.gid)}">Edit</button>`}
        </div>
      </div></article>`;
  }
  function resumeBanner(){
    const host = store.get("tt.host", null);
    if(play && play.mode==="local" && play.phase==="play" && play.st && !play.st.over)
      return `<div class="resume"><span><b>Pass-and-play game in progress:</b> ${esc(play.d.title)}, round ${play.st.round}</span><a href="#play"><button class="primary" tabindex="-1">Resume</button></a></div>`;
    if(host && !(play && play.mode==="host"))
      return `<div class="resume"><span><b>Your live game ${esc(host.code)} may still be open.</b></span><button class="primary" data-act="resume">Return to it</button></div>`;
    return "";
  }
  /* Which manual sections are unfolded, so a re-render (the library loading) doesn't snap them shut. */
  let manualOpen = [];
  function renderLibrary(){
    if(!lib.loaded){ lib.loaded = true; loadLibrary(); loadSubs(); }
    return resumeBanner() + `
    <section class="hero">
      <div>
        <div class="ribbon">East Asian Diplomacy · HIST 1550 / EALC 1711</div>
        <h1 style="margin-top:16px">Build the diplomatic world of an era. Your classmates rule it from their phones.</h1>
        <p class="lede">Each game is a hex-board strategy game whose rules come from the readings: who could speak to whom, what a mission meant, and why two courts could read the same embassy in opposite ways. No sign-in needed: just a link, a code and a nickname.</p>
        <div class="row" style="margin-top:20px"><a href="#play"><button class="primary" tabindex="-1" style="font-size:1rem;padding:14px 22px">Host a game</button></a><a href="#join"><button tabindex="-1" style="font-size:1rem;padding:14px 22px">Join a game</button></a><button class="ghost" data-act="manual-go" style="font-size:1rem;padding:14px 22px">Read the instruction manual</button></div>
        <ol>
          <li>Design: pick an era, its actors, and diplomatic actions tied to sources, with your reasoning for each rule.</li>
          <li>Submit under your nickname: games that pass every check go to the instructor for review.</li>
          <li>Host: put the board on the projector. Classmates scan the QR code and join a court as a team.</li>
          <li>Play: each team's phones show its choices only on its turn, and every vote needs a reason.</li>
        </ol>
      </div>
      <div class="frame stack">
        <div class="eyebrow">Joining a game?</div>
        <p>Scan the QR code on the main screen, or type the six-character code.</p>
        <form class="joinbox" id="joinform"><input id="joincode" type="text" maxlength="6" aria-label="Game code" placeholder="CODE" autocomplete="off"><button class="primary" type="submit">Join</button></form>
        <span class="small" id="joinmsg" style="color:var(--danger)"></span>
        <hr style="border:0;border-top:1.5px solid var(--brass-dim);width:100%">
        <div class="eyebrow">Designing a game?</div>
        <div class="row"><button class="primary" data-act="new-draft">New world</button><button data-act="open-sample">Open the sample</button></div>
        <p class="small">New to the course? <button class="ghost" data-act="open-today">Try the contemporary demo</button> <span class="muted">(2000–2026, built from the news)</span></p>
        <p class="small muted">Course AI policy: you may use AI to gather and organize information and to brainstorm, but not to produce text you submit. The rules and card text in your game must be yours. If in doubt, ask Prof. Dickinson or your TA.</p>
      </div>
    </section>
    ${manualHtml(manualOpen)}
    <section style="margin-top:36px">
      <div class="secthead"><h2>Class library</h2><span class="small muted">${lib.err?esc(lib.err):`${lib.games.length} approved`}</span></div>
      ${lib.games.length ? `<div class="cards">${lib.games.map(g=>gameCard(g.design,{libId:g.id, author:g.author, status:"approved"})).join("")}</div>`
        : `<div class="empty">No approved games yet. Finished designs appear here after instructor review.</div>`}
    </section>
    <section style="margin-top:36px">
      <div class="secthead"><h2>My drafts</h2><span class="small muted">Kept in this browser; submitted copies go to your instructor</span></div>
      <div class="cards">${drafts.map(d=>gameCard(d,{})).join("")}</div>
    </section>
    ${renderInstructor()}`;
  }
  function renderInstructor(){
    if(!instr.open) return `<section style="margin-top:36px"><button class="ghost" data-act="instr-open">Instructor review</button></section>`;
    if(!instr.items) return `<section style="margin-top:36px" class="frame stack"><div class="eyebrow">Instructor review</div>
      <form class="row" id="instrform"><label class="f" for="passcode" style="flex:1"><span>Instructor passcode</span><input id="passcode" type="password" autocomplete="off" value=""></label><button class="primary" type="submit">Open the queue</button></form>
      ${instr.err?`<p class="small" style="color:var(--danger)">${esc(instr.err)}</p>`:""}</section>`;
    const pending = instr.items.filter(i=>i.status==="pending"), other = instr.items.filter(i=>i.status!=="pending");
    return `<section style="margin-top:36px"><div class="secthead"><h2>Awaiting your review</h2><span class="row small muted">${pending.length} submitted <button class="ghost" data-act="instr-reload">Reload</button><button class="ghost" data-act="instr-close">Close</button></span></div>
      ${instr.err?`<p class="small" style="color:var(--danger)">${esc(instr.err)}</p>`:""}
      <div class="stack">${pending.length?pending.map(reviewCard).join(""):`<div class="empty">Nothing waiting.</div>`}</div>
      ${other.length?`<div class="secthead" style="margin-top:28px"><h2>Reviewed</h2></div><div class="stack">${other.map(i=>`<div class="plain row" style="justify-content:space-between"><span><span class="status ${i.status}">${esc(STATUS_LABEL[i.status])}</span> <b>${esc(i.title)}</b> <span class="muted small">by ${esc(i.author_nick)}</span></span>${i.review_note?`<span class="small muted">${esc(i.review_note)}</span>`:""}</div>`).join("")}</div>`:""}</section>`;
  }
  function reviewCard(item){
    const d = item.design, warn = chronology(d), c = checks(d).filter(x=>!x.ok);
    const customs = d.sources.filter(s=>!isCourse(s)), outEra = d.sources.filter(s=>sourceOutOfEra(d,s));
    const id = esc(item.id);
    return `<article class="frame review">
      <div class="meta"><span class="status pending">Awaiting review</span><h3 style="margin-right:auto">${esc(d.title)}</h3><span class="small muted">by ${esc(item.author_nick)} · ${esc(d.era.start)}–${esc(d.era.end)}</span></div>
      ${c.length?`<div class="gatebox"><b>Fails ${c.length} automatic check${c.length>1?"s":""}</b><ul class="checklist">${c.map(x=>`<li class="bad"><span class="mk">✕</span>${esc(x.t)}</li>`).join("")}</ul></div>`:`<div class="gatebox ok small">Passes every automatic check. The checks look for completeness, not accuracy.</div>`}
      <div class="grid2">
        <div><div class="eyebrow">Sources to verify</div>
          ${customs.length?`<ul class="warnlist">${customs.map(s=>`<li><b>Not a course reading · ${esc(s.type)}</b>${esc(s.citation)} (${esc(s.year)}). Where: ${esc(s.where)}</li>`).join("")}</ul>`:`<p class="small muted">All sources are course readings.</p>`}
          ${outEra.length?`<ul class="warnlist">${outEra.map(s=>`<li class="modern"><b>Outside the era · reason given</b>${esc(shortCite(s))}: ${esc(s.fit)}</li>`).join("")}</ul>`:""}</div>
        <div><div class="eyebrow">Chronology and modern-term flags</div>
          ${warn.length?`<ul class="warnlist">${warn.map(w=>`<li class="${w.kind}"><b>${esc(w.where)}</b>${esc(w.text)}</li>`).join("")}</ul>`:`<p class="small muted">No dated names or modern terms outside the era were found.</p>`}</div>
      </div>
      <details><summary class="small">Read the premise, actions and rationales</summary>
        <div class="stack small" style="margin-top:10px"><p><b>Premise.</b> ${esc(d.premise)}</p>
        ${d.actions.map(a=>`<div class="plain stack" style="gap:6px"><b>${esc(a.name)}</b><span><span class="muted">Rationale:</span> ${esc(a.rationale)}</span><span class="muted">Source: ${esc(shortCite(d.sources.find(s=>s.id===a.source)||{citation:"none"}))}${a.page?", "+esc(a.page):""}</span></div>`).join("")}</div></details>
      <label class="f" for="rv-${id}"><span>Note to the designer (required to send back)</span><textarea id="rv-${id}" data-review-note="${id}"></textarea></label>
      <div class="row"><button class="primary" data-act="approve" data-id="${id}">Approve for class</button><button data-act="send-back" data-id="${id}">Send back with note</button><button class="ghost" data-act="local" data-review="${id}">Preview in pass and play</button><span class="small muted" data-review-msg="${id}"></span></div>
    </article>`;
  }

  /* ---------- DESIGN ---------- */
  function renderDesign(){
    const d = cur(), c = checks(d);
    const stepOk = i => c.some(x=>x.step===i) && c.filter(x=>x.step===i).every(x=>x.ok);
    return `
    <div class="dhead">
      <select id="draftpick" data-act="pick-draft" aria-label="Choose a draft">${drafts.map(x=>`<option value="${esc(x.gid)}" ${x.gid===curId?"selected":""}>${esc(x.title||"Untitled world")}${x.sandbox?" (sandbox)":""}</option>`).join("")}</select>
      <button data-act="new-draft">New world</button><button data-act="dup-draft">Duplicate</button>
      <button data-act="local" data-gid="${esc(d.gid)}">Pass and play</button><button class="primary" data-act="host" data-gid="${esc(d.gid)}">Host live test</button>
    </div>
    ${d.sandbox?`<div class="note" style="margin-bottom:18px"><b>Sandbox example.</b> This world shows how the parts fit together. Two actions are deliberately left without sources so you can see the checklist flag them, and its claims still need checking against the readings. It cannot be submitted to the class library. Choose Duplicate to build your own version.</div>`:""}
    <div class="designer">
      <nav class="steps" aria-label="Design steps">${STEPS.map((s,i)=>`<button data-act="step" data-i="${i}" ${i===step?'aria-current="step"':""}><span class="n ${i<8&&stepOk(i)?"ok":""}">${i+1}</span>${esc(s)}</button>`).join("")}</nav>
      <section class="stack" id="stepbody">${renderStep(d)}</section>
      <aside class="rail">${renderChecklist(d,c)}</aside>
    </div>`;
  }
  function renderChecklist(d,c){
    const n = c.filter(x=>x.ok).length, warn = chronology(d);
    return `<div class="frame" id="checklist"><div class="eyebrow">Design checklist</div>
      <div class="meter"><i style="width:${Math.round(100*n/c.length)}%"></i></div>
      <ul class="checklist">${c.map(x=>`<li class="${x.ok?"ok":"bad"}"><span class="mk">${x.ok?"✓":"○"}</span><span>${esc(x.t)}</span></li>`).join("")}</ul>
      <p class="small muted" style="margin-top:10px">All items are required to submit. They check completeness, not accuracy; your instructor reviews accuracy.</p>
      ${warn.length?`<div class="eyebrow" style="margin-top:14px">Check these dates and terms</div><ul class="warnlist">${warn.map(w=>`<li class="${w.kind}"><b>${esc(w.where)}</b>${esc(w.text)}</li>`).join("")}</ul>`:""}
    </div>`;
  }
  function refreshRail(){ if(view()!=="design") return; const rail = $(".rail"); if(rail){ const d = cur(); rail.innerHTML = renderChecklist(d, checks(d)); } }
  function field(label, path, val, opts={}){
    const id = "f-"+path.replace(/\./g,"-");
    const hint = opts.hint ? `<em>${esc(opts.hint)}</em>` : "";
    if(opts.area) return `<label class="f" for="${id}"><span>${esc(label)}</span>${hint}<textarea id="${id}" data-bind="${path}" placeholder="${esc(opts.ph||"")}">${esc(val)}</textarea></label>`;
    return `<label class="f" for="${id}"><span>${esc(label)}</span>${hint}<input id="${id}" type="${opts.num?"number":"text"}" data-bind="${path}" ${opts.num?"data-num":""} value="${esc(val)}" placeholder="${esc(opts.ph||"")}"></label>`;
  }
  const head = (n, title, text) => `<div class="stephead"><div class="ribbon">Step ${n}</div><h2 style="margin-top:10px">${title}</h2><p>${text}</p></div>`;
  function renderStep(d){
    switch(step){
    case 0: return head(1,"World and era","Choose the moment your game takes place. The framework you pick sets what counts as a normal diplomatic move.") + `
      <div class="plain stack">
      ${field("Game title","title",d.title)}
      ${field("Subtitle (name the era and East Asia, as in your paper)","subtitle",d.subtitle,{ph:"e.g. Managed contact in early modern East Asia"})}
      <label class="f" for="erapreset"><span>Start from a course week</span>
        <select id="erapreset" data-act="era-preset"><option value="">Choose a week to fill the era…</option>${ERAS.map((e,i)=>`<option value="${i}">Week ${e.week}: ${esc(e.label)}</option>`).join("")}</select></label>
      <div class="grid3">${field("Era","era.label",d.era.label)}${field("From (year; BCE as negative)","era.start",d.era.start,{num:1})}${field("To (year)","era.end",d.era.end,{num:1})}</div>
      ${field("Where this takes place","setting",d.setting,{ph:"Ports, capitals, borderlands…"})}
      <label class="f" for="f-order"><span>Diplomatic framework</span>
        <select id="f-order" data-bind="order">${Object.entries(ORDERS).map(([k,o])=>`<option value="${k}" ${d.order===k?"selected":""}>${esc(o.name)}</option>`).join("")}</select>
        <em>${esc(ORDERS[d.order]?.hint||"")}</em></label>
      ${field("Premise: how did relations between polities work, in the era's own terms?","premise",d.premise,{area:1,ph:"Who ranked whom? What made a ruler legitimate? Who carried messages?"})}
      </div>`;
    case 1: return renderMapStep(d);
    case 2: return head(3,"Actors","Courts, domains, companies or individuals. Describe how each saw the world in its own categories, not ours. Mark the ones classmates can play.") +
      d.actors.map((a,i)=>`<div class="plain item">
        <header><span class="swatch" style="background:var(${COLORS[i%8]})"></span><h3>${esc(a.name||"Unnamed actor")}</h3>
          <label class="row small"><input type="checkbox" data-bind="actors.${i}.playable" ${a.playable?"checked":""}> Playable</label>
          <button class="ghost danger" data-act="del" data-list="actors" data-i="${i}">Remove</button></header>
        <div class="grid2">${field("Name","actors."+i+".name",a.name)}
          <label class="f" for="k-${i}"><span>Kind</span><select id="k-${i}" data-bind="actors.${i}.kind">${KINDS.map(k=>`<option ${a.kind===k?"selected":""}>${esc(k)}</option>`).join("")}</select></label></div>
        ${field("Worldview: how did this actor understand its place?","actors."+i+".worldview",a.worldview,{area:1})}
        ${field("What counts as success for this actor?","actors."+i+".goal",a.goal)}
        <div class="small muted">Seat on map: ${a.tile?esc(placeName(d,a.tile)||("column "+(a.tile[0]+1)+", row "+(a.tile[1]+1))):"not placed yet (use the Map step)"}</div>
      </div>`).join("") + `<div><button data-act="add-actor">Add actor</button></div>`;
    case 3: return head(4,"Resources and victory","Rename the four resources so they match what mattered in your era. “Legitimacy” in 1650 and “recognition” in 1950 may behave very differently. A game should fit in about an hour with discussion: four rounds is a good default.") +
      `<div class="plain stack">${d.resources.map((r,i)=>`<div class="grid2"><div class="row" style="align-items:flex-end;flex-wrap:nowrap"><span class="tok r${i%4}"><i>${i+1}</i></span>${field("Resource "+(i+1),"resources."+i+".name",r.name)}</div>${field("What it represents","resources."+i+".meaning",r.meaning)}</div>`).join("")}</div>
      <div class="plain stack"><div class="eyebrow">Starting values</div>
        <div class="tablewrap"><table class="ledger"><thead><tr><th>Actor</th>${d.resources.map(r=>`<th>${esc(r.name)}</th>`).join("")}</tr></thead>
        <tbody>${d.actors.map((a,i)=>`<tr><td>${esc(a.name||"Unnamed")}</td>${d.resources.map(r=>`<td><input type="number" aria-label="${esc(a.name)} ${esc(r.name)}" data-bind="actors.${i}.start.${r.key}" data-num value="${esc(a.start[r.key]??0)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
      <div class="plain stack"><div class="grid2">${field("Rounds (1–12)","victory.rounds",d.victory.rounds,{num:1})}
        <label class="f" for="vres"><span>Winner is decided by</span><select id="vres" data-bind="victory.res">${d.resources.map(r=>`<option value="${r.key}" ${d.victory.res===r.key?"selected":""}>${esc(r.name)}</option>`).join("")}</select></label></div>
      ${field("What does winning mean in this era?","victory.text",d.victory.text,{area:1,ph:"Would these actors have thought in terms of winning at all?"})}</div>`;
    case 4: return renderSourcesStep(d);
    case 5: return renderActionsStep(d);
    case 6: { const r = eraRange(d); return head(7,"Historical events","One event closes each round: the first event dated inside that round's years. Events are where real history interrupts the players' plans. Every event must be dated inside your era and linked to a source.") +
      openingEditor(d, r) +
      d.events.map((e,i)=>{ const y = num(e.year), bad = r && (y==null || y<r[0] || y>r[1]); return `<div class="plain item">
        <header><span class="pill ${bad?"bad":"warn"}">${esc(e.year)}${bad?" · outside era":""}</span><h3>${esc(e.title||"New event")}</h3><button class="ghost danger" data-act="del" data-list="events" data-i="${i}">Remove</button></header>
        <div class="grid3">${field("Year","events."+i+".year",e.year,{num:1})}<div style="grid-column:span 2;min-width:0">${field("Title","events."+i+".title",e.title)}</div></div>
        ${field("What happened","events."+i+".text",e.text,{area:1})}
        <div class="stack" style="gap:6px"><span class="eyebrow">Effects</span>${effectsEditor(d,"events."+i+".effects",e.effects,true)}</div>
        ${sourceSelect(d,"events."+i+".source",e.source)}
      </div>`; }).join("") + `<div><button data-act="add-event">Add event</button></div>`; }
    case 7: return head(8,"Anachronism traps","Name the modern ideas about diplomacy a player is likely to bring to your world, and what your game shows instead. These appear in play and in the debrief.") +
      d.traps.map((t,i)=>`<div class="plain"><div class="trap">
        ${field("Modern assumption","traps."+i+".modern",t.modern,{area:1})}<span class="arrow">→</span>
        ${field("What the era shows instead","traps."+i+".historical",t.historical,{area:1})}
        <button class="ghost danger" data-act="del" data-list="traps" data-i="${i}" aria-label="Remove trap" style="margin-top:24px">✕</button></div></div>`).join("") +
      `<div><button data-act="add-trap">Add trap</button></div>`;
    case 8: return renderReview(d);
    }
    return "";
  }
  function renderSourcesStep(d){
    const allowed = new Set(allowedReadings(d).map(c=>c.key));
    const r = eraRange(d);
    return head(5,"Sources","Every rule should rest on evidence. Course readings that fit your era are listed first. An asterisk (*) repeats the syllabus's own mark; each reading also says what kind of evidence it is, and only documents from the time, contemporary reporting and edited collections of documents count as primary sources. A source from outside your era needs a sentence explaining why it still applies. Any non-course source needs a full citation and will be checked by your instructor.") + `
      <label class="f" for="addcourse"><span>Add a course reading</span>
        <select id="addcourse" data-act="add-course"><option value="">Choose a reading…</option>
          <optgroup label="${r?`Fits ${r[0]}–${r[1]}`:"Set your era years to sort these"}">${COURSE_SOURCES.filter(s=>allowed.has(s.key)).map(s=>`<option value="${s.key}">${esc(s.week)} · ${s.starred?"*":""}${esc(s.short)}</option>`).join("")}</optgroup>
          ${r?`<optgroup label="Outside your era (needs a reason)">${COURSE_SOURCES.filter(s=>!allowed.has(s.key)).map(s=>`<option value="${s.key}">${esc(s.week)} · ${s.starred?"*":""}${esc(s.short)}</option>`).join("")}</optgroup>`:""}
        </select></label>
      ${d.sources.map((s,i)=>{ const course = isCourse(s), out = sourceOutOfEra(d,s), c = courseOf(s.key); return `<div class="plain item">
        <header><span class="pill ${countsAsPrimary(s)?"ok":"info"}">${esc(genreOf(s)?GENRE_LABEL[genreOf(s)]:"Kind not set")}</span>${course?`<span class="pill ok">course reading</span>`:`<span class="pill warn">instructor will verify</span>`}${out?`<span class="pill bad">outside era</span>`:""}<h3 class="small">${esc(shortCite(s))}</h3>
        <button class="ghost danger" data-act="del" data-list="sources" data-i="${i}">Remove</button></header>
        ${course?`<p class="small muted">${esc(c.week)} · about ${c.any?"all periods":esc(fmtYears(c.from, c.to))}${c.starred?" · marked * on the syllabus":""} · ${countsAsPrimary(s)?"counts as a primary source":"does not count as a primary source"}</p>`:`
        <div class="grid2"><label class="f" for="sg-${i}"><span>Kind of evidence</span><select id="sg-${i}" data-bind="sources.${i}.genre"><option value="" ${genreOf(s)?"":"selected"}>Choose…</option>${GENRES.map(g=>`<option value="${g}" ${s.genre===g?"selected":""}>${esc(GENRE_LABEL[g])}</option>`).join("")}</select></label>
          ${field(countsAsPrimary(s)?"Year written (BCE as negative)":"Year published","sources."+i+".year",s.year,{num:1})}</div>
        ${field("Full citation (author, title, publisher or archive, pages)","sources."+i+".citation",s.citation)}
        ${field("Where a reader can find it (library call number, database, archive, URL)","sources."+i+".where",s.where)}`}
        ${out?field("Why this source still applies to your era (required)","sources."+i+".fit",s.fit,{area:1,ph:"What does it show about your era, and what can it not show?"}):""}
        ${field("What it shows, and its limits (bias, gaps, whose voice)","sources."+i+".note",s.note,{area:1})}
        ${field("What to look for (optional): a prompt for players, in your own words","sources."+i+".lookFor",s.lookFor||"",{area:1,hint:"Point players to what matters in this source. Don't copy passages from it; course texts stay in the course.",ph:"e.g. How does the author describe what each side gained from a tribute mission?"})}</div>`; }).join("")}
      <div><button data-act="add-source">Add a non-course source</button></div>`;
  }
  function sourceSelect(d, path, val){
    const id = "src-"+path.replace(/\./g,"-");
    return `<label class="f" for="${id}"><span>Grounded in</span><select id="${id}" data-bind="${path}"><option value="">No source yet</option>${d.sources.map(s=>`<option value="${esc(s.id)}" ${val===s.id?"selected":""}>${esc(s.type)}: ${esc(shortCite(s))}</option>`).join("")}</select></label>`;
  }
  function effectsEditor(d, path, list, forEvent){
    const tos = forEvent ? [["all","Every actor"], ...d.actors.map(a=>[a.id,a.name||"Unnamed"])] : [["self","Actor"],["target","Target"],["all","Every actor"]];
    return `<div class="effects">${list.map((e,i)=>`<div class="eff">
      <select aria-label="Who" data-bind="${path}.${i}.to">${tos.map(([v,n])=>`<option value="${esc(v)}" ${e.to===v?"selected":""}>${esc(n)}</option>`).join("")}</select>
      <select aria-label="Resource" data-bind="${path}.${i}.res">${d.resources.map(r=>`<option value="${r.key}" ${e.res===r.key?"selected":""}>${esc(r.name)}</option>`).join("")}</select>
      <input type="number" aria-label="Change" data-bind="${path}.${i}.d" data-num value="${esc(e.d)}">
      <button class="ghost" data-act="del-eff" data-path="${path}" data-i="${i}" aria-label="Remove effect">✕</button></div>`).join("")}
      <div><button class="ghost" data-act="add-eff" data-path="${path}" data-to="${forEvent?"all":"self"}">+ Effect</button></div></div>`;
  }
  function renderActionsStep(d){
    return head(6,"Diplomatic actions","These are the cards players choose on their phones. For each, write how the actor read its own move and how others read it, then explain in your own words why the card works the way it does, citing its source.") +
    d.actions.map((a,i)=>`<div class="plain item">
      <header><h3>${esc(a.name||"New action")}</h3>${a.source?`<span class="pill ok">sourced</span>`:`<span class="pill bad">needs source</span>`}${(a.rationale||"").trim().length>=40?"":`<span class="pill bad">needs rationale</span>`}${missingReadings(d,a).length?`<span class="pill bad">needs ${missingReadings(d,a).length} court reading${missingReadings(d,a).length>1?"s":""}</span>`:""}
        <button class="ghost danger" data-act="del" data-list="actions" data-i="${i}">Remove</button></header>
      ${field("Action name","actions."+i+".name",a.name)}
      <div class="stack" style="gap:6px"><span class="eyebrow">Who may take it</span><div class="checks">
        <label><input type="checkbox" data-act="who" data-i="${i}" value="any" ${a.who.includes("any")?"checked":""}> Any actor</label>
        ${d.actors.map(x=>`<label><input type="checkbox" data-act="who" data-i="${i}" value="${esc(x.id)}" ${a.who.includes(x.id)?"checked":""}> ${esc(x.name||"Unnamed")}</label>`).join("")}</div></div>
      <label class="f" for="tg-${i}"><span>Target</span><select id="tg-${i}" data-bind="actions.${i}.target">
        <option value="none" ${a.target==="none"?"selected":""}>No target</option><option value="choose" ${a.target==="choose"?"selected":""}>Player chooses</option>
        ${d.actors.map(x=>`<option value="${esc(x.id)}" ${a.target===x.id?"selected":""}>Always ${esc(x.name||"Unnamed")}</option>`).join("")}</select></label>
      <div class="stack" style="gap:6px"><span class="eyebrow">Effects</span>${effectsEditor(d,"actions."+i+".effects",a.effects,false)}</div>
      <div class="grid2">${field("How the actor read its own move","actions."+i+".readingSelf",a.readingSelf,{area:1})}
        ${field("How the other side (or others) read it","actions."+i+".readingOther",a.readingOther,{area:1})}</div>
      ${courtReadings(d,a,i)}
      <div class="grid2">${sourceSelect(d,"actions."+i+".source",a.source)}${field("Pages or passage","actions."+i+".page",a.page)}</div>
      ${field("Your rationale: what in the source supports these effects and readings? (required)","actions."+i+".rationale",a.rationale,{area:1,ph:"In your own words. Instructors read this when they review your game."})}
      ${claimSelects(a,i)}
      ${field("Modern assumption this card unsettles","actions."+i+".trap",a.trap)}
      <details ${Number(a.risk.chance)>0?"open":""}><summary class="small">Risk (optional): a chance the move backfires${Number(a.risk.chance)>0?` · ${esc(a.risk.chance)}% set`:""}</summary>
        <div class="stack" style="margin-top:10px">${field("Chance of backfiring (%)","actions."+i+".risk.chance",a.risk.chance,{num:1,hint:"A modeling choice. Explain in your rationale why the move could misfire; the percentage itself is not historical evidence, and players are told so."})}
        ${field("What goes wrong","actions."+i+".risk.text",a.risk.text)}
        <div class="stack" style="gap:6px"><span class="eyebrow">Backfire effects</span>${effectsEditor(d,"actions."+i+".risk.effects",a.risk.effects,false)}</div></div></details>
    </div>`).join("") + `<div><button data-act="add-action">Add action</button></div>`;
  }
  /* Phase 1: the designer says what kind of claim the rationale and the court readings make. Players see the labels. */
  /* The opening scene: what everyone reads after Start, before round 1. */
  function openingEditor(d, r){
    if(!d.opening) d.opening = blankOpening();
    const o = d.opening, y = num(o.year), late = r && y!=null && y>r[0];
    return `<div class="plain item openingedit"><header><span class="pill ${late?"bad":"warn"}">Opening${o.year!==""?" · "+esc(o.year):""}${late?" · after the game opens":""}</span><h3>${esc(o.title||"Opening scene")}</h3></header>
      <p class="small muted" style="margin:0">Everyone sees this after the host starts and before anyone moves: the moment in time, the state of diplomacy, and a real event to react to. Date it no later than ${r?esc(r[0]):"the year your game opens"}. It has no effects on the board.</p>
      <div class="grid3">${field("Year","opening.year",o.year,{num:1})}<div style="grid-column:span 2;min-width:0">${field("Title","opening.title",o.title,{ph:"e.g. A new dynasty in Beijing"})}</div></div>
      ${field("Where things stand (two or more sentences)","opening.text",o.text,{area:1,ph:"What has just happened, who holds power, and how each court is placed. In your own words."})}
      ${field("A question for every court (optional)","opening.ask",o.ask,{ph:"e.g. How will your court answer the new court in Beijing?"})}
      ${sourceSelect(d,"opening.source",o.source)}
    </div>`;
  }
  function claimSelects(a,i){
    const sel = (key, label) => `<label class="f" for="cl-${key}-${i}"><span>${label}</span><select id="cl-${key}-${i}" data-bind="actions.${i}.${key}"><option value="" ${a[key]?"":"selected"}>Not marked yet</option>${CLAIMS.map(k=>`<option value="${k}" ${a[key]===k?"selected":""}>${esc(CLAIM_LABEL[k])}</option>`).join("")}</select></label>`;
    return `<div class="stack" style="gap:6px"><div class="grid2">${sel("claimRationale","What kind of claim is the rationale?")}${sel("claimReadings","What kind of claim are the court readings?")}</div>
      <p class="small muted" style="margin:0">Documented claim: the source says it. Historical inference: a reasonable reading of the source that it doesn't state outright. Design assumption: a choice you made so the game works. Players see this label on the card.</p></div>`;
  }
  function claimPill(k, what){ const l = claimLabel(k); return l ? `<span class="pill claim claim-${k}" title="${esc(what)}: ${esc(l)}">${what?esc(what)+": ":""}${esc(l)}</span>` : ""; }
  function claimLine(a){ const x = claimPill(a.claimRationale,"Rule"), y = claimPill(a.claimReadings,"Readings"); return x||y ? `<span class="claims">${x}${y}</span>` : ""; }
  function courtReadings(d,a,i){
    const miss = missingReadings(d,a);
    return `<details class="readingsbox" ${miss.length?"open":""}><summary class="small"><b>How each court reads this move</b> · ${d.actors.length-miss.length} of ${d.actors.length} written</summary>
      <p class="small muted" style="margin:8px 0">Players see their own court's reading after the move, and the debrief compares them. Write each in that court's own terms (${READING_MIN}+ characters). The same text is shown whether the court makes the move or receives it, so write it for both cases if the court could do either.</p>
      <div class="stack" style="gap:10px">${d.actors.map(x=>{ const id = "rd-"+i+"-"+x.id; return `<label class="f" for="${esc(id)}"><span><span class="swatch" style="background:var(${colorOf(d,x.id)});vertical-align:-2px;margin-right:6px"></span>${esc(x.name||"Unnamed actor")}</span><textarea id="${esc(id)}" data-bind="actions.${i}.readings.${esc(x.id)}" style="min-height:56px" placeholder="${esc(readingOf(a,x.id,"")||"How would this court have understood the move?")}">${esc((a.readings||{})[x.id]||"")}</textarea></label>`; }).join("")}</div></details>`;
  }
  function renderMapStep(d){
    const sel = mapTool.sel || [0,0];
    const selPlace = d.map.places.find(p=>p.c===sel[0]&&p.r===sel[1]);
    const seated = d.actors.find(a=>a.tile && a.tile[0]===sel[0] && a.tile[1]===sel[1]);
    const T = {s:"Sea",l:"Land",m:"Mountains",d:"Steppe"};
    const t = (d.map.terrain[sel[1]]||"")[sel[0]]||"s";
    return head(2,"Map","A stylized hex board of maritime East Asia, not to scale. Choose a tile by clicking it or with the column and row menus, then set its terrain, name it, or seat an actor there. Borders are left out on purpose: in many eras they were not lines on a map.") + `
    <div class="frame boardframe" id="mapbox">${hexSvg(d,{edit:true, sel:mapTool.sel})}</div>
    <div class="plain stack">
      <div class="tileform">
        <label class="f" for="tile-c"><span>Column</span><select id="tile-c" data-act="tile-c">${Array.from({length:d.map.cols},(_,i)=>`<option value="${i}" ${sel[0]===i?"selected":""}>${i+1}</option>`).join("")}</select></label>
        <label class="f" for="tile-r"><span>Row</span><select id="tile-r" data-act="tile-r">${Array.from({length:d.map.rows},(_,i)=>`<option value="${i}" ${sel[1]===i?"selected":""}>${i+1}</option>`).join("")}</select></label>
        <label class="f" for="tile-t"><span>Terrain</span><select id="tile-t" data-act="tile-t">${Object.entries(T).map(([k,n])=>`<option value="${k}" ${t===k?"selected":""}>${n}</option>`).join("")}</select></label>
        <label class="f" for="seat"><span>Seat of</span><select id="seat" data-act="seat"><option value="">Nobody</option>${d.actors.map(a=>`<option value="${esc(a.id)}" ${seated&&seated.id===a.id?"selected":""}>${esc(a.name||"Unnamed")}</option>`).join("")}</select></label>
      </div>
      <label class="f" for="placename"><span>Place name for this tile</span><input id="placename" type="text" data-act="placename" value="${esc(selPlace?selPlace.name:"")}" placeholder="e.g. Nagasaki"></label>
    </div>
    ${boardList(d)}`;
  }
  function boardList(d){
    return `<details class="boardlist"><summary>The board as a list</summary><ul>
      ${d.map.places.map(p=>{ const a = d.actors.find(x=>x.tile&&x.tile[0]===p.c&&x.tile[1]===p.r); return `<li>${esc(p.name)} (column ${p.c+1}, row ${p.r+1})${a?`: seat of ${esc(a.name)}`:""}</li>`; }).join("")}
      ${d.actors.filter(a=>a.tile && !placeName(d,a.tile)).map(a=>`<li>${esc(a.name)} at column ${a.tile[0]+1}, row ${a.tile[1]+1}</li>`).join("")}
    </ul></details>`;
  }
  function renderReview(d){
    const c = checks(d), failing = c.filter(x=>!x.ok), warn = chronology(d);
    const sub = d.submission, info = sub ? subs[sub.id] : null;
    const status = d.sandbox ? "sandbox" : sub ? (info ? info.status : "pending") : "draft";
    const editedSince = sub && (d.updatedAt||0) > (d.submittedAt||0);
    const canPub = !d.sandbox && failing.length===0;
    return head(9,"Review and submit","Playtest your world, then submit it under your nickname. Your instructor reviews every game before it reaches the class library.") + `
    <div class="frame stack">
      <div class="row"><span class="status ${status}">${esc(STATUS_LABEL[status])}</span>${editedSince?`<span class="pill warn">Edited since you submitted</span>`:""}</div>
      ${info && info.status==="changes" && info.note?`<div class="note"><b>Instructor's note:</b> ${esc(info.note)}</div>`:""}
      ${d.sandbox?`<p class="small">The sandbox example cannot be submitted. Duplicate it to make your own.</p>`:
        failing.length?`<div class="gatebox"><b>Fix ${failing.length} item${failing.length>1?"s":""} before you can submit:</b><ul class="checklist">${failing.map(x=>`<li class="bad"><span class="mk">✕</span><button class="ghost" style="padding:2px 4px;text-transform:none;letter-spacing:0;font-weight:500" data-act="step" data-i="${x.step}">${esc(x.t)} → step ${x.step+1}</button></li>`).join("")}</ul></div>`
        :`<div class="gatebox ok small">Every required item is complete.${warn.length?` Your instructor will also see the ${warn.length} date or term flag${warn.length>1?"s":""} listed in the checklist.`:""}</div>`}
      ${d.sandbox?"":`<label class="f" for="nick"><span>Your nickname (shown with your game)</span><input id="nick" type="text" maxlength="24" data-act="nick" value="${esc(sub?sub.nickname:nick)}" placeholder="First name or nickname"></label>`}
      <div class="row"><button class="primary" data-act="host" data-gid="${esc(d.gid)}">Host live test</button><button data-act="local" data-gid="${esc(d.gid)}">Pass and play</button>
        <button data-act="publish" ${canPub?"":"disabled"}>${sub?"Resubmit for review":"Submit for instructor review"}</button>
        ${sub?`<button class="ghost danger" data-act="unpublish">Withdraw</button>`:""}</div>
      <p class="small muted" id="pubmsg"></p>
      ${sub?`<p class="small">Your edit key: <b>${esc(sub.editKey)}</b>. Keep it; it lets you revise or withdraw this game. It's saved in this browser and in the design data below.</p>`:""}
    </div>
    <div class="plain stack"><div class="eyebrow">Playtest notes from classmates</div>
      ${info && info.feedback && info.feedback.length ? info.feedback.map(f=>`<div class="stack small" style="gap:4px;border-top:1px solid var(--line);padding-top:8px">
        <b>${esc(f.nickname||"A classmate")}</b>${f.trap?`<div><span class="muted">Assumption it challenged:</span> ${esc(f.trap)}</div>`:""}${f.body?`<div><span class="muted">What felt off:</span> ${esc(f.body)}</div>`:""}</div>`).join("") : `<p class="small muted">${sub?"No notes yet.":"Notes appear here after your game is approved and classmates play."}</p>`}
    </div>
    <div class="plain stack"><div class="eyebrow">Move this design between browsers</div>
      <textarea class="json" id="jsonbox" aria-label="Design data">${esc(JSON.stringify(d))}</textarea>
      <div class="row"><button data-act="copy-json">Copy</button><button data-act="import-json">Load pasted design as new draft</button><span class="small muted" id="jsonmsg"></span></div>
    </div>
    ${d.sandbox?"":`<div><button class="ghost danger" data-act="delete-draft">Delete this draft</button></div>`}`;
  }

  /* ---------- hex board ---------- */
  function hexSvg(d, o={}){
    const R = 20, W = Math.sqrt(3)*R, cols = d.map.cols, rows = d.map.rows;
    const w = W*(cols+0.5)+4, h = R*1.5*(rows-1)+2*R+4;
    const ctr = (c,r) => [W*(c+0.5*(r&1))+W/2+2, R+r*1.5*R+2];
    const pts = (cx,cy) => Array.from({length:6},(_,i)=>{const a=Math.PI/180*(60*i-30);return (cx+R*Math.cos(a)).toFixed(1)+","+(cy+R*Math.sin(a)).toFixed(1);}).join(" ");
    const seats = d.actors.filter(a=>a.tile).map(a=>a.name+" at "+(placeName(d,a.tile)||"column "+(a.tile[0]+1)+", row "+(a.tile[1]+1))).join("; ");
    let s = `<svg class="map ${o.edit?"edit":""}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="Hex board of ${esc(d.setting||"the game world")}. ${esc(seats)}">`;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const [cx,cy] = ctr(c,r), t = (d.map.terrain[r]||"")[c]||"s";
      const sel = o.sel && o.sel[0]===c && o.sel[1]===r;
      s += `<polygon class="t-${t}${sel?" sel":""}" points="${pts(cx,cy)}" ${o.edit?`data-tile="${c},${r}"`:""}></polygon>`;
      if(t!=="s") s += `<polygon class="shade" points="${cx-R*0.866},${cy+R*0.5} ${cx},${cy+R} ${cx+R*0.866},${cy+R*0.5} ${cx+R*0.866},${cy+R*0.3} ${cx},${cy+R*0.8} ${cx-R*0.866},${cy+R*0.3}"/>`;
    }
    if(o.route && o.route.from && o.route.to){
      const a = o.route.from, b = o.route.to; const [x1,y1]=ctr(a[0],a[1]), [x2,y2]=ctr(b[0],b[1]); const mx=(x1+x2)/2, my=(y1+y2)/2-Math.hypot(x2-x1,y2-y1)*0.28;
      s += `<path class="route ${o.route.fail?"fail":""}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/>`;
    }
    d.map.places.forEach(p=>{ const [cx,cy]=ctr(p.c,p.r); s += `<text x="${cx}" y="${cy+R*1.02}" text-anchor="middle">${esc(p.name)}</text>`; });
    d.actors.forEach((a,i)=>{ if(!a.tile) return; const [cx,cy]=ctr(a.tile[0],a.tile[1]);
      if(o.current===a.id) s += `<circle class="glow" cx="${cx}" cy="${cy-2}" r="13"/>`;
      s += `<g class="tokn" ${o.tap?`data-court="${esc(a.id)}" role="button" tabindex="0" aria-label="How ${esc(a.name)} read this move"`:""}>${o.tap?`<circle cx="${cx}" cy="${cy-2}" r="17" fill="transparent"/>`:""}<circle cx="${cx}" cy="${cy-2}" r="9" fill="var(${COLORS[i%8]})" stroke="#F3EFE4" stroke-width="1.6"/><text x="${cx}" y="${cy+0.6}" text-anchor="middle">${esc(initials(a.name))}</text></g>`; });
    return s + `</svg>`;
  }

  /* ---------- shared play UI ---------- */
  function fxToks(d, effects){
    return `<div class="toks">${(effects||[]).map(e=>{ const who = e.to==="self"?"":e.to==="target"?"Target ":e.to==="all"?"All ":((actorById(d,e.to)||{}).name||"")+" ";
      return `<span class="tok r${resIdx(d,e.res)}">${esc(who)}<i>${e.d>0?"+":""}${esc(e.d)}</i>${esc(resName(d,e.res))}</span>`; }).join("")}</div>`;
  }
  function roundTrack(d, st){
    const n = Number(d.victory.rounds)||1;
    return `<div class="track" aria-label="Round ${Math.min(st.round,n)} of ${n}">${Array.from({length:n},(_,i)=>{ const r=i+1, y=yearFor(d,r);
      return `<div class="slot ${r===st.round&&!st.over?"on":r<st.round?"done":""}">${r}${y!==""?`<small>${y}</small>`:""}</div>`; }).join("")}</div>`;
  }
  function ledger(d, st, curId, ai){
    return `<table class="ledger"><thead><tr><th>Actor</th>${d.resources.map((r,i)=>`<th title="${esc(r.meaning)}"><span class="tok r${i%4}"><i>${i+1}</i></span> ${esc(r.name)}</th>`).join("")}</tr></thead><tbody>
      ${d.actors.map((a,i)=>`<tr class="${a.id===curId?"cur":""}"><td><span class="swatch" style="background:var(${COLORS[i%8]});vertical-align:-3px;margin-right:6px"></span>${esc(a.name)}${st.order.includes(a.id)?(ai&&ai.has(a.id)?` <span class="pill ai">AI</span>`:""):` <span class="muted small">(board)</span>`}</td>
        ${d.resources.map(r=>{ const ch = (st.last[a.id]||{})[r.key]; return `<td>${st.res[a.id][r.key]}${ch?`<span class="chg ${ch>0?"up":"dn"}">${ch>0?"+":""}${ch}</span>`:""}</td>`; }).join("")}</tr>`).join("")}
    </tbody></table>`;
  }
  function actionCards(d, st, who, pick, ph){
    const list = d.actions.map(a=>{ const c = canTake(d,st,a,who); if(!c.ok) return ""; return `<button class="acard" data-act="${ph?"ph-pick":"pick"}" data-id="${esc(a.id)}" aria-pressed="${pick===a.id}" ${c.blocked?"disabled":""}>
        ${Number(a.risk&&a.risk.chance)>0?`<span class="stamp">${esc(a.risk.chance)}% RISK</span>`:""}<span class="head">${esc(a.name)}</span>
        <span class="bodyc">${fxToks(d,a.effects)}${a.target!=="none"&&a.target!=="choose"?`<span class="small muted">Toward ${esc((actorById(d,a.target)||{}).name||"")}</span>`:a.target==="choose"?`<span class="small muted">You choose the target</span>`:""}
        ${claimLine(a)}${c.blocked?`<span class="small" style="color:var(--danger)">${esc(c.blocked)}</span>`:""}</span></button>`; }).join("");
    return list ? `<div class="acards">${list}</div>` : `<p class="small muted">No actions available to this court this turn.</p>`;
  }
  /* Decision B: a vote needs a source, where in it the evidence is, and reasoning. A quote is optional. */
  function missingNote(list){
    return list.length ? `To send this, add: <ul>${list.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><span class="muted">Every vote rests on evidence from the readings; your TA checks it in the debrief.</span>` : `Ready to send.`;
  }
  function reasonForm(d, st, who, pick, state, ph){
    const A = actorById(d,who), y = yearFor(d,st.round), k = ph ? "ph-" : "";
    const miss = evidenceMissing(d, pick, state, who), chosen = d.sources.find(s=>s.id===state.src);
    const news = isNews(d), h = holderOf(d, st.round, who), cite = news ? citableSources(d, st.round) : d.sources;
    return `<div class="stack">${pick.target==="choose"?`<label class="f" for="tgt"><span>Toward which court? (required)</span><select id="tgt" data-act="${ph?"ph-target":"target"}"><option value="">Choose…</option>${d.actors.filter(x=>x.id!==who).map(x=>`<option value="${esc(x.id)}" ${state.target===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label>`:""}
      ${d.sources.length?`<label class="f" for="whysrc"><span>1. Which ${news?"article":"reading"} is your evidence from? (required)</span><select id="whysrc" data-act="${ph?"ph-src":"whysrc"}"><option value="">Choose a source…</option>${cite.map(s=>`<option value="${esc(s.id)}" ${state.src===s.id?"selected":""}>${esc(shortCite(s))}</option>`).join("")}</select>${chosen&&chosen.lookFor?`<em>Look for: ${esc(chosen.lookFor)}</em>`:""}</label>
      <label class="f" for="whyloc"><span>2. Where in it? (required)</span><em>${news?`Which paragraph or part, e.g. "third paragraph" or "the part on Taiwan".`:`Page, chapter or section, e.g. "p. 142" or "ch. 6, on Ryukyu".`}</em><input id="whyloc" type="text" maxlength="200" data-act="${k}loc" value="${esc(state.loc||"")}" autocomplete="off"></label>`:""}
      <label class="f" for="why"><span>${d.sources.length?"3. ":""}Why would ${esc(h?h.name:A.name)}${y!==""?(news?" in ":" around ")+y:""} choose this? (required)</span><em>${news?`One sentence, in this leader's terms as the reporting shows them. No quotes you can't point to.`:`One sentence in the court's own terms. What would a modern diplomat assume instead?`}</em><textarea id="why" data-act="${ph?"ph-why":"why"}" maxlength="400" style="min-height:70px">${esc(state.why||"")}</textarea></label>
      ${d.sources.length?`<label class="f" for="whyquote"><span>Short quote from your own copy (optional)</span><em>Leave blank if you like. Up to ${QUOTE_MAX} characters.</em><input id="whyquote" type="text" maxlength="${QUOTE_MAX}" data-act="${k}quote" value="${esc(state.quote||"")}" autocomplete="off"></label>`:""}
      <div class="missing small" id="missing" aria-live="polite">${missingNote(miss)}</div>
      <div><button class="primary" id="commit" data-act="${ph?"ph-send":"take"}" ${miss.length?"disabled":""}>${ph?"Send my vote":"Take this action"}</button></div></div>`;
  }
  function whyBlock(d, e){
    if(!e.why || !e.why.length) return "";
    const head = e.npc ? (e.npc==="ai" ? "The AI court's reasoning" : "Simplified rule-based reasoning (the AI was not used)") : `The table's reasoning${e.votes?` · ${e.votes.chosen} of ${e.votes.total} votes`:""}`;
    return `<div class="why"><b>${head}</b>${e.why.map(w=>{ const s = d.sources.find(x=>x.id===w.src); return `<div><q>${esc(w.text)}</q> <span class="small muted">— ${esc(w.name||"player")}${s?", citing "+esc(shortCite(s)):""}${w.loc?" · "+esc(w.loc):""}</span>${w.quote?`<div class="small muted">Quoted: “${esc(w.quote)}”</div>`:""}</div>`; }).join("")}${e.npc?`<div class="small muted">Test this against the readings: does the source support it?</div>`:""}</div>`;
  }
  /* Passing is a choice too: one sentence on why the court waits. */
  function passBox(state, ph){
    const k = ph ? "ph-" : "", ok = passWhyOk(state.passWhy);
    if(!state.passing) return `<button class="ghost" data-act="${k}pass-open" style="align-self:${ph?"center":"flex-start"}" ${ph&&join.busy?"disabled":""}>${ph?"Vote to pass":"Pass this turn"}</button>`;
    return `<div class="frame stack passbox"><label class="f" for="${k}passwhy"><span>Why does your court wait this turn? (required)</span><em>One sentence in the court's own terms. No source needed.</em><textarea id="${k}passwhy" data-act="${k}passwhy" maxlength="400" style="min-height:60px">${esc(state.passWhy||"")}</textarea></label>
      <div class="row"><button class="primary" id="${k}passgo" data-act="${ph?"ph-pass":"pass"}" ${ok&&!(ph&&join.busy)?"":"disabled"}>${ph?"Send my vote to pass":"Pass this turn"}</button><button class="ghost" data-act="${k}pass-cancel">Cancel</button></div></div>`;
  }
  /* Generative AI suggestions appear only when the server says an AI key is set up (host view). */
  const aiOn = () => !!(play && play.mode==="host" && play.data && play.data.aiReady);
  function aiTag(d, who, mode){ return `<span class="pill ai">${mode==="ai"?"Generative AI (Claude)":mode==="rule"?"Rule-based AI":"AI"} · ${esc((actorById(d,who)||{}).name||"")}</span>`; }
  function logEntry(d, e, opts={}){
    const cls = opts.big ? "frame entry reveal" : "plain entry";
    if(e.kind==="event"){ const ev = e.event, src = d.sources.find(s=>s.id===ev.source);
      return `<article class="${cls} event"><div class="yr">${esc(ev.year)} · Event at the end of round ${e.round}</div><h4>${esc(ev.title)}</h4><p>${esc(ev.text)}</p>${fxToks(d,ev.effects)}${src?`<div class="cite">Source: ${esc(shortCite(src))}</div>`:""}</article>`; }
    if(e.kind==="pass") return `<article class="${cls}"><div class="yr">Round ${e.round}</div>${e.npc?aiTag(d,e.who,e.npc):""}<p>${esc((actorById(d,e.who)||{}).name)} waits and watches.</p></article>`;
    const a = d.actions.find(x=>x.id===e.action)||{}, A = actorById(d,e.who)||{}, T = e.target?actorById(d,e.target):null, src = d.sources.find(s=>s.id===a.source);
    const v = (opts.voices||{})[e.id] || {};
    return `<article class="${cls}"><div class="yr">Round ${e.round}${e.year!==""?(isNews(d)?" · ":" · c. ")+e.year:""}</div>${e.npc?aiTag(d,e.who,e.npc):""}
      <h4>${esc(A.name)}: ${esc(a.name)}${T?` → ${esc(T.name)}`:""}</h4>
      ${e.failed?`<p style="color:var(--danger);font-weight:700">It backfires. ${esc(a.risk&&a.risk.text)}</p><p class="small muted" style="margin:0">A game roll against the designer's ${esc(a.risk&&a.risk.chance)}% risk: a modeling choice, not a historical finding.</p>`:""}
      ${whyBlock(d,e)}
      ${claimLine(a)}<div class="readings"><div><b>As ${esc(A.name)} read it</b>${esc(readingOf(a,e.who,e.who)||"(no reading written)")}</div><div><b>As ${T?esc(T.name):"others"} read it</b>${esc((T?readingOf(a,T.id,e.who):a.readingOther)||"(no reading written)")}</div></div>
      ${a.trap?`<p class="trapline">Modern assumption to set aside: ${esc(a.trap)}</p>`:""}
      <p class="cite">${src?`Source: ${esc(shortCite(src))}${a.page?", "+esc(a.page):""}`:`<span style="color:var(--danger)">No source cited for this rule.</span>`}</p>
      ${opts.voice&&aiOn()?`<div class="row"><select aria-label="Perspective" data-act="voice-who" data-id="${e.id}" style="width:auto">${d.actors.map(x=>`<option value="${esc(x.id)}" ${(v.who||e.target||e.who)===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select>
        <button data-act="voice" data-id="${e.id}" ${v.busy?"disabled":""}>${v.busy?"Thinking…":"AI suggestion: how might this court read the move?"}</button></div>
        ${v.text?`<div class="voice"><span class="pill warn">Generative AI suggestion, not from the readings</span>\n${esc(v.text)}</div>`:""}${v.err?`<p class="small muted">${esc(v.err)}</p>`:""}`:""}
    </article>`;
  }
  /* A game ended before its last round has provisional standings and no winner. */
  const endedEarly = (d, st) => !!st && st.round <= (Number(d.victory.rounds)||1);
  function debrief(d, st, side){
    const k = d.victory.res, ranked = st.order.map(id=>({a:actorById(d,id), v:st.res[id][k]})).sort((x,y)=>y.v-x.v), n = Number(d.victory.rounds)||1;
    const early = endedEarly(d, st);
    return `<div class="stack" style="margin-bottom:18px"><div class="ribbon">Debrief · ${esc(d.title)}${early?" · provisional":""}</div><h1 style="font-size:2.2rem">${early?`The game ended early, in round ${st.round} of ${n}`:ranked[0]?esc(ranked[0].a.name)+" ends with the most "+esc(resName(d,k)):"Game over"}</h1>
      <p style="max-width:68ch;color:var(--muted)">${early?`These standings are provisional: no court has won, because the game stopped before its last round. ${ranked[0]?esc(ranked[0].a.name)+" leads in "+esc(resName(d,k))+" so far.":""}`:esc(d.victory.text)}</p></div>
      <div class="table"><div class="stack"><div class="frame"><div class="tablewrap">${ledger(d,st,null)}</div></div>
        <div class="frame stack"><div class="eyebrow">${esc(lab(d,"traps","Anachronism traps in this world"))}</div>
          ${d.traps.filter(t=>t.modern).map(t=>`<div class="readings"><div><b>${esc(lab(d,"assume","Modern assumption"))}</b>${esc(t.modern)}</div><div><b>${esc(lab(d,"shows","What the era shows"))}</b>${esc(t.historical)}</div></div>`).join("")}</div>
        <div class="frame stack"><div class="eyebrow">Talk it through</div>
          <ol style="margin:0;padding-left:1.2em" class="stack">
            <li>Which move did you first read in modern terms? What changed when you saw the other side's reading?</li>
            <li>Would ${esc(ranked[0]?ranked[0].a.name:"the winner")} have recognized “winning” as a goal? What did success mean to the other courts?</li>
            <li>Which reason the table gave was best supported by a source? Which rule felt least supported?</li>
            <li>How did the courts in this world use the same tools differently?</li>
          </ol></div></div>
      <div class="stack">${side||""}<div class="log">${st.log.slice(0,10).map(e=>logEntry(d,e,{voices:play&&play.voices})).join("")}</div></div></div>`;
  }
  function topbar(d, st, extra){
    return `<div class="row" style="justify-content:space-between;margin-bottom:16px">
      <div class="stack" style="gap:8px"><div class="eyebrow">${esc(d.title)} · ${esc(d.era.label)}</div>${roundTrack(d,st)}</div>
      <div class="row">${extra||""}<button class="ghost" data-act="end-early">End and debrief</button><button class="ghost" data-act="quit">${play&&play.mode==="host"?"Close room":"Leave game"}</button></div></div>`;
  }
  function fbForm(designId){
    if(!designId) return `<div class="frame stack"><div class="eyebrow">Playtest notes</div><p class="small muted">Notes open once this world is approved for the class library.</p></div>`;
    return `<div class="frame stack"><div class="eyebrow">Leave a playtest note for the designer</div>
      <label class="f" for="fb-trap"><span>A modern assumption this game challenged for you</span><textarea id="fb-trap"></textarea></label>
      <label class="f" for="fb-text"><span>A rule that felt anachronistic or unsupported</span><textarea id="fb-text"></textarea></label>
      <div class="row"><button class="primary" data-act="send-fb" data-id="${esc(designId)}">Send note</button><span class="small muted" id="fbmsg"></span></div></div>`;
  }

  /* ---------- PLAY: chooser and pass-and-play ---------- */
  function findDesign(b){
    if(b.dataset.lib){ const g = lib.games.find(x=>x.id===b.dataset.lib); return g ? {d:upgradeDesign(clone(g.design)), libId:g.id} : null; }
    if(b.dataset.review){ const g = (instr.items||[]).find(x=>x.id===b.dataset.review); return g ? {d:upgradeDesign(clone(g.design)), libId:null} : null; }
    const g = drafts.find(x=>x.gid===b.dataset.gid); return g ? {d:upgradeDesign(clone(g)), libId:null} : null;
  }
  function renderPlay(){
    if(!play) return renderChooser();
    if(play.mode==="local") return renderLocal();
    return renderHost();
  }
  function renderChooser(){
    if(!lib.loaded){ lib.loaded = true; loadLibrary(); }
    const options = [...lib.games.map(g=>({d:g.design, lib:g.id, by:g.author, live:true})), ...drafts.map(d=>({d, lib:null, by:"your draft · test only", live:false}))];
    return resumeBanner() + `<div class="stack" style="margin-bottom:20px"><div class="ribbon">Play</div><h1 style="font-size:2.2rem">Host a game</h1>
      <p class="muted" style="max-width:66ch">Choose a world. Host a live game on the projector so students join with their phones (no sign-in, just a code and a nickname), or pass one device around the table. Drafts can be hosted as labeled test games.</p></div>
      <form class="frame stack" id="reopenform" style="margin-bottom:24px;max-width:640px"><div class="eyebrow">Reopen a live game</div><p class="small muted">Closed the host tab or restarted the laptop? Enter the game code and the host recovery key shown in the lobby.</p>
        <div class="row"><input id="ro-code" type="text" maxlength="6" placeholder="CODE" aria-label="Game code" style="max-width:9em;text-transform:uppercase"><input id="ro-key" type="text" maxlength="11" placeholder="Recovery key" aria-label="Recovery key" style="max-width:14em;text-transform:uppercase"><button type="submit">Reopen</button></div><span class="small" id="romsg" style="color:var(--danger)"></span></form>
      <div class="cards">${options.map(o=>`<article class="frame gcard"><div class="band"><span class="eyebrow">${esc(o.d.era.start)}${o.d.era.end!==""?"–"+esc(o.d.era.end):""}</span><span class="small muted">By ${esc(o.by)}</span></div>
        <div class="body"><h3>${esc(o.d.title)}</h3><div class="actions">
          <button class="primary" data-act="host" ${o.lib?`data-lib="${esc(o.lib)}"`:`data-gid="${esc(o.d.gid)}"`}>${o.live?"Host live game":"Host live test"}</button>
          <button data-act="local" ${o.lib?`data-lib="${esc(o.lib)}"`:`data-gid="${esc(o.d.gid)}"`}>Pass and play</button></div></div></article>`).join("")}</div>`;
  }
  function startLocal(found){
    play = {mode:"local", d:found.d, key:found.libId, phase:"setup", seats:found.d.actors.filter(a=>a.playable).map(a=>({id:a.id,on:false,player:""})), st:null, pick:null, target:"", why:"", src:"", players:{}, voices:{}, history:[], fillAi:true, npcs:[], aiPace:"auto"};
    saveLocal(); location.hash = "#play"; render();
  }
  function renderLocal(){
    const d = play.d;
    if(play.phase==="setup") return `<div class="stack" style="margin-bottom:18px"><div class="ribbon">Pass and play</div><h1 style="font-size:2.2rem">${esc(d.title)}</h1>${d.premise?`<p style="max-width:68ch;color:var(--muted)">${esc(d.premise)}</p>`:""}</div>
      <div class="table"><div class="stack"><div class="frame boardframe">${hexSvg(d,{})}</div>${boardList(d)}</div>
      <div class="frame stack"><div class="eyebrow">Who is at the table?</div>
        <p class="small" style="margin:0">Tick the court you will play. Playing alone? Tick one. Taking turns on one screen? Tick one court for each person.</p>
        <div class="seatlist">${play.seats.map((s,i)=>{ const a = actorById(d,s.id); return `<label><input type="checkbox" data-act="seat-on" data-i="${i}" ${s.on?"checked":""}>
          <span class="swatch" style="background:var(${colorOf(d,s.id)})"></span><span style="flex:1;min-width:0;font-weight:700">${esc(a.name)}</span>
          <input type="text" aria-label="Nickname for ${esc(a.name)}" data-act="seat-name" data-i="${i}" value="${esc(s.player)}" placeholder="Nickname (optional)"></label>`; }).join("")}</div>
        <label class="row small"><input type="checkbox" data-act="pp-ai" ${play.fillAi!==false?"checked":""}> AI plays every court nobody ticked</label>
        ${play.fillAi!==false?`<fieldset class="pace"><legend class="small"><b>Watching the AI courts</b></legend>
          <label class="row small"><input type="radio" name="aipace" data-act="pp-pace" value="auto" ${play.aiPace!=="step"?"checked":""}> Play on by itself, a few seconds per court (you can pause)</label>
          <label class="row small"><input type="radio" name="aipace" data-act="pp-pace" value="step" ${play.aiPace==="step"?"checked":""}> Wait for me to click Next after each AI move</label></fieldset>`:""}
        <p class="small muted">${play.fillAi!==false?"On an AI court's turn you see the moves it weighs, the one it picks and why. AI courts use simplified rule-based moves and are labeled as AI.":"Unticked courts stay on the board as actors others can target, and pass their turns."} This game is saved in this browser, so a refresh won't lose it.</p>
        <p class="small" id="seatmsg" aria-live="polite" style="margin:0;color:var(--danger)">${play.seats.some(s=>s.on)?"":"Tick at least one court to play."}</p>
        <div class="row"><button class="primary" data-act="begin" ${play.seats.some(s=>s.on)?"":"disabled"}>Begin round 1</button><button data-act="quit">Choose another world</button></div></div></div>`;
    const st = play.st;
    if(play.howto && !st.over) return `<div class="stack" style="margin-bottom:18px"><div class="ribbon">Pass and play · ${esc(d.title)}</div><h1 style="font-size:2.2rem">Before round 1</h1></div>
      <div class="table"><div class="stack">${howtoBox(d)}</div><div class="stack">${seatsBox(d, 1, roundInfo(d,1)?"Round 1 · "+roundInfo(d,1).year:"")}<div class="row"><button class="primary big" data-act="howto-ok">Start round 1</button></div></div></div>`;
    if(st.over) return debrief(d, st, newsEnd(play, d, st) + recordBox(play) + roundReview(play, d, st) + fbForm(play.key) + `<div class="row"><button data-act="quit">Close game</button></div>`);
    if(st.pause) return pauseScreen(play, d, st, st.pause, `<button class="ghost" data-act="end-early">End and debrief</button>`);
    const who = st.order[st.turn], A = actorById(d,who), isNpc = (play.npcs||[]).includes(who);
    const pick = d.actions.find(x=>x.id===play.pick);
    return topbar(d,st) + `<div class="table">
        <div class="stack"><div class="frame boardframe">${hexSvg(d,{route:st.route, current:who})}</div>${boardList(d)}<div class="frame"><div class="tablewrap">${ledger(d,st,who,new Set(play.npcs||[]))}</div></div></div>
        <div class="stack">
          <div class="frame stack">
            <div class="turnbar"><span class="swatch" style="background:var(${colorOf(d,who)});width:22px;height:22px"></span><span class="who">${esc(A.name)}</span>${isNpc?`<span class="pill ai">AI court</span>`:play.players[who]?`<span class="muted small">played by ${esc(play.players[who])}</span>`:""}</div>
            ${holderLine(d, st.round, who, true) || `<p class="small"><span class="muted">How this court sees the world:</span> ${esc(A.worldview)}</p>`}
            ${isNpc?npcPanel(d, st, who):`
            ${actionCards(d,st,who,play.pick,false)}
            ${pick?reasonForm(d,st,who,pick,play,false):""}
            ${passBox(play, false)}`}
          </div>
          <div class="log">${st.log.slice(0,8).map(e=>logEntry(d,e,{})).join("")}</div>
        </div></div>`;
  }

  /* ---------- LIVE: host (projector) ---------- */
  async function startHost(found){
    const r = await api.hostCreateRoom(found.libId ? {designId:found.libId} : {design:found.d});
    if(!r.ok){ alertBox(r.error); return; }
    store.set("tt.host", {roomId:r.roomId, code:r.code, recoveryKey:r.recoveryKey});
    openHost(r.roomId, r.code, r.recoveryKey);
  }
  function openHost(roomId, code, recoveryKey){
    stopLive();
    play = {mode:"host", roomId, code, recoveryKey, data:null, err:"", voices:{}, busy:false};
    location.hash = "#play";
    const refresh = async () => {
      const r = await api.getRoom({roomId});
      if(!play || play.roomId!==roomId) return;
      if(!r.ok){
        play.err = /not in this game/.test(r.error) ? "Hosting moved to another browser (the recovery key was used there). This screen no longer controls the game." : r.error;
        if(/ended|expired|not in this game/.test(r.error)){ store.set("tt.host", null); stopLive(); }
        softRender(); return;
      }
      play.err = ""; play.data = r; softRender(); maybeNpc();
    };
    unsubs.push(api.subscribeRoom(roomId, refresh));
    refresh(); render();
  }
  async function hostDo(action){
    if(!play || play.mode!=="host") return;
    play.busy = true; render();
    const r = await api.hostAction({roomId:play.roomId, action});
    play.busy = false;
    if(!r.ok) play.err = r.error;
    if(action==="close" && r.ok){ store.set("tt.host", null); stopLive(); play = null; render(); return; }
    const g = await api.getRoom({roomId:play.roomId}); if(g.ok) play.data = g;
    render(); maybeNpc();
  }
  function renderHost(){
    const p = play, data = p.data;
    if(!data) return `<div class="frame stack" style="max-width:640px"><div class="eyebrow">Live game ${esc(p.code)}</div><p>${p.err?esc(p.err):"Connecting…"}</p><div class="row"><button data-act="forget-host">Back to the game list</button></div></div>`;
    const d = data.design, room = data.room, st = room.state, teams = room.teams||{};
    const testTag = room.test ? `<span class="status pending">Test game · not yet approved</span>` : "";
    const errLine = p.err?`<p class="small" style="color:var(--danger)">${esc(p.err)}</p>`:"";
    if(room.phase==="lobby"){
      const playable = d.actors.filter(a=>a.playable);
      const joined = Object.values(teams).reduce((n,t)=>n+t.length,0), courts = Object.keys(teams).length;
      return `<div class="stack" style="margin-bottom:20px"><div class="row"><div class="ribbon">Live game · ${esc(d.era.label)}</div>${testTag}</div><h1 style="font-size:2.4rem">${esc(d.title)}</h1></div>
        <div class="lobby">
          <div class="frame stack" style="align-items:center;text-align:center">
            <div class="eyebrow">Scan to join</div>
            <div class="qrwrap"><div id="qr" role="img" aria-label="QR code that opens the join page for game ${esc(room.code)}"></div></div>
            <div class="code bigcode" aria-label="Game code ${esc(room.code.split("").join(" "))}">${esc(room.code)}</div>
            <div class="url">${esc(joinUrl(room.code))}</div>
            <p class="joinline">No sign-in needed. Open the link, enter the code and a nickname.</p>
            <button data-act="copy-link">Copy join link</button><span class="small muted" id="copymsg"></span>
            <p class="small">Host recovery key: <b>${esc(p.recoveryKey||"shown when the game was created")}</b></p>
            <p class="small muted">Write the recovery key down: with it and the code, the TA can reopen this game from any computer. The code expires 4 hours after the last move.</p>
          </div>
          <div class="stack">
            <div class="frame stack"><div class="row" style="justify-content:space-between"><div class="eyebrow">Courts and teams</div><span class="small muted">${joined} on courts · ${courts} of ${playable.length} courts have players</span></div>
              <div class="seats">${playable.map(a=>{ const t = teams[a.id]||[]; return `<div class="seat ${t.length?"taken":""}"><span class="swatch" style="background:var(${colorOf(d,a.id)});width:22px;height:22px"></span><div style="min-width:0"><b>${esc(a.name)} · ${t.length}</b><div class="teamnames">${t.length?esc(t.slice(0,8).join(", "))+(t.length>8?` and ${t.length-8} more`:""):room.fillAi?`No players yet · <span class="pill ai">AI will play it</span>`:"No players yet"}</div></div></div>`; }).join("")}</div>
              <p class="small muted">Students open the link, enter the code and a nickname, and join a court as a team. On a court's turn every member votes with a reason, and the most-voted action is played. ${room.fillAi?"Courts without players are played by AI, labeled as AI everywhere, so every court acts even with one student. Students joining after the start go to the human team with the fewest players.":"Courts without players stay on the board as targets and pass their turns."}</p>
              <label class="row small"><input type="checkbox" data-act="host-ai" ${room.fillAi?"checked":""} ${p.busy?"disabled":""}> Fill empty courts with AI players</label>
              <label class="row small"><input type="checkbox" role="switch" data-act="host-pausemode" ${room.pauseMode==="move"?"checked":""}> Pause for discussion after every move (default: after every round)</label>
              ${howtoBox(d)}${seatsBox(d, 1, roundInfo(d,1)?"Round 1 · "+roundInfo(d,1).year:"")}
              <div class="row"><button class="primary" data-act="host-start" ${courts&&!p.busy?"":"disabled"}>Start the game</button>
                <button data-act="host-balance" ${joined>1&&!p.busy?"":"disabled"}>Auto-balance players</button>
                <button class="ghost" data-act="host-close">Close room</button></div>
              <label class="row small"><input type="checkbox" role="switch" data-act="host-lockt" ${room.locked?"checked":""}> Lock room (nobody new can join)</label>
              ${courts?"":`<p class="small muted">At least one student must join a court before you can start.</p>`}
              ${room.locked?`<p class="small" style="color:var(--warn)">Room locked: nobody new can join.</p>`:""}${errLine}
            </div>
            ${playersPanel(d, room, data.players, false)}
            <div class="frame stack"><div class="eyebrow">The world</div><p>${esc(d.premise)}</p></div>
            ${readingList(d)}
          </div>
        </div>`;
    }
    if(room.phase==="over" || !st || st.over) return debrief(d, st || newState(d, []), (st?newsEnd(p, d, st):"") + recordBox(p) + (st?roundReview(p, d, st):"") + `<div class="frame stack"><div class="eyebrow">Playtest notes</div><p class="small muted">${room.gameKey?"Players can leave notes for the designer on their phones now.":"This was a test game, so notes are off until the game is approved."}</p><div class="row"><button data-act="host-close">Close room</button></div></div>`);
    if(st.pause) return pauseScreen(p, d, st, st.pause, errLine);
    return renderStage(p, data, d, room, st, teams, testTag, errLine);
  }
  /* ---------- projector stage (Phase 2): the board fills the screen ---------- */
  function renderStage(p, data, d, room, st, teams, testTag, errLine){
    stageOn = true;
    const who = st.order[st.turn], A = actorById(d,who);
    const pr = room.progress && room.progress.seq===st.seq ? room.progress : {voted:0, of:(teams[who]||[]).length};
    const ai = aiCourts(room), latest = st.log[0], dr = p.drawer || "";
    const btn = (k, label) => `<button class="ghost" data-act="drawer" data-d="${k}" aria-pressed="${dr===k}" aria-controls="drawer">${label}</button>`;
    const tracker = `<aside class="tracker frame" aria-label="Turn tracker">
        <div class="eyebrow">Now choosing</div>
        <div class="turnbar"><span class="swatch" style="background:var(${colorOf(d,who)});width:20px;height:20px"></span><span class="who">${esc(A.name)}</span>${pr.npc?`<span class="pill ai">AI</span>`:""}</div>
        ${holderLine(d, st.round, who, false)}
        ${pr.npc?`<p class="small" aria-live="polite">${esc(A.name)} is deliberating…</p>`:`
        <div class="progress" aria-hidden="true"><i style="width:${pr.of?Math.round(100*pr.voted/pr.of):0}%"></i></div>
        <p class="small" aria-live="polite"><b>${pr.voted} of ${pr.of}</b> voted</p>
        <button class="primary" data-act="host-reveal" ${pr.voted&&!p.busy?"":"disabled"}>Reveal now</button>`}
        <details class="trackmore" data-keep="trackOpen" ${p.trackOpen?"open":""}><summary class="small">More</summary>
          <div class="stack" style="gap:8px;margin-top:8px">
            <button class="ghost" data-act="host-skip" ${p.busy?"disabled":""}>Skip this turn</button>
            <label class="row small"><input type="checkbox" data-act="host-slow" ${hostSlow()?"checked":""}> Slow down AI turns</label>
            <label class="row small"><input type="checkbox" role="switch" data-act="host-pausemode" ${room.pauseMode==="move"?"checked":""}> Pause after every move</label>
          </div></details>
        ${p.aiNote?`<div class="note small">${esc(p.aiNote)} <button class="ghost" data-act="host-note-ok">OK</button></div>`:""}
        ${errLine}
        ${noticeLine(d)}
      </aside>`;
    const controls = `<nav class="stagectl" aria-label="Host controls">
        <span class="pill info">Code ${esc(room.code)}</span>
        ${btn("score","Scoreboard")}${btn("moves","Moves")}${btn("players","Players")}${btn("menu","Menu")}
        <button class="ghost" data-act="fullscreen">Full screen</button>
      </nav>`;
    const timeline = `<header class="stagebar"><div class="timeline">
        <div class="eyebrow">${esc(d.title)} · ${esc(d.era.label)} ${testTag}</div>
        ${roundTrack(d,st)}
        <ol class="courts" aria-label="Turn order">${st.order.map(id=>{ const X = actorById(d,id), on = id===who;
          return `<li class="ctok ${on?"on":""}" ${on?'aria-current="step"':""}><span class="disc" style="background:var(${colorOf(d,id)})" aria-hidden="true">${esc(initials(X.name))}</span><span class="nm">${esc(X.name)}</span>${ai.has(id)?`<span class="pill ai">AI</span>`:""}</li>`; }).join("")}</ol>
      </div></header>`;
    const drawers = {
      score: () => `<div class="eyebrow">Scoreboard</div><div class="tablewrap">${ledger(d,st,who,ai)}</div>`,
      moves: () => `<div class="eyebrow">Earlier moves</div><div class="log">${st.log.slice(1,12).map(e=>logEntry(d,e,{})).join("")||`<p class="small muted">No earlier moves yet.</p>`}</div>`,
      players: () => playersPanel(d, room, data.players, true, true) || `<p class="small muted">No players have joined.</p>`,
      menu: () => `<div class="eyebrow">Game</div>
        <p class="small">Code <b>${esc(room.code)}</b> · ${esc(joinUrl(room.code))}</p>
        <p class="small">Host recovery key: <b>${esc(p.recoveryKey||"")}</b></p>
        <label class="row small"><input type="checkbox" role="switch" data-act="host-lockt" ${room.locked?"checked":""}> Lock room (nobody new can join)</label>
        ${boardList(d)}
        <div class="row"><button class="ghost" data-act="end-early">End and debrief</button><button class="ghost danger" data-act="quit">Close room</button></div>`,
    };
    const drawer = drawers[dr] ? `<div class="drawer frame stack" id="drawer" role="region" aria-label="${esc(dr)}">${drawers[dr]()}<div><button class="ghost" data-act="drawer" data-d="">Close</button></div></div>` : "";
    return `<div class="stagewrap">${timeline}${controls}${tracker}${drawer}
      <section class="stageboard" aria-label="Board">${hexSvg(d,{route:st.route, current:who})}</section>
      <section class="revealstrip" aria-live="polite">${latest?stageReveal(d,latest,p):openingOf(d)&&ownOpening(d)?openingMini(d):`<div class="plain"><p class="muted">The first move will be revealed here.</p></div>`}</section>
    </div>`;
  }
  /* The latest move under the board. When it targets another court, the target's reading comes first, then the
     actor's, side by side, using the per-court readings. */
  function stageReveal(d, e, p){
    if(e.kind!=="action") return logEntry(d, e, {big:true});
    const a = d.actions.find(x=>x.id===e.action)||{}, A = actorById(d,e.who)||{}, T = e.target?actorById(d,e.target):null, src = d.sources.find(s=>s.id===a.source);
    const v = (p.voices||{})[e.id] || {};
    const box = (X) => `<div><b>As ${esc(X.name)} read it</b>${esc(readingOf(a,X.id,e.who)||"(no reading written)")}</div>`;
    return `<article class="frame entry reveal stagereveal">
      <div class="row" style="justify-content:space-between"><div class="yr">Round ${e.round}${e.year!==""?(isNews(d)?" · ":" · c. ")+e.year:""}</div>${e.npc?aiTag(d,e.who,e.npc):""}</div>
      <h4>${esc(A.name)}: ${esc(a.name)}${T?` → ${esc(T.name)}`:""}</h4>
      ${e.failed?`<p style="color:var(--danger);font-weight:700">It backfires. ${esc(a.risk&&a.risk.text)}</p><p class="small muted" style="margin:0">A game roll against the designer's ${esc(a.risk&&a.risk.chance)}% risk: a modeling choice, not a historical finding.</p>`:""}
      ${claimLine(a)}<div class="readings ${T?"":"one"}">${T?box(T):""}${box(A)}</div>
      ${whyBlock(d,e)}
      ${a.trap?`<p class="trapline">Modern assumption to set aside: ${esc(a.trap)}</p>`:""}
      <p class="cite">${src?`Source: ${esc(shortCite(src))}${a.page?", "+esc(a.page):""}`:`<span style="color:var(--danger)">No source cited for this rule.</span>`}</p>
      ${aiOn()?`<div class="row"><select aria-label="Perspective" data-act="voice-who" data-id="${e.id}" style="width:auto">${d.actors.map(x=>`<option value="${esc(x.id)}" ${(v.who||e.target||e.who)===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select>
        <button class="ghost" data-act="voice" data-id="${e.id}" ${v.busy?"disabled":""}>${v.busy?"Thinking…":"AI suggestion: how might this court read the move?"}</button></div>
      ${v.text?`<div class="voice"><span class="pill warn">Generative AI suggestion, not from the readings</span>\n${esc(v.text)}</div>`:""}${v.err?`<p class="small muted">${esc(v.err)}</p>`:""}`:""}
    </article>`;
  }
  /* ---------- contemporary demo: seats held by real people, round by round ---------- */
  /* Everything here returns "" for a design without per-round settings, so the historical games are unchanged. */
  const isNews = d => Array.isArray(d.rounds) && d.rounds.length > 0;
  const lab = (d, k, dflt) => (d.labels && d.labels[k]) || dflt;
  function noticeLine(d){ return d.notice ? `<p class="simnote small" role="note">${esc(d.notice)}</p>` : ""; }
  function srcItem(d, id){
    const s = d.sources.find(x=>x.id===id); if(!s) return "";
    const tags = (s.state?`<span class="pill warn">State media</span>`:"") + (s.blog?`<span class="pill blog">Posted to the EALC 1711 news blog</span>`:"") + (s.type==="secondary"?`<span class="pill">Later reporting</span>`:"");
    return `<li>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.citation)}</a>`:esc(s.citation)} ${tags}${s.via?`<div class="small muted">${esc(s.via)}</div>`:""}${s.note?`<div class="small muted">${esc(s.note)}</div>`:""}</li>`;
  }
  function sourcesPanel(d, round){
    const r = roundInfo(d, round); if(!r) return "";
    const ev = eventForRound(d, round), ids = roundSourceIds(d, round, ev ? (ev.sources || [ev.source]) : []);
    return `<details class="frame srcpanel"><summary><b>Sources for ${r.year}</b> <span class="small muted">· what this round's seats and event are built from</span></summary>
      <div class="stack" style="margin-top:10px">
        ${ids.scene.length?`<div><div class="eyebrow">Setting the scene</div><ul class="srclist">${ids.scene.map(id=>srcItem(d,id)).join("")}</ul></div>`:""}
        ${d.actors.filter(a=>ids.seats[a.id]).map(a=>`<div><div class="eyebrow">${esc(seatLabel(d,round,a.id))}</div><ul class="srclist">${ids.seats[a.id].map(id=>srcItem(d,id)).join("")}</ul></div>`).join("")}
        ${ids.event.length?`<div><div class="eyebrow">The event that closes the round</div><ul class="srclist">${ids.event.map(id=>srcItem(d,id)).join("")}</ul></div>`:""}
        <p class="small muted">State media show how a government frames an issue; each is paired with independent reporting. The seats paraphrase this reporting: nothing here is a quotation of the people depicted.</p>
      </div></details>`;
  }
  function glossBox(d, round){
    const g = glossaryFor(d, round);
    return g.length ? `<div class="gloss"><div class="eyebrow">Terms in this round</div><dl>${g.map(x=>`<div><dt>${esc(x.term)}</dt><dd>${esc(x.text)}</dd></div>`).join("")}</dl></div>` : "";
  }
  /* The start of a round: its year and scene, who holds each seat, who is new and why it matters, new terms. */
  function seatsBox(d, round, title){
    const r = roundInfo(d, round); if(!r) return "";
    const ch = seatChanges(d, round);
    return `<section class="frame stack roundintro"><div class="eyebrow">${esc(title || ("Round "+round+" · "+r.year))}</div><p>${esc(r.scene)}</p>
      <ul class="holders">${d.actors.filter(a=>r.holders[a.id]).map(a=>{ const h = r.holders[a.id]; return `<li><span class="swatch" style="background:var(${colorOf(d,a.id)})"></span><span><b>${esc(a.name)}</b>: ${esc(h.name)}<span class="small muted">, ${esc(h.title)}</span></span></li>`; }).join("")}</ul>
      ${ch.length?`<div class="stack seatchg" style="gap:6px"><b>${round===1?"New in office this year":"Seats that changed hands"}</b>${ch.map(c=>`<p class="small"><b>${esc(actorById(d,c.actor).name)}:</b> ${esc(c.holder.changed)}</p>`).join("")}</div>`:""}
      ${glossBox(d, round)}</section>`;
  }
  /* After a round: the game resets to history. Each seat's move in the game beside what the real holder did. */
  function realBox(d, round, rows){
    const r = roundInfo(d, round), list = realVsChosen(d, round, rows || []);
    if(!r || !list.length) return "";
    return `<section class="frame stack"><div class="eyebrow">What really happened in ${r.year}</div>
      <p class="small muted">The story resets to what actually happened before the next round. Resources carry over.</p>
      <ul class="realvs">${list.map(x=>`<li><b>${esc(seatLabel(d,round,x.actor))}</b><div class="small muted">In this game${x.npc?" (AI)":""}: ${esc(x.chose || "this seat was not played")}</div><div>${esc(x.did)}</div></li>`).join("")}</ul></section>`;
  }
  function newsEnd(box, d, st){
    if(!isNews(d)) return "";
    const n = Math.max(1, Math.min(st.round, Number(d.victory.rounds)||st.round)), sum = roundFor(box, n, "end");
    return outroBox(d) + (sum && sum.turns ? realBox(d, n, sum.turns) : "") + sourcesPanel(d, n);
  }
  function howtoBox(d){
    if(!Array.isArray(d.howto) || !d.howto.length) return "";
    return `<section class="frame stack howto"><div class="eyebrow">How this game works</div><ol class="stack" style="gap:6px;margin:0;padding-left:1.2em">${d.howto.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>${noticeLine(d)}</section>`;
  }
  function outroBox(d){
    return d.outro ? `<section class="frame stack outro"><div class="eyebrow">How the historical version differs</div><p>${esc(d.outro)}</p></section>` : "";
  }
  /* Who sits in a seat this round, for the turn screens. */
  function holderLine(d, round, who, withPersona){
    const h = holderOf(d, round, who); if(!h) return "";
    return `<p class="small holderline"><b>${esc(h.name)}</b>, ${esc(h.title)}${withPersona?`<br><span class="muted">What the reporting shows:</span> ${esc(h.persona)}`:""}</p>`;
  }
  /* ---------- pause and debrief (Phase 4) ---------- */
  /* One round's record. Live games ask the server (the host's copy carries TA tags and notes; phones never get
     them); pass and play reads its own record. Cached per pause so a re-render doesn't refetch. */
  function roundFor(box, round, ver){
    if(box.mode==="local") return roundSummary(box.d, box.history||[], round);
    const key = round+":"+ver; box.rounds = box.rounds || {};
    if(box.rounds[key]===undefined){ box.rounds[key] = null;
      api.getRound({roomId:box.roomId, round}).then(r=>{ if(box.rounds) { box.rounds[key] = r.ok ? r.summary : {error:r.error}; softRender(); } }); }
    return box.rounds[key];
  }
  function cachedRow(box, seq){
    if(box.mode==="local") return (box.history||[]).find(r=>r.seq===seq && r.kind==="action");
    for(const s of Object.values(box.rounds||{})) if(s && s.turns){ const r = s.turns.find(x=>x.seq===seq && x.kind==="action"); if(r) return r; }
    return null;
  }
  const TAG_LABEL = Object.fromEntries(TA_TAGS.map(t=>[t.key, t.label]));
  /* One turn in the round summary: who did what to whom, then every reason given, labeled student or AI. */
  function turnBlock(d, r, o){
    const A = actorById(d,r.actor)||{}, a = d.actions.find(x=>x.id===r.action)||{name:r.action}, T = r.target?actorById(d,r.target):null;
    const ai = r.npc?` <span class="pill ai">AI court</span>`:"";
    const head = r.kind==="pass" ? `<b>${esc(A.name||"")} passed</b>${ai}` : `<b>${esc(A.name||"")}: ${esc(a.name)}${T?" → "+esc(T.name):""}</b>${ai}${r.failed?` <span style="color:var(--danger)">It backfired.</span>`:""}`;
    const prompts = o.prompts ? facilitatorPrompts(d, r) : [];
    const tags = r.tags || {};
    const items = r.ballots.map((b,i)=>{
      const label = b.npc ? `<span class="pill ai">AI reasoning</span>` : `<b>${esc(b.name||"A student")}</b> <span class="muted">· student</span>`;
      if(b.pass && !b.why) return `<li>${label} <span class="muted">voted to pass</span></li>`;
      const va = d.actions.find(x=>x.id===b.action), vt = b.target?actorById(d,b.target):null, src = b.src ? d.sources.find(s=>s.id===b.src) : null;
      const choice = b.pass ? "pass" : (va?va.name:b.action)+(vt?" → "+vt.name:"");
      const tag = tags["b"+i];
      return `<li class="stack" style="gap:4px">
        <div>${label} <span class="muted">chose ${esc(choice)}</span>${o.evidence&&!b.npc&&r.kind==="action"?evPill(evidenceStatus(r,i)):""}${tag&&o.tags?` <span class="pill tag-${esc(tag)}">${esc(TAG_LABEL[tag]||tag)}</span>`:""}</div>
        ${b.why?`<div>“${esc(b.why)}”</div>`:""}
        <div class="small muted">${src?`Source: ${esc(shortCite(src))}`:b.npc?"No source cited":"No source"}${b.loc?` · ${esc(b.loc)}`:""}</div>
        ${b.quote?`<blockquote class="small">“${esc(b.quote)}”</blockquote>`:""}
        ${prompts.filter(p=>p.ballot===i).map(p=>`<p class="prompt small">${esc(p.text)}</p>`).join("")}
        ${o.tags && r.kind==="action" ? `<div class="row tagrow" role="group" aria-label="TA tag for this reason">${TA_TAGS.map(t=>`<button class="ghost small" data-act="ta-tag" data-seq="${r.seq}" data-b="${i}" data-tag="${t.key}" aria-pressed="${tag===t.key}">${esc(t.label)}</button>`).join("")}</div>` : ""}
      </li>`; }).join("");
    const rest = prompts.filter(p=>p.ballot==null).map(p=>`<p class="prompt small">${esc(p.text)}</p>`).join("");
    const audits = (r.audits||[]).map(x=>`<div class="audit small"><b>${esc(x.name||"A student")}</b> <span class="muted">· student audit of this AI move</span><div>“${esc(x.text)}”</div></div>`).join("");
    return `<li class="turn stack" style="gap:6px">${head}${items?`<ul class="ballots">${items}</ul>`:""}${audits}${rest}</li>`;
  }
  const evPill = st => `<span class="pill ev ev-${st}">${esc(EVIDENCE_LABEL[st])}</span>`;
  /* The body shared by the TA's pause, the phones' pause, pass and play, and the end-of-game round review.
     No ranking or winner here: the scoreboard waits for the final debrief. */
  function roundBody(d, sum, o){
    if(!sum) return `<div class="frame"><p class="muted">Loading the round…</p></div>`;
    if(sum.error) return `<div class="frame"><p style="color:var(--danger)">${esc(sum.error)}</p></div>`;
    const ev = sum.event && sum.event.event;
    return `<section class="frame stack" aria-label="What happened in round ${sum.round}"><div class="eyebrow">Round ${sum.round}: every move and every reason</div>
        ${sum.turns.length?`<ol class="turns">${sum.turns.map(r=>turnBlock(d, r, o)).join("")}</ol>`:`<p class="small muted">No moves recorded yet.</p>`}</section>
      ${ev?`<section class="frame stack"><div class="eyebrow">End of round ${sum.round} · event${ev.date?" · "+esc(ev.date):ev.year!==""?" · "+esc(ev.year):""}</div><b>${esc(ev.title)}</b><p>${esc(ev.text||"")}</p></section>`:""}`;
  }
  function trapsBox(d){
    const t = d.traps.filter(x=>x.modern);
    return t.length ? `<section class="frame stack"><div class="eyebrow">${esc(lab(d,"traps","Anachronism traps to watch for"))}</div>${t.map(x=>`<div class="readings"><div><b>${esc(lab(d,"assume","Modern assumption"))}</b>${esc(x.modern)}</div><div><b>${esc(lab(d,"shows","What the era shows"))}</b>${esc(x.historical)}</div></div>`).join("")}</section>` : "";
  }
  function talkBox(round){
    return `<section class="frame stack"><div class="eyebrow">Talk it through</div><ol class="stack" style="margin:0;padding-left:1.2em">${talkItThrough(round).map(q=>`<li>${esc(q)}</li>`).join("")}</ol></section>`;
  }
  function timerText(t){ if(!t) return ""; const s = Math.max(0, Math.round((t.end-Date.now())/1000)); return s ? `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")} left` : "Time is up. Continue when the discussion is done."; }
  /* Facilitator panel: hidden until the TA opens it. Tags and notes stay with the host; "show to class" sends
     only the discussion prompts to students' phones. */
  function facPanel(box, sum, o){
    const round = sum && !sum.error ? sum.round : null;
    const draft = box.noteDraft && round!=null && box.noteDraft[round]!=null ? box.noteDraft[round] : (sum && sum.note) || "";
    return `<section class="frame stack facpanel" aria-label="Facilitator panel"><div class="row" style="justify-content:space-between"><div class="eyebrow">Facilitator panel</div><button class="ghost small" data-act="fac-toggle" aria-expanded="true">Hide</button></div>
      <p class="small muted">Prompts and tag buttons now appear under each reason in the round. Tags and notes go into the TA record and are never shown on phones.</p>
      ${o.share!==undefined?`<label class="row small"><input type="checkbox" role="switch" data-act="host-share" ${o.share?"checked":""}> Show the prompts to the class (on phones)</label>`:""}
      ${round!=null?`<label class="f" for="ta-note"><span>Note on round ${round}</span><textarea id="ta-note" data-round="${round}" maxlength="2000" rows="3">${esc(draft)}</textarea></label>
      <div class="row"><button data-act="ta-note-save" data-round="${round}">Save note</button><span class="small muted" id="notemsg" aria-live="polite">${esc(box.noteMsg||"")}</span></div>`:""}
    </section>${o.record===false?"":recordBox(box)}`;
  }
  /* The TA's pause screen (live host or pass and play). */
  /* ---------- the opening scene: where the world stands before anyone moves ---------- */
  const ownOpening = d => !!(d.opening && String(d.opening.title||"").trim() && String(d.opening.text||"").trim());
  function openingCite(d, o){
    const ids = (o.sources && o.sources.length ? o.sources : [o.source]).filter(Boolean);
    const list = ids.map(id=>d.sources.find(s=>s.id===id)).filter(Boolean);
    return list.length ? `<p class="cite">Source${list.length>1?"s":""}: ${list.map(s=>esc(shortCite(s))).join("; ")}</p>` : "";
  }
  /* opts.courts: every court's stance (projector); opts.mine: this phone's court. */
  function openingBox(d, opts={}){
    const o = openingOf(d); if(!o) return "";
    if(!ownOpening(d)) return seatsBox(d, 1, "Where things stand · round 1"+(roundInfo(d,1)?" · "+roundInfo(d,1).year:""));
    const when = o.date || (o.year!==""?(isNews(d)?"":"c. ")+o.year:"");
    const mine = opts.mine ? actorById(d, opts.mine) : null;
    const courts = opts.courts ? d.actors.filter(a=>a.playable && (!opts.order || opts.order.includes(a.id))) : [];
    return `<section class="frame stack opening" aria-label="Opening scene">
      <div class="eyebrow">Where the game begins${when?" · "+esc(when):""}</div>
      <h2 class="opentitle">${esc(o.title)}</h2>
      <p class="opentext">${esc(o.text)}</p>
      ${o.ask?`<p class="openask"><b>For every court:</b> ${esc(o.ask)}</p>`:""}
      ${openingCite(d, o)}
      ${mine?`<div class="openmine"><div class="eyebrow">Your court: ${esc(mine.name)}</div><p>${esc(mine.worldview)}</p>${mine.goal?`<p class="small"><span class="muted">What counts as success:</span> ${esc(mine.goal)}</p>`:""}</div>`:""}
      ${courts.length?`<div class="stack" style="gap:8px"><div class="eyebrow">Where each court stands</div><ul class="openstances">${courts.map(a=>`<li><span class="swatch" style="background:var(${colorOf(d,a.id)})"></span><span><b>${esc(a.name)}</b> <span class="small">${esc(a.worldview)}</span></span></li>`).join("")}</ul></div>`:""}
    </section>`;
  }
  function openingMini(d){ const o = openingOf(d);
    return `<article class="plain entry opening mini"><div class="yr">Where the game begins${o.date||o.year!==""?" · "+esc(o.date||(isNews(d)?"":"c. ")+o.year):""}</div><h4>${esc(o.title)}</h4><p>${esc(o.text)}</p>${o.ask?`<p class="openask small"><b>For every court:</b> ${esc(o.ask)}</p>`:""}<p class="small muted">The first move will be revealed here.</p></article>`; }
  /* The projector (or the pass-and-play table) after Start: the opening scene, then the TA begins round 1. */
  function openingScreen(box, d, st, extraCtl){
    const live = box.mode==="host", o = openingOf(d), first = actorById(d, st.order[0]) || {};
    return `<div class="stack" style="margin-bottom:18px"><div class="ribbon">${esc(d.title)}</div><h1 style="font-size:2.2rem">Before round 1</h1>
        <p class="muted" style="max-width:68ch">${live?"Read the opening aloud or give the class a minute with it. Phones show the same scene.":"Read the opening together."} No one moves until you begin round 1.</p></div>
      <div class="table pause">
        <div class="stack">${openingBox(d, {courts:true, order:st.order})}</div>
        <div class="stack">
          <section class="frame stack pausectl" aria-label="Start controls">
            <button class="primary big" data-act="${live?"host-continue":"local-continue"}" ${box.busy?"disabled":""}>Begin round 1</button>
            <p class="small muted">${esc(first.name||"The first court")} moves first.${o&&o.ask?" Start the discussion with the question under the scene.":""}</p>
            <div class="row small" role="group" aria-label="Discussion timer"><span class="muted">Discussion timer:</span>${[1,2,3].map(m=>`<button class="ghost small" data-act="ptimer" data-m="${m}">${m} min</button>`).join("")}${box.timer?`<button class="ghost small" data-act="ptimer" data-m="0">Stop</button>`:""}</div>
            ${box.timer?`<p class="timer" id="ptimer">${esc(timerText(box.timer))}</p>`:""}
            ${extraCtl||""}
          </section>
          ${readingList(d)}
          ${trapsBox(d)}
          ${noticeLine(d)}
        </div>
      </div>`;
  }
  function pauseScreen(box, d, st, pause, extraCtl){
    if(pause.kind==="opening") return openingScreen(box, d, st, extraCtl);
    const sum = roundFor(box, pause.round, pause.seq), fac = !!box.facOpen;
    const A = pause.kind==="move" && sum && sum.turns && sum.turns.length ? actorById(d, sum.turns[sum.turns.length-1].actor) : null;
    const title = pause.kind==="move" ? `Paused after ${A?esc(A.name)+"'s":"a"} move · round ${pause.round}` : `Round ${pause.round} is over`;
    const nextLabel = pause.kind==="move" ? "Continue" : `Continue to round ${pause.round+1}`;
    const live = box.mode==="host", mode = live ? box.data.room.pauseMode : (box.pauseMode||"round");
    return `<div class="stack" style="margin-bottom:18px"><div class="ribbon">Pause and debrief · ${esc(d.title)}</div><h1 style="font-size:2.2rem">${title}</h1>
        <p class="muted" style="max-width:68ch">The game is waiting for you. Talk through the round, then continue. Nothing moves on by itself.</p></div>
      <div class="table pause">
        <div class="stack">${talkBox(pause.round)}${roundBody(d, sum, {prompts:fac, tags:fac, evidence:true})}${pause.kind==="round"&&sum&&sum.turns?realBox(d, pause.round, sum.turns):""}${pause.kind==="round"?seatsBox(d, pause.round+1, roundInfo(d,pause.round+1)?"Next: round "+(pause.round+1)+" · "+roundInfo(d,pause.round+1).year:""):""}</div>
        <div class="stack">
          <section class="frame stack pausectl" aria-label="Pause controls">
            <button class="primary big" data-act="${live?"host-continue":"local-continue"}" ${box.busy?"disabled":""}>${nextLabel}</button>
            <div class="row small" role="group" aria-label="Discussion timer"><span class="muted">Discussion timer:</span>${[2,3,5].map(m=>`<button class="ghost small" data-act="ptimer" data-m="${m}">${m} min</button>`).join("")}${box.timer?`<button class="ghost small" data-act="ptimer" data-m="0">Stop</button>`:""}</div>
            ${box.timer?`<p class="timer" id="ptimer">${esc(timerText(box.timer))}</p>`:""}
            <p class="small muted">The timer is a guide only. It never moves the game on.</p>
            <label class="row small"><input type="checkbox" role="switch" data-act="${live?"host-pausemode":"pp-pausemode"}" ${mode==="move"?"checked":""}> Pause after every move (instead of every round)</label>
            ${fac?"":`<button class="ghost" data-act="fac-toggle" aria-expanded="false">Open facilitator panel</button>`}
            ${extraCtl||""}
          </section>
          ${fac?facPanel(box, sum, live?{share:!!pause.share}:{}):""}
          ${sourcesPanel(d, pause.round)}
          ${trapsBox(d)}
          ${noticeLine(d)}
        </div>
      </div>`;
  }
  /* End of game: the same round view, one round at a time, with the facilitator panel. */
  function roundReview(box, d, st){
    const n = Math.max(1, Math.min(st.round, Number(d.victory.rounds)||st.round));
    const r = box.reviewRound;
    const sum = r ? roundFor(box, r, "final"+(box.reviewVer||0)) : null, fac = !!box.facOpen;
    return `<section class="frame stack" aria-label="Review a round"><div class="row" style="justify-content:space-between"><div class="eyebrow">Review a round</div>${r?`<button class="ghost small" data-act="fac-toggle" aria-expanded="${fac}">${fac?"Hide facilitator panel":"Open facilitator panel"}</button>`:""}</div>
      <div class="row" role="group" aria-label="Rounds">${Array.from({length:n},(_,i)=>`<button class="ghost" data-act="review-round" data-r="${i+1}" aria-pressed="${r===i+1}">Round ${i+1}</button>`).join("")}</div></section>
      ${r?roundBody(d, sum, {prompts:fac, tags:fac, evidence:true}) + (fac?facPanel(box, sum, {record:false}):""):""}`;
  }
  /* Phones while the TA has paused: the same round, without tags or notes; prompts only when the TA shares them. */
  function phonePause(d, room, header){
    const p = room.state.pause;
    if(p.kind==="opening"){ const seat = join.data && join.data.seat;
      return `<div class="ph">${header}<div class="frame waiting"><div class="eyebrow">The game has started</div><div class="big" style="margin-top:8px">Before round 1</div><p class="muted" style="margin-top:8px">Read where things stand. Your TA begins round 1 when the class is ready.</p></div>
        ${openingBox(d, {mine: seat && seat.actor})}${readingList(d)}</div>`; }
    const sum = roundFor(join, p.round, p.seq);
    return `<div class="ph">${header}
      <div class="frame waiting"><div class="eyebrow">Paused for discussion</div><div class="big" style="margin-top:8px">${p.kind==="move"?"The TA paused after this move":`Round ${p.round} is over`}</div><p class="muted" style="margin-top:8px">Look back at the round with your class. Your TA continues the game when you're ready.</p></div>
      ${talkBox(p.round)}${roundBody(d, sum, {prompts:!!p.share, tags:false})}${p.kind==="round"&&sum&&sum.turns?realBox(d, p.round, sum.turns):""}${p.kind==="round"&&roundInfo(d,p.round+1)?seatsBox(d, p.round+1, "Next: round "+(p.round+1)+" · "+roundInfo(d,p.round+1).year):""}${sourcesPanel(d, p.round)}${trapsBox(d)}${noticeLine(d)}</div>`;
  }
  async function saveTag(seq, ballot, tag){
    const box = play; if(!box) return;
    const row = cachedRow(box, seq), cur = row && row.tags ? row.tags["b"+ballot] : null, next = cur===tag ? null : tag;
    box.tagVer = (box.tagVer||0) + 1;
    if(box.mode==="local"){ if(row){ row.tags = {...(row.tags||{})}; if(next) row.tags["b"+ballot] = next; else delete row.tags["b"+ballot]; saveLocal(); } render(); return; }
    const r = await api.hostTag({roomId:box.roomId, seq, ballot, tag:next});
    if(!r.ok){ box.err = r.error; render(); return; }
    if(row){ row.tags = {...(row.tags||{})}; if(next) row.tags["b"+ballot] = next; else delete row.tags["b"+ballot]; }
    render();
  }
  async function saveNote(round){
    const box = play; if(!box) return;
    const el = $("#ta-note"), note = el ? el.value.slice(0,2000) : ((box.noteDraft||{})[round]||"");
    if(box.mode==="local"){
      box.history = (box.history||[]).filter(r=>!(r.kind==="note" && r.round===round));
      box.history.push({seq:-round, kind:"note", round, turn:0, year:"", actor:"", target:"", action:"", failed:false, npc:false, resolvedBy:"local", ballots:[], readings:{}, event:null, at:new Date().toISOString(), note});
      box.noteMsg = "Saved."; saveLocal(); render(); return;
    }
    box.noteMsg = "Saving…"; render();
    const r = await api.hostNote({roomId:box.roomId, round, note});
    box.noteMsg = r.ok ? "Saved." : r.error;
    if(r.ok) for(const s of Object.values(box.rounds||{})) if(s && s.round===round) s.note = note;
    render();
  }
  /* ---------- TA record (Phase 6) ---------- */
  /* Download the transcript so far. Only on the TA's screens (host and pass and play), never on phones. */
  /* Phase 1: student reasons the TA hasn't checked stay in view here and in the record. Play never waits on them. */
  function openRows(box){
    if(box.mode==="local") return box.history||[];
    const st = box.data && box.data.room && box.data.room.state, key = (box.tagVer||0)+":"+(st?st.seq:0)+":"+(st&&st.over?1:0);
    if(box.openKey!==key){ box.openKey = key; box.openList = box.openList || null;
      api.getHistory({roomId:box.roomId}).then(r=>{ if(play===box && box.openKey===key){ box.openList = r.ok ? r.rows : []; softRender(); } }); }
    return box.openList;
  }
  function openBox(box){
    const rows = openRows(box); if(!rows) return `<p class="small muted">Counting the reasons not yet checked…</p>`;
    const list = openReasonList(rows), asked = list.filter(x=>x.status==="asked").length, un = list.length - asked;
    if(!list.length) return `<p class="small">Every student reason so far has a TA tag.</p>`;
    return `<div class="openreasons stack" style="gap:4px"><b class="small">Reasons not yet checked: ${un}${asked?` · TA asked for a check: ${asked}`:""}</b>
      <p class="small muted" style="margin:0">Play didn't wait for these. Tag them in "Review a round", or check them in class.</p>
      <ul class="small" style="margin:0;padding-left:1.2em">${list.slice(0,40).map(x=>`<li>Round ${x.round} · <b>${esc(x.name)}</b>: “${esc(x.why)}” ${evPill(x.status)}</li>`).join("")}</ul>${list.length>40?`<p class="small muted" style="margin:0">…and ${list.length-40} more in the downloaded record.</p>`:""}</div>`;
  }
  function recordBox(box){
    return `<section class="frame stack recordbox" aria-label="TA record"><div class="eyebrow">TA record</div>
      ${openBox(box)}
      <p class="small"><b>Not auto-graded.</b> ${esc(NOT_GRADED.replace(/^This game is not auto-graded\. /,""))}</p>
      <p class="small muted">Download every move and reason so far, round by round: each court's reasoning, the cited source, location and any quote, with your tags and round notes. Nicknames only.</p>
      <div class="row"><button data-act="rec-dl" data-fmt="md">Download record (Markdown)</button><button data-act="rec-dl" data-fmt="csv">Download record (CSV)</button><span class="small muted" id="recmsg" aria-live="polite">${esc(box.recMsg||"")}</span></div></section>`;
  }
  function saveFile(name, text, type){
    const url = URL.createObjectURL(new Blob([text], {type}));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  }
  async function downloadRecord(fmt){
    const box = play; if(!box) return;
    let d, rows, code = "";
    if(box.mode==="local"){ d = box.d; rows = box.history||[]; }
    else {
      d = box.data && box.data.design; code = box.code || (box.data && box.data.room.code) || "";
      box.recMsg = "Preparing…"; softRender();
      const r = await api.getHistory({roomId:box.roomId});
      if(!r.ok){ box.recMsg = r.error; render(); return; }
      rows = r.rows;
    }
    if(!d){ box.recMsg = "No game loaded."; render(); return; }
    const meta = {code, date:new Date().toISOString().slice(0,10)};
    if(fmt==="csv") saveFile(recordFileName(d,"csv",meta), String.fromCharCode(0xfeff)+transcriptCsv(d, rows), "text/csv;charset=utf-8");
    else saveFile(recordFileName(d,"md",meta), transcriptMarkdown(d, rows, meta), "text/markdown;charset=utf-8");
    box.recMsg = "Downloaded."; render();
  }
  /* Courts in play with no human players, when the room fills them with AI. */
  function aiCourts(room){ const st = room.state; if(!st || !room.fillAi) return new Set(); return new Set(st.order.filter(id=>!(room.teams[id]||[]).length)); }
  function hostSlow(){ return !!store.get("tt.slow", false); }
  /* Host-side pacing for AI courts: wait, then ask the server to play the turn. The server's turn check and
     claim make a second request for the same turn harmless; this flag just avoids sending one. */
  function maybeNpc(){
    const p = play; if(!p || p.mode!=="host" || !p.data) return;
    const room = p.data.room, st = room.state, pr = room.progress;
    if(room.phase!=="play" || !st || st.over || !pr || !pr.npc || pr.seq!==st.seq || p.npcAsked===st.seq) return;
    const seq = st.seq, roomId = p.roomId; p.npcAsked = seq;
    setTimeout(async ()=>{
      if(!play || play.roomId!==roomId || !play.data || play.data.room.state?.seq!==seq) return;
      const r = await api.npcTurn({roomId, seq});
      if(!play || play.roomId!==roomId) return;
      if(!r.ok){ play.err = r.error; setTimeout(()=>{ if(play && play.npcAsked===seq) play.npcAsked = null; maybeNpc(); }, 5000); softRender(); return; }
      if(r.note && !play.aiNoteSeen){ play.aiNote = r.note; play.aiNoteSeen = true; }
      const g = await api.getRoom({roomId}); if(g.ok && play && play.roomId===roomId){ play.data = g; play.err = ""; } softRender(); maybeNpc();
    }, hostSlow() ? 10000 : 3000);
  }
  /* Host's list of players. Moves are one at a time and never automatic; an AI court can only be given to a
     player through "take over", which makes it human-played. */
  function playersPanel(d, room, players, inPlay, open){
    if(!players || !players.length) return "";
    const st = room.state, courts = inPlay && st ? st.order : d.actors.filter(a=>a.playable).map(a=>a.id), ai = aiCourts(room);
    return `<details class="${open?"":"frame "}playerlist" ${open?"open":""}><summary class="eyebrow">Players (${players.length}) · move a player</summary><div class="stack" style="gap:8px;margin-top:10px">
      ${players.map(pl=>`<label class="row small" style="justify-content:space-between;flex-wrap:nowrap"><span style="min-width:0"><b>${esc(pl.nickname)}</b></span>
        <select data-act="host-move" data-seat="${esc(pl.id)}" aria-label="Court for ${esc(pl.nickname)}" style="width:auto;max-width:60%">
          ${pl.actor?"":`<option value="" selected>No court yet</option>`}
          ${courts.map(c=>{ const nm = esc((actorById(d,c)||{}).name||c); return inPlay && ai.has(c) && c!==pl.actor ? `<option value="take:${esc(c)}">Take over AI court: ${nm}</option>` : `<option value="move:${esc(c)}" ${pl.actor===c?"selected":""}>${nm}</option>`; }).join("")}
        </select></label>`).join("")}</div></details>`;
  }
  async function askVoice(logId){
    const v = play.voices[logId] = play.voices[logId] || {};
    const st = play.data.room.state, e = st.log.find(x=>x.id===logId); if(!e) return;
    v.busy = true; v.text = ""; render();
    const r = await api.aiReading({roomId:play.roomId, logId, lensId:v.who || e.target || e.who});
    v.busy = false; v.text = r.ok ? r.text : ""; v.err = r.ok ? "" : "The AI suggestion isn't available right now. Try again in a minute; the court readings above are unaffected."; render();
  }
  /* Pass-and-play AI courts. Each AI turn is shown, not just played: the court weighs its moves (stage 1),
     reveals its choice and reasoning (stage 2), and the move is played only when the player moves on, either by
     clicking Next or, on "auto", after a few seconds that can be paused. Nothing is applied before it is shown. */
  const NPC_THINK_MS = 1500, NPC_READ_S = 7;
  let npcTimer = null, npcTimerKey = "";
  function npcStop(){ if(npcTimer){ clearTimeout(npcTimer); npcTimer = null; } npcTimerKey = ""; }
  function npcTurnNow(){
    if(!play || play.mode!=="local" || play.phase!=="play" || !play.st || play.st.over || play.st.pause || play.howto) return null;
    const who = play.st.order[play.st.turn];
    return (play.npcs||[]).includes(who) ? who : null;
  }
  function npcView(){
    const who = npcTurnNow(); if(!who) return null;
    const st = play.st;
    if(!play.npcView || play.npcView.seq!==st.seq || play.npcView.who!==who)
      play.npcView = {seq:st.seq, who, stage:1, think:ruleThinking(play.d, st, who, play.history||[]), left:NPC_READ_S};
    return play.npcView;
  }
  function npcApply(){
    const v = npcView(); if(!v) return;
    npcStop();
    const st = play.st, before = {seq:st.seq, turn:st.turn}, move = moveFromThinking(v.think);
    const made = resolveMove(play.d, st, move);
    const rows = historyRows(play.d, before, made, [npcBallot(move)], "npc");
    if(auditOk(v.audit)){ const r = rows.find(x=>x.kind==="action"); if(r) r.audits = [{name:tableName(), text:cleanAudit(v.audit), at:new Date().toISOString()}]; }
    (play.history = play.history||[]).push(...rows);
    pauseAfter(st, made, play.pauseMode||"round");
    play.npcView = null; saveLocal(); render();
  }
  function localNpc(){
    if(view()!=="play"){ npcStop(); return; }
    const v = npcView(); if(!v){ npcStop(); return; }
    const key = v.seq+":"+v.stage+":"+(play.aiPaused?"p":"")+":"+(play.aiPace||"auto")+":"+v.left;
    if(npcTimerKey===key) return;
    npcStop(); npcTimerKey = key;
    if(v.stage===1){ npcTimer = setTimeout(()=>{ npcTimer = null; const w = npcView(); if(w && w.seq===v.seq){ w.stage = 2; saveLocal(); render(); } }, NPC_THINK_MS); return; }
    if(play.aiPace==="step" || play.aiPaused) return;
    npcTimer = setTimeout(()=>{ npcTimer = null; const w = npcView(); if(!w || w.seq!==v.seq || play.aiPaused) return;
      if(w.left>1){ w.left -= 1; const c = $("#npc-left"); if(c) c.textContent = String(w.left); localNpc(); } else npcApply(); }, 1000);
  }
  function npcCtl(v){
    const auto = play.aiPace!=="step";
    return `<button class="primary" data-act="npc-next">${auto&&!play.aiPaused?"Next now":"Next"}</button>
        ${auto?(play.aiPaused?`<button data-act="npc-resume">Resume auto-play</button>`:`<button data-act="npc-pause">Pause</button><span class="small muted">Next court in <span id="npc-left">${v.left}</span> s</span>`):""}`;
  }
  const auditMsg = t => !String(t||"").trim() ? "" : auditOk(t) ? "Will be saved with this move." : `Keep going: at least ${AUDIT_MIN} characters.`;
  /* Who wrote a pass-and-play audit: the table's nicknames, or "The table". */
  function tableName(){ const n = (play.seats||[]).filter(s=>s.on && (s.player||"").trim()).map(s=>s.player.trim()); return n.length ? n.join(", ").slice(0,60) : "The table"; }
  /* The AI court's turn as the player sees it. */
  function npcPanel(d, st, who){
    const v = npcView(), A = actorById(d, who), h = holderOf(d, st.round, who), name = h ? h.name : A.name;
    if(!v) return `<p aria-live="polite">${esc(A.name)} is deliberating…</p>`;
    const t = v.think, chosen = t.choice ? d.actions.find(x=>x.id===t.choice) : null, T = t.target ? actorById(d, t.target) : null;
    const src = t.src ? d.sources.find(s=>s.id===t.src) : null, reading = chosen ? readingOf(chosen, who, who) : "";
    const list = t.considered.slice(0, 4);
    const opts = list.length ? `<ol class="weigh">${list.map((c,i)=>`<li class="${v.stage===2&&c.id===t.choice?"pick":""}"><b>${esc(c.name)}</b>${v.stage===2&&c.id===t.choice?` <span class="pill ai">Chosen</span>`:""}<div class="small muted">${esc(c.reasons.join("; "))}</div></li>`).join("")}</ol>${t.considered.length>list.length?`<p class="small muted" style="margin:0">…and ${t.considered.length-list.length} more it ranked lower.</p>`:""}` : "";
    const head = `<div class="eyebrow">${v.stage===1?"Weighing its options":"Its decision"}</div>`;
    const decision = v.stage===2 ? `<div class="frame stack npcpick" aria-live="polite">
        <b>${chosen?`${esc(chosen.name)}${T?` → ${esc(T.name)}`:""}`:"It passes this turn"}</b>
        ${t.targetWhy?`<p class="small" style="margin:0"><span class="muted">Why that target:</span> ${esc(t.targetWhy)}</p>`:""}
        <p class="small" style="margin:0"><span class="muted">Its reasoning:</span> ${esc(t.why.replace(/^Simplified move: /,""))}</p>
        ${reading?`<p class="small" style="margin:0"><span class="muted">How ${esc(A.name)} reads this move:</span> ${esc(reading)}</p>`:""}
        ${src?`<p class="small" style="margin:0"><span class="muted">Source behind the card:</span> ${esc(shortCite(src))}</p>`:""}
      </div>` : `<p class="small" aria-live="polite" style="margin:0">${esc(name)} is weighing ${t.considered.length||"no"} possible move${t.considered.length===1?"":"s"}…</p>`;
    const ctl = v.stage===2 ? `<div class="row npcctl">${npcCtl(v)}</div>` : "";
    const audit = v.stage===2 && chosen ? `<details class="auditbox" ${v.audit?"open":""}><summary class="small"><b>Audit this AI move</b> (optional)</summary>
        <label class="f" for="npc-audit" style="margin-top:8px"><span>What does this move reward, and what do the readings say about it?</span><em>The AI scores moves by numbers. Does a reading support its reasoning, or does it miss how the court saw things? At least ${AUDIT_MIN} characters. Saved in the TA record as your work when you press Next.</em>
        <textarea id="npc-audit" data-act="npc-audit" maxlength="600">${esc(v.audit||"")}</textarea></label>
        <span class="small muted" id="npc-audit-msg" aria-live="polite">${esc(auditMsg(v.audit))}</span></details>` : "";
    return `<div class="stack npcturn">${head}${opts}${decision}${audit}${ctl}
      <p class="small muted" style="margin:0">AI court: simplified rule-based moves. It scores each move by what it gains for itself (its scoring resource counts double), its risk, whether it answers a move made toward it, and whether it just did the same thing.</p></div>`;
  }
  function afterPlayRender(){
    localNpc();
    const el = $("#qr");
    if(el && play && play.mode==="host" && play.data){
      QRCode.toString(joinUrl(play.data.room.code), {type:"svg", margin:1, width:260, color:{dark:"#111111", light:"#FFFFFF"}})
        .then(svg => { if(el.isConnected) el.innerHTML = svg; })
        .catch(() => { el.innerHTML = `<p style="color:#111;max-width:240px">QR code unavailable. Students can type the code below.</p>`; });
    }
  }
  function stopLive(){ unsubs.forEach(u=>{ try{ u(); }catch(e){} }); unsubs = []; }

  /* ---------- LIVE: phone ---------- */
  function renderJoin(){
    const code = (location.hash.slice(6)||"").toUpperCase();
    if(!join || join.code!==code){
      stopLive();
      const saved = code ? store.get("tt.join."+code, null) : null;
      join = {code, roomId:saved, data:null, name:store.get("tt.nick",""), pick:null, target:"", why:"", src:"", msg:"", busy:false};
      if(saved) startPhone(saved);
    }
    if(!join.roomId) return `<div class="ph"><div class="ribbon">Join a game</div><div class="big" style="margin-top:8px">Enter the code on the main screen</div>
      <form class="stack" id="phjoin"><label class="f" for="ph-code"><span>Game code</span><input id="ph-code" type="text" maxlength="6" value="${esc(join.codeDraft!=null?join.codeDraft:code)}" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em;font-weight:700;font-size:1.3rem"></label>
        <label class="f" for="pname"><span>Your nickname (shown to the class)</span><input id="pname" type="text" maxlength="24" value="${esc(join.name)}" placeholder="First name or nickname" autocomplete="off"></label>
        <button class="primary" type="submit" ${join.busy?"disabled":""}>Join</button>${join.msg?`<div class="note">${esc(join.msg)}</div>`:""}</form>
      <p class="small muted">No sign-in. Only your nickname is shown to the class.</p></div>`;
    const data = join.data;
    if(!data) return `<div class="ph"><div class="waiting"><div class="big">${join.msg?esc(join.msg):"Connecting to game "+esc(code)+"…"}</div>${join.msg?`<p style="margin-top:12px"><button data-act="ph-forget">Join with a different code</button></p>`:""}</div></div>`;
    const d = data.design, room = data.room, seat = data.seat, st = room.state;
    const headTitle = `<div class="stack" style="gap:6px"><div class="row"><div class="ribbon">Game ${esc(room.code)}</div>${room.test?`<span class="status pending">Test</span>`:""}</div><div class="big" style="margin-top:8px">${esc(d.title)}</div><div class="muted small">${esc(d.era.label)} · you are ${esc(seat?seat.nickname:"")}</div></div>`;
    const msg = join.msg?`<div class="note">${esc(join.msg)}</div>`:"";
    const courts = d.actors.filter(a=>a.playable && (room.phase==="lobby" || (st && st.order.includes(a.id))));
    const picker = `<div class="eyebrow">Choose your court</div><div class="stack" style="gap:10px">${courts.map(a=>{ const n = (room.teams[a.id]||[]).length, mine = seat && seat.actor===a.id;
      return `<button class="court" data-act="claim" data-id="${esc(a.id)}" aria-pressed="${!!mine}" ${join.busy?"disabled":""}><span class="swatch" style="background:var(${colorOf(d,a.id)});width:24px;height:24px"></span><span style="min-width:0">${esc(a.name)}<small>${mine?"Your court":esc(a.kind)} · ${n} player${n===1?"":"s"}</small></span></button>`; }).join("")}</div>`;
    if(room.phase==="lobby") return `<div class="ph">${headTitle}${picker}${room.fillAi?`<p class="small muted">Courts nobody picks will be played by AI, labeled as AI.</p>`:""}${msg}
      ${seat&&seat.actor?`<div class="frame waiting"><div class="big">You are on the ${esc(actorById(d,seat.actor).name)} team</div><p class="muted" style="margin-top:8px">Waiting for the host to start. Read your court's worldview while you wait:</p><p style="margin-top:8px">${esc(actorById(d,seat.actor).worldview)}</p></div>`:""}
      ${howtoBox(d)}${seatsBox(d, 1, roundInfo(d,1)?"Round 1 · "+roundInfo(d,1).year:"")}
      ${readingList(d)}
      <button class="ghost" data-act="ph-leave">Leave this game</button></div>`;
    if(!st) return `<div class="ph">${headTitle}<div class="frame waiting"><div class="big">Starting…</div></div></div>`;
    if(!seat || !seat.actor){
      if(room.phase==="over") return `<div class="ph">${headTitle}<div class="frame waiting"><div class="big">This game has ended</div><p class="muted" style="margin-top:8px">The debrief is on the main screen.</p></div></div>`;
      return `<div class="ph">${headTitle}<p class="small">Nobody is playing a court right now, so choose the court you want to play.</p>${picker}${msg}</div>`;
    }
    const A = actorById(d,seat.actor), rounds = Number(d.victory.rounds)||1, rr = Math.min(st.round, rounds);
    const header = `<div class="row" style="justify-content:space-between"><div class="ribbon">Round ${rr}${yearFor(d,rr)!==""?(isNews(d)?" · ":" · c. ")+yearFor(d,rr):""}</div><span class="small muted">${esc(room.code)} · ${esc(seat.nickname)}</span></div>
      <div class="row"><span class="swatch" style="background:var(${colorOf(d,seat.actor)});width:26px;height:26px"></span><div class="big">${esc(A.name)}</div></div>
      ${holderLine(d, rr, seat.actor, false)}${(()=>{ const h = holderOf(d, rr, seat.actor); return h && h.changed ? `<p class="small seatnew"><b>New in your seat:</b> ${esc(h.changed)}</p>` : ""; })()}
      <div class="toks">${d.resources.map((x,i)=>`<span class="tok r${i%4}"><i>${st.res[seat.actor][x.key]}</i>${esc(x.name)}</span>`).join("")}</div>`;
    if(room.phase==="over" || st.over){
      const k = d.victory.res, rank = st.order.slice().sort((x,y)=>st.res[y][k]-st.res[x][k]).indexOf(seat.actor)+1;
      return `<div class="ph">${header}<div class="frame waiting"><div class="big">Game over</div><p style="margin-top:8px">${endedEarly(d, st)?`The game ended early, in round ${st.round}. Your court is ${rank} of ${st.order.length} by ${esc(resName(d,k))} so far; these standings are provisional.`:`Your court finished ${rank} of ${st.order.length} by ${esc(resName(d,k))}.`} The debrief is on the main screen.</p></div>${outroBox(d)}${miniMap(d, room, seat)}${fbForm(room.gameKey)}</div>`;
    }
    if(seat.late && !store.get("tt.caught."+room.code, false)) return catchUp(d, room, seat, header);
    if(st.pause) return phonePause(d, room, header);
    const who = st.order[st.turn], latest = st.log[0];
    /* After voting (and between turns) the mini map replaces the single last-move box once the record loads. */
    const review = () => { const mm = miniMap(d, room, seat); return (join.hist && join.hist.some(r=>r.kind==="action")) ? mm : lastHtml + mm; };
    const npcTurn = room.progress && room.progress.npc && room.progress.seq===st.seq;
    const lastHtml = latest && latest.kind==="action" ? (()=>{ const a = d.actions.find(x=>x.id===latest.action)||{}; const LA = actorById(d,latest.who)||{}, LT = latest.target?actorById(d,latest.target):null;
        const rd = {}; d.actors.forEach(x=>{ rd[x.id] = readingOf(a, x.id, latest.who); });
        return `<div class="plain stack" style="gap:8px"><div class="eyebrow">Last move</div>${latest.npc?aiTag(d, latest.who, latest.npc):""}<b>${esc(LA.name)}: ${esc(a.name)}${LT?" → "+esc(LT.name):""}</b>${latest.failed?`<span style="color:var(--danger)">It backfired.</span>`:""}${myBoxes(d, seat, latest.who, latest.target||"", rd)}</div>`; })()
      : latest && latest.kind==="event" ? `<div class="plain stack" style="gap:6px"><div class="eyebrow">${esc(latest.event.year)} · Event</div><b>${esc(latest.event.title)}</b></div>` : "";
    if(who!==seat.actor) return `<div class="ph">${header}<div class="frame waiting"><div class="eyebrow">Not your turn</div><div class="big" style="margin-top:8px">${esc(actorById(d,who).name)} is ${npcTurn?"deliberating":"choosing"}</div>${npcTurn?`<p style="margin-top:8px"><span class="pill ai">AI court</span></p>`:""}<p class="muted" style="margin-top:8px">Your court's options appear here when it is your turn.</p></div>${review()}</div>`;
    const pr = room.progress && room.progress.seq===st.seq ? room.progress : null;
    if(data.votedSeq===st.seq) return `<div class="ph">${header}<div class="frame waiting"><div class="big">Vote sent</div>${pr?`<p class="muted" style="margin-top:8px">${pr.voted} of ${pr.of} on your team have voted.</p>`:""}<p class="muted" style="margin-top:8px">While you wait, look back at the moves so far: tap any court on the map to see how it read each one.</p></div>${review()}</div>`;
    const pick = d.actions.find(x=>x.id===join.pick);
    return `<div class="ph">${header}
      <div class="frame stack"><div class="eyebrow">Your court's turn · vote with your team</div>${pr?`<p class="small muted">${pr.voted} of ${pr.of} on your team have voted.</p>`:""}
        <p class="small"><span class="muted">How your court sees the world:</span> ${esc(A.worldview)}</p>
        ${actionCards(d,st,seat.actor,join.pick,true)}
        ${pick?reasonForm(d,st,seat.actor,pick,join,true):""}
        ${passBox(join, true)}</div>
      ${msg}${lastHtml}</div>`;
  }
  /* Pre-game list of the world's readings with their course weeks, so the TA can assign them beforehand. */
  function readingList(d, cls, round){
    /* The contemporary demo: the articles available so far (nothing published after this round's year), linked. */
    if(isNews(d)){ const list = citableSources(d, round||1);
      return `<div class="${cls||"frame"} stack readinglist"><div class="eyebrow">Articles you can cite so far</div><ol class="small srclist" style="margin:0;padding-left:1.3em">${list.map(s=>srcItem(d, s.id)).join("")}</ol></div>`; }
    return `<div class="${cls||"frame"} stack readinglist"><div class="eyebrow">Readings for this world</div>
      ${d.sources.length?`<ol class="small" style="margin:0;padding-left:1.3em">${d.sources.map(s=>{ const c = courseOf(s.key); return `<li style="margin-bottom:6px">${esc(shortCite(s))}<br><span class="muted">${c?esc(c.week)+" · "+esc(GENRE_LABEL[c.genre])+(c.starred?" (* on the syllabus)":""):"Not a course reading"+(s.where?" · "+esc(s.where):"")}</span>${s.lookFor?`<br><span class="muted">Look for:</span> ${esc(s.lookFor)}`:""}</li>`; }).join("")}</ol>`:`<p class="small muted">This world lists no readings yet.</p>`}
    </div>`;
  }
  /* Phone: what this student's court sees after a move. The target court sees how the actor read it; the actor
     sees how the target read it; anyone else sees their own court's reading. */
  function myBoxes(d, seat, actorId, targetId, readings){
    const box = id => `<div><b>As ${esc((actorById(d,id)||{}).name||"")} read it</b>${esc(readings[id]||"(no reading written)")}</div>`;
    const me = seat.actor;
    if(me===targetId) return `<div class="readings one">${box(actorId)}</div>`;
    if(me===actorId) return targetId ? `<div class="readings one">${box(targetId)}</div>` : `<div class="readings one">${box(actorId)}</div>`;
    return `<div class="readings one">${box(me)}</div>`;
  }
  /* Phone mini map: step through the game's moves; tap any court to see how THAT court read the move. Readings
     come from the stored record, so each move shows what was shown at the time. */
  function miniMap(d, room, seat){
    if(join.hist===undefined){ join.hist = null; api.getHistory({roomId:room.id}).then(r=>{ if(join){ join.hist = r.ok ? r.rows : []; softRender(); } }); }
    const moves = (join.hist||[]).filter(r=>r.kind==="action");
    if(!moves.length) return join.hist===null ? `<div class="plain small muted">Loading the moves so far…</div>` : "";
    const i = join.mv==null || join.mv>=moves.length ? moves.length-1 : join.mv, r = moves[i];
    const a = d.actions.find(x=>x.id===r.action)||{name:r.action}, A = actorById(d,r.actor)||{}, T = r.target?actorById(d,r.target):null;
    const lens = join.lens && r.readings[join.lens]!==undefined ? join.lens : null;
    const mine = r.ballots.filter(b=>b.name===seat.shownAs && !b.npc);
    const myv = mine[0], myA = myv && d.actions.find(x=>x.id===myv.action), mySrc = myv && d.sources.find(x=>x.id===myv.src);
    return `<section class="frame stack minimap" aria-label="Moves so far">
      <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div class="eyebrow">Move ${i+1} of ${moves.length} · round ${r.round}</div>
        <span class="row" style="gap:6px;flex-wrap:nowrap"><button class="ghost" data-act="ph-mv" data-d="-1" ${i>0?"":"disabled"} aria-label="Earlier move">‹</button><button class="ghost" data-act="ph-mv" data-d="1" ${i<moves.length-1?"":"disabled"} aria-label="Later move">›</button></span></div>
      ${r.npc?aiTag(d, r.actor, r.ballots&&r.ballots[0]&&r.ballots[0].npc):""}
      <b>${esc(A.name||"")}: ${esc(a.name)}${T?" → "+esc(T.name):""}</b>${r.failed?`<span style="color:var(--danger)">It backfired.</span>`:""}
      ${myBoxes(d, seat, r.actor, r.target, r.readings)}
      <div class="boardframe mini">${hexSvg(d,{tap:true, current:lens||"", route:A.tile&&T&&T.tile?{from:A.tile,to:T.tile,fail:r.failed}:null})}</div>
      <p class="small muted">Tap a court to see how it read this move.</p>
      <div class="chips">${d.actors.map(x=>`<button class="chip" data-act="ph-lens" data-id="${esc(x.id)}" aria-pressed="${lens===x.id}"><span class="swatch" style="background:var(${colorOf(d,x.id)})"></span>${esc(x.name)}</button>`).join("")}</div>
      ${lens?`<div class="readings one" aria-live="polite"><div><b>As ${esc((actorById(d,lens)||{}).name||"")} read it</b>${esc(r.readings[lens]||"(no reading written)")}</div></div>`:""}
      ${r.npc&&r.kind==="action"?phoneAudit(r):""}
      ${myv?`<div class="small"><span class="muted">Your vote:</span> ${myv.pass?"pass":esc(myA?myA.name:myv.action)}${myv.why?` · “${esc(myv.why)}”`:""}${mySrc?` <span class="muted">(${esc(shortCite(mySrc))}${myv.loc?", "+esc(myv.loc):""})</span>`:""}</div>`:""}
    </section>`;
  }
  /* Phase 1: a student can audit an AI court's move. The answer goes to the TA record as student work. */
  function phoneAudit(r){
    const done = (join.audited||{})[r.seq];
    if(done) return `<div class="audit small"><b>Your audit is saved</b> for the TA: “${esc(done)}”</div>`;
    if(join.auditOpen!==r.seq) return `<div><button class="ghost" data-act="ph-audit-open" data-seq="${r.seq}">Audit this AI move</button></div>`;
    return `<div class="frame stack auditbox"><label class="f" for="ph-audit"><span>What does this AI move reward, and what do the readings say about it?</span><em>The AI scores moves by numbers. Does a reading support its reasoning? At least ${AUDIT_MIN} characters. The TA sees it with your nickname.</em>
        <textarea id="ph-audit" data-act="ph-audit" maxlength="600">${esc(join.auditDraft||"")}</textarea></label>
      <div class="row"><button class="primary" id="ph-audit-send" data-act="ph-audit-send" data-seq="${r.seq}" ${auditOk(join.auditDraft)&&!join.busy?"":"disabled"}>Save my audit</button><button class="ghost" data-act="ph-audit-cancel">Cancel</button></div></div>`;
  }
  /* A student who joins after the start: where they were placed, what has happened, what to read. */
  function catchUp(d, room, seat, header){
    if(join.catchup===undefined){ join.catchup = null; api.getHistory({roomId:room.id}).then(r=>{ if(join){ join.catchup = r.ok ? r.rows : []; softRender(); } }); }
    const A = actorById(d, seat.actor), mates = (room.teams[seat.actor]||[]).filter(n=>n!==seat.nickname);
    const rows = join.catchup, rounds = {};
    (rows||[]).forEach(r=>{ (rounds[r.round] = rounds[r.round]||[]).push(r); });
    const line = r => { if(r.kind==="event") return `<li><b>Event${r.year!==""?" · "+esc(r.year):""}:</b> ${esc(r.event?r.event.title:"")}</li>`;
      const W = esc((actorById(d,r.actor)||{}).name||""), ai = r.npc?` <span class="pill ai">AI</span>`:"";
      if(r.kind==="pass") return `<li>${W} passed${ai}</li>`;
      const a = d.actions.find(x=>x.id===r.action)||{name:r.action}, T = r.target?actorById(d,r.target):null;
      return `<li>${W}: ${esc(a.name)}${T?" → "+esc(T.name):""}${ai}${r.target===seat.actor?` <span class="small muted">(toward your court)</span>`:""}</li>`; };
    const summary = rows===null ? `<p class="small muted">Loading…</p>` : Object.keys(rounds).length ? Object.keys(rounds).sort((x,y)=>x-y).map(k=>`<div><b class="small">Round ${esc(k)}</b><ul class="small" style="margin:4px 0 0;padding-left:1.2em">${rounds[k].map(line).join("")}</ul></div>`).join("") : `<p class="small muted">No moves yet.</p>`;
    return `<div class="ph">${header}
      <div class="frame stack"><div class="eyebrow">You joined mid-game</div><div class="big">You joined ${esc(A.name)}${mates.length?` with ${esc(mates.slice(0,6).join(", "))}${mates.length>6?` and ${mates.length-6} more`:""}`:""}</div>
        <p class="small"><span class="muted">How your court sees the world:</span> ${esc(A.worldview)}</p></div>
      <div class="frame stack"><div class="eyebrow">The game so far</div>${summary}</div>
      ${seatsBox(d, room.state.round)}
      ${openingBox(d, {mine: seat.actor})}${readingList(d, "", room.state.round)}
      <div class="frame boardframe">${hexSvg(d,{current:room.state.order[room.state.turn]})}</div>
      <button class="primary" data-act="ph-caught">I'm caught up: go to my court</button></div>`;
  }
  function startPhone(roomId){
    stopLive();
    join.roomId = roomId;
    let lastSeq = null;
    const refresh = async () => {
      if(!join || join.roomId!==roomId) return;
      const r = await api.getRoom({roomId});
      if(!join || join.roomId!==roomId) return;
      if(!r.ok){ join.data = null; join.msg = r.error; store.set("tt.join."+join.code, null); softRender(); return; }
      const seq = r.room.state ? r.room.state.seq : null;
      if(seq!==lastSeq){ join.pick = null; join.target = ""; join.why = ""; join.src = ""; join.loc = ""; join.quote = ""; join.hist = undefined; lastSeq = seq; }
      join.data = r; join.msg = ""; softRender();
    };
    unsubs.push(api.subscribeRoom(roomId, refresh));
    refresh();
  }
  async function phoneJoin(code, name){
    join.busy = true; join.msg = ""; render();
    const r = await api.joinRoom({code, nickname:name});
    join.busy = false;
    if(!r.ok){ join.msg = r.error; render(); return; }
    store.set("tt.nick", name); store.set("tt.join."+code, r.roomId);
    join.code = code; join.name = name;
    if(location.hash.slice(1).toUpperCase()!=="JOIN-"+code) history.replaceState(null, "", "#join-"+code);
    startPhone(r.roomId); render();
  }
  async function phoneDo(fn){
    join.busy = true; join.msg = ""; render();
    const r = await fn();
    join.busy = false;
    if(!r.ok) join.msg = r.error;
    const g = await api.getRoom({roomId:join.roomId}); if(g.ok) join.data = g;
    render();
  }
  function alertBox(text){ const app = $("#app"); if(app) app.insertAdjacentHTML("afterbegin", `<div class="note" style="margin-bottom:16px">${esc(text)}</div>`); }

  /* ---------- events ---------- */
  /* Setup: Begin needs at least one court ticked. Updated in place so typing a nickname keeps focus. */
  function seatMsg(){
    const any = !!(play && play.seats && play.seats.some(s=>s.on)), b = root.querySelector('[data-act="begin"]'), m = $("#seatmsg");
    if(b) b.disabled = !any; if(m) m.textContent = any ? "" : "Tick at least one court to play.";
  }
  function setCommitEnabled(state, pick, d, who){
    const miss = pick && d ? evidenceMissing(d, pick, state, who) : ["an action"];
    const btn = $("#commit"); if(btn) btn.disabled = miss.length>0;
    const m = $("#missing"); if(m) m.innerHTML = missingNote(miss);
  }
  async function onSubmit(e){
    const f = e.target;
    if(f.id==="joinform"){ e.preventDefault(); const c = ($("#joincode").value||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
      if(/^[A-Z0-9]{6}$/.test(c)) location.hash = "#join-"+c; else { const m = $("#joinmsg"); if(m) m.textContent = "Codes have six letters and numbers."; } }
    else if(f.id==="phjoin"){ e.preventDefault(); const c = ($("#ph-code").value||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,""), n = ($("#pname").value||"").trim();
      join.name = n; if(!/^[A-Z0-9]{6}$/.test(c)){ join.msg = "Codes have six letters and numbers."; render(); return; } phoneJoin(c, n); }
    else if(f.id==="reopenform"){ e.preventDefault(); const c = ($("#ro-code").value||"").trim().toUpperCase(), k = ($("#ro-key").value||"").trim().toUpperCase();
      const r = await api.hostReopen({code:c, recoveryKey:k});
      if(!r.ok){ const m = $("#romsg"); if(m) m.textContent = r.error; return; }
      store.set("tt.host", {roomId:r.roomId, code:c, recoveryKey:k}); openHost(r.roomId, c, k); }
    else if(f.id==="instrform"){ e.preventDefault(); const pc = ($("#passcode").value||""); await loadInstr(pc); }
  }
  async function loadInstr(pc){
    const r = await api.instructorList({passcode:pc});
    if(!r.ok){ instr.err = r.error; instr.items = null; try{ sessionStorage.removeItem("tt.pass"); }catch(e){} render(); return; }
    instr.passcode = pc; instr.items = r.items; instr.err = ""; try{ sessionStorage.setItem("tt.pass", pc); }catch(e){} render();
  }
  function onInput(e){
    const t = e.target;
    if(t.dataset.bind && view()==="design"){
      const d = cur(); let v = t.type==="checkbox" ? t.checked : t.value;
      if(t.dataset.num!==undefined) v = v==="" ? "" : Number(v);
      setPath(d, t.dataset.bind, v);
      if(t.dataset.bind==="opening.source" && d.opening) delete d.opening.sources;
      { const m = /^sources\.(\d+)\.genre$/.exec(t.dataset.bind); if(m && d.sources[+m[1]]){ const src = d.sources[+m[1]]; src.type = countsAsPrimary(src) ? "primary" : "secondary"; } }
      d.updatedAt = Date.now(); saveDrafts();
      if(t.tagName==="SELECT" || t.type==="checkbox"){ const y = window.scrollY; render(); window.scrollTo(0,y); } else refreshRail();
      return;
    }
    if(t.dataset.act==="placename"){ const d = cur(), s = mapTool.sel || [0,0]; mapTool.sel = s;
      d.map.places = d.map.places.filter(p=>!(p.c===s[0]&&p.r===s[1])); if(t.value.trim()) d.map.places.push({c:s[0],r:s[1],name:t.value});
      d.updatedAt = Date.now(); saveDrafts(); const box = $("#mapbox"); if(box) box.innerHTML = hexSvg(d,{edit:true,sel:s}); return; }
    if(t.dataset.act==="nick"){ nick = t.value; store.set("tt.nick", nick); return; }
    if(t.id==="pname" && join){ join.name = t.value.slice(0,24); return; }
    if(t.dataset.act==="passwhy" && play){ play.passWhy = t.value; saveLocal(); const g = $("#passgo"); if(g) g.disabled = !passWhyOk(t.value); return; }
    if(t.dataset.act==="ph-passwhy" && join){ join.passWhy = t.value; const g = $("#ph-passgo"); if(g) g.disabled = !passWhyOk(t.value) || join.busy; return; }
    if(t.id==="ph-code" && join){ join.codeDraft = t.value; return; }
    if(t.dataset.act==="npc-audit" && play && play.npcView){ const v = play.npcView; v.audit = t.value.slice(0,600);
      if(!play.aiPaused && play.aiPace!=="step"){ play.aiPaused = true; npcStop(); const c = root.querySelector(".npcctl"); if(c) c.innerHTML = npcCtl(v); }
      const m = $("#npc-audit-msg"); if(m) m.textContent = auditMsg(v.audit); saveLocal(); return; }
    if(t.dataset.act==="ph-audit" && join){ join.auditDraft = t.value.slice(0,600); const g = $("#ph-audit-send"); if(g) g.disabled = !auditOk(join.auditDraft) || join.busy; return; }
    if(t.id==="ta-note" && play){ (play.noteDraft = play.noteDraft||{})[t.dataset.round] = t.value; play.noteMsg = ""; return; }
    if(t.dataset.act==="seat-name"){ const s = play.seats[+t.dataset.i]; s.player = t.value.slice(0,24);
      if(s.player.trim() && !s.on){ s.on = true; const c = root.querySelector(`[data-act="seat-on"][data-i="${t.dataset.i}"]`); if(c) c.checked = true; seatMsg(); }
      saveLocal(); return; }
    const localWho = () => play.st.order[play.st.turn], phoneWho = () => join.data.seat.actor;
    if(["why","loc","quote"].includes(t.dataset.act)){ play[t.dataset.act] = t.value; saveLocal(); setCommitEnabled(play, play.d.actions.find(x=>x.id===play.pick), play.d, localWho()); return; }
    if(["ph-why","ph-loc","ph-quote"].includes(t.dataset.act)){ join[t.dataset.act.slice(3)] = t.value; const d = join.data && join.data.design; setCommitEnabled(join, d && d.actions.find(x=>x.id===join.pick), d, phoneWho()); return; }
  }
  /* A field losing focus lets a deferred live update redraw the phone screen. Never mid-click: a redraw would replace
     the button being pressed (the join bug: the nickname cleared and the click was lost). Wait for the click. */
  let pressing = false, softAfterPress = false;
  function onPointerDown(e){ if(e.target && e.target.closest && e.target.closest("button")) pressing = true; }
  function onPointerUp(){ if(!pressing) return; setTimeout(()=>{ pressing = false; if(softAfterPress){ softAfterPress = false; softRender(); } }, 0); }
  function onFocusOut(e){
    if(!["pname","ph-code","why","whyloc","whyquote","fb-trap","fb-text","passwhy","ph-passwhy","ph-audit"].includes(e.target.id) || view()!=="join") return;
    setTimeout(()=>{ if(pressing){ softAfterPress = true; return; } softRender(); }, 0);
  }
  function onChange(e){
    const t = e.target, act = t.dataset.act; if(!act) return;
    const d = cur();
    if(act==="pick-draft"){ curId = t.value; saveDrafts(); render(); }
    else if(act==="era-preset" && t.value!==""){ const p = ERAS[+t.value]; d.era = {label:p.label, start:p.start, end:p.end, week:p.week}; d.order = p.order; d.updatedAt = Date.now(); saveDrafts(); render(); }
    else if(act==="add-course" && t.value){ const s = courseOf(t.value); if(!d.sources.some(x=>x.key===s.key)) d.sources.push(srcFromCourse(s.key, "s"+uid())); d.updatedAt = Date.now(); saveDrafts(); render(); }
    else if(act==="who"){ const a = d.actions[+t.dataset.i]; a.who = a.who.filter(w=>w!==t.value); if(t.checked) a.who.push(t.value); d.updatedAt = Date.now(); saveDrafts(); refreshRail(); }
    else if(act==="tile-c"){ mapTool.sel = [+t.value, (mapTool.sel||[0,0])[1]]; render(); $("#tile-c")?.focus(); }
    else if(act==="tile-r"){ mapTool.sel = [(mapTool.sel||[0,0])[0], +t.value]; render(); $("#tile-r")?.focus(); }
    else if(act==="tile-t"){ const s = mapTool.sel || [0,0]; mapTool.sel = s; const row = d.map.terrain[s[1]].split(""); row[s[0]] = t.value; d.map.terrain[s[1]] = row.join(""); d.updatedAt = Date.now(); saveDrafts(); $("#mapbox").innerHTML = hexSvg(d,{edit:true,sel:s}); }
    else if(act==="seat"){ const s = mapTool.sel || [0,0]; mapTool.sel = s; d.actors.forEach(a=>{ if(a.tile&&a.tile[0]===s[0]&&a.tile[1]===s[1]) a.tile=null; }); const a = d.actors.find(x=>x.id===t.value); if(a) a.tile = s.slice(); d.updatedAt = Date.now(); saveDrafts(); render(); $("#seat")?.focus(); }
    else if(act==="seat-on"){ play.seats[+t.dataset.i].on = t.checked; saveLocal(); seatMsg(); }
    else if(act==="pp-pace"){ play.aiPace = t.value==="step" ? "step" : "auto"; saveLocal(); }
    else if(act==="target"){ play.target = t.value; saveLocal(); render(); }
    else if(act==="whysrc"){ play.src = t.value; saveLocal(); render(); }
    else if(act==="ph-target"){ join.target = t.value; render(); }
    else if(act==="ph-src"){ join.src = t.value; render(); }
    else if(act==="host-lockt"){ hostDo(t.checked ? "lock" : "unlock"); }
    else if(act==="host-ai"){ hostDo(t.checked ? "ai-on" : "ai-off"); }
    else if(act==="host-slow"){ store.set("tt.slow", t.checked); }
    else if(act==="host-pausemode"){ hostDo(t.checked ? "pause-move" : "pause-round"); }
    else if(act==="host-share"){ hostDo(t.checked ? "share-on" : "share-off"); }
    else if(act==="pp-pausemode"){ play.pauseMode = t.checked ? "move" : "round"; saveLocal(); }
    else if(act==="host-move" && t.value){ const [kind, actor] = t.value.split(":"); (async()=>{ const r = await api.hostMove({roomId:play.roomId, seatId:t.dataset.seat, actor, takeover:kind==="take"}); if(!r.ok) play.err = r.error; const g = await api.getRoom({roomId:play.roomId}); if(g.ok) play.data = g; render(); maybeNpc(); })(); }
    else if(act==="pp-ai"){ play.fillAi = t.checked; saveLocal(); render(); }
    else if(act==="voice-who"){ (play.voices[t.dataset.id] = play.voices[t.dataset.id]||{}).who = t.value; }
  }
  async function onClick(e){
    const tok = e.target.closest && e.target.closest("[data-court]");
    if(tok && view()==="join" && join){ join.lens = join.lens===tok.dataset.court ? null : tok.dataset.court; render(); return; }
    const tile = e.target.closest("[data-tile]");
    if(tile && view()==="design"){ const [c,r] = tile.dataset.tile.split(",").map(Number); mapTool.sel = [c,r]; render(); return; }
    const b = e.target.closest("[data-act]"); if(!b || !root.contains(b) || b.tagName==="SELECT" || b.tagName==="INPUT" || b.tagName==="TEXTAREA") return;
    const act = b.dataset.act, d = cur();
    switch(act){
      case "mcar": { const c = b.closest(".mcar"); if(!c) break; const n = c.querySelectorAll(".mslide").length; const i = b.dataset.i!=null ? +b.dataset.i : ((+(c.dataset.i||0)) + (+b.dataset.d) + n) % n; c.dataset.i = String(i); c.querySelector(".mtrack").style.transform = `translateX(-${i*100}%)`; c.querySelectorAll(".mdot").forEach((x,j)=>x.setAttribute("aria-current", j===i ? "true" : "false")); break; }
      case "step": step = +b.dataset.i; store.set("tt.step",step); if(view()!=="design") location.hash = "#design"; render(); window.scrollTo(0,0); break;
      case "new-draft": { const n = blankDesign(); drafts.push(n); curId = n.gid; step = 0; saveDrafts(); location.hash="#design"; render(); break; }
      case "open-today": { if(!drafts.find(x=>x.gid==="sandbox-today-2026")){ drafts.splice(1,0,todayDesign()); saveDrafts(); } location.hash="#play"; render(); window.scrollTo(0,0); break; }
      case "open-sample": { let s = drafts.find(x=>x.sandbox); if(!s){ s = sampleDesign(); drafts.unshift(s); } curId = s.gid; step = 0; saveDrafts(); location.hash="#design"; render(); break; }
      case "open-draft": curId = b.dataset.gid; saveDrafts(); location.hash="#design"; render(); break;
      case "dup-draft": { const n = clone(d); n.gid = "g"+uid(); n.sandbox = false; n.published = false; delete n.submission; n.title = (d.title||"Untitled")+" (copy)"; n.updatedAt = Date.now(); drafts.push(n); curId = n.gid; saveDrafts(); render(); break; }
      case "remix": { const g = lib.games.find(x=>x.id===b.dataset.lib); if(!g) break; const n = upgradeDesign(clone(g.design)); n.gid = "g"+uid(); n.sandbox=false; n.published=false; delete n.submission; n.title = (n.title||"Untitled")+" (remix)"; n.updatedAt = Date.now(); drafts.push(n); curId = n.gid; step=0; saveDrafts(); location.hash="#design"; render(); break; }
      case "add-actor": { const st = {}; d.resources.forEach(r=>st[r.key]=3); d.actors.push({id:"p"+uid(), name:"", kind:"Royal court", tile:null, playable:true, worldview:"", goal:"", start:st}); d.updatedAt = Date.now(); saveDrafts(); render(); break; }
      case "add-source": d.sources.push({id:"s"+uid(), type:"primary", genre:"", citation:"", note:"", year:"", where:"", fit:"", lookFor:""}); d.updatedAt = Date.now(); saveDrafts(); render(); break;
      case "add-action": d.actions.push({id:"x"+uid(), name:"", who:["any"], target:"none", effects:[{to:"self",res:d.resources[0].key,d:1}], readingSelf:"", readingOther:"", readings:{}, rationale:"", trap:"", source:"", page:"", risk:{chance:0,effects:[],text:""}}); d.updatedAt = Date.now(); saveDrafts(); render(); break;
      case "add-event": d.events.push({id:"e"+uid(), year:d.era.start||"", title:"", text:"", effects:[], source:""}); d.updatedAt = Date.now(); saveDrafts(); render(); break;
      case "add-trap": d.traps.push({modern:"", historical:""}); d.updatedAt = Date.now(); saveDrafts(); render(); break;
      case "del": { const list = d[b.dataset.list]; const removed = list.splice(+b.dataset.i,1)[0];
        if(b.dataset.list==="actors"){ d.actions.forEach(a=>{ a.who = a.who.filter(w=>w!==removed.id); if(a.target===removed.id) a.target="none"; if(a.readings) delete a.readings[removed.id]; }); d.events.forEach(ev=>ev.effects = ev.effects.filter(x=>x.to!==removed.id)); }
        if(b.dataset.list==="sources"){ d.actions.forEach(a=>{ if(a.source===removed.id) a.source=""; }); d.events.forEach(ev=>{ if(ev.source===removed.id) ev.source=""; }); }
        d.updatedAt = Date.now(); saveDrafts(); render(); break; }
      case "add-eff": getPath(d, b.dataset.path).push({to:b.dataset.to, res:d.resources[0].key, d:1}); d.updatedAt = Date.now(); saveDrafts(); render(); break;
      case "del-eff": getPath(d, b.dataset.path).splice(+b.dataset.i,1); d.updatedAt = Date.now(); saveDrafts(); render(); break;
      case "copy-json": { const box = $("#jsonbox"); try{ await navigator.clipboard.writeText(box.value); $("#jsonmsg").textContent = "Copied."; }catch(err){ box.select(); $("#jsonmsg").textContent = "Selected. Press Ctrl+C or ⌘C to copy."; } break; }
      case "import-json": { try{ const n = JSON.parse($("#jsonbox").value); if(!n.actors||!n.actions||!n.resources) throw 0; upgradeDesign(n); n.gid = "g"+uid(); n.sandbox=false; n.published=false; n.updatedAt = Date.now(); drafts.push(n); curId=n.gid; saveDrafts(); loadSubs(); render(); }catch(err){ $("#jsonmsg").textContent = "That text is not a design from this workshop."; } break; }
      case "delete-draft": { if(b.dataset.confirm){ drafts = drafts.filter(x=>x.gid!==d.gid); if(!drafts.length) drafts=[sampleDesign()]; curId = drafts[0].gid; saveDrafts(); render(); } else { b.dataset.confirm = "1"; b.textContent = "Click again to delete for good"; } break; }
      case "publish": {
        const msg = $("#pubmsg"); const n = (($("#nick")||{}).value||nick).trim();
        if(n.length<2){ if(msg) msg.textContent = "Enter a nickname of at least two characters."; break; }
        if(msg) msg.textContent = "Submitting…";
        const r = await api.submitDesign({design:d, nickname:n, ...(d.submission?{id:d.submission.id, editKey:d.submission.editKey}:{})});
        if(!r.ok){ if(msg) msg.textContent = r.error; break; }
        d.submission = {id:r.id, editKey:r.editKey, nickname:n}; d.submittedAt = Date.now(); d.updatedAt = d.submittedAt; d.published = true;
        subs[r.id] = {id:r.id, status:"pending", note:"", feedback:(subs[r.id]||{}).feedback||[]}; saveDrafts(); render(); break; }
      case "unpublish": { if(!d.submission) break; const r = await api.withdrawDesign({id:d.submission.id, editKey:d.submission.editKey});
        if(!r.ok){ const m = $("#pubmsg"); if(m) m.textContent = r.error; break; } delete subs[d.submission.id]; delete d.submission; d.published = false; saveDrafts(); render(); break; }
      case "instr-open": instr.open = true; if(instr.passcode) await loadInstr(instr.passcode); else render(); break;
      case "instr-close": instr.open = false; instr.items = null; render(); break;
      case "instr-reload": await loadInstr(instr.passcode); break;
      case "approve": case "send-back": {
        const item = (instr.items||[]).find(x=>x.id===b.dataset.id); if(!item) break;
        const noteEl = root.querySelector(`[data-review-note="${CSS.escape(item.id)}"]`), msgEl = root.querySelector(`[data-review-msg="${CSS.escape(item.id)}"]`);
        const r = await api.instructorReview({passcode:instr.passcode, id:item.id, approve:act==="approve", note:noteEl?noteEl.value:"", version:Number(item.version)});
        if(!r.ok){ if(msgEl) msgEl.textContent = r.error; break; }
        await loadInstr(instr.passcode); lib.loaded = false; render(); break; }
      case "local": { const f = findDesign(b); if(f) startLocal(f); break; }
      case "host": { const f = findDesign(b); if(f) await startHost(f); break; }
      case "resume": { const h = store.get("tt.host", null); if(h) openHost(h.roomId, h.code, h.recoveryKey); break; }
      case "forget-host": store.set("tt.host", null); stopLive(); play = null; render(); break;
      case "copy-link": { try{ await navigator.clipboard.writeText(joinUrl(play.data.room.code)); $("#copymsg").textContent = "Copied."; }catch(err){ $("#copymsg").textContent = "Copy the link shown above."; } break; }
      case "host-start": hostDo("start"); break;
      case "host-balance": hostDo("balance"); break;
      case "drawer": play.drawer = play.drawer===b.dataset.d ? "" : b.dataset.d; render(); { const el = $("#drawer"); if(el){ el.setAttribute("tabindex","-1"); el.focus(); } } break;
      case "fullscreen": try{ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }catch(err){} break;
      case "host-note-ok": play.aiNote = ""; render(); break;
      case "manual-go": { if(!manualOpen.includes("rules")) manualOpen = manualOpen.concat(["goals","rules"]); render(); const m = $("#manual"); if(m) m.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); break; }
      case "rec-dl": await downloadRecord(b.dataset.fmt); break;
      case "host-reveal": hostDo("reveal"); break;
      case "host-continue": play.timer = null; play.facOpen = false; play.noteMsg = ""; play.recMsg = ""; hostDo("continue"); window.scrollTo(0,0); break;
      case "local-continue": if(play && play.st){ play.st.pause = null; play.timer = null; play.facOpen = false; play.noteMsg = ""; play.recMsg = ""; saveLocal(); render(); window.scrollTo(0,0); } break;
      case "ptimer": { const m = Number(b.dataset.m); play.timer = m ? {end:Date.now()+m*60000} : null; render(); break; }
      case "fac-toggle": play.facOpen = !play.facOpen; play.noteMsg = ""; render(); break;
      case "ta-tag": await saveTag(Number(b.dataset.seq), Number(b.dataset.b), b.dataset.tag); break;
      case "ta-note-save": await saveNote(Number(b.dataset.round)); break;
      case "review-round": play.reviewRound = Number(b.dataset.r); play.reviewVer = (play.reviewVer||0)+1; play.noteMsg = ""; render(); break;
      case "host-skip": hostDo("skip"); break;
      case "host-lock": hostDo(play.data.room.locked ? "unlock" : "lock"); break;
      case "host-close": if(b.dataset.confirm) hostDo("close"); else { b.dataset.confirm = "1"; b.textContent = "Click again to close and delete this game"; } break;
      case "begin": { const humans = play.seats.filter(s=>s.on).map(s=>s.id); if(!humans.length) break;
        const fill = play.fillAi!==false, order = fill ? play.seats.map(s=>s.id) : humans; play.npcs = fill ? play.seats.filter(s=>!s.on).map(s=>s.id) : []; play.players = Object.fromEntries(play.seats.map(s=>[s.id,s.player])); play.st = startState(play.d, order); play.phase = "play"; play.howto = isNews(play.d); play.npcView = null; play.aiPaused = false; saveLocal(); render(); window.scrollTo(0,0); break; }
      case "howto-ok": if(play){ play.howto = false; if(play.st && play.st.pause && play.st.pause.kind==="opening" && !ownOpening(play.d)) play.st.pause = null; saveLocal(); render(); window.scrollTo(0,0); } break;
      case "npc-next": npcApply(); break;
      case "npc-pause": play.aiPaused = true; npcStop(); saveLocal(); render(); break;
      case "npc-resume": { play.aiPaused = false; const nv = npcView(); if(nv) nv.left = NPC_READ_S; saveLocal(); render(); break; }
      case "pick": play.pick = b.dataset.id; play.target = ""; play.passing = false; saveLocal(); render(); break;
      case "take": { play.passing = false; const who = play.st.order[play.st.turn], pk = play.d.actions.find(x=>x.id===play.pick);
        if(!pk || evidenceMissing(play.d, pk, play, who).length) break; const before = {seq:play.st.seq, turn:play.st.turn};
        const ballot = ballotOf({action:play.pick, target:play.target, why:play.why.trim(), src:play.src, loc:(play.loc||"").trim(), quote:(play.quote||"").trim().slice(0,QUOTE_MAX), pass:false, name:play.players[who]||"", at:Date.now()});
        const made = resolveMove(play.d, play.st, {action:play.pick, target:play.target, why:[{name:ballot.name, text:ballot.why, src:ballot.src, loc:ballot.loc, quote:ballot.quote}]});
        (play.history = play.history||[]).push(...historyRows(play.d, before, made, [ballot], "local"));
        if(pauseAfter(play.st, made, play.pauseMode||"round")) window.scrollTo(0,0);
        play.pick=null; play.target=""; play.why=""; play.src=""; play.loc=""; play.quote=""; saveLocal(); render(); break; }
      case "pass": { if(!passWhyOk(play.passWhy)) break; const before = {seq:play.st.seq, turn:play.st.turn}, who = play.st.order[play.st.turn], pwhy = play.passWhy.trim();
        play.passing = false; play.passWhy = "";
        const made = resolveMove(play.d, play.st, {pass:true});
        (play.history = play.history||[]).push(...historyRows(play.d, before, made, [{name:play.players[who]||"", pass:true, action:"", target:"", why:pwhy, src:"", loc:"", quote:""}], "local"));
        if(pauseAfter(play.st, made, play.pauseMode||"round")) window.scrollTo(0,0);
        play.pick=null; play.why=""; saveLocal(); render(); break; }
      case "end-early":
        if(play && play.mode==="host"){ hostDo("end"); break; }
        if(play && play.st){ play.st.over = true; play.st.pause = null; saveLocal(); render(); window.scrollTo(0,0); } break;
      case "quit":
        if(play && play.mode==="host"){ if(b.dataset.confirm) hostDo("close"); else { b.dataset.confirm = "1"; b.textContent = "Click again to close and delete this game"; } break; }
        store.set("tt.local", null); play = null; render(); break;
      case "voice": askVoice(b.dataset.id); break;
      case "send-fb": {
        const m = $("#fbmsg"); const r = await api.sendFeedback({designId:b.dataset.id, nickname:(join&&join.data&&join.data.seat?join.data.seat.nickname:nick)||"", trap:$("#fb-trap").value, text:$("#fb-text").value});
        if(m) m.textContent = r.ok ? "Sent. Thank you." : r.error; if(r.ok){ $("#fb-trap").value=""; $("#fb-text").value=""; } break; }
      case "claim": phoneDo(()=>api.claimCourt({roomId:join.roomId, actor:b.dataset.id})); break;
      case "ph-leave": await api.leaveRoom({roomId:join.roomId}); store.set("tt.join."+join.code, null); stopLive(); join = null; location.hash = "#join"; render(); break;
      case "ph-forget": store.set("tt.join."+join.code, null); stopLive(); join = null; location.hash = "#join"; render(); break;
      case "ph-pick": join.pick = b.dataset.id; join.target = ""; join.passing = false; render(); break;
      case "ph-audit-open": join.auditOpen = Number(b.dataset.seq); render(); { const x = $("#ph-audit"); if(x) x.focus(); } break;
      case "ph-audit-cancel": join.auditOpen = null; render(); break;
      case "ph-audit-send": { const seq = Number(b.dataset.seq), text = cleanAudit(join.auditDraft); if(!auditOk(text)) break;
        join.busy = true; join.msg = ""; render();
        const r = await api.submitAudit({roomId:join.roomId, seq, text}); join.busy = false;
        if(r.ok){ (join.audited = join.audited||{})[seq] = text; join.auditOpen = null; join.auditDraft = ""; } else join.msg = r.error;
        render(); break; }
      case "ph-lens": join.lens = join.lens===b.dataset.id ? null : b.dataset.id; render(); break;
      case "ph-mv": { const n = (join.hist||[]).filter(r=>r.kind==="action").length; const cur = join.mv==null||join.mv>=n ? n-1 : join.mv; join.mv = Math.max(0, Math.min(n-1, cur + Number(b.dataset.d))); render(); break; }
      case "ph-caught": store.set("tt.caught."+join.data.room.code, true); render(); window.scrollTo(0,0); break;
      case "ph-send": { const d = join.data.design, pk = d.actions.find(x=>x.id===join.pick), st = join.data.room.state;
        if(!pk || evidenceMissing(d, pk, join, join.data.seat.actor).length) break;
        join.passing = false;
        phoneDo(()=>api.submitVote({roomId:join.roomId, seq:st.seq, action:join.pick, target:join.target, why:join.why.trim(), src:join.src, loc:(join.loc||"").trim(), quote:(join.quote||"").trim()})); break; }
      case "ph-pass": { if(!passWhyOk(join.passWhy)) break; const st = join.data.room.state, why = join.passWhy.trim(); join.passing = false; join.passWhy = ""; phoneDo(()=>api.submitVote({roomId:join.roomId, seq:st.seq, pass:true, why})); break; }
      case "ph-pass-open": join.passing = true; render(); $("#ph-passwhy")?.focus(); break;
      case "ph-pass-cancel": join.passing = false; render(); break;
      case "pass-open": play.passing = true; saveLocal(); render(); $("#passwhy")?.focus(); break;
      case "pass-cancel": play.passing = false; saveLocal(); render(); break;
    }
  }
  const onHash = () => render();
  const onToggle = e => {
    const sec = e.target && e.target.dataset && e.target.dataset.sec;
    if(sec){ manualOpen = manualOpen.filter(x=>x!==sec).concat(e.target.open ? [sec] : []); return; }
    const k = e.target && e.target.dataset && e.target.dataset.keep; if(k && play) play[k] = e.target.open; };
  const onKey = e => {
    if(e.key==="Escape" && play && play.drawer){ play.drawer = ""; render(); return; }
    const tok = e.target && e.target.closest && e.target.closest("[data-court]");
    if(tok && (e.key==="Enter" || e.key===" ") && join){ e.preventDefault(); join.lens = tok.dataset.court; render(); }
  };

  /* The advisory discussion timer only updates its own text; it never re-renders or advances the game. */
  const timerTick = setInterval(()=>{ const el = $("#ptimer"); if(el && play && play.timer) el.textContent = timerText(play.timer); }, 500);
  root.addEventListener("submit", onSubmit);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  root.addEventListener("focusout", onFocusOut);
  root.addEventListener("pointerdown", onPointerDown); window.addEventListener("pointerup", onPointerUp);
  root.addEventListener("toggle", onToggle, true);
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", onHash);
  render();
  void POLICY;
  return () => {
    disposed = true; stopLive(); clearInterval(timerTick);
    root.removeEventListener("submit", onSubmit); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange);
    root.removeEventListener("click", onClick); root.removeEventListener("focusout", onFocusOut); root.removeEventListener("pointerdown", onPointerDown); window.removeEventListener("pointerup", onPointerUp); window.removeEventListener("hashchange", onHash);
    root.removeEventListener("toggle", onToggle, true); document.removeEventListener("keydown", onKey); document.body.classList.remove("stage");
  };
}
