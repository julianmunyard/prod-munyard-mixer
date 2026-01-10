'use client'

import { useEffect, useState } from 'react'

interface BarLoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
}

export default function BarLoadingIndicator({ 
  size = 'small',
  color = '#000000'
}: BarLoadingIndicatorProps) {
  const [fillCount, setFillCount] = useState(0)

  const sizes = {
    small: { width: '16px', height: '12px', barCount: 5, gap: '2px' },
    medium: { width: '24px', height: '18px', barCount: 6, gap: '2px' },
    large: { width: '36px', height: '24px', barCount: 8, gap: '2px' }
  }

  const config = sizes[size]

  useEffect(() => {
    // Cycle through filling all bars, then reset
    const interval = setInterval(() => {
      setFillCount((prev) => {
        if (prev >= config.barCount) {
          return 0 // Reset to start
        }
        return prev + 1
      })
    }, 200)

    return () => clearInterval(interval)
  }, [config.barCount])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: config.gap,
        width: config.width,
        height: config.height,
        padding: '2px',
        border: '2px solid #000000',
        backgroundColor: '#FFFFFF',
        boxSizing: 'border-box',
        boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
      }}
    >
      {Array.from({ length: config.barCount }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: '100%',
            backgroundColor: i < fillCount ? color : '#E0E0E0',
            transition: 'background-color 0.2s ease',
          }}
        />
      ))}
    </div>
  )
}
