// Chess game with AI
// Piece encoding: 'wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP', null=empty

const INIT_BOARD = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR']
];

const PIECE_UNICODE = null; // replaced by SVG rendering

function pieceSVG(piece) {
  const c = color(piece);
  const fill = c === 'w' ? '#fff' : '#222';
  const stroke = c === 'w' ? '#333' : '#000';
  const t = type(piece);
  const s = 28; // half-size
  let path = '';
  switch (t) {
    case 'K': // cross/plus with base
      path = `<rect x="14" y="6" width="8" height="24" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <rect x="8" y="12" width="20" height="8" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <rect x="6" y="28" width="24" height="6" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      break;
    case 'Q': // circle on top of triangle
      path = `<circle cx="18" cy="12" r="7" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <polygon points="8,30 18,16 28,30" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <rect x="6" y="28" width="24" height="6" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      break;
    case 'R': // rectangle tower
      path = `<rect x="8" y="8" width="20" height="20" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <rect x="6" y="6" width="6" height="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
              <rect x="24" y="6" width="6" height="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
              <rect x="6" y="28" width="24" height="6" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      break;
    case 'B': // diamond
      path = `<polygon points="18,6 30,20 18,34 6,20" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <circle cx="18" cy="18" r="3" fill="${stroke}"/>`;
      break;
    case 'N': // L-shape
      path = `<polygon points="10,30 10,10 16,10 16,16 26,16 26,24 20,24 20,30" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <circle cx="13" cy="13" r="2" fill="${stroke}"/>`;
      break;
    case 'P': // simple circle on stick
      path = `<circle cx="18" cy="14" r="7" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <rect x="14" y="20" width="8" height="10" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
              <rect x="10" y="28" width="16" height="5" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      break;
  }
  return `<svg viewBox="0 0 36 36" width="100%" height="100%">${path}</svg>`;
}

const PIECE_VAL = { P:100, N:320, B:330, R:500, Q:900, K:20000 };

let chBoard, chTurn, chSelected, chSelectedMoves, chGameOver, chDifficulty;
let chCastling, chEnPassant, chLastMove, chPaused;
let chPlayerColor = 'w', chAiColor = 'b';
let lastChessDifficulty = 'normal';

function cloneBoard(b) { return b.map(r => [...r]); }
function color(p) { return p ? p[0] : null; }
function type(p) { return p ? p[1] : null; }

function initChess() {
  chBoard = INIT_BOARD.map(r => [...r]);
  chTurn = 'w'; chSelected = null; chSelectedMoves = [];
  chGameOver = false; chPaused = false;
  chCastling = { wK: true, wQ: true, bK: true, bQ: true };
  chEnPassant = null; chLastMove = null;
  document.getElementById('chess-result-overlay').style.display = 'none';
  document.getElementById('chess-pause-overlay').style.display = 'none';
  updateChessStatus();
  renderChess();
  // if player is black, AI (white) moves first
  if (chPlayerColor === 'b') setTimeout(doAiTurn, 300);
}

function renderChess() {
  const board = document.getElementById('chess-board');
  board.innerHTML = '';
  const flipped = chPlayerColor === 'b';
  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const r = flipped ? 7 - ri : ri;
      const c = flipped ? 7 - ci : ci;
      const cell = document.createElement('div');
      const isLight = (r + c) % 2 === 0;
      cell.className = 'chess-cell ' + (isLight ? 'light' : 'dark');
      if (chSelected && chSelected[0] === r && chSelected[1] === c) cell.classList.add('selected');
      if (chSelectedMoves.some(m => m[2] === r && m[3] === c)) cell.classList.add('legal-move');
      if (chLastMove && ((chLastMove[0] === r && chLastMove[1] === c) || (chLastMove[2] === r && chLastMove[3] === c))) cell.classList.add('last-move');
      if (chBoard[r][c] && type(chBoard[r][c]) === 'K' && color(chBoard[r][c]) === chTurn && isInCheck(chBoard, chTurn)) cell.classList.add('in-check');
      if (chBoard[r][c]) cell.innerHTML = pieceSVG(chBoard[r][c]);
      cell.addEventListener('click', () => chessClick(r, c));
      board.appendChild(cell);
    }
  }
}

