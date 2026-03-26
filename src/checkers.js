// Checkers game with AI
// Board: 8x8, pieces on dark squares only
// 'r'=red, 'R'=red king, 'b'=black, 'B'=black king, null=empty

let ckBoard, ckTurn, ckSelected, ckMoves, ckGameOver, ckPaused, ckAiThinking;
let ckPlayerColor = 'r', ckAiColor = 'b', ckDifficulty = 'normal';

function ckInitBoard() {
  const b = Array.from({length:8}, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++)
    if ((r + c) % 2 === 1) b[r][c] = 'b';
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++)
    if ((r + c) % 2 === 1) b[r][c] = 'r';
  return b;
}

function ckClone(b) { return b.map(r => [...r]); }
function ckColor(p) { return p ? p.toLowerCase() : null; }
function ckIsKing(p) { return p === 'R' || p === 'B'; }

function ckGetMoves(board, side) {
  const jumps = [], simple = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (!p || ckColor(p) !== side) continue;
    const dirs = [];
    if (side === 'r' || ckIsKing(p)) dirs.push([-1,-1],[-1,1]);
    if (side === 'b' || ckIsKing(p)) dirs.push([1,-1],[1,1]);
    for (const [dr,dc] of dirs) {
      const nr = r+dr, nc = c+dc;
      if (nr<0||nr>7||nc<0||nc>7) continue;
      if (!board[nr][nc]) simple.push({fr:r,fc:c,tr:nr,tc:nc,jumps:[]});
      else if (ckColor(board[nr][nc]) !== side) {
        const jr = nr+dr, jc = nc+dc;
        if (jr>=0&&jr<8&&jc>=0&&jc<8&&!board[jr][jc])
          jumps.push({fr:r,fc:c,tr:jr,tc:jc,jumps:[{r:nr,c:nc}]});
      }
    }
  }
  // multi-jumps
  if (jumps.length > 0) {
    const expanded = [];
    for (const j of jumps) ckExpandJumps(board, j, side, expanded);
    return expanded;
  }
  return simple;
}

function ckExpandJumps(board, move, side, result) {
  const b = ckClone(board);
  const p = b[move.fr][move.fc];
  b[move.fr][move.fc] = null;
  for (const j of move.jumps) b[j.r][j.c] = null;
  b[move.tr][move.tc] = p;
  // check for more jumps from landing
  const dirs = [];
  if (side === 'r' || ckIsKing(p)) dirs.push([-1,-1],[-1,1]);
  if (side === 'b' || ckIsKing(p)) dirs.push([1,-1],[1,1]);
  let found = false;
  for (const [dr,dc] of dirs) {
    const nr = move.tr+dr, nc = move.tc+dc;
    if (nr<0||nr>7||nc<0||nc>7) continue;
    if (b[nr][nc] && ckColor(b[nr][nc]) !== side) {
      const jr = nr+dr, jc = nc+dc;
      if (jr>=0&&jr<8&&jc>=0&&jc<8&&!b[jr][jc]) {
        found = true;
        ckExpandJumps(board, {fr:move.fr,fc:move.fc,tr:jr,tc:jc,jumps:[...move.jumps,{r:nr,c:nc}]}, side, result);
      }
    }
  }
  if (!found) result.push(move);
}

function ckApplyMove(board, move) {
  const b = ckClone(board);
  const p = b[move.fr][move.fc];
  b[move.fr][move.fc] = null;
  for (const j of move.jumps) b[j.r][j.c] = null;
  // king promotion
  let piece = p;
  if (ckColor(p) === 'r' && move.tr === 0) piece = 'R';
  if (ckColor(p) === 'b' && move.tr === 7) piece = 'B';
  b[move.tr][move.tc] = piece;
  return b;
}

// AI
function ckEvaluate(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (!p) continue;
    const val = ckIsKing(p) ? 3 : 1;
    score += ckColor(p) === ckAiColor ? val : -val;
  }
  return score;
}

function ckMinimax(board, depth, alpha, beta, isMax) {
  const side = isMax ? ckAiColor : ckPlayerColor;
  const moves = ckGetMoves(board, side);
  if (moves.length === 0) return isMax ? -100 : 100;
  if (depth === 0) return ckEvaluate(board);
  if (isMax) {
    let best = -Infinity;
    for (const m of moves) {
      const nb = ckApplyMove(board, m);
      best = Math.max(best, ckMinimax(nb, depth-1, alpha, beta, false));
      alpha = Math.max(alpha, best); if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const nb = ckApplyMove(board, m);
      best = Math.min(best, ckMinimax(nb, depth-1, alpha, beta, true));
      beta = Math.min(beta, best); if (beta <= alpha) break;
    }
    return best;
  }
}

