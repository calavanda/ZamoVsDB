// Level definitions. Maps are built with a small grid builder so coordinates
// stay exact. Tile legend:
//   '#' ground   'B' brick      'b' used block   '?' coin block
//   'I' index block  'M' mcp block  'R' vertical-scaling block  '=' one-way platform
//   '^' spikes   'T' ssh tunnel top  '|' tunnel body   'H' climbable cable
//   'o' coin (data row)  'F' commit flag  'K' BEGIN checkpoint  'S' start
//   enemies: 'g' corrupt blob  's' slow query  'f' null wisp  'l' lock gate
//   'D' boss spawn   'p' hidden plugin pickup

function make(w, h = 16) {
  const g = Array.from({ length: h }, () => Array(w).fill(' '));
  return {
    g, w, h,
    set(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; },
    hr(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); },
    vr(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); },
    box(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) this.hr(x0, x1, y, c); },
    ground(x0, x1, top = 14, bottom = -1) { this.box(x0, top, x1, bottom < 0 ? top + 1 : bottom, '#'); },
    gap(x0, x1, top = 14, bottom = 15) { this.box(x0, top, x1, bottom, ' '); },
    stairsUp(x, n, base = 13) { for (let i = 0; i < n; i++) this.vr(x + i, base - i, base, '#'); },
    stairsDown(x, n, base = 13) { for (let i = 0; i < n; i++) this.vr(x + i, base - (n - 1 - i), base, '#'); },
    spikes(x0, x1, y = 13) { this.hr(x0, x1, y, '^'); },
    tunnel(x, top = 12, base = 13) { this.set(x, top, 'T'); this.vr(x, top + 1, base, '|'); },
    lockGate(x, wallTop = 8) { this.vr(x, wallTop, 12, 'B'); this.set(x, 13, 'l'); },
    climb(x, y0, y1 = 13) { this.vr(x, y0, y1, 'H'); },
    rows() { return g.map(r => r.join('')); },
  };
}

function bossArena(w, bossX, flagX) {
  const a = make(w);
  a.ground(0, w - 1);
  a.box(0, 0, 1, 13, 'B');
  a.box(w - 2, 0, w - 1, 13, 'B');
  a.set(4, 13, 'S');
  a.set(bossX, 12, 'D');
  a.set(flagX, 13, 'F');
  return a;
}

// ================================================================ WORLD 1 ===
function w1l1() {
  const a = make(170);
  a.ground(0, 169);
  a.gap(60, 62); a.gap(98, 101); a.gap(130, 132);
  a.set(3, 13, 'S');
  a.hr(14, 16, 10, 'o');
  a.set(20, 10, 'R'); a.set(22, 10, '?'); a.set(24, 10, 'I');
  a.set(30, 13, 'g');
  a.tunnel(36);
  a.hr(44, 47, 10, '='); a.hr(44, 47, 7, 'o');
  a.set(52, 13, 'g'); a.set(55, 13, 'g');
  a.hr(60, 62, 11, 'o');
  a.stairsUp(70, 4); a.stairsDown(76, 4);
  a.set(88, 10, '?');
  // climbable data cable topping out beside a one-way ledge with a coin stash
  a.climb(85, 3, 13); a.hr(86, 90, 3, '='); a.hr(86, 90, 2, 'o');
  a.set(92, 13, 'g');
  a.hr(99, 100, 11, '=');
  a.set(108, 13, 'g'); a.set(111, 13, 'g');
  a.set(118, 13, 's');
  a.hr(122, 126, 9, 'o');
  a.hr(121, 124, 10, '=');
  a.set(124, 6, '?');
  a.set(138, 13, 'g');
  a.stairsUp(144, 5); a.stairsDown(149, 5);
  a.set(162, 13, 'F');
  // hidden plugin pickups
  a.set(45, 6, 'p'); a.set(61, 9, 'p'); a.set(124, 3, 'p');
  return { map: a.rows() };
}

