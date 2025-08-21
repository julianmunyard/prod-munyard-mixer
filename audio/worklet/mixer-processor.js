// public path resolve helper if you need to import scripts
// self.importScripts('/superpowered/SuperpoweredWebAudio.js');

class MixerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = sampleRate;
    this.players = [];       // one per stem
    this.gains = [];         // per-stem linear gain
    this.delays = [];        // per-stem delay lines (Superpowered or simple)
    this.playing = false;
    this.transportRate = 1;  // tape-style varispeed
    this.seekSeconds = 0;    // position to jump to on next start
    this.startAt = 0;        // audioContextTime to start
    this._super = null;      // Superpowered module

    this.port.onmessage = (e) => this._onMsg(e.data);
    this._init();
  }

  async _init() {
    // Create Superpowered engine
    // NOTE: you already have this working (your logs show GlueModule memory).
    // Keep your existing init if you have one.
    // this._super = await Superpowered....(licenseKey, this.sampleRate)
    // Prepare a simple delay per stem if you need it later.
  }

  _onMsg(msg) {
    switch (msg.type) {
      case 'LOAD_STEMS': {
        const { stems } = msg; // [{id, url, label}]
        // Create a Superpowered player for each stem and open url
        // Pseudocode – keep your working calls here:
        // this.players[i] = new this._super.AdvancedAudioPlayer({samplerate:this.sampleRate});
        // this.players[i].open(stem.url);
        this.gains = stems.map(() => 1.0);
        this.delays = stems.map(() => null);
        this.playersReady = false;
        break;
      }
      case 'ARM_PLAY': {
        // schedule a precise start
        this.seekSeconds = msg.seek ?? 0;
        this.transportRate = msg.rate ?? 1;
        this.startAt = msg.startAt ?? currentTime + 0.06; // tiny offset for sync
        this.playing = true;
        // For each player: seek & set rate, disable pitch preserve
        // this.players.forEach(p => { p.setPosition(this.seekSeconds); p.setRate(this.transportRate, false /*preservePitch*/); p.play(true); });
        break;
      }
      case 'STOP': {
        this.playing = false;
        // this.players.forEach(p => p.play(false));
        break;
      }
      case 'SEEK': {
        this.seekSeconds = msg.seconds;
        // this.players.forEach(p => p.setPosition(this.seekSeconds));
        break;
      }
      case 'SET_VOL': {
        this.gains[msg.index] = msg.gain;
        break;
      }
      case 'SET_DELAY': {
        // set per-stem delay time/feedback if you’re using SP delay
        break;
      }
      case 'SET_RATE': {
        this.transportRate = msg.rate;
        // this.players.forEach(p => p.setRate(this.transportRate, false));
        break;
      }
    }
  }

  process(inputs, outputs, parameters) {
    const outL = outputs[0][0];
    const outR = outputs[0][1];
    outL.fill(0); outR.fill(0);

    const now = currentTime;

    if (this.playing && now >= this.startAt) {
      // Mix stems (Superpowered players render directly into temp buffers)
      // Example pseudocode:
      // for (let i=0;i<this.players.length;i++) {
      //   const p = this.players[i];
      //   const tmp = p.processStereo(this.transportRate); // returns {left,right} Float32Array
      //   const g = this.gains[i];
      //   for (let s=0;s<outL.length;s++) { outL[s] += tmp.left[s]*g; outR[s] += tmp.right[s]*g; }
      // }
    }

    return true;
  }
}

registerProcessor('mixer-processor', MixerProcessor);
