'use client'

import React, { useState, useEffect, useRef } from 'react'

interface FlangerConfig {
  wet: number
  depth: number
  lfoBeats: number
  bpm: number
  clipperThresholdDb: number
  clipperMaximumDb: number
  stereo: boolean
  enabled: boolean
}

interface FlangerConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: FlangerConfig) => void
  onConfigChange?: (config: FlangerConfig) => void  // For real-time updates
  initialConfig?: FlangerConfig
  stemLabel?: string
  position?: { x: number; y: number }
  primaryColor?: string
}

const FlangerConfigModal: React.FC<FlangerConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onConfigChange,
  initialConfig = {
    wet: 0.7,
    depth: 0.16,
    lfoBeats: 16,
    bpm: 128,
    clipperThresholdDb: -3,
    clipperMaximumDb: 6,
    stereo: false,
    enabled: false
  },
  stemLabel,
  position,
  primaryColor = '#B8001F'
}) => {
  const [config, setConfig] = useState<FlangerConfig>(initialConfig)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setConfig(initialConfig)
      // Only set initial position if modal is being opened for the first time (no existing drag position)
      if (position && !dragPosition) {
        const modalWidth = 256 // w-64 = 256px
        const modalHeight = 400 // Approximate height
        const windowWidth = window.innerWidth
        const windowHeight = window.innerHeight
        
        let initialX = position.x - 128
        let initialY = position.y - 200
        
        // Keep modal within window bounds
        if (initialX < 0) initialX = 0
        if (initialX + modalWidth > windowWidth) initialX = windowWidth - modalWidth
        if (initialY < 0) initialY = 0
        if (initialY + modalHeight > windowHeight) initialY = windowHeight - modalHeight
        
        setDragPosition({ x: initialX, y: initialY })
      }
    }
  }, [isOpen, initialConfig, position, dragPosition])

  const handleStart = (clientX: number, clientY: number) => {
    if (!modalRef.current) return
    
    const rect = modalRef.current.getBoundingClientRect()
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    })
    setIsDragging(true)
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return
    
    const newX = clientX - dragOffset.x
    const newY = clientY - dragOffset.y
    
    // Keep modal within window bounds
    const modalWidth = 256
    const modalHeight = 400
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    
    const boundedX = Math.max(0, Math.min(newX, windowWidth - modalWidth))
    const boundedY = Math.max(0, Math.min(newY, windowHeight - modalHeight))
    
    setDragPosition({ x: boundedX, y: boundedY })
  }

  const handleEnd = () => {
    setIsDragging(false)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: MouseEvent) => {
    e.preventDefault()
    handleMove(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault()
    handleEnd()
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd, { passive: false })
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, dragOffset])

  if (!isOpen) return null

  const handleSave = () => {
    setDragPosition(null) // Reset position when closing
    onSave(config)
    onClose() // Close the modal after saving
  }

  const handleClose = () => {
    setDragPosition(null) // Reset position when closing
    onClose()
  }

  return (
    <>
      <style jsx>{`
        /* Safari/WebKit specific styling */
        .slider-horizontal::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${primaryColor} !important;
          border: 2px solid #FCFAEE !important;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        /* Firefox specific styling */
        .slider-horizontal::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${primaryColor} !important;
          border: 2px solid #FCFAEE !important;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        /* Safari hover effects */
        .slider-horizontal::-webkit-slider-thumb:hover {
          background: ${primaryColor}CC !important;
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        /* Firefox hover effects */
        .slider-horizontal::-moz-range-thumb:hover {
          background: ${primaryColor}CC !important;
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        /* Ensure Safari removes default styling */
        .slider-horizontal::-webkit-slider-track {
          -webkit-appearance: none;
          appearance: none;
        }
      `}</style>
      <div 
        className="fixed inset-0 z-50 pointer-events-none"
        onClick={handleClose}
      >
      <div 
        ref={modalRef}
        className="absolute bg-[#FCFAEE] rounded-lg p-4 w-64 shadow-lg border pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          borderColor: primaryColor,
          boxShadow: `0 8px 16px ${primaryColor}30`,
          left: dragPosition ? `${dragPosition.x}px` : (position ? `${position.x - 128}px` : '50%'),
          top: dragPosition ? `${dragPosition.y}px` : (position ? `${position.y - 200}px` : '50%'),
          transform: dragPosition ? 'none' : (position ? 'none' : 'translate(-50%, -50%)'),
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        <div 
          className="flex justify-between items-center mb-1 cursor-grab select-none"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div className="flex flex-col">
            <h2 className="text-xs font-bold font-mono" style={{ color: primaryColor }}>
              FLANGER
            </h2>
            <span className="text-xs font-mono opacity-75" style={{ color: primaryColor }}>
              {stemLabel || 'Global Mix'}
            </span>
          </div>
          <button
            onClick={handleClose}
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleClose()
            }}
            className="text-xs font-bold touch-manipulation"
            style={{ color: primaryColor, minWidth: '24px', minHeight: '24px' }}
            onMouseEnter={(e) => {
              const rgb = primaryColor.match(/\d+/g);
              if (rgb) {
                const r = Math.max(0, parseInt(rgb[0]) - 30);
                const g = Math.max(0, parseInt(rgb[1]) - 30);
                const b = Math.max(0, parseInt(rgb[2]) - 30);
                e.currentTarget.style.color = `rgb(${r}, ${g}, ${b})`;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = primaryColor;
            }}
          >
            ×
          </button>
        </div>
        
        <div className="space-y-3">
          {/* Wet Signal Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>WET</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.wet.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.wet}
              onChange={(e) => {
                const newConfig = { ...config, wet: parseFloat(e.target.value) }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${config.wet * 100}%, #D1D5DB ${config.wet * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Depth Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>DEPTH</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.depth.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.depth}
              onChange={(e) => {
                const newConfig = { ...config, depth: parseFloat(e.target.value) }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${config.depth * 100}%, #D1D5DB ${config.depth * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* LFO Beats Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>LFO</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.lfoBeats.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="128"
              step="0.25"
              value={config.lfoBeats}
              onChange={(e) => {
                const newConfig = { ...config, lfoBeats: parseFloat(e.target.value) }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${(config.lfoBeats / 128) * 100}%, #D1D5DB ${(config.lfoBeats / 128) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* BPM Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>BPM</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.bpm}</span>
            </div>
            <input
              type="range"
              min="40"
              max="250"
              step="1"
              value={config.bpm}
              onChange={(e) => {
                const newConfig = { ...config, bpm: parseInt(e.target.value) }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${((config.bpm - 40) / 210) * 100}%, #D1D5DB ${((config.bpm - 40) / 210) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Clipper Threshold Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>THRESH</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.clipperThresholdDb.toFixed(1)}dB</span>
            </div>
            <input
              type="range"
              min="-20"
              max="0"
              step="0.1"
              value={config.clipperThresholdDb}
              onChange={(e) => {
                const newConfig = { ...config, clipperThresholdDb: parseFloat(e.target.value) }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${((config.clipperThresholdDb + 20) / 20) * 100}%, #D1D5DB ${((config.clipperThresholdDb + 20) / 20) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Clipper Maximum Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>MAX</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.clipperMaximumDb.toFixed(1)}dB</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="0.1"
              value={config.clipperMaximumDb}
              onChange={(e) => {
                const newConfig = { ...config, clipperMaximumDb: parseFloat(e.target.value) }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${(config.clipperMaximumDb / 20) * 100}%, #D1D5DB ${(config.clipperMaximumDb / 20) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>


          {/* Stereo Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>STEREO</span>
            <input
              type="checkbox"
              checked={config.stereo}
              onChange={(e) => {
                const newConfig = { ...config, stereo: e.target.checked }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-4 h-4"
              style={{ accentColor: primaryColor }}
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-mono font-bold transition-all duration-200 hover:opacity-80"
            style={{
              backgroundColor: primaryColor,
              color: '#FCFAEE',
              border: `1px solid ${primaryColor}`,
              borderRadius: '4px'
            }}
          >
            SAVE
          </button>
        </div>
      </div>
      </div>
    </>
  )
}

export default FlangerConfigModal
