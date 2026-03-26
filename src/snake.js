// --- Snake game: self-contained with HTML injection ---

// Inject snake HTML into the page
const snakeHTML = `
<div id="menu-backdrop" class="backdrop notebook-bg" role="dialog" aria-modal="true" style="display:none;">
  <div class="menu-win" role="document" aria-label="Difficulty Menu">
    <button class="menu-close" onclick="showInfo()" aria-label="Info">✕</button>
    <div class="menu-title">SNAKEGAME</div>
    <div class="menu-buttons">
      <button class="menu-button" onclick="startGame('easy')">Easy</button>
      <button class="menu-button" onclick="startGame('normal')">Normal</button>
      <button class="menu-button" onclick="startGame('hard')">Hard</button>
      <button class="menu-button" onclick="startGame('impossible')">Impossible</button>
    </div>
  </div>
</div>
<div id="game-backdrop" class="backdrop notebook-bg" role="dialog" aria-modal="true" style="display:none;">
  <div class="win" role="document" aria-label="Snakegame">
    <div class="win-header">
      <div class="win-title">SNAKEGAME</div>
      <div class="win-stats">
        <span id="score-display">Score: 0</span>
        <span id="timer-display">0:00</span>
      </div>
      <div class="win-controls">
        <button class="mobile-pause-btn" onclick="mobilePauseSnake()" aria-label="Pause">☰</button>
        <span class="ctrl min"></span>
        <span class="ctrl max"></span>
      </div>
    </div>
    <div class="win-body">
      <div id="grid" class="grid" aria-hidden="true"></div>
    </div>
  </div>
</div>
<div id="pause-backdrop" class="backdrop" role="dialog" aria-modal="true" style="display:none; z-index:2000;">
  <div class="pause-win" role="document" aria-label="Pause Menu">
    <div class="pause-title">Game Paused</div>
    <div id="pause-score" class="best-score"></div>
    <div id="pause-best" class="best-score"></div>
    <div class="pause-buttons">
      <button class="pause-button" onclick="quitToMenuFromPause()">QUIT</button>
      <button class="pause-button" onclick="resumeGame()">RESUME</button>
    </div>
  </div>
</div>
<div id="gameover-backdrop" class="backdrop" role="dialog" aria-modal="true" style="display:none; z-index:3000;">
  <div class="gameover-win" role="document" aria-label="Game Over">
    <div class="gameover-title">You lost!</div>
    <div id="gameover-score" class="best-score"></div>
    <div id="gameover-best" class="best-score"></div>
    <div class="gameover-buttons">
      <button class="gameover-button" onclick="retryGame()">RETRY</button>
      <button class="gameover-button" onclick="quitToMenu()">MENU</button>
    </div>
  </div>
</div>
<div id="gamewin-backdrop" class="backdrop" role="dialog" aria-modal="true" style="display:none; z-index:3000;">
  <div class="gamewin-win" role="document" aria-label="You Won">
    <div class="gamewin-title">YOU WON!</div>
    <div id="gamewin-score" class="best-score"></div>
    <div id="gamewin-time" class="best-score"></div>
    <div class="gamewin-buttons">
      <button class="gamewin-button" onclick="retryGame()">RETRY</button>
      <button class="gamewin-button" onclick="quitToMenu()">MENU</button>
    </div>
  </div>
</div>`;

document.body.insertAdjacentHTML('beforeend', snakeHTML);

const menuBackdrop = document.getElementById('menu-backdrop');
const gameBackdrop = document.getElementById('game-backdrop');
const pauseBackdrop = document.getElementById('pause-backdrop');
const gameoverBackdrop = document.getElementById('gameover-backdrop');
const gamewinBackdrop = document.getElementById('gamewin-backdrop');

let currentDifficulty = 'normal';
let isPaused = false;
let isGameOver = false;
let savedGameState = null;

let baseInterval = 333;
let normalInterval = baseInterval;
let fastInterval = baseInterval * 0.8;

let dir = { x: 1, y: 0 };
let lastStepDir = { x: 1, y: 0 };
let nextDir = null;
let moveInterval = normalInterval;
let moveTimer = null;
let running = true;
let score = 0;
let timerInterval = null;
let elapsedMs = 0;
let timerStartedAt = 0;
let bestScores = {};
let gameOverTimeout = null;
let snakeSegments = [];
let backBlock = null;
const heldKeys = [];
let lastStepTime = 0;

