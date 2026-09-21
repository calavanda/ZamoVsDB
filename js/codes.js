// Level-skip access keys. The plaintext 5-digit codes are NOT stored here —
// only the SHA-256 hash of (SALT + code) for each global level index 0..11.
// Reading this file can't reveal a code; verification hashes the player's
// input and looks for a match. (Client-side hosting has no backend, so this
// resists casual code-reading, not a determined offline brute force of the
// 100k 5-digit space — that's the limit without a server.)

const SALT = 'tabularis-run/keys/v1::';

// HASHES[gIdx] = sha256(SALT + code) for the level at world*4 + level.
const HASHES = [
  '37fbd0d9512b048eb2eaf1d746eb290e049c7ea8236acfb995ccc0a5a8b8bc72',
  '7c3a5424cdcf4813689fc2e40832efdc11a764e585be3001c6642ca43c201347',
  '4f57572aa9f48ceb0d9643b0638293026ff9ac5fac5a4c67840f0eb05c00196b',
  'd396d19cee3836fd535bc43aabf0c290a20a5ac1f80b777942829fb07a81de0f',
  'c2e39587b96d982208bb5fb323dfe41f2675bd2f682e2dda1e15bb044db26c11',
  'ff69f982be9e790ae0bae38778a110f4ca417809a9eee632bd09bd714543439c',
  '493cdbc91e342f54a6df96566e68220e946cdf272ec9efe20703ae64176bf89b',
  'ef7f932028998183e13488c998d5163b4678f3e20b37848437632169f013484a',
  'e399181d7ce9617b477352e01e321e1b84a262c224a73079cabb87186b0dc86d',
  'c9a4a2ba0defe4d77cb8fd6b742965042497ea56dcb22daf701a95305c43c675',
  'ed58d5d3267f4679e19788123e98d6a9fb223b1d02ecdf47538cf1ae31af5ffe',
  'dc33165bd4f8acb635ffd55f7db867baf34f3191227d26629b570d5d89058da7',
];

// Resolve a 5-digit code to its global level index, or -1 if it matches none.
export async function levelForCode(code) {
  if (!/^\d{5}$/.test(code) || !crypto?.subtle) return -1;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + code));
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  return HASHES.indexOf(hex);
}
