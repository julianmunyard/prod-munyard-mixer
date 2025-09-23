'use client'

import { useState, useEffect } from 'react'

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
}

export default function ReverbConfigModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialConfig, 
  stemLabel 
}: ReverbConfigModalProps) {
  const [config, setConfig] = useState<ReverbConfig>(initialConfig)

  useEffect(() => {
    if (isOpen) {
      setConfig(initialConfig)
    }
  }, [isOpen, initialConfig.mix, initialConfig.width, initialConfig.damp, initialConfig.roomSize, initialConfig.predelayMs, initialConfig.lowCutHz, initialConfig.enabled])

  if (!isOpen) return null

  const handleSave = () => {
    onSave(config)
    onClose()
  }

  const handleReset = () => {
    setConfig({
      mix: 0.4,
      width: 1.0,
      damp: 0.5,
      roomSize: 0.8,
      predelayMs: 0,
      lowCutHz: 0,
      enabled: true
    })
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 pointer-events-auto"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-lg p-4 w-80 max-w-[90vw] mx-4 shadow-2xl border border-gray-700 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">
            Reverb - {stemLabel}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {/* Mix Control */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-300 w-20">
              MIX: {config.mix.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.mix}
              onChange={(e) => setConfig({ ...config, mix: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ml-2"
            />
          </div>

          {/* Width Control */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-300 w-20">
              WIDTH: {config.width.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.width}
              onChange={(e) => setConfig({ ...config, width: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ml-2"
            />
          </div>

          {/* Dampening Control */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-300 w-20">
              DAMP: {config.damp.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.damp}
              onChange={(e) => setConfig({ ...config, damp: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ml-2"
            />
          </div>

          {/* Room Size Control */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-300 w-20">
              ROOM: {config.roomSize.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.roomSize}
              onChange={(e) => setConfig({ ...config, roomSize: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ml-2"
            />
          </div>

          {/* Pre-delay Control */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-300 w-20">
              DELAY: {config.predelayMs}ms
            </label>
            <input
              type="range"
              min="0"
              max="500"
              step="1"
              value={config.predelayMs}
              onChange={(e) => setConfig({ ...config, predelayMs: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ml-2"
            />
          </div>

          {/* Low Cut Control */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-300 w-20">
              CUT: {config.lowCutHz}Hz
            </label>
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={config.lowCutHz}
              onChange={(e) => setConfig({ ...config, lowCutHz: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ml-2"
            />
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-300">
              ENABLED
            </label>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`w-10 h-5 rounded-full transition-colors ${
                config.enabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  config.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>
          <div className="space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
