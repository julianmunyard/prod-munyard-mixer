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
      this.setTrackVolume(message.trackId, message.volume);
    }
    if (message.command === "setTrackMute") {
      this.setTrackMute(message.trackId, message.muted);
    }
    if (message.command === "setTrackSolo") {
      this.setTrackSolo(message.trackId, message.soloed);
    }
    if (message.command === "setVarispeed") {
      this.setVarispeed(message.speed, message.isNatural);
    }
    if (message.command === "setFlangerConfig") {
      this.setFlangerConfig(message.trackId, message.config);
    }
    if (message.command === "setFlangerEnabled") {
      this.setFlangerEnabled(message.trackId, message.enabled);
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
    console.log(`🎛️ setTrackVolume called: trackId=${trackId}, volume=${volume}`);
    console.log(`🎛️ Available tracks:`, this.tracks.map(t => t.id));
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      console.log(`🎛️ Found track ${trackId}, setting volume to ${volume}`);
      track.setVolume(volume);
    } else {
      console.log(`🎛️ Track ${trackId} not found!`);
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
    // Update all tracks with new varispeed
    this.tracks.forEach(track => track.setVarispeed(speed, isNatural));
  }

  setFlangerConfig(trackId, config) {
    console.log(`🎛️ setFlangerConfig called: trackId=${trackId}, config=`, config);
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      console.log(`🎛️ Found track ${trackId}, setting flanger config`);
      track.setFlangerConfig(config);
    } else {
      console.log(`🎛️ Track ${trackId} not found!`);
    }
  }

  setFlangerEnabled(trackId, enabled) {
    console.log(`🎛️ setFlangerEnabled called: trackId=${trackId}, enabled=${enabled}`);
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      console.log(`🎛️ Found track ${trackId}, setting flanger enabled to ${enabled}`);
      track.setFlangerEnabled(enabled);
    } else {
      console.log(`🎛️ Track ${trackId} not found!`);
    }
  }

  // ==================== 🎛️ Track Control Handler ====================
  handleTrackControl(message) {
    console.log(`🎛️ handleTrackControl called with:`, message);
    
    if (message.command === "setTrackVolume") {
      this.setTrackVolume(message.trackId, message.volume);
    } else if (message.command === "setTrackMute") {
      this.setTrackMute(message.trackId, message.muted);
    } else if (message.command === "setTrackSolo") {
      this.setTrackSolo(message.trackId, message.soloed);
    } else if (message.command === "setReverbMix") {
      this.setTrackReverbMix(message.trackId, message.mix);
    } else if (message.command === "setReverbPredelay") {
      this.setTrackReverbPredelay(message.trackId, message.predelayMs);
    } else if (message.command === "setReverbRoomSize") {
      this.setTrackReverbRoomSize(message.trackId, message.roomSize);
    } else if (message.command === "setReverbWidth") {
      this.setTrackReverbWidth(message.trackId, message.width);
    } else if (message.command === "setReverbDamp") {
      this.setTrackReverbDamp(message.trackId, message.damp);
    } else if (message.command === "setReverbSend") {
      this.setTrackReverbSend(message.trackId, message.sendLevel);
    } else if (message.command === "setFlangerConfig") {
      this.setFlangerConfig(message.trackId, message.config);
    } else if (message.command === "setFlangerEnabled") {
      this.setFlangerEnabled(message.trackId, message.enabled);
    } else if (message.control === "globalFlanger") {
      this.setGlobalFlanger(message.value);
    } else if (message.control === "globalFlangerEnabled") {
      this.setGlobalFlangerEnabled(message.value);
    } else if (message.control === "globalFlangerDepth") {
      this.setGlobalFlangerDepth(message.value);
    } else if (message.control === "globalFlangerLfoBeats") {
      this.setGlobalFlangerLfoBeats(message.value);
    } else if (message.control === "globalFlangerBpm") {
      this.setGlobalFlangerBpm(message.value);
    } else if (message.control === "globalFlangerClipperThreshold") {
      this.setGlobalFlangerClipperThreshold(message.value);
    } else if (message.control === "globalFlangerClipperMaximum") {
      this.setGlobalFlangerClipperMaximum(message.value);
    } else if (message.control === "globalFlangerStereo") {
      this.setGlobalFlangerStereo(message.value);
    } else {
      console.log(`🎛️ Unknown track control command:`, message);
    }
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

  // ==================== 🎛️ Global Flanger Control Methods ====================
  setGlobalFlanger(wet) {
    console.log(`🎛️ Setting global flanger wet to ${wet}`);
    // Apply flanger to all tracks
    this.tracks.forEach(track => {
      track.setGlobalFlanger(wet);
    });
  }

  setGlobalFlangerEnabled(enabled) {
    console.log(`🎛️ Setting global flanger enabled to ${enabled}`);
    this.tracks.forEach(track => {
      track.setGlobalFlangerEnabled(enabled);
    });
  }

  setGlobalFlangerDepth(depth) {
    console.log(`🎛️ Setting global flanger depth to ${depth}`);
    this.tracks.forEach(track => {
      track.setGlobalFlangerDepth(depth);
    });
  }

  setGlobalFlangerLfoBeats(lfoBeats) {
    console.log(`🎛️ Setting global flanger LFO beats to ${lfoBeats}`);
    this.tracks.forEach(track => {
      track.setGlobalFlangerLfoBeats(lfoBeats);
    });
  }

  setGlobalFlangerBpm(bpm) {
    console.log(`🎛️ Setting global flanger BPM to ${bpm}`);
    this.tracks.forEach(track => {
      track.setGlobalFlangerBpm(bpm);
    });
  }

  setGlobalFlangerClipperThreshold(threshold) {
    console.log(`🎛️ Setting global flanger clipper threshold to ${threshold}`);
    this.tracks.forEach(track => {
      track.setGlobalFlangerClipperThreshold(threshold);
    });
  }

  setGlobalFlangerClipperMaximum(maximum) {
    console.log(`🎛️ Setting global flanger clipper maximum to ${maximum}`);
    this.tracks.forEach(track => {
      track.setGlobalFlangerClipperMaximum(maximum);
    });
  }

  setGlobalFlangerStereo(stereo) {
    console.log(`🎛️ Setting global flanger stereo to ${stereo}`);
    this.tracks.forEach(track => {
      track.setGlobalFlangerStereo(stereo);
    });
  }

}

export default SuperpoweredTimeline;
