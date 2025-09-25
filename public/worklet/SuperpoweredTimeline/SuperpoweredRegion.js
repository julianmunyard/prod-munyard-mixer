class SuperpoweredRegion {
  startFrameOffset = 0;
  bufferPointer = 0;
  terminated = false;
  volume = 1.0;
  muted = false;
  flanger = null;
  flangerEnabled = false;
  reverb = null;
  reverbEnabled = false;
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
    
    // Initialize flanger effect
    this.flanger = new this.Superpowered.Flanger(this.samplerate);
    this.flanger.enabled = false;
    
    // Initialize reverb effect
    this.reverb = new this.Superpowered.Reverb(this.samplerate, 48000);
    this.reverb.enabled = false;
    this.reverb.wet = 0.0;
    this.reverb.dry = 1.0;
    this.reverb.roomSize = 0.8;
    this.reverb.damp = 0.5;
    this.reverb.width = 1.0;
    this.reverb.predelayMs = 0;
    this.reverb.lowCutHz = 0;
    
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
    if (this.flanger) {
      this.flanger.destruct();
    }
    if (this.reverb) {
      this.reverb.destruct();
    }
  }

  processRegion(inputBuffer, outputBuffer, volume = 1.0, muted = false) {
    // We're not doing anything with the input audio in this example!
    if (!this.terminated) {
      this.player.processStereo(
        this.playerBuffer.pointer,
        true,
        this.numOfFrames - this.startFrameOffset,
        0.5
      );

      // Apply flanger effect if enabled
      if (this.flanger && this.flangerEnabled) {
        // Ensure samplerate is in sync (required by Superpowered)
        this.flanger.samplerate = this.samplerate;
        
        // Process flanger with separate input and output buffers
        // The flanger can process in-place, but we need to handle the frame offset correctly
        const framesToProcess = this.numOfFrames - this.startFrameOffset;
        const inputPointer = this.playerBuffer.pointer + (this.startFrameOffset * 2 * 4); // 2 channels, 4 bytes per float
        const outputPointer = this.playerBuffer.pointer + (this.startFrameOffset * 2 * 4);
        
        // Process the flanger effect
        const flangerProcessed = this.flanger.process(inputPointer, outputPointer, framesToProcess);
        
        // If flanger returns false (no output), copy input to output
        if (!flangerProcessed) {
          for (let n = 0; n < framesToProcess * 2; n++) {
            this.playerBuffer.array[(this.startFrameOffset * 2) + n] = this.playerBuffer.array[(this.startFrameOffset * 2) + n];
          }
        }
        
        console.log(`🎛️ Region ${this.id} flanger processed: frames=${framesToProcess}, processed=${flangerProcessed}`);
      }

      // Apply reverb effect if enabled
      if (this.reverb && this.reverbEnabled) {
        try {
          // Ensure samplerate is in sync (required by Superpowered)
          this.reverb.samplerate = this.samplerate;
          
          // Create temporary buffer for reverb output to prevent feedback
          const reverbBuffer = new this.Superpowered.Float32Buffer(framesToProcess * 2);
          
          // Copy dry signal to reverb buffer
          this.Superpowered.memoryCopy(reverbBuffer.pointer, this.playerBuffer.pointer + (this.startFrameOffset * 2 * 4), framesToProcess * 8);
          
          // Process reverb with separate input/output buffers
          const reverbProcessed = this.reverb.process(
            this.playerBuffer.pointer + (this.startFrameOffset * 2 * 4),
            reverbBuffer.pointer,
            framesToProcess
          );
          
          if (reverbProcessed) {
            // Mix dry and wet signals properly to prevent crackling
            const wetLevel = this.reverb.wet;
            const dryLevel = this.reverb.dry;
            
            for (let i = 0; i < framesToProcess * 2; i++) {
              const drySample = this.playerBuffer.array[(this.startFrameOffset * 2) + i];
              const wetSample = reverbBuffer.array[i];
              this.playerBuffer.array[(this.startFrameOffset * 2) + i] = (drySample * dryLevel) + (wetSample * wetLevel);
            }
          }
          
          // Clean up temporary buffer
          reverbBuffer.free();
          
          console.log(`🎛️ Region ${this.id} reverb processed: frames=${framesToProcess}, processed=${reverbProcessed}`);
        } catch (error) {
          console.error(`🎛️ Reverb processing error for region ${this.id}:`, error);
        }
      }

      // FORCE TEST: Apply 0.1 volume to first region to test if volume works at all
      let testVolume = 1.0;
      if (this.id === "region_0") {
        testVolume = 0.1; // Force very quiet for first region
        console.log(`🧪 FORCE TEST: Region ${this.id} using test volume ${testVolume}, muted: ${this.muted}, startFrameOffset: ${this.startFrameOffset}`);
      }

      // Apply volume and mute before adding to output buffer
      // Use the passed muted parameter, not the region's own mute property
      if (!muted) {
        const sampleOffset = this.startFrameOffset * 2;
        console.log(`🔊 Region ${this.id} adding audio: sampleOffset=${sampleOffset}, bufferLength=${this.playerBuffer.array.length}, outputLength=${outputBuffer.array.length}`);
        
        for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
          outputBuffer.array[i] += this.playerBuffer.array[i] * testVolume;
        }
      } else {
        console.log(`🔇 Region ${this.id} is muted (passed parameter), not adding audio`);
      }
    }
  }

  // Direct volume control method
  setVolume(volume) {
    this.volume = volume;
    console.log(`🔊 Region ${this.id} volume set to: ${volume}`);
  }

  // Direct mute control method
  setMute(muted) {
    this.muted = muted;
    console.log(`🔊 Region ${this.id} muted set to: ${muted}`);
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

  setVarispeed(speed, isNatural) {
    // Set varispeed on the Superpowered player
    if (this.player) {
      this.player.setTempo(speed, isNatural);
    }
  }

  // Flanger control methods
  setFlangerConfig(config) {
    if (this.flanger) {
      this.flanger.wet = config.wet;
      this.flanger.depth = config.depth;
      this.flanger.lfoBeats = config.lfoBeats;
      this.flanger.bpm = config.bpm;
      this.flanger.clipperThresholdDb = config.clipperThresholdDb;
      this.flanger.clipperMaximumDb = config.clipperMaximumDb;
      this.flanger.stereo = config.stereo;
      this.flanger.enabled = config.enabled;
      this.flangerEnabled = config.enabled;
      console.log(`🎛️ Region ${this.id} flanger config updated:`, config);
    }
  }

  setFlangerEnabled(enabled) {
    if (this.flanger) {
      this.flanger.enabled = enabled;
      this.flangerEnabled = enabled;
      console.log(`🎛️ Region ${this.id} flanger enabled:`, enabled);
    }
  }

  // ==================== 🎛️ Reverb Control Methods ====================
  setReverbMix(mix) {
    if (this.reverb) {
      this.reverb.wet = mix;
      this.reverb.dry = 1.0 - mix;
      this.reverb.enabled = mix > 0;
      this.reverbEnabled = mix > 0;
      console.log(`🎛️ Region ${this.id} reverb mix set to:`, mix);
    }
  }

  setReverbPredelay(predelayMs) {
    if (this.reverb) {
      this.reverb.predelayMs = predelayMs;
      console.log(`🎛️ Region ${this.id} reverb predelay set to:`, predelayMs);
    }
  }

  setReverbRoomSize(roomSize) {
    if (this.reverb) {
      this.reverb.roomSize = roomSize;
      console.log(`🎛️ Region ${this.id} reverb room size set to:`, roomSize);
    }
  }

  setReverbWidth(width) {
    if (this.reverb) {
      this.reverb.width = width;
      console.log(`🎛️ Region ${this.id} reverb width set to:`, width);
    }
  }

  setReverbDamp(damp) {
    if (this.reverb) {
      this.reverb.damp = damp;
      console.log(`🎛️ Region ${this.id} reverb damp set to:`, damp);
    }
  }

  // ==================== 🎛️ Global Flanger Control Methods ====================
  setGlobalFlanger(wet) {
    if (this.flanger) {
      this.flanger.wet = wet;
      console.log(`🎛️ Region ${this.id} global flanger wet set to:`, wet);
    }
  }

  setGlobalFlangerEnabled(enabled) {
    if (this.flanger) {
      this.flanger.enabled = enabled;
      this.flangerEnabled = enabled;
      console.log(`🎛️ Region ${this.id} global flanger enabled set to:`, enabled);
    }
  }

  setGlobalFlangerDepth(depth) {
    if (this.flanger) {
      this.flanger.depth = depth;
      console.log(`🎛️ Region ${this.id} global flanger depth set to:`, depth);
    }
  }

  setGlobalFlangerLfoBeats(lfoBeats) {
    if (this.flanger) {
      this.flanger.lfoBeats = lfoBeats;
      console.log(`🎛️ Region ${this.id} global flanger LFO beats set to:`, lfoBeats);
    }
  }

  setGlobalFlangerBpm(bpm) {
    if (this.flanger) {
      this.flanger.bpm = bpm;
      console.log(`🎛️ Region ${this.id} global flanger BPM set to:`, bpm);
    }
  }

  setGlobalFlangerClipperThreshold(threshold) {
    if (this.flanger) {
      this.flanger.clipperThresholdDb = threshold;
      console.log(`🎛️ Region ${this.id} global flanger clipper threshold set to:`, threshold);
    }
  }

  setGlobalFlangerClipperMaximum(maximum) {
    if (this.flanger) {
      this.flanger.clipperMaximumDb = maximum;
      console.log(`🎛️ Region ${this.id} global flanger clipper maximum set to:`, maximum);
    }
  }

  setGlobalFlangerStereo(stereo) {
    if (this.flanger) {
      this.flanger.stereo = stereo;
      console.log(`🎛️ Region ${this.id} global flanger stereo set to:`, stereo);
    }
  }
}

export default SuperpoweredRegion;

