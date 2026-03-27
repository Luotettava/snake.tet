// Bomber game — Bomberman-style with 99 levels
const BM_COLS = 13, BM_ROWS = 13, BM_CS = 50;
const BM_W = BM_COLS * BM_CS, BM_H = BM_ROWS * BM_CS;
// Cell types: 0=empty, 1=wall(indestructible), 2=brick(destructible), 3=exit, 4=bomb, 5=explosion
const BM_COLORS = { 0:'transparent', 1:'#555', 2:'rgba(180,140,100,0.7)', 3:'rgba(83,208,102,0.6)', bomb:'rgba(40,40,40,0.8)', exp:'rgba(255,160,50,0.6)' };

let bmBoard, bmPlayer, bmBombs, bmExplosions, bmLevel, bmLives, bmRunning, bmPaused, bmAnimId;
let bmCanvas, bmCtx, bmExitFound, bmCompletedLevels = new Set();
let bmPlayerVisual = { x: 0, y: 0 }; // smooth visual position
let bmMoveTimer = null, bmMoveDir = null, bmMoveInterval = 200, bmFastInterval = 120;
let bmHeldKeys = new Set();
let bmLastMoveTime = 0;
let bmMoveCount = 0;

function bmGenLevel(lvl) {
  const b = Array.from({length:BM_ROWS}, () => Array(BM_COLS).fill(0));
  const seed = lvl * 13 + 7;
  let rng = seed;
  function rand() { rng = (rng * 16807) % 2147483647; return (rng & 0x7fffffff) / 0x7fffffff; }
  // walls — border + random interior
  for (let r = 0; r < BM_ROWS; r++) for (let c = 0; c < BM_COLS; c++) {
    if (r === 0 || r === BM_ROWS-1 || c === 0 || c === BM_COLS-1) b[r][c] = 1; // border
    else if (rand() < 0.12 + lvl * 0.002) b[r][c] = 1; // random walls
    else if (rand() < 0.3 + lvl * 0.003) b[r][c] = 2; // bricks
  }
  // clear player start area
  b[1][1] = 0; b[1][2] = 0; b[2][1] = 0;
  // place exit under a random brick
  const bricks = [];
  for (let r = 0; r < BM_ROWS; r++) for (let c = 0; c < BM_COLS; c++) if (b[r][c] === 2) bricks.push([r,c]);
  if (bricks.length > 0) { const [er,ec] = bricks[Math.floor(rand() * bricks.length)]; b[er][ec] = 3; }
  return b;
}

function bmInit(lvl) {
  bmLevel = lvl; bmLives = 3; bmRunning = true; bmPaused = false; bmExitFound = false;
  bmBoard = bmGenLevel(lvl);
  bmPlayer = { r: 1, c: 1 };
  bmPlayerVisual = { x: 1 * BM_CS, y: 1 * BM_CS };
  bmBombs = []; bmExplosions = [];
  bmHeldKeys.clear();
  if (bmMoveTimer) { clearInterval(bmMoveTimer); bmMoveTimer = null; }
  bmCanvas = document.getElementById('bomber-canvas');
  bmCanvas.width = BM_W; bmCanvas.height = BM_H;
  bmCtx = bmCanvas.getContext('2d');
  document.getElementById('bomber-level-display').textContent = 'Level: ' + lvl;
  document.getElementById('bomber-lives-display').textContent = '❤'.repeat(bmLives);
  document.getElementById('bomber-result-overlay').style.display = 'none';
  document.getElementById('bomber-pause-overlay').style.display = 'none';
  if (bmAnimId) cancelAnimationFrame(bmAnimId);
  bmLoop();
}

function bmLoop() {
  if (!bmRunning) return;
  if (!bmPaused) { bmUpdateMovement(); bmUpdate(); bmDraw(); }
  bmAnimId = requestAnimationFrame(bmLoop);
}

function bmUpdate() {
  // update bombs
  const now = performance.now();
  for (let i = bmBombs.length - 1; i >= 0; i--) {
    const bomb = bmBombs[i];
    if (now - bomb.time > 2000) {
      bmBombs.splice(i, 1);
      bmExplode(bomb.r, bomb.c, 2 + Math.floor(bmLevel / 20));
    }
  }
  // update explosions
  for (let i = bmExplosions.length - 1; i >= 0; i--) {
    if (now - bmExplosions[i].time > 500) bmExplosions.splice(i, 1);
  }
  // check player in explosion
  for (const exp of bmExplosions) {
    if (exp.r === bmPlayer.r && exp.c === bmPlayer.c) {
      bmLives--;
      document.getElementById('bomber-lives-display').textContent = '❤'.repeat(Math.max(0, bmLives));
      if (bmLives <= 0) { bmRunning = false; bmEndGame(false); return; }
      bmPlayer = { r: 1, c: 1 }; // respawn
    }
  }
  // check exit
  if (bmBoard[bmPlayer.r][bmPlayer.c] === 3 && bmExitFound) {
    bmRunning = false;
    bmCompletedLevels.add(bmLevel);
    bmUpdateLevelBtn(bmLevel);
    bmEndGame(true);
  }
}

