import SuperpoweredRegion from "./SuperpoweredRegion.js";

class SuperpoweredTrack {
  playing = false;
  regions = [];
  volume = 1.0;
  muted = false;
  soloed = false;
  reverb = null;
  reverbEnabled = false;

  constructor(id, samplerate, numOfFrames, superpowered) {
    this.id = id;
    this.samplerate = samplerate;
    this.Superpowered = superpowered;
    this.numOfFrames = numOfFrames;
    
    // Initialize reverb effect
    this.reverb = new this.Superpowered.Reverb(samplerate, 44100);
    this.reverb.enabled = false;
    this.reverb.mix = 0.0;    // No mix initially (this sets dry/wet automatically)
    this.reverb.roomSize = 0.8;
    this.reverb.damp = 0.5;
    this.reverb.width = 1.0;
    this.reverb.reverbPredelayMs = 0;
    this.reverb.lowCutHz = 0;

    // Initialize flanger effect
    this.flanger = new this.Superpowered.Flanger(samplerate);
    this.flanger.enabled = false;
    this.flanger.wet = 0.7;
    this.flanger.depth = 0.16;
    this.flanger.lfoBeats = 16;
    this.flanger.bpm = 128;
    this.flanger.clipperThresholdDb = -3;
    this.flanger.clipperMaximumDb = 6;
    this.flanger.stereo = false;
    
    console.log(`🎛️ Initialized reverb for track ${this.id} with dry: ${this.reverb.dry}, wet: ${this.reverb.wet}, mix: ${this.reverb.mix}`);
    
    // Pre-allocate reverb buffers (NEVER allocate in audio loop!)
    this.reverbInputBuffer = new this.Superpowered.Float32Buffer(numOfFrames * 2);
    this.reverbOutputBuffer = new this.Superpowered.Float32Buffer(numOfFrames * 2);
  }

  addPlayer(regionData) {
    const region = new SuperpoweredRegion(
      regionData,
      this.samplerate,
      this.numOfFrames,
      this.Superpowered
    );
    this.regions.push(region);
  }

  loadAudio(url, buffer) {
    for (const region of this.regions) {
      if (region.url === url) {
        //store the pointer, we use this later to clear up the memoery
        const regionPointer = this.Superpowered.arrayBufferToWASM(buffer);
        region.player.openMemory(regionPointer, false, false);
        region.regionPointer = regionPointer;
        
        // Try multiple methods to get the duration
        let durationSeconds = 0;
        
        // Method 1: Try player's durationMs property (authoritative if present)
        const playerMs = region.player.durationMs || 0;
        if (playerMs > 0) {
          durationSeconds = playerMs / 1000;
          console.log(`✅ Got duration from player.durationMs: ${durationSeconds.toFixed(2)}s`);
        } else {
          // Method 2: Try AudioInMemory API; different Superpowered builds may return
          // either total interleaved samples or frames. Compute both candidates and pick best.
          const sizeInSamples = this.Superpowered.AudioInMemory.getSize(regionPointer);
          const sampleRate = this.Superpowered.AudioInMemory.getSamplerate(regionPointer);
          if (sizeInSamples > 0 && sampleRate > 0) {
            const candidateFrames = sizeInSamples / sampleRate; // if value is frames
            const candidateInterleaved = sizeInSamples / (sampleRate * 2); // if value is total samples (stereo)
            // Pick a sane value (> 1s) and prefer the smaller (safer upper bound)
            const candidates = [candidateFrames, candidateInterleaved].filter(v => v > 1);
            durationSeconds = candidates.length ? Math.min(...candidates) : 0;
            console.log(`✅ Duration heuristic: frames=${candidateFrames.toFixed(2)}s interleaved=${candidateInterleaved.toFixed(2)}s → chosen ${durationSeconds.toFixed(2)}s`);
          } else {
            console.error(`❌ Could not get duration for region ${region.id} - sizeInSamples: ${sizeInSamples}, sampleRate: ${sampleRate}`);
          }
        }
        
        if (durationSeconds > 0) {
          region.audioDuration = durationSeconds;
          console.log(`✅ Audio duration for region ${region.id}: ${durationSeconds.toFixed(2)}s`);
        } else {
          console.error(`❌ Failed to get duration for region ${region.id}`);
        }
      }
    }
  }

  terminate() {
    for (const region of this.regions) {
      region.terminate();
    }
    this.regions = [];
    
    // Clean up reverb resources
    if (this.reverb) {
      this.reverb.destruct();
      this.reverb = null;
    }
    
    // Clean up pre-allocated reverb buffers
    if (this.reverbInputBuffer) {
      this.reverbInputBuffer.free();
      this.reverbInputBuffer = null;
    }
    if (this.reverbOutputBuffer) {
      this.reverbOutputBuffer.free();
      this.reverbOutputBuffer = null;
    }
    
    // Clean up flanger
    if (this.flanger) {
      this.flanger.destruct();
      this.flanger = null;
    }
  }

  updateRegions(newRegionsData) {
    for (const regionData of newRegionsData) {
      const region = this.regions.find((r) => r.id === regionData.id);
      region.update(regionData);
    }
  }