function w1l2() {
  const a = make(180, 30);
  a.ground(0, 179);
  a.gap(90, 93); a.gap(124, 127); a.gap(150, 152);
  a.set(3, 13, 'S');
  a.set(12, 10, '?'); a.set(14, 10, 'R');
  a.set(18, 13, 'g');
  a.hr(24, 27, 10, '='); a.hr(24, 27, 7, 'o');
  a.set(32, 13, 's');
  a.tunnel(40); // warp 1 → bonus room
  a.set(48, 13, 'g'); a.set(51, 13, 'g');
  a.hr(56, 58, 9, 'o');
  a.set(60, 10, 'M');
  a.set(66, 13, 's');
  a.stairsUp(72, 3); a.stairsDown(76, 3);
  a.set(84, 13, 'g');
  a.hr(91, 92, 11, '=');
  a.set(98, 13, 'K');
  a.spikes(104, 106); a.hr(104, 106, 10, '=');
  a.set(112, 13, 'g'); a.set(114, 13, 'g');
  a.set(118, 10, '?');
  a.hr(125, 126, 11, '=');
  a.set(134, 13, 's');
  a.hr(138, 141, 8, 'o');
  a.set(158, 13, 'g');
  a.stairsUp(162, 4);
  a.set(172, 13, 'F');
  // bonus room (rows 18-29)
  a.box(0, 18, 84, 18, 'B');
  a.vr(0, 19, 29, 'B'); a.vr(84, 19, 29, 'B');
  a.box(0, 28, 84, 29, '#');
  a.hr(8, 30, 26, 'o'); a.hr(8, 30, 24, 'o');
  a.hr(36, 44, 25, '='); a.hr(36, 44, 23, 'o');
  a.hr(50, 60, 26, 'o');
  a.tunnel(70, 26, 27); // warp 2 → back to main
  // hidden plugin pickups
  a.set(104, 7, 'p'); a.set(165, 8, 'p'); a.set(40, 22, 'p');
  return { map: a.rows(), warps: [[6, 28], [100, 14]] };
}

function w1l3() {
  const a = make(190);
  a.ground(0, 189);
  a.gap(58, 60); a.gap(86, 89); a.gap(140, 143);
  a.set(3, 13, 'S');
  a.set(10, 13, 'g');
  a.hr(16, 19, 10, '='); a.hr(16, 19, 7, 'o');
  a.set(26, 10, 'R'); a.set(28, 10, 'I');
  a.set(34, 13, 's');
  a.lockGate(42);
  a.set(48, 13, 'g'); a.set(50, 13, 'g');
  a.hr(54, 56, 9, 'o');
  a.set(66, 13, 's');
  a.spikes(72, 74);
  a.set(80, 10, '?');
  a.hr(87, 88, 11, '=');
  a.set(94, 13, 'K');
  a.lockGate(100);
  a.set(106, 13, 'g'); a.set(108, 13, 's');
  a.stairsUp(114, 3); a.stairsDown(118, 3);
  a.spikes(126, 129); a.hr(126, 129, 10, '=');
  a.set(134, 10, 'M');
  a.hr(141, 142, 11, '=');
  a.set(142, 7, 'v');
  a.set(150, 13, 'g'); a.set(152, 13, 'g'); a.set(154, 13, 's');
  a.hr(158, 162, 9, 'o');
  a.stairsUp(168, 5); a.stairsDown(173, 5);
  a.set(182, 13, 'F');
  // hidden plugin pickups
  a.set(73, 10, 'p'); a.set(88, 8, 'p'); a.set(128, 7, 'p');
  return { map: a.rows() };
}

function w1boss() {
  const a = bossArena(34, 26, 30);
  a.hr(8, 12, 10, '='); a.hr(21, 25, 10, '=');
  return { map: a.rows(), boss: true };
}

// ================================================================ WORLD 2 ===
function w2l1() {
  const a = make(180);
  a.ground(0, 179);
  a.gap(50, 53); a.gap(96, 99); a.gap(134, 137); a.gap(160, 162);
  a.set(3, 13, 'S');
  a.set(12, 13, 'g');
  a.set(16, 10, 'R'); a.set(18, 10, '?'); a.set(20, 10, 'I');
  a.set(26, 8, 'f');
  a.hr(30, 33, 10, '='); a.hr(30, 33, 7, 'o');
  a.set(40, 13, 's'); a.set(44, 13, 'g');
  a.hr(51, 52, 11, '=');
  a.set(58, 8, 'f');
  a.lockGate(64);
  a.set(70, 13, 'g'); a.set(72, 13, 'g');
  a.hr(78, 82, 7, 'o'); a.set(80, 10, 'M');
  a.set(88, 13, 'K');
  a.hr(97, 98, 11, '=');
  a.spikes(106, 108);
  a.set(102, 6, 'w');
  a.set(114, 13, 's'); a.set(117, 8, 'f');
  // climbable data cable topping out beside a one-way ledge with a coin stash
  a.climb(110, 3, 13); a.hr(111, 115, 3, '='); a.hr(111, 115, 2, 'o');
  a.stairsUp(122, 4); a.stairsDown(127, 4);
  a.hr(135, 136, 11, '=');
  a.set(144, 13, 'g'); a.set(146, 13, 'g');
  a.hr(150, 154, 8, 'o');
  a.set(168, 13, 's');
  a.stairsUp(170, 4);
  a.set(177, 13, 'F');
  // hidden plugin pickups
  a.set(52, 8, 'p'); a.set(80, 6, 'p'); a.set(125, 6, 'p');
  return { map: a.rows() };
}

