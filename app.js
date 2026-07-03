/* ================= FIREBASE-OPPSETT =================
   Lim inn din egen config fra Firebase-konsollen her.
   Se OPPSETT.md for steg-for-steg-guide.
   Så lenge apiKey starter med "DIN_" kjører appen i
   lokal modus (uten synk mellom telefoner).           */
const firebaseConfig = {
  apiKey: "AIzaSyB5QkJuW6By3DxZoH-SFdAmTIzuVSR9v2Q",
  authDomain: "famliste-3b8f2.firebaseapp.com",
  databaseURL: "https://famliste-3b8f2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "famliste-3b8f2",
  storageBucket: "famliste-3b8f2.firebasestorage.app",
  messagingSenderId: "74086518112",
  appId: "1:74086518112:web:d31e9965269fd0382de205"
};
/* ==================================================== */

const LS_KEY = 'famliste_data_v1';
const LS_SET = 'famliste_settings_v1';

let settings = Object.assign(
  { p1: 'Person1', p2: 'Person2', code: '' },
  JSON.parse(localStorage.getItem(LS_SET) || '{}')
);

let state = { events: {}, shopping: {}, goal: {} };
let tab = 'cal';
let calView = 'month';
let cursor = new Date();         // dato kalenderen er "på"
let editingId = null;
let selDay = todayIso();     // valgt dag i månedsvisningen
let firebaseOn = false;
let dbRef = null;

