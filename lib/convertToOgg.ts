import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({
  log: true,
  corePath:
    typeof window !== 'undefined'
      ? `${window.location.origin}/ffmpeg/ffmpeg-core.js`
      : '/ffmpeg/ffmpeg-core.js',
});

export async function convertToOgg(file: File): Promise<File> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Invalid audio file type');
  }

  if (file.size > 100 * 1024 * 1024) {
    throw new Error('File too large (max 100MB)');
  }

  try {
    if (!ffmpeg.isLoaded()) {
      console.log('🌀 Loading FFmpeg...');
      await ffmpeg.load();
      console.log('✅ FFmpeg loaded');
    }

    const inputName = file.name;
    const outputName = inputName.replace(/\.[^/.]+$/, '.ogg');

    // Clean up previous files
    try { ffmpeg.FS('unlink', inputName); } catch {}
    try { ffmpeg.FS('unlink', outputName); } catch {}

    console.log(`📥 Writing ${inputName} to FFmpeg`);
    ffmpeg.FS('writeFile', inputName, await fetchFile(file));

    console.log(`🎛️ Converting ${inputName} to OGG`);
    await ffmpeg.run(
      '-i', inputName,
      '-af', 'atrim=start=0',
      '-ac', '2',
      '-ar', '44100',
      '-c:a', 'libvorbis',
      '-qscale:a', '5',
      outputName
    );

    const files = ffmpeg.FS('readdir', '/');
    console.log('📂 FFmpeg FS contents:', files);

    if (!files.includes(outputName)) {
      throw new Error(`FFmpeg did not produce output: ${outputName}`);
    }

    const data = ffmpeg.FS('readFile', outputName);

    // Cleanup
    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', outputName);

    console.log(`✅ OGG conversion complete: ${outputName}`);
    return new File([data], outputName, { type: 'audio/ogg' });

  } catch (err) {
    console.error('❌ OGG conversion failed:', err);
    alert(`OGG conversion failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

export async function convertAllToOgg(files: File[]): Promise<File[]> {
  const converted: File[] = [];

  for (const file of files) {
    console.log(`🎧 Starting OGG conversion for: ${file.name}`);
    const ogg = await convertToOgg(file);
    converted.push(ogg);
  }

  console.log('✅ All stems converted to OGG');
  return converted;
}
