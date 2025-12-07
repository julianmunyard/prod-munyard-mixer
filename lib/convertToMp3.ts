// FFmpeg is browser-only, so we dynamically import it only on the client
let ffmpegInstance: any = null;
let ffmpegLoading: Promise<any> | null = null;

async function getFFmpeg() {
  // Only run on client side
  if (typeof window === 'undefined') {
    throw new Error('FFmpeg can only be used in the browser');
  }

  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  if (ffmpegLoading) {
    return ffmpegLoading;
  }

  ffmpegLoading = (async () => {
    const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
    
    ffmpegInstance = createFFmpeg({
      log: true,
      corePath: `${window.location.origin}/ffmpeg/ffmpeg-core.js`,
    });

    return { ffmpegInstance, fetchFile };
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
    alert(`MP3 conversion failed: ${err instanceof Error ? err.message : String(err)}`);
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