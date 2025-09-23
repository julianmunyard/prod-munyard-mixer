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
