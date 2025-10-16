import SuperpoweredTrack from "./SuperpoweredTrack.js";
import SuperpoweredMetronomeTrack from "./SuperpoweredMetronomeTrack.js";

class SuperpoweredTimeline {
  timelineData;
  Superpowered;
  samplerate;
  tracks = [];
  currentFrameCursor = 0;

  constructor(
    samplerate,
    numOfFrames,
    cursorUpdateFrequencyRatio,
    superpowered,
    processorScope
  ) {
    this.samplerate = samplerate;
    this.numOfFrames = numOfFrames;
    this.cursorUpdateFrequencyRatio = cursorUpdateFrequencyRatio;
    this.Superpowered = superpowered;
    this.processorScope = processorScope;
    this.trackLoaderID = Date.now();
    this.totalAssetsToFetch = 0;
    this.assetsDownloaded = 0;
    this.maxAudioDuration = 0; // Track the longest audio duration for looping
    this.lastCursorUpdateFrame = 0; // Track when we last sent a cursor update
    this.currentPlaybackRate = 1.0; // Global varispeed factor
    this.varispeedNatural = false; // If true, duration scales with rate
    
    // Initialize GLOBAL flanger effect (applied to final mix output)
    this.globalFlanger = new this.Superpowered.Flanger(samplerate);
    this.globalFlanger.enabled = false;
    this.globalFlanger.wet = 0.5; // Start at 50% wet when enabled
    this.globalFlanger.depth = 0.16; // 0-1, default 0.16
    this.globalFlanger.lfoBeats = 16; // 0.25-128, default 16
    this.globalFlanger.bpm = 128; // 40-250, default 128
    this.globalFlanger.clipperThresholdDb = -3; // Default -3
    this.globalFlanger.clipperMaximumDb = 6; // Default 6
    this.globalFlanger.stereo = true; // Use stereo for better effect
    
    // Pre-allocate flanger buffer (never allocate in audio loop!)
    this.flangerBuffer = new this.Superpowered.Float32Buffer(numOfFrames * 2);
    
    // Disable post-loop fade to avoid any perceived dip
    this.fadeInSamples = 0;
    this.justLoopedSamplesRemaining = 0;
  }

  handleLoadTimeline(timelineData) {
    this.timelineData = timelineData;

    // Create tracks in timeline
    for (const timelineTrack of this.timelineData.tracks) {
      const track = new SuperpoweredTrack(
        timelineTrack.id,
        this.samplerate,
        this.numOfFrames,
        this.Superpowered
      );
      for (const action of timelineTrack.actions) {
        this.totalAssetsToFetch++;
        track.addPlayer(action);
        console.log(`🎵 Starting download/decode for stem ${this.totalAssetsToFetch}/${this.timelineData.tracks.length}: ${action.url}`);
        this.Superpowered.downloadAndDecode(action.url, this.processorScope);
      }
      this.tracks.push(track);
    }

    //Create metronome track
    if (this.timelineData.metronome) {
      this.setupMetronome();
    }
  }

  setupMetronome() {
    this.metronomeTrack = new SuperpoweredMetronomeTrack(
      "metronome",
      this.samplerate,
      this.numOfFrames,
      this.Superpowered
    );

    this.Superpowered.downloadAndDecode(
      this.timelineData.metronome.blipUrl,
      this.processorScope
    );
    this.totalAssetsToFetch++;
  }