/* ---------- Hjelpere ---------- */
const $ = s => document.querySelector(s);
const DAYS = ['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag'];
const DAYS_SHORT = ['ma','ti','on','to','fr','lø','sø'];
const MONTHS = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function fromIso(s) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
function todayIso() { return iso(new Date()); }
function mondayOf(d) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function weekNo(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(x.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((x - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
}
function ownerName(o) { return o === 'p1' ? settings.p1 : o === 'p2' ? settings.p2 : 'Felles'; }
function ownerColor(o) { return o === 'p1' ? 'var(--p1)' : o === 'p2' ? 'var(--p2)' : 'var(--felles)'; }
function ownerBg(o) { return o === 'p1' ? 'var(--p1-bg)' : o === 'p2' ? 'var(--p2-bg)' : 'var(--felles-bg)'; }
function ownerInitial(o) { return o === 'felles' ? 'F' : (ownerName(o).trim()[0] || '?').toUpperCase(); }
function avatarHtml(o, extra) {
  return `<span class="avatar ${extra || ''}" style="background:${ownerColor(o)}" title="${esc(ownerName(o))}">${esc(ownerInitial(o))}</span>`;
}
function nextOwner(o) { return o === 'p1' ? 'p2' : o === 'p2' ? 'felles' : 'p1'; }
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- Konfetti ---------- */
function confettiColors() {
  const cs = getComputedStyle(document.documentElement);
  return [cs.getPropertyValue('--p1'), cs.getPropertyValue('--p2'),
          cs.getPropertyValue('--felles'), cs.getPropertyValue('--accent'), '#f2c94c'];
}
function confettiBurst(x, y, n) {
  const colors = confettiColors();
  for (let i = 0; i < (n || 22); i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.background = colors[i % colors.length];
    document.body.appendChild(el);
    const ang = Math.random() * 2 * Math.PI;
    const dist = 50 + Math.random() * 90;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * .7 - 50;
    el.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy + 150}px) rotate(${300 + Math.random() * 400}deg) scale(.5)`, opacity: 0 }
    ], { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.3,1)' }).onfinish = () => el.remove();
  }
}
function bigCelebration() {
  // konfettiregn over hele skjermen
  for (let i = 0; i < 70; i++) {
    setTimeout(() => confettiBurst(Math.random() * window.innerWidth, -20 + Math.random() * 60, 1), i * 18);
  }
}

/* ---------- Lagring / synk ---------- */
function saveSettings() { localStorage.setItem(LS_SET, JSON.stringify(settings)); }

function initSync() {
  const configured = !firebaseConfig.apiKey.startsWith('DIN_');
  if (configured && settings.code) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      dbRef = firebase.database().ref('families/' + settings.code.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      dbRef.on('value', snap => {
        const v = snap.val() || {};
        state.events = v.events || {};
        state.shopping = v.shopping || {};
        state.goal = v.goal || {};
        firebaseOn = true;
        render();
      }, err => {
        console.error(err); firebaseOn = false; loadLocal(); render();
      });
      return;
    } catch (e) { console.error(e); }
  }
  firebaseOn = false;
  loadLocal();
}
function loadLocal() {
  const v = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  state.events = v.events || {};
  state.shopping = v.shopping || {};
  state.goal = v.goal || {};
}
function persistLocal() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

function writeItem(coll, id, obj) {
  if (firebaseOn && dbRef) dbRef.child(coll + '/' + id).set(obj);
  else { state[coll][id] = obj; persistLocal(); render(); }
}
function removeItem(coll, id) {
  if (firebaseOn && dbRef) dbRef.child(coll + '/' + id).remove();
  else { delete state[coll][id]; persistLocal(); render(); }
}
function writeBatch(coll, map) {
  // map: { id: obj | null } der null sletter
  if (firebaseOn && dbRef) dbRef.child(coll).update(map);
  else {
    Object.entries(map).forEach(([id, obj]) => {
      if (obj === null) delete state[coll][id]; else state[coll][id] = obj;
    });
    persistLocal(); render();
  }
}
function writeGoal(g) {
  if (firebaseOn && dbRef) dbRef.child('goal').set(g);
  else { state.goal = g; persistLocal(); render(); }
}
function goalOn() { return !!(state.goal && state.goal.on); }
function earnedPoints() { return (state.goal && state.goal.earned) || 0; }
function addPoints(n) {
  writeGoal(Object.assign({}, state.goal, { earned: Math.max(0, earnedPoints() + n) }));
}

/* ---------- Render ---------- */
function render() {
  $('#subTitle').textContent = settings.p1 + ' & ' + settings.p2;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#fab').style.display = tab === 'cal' ? 'block' : 'none';
  if (tab === 'cal') renderCal();
  else if (tab === 'shop') renderShop();
  else renderTodo();
}

function syncBannerHtml() {
  if (firebaseOn) return '';
  const configured = !firebaseConfig.apiKey.startsWith('DIN_');
  const msg = configured
    ? '<b>Kalenderen deles ikke ennå.</b> Trykk her (eller på tannhjulet øverst), finn feltet «Familiekode» og velg en hemmelig kode. Skriv inn nøyaktig samme kode på begge telefonene, så synkes kalender, handleliste og gjøremål automatisk mellom dere.'
    : '<b>Lokal modus.</b> Data lagres kun på denne enheten. For synk mellom telefoner må Firebase settes opp først. Se OPPSETT.md i app-mappen.';
  return `<div class="sync-banner local" data-open-settings>${msg}</div>`;
}

/* ----- Kalender ----- */
function renderCal() {
  let html = syncBannerHtml();
  html += `<div class="cal-controls">
    <div class="seg">
      <button data-v="month" class="${calView==='month'?'active':''}">Måned</button>
      <button data-v="week" class="${calView==='week'?'active':''}">Uke</button>
      <button data-v="day" class="${calView==='day'?'active':''}">Dag</button>
    </div>
    <div class="cal-nav">
      <button id="navPrev">&#8249;</button>
      <button id="navToday">I dag</button>
      <button id="navNext">&#8250;</button>
    </div>
  </div>`;

  if (calView === 'month') html += renderMonth();
  else if (calView === 'week') html += renderWeek();
  else html += renderDay();

  // Valgt dag vises under månedskalenderen
  if (calView === 'month') {
    const d = fromIso(selDay);
    const wd = DAYS[(d.getDay() + 6) % 7];
    html += `<div class="up-title">${wd} ${d.getDate()}. ${MONTHS[d.getMonth()]}${selDay === todayIso() ? ' &middot; i dag' : ''}</div>`;
    const evs = eventsOn(selDay);
    if (!evs.length) html += '<div class="empty-day">Ingenting planlagt denne dagen. Trykk + for å legge til.</div>';
    else evs.forEach(([id, e]) => html += eventCard(id, e, selDay));
  }

  $('#main').innerHTML = html;

  document.querySelectorAll('.seg button').forEach(b =>
    b.onclick = () => { calView = b.dataset.v; render(); });
  $('#navPrev').onclick = () => { nav(-1); };
  $('#navNext').onclick = () => { nav(1); };
  $('#navToday').onclick = () => { cursor = new Date(); selDay = todayIso(); render(); };
  bindItemHandlers();
}

function nav(dir) {
  if (calView === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
  else if (calView === 'week') cursor = addDays(cursor, 7 * dir);
  else cursor = addDays(cursor, dir);
  render();
}

function isOvernight(e) {
  // sluttid før starttid uten til-dato = jobber/varer inn i neste dag
  return !e.end && e.time && e.timeEnd && e.timeEnd < e.time;
}
function effEnd(e) {
  if (e.end) return e.end;
  if (isOvernight(e)) return iso(addDays(fromIso(e.date), 1));
  return e.date;
}
function eventsOn(dIso) {
  return Object.entries(state.events)
    .filter(([, e]) => e.date && e.date <= dIso && dIso <= effEnd(e))
    .sort((a, b) => {
      // flerdagshendelser øverst, deretter etter klokkeslett
      const am = a[1].end ? 1 : 0, bm = b[1].end ? 1 : 0;
      if (am !== bm) return bm - am;
      return (a[1].time || '99') < (b[1].time || '99') ? -1 : 1;
    });
}
function spanInfo(e, dIso) {
  // returnerer "dag X av N" for hendelser som strekker seg over flere dager
  const end = effEnd(e);
  if (end <= e.date) return null;
  const total = Math.round((fromIso(end) - fromIso(e.date)) / 86400000) + 1;
  const idx = Math.round((fromIso(dIso) - fromIso(e.date)) / 86400000) + 1;
  return { idx, total };
}

function renderMonth() {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  let html = `<div class="cal-label">${MONTHS[m]} ${y}</div>`;
  html += '<div class="month-grid">';
  DAYS_SHORT.forEach(d => html += `<div class="dow">${d}</div>`);
  const first = mondayOf(new Date(y, m, 1));
  const tIso = todayIso();
  for (let i = 0; i < 42; i++) {
    const d = addDays(first, i);
    if (i === 35 && d.getMonth() !== m) break;
    const dIso = iso(d);
    const evs = eventsOn(dIso);
    const cls = ['mday'];
    if (d.getMonth() !== m) cls.push('other');
    if (dIso === tIso) cls.push('today');
    if (dIso === selDay) cls.push('selected');
    html += `<div class="${cls.join(' ')}" data-day="${dIso}"><span class="num">${d.getDate()}</span>`;
    evs.slice(0, 3).forEach(([id, e]) => {
      const sp = spanInfo(e, dIso);
      const cont = sp && sp.idx > 1 ? (isOvernight(e) ? '&#8594;' + (e.timeEnd || '') + ' ' : '&#8596; ') : '';
      html += `<div class="mev ${e.done ? 'done' : ''}" style="background:${ownerBg(e.owner)};color:${ownerColor(e.owner)}"><b>${esc(ownerInitial(e.owner))}</b>·${cont}${esc(e.title)}</div>`;
    });
    if (evs.length > 3) html += `<div class="more">+${evs.length - 3}</div>`;
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderWeek() {
  const mon = mondayOf(cursor);
  let html = `<div class="cal-label">Uke ${weekNo(mon)} · ${mon.getDate()}. ${MONTHS[mon.getMonth()].slice(0,3)} til ${addDays(mon,6).getDate()}. ${MONTHS[addDays(mon,6).getMonth()].slice(0,3)}</div>`;
  const tIso = todayIso();
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const dIso = iso(d);
    const evs = eventsOn(dIso);
    html += `<div class="day-block">
      <div class="day-head ${dIso === tIso ? 'today' : ''}" data-day="${dIso}">
        <span class="dname">${DAYS[i]}</span><span class="ddate">${d.getDate()}. ${MONTHS[d.getMonth()]}</span>
      </div>`;
    if (!evs.length) html += '<div class="empty-day">Ingen planer</div>';
    else evs.forEach(([id, e]) => html += eventCard(id, e, dIso));
    html += '</div>';
  }
  return html;
}

function renderDay() {
  const dIso = iso(cursor);
  const wd = (cursor.getDay() + 6) % 7;
  let html = `<div class="cal-label">${DAYS[wd]} ${cursor.getDate()}. ${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}${dIso === todayIso() ? ' · i dag' : ''}</div>`;
  const evs = eventsOn(dIso);
  if (!evs.length) html += '<div class="empty-day">Ingenting planlagt denne dagen.</div>';
  else evs.forEach(([id, e]) => html += eventCard(id, e, dIso));
  return html;
}

function eventCard(id, e, dIso) {
  const chk = e.type === 'task'
    ? `<button class="chk ${e.done ? 'on' : ''}" data-toggle="${id}">${e.done ? '&#10003;' : ''}</button>` : '';
  const sp = dIso ? spanInfo(e, dIso) : null;
  let timeLbl = e.time || '';
  if (e.time && e.timeEnd) timeLbl = e.time + '-' + e.timeEnd;
  if (sp) {
    if (isOvernight(e)) timeLbl = dIso === e.date
      ? esc(e.time) + '&#8594;'            // startdagen: 16:00→
      : '&#8594;' + esc(e.timeEnd);        // dagen etter: →00:45
    else timeLbl = `dag ${sp.idx}/${sp.total}`;
  }
  return `<div class="card ${e.done ? 'done' : ''}" data-edit="${id}" style="border-left-color:${ownerColor(e.owner)};background:${ownerBg(e.owner)}">
    ${chk}
    <span class="time">${timeLbl}</span>
    <span class="title">${esc(e.title)}${e.note ? `<span class="note">${esc(e.note)}</span>` : ''}</span>
    <button class="avatar" data-cycle="${id}" style="background:${ownerColor(e.owner)}" title="Trykk for å bytte person">${esc(ownerInitial(e.owner))}</button>
  </div>`;
}

/* ----- Handleliste ----- */
function renderShop() {
  let html = syncBannerHtml();
  html += `<div class="add-row">
    <input type="text" id="shopInput" placeholder="Legg til vare..." enterkeyhint="done">
    <button id="shopAdd">+</button>
  </div>`;
  const items = Object.entries(state.shopping).sort((a, b) => a[1].created - b[1].created);
  const open = items.filter(([, i]) => !i.done);
  const done = items.filter(([, i]) => i.done);
  if (!items.length) html += '<div class="empty-day">Handlelisten er tom.</div>';
  open.forEach(([id, i]) => html += shopRow(id, i));
  if (done.length) {
    html += `<div class="list-section"><h3>I handlekurven (${done.length})</h3></div>`;
    done.forEach(([id, i]) => html += shopRow(id, i));
    html += '<button class="clear-btn" id="shopClear">Tøm fullførte</button>';
  }
  $('#main').innerHTML = html;

  const inp = $('#shopInput');
  const add = () => {
    const v = inp.value.trim(); if (!v) return;
    writeItem('shopping', uid(), { title: v, done: false, created: Date.now() });
    inp.value = ''; inp.focus();
  };
  $('#shopAdd').onclick = add;
  inp.onkeydown = e => { if (e.key === 'Enter') add(); };
  const clearBtn = $('#shopClear');
  if (clearBtn) clearBtn.onclick = () => done.forEach(([id]) => removeItem('shopping', id));
  bindItemHandlers();
}
function shopRow(id, i) {
  return `<div class="card ${i.done ? 'done' : ''}" style="border-left-color:var(--accent);cursor:default">
    <button class="chk ${i.done ? 'on' : ''}" data-shop-toggle="${id}">${i.done ? '&#10003;' : ''}</button>
    <span class="title">${esc(i.title)}</span>
    <button class="del-btn" data-shop-del="${id}">&#10005;</button>
  </div>`;
}

/* ----- Gjøremål ----- */
function renderTodo() {
  let html = syncBannerHtml();
  html += `<div class="add-row">
    <input type="text" id="todoInput" placeholder="Skriv nytt gjøremål..." enterkeyhint="done">
  </div>
  <div class="assign-btns">
    ${['p1', 'p2', 'felles'].map(o =>
      `<button class="assign-btn" data-assign="${o}" style="background:${ownerColor(o)}">+ ${esc(ownerName(o))}</button>`).join('')}
  </div>
  <div class="assign-hint">Skriv oppgaven, og trykk på den som skal ha den${goalOn() ? ' &middot; trykk på poengmerket (1p) for å gjøre en oppgave mer verdt' : ''}</div>`;

  // Gjøremål med dato (f.eks. gjentakende serier) vises først den dagen de gjelder.
  // Fremtidige ligger kun i kalenderen; forfalte blir stående til de gjøres.
  const tIso2 = todayIso();
  const tasks = Object.entries(state.events)
    .filter(([, e]) => e.type === 'task' && (!e.date || e.date <= tIso2));
  const done = tasks.filter(([, e]) => e.done).sort(byDate).reverse();

  // Felles poengmål med premie
  if (goalOn()) {
    const g = state.goal;
    if (g.target) {
      const earned = earnedPoints();
      const pct = Math.min(100, Math.round(earned / g.target * 100));
      const reached = earned >= g.target;
      html += `<div class="progress-wrap">
        <div class="progress-top">
          <span class="plabel">Felles mål</span>
          <span class="pcount">${earned} av ${g.target} poeng &nbsp;<button class="goal-edit" data-goal-edit>endre</button></span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${reached ? 'complete' : ''}" style="width:${pct}%"></div></div>
        <div class="goal-prize ${reached ? 'unlocked' : ''}">${reached
          ? '&#127873; Premien er låst opp: ' + esc(g.prize || 'valgfri premie') + '. Vel fortjent!'
          : '&#127873; Premie: ' + esc(g.prize || 'ikke satt') + ''}</div>
      </div>`;
    } else {
      html += `<button class="goal-setup" data-goal-edit>&#127873; Sett poengmål og premie</button>`;
    }
  }

  // Progresjon
  if (tasks.length) {
    const pct = Math.round(done.length / tasks.length * 100);
    const complete = done.length === tasks.length;
    html += `<div class="progress-wrap">
      <div class="progress-top">
        <span class="plabel">${complete ? 'Alt fullført!' : 'Dagens fremdrift'}</span>
        <span class="pcount">${done.length} av ${tasks.length}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill ${complete ? 'complete' : ''}" style="width:${pct}%"></div></div>
      ${complete ? '<div class="all-done">&#127881; Dere er ferdige! Nyt resten av dagen.</div>' : ''}
    </div>`;
  }

  // Tre faste felt, ett per person + felles
  ['p1', 'p2', 'felles'].forEach(o => {
    const list = tasks.filter(([, e]) => !e.done && e.owner === o).sort(byDate);
    const hasDone = done.some(([, e]) => e.owner === o);
    html += `<div class="owner-section" style="background:${ownerBg(o)};border-color:${ownerColor(o)}">
      <div class="owner-head" style="color:${ownerColor(o)}">${avatarHtml(o)}${esc(ownerName(o))}<span class="cnt">${list.length ? list.length : '&#10003;'}</span></div>`;
    if (!list.length) html += `<div class="empty-day">${hasDone ? 'Alt gjort! &#11088;' : 'Ingen oppgaver'}</div>`;
    else list.forEach(([id, e]) => html += todoRow(id, e));
    html += '</div>';
  });

  if (done.length) {
    html += `<div class="list-section"><h3>Fullført (${done.length})</h3></div>`;
    done.slice(0, 10).forEach(([id, e]) => html += todoRow(id, e));
    html += '<button class="clear-btn" id="todoClear">Slett fullførte</button>';
  }
  $('#main').innerHTML = html;

  const inp = $('#todoInput');
  const add = owner => {
    const v = inp.value.trim();
    if (!v) { toast('Skriv gjøremålet først'); inp.focus(); return; }
    writeItem('events', uid(), { title: v, type: 'task', date: '', time: '', owner, note: '', points: 1, done: false, created: Date.now() });
    toast('Lagt til hos ' + ownerName(owner));
    inp.value = ''; inp.focus();
  };
  document.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => add(b.dataset.assign));
  inp.onkeydown = e => { if (e.key === 'Enter') add('felles'); };
  const clearBtn = $('#todoClear');
  if (clearBtn) clearBtn.onclick = () => done.forEach(([id]) => removeItem('events', id));
  document.querySelectorAll('[data-goal-edit]').forEach(b => b.onclick = openGoal);
  bindItemHandlers();
}
function byDate(a, b) { return (a[1].date || '9999') < (b[1].date || '9999') ? -1 : 1; }
function todoRow(id, e) {
  const over = !e.done && e.date && (e.end || e.date) < todayIso();
  const dateLbl = e.date ? `<span class="note ${over ? 'due-over' : ''}">${over ? '&#9888; ' : ''}${fmtShort(e.date)}${e.end ? '-' + fmtShort(e.end) : ''}${e.time ? ' kl. ' + e.time : ''}</span>` : '';
  const p = e.points || 1;
  const pts = goalOn()
    ? (e.done
        ? `<span class="pts p${p}">${p}p</span>`
        : `<button class="pts p${p}" data-pts="${id}" title="Trykk for å endre poengverdi">${p}p</button>`)
    : '';
  return `<div class="card ${e.done ? 'done' : ''}" data-edit="${id}" style="border-left-color:${ownerColor(e.owner)}">
    <button class="chk ${e.done ? 'on' : ''}" data-toggle="${id}">${e.done ? '&#10003;' : ''}</button>
    <span class="title">${esc(e.title)}${dateLbl}</span>
    ${pts}
    <button class="avatar" data-cycle="${id}" style="background:${ownerColor(e.owner)}" title="Trykk for å flytte til neste person">${esc(ownerInitial(e.owner))}</button>
  </div>`;
}
function fmtShort(dIso) { const d = fromIso(dIso); return d.getDate() + '. ' + MONTHS[d.getMonth()].slice(0, 3); }

