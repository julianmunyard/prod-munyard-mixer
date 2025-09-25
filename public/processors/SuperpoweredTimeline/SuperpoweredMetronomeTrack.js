class SuperpoweredMetronomeTrack {
  playing = false;
  regions = [];
  bpm = 120;
  enabled = false;
  startFrameOffset = 0;
  terminated = false;

  constructor(id, samplerate, numOfFrames, superpowered) {
    this.id = id;
    this.samplerate = samplerate;
    this.Superpowered = superpowered;
    this.numOfFrames = numOfFrames;
    this.playerBuffer = new this.Superpowered.Float32Buffer(
      this.numOfFrames * 2
    );
    this.blipPlayer = new this.Superpowered.AdvancedAudioPlayer(
      this.samplerate,
      2,
      2,
      0,
      0.501,
      2,
      false
    );
  }

  loadBlipBuffer(buffer) {
    this.blipPlayer.openMemory(
      this.Superpowered.arrayBufferToWASM(buffer),
      false,
      false
    );
  }

  setTempo(bpm) {
    this.bpm = bpm;
    const oneMinuteMs = 60000;
    const oneBeatMs = oneMinuteMs / bpm;
    this.oneBeatSamples = Math.round((this.samplerate / 1000) * oneBeatMs);
  }

  terminate() {
    this.terminated = true;
    this.blipPlayer.destruct();
  }

  processMetronome(inputBuffer, outputBuffer, currentFrameCursor, buffersize) {
    if (this.enabled && !this.terminated) {
      this.startFrameOffset = 0;

      // Silence the region output buffer, removes memory garbage
      this.Superpowered.memorySet(this.playerBuffer.pointer, 0, buffersize * 8); // 8 bytes for each frame (1 channel is 4 bytes, two channels)
      // console.log(currentFrameCursor, this.oneBeatSamples);
      const diff = currentFrameCursor % this.oneBeatSamples;
      // Determine the play state of the region from the timeline data
      if (diff === 0) {
        // console.log(
        //   "Metronome starts on exact buffer interval in timeline",
        //   this.startFrameOffset
        // );
        this.blipPlayer.setPosition(0);
        this.playing = true;
      } else if (diff < 128) {
        this.startFrameOffset = diff;
        // console.log(
        //   "Metronome starts after exact buffer interval in timeline",
        //   this.startFrameOffset
        // );
        this.blipPlayer.setPosition(0);
        this.playing = true;
      }

      if (this.playing) {
        this.blipPlayer.play();

        this.blipPlayer.processStereo(
          this.playerBuffer.pointer,
          true,
          this.numOfFrames - this.startFrameOffset,
          0.5
        );

        // Add audio date into outputBuffer
        const sampleOffset = this.startFrameOffset * 2;
        for (let i = sampleOffset; i < outputBuffer.array.length; i++) {
          outputBuffer.array[i] += this.playerBuffer.array[i];
        }
      }
    }
  }
}

export default SuperpoweredMetronomeTrack;
