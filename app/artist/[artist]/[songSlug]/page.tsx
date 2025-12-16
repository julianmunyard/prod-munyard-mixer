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
import { useParams, useRouter } from 'next/navigation'
import VarispeedSlider from '../../../components/VarispeedSlider'
import RealTimelineMixerEngine from '../../../../audio/engine/realTimelineMixerEngine'
import Image from 'next/image'

// Check if we're in development mode
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'

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
  artwork_url?: string
  page_theme?: 'CLASSIC' | 'TERMINAL THEME' | 'OLD COMPUTER' | 'MUNY' | 'OLD INTERNET'
  album_id?: string
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
  const router = useRouter()
    
  // -------------------- 🔧 State --------------------
  const [songData, setSongData] = useState<Song | null>(null)
  const [hasAlbum, setHasAlbum] = useState(false)
  const [albumId, setAlbumId] = useState<string | null>(null)
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
  
  // CD Spinner / Listening Mode state
  const [isListeningMode, setIsListeningMode] = useState(false); // false = mixing mode (modules), true = listening mode (CD spinner)
  const cdSpinDuration = 5; // Constant speed - always spins at 5 seconds per rotation
  const cdElementRef = useRef<HTMLDivElement | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<{heap: number, total: number}>({heap: 0, total: 0});
  
  // Loading screen state
  const [showLoadingScreen, setShowLoadingScreen] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('Initializing audio engine...')
  
  // Page theme state - CLASSIC = original (primary color), others = themed.
  // NOTE: Theme selection is temporarily locked to OLD COMPUTER; UI dropdown is disabled below.
  const [pageTheme, setPageTheme] = useState<'CLASSIC' | 'TERMINAL THEME' | 'OLD COMPUTER' | 'MUNY' | 'OLD INTERNET'>('OLD COMPUTER')
  const [showThemeDropdown, setShowThemeDropdown] = useState(false) // kept for future use
  
  // Get primary color
  const primary = songData?.primary_color || '#B8001F'
  
  // Theme definitions - only for OLD COMPUTER, MUNY, and TERMINAL THEME
  // CLASSIC uses primary color directly (no theme object needed)
  const themes = {
    'OLD COMPUTER': {
      background: '#FFE5E5', // Pink background
      text: '#000000',
      border: '#000000',
      inputBg: '#FFFFFF',
      inputText: '#000000',
      buttonBg: '#D4C5B9', // Beige buttons
      buttonText: '#000000',
      cardBg: '#D4C5B9', // Beige for boxes
      cardBorder: '#000000', // Black border
      accent: '#B8001F',
      sectionBg: '#E0E0E0', // Light grey for selected items
      windowTitleBg: '#C0C0C0', // Grey for window title bars
      windowContentBg: '#FFFFFF', // White for content
      glow: 'none',
      moduleBg: '#D4C5B9', // Beige modules (like boxes)
      moduleText: '#000000',
      moduleBorder: '#000000',
      fontFamily: 'monospace'
    },
    'MUNY': {
      background: '#FFFFFF', // White background
      text: '#000000',
      border: '#000000',
      inputBg: '#FFFFFF',
      inputText: '#000000',
      buttonBg: '#FFFFFF', // White buttons
      buttonText: '#000000',
      cardBg: '#FFFFFF', // White for boxes
      cardBorder: '#000000', // Black border
      accent: '#000000', // Black accent (strictly black and white)
      sectionBg: '#FFFFFF', // White for selected items
      windowTitleBg: '#FFFFFF', // White for window title bars
      windowContentBg: '#FFFFFF', // White for content
      glow: 'none',
      moduleBg: '#FFFFFF', // White modules (like boxes)
      moduleText: '#000000',
      moduleBorder: '#000000',
      fontFamily: 'monospace'
    },
    'TERMINAL THEME': {
      background: '#000000',
      text: '#FFFFFF',
      border: '#FFFFFF',
      inputBg: '#000000',
      inputText: '#FFFFFF',
      buttonBg: '#000000',
      buttonText: '#FFFFFF',
      cardBg: '#000000',
      cardBorder: '#FFFFFF',
      accent: '#FFB6C1',
      sectionBg: '#0A0A0A',
      glow: '0 0 10px rgba(255,255,255,0.3)',
      moduleBg: '#0A0A0A',
      moduleText: '#FFFFFF',
      moduleBorder: '#FFB6C1',
      fontFamily: '"Courier New", "Courier", monospace'
    },
    'OLD INTERNET': {
      background: '#C0C0C0', // Windows 95 grey background
      text: '#000000',
      border: '#000000',
      inputBg: '#FFFFFF',
      inputText: '#000000',
      buttonBg: '#C0C0C0', // Classic grey buttons
      buttonText: '#000000',
      cardBg: '#FFFFFF', // White cards
      cardBorder: '#000000',
      accent: '#0000FF', // Classic blue accent (like old web links)
      sectionBg: '#E0E0E0', // Light grey for sections
      windowTitleBg: '#008080', // Teal for window title bars (Windows 95 style)
      windowContentBg: '#C0C0C0',
      glow: 'none',
      moduleBg: '#FFFFFF', // White modules
      moduleText: '#000000',
      moduleBorder: '#000000',
      fontFamily: '"MS Sans Serif", "Comic Sans MS", "Arial", sans-serif' // Retro fonts
    }
  }
  
  // Only get currentTheme if not CLASSIC (CLASSIC uses primary directly)
  const currentTheme = pageTheme !== 'CLASSIC' ? themes[pageTheme] : null
  
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

  // -------------------- 🎨 Handle Theme Change ====================
  const handleThemeChange = async (newTheme: 'CLASSIC' | 'TERMINAL THEME' | 'OLD COMPUTER' | 'MUNY' | 'OLD INTERNET') => {
    // Temporarily force all theme changes to OLD COMPUTER only.
    const forcedTheme: 'OLD COMPUTER' = 'OLD COMPUTER'
    setPageTheme(forcedTheme)
    setShowThemeDropdown(false)
    
    // Save to database if we have song data
    if (songData?.id) {
      try {
        const { error } = await supabase!
          .from('songs')
          .update({ page_theme: forcedTheme })
          .eq('id', songData.id)
        
        if (error) {
          console.error('Failed to save theme:', error)
        } else {
          console.log('Theme saved successfully')
        }
      } catch (err) {
        console.error('Error saving theme:', err)
      }
    }
  }
  
  // Load theme from database on mount
  useEffect(() => {
    // TEMP: Always force OLD COMPUTER theme for now, regardless of saved page_theme.
    if (songData?.page_theme) {
      setPageTheme('OLD COMPUTER')
    }
  }, [songData?.page_theme])
  
  // ==================== 🎨 Set Theme Color for iOS Status Bar ====================
  useEffect(() => {
    // Set theme-color for iOS status bar based on selected theme
    let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.name = 'theme-color'
      document.head.appendChild(themeColorMeta)
    }
    
    // Set color based on theme
    let backgroundColor = '#FFE5E5' // Default pink for CLASSIC
    if (pageTheme === 'OLD COMPUTER') {
      backgroundColor = '#FFE5E5' // Pink
    } else if (pageTheme === 'MUNY') {
      backgroundColor = '#FFFFFF' // White
    } else if (pageTheme === 'TERMINAL THEME') {
      backgroundColor = '#000000' // Black
    } else if (pageTheme === 'OLD INTERNET') {
      backgroundColor = '#C0C0C0' // Windows 95 grey
    }
    
    themeColorMeta.content = backgroundColor
    
    // Create or update a style element to override CSS with !important
    let themeStyle = document.getElementById('theme-background-style') as HTMLStyleElement
    if (!themeStyle) {
      themeStyle = document.createElement('style')
      themeStyle.id = 'theme-background-style'
      document.head.appendChild(themeStyle)
    }
    // Add patterns for themes
    const munyPattern = 'background-image: radial-gradient(circle, #000000 0.8px, transparent 0.8px) !important; background-size: 18px 18px !important;'
    // CRT scanlines effect for OLD INTERNET theme - subtle horizontal lines
    const crtScanlines = `
      background-image: 
        repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, 0.03) 0px,
          transparent 1px,
          transparent 2px,
          rgba(0, 0, 0, 0.03) 3px
        ),
        repeating-linear-gradient(
          90deg,
          rgba(0, 0, 0, 0.02) 0px,
          transparent 1px,
          transparent 2px,
          rgba(0, 0, 0, 0.02) 3px
        ) !important;
    `
    
    themeStyle.textContent = `
      html { 
        background-color: ${backgroundColor} !important;
        ${pageTheme === 'MUNY' ? munyPattern : ''}
        ${pageTheme === 'OLD INTERNET' ? crtScanlines : ''}
        ${pageTheme === 'OLD INTERNET' ? 'image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;' : ''}
      }
      body { 
        background-color: ${backgroundColor} !important;
        ${pageTheme === 'MUNY' ? munyPattern : ''}
        ${pageTheme === 'OLD INTERNET' ? crtScanlines : ''}
        ${pageTheme === 'OLD INTERNET' ? 'image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;' : ''}
      }
      #theme-background-overlay { 
        background-color: ${backgroundColor} !important;
        ${pageTheme === 'MUNY' ? munyPattern : ''}
        ${pageTheme === 'OLD INTERNET' ? crtScanlines : ''}
        ${pageTheme === 'OLD INTERNET' ? 'image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;' : ''}
      }
    `
    
    // Cleanup: restore pink color when component unmounts
    return () => {
      if (themeColorMeta) {
        themeColorMeta.content = '#FFE5E5' // Restore pink
      }
      if (themeStyle) {
        themeStyle.textContent = `
          html { background-color: #FFE5E5 !important; }
          body { background-color: #FFE5E5 !important; background: #FFE5E5 !important; }
          #theme-background-overlay { background-color: #FFE5E5 !important; }
        `
      }
    }
  }, [pageTheme])
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-theme-dropdown]') && !target.closest('[data-theme-button]')) {
        setShowThemeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  // Fix iOS viewport height calculation on initial load
  useEffect(() => {
    if (typeof window !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)) {
      // Force viewport recalculation on iOS to fix initial load cutoff
      const fixViewport = () => {
        // Set CSS custom property for dynamic viewport height
        const vh = window.innerHeight * 0.01
        document.documentElement.style.setProperty('--vh', `${vh}px`)
      }
      
      // Run immediately and after delays to catch iOS Safari's delayed viewport calculation
      fixViewport()
      const timeout = setTimeout(fixViewport, 100)
      const timeout2 = setTimeout(fixViewport, 300)
      const timeout3 = setTimeout(fixViewport, 600)
      
      // Also fix on scroll (when address bar hides/shows) and resize
      window.addEventListener('scroll', fixViewport, { passive: true })
      window.addEventListener('resize', fixViewport)
      
      return () => {
        clearTimeout(timeout)
        clearTimeout(timeout2)
        clearTimeout(timeout3)
        window.removeEventListener('scroll', fixViewport)
        window.removeEventListener('resize', fixViewport)
      }
    }
  }, [])

  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)
  // CRITICAL FIX: Case-insensitive check for "Transparent" to handle any database inconsistencies
  // Also ensure it's not a hex color (which would indicate a bug where color was overwritten)
  // IMPORTANT: OLD COMPUTER theme should NEVER use transparency, regardless of color setting
  const isTransparent = pageTheme !== 'OLD COMPUTER' && 
    songData?.color && 
    typeof songData.color === 'string' && 
    songData.color.toLowerCase() === 'transparent' &&
    !songData.color.startsWith('#') // Ensure it's not accidentally a hex color

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
          !target.closest('[id^="mobile-master-effect-dropdown"]') &&
          !target.closest('[data-page-theme-dropdown]')) {
        // Close all effect dropdowns
        document.querySelectorAll('[id^="effect-dropdown-"]').forEach(dropdown => {
          dropdown.classList.add('hidden')
        })
        // Close master effect dropdown
        document.getElementById('master-effect-dropdown')?.classList.add('hidden')
        // Close mobile master effect dropdown
        document.getElementById('mobile-master-effect-dropdown')?.classList.add('hidden')
        // Close page theme dropdown
      }
    }

    // Use mousedown instead of click to avoid conflicts with button clicks
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ==================== 🎨 Apply Page Theme ====================
  useEffect(() => {
    // CLASSIC = original (primary color), others = themed
    if (pageTheme === 'CLASSIC') {
      document.body.style.backgroundColor = '#FFE5E5'
      document.body.style.color = primary
    } else if (currentTheme) {
      document.body.style.backgroundColor = currentTheme.background
      document.body.style.color = currentTheme.text
    }
    return () => {
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [pageTheme, currentTheme, primary])


  // ==================== 🔇 Silent Mode Bypass (iOS Hack) ====================
  // iOS treats Web Audio API as "system sounds" that respect silent mode
  // Solution: User taps mute/unmute button to unlock audio
  const silentModeBypassRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)
  const manuallyUnlockedRef = useRef(false) // Track if user manually unlocked
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null)
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

  // ==================== 🎥 Background Video Playback ====================
  useEffect(() => {
    if (songData?.background_video && isTransparent && backgroundVideoRef.current) {
      const video = backgroundVideoRef.current
      console.log('🎥 Attempting to play background video:', songData.background_video)
      
      // Force play the video
      const playVideo = () => {
        if (video.paused) {
          video.play()
            .then(() => {
              console.log('✅ Background video playing successfully')
            })
            .catch((err) => {
              console.error('❌ Failed to play background video:', err)
            })
        }
      }
      
      // Try to play immediately
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA
        playVideo()
      } else {
        // Wait for video to be ready
        video.addEventListener('loadeddata', playVideo, { once: true })
        video.addEventListener('canplay', playVideo, { once: true })
        video.addEventListener('canplaythrough', playVideo, { once: true })
      }
      
      return () => {
        video.removeEventListener('loadeddata', playVideo)
        video.removeEventListener('canplay', playVideo)
        video.removeEventListener('canplaythrough', playVideo)
      }
    }
  }, [songData?.background_video, songData?.color])

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
      console.log('🎥 Song data loaded - background_video:', data.background_video, 'color:', data.color, 'artwork_url:', data.artwork_url);
      // Set page theme from song data
      if (data.page_theme && (data.page_theme === 'TERMINAL THEME' || data.page_theme === 'OLD COMPUTER' || data.page_theme === 'MUNY')) {
        setPageTheme(data.page_theme);
      }
      
      // Check if song has an album and get album_id
      try {
        let foundAlbumId: string | null = null
        
        // Method 1: Check if song has album_id directly
        if (data.album_id) {
          console.log('✅ Song has album_id:', data.album_id)
          foundAlbumId = data.album_id
        } else {
          // Method 2: Check if artist has an album by artist_slug and get its id
          const { data: albumData, error: albumError } = await supabase!
            .from('albums')
            .select('id')
            .eq('artist_slug', artist)
            .limit(1)
            .maybeSingle()
          
          if (albumError) {
            console.log('⚠️ Album check error:', albumError.message)
          }
          
          if (!albumError && albumData && albumData.id) {
            console.log('✅ Found album for artist:', artist, 'album_id:', albumData.id)
            foundAlbumId = albumData.id
          }
        }
        
        if (foundAlbumId) {
          setHasAlbum(true)
          setAlbumId(foundAlbumId)
        } else {
          setHasAlbum(false)
          setAlbumId(null)
        }
      } catch (err) {
        console.error('❌ Error checking for album:', err)
        // If albums table doesn't exist or other error, assume no album
        setHasAlbum(false)
        setAlbumId(null)
      }
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

  // Master mute/unmute all tracks
  const toggleMasterMute = useCallback(() => {
    if (!mixerEngineRef.current?.audioEngine || stems.length === 0) return;
    
    // Check if all tracks are currently muted
    const allMuted = stems.every(stem => mutes[stem.label] === true);
    const newMuteState = !allMuted; // If all muted, unmute all. If not all muted, mute all.
    
    // Update UI state for all tracks
    const newMutes: Record<string, boolean> = {};
    stems.forEach(stem => {
      newMutes[stem.label] = newMuteState;
    });
    setMutes(newMutes);
    
    // Clear solos when master muting/unmuting
    setSolos(Object.fromEntries(stems.map(s => [s.label, false])));
    
    // Apply mute state to all tracks in audio engine
    stems.forEach((stem, index) => {
      mixerEngineRef.current!.audioEngine!.sendMessageToAudioProcessor({
        type: "command",
        data: { 
          command: "setTrackMute", 
          trackId: `track_${index}`,
          muted: newMuteState 
        }
      });
    });
    
    addDebugLog(`${newMuteState ? '🔇 Master muted' : '🔊 Master unmuted'} all tracks`);
  }, [mutes, stems]);

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
      // Set audioUnlocked to true when playback starts (for both iOS and desktop)
      // This ensures the mute icon shows the correct state
      if (!audioUnlockedRef.current) {
        audioUnlockedRef.current = true;
        setAudioUnlocked(true);
      }
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
      
      // CD spinner speed is handled by the useEffect hook - it will slow to idle speed
      
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

  // CD spinner always spins at constant speed - no speed changes

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
            /* Disable text selection */
            * {
              -webkit-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
              user-select: none;
            }
            /* Allow selection for input fields and textareas */
            input, textarea {
              -webkit-user-select: text;
              -moz-user-select: text;
              -ms-user-select: text;
              user-select: text;
            }
            /* Remove focus outline from effect dropdowns */
            [id^="effect-dropdown-"]:focus,
            [id^="master-effect-dropdown"]:focus,
            [id^="mobile-master-effect-dropdown"]:focus,
            div[id^="effect-dropdown-"],
            div[id="master-effect-dropdown"],
            div[id="mobile-master-effect-dropdown"],
            .pressable:focus,
            div[class*="pressable"]:focus,
            div[class*="pressable"]:active {
              outline: none !important;
              box-shadow: none !important;
              -webkit-tap-highlight-color: transparent !important;
            }
            /* Prevent blue highlight on click for all pressable divs */
            div.pressable,
            div[class*="cursor-pointer"],
            div.pressable:active,
            div[class*="cursor-pointer"]:active {
              -webkit-tap-highlight-color: transparent !important;
              -webkit-touch-callout: none !important;
              user-select: none !important;
            }
            /* Force background color to stay the same on active state */
            div.pressable:active {
              background-color: inherit !important;
            }
            /* Apply varispeed-style oval knobs to ALL volume sliders (both classic and transparent) */
            /* Match varispeed exactly - inline sets slider-vertical, CSS overrides with none !important */
            .volume-slider,
            .transparent-volume-slider,
            input[type="range"].volume-slider,
            input[type="range"].transparent-volume-slider {
              -webkit-appearance: none !important; /* Override inline slider-vertical (match varispeed) */
              -moz-appearance: none !important;
              appearance: none !important;
              writing-mode: vertical-lr !important; /* Match varispeed exactly */
              width: 20px !important; /* Wide enough to fit 18px thumb */
            }
            /* Track styling - MUST have height: 100% to match slider height */
            .volume-slider::-webkit-slider-runnable-track,
            .transparent-volume-slider::-webkit-slider-runnable-track,
            input[type="range"].volume-slider::-webkit-slider-runnable-track,
            input[type="range"].transparent-volume-slider::-webkit-slider-runnable-track {
              -webkit-appearance: none !important;
              background: ${pageTheme === 'OLD COMPUTER' ? '#FFE5E5' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#FFFFFF' : (isTransparent ? 'transparent' : '#FCFAEE')))} !important;
              border: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (isTransparent ? `1px solid ${primary}` : 'none')} !important;
              border-radius: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '2px'} !important;
              height: 100% !important; /* Match slider height */
              width: 20px !important; /* Wide enough to fit 18px thumb */
            }
            .volume-slider::-moz-range-track,
            .transparent-volume-slider::-moz-range-track,
            input[type="range"].volume-slider::-moz-range-track,
            input[type="range"].transparent-volume-slider::-moz-range-track {
              background: ${pageTheme === 'OLD COMPUTER' ? '#FFE5E5' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#FFFFFF' : (isTransparent ? 'transparent' : '#FCFAEE')))} !important;
              border: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (isTransparent ? `1px solid ${primary}` : 'none')} !important;
              border-radius: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '2px'} !important;
              height: 100% !important; /* Match slider height */
              width: 20px !important; /* Wide enough to fit 18px thumb */
            }
            .volume-slider::-ms-track,
            .transparent-volume-slider::-ms-track,
            input[type="range"].volume-slider::-ms-track,
            input[type="range"].transparent-volume-slider::-ms-track {
              background: ${pageTheme === 'OLD COMPUTER' ? '#FFE5E5' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#FFFFFF' : (isTransparent ? 'transparent' : '#FCFAEE')))} !important;
              border: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (isTransparent ? `1px solid ${primary}` : 'none')} !important;
              border-radius: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '2px'} !important;
              height: 100% !important; /* Match slider height */
              width: 20px !important; /* Wide enough to fit 18px thumb */
              color: transparent !important;
            }
            /* Thumb styling - oval/pill shape matching varispeed */
            input[type="range"].volume-slider::-webkit-slider-thumb,
            input[type="range"].transparent-volume-slider::-webkit-slider-thumb,
            .volume-slider::-webkit-slider-thumb,
            .transparent-volume-slider::-webkit-slider-thumb {
              -webkit-appearance: none !important;
              appearance: none !important;
              height: 35px !important; /* Slightly longer */
              width: 18px !important;
              border-radius: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '10px'} !important;
              background: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary} !important;
              border: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : 'none'} !important;
              cursor: pointer !important;
              box-shadow: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'} !important;
              margin: 0 !important;
              padding: 0 !important;
              /* Remove position/transform to allow natural movement */
            }
            /* DUPLICATE AT END TO FORCE OVERRIDE - slider-vertical default thumb */
            input.volume-slider[type="range"]::-webkit-slider-thumb,
            input.transparent-volume-slider[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none !important;
              appearance: none !important;
              height: 35px !important; /* Slightly longer */
              width: 18px !important;
              border-radius: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '10px'} !important;
              background: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary} !important;
              border: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : 'none'} !important;
              cursor: pointer !important;
              box-shadow: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'} !important;
            }
            .volume-slider::-moz-range-thumb,
            .transparent-volume-slider::-moz-range-thumb,
            input[type="range"].volume-slider::-moz-range-thumb,
            input[type="range"].transparent-volume-slider::-moz-range-thumb {
              height: 45px !important; /* Slightly longer */
              width: 18px !important;
              border-radius: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '10px'} !important;
              background: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary} !important;
              border: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : 'none'} !important;
              cursor: pointer !important;
              box-shadow: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'} !important;
            }
            .volume-slider::-ms-thumb,
            .transparent-volume-slider::-ms-thumb,
            input[type="range"].volume-slider::-ms-thumb,
            input[type="range"].transparent-volume-slider::-ms-thumb {
              height: 45px !important; /* Slightly longer */
              width: 18px !important;
              border-radius: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '10px'} !important;
              background: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary} !important;
              border: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : 'none'} !important;
              cursor: pointer !important;
              box-shadow: ${(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'} !important;
            }
            @media screen and (max-width: 767px) and (orientation: landscape) {
              .mixer-module {
                /* Landscape phones: slightly taller than original but not huge */
                min-height: clamp(320px, 48dvh, 380px) !important;
              }
            }
            @media screen and (max-width: 374px) {
              /* Very small screens (iPhone SE, iPhone 12 mini) */
              .mixer-module {
                /* Close to original size, but still enough for controls */
                min-height: clamp(330px, 55dvh, 380px) !important;
                max-height: none !important;
              }
            }
            @media screen and (min-width: 375px) and (max-width: 413px) {
              /* Small screens (iPhone 13, iPhone 14) */
              .mixer-module {
                min-height: clamp(340px, 56dvh, 390px) !important;
                max-height: none !important;
              }
            }
            @media screen and (max-width: 767px) {
              /* All mobile screens */
              /* Allow vertical scrolling so tall modules never get clipped */
              body, html {
                overflow-x: hidden !important;
                overflow-y: auto !important;
                position: relative !important;
                min-height: 100% !important;
                height: auto !important;
                width: 100% !important;
              }
              /* Ensure main container allows full scrolling */
              main {
                min-height: 100dvh !important;
                height: auto !important;
                overflow: visible !important;
              }
              .stems-container::-webkit-scrollbar {
                display: none;
              }
              .stems-container {
                -ms-overflow-style: none;
                scrollbar-width: none;
                overflow-x: auto !important;
                overflow-y: visible !important;
                touch-action: pan-x !important;
              }
              .mixer-module {
                /* Default mobile size: shorter than before, still scrollable page */
                min-height: clamp(340px, 56dvh, 400px) !important;
                max-height: none !important;
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
            /* 🎯 Samsung Galaxy S8 specific tweaks (360 x ~740) */
            @media screen 
              and (min-width: 360px) 
              and (max-width: 380px) 
              and (min-height: 730px) 
              and (max-height: 780px) {
              .mixer-module {
                /* Slightly shorter so CONTROLS + VARISPEED fit without overlap */
                min-height: clamp(320px, 50dvh, 360px) !important;
              }
              .controls-panel {
                /* Pull controls a bit closer to mixer and free space at bottom */
                margin-top: 12px !important;
                margin-bottom: 12px !important;
              }
            }
          `}</style>
          

          {/* 🎥 Background Video - Only for Transparent theme */}
          {songData?.background_video && isTransparent && (
            <video
              ref={backgroundVideoRef}
              src={songData.background_video}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              crossOrigin="anonymous"
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
                console.error('Video source:', songData.background_video)
              }}
              onLoadedMetadata={() => {
                console.log('Background video metadata loaded:', songData.background_video)
                const video = backgroundVideoRef.current
                if (video) {
                  video.play().catch((err) => {
                    console.error('Failed to play background video (onLoadedMetadata):', err)
                  })
                }
              }}
              onLoadedData={() => {
                console.log('Background video loaded successfully:', songData.background_video)
                // Ensure video plays
                const video = backgroundVideoRef.current
                if (video) {
                  video.play().catch((err) => {
                    console.error('Failed to play background video (onLoadedData):', err)
                  })
                }
              }}
              onCanPlay={() => {
                console.log('Background video can play:', songData.background_video)
                // Ensure video plays when ready
                const video = backgroundVideoRef.current
                if (video && video.paused) {
                  video.play().catch((err) => {
                    console.error('Failed to play background video (onCanPlay):', err)
                  })
                }
              }}
              onCanPlayThrough={() => {
                console.log('Background video can play through:', songData.background_video)
                const video = backgroundVideoRef.current
                if (video && video.paused) {
                  video.play().catch((err) => {
                    console.error('Failed to play background video (onCanPlayThrough):', err)
                  })
                }
              }}
            />
          )}

          {/* 🧱 Main Layout */}
          <main
            className={`min-h-screen font-sans relative ${
              isTransparent
                ? 'bg-transparent'
                : pageTheme === 'OLD COMPUTER' ? 'bg-[#FFE5E5]' : (pageTheme === 'MUNY' ? 'bg-[#FFFFFF]' : (pageTheme === 'OLD INTERNET' ? 'bg-[#C0C0C0]' : 'bg-[#FCFAEE]'))
            }`}
            style={{
              minHeight: '100dvh',
              height: isMobile ? 'auto' : undefined, // Allow content to extend naturally on mobile
              color: pageTheme === 'CLASSIC' ? primary : (currentTheme?.text || primary),
              zIndex: 1,
              position: 'relative',
              backgroundColor: (pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FFFFFF') : undefined,
              backgroundImage: pageTheme === 'OLD COMPUTER' ? `
                repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px),
                repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px)
              ` : pageTheme === 'MUNY' ? 'radial-gradient(circle, #000000 0.8px, transparent 0.8px)' : (pageTheme === 'OLD INTERNET' ? `
                repeating-linear-gradient(
                  0deg,
                  rgba(0, 0, 0, 0.03) 0px,
                  transparent 1px,
                  transparent 2px,
                  rgba(0, 0, 0, 0.03) 3px
                ),
                repeating-linear-gradient(
                  90deg,
                  rgba(0, 0, 0, 0.02) 0px,
                  transparent 1px,
                  transparent 2px,
                  rgba(0, 0, 0, 0.02) 3px
                )
              ` : undefined),
              backgroundSize: (pageTheme === 'MUNY' ? '18px 18px' : undefined),
              fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : (pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : 'inherit'),
              paddingBottom: isVerySmallScreen 
                ? 'clamp(180px, 25vh, 200px)' 
                : isSmallScreen 
                  ? 'clamp(180px, 25vh, 200px)'  // Increased padding to ensure bottom content is accessible
                  : isMobile 
                    ? 'clamp(200px, 25vh, 220px)' 
                    : '60px',
            }}
          >
            {/* ⬅️ Back Button - Top Left (only shows if artist has album) */}
            {hasAlbum && albumId && (
              <button
                onClick={() => router.push(`/album/${albumId}`)}
                aria-label="Back to album page"
                className="pressable flex items-center justify-center"
                style={{
                  position: 'fixed',
                  top: '12px',
                  left: '12px',
                  width: isMobile ? '36px' : '42px',
                  height: isMobile ? '36px' : '42px',
                  borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '50%',
                  backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE')),
                  color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                  border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                  boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                  fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                  fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                  zIndex: 1000,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Back to album page"
              className="controls-panel"
              >
                <svg
                  width={isMobile ? "18" : "22"}
                  height={isMobile ? "18" : "22"}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M19 12H5M5 12L12 19M5 12L12 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            
            {/* 🔇 Mobile Silent Mode Unmute Floating Button (SVG in primary color) */}
            {/* Also works as Master Mute/Unmute for all tracks */}
            {/* Hidden for OLD COMPUTER theme - volume button is in player box */}
            {isMobile && pageTheme !== 'OLD COMPUTER' && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Keep the audio unlock functionality (for iOS silent mode)
                  toggleAudioUnlock();
                  // Also master mute/unmute all tracks
                  toggleMasterMute();
                }}
                aria-label={audioUnlocked ? 'Mute all tracks (disable background/silent mode audio)' : 'Unmute all tracks (enable audio in silent mode)'}
                className="pressable flex items-center justify-center"
                style={{
                  position: 'fixed',
                  top: '12px',
                  right: '12px',
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE')),
                  color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : 'inherit',
                  border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                  boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                  fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                  fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                  zIndex: 1000,
                }}
                title={audioUnlocked ? 'Audio unlocked - tap to master mute all tracks' : 'Audio muted - tap to unlock and master unmute all tracks'}
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

            {/* ▶️ Main Playback Controls */}
            {pageTheme === 'OLD COMPUTER' ? (
              /* Player Box for OLD COMPUTER theme */
              <div 
                style={{
                  backgroundColor: '#D4C5B9',
                  border: '3px solid #000000',
                  borderBottom: 'none',
                  boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
                  padding: isMobile ? '4px' : '8px',
                  paddingBottom: isMobile ? '4px' : '8px',
                  position: 'relative',
                  overflow: 'visible',
                  zIndex: 10,
                  margin: isMobile ? '0 auto' : '0 auto',
                  marginTop: isMobile ? (hasAlbum && albumId ? '56px' : '0') : '40px', // Add space for back button on mobile
                  marginBottom: '0',
                  width: isMobile ? 'calc(100% - 20px)' : '100%',
                  maxWidth: '896px',
                  display: 'block',
                  marginLeft: isMobile ? 'auto' : 'auto',
                  marginRight: isMobile ? 'auto' : 'auto',
                }}
              >
                {/* Title Bar */}
                <div 
                  style={{
                    backgroundColor: '#C0C0C0',
                    border: '2px solid #000',
                    padding: isMobile ? '3px 6px' : '4px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isMobile ? '2px' : '4px',
                    fontSize: isMobile ? '11px' : '15px',
                    fontWeight: 'bold',
                    color: '#000000',
                    fontFamily: 'monospace',
                  }}
                >
                  <span>PLAYER</span>
                </div>

                {/* Content Area with Playback Controls */}
                <div 
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '2px solid #000',
                    padding: isMobile ? '12px' : '20px',
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: isMobile ? '12px' : '24px',
                  }}
                >
                  {/* Desktop Volume Button */}
                  {!isMobile && (() => {
                    // Check if all tracks are muted (same logic as toggleMasterMute)
                    const allMuted = stems.length > 0 && stems.every(stem => mutes[stem.label] === true);
                    // Show unmuted icon if audio is unlocked AND not all tracks are muted
                    const showUnmuted = audioUnlocked && !allMuted;
                    
                    return (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleAudioUnlock();
                          toggleMasterMute();
                        }}
                        aria-label={showUnmuted ? 'Mute all tracks' : 'Unmute all tracks'}
                        className="pressable flex items-center justify-center"
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '0',
                          backgroundColor: '#D4C5B9',
                          color: '#000000',
                          border: '2px solid #000000',
                          boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          padding: 0,
                        }}
                        title={showUnmuted ? 'Audio unlocked - tap to master mute' : 'Audio muted - tap to unlock'}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M4 10v4h3l5 4V6l-5 4H4z"
                            stroke="#000000"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                          {!showUnmuted && (
                            <path
                              d="M6 6L18 18"
                              stroke="#000000"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                          {showUnmuted && (
                            <>
                              <path
                                d="M16 9c1.333 1.333 1.333 4.667 0 6"
                                stroke="#000000"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M18.5 7.5c2.333 2.333 2.333 6.667 0 9"
                                stroke="#000000"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.8"
                              />
                            </>
                          )}
                        </svg>
                      </button>
                    );
                  })()}

                  {/* Play Button */}
                  <button
                    onClick={playAll}
                    disabled={!timelineReady || !allAssetsLoaded}
                    className={`pressable flex items-center justify-center transition-all duration-200 ${
                      !timelineReady || !allAssetsLoaded
                        ? 'opacity-60 cursor-not-allowed' 
                        : 'hover:opacity-90'
                    }`}
                    style={{
                      backgroundColor: timelineReady && allAssetsLoaded ? '#D4C5B9' : '#ccc',
                      width: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : isMobile ? '44px' : '48px',
                      height: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : isMobile ? '44px' : '48px',
                      borderRadius: '0',
                      border: '2px solid #000000',
                      padding: 0,
                      boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                    }}
                    aria-label="Play"
                  >
                    <svg
                      width={isVerySmallScreen ? '18' : isSmallScreen ? '20' : isMobile ? '22' : '24'}
                      height={isVerySmallScreen ? '18' : isSmallScreen ? '20' : isMobile ? '22' : '24'}
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 5v14l11-7z"
                        fill="#000000"
                        stroke="#000000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Pause Button */}
                  <button
                    onClick={pauseAll}
                    disabled={!timelineReady}
                    className="pressable flex items-center justify-center transition-all duration-200 hover:opacity-90"
                    style={{
                      backgroundColor: '#D4C5B9',
                      width: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : isMobile ? '44px' : '48px',
                      height: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : isMobile ? '44px' : '48px',
                      borderRadius: '0',
                      border: '2px solid #000000',
                      padding: 0,
                      boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                    }}
                    aria-label="Pause"
                  >
                    <svg
                      width={isVerySmallScreen ? '18' : isSmallScreen ? '20' : isMobile ? '22' : '24'}
                      height={isVerySmallScreen ? '18' : isSmallScreen ? '20' : isMobile ? '22' : '24'}
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect
                        x="6"
                        y="4"
                        width="4"
                        height="16"
                        fill="#000000"
                        stroke="#000000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <rect
                        x="14"
                        y="4"
                        width="4"
                        height="16"
                        fill="#000000"
                        stroke="#000000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Mobile Volume Button - Next to Pause Button */}
                  {isMobile && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleAudioUnlock();
                        toggleMasterMute();
                      }}
                      aria-label={audioUnlocked ? 'Mute all tracks' : 'Unmute all tracks'}
                      className="pressable flex items-center justify-center"
                      style={{
                        width: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : '44px',
                        height: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : '44px',
                        borderRadius: '0',
                        backgroundColor: '#D4C5B9',
                        color: '#000000',
                        border: '2px solid #000000',
                        boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        padding: 0,
                      }}
                      title={audioUnlocked ? 'Audio unlocked - tap to master mute' : 'Audio muted - tap to unlock'}
                    >
                      <svg
                        width={isVerySmallScreen ? '18' : isSmallScreen ? '20' : '22'}
                        height={isVerySmallScreen ? '18' : isSmallScreen ? '20' : '22'}
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M4 10v4h3l5 4V6l-5 4H4z"
                          stroke="#000000"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                        {!audioUnlocked && (
                          <path
                            d="M6 6L18 18"
                            stroke="#000000"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {audioUnlocked && (
                          <>
                            <path
                              d="M16 9c1.333 1.333 1.333 4.667 0 6"
                              stroke="#000000"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M18.5 7.5c2.333 2.333 2.333 6.667 0 9"
                              stroke="#000000"
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
                </div>
              </div>
            ) : null}

            {/* 🎛️ Secondary Controls - Desktop Only */}
            {/* Hidden for OLD COMPUTER theme - moved into controls box */}

            {/* Original structure for other themes - Playback Controls */}
            {pageTheme !== 'OLD COMPUTER' && (
              <div className={`flex justify-center items-center mb-2 ${isMobile ? 'gap-2' : 'gap-8'} ${isMobile ? 'px-2' : ''}`} style={{
                gap: isVerySmallScreen ? '8px' : isSmallScreen ? '12px' : isMobile ? '16px' : '32px',
                paddingLeft: isMobile ? 'clamp(8px, 2vw, 16px)' : '0',
                paddingRight: isMobile ? 'clamp(8px, 2vw, 16px)' : '0',
              }}>
                {/* (Mobile unmute button moved to floating top-right) */}

              <button
                onClick={playAll}
                disabled={!timelineReady || !allAssetsLoaded}
                className={`pressable flex items-center justify-center transition-all duration-200 ${
                  !timelineReady || !allAssetsLoaded
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'hover:opacity-90'
                }`}
                style={{
                      backgroundColor: pageTheme === 'OLD COMPUTER'
                        ? (timelineReady && allAssetsLoaded ? '#D4C5B9' : '#ccc')
                        : pageTheme === 'MUNY'
                        ? (timelineReady && allAssetsLoaded ? '#FFFFFF' : '#ccc')
                    : (isTransparent 
                      ? 'rgba(255,255,255,0.05)' 
                      : (timelineReady && allAssetsLoaded ? primary : '#ccc')),
                  backdropFilter: isTransparent ? 'blur(2px)' : 'none',
                  width: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : isMobile ? '44px' : '48px',
                  height: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : isMobile ? '44px' : '48px',
                  borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '50%',
                  border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? '2px solid #000000' 
                    : (isTransparent ? `1px solid ${primary}` : 'none'),
                  padding: 0,
                  boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' 
                    : (isTransparent ? '0 0 6px rgba(255,255,255,0.2)' : 'none'),
                }}
                aria-label="Play"
              >
                <svg
                  width={isVerySmallScreen ? '18' : isSmallScreen ? '20' : isMobile ? '22' : '24'}
                  height={isVerySmallScreen ? '18' : isSmallScreen ? '20' : isMobile ? '22' : '24'}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 5v14l11-7z"
                    fill={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#000000' 
                      : (isTransparent 
                        ? primary 
                        : (timelineReady && allAssetsLoaded ? 'white' : '#666'))}
                    stroke={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#000000' 
                      : (isTransparent 
                        ? primary 
                        : (timelineReady && allAssetsLoaded ? 'white' : '#666'))}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                onClick={pauseAll}
                disabled={!timelineReady}
                className="pressable flex items-center justify-center transition-all duration-200 hover:opacity-90"
                style={{
                  backgroundColor: pageTheme === 'OLD COMPUTER' 
                    ? '#D4C5B9' 
                    : pageTheme === 'MUNY'
                    ? '#FFFFFF'
                    : (isTransparent 
                      ? 'rgba(255,255,255,0.05)' 
                      : primary),
                  backdropFilter: isTransparent ? 'blur(2px)' : 'none',
                  width: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : isMobile ? '44px' : '48px',
                  height: isVerySmallScreen ? '36px' : isSmallScreen ? '40px' : isMobile ? '44px' : '48px',
                  borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '50%',
                  border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? '2px solid #000000' 
                    : (isTransparent ? `1px solid ${primary}` : 'none'),
                  padding: 0,
                  boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' 
                    : (isTransparent ? '0 0 6px rgba(255,255,255,0.2)' : 'none'),
                }}
                aria-label="Pause"
              >
                <svg
                  width={isVerySmallScreen ? '18' : isSmallScreen ? '20' : isMobile ? '22' : '24'}
                  height={isVerySmallScreen ? '18' : isSmallScreen ? '20' : isMobile ? '22' : '24'}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="6"
                    y="4"
                    width="4"
                    height="16"
                    fill={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')}
                    stroke={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="14"
                    y="4"
                    width="4"
                    height="16"
                    fill={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')}
                    stroke={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

                {/* UNSOLO Button - Hidden but logic preserved for future use */}
                {/* <button
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
                </button> */}
              </div>
            )}

            {/* 🎛️ Secondary Controls - Desktop Only */}
            {/* Hidden for OLD COMPUTER theme - moved into player box */}
            {!isMobile && pageTheme !== 'OLD COMPUTER' && (
              <div className={`flex justify-center mb-1 gap-8`}>

              {/* Master Effect Dropdown */}
              <div className="relative">
                <div 
                  className="pressable font-mono tracking-wide cursor-pointer"
                  style={{ 
                  backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE')),
                    color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                    border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                    padding: '8px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                    boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                    fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                    outline: 'none'
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const dropdown = document.getElementById('master-effect-dropdown')
                    if (dropdown) {
                      dropdown.classList.toggle('hidden')
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE')
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE')
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE')
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE')
                  }}
                >
                  <span>EFFECT</span>
                  <span style={{ fontSize: '8px' }}>▼</span>
                </div>
                
                {/* Custom Dropdown Menu */}
                <div 
                  id="master-effect-dropdown"
                  className="absolute rounded shadow-lg hidden"
                  style={{ 
                    top: '100%', 
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '4px',
                    zIndex: 10,
                    minWidth: 'fit-content',
                    whiteSpace: 'nowrap',
                    border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                    backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#FFFFFF' 
                      : (isTransparent ? 'rgba(255,255,255,0.1)' : '#F5F5DC'),
                    backdropFilter: isTransparent ? 'blur(4px)' : 'none',
                    borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                    boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                  }}
                >
                  <div 
                    className="px-2 py-1 cursor-pointer font-mono transition-colors"
                    style={{ 
                      fontSize: '10px',
                      color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                      backgroundColor: pageTheme === 'OLD COMPUTER' ? '#FCFAEE' : (pageTheme === 'MUNY' ? '#FFFFFF' : 'transparent'),
                      fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                      fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                    }}
                    onMouseEnter={(e) => {
                      if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                        e.currentTarget.style.backgroundColor = '#E0E0E0'
                        e.currentTarget.style.color = '#000000'
                      } else {
                        e.currentTarget.style.backgroundColor = primary
                        e.currentTarget.style.color = '#FCFAEE'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                        e.currentTarget.style.backgroundColor = pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE'
                        e.currentTarget.style.color = '#000000'
                      } else {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = primary
                      }
                    }}
                    onClick={() => {
                      setSelectedMasterEffect('flanger')
                      document.getElementById('master-effect-dropdown')?.classList.add('hidden')
                    }}
                  >
                    FLANGER
                  </div>
                  <div 
                    className="px-2 py-1 cursor-pointer font-mono transition-colors"
                    style={{ 
                      fontSize: '10px',
                      color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                      backgroundColor: pageTheme === 'OLD COMPUTER' ? '#FCFAEE' : (pageTheme === 'MUNY' ? '#FFFFFF' : 'transparent'),
                      fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                      fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                    }}
                    onMouseEnter={(e) => {
                      if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                        e.currentTarget.style.backgroundColor = '#E0E0E0'
                        e.currentTarget.style.color = '#000000'
                      } else {
                        e.currentTarget.style.backgroundColor = primary
                        e.currentTarget.style.color = '#FCFAEE'
                      }
                    }}
                      onMouseLeave={(e) => {
                        if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                          e.currentTarget.style.backgroundColor = pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE'
                          e.currentTarget.style.color = '#000000'
                        } else {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = primary
                        }
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
                      backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'TERMINAL THEME' ? '#000000' : '#FCFAEE')),
                      color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (pageTheme === 'TERMINAL THEME' ? '#FFFFFF' : primary),
                      border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFFFFF' : `1px solid ${primary}`),
                      fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : undefined,
                      boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? undefined : undefined),
                      fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : (pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : undefined)
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
                      className={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? "relative transition-all duration-200 ease-in-out overflow-visible" : (pageTheme === 'TERMINAL THEME' ? "relative rounded-full border transition-all duration-200 ease-in-out" : "relative rounded-full border transition-all duration-200 ease-in-out")}
                      style={{ 
                        width: '44px',
                        height: '24px',
                        backgroundColor: (globalFlanger?.enabled || false) 
                          ? (pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'TERMINAL THEME' ? '#0A0A0A' : primary)))
                          : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#808080' : (pageTheme === 'TERMINAL THEME' ? '#000000' : '#FCFAEE')),
                        border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFFFFF' : undefined),
                        borderColor: pageTheme === 'CLASSIC' ? primary : (pageTheme === 'TERMINAL THEME' ? '#FFFFFF' : undefined),
                        borderWidth: pageTheme === 'CLASSIC' ? '1px' : (pageTheme === 'TERMINAL THEME' ? '1px' : undefined),
                        borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '9999px',
                        boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? '0 0 10px rgba(255,255,255,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.1)')
                      }}
                    >
                      <div 
                        className={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? "absolute transition-all duration-200 ease-in-out" : (pageTheme === 'TERMINAL THEME' ? "absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm" : "absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm")}
                        style={{ 
                          width: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '20px' : '18px',
                          height: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '28px' : '18px',
                          top: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '50%' : undefined,
                          left: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? ((globalFlanger?.enabled || false) ? '26px' : '-2px')
                            : undefined,
                          transform: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? 'translateY(-50%)' 
                            : ((globalFlanger?.enabled || false) ? 'translateX(20px)' : 'translateX(2px)'),
                          backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#E0E0E0' : '#ffffff',
                          border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : 'none',
                          borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '9999px',
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : '0 1px 2px rgba(0,0,0,0.2)',
                          zIndex: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 10 : undefined
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
                      backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'TERMINAL THEME' ? '#000000' : '#FCFAEE')),
                      color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (pageTheme === 'TERMINAL THEME' ? '#FFFFFF' : primary),
                      border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFFFFF' : `1px solid ${primary}`),
                      fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : undefined,
                      boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? undefined : undefined),
                      fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : (pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : undefined)
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
                      className={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? "relative transition-all duration-200 ease-in-out overflow-visible" : (pageTheme === 'TERMINAL THEME' ? "relative rounded-full border transition-all duration-200 ease-in-out" : "relative rounded-full border transition-all duration-200 ease-in-out")}
                      style={{ 
                        width: '44px',
                        height: '24px',
                        backgroundColor: (globalCompressor?.enabled || false) 
                          ? (pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'TERMINAL THEME' ? '#0A0A0A' : primary)))
                          : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#808080' : (pageTheme === 'TERMINAL THEME' ? '#000000' : '#FCFAEE')),
                        border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFFFFF' : undefined),
                        borderColor: pageTheme === 'CLASSIC' ? primary : (pageTheme === 'TERMINAL THEME' ? '#FFFFFF' : undefined),
                        borderWidth: pageTheme === 'CLASSIC' ? '1px' : (pageTheme === 'TERMINAL THEME' ? '1px' : undefined),
                        borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '9999px',
                        boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? '0 0 10px rgba(255,255,255,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.1)')
                      }}
                    >
                      <div 
                        className={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? "absolute transition-all duration-200 ease-in-out" : (pageTheme === 'TERMINAL THEME' ? "absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm" : "absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm")}
                        style={{ 
                          width: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '20px' : '18px',
                          height: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '28px' : '18px',
                          top: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '50%' : undefined,
                          left: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? ((globalCompressor?.enabled || false) ? '26px' : '-2px')
                            : undefined,
                          transform: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? 'translateY(-50%)' 
                            : ((globalCompressor?.enabled || false) ? 'translateX(20px)' : 'translateX(2px)'),
                          backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#E0E0E0' : '#ffffff',
                          border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : 'none',
                          borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '9999px',
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : '0 1px 2px rgba(0,0,0,0.2)',
                          zIndex: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 10 : undefined
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}



            {/* Spacing for modules - Hidden for OLD COMPUTER theme */}
            {pageTheme !== 'OLD COMPUTER' && (
              <div style={{ marginBottom: isMobile ? (isVerySmallScreen ? '12px' : isSmallScreen ? '16px' : '20px') : '24px', marginTop: isMobile ? (isVerySmallScreen ? '8px' : isSmallScreen ? '12px' : '16px') : '24px' }}></div>
            )}

            {/* 🎚️ Mixer Modules */}
            {pageTheme === 'OLD COMPUTER' ? (
              /* Retro Window - Player Box (OLD COMPUTER) */
              <div 
                style={{
                  backgroundColor: '#D4C5B9',
                  border: '3px solid #000000',
                  borderTop: '3px solid #000000',
                  boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
                  padding: isMobile ? '4px' : '8px',
                  paddingTop: isMobile ? '4px' : '8px',
                  position: 'relative',
                  overflow: 'visible',
                  zIndex: 10,
                  marginTop: isMobile ? (isSmallScreen || isMediumScreen ? '12px' : '-22px') : '20px',
                  marginLeft: isMobile ? 'auto' : 'auto',
                  marginRight: isMobile ? 'auto' : 'auto',
                  marginBottom: isMobile ? (isVerySmallScreen ? '16px' : (isSmallScreen || isMediumScreen) ? '18px' : '20px') : '0px',
                  width: isMobile ? 'calc(100% - 20px)' : '100%',
                  maxWidth: '896px',
                  display: 'block',
                }}
              >
                {/* Title Bar */}
                <div 
                  style={{
                    backgroundColor: '#C0C0C0',
                    border: '2px solid #000',
                    padding: isMobile ? '3px 6px' : '4px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isMobile ? '2px' : '4px',
                    fontSize: isMobile ? '11px' : '15px',
                    fontWeight: 'bold',
                    color: '#000000',
                    fontFamily: 'monospace',
                  }}
                >
                  <span>MIXER</span>
                  <button
                    onClick={() => setIsListeningMode(!isListeningMode)}
                    style={{
                      padding: isMobile ? '2px 6px' : '3px 8px',
                      fontSize: isMobile ? '9px' : '11px',
                      backgroundColor: '#D4C5B9',
                      border: '1px solid #000',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                      color: '#000000',
                      boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#E8D9CD';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#D4C5B9';
                    }}
                  >
                    {isListeningMode ? 'MIX' : 'LISTEN'}
                  </button>
                </div>

                {/* Content Area with Scrollable Modules or CD Spinner */}
                <div 
                  style={{
                    backgroundColor: '#808080',
                    border: '2px solid #000',
                    padding: isMobile ? '10px' : '20px',
                    position: 'relative',
                    minHeight: isMobile ? '160px' : '200px',
                    zIndex: 20,
                    color: '#FFF',
                    fontFamily: 'monospace',
                    overflowX: isListeningMode ? 'hidden' : 'auto',
                    overflowY: isListeningMode ? 'hidden' : 'visible',
                    touchAction: isMobile ? 'pan-x' : 'auto',
                    WebkitOverflowScrolling: 'touch',
                    scrollBehavior: 'smooth',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isListeningMode ? (
                    /* CD Spinner - Listening Mode */
                    <div
                      ref={cdElementRef}
                      className="cd-spin-accelerating"
                      style={{
                        animationDuration: '5s', // Constant speed - always 5 seconds per rotation
                        width: isMobile ? '200px' : '300px',
                        height: isMobile ? '200px' : '300px',
                        borderRadius: '50%',
                        background: songData?.artwork_url && songData.artwork_url.trim()
                          ? 'transparent'
                          : '#FFF8E7', // Cream color when no artwork
                        border: '2px solid #000000',
                        boxShadow: 'none',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {/* Artwork Image - only shows on outer ring, not center */}
                      {songData && songData.artwork_url && songData.artwork_url.trim() && (
                        <Image
                          src={songData.artwork_url}
                          alt={songData.title}
                          fill
                          sizes="(max-width: 768px) 200px, 300px"
                          unoptimized={isDev}
                          style={{
                            objectFit: 'cover',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zIndex: 0,
                            maskImage: 'radial-gradient(circle, transparent 20%, black 22%)',
                            WebkitMaskImage: 'radial-gradient(circle, transparent 20%, black 22%)'
                          }}
                          className="rounded-full"
                          quality={85}
                          loading="lazy"
                          onError={(e) => {
                            console.warn('⚠️ Artwork failed to load for', songData.title, 'URL:', songData.artwork_url)
                            const target = e.currentTarget as HTMLImageElement
                            target.style.display = 'none'
                          }}
                          onLoad={() => {
                            console.log('✅ Artwork loaded:', songData.title)
                          }}
                        />
                      )}
                      
                      {/* CD Center Hole */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: isMobile ? '16px' : '24px',
                          height: isMobile ? '16px' : '24px',
                          borderRadius: '50%',
                          backgroundColor: '#000000',
                          border: 'none',
                          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
                          zIndex: 3
                        }}
                      />
                      
                      {/* Vinyl/CD Label SVG */}
                      <svg
                        width="100%"
                        height="100%"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          zIndex: 2,
                          pointerEvents: 'none',
                          overflow: 'visible'
                        }}
                        viewBox="0 0 180 180"
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <defs>
                          <pattern id="halftoneDots" x="0" y="0" width="1.67" height="1.67" patternUnits="userSpaceOnUse">
                            <circle cx="0.835" cy="0.835" r="0.35" fill="#000000" stroke="#000000" strokeWidth="0.1"/>
                          </pattern>
                          <mask id="halftoneMask">
                            <circle cx="90" cy="90" r="34.5" fill="white"/>
                            <circle cx="90" cy="90" r="12" fill="black"/>
                          </mask>
                        </defs>
                        
                        <circle
                          cx="90"
                          cy="90"
                          r="36"
                          fill="#FFF8E7"
                          opacity="1"
                        />
                        
                        {/* Halftone dots overlay - always show in center label area */}
                        <circle
                          cx="90"
                          cy="90"
                          r="36"
                          fill="url(#halftoneDots)"
                          mask="url(#halftoneMask)"
                        />
                        
                        <circle
                          cx="90"
                          cy="90"
                          r="34.5"
                          fill="none"
                          stroke="#000000"
                          strokeWidth="0.5"
                          opacity="1"
                        />
                        
                        <circle
                          cx="90"
                          cy="90"
                          r="36"
                          fill="none"
                          stroke="#000000"
                          strokeWidth="0.8"
                          opacity="1"
                        />
                        
                        <circle
                          cx="90"
                          cy="90"
                          r="12"
                          fill="none"
                          stroke="#000000"
                          strokeWidth="0.8"
                          opacity="1"
                        />
                      </svg>
                    </div>
                  ) : (
                    /* Modules - Mixing Mode */
                    <div
                      id="stems-container"
                      className="stems-container"
                    style={{
                      width: '100%',
                      minHeight: isMobile 
                        ? 'clamp(340px, 56dvh, 400px)'
                        : 'auto',
                      maxHeight: isMobile ? 'none' : 'none',
                      paddingBottom: isMobile ? (isVerySmallScreen ? '16px' : isSmallScreen ? '18px' : '20px') : '0px',
                      overflowX: 'auto',
                      overflowY: 'visible',
                      touchAction: isMobile ? 'pan-x' : 'auto',
                    }}
                  >
              <div
                className="flex"
                style={{
                  width: 'max-content', // Allow horizontal scrolling
                  minWidth: '100%',
                  justifyContent: 'center', // Always center the modules
                  flexWrap: 'nowrap',
                  margin: '0 auto',
                  paddingTop: '0px',
                  paddingLeft: isMobile 
                    ? (isVerySmallScreen ? '4px' : (isSmallScreen || isMediumScreen) ? '6px' : '8px')
                    : '8px',
                  paddingRight: isMobile 
                    ? (isVerySmallScreen ? '4px' : (isSmallScreen || isMediumScreen) ? '6px' : '8px')
                    : '8px',
                  paddingBottom: isMobile ? '4px' : '0px', // Extra padding to ensure bottom border visible
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch',
                  overflowY: 'visible', // Visible to show full modules including bottom
                  height: '100%',
                  alignItems: 'flex-start', // flex-start to show bottom border
                  gap: isVerySmallScreen 
                    ? '4px' 
                    : (isSmallScreen || isMediumScreen)
                      ? '6px' 
                      : isMobile 
                        ? '8px' 
                        : stems.length >= 6 
                          ? '16px' 
                          : '32px',
                }}
              >
                {stems.map((stem) => {
                  return (
                  <div
                    key={stem.label}
                    className="mixer-module"
                    style={{
                      width: isVerySmallScreen 
                        ? '70px' 
                        : (isSmallScreen || isMediumScreen)
                          ? '75px' 
                          : isMobile 
                            ? '80px' 
                            : stems.length >= 6 
                              ? '86px' 
                              : '96px',
                      backgroundColor: pageTheme === 'CLASSIC' 
                        ? (isTransparent ? 'rgba(255,255,255,0.05)' : primary)
                        : (pageTheme === 'OLD COMPUTER'
                          ? (isTransparent ? 'rgba(255,255,255,0.05)' : '#D4C5B9') // Beige like buttons
                          : pageTheme === 'MUNY'
                          ? (isTransparent ? 'rgba(255,255,255,0.05)' : '#FFFFFF') // White for MUNY
                          : (isTransparent ? 'rgba(255,255,255,0.05)' : (currentTheme?.moduleBg || primary))),
                      border: pageTheme === 'CLASSIC'
                        ? (isTransparent ? `1px solid ${primary}` : '1px solid #444')
                        : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                          ? (isTransparent ? `1px solid #000000` : '3px solid #000000') // 3px black border like boxes
                          : `1px solid ${currentTheme?.moduleBorder || primary}`),
                      boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') && !isTransparent
                        ? 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff' // Retro 3D effect like boxes
                        : (isTransparent 
                          ? '0 0 6px rgba(255,255,255,0.2)' 
                          : 'inset 0 2px 4px rgba(0, 0, 0, 0.25)'), // Keep original shadow for CLASSIC
                      backdropFilter: isTransparent ? 'blur(2px)' : 'none',
                      borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '10px',
                      padding: isVerySmallScreen 
                        ? '6px' 
                        : (isSmallScreen || isMediumScreen)
                          ? '8px' 
                          : isMobile 
                            ? '10px' 
                            : '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: isMobile ? 'auto' : undefined,
                      maxHeight: isMobile ? 'none' : undefined,
                      /* Match the new mobile min-height so transparent theme feels same size */
                      minHeight: isMobile ? '340px' : undefined,
                      justifyContent: 'flex-start',
                      flexShrink: 0,
                      boxSizing: 'border-box', // Ensure border is included in height
                      minWidth: isVerySmallScreen 
                        ? '70px' 
                        : (isSmallScreen || isMediumScreen)
                          ? '75px' 
                          : isMobile 
                            ? '80px' 
                            : 'auto',
                    }}
                  >
                    <div style={{ 
                      width: '16px', 
                      height: isVerySmallScreen 
                        ? '12px'  // Reduced top spacer
                        : (isSmallScreen || isMediumScreen)
                          ? '14px'  // Reduced top spacer
                          : isMobile 
                            ? '16px'  // Reduced top spacer
                            : '40px', 
                      marginBottom: isVerySmallScreen 
                        ? '6px'  // Reduced spacing
                        : (isSmallScreen || isMediumScreen)
                          ? '8px'  // Reduced spacing
                          : isMobile 
                            ? '10px'  // Reduced spacing
                            : '18px' 
                    }} />

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        fontSize: isVerySmallScreen 
                          ? '9px' 
                          : (isSmallScreen || isMediumScreen)
                            ? '9.5px' 
                            : isMobile 
                              ? '10px' 
                              : '10px',
                        color: pageTheme === 'CLASSIC' 
                          ? (isTransparent ? primary : 'white')
                          : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')),
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                        flexGrow: 1,
                        justifyContent: 'center',
                        marginBottom: isVerySmallScreen 
                          ? '10px' 
                          : (isSmallScreen || isMediumScreen)
                            ? '12px' 
                            : isMobile 
                              ? '14px' 
                              : '30px',
                        paddingTop: isVerySmallScreen 
                          ? '25px'  // Add space above for LEVEL and extended slider
                          : (isSmallScreen || isMediumScreen)
                            ? '28px'
                            : isMobile 
                              ? '30px'
                              : '40px', // Desktop: add space
                        overflow: 'visible', // Allow slider to extend upward
                        position: 'relative', // For absolute positioning of LEVEL
                      }}
                    >
                      <span style={{ 
                        position: 'absolute',
                        top: isVerySmallScreen 
                          ? '-8px'  // Position just above slider
                          : (isSmallScreen || isMediumScreen)
                            ? '-10px'
                            : isMobile 
                              ? '-12px'
                              : '-20px', // Desktop: position just above
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 100, // Very high z-index to ensure above slider
                      }}>LEVEL</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
                        <input
                          type="range"
                          min="0"
                          max="1.4"
                          step="0.01"
                          value={1.4 - (volumes[stem.label] ?? 1)} // Invert: top = 140%, 100% sits lower, bottom = 0%
                          onChange={(e) => {
                            const volume = 1.4 - parseFloat(e.target.value); // Invert back: 0-1.4 range
                            setVolumes((prev) => ({ ...prev, [stem.label]: volume }));
                            setTrackVolume(stem.label, volume);
                          }}
                          className="volume-slider"
                          style={{
                            writingMode: 'vertical-lr' as any, // Match varispeed exactly
                            WebkitAppearance: 'slider-vertical' as any, // Match varispeed - inline sets this
                            appearance: 'slider-vertical' as any,
                            MozAppearance: 'none',
                            width: '20px', // Wide enough to fit 18px thumb
                            height: isVerySmallScreen 
                              ? '100px'  // Extended by 25% (80px * 1.25)
                              : (isSmallScreen || isMediumScreen)
                                ? '113px'  // Extended by 25% (90px * 1.25)
                                : isMobile 
                                  ? '125px'  // Extended by 25% (120px/100px * 1.25)
                                  : '175px', // Extended by 25% (140px * 1.25)
                            background: 'transparent',
                            marginTop: isVerySmallScreen 
                              ? '-20px'  // Pull slider up into padding space
                              : (isSmallScreen || isMediumScreen)
                                ? '-23px'
                                : isMobile 
                                  ? '-25px'
                                  : '-35px', // Desktop: pull up
                            zIndex: 1, // Lower than LEVEL
                          }}
                        />
                      </div>
                    </div>

                    {/* Effect Dropdown & Knob */}
                    <div style={{ marginBottom: isMobile ? (isVerySmallScreen ? '10px' : isSmallScreen ? '12px' : '14px') : '32px', textAlign: 'center' }}>
                      <div className="flex flex-col items-center text-xs select-none knob-container" style={{ 
                        color: pageTheme === 'CLASSIC' 
                          ? (isTransparent ? primary : 'white')
                          : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')),
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit'
                      }}>
                        {/* Effect Type Dropdown */}
                        <div className="mb-0.5 relative" style={{ zIndex: 10, overflow: 'visible', width: '100%', display: 'flex', justifyContent: 'center' }}>
                          {/* Custom Dropdown Menu - positioned above */}
                          <div 
                            id={`effect-dropdown-${stem.label}`}
                            className="absolute rounded shadow-lg hidden"
                            style={{ 
                              bottom: '100%', 
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginBottom: '4px',
                              zIndex: 10,
                              width: 'fit-content',
                              minWidth: '60px',
                              border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                              backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? (isTransparent ? 'rgba(255,255,255,0.1)' : '#FFFFFF')
                                : (isTransparent ? 'rgba(255,255,255,0.1)' : '#F5F5DC'),
                              backdropFilter: isTransparent ? 'blur(4px)' : 'none',
                              borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                              boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <div 
                              className="px-2 py-1 cursor-pointer font-mono transition-colors"
                              style={{ 
                                fontSize: '10px',
                                color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                                backgroundColor: pageTheme === 'OLD COMPUTER' ? '#FCFAEE' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : 'transparent')),
                                fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                                fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                                textDecoration: 'none',
                                borderBottom: 'none',
                                WebkitTapHighlightColor: 'transparent',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                  e.currentTarget.style.backgroundColor = '#E0E0E0';
                                  e.currentTarget.style.color = '#000000';
                                } else {
                                  e.currentTarget.style.backgroundColor = primary;
                                  e.currentTarget.style.color = '#FCFAEE';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                  e.currentTarget.style.backgroundColor = pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE');
                                  e.currentTarget.style.color = '#000000';
                                } else {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = primary;
                                }
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
                                color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                                backgroundColor: pageTheme === 'OLD COMPUTER' ? '#FCFAEE' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : 'transparent')),
                                fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                                fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                                textDecoration: 'none',
                                borderBottom: 'none',
                                WebkitTapHighlightColor: 'transparent',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                  e.currentTarget.style.backgroundColor = '#E0E0E0';
                                  e.currentTarget.style.color = '#000000';
                                } else {
                                  e.currentTarget.style.backgroundColor = primary;
                                  e.currentTarget.style.color = '#FCFAEE';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                  e.currentTarget.style.backgroundColor = pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE');
                                  e.currentTarget.style.color = '#000000';
                                } else {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = primary;
                                }
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
                            className="text-[#FCFAEE] rounded font-mono cursor-pointer flex items-center justify-center transition-colors px-0 py-1 gap-0"
                            style={{ 
                              fontSize: '10px',
                              backgroundColor: pageTheme === 'OLD COMPUTER' 
                                ? 'transparent' 
                                : (pageTheme === 'MUNY' ? '#FFFFFF' : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)),
                              color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? '#000000' 
                                : (isTransparent ? primary : '#FCFAEE'),
                              border: pageTheme === 'OLD COMPUTER' ? 'none' : ((pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`),
                              borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                              fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                              boxShadow: pageTheme === 'OLD COMPUTER' ? 'none' : ((pageTheme === 'MUNY') ? 'inset -1px -1px 0 #000' : (pageTheme === 'OLD INTERNET' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none')),
                              fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                              outline: 'none',
                              width: 'fit-content',
                              minWidth: 'fit-content',
                              whiteSpace: 'nowrap',
                              margin: '0 auto'
                            }}
                            onMouseEnter={(e) => {
                              // Darken the color on hover (only for non-transparent and not OLD COMPUTER)
                              if (pageTheme === 'OLD COMPUTER') {
                                // No background change for OLD COMPUTER theme
                                return;
                              }
                              if (!isTransparent) {
                                const rgb = primary.match(/\d+/g);
                                if (rgb) {
                                  const r = Math.max(0, parseInt(rgb[0]) - 30);
                                  const g = Math.max(0, parseInt(rgb[1]) - 30);
                                  const b = Math.max(0, parseInt(rgb[2]) - 30);
                                  e.currentTarget.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                                }
                              } else {
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' 
                                ? 'transparent' 
                                : (pageTheme === 'MUNY' ? '#FFFFFF' : (isTransparent ? 'rgba(255,255,255,0.1)' : primary));
                            }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const dropdown = document.getElementById(`effect-dropdown-${stem.label}`)
                              if (dropdown) {
                                dropdown.classList.toggle('hidden')
                              }
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.currentTarget.style.backgroundColor = (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? '#D4C5B9' 
                                : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.backgroundColor = (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? '#D4C5B9' 
                                : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)
                            }}
                            onTouchStart={(e) => {
                              e.currentTarget.style.backgroundColor = (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? '#D4C5B9' 
                                : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)
                            }}
                            onTouchEnd={(e) => {
                              e.currentTarget.style.backgroundColor = (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? '#D4C5B9' 
                                : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)
                            }}
                          >
                            <span style={{ fontSize: '12px' }}>EFFECT</span>
                            <span className="ml-0.5" style={{ fontSize: '8px' }}>▼</span>
                          </div>
                        </div>
                        
                        {/* Config Button */}
                        <span 
                          className="mb-1 cursor-pointer font-mono text-xs transition-all duration-200 ease-in-out"
                          style={{ 
                            color: pageTheme === 'CLASSIC' 
                          ? (isTransparent ? primary : 'white')
                          : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')),
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                            fontSize: '10px',
                            letterSpacing: '0.5px',
                            display: 'inline-block',
                            padding: isMobile ? '4px 6px' : '0',
                            borderRadius: isMobile ? '4px' : '0',
                            backgroundColor: 'transparent',
                            touchAction: 'manipulation',
                            textDecoration: 'none',
                            WebkitTapHighlightColor: 'transparent',
                            borderBottom: 'none',
                            outline: 'none'
                          }}
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

                    {/* Mute & Solo - Combined into one split button */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      marginBottom: isMobile ? '0px' : '0px',
                    }}>
                      {/* Split Button: M (left) for MUTE, S (right) for SOLO */}
                      <div style={{
                        display: 'flex',
                        width: '100%',
                        borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                        overflow: 'hidden',
                        border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                        marginBottom: '6px',
                        height: isMobile ? '28px' : '32px',
                        boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                      }}>
                        {/* Left side - MUTE (M) */}
                        <button
                          onClick={() => {
                            const newMuteState = !mutes[stem.label];
                            setMutes(prev => ({ ...prev, [stem.label]: newMuteState }));
                            setSolos(prev => ({ ...prev, [stem.label]: false })); // Clear solo when muting
                            setTrackMute(stem.label, newMuteState);
                          }}
                          style={{
                            flex: 1,
                            fontSize: isMobile ? '12px' : '13px',
                            fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'bold',
                            padding: '0',
                            border: 'none',
                            borderRight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                            backgroundColor: mutes[stem.label] 
                              ? '#FFB3B3' 
                              : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#808080' : '#FCFAEE'),
                            color: mutes[stem.label] 
                              ? ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : 'black')
                              : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#FFFFFF' : primary),
                            fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          M
                        </button>
                        {/* Right side - SOLO (S) */}
                        <button
                          onClick={() => {
                            const newSoloState = !solos[stem.label];
                            setSolos(prev => ({ ...prev, [stem.label]: newSoloState }));
                            setMutes(prev => ({ ...prev, [stem.label]: false })); // Clear mute when soloing
                            setTrackSolo(stem.label, newSoloState);
                          }}
                          style={{
                            flex: 1,
                            fontSize: isMobile ? '12px' : '13px',
                            fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'bold',
                            padding: '0',
                            border: 'none',
                            backgroundColor: solos[stem.label] 
                              ? '#FFD700' 
                              : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#808080' : '#FCFAEE'),
                            color: solos[stem.label] 
                              ? ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : 'black')
                              : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#FFFFFF' : primary),
                            fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          S
                        </button>
                      </div>

                      {/* Label */}
                      <div
                        className="track-label"
                        style={{
                          fontSize: isVerySmallScreen ? '9px' : isSmallScreen ? '9.5px' : isMobile ? '10px' : '10px',
                          padding: isMobile ? '2px 4px' : '3px 6px',
                          borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                          backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#E0E0E0' : '#FCFAEE',
                          color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                          marginTop: '4px',
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                          fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                          border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: isMobile ? '28px' : '40px',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
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
                  )}
                </div>
              </div>
            ) : (
              /* Original structure for other themes */
              <div
                id="stems-container"
                className="stems-container"
                style={{
                  width: '100%',
                  // Use min-height instead of fixed height to prevent cutoff on iOS initial load
                  // Use dvh (dynamic viewport height) for better iOS Safari support
                  // Responsive heights: Properly scaled modules with visible bottom border
                  minHeight: isMobile 
                    ? 'clamp(340px, 56dvh, 400px)'  // Slightly taller than old, but not huge
                    : 'auto',
                  maxHeight: isMobile ? 'none' : 'none',
                  marginTop: isMobile ? '4px' : '-20px',
                  marginBottom: isMobile ? (isVerySmallScreen ? '16px' : isSmallScreen ? '18px' : '20px') : '0px', // Increased to ensure bottom border visible on iPhone 13
                  paddingBottom: isMobile ? (isVerySmallScreen ? '16px' : isSmallScreen ? '18px' : '20px') : '0px', // Increased padding to show bottom border clearly
                  overflowX: 'auto', // Enable horizontal scrolling
                  overflowY: 'visible', // Allow content to be visible, prevent cutoff
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
                    paddingTop: '0px',
                    paddingLeft: isMobile 
                      ? (isVerySmallScreen ? '4px' : isSmallScreen ? '6px' : '8px')
                      : '8px',
                    paddingRight: isMobile 
                      ? (isVerySmallScreen ? '4px' : isSmallScreen ? '6px' : '8px')
                      : '8px',
                    paddingBottom: isMobile ? '4px' : '0px', // Extra padding to ensure bottom border visible
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch',
                    overflowY: 'visible', // Visible to show full modules including bottom
                    height: '100%',
                    alignItems: 'flex-start', // flex-start to show bottom border
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
                        backgroundColor: pageTheme === 'CLASSIC' 
                          ? (isTransparent ? 'rgba(255,255,255,0.05)' : primary)
                          : (pageTheme === 'OLD COMPUTER'
                            ? (isTransparent ? 'rgba(255,255,255,0.05)' : '#D4C5B9') // Beige like buttons
                            : pageTheme === 'MUNY'
                            ? (isTransparent ? 'rgba(255,255,255,0.05)' : '#FFFFFF') // White for MUNY
                            : (isTransparent ? 'rgba(255,255,255,0.05)' : (currentTheme?.moduleBg || primary))),
                        border: pageTheme === 'CLASSIC'
                          ? (isTransparent ? `1px solid ${primary}` : '1px solid #444')
                          : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? (isTransparent ? `1px solid #000000` : '3px solid #000000') // 3px black border like boxes
                            : `1px solid ${currentTheme?.moduleBorder || primary}`),
                        boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') && !isTransparent
                          ? 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff' // Retro 3D effect like boxes
                          : (isTransparent 
                            ? '0 0 6px rgba(255,255,255,0.2)' 
                            : 'inset 0 2px 4px rgba(0, 0, 0, 0.25)'), // Keep original shadow for CLASSIC
                        backdropFilter: isTransparent ? 'blur(2px)' : 'none',
                        borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '10px',
                        padding: isVerySmallScreen 
                          ? '6px' 
                          : isSmallScreen 
                            ? '8px' 
                            : isMobile 
                              ? '10px' 
                              : '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: isMobile ? 'auto' : undefined,
                        maxHeight: isMobile ? 'none' : undefined,
                        /* Match the new mobile min-height so transparent theme feels same size */
                        minHeight: isMobile ? '340px' : undefined,
                        justifyContent: 'flex-start',
                        flexShrink: 0,
                        boxSizing: 'border-box', // Ensure border is included in height
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
                          ? '12px'  // Reduced top spacer
                          : isSmallScreen 
                            ? '14px'  // Reduced top spacer
                            : isMobile 
                              ? '16px'  // Reduced top spacer
                              : '40px', 
                        marginBottom: isVerySmallScreen 
                          ? '6px'  // Reduced spacing
                          : isSmallScreen 
                            ? '8px'  // Reduced spacing
                            : isMobile 
                              ? '10px'  // Reduced spacing
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
                          color: pageTheme === 'CLASSIC' 
                            ? (isTransparent ? primary : 'white')
                            : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')),
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                          flexGrow: 1,
                          justifyContent: 'center',
                          marginBottom: isVerySmallScreen 
                            ? '10px' 
                            : isSmallScreen 
                              ? '12px' 
                              : isMobile 
                                ? '14px' 
                                : '30px',
                          paddingTop: isVerySmallScreen 
                            ? '25px'  // Add space above for LEVEL and extended slider
                            : (isSmallScreen || isMediumScreen)
                              ? '28px'
                              : isMobile 
                                ? '30px'
                                : '40px', // Desktop: add space
                          overflow: 'visible', // Allow slider to extend upward
                          position: 'relative', // For absolute positioning of LEVEL
                        }}
                      >
                        <span style={{ 
                          position: 'absolute',
                          top: isVerySmallScreen 
                            ? '-8px'  // Position just above slider
                            : (isSmallScreen || isMediumScreen)
                              ? '-10px'
                              : isMobile 
                                ? '-12px'
                                : '-20px', // Desktop: position just above
                          left: '50%',
                          transform: 'translateX(-50%)',
                          zIndex: 100, // Very high z-index to ensure above slider
                        }}>LEVEL</span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
                          <input
                            type="range"
                            min="0"
                            max="1.4"
                            step="0.01"
                            value={1.4 - (volumes[stem.label] ?? 1)} // Invert: top = 140%, 100% sits lower, bottom = 0%
                            onChange={(e) => {
                              const volume = 1.4 - parseFloat(e.target.value); // Invert back: 0-1.4 range
                              setVolumes((prev) => ({ ...prev, [stem.label]: volume }));
                              setTrackVolume(stem.label, volume);
                            }}
                            className="volume-slider"
                            style={{
                              writingMode: 'vertical-lr' as any, // Match varispeed exactly
                              WebkitAppearance: 'slider-vertical' as any, // Match varispeed - inline sets this
                              appearance: 'slider-vertical' as any,
                              MozAppearance: 'none',
                              width: '20px', // Wide enough to fit 18px thumb
                              height: isVerySmallScreen 
                                ? '100px'  // Extended by 25% (80px * 1.25)
                                : (isSmallScreen || isMediumScreen)
                                  ? '113px'  // Extended by 25% (90px * 1.25)
                                  : isMobile 
                                    ? '125px'  // Extended by 25% (120px/100px * 1.25)
                                    : '175px', // Extended by 25% (140px * 1.25)
                              background: 'transparent',
                              marginTop: isVerySmallScreen 
                                ? '-20px'  // Pull slider up into padding space
                                : (isSmallScreen || isMediumScreen)
                                  ? '-23px'
                                  : isMobile 
                                    ? '-25px'
                                    : '-35px', // Desktop: pull up
                              zIndex: 1, // Lower than LEVEL
                            }}
                          />
                        </div>
                      </div>

                      {/* Effect Dropdown & Knob */}
                      <div style={{ marginBottom: isMobile ? (isVerySmallScreen ? '10px' : (isSmallScreen || isMediumScreen) ? '12px' : '14px') : '32px', textAlign: 'center' }}>
                        <div className="flex flex-col items-center text-xs select-none knob-container" style={{ 
                          color: pageTheme === 'CLASSIC' 
                            ? (isTransparent ? primary : 'white')
                            : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')),
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit'
                        }}>
                          {/* Effect Type Dropdown */}
                          <div className="mb-0.5 relative" style={{ zIndex: 10, overflow: 'visible', width: '100%', display: 'flex', justifyContent: 'center' }}>
                            {/* Custom Dropdown Menu - positioned above */}
                            <div 
                              id={`effect-dropdown-${stem.label}`}
                              className="absolute rounded shadow-lg hidden"
                              style={{ 
                                bottom: '100%', 
                                left: '50%',
                                transform: 'translateX(-50%)',
                                marginBottom: '4px',
                                zIndex: 10,
                                width: 'fit-content',
                                minWidth: '60px',
                                border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                                backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? (isTransparent ? 'rgba(255,255,255,0.1)' : '#FFFFFF')
                                  : (isTransparent ? 'rgba(255,255,255,0.1)' : '#F5F5DC'),
                                backdropFilter: isTransparent ? 'blur(4px)' : 'none',
                                borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                                boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <div 
                                className="px-2 py-1 cursor-pointer font-mono transition-colors"
                                style={{ 
                                  fontSize: '10px',
                                  color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                                  backgroundColor: pageTheme === 'OLD COMPUTER' ? '#FCFAEE' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : 'transparent')),
                                  fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                                  fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                                  textDecoration: 'none',
                                  borderBottom: 'none',
                                  WebkitTapHighlightColor: 'transparent',
                                  outline: 'none'
                                }}
                                onMouseEnter={(e) => {
                                  if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                    e.currentTarget.style.backgroundColor = '#E0E0E0';
                                    e.currentTarget.style.color = '#000000';
                                  } else {
                                    e.currentTarget.style.backgroundColor = primary;
                                    e.currentTarget.style.color = '#FCFAEE';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                    e.currentTarget.style.backgroundColor = pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE');
                                    e.currentTarget.style.color = '#000000';
                                  } else {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = primary;
                                  }
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
                                  color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                                  backgroundColor: pageTheme === 'OLD COMPUTER' ? '#FCFAEE' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : 'transparent')),
                                  fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                                  fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                                  textDecoration: 'none',
                                  borderBottom: 'none',
                                  WebkitTapHighlightColor: 'transparent',
                                  outline: 'none'
                                }}
                                onMouseEnter={(e) => {
                                  if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                    e.currentTarget.style.backgroundColor = '#E0E0E0';
                                    e.currentTarget.style.color = '#000000';
                                  } else {
                                    e.currentTarget.style.backgroundColor = primary;
                                    e.currentTarget.style.color = '#FCFAEE';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                    e.currentTarget.style.backgroundColor = pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE');
                                    e.currentTarget.style.color = '#000000';
                                  } else {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = primary;
                                  }
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
                              className="text-[#FCFAEE] rounded font-mono cursor-pointer flex items-center justify-center transition-colors px-0 py-1 gap-0"
                              style={{ 
                                fontSize: '10px',
                                backgroundColor: pageTheme === 'OLD COMPUTER' 
                                  ? '#D4C5B9' 
                                  : (pageTheme === 'MUNY' ? '#FFFFFF' : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)),
                                color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? '#000000' 
                                  : (isTransparent ? primary : '#FCFAEE'),
                                border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                                borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                                fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                                boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY') ? 'inset -1px -1px 0 #000' : (pageTheme === 'OLD INTERNET' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'),
                                fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                                outline: 'none',
                                width: 'fit-content',
                                minWidth: 'fit-content',
                                whiteSpace: 'nowrap',
                                margin: '0 auto'
                              }}
                              onMouseEnter={(e) => {
                                // Darken the color on hover (only for non-transparent)
                                if (!isTransparent) {
                                  const rgb = primary.match(/\d+/g);
                                  if (rgb) {
                                    const r = Math.max(0, parseInt(rgb[0]) - 30);
                                    const g = Math.max(0, parseInt(rgb[1]) - 30);
                                    const b = Math.max(0, parseInt(rgb[2]) - 30);
                                    e.currentTarget.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                                  }
                                } else {
                                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' 
                                  ? '#D4C5B9' 
                                  : (pageTheme === 'MUNY' ? '#FFFFFF' : (isTransparent ? 'rgba(255,255,255,0.1)' : primary));
                              }}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const dropdown = document.getElementById(`effect-dropdown-${stem.label}`)
                                if (dropdown) {
                                  dropdown.classList.toggle('hidden')
                                }
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.currentTarget.style.backgroundColor = (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? '#D4C5B9' 
                                  : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)
                              }}
                              onMouseUp={(e) => {
                                e.currentTarget.style.backgroundColor = (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? '#D4C5B9' 
                                  : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)
                              }}
                              onTouchStart={(e) => {
                                e.currentTarget.style.backgroundColor = (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? '#D4C5B9' 
                                  : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)
                              }}
                              onTouchEnd={(e) => {
                                e.currentTarget.style.backgroundColor = (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? '#D4C5B9' 
                                  : (isTransparent ? 'rgba(255,255,255,0.1)' : primary)
                              }}
                            >
                              <span style={{ fontSize: '12px' }}>EFFECT</span>
                              <span className="ml-0.5" style={{ fontSize: '8px' }}>▼</span>
                            </div>
                          </div>
                          
                          {/* Config Button */}
                          <span 
                            className="mb-1 cursor-pointer font-mono text-xs transition-all duration-200 ease-in-out"
                            style={{ 
                              color: pageTheme === 'CLASSIC' 
                            ? (isTransparent ? primary : 'white')
                            : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (isTransparent ? primary : 'white')),
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                              fontSize: '10px',
                              letterSpacing: '0.5px',
                              display: 'inline-block',
                              padding: isMobile ? '4px 6px' : '0',
                              borderRadius: isMobile ? '4px' : '0',
                              backgroundColor: 'transparent',
                              touchAction: 'manipulation',
                              textDecoration: 'none',
                              WebkitTapHighlightColor: 'transparent',
                              borderBottom: 'none',
                              outline: 'none'
                            }}
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

                      {/* Mute & Solo - Combined into one split button */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        marginBottom: isMobile ? '0px' : '0px',
                      }}>
                        {/* Split Button: M (left) for MUTE, S (right) for SOLO */}
                        <div style={{
                          display: 'flex',
                          width: '100%',
                          borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                          overflow: 'hidden',
                          border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                          marginBottom: '6px',
                          height: isMobile ? '28px' : '32px',
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                        }}>
                          {/* Left side - MUTE (M) */}
                          <button
                            onClick={() => {
                              const newMuteState = !mutes[stem.label];
                              setMutes(prev => ({ ...prev, [stem.label]: newMuteState }));
                              setSolos(prev => ({ ...prev, [stem.label]: false })); // Clear solo when muting
                              setTrackMute(stem.label, newMuteState);
                            }}
                            style={{
                              flex: 1,
                              fontSize: isMobile ? '12px' : '13px',
                              fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'bold',
                              padding: '0',
                              border: 'none',
                              borderRight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                              backgroundColor: mutes[stem.label] 
                                ? '#FFB3B3' 
                                : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#808080' : '#FCFAEE'),
                              color: mutes[stem.label] 
                                ? ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : 'black')
                                : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#FFFFFF' : primary),
                              fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            M
                          </button>
                          {/* Right side - SOLO (S) */}
                          <button
                            onClick={() => {
                              const newSoloState = !solos[stem.label];
                              setSolos(prev => ({ ...prev, [stem.label]: newSoloState }));
                              setMutes(prev => ({ ...prev, [stem.label]: false })); // Clear mute when soloing
                              setTrackSolo(stem.label, newSoloState);
                            }}
                            style={{
                              flex: 1,
                              fontSize: isMobile ? '12px' : '13px',
                              fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'bold',
                              padding: '0',
                              border: 'none',
                              backgroundColor: solos[stem.label] 
                                ? '#FFD700' 
                                : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#808080' : '#FCFAEE'),
                              color: solos[stem.label] 
                                ? ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : 'black')
                                : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#FFFFFF' : primary),
                              fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            S
                          </button>
                        </div>

                        {/* Label */}
                        <div
                          className="track-label"
                          style={{
                            fontSize: isVerySmallScreen ? '9px' : isSmallScreen ? '9.5px' : isMobile ? '10px' : '10px',
                            padding: isMobile ? '2px 4px' : '3px 6px',
                            borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                            backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#E0E0E0' : '#FCFAEE',
                            color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                            marginTop: '4px',
                            fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                            fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                            border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                            boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: isMobile ? '28px' : '40px',
                            overflow: 'hidden',
                            boxSizing: 'border-box',
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
            )}

            {/* Desktop Controls Box - Below Mixer Box */}
            {!isMobile && (
              <div 
                style={{
                  backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? '#D4C5B9' 
                    : (isTransparent ? 'rgba(255,255,255,0.05)' : (currentTheme?.moduleBg || primary)),
                  border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? '3px solid #000000' 
                    : (isTransparent ? `1px solid ${primary}` : `1px solid ${currentTheme?.moduleBorder || primary}`),
                  boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff' 
                    : (isTransparent ? '0 0 6px rgba(255,255,255,0.2)' : 'inset 0 2px 4px rgba(0, 0, 0, 0.25)'),
                  borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '10px',
                  backdropFilter: isTransparent ? 'blur(2px)' : 'none',
                  padding: '8px',
                  position: 'relative',
                  overflow: 'visible',
                  zIndex: 10,
                  marginTop: '20px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  marginBottom: '20px',
                  width: 'calc(100% - 20px)',
                  maxWidth: '896px',
                }}
              >
                {/* Title Bar */}
                <div 
                  style={{
                    backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#C0C0C0' 
                      : (isTransparent ? 'rgba(255,255,255,0.1)' : primary),
                    border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '2px solid #000' 
                      : (isTransparent ? `1px solid ${primary}` : `1px solid ${currentTheme?.moduleBorder || primary}`),
                    padding: '4px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#000000' 
                      : (isTransparent ? primary : '#FCFAEE'),
                    fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                  }}
                >
                  <span>CONTROLS</span>
                </div>

                {/* Content Area */}
                <div 
                  style={{
                    backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#FFFFFF' 
                      : (isTransparent ? 'rgba(255,255,255,0.05)' : (currentTheme?.moduleBg || primary)),
                    border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '2px solid #000' 
                      : (isTransparent ? `1px solid ${primary}` : `1px solid ${currentTheme?.moduleBorder || primary}`),
                    padding: '20px',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px',
                    overflow: 'visible',
                  }}
                >
                  {/* Flanger/Compressor Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Master Effect Dropdown */}
                    <div className="relative">
                      <div 
                        className="pressable font-mono tracking-wide cursor-pointer"
                        style={{ 
                          backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? '#D4C5B9' 
                            : (pageTheme === 'MUNY' ? '#FFFFFF' : primary),
                          color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? '#000000' 
                            : '#FCFAEE',
                          border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? '2px solid #000000' 
                            : `1px solid ${primary}`,
                          padding: '8px 12px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                            ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' 
                            : 'none',
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                          borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                          outline: 'none'
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const dropdown = document.getElementById('desktop-controls-master-effect-dropdown')
                          if (dropdown) {
                            dropdown.classList.toggle('hidden')
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.currentTarget.style.backgroundColor = '#D4C5B9'
                        }}
                        onMouseUp={(e) => {
                          e.preventDefault()
                          e.currentTarget.style.backgroundColor = '#D4C5B9'
                        }}
                      >
                        <span>EFFECT</span>
                        <span style={{ fontSize: '8px' }}>▼</span>
                      </div>
                      
                      {/* Custom Dropdown Menu */}
                      <div 
                        id="desktop-controls-master-effect-dropdown"
                        className="absolute rounded shadow-lg hidden"
                        style={{ 
                          top: '100%', 
                          left: '50%',
                          transform: 'translateX(-50%)',
                          marginTop: '4px',
                          zIndex: 10,
                          minWidth: 'fit-content',
                          whiteSpace: 'nowrap',
                          border: '2px solid #000000',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '0',
                          boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                        }}
                      >
                        <div 
                          className="px-2 py-1 cursor-pointer font-mono transition-colors"
                          style={{ 
                            fontSize: '10px',
                            color: '#000000',
                            backgroundColor: '#FCFAEE',
                            fontFamily: 'monospace',
                            fontWeight: 'bold'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#E0E0E0'
                            e.currentTarget.style.color = '#000000'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#FCFAEE'
                            e.currentTarget.style.color = '#000000'
                          }}
                          onClick={() => {
                            setSelectedMasterEffect('flanger')
                            document.getElementById('desktop-controls-master-effect-dropdown')?.classList.add('hidden')
                          }}
                        >
                          FLANGER
                        </div>
                        <div 
                          className="px-2 py-1 cursor-pointer font-mono transition-colors"
                          style={{ 
                            fontSize: '10px',
                            color: '#000000',
                            backgroundColor: '#FCFAEE',
                            fontFamily: 'monospace',
                            fontWeight: 'bold'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#E0E0E0'
                            e.currentTarget.style.color = '#000000'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#FCFAEE'
                            e.currentTarget.style.color = '#000000'
                          }}
                          onClick={() => {
                            setSelectedMasterEffect('compressor')
                            document.getElementById('desktop-controls-master-effect-dropdown')?.classList.add('hidden')
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
                            handleFlangerConfigOpen()
                          }}
                          className="pressable px-4 py-2 font-mono tracking-wide"
                          style={{ 
                            backgroundColor: '#D4C5B9',
                            color: '#000000',
                            border: '2px solid #000000',
                            fontWeight: 'bold',
                            boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                            fontFamily: 'monospace'
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
                            className="relative transition-all duration-200 ease-in-out overflow-visible"
                            style={{ 
                              width: '44px',
                              height: '24px',
                              backgroundColor: (globalFlanger?.enabled || false) ? '#D4C5B9' : '#808080',
                              border: '2px solid #000000',
                              borderRadius: '0',
                              boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff'
                            }}
                          >
                            <div 
                              className="absolute transition-all duration-200 ease-in-out"
                              style={{ 
                                width: '20px',
                                height: '28px',
                                top: '50%',
                                left: (globalFlanger?.enabled || false) ? '26px' : '-2px',
                                transform: 'translateY(-50%)',
                                backgroundColor: '#E0E0E0',
                                border: '2px solid #000000',
                                borderRadius: '0',
                                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                                zIndex: 10
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            handleCompressorConfigOpen()
                          }}
                          className="pressable px-4 py-2 font-mono tracking-wide"
                          style={{ 
                            backgroundColor: '#D4C5B9',
                            color: '#000000',
                            border: '2px solid #000000',
                            fontWeight: 'bold',
                            boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                            fontFamily: 'monospace'
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
                            className="relative transition-all duration-200 ease-in-out overflow-visible"
                            style={{ 
                              width: '44px',
                              height: '24px',
                              backgroundColor: (globalCompressor?.enabled || false) ? '#D4C5B9' : '#808080',
                              border: '2px solid #000000',
                              borderRadius: '0',
                              boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff'
                            }}
                          >
                            <div 
                              className="absolute transition-all duration-200 ease-in-out"
                              style={{ 
                                width: '20px',
                                height: '28px',
                                top: '50%',
                                left: (globalCompressor?.enabled || false) ? '26px' : '-2px',
                                transform: 'translateY(-50%)',
                                backgroundColor: '#E0E0E0',
                                border: '2px solid #000000',
                                borderRadius: '0',
                                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                                zIndex: 10
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Varispeed Section */}
                  <div className="relative" style={{ width: '350px', height: '140px', overflow: 'visible' }}>
                    <div
                      className="absolute top-0 left-0 w-full flex flex-col items-center"
                      style={{
                        pointerEvents: 'none',
                        marginTop: '0px',
                      }}
                    >
                      {bpm !== null && (
                        <div className="text-xs font-mono mb-1" style={{ 
                          color: '#000000',
                          fontFamily: 'monospace',
                          fontWeight: 'bold'
                        }}>
                          {Math.round(bpm * varispeed)} BPM
                        </div>
                      )}
                      <div className="text-sm tracking-wider" style={{ 
                        color: '#000000',
                        fontFamily: 'monospace',
                        fontWeight: 'bold'
                      }}>
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
                        pageTheme={pageTheme}
                      />
                    </div>

                    {/* NATURAL/STRETCH toggle (desktop OLD COMPUTER) – THEMES button temporarily disabled */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2" style={{ bottom: '-6px', zIndex: 100, pointerEvents: 'auto' }}>
                      <button
                        onClick={() => {
                          const newMode = !isNaturalVarispeed;
                          setIsNaturalVarispeed(newMode);
                          setVarispeedControl(varispeed, newMode);
                        }}
                        className="px-2 py-1 text-xs font-mono rounded border"
                        style={{ 
                          color: '#000000',
                          borderColor: '#000000',
                          borderWidth: '2px',
                          backgroundColor: '#D4C5B9',
                          pointerEvents: 'auto',
                          height: '26px',
                          width: '70px',
                          fontSize: isVerySmallScreen ? '10px' : '12px',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                          fontFamily: 'monospace',
                          borderRadius: '0'
                        }}
                        title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                      >
                        {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                      </button>

                      {/*
                      <div className="relative" data-theme-dropdown>
                        <button
                          onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                          className="px-2 py-1 text-xs font-mono rounded border"
                          data-theme-button
                          style={{ 
                            color: '#000000',
                            borderColor: '#000000',
                            borderWidth: '2px',
                            backgroundColor: '#D4C5B9',
                            pointerEvents: 'auto',
                            height: '26px',
                            width: isVerySmallScreen ? '75px' : isSmallScreen ? '72px' : '70px',
                            fontSize: isVerySmallScreen ? '9px' : '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                            fontFamily: 'monospace',
                            borderRadius: '0',
                            whiteSpace: 'nowrap',
                            gap: '2px',
                            zIndex: 1000,
                            position: 'relative'
                          }}
                        >
                          <span>THEMES</span>
                          <span style={{ marginLeft: '2px', fontSize: isVerySmallScreen ? '8px' : '10px' }}>▼</span>
                        </button>
                        {showThemeDropdown && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginBottom: '8px',
                              backgroundColor: '#D4C5B9',
                              border: '2px solid #000000',
                              borderRadius: '0',
                              zIndex: 1000,
                              minWidth: '120px',
                              boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff'
                            }}
                          >
                            {(['CLASSIC', 'OLD COMPUTER', 'MUNY', 'TERMINAL THEME', 'OLD INTERNET'] as const).map(themeOption => (
                              <div
                                key={themeOption}
                                onClick={() => {
                                  handleThemeChange(themeOption);
                                  setShowThemeDropdown(false);
                                }}
                                style={{
                                  padding: '10px 16px',
                                  cursor: 'pointer',
                                  backgroundColor: pageTheme === themeOption ? '#E0E0E0' : '#D4C5B9',
                                  color: '#000000',
                                  borderBottom: themeOption !== 'OLD INTERNET' ? '2px solid #000000' : 'none',
                                  fontSize: '12px',
                                  fontFamily: 'monospace',
                                  fontWeight: 'bold'
                                }}
                                onMouseEnter={(e) => {
                                  if (pageTheme !== themeOption) {
                                    e.currentTarget.style.backgroundColor = '#E0E0E0';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (pageTheme !== themeOption) {
                                    e.currentTarget.style.backgroundColor = '#D4C5B9';
                                  }
                                }}
                              >
                                {themeOption}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      */}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 🎚️ Varispeed Section - Moved up */}
            {/* Desktop Varispeed Slider */}
            {!isMobile && pageTheme !== 'OLD COMPUTER' && (
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
                      <div className="text-xs font-mono mb-1" style={{ 
                        color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                        fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                      }}>
                        {Math.round(bpm * varispeed)} BPM
                      </div>
                    )}
                    <div className="text-sm tracking-wider" style={{ 
                      color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                      fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                      fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                    }}>
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
                      pageTheme={pageTheme}
                    />
                  </div>
                  
                  {/* Mode Toggle Button (desktop) – Theme button temporarily disabled.
                      ⚠️ IMPORTANT: This row is the BOTTOM BOUNDARY of the page. 
                      Nothing can be placed below these buttons. All content must be above this line. */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2" style={{ bottom: '-11px' }}>
                    <button
                      onClick={() => {
                        const newMode = !isNaturalVarispeed;
                        setIsNaturalVarispeed(newMode);
                        setVarispeedControl(varispeed, newMode);
                      }}
                      className="px-2 py-1 text-xs font-mono rounded border"
                      style={{ 
                        color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                        borderColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                        borderWidth: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px' : '1px',
                        backgroundColor: pageTheme === 'OLD COMPUTER'
                          ? '#D4C5B9'
                          : pageTheme === 'MUNY'
                          ? '#FFFFFF'
                          : (isNaturalVarispeed ? primary + '20' : 'transparent'),
                        pointerEvents: 'auto',
                        height: '26px',
                        width: '70px',
                        fontSize: isVerySmallScreen ? '10px' : '12px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                        boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                        borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px'
                      }}
                      title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                    >
                      {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                    </button>
                    {/*
                    <div className="relative" data-theme-dropdown>
                      <button
                        onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                        className="px-2 py-1 text-xs font-mono rounded border"
                        data-theme-button
                        style={{ 
                          color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                          borderColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                          borderWidth: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px' : '1px',
                          backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : 'transparent'),
                          pointerEvents: 'auto',
                          height: '26px',
                          width: isVerySmallScreen ? '75px' : isSmallScreen ? '72px' : '70px',
                          fontSize: isVerySmallScreen ? '10px' : '12px',
                          padding: '0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                          borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                          whiteSpace: 'nowrap',
                          letterSpacing: isVerySmallScreen ? '-0.3px' : '0px',
                        }}
                        title="Select theme"
                      >
                        <span>THEMES</span><span style={{ marginLeft: '2px', fontSize: isVerySmallScreen ? '8px' : '10px' }}>▼</span>
                      </button>
                      {showThemeDropdown && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#F5F5DC')),
                            border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                            borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                            zIndex: 1000,
                            minWidth: '120px',
                            boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : '0 2px 8px rgba(0,0,0,0.15)'
                          }}
                        >
                          {(['CLASSIC', 'OLD COMPUTER', 'MUNY', 'TERMINAL THEME', 'OLD INTERNET'] as const).map(themeOption => (
                            <div
                              key={themeOption}
                              onClick={() => handleThemeChange(themeOption)}
                              style={{
                                padding: '10px 16px',
                                cursor: 'pointer',
                                backgroundColor: pageTheme === themeOption ? primary : '#F5F5DC',
                                color: pageTheme === themeOption ? '#FCFAEE' : primary,
                                borderBottom: themeOption !== 'TERMINAL THEME' ? `1px solid ${primary}` : 'none',
                                fontSize: '12px',
                                fontFamily: 'monospace'
                              }}
                              onMouseEnter={(e) => {
                                if (pageTheme !== themeOption) {
                                  e.currentTarget.style.backgroundColor = primary + '20'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (pageTheme !== themeOption) {
                                  e.currentTarget.style.backgroundColor = '#F5F5DC'
                                }
                              }}
                            >
                              {themeOption === 'CLASSIC' ? 'classic' : themeOption}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    */}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Effect Controls - Above VARISPEED */}
            {/* Optimized for iPhone 13/14 (390x844 viewport) - ONLY move down for small screens */}
            {isMobilePortrait && stems.length >= 1 && (
              /* Mobile Controls Box for all themes */
              <div 
                style={{
                  backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? '#D4C5B9' 
                    : (isTransparent ? 'rgba(255,255,255,0.05)' : (currentTheme?.moduleBg || primary)),
                  border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? '3px solid #000000' 
                    : (isTransparent ? `1px solid ${primary}` : `1px solid ${currentTheme?.moduleBorder || primary}`),
                  boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                    ? 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff' 
                    : (isTransparent ? '0 0 6px rgba(255,255,255,0.2)' : 'inset 0 2px 4px rgba(0, 0, 0, 0.25)'),
                  borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '10px',
                  backdropFilter: isTransparent ? 'blur(2px)' : 'none',
                  padding: '4px',
                  position: 'relative',
                  overflow: 'visible',
                  zIndex: 10,
                  marginTop: (isSmallScreen || isMediumScreen) ? '12px' : '-22px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  marginBottom: (isSmallScreen || isMediumScreen) ? '12px' : '20px',
                  width: 'calc(100% - 20px)',
                  maxWidth: '896px',
                }}
              >
                {/* Title Bar */}
                <div 
                  style={{
                    backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#C0C0C0' 
                      : (isTransparent ? 'rgba(255,255,255,0.1)' : primary),
                    border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '2px solid #000' 
                      : (isTransparent ? `1px solid ${primary}` : `1px solid ${currentTheme?.moduleBorder || primary}`),
                    padding: '3px 6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#000000' 
                      : (isTransparent ? primary : '#FCFAEE'),
                    fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                  }}
                >
                  <span>CONTROLS</span>
                </div>

                {/* Content Area */}
                <div 
                  style={{
                    backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '#FFFFFF' 
                      : (isTransparent ? 'rgba(255,255,255,0.05)' : (currentTheme?.moduleBg || primary)),
                    border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                      ? '2px solid #000' 
                      : (isTransparent ? `1px solid ${primary}` : `1px solid ${currentTheme?.moduleBorder || primary}`),
                    padding: '12px',
                    position: 'relative',
                  }}
                >
                    {/* Mobile Effect Controls */}
                    <div id="mobile-effect-controls" className="w-full flex justify-center sm:hidden" style={{ 
                      marginTop: '0',
                      marginLeft: '0', 
                      marginBottom: '12px' 
                    }}>
                <div className="flex justify-center gap-4">
                  {/* Master Effect Dropdown */}
                  <div className="relative">
                    <div 
                      className="pressable font-mono tracking-wide cursor-pointer"
                      style={{ 
                        backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE')),
                        color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                        border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                        padding: '4px 8px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                        boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                        outline: 'none'
                      }}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const dropdown = document.getElementById('mobile-master-effect-dropdown')
                        if (dropdown) {
                          dropdown.classList.toggle('hidden')
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE')
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE')
                      }}
                      onTouchStart={(e) => {
                        e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE')
                      }}
                      onTouchEnd={(e) => {
                        e.currentTarget.style.backgroundColor = pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE')
                      }}
                    >
                      <span>EFFECT</span>
                      <span style={{ fontSize: '8px' }}>▼</span>
                    </div>
                    
                    {/* Custom Dropdown Menu */}
                    <div 
                      id="mobile-master-effect-dropdown"
                      className="absolute rounded shadow-lg hidden"
                      style={{ 
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10, 
                        marginTop: '4px',
                        minWidth: 'fit-content',
                        whiteSpace: 'nowrap',
                        border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                        backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                          ? '#FFFFFF' 
                          : (isTransparent ? 'rgba(255,255,255,0.1)' : '#F5F5DC'),
                        backdropFilter: isTransparent ? 'blur(4px)' : 'none',
                        borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                        boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                      }}
                    >
                      <div 
                        className="px-2 py-1 cursor-pointer hover:text-[#FCFAEE] font-mono transition-colors"
                        style={{ 
                          fontSize: '10px',
                          color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                          backgroundColor: pageTheme === 'OLD COMPUTER' ? '#FCFAEE' : (pageTheme === 'MUNY' ? '#FFFFFF' : 'transparent'),
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                          fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                        }}
                        onMouseEnter={(e) => {
                          if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                            e.currentTarget.style.backgroundColor = '#E0E0E0'
                            e.currentTarget.style.color = '#000000'
                          } else {
                            e.currentTarget.style.backgroundColor = primary
                            e.currentTarget.style.color = '#FCFAEE'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                            e.currentTarget.style.backgroundColor = pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE'
                            e.currentTarget.style.color = '#000000'
                          } else {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = primary
                          }
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
                          color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                          backgroundColor: pageTheme === 'OLD COMPUTER' ? '#FCFAEE' : (pageTheme === 'MUNY' ? '#FFFFFF' : 'transparent'),
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                          fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                        }}
                        onMouseEnter={(e) => {
                          if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                            e.currentTarget.style.backgroundColor = '#E0E0E0'
                            e.currentTarget.style.color = '#000000'
                          } else {
                            e.currentTarget.style.backgroundColor = primary
                            e.currentTarget.style.color = '#FCFAEE'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                            e.currentTarget.style.backgroundColor = pageTheme === 'MUNY' ? '#FFFFFF' : '#FCFAEE'
                            e.currentTarget.style.color = '#000000'
                          } else {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = primary
                          }
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
                          backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'TERMINAL THEME' ? '#000000' : '#FCFAEE')),
                          color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (pageTheme === 'TERMINAL THEME' ? '#FFFFFF' : primary),
                          border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFFFFF' : `1px solid ${primary}`),
                          fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : undefined,
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? undefined : undefined),
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : (pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : undefined)
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
                          className={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? "relative transition-all duration-200 ease-in-out overflow-visible" : (pageTheme === 'TERMINAL THEME' ? "relative rounded-full border transition-all duration-200 ease-in-out" : "relative rounded-full border transition-all duration-200 ease-in-out")}
                          style={{ 
                            width: '36px',
                            height: '20px',
                            backgroundColor: (globalFlanger?.enabled || false) 
                          ? (pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'TERMINAL THEME' ? '#0A0A0A' : primary)))
                          : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#808080' : (pageTheme === 'TERMINAL THEME' ? '#000000' : '#FCFAEE')),
                            border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFFFFF' : undefined),
                            borderColor: pageTheme === 'CLASSIC' ? primary : (pageTheme === 'TERMINAL THEME' ? '#FFFFFF' : undefined),
                            borderWidth: pageTheme === 'CLASSIC' ? '1px' : (pageTheme === 'TERMINAL THEME' ? '1px' : undefined),
                            borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '9999px',
                            boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? '0 0 10px rgba(255,255,255,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.1)')
                          }}
                        >
                          <div 
                            className={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? "absolute transition-all duration-200 ease-in-out" : (pageTheme === 'TERMINAL THEME' ? "absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm" : "absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm")}
                            style={{ 
                              width: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '16px' : '14px',
                              height: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '24px' : '14px',
                              top: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '50%' : undefined,
                              left: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? ((globalFlanger?.enabled || false) ? '22px' : '-2px')
                                : undefined,
                              transform: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? 'translateY(-50%)' 
                                : ((globalFlanger?.enabled || false) ? 'translateX(16px)' : 'translateX(2px)'),
                              backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#E0E0E0' : '#ffffff',
                              border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : 'none',
                              borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '9999px',
                              boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : '0 1px 2px rgba(0,0,0,0.2)',
                              zIndex: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 10 : undefined
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
                          backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'TERMINAL THEME' ? '#000000' : '#FCFAEE')),
                          color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : (pageTheme === 'TERMINAL THEME' ? '#FFFFFF' : primary),
                          border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFFFFF' : `1px solid ${primary}`),
                          fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : undefined,
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? undefined : undefined),
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : (pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : undefined)
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
                          className={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? "relative transition-all duration-200 ease-in-out overflow-visible" : (pageTheme === 'TERMINAL THEME' ? "relative rounded-full border transition-all duration-200 ease-in-out" : "relative rounded-full border transition-all duration-200 ease-in-out")}
                          style={{ 
                            width: '36px',
                            height: '20px',
                            backgroundColor: (globalCompressor?.enabled || false) 
                          ? (pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'TERMINAL THEME' ? '#0A0A0A' : primary)))
                          : ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#808080' : (pageTheme === 'TERMINAL THEME' ? '#000000' : '#FCFAEE')),
                            border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFFFFF' : undefined),
                            borderColor: pageTheme === 'CLASSIC' ? primary : (pageTheme === 'TERMINAL THEME' ? '#FFFFFF' : undefined),
                            borderWidth: pageTheme === 'CLASSIC' ? '1px' : (pageTheme === 'TERMINAL THEME' ? '1px' : undefined),
                            borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '9999px',
                            boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? '0 0 10px rgba(255,255,255,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.1)')
                          }}
                        >
                          <div 
                            className={(pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? "absolute transition-all duration-200 ease-in-out" : (pageTheme === 'TERMINAL THEME' ? "absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm" : "absolute top-0.5 left-0.5 rounded-full bg-white transition-all duration-200 ease-in-out shadow-sm")}
                            style={{ 
                              width: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '16px' : '14px',
                              height: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '24px' : '14px',
                              top: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '50%' : undefined,
                              left: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? ((globalCompressor?.enabled || false) ? '22px' : '-2px')
                                : undefined,
                              transform: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                ? 'translateY(-50%)' 
                                : ((globalCompressor?.enabled || false) ? 'translateX(16px)' : 'translateX(2px)'),
                              backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#E0E0E0' : '#ffffff',
                              border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : 'none',
                              borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '9999px',
                              boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : '0 1px 2px rgba(0,0,0,0.2)',
                              zIndex: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 10 : undefined
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                    </div>

                    {/* Mobile Portrait Varispeed */}
                    <div id="mobile-varispeed" className="w-full flex justify-center sm:hidden" style={{ 
                      marginTop: isSmallScreen ? '8px' : '12px',
                      marginLeft: '0',
                      marginBottom: '0'
                    }}>
                <div
                  className="relative"
                  style={{
                    marginTop: '0px',
                    marginBottom: '0px', // Removed - spacing handled by parent
                    paddingBottom: isVerySmallScreen ? '8px' : isSmallScreen ? '10px' : '8px', // Padding for NATURAL button clearance
                    width: isVerySmallScreen ? '320px' : (isSmallScreen || isMediumScreen) ? '340px' : '350px',
                    height: isVerySmallScreen ? '120px' : (isSmallScreen || isMediumScreen) ? '130px' : '140px',
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
                      <div className="text-xs font-mono mb-1" style={{ 
                        color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                        fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                      }}>
                        {Math.round(bpm * varispeed)} BPM
                      </div>
                    )}
                    <div className="text-sm tracking-wider" style={{ 
                      color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                      fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                      fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                    }}>
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
                      pageTheme={pageTheme}
                    />
                  </div>
                  
                  {/* Mode Toggle Button and Theme Button - Centered below slider for mobile */}
                  {/* ⚠️ IMPORTANT: These buttons are the BOTTOM BOUNDARY of the page. 
                      Positioned with safe spacing from container bottom to avoid browser chrome overlap. */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2" style={{ 
                    bottom: isVerySmallScreen ? '4px' : isSmallScreen ? '6px' : '4px' // Safe spacing from container bottom
                  }}>
                    <button
                      onClick={() => {
                        const newMode = !isNaturalVarispeed;
                        setIsNaturalVarispeed(newMode);
                        setVarispeedControl(varispeed, newMode);
                      }}
                      className="px-2 py-1 text-xs font-mono rounded border"
                      style={{ 
                        color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                        borderColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                        borderWidth: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px' : '1px',
                        backgroundColor: pageTheme === 'OLD COMPUTER'
                          ? '#D4C5B9'
                          : pageTheme === 'MUNY'
                          ? '#FFFFFF'
                          : (isNaturalVarispeed ? primary + '20' : 'transparent'),
                        pointerEvents: 'auto',
                        height: '26px',
                        width: '70px',
                        fontSize: isVerySmallScreen ? '10px' : '12px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                        boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                        fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit'
                      }}
                      title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                    >
                      {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                    </button>
                    <div className="relative" data-theme-dropdown>
                      <button
                        onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                        className="pressable font-mono tracking-wide"
                        data-theme-button
                        style={{ 
                          backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#FCFAEE')),
                          color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '#000000' : primary,
                          border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                          pointerEvents: 'auto',
                          height: '26px',
                          width: isVerySmallScreen ? '75px' : isSmallScreen ? '72px' : '70px',
                          fontSize: isVerySmallScreen ? '10px' : '12px',
                          padding: '0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal',
                          boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                          fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'inherit',
                          borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                          whiteSpace: 'nowrap',
                          letterSpacing: isVerySmallScreen ? '-0.3px' : '0px',
                        }}
                        title="Select theme"
                      >
                        <span>THEMES</span><span style={{ marginLeft: '2px', fontSize: isVerySmallScreen ? '8px' : '10px' }}>▼</span>
                      </button>
                      {showThemeDropdown && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: '8px',
                            backgroundColor: pageTheme === 'OLD COMPUTER' ? '#D4C5B9' : (pageTheme === 'MUNY' ? '#FFFFFF' : (pageTheme === 'OLD INTERNET' ? '#C0C0C0' : '#F5F5DC')),
                            border: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '2px solid #000000' : `1px solid ${primary}`,
                            borderRadius: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? '0' : '4px',
                            zIndex: 1000,
                            minWidth: '120px',
                            boxShadow: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : '0 2px 8px rgba(0,0,0,0.15)'
                          }}
                        >
                          {(['CLASSIC', 'OLD COMPUTER', 'MUNY', 'TERMINAL THEME', 'OLD INTERNET'] as const).map(themeOption => (
                            <div
                              key={themeOption}
                              onClick={() => handleThemeChange(themeOption)}
                              style={{
                                padding: '10px 16px',
                                cursor: 'pointer',
                                backgroundColor: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? (pageTheme === themeOption ? '#E0E0E0' : '#D4C5B9')
                                  : (pageTheme === themeOption ? primary : '#F5F5DC'),
                                color: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? '#000000' 
                                  : (pageTheme === themeOption ? '#FCFAEE' : primary),
                                borderBottom: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') 
                                  ? (themeOption !== 'TERMINAL THEME' ? '2px solid #000000' : 'none')
                                  : (themeOption !== 'TERMINAL THEME' ? `1px solid ${primary}` : 'none'),
                                fontSize: '12px',
                                fontFamily: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'monospace' : 'monospace',
                                fontWeight: (pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET') ? 'bold' : 'normal'
                              }}
                              onMouseEnter={(e) => {
                                if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                  if (pageTheme !== themeOption) {
                                    e.currentTarget.style.backgroundColor = '#E0E0E0'
                                  }
                                } else {
                                  if (pageTheme !== themeOption) {
                                    e.currentTarget.style.backgroundColor = primary + '20'
                                  }
                                }
                              }}
                              onMouseLeave={(e) => {
                                if ((pageTheme === 'OLD COMPUTER' || pageTheme === 'MUNY' || pageTheme === 'OLD INTERNET')) {
                                  if (pageTheme !== themeOption) {
                                    e.currentTarget.style.backgroundColor = '#D4C5B9'
                                  }
                                } else {
                                  if (pageTheme !== themeOption) {
                                    e.currentTarget.style.backgroundColor = '#F5F5DC'
                                  }
                                }
                              }}
                            >
                              {themeOption === 'CLASSIC' ? 'classic' : themeOption}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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

      {/* PixChicago Font */}
      <style dangerouslySetInnerHTML={{__html: `
        @font-face {
          font-family: 'pixChicago';
          src: url('/fonts/pixChicago.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      `}} />
      
      {/* CD Spinner CSS Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes cdRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .cd-spin-accelerating {
          animation: cdRotate linear infinite;
          animation-play-state: running;
        }
      `}} />

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