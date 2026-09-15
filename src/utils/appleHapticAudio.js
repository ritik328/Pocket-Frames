/**
 * Pocket Frames - Apple iOS Wheel Haptic Audio & Vibration Synthesizer
 * Produces the authentic iPhone UIPickerView mechanical tick sound and physical haptic pulse.
 */

let audioCtx = null;
let lastTickTime = 0;
const MIN_TICK_INTERVAL_MS = 32; // Limit tick frequency during fast scrolls

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play authentic Apple iPhone mechanical wheel tick sound
 */
export function playAppleWheelTick() {
  const nowMs = Date.now();
  if (nowMs - lastTickTime < MIN_TICK_INTERVAL_MS) {
    return;
  }
  lastTickTime = nowMs;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // 1. Ultra-short high-frequency click (mechanical latch release)
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();

    oscClick.type = 'triangle';
    // Frequency sweeps down rapidly from 2600Hz to 600Hz in 6ms (the distinct iOS tick)
    oscClick.frequency.setValueAtTime(2600, t);
    oscClick.frequency.exponentialRampToValueAtTime(600, t + 0.007);

    gainClick.gain.setValueAtTime(0.18, t);
    gainClick.gain.exponentialRampToValueAtTime(0.001, t + 0.008);

    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);

    oscClick.start(t);
    oscClick.stop(t + 0.009);

    // 2. Subtle low-end mechanical resonance thud (80Hz - 120Hz)
    const oscThud = ctx.createOscillator();
    const gainThud = ctx.createGain();

    oscThud.type = 'sine';
    oscThud.frequency.setValueAtTime(140, t);
    oscThud.frequency.exponentialRampToValueAtTime(70, t + 0.012);

    gainThud.gain.setValueAtTime(0.12, t);
    gainThud.gain.exponentialRampToValueAtTime(0.001, t + 0.014);

    oscThud.connect(gainThud);
    gainThud.connect(ctx.destination);

    oscThud.start(t);
    oscThud.stop(t + 0.015);

  } catch (err) {
    // AudioContext blocked or not supported
  }
}

/**
 * Trigger physical haptic vibration (Android & supporting mobile browsers)
 */
export function triggerHapticTick() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      // 10ms micro-pulse for crisp mechanical feel
      navigator.vibrate(10);
    }
  } catch (e) {}
}

/**
 * Combined Apple-style wheel step tick: Sound + Haptic
 */
export function triggerPickerTick() {
  playAppleWheelTick();
  triggerHapticTick();
}

/**
 * Soft confirmation chime for Apply action
 */
export function playApplyConfirmSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.08); // E5

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.24);

    if (navigator.vibrate) {
      navigator.vibrate([15, 30, 20]);
    }
  } catch (e) {}
}
