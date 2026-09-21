// App shell: state machine (title/map/intro/play/clear/gameover/victory),
// HUD, persistence, and the ZamoRun CTAs.

import { VIEW_W, VIEW_H, WORLDS, URLS, SAVE_KEY, PAL } from './constants.js';
import { LEVELS } from './levels.js';
import { buildSprites, drawLogoCube, drawLogoPixel, CHARACTERS } from './sprites.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { buildShareCard } from './sharecard.js';
import { levelForCode } from './codes.js';
import { initConsent } from './analytics.js';

const TOTAL_LEVELS = 12;
const TOTAL_PLUGINS = 27;

// Rotating product facts shown on the COMMIT screen — the visibility hook.
const FACTS = [
  'ZamoRun incluye un servidor MCP integrado: los agentes de IA consultan tu BD directamente.',
  'EXPLAIN visual convierte los planes de consulta en gráficos interactivos.',
  'Los Notebooks SQL mezclan SQL, Markdown y gráficos en un solo documento.',
  'El sistema de plugins usa JSON-RPC: escríbelos en cualquier lenguaje.',
  'Túneles SSH y Kubernetes integrados. Como estas tuberías del juego.',
  'ZamoRun es open source.',
  'El Constructor Visual de Consultas permite hacer JOINs arrastrando. Sin escribir.',
  'PostgreSQL, MySQL, MariaDB y SQLite: compatibles desde el primer día.',
  'Más de 10 temas incluidos. Este juego es básicamente el tema #11.',
];

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const cta = document.getElementById('cta');
const shareBtn = document.getElementById('share');

const app = {
  input: new Input(),
  audio: new AudioSys(),
  sprites: buildSprites(),

  state: 'title',
  stateT: 0,
  menuIdx: 0,
  mapIdx: 0,
  pauseIdx: 0,
  controlsFrom: 'title',
  charId: 'coco',      // selected protagonist (persisted)
  charIdx: 0,          // highlight on the character-select screen
  pinDigits: '',       // access-key entry buffer
  pinMsg: '',
  pinShake: 0,
  pinBusy: false,

  world: 0,
  level: 0,
  lives: 3,
  rows: 0,
  score: 0,
  checkpoint: null,
  deathT: -1,
  lastClear: null,

  unlocked: 0,         // highest reachable global level index (0..11)
  stats: {},           // "world-level" → { best: frames, plugins: [bool×3] }
  carry: null,         // powers held at the flag, granted at next level start

  get gIdx() { return this.world * 4 + this.level; },
  get key() { return `${this.world}-${this.level}`; },

  pluginCount() {
    return Object.values(this.stats).reduce(
      (n, s) => n + (s.plugins || []).filter(Boolean).length, 0);
  },

  addRows(n) {
    this.rows += n;
    if (this.rows % 100 === 0) {
      this.lives++;
      this.audio.oneup();
      game.floatText(game.player.x, game.player.y - 16, '+1 CONEXIÓN', '#34d399');
    }
  },
  addScore(n) { this.score += n; },

  applyChar(id) {
    this.charId = this.sprites.players[id] ? id : 'coco';
    this.sprites.player = this.sprites.players[this.charId];
  },
  setCheckpoint(tx, ty) { this.checkpoint = [tx, ty]; },

  onPlayerDead() { this.deathT = 0; },

  onLevelClear() {
    // powers survive into the next level (consumed by enterLevel, one-shot)
    this.carry = { mcp: game.player.hasMCP, index: game.player.hasIndex, big: game.player.big };
    const st = this.stats[this.key] || { plugins: [false, false, false] };
    const newRecord = st.best === undefined || game.frame < st.best;
    st.best = Math.min(st.best ?? 1e9, game.frame);
    for (const i of game.pluginsGot) st.plugins[i] = true;
    this.stats[this.key] = st;
    this.lastClear = { time: game.frame, newRecord };
    this.unlocked = Math.max(this.unlocked, Math.min(TOTAL_LEVELS - 1, this.gIdx + 1));
    this.save();
    this.setState('clear');
  },

  setState(s) {
    this.state = s;
    this.stateT = 0;
    shareHit = null;
    linkHits = [];
    codeHit = null;
    pinHits = [];
    charHits = [];
    if (s === 'pin') { this.pinDigits = ''; this.pinMsg = ''; this.pinShake = 0; this.pinBusy = false; }
    cta.hidden = !(s === 'title' || s === 'gameover' || s === 'victory');
    // pulse the share button while a finished run is on screen
    document.body.classList.toggle('run-ended', s === 'gameover' || s === 'victory');
    if (s === 'title' || s === 'map') this.audio.playSong(0);
  },

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 2, unlocked: this.unlocked, stats: this.stats, char: this.charId,
      }));
    } catch {}
  },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return;
      if (d.v === 2) {
        this.unlocked = d.unlocked || 0;
        this.stats = d.stats || {};
        if (typeof d.char === 'string') this.charId = d.char;
      } else if (d.world) {
        this.unlocked = d.world * 4; // legacy format
      }
    } catch {}
  },
};

const game = new Game(app);
app.load();
app.applyChar(app.charId);

// ------------------------------------------------------------- mobile ---
const IS_TOUCH = matchMedia('(pointer: coarse)').matches
  || new URLSearchParams(location.search).has('touch');
if (new URLSearchParams(location.search).has('touch')) {
  document.body.classList.add('force-touch');
}

// fullscreen + landscape lock (best effort — iPhone Safari has no fullscreen
// API: there the PWA manifest covers it via add-to-home-screen)
const fsElement = () =>
  document.fullscreenElement || document.webkitFullscreenElement;
