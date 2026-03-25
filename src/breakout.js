// Breakout game — 99 levels with procedural brick patterns

const BK_W = 700, BK_H = 800;
const BK_COLS = 14, BK_ROWS = 8;
const BK_BW = BK_W / BK_COLS, BK_BH = 20;
const BK_PAD_W = 100, BK_PAD_H = 12;
const BK_BALL_R = 6;
const BK_COLORS = [
  '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3',
  '#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39',
  '#ffeb3b','#ffc107','#ff9800','#ff5722'
];

let bkBricks = [], bkBall = {}, bkPaddle = {}, bkScore = 0, bkLevel = 1;
let bkRunning = false, bkPaused = false, bkFinished = false, bkAnimId = null;
let bkCompletedLevels = new Set();
let bkCanvas, bkCtx;

// Generate brick pattern for a level using seeded randomness
function generateLevel(lvl) {
  const bricks = [];
  const seed = lvl * 7 + 13;
  let rng = seed;
  function rand() { rng = (rng * 16807 + 0) % 2147483647; return (rng & 0x7fffffff) / 0x7fffffff; }

  // different pattern types based on level
  const pattern = lvl % 7;
  for (let r = 0; r < BK_ROWS; r++) {
    for (let c = 0; c < BK_COLS; c++) {
      let alive = false;
      switch (pattern) {
        case 0: alive = true; break; // full
        case 1: alive = (r + c) % 2 === 0; break; // checkerboard
        case 2: alive = r < BK_ROWS - 2; break; // top rows
        case 3: alive = Math.abs(c - BK_COLS/2 + 0.5) + Math.abs(r - BK_ROWS/2 + 0.5) < 5; break; // diamond
        case 4: alive = c > 1 && c < BK_COLS - 2; break; // center columns
        case 5: alive = rand() > 0.3; break; // random sparse
        case 6: alive = (r < 2 || r > BK_ROWS - 3) || (c < 2 || c > BK_COLS - 3); break; // border
      }
      if (alive) {
        const hits = 1 + Math.floor(lvl / 20); // bricks get tougher
        const colorIdx = Math.floor(rand() * BK_COLORS.length);
        bricks.push({ x: c * BK_BW, y: 40 + r * (BK_BH + 4), w: BK_BW - 2, h: BK_BH, hits, color: BK_COLORS[colorIdx] });
      }
    }
  }
  return bricks;
}

function initBreakout(lvl) {
  bkLevel = lvl;
  bkCanvas = document.getElementById('breakout-canvas');
  bkCtx = bkCanvas.getContext('2d');
  bkBricks = generateLevel(lvl);
  bkScore = 0;
  bkPaused = false;
  bkFinished = false;
  bkRunning = true;
  bkBall = { x: BK_W / 2, y: BK_H - 60, dx: 4.5 + lvl * 0.05, dy: -(4.5 + lvl * 0.05), r: BK_BALL_R };
  bkPaddle = { x: BK_W / 2 - BK_PAD_W / 2, y: BK_H - 30, w: BK_PAD_W, h: BK_PAD_H };
  document.getElementById('breakout-level-display').textContent = 'Level: ' + lvl;
  updateBkScore();
  document.getElementById('breakout-result-overlay').style.display = 'none';
  document.getElementById('breakout-pause-overlay').style.display = 'none';
  if (bkAnimId) cancelAnimationFrame(bkAnimId);
  bkLoop();
}

function updateBkScore() {
  const el = document.getElementById('breakout-score-display');
  if (el) el.textContent = 'Score: ' + bkScore;
}

function bkLoop() {
  if (!bkRunning) return;
  if (!bkPaused) {
    bkUpdate();
    bkDraw();
  }
  bkAnimId = requestAnimationFrame(bkLoop);
}

