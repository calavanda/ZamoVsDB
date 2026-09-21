// Procedural pixel art: every sprite is authored as a char grid and rendered
// to an offscreen canvas at boot. '.' or ' ' = transparent.

import { TILE, WORLDS } from './constants.js';

const COLORS = {
  k: '#0c1322', // outline
  c: '#22d3ee', C: '#0891b2', // cyan
  b: '#3b82f6', d: '#1e40af', // blue
  w: '#ffffff', p: '#0b1020',
  y: '#fde047', Y: '#a5f3fc',
  r: '#ef4444', R: '#991b1b',
  m: '#a78bfa', M: '#6d28d9',
  a: '#f59e0b', A: '#b45309',
  g: '#22c55e', G: '#15803d', // crocodile green / dark green
  l: '#86efac', // snout light highlight
  s: '#94a3b8', S: '#334155', // sneaker / soles
  n: '#16202e', N: '#1f2937',
  o: '#fb923c',
  h: '#1e293b', H: '#0f172a', // hoodie & headphone dark blue
  q: '#10b981', // headphone neon glow ring
  t: '#fb7185', // tongue pink
};

function render(rows, w = 16, h = 16, overrides = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < Math.min(row.length, w); x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      ctx.fillStyle = overrides[ch] || COLORS[ch] || '#f0f';
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

// ---------------------------------------------------------------- player ---
const P_BODY = [
  '................',
  '..kkkkkkkkkkkk..',
  '..kYYcccccccck..',
  '..kcccccccccck..',
  '..kbbbbbbbbbbk..',
  '..kbwwbbbbwwbk..',
  '..kbwpbbbbpwbk..',
  '..kbbbbbbbbbbk..',
  '..kbbbbppbbbbk..',
  '..kdbbbbbbbbdk..',
  '..kddddddddddk..',
  '..kkkkkkkkkkkk..',
];
const P_FEET = {
  idle:  ['...kSSk..kSSk...', '...kSSk..kSSk...'],
  run1:  ['..kSSk....kSSk..', '.kSSk......kSSk.'],
  run2:  ['....kSSkkSSk....', '....kSSkkSSk....'],
  jump:  ['....kSSSSSSk....', '................'],
};
function playerFrame(body, feet) {
  return render([...body, ...P_FEET[feet], '..', '..']);
}

// Selectable protagonists — same 12-row body skeleton as P_BODY (so all
// four share the animated feet), each a database concept with its own face.
const KEY_BODY = [
  '................',
  '..kkkkkkkkkkkk..',
  '..kyyyyppyyyyk..',
  '..kyyyyppyyyyk..',
  '..kaaaaaaaaaak..',
  '..kawwaaaawwak..',
  '..kawpaaaapwak..',
  '..kaaaaaaaaaak..',
  '..kaaaappaaaak..',
  '..kAaaaaaaaaAk..',
  '..kAAAAAAAAAAk..',
  '..kkkkkkkkkkkk..',
];
const CURSOR_BODY = [
  '................',
  '..kkkkkkkkkkkk..',
  '..kpppwwwppppk..',
  '..kggggggggggk..',
  '..kggggggggggk..',
  '..kgwwggggwwgk..',
  '..kgwpggggpwgk..',
  '..kggggggggggk..',
  '..kggggppggggk..',
  '..kGggggggggGk..',
  '..kGGGGGGGGGGk..',
  '..kkkkkkkkkkkk..',
];
const TRIGGER_BODY = [
  '................',
  '..kkkkkkkkkkkk..',
  '..koooyyoooook..',
  '..kooyyooooook..',
  '..koooyooooook..',
  '..kowwoooowwok..',
  '..kowpoooopwok..',
  '..kooooooooook..',
  '..koooppppoook..',
  '..kAooooooooAk..',
  '..kAAAAAAAAAAk..',
  '..kkkkkkkkkkkk..',
];

// COCO — cocodrilo gamer: auriculares neón, hocico con dientes, sudadera oscura TI, cola
// Cara a la derecha (face=1 = sin flip). Colores: g=verde vivo, G=verde oscuro,
// l=verde claro (hocico), h=auricularres, H/h=sudadera, q=aro neón, w=blanco, t=lengua
const COCO_IDLE = [
  '...kqqqqqk......', // auriculares arco neón
  '..kqhhhhhqk.....', // banda + almohadillas
  '.kGGhqhhhqhGGk..', // cabeza ancha con auriculares a los lados
  '.kGGGwpGGwpGGGk.', // ojos (blanco + pupila)
  '.kGGGGGGGGGGGGk.', // mejillas anchas
  '.kGGGGllllllkk..', // hocico (verde claro) apuntando derecha
  'kGGGGGtwwwwwGkk.', // boca abierta: lengua + dientes blancos
  '.kHHHHHHHHGGlk..', // cuello sudadera + barbilla
  '.kHHHHHHHHHHHk..', // pecho sudadera
  '.kHHyHHHHyHHHk..', // logo TI en pecho (amarillo)
  'kGkHHHHHHHHHkk..', // cola verde izq + cuerpo bajo
  'kGGGkHHHHHkk....', // cola extendida
  '..kSSkkkSSk.....', // zapatillas
  '..kSSk.kSSk.....', // suelas
  '................', // vacío
  '................', // vacío
];

const COCO_RUN1 = [
  '...kqqqqqk......',
  '..kqhhhhhqk.....',
  '.kGGhqhhhqhGGk..',
  '.kGGGwpGGwpGGGk.',
  '.kGGGGGGGGGGGGk.',
  '.kGGGGllllllkk..',
  'kGGGGGtwwwwwGkk.',
  '.kHHHHHHHHGGlk..',
  '.kHHHHHHHHHHHk..',
  '.kHHyHHHHyHHHk..',
  'kGkHHHHHHHHHkk..',
  'kGGGkHHHHHkk....',
  '.kSSk....kSSk...', // piernas abiertas - zancada
  'kSSk......kSSk..', // suelas separadas
  '................',
  '................',
];

const COCO_RUN2 = [
  '...kqqqqqk......',
  '..kqhhhhhqk.....',
  '.kGGhqhhhqhGGk..',
  '.kGGGwpGGwpGGGk.',
  '.kGGGGGGGGGGGGk.',
  '.kGGGGllllllkk..',
  'kGGGGGtwwwwwGkk.',
  '.kHHHHHHHHGGlk..',
  '.kHHHHHHHHHHHk..',
  '.kHHyHHHHyHHHk..',
  'kGkHHHHHHHHHkk..',
  'kGGGkHHHHHkk....',
  '...kSSkkSSk.....', // piernas cruzadas - centro
  '...kSSkkSSk.....',
  '................',
  '................',
];

const COCO_JUMP = [
  '...kqqqqqk......',
  '..kqhhhhhqk.....',
  '.kGGhqhhhqhGGk..',
  '.kGGGwpGGwpGGGk.',
  '.kGGGGGGGGGGGGk.',
  '.kGGGGllllllkk..',
  'kGGGGGtwwwwwGkk.',
  '.kHHHHHHHHGGlk..',
  '.kHHHHHHHHHHHk..',
  '.kHHyHHHHyHHHk..',
  'kGkHHHHHHHHHkk..',
  'kGGGGkHHHHkk....',
  '...kSSSSSSSSk...', // pies juntos en salto
  '................', // pies en el aire
  '................',
  '................',
];

export const COCO_FRAMES = {
  idle: COCO_IDLE,
  run1: COCO_RUN1,
  run2: COCO_RUN2,
  jump: COCO_JUMP,
};

export const CHARACTERS = [
  { id: 'coco', name: 'COCO', tag: 'el cocodrilo gamer de TI', frames: COCO_FRAMES },
  { id: 'tab', name: 'TAB', tag: 'el cubo de datos', body: P_BODY },
  { id: 'key', name: 'PRIMARY KEY', tag: 'UNIQUE NOT NULL', body: KEY_BODY },
  { id: 'cursor', name: 'CURSOR', tag: 'FETCH NEXT', body: CURSOR_BODY },
  { id: 'trigger', name: 'TRIGGER', tag: 'ON EVENT DO RUN', body: TRIGGER_BODY },
];

// --------------------------------------------------------------- enemies ---
const BLOB_1 = [
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...krrrrrrrrk...',
  '..krrcrrrrrcrk..',
  '.krrrrrrrrrrrrk.',
  '.krwwprrrrpwwrk.',
  '.krwwprrrrpwwrk.',
  '.krrrrrrrrrrrrk.',
  '.krrRRrrrrRRrrk.',
  '.krrrrrcrrrrrrk.',
  '..kRRRRRRRRRRk..',
  '...kkkkkkkkkk...',
  '................',
  '................',
];
const BLOB_2 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...krrcrrrrrk...',
  '..krrrrrrrrrrk..',
  '.krwwprrrrpwwrk.',
  '.krwwprrrrpwwrk.',
  'krrrrrrrrrrrrrrk',
  'krrRRrrcrrRRrrrk',
  'kRRRRRRRRRRRRRRk',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
];
const SNAIL_1 = [
  '................',
  '................',
  '................',
  '................',
  '.......kkkkk....',
  '......kaaaaak...',
  '.....kaAAAaaak..',
  '.kk..kaAkkAaak..',
  'kwpk.kaAkAAaak..',
  'kaakkkaaAAaaak..',
  'kaaaakaaaaaak...',
  'kaaaaaakkkkk....',
  'kaaaaaaaaaaak...',
  '.kkkkkkkkkkkk...',
  '................',
  '................',
];
const SNAIL_2 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......kkkkk....',
  '......kaaaaak...',
  '.kk..kaAAAaaak..',
  'kwpk.kaAkkAaak..',
  'kaakkkaAkAAaak..',
  'kaaaakaaAAaaak..',
  'kaaaaaakaaaak...',
  'kaaaaaaaakkk....',
  '.kkkkkkkkkkkk...',
  '................',
  '................',
];
const WISP_1 = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kmmmmmmk....',
  '...kmmmmmmmmk...',
  '..kmmwwmmwwmmk..',
  '..kmmwpmmwpmmk..',
  '..kmmmmmmmmmmk..',
  '..kmmMMMMMMmmk..',
  '..kmmmmmmmmmmk..',
  '..kmmmmmmmmmmk..',
  '...km.kmmk.mk...',
  '....k..kk..k....',
  '................',
  '................',
  '................',
];
const WISP_2 = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kmmmmmmk....',
  '...kmmmmmmmmk...',
  '..kmmwwmmwwmmk..',
  '..kmmwpmmwpmmk..',
  '..kmmmmmmmmmmk..',
  '..kmmMMMMMMmmk..',
  '..kmmmmmmmmmmk..',
  '..kmmmmmmmmmmk..',
  '...k.mmk.kmm....',
  '....k..k..k.....',
  '................',
  '................',
  '................',
];
const DRONE_1 = [
  '.kkkk......kkkk.',
  '....k......k....',
  '...kkkkkkkkkk...',
  '..kcccccccccck..',
  '..kcwpccccwpck..',
  '..kccCCCCCCcck..',
  '...kkkkkkkkkk...',
  '.....k....k.....',
  '................',
];
const DRONE_2 = [
  '..k.kk....kk.k..',
  '....k......k....',
  '...kkkkkkkkkk...',
  '..kcccccccccck..',
  '..kcwpccccwpck..',
  '..kccCCCCCCcck..',
  '...kkkkkkkkkk...',
  '.....k....k.....',
  '................',
];
const DAEMON_1 = [
  '..kk........kk..',
  '.kaak..kk..kaak.',
  '.kaaak.kk.kaaak.',
  '..kaakkkkkkaak..',
  '...kaaaaaaaak...',
  '..kawpaaaawpak..',
  '..kaaaaaaaaaak..',
  '..kaaAAaaAAaak..',
  '...kaaaaaaaak...',
  '....kkkkkkkk....',
];
const DAEMON_2 = [
  '.......kk.......',
  '.......kk.......',
  '...kkkkkkkkkk...',
  '..kaaaaaaaaaak..',
  '.kaakaaaaaakaak.',
  '.kaawpaaaawpaak.',
  '..kkaaaaaaaakk..',
  '...kaaAAaaAAk...',
  '...kaaaaaaaak...',
  '....kkkkkkkk....',
];
const LOCK = (X, Xd) => [
  '................',
  '.....kkkkkk.....',
  '....kssssssk....',
  '....ks....sk....',
  '....ks....sk....',
  '....ks....sk....',
  '..kkkkkkkkkkkk..',
  `..kXXXXXXXXXXk..`,
  `..kXXXXkkXXXXk..`,
  `..kXXXXkkXXXXk..`,
  `..kXXXXXkXXXXk..`,
  `..kXXXXXXXXXXk..`,
  `..kDDDDDDDDDDk..`,
  '..kkkkkkkkkkkk..',
  '................',
  '................',
].map(r => r.replace(/X/g, X).replace(/D/g, Xd));

