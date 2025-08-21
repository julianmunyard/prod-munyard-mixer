'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

// ==================== 📦 Imports ====================
import { useEffect, useRef, useState, ChangeEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import DelayKnob from '../../../components/DelayKnob'
import { useParams } from 'next/navigation'
import VarispeedSlider from '../../../components/VarispeedSlider'
import TransparentMixerLayout from '../../../components/TransparentMixerLayout'
import FullWaveformScrubber from '../../../components/FullWaveformScrubber';
import { initMixerEngine, loadStems, play, stop, setVolume, setDelay, setRate } 
  from "@/audio/engine/mixerEngine";

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

// ==================== 🎵 Simple Audio Manager ====================
class SimpleAudioManager {
  private audioElements: Map<string, HTMLAudioElement> = new Map()
  private gainNodes: Map<string, GainNode> = new Map()
  private delayNodes: Map<string, DelayNode> = new Map()
  private feedbackNodes: Map<string, GainNode> = new Map()
  private audioContext: AudioContext | null = null
  private currentTime = 0
  private duration = 0
  private isPlaying = false

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }

  async loadStems(stems: Stem[]) {
    if (!this.audioContext) return

    // Clear existing audio elements
    this.audioElements.forEach(audio => {
      audio.pause()
      audio.src = ''
    })
    this.audioElements.clear()
    this.gainNodes.clear()
    this.delayNodes.clear()
    this.feedbackNodes.clear()

    // Load new stems
    for (const stem of stems) {
      const audio = new Audio(stem.file)
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'

      // tape-style varispeed (no time-stretch)
try { (audio as any).preservesPitch = false; } catch {}
try { (audio as any).mozPreservesPitch = false; } catch {}
try { (audio as any).webkitPreservesPitch = false; } catch {}
try { (audio as any).msPreservesPitch = false; } catch {}
      
      // Setup Web Audio API nodes
      const source = this.audioContext.createMediaElementSource(audio)
      const gainNode = this.audioContext.createGain()
      const delayNode = this.audioContext.createDelay(5.0)
      const feedbackGain = this.audioContext.createGain()
      
      // Connect audio graph: source -> delay -> feedback -> gain -> destination
      source.connect(delayNode)
      delayNode.connect(feedbackGain)
      feedbackGain.connect(delayNode) // feedback loop
      delayNode.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      // Set initial values
      gainNode.gain.value = 1
      delayNode.delayTime.value = 0
      feedbackGain.gain.value = 0.3
      
      this.audioElements.set(stem.label, audio)
      this.gainNodes.set(stem.label, gainNode)
      this.delayNodes.set(stem.label, delayNode)
      this.feedbackNodes.set(stem.label, feedbackGain)

      // Set duration from first loaded audio
      audio.addEventListener('loadedmetadata', () => {
        if (this.duration === 0) {
          this.duration = audio.duration
        }
      })
    }
  }

  async play() {
    if (!this.audioContext) return

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    // Sync all audio elements to current time
    this.audioElements.forEach(audio => {
      audio.currentTime = this.currentTime
      audio.play().catch(console.error)
    })
    
    this.isPlaying = true
  }

  stop() {
    this.audioElements.forEach(audio => {
      audio.pause()
    })
    this.isPlaying = false
  }

  seekTo(time: number) {
    this.currentTime = time
    this.audioElements.forEach(audio => {
      audio.currentTime = time
    })
  }

  getCurrentTime(): number {
    // Get time from first audio element if playing
    const firstAudio = Array.from(this.audioElements.values())[0]
    if (firstAudio && this.isPlaying) {
      this.currentTime = firstAudio.currentTime
    }
    return this.currentTime
  }

  getDuration(): number {
    return this.duration
  }

  setVolume(stemLabel: string, volume: number) {
    const gainNode = this.gainNodes.get(stemLabel)
    if (gainNode) {
      gainNode.gain.value = volume
    }
  }

  setDelay(stemLabel: string, delayTime: number) {
    const delayNode = this.delayNodes.get(stemLabel)
    if (delayNode) {
      delayNode.delayTime.value = delayTime
    }
  }

  setPlaybackRate(stemLabel: string, rate: number) {
    const audio = this.audioElements.get(stemLabel)
    if (audio) {
      audio.playbackRate = rate
    }
  }

  dispose() {
    this.stop()
    this.audioElements.forEach(audio => {
      audio.src = ''
    })
    this.audioElements.clear()
    this.gainNodes.clear()
    this.delayNodes.clear()
    this.feedbackNodes.clear()
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

// ==================== 🎬 Main Component ====================
export default function MixerPage() {
  // -------------------- 🔧 State --------------------
  const { artist, songSlug } = useParams() as { artist: string; songSlug: string }
  const [songData, setSongData] = useState<Song | null>(null)
  const [stems, setStems] = useState<Stem[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [delays, setDelays] = useState<Record<string, number>>({})
  const [mutes, setMutes] = useState<Record<string, boolean>>({})
  const [solos, setSolos] = useState<Record<string, boolean>>({})
  const [varispeed, setVarispeed] = useState(1)
  const [showNotification, setShowNotification] = useState(false)
  const [loadingStems, setLoadingStems] = useState(true)
  const [allReady, setAllReady] = useState(false)
  const [bpm, setBpm] = useState<number | null>(null)
  const primary = songData?.primary_color || '#B8001F' 
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)
  const [scrubPosition, setScrubPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  let lastToggleTime = 0;

  // -------------------- 🎵 Audio Manager Reference --------------------
  const audioManagerRef = useRef<SimpleAudioManager | null>(null)

  // ==================== BROWSER DETECTION ====================
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isInstagram = ua.includes('Instagram');

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
  const boot = async () => {
    const { ctx } = await initMixerEngine();
    console.log("🎧 MixerEngine ready inside MixerPage", ctx);
  };
  boot();
}, []);

useEffect(() => {
  if (stems.length > 0) {
    loadStems(stems.map(s => ({ id: s.label, label: s.label, url: s.file })));
    setAllReady(true);
  }
}, [stems]);

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

  // ==================== 🧠 Effects Logic ====================
  useEffect(() => {
    const fetchSong = async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_slug', artist)
        .eq('song_slug', songSlug)
        .single()

      if (error || !data) return console.error('❌ Song fetch failed', error)
      if (data.bpm) setBpm(data.bpm)

      const parsedStems = typeof data.stems === 'string' ? JSON.parse(data.stems) : data.stems
      const usedLabels = new Set<string>()

      const stemObjs: Stem[] = parsedStems.map((stem: any, i: number) => {
        let rawLabel = stem.label?.trim() || stem.file?.split('/').pop() || `Untitled Stem ${i + 1}`
        rawLabel = rawLabel.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
        let label = rawLabel
        while (usedLabels.has(label)) label += `_${i}`
        usedLabels.add(label)
        return { label, file: stem.file }
      })

      setSongData(data)
      setVolumes(Object.fromEntries(stemObjs.map(s => [s.label, 1])))
      setDelays(Object.fromEntries(stemObjs.map(s => [s.label, 0])))
      setMutes(Object.fromEntries(stemObjs.map(s => [s.label, false])))
      setSolos(Object.fromEntries(stemObjs.map(s => [s.label, false])))
    }

    document.documentElement.style.setProperty('--bg', '#B8001F')
    document.documentElement.style.setProperty('--fg', '#ffffff')

    if (artist && songSlug) fetchSong()
  }, [artist, songSlug])

  // 🔁 Always keep stems up-to-date with songData.stems
  useEffect(() => {
    if (!songData?.stems) {
      setStems([])
      return
    }
    const parsedStems = typeof songData.stems === 'string'
      ? JSON.parse(songData.stems)
      : songData.stems
    const usedLabels = new Set<string>()
    const stemObjs: Stem[] = parsedStems.map((stem: any, i: number) => {
      let rawLabel = stem.label?.trim() || stem.file?.split('/').pop() || `Untitled Stem ${i + 1}`
      rawLabel = rawLabel.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
      let label = rawLabel
      while (usedLabels.has(label)) label += `_${i}`
      usedLabels.add(label)
      return { label, file: stem.file }
    })
    setStems(stemObjs)
  }, [songData?.stems])

  // ==================== 🛡️ Audio Manager Initialization ====================
  useEffect(() => {
    if (stems.length === 0) return;

    console.log(`🛡️ Initializing audio manager for ${stems.length} stems`);

    // Clean up existing audio manager
    if (audioManagerRef.current) {
      audioManagerRef.current.dispose();
    }

    // Create new audio manager
    audioManagerRef.current = new SimpleAudioManager();
    
    // Load stems
    audioManagerRef.current.loadStems(stems).then(() => {
      setLoadingStems(false);
      setAllReady(true);
      console.log(`✅ Audio manager ready for ${stems.length} stems`);
    });

    // Cleanup function
    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.dispose();
        audioManagerRef.current = null;
      }
    };
  }, [stems]);

  // ==================== 🎵 Playback Functions ====================
  const playAll = async () => {
    if (!audioManagerRef.current || stems.length === 0) return;

    console.log(`🎵 Starting playback from ${scrubPosition.toFixed(1)}s...`);
    
    setLoadingStems(true);
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    try {
      await audioManagerRef.current.play();
      setLoadingStems(false);
      console.log('✅ Playback started successfully!');
    } catch (error) {
      console.error('❌ Playback failed:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
      setLoadingStems(false);
    }
  };

  const stopAll = async () => {
    if (!audioManagerRef.current) return;

    console.log('⏹️ Stopping playback...');
    
    setIsPlaying(false);
    isPlayingRef.current = false;
    
    // Save current position
    const currentPos = audioManagerRef.current.getCurrentTime();
    setScrubPosition(currentPos);
    console.log(`💾 Saved position: ${currentPos.toFixed(1)}s`);
    
    audioManagerRef.current.stop();
    console.log('✅ Playback stopped');
  };

  // ==================== 🎚️ SCRUBBING & POSITION ====================
  function handleScrub(newPos: number) {
    console.log(`🎯 Scrubbing to ${newPos.toFixed(1)}s`);
    setScrubPosition(newPos);
    
    if (audioManagerRef.current) {
      audioManagerRef.current.seekTo(newPos);
    }
  }

  // ==================== 📍 Position Tracking ====================
  useEffect(() => {
    if (!isPlaying || !audioManagerRef.current) return;
    
    let raf: number;
    let lastUpdateTime = 0;
    
    const update = (currentTime: number) => {
      if (currentTime - lastUpdateTime < 33) { // 30fps updates
        raf = requestAnimationFrame(update);
        return;
      }
      lastUpdateTime = currentTime;
      
      if (audioManagerRef.current && isPlayingRef.current) {
        const currentPos = audioManagerRef.current.getCurrentTime();
        setScrubPosition(currentPos);
        
        const audioDuration = audioManagerRef.current.getDuration();
        if (audioDuration > 0) {
          setDuration(audioDuration);
        }
      }
      
      if (isPlayingRef.current) {
        raf = requestAnimationFrame(update);
      }
    };
    
    raf = requestAnimationFrame(update);
    
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isPlaying]);

  // ==================== 🎛️ Volume Controls ====================
  useEffect(() => {
    if (!audioManagerRef.current) return;

    stems.forEach(({ label }) => {
      const soloed = Object.values(solos).some(Boolean);
      const shouldPlay = soloed ? solos[label] : !mutes[label];
      const volume = shouldPlay ? volumes[label] : 0;
      
      audioManagerRef.current?.setVolume(label, volume);
    });
  }, [volumes, mutes, solos, stems]);

  // ==================== 🎛️ Delay Controls ====================
  useEffect(() => {
    if (!audioManagerRef.current) return;

    stems.forEach(({ label }) => {
      audioManagerRef.current?.setDelay(label, delays[label] || 0);
    });
  }, [delays, stems]);

  // ==================== 🎛️ Varispeed Controls ====================
  useEffect(() => {
    if (!audioManagerRef.current) return;
    
    stems.forEach(({ label }) => {
      const playbackRate = isInstagram
        ? varispeed
        : isIOS
        ? 2 - varispeed
        : varispeed;
      
      audioManagerRef.current?.setPlaybackRate(label, playbackRate);
    });
  }, [varispeed, stems, isInstagram, isIOS]);

  // ==================== 🎮 KEYBOARD CONTROLS ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastToggleTime < 200) return;
        lastToggleTime = now;
        
        console.log(`⌨️ Space pressed - Currently playing: ${isPlayingRef.current}`);
        
        if (isPlayingRef.current) {
          stopAll();
        } else {
          playAll();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ==================== 🧹 Cleanup ====================
  useEffect(() => {
    return () => {
      console.log('🧹 Component cleanup...');
      
      if (audioManagerRef.current) {
        audioManagerRef.current.dispose();
        audioManagerRef.current = null;
      }
    };
  }, []);

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
                min-height: 220px !important;
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
                fontSize: '96px',
                letterSpacing: '0.05em',
                lineHeight: '1.1',
                color: primary,
              }}
            >
              {songData?.title}
            </h1>

            {/* ▶️ Playback Controls */}
            <div className="flex justify-center mb-2 gap-8">
              <button
                onClick={playAll}
                disabled={!allReady}
                className={`pressable px-6 py-2 font-mono tracking-wide flex items-center gap-2 ${
                  !allReady ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : ''
                }`}
                style={allReady ? { backgroundColor: primary, color: 'white' } : undefined}
              >
                {loadingStems && (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                {loadingStems ? 'Loading...' : 'Play'}
              </button>

              <button
                onClick={stopAll}
                className="pressable text-white px-6 py-2 font-mono tracking-wide"
                style={{ backgroundColor: primary }}
              >
                Stop
              </button>

              <button
                onClick={() => {
                  setSolos(Object.fromEntries(stems.map(s => [s.label, false])))
                  setMutes(Object.fromEntries(stems.map(s => [s.label, false])))
                }}
                style={{ backgroundColor: primary, color: 'white' }}
                className="pressable px-6 py-2 font-mono tracking-wide"
              >
                UNSOLO
              </button>
            </div>

            {/* 🎵 Progress Bar */}
            <div className="w-full max-w-4xl mx-auto mb-8 px-4">
              <div 
                className="bg-gray-200 h-2 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percentage = x / rect.width;
                  const newTime = percentage * duration;
                  handleScrub(newTime);
                }}
              >
                <div 
                  className="h-full transition-all duration-100"
                  style={{ 
                    width: `${duration > 0 ? (scrubPosition / duration) * 100 : 0}%`,
                    backgroundColor: primary 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: primary }}>
                <span>{formatTime(scrubPosition)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* 🎚️ Mixer Modules */}
            <div
              className="w-full flex justify-center sm:overflow-visible overflow-x-auto"
              style={{
                transform:
                  typeof window !== 'undefined' &&
                  window.innerWidth < 768 &&
                  window.innerWidth > window.innerHeight
                    ? 'scale(0.85)'
                    : 'scale(1)',
                transformOrigin: 'top center',
              }}
            >
              <div
                className={`flex ${stems.length >= 6 ? 'gap-4' : 'gap-8'} px-2`}
                style={{
                  minWidth: stems.length <= 4 ? '100%' : 'max-content',
                  justifyContent: stems.length <= 4 ? 'center' : 'flex-start',
                  margin: '0 auto',
                }}
              >
                {stems.map(({ label }) => (
                  <div
                    key={label}
                    className="mixer-module"
                    style={{
                      width: stems.length >= 6 ? '86px' : '96px',
                      backgroundColor: primary,
                      border: '1px solid #444',
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: isMobile ? '450px' : undefined,
                      justifyContent: 'flex-start',
                    }}
                  >
                    <div style={{ width: '16px', height: isMobile ? '40px' : '40px', marginBottom: isMobile ? '20px' : '18px' }} />

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
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volumes[label] || 0}
                        onChange={(e) => {
                          setVolumes((prev) => ({ ...prev, [label]: parseFloat(e.target.value) }))
                        }}
                        className="volume-slider"
                        style={{
                          writingMode: 'bt-lr' as any,
                          WebkitAppearance: 'slider-vertical',
                          width: '4px',
                          height: isMobile ? '150px' : '150px',
                          background: 'transparent',
                        }}
                      />
                    </div>

                    {/* Delay Knob */}
                    <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                      <DelayKnob
                        value={delays[label] || 0}
                        onChange={(val) => {
                          setDelays((prev) => ({ ...prev, [label]: val }))
                        }}
                      />
                    </div>

                    {/* Mute & Solo */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <button
                        onClick={() => {
                          setMutes(prev => ({ ...prev, [label]: !prev[label] }))
                          setSolos(prev => ({ ...prev, [label]: false }))
                        }}
                        style={{
                          fontSize: '12px',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          marginBottom: isMobile ? '14px' : '8px',
                          backgroundColor: mutes[label] ? '#FFD700' : '#FCFAEE',
                          color: mutes[label] ? 'black' : primary,
                          border: `1px solid ${primary}`,
                          cursor: 'pointer',
                        }}
                      >
                        MUTE
                      </button>

                      <button
                        onClick={() => {
                          setSolos(prev => ({ ...prev, [label]: !prev[label] }))
                          setMutes(prev => ({ ...prev, [label]: false }))
                        }}
                        style={{
                          fontSize: '12px',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          marginBottom: '8px',
                          backgroundColor: solos[label] ? '#00FF99' : '#FCFAEE',
                          color: solos[label] ? 'black' : primary,
                          border: `1px solid ${primary}`,
                          cursor: 'pointer',
                        }}
                        className={solos[label] ? 'flash' : ''}
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
                        {label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                    {Math.round(bpm * (isInstagram ? varispeed : isIOS ? 2 - varispeed : varispeed))} BPM
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
                />
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
                        {Math.round(bpm * (isInstagram ? varispeed : isIOS ? 2 - varispeed : varispeed))} BPM
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
                </div>
              </div>
            )}
          </main> 
        </>
      )}
    </>
  )
}