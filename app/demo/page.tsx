'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import EffectKnob from '../components/EffectKnob'

// Helper component for rendering screws
const Screw = ({ left, top }: { left: string; top: string }) => (
  <div style={{ position: 'absolute', left, top, width: '11.45px', height: '11.45px' }}>
    <div
      style={{
        position: 'absolute',
        left: '0%',
        right: '0%',
        top: '0%',
        bottom: '0%',
        background: 'conic-gradient(from 180deg at 50% 50%, #777777 0deg, #656768 99.79deg, #FEFFFF 162.74deg, #717372 234.38deg, #FFFFFF 360deg)',
        borderRadius: '50%',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '0%',
        right: '0%',
        top: '0%',
        bottom: '0%',
        background: 'conic-gradient(from 180deg at 50% 50%, #777777 0deg, #656768 99.79deg, #FEFFFF 162.74deg, #717372 234.38deg, #FFFFFF 360deg)',
        boxShadow: 'inset 2.96504px 3.95339px 3.95339px rgba(0, 0, 0, 0.95)',
        borderRadius: '50%',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '7.84%',
        right: '7.84%',
        top: '7.84%',
        bottom: '7.84%',
        background: 'conic-gradient(from 180deg at 50% 50%, #777777 0deg, #656768 99.79deg, #FEFFFF 162.74deg, #717372 234.38deg, #FFFFFF 360deg)',
        filter: 'blur(0.751791px)',
        borderRadius: '50%',
      }}
    />
  </div>
)

