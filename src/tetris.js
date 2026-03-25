// Tetris game logic
const TETRIS_COLS = 14;
const TETRIS_ROWS = 22;

const SHAPES = {
  I: [[1,1,1,1]],
  I5: [[1,1,1,1,1]],
  O: [[1,1],[1,1]],
  O3: [[1,1,1],[1,1,1],[1,1,1]],
  T: [[0,1,0],[1,1,1]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  L: [[1,0],[1,0],[1,1]],
  J: [[0,1],[0,1],[1,1]],
  P: [[1,1],[1,0]],
  U: [[1,0,1],[1,1,1]],
  X: [[0,1,0],[1,1,1],[0,1,0]]
};
const SHAPE_COLORS = [
  '0,188,212', '255,235,59', '156,39,176', '76,175,80',
  '244,67,54', '255,152,0', '33,150,243', '233,30,99',
  '139,195,74', '255,87,34', '0,131,143', '253,216,53',
  '103,58,183', '0,150,136', '255,193,7'
];

function randomColor() {
  return SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)];
}
const SHAPE_KEYS = Object.keys(SHAPES);

let tetrisBoard = [];
let tetrisCurrent = null; // { shape, color, row, col }
let tetrisNext = null; // next piece preview
let tetrisTimer = null;
let tetrisRunning = false;
let tetrisScore = 0;
let tetrisElapsed = 0;
let tetrisTimerStart = 0;
let tetrisClockInterval = null;
let tetrisSpeed = 500;
let tetrisPaused = false;
let tetrisGameOver = false;

function initTetrisBoard() {
  tetrisBoard = [];
  for (let r = 0; r < TETRIS_ROWS; r++) {
    tetrisBoard.push(new Array(TETRIS_COLS).fill(null));
  }
}

function randomShape() {
  const key = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
  return { shape: SHAPES[key].map(r => [...r]), color: randomColor() };
}

function rotateCW(matrix) {
  const rows = matrix.length, cols = matrix[0].length;
  const result = [];
  for (let c = 0; c < cols; c++) {
    const newRow = [];
    for (let r = rows - 1; r >= 0; r--) {
      newRow.push(matrix[r][c]);
    }
    result.push(newRow);
  }
  return result;
}

function canPlace(shape, row, col) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nr = row + r, nc = col + c;
      if (nr < 0 || nr >= TETRIS_ROWS || nc < 0 || nc >= TETRIS_COLS) return false;
      if (tetrisBoard[nr][nc]) return false;
    }
  }
  return true;
}

function spawnPiece() {
  if (!tetrisNext) tetrisNext = randomShape();
  const { shape, color } = tetrisNext;
  tetrisNext = randomShape();
  renderNextPiece();
  const col = Math.floor((TETRIS_COLS - shape[0].length) / 2);
  if (!canPlace(shape, 0, col)) {
    tetrisGameOver = true;
    tetrisRunning = false;
    if (tetrisTimer) { clearInterval(tetrisTimer); tetrisTimer = null; }
    if (tetrisClockInterval) {
      tetrisElapsed += performance.now() - tetrisTimerStart;
      clearInterval(tetrisClockInterval);
      tetrisClockInterval = null;
    }
    const scoreEl = document.getElementById('tetris-gameover-score');
    if (scoreEl) scoreEl.textContent = 'Score: ' + tetrisScore;
    const timeEl = document.getElementById('tetris-gameover-time');
    if (timeEl) {
      const totalSec = Math.floor(tetrisElapsed / 1000);
      const m = Math.floor(totalSec / 60);
      const s = (totalSec % 60).toString().padStart(2, '0');
      timeEl.textContent = 'Time: ' + m + ':' + s;
    }
    document.getElementById('tetris-gameover-overlay').style.display = 'flex';
    return;
  }
  tetrisCurrent = { shape, color, row: 0, col };
}

