import React, { useRef, useEffect } from 'react'

type WaveformScrubberProps = {
  buffer: AudioBuffer | undefined
  scrubPosition: number
  duration: number
  primary: string
  onScrub: (pos: number) => void
  width?: number // allow width to be passed in!
}

export default function WaveformScrubber({
  buffer,
  scrubPosition,
  duration,
  primary,
  onScrub,
  width = 348 // default: 348px wide (three 100px buttons + two 24px gaps)
}: WaveformScrubberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Colors
  const faded = hexToRgba(primary, 0.20) // light "track" color
  const solid = primary                 // solid played color

  // Draw waveform
  useEffect(() => {
    if (!buffer || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const data = buffer.getChannelData(0)
    const step = Math.floor(data.length / canvas.width) || 1

    // Draw: full waveform (faded color)
    ctx.strokeStyle = faded
    ctx.beginPath()
    for (let i = 0; i < canvas.width; i++) {
      const min = Math.min(...data.slice(i * step, (i + 1) * step))
      const max = Math.max(...data.slice(i * step, (i + 1) * step))
      const y1 = ((1 - min) / 2) * canvas.height
      const y2 = ((1 - max) / 2) * canvas.height
      ctx.moveTo(i, y1)
      ctx.lineTo(i, y2)
    }
    ctx.stroke()

    // Draw: "played" section up to playhead (solid color)
    ctx.strokeStyle = solid
    ctx.beginPath()
    const playedPixels = Math.floor((scrubPosition / duration) * canvas.width)
    for (let i = 0; i < playedPixels; i++) {
      const min = Math.min(...data.slice(i * step, (i + 1) * step))
      const max = Math.max(...data.slice(i * step, (i + 1) * step))
      const y1 = ((1 - min) / 2) * canvas.height
      const y2 = ((1 - max) / 2) * canvas.height
      ctx.moveTo(i, y1)
      ctx.lineTo(i, y2)
    }
    ctx.stroke()
  }, [buffer, scrubPosition, duration, primary, width])

  // Click/drag to scrub
  const handleSeek = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x =
      'touches' in e
        ? e.touches[0].clientX - rect.left
        : (e as React.MouseEvent).clientX - rect.left
    const pos = (x / canvasRef.current.width) * duration
    onScrub(Math.max(0, Math.min(duration, pos)))
  }

  return (
<div
  style={{
    width,
    margin: '0 auto 8px auto',   // <--- RIGHT HERE!
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 20,
  }}>
      <span className="font-mono text-xs" style={{ color: primary, minWidth: 34, textAlign: 'right' }}>
        {formatTime(scrubPosition)}
      </span>
      <canvas
        ref={canvasRef}
        width={width - 68}  // Make canvas fit between the two time labels
        height={30}
        style={{
          flex: 1,
          background: 'transparent',
          borderRadius: 6,
          cursor: 'pointer'
        }}
        onClick={handleSeek}
        onTouchStart={handleSeek}
        onTouchMove={e => { if (e.touches.length) handleSeek(e) }}
      />
      <span className="font-mono text-xs" style={{ color: primary, minWidth: 34, textAlign: 'left' }}>
        {formatTime(duration)}
      </span>
    </div>
  )
}

function formatTime(secs: number) {
  if (!secs || isNaN(secs)) return "0:00"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

// Util: hexToRgba
function hexToRgba(hex: string, alpha = 1) {
  hex = hex.replace('#', '')
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r},${g},${b},${alpha})`
}