/* ---------- Felles klikk-håndtering ---------- */
function bindItemHandlers() {
  document.querySelectorAll('[data-open-settings]').forEach(b =>
    b.onclick = () => $('#settingsBtn').onclick());
  document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const id = b.dataset.toggle;
    const e = state.events[id]; if (!e) return;
    const nowDone = !e.done;
    if (nowDone) {
      const r = b.getBoundingClientRect();
      confettiBurst(r.left + r.width / 2, r.top + r.height / 2);
      // fremtidige daterte gjøremål (serier) teller ikke som "gjenstående" i dag
      const tNow = todayIso();
      const openTasks = Object.entries(state.events).filter(([tid, t]) =>
        t.type === 'task' && !t.done && tid !== id && (!t.date || t.date <= tNow));
      // premie-sjekk: krysser vi målet med denne oppgaven?
      if (e.type === 'task' && goalOn() && state.goal.target) {
        const before = earnedPoints();
        const after = before + (e.points || 1);
        if (before < state.goal.target && after >= state.goal.target) {
          setTimeout(bigCelebration, 250);
          toast('Premien er låst opp: ' + (state.goal.prize || 'valgfri premie') + '!');
        }
      }
      if (e.type === 'task' && !openTasks.length) {
        setTimeout(bigCelebration, 250);
        toast('Alle gjøremål fullført!');
      } else if (e.type === 'task' && !openTasks.some(([, t]) => t.owner === e.owner)) {
        toast(ownerName(e.owner) + ' er ferdig med alt sitt!');
      }
    }
    writeItem('events', id, Object.assign({}, e, { done: nowDone, doneAt: nowDone ? Date.now() : null }));
    // oppdater felles poengsum (trekkes fra igjen hvis man angrer avhukingen)
    if (e.type === 'task' && goalOn()) addPoints(nowDone ? (e.points || 1) : -(e.points || 1));
  });
  document.querySelectorAll('[data-edit]').forEach(c => c.onclick = () => openEvent(c.dataset.edit));
  document.querySelectorAll('[data-day]').forEach(c => c.onclick = () => {
    cursor = fromIso(c.dataset.day);
    if (c.classList.contains('mday')) { selDay = c.dataset.day; render(); } // vis dagen under kalenderen
    else openEvent(null, c.dataset.day); // ukevisning: trykk på dagoverskrift = ny oppføring
  });
  document.querySelectorAll('[data-shop-toggle]').forEach(b => b.onclick = () => {
    const id = b.dataset.shopToggle;
    const i = state.shopping[id]; if (!i) return;
    writeItem('shopping', id, Object.assign({}, i, { done: !i.done }));
  });
  document.querySelectorAll('[data-shop-del]').forEach(b => b.onclick = () => removeItem('shopping', b.dataset.shopDel));
  document.querySelectorAll('[data-pts]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const id = b.dataset.pts;
    const e = state.events[id]; if (!e || e.done) return;
    const p = (e.points || 1) % 3 + 1; // 1 → 2 → 3 → 1
    writeItem('events', id, Object.assign({}, e, { points: p }));
  });
  document.querySelectorAll('[data-cycle]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const id = b.dataset.cycle;
    const e = state.events[id]; if (!e) return;
    const o = nextOwner(e.owner);
    writeItem('events', id, Object.assign({}, e, { owner: o }));
    toast('Flyttet til ' + ownerName(o));
  });
}

