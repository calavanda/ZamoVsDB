// Game entities. Every entity has x,y,w,h (hitbox), update(g) and draw(g,ctx)
// where g is the Game instance.

import { GRAVITY, MAX_FALL, PLAYER, TILE, WORLDS } from './constants.js';

const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function drawSprite(ctx, img, x, y, flip = false) {
  x = Math.round(x); y = Math.round(y);
  if (flip) {
    ctx.save();
    ctx.translate(x + img.width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y);
  }
}

// ---------------------------------------------------------------- Player ---
export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = PLAYER.W; this.h = PLAYER.H;
    this.vx = 0; this.vy = 0;
    this.face = 1;
    this.onGround = false;
    this.coyote = 0; this.jbuf = 0;
    this.big = false;
    this.hasIndex = false; this.hasMCP = false;
    this.inv = 0; this.shootCd = 0;
    this.dead = false; this.deadT = 0;
    this.anim = 0;
    this.squash = 0;
    this.climbing = false; // riding a data cable
    this.frozen = false; // warps / level clear
  }

  update(g) {
    if (this.dead) {
      this.deadT++;
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
      this.y += this.vy;
      return;
    }
    if (this.frozen) return;
    const inp = g.app.input;
    const maxSpd = this.hasIndex ? PLAYER.MAX_INDEX : PLAYER.MAX_WALK;
    const acc = this.onGround ? PLAYER.ACCEL : PLAYER.AIR_ACCEL;
    if (inp.held.left) { this.vx = Math.max(this.vx - acc, -maxSpd); this.face = -1; }
    else if (inp.held.right) { this.vx = Math.min(this.vx + acc, maxSpd); this.face = 1; }
    else if (this.onGround) { this.vx *= PLAYER.FRICTION; if (Math.abs(this.vx) < 0.05) this.vx = 0; }

    // climbing data cables: grab on with Up/Down, ride with held Up/Down.
    // ArrowUp also emits "jump", so only a dedicated jump key leaps off.
    const onCable = g.climbAt(this);
    if (!onCable) this.climbing = false;
    else if (inp.pressed.up || inp.pressed.down) this.climbing = true;
    if (this.climbing && inp.pressed.jump && !inp.pressed.up) {
      this.climbing = false;
      this.vy = PLAYER.JUMP_V * 0.72;
      this.coyote = 0; this.jbuf = 0;
      g.app.audio.jump();
    }

    if (!this.climbing) {
      if (inp.pressed.jump) this.jbuf = PLAYER.JBUF;
      if (this.jbuf > 0 && this.coyote > 0) {
        this.vy = this.hasIndex ? PLAYER.JUMP_V_INDEX : PLAYER.JUMP_V;
        this.coyote = 0; this.jbuf = 0;
        g.app.audio.jump();
      }
      if (this.jbuf > 0) this.jbuf--;
      if (!inp.held.jump && this.vy < -2.4) this.vy = -2.4;
    }

    const vyBefore = this.vy;
    const wasGround = this.onGround;
    if (this.climbing) {
      const cs = PLAYER.CLIMB_SPD;
      this.vy = (inp.held.down ? cs : 0) - (inp.held.up ? cs : 0);
      if (!inp.held.left && !inp.held.right) {
        this.vx = 0; // settle onto the cable's column
        const cc = (Math.floor((this.x + this.w / 2) / TILE) + 0.5) * TILE - (this.x + this.w / 2);
        if (Math.abs(cc) > 0.4) this.x += Math.sign(cc) * Math.min(0.8, Math.abs(cc));
      }
      this.anim += 3;
    } else {
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    }
    g.moveEntity(this, true);
    this.coyote = this.climbing ? 0 : (this.onGround ? PLAYER.COYOTE : Math.max(0, this.coyote - 1));

    // game feel: landing squash + dust, run dust
    if (!wasGround && this.onGround && vyBefore > 3.4) {
      this.squash = 8;
      g.dust(this.x + this.w / 2, this.y + this.h, 4);
    }
    if (this.squash > 0) this.squash--;
    if (this.onGround && Math.abs(this.vx) > 1.2 && g.frame % 9 === 0) {
      g.dust(this.x + this.w / 2 - this.face * 6, this.y + this.h, 1);
    }

    if (this.shootCd > 0) this.shootCd--;
    if (this.hasMCP && inp.pressed.fire && this.shootCd === 0 && g.bolts.length < 2) {
      g.bolts.push(new Bolt(this.x + this.w / 2, this.y + 4, this.face));
      this.shootCd = 16;
      g.app.audio.shoot();
    }
    if (this.inv > 0) this.inv--;
    this.anim += Math.abs(this.vx) * 0.6;
  }

  grow(g) {
    if (this.big) return false;
    this.big = true;
    this.y -= 2; this.h = 15;
    return true;
  }

  shrink() {
    if (!this.big) return;
    this.big = false;
    this.y += 2; this.h = PLAYER.H;
  }

  hurt(g) {
    if (this.inv > 0 || this.dead || this.frozen) return;
    if (this.hasMCP) {
      this.hasMCP = false; this.inv = PLAYER.INVULN;
      g.app.audio.hurt();
      g.floatText(this.x, this.y - 12, 'MCP DESCONECTADO', '#a78bfa');
    } else if (this.hasIndex) {
      this.hasIndex = false; this.inv = PLAYER.INVULN;
      g.app.audio.hurt();
      g.floatText(this.x, this.y - 12, 'ÍNDICE PERDIDO', '#fde047');
    } else if (this.big) {
      this.shrink();
      this.inv = PLAYER.INVULN;
      g.app.audio.hurt();
      g.floatText(this.x, this.y - 12, 'REDUCIENDO…', '#34d399');
    } else {
      this.die(g);
    }
  }

  die(g) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0;
    this.vy = -6; this.vx = 0;
    g.app.audio.die();
    g.floatText(this.x, this.y - 14, 'ROLLBACK…', '#ef4444');
    g.app.onPlayerDead();
  }

  draw(g, ctx) {
    if (this.inv > 0 && this.inv % 6 < 3 && !this.dead) return;
    const S = g.app.sprites.player;
    let img = S.idle;
    if (this.climbing) img = Math.floor(this.anim / 6) % 2 ? S.run1 : S.run2;
    else if (!this.onGround) img = S.jump;
    else if (Math.abs(this.vx) > 0.3) img = Math.floor(this.anim / 4) % 2 ? S.run1 : S.run2;
    const dx = this.x + this.w / 2 - 8;
    const dy = this.y + this.h - 14;
    if (this.hasIndex) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(g.frame / 6) * 0.1;
      ctx.fillStyle = '#fde047';
      ctx.fillRect(Math.round(dx) - 1, Math.round(dy), 18, 14);
      ctx.restore();
    }
    // squash on landing, stretch while rising; bigger when scaled up
    const base = this.big ? 1.3 : 1;
    let sx = base, sy = base;
    if (this.squash > 0) { const k = this.squash / 8; sx = base * (1 + 0.3 * k); sy = base * (1 - 0.35 * k); }
    else if (!this.onGround && this.vy < -2.5) { sx = base * 0.85; sy = base * 1.12; }
    ctx.save();
    ctx.translate(Math.round(this.x + this.w / 2), Math.round(this.y + this.h));
    ctx.scale(this.face < 0 ? -sx : sx, sy);
    ctx.drawImage(img, -8, -14);
    ctx.restore();
    if (this.hasMCP) {
      const a = g.frame / 9;
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(Math.round(dx + 8 + Math.cos(a) * 12), Math.round(dy + 6 + Math.sin(a) * 8), 2, 2);
    }
  }
}

