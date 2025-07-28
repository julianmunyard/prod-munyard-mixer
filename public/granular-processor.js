class GranularProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [null, null];
    this.position = 0;
    this.playbackRate = 1;
    this.absoluteStartTime = 0;
    this.startPosition = 0;
    this.hasStarted = false;

    this.port.onmessage = (e) => {
      switch (e.data.type) {
case 'load': {
  this.buffer = e.data.buffer;
  this.startPosition = typeof e.data.startPosition === 'number' ? e.data.startPosition : 0;
  this.absoluteStartTime = typeof e.data.absoluteStartTime === 'number' ? e.data.absoluteStartTime : 0;
  this.hasStarted = false;
  this.port.postMessage({ type: 'ready' });
  break;
}
        case 'setPlaybackRate':
          this.playbackRate = e.data.value || 1;
          break;
        case 'getPosition':
          this.port.postMessage({ type: 'position', position: this.position });
          break;
        case 'stop':
          this.hasStarted = false;
          this.port.postMessage({ type: 'position', position: this.position });
          break;
        case 'scrub':
          this.position = typeof e.data.newPosition === 'number' ? e.data.newPosition : this.position;
          break;
      }
    };
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'playbackRate',
        defaultValue: 1,
        minValue: 0.25,
        maxValue: 4,
      },
    ];
  }

  process(inputs, outputs, parameters) {
  const output = outputs[0];
  const leftOut = output[0];
  const rightOut = output[1] || leftOut;
  const rateParam = parameters.playbackRate;
  const rate = rateParam.length === 1 ? rateParam[0] : this.playbackRate;

  const leftBuf = this.buffer[0];
  const rightBuf = this.buffer[1] || leftBuf;

  if (!leftBuf || leftBuf.length === 0) {
    leftOut.fill(0);
    rightOut.fill(0);
    return true;
  }

  const now = currentFrame / sampleRate;

  // Still waiting for start time? Output silence
  if (now < this.absoluteStartTime) {
    leftOut.fill(0);
    rightOut.fill(0);
    return true;
  }

  // First time hitting start: snap to synced position
  if (!this.hasStarted) {
    this.position = this.startPosition;
    this.hasStarted = true;

    const delta = now - this.absoluteStartTime;
    if (delta > 0.002) {
      this.port.postMessage({ type: 'desync', delta });
    }
  }

  const bufferLength = leftBuf.length;

  for (let i = 0; i < leftOut.length; i++) {
    const idx = this.position;
    const i0 = Math.floor(idx);
    const i1 = (i0 + 1) % bufferLength;
    const frac = idx - i0;

    const leftSample = (1 - frac) * leftBuf[i0] + frac * leftBuf[i1];
    const rightSample = (1 - frac) * rightBuf[i0] + frac * rightBuf[i1];

    leftOut[i] = leftSample;
    rightOut[i] = rightSample;

    const step = rateParam.length > 1 ? rateParam[i] : rate;
    this.position += step;

    if (this.position >= bufferLength) {
      this.position -= bufferLength;
    }
  }

  return true;
}
}

registerProcessor('granular-player', GranularProcessor);
