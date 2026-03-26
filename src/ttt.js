// Tic Tac Toe game logic
let tttBoard = Array(9).fill(null);
let tttPlayer = 'X';
let tttAI = 'O';
let tttGameOver = false;
let tttDifficulty = 'normal';
let lastTttDifficulty = 'normal';
let tttWins = 0;
let tttPaused = false;

function initTttGrid() {
  const grid = document.getElementById('ttt-grid');
  grid.innerHTML = '';
  tttBoard = Array(9).fill(null);
  tttGameOver = false;
  tttPaused = false;
  document.getElementById('ttt-status').textContent = 'Your turn (X)';
  document.getElementById('ttt-result-overlay').style.display = 'none';
  document.getElementById('ttt-pause-overlay').style.display = 'none';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'ttt-cell';
    cell.dataset.idx = i;
    cell.addEventListener('click', () => tttCellClick(i));
    grid.appendChild(cell);
  }
}

function tttCellClick(idx) {
  if (tttGameOver || tttPaused || tttBoard[idx] !== null) return;
  tttBoard[idx] = tttPlayer;
  renderTttBoard();
  const win = checkTttWin(tttBoard);
  if (win) { endTtt(win); return; }
  if (tttBoard.every(c => c !== null)) { endTtt('draw'); return; }
  // AI turn
  document.getElementById('ttt-status').textContent = 'AI thinking...';
  setTimeout(() => {
    const move = tttAIMove();
    if (move !== -1) {
      tttBoard[move] = tttAI;
      renderTttBoard();
      const win2 = checkTttWin(tttBoard);
      if (win2) { endTtt(win2); return; }
      if (tttBoard.every(c => c !== null)) { endTtt('draw'); return; }
    }
    document.getElementById('ttt-status').textContent = 'Your turn (X)';
  }, 300);
}

function renderTttBoard() {
  const cells = document.getElementById('ttt-grid').children;
  for (let i = 0; i < 9; i++) {
    cells[i].className = 'ttt-cell' + (tttBoard[i] === 'X' ? ' ttt-x' : tttBoard[i] === 'O' ? ' ttt-o' : '');
    if (tttBoard[i] === 'X') {
      cells[i].innerHTML = `<svg viewBox="0 0 100 100" width="65%" height="65%" style="filter:drop-shadow(0 2px 4px rgba(33,150,243,0.3))">
        <defs><linearGradient id="xg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="rgba(66,165,245,0.8)"/><stop offset="100%" stop-color="rgba(25,118,210,0.6)"/></linearGradient></defs>
        <line x1="18" y1="18" x2="82" y2="82" stroke="url(#xg)" stroke-width="16" stroke-linecap="round"/>
        <line x1="82" y1="18" x2="18" y2="82" stroke="url(#xg)" stroke-width="16" stroke-linecap="round"/>
      </svg>`;
    } else if (tttBoard[i] === 'O') {
      cells[i].innerHTML = `<svg viewBox="0 0 100 100" width="65%" height="65%" style="filter:drop-shadow(0 2px 4px rgba(244,67,54,0.3))">
        <defs><linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="rgba(239,83,80,0.8)"/><stop offset="100%" stop-color="rgba(211,47,47,0.6)"/></linearGradient></defs>
        <circle cx="50" cy="50" r="33" fill="none" stroke="url(#og)" stroke-width="14"/>
      </svg>`;
    } else {
      cells[i].innerHTML = '';
    }
  }
}

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function checkTttWin(board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function tttAIMove() {
  const empty = tttBoard.map((v,i) => v === null ? i : -1).filter(i => i !== -1);
  if (empty.length === 0) return -1;

  if (tttDifficulty === 'easy') {
    // random move
    return empty[Math.floor(Math.random() * empty.length)];
  }
  if (tttDifficulty === 'normal') {
    // block wins, otherwise random
    return tttSmartMove(0.4);
  }
  if (tttDifficulty === 'hard') {
    return tttSmartMove(0.8);
  }
  // impossible — minimax
  return tttBestMove();
}

function tttSmartMove(smartChance) {
  if (Math.random() < smartChance) return tttBestMove();
  const empty = tttBoard.map((v,i) => v === null ? i : -1).filter(i => i !== -1);
  return empty[Math.floor(Math.random() * empty.length)];
}

function tttBestMove() {
  let bestScore = -Infinity;
  let bestIdx = -1;
  for (let i = 0; i < 9; i++) {
    if (tttBoard[i] !== null) continue;
    tttBoard[i] = tttAI;
    const s = minimax(tttBoard, false);
    tttBoard[i] = null;
    if (s > bestScore) { bestScore = s; bestIdx = i; }
  }
  return bestIdx;
}

function minimax(board, isMax) {
  const win = checkTttWin(board);
  if (win === tttAI) return 1;
  if (win === tttPlayer) return -1;
  if (board.every(c => c !== null)) return 0;
  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = tttAI;
      best = Math.max(best, minimax(board, false));
      board[i] = null;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = tttPlayer;
      best = Math.min(best, minimax(board, true));
      board[i] = null;
    }
    return best;
  }
}