// --------------------------------------------------------------- enemies ---
class Enemy {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.dead = false; this.removed = false;
    this.active = false;
    this.hitWall = false;
    this.t = 0;
    this.stompable = true;
    this.onGround = false;
  }
  get cx() { return this.x + this.w / 2; }
  hits(p) { return !this.dead && overlap(this, p); }
}

export class Blob extends Enemy {
  constructor(tx, ty) {
    super(tx * TILE + 1, ty * TILE + 4, 14, 12);
    this.dir = -1; this.speed = 0.42;
    this.squashT = 0;
  }
  update(g) {
    this.t++;
    if (this.dead) { if (++this.squashT > 28) this.removed = true; return; }
    this.vx = this.dir * this.speed;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    this.hitWall = false;
    g.moveEntity(this);
    if (this.hitWall) this.dir *= -1;
    // turn at ledges
    if (this.onGround) {
      const ahead = Math.floor((this.cx + this.dir * 10) / TILE);
      const below = Math.floor((this.y + this.h + 2) / TILE);
      if (!g.solidAt(ahead, below) && g.tileAt(ahead, below) !== '=') this.dir *= -1;
    }
  }
  stomp(g) { this.dead = true; g.app.addScore(100); }
  draw(g, ctx) {
    const S = g.app.sprites.blob;
    if (this.dead) {
      ctx.save(); ctx.globalAlpha = 1 - this.squashT / 28;
      ctx.drawImage(S[1], Math.round(this.x - 1), Math.round(this.y + 4), 16, 8);
      ctx.restore();
      return;
    }
    drawSprite(ctx, S[Math.floor(this.t / 14) % 2], this.x - 1, this.y - 4 + (this.h - 12));
  }
}

