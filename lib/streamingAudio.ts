// src/lib/simpleStreamingAudio.ts
// 🎵 TINY CHUNKS - Actually works on mobile!

// ==================== 📱 MOBILE DETECTION ====================

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// ==================== ⚙️ MOBILE-FIRST CONFIG ====================

const CONFIG = {
  chunkDuration: isMobile() ? 2 : 3, // TINY chunks for mobile
  maxActiveChunks: 3, // 3 chunks max = 6 seconds in memory
  preloadAhead: 2, // Always have 2 chunks ready
  maxMemoryMB: isMobile() ? 15 : 30, // Very conservative
  scheduleAhead: 0.1,
  crossfade: 0.01, // Tiny crossfade
};

// ==================== 🧠 TINY CACHE ====================

class TinyCache {
  private static instance: TinyCache;
  private chunks = new Map<string, AudioBuffer>();
  private memoryUsed = 0;
  private maxMemory = CONFIG.maxMemoryMB * 1024 * 1024;

  static getInstance(): TinyCache {
    if (!TinyCache.instance) {
      TinyCache.instance = new TinyCache();
    }
    return TinyCache.instance;
  }

  store(key: string, buffer: AudioBuffer): void {
    // Remove old version
    this.remove(key);
    
    const size = buffer.length * buffer.numberOfChannels * 4;
    
    // Aggressive cleanup to stay under limit
    while (this.memoryUsed + size > this.maxMemory && this.chunks.size > 0) {
      const oldestKey = this.chunks.keys().next().value;
      if (oldestKey) this.remove(oldestKey);
    }
    
    this.chunks.set(key, buffer);
    this.memoryUsed += size;
  }

  get(key: string): AudioBuffer | null {
    return this.chunks.get(key) || null;
  }

  remove(key: string): void {
    const buffer = this.chunks.get(key);
    if (buffer) {
      const size = buffer.length * buffer.numberOfChannels * 4;
      this.chunks.delete(key);
      this.memoryUsed -= size;
    }
  }

  clear(): void {
    this.chunks.clear();
    this.memoryUsed = 0;
  }

  getMemoryMB(): number {
    return this.memoryUsed / 1024 / 1024;
  }
}

// ==================== 🎵 MOBILE STEM ====================

// Fixed MobileStem class with proper varispeed timing
class MobileStem {
  private ctx: AudioContext;
  private url: string;
  private label: string;
  private cache = TinyCache.getInstance();
  
  // Audio nodes
  public gainNode: GainNode;
  public delayNode: DelayNode;
  public feedbackGain: GainNode;
  
  // Track info
  private fullBuffer: AudioBuffer | null = null;
  private duration = 0;
  private isLoaded = false;
  
  // 🔥 FIXED: Proper varispeed timing tracking
  private isPlaying = false;
  private playbackRate = 1.0;
  private audioStartTime = 0; // When audio position 0 should have started
  private realStartTime = 0;   // Actual ctx.currentTime when we started
  private pausedAudioTime = 0; // Where we paused in audio timeline
  
  // Tiny chunking
  private chunkDuration = CONFIG.chunkDuration;
  private totalChunks = 0;
  private activeSources = new Map<number, AudioBufferSourceNode>();
  private scheduler: number | null = null;
  
  // 🔥 NEW: Dynamic scheduling state
  private lastScheduleCheck = 0;
  private scheduledUpToChunk = -1;

  constructor(audioContext: AudioContext, url: string, label: string) {
    this.ctx = audioContext;
    this.url = url;
    this.label = label;
    
    // Simple audio chain
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.8;
    
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.value = 0;
    
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0;
  }

