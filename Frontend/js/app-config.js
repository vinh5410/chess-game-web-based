const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

window.APP_CONFIG = {
  API_BASE: isLocal ? 'http://localhost:3000' : 'https://chess-game-web-based.onrender.com',
  SOCKET_SERVER: isLocal ? 'http://localhost:3000' : 'https://chess-game-web-based.onrender.com'
};