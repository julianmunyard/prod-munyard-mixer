class GranularProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Store an array: [left, right]
    this.buffer = [null, null];
    this.playbackRate = 1;
    this.position = 0;
    this.startTime = null;
    this.hasStarted = false;

    this.port.onmessage = (e) => {
if (e.data.type === 'load') {
  this.buffer = e.data.buffer;
  this.startTime = typeof e.data.startTime === 'number' ? e.data.startTime : 0;
  this.hasStarted = false;
  this.position = 0;
}

    };

    this.playbackRateParam = 1;
  }

  static get parameterDescriptors() {
    return [
      {
        name: 'playbackRate',
        defaultValue: 1,
        minValue: 0.5,
        maxValue: 2,
      },
    ];
  }

process(inputs, outputs, parameters) {
  const output = outputs[0]; // [left, right]
  const leftOut = output[0];
  const rightOut = output[1] || output[0];
  const rate = parameters.playbackRate[0] || this.playbackRateParam;
  const leftBuf = this.buffer[0];
  const rightBuf = this.buffer[1] || leftBuf;

  // No buffer loaded yet
  if (!leftBuf || !leftBuf.length) {
    for (let i = 0; i < leftOut.length; i++) {
      leftOut[i] = 0;
      if (rightOut !== leftOut) rightOut[i] = 0;
    }
    return true;
  }

  // --- 🚦 Wait until start time for sync ---
  if (!this.hasStarted) {
    if (currentTime >= (this.startTime || 0)) {
      this.hasStarted = true;
    } else {
      // Output silence until start time
      for (let i = 0; i < leftOut.length; i++) {
        leftOut[i] = 0;
        if (rightOut !== leftOut) rightOut[i] = 0;
      }
      return true;
    }
  }
    const bufferLength = leftBuf.length;

    for (let i = 0; i < leftOut.length; i++) {
      const idx = this.position;
      const i0 = Math.floor(idx);
      const i1 = (i0 + 1) % bufferLength;
      const frac = idx - i0;

      // Linear interpolate left and right channels
      const leftSample = (1 - frac) * leftBuf[i0 % bufferLength] + frac * leftBuf[i1];
      const rightSample = (1 - frac) * rightBuf[i0 % bufferLength] + frac * rightBuf[i1];

      leftOut[i] = leftSample;
      if (rightOut !== leftOut) rightOut[i] = rightSample;

      this.position += rate;
      if (this.position >= bufferLength) {
        this.position -= bufferLength;
      }
    }

    return true;
  }
}

registerProcessor('granular-player', GranularProcessor);
