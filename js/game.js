// Core engine: level loading, tile collisions, entity interactions, camera,
// rendering. The app (main.js) owns meta-state: lives, score, screens.

import { TILE, VIEW_W, VIEW_H, SOLID, ONEWAY, CLIMB, WORLDS } from './constants.js';
import { LEVELS } from './levels.js';
import {
  Player, Blob, Snail, Wisp, Drone, Daemon, LockGate, Boss,
  ItemPickup, SkyDrop, Plugin, Particle, FloatText, overlap,
} from './entities.js';

const T = TILE;

export class Game {
  constructor(app) {
    this.app = app;
    this.shake = 0;
  }

  loadLevel(wi, li, checkpoint = null) {
    const def = LEVELS[wi][li];
    const data = def.gen();
    this.worldIdx = wi;
    this.levelIdx = li;
    this.levelName = def.name;
    this.map = data.map.map(r => r.split(''));
    this.H = this.map.length;
    this.W = this.map[0].length;
    this.isBossLevel = !!data.boss;
    this.isVertical = !!data.vertical;
    this.bgVariant = li; // per-level background flavor (0..3)
    this.boss = null;
    this.bossDead = false;

    this.enemies = [];
    this.locks = [];
    this.items = [];
    this.bolts = [];
    this.orbs = [];
    this.particles = [];
    this.texts = [];
    this.bumps = [];
    this.warpTs = [];
    this.flags = [];
    this.warps = data.warps || [];
    this.warpState = null; // {phase:'out'|'in', t, dest}
    this.clearT = -1;
    this.frame = 0;
    this.shake = 0;
    this.dropT = 600; // boss arenas: frames until the next sky power-up

    this.pluginsGot = [];
    this.pluginTotal = 0;
    let start = [3, 13];
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const ch = this.map[y][x];
        switch (ch) {
          case 'p':
            this.items.push(new Plugin(x, y, this.pluginTotal++));
            this.map[y][x] = ' ';
            break;
          case 'S': start = [x, y]; this.map[y][x] = ' '; break;
          case 'g': this.enemies.push(new Blob(x, y)); this.map[y][x] = ' '; break;
          case 's': this.enemies.push(new Snail(x, y)); this.map[y][x] = ' '; break;
          case 'f': this.enemies.push(new Wisp(x, y)); this.map[y][x] = ' '; break;
          case 'v': this.enemies.push(new Drone(x, y)); this.map[y][x] = ' '; break;
          case 'w': this.enemies.push(new Daemon(x, y)); this.map[y][x] = ' '; break;
          case 'l': this.locks.push(new LockGate(x, y)); this.map[y][x] = ' '; break;
          case 'D': this.boss = new Boss(x, y, wi); this.map[y][x] = ' '; break;
          case 'T': this.warpTs.push([x, y]); break;
          case 'F': this.flags.push([x, y]); break;
        }
      }
    }

    let px = start[0] * T + 2, py = (start[1] + 1) * T - 13;
    if (checkpoint) {
      px = checkpoint[0] * T + 2;
      py = checkpoint[1] * T - 13;
      const ch = this.map[checkpoint[1]]?.[checkpoint[0]];
      if (ch === 'K') this.map[checkpoint[1]][checkpoint[0]] = '%';
    }
    this.player = new Player(px, py);
    this.cam = { x: 0, y: 0 };
    this.snapCamera();
  }

  // ------------------------------------------------------------- queries ---
  tileAt(tx, ty) {
    if (ty < 0 || ty >= this.H || tx < 0 || tx >= this.W) return ' ';
    return this.map[ty][tx];
  }

  solidAt(tx, ty) {
    if (tx < 0 || tx >= this.W) return true; // level edges
    if (ty < 0 || ty >= this.H) return false;
    if (SOLID.has(this.map[ty][tx])) return true;
    for (const l of this.locks) {
      if (l.closed && l.tx === tx && l.ty === ty) return true;
    }
    return false;
  }

  // Is the entity's center column overlapping a climbable cable tile?
  climbAt(e) {
    const cx = Math.floor((e.x + e.w / 2) / T);
    const y0 = Math.floor(e.y / T);
    const y1 = Math.floor((e.y + e.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) {
      if (CLIMB.has(this.tileAt(cx, ty))) return true;
    }
    return false;
  }

  // -------------------------------------------------------------- physics ---
  moveEntity(e, isPlayer = false) {
    // horizontal
    e.x += e.vx;
    let x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
    let y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
    if (e.vx > 0) {
      for (let ty = y0; ty <= y1; ty++) {
        if (this.solidAt(x1, ty)) { e.x = x1 * T - e.w; e.vx = 0; e.hitWall = true; break; }
      }
    } else if (e.vx < 0) {
      for (let ty = y0; ty <= y1; ty++) {
        if (this.solidAt(x0, ty)) { e.x = (x0 + 1) * T; e.vx = 0; e.hitWall = true; break; }
      }
    }
    // vertical
    const prevBottom = e.y + e.h;
    e.y += e.vy;
    x0 = Math.floor(e.x / T); x1 = Math.floor((e.x + e.w - 0.01) / T);
    e.onGround = false;
    if (e.vy >= 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / T);
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tileAt(tx, ty);
        const solid = this.solidAt(tx, ty);
        const oneway = ch === ONEWAY && prevBottom <= ty * T + 0.01;
        if (solid || oneway) {
          e.y = ty * T - e.h; e.vy = 0; e.onGround = true;
          break;
        }
      }
    } else {
      const ty = Math.floor(e.y / T);
      let bumped = null, bestDist = 1e9;
      for (let tx = x0; tx <= x1; tx++) {
        if (this.solidAt(tx, ty)) {
          e.y = (ty + 1) * T; e.vy = 0;
          if (isPlayer) {
            const d = Math.abs((tx + 0.5) * T - (e.x + e.w / 2));
            if (d < bestDist) { bestDist = d; bumped = tx; }
          }
        }
      }
      if (bumped !== null) this.bumpBlock(bumped, ty);
    }
  }

  bumpBlock(tx, ty) {
    const ch = this.map[ty][tx];
    if (ch === '?' || ch === 'I' || ch === 'M' || ch === 'R') {
      this.map[ty][tx] = 'b';
      this.bumps.push({ tx, ty, t: 0 });
      if (ch === '?') {
        this.app.addRows(1);
        this.app.addScore(10);
        this.app.audio.coin();
        this.spark(tx * T + 8, ty * T - 4, '#22d3ee', 6);
        this.texts.push(new FloatText(tx * T + 8, ty * T - 6, '+1 fila', '#22d3ee'));
      } else {
        this.app.audio.bump();
        const kind = { I: 'index', M: 'mcp', R: 'scale' }[ch];
        this.items.push(new ItemPickup(tx, ty - 1, kind));
      }
    } else if (ch === 'B') {
      this.app.audio.bump();
      this.bumps.push({ tx, ty, t: 0 });
    }
  }

  // --------------------------------------------------------------- update ---
  update() {
    this.frame++;
    const p = this.player;

    // warp transition
    if (this.warpState) {
      const w = this.warpState;
      w.t++;
      if (w.phase === 'out' && w.t >= 24) {
        p.x = w.dest[0] * T + 2;
        p.y = w.dest[1] * T - p.h;
        p.vx = 0; p.vy = 0;
        this.snapCamera();
        w.phase = 'in'; w.t = 0;
      } else if (w.phase === 'in' && w.t >= 24) {
        this.warpState = null;
        p.frozen = false;
      }
      return;
    }

    p.update(this);

    // activate entities entering view (vertically in climb levels)
    const actX = this.cam.x + VIEW_W + 48;
    for (const e of [...this.enemies, this.boss].filter(Boolean)) {
      if (e.active) continue;
      if (this.isVertical) {
        if (Math.abs(e.y - (this.cam.y + VIEW_H / 2)) < VIEW_H) e.active = true;
      } else if (e.x < actX && e.x > this.cam.x - 64) {
        e.active = true;
      }
    }

    for (const e of this.enemies) if (e.active) e.update(this);
    for (const l of this.locks) l.update(this);
    if (this.boss) this.boss.update(this);

    // boss arenas: every 10s a support power-up parachutes in — always the
    // next tier the player is missing (MCP gun first), nothing if maxed out
    if (this.isBossLevel && this.boss?.active && !this.boss.dead && !p.dead && --this.dropT <= 0) {
      this.dropT = 600;
      const kind = !p.hasMCP ? 'mcp' : !p.big ? 'scale' : !p.hasIndex ? 'index' : null;
      if (kind) {
        const tx = Math.floor(this.cam.x / T) + 3 + Math.floor(Math.random() * (VIEW_W / T - 6));
        this.items.push(new SkyDrop(Math.min(tx, this.W - 3), kind));
        this.texts.push(new FloatText(Math.min(tx, this.W - 3) * T + 8, 26, 'AYUDA INCOMING', '#a78bfa'));
      }
    }
    for (const arr of [this.items, this.bolts, this.orbs, this.particles, this.texts]) {
      for (const o of arr) o.update(this);
    }
    for (const b of this.bumps) b.t++;
    this.bumps = this.bumps.filter(b => b.t < 10);
    this.enemies = this.enemies.filter(e => !e.removed);
    for (const k of ['items', 'bolts', 'orbs', 'particles', 'texts']) {
      this[k] = this[k].filter(o => !o.removed);
    }
    if (this.boss?.removed) this.boss = null;
    if (this.shake > 0) this.shake--;

    if (!p.dead && !p.frozen) {
      this.checkEnemyContact();
      this.checkTiles();
      this.checkWarp();
    }
    // fell out of the world
    if (!p.dead && p.y > this.H * T + 40) p.die(this);

    this.followCamera();
  }

  checkEnemyContact() {
    const p = this.player;
    const targets = [...this.enemies.filter(e => e.active), ...(this.boss && this.boss.active ? [this.boss] : [])];
    for (const e of targets) {
      if (e.dead || !e.hits(p)) continue;
      // closing speed is relative: an enemy leaping up into the player's feet
      // is still a stomp, not a side hit
      const falling = p.vy - Math.min(0, e.vy || 0) > 0.5;
      // a stomp is any descent that started above the enemy's head — judge by
      // last frame's positions so fast mutual closure can't read as a side hit
      const prevFeet = p.y + p.h - p.vy;
      const prevTop = e.y - (e.vy || 0);
      const headZone = Math.max(9, e.h * 0.4);
      const fromAbove = p.y + p.h - e.y < headZone || prevFeet <= prevTop + 6;
      if (e.stompable && falling && fromAbove) {
        e.stomp(this);
        this.app.audio.stomp();
        // bosses survive a stomp, so the overlap lingers a few frames while
        // the bounce separates us — mercy frames keep it from reading as a hit
        if (!e.dead) p.inv = Math.max(p.inv, 22);
        p.vy = this.app.input.held.jump ? -6.2 : -4.2;
        this.spark(e.cx, e.y, '#ffffff', 5);
        if (!(e instanceof Boss)) this.shake = Math.max(this.shake, 4);
      } else {
        p.hurt(this);
      }
    }
    for (const l of this.locks) {
      if (l.closed && overlap(l, p)) p.hurt(this);
    }
    for (const o of this.orbs) {
      if (overlap(o, p)) { o.removed = true; p.hurt(this); }
    }
    // player bolts vs enemies / boss
    for (const b of this.bolts) {
      for (const e of this.enemies) {
        if (!e.dead && e.active && !(e instanceof LockGate) && overlap(b, e)) {
          b.removed = true;
          if (e instanceof Snail) { e.hp--; e.flash = 30; if (e.hp <= 0) e.dead = true; }
          else { e.dead = true; e.t2 = 0; }
          if (e.dead) this.app.addScore(100);
          this.spark(e.cx, e.y + 4, '#22d3ee', 6);
          this.app.audio.stomp();
        }
      }
      if (this.boss && !this.boss.dead && this.boss.active && overlap(b, this.boss)) {
        b.removed = true;
        this.boss.hpf = (this.boss.hpf || 0) + 0.25;
        this.spark(this.boss.cx, this.boss.y + 8, '#22d3ee', 4);
        if (this.boss.hpf >= 1) { this.boss.hpf = 0; this.boss.damage(this, 1); this.app.audio.bosshit(); }
      }
    }
  }

  checkTiles() {
    const p = this.player;
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.01) / T);
    const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tileAt(tx, ty);
        if (ch === 'o') {
          this.map[ty][tx] = ' ';
          this.app.addRows(1);
          this.app.addScore(10);
          this.app.audio.coin();
          this.spark(tx * T + 8, ty * T + 8, '#22d3ee', 4);
        } else if (ch === '^') {
          if (p.y + p.h > ty * T + 7) p.hurt(this);
        } else if (ch === 'K') {
          this.map[ty][tx] = '%';
          this.app.setCheckpoint(tx, ty + 1);
          this.app.audio.checkpoint();
          this.texts.push(new FloatText(tx * T + 8, ty * T - 8, 'BEGIN; — punto de control', '#34d399'));
        }
      }
    }
    // flag: full-column trigger (5 tiles tall) so it can't be jumped over
    if (this.clearT < 0 && (!this.isBossLevel || this.bossDead)) {
      for (const [fx, fy] of this.flags) {
        if (p.x + p.w > fx * T && p.x < (fx + 1) * T &&
            p.y + p.h > (fy - 8) * T && p.y < (fy + 1) * T) {
          this.levelClear();
          return;
        }
      }
    }
  }

  checkWarp() {
    const p = this.player;
    if (!this.warps.length || !p.onGround || !this.app.input.held.down) return;
    const tx = Math.floor((p.x + p.w / 2) / T);
    const ty = Math.floor((p.y + p.h + 1) / T);
    const idx = this.warpTs.findIndex(([wx, wy]) => wx === tx && wy === ty);
    if (idx >= 0 && this.warps[idx]) {
      p.frozen = true;
      this.warpState = { phase: 'out', t: 0, dest: this.warps[idx] };
      this.app.audio.warp();
    }
  }

  levelClear() {
    if (this.clearT >= 0) return;
    this.clearT = 0;
    this.player.frozen = true;
    this.player.vx = 0;
    this.app.audio.commit();
    this.app.onLevelClear();
  }

  onBossDead() {
    this.bossDead = true;
    this.shake = 20;
    this.texts.push(new FloatText(this.boss.cx, this.boss.y - 10, 'BLOQUEO LIBERADO', '#34d399'));
  }

  // --------------------------------------------------------------- camera ---
  followCamera() {
    const p = this.player;
    const txx = p.x + p.w / 2 - VIEW_W * 0.42;
    const tyy = p.y + p.h / 2 - VIEW_H * 0.55;
    this.cam.x += (txx - this.cam.x) * 0.15;
    this.cam.y += (tyy - this.cam.y) * 0.12;
    this.clampCamera();
  }

  snapCamera() {
    const p = this.player;
    this.cam.x = p.x + p.w / 2 - VIEW_W * 0.42;
    this.cam.y = p.y + p.h / 2 - VIEW_H * 0.55;
    this.clampCamera();
  }

  clampCamera() {
    const maxX = this.W * T - VIEW_W;
    const maxY = this.H * T - VIEW_H;
    this.cam.x = Math.max(0, Math.min(this.cam.x, Math.max(0, maxX)));
    this.cam.y = Math.max(Math.min(0, maxY), Math.min(this.cam.y, Math.max(Math.min(0, maxY), maxY)));
  }

  // ---------------------------------------------------------------- spawn ---
  spark(x, y, color, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      this.particles.push(new Particle(x, y, Math.cos(a) * 1.4, Math.sin(a) * 1.4 - 0.8, color));
    }
  }

  dust(x, y, n = 2) {
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(
        x + (Math.random() - 0.5) * 8, y - 2,
        (Math.random() - 0.5) * 0.8, -0.4 - Math.random() * 0.5,
        '#64748b', 16, 2,
      ));
    }
  }

  explosion(x, y, color) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1 + Math.random() * 2.4;
      this.particles.push(new Particle(x, y, Math.cos(a) * v, Math.sin(a) * v - 1, color, 50, 3));
    }
  }

  floatText(x, y, text, color) {
    this.texts.push(new FloatText(x, y, text, color));
  }

  // ----------------------------------------------------------------- draw ---
  draw(ctx) {
    const world = WORLDS[this.worldIdx];
    const camX = Math.round(this.cam.x + (this.shake ? (Math.random() - 0.5) * 4 : 0));
    const camY = Math.round(this.cam.y + (this.shake ? (Math.random() - 0.5) * 3 : 0));

    this.drawBackground(ctx, world, camX, camY);

    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawTiles(ctx, world, camX, camY);
    for (const l of this.locks) l.draw(this, ctx);
    for (const it of this.items) it.draw(this, ctx);
    for (const e of this.enemies) if (e.active || e.x < camX + VIEW_W + 64) e.draw(this, ctx);
    if (this.boss) this.boss.draw(this, ctx);
    this.player.draw(this, ctx);
    for (const b of this.bolts) b.draw(this, ctx);
    for (const o of this.orbs) o.draw(this, ctx);
    for (const pt of this.particles) pt.draw(this, ctx);
    for (const t of this.texts) t.draw(this, ctx);

    ctx.restore();

    if (this.boss && this.boss.active && !this.boss.dead) this.drawBossBar(ctx);

    // warp fade
    if (this.warpState) {
      const w = this.warpState;
      const a = w.phase === 'out' ? w.t / 24 : 1 - w.t / 24;
      ctx.fillStyle = `rgba(4,10,8,${a})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = '#34d399';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = a;
      ctx.fillText('túnel ssh: redirigiendo...', VIEW_W / 2, VIEW_H / 2);
      ctx.globalAlpha = 1;
    }
  }

  drawBackground(ctx, world, camX, camY) {
    const F = this.frame;
    const rnd = (i, s = 0) => (((Math.sin(i * 127.1 + s * 311.7) * 43758.5453) % 1) + 1) % 1;
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, world.sky[0]);
    grd.addColorStop(1, world.sky[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // far: faint schema grid
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = world.accent;
    ctx.beginPath();
    for (let x = -((camX * 0.15) % 48); x < VIEW_W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); }
    for (let y = -((camY * 0.15) % 48); y < VIEW_H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); }
    ctx.stroke();
    ctx.restore();

    // far: drifting data motes (denser in later levels of a world)
    ctx.save();
    const moteN = 22 + this.bgVariant * 7;
    for (let i = 0; i < moteN; i++) {
      const span = VIEW_W + 20;
      let x = ((i * 97 + 31 - camX * 0.1 + F * (0.08 + rnd(i) * 0.1)) % span + span) % span - 10;
      const y = ((i * 53 + rnd(i, 1) * 200 - F * 0.06 * (1 + rnd(i, 2)) - camY * 0.1) % VIEW_H + VIEW_H) % VIEW_H;
      ctx.globalAlpha = 0.08 + rnd(i, 3) * 0.1;
      ctx.fillStyle = i % 5 ? world.accent : '#ffffff';
      ctx.fillRect(x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2);
    }
    ctx.restore();

    if (this.isVertical) {
      // shaft: full-height server-tower columns at both edges
      ctx.save();
      for (const [edge, dir] of [[14, 1], [VIEW_W - 48, -1]]) {
        const sx = edge + dir * ((camX * 0.2) % 20);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#0b0e13';
        ctx.fillRect(sx, 0, 34, VIEW_H);
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = world.accent;
        ctx.strokeRect(sx + 0.5, -2, 33, VIEW_H + 4);
        // repeating LED panels scrolling with the climb
        const off = ((camY * 0.3) % 56 + 56) % 56;
        for (let py = -off; py < VIEW_H; py += 56) {
          ctx.globalAlpha = 0.12;
          ctx.strokeRect(sx + 4.5, py + 4.5, 25, 47);
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 4; c++) {
              const id = r * 4 + c + py;
              const on = ((F >> 4) + id) % 5 !== 0;
              ctx.globalAlpha = on ? 0.5 : 0.1;
              ctx.fillStyle = rnd(id, 4) > 0.85 ? '#ef4444' : rnd(id, 5) > 0.5 ? '#10b981' : world.accent;
              ctx.fillRect(sx + 7 + c * 6, py + 8 + r * 8, 2, 2);
            }
          }
        }
      }
      ctx.restore();
      // vertical riser cables with rising data pulses
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const x = 90 + i * 130 - ((camX * 0.25) % 30);
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = world.accent;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); ctx.stroke();
        const py = VIEW_H - ((F * (1.2 + i * 0.4) + i * 173) % (VIEW_H + 40)) + 20;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, py, 2, 5);
      }
      ctx.restore();
    } else {
      // mid-far: server rack skyline (parallax .3)
      ctx.save();
      const slotW = 150;
      const first = Math.floor((camX * 0.3 - slotW) / slotW);
      for (let k = first; k * slotW < camX * 0.3 + VIEW_W + slotW; k++) {
        if (rnd(k, 9) < 0.25) continue; // gaps in the skyline
        const sx = k * slotW + rnd(k) * 70 - camX * 0.3;
        const rh = 70 + rnd(k, 1) * 80;
        const rw = 30 + rnd(k, 2) * 12;
        const base = VIEW_H - 18 - camY * 0.25;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#0b0e13';
        ctx.fillRect(sx, base - rh, rw, rh);
        ctx.globalAlpha = 0.14;
        ctx.strokeStyle = world.accent;
        ctx.strokeRect(sx + 0.5, base - rh + 0.5, rw - 1, rh - 1);
        // antenna on some racks
        if (rnd(k, 8) > 0.7) {
          ctx.globalAlpha = 0.25;
          ctx.fillRect(sx + rw / 2, base - rh - 9, 1, 9);
          ctx.globalAlpha = (F >> 4) % 2 ? 0.6 : 0.15;
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(sx + rw / 2 - 1, base - rh - 11, 3, 2);
        }
        // blinking LED rows
        for (let r = 0; r < Math.floor(rh / 12) - 1; r++) {
          for (let c = 0; c < 3; c++) {
            const id = k * 31 + r * 3 + c;
            const on = ((F >> 4) + id) % 6 !== 0;
            ctx.globalAlpha = on ? 0.4 : 0.08;
            ctx.fillStyle = rnd(id, 6) > 0.88 ? '#f59e0b' : rnd(id, 7) > 0.45 ? '#10b981' : world.accent;
            ctx.fillRect(sx + 5 + c * 7, base - rh + 8 + r * 12, 2, 2);
          }
        }
      }
      ctx.restore();
      // overhead data conduits with traveling pulses
      ctx.save();
      ctx.strokeStyle = world.accent;
      const segW = 170;
      const cOff = -((camX * 0.2) % segW);
      for (let x = cOff - segW; x < VIEW_W + segW; x += segW) {
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.quadraticCurveTo(x + segW / 2, 22, x + segW, 4);
        ctx.stroke();
        const t = ((F * 1.6 + x * 0.7) % segW + segW) % segW / segW;
        const px = x + t * segW;
        const py = 4 + 18 * 4 * t * (1 - t) * 0.5 + 18 * t * (1 - t);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px, py, 3, 2);
      }
      ctx.restore();
    }

    // mid: floating table cards
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 7; i++) {
      const cw = 54, chh = 34;
      const spanW = this.W * T * 0.45 + VIEW_W;
      let x = ((i * 173 + 60) - camX * 0.45) % spanW;
      if (x < -cw) x += spanW;
      const y = ((28 + (i * 67) % 130 - camY * 0.4) % (VIEW_H - 40) + (VIEW_H - 40)) % (VIEW_H - 40) + Math.sin((F + i * 40) / 90) * 3;
      ctx.strokeStyle = world.accent;
      ctx.fillStyle = world.accent;
      ctx.strokeRect(x, y, cw, chh);
      ctx.fillRect(x, y, cw, 7);
      ctx.globalAlpha = 0.05;
      for (let r = 1; r < 4; r++) ctx.fillRect(x + 3, y + 7 + r * 6, cw - 6, 2);
      ctx.globalAlpha = 0.1;
    }
    ctx.restore();

    // near-mid: patrol drones (little background robots)
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const span = VIEW_W + 60;
      const dir = i % 2 ? 1 : -1;
      let x = ((i * 210 + 40 + dir * F * (0.2 + i * 0.07) - camX * 0.55) % span + span) % span - 30;
      const y = ((36 + i * 52 - camY * 0.5) % 170 + 170) % 170 + Math.sin(F / 50 + i * 2) * 5;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#1d2430';
      ctx.fillRect(x, y, 10, 5);                      // body
      ctx.fillRect(x + 2, y - 2, 6, 2);               // head
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = world.accent;
      ctx.fillRect(x - 3, y + 1, 3, 1);               // side rotors
      ctx.fillRect(x + 10, y + 1, 3, 1);
      ctx.globalAlpha = (F >> 3) % 3 === i % 3 ? 0.8 : 0.3;
      ctx.fillStyle = i % 2 ? '#ef4444' : '#22d3ee';  // blinking eye
      ctx.fillRect(x + (dir > 0 ? 7 : 1), y - 1, 2, 2);
      // scanning beam, occasionally
      if (((F >> 6) + i) % 4 === 0) {
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = i % 2 ? '#ef4444' : '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x - 4, y + 26);
        ctx.lineTo(x + 14, y + 26);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    this.drawBgMotif(ctx, world, camX, F, rnd);
  }

  // A distinct, low-alpha ambient layer per level so each one reads
  // differently while keeping the world's identity.
  drawBgMotif(ctx, world, camX, F, rnd) {
    ctx.save();
    if (this.bgVariant === 1) {
      // binary rain: faint columns of scrolling 0/1 digits
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      for (let i = 0; i < 18; i++) {
        const x = ((i * 71 - camX * 0.35) % VIEW_W + VIEW_W) % VIEW_W;
        const head = F * (0.6 + (i % 3) * 0.25) + i * 60;
        for (let j = 0; j < 7; j++) {
          const y = ((head + j * 16) % (VIEW_H + 40)) - 20;
          ctx.globalAlpha = 0.04 + 0.035 * ((i + j) % 3);
          ctx.fillStyle = world.accent;
          ctx.fillText(((i * 7 + j * 13 + (F >> 5)) % 2) ? '1' : '0', x, y);
        }
      }
    } else if (this.bgVariant === 2) {
      // query-graph constellation: faint nodes wired to near neighbours
      const N = 8, pts = [];
      for (let i = 0; i < N; i++) {
        const span = VIEW_W + 80;
        const x = ((i * 137 + 40 - camX * 0.3) % span + span) % span - 40;
        const y = 26 + (i * 53) % (VIEW_H - 56) + Math.sin((F + i * 37) / 80) * 4;
        pts.push([x, y]);
      }
      ctx.strokeStyle = world.accent;
      ctx.fillStyle = world.accent;
      ctx.globalAlpha = 0.09;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
          if (dx * dx + dy * dy < 130 * 130) {
            ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 0.22;
      for (const [x, y] of pts) ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    ctx.restore();
  }

  drawTiles(ctx, world, camX, camY) {
    const S = this.app.sprites;
    const tset = S.tiles[this.worldIdx];
    const x0 = Math.max(0, Math.floor(camX / T));
    const x1 = Math.min(this.W - 1, Math.floor((camX + VIEW_W) / T) + 1);
    const y0 = Math.max(0, Math.floor(camY / T));
    const y1 = Math.min(this.H - 1, Math.floor((camY + VIEW_H) / T) + 1);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.map[ty][tx];
        if (ch === ' ') continue;
        const px = tx * T, py = ty * T;
        let bumpOff = 0;
        for (const b of this.bumps) {
          if (b.tx === tx && b.ty === ty) bumpOff = -Math.sin((b.t / 10) * Math.PI) * 4;
        }
        switch (ch) {
          case '#': ctx.drawImage(tset.ground, px, py); break;
          case 'B': ctx.drawImage(tset.brick, px, py + bumpOff); break;
          case 'b': ctx.drawImage(S.usedBlock, px, py + bumpOff); break;
          case '?': case 'I': case 'M': case 'R': {
            const pulse = Math.sin(this.frame / 14) > 0 ? 0 : 0;
            ctx.drawImage(S.qblock, px, py + bumpOff + pulse);
            break;
          }
          case '=': ctx.drawImage(tset.platform, px, py); break;
          case 'H': ctx.drawImage(tset.cable, px, py); break;
          case '^': ctx.drawImage(S.spike, px, py); break;
          case 'T': ctx.drawImage(S.tunnelTop, px, py); break;
          case '|': ctx.drawImage(S.tunnelBody, px, py); break;
          case 'o': {
            const sc = Math.abs(Math.cos(this.frame / 9 + tx * 0.7));
            const w = Math.max(2, 12 * sc);
            ctx.drawImage(S.coin, px + 8 - w / 2, py + 2, w, 12);
            break;
          }
          case 'K': ctx.drawImage(S.checkpoint, px, py); break;
          case '%': ctx.drawImage(S.checkpointOn, px, py); break;
          case 'F': this.drawFlag(ctx, px, py); break;
        }
      }
    }
  }

  drawFlag(ctx, px, py) {
    const active = !this.isBossLevel || this.bossDead;
    ctx.save();
    if (!active) ctx.globalAlpha = 0.3;
    // base + pole
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 4, py + 12, 8, 4);
    ctx.fillRect(px + 7, py - 32, 2, 44);
    // flag
    const wave = Math.sin(this.frame / 12) * 1.5;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(px + 9, py - 32);
    ctx.lineTo(px + 26 + wave, py - 27);
    ctx.lineTo(px + 9, py - 21);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#022c22';
    ctx.font = 'bold 6px monospace';
    ctx.fillText('OK', px + 11, py - 24);
    ctx.restore();
  }

  drawBossBar(ctx) {
    const b = this.boss;
    const w = 120;
    const x = (VIEW_W - w) / 2, y = 16;
    ctx.fillStyle = 'rgba(8,9,10,0.8)';
    ctx.fillRect(x - 4, y - 10, w + 8, 22);
    ctx.strokeStyle = '#1f2937';
    ctx.strokeRect(x - 4.5, y - 10.5, w + 9, 23);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, VIEW_W / 2, y - 2);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x, y + 2, w, 6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x, y + 2, w * Math.max(0, b.hp / b.maxHp), 6);
    // how-to hint for the first seconds of the fight
    if (this.frame < 480 && this.frame % 60 < 40) {
      ctx.fillStyle = '#fde047';
      ctx.fillText(`¡sáltale la cabeza ×${b.maxHp} para liberar el bloqueo!`, VIEW_W / 2, y + 18);
    }
  }
}
