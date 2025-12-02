'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

// ==================== 📦 Imports ====================
import React, { useEffect, useRef, useState, useCallback } from 'react'
// @ts-ignore - Supabase type issues
import { supabase } from '@/lib/supabaseClient'

import DelayKnob from '../../../components/DelayKnob'
import ReverbConfigModal from '../../../components/ReverbConfigModal'
import EchoConfigModal from '../../../components/EchoConfigModal'
import FlangerConfigModal from '../../../components/FlangerConfigModal'
import CompressorConfigModal from '../../../components/CompressorConfigModal'
import PoolsuiteLoadingScreen from '../../../components/PoolsuiteLoadingScreen'
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
  const [reverbs, setReverbs] = useState<Record<string, any>>({})
  const [echoes, setEchoes] = useState<Record<string, any>>({})
  const [selectedEffects, setSelectedEffects] = useState<Record<string, 'reverb' | 'echo'>>({})
  const [mutes, setMutes] = useState<Record<string, boolean>>({})
  const [solos, setSolos] = useState<Record<string, boolean>>({})
  
  // Default reverb config
  const defaultReverbConfig = {
    mix: 0,
    width: 1.0,
    damp: 0.5,
    roomSize: 0.8,
    predelayMs: 0,
    lowCutHz: 0,
    enabled: false
  }
  
  // Default echo config
  const defaultEchoConfig = {
    dry: 1.0, // Always keep dry at full volume
    wet: 0.0, // Start at 0% wet on main knob
    bpm: 128,
    beats: 0.5,
    decay: 0.5,
    enabled: false
  }
  
  // Default flanger config
  const defaultFlangerConfig = {
    wet: 0.7,
    depth: 0.16,
    lfoBeats: 16,
    bpm: 128,
    clipperThresholdDb: -3,
    clipperMaximumDb: 6,
    stereo: false,
    enabled: false
  }
  
  // Default compressor config
  const defaultCompressorConfig = {
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
  const [varispeed, setVarispeed] = useState(1)
  const [isNaturalVarispeed, setIsNaturalVarispeed] = useState(true)
  const [reverbConfigModal, setReverbConfigModal] = useState<{
    isOpen: boolean
    stemLabel: string
    stemIndex: number
    position?: { x: number; y: number }
  }>({ isOpen: false, stemLabel: '', stemIndex: 0 })
  
  const [echoConfigModal, setEchoConfigModal] = useState<{
    isOpen: boolean
    stemLabel: string
    stemIndex: number
    position?: { x: number; y: number }
  }>({ isOpen: false, stemLabel: '', stemIndex: 0 })
  
  // Global flanger state
  const [globalFlanger, setGlobalFlanger] = useState<any>(null)
  const [flangerConfigModal, setFlangerConfigModal] = useState<{
    isOpen: boolean
  }>({ isOpen: false })
  
  // Global compressor state
  const [globalCompressor, setGlobalCompressor] = useState<any>(null)
  const [compressorConfigModal, setCompressorConfigModal] = useState<{
    isOpen: boolean
  }>({ isOpen: false })
  
  // Master effect selection (flanger or compressor)
  const [selectedMasterEffect, setSelectedMasterEffect] = useState<'flanger' | 'compressor'>('flanger')
  const [bpm, setBpm] = useState<number | null>(null)
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 })
  const [isPlaying, setIsPlaying] = useState(false)
  
  const [timelineReady, setTimelineReady] = useState(false)
  const [allAssetsLoaded, setAllAssetsLoaded] = useState(false)
  const [loadingStems, setLoadingStems] = useState(false)
  const [loadedStemsCount, setLoadedStemsCount] = useState(0)
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState<{heap: number, total: number}>({heap: 0, total: 0});
  
  // Loading screen state
  const [showLoadingScreen, setShowLoadingScreen] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('Initializing audio engine...')
  
  // Responsive breakpoints
  const isVerySmallScreen = screenSize.width > 0 && screenSize.width < 375  // iPhone SE, iPhone 12 mini
  const isSmallScreen = screenSize.width >= 375 && screenSize.width < 414  // iPhone 13, iPhone 14
  const isMediumScreen = screenSize.width >= 414 && screenSize.width < 768  // Larger phones
  const isMobile = screenSize.width > 0 && screenSize.width < 768
  const isTablet = screenSize.width >= 768 && screenSize.width < 1024
  const isDesktop = screenSize.width >= 1024

  // -------------------- 🎵 Timeline Engine Reference --------------------
  const mixerEngineRef = useRef<RealTimelineMixerEngine | null>(null);

  // Debug logging function that shows on page
  const addDebugLog = (message: string) => {
    console.log(message);
    setDebugLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Memory monitoring function
  const checkMemoryUsage = () => {
    if (mixerEngineRef.current?.audioEngine?.superpowered) {
      const superpowered = mixerEngineRef.current.audioEngine.superpowered;
      const heap = superpowered.heapSize || 0;
      const total = superpowered.totalMemory || 0;
      setMemoryUsage({heap, total});
      addDebugLog(`🧠 Memory: ${(heap / 1024 / 1024).toFixed(1)}MB heap, ${(total / 1024 / 1024).toFixed(1)}MB total`);
    }
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

  useEffect(() => {
    // Handle screen size detection to prevent hydration issues
    const checkScreenSize = () => {
      if (typeof window !== 'undefined') {
        setScreenSize({ width: window.innerWidth, height: window.innerHeight })
      }
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    window.addEventListener('orientationchange', checkScreenSize)
    return () => {
      window.removeEventListener('resize', checkScreenSize)
      window.removeEventListener('orientationchange', checkScreenSize)
    }
  }, [])

  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)

  // ==================== 🎵 Background Audio Support ====================
  useEffect(() => {
    // Keep audio context alive when page is hidden (for background playback)
    // Note: Silent audio visibility handling is in the silent audio useEffect below
    const handleVisibilityChange = async () => {
      const engine = mixerEngineRef.current?.audioEngine?.webaudioManager as any;
      const ctx = engine?.audioContext;
      
      // Only resume the audio context in background if user was already playing.
      if (document.hidden) {
        if (isPlaying) {
          // Ensure context is running and playback remains asserted while hidden
          try {
            if (ctx && ctx.state === 'suspended') {
              await ctx.resume();
              addDebugLog('🔊 Audio context resumed in background (was playing)');
            }
            // Re-assert play state for processors that may pause on tab hide
            mixerEngineRef.current?.play?.();
          } catch {
            // no-op
          }
        } else {
          // If user had paused, ensure we do not accidentally start playback.
          try {
            mixerEngineRef.current?.pause?.();
          } catch {
            // no-op
          }
        }
      } else {
        // When returning to the tab, if we were playing, make sure context is running.
        if (isPlaying && ctx && ctx.state === 'suspended') {
          try {
            await ctx.resume();
            addDebugLog('🔊 Audio context resumed on visibility return');
          } catch {
            // no-op
          }
        }
      }
    }

    const handleBeforeUnload = () => {
      // Only stop on actual page unload (not just hiding)
      if (mixerEngineRef.current) {
        mixerEngineRef.current.pause()
        mixerEngineRef.current.stop()
        addDebugLog('🛑 Stopped playback - page unloading')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // ==================== 🎯 Click Outside Dropdown Handler ====================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Check if click is outside any effect dropdown
      if (!target.closest('[id^="effect-dropdown-"]') && 
          !target.closest('[id^="master-effect-dropdown"]') &&
          !target.closest('[id^="mobile-master-effect-dropdown"]')) {
        // Close all effect dropdowns
        document.querySelectorAll('[id^="effect-dropdown-"]').forEach(dropdown => {
          dropdown.classList.add('hidden')
        })
        // Close master effect dropdown
        document.getElementById('master-effect-dropdown')?.classList.add('hidden')
        // Close mobile master effect dropdown
        document.getElementById('mobile-master-effect-dropdown')?.classList.add('hidden')
      }
    }

    // Use mousedown instead of click to avoid conflicts with button clicks
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  // ==================== 🔇 Silent Mode Bypass (iOS Hack) ====================
  // iOS treats Web Audio API as "system sounds" that respect silent mode
  // Solution: User taps mute/unmute button to unlock audio
  const silentModeBypassRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)
  const manuallyUnlockedRef = useRef(false) // Track if user manually unlocked
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  
  // Function to toggle audio unlock (called by mute/unmute button)
  // Simple like YouTube - immediate toggle, no complex logic (matching unmute.js pattern)
  const toggleAudioUnlock = useCallback(() => {
    if (!silentModeBypassRef.current) return;
    
    const audio = silentModeBypassRef.current;
    const currentState = audioUnlockedRef.current;
    const newState = !currentState;
    
    // Update state IMMEDIATELY - no waiting
    audioUnlockedRef.current = newState;
    manuallyUnlockedRef.current = newState;
    setAudioUnlocked(newState);
    
    if (newState) {
      // UNMUTE: Recreate channel tag if destroyed, then play (like unmute.js)
      // If src is "about:blank", recreate it (page was hidden)
      if (audio.src === 'about:blank' || !audio.src) {
        const huffman = (count: number, repeatStr: string): string => {
          let e = repeatStr
          for (; count > 1; count--) e += repeatStr
          return e
        }
        const silence = "data:audio/mpeg;base64,//uQx" + huffman(23, "A") + "WGluZwAAAA8AAAACAAACcQCA" + huffman(16, "gICA") + huffman(66, "/") + "8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkI" + huffman(320, "A") + "//sQxAADgnABGiAAQBCqgCRMAAgEAH" + huffman(15, "/") + "7+n/9FTuQsQH//////2NG0jWUGlio5gLQTOtIoeR2WX////X4s9Atb/JRVCbBUpeRUq" + huffman(18, "/") + "9RUi0f2jn/+xDECgPCjAEQAABN4AAANIAAAAQVTEFNRTMuMTAw" + huffman(97, "V") + "Q=="
        audio.src = silence
        audio.load()
      }
      
      // Play silent audio immediately (like unmute.js)
      // This forces WebAudio onto media channel on iOS
      audio.play()
        .then(() => {
          addDebugLog('🔊 Audio unmuted - silent track playing');
          // If mixer is playing, make sure it continues
          if (isPlaying && mixerEngineRef.current) {
            mixerEngineRef.current.play?.();
          }
        })
        .catch((error: any) => {
          addDebugLog('⚠️ Unmute play failed: ' + (error?.message || 'Unknown'));
          console.warn('Unmute play failed:', error);
          // Don't revert state - user clicked unmute, so keep it unmuted
        });
    } else {
      // MUTE: Stop silent audio immediately
      audio.pause();
      audio.currentTime = 0;
      manuallyUnlockedRef.current = false;
      addDebugLog('🔇 Audio muted - silent track stopped');
      // Note: This may cause mixer to stop on iOS if it was relying on the silent track
      // User can unmute again to resume
    }
  }, [addDebugLog, isPlaying]);
  
  useEffect(() => {
    // Create a hidden audio element that will play silence (matching unmute.js pattern)
    const audio = document.createElement('audio')
    audio.loop = true
    audio.volume = 0.001 // Very quiet, but not zero (zero gets muted by iOS)
    audio.preload = 'auto'
    audio.controls = false
    ;(audio as any).disableRemotePlayback = true // Prevent AirPlay (like unmute.js)
    audio.setAttribute('playsinline', 'true') // iOS compatibility
    audio.setAttribute('webkit-playsinline', 'true') // Older iOS
    ;(audio as any).playsInline = true // Critical for iOS (TypeScript workaround)
    audio.style.display = 'none' // Hidden but functional
    
    // Use high-quality MP3 silence from unmute.js (not WAV)
    // The silence MP3 must be high quality - when web audio sounds are played in parallel,
    // the web audio sound is mixed to match the bitrate of the html sound.
    // This is 0.01 seconds of silence VBR220-260 Joint Stereo 859B
    const huffman = (count: number, repeatStr: string): string => {
      let e = repeatStr
      for (; count > 1; count--) e += repeatStr
      return e
    }
    const silence = "data:audio/mpeg;base64,//uQx" + huffman(23, "A") + "WGluZwAAAA8AAAACAAACcQCA" + huffman(16, "gICA") + huffman(66, "/") + "8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkI" + huffman(320, "A") + "//sQxAADgnABGiAAQBCqgCRMAAgEAH" + huffman(15, "/") + "7+n/9FTuQsQH//////2NG0jWUGlio5gLQTOtIoeR2WX////X4s9Atb/JRVCbBUpeRUq" + huffman(18, "/") + "9RUi0f2jn/+xDECgPCjAEQAABN4AAANIAAAAQVTEFNRTMuMTAw" + huffman(97, "V") + "Q=="
    audio.src = silence
    
    // Load the audio immediately so it's ready when needed
    audio.load()
    
    // Add to DOM (required for some browsers)
    document.body.appendChild(audio)
    
    // Set ref immediately
    silentModeBypassRef.current = audio
    
    // Wait for audio to be ready
    audio.addEventListener('canplaythrough', () => {
      addDebugLog('🔇 Silent unlock audio ready')
    }, { once: true })
    
    // Also listen for when it can play (earlier than canplaythrough)
    audio.addEventListener('canplay', () => {
      addDebugLog('🔇 Silent unlock audio can play')
    }, { once: true })
    
    // Helper to destroy channel tag (like unmute.js)
    const destroyChannelTag = () => {
      if (audio && audio.src && audio.src !== 'about:blank') {
        // Change src to nothing and trigger a load - this is required to actually hide/clear iOS playback controls
        audio.src = 'about:blank'
        audio.load()
        audio.pause()
        addDebugLog('🔇 Silent audio destroyed (page hidden)')
      }
    }
    
    // Helper to recreate channel tag (when page becomes visible again)
    const recreateChannelTag = () => {
      if (audio && audio.src === 'about:blank') {
        audio.src = silence
        audio.load()
        addDebugLog('🔇 Silent audio recreated (page visible)')
      }
    }
    
    // Handle page visibility (like unmute.js - destroy tag when hidden to hide iOS media controls)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - destroy channel tag to hide iOS media controls
        destroyChannelTag()
      } else {
        // Page visible - recreate if needed (only if user had unmuted)
        if (audioUnlockedRef.current || manuallyUnlockedRef.current) {
          recreateChannelTag()
          // If mixer is playing, restart silent audio
          if (isPlaying) {
            audio.play().catch((e: any) => console.warn('Silent audio play failed on visibility:', e))
          }
        }
      }
    }
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // On iOS, also listen for focus/blur (because iOS page visibility API is buggy)
    if (isIOS) {
      window.addEventListener('focus', handleVisibilityChange)
      window.addEventListener('blur', handleVisibilityChange)
    }
    
    return () => {
      // Cleanup
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (isIOS) {
        window.removeEventListener('focus', handleVisibilityChange)
        window.removeEventListener('blur', handleVisibilityChange)
      }
      if (audio) {
        audio.pause()
        audio.src = ''
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio)
        }
      }
    }
  }, [isIOS, isPlaying])

  // ==================== 🔄 Keep Silent Audio Playing While Mixer Plays ====================
  // Critical: Silent audio must play continuously while mixer is playing (unmute.js pattern)
  useEffect(() => {
    if (!isIOS || !silentModeBypassRef.current) return;
    
    const audio = silentModeBypassRef.current;
    
    if (isPlaying) {
      // Mixer is playing - ensure silent audio is also playing
      if (audio.paused && audio.src && audio.src !== 'about:blank') {
        audio.play().catch((e: any) => {
          console.warn('Failed to keep silent audio playing:', e);
          addDebugLog('⚠️ Silent audio play failed (keep playing): ' + (e?.message || 'Unknown'));
        });
      }
    }
    // Note: We DON'T pause silent audio when mixer pauses - let user control via unmute button
    // This maintains media channel access for when playback resumes
  }, [isPlaying, isIOS, addDebugLog]);

  // ==================== 🎵 Timeline Engine Initialization ====================
  useEffect(() => {
    const initializeTimeline = async () => {
      try {
        setLoadingMessage('Initializing audio engine...')
        setLoadingProgress(10)
        addDebugLog('🎵 Initializing Timeline Engine...')
        
        mixerEngineRef.current = new RealTimelineMixerEngine()
        setLoadingProgress(30)
        setLoadingMessage('Loading audio processors...')
        
        await mixerEngineRef.current.init()
        setLoadingProgress(50)
        setLoadingMessage('Audio engine ready!')

        setTimelineReady(true)
        addDebugLog('✅ Timeline Engine ready!')
        
      } catch (error) {
        addDebugLog(`❌ Failed to initialize: ${error}`)
        setLoadingMessage('Failed to initialize audio engine')
      }
    }

    initializeTimeline()

    // Cleanup function to stop playback when component unmounts
    return () => {
      if (mixerEngineRef.current) {
        try {
          mixerEngineRef.current.pause()
          mixerEngineRef.current.stop()
          addDebugLog('🛑 Stopped playback on page exit')
        } catch (error) {
          console.error('Error stopping playback on cleanup:', error)
        }
      }
      if (silentModeBypassRef.current) {
        silentModeBypassRef.current.pause()
      }
    }
  }, [])

  // ==================== 🧠 Data Loading ====================
  useEffect(() => {
    const fetchSong = async () => {
      if (!artist || !songSlug) return;
      
      setLoadingMessage('Loading song data...')
      setLoadingProgress(60)
      addDebugLog(`🎵 Loading song: ${artist}/${songSlug}`);
      
      const { data, error } = await supabase!
        .from('songs')
        .select('*')
        .eq('artist_slug', artist)
        .eq('song_slug', songSlug)
        .single()

      if (error) {
        addDebugLog(`❌ Supabase error: ${error.message}`);
        setLoadingMessage('Failed to load song data')
        return;
      }
      
      if (!data) {
        addDebugLog('❌ Song not found in database');
        setLoadingMessage('Song not found')
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
        setLoadingMessage('No stems found')
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
      setEchoes(Object.fromEntries(stemObjs.map(s => [s.label, 0])));
      setSelectedEffects(Object.fromEntries(stemObjs.map(s => [s.label, 'reverb'])));
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
      setReverbs(Object.fromEntries(stemObjs.map(s => [s.label, {
        mix: 0,
        width: 1.0,
        damp: 0.5,
        roomSize: 0.8,
        predelayMs: 0,
        lowCutHz: 0,
        enabled: false
      }])));
      
      // Initialize echo configs with default values
      setEchoes(Object.fromEntries(stemObjs.map(s => [s.label, {
        dry: 1.0, // Always keep dry at full volume
        wet: 0.0, // Start at 0% wet on main knob
        bpm: 128,
        beats: 0.5,
        decay: 0.5,
        enabled: false
      }])));
      
      // Initialize global flanger config with default values
      setGlobalFlanger({
        wet: 0.7,
        depth: 0.16,
        lfoBeats: 16,
        bpm: data.bpm || 128,
        clipperThresholdDb: -3,
        clipperMaximumDb: 6,
        stereo: false,
        enabled: false
      });

    }

      fetchSong();
  }, [artist, songSlug])

  // Separate effect to auto-load stems when both timeline and song data are ready
  useEffect(() => {
    console.log('🔍 Auto-load check:', { 
      timelineReady, 
      hasSongData: !!songData, 
      stemsCount: stems.length, 
      allAssetsLoaded, 
      loadingStems,
      hasAudioEngine: !!mixerEngineRef.current?.audioEngine
    });
    
    if (timelineReady && songData && stems.length > 0 && !allAssetsLoaded && !loadingStems && mixerEngineRef.current?.audioEngine) {
      addDebugLog('🚀 Auto-starting stem loading...');
      setLoadingMessage('Preparing to load stems...')
      setLoadingProgress(70)
      // Add a longer delay to ensure audio engine is fully ready
      setTimeout(() => {
        // Double-check that everything is still ready before loading
        if (mixerEngineRef.current?.audioEngine && stems.length > 0) {
          loadStemsIntoTimeline()
        } else {
          addDebugLog('⚠️ Audio engine not ready, retrying in 1 second...');
          setTimeout(() => {
            if (mixerEngineRef.current?.audioEngine && stems.length > 0) {
              loadStemsIntoTimeline()
            }
          }, 1000);
        }
      }, 1000) // Increased from 500ms to 1000ms
    }
  }, [timelineReady, songData, stems.length, allAssetsLoaded, loadingStems])


  // ==================== 🎵 Load Stems Function ====================
  const loadStemsIntoTimeline = async () => {
    if (!timelineReady || !stems.length || !mixerEngineRef.current) {
      addDebugLog('❌ Cannot load stems - timeline not ready or no stems');
        return;
      }

    try {
      addDebugLog(`🎵 Loading ${stems.length} stems into timeline...`);
      setLoadingMessage('Preparing audio stems...')
      setLoadingProgress(75)
      setLoadingStems(true);
      setAllAssetsLoaded(false);
      setLoadedStemsCount(0);
      
      // Convert stems to timeline format
      let stemData = stems.map(stem => ({
        name: stem.label,
        url: stem.file, // file field already contains full Supabase storage URL
        label: stem.label
      }));

      // Skip file size optimization for now to prevent hanging
      addDebugLog('📊 Using original stem order (optimization disabled)');

      // Check mobile memory limits
      const maxStemsForMobile = 15; // Limit to prevent 1GB+ memory usage
      const shouldLimitStems = isMobile && stemData.length > maxStemsForMobile;
      
      if (shouldLimitStems) {
        addDebugLog(`📱 Mobile detected with ${stemData.length} stems - limiting to ${maxStemsForMobile} for memory optimization`);
        stemData = stemData.slice(0, maxStemsForMobile);
        addDebugLog(`⚠️ Using first ${maxStemsForMobile} stems only on mobile`);
      }

      // Set up the callback to wait for all assets to be downloaded
      let assetsDownloadedPromise = new Promise<void>((resolve) => {
        if (mixerEngineRef.current?.audioEngine) {
          // Set up progress tracking for individual stems
          (mixerEngineRef.current.audioEngine as any).onStemDecoded = (decodedCount: number, totalCount: number) => {
            setLoadedStemsCount(decodedCount);
            const progress = 75 + (decodedCount / totalCount) * 20; // 75-95% for stem loading
            setLoadingProgress(progress);
            setLoadingMessage(`Loading stem ${decodedCount}/${totalCount}...`);
            addDebugLog(`✅ Stem ${decodedCount}/${totalCount} decoded and loaded`);
          };
          
          (mixerEngineRef.current.audioEngine as any).onAllAssetsDownloaded = () => {
            addDebugLog('✅ All assets downloaded and decoded!');
            setLoadingProgress(95);
            setLoadingMessage('Finalizing mixer...');
            setAllAssetsLoaded(true);
            setLoadingStems(false);
            resolve();
          };
        }
      });

      // Load stems (Thomas's system handles memory optimization)
      addDebugLog(`🎵 Sending ${stemData.length} stems to timeline processor...`);
      await mixerEngineRef.current.loadStemsFromSupabase(stemData);
      
      // Initialize progress counter
      setLoadedStemsCount(0);
      addDebugLog(`📤 Sent ${stemData.length} stems to processor - waiting for download...`);

      // Wait for all assets to be actually downloaded and decoded
      await assetsDownloadedPromise;
      
      
    } catch (error) {
      addDebugLog(`❌ Failed to load stems: ${error}`);
      setAllAssetsLoaded(false);
        setLoadingStems(false);
      }
    };

  // ==================== 🎛️ Audio Control Functions ====================
  const setTrackVolume = (stemLabel: string, volume: number) => {
    console.log(`🎚️ setTrackVolume called with:`, { stemLabel, volume, stemsLength: stems.length, stems: stems.map(s => s.label) });
    
    if (!mixerEngineRef.current?.audioEngine) {
      console.log(`🎚️ ERROR: No audio engine available`);
      return;
    }
    
    const stemIndex = stems.findIndex(s => s.label === stemLabel);
    console.log(`🎚️ Found stem index:`, stemIndex);
    
    if (stemIndex === -1) {
      console.log(`🎚️ ERROR: Stem ${stemLabel} not found in stems array`);
      return;
    }
    
    const trackId = `track_${stemIndex}`;
    console.log(`🎚️ UI: Setting volume for ${stemLabel} (index: ${stemIndex}, trackId: ${trackId}) to ${volume}`);
    
    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "setTrackVolume", 
        trackId: trackId,
        volume: volume 
      }
    });
    
    addDebugLog(`🎚️ Volume set to ${(volume * 100).toFixed(0)}% for ${stemLabel}`);
  };


  const setTrackMute = (stemLabel: string, muted: boolean) => {
    if (!mixerEngineRef.current?.audioEngine) return;
    
    const stemIndex = stems.findIndex(s => s.label === stemLabel);
    if (stemIndex === -1) return;
    
    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "setTrackMute", 
        trackId: `track_${stemIndex}`,
        muted: muted 
      }
    });
    
    addDebugLog(`${muted ? '🔇 Muted' : '🔊 Unmuted'} ${stemLabel}`);
  };

  const setTrackSolo = (stemLabel: string, soloed: boolean) => {
    if (!mixerEngineRef.current?.audioEngine) return;
    
    const stemIndex = stems.findIndex(s => s.label === stemLabel);
    if (stemIndex === -1) return;
    
    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "setTrackSolo", 
        trackId: `track_${stemIndex}`,
        soloed: soloed 
      }
    });
    
    addDebugLog(`${soloed ? '🎤 Soloed' : '🎵 Unsoloed'} ${stemLabel}`);
  };

  const unsoloAll = () => {
    if (!mixerEngineRef.current?.audioEngine) return;
    
    // Update UI state
    setSolos(Object.fromEntries(stems.map(s => [s.label, false])));
    setMutes(Object.fromEntries(stems.map(s => [s.label, false])));
    
    // Clear all solo and mute states in audio engine
    stems.forEach((_, index) => {
      mixerEngineRef.current!.audioEngine!.sendMessageToAudioProcessor({
        type: "command",
        data: { 
          command: "setTrackSolo", 
          trackId: `track_${index}`,
          soloed: false 
        }
      });
      mixerEngineRef.current!.audioEngine!.sendMessageToAudioProcessor({
        type: "command",
        data: { 
          command: "setTrackMute", 
          trackId: `track_${index}`,
          muted: false 
        }
      });
    });
    
    addDebugLog('🎵 Cleared all solo and mute states');
  };

  const setVarispeedControl = (speed: number, isNatural: boolean) => {
    if (!mixerEngineRef.current?.audioEngine) return;
    
    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "setVarispeed", 
        speed: speed,
        isNatural: isNatural
      }
    });
    
    addDebugLog(`🎚️ Varispeed set to ${speed.toFixed(2)}x (${isNatural ? 'Natural' : 'Stretch'} mode)`);
  };

  // ==================== 🎧 DJ Scratching Functions ====================
  const handleScratchBegin = () => {
    if (!mixerEngineRef.current?.audioEngine) return;
    mixerEngineRef.current.audioEngine.scratchBegin();
    console.log('🎧 Starting scratch mode');
  };

  const handleScratch = (velocity: number, time: number) => {
    if (!mixerEngineRef.current?.audioEngine) return;
    mixerEngineRef.current.audioEngine.scratchMove(velocity, time);
  };

  const handleScratchEnd = () => {
    if (!mixerEngineRef.current?.audioEngine) return;
    mixerEngineRef.current.audioEngine.scratchEnd();
    console.log('🎧 Ending scratch mode');
  };

  // ==================== 🎛️ Reverb Control Functions ====================
  const setReverbEnabled = (stemLabel: string, enabled: boolean) => {
    if (!mixerEngineRef.current?.audioEngine) return;
    
    const stemIndex = stems.findIndex(s => s.label === stemLabel);
    if (stemIndex === -1) return;
    
    const trackId = `track_${stemIndex}`;
    
    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "setReverbEnabled", 
        trackId: trackId,
        enabled: enabled
      }
    });
    
    addDebugLog(`${enabled ? '🔊' : '🔇'} Reverb ${enabled ? 'enabled' : 'disabled'} for ${stemLabel}`);
  };

  const setReverbMix = (stemLabel: string, mix: number) => {
    if (!mixerEngineRef.current?.audioEngine) return;
    
    const stemIndex = stems.findIndex(s => s.label === stemLabel);
    if (stemIndex === -1) return;
    
    const trackId = `track_${stemIndex}`;
    
    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "setReverbMix", 
        trackId: trackId,
        mix: mix
      }
    });
    
    addDebugLog(`🎚️ Reverb mix set to ${(mix * 100).toFixed(0)}% for ${stemLabel}`);
  };

  // ==================== 🎛️ Echo Control Functions ====================
  const setEchoEnabled = (stemLabel: string, enabled: boolean) => {
    if (!mixerEngineRef.current?.audioEngine) return;
    
    const stemIndex = stems.findIndex(s => s.label === stemLabel);
    if (stemIndex === -1) return;
    
    const trackId = `track_${stemIndex}`;
    
    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "setEchoEnabled", 
        trackId: trackId,
        enabled: enabled
      }
    });
    
    addDebugLog(`${enabled ? '🔊' : '🔇'} Echo ${enabled ? 'enabled' : 'disabled'} for ${stemLabel}`);
  };

  const setEchoWet = (stemLabel: string, wet: number) => {
    if (!mixerEngineRef.current?.audioEngine) return;
    
    const stemIndex = stems.findIndex(s => s.label === stemLabel);
    if (stemIndex === -1) return;
    
    const trackId = `track_${stemIndex}`;
    
    mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "setEchoWet", 
        trackId: trackId,
        wet: wet
      }
    });
    
    addDebugLog(`🎚️ Echo wet set to ${(wet * 100).toFixed(0)}% for ${stemLabel}`);
  };

  // ==================== 🎵 Playback Functions ====================
  const playAll = useCallback(async () => {
    if (!mixerEngineRef.current || !timelineReady) return;
    
    try {
      // On iOS: Start silent audio track FIRST (like unmute.js does)
      // This forces WebAudio onto the media channel instead of ringer channel
      if (isIOS && silentModeBypassRef.current) {
        const audio = silentModeBypassRef.current;
        
        // Recreate channel tag if destroyed (page was hidden)
        if (audio.src === 'about:blank' || !audio.src) {
          const huffman = (count: number, repeatStr: string): string => {
            let e = repeatStr
            for (; count > 1; count--) e += repeatStr
            return e
          }
          const silence = "data:audio/mpeg;base64,//uQx" + huffman(23, "A") + "WGluZwAAAA8AAAACAAACcQCA" + huffman(16, "gICA") + huffman(66, "/") + "8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkI" + huffman(320, "A") + "//sQxAADgnABGiAAQBCqgCRMAAgEAH" + huffman(15, "/") + "7+n/9FTuQsQH//////2NG0jWUGlio5gLQTOtIoeR2WX////X4s9Atb/JRVCbBUpeRUq" + huffman(18, "/") + "9RUi0f2jn/+xDECgPCjAEQAABN4AAANIAAAAQVTEFNRTMuMTAw" + huffman(97, "V") + "Q=="
          audio.src = silence
          audio.load()
          // Wait for audio to be ready before playing
          await new Promise((resolve) => {
            if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
              resolve(undefined);
            } else {
              audio.addEventListener('canplay', () => resolve(undefined), { once: true });
            }
          });
        }
        
        // Ensure silent audio is at the start (no remnant audio)
        if (!audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
        
        try {
          await audio.play();
          audioUnlockedRef.current = true;
          setAudioUnlocked(true);
          addDebugLog('🔊 Silent audio started (iOS media channel unlock)');
          // Small delay to ensure silent audio is stable before mixer starts
          // This prevents any audio glitch from the silent track
          await new Promise(resolve => setTimeout(resolve, 20));
        } catch (err: any) {
          addDebugLog('⚠️ Silent audio start failed: ' + (err?.message || 'Unknown'));
        }
      }
      
      // CRITICAL: Stop mixer first to clear any buffered audio and reset state
      // This prevents remnant audio from playing before the actual song starts
      if (isPlaying) {
        try {
          mixerEngineRef.current.pause?.();
          mixerEngineRef.current.stop?.();
          addDebugLog('🛑 Stopped mixer to clear buffers');
          // Small delay to ensure buffers are cleared
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (err: any) {
          console.warn('Failed to stop mixer:', err);
        }
      }
      
      // Resume AudioContext if needed
      const webaudioManager = mixerEngineRef.current.audioEngine?.webaudioManager as any;
      const ctx = webaudioManager?.audioContext;
      
      if (ctx && ctx.state !== 'running') {
        try {
          await ctx.resume();
          addDebugLog('🔓 AudioContext resumed');
        } catch (err: any) {
          console.warn('Failed to resume AudioContext:', err);
        }
      }
      
      // Ensure we start from position 0 to avoid false start/audio glitch
      // This prevents any buffered audio from playing before the actual song starts
      if (typeof mixerEngineRef.current?.seek === 'function') {
        mixerEngineRef.current.seek(0);
        addDebugLog('🎯 Reset to position 0 before playback');
        // Small delay to ensure seek completes
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Start playback IMMEDIATELY
      mixerEngineRef.current.play?.();
      setIsPlaying(true);
      addDebugLog('▶️ Playback started');
      
      // Backup: Verify playback started and retry if needed
      setTimeout(() => {
        try {
          const initialTime =
            typeof mixerEngineRef.current?.getCurrentTime === 'function'
              ? (mixerEngineRef.current.getCurrentTime() as number) || 0
              : 0;
          
          setTimeout(() => {
            try {
              const nowTime =
                typeof mixerEngineRef.current?.getCurrentTime === 'function'
                  ? (mixerEngineRef.current.getCurrentTime() as number) || 0
                  : 0;
              const progressed = nowTime > initialTime + 0.005; // ~5ms progress
              
              if (!progressed && mixerEngineRef.current) {
                // Playback didn't start - retry
                mixerEngineRef.current.play?.();
                addDebugLog('▶️ Retrying playback');
              }
            } catch {
              // no-op
            }
          }, 100);
        } catch {
          // no-op
        }
      }, 50);
    } catch (error) {
      addDebugLog(`❌ Failed to play: ${error}`);
      console.error('Playback error:', error);
    }
  }, [timelineReady, addDebugLog, isIOS]);

  const pauseAll = useCallback(() => {
    if (!mixerEngineRef.current) return;
    
    try {
      mixerEngineRef.current.pause();
      setIsPlaying(false);
      addDebugLog('⏸️ Playback paused');
      
      // On iOS: Keep silent audio playing to maintain media channel access
      // (like unmute.js - keeps the channel open for when playback resumes)
      // Don't pause it - let the user control it via the unmute button
    } catch (error) {
      addDebugLog(`❌ Failed to pause: ${error}`);
    }
  }, [addDebugLog]);

  // ==================== 🎵 Media Session API (Mobile Controls) ====================
  useEffect(() => {
    if (!songData || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const updateMediaSession = () => {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: songData.title,
          artist: songData.artist_name,
          album: 'Munyard Mixer',
          artwork: songData.background_video ? [
            { src: songData.background_video, sizes: '1920x1080', type: 'image/jpeg' }
          ] : []
        });

        // Play/Pause handlers for lock screen controls
        navigator.mediaSession.setActionHandler('play', async () => {
          if (mixerEngineRef.current && !isPlaying) {
            await playAll();
          }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (mixerEngineRef.current && isPlaying) {
            pauseAll();
          }
        });

        // Update playback state
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch (error) {
        console.warn('Media Session API not supported:', error);
      }
    };

    updateMediaSession();
    
    // Update when playback state changes
    const interval = setInterval(() => {
      if (navigator.mediaSession && songData) {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [songData, isPlaying, playAll, pauseAll]);

  // ==================== 🔋 Audio Context Wake-Up (Prevent Suspension) ====================
  useEffect(() => {
    if (!mixerEngineRef.current?.audioEngine?.webaudioManager) return;

    const webaudioManager = mixerEngineRef.current.audioEngine.webaudioManager as any;
    const ctx = webaudioManager?.audioContext;
    if (!ctx) return;

    // Wake up audio context periodically to prevent suspension
    const wakeUpInterval = setInterval(async () => {
      if (ctx.state === 'suspended' && isPlaying) {
        try {
          await ctx.resume();
          addDebugLog('🔋 Audio context woken up');
        } catch (error) {
          console.warn('Failed to resume audio context:', error);
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(wakeUpInterval);
  }, [isPlaying]);

  const stopAll = () => {
    if (!mixerEngineRef.current) return;
    
    try {
      mixerEngineRef.current.stop();
      setIsPlaying(false);
      // Don't set currentTime here - let the audio engine handle it
      // This ensures consistency with the seek behavior
      addDebugLog('⏹️ Playback stopped');
    } catch (error) {
      addDebugLog(`❌ Failed to stop: ${error}`);
    }
  };


  // (Scrubber removed)


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
    
    // Update the reverb config state
    setReverbs(prev => ({
      ...prev,
      [stemLabel]: config
    }))
    
    // Apply reverb settings to audio engine using the new system
    if (mixerEngineRef.current?.audioEngine) {
      const stemIndex = stems.findIndex(s => s.label === stemLabel)
      if (stemIndex !== -1) {
        const trackId = `track_${stemIndex}`
        
        // Send all reverb parameters to the audio processor
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setReverbEnabled", 
            trackId: trackId,
            enabled: config.enabled
          }
        })
        
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setReverbMix", 
            trackId: trackId,
            mix: config.mix
          }
        })
        
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setReverbRoomSize", 
            trackId: trackId,
            roomSize: config.roomSize
          }
        })
        
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setReverbDamp", 
            trackId: trackId,
            damp: config.damp
          }
        })
        
        console.log(`Applied reverb config to ${stemLabel}:`, config)
      }
    }
  }

  // ==================== 🎛️ ECHO CONFIGURATION ====================
  const handleEchoConfigOpen = (stemLabel: string, stemIndex: number, position?: { x: number; y: number }) => {
    setEchoConfigModal({
      isOpen: true,
      stemLabel,
      stemIndex,
      position
    })
  }

  const handleEchoConfigClose = () => {
    setEchoConfigModal({
      isOpen: false,
      stemLabel: '',
      stemIndex: 0
    })
  }

  const handleEchoConfigSave = (config: {
    dry: number
    wet: number
    bpm: number
    beats: number
    decay: number
    enabled: boolean
  }) => {
    const stemLabel = echoConfigModal.stemLabel
    
    // Update the echo config state
    setEchoes(prev => ({
      ...prev,
      [stemLabel]: config
    }))
    
    // Apply echo settings to audio engine using the new system
    if (mixerEngineRef.current?.audioEngine) {
      const stemIndex = stems.findIndex(s => s.label === stemLabel)
      if (stemIndex !== -1) {
        const trackId = `track_${stemIndex}`
        
        // Send all echo parameters to the audio processor
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setEchoEnabled", 
            trackId: trackId,
            enabled: config.enabled
          }
        })
        
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setEchoWet", 
            trackId: trackId,
            wet: config.wet
          }
        })
        
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setEchoBpm", 
            trackId: trackId,
            bpm: config.bpm
          }
        })
        
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setEchoBeats", 
            trackId: trackId,
            beats: config.beats
          }
        })
        
        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
          type: "command",
          data: { 
            command: "setEchoDecay", 
            trackId: trackId,
            decay: config.decay
          }
        })
        
        console.log(`Applied echo config to ${stemLabel}:`, config)
      }
    }
  }

  // ==================== 🎛️ GLOBAL FLANGER CONFIGURATION ====================
  const handleFlangerConfigOpen = () => {
    setFlangerConfigModal({
      isOpen: true
    })
  }

  const handleFlangerConfigClose = () => {
    setFlangerConfigModal({
      isOpen: false
    })
  }

  // ==================== 🎛️ GLOBAL COMPRESSOR CONFIGURATION ====================
  const handleCompressorConfigOpen = () => {
    setCompressorConfigModal({
      isOpen: true
    })
  }

  const handleCompressorConfigClose = () => {
    setCompressorConfigModal({
      isOpen: false
    })
  }

  const handleCompressorConfigChange = (config: {
    inputGainDb: number
    outputGainDb: number
    wet: number
    attackSec: number
    releaseSec: number
    ratio: number
    thresholdDb: number
    hpCutOffHz: number
    enabled: boolean
  }) => {
    // Update the global compressor config state in real-time
    setGlobalCompressor(config)
    
    // Apply global compressor using correct message format
    if (mixerEngineRef.current?.audioEngine) {
      console.log(`🎛️ Updating global compressor config in real-time:`, config);
      mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
        type: "command",
        data: { 
          command: "setCompressorConfig", 
          config: config
        }
      })
    }
  }

  const handleFlangerConfigChange = (config: {
    wet: number
    depth: number
    lfoBeats: number
    bpm: number
    clipperThresholdDb: number
    clipperMaximumDb: number
    stereo: boolean
    enabled: boolean
  }) => {
    // Update the global flanger config state in real-time
    setGlobalFlanger(config)
    
    // Apply global flanger using correct message format
    if (mixerEngineRef.current?.audioEngine) {
      console.log(`🎛️ Updating global flanger config in real-time:`, config);
      mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
        type: "command",
        data: { 
          command: "setFlangerConfig", 
          config: config
        }
      })
    }
  }

  const handleFlangerConfigSave = (config: {
    wet: number
    depth: number
    lfoBeats: number
    bpm: number
    clipperThresholdDb: number
    clipperMaximumDb: number
    stereo: boolean
    enabled: boolean
  }) => {
    // Update the global flanger config state
    setGlobalFlanger(config)
    
    // Apply global flanger using correct message format
    if (mixerEngineRef.current?.audioEngine) {
      console.log(`🎛️ Saving global flanger config:`, config);
      mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
        type: "flanger",
        wet: config.wet,
        depth: config.depth,
        lfoBeats: config.lfoBeats,
        bpm: config.bpm,
        clipperThresholdDb: config.clipperThresholdDb,
        clipperMaximumDb: config.clipperMaximumDb,
        stereo: config.stereo,
        enabled: config.enabled
      });
    }
  }

  const handleCompressorConfigSave = (config: {
    inputGainDb: number
    outputGainDb: number
    wet: number
    attackSec: number
    releaseSec: number
    ratio: number
    thresholdDb: number
    hpCutOffHz: number
    enabled: boolean
  }) => {
    // Update the global compressor config state
    setGlobalCompressor(config)
    
    // Apply global compressor using correct message format
    if (mixerEngineRef.current?.audioEngine) {
      console.log(`🎛️ Saving global compressor config:`, config);
      mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
        type: "compressor",
        inputGainDb: config.inputGainDb,
        outputGainDb: config.outputGainDb,
        wet: config.wet,
        attackSec: config.attackSec,
        releaseSec: config.releaseSec,
        ratio: config.ratio,
        thresholdDb: config.thresholdDb,
        hpCutOffHz: config.hpCutOffHz,
        enabled: config.enabled
      });
    }
  }

  // ==================== 🎨 UTILITY FUNCTIONS ====================
  function formatTime(secs: number) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ==================== 🎬 Loading Screen Completion Handler ====================
  const handleLoadingComplete = () => {
    setLoadingProgress(100);
    setLoadingMessage('Ready to mix!');
    setTimeout(() => {
      setShowLoadingScreen(false);
    }, 800);
  };

  // Auto-complete loading when all assets are loaded
  useEffect(() => {
    if (allAssetsLoaded && showLoadingScreen) {
      handleLoadingComplete();
    }
  }, [allAssetsLoaded, showLoadingScreen]);

  // Fallback: If loading gets stuck at 70%, show manual trigger after 2 seconds
  useEffect(() => {
    if (loadingProgress === 70 && !loadingStems && stems.length > 0) {
      const timer = setTimeout(() => {
        addDebugLog('⚠️ Loading seems stuck at 70%, attempting manual trigger...');
        if (timelineReady && stems.length > 0 && !allAssetsLoaded && mixerEngineRef.current?.audioEngine) {
          addDebugLog('🚀 Manual trigger: Starting stem loading...');
          loadStemsIntoTimeline();
        } else {
          addDebugLog('⚠️ Manual trigger failed - conditions not met');
        }
      }, 2000); // Reduced from 3 seconds to 2 seconds
      
      return () => clearTimeout(timer);
    }
  }, [loadingProgress, loadingStems, stems.length, timelineReady, allAssetsLoaded]);

  // ==================== 🎨 RENDER ====================
  return (
    <>
      {/* Show loading screen while loading */}
      {showLoadingScreen && (
        <PoolsuiteLoadingScreen
          songTitle={songData?.title || 'Loading...'}
          artistName={songData?.artist_name || 'Unknown Artist'}
          progress={loadingProgress}
          loadingMessage={loadingMessage}
          onComplete={handleLoadingComplete}
          primaryColor={primary}
        />
      )}

      {/* Show main interface when loading is complete */}
      {!showLoadingScreen && songData && (
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
                min-height: clamp(280px, 40vh, 320px) !important;
              }
            }
            @media screen and (max-width: 374px) {
              /* Very small screens (iPhone SE, iPhone 12 mini) */
              .mixer-module {
                min-height: 360px !important;
                max-height: 400px !important;
              }
            }
            @media screen and (min-width: 375px) and (max-width: 413px) {
              /* Small screens (iPhone 13, iPhone 14) */
              .mixer-module {
                min-height: 380px !important;
                max-height: 440px !important;
              }
            }
            @media screen and (max-width: 767px) {
              /* All mobile screens */
              /* Lock vertical scrolling but allow horizontal scrolling for modules */
              body {
                overflow-x: hidden !important;
                overflow-y: hidden !important;
                position: fixed !important;
                width: 100% !important;
                height: 100% !important;
              }
              html {
                overflow-x: hidden !important;
                overflow-y: hidden !important;
                height: 100% !important;
              }
              .stems-container::-webkit-scrollbar {
                display: none;
              }
              .stems-container {
                -ms-overflow-style: none;
                scrollbar-width: none;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                touch-action: pan-x !important;
              }
              .mixer-module {
                min-height: clamp(360px, 50vh, 480px) !important;
              }
              .mixer-module .track-label {
                min-height: clamp(32px, 5vh, 40px) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: clamp(3px, 1vw, 6px) clamp(4px, 1.5vw, 6px) !important;
                word-wrap: break-word !important;
                hyphens: auto !important;
                font-size: clamp(10px, 2.5vw, 12px) !important;
              }
            }
          `}</style>
          

          {/* 🎥 Background Video - Only for Transparent theme */}
          {songData?.background_video && songData.color === 'Transparent' && (
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
                zIndex: 0,
                pointerEvents: 'none',
                backgroundColor: 'transparent',
              }}
              onError={(e) => {
                console.error('Background video failed to load:', e)
              }}
              onLoadedData={() => {
                console.log('Background video loaded successfully')
              }}
            />
          )}

          {/* 🧱 Main Layout */}
          <main
            className={`min-h-screen font-sans relative ${
              songData?.color === 'Transparent'
                ? 'bg-transparent text-[#B8001F]'
                : 'bg-[#FCFAEE] text-[#B8001F]'
            }`}
            style={{
              minHeight: '100dvh',
              zIndex: 1,
              position: 'relative',
              paddingBottom: isVerySmallScreen 
                ? 'clamp(140px, 20vh, 160px)' 
                : isSmallScreen 
                  ? 'clamp(150px, 20vh, 160px)' 
                  : isMobile 
                    ? 'clamp(160px, 20vh, 180px)' 
                    : '60px',
            }}
          >
            {/* 🔇 Mobile Silent Mode Unmute Floating Button (SVG in primary color) */}
            {isMobile && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleAudioUnlock();
                }}
                aria-label={audioUnlocked ? 'Mute (disable background/silent mode audio)' : 'Unmute (enable audio in silent mode)'}
                className="pressable flex items-center justify-center"
                style={{
                  position: 'fixed',
                  top: '12px',
                  right: '12px',
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#FCFAEE',
                  color: 'inherit',
                  border: `1px solid ${primary}`,
                  zIndex: 1000,
                }}
                title={audioUnlocked ? 'Audio unlocked (tap to mute)' : 'Audio muted - tap to unlock (required for silent mode)'}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M4 10v4h3l5 4V6l-5 4H4z"
                    stroke={primary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  {!audioUnlocked && (
                    <path
                      d="M6 6L18 18"
                      stroke={primary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {audioUnlocked && (
                    <>
                      <path
                        d="M16 9c1.333 1.333 1.333 4.667 0 6"
                        stroke={primary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M18.5 7.5c2.333 2.333 2.333 6.667 0 9"
                        stroke={primary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.8"
                      />
                    </>
                  )}
                </svg>
              </button>
            )}
            {/* 🏷️ Song Title */}
            <h1
              className="village text-center mb-8"
              style={{
                fontSize: isVerySmallScreen 
                  ? 'clamp(32px, 8vw, 40px)' 
                  : isSmallScreen 
                    ? 'clamp(40px, 10vw, 48px)' 
                    : isMobile 
                      ? 'clamp(44px, 12vw, 56px)' 
                      : 'clamp(64px, 8vw, 96px)',
                letterSpacing: '0.05em',
                lineHeight: '1.1',
                color: primary,
                padding: isMobile ? '0 clamp(12px, 4vw, 16px)' : '0',
              }}
            >
              {songData?.title}
            </h1>


            {/* ▶️ Main Playback Controls */}
            <div className={`flex justify-center items-center mb-2 ${isMobile ? 'gap-2' : 'gap-8'} ${isMobile ? 'px-2' : ''}`} style={{
              gap: isVerySmallScreen ? '8px' : isSmallScreen ? '12px' : isMobile ? '16px' : '32px',
              paddingLeft: isMobile ? 'clamp(8px, 2vw, 16px)' : '0',
              paddingRight: isMobile ? 'clamp(8px, 2vw, 16px)' : '0',
            }}>
              {/* (Mobile unmute button moved to floating top-right) */}

              <button
                onClick={playAll}
                disabled={!timelineReady || !allAssetsLoaded}
                className={`pressable font-mono tracking-wide flex items-center gap-2 transition-all duration-200 ${
                  !timelineReady || !allAssetsLoaded
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-60' 
                    : 'hover:opacity-90'
                }`}
                style={{
                  ...(timelineReady && allAssetsLoaded ? { backgroundColor: primary, color: 'white' } : {}),
                  padding: isVerySmallScreen 
                    ? '6px 10px' 
                    : isSmallScreen 
                      ? '8px 12px' 
                      : isMobile 
                        ? '8px 16px' 
                        : '12px 24px',
                  fontSize: isVerySmallScreen 
                    ? '11px' 
                    : isSmallScreen 
                      ? '12px' 
                      : isMobile 
                        ? '13px' 
                        : '14px',
                }}
              >
                Play
              </button>

              <button
                onClick={pauseAll}
                disabled={!timelineReady}
                className="pressable text-white font-mono tracking-wide"
                style={{
                  backgroundColor: primary,
                  padding: isVerySmallScreen 
                    ? '6px 10px' 
                    : isSmallScreen 
                      ? '8px 12px' 
                      : isMobile 
                        ? '8px 16px' 
                        : '12px 24px',
                  fontSize: isVerySmallScreen 
                    ? '11px' 
                    : isSmallScreen 
                      ? '12px' 
                      : isMobile 
                        ? '13px' 
                        : '14px',
                }}
              >
                Pause
              </button>

              <button
                onClick={unsoloAll}
                className="pressable text-white font-mono tracking-wide"
                style={{
                  backgroundColor: primary,
                  padding: isVerySmallScreen 
                    ? '6px 10px' 
                    : isSmallScreen 
                      ? '8px 12px' 
                      : isMobile 
                        ? '8px 16px' 
                        : '12px 24px',
                  fontSize: isVerySmallScreen 
                    ? '11px' 
                    : isSmallScreen 
                      ? '12px' 
                      : isMobile 
                        ? '13px' 
                        : '14px',
                }}
              >
                UNSOLO
              </button>
            </div>

            {/* 🎛️ Secondary Controls - Desktop Only */}
            {!isMobile && (
              <div className={`flex justify-center mb-1 gap-8`}>

              {/* Master Effect Dropdown */}
              <div className="relative">
                <div 
                  className="pressable font-mono tracking-wide cursor-pointer"
                  style={{ 
                    backgroundColor: '#FCFAEE',
                    color: primary,
                    border: `1px solid ${primary}`,
                      padding: '8px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={() => {
                    const dropdown = document.getElementById('master-effect-dropdown')
                    if (dropdown) {
                      dropdown.classList.toggle('hidden')
                    }
                  }}
                >
                  <span>EFFECT</span>
                  <span style={{ fontSize: '8px' }}>▼</span>
                </div>
                
                {/* Custom Dropdown Menu */}
                <div 
                  id="master-effect-dropdown"
                  className="absolute left-0 bg-[#F5F5DC] rounded shadow-lg z-50 hidden min-w-full"
                  style={{ 
                    top: '100%', 
                    marginTop: '4px',
                    border: `1px solid ${primary}`
                  }}
                >
                  <div 
                    className="px-2 py-1 cursor-pointer hover:text-[#FCFAEE] font-mono transition-colors"
                    style={{ 
                      fontSize: '10px',
                      color: primary
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = primary
                      e.currentTarget.style.color = '#FCFAEE'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = primary
                    }}
                    onClick={() => {
                      setSelectedMasterEffect('flanger')
                      document.getElementById('master-effect-dropdown')?.classList.add('hidden')
                    }}
                  >
                    FLANGER
                  </div>
                  <div 
                    className="px-2 py-1 cursor-pointer hover:text-[#FCFAEE] font-mono transition-colors"
                    style={{ 
                      fontSize: '10px',
                      color: primary
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = primary
                      e.currentTarget.style.color = '#FCFAEE'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = primary
                    }}
                    onClick={() => {
                      setSelectedMasterEffect('compressor')
                      document.getElementById('master-effect-dropdown')?.classList.add('hidden')
                    }}
                  >
                    COMPRESSOR
                  </div>
                </div>
              </div>

              {/* Master Effect Buttons */}
              {selectedMasterEffect === 'flanger' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      // Just open the modal for settings - don't toggle on/off
                      handleFlangerConfigOpen()
                    }}
                      className="pressable px-4 py-2 font-mono tracking-wide"
                    style={{ 
                      backgroundColor: '#FCFAEE',
                      color: primary,
                      border: `1px solid ${primary}`
                    }}
                  >
                    FLANGE
                  </button>
                  
                  {/* Toggle Switch */}
                  <div 
                    className="flex items-center cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      const currentEnabled = globalFlanger?.enabled || false
                      const newWet = currentEnabled ? 0 : 0.5
                      
                      const newConfig = {
                        ...(globalFlanger || defaultFlangerConfig),
                        wet: newWet,
                        enabled: !currentEnabled
                      }
                      setGlobalFlanger(newConfig)
                      
                      if (mixerEngineRef.current?.audioEngine) {
                        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                          type: "command",
                          data: { 
                            command: "setFlangerConfig", 
                            config: newConfig
                          }
                        });
                      }
                    }}
                    style={{ marginLeft: '8px' }}
                  >
                    <div 
                      className="relative rounded-full border transition-all duration-200 ease-in-out"
                      style={{ 
                        width: '44px',
                        height: '24px',
                        backgroundColor: (globalFlanger?.enabled || false) ? primary : '#FCFAEE',
                        borderColor: primary,
                        borderWidth: '1px',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div 
                        className="absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm"
                        style={{ 
                          width: '18px',
                          height: '18px',
                          transform: (globalFlanger?.enabled || false) ? 'translateX(20px)' : 'translateX(2px)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      // Just open the modal for settings - don't toggle on/off
                      handleCompressorConfigOpen()
                    }}
                      className="pressable px-4 py-2 font-mono tracking-wide"
                    style={{ 
                      backgroundColor: '#FCFAEE',
                      color: primary,
                      border: `1px solid ${primary}`
                    }}
                  >
                    COMPRESS
                  </button>
                  
                  {/* Toggle Switch */}
                  <div 
                    className="flex items-center cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      const currentEnabled = globalCompressor?.enabled || false
                      const newWet = currentEnabled ? 0 : 1.0
                      
                      const newConfig = {
                        ...(globalCompressor || defaultCompressorConfig),
                        wet: newWet,
                        enabled: !currentEnabled
                      }
                      setGlobalCompressor(newConfig)
                      
                      if (mixerEngineRef.current?.audioEngine) {
                        mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                          type: "command",
                          data: { 
                            command: "setCompressorConfig", 
                            config: newConfig
                          }
                        });
                      }
                    }}
                    style={{ marginLeft: '8px' }}
                  >
                    <div 
                      className="relative rounded-full border transition-all duration-200 ease-in-out"
                      style={{ 
                        width: '44px',
                        height: '24px',
                        backgroundColor: (globalCompressor?.enabled || false) ? primary : '#FCFAEE',
                        borderColor: primary,
                        borderWidth: '1px',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div 
                        className="absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm"
                        style={{ 
                          width: '18px',
                          height: '18px',
                          transform: (globalCompressor?.enabled || false) ? 'translateX(20px)' : 'translateX(2px)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}



            {/* Spacing for modules */}
            <div className="mb-6 mt-6"></div>

            {/* 🎚️ Mixer Modules */}
            <div
              className="stems-container"
              style={{
                width: '100%',
                // Scale modules a bit smaller on mobile so the full module + VARISPEED controls fit comfortably.
                height: isMobile 
                  ? (isVerySmallScreen 
                      ? 'clamp(340px, 52vh, 430px)' 
                      : isSmallScreen 
                        ? 'clamp(360px, 52vh, 460px)' 
                        : 'clamp(380px, 52vh, 500px)')
                  : 'auto',
                maxHeight: isMobile 
                  ? (isVerySmallScreen 
                      ? '430px' 
                      : isSmallScreen 
                        ? '460px' 
                        : '500px')
                  : 'none',
                minHeight: isMobile 
                  ? (isVerySmallScreen 
                      ? '340px' 
                      : isSmallScreen 
                        ? '360px' 
                        : '380px')
                  : 'auto',
                marginTop: '-20px',
                marginBottom: isMobile ? 'clamp(12px, 3vh, 24px)' : '0px',
                overflowX: 'auto', // Enable horizontal scrolling
                overflowY: 'hidden',
                touchAction: isMobile ? 'pan-x' : 'auto', // Allow horizontal panning on mobile
              }}
            >
              <div
                className="flex"
                style={{
                  width: '100%', // Full width container
                  justifyContent: 'center', // Always center the modules
                  flexWrap: 'nowrap',
                  margin: '0 auto',
                  padding: isMobile 
                    ? (isVerySmallScreen ? '0 4px' : isSmallScreen ? '0 6px' : '0 8px')
                    : '0 8px',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch',
                  overflowY: 'hidden',
                  height: '100%',
                  alignItems: 'center',
                  gap: isVerySmallScreen 
                    ? '4px' 
                    : isSmallScreen 
                      ? '6px' 
                      : isMobile 
                        ? '8px' 
                        : stems.length >= 6 
                          ? '16px' 
                          : '32px',
                }}
              >
                {stems.map((stem) => {
                  const isTransparent = songData?.color === 'Transparent'
                  return (
                  <div
                    key={stem.label}
                    className="mixer-module"
                    style={{
                      width: isVerySmallScreen 
                        ? '70px' 
                        : isSmallScreen 
                          ? '75px' 
                          : isMobile 
                            ? '80px' 
                            : stems.length >= 6 
                              ? '86px' 
                              : '96px',
                      backgroundColor: isTransparent ? 'rgba(255,255,255,0.05)' : primary,
                      border: isTransparent ? `1px solid ${primary}` : '1px solid #444',
                      boxShadow: isTransparent 
                        ? '0 0 6px rgba(255,255,255,0.2)' 
                        : 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
                      backdropFilter: isTransparent ? 'blur(2px)' : 'none',
                      borderRadius: '10px',
                      padding: isVerySmallScreen 
                        ? '8px' 
                        : isSmallScreen 
                          ? '10px' 
                          : isMobile 
                            ? '12px' 
                            : '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: isMobile 
                        ? (isVerySmallScreen 
                            ? 'calc(100% - 20px)' 
                            : isSmallScreen 
                              ? 'calc(100% - 16px)' 
                              : 'calc(100% - 12px)')
                        : undefined,
                      maxHeight: isMobile 
                        ? (isVerySmallScreen 
                            ? '400px' 
                            : isSmallScreen 
                              ? '440px' 
                              : '480px')
                        : undefined,
                      justifyContent: 'flex-start',
                      flexShrink: 0,
                      minWidth: isVerySmallScreen 
                        ? '70px' 
                        : isSmallScreen 
                          ? '75px' 
                          : isMobile 
                            ? '80px' 
                            : 'auto',
                    }}
                  >
                    <div style={{ 
                      width: '16px', 
                      height: isVerySmallScreen 
                        ? '24px' 
                        : isSmallScreen 
                          ? '28px' 
                          : isMobile 
                            ? '30px' 
                            : '40px', 
                      marginBottom: isVerySmallScreen 
                        ? '12px' 
                        : isSmallScreen 
                          ? '14px' 
                          : isMobile 
                            ? '16px' 
                            : '18px' 
                    }} />

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        fontSize: isVerySmallScreen 
                          ? '9px' 
                          : isSmallScreen 
                            ? '9.5px' 
                            : isMobile 
                              ? '10px' 
                              : '10px',
                        color: 'white',
                        flexGrow: 1,
                        justifyContent: 'center',
                        marginBottom: isVerySmallScreen 
                          ? '16px' 
                          : isSmallScreen 
                            ? '18px' 
                            : isMobile 
                              ? '20px' 
                              : '30px',
                      }}
                    >
                      <span style={{ marginBottom: '4px' }}>LEVEL</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volumes[stem.label] ?? 1}
                          onChange={(e) => {
                            const volume = parseFloat(e.target.value);
                            setVolumes((prev) => ({ ...prev, [stem.label]: volume }));
                            setTrackVolume(stem.label, volume);
                          }}
                          className="volume-slider"
                          style={{
                            writingMode: 'bt-lr' as any,
                            WebkitAppearance: 'slider-vertical',
                            width: '4px',
                            height: isVerySmallScreen 
                              ? '100px' 
                              : isSmallScreen 
                                ? '120px' 
                                : isMobile 
                                  ? '140px' 
                                  : undefined,
                            background: 'transparent',
                          }}
                        />
                      </div>
                    </div>

                    {/* Effect Dropdown & Knob */}
                    <div style={{ marginBottom: isMobile ? '20px' : '32px', textAlign: 'center' }}>
                      <div className="flex flex-col items-center text-xs select-none knob-container" style={{ color: 'white' }}>
                        {/* Effect Type Dropdown */}
                        <div className="mb-0.5 relative">
                          {/* Custom Dropdown Menu - positioned above */}
                          <div 
                            id={`effect-dropdown-${stem.label}`}
                            className="absolute left-0 bg-[#F5F5DC] rounded shadow-lg z-50 hidden min-w-full"
                            style={{ 
                              bottom: '100%', 
                              marginBottom: '4px',
                              border: `1px solid ${primary}`
                            }}
                          >
                            <div 
                              className="px-2 py-1 cursor-pointer font-mono transition-colors"
                              style={{ 
                                fontSize: '10px',
                                color: primary
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = primary;
                                e.currentTarget.style.color = '#FCFAEE';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = primary;
                              }}
                              onClick={() => {
                                setSelectedEffects(prev => ({ ...prev, [stem.label]: 'reverb' }))
                                document.getElementById(`effect-dropdown-${stem.label}`)?.classList.add('hidden')
                              }}
                            >
                              REVERB
                            </div>
                            <div 
                              className="px-2 py-1 cursor-pointer font-mono transition-colors"
                              style={{ 
                                fontSize: '10px',
                                color: primary
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = primary;
                                e.currentTarget.style.color = '#FCFAEE';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = primary;
                              }}
                              onClick={() => {
                                setSelectedEffects(prev => ({ ...prev, [stem.label]: 'echo' }))
                                document.getElementById(`effect-dropdown-${stem.label}`)?.classList.add('hidden')
                              }}
                            >
                              ECHO
                            </div>
                          </div>
                          
                          <div 
                            className="text-[#FCFAEE] px-2 py-1 rounded font-mono cursor-pointer flex items-center justify-between transition-colors"
                            style={{ 
                              fontSize: '10px',
                              backgroundColor: primary,
                              border: `1px solid ${primary}`
                            }}
                            onMouseEnter={(e) => {
                              // Darken the color on hover
                              const rgb = primary.match(/\d+/g);
                              if (rgb) {
                                const r = Math.max(0, parseInt(rgb[0]) - 30);
                                const g = Math.max(0, parseInt(rgb[1]) - 30);
                                const b = Math.max(0, parseInt(rgb[2]) - 30);
                                e.currentTarget.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = primary;
                            }}
                            onClick={() => {
                              const dropdown = document.getElementById(`effect-dropdown-${stem.label}`)
                              if (dropdown) {
                                dropdown.classList.toggle('hidden')
                              }
                            }}
                          >
                            <span style={{ fontSize: '12px' }}>EFFECT</span>
                            <span className="ml-1" style={{ fontSize: '8px' }}>▼</span>
                          </div>
                        </div>
                        
                        {/* Config Button */}
                        <span 
                          className="mb-1 cursor-pointer hover:opacity-75"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const stemIndex = stems.findIndex(s => s.label === stem.label)
                            const effectType = selectedEffects[stem.label] || 'reverb'
                            if (effectType === 'reverb') {
                              handleReverbConfigOpen(stem.label, stemIndex, { x: e.clientX, y: e.clientY })
                            } else {
                              handleEchoConfigOpen(stem.label, stemIndex, { x: e.clientX, y: e.clientY })
                            }
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const stemIndex = stems.findIndex(s => s.label === stem.label)
                            const effectType = selectedEffects[stem.label] || 'reverb'
                            if (effectType === 'reverb') {
                              handleReverbConfigOpen(stem.label, stemIndex, { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY })
                            } else {
                              handleEchoConfigOpen(stem.label, stemIndex, { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY })
                            }
                          }}
                        >
                          {(selectedEffects[stem.label] || 'reverb') === 'reverb' ? 'REVERB' : 'ECHO'}
                        </span>
                        
                        {/* Effect Knob */}
                        <DelayKnob
                            value={
                              (selectedEffects[stem.label] || 'reverb') === 'reverb' 
                                ? (reverbs[stem.label]?.mix || 0)
                                : (echoes[stem.label]?.wet || 0)
                            }
                            onChange={(val) => {
                              const effectType = selectedEffects[stem.label] || 'reverb'
                              console.log(`🎛️ UI: ${effectType} knob changed for ${stem.label} to ${val}`);
                              
                              if (effectType === 'reverb') {
                                const currentConfig = reverbs[stem.label] || defaultReverbConfig
                                const newConfig = { ...currentConfig, mix: val }
                                setReverbs((prev) => ({ ...prev, [stem.label]: newConfig }))
                                // Enable reverb if value > 0, disable if 0
                                setReverbEnabled(stem.label, val > 0)
                                // Set reverb mix to the knob value
                                setReverbMix(stem.label, val)
                              } else {
                                const currentConfig = echoes[stem.label] || defaultEchoConfig
                                const newConfig = { ...currentConfig, wet: val }
                                setEchoes((prev) => ({ ...prev, [stem.label]: newConfig }))
                                // Enable echo if value > 0, disable if 0
                                setEchoEnabled(stem.label, val > 0)
                                // Set echo wet to the knob value
                                setEchoWet(stem.label, val)
                              }
                            }}
                          />
                      </div>
                    </div>

                    {/* Mute & Solo */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      // Pull the bottom cluster (MUTE / SOLO / label) slightly upward on mobile
                      marginBottom: isMobile ? '0px' : '0px',
                    }}>
                      <button
                        onClick={() => {
                          const newMuteState = !mutes[stem.label];
                          setMutes(prev => ({ ...prev, [stem.label]: newMuteState }));
                          setSolos(prev => ({ ...prev, [stem.label]: false })); // Clear solo when muting
                          setTrackMute(stem.label, newMuteState);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          marginBottom: '6px',
                          backgroundColor: mutes[stem.label] ? '#FFD700' : '#FCFAEE',
                          color: mutes[stem.label] ? 'black' : primary,
                          border: `1px solid ${primary}`,
                          cursor: 'pointer',
                        }}
                      >
                        MUTE
                      </button>
                      <button
                        onClick={() => {
                          const newSoloState = !solos[stem.label];
                          setSolos(prev => ({ ...prev, [stem.label]: newSoloState }));
                          setMutes(prev => ({ ...prev, [stem.label]: false })); // Clear mute when soloing
                          setTrackSolo(stem.label, newSoloState);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          marginBottom: '6px',
                          backgroundColor: solos[stem.label] ? '#00FF99' : '#FCFAEE',
                          color: solos[stem.label] ? 'black' : primary,
                          border: `1px solid ${primary}`,
                          cursor: 'pointer',
                        }}
                      >
                        SOLO
                      </button>

                      {/* Label */}
                      <div
                        className="track-label"
                        style={{
                          fontSize: isVerySmallScreen ? '9px' : isSmallScreen ? '9.5px' : isMobile ? '10px' : '10px',
                          padding: isMobile ? '2px 4px' : '3px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#FCFAEE',
                          color: primary,
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: isMobile ? '28px' : '40px',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                          border: `1px solid ${primary}`,
                          textAlign: 'center',
                          lineHeight: '1.2',
                          wordWrap: 'break-word',
                          hyphens: 'auto',
                        }}
                        title={stem.label}
                      >
                        {stem.label.length > 8 ? stem.label.substring(0, 8) + '...' : stem.label}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>

            {/* 🎚️ Varispeed Section - Moved up */}
            {/* Desktop Varispeed Slider */}
            {!isMobile && (
              <div className="w-full flex justify-center">
                <div
                  className="relative"
                  style={{
                    marginTop: '10px',
                    width: '350px',
                    height: '120px',
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
                      value={isIOS ? varispeed : 2 - varispeed}
                      onChange={val => {
                        const newVarispeed = isIOS ? val : 2 - val;
                        setVarispeed(newVarispeed);
                        setVarispeedControl(newVarispeed, isNaturalVarispeed);
                      }}
                      isIOS={isIOS}
                      primaryColor={primary}
                      stemCount={stems.length}
                    />
                  </div>
                  
                  {/* Mode Toggle Button - Centered below slider for desktop */}
                  <div className="absolute left-1/2 transform -translate-x-1/2" style={{ bottom: '-11px' }}>
                    <button
                      onClick={() => {
                        const newMode = !isNaturalVarispeed;
                        setIsNaturalVarispeed(newMode);
                        setVarispeedControl(varispeed, newMode);
                      }}
                      className="px-2 py-1 text-xs font-mono rounded border"
                      style={{ 
                        color: primary,
                        borderColor: primary,
                        backgroundColor: isNaturalVarispeed ? primary + '20' : 'transparent',
                        pointerEvents: 'auto',
                        minHeight: '28px',
                        minWidth: '60px',
                        fontSize: isVerySmallScreen ? '10px' : '12px',
                        padding: isVerySmallScreen ? '4px 6px' : '8px 12px'
                      }}
                      title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                    >
                      {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Effect Controls - Above VARISPEED */}
            {isMobilePortrait && stems.length >= 1 && (
              <div className="w-full flex justify-center sm:hidden mb-2" style={{ marginTop: '-10px' }}>
                <div className="flex justify-center gap-4">
                  {/* Master Effect Dropdown */}
                  <div className="relative">
                    <div 
                      className="pressable font-mono tracking-wide cursor-pointer"
                      style={{ 
                        backgroundColor: '#FCFAEE',
                        color: primary,
                        border: `1px solid ${primary}`,
                        padding: '4px 8px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onClick={() => {
                        const dropdown = document.getElementById('mobile-master-effect-dropdown')
                        if (dropdown) {
                          dropdown.classList.toggle('hidden')
                        }
                      }}
                    >
                      <span>EFFECT</span>
                      <span style={{ fontSize: '8px' }}>▼</span>
                    </div>
                    
                    {/* Custom Dropdown Menu */}
                    <div 
                      id="mobile-master-effect-dropdown"
                      className="absolute left-0 bg-[#F5F5DC] rounded shadow-lg z-50 hidden min-w-full"
                      style={{ 
                        top: '100%', 
                        marginTop: '4px',
                        border: `1px solid ${primary}`
                      }}
                    >
                      <div 
                        className="px-2 py-1 cursor-pointer hover:text-[#FCFAEE] font-mono transition-colors"
                        style={{ 
                          fontSize: '10px',
                          color: primary
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = primary
                          e.currentTarget.style.color = '#FCFAEE'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = primary
                        }}
                        onClick={() => {
                          setSelectedMasterEffect('flanger')
                          document.getElementById('mobile-master-effect-dropdown')?.classList.add('hidden')
                        }}
                      >
                        FLANGER
                      </div>
                      <div 
                        className="px-2 py-1 cursor-pointer hover:text-[#FCFAEE] font-mono transition-colors"
                        style={{ 
                          fontSize: '10px',
                          color: primary
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = primary
                          e.currentTarget.style.color = '#FCFAEE'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = primary
                        }}
                        onClick={() => {
                          setSelectedMasterEffect('compressor')
                          document.getElementById('mobile-master-effect-dropdown')?.classList.add('hidden')
                        }}
                      >
                        COMPRESSOR
                      </div>
                    </div>
                  </div>

                  {/* Master Effect Buttons */}
                  {selectedMasterEffect === 'flanger' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          // Just open the modal for settings - don't toggle on/off
                          handleFlangerConfigOpen()
                        }}
                        className="pressable px-3 py-1 text-sm font-mono tracking-wide"
                        style={{ 
                          backgroundColor: '#FCFAEE',
                          color: primary,
                          border: `1px solid ${primary}`
                        }}
                      >
                        FLANGE
                      </button>
                      
                      {/* Toggle Switch */}
                      <div 
                        className="flex items-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          const currentEnabled = globalFlanger?.enabled || false
                          const newWet = currentEnabled ? 0 : 0.5
                          
                          const newConfig = {
                            ...(globalFlanger || defaultFlangerConfig),
                            wet: newWet,
                            enabled: !currentEnabled
                          }
                          setGlobalFlanger(newConfig)
                          
                          if (mixerEngineRef.current?.audioEngine) {
                            mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                              type: "command",
                              data: { 
                                command: "setFlangerConfig", 
                                config: newConfig
                              }
                            });
                          }
                        }}
                        style={{ marginLeft: '6px' }}
                      >
                        <div 
                          className="relative rounded-full border transition-all duration-200 ease-in-out"
                          style={{ 
                            width: '36px',
                            height: '20px',
                            backgroundColor: (globalFlanger?.enabled || false) ? primary : '#FCFAEE',
                            borderColor: primary,
                            borderWidth: '1px',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                          }}
                        >
                          <div 
                            className="absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm"
                            style={{ 
                              width: '14px',
                              height: '14px',
                              transform: (globalFlanger?.enabled || false) ? 'translateX(16px)' : 'translateX(2px)'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          // Just open the modal for settings - don't toggle on/off
                          handleCompressorConfigOpen()
                        }}
                        className="pressable px-3 py-1 text-sm font-mono tracking-wide"
                        style={{ 
                          backgroundColor: '#FCFAEE',
                          color: primary,
                          border: `1px solid ${primary}`
                        }}
                      >
                        COMPRESS
                      </button>
                      
                      {/* Toggle Switch */}
                      <div 
                        className="flex items-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          const currentEnabled = globalCompressor?.enabled || false
                          const newWet = currentEnabled ? 0 : 1.0
                          
                          const newConfig = {
                            ...(globalCompressor || defaultCompressorConfig),
                            wet: newWet,
                            enabled: !currentEnabled
                          }
                          setGlobalCompressor(newConfig)
                          
                          if (mixerEngineRef.current?.audioEngine) {
                            mixerEngineRef.current.audioEngine.sendMessageToAudioProcessor({
                              type: "command",
                              data: { 
                                command: "setCompressorConfig", 
                                config: newConfig
                              }
                            });
                          }
                        }}
                        style={{ marginLeft: '6px' }}
                      >
                        <div 
                          className="relative rounded-full border transition-all duration-200 ease-in-out"
                          style={{ 
                            width: '36px',
                            height: '20px',
                            backgroundColor: (globalCompressor?.enabled || false) ? primary : '#FCFAEE',
                            borderColor: primary,
                            borderWidth: '1px',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                          }}
                        >
                          <div 
                            className="absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm"
                            style={{ 
                              width: '14px',
                              height: '14px',
                              transform: (globalCompressor?.enabled || false) ? 'translateX(16px)' : 'translateX(2px)'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile Portrait Varispeed */}
            {isMobilePortrait && stems.length >= 1 && (
              <div className="w-full flex justify-center sm:hidden">
                <div
                  className="relative"
                  style={{
                    marginTop: '-5px',
                    marginBottom: '20px',
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
                      value={isIOS ? varispeed : 2 - varispeed}
                      onChange={val => {
                        const newVarispeed = isIOS ? val : 2 - val;
                        setVarispeed(newVarispeed);
                        setVarispeedControl(newVarispeed, isNaturalVarispeed);
                      }}
                      isIOS={isIOS}
                      primaryColor={primary}
                      stemCount={stems.length}
                    />
                  </div>
                  
                  {/* Mode Toggle Button - Centered below slider for mobile */}
                  <div className="absolute left-1/2 transform -translate-x-1/2" style={{ bottom: '0px' }}>
                    <button
                      onClick={() => {
                        const newMode = !isNaturalVarispeed;
                        setIsNaturalVarispeed(newMode);
                        setVarispeedControl(varispeed, newMode);
                      }}
                      className="px-2 py-1 text-xs font-mono rounded border"
                      style={{ 
                        color: primary,
                        borderColor: primary,
                        backgroundColor: isNaturalVarispeed ? primary + '20' : 'transparent',
                        pointerEvents: 'auto',
                        minHeight: '26px',
                        minWidth: '55px',
                        fontSize: isVerySmallScreen ? '10px' : '12px',
                        padding: isVerySmallScreen ? '3px 5px' : '6px 10px'
                      }}
                      title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                    >
                      {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                    </button>
                  </div>
                </div>
              </div>
            )}

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

          </main>

          {/* 🎛️ Reverb Configuration Modal */}
          <ReverbConfigModal
            isOpen={reverbConfigModal.isOpen}
            onClose={handleReverbConfigClose}
            onSave={handleReverbConfigSave}
            initialConfig={reverbs[reverbConfigModal.stemLabel] || defaultReverbConfig}
            stemLabel={reverbConfigModal.stemLabel}
            position={reverbConfigModal.position}
            primaryColor={primary}
          />

          {/* 🎛️ Echo Configuration Modal */}
          <EchoConfigModal
            isOpen={echoConfigModal.isOpen}
            onClose={handleEchoConfigClose}
            onSave={handleEchoConfigSave}
            initialConfig={echoes[echoConfigModal.stemLabel] || defaultEchoConfig}
            stemLabel={echoConfigModal.stemLabel}
            position={echoConfigModal.position}
            primaryColor={primary}
          />

          {/* 🎛️ Global Flanger Configuration Modal */}
          <FlangerConfigModal
            isOpen={flangerConfigModal.isOpen}
            onClose={handleFlangerConfigClose}
            onSave={handleFlangerConfigSave}
            onConfigChange={handleFlangerConfigChange}
            initialConfig={globalFlanger || defaultFlangerConfig}
            stemLabel="Global Mix"
            position={{ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 400, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 300 }}
            primaryColor={primary}
          />

          {/* 🎛️ Global Compressor Configuration Modal */}
          <CompressorConfigModal
            isOpen={compressorConfigModal.isOpen}
            onClose={handleCompressorConfigClose}
            onSave={handleCompressorConfigSave}
            onConfigChange={handleCompressorConfigChange}
            initialConfig={globalCompressor || defaultCompressorConfig}
            stemLabel="Global Mix"
            position={{ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 400, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 300 }}
            primaryColor={primary}
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