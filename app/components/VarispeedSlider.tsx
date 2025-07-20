'use client'

import { ChangeEvent, useRef } from 'react'

type Props = {
  value: number
  onChange: (val: number) => void
  isIOS: boolean
  primaryColor?: string
  bpm?: number | null
  horizontal?: boolean
}

export default function VarispeedSlider({
  value,
  onChange,
  isIOS,
  bpm,
  primaryColor = '#B8001F',
  horizontal = false,
}: Props) {
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
        navigator.vibrate(5)
      }
    }
  }

  const isSafari =
    typeof window !== 'undefined' &&
    /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent)

  const tickLabels = ['+9', '+7', '+5', '+4', '+2', '0', '-2', '-5', '-7', '-9', '-12']

  if (horizontal) {
    return (
      <div
        className="relative w-full max-w-xs flex flex-col justify-center"
        style={{ paddingInline: '8px', paddingBlock: '4px' }}
      >
        {/* Ticks */}
        <div className="absolute top-1/2 -translate-y-1/2 left-[8px] right-[8px] z-[5] flex justify-between pointer-events-none w-full">
          {tickLabels.map((_, i) => (
            <div key={i} className="h-[2px] w-[10px]" style={{ backgroundColor: primaryColor }} />
          ))}
        </div>

        {/* Labels */}
        <div className="absolute top-[24px] left-[8px] right-[8px] z-[5] flex justify-between text-[10px] font-mono pointer-events-none">
          {tickLabels.map((label, i) => (
            <span key={i} style={{ color: primaryColor }}>{label}</span>
          ))}
        </div>

        {/* Slider */}
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.01"
          value={value}
          onChange={handleChange}
          className="absolute top-1/2 -translate-y-1/2 left-[8px] right-[8px] appearance-none bg-transparent z-10"
          style={{ WebkitAppearance: 'none', width: 'calc(100% - 16px)' }}
        />
      </div>
    )
  }

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
      {/* Ticks */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[8px] bottom-[8px] z-[5] flex flex-col justify-between pointer-events-none w-full">
        {tickLabels.map((_, i) => (
          <div key={i} className="w-[20px] h-[2px] mx-auto" style={{ backgroundColor: primaryColor }} />
        ))}
      </div>

      {/* Labels */}
      <div className="absolute -left-8 top-[8px] bottom-[8px] z-[5] flex flex-col justify-between pointer-events-none">
        {tickLabels.map((label, i) => (
          <span key={i} className="text-[10px] font-mono text-right w-6" style={{ color: primaryColor }}>
            {label}
          </span>
        ))}
      </div>

      {/* Live BPM Display */}
      {bpm != null && (
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
        className="varispeed-slider w-[6px] absolute top-[8px] bottom-[8px] appearance-none bg-transparent z-10"
        style={{
          WebkitAppearance: 'slider-vertical',
          writingMode: 'vertical-lr',
          height: 'calc(100% - 16px)',
          transform: isSafari ? 'none' : 'rotate(180deg)',
          backgroundColor: 'transparent',
        }}
      />

      {/* Styles */}
      <style>{`
        .varispeed-slider {
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          position: relative;
          z-index: 10;
        }

        .varispeed-slider::-webkit-slider-runnable-track {
          -webkit-appearance: none !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          height: 6px;
        }

        .varispeed-slider::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          height: 40px;
          width: 18px;
          border-radius: 10px;
          background: #004d26;
          border: none;
          margin-top: -18px;
          position: relative;
          z-index: 10;
        }

        .varispeed-slider::-moz-range-track {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          height: 6px;
        }

        .varispeed-slider::-moz-range-thumb {
          height: 40px;
          width: 18px;
          border-radius: 10px;
          background: #004d26;
          border: none;
        }

        .varispeed-slider::-ms-track {
          background: transparent !important;
          border-color: transparent !important;
          color: transparent !important;
          height: 6px;
        }

        .varispeed-slider::-ms-thumb {
          height: 40px;
          width: 18px;
          border-radius: 10px;
          background: #004d26;
          border: none;
        }

        .varispeed-slider::-ms-fill-lower,
        .varispeed-slider::-ms-fill-upper {
          background: transparent !important;
        }
      `}</style>
    </div>
  )
}