function w2l2() {
  const a = make(190, 30);
  a.ground(0, 189);
  a.gap(80, 83); a.gap(110, 114); a.gap(146, 149);
  a.set(3, 13, 'S');
  a.set(10, 13, 'g'); a.set(14, 8, 'f');
  a.hr(20, 23, 10, '='); a.hr(20, 23, 7, 'o');
  a.set(28, 10, 'R'); a.set(30, 10, 'M');
  a.set(36, 13, 's'); a.set(39, 13, 's');
  a.tunnel(46); // warp 1 → bonus
  a.spikes(52, 54);
  a.set(60, 13, 'g'); a.set(62, 8, 'f');
  a.lockGate(68);
  a.set(74, 13, 'K');
  a.hr(81, 82, 11, '=');
  a.set(82, 7, 'v');
  a.set(90, 13, 's'); a.set(93, 13, 'g');
  a.set(98, 10, '?'); a.set(100, 10, 'I');
  a.hr(111, 113, 11, '=');
  a.set(120, 8, 'f'); a.set(124, 13, 'g');
  a.spikes(130, 133); a.hr(130, 133, 10, '=');
  a.set(136, 6, 'w');
  a.set(140, 13, 's');
  a.hr(147, 148, 11, '=');
  a.set(156, 13, 'g'); a.set(158, 13, 'g'); a.set(160, 8, 'f');
  a.hr(164, 168, 9, 'o');
  a.stairsUp(174, 5);
  a.set(184, 13, 'F');
  // bonus room
  a.box(0, 18, 70, 18, 'B');
  a.vr(0, 19, 29, 'B'); a.vr(70, 19, 29, 'B');
  a.box(0, 28, 70, 29, '#');
  a.hr(6, 26, 26, 'o');
  a.hr(32, 40, 25, '='); a.hr(32, 40, 23, 'o');
  a.hr(46, 60, 26, 'o');
  a.tunnel(64, 26, 27); // warp 2 → back
  // hidden plugin pickups
  a.set(112, 8, 'p'); a.set(178, 5, 'p'); a.set(36, 22, 'p');
  return { map: a.rows(), warps: [[5, 28], [88, 14]] };
}

function w2l3() {
  const a = make(190);
  a.ground(0, 189);
  a.gap(40, 43); a.gap(70, 74); a.gap(104, 107); a.gap(126, 129); a.gap(154, 157);
  a.set(3, 13, 'S');
  a.set(10, 13, 's'); a.set(13, 8, 'f');
  a.spikes(18, 20);
  a.set(26, 10, 'R'); a.set(28, 10, 'I');
  a.set(33, 13, 'g'); a.set(35, 13, 'g');
  a.hr(41, 42, 11, '=');
  a.lockGate(50); a.lockGate(56);
  a.set(62, 13, 's');
  a.hr(71, 73, 11, '=');
  a.set(80, 8, 'f'); a.set(83, 8, 'f');
  a.set(88, 13, 'K');
  a.spikes(94, 97); a.hr(94, 97, 10, '=');
  a.set(102, 10, 'M');
  a.hr(105, 106, 11, '=');
  a.set(110, 6, 'w');
  a.set(112, 13, 'g'); a.set(114, 13, 's'); a.set(116, 13, 'g');
  a.stairsUp(120, 3); a.stairsDown(123, 3);
  a.hr(127, 128, 11, '=');
  a.set(134, 8, 'f');
  a.hr(138, 142, 8, 'o');
  a.set(146, 13, 's'); a.set(148, 13, 'g');
  a.spikes(164, 166);
  a.stairsUp(172, 5);
  a.set(184, 13, 'F');
  // hidden plugin pickups
  a.set(42, 8, 'p'); a.set(95, 6, 'p'); a.set(155, 9, 'p');
  return { map: a.rows() };
}