// --- UI ---

function showMenu() {
  hideGameOver();
  running = false;
  isPaused = true;
  menuBackdrop.style.display = 'flex';
  gameBackdrop.style.display = 'none';
  pauseBackdrop.style.display = 'none';
  gameoverBackdrop.style.display = 'none';
}
window.showSnakeMenu = showMenu;

function showGame() {
  menuBackdrop.style.display = 'none';
  pauseBackdrop.style.display = 'none';
  gameoverBackdrop.style.display = 'none';
  running = true;
  isPaused = false;
  isGameOver = false;
  gameBackdrop.style.display = 'flex';
  startTimer();
}

function showPause() {
  pauseBackdrop.style.display = 'flex';
  isPaused = true;
  if (timerInterval) {
    elapsedMs += performance.now() - timerStartedAt;
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const best = bestScores[currentDifficulty] || 0;
  const el = document.getElementById('pause-best');
  if (el) el.textContent = 'Best (' + currentDifficulty + '): ' + best;
  const scoreEl = document.getElementById('pause-score');
  if (scoreEl) scoreEl.textContent = 'Score: ' + score;
}

function hidePause() { pauseBackdrop.style.display = 'none'; isPaused = false; }
function resumeGame() { hidePause(); startTimer(); }

function quitToMenuFromPause() {
  hidePause(); running = false; isPaused = true; isGameOver = false; savedGameState = null;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  showMenu();
}

function quitToMenu() {
  if (isGameOver) { hideGameOver(); hideGameWin(); } else hidePause();
  running = false; isPaused = true; isGameOver = false; savedGameState = null;
  showMenu();
}

function showGameOver() {
  if (isGameOver) return;
  gameoverBackdrop.style.display = 'flex'; isPaused = true; isGameOver = true;
  if (moveTimer) { clearTimeout(moveTimer); moveTimer = null; }
  if (timerInterval) { elapsedMs += performance.now() - timerStartedAt; clearInterval(timerInterval); timerInterval = null; }
  const prev = bestScores[currentDifficulty] || 0;
  if (score > prev) bestScores[currentDifficulty] = score;
  const scoreEl = document.getElementById('gameover-score');
  if (scoreEl) scoreEl.textContent = 'Score: ' + score;
  const bestEl = document.getElementById('gameover-best');
  if (bestEl) bestEl.textContent = 'Best (' + currentDifficulty + '): ' + (bestScores[currentDifficulty] || 0);
}
function hideGameOver() { gameoverBackdrop.style.display = 'none'; isPaused = false; isGameOver = false; }

function showGameWin() {
  gamewinBackdrop.style.display = 'flex'; isPaused = true; isGameOver = true; running = false;
  if (moveTimer) { clearTimeout(moveTimer); moveTimer = null; }
  if (timerInterval) { elapsedMs += performance.now() - timerStartedAt; clearInterval(timerInterval); timerInterval = null; }
  const scoreEl = document.getElementById('gamewin-score');
  if (scoreEl) scoreEl.textContent = 'Score: ' + score;
  const timeEl = document.getElementById('gamewin-time');
  if (timeEl) {
    const totalSec = Math.floor(elapsedMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = (totalSec % 60).toString().padStart(2, '0');
    timeEl.textContent = m + ':' + s;
  }
}
function hideGameWin() { gamewinBackdrop.style.display = 'none'; isPaused = false; isGameOver = false; }
function retryGame() { hideGameOver(); hideGameWin(); startGame(currentDifficulty); }

// --- Game ---
function startGame(difficulty) { currentDifficulty = difficulty; initGame(); showGame(); }

function initGame() {
  const grid = document.getElementById('grid');
  grid.innerHTML = ''; score = 0; elapsedMs = 0; timerStartedAt = 0;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (gameOverTimeout) { clearTimeout(gameOverTimeout); gameOverTimeout = null; }
  updateScoreDisplay(); updateTimerDisplay();
  dir = { x: 1, y: 0 }; lastStepDir = { x: 1, y: 0 }; running = true; heldKeys.length = 0;
  snakeSegments = []; backBlock = null;
  switch (currentDifficulty) {
    case 'easy': normalInterval = baseInterval * 1.5; break;
    case 'normal': normalInterval = baseInterval; break;
    case 'hard': normalInterval = baseInterval * 0.75; break;
    case 'impossible': normalInterval = baseInterval * 0.5; break;
  }
  fastInterval = normalInterval / 2; moveInterval = normalInterval;
  for (let r = 0; r < 16; r++) for (let c = 0; c < 20; c++) {
    const cell = document.createElement('div'); cell.className = 'cell';
    cell.dataset.row = r; cell.dataset.col = c; grid.appendChild(cell);
  }
  let entityCol = Math.max(0, Math.min(19, Math.floor(20 / 2) - 1));
  let entityRow = Math.max(0, Math.min(15, Math.floor(16 / 2) - 2));
  const entity = document.createElement('div');
  entity.className = 'entity eyes-right'; entity.dataset.row = entityRow; entity.dataset.col = entityCol;
  entity.style.gridColumnStart = (entityCol + 1).toString(); entity.style.gridRowStart = (entityRow + 1).toString();
  grid.appendChild(entity); snakeSegments.push(entity); backBlock = entity;
  createApple(); startMoving();
}

function createApple() {
  const grid = document.getElementById('grid');
  const existing = grid.querySelector('.apple'); if (existing) existing.remove();
  const occupied = new Set();
  snakeSegments.forEach(seg => occupied.add(`${seg.dataset.col},${seg.dataset.row}`));
  let col, row;
  do { col = Math.floor(Math.random() * 20); row = Math.floor(Math.random() * 16); } while (occupied.has(`${col},${row}`));
  const apple = document.createElement('div'); apple.className = 'apple';
  apple.dataset.col = col; apple.dataset.row = row;
  apple.style.gridColumnStart = (col + 1).toString(); apple.style.gridRowStart = (row + 1).toString();
  grid.appendChild(apple);
}

function moveEntity(dx, dy) {
  const head = snakeSegments[0]; if (!head) return false;
  const newCol = parseInt(head.dataset.col, 10) + dx;
  const newRow = parseInt(head.dataset.row, 10) + dy;
  if (newCol < 0 || newCol > 19 || newRow < 0 || newRow > 15) {
    if (!isGameOver) { snakeSegments.forEach(seg => seg.classList.add('collide')); running = false; gameOverTimeout = setTimeout(() => showGameOver(), 400); return true; }
    return false;
  }
  for (let i = 1; i < snakeSegments.length - 1; i++) {
    if (parseInt(snakeSegments[i].dataset.col, 10) === newCol && parseInt(snakeSegments[i].dataset.row, 10) === newRow) {
      if (!isGameOver) {
        for (let j = snakeSegments.length - 1; j > 0; j--) {
          const seg = snakeSegments[j]; const prev = snakeSegments[j - 1];
          seg.dataset.col = prev.dataset.col; seg.dataset.row = prev.dataset.row;
          seg.style.gridColumnStart = prev.style.gridColumnStart; seg.style.gridRowStart = prev.style.gridRowStart;
        }
        head.dataset.col = newCol; head.dataset.row = newRow;
        head.style.gridColumnStart = (newCol + 1).toString(); head.style.gridRowStart = (newRow + 1).toString();
        head.style.zIndex = '10'; snakeSegments.forEach(seg => seg.classList.add('collide'));
        updateEyeDirection(dx, dy); updateTailDirection(); running = false;
        gameOverTimeout = setTimeout(() => showGameOver(), 400);
      }
      return true;
    }
  }
  for (let i = snakeSegments.length - 1; i > 0; i--) {
    const seg = snakeSegments[i]; const prev = snakeSegments[i - 1];
    seg.dataset.col = prev.dataset.col; seg.dataset.row = prev.dataset.row;
    seg.style.gridColumnStart = prev.style.gridColumnStart; seg.style.gridRowStart = prev.style.gridRowStart;
  }
  head.dataset.col = newCol; head.dataset.row = newRow;
  head.style.gridColumnStart = (newCol + 1).toString(); head.style.gridRowStart = (newRow + 1).toString();
  updateEyeDirection(dx, dy); backBlock = snakeSegments[snakeSegments.length - 1]; updateTailDirection();
  checkAppleCollision(); return true;
}

function updateEyeDirection(dx, dy) {
  const head = snakeSegments[0]; if (!head) return;
  head.classList.remove('eyes-right', 'eyes-left', 'eyes-up', 'eyes-down');
  if (dx > 0) head.classList.add('eyes-right'); else if (dx < 0) head.classList.add('eyes-left');
  else if (dy < 0) head.classList.add('eyes-up'); else if (dy > 0) head.classList.add('eyes-down');
}

function updateTailDirection() {
  const tail = snakeSegments[snakeSegments.length - 1]; const prev = snakeSegments[snakeSegments.length - 2];
  if (!tail || !prev) return;
  const tdx = parseInt(prev.dataset.col, 10) - parseInt(tail.dataset.col, 10);
  const tdy = parseInt(prev.dataset.row, 10) - parseInt(tail.dataset.row, 10);
  tail.classList.remove('snake-body'); tail.classList.add('snake-tail');
  tail.classList.remove('tail-right', 'tail-left', 'tail-up', 'tail-down');
  if (tdx > 0) tail.classList.add('tail-right'); else if (tdx < 0) tail.classList.add('tail-left');
  else if (tdy < 0) tail.classList.add('tail-up'); else if (tdy > 0) tail.classList.add('tail-down');
  if (prev !== snakeSegments[0]) { prev.classList.remove('snake-tail', 'tail-right', 'tail-left', 'tail-up', 'tail-down'); prev.classList.add('snake-body'); }
}

function growSnake() {
  score++; updateScoreDisplay();
  const grid = document.getElementById('grid');
  const tail = snakeSegments[snakeSegments.length - 1]; const prev = snakeSegments[snakeSegments.length - 2] || tail;
  const tdx = snakeSegments.length > 1 ? parseInt(tail.dataset.col, 10) - parseInt(prev.dataset.col, 10) : -dir.x;
  const tdy = snakeSegments.length > 1 ? parseInt(tail.dataset.row, 10) - parseInt(prev.dataset.row, 10) : -dir.y;
  const col = parseInt(tail.dataset.col, 10) + tdx; const row = parseInt(tail.dataset.row, 10) + tdy;
  const newBlock = document.createElement('div'); newBlock.className = 'entity snake-body';
  newBlock.dataset.col = col; newBlock.dataset.row = row;
  newBlock.style.gridColumnStart = (col + 1).toString(); newBlock.style.gridRowStart = (row + 1).toString();
  grid.appendChild(newBlock); snakeSegments.push(newBlock); backBlock = newBlock; updateTailDirection();
}

function checkAppleCollision() {
  const head = snakeSegments[0]; const apple = document.getElementById('grid').querySelector('.apple');
  if (!head || !apple) return;
  if (parseInt(head.dataset.col, 10) === parseInt(apple.dataset.col, 10) &&
      parseInt(head.dataset.row, 10) === parseInt(apple.dataset.row, 10)) {
    growSnake(); if (snakeSegments.length >= 320) { showGameWin(); return; } createApple();
  }
}

// --- Movement loop ---
function step() { if (!running || isPaused || isGameOver) return; lastStepDir = { ...dir }; moveEntity(dir.x, dir.y); lastStepTime = performance.now(); }
function scheduleNext(force = false) { if (moveTimer) clearTimeout(moveTimer); const delay = Math.max(0, moveInterval - (performance.now() - lastStepTime)); moveTimer = setTimeout(() => { step(); scheduleNext(); }, force ? moveInterval : delay); }
function setIntervalRate(ms) { if (moveInterval === ms) return; moveInterval = ms; if (moveTimer) scheduleNext(); }
function startMoving() { if (moveTimer) clearTimeout(moveTimer); lastStepTime = performance.now(); scheduleNext(true); }
function updateScoreDisplay() { const el = document.getElementById('score-display'); if (el) el.textContent = 'Score: ' + score; }
function updateTimerDisplay() { const el = document.getElementById('timer-display'); if (!el) return; const totalSec = Math.floor(elapsedMs / 1000); const m = Math.floor(totalSec / 60); const s = (totalSec % 60).toString().padStart(2, '0'); el.textContent = m + ':' + s; }
function startTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } timerStartedAt = performance.now(); timerInterval = setInterval(() => { elapsedMs += performance.now() - timerStartedAt; timerStartedAt = performance.now(); updateTimerDisplay(); }, 200); }