// World 1 boss — SQLite has no animal mascot, only its "light as a feather"
// logo, so we lean on a hummingbird: tiny, fast, embedded everywhere. Hovering,
// needle beak forward, wing raised, ruby throat, forked tail. Facing left.
const BOSS_HUMMINGBIRD = [
  '................',
  '...........kkk..',
  '..........kgggk.',
  '.........kgggk..',
  '........kgggk...',
  '.......kggck....',
  '....kkkccck.....',
  'kkkkcwpcccck....',
  '....kcccccck....',
  '...krrcccckkk...',
  '...krrcccCCCk...',
  '....kcccCCk.....',
  '.....kCCk.......',
  '......kk........',
  '................',
  '................',
];

// World 3 boss — PostgreSQL's elephant, trunk and tusk forward, facing left.
const BOSS_ELEPHANT = [
  '..kkkkk.........',
  '.krrrrrkkkkkkk..',
  '.krrrrrrrrrrrrk.',
  'kkrpwrkRRRkrrrrk',
  'krrrrrkRRRkrrrrk',
  'krrrrrkRRRkrrrrk',
  'krrkrrrkkkrrrrrk',
  'krrkwwkrrrrrrrrk',
  'krrkkkkrrrrrrrrk',
  '.krrk.krrrrrrrk.',
  '.krrk.krrrrrrrk.',
  '..kk..krrrrrrrk.',
  '......kRRrrRRrk.',
  '.....kRRkkkRRkk.',
  '.....kRRk.kRRk..',
  '.....kkkk.kkkk..',
];

