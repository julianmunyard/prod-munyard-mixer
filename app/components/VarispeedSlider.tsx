'use client'

import { ChangeEvent, useRef } from 'react'

type Props = {
  value: number
  onChange: (val: number) => void
  isIOS: boolean
  primaryColor?: string // ✅ ADD THIS
  bpm?: number | null
}

export default function VarispeedSlider({ value, onChange, isIOS, bpm, primaryColor = '#B8001F' }: Props) {
  const previousTick = useRef<number | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = parseFloat(e.target.value)
    onChange(raw)

    const rounded = Math.round(raw * 10)

    if (previousTick.current === null) {
      previousTick.current = rounded
      return
    }

    if (rounded !== previousTick.current) {
      previousTick.current = rounded

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        console.log('💥 VIBRATE fired')
        navigator.vibrate(5)
      } else {
        console.log('❌ Vibration not supported')
      }
    }
  }

  const isSafari = typeof window !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  return (
<div
  className="relative flex flex-col items-center rounded-md"
  style={{
    height: '350px',
    width: '36px',
    paddingTop: '8px',
    paddingBottom: '8px',
    border: `1px solid ${primaryColor}`,
  }}
>


      {/* Ticks (inside) */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[8px] bottom-[8px] z-[5] flex flex-col justify-between pointer-events-none w-full">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="w-[20px] h-[2px] opacity-100 mx-auto" style={{ backgroundColor: primaryColor }} />
        ))}
      </div>

      {/* Labels (outside left) */}
      <div className="absolute -left-8 top-[8px] bottom-[8px] z-[5] flex flex-col justify-between pointer-events-none">
        {['+9', '+7', '+5', '+4', '+2', '0', '-2', '-5', '-7', '-9', '-12'].map((label, i) => (
          <span
  key={i}
  className="text-[10px] font-mono text-right w-6"
  style={{ color: primaryColor }}
>

            {label}
          </span>
        ))}
      </div>

      {/* Live BPM Display */}
      {bpm && (
        <div className="absolute -top-10 flex flex-col items-center">
          <span className="text-[13px] font-mono" style={{ color: primaryColor }}>
            {Math.round(bpm * (isIOS ? 2 - value : value))} BPM
          </span>
          <span className="text-[12px] font-mono tracking-wider mt-1" style={{ color: primaryColor }}>
            VARISPEED
          </span>
        </div>
      )}

      {/* Slider */}
      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.01"
        value={value}
        onChange={handleChange}
        className="w-[6px] absolute top-[8px] bottom-[8px] appearance-none bg-transparent z-10"
        style={{
          WebkitAppearance: 'slider-vertical',
          writingMode: 'vertical-lr',
          height: 'calc(100% - 16px)',
          transform: isSafari ? 'none' : 'rotate(180deg)', // Flip visually for Chrome
        }}
      />
    </div>
  )
}
