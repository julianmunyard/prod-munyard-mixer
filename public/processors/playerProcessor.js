// /public/processors/playerProcessor.js
class PlayerProcessor extends SuperpoweredWebAudio.AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.player = null;
    this.isPlaying = false;
    this.rate = 1.0;
    this.volume = 1.0;
    this.position = 0;
  }

  onReady() {
    this.sendMessageToMainScope({ event: "ready" });
  }

  onMessageFromMainScope(msg) {
    const t = msg?.type;
    
    if (t === "loadUrl") {
      // Load audio from URL
      this.loadAudioFromUrl(msg.url);
    } else if (t === "play") {
      this.isPlaying = true;
    } else if (t === "pause") {
      this.isPlaying = false;
    } else if (t === "seek") {
      const seconds = msg.payload?.seconds || 0;
      this.position = seconds;
      if (this.player) {
        this.player.setPosition(seconds, false, false);
      }
    } else if (t === "parameterChange") {
      const { id, value } = msg.payload || {};
      
      if (id === "volume") {
        this.volume = Math.max(0, Math.min(1, value ?? 1));
      } else if (id === "speed") {
        this.rate = Math.max(0.5, Math.min(2, value ?? 1));
        if (this.player) {
          this.player.setRateAndPitchShift(this.rate, 0);
        }
      }
    }
  }

  async loadAudioFromUrl(url) {
    try {
      // Fetch the audio file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Convert to WASM memory
      const ptr = this.Superpowered.arrayBufferToWASM(arrayBuffer);
      
      // Create player
      this.player = new this.Superpowered.AdvancedAudioPlayer(
        this.samplerate, 2, 2, 0, 0.501, 2.0, false
      );
      this.player.openMemory(ptr, false, false);
      
      this.sendMessageToMainScope({ event: "assetLoaded" });
    } catch (error) {
      console.error("Failed to load audio:", error);
      this.sendMessageToMainScope({ event: "loadError", error: error.message });
    }
  }

  processAudio(input, output, frames) {
    const out = (this.numberOfOutputs === 1) ? output : output[0];
    
    // Clear output buffer
    this.Superpowered.memorySet(out.pointer, 0, frames * 8);
    
    if (!this.isPlaying || !this.player) return;

    // Process the player
    const tempBuffer = this.Superpowered.malloc(frames * 8);
    const got = this.player.process(tempBuffer, frames);
    
    if (got) {
      // Apply volume and copy to output
      const tempArray = new Float32Array(
        this.Superpowered.HEAPF32.buffer,
        tempBuffer,
        got * 2
      );
      const outArray = out.array;
      
      for (let i = 0, n = got * 2; i < n; i++) {
        outArray[i] = tempArray[i] * this.volume;
      }
    }
    
    this.Superpowered.free(tempBuffer);
  }
}

registerProcessor("PlayerProcessor", PlayerProcessor);