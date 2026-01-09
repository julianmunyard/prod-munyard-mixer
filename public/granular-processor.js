
class GranularProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = []; // Array of [left, right]
    this.bufferOffsets = []; // Sample offsets for each buffer
    this.playbackRate = 1;
    this.position = 0;
    this.absoluteStartTime = 0;
    this.startPosition = 0;
    this.hasStarted = false;
    this.warnedLowBuffer = false; // ✅ NEW

    this.port.onmessage = (e) => {
      switch (e.data.type) {
        case 'load': {
          this.buffers = [e.data.buffer];
          this.bufferOffsets = [0];
          this.startPosition = e.data.startPosition || 0;
          this.absoluteStartTime = e.data.absoluteStartTime || 0;
          this.position = this.startPosition;
          this.hasStarted = false;
          this.warnedLowBuffer = false; // ✅ RESET
          this.port.postMessage({ type: 'ready' });
          break;
        }

        case 'appendBuffer': {
          if (!e.data.buffer || !e.data.buffer[0]) break;
          const lastOffset = this.bufferOffsets.length
            ? this.bufferOffsets[this.bufferOffsets.length - 1]
            : 0;
          const lastLength = this.buffers.length
            ? this.buffers[this.buffers.length - 1][0].length
            : 0;
          const newOffset = lastOffset + lastLength;
          this.buffers.push(e.data.buffer);
          this.bufferOffsets.push(newOffset);
          this.warnedLowBuffer = false; // ✅ RESET when buffer added
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
          this.position = typeof e.data.newPosition === 'number'
            ? e.data.newPosition
            : this.position;
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

    const now = currentFrame / sampleRate;

    if (now < this.absoluteStartTime) {
      leftOut.fill(0);
      rightOut.fill(0);
      return true;
    }

    if (!this.hasStarted) {
      this.position = this.startPosition;
      this.hasStarted = true;

      const delta = now - this.absoluteStartTime;
      if (delta > 0.002) {
        this.port.postMessage({ type: 'desync', delta });
      }
    }

    // ✅ EARLY BUFFER WARNING (NEW)
    const bufferEnd = this.bufferOffsets.length
      ? this.bufferOffsets[this.bufferOffsets.length - 1] +
        (this.buffers[this.buffers.length - 1]?.[0]?.length || 0)
      : 0;
    const samplesLeft = bufferEnd - this.position;
    const secondsLeft = samplesLeft / sampleRate;

    if (secondsLeft < 2.0 && !this.warnedLowBuffer) {
      this.port.postMessage({ type: 'endOfBuffer' }); // early request
      this.warnedLowBuffer = true;
    }

    let sentEnd = false;

    for (let i = 0; i < leftOut.length; i++) {
      const globalIdx = this.position;
      let sample = [0, 0];
      let found = false;

      for (let b = 0; b < this.buffers.length; b++) {
        const offset = this.bufferOffsets[b];
        const leftBuf = this.buffers[b][0];
        const rightBuf = this.buffers[b][1] || leftBuf;

        const localIdx = globalIdx - offset;
        if (localIdx >= 0 && localIdx < leftBuf.length - 1) {
          const i0 = Math.floor(localIdx);
          const i1 = i0 + 1;
          const frac = localIdx - i0;

          const leftSample = (1 - frac) * leftBuf[i0] + frac * (leftBuf[i1] || 0);
          const rightSample = (1 - frac) * rightBuf[i0] + frac * (rightBuf[i1] || 0);
          sample = [leftSample, rightSample];
          found = true;
          break;
        }
      }

      if (found) {
        leftOut[i] = sample[0];
        rightOut[i] = sample[1];
      } else {
        leftOut[i] = 0;
        rightOut[i] = 0;

        if (!sentEnd) {
          this.port.postMessage({ type: 'endOfBuffer' });
          sentEnd = true;
        }
      }

      const step = rateParam.length > 1 ? rateParam[i] : rate;
      this.position += step;
    }

    return true;
  }
}

registerProcessor('granular-player', GranularProcessor);
