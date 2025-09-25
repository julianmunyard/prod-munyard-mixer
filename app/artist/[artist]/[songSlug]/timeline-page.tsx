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
import FlangerConfigModal from '../../../components/FlangerConfigModal'
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
  
  // ==================== 🎛️ Reverb Modal State ====================
  const [reverbModalOpen, setReverbModalOpen] = useState(false)
  const [reverbModalStem, setReverbModalStem] = useState<Stem | null>(null)
  const [reverbModalStemIndex, setReverbModalStemIndex] = useState<number>(0)

  // ==================== 🎛️ Flanger Modal State ====================
  const [flangerModalOpen, setFlangerModalOpen] = useState(false)
  const [flangerModalStem, setFlangerModalStem] = useState<Stem | null>(null)
  const [flangerModalStemIndex, setFlangerModalStemIndex] = useState<number>(0)
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
            {stems.map((stem, stemIndex) => (
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
                      onChange={(e) => {
                        if (mixerEngineRef.current && timelineReady) {
                          mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                            type: "command",
                            data: { 
                              command: "setTrackVolume", 
                              trackId: `track_${stemIndex}`,
                              volume: parseFloat(e.target.value)
                            }
                          });
                        }
                        console.log(`Volume for ${stem.label}:`, e.target.value)
                      }}
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
                <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                  <div className="flex flex-col items-center text-xs select-none" style={{ color: 'white' }}>
                    <span 
                      className="mb-1 cursor-pointer hover:opacity-75"
                      style={{ fontSize: '10px' }}
                      onClick={() => {
                        console.log('🎛️ Opening reverb modal for stem:', stem.label, 'index:', stemIndex);
                        setReverbModalOpen(true);
                        setReverbModalStem(stem);
                        setReverbModalStemIndex(stemIndex);
                      }}
                    >
                      REVERB
                    </span>
                    <DelayKnob
                      value={0}
                      onChange={(val) => {
                        if (mixerEngineRef.current && timelineReady) {
                          mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                            type: "command",
                            data: { 
                              command: "setReverbMix", 
                              trackId: `track_${stemIndex}`,
                              mix: val
                            }
                          });
                        }
                        console.log(`Reverb for ${stem.label}:`, val)
                      }}
                    />
                    
                    {/* Pre-Delay Control */}
                    <div className="flex flex-col items-center text-xs select-none" style={{ color: 'white', marginTop: '8px' }}>
                      <span className="mb-1" style={{ fontSize: '10px' }}>PRE-DELAY</span>
                      <input
                        type="range"
                        min="0"
                        max="500"
                        step="10"
                        defaultValue="0"
                        className="w-16 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                        style={{ 
                          background: 'linear-gradient(to right, #B8001F 0%, #B8001F 0%, #ccc 0%, #ccc 100%)',
                          outline: 'none'
                        }}
                        onChange={(e) => {
                          if (mixerEngineRef.current && timelineReady) {
                            mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                              type: "command",
                              data: { 
                                command: "setReverbPredelay", 
                                trackId: `track_${stemIndex}`,
                                predelayMs: parseFloat(e.target.value)
                              }
                            });
                          }
                          console.log(`Pre-delay for ${stem.label}:`, e.target.value + 'ms')
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Flanger Button */}
                <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      console.log('🎛️ Opening flanger modal for stem:', stem.label, 'index:', stemIndex);
                      setFlangerModalOpen(true);
                      setFlangerModalStem(stem);
                      setFlangerModalStemIndex(stemIndex);
                    }}
                    style={{ 
                      fontSize: '12px', 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      marginBottom: '8px',
                      backgroundColor: '#FF0000',
                      color: 'white',
                      border: '2px solid #FF0000',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                  >
                    FLANGE
                  </button>
                </div>

                {/* Mute & Solo */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      if (mixerEngineRef.current && timelineReady) {
                        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                          type: "command",
                          data: { 
                            command: "setTrackMute", 
                            trackId: `track_${stemIndex}`,
                            muted: true
                          }
                        });
                      }
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
                      if (mixerEngineRef.current && timelineReady) {
                        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                          type: "command",
                          data: { 
                            command: "setTrackSolo", 
                            trackId: `track_${stemIndex}`,
                            soloed: true
                          }
                        });
                      }
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

        {/* Varispeed and Flanger Controls */}
        {timelineReady && (
          <div className="flex justify-center items-center gap-8 mt-8">
            {/* Varispeed Slider */}
            <div className="flex flex-col items-center">
              <VarispeedSlider
                value={1.0}
                onChange={(val) => {
                  if (mixerEngineRef.current && timelineReady) {
                    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                      type: "command",
                      data: { 
                        command: "setVarispeed", 
                        speed: val,
                        isNatural: false
                      }
                    });
                  }
                  console.log('Varispeed changed to:', val)
                }}
                isIOS={false}
                primaryColor={primary}
                bpm={songData.bpm}
                stemCount={stems.length}
                varispeedMode="timeStretch"
                onVarispeedModeChange={(mode) => {
                  console.log('Varispeed mode changed to:', mode)
                }}
              />
            </div>

            {/* Global Flanger Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => {
                  console.log('🎛️ Toggling global flanger');
                  if (mixerEngineRef.current && timelineReady) {
                    // Toggle global flanger enabled state
                    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                      type: "trackControl",
                      data: { 
                        control: "globalFlangerEnabled",
                        value: true  // Enable global flanger
                      }
                    });
                    
                    // Set some default global flanger parameters
                    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                      type: "trackControl",
                      data: { 
                        control: "globalFlanger",
                        value: 0.7  // Wet signal
                      }
                    });
                    
                    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                      type: "trackControl",
                      data: { 
                        control: "globalFlangerDepth",
                        value: 0.16  // Depth
                      }
                    });
                    
                    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                      type: "trackControl",
                      data: { 
                        control: "globalFlangerBpm",
                        value: songData.bpm || 128  // BPM
                      }
                    });
                  }
                }}
                className="px-8 py-4 rounded-lg font-mono text-lg font-bold transition-all duration-200 hover:opacity-80"
                style={{
                  backgroundColor: '#FF0000',
                  color: 'white',
                  border: '3px solid #FF0000',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                }}
              >
                FLANGE
              </button>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="text-center mt-8 text-sm opacity-70">
          {timelineReady ? (
            <p>Timeline Engine Ready • Press SPACE to play/pause</p>
          ) : (
            <p>Initializing Timeline Engine...</p>
          )}
        </div>
      </div>


      {/* Reverb Configuration Modal */}
      {reverbModalOpen && reverbModalStem && (
        <ReverbConfigModal
          isOpen={reverbModalOpen}
          onClose={() => setReverbModalOpen(false)}
          onSave={(config) => {
            console.log('🎛️ Reverb config saved:', config);
            if (mixerEngineRef.current && timelineReady) {
              console.log(`🎛️ Setting reverb for track ${reverbModalStemIndex}:`, config);
              
              // Use the old command system that works
              mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                type: "command",
                data: { 
                  command: "setReverbMix", 
                  trackId: `track_${reverbModalStemIndex}`,
                  mix: config.mix
                }
              });
              
              mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                type: "command",
                data: { 
                  command: "setReverbRoomSize", 
                  trackId: `track_${reverbModalStemIndex}`,
                  roomSize: config.roomSize
                }
              });
              
              console.log('🎛️ Sending setReverbPredelay command:', {
                command: "setReverbPredelay", 
                trackId: `track_${reverbModalStemIndex}`,
                predelayMs: config.predelayMs
              });
              mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                type: "command",
                data: { 
                  command: "setReverbPredelay", 
                  trackId: `track_${reverbModalStemIndex}`,
                  predelayMs: config.predelayMs
                }
              });
              
              mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                type: "command",
                data: { 
                  command: "setReverbWidth", 
                  trackId: `track_${reverbModalStemIndex}`,
                  width: config.width
                }
              });
              
              mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                type: "command",
                data: { 
                  command: "setReverbDamp", 
                  trackId: `track_${reverbModalStemIndex}`,
                  damp: config.damp
                }
              });
            }
            setReverbModalOpen(false);
          }}
          initialConfig={{
            mix: 0,
            width: 1,
            damp: 0.5,
            roomSize: 0.8,
            predelayMs: 0,
            lowCutHz: 0,
            enabled: true
          }}
          stemLabel={reverbModalStem.label}
        />
      )}

      {/* Flanger Configuration Modal */}
      {flangerModalOpen && flangerModalStem && (
        <FlangerConfigModal
          isOpen={flangerModalOpen}
          onClose={() => setFlangerModalOpen(false)}
          onConfigChange={(config) => {
            // Real-time flanger updates
            if (mixerEngineRef.current && timelineReady) {
              mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                type: "trackControl",
                data: { 
                  command: "setFlangerConfig", 
                  trackId: `track_${flangerModalStemIndex}`,
                  config: config
                }
              });
            }
          }}
          onSave={(config) => {
            console.log('🎛️ Flanger config saved:', config);
            if (mixerEngineRef.current && timelineReady) {
              console.log(`🎛️ Setting flanger for track ${flangerModalStemIndex}:`, config);
              
              // Send flanger config to the audio engine for specific track
              mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                type: "command",
                data: { 
                  command: "setFlangerConfig", 
                  trackId: `track_${flangerModalStemIndex}`,
                  config: config
                }
              });
              
              // Also send individual parameter updates for real-time control
              mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                type: "trackControl",
                data: { 
                  command: "setFlangerConfig", 
                  trackId: `track_${flangerModalStemIndex}`,
                  config: config
                }
              });
            }
            setFlangerModalOpen(false);
          }}
          initialConfig={{
            wet: 0.7,
            depth: 0.16,
            lfoBeats: 16,
            bpm: songData.bpm || 128,
            clipperThresholdDb: -3,
            clipperMaximumDb: 6,
            stereo: false,
            enabled: true  // Enable flanger by default when modal opens
          }}
          stemLabel={flangerModalStem.label}
        />
      )}
    </div>
  )
}
