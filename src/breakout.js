// Breakout game — 99 levels with procedural brick patterns

const BK_W = 700, BK_H = 800;
const BK_COLS = 14, BK_ROWS = 8;
const BK_BW = BK_W / BK_COLS, BK_BH = 20;
const BK_PAD_W = 140, BK_PAD_H = 14;
const BK_BALL_R = 8;
const BK_COLORS = [
  '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3',
  '#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39',
  '#ffeb3b','#ffc107','#ff9800','#ff5722'
];

let bkBricks = [], bkBall = {}, bkPaddle = {}, bkScore = 0, bkLevel = 1, bkLives = 3;
let bkRunning = false, bkPaused = false, bkFinished = false, bkAnimId = null;
let bkCompletedLevels = new Set();
let bkCanvas, bkCtx;
let bkPaddleTarget = 0;
let bkParticles = [];
let bkCountdown = 0; // countdown timer (seconds remaining)
let bkCountdownStart = 0;
let bkLaunched = false;

// Generate brick pattern for a level using seeded randomness
function generateLevel(lvl) {
  const bricks = [];
  const seed = lvl * 7 + 13;
  let rng = seed;
  function rand() { rng = (rng * 16807 + 0) % 2147483647; return (rng & 0x7fffffff) / 0x7fffffff; }
  function randColor() { return BK_COLORS[Math.floor(rand() * BK_COLORS.length)]; }

  const pattern = lvl % 12;
  const maxHits = 1 + Math.floor(lvl / 15);

  for (let r = 0; r < BK_ROWS; r++) {
    for (let c = 0; c < BK_COLS; c++) {
      let alive = false;
      let indestructible = false;

      switch (pattern) {
        case 0: // full grid
          alive = true; break;
        case 1: // checkerboard
          alive = (r + c) % 2 === 0; break;
        case 2: // diamond
          alive = Math.abs(c - BK_COLS / 2 + 0.5) + Math.abs(r - BK_ROWS / 2 + 0.5) < 5; break;
        case 3: // border — only corners indestructible, gaps in border
          alive = r === 0 || r === BK_ROWS - 1 || c === 0 || c === BK_COLS - 1;
          if ((r === 0 && c === 0) || (r === 0 && c === BK_COLS - 1)) indestructible = true;
          if (r > 0 && r < BK_ROWS - 1 && c > 0 && c < BK_COLS - 1 && rand() > 0.5) alive = true;
          break;
        case 4: // cross — center indestructible only
          alive = (c === Math.floor(BK_COLS / 2) || c === Math.floor(BK_COLS / 2) - 1 || r === Math.floor(BK_ROWS / 2) || r === Math.floor(BK_ROWS / 2) - 1);
          if (c === Math.floor(BK_COLS / 2) && r === Math.floor(BK_ROWS / 2)) indestructible = true;
          break;
        case 5: // zigzag rows
          alive = (r % 2 === 0) ? (c % 3 !== 0) : (c % 3 === 0); break;
        case 6: // pyramid
          alive = c >= (BK_ROWS - 1 - r) && c < BK_COLS - (BK_ROWS - 1 - r); break;
        case 7: // random with scattered indestructible (never adjacent)
          alive = rand() > 0.25;
          if (c % 5 === 2 && r % 4 === 2) { alive = true; indestructible = true; }
          break;
        case 8: // heart shape — no indestructible
          { const cx = c - BK_COLS / 2 + 0.5, cy = r - BK_ROWS / 2 + 0.5;
            alive = (cx * cx + (cy - Math.sqrt(Math.abs(cx))) * (cy - Math.sqrt(Math.abs(cx)))) < 12; }
          break;
        case 9: // stripes — indestructible dots in rows, not full rows
          alive = true;
          if (r % 3 === 0 && c % 3 === 0) indestructible = true;
          break;
        case 10: // spiral-ish — no indestructible
          { const dist = Math.max(Math.abs(c - BK_COLS / 2 + 0.5), Math.abs(r - BK_ROWS / 2 + 0.5));
            alive = Math.floor(dist) % 2 === 0; }
          break;
        case 11: // random with indestructible top corners only
          alive = rand() > 0.3;
          if (r === 0 && (c < 2 || c > BK_COLS - 3)) { alive = true; indestructible = true; }
          break;
      }

      if (alive) {
        const hits = indestructible ? -1 : Math.ceil(rand() * maxHits);
        const color = indestructible ? '#555' : randColor();
        bricks.push({
          x: c * BK_BW, y: 40 + r * (BK_BH + 4),
          w: BK_BW - 2, h: BK_BH,
          hits, color, indestructible
        });
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
  bkLives = 3;
  bkPaused = false;
  bkFinished = false;
  bkRunning = true;
  bkBall = { x: BK_W / 2, y: BK_H - 60, dx: 5.5 + lvl * 0.05, dy: -(5.5 + lvl * 0.05), r: BK_BALL_R };
  const padW = Math.max(60, BK_PAD_W - (lvl - 1) * 0.8);
  bkPaddle = { x: BK_W / 2 - padW / 2, y: BK_H - 30, w: padW, h: BK_PAD_H };
  bkPaddleTarget = bkPaddle.x;
  bkParticles = [];
  bkLaunched = false;
  bkCountdown = 3;
  bkCountdownStart = performance.now();
  // ball starts on paddle
  bkBall.x = bkPaddle.x + bkPaddle.w / 2;
  bkBall.y = bkPaddle.y - bkBall.r - 2;
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
  const livesEl = document.getElementById('breakout-lives-display');
  if (livesEl) livesEl.textContent = '🔴'.repeat(Math.max(0, bkLives - 1));
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
  // smooth paddle movement
  const padSpeed = 14;
  if (bkKeysDown.has('arrowleft') || bkKeysDown.has('a')) bkPaddleTarget = Math.max(0, bkPaddle.x - padSpeed);
  if (bkKeysDown.has('arrowright') || bkKeysDown.has('d')) bkPaddleTarget = Math.min(BK_W - bkPaddle.w, bkPaddle.x + padSpeed);
  bkPaddle.x = bkPaddleTarget;

  // update particles
  for (let i = bkParticles.length - 1; i >= 0; i--) {
    const p = bkParticles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.97; p.vy *= 0.97; // drag
    p.life -= 0.02;
    p.vy += 0.08; // gentle gravity
    if (p.life <= 0) bkParticles.splice(i, 1);
  }

  const b = bkBall;

  // countdown — ball sits on paddle
  if (!bkLaunched) {
    b.x = bkPaddle.x + bkPaddle.w / 2;
    b.y = bkPaddle.y - b.r - 2;
    const elapsed = (performance.now() - bkCountdownStart) / 1000;
    bkCountdown = Math.max(0, 3 - elapsed);
    if (bkCountdown <= 0) {
      bkLaunched = true;
      b.dx = (5.5 + bkLevel * 0.05) * (Math.random() > 0.5 ? 1 : -1);
      b.dy = -(5.5 + bkLevel * 0.05);
    }
    return;
  }

  // sub-step movement to prevent tunneling
  const steps = Math.max(1, Math.ceil(Math.sqrt(b.dx * b.dx + b.dy * b.dy) / b.r));
  const sdx = b.dx / steps, sdy = b.dy / steps;
  for (let step = 0; step < steps; step++) {
    b.x += sdx; b.y += sdy;
  // wall bounce
  if (b.x - b.r < 0) { b.x = b.r; b.dx = Math.abs(b.dx); }
  if (b.x + b.r > BK_W) { b.x = BK_W - b.r; b.dx = -Math.abs(b.dx); }
  if (b.y - b.r < 0) { b.y = b.r; b.dy = Math.abs(b.dy); }
  // bottom — lose a life
  if (b.y + b.r > BK_H) {
    bkLives--;
    updateBkScore();
    if (bkLives <= 0) { bkRunning = false; endBreakout(bkFinished); return; }
    // reset ball on paddle with countdown
    bkLaunched = false;
    bkCountdown = 3;
    bkCountdownStart = performance.now();
    b.x = bkPaddle.x + bkPaddle.w / 2;
    b.y = bkPaddle.y - b.r - 2;
    b.dx = 0; b.dy = 0;
    return;
  }
  // paddle bounce — angle depends on hit position, preserves total speed
  const p = bkPaddle;
  if (b.dy > 0 && b.y + b.r >= p.y && b.y + b.r <= p.y + p.h && b.x >= p.x && b.x <= p.x + p.w) {
    const hit = (b.x - (p.x + p.w / 2)) / (p.w / 2); // -1 to 1
    const speed = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
    const angle = hit * (Math.PI / 2.5); // max 72 degrees from vertical
    b.dx = speed * Math.sin(angle);
    b.dy = -speed * Math.cos(angle);
    // ensure minimum upward speed
    if (Math.abs(b.dy) < 2) b.dy = -2;
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
      if (!br.indestructible && br.hits <= 0) {
        // spawn particles
        for (let p = 0; p < 10; p++) {
          bkParticles.push({
            x: br.x + br.w / 2 + (Math.random() - 0.5) * br.w * 0.6,
            y: br.y + br.h / 2 + (Math.random() - 0.5) * br.h,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5 - 1,
            color: br.color, life: 1, size: 2 + Math.random() * 5
          });
        }
        bkBricks.splice(i, 1); bkScore += 10; updateBkScore();
      } else if (br.indestructible) {
        // flash particles for indestructible
        for (let p = 0; p < 3; p++) {
          bkParticles.push({
            x: br.x + br.w / 2, y: br.y + br.h / 2,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            color: '#888', life: 0.5, size: 2
          });
        }
      }
      break;
    }
  }
  } // end sub-step loop
  // win check — mark finished but keep playing
  if (!bkFinished && bkBricks.every(br => br.indestructible)) {
    bkFinished = true;
    bkCompletedLevels.add(bkLevel);
    updateLevelButton(bkLevel);
    document.getElementById('breakout-level-display').textContent = 'Level: ' + bkLevel + ' ✓';
    bkRunning = false;
    endBreakout(true);
  }
}

function bkDraw() {
  const ctx = bkCtx;
  ctx.clearRect(0, 0, BK_W, BK_H);

  // bricks — vibrant glassy
  for (const br of bkBricks) {
    ctx.save();
    ctx.globalAlpha = br.indestructible ? 0.85 : 0.7 + (br.hits - 1) * 0.1;
    ctx.fillStyle = br.indestructible ? '#444' : br.color;
    ctx.beginPath();
    ctx.roundRect(br.x + 1, br.y + 1, br.w - 2, br.h - 2, 5);
    ctx.fill();
    // glass shine
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(br.x + 3, br.y + 2, br.w - 6, (br.h - 4) * 0.4, 3);
    ctx.fill();
    ctx.restore();
  }

  // paddle — green pill
  ctx.fillStyle = 'rgba(83,208,102,0.85)';
  ctx.beginPath();
  ctx.roundRect(bkPaddle.x, bkPaddle.y, bkPaddle.w, bkPaddle.h, bkPaddle.h / 2);
  ctx.fill();

  // ball — colorful gradient
  ctx.save();
  ctx.shadowColor = 'rgba(255,100,100,0.4)';
  ctx.shadowBlur = 8;
  const ballGrad = ctx.createRadialGradient(
    bkBall.x - bkBall.r * 0.3, bkBall.y - bkBall.r * 0.3, bkBall.r * 0.1,
    bkBall.x, bkBall.y, bkBall.r
  );
  ballGrad.addColorStop(0, '#ff8a80');
  ballGrad.addColorStop(0.5, '#ff5252');
  ballGrad.addColorStop(1, '#d32f2f');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(bkBall.x, bkBall.y, bkBall.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // particles
  for (const p of bkParticles) {
    ctx.save();
    ctx.globalAlpha = p.life * p.life; // ease-out fade
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // countdown text
  if (!bkLaunched && bkCountdown > 0) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = 'bold 80px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillText(Math.ceil(bkCountdown), BK_W / 2, BK_H / 2);
    ctx.restore();
  }
}

function endBreakout(won) {
  const titleEl = document.getElementById('breakout-result-title');
  const scoreEl = document.getElementById('breakout-result-score');
  const retryBtn = document.getElementById('breakout-retry-btn');
  const nextBtn = document.getElementById('breakout-next-btn');
  if (won) {
    titleEl.textContent = 'Level Clear!';
    titleEl.style.color = '#53d066';
    retryBtn.style.display = 'none';
    nextBtn.style.display = bkLevel < 99 ? 'block' : 'none';
  } else {
    titleEl.textContent = 'You lost!';
    titleEl.style.color = '#ff4444';
    retryBtn.style.display = 'block';
    retryBtn.style.background = '#ff4444';
    nextBtn.style.display = 'none';
  }
  scoreEl.textContent = 'Score: ' + bkScore;
  document.getElementById('breakout-result-overlay').style.display = 'flex';
}

// Paddle control — mouse only when holding
let bkMouseDown = false;
function bkMouseMove(e) {
  if (!bkRunning || bkPaused || !bkMouseDown) return;
  const rect = bkCanvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (BK_W / rect.width);
  bkPaddleTarget = Math.max(0, Math.min(BK_W - bkPaddle.w, mx - bkPaddle.w / 2));
}

function bkTouchHandler(e) {
  if (!bkRunning || bkPaused) return;
  e.preventDefault();
  const touch = e.touches[0];
  const rect = bkCanvas.getBoundingClientRect();
  const mx = (touch.clientX - rect.left) * (BK_W / rect.width);
  bkPaddleTarget = Math.max(0, Math.min(BK_W - bkPaddle.w, mx - bkPaddle.w / 2));
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
  bkCanvas.addEventListener('mousedown', () => { bkMouseDown = true; });
  bkCanvas.addEventListener('mouseup', () => { bkMouseDown = false; });
  bkCanvas.addEventListener('mouseleave', () => { bkMouseDown = false; });
  // Touch controls
  bkCanvas.addEventListener('touchstart', bkTouchHandler, { passive: false });
  bkCanvas.addEventListener('touchmove', bkTouchHandler, { passive: false });
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
  const bh = Math.max(10, Math.floor(h / 6));
  const bw = bh * 2.8;
  const gap = Math.max(2, bh * 0.2);
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

window.mobilePauseBreakout = () => { if (bkRunning && !bkPaused) pauseBreakout(); };

window.cleanupBreakout = () => {
  bkRunning = false; bkPaused = false;
  if (bkAnimId) { cancelAnimationFrame(bkAnimId); bkAnimId = null; }
};
