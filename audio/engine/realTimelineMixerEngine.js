// Real Timeline MixerEngine - Uses Thomas's actual AudioEngine
// This is the proper integration of Thomas's timeline system

import ThomasAudioEngine from './thomasAudioEngine.js';

export class RealTimelineMixerEngine {
  constructor(options = {}) {
    this.options = {
      masterVolume: options.masterVolume || 1.0,
      sampleRate: options.sampleRate || 48000,
      bufferSize: options.bufferSize || 128, // Timeline uses 128 frames
      ...options
    };
    
    this.stems = [];
    this.stemIdMap = new Map(); // Map stem index to stemId
    this.isPlaying = false;
    this.isReady = false;
    this.audioEngine = null;
    this.loadedStems = new Set();
    this.currentTime = 0;
    this.timelineData = null;
    
    // Don't initialize here - will be done in init() method
  }

  async init() {
    await this.initializeThomasAudioEngine();
  }

  async initializeThomasAudioEngine() {
    try {
      console.log("🎵 Initializing Thomas's AudioEngine...");
      
      // Create Thomas's actual AudioEngine
      this.audioEngine = new ThomasAudioEngine();
      
      // Set up callbacks
      this.audioEngine.onTimelineFrameCursorUpdate = (timelineFrameCursor) => {
        this.currentTime = timelineFrameCursor / this.options.sampleRate;
      };
      
      this.audioEngine.onAllAssetsDownloaded = () => {
        console.log("🎵 All assets downloaded - timeline ready!");
        this.isReady = true;
      };
      
      this.audioEngine.onRegionBufferDataCallback = (data) => {
        console.log("Region buffer data:", data);
      };
      
      // Initialize the audio engine
      await this.audioEngine.init();
      
      console.log("🎵 Thomas's AudioEngine initialized successfully!");
      
    } catch (error) {
      console.error("❌ Failed to initialize Thomas's AudioEngine:", error);
      throw error;
    }
  }

  // Load stems from Supabase into Thomas's timeline system
  async loadStemsFromSupabase(stems) {
    console.log("🎵 Loading stems into Thomas's timeline system:", stems);
    
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    // Convert stems to Thomas's timeline format
    this.timelineData = {
      duration: 255, // Timeline duration in seconds - will be updated with actual duration
      tracks: stems.map((stem, index) => ({
        id: `track_${index}`,
        actions: [{
          id: `region_${index}`,
          start: 0, // Start at beginning of timeline
          end: 255, // Will be updated with actual duration
          url: stem.url, // Supabase URL
          data: { 
            name: stem.name || stem.label || `Stem ${index + 1}`, 
            color: `rgba(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},0.5)` 
          }
        }]
      }))
    };

    console.log("🎵 Sending timeline data to Thomas's system:", this.timelineData);

    // Send to Thomas's timeline processor
    this.audioEngine.sendMessageToAudioProcessor({
      type: "initialTimelineData",
      data: this.timelineData
    });

    this.stems = stems;
    
    // Return a promise that resolves when the data is sent
    // The actual asset downloading will be handled by the onAllAssetsDownloaded callback
    return Promise.resolve();
  }

  // Play timeline using Thomas's system
  play() {
    console.log("🎵 Playing timeline with Thomas's system");
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    // Resume audio context (required for audio to play) - only if audioContext exists
    if (this.audioEngine.webaudioManager && this.audioEngine.webaudioManager.audioContext) {
      this.audioEngine.webaudioManager.audioContext.resume();
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { command: "play" }
    });
    