/* ---------- Hendelse-modal ---------- */
let evType = 'event', evOwner = 'felles', evPoints = 1;
let multiDates = new Set(), multiCursor = new Date();

function renderMultiCal() {
  const y = multiCursor.getFullYear(), m = multiCursor.getMonth();
  $('#mcLabel').textContent = MONTHS[m] + ' ' + y;
  let html = DAYS_SHORT.map(d => `<div class="mdow">${d}</div>`).join('');
  const first = mondayOf(new Date(y, m, 1));
  const tIso = todayIso();
  for (let i = 0; i < 42; i++) {
    const d = addDays(first, i);
    if (i === 35 && d.getMonth() !== m) break;
    const dIso = iso(d);
    const cls = ['mini-day'];
    if (d.getMonth() !== m) cls.push('other');
    if (dIso === tIso) cls.push('today');
    if (multiDates.has(dIso)) cls.push('sel');
    html += `<button type="button" class="${cls.join(' ')}" data-mday="${dIso}">${d.getDate()}</button>`;
  }
  $('#evMultiCal').innerHTML = html;
  $('#mcCount').textContent = multiDates.size
    ? multiDates.size + ' dag' + (multiDates.size > 1 ? 'er' : '') + ' valgt'
    : 'Ingen dager valgt ennå';
  document.querySelectorAll('[data-mday]').forEach(b => b.onclick = () => {
    const d = b.dataset.mday;
    if (multiDates.has(d)) multiDates.delete(d); else multiDates.add(d);
    renderMultiCal();
  });
}
$('#mcPrev').onclick = () => { multiCursor = new Date(multiCursor.getFullYear(), multiCursor.getMonth() - 1, 1); renderMultiCal(); };
$('#mcNext').onclick = () => { multiCursor = new Date(multiCursor.getFullYear(), multiCursor.getMonth() + 1, 1); renderMultiCal(); };
$('#evMultiOn').onchange = () => {
  const on = $('#evMultiOn').checked;
  $('#evMultiField').style.display = on ? 'block' : 'none';
  $('#evDateRow').style.display = on ? 'none' : 'flex';
  $('#evRepeatField').style.display = on ? 'none' : 'block';
  if (on) {
    multiDates.clear();
    const d = $('#evDate').value;
    if (d) { multiDates.add(d); multiCursor = fromIso(d); }
    renderMultiCal();
  }
};