// --- Input ---
let lastEscTime = 0;
function keyToDir(key) {
  if (!key) return null;
  if (key === 'Escape') { const now = performance.now(); if (now - lastEscTime < 200) return null; lastEscTime = now; if (gameBackdrop.style.display !== 'none' && !isGameOver && running) { if (isPaused) resumeGame(); else showPause(); } return null; }
  switch (key) { case 'ArrowUp': case 'w': case 'W': return { x: 0, y: -1 }; case 'ArrowDown': case 's': case 'S': return { x: 0, y: 1 }; case 'ArrowLeft': case 'a': case 'A': return { x: -1, y: 0 }; case 'ArrowRight': case 'd': case 'D': return { x: 1, y: 0 }; }
  return null;
}
function processHeldKeys() { for (let i = heldKeys.length - 1; i >= 0; i--) { const kd = keyToDir(heldKeys[i]); if (!kd) continue; if (kd.x === dir.x && kd.y === dir.y) { setIntervalRate(fastInterval); return; } if (nextDir && kd.x === nextDir.x && kd.y === nextDir.y) { setIntervalRate(fastInterval); return; } break; } setIntervalRate(normalInterval); }
function handleKey(e) {
  if (gameBackdrop.style.display === 'none') return;
  if (e.key === 'Escape' && e.repeat) return;
  const requested = keyToDir(e.key);
  if (requested) { const idx = heldKeys.indexOf(e.key); if (idx !== -1) heldKeys.splice(idx, 1); heldKeys.push(e.key); }
  if (!requested) return;
  const { x: nx, y: ny } = requested;
  if (nx === -lastStepDir.x && ny === -lastStepDir.y) { e.preventDefault(); e.stopPropagation(); return; }
  if (!running || isPaused || isGameOver) { e.preventDefault(); e.stopPropagation(); return; }
  dir = { x: nx, y: ny }; nextDir = null; processHeldKeys(); e.preventDefault(); e.stopPropagation();
}
window.addEventListener('keyup', (e) => { if (gameBackdrop.style.display === 'none') return; const idx = heldKeys.indexOf(e.key); if (idx !== -1) { heldKeys.splice(idx, 1); processHeldKeys(); } }, true);
window.addEventListener('keydown', handleKey, true);
menuBackdrop.addEventListener('click', (e) => { if (e.target === menuBackdrop) { e.stopPropagation(); e.preventDefault(); } });
gameBackdrop.addEventListener('click', (e) => { if (e.target === gameBackdrop) { e.stopPropagation(); e.preventDefault(); } });

