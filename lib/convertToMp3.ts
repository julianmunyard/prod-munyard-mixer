import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'

const ffmpeg = createFFmpeg({
  log: true,
  corePath: `${location.origin}/ffmpeg/ffmpeg-core.js`, // ✅ fixed
});

export async function convertToMp3(file: File): Promise<File> {
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
    const outputName = inputName.replace(/\.[^/.]+$/, '.mp3');

    // Safety: Remove old files if still in FS
    try { ffmpeg.FS('unlink', inputName); } catch {}
    try { ffmpeg.FS('unlink', outputName); } catch {}

    console.log(`📥 Writing ${inputName} to FFmpeg`);
    ffmpeg.FS('writeFile', inputName, await fetchFile(file));

    console.log(`🎛️ Converting ${inputName} to MP3`);
    await ffmpeg.run(
      '-i', inputName,
      '-ac', '2',             // 🔊 stereo
      '-ar', '44100',         // 🎚️ standard sample rate
      '-b:a', '192k',         // 🎧 bitrate (customizable)
      '-c:a', 'libmp3lame',   // 🧠 encoder
      outputName
    );

    const files = ffmpeg.FS('readdir', '/');
    console.log('📂 FFmpeg FS contents:', files);

    if (!files.includes(outputName)) {
      throw new Error(`FFmpeg did not produce output: ${outputName}`);
    }

    const data = ffmpeg.FS('readFile', outputName);

    // Clean up
    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', outputName);

    console.log(`✅ MP3 conversion complete: ${outputName}`);
    return new File([data], outputName, { type: 'audio/mp3' });

  } catch (err) {
    console.error('❌ MP3 conversion failed:', err);
    alert(`MP3 conversion failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

export async function convertAllToMp3(files: File[]): Promise<File[]> {
  const converted: File[] = [];

  for (const file of files) {
    console.log(`🎧 Starting MP3 conversion for: ${file.name}`);
    const mp3 = await convertToMp3(file);
    converted.push(mp3);
  }

  console.log('✅ All stems converted to MP3');
  return converted;
}
