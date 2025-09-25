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
    this.tracks.forEach(track => track.setVarispeed(speed, isNatural));
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
