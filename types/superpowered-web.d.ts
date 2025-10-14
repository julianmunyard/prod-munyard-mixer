// types/superpowered-web.d.ts
declare module '@superpoweredsdk/web' {
  export const SuperpoweredGlue: {
    Instantiate(licenseKey: string, wasmPath?: string): Promise<any>;
  };

  export class SuperpoweredWebAudio {
    audioContext: AudioContext;
    constructor(sampleRate: number, superpowered: any);

    createAudioNodeAsync(
      workletUrl: string,
      processorName: string,
      onMessage?: (msg: any) => void
    ): Promise<AudioNode>;
  }
}

// AudioEngine type declaration
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