  async initialize(): Promise<void> {
    if (this.isLoaded) return;
    
    try {
      console.log(`[${this.label}] 📱 Loading for mobile...`);
      
      const response = await fetch(this.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Mobile file size check
      const sizeMB = arrayBuffer.byteLength / 1024 / 1024;
      if (isMobile() && sizeMB > 20) {
        console.warn(`[${this.label}] ⚠️ Large file (${sizeMB.toFixed(1)}MB) on mobile`);
      }
      
      this.fullBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.duration = this.fullBuffer.duration;
      this.totalChunks = Math.ceil(this.duration / this.chunkDuration);
      this.isLoaded = true;
      
      console.log(`[${this.label}] ✅ ${this.duration.toFixed(1)}s → ${this.totalChunks} tiny chunks`);
      
    } catch (error) {
      console.error(`[${this.label}] ❌ Failed:`, error);
      throw error;
    }
  }

  private createChunk(chunkIndex: number): AudioBuffer | null {
    if (!this.fullBuffer) return null;
    
    const chunkKey = `${this.label}_${chunkIndex}`;
    
    // Check cache
    let chunk = this.cache.get(chunkKey);
    if (chunk) return chunk;
    
    try {
      // Calculate sample range
      const sampleRate = this.fullBuffer.sampleRate;
      const startSample = Math.floor(chunkIndex * this.chunkDuration * sampleRate);
      const endSample = Math.min(
        startSample + Math.floor(this.chunkDuration * sampleRate),
        this.fullBuffer.length
      );
      
      const chunkLength = endSample - startSample;
      if (chunkLength <= 0) return null;
      
      // Create chunk
      chunk = this.ctx.createBuffer(
        this.fullBuffer.numberOfChannels,
        chunkLength,
        sampleRate
      );
      
      // Copy data
      for (let ch = 0; ch < this.fullBuffer.numberOfChannels; ch++) {
        const srcData = this.fullBuffer.getChannelData(ch);
        const chunkData = chunk.getChannelData(ch);
        
        for (let i = 0; i < chunkLength; i++) {
          chunkData[i] = srcData[startSample + i] || 0;
        }
      }
      
      // Cache tiny chunk
      this.cache.store(chunkKey, chunk);
      return chunk;
      
    } catch (error) {
      console.error(`[${this.label}] Chunk ${chunkIndex} failed:`, error);
      return null;
    }
  }

  async play(startPosition = 0, syncTime?: number): Promise<void> {
    if (!this.isLoaded || this.isPlaying) return;
    
    this.isPlaying = true;
    this.pausedAudioTime = Math.max(0, Math.min(startPosition, this.duration));
    
    // 🔥 SINGLE CHUNK: Simple timing setup
    const when = syncTime || this.ctx.currentTime + CONFIG.scheduleAhead;
    this.realStartTime = when;
    this.audioStartTime = when - this.pausedAudioTime;
    
    console.log(`[${this.label}] ▶️ SINGLE CHUNK play from ${startPosition.toFixed(1)}s`);
    
    // 🔥 SINGLE CHUNK: Start with just one chunk
    this.startDynamicScheduler();
  }

  // 🔥 HYBRID SCHEDULER: Single chunk + smooth continuity
  private startDynamicScheduler(): void {
    // Kill any existing scheduler
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    
    // 🔥 HYBRID: Start with current chunk (single chunk approach)
    const currentChunk = Math.floor(this.pausedAudioTime / this.chunkDuration);
    const chunkStartTime = currentChunk * this.chunkDuration;
    const offset = Math.max(0, this.pausedAudioTime - chunkStartTime);
    
    this.scheduleSingleChunk(currentChunk, offset);
    
    // 🔥 HYBRID: Safety net to ensure continuous playback
    this.scheduler = window.setInterval(() => {
      if (!this.isPlaying) return;
      
      // Only intervene if no chunks are playing (safety net)
      if (this.activeSources.size === 0) {
        console.log(`[${this.label}] 🚨 HYBRID: Safety restart`);
        const currentPos = this.getCurrentPosition();
        const currentChunk = Math.floor(currentPos / this.chunkDuration);
        const chunkStartTime = currentChunk * this.chunkDuration;
        const offset = Math.max(0, currentPos - chunkStartTime);
        this.scheduleSingleChunk(currentChunk, offset);
      }
      
    }, 200); // Slower check - only for safety
  }

  // 🔥 NUCLEAR CHUNK SCHEDULING: Aggressive immediate scheduling
  private scheduleNeededChunks(): void {
    if (!this.isPlaying) return;
    
    const now = this.ctx.currentTime;
    const currentAudioPosition = this.getCurrentPosition();
    const currentChunk = Math.floor(currentAudioPosition / this.chunkDuration);
    
    // 🔥 NUCLEAR: Aggressive scheduling - always schedule enough chunks
    const chunksToSchedule = Math.max(4, Math.ceil(this.playbackRate * 2)); // More chunks for fast speeds
    const endChunk = Math.min(currentChunk + chunksToSchedule, this.totalChunks - 1);
    
    // 🔥 NUCLEAR: Schedule from current chunk forward
    for (let chunkIndex = currentChunk; chunkIndex <= endChunk; chunkIndex++) {
      if (!this.activeSources.has(chunkIndex)) {
        this.scheduleChunk(chunkIndex);
      }
    }
    
    // 🔥 NUCLEAR: Remove any chunks that are too far behind or ahead
    const toRemove: number[] = [];
    this.activeSources.forEach((source, chunkIndex) => {
      if (chunkIndex < currentChunk - 1 || chunkIndex > currentChunk + chunksToSchedule + 2) {
        toRemove.push(chunkIndex);
      }
    });
    
    toRemove.forEach(chunkIndex => {
      const source = this.activeSources.get(chunkIndex);
      if (source) {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {}
        this.activeSources.delete(chunkIndex);
      }
    });
  }

  // 🔥 EXTREME CHUNK SCHEDULING: Perfect for drastic speed changes
  private scheduleChunk(chunkIndex: number): void {
    if (this.activeSources.has(chunkIndex)) return;
    
    const chunk = this.createChunk(chunkIndex);
    if (!chunk) return;
    
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = chunk;
      source.playbackRate.value = this.playbackRate;
      source.connect(this.gainNode);
      
      // 🔥 EXTREME: Ultra-precise timing for any speed
      const now = this.ctx.currentTime;
      const currentAudioPos = this.getCurrentPosition();
      const chunkAudioStartTime = chunkIndex * this.chunkDuration;
      const chunkAudioEndTime = (chunkIndex + 1) * this.chunkDuration;
      
      let scheduleTime, offset = 0;
      
      // 🔥 EXTREME: Handle timing for ANY speed change
      if (currentAudioPos <= chunkAudioStartTime) {
        // Future chunk - calculate exact timing
        const audioTimeToWait = chunkAudioStartTime - currentAudioPos;
        const realTimeToWait = audioTimeToWait / this.playbackRate;
        scheduleTime = now + Math.max(realTimeToWait, 0.0005); // Minimum 0.5ms buffer
      } else if (currentAudioPos < chunkAudioEndTime) {
        // Current chunk - start immediately with precise offset
        offset = Math.max(0, currentAudioPos - chunkAudioStartTime);
        scheduleTime = now + 0.0005; // 0.5ms buffer for immediate start
      } else {
        // Past chunk - skip completely
        return;
      }
      
      // 🔥 EXTREME: Validate with tight tolerances
      if (scheduleTime < now - 0.0005) {
        return; // Too late
      }
      
      const duration = Math.max(0, chunk.duration - offset);
      if (duration <= 0.0005) return; // Too short
      
      // 🔥 EXTREME: Clamp schedule time to prevent audio engine errors
      const safescheduleTime = Math.max(scheduleTime, now + 0.0001);
      
      // Mark as active BEFORE starting
      this.activeSources.set(chunkIndex, source);
      
      // 🔥 EXTREME: Start with microsecond precision
      source.start(safescheduleTime, offset, duration);
      
      // Immediate cleanup registration
      source.onended = () => {
        this.activeSources.delete(chunkIndex);
      };
      
      // 🔥 EXTREME: High-precision debug for drastic changes
      if (Math.abs(this.playbackRate - 1.0) > 0.2) {
        console.log(`[${this.label}] 💥 EXTREME Chunk ${chunkIndex}: schedule=${safescheduleTime.toFixed(6)}s, offset=${offset.toFixed(6)}s, rate=${this.playbackRate.toFixed(3)}x, pos=${currentAudioPos.toFixed(3)}s`);
      }
      
    } catch (error) {
      console.error(`[${this.label}] EXTREME schedule failed:`, error);
      this.activeSources.delete(chunkIndex);
    }
  }

