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

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex overflow-x-auto w-full justify-start px-2 sm:overflow-visible">
        <div className={`flex ${stems.length >= 6 ? 'gap-4' : 'gap-8'}`} style={{ minWidth: stems.length <= 4 ? '100%' : 'max-content', justifyContent: stems.length <= 4 ? 'center' : 'flex-start', margin: '0 auto' }}>
          {stems.map(({ label }) => (
<div
  key={label}
  className="mixer-module"
  style={{
    width: stems.length >= 6 ? '86px' : '96px',
    backgroundColor: 'transparent',
    backdropFilter: 'blur(2px)',
    border: `1px solid ${primaryColor}`,
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: isMobile ? '450px' : undefined, // <<<< this matches main
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
      color: 'white',
      flexGrow: 1,
      justifyContent: 'center',
      marginBottom: isMobile ? '20px' : '30px', // <<<< matches main
    }}
  >
    <span style={{ marginBottom: '4px' }}>LEVEL</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={volumes[label]}
      onChange={(e) => {
        setVolumes((prev) => ({ ...prev, [label]: parseFloat(e.target.value) }))
      }}
      className="volume-slider"
      style={{
        writingMode: 'bt-lr' as any,
        WebkitAppearance: 'slider-vertical',
        width: '4px',
        height: isMobile ? '150px' : '150px', // <<<< matches main
        background: 'transparent',
      }}
                />
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
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    backgroundColor: mutes[label] ? '#FFD700' : '#FCFAEE',
                    color: mutes[label] ? 'black' : primaryColor,
                    border: `1px solid ${primaryColor}`,
                    cursor: 'pointer',
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
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    backgroundColor: solos[label] ? '#00FF99' : '#FCFAEE',
                    color: solos[label] ? 'black' : primaryColor,
                    border: `1px solid ${primaryColor}`,
                    cursor: 'pointer',
                  }}
                  className={solos[label] ? 'flash' : ''}
                >
                  SOLO
                </button>

                <div style={{
                  fontSize: '12px',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#FCFAEE',
                  color: primaryColor,
                  marginTop: '6px',
                  display: 'block',
                  width: '100%',
                  maxWidth: '100%',
                  textAlign: 'center',
                  whiteSpace: 'normal',
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
        {Math.round(bpm! * (isInstagram ? varispeed : isIOS ? 2 - varispeed : varispeed))}
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
          {Math.round(bpm! * (isInstagram ? varispeed : isIOS ? 2 - varispeed : varispeed))}
        </div>
        <div className="text-sm tracking-wider" style={{ color: primaryColor }}>
          VARISPEED
        </div>
      </div>
      {/* Slider */}
      <div className="absolute left-1/2" style={{ transform: 'translateX(-50%) rotate(-90deg)', top: '-118px' }}>
        <VarispeedSlider
          value={2 - varispeed}
          onChange={val => setVarispeed(2 - val)}
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
  )
}
