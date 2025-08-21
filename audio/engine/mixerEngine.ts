export async function initMixerEngine() {
  const ctx = new AudioContext();

  // load the worklet
  await ctx.audioWorklet.addModule("/worklet/mixer-processor.js");

  // create node
  const node = new AudioWorkletNode(ctx, "mixer-processor");

  // connect to speakers
  node.connect(ctx.destination);

  console.log("✅ Mixer engine initialized");

  return { ctx, node };
}