// Helper component for rendering fader
const Fader = ({ 
  faderLeft, 
  faderTop, 
  label, 
  labelLeft, 
  labelTop, 
  knobLeft, 
  knobTop,
  volume,
  onChange,
  stemLabel,
  disabled = false
}: { 
  faderLeft: string; 
  faderTop: string; 
  label?: string; 
  labelLeft?: string; 
  labelTop?: string; 
  knobLeft?: string; 
  knobTop?: string;
  volume?: number;
  onChange?: (volume: number) => void;
  stemLabel?: string;
  disabled?: boolean;
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragKnobTop, setDragKnobTop] = useState<number | null>(null)
  const dragOffsetRef = useRef(0)
  const faderRef = useRef<HTMLDivElement>(null)
  
  // Calculate knob position from volume (0-1 range)
  // Volume 1 = top (12px), Volume 0 = bottom (12px + 619px - 120.33px = 510.67px)
  const trackHeight = 619
  const knobHeight = 120.33
  const trackTop = 12
  const maxKnobTop = trackTop + trackHeight - knobHeight
  const minKnobTop = trackTop
  
  const currentVolume = volume !== undefined ? volume : 1
  const calculatedKnobTop = knobTop ? parseFloat(knobTop) : trackTop + (maxKnobTop - trackTop) * (1 - currentVolume)
  
  // Use drag position if dragging, otherwise use calculated position
  const displayKnobTop = isDragging && dragKnobTop !== null ? dragKnobTop : calculatedKnobTop
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || !onChange || !faderRef.current) return
    e.preventDefault()
    e.stopPropagation()
    
    const rect = faderRef.current.getBoundingClientRect()
    const trackStart = rect.top + trackTop
    const currentKnobTop = calculatedKnobTop
    const knobCenterY = trackStart + currentKnobTop + (knobHeight / 2)
    
    // Calculate offset from mouse to knob center
    dragOffsetRef.current = e.clientY - knobCenterY
    setDragKnobTop(currentKnobTop)
    setIsDragging(true)
  }, [disabled, onChange, calculatedKnobTop, trackTop, knobHeight])
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !faderRef.current || !onChange) return
    
    const rect = faderRef.current.getBoundingClientRect()
    const trackStart = rect.top + trackTop
    const mouseY = e.clientY
    
    // Calculate knob center position accounting for drag offset
    const knobCenterY = mouseY - dragOffsetRef.current
    const knobTopPosition = knobCenterY - (knobHeight / 2)
    
    // Clamp knob position to track bounds (relative to track start)
    const clampedKnobTop = Math.max(minKnobTop, Math.min(maxKnobTop, knobTopPosition - trackStart))
    
    // Update knob position immediately for smooth dragging
    setDragKnobTop(clampedKnobTop)
    
    // Calculate volume from knob position (0 = bottom, 1 = top)
    const newVolume = 1 - ((clampedKnobTop - minKnobTop) / (maxKnobTop - minKnobTop))
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    
    onChange(clampedVolume)
  }, [isDragging, onChange, trackTop, knobHeight, minKnobTop, maxKnobTop])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragOffsetRef.current = 0
    setDragKnobTop(null)
  }, [])
  
  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || !onChange || !faderRef.current) return
    e.preventDefault()
    e.stopPropagation()
    
    const touch = e.touches[0]
    const rect = faderRef.current.getBoundingClientRect()
    const trackStart = rect.top + trackTop
    const currentKnobTop = calculatedKnobTop
    const knobCenterY = trackStart + currentKnobTop + (knobHeight / 2)
    
    // Calculate offset from touch to knob center
    dragOffsetRef.current = touch.clientY - knobCenterY
    setDragKnobTop(currentKnobTop)
    setIsDragging(true)
  }, [disabled, onChange, calculatedKnobTop, trackTop, knobHeight])
  
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !faderRef.current || !onChange) return
    e.preventDefault()
    
    const touch = e.touches[0]
    const rect = faderRef.current.getBoundingClientRect()
    const trackStart = rect.top + trackTop
    const touchY = touch.clientY
    
    // Calculate knob center position accounting for drag offset
    const knobCenterY = touchY - dragOffsetRef.current
    const knobTopPosition = knobCenterY - (knobHeight / 2)
    
    // Clamp knob position to track bounds (relative to track start)
    const clampedKnobTop = Math.max(minKnobTop, Math.min(maxKnobTop, knobTopPosition - trackStart))
    
    // Update knob position immediately for smooth dragging
    setDragKnobTop(clampedKnobTop)
    
    // Calculate volume from knob position (0 = bottom, 1 = top)
    const newVolume = 1 - ((clampedKnobTop - minKnobTop) / (maxKnobTop - minKnobTop))
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    
    onChange(clampedVolume)
  }, [isDragging, onChange, trackTop, knobHeight, minKnobTop, maxKnobTop])
  
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    dragOffsetRef.current = 0
    setDragKnobTop(null)
  }, [])
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleTouchEnd)
      window.addEventListener('touchcancel', handleTouchEnd)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleTouchEnd)
        window.removeEventListener('touchcancel', handleTouchEnd)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])
  
  // Handle track area clicks/touches to jump fader to position
  const handleTrackInteraction = useCallback((clientY: number) => {
    if (disabled || !onChange || !faderRef.current) return
    
    const rect = faderRef.current.getBoundingClientRect()
    const trackStart = rect.top + trackTop
    const trackEnd = trackStart + trackHeight
    
    // Calculate position relative to track
    const relativeY = clientY - trackStart
    const clampedY = Math.max(0, Math.min(trackHeight, relativeY))
    
    // Calculate knob top position (accounting for knob height)
    const knobTopPosition = Math.max(minKnobTop, Math.min(maxKnobTop, clampedY - (knobHeight / 2) + trackTop))
    
    // Calculate volume from position (0 = bottom, 1 = top)
    const newVolume = 1 - ((knobTopPosition - minKnobTop) / (maxKnobTop - minKnobTop))
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    
    onChange(clampedVolume)
  }, [disabled, onChange, trackTop, trackHeight, knobHeight, minKnobTop, maxKnobTop])
  
  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || !onChange) return
    e.preventDefault()
    handleTrackInteraction(e.clientY)
  }, [disabled, onChange, handleTrackInteraction])
  
  const handleTrackTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || !onChange || e.touches.length === 0) return
    e.preventDefault()
    handleTrackInteraction(e.touches[0].clientY)
  }, [disabled, onChange, handleTrackInteraction])

  return (
  <div 
    ref={faderRef}
    style={{ 
      position: 'absolute', 
      width: '137.14px', 
      height: '698.99px', 
      left: faderLeft, 
      top: faderTop,
      cursor: disabled ? 'default' : 'pointer',
      userSelect: 'none',
      touchAction: 'none'
    }}
  >
    {/* Indent */}
    <div
      style={{
        position: 'absolute',
        width: '72.59px',
        height: '657.38px',
        left: '0px',
        top: '0px',
        background: 'linear-gradient(180deg, #BBBBBD 0%, #B1B1B3 100%)',
        border: '1px solid rgba(0, 0, 0, 0.32)',
        boxShadow: '3px 3px 2px rgba(255, 255, 255, 0.8), -1px -2px 2px 2px rgba(0, 0, 0, 0.55), inset 0px -8px 4px rgba(0, 0, 0, 0.8), inset -3px -3px 2px rgba(255, 255, 255, 0.85)',
        borderRadius: '64px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    />
    {/* Rectangle 59 - centered and behind cutout */}
    <div
      style={{
        position: 'absolute',
        width: '16px',
        height: '619px',
        left: '27.5px',
        top: '12px',
        background: '#0F0F11',
        boxShadow: 'inset 3px 0px 4px rgba(0, 0, 0, 0.9), inset -3px 0px 4px rgba(255, 255, 255, 0.1)',
        zIndex: 1,
      }}
    />
    {/* Cutout - Touchable track area */}
    <div
      style={{
        position: 'absolute',
        width: '41px',
        height: '619px',
        left: '15px',
        top: '12px',
        background: '#0F0F11',
        border: '1px solid rgba(255, 255, 255, 0.51)',
        boxShadow: 'inset 2px 2px 2px rgba(0, 0, 0, 0.65)',
        borderRadius: '32px',
        zIndex: 2,
        cursor: disabled ? 'default' : 'pointer',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
      onMouseDown={handleTrackMouseDown}
      onTouchStart={handleTrackTouchStart}
    />
    {/* Label - Hidden */}
    {false && label && (
      <div
        style={{
          position: 'absolute',
          width: label === 'PERC' ? '67px' : label === 'VOCALS' ? '107px' : label === 'SYNTHS' ? '98px' : label === 'DRUMS' ? '92px' : '65px',
          height: '84px',
          left: labelLeft || '0px',
          top: labelTop || '0px',
          fontFamily: "'Poppins', sans-serif",
          fontStyle: 'normal',
          fontWeight: 275,
          fontSize: '28px',
          lineHeight: '42px',
          color: '#EDEDED',
          transform: 'rotate(-90deg)',
          transformOrigin: 'center',
        }}
      >
        {label}
      </div>
    )}
    {/* Fader Knob */}
    {knobLeft && (knobTop !== undefined || volume !== undefined) && (
      <div 
        style={{ 
          position: 'absolute', 
          width: '137.14px', 
          height: '120.33px', 
          left: knobLeft, 
          top: `${displayKnobTop}px`, 
          zIndex: 10,
          cursor: disabled ? 'default' : 'grab',
          pointerEvents: disabled ? 'none' : 'auto',
          touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Shadows */}
        <div
          style={{
            position: 'absolute',
            width: '117.2px',
            height: '71.28px',
            left: '0px',
            top: '0px',
            background: '#000000',
            opacity: 0.08,
            filter: 'blur(36px)',
            transform: 'rotate(30deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '107.98px',
            height: '67.09px',
            left: '2.05px',
            top: '3.07px',
            background: '#000000',
            opacity: 0.1,
            filter: 'blur(32px)',
            transform: 'rotate(30deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '82.11px',
            height: '56.96px',
            left: '4.09px',
            top: '12.27px',
            background: '#000000',
            opacity: 0.6,
            filter: 'blur(28px)',
            transform: 'rotate(30deg)',
          }}
        />
        {/* Thin Button */}
        <div
          style={{
            position: 'absolute',
            width: '64.41px',
            height: '64.41px',
            left: '4.09px',
            top: '10.22px',
            background: 'linear-gradient(180deg, #BBBBBD 0%, #B1B1B3 100%)',
            boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.5), 4px 4px 8px rgba(0, 0, 0, 0.25), 8px 8px 16px rgba(0, 0, 0, 0.6)',
            borderRadius: '32px',
          }}
        />
        {/* Chamfer */}
        <div
          style={{
            position: 'absolute',
            width: '64.41px',
            height: '64.41px',
            left: '4.09px',
            top: '10.22px',
            background: 'conic-gradient(from 0deg at 50% 50%, #FEFDFF -14.51deg, #BABABA 13.51deg, #B5B5B7 90.41deg, #B5B5B7 236.97deg, #FFFFFF 264.79deg, #FEFDFF 345.49deg, #BABABA 373.51deg)',
            borderRadius: '32px',
          }}
        />
        {/* Top */}
        <div
          style={{
            position: 'absolute',
            width: '46.01px',
            height: '46.01px',
            left: '13.29px',
            top: '19.42px',
            background: 'linear-gradient(180deg, #BBBBBD 0%, #B1B1B3 100%)',
            boxShadow: '-1px -1px 2px rgba(255, 255, 255, 0.7), 2px 2px 2px rgba(0, 0, 0, 0.37), inset 0px 0px 2px rgba(255, 255, 255, 0.5)',
            borderRadius: '32px',
          }}
        />
      </div>
    )}
  </div>
  )
}

type Stem = {
  label: string
  file: string
}

export default function DemoPage({ 
  onPlay, 
  onPause,
  stems = [],
  volumes = {},
  setVolumes,
  setTrackVolume,
  songTitle
}: { 
  onPlay?: () => void
  onPause?: () => void
  stems?: Stem[]
  volumes?: Record<string, number>
  setVolumes?: (volumes: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void
  setTrackVolume?: (stemLabel: string, volume: number) => void
  songTitle?: string
} = {}) {
  const [scale, setScale] = useState(0.65)
  const [isMobile, setIsMobile] = useState(false)

  // Add marquee animation styles
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes scroll-marquee {
        0% {
          transform: translateX(328px);
        }
        100% {
          transform: translateX(-100%);
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  useEffect(() => {
    const calculateScale = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      const padding = mobile ? 40 : 80
      const width = window.innerWidth - padding
      const height = window.innerHeight - padding
      const scaleX = width / 1375
      const scaleY = height / 1419.53
      const newScale = Math.min(scaleX, scaleY, 0.75) // Max 75% scale
      setScale(newScale)
    }

    calculateScale()
    window.addEventListener('resize', calculateScale)
    return () => window.removeEventListener('resize', calculateScale)
  }, [])

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('🔵 Demo Play button clicked', { onPlay: !!onPlay, hasHandler: typeof onPlay === 'function' })
    if (onPlay && typeof onPlay === 'function') {
      try {
        onPlay()
        console.log('✅ Play handler called successfully')
      } catch (error) {
        console.error('❌ Error calling play handler:', error)
      }
    } else {
      console.warn('⚠️ No onPlay handler provided or not a function')
    }
  }

  const handlePause = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('🔴 Demo Pause button clicked', { onPause: !!onPause, hasHandler: typeof onPause === 'function' })
    if (onPause && typeof onPause === 'function') {
      try {
        onPause()
        console.log('✅ Pause handler called successfully')
      } catch (error) {
        console.error('❌ Error calling pause handler:', error)
      }
    } else {
      console.warn('⚠️ No onPause handler provided or not a function')
    }
  }

  // Mobile layout: two sections
  if (isMobile) {
    const activeStems = stems.filter(stem => stem && stem.label)
    
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: '#DBDBDB',
          padding: '10px',
          margin: '0',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          overflowY: 'auto',
          width: '100%',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <style>{`
          button:focus,
          button:focus-visible,
          div:focus,
          div:focus-visible {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
          }
        `}</style>
        
        {/* TOP SECTION: Turntable, Play/Pause, Song Title */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '20px 10px',
            minHeight: '50vh',
          }}
        >
          {/* Song Title */}
          <div
            style={{
              width: '90%',
              maxWidth: '350px',
              height: '60px',
              marginBottom: '20px',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '60px',
                left: '0',
                top: '0',
                background: 'linear-gradient(97.57deg, #7A7C81 0.85%, #0A0E0F 4.48%, #090D0E 6.85%, #070A0D 93.84%, #454647 98.54%)',
                borderRadius: '16px',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '60px',
                left: '0',
                top: '0',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                fontFamily: "'pixChicago', monospace",
                fontSize: '18px',
                color: '#D2D2D2',
                textTransform: 'uppercase',
                padding: '0 15px',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  animation: 'scroll-marquee 15s linear infinite',
                  paddingRight: '50px',
                }}
              >
                {(songTitle || 'song') + '        '}
              </div>
            </div>
          </div>

          {/* Turntable - Scaled down */}
          <div
            style={{
              width: '280px',
              height: '280px',
              position: 'relative',
              marginBottom: '20px',
            }}
          >
            {/* Outer Button */}
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(334.15deg, #A9A9A9 0%, #C6C6C6 108.87%)',
                boxShadow: 'inset -2px -2px 5px rgba(255, 255, 255, 0.8)',
                borderRadius: '50%',
              }}
            />
            {/* Radio Button Border */}
            <div
              style={{
                position: 'absolute',
                width: 'calc(100% - 8px)',
                height: 'calc(100% - 8px)',
                left: '4px',
                top: '4px',
                background: 'linear-gradient(334.15deg, #A9A9A9 0%, #C6C6C6 108.87%)',
                border: '3px solid #000000',
                boxShadow: 'inset -1px 1px 5px #FFFFFF',
                borderRadius: '50%',
                boxSizing: 'border-box',
              }}
            />
            {/* Inner Button */}
            <div
              style={{
                position: 'absolute',
                width: 'calc(100% - 16px)',
                height: 'calc(100% - 16px)',
                left: '8px',
                top: '12px',
                background: 'linear-gradient(329.55deg, #A9A9A9 -13.35%, #D2D2D2 53.56%)',
                boxShadow: '0px 0px 2px rgba(0, 0, 0, 0.55), inset 2px 1px 0px rgba(255, 255, 255, 0.8)',
                borderRadius: '50%',
              }}
            />
            {/* Center Knob */}
            <div
              style={{
                position: 'absolute',
                width: '65px',
                height: '65px',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  background: 'radial-gradient(11.79% 11.79% at 3.27% 33.83%, rgba(255, 255, 255, 0.2) 0%, rgba(205, 205, 205, 0) 100%), linear-gradient(145.32deg, #000000 8.15%, #000000 29.57%, #A4A4A4 50%)',
                  boxShadow: 'inset 0px -2px 4px rgba(0, 0, 0, 0.25), inset 0px 3px 4px rgba(255, 255, 255, 0.55)',
                  borderRadius: '50%',
                }}
              />
            </div>
          </div>

          {/* Play/Pause Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={handlePlay}
              style={{
                width: '50px',
                height: '50px',
                background: 'linear-gradient(168.6deg, #AAACAE 8.39%, #FCFFFF 94.99%)',
                boxShadow: 'inset 1px 1px 1px rgba(0, 0, 0, 0.65)',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  background: '#030A0E',
                  borderRadius: '50%',
                }}
              />
            </button>
            <button
              type="button"
              onClick={handlePause}
              style={{
                width: '50px',
                height: '50px',
                background: 'linear-gradient(168.6deg, #AAACAE 8.39%, #FCFFFF 94.99%)',
                boxShadow: 'inset 1px 1px 1px rgba(0, 0, 0, 0.65)',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  background: 'linear-gradient(137.46deg, #7B7B7B 12.15%, #9D9D9D 86.1%)',
                  boxShadow: 'inset 0px 1px 1px rgba(0, 0, 0, 0.1)',
                  borderRadius: '50%',
                }}
              />
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION: Faders and Effects */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 10px',
            gap: '30px',
          }}
        >
          {/* Faders - Vertical scrollable container */}
          {activeStems.length > 0 && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                overflowX: 'auto',
                overflowY: 'visible',
                padding: '10px',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '20px',
                  minWidth: 'fit-content',
                }}
              >
                {activeStems.map((stem) => {
                  const stemLabel = stem.label
                  const volume = volumes[stemLabel] ?? 1
                  const disabled = !setTrackVolume
                  
                  return (
                    <div
                      key={stemLabel}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontSize: '14px',
                          color: '#000000',
                          fontWeight: 275,
                          textAlign: 'center',
                        }}
                      >
                        {stemLabel}
                      </div>
                      <div style={{ position: 'relative', width: '110px', height: '560px', transform: 'scale(0.8)' }}>
                        <Fader
                          faderLeft="0px"
                          faderTop="0px"
                          label={stemLabel}
                          knobLeft="0px"
                          knobTop={undefined}
                          volume={disabled ? undefined : volume}
                          onChange={disabled ? undefined : (newVolume) => {
                            if (setVolumes) {
                              setVolumes((prev) => ({ ...prev, [stemLabel]: newVolume }))
                            }
                            if (setTrackVolume) {
                              setTrackVolume(stemLabel, newVolume)
                            }
                          }}
                          stemLabel={stemLabel}
                          disabled={disabled}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Effects - ECHO, REVERB, FLANGER */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              gap: '30px',
              flexWrap: 'wrap',
              padding: '20px 10px',
            }}
          >
            {/* ECHO */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '16px',
                  color: '#000000',
                  fontWeight: 275,
                  opacity: 0.6,
                }}
              >
                ECHO
              </div>
              <div style={{ position: 'relative', width: '147px', height: '148px', transform: 'scale(0.8)' }}>
                <EffectKnob left="0px" top="0px" id="echo" />
              </div>
            </div>

            {/* REVERB */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '16px',
                  color: '#000000',
                  fontWeight: 275,
                  opacity: 0.6,
                }}
              >
                REVERB
              </div>
              <div style={{ position: 'relative', width: '147px', height: '148px', transform: 'scale(0.8)' }}>
                <EffectKnob left="0px" top="0px" id="reverb" />
              </div>
            </div>

            {/* FLANGER */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '16px',
                  color: '#000000',
                  fontWeight: 275,
                  opacity: 0.6,
                }}
              >
                FLANGER
              </div>
              <div style={{ position: 'relative', width: '147px', height: '148px', transform: 'scale(0.8)' }}>
                <EffectKnob left="0px" top="0px" id="flanger" />
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Desktop layout (original)
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#DBDBDB',
        padding: '40px',
        margin: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <style>{`
        button:focus,
        button:focus-visible,
        div:focus,
        div:focus-visible {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>
      <div 
        style={{
          position: 'relative',
          width: '1375px',
          height: '1419.53px',
          backgroundColor: '#DBDBDB',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          margin: '0',
          flexShrink: 0,
        }}
      >
        {/* Tp-7 Container */}
        <div
          style={{
            position: 'absolute',
            width: '1372px',
            height: '1419.53px',
            left: '0px',
            top: '0px',
            overflow: 'visible',
          }}
        >
          {/* Card - Main Background */}
          <div
            style={{
              position: 'absolute',
              width: '1315px',
              height: '1216px',
              left: '57px',
              top: '65px',
              background: 'linear-gradient(334.35deg, #9A9A9A 0%, #A4A4A4 14.69%, #AEAEAE 40.8%, #D2D2D2 81.18%, #D8D8D8 100%)',
              boxShadow: 'inset 1px 1px 3px #FFFFFF, inset 4px 4px 0px rgba(255, 255, 255, 0.6), inset -3px -4px 0px rgba(0, 0, 0, 0.25)',
              borderRadius: '32px',
            }}
          />

          {/* MUNYARD Text */}
          <div
            style={{
              position: 'absolute',
              width: '209px',
              height: '11px',
              left: '80px',
              top: '76px',
              fontFamily: "'Poppins', sans-serif",
              fontStyle: 'normal',
              fontWeight: 275,
              fontSize: '44px',
              lineHeight: '66px',
              color: '#000000',
              mixBlendMode: 'multiply',
              opacity: 0.6,
            }}
          >
            MUNYARD
          </div>

          {/* Button Container - song slotted Display */}
          <div
            style={{
              position: 'absolute',
              width: '330.97px',
              height: '89.87px',
              left: '561px',
              top: '76px',
            }}
          >
            {/* Button Background */}
            <div
              style={{
                position: 'absolute',
                width: '328px',
                height: '87px',
                left: '1.97px',
                top: '0.35px',
                background: 'linear-gradient(97.57deg, #7A7C81 0.85%, #0A0E0F 4.48%, #090D0E 6.85%, #070A0D 93.84%, #454647 98.54%)',
                borderRadius: '16px',
              }}
            />
            {/* song slotted Text - Scrolling Marquee */}
            <div
              style={{
                position: 'absolute',
                width: '328px',
                height: '87px',
                left: '1.97px',
                top: '0.35px',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                fontFamily: "'pixChicago', monospace",
                fontSize: '24px',
                color: '#D2D2D2',
                textTransform: 'uppercase',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  animation: 'scroll-marquee 15s linear infinite',
                  paddingRight: '50px',
                }}
              >
                {(songTitle || 'song') + '        '}
              </div>
            </div>
          </div>

          {/* Large Switch/Radio Button - Turntable */}
          <div
            style={{
              position: 'absolute',
              width: '639.21px',
              height: '639.21px',
              left: '76px',
              top: '131px',
            }}
          >
            {/* Outer Button */}
            <div
              style={{
                position: 'absolute',
                width: '639.21px',
                height: '639.21px',
                left: '0px',
                top: '0px',
                background: 'linear-gradient(334.15deg, #A9A9A9 0%, #C6C6C6 108.87%)',
                boxShadow: 'inset -2px -2px 5px rgba(255, 255, 255, 0.8)',
                borderRadius: '50%',
              }}
            />
            {/* Radio Button Border */}
            <div
              style={{
                position: 'absolute',
                width: '631.33px',
                height: '631.33px',
                left: '3.94px',
                top: '3.94px',
                background: 'linear-gradient(334.15deg, #A9A9A9 0%, #C6C6C6 108.87%)',
                border: '3px solid #000000',
                boxShadow: 'inset -1px 1px 5.31426px 1.06285px #FFFFFF',
                borderRadius: '50%',
                boxSizing: 'border-box',
              }}
            />
            {/* Inner Button */}
            <div
              style={{
                position: 'absolute',
                width: '623.45px',
                height: '623.45px',
                left: '7.87px',
                top: '11.87px',
                background: 'linear-gradient(329.55deg, #A9A9A9 -13.35%, #D2D2D2 53.56%)',
                boxShadow: '0px 0px 2px rgba(0, 0, 0, 0.55), inset 2.1257px 1.2px 0px rgba(255, 255, 255, 0.8)',
                borderRadius: '50%',
              }}
            />
            
            {/* Horizontal Lines on each side facing each other */}
            {/* Left horizontal line */}
            <div
              style={{
                position: 'absolute',
                width: '150px',
                height: '1px',
                left: '90px',
                top: '319.595px',
                background: 'rgba(0, 0, 0, 0.25)',
              }}
            />
            {/* Right horizontal line */}
            <div
              style={{
                position: 'absolute',
                width: '150px',
                height: '1px',
                left: '399.21px',
                top: '319.595px',
                background: 'rgba(0, 0, 0, 0.25)',
              }}
            />
            
            {/* 96/24 Text - rotated counter-clockwise on left */}
            <div
              style={{
                position: 'absolute',
                width: '62px',
                height: '33px',
                left: '162.86px',
                top: '156.36px',
                fontFamily: "'Poppins', sans-serif",
                fontStyle: 'normal',
                fontWeight: 275,
                fontSize: '22.0995px',
                lineHeight: '33px',
                color: '#000000',
                mixBlendMode: 'multiply',
                opacity: 0.6,
                transform: 'rotate(-45deg)',
                transformOrigin: 'center',
              }}
            >
              96/24
            </div>
            
            {/* 3 Text - rotated clockwise on right */}
            <div
              style={{
                position: 'absolute',
                width: '30px',
                height: '33px',
                left: '460px',
                top: '400px',
                fontFamily: "'Poppins', sans-serif",
                fontStyle: 'normal',
                fontWeight: 275,
                fontSize: '22.0995px',
                lineHeight: '33px',
                color: '#000000',
                mixBlendMode: 'multiply',
                opacity: 0.6,
                transform: 'rotate(45deg)',
                transformOrigin: 'center',
              }}
            >
              3
            </div>
            {/* Large Knob/Switch in center */}
            <div
              style={{
                position: 'absolute',
                width: '163.08px',
                height: '163.08px',
                left: '245.66px',
                top: '238.2px',
              }}
            >
              {/* Switch Inner */}
              <div
                style={{
                  position: 'absolute',
                  width: '171.06px',
                  height: '171.06px',
                  left: '-3.72px',
                  top: '-1.94px',
                  background: 'radial-gradient(11.79% 11.79% at 3.27% 33.83%, rgba(255, 255, 255, 0.2) 0%, rgba(205, 205, 205, 0) 100%), linear-gradient(145.32deg, #000000 8.15%, #000000 29.57%, #A4A4A4 50%)',
                  boxShadow: 'inset 0px -1.9767px 3.95339px rgba(0, 0, 0, 0.25), inset 0px 2.96504px 3.95339px rgba(255, 255, 255, 0.55)',
                  borderRadius: '50%',
                }}
              />
              {/* Screws */}
              <Screw left="47.93px" top="26.83px" />
              <Screw left="53.65px" top="122.21px" />
              <Screw left="127.96px" top="70.01px" />
            </div>
          </div>

          {/* Left Slider/Fader - Using exact SVG */}
          <div
            style={{
              position: 'absolute',
              width: '53px',
              height: '521px',
              left: '0px',
              top: '190.62px',
              zIndex: 100,
            }}
            dangerouslySetInnerHTML={{
              __html: `<svg width="53" height="521" viewBox="0 0 53 521" fill="none" xmlns="http://www.w3.org/2000/svg">
<g filter="url(#filter0_ii_1_21)">
<path d="M15.2275 0C23.6374 3.29858e-05 30.4551 6.81766 30.4551 15.2275V220.495C30.4551 228.361 36.6684 234.703 42.7899 239.642C48.762 244.461 52.582 251.841 52.582 260.112C52.582 268.384 48.762 275.763 42.79 280.581C36.6684 285.521 30.4551 291.863 30.4551 299.729V504.997C30.4551 513.407 23.6374 520.225 15.2275 520.225C6.81764 520.225 0 513.407 0 504.997V15.2275C0 6.81764 6.81764 0 15.2275 0Z" fill="url(#paint0_linear_1_21)"/>
</g>
<g filter="url(#filter1_d_1_21)">
<path d="M15.3954 4.50623C22.1997 4.50623 27.7157 10.0222 27.7157 16.8265V237.856C27.7157 238.168 27.9663 238.422 28.2782 238.426C40.0533 238.723 49.5067 248.319 49.5067 260.113C49.5066 266.498 46.7352 272.24 42.3244 276.209C35.7563 282.121 27.7157 288.969 27.7157 297.806V505.588C27.7157 512.393 22.1997 517.909 15.3954 517.909C8.59107 517.909 3.07507 512.393 3.07507 505.588V16.8265C3.07507 10.0222 8.59107 4.50623 15.3954 4.50623Z" fill="url(#paint1_linear_1_21)"/>
</g>
<g filter="url(#filter2_ii_1_21)">
<circle cx="28.4807" cy="260.112" r="11" fill="url(#paint2_linear_1_21)"/>
</g>
<mask id="mask0_1_21" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="20" y="251" width="17" height="18">
<g clip-path="url(#paint3_angular_1_21_clip_path)" data-figma-skip-parse="true"><g transform="matrix(-6.6813e-10 0.00919079 -0.00919079 -6.6813e-10 28.4807 260.112)"><foreignObject x="-1035.62" y="-1035.62" width="2071.23" height="2071.23"><div xmlns="http://www.w3.org/1999/xhtml" style="background:conic-gradient(from 90deg,rgba(119, 119, 119, 1) 0deg,rgba(101, 103, 104, 1) 99.7866deg,rgba(253, 254, 255, 1) 162.736deg,rgba(113, 115, 114, 1) 234.375deg,rgba(255, 255, 255, 1) 360deg);height:100%;width:100%;opacity:1"></div></foreignObject></g></g><circle cx="28.4807" cy="260.112" r="8.23572" data-figma-gradient-fill="{&#34;type&#34;:&#34;GRADIENT_ANGULAR&#34;,&#34;stops&#34;:[{&#34;color&#34;:{&#34;r&#34;:0.46666666865348816,&#34;g&#34;:0.46666666865348816,&#34;b&#34;:0.46666666865348816,&#34;a&#34;:1.0},&#34;position&#34;:0.0},{&#34;color&#34;:{&#34;r&#34;:0.39607843756675720,&#34;g&#34;:0.40392157435417175,&#34;b&#34;:0.40784314274787903,&#34;a&#34;:1.0},&#34;position&#34;:0.27718502283096313},{&#34;color&#34;:{&#34;r&#34;:0.99583333730697632,&#34;g&#34;:0.9998697042465210,&#34;b&#34;:1.0,&#34;a&#34;:1.0},&#34;position&#34;:0.4520442783832550},{&#34;color&#34;:{&#34;r&#34;:0.44313725829124451,&#34;g&#34;:0.45098039507865906,&#34;b&#34;:0.44705882668495178,&#34;a&#34;:1.0},&#34;position&#34;:0.65104168653488159},{&#34;color&#34;:{&#34;r&#34;:1.0,&#34;g&#34;:1.0,&#34;b&#34;:1.0,&#34;a&#34;:1.0},&#34;position&#34;:1.0}],&#34;stopsVar&#34;:[],&#34;transform&#34;:{&#34;m00&#34;:-1.3362598565436201e-06,&#34;m01&#34;:-18.381584167480469,&#34;m02&#34;:37.671504974365234,&#34;m10&#34;:18.381584167480469,&#34;m11&#34;:-1.3362604249778087e-06,&#34;m12&#34;:250.92150878906250},&#34;opacity&#34;:1.0,&#34;blendMode&#34;:&#34;NORMAL&#34;,&#34;visible&#34;:true}"/>
</mask>
<g mask="url(#mask0_1_21)">
<g filter="url(#filter3_if_1_21)">
<g clip-path="url(#paint4_angular_1_21_clip_path)" data-figma-skip-parse="true"><g transform="matrix(-6.6813e-10 0.00919079 -0.00919079 -6.6813e-10 28.4807 260.112)"><foreignObject x="-1035.62" y="-1035.62" width="2071.23" height="2071.23"><div xmlns="http://www.w3.org/1999/xhtml" style="background:conic-gradient(from 90deg,rgba(119, 119, 119, 1) 0deg,rgba(101, 103, 104, 1) 99.7866deg,rgba(253, 254, 255, 1) 162.736deg,rgba(113, 115, 114, 1) 234.375deg,rgba(255, 255, 255, 1) 360deg);height:100%;width:100%;opacity:1"></div></foreignObject></g></g><circle cx="28.4807" cy="260.112" r="8.23572" data-figma-gradient-fill="{&#34;type&#34;:&#34;GRADIENT_ANGULAR&#34;,&#34;stops&#34;:[{&#34;color&#34;:{&#34;r&#34;:0.46666666865348816,&#34;g&#34;:0.46666666865348816,&#34;b&#34;:0.46666666865348816,&#34;a&#34;:1.0},&#34;position&#34;:0.0},{&#34;color&#34;:{&#34;r&#34;:0.39607843756675720,&#34;g&#34;:0.40392157435417175,&#34;b&#34;:0.40784314274787903,&#34;a&#34;:1.0},&#34;position&#34;:0.27718502283096313},{&#34;color&#34;:{&#34;r&#34;:0.99583333730697632,&#34;g&#34;:0.9998697042465210,&#34;b&#34;:1.0,&#34;a&#34;:1.0},&#34;position&#34;:0.4520442783832550},{&#34;color&#34;:{&#34;r&#34;:0.44313725829124451,&#34;g&#34;:0.45098039507865906,&#34;b&#34;:0.44705882668495178,&#34;a&#34;:1.0},&#34;position&#34;:0.65104168653488159},{&#34;color&#34;:{&#34;r&#34;:1.0,&#34;g&#34;:1.0,&#34;b&#34;:1.0,&#34;a&#34;:1.0},&#34;position&#34;:1.0}],&#34;stopsVar&#34;:[],&#34;transform&#34;:{&#34;m00&#34;:-1.3362598565436201e-06,&#34;m01&#34;:-18.381584167480469,&#34;m02&#34;:37.671504974365234,&#34;m10&#34;:18.381584167480469,&#34;m11&#34;:-1.3362604249778087e-06,&#34;m12&#34;:250.92150878906250},&#34;opacity&#34;:1.0,&#34;blendMode&#34;:&#34;NORMAL&#34;,&#34;visible&#34;:true}"/>
</g>
<g style="mix-blend-mode:screen" filter="url(#filter4_f_1_21)">
<g clip-path="url(#paint5_angular_1_21_clip_path)" data-figma-skip-parse="true"><g transform="matrix(-7.12687e-10 0.00990814 -0.00990814 -7.12687e-10 28.4806 260.112)"><foreignObject x="-810.015" y="-810.015" width="1620.03" height="1620.03"><div xmlns="http://www.w3.org/1999/xhtml" style="background:conic-gradient(from 90deg,rgba(119, 119, 119, 1) 0deg,rgba(101, 103, 104, 1) 99.7866deg,rgba(253, 254, 255, 1) 162.736deg,rgba(113, 115, 114, 1) 234.375deg,rgba(255, 255, 255, 1) 360deg);height:100%;width:100%;opacity:0.8"></div></foreignObject></g></g><circle cx="28.4806" cy="260.112" r="6.94439" data-figma-gradient-fill="{&#34;type&#34;:&#34;GRADIENT_ANGULAR&#34;,&#34;stops&#34;:[{&#34;color&#34;:{&#34;r&#34;:0.46666666865348816,&#34;g&#34;:0.46666666865348816,&#34;b&#34;:0.46666666865348816,&#34;a&#34;:1.0},&#34;position&#34;:0.0},{&#34;color&#34;:{&#34;r&#34;:0.39607843756675720,&#34;g&#34;:0.40392157435417175,&#34;b&#34;:0.40784314274787903,&#34;a&#34;:1.0},&#34;position&#34;:0.27718502283096313},{&#34;color&#34;:{&#34;r&#34;:0.99583333730697632,&#34;g&#34;:0.9998697042465210,&#34;b&#34;:1.0,&#34;a&#34;:1.0},&#34;position&#34;:0.4520442783832550},{&#34;color&#34;:{&#34;r&#34;:0.44313725829124451,&#34;g&#34;:0.45098039507865906,&#34;b&#34;:0.44705882668495178,&#34;a&#34;:1.0},&#34;position&#34;:0.65104168653488159},{&#34;color&#34;:{&#34;r&#34;:1.0,&#34;g&#34;:1.0,&#34;b&#34;:1.0,&#34;a&#34;:1.0},&#34;position&#34;:1.0}],&#34;stopsVar&#34;:[],&#34;transform&#34;:{&#34;m00&#34;:-1.4253739664127352e-06,&#34;m01&#34;:-19.816272735595703,&#34;m02&#34;:38.388786315917969,&#34;m10&#34;:19.816272735595703,&#34;m11&#34;:-1.4253746485337615e-06,&#34;m12&#34;:250.20416259765625},&#34;opacity&#34;:0.80000001192092896,&#34;blendMode&#34;:&#34;NORMAL&#34;,&#34;visible&#34;:true}"/>
</g>
</g>
<defs>
<filter id="filter0_ii_1_21" x="-3" y="0" width="55.582" height="520.225" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="-6"/>
<feGaussianBlur stdDeviation="1.5"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"/>
<feBlend mode="normal" in2="shape" result="effect1_innerShadow_1_21"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="3" dy="2"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.65 0"/>
<feBlend mode="normal" in2="effect1_innerShadow_1_21" result="effect2_innerShadow_1_21"/>
</filter>
<filter id="filter1_d_1_21" x="1.07507" y="2.50623" width="50.4316" height="517.402" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset/>
<feGaussianBlur stdDeviation="1"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_21"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_21" result="shape"/>
</filter>
<filter id="filter2_ii_1_21" x="16.4807" y="248.112" width="24" height="23" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="-1" dy="-1"/>
<feGaussianBlur stdDeviation="0.5"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.54 0"/>
<feBlend mode="darken" in2="shape" result="effect1_innerShadow_1_21"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="1"/>
<feGaussianBlur stdDeviation="0.5"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.54 0"/>
<feBlend mode="normal" in2="effect1_innerShadow_1_21" result="effect2_innerShadow_1_21"/>
</filter>
<clipPath id="paint3_angular_1_21_clip_path"><circle cx="28.4807" cy="260.112" r="8.23572"/></clipPath><filter id="filter3_if_1_21" x="19.745" y="251.377" width="21.2362" height="22.6578" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="4.2648" dy="5.6864"/>
<feGaussianBlur stdDeviation="2.8432"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.95 0"/>
<feBlend mode="normal" in2="shape" result="effect1_innerShadow_1_21"/>
<feGaussianBlur stdDeviation="0.25" result="effect2_foregroundBlur_1_21"/>
</filter>
<clipPath id="paint4_angular_1_21_clip_path"><circle cx="28.4807" cy="260.112" r="8.23572"/></clipPath><filter id="filter4_f_1_21" x="19.3736" y="251.005" width="18.2142" height="18.2142" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="1.08134" result="effect1_foregroundBlur_1_21"/>
</filter>
<clipPath id="paint5_angular_1_21_clip_path"><circle cx="28.4806" cy="260.112" r="6.94439"/></clipPath><linearGradient id="paint0_linear_1_21" x1="14.1174" y1="233.821" x2="14.1174" y2="286.403" gradientUnits="userSpaceOnUse">
<stop stop-color="#D5D5D5"/>
<stop offset="0.080287" stop-color="#CBCBCB"/>
<stop offset="0.276382" stop-color="#CDCDCD"/>
<stop offset="0.48408" stop-color="#C7C7C7"/>
<stop offset="0.6999" stop-color="#BEBEBE"/>
<stop offset="0.919201" stop-color="#C9C9C9"/>
<stop offset="1" stop-color="#C8C8C8"/>
</linearGradient>
<linearGradient id="paint1_linear_1_21" x1="26.2909" y1="4.50623" x2="26.2909" y2="517.909" gradientUnits="userSpaceOnUse">
<stop stop-color="#D5D5D5"/>
<stop offset="0.080287" stop-color="#CBCBCB"/>
<stop offset="0.276382" stop-color="#CDCDCD"/>
<stop offset="0.48408" stop-color="#C7C7C7"/>
<stop offset="0.6999" stop-color="#BEBEBE"/>
<stop offset="0.919201" stop-color="#C9C9C9"/>
<stop offset="1" stop-color="#C8C8C8"/>
</linearGradient>
<linearGradient id="paint2_linear_1_21" x1="21.4635" y1="250.834" x2="35.1589" y2="268.935" gradientUnits="userSpaceOnUse">
<stop stop-color="#7A7E7C"/>
<stop offset="1" stop-color="#F8FAFB"/>
</linearGradient>
</defs>
</svg>`
            }}
          />


          {/* Right Faders - Dynamically render based on number of stems with horizontal scrolling */}
          {(() => {
            // Only render faders for existing stems
            const activeStems = stems.filter(stem => stem && stem.label)
            if (activeStems.length === 0) return null
            
            // Fader dimensions and spacing
            const faderWidth = 137.14
            const spacing = 104.25 // Spacing between fader left edges (matches original design)
            
            // Original fader area boundaries (where the 5 faders were originally positioned)
            const originalFirstFaderLeft = 837.75
            const originalLastFaderLeft = 1235
            const originalLastFaderRight = originalLastFaderLeft + faderWidth
            
            // Calculate center of the original fader area
            const originalFaderAreaCenter = (originalFirstFaderLeft + originalLastFaderRight) / 2
            const originalFaderAreaWidth = originalLastFaderRight - originalFirstFaderLeft
            
            // Calculate total width needed for all faders (last fader left + fader width)
            const lastFaderLeft = (activeStems.length - 1) * spacing
            const totalWidth = lastFaderLeft + faderWidth
            
            // If we have many stems, use scrollable container; otherwise center them
            const maxVisibleFaders = 5
            const needsScrolling = activeStems.length > maxVisibleFaders
            
            // Calculate center of the visible area to center faders when not scrolling
            const visibleAreaCenter = originalFaderAreaCenter
            
            // Default label positioning (can be adjusted per stem if needed)
            const defaultLabelLeft = '12px'
            const defaultLabelTop = '242px'
            
            // When centering, calculate the offset from container left
            const centerOffset = needsScrolling ? 0 : (visibleAreaCenter - originalFirstFaderLeft) - (totalWidth / 2)
            
            // Calculate inner container width - must fit all faders + padding
            const padding = 30 // Padding on each side to prevent cutoffs
            const innerWidth = totalWidth + (padding * 2)
            
            // Container positioning and sizing
            // When centering, we need to extend the container to accommodate the centered position
            const containerLeft = originalFirstFaderLeft
            
            // When not scrolling, ensure container extends to fit centered content
            // Calculate where the rightmost fader will be
            const rightmostFaderEdge = containerLeft + (needsScrolling ? 0 : centerOffset) + padding + totalWidth
            
            // Container width - must extend enough to show all faders
            const containerWidth = needsScrolling 
              ? originalFaderAreaWidth 
              : Math.max(
                  originalFaderAreaWidth, 
                  rightmostFaderEdge - containerLeft + padding
                )
            
            return (
              <div
                style={{
                  position: 'absolute',
                  left: `${containerLeft}px`,
                  top: '175px',
                  width: `${containerWidth}px`,
                  height: '698.99px',
                  overflowX: needsScrolling ? 'auto' : 'visible',
                  overflowY: 'visible',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent',
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: `${innerWidth}px`,
                    height: '100%',
                    minWidth: `${innerWidth}px`,
                    left: needsScrolling ? '0px' : `${Math.max(0, centerOffset + padding)}px`,
                  }}
                >
                  {activeStems.map((stem, index) => {
                    const stemLabel = stem.label
                    const volume = volumes[stemLabel] ?? 1
                    const disabled = !setTrackVolume
                    
                    // Calculate left position for this fader (relative to inner container)
                    const faderLeft = padding + (index * spacing)
                    
                    // Calculate label position based on stem label length
                    let labelLeft = defaultLabelLeft
                    let labelTop = defaultLabelTop
                    
                    // Adjust label position for specific labels if needed
                    if (stemLabel === 'PERC') {
                      labelLeft = '14px'
                      labelTop = '249px'
                    } else if (stemLabel === 'VOCALS') {
                      labelLeft = '12px'
                      labelTop = '230px'
                    } else if (stemLabel === 'BASS') {
                      labelLeft = '12px'
                      labelTop = '258px'
                    } else if (stemLabel === 'DRUMS') {
                      labelLeft = '12.25px'
                      labelTop = '242px'
                    }
                    
                    return (
                      <Fader
                        key={stemLabel}
                        faderLeft={`${faderLeft}px`}
                        faderTop="0px"
                        label={stemLabel}
                        labelLeft={labelLeft}
                        labelTop={labelTop}
                        knobLeft="0px"
                        knobTop={undefined}
                        volume={disabled ? undefined : volume}
                        onChange={disabled ? undefined : (newVolume) => {
                          if (setVolumes) {
                            setVolumes((prev) => ({ ...prev, [stemLabel]: newVolume }))
                          }
                          if (setTrackVolume) {
                            setTrackVolume(stemLabel, newVolume)
                          }
                        }}
                        stemLabel={stemLabel}
                        disabled={disabled}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ECHO, REVERB, FLANGER Labels - EXACT positions */}
          <div
            style={{
              position: 'absolute',
              width: '61px',
              height: '33px',
              left: '889.45px',
              top: '976.09px',
              fontFamily: "'Poppins', sans-serif",
              fontStyle: 'normal',
              fontWeight: 275,
              fontSize: '22.0995px',
              lineHeight: '33px',
              color: '#000000',
              mixBlendMode: 'multiply',
              opacity: 0.6,
            }}
          >
            ECHO
          </div>
          <div
            style={{
              position: 'absolute',
              width: '74px',
              height: '33px',
              left: '1051.03px',
              top: '977px',
              fontFamily: "'Poppins', sans-serif",
              fontStyle: 'normal',
              fontWeight: 275,
              fontSize: '22.0995px',
              lineHeight: '33px',
              color: '#000000',
              mixBlendMode: 'multiply',
              opacity: 0.6,
            }}
          >
            REVERB
          </div>
          <div
            style={{
              position: 'absolute',
              width: '89px',
              height: '33px',
              left: '1206.03px',
              top: '976px',
              fontFamily: "'Poppins', sans-serif",
              fontStyle: 'normal',
              fontWeight: 275,
              fontSize: '22.0995px',
              lineHeight: '33px',
              color: '#000000',
              mixBlendMode: 'multiply',
              opacity: 0.6,
            }}
          >
            FLANGER
          </div>

          {/* Small Knobs - ONLY 3 to match the 3 labels, centered below each label */}
          {/* ECHO: center at 889.45 + 30.5 = 919.95, knob left = 919.95 - 73.5 = 846.45 */}
          <EffectKnob left="846.45px" top="1010px" id="echo" />
          {/* REVERB: center at 1051.03 + 37 = 1088.03, knob left = 1088.03 - 73.5 = 1014.53 */}
          <EffectKnob left="1014.53px" top="1010px" id="reverb" />
          {/* FLANGER: center at 1206.03 + 44.5 = 1250.53, knob left = 1250.53 - 73.5 = 1177.03 */}
          <EffectKnob left="1177.03px" top="1010px" id="flanger" />

          {/* Rating/Volume Control */}
          <div
            style={{
              position: 'absolute',
              width: '42px',
              height: '428.17px',
              left: '70.59px',
              top: '242.02px',
            }}
          >
            {/* Vector indicators */}
            <div
              style={{
                position: 'absolute',
                width: '20px',
                height: '41.54px',
                left: '11px',
                top: '0px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '20.77px',
                  height: '20px',
                  left: '0px',
                  top: '20.77px',
                  background: '#F2F2F2',
                  mixBlendMode: 'normal',
                  opacity: 0.9,
                  borderRadius: '1px',
                  transform: 'rotate(-90deg)',
                  transformOrigin: 'center',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '20.77px',
                  height: '20px',
                  left: '0px',
                  top: '0px',
                  background: '#F2F2F2',
                  mixBlendMode: 'normal',
                  opacity: 0.9,
                  borderRadius: '1px',
                  transform: 'rotate(-90deg)',
                  transformOrigin: 'center',
                }}
              />
            </div>
            {/* Container */}
            <div
              style={{
                position: 'absolute',
                width: '42px',
                height: '38.87px',
                left: '0px',
                top: '389.3px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '20px',
                  height: '20.77px',
                  left: '11px',
                  top: '0px',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: '20.77px',
                    height: '20px',
                    left: '0px',
                    top: '0px',
                    background: '#F2F2F2',
                    mixBlendMode: 'normal',
                    opacity: 0.9,
                    borderRadius: '1px',
                    transform: 'matrix(0, 1, 1, 0, 0, 0)',
                  }}
                />
              </div>
            </div>
            {/* R Text */}
            <div
              style={{
                position: 'absolute',
                width: '16px',
                height: '42px',
                left: '0px',
                top: '654.19px',
                fontFamily: "'Poppins', sans-serif",
                fontStyle: 'normal',
                fontWeight: 275,
                fontSize: '28px',
                lineHeight: '42px',
                color: '#EDEDED',
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
              }}
            >
              R
            </div>
          </div>

          {/* Vertical sliders - EXACT from CSS */}
          <div
            style={{
              position: 'absolute',
              width: '10.95px',
              height: '147.14px',
              left: '48.44px',
              top: '836.36px',
              transform: 'matrix(-1, 0, 0, 1, 0, 0)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '10.95px',
                height: '147.14px',
                left: '0px',
                top: '0px',
                background: 'linear-gradient(180deg, #B7BBB9 0%, #FDFCFD 3.78%, #C9CCCB 13.39%, #CACBCB 45.4%, #C7C8C7 85.57%, #AAA9AA 95.03%, #5F6163 99.59%, #D0D0D0 100.41%), linear-gradient(180deg, #B7BBB9 0%, #FDFCFD 3.78%, #DFDFDF 13.39%, #DFDFDF 45.4%, #DEDEDE 85.57%, #AAA9AA 95.03%, #5F6163 99.59%, #D0D0D0 100.41%)',
                borderRadius: '0px 2px 2px 0px',
                transform: 'matrix(-1, 0, 0, 1, 0, 0)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '8.51px',
                height: '148.43px',
                left: '1.22px',
                top: '-0.65px',
                background: 'linear-gradient(180deg, #B7BBB9 0%, #FDFCFD 3.78%, #C9CCCB 13.39%, #DFDFDF 45.4%, #C7C8C7 85.57%, #AAA9AA 95.03%, #5F6163 99.59%, #D0D0D0 100.41%)',
                boxShadow: 'inset 1px 0px 0.15px rgba(255, 255, 255, 0.45), inset -1px 4px 0.5px rgba(17, 17, 17, 0.25)',
                borderRadius: '2px',
                transform: 'matrix(-1, 0, 0, 1, 0, 0)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Other vertical sliders */}
          {[
            { left: '742.17px', top: '189.64px', height: '130.6px', width: '9.2px', sliderWidth: '7.85px', gradient: 'dark' },
            { left: '742.17px', top: '359.01px', height: '53.71px', width: '9.2px', sliderWidth: '7.93px', gradient: 'active' },
            { left: '742.17px', top: '481.76px', height: '53.71px', width: '9.2px', sliderWidth: '7.93px', gradient: 'active' },
          ].map((slider, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                width: slider.width,
                height: slider.height,
                left: slider.left,
                top: slider.top,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: slider.width,
                  height: slider.height,
                  left: '0px',
                  top: '0px',
                  background: slider.gradient === 'active'
                    ? 'linear-gradient(180deg, #A0A2A3 0%, #6F7172 9.51%, #C9CBCC 13.39%, #AAACAB 45.4%, #222729 67.57%, #484B4C 85.57%, #9B9D9E 95.03%, #C9C8CA 99.59%, #AFB1B0 100.41%)'
                    : 'linear-gradient(180deg, #595B5D 0%, #C3C5C6 3.78%, #727476 13.39%, #686A6B 45.4%, #828485 85.57%, #262C2E 95.03%, #C9C8CA 99.59%, rgba(255, 255, 255, 0) 100.41%)',
                  borderRadius: '0px 2px 2px 0px',
                  boxShadow: slider.gradient === 'active' ? 'inset 1px 0px 2px rgba(0, 0, 0, 0.45), inset -1px 4px 0.5px rgba(225, 225, 225, 0.25)' : 'inset 1px 0px 2px rgba(0, 0, 0, 0.45), inset -1px 4px 0.5px rgba(225, 225, 225, 0.25)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}

          {/* Small sliders/horizontal controls - Play/Pause Buttons */}
          <div
            style={{
              position: 'absolute',
              width: '121.76px',
              height: '13.25px',
              left: '292.14px',
              top: '104.98px',
              zIndex: 1000,
              pointerEvents: 'auto',
            }}
          >
            {/* Play Button - Left */}
            <button
              type="button"
              onClick={handlePlay}
              style={{
                position: 'absolute',
                width: '12.48px',
                height: '12.48px',
                left: '0px',
                top: '0px',
                background: 'linear-gradient(168.6deg, #AAACAE 8.39%, #FCFFFF 94.99%)',
                boxShadow: 'inset 1px 1px 1px rgba(0, 0, 0, 0.65)',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.stopPropagation()
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '10.94px',
                  height: '10.94px',
                  left: '0.77px',
                  top: '0.77px',
                  background: '#030A0E',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />
            </button>
            {/* Pause Button - Right */}
            <button
              type="button"
              onClick={handlePause}
              style={{
                position: 'absolute',
                width: '12.48px',
                height: '12.48px',
                left: '109.28px',
                top: '0.77px',
                background: 'linear-gradient(168.6deg, #AAACAE 8.39%, #FCFFFF 94.99%)',
                boxShadow: 'inset 1px 1px 1px rgba(0, 0, 0, 0.65)',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.stopPropagation()
                e.currentTarget.style.transform = 'scale(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '10.94px',
                  height: '10.94px',
                  left: '0.77px',
                  top: '0.77px',
                  background: 'linear-gradient(137.46deg, #7B7B7B 12.15%, #9D9D9D 86.1%)',
                  boxShadow: 'inset 0px 1px 1px rgba(0, 0, 0, 0.1)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />
            </button>
          </div>

          {/* Checkbox */}
          <div
            style={{
              position: 'absolute',
              width: '21.81px',
              height: '64.62px',
              left: '142.38px',
              top: '0px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '21.81px',
                height: '64.62px',
                left: '0px',
                top: '0px',
                background: 'radial-gradient(64.45% 64.45% at 5.72% 37.16%, rgba(242, 242, 242, 0.6) 0%, rgba(234, 234, 234, 0.6) 100%), linear-gradient(180deg, #B5B5B5 0%, #EAEAEA 8.07%, #BDBDBD 28.06%, #C3C3C3 81.5%, #E0E0E0 94.22%, #CFCFCF 102.18%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '17.79px',
                height: '64.62px',
                left: '2.01px',
                top: '0px',
                background: 'linear-gradient(180deg, #B5B5B5 0%, #EAEAEA 8.07%, #BDBDBD 28.06%, #C3C3C3 81.5%, #E0E0E0 94.22%, #CFCFCF 102.18%)',
                boxShadow: 'inset 1px 0px 0.5px rgba(255, 255, 255, 0.6), inset -1px 0px 0.5px rgba(0, 0, 0, 0.2)',
              }}
            />
          </div>

          {/* Switch at bottom right */}
          <div
            style={{
              position: 'absolute',
              width: '56px',
              height: '56px',
              left: '99.59px',
              top: '706.34px',
              background: 'linear-gradient(137.46deg, #7B7B7B 12.15%, #9D9D9D 86.1%)',
              boxShadow: 'inset 0px 1px 1px rgba(0, 0, 0, 0.1), inset 0px -0.5px 0px rgba(0, 0, 0, 0.18)',
              borderRadius: '50%',
            }}
          />

          {/* M button */}
          <div
            style={{
              position: 'absolute',
              width: '26.07px',
              height: '26.07px',
              left: '701.88px',
              top: '241.91px',
              background: '#E76A2D',
              borderRadius: '1px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '4.3452px',
              gap: '4.35px',
            }}
          >
            <div
              style={{
                width: '15px',
                height: '26px',
                fontFamily: "'Poppins', sans-serif",
                fontStyle: 'normal',
                fontWeight: 400,
                fontSize: '17.3808px',
                lineHeight: '26px',
                color: '#B6B6B6',
                mixBlendMode: 'normal',
              }}
            >
              M
            </div>
          </div>

          {/* Number Input Container at bottom */}
          <div
            style={{
              position: 'absolute',
              width: '513.31px',
              height: '241.71px',
              left: '56.68px',
              top: '798.49px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '509.85px',
                height: '241.03px',
                left: '0px',
                top: '3.69px',
                background: 'linear-gradient(147.29deg, #010505 9.75%, #666869 89.28%)',
                borderRadius: '0px 0px 0px 28px',
              }}
            />
            {/* Cards inside - Middle card is Play, Last card is Pause */}
            {[
              { left: '0px', border: '1px 1px 1px 28px', innerLeft: '3.87px', innerBorder: '1px 1px 1px 27px', hasInset: false, isPlay: false, isPause: false },
              { left: '168.61px', border: '1px', innerLeft: '1.51px', innerBorder: '1px', hasInset: true, isPlay: true, isPause: false },
              { left: '337.22px', border: '1px', innerLeft: '1.51px', innerBorder: '1px', hasInset: true, isPlay: false, isPause: true },
            ].map((card, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (card.isPlay) {
                    handlePlay(e)
                  } else if (card.isPause) {
                    handlePause(e)
                  }
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)'
                  e.currentTarget.style.opacity = '0.9'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.opacity = '1'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.opacity = '1'
                }}
                style={{
                  position: 'absolute',
                  width: '165.61px',
                  height: '229.67px',
                  left: card.left,
                  top: '11.84px',
                  cursor: (card.isPlay || card.isPause) ? 'pointer' : 'default',
                  border: 'none',
                  padding: 0,
                  background: 'transparent',
                  zIndex: 1002,
                  pointerEvents: 'auto',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: '165.61px',
                    height: '229.67px',
                    left: '0px',
                    top: '0px',
                    background: 'linear-gradient(180.47deg, #B0B1B0 -5.18%, #EBEBEB 0.43%, #B4B4B4 7.29%, #C3C3C3 63.12%, #B7B7B7 99.9%)',
                    boxShadow: 'inset 0px -11px 10px rgba(0, 0, 0, 0.14), inset 8px -4px 2px rgba(255, 255, 255, 0.5)',
                    borderRadius: card.border === '1px 1px 1px 28px' ? '1px 1px 1px 28px' : '1px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    width: idx === 0 ? '159.47px' : '161.76px',
                    height: idx === 2 ? '226.53px' : '226.43px',
                    left: card.innerLeft,
                    top: '0px',
                    background: 'linear-gradient(180deg, #B0B1B0 -3.84%, #EBEBEB 1.71%, #B4B4B4 8.49%, #B4B4B4 63.66%, #ABACAB 90.23%, #B5B6B5 100%)',
                    boxShadow: card.hasInset ? '0.5px 0.5px 1px rgba(0, 0, 0, 0.75), inset 1.25px 4px 1px rgba(255, 255, 255, 0.8)' : '0.5px 0.5px 1px rgba(0, 0, 0, 0.75)',
                    borderRadius: card.innerBorder === '1px 1px 1px 27px' ? '1px 1px 1px 27px' : '1px',
                    pointerEvents: 'none',
                  }}
                />
                {/* Play icon for middle button, black squares for others */}
                {card.isPlay ? (
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                    }}
                  >
                    <path
                      d="M8 5v14l11-7z"
                      fill="#000000"
                      stroke="#000000"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : idx !== 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      width: '20px',
                      height: '20px',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: '#000000',
                      borderRadius: '2px',
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
              </button>
            ))}
            {/* Play Button - Left Square (Vector 1 - arrow indicator) */}
            <button
              type="button"
              onClick={handlePlay}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.background = '#030A0E'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.9'
                e.currentTarget.style.background = '#070808'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              style={{
                position: 'absolute',
                width: '20.77px',
                height: '20px',
                left: '238.92px',
                top: '62.41px',
                background: '#070808',
                mixBlendMode: 'normal',
                opacity: 0.9,
                border: '1px solid rgba(0, 0, 0, 0.9)',
                borderRadius: '1px',
                cursor: 'pointer',
                padding: 0,
                zIndex: 1001,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.currentTarget.style.opacity = '0.7'
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.stopPropagation()
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            />
            {/* Pause Button - Right Square (Slider - arrow indicator) */}
            <button
              type="button"
              onClick={handlePause}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.background = '#151718'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.9'
                e.currentTarget.style.background = '#1B1D1E'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              style={{
                position: 'absolute',
                width: '20.77px',
                height: '20px',
                left: '407.66px',
                top: '62.41px',
                background: '#1B1D1E',
                mixBlendMode: 'normal',
                opacity: 0.9,
                borderRadius: '1px',
                border: '1px solid rgba(0, 0, 0, 0.9)',
                cursor: 'pointer',
                padding: 0,
                zIndex: 1001,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.currentTarget.style.opacity = '0.7'
                e.currentTarget.style.transform = 'scale(0.95)'
              }}
              onMouseUp={(e) => {
                e.stopPropagation()
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