function endTtt(result) {
  tttGameOver = true;
  const titleEl = document.getElementById('ttt-result-title');
  const winEl = document.getElementById('ttt-result-win');
  const retryBtn = document.getElementById('ttt-retry-btn');
  const quitBtn = document.getElementById('ttt-quit-btn');
  if (result === 'X') {
    tttWins++;
    updateTttWins();
    titleEl.textContent = 'YOU WON!';
    titleEl.style.color = '#53d066';
    retryBtn.style.background = '#53d066';
    quitBtn.style.background = '#53d066';
  } else if (result === 'O') {
    titleEl.textContent = 'You lost!';
    titleEl.style.color = '#ff4444';
    retryBtn.style.background = '#ff4444';
    quitBtn.style.background = '#ff4444';
  } else {
    titleEl.textContent = 'Draw!';
    titleEl.style.color = '#555';
    retryBtn.style.background = '#888';
    quitBtn.style.background = '#888';
  }
  document.getElementById('ttt-result-overlay').style.display = 'flex';
  const winsEl = document.getElementById('ttt-result-wins');
  if (winsEl) winsEl.textContent = 'Total Wins (' + tttDifficulty + '): ' + tttWins;
}

function updateTttWins() {
  const el = document.getElementById('ttt-wins-display');
  if (el) el.textContent = 'Wins: ' + tttWins;
}

function retryTtt() {
  initTttGrid();
}

function quitTtt() {
  document.getElementById('ttt-game-backdrop').style.display = 'none';
  document.getElementById('ttt-menu-backdrop').style.display = 'flex';
}

window.showTttMenu = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  document.getElementById('ttt-menu-backdrop').style.display = 'flex';
};
window.hideTttMenu = () => {
  document.getElementById('ttt-menu-backdrop').style.display = 'none';
  document.getElementById('info-backdrop').style.display = 'flex';
};
window.startTtt = (difficulty) => {
  tttDifficulty = difficulty;
  if (difficulty !== lastTttDifficulty) tttWins = 0;
  lastTttDifficulty = difficulty;
  document.getElementById('ttt-menu-backdrop').style.display = 'none';
  document.getElementById('ttt-game-backdrop').style.display = 'flex';
  updateTttWins();
  initTttGrid();
};
window.retryTtt = retryTtt;
window.quitTtt = quitTtt;

function pauseTtt() {
  if (tttGameOver || tttPaused) return;
  tttPaused = true;
  const winsEl = document.getElementById('ttt-pause-wins');
  if (winsEl) winsEl.textContent = 'Wins (' + tttDifficulty + '): ' + tttWins;
  document.getElementById('ttt-pause-overlay').style.display = 'flex';
}

function resumeTtt() {
  tttPaused = false;
  document.getElementById('ttt-pause-overlay').style.display = 'none';
}

window.resumeTtt = resumeTtt;

window.addEventListener('keydown', (e) => {
  const tttBackdrop = document.getElementById('ttt-game-backdrop');
  if (!tttBackdrop || tttBackdrop.style.display === 'none') return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (tttPaused) resumeTtt();
    else pauseTtt();
  }
});

// TTT logo generator for game selection button
function generateTttLogo() {
  const canvas = document.getElementById('ttt-logo-canvas');
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

  const cellSize = Math.floor(h / 3);
  const cols = Math.ceil(w / cellSize) + 1;
  const rows = 3;
  const xColor = 'rgba(33,150,243,0.5)';
  const oColor = 'rgba(244,67,54,0.5)';

  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, cellSize * 0.08);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;
      const isX = (r + c) % 2 === 0;
      const size = cellSize * 0.32;

      if (isX) {
        // draw X
        ctx.strokeStyle = xColor;
        ctx.beginPath();
        ctx.moveTo(cx - size, cy - size);
        ctx.lineTo(cx + size, cy + size);
        ctx.moveTo(cx + size, cy - size);
        ctx.lineTo(cx - size, cy + size);
        ctx.stroke();
      } else {
        // draw O
        ctx.strokeStyle = oColor;
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

window.generateTttLogo = generateTttLogo;
window.addEventListener('load', () => setTimeout(generateTttLogo, 120));
window.addEventListener('resize', generateTttLogo);

window.mobilePauseTtt = () => { if (!tttGameOver && !tttPaused) pauseTtt(); };
