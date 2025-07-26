import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'

const ffmpeg = createFFmpeg({
  log: true,
  corePath: '/_next/static/ffmpeg/ffmpeg-core.js',
  // @ts-ignore
  wasmURL: '/_next/static/ffmpeg/ffmpeg-core.wasm',
  // @ts-ignore
  workerURL: '/_next/static/ffmpeg/ffmpeg-core.worker.js',
})

export async function convertToMp3(file: File): Promise<File> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Invalid audio file type')
  }

  if (file.size > 100 * 1024 * 1024) {
    throw new Error('File too large (max 100MB)')
  }

  try {
    // Load FFmpeg if not already loaded
    if (!ffmpeg.isLoaded()) {
      console.log('🌀 Loading FFmpeg...')
      await ffmpeg.load()
      console.log('✅ FFmpeg loaded')
    }

    const inputName = file.name
    const outputName = inputName.replace(/\.[^/.]+$/, '.mp3')

    // Write input file into FFmpeg FS
    console.log(`📥 Writing ${inputName} to FFmpeg`)
    ffmpeg.FS('writeFile', inputName, await fetchFile(file))

    // Run the conversion
    console.log(`🎛️ Converting ${inputName} to MP3`)
    await ffmpeg.run('-i', inputName, outputName)


    // Read the output file
    console.log(`📤 Reading output ${outputName} from FFmpeg`)
    
// Check what files are in FS after running ffmpeg
const files = ffmpeg.FS('readdir', '/')
console.log('📂 FFmpeg FS contents:', files)

if (!files.includes(outputName)) {
  throw new Error(`FFmpeg did not produce output: ${outputName}`)
}

const data = ffmpeg.FS('readFile', outputName)

    // Clean up input/output files from FS (optional but safe)
    ffmpeg.FS('unlink', inputName)
    ffmpeg.FS('unlink', outputName)

    // Wrap in a File object and return
    console.log(`✅ Conversion complete: ${outputName}`)
    return new File([new Uint8Array(data.buffer)], outputName, { type: 'audio/mpeg' })

  } catch (err) {
    console.error('❌ MP3 conversion failed:', err)
    alert(`MP3 conversion failed: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  }
}

export async function convertAllToMp3(files: File[]): Promise<File[]> {
  const converted: File[] = []

  for (const file of files) {
    console.log(`🎧 Starting conversion for: ${file.name}`)
    const mp3 = await convertToMp3(file)
    converted.push(mp3)
  }

  console.log('✅ All stems converted')
  return converted
}