  loadAsset(SuperpoweredLoaded) {
    if (SuperpoweredLoaded) {
      for (const track of this.tracks) {
        for (const region of track.regions) {
          if (region.url === SuperpoweredLoaded.url) {
            track.loadAudio(SuperpoweredLoaded.url, SuperpoweredLoaded.buffer);
            SuperpoweredLoaded.buffer = null;
            console.log(`✅ Stem ${this.assetsDownloaded + 1}/${this.totalAssetsToFetch} decoded and loaded: ${region.id}`);
            
            // Track the longest audio duration for looping
            if (region.audioDuration && region.audioDuration > this.maxAudioDuration) {
              this.maxAudioDuration = region.audioDuration;
              console.log(`📏 Updated max audio duration: ${this.maxAudioDuration.toFixed(2)}s`);
            }
          }
        }
      }
      if (this.timelineData.metronome) {
        if (this.timelineData.metronome.blipUrl === SuperpoweredLoaded.url) {
          this.metronomeTrack.loadBlipBuffer(SuperpoweredLoaded.buffer);
          console.log(`✅ Metronome blip decoded and loaded`);
        }
      }
      this.assetsDownloaded++;
      
      // Send progress update to main thread
      this.processorScope.sendMessageToMainScope({
        event: "stem-decoded",
        data: {
          decodedCount: this.assetsDownloaded,
          totalCount: this.totalAssetsToFetch
        }
      });
    }

    if (this.assetsDownloaded === this.totalAssetsToFetch) {
      console.log(`🎉 All ${this.totalAssetsToFetch} stems decoded and ready!`);
      
      // Update timeline duration to match the longest audio file
      if (this.maxAudioDuration > 0) {
        const effective = this.varispeedNatural ? (this.maxAudioDuration / Math.max(0.001, this.currentPlaybackRate)) : this.maxAudioDuration;
        this.timelineData.duration = effective;
        console.log(`🔄 Timeline duration set to ${effective.toFixed(2)}s for looping (base=${this.maxAudioDuration.toFixed(2)}s, rate=${this.currentPlaybackRate}, natural=${this.varispeedNatural})`);
        
        // Update all region end times to match the audio duration
        for (const track of this.tracks) {
          for (const region of track.regions) {
            region.end = this.maxAudioDuration;
            region.frameEnd = this.maxAudioDuration * this.samplerate;
          }
        }
        
      // Send base and effective durations to main thread
      this.processorScope.sendMessageToMainScope({
        event: "timeline-base-duration-set",
        data: { duration: this.maxAudioDuration }
      });
      this.processorScope.sendMessageToMainScope({
        event: "timeline-duration-set",
        data: { duration: this.timelineData.duration }
      });
      }
      
      this.processorScope.allAssetsDownloaded();
    }
  }

  processTimeline(inputBuffer, outputBuffer, buffersize) {
    this.Superpowered.memorySet(outputBuffer.pointer, 0, buffersize * 8); // 8 bytes for each frame (1 channel is 4 bytes, two channels)
    // Process audio tracks
    for (const track of this.tracks) {
      track.processTrack(
        inputBuffer,
        outputBuffer,
        this.currentFrameCursor,
        buffersize,
        this
      );
    }

    // Process metronome track (only if it exists)
    if (this.metronomeTrack) {
      this.metronomeTrack.processMetronome(
        inputBuffer,
        outputBuffer,
        this.currentFrameCursor,
        buffersize
      );
    }

    // Apply GLOBAL flanger to the final mixed output (if enabled)
    if (this.globalFlanger && this.globalFlanger.enabled) {
      // Update samplerate (required by Superpowered for every process call)
      this.globalFlanger.samplerate = this.samplerate;
      
      // Process flanger in-place (input and output can be the same buffer)
      // According to Superpowered docs: "Can point to the same location with input (in-place processing)"
      this.globalFlanger.process(outputBuffer.pointer, outputBuffer.pointer, buffersize);
    }

    // Apply a tiny fade-in on the first buffer after looping to avoid any residual click
    if (this.justLoopedSamplesRemaining > 0) {
      const samplesToFade = Math.min(this.justLoopedSamplesRemaining, buffersize);
      const total = samplesToFade;
      for (let i = 0; i < total; i++) {
        const gain = i / total; // 0..1 ramp
        const base = i * 2;
        outputBuffer.array[base] *= gain;
        outputBuffer.array[base + 1] *= gain;
      }
      this.justLoopedSamplesRemaining -= samplesToFade;
    }

    // Freeze timeline cursor while scratching to avoid double-audio feel
    if (!this.isScratching) {
      this.currentFrameCursor += buffersize;
    }
    
    // Check if we've reached the end of the timeline and loop if needed
    if (this.timelineData && this.timelineData.duration) {
      const timelineEndFrame = Math.ceil(this.timelineData.duration * this.samplerate);
      if (this.currentFrameCursor >= timelineEndFrame) {
        // Wrap cursor modulo end to avoid dropping a partial buffer and ensure no early cutoff
        this.currentFrameCursor = this.currentFrameCursor - timelineEndFrame;
        this.justLoopedSamplesRemaining = this.fadeInSamples;
        this.lastCursorUpdateFrame = 0;
        console.log('🔄 Timeline looped back to beginning');
        // Immediately send cursor update after looping
        this.processorScope.sendTimelineFrameCursorUpdate(this.currentFrameCursor);
      }
    }
    
    // ✅ FIX: Check frames elapsed since LAST update, not absolute cursor position
    // This ensures cursor updates continue after seeking to any position
    const updateInterval = buffersize * this.cursorUpdateFrequencyRatio;
    const framesSinceLastUpdate = this.currentFrameCursor - this.lastCursorUpdateFrame;
    
    if (framesSinceLastUpdate >= updateInterval) {
      this.processorScope.sendTimelineFrameCursorUpdate(this.currentFrameCursor);
      this.lastCursorUpdateFrame = this.currentFrameCursor;
    }
    
    return true;
  }

