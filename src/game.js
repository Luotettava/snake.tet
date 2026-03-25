const menuBackdrop = document.getElementById('menu-backdrop');
const gameBackdrop = document.getElementById('game-backdrop');
const pauseBackdrop = document.getElementById('pause-backdrop');
const gameoverBackdrop = document.getElementById('gameover-backdrop');

let currentDifficulty = 'normal';
let isPaused = false;
let isGameOver = false;
let savedGameState = null;

let baseInterval = 333;
let normalInterval = baseInterval;
let fastInterval = baseInterval * 0.8;

let dir = { x: 1, y: 0 };
let lastStepDir = { x: 1, y: 0 }; // direction committed on last step — used for reverse check
let nextDir = null;
let moveInterval = normalInterval;
let moveTimer = null;
let running = true;
let score = 0;
let timerInterval = null;
let elapsedMs = 0;       // total elapsed milliseconds
let timerStartedAt = 0;  // performance.now() when timer last started
let bestScores = JSON.parse(localStorage.getItem('snakeBestScores') || '{}');
let gameOverTimeout = null;
let snakeSegments = []; // index 0 = head, last index = backBlock
let backBlock = null;   // tail segment, no eyes
const heldKeys = []; // ordered by press time, last = most recent
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
}

function hidePause() {
  pauseBackdrop.style.display = 'none';
  isPaused = false;
}

function resumeGame() {
  hidePause();
  startTimer();
}

function quitToMenuFromPause() {
  hidePause();
  running = false;
  isPaused = true;
  isGameOver = false;
  savedGameState = null;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  showMenu();
}

function quitToMenu() {
  if (isGameOver) hideGameOver(); else hidePause();
  running = false;
  isPaused = true;
  isGameOver = false;
  savedGameState = null;
  showMenu();
}

function showGameOver() {
  if (isGameOver) return;
  gameoverBackdrop.style.display = 'flex';
  isPaused = true;
  isGameOver = true;
  if (moveTimer) { clearTimeout(moveTimer); moveTimer = null; }
  if (timerInterval) {
    elapsedMs += performance.now() - timerStartedAt;
    clearInterval(timerInterval);
    timerInterval = null;
  }
  // update best score
  const prev = bestScores[currentDifficulty] || 0;
  if (score > prev) {
    bestScores[currentDifficulty] = score;
    localStorage.setItem('snakeBestScores', JSON.stringify(bestScores));
  }
  const scoreEl = document.getElementById('gameover-score');
  if (scoreEl) scoreEl.textContent = 'Score: ' + score;
  const bestEl = document.getElementById('gameover-best');
  if (bestEl) bestEl.textContent = 'Best (' + currentDifficulty + '): ' + bestScores[currentDifficulty];
}

function hideGameOver() {
  gameoverBackdrop.style.display = 'none';
  isPaused = false;
  isGameOver = false;
}

function retryGame() { hideGameOver(); startGame(currentDifficulty); }

// --- Game ---

function startGame(difficulty) {
  currentDifficulty = difficulty;
  initGame();
  showGame();
}

function initGame() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  score = 0;
  elapsedMs = 0;
  timerStartedAt = 0;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (gameOverTimeout) { clearTimeout(gameOverTimeout); gameOverTimeout = null; }
  updateScoreDisplay();
  updateTimerDisplay();
  dir = { x: 1, y: 0 };
  lastStepDir = { x: 1, y: 0 };
  running = true;
  heldKeys.length = 0;
  snakeSegments = [];
  backBlock = null;

  switch (currentDifficulty) {
    case 'easy':       normalInterval = baseInterval * 1.5;  break;
    case 'normal':     normalInterval = baseInterval;         break;
    case 'hard':       normalInterval = baseInterval * 0.75; break;
    case 'impossible': normalInterval = baseInterval * 0.5;  break;
  }
  fastInterval = normalInterval / 2; // 200% speed = 1/2 the interval
  moveInterval = normalInterval;

  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 20; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      grid.appendChild(cell);
    }
  }

  let entityCol = Math.max(0, Math.min(19, Math.floor(20 / 2) - 1));
  let entityRow = Math.max(0, Math.min(15, Math.floor(16 / 2) - 2));
  const entity = document.createElement('div');
  entity.className = 'entity eyes-right';
  entity.dataset.row = entityRow;
  entity.dataset.col = entityCol;
  entity.style.gridColumnStart = (entityCol + 1).toString();
  entity.style.gridRowStart = (entityRow + 1).toString();
  grid.appendChild(entity);

  snakeSegments.push(entity);
  backBlock = entity;

  createApple();
  startMoving();
}

