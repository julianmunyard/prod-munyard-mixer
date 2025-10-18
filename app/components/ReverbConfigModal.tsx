'use client'

import { useState, useEffect, useRef } from 'react'

interface ReverbConfig {
  mix: number
  width: number
  damp: number
  roomSize: number
  predelayMs: number
  lowCutHz: number
  enabled: boolean
}

interface ReverbConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: ReverbConfig) => void
  initialConfig: ReverbConfig
  stemLabel: string
  position?: { x: number; y: number }
  primaryColor?: string
}

export default function ReverbConfigModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialConfig, 
  stemLabel,
  position,
  primaryColor = '#B8001F'
}: ReverbConfigModalProps) {
  const [config, setConfig] = useState<ReverbConfig>(initialConfig)
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
        
        // Constrain initial position to screen edges
        initialX = Math.max(0, Math.min(initialX, windowWidth - modalWidth))
        initialY = Math.max(0, Math.min(initialY, windowHeight - modalHeight))
        
        setDragPosition({ x: initialX, y: initialY })
      }
    }
  }, [isOpen, initialConfig, position, dragPosition])

  const handleStart = (clientX: number, clientY: number) => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect()
      setDragOffset({
        x: clientX - rect.left,
        y: clientY - rect.top
      })
      setIsDragging(true)
    }
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (isDragging && modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect()
      const modalWidth = rect.width
      const modalHeight = rect.height
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      
      // Calculate new position with edge constraints
      let newX = clientX - dragOffset.x
      let newY = clientY - dragOffset.y
      
      // Constrain to screen edges
      newX = Math.max(0, Math.min(newX, windowWidth - modalWidth))
      newY = Math.max(0, Math.min(newY, windowHeight - modalHeight))
      
      setDragPosition({ x: newX, y: newY })
    }
  }

  const handleEnd = () => {
    setIsDragging(false)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: MouseEvent) => {
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
    onClose()
  }

  const handleReset = () => {
    const resetConfig = {
      mix: 0.4,
      width: 1.0,
      damp: 0.5,
      roomSize: 0.8,
      predelayMs: 0,
      lowCutHz: 0,
      enabled: true
    }
    setConfig(resetConfig)
    onSave(resetConfig)
  }

  return (
    <>
      <style jsx>{`
        .slider-horizontal::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${primaryColor} !important;
          cursor: pointer;
          border: 2px solid #FCFAEE !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .slider-horizontal::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${primaryColor} !important;
          cursor: pointer;
          border: 2px solid #FCFAEE !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
      <div 
        className="fixed inset-0 z-50 pointer-events-none"
        onClick={() => {
          setDragPosition(null) // Reset position when closing
          onClose()
        }}
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
              REVERB
            </h2>
            <span className="text-xs font-mono opacity-75" style={{ color: primaryColor }}>
              {stemLabel}
            </span>
          </div>
          <button
            onClick={() => {
              setDragPosition(null) // Reset position when closing
              onClose()
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragPosition(null) // Reset position when closing
              onClose()
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
          {/* Pre-delay Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>PREDELAY</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.predelayMs.toFixed(0)}ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={config.predelayMs}
              onChange={(e) => {
                const newConfig = { ...config, predelayMs: parseFloat(e.target.value) }
                setConfig(newConfig)
                onSave(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${(config.predelayMs / 200) * 100}%, #D1D5DB ${(config.predelayMs / 200) * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Width Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>WIDTH</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.width.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.width}
              onChange={(e) => {
                const newConfig = { ...config, width: parseFloat(e.target.value) }
                setConfig(newConfig)
                onSave(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${config.width * 100}%, #D1D5DB ${config.width * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Dampening Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>DAMP</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.damp.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.damp}
              onChange={(e) => {
                const newConfig = { ...config, damp: parseFloat(e.target.value) }
                setConfig(newConfig)
                onSave(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${config.damp * 100}%, #D1D5DB ${config.damp * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Room Size Control */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between items-center mb-2 w-full">
              <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>ROOM</span>
              <span className="text-xs font-mono" style={{ color: primaryColor }}>{config.roomSize.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.roomSize}
              onChange={(e) => {
                const newConfig = { ...config, roomSize: parseFloat(e.target.value) }
                setConfig(newConfig)
                onSave(newConfig)
              }}
              className="w-full h-2 bg-gray-300 rounded appearance-none cursor-pointer slider-horizontal"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${config.roomSize * 100}%, #D1D5DB ${config.roomSize * 100}%, #D1D5DB 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold font-mono" style={{ color: primaryColor }}>ENABLED</span>
            <button
              onClick={() => {
                const newConfig = { ...config, enabled: !config.enabled }
                setConfig(newConfig)
                onSave(newConfig)
              }}
              className={`w-6 h-3 rounded-full transition-colors border`}
              style={{
                backgroundColor: config.enabled ? primaryColor : '#FCFAEE',
                borderColor: primaryColor
              }}
            >
              <div
                className={`w-2 h-2 bg-[#FCFAEE] rounded-full transition-transform ${
                  config.enabled ? 'translate-x-3' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-3">
          <button
            onClick={handleReset}
            className="px-3 py-1 text-xs rounded transition-colors font-mono font-bold"
            style={{
              backgroundColor: '#FCFAEE',
              color: primaryColor,
              border: `1px solid ${primaryColor}`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = primaryColor;
              e.currentTarget.style.color = '#FCFAEE';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FCFAEE';
              e.currentTarget.style.color = primaryColor;
            }}
          >
            RESET
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs rounded transition-colors font-mono font-bold"
            style={{
              backgroundColor: primaryColor,
              color: '#FCFAEE'
            }}
            onMouseEnter={(e) => {
              const rgb = primaryColor.match(/\d+/g);
              if (rgb) {
                const r = Math.max(0, parseInt(rgb[0]) - 30);
                const g = Math.max(0, parseInt(rgb[1]) - 30);
                const b = Math.max(0, parseInt(rgb[2]) - 30);
                e.currentTarget.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = primaryColor;
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
