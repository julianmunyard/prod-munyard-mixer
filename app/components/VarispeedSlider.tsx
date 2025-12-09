'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */
import { ChangeEvent, useRef } from 'react'

type Props = {
  value: number
  onChange: (val: number) => void
  isIOS: boolean
  primaryColor?: string
  bpm?: number | null
  horizontal?: boolean
  stemCount?: number
  varispeedMode?: 'timeStretch' | 'natural'
  onVarispeedModeChange?: (mode: 'timeStretch' | 'natural') => void
  pageTheme?: 'CLASSIC' | 'TERMINAL THEME' | 'OLD COMPUTER'
}

export default function VarispeedSlider({
  value,
  onChange,
  isIOS,
  bpm,
  primaryColor = '#B8001F',
  horizontal = false,
  stemCount = 0,
  varispeedMode = 'timeStretch',
  onVarispeedModeChange,
  pageTheme = 'CLASSIC',
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
  
  const isSafariDesktop = isSafari && 
    typeof window !== 'undefined' &&
    !/iP(hone|od|ad)/.test(window.navigator.userAgent)

const isMobilePortrait = typeof window !== 'undefined' &&
  window.innerWidth < 768 &&
  window.innerHeight > window.innerWidth

const shouldFlipLabels = isMobilePortrait && (stemCount ?? 0) >= 3
const shouldFlipDesktop = !isMobilePortrait // Flip labels on desktop

const tickLabels = shouldFlipLabels
  ? ['-12', '-9', '-7', '-5', '-2', '0', '+2', '+4', '+5', '+7', '+9']
  : shouldFlipDesktop
  ? ['-12', '-9', '-7', '-5', '-2', '0', '+2', '+4', '+5', '+7', '+9']
  : ['+9', '+7', '+5', '+4', '+2', '0', '-2', '-5', '-7', '-9', '-12']


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

  const sliderColor = pageTheme === 'OLD COMPUTER' ? '#000000' : primaryColor
  const sliderBg = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : 'transparent'
  const sliderBorder = pageTheme === 'OLD COMPUTER' ? '2px solid #000000' : `1px solid ${primaryColor}`
  const thumbColor = pageTheme === 'OLD COMPUTER' ? '#000000' : primaryColor

  return (
    <div
      className="relative flex flex-col items-center rounded-md"
      style={{
        height: '350px',
        width: '36px',
        paddingTop: '8px',
        paddingBottom: '8px',
        border: sliderBorder,
        backgroundColor: sliderBg,
        borderRadius: pageTheme === 'OLD COMPUTER' ? '0' : '4px',
        boxShadow: pageTheme === 'OLD COMPUTER' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
        '--varispeed-primary-color': thumbColor,
      } as React.CSSProperties & { '--varispeed-primary-color': string }}
    >
      {/* Ticks */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[8px] bottom-[8px] z-[5] flex flex-col justify-between pointer-events-none w-full">
        {tickLabels.map((_, i) => (
          <div key={i} className="w-[20px] h-[2px] mx-auto" style={{ backgroundColor: sliderColor }} />
        ))}
      </div>

      {/* Labels */}
      <div className="absolute -left-8 top-[8px] bottom-[8px] z-[5] flex flex-col justify-between pointer-events-none">
        {tickLabels.map((label, i) => (
          <span key={i} className="text-[10px] font-mono text-right w-6" style={{ 
            color: sliderColor,
            fontFamily: pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit',
            fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal'
          }}>
            {label}
          </span>
        ))}
      </div>

      {/* Live BPM Display */}
      {bpm != null && (
        <div className="absolute -top-10 flex flex-col items-center">
          <span className="text-[13px] font-mono" style={{ 
            color: sliderColor,
            fontFamily: pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit',
            fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal'
          }}>
            {Math.round(bpm * (isIOS ? value : 2 - value))} BPM
          </span>
          <span className="text-[12px] font-mono tracking-wider mt-1" style={{ 
            color: sliderColor,
            fontFamily: pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit',
            fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal'
          }}>
            VARISPEED
          </span>
          {/* Mode Toggle Button */}
          {onVarispeedModeChange && (
            <button
              onClick={() => {
                const newMode = varispeedMode === 'timeStretch' ? 'natural' : 'timeStretch';
                onVarispeedModeChange(newMode);
              }}
              className="mt-2 px-2 py-1 text-[10px] font-mono rounded border"
              style={{ 
                color: pageTheme === 'OLD COMPUTER' ? '#000000' : primaryColor,
                borderColor: pageTheme === 'OLD COMPUTER' ? '#000000' : primaryColor,
                borderWidth: pageTheme === 'OLD COMPUTER' ? '2px' : '1px',
                backgroundColor: pageTheme === 'OLD COMPUTER' 
                  ? '#D4C5B9'
                  : (varispeedMode === 'natural' ? primaryColor + '20' : 'transparent'),
                borderRadius: pageTheme === 'OLD COMPUTER' ? '0' : '4px',
                fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal',
                boxShadow: pageTheme === 'OLD COMPUTER' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                fontFamily: pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit'
              }}
              title={`Switch to ${varispeedMode === 'timeStretch' ? 'Natural' : 'Time-stretch'} mode`}
            >
              {varispeedMode === 'timeStretch' ? 'STRETCH' : 'NATURAL'}
            </button>
          )}
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
          // Safari desktop needs rotation like Chrome, but iOS Safari doesn't
          // isIOS prop handles iOS detection, isSafariDesktop handles Safari desktop
          transform: isSafariDesktop ? 'rotate(180deg)' : (isIOS ? 'none' : 'rotate(180deg)'),
          backgroundColor: 'transparent',
        }}
      />

      {/* Styles - Using template literal to inject primaryColor with CSS variable fallback */}
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
          height: 35px !important;
          width: 18px !important;
          border-radius: ${pageTheme === 'OLD COMPUTER' ? '0' : '10px'} !important;
          background: var(--varispeed-primary-color, ${thumbColor}) !important;
          border: ${pageTheme === 'OLD COMPUTER' ? '2px solid #000000' : 'none'} !important;
          position: relative;
          top: 0;
          transform: translateY(1px);
          z-index: 10;
          box-shadow: ${pageTheme === 'OLD COMPUTER' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'} !important;
        }
  
        .varispeed-slider::-moz-range-track {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          height: 6px;
        }

        .varispeed-slider::-moz-range-thumb {
          height: 45px !important;
          width: 18px !important;
          border-radius: ${pageTheme === 'OLD COMPUTER' ? '0' : '10px'} !important;
          background: var(--varispeed-primary-color, ${thumbColor}) !important;
          border: ${pageTheme === 'OLD COMPUTER' ? '2px solid #000000' : 'none'} !important;
          box-shadow: ${pageTheme === 'OLD COMPUTER' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'} !important;
        }

        .varispeed-slider::-ms-track {
          background: transparent !important;
          border-color: transparent !important;
          color: transparent !important;
          height: 6px;
        }

        .varispeed-slider::-ms-thumb {
          height: 45px !important;
          width: 18px !important;
          border-radius: ${pageTheme === 'OLD COMPUTER' ? '0' : '10px'} !important;
          background: var(--varispeed-primary-color, ${thumbColor}) !important;
          border: ${pageTheme === 'OLD COMPUTER' ? '2px solid #000000' : 'none'} !important;
          box-shadow: ${pageTheme === 'OLD COMPUTER' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'} !important;
        }

        .varispeed-slider::-ms-fill-lower,
        .varispeed-slider::-ms-fill-upper {
          background: transparent !important;
        }
      `}</style>
    </div>
  )
}
