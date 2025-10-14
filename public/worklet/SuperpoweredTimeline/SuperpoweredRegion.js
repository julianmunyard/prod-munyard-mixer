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
    
    // Initialize varispeed properties on the AdvancedAudioPlayer
    this.player.playbackRate = 1.0; // Start at normal speed
    this.player.timeStretching = false; // Start with Natural mode (speed and pitch change together)
    this.player.pitchShiftCents = 0; // No pitch shift initially
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

  setVarispeed(speed, isNatural) {
    // Apply varispeed using AdvancedAudioPlayer built-in properties
    this.player.playbackRate = speed;
    
    if (isNatural) {
      // Natural mode: speed and pitch change together (disable time-stretching)
      this.player.timeStretching = false;
      this.player.pitchShiftCents = 0;
    } else {
      // Stretch mode: enable time-stretching to maintain original pitch
      this.player.timeStretching = true;
      this.player.pitchShiftCents = 0; // Time-stretching handles pitch compensation automatically
    }
    
    console.log(`🎛️ Region ${this.id} varispeed set to: ${speed} (natural: ${isNatural}, timeStretching: ${this.player.timeStretching})`);
  }

  terminate() {
    this.terminated = true;
    this.player.destruct();
  }

  processRegion(inputBuffer, outputBuffer, volume = 1.0, muted = false, reverb = null, reverbInputBuffer = null, reverbOutputBuffer = null) {
    // We're not doing anything with the input audio in this example!
    if (!this.terminated) {
      // Get audio from the player (AdvancedAudioPlayer handles time-stretching internally)
      this.player.processStereo(
        this.playerBuffer.pointer,
        true,
        this.numOfFrames - this.startFrameOffset,
        0.5
      );

      // Apply volume and mute before adding to output buffer
      if (!muted) {
        const sampleOffset = this.startFrameOffset * 2;
        
        // Add dry signal to output buffer
        for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
          outputBuffer.array[i] += this.playerBuffer.array[i] * volume;
        }
        
        // If reverb is enabled, also add reverb send
        if (reverb && reverb.enabled && reverb.mix > 0 && reverbInputBuffer && reverbOutputBuffer) {
          // Use pre-allocated buffers (passed from track - NO allocation in audio loop!)
          // Clear the buffers before use
          this.Superpowered.memorySet(reverbInputBuffer.pointer, 0, outputBuffer.array.length * 4);
          this.Superpowered.memorySet(reverbOutputBuffer.pointer, 0, outputBuffer.array.length * 4);
          
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