// World 2 boss — MySQL's dolphin, upright on its tail, facing left.
const BOSS_DOLPHIN = [
  '......kkkk......',
  '.....kmmmmk.....',
  '.kkkkmmpwmmk....',
  'kmmmmmmmmmmmk...',
  '.kkkkmwmmmmmk...',
  '.....kwwmmmmk...',
  '.....kwwmmmmkk..',
  '....kkwwmmmmmMk.',
  '...kwwwmmmmmMk..',
  '...kkwwmmmmmk...',
  '.....kwwmmmk....',
  '.....kwmmmk.....',
  '......kmmk......',
  '.....kmMMmk.....',
  '...kkmMMMMmkk...',
  '..kMMMkkkkMMMk..',
];

// ----------------------------------------------------------------- items ---
const COIN = [
  '..kkkkkkkk..',
  '.kcccccccck.',
  '.kcYYYYYYck.',
  '.kcccccccck.',
  '.kcYYYYYYck.',
  '.kcccccccck.',
  '.kcYYYYYYck.',
  '.kcccccccck.',
  '..kkkkkkkk..',
];
const INDEX_ITEM = [
  '................',
  '......kkkk......',
  '.....kyyyk......',
  '....kyyyk.......',
  '...kyyyk........',
  '..kyyyyykkkk....',
  '...kkkyyyyk.....',
  '.....kyyyk......',
  '....kyyyk.......',
  '...kyyyk........',
  '...kyyk.........',
  '...kyk..........',
  '...kk...........',
  '................',
  '................',
  '................',
];
const MCP_ITEM = [
  '................',
  '.......kk.......',
  '......kmmk......',
  '.....kmmmmk.....',
  '....kmmYYmmk....',
  '...kmmYwwYmmk...',
  '...kmmYwwYmmk...',
  '....kmmYYmmk....',
  '.....kmmmmk.....',
  '......kmmk......',
  '.......kk.......',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const SCALE_ITEM = [
  '................',
  '................',
  '...kkkkkkkkkkk..',
  '..kggggggggggk..',
  '..kgkkgkkgkkgk..',
  '..kgkkgkkgkkgk..',
  '..kggggggggggk..',
  '..kgggggggggGk..',
  '..kyykyykyykyk..',
  '..kkkkkkkkkkkk..',
  '................',
];
const PLUGIN = [
  '...kk...kk....',
  '...kYk..kYk...',
  '..kkkkkkkkkk..',
  '..kmmmmmmmmk..',
  '..kmmYYYmmmk..',
  '..kmmYYYmmmk..',
  '..kmmmmmmmmk..',
  '...kmmmmmmk...',
  '....kkkkkk....',
];
const QBLOCK = [
  'kkkkkkkkkkkkkkkk',
  'kbnnnnnnnnnnnnbk',
  'knnnnnwwwwnnnnnk',
  'knnnnwwnnwwnnnnk',
  'knnnnwwnnwwnnnnk',
  'knnnnnnnwwnnnnnk',
  'knnnnnnwwnnnnnnk',
  'knnnnnnwwnnnnnnk',
  'knnnnnnnnnnnnnnk',
  'knnnnnnwwnnnnnnk',
  'knnnnnnwwnnnnnnk',
  'knnnnnnnnnnnnnnk',
  'kbnnnnnnnnnnnnbk',
  'kkkkkkkkkkkkkkkk',
  '................',
  '................',
];
const USED_BLOCK = [
  'kkkkkkkkkkkkkkkk',
  'kSNNNNNNNNNNNNSk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kNNNNNNNNNNNNNNk',
  'kSNNNNNNNNNNNNSk',
  'kkkkkkkkkkkkkkkk',
  '................',
  '................',
];
const FLAGPOLE = [
  '.......ss.......',
  '.......ssgggggg.',
  '.......ssgwwggg.',
  '.......ssgwggggg',
  '.......ssgggggg.',
  '.......ssggggg..',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '......ssss......',
  '.....ssssss.....',
];
const CHECKPOINT = [
  '.......ss.......',
  '.......ssgggg...',
  '.......ssgGGg...',
  '.......ssgggg...',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '......ssss......',
  '.....ssssss.....',
];
const BOLT = [
  '............',
  '..kkkk......',
  '.kccYYkk....',
  'kcYYYYYYk...',
  '.kccYYkk....',
  '..kkkk......',
];
const ORB = [
  '...kkkk...',
  '..krrrrk..',
  '.krRrrRrk.',
  '.krrrrrrk.',
  '.krRrrRrk.',
  '..krrrrk..',
  '...kkkk...',
];

// ----------------------------------------------------------------- tiles ---
function groundTile(world) {
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = world.ground;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = world.groundTop;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, 0, 16, 2);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = world.accent;
  ctx.fillRect(0, 0, 1, 16);
  ctx.fillRect(15, 0, 1, 16);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 15, 16, 1);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = world.accent;
  ctx.fillRect(4, 6, 2, 2); ctx.fillRect(10, 10, 2, 2);
  return cv;
}
function brickTile(world) {
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#161b27';
  ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = world.accent;
  ctx.globalAlpha = 0.45;
  ctx.strokeRect(0.5, 0.5, 15, 15);
  ctx.globalAlpha = 0.3;
  // table-row stripes
  ctx.fillStyle = world.accent;
  ctx.fillRect(3, 4, 10, 1);
  ctx.fillRect(3, 8, 10, 1);
  ctx.fillRect(3, 12, 10, 1);
  return cv;
}
function spikeTile() {
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ef4444';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 4, 16);
    ctx.lineTo(i * 4 + 2, 7);
    ctx.lineTo(i * 4 + 4, 16);
    ctx.fill();
  }
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(0, 14, 16, 2);
  return cv;
}
// Climbable data cable: twin rails + glowing rungs, transparent elsewhere so it
// overlays the background. Accent-tinted per world.
function cableTile(world) {
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = world.accent;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(4, 0, 2, 16);
  ctx.fillRect(10, 0, 2, 16);
  ctx.globalAlpha = 0.5;
  for (let y = 1; y < 16; y += 5) ctx.fillRect(4, y, 8, 2);  // rungs
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, 3, 1, 1); ctx.fillRect(10, 11, 1, 1);      // signal dots
  return cv;
}
function platformTile(world) {
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = world.accent;
  ctx.fillRect(0, 0, 16, 2);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 2, 16, 3);
  ctx.fillStyle = '#0f1520';
  ctx.fillRect(1, 5, 2, 2); ctx.fillRect(13, 5, 2, 2);
  return cv;
}
function tunnelTop() {
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0c1f17';
  ctx.fillRect(0, 2, 16, 14);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(0, 0, 16, 3);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#34d399';
  ctx.strokeRect(0.5, 2.5, 15, 13);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#34d399';
  // ">_" terminal prompt
  ctx.fillRect(4, 7, 1, 1); ctx.fillRect(5, 8, 1, 1); ctx.fillRect(4, 9, 1, 1);
  ctx.fillRect(8, 10, 4, 1);
  return cv;
}
function tunnelBody() {
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0c1f17';
  ctx.fillRect(1, 0, 14, 16);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#34d399';
  ctx.beginPath();
  ctx.moveTo(1.5, 0); ctx.lineTo(1.5, 16);
  ctx.moveTo(14.5, 0); ctx.lineTo(14.5, 16);
  ctx.stroke();
  return cv;
}

