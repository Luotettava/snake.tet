# Start window demo

This project contains a small HTML+JS app (`index.html`) that opens an in-page 600×600 window, and a Node.js helper to serve the files and open the browser automatically.

How to run (browser-based):

1. Ensure you have Node.js installed (v14+).
2. From the project folder run:

```bash
npm start
```

This starts a local server at `http://localhost:8000/` and opens the page in your default browser.

Alternative (no Node):
- Open `index.html` directly in your browser (double-click or use `file:///` URL).

Notes:
- Browser popups and window chrome are controlled by the browser; the app uses an in-page modal window to avoid popup restrictions.
- If you prefer a native app (no browser chrome), I can scaffold an Electron wrapper.
# snake.tet

