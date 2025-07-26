import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'

const ffmpeg = createFFmpeg({
  log: true,
  corePath: '/ffmpeg/ffmpeg-core.js',
  // @ts-ignore - not in types but valid for browser path override
  wasmURL: '/ffmpeg/ffmpeg-core.wasm',
  // @ts-ignore - not in types but valid for browser path override
  workerURL: '/ffmpeg/ffmpeg-core.worker.js',
})

export async function convertToMp3(file: File): Promise<File> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Invalid audio file type')
  }

  if (file.size > 100 * 1024 * 1024) {
    throw new Error('File too large (max 100MB)')
  }

  try {
    if (!ffmpeg.isLoaded()) {
      console.log('🌀 Loading FFmpeg...')
      await ffmpeg.load()
    }

    const inputName = file.name
    const outputName = inputName.replace(/\.[^/.]+$/, '.mp3')

    ffmpeg.FS('writeFile', inputName, await fetchFile(file))

    await ffmpeg.run('-i', inputName, '-codec:a', 'libmp3lame', '-b:a', '192k', outputName)

const data = ffmpeg.FS('readFile', outputName)
return new File([new Uint8Array(data.buffer)], outputName, { type: 'audio/mpeg' })

  } catch (err) {
console.error('❌ MP3 conversion failed:', err)
alert(`MP3 conversion failed: ${err instanceof Error ? err.message : String(err)}`)
throw err

  }
}
