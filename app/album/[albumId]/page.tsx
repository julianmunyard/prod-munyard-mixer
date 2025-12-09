'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import PoolsuiteLoadingScreen from '../../components/PoolsuiteLoadingScreen'
import RealTimelineMixerEngine from '../../../audio/engine/realTimelineMixerEngine'

// Check if we're in development mode
const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'

type Song = {
  id: string
  title: string
  artist_name: string
  artist_slug: string
  song_slug: string
  bpm: number | null
  track_number: number
  album_title: string
  album_id?: string
  primary_color?: string
  color: string
  demo_mp3?: string | null
  artwork_url?: string | null
  page_theme?: 'TERMINAL THEME' | 'OLD COMPUTER' | null
}

export default function AlbumLandingPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const albumId = params.albumId as string
  const songIdsParam = searchParams.get('songs')
  
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [albumTitle, setAlbumTitle] = useState<string>('')
  const [artistName, setArtistName] = useState<string>('')
  const [primaryColor, setPrimaryColor] = useState('#B8001F')
  const [pageTheme, setPageTheme] = useState<'TERMINAL THEME' | 'OLD COMPUTER'>('TERMINAL THEME')
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [showPageThemeDropdown, setShowPageThemeDropdown] = useState(false)

  // Theme definitions
  const themes = {
    'OLD COMPUTER': {
      background: '#FFE5E5', // Pink background for page
      text: '#000000',
      border: '#000000',
      inputBg: '#FFFFFF',
      inputText: '#000000',
      buttonBg: '#D4C5B9', // Beige for buttons
      buttonText: '#000000',
      cardBg: '#D4C5B9', // Beige for window container
      cardBorder: '#000000', // Black border
      accent: '#B8001F',
      sectionBg: '#E0E0E0', // Light grey for selected items
      playerBg: '#808080', // Grey for PLAYER section
      playerText: '#FFFFFF', // White text in player
      windowTitleBg: '#C0C0C0', // Grey for window title bars
      windowContentBg: '#FFFFFF', // White for MIXTAPES content
      glow: 'none',
      vinylBorder: '#000000',
      vinylGlow: 'none'
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
      vinylBorder: '#FFB6C1',
      vinylGlow: '0 0 15px rgba(255,182,193,0.7), 0 0 8px rgba(255,182,193,0.5)'
    }
  }
  
  const currentTheme = themes[pageTheme]
  const [isPlaying, setIsPlaying] = useState(false)
  const [demoReady, setDemoReady] = useState(false)
  const [cdJustStarted, setCdJustStarted] = useState(false)
  const [cdStopping, setCdStopping] = useState(false)
  const [cdSpinDuration, setCdSpinDuration] = useState(5)
  const [cdFinalRotation, setCdFinalRotation] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Get current date with 1983 as the year - updates daily (DD/MM/1983 format)
  const [date1983, setDate1983] = useState(() => {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${day}/${month}/1983`
  })
  
  // Update date once per day (checks every hour)
  useEffect(() => {
    const updateDate = () => {
      const now = new Date()
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const newDate = `${day}/${month}/1983`
      setDate1983(newDate)
    }
    
    // Update immediately
    updateDate()
    
    // Check every hour to see if the day has changed
    const interval = setInterval(() => {
      updateDate()
    }, 60 * 60 * 1000) // Every hour
    
    return () => clearInterval(interval)
  }, [])
  const cdAccelerationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cdAccelerationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const cdDecelerationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const cdRotationTrackerRef = useRef<number>(0)
  const cdStartTimeRef = useRef<number | null>(null)
  const cdElementRef = useRef<HTMLDivElement | null>(null)
  const demoEngineRef = useRef<RealTimelineMixerEngine | null>(null)
  const silentModeBypassRef = useRef<HTMLAudioElement | null>(null)
  const audioUnlockedRef = useRef(false)
  const manuallyUnlockedRef = useRef(false)
  
  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '--:--'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }
  
  // Detect iOS (same as stem player)
  const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)

  // ==================== 🎨 Set Theme Color for iOS Status Bar ====================
  useEffect(() => {
    // Set theme-color for iOS status bar based on selected theme
    let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.name = 'theme-color'
      document.head.appendChild(themeColorMeta)
    }
    const originalColor = themeColorMeta.content
    // Set color based on theme: pink for OLD COMPUTER, black for TERMINAL THEME
    themeColorMeta.content = pageTheme === 'OLD COMPUTER' ? '#FFE5E5' : '#000000'
    
    // Cleanup: restore cream color when component unmounts
    return () => {
      if (themeColorMeta) {
        themeColorMeta.content = '#FCFAEE' // Restore cream
      }
    }
  }, [pageTheme])

  // ==================== 🔇 Silent Mode Bypass (iOS Hack) ====================
  // iOS treats Web Audio API as "system sounds" that respect silent mode
  // Solution: User taps mute/unmute button to unlock audio
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
      // UNMUTE: Recreate channel tag if destroyed, then play
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
      
      // Play silent audio immediately - this forces WebAudio onto media channel on iOS
      audio.play()
        .then(() => {
          console.log('🔊 Audio unmuted - silent track playing');
          // If demo is playing, make sure it continues
          if (isPlaying && demoEngineRef.current) {
            demoEngineRef.current.play?.();
          }
        })
        .catch((error: any) => {
          console.warn('⚠️ Unmute play failed:', error?.message || 'Unknown');
        });
    } else {
      // MUTE: Stop silent audio immediately
      audio.pause();
      audio.currentTime = 0;
      manuallyUnlockedRef.current = false;
      console.log('🔇 Audio muted - silent track stopped');
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isIOS) return; // Only needed on iOS
    
    // Create a hidden audio element that will play silence
    const audio = document.createElement('audio')
    audio.loop = true
    audio.volume = 0.001 // Very quiet, but not zero (zero gets muted by iOS)
    audio.preload = 'auto'
    audio.controls = false
    ;(audio as any).disableRemotePlayback = true // Prevent AirPlay
    audio.setAttribute('playsinline', 'true') // iOS compatibility
    audio.setAttribute('webkit-playsinline', 'true') // Older iOS
    ;(audio as any).playsInline = true // Critical for iOS
    audio.style.display = 'none' // Hidden but functional
    
    // Use high-quality MP3 silence
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
    
    // Helper to destroy channel tag (when page is hidden)
    const destroyChannelTag = () => {
      if (audio && audio.src && audio.src !== 'about:blank') {
        audio.src = 'about:blank'
        audio.load()
        audio.pause()
        console.log('🔇 Silent audio destroyed (page hidden)')
      }
    }
    
    // Helper to recreate channel tag (when page becomes visible again)
    const recreateChannelTag = () => {
      if (audio && audio.src === 'about:blank') {
        audio.src = silence
        audio.load()
        console.log('🔇 Silent audio recreated (page visible)')
      }
    }
    
    // Handle page visibility - destroy tag when hidden to hide iOS media controls
    const handleVisibilityChange = () => {
      if (document.hidden) {
        destroyChannelTag()
      } else {
        // Page visible - recreate if needed (only if user had unmuted)
        if (audioUnlockedRef.current || manuallyUnlockedRef.current) {
          recreateChannelTag()
          // If demo is playing, restart silent audio
          if (isPlaying) {
            audio.play().catch((e: any) => console.warn('Silent audio play failed on visibility:', e))
          }
        }
      }
    }
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // On iOS, also listen for focus/blur (because iOS page visibility API is buggy)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)
    
    return () => {
      // Cleanup
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
      if (audio) {
        audio.pause()
        audio.src = ''
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio)
        }
      }
    }
  }, [isIOS, isPlaying])

  // Keep silent audio playing while demo plays (critical for iOS)
  useEffect(() => {
    if (!isIOS || !silentModeBypassRef.current) return;
    
    const audio = silentModeBypassRef.current;
    
    if (isPlaying && audioUnlockedRef.current) {
      // Demo is playing - ensure silent audio is also playing
      if (audio.paused && audio.src && audio.src !== 'about:blank') {
        audio.play().catch((e: any) => {
          console.warn('Failed to keep silent audio playing:', e);
        });
      }
    }
  }, [isPlaying, isIOS, audioUnlocked])

  useEffect(() => {
    const loadAlbum = async () => {
      try {
        setLoading(true)
        setError(null)

        // Albums and songs are publicly viewable - no authentication required
        // Priority 1: Use song IDs from URL if available (most reliable)
        let data: any[] | null = null
        let queryErrors: string[] = []
        
        if (songIdsParam) {
          const songIds = songIdsParam.split(',').filter(Boolean)
          console.log('🎵 Querying songs by IDs from URL:', songIds)
          
          const { data: idsData, error: idsError } = await supabase
            .from('songs')
            .select('id, title, artist_name, artist_slug, song_slug, bpm, track_number, album_id, album_title, album_slug, primary_color, color, demo_mp3, artwork_url, page_theme, created_at')
            .in('id', songIds)
            .order('created_at', { ascending: true })
          
          if (idsError) {
            const errorMsg = `Error querying by IDs: ${idsError.message || JSON.stringify(idsError)}`
            console.error('❌ Query error:', errorMsg)
            console.error('❌ Song IDs attempted:', songIds)
            queryErrors.push(errorMsg)
          } else {
            console.log('🎵 Query result:', { 
              found: idsData?.length || 0, 
              requested: songIds.length,
              data: idsData,
              ids: songIds
            })
            if (idsData && idsData.length > 0) {
              data = idsData
              console.log('✅ Found', idsData.length, 'songs by IDs')
            } else {
              console.warn('⚠️ No songs found with IDs:', songIds)
              // Try to check if songs exist WITHOUT user_id filter (debug)
              // Debug: Check if songs exist
              for (const songId of songIds) {
                const { data: songCheck, error: checkError } = await supabase
                  .from('songs')
                  .select('id, title, album_id')
                  .eq('id', songId)
                  .single()
                console.log(`  Checking song ${songId}:`, { 
                  exists: !!songCheck, 
                  error: checkError?.message
                })
              }
            }
          }
        }
        
        // Priority 2: Try querying by album_id (albumId is the UUID)
        if (!data || data.length === 0) {
          console.log('🎵 Trying to query by album_id:', albumId)
          const { data: albumIdData, error: albumIdError } = await supabase
            .from('songs')
            .select('id, title, artist_name, artist_slug, song_slug, bpm, track_number, album_id, album_title, album_slug, primary_color, color, demo_mp3, artwork_url, page_theme, created_at')
            .eq('album_id', albumId)
            .order('track_number', { ascending: true })
          
          if (albumIdError) {
            console.error('⚠️ Album ID query failed:', albumIdError.message, albumIdError)
          } else {
            console.log('🎵 Album ID query result:', { found: albumIdData?.length || 0, albumId })
            if (albumIdData && albumIdData.length > 0) {
              data = albumIdData
              console.log('✅ Found', albumIdData.length, 'songs by album_id')
            } else {
              console.warn('⚠️ No songs found with album_id:', albumId)
            }
          }
        }
        
        // Priority 3: Try querying by album_slug (albumId might be the slug)
        if (!data || data.length === 0) {
          console.log('🎵 Trying to query by album_slug:', albumId)
          const { data: slugData, error: slugError } = await supabase
            .from('songs')
            .select('id, title, artist_name, artist_slug, song_slug, bpm, track_number, album_id, album_title, album_slug, primary_color, color, demo_mp3, artwork_url, page_theme, created_at')
            .eq('album_slug', albumId)
            .order('track_number', { ascending: true })
          
          if (slugError) {
            console.log('⚠️ Album slug query failed (expected if column missing):', slugError.message)
          } else if (slugData && slugData.length > 0) {
            data = slugData
            console.log('✅ Found', slugData.length, 'songs by album_slug')
          }
        }
        
        // Priority 4: Fallback to recent songs (last 24 hours)
        if (!data || data.length === 0) {
          console.log('🎵 Fallback: Querying recent songs...')
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          
          const { data: recentData, error: recentError } = await supabase
            .from('songs')
            .select('id, title, artist_name, artist_slug, song_slug, bpm, track_number, album_id, album_title, album_slug, primary_color, color, demo_mp3, artwork_url, page_theme, created_at')
            .gte('created_at', oneDayAgo)
            .order('created_at', { ascending: false })
            .limit(20)
          
          if (recentError) {
            const errorMsg = `Error querying recent songs: ${recentError.message || JSON.stringify(recentError)}`
            console.error('❌', errorMsg)
            queryErrors.push(errorMsg)
          } else if (recentData && recentData.length > 0) {
            data = recentData
            console.log('✅ Found', recentData.length, 'recent songs')
          }
        }
        
        // Add default track numbers if not present
        data = data?.map((song, index) => ({
          ...song,
          track_number: (song as any).track_number || index + 1,
          album_title: (song as any).album_title || 'Untitled Album'
        })) || []

        if (!data || data.length === 0) {
          // Try one more query to check if songs exist at all
          console.log('🔍 Final check: Querying all songs for user...')
          if (user) {
            const { data: allSongs, error: allError } = await supabase
              .from('songs')
              .select('id, title, album_id, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10)
            
            console.log('🔍 Recent songs for user:', { count: allSongs?.length, songs: allSongs, error: allError })
            
            if (songIdsParam) {
              const requestedIds = songIdsParam.split(',').filter(Boolean)
              console.log('🔍 Requested song IDs:', requestedIds)
              console.log('🔍 User has songs with IDs:', allSongs?.map(s => s.id))
            }
          }
          
          const debugInfo = {
            albumId,
            songIdsParam,
            hasData: !!data,
            dataLength: data?.length,
            queryErrors
          }
          console.error('❌ No songs found. Debug info:', debugInfo)
          setError(`Album not found. URL: /album/${albumId}${songIdsParam ? `?songs=${songIdsParam}` : ''}. If you just created this album, the songs might still be loading. Otherwise, please check the URL and try creating the album again.`)
          setLoading(false)
          return
        }

        // Log demo_mp3 and artwork_url for debugging - check what's actually in the field
        console.log('🎵 Songs loaded with demo_mp3 and artwork_url check:')
        console.log('📊 Total songs:', data?.length)
        console.log('🔍 RAW DATA:', JSON.stringify(data, null, 2))
        data?.forEach((s: any) => {
          console.log(`  - ${s.title}:`, {
            id: s.id,
            demo_mp3: s.demo_mp3,
            artwork_url: s.artwork_url,
            isString: typeof s.artwork_url === 'string',
            isNull: s.artwork_url === null,
            isUndefined: s.artwork_url === undefined,
            isEmpty: !s.artwork_url,
            isUrl: s.artwork_url?.startsWith('http'),
            length: s.artwork_url?.length,
            firstChars: s.artwork_url?.substring(0, 50),
            allKeys: Object.keys(s)
          })
          
          // DIRECT DATABASE CHECK - fetch the song again to verify
          supabase
            .from('songs')
            .select('id, title, demo_mp3, artwork_url')
            .eq('id', s.id)
            .single()
            .then(({ data: verifyData, error: verifyError }) => {
              if (verifyError) {
                console.error(`❌ Direct DB check failed for ${s.title}:`, verifyError)
              } else {
                console.log(`🔬 DIRECT DB CHECK for ${s.title}:`, {
                  id: verifyData?.id,
                  demo_mp3: verifyData?.demo_mp3,
                  artwork_url: verifyData?.artwork_url,
                  hasDemo: !!verifyData?.demo_mp3,
                  hasArtwork: !!verifyData?.artwork_url
                })
              }
            })
        })
        
        setSongs(data as Song[])
        if (data && data.length > 0) {
          setAlbumTitle((data[0] as any).album_title || 'Untitled Album')
          setArtistName(data[0].artist_name || '')
          setPrimaryColor(data[0].primary_color || data[0].color || '#B8001F')
          // Load page theme from first song (if saved)
          if (data[0].page_theme && (data[0].page_theme === 'TERMINAL THEME' || data[0].page_theme === 'OLD COMPUTER')) {
            setPageTheme(data[0].page_theme)
          }
        }
      } catch (err) {
        console.error('Error loading album:', err)
        const errorMessage = err instanceof Error 
          ? err.message 
          : typeof err === 'object' && err !== null
            ? JSON.stringify(err)
            : String(err)
        setError(errorMessage || 'Failed to load album')
      } finally {
        setLoading(false)
      }
    }

    if (albumId) {
      loadAlbum()
    }
  }, [albumId, songIdsParam])

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleSongClick = (song: Song) => {
    console.log('🎯 SONG CLICKED:', {
      title: song.title,
      demo_mp3: song.demo_mp3,
      artwork_url: song.artwork_url,
      hasDemo: !!song.demo_mp3,
      hasArtwork: !!song.artwork_url,
      artworkType: typeof song.artwork_url,
      artworkUrl: song.artwork_url
    })
    
    // Stop current demo if playing - check if engine is initialized
    if (demoEngineRef.current && demoReady) {
      try {
        demoEngineRef.current.pause()
        demoEngineRef.current.stop()
      } catch (err) {
        console.warn('Error stopping demo:', err)
      }
    }
    setIsPlaying(false)
    setDemoReady(false)
    
    // Reset stopping state and trigger CD spin animation - start slow then accelerate smoothly
    setCdStopping(false)
    setCdFinalRotation(null) // Clear final rotation when selecting new song
    // Clear any inline transform that might be set
    if (cdElementRef.current) {
      cdElementRef.current.style.transform = ''
      cdElementRef.current.style.animation = ''
    }
    setSelectedSong(song)
    
    // Clear any existing acceleration
    if (cdAccelerationTimeoutRef.current) {
      clearTimeout(cdAccelerationTimeoutRef.current)
    }
    if (cdAccelerationIntervalRef.current) {
      clearInterval(cdAccelerationIntervalRef.current)
    }
    
    // Start at slow speed
    setCdSpinDuration(5)
    setCdJustStarted(true)
    
    // Smoothly accelerate over 3 seconds
    let elapsed = 0
    const duration = 3000
    const interval = 16
    const startSpeed = 5
    const endSpeed = 0.3
    
    cdAccelerationIntervalRef.current = setInterval(() => {
      elapsed += interval
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      const currentSpeed = startSpeed - (startSpeed - endSpeed) * eased
      
      // Ensure we never go below the target speed
      const clampedSpeed = Math.max(currentSpeed, endSpeed)
      setCdSpinDuration(clampedSpeed)
      
      if (progress >= 1) {
        if (cdAccelerationIntervalRef.current) {
          clearInterval(cdAccelerationIntervalRef.current)
          cdAccelerationIntervalRef.current = null
        }
        // Lock at exactly 0.3s - ensure no further changes
        setCdSpinDuration(0.3)
        // Keep cdJustStarted true - no state change to avoid animation restart
      }
    }, interval)
  }
  
  // Initialize and load demo using RealTimelineMixerEngine (same as stem player)
  useEffect(() => {
    if (!selectedSong?.demo_mp3) {
      setDemoReady(false)
      return
    }

    const loadDemo = async () => {
      try {
        console.log('🎵 Loading demo with Superpowered engine:', selectedSong.title)
        console.log('  Demo URL:', selectedSong.demo_mp3)
        
        // Clean up previous engine
        if (demoEngineRef.current) {
          demoEngineRef.current.pause()
          demoEngineRef.current.stop()
          // Note: We might want to dispose, but let's keep it simple for now
        }

        // Create new engine - SAME AS STEM PLAYER
        demoEngineRef.current = new RealTimelineMixerEngine()
        await demoEngineRef.current.init()
        
        // Set up timeline cursor updates for current time
        if (demoEngineRef.current.audioEngine) {
          demoEngineRef.current.audioEngine.onTimelineFrameCursorUpdate = (cursor: number) => {
            const timeInSeconds = cursor / 48000 // Convert samples to seconds
            setCurrentTime(timeInSeconds)
          }
          
          // Capture timeline duration when available
          demoEngineRef.current.audioEngine.onTimelineDurationSet = (d: number) => {
            setDuration(d)
            console.log('📏 Duration set:', d, 'seconds')
          }
        }
        
        // Load the demo as a single "stem" - SAME AS STEM PLAYER
        const demoStemData = [{
          name: 'Demo',
          url: selectedSong.demo_mp3, // Already full Supabase URL
          label: 'Demo'
        }]
        
        await demoEngineRef.current.loadStemsFromSupabase(demoStemData)
        
        // Try to get duration after loading
        // Note: This might need to be done after the timeline is actually ready
        // The onTimelineDurationSet callback should handle it
        
        setDemoReady(true)
        setCurrentTime(0) // Reset time when loading new song
        setDuration(0) // Reset duration
        console.log('✅ Demo engine ready!')
        
        // Auto-play when demo is loaded
        try {
        // On iOS: Start silent audio track FIRST (auto-unmute like stem player)
        if (isIOS && silentModeBypassRef.current) {
          const audio = silentModeBypassRef.current;
          
          // Recreate channel tag if destroyed
          if (audio.src === 'about:blank' || !audio.src) {
            const huffman = (count: number, repeatStr: string): string => {
              let e = repeatStr
              for (; count > 1; count--) e += repeatStr
              return e
            }
            const silence = "data:audio/mpeg;base64,//uQx" + huffman(23, "A") + "WGluZwAAAA8AAAACAAACcQCA" + huffman(16, "gICA") + huffman(66, "/") + "8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkI" + huffman(320, "A") + "//sQxAADgnABGiAAQBCqgCRMAAgEAH" + huffman(15, "/") + "7+n/9FTuQsQH//////2NG0jWUGlio5gLQTOtIoeR2WX////X4s9Atb/JRVCbBUpeRUq" + huffman(18, "/") + "9RUi0f2jn/+xDECgPCjAEQAABN4AAANIAAAAQVTEFNRTMuMTAw" + huffman(97, "V") + "Q=="
            audio.src = silence
            audio.load()
            await new Promise((resolve) => {
              if (audio.readyState >= 2) {
                resolve(undefined);
              } else {
                audio.addEventListener('canplay', () => resolve(undefined), { once: true });
              }
            });
          }
          
          // Ensure silent audio is at the start
          if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
          }
          
          try {
            await audio.play();
            audioUnlockedRef.current = true;
            setAudioUnlocked(true);
            console.log('🔊 Silent audio started (iOS media channel unlock)');
            await new Promise(resolve => setTimeout(resolve, 20));
          } catch (err: any) {
            console.warn('⚠️ Silent audio start failed:', err?.message || 'Unknown');
          }
        }
        
        await demoEngineRef.current.play()
        setIsPlaying(true)
          
          // Start CD acceleration
          setCdStopping(false)
          
          // Clear any existing acceleration
          if (cdAccelerationTimeoutRef.current) {
            clearTimeout(cdAccelerationTimeoutRef.current)
          }
          if (cdAccelerationIntervalRef.current) {
            clearInterval(cdAccelerationIntervalRef.current)
          }
          
          // Start at slow speed
          setCdSpinDuration(5)
          setCdJustStarted(true)
          
          // Smoothly accelerate over 3 seconds
          let elapsed = 0
          const duration = 3000
          const interval = 16
          const startSpeed = 5
          const endSpeed = 0.3
          
          cdAccelerationIntervalRef.current = setInterval(() => {
            elapsed += interval
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
            const currentSpeed = startSpeed - (startSpeed - endSpeed) * eased
            setCdSpinDuration(currentSpeed)
            
            if (progress >= 1) {
              if (cdAccelerationIntervalRef.current) {
                clearInterval(cdAccelerationIntervalRef.current)
                cdAccelerationIntervalRef.current = null
              }
              // Lock at fast speed - keep everything stable to prevent animation restart
              setCdSpinDuration(0.3)
              // Don't change cdJustStarted to avoid re-render that could restart animation
              // Duration stays at 0.3s and animation continues smoothly
            }
          }, interval)
          
          console.log('▶️ Demo auto-playing')
        } catch (playError) {
          console.error('❌ Failed to auto-play:', playError)
        }
        
      } catch (error) {
        console.error('❌ Failed to load demo:', error)
        setDemoReady(false)
      }
    }

    loadDemo()

    // Cleanup on unmount or song change
    return () => {
      if (cdAccelerationTimeoutRef.current) {
        clearTimeout(cdAccelerationTimeoutRef.current)
        cdAccelerationTimeoutRef.current = null
      }
      if (cdAccelerationIntervalRef.current) {
        clearInterval(cdAccelerationIntervalRef.current)
        cdAccelerationIntervalRef.current = null
      }
      if (cdDecelerationIntervalRef.current) {
        clearInterval(cdDecelerationIntervalRef.current)
        cdDecelerationIntervalRef.current = null
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
        timeUpdateIntervalRef.current = null
      }
      if (demoEngineRef.current) {
        demoEngineRef.current.pause()
        demoEngineRef.current.stop()
      }
      setCurrentTime(0)
      setDuration(0)
    }
  }, [selectedSong])

  const handlePlayPause = async () => {
    if (!demoEngineRef.current || !selectedSong?.demo_mp3 || !demoReady) {
      console.warn('Cannot play - engine not ready')
      return
    }
    
    try {
      if (isPlaying) {
        // Pause: stop audio and smoothly decelerate CD from current speed
        demoEngineRef.current.pause()
        setIsPlaying(false)
        
        // Clear any acceleration
        if (cdAccelerationTimeoutRef.current) {
          clearTimeout(cdAccelerationTimeoutRef.current)
          cdAccelerationTimeoutRef.current = null
        }
        if (cdAccelerationIntervalRef.current) {
          clearInterval(cdAccelerationIntervalRef.current)
          cdAccelerationIntervalRef.current = null
        }
        if (cdDecelerationIntervalRef.current) {
          clearInterval(cdDecelerationIntervalRef.current)
          cdDecelerationIntervalRef.current = null
        }
        
        // Start smooth deceleration from current speed
        setCdStopping(true)
        setCdJustStarted(false)
        
        // Gradually slow down the animation duration (increase it) over 3 seconds
        const currentDuration = cdSpinDuration
        const decelerationDuration = 3000 // 3 seconds to stop
        const interval = 16 // ~60fps
        let elapsed = 0
        
        cdDecelerationIntervalRef.current = setInterval(() => {
          elapsed += interval
          const progress = Math.min(elapsed / decelerationDuration, 1)
          const eased = 1 - Math.pow(1 - progress, 3) // ease-out for smooth deceleration
          
          // Gradually increase duration (slow down) - from current to very slow
          // Go from current speed to 10 seconds (almost stopped) over 3 seconds
          const targetDuration = 15 // Slower to ensure smooth stop
          const newDuration = currentDuration + (targetDuration - currentDuration) * eased
          setCdSpinDuration(newDuration)
          
          if (progress >= 1) {
            if (cdDecelerationIntervalRef.current) {
              clearInterval(cdDecelerationIntervalRef.current)
              cdDecelerationIntervalRef.current = null
            }
            
            // Capture final rotation and apply as static transform
            // Use requestAnimationFrame to get the exact current rotation
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (cdElementRef.current) {
                  const element = cdElementRef.current
                  const computedStyle = window.getComputedStyle(element)
                  const transform = computedStyle.transform
                  
                  if (transform && transform !== 'none') {
                    try {
                      // Extract rotation angle from matrix
                      const matrix = new DOMMatrix(transform)
                      const angleRad = Math.atan2(matrix.b, matrix.a)
                      let angleDeg = angleRad * (180 / Math.PI)
                      // Normalize to 0-360 range
                      if (angleDeg < 0) angleDeg += 360
                      
                      // Apply static transform directly to element to prevent reset
                      element.style.transform = `rotate(${angleDeg}deg)`
                      element.style.animation = 'none'
                      
                      // Update state to reflect this
                      setCdFinalRotation(angleDeg)
                      setCdStopping(false)
                      setCdSpinDuration(5)
                    } catch (e) {
                      console.error('Error capturing rotation:', e)
                      setCdStopping(false)
                      setCdSpinDuration(5)
                    }
                  } else {
                    setCdStopping(false)
                    setCdSpinDuration(5)
                  }
                } else {
                  setCdStopping(false)
                  setCdSpinDuration(5)
                }
              })
            })
          }
        }, interval)
        
        console.log('⏸️ Demo paused - CD decelerating smoothly')
      } else {
        // Play: restart acceleration from slow
        // On iOS: Start silent audio track FIRST (auto-unmute like stem player)
        if (isIOS && silentModeBypassRef.current) {
          const audio = silentModeBypassRef.current;
          
          // Recreate channel tag if destroyed
          if (audio.src === 'about:blank' || !audio.src) {
            const huffman = (count: number, repeatStr: string): string => {
              let e = repeatStr
              for (; count > 1; count--) e += repeatStr
              return e
            }
            const silence = "data:audio/mpeg;base64,//uQx" + huffman(23, "A") + "WGluZwAAAA8AAAACAAACcQCA" + huffman(16, "gICA") + huffman(66, "/") + "8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkI" + huffman(320, "A") + "//sQxAADgnABGiAAQBCqgCRMAAgEAH" + huffman(15, "/") + "7+n/9FTuQsQH//////2NG0jWUGlio5gLQTOtIoeR2WX////X4s9Atb/JRVCbBUpeRUq" + huffman(18, "/") + "9RUi0f2jn/+xDECgPCjAEQAABN4AAANIAAAAQVTEFNRTMuMTAw" + huffman(97, "V") + "Q=="
            audio.src = silence
            audio.load()
            await new Promise((resolve) => {
              if (audio.readyState >= 2) {
                resolve(undefined);
              } else {
                audio.addEventListener('canplay', () => resolve(undefined), { once: true });
              }
            });
          }
          
          // Ensure silent audio is at the start
          if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
          }
          
          try {
            await audio.play();
            audioUnlockedRef.current = true;
            setAudioUnlocked(true);
            console.log('🔊 Silent audio started (iOS media channel unlock)');
            await new Promise(resolve => setTimeout(resolve, 20));
          } catch (err: any) {
            console.warn('⚠️ Silent audio start failed:', err?.message || 'Unknown');
          }
        }
        
        // On iOS: Start silent audio track FIRST (auto-unmute like stem player)
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
              if (audio.readyState >= 2) {
                resolve(undefined);
              } else {
                audio.addEventListener('canplay', () => resolve(undefined), { once: true });
              }
            });
          }
          
          // Ensure silent audio is at the start
          if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
          }
          
          try {
            await audio.play();
            audioUnlockedRef.current = true;
            setAudioUnlocked(true);
            console.log('🔊 Silent audio started (iOS media channel unlock)');
            // Small delay to ensure silent audio is stable before demo starts
            await new Promise(resolve => setTimeout(resolve, 20));
          } catch (err: any) {
            console.warn('⚠️ Silent audio start failed:', err?.message || 'Unknown');
          }
        }
        
        await demoEngineRef.current.play()
        setIsPlaying(true)
        
        // Clear any stopping state and restart acceleration
        setCdStopping(false)
        setCdFinalRotation(null) // Clear final rotation when resuming
        // Clear any inline transform that might be set
        if (cdElementRef.current) {
          cdElementRef.current.style.transform = ''
          cdElementRef.current.style.animation = ''
        }
        
        // Clear any existing acceleration
        if (cdAccelerationTimeoutRef.current) {
          clearTimeout(cdAccelerationTimeoutRef.current)
        }
        if (cdAccelerationIntervalRef.current) {
          clearInterval(cdAccelerationIntervalRef.current)
        }
        
        // Start at slow speed
        setCdSpinDuration(5)
        setCdJustStarted(true)
        
        // Smoothly accelerate over 3 seconds
        let elapsed = 0
        const duration = 3000
        const interval = 16
        const startSpeed = 5
        const endSpeed = 0.3
        
          cdAccelerationIntervalRef.current = setInterval(() => {
            elapsed += interval
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
            const currentSpeed = startSpeed - (startSpeed - endSpeed) * eased
            
            // Ensure we never go below the target speed
            const clampedSpeed = Math.max(currentSpeed, endSpeed)
            setCdSpinDuration(clampedSpeed)
            
            if (progress >= 1) {
              if (cdAccelerationIntervalRef.current) {
                clearInterval(cdAccelerationIntervalRef.current)
                cdAccelerationIntervalRef.current = null
              }
              // Lock at exactly 0.3s - ensure no further changes
              setCdSpinDuration(0.3)
              // Keep cdJustStarted true - no state change to avoid animation restart
            }
          }, interval)
        
        console.log('▶️ Demo playing')
      }
    } catch (error) {
      console.error('❌ Playback error:', error)
      setIsPlaying(false)
    }
  }


  const handleExploreStems = (song: Song) => {
    router.push(`/artist/${song.artist_slug}/${song.song_slug}`)
  }

  // Update theme in database when changed
  const handleThemeChange = async (newTheme: 'TERMINAL THEME' | 'OLD COMPUTER') => {
    setPageTheme(newTheme)
    setShowPageThemeDropdown(false)
    
    // Update all songs in the album with the new theme
    // Try using album_id from songs first, then fall back to albumId from URL
    const targetAlbumId = songs.length > 0 && songs[0].album_id ? songs[0].album_id : albumId
    
    if (targetAlbumId && songs.length > 0) {
      try {
        // Update by album_id if available
        if (songs[0].album_id) {
          const { error } = await supabase
            .from('songs')
            .update({ page_theme: newTheme })
            .eq('album_id', songs[0].album_id)
          
          if (error) {
            console.error('Error updating theme:', error)
          } else {
            console.log('Theme updated successfully')
          }
        } else {
          // Fallback: update by song IDs if album_id is not available
          const songIds = songs.map(s => s.id)
          const { error } = await supabase
            .from('songs')
            .update({ page_theme: newTheme })
            .in('id', songIds)
          
          if (error) {
            console.error('Error updating theme:', error)
          } else {
            console.log('Theme updated successfully')
          }
        }
      } catch (err) {
        console.error('Error updating theme:', err)
      }
    }
  }
  
  useEffect(() => {
    return () => {
      if (demoEngineRef.current) {
        demoEngineRef.current.pause()
        demoEngineRef.current.stop()
      }
    }
  }, [])

  const generateCDColor = (index: number) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'
    ]
    return colors[index % colors.length]
  }

  if (loading) {
    return <PoolsuiteLoadingScreen />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: currentTheme.background, fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : 'inherit', color: currentTheme.text }}>
        <div className="text-center p-8" style={{ border: `2px solid ${currentTheme.border}`, boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none', backgroundColor: currentTheme.background, padding: '20px' }}>
          <h1 className="text-xl font-normal mb-4" style={{ color: currentTheme.accent, textShadow: pageTheme === 'TERMINAL THEME' ? `0 0 10px ${currentTheme.accent}80, 0 0 5px ${currentTheme.accent}50` : 'none' }}>ERROR</h1>
          <p style={{ color: currentTheme.text, marginTop: '10px', fontSize: '16px', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,255,255,0.5)' : 'none' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundColor: currentTheme.background,
        backgroundImage: pageTheme === 'OLD COMPUTER' ? `
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px),
          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px)
        ` : 'none',
        padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '12px 10px' : '40px 20px') : (isMobile ? '12px 10px' : '40px 20px'),
        fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit'),
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        paddingTop: pageTheme === 'OLD COMPUTER' ? `calc(${isMobile ? '12px' : '40px'} + env(safe-area-inset-top, 0px))` : `calc(${isMobile ? '12px' : '40px'} + env(safe-area-inset-top, 0px))`,
        paddingBottom: pageTheme === 'OLD COMPUTER' ? `calc(${isMobile ? '12px' : '40px'} + env(safe-area-inset-bottom, 0px))` : `calc(${isMobile ? '12px' : '40px'} + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: pageTheme === 'OLD COMPUTER' ? `calc(${isMobile ? '10px' : '20px'} + env(safe-area-inset-left, 0px))` : `calc(${isMobile ? '10px' : '20px'} + env(safe-area-inset-left, 0px))`,
        paddingRight: pageTheme === 'OLD COMPUTER' ? `calc(${isMobile ? '10px' : '20px'} + env(safe-area-inset-right, 0px))` : `calc(${isMobile ? '10px' : '20px'} + env(safe-area-inset-right, 0px))`,
        color: currentTheme.text,
        fontSize: isMobile ? '12px' : '16px',
        lineHeight: '1.4',
        textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 4px rgba(255,255,255,0.3)' : 'none'
      }}
    >
      <div className="max-w-4xl mx-auto relative z-10" style={{ position: 'relative', zIndex: 10 }}>
        {/* Retro Window - Playlist (OLD COMPUTER) / Terminal Style - Playlist (TERMINAL) */}
        <div 
          style={{
            backgroundColor: pageTheme === 'OLD COMPUTER' ? (currentTheme as any).cardBg || '#D4C5B9' : currentTheme.background,
            border: pageTheme === 'OLD COMPUTER' ? '3px solid #000000' : `3px solid ${currentTheme.border}`,
            boxShadow: pageTheme === 'OLD COMPUTER' ? 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none'),
            marginBottom: pageTheme === 'OLD COMPUTER' ? (isMobile ? '14px' : '20px') : (isMobile ? '14px' : '20px'),
            padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '6px' : '8px') : (isMobile ? '6px' : '8px'),
            position: 'relative',
            zIndex: 10
          }}
        >
          {/* Title Bar */}
          <div 
            style={{
              backgroundColor: pageTheme === 'OLD COMPUTER' ? (currentTheme as any).windowTitleBg || '#C0C0C0' : currentTheme.background,
              border: pageTheme === 'OLD COMPUTER' ? '2px solid #000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFB6C1' : `1px solid ${currentTheme.border}`),
              boxShadow: pageTheme === 'TERMINAL THEME' ? '0 2px 8px rgba(255,182,193,0.3)' : 'none',
              padding: pageTheme === 'OLD COMPUTER' ? '4px 8px' : '4px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: pageTheme === 'OLD COMPUTER' ? '4px' : '0',
              fontSize: isMobile ? '13px' : '15px',
              fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal',
              color: pageTheme === 'OLD COMPUTER' ? '#000000' : (pageTheme === 'TERMINAL THEME' ? currentTheme.text : currentTheme.text),
              fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'inherit' : 'inherit'),
              textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 6px rgba(255,255,255,0.4)' : 'none',
              position: 'relative'
            }}
          >
            <span>MIXTAPES</span>
            {!selectedSong && (
              <span className="flash-preview-text" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: isMobile ? '10px' : '12px', color: pageTheme === 'OLD COMPUTER' ? '#000000' : (pageTheme === 'TERMINAL THEME' ? '#999999' : '#999999') }}>
                {pageTheme === 'OLD COMPUTER' ? 'CLICK A TRACK TO PREVIEW' : 'SELECT A TRACK TO PREVIEW'}
              </span>
            )}
            <span>{date1983}</span>
          </div>

          {/* Content */}
          <div 
            style={{
              backgroundColor: pageTheme === 'OLD COMPUTER' ? (currentTheme as any).windowContentBg || '#FFFFFF' : currentTheme.background,
              border: pageTheme === 'OLD COMPUTER' ? '2px solid #000' : 'none',
              padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '12px' : '16px') : (isMobile ? '12px' : '16px'),
              maxHeight: pageTheme === 'OLD COMPUTER' ? (isMobile ? '45vh' : '400px') : (isMobile ? '45vh' : '400px'),
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              zIndex: 20,
              touchAction: 'pan-y',
              color: pageTheme === 'OLD COMPUTER' ? '#000000' : currentTheme.text
            }}
          >
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                gap: isMobile ? '8px' : '8px'
              }}
            >
              {songs.map((song, index) => {
                const cdColor = generateCDColor(index)
                const trackNum = song.track_number || index + 1
                
                return (
                  <div
                    key={song.id}
                    onClick={() => handleSongClick(song)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobile ? '8px' : '8px',
                      padding: isMobile ? '6px' : '8px',
                      cursor: 'pointer',
                      backgroundColor: pageTheme === 'OLD COMPUTER' ? (selectedSong?.id === song.id ? '#E0E0E0' : 'transparent') : (selectedSong?.id === song.id ? currentTheme.sectionBg : 'transparent'),
                      ...(pageTheme === 'OLD COMPUTER' ? {
                        border: selectedSong?.id === song.id ? '2px solid #000' : '2px solid transparent',
                        borderTop: 'none',
                        borderRight: 'none',
                        borderBottom: 'none',
                        borderLeft: 'none'
                      } : {
                        border: 'none',
                        borderLeft: selectedSong?.id === song.id ? `3px solid ${currentTheme.border}` : '1px solid transparent'
                      }),
                      transition: pageTheme === 'OLD COMPUTER' ? 'all 0.2s' : 'all 0.15s',
                      position: 'relative',
                      zIndex: 30,
                      pointerEvents: 'auto',
                      color: pageTheme === 'OLD COMPUTER' ? '#000000' : (selectedSong?.id === song.id ? (pageTheme === 'TERMINAL THEME' ? currentTheme.text : currentTheme.text) : (pageTheme === 'TERMINAL THEME' ? '#CCCCCC' : '#666666')),
                      textShadow: selectedSong?.id === song.id && pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,255,255,0.5), 0 0 4px rgba(255,255,255,0.4)' : (pageTheme === 'TERMINAL THEME' ? '0 0 4px rgba(255,255,255,0.2)' : 'none')
                    }}
                    onMouseEnter={(e) => {
                      if (selectedSong?.id !== song.id) {
                        if (pageTheme === 'OLD COMPUTER') {
                          e.currentTarget.style.backgroundColor = '#F0F0F0'
                        } else {
                          e.currentTarget.style.backgroundColor = currentTheme.sectionBg
                          e.currentTarget.style.color = currentTheme.text
                          e.currentTarget.style.borderLeft = `2px solid ${currentTheme.border}`
                          e.currentTarget.style.boxShadow = pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,255,255,0.3)' : 'none'
                          e.currentTarget.style.textShadow = pageTheme === 'TERMINAL THEME' ? '0 0 6px rgba(255,255,255,0.4)' : 'none'
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSong?.id !== song.id) {
                        if (pageTheme === 'OLD COMPUTER') {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        } else {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = pageTheme === 'TERMINAL THEME' ? '#CCCCCC' : '#666666'
                          e.currentTarget.style.borderLeft = '1px solid transparent'
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.textShadow = pageTheme === 'TERMINAL THEME' ? '0 0 4px rgba(255,255,255,0.2)' : 'none'
                        }
                      }
                    }}
                  >
                    {/* CD Icon with Artwork */}
                    <div
                      className={selectedSong?.id === song.id && !demoReady && song.demo_mp3 ? 'vinyl-loading-flash' : ''}
                      style={{
                        width: isMobile ? '40px' : '40px',
                        height: isMobile ? '40px' : '40px',
                        borderRadius: '50%',
                        background: song.artwork_url && song.artwork_url.trim()
                          ? 'transparent'
                          : `radial-gradient(circle, ${cdColor} 30%, ${cdColor}dd 60%, #333 65%, #333 100%)`,
                        border: isMobile ? `2px solid ${currentTheme.border}` : `2.5px solid ${currentTheme.border}`,
                        flexShrink: 0,
                        position: 'relative',
                        boxShadow: pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,255,255,0.4)' : 'none',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Artwork Image */}
                      {song.artwork_url && song.artwork_url.trim() && (
                        <Image
                          src={song.artwork_url}
                          alt={song.title}
                          fill
                          sizes="40px"
                          unoptimized={isDev}
                          style={{
                            objectFit: 'cover',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zIndex: 0
                          }}
                          className="rounded-full"
                          quality={70}
                          loading="lazy"
                          onError={(e) => {
                            console.warn('⚠️ Artwork failed to load for', song.title, 'URL:', song.artwork_url)
                            const target = e.currentTarget as HTMLImageElement
                            target.style.display = 'none'
                          }}
                          onLoad={() => {
                            console.log('✅ Artwork loaded:', song.title)
                          }}
                        />
                      )}
                      {/* Center Hole */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: isMobile ? '8px' : '12px',
                          height: isMobile ? '8px' : '12px',
                          borderRadius: '50%',
                          backgroundColor: '#000000',
                          border: 'none',
                          boxShadow: 'inset 0 0 5px rgba(0,0,0,0.8)',
                          zIndex: 2
                        }}
                      />
                    </div>
                    
                    {/* Track Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: isMobile ? '10px' : '14px', fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal', color: pageTheme === 'OLD COMPUTER' ? '#000000' : (selectedSong?.id === song.id ? '#FFFFFF' : '#CCCCCC'), lineHeight: '1.2', fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'inherit' : 'inherit'), textShadow: pageTheme === 'TERMINAL THEME' ? (selectedSong?.id === song.id ? '0 0 8px rgba(255,255,255,0.5)' : '0 0 4px rgba(255,255,255,0.2)') : 'none' }}>
                        {String(trackNum).padStart(2, '0')}-{song.title.replace(/\s+/g, '')}.mp3
                      </div>
                      <div style={{ fontSize: isMobile ? '9px' : '13px', color: pageTheme === 'OLD COMPUTER' ? '#666' : '#999999', lineHeight: '1.2', fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'inherit' : 'inherit'), textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 3px rgba(255,255,255,0.15)' : 'none' }}>
                        {song.bpm ? `${Math.round(song.bpm)} BPM` : (pageTheme === 'OLD COMPUTER' ? 'Unknown duration' : 'Unknown')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Retro Window - Player (OLD COMPUTER) / Terminal Style - Player (TERMINAL) */}
        <div 
          style={{
            backgroundColor: pageTheme === 'OLD COMPUTER' ? (currentTheme as any).cardBg || '#D4C5B9' : currentTheme.background,
            border: pageTheme === 'OLD COMPUTER' ? '3px solid #000000' : `3px solid ${currentTheme.border}`,
            boxShadow: pageTheme === 'OLD COMPUTER' ? 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none'),
            padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '4px' : '8px') : (isMobile ? '4px' : '8px'),
            position: 'relative',
            overflow: 'visible',
            zIndex: 10
          }}
        >
          {/* Title Bar */}
          <div 
            style={{
              backgroundColor: pageTheme === 'OLD COMPUTER' ? (currentTheme as any).windowTitleBg || '#C0C0C0' : currentTheme.background,
              border: pageTheme === 'OLD COMPUTER' ? '2px solid #000' : (pageTheme === 'TERMINAL THEME' ? '1px solid #FFB6C1' : `1px solid ${currentTheme.border}`),
              boxShadow: pageTheme === 'TERMINAL THEME' ? '0 2px 8px rgba(255,182,193,0.3)' : 'none',
              padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '3px 6px' : '4px 8px') : (isMobile ? '3px 6px' : '4px 8px'),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: pageTheme === 'OLD COMPUTER' ? (isMobile ? '2px' : '4px') : '0',
              fontSize: isMobile ? '11px' : '15px',
              fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal',
              color: pageTheme === 'OLD COMPUTER' ? '#000000' : currentTheme.text,
              fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'inherit' : 'inherit'),
              textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 6px rgba(255,255,255,0.4)' : 'none'
            }}
          >
            <span>PLAYER</span>
          </div>

          {/* Content */}
          <div 
            style={{
              backgroundColor: pageTheme === 'OLD COMPUTER' ? (currentTheme as any).playerBg || '#808080' : currentTheme.background,
              border: pageTheme === 'OLD COMPUTER' ? '2px solid #000' : 'none',
              padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '10px' : '20px') : (isMobile ? '10px' : '20px'),
              position: 'relative',
              minHeight: pageTheme === 'OLD COMPUTER' ? (isMobile ? '160px' : '200px') : (isMobile ? '160px' : '200px'),
              zIndex: 20,
              color: pageTheme === 'OLD COMPUTER' ? '#FFF' : currentTheme.text,
              fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'inherit' : 'inherit')
            }}
          >
            {/* Album Info */}
            <div style={{ marginBottom: pageTheme === 'OLD COMPUTER' ? (isMobile ? '8px' : '16px') : (isMobile ? '8px' : '16px'), color: pageTheme === 'OLD COMPUTER' ? '#FFF' : '#FFFFFF' }}>
              <div style={{ fontSize: isMobile ? '10px' : '15px', fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal', marginBottom: pageTheme === 'OLD COMPUTER' ? (isMobile ? '2px' : '4px') : (isMobile ? '2px' : '3px'), color: pageTheme === 'OLD COMPUTER' ? '#FFF' : '#FFB6C1', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,182,193,0.6), 0 0 4px rgba(255,182,193,0.4)' : 'none' }}>
                Mixed by {artistName.toUpperCase()}
              </div>
              <div style={{ fontSize: pageTheme === 'OLD COMPUTER' ? (isMobile ? '11px' : '14px') : (isMobile ? '11px' : '16px'), marginBottom: pageTheme === 'OLD COMPUTER' ? (isMobile ? '2px' : '4px') : '0', color: pageTheme === 'OLD COMPUTER' ? '#FFF' : '#FFFFFF', fontWeight: 'normal', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 6px rgba(255,255,255,0.4)' : 'none' }}>
                {albumTitle}
              </div>
            </div>

            {/* Current Track Info */}
            {selectedSong ? (
              <>
                <div 
                  style={{
                    backgroundColor: pageTheme === 'OLD COMPUTER' ? '#000' : currentTheme.background,
                    border: pageTheme === 'OLD COMPUTER' ? 'none' : `2px solid ${currentTheme.border}`,
                    boxShadow: pageTheme === 'TERMINAL THEME' ? '0 0 10px rgba(255,255,255,0.3), inset 0 0 8px rgba(255,255,255,0.1)' : 'none',
                    color: pageTheme === 'OLD COMPUTER' ? '#FFF' : currentTheme.text,
                    padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '8px' : '12px') : (isMobile ? '8px' : '12px'),
                    marginBottom: pageTheme === 'OLD COMPUTER' ? (isMobile ? '8px' : '16px') : (isMobile ? '8px' : '16px'),
                    fontSize: isMobile ? '10px' : '15px',
                    fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit')
                  }}
                >
                  <div style={{ fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal', marginBottom: pageTheme === 'OLD COMPUTER' ? (isMobile ? '2px' : '4px') : (isMobile ? '3px' : '6px'), color: '#FFFFFF', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,255,255,0.5)' : 'none', fontSize: isMobile ? '10px' : '15px' }}>
                    {String(selectedSong.track_number || songs.indexOf(selectedSong) + 1).padStart(2, '0')}-{selectedSong.title.replace(/\s+/g, '')}.mp3
                  </div>
                  <div style={{ color: '#CCCCCC', marginBottom: '3px', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 4px rgba(255,255,255,0.3)' : 'none', fontSize: isMobile ? '9px' : '15px' }}>Audio file</div>
                  {selectedSong.demo_mp3 ? (
                    <>
                      <div style={{ color: '#CCCCCC', marginBottom: '3px', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 4px rgba(255,255,255,0.3)' : 'none', fontSize: isMobile ? '9px' : 'inherit' }}>
                        Duration: {duration > 0 ? formatTime(Math.max(0, duration - currentTime)) : formatTime(duration)}
                      </div>
                      <div style={{ color: '#CCCCCC', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 4px rgba(255,255,255,0.3)' : 'none', fontSize: isMobile ? '9px' : 'inherit' }}>Format: 22KHz 8 Bit - Stereo</div>
                    </>
                  ) : (
                    <>
                      <div style={{ color: '#CCCCCC', marginBottom: '3px', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 4px rgba(255,255,255,0.3)' : 'none' }}>Duration: --:--</div>
                      <div style={{ fontSize: isMobile ? '9px' : '14px', color: pageTheme === 'OLD COMPUTER' ? '#FF6B9D' : '#FFB6C1', marginTop: '4px', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,182,193,0.6), 0 0 4px rgba(255,182,193,0.4)' : 'none' }}>{pageTheme === 'OLD COMPUTER' ? 'No demo available - click EXPLORE STEMS to mix' : '[!] No demo - run EXPLORE_STEMS'}</div>
                    </>
                  )}
                </div>

                {/* Demo audio played via RealTimelineMixerEngine (Superpowered) - same as stem player */}

                {/* Player Controls */}
                <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px', alignItems: 'center', marginBottom: isMobile ? '8px' : '14px' }}>
                  <button
                    onClick={handlePlayPause}
                    disabled={!selectedSong?.demo_mp3 || !demoReady}
                    style={{
                      width: pageTheme === 'OLD COMPUTER' ? (isMobile ? '24px' : '32px') : (isMobile ? '24px' : '32px'),
                      height: pageTheme === 'OLD COMPUTER' ? (isMobile ? '24px' : '32px') : (isMobile ? '24px' : '32px'),
                      backgroundColor: pageTheme === 'OLD COMPUTER' ? ((selectedSong?.demo_mp3 && demoReady) ? '#D4C5B9' : '#999') : ((selectedSong?.demo_mp3 && demoReady) ? '#000000' : '#0A0A0A'),
                      border: pageTheme === 'OLD COMPUTER' ? '2px solid #000' : `2px solid ${currentTheme.border}`,
                      boxShadow: pageTheme === 'OLD COMPUTER' ? ((selectedSong?.demo_mp3 && demoReady) ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none') : (pageTheme === 'TERMINAL THEME' ? ((selectedSong?.demo_mp3 && demoReady) ? '0 0 10px rgba(255,255,255,0.5), inset 0 0 8px rgba(255,255,255,0.2)' : '0 0 6px rgba(255,255,255,0.2)') : 'none'),
                      cursor: (selectedSong?.demo_mp3 && demoReady) ? 'pointer' : 'not-allowed',
                      opacity: pageTheme === 'OLD COMPUTER' ? ((selectedSong?.demo_mp3 && demoReady) ? 1 : 0.5) : ((selectedSong?.demo_mp3 && demoReady) ? 1 : 0.4),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      zIndex: 30,
                      pointerEvents: 'auto',
                      color: '#FFFFFF'
                    }}
                  >
                    {isPlaying ? (
                      pageTheme === 'OLD COMPUTER' ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="3" y="2" width="2" height="8" fill="#000"/>
                          <rect x="7" y="2" width="2" height="8" fill="#000"/>
                        </svg>
                      ) : (
                        <span style={{ color: '#FFFFFF', fontSize: isMobile ? '12px' : '14px', fontFamily: 'monospace', textShadow: '0 0 10px rgba(255,255,255,0.7), 0 0 5px rgba(255,255,255,0.5)' }}>||</span>
                      )
                    ) : (
                      pageTheme === 'OLD COMPUTER' ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 2L10 6L3 10V2Z" fill="#000"/>
                        </svg>
                      ) : (
                        <span style={{ color: '#FFFFFF', fontSize: isMobile ? '12px' : '14px', fontFamily: 'monospace', textShadow: '0 0 10px rgba(255,255,255,0.7), 0 0 5px rgba(255,255,255,0.5)' }}>▶</span>
                      )
                    )}
                  </button>
                </div>

                {/* Explore Stems Button */}
                <button
                  onClick={() => handleExploreStems(selectedSong)}
                  style={{
                    width: '100%',
                    padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '6px 10px' : '8px 16px') : (isMobile ? '6px 10px' : '8px 16px'),
                    backgroundColor: pageTheme === 'OLD COMPUTER' ? '#E8D9CD' : currentTheme.background,
                    border: pageTheme === 'OLD COMPUTER' ? '2px solid #000' : `2px solid ${currentTheme.border}`,
                    boxShadow: pageTheme === 'OLD COMPUTER' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : (pageTheme === 'TERMINAL THEME' ? '0 0 10px rgba(255,255,255,0.4)' : 'none'),
                    cursor: 'pointer',
                    fontSize: isMobile ? '10px' : '15px',
                    fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal',
                    fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit'),
                    transition: pageTheme === 'OLD COMPUTER' ? 'all 0.2s' : 'all 0.15s',
                    position: 'relative',
                    zIndex: 30,
                    pointerEvents: 'auto',
                    color: pageTheme === 'OLD COMPUTER' ? '#000' : currentTheme.text,
                    textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,255,255,0.5)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (pageTheme === 'OLD COMPUTER') {
                      e.currentTarget.style.backgroundColor = '#E8D9CD'
                    } else {
                      e.currentTarget.style.backgroundColor = '#0A0A0A'
                      e.currentTarget.style.borderColor = '#FFB6C1'
                      e.currentTarget.style.boxShadow = '0 0 15px rgba(255,182,193,0.6), 0 0 8px rgba(255,182,193,0.4)'
                      e.currentTarget.style.textShadow = '0 0 10px rgba(255,255,255,0.7), 0 0 5px rgba(255,182,193,0.5)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (pageTheme === 'OLD COMPUTER') {
                      e.currentTarget.style.backgroundColor = '#E8D9CD'
                    } else {
                      e.currentTarget.style.backgroundColor = '#000000'
                      e.currentTarget.style.borderColor = '#FFFFFF'
                      e.currentTarget.style.boxShadow = '0 0 10px rgba(255,255,255,0.4)'
                      e.currentTarget.style.textShadow = '0 0 8px rgba(255,255,255,0.5)'
                    }
                  }}
                >
                  EXPLORE_STEMS
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '10px' : '20px') : (isMobile ? '10px' : '20px'), fontSize: isMobile ? '10px' : '15px', fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'inherit' : 'inherit'), color: 'transparent' }}>
                {/* Preview text moved to MIXTAPES title bar */}
              </div>
            )}
          </div>
        </div>

        {/* CD/Record Player Visual - Always visible */}
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? '-50px' : '-80px',
            right: isMobile ? '-40px' : '-60px',
            width: isMobile ? '180px' : '360px',
            height: isMobile ? '180px' : '360px',
            zIndex: 15,
            transition: 'all 0.3s ease',
            pointerEvents: 'none'
          }}
        >
          {/* CD/Vinyl - Empty by default, filled when song selected */}
          <div
            ref={cdElementRef}
            className={selectedSong && (isPlaying || cdStopping)
              ? 'cd-spin-accelerating'
              : ''
            }
            style={{
              ...((isPlaying || cdStopping) ? { animationDuration: `${cdSpinDuration}s` } : {}),
              ...(cdFinalRotation !== null && !isPlaying && !cdStopping ? { 
                transform: `rotate(${cdFinalRotation}deg)`,
                transition: 'none'
              } : {}),
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: selectedSong
                ? (selectedSong.artwork_url && selectedSong.artwork_url.trim()
                    ? 'transparent'
                    : (selectedSong.primary_color || selectedSong.color 
                        ? `radial-gradient(circle, ${selectedSong.primary_color || selectedSong.color} 30%, ${selectedSong.primary_color || selectedSong.color}dd 60%, #333 65%, #333 100%)`
                        : `radial-gradient(circle, ${generateCDColor(songs.indexOf(selectedSong))} 30%, ${generateCDColor(songs.indexOf(selectedSong))}dd 60%, #333 65%, #333 100%)`))
                : (pageTheme === 'OLD COMPUTER' ? '#FFF8E7' : '#000000'), // Cream for OLD COMPUTER, Black for TERMINAL THEME
              border: pageTheme === 'OLD COMPUTER' ? '2px solid #000000' : '2px solid #FFFFFF',
              boxShadow: 'none',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* SVG Mask for artwork (hides center label area) */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <radialGradient id="artworkMask">
                  <stop offset="0%" stopColor="black" stopOpacity="0" />
                  <stop offset="28%" stopColor="black" stopOpacity="0" />
                  <stop offset="30%" stopColor="black" stopOpacity="1" />
                  <stop offset="100%" stopColor="black" stopOpacity="1" />
                </radialGradient>
                <mask id="vinylArtworkMask">
                  <rect width="100%" height="100%" fill="url(#artworkMask)" />
                </mask>
              </defs>
            </svg>
            
            {/* Artwork Image - only shows on outer ring, not center */}
            {selectedSong && selectedSong.artwork_url && selectedSong.artwork_url.trim() && (
              <Image
                src={selectedSong.artwork_url}
                alt={selectedSong.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
                  console.warn('⚠️ Artwork failed to load for', selectedSong.title, 'URL:', selectedSong.artwork_url)
                  const target = e.currentTarget as HTMLImageElement
                  target.style.display = 'none'
                }}
                onLoad={() => {
                  console.log('✅ Artwork loaded:', selectedSong.title)
                }}
              />
            )}
            {/* Overlay for artwork to add depth */}
            {selectedSong && selectedSong.artwork_url && selectedSong.artwork_url.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  boxShadow: 'none',
                  pointerEvents: 'none',
                  zIndex: 1
                }}
              />
            )}
            {/* CD Center Hole - Black hole only */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: selectedSong ? '20px' : '18px',
                height: selectedSong ? '20px' : '18px',
                borderRadius: '50%',
                backgroundColor: '#000000',
                border: 'none',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
                zIndex: 3
              }}
            />
            
            {/* 80s Square Grid Pattern - Pink glow on black vinyl area - Only show when no artwork and TERMINAL THEME */}
            {pageTheme !== 'OLD COMPUTER' && (!selectedSong || !selectedSong.artwork_url || !selectedSong.artwork_url.trim()) && (
              <svg
                width="100%"
                height="100%"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: 1,
                  pointerEvents: 'none',
                  overflow: 'visible'
                }}
                viewBox="0 0 180 180"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  {/* Square grid pattern */}
                  <pattern id="gridPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                    <rect width="8" height="8" fill="none"/>
                    <path d="M 0 0 L 8 0 M 0 0 L 0 8" stroke="#FF69B4" strokeWidth="0.3" opacity="0.6"/>
                  </pattern>
                  {/* Pink glow filter */}
                  <filter id="pinkGlow">
                    <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  {/* Mask to only show grid on outer black area (outside inner label) */}
                  <mask id="vinylAreaMask">
                    <circle cx="90" cy="90" r="90" fill="white"/>
                    <circle cx="90" cy="90" r="36" fill="black"/>
                  </mask>
                </defs>
                
                {/* Grid pattern circle - masked to only show on outer black area */}
                <circle
                  cx="90"
                  cy="90"
                  r="90"
                  fill="url(#gridPattern)"
                  mask="url(#vinylAreaMask)"
                  filter="url(#pinkGlow)"
                  opacity="0.8"
                />
              </svg>
            )}
            
            
            {/* Vinyl/CD Label SVG - Always show (even when no song selected) */}
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
                {/* Halftone dots pattern - same for both themes - 1.5x more dots, bolder black */}
                <pattern id="halftoneDots" x="0" y="0" width="1.67" height="1.67" patternUnits="userSpaceOnUse">
                  <circle cx="0.835" cy="0.835" r="0.35" fill="#000000" stroke="#000000" strokeWidth="0.1"/>
                </pattern>
                {/* Mask to exclude inner circle from halftone and create gap before final border */}
                <mask id="halftoneMask">
                  <circle cx="90" cy="90" r="34.5" fill="white"/>
                  <circle cx="90" cy="90" r="12" fill="black"/>
                </mask>
              </defs>
              
              {/* Label circle base - cream for OLD COMPUTER, white for TERMINAL THEME */}
              <circle
                cx="90"
                cy="90"
                r="36"
                fill={pageTheme === 'OLD COMPUTER' ? '#FFF8E7' : '#FFFFFF'}
                opacity="1"
              />
              
              {/* Halftone dots overlay - covers ring area, not inner circle - for both themes */}
              <circle
                cx="90"
                cy="90"
                r="36"
                fill="url(#halftoneDots)"
                mask="url(#halftoneMask)"
              />
              
              {/* Thin black border before final border - creates gap that cuts off dots */}
              <circle
                cx="90"
                cy="90"
                r="34.5"
                fill="none"
                stroke="#000000"
                strokeWidth="0.5"
                opacity="1"
              />
              
              {/* Final border at outer edge of inner label (meets vinyl/pink grid) - white for TERMINAL, black for OLD COMPUTER */}
              <circle
                cx="90"
                cy="90"
                r="36"
                fill="none"
                stroke={pageTheme === 'OLD COMPUTER' ? '#000000' : '#FFFFFF'}
                strokeWidth="0.8"
                opacity="1"
              />
              
              {/* Thin ring/border around middle (around center hole, about 12px radius) - keep black for both */}
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
        </div>
      </div>

      {/* Theme Selector - Bottom Center - Absolute Bottom */}
      <div style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        paddingBottom: isMobile ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : 'calc(2rem + env(safe-area-inset-bottom, 0px))',
        paddingTop: isMobile ? '1rem' : '2rem',
        zIndex: 20,
        pointerEvents: 'none'
      }} data-dropdown>
        <div style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={() => setShowPageThemeDropdown(!showPageThemeDropdown)}
            style={{
              padding: pageTheme === 'OLD COMPUTER' ? (isMobile ? '6px 12px' : '8px 16px') : (isMobile ? '6px 12px' : '8px 16px'),
              backgroundColor: pageTheme === 'OLD COMPUTER' ? (currentTheme as any).buttonBg || '#D4C5B9' : currentTheme.buttonBg,
              color: pageTheme === 'OLD COMPUTER' ? '#000000' : currentTheme.buttonText,
              border: pageTheme === 'OLD COMPUTER' ? '2px solid #000000' : `2px solid ${currentTheme.border}`,
              cursor: 'pointer',
              fontSize: isMobile ? '11px' : '15px',
              fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal',
              boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : (pageTheme === 'OLD COMPUTER' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'),
              fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit'),
              textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,255,255,0.5)' : 'none'
            }}
          >
            THEME: {pageTheme} ▼
          </button>
          {showPageThemeDropdown && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              backgroundColor: pageTheme === 'OLD COMPUTER' ? (currentTheme as any).cardBg || '#D4C5B9' : currentTheme.cardBg,
              border: pageTheme === 'OLD COMPUTER' ? '2px solid #000000' : `2px solid ${currentTheme.border}`,
              borderRadius: pageTheme === 'OLD COMPUTER' ? '0' : '4px',
              boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : (pageTheme === 'OLD COMPUTER' ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none'),
              zIndex: 1000,
              minWidth: isMobile ? '180px' : '220px'
            }}>
              {(['TERMINAL THEME', 'OLD COMPUTER'] as const).map(themeOption => (
                <div
                  key={themeOption}
                  onClick={() => handleThemeChange(themeOption)}
                  style={{
                    padding: isMobile ? '8px 12px' : '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: pageTheme === themeOption 
                      ? (pageTheme === 'TERMINAL THEME' ? '#1A1A1A' : (pageTheme === 'OLD COMPUTER' ? '#E0E0E0' : '#f3f3f3'))
                      : (pageTheme === 'OLD COMPUTER' ? (currentTheme as any).cardBg || '#D4C5B9' : currentTheme.cardBg),
                    color: pageTheme === 'OLD COMPUTER' ? '#000000' : currentTheme.text,
                    borderBottom: themeOption !== 'OLD COMPUTER' ? `1px solid ${pageTheme === 'OLD COMPUTER' ? '#000000' : currentTheme.border}` : 'none',
                    fontFamily: pageTheme === 'TERMINAL THEME' ? '"Courier New", "Courier", monospace' : (pageTheme === 'OLD COMPUTER' ? 'monospace' : 'inherit'),
                    fontSize: isMobile ? '11px' : '15px',
                    fontWeight: pageTheme === 'OLD COMPUTER' ? 'bold' : 'normal',
                    textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 6px rgba(255,255,255,0.4)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (pageTheme === 'OLD COMPUTER') {
                      e.currentTarget.style.backgroundColor = '#F0F0F0'
                    } else {
                      e.currentTarget.style.backgroundColor = '#1A1A1A'
                      e.currentTarget.style.textShadow = '0 0 8px rgba(255,255,255,0.5)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    const isSelected = pageTheme === themeOption
                    if (pageTheme === 'OLD COMPUTER') {
                      e.currentTarget.style.backgroundColor = isSelected ? '#E0E0E0' : (currentTheme as any).cardBg || '#D4C5B9'
                    } else {
                      e.currentTarget.style.backgroundColor = isSelected ? '#1A1A1A' : currentTheme.cardBg
                      e.currentTarget.style.textShadow = isSelected ? '0 0 6px rgba(255,255,255,0.4)' : 'none'
                    }
                  }}
                >
                  {themeOption}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes cdRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes cdAccelerate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        
        @keyframes cdSlowdown {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(1080deg);
          }
        }
        
        .cd-spin {
          animation: cdRotate 10s linear infinite;
        }
        
        .cd-spin-accelerating {
          animation: cdRotate linear infinite;
          animation-play-state: running;
        }
        
        .cd-spin-paused {
          animation-play-state: paused !important;
        }
        
        .cd-spin-fast {
          animation: cdRotate 0.3s linear infinite;
        }
        
        .cd-spin-slowdown {
          animation: cdSlowdown 3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        @keyframes flashPreview {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        
        .flash-preview-text {
          animation: flashPreview 2s ease-in-out infinite;
        }
        
        @keyframes vinylFlash {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
            filter: brightness(1.3);
          }
        }
        
        .vinyl-loading-flash {
          animation: vinylFlash 0.5s ease-in-out infinite !important;
          will-change: opacity, transform, filter;
        }
      `}</style>
    </div>
  )
}