function renderNextPiece() {
  const container = document.getElementById('tetris-next-preview');
  if (!container) return;
  container.innerHTML = '';
  if (!tetrisNext) return;
  const { shape, color } = tetrisNext;
  const rows = shape.length;
  const cols = shape[0].length;
  const cellSize = 28;
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  grid.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
  grid.style.gap = '2px';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.style.width = cellSize + 'px';
      cell.style.height = cellSize + 'px';
      cell.style.borderRadius = '4px';
      if (shape[r][c]) {
        cell.style.background = `linear-gradient(135deg, rgba(${color},0.85) 0%, rgba(${color},0.7) 100%)`;
        cell.style.boxShadow = `inset 0 0 0 2px rgba(${color},0.25), inset 0 1px 2px rgba(255,255,255,0.4)`;
      } else {
        cell.style.background = 'transparent';
      }
      grid.appendChild(cell);
    }
  }
  container.appendChild(grid);
}

function lockPiece() {
  const { shape, color, row, col } = tetrisCurrent;
  let cells = 0;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        tetrisBoard[row + r][col + c] = color;
        cells++;
      }
    }
  }
  tetrisScore += cells;
  updateTetrisScore();
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
    if (tetrisBoard[r].every(cell => cell !== null)) {
      tetrisBoard.splice(r, 1);
      tetrisBoard.unshift(new Array(TETRIS_COLS).fill(null));
      cleared++;
      r++; // recheck same row
    }
  }
  if (cleared > 0) {
    tetrisScore += [0, 100, 300, 500, 800][cleared] || cleared * 200;
    updateTetrisScore();
  }
}

function moveDown() {
  if (!tetrisCurrent || !tetrisRunning || tetrisPaused) return;
  if (canPlace(tetrisCurrent.shape, tetrisCurrent.row + 1, tetrisCurrent.col)) {
    tetrisCurrent.row++;
  } else {
    lockPiece();
  }
  renderTetris();
}

function moveLeft() {
  if (!tetrisCurrent || !tetrisRunning || tetrisPaused) return;
  if (canPlace(tetrisCurrent.shape, tetrisCurrent.row, tetrisCurrent.col - 1)) {
    tetrisCurrent.col--;
    renderTetris();
  }
}

function moveRight() {
  if (!tetrisCurrent || !tetrisRunning || tetrisPaused) return;
  if (canPlace(tetrisCurrent.shape, tetrisCurrent.row, tetrisCurrent.col + 1)) {
    tetrisCurrent.col++;
    renderTetris();
  }
}

function hardDrop() {
  if (!tetrisCurrent || !tetrisRunning || tetrisPaused) return;
  while (canPlace(tetrisCurrent.shape, tetrisCurrent.row + 1, tetrisCurrent.col)) {
    tetrisCurrent.row++;
  }
  lockPiece();
  renderTetris();
}

function rotatePiece() {
  if (!tetrisCurrent || !tetrisRunning || tetrisPaused) return;
  const rotated = rotateCW(tetrisCurrent.shape);
  if (canPlace(rotated, tetrisCurrent.row, tetrisCurrent.col)) {
    tetrisCurrent.shape = rotated;
  } else if (canPlace(rotated, tetrisCurrent.row, tetrisCurrent.col - 1)) {
    tetrisCurrent.shape = rotated;
    tetrisCurrent.col--;
  } else if (canPlace(rotated, tetrisCurrent.row, tetrisCurrent.col + 1)) {
    tetrisCurrent.shape = rotated;
    tetrisCurrent.col++;
  }
  renderTetris();
}

function renderTetris() {
  const grid = document.getElementById('tetris-grid');
  if (!grid) return;
  const cells = grid.querySelectorAll('.cell');
  // clear all
  cells.forEach(cell => { cell.style.background = 'transparent'; cell.style.boxShadow = 'none'; });
  // draw locked pieces
  for (let r = 0; r < TETRIS_ROWS; r++) {
    for (let c = 0; c < TETRIS_COLS; c++) {
      if (tetrisBoard[r][c]) {
        const idx = r * TETRIS_COLS + c;
        if (cells[idx]) {
          cells[idx].style.background = `linear-gradient(135deg, rgba(${tetrisBoard[r][c]},0.85) 0%, rgba(${tetrisBoard[r][c]},0.7) 100%)`;
          cells[idx].style.boxShadow = `inset 0 0 0 2px rgba(${tetrisBoard[r][c]},0.25), inset 0 1px 2px rgba(255,255,255,0.4)`;
        }
      }
    }
  }
  // draw current piece
  if (tetrisCurrent) {
    const { shape, color, row, col } = tetrisCurrent;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const idx = (row + r) * TETRIS_COLS + (col + c);
          if (cells[idx]) {
            cells[idx].style.background = `linear-gradient(135deg, rgba(${color},0.85) 0%, rgba(${color},0.7) 100%)`;
            cells[idx].style.boxShadow = `inset 0 0 0 2px rgba(${color},0.25), inset 0 1px 2px rgba(255,255,255,0.4)`;
          }
        }
      }
    }
  }
}