// Expose handlers
window.startGame = startGame;
window.retryGame = retryGame;
window.quitToMenu = quitToMenu;
window.quitToMenuFromPause = quitToMenuFromPause;
window.resumeGame = resumeGame;
window.mobilePauseSnake = () => { if (running && !isPaused && !isGameOver) showPause(); };

// --- Swipe controls for mobile ---
let touchStartX = 0, touchStartY = 0;
let touchHolding = false;

gameBackdrop.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchHolding = true;
}, { passive: true });

gameBackdrop.addEventListener('touchmove', (e) => {
  if (!running || isPaused || isGameOver || !touchHolding) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < 20) return;
  let nx, ny;
  if (absDx > absDy) { nx = dx > 0 ? 1 : -1; ny = 0; }
  else { nx = 0; ny = dy > 0 ? 1 : -1; }
  if (nx === -lastStepDir.x && ny === -lastStepDir.y) return;
  dir = { x: nx, y: ny };
  nextDir = null;
  // speed up while holding after swipe
  setIntervalRate(fastInterval);
  // reset start so continued movement works
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

gameBackdrop.addEventListener('touchend', (e) => {
  if (!running || isPaused || isGameOver) { touchHolding = false; return; }
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) >= 20) {
    let nx, ny;
    if (absDx > absDy) { nx = dx > 0 ? 1 : -1; ny = 0; }
    else { nx = 0; ny = dy > 0 ? 1 : -1; }
    if (!(nx === -lastStepDir.x && ny === -lastStepDir.y)) {
      dir = { x: nx, y: ny };
      nextDir = null;
    }
  }
  touchHolding = false;
  setIntervalRate(normalInterval);
});

