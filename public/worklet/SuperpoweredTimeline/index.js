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
      
      // If this track is being soloed, unsolo all other tracks
      if (soloed) {
        this.tracks.forEach(t => {
          if (t.id !== trackId) {
            t.setSolo(false);
          }
        });
      }
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

  // ==================== 🎛️ Reverb Control Methods ====================
  setTrackReverbMix(trackId, mix) {
    console.log(`🎛️ setTrackReverbMix called: trackId=${trackId}, mix=${mix}`);
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbMix(mix);
    }
  }

  setTrackReverbPredelay(trackId, predelayMs) {
    console.log(`🎛️ setTrackReverbPredelay called: trackId=${trackId}, predelayMs=${predelayMs}`);
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbPredelay(predelayMs);
    }
  }

  setTrackReverbRoomSize(trackId, roomSize) {
    console.log(`🎛️ setTrackReverbRoomSize called: trackId=${trackId}, roomSize=${roomSize}`);
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbRoomSize(roomSize);
    }
  }

  setTrackReverbWidth(trackId, width) {
    console.log(`🎛️ setTrackReverbWidth called: trackId=${trackId}, width=${width}`);
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbWidth(width);
    }
  }

  setTrackReverbDamp(trackId, damp) {
    console.log(`🎛️ setTrackReverbDamp called: trackId=${trackId}, damp=${damp}`);
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.setReverbDamp(damp);
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