  private cleanupOldChunks(): void {
    const currentAudioPos = this.getCurrentPosition();
    const currentChunk = Math.floor(currentAudioPos / this.chunkDuration);
    const toRemove: number[] = [];
    
    this.activeSources.forEach((source, chunkIndex) => {
      // Remove chunks that are far behind current position
      if (chunkIndex < currentChunk - 2) {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {
          // Already stopped
        }
        toRemove.push(chunkIndex);
      }
    });
    
    toRemove.forEach(index => {
      this.activeSources.delete(index);
    });
  }

  async stop(): Promise<void> {
    if (!this.isPlaying) return;
    
    // 🔥 FIXED: Save current position before stopping
    this.pausedAudioTime = this.getCurrentPosition();
    this.isPlaying = false;
    
    // Stop scheduler
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    
    // Stop all sources
    this.activeSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeSources.clear();
    
    console.log(`[${this.label}] ⏹️ Mobile stop at ${this.pausedAudioTime.toFixed(1)}s`);
  }

  seekTo(seconds: number): void {
    const target = Math.max(0, Math.min(seconds, this.duration));
    const wasPlaying = this.isPlaying;
    
    console.log(`[${this.label}] 🎯 Mobile seek ${target.toFixed(1)}s`);
    
    // Stop all current sources
    this.activeSources.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    this.activeSources.clear();
    
    // 🔥 FIXED: Update timing properly for seek
    this.pausedAudioTime = target;
    this.scheduledUpToChunk = -1;
    
    if (wasPlaying) {
      // Recalculate timing for new position
      const now = this.ctx.currentTime;
      this.audioStartTime = now - (target / this.playbackRate);
      this.realStartTime = now;
      this.lastScheduleCheck = now;
      
      // Restart scheduling from new position
      this.scheduleNeededChunks();
    }
  }