function w2boss() {
  const a = bossArena(36, 28, 32);
  a.hr(7, 11, 10, '='); a.hr(16, 20, 8, '='); a.hr(25, 29, 10, '=');
  return { map: a.rows(), boss: true };
}

// ================================================================ WORLD 3 ===
function w3l1() {
  const a = make(190);
  a.ground(0, 189);
  a.gap(34, 37); a.gap(60, 64); a.gap(92, 95); a.gap(118, 122); a.gap(150, 153);
  a.set(3, 13, 'S');
  a.set(10, 13, 'g'); a.set(12, 13, 'g');
  a.spikes(17, 19);
  a.set(24, 10, 'R'); a.set(26, 10, 'I');
  a.set(30, 8, 'f');
  a.hr(35, 36, 11, '=');
  a.set(42, 13, 's'); a.set(45, 13, 's');
  a.set(44, 6, 'w');
  // climbable data cable topping out beside a one-way ledge with a coin stash
  a.climb(46, 3, 13); a.hr(47, 51, 3, '='); a.hr(47, 51, 2, 'o');
  a.lockGate(52);
  a.hr(61, 63, 11, '=');
  a.set(70, 8, 'f'); a.set(73, 13, 'g');
  a.spikes(78, 81); a.hr(78, 81, 10, '=');
  a.set(86, 13, 'K');
  a.hr(93, 94, 11, '=');
  a.set(93, 7, 'v');
  a.set(100, 13, 's'); a.set(102, 8, 'f'); a.set(104, 13, 'g');
  a.set(110, 10, 'M'); a.set(112, 10, '?');
  a.hr(119, 121, 11, '=');
  a.spikes(128, 130);
  a.set(136, 13, 'g'); a.set(138, 13, 'g'); a.set(140, 8, 'f');
  a.hr(144, 148, 8, 'o');
  a.lockGate(160);
  a.set(166, 13, 's');
  a.stairsUp(172, 5);
  a.set(184, 13, 'F');
  // hidden plugin pickups
  a.set(36, 8, 'p'); a.set(62, 7, 'p'); a.set(149, 9, 'p');
  return { map: a.rows() };
}

function w3l2() {
  const a = make(200, 30);
  a.ground(0, 199);
  a.gap(84, 87); a.gap(116, 120); a.gap(152, 155);
  a.set(3, 13, 'S');
  a.set(8, 13, 's');
  a.spikes(14, 16);
  a.set(22, 10, 'R'); a.set(24, 10, 'M');
  a.set(28, 8, 'f'); a.set(31, 8, 'f');
  a.hr(36, 39, 10, '='); a.hr(36, 39, 7, 'o');
  a.tunnel(46); // warp 1 → bonus
  a.lockGate(54);
  a.set(60, 13, 'g'); a.set(62, 13, 'g'); a.set(64, 13, 'g');
  a.set(70, 13, 'K');
  a.spikes(74, 77); a.hr(74, 77, 10, '=');
  a.hr(85, 87, 11, '=');
  a.set(92, 8, 'f'); a.set(96, 13, 's');
  a.set(90, 6, 'w');
  a.set(102, 10, 'I');
  a.stairsUp(106, 3); a.stairsDown(109, 3);
  a.hr(117, 119, 11, '=');
  a.set(126, 13, 'g'); a.set(128, 8, 'f');
  a.spikes(134, 137); a.hr(134, 137, 10, '=');
  a.set(142, 13, 's'); a.set(144, 13, 's');
  a.hr(153, 154, 11, '=');
  a.set(154, 7, 'v');
  a.lockGate(162);
  a.set(168, 13, 'g'); a.set(170, 8, 'f');
  a.stairsUp(178, 6);
  a.set(192, 13, 'F');
  // bonus room
  a.box(0, 18, 70, 18, 'B');
  a.vr(0, 19, 29, 'B'); a.vr(70, 19, 29, 'B');
  a.box(0, 28, 70, 29, '#');
  a.hr(6, 28, 26, 'o'); a.hr(6, 28, 24, 'o');
  a.hr(34, 42, 25, '='); a.hr(34, 42, 23, 'o');
  a.hr(48, 60, 26, 'o');
  a.tunnel(64, 26, 27); // warp 2 → back
  // hidden plugin pickups
  a.set(76, 6, 'p'); a.set(118, 7, 'p'); a.set(38, 22, 'p');
  return { map: a.rows(), warps: [[5, 28], [72, 14]] };
}

