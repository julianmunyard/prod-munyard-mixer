import SuperpoweredRegion from "./SuperpoweredRegion.js";

class SuperpoweredTrack {
  playing = false;
  regions = [];
  volume = 1.0;
  muted = false;
  soloed = false;

  constructor(id, samplerate, numOfFrames, superpowered) {
    this.id = id;
    this.samplerate = samplerate;
    this.Superpowered = superpowered;
    this.numOfFrames = numOfFrames;
    this.volume = 1.0;
    this.muted = false;
    this.soloed = false;
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

  processTrack(inputBuffer, outputBuffer, currentFrameCursor, buffersize, timeline = null) {
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
        
        // Process the region audio into its buffer
        region.processRegion(inputBuffer, outputBuffer, buffersize);
        
        // Apply volume, mute, and solo processing
        if (!this.muted && (this.soloed || !this.isAnyTrackSoloed(timeline))) {
          // Apply volume to the region's audio buffer
          const sampleOffset = region.startFrameOffset * 2;
          for (let i = sampleOffset; i < region.playerBuffer.array.length; i++) {
            region.playerBuffer.array[i] *= this.volume;
          }
          
          // Add the processed audio to the output buffer
          region.addToOutputBuffer(outputBuffer);
        }
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
  }

  setMute(muted) {
    this.muted = muted;
  }

  setSolo(soloed) {
    this.soloed = soloed;
  }

  setVarispeed(speed, isNatural) {
    // Update all regions with new varispeed
    this.regions.forEach(region => region.setVarispeed(speed, isNatural));
  }
}

export default SuperpoweredTrack;