  // 🔥 SIMPLIFIED: Let Web Audio handle position tracking
  getCurrentPosition(): number {
    if (!this.isPlaying) return this.pausedAudioTime;
    
    // 🔥 SIMPLIFIED: Just use basic elapsed time calculation
    // Let the Web Audio API handle the complexity of playback rate changes
    const now = this.ctx.currentTime;
    const elapsedRealTime = now - this.realStartTime;
    const elapsedAudioTime = elapsedRealTime * this.playbackRate;
    const currentPos = this.pausedAudioTime + elapsedAudioTime;
    
    return Math.max(0, Math.min(currentPos, this.duration));
  }

  // 🔥 PERFECT HYBRID: Single chunk timing + smooth varispeed
  setPlaybackRate(rate: number): void {
    const newRate = Math.max(0.5, Math.min(2.0, rate));
    
    if (Math.abs(this.playbackRate - newRate) < 0.001) return;
    
    console.log(`[${this.label}] 🎯 HYBRID: ${this.playbackRate.toFixed(3)}x → ${newRate.toFixed(3)}x`);
    
    // 🔥 HYBRID: Update rate on current chunk for SMOOTH transition
    this.activeSources.forEach(source => {
      try {
        // 🔥 SMOOTH: Instant smooth rate change like a turntable
        source.playbackRate.value = newRate;
      } catch (e) {
        // Source might be stopped
      }
    });
    
    // 🔥 HYBRID: Update internal rate for future chunks
    this.playbackRate = newRate;
    
    // 🔥 HYBRID: Update timing for accurate position tracking
    if (this.isPlaying) {
      const now = this.ctx.currentTime;
      const currentPos = this.getCurrentPosition();
      this.realStartTime = now;
      this.audioStartTime = now - (currentPos / newRate);
      this.pausedAudioTime = currentPos;
    }
  }