// genererer datoer for gjentakelse (maks ~6 mnd frem)
function repeatDates(startIso, mode) {
  const out = [startIso];
  const start = fromIso(startIso);
  if (mode === 'm') {
    const day = start.getDate();
    for (let k = 1; k <= 6; k++) {
      const d = new Date(start.getFullYear(), start.getMonth() + k, day);
      if (d.getDate() === day) out.push(iso(d)); // hopper over f.eks. 31. i korte måneder
    }
  } else {
    const step = Number(mode);
    const horizon = addDays(start, 183);
    let d = addDays(start, step);
    while (d <= horizon && out.length < 60) { out.push(iso(d)); d = addDays(d, step); }
  }
  return out;
}

function openEvent(id, presetDate) {
  editingId = id;
  const e = id ? state.events[id] : null;
  $('#evTitle').textContent = id ? 'Rediger' : 'Ny oppføring';
  $('#evName').value = e ? e.title : '';
  $('#evDate').value = e ? e.date : (presetDate || iso(cursor));
  $('#evEnd').value = e ? (e.end || '') : '';
  $('#evTime').value = e ? e.time : '';
  $('#evTimeEnd').value = e ? (e.timeEnd || '') : '';
  $('#evNote').value = e ? e.note || '' : '';
  evType = e ? e.type : 'event';
  evOwner = e ? e.owner : 'felles';
  evPoints = e ? (e.points || 1) : 1;
  $('#evDelete').style.display = id ? 'block' : 'none';
  // flervalg og gjentakelse gjelder bare nye oppføringer
  $('#evMultiToggle').style.display = id ? 'none' : 'block';
  $('#evRepeatField').style.display = id ? 'none' : 'block';
  $('#evMultiField').style.display = 'none';
  $('#evDateRow').style.display = 'flex';
  $('#evMultiOn').checked = false;
  $('#evRepeat').value = '0';
  multiDates.clear();
  paintPicks();
  $('#eventOverlay').classList.add('open');
  if (!id) setTimeout(() => $('#evName').focus(), 100);
}
function paintPicks() {
  document.querySelectorAll('#evTypePick button').forEach(b =>
    b.className = b.dataset.val === evType ? 'sel-felles' : '');
  // poengfeltet vises bare for gjøremål når poengsystemet er på
  $('#evPointsField').style.display = (evType === 'task' && goalOn()) ? 'block' : 'none';
  document.querySelectorAll('#evPointsPick button').forEach(b =>
    b.className = b.dataset.val === String(evPoints) ? 'sel-felles' : '');
  document.querySelectorAll('#evOwnerPick button').forEach(b => {
    const o = b.dataset.val;
    b.className = o === evOwner ? 'sel-' + evOwner : '';
    b.innerHTML = avatarHtml(o) + esc(ownerName(o));
  });
}
document.querySelectorAll('#evTypePick button').forEach(b => b.onclick = () => { evType = b.dataset.val; paintPicks(); });
document.querySelectorAll('#evPointsPick button').forEach(b => b.onclick = () => { evPoints = Number(b.dataset.val); paintPicks(); });
document.querySelectorAll('#evOwnerPick button').forEach(b => b.onclick = () => { evOwner = b.dataset.val; paintPicks(); });