  handleCommand(message) {
    if (message.command === "play") {
      // this.currentFrameCursor = 0;
    }
    if (message.command === "updateCursor") {
      // Here we handle the updated cursor position
      const seekTimeSeconds = message.cursorSec;
      this.currentFrameCursor = Math.floor(seekTimeSeconds * this.samplerate);
      
      // Seek all regions to the correct position in their audio
      // This is critical for seeking to work properly
      for (const track of this.tracks) {
        for (const region of track.regions) {
          // Calculate the position within the region
          // Since all regions start at 0, the seek position is just the timeline time
          const regionPositionMs = seekTimeSeconds * 1000;
          
          // Pause first to avoid overlap, then position, then resume if in-bounds
          region.pause();
          region.setPositionMs(regionPositionMs);
          if (typeof region.onSeek === 'function') region.onSeek();
          
          if (this.currentFrameCursor >= region.frameStart && this.currentFrameCursor < region.frameEnd) {
            region.playing = true;
            region.play();
          } else {
            region.playing = false;
            // stay paused when out of bounds
          }
        }
      }
      
      // ✅ CRITICAL FIX: Reset the last update frame tracker so cursor updates continue from new position
      this.lastCursorUpdateFrame = this.currentFrameCursor;
      
      // DON'T immediately send cursor update after seeking - let the UI control the position
    }
    if (message.command === "updateMetronome") {
      this.metronomeTrack.setTempo(message.bpm);
      this.metronomeTrack.enabled = message.metronomeEnabled;
    }
    if (message.command === "requestRegionBufferData") {
      const track = this.tracks.find((t) => t.id === message.trackId);
      for (const region of track.regions) {
        if (region.id === message.regionId) {
          const result = region.downloadBuffer();
          this.processorScope.handleBufferDownload(
            message.trackId,
            message.regionId,
            result.sampleRate,
            result.arrayBuffer
          );
        }
      }
    }
    if (message.command === "setTrackVolume") {
      console.log(`🎛️ Timeline received setTrackVolume: trackId=${message.trackId}, volume=${message.volume}`);
      this.setTrackVolume(message.trackId, message.volume);
    }
    if (message.command === "setTrackMute") {
      console.log(`🎛️ Timeline received setTrackMute: trackId=${message.trackId}, muted=${message.muted}`);
      this.setTrackMute(message.trackId, message.muted);
    }
    if (message.command === "setTrackSolo") {
      console.log(`🎛️ Timeline received setTrackSolo: trackId=${message.trackId}, soloed=${message.soloed}`);
      this.setTrackSolo(message.trackId, message.soloed);
    }
    if (message.command === "setVarispeed") {
      console.log(`🎛️ Timeline received setVarispeed: speed=${message.speed}, isNatural=${message.isNatural}`);
      this.setVarispeed(message.speed, message.isNatural);
    }
    if (message.command === "setReverbEnabled") {
      console.log(`🎛️ Timeline received setReverbEnabled: trackId=${message.trackId}, enabled=${message.enabled}`);
      this.setReverbEnabled(message.trackId, message.enabled);
    }
    if (message.command === "setReverbMix") {
      console.log(`🎛️ Timeline received setReverbMix: trackId=${message.trackId}, mix=${message.mix}`);
      this.setReverbMix(message.trackId, message.mix);
    }
    if (message.command === "setReverbRoomSize") {
      this.setReverbRoomSize(message.trackId, message.roomSize);
    }
    if (message.command === "setReverbDamp") {
      this.setReverbDamp(message.trackId, message.damp);
    }
    if (message.command === "setReverbPredelay") {
      console.log(`🎛️ Timeline received setReverbPredelay: trackId=${message.trackId}, predelayMs=${message.predelayMs}`);
      this.setReverbPredelay(message.trackId, message.predelayMs);
    }
    if (message.command === "setReverbWidth") {
      console.log(`🎛️ Timeline received setReverbWidth: trackId=${message.trackId}, width=${message.width}`);
      this.setReverbWidth(message.trackId, message.width);
    }
    if (message.command === "setFlangerConfig") {
      console.log(`🎛️ Timeline received setFlangerConfig:`, message.config);
      this.setFlangerConfig(message.config);
    }
    if (message.command === "scratchBegin") {
      console.log(`🎧 Timeline received scratchBegin`);
      this.scratchBegin();
    }
    if (message.command === "scratchMove") {
      // console.log(`🎧 Timeline received scratchMove: velocity=${message.velocity}, time=${message.time}`);
      this.scratchMove(message.velocity, message.time);
    }
    if (message.command === "scratchEnd") {
      console.log(`🎧 Timeline received scratchEnd`);
      this.scratchEnd();
    }
  }