function ckAiMove() {
  let depth;
  switch (ckDifficulty) {
    case 'easy': depth = 0; break;
    case 'normal': depth = 3; break;
    case 'hard': depth = 5; break;
    case 'impossible': depth = 7; break;
    default: depth = 3;
  }
  const moves = ckGetMoves(ckBoard, ckAiColor);
  if (moves.length === 0) return null;
  if (depth === 0) return moves[Math.floor(Math.random() * moves.length)];
  let bestMove = moves[0], bestVal = -Infinity;
  for (const m of moves) {
    const nb = ckApplyMove(ckBoard, m);
    const val = ckMinimax(nb, depth-1, -Infinity, Infinity, false);
    if (val > bestVal) { bestVal = val; bestMove = m; }
  }
  return bestMove;
}

// Rendering
function ckRender() {
  const board = document.getElementById('checkers-board');
  board.innerHTML = '';
  const flipped = ckPlayerColor === 'b';
  for (let ri = 0; ri < 8; ri++) for (let ci = 0; ci < 8; ci++) {
    const r = flipped ? 7-ri : ri, c = flipped ? 7-ci : ci;
    const cell = document.createElement('div');
    cell.className = 'chess-cell ' + ((r+c)%2===0 ? 'light' : 'dark');
    if (ckSelected && ckSelected[0]===r && ckSelected[1]===c) cell.classList.add('selected');
    if (ckMoves.some(m => m.tr===r && m.tc===c)) cell.classList.add('legal-move');
    const p = ckBoard[r][c];
    if (p) {
      const isRed = ckColor(p) === 'r';
      const fill = isRed ? '#fff' : '#222';
      const stroke = isRed ? '#999' : '#000';
      const king = ckIsKing(p);
      cell.innerHTML = `<svg viewBox="0 0 36 36" width="100%" height="100%">
        <circle cx="18" cy="18" r="13" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        ${king ? `<circle cx="18" cy="18" r="7" fill="none" stroke="gold" stroke-width="2"/>` : ''}
      </svg>`;
    }
    cell.addEventListener('click', () => ckClick(r, c));
    board.appendChild(cell);
  }
}

function ckClick(r, c) {
  if (ckGameOver || ckPaused || ckTurn !== ckPlayerColor || ckAiThinking) return;
  const allMoves = ckGetMoves(ckBoard, ckPlayerColor);
  const hasJumps = allMoves.some(m => m.jumps.length > 0);

  if (ckSelected) {
    const move = ckMoves.find(m => m.tr===r && m.tc===c);
    if (move) {
      ckBoard = ckApplyMove(ckBoard, move);
      ckSelected = null; ckMoves = [];
      ckTurn = ckAiColor;
      ckRender(); ckUpdateStatus(); ckCheckEnd();
      if (!ckGameOver) setTimeout(ckDoAi, 300);
      return;
    }
  }
  const p = ckBoard[r][c];
  if (p && ckColor(p) === ckPlayerColor) {
    let pieceMoves = allMoves.filter(m => m.fr===r && m.fc===c);
    if (hasJumps) pieceMoves = pieceMoves.filter(m => m.jumps.length > 0);
    // only select if this piece has valid moves
    if (pieceMoves.length === 0) { ckSelected = null; ckMoves = []; ckRender(); return; }
    ckSelected = [r, c];
    ckMoves = pieceMoves;
    ckRender();
  } else { ckSelected = null; ckMoves = []; ckRender(); }
}

function ckDoAi() {
  if (ckGameOver || ckPaused) return;
  ckAiThinking = true;
  const m = ckAiMove();
  if (!m) { ckAiThinking = false; ckCheckEnd(); return; }
  ckBoard = ckApplyMove(ckBoard, m);
  ckTurn = ckPlayerColor;
  ckAiThinking = false;
  ckRender(); ckUpdateStatus(); ckCheckEnd();
}

function ckUpdateStatus() {
  const el = document.getElementById('checkers-status');
  if (el) el.textContent = ckTurn === ckPlayerColor ? 'Your turn' : 'AI thinking...';
}

