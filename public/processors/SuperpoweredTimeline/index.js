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
    
    // Initialize shared reverb system (Superpowered best practice)
    this.sharedReverb = new this.Superpowered.Reverb(this.samplerate, this.samplerate);
    this.sharedReverb.enabled = false;
    this.sharedReverb.mix = 0.4; // Use mix instead of wet/dry (Superpowered best practice)
    this.sharedReverb.roomSize = 0.8;
    this.sharedReverb.damp = 0.5;
    this.sharedReverb.width = 1.0;
    this.sharedReverb.predelayMs = 0;
    this.sharedReverb.lowCutHz = 0;
    
    // Pre-allocate reverb buffers (outside audio loop for performance)
    this.reverbSendBuffer = new this.Superpowered.Float32Buffer(1024 * 2);
    this.reverbReturnBuffer = new this.Superpowered.Float32Buffer(1024 * 2);
    
    // Per-stem reverb send levels (0.0 to 1.0)
    this.stemReverbSends = new Map(); // trackId -> sendLevel
    
    console.log("🎵 Initialized shared reverb system with mobile-optimized settings");
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
          }
        }
      }
      if (this.timelineData.metronome) {
        if (this.timelineData.metronome.blipUrl === SuperpoweredLoaded.url) {
          this.metronomeTrack.loadBlipBuffer(SuperpoweredLoaded.buffer);
        }
      }
      this.assetsDownloaded++;
    }

    if (this.assetsDownloaded === this.totalAssetsToFetch)
      this.processorScope.allAssetsDownloaded();
  }

  processTimeline(inputBuffer, outputBuffer, buffersize) {
    this.Superpowered.memorySet(outputBuffer.pointer, 0, buffersize * 8); // 8 bytes for each frame (1 channel is 4 bytes, two channels)
    
    // Clear reverb send buffer
    this.Superpowered.memorySet(this.reverbSendBuffer.pointer, 0, buffersize * 8);
    this.Superpowered.memorySet(this.reverbReturnBuffer.pointer, 0, buffersize * 8);
    
    // Process audio tracks (dry signals go to main output)
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

    // Process shared reverb with proper send/return architecture
    if (this.sharedReverb && this.sharedReverb.enabled) {
      try {
        // Ensure samplerate is in sync (required by Superpowered)
        this.sharedReverb.samplerate = this.samplerate;
        
        // Clear reverb send buffer
        this.Superpowered.memorySet(this.reverbSendBuffer.pointer, 0, buffersize * 8);
        
        // Build reverb send buffer from all tracks with reverb sends
        for (const track of this.tracks) {
          const reverbSendLevel = this.stemReverbSends.get(track.id) || 0;
          if (reverbSendLevel > 0) {
            // Send portion of track to reverb (additive to send buffer)
            // Use Superpowered.Volume to add the track's contribution to the reverb send
            this.Superpowered.Volume(
              outputBuffer.pointer,
              this.reverbSendBuffer.pointer,
              reverbSendLevel,
              reverbSendLevel,
              buffersize
            );
          }
        }
        
        // Process reverb on the send buffer
        const reverbProcessed = this.sharedReverb.process(
          this.reverbSendBuffer.pointer,
          this.reverbReturnBuffer.pointer,
          buffersize
        );
        
        if (reverbProcessed) {
          // Mix reverb return back into main output (additive mixing)
          // Manually add reverb return to output buffer with proper mixing
          for (let i = 0; i < buffersize * 2; i++) {
            const outputIndex = i;
            const reverbIndex = i;
            outputBuffer.array[outputIndex] += this.reverbReturnBuffer.array[reverbIndex] * this.sharedReverb.mix;
          }
        }
      } catch (error) {
        console.error(`🎛️ Shared reverb processing error:`, error);
      }
    }

    this.currentFrameCursor += buffersize;
    if (
      this.currentFrameCursor %
        (buffersize * this.cursorUpdateFrequencyRatio) ===
      0
    )
      this.processorScope.sendTimelineFrameCursorUpdate(
        this.currentFrameCursor
      );
    return true;
  }

  handleCommand(message) {
    if (message.command === "play") {
      // this.currentFrameCursor = 0;
    }
    if (message.command === "updateCursor") {
      // Here we handle the updated cursor position
      this.currentFrameCursor = Math.floor(message.cursorSec * this.samplerate);
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
      this.setTrackReverbMix(message.trackId, message.enabled ? 0.5 : 0); // Enable/disable by setting mix
    }
    if (message.command === "setReverbMix") {
      console.log(`🎛️ Timeline received setReverbMix: trackId=${message.trackId}, mix=${message.mix}`);
      this.setTrackReverbMix(message.trackId, message.mix);
    }
    if (message.command === "setReverbRoomSize") {
      this.setTrackReverbRoomSize(message.trackId, message.roomSize);
    }
    if (message.command === "setReverbDamp") {
      this.setTrackReverbDamp(message.trackId, message.damp);
    }
    if (message.command === "setReverbSend") {
      this.setTrackReverbSend(message.trackId, message.sendLevel);
    }
    if (message.command === "setReverbPredelay") {
      console.log(`🎛️ Timeline received setReverbPredelay: trackId=${message.trackId}, predelayMs=${message.predelayMs}`);
      this.setTrackReverbPredelay(message.trackId, message.predelayMs);
    }
    if (message.command === "setReverbWidth") {
      console.log(`🎛️ Timeline received setReverbWidth: trackId=${message.trackId}, width=${message.width}`);
      this.setTrackReverbWidth(message.trackId, message.width);
    }
    if (message.command === "setFlangerConfig") {
      console.log(`🎛️ Timeline received setFlangerConfig:`, message.config);
      this.setFlangerConfig(message.config);
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
    
    // Clean up shared reverb system
    if (this.sharedReverb) {
      this.sharedReverb.destruct();
    }
    if (this.reverbSendBuffer) {
      this.reverbSendBuffer.free();
    }
    if (this.reverbReturnBuffer) {
      this.reverbReturnBuffer.free();
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
    }
  }

  setVarispeed(speed, isNatural) {
    this.tracks.forEach(track => track.setVarispeed(speed, isNatural));
  }

  // ==================== 🎛️ Shared Reverb Control Methods ====================
  setTrackReverbMix(trackId, mix) {
    console.log(`🎛️ setTrackReverbMix called: trackId=${trackId}, mix=${mix}`);
    // Store per-stem reverb send level
    this.stemReverbSends.set(trackId, Math.max(0, Math.min(1, mix)));
    
    // Enable shared reverb if any stem has reverb
    const hasAnyReverb = Array.from(this.stemReverbSends.values()).some(send => send > 0);
    this.sharedReverb.enabled = hasAnyReverb;
    
    console.log(`🎛️ Track ${trackId} reverb send set to: ${mix}, shared reverb enabled: ${this.sharedReverb.enabled}`);
  }

  setTrackReverbPredelay(trackId, predelayMs) {
    console.log(`🎛️ setTrackReverbPredelay called: trackId=${trackId}, predelayMs=${predelayMs}`);
    // Update shared reverb predelay (affects all stems)
    if (this.sharedReverb) {
      this.sharedReverb.predelayMs = Math.max(0, Math.min(500, predelayMs)); // 0-500ms range per docs
      console.log(`🎛️ Shared reverb predelay set to: ${predelayMs}ms`);
    }
  }

  setTrackReverbRoomSize(trackId, roomSize) {
    console.log(`🎛️ setTrackReverbRoomSize called: trackId=${trackId}, roomSize=${roomSize}`);
    // Update shared reverb room size (affects all stems)
    if (this.sharedReverb) {
      this.sharedReverb.roomSize = Math.max(0, Math.min(1, roomSize)); // 0-1 range per docs
      console.log(`🎛️ Shared reverb room size set to: ${roomSize}`);
    }
  }

  setTrackReverbWidth(trackId, width) {
    console.log(`🎛️ setTrackReverbWidth called: trackId=${trackId}, width=${width}`);
    // Update shared reverb width (affects all stems)
    if (this.sharedReverb) {
      this.sharedReverb.width = Math.max(0, Math.min(1, width)); // 0-1 range per docs
      console.log(`🎛️ Shared reverb width set to: ${width}`);
    }
  }

  setTrackReverbSend(trackId, sendLevel) {
    console.log(`🎛️ setTrackReverbSend called: trackId=${trackId}, sendLevel=${sendLevel}`);
    // Set the reverb send level for this specific track (0.0 to 1.0)
    this.stemReverbSends.set(trackId, Math.max(0, Math.min(1, sendLevel)));
    console.log(`🎛️ Track ${trackId} reverb send set to: ${sendLevel}`);
  }

  setTrackReverbDamp(trackId, damp) {
    console.log(`🎛️ setTrackReverbDamp called: trackId=${trackId}, damp=${damp}`);
    // Update shared reverb damp (affects all stems)
    if (this.sharedReverb) {
      this.sharedReverb.damp = Math.max(0, Math.min(1, damp)); // 0-1 range per docs
      console.log(`🎛️ Shared reverb damp set to: ${damp}`);
    }
  }

  setFlangerConfig(config) {
    console.log(`🎛️ Setting flanger config:`, config);
    // Store flanger config for use in processing
    this.flangerConfig = config;
    
    // Apply to all tracks
    this.tracks.forEach(track => {
      track.setFlangerConfig(config);
    });
  }
}

export default SuperpoweredTimeline;