export class Snail extends Enemy {
  constructor(tx, ty) {
    super(tx * TILE + 1, ty * TILE + 4, 14, 12);
    this.dir = -1; this.speed = 0.22;
    this.hp = 2; this.flash = 0;
    this.squashT = 0;
  }
  update(g) {
    this.t++;
    if (this.dead) { if (++this.squashT > 28) this.removed = true; return; }
    if (this.flash > 0) this.flash--;
    this.vx = this.dir * (this.hp === 1 ? this.speed * 2.4 : this.speed);
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    this.hitWall = false;
    g.moveEntity(this);
    if (this.hitWall) this.dir *= -1;
    if (this.onGround) {
      const ahead = Math.floor((this.cx + this.dir * 10) / TILE);
      const below = Math.floor((this.y + this.h + 2) / TILE);
      if (!g.solidAt(ahead, below) && g.tileAt(ahead, below) !== '=') this.dir *= -1;
    }
  }
  stomp(g) {
    this.hp--;
    if (this.hp <= 0) { this.dead = true; g.app.addScore(200); }
    else { this.flash = 30; g.app.addScore(50); }
  }
  draw(g, ctx) {
    const S = g.app.sprites.snail;
    if (this.dead) {
      ctx.save(); ctx.globalAlpha = 1 - this.squashT / 28;
      ctx.drawImage(S[0], Math.round(this.x - 1), Math.round(this.y + 4), 16, 8);
      ctx.restore();
      return;
    }
    if (this.flash > 0 && this.flash % 6 < 3) return;
    drawSprite(ctx, S[Math.floor(this.t / 18) % 2], this.x - 1, this.y - 4 + (this.h - 12), this.dir > 0);
  }
}