function updateChessStatus() {
  const el = document.getElementById('chess-status');
  if (!el) return;
  if (chGameOver) return;
  el.textContent = chTurn === chPlayerColor ? 'Your turn' : 'AI thinking...';
}

function pseudoMoves(board, side, castling, enPassant) {
  const moves = [];
  const opp = side === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (!p || color(p) !== side) continue;
    const t = type(p);
    if (t === 'P') {
      const dir = side === 'w' ? -1 : 1;
      const start = side === 'w' ? 6 : 1;
      // forward
      if (r + dir >= 0 && r + dir < 8 && !board[r + dir][c]) {
        moves.push([r, c, r + dir, c]);
        if (r === start && !board[r + 2 * dir][c]) moves.push([r, c, r + 2 * dir, c]);
      }
      // captures
      for (const dc of [-1, 1]) {
        const nc = c + dc, nr = r + dir;
        if (nc < 0 || nc > 7 || nr < 0 || nr > 7) continue;
        if (board[nr][nc] && color(board[nr][nc]) === opp) moves.push([r, c, nr, nc]);
        if (enPassant && enPassant[0] === nr && enPassant[1] === nc) moves.push([r, c, nr, nc, 'ep']);
      }
    } else if (t === 'N') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        if (!board[nr][nc] || color(board[nr][nc]) === opp) moves.push([r, c, nr, nc]);
      }
    } else if (t === 'K') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        if (!board[nr][nc] || color(board[nr][nc]) === opp) moves.push([r, c, nr, nc]);
      }
      // castling
      const row = side === 'w' ? 7 : 0;
      if (r === row && c === 4) {
        if (castling[side + 'K'] && !board[row][5] && !board[row][6] && board[row][7] === side + 'R')
          moves.push([r, c, row, 6, 'castle']);
        if (castling[side + 'Q'] && !board[row][3] && !board[row][2] && !board[row][1] && board[row][0] === side + 'R')
          moves.push([r, c, row, 2, 'castle']);
      }
    } else {
      // sliding pieces: R, B, Q
      const dirs = [];
      if (t === 'R' || t === 'Q') dirs.push([0,1],[0,-1],[1,0],[-1,0]);
      if (t === 'B' || t === 'Q') dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (board[nr][nc]) {
            if (color(board[nr][nc]) === opp) moves.push([r, c, nr, nc]);
            break;
          }
          moves.push([r, c, nr, nc]);
          nr += dr; nc += dc;
        }
      }
    }
  }
  return moves;
}

function makeMove(board, m, castling, enPassant) {
  const b = cloneBoard(board);
  const [r1, c1, r2, c2, special] = m;
  const piece = b[r1][c1];
  const ca = { ...castling };
  let ep = null;

  b[r2][c2] = piece; b[r1][c1] = null;

  // en passant capture
  if (special === 'ep') b[r1][c2] = null;
  // pawn double move — set en passant
  if (type(piece) === 'P' && Math.abs(r2 - r1) === 2) ep = [(r1 + r2) / 2, c1];
  // promotion
  if (type(piece) === 'P' && (r2 === 0 || r2 === 7)) b[r2][c2] = color(piece) + 'Q';
  // castling move rook
  if (special === 'castle') {
    const row = r1;
    if (c2 === 6) { b[row][5] = b[row][7]; b[row][7] = null; }
    if (c2 === 2) { b[row][3] = b[row][0]; b[row][0] = null; }
  }
  // update castling rights
  if (piece === 'wK') { ca.wK = false; ca.wQ = false; }
  if (piece === 'bK') { ca.bK = false; ca.bQ = false; }
  if (r1 === 7 && c1 === 0) ca.wQ = false;
  if (r1 === 7 && c1 === 7) ca.wK = false;
  if (r1 === 0 && c1 === 0) ca.bQ = false;
  if (r1 === 0 && c1 === 7) ca.bK = false;

  return { board: b, castling: ca, enPassant: ep };
}

function findKing(board, side) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
    if (board[r][c] === side + 'K') return [r, c];
  return null;
}

function isAttacked(board, r, c, by) {
  const moves = pseudoMoves(board, by, { wK:false, wQ:false, bK:false, bQ:false }, null);
  return moves.some(m => m[2] === r && m[3] === c);
}