$('#evSave').onclick = () => {
  const title = $('#evName').value.trim();
  if (!title) { toast('Skriv inn hva det gjelder'); return; }
  let date = $('#evDate').value || '';
  let end = $('#evEnd').value || '';
  if (end && date && end < date) { const t = date; date = end; end = t; } // bytt om hvis feil rekkefølge
  if (end && end <= date) end = ''; // samme dag = vanlig endagshendelse
  const time = $('#evTime').value || '';
  const timeEnd = time ? ($('#evTimeEnd').value || '') : ''; // sluttid uten starttid ignoreres
  const obj = {
    title,
    type: evType,
    date,
    end,
    time,
    timeEnd,
    points: evPoints,
    owner: evOwner,
    note: $('#evNote').value.trim(),
    done: editingId ? (state.events[editingId] && state.events[editingId].done) || false : false,
    doneAt: editingId ? (state.events[editingId] && state.events[editingId].doneAt) || null : null,
    seriesId: editingId ? (state.events[editingId] && state.events[editingId].seriesId) || null : null,
    created: editingId ? (state.events[editingId] && state.events[editingId].created) || Date.now() : Date.now()
  };
  const multiOn = !editingId && $('#evMultiOn').checked && multiDates.size > 0;
  const repeat = !editingId && !multiOn ? $('#evRepeat').value : '0';

  if (multiOn) {
    // én separat hendelse per valgt dag
    const seriesId = uid();
    const batch = {};
    [...multiDates].sort().forEach(dIso => {
      batch[uid()] = Object.assign({}, obj, { date: dIso, end: '', seriesId });
    });
    writeBatch('events', batch);
    toast(multiDates.size + ' dager lagt inn');
  } else if (repeat !== '0' && obj.date) {
    // gjentakende serie ~6 måneder frem
    const seriesId = uid();
    const deltaEnd = obj.end ? Math.round((fromIso(obj.end) - fromIso(obj.date)) / 86400000) : 0;
    const batch = {};
    const dates = repeatDates(obj.date, repeat);
    dates.forEach(dIso => {
      batch[uid()] = Object.assign({}, obj, {
        date: dIso,
        end: deltaEnd ? iso(addDays(fromIso(dIso), deltaEnd)) : '',
        seriesId
      });
    });
    writeBatch('events', batch);
    toast('Lagt inn ' + dates.length + ' ganger fremover');
  } else {
    writeItem('events', editingId || uid(), obj);
  }
  $('#eventOverlay').classList.remove('open');
};
$('#evCancel').onclick = () => $('#eventOverlay').classList.remove('open');
$('#evDelete').onclick = () => {
  if (!editingId) return;
  const e = state.events[editingId];
  const series = e && e.seriesId
    ? Object.entries(state.events).filter(([, x]) => x.seriesId === e.seriesId)
    : [];
  if (series.length > 1) {
    if (confirm('Denne er del av en serie på ' + series.length + '. Slette HELE serien?\n(Avbryt = slett bare denne ene)')) {
      const batch = {};
      series.forEach(([id]) => batch[id] = null);
      writeBatch('events', batch);
      toast('Serien er slettet');
    } else if (confirm('Slette bare denne ene?')) {
      removeItem('events', editingId);
    } else {
      return;
    }
  } else {
    if (!confirm('Slette denne?')) return;
    removeItem('events', editingId);
  }
  $('#eventOverlay').classList.remove('open');
};
$('#eventOverlay').onclick = e => { if (e.target.id === 'eventOverlay') $('#eventOverlay').classList.remove('open'); };

