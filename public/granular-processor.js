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

    for (let i = 0; i < channel.length; i++) {
      const idx = Math.floor(this.position);
      channel[i] = this.buffer[idx % this.buffer.length] || 0;
      this.position += rate;
    }

    return true;
  }
}

registerProcessor('granular-player', GranularProcessor);
