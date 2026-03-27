// Air Hockey — player vs AI
const HK_W = 700, HK_H = 900;
const HK_PR = 30, HK_BR = 15, HK_GOAL_W = 140;
const HK_WIN_SCORE = 7;

let hkPlayer, hkAI, hkBall, hkPlayerScore, hkAIScore;
let hkRunning, hkPaused, hkAnimId, hkDifficulty, hkCanvas, hkCtx;
let hkMouseY = HK_H * 0.75, hkMouseX = HK_W / 2;
let hkPlayerPrevX = HK_W / 2, hkPlayerPrevY = HK_H * 0.75;
let hkAIPrevX = HK_W / 2, hkAIPrevY = HK_H * 0.2;

function hkInit() {
  hkCanvas = document.getElementById('hockey-canvas');
  hkCtx = hkCanvas.getContext('2d');
  hkPlayerScore = 0; hkAIScore = 0; hkRunning = true; hkPaused = false;
  hkResetPositions();
  document.getElementById('hockey-result-overlay').style.display = 'none';
  document.getElementById('hockey-pause-overlay').style.display = 'none';
  hkUpdateScore();
  if (hkAnimId) cancelAnimationFrame(hkAnimId);
  hkLoop();
}

function hkResetPositions() {
  hkPlayer = { x: HK_W/2, y: HK_H * 0.8, r: HK_PR };
  hkAI = { x: HK_W/2, y: HK_H * 0.2, r: HK_PR };
  let ballSpeed;
  switch (hkDifficulty) {
    case 'easy': ballSpeed = 2; break;
    case 'normal': ballSpeed = 3; break;
    case 'hard': ballSpeed = 4.5; break;
    case 'impossible': ballSpeed = 6; break;
    default: ballSpeed = 3;
  }
  hkBall = { x: HK_W/2, y: HK_H/2, dx: (Math.random()-0.5)*ballSpeed, dy: ballSpeed, r: HK_BR };
}

function hkUpdateScore() {
  const el = document.getElementById('hockey-score');
  if (el) el.textContent = hkAIScore + ' - ' + hkPlayerScore;
}

function hkLoop() {
  if (!hkRunning) return;
  if (!hkPaused) { hkUpdate(); hkDraw(); }
  hkAnimId = requestAnimationFrame(hkLoop);
}

function hkUpdate() {
  const b = hkBall;
  b.x += b.dx; b.y += b.dy;
  // friction
  b.dx *= 0.999; b.dy *= 0.999;

  // wall bounce
  if (b.x - b.r < 0) { b.x = b.r; b.dx = Math.abs(b.dx); }
  if (b.x + b.r > HK_W) { b.x = HK_W - b.r; b.dx = -Math.abs(b.dx); }

  // goals — top and bottom center
  const goalL = (HK_W - HK_GOAL_W) / 2, goalR = goalL + HK_GOAL_W;

  // top wall / AI goal
  if (b.y - b.r < 0) {
    if (b.x > goalL && b.x < goalR) {
      hkPlayerScore++; hkUpdateScore();
      if (hkPlayerScore >= HK_WIN_SCORE) { hkRunning = false; hkEnd(true); return; }
      hkResetPositions(); return;
    }
    b.y = b.r; b.dy = Math.abs(b.dy);
  }
  // bottom wall / player goal
  if (b.y + b.r > HK_H) {
    if (b.x > goalL && b.x < goalR) {
      hkAIScore++; hkUpdateScore();
      if (hkAIScore >= HK_WIN_SCORE) { hkRunning = false; hkEnd(false); return; }
      hkResetPositions(); return;
    }
    b.y = HK_H - b.r; b.dy = -Math.abs(b.dy);
  }

  // player paddle — snap to mouse position, constrained to bottom half
  hkPlayerPrevX = hkPlayer.x; hkPlayerPrevY = hkPlayer.y;
  const targetX = Math.max(HK_PR, Math.min(HK_W - HK_PR, hkMouseX));
  const targetY = Math.max(HK_H/2 + HK_PR, Math.min(HK_H - HK_PR, hkMouseY));
  hkPlayer.x += (targetX - hkPlayer.x) * 0.8;
  hkPlayer.y += (targetY - hkPlayer.y) * 0.8;

  // AI paddle — aim to hit ball toward player goal (bottom center)
  hkAIPrevX = hkAI.x; hkAIPrevY = hkAI.y;
  let aiSpeed;
  switch (hkDifficulty) {
    case 'easy': aiSpeed = 0.025; break;
    case 'normal': aiSpeed = 0.05; break;
    case 'hard': aiSpeed = 0.08; break;
    case 'impossible': aiSpeed = 0.14; break;
    default: aiSpeed = 0.05;
  }
  let aiTargetX, aiTargetY;
  if (b.y < HK_H / 2) {
    // ball in AI half — position behind ball to push it toward player goal
    const goalCenterX = HK_W / 2;
    const offsetX = (b.x - goalCenterX) * 0.3;
    aiTargetX = b.x - offsetX;
    aiTargetY = b.y - HK_PR * 1.2; // get behind the ball
  } else {
    // ball in player half — return to defensive position
    aiTargetX = HK_W / 2;
    aiTargetY = HK_H * 0.18;
  }
  hkAI.x += (aiTargetX - hkAI.x) * aiSpeed;
  hkAI.y += (aiTargetY - hkAI.y) * aiSpeed;
  hkAI.x = Math.max(HK_PR, Math.min(HK_W - HK_PR, hkAI.x));
  hkAI.y = Math.max(HK_PR, Math.min(HK_H/2 - HK_PR, hkAI.y));

  // paddle-ball collision with paddle velocity
  hkPaddleCollide(hkPlayer, hkPlayer.x - hkPlayerPrevX, hkPlayer.y - hkPlayerPrevY);
  hkPaddleCollide(hkAI, hkAI.x - hkAIPrevX, hkAI.y - hkAIPrevY);

  // clamp ball inside bounds
  b.x = Math.max(b.r, Math.min(HK_W - b.r, b.x));
  b.y = Math.max(b.r, Math.min(HK_H - b.r, b.y));
  // cap max speed
  const maxSpd = 12;
  const spd = Math.sqrt(b.dx*b.dx + b.dy*b.dy);
  if (spd > maxSpd) { b.dx *= maxSpd/spd; b.dy *= maxSpd/spd; }
}