// ----------------------------------------------------------------- build ---
export function buildSprites() {
  const S = {
    // one animated set per selectable character; `player` aliases the active
    // one (main.js repoints it on selection) so game/sharecard need no logic
    players: Object.fromEntries(CHARACTERS.map(c => [c.id, c.frames ? {
      idle: render(c.frames.idle),
      run1: render(c.frames.run1),
      run2: render(c.frames.run2),
      jump: render(c.frames.jump),
    } : {
      idle: playerFrame(c.body, 'idle'),
      run1: playerFrame(c.body, 'run1'),
      run2: playerFrame(c.body, 'run2'),
      jump: playerFrame(c.body, 'jump'),
    }])),
    blob: [render(BLOB_1), render(BLOB_2)],
    snail: [render(SNAIL_1), render(SNAIL_2)],
    wisp: [render(WISP_1), render(WISP_2)],
    drone: [render(DRONE_1), render(DRONE_2)],
    daemon: [render(DAEMON_1), render(DAEMON_2)],
    lockClosed: render(LOCK('r', 'R')),
    lockOpen: render(LOCK('g', 'G')),
    boss: {
      amber: render(BOSS_HUMMINGBIRD),
      violet: render(BOSS_DOLPHIN),
      red: render(BOSS_ELEPHANT),
    },
    coin: render(COIN, 12, 12),
    plugin: render(PLUGIN, 14, 9),
    scaleItem: render(SCALE_ITEM),
    indexItem: render(INDEX_ITEM),
    mcpItem: render(MCP_ITEM),
    qblock: render(QBLOCK),
    usedBlock: render(USED_BLOCK),
    flag: render(FLAGPOLE),
    checkpoint: render(CHECKPOINT),
    checkpointOn: render(CHECKPOINT.map(r => r.replace(/g/g, 'c').replace(/G/g, 'w'))),
    bolt: render(BOLT, 12, 6),
    orb: render(ORB, 10, 7),
    spike: spikeTile(),
    tunnelTop: tunnelTop(),
    tunnelBody: tunnelBody(),
    tiles: WORLDS.map(w => ({
      ground: groundTile(w),
      brick: brickTile(w),
      platform: platformTile(w),
      cable: cableTile(w),
    })),
  };
  S.player = S.players.coco;
  return S;
}