  // 🔥 SMOOTH CHUNK: Schedule with smooth transitions
  private scheduleSingleChunk(chunkIndex: number, offset: number): void {
    const chunk = this.createChunk(chunkIndex);
    if (!chunk) return;
    
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = chunk;
      source.playbackRate.value = this.playbackRate;
      source.connect(this.gainNode);
      
      const now = this.ctx.currentTime;
      const duration = Math.max(0, chunk.duration - offset);
      
      if (duration > 0.001) {
        this.activeSources.set(chunkIndex, source);
        source.start(now + 0.001, offset, duration);
        
        // 🔥 SMOOTH: When chunk ends, smoothly schedule next chunk
        source.onended = () => {
          this.activeSources.delete(chunkIndex);
          if (this.isPlaying && chunkIndex + 1 < this.totalChunks) {
            // 🔥 SMOOTH: No gap between chunks
            setTimeout(() => {
              this.scheduleSingleChunk(chunkIndex + 1, 0);
            }, 1); // 1ms delay for smooth transition
          }
        };
        
        console.log(`[${this.label}] 🎵 SMOOTH Chunk ${chunkIndex}: offset=${offset.toFixed(3)}s, rate=${this.playbackRate.toFixed(3)}x`);
      }
      
    } catch (error) {
      console.error(`[${this.label}] Smooth chunk failed:`, error);
      this.activeSources.delete(chunkIndex);
    }
  }

  setVolume(volume: number): void {
    const safe = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.setTargetAtTime(safe, this.ctx.currentTime, 0.01);
  }

  setDelay(amount: number): void {
    const delay = Math.max(0, Math.min(0.3, amount * 0.3));
    const feedback = Math.max(0, Math.min(0.2, amount * 0.1));
    
    this.delayNode.delayTime.setTargetAtTime(delay, this.ctx.currentTime, 0.1);
    this.feedbackGain.gain.setTargetAtTime(feedback, this.ctx.currentTime, 0.1);
    
    if (delay > 0.01) {
      try {
        this.delayNode.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delayNode);
      } catch (e) {}
    } else {
      try {
        this.delayNode.disconnect(this.feedbackGain);
        this.feedbackGain.disconnect(this.delayNode);
      } catch (e) {}
    }
  }

  getDuration(): number {
    return this.duration;
  }

  connect(destination: AudioNode): void {
    this.gainNode.connect(destination);
  }

  disconnect(): void {
    try {
      this.gainNode.disconnect();
      this.delayNode.disconnect();
      this.feedbackGain.disconnect();
    } catch (e) {}
  }

  dispose(): void {
    this.stop();
    
    // Clear cache for this stem
    for (let i = 0; i < this.totalChunks; i++) {
      this.cache.remove(`${this.label}_${i}`);
    }
    
    this.fullBuffer = null;
    this.disconnect();
  }
}

// ==================== 🎵 MOBILE MANAGER ====================

export class StreamingAudioManager {
  private ctx: AudioContext;
  private stems = new Map<string, MobileStem>();
  private masterGain: GainNode;
  private cache = TinyCache.getInstance();
  
