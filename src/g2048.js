// 2048 game
const G_SIZE = 4;
const TILE_COLORS = {
  0:'#cdc1b4', 2:'#eee4da', 4:'#ede0c8', 8:'#f2b179', 16:'#f59563',
  32:'#f67c5f', 64:'#f65e3b', 128:'#edcf72', 256:'#edcc61',
  512:'#edc850', 1024:'#edc53f', 2048:'#edc22e'
};
const TILE_TEXT = {
  0:'', 2:'#776e65', 4:'#776e65', 8:'#f9f6f2', 16:'#f9f6f2',
  32:'#f9f6f2', 64:'#f9f6f2', 128:'#f9f6f2', 256:'#f9f6f2',
  512:'#f9f6f2', 1024:'#f9f6f2', 2048:'#f9f6f2'
};

let gBoard, gScore, gBest2048 = 0, gOver, gWon, gPaused;
let gPrevBoard = null, gMerged = new Set();

function gInit() {
  gBoard = Array.from({length:G_SIZE}, () => Array(G_SIZE).fill(0));
  gScore = 0; gOver = false; gWon = false; gPaused = false;
  gPrevBoard = null;
  document.getElementById('g2048-result-overlay').style.display = 'none';
  document.getElementById('g2048-pause-overlay').style.display = 'none';
  gSpawn(); gSpawn(); gRender(); gUpdateScore();
}

function gSpawn() {
  const empty = [];
  for (let r = 0; r < G_SIZE; r++) for (let c = 0; c < G_SIZE; c++)
    if (gBoard[r][c] === 0) empty.push([r,c]);
  if (empty.length === 0) return;
  const [r,c] = empty[Math.floor(Math.random() * empty.length)];
  gBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function gSlide(row) {
  let a = row.filter(v => v !== 0);
  const res = [];
  let scored = 0;
  for (let i = 0; i < a.length; i++) {
    if (i + 1 < a.length && a[i] === a[i+1]) {
      res.push(a[i] * 2);
      scored += a[i] * 2;
      i++;
    } else res.push(a[i]);
  }
  while (res.length < G_SIZE) res.push(0);
  return { row: res, scored };
}

function gMove(dir) {
  if (gOver || gPaused) return false;
  let moved = false, scored = 0;
  const b = gBoard.map(r => [...r]);

  if (dir === 'left') {
    for (let r = 0; r < G_SIZE; r++) {
      const s = gSlide(b[r]);
      if (s.row.some((v,i) => v !== b[r][i])) moved = true;
      b[r] = s.row; scored += s.scored;
    }
  } else if (dir === 'right') {
    for (let r = 0; r < G_SIZE; r++) {
      const s = gSlide([...b[r]].reverse());
      const nr = s.row.reverse();
      if (nr.some((v,i) => v !== b[r][i])) moved = true;
      b[r] = nr; scored += s.scored;
    }
  } else if (dir === 'up') {
    for (let c = 0; c < G_SIZE; c++) {
      const col = [b[0][c],b[1][c],b[2][c],b[3][c]];
      const s = gSlide(col);
      if (s.row.some((v,i) => v !== b[i][c])) moved = true;
      for (let r = 0; r < G_SIZE; r++) b[r][c] = s.row[r];
      scored += s.scored;
    }
  } else if (dir === 'down') {
    for (let c = 0; c < G_SIZE; c++) {
      const col = [b[3][c],b[2][c],b[1][c],b[0][c]];
      const s = gSlide(col);
      const nr = s.row.reverse();
      if (nr.some((v,i) => v !== b[i][c])) moved = true;
      for (let r = 0; r < G_SIZE; r++) b[r][c] = nr[r];
      scored += s.scored;
    }
  }

  if (moved) {
    gBoard = b; gScore += scored;
    gSpawn(); gRender(); gUpdateScore();
    gPrevBoard = b.map(r => [...r]);
    // check win
    for (let r = 0; r < G_SIZE; r++) for (let c = 0; c < G_SIZE; c++)
      if (gBoard[r][c] === 2048 && !gWon) { gWon = true; gEnd(true); return true; }
    // check lose
    if (gIsStuck()) gEnd(false);
  }
  return moved;
}

function gIsStuck() {
  for (let r = 0; r < G_SIZE; r++) for (let c = 0; c < G_SIZE; c++) {
    if (gBoard[r][c] === 0) return false;
    if (c+1 < G_SIZE && gBoard[r][c] === gBoard[r][c+1]) return false;
    if (r+1 < G_SIZE && gBoard[r][c] === gBoard[r+1][c]) return false;
  }
  return true;
}

function gRender() {
  const grid = document.getElementById('g2048-grid');
  grid.innerHTML = '';
  for (let r = 0; r < G_SIZE; r++) for (let c = 0; c < G_SIZE; c++) {
    const v = gBoard[r][c];
    const cell = document.createElement('div');
    cell.className = 'g2048-cell';
    cell.style.background = TILE_COLORS[v] || '#3c3a32';
    cell.style.color = TILE_TEXT[v] || '#f9f6f2';
    cell.style.fontSize = v >= 1024 ? '28px' : v >= 128 ? '34px' : '42px';
    if (v) cell.textContent = v;
    // animate new tiles
    if (v && gPrevBoard && gPrevBoard[r][c] === 0) cell.classList.add('pop');
    // animate merged tiles
    if (v && gPrevBoard && gPrevBoard[r][c] !== 0 && gPrevBoard[r][c] !== v) cell.classList.add('merge');
    grid.appendChild(cell);
  }
}

function gUpdateScore() {
  document.getElementById('g2048-score').textContent = 'Score: ' + gScore;
  if (gScore > gBest2048) gBest2048 = gScore;
  document.getElementById('g2048-best').textContent = 'Best: ' + gBest2048;
}

function gEnd(won) {
  gOver = !won; // if won, allow continuing
  const titleEl = document.getElementById('g2048-result-title');
  const scoreEl = document.getElementById('g2048-result-score');
  const retryBtn = document.getElementById('g2048-retry-btn');
  if (won) {
    titleEl.textContent = 'You reached 2048!';
    titleEl.style.color = '#53d066';
    retryBtn.style.background = '#53d066';
  } else {
    titleEl.textContent = 'Game Over!';
    titleEl.style.color = '#ff4444';
    retryBtn.style.background = '#ff4444';
  }
  scoreEl.textContent = 'Score: ' + gScore;
  document.getElementById('g2048-result-overlay').style.display = 'flex';
}

// Input
window.addEventListener('keydown', (e) => {
  const bd = document.getElementById('g2048-game-backdrop');
  if (!bd || bd.style.display === 'none') return;
  if (e.key === 'Escape') { e.preventDefault(); if (gPaused) resume2048(); else if (!gOver) { gPaused = true; document.getElementById('g2048-pause-score').textContent = 'Score: ' + gScore; document.getElementById('g2048-pause-overlay').style.display = 'flex'; } return; }
  if (gPaused) return;
  let dir = null;
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break;
    case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
    case 'ArrowUp': case 'w': case 'W': dir = 'up'; break;
    case 'ArrowDown': case 's': case 'S': dir = 'down'; break;
  }
  if (dir) { e.preventDefault(); gMove(dir); }
});

