class GranularProcessor extends AudioWorkletProcessor {
constructor() {
  super();
  this.buffer = [null, null];
  this.playbackRate = 1;
  this.position = 0;
  this.startTime = 0;
  this.hasStarted = false;

  this.port.onmessage = (e) => {
    if (e.data.type === 'load') {
      this.buffer = e.data.buffer;
      this.startTime = typeof e.data.startTime === 'number' ? e.data.startTime : 0;
      this.position = typeof e.data.startPosition === 'number' ? e.data.startPosition : 0;
      this.hasStarted = false;
    }
    if (e.data.type === 'setPlaybackRate') {
      this.playbackRate = typeof e.data.value === 'number' ? e.data.value : 1;
    }
    if (e.data.type === 'getPosition') {
      // THIS IS WHERE YOU ADD THE RESPONSE:
      this.port.postMessage({ type: 'position', position: this.position });
    }
    if (e.data.type === 'stop') {
      this.hasStarted = false;
      this.port.postMessage({ type: 'position', position: this.position });
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
    const output = outputs[0];
    const leftOut = output[0];
    const rightOut = output[1] || output[0];
    const rate = parameters.playbackRate[0] || this.playbackRate || this.playbackRateParam;
    const leftBuf = this.buffer[0];
    const rightBuf = this.buffer[1] || leftBuf;

    // --- No buffer? Output silence
    if (!leftBuf || !leftBuf.length) {
      for (let i = 0; i < leftOut.length; i++) {
        leftOut[i] = 0;
        if (rightOut !== leftOut) rightOut[i] = 0;
      }
      return true;
    }

    // --- Wait until scheduled startTime for sync (on every play/scrub)
    if (!this.hasStarted) {
      if (currentTime >= this.startTime) {
        this.hasStarted = true;
      } else {
        // Output silence until it's time
        for (let i = 0; i < leftOut.length; i++) {
          leftOut[i] = 0;
          if (rightOut !== leftOut) rightOut[i] = 0;
        }
        return true;
      }
    }

    // --- Playback
    const bufferLength = leftBuf.length;
    for (let i = 0; i < leftOut.length; i++) {
      const idx = this.position;
      const i0 = Math.floor(idx);
      const i1 = (i0 + 1) % bufferLength;
      const frac = idx - i0;
      // Linear interpolate for smoothness
      const leftSample = (1 - frac) * leftBuf[i0 % bufferLength] + frac * leftBuf[i1];
      const rightSample = (1 - frac) * rightBuf[i0 % bufferLength] + frac * rightBuf[i1];
      leftOut[i] = leftSample;
      if (rightOut !== leftOut) rightOut[i] = rightSample;

      this.position += rate;
      if (this.position >= bufferLength) {
        this.position -= bufferLength;
      }
    }

    
    // Do NOT spam port.postMessage from process() — only respond on explicit request!
    return true;
  }
}

registerProcessor('granular-player', GranularProcessor);