  handleTrackControl(data) {
    console.log(`🎛️ Timeline received trackControl:`, data);
    
    const { trackIndex, control, value } = data;
    
    // Find the track by index (tracks array index)
    const track = this.tracks[trackIndex];
    if (!track) {
      console.error(`❌ Track at index ${trackIndex} not found`);
      return;
    }
    
    switch (control) {
      case "volume":
        console.log(`🎛️ Setting track ${trackIndex} volume to ${value}`);
        track.setVolume(value);
        break;
      case "reverb":
        console.log(`🎛️ Setting track ${trackIndex} reverb mix to ${value}`);
        track.setReverbMix(value);
        break;
      case "mute":
        console.log(`🎛️ Setting track ${trackIndex} mute to ${value}`);
        track.setMute(value);
        break;
      case "solo":
        console.log(`🎛️ Setting track ${trackIndex} solo to ${value}`);
        track.setSolo(value);
        break;
      case "reverbPredelay":
        console.log(`🎛️ Setting track ${trackIndex} reverb pre-delay to ${value}ms`);
        track.setReverbPredelay(value);
        break;
      case "reverbWidth":
        console.log(`🎛️ Setting track ${trackIndex} reverb width to ${value}`);
        track.setReverbWidth(value);
        break;
      case "reverbRoomSize":
        console.log(`🎛️ Setting track ${trackIndex} reverb room size to ${value}`);
        track.setReverbRoomSize(value);
        break;
      case "reverbDamp":
        console.log(`🎛️ Setting track ${trackIndex} reverb damp to ${value}`);
        track.setReverbDamp(value);
        break;
      default:
        console.error(`❌ Unknown track control: ${control}`);
    }
  }

  handleTimelineDataUpdate(timelineData) {
    for (const timelineTrackData of timelineData.tracks) {
      this.timelineTrack = this.tracks.find(
        (t) => t.id === timelineTrackData.id
      );
      this.timelineTrack.updateRegions(timelineTrackData.actions);
    }
  }

  terminate() {
    this.metronomeTrack.terminate();
    for (const track of this.tracks) {
      track.terminate();
    }
    
    // Clean up global flanger
    if (this.globalFlanger) {
      this.globalFlanger.destruct();
      this.globalFlanger = null;
    }
    
    // Clean up flanger buffer
    if (this.flangerBuffer) {
      this.flangerBuffer.free();
      this.flangerBuffer = null;
    }
    
    this.currentFrameCursor = 0;
    this.tracks = [];
  }