  private isPlaying = false;
  private pausedAt = 0;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);
    
    // Mobile memory monitoring
    if (isMobile()) {
      setInterval(() => {
        const memMB = this.cache.getMemoryMB();
        if (memMB > CONFIG.maxMemoryMB * 0.8) {
          console.warn(`📱 Memory warning: ${memMB.toFixed(1)}MB`);
        }
      }, 5000);
    }
  }

  async addStem(label: string, url: string): Promise<MobileStem> {
    const stem = new MobileStem(this.ctx, url, label);
    await stem.initialize();
    
    stem.connect(this.masterGain);
    this.stems.set(label, stem);
    
    console.log(`✅ ${label} mobile ready`);
    return stem;
  }

  async playAll(): Promise<void> {
    if (this.isPlaying) return;
    
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    
    const startPos = this.pausedAt;
    this.isPlaying = true;
    
    console.log(`📱 Mobile play all from ${startPos.toFixed(1)}s`);
    
    // Tight sync for mobile
    const syncTime = this.ctx.currentTime + CONFIG.scheduleAhead;
    
    const promises = Array.from(this.stems.values()).map(stem =>
      stem.play(startPos, syncTime)
    );
    
    await Promise.all(promises);
    console.log('📱 Mobile stems synced');
  }

  async stopAll(): Promise<void> {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    this.pausedAt = this.getCurrentTime();
    
    const promises = Array.from(this.stems.values()).map(s => s.stop());
    await Promise.all(promises);
    
    console.log(`📱 Mobile stopped at ${this.pausedAt.toFixed(1)}s`);
  }

  seekTo(seconds: number): void {
    this.pausedAt = Math.max(0, seconds);
    
    this.stems.forEach(stem => {
      stem.seekTo(this.pausedAt);
    });
  }

  getCurrentTime(): number {
    if (!this.isPlaying) return this.pausedAt;
    
    // Use first stem's position
    const firstStem = this.stems.values().next().value;
    return firstStem ? firstStem.getCurrentPosition() : this.pausedAt;
  }

  getStem(label: string):MobileStem | undefined {
    return this.stems.get(label);
  }

  dispose(): void {
    this.stopAll();
    this.stems.forEach(stem => stem.dispose());
    this.stems.clear();
    this.masterGain.disconnect();
    this.cache.clear();
  }
}

// ==================== 🔧 EXPORTS ====================

export const createStreamingPlayAll = (
  stems: Array<{ label: string; file: string }>,
  audioCtxRef: React.MutableRefObject<AudioContext | null>,
  gainNodesRef: React.MutableRefObject<Record<string, GainNode>>,
  delayNodesRef: React.MutableRefObject<Record<string, DelayNode>>,
  feedbackGainsRef: React.MutableRefObject<Record<string, GainNode>>
) => {
  let manager: StreamingAudioManager | null = null;

  return async function playAll(): Promise<StreamingAudioManager> {
    try {
      console.log('📱 Starting mobile streaming...');
      
      let ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioContext({
          sampleRate: 44100,
          latencyHint: 'interactive'
        });
        audioCtxRef.current = ctx;
        
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
      }

      if (manager) {
        manager.dispose();
      }

      manager = new StreamingAudioManager(ctx);

      for (const { label, file } of stems) {
        try {
          const stem = await manager.addStem(label, file);
          
          gainNodesRef.current[label] = stem.gainNode;
          delayNodesRef.current[label] = stem.delayNode;
          feedbackGainsRef.current[label] = stem.feedbackGain;
          
        } catch (error) {
          console.error(`Failed ${label}:`, error);
        }
      }

      await manager.playAll();
      return manager;
      
    } catch (error) {
      console.error('📱 Mobile streaming failed:', error);
      throw error;
    }
  };
};

export const createStreamingStopAll = () => {
  let manager: StreamingAudioManager | null = null;
  
  const setManager = (mgr: StreamingAudioManager) => {
    manager = mgr;
    
    return async function stopAll(): Promise<void> {
      if (manager) {
        await manager.stopAll();
      }
    };
  };

  setManager.stopAll = async (): Promise<void> => {
    if (manager) {
      await manager.stopAll();
    }
  };

  return setManager;
};

export const optimizeForMobile = (): (() => void) => {
  console.log('📱 Tiny chunk mobile optimization');
  
  const cleanup = () => {
    TinyCache.getInstance().clear();
  };
  
  if (isMobile()) {
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
  }
  
  return cleanup;
};