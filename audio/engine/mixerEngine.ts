export type StemInfo = { id: string; label: string; url: string };

let ctx: AudioContext | null = null;
let node: AudioWorkletNode | null = null;

export async function initMixerEngine() {
  if (ctx) return { ctx, node };
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

  // make sure worklet script is in /public/worklet/mixer-processor.js
  await ctx.audioWorklet.addModule('/worklet/mixer-processor.js');
  node = new AudioWorkletNode(ctx, 'mixer-processor', { outputChannelCount: [2] });
  node.connect(ctx.destination);
  return { ctx, node };
}

export function loadStems(stems: StemInfo[]) {
  node?.port.postMessage({ type: 'LOAD_STEMS', stems });
}

export async function play({ seek = 0, rate = 1 }: { seek?: number; rate?: number } = {}) {
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  const startAt = ctx.currentTime + 0.06; // tiny guard for sync
  node?.port.postMessage({ type: 'ARM_PLAY', seek, rate, startAt });
}

export function stop() {
  node?.port.postMessage({ type: 'STOP' });
}

export function setVolume(index: number, gain: number) {
  node?.port.postMessage({ type: 'SET_VOL', index, gain });
}

export function setDelay(index: number, ms: number, feedback = 0.3) {
  node?.port.postMessage({ type: 'SET_DELAY', index, ms, feedback });
}

export function setRate(rate: number) {
  node?.port.postMessage({ type: 'SET_RATE', rate });
}
