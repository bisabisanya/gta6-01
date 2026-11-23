// Keyboard + mouse input. Keys are tracked by code; actions are edge-triggered and consumed
// once per frame so a single press never fires twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;

const CONFIRM_KEYS = ['Enter', 'Space'];
const PAUSE_KEYS = ['Escape', 'KeyP'];

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      if (CONFIRM_KEYS.includes(event.code)) actions |= ACTION_CONFIRM;
      if (PAUSE_KEYS.includes(event.code)) actions |= ACTION_PAUSE;
      if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
      if (event.code === 'KeyF') actions |= ACTION_PUNCH;
      if (event.code === 'KeyM') actions |= ACTION_MUTE;
      if (event.code === 'KeyG') actions |= ACTION_SAVE;
    }
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

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
        steer: ((keys.has('KeyA') || keys.has('ArrowLeft')) ? -1 : 0) + ((keys.has('KeyD') || keys.has('ArrowRight')) ? 1 : 0),
        handbrake: keys.has('Space') ? 1 : 0,
      };
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
  };
}
