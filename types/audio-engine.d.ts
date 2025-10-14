// Audio Engine type declarations

declare class AudioEngine {
  webaudioManager: any;
  started: boolean;
  onTimelineFrameCursorUpdate?: (data: any) => void;
  onStemDecoded?: (decodedCount: number, totalCount: number) => void;
  onAllAssetsDownloaded?: () => void;
  resetCallback?: () => void;
  onRegionBufferDataCallback?: (data: any) => void;
  
  init(): Promise<void>;
  sendMessageToAudioProcessor(message: any): void;
  downloadBuffer(trackId: string, regionId: string, sampleRate: number, buffer: any): void;
}

declare class RealTimelineMixerEngine {
  audioEngine: AudioEngine;
  stems: any[];
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  timelineData: any;
  
  init(): Promise<void>;
  loadStemsFromSupabase(stems: any[]): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
}

export { AudioEngine, RealTimelineMixerEngine };
