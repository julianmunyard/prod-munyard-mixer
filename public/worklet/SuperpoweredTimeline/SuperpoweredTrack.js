import SuperpoweredRegion from "./SuperpoweredRegion.js";

class SuperpoweredTrack {
  playing = false;
  regions = [];

  constructor(id, samplerate, numOfFrames, superpowered) {
    this.id = id;
    this.samplerate = samplerate;
    this.Superpowered = superpowered;
    this.numOfFrames = numOfFrames;
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

  processTrack(inputBuffer, outputBuffer, currentFrameCursor, buffersize) {
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
        region.processRegion(inputBuffer, outputBuffer, buffersize);
        // Access raw audio buffer of each track
        const preFaderTrackFrameBuffer = outputBuffer.array;
        // console.log(preFaderTrackFrameBuffer);
      }
    }
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
