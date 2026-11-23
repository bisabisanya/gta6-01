// Keyboard + mouse. Keys are tracked by code; actions are edge-triggered and
// consumed once per frame, so one press never fires twice.

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_CAR = 4;
export const ACT_PUNCH = 8;
export const ACT_MUTE = 16;
export const ACT_SAVE = 32;

const CONFIRM = ['Enter', 'Space'];
const PAUSE = ['Escape', 'KeyP'];

export function makeInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      if (CONFIRM.includes(event.code)) actions |= ACT_CONFIRM;
      if (PAUSE.includes(event.code)) actions |= ACT_PAUSE;
      if (event.code === 'KeyE') actions |= ACT_CAR;
      if (event.code === 'KeyF') actions |= ACT_PUNCH;
      if (event.code === 'KeyM') actions |= ACT_MUTE;
      if (event.code === 'KeyG') actions |= ACT_SAVE;
    }
    keys.add(event.code);
  }
  function keyUp(event) {
    keys.delete(event.code);
  }
  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  }
  function mouseDown(event) {
    mouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }
  function mouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);

  return {
    mouse,
    takeActions() {
      const taken = actions;
      actions = 0;
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return { actions: taken, clicked };
    },
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    drive() {
      return {
        throttle: (keys.has('KeyW') || keys.has('ArrowUp')) ? 1 : 0,
        brake: (keys.has('KeyS') || keys.has('ArrowDown')) ? 1 : 0,
        steer: ((keys.has('KeyA') || keys.has('ArrowLeft')) ? -1 : 0)
          + ((keys.has('KeyD') || keys.has('ArrowRight')) ? 1 : 0),
        handbrake: keys.has('Space') ? 1 : 0,
      };
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
  };
}