function createApple() {
  const grid = document.getElementById('grid');
  const existing = grid.querySelector('.apple');
  if (existing) existing.remove();

  const occupied = new Set();
  snakeSegments.forEach(seg => occupied.add(`${seg.dataset.col},${seg.dataset.row}`));

  let col, row;
  do {
    col = Math.floor(Math.random() * 20);
    row = Math.floor(Math.random() * 16);
  } while (occupied.has(`${col},${row}`));

  const apple = document.createElement('div');
  apple.className = 'apple';
  apple.dataset.col = col;
  apple.dataset.row = row;
  apple.style.gridColumnStart = (col + 1).toString();
  apple.style.gridRowStart = (row + 1).toString();
  grid.appendChild(apple);
}

function moveEntity(dx, dy) {
  const head = snakeSegments[0];
  if (!head) return false;

  const newCol = parseInt(head.dataset.col, 10) + dx;
  const newRow = parseInt(head.dataset.row, 10) + dy;

  if (newCol < 0 || newCol > 19 || newRow < 0 || newRow > 15) {
    if (!isGameOver) {
      snakeSegments.forEach(seg => seg.classList.add('collide'));
      running = false;
      gameOverTimeout = setTimeout(() => showGameOver(), 400);
      return true;
    }
    return false;
  }

  // self-collision: exclude last segment — it moves away before head arrives
  for (let i = 1; i < snakeSegments.length - 1; i++) {
    if (parseInt(snakeSegments[i].dataset.col, 10) === newCol &&
        parseInt(snakeSegments[i].dataset.row, 10) === newRow) {
      if (!isGameOver) {
        // full body shift — every segment moves to where the one ahead was
        for (let j = snakeSegments.length - 1; j > 0; j--) {
          const seg = snakeSegments[j];
          const prev = snakeSegments[j - 1];
          seg.dataset.col = prev.dataset.col;
          seg.dataset.row = prev.dataset.row;
          seg.style.gridColumnStart = prev.style.gridColumnStart;
          seg.style.gridRowStart = prev.style.gridRowStart;
        }
        // move head onto the collided position on top of everything
        head.dataset.col = newCol;
        head.dataset.row = newRow;
        head.style.gridColumnStart = (newCol + 1).toString();
        head.style.gridRowStart = (newRow + 1).toString();
        head.style.zIndex = '10';
        snakeSegments.forEach(seg => seg.classList.add('collide'));
        updateEyeDirection(dx, dy);
        running = false;
        gameOverTimeout = setTimeout(() => showGameOver(), 400);
      }
      return true;
    }
  }

  // Each segment moves to where the segment ahead of it was (follow-the-leader)
  // Walk from tail to head, shifting positions forward
  const tailPrevCol = parseInt(snakeSegments[snakeSegments.length - 1].dataset.col, 10);
  const tailPrevRow = parseInt(snakeSegments[snakeSegments.length - 1].dataset.row, 10);

  // capture where the tail will move to (current position of segment before tail)
  const tailTargetCol = parseInt(snakeSegments[snakeSegments.length - 2]?.dataset.col ?? snakeSegments[0].dataset.col, 10);
  const tailTargetRow = parseInt(snakeSegments[snakeSegments.length - 2]?.dataset.row ?? snakeSegments[0].dataset.row, 10);

  for (let i = snakeSegments.length - 1; i > 0; i--) {
    const seg = snakeSegments[i];
    const prev = snakeSegments[i - 1];
    seg.dataset.col = prev.dataset.col;
    seg.dataset.row = prev.dataset.row;
    seg.style.gridColumnStart = prev.style.gridColumnStart;
    seg.style.gridRowStart = prev.style.gridRowStart;
  }

  // Move head to new position
  head.dataset.col = newCol;
  head.dataset.row = newRow;
  head.style.gridColumnStart = (newCol + 1).toString();
  head.style.gridRowStart = (newRow + 1).toString();

  updateEyeDirection(dx, dy);
  backBlock = snakeSegments[snakeSegments.length - 1];
  updateTailDirection();

  checkAppleCollision(tailPrevCol, tailPrevRow);
  return true;
}

