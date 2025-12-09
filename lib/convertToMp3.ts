// FFmpeg is browser-only, so we dynamically import it only on the client
let ffmpegInstance: any = null;
let fetchFileFn: any = null;
let ffmpegLoading: Promise<{ ffmpegInstance: any; fetchFile: any }> | null = null;

async function getFFmpeg(): Promise<{ ffmpegInstance: any; fetchFile: any }> {
  // Only run on client side
  if (typeof window === 'undefined') {
    throw new Error('FFmpeg can only be used in the browser');
  }

  // Check for SharedArrayBuffer support (required for FFmpeg.wasm)
  if (typeof SharedArrayBuffer === 'undefined') {
    const errorMsg = 'SharedArrayBuffer is not available. This is required for audio conversion. ' +
      'Please ensure you are accessing the site with the proper security headers. ' +
      'If you are the site owner, verify that Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers are set correctly.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // If both are already loaded, return them immediately
  if (ffmpegInstance && fetchFileFn) {
    return { ffmpegInstance, fetchFile: fetchFileFn };
  }

  // If loading is in progress, wait for it
  if (ffmpegLoading) {
    return ffmpegLoading;
  }

  // Start loading FFmpeg
  ffmpegLoading = (async () => {
    try {
      const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
      
      ffmpegInstance = createFFmpeg({
        log: true,
        corePath: `${window.location.origin}/ffmpeg/ffmpeg-core.js`,
      });
      
      fetchFileFn = fetchFile;

      return { ffmpegInstance, fetchFile };
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error(`Failed to load FFmpeg: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();

  return ffmpegLoading;
}

export async function convertToMp3(file: File): Promise<File> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Invalid audio file type');
  }

  if (file.size > 100 * 1024 * 1024) {
    throw new Error('File too large (max 100MB)');
  }

  try {
    const { ffmpegInstance, fetchFile } = await getFFmpeg();
    const ffmpeg = ffmpegInstance;

    if (!ffmpeg.isLoaded()) {
      console.log('Loading FFmpeg...');
      await ffmpeg.load();
      console.log('FFmpeg loaded');
    }

    const inputName = file.name;
    const outputName = inputName.replace(/\.[^/.]+$/, '.mp3');

    // Clean up previous files
    try { ffmpeg.FS('unlink', inputName); } catch {}
    try { ffmpeg.FS('unlink', outputName); } catch {}

    console.log(`Writing ${inputName} to FFmpeg`);
    ffmpeg.FS('writeFile', inputName, await fetchFile(file));

    console.log(`Converting ${inputName} to MP3`);
    await ffmpeg.run(
      '-i', inputName,
      '-af', 'atrim=start=0',
      '-ac', '2',
      '-ar', '44100',
      '-c:a', 'libmp3lame',
      '-b:a', '320k',
      outputName
    );

    const files = ffmpeg.FS('readdir', '/');
    console.log('FFmpeg FS contents:', files);

    if (!files.includes(outputName)) {
      throw new Error(`FFmpeg did not produce output: ${outputName}`);
    }

    const data = ffmpeg.FS('readFile', outputName);

    // Cleanup
    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', outputName);

    console.log(`MP3 conversion complete: ${outputName}`);
    return new File([data as any], outputName, { type: 'audio/mpeg' });

  } catch (err) {
    console.error('MP3 conversion failed:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    // Provide user-friendly error message
    if (errorMessage.includes('SharedArrayBuffer')) {
      const friendlyMsg = 'Audio conversion is not available. This feature requires special browser security settings. ' +
        'Please try refreshing the page. If the issue persists, the site may need to be configured with proper security headers.';
      alert(friendlyMsg);
      throw new Error(friendlyMsg);
    }
    
    alert(`MP3 conversion failed: ${errorMessage}`);
    throw err;
  }
}

export async function convertAllToMp3(files: File[]): Promise<File[]> {
  const converted: File[] = [];

  for (const file of files) {
    console.log(`Starting MP3 conversion for: ${file.name}`);
    const mp3 = await convertToMp3(file);
    converted.push(mp3);
  }

  console.log('All stems converted to MP3');
  return converted;
}