function w3l3() {
  // vertical level: climb 64 rows of overlapping one-way platforms.
  // Every span overlaps the next one by >=2 columns with a 3-row rise,
  // so you always jump up *through* the platform above.
  const a = make(40, 64);
  a.box(0, 62, 39, 63, '#');
  a.set(3, 61, 'S');
  const spans = [
    [59, 0, 15], [56, 13, 28], [53, 26, 39], [50, 12, 27],
    [47, 0, 14], [44, 12, 27], [41, 25, 39], [38, 11, 26],
    [35, 0, 13], [32, 11, 26], [29, 24, 39], [26, 10, 25],
    [23, 0, 12], [20, 10, 25], [17, 23, 39], [14, 9, 24],
    [11, 22, 37], [8, 8, 23], [5, 14, 32],
  ];
  for (const [y, x0, x1] of spans) a.hr(x0, x1, y, '=');
  a.set(23, 4, 'F');
  a.set(13, 37, 'K'); a.set(11, 19, 'K');
  // coins
  a.hr(4, 10, 58, 'o'); a.hr(30, 36, 52, 'o'); a.hr(2, 8, 46, 'o');
  a.hr(14, 20, 31, 'o'); a.hr(26, 32, 10, 'o'); a.hr(16, 19, 7, 'o');
  // blocks (2 rows above their platform: bump, then climb on top)
  a.set(20, 54, 'R'); a.set(6, 33, 'I'); a.set(30, 27, '?'); a.set(13, 12, 'M');
  // enemies
  a.set(20, 52, 'f'); a.set(8, 30, 'f'); a.set(30, 15, 'f');
  a.set(32, 45, 'v'); a.set(6, 24, 'v'); a.set(28, 9, 'v');
  a.set(18, 42, 'w'); a.set(16, 21, 'w');
  // hidden plugin pickups
  a.set(2, 44, 'p'); a.set(38, 26, 'p'); a.set(4, 20, 'p');
  return { map: a.rows(), vertical: true };
}

function w3boss() {
  const a = bossArena(40, 30, 36);
  a.hr(8, 12, 10, '='); a.hr(17, 22, 8, '='); a.hr(27, 31, 10, '=');
  return { map: a.rows(), boss: true };
}

// ============================================================== registry ===
export const LEVELS = [
  [
    { name: 'init.db', gen: w1l1 },
    { name: 'migración de esquema', gen: w1l2 },
    { name: 'VACUUM necesario', gen: w1l3 },
    { name: 'BOSS: BLOQUEO DE TABLA', gen: w1boss },
  ],
  [
    { name: 'grupo de conexiones', gen: w2l1 },
    { name: 'cavernas de binlog', gen: w2l2 },
    { name: 'procedimientos almacenados', gen: w2l3 },
    { name: 'BOSS: RETRASO DE REPLICACIÓN', gen: w2boss },
  ],
  [
    { name: 'el planificador de consultas', gen: w3l1 },
    { name: 'tundra TOAST', gen: w3l2 },
    { name: 'ascenso WAL', gen: w3l3 },
    { name: 'BOSS: EL DEADLOCK', gen: w3boss },
  ],
];

// Sanity checks (run with: node js/levels.js — also cheap enough at import time)
export function validateLevels() {
  const problems = [];
  LEVELS.forEach((world, wi) => world.forEach((lvl, li) => {
    const d = lvl.gen();
    const rows = d.map;
    const w = rows[0].length;
    const id = `${wi + 1}-${li + 1}`;
    if (rows.some(r => r.length !== w)) problems.push(`${id}: ragged rows`);
    const all = rows.join('\n');
    if (!all.includes('S')) problems.push(`${id}: missing start`);
    if (!all.includes('F')) problems.push(`${id}: missing flag`);
    const tCount = (all.match(/T/g) || []).length;
    const warps = d.warps || [];
    if (tCount !== warps.length && warps.length > 0) problems.push(`${id}: ${tCount} tunnels vs ${warps.length} warps`);
    if (d.boss && !all.includes('D')) problems.push(`${id}: boss level missing D`);
  }));
  return problems;
}

// Allow `node js/levels.js` to validate
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  const p = validateLevels();
  console.log(p.length ? p.join('\n') : 'levels OK');
}