// Big animated logo cube for the title screen (drawn, not a sprite grid).
export function drawLogoCube(ctx, cx, cy, size, t) {
  const bob = Math.sin(t / 40) * 4;
  cy += bob;
  const h = size * 0.5;
  ctx.save();
  // top face
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + size * 0.85, cy - h * 0.5);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx - size * 0.85, cy - h * 0.5);
  ctx.closePath(); ctx.fill();
  // left face
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.85, cy - h * 0.5);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx - size * 0.85, cy + h * 0.5);
  ctx.closePath(); ctx.fill();
  // right face
  ctx.fillStyle = '#6d28d9';
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.85, cy - h * 0.5);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx + size * 0.85, cy + h * 0.5);
  ctx.closePath(); ctx.fill();
  // layer lines on faces (the "tables")
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    const yy = cy + (h * i) / 3;
    ctx.moveTo(cx - size * 0.85, yy - h * 0.5);
    ctx.lineTo(cx, yy);
    ctx.lineTo(cx + size * 0.85, yy - h * 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

// Logo animado del juego (cubo pixel-art giratorio).
// downscaled to 32×32 and inlined, drawn with smoothing off so it stays crisp
// and pixelated like the rest of the game. Falls back to the procedural cube
// until the tiny inline image decodes.
const LOGO_PIX_URI = 'data:image/png;base64,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';
let logoPix = null;
{
  const img = new Image();
  img.onload = () => { logoPix = img; };
  img.src = LOGO_PIX_URI;
}

export function drawLogoPixel(ctx, cx, cy, size, t) {
  const bob = Math.sin(t / 40) * 4;
  if (!logoPix) { drawLogoCube(ctx, cx, cy, size, t); return; }
  const d = Math.round(size * 1.9);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(logoPix, Math.round(cx - d / 2), Math.round(cy - d / 2 + bob), d, d);
  ctx.imageSmoothingEnabled = prev;
}
