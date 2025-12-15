'use client'

import DelayKnob from './DelayKnob'
import VarispeedSlider from './VarispeedSlider'
import type { Stem } from '@/app/artist/[artist]/[songSlug]/page'

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isInstagram = ua.includes('Instagram');

type TransparentMixerLayoutProps = {
  stems: Stem[]
  volumes: Record<string, number>
  delays: Record<string, number>
  solos: Record<string, boolean>
  mutes: Record<string, boolean>
  bpm?: number
  varispeed: number
  isIOS: boolean
  setVolumes: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setDelays: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setMutes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setSolos: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setVarispeed: React.Dispatch<React.SetStateAction<number>>
  delaysRef: React.MutableRefObject<Record<string, number>>
  backgroundVideo?: string
  primaryColor: string
  varispeedMode?: 'timeStretch' | 'natural'
  onVarispeedModeChange?: (mode: 'timeStretch' | 'natural') => void
}

export default function TransparentMixerLayout({
  stems,
  volumes,
  delays,
  solos,
  mutes,
  bpm,
  varispeed,
  isIOS,
  setVolumes,
  setDelays,
  setMutes,
  setSolos,
  setVarispeed,
  delaysRef,
  backgroundVideo,
  primaryColor,
  varispeedMode = 'timeStretch',
  onVarispeedModeChange,
}: TransparentMixerLayoutProps) {
  const isMobilePortrait = typeof window !== 'undefined' && window.innerWidth < 768 && window.innerHeight > window.innerWidth
  const isMobileLandscape = typeof window !== 'undefined' && window.innerWidth < 768 && window.innerWidth > window.innerHeight === false
  const isCompact = stems.length <= 2
  const isVerySmallScreen = typeof window !== 'undefined' && window.innerWidth < 400
  const isiPhoneSE = typeof window !== 'undefined' && window.innerWidth <= 375

  return (
    <>
      {/* CSS to style volume sliders - Override main page styles to use component's primaryColor prop */}
      <style>{`
        .transparent-volume-slider {
          -webkit-appearance: none !important; /* Override inline slider-vertical (match varispeed) */
          -moz-appearance: none !important;
          appearance: none !important;
          writing-mode: vertical-lr !important; /* Match varispeed exactly */
          height: 150px !important; /* Default height - inline styles will override */
          width: 20px !important; /* Wide enough to fit 18px thumb */
        }
        .transparent-volume-slider::-webkit-slider-runnable-track {
          -webkit-appearance: none !important;
          background: transparent !important;
          border: 1px solid ${primaryColor} !important;
          border-radius: 2px !important;
          height: 100% !important;
          width: 20px !important; /* Wide enough to fit 18px thumb */
        }
        .transparent-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          appearance: none !important;
          height: 35px !important; /* Slightly longer */
          width: 18px !important;
          border-radius: 10px !important;
          background: ${primaryColor} !important;
          border: none !important;
          cursor: pointer !important;
          box-shadow: none !important;
          /* Remove position/transform to allow natural movement */
        }
        .transparent-volume-slider::-moz-range-track {
          background: transparent !important;
          border: 1px solid ${primaryColor} !important;
          border-radius: 2px !important;
          height: 100% !important;
          width: 20px !important; /* Wide enough to fit 18px thumb */
        }
        .transparent-volume-slider::-moz-range-thumb {
          height: 45px !important; /* Slightly longer */
          width: 18px !important;
          border-radius: 10px !important;
          background: ${primaryColor} !important;
          border: none !important;
          cursor: pointer !important;
          box-shadow: none !important;
        }
        .transparent-volume-slider::-ms-track {
          background: transparent !important;
          border: 1px solid ${primaryColor} !important;
          border-radius: 2px !important;
          height: 100% !important;
          width: 20px !important; /* Wide enough to fit 18px thumb */
          color: transparent !important;
        }
        .transparent-volume-slider::-ms-thumb {
          height: 45px !important; /* Slightly longer */
          width: 18px !important;
          border-radius: 10px !important;
          background: ${primaryColor} !important;
          border: none !important;
          cursor: pointer !important;
          box-shadow: none !important;
        }
        .transparent-volume-slider::-ms-fill-lower,
        .transparent-volume-slider::-ms-fill-upper {
          background: transparent !important;
        }
      `}</style>
    <div className="w-full flex flex-col items-center">
      <div className="flex overflow-x-auto w-full justify-start px-2 sm:overflow-visible">
        <div className={`flex ${isVerySmallScreen ? 'gap-2' : stems.length >= 6 ? 'gap-4' : 'gap-8'}`} style={{ minWidth: stems.length <= 4 ? '100%' : 'max-content', justifyContent: stems.length <= 4 ? 'center' : 'flex-start', margin: '0 auto' }}>
          {stems.map(({ label }) => (
<div
  key={label}
  className="mixer-module"
  style={{
    width: isiPhoneSE ? '70px' : isVerySmallScreen ? '75px' : stems.length >= 6 ? '86px' : '96px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(2px)',
    border: `1px solid ${primaryColor}`,
    boxShadow: '0 0 6px rgba(255,255,255,0.2)',
    borderRadius: '10px',
    padding: isVerySmallScreen ? '8px' : '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: isMobile ? 'auto' : undefined,
    /* Match main mixer’s more compact mobile module size */
    minHeight: isMobile ? '340px' : undefined,
    maxHeight: isMobile ? 'none' : undefined,
    justifyContent: 'flex-start',
  }}
>


  {/* Level Slider */}
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontSize: '10px',
      color: primaryColor, // Always primary color for transparent theme
      flexGrow: 1,
      justifyContent: 'center',
      marginBottom: isMobile ? '20px' : '30px', // <<<< matches main
      paddingTop: isMobile ? '43px' : '43px', // Add space above for LEVEL and extended slider
      overflow: 'visible', // Allow slider to extend upward
      position: 'relative', // For absolute positioning of LEVEL
    }}
  >
    <span style={{ 
      position: 'absolute',
      top: '-25px', // Position just above slider
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100, // Very high z-index to ensure above slider
    }}>LEVEL</span>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
      <input
        type="range"
        min="0"
        max="1.4"
        step="0.01"
        value={1.4 - (volumes[label] ?? 1)} // Invert: top = 140%, 100% sits lower, bottom = 0%
        onChange={(e) => {
          setVolumes((prev) => ({ ...prev, [label]: 1.4 - parseFloat(e.target.value) })) // Invert back: 0-1.4 range
        }}
        className="transparent-volume-slider"
        style={{
          writingMode: 'vertical-lr' as any, // Match varispeed exactly
          WebkitAppearance: 'slider-vertical' as any, // Match varispeed - inline sets this
          appearance: 'slider-vertical',
          MozAppearance: 'none',
          width: '20px', // Wide enough to fit 18px thumb
          height: isMobile ? '188px' : '188px', // Extended by 25% (150px * 1.25)
          background: 'transparent',
          cursor: 'pointer',
          marginTop: isMobile ? '-38px' : '-38px', // Pull slider up into space above
          zIndex: 1, // Lower than LEVEL
        }}
      />
    </div>
              </div>
              <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <DelayKnob
                  value={delays[label]}
                  onChange={(val) => {
                    setDelays((prev) => ({ ...prev, [label]: val }))
                    delaysRef.current[label] = val
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    setMutes(prev => ({ ...prev, [label]: !prev[label] }))
                    setSolos(prev => ({ ...prev, [label]: false }))
                  }}
                  style={{
                    fontSize: isVerySmallScreen ? '10px' : '12px',
                    padding: isVerySmallScreen ? '2px 6px' : '4px 10px',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    backgroundColor: mutes[label] ? '#FFB3B3' : '#FCFAEE',
                    color: mutes[label] ? 'black' : primaryColor,
                    border: `1px solid ${primaryColor}`,
                    cursor: 'pointer',
                    minWidth: isVerySmallScreen ? '45px' : 'auto',
                  }}
                >
                  MUTE
                </button>

                <button
                  onClick={() => {
                    setSolos(prev => ({ ...prev, [label]: !prev[label] }))
                    setMutes(prev => ({ ...prev, [label]: false }))
                  }}
                  style={{
                    fontSize: isVerySmallScreen ? '10px' : '12px',
                    padding: isVerySmallScreen ? '2px 6px' : '4px 10px',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    backgroundColor: solos[label] ? '#FFD700' : '#FCFAEE',
                    color: solos[label] ? 'black' : primaryColor,
                    border: `1px solid ${primaryColor}`,
                    cursor: 'pointer',
                    minWidth: isVerySmallScreen ? '45px' : 'auto',
                  }}
                  className={solos[label] ? 'flash' : ''}
                >
                  SOLO
                </button>

                <div style={{
                  fontSize: isVerySmallScreen ? '9px' : '12px',
                  padding: isVerySmallScreen ? '2px 4px' : '4px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#FCFAEE',
                  color: primaryColor,
                  marginTop: '6px',
                  display: 'block',
                  width: '100%',
                  maxWidth: '100%',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordBreak: 'normal',
                  lineHeight: '1.2',
                  boxSizing: 'border-box',
                  border: `1px solid ${primaryColor}`,
                }}>
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
{/* Varispeed Slider Logic */}
{/* Desktop & landscape or ≤2 stems */}
{(!isMobilePortrait || stems.length <= 2) && (
  <div className="absolute right-4 top-[260px] flex flex-col items-center">
    {bpm !== undefined && (
      <div className="mb-1 text-xs font-mono" style={{ color: primaryColor }}>
        {Math.round(bpm! * varispeed)}
      </div>
    )}
    <div className="mb-3 text-sm tracking-wider" style={{ color: primaryColor }}>
      VARISPEED
    </div>
    <VarispeedSlider
      value={varispeed}
      onChange={setVarispeed}
      isIOS={isIOS}
      primaryColor={primaryColor}
      bpm={bpm}
      varispeedMode={varispeedMode}
      onVarispeedModeChange={onVarispeedModeChange}
    />
  </div>
)}

{/* Mobile Portrait with ≥3 stems */}
{isMobilePortrait && stems.length >= 3 && (
  <div className="sm:hidden w-full flex justify-center">
    <div className="relative" style={{ marginTop: '12px', width: '350px', height: '140px' }}>
      {/* Labels */}
      <div className="absolute top-0 left-0 w-full flex flex-col items-center" style={{ pointerEvents: 'none' }}>
        <div className="text-xs font-mono" style={{ color: primaryColor }}>
          {Math.round(bpm! * varispeed)}
        </div>
        <div className="text-sm tracking-wider" style={{ color: primaryColor }}>
          VARISPEED
        </div>
      </div>
      {/* Slider */}
      <div className="absolute left-1/2" style={{ transform: 'translateX(-50%) rotate(-90deg)', top: '-118px' }}>
        <VarispeedSlider
          value={isIOS ? varispeed : 2 - varispeed}
          onChange={val => setVarispeed(isIOS ? val : 2 - val)}
          isIOS={isIOS}
          primaryColor={primaryColor}
          stemCount={stems.length}
          varispeedMode={varispeedMode}
          onVarispeedModeChange={onVarispeedModeChange}
        />
      </div>
    </div>
  </div>
)}

    </div>
    </>
  )
}