function ckCheckEnd() {
  const playerMoves = ckGetMoves(ckBoard, ckPlayerColor);
  const aiMoves = ckGetMoves(ckBoard, ckAiColor);
  if (playerMoves.length > 0 && aiMoves.length > 0) return;
  ckGameOver = true;
  const titleEl = document.getElementById('checkers-result-title');
  const retryBtn = document.getElementById('checkers-retry-btn');
  if (aiMoves.length === 0 && ckTurn === ckAiColor) {
    titleEl.textContent = 'You Won!'; titleEl.style.color = '#53d066'; retryBtn.style.background = '#53d066';
  } else if (playerMoves.length === 0 && ckTurn === ckPlayerColor) {
    titleEl.textContent = 'You Lost!'; titleEl.style.color = '#ff4444'; retryBtn.style.background = '#ff4444';
  } else {
    titleEl.textContent = 'Draw!'; titleEl.style.color = '#555'; retryBtn.style.background = '#888';
  }
  document.getElementById('checkers-result-overlay').style.display = 'flex';
}

// Navigation
function ckInit() {
  ckBoard = ckInitBoard(); ckTurn = 'r'; ckSelected = null; ckMoves = [];
  ckGameOver = false; ckPaused = false; ckAiThinking = false;
  document.getElementById('checkers-result-overlay').style.display = 'none';
  document.getElementById('checkers-pause-overlay').style.display = 'none';
  ckUpdateStatus(); ckRender();
  if (ckPlayerColor !== 'r') setTimeout(ckDoAi, 300);
}

window.showCheckersMenu = () => { document.getElementById('info-backdrop').style.display='none'; document.getElementById('checkers-menu-backdrop').style.display='flex'; };
window.hideCheckersMenu = () => { document.getElementById('checkers-menu-backdrop').style.display='none'; document.getElementById('info-backdrop').style.display='flex'; };
window.startCheckers = (diff) => { ckDifficulty=diff; document.getElementById('checkers-menu-backdrop').style.display='none'; document.getElementById('checkers-color-backdrop').style.display='flex'; };
window.hideCheckersColor = () => { document.getElementById('checkers-color-backdrop').style.display='none'; document.getElementById('checkers-menu-backdrop').style.display='flex'; };
window.startCheckersColor = (col) => { ckPlayerColor=col; ckAiColor=col==='r'?'b':'r'; document.getElementById('checkers-color-backdrop').style.display='none'; document.getElementById('checkers-game-backdrop').style.display='flex'; ckInit(); };
window.quitCheckers = () => { ckGameOver=true; ckPaused=false; document.getElementById('checkers-pause-overlay').style.display='none'; document.getElementById('checkers-result-overlay').style.display='none'; document.getElementById('checkers-game-backdrop').style.display='none'; document.getElementById('checkers-menu-backdrop').style.display='flex'; };
window.resumeCheckers = () => { ckPaused=false; document.getElementById('checkers-pause-overlay').style.display='none'; };
window.retryCheckers = () => { ckInit(); };
window.mobilePauseCheckers = () => { if (!ckGameOver && !ckPaused) { ckPaused=true; document.getElementById('checkers-pause-overlay').style.display='flex'; } };

window.addEventListener('keydown', (e) => {
  const bd = document.getElementById('checkers-game-backdrop');
  if (!bd || bd.style.display==='none') return;
  if (e.key==='Escape') { e.preventDefault(); if (ckPaused) { ckPaused=false; document.getElementById('checkers-pause-overlay').style.display='none'; } else if (!ckGameOver) { ckPaused=true; document.getElementById('checkers-pause-overlay').style.display='flex'; } }
});

// Logo
function generateCheckersLogo() {
  const canvas = document.getElementById('checkers-logo-canvas');
  if (!canvas) return;
  const btn = canvas.parentElement;
  const w = btn.offsetWidth, h = btn.offsetHeight;
  canvas.width = w*2; canvas.height = h*2;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const cs = Math.max(20, Math.floor(h / 3));
  const cols = Math.ceil(w/cs)+1, rows = 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c*cs, y = r*cs;
    ctx.fillStyle = (r+c)%2===0 ? 'rgba(240,217,181,0.5)' : 'rgba(181,136,99,0.5)';
    ctx.fillRect(x, y, cs, cs);
    if ((r+c)%2===1 && Math.random() > 0.5) {
      const isRed = Math.random() > 0.5;
      ctx.fillStyle = isRed ? 'rgba(255,255,255,0.6)' : 'rgba(34,34,34,0.4)';
      ctx.beginPath(); ctx.arc(x+cs/2, y+cs/2, cs*0.35, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = isRed ? 'rgba(153,153,153,0.5)' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
}
window.generateCheckersLogo = generateCheckersLogo;
window.addEventListener('load', () => setTimeout(generateCheckersLogo, 180));
window.addEventListener('resize', generateCheckersLogo);

window.cleanupCheckers = () => {
  ckGameOver = true; ckPaused = false; ckAiThinking = false;
};