window.cleanupSnake = () => {
  running = false; isPaused = false; isGameOver = false;
  if (moveTimer) { clearTimeout(moveTimer); moveTimer = null; }
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (gameOverTimeout) { clearTimeout(gameOverTimeout); gameOverTimeout = null; }
  heldKeys.length = 0;
};

// Snake logo generator
function snakeRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function generateSnakeLogo() {
  const canvas = document.getElementById('snake-logo-canvas');
  if (!canvas) return;
  const btn = canvas.parentElement;
  const w = btn.offsetWidth, h = btn.offsetHeight;
  canvas.width = w * 2; canvas.height = h * 2;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  const cs = Math.max(12, Math.floor(h / 3));
  const cols = Math.ceil(w / cs) + 2;
  const rows = 3;
  const gap = Math.max(1, cs * 0.08);
  const snakeColor = 'rgba(83,208,102,0.75)';
  const appleColor = 'rgba(255,68,68,0.7)';

  // build snake path on a grid — stop 4 blocks from right
  const grid = Array.from({length: rows}, () => Array(cols).fill(false));
  const path = []; // [{r,c}]
  let r = 1, lastTurn = 0; // start middle row
  const endCol = Math.max(4, cols - 4);
  for (let c = 0; c < endCol; c++) {
    grid[r][c] = true;
    path.push({r, c});
    // try direction change — minimum 3 cols between turns
    if (c - lastTurn >= 3 && c < endCol - 2 && Math.random() > 0.5) {
      const jump = Math.random() > 0.5 ? 1 : (Math.random() > 0.5 ? 2 : -1);
      const dir = Math.random() > 0.5 ? 1 : -1;
      const steps = Math.abs(jump) === 2 ? 2 : 1;
      let canJump = true;
      for (let s = 1; s <= steps; s++) {
        const checkR = r + dir * s;
        if (checkR < 0 || checkR >= rows || grid[checkR][c]) { canJump = false; break; }
      }
      if (canJump) {
        for (let s = 1; s <= steps; s++) {
          r = r + dir;
          grid[r][c] = true;
          path.push({r, c});
        }
        lastTurn = c;
      }
    }
  }

  // draw body segments (all except last)
  for (let i = 0; i < path.length - 1; i++) {
    ctx.fillStyle = snakeColor;
    snakeRoundRect(ctx, path[i].c * cs + gap, path[i].r * cs + gap, cs - gap * 2, cs - gap * 2, cs * 0.2);
  }

  // draw head (last segment) — same style as in-game entity with eyes
  const head = path[path.length - 1];
  const hx = head.c * cs + gap, hy = head.r * cs + gap;
  const hs = cs - gap * 2;
  ctx.fillStyle = snakeColor;
  snakeRoundRect(ctx, hx, hy, hs, hs, cs * 0.2);
  // eyes — facing right
  const eyeR = hs * 0.09;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(hx + hs * 0.65, hy + hs * 0.3, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + hs * 0.65, hy + hs * 0.7, eyeR, 0, Math.PI * 2); ctx.fill();
  // place apples in empty cells only
  for (let ar = 0; ar < rows; ar++) for (let ac = 0; ac < cols; ac++) {
    if (grid[ar][ac]) continue;
    if (Math.random() > 0.95) {
      const ax = ac * cs, ay = ar * cs;
      const cr = (cs - gap * 2) * 0.35;
      ctx.fillStyle = appleColor;
      ctx.beginPath();
      ctx.arc(ax + cs / 2, ay + cs / 2, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(74,222,128,0.6)';
      ctx.beginPath();
      ctx.ellipse(ax + cs * 0.65, ay + cs * 0.2, cs * 0.1, cs * 0.06, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

window.generateSnakeLogo = generateSnakeLogo;
window.addEventListener('load', () => setTimeout(generateSnakeLogo, 80));
window.addEventListener('resize', generateSnakeLogo);
