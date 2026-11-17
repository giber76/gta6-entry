// Keyboard + mouse input for Solara Bay. Tracks held keys, edge presses,
// and mouse deltas (pointer lock when the player clicks the canvas).
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {}; // edge-triggered, consumed by readPress
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.pointerLocked = false;
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.pressed[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
      else if (this.dragging) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.mouseClicked = true; this.dragging = true;
      if (document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (_) { /* pointer lock unavailable */ }
      }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
  }
  down(code) { return !!this.keys[code]; }
  readPress(code) { // true once per physical press
    if (this.pressed[code]) { this.pressed[code] = false; return true; }
    return false;
  }
  consumeClick() {
    const c = this.mouseClicked; this.mouseClicked = false; return c;
  }
  takeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy }; }
  endFrame() { this.pressed = {}; }
}
