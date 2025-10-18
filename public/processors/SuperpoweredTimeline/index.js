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
    
    // Initialize GLOBAL compressor effect (applied to final mix output)
    this.globalCompressor = new this.Superpowered.Compressor(samplerate);
    this.globalCompressor.enabled = false;
    this.globalCompressor.inputGainDb = 0; // -24 to 24, default 0
    this.globalCompressor.outputGainDb = 0; // -24 to 24, default 0
    this.globalCompressor.wet = 1.0; // 0-1, default 1 (completely wet)
    this.globalCompressor.attackSec = 0.003; // 0.0001-1, default 0.003 (3ms)
    this.globalCompressor.releaseSec = 0.3; // 0.1-4, default 0.3 (300ms)
    this.globalCompressor.ratio = 3.0; // 1.5,2,3,4,5,10, default 3
    this.globalCompressor.thresholdDb = 0; // 0 to -40, default 0
    this.globalCompressor.hpCutOffHz = 1; // 1-10000, default 1
    
    // Pre-allocate flanger buffer (never allocate in audio loop!)
    this.flangerBuffer = new this.Superpowered.Float32Buffer(numOfFrames * 2);
    
    // Pre-allocate compressor buffer (never allocate in audio loop!)
    this.compressorBuffer = new this.Superpowered.Float32Buffer(numOfFrames * 2);
    
    // Initialize waveform analyzer for scrubber visualization
    this.waveform = new this.Superpowered.Waveform(
      samplerate, // The sample rate of the audio input
      300 // The length in seconds of the audio input (5 minutes max)
    );
    this.waveformDataGenerated = false;
    this.waveformRequested = false;
    
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

    // Apply GLOBAL compressor to the final mixed output (if enabled)
    if (this.globalCompressor && this.globalCompressor.enabled) {
      // Update samplerate (required by Superpowered for every process call)
      this.globalCompressor.samplerate = this.samplerate;
      
      // Process compressor in-place (input and output can be the same buffer)
      // According to Superpowered docs: "Can point to the same location with input (in-place processing)"
      this.globalCompressor.process(outputBuffer.pointer, outputBuffer.pointer, buffersize);
    }

    // Process waveform data for scrubber visualization (only when not scratching)
    if (this.waveform && !this.isScratching && !this.waveformDataGenerated) {
      this.waveform.process(
        outputBuffer.pointer,
        buffersize,
        -1 // Use -1 for real-time processing
      );
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

    // CORRECT APPROACH: Read actual audio position from audio engine
    // Always advance cursor at normal rate for display
    if (!this.isScratching) {
      this.currentFrameCursor += buffersize;
    }
    
    // Send cursor updates at regular intervals
    const updateInterval = buffersize * this.cursorUpdateFrequencyRatio;
    const framesSinceLastUpdate = this.currentFrameCursor - this.lastCursorUpdateFrame;
    
    if (framesSinceLastUpdate >= updateInterval) {
      // Get the actual audio position from the first playing region
      let actualPositionMs = 0;
      for (const track of this.tracks) {
        for (const region of track.regions) {
          if (region.playing && region.player) {
            actualPositionMs = region.player.getDisplayPositionMs();
            break; // Use first playing region's position
          }
        }
        if (actualPositionMs > 0) break;
      }
      
      // Convert actual audio position to frames for display
      const actualPositionFrames = Math.floor((actualPositionMs / 1000) * this.samplerate);
      this.currentFrameCursor = actualPositionFrames;
      
      this.processorScope.sendTimelineFrameCursorUpdate(this.currentFrameCursor);
      this.lastCursorUpdateFrame = this.currentFrameCursor;
    }
    
    // Loop detection based on actual audio position (file end)
    if (this.timelineData && this.timelineData.duration) {
      // Get actual audio position from regions
      let actualPositionMs = 0;
      let actualDurationMs = 0;
      for (const track of this.tracks) {
        for (const region of track.regions) {
          if (region.playing && region.player) {
            actualPositionMs = region.player.getDisplayPositionMs();
            actualDurationMs = region.player.getDurationMs();
            break;
          }
        }
        if (actualPositionMs > 0) break;
      }
      
      // Check if we've reached the end of the actual audio file
      // Use a small buffer to ensure we catch the end
      if (actualPositionMs >= actualDurationMs - 100) {
        // Loop: reset all regions to beginning
        for (const track of this.tracks) {
          for (const region of track.regions) {
            if (region.playing) {
              region.pause();
              region.setPositionMs(0);
              if (typeof region.onSeek === 'function') region.onSeek();
              region.play();
            }
          }
        }

        this.currentFrameCursor = 0;
        this.lastCursorUpdateFrame = 0;
        this.justLoopedSamplesRemaining = this.fadeInSamples;

        console.log(`🔄 Loop at actual file end (${actualDurationMs}ms, pos: ${actualPositionMs}ms): reset to beginning`);

        // Immediately send cursor update
        this.processorScope.sendTimelineFrameCursorUpdate(this.currentFrameCursor);
      }
    }
    
    return true;
  }

  handleCommand(message) {
    if (message.command === "play") {
      // this.currentFrameCursor = 0;
    }
    if (message.command === "updateCursor") {
      // VARISPEED-AWARE SAMPLE-ACCURATE SEEKING: Ensure all stems start from the same computed absolute time
      const seekTimeSeconds = message.cursorSec;
      const seekPositionMs = seekTimeSeconds * 1000;
      const seekFramePosition = Math.floor(seekTimeSeconds * this.samplerate);
      
      // CRITICAL: Seek all regions atomically to prevent drift
      const seekStartTime = performance.now();
      
      // Phase 1: Pause all regions to prevent audio overlap
      for (const track of this.tracks) {
        for (const region of track.regions) {
          if (region.playing) {
            region.pause();
          }
        }
      }
      
      // Phase 2: Set position on all regions (sample-accurate)
      // Superpowered handles varispeed internally, so we seek to the actual time position
      for (const track of this.tracks) {
        for (const region of track.regions) {
          region.setPositionMs(seekPositionMs);
          if (typeof region.onSeek === 'function') region.onSeek();
        }
      }
      
      // Phase 2.5: Re-arm loop regions if they exist and seek position is within loop range
      if (this.loopStartMs !== undefined && this.loopEndMs !== undefined) {
        if (seekPositionMs >= this.loopStartMs && seekPositionMs <= this.loopEndMs) {
          // Re-arm loop points for all regions
          for (const track of this.tracks) {
            for (const region of track.regions) {
              if (region.player && region.player.loopBetween) {
                region.player.loopBetween(this.loopStartMs, this.loopEndMs, true);
              }
            }
          }
          console.log(`🔄 Loop re-armed after seek: ${this.loopStartMs}ms - ${this.loopEndMs}ms`);
        }
      }
      
      // Phase 3: Resume playback on all regions simultaneously
      for (const track of this.tracks) {
        for (const region of track.regions) {
          if (region.playing) {
            region.play();
          }
        }
      }
      
      // Update timeline cursor to match the seek position (sample-accurate)
      this.currentFrameCursor = seekFramePosition;
      this.lastCursorUpdateFrame = this.currentFrameCursor;
      
      const seekDuration = performance.now() - seekStartTime;
      console.log(`🎯 Varispeed-aware seek: ${seekTimeSeconds.toFixed(3)}s (${seekPositionMs}ms) at ${this.currentPlaybackRate}x in ${seekDuration.toFixed(1)}ms`);
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
    if (message.command === "setEchoEnabled") {
      console.log(`🎛️ Timeline received setEchoEnabled: trackId=${message.trackId}, enabled=${message.enabled}`);
      this.setEchoEnabled(message.trackId, message.enabled);
    }
    if (message.command === "setEchoDry") {
      console.log(`🎛️ Timeline received setEchoDry: trackId=${message.trackId}, dry=${message.dry}`);
      this.setEchoDry(message.trackId, message.dry);
    }
    if (message.command === "setEchoWet") {
      console.log(`🎛️ Timeline received setEchoWet: trackId=${message.trackId}, wet=${message.wet}`);
      this.setEchoWet(message.trackId, message.wet);
    }
    if (message.command === "setEchoBpm") {
      console.log(`🎛️ Timeline received setEchoBpm: trackId=${message.trackId}, bpm=${message.bpm}`);
      this.setEchoBpm(message.trackId, message.bpm);
    }
    if (message.command === "setEchoBeats") {
      console.log(`🎛️ Timeline received setEchoBeats: trackId=${message.trackId}, beats=${message.beats}`);
      this.setEchoBeats(message.trackId, message.beats);
    }
    if (message.command === "setEchoDecay") {
      console.log(`🎛️ Timeline received setEchoDecay: trackId=${message.trackId}, decay=${message.decay}`);
      this.setEchoDecay(message.trackId, message.decay);
    }
    if (message.command === "setReverbWidth") {
      console.log(`🎛️ Timeline received setReverbWidth: trackId=${message.trackId}, width=${message.width}`);
      this.setReverbWidth(message.trackId, message.width);
    }
    if (message.command === "setFlangerConfig") {
      console.log(`🎛️ Timeline received setFlangerConfig:`, message.config);
      this.setFlangerConfig(message.config);
    }
    if (message.command === "setCompressorConfig") {
      console.log(`🎛️ Timeline received setCompressorConfig:`, message.config);
      this.setCompressorConfig(message.config);
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
    if (message.command === "requestWaveformData") {
      console.log(`📊 Timeline received requestWaveformData`);
      this.generateWaveformData();
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
      // Global Flanger Controls
      case "globalFlanger":
        console.log(`🎛️ Setting global flanger wet to ${value}`);
        if (this.globalFlanger) {
          this.globalFlanger.wet = value;
        }
        break;
      case "globalFlangerEnabled":
        console.log(`🎛️ Setting global flanger enabled to ${value}`);
        if (this.globalFlanger) {
          this.globalFlanger.enabled = value;
        }
        break;
      case "globalFlangerDepth":
        console.log(`🎛️ Setting global flanger depth to ${value}`);
        if (this.globalFlanger) {
          this.globalFlanger.depth = value;
        }
        break;
      case "globalFlangerLfoBeats":
        console.log(`🎛️ Setting global flanger LFO beats to ${value}`);
        if (this.globalFlanger) {
          this.globalFlanger.lfoBeats = value;
        }
        break;
      case "globalFlangerBpm":
        console.log(`🎛️ Setting global flanger BPM to ${value}`);
        if (this.globalFlanger) {
          this.globalFlanger.bpm = value;
        }
        break;
      case "globalFlangerClipperThreshold":
        console.log(`🎛️ Setting global flanger clipper threshold to ${value}`);
        if (this.globalFlanger) {
          this.globalFlanger.clipperThresholdDb = value;
        }
        break;
      case "globalFlangerClipperMaximum":
        console.log(`🎛️ Setting global flanger clipper maximum to ${value}`);
        if (this.globalFlanger) {
          this.globalFlanger.clipperMaximumDb = value;
        }
        break;
      case "globalFlangerStereo":
        console.log(`🎛️ Setting global flanger stereo to ${value}`);
        if (this.globalFlanger) {
          this.globalFlanger.stereo = value;
        }
        break;
      // Global Compressor Controls
      case "globalCompressorInputGain":
        console.log(`🎛️ Setting global compressor input gain to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.inputGainDb = value;
        }
        break;
      case "globalCompressorOutputGain":
        console.log(`🎛️ Setting global compressor output gain to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.outputGainDb = value;
        }
        break;
      case "globalCompressorWet":
        console.log(`🎛️ Setting global compressor wet to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.wet = value;
        }
        break;
      case "globalCompressorAttack":
        console.log(`🎛️ Setting global compressor attack to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.attackSec = value;
        }
        break;
      case "globalCompressorRelease":
        console.log(`🎛️ Setting global compressor release to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.releaseSec = value;
        }
        break;
      case "globalCompressorRatio":
        console.log(`🎛️ Setting global compressor ratio to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.ratio = value;
        }
        break;
      case "globalCompressorThreshold":
        console.log(`🎛️ Setting global compressor threshold to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.thresholdDb = value;
        }
        break;
      case "globalCompressorHpCutoff":
        console.log(`🎛️ Setting global compressor HP cutoff to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.hpCutOffHz = value;
        }
        break;
      case "globalCompressorEnabled":
        console.log(`🎛️ Setting global compressor enabled to ${value}`);
        if (this.globalCompressor) {
          this.globalCompressor.enabled = value;
        }
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
    
    // Clean up global compressor
    if (this.globalCompressor) {
      this.globalCompressor.destruct();
      this.globalCompressor = null;
    }
    
    // Clean up flanger buffer
    if (this.flangerBuffer) {
      this.flangerBuffer.free();
      this.flangerBuffer = null;
    }
    
    // Clean up compressor buffer
    if (this.compressorBuffer) {
      this.compressorBuffer.free();
      this.compressorBuffer = null;
    }
    
    // Clean up waveform analyzer
    if (this.waveform) {
      this.waveform.destruct();
      this.waveform = null;
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
    this.currentPlaybackRate = speed;
    this.varispeedNatural = !!isNatural;
    
    if (this.maxAudioDuration > 0 && this.timelineData) {
      // Update UI duration for varispeed display
      const effective = this.varispeedNatural ? (this.maxAudioDuration / Math.max(0.001, speed)) : this.maxAudioDuration;
      this.timelineData.duration = effective;
      
      console.log(`🔁 Varispeed: ${speed.toFixed(2)}x (natural=${this.varispeedNatural}) - UI duration: ${effective.toFixed(2)}s`);
      
      // Notify UI
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

  // ==================== 🎛️ Echo Control Methods ====================
  setEchoEnabled(trackId, enabled) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setEchoEnabled(enabled);
    }
  }

  setEchoDry(trackId, dry) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setEchoDry(dry);
    }
  }

  setEchoWet(trackId, wet) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setEchoWet(wet);
    }
  }

  setEchoBpm(trackId, bpm) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setEchoBpm(bpm);
    }
  }

  setEchoBeats(trackId, beats) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setEchoBeats(beats);
    }
  }

  setEchoDecay(trackId, decay) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setEchoDecay(decay);
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

  setCompressorConfig(config) {
    console.log(`🎛️ Setting GLOBAL compressor config:`, config);
    
    if (this.globalCompressor) {
      // Apply config to global compressor
      this.globalCompressor.enabled = config.enabled;
      this.globalCompressor.inputGainDb = config.inputGainDb;
      this.globalCompressor.outputGainDb = config.outputGainDb;
      this.globalCompressor.wet = config.wet;
      this.globalCompressor.attackSec = config.attackSec;
      this.globalCompressor.releaseSec = config.releaseSec;
      this.globalCompressor.ratio = config.ratio;
      this.globalCompressor.thresholdDb = config.thresholdDb;
      this.globalCompressor.hpCutOffHz = config.hpCutOffHz;
      
      console.log(`✅ Global compressor updated - enabled: ${this.globalCompressor.enabled}, wet: ${this.globalCompressor.wet}`);
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

  // ==================== 📊 Waveform Data Generation ====================
  
  /**
   * Generate waveform data for scrubber visualization
   * This should be called after all assets are loaded and processed
   */
  generateWaveformData() {
    if (!this.waveform || this.waveformDataGenerated) {
      console.log('📊 Waveform data already generated or waveform not available');
      return;
    }

    try {
      console.log('📊 Generating waveform data...');
      
      // First instruct the waveform instance to run its calculations internally
      // processAudio should not run when this is called!
      this.waveform.makeResult();

      // Then get the peakWaveform data
      // returns a Superpowered.Uint8Buffer. 150 points/sec waveform data displaying the peak volume
      const wasmResult = this.waveform.getPeakWaveform();

      // Result is backed by WebAssembly Linear Memory that can not be passed to another scope (thread)
      // Let's clone it into "result"
      const result = new Uint8Array();
      result.set(wasmResult.array);

      console.log(`📊 Generated waveform data: ${result.length} points`);

      // Send waveform data back to main scope
      this.processorScope.sendMessageToMainScope({
        event: "waveform-data",
        data: {
          waveformData: result,
          sampleRate: this.samplerate,
          duration: this.maxAudioDuration
        }
      });

      this.waveformDataGenerated = true;
      console.log('✅ Waveform data sent to main scope');

    } catch (error) {
      console.error('❌ Failed to generate waveform data:', error);
    }
  }
}

export default SuperpoweredTimeline;
