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
let nextDir = null;
let moveInterval = normalInterval;
let moveTimer = null;
let running = true;
let snakeSegments = []; // index 0 = head, last index = backBlock
let backBlock = null;   // tail segment, no eyes
const heldKeys = new Set();
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
}

function showPause() {
  pauseBackdrop.style.display = 'flex';
  isPaused = true;
}

function hidePause() {
  pauseBackdrop.style.display = 'none';
  isPaused = false;
}

function resumeGame() { hidePause(); }

function quitToMenuFromPause() {
  hidePause();
  running = false;
  isPaused = true;
  isGameOver = false;
  savedGameState = null;
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
  dir = { x: 1, y: 0 };
  nextDir = null;
  running = true;
  heldKeys.clear();
  snakeSegments = [];
  backBlock = null;

  switch (currentDifficulty) {
    case 'easy':       normalInterval = baseInterval * 1.5;  fastInterval = baseInterval * 1.35; break;
    case 'normal':     normalInterval = baseInterval;         fastInterval = baseInterval * 0.85; break;
    case 'hard':       normalInterval = baseInterval * 0.75; fastInterval = baseInterval * 0.65; break;
    case 'impossible': normalInterval = baseInterval * 0.5;  fastInterval = baseInterval * 0.4;  break;
  }
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

  const col = parseInt(head.dataset.col, 10);
  const row = parseInt(head.dataset.row, 10);
  const newCol = col + dx;
  const newRow = row + dy;

  if (newCol < 0 || newCol > 19 || newRow < 0 || newRow > 15) {
    if (!isGameOver) { showGameOver(); running = false; return true; }
    return false;
  }

  const tail = snakeSegments[snakeSegments.length - 1];
  tail.dataset.col = newCol;
  tail.dataset.row = newRow;
  tail.style.gridColumnStart = (newCol + 1).toString();
  tail.style.gridRowStart = (newRow + 1).toString();

  snakeSegments.pop();
  snakeSegments.unshift(tail);

  const oldHead = snakeSegments[1];
  if (oldHead) {
    oldHead.classList.remove('eyes-right', 'eyes-left', 'eyes-up', 'eyes-down');
    oldHead.classList.add('snake-body');
  }

  tail.classList.remove('snake-body');
  updateEyeDirection(dx, dy);
  backBlock = snakeSegments[snakeSegments.length - 1];

  checkAppleCollision();
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

function growSnake() {
  const grid = document.getElementById('grid');
  const currentTail = snakeSegments[snakeSegments.length - 1];
  const newBlock = document.createElement('div');
  newBlock.className = 'entity snake-body';
  newBlock.dataset.col = currentTail.dataset.col;
  newBlock.dataset.row = currentTail.dataset.row;
  newBlock.style.gridColumnStart = currentTail.style.gridColumnStart;
  newBlock.style.gridRowStart = currentTail.style.gridRowStart;
  grid.appendChild(newBlock);
  snakeSegments.push(newBlock);
  backBlock = newBlock;
}

function checkAppleCollision() {
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
  if (nextDir) { dir = nextDir; nextDir = null; }
  const ok = moveEntity(dir.x, dir.y);
  lastStepTime = performance.now();
  if (!ok) console.log('Blocked at boundary');
}

function scheduleNext(force = false) {
  const now = performance.now();
  if (force) {
    if (moveTimer) clearTimeout(moveTimer);
    moveTimer = setTimeout(() => { step(); scheduleNext(); }, 0);
    return;
  }
  const delay = Math.max(0, moveInterval - (now - lastStepTime));
  if (moveTimer) clearTimeout(moveTimer);
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

// --- Input ---

function keyToDir(key) {
  if (!key) return null;
  if (key === 'Escape') {
    if (gameBackdrop.style.display !== 'none' && !isPaused) showPause();
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
  for (const k of heldKeys) {
    const kd = keyToDir(k);
    if (!kd) continue;
    if (kd.x === dir.x && kd.y === dir.y) { setIntervalRate(fastInterval); return; }
    if (nextDir && kd.x === nextDir.x && kd.y === nextDir.y) { setIntervalRate(fastInterval); return; }
  }
  setIntervalRate(normalInterval);
}

function handleKey(e) {
  const requested = keyToDir(e.key);
  if (requested) heldKeys.add(e.key);
  if (!requested) return;
  const { x: nx, y: ny } = requested;
  if (nx === -dir.x && ny === -dir.y) { e.preventDefault(); e.stopPropagation(); return; }
  if (!nextDir && !(nx === -dir.x && ny === -dir.y)) nextDir = { x: nx, y: ny };
  processHeldKeys();
  e.preventDefault();
  e.stopPropagation();
}

window.addEventListener('keyup', (e) => {
  if (heldKeys.has(e.key)) { heldKeys.delete(e.key); processHeldKeys(); }
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

// Boot
showMenu();