function bmExplode(r, c, range) {
  const now = performance.now();
  bmExplosions.push({ r, c, time: now });
  if (bmBoard[r][c] === 2 || bmBoard[r][c] === 3) {
    if (bmBoard[r][c] === 3) bmExitFound = true;
    bmBoard[r][c] = bmBoard[r][c] === 3 ? 3 : 0;
  }
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
  for (const [dr,dc] of dirs) {
    for (let s = 1; s <= range; s++) {
      const nr = r + dr * s, nc = c + dc * s;
      if (nr < 0 || nr >= BM_ROWS || nc < 0 || nc >= BM_COLS) break;
      if (bmBoard[nr][nc] === 1) break; // wall stops
      bmExplosions.push({ r: nr, c: nc, time: now });
      if (bmBoard[nr][nc] === 2) { bmBoard[nr][nc] = 0; break; }
      if (bmBoard[nr][nc] === 3) { bmExitFound = true; break; }
    }
  }
}

// Shared drawing functions for game and logo
function bmDrawBrick(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(120,120,120,0.4)';
  ctx.beginPath(); ctx.roundRect(x+2, y+2, s-4, s-4, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(80,80,80,0.25)'; ctx.lineWidth = 1;
  const bh = (s-4) / 3;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x+2, y+2+i*bh); ctx.lineTo(x+s-2, y+2+i*bh); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x+s/2, y+2); ctx.lineTo(x+s/2, y+2+bh); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+s*0.25, y+2+bh); ctx.lineTo(x+s*0.25, y+2+bh*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+s*0.75, y+2+bh); ctx.lineTo(x+s*0.75, y+2+bh*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+s/2, y+2+bh*2); ctx.lineTo(x+s/2, y+2+bh*3); ctx.stroke();
}
function bmDrawCrate(ctx, x, y, s) {
  const p = s * 0.08, bx = x+p, by = y+p, bs = s-p*2;
  ctx.fillStyle = 'rgba(190,165,110,0.4)';
  ctx.beginPath(); ctx.roundRect(bx, by, bs, bs, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(140,110,60,0.4)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx+2, by+2); ctx.lineTo(bx+bs-2, by+bs-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx+bs-2, by+2); ctx.lineTo(bx+2, by+bs-2); ctx.stroke();
  ctx.lineCap = 'butt';
}
function bmDrawBomb(ctx, x, y, s, pulse) {
  ctx.fillStyle = 'rgba(60,60,60,0.45)';
  ctx.beginPath(); ctx.arc(x+s/2, y+s/2, s*0.3*(pulse||1), 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,180,50,0.5)';
  ctx.beginPath(); ctx.arc(x+s/2, y+s/2-s*0.28, s*0.06, 0, Math.PI*2); ctx.fill();
}
function bmDrawPlayer(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(33,150,243,0.5)';
  ctx.beginPath(); ctx.arc(x+s/2, y+s/2, s*0.32, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(x+s/2-s*0.08, y+s/2-s*0.06, s*0.05, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+s/2+s*0.08, y+s/2-s*0.06, s*0.05, 0, Math.PI*2); ctx.fill();
}

function bmDraw() {
  const ctx = bmCtx;
  ctx.clearRect(0, 0, BM_W, BM_H);
  // grid
  for (let r = 0; r < BM_ROWS; r++) for (let c = 0; c < BM_COLS; c++) {
    const x = c * BM_CS, y = r * BM_CS;
    const v = bmBoard[r][c];
    if (v === 1) {
      bmDrawBrick(ctx, x, y, BM_CS);
    } else if (v === 2) {
      bmDrawCrate(ctx, x, y, BM_CS);
    } else if (v === 3 && bmExitFound) {
      // gem diamond with facets
      const cx = x + BM_CS/2, cy = y + BM_CS/2;
      const w2 = BM_CS * 0.4, h2 = BM_CS * 0.42;
      const crownH = h2 * 0.35;
      // crown top (flat top trapezoid)
      ctx.fillStyle = 'rgba(180,210,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(cx - w2 * 0.6, cy - h2);       // top-left
      ctx.lineTo(cx + w2 * 0.6, cy - h2);       // top-right
      ctx.lineTo(cx + w2, cy - h2 + crownH);    // crown-right
      ctx.lineTo(cx - w2, cy - h2 + crownH);    // crown-left
      ctx.closePath(); ctx.fill();
      // crown facets — left triangle
      ctx.fillStyle = 'rgba(200,225,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(cx - w2 * 0.6, cy - h2);
      ctx.lineTo(cx - w2 * 0.1, cy - h2 + crownH);
      ctx.lineTo(cx - w2, cy - h2 + crownH);
      ctx.closePath(); ctx.fill();
      // crown facets — right triangle
      ctx.fillStyle = 'rgba(100,150,230,0.7)';
      ctx.beginPath();
      ctx.moveTo(cx + w2 * 0.6, cy - h2);
      ctx.lineTo(cx + w2 * 0.1, cy - h2 + crownH);
      ctx.lineTo(cx + w2, cy - h2 + crownH);
      ctx.closePath(); ctx.fill();
      // bottom left facet
      ctx.fillStyle = 'rgba(140,185,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(cx - w2, cy - h2 + crownH);
      ctx.lineTo(cx - w2 * 0.1, cy - h2 + crownH);
      ctx.lineTo(cx, cy + h2);
      ctx.closePath(); ctx.fill();
      // bottom center facet
      ctx.fillStyle = 'rgba(100,160,240,0.7)';
      ctx.beginPath();
      ctx.moveTo(cx - w2 * 0.1, cy - h2 + crownH);
      ctx.lineTo(cx + w2 * 0.1, cy - h2 + crownH);
      ctx.lineTo(cx, cy + h2);
      ctx.closePath(); ctx.fill();
      // bottom right facet
      ctx.fillStyle = 'rgba(70,130,220,0.7)';
      ctx.beginPath();
      ctx.moveTo(cx + w2 * 0.1, cy - h2 + crownH);
      ctx.lineTo(cx + w2, cy - h2 + crownH);
      ctx.lineTo(cx, cy + h2);
      ctx.closePath(); ctx.fill();
    }
    // grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, BM_CS, BM_CS);
  }
  // bombs — soft
  for (const bomb of bmBombs) {
    const pulse = 1 + Math.sin((performance.now() - bomb.time) * 0.008) * 0.08;
    bmDrawBomb(ctx, bomb.c * BM_CS, bomb.r * BM_CS, BM_CS, pulse);
  }
  // explosions — soft glow
  for (const exp of bmExplosions) {
    const age = (performance.now() - exp.time) / 500;
    ctx.save();
    ctx.globalAlpha = (1 - age) * 0.45;
    ctx.fillStyle = 'rgba(255,180,80,0.5)';
    ctx.beginPath();
    ctx.roundRect(exp.c * BM_CS + 4, exp.r * BM_CS + 4, BM_CS - 8, BM_CS - 8, 6);
    ctx.fill();
    ctx.restore();
  }
  // player — soft blue
  const targetX = bmPlayer.c * BM_CS, targetY = bmPlayer.r * BM_CS;
  bmPlayerVisual.x += (targetX - bmPlayerVisual.x) * 0.35;
  bmPlayerVisual.y += (targetY - bmPlayerVisual.y) * 0.35;
  bmDrawPlayer(ctx, bmPlayerVisual.x, bmPlayerVisual.y, BM_CS);
}

function bmEndGame(won) {
  const titleEl = document.getElementById('bomber-result-title');
  const retryBtn = document.getElementById('bomber-retry-btn');
  const nextBtn = document.getElementById('bomber-next-btn');
  if (won) {
    titleEl.textContent = 'Level Clear!'; titleEl.style.color = '#53d066';
    retryBtn.style.display = 'none';
    nextBtn.style.display = bmLevel < 99 ? 'block' : 'none';
  } else {
    titleEl.textContent = 'You lost!'; titleEl.style.color = '#ff4444';
    retryBtn.style.display = 'block'; retryBtn.style.background = '#ff4444';
    nextBtn.style.display = 'none';
  }
  document.getElementById('bomber-result-overlay').style.display = 'flex';
}

// Input
function bmMove(dr, dc) {
  if (!bmRunning || bmPaused) return;
  const nr = bmPlayer.r + dr, nc = bmPlayer.c + dc;
  if (nr < 0 || nr >= BM_ROWS || nc < 0 || nc >= BM_COLS) return;
  if (bmBoard[nr][nc] === 1 || bmBoard[nr][nc] === 2) return;
  if (bmBoard[nr][nc] === 3 && !bmExitFound) return; // can't walk on hidden exit
  bmPlayer = { r: nr, c: nc };
}

function bmPlaceBomb() {
  if (!bmRunning || bmPaused) return;
  if (bmBombs.some(b => b.r === bmPlayer.r && b.c === bmPlayer.c)) return;
  bmBombs.push({ r: bmPlayer.r, c: bmPlayer.c, time: performance.now() });
}

function bmKeyToDir(key) {
  switch (key.toLowerCase()) {
    case 'arrowup': case 'w': return [-1, 0];
    case 'arrowdown': case 's': return [1, 0];
    case 'arrowleft': case 'a': return [0, -1];
    case 'arrowright': case 'd': return [0, 1];
  }
  return null;
}

// Movement happens in bmUpdate via held keys — no timers needed
function bmUpdateMovement() {
  if (!bmRunning || bmPaused) return;
  const now = performance.now();
  const arr = Array.from(bmHeldKeys);
  let dir = null;
  for (let i = arr.length - 1; i >= 0; i--) {
    dir = bmKeyToDir(arr[i]);
    if (dir) break;
  }
  if (!dir) { bmMoveCount = 0; return; }
  const elapsed = now - bmLastMoveTime;
  // speed ramps: 200ms for first 3 moves, then 120ms
  const interval = bmMoveCount < 3 ? 200 : 120;
  if (elapsed >= interval) {
    bmMove(dir[0], dir[1]);
    bmLastMoveTime = now;
    bmMoveCount++;
  }
}

window.addEventListener('keydown', (e) => {
  const bd = document.getElementById('bomber-game-backdrop');
  if (!bd || bd.style.display === 'none') return;
  if (e.key === 'Escape') { e.preventDefault(); if (bmPaused) resumeBomber(); else if (bmRunning) { bmPaused = true; document.getElementById('bomber-pause-overlay').style.display = 'flex'; } return; }
  if (bmPaused) return;
  if (e.key === ' ' || e.key === 'Enter') { bmPlaceBomb(); e.preventDefault(); return; }
  if (bmKeyToDir(e.key)) {
    e.preventDefault();
    if (!bmHeldKeys.has(e.key)) {
      bmHeldKeys.add(e.key);
      // allow one immediate step on new key press, but only if enough time passed
      const now = performance.now();
      if (now - bmLastMoveTime > 80) {
        const dir = bmKeyToDir(e.key);
        if (dir) { bmMove(dir[0], dir[1]); bmLastMoveTime = now; }
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  bmHeldKeys.delete(e.key);
  if (bmHeldKeys.size === 0) bmMoveCount = 0;
});

// Touch — virtual D-pad: drag to move continuously, double-tap to bomb
let bmTouchActive = false, bmTouchDir = null, bmTouchTimer = null;
let bmLastTap = 0;

function bmTouchStart(e) {
  const bd = document.getElementById('bomber-game-backdrop');
  if (!bd || bd.style.display === 'none' || bmPaused || !bmRunning) return;
  bmTouchActive = true;
  bmTx = e.touches[0].clientX; bmTy = e.touches[0].clientY;
}

function bmTouchMove(e) {
  if (!bmTouchActive || !bmRunning || bmPaused) return;
  const dx = e.touches[0].clientX - bmTx;
  const dy = e.touches[0].clientY - bmTy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return;
  let dir;
  if (Math.abs(dx) > Math.abs(dy)) dir = [0, dx > 0 ? 1 : -1];
  else dir = [dy > 0 ? 1 : -1, 0];
  // only move if direction changed or first move
  if (!bmTouchDir || bmTouchDir[0] !== dir[0] || bmTouchDir[1] !== dir[1]) {
    bmTouchDir = dir;
    bmMove(dir[0], dir[1]);
    if (bmTouchTimer) clearInterval(bmTouchTimer);
    bmTouchTimer = setInterval(() => {
      if (bmTouchDir) bmMove(bmTouchDir[0], bmTouchDir[1]);
    }, bmFastInterval);
  }
  // reset origin for continuous dragging
  bmTx = e.touches[0].clientX;
  bmTy = e.touches[0].clientY;
}

function bmTouchEnd(e) {
  bmTouchActive = false;
  bmTouchDir = null;
  if (bmTouchTimer) { clearInterval(bmTouchTimer); bmTouchTimer = null; }
  // double-tap to bomb
  const now = performance.now();
  if (now - bmLastTap < 300) { bmPlaceBomb(); bmLastTap = 0; }
  else bmLastTap = now;
}

document.addEventListener('touchstart', bmTouchStart, { passive: true });
document.addEventListener('touchmove', (e) => {
  const bd = document.getElementById('bomber-game-backdrop');
  if (bd && bd.style.display !== 'none') { e.preventDefault(); bmTouchMove(e); }
}, { passive: false });
document.addEventListener('touchend', bmTouchEnd, { passive: true });

// Level list
function bmBuildLevels() {
  const list = document.getElementById('bomber-level-list');
  if (!list || list.children.length > 0) {
    if (list) for (let i = 0; i < list.children.length; i++) {
      const lvl = i + 1;
      list.children[i].textContent = bmCompletedLevels.has(lvl) ? 'Level ' + lvl + ' - FINISHED!' : 'Level ' + lvl;
    }
    return;
  }
  for (let i = 1; i <= 99; i++) {
    const btn = document.createElement('button');
    btn.className = 'menu-button';
    btn.textContent = bmCompletedLevels.has(i) ? 'Level ' + i + ' - FINISHED!' : 'Level ' + i;
    btn.addEventListener('click', () => bmStartLevel(i));
    list.appendChild(btn);
  }
}
function bmUpdateLevelBtn(lvl) {
  const list = document.getElementById('bomber-level-list');
  if (list && list.children[lvl-1]) list.children[lvl-1].textContent = 'Level ' + lvl + ' - FINISHED!';
}

function bmStartLevel(lvl) {
  document.getElementById('bomber-menu-backdrop').style.display = 'none';
  document.getElementById('bomber-game-backdrop').style.display = 'flex';
  bmInit(lvl);
}
function resumeBomber() { bmPaused = false; document.getElementById('bomber-pause-overlay').style.display = 'none'; if (bmRunning) bmLoop(); }
function quitBomber() {
  bmRunning = false; bmPaused = false;
  if (bmAnimId) { cancelAnimationFrame(bmAnimId); bmAnimId = null; }
  document.getElementById('bomber-pause-overlay').style.display = 'none';
  document.getElementById('bomber-result-overlay').style.display = 'none';
  document.getElementById('bomber-game-backdrop').style.display = 'none';
  document.getElementById('bomber-menu-backdrop').style.display = 'flex';
}
function retryBomber() { bmInit(bmLevel); }
function nextBomberLevel() { if (bmLevel < 99) bmInit(bmLevel + 1); }

window.showBomberMenu = () => { document.getElementById('info-backdrop').style.display = 'none'; document.getElementById('bomber-menu-backdrop').style.display = 'flex'; bmBuildLevels(); };
window.hideBomberMenu = () => { document.getElementById('bomber-menu-backdrop').style.display = 'none'; document.getElementById('info-backdrop').style.display = 'flex'; };
window.quitBomber = quitBomber;
window.resumeBomber = resumeBomber;
window.retryBomber = retryBomber;
window.nextBomberLevel = nextBomberLevel;
window.mobilePauseBomber = () => { if (bmRunning && !bmPaused) { bmPaused = true; document.getElementById('bomber-pause-overlay').style.display = 'flex'; } };
window.bmPlaceBomb = bmPlaceBomb;
window.cleanupBomber = () => { bmRunning = false; bmPaused = false; if (bmAnimId) { cancelAnimationFrame(bmAnimId); bmAnimId = null; } bmHeldKeys.clear(); };

// Logo
function generateBomberLogo() {
  const canvas = document.getElementById('bomber-logo-canvas');
  if (!canvas) return;
  const btn = canvas.parentElement;
  const w = btn.offsetWidth, h = btn.offsetHeight;
  canvas.width = w * 2; canvas.height = h * 2;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const cs = Math.max(16, Math.floor(h / 3));
  const cols = Math.ceil(w / cs) + 1;
  const grid = [];
  for (let r = 0; r < 3; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const rnd = Math.random();
      if (rnd < 0.2) grid[r][c] = 1;       // brick — random 20%
      else if (rnd < 0.55) grid[r][c] = 2;  // crate — random 35%
      else grid[r][c] = 0;                   // empty
    }
  }
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
    const x = c * cs, y = r * cs;
    const v = grid[r][c];
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, cs, cs);
    if (v === 1) {
      bmDrawBrick(ctx, x, y, cs);
    } else if (v === 2) {
      bmDrawCrate(ctx, x, y, cs);
    }
    if (v === 0 && Math.random() > 0.85) {
      bmDrawBomb(ctx, x, y, cs, 1);
    }
  }
}
window.generateBomberLogo = generateBomberLogo;
window.addEventListener('load', () => setTimeout(generateBomberLogo, 220));
window.addEventListener('resize', generateBomberLogo);
