// /audio/engine/mixerEngine.js
// Bridge class between sp-mixer web component and SuperpoweredMixerManager

export class MixerEngine {
  constructor(options = {}) {
    this.options = {
      masterVolume: options.masterVolume || 1.0,
      sampleRate: options.sampleRate || 48000,
      bufferSize: options.bufferSize || 4096,
      ...options
    };
    
    this.stems = [];
    this.stemIdMap = new Map(); // Map stem index to stemId for web component
    this.isPlaying = false;
    this.isReady = false;
    this.manager = null;
    this.loadedStems = new Set();
    
    this.initializeManager();
  }

  async initializeManager() {
    try {
      // Import your SuperpoweredMixerManager
      const { SuperpoweredMixerManager } = await import('../../path/to/SuperpoweredMixerManager.js');
      
      this.manager = new SuperpoweredMixerManager();
      
      // Set up message callback to track loading progress
      this.manager.setMessageCallback((message) => {
        console.log('MixerEngine received message:', message);
        
        if (message?.event === "ready") {
          console.log('Superpowered processor ready');
        } else if (message?.event === "assetLoaded") {
          this.loadedStems.add(message.stemId);
          console.log(`Stem loaded: ${message.stemId}`);
          
          // Check if all stems are loaded
          if (this.loadedStems.size === this.stems.length) {
            this.isReady = true;
            console.log('All stems loaded, mixer ready');
          }
        }
      });
      
      console.log('MixerEngine initialized with Superpowered manager');
    } catch (error) {
      console.error('Failed to initialize MixerEngine:', error);
      throw error;
    }
  }

  async loadStems(stems) {
    if (!this.manager) {
      throw new Error('MixerEngine not properly initialized');
    }

    console.log('Loading stems into MixerEngine:', stems);
    this.stems = stems;
    this.loadedStems.clear();
    this.isReady = false;

    try {
      for (let i = 0; i < stems.length; i++) {
        const stem = stems[i];
        const stemId = stem.name || `stem_${i}`;
        
        // Map web component index to stemId
        this.stemIdMap.set(i, stemId);
        
        // Resolve URL if needed (from your existing resolveStemUrl function)
        let url = stem.url;
        if (stem.url && !stem.url.startsWith('http')) {
          url = await this.resolveStemUrl(stem.url);
        }
        
        console.log(`Loading stem ${i} (${stemId}):`, url);
        await this.manager.loadTrack(url, stemId);
      }
      
      console.log('All stems submitted for loading');
    } catch (error) {
      console.error('Failed to load stems:', error);
      throw error;
    }
  }

  async resolveStemUrl(file) {
    // You'll need to import or recreate your Supabase URL resolution logic
    // For now, return the file as-is
    return file;
  }

  async play() {
    if (!this.manager || !this.isReady) {
      throw new Error('MixerEngine not ready for playback');
    }

    try {
      await this.manager.play();
      this.isPlaying = true;
      console.log('MixerEngine playback started');
    } catch (error) {
      console.error('Failed to start playback:', error);
      throw error;
    }
  }

  pause() {
    if (!this.manager) return;

    this.manager.pause();
    this.isPlaying = false;
    console.log('MixerEngine playback paused');
  }

  stop() {
    if (!this.manager) return;

    this.manager.stop();
    this.isPlaying = false;
    console.log('MixerEngine playback stopped');
  }

  // Set volume for a specific stem by index (for web component)
  setStemVolume(stemIndex, volume) {
    if (!this.manager) return;

    const stemId = this.stemIdMap.get(stemIndex);
    if (!stemId) {
      console.warn(`No stem found for index ${stemIndex}`);
      return;
    }

    this.manager.setParameter("volume", volume, stemId);
    console.log(`Set volume for stem ${stemIndex} (${stemId}):`, volume);
  }

  // Mute/unmute stem by index
  muteStem(stemIndex, isMuted) {
    if (!this.manager) return;

    const stemId = this.stemIdMap.get(stemIndex);
    if (!stemId) {
      console.warn(`No stem found for index ${stemIndex}`);
      return;
    }

    this.manager.setParameter("mute", isMuted, stemId);
    console.log(`${isMuted ? 'Muted' : 'Unmuted'} stem ${stemIndex} (${stemId})`);
  }

  // Solo stem by index
  soloStem(stemIndex, isSoloed) {
    if (!this.manager) return;

    const stemId = this.stemIdMap.get(stemIndex);
    if (!stemId) {
      console.warn(`No stem found for index ${stemIndex}`);
      return;
    }

    this.manager.setParameter("solo", isSoloed, stemId);
    console.log(`${isSoloed ? 'Soloed' : 'Unsoloed'} stem ${stemIndex} (${stemId})`);
  }

  // Set playback rate/speed for all stems
  setRate(rate) {
    if (!this.manager) return;

    // Clamp rate to reasonable bounds
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    this.manager.setParameter("speed", clampedRate);
    console.log('Set playback rate:', clampedRate);
  }

  // Seek to specific time position
  seek(timeInSeconds) {
    if (!this.manager) return;

    this.manager.seek(timeInSeconds);
    console.log('Seeked to position:', timeInSeconds);
  }

  // Get current state information
  getState() {
    return {
      isPlaying: this.isPlaying,
      isReady: this.isReady,
      stemsLoaded: this.loadedStems.size,
      totalStems: this.stems.length,
      stems: this.stems.map((stem, index) => ({
        index,
        name: stem.name,
        stemId: this.stemIdMap.get(index)
      }))
    };
  }

  // Set master volume
  setMasterVolume(volume) {
    if (!this.manager) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.manager.setParameter("masterVolume", clampedVolume);
    console.log('Set master volume:', clampedVolume);
  }

  // Clean up resources
  dispose() {
    if (this.manager) {
      this.manager.dispose();
      this.manager = null;
    }
    
    this.stems = [];
    this.stemIdMap.clear();
    this.loadedStems.clear();
    this.isPlaying = false;
    this.isReady = false;
    
    console.log('MixerEngine disposed');
  }
}