function hkPaddleCollide(p, pvx, pvy) {
  const b = hkBall;
  const dx = b.x - p.x, dy = b.y - p.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < p.r + b.r && dist > 0) {
    const angle = Math.atan2(dy, dx);
    // base speed from ball + paddle velocity contribution
    const ballSpeed = Math.sqrt(b.dx*b.dx + b.dy*b.dy);
    const paddleSpeed = Math.sqrt(pvx*pvx + pvy*pvy);
    const newSpeed = Math.max(ballSpeed, 3) + paddleSpeed * 0.6;
    b.dx = Math.cos(angle) * newSpeed;
    b.dy = Math.sin(angle) * newSpeed;
    // push ball out of paddle
    const overlap = p.r + b.r - dist + 1;
    b.x += Math.cos(angle) * overlap;
    b.y += Math.sin(angle) * overlap;
  }
}

function hkDraw() {
  const ctx = hkCtx;
  // table background
  ctx.fillStyle = 'rgba(30,100,60,0.3)';
  ctx.fillRect(0, 0, HK_W, HK_H);
  // center line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2; ctx.setLineDash([8,8]);
  ctx.beginPath(); ctx.moveTo(0, HK_H/2); ctx.lineTo(HK_W, HK_H/2); ctx.stroke();
  ctx.setLineDash([]);
  // center circle
  ctx.beginPath(); ctx.arc(HK_W/2, HK_H/2, 60, 0, Math.PI*2); ctx.stroke();
  // goals
  const goalL = (HK_W - HK_GOAL_W) / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(goalL, 0, HK_GOAL_W, 6);
  ctx.fillRect(goalL, HK_H - 6, HK_GOAL_W, 6);

  // AI paddle
  ctx.save();
  ctx.shadowColor = 'rgba(244,67,54,0.3)'; ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(244,67,54,0.7)';
  ctx.beginPath(); ctx.arc(hkAI.x, hkAI.y, hkAI.r, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  // player paddle
  ctx.save();
  ctx.shadowColor = 'rgba(33,150,243,0.3)'; ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(33,150,243,0.7)';
  ctx.beginPath(); ctx.arc(hkPlayer.x, hkPlayer.y, hkPlayer.r, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  // ball
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(hkBall.x, hkBall.y, hkBall.r, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function hkEnd(won) {
  const titleEl = document.getElementById('hockey-result-title');
  const scoreEl = document.getElementById('hockey-result-score');
  titleEl.textContent = won ? 'You Won!' : 'You Lost!';
  titleEl.style.color = won ? '#53d066' : '#ff4444';
  scoreEl.textContent = hkAIScore + ' - ' + hkPlayerScore;
  document.getElementById('hockey-result-overlay').style.display = 'flex';
}

// Input — mouse follows anywhere over the game area
function hkMouseHandler(e) {
  const rect = hkCanvas.getBoundingClientRect();
  hkMouseX = (e.clientX - rect.left) * (HK_W / rect.width);
  hkMouseY = (e.clientY - rect.top) * (HK_H / rect.height);
}
function hkTouchHandler(e) {
  e.preventDefault();
  const rect = hkCanvas.getBoundingClientRect();
  hkMouseX = (e.touches[0].clientX - rect.left) * (HK_W / rect.width);
  hkMouseY = (e.touches[0].clientY - rect.top) * (HK_H / rect.height);
}

// Navigation
window.showHockeyMenu = () => { document.getElementById('info-backdrop').style.display = 'none'; document.getElementById('hockey-menu-backdrop').style.display = 'flex'; };
window.hideHockeyMenu = () => { document.getElementById('hockey-menu-backdrop').style.display = 'none'; document.getElementById('info-backdrop').style.display = 'flex'; };
window.startHockey = (diff) => {
  hkDifficulty = diff;
  document.getElementById('hockey-menu-backdrop').style.display = 'none';
  document.getElementById('hockey-game-backdrop').style.display = 'flex';
  hkCanvas = document.getElementById('hockey-canvas');
  hkCanvas.addEventListener('mousemove', hkMouseHandler);
  hkCanvas.addEventListener('mouseenter', hkMouseHandler);
  hkCanvas.addEventListener('touchmove', hkTouchHandler, { passive: false });
  hkCanvas.addEventListener('touchstart', hkTouchHandler, { passive: false });
  // also track mouse on the whole backdrop
  const bd = document.getElementById('hockey-game-backdrop');
  bd.addEventListener('mousemove', hkMouseHandler);
  hkInit();
};
function resumeHockey() { hkPaused = false; document.getElementById('hockey-pause-overlay').style.display = 'none'; if (hkRunning) hkLoop(); }
function quitHockey() {
  hkRunning = false; hkPaused = false;
  if (hkAnimId) { cancelAnimationFrame(hkAnimId); hkAnimId = null; }
  document.getElementById('hockey-pause-overlay').style.display = 'none';
  document.getElementById('hockey-result-overlay').style.display = 'none';
  document.getElementById('hockey-game-backdrop').style.display = 'none';
  document.getElementById('hockey-menu-backdrop').style.display = 'flex';
}
function retryHockey() { hkInit(); }
window.quitHockey = quitHockey;
window.resumeHockey = resumeHockey;
window.retryHockey = retryHockey;
window.mobilePauseHockey = () => { if (hkRunning && !hkPaused) { hkPaused = true; document.getElementById('hockey-pause-overlay').style.display = 'flex'; } };
window.cleanupHockey = () => { hkRunning = false; hkPaused = false; if (hkAnimId) { cancelAnimationFrame(hkAnimId); hkAnimId = null; } };

window.addEventListener('keydown', (e) => {
  const bd = document.getElementById('hockey-game-backdrop');
  if (!bd || bd.style.display === 'none') return;
  if (e.key === 'Escape') { e.preventDefault(); if (hkPaused) resumeHockey(); else mobilePauseHockey(); }
});

// Logo
function generateHockeyLogo() {
  const canvas = document.getElementById('hockey-logo-canvas');
  if (!canvas) return;
  const btn = canvas.parentElement;
  const w = btn.offsetWidth, h = btn.offsetHeight;
  canvas.width = w * 2; canvas.height = h * 2;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  // table
  ctx.fillStyle = 'rgba(30,100,60,0.2)';
  ctx.fillRect(0, 0, w, h);
  // center line
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.setLineDash([6,6]);
  ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke(); ctx.setLineDash([]);
  // random paddles and pucks
  for (let i = 0; i < 4; i++) {
    const px = Math.random() * w, py = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(33,150,243,0.4)' : 'rgba(244,67,54,0.4)';
    ctx.beginPath(); ctx.arc(px, py, h * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, h * 0.06, 0, Math.PI * 2); ctx.fill();
  }
}
window.generateHockeyLogo = generateHockeyLogo;
window.addEventListener('load', () => setTimeout(generateHockeyLogo, 240));
window.addEventListener('resize', generateHockeyLogo);
