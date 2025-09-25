class SuperpoweredRegion {
  startFrameOffset = 0;
  bufferPointer = 0;
  terminated = false;
  constructor(regionData, samplerate, numOfFrames, superpowered) {
    this.samplerate = samplerate;
    this.numOfFrames = numOfFrames;
    this.Superpowered = superpowered;

    this.playerBuffer = new this.Superpowered.Float32Buffer(
      this.numOfFrames * 2
    );
    this.player = new this.Superpowered.AdvancedAudioPlayer(
      this.samplerate,
      2,
      2,
      0,
      0.501,
      2,
      false
    );
    this.player.outputSamplerate = this.samplerate;
    this.id = regionData.id;
    this.start = regionData.start;
    this.end = regionData.end;
    this.frameStart = regionData.start * this.samplerate;
    this.frameEnd = regionData.end * this.samplerate;
    this.url = regionData.url;
    this.play();
  }

  update(regionData) {
    this.start = regionData.start;
    this.end = regionData.end;
    this.frameStart = regionData.start * this.samplerate;
    this.frameEnd = regionData.end * this.samplerate;
    this.url = regionData.url;
  }

  play() {
    this.player.play();
  }

  pause() {
    this.player.pause();
  }

  resetPosition() {
    this.player.setPosition(0);
  }

  setPositionMs(positionMs) {
    this.player.setPosition(positionMs);
  }

  terminate() {
    this.terminated = true;
    this.player.destruct();
  }

  processRegion(inputBuffer, outputBuffer, volume = 1.0, muted = false, reverb = null, flanger = null) {
    // We're not doing anything with the input audio in this example!
    if (!this.terminated) {
      this.player.processStereo(
        this.playerBuffer.pointer,
        true,
        this.numOfFrames - this.startFrameOffset,
        0.5
      );

      // Apply volume and mute before adding to output buffer
      if (!muted) {
        const sampleOffset = this.startFrameOffset * 2;
        if (this.id === "region_0" && volume !== 1.0) {
          console.log(`🔊 Region ${this.id} applying volume: ${volume}`);
        }
        
        // Add dry signal to output buffer
        for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
          outputBuffer.array[i] += this.playerBuffer.array[i] * volume;
        }
        
        // If reverb is enabled, also add reverb send
        if (reverb && reverb.enabled && reverb.mix > 0) {
          console.log(`🎛️ Adding reverb send for region ${this.id}, mix: ${reverb.mix}`);
          
          // Create a temporary buffer for reverb processing using Superpowered buffer
          const reverbInputBuffer = new this.Superpowered.Float32Buffer(outputBuffer.array.length);
          const reverbOutputBuffer = new this.Superpowered.Float32Buffer(outputBuffer.array.length);
          
          // Copy region audio to reverb input buffer
          for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
            reverbInputBuffer.array[i] = this.playerBuffer.array[i] * volume;
          }
          
          // Process through reverb using pointers (like the example)
          reverb.samplerate = this.samplerate;
          const bufferSize = (outputBuffer.array.length - sampleOffset) / 2;
          
          if (reverb.process(reverbInputBuffer.pointer, reverbOutputBuffer.pointer, bufferSize)) {
            // Add the reverb output to the main output buffer
            for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
              outputBuffer.array[i] += reverbOutputBuffer.array[i];
            }
            console.log(`🎛️ Reverb send added to region ${this.id}`);
          }
        }

        // If flanger is enabled, apply flanger effect
        if (flanger && flanger.enabled) {
          console.log(`🎛️ Adding flanger effect for region ${this.id}`);
          
          // Create a temporary buffer for flanger processing
          const flangerInputBuffer = new this.Superpowered.Float32Buffer(outputBuffer.array.length);
          const flangerOutputBuffer = new this.Superpowered.Float32Buffer(outputBuffer.array.length);
          
          // Copy region audio to flanger input buffer
          for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
            flangerInputBuffer.array[i] = this.playerBuffer.array[i] * volume;
          }
          
          // Process through flanger using pointers
          flanger.samplerate = this.samplerate;
          const bufferSize = (outputBuffer.array.length - sampleOffset) / 2;
          
          if (flanger.process(flangerInputBuffer.pointer, flangerOutputBuffer.pointer, bufferSize)) {
            // Replace the output with flanger output
            for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
              outputBuffer.array[i] = flangerOutputBuffer.array[i];
            }
            console.log(`🎛️ Flanger effect applied to region ${this.id}`);
          }
        }
      }
    }
  }

  downloadBuffer() {
    const sampleRate = this.Superpowered.AudioInMemory.getSamplerate(
      this.regionPointer
    );
    const arrayBuffer = this.Superpowered.copyWASMToArrayBuffer(
      this.regionPointer,
      this.Superpowered.AudioInMemory.getSize(this.regionPointer) * 4
    );
    return {
      arrayBuffer,
      sampleRate,
    };
  }
}

export default SuperpoweredRegion;
