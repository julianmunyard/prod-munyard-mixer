class SuperpoweredRegion {
  startFrameOffset = 0;
  bufferPointer = 0;
  terminated = false;
  scratchingActive = false;
  justSeekedSamples = 0;
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
    // Enable seamless looping at the end of file
    this.player.loopOnEOF = true;
    try {
      // Prefer explicit loop points once duration is known (set in track.loadAudio)
      // loopBetween(0, endMs, true) is called there; keep loopOnEOF as a fallback here
    } catch {}
    
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

  // Call when timeline performs a discrete seek
  onSeek() {
    // Mute one block to prevent overlap/echo from pre-seek buffer
    this.justSeekedSamples = this.numOfFrames;
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

  // ==================== 🎧 DJ Scratching Methods ====================
  
  /**
   * Start scratching mode
   * Call this when user starts dragging the scrubber
   */
  scratchBegin() {
    // Store the current state before entering scratch mode
    this.wasPlayingBeforeScratch = this.playing;
    
    // Pause the player to prevent normal progression
    this.player.pause();
    
    // DISABLE time-stretching for vinyl-style scratching
    // This makes the pitch change with speed (like a real turntable!)
    this.player.timeStretching = false;
    this.scratchingActive = true;
    
    console.log(`🎧 Vinyl scratch mode started for region ${this.id}`);
  }

  /**
   * Update scratch position with velocity
   * @param {number} velocity - Playback rate (-10 to 10, negative = reverse)
   * @param {number} positionMs - Position in milliseconds
   */
  scratchMove(velocity, positionMs) {
    if (!this.scratchingActive) return;
    
    // For vinyl-style scratching, we let the velocity control the playback rate
    // The pitch will naturally change with speed (like a real turntable!)
    
    const absVelocity = Math.abs(velocity);
    
    // Scale velocity for more natural scratching feel
    // Apply a curve to make slow scratches more controllable
    let scratchRate = absVelocity;
    if (absVelocity < 1) {
      // Slow movements: use a gentler curve
      scratchRate = absVelocity * 0.7;
    } else {
      // Fast movements: allow more range
      scratchRate = 0.7 + (absVelocity - 1) * 0.5;
    }
    
    // Clamp to reasonable range (0.1x to 8x for vinyl-like scratching)
    scratchRate = Math.max(0.1, Math.min(8, scratchRate));
    
    // Set playback rate (pitch will change naturally!)
    this.player.playbackRate = scratchRate;
    
    // Seek to the position
    this.player.setPosition(positionMs);
    
    // Always play during scratching to create the "rarrrrr" sound
    this.player.play();
    
    // console.log(`🎧 Vinyl scratch: velocity=${velocity.toFixed(2)}, rate=${scratchRate.toFixed(2)}, pos=${positionMs.toFixed(0)}ms`);
  }

  /**
   * End scratching mode
   * Call this when user releases the scrubber
   */
  scratchEnd() {
    this.scratchingActive = false;
    
    // Reset to normal playback rate
    this.player.playbackRate = 1.0;
    
    // Restore previous time-stretching setting (usually false for natural mode)
    this.player.timeStretching = false;
    
    // Resume playback if it was playing before scratching
    if (this.wasPlayingBeforeScratch) {
      this.player.play();
    } else {
      this.player.pause();
    }
    
    console.log(`🎧 Scratch mode ended for region ${this.id}, resuming ${this.wasPlayingBeforeScratch ? 'playback' : 'pause'}`);
  }

  terminate() {
    this.terminated = true;
    this.player.destruct();
    // Free the player buffer to prevent memory leaks
    if (this.playerBuffer) {
      this.playerBuffer.free();
      this.playerBuffer = null;
    }
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
        
        // If we just seeked, skip mixing for the next block to avoid echo
        if (this.justSeekedSamples > 0) {
          // Consume one block worth of samples
          this.justSeekedSamples = Math.max(0, this.justSeekedSamples - (outputBuffer.array.length - sampleOffset) / 2);
        } else {
          // Add dry signal to output buffer
          for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
            outputBuffer.array[i] += this.playerBuffer.array[i] * volume;
          }
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