function updateTetrisScore() {
  const el = document.getElementById('tetris-score-display');
  if (el) el.textContent = 'Score: ' + tetrisScore;
}

function updateTetrisTimer() {
  const el = document.getElementById('tetris-timer-display');
  if (!el) return;
  const totalSec = Math.floor(tetrisElapsed / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, '0');
  el.textContent = m + ':' + s;
}

function startTetrisGame(difficulty) {
  tetrisScore = 0;
  tetrisElapsed = 0;
  tetrisPaused = false;
  tetrisGameOver = false;
  tetrisRunning = true;
  tetrisNext = null;

  switch (difficulty) {
    case 'easy': tetrisSpeed = 480; break;
    case 'normal': tetrisSpeed = 369; break;
    case 'hard': tetrisSpeed = 320; break;
    case 'impossible': tetrisSpeed = 240; break;
  }

  initTetrisBoard();
  updateTetrisScore();
  updateTetrisTimer();

  // build grid cells if needed
  const grid = document.getElementById('tetris-grid');
  if (grid.children.length === 0) {
    for (let r = 0; r < TETRIS_ROWS; r++) {
      for (let c = 0; c < TETRIS_COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        grid.appendChild(cell);
      }
    }
  }

  spawnPiece();
  renderTetris();

  if (tetrisTimer) clearInterval(tetrisTimer);
  tetrisTimer = setInterval(moveDown, tetrisSpeed);

  tetrisTimerStart = performance.now();
  if (tetrisClockInterval) clearInterval(tetrisClockInterval);
  tetrisClockInterval = setInterval(() => {
    tetrisElapsed += performance.now() - tetrisTimerStart;
    tetrisTimerStart = performance.now();
    updateTetrisTimer();
  }, 200);
}

// keyboard handler for tetris
function tetrisKeyHandler(e) {
  const tetrisBackdrop = document.getElementById('tetris-game-backdrop');
  if (!tetrisBackdrop || tetrisBackdrop.style.display === 'none') return;

  if (e.key === 'Escape') {
    e.preventDefault();
    if (tetrisPaused) resumeTetris();
    else pauseTetris();
    return;
  }

  if (!tetrisRunning || tetrisPaused || tetrisGameOver) return;

  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': moveLeft(); e.preventDefault(); break;
    case 'ArrowRight': case 'd': case 'D': moveRight(); e.preventDefault(); break;
    case 'ArrowDown': case 's': case 'S': moveDown(); e.preventDefault(); break;
    case 'ArrowUp': case 'w': case 'W': case ' ': rotatePiece(); e.preventDefault(); break;
    case 'Enter': hardDrop(); e.preventDefault(); break;
  }
}

window.addEventListener('keydown', tetrisKeyHandler);

// expose startTetris to replace the old stub
window.startTetris = (difficulty) => {
  lastTetrisDifficulty = difficulty;
  document.getElementById('tetris-menu-backdrop').style.display = 'none';
  document.getElementById('tetris-game-backdrop').style.display = 'flex';
  startTetrisGame(difficulty);
};

function pauseTetris() {
  if (!tetrisRunning || tetrisPaused || tetrisGameOver) return;
  tetrisPaused = true;
  if (tetrisTimer) { clearInterval(tetrisTimer); tetrisTimer = null; }
  if (tetrisClockInterval) {
    tetrisElapsed += performance.now() - tetrisTimerStart;
    clearInterval(tetrisClockInterval);
    tetrisClockInterval = null;
  }
  const scoreEl = document.getElementById('tetris-pause-score');
  if (scoreEl) scoreEl.textContent = 'Score: ' + tetrisScore;
  document.getElementById('tetris-pause-overlay').style.display = 'flex';
}