function bkUpdate() {
  // keyboard paddle movement
  const padSpeed = 8;
  if (bkKeysDown.has('arrowleft') || bkKeysDown.has('a')) bkPaddle.x = Math.max(0, bkPaddle.x - padSpeed);
  if (bkKeysDown.has('arrowright') || bkKeysDown.has('d')) bkPaddle.x = Math.min(BK_W - bkPaddle.w, bkPaddle.x + padSpeed);

  const b = bkBall;
  b.x += b.dx; b.y += b.dy;
  // wall bounce
  if (b.x - b.r < 0) { b.x = b.r; b.dx = Math.abs(b.dx); }
  if (b.x + b.r > BK_W) { b.x = BK_W - b.r; b.dx = -Math.abs(b.dx); }
  if (b.y - b.r < 0) { b.y = b.r; b.dy = Math.abs(b.dy); }
  // bottom — lose
  if (b.y + b.r > BK_H) { bkRunning = false; endBreakout(bkFinished); return; }
  // paddle bounce
  const p = bkPaddle;
  if (b.dy > 0 && b.y + b.r >= p.y && b.y + b.r <= p.y + p.h && b.x >= p.x && b.x <= p.x + p.w) {
    b.dy = -Math.abs(b.dy);
    const hit = (b.x - (p.x + p.w / 2)) / (p.w / 2);
    b.dx = hit * 5;
    b.y = p.y - b.r;
  }
  // brick collision — proper side detection
  for (let i = bkBricks.length - 1; i >= 0; i--) {
    const br = bkBricks[i];
    if (b.x + b.r > br.x && b.x - b.r < br.x + br.w && b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
      // find overlap on each side
      const overlapLeft = (b.x + b.r) - br.x;
      const overlapRight = (br.x + br.w) - (b.x - b.r);
      const overlapTop = (b.y + b.r) - br.y;
      const overlapBottom = (br.y + br.h) - (b.y - b.r);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      if (minOverlap === overlapLeft || minOverlap === overlapRight) {
        b.dx = -b.dx;
        if (minOverlap === overlapLeft) b.x = br.x - b.r;
        else b.x = br.x + br.w + b.r;
      } else {
        b.dy = -b.dy;
        if (minOverlap === overlapTop) b.y = br.y - b.r;
        else b.y = br.y + br.h + b.r;
      }
      br.hits--;
      if (br.hits <= 0) { bkBricks.splice(i, 1); bkScore += 10; updateBkScore(); }
      break;
    }
  }
  // win check — mark finished but keep playing
  if (bkBricks.length === 0 && !bkFinished) {
    bkFinished = true;
    bkCompletedLevels.add(bkLevel);
    updateLevelButton(bkLevel);
    document.getElementById('breakout-level-display').textContent = 'Level: ' + bkLevel + ' ✓';
  }
}

