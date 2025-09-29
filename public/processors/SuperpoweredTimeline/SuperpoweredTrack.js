import SuperpoweredRegion from "./SuperpoweredRegion.js";

class SuperpoweredTrack {
  playing = false;
  regions = [];
  volume = 1.0;
  muted = false;
  soloed = false;
  // Note: Reverb is now handled by shared reverb in SuperpoweredTimeline
  // Individual reverb instances removed for CPU efficiency

  constructor(id, samplerate, numOfFrames, superpowered) {
    this.id = id;
    this.samplerate = samplerate;
    this.Superpowered = superpowered;
    this.numOfFrames = numOfFrames;

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
    
    console.log(`🎛️ Initialized track ${this.id} with shared reverb system`);
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
      }
    }
  }

  terminate() {
    for (const region of this.regions) {
      region.terminate();
    }
    this.regions = [];
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
        
        // Process the region with volume, mute, reverb, and flanger parameters
        region.processRegion(inputBuffer, outputBuffer, this.volume, !shouldPlay, this.reverb, this.flanger);
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

  // ==================== 🎛️ Reverb Control Methods ====================
  setReverbEnabled(enabled) {
    if (this.reverb) {
      this.reverb.enabled = enabled;
      console.log(`🎛️ Track ${this.id} reverb enabled: ${enabled}`);
    }
  }

  setReverbMix(mix) {
    // Store reverb send level for this track
    this.reverbSendLevel = Math.max(0, Math.min(1, mix));
    console.log(`🎛️ Track ${this.id} reverb send level set to:`, this.reverbSendLevel);
  }

  setReverbRoomSize(roomSize) {
    // Note: Room size is now controlled by shared reverb in SuperpoweredTimeline
    console.log(`🎛️ Track ${this.id} reverb room size request:`, roomSize, "(handled by shared reverb)");
  }

  setReverbDamp(damp) {
    // Note: Damp is now controlled by shared reverb in SuperpoweredTimeline
    console.log(`🎛️ Track ${this.id} reverb damp request:`, damp, "(handled by shared reverb)");
  }

  setReverbWidth(width) {
    // Note: Width is now controlled by shared reverb in SuperpoweredTimeline
    console.log(`🎛️ Track ${this.id} reverb width request:`, width, "(handled by shared reverb)");
  }

  setReverbPredelay(predelayMs) {
    // Note: Predelay is now controlled by shared reverb in SuperpoweredTimeline
    console.log(`🎛️ Track ${this.id} reverb predelay request:`, predelayMs, "(handled by shared reverb)");
  }

  setReverbLowCut(lowCutHz) {
    // Note: Low cut is now controlled by shared reverb in SuperpoweredTimeline
    console.log(`🎛️ Track ${this.id} reverb low cut request:`, lowCutHz, "(handled by shared reverb)");
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
}

export default SuperpoweredTrack;