export class Wisp extends Enemy {
  constructor(tx, ty) {
    super(tx * TILE + 2, ty * TILE + 2, 12, 11);
    this.x0 = this.x; this.y0 = this.y;
  }
  update(g) {
    this.t++;
    if (this.dead) { if (++this.t2 > 20) this.removed = true; return; }
    this.x = this.x0 + Math.sin(this.t * 0.018) * 38;
    this.y = this.y0 + Math.sin(this.t * 0.05) * 9;
  }
  stomp(g) { this.dead = true; this.t2 = 0; g.app.addScore(150); }
  draw(g, ctx) {
    if (this.dead) { ctx.globalAlpha = 1 - this.t2 / 20; }
    const S = g.app.sprites.wisp;
    const flip = Math.cos(this.t * 0.018) > 0;
    ctx.save();
    ctx.globalAlpha *= 0.85 + Math.sin(this.t / 9) * 0.15;
    drawSprite(ctx, S[Math.floor(this.t / 12) % 2], this.x - 2, this.y - 3, flip);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// Vertical patrol flyer — guards pits and shafts.
export class Drone extends Enemy {
  constructor(tx, ty) {
    super(tx * TILE + 2, ty * TILE + 2, 12, 11);
    this.y0 = this.y;
  }
  update(g) {
    this.t++;
    if (this.dead) { if (++this.t2 > 20) this.removed = true; return; }
    this.y = this.y0 + Math.sin(this.t * 0.03) * 32;
  }
  stomp(g) { this.dead = true; this.t2 = 0; g.app.addScore(150); }
  draw(g, ctx) {
    if (this.dead) ctx.globalAlpha = 1 - this.t2 / 20;
    drawSprite(ctx, g.app.sprites.drone[Math.floor(this.t / 6) % 2], this.x - 2, this.y - 3);
    ctx.globalAlpha = 1;
  }
}

// Swooping flyer — hovers, then dives at the player passing below.
export class Daemon extends Enemy {
  constructor(tx, ty) {
    super(tx * TILE + 2, ty * TILE + 2, 12, 12);
    this.x0 = this.x; this.y0 = this.y;
    this.state = 'hover';
    this.cd = 0;
  }
  update(g) {
    this.t++;
    if (this.dead) { if (++this.t2 > 20) this.removed = true; return; }
    const p = g.player;
    if (this.state === 'hover') {
      this.y = this.y0 + Math.sin(this.t * 0.06) * 4;
      if (this.cd > 0) this.cd--;
      else if (!p.dead && Math.abs(p.x - this.x) < 70 && p.y > this.y + 20) {
        const dx = p.x - this.x, dy = p.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        this.vx = (dx / len) * 2; this.vy = (dy / len) * 2;
        this.targetY = p.y;
        this.state = 'dive';
      }
    } else if (this.state === 'dive') {
      this.x += this.vx; this.y += this.vy;
      const bx = Math.floor((this.x + 6) / TILE);
      const by = Math.floor((this.y + this.h + 2) / TILE);
      if (this.y >= this.targetY || g.solidAt(bx, by)) this.state = 'return';
    } else { // return to roost
      const dx = this.x0 - this.x, dy = this.y0 - this.y;
      const len = Math.hypot(dx, dy);
      if (len < 2) { this.x = this.x0; this.y = this.y0; this.state = 'hover'; this.cd = 130; }
      else { this.x += (dx / len) * 0.9; this.y += (dy / len) * 0.9; }
    }
  }
  stomp(g) { this.dead = true; this.t2 = 0; g.app.addScore(200); }
  draw(g, ctx) {
    if (this.dead) ctx.globalAlpha = 1 - this.t2 / 20;
    const fast = this.state === 'dive' ? 4 : 9;
    drawSprite(ctx, g.app.sprites.daemon[Math.floor(this.t / fast) % 2], this.x - 2, this.y - 2, this.vx > 0 && this.state === 'dive');
    ctx.globalAlpha = 1;
  }
}

// Timed lock gate: solid + harmful while closed, harmless while open.
export class LockGate extends Enemy {
  constructor(tx, ty) {
    super(tx * TILE + 2, ty * TILE + 1, 12, 15);
    this.tx = tx; this.ty = ty;
    this.stompable = false;
    this.cycle = 130 + (tx % 3) * 25;
    this.t = (tx * 37) % this.cycle;
    this.active = true;
  }
  get closed() { return (this.t % (this.cycle * 2)) < this.cycle; }
  update() { this.t++; }
  draw(g, ctx) {
    const S = g.app.sprites;
    const img = this.closed ? S.lockClosed : S.lockOpen;
    ctx.save();
    if (!this.closed) ctx.globalAlpha = 0.55;
    // warn flash right before closing
    const phase = this.t % (this.cycle * 2);
    if (!this.closed && phase > this.cycle * 2 - 30 && g.frame % 8 < 4) ctx.globalAlpha = 0.9;
    drawSprite(ctx, img, this.tx * TILE, this.ty * TILE);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ boss ---
export class Boss extends Enemy {
  constructor(tx, ty, worldIdx) {
    super(tx * TILE, ty * TILE - 16, 28, 28);
    const spec = WORLDS[worldIdx].boss;
    this.name = spec.name;
    this.color = spec.color;
    this.maxHp = spec.hp;
    this.hp = spec.hp;
    this.worldIdx = worldIdx;
    this.dir = -1;
    this.stun = 0;
    this.jumpT = 110;
    this.atkT = 120;  // frames to the next special attack
    this.tele = 0;    // telegraph windup remaining before it fires
    this.stompable = true;
  }
  update(g) {
    this.t++;
    if (this.dead) { this.removed = this.t2++ > 40; return; }
    if (!this.active) return;
    if (this.stun > 0) {
      this.stun--;
      this.vx = 0;
    } else if (this.tele > 0) {
      // winding up: hold position, flash, then commit the attack
      this.vx = 0;
      if (--this.tele <= 0) this.fireAttack(g);
    } else {
      const p = g.player;
      this.dir = p.x + p.w / 2 < this.cx ? -1 : 1;
      const rage = (this.maxHp - this.hp) * 0.13;
      this.vx = this.dir * (0.32 + rage + this.worldIdx * 0.08);
      if (--this.jumpT <= 0 && this.onGround) {
        this.vy = -5.4;
        this.jumpT = 150 - this.worldIdx * 25 - (this.maxHp - this.hp) * 12;
      }
      if (--this.atkT <= 0 && this.onGround) this.beginAttack(g);
    }
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    this.hitWall = false;
    g.moveEntity(this);
    if (this.hitWall) this.dir *= -1;
  }
  // Telegraph the signature attack: stand, name it, then fireAttack() commits.
  beginAttack(g) {
    this.tele = 46;
    this.vx = 0;
    g.floatText(this.cx, this.y - 12,
      ['BLOQUEANDO TABLA', 'PICO DE LAG', 'DEADLOCK'][this.worldIdx], '#fde047');
    g.app.audio.bump();
  }
  fireAttack(g) {
    const rage = this.maxHp - this.hp;
    const pcx = g.player.x + g.player.w / 2;
    if (this.worldIdx === 0) {
      // TABLE LOCK — slam the floor; twin shockwaves you must jump
      this.vy = -3;
      g.shake = Math.max(g.shake, 9);
      g.app.audio.bosshit();
      const fy = this.y + this.h - 11;
      g.orbs.push(new Shockwave(this.x - 12, fy, -1, this.color));
      g.orbs.push(new Shockwave(this.x + this.w, fy, 1, this.color));
    } else if (this.worldIdx === 1) {
      // REPLICATION LAG — blink across the arena, then an aimed orb
      g.spark(this.cx, this.y + this.h / 2, '#a78bfa', 10);
      const mid = g.W * TILE / 2;
      const minX = 2 * TILE, maxX = (g.W - 2) * TILE - this.w;
      this.x = this.cx < mid ? Math.min(maxX, mid + 50) : Math.max(minX, mid - 50 - this.w);
      g.spark(this.cx, this.y + this.h / 2, '#a78bfa', 10);
      g.app.audio.warp();
      g.orbs.push(new Orb(this.cx, this.y + 6, Math.sign(pcx - this.cx) * 1.6, -3));
    } else {
      // THE DEADLOCK — fast 3-way orb barrage toward the player
      g.app.audio.bump();
      const s = Math.sign(pcx - this.cx) || 1;
      g.orbs.push(new Orb(this.cx, this.y + 6, s * 0.2, -4.6));
      g.orbs.push(new Orb(this.cx, this.y + 6, s * 1.1, -4.0));
      g.orbs.push(new Orb(this.cx, this.y + 6, s * 2.2, -2.6));
    }
    // next attack comes sooner the angrier it gets / the later the world
    this.atkT = Math.max(70, 190 - this.worldIdx * 30 - rage * 14);
  }
  damage(g, n) {
    if (this.dead) return;
    this.hp -= n;
    if (this.hp <= 0) {
      this.dead = true; this.t2 = 0;
      g.app.audio.explode();
      g.app.addScore(1000);
      g.explosion(this.cx, this.y + this.h / 2, this.color === 'red' ? '#ef4444' : this.color === 'violet' ? '#a78bfa' : '#f59e0b');
      g.onBossDead();
    }
  }
  stomp(g) {
    if (this.stun > 0) return;
    this.stun = 50;
    g.app.audio.bosshit();
    g.shake = 14;
    this.damage(g, 1);
  }
  draw(g, ctx) {
    if (this.dead) {
      if (this.t2 % 6 < 3) return;
      ctx.save(); ctx.globalAlpha = 1 - this.t2 / 40;
    }
    if (this.stun > 0 && this.stun % 6 < 3) { if (this.dead) ctx.restore(); return; }
    // telegraph: expanding warning halo + flicker while winding up an attack
    if (this.tele > 0) {
      const k = 1 - this.tele / 46;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(this.tele / 3));
      ctx.strokeStyle = '#fde047';
      ctx.strokeRect(
        Math.round(this.x - 3 - k * 4), Math.round(this.y - 3 - k * 4),
        this.w + 6 + k * 8, this.h + 6 + k * 8,
      );
      ctx.restore();
    }
    const img = g.app.sprites.boss[this.color];
    const sq = this.stun > 0 ? 0.85 : 1;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(this.cx), Math.round(this.y + this.h));
    ctx.scale((this.dir < 0 ? 1 : -1) * 2, 2 * sq);
    ctx.drawImage(img, -8, -16);
    ctx.restore();
    if (this.dead) ctx.restore();
  }
}

// ----------------------------------------------------------- projectiles ---
export class Bolt {
  constructor(x, y, dir) {
    this.x = x; this.y = y; this.w = 10; this.h = 5;
    this.dir = dir; this.t = 0; this.removed = false;
  }
  update(g) {
    this.t++;
    this.x += this.dir * 4.4;
    this.y += Math.sin(this.t / 3) * 0.6;
    const tx = Math.floor((this.x + (this.dir > 0 ? this.w : 0)) / TILE);
    const ty = Math.floor((this.y + this.h / 2) / TILE);
    if (this.t > 80 || g.solidAt(tx, ty)) {
      this.removed = true;
      g.spark(this.x + this.w / 2, this.y, '#22d3ee', 4);
    }
  }
  draw(g, ctx) {
    drawSprite(ctx, g.app.sprites.bolt, this.x, this.y, this.dir < 0);
  }
}

export class Orb {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y; this.w = 8; this.h = 7;
    this.vx = vx; this.vy = vy;
    this.removed = false; this.t = 0;
  }
  update(g) {
    this.t++;
    this.vy = Math.min(this.vy + GRAVITY * 0.5, 5);
    this.x += this.vx; this.y += this.vy;
    const tx = Math.floor((this.x + this.w / 2) / TILE);
    const ty = Math.floor((this.y + this.h) / TILE);
    if (g.solidAt(tx, ty) || this.t > 240) {
      this.removed = true;
      g.spark(this.x + 4, this.y + 4, '#ef4444', 5);
    }
  }
  draw(g, ctx) {
    drawSprite(ctx, g.app.sprites.orb, this.x, this.y + Math.sin(this.t / 4));
  }
}

// Ground shockwave from a boss slam — rides along the floor; jump it.
export class Shockwave {
  constructor(x, y, dir, color = '#f59e0b') {
    this.x = x; this.y = y; this.w = 12; this.h = 11;
    this.dir = dir; this.color = color;
    this.t = 0; this.removed = false;
  }
  update(g) {
    this.t++;
    this.x += this.dir * 3.1;
    const lead = Math.floor((this.x + (this.dir > 0 ? this.w : 0)) / TILE);
    const ty = Math.floor((this.y + this.h - 2) / TILE);
    if (this.t > 110 || g.solidAt(lead, ty) || this.x < TILE || this.x > (g.W - 1) * TILE) {
      this.removed = true;
      g.spark(this.x + this.w / 2, this.y + this.h, this.color, 4);
    } else if (g.frame % 4 === 0) {
      g.spark(this.x + this.w / 2, this.y + this.h, this.color, 1);
    }
  }
  draw(g, ctx) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * Math.abs(Math.sin(this.t / 3));
    ctx.fillStyle = this.color;
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillRect(x, y + 5, this.w, this.h - 5);                       // base
    ctx.fillRect(x + (this.dir > 0 ? this.w - 4 : 0), y + 1, 4, this.h - 1); // crest
    ctx.restore();
  }
}