function isInCheck(board, side) {
  const k = findKing(board, side);
  if (!k) return true;
  return isAttacked(board, k[0], k[1], side === 'w' ? 'b' : 'w');
}

function legalMoves(board, side, castling, enPassant) {
  const pseudo = pseudoMoves(board, side, castling, enPassant);
  const legal = [];
  for (const m of pseudo) {
    const { board: nb } = makeMove(board, m, castling, enPassant);
    if (isInCheck(nb, side)) continue;
    // castling through check
    if (m[4] === 'castle') {
      if (isInCheck(board, side)) continue;
      const midC = (m[1] + m[3]) / 2;
      if (isAttacked(board, m[0], midC, side === 'w' ? 'b' : 'w')) continue;
    }
    legal.push(m);
  }
  return legal;
}

// --- AI ---
const PST_PAWN = [
  [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],
  [5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
  [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
];
const PST_KNIGHT = [
  [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],
  [-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
  [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
  [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
];

function evaluate(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (!p) continue;
    const val = PIECE_VAL[type(p)] || 0;
    const sign = color(p) === chAiColor ? 1 : -1;
    let pst = 0;
    if (type(p) === 'P') pst = color(p) === 'b' ? PST_PAWN[r][c] : PST_PAWN[7 - r][c];
    if (type(p) === 'N') pst = color(p) === 'b' ? PST_KNIGHT[r][c] : PST_KNIGHT[7 - r][c];
    score += sign * (val + pst);
  }
  return score;
}

function minimax_ch(board, depth, alpha, beta, isMax, castling, enPassant) {
  const side = isMax ? chAiColor : chPlayerColor;
  const moves = legalMoves(board, side, castling, enPassant);
  if (moves.length === 0) {
    if (isInCheck(board, side)) return isMax ? -99999 : 99999;
    return 0; // stalemate
  }
  if (depth === 0) return evaluate(board);
  if (isMax) {
    let best = -Infinity;
    for (const m of moves) {
      const s = makeMove(board, m, castling, enPassant);
      const val = minimax_ch(s.board, depth - 1, alpha, beta, false, s.castling, s.enPassant);
      best = Math.max(best, val); alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const s = makeMove(board, m, castling, enPassant);
      const val = minimax_ch(s.board, depth - 1, alpha, beta, true, s.castling, s.enPassant);
      best = Math.min(best, val); beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function aiMove() {
  let depth;
  switch (chDifficulty) {
    case 'easy': depth = 0; break;
    case 'normal': depth = 2; break;
    case 'hard': depth = 3; break;
    case 'impossible': depth = 4; break;
    default: depth = 2;
  }
  const moves = legalMoves(chBoard, chAiColor, chCastling, chEnPassant);
  if (moves.length === 0) return null;
  if (depth === 0) return moves[Math.floor(Math.random() * moves.length)];
  let bestMove = moves[0], bestVal = -Infinity;
  for (const m of moves) {
    const s = makeMove(chBoard, m, chCastling, chEnPassant);
    const val = minimax_ch(s.board, depth - 1, -Infinity, Infinity, false, s.castling, s.enPassant);
    if (val > bestVal) { bestVal = val; bestMove = m; }
  }
  return bestMove;
}

// --- Interaction ---
function chessClick(r, c) {
  if (chGameOver || chPaused || chTurn !== chPlayerColor) return;
  const piece = chBoard[r][c];

  // if we have a selected piece, try to move
  if (chSelected) {
    const move = chSelectedMoves.find(m => m[2] === r && m[3] === c);
    if (move) {
      const s = makeMove(chBoard, move, chCastling, chEnPassant);
      chBoard = s.board; chCastling = s.castling; chEnPassant = s.enPassant;
      chLastMove = move;
      chTurn = chAiColor;
      chSelected = null; chSelectedMoves = [];
      updateChessStatus();
      renderChess();
      checkEndCondition();
      if (!chGameOver) setTimeout(doAiTurn, 200);
      return;
    }
  }

  // select a piece
  if (piece && color(piece) === chPlayerColor) {
    chSelected = [r, c];
    chSelectedMoves = legalMoves(chBoard, chPlayerColor, chCastling, chEnPassant).filter(m => m[0] === r && m[1] === c);
    renderChess();
  } else {
    chSelected = null; chSelectedMoves = [];
    renderChess();
  }
}

function doAiTurn() {
  if (chGameOver || chPaused) return;
  const m = aiMove();
  if (!m) { checkEndCondition(); return; }
  const s = makeMove(chBoard, m, chCastling, chEnPassant);
  chBoard = s.board; chCastling = s.castling; chEnPassant = s.enPassant;
  chLastMove = m;
  chTurn = chPlayerColor;
  updateChessStatus();
  renderChess();
  checkEndCondition();
}

function checkEndCondition() {
  const moves = legalMoves(chBoard, chTurn, chCastling, chEnPassant);
  if (moves.length > 0) return;
  chGameOver = true;
  const titleEl = document.getElementById('chess-result-title');
  const retryBtn = document.getElementById('chess-retry-btn');
  if (isInCheck(chBoard, chTurn)) {
    if (chTurn === chPlayerColor) {
      titleEl.textContent = 'Checkmate! You lost.';
      titleEl.style.color = '#ff4444';
      retryBtn.style.background = '#ff4444';
    } else {
      titleEl.textContent = 'Checkmate! You won!';
      titleEl.style.color = '#53d066';
      retryBtn.style.background = '#53d066';
    }
  } else {
    titleEl.textContent = 'Stalemate! Draw.';
    titleEl.style.color = '#555';
    retryBtn.style.background = '#888';
  }
  document.getElementById('chess-result-overlay').style.display = 'flex';
}

// --- Navigation & Pause ---
function pauseChess() { if (chGameOver || chPaused) return; chPaused = true; document.getElementById('chess-pause-overlay').style.display = 'flex'; }
function resumeChess() { chPaused = false; document.getElementById('chess-pause-overlay').style.display = 'none'; }
function quitChess() {
  chGameOver = true; chPaused = false;
  document.getElementById('chess-pause-overlay').style.display = 'none';
  document.getElementById('chess-result-overlay').style.display = 'none';
  document.getElementById('chess-game-backdrop').style.display = 'none';
  document.getElementById('chess-menu-backdrop').style.display = 'flex';
}
function retryChess() { initChess(); }

window.showChessMenu = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  document.getElementById('chess-menu-backdrop').style.display = 'flex';
};
window.hideChessMenu = () => {
  document.getElementById('chess-menu-backdrop').style.display = 'none';
  document.getElementById('info-backdrop').style.display = 'flex';
};
window.startChess = (diff) => {
  chDifficulty = diff; lastChessDifficulty = diff;
  document.getElementById('chess-menu-backdrop').style.display = 'none';
  document.getElementById('chess-color-backdrop').style.display = 'flex';
};
window.hideChessColor = () => {
  document.getElementById('chess-color-backdrop').style.display = 'none';
  document.getElementById('chess-menu-backdrop').style.display = 'flex';
};
window.startChessColor = (col) => {
  chPlayerColor = col;
  chAiColor = col === 'w' ? 'b' : 'w';
  document.getElementById('chess-color-backdrop').style.display = 'none';
  document.getElementById('chess-game-backdrop').style.display = 'flex';
  initChess();
};
window.quitChess = quitChess;
window.resumeChess = resumeChess;
window.retryChess = retryChess;
window.mobilePauseChess = () => { if (!chGameOver && !chPaused) pauseChess(); };

window.addEventListener('keydown', (e) => {
  const bd = document.getElementById('chess-game-backdrop');
  if (!bd || bd.style.display === 'none') return;
  if (e.key === 'Escape') { e.preventDefault(); if (chPaused) resumeChess(); else pauseChess(); }
});

// Logo
function drawLogoPiece(ctx, x, y, s, pieceType, isWhite) {
  const fill = isWhite ? 'rgba(255,255,255,0.6)' : 'rgba(40,40,40,0.5)';
  const stroke = isWhite ? 'rgba(80,80,80,0.5)' : 'rgba(0,0,0,0.4)';
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  const cx = x + s / 2, cy = y + s / 2;
  const u = s * 0.35;
  switch (pieceType) {
    case 'K': // cross
      ctx.fillRect(cx - u * 0.25, cy - u, u * 0.5, u * 1.6); ctx.strokeRect(cx - u * 0.25, cy - u, u * 0.5, u * 1.6);
      ctx.fillRect(cx - u * 0.6, cy - u * 0.4, u * 1.2, u * 0.5); ctx.strokeRect(cx - u * 0.6, cy - u * 0.4, u * 1.2, u * 0.5);
      ctx.fillRect(cx - u * 0.7, cy + u * 0.5, u * 1.4, u * 0.35); ctx.strokeRect(cx - u * 0.7, cy + u * 0.5, u * 1.4, u * 0.35);
      break;
    case 'Q': // circle + triangle
      ctx.beginPath(); ctx.arc(cx, cy - u * 0.4, u * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - u * 0.7, cy + u * 0.7); ctx.lineTo(cx, cy - u * 0.1); ctx.lineTo(cx + u * 0.7, cy + u * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'R': // tower
      ctx.fillRect(cx - u * 0.6, cy - u * 0.5, u * 1.2, u * 1.2); ctx.strokeRect(cx - u * 0.6, cy - u * 0.5, u * 1.2, u * 1.2);
      ctx.fillRect(cx - u * 0.7, cy - u * 0.8, u * 0.35, u * 0.35); ctx.strokeRect(cx - u * 0.7, cy - u * 0.8, u * 0.35, u * 0.35);
      ctx.fillRect(cx + u * 0.35, cy - u * 0.8, u * 0.35, u * 0.35); ctx.strokeRect(cx + u * 0.35, cy - u * 0.8, u * 0.35, u * 0.35);
      break;
    case 'B': // diamond
      ctx.beginPath(); ctx.moveTo(cx, cy - u); ctx.lineTo(cx + u * 0.7, cy); ctx.lineTo(cx, cy + u); ctx.lineTo(cx - u * 0.7, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'N': // L-shape
      ctx.beginPath(); ctx.moveTo(cx - u * 0.5, cy + u * 0.7); ctx.lineTo(cx - u * 0.5, cy - u * 0.7); ctx.lineTo(cx, cy - u * 0.7); ctx.lineTo(cx, cy - u * 0.2); ctx.lineTo(cx + u * 0.5, cy - u * 0.2); ctx.lineTo(cx + u * 0.5, cy + u * 0.2); ctx.lineTo(cx + u * 0.1, cy + u * 0.2); ctx.lineTo(cx + u * 0.1, cy + u * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'P': // circle on stick
      ctx.beginPath(); ctx.arc(cx, cy - u * 0.3, u * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillRect(cx - u * 0.2, cy + u * 0.05, u * 0.4, u * 0.5); ctx.strokeRect(cx - u * 0.2, cy + u * 0.05, u * 0.4, u * 0.5);
      ctx.fillRect(cx - u * 0.45, cy + u * 0.5, u * 0.9, u * 0.25); ctx.strokeRect(cx - u * 0.45, cy + u * 0.5, u * 0.9, u * 0.25);
      break;
  }
}

function generateChessLogo() {
  const canvas = document.getElementById('chess-logo-canvas');
  if (!canvas) return;
  const btn = canvas.parentElement;
  const w = btn.offsetWidth, h = btn.offsetHeight;
  canvas.width = w * 2; canvas.height = h * 2;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const cellSize = 36;
  const cols = Math.ceil(w / cellSize) + 1;
  const rows = Math.ceil(h / cellSize) + 1;
  const types = ['K','Q','R','B','N','P'];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cellSize, y = r * cellSize;
    ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(240,217,181,0.5)' : 'rgba(181,136,99,0.5)';
    ctx.fillRect(x, y, cellSize, cellSize);
    if (Math.random() > 0.6) {
      const pt = types[Math.floor(Math.random() * types.length)];
      drawLogoPiece(ctx, x, y, cellSize, pt, Math.random() > 0.5);
    }
  }
}
window.generateChessLogo = generateChessLogo;
window.addEventListener('load', () => setTimeout(generateChessLogo, 160));
window.addEventListener('resize', generateChessLogo);
