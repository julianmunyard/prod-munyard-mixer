'use client'

import React, { useEffect, useRef, useState } from 'react'
import RealTimelineMixerEngine from '../../audio/engine/realTimelineMixerEngine'
import FullWaveformScrubber from '../components/FullWaveformScrubber'
import DemoPage from '../demo/page'

export default function TimelineMixerPage() {
  const [theme, setTheme] = useState<string>('default')
  const [showThemeDropdown, setShowThemeDropdown] = useState(false)
  const mixerEngineRef = useRef<RealTimelineMixerEngine | null>(null)
  const [timelineReady, setTimelineReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [duration, setDuration] = useState<number>(0)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)

  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  // Initialize Timeline Engine
  useEffect(() => {
    const initializeTimeline = async () => {
      try {
        addDebugLog('🎵 Initializing Timeline Engine...')
        
        mixerEngineRef.current = new RealTimelineMixerEngine()
        await mixerEngineRef.current.init()
        
        // Set up timeline cursor updates
        mixerEngineRef.current.audioEngine.onTimelineFrameCursorUpdate = (cursor: number) => {
          setCurrentTime(cursor / 48000) // Convert samples to seconds
        }

        // Capture timeline duration when available
        mixerEngineRef.current.audioEngine.onTimelineDurationSet = (d: number) => {
          setDuration(d)
        }

        setTimelineReady(true)
        addDebugLog('✅ Timeline Engine ready!')
        
      } catch (error) {
        addDebugLog(`❌ Failed to initialize: ${error}`)
      }
    }

    initializeTimeline()
  }, [])

  const loadStems = async () => {
    if (!mixerEngineRef.current) return

    try {
      addDebugLog('🎵 Loading Millionaire stems...')
      
      // Millionaire stems for testing
      const testStems = [
        {
          name: "Bass",
          url: "/audio/Millionaire Stems LOOP/BASS.mp3",
          label: "Bass"
        },
        {
          name: "Drums", 
          url: "/audio/Millionaire Stems LOOP/DRUMS.mp3",
          label: "Drums"
        },
        {
          name: "Guitars",
          url: "/audio/Millionaire Stems LOOP/GUITARS.mp3", 
          label: "Guitars"
        },
        {
          name: "Synths",
          url: "/audio/Millionaire Stems LOOP/SYNTHS.mp3",
          label: "Synths"
        },
        {
          name: "Vocals",
          url: "/audio/Millionaire Stems LOOP/VOCALS.mp3",
          label: "Vocals"
        }
      ]

      await mixerEngineRef.current.loadStemsFromSupabase(testStems)
      // Optional: fetch one stem to draw waveform (first track)
      try {
        const res = await fetch(testStems[0].url)
        const arr = await res.arrayBuffer()
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const decoded = await ctx.decodeAudioData(arr.slice(0))
        setBuffer(decoded)
      } catch (e) {
        // ignore waveform preview errors
      }
      addDebugLog('✅ Stems loaded')
      
    } catch (error) {
      addDebugLog(`❌ Failed to load stems: ${error}`)
    }
  }

  const playAll = async () => {
    if (!mixerEngineRef.current || !timelineReady) return
    
    try {
      await mixerEngineRef.current.play()
      setIsPlaying(true)
      addDebugLog('▶️ Playback started')
    } catch (error) {
      addDebugLog(`❌ Failed to play: ${error}`)
    }
  }

  const pauseAll = () => {
    if (!mixerEngineRef.current) return
    
    try {
      mixerEngineRef.current.pause()
      setIsPlaying(false)
      addDebugLog('⏸️ Playback paused')
    } catch (error) {
      addDebugLog(`❌ Failed to pause: ${error}`)
    }
  }

  const stopAll = () => {
    if (!mixerEngineRef.current) return
    
    try {
      mixerEngineRef.current.stop()
      setIsPlaying(false)
      setCurrentTime(0)
      addDebugLog('⏹️ Playback stopped')
    } catch (error) {
      addDebugLog(`❌ Failed to stop: ${error}`)
    }
  }

  const handleScrub = (seconds: number) => {
    if (!mixerEngineRef.current) return
    mixerEngineRef.current.audioEngine.updateCursor(seconds)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showThemeDropdown && !target.closest('[data-theme-dropdown]')) {
        setShowThemeDropdown(false)
      }
    }

    if (showThemeDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showThemeDropdown])

  if (theme === 'demo') {
    return (
      <div style={{ position: 'relative' }}>
        {/* Theme Dropdown - positioned absolutely for demo theme */}
        <div style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          zIndex: 10000 
        }} data-theme-dropdown>
          <button
            onClick={() => setShowThemeDropdown(!showThemeDropdown)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1F2937',
              color: 'white',
              border: '1px solid #374151',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            THEME: {theme.toUpperCase()} ▼
          </button>
          {showThemeDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '4px',
                zIndex: 1000,
                minWidth: '120px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              {['default', 'demo'].map((themeOption) => (
                <div
                  key={themeOption}
                  onClick={() => {
                    setTheme(themeOption)
                    setShowThemeDropdown(false)
                  }}
                  style={{
                    padding: '0.5rem',
                    cursor: 'pointer',
                    backgroundColor: theme === themeOption ? '#374151' : '#1F2937',
                    color: 'white',
                  }}
                  onMouseEnter={(e) => {
                    if (theme !== themeOption) {
                      e.currentTarget.style.backgroundColor = '#374151'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (theme !== themeOption) {
                      e.currentTarget.style.backgroundColor = '#1F2937'
                    }
                  }}
                >
                  {themeOption.toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>
        <DemoPage />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Theme Dropdown */}
        <div className="mb-8 flex justify-center">
          <div style={{ position: 'relative' }} data-theme-dropdown>
            <button
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer"
            >
              THEME: {theme.toUpperCase()} ▼
            </button>
            {showThemeDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '8px',
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  zIndex: 1000,
                  minWidth: '120px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
              >
                {['default', 'demo'].map((themeOption) => (
                  <div
                    key={themeOption}
                    onClick={() => {
                      setTheme(themeOption)
                      setShowThemeDropdown(false)
                    }}
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      backgroundColor: theme === themeOption ? '#374151' : '#1F2937',
                    }}
                    onMouseEnter={(e) => {
                      if (theme !== themeOption) {
                        e.currentTarget.style.backgroundColor = '#374151'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (theme !== themeOption) {
                        e.currentTarget.style.backgroundColor = '#1F2937'
                      }
                    }}
                  >
                    {themeOption.toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-8 text-center">Timeline Mixer</h1>
        
        {/* Controls */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={loadStems}
            disabled={!timelineReady}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
          >
            Load Stems
          </button>
          
          <button
            onClick={playAll}
            disabled={!timelineReady}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
          >
            ▶️ Play
          </button>
          
          <button
            onClick={pauseAll}
            disabled={!timelineReady}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
          >
            ⏸️ Pause
          </button>
          
          <button
            onClick={stopAll}
            disabled={!timelineReady}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
          >
            ⏹️ Stop
          </button>
        </div>

        {/* Scrubber */}
        <div className="flex justify-center mb-6">
          {duration > 0 && buffer ? (
            <FullWaveformScrubber
              buffer={buffer}
              duration={duration}
              position={currentTime % Math.max(0.0001, duration)}
              onScrub={handleScrub}
            />
          ) : duration > 0 ? (
            <div className="w-full max-w-xl px-4">
              <input
                type="range"
                min={0}
                max={duration}
                step={0.01}
                value={currentTime % Math.max(0.0001, duration)}
                onChange={(e) => handleScrub(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-center text-sm opacity-70 mt-1">Scrub (waveform loading...)</div>
            </div>
          ) : null}
        </div>

        {/* Status */}
        <div className="text-center mb-8">
          <p className="text-lg">
            Status: {timelineReady ? '✅ Ready' : '⏳ Loading...'}
          </p>
          <p className="text-sm opacity-70">
            Current Time: {currentTime.toFixed(2)}s
          </p>
        </div>

        {/* Debug Logs */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Debug Logs</h3>
          <div className="space-y-1 text-sm font-mono">
            {debugLogs.map((log, index) => (
              <div key={index} className="text-green-400">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
