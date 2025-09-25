'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

// ==================== 📦 Imports ====================
import React, { useEffect, useRef, useState, ChangeEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import DelayKnob from '../../../components/DelayKnob'
import ReverbConfigModal from '../../../components/ReverbConfigModal'
import { useParams } from 'next/navigation'
import VarispeedSlider from '../../../components/VarispeedSlider'
import TransparentMixerLayout from '../../../components/TransparentMixerLayout'
import FullWaveformScrubber from '../../../components/FullWaveformScrubber'
import RealTimelineMixerEngine from '../../../audio/engine/realTimelineMixerEngine'

// ==================== 🧾 Types ====================
type Song = {
  id: string
  title: string
  artist_name: string
  artist_slug: string
  song_slug: string
  bpm: number
  effects: string[] | string
  stems: { label: string; file: string }[] | string
  color: string
  background_video?: string
  primary_color?: string
}

export type Stem = {
  label: string
  file: string
}

// ==================== 🎵 Timeline Mixer Page ====================
export default function TimelineMixerPage() {
  const params = useParams()
  const artist = params.artist as string
  const songSlug = params.songSlug as string

  // ==================== 🎵 Timeline Engine ====================
  const mixerEngineRef = useRef<RealTimelineMixerEngine | null>(null)
  const [timelineReady, setTimelineReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // ==================== 🎵 Song Data ====================
  const [songData, setSongData] = useState<Song | null>(null)
  const [stems, setStems] = useState<Stem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ==================== 🎵 UI State ====================
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  // ==================== 🎵 Load Song Data ====================
  useEffect(() => {
    const loadSongData = async () => {
      try {
        setLoading(true)
        
        // Load song data from Supabase
        const { data: song, error: songError } = await supabase
          .from('songs')
          .select('*')
          .eq('artist_slug', artist)
          .eq('song_slug', songSlug)
          .single()

        if (songError) throw songError
        if (!song) throw new Error('Song not found')

        setSongData(song)

        // Parse stems
        const parsedStems = typeof song.stems === 'string' 
          ? JSON.parse(song.stems) 
          : song.stems

        setStems(parsedStems)
        setError(null)
      } catch (err) {
        console.error('Error loading song:', err)
        setError(err instanceof Error ? err.message : 'Failed to load song')
      } finally {
        setLoading(false)
      }
    }

    if (artist && songSlug) {
      loadSongData()
    }
  }, [artist, songSlug])

  // ==================== 🎵 Initialize Timeline Engine ====================
  useEffect(() => {
    const initializeTimeline = async () => {
      if (!stems.length) return

      try {
        console.log('🎵 Initializing Timeline Engine...')
        
        mixerEngineRef.current = new RealTimelineMixerEngine()
        await mixerEngineRef.current.init()
        
        // Set up timeline cursor updates
        mixerEngineRef.current.audioEngine.onTimelineFrameCursorUpdate = (cursor: number) => {
          setCurrentTime(cursor / 48000) // Convert samples to seconds
        }

        // Load stems into timeline
        const stemData = stems.map(stem => ({
          name: stem.label,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/stems/${stem.file}`,
          label: stem.label
        }))

        await mixerEngineRef.current.loadStemsFromSupabase(stemData)
        
        setTimelineReady(true)
        console.log('✅ Timeline Engine ready!')
        
      } catch (error) {
        console.error('❌ Failed to initialize timeline:', error)
        setError('Failed to initialize audio engine')
      }
    }

    initializeTimeline()
  }, [stems])

  // ==================== 🎵 Playback Functions ====================
  const playAll = async () => {
    if (!mixerEngineRef.current || !timelineReady) return
    
    try {
      await mixerEngineRef.current.play()
      setIsPlaying(true)
      console.log('▶️ Playback started')
    } catch (error) {
      console.error('❌ Failed to play:', error)
    }
  }

  const pauseAll = () => {
    if (!mixerEngineRef.current) return
    
    try {
      mixerEngineRef.current.pause()
      setIsPlaying(false)
      console.log('⏸️ Playback paused')
    } catch (error) {
      console.error('❌ Failed to pause:', error)
    }
  }

  const stopAll = () => {
    if (!mixerEngineRef.current) return
    
    try {
      mixerEngineRef.current.stop()
      setIsPlaying(false)
      setCurrentTime(0)
      console.log('⏹️ Playback stopped')
    } catch (error) {
      console.error('❌ Failed to stop:', error)
    }
  }

  // ==================== 🎵 Keyboard Controls ====================
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        if (isPlaying) {
          pauseAll()
        } else {
          playAll()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying])

  // ==================== 🎵 Loading State ====================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading song...</p>
        </div>
      </div>
    )
  }

  // ==================== 🎵 Error State ====================
  if (error || !songData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {error || 'Song not found'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ==================== 🎵 Render ====================
  const primary = songData.primary_color || songData.color || '#ffffff'
  const background = songData.background_video

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FCFAEE' }}>
      {/* Background Video */}
      {background && (
        <video
          src={background}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: -1,
            opacity: 0.3
          }}
        />
      )}

      {/* Main Content */}
      <div className="relative z-10" style={{ padding: isMobile ? '0 16px' : '0' }}>
        {/* Header */}
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
          {songData.title}
        </h1>

        {/* ▶️ Playback Controls */}
        <div className={`flex justify-center mb-2 ${isMobile ? 'gap-4' : 'gap-8'} ${isMobile ? 'px-4' : ''}`}>
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
            {timelineReady ? 'Play' : 'Loading...'}
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

        {/* Timeline Scrubber */}
        {timelineReady && (
          <div className="mb-8">
            <FullWaveformScrubber
              currentTime={currentTime}
              duration={duration}
              onSeek={(time) => {
                if (mixerEngineRef.current) {
                  mixerEngineRef.current.seek(time)
                }
              }}
              color={primary}
            />
          </div>
        )}

        {/* 🎚️ Mixer Modules - Exact UI from your original */}
        <div
          className="stems-container"
          style={{
            width: '100%',
            height: isMobile ? '420px' : 'auto',
            maxHeight: isMobile ? '420px' : 'none',
            marginTop: '-20px', // Move mixer modules up closer to timestamp
          }}
        >
          <div
            className={`flex ${isMobile ? 'gap-2' : stems.length >= 6 ? 'gap-4' : 'gap-8'} ${isMobile ? 'overflow-x-auto stems-container' : ''}`}
            style={{
              width: '100%',
              maxWidth: isMobile ? '100vw' : 'none',
              justifyContent: isMobile ? 'flex-start' : 'center',
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

                {/* Reverb Knob */}
                <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                  <div className="flex flex-col items-center text-xs select-none" style={{ color: 'white' }}>
                    <span 
                      className="mb-1 cursor-pointer hover:opacity-75"
                      style={{ fontSize: '10px' }}
                    >
                      REVERB
                    </span>
                    <DelayKnob
                      value={0}
                      onChange={(val) => {
                        // TODO: Connect to timeline system
                        console.log(`Reverb for ${stem.label}:`, val)
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

                {/* Label */}
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

        {/* Status */}
        <div className="text-center mt-8 text-sm opacity-70">
          {timelineReady ? (
            <p>Timeline Engine Ready • Press SPACE to play/pause</p>
          ) : (
            <p>Initializing Timeline Engine...</p>
          )}
        </div>
      </div>
    </div>
  )
}