function resumeTetris() {
  tetrisPaused = false;
  document.getElementById('tetris-pause-overlay').style.display = 'none';
  tetrisTimerStart = performance.now();
  tetrisClockInterval = setInterval(() => {
    tetrisElapsed += performance.now() - tetrisTimerStart;
    tetrisTimerStart = performance.now();
    updateTetrisTimer();
  }, 200);
  tetrisTimer = setInterval(moveDown, tetrisSpeed);
}

function quitTetris() {
  tetrisRunning = false;
  tetrisPaused = false;
  tetrisGameOver = false;
  if (tetrisTimer) { clearInterval(tetrisTimer); tetrisTimer = null; }
  if (tetrisClockInterval) { clearInterval(tetrisClockInterval); tetrisClockInterval = null; }
  document.getElementById('tetris-pause-overlay').style.display = 'none';
  document.getElementById('tetris-game-backdrop').style.display = 'none';
  document.getElementById('tetris-menu-backdrop').style.display = 'flex';
}

window.resumeTetris = resumeTetris;
window.quitTetris = quitTetris;

let lastTetrisDifficulty = 'normal';

function retryTetris() {
  document.getElementById('tetris-gameover-overlay').style.display = 'none';
  startTetrisGame(lastTetrisDifficulty);
}

function quitTetrisFromGameover() {
  document.getElementById('tetris-gameover-overlay').style.display = 'none';
  document.getElementById('tetris-game-backdrop').style.display = 'none';
  document.getElementById('tetris-menu-backdrop').style.display = 'flex';
}

window.retryTetris = retryTetris;
window.quitTetrisFromGameover = quitTetrisFromGameover;

// Tetris logo generator for game selection button
function generateTetrisLogo() {
  const canvas = document.getElementById('tetris-logo-canvas');
  if (!canvas) return;
  const btn = canvas.parentElement;
  const w = btn.offsetWidth;
  const h = btn.offsetHeight;
  canvas.width = w * 2;
  canvas.height = h * 2;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  const cellSize = 44;
  const cols = Math.ceil(w / cellSize) + 4;
  const rows = Math.ceil(h / cellSize);
  const colors = [
    'rgba(0,188,212,0.7)', 'rgba(255,235,59,0.7)', 'rgba(156,39,176,0.7)',
    'rgba(76,175,80,0.7)', 'rgba(244,67,54,0.7)', 'rgba(255,152,0,0.7)',
    'rgba(33,150,243,0.7)', 'rgba(233,30,99,0.7)', 'rgba(139,195,74,0.7)',
    'rgba(255,87,34,0.7)', 'rgba(0,131,143,0.7)', 'rgba(103,58,183,0.7)'
  ];

  const logoShapes = [
    [[1,1,1,1]],
    [[1,1],[1,1]],
    [[0,1,0],[1,1,1]],
    [[0,1,1],[1,1,0]],
    [[1,1,0],[0,1,1]],
    [[1,0],[1,0],[1,1]],
    [[0,1],[0,1],[1,1]],
    [[1,1,1],[1,1,1],[1,1,1]],
    [[1,1,1,1,1]]
  ];

  // fill grid with random pieces
  const grid = [];
  for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(null));

  function tryPlace(shape, sr, sc, color) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nr = sr + r, nc = sc + c;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false;
        if (grid[nr][nc]) return false;
      }
    }
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) grid[sr + r][sc + c] = color;
      }
    }
    return true;
  }

  // scatter pieces across the grid
  for (let attempt = 0; attempt < 200; attempt++) {
    const shape = logoShapes[Math.floor(Math.random() * logoShapes.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const sr = Math.floor(Math.random() * rows);
    const sc = Math.floor(Math.random() * cols);
    tryPlace(shape, sr, sc, color);
  }

  // render
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) {
        const x = c * cellSize;
        const y = r * cellSize;
        ctx.fillStyle = grid[r][c];
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, cellSize - 2, cellSize - 2, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
}

// run on load and resize
window.generateTetrisLogo = generateTetrisLogo;
window.addEventListener('load', () => setTimeout(generateTetrisLogo, 100));
window.addEventListener('resize', generateTetrisLogo);

window.mobilePauseTetris = () => { if (tetrisRunning && !tetrisPaused && !tetrisGameOver) pauseTetris(); };
