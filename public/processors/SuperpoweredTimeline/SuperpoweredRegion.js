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

  processRegion(inputBuffer, outputBuffer, volume = 1.0, muted = false, reverb = null) {
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
        
        // Add dry signal to output buffer
        for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
          outputBuffer.array[i] += this.playerBuffer.array[i] * volume;
        }
        
        // If reverb is enabled, also add reverb send
        if (reverb && reverb.enabled && reverb.mix > 0) {
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
