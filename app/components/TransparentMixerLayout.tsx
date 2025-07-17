'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import DelayKnob from './DelayKnob'
import VarispeedSlider from './VarispeedSlider'
import type { Stem } from '@/app/artist/[artist]/[songSlug]/page'

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
  delaysRef: React.MutableRefObject<Record<string, number>>
  backgroundVideo?: string
  primaryColor: string
}

export default function TransparentMixerLayout({
  stems,
  volumes,
  setVolumes,
  delays,
  setDelays,
  mutes,
  setMutes,
  solos,
  setSolos,
  bpm,
  varispeed,
  isIOS,
  delaysRef,
  backgroundVideo,
  primaryColor,
}: TransparentMixerLayoutProps) {
  return (
    <>
      {backgroundVideo && (
        <video
          src={backgroundVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100dvh', // ✅ this is the key fix
          objectFit: 'cover',
          zIndex: -1,
          pointerEvents: 'none',
          backgroundColor: 'black' // ✅ fallback for loading moment
          }}
        />
      )}



      <div className="flex justify-center">
        <div className={`flex ${stems.length >= 6 ? 'gap-4' : 'gap-8'}`}>
          {stems.map(({ label }) => (
            <div
              key={label}
              className="mixer-module"
              style={{
                width: stems.length >= 6 ? '86px' : '96px',
                minHeight: '440px',
                backgroundColor: 'transparent',
                border: `2px solid ${primaryColor}`,
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backdropFilter: 'blur(2px)',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '40px',
                  backgroundColor: '#15803d',
                  borderRadius: '2px',
                  animation: 'pulse 1s infinite',
                  marginBottom: '18px',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginBottom: '30px',
                  fontSize: '10px',
                  color: primaryColor,
                }}
              >
                <span style={{ marginBottom: '4px' }}>LEVEL</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volumes[label]}
                  onChange={(e) =>
                    setVolumes((prev) => ({
                      ...prev,
                      [label]: parseFloat(e.target.value),
                    }))
                  }
                  className="volume-slider"
                  style={{
                    writingMode: 'bt-lr' as any,
                    WebkitAppearance: 'slider-vertical',
                    width: '4px',
                    height: '150px',
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
                  color={primaryColor}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <button
                  onClick={() => {
                    setMutes((prev) => ({
                      ...prev,
                      [label]: !prev[label],
                    }))
                    setSolos((prev) => ({
                      ...prev,
                      [label]: false,
                    }))
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
                    setSolos((prev) => ({
                      ...prev,
                      [label]: !prev[label],
                    }))
                    setMutes((prev) => ({
                      ...prev,
                      [label]: false,
                    }))
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

                <div
                  style={{
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
                  }}
                >
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
<div
  className={`absolute right-4 flex flex-col items-center ${
    (primaryColor?.length ?? 0) > 0 ? 'top-[350px]' : 'top-[260px]'
  } sm:top-[260px]`}
>
  {bpm && (
    <div className="mb-1 text-xs font-mono" style={{ color: primaryColor }}>
      {Math.round(bpm * (isIOS ? 2 - varispeed : varispeed))} BPM
    </div>
  )}
  <span className="mb-3 text-sm tracking-wider" style={{ color: primaryColor }}>
    VARISPEED
  </span>
  <VarispeedSlider
    value={varispeed}
    onChange={() => {}}
    isIOS={isIOS}
    primaryColor={primaryColor}
  />
</div>
    </>
  )
}