// ----------------------------------------------------------------- items ---
function grantPower(g, x, y, kind) {
  g.app.audio.powerup();
  if (kind === 'index') {
    g.player.hasIndex = true;
    g.floatText(x, y - 10, 'ÍNDICE! consultas más rápidas', '#fde047');
  } else if (kind === 'scale') {
    if (g.player.grow(g)) g.floatText(x, y - 10, '¡ESCALADO VERTICAL! servidor mejorado', '#34d399');
    else g.floatText(x, y - 10, 'capacidad al máximo +500', '#34d399');
  } else {
    g.player.hasMCP = true;
    g.floatText(x, y - 10, 'AGENTE MCP EN LÍNEA — presiona X', '#a78bfa');
  }
  g.app.addScore(500);
}

export class ItemPickup {
  constructor(tx, ty, kind) {
    this.x = tx * TILE; this.y = ty * TILE;
    this.w = 14; this.h = 14;
    this.kind = kind; // 'index' | 'scale' | 'mcp'
    this.t = 0; this.removed = false;
    this.riseFrom = this.y + 14;
  }
  update(g) {
    this.t++;
    if (overlap(this, g.player) && this.t > 12 && !g.player.dead) {
      this.removed = true;
      grantPower(g, this.x, this.y, this.kind);
    }
  }
  draw(g, ctx) {
    const rise = Math.min(1, this.t / 18);
    const y = this.riseFrom + (this.y - this.riseFrom) * rise + (rise === 1 ? Math.sin(this.t / 12) * 2 : 0);
    const img = { index: g.app.sprites.indexItem, scale: g.app.sprites.scaleItem, mcp: g.app.sprites.mcpItem }[this.kind];
    drawSprite(ctx, img, this.x + 1, y);
  }
}