  // ==================== 🎛️ Audio Control Methods ====================
  setTrackVolume(trackId, volume) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setVolume(volume);
    }
  }

  setTrackMute(trackId, muted) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setMute(muted);
    }
  }

  setTrackSolo(trackId, soloed) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setSolo(soloed);
      // Allow multiple tracks to be soloed simultaneously
      // (removed auto-unsolo logic to enable multi-solo)
    }
  }

  setVarispeed(speed, isNatural) {
    this.tracks.forEach(track => track.setVarispeed(speed, isNatural));
    // Update effective looping duration when using natural varispeed (no time-stretching)
    this.currentPlaybackRate = speed;
    this.varispeedNatural = !!isNatural;
    if (this.maxAudioDuration > 0 && this.timelineData) {
      const effective = this.varispeedNatural ? (this.maxAudioDuration / Math.max(0.001, speed)) : this.maxAudioDuration;
      this.timelineData.duration = effective;
      console.log(`🔁 Updated timeline duration for varispeed: ${effective.toFixed(2)}s (base=${this.maxAudioDuration.toFixed(2)}s, rate=${speed}, natural=${this.varispeedNatural})`);
      // Notify UI so scrubber range updates immediately
      this.processorScope.sendMessageToMainScope({
        event: "timeline-duration-set",
        data: { duration: effective }
      });
    }
  }

  // ==================== 🎛️ Reverb Control Methods ====================
  setReverbEnabled(trackId, enabled) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbEnabled(enabled);
    }
  }

  setReverbMix(trackId, mix) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbMix(mix);
    }
  }

  setReverbRoomSize(trackId, roomSize) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbRoomSize(roomSize);
    }
  }

  setReverbDamp(trackId, damp) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbDamp(damp);
    }
  }

  setReverbPredelay(trackId, predelayMs) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbPredelay(predelayMs);
    }
  }

  setReverbWidth(trackId, width) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbWidth(width);
    }
  }

  setFlangerConfig(config) {
    console.log(`🎛️ Setting GLOBAL flanger config:`, config);
    
    if (this.globalFlanger) {
      // Apply config to global flanger
      this.globalFlanger.enabled = config.enabled;
      this.globalFlanger.wet = config.wet;
      this.globalFlanger.depth = config.depth;
      this.globalFlanger.lfoBeats = config.lfoBeats;
      this.globalFlanger.bpm = config.bpm;
      this.globalFlanger.clipperThresholdDb = config.clipperThresholdDb;
      this.globalFlanger.clipperMaximumDb = config.clipperMaximumDb;
      this.globalFlanger.stereo = config.stereo;
      
      console.log(`✅ Global flanger updated - enabled: ${this.globalFlanger.enabled}, wet: ${this.globalFlanger.wet}`);
    }
  }

  resetAllRegions() {
    // Reset all regions in all tracks to their starting positions
    for (const track of this.tracks) {
      for (const region of track.regions) {
        // Set position to 0 and keep playing to ensure seamless loop
        region.resetPosition();
        region.startFrameOffset = 0;
        region.playing = true;
        region.play();
      }
    }
    console.log('🔄 Reset all regions to starting positions');
  }

  // ==================== 🎧 DJ Scratching Methods ====================
  
  /**
   * Start scratching mode on all tracks
   */
  scratchBegin() {
    this.isScratching = true;
    this.tracks.forEach(track => {
      track.scratchBegin();
    });
    console.log('🎧 Timeline scratch mode started');
  }

  /**
   * Update scratch velocity on all tracks
   * @param {number} velocity - Playback rate (negative = reverse)
   * @param {number} time - Position in seconds
   */
  scratchMove(velocity, time) {
    const positionMs = time * 1000;
    this.tracks.forEach(track => {
      track.scratchMove(velocity, positionMs);
    });
  }

  /**
   * End scratching mode on all tracks
   */
  scratchEnd() {
    this.tracks.forEach(track => {
      track.scratchEnd();
    });
    this.isScratching = false;
    console.log('🎧 Timeline scratch mode ended');
  }
}

export default SuperpoweredTimeline;
