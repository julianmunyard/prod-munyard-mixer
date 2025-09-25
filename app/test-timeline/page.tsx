'use client'

import React, { useEffect, useRef, useState } from 'react'
import { RealTimelineMixerEngine } from '../../audio/engine/realTimelineMixerEngine'

export default function TestTimelinePage() {
  const mixerEngineRef = useRef<RealTimelineMixerEngine | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  const addDebugLog = (message: string) => {
    console.log(message)
    setDebugLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    const initializeTimeline = async () => {
      try {
        addDebugLog("🎵 Initializing Timeline MixerEngine...")
        
        const mixerEngine = new RealTimelineMixerEngine({
          masterVolume: 1.0,
          sampleRate: 48000,
          bufferSize: 128
        })
        
        mixerEngineRef.current = mixerEngine
        
        // Initialize the audio engine
        await mixerEngine.init()
        
        // Set up timeline cursor updates
        mixerEngine.audioEngine.onTimelineFrameCursorUpdate = (timelineFrameCursor) => {
          const timeInSeconds = timelineFrameCursor / 48000
          setCurrentTime(timeInSeconds)
        }
        
        addDebugLog("✅ Timeline MixerEngine initialized")
        setIsReady(true)
        
      } catch (error) {
        addDebugLog(`❌ Failed to initialize: ${error}`)
        console.error("Failed to initialize timeline:", error)
      }
    }

    initializeTimeline()

    return () => {
      if (mixerEngineRef.current) {
        mixerEngineRef.current.dispose()
      }
    }
  }, [])

  const loadTestStems = async () => {
    if (!mixerEngineRef.current) return

    try {
      addDebugLog("🎵 Loading test stems...")
      
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
      addDebugLog("✅ Test stems loaded")
      
    } catch (error) {
      addDebugLog(`❌ Failed to load stems: ${error}`)
      console.error("Failed to load stems:", error)
    }
  }

  const handlePlay = async () => {
    if (!mixerEngineRef.current) return

    try {
      await mixerEngineRef.current.play()
      setIsPlaying(true)
      addDebugLog("▶️ Playback started")
    } catch (error) {
      addDebugLog(`❌ Failed to play: ${error}`)
    }
  }

  const handlePause = () => {
    if (!mixerEngineRef.current) return

    mixerEngineRef.current.pause()
    setIsPlaying(false)
    addDebugLog("⏸️ Playback paused")
  }

  const handleStop = () => {
    if (!mixerEngineRef.current) return

    mixerEngineRef.current.stop()
    setIsPlaying(false)
    setCurrentTime(0)
    addDebugLog("⏹️ Playback stopped")
  }

  const handleSeek = (time: number) => {
    if (!mixerEngineRef.current) return

    mixerEngineRef.current.seek(time)
    addDebugLog(`⏭️ Seeked to ${time.toFixed(2)}s`)
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🎵 Timeline System Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Status</h2>
        <p>Ready: {isReady ? '✅' : '❌'}</p>
        <p>Playing: {isPlaying ? '▶️' : '⏸️'}</p>
        <p>Current Time: {currentTime.toFixed(2)}s</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Controls</h2>
        <button onClick={loadTestStems} disabled={!isReady} style={{ marginRight: '10px' }}>
          Load Test Stems
        </button>
        <button onClick={handlePlay} disabled={!isReady || isPlaying} style={{ marginRight: '10px' }}>
          Play
        </button>
        <button onClick={handlePause} disabled={!isReady || !isPlaying} style={{ marginRight: '10px' }}>
          Pause
        </button>
        <button onClick={handleStop} disabled={!isReady} style={{ marginRight: '10px' }}>
          Stop
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Seek</h2>
        <input
          type="range"
          min="0"
          max="30"
          step="0.1"
          value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          style={{ width: '300px' }}
        />
        <span style={{ marginLeft: '10px' }}>{currentTime.toFixed(1)}s</span>
      </div>

      <div>
        <h2>Debug Logs</h2>
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '10px', 
          borderRadius: '5px',
          height: '200px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          {debugLogs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