function updateEyeDirection(dx, dy) {
  const head = snakeSegments[0];
  if (!head) return;
  head.classList.remove('eyes-right', 'eyes-left', 'eyes-up', 'eyes-down');
  if (dx > 0) head.classList.add('eyes-right');
  else if (dx < 0) head.classList.add('eyes-left');
  else if (dy < 0) head.classList.add('eyes-up');
  else if (dy > 0) head.classList.add('eyes-down');
}

function updateTailDirection() {
  const tail = snakeSegments[snakeSegments.length - 1];
  const prev = snakeSegments[snakeSegments.length - 2];
  if (!tail || !prev) return;

  // vector from tail toward the segment ahead of it (big side faces this direction)
  const tdx = parseInt(prev.dataset.col, 10) - parseInt(tail.dataset.col, 10);
  const tdy = parseInt(prev.dataset.row, 10) - parseInt(tail.dataset.row, 10);

  tail.classList.remove('snake-body');
  tail.classList.add('snake-tail');
  tail.classList.remove('tail-right', 'tail-left', 'tail-up', 'tail-down');
  if (tdx > 0) tail.classList.add('tail-right');
  else if (tdx < 0) tail.classList.add('tail-left');
  else if (tdy < 0) tail.classList.add('tail-up');
  else if (tdy > 0) tail.classList.add('tail-down');

  if (prev !== snakeSegments[0]) {
    prev.classList.remove('snake-tail', 'tail-right', 'tail-left', 'tail-up', 'tail-down');
    prev.classList.add('snake-body');
  }
}

function growSnake() {
  score++;
  updateScoreDisplay();
  const grid = document.getElementById('grid');
  const tail = snakeSegments[snakeSegments.length - 1];
  const prev = snakeSegments[snakeSegments.length - 2] || tail;

  // place new block one step behind the tail (opposite of tail's travel direction)
  const tdx = snakeSegments.length > 1
    ? parseInt(tail.dataset.col, 10) - parseInt(prev.dataset.col, 10)
    : -dir.x;
  const tdy = snakeSegments.length > 1
    ? parseInt(tail.dataset.row, 10) - parseInt(prev.dataset.row, 10)
    : -dir.y;
  const col = parseInt(tail.dataset.col, 10) + tdx;
  const row = parseInt(tail.dataset.row, 10) + tdy;

  const newBlock = document.createElement('div');
  newBlock.className = 'entity snake-body';
  newBlock.dataset.col = col;
  newBlock.dataset.row = row;
  newBlock.style.gridColumnStart = (col + 1).toString();
  newBlock.style.gridRowStart = (row + 1).toString();
  grid.appendChild(newBlock);
  snakeSegments.push(newBlock);
  backBlock = newBlock;
  updateTailDirection();
}

function checkAppleCollision(tailPrevCol, tailPrevRow) {
  const head = snakeSegments[0];
  const apple = document.getElementById('grid').querySelector('.apple');
  if (!head || !apple) return;
  if (parseInt(head.dataset.col, 10) === parseInt(apple.dataset.col, 10) &&
      parseInt(head.dataset.row, 10) === parseInt(apple.dataset.row, 10)) {
    growSnake();
    createApple();
  }
}

// --- Movement loop ---

function step() {
  if (!running || isPaused || isGameOver) return;
  lastStepDir = { ...dir };
  const ok = moveEntity(dir.x, dir.y);
  lastStepTime = performance.now();
  if (!ok) console.log('Blocked at boundary');
}

function scheduleNext(force = false) {
  if (moveTimer) clearTimeout(moveTimer);
  if (force) {
    // reschedule from now but still wait the full interval — no instant step
    moveTimer = setTimeout(() => { step(); scheduleNext(); }, moveInterval);
    return;
  }
  const delay = Math.max(0, moveInterval - (performance.now() - lastStepTime));
  moveTimer = setTimeout(() => { step(); scheduleNext(); }, delay);
}

function setIntervalRate(ms) {
  if (moveInterval === ms) return;
  moveInterval = ms;
  if (moveTimer) scheduleNext();
}

function startMoving() {
  if (moveTimer) clearTimeout(moveTimer);
  lastStepTime = performance.now();
  scheduleNext(true);
}

function updateScoreDisplay() {
  const el = document.getElementById('score-display');
  if (el) el.textContent = 'Score: ' + score;
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const totalSec = Math.floor(elapsedMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, '0');
  el.textContent = m + ':' + s;
}

function startTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerStartedAt = performance.now();
  timerInterval = setInterval(() => {
    elapsedMs += performance.now() - timerStartedAt;
    timerStartedAt = performance.now();
    updateTimerDisplay();
  }, 200); // update frequently for accuracy
}

// --- Input ---

let lastEscTime = 0;

function keyToDir(key) {
  if (!key) return null;
  if (key === 'Escape') {
    const now = performance.now();
    if (now - lastEscTime < 200) return null;
    lastEscTime = now;
    if (gameBackdrop.style.display !== 'none' && !isGameOver && running) {
      if (isPaused) { resumeGame(); } else { showPause(); }
    }
    return null;
  }
  switch (key) {
    case 'ArrowUp':  case 'w': case 'W': return { x: 0, y: -1 };
    case 'ArrowDown': case 's': case 'S': return { x: 0, y: 1 };
    case 'ArrowLeft': case 'a': case 'A': return { x: -1, y: 0 };
    case 'ArrowRight': case 'd': case 'D': return { x: 1, y: 0 };
  }
  return null;
}

function processHeldKeys() {
  // walk from most recent to oldest, use first valid direction key
  for (let i = heldKeys.length - 1; i >= 0; i--) {
    const kd = keyToDir(heldKeys[i]);
    if (!kd) continue;
    if (kd.x === dir.x && kd.y === dir.y) { setIntervalRate(fastInterval); return; }
    if (nextDir && kd.x === nextDir.x && kd.y === nextDir.y) { setIntervalRate(fastInterval); return; }
    break; // newest key doesn't match current/queued dir — no acceleration
  }
  setIntervalRate(normalInterval);
}

function handleKey(e) {
  if (e.key === 'Escape' && e.repeat) return; // block held ESC repeat
  const requested = keyToDir(e.key);
  if (requested) {
    const idx = heldKeys.indexOf(e.key);
    if (idx !== -1) heldKeys.splice(idx, 1);
    heldKeys.push(e.key);
  }
  if (!requested) return;
  const { x: nx, y: ny } = requested;
  // block reversal based on last *stepped* direction, not the queued one
  if (nx === -lastStepDir.x && ny === -lastStepDir.y) { e.preventDefault(); e.stopPropagation(); return; }
  if (!running || isPaused || isGameOver) { e.preventDefault(); e.stopPropagation(); return; }

  const isNewDir = nx !== dir.x || ny !== dir.y;
  dir = { x: nx, y: ny };
  nextDir = null;
  processHeldKeys();
  // only reschedule immediately on an actual direction change, not while holding same key
  if (isNewDir) scheduleNext(true);
  e.preventDefault();
  e.stopPropagation();
}

window.addEventListener('keyup', (e) => {
  const idx = heldKeys.indexOf(e.key);
  if (idx !== -1) { heldKeys.splice(idx, 1); processHeldKeys(); }
}, true);
window.addEventListener('keydown', handleKey, true);

menuBackdrop.addEventListener('click', (e) => { if (e.target === menuBackdrop) { e.stopPropagation(); e.preventDefault(); } });
gameBackdrop.addEventListener('click', (e) => { if (e.target === gameBackdrop) { e.stopPropagation(); e.preventDefault(); } });

// Expose button handlers to HTML onclick attributes
window.startGame = startGame;
window.retryGame = retryGame;
window.quitToMenu = quitToMenu;
window.quitToMenuFromPause = quitToMenuFromPause;
window.resumeGame = resumeGame;
window.showInfo = () => {
  document.getElementById('info-backdrop').style.display = 'flex';
  menuBackdrop.style.display = 'none';
};
window.hideInfo = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  showMenu();
};
window.showGenericMenu = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  document.getElementById('generic-menu-backdrop').style.display = 'flex';
};
window.hideGenericMenu = () => {
  document.getElementById('generic-menu-backdrop').style.display = 'none';
  document.getElementById('info-backdrop').style.display = 'flex';
};

// Boot — start on the game selection screen
document.body.classList.add('show-notebook');
document.getElementById('info-backdrop').style.display = 'flex';
menuBackdrop.style.display = 'none';
gameBackdrop.style.display = 'none';
pauseBackdrop.style.display = 'none';
gameoverBackdrop.style.display = 'none';