  processTrack(inputBuffer, outputBuffer, currentFrameCursor, buffersize, timeline) {
    // We're not doing anythign with the input buffers yet!

    for (const [index, region] of this.regions.entries()) {
      // Reset the regions offset beofre calculating the next one
      region.startFrameOffset = 0;

      // Silence the region output buffer, removes memory garbage
      this.Superpowered.memorySet(
        region.playerBuffer.pointer,
        0,
        buffersize * 8
      ); // 8 bytes for each frame (1 channel is 4 bytes, two channels)

      // Determine the play state of the region from the timeline data
      if (currentFrameCursor === region.frameStart) {
        // console.log(
        //   "Region starts on exact buffer interval in timeline",
        //   region.startFrameOffset
        // );
        region.resetPosition();
        region.playing = true;
      } else if (
        region.frameStart > currentFrameCursor &&
        region.frameStart < currentFrameCursor + 128
      ) {
        region.startFrameOffset = Math.floor(
          region.frameStart - currentFrameCursor
        );
        // console.log(
        //   "Region starts after exact buffer interval in timeline",
        //   region.startFrameOffset
        // );
        region.playing = true;
      }

      if (currentFrameCursor >= region.frameEnd && region.playing) {
        // console.log("Pausing region player", region.id);
        region.playing = false;
        region.pause();
      }

      if (region.playing) {
        // console.log("Region shuyld play from offset", region.startFrameOffset);
        region.play();
        
        // Determine if this track should be audible (not muted and either soloed or no solo active)
        const shouldPlay = !this.muted && (this.soloed || !this.isAnyTrackSoloed(timeline));
        
        // Process the region with volume, mute, reverb, and pre-allocated buffers (flanger is now global)
        region.processRegion(inputBuffer, outputBuffer, this.volume, !shouldPlay, this.reverb, this.reverbInputBuffer, this.reverbOutputBuffer);
      }
    }
    
  }

  // Helper method to check if any track is soloed
  isAnyTrackSoloed(timeline) {
    if (!timeline) return false;
    return timeline.tracks.some(track => track.soloed);
  }

  // ==================== 🎛️ Audio Control Methods ====================
  setVolume(volume) {
    this.volume = volume;
    console.log(`🎛️ Track ${this.id} volume set to: ${volume}`);
  }

  setMute(muted) {
    this.muted = muted;
  }

  setSolo(soloed) {
    this.soloed = soloed;
  }

  setVarispeed(speed, isNatural) {
    // Apply varispeed to all regions in this track
    this.regions.forEach(region => {
      region.setVarispeed(speed, isNatural);
    });
    console.log(`🎛️ Track ${this.id} varispeed set to: ${speed} (natural: ${isNatural})`);
  }

  // ==================== 🎛️ Reverb Control Methods ====================
  setReverbEnabled(enabled) {
    if (this.reverb) {
      this.reverb.enabled = enabled;
      console.log(`🎛️ Track ${this.id} reverb enabled: ${enabled}`);
    }
  }

  setReverbMix(mix) {
    if (this.reverb) {
      this.reverb.mix = mix;
      // Enable reverb if mix > 0, disable if mix = 0
      this.reverb.enabled = mix > 0;
      // The mix property automatically sets dry/wet values
      console.log(`🎛️ Track ${this.id} reverb mix: ${mix}, enabled: ${this.reverb.enabled}, dry: ${this.reverb.dry}, wet: ${this.reverb.wet}`);
    }
  }

  setReverbRoomSize(roomSize) {
    if (this.reverb) {
      this.reverb.roomSize = roomSize;
    }
  }

  setReverbDamp(damp) {
    if (this.reverb) {
      this.reverb.damp = damp;
    }
  }

  setReverbWidth(width) {
    if (this.reverb) {
      this.reverb.width = width;
      console.log(`🎛️ Track ${this.id} reverb width set to: ${width}, actual value: ${this.reverb.width}`);
    } else {
      console.error(`❌ Track ${this.id} reverb not found`);
    }
  }

  setReverbPredelay(predelayMs) {
    if (this.reverb) {
      this.reverb.reverbPredelayMs = predelayMs;
      console.log(`🎛️ Track ${this.id} reverb pre-delay set to: ${predelayMs}ms, actual value: ${this.reverb.reverbPredelayMs}`);
    } else {
      console.error(`❌ Track ${this.id} reverb not found`);
    }
  }

  setReverbLowCut(lowCutHz) {
    if (this.reverb) {
      this.reverb.lowCutHz = lowCutHz;
    }
  }

  setFlangerConfig(config) {
    if (this.flanger) {
      this.flanger.enabled = config.enabled;
      this.flanger.wet = config.wet;
      this.flanger.depth = config.depth;
      this.flanger.lfoBeats = config.lfoBeats;
      this.flanger.bpm = config.bpm;
      this.flanger.clipperThresholdDb = config.clipperThresholdDb;
      this.flanger.clipperMaximumDb = config.clipperMaximumDb;
      this.flanger.stereo = config.stereo;
      console.log(`🎛️ Track ${this.id} flanger config updated:`, config);
    }
  }

  // ==================== 🎧 DJ Scratching Control ====================
  
  /**
   * Start scratching mode on all regions in this track
   */
  scratchBegin() {
    this.regions.forEach(region => {
      region.scratchBegin();
    });
    console.log(`🎧 Track ${this.id} scratch mode started`);
  }

  /**
   * Update scratch velocity on all regions
   * @param {number} velocity - Playback rate (negative = reverse)
   * @param {number} positionMs - Position in milliseconds
   */
  scratchMove(velocity, positionMs) {
    this.regions.forEach(region => {
      region.scratchMove(velocity, positionMs);
    });
  }

  /**
   * End scratching mode on all regions
   */
  scratchEnd() {
    this.regions.forEach(region => {
      region.scratchEnd();
    });
    console.log(`🎧 Track ${this.id} scratch mode ended`);
  }
}

export default SuperpoweredTrack;
