// Renders a shareable 1200×630 score card. Returned as a canvas; main.js
// turns it into a PNG for the Web Share API (or a download fallback).

import { drawLogoPixel } from './sprites.js';

export function buildShareCard(data, S) {
  const cv = document.createElement('canvas');
  cv.width = 1200; cv.height = 630;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;

  // backdrop
  c.fillStyle = '#08090a';
  c.fillRect(0, 0, 1200, 630);
  c.save();
  c.globalAlpha = 0.05;
  c.strokeStyle = '#22d3ee';
  c.beginPath();
  for (let x = 0; x < 1200; x += 60) { c.moveTo(x, 0); c.lineTo(x, 630); }
  for (let y = 0; y < 630; y += 60) { c.moveTo(0, y); c.lineTo(1200, y); }
  c.stroke();
  c.restore();
  const glow = c.createRadialGradient(600, 250, 0, 600, 250, 500);
  glow.addColorStop(0, 'rgba(59,130,246,0.15)');
  glow.addColorStop(1, 'rgba(59,130,246,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, 1200, 630);

  const mono = (px, bold = false) => `${bold ? 'bold ' : ''}${px}px "JetBrains Mono", monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  // header
  drawLogoPixel(c, 600, 80, 42, 12);
  c.fillStyle = '#ffffff';
  c.font = mono(46, true);
  c.fillText('ZAMORUN', 600, 168);
  c.fillStyle = '#9ca3af';
  c.font = mono(20);
  c.fillText('mi partida completada:', 600, 208);

  // the big number
  c.fillStyle = '#fde047';
  c.font = mono(96, true);
  c.fillText(String(data.score).padStart(6, '0'), 600, 290);
  c.fillStyle = '#4b5563';
  c.font = mono(18);
  c.fillText('PUNTUACIÓN', 600, 348);

  // stat row
  const stats = [
    [`${data.rows}`, 'filas recogidas', '#22d3ee'],
    [`${data.plugins}/${data.totalPlugins}`, 'plugins rescatados', '#a78bfa'],
    [`${data.unlocked}/${data.totalLevels}`, 'niveles desbloqueados', '#34d399'],
  ];
  stats.forEach(([val, label, color], i) => {
    const x = 300 + i * 300;
    c.fillStyle = color;
    c.font = mono(42, true);
    c.fillText(val, x, 408);
    c.fillStyle = '#9ca3af';
    c.font = mono(17);
    c.fillText(label, x, 444);
  });

  // challenge line
  c.fillStyle = '#34d399';
  c.font = mono(22, true);
  c.fillText('▶ supera mi partida — 1010 AEI · UTGZ', 600, 466);

  // ground strip + cast
  const G = 48;
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 25; i++) {
      c.drawImage(S.tiles[0].ground, i * G, 630 - G * 2 + r * G, G, G);
    }
  }
  const ground = 630 - G * 2;
  const put = (img, x, scale, lift = 0) =>
    c.drawImage(img, x, ground - img.height * scale - lift, img.width * scale, img.height * scale);
  put(S.player.run1, 130, 5); // the chosen protagonist leads the cast
  put(S.blob[0], 300, 3);
  put(S.coin, 400, 3, 8);
  put(S.snail[0], 500, 3);
  put(S.wisp[0], 660, 3);
  put(S.daemon[0], 800, 3);
  put(S.plugin, 930, 3, 4);
  put(S.boss.red, 1030, 5);

  return cv;
}