// Swipe
let g2048tx = 0, g2048ty = 0;
document.addEventListener('touchstart', (e) => {
  const bd = document.getElementById('g2048-game-backdrop');
  if (!bd || bd.style.display === 'none') return;
  g2048tx = e.touches[0].clientX; g2048ty = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  const bd = document.getElementById('g2048-game-backdrop');
  if (!bd || bd.style.display === 'none' || gPaused) return;
  const dx = e.changedTouches[0].clientX - g2048tx;
  const dy = e.changedTouches[0].clientY - g2048ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
  if (Math.abs(dx) > Math.abs(dy)) gMove(dx > 0 ? 'right' : 'left');
  else gMove(dy > 0 ? 'down' : 'up');
});

// Navigation
window.show2048 = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  document.getElementById('g2048-game-backdrop').style.display = 'flex';
  gInit();
};
function resume2048() { gPaused = false; document.getElementById('g2048-pause-overlay').style.display = 'none'; }
function quit2048() {
  gOver = true; gPaused = false;
  document.getElementById('g2048-pause-overlay').style.display = 'none';
  document.getElementById('g2048-result-overlay').style.display = 'none';
  document.getElementById('g2048-game-backdrop').style.display = 'none';
  document.getElementById('info-backdrop').style.display = 'flex';
}
function retry2048() { gInit(); }
window.quit2048 = quit2048;
window.resume2048 = resume2048;
window.retry2048 = retry2048;
window.mobilePause2048 = () => { if (!gOver && !gPaused) { gPaused = true; document.getElementById('g2048-pause-score').textContent = 'Score: ' + gScore; document.getElementById('g2048-pause-overlay').style.display = 'flex'; } };
window.cleanup2048 = () => { gOver = true; gPaused = false; };

// Logo
function generate2048Logo() {
  const canvas = document.getElementById('g2048-logo-canvas');
  if (!canvas) return;
  const btn = canvas.parentElement;
  const w = btn.offsetWidth, h = btn.offsetHeight;
  canvas.width = w * 2; canvas.height = h * 2;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const cs = Math.max(20, Math.floor(h / 3));
  const gap = Math.max(2, cs * 0.06);
  const cols = Math.ceil(w / (cs + gap)) + 1;
  const vals = [2,4,8,16,32,64,128,256,512,1024,2048];
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
    const x = c * (cs + gap), y = r * (cs + gap);
    const v = vals[Math.floor(Math.random() * vals.length)];
    ctx.fillStyle = (TILE_COLORS[v] || '#3c3a32') + '99';
    ctx.beginPath(); ctx.roundRect(x, y, cs, cs, 4); ctx.fill();
    ctx.fillStyle = (TILE_TEXT[v] || '#f9f6f2') + '66';
    ctx.font = `bold ${cs * 0.35}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(v, x + cs / 2, y + cs / 2);
  }
}
window.generate2048Logo = generate2048Logo;
window.addEventListener('load', () => setTimeout(generate2048Logo, 200));
window.addEventListener('resize', generate2048Logo);