// Boss-arena care package: a power-up parachuting down from the ceiling.
// Drifts slowly, lands on the first solid tile, despawns if ignored too long.
export class SkyDrop {
  constructor(tx, kind) {
    this.x = tx * TILE + 1; this.y = -16;
    this.w = 14; this.h = 14;
    this.kind = kind;
    this.t = 0; this.removed = false;
    this.landed = false;
  }
  update(g) {
    this.t++;
    if (!this.landed) {
      this.y += 1.1;
      const ty = Math.floor((this.y + this.h) / TILE);
      const tx0 = Math.floor(this.x / TILE), tx1 = Math.floor((this.x + this.w - 1) / TILE);
      if (g.solidAt(tx0, ty) || g.solidAt(tx1, ty)) {
        this.landed = true;
        this.y = ty * TILE - this.h;
        g.dust(this.x + this.w / 2, this.y + this.h, 2);
      }
      if (this.y > g.H * TILE + 20) this.removed = true; // drifted into a pit
    } else if (this.t > 1200) {
      this.removed = true;
    }
    if (!g.player.dead && overlap(this, g.player)) {
      this.removed = true;
      grantPower(g, this.x, this.y, this.kind);
    }
  }
  draw(g, ctx) {
    if (this.landed && this.t > 1050 && this.t % 8 < 4) return; // about to despawn
    const img = { index: g.app.sprites.indexItem, scale: g.app.sprites.scaleItem, mcp: g.app.sprites.mcpItem }[this.kind];
    const sway = this.landed ? 0 : Math.sin(this.t / 16) * 2;
    drawSprite(ctx, img, this.x + 1 + sway, this.y);
    if (!this.landed) {
      const cx = this.x + this.w / 2 + sway;
      ctx.save();
      ctx.strokeStyle = '#a78bfa';
      ctx.beginPath();
      ctx.arc(cx, this.y - 3, 8, Math.PI, 0);
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - 8, this.y - 3); ctx.lineTo(this.x + 3 + sway, this.y + 3);
      ctx.moveTo(cx + 8, this.y - 3); ctx.lineTo(this.x + this.w - 3 + sway, this.y + 3);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Hidden collectible: one of the 27 "plugins" scattered across the worlds.
export class Plugin {
  constructor(tx, ty, idx) {
    this.x = tx * TILE + 1; this.y = ty * TILE + 3;
    this.w = 14; this.h = 10;
    this.idx = idx;
    this.t = idx * 20;
    this.removed = false;
  }
  update(g) {
    this.t++;
    if (!g.player.dead && overlap(this, g.player)) {
      this.removed = true;
      g.pluginsGot.push(this.idx);
      g.app.audio.plugin();
      g.app.addScore(500);
      g.floatText(this.x + 7, this.y - 8, 'PLUGIN RESCATADO', '#a78bfa');
      g.spark(this.x + 7, this.y + 4, '#a78bfa', 8);
    }
  }
  draw(g, ctx) {
    const bob = Math.sin(this.t / 14) * 2;
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.sin(this.t / 9) * 0.08;
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.arc(this.x + 7, this.y + 4 + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawSprite(ctx, g.app.sprites.plugin, this.x, this.y + bob);
  }
}

// ------------------------------------------------------------- particles ---
export class Particle {
  constructor(x, y, vx, vy, color, life = 26, size = 2) {
    Object.assign(this, { x, y, vx, vy, color, life, t: 0, size, removed: false });
  }
  update() {
    this.t++;
    this.x += this.vx; this.y += this.vy;
    this.vy += 0.12;
    if (this.t >= this.life) this.removed = true;
  }
  draw(g, ctx) {
    ctx.save();
    ctx.globalAlpha = 1 - this.t / this.life;
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
    ctx.restore();
  }
}

export class FloatText {
  constructor(x, y, text, color) {
    Object.assign(this, { x, y, text, color, t: 0, removed: false });
  }
  update() { this.t++; this.y -= 0.45; if (this.t > 70) this.removed = true; }
  draw(g, ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (70 - this.t) / 20);
    ctx.font = '7px monospace';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, Math.round(this.x), Math.round(this.y));
    ctx.restore();
  }
}

export { overlap };
