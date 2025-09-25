class SuperpoweredRegion {
  startFrameOffset = 0;
  bufferPointer = 0;
  terminated = false;
  volume = 1.0;
  muted = false;
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

  processRegion(inputBuffer, outputBuffer, volume = 1.0, muted = false) {
    // We're not doing anything with the input audio in this example!
    if (!this.terminated) {
      this.player.processStereo(
        this.playerBuffer.pointer,
        true,
        this.numOfFrames - this.startFrameOffset,
        0.5
      );

      // Use the region's own volume property if it exists, otherwise use the passed volume
      const finalVolume = this.volume !== undefined ? this.volume : volume;
      const finalMuted = this.muted !== undefined ? this.muted : muted;

      // Apply volume and mute before adding to output buffer
      if (!finalMuted) {
        const sampleOffset = this.startFrameOffset * 2;
        for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
          outputBuffer.array[i] += this.playerBuffer.array[i] * finalVolume;
        }
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
}

export default SuperpoweredRegion;