/* ---------- Mål-modal ---------- */
function openGoal() {
  $('#goalTarget').value = state.goal.target || '';
  $('#goalPrize').value = state.goal.prize || '';
  $('#goalOverlay').classList.add('open');
}
$('#goalCancel').onclick = () => $('#goalOverlay').classList.remove('open');
$('#goalReset').onclick = () => {
  if (confirm('Nullstille poengsummen til 0?')) {
    writeGoal(Object.assign({}, state.goal, { earned: 0 }));
    $('#goalOverlay').classList.remove('open');
    toast('Poeng nullstilt');
  }
};
$('#goalOverlay').onclick = e => { if (e.target.id === 'goalOverlay') $('#goalOverlay').classList.remove('open'); };
$('#goalSave').onclick = () => {
  const target = parseInt($('#goalTarget').value, 10) || 0;
  const prize = $('#goalPrize').value.trim();
  writeGoal(Object.assign({}, state.goal, { on: true, target, prize }));
  $('#goalOverlay').classList.remove('open');
  toast(target ? 'Målet er satt' : 'Mål fjernet');
};

/* ---------- Innstillinger ---------- */
$('#settingsBtn').onclick = () => {
  $('#setP1').value = settings.p1;
  $('#setP2').value = settings.p2;
  $('#setCode').value = settings.code;
  $('#setPoints').checked = goalOn();
  const configured = !firebaseConfig.apiKey.startsWith('DIN_');
  $('#setSyncInfo').textContent = configured
    ? (firebaseOn ? 'Synk er på. Dere deler data via familiekoden.' : 'Firebase er satt opp. Skriv inn samme familiekode på begge telefoner for å dele data.')
    : 'Firebase er ikke satt opp ennå (se OPPSETT.md). Appen virker lokalt i mellomtiden.';
  $('#setOverlay').classList.add('open');
};
$('#setCancel').onclick = () => $('#setOverlay').classList.remove('open');
$('#setOverlay').onclick = e => { if (e.target.id === 'setOverlay') $('#setOverlay').classList.remove('open'); };
$('#setSave').onclick = () => {
  settings.p1 = $('#setP1').value.trim() || 'Person 1';
  settings.p2 = $('#setP2').value.trim() || 'Person 2';
  const newCode = $('#setCode').value.trim();
  const codeChanged = newCode !== settings.code;
  settings.code = newCode;
  saveSettings();
  const pointsOn = $('#setPoints').checked;
  if (pointsOn !== goalOn()) writeGoal(Object.assign({}, state.goal, { on: pointsOn }));
  $('#setOverlay').classList.remove('open');
  if (codeChanged) { if (dbRef) dbRef.off(); initSync(); }
  render();
  toast('Lagret');
};

/* ---------- Tabs & FAB ---------- */
document.querySelectorAll('nav.tabs button').forEach(b =>
  b.onclick = () => { tab = b.dataset.tab; render(); });
$('#fab').onclick = () => openEvent(null);

/* ---------- Service worker ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- Start ---------- */
initSync();
render();
