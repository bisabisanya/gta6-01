// Synthesized sound: every effect is built from WebAudio oscillators and
// filtered noise, so the game ships no audio files. Music is a small looping
// bassline with hats.

export function makeAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  }

  function noise(dur, vol, cutoff) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = c.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  const BASSLINE = [55, 0, 55, 65.4, 0, 55, 49, 58.3, 55, 0, 55, 65.4, 73.4, 65.4, 58.3, 49];

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 1800);
      tone(220, 0.08, 'square', 0.18, 60);
    },
    punch() {
      noise(0.08, 0.4, 500);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.25);
      setTimeout(() => tone(1320, 0.12, 'sine', 0.25), 70);
    },
    cash() {
      tone(1046, 0.08, 'triangle', 0.22);
      setTimeout(() => tone(1568, 0.14, 'triangle', 0.22), 80);
    },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.25), i * 90));
    },
    fail() {
      tone(220, 0.3, 'sawtooth', 0.2, 110);
    },
    siren() {
      tone(720, 0.5, 'sine', 0.06, 960);
      setTimeout(() => tone(960, 0.5, 'sine', 0.06, 720), 500);
    },
    crash() {
      noise(0.25, 0.5, 700);
    },
    engine(speed01) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      tone(50 + speed01 * 90, 0.09, 'sawtooth', 0.03 + speed01 * 0.03);
    },
    startMusic() {
      if (musicTimer || !ensure()) return;
      musicTimer = setInterval(() => {
        if (muted) return;
        const note = BASSLINE[musicStep % BASSLINE.length];
        if (note) tone(note, 0.22, 'triangle', 0.12);
        if (musicStep % 2 === 0) noise(0.03, 0.05, 6000);
        musicStep += 1;
      }, 240);
    },
    stopMusic() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
    },
  };
}