const fsRequest = () => {
  const el = document.documentElement;
  return el.requestFullscreen || el.webkitRequestFullscreen;
};
async function enterFullscreen() {
  const req = fsRequest();
  try {
    if (req) await req.call(document.documentElement, { navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {}
}
// iOS Safari (iPhone especially) ships no Fullscreen API and never will; the
// only true fullscreen path there is launching the home-screen PWA. Detect it
// so the button stops failing silently and we guide the user instead.
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = navigator.standalone === true ||
  matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;

const fsHint = document.getElementById('fs-hint');
let fsHintTimer = 0;
function showFsHint() {
  if (!fsHint) return;
  fsHint.hidden = false;
  clearTimeout(fsHintTimer);
  fsHintTimer = setTimeout(() => { fsHint.hidden = true; }, 5200);
}
fsHint?.addEventListener('click', () => { fsHint.hidden = true; });

const fsBtn = document.getElementById('tb-fs');
// Already fullscreen as an installed PWA → the toggle is meaningless; drop it.
if (fsBtn && isStandalone) fsBtn.hidden = true;
fsBtn?.addEventListener('click', async () => {
  if (fsElement()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    try { await exit?.call(document); } catch {}
  } else if (!fsRequest() && isIOS && !isStandalone) {
    showFsHint();           // no API on iOS Safari — tell them how to install
  } else enterFullscreen();
});
// on touch devices go fullscreen on tap — retry on every tap until it sticks
// (one rejected gesture must not permanently disable the attempt); detach
// once fullscreen is active or the API is unavailable (e.g. iPhone Safari).
if (IS_TOUCH) {
  const tryFs = () => {
    if (fsElement() || !fsRequest()) {
      removeEventListener('pointerdown', tryFs);
      return;
    }
    enterFullscreen();
  };
  addEventListener('pointerdown', tryFs);
}

// on-canvas clickable hotspots (480×270 space), set by screens each frame and
// cleared on every state change: SHARE button + an external link button
let shareHit = null;
let linkHits = [];        // external-link hotspots (buttons + inline text links)
let codeHit = null;       // "ENTER ACCESS KEY" button on the map
let pinHits = [];         // PIN keypad button rects: { x, y, w, h, key }
let charHits = [];        // character-select boxes: { x, y, w, h, idx }

const hitTest = (e, rect) => {
  if (!rect) return false;
  const r = canvas.getBoundingClientRect();
  const cx = (e.clientX - r.left) / r.width * VIEW_W;
  const cy = (e.clientY - r.top) / r.height * VIEW_H;
  return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
};

// tapping the playfield acts as "confirm" on menu screens — unless the tap
// lands on a canvas hotspot (SHARE button / external link), which acts instead
canvas.addEventListener('pointerdown', (e) => {
  if (hitTest(e, shareHit)) { e.stopPropagation(); shareScore(); return; }
  for (const l of linkHits) {
    if (hitTest(e, l)) { e.stopPropagation(); window.open(l.url, '_blank', 'noopener'); return; }
  }
  if (hitTest(e, codeHit)) { e.stopPropagation(); app.audio.ensure(); app.setState('pin'); return; }
  if (app.state === 'pin') {
    for (const b of pinHits) {
      if (hitTest(e, b)) { e.stopPropagation(); app.audio.ensure(); pinKey(b.key); return; }
    }
    return;
  }
  if (app.state === 'chars') {
    for (const b of charHits) {
      if (hitTest(e, b)) { e.stopPropagation(); app.audio.ensure(); selectChar(b.idx); return; }
    }
    return;
  }
  if (app.state !== 'play' && app.state !== 'pause') app.input.pressed.start = true;
});

// Draws the SHARE button on the canvas at row y and registers its hit-rect.
function drawShareButton(y) {
  const w = 156, h = 22, x = (VIEW_W - w) / 2;
  shareHit = { x, y, w, h };
  const saved = shareFeedbackT > 0;
  if (saved) shareFeedbackT--;
  ctx.fillStyle = saved ? PAL.green : PAL.cyan;
  ctx.fillRect(x, y, w, h);
  text(saved ? 'GUARDADO · TEXTO COPIADO' : '▦ COMPARTIR PUNTUACIÓN',
    VIEW_W / 2, y + h / 2 + 3, { size: 8, color: '#06121a', bold: true });
}

// Draws a filled link button centered at row y and registers it as a hotspot.
function drawLinkButton(label, url, y, w = 180) {
  const h = 22, x = (VIEW_W - w) / 2;
  linkHits.push({ x, y, w, h, url });
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(x, y, w, h);
  text(label, VIEW_W / 2, y + h / 2 + 3, { size: 8, color: '#06121a', bold: true });
}

// Draws an inline, underlined text link centered at (x, y) and registers a
// hotspot sized to the rendered text (with a few px of padding for easy taps).
function drawTextLink(str, x, y, url, { size = 8, color = PAL.cyan, bold = false } = {}) {
  text(str, x, y, { size, color, bold });
  ctx.font = `${bold ? 'bold ' : ''}${size}px "JetBrains Mono", monospace`;
  const w = ctx.measureText(str).width;
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y + size / 2 + 1, w, 1); // underline
  const pad = 6;
  linkHits.push({ x: x - w / 2 - pad, y: y - size / 2 - pad, w: w + pad * 2, h: size + pad * 2, url });
}

const HINT_MOVE = IS_TOUCH ? '◀ ▶ mover · ▲ saltar · ✦ consulta · ▼ túnel ssh' : '←→ mover · ESPACIO saltar · X consulta · ↓ túnel ssh · P pausa';
const HINT_MENU = IS_TOUCH ? '▼ bajar · ▲ confirmar' : '↑↓ seleccionar · ENTER confirmar';
const HINT_MAP = IS_TOUCH ? '◀ ▶ elegir · ▲ conectar' : 'flechas: elegir · ENTER: conectar · ESC: volver';
const HINT_PLAY = IS_TOUCH ? '◀ ▶ mover · ▲ saltar' : '←→ mover · ESPACIO saltar';

// ------------------------------------------------------------- share CTA ---
// Renders a score card image: shared natively where the Web Share API
// supports files, downloaded (with the caption copied) everywhere else.
// brief on-canvas feedback after a card is generated (download path)
let shareFeedbackT = 0;
async function shareScore() {
  const url = `${URLS.game}?utm_source=share`;
  const text = `Completé ${app.score} puntos y rescaté ${app.pluginCount()}/${TOTAL_PLUGINS} plugins en ZamoRun ▦ — hecho por estudiantes del grupo 1010 AEI de la UTGZ.\n${url}`;
  try {
    const card = buildShareCard({
      score: app.score,
      rows: app.rows,
      plugins: app.pluginCount(),
      totalPlugins: TOTAL_PLUGINS,
      unlocked: Math.min(app.unlocked + 1, TOTAL_LEVELS),
      totalLevels: TOTAL_LEVELS,
    }, app.sprites);
    const blob = await new Promise((r) => card.toBlob(r, 'image/png'));
      const file = new File([blob], 'zamorun-score.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'zamorun-score.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      try { await navigator.clipboard.writeText(text); } catch {}
      shareFeedbackT = 150; // ~2.5s of "saved!" on the canvas button
      if (shareBtn) {
        shareBtn.textContent = '¡imagen guardada + texto copiado!';
        setTimeout(() => (shareBtn.textContent = 'compartir puntuación'), 2200);
      }
    }
  } catch {}
}
shareBtn?.addEventListener('click', shareScore);
if (shareBtn) shareBtn.textContent = 'compartir puntuación';

// ------------------------------------------------------------ state flow ---
function startSession(globalIdx) {
  app.world = Math.floor(globalIdx / 4);
  app.level = globalIdx % 4;
  app.lives = 3;
  app.rows = 0;
  app.score = 0;
  app.checkpoint = null;
  app.carry = null;
  app.setState('intro');
}

// per-level variation on the world theme (boss = level 3 → neutral)
const LEVEL_TRANSPOSE = [0, 5, 7, 0];
const LEVEL_TEMPO = [1, 1.1, 0.92, 1];

function enterLevel() {
  game.loadLevel(app.world, app.level, app.checkpoint);
  if (app.carry) {
    const p = game.player;
    if (app.carry.big) p.grow(game);
    p.hasIndex = !!app.carry.index;
    p.hasMCP = !!app.carry.mcp;
    if (app.carry.big || app.carry.index || app.carry.mcp) {
      game.floatText(p.x + p.w / 2, p.y - 14, 'SESIÓN RESTAURADA', '#34d399');
    }
    app.carry = null;
  }
  app.deathT = -1;
  app.audio.playSong(game.isBossLevel ? 4 : app.world + 1, {
    transpose: LEVEL_TRANSPOSE[app.level],
    tempo: LEVEL_TEMPO[app.level],
  });
  app.setState('play');
}

function nextLevel() {
  app.checkpoint = null;
  const next = app.gIdx + 1;
  if (next >= TOTAL_LEVELS) {
    app.audio.stopSong();
    app.setState('victory');
    return;
  }
  app.world = Math.floor(next / 4);
  app.level = next % 4;
  if (app.level === 0) app.setState('intro');
  else enterLevel();
}

// --------------------------------------------------------- access keys (PIN) ---
function pinKey(k) {
  if (app.pinBusy) return;
  if (k === 'back') { app.pinDigits = app.pinDigits.slice(0, -1); app.pinMsg = ''; app.audio.bump(); return; }
  if (k === 'ok') { if (app.pinDigits.length === 5) submitPin(); return; }
  if (/^[0-9]$/.test(k) && app.pinDigits.length < 5) {
    app.pinDigits += k;
    app.pinMsg = '';
    app.audio.coin();
    if (app.pinDigits.length === 5) submitPin();
  }
}

async function submitPin() {
  if (app.pinBusy || app.pinDigits.length !== 5) return;
  app.pinBusy = true;
  const idx = await levelForCode(app.pinDigits);
  app.pinBusy = false;
  if (idx >= 0) {
    app.unlocked = Math.max(app.unlocked, idx); // reveal it on the map too
    app.save();
    app.audio.powerup();
    startSession(idx);                            // jump straight in
  } else {
    app.pinMsg = 'CLAVE INVÁLIDA — ROLLBACK';
    app.pinShake = 26;
    app.pinDigits = '';
    app.audio.hurt();
  }
}

// ------------------------------------------------------------------ text ---
function text(str, x, y, { size = 8, color = PAL.text, align = 'center', bold = false } = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px "JetBrains Mono", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function dim(alpha = 0.6) {
  ctx.fillStyle = `rgba(8,9,10,${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function mmss(frames) {
  const s = frames / 60;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function diamonds(x, y, plugins, got = []) {
  for (let i = 0; i < 3; i++) {
    const filled = (plugins && plugins[i]) || got.includes(i);
    ctx.fillStyle = filled ? PAL.violet : '#2a2f3a';
    ctx.save();
    ctx.translate(x + i * 9, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-2.5, -2.5, 5, 5);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- screens ---
function drawTitle(t) {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = PAL.cyan;
  ctx.beginPath();
  for (let x = 0; x < VIEW_W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); }
  for (let y = 0; y < VIEW_H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); }
  ctx.stroke();
  ctx.restore();

  drawLogoPixel(ctx, VIEW_W / 2, 70, 32, t);

  text('ZAMO_RUN', VIEW_W / 2, 116, { size: 22, color: PAL.bright, bold: true });
  text('hecho por 2 estudiantes del grupo 1010 AEI de la UTGZ', VIEW_W / 2, 134, { size: 7, color: PAL.muted });
  text('', VIEW_W / 2, 144, { size: 7, color: PAL.cyan });

  const items = [['NUEVA CONSULTA', () => startSession(0)]];
  items.push([`SELECCIONAR TABLA (${app.unlocked + 1}/${TOTAL_LEVELS} desbloqueados)`, () => {
    app.mapIdx = Math.min(app.unlocked, TOTAL_LEVELS - 1);
    app.setState('map');
  }]);
  items.push([`PERSONAJE: ${CHARACTERS.find(c => c.id === app.charId).name}`, () => {
    app.charIdx = Math.max(0, CHARACTERS.findIndex(c => c.id === app.charId));
    app.setState('chars');
  }]);
  items.push(['CONTROLES', () => { app.controlsFrom = 'title'; app.setState('controls'); }]);
  items.push(['ACERCA DE ZAMORUN', () => app.setState('about')]);
  items.push([`SONIDO: ${app.audio.muted ? 'NO' : 'SÍ'}`, () => app.audio.toggleMute()]);

  items.forEach(([label], i) => {
    const sel = i === app.menuIdx;
    text(`${sel ? '> ' : '  '}${label}${sel ? ' _' : ''}`, VIEW_W / 2, 158 + i * 11, {
      size: 9, color: sel ? PAL.green : PAL.muted, bold: sel,
    });
  });

  const got = app.pluginCount();
  if (got > 0) text(`plugins secretos encontrados: ${got}/${TOTAL_PLUGINS}`, VIEW_W / 2, 226, { size: 7, color: PAL.violet });
  if (app.input.gamepadActive) text('mando conectado', VIEW_W - 8, 10, { size: 7, color: PAL.green, align: 'right' });
  text(HINT_MOVE, VIEW_W / 2, 242, { size: 7, color: PAL.muted });
  text(HINT_MENU, VIEW_W / 2, 254, { size: 7, color: '#4b5563' });

  if (app.menuIdx >= items.length) app.menuIdx = items.length - 1;
  if (app.input.pressed.down) app.menuIdx = (app.menuIdx + 1) % items.length;
  if (app.input.pressed.up) app.menuIdx = (app.menuIdx + items.length - 1) % items.length;
  // ArrowUp also emits "jump": only confirm on a jump that isn't menu-up
  const confirm = app.input.pressed.start || (app.input.pressed.jump && !app.input.pressed.up);
  if (confirm) {
    app.audio.ensure();
    items[app.menuIdx][1]();
  }
}

// --------------------------------------------------------- character pick ---
const CHAR_COLORS = { coco: '#22c55e', tab: PAL.cyan, key: '#fde047', cursor: '#34d399', trigger: '#fb923c' };

function selectChar(i) {
  app.charIdx = i;
  app.applyChar(CHARACTERS[i].id);
  app.save();
  app.audio.powerup();
  app.menuIdx = 2; // back onto the CHARACTER row of the title menu
  app.setState('title');
}

function drawChars(t) {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text('SELECCIONAR PERSONAJE', VIEW_W / 2, 28, { size: 14, color: PAL.bright, bold: true });
  text('zamorun> SET ROLE runner;', VIEW_W / 2, 46, { size: 8, color: PAL.green });

  charHits = [];
  const bw = 84, bh = 108, gap = 8;
  const sx = (VIEW_W - (bw * CHARACTERS.length + gap * (CHARACTERS.length - 1))) / 2;
  CHARACTERS.forEach((c, i) => {
    const x = sx + i * (bw + gap), y = 64;
    charHits.push({ x, y, w: bw, h: bh, idx: i });
    const sel = i === app.charIdx;
    const accent = CHAR_COLORS[c.id];
    ctx.fillStyle = sel ? '#16181a' : '#101114';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = sel ? accent : PAL.border;
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
    ctx.lineWidth = 1;

    // the highlighted one does happy little Mario hops, the rest idle
    const set = app.sprites.players[c.id];
    const hop = sel ? Math.max(0, Math.sin(t / 9)) * 9 : 0;
    const img = !sel ? set.idle
      : hop > 1 ? set.jump
      : Math.floor(t / 8) % 2 ? set.run1 : set.run2;
    ctx.drawImage(img, x + bw / 2 - 24, y + 64 - 42 - hop, 48, 48);

    text(c.name, x + bw / 2, y + 84, { size: 7, color: sel ? accent : PAL.muted, bold: sel });
    if (c.id === app.charId) text('● ACTIVO', x + bw / 2, y + 98, { size: 6, color: PAL.green });
  });

  const cur = CHARACTERS[app.charIdx];
  text(`"${cur.tag}"`, VIEW_W / 2, 196, { size: 9, color: CHAR_COLORS[cur.id], bold: true });
  text(IS_TOUCH ? 'toca un personaje para elegir' : '←→ elegir · ENTER seleccionar · ESC volver',
    VIEW_W / 2, 250, { size: 7, color: PAL.muted });

  if (app.input.pressed.right) app.charIdx = (app.charIdx + 1) % CHARACTERS.length;
  if (app.input.pressed.left) app.charIdx = (app.charIdx + CHARACTERS.length - 1) % CHARACTERS.length;
  const confirm = app.input.pressed.start || (app.input.pressed.jump && !app.input.pressed.up);
  if (confirm) { app.audio.ensure(); selectChar(app.charIdx); return; }
  if (app.input.pressed.pause) { app.menuIdx = 2; app.setState('title'); }
}

function drawMap() {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text('zamorun> SELECT * FROM niveles;', VIEW_W / 2, 20, { size: 9, color: PAL.green, bold: true });

  for (let wi = 0; wi < 3; wi++) {
    const world = WORLDS[wi];
    text(world.name, 26, 52 + wi * 64 + 24, { size: 7, color: world.accent, align: 'left', bold: true });
    for (let li = 0; li < 4; li++) {
      const idx = wi * 4 + li;
      const x = 88 + li * 96, y = 44 + wi * 64;
      const w = 88, h = 52;
      const locked = idx > app.unlocked;
      const sel = idx === app.mapIdx;
      const st = app.stats[`${wi}-${li}`];
      const isBoss = li === 3;

      ctx.fillStyle = sel ? '#16181a' : '#101114';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = locked ? '#1a1f29' : sel ? world.accent : PAL.border;
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.lineWidth = 1;

      if (locked) {
        text('····', x + w / 2, y + h / 2, { size: 10, color: '#374151' });
        continue;
      }
      text(`${wi + 1}-${li + 1}`, x + 7, y + 10, { size: 7, color: world.accent, align: 'left', bold: true });
      if (st?.best !== undefined) {
        text(mmss(st.best), x + w - 6, y + 10, { size: 7, color: PAL.muted, align: 'right' });
      }
      const name = LEVELS[wi][li].name.replace('BOSS: ', '');
      text(name.length > 17 ? name.slice(0, 16) + '…' : name, x + w / 2, y + 26, {
        size: 6, color: isBoss ? PAL.red : PAL.text,
      });
      if (!isBoss) diamonds(x + w / 2 - 9, y + 40, st?.plugins);
      else text('☠', x + w / 2, y + 40, { size: 8, color: st?.best !== undefined ? PAL.red : '#374151' });
    }
  }

  // access-key button: jump straight to a level with a 5-digit key
  {
    const bw = 176, bh = 20, bx = (VIEW_W - bw) / 2, by = 230;
    codeHit = { x: bx, y: by, w: bw, h: bh };
    ctx.fillStyle = '#16181a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = PAL.violet;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    text('▦ INGRESAR CLAVE DE ACCESO', VIEW_W / 2, by + bh / 2 + 1, { size: 8, color: PAL.violet, bold: true });
  }
  text(HINT_MAP, VIEW_W / 2, 258, { size: 7, color: PAL.muted });

  if (app.input.pressed.right && app.mapIdx < app.unlocked) app.mapIdx++;
  if (app.input.pressed.left && app.mapIdx > 0) app.mapIdx--;
  if (app.input.pressed.down) app.mapIdx = Math.min(app.unlocked, app.mapIdx + 4);
  if (app.input.pressed.up && app.mapIdx >= 4) app.mapIdx -= 4;
  if (app.input.pressed.start || (app.input.pressed.jump && !app.input.pressed.up)) {
    app.audio.ensure();
    startSession(app.mapIdx);
    return;
  }
  if (app.input.pressed.pause) { app.menuIdx = 0; app.setState('title'); }
}

function drawIntro(t) {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = WORLDS[app.world];
  text(`MUNDO ${app.world + 1}`, VIEW_W / 2, 96, { size: 10, color: PAL.muted });
  text(w.name, VIEW_W / 2, 122, { size: 26, color: w.accent, bold: true });
  text(w.sub, VIEW_W / 2, 144, { size: 8, color: PAL.muted });
  const dots = '.'.repeat(1 + (Math.floor(t / 20) % 3));
  text(`$ zamorun connect ${w.id}${dots}`, VIEW_W / 2, 180, { size: 8, color: PAL.green });
  text(`CONEXIONES × ${app.lives}`, VIEW_W / 2, 204, { size: 8, color: PAL.text });
  if (t > 110) enterLevel();
}

function drawHUD() {
  ctx.save();
  ctx.fillStyle = 'rgba(8,9,10,0.7)';
  ctx.fillRect(0, 0, VIEW_W, 13);
  text(`FILAS ${String(app.rows).padStart(4, '0')}`, 6, 7, { size: 7, color: PAL.cyan, align: 'left' });
  text(`PUNTOS ${String(app.score).padStart(6, '0')}`, 62, 7, { size: 7, color: PAL.text, align: 'left' });
  text(`CONEX ×${app.lives}`, 146, 7, { size: 7, color: PAL.green, align: 'left' });
  text(mmss(game.frame), 200, 7, { size: 7, color: PAL.muted, align: 'left' });
  if (game.pluginTotal > 0) {
    diamonds(244, 7, app.stats[app.key]?.plugins, game.pluginsGot);
  }
  const w = WORLDS[app.world];
  text(`${w.id} · ${game.levelName}`, VIEW_W - 6, 7, { size: 7, color: w.accent, align: 'right' });
  ctx.restore();
}

function drawPlay() {
  game.update();
  game.draw(ctx);
  drawHUD();

  if (app.input.pressed.pause) { app.pauseIdx = 0; app.setState('pause'); }
  if (app.input.pressed.mute) app.audio.toggleMute();

  if (app.world === 0 && app.level === 0 && game.frame < 300) {
    ctx.globalAlpha = Math.min(1, (300 - game.frame) / 60);
    text(HINT_PLAY, game.player.x - game.cam.x, 200, { size: 7, color: PAL.muted });
    ctx.globalAlpha = 1;
  }
  // contextual hint when standing on a climbable cable
  if (app.state === 'play' && !game.player.climbing && game.climbAt(game.player)) {
    const sx = game.player.x + game.player.w / 2 - game.cam.x;
    const sy = game.player.y - game.cam.y - 8;
    text(IS_TOUCH ? '▲ ▼ trepar' : '↑ ↓ trepar', sx, sy, { size: 7, color: PAL.cyan });
  }

  if (app.deathT >= 0 && ++app.deathT > 110) {
    app.lives--;
    if (app.lives > 0) enterLevel();
    else { app.audio.stopSong(); app.audio.gameover(); app.setState('gameover'); }
  }
}

function drawPause() {
  game.draw(ctx);
  drawHUD();
  dim(0.65);
  text('-- EN PAUSA --', VIEW_W / 2, 96, { size: 14, color: PAL.bright, bold: true });
  text('ejecución de consulta suspendida', VIEW_W / 2, 114, { size: 8, color: PAL.muted });

  const items = [
    ['CONTINUAR', () => app.setState('play')],
    ['REINICIAR NIVEL', () => { app.checkpoint = null; enterLevel(); }],
    ['CONTROLES', () => { app.controlsFrom = 'pause'; app.setState('controls'); }],
    [`SONIDO: ${app.audio.muted ? 'NO' : 'SÍ'}`, () => app.audio.toggleMute()],
    ['SALIR AL MENÚ PRINCIPAL', () => { app.menuIdx = 0; app.setState('title'); }],
  ];
  items.forEach(([label], i) => {
    const sel = i === app.pauseIdx;
    text(`${sel ? '> ' : '  '}${label}${sel ? ' _' : ''}`, VIEW_W / 2, 142 + i * 14, {
      size: 9, color: sel ? PAL.green : PAL.muted, bold: sel,
    });
  });
  text(IS_TOUCH ? '▼ bajar · ▲ confirmar · II continuar' : '↑↓ seleccionar · ENTER confirmar · P/ESC continuar', VIEW_W / 2, 212, { size: 7, color: '#4b5563' });

  if (app.input.pressed.down) app.pauseIdx = (app.pauseIdx + 1) % items.length;
  if (app.input.pressed.up) app.pauseIdx = (app.pauseIdx + items.length - 1) % items.length;
  if (app.input.pressed.pause) { app.setState('play'); return; }
  if (app.input.pressed.mute) app.audio.toggleMute();
  if (app.input.pressed.start || (app.input.pressed.jump && !app.input.pressed.up)) {
    items[app.pauseIdx][1]();
  }
}

function drawClear(t) {
  game.draw(ctx);
  drawHUD();
  dim(Math.min(0.65, t / 40));
  if (t > 15) {
    text('COMMIT;', VIEW_W / 2, 92, { size: 20, color: PAL.green, bold: true });
    const rec = app.lastClear?.newRecord;
    text(`Consulta OK (${mmss(game.frame)})${rec ? '  ★ NUEVO RÉCORD' : ''}`, VIEW_W / 2, 116, {
      size: 8, color: rec ? PAL.amber : PAL.text,
    });
    if (game.pluginTotal > 0) {
      text('plugins:', VIEW_W / 2 - 26, 134, { size: 7, color: PAL.muted, align: 'right' });
      diamonds(VIEW_W / 2 - 12, 134, app.stats[app.key]?.plugins, game.pluginsGot);
    }
    if (game.isBossLevel) {
      text(`${WORLDS[app.world].boss.name} eliminado`, VIEW_W / 2, 134, { size: 8, color: PAL.amber });
    }
  }
  if (t > 55) {
    text('— ¿sabías que? —', VIEW_W / 2, 170, { size: 7, color: '#4b5563' });
    text(FACTS[app.gIdx % FACTS.length], VIEW_W / 2, 184, { size: 7, color: PAL.cyan });
  }
  if (t > 170) nextLevel();
}

function drawGameOver(t) {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text('FATAL', VIEW_W / 2, 80, { size: 22, color: PAL.red, bold: true });
  text('se perdió la conexión con el servidor', VIEW_W / 2, 102, { size: 9, color: PAL.muted });
  text(`puntuación final ${app.score} · ${app.rows} filas`, VIEW_W / 2, 126, { size: 9, color: PAL.text });
  {
    const msg = 'ZamoRun — hecho por 2 estudiantes del 1010 AEI · UTGZ';
    text(msg, VIEW_W / 2, 148, { size: 7, color: PAL.muted });
  }
  if (t > 60 && Math.floor(t / 30) % 2) text('ENTER: reconectar', VIEW_W / 2, 178, { size: 9, color: PAL.green });
  drawShareButton(196);
  if (t > 60 && (app.input.pressed.start || app.input.pressed.jump)) {
    app.mapIdx = Math.min(app.gIdx, app.unlocked);
    app.setState('map');
  }
}

function drawVictory(t) {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 40; i++) {
    const x = (i * 137 + t * (1 + (i % 3))) % VIEW_W;
    const y = (i * 89 + t * (2 + (i % 2))) % VIEW_H;
    ctx.fillStyle = [PAL.cyan, PAL.blue, PAL.violet, PAL.green][i % 4];
    ctx.fillRect(x, y, 2, 2);
  }
  drawLogoPixel(ctx, VIEW_W / 2, 52, 22, t);
  text('TODAS LAS BASES DE DATOS RESTAURADAS', VIEW_W / 2, 94, { size: 14, color: PAL.green, bold: true });
  text('0 filas corruptas. El Deadlock ha sido eliminado.', VIEW_W / 2, 113, { size: 8, color: PAL.text });
  text(`PUNTOS ${app.score} · FILAS ${app.rows} · PLUGINS ${app.pluginCount()}/${TOTAL_PLUGINS}`, VIEW_W / 2, 136, {
    size: 9, color: PAL.cyan, bold: true,
  });
  if (app.pluginCount() < TOTAL_PLUGINS) {
    text('aún hay plugins por ahí — repite niveles desde SELECCIONAR TABLA', VIEW_W / 2, 152, { size: 7, color: PAL.violet });
  }
  text('ZamoRun — hecho con amor por el grupo 1010 AEI de la UTGZ', VIEW_W / 2, 176, { size: 8, color: PAL.muted });
  text('♥ Gracias por jugar', VIEW_W / 2, 192, { size: 9, color: PAL.cyan, bold: true });
  if (t > 90 && Math.floor(t / 30) % 2) text('ENTER: seleccionar nivel', VIEW_W / 2, 232, { size: 8, color: PAL.green });
  if (t > 90 && (app.input.pressed.start || app.input.pressed.jump)) {
    app.mapIdx = 0;
    app.setState('map');
  }
}

function drawControls() {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text('CONTROLES', VIEW_W / 2, 26, { size: 14, color: PAL.bright, bold: true });

  const col = (x, title, rows, color) => {
    text(title, x, 56, { size: 8, color, bold: true, align: 'left' });
    rows.forEach(([k, v], i) => {
      text(k, x, 76 + i * 14, { size: 7, color: PAL.text, align: 'left' });
      text(v, x + 88, 76 + i * 14, { size: 7, color: PAL.muted, align: 'left' });
    });
  };
  col(34, 'TECLADO', [
    ['←→ / A D', 'mover'],
    ['ESPACIO / Z / ↑', 'saltar'],
    ['↑ ↓ en cable', 'trepar'],
    ['X / CTRL', 'disparar consulta'],
    ['↓', 'entrar túnel ssh'],
    ['P / ESC', 'pausar'],
    ['M', 'sonido sí/no'],
  ], PAL.cyan);
  col(262, 'MANDO', [
    ['stick / d-pad', 'mover'],
    ['A / Y', 'saltar'],
    ['▲ ▼ en cable', 'trepar'],
    ['B / X', 'disparar consulta'],
    ['d-pad ▼', 'entrar túnel ssh'],
    ['START', 'pausar / confirmar'],
    ['SELECT', 'sonido sí/no'],
  ], PAL.violet);

  text('TÁCTIL: ◀ ▲ ▼ ▶ d-pad (▲▼ trepar) · ▲ saltar · ✦ disparar · ▼ túnel', VIEW_W / 2, 196, { size: 7, color: PAL.muted });
  text(
    app.input.gamepadActive ? '● mando conectado' : '○ sin mando — pulsa cualquier botón para activar',
    VIEW_W / 2, 210,
    { size: 7, color: app.input.gamepadActive ? PAL.green : '#4b5563' },
  );
  text(IS_TOUCH ? '▲ volver' : 'ENTER / ESC: volver', VIEW_W / 2, 244, { size: 7, color: PAL.green });

  if (app.input.pressed.start || app.input.pressed.pause || app.input.pressed.jump) {
    app.setState(app.controlsFrom === 'pause' ? 'pause' : 'title');
  }
}

function drawAbout() {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawLogoPixel(ctx, VIEW_W / 2, 34, 15, app.stateT);
  text('ACERCA DE ZAMORUN', VIEW_W / 2, 64, { size: 13, color: PAL.bright, bold: true });

  const lines = [
    'ZamoRun es un juego de plataformas hecho por 2 estudiantes',
    'del grupo 1010 AEI de la UTGZ.',
    '',
    'Corre, salta y derrota al Deadlock para restaurar',
    'todas las bases de datos. Recoge filas, desbloquea',
    'plugins y completa los 12 niveles.',
  ];
  lines.forEach((l, i) =>
    text(l, VIEW_W / 2, 86 + i * 11, { size: 7, color: i >= 3 ? PAL.text : PAL.muted }));
  text('Proyecto del semestre. ¡Orale, a jugar!',
    VIEW_W / 2, 172, { size: 7, color: PAL.cyan });
  text('♥ Hecho con café y VSCode', VIEW_W / 2, 188, { size: 8, color: PAL.amber, bold: true });

  text(IS_TOUCH ? '▲ volver' : 'ENTER / ESC: volver',
    VIEW_W / 2, 224, { size: 7, color: PAL.green });

  if (app.input.pressed.start || app.input.pressed.pause || app.input.pressed.jump) {
    app.setState('title');
  }
}

// Phone-style PIN pad to enter a 5-digit level access key.
function drawPin() {
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = PAL.violet;
  ctx.beginPath();
  for (let x = 0; x < VIEW_W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); }
  for (let y = 0; y < VIEW_H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); }
  ctx.stroke();
  ctx.restore();

  text('CLAVE DE ACCESO', VIEW_W / 2, 24, { size: 14, color: PAL.bright, bold: true });
  text('tabularis> CONECTAR CON CLAVE — salta a cualquier nivel', VIEW_W / 2, 40, { size: 7, color: PAL.green });

  // entry cells
  if (app.pinShake > 0) app.pinShake--;
  const shake = app.pinShake > 0 ? Math.sin(app.pinShake * 1.4) * 3 : 0;
  const cells = 5, cw = 30, gap = 8;
  const totalW = cells * cw + (cells - 1) * gap;
  const sx = (VIEW_W - totalW) / 2;
  for (let i = 0; i < cells; i++) {
    const x = sx + i * (cw + gap) + shake, y = 54;
    const filled = i < app.pinDigits.length;
    ctx.fillStyle = '#101114';
    ctx.fillRect(x, y, cw, 26);
    ctx.strokeStyle = app.pinMsg ? PAL.red : filled ? PAL.cyan : PAL.border;
    ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, 25);
    if (filled) text(app.pinDigits[i], x + cw / 2, y + 14, { size: 14, color: PAL.cyan, bold: true });
    else text('·', x + cw / 2, y + 14, { size: 12, color: '#374151' });
  }

  // keypad: 1-9, then ⌫ 0 OK
  pinHits = [];
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];
  const kw = 50, kh = 30, kgap = 8, cols = 3;
  const padW = cols * kw + (cols - 1) * kgap;
  const px0 = (VIEW_W - padW) / 2, py0 = 92;
  keys.forEach((k, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = px0 + c * (kw + kgap), y = py0 + r * (kh + kgap);
    pinHits.push({ x, y, w: kw, h: kh, key: k });
    const isOk = k === 'ok', isBack = k === 'back';
    ctx.fillStyle = isOk ? PAL.cyan : '#16181a';
    ctx.fillRect(x, y, kw, kh);
    ctx.strokeStyle = isOk ? PAL.cyan : PAL.border;
    ctx.strokeRect(x + 0.5, y + 0.5, kw - 1, kh - 1);
    text(isOk ? 'OK' : isBack ? '⌫' : k, x + kw / 2, y + kh / 2 + 1, {
      size: isOk ? 9 : 11, color: isOk ? '#06121a' : PAL.text, bold: isOk,
    });
  });

  const msgY = py0 + 4 * (kh + kgap) + 2;
  if (app.pinMsg) text(app.pinMsg, VIEW_W / 2, msgY, { size: 8, color: PAL.red, bold: true });
  text(IS_TOUCH ? 'toca dígitos · OK para conectar · II volver'
    : 'escribe 0-9 · ENTER conectar · RETROCESO borrar · ESC volver',
    VIEW_W / 2, 263, { size: 7, color: '#4b5563' });

  if (app.input.pressed.pause) { app.menuIdx = 1; app.setState('map'); }
}

// ------------------------------------------------------------------- loop ---
const screens = {
  title: drawTitle,
  chars: drawChars,
  controls: drawControls,
  about: drawAbout,
  map: drawMap,
  pin: drawPin,
  intro: drawIntro,
  play: drawPlay,
  pause: drawPause,
  clear: drawClear,
  gameover: drawGameOver,
  victory: drawVictory,
};

let last = performance.now();
let acc = 0;
const STEP = 1000 / 60;

function loop(now) {
  acc = Math.min(acc + (now - last), 100);
  last = now;
  while (acc >= STEP) {
    acc -= STEP;
    app.stateT++;
    app.input.pollGamepad();
    // Gamepad input fires no pointerdown/keydown, so unlock audio here too.
    // A gamepad button press counts as user activation, so resume() works.
    if (app.input.gamepadActive && app.input.gpPressedThisStep) app.audio.ensure();
    screens[app.state](app.stateT);
    app.audio.update();
    app.input.endFrame();
  }
  requestAnimationFrame(loop);
}

addEventListener('pointerdown', () => app.audio.ensure(), { once: true });
addEventListener('keydown', () => app.audio.ensure(), { once: true });

// Number-pad typing for the access-key screen (digits aren't in the game keymap)
addEventListener('keydown', (e) => {
  if (app.state !== 'pin') return;
  if (/^(Digit|Numpad)[0-9]$/.test(e.code)) { pinKey(e.key); e.preventDefault(); }
  else if (e.code === 'Backspace') { pinKey('back'); e.preventDefault(); }
  else if (e.code === 'Enter' || e.code === 'NumpadEnter') { pinKey('ok'); e.preventDefault(); }
});

// test hook (mirrors ?touch=1): exposes app so end-screen harnesses can
// jump straight to gameover/victory for screenshots — no effect in normal play
if (new URLSearchParams(location.search).has('debug')) { globalThis.__app = app; globalThis.__game = game; }

app.setState('title');
requestAnimationFrame(loop);

// ?code=XXXXX jumps straight into the matching level — same 5-digit keys as the
// PIN pad, for shareable deep links / bookmarks. The title shows for a frame
// while the hash resolves; an invalid or unknown code just stays on the title.
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode && /^\d{5}$/.test(urlCode)) {
  levelForCode(urlCode).then((idx) => {
    if (idx < 0) return;
    app.unlocked = Math.max(app.unlocked, idx); // reveal it on the map too
    app.save();
    startSession(idx);
  });
}

// ask for analytics consent (no-op unless a Matomo tracker is configured)
initConsent();
