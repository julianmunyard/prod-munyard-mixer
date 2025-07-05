'use client'

import { ChangeEvent, useRef } from 'react'

type Props = {
  value: number
  onChange: (val: number) => void
  isIOS: boolean
  bpm?: number | null
}


export default function VarispeedSlider({ value, onChange, isIOS, bpm }: Props) {
const previousTick = useRef<number | null>(null)

function handleChange(e: ChangeEvent<HTMLInputElement>) {
  const raw = parseFloat(e.target.value)
  const adjusted = isIOS ? 2 - raw : raw
  onChange(adjusted)

  const rounded = Math.round(adjusted * 10)

  if (previousTick.current === null) {
    previousTick.current = rounded
    return
  }

  if (rounded !== previousTick.current) {
    previousTick.current = rounded

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      console.log('💥 VIBRATE fired') // confirms it reached this point
      navigator.vibrate(5)
    } else {
      console.log('❌ Vibration not supported')
    }
  }
}
  const displayed = isIOS ? 2 - value : value
  const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  return (
    <div
      className="relative flex flex-col items-center border border-red-700 rounded-md"
      style={{ height: '350px', width: '36px', paddingTop: '8px', paddingBottom: '8px' }}
    >

{/* Semitone Labels OUTSIDE Left + Red Ticks INSIDE */}
<>
  {/* Red Ticks (inside box) */}
  <div className="absolute left-1/2 -translate-x-1/2 top-[8px] bottom-[8px] z-[5] flex flex-col justify-between pointer-events-none w-full">
    {Array.from({ length: 11 }).map((_, i) => (
      <div key={i} className="w-[20px] h-[2px] bg-[#B8001F] opacity-100 mx-auto" />
    ))}
  </div>

  {/* Labels (outside box, left side) */}
  <div className="absolute -left-8 top-[8px] bottom-[8px] z-[5] flex flex-col justify-between pointer-events-none">
    {[
      '+9', '+7', '+5', '+4', '+2',
      '0',
      '-2', '-5', '-7', '-9', '-12'
    ].map((label, i) => (
      <span
        key={i}
        className="text-[10px] font-mono text-[#B8001F] text-right w-6"
      >
        {label}
      </span>
    ))}
  </div>
</>

{/* Live BPM Display */}
{bpm && (
  <div className="absolute -top-10 flex flex-col items-center">
    <span className="text-[13px] font-mono text-[#B8001F]">
      {Math.round(bpm * value)} BPM
    </span>
    <span className="text-[12px] font-mono text-[#B8001F] tracking-wider mt-1">
      VARISPEED
    </span>
  </div>
)}



      {/* Original Slider Code Preserved */}
      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.01"
        value={displayed}
        onChange={handleChange}
        className="w-[6px] absolute top-[8px] bottom-[8px] appearance-none bg-transparent z-10"
        style={{
          WebkitAppearance: 'slider-vertical',
          writingMode: 'vertical-lr',
          height: 'calc(100% - 16px)',
          transform: isSafari ? 'none' : 'rotate(180deg)',
        }}
      />
    </div>
  )
}
