'use client'

import React, { useEffect, useRef, useState } from 'react'
import RealTimelineMixerEngine from '../../audio/engine/realTimelineMixerEngine'
import { supabase } from '../../lib/supabaseClient'

export default function TestRedModulesPage() {
  const mixerEngineRef = useRef<RealTimelineMixerEngine | null>(null)
  const [timelineReady, setTimelineReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [loadedStems, setLoadedStems] = useState<any[]>([])

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
      setLoadedStems(testStems)
      addDebugLog('✅ Stems loaded')
      
    } catch (error) {
      addDebugLog(`❌ Failed to load stems: ${error}`)
    }
  }

  const loadStemsFromSupabase = async () => {
    if (!mixerEngineRef.current) return

    try {
      addDebugLog('🎵 Loading stems from Supabase...')
      
      // Real song from your database
      const artist = 'don'
      const songSlug = 'julia'
      
      // Load song data from Supabase
      const { data: song, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_slug', artist)
        .eq('song_slug', songSlug)
        .single()

      if (songError) {
        addDebugLog(`❌ Supabase error: ${songError.message}`)
        return
      }

      if (!song) {
        addDebugLog('❌ Song not found in database')
        return
      }

      addDebugLog(`✅ Found song: ${song.title} by ${song.artist_name}`)

      // Parse stems
      const parsedStems = typeof song.stems === 'string' 
        ? JSON.parse(song.stems) 
        : song.stems

      if (!parsedStems || !Array.isArray(parsedStems)) {
        addDebugLog('❌ No stems found in song data')
        return
      }

      addDebugLog(`✅ Found ${parsedStems.length} stems`)

      // Convert stems - file field already contains full Supabase URL
      const stemData = parsedStems.map(stem => ({
        name: stem.label,
        url: stem.file, // file field already contains full Supabase storage URL
        label: stem.label
      }))

      await mixerEngineRef.current.loadStemsFromSupabase(stemData)
      setLoadedStems(stemData)
      addDebugLog('✅ Supabase stems loaded into timeline')
      
    } catch (error) {
      addDebugLog(`❌ Failed to load Supabase stems: ${error}`)
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

  // Use loaded stems for dynamic modules
  const stems = loadedStems.length > 0 ? loadedStems : [
    { label: "Bass" },
    { label: "Drums" },
    { label: "Guitars" },
    { label: "Synths" },
    { label: "Vocals" }
  ]

  const primary = '#B8001F' // Exact red color from original
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FCFAEE' }}>
      <div className="max-w-6xl mx-auto" style={{ padding: isMobile ? '0 16px' : '0' }}>
        <h1 
          className="text-center font-bold"
          style={{ 
            color: primary,
            fontSize: isMobile ? '24px' : '32px',
            marginBottom: '8px',
            padding: isMobile ? '0 16px' : '0',
            fontFamily: 'monospace',
          }}
        >
          Red Modules Test
        </h1>
        
        {/* Controls */}
        <div className={`flex justify-center mb-2 ${isMobile ? 'gap-4' : 'gap-8'} ${isMobile ? 'px-4' : ''}`}>
          <button
            onClick={loadStems}
            disabled={!timelineReady}
            className={`pressable ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide flex items-center gap-2 transition-all duration-200 ${
              !timelineReady 
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-60' 
                : 'hover:opacity-90'
            }`}
            style={timelineReady ? { backgroundColor: primary, color: 'white' } : undefined}
          >
            Load Test Stems
          </button>

          <button
            onClick={loadStemsFromSupabase}
            disabled={!timelineReady}
            className={`pressable ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide flex items-center gap-2 transition-all duration-200 ${
              !timelineReady 
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-60' 
                : 'hover:opacity-90'
            }`}
            style={timelineReady ? { backgroundColor: primary, color: 'white' } : undefined}
          >
            Load from Supabase
          </button>
          
          <button
            onClick={playAll}
            disabled={!timelineReady}
            className={`pressable ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide flex items-center gap-2 transition-all duration-200 ${
              !timelineReady 
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-60' 
                : 'hover:opacity-90'
            }`}
            style={timelineReady ? { backgroundColor: primary, color: 'white' } : undefined}
          >
            Play
          </button>

          <button
            onClick={pauseAll}
            disabled={!timelineReady}
            className={`pressable text-white ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide`}
            style={{ backgroundColor: primary }}
          >
            Pause
          </button>
          
          <button
            onClick={() => {
              // TODO: Add unsolo functionality
              console.log('Unsolo all')
            }}
            className={`pressable text-white ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide`}
            style={{ backgroundColor: primary }}
          >
            UNSOLO
          </button>
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

        {/* Red Module UI - Stems Container */}
        <div
          className="stems-container"
          style={{
            width: '100%',
            height: isMobile ? '420px' : 'auto',
            maxHeight: isMobile ? '420px' : 'none',
            marginTop: '-20px',
            overflowX: 'auto', // Enable horizontal scrolling
            overflowY: 'hidden',
          }}
        >
          <div
            className={`flex ${isMobile ? 'gap-2' : stems.length >= 6 ? 'gap-4' : 'gap-8'}`}
            style={{
              width: 'max-content', // Allow container to grow with content
              minWidth: '100%', // But at least full width
              justifyContent: 'flex-start', // Always start from left
              flexWrap: 'nowrap',
              margin: '0 auto',
              padding: isMobile ? '0 8px' : '0 8px',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
              overflowY: 'hidden',
              height: '100%',
              alignItems: 'center',
            }}
          >
            {stems.map((stem) => (
              <div
                key={stem.label}
                className="mixer-module"
                style={{
                  width: isMobile ? '80px' : stems.length >= 6 ? '86px' : '96px',
                  backgroundColor: primary,
                  border: '1px solid #444',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
                  borderRadius: '10px',
                  padding: isMobile ? '12px' : '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: isMobile ? '420px' : undefined,
                  justifyContent: 'flex-start',
                  flexShrink: 0,
                  minWidth: isMobile ? '80px' : 'auto',
                }}
              >
                <div style={{ width: '16px', height: isMobile ? '30px' : '40px', marginBottom: isMobile ? '16px' : '18px' }} />

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    fontSize: '10px',
                    color: 'white',
                    flexGrow: 1,
                    justifyContent: 'center',
                    marginBottom: isMobile ? '20px' : '30px',
                  }}
                >
                  <span style={{ marginBottom: '4px' }}>LEVEL</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      defaultValue="1"
                      className="volume-slider"
                      style={{
                        writingMode: 'bt-lr' as any,
                        WebkitAppearance: 'slider-vertical',
                        width: '4px',
                        height: isMobile ? '140px' : undefined,
                        background: 'transparent',
                      }}
                    />
                  </div>
                </div>

                {/* Mute & Solo */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      // TODO: Connect to timeline system
                      console.log(`Mute ${stem.label}`)
                    }}
                    style={{ 
                      fontSize: '12px', 
                      padding: '4px 10px', 
                      borderRadius: '4px', 
                      marginBottom: '8px',
                      backgroundColor: '#FCFAEE',
                      color: primary,
                      border: `1px solid ${primary}`,
                      cursor: 'pointer',
                    }}
                  >
                    MUTE
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Connect to timeline system
                      console.log(`Solo ${stem.label}`)
                    }}
                    style={{ 
                      fontSize: '12px', 
                      padding: '4px 10px', 
                      borderRadius: '4px', 
                      marginBottom: '8px',
                      backgroundColor: '#FCFAEE',
                      color: primary,
                      border: `1px solid ${primary}`,
                      cursor: 'pointer',
                    }}
                  >
                    SOLO
                  </button>
                </div>

                {/* Stem Label */}
                <div style={{ 
                  marginTop: 'auto', 
                  paddingTop: '16px',
                  fontSize: '10px',
                  color: 'white',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}>
                  {stem.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Debug Logs */}
        <div className="bg-gray-900 rounded-lg p-4 mt-8">
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
