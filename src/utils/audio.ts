/**
 * Procedural Web Audio API sound generator for MathQuest 5.
 * Works seamlessly without external audio file dependencies.
 */

let audioCtx: AudioContext | null = null;
let isMuted: boolean = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function toggleAudioMute(): boolean {
  isMuted = !isMuted;
  return isMuted;
}

export function getIsMuted(): boolean {
  return isMuted;
}

export function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  delay = 0,
  vol = 0.15
) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch {
    // Audio safe fallback
  }
}

export function playSfx(name: 'correct' | 'wrong' | 'combo' | 'hop' | 'attack' | 'hit' | 'build' | 'victory' | 'gameover' | 'click') {
  if (isMuted) return;

  switch (name) {
    case 'correct':
      playTone(587.33, 0.1, 'triangle', 0, 0.18); // D5
      playTone(880, 0.18, 'triangle', 0.08, 0.22); // A5
      break;

    case 'combo':
      playTone(523.25, 0.09, 'triangle', 0, 0.15);
      playTone(659.25, 0.09, 'triangle', 0.07, 0.18);
      playTone(783.99, 0.09, 'triangle', 0.14, 0.2);
      playTone(1046.5, 0.22, 'sine', 0.21, 0.22);
      break;

    case 'wrong':
      playTone(185, 0.25, 'sawtooth', 0, 0.14);
      playTone(146, 0.3, 'sawtooth', 0.1, 0.12);
      break;

    case 'hop':
      playTone(320, 0.08, 'sine', 0, 0.15);
      playTone(480, 0.1, 'sine', 0.04, 0.18);
      break;

    case 'attack':
      playTone(420, 0.06, 'sawtooth', 0, 0.16);
      playTone(600, 0.08, 'triangle', 0.03, 0.18);
      break;

    case 'hit':
      playTone(160, 0.15, 'sawtooth', 0, 0.2);
      playTone(110, 0.2, 'triangle', 0.05, 0.2);
      break;

    case 'build':
      playTone(440, 0.08, 'sine', 0, 0.15);
      playTone(554.37, 0.12, 'sine', 0.06, 0.18);
      break;

    case 'victory':
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        playTone(freq, 0.25, 'triangle', idx * 0.12, 0.2);
      });
      break;

    case 'gameover':
      [392, 349.23, 293.66, 220].forEach((freq, idx) => {
        playTone(freq, 0.28, 'sawtooth', idx * 0.14, 0.12);
      });
      break;

    case 'click':
      playTone(700, 0.03, 'sine', 0, 0.08);
      break;
  }
}
