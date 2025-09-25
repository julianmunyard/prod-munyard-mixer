'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

// ==================== 📦 Imports ====================
import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import DelayKnob from '../../../components/DelayKnob'
import ReverbConfigModal from '../../../components/ReverbConfigModal'
import { useParams } from 'next/navigation'
import VarispeedSlider from '../../../components/VarispeedSlider'
import RealTimelineMixerEngine from '../../../../audio/engine/realTimelineMixerEngine'

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


// ==================== 🎵 Timeline Mixer Engine ====================




// ==================== 🎬 Error Boundary Component ====================
class MixerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MixerPage Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-white">
          <h1>Error Loading Mixer</h1>
          <p>Something went wrong: {this.state.error?.message || 'Unknown error'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==================== 🎬 Main Component ====================
function MixerPage() {
  const { artist, songSlug } = useParams() as { artist: string; songSlug: string }
  
  // -------------------- 🔧 State --------------------
  const [songData, setSongData] = useState<Song | null>(null)
  const [stems, setStems] = useState<Stem[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [reverbs, setReverbs] = useState<Record<string, number>>({})
  const [mutes, setMutes] = useState<Record<string, boolean>>({})
  const [solos, setSolos] = useState<Record<string, boolean>>({})
  const [varispeed, setVarispeed] = useState(1)
  const [isNaturalVarispeed, setIsNaturalVarispeed] = useState(false)
  const [reverbConfigModal, setReverbConfigModal] = useState<{
    isOpen: boolean
    stemLabel: string
    stemIndex: number
    position?: { x: number; y: number }
  }>({ isOpen: false, stemLabel: '', stemIndex: 0 })
  const [reverbConfigs, setReverbConfigs] = useState<Record<string, {
    mix: number
    width: number
    damp: number
    roomSize: number
    predelayMs: number
    lowCutHz: number
    enabled: boolean
  }>>({})
  const [bpm, setBpm] = useState<number | null>(null)
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [timelineReady, setTimelineReady] = useState(false)
  const [allAssetsLoaded, setAllAssetsLoaded] = useState(false)
  const [loadingStems, setLoadingStems] = useState(false)
  const [loadedStemsCount, setLoadedStemsCount] = useState(0)
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // -------------------- 🎵 Timeline Engine Reference --------------------
  const mixerEngineRef = useRef<RealTimelineMixerEngine | null>(null);

  // Debug logging function that shows on page
  const addDebugLog = (message: string) => {
    console.log(message);
    setDebugLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const primary = songData?.primary_color || '#B8001F'

  // -------------------- 📱 Device Detection --------------------
  useEffect(() => {
    const check = () => {
      if (typeof window !== 'undefined') {
        const isPortrait = window.innerWidth < 768 && window.innerHeight > window.innerWidth
        setIsMobilePortrait(isPortrait)
      }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const landscape = window.innerWidth < 768 && window.innerWidth > window.innerHeight
        setIsMobileLandscape(landscape)
      }
    }
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    return () => window.removeEventListener('resize', checkOrientation)
  }, [])

  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)


  // ==================== 🎵 Timeline Engine Initialization ====================
  useEffect(() => {
    const initializeTimeline = async () => {
      try {
        addDebugLog('🎵 Initializing Timeline Engine...')
        
        mixerEngineRef.current = new RealTimelineMixerEngine()
        await mixerEngineRef.current.init()
        
        // Set up timeline cursor updates
        if (mixerEngineRef.current.audioEngine) {
          mixerEngineRef.current.audioEngine.onTimelineFrameCursorUpdate = (cursor: number) => {
            setCurrentTime(cursor / 48000) // Convert samples to seconds
          }
        }

        setTimelineReady(true)
        addDebugLog('✅ Timeline Engine ready!')
        
      } catch (error) {
        addDebugLog(`❌ Failed to initialize: ${error}`)
      }
    }

    initializeTimeline()
  }, [])

  // ==================== 🧠 Data Loading ====================
  useEffect(() => {
    const fetchSong = async () => {
      if (!artist || !songSlug) return;
      
      addDebugLog(`🎵 Loading song: ${artist}/${songSlug}`);
      
      const { data, error } = await supabase!
        .from('songs')
        .select('*')
        .eq('artist_slug', artist)
        .eq('song_slug', songSlug)
        .single()

      if (error) {
        addDebugLog(`❌ Supabase error: ${error.message}`);
        return;
      }

      if (!data) {
        addDebugLog('❌ Song not found in database');
        return;
      }

      addDebugLog(`✅ Found song: ${data.title} by ${data.artist_name}`);

      if (data.bpm) setBpm(data.bpm);

      // Parse stems
      const parsedStems = typeof data.stems === 'string' 
        ? JSON.parse(data.stems) 
        : data.stems

      if (!parsedStems || !Array.isArray(parsedStems)) {
        addDebugLog('❌ No stems found in song data');
        return;
      }

      addDebugLog(`✅ Found ${parsedStems.length} stems`);

      // Convert stems to the format expected by timeline system
      const stemObjs: Stem[] = parsedStems.map((stem: any, i: number) => {
        let rawLabel = stem.label?.trim() || stem.file?.split('/').pop() || `Untitled Stem ${i + 1}`
        rawLabel = rawLabel.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
        return { label: rawLabel, file: stem.file }
      });

      setSongData(data);
      setStems(stemObjs);
      setVolumes(Object.fromEntries(stemObjs.map(s => [s.label, 1])));
      setReverbs(Object.fromEntries(stemObjs.map(s => [s.label, 0])));
      setMutes(Object.fromEntries(stemObjs.map(s => [s.label, false])));
      setSolos(Object.fromEntries(stemObjs.map(s => [s.label, false])));
      
      // Initialize reverb configs with default values
      const defaultReverbConfig = {
        mix: 0.4,
        width: 1.0,
        damp: 0.5,
        roomSize: 0.8,
        predelayMs: 0,
        lowCutHz: 0,
        enabled: true
      }
      setReverbConfigs(Object.fromEntries(stemObjs.map(s => [s.label, defaultReverbConfig])));
    }

    fetchSong();
  }, [artist, songSlug])

  // ==================== 🎵 Load Stems Function ====================
  const loadStemsIntoTimeline = async () => {
    if (!timelineReady || !stems.length || !mixerEngineRef.current) {
      addDebugLog('❌ Cannot load stems - timeline not ready or no stems');
      return;
    }

    try {
      addDebugLog(`🎵 Loading ${stems.length} stems into timeline...`);
      setLoadingStems(true);
      setAllAssetsLoaded(false);
      setLoadedStemsCount(0);
      
      // Convert stems to timeline format
      const stemData = stems.map(stem => ({
        name: stem.label,
        url: stem.file, // file field already contains full Supabase storage URL
        label: stem.label
      }));

      // Set up the callback to wait for all assets to be downloaded
      let assetsDownloadedPromise = new Promise<void>((resolve) => {
        if (mixerEngineRef.current?.audioEngine) {
          mixerEngineRef.current.audioEngine.onAllAssetsDownloaded = () => {
            addDebugLog('✅ All assets downloaded and decoded!');
            setAllAssetsLoaded(true);
            setLoadingStems(false);
            resolve();
          };
        }
      });

      // Load all stems at once (Thomas's system handles the downloading)
      addDebugLog(`🎵 Sending ${stemData.length} stems to timeline processor...`);
      await mixerEngineRef.current.loadStemsFromSupabase(stemData);
      
      // Update progress as we send the data
      setLoadedStemsCount(stemData.length);
      addDebugLog(`📤 Sent ${stemData.length} stems to processor - waiting for download...`);

      // Wait for all assets to be actually downloaded and decoded
      await assetsDownloadedPromise;
      
    } catch (error) {
      addDebugLog(`❌ Failed to load stems: ${error}`);
      setAllAssetsLoaded(false);
      setLoadingStems(false);
    }
  };

  // ==================== 🎵 Playback Functions ====================
  const playAll = async () => {
    if (!mixerEngineRef.current || !timelineReady) return;
    
    try {
      await mixerEngineRef.current.play();
      setIsPlaying(true);
      addDebugLog('▶️ Playback started');
    } catch (error) {
      addDebugLog(`❌ Failed to play: ${error}`);
    }
  };

  const pauseAll = () => {
    if (!mixerEngineRef.current) return;
    
    try {
      mixerEngineRef.current.pause();
      setIsPlaying(false);
      addDebugLog('⏸️ Playback paused');
    } catch (error) {
      addDebugLog(`❌ Failed to pause: ${error}`);
    }
  };

  const stopAll = () => {
    if (!mixerEngineRef.current) return;
    
    try {
      mixerEngineRef.current.stop();
      setIsPlaying(false);
      setCurrentTime(0);
      addDebugLog('⏹️ Playback stopped');
    } catch (error) {
      addDebugLog(`❌ Failed to stop: ${error}`);
    }
  };

  // ==================== 🎛️ REVERB CONFIGURATION ====================
  const handleReverbConfigOpen = (stemLabel: string, stemIndex: number, position?: { x: number; y: number }) => {
    setReverbConfigModal({
      isOpen: true,
      stemLabel,
      stemIndex,
      position
    })
  }

  const handleReverbConfigClose = () => {
    setReverbConfigModal({
      isOpen: false,
      stemLabel: '',
      stemIndex: 0
    })
  }

  const handleReverbConfigSave = (config: {
    mix: number
    width: number
    damp: number
    roomSize: number
    predelayMs: number
    lowCutHz: number
    enabled: boolean
  }) => {
    const stemLabel = reverbConfigModal.stemLabel
    const stemIndex = reverbConfigModal.stemIndex
    
    // Update the reverb config state
    setReverbConfigs(prev => ({
      ...prev,
      [stemLabel]: config
    }))
    
    // TODO: Connect to timeline system for reverb parameters
    console.log('Reverb config saved:', config);
  }

  // ==================== 🎨 UTILITY FUNCTIONS ====================
  function formatTime(secs: number) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ==================== 🎨 RENDER ====================
  return (
    <>
      {!songData ? (
        <div className="p-8 text-white">Loading...</div>
      ) : (
        <>
          {/* 🎨 Global Inline Styles */}
          <style>{`
            input[type="range"]::-webkit-slider-thumb {
              background: ${primary};
            }
            input[type="range"]::-moz-range-thumb {
              background: ${primary};
            }
            input[type="range"]::-ms-thumb {
              background: ${primary};
            }
            @media screen and (max-width: 767px) and (orientation: landscape) {
              .mixer-module {
                min-height: 260px !important;
              }
            }
            @media screen and (max-width: 767px) {
              .stems-container::-webkit-scrollbar {
                display: none;
              }
              .stems-container {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            }
          `}</style>

          {/* 🎥 Background Video */}
          {songData?.background_video &&
            (songData.color === 'Transparent' || songData.color === 'Red (Classic)') && (
              <video
                src={songData.background_video}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100dvh',
                  objectFit: 'cover',
                  zIndex: -1,
                  pointerEvents: 'none',
                  backgroundColor: '#FCFAEE',
                }}
              />
            )}

          {/* 🧱 Main Layout */}
          <main
            className={`min-h-screen font-sans relative ${
              songData?.color === 'Transparent' && songData?.background_video
                ? 'bg-transparent text-[#B8001F]'
                : 'bg-[#FCFAEE] text-[#B8001F]'
            }`}
            style={{
              minHeight: '100dvh',
              paddingBottom: '80px',
            }}
          >
            {/* 🏷️ Song Title */}
            <h1
              className="village text-center mb-16"
              style={{
                fontSize: isMobile ? '48px' : '96px',
                letterSpacing: '0.05em',
                lineHeight: '1.1',
                color: primary,
                padding: isMobile ? '0 16px' : '0',
              }}
            >
              {songData?.title}
            </h1>

            {/* ▶️ Playback Controls */}
            <div className={`flex justify-center mb-2 ${isMobile ? 'gap-4' : 'gap-8'} ${isMobile ? 'px-4' : ''}`}>
              <button
                onClick={loadStemsIntoTimeline}
                disabled={!timelineReady || loadingStems}
                className={`pressable ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide flex items-center gap-2 transition-all duration-200 ${
                  !timelineReady || loadingStems
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-60' 
                    : 'hover:opacity-90'
                }`}
                style={timelineReady && !loadingStems ? { backgroundColor: primary, color: 'white' } : undefined}
              >
                {loadingStems && (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                {loadingStems 
                  ? `Downloading... (${loadedStemsCount}/${stems.length})` 
                  : 'Load Stems'
                }
              </button>

              <button
                onClick={playAll}
                disabled={!timelineReady || !allAssetsLoaded}
                className={`pressable ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide flex items-center gap-2 transition-all duration-200 ${
                  !timelineReady || !allAssetsLoaded
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-60' 
                    : 'hover:opacity-90'
                }`}
                style={timelineReady && allAssetsLoaded ? { backgroundColor: primary, color: 'white' } : undefined}
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

            {/* 🎵 Status */}
            <div className="text-center mb-8">
              <p className="text-lg">
                Status: {!timelineReady ? '⏳ Initializing...' : loadingStems ? `⏳ Downloading & Decoding Audio... (${loadedStemsCount}/${stems.length})` : !allAssetsLoaded ? '⏳ Ready to Load Stems' : '✅ Ready to Play'}
              </p>
              <p className="text-sm opacity-70">
                Current Time: {currentTime.toFixed(2)}s
              </p>
            </div>

            {/* 🎚️ Mixer Modules */}
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
                  width: '100%', // Full width container
                  justifyContent: 'center', // Always center the modules
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
                          value={volumes[stem.label] || 1}
                          onChange={(e) => {
                            setVolumes((prev) => ({ ...prev, [stem.label]: parseFloat(e.target.value) }))
                          }}
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
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const stemIndex = stems.findIndex(s => s.label === stem.label)
                            handleReverbConfigOpen(stem.label, stemIndex, { x: e.clientX, y: e.clientY })
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const stemIndex = stems.findIndex(s => s.label === stem.label)
                            handleReverbConfigOpen(stem.label, stemIndex, { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY })
                          }}
                        >
                          REVERB
                        </span>
                        <DelayKnob
                          value={reverbs[stem.label] || 0}
                          onChange={(val) => {
                            setReverbs((prev) => ({ ...prev, [stem.label]: val }))
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

                      {/* Label */}
                      <div
                        style={{
                          fontSize: '12px',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#FCFAEE',
                          color: primary,
                          marginTop: '6px',
                          display: 'block',
                          width: '100%',
                          minHeight: '34px',
                          maxHeight: '34px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          lineHeight: '1.2',
                          boxSizing: 'border-box',
                          border: `1px solid ${primary}`,
                        }}
                      >
                        {stem.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 🐛 Debug Panel - Collapsible */}
            {(debugLogs.length > 0 || loadingStems) && (
              <>
                {/* Debug Button */}
                <button
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    zIndex: 1000,
                    minWidth: '60px',
                    minHeight: '36px'
                  }}
                >
                  Logs ({debugLogs.length})
                </button>

                {/* Debug Panel Popup */}
                {showDebugPanel && (
                  <div
                    style={{
                      position: 'fixed',
                      bottom: '70px',
                      right: '20px',
                      width: 'min(400px, calc(100vw - 40px))',
                      maxHeight: '300px',
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      color: 'white',
                      padding: '15px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      zIndex: 1001,
                      overflowY: 'auto',
                      border: '1px solid #333',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '10px',
                      borderBottom: '1px solid #444',
                      paddingBottom: '5px'
                    }}>
                      <div style={{ fontWeight: 'bold' }}>Debug Logs</div>
                      <button
                        onClick={() => setShowDebugPanel(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '0',
                          width: '20px',
                          height: '20px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      {debugLogs.map((log, index) => (
                        <div key={`debug-${index}`} style={{ marginBottom: '3px' }}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 🎚️ Varispeed Slider */}
            {(!isMobilePortrait || stems.length <= 2) && (
              <div
                className="absolute right-4 flex flex-col items-center"
                style={{
                  top: songData?.title.length > 16 ? '350px' : '260px',
                }}
              >
                {bpm !== null && (
                  <div className="mb-1 text-xs font-mono" style={{ color: primary }}>
                    {Math.round(bpm * varispeed)} BPM
                  </div>
                )}
                <span className="mb-3 text-sm tracking-wider" style={{ color: primary }}>
                  VARISPEED
                </span>
                <VarispeedSlider
                  value={varispeed}
                  onChange={setVarispeed}
                  isIOS={isIOS}
                  primaryColor={primary}
                  bpm={bpm}
                />
                {/* Mode Toggle Button - Centered below slider */}
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => setIsNaturalVarispeed(!isNaturalVarispeed)}
                    className="px-3 py-2 text-xs font-mono rounded border"
                    style={{ 
                      color: primary,
                      borderColor: primary,
                      backgroundColor: isNaturalVarispeed ? primary + '20' : 'transparent',
                      pointerEvents: 'auto', // Enable pointer events for mobile tapping
                      minHeight: '32px', // Ensure minimum touch target size
                      minWidth: '70px' // Ensure minimum touch target size
                    }}
                    title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                  >
                    {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Portrait Varispeed */}
            {isMobilePortrait && stems.length >= 3 && (
              <div className="w-full flex justify-center sm:hidden">
                <div
                  className="relative"
                  style={{
                    marginTop: '12px',
                    width: '350px',
                    height: '140px',
                  }}
                >
                  <div
                    className="absolute top-0 left-0 w-full flex flex-col items-center"
                    style={{
                      pointerEvents: 'none',
                      marginTop: '0px',
                    }}
                  >
                    {bpm !== null && (
                      <div className="text-xs font-mono mb-1" style={{ color: primary }}>
                        {Math.round(bpm * varispeed)} BPM
                      </div>
                    )}
                    <div className="text-sm tracking-wider" style={{ color: primary }}>
                      VARISPEED
                    </div>
                  </div>

                  <div
                    className="absolute left-1/2"
                    style={{
                      transform: 'translateX(-50%) rotate(-90deg)',
                      top: '-118px',
                    }}
                  >
                    <VarispeedSlider
                      value={2 - varispeed}
                      onChange={val => setVarispeed(2 - val)}
                      isIOS={isIOS}
                      primaryColor={primary}
                      stemCount={stems.length}
                    />
                  </div>
                  
                  {/* Mode Toggle Button - Centered below slider for mobile */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                    <button
                      onClick={() => setIsNaturalVarispeed(!isNaturalVarispeed)}
                      className="px-3 py-2 text-xs font-mono rounded border"
                      style={{ 
                        color: primary,
                        borderColor: primary,
                        backgroundColor: isNaturalVarispeed ? primary + '20' : 'transparent',
                        pointerEvents: 'auto', // Enable pointer events for mobile tapping
                        minHeight: '32px', // Ensure minimum touch target size
                        minWidth: '70px' // Ensure minimum touch target size
                      }}
                      title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                    >
                      {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* 🎛️ Reverb Configuration Modal */}
          <ReverbConfigModal
            isOpen={reverbConfigModal.isOpen}
            onClose={handleReverbConfigClose}
            onSave={handleReverbConfigSave}
            initialConfig={reverbConfigs[reverbConfigModal.stemLabel] || {
              mix: 0.4,
              width: 1.0,
              damp: 0.5,
              roomSize: 0.8,
              predelayMs: 0,
              lowCutHz: 0,
              enabled: true
            }}
            stemLabel={reverbConfigModal.stemLabel}
            position={reverbConfigModal.position}
          />

        </>
      )}
    </>
  )
}

// Export with error boundary
export default function MixerPageWithErrorBoundary() {
  return (
    <MixerErrorBoundary>
      <MixerPage />
    </MixerErrorBoundary>
  );
}