'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import PoolsuiteLoadingScreen from '../../components/PoolsuiteLoadingScreen'
import RealTimelineMixerEngine from '../../../audio/engine/realTimelineMixerEngine'

type Song = {
  id: string
  title: string
  artist_name: string
  artist_slug: string
  song_slug: string
  bpm: number | null
  track_number: number
  album_title: string
  primary_color?: string
  color: string
  demo_mp3?: string | null
  artwork_url?: string | null
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
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [demoReady, setDemoReady] = useState(false)
  const [cdJustStarted, setCdJustStarted] = useState(false)
  const [cdStopping, setCdStopping] = useState(false)
  const [cdSpinDuration, setCdSpinDuration] = useState(5)
  const [cdFinalRotation, setCdFinalRotation] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
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
  
  // Detect iOS (same as stem player)
  const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)

  // ==================== 🎨 Set Pink Theme Color for Album Page ====================
  useEffect(() => {
    // Set pink theme-color for iOS status bar on album page
    let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.name = 'theme-color'
      document.head.appendChild(themeColorMeta)
    }
    const originalColor = themeColorMeta.content
    themeColorMeta.content = '#FFE5E5' // Pink for album page
    
    // Cleanup: restore cream color when component unmounts
    return () => {
      if (themeColorMeta) {
        themeColorMeta.content = '#FCFAEE' // Restore cream
      }
    }
  }, [])

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

        // Get current user first to ensure we're authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          setError('You must be logged in to view this album.')
          setLoading(false)
          return
        }

        // Priority 1: Use song IDs from URL if available (most reliable)
        let data: any[] | null = null
        let queryErrors: string[] = []
        
        if (songIdsParam) {
          const songIds = songIdsParam.split(',').filter(Boolean)
          console.log('🎵 Querying songs by IDs from URL:', songIds)
          
          const { data: idsData, error: idsError } = await supabase
            .from('songs')
            .select('id, title, artist_name, artist_slug, song_slug, bpm, track_number, album_id, album_title, album_slug, primary_color, color, demo_mp3, artwork_url, created_at')
            .in('id', songIds)
            .eq('user_id', user.id) // Only get songs belonging to the user
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
              for (const songId of songIds) {
                // First try without user filter to see if song exists at all
                const { data: songWithoutFilter, error: noFilterError } = await supabase
                  .from('songs')
                  .select('id, title, album_id, user_id')
                  .eq('id', songId)
                  .single()
                console.log(`  Checking song ${songId} WITHOUT user filter:`, { 
                  exists: !!songWithoutFilter, 
                  error: noFilterError?.message,
                  songUserId: songWithoutFilter?.user_id,
                  currentUserId: user.id,
                  matches: songWithoutFilter?.user_id === user.id
                })
                
                // Then try with user filter
                const { data: singleSong, error: singleError } = await supabase
                  .from('songs')
                  .select('id, title, album_id, user_id')
                  .eq('id', songId)
                  .eq('user_id', user.id)
                  .single()
                console.log(`  Checking song ${songId} WITH user filter:`, { exists: !!singleSong, error: singleError?.message })
              }
            }
          }
        }
        
        // Priority 2: Try querying by album_id (albumId is the UUID)
        if (!data || data.length === 0) {
          console.log('🎵 Trying to query by album_id:', albumId)
          const { data: albumIdData, error: albumIdError } = await supabase
            .from('songs')
            .select('id, title, artist_name, artist_slug, song_slug, bpm, track_number, album_id, album_title, album_slug, primary_color, color, demo_mp3, artwork_url, created_at')
            .eq('album_id', albumId)
            .eq('user_id', user.id) // Only get songs belonging to the user
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
            .select('id, title, artist_name, artist_slug, song_slug, bpm, track_number, album_id, album_title, album_slug, primary_color, color, demo_mp3, artwork_url, created_at')
            .eq('album_slug', albumId)
            .eq('user_id', user.id) // Only get songs belonging to the user
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
            .select('id, title, artist_name, artist_slug, song_slug, bpm, track_number, album_id, album_title, album_slug, primary_color, color, demo_mp3, artwork_url, created_at')
            .eq('user_id', user.id) // Only get songs belonging to the user
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
        
        // Load the demo as a single "stem" - SAME AS STEM PLAYER
        const demoStemData = [{
          name: 'Demo',
          url: selectedSong.demo_mp3, // Already full Supabase URL
          label: 'Demo'
        }]
        
        await demoEngineRef.current.loadStemsFromSupabase(demoStemData)
        
        setDemoReady(true)
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
      if (demoEngineRef.current) {
        demoEngineRef.current.pause()
        demoEngineRef.current.stop()
      }
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFE5E5' }}>
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4" style={{ color: '#B8001F' }}>Error</h1>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundColor: '#FFE5E5',
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px),
          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px)
        `,
        padding: isMobile ? '20px 10px' : '40px 20px',
        fontFamily: 'monospace',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        paddingTop: `calc(${isMobile ? '20px' : '40px'} + env(safe-area-inset-top, 0px))`,
        paddingBottom: `calc(${isMobile ? '20px' : '40px'} + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: `calc(${isMobile ? '10px' : '20px'} + env(safe-area-inset-left, 0px))`,
        paddingRight: `calc(${isMobile ? '10px' : '20px'} + env(safe-area-inset-right, 0px))`
      }}
    >
      <div className="max-w-4xl mx-auto relative z-10" style={{ position: 'relative', zIndex: 10 }}>
        {/* Retro Window - Playlist */}
        <div 
          style={{
            backgroundColor: '#D4C5B9',
            border: '3px solid',
            borderColor: '#000000',
            boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
            marginBottom: '20px',
            padding: '8px',
            position: 'relative',
            zIndex: 10
          }}
        >
          {/* Window Title Bar */}
          <div 
            style={{
              backgroundColor: '#C0C0C0',
              border: '2px solid #000',
              padding: '4px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            <span>MIXTAPES</span>
          </div>

          {/* Playlist Content */}
          <div 
            style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid #000',
              padding: isMobile ? '12px' : '16px',
              maxHeight: isMobile ? '60vh' : '400px',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              zIndex: 20,
              touchAction: 'pan-y'
            }}
          >
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                gap: isMobile ? '8px' : '12px'
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
                      gap: '8px',
                      padding: '8px',
                      cursor: 'pointer',
                      backgroundColor: selectedSong?.id === song.id ? '#E0E0E0' : 'transparent',
                      border: selectedSong?.id === song.id ? '2px solid #000' : '2px solid transparent',
                      transition: 'all 0.2s',
                      position: 'relative',
                      zIndex: 30,
                      pointerEvents: 'auto'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F0F0F0'
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSong?.id !== song.id) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    {/* CD Icon with Artwork */}
                    <div
                      style={{
                        width: isMobile ? '30px' : '40px',
                        height: isMobile ? '30px' : '40px',
                        borderRadius: '50%',
                        background: song.artwork_url && song.artwork_url.trim()
                          ? 'transparent'
                          : `radial-gradient(circle, ${cdColor} 30%, ${cdColor}dd 60%, #333 65%, #333 100%)`,
                        border: isMobile ? '1.5px solid #000' : '2px solid #000',
                        flexShrink: 0,
                        position: 'relative',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
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
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                          onError={(e) => {
                            console.error('❌ Failed to load artwork for', song.title)
                            console.error('Artwork URL:', song.artwork_url)
                            // Hide the broken image
                            e.currentTarget.style.display = 'none'
                          }}
                          onLoad={() => {
                            console.log('✅ Artwork loaded successfully for', song.title)
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
                          backgroundColor: '#000',
                          border: isMobile ? '1.5px solid #666' : '2px solid #666',
                          zIndex: 2,
                          boxShadow: 'inset 0 0 5px rgba(0,0,0,0.8)'
                        }}
                      />
                    </div>
                    
                    {/* Track Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: isMobile ? '9px' : '10px', fontWeight: 'bold', color: '#000', lineHeight: '1.2' }}>
                        {String(trackNum).padStart(2, '0')}-{song.title.replace(/\s+/g, '')}.mp3
                      </div>
                      <div style={{ fontSize: isMobile ? '8px' : '9px', color: '#666', lineHeight: '1.2' }}>
                        {song.bpm ? `${Math.round(song.bpm)} BPM` : 'Unknown duration'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Retro Window - Player */}
        <div 
          style={{
            backgroundColor: '#D4C5B9',
            border: '3px solid',
            borderColor: '#000000',
            boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
            padding: '8px',
            position: 'relative',
            overflow: 'visible',
            zIndex: 10
          }}
        >
          {/* Window Title Bar */}
          <div 
            style={{
              backgroundColor: '#C0C0C0',
              border: '2px solid #000',
              padding: '4px 8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            <span>PLAYER</span>
          </div>

          {/* Player Content */}
          <div 
            style={{
              backgroundColor: '#808080',
              border: '2px solid #000',
              padding: '20px',
              position: 'relative',
              minHeight: '200px',
              zIndex: 20
            }}
          >
            {/* Album Info */}
            <div style={{ marginBottom: '16px', color: '#FFF' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                Mixed by {artistName.toUpperCase()}
              </div>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                {albumTitle}
              </div>
            </div>

            {/* Current Track Info */}
            {selectedSong ? (
              <>
                <div 
                  style={{
                    backgroundColor: '#000',
                    color: '#FFF',
                    padding: '12px',
                    marginBottom: '16px',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {String(selectedSong.track_number || songs.indexOf(selectedSong) + 1).padStart(2, '0')}-{selectedSong.title.replace(/\s+/g, '')}.mp3
                  </div>
                  <div>Audio file</div>
                  {selectedSong.demo_mp3 ? (
                    <>
                      <div>Duration: --:--:--</div>
                      <div>22KHz 8 Bit - Stereo</div>
                    </>
                  ) : (
                    <>
                      <div>Duration: --:--:--</div>
                      <div style={{ fontSize: '9px', color: '#aaa', marginTop: '4px' }}>No demo available - click EXPLORE STEMS to mix</div>
                    </>
                  )}
                </div>

                {/* Demo audio played via RealTimelineMixerEngine (Superpowered) - same as stem player */}

                {/* Player Controls */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                  <button
                    onClick={handlePlayPause}
                    disabled={!selectedSong?.demo_mp3 || !demoReady}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: (selectedSong?.demo_mp3 && demoReady) ? '#D4C5B9' : '#999',
                      border: '2px solid #000',
                      cursor: (selectedSong?.demo_mp3 && demoReady) ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: (selectedSong?.demo_mp3 && demoReady) ? 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff' : 'none',
                      opacity: (selectedSong?.demo_mp3 && demoReady) ? 1 : 0.5,
                      position: 'relative',
                      zIndex: 30,
                      pointerEvents: 'auto'
                    }}
                  >
                    {isPlaying ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="2" width="2" height="8" fill="#000"/>
                        <rect x="7" y="2" width="2" height="8" fill="#000"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 2L10 6L3 10V2Z" fill="#000"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Explore Stems Button */}
                <button
                  onClick={() => handleExploreStems(selectedSong)}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    backgroundColor: '#D4C5B9',
                    border: '2px solid #000',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                    transition: 'all 0.2s',
                    position: 'relative',
                    zIndex: 30,
                    pointerEvents: 'auto'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#E8D9CD'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#D4C5B9'
                  }}
                >
                  EXPLORE STEMS
                </button>
              </>
            ) : (
              <div style={{ color: '#FFF', textAlign: 'center', padding: '20px', fontSize: '11px' }}>
                Click a track to preview
              </div>
            )}
          </div>
        </div>

        {/* CD/Record Player Visual - Always visible */}
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            right: '-60px',
            width: '180px',
            height: '180px',
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
                : '#F5F5F5', // Light gray for empty CD
              border: '3px solid #000',
              boxShadow: 'none',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Artwork Image */}
            {selectedSong && selectedSong.artwork_url && selectedSong.artwork_url.trim() && (
              <Image
                src={selectedSong.artwork_url}
                alt={selectedSong.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                style={{
                  objectFit: 'cover',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: 0
                }}
                className="rounded-full"
                quality={85}
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                onError={(e) => {
                  console.error('❌ Failed to load artwork for', selectedSong.title)
                  console.error('Artwork URL:', selectedSong.artwork_url)
                  e.currentTarget.style.display = 'none'
                }}
                onLoad={() => {
                  console.log('✅ Artwork loaded successfully for', selectedSong.title)
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
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4), inset 0 0 60px rgba(0,0,0,0.2)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}
              />
            )}
            {/* Empty CD Radial Lines Pattern - Only show when no song selected */}
            {!selectedSong && (
              <svg
                width="100%"
                height="100%"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: 0.3
                }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <pattern id="cdLines" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                    {Array.from({ length: 36 }).map((_, i) => {
                      const angle = i * 10
                      return (
                        <line
                          key={i}
                          x1="50"
                          y1="50"
                          x2="50"
                          y2="0"
                          stroke="#000"
                          strokeWidth="0.3"
                          transform={`rotate(${angle} 50 50)`}
                        />
                      )
                    })}
                  </pattern>
                </defs>
                <circle cx="50" cy="50" r="50" fill="url(#cdLines)" />
              </svg>
            )}
            
            {/* CD Center Hole */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: selectedSong ? '40px' : '35px',
                height: selectedSong ? '40px' : '35px',
                borderRadius: '50%',
                backgroundColor: selectedSong ? '#000' : '#1a1a1a',
                border: selectedSong ? '4px solid #666' : '3px solid #444',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)'
              }}
            />
            
            {/* CD Label/Artwork Area - Only show when song selected */}
            {selectedSong && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  ...(selectedSong.artwork_url && selectedSong.artwork_url.trim()
                    ? {
                        backgroundImage: `url("${selectedSong.artwork_url}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                      }
                    : {
                        background: 'rgba(255,255,255,0.1)',
                      }
                  ),
                  border: '2px solid rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  color: '#FFF',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  boxShadow: selectedSong.artwork_url && selectedSong.artwork_url.trim() ? 'inset 0 0 20px rgba(0,0,0,0.3)' : 'none',
                  zIndex: 2
                }}
              >
                {!selectedSong.artwork_url && selectedSong.title}
              </div>
            )}
          </div>
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
      `}</style>
    </div>
  )
}