    this.isPlaying = true;
  }

  // Pause timeline using Thomas's system
  pause() {
    console.log("🎵 Pausing timeline with Thomas's system");
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    // Suspend audio context (like Thomas does) - only if audioContext exists
    if (this.audioEngine.webaudioManager && this.audioEngine.webaudioManager.audioContext) {
      this.audioEngine.webaudioManager.audioContext.suspend();
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { command: "pause" }
    });
    
    this.isPlaying = false;
  }

  // Stop timeline using Thomas's system
  stop() {
    console.log("🎵 Stopping timeline with Thomas's system");
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { command: "stop" }
    });
    
    this.isPlaying = false;
  }

  // Seek to position (in seconds) using Thomas's system
  seek(timeInSeconds) {
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "updateCursor", 
        cursorSec: timeInSeconds 
      }
    });
  }

  // Reset timeline using Thomas's system
  async reset() {
    console.log("🎵 Resetting timeline with Thomas's system");
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    await this.audioEngine.reset();
    this.isPlaying = false;
    this.currentTime = 0;
  }

  // Update timeline data (for repositioning stems) using Thomas's system
  updateTimelineData(timelineData) {
    console.log("🎵 Updating timeline data with Thomas's system:", timelineData);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "timelineUpdate",
      data: { timelineData }
    });
  }

  // Get current timeline cursor position
  getCurrentTime() {
    return this.currentTime;
  }

  // Get ready state
  getReadyState() {
    return this.isReady;
  }

  // Get playing state
  getPlayingState() {
    return this.isPlaying;
  }

  // Control methods for individual tracks
  setTrackVolume(trackIndex, volume) {
    console.log(`🎛️ Setting track ${trackIndex} volume to ${volume}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        trackIndex,
        control: "volume",
        value: volume
      }
    });
  }

  setTrackReverb(trackIndex, reverbMix) {
    console.log(`🎛️ Setting track ${trackIndex} reverb to ${reverbMix}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        trackIndex,
        control: "reverb",
        value: reverbMix
      }
    });
  }

  setTrackMute(trackIndex, muted) {
    console.log(`🎛️ Setting track ${trackIndex} mute to ${muted}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        trackIndex,
        control: "mute",
        value: muted
      }
    });
  }

  setTrackSolo(trackIndex, soloed) {
    console.log(`🎛️ Setting track ${trackIndex} solo to ${soloed}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        trackIndex,
        control: "solo",
        value: soloed
      }
    });
  }

  setTrackReverbPredelay(trackIndex, predelayMs) {
    console.log(`🎛️ Setting track ${trackIndex} reverb pre-delay to ${predelayMs}ms`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        trackIndex,
        control: "reverbPredelay",
        value: predelayMs
      }
    });
  }

  setTrackReverbWidth(trackIndex, width) {
    console.log(`🎛️ Setting track ${trackIndex} reverb width to ${width}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        trackIndex,
        control: "reverbWidth",
        value: width
      }
    });
  }

  setTrackReverbRoomSize(trackIndex, roomSize) {
    console.log(`🎛️ Setting track ${trackIndex} reverb room size to ${roomSize}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        trackIndex,
        control: "reverbRoomSize",
        value: roomSize
      }
    });
  }

  setTrackReverbDamp(trackIndex, damp) {
    console.log(`🎛️ Setting track ${trackIndex} reverb damp to ${damp}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        trackIndex,
        control: "reverbDamp",
        value: damp
      }
    });
  }

  setGlobalFlanger(wet) {
    console.log(`🎛️ REAL TIMELINE MIXER: Setting global flanger wet to ${wet}`);
    if (!this.audioEngine) {
      console.log(`🎛️ ERROR: AudioEngine not initialized!`);
      throw new Error("AudioEngine not initialized");
    }

    console.log(`🎛️ Sending trackControl message: globalFlanger=${wet}`);
    console.log(`🎛️ AudioEngine exists:`, !!this.audioEngine);
    console.log(`🎛️ sendMessageToAudioProcessor exists:`, typeof this.audioEngine.sendMessageToAudioProcessor);
    
    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        control: "globalFlanger",
        value: wet
      }
    });
    console.log(`🎛️ Message sent successfully`);
  }

  setGlobalFlangerEnabled(enabled) {
    console.log(`🎛️ Setting global flanger enabled to ${enabled}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        control: "globalFlangerEnabled",
        value: enabled
      }
    });
  }

  setGlobalFlangerDepth(depth) {
    console.log(`🎛️ Setting global flanger depth to ${depth}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        control: "globalFlangerDepth",
        value: depth
      }
    });
  }

  setGlobalFlangerLfoBeats(lfoBeats) {
    console.log(`🎛️ Setting global flanger LFO beats to ${lfoBeats}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        control: "globalFlangerLfoBeats",
        value: lfoBeats
      }
    });
  }

  setGlobalFlangerBpm(bpm) {
    console.log(`🎛️ Setting global flanger BPM to ${bpm}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        control: "globalFlangerBpm",
        value: bpm
      }
    });
  }

  setGlobalFlangerClipperThreshold(threshold) {
    console.log(`🎛️ Setting global flanger clipper threshold to ${threshold}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        control: "globalFlangerClipperThreshold",
        value: threshold
      }
    });
  }

  setGlobalFlangerClipperMaximum(maximum) {
    console.log(`🎛️ Setting global flanger clipper maximum to ${maximum}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        control: "globalFlangerClipperMaximum",
        value: maximum
      }
    });
  }

  setGlobalFlangerStereo(stereo) {
    console.log(`🎛️ Setting global flanger stereo to ${stereo}`);
    if (!this.audioEngine) {
      throw new Error("AudioEngine not initialized");
    }

    this.audioEngine.sendMessageToAudioProcessor({
      type: "trackControl",
      data: { 
        control: "globalFlangerStereo",
        value: stereo
      }
    });
  }

  // Clean up resources
  dispose() {
    if (this.audioEngine) {
      // Thomas's AudioEngine doesn't have a dispose method, but we can reset it
      this.reset();
      this.audioEngine = null;
    }
    this.isReady = false;
    this.isPlaying = false;
  }
}

export default RealTimelineMixerEngine;
