'use client'

import React, { useState, useEffect, useRef } from 'react'

interface CompressorConfig {
  inputGainDb: number
  outputGainDb: number
  wet: number
  attackSec: number
  releaseSec: number
  ratio: number
  thresholdDb: number
  hpCutOffHz: number
  enabled: boolean
}

interface CompressorConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: CompressorConfig) => void
  onConfigChange?: (config: CompressorConfig) => void  // For real-time updates
  initialConfig?: CompressorConfig
  stemLabel?: string
  position?: { x: number; y: number }
}

const CompressorConfigModal: React.FC<CompressorConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onConfigChange,
  initialConfig = {
    inputGainDb: 0.0,
    outputGainDb: 4.8,
    wet: 1.0,
    attackSec: 0.003, // 3.0 ms
    releaseSec: 0.1, // 100 ms
    ratio: 3.0,
    thresholdDb: -34.1,
    hpCutOffHz: 1,
    enabled: true
  },
  stemLabel,
  position
}) => {
  const [config, setConfig] = useState<CompressorConfig>(initialConfig)
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

  const handleClose = () => {
    setDragPosition(null) // Reset position when closing
    onClose()
  }

  const handleSave = () => {
    setDragPosition(null) // Reset position when closing
    onSave(config)
    onClose()
  }

  const handleReset = () => {
    const resetConfig = {
      inputGainDb: 0.0,
      outputGainDb: 4.8,
      wet: 1.0,
      attackSec: 0.003, // 3.0 ms
      releaseSec: 0.1, // 100 ms
      ratio: 3.0,
      thresholdDb: -34.1,
      hpCutOffHz: 1,
      enabled: true
    }
    setConfig(resetConfig)
    onConfigChange?.(resetConfig)
  }

  if (!isOpen) return null

  return (
    <>
      <style jsx>{`
        .slider-horizontal::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #B8001F;
          cursor: pointer;
          border: 2px solid #FCFAEE;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .slider-horizontal::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #B8001F;
          cursor: pointer;
          border: 2px solid #FCFAEE;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
      <div 
        className="fixed inset-0 z-50 pointer-events-none"
        onClick={handleClose}
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
              COMPRESSOR
            </h2>
            <span className="text-xs text-[#B8001F] font-mono opacity-75">
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
            className="text-[#B8001F] hover:text-[#8B0015] text-xs font-bold touch-manipulation"
            style={{ minWidth: '24px', minHeight: '24px' }}
          >
            ×
          </button>
        </div>
        
        <div className="space-y-3">
          {/* Input Gain Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">INPUT GAIN</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.inputGainDb.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="-24"
              max="24"
              step="0.1"
              value={config.inputGainDb}
              onChange={(e) => {
                const newConfig = { ...config, inputGainDb: parseFloat(e.target.value) }
                setConfig(newConfig)
                onConfigChange?.(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.inputGainDb + 24) / 48) * 100}%, #D1D5DB ${((config.inputGainDb + 24) / 48) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Output Gain Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">OUTPUT GAIN</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.outputGainDb.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="-24"
              max="24"
              step="0.1"
              value={config.outputGainDb}
              onChange={(e) => {
                const newConfig = { ...config, outputGainDb: parseFloat(e.target.value) }
                setConfig(newConfig)
                onConfigChange?.(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.outputGainDb + 24) / 48) * 100}%, #D1D5DB ${((config.outputGainDb + 24) / 48) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Wet Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">WET</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.wet.toFixed(1)}</span>
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
                onConfigChange?.(newConfig)
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

          {/* Attack Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">ATTACK</span>
              <span className="text-xs text-[#B8001F] font-mono">{(config.attackSec * 1000).toFixed(1)} ms</span>
            </div>
            <input
              type="range"
              min="0.0001"
              max="1"
              step="0.0001"
              value={config.attackSec}
              onChange={(e) => {
                const newConfig = { ...config, attackSec: parseFloat(e.target.value) }
                setConfig(newConfig)
                onConfigChange?.(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.attackSec - 0.0001) / 0.9999) * 100}%, #D1D5DB ${((config.attackSec - 0.0001) / 0.9999) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Release Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">RELEASE</span>
              <span className="text-xs text-[#B8001F] font-mono">{(config.releaseSec * 1000).toFixed(0)} ms</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.01"
              value={config.releaseSec}
              onChange={(e) => {
                const newConfig = { ...config, releaseSec: parseFloat(e.target.value) }
                setConfig(newConfig)
                onConfigChange?.(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.releaseSec - 0.1) / 3.9) * 100}%, #D1D5DB ${((config.releaseSec - 0.1) / 3.9) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Ratio Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">RATIO</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.ratio.toFixed(1)}:1</span>
            </div>
            <input
              type="range"
              min="1.5"
              max="10"
              step="0.5"
              value={config.ratio}
              onChange={(e) => {
                const newConfig = { ...config, ratio: parseFloat(e.target.value) }
                setConfig(newConfig)
                onConfigChange?.(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.ratio - 1.5) / 8.5) * 100}%, #D1D5DB ${((config.ratio - 1.5) / 8.5) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Threshold Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">THRESHOLD</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.thresholdDb.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="-40"
              max="0"
              step="0.1"
              value={config.thresholdDb}
              onChange={(e) => {
                const newConfig = { ...config, thresholdDb: parseFloat(e.target.value) }
                setConfig(newConfig)
                onConfigChange?.(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.thresholdDb + 40) / 40) * 100}%, #D1D5DB ${((config.thresholdDb + 40) / 40) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* HP Cutoff Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold text-[#B8001F] font-mono">HP CUTOFF</span>
              <span className="text-xs text-[#B8001F] font-mono">{config.hpCutOffHz.toFixed(0)} Hz</span>
            </div>
            <input
              type="range"
              min="1"
              max="10000"
              step="1"
              value={config.hpCutOffHz}
              onChange={(e) => {
                const newConfig = { ...config, hpCutOffHz: parseFloat(e.target.value) }
                setConfig(newConfig)
                onConfigChange?.(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, #B8001F 0%, #B8001F ${((config.hpCutOffHz - 1) / 9999) * 100}%, #D1D5DB ${((config.hpCutOffHz - 1) / 9999) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-center space-x-2 p-3">
            <span className="text-xs font-bold text-[#B8001F] font-mono">ENABLED</span>
            <button
              onClick={() => {
                const newConfig = { ...config, enabled: !config.enabled }
                setConfig(newConfig)
                onConfigChange?.(newConfig)
              }}
              className={`w-12 h-6 rounded-full transition-colors ${
                config.enabled ? 'bg-[#B8001F]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#B8001F] text-[#FCFAEE] rounded font-mono text-xs hover:bg-[#8B0015] transition-colors"
            >
              SAVE
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

export default CompressorConfigModal