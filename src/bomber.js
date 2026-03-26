// Bomber game — Bomberman-style with 99 levels
const BM_COLS = 13, BM_ROWS = 13, BM_CS = 50;
const BM_W = BM_COLS * BM_CS, BM_H = BM_ROWS * BM_CS;
// Cell types: 0=empty, 1=wall(indestructible), 2=brick(destructible), 3=exit, 4=bomb, 5=explosion
const BM_COLORS = { 0:'transparent', 1:'#555', 2:'rgba(180,140,100,0.7)', 3:'rgba(83,208,102,0.6)', bomb:'rgba(40,40,40,0.8)', exp:'rgba(255,160,50,0.6)' };

let bmBoard, bmPlayer, bmBombs, bmExplosions, bmLevel, bmLives, bmRunning, bmPaused, bmAnimId;
let bmCanvas, bmCtx, bmExitFound, bmCompletedLevels = new Set();
let bmPlayerVisual = { x: 0, y: 0 }; // smooth visual position
let bmMoveTimer = null, bmMoveDir = null, bmMoveInterval = 140, bmFastInterval = 80;
let bmHeldKeys = new Set();

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
  if (!bmPaused) { bmUpdate(); bmDraw(); }
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

function bmDraw() {
  const ctx = bmCtx;
  ctx.clearRect(0, 0, BM_W, BM_H);
  // grid
  for (let r = 0; r < BM_ROWS; r++) for (let c = 0; c < BM_COLS; c++) {
    const x = c * BM_CS, y = r * BM_CS;
    const v = bmBoard[r][c];
    if (v === 1) {
      ctx.fillStyle = 'rgba(80,80,80,0.7)';
      ctx.beginPath(); ctx.roundRect(x+1, y+1, BM_CS-2, BM_CS-2, 4); ctx.fill();
    } else if (v === 2) {
      ctx.fillStyle = 'rgba(180,140,100,0.6)';
      ctx.beginPath(); ctx.roundRect(x+1, y+1, BM_CS-2, BM_CS-2, 4); ctx.fill();
      ctx.globalAlpha = 0.2; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.roundRect(x+3, y+2, BM_CS-6, (BM_CS-4)*0.4, 3); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (v === 3 && bmExitFound) {
      ctx.fillStyle = 'rgba(83,208,102,0.5)';
      ctx.beginPath(); ctx.roundRect(x+1, y+1, BM_CS-2, BM_CS-2, 4); ctx.fill();
      ctx.fillStyle = 'rgba(83,208,102,0.8)'; ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', x + BM_CS/2, y + BM_CS/2);
    }
    // grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, BM_CS, BM_CS);
  }
  // bombs
  for (const bomb of bmBombs) {
    const x = bomb.c * BM_CS + BM_CS/2, y = bomb.r * BM_CS + BM_CS/2;
    const pulse = 1 + Math.sin((performance.now() - bomb.time) * 0.01) * 0.1;
    ctx.fillStyle = 'rgba(40,40,40,0.8)';
    ctx.beginPath(); ctx.arc(x, y, BM_CS * 0.35 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,100,50,0.8)';
    ctx.beginPath(); ctx.arc(x, y - BM_CS * 0.3, 4, 0, Math.PI * 2); ctx.fill();
  }
  // explosions
  for (const exp of bmExplosions) {
    const age = (performance.now() - exp.time) / 500;
    ctx.save();
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = `rgba(255,${Math.floor(160 - age * 100)},50,0.7)`;
    ctx.beginPath();
    ctx.roundRect(exp.c * BM_CS + 2, exp.r * BM_CS + 2, BM_CS - 4, BM_CS - 4, 6);
    ctx.fill();
    ctx.restore();
  }
  // player — smooth interpolation
  const targetX = bmPlayer.c * BM_CS, targetY = bmPlayer.r * BM_CS;
  bmPlayerVisual.x += (targetX - bmPlayerVisual.x) * 0.35;
  bmPlayerVisual.y += (targetY - bmPlayerVisual.y) * 0.35;
  const px = bmPlayerVisual.x + BM_CS/2, py = bmPlayerVisual.y + BM_CS/2;
  ctx.fillStyle = 'rgba(33,150,243,0.8)';
  ctx.beginPath(); ctx.arc(px, py, BM_CS * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px - 5, py - 4, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 5, py - 4, 3, 0, Math.PI * 2); ctx.fill();
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
  switch (key) {
    case 'ArrowUp': case 'w': case 'W': return [-1, 0];
    case 'ArrowDown': case 's': case 'S': return [1, 0];
    case 'ArrowLeft': case 'a': case 'A': return [0, -1];
    case 'ArrowRight': case 'd': case 'D': return [0, 1];
  }
  return null;
}

function bmProcessHeld() {
  // find most recent direction key
  const dirKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
  let lastDir = null;
  for (const k of bmHeldKeys) { if (dirKeys.includes(k)) lastDir = k; }
  if (!lastDir) {
    if (bmMoveTimer) { clearInterval(bmMoveTimer); bmMoveTimer = null; }
    return;
  }
  const dir = bmKeyToDir(lastDir);
  if (!dir) return;
  // check if same direction held — speed up
  const isSame = bmMoveDir && bmMoveDir[0] === dir[0] && bmMoveDir[1] === dir[1];
  bmMoveDir = dir;
  if (!bmMoveTimer) {
    bmMove(dir[0], dir[1]); // immediate first step
    bmMoveTimer = setInterval(() => bmMove(bmMoveDir[0], bmMoveDir[1]), bmFastInterval);
  }
}

window.addEventListener('keydown', (e) => {
  const bd = document.getElementById('bomber-game-backdrop');
  if (!bd || bd.style.display === 'none') return;
  if (e.key === 'Escape') { e.preventDefault(); if (bmPaused) resumeBomber(); else if (bmRunning) { bmPaused = true; document.getElementById('bomber-pause-overlay').style.display = 'flex'; } return; }
  if (bmPaused) return;
  if (e.key === ' ' || e.key === 'Enter') { bmPlaceBomb(); e.preventDefault(); return; }
  const dir = bmKeyToDir(e.key);
  if (dir) {
    e.preventDefault();
    if (!bmHeldKeys.has(e.key)) {
      bmHeldKeys.add(e.key);
      if (bmMoveTimer) { clearInterval(bmMoveTimer); bmMoveTimer = null; }
      bmMove(dir[0], dir[1]);
      bmMoveDir = dir;
      // start slow, then speed up
      let steps = 0;
      bmMoveTimer = setInterval(() => {
        bmMove(bmMoveDir[0], bmMoveDir[1]);
        steps++;
        if (steps === 3) {
          clearInterval(bmMoveTimer);
          bmMoveTimer = setInterval(() => bmMove(bmMoveDir[0], bmMoveDir[1]), bmFastInterval);
        }
      }, bmMoveInterval);
    }
  }
});

window.addEventListener('keyup', (e) => {
  bmHeldKeys.delete(e.key);
  const dirKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
  // check if any direction still held
  let anyHeld = false;
  for (const k of bmHeldKeys) { if (dirKeys.includes(k)) { anyHeld = true; break; } }
  if (!anyHeld && bmMoveTimer) { clearInterval(bmMoveTimer); bmMoveTimer = null; bmMoveDir = null; }
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
window.cleanupBomber = () => { bmRunning = false; bmPaused = false; if (bmAnimId) { cancelAnimationFrame(bmAnimId); bmAnimId = null; } if (bmMoveTimer) { clearInterval(bmMoveTimer); bmMoveTimer = null; } if (bmTouchTimer) { clearInterval(bmTouchTimer); bmTouchTimer = null; } bmHeldKeys.clear(); };

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
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
    const x = c * cs, y = r * cs;
    // random walls and bricks
    if ((r + c) % 3 === 0) {
      ctx.fillStyle = 'rgba(80,80,80,0.4)';
      ctx.beginPath(); ctx.roundRect(x+1, y+1, cs-2, cs-2, 3); ctx.fill();
    } else if (Math.random() > 0.5) {
      ctx.fillStyle = 'rgba(180,140,100,0.35)';
      ctx.beginPath(); ctx.roundRect(x+1, y+1, cs-2, cs-2, 3); ctx.fill();
    }
    // random bombs
    if (Math.random() > 0.85) {
      ctx.fillStyle = 'rgba(40,40,40,0.5)';
      ctx.beginPath(); ctx.arc(x + cs/2, y + cs/2, cs * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,100,50,0.6)';
      ctx.beginPath(); ctx.arc(x + cs/2, y + cs/2 - cs * 0.25, 3, 0, Math.PI * 2); ctx.fill();
    }
    // random explosions
    if (Math.random() > 0.9) {
      ctx.fillStyle = 'rgba(255,160,50,0.3)';
      ctx.beginPath(); ctx.roundRect(x+2, y+2, cs-4, cs-4, 4); ctx.fill();
    }
  }
}
window.generateBomberLogo = generateBomberLogo;
window.addEventListener('load', () => setTimeout(generateBomberLogo, 220));
window.addEventListener('resize', generateBomberLogo);
