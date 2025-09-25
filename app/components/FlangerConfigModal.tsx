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
  position
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
  }

  return (
    <>
      <div 
        className="fixed inset-0 z-50 pointer-events-none"
        onClick={() => {
          setDragPosition(null) // Reset position when closing
          onClose()
        }}
      >
      <div 
        ref={modalRef}
        className="absolute bg-[#FCFAEE] rounded-lg p-4 w-64 shadow-lg border border-[#B8001F] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 8px 16px rgba(184, 0, 31, 0.3)',
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
            <h2 className="text-xs font-bold text-[#B8001F] font-mono">
              FLANGER
            </h2>
            <span className="text-xs text-[#B8001F] font-mono opacity-75">
              {stemLabel || 'Global Mix'}
            </span>
          </div>
          <button
            onClick={() => {
              setDragPosition(null) // Reset position when closing
              onClose()
            }}
            className="text-[#B8001F] hover:text-red-700 text-lg font-bold"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-3">
          {/* Wet Signal Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">WET</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.wet.toFixed(2)}</span>
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
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${config.wet * 100}%, #D1D5DB ${config.wet * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Depth Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">DEPTH</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.depth.toFixed(2)}</span>
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
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${config.depth * 100}%, #D1D5DB ${config.depth * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* LFO Beats Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">LFO</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.lfoBeats.toFixed(1)}</span>
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
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${(config.lfoBeats / 128) * 100}%, #D1D5DB ${(config.lfoBeats / 128) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* BPM Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">BPM</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.bpm}</span>
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
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.bpm - 40) / 210) * 100}%, #D1D5DB ${((config.bpm - 40) / 210) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Clipper Threshold Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">THRESH</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.clipperThresholdDb.toFixed(1)}dB</span>
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
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.clipperThresholdDb + 20) / 20) * 100}%, #D1D5DB ${((config.clipperThresholdDb + 20) / 20) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Clipper Maximum Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">MAX</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.clipperMaximumDb.toFixed(1)}dB</span>
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
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${(config.clipperMaximumDb / 20) * 100}%, #D1D5DB ${(config.clipperMaximumDb / 20) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#B8001F] font-mono">ENABLED</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => {
                const newConfig = { ...config, enabled: e.target.checked }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-4 h-4"
              style={{ accentColor: '#B8001F' }}
            />
          </div>

          {/* Stereo Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#B8001F] font-mono">STEREO</span>
            <input
              type="checkbox"
              checked={config.stereo}
              onChange={(e) => {
                const newConfig = { ...config, stereo: e.target.checked }
                setConfig(newConfig)
                if (onConfigChange) onConfigChange(newConfig)
              }}
              className="w-4 h-4"
              style={{ accentColor: '#B8001F' }}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={() => {
              setDragPosition(null) // Reset position when closing
              onClose()
            }}
            className="px-3 py-1 text-xs font-mono font-bold transition-all duration-200 hover:opacity-80"
            style={{
              backgroundColor: '#ccc',
              color: '#333',
              border: '1px solid #ccc'
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs font-mono font-bold transition-all duration-200 hover:opacity-80"
            style={{
              backgroundColor: '#B8001F',
              color: '#FCFAEE',
              border: '1px solid #B8001F'
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
