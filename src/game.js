// --- Base game logic: hash routing, navigation, boot ---

function regenAllLogos() {
  const logos = ['generateSnakeLogo','generateTetrisLogo','generateTttLogo','generateBreakoutLogo','generateChessLogo','generateCheckersLogo','generate2048Logo','generateBomberLogo','generateHockeyLogo'];
  logos.forEach(fn => { if (window[fn]) setTimeout(window[fn], 50); });
}

function showHome() {
  document.querySelectorAll('.backdrop').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tetris-overlay').forEach(el => el.style.display = 'none');
  const cleanups = ['cleanupSnake','cleanupTetris','cleanupBreakout','cleanupChess','cleanupCheckers','cleanup2048','cleanupBomber','cleanupHockey'];
  cleanups.forEach(fn => { if (window[fn]) window[fn](); });
  document.getElementById('info-backdrop').style.display = 'flex';
  // force reflow then regen logos
  requestAnimationFrame(() => { requestAnimationFrame(regenAllLogos); });
}

// Route based on hash
function handleRoute() {
  const hash = window.location.hash.slice(1); // remove #
  if (!hash || hash === 'home') {
    showHome();
    return;
  }
  // Navigate to game — hide info, show game menu
  showHome(); // reset first
  document.getElementById('info-backdrop').style.display = 'none';
  switch (hash) {
    case 'snake': window.showSnakeMenu && window.showSnakeMenu(); break;
    case 'tetris': document.getElementById('tetris-menu-backdrop').style.display = 'flex'; break;
    case 'ttt': document.getElementById('ttt-menu-backdrop').style.display = 'flex'; break;
    case 'breakout': window.showBreakoutMenu && window.showBreakoutMenu(); break;
    case 'chess': document.getElementById('chess-menu-backdrop').style.display = 'flex'; break;
    case 'checkers': document.getElementById('checkers-menu-backdrop').style.display = 'flex'; break;
    case '2048': window.show2048 && window.show2048(); break;
    case 'bomber': window.showBomberMenu && window.showBomberMenu(); break;
    case 'hockey': window.showHockeyMenu && window.showHockeyMenu(); break;
    default: showHome(); break;
  }
}

// Navigation — use hash
window.goHome = () => {
  // if already on home, reload the site
  if (!window.location.hash || window.location.hash === '#home' || window.location.hash === '#') {
    window.location.reload();
    return;
  }
  window.location.hash = 'home';
};
window.showInfo = () => { window.location.hash = 'home'; };
window.hideInfo = () => { window.location.hash = 'snake'; };
window.showGenericMenu = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  document.getElementById('generic-menu-backdrop').style.display = 'flex';
};
window.hideGenericMenu = () => { window.location.hash = 'home'; };
window.showTetrisMenu = () => { window.location.hash = 'tetris'; };
window.hideTetrisMenu = () => { window.location.hash = 'home'; };

// Listen for hash changes
window.addEventListener('hashchange', handleRoute);

// Boot
document.body.classList.add('show-notebook');
// Initial route
setTimeout(handleRoute, 10);

// Limit scroll on game selection — can't scroll past last button
const infoBackdrop = document.getElementById('info-backdrop');
if (infoBackdrop) {
  infoBackdrop.addEventListener('scroll', () => {
    const buttons = infoBackdrop.querySelectorAll('.info-nav-button');
    if (buttons.length === 0) return;
    const lastBtn = buttons[buttons.length - 1];
    const maxScroll = lastBtn.offsetTop + lastBtn.offsetHeight + 40 - infoBackdrop.clientHeight;
    if (infoBackdrop.scrollTop > maxScroll && maxScroll > 0) {
      infoBackdrop.scrollTop = maxScroll;
    }
  });
}
