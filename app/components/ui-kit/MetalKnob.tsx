'use client'

import React, { useState, useRef, useEffect } from 'react'

interface MetalKnobProps {
  value: number // 0-100 or your range
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  size?: 'large' | 'small' // Based on your Figma design
  label?: string
  style?: React.CSSProperties
}

/**
 * Metal Knob Component - Based on Figma UI Kit
 * 
 * To customize from Figma:
 * 1. Measure knob diameter (large vs small)
 * 2. Get metal texture/color from design
 * 3. Note tick marks count and positioning
 * 4. Check indicator line style (width, color)
 * 5. Update styles below to match exactly
 */
export default function MetalKnob({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  size = 'small',
  label,
  style,
}: MetalKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [startValue, setStartValue] = useState(0)

  // Size configurations - update these to match Figma specs
  const sizeConfig = {
    large: {
      width: 80,
      height: 80,
      indicatorWidth: 2,
      indicatorLength: 30,
    },
    small: {
      width: 50,
      height: 50,
      indicatorWidth: 2,
      indicatorLength: 18,
    },
  }

  const config = sizeConfig[size]
  const percentage = ((value - min) / (max - min)) * 100
  const rotation = (percentage / 100) * 270 - 135 // Rotate from -135° to 135°

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartY(e.clientY)
    setStartValue(value)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setStartY(e.touches[0].clientY)
    setStartValue(value)
  }

  useEffect(() => {
    const handleMove = (clientY: number) => {
      if (!isDragging) return

      const delta = startY - clientY
      const sensitivity = 0.5
      const change = delta * sensitivity
      const newValue = Math.max(min, Math.min(max, startValue + change))
      const steppedValue = Math.round(newValue / step) * step

      onChange(steppedValue)
    }

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientY)
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches[0]) handleMove(e.touches[0].clientY)
    }

    const handleEnd = () => setIsDragging(false)

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleEnd)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleEnd)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleEnd)
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleEnd)
      }
    }
  }, [isDragging, startY, startValue, onChange, min, max, step])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', ...style }}>
      {label && (
        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', textAlign: 'center' }}>
          {label}
        </span>
      )}
      <div
        ref={knobRef}
        style={{
          width: config.width,
          height: config.height,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #D4C5B9 0%, #B8A89C 50%, #9C8C80 100%)', // Metal gradient - update to match Figma
          border: '2px solid #000000',
          boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff, 0 4px 8px rgba(0,0,0,0.3)',
          position: 'relative',
          cursor: 'grab',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Central indentation */}
        <div
          style={{
            width: config.width * 0.3,
            height: config.height * 0.3,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #9C8C80 0%, #B8A89C 50%, #D4C5B9 100%)',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.3)',
          }}
        />
        
        {/* Indicator line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: config.indicatorWidth,
            height: config.indicatorLength,
            backgroundColor: '#FFFFFF',
            borderRadius: '1px',
          }}
        />
      </div>
      {/* Tick marks - add these around the knob if needed */}
    </div>
  )
}

