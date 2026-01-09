'use client'

import React from 'react'

interface MetalButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'green' | 'dark-green'
  disabled?: boolean
  style?: React.CSSProperties
  className?: string
}

/**
 * Metal Button Component - Based on Figma UI Kit
 * 
 * To customize:
 * 1. Open Figma design
 * 2. Select button component
 * 3. Check Design panel for:
 *    - Exact width/height
 *    - Background color
 *    - Border width/color
 *    - Border radius
 *    - Box shadow values
 *    - Font size/weight
 * 4. Update styles below to match
 */
export default function MetalButton({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  style,
  className = '',
}: MetalButtonProps) {
  const baseStyle: React.CSSProperties = {
    padding: '0.45rem 1.1rem',
    fontSize: '0.9rem',
    border: '2px solid #000000',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
    transition: 'opacity 0.2s',
    ...style,
  }

  const variantStyles = {
    default: {
      backgroundColor: '#D4C5B9',
      color: '#000000',
    },
    green: {
      backgroundColor: '#90EE90', // Light green
      color: '#000000',
    },
    'dark-green': {
      backgroundColor: '#006400', // Dark green
      color: '#FFFFFF',
      boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff, 0 2px 4px rgba(0,0,0,0.2)', // Pressed state
    },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        opacity: disabled ? 0.6 : 1,
      }}
      className={className}
    >
      {children}
    </button>
  )
}

