// --- Base game logic: navigation, boot ---

// Expose navigation handlers
window.showInfo = () => {
  document.getElementById('info-backdrop').style.display = 'flex';
  document.getElementById('menu-backdrop').style.display = 'none';
  if (window.generateTetrisLogo) setTimeout(window.generateTetrisLogo, 50);
  if (window.generateTttLogo) setTimeout(window.generateTttLogo, 50);
  if (window.generateBreakoutLogo) setTimeout(window.generateBreakoutLogo, 50);
};
window.hideInfo = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  window.showSnakeMenu();
};
window.showGenericMenu = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  document.getElementById('generic-menu-backdrop').style.display = 'flex';
};
window.hideGenericMenu = () => {
  document.getElementById('generic-menu-backdrop').style.display = 'none';
  document.getElementById('info-backdrop').style.display = 'flex';
};
window.showTetrisMenu = () => {
  document.getElementById('info-backdrop').style.display = 'none';
  document.getElementById('tetris-menu-backdrop').style.display = 'flex';
};
window.hideTetrisMenu = () => {
  document.getElementById('tetris-menu-backdrop').style.display = 'none';
  document.getElementById('info-backdrop').style.display = 'flex';
};

// Boot — start on the game selection screen
document.body.classList.add('show-notebook');
document.getElementById('info-backdrop').style.display = 'flex';
