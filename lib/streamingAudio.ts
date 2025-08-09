// src/lib/streamingAudio.ts
// 🛡️ BULLETPROOF MOBILE STREAMING AUDIO SYSTEM

// ==================== 📱 MOBILE DETECTION & OPTIMIZATION ====================

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

const isInstagram = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.includes('Instagram');
};

// Mobile-specific configuration
const MOBILE_CONFIG = {
  maxMemoryMB: isMobile() ? 80 : 200,        // Conservative memory limit
  chunkSizeSeconds: isMobile() ? 4 : 8,      // Smaller chunks on mobile
  maxCachedChunks: isMobile() ? 2 : 4,       // Fewer cached chunks
  preloadBuffer: isMobile() ? 1 : 2,         // Less preloading
  gcInterval: isMobile() ? 3000 : 10000,     // More frequent cleanup
  maxConcurrentLoads: isMobile() ? 2 : 4,    // Limit concurrent downloads
};

// ==================== 🧠 MEMORY MANAGER ====================

class MemoryManager {
  private static instance: MemoryManager;
  private memoryUsage: number = 0;
  private maxMemory: number = MOBILE_CONFIG.maxMemoryMB * 1024 * 1024; // Convert to bytes
  private gcTimer: number | null = null;
  private cleanupCallbacks: Set<() => void> = new Set();

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  constructor() {
    this.startMemoryMonitoring();
  }

  private startMemoryMonitoring(): void {
    if (this.gcTimer) return;

    this.gcTimer = window.setInterval(() => {
      this.checkMemoryPressure();
    }, MOBILE_CONFIG.gcInterval);

    // Listen for mobile memory warnings
    if ('onmemorywarning' in window) {
      (window as any).addEventListener('memorywarning', () => {
        console.warn('📱 Mobile memory warning detected');
        this.forceCleanup();
      });
    }
  }

  private checkMemoryPressure(): void {
    // Check JS heap memory if available
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      if (memInfo) {
        const usageRatio = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
        if (usageRatio > 0.75) {
          console.warn(`⚠️ High memory usage: ${(usageRatio * 100).toFixed(1)}%`);
          this.forceCleanup();
        }
      }
    }

