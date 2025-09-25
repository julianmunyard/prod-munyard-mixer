// Timeline MixerEngine - Bridge between your existing interface and Thomas's timeline system
// This maintains your existing API while using the superior timeline audio engine

import TimelineAudioEngine from './timelineAudioEngine.js';

export class TimelineMixerEngine {
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
    this.timelineEngine = null;
    this.loadedStems = new Set();
    this.currentTime = 0;
    
    this.initializeTimelineEngine();
  }

  async initializeTimelineEngine() {
    try {
      this.timelineEngine = new TimelineAudioEngine();
      
      // Set up callbacks
      this.timelineEngine.onTimelineFrameCursorUpdate = (timelineFrameCursor) => {
        this.currentTime = timelineFrameCursor / this.timelineEngine.webaudioManager.audioContext.sampleRate;
      };
      
      this.timelineEngine.onAllAssetsDownloaded = () => {
        this.isReady = true;
        console.log('🎵 All stems loaded, timeline ready');
      };
      
      await this.timelineEngine.init();
      console.log('🎵 Timeline MixerEngine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Timeline MixerEngine:', error);
      throw error;
    }
  }

  async loadStems(stems) {
    if (!this.timelineEngine) {
      throw new Error('Timeline MixerEngine not properly initialized');
    }

    console.log('🎵 Loading stems into Timeline MixerEngine:', stems);
    this.stems = stems;
    this.loadedStems.clear();
    this.isReady = false;

    try {
      // Resolve Supabase URLs and prepare for timeline
      const resolvedStems = [];
      for (let i = 0; i < stems.length; i++) {
        const stem = stems[i];
        const stemId = stem.name || `stem_${i}`;
        
        // Map web component index to stemId
        this.stemIdMap.set(i, stemId);
        
        // Resolve URL if needed
        let url = stem.url;
        if (stem.url && !stem.url.startsWith('http')) {
          url = await this.resolveStemUrl(stem.url);
        }
        
        resolvedStems.push({
          name: stem.name || stem.label || `Stem ${i + 1}`,
          url: url,
          volume: stem.volume || 1.0
        });
      }
      
      // Load into timeline system
      await this.timelineEngine.loadStemsFromSupabase(resolvedStems);
      
      console.log('🎵 All stems submitted for loading');
    } catch (error) {
      console.error('❌ Failed to load stems:', error);
      throw error;
    }
  }

  async resolveStemUrl(file) {
    // You'll need to import or recreate your Supabase URL resolution logic
    // For now, return the file as-is
    return file;
  }

  async play() {
    if (!this.timelineEngine || !this.isReady) {
      throw new Error('Timeline MixerEngine not ready for playback');
    }

    try {
      this.timelineEngine.play();
      this.isPlaying = true;
      console.log('🎵 Timeline MixerEngine playback started');
    } catch (error) {
      console.error('❌ Failed to start playback:', error);
      throw error;
    }
  }

  pause() {
    if (!this.timelineEngine) return;

    this.timelineEngine.pause();
    this.isPlaying = false;
    console.log('🎵 Timeline MixerEngine playback paused');
  }

  stop() {
    if (!this.timelineEngine) return;

    this.timelineEngine.pause();
    this.timelineEngine.seek(0);
    this.isPlaying = false;
    console.log('🎵 Timeline MixerEngine playback stopped');
  }

  // Seek to specific time position
  seek(timeInSeconds) {
    if (!this.timelineEngine) return;

    this.timelineEngine.seek(timeInSeconds);
    console.log('🎵 Seeked to position:', timeInSeconds);
  }

  // Set volume for a specific stem by index
  setStemVolume(stemIndex, volume) {
    // TODO: Implement volume control in timeline system
    console.log(`🎵 Set volume for stem ${stemIndex}:`, volume);
  }

  // Mute/unmute stem by index
  muteStem(stemIndex, isMuted) {
    // TODO: Implement mute control in timeline system
    console.log(`${isMuted ? '🎵 Muted' : '🎵 Unmuted'} stem ${stemIndex}`);
  }

  // Solo stem by index
  soloStem(stemIndex, isSoloed) {
    // TODO: Implement solo control in timeline system
    console.log(`${isSoloed ? '🎵 Soloed' : '🎵 Unsoloed'} stem ${stemIndex}`);
  }

  // Set playback rate/speed for all stems
  setRate(rate) {
    // TODO: Implement rate control in timeline system
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    console.log('🎵 Set playback rate:', clampedRate);
  }

  // Set master volume
  setMasterVolume(volume) {
    // TODO: Implement master volume control in timeline system
    const clampedVolume = Math.max(0, Math.min(1, volume));
    console.log('🎵 Set master volume:', clampedVolume);
  }

  // Get current state information
  getState() {
    return {
      isPlaying: this.isPlaying,
      isReady: this.isReady,
      stemsLoaded: this.loadedStems.size,
      totalStems: this.stems.length,
      currentTime: this.currentTime,
      stems: this.stems.map((stem, index) => ({
        index,
        name: stem.name,
        stemId: this.stemIdMap.get(index)
      }))
    };
  }

  // Clean up resources
  dispose() {
    if (this.timelineEngine) {
      this.timelineEngine.dispose();
      this.timelineEngine = null;
    }
    
    this.stems = [];
    this.stemIdMap.clear();
    this.loadedStems.clear();
    this.isPlaying = false;
    this.isReady = false;
    
    console.log('🎵 Timeline MixerEngine disposed');
  }
}