function bkDraw() {
  const ctx = bkCtx;
  ctx.clearRect(0, 0, BK_W, BK_H);
  // bricks
  for (const br of bkBricks) {
    const alpha = 0.4 + (br.hits - 1) * 0.2;
    ctx.fillStyle = br.color;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.beginPath();
    ctx.roundRect(br.x, br.y, br.w, br.h, 4);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // paddle
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.roundRect(bkPaddle.x, bkPaddle.y, bkPaddle.w, bkPaddle.h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // ball
  // ball — red with black outline
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(bkBall.x, bkBall.y, bkBall.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function endBreakout(won) {
  const titleEl = document.getElementById('breakout-result-title');
  const scoreEl = document.getElementById('breakout-result-score');
  const retryBtn = document.getElementById('breakout-retry-btn');
  const nextBtn = document.getElementById('breakout-next-btn');
  if (won) {
    titleEl.textContent = 'Level Clear!';
    titleEl.style.color = '#53d066';
    retryBtn.style.background = '#53d066';
    nextBtn.style.display = bkLevel < 99 ? 'block' : 'none';
  } else {
    titleEl.textContent = 'You lost!';
    titleEl.style.color = '#ff4444';
    retryBtn.style.background = '#ff4444';
    nextBtn.style.display = 'none';
  }
  scoreEl.textContent = 'Score: ' + bkScore;
  document.getElementById('breakout-result-overlay').style.display = 'flex';
}

// Paddle control
let bkMouseActive = false;
function bkMouseMove(e) {
  if (!bkRunning || bkPaused) return;
  const rect = bkCanvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (BK_W / rect.width);
  bkPaddle.x = Math.max(0, Math.min(BK_W - bkPaddle.w, mx - bkPaddle.w / 2));
}

// Build level list
function updateLevelButton(lvl) {
  const list = document.getElementById('breakout-level-list');
  if (!list) return;
  const btn = list.children[lvl - 1];
  if (btn) btn.textContent = 'Level ' + lvl + ' - FINISHED!';
}

function buildLevelList() {
  const list = document.getElementById('breakout-level-list');
  if (!list || list.children.length > 0) {
    // refresh labels for completed levels
    if (list) for (let i = 0; i < list.children.length; i++) {
      const lvl = i + 1;
      list.children[i].textContent = bkCompletedLevels.has(lvl) ? 'Level ' + lvl + ' - FINISHED!' : 'Level ' + lvl;
    }
    return;
  }
  for (let i = 1; i <= 99; i++) {
    const btn = document.createElement('button');
    btn.className = 'menu-button';
    btn.textContent = bkCompletedLevels.has(i) ? 'Level ' + i + ' - FINISHED!' : 'Level ' + i;
    btn.addEventListener('click', () => { startBreakoutLevel(i); });
    list.appendChild(btn);
  }
}

function startBreakoutLevel(lvl) {
  document.getElementById('breakout-menu-backdrop').style.display = 'none';
  document.getElementById('breakout-game-backdrop').style.display = 'flex';
  bkCanvas = document.getElementById('breakout-canvas');
  bkCanvas.addEventListener('mousemove', bkMouseMove);
  initBreakout(lvl);
}

function pauseBreakout() {
  if (!bkRunning || bkPaused) return;
  bkPaused = true;
  document.getElementById('breakout-pause-score').textContent = 'Score: ' + bkScore;
  document.getElementById('breakout-pause-overlay').style.display = 'flex';
}
function resumeBreakout() {
  bkPaused = false;
  document.getElementById('breakout-pause-overlay').style.display = 'none';
}
function quitBreakout() {
  bkRunning = false; bkPaused = false;
  if (bkAnimId) { cancelAnimationFrame(bkAnimId); bkAnimId = null; }
  document.getElementById('breakout-pause-overlay').style.display = 'none';
  document.getElementById('breakout-result-overlay').style.display = 'none';
  document.getElementById('breakout-game-backdrop').style.display = 'none';
  document.getElementById('breakout-menu-backdrop').style.display = 'flex';
}
function retryBreakout() { initBreakout(bkLevel); }
function nextBreakoutLevel() { if (bkLevel < 99) initBreakout(bkLevel + 1); }

// Keyboard controls
const bkKeysDown = new Set();
window.addEventListener('keydown', (e) => {
  const bd = document.getElementById('breakout-game-backdrop');
  if (!bd || bd.style.display === 'none') return;
  if (e.key === 'Escape') { e.preventDefault(); if (bkPaused) resumeBreakout(); else pauseBreakout(); return; }
  const k = e.key.toLowerCase();
  if (['arrowleft','arrowright','a','d'].includes(k)) { bkKeysDown.add(k); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  bkKeysDown.delete(e.key.toLowerCase());
});

// Navigation
window.showBreakoutMenu = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  document.getElementById('breakout-menu-backdrop').style.display = 'flex';
  buildLevelList();
};
window.hideBreakoutMenu = () => {
  document.getElementById('breakout-menu-backdrop').style.display = 'none';
  document.getElementById('info-backdrop').style.display = 'flex';
};
window.quitBreakout = quitBreakout;
window.resumeBreakout = resumeBreakout;
window.retryBreakout = retryBreakout;
window.nextBreakoutLevel = nextBreakoutLevel;

// Logo generator
function generateBreakoutLogo() {
  const canvas = document.getElementById('breakout-logo-canvas');
  if (!canvas) return;
  const btn = canvas.parentElement;
  const w = btn.offsetWidth, h = btn.offsetHeight;
  canvas.width = w * 2; canvas.height = h * 2;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const bw = 44, bh = 16, gap = 4;
  const cols = Math.ceil(w / (bw + gap)) + 1;
  const rows = Math.ceil(h / (bh + gap)) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > 0.6) continue;
      const x = c * (bw + gap) + (r % 2 ? bw / 2 : 0);
      const y = r * (bh + gap);
      ctx.fillStyle = BK_COLORS[Math.floor(Math.random() * BK_COLORS.length)];
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 3); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
window.generateBreakoutLogo = generateBreakoutLogo;
window.addEventListener('load', () => setTimeout(generateBreakoutLogo, 140));
window.addEventListener('resize', generateBreakoutLogo);