    // Check our tracked memory usage
    if (this.memoryUsage > this.maxMemory * 0.8) {
      console.warn(`⚠️ Approaching memory limit: ${(this.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
      this.forceCleanup();
    }
  }

  addMemoryUsage(bytes: number): void {
    this.memoryUsage += bytes;
  }

  removeMemoryUsage(bytes: number): void {
    this.memoryUsage = Math.max(0, this.memoryUsage - bytes);
  }

  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  unregisterCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.delete(callback);
  }

  private forceCleanup(): void {
    console.log('🧹 Forcing memory cleanup...');
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Cleanup callback failed:', error);
      }
    });

    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
  }

  destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    this.cleanupCallbacks.clear();
  }
}

// ==================== 🎵 BULLETPROOF STREAMING AUDIO MANAGER ====================

export class StreamingAudioManager {
  private ctx: AudioContext;
  private stems: Map<string, BulletproofStemPlayer> = new Map();
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private masterGain: GainNode;
  private memoryManager: MemoryManager;
  private syncTimer: number | null = null;
  private positionTimer: number | null = null;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    this.memoryManager = MemoryManager.getInstance();
    
    // Create master gain with conservative volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = isMobile() ? 0.4 : 0.6; // Lower volume on mobile
    this.masterGain.connect(this.ctx.destination);

    // Register cleanup callback
    this.memoryManager.registerCleanupCallback(() => this.performCleanup());
  }

  async addStem(label: string, url: string, options: any = {}): Promise<BulletproofStemPlayer> {
    const stem = new BulletproofStemPlayer(this.ctx, url, label, {
      ...options,
      memoryManager: this.memoryManager
    });
    
    await stem.initialize();
    stem.connect(this.masterGain);
    this.stems.set(label, stem);
    
    console.log(`✅ Added stem: ${label}`);
    return stem;
  }

  async playAll(): Promise<void> {
    if (this.isPlaying) return;
    
    console.log(`🎵 Starting synchronized playback from ${this.pausedAt.toFixed(1)}s...`);
    
    const currentTime = this.pausedAt || 0;
    this.startTime = this.ctx.currentTime - currentTime;
    this.isPlaying = true;

    // Start all stems with tight synchronization
    const syncTime = this.ctx.currentTime + 0.1; // Small buffer for sync
    const playPromises = Array.from(this.stems.values()).map(stem => 
      stem.play(currentTime, syncTime)
    );
    
    await Promise.all(playPromises);
    
    // Start monitoring
    this.startSyncMonitoring();
    this.startPositionTracking();
  }

  private startSyncMonitoring(): void {
    if (this.syncTimer) return;
    
    this.syncTimer = window.setInterval(() => {
      if (!this.isPlaying) return;
      
      // Check if all stems are still in sync
      const positions = Array.from(this.stems.values()).map(stem => stem.getCurrentPosition());
      const maxDrift = Math.max(...positions) - Math.min(...positions);
      
      if (maxDrift > 0.1) { // 100ms drift tolerance
        console.warn(`⚠️ Sync drift detected: ${(maxDrift * 1000).toFixed(0)}ms`);
      }
    }, 1000);
  }

  private startPositionTracking(): void {
    if (this.positionTimer) return;
    
    this.positionTimer = window.setInterval(() => {
      if (!this.isPlaying) return;
      
      // Update positions of all stems based on current time
      const currentTime = this.getCurrentTime();
      this.stems.forEach(stem => {
        stem.updateCurrentPosition(currentTime);
      });
    }, 100); // Update every 100ms for smooth tracking
  }

  async stopAll(): Promise<void> {
    console.log('⏹️ Stopping all stems...');
    
    this.isPlaying = false;
    this.pausedAt = this.getCurrentTime();
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
    
    const stopPromises = Array.from(this.stems.values()).map(stem => stem.stop());
    await Promise.all(stopPromises);
    
    console.log(`💾 Paused at ${this.pausedAt.toFixed(1)}s`);
  }

  seekTo(seconds: number): void {
    console.log(`🎯 Seeking to ${seconds.toFixed(1)}s`);
    this.pausedAt = Math.max(0, seconds);
    
    // Update all stem positions immediately
    this.stems.forEach(stem => {
      stem.updateCurrentPosition(this.pausedAt);
    });
    
    if (this.isPlaying) {
      this.stopAll().then(() => this.playAll());
    }
  }

  getCurrentTime(): number {
    if (!this.isPlaying) return this.pausedAt;
    return Math.max(0, this.ctx.currentTime - this.startTime);
  }

  getStem(label: string): BulletproofStemPlayer | undefined {
    return this.stems.get(label);
  }

  private performCleanup(): void {
    console.log('🧹 Performing audio cleanup...');
    this.stems.forEach(stem => stem.performCleanup());
  }

  dispose(): void {
    console.log('🗑️ Disposing audio manager...');
    
    this.stopAll();
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
    
    this.stems.forEach(stem => stem.dispose());
    this.stems.clear();
    
    this.memoryManager.unregisterCleanupCallback(() => this.performCleanup());
    this.masterGain.disconnect();
  }
}

// ==================== 🛡️ BULLETPROOF STEM PLAYER ====================

class BulletproofStemPlayer {
  private ctx: AudioContext;
  private url: string;
  private label: string;
  private options: any;
  private memoryManager: MemoryManager;

  // Audio nodes
  public gainNode: GainNode;
  public delayNode: DelayNode;
  public feedbackGain: GainNode;
  
  // File properties
  private fileSize: number = 0;
  private actualBytesPerSecond: number = 0;
  
  // Streaming state
  private chunks: Map<number, AudioBuffer> = new Map();
  private chunkSizes: Map<number, number> = new Map();
  private loadingChunks: Set<number> = new Set();
  private currentSources: AudioBufferSourceNode[] = [];
  private isPlaying: boolean = false;
  private currentPosition: number = 0;
  private duration: number = 0;
  private sampleRate: number = 44100;
  private totalChunks: number = 0;
  private chunkDuration: number = MOBILE_CONFIG.chunkSizeSeconds;
  private playbackRate: number = 1.0;
  
  // Mobile optimization
  private loadQueue: number[] = [];
  private lastCleanupTime: number = 0;

  constructor(audioContext: AudioContext, url: string, label: string, options: any = {}) {
    this.ctx = audioContext;
    this.url = url;
    this.label = label;
    this.options = options;
    this.memoryManager = options.memoryManager || MemoryManager.getInstance();

    // Setup audio nodes with mobile-optimized settings
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.8;
    
    this.delayNode = this.ctx.createDelay(2.0); // Shorter max delay on mobile
    this.delayNode.delayTime.value = 0;
    
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0;
    
    // Clean audio chain
    this.gainNode.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
  }

  async initialize(): Promise<void> {
    try {
      console.log(`[${this.label}] 🔍 Analyzing audio file...`);
      
      // Get file metadata without loading the whole file
      const headResponse = await fetch(this.url, { method: 'HEAD' });
      if (!headResponse.ok) {
        throw new Error(`Failed to access ${this.url}: ${headResponse.status}`);
      }
      
      this.fileSize = parseInt(headResponse.headers.get('content-length') || '0');
      
      // Load a small sample to get audio properties
      const sampleSize = Math.min(1024 * 1024, this.fileSize); // 1MB or file size
      const sampleResponse = await fetch(this.url, {
        headers: { 'Range': `bytes=0-${sampleSize - 1}` }
      });
      
      const sampleBuffer = await sampleResponse.arrayBuffer();
      const sampleAudio = await this.ctx.decodeAudioData(sampleBuffer);
      
      // Calculate file properties
      this.sampleRate = sampleAudio.sampleRate;
      this.actualBytesPerSecond = this.estimateBytesPerSecond(sampleAudio, sampleSize);
      this.duration = this.fileSize / this.actualBytesPerSecond;
      
      // Calculate chunking strategy
      this.totalChunks = Math.ceil(this.duration / this.chunkDuration);
      
      console.log(`[${this.label}] ✅ Ready: ${this.duration.toFixed(1)}s, ${this.totalChunks} chunks, ${this.fileSize} bytes`);
      
      // Cache the first chunk
      await this.loadChunk(0);
      
    } catch (error) {
      console.error(`[${this.label}] ❌ Initialization failed:`, error);
      throw error;
    }
  }

  private estimateBytesPerSecond(buffer: AudioBuffer, bufferBytes: number): number {
    const bufferDuration = buffer.duration;
    return bufferBytes / bufferDuration;
  }

  private async loadChunk(chunkIndex: number): Promise<AudioBuffer | null> {
    if (chunkIndex >= this.totalChunks) return null;
    if (this.chunks.has(chunkIndex)) return this.chunks.get(chunkIndex)!;
    if (this.loadingChunks.has(chunkIndex)) return null;

    // Check concurrent load limit
    if (this.loadingChunks.size >= MOBILE_CONFIG.maxConcurrentLoads) {
      this.loadQueue.push(chunkIndex);
      return null;
    }

    this.loadingChunks.add(chunkIndex);

    try {
      // ✅ FIXED: Use time-based calculation with actual file properties
      const startTime = chunkIndex * this.chunkDuration;
      const endTime = Math.min((chunkIndex + 1) * this.chunkDuration, this.duration);
      
      // ✅ FIXED: Calculate proper byte ranges based on actual file properties
      const bytesPerSecond = this.actualBytesPerSecond || 176400; // Use calculated or fallback
      const startByte = Math.floor(startTime * bytesPerSecond);
      const endByte = Math.min(
        Math.floor(endTime * bytesPerSecond), 
        this.fileSize - 1 // ✅ Never exceed actual file size
      );
      
      // ✅ SAFETY CHECK: Ensure valid range
      if (startByte >= this.fileSize || startByte > endByte) {
        console.warn(`[${this.label}] Invalid range: ${startByte}-${endByte} (file size: ${this.fileSize})`);
        this.loadingChunks.delete(chunkIndex);
        return null;
      }
      
      console.log(`[${this.label}] Loading chunk ${chunkIndex}: bytes ${startByte}-${endByte}`);
      
      const response = await fetch(this.url, {
        headers: { 'Range': `bytes=${startByte}-${endByte}` }
      });

      if (!response.ok) {
        if (response.status === 416) {
          console.warn(`[${this.label}] Range not satisfiable for chunk ${chunkIndex}, trying smaller range`);
          // ✅ FALLBACK: Try loading just the remaining bytes
          const fallbackEnd = Math.min(startByte + 100000, this.fileSize - 1); // 100KB fallback
          const fallbackResponse = await fetch(this.url, {
            headers: { 'Range': `bytes=${startByte}-${fallbackEnd}` }
          });
          if (!fallbackResponse.ok) throw new Error(`HTTP ${fallbackResponse.status}`);
          const arrayBuffer = await fallbackResponse.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          
          // Store with tracking
          const bufferSize = arrayBuffer.byteLength;
          this.memoryManager.addMemoryUsage(bufferSize);
          this.chunkSizes.set(chunkIndex, bufferSize);
          this.chunks.set(chunkIndex, audioBuffer);
          this.loadingChunks.delete(chunkIndex);
          
          return audioBuffer;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      
      // Track memory usage
      const bufferSize = arrayBuffer.byteLength;
      this.memoryManager.addMemoryUsage(bufferSize);
      this.chunkSizes.set(chunkIndex, bufferSize);
      
      // Store chunk
      this.chunks.set(chunkIndex, audioBuffer);
      this.loadingChunks.delete(chunkIndex);
      
      // Process load queue
      this.processLoadQueue();
      
      // Cleanup old chunks if needed
      this.cleanupOldChunks(chunkIndex);
      
      console.log(`[${this.label}] ✅ Loaded chunk ${chunkIndex + 1}/${this.totalChunks}`);
      return audioBuffer;
      
    } catch (error) {
      console.error(`[${this.label}] ❌ Failed to load chunk ${chunkIndex}:`, error);
      this.loadingChunks.delete(chunkIndex);
      this.processLoadQueue();
      return null;
    }
  }

  private processLoadQueue(): void {
    if (this.loadQueue.length === 0) return;
    if (this.loadingChunks.size >= MOBILE_CONFIG.maxConcurrentLoads) return;
    
    const nextChunk = this.loadQueue.shift();
    if (nextChunk !== undefined) {
      this.loadChunk(nextChunk);
    }
  }

  private cleanupOldChunks(currentChunk: number): void {
    const now = Date.now();
    if (now - this.lastCleanupTime < 5000) return; // Cleanup every 5 seconds max
    
    this.lastCleanupTime = now;
    
    // Keep only chunks around current position
    const keepRange = MOBILE_CONFIG.maxCachedChunks;
    const chunksToDelete: number[] = [];
    
    for (const [chunkIndex] of this.chunks) {
      if (Math.abs(chunkIndex - currentChunk) > keepRange) {
        chunksToDelete.push(chunkIndex);
      }
    }
    
    // Delete old chunks
    chunksToDelete.forEach(chunkIndex => {
      const size = this.chunkSizes.get(chunkIndex) || 0;
      this.memoryManager.removeMemoryUsage(size);
      this.chunks.delete(chunkIndex);
      this.chunkSizes.delete(chunkIndex);
    });
    
    if (chunksToDelete.length > 0) {
      console.log(`[${this.label}] 🧹 Cleaned ${chunksToDelete.length} old chunks`);
    }
  }

  async play(startTime: number = 0, syncTime?: number): Promise<void> {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.currentPosition = startTime;
    
    const startChunk = Math.floor(startTime / this.chunkDuration);
    await this.scheduleChunks(startChunk, syncTime);
  }

  private async scheduleChunks(startChunk: number, syncTime?: number): Promise<void> {
    const when = syncTime || this.ctx.currentTime + 0.01;
    let currentTime = when;
    
    // Preload next few chunks
    const chunksToPreload = Math.min(MOBILE_CONFIG.preloadBuffer, this.totalChunks - startChunk);
    for (let i = 0; i < chunksToPreload; i++) {
      this.loadChunk(startChunk + i);
    }
    
    // Schedule initial chunks
    for (let chunkIndex = startChunk; chunkIndex < this.totalChunks && this.isPlaying; chunkIndex++) {
      const buffer = await this.loadChunk(chunkIndex);
      if (!buffer || !this.isPlaying) break;
      
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = this.playbackRate;
      source.connect(this.gainNode);
      
      const chunkStartTime = chunkIndex * this.chunkDuration;
      const offset = chunkIndex === startChunk ? (this.currentPosition - chunkStartTime) : 0;
      const duration = buffer.duration - offset;
      
      if (duration > 0) {
        source.start(currentTime, offset, duration);
        this.currentSources.push(source);
        currentTime += duration / this.playbackRate;
      }
      
      // Preload next chunk
      if (chunkIndex + MOBILE_CONFIG.preloadBuffer < this.totalChunks) {
        this.loadChunk(chunkIndex + MOBILE_CONFIG.preloadBuffer);
      }
    }
  }

  async stop(): Promise<void> {
    this.isPlaying = false;
    
    // Stop all sources
    this.currentSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might already be stopped
      }
    });
    
    this.currentSources = [];
  }

  connect(destination: AudioNode): void {
    this.gainNode.connect(destination);
  }

  disconnect(): void {
    this.gainNode.disconnect();
  }

  setVolume(volume: number): void {
    const safeVolume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.setTargetAtTime(safeVolume, this.ctx.currentTime, 0.01);
  }

  setDelay(amount: number): void {
    const maxDelay = isMobile() ? 0.2 : 0.5; // Shorter delays on mobile
    const delayTime = Math.max(0, Math.min(maxDelay, amount * maxDelay));
    const feedbackAmount = Math.max(0, Math.min(0.4, amount * 0.15)); // Very conservative feedback
    
    this.delayNode.delayTime.setTargetAtTime(delayTime, this.ctx.currentTime, 0.1);
    this.feedbackGain.gain.setTargetAtTime(feedbackAmount, this.ctx.currentTime, 0.1);
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.25, Math.min(4.0, rate));
    this.currentSources.forEach(source => {
      try {
        source.playbackRate.setTargetAtTime(this.playbackRate, this.ctx.currentTime, 0.01);
      } catch (e) {
        // Source might be stopped
      }
    });
  }

  getCurrentPosition(): number {
    return this.currentPosition;
  }

  updateCurrentPosition(newPosition: number): void {
    this.currentPosition = newPosition;
  }

  getDuration(): number {
    return this.duration;
  }

  performCleanup(): void {
    // Aggressive cleanup - keep only current chunk
    const currentChunk = Math.floor(this.currentPosition / this.chunkDuration);
    const chunksToDelete: number[] = [];
    
    for (const [chunkIndex] of this.chunks) {
      if (Math.abs(chunkIndex - currentChunk) > 1) {
        chunksToDelete.push(chunkIndex);
      }
    }
    
    chunksToDelete.forEach(chunkIndex => {
      const size = this.chunkSizes.get(chunkIndex) || 0;
      this.memoryManager.removeMemoryUsage(size);
      this.chunks.delete(chunkIndex);
      this.chunkSizes.delete(chunkIndex);
    });
    
    console.log(`[${this.label}] 🧹 Emergency cleanup: removed ${chunksToDelete.length} chunks`);
  }

  dispose(): void {
    this.stop();
    
    // Clean up all chunks
    this.chunks.forEach((_, chunkIndex) => {
      const size = this.chunkSizes.get(chunkIndex) || 0;
      this.memoryManager.removeMemoryUsage(size);
    });
    
    this.chunks.clear();
    this.chunkSizes.clear();
    this.loadingChunks.clear();
    this.loadQueue = [];
    
    this.gainNode.disconnect();
    this.delayNode.disconnect();
    this.feedbackGain.disconnect();
  }
}

// ==================== 🔧 INTEGRATION FUNCTIONS ====================

export const createStreamingPlayAll = (
  stems: Array<{ label: string; file: string }>,
  audioCtxRef: React.MutableRefObject<AudioContext | null>,
  gainNodesRef: React.MutableRefObject<Record<string, GainNode>>,
  delayNodesRef: React.MutableRefObject<Record<string, DelayNode>>,
  feedbackGainsRef: React.MutableRefObject<Record<string, GainNode>>
) => {
  let streamingManager: StreamingAudioManager | null = null;

  return async function playAll(): Promise<StreamingAudioManager> {
    try {
      console.log('🚀 Initializing bulletproof streaming...');
      
      // Initialize audio context with mobile optimizations
      let ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioContext({
          sampleRate: isMobile() ? 44100 : undefined, // Force standard sample rate on mobile
        });
        audioCtxRef.current = ctx;
      }
      
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Clean up existing manager
      if (streamingManager) {
        streamingManager.dispose();
      }

      // Create new bulletproof manager
      streamingManager = new StreamingAudioManager(ctx);

      // Add stems with progress tracking
      console.log(`📦 Loading ${stems.length} stems...`);
      
      const loadPromises = stems.map(async ({ label, file }, index) => {
        console.log(`⏳ Loading stem ${index + 1}/${stems.length}: ${label}`);
        
        const stem = await streamingManager!.addStem(label, file);
        
        // Store references for existing controls
        gainNodesRef.current[label] = stem.gainNode;
        delayNodesRef.current[label] = stem.delayNode;
        feedbackGainsRef.current[label] = stem.feedbackGain;
        
        return stem;
      });

      await Promise.all(loadPromises);
      console.log('✅ All stems loaded and ready!');

      // Start synchronized playback
      await streamingManager.playAll();
      
      return streamingManager;
    } catch (error) {
      console.error('❌ Bulletproof streaming failed:', error);
      throw error;
    }
  };
};

export const createStreamingStopAll = () => {
  let streamingManager: StreamingAudioManager | null = null;
  
  const setManager = (manager: StreamingAudioManager) => {
    streamingManager = manager;
    
    return async function stopAll(): Promise<void> {
      if (streamingManager) {
        await streamingManager.stopAll();
      }
    };
  };

  setManager.stopAll = async (): Promise<void> => {
    if (streamingManager) {
      await streamingManager.stopAll();
    }
  };

  return setManager;
};

// ==================== 📱 MOBILE OPTIMIZATION ====================

export const optimizeForMobile = (): (() => void) => {
  console.log('📱 Bulletproof mobile optimization enabled');
  
  const memoryManager = MemoryManager.getInstance();
  
  // Setup performance monitoring
  let performanceTimer: number | null = null;
  
  if (isMobile()) {
    performanceTimer = window.setInterval(() => {
      // Monitor frame rate on mobile
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        if (memInfo) {
          const usageMB = memInfo.usedJSHeapSize / 1024 / 1024;
          if (usageMB > MOBILE_CONFIG.maxMemoryMB * 0.9) {
            console.warn(`📱 High memory usage: ${usageMB.toFixed(1)}MB`);
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }
  
  // Return cleanup function
  return () => {
    if (performanceTimer) {
      clearInterval(performanceTimer);
    }
    memoryManager.destroy();
  };
};