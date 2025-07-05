class GranularProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = null;
    this.playbackRate = 1;
    this.position = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'load') {
        this.buffer = e.data.buffer;
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
    const channel = output[0];
    const rate = parameters.playbackRate[0] || this.playbackRateParam;

    if (!this.buffer || !this.buffer.length) {
      for (let i = 0; i < channel.length; i++) {
        channel[i] = 0;
      }
      return true;
    }

    const buffer = this.buffer;
    const bufferLength = buffer.length;

    for (let i = 0; i < channel.length; i++) {
      const idx = this.position;
      const i0 = Math.floor(idx);
      const i1 = (i0 + 1) % bufferLength;
      const frac = idx - i0;

      const sample = (1 - frac) * buffer[i0 % bufferLength] + frac * buffer[i1];
      channel[i] = sample;

      this.position += rate;
      if (this.position >= bufferLength) {
        this.position -= bufferLength;
      }
    }

    return true;
  }
}

registerProcessor('granular-player', GranularProcessor);
