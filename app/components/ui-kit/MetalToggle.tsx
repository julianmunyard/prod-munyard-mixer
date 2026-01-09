'use client'

import React from 'react'

interface MetalToggleProps {
  value: 'up' | 'middle' | 'down'
  onChange: (value: 'up' | 'middle' | 'down') => void
  label?: string
  style?: React.CSSProperties
}

/**
 * Metal Toggle Component - Based on Figma UI Kit
 * 
 * To customize from Figma:
 * 1. Measure toggle housing dimensions
 * 2. Get switch dimensions and colors
 * 3. Note slot/rail styling
 * 4. Check label positioning
 * 5. Update styles below to match
 */
export default function MetalToggle({
  value,
  onChange,
  label,
  style,
}: MetalToggleProps) {
  const positions = {
    up: '0%',
    middle: '35%',
    down: '70%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', ...style }}>
      {label && (
        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{label}</span>
      )}
      <div
        style={{
          position: 'relative',
          width: '40px',
          height: '80px',
          border: '2px solid #000000',
          backgroundColor: '#D4C5B9', // Metal housing color - update to match Figma
          borderRadius: '4px',
          boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
          cursor: 'pointer',
        }}
        onClick={() => {
          if (value === 'up') onChange('middle')
          else if (value === 'middle') onChange('down')
          else onChange('up')
        }}
      >
        {/* Switch */}
        <div
          style={{
            position: 'absolute',
            left: '2px',
            top: positions[value],
            width: 'calc(100% - 4px)',
            height: '28%',
            backgroundColor: '#C0C0C0', // Switch color - update to match Figma
            border: '1px solid #000000',
            borderRadius: '2px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'top 0.2s ease',
          }}
        />
      </div>
      {/* Position labels */}
      <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.7rem', fontFamily: 'monospace' }}>
        <span style={{ opacity: value === 'up' ? 1 : 0.3 }}>U</span>
        <span style={{ opacity: value === 'middle' ? 1 : 0.3 }}>M</span>
        <span style={{ opacity: value === 'down' ? 1 : 0.3 }}>D</span>
      </div>
    </div>
  )
}

