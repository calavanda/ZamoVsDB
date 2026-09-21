
export const TILE = 16;
export const VIEW_W = 480;
export const VIEW_H = 270;

export const GRAVITY = 0.32;
export const MAX_FALL = 7;

export const PLAYER = {
  W: 11, H: 13,
  ACCEL: 0.22, AIR_ACCEL: 0.14,
  MAX_WALK: 1.7, MAX_INDEX: 2.45,
  FRICTION: 0.8,
  JUMP_V: -6.7, JUMP_V_INDEX: -7.1,
  JUMP_CUT: 0.45,
  CLIMB_SPD: 1.4,
  COYOTE: 6, JBUF: 7,
  STOMP_BOUNCE: -4.2,
  INVULN: 100,
};

export const URLS = {
  site: '',
  game: '',
  github: '',
  download: '',
};

export const PAL = {
  bg: '#08090a',
  panel: '#111214',
  border: '#1f2937',
  text: '#d1d5db',
  muted: '#9ca3af',
  bright: '#ffffff',
  blue: '#3b82f6',
  cyan: '#22d3ee',
  teal: '#0de7d2',
  violet: '#a78bfa',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

export const WORLDS = [
  {
    id: 'sqlite', name: 'SQLITE', sub: 'las llanuras embebidas',
    accent: '#22d3ee', ground: '#101820', groundTop: '#22d3ee',
    sky: ['#08090a', '#0a1018'],
    boss: { name: 'BLOQUEO DE TABLA', hp: 3, color: 'amber' },
  },
  {
    id: 'mysql', name: 'MYSQL', sub: 'las profundidades del delfín',
    accent: '#f59e0b', ground: '#1a1410', groundTop: '#f59e0b',
    sky: ['#08090a', '#120e08'],
    boss: { name: 'RETRASO DE REPLICACIÓN', hp: 4, color: 'violet' },
  },
  {
    id: 'postgresql', name: 'POSTGRESQL', sub: 'las agujas del elefante',
    accent: '#3b82f6', ground: '#0e1426', groundTop: '#3b82f6',
    sky: ['#08090a', '#0a0c1a'],
    boss: { name: 'EL DEADLOCK', hp: 5, color: 'red' },
  },
];

// Tiles that block movement ('?'/'I'/'M'/'R' must be solid or head-bumps never fire)
export const SOLID = new Set(['#', 'B', 'b', '|', 'T', '?', 'I', 'M', 'R']);
// One-way platform
export const ONEWAY = '=';
// Climbable data cables: not solid, but hold Up/Down to ride them vertically
export const CLIMB = new Set(['H']);

export const SAVE_KEY = 'zamorun-v1';
