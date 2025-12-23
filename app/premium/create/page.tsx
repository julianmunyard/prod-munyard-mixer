'use client'

import '../../globals.css'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import axios, { AxiosProgressEvent } from 'axios'
import { HexColorPicker } from 'react-colorful'
import MiniMixerPreview from '../../components/MiniMixerPreview'
import DropboxFilePicker from '../../components/DropboxFilePicker'
import { convertToMp3 } from '@/lib/convertToMp3'

function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type SongData = {
  title: string
  stems: FileList | null
  uploadedFiles: string[]
  stemNames: Record<number, string>
  bpm: number | ''
  demoFile: File | null
  demoUrl: string | null
  artworkFile: File | null
  artworkUrl: string | null
}

export default function PremiumCreate() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [locked, setLocked] = useState(true)
  const [projectType, setProjectType] = useState<'single' | 'album'>('album')
  const [artistName, setArtistName] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [albumTitle, setAlbumTitle] = useState('')
  const [color, setColor] = useState('Red (Classic)')
  const [effect, setEffect] = useState('Delay')
  const [primaryColor, setPrimaryColor] = useState('#B8001F')
  const [showThemeDropdown, setShowThemeDropdown] = useState(false)
  const [showPageThemeDropdown, setShowPageThemeDropdown] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [backgroundVideo, setBackgroundVideo] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [pageTheme, setPageTheme] = useState<'TERMINAL THEME' | 'OLD COMPUTER'>('OLD COMPUTER')

  // Theme definitions
  const themes = {
    'OLD COMPUTER': {
      background: '#FFE5E5',
      text: '#000000',
      border: '#000000',
      inputBg: '#FFFFFF',
      inputText: '#000000',
      buttonBg: '#D4C5B9',
      buttonText: '#000000',
      cardBg: '#FFFFFF',
      cardBorder: '#000000',
      accent: '#000000',
      sectionBg: '#FCFAEE',
      glow: 'none'
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
      glow: '0 0 10px rgba(255,255,255,0.3)'
    }
  }
  
  const currentTheme = themes[pageTheme]
  
  // Single song state (same as regular create)
  const [stems, setStems] = useState<FileList | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [stemNames, setStemNames] = useState<Record<number, string>>({})
  const [bpm, setBpm] = useState<number | ''>('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [hasWavs, setHasWavs] = useState(false)
  const [convertStatus, setConvertStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [dotCount, setDotCount] = useState(0)
  const [fileSource, setFileSource] = useState<'device' | 'dropbox'>('device')
  const [showFileSourceDropdown, setShowFileSourceDropdown] = useState(false)
  
  // Album state
  const [albumSongs, setAlbumSongs] = useState<SongData[]>([
    { title: '', stems: null, uploadedFiles: [], stemNames: {}, bpm: '', demoFile: null, demoUrl: null, artworkFile: null, artworkUrl: null }
  ])
  
  const demoFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const artworkFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  useEffect(() => {
    document.body.setAttribute('data-page', 'create')
    document.body.style.backgroundColor = currentTheme.background
    document.body.style.color = currentTheme.text
    return () => {
      document.body.removeAttribute('data-page')
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [pageTheme, currentTheme])

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
    }
  }, [videoPreviewUrl])

  useEffect(() => {
    async function getUser() {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        router.push('/login')
        return
      }
      const user = data.session.user
      if (user.email_confirmed_at || user.confirmed_at) {
        setUserEmail(user.email ?? null)
        setLocked(false)
      } else {
        alert('Please verify your email before continuing.')
        router.push('/login')
      }
    }
    getUser()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setShowFileSourceDropdown(false)
        setShowThemeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Add song to album
  const addSongToAlbum = () => {
    setAlbumSongs([...albumSongs, { title: '', stems: null, uploadedFiles: [], stemNames: {}, bpm: '', demoFile: null, demoUrl: null, artworkFile: null, artworkUrl: null }])
  }

  // Remove song from album
  const removeSongFromAlbum = (index: number) => {
    if (albumSongs.length > 1) {
      setAlbumSongs(albumSongs.filter((_, i) => i !== index))
    }
  }

  // Update song in album
  const updateAlbumSong = (index: number, updates: Partial<SongData>) => {
    setAlbumSongs(albumSongs.map((song, i) => i === index ? { ...song, ...updates } : song))
  }

  // Handle file selection for album song
  const handleAlbumSongFiles = (index: number, files: FileList | null) => {
    if (!files) return
    
    const maxStemsForMobile = 15
    let processedFiles = files
    
    if (isMobile && files.length > maxStemsForMobile) {
      const limitedFiles = Array.from(files).slice(0, maxStemsForMobile)
      const newFileList = new DataTransfer()
      limitedFiles.forEach(file => newFileList.items.add(file))
      processedFiles = newFileList.files
      alert(`📱 Mobile detected: Limited to ${maxStemsForMobile} stems for memory optimization.`)
    }
    
    const song = albumSongs[index]
    // If there are existing stems, add the new ones to them
    const existingFiles = song.stems ? Array.from(song.stems) : []
    const newFiles = Array.from(processedFiles)
    const allFiles = [...existingFiles, ...newFiles]
    
    // Create a new FileList with all files
    const newFileList = new DataTransfer()
    allFiles.forEach(file => newFileList.items.add(file))
    
    // Preserve existing stem names
    const existingStemNames = song.stemNames || {}
    
    updateAlbumSong(index, {
      stems: newFileList.files,
      uploadedFiles: allFiles.map(f => f.name),
      stemNames: existingStemNames
    })
    
    const wavDetected = allFiles.some(f =>
      f.name.toLowerCase().endsWith('.wav') || f.type === 'audio/wav'
    )
    setHasWavs(wavDetected)
  }
  
  // Remove a single stem from an album song
  const removeAlbumSongStem = (songIndex: number, fileIndex: number) => {
    const song = albumSongs[songIndex]
    if (!song.stems || song.stems.length === 0) return
    
    const filesArray = Array.from(song.stems)
    filesArray.splice(fileIndex, 1)
    
    // Create new FileList without the removed file
    const newFileList = new DataTransfer()
    filesArray.forEach(file => newFileList.items.add(file))
    
    // Remove from uploadedFiles array
    const newUploadedFiles = [...song.uploadedFiles]
    newUploadedFiles.splice(fileIndex, 1)
    
    // Remove from stemNames
    const newStemNames = { ...song.stemNames }
    // Shift all indices after the removed one
    const updatedStemNames: Record<number, string> = {}
    Object.keys(newStemNames).forEach(key => {
      const keyNum = parseInt(key)
      if (keyNum < fileIndex) {
        updatedStemNames[keyNum] = newStemNames[keyNum]
      } else if (keyNum > fileIndex) {
        updatedStemNames[keyNum - 1] = newStemNames[keyNum]
      }
      // Skip the removed index
    })
    
    updateAlbumSong(songIndex, {
      stems: newFileList.files.length > 0 ? newFileList.files : null,
      uploadedFiles: newUploadedFiles,
      stemNames: updatedStemNames
    })
  }
  
  // Replace all stems for an album song
  const replaceAlbumSongStems = (songIndex: number) => {
    const song = albumSongs[songIndex]
    updateAlbumSong(songIndex, {
      stems: null,
      uploadedFiles: [],
      stemNames: {}
    })
    // Clear the file input
    if (fileInputRefs.current[songIndex]) {
      fileInputRefs.current[songIndex]!.value = ''
    }
  }

  const handleDropboxFiles = (files: File[]) => {
    const maxStemsForMobile = 15
    let processedFiles = files
    
    if (isMobile && files.length > maxStemsForMobile) {
      processedFiles = files.slice(0, maxStemsForMobile)
      alert(`📱 Mobile detected: Limited to ${maxStemsForMobile} stems.`)
    }
    
    const newFileList = new DataTransfer()
    processedFiles.forEach(file => newFileList.items.add(file))
    
    setStems(newFileList.files)
    setUploadedFiles(processedFiles.map(f => f.name))
    
    const wavDetected = processedFiles.some(f =>
      f.name.toLowerCase().endsWith('.wav') || f.type === 'audio/wav'
    )
    setHasWavs(wavDetected)
  }

  const uploadFileWithProgress = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/stems/${uuidv4()}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('stems')
      .upload(filePath, file, { upsert: false })
    
    if (uploadError) throw uploadError
    
    const { data: publicUrlData } = supabase.storage.from('stems').getPublicUrl(filePath)
    return publicUrlData.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      alert('You must be logged in.')
      setIsSubmitting(false)
      return
    }

    if (!artistName.trim()) {
      alert('Please enter an artist name.')
      setIsSubmitting(false)
      return
    }

    if (projectType === 'single') {
      if (!projectTitle.trim()) {
        alert('Please enter a project title.')
        setIsSubmitting(false)
        return
      }
      // Handle single song (same as regular create)
      if (!stems || stems.length === 0) {
        alert('Please upload stems.')
        setIsSubmitting(false)
        return
      }

      let uploadedStemUrls: { label: string; file: string }[] = []

      for (let i = 0; i < stems.length; i++) {
        const file = stems[i]
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

        let processedFile = file
        if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
          try {
            processedFile = await convertToMp3(file)
          } catch (err) {
            alert('Failed to convert WAV.')
            setIsSubmitting(false)
            return
          }
        }

        try {
          const publicUrl = await uploadFileWithProgress(processedFile)
          uploadedStemUrls.push({ label: stemNames[i]?.trim() || processedFile.name, file: publicUrl })
        } catch (err) {
          alert('Upload failed.')
          setIsSubmitting(false)
          return
        }
      }

      let videoPublicUrl: string | null = null
      if (backgroundVideo) {
        const videoExt = backgroundVideo.name.split('.').pop()
        const videoPath = `${user.id}/videos/${uuidv4()}.${videoExt}`
        const { data: uploadData } = await supabase.storage.from('videos').upload(videoPath, backgroundVideo, { upsert: false })
        if (uploadData) {
          const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
          videoPublicUrl = publicUrlData.publicUrl
        }
      }

      const artistSlug = toSlug(artistName)
      const songSlug = toSlug(projectTitle)

      const { data, error: insertError } = await supabase.from('songs').insert({
        user_id: user.id,
        artist_name: artistName,
        title: projectTitle,
        effects: effect.includes('Delay') ? 'delay' : effect.includes('Phaser') ? 'phaser' : null,
        color,
        primary_color: primaryColor,
        stems: uploadedStemUrls,
        bpm: bpm !== '' ? Number(bpm) : null,
        artist_slug: artistSlug,
        song_slug: songSlug,
        background_video: videoPublicUrl,
        page_theme: pageTheme,
      }).select().single()

      if (insertError || !data) {
        alert('Error saving your project.')
        setIsSubmitting(false)
      } else {
        router.push(`/artist/${artistSlug}/${songSlug}`)
      }
    } else {
      // Handle album
      if (!albumTitle.trim()) {
        alert('Please enter a collection title.')
        setIsSubmitting(false)
        return
      }

      // Validate all songs have titles and stems
      for (let i = 0; i < albumSongs.length; i++) {
        const song = albumSongs[i]
        if (!song.title.trim()) {
          alert(`Please enter a title for Song ${i + 1}.`)
          setIsSubmitting(false)
          return
        }
        if (!song.stems || song.stems.length === 0) {
          alert(`Please upload stems for Song ${i + 1}.`)
          setIsSubmitting(false)
          return
        }
      }

      // Upload video if exists
      let videoPublicUrl: string | null = null
      if (backgroundVideo) {
        const videoExt = backgroundVideo.name.split('.').pop()
        const videoPath = `${user.id}/videos/${uuidv4()}.${videoExt}`
        const { data: uploadData } = await supabase.storage.from('videos').upload(videoPath, backgroundVideo, { upsert: false })
        if (uploadData) {
          const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
          videoPublicUrl = publicUrlData.publicUrl
        }
      }

      // Create collection record (we'll use a simple approach - store album_id in songs)
      const albumId = uuidv4()
      const artistSlug = toSlug(artistName)
      const albumSlug = toSlug(albumTitle)

      // Force schema refresh by querying the table structure first
      try {
        await supabase.from('songs').select('album_id').limit(0)
      } catch (e) {
        // Ignore - just trying to refresh schema cache
      }

      // Upload all songs
      const createdSongs = []
      
      for (let i = 0; i < albumSongs.length; i++) {
        const song = albumSongs[i]
        let uploadedStemUrls: { label: string; file: string }[] = []

        // Upload stems for this song
        for (let j = 0; j < song.stems!.length; j++) {
          const file = song.stems![j]
          let processedFile = file
          
          if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
            try {
              processedFile = await convertToMp3(file)
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              alert(`Failed to convert WAV for Song ${i + 1}: ${errorMsg}\n\nPlease try refreshing the page. If the issue persists, contact support.`);
              setIsSubmitting(false)
              return
            }
          }

          try {
            const publicUrl = await uploadFileWithProgress(processedFile)
            uploadedStemUrls.push({ 
              label: song.stemNames[j]?.trim() || processedFile.name, 
              file: publicUrl 
            })
          } catch (err) {
            alert(`Upload failed for Song ${i + 1}.`)
            setIsSubmitting(false)
            return
          }
        }
        
        // Upload demo audio (MP3 or WAV) if provided - EXACT SAME CODE AS STEMS
        let demoUrl: string | null = null
        if (song.demoFile) {
          let processedDemoFile = song.demoFile
          
          // EXACT SAME WAV CONVERSION AS STEMS
          if (song.demoFile.type === 'audio/wav' || song.demoFile.name.toLowerCase().endsWith('.wav')) {
            try {
              processedDemoFile = await convertToMp3(song.demoFile)
            } catch (err) {
              alert(`Failed to convert demo WAV for Song ${i + 1}.`)
              setIsSubmitting(false)
              return
            }
          }

          // EXACT SAME UPLOAD CODE AS STEMS
          try {
            demoUrl = await uploadFileWithProgress(processedDemoFile)
          } catch (err) {
            alert(`Upload failed for demo of Song ${i + 1}.`)
            setIsSubmitting(false)
            return
          }
        }

        // Upload artwork image if provided
        let artworkUrl: string | null = null
        if (song.artworkFile) {
          try {
            // Upload artwork to 'images' bucket (or 'stems' if images bucket doesn't exist)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')
            
            const fileExt = song.artworkFile.name.split('.').pop()
            const filePath = `${user.id}/artwork/${uuidv4()}.${fileExt}`
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('stems') // Using stems bucket for now, can create dedicated 'images' bucket later
              .upload(filePath, song.artworkFile, { upsert: false })
            
            if (uploadError) throw uploadError
            
            const { data: publicUrlData } = supabase.storage.from('stems').getPublicUrl(filePath)
            artworkUrl = publicUrlData.publicUrl
            console.log(`✅ Artwork uploaded for Song ${i + 1}:`, artworkUrl)
          } catch (err) {
            console.error(`Failed to upload artwork for Song ${i + 1}:`, err)
            alert(`Upload failed for artwork of Song ${i + 1}.`)
            setIsSubmitting(false)
            return
          }
        }
        // Make song slug unique per album by appending track number if needed
        let songSlug = toSlug(song.title)
        // Add track number to ensure uniqueness within the album
        songSlug = `${songSlug}-${i + 1}`
        
        // Insert song - if album fields fail, insert without them then update
        let insertPayload: any = {
          user_id: user.id,
          artist_name: artistName,
          title: song.title,
          effects: effect.includes('Delay') ? 'delay' : effect.includes('Phaser') ? 'phaser' : null,
          color,
          primary_color: primaryColor,
          stems: uploadedStemUrls,
          bpm: song.bpm !== '' ? Number(song.bpm) : null,
          artist_slug: artistSlug,
          song_slug: songSlug,
          background_video: videoPublicUrl,
        }
        
        // Add demo_mp3 if we have it
        if (demoUrl) {
          insertPayload.demo_mp3 = demoUrl
          console.log(`✅ Adding demo_mp3 to insert payload for Song ${i + 1}:`, demoUrl)
        } else {
          console.log(`⚠️ No demoUrl for Song ${i + 1} - demo_mp3 will be null`)
        }

        // Add album fields
        insertPayload.album_id = albumId
        insertPayload.album_title = albumTitle
        insertPayload.album_slug = albumSlug
        insertPayload.track_number = i + 1
        insertPayload.page_theme = pageTheme // Save the page theme
        
        // Add artwork if we have it
        if (artworkUrl) {
          insertPayload.artwork_url = artworkUrl
        }
        
        // Simple insert - if it fails, show error and stop
        const { data: songData, error: songError } = await supabase.from('songs').insert(insertPayload).select('*').single()
        
        if (songError) {
          alert(`Error saving Song ${i + 1}: ${songError.message || 'Unknown error'}\n\nCheck your database schema and RLS policies.`)
          setIsSubmitting(false)
          return
        }

        if (!songData) {
          alert(`Error saving Song ${i + 1}: No data returned from database`)
          setIsSubmitting(false)
          return
        }
        
        // Verify album_id was saved
        if (!songData.album_id || songData.album_id !== albumId) {
          alert(`ERROR: album_id was not saved for "${song.title}". Expected: ${albumId}, Got: ${songData.album_id}`)
          setIsSubmitting(false)
          return
        }

        createdSongs.push(songData)
      }

      // Redirect to album landing page with song IDs as fallback
      const songIds = createdSongs.map(s => s.id).join(',')
      router.push(`/album/${albumId}?songs=${songIds}`)
    }
  }

  if (locked) {
    return (
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: '1.25rem' }}>Verifying session…</p>
      </main>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      overflowY: 'auto',
      padding: '3rem 1.5rem 6rem',
      fontFamily: 'Geist Mono, monospace',
      textAlign: 'center',
      backgroundColor: currentTheme.background,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      color: currentTheme.text,
      textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 4px rgba(255,255,255,0.3)' : 'none'
    }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <h1 style={{ 
          fontSize: '3rem', 
          fontWeight: 'bold', 
          marginBottom: '2rem',
          color: currentTheme.text,
          textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
          fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit'
        }}>PREMIUM CREATE</h1>

        {userEmail && (
          <p style={{ marginBottom: '2rem' }}>
            Logged in as: {userEmail.split('@')[0].split('.')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].split('.')[0].slice(1)}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Project Type Selection - visually shows COLLECTION only (single flow hidden) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Project Type</label>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                disabled
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: currentTheme.buttonBg,
                  color: currentTheme.buttonText,
                  border: `2px solid ${currentTheme.border}`,
                  boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
                  fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'default',
                  opacity: 0.9,
                }}
              >
                COLLECTION
              </button>
            </div>
          </div>

          <label>
            Artist Name
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              style={{ padding: '0.5rem', width: '100%', backgroundColor: currentTheme.inputBg, color: currentTheme.inputText, marginTop: '0.5rem', border: `1px solid ${currentTheme.border}`, fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit' }}
            />
          </label>

          {projectType === 'album' && (
            <>
              <label>
                Collection Title
                <input
                  type="text"
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  style={{ padding: '0.5rem', width: '100%', backgroundColor: currentTheme.inputBg, color: currentTheme.inputText, marginTop: '0.5rem', border: `1px solid ${currentTheme.border}`, fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit' }}
                />
              </label>

              {/* Collection songs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
                {albumSongs.map((song, index) => (
                  <div key={index} style={{ border: `2px solid ${currentTheme.border}`, borderRadius: '8px', padding: '1.5rem', backgroundColor: currentTheme.cardBg, boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: currentTheme.accent, fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit', textShadow: pageTheme === 'TERMINAL THEME' ? '0 0 8px rgba(255,255,255,0.4)' : 'none' }}>SONG {index + 1}</h3>
                      {albumSongs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSongFromAlbum(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: currentTheme.accent,
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '0 0.5rem',
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Song Title
                      <input
                        type="text"
                        value={song.title}
                        onChange={(e) => updateAlbumSong(index, { title: e.target.value })}
                        placeholder={`Song ${index + 1} title`}
                        style={{ padding: '0.5rem', width: '100%', backgroundColor: currentTheme.sectionBg, color: currentTheme.text, marginTop: '0.5rem', border: `1px solid ${currentTheme.border}`, fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit' }}
                      />
                    </label>

                    <label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '1rem' }}>
                      BPM (Optional)
                      <input
                        type="number"
                        min="0"
                        value={song.bpm}
                        onChange={(e) => updateAlbumSong(index, { bpm: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="e.g. 120"
                        style={{ padding: '0.5rem', width: '100%', backgroundColor: currentTheme.sectionBg, color: currentTheme.text, marginTop: '0.5rem', border: `1px solid ${currentTheme.border}`, fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit' }}
                      />
                    </label>

                    <div style={{ marginTop: '1rem' }}>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Choose Stems</label>
                      <label
                        htmlFor={`album-song-${index}`}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: currentTheme.cardBg,
                          color: currentTheme.accent,
                          border: `2px solid ${currentTheme.border}`,
                          boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
                          fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'block',
                          textAlign: 'center',
                          width: '100%',
                        }}
                      >
                        {song.uploadedFiles.length > 0 ? 'Add More Files' : 'Choose Files'}
                      </label>
                      <input
                        id={`album-song-${index}`}
                        type="file"
                        accept=".mp3,.wav,audio/*"
                        multiple
                        ref={(el) => { fileInputRefs.current[index] = el }}
                        onChange={(e) => handleAlbumSongFiles(index, e.target.files)}
                        style={{ display: 'none' }}
                      />
                      
                      {song.uploadedFiles.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>{song.uploadedFiles.length} file{song.uploadedFiles.length > 1 ? 's' : ''} selected</p>
                          {song.uploadedFiles.map((file, fileIndex) => {
                            const editingKey = `album-${index}-${fileIndex}`
                            const isEditing = editingIndex === editingKey
                            return (
                              <div key={fileIndex} style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      type="text"
                                      value={song.stemNames[fileIndex] || ''}
                                      onChange={(e) => {
                                        const updatedSong = { ...song, stemNames: { ...song.stemNames, [fileIndex]: e.target.value } }
                                        updateAlbumSong(index, updatedSong)
                                      }}
                                      onBlur={() => setEditingIndex(null)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') setEditingIndex(null) }}
                                      style={{ width: '100%', padding: '0.4rem', backgroundColor: currentTheme.inputBg, color: currentTheme.inputText, border: `1px solid ${currentTheme.border}`, fontSize: '0.85rem', fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit' }}
                                    />
                                  ) : (
                                    <div 
                                      onClick={() => setEditingIndex(editingKey)} 
                                      style={{ cursor: 'pointer', padding: '0.3rem', backgroundColor: pageTheme === 'TERMINAL THEME' ? '#1A1A1A' : '#f5f5f5', borderRadius: '4px', fontSize: '0.85rem', color: currentTheme.text, fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit' }}
                                    >
                                      {song.stemNames[fileIndex]?.trim() || file}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAlbumSongStem(index, fileIndex)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: currentTheme.accent,
                                    cursor: 'pointer',
                                    fontSize: '1.2rem',
                                    padding: '0 0.5rem',
                                    lineHeight: '1',
                                    flexShrink: 0,
                                  }}
                                  title="Remove this stem"
                                >
                                  ×
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Demo Audio Upload (MP3/WAV) */}
                    <div style={{ marginTop: '1rem' }}>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                        Demo Audio (Optional - MP3 or WAV for preview)
                      </label>
                      <label
                        htmlFor={`demo-song-${index}`}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: currentTheme.cardBg,
                          color: currentTheme.accent,
                          border: `2px solid ${currentTheme.border}`,
                          boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
                          fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'block',
                          textAlign: 'center',
                          width: '100%',
                          fontSize: '0.9rem',
                        }}
                      >
                        {song.demoFile ? song.demoFile.name : 'Choose Demo Audio (MP3/WAV)'}
                      </label>
                      <input
                        id={`demo-song-${index}`}
                        type="file"
                        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/*"
                        ref={(el) => { demoFileInputRefs.current[index] = el }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            updateAlbumSong(index, { demoFile: file, demoUrl: null })
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      {song.demoFile && (
                        <button
                          type="button"
                          onClick={() => {
                            updateAlbumSong(index, { demoFile: null, demoUrl: null })
                            if (demoFileInputRefs.current[index]) {
                              demoFileInputRefs.current[index]!.value = ''
                            }
                          }}
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#ff6b6b',
                            color: currentTheme.buttonText,
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Remove Demo
                        </button>
                      )}
                    </div>

                    {/* Artwork Upload */}
                    <div style={{ marginTop: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        Artwork (Optional)
                      </label>
                      {song.artworkFile && (
                        <div style={{ marginBottom: '0.5rem' }}>
                          <img
                            src={URL.createObjectURL(song.artworkFile)}
                            alt="Artwork preview"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '150px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      )}
                      <label
                        htmlFor={`artwork-song-${index}`}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: currentTheme.cardBg,
                          color: currentTheme.accent,
                          border: `2px solid ${currentTheme.border}`,
                          boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
                          fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'block',
                          textAlign: 'center',
                          width: '100%',
                          fontSize: '0.9rem',
                        }}
                      >
                        {song.artworkFile ? song.artworkFile.name : 'Choose Artwork (Image)'}
                      </label>
                      <input
                        id={`artwork-song-${index}`}
                        type="file"
                        accept="image/*"
                        ref={(el) => { artworkFileInputRefs.current[index] = el }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            updateAlbumSong(index, { artworkFile: file, artworkUrl: null })
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      {song.artworkFile && (
                        <button
                          type="button"
                          onClick={() => {
                            updateAlbumSong(index, { artworkFile: null, artworkUrl: null })
                            if (artworkFileInputRefs.current[index]) {
                              artworkFileInputRefs.current[index]!.value = ''
                            }
                          }}
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#ff6b6b',
                            color: currentTheme.buttonText,
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Remove Artwork
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSongToAlbum}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: currentTheme.cardBg,
                    color: currentTheme.accent,
                    border: `2px dashed ${currentTheme.border}`,
                    boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
                    fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                  }}
                >
                  + ADD SONG
                </button>
              </div>
            </>
          )}

          {/* Theme selector (used for both), but color picker + preview only for single projects */}
          <div style={{ position: 'relative', width: '100%' }} data-dropdown>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Choose Your Mixer Theme</label>
            <div
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: currentTheme.cardBg,
                color: currentTheme.text,
                border: `1px solid ${currentTheme.border}`,
                fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {color}
              <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>▼</span>
            </div>
            {showThemeDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '100%',
                backgroundColor: currentTheme.cardBg,
                color: currentTheme.text,
                border: `1px solid ${currentTheme.border}`,
                fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
                zIndex: 10,
              }}>
                {['Red (Classic)', 'Transparent'].map(theme => (
                  <div
                    key={theme}
                    onClick={() => { setColor(theme); setShowThemeDropdown(false) }}
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      backgroundColor: color === theme ? (pageTheme === 'TERMINAL THEME' ? '#1A1A1A' : '#f3f3f3') : currentTheme.cardBg,
                      color: currentTheme.text,
                      fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
                    }}
                  >
                    {theme}
                  </div>
                ))}
              </div>
            )}
          </div>

          {color === 'Transparent' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
              <span style={{ fontWeight: 'bold' }}>Optional Background Video (MP4 or WebM)</span>
              <label
                htmlFor="video-upload"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ffffff',
                  color: '#B8001F',
                  border: '1px solid #B8001F',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'inline-block',
                }}
              >
                Choose File
              </label>
              {videoPreviewUrl && (
                <div style={{ position: 'relative', width: '100%', maxWidth: '400px', marginTop: '1rem' }}>
                  <video src={videoPreviewUrl} controls style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }} />
                  <button
                    type="button"
                    onClick={() => {
                      setBackgroundVideo(null)
                      setVideoPreviewUrl(null)
                      const input = document.getElementById('video-upload') as HTMLInputElement
                      if (input) input.value = ''
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '4px 8px',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                id="video-upload"
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setBackgroundVideo(file)
                    setVideoPreviewUrl(URL.createObjectURL(file))
                  }
                }}
                style={{ display: 'none' }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: currentTheme.buttonBg,
              color: currentTheme.buttonText,
              border: `2px solid ${currentTheme.border}`,
              boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
              fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
              fontSize: '1.25rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: '1rem',
            }}
          >
            {isSubmitting ? 'Generating…' : 'GENERATE'}
          </button>

          {uploadError && (
            <div style={{
              backgroundColor: currentTheme.sectionBg,
              border: `2px solid ${currentTheme.border}`,
              color: currentTheme.text,
              padding: '1rem',
              borderRadius: '6px',
              marginTop: '1.5rem',
              boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
              fontFamily: pageTheme === 'TERMINAL THEME' ? 'monospace' : 'inherit',
            }}>
              <strong>Upload Error:</strong> {uploadError}
            </div>
          )}
        </form>

        {/* Theme Selector - Bottom Center */}
        <div style={{ 
          marginTop: '3rem', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          position: 'relative'
        }} data-dropdown>
          <button
            type="button"
            onClick={() => setShowPageThemeDropdown(!showPageThemeDropdown)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: currentTheme.buttonBg,
              color: currentTheme.buttonText,
              border: `2px solid ${currentTheme.border}`,
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
              fontFamily: 'monospace',
              borderRadius: '4px'
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
              backgroundColor: currentTheme.cardBg,
              border: `2px solid ${currentTheme.border}`,
              borderRadius: '4px',
              boxShadow: pageTheme === 'TERMINAL THEME' ? currentTheme.glow : 'none',
              zIndex: 1000,
              minWidth: '200px'
            }}>
              {(['TERMINAL THEME', 'OLD COMPUTER'] as const).map(themeOption => (
                <div
                  key={themeOption}
                  onClick={() => { setPageTheme(themeOption); setShowPageThemeDropdown(false) }}
                  style={{
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    backgroundColor: pageTheme === themeOption ? (pageTheme === 'TERMINAL THEME' ? '#1A1A1A' : '#f3f3f3') : currentTheme.cardBg,
                    color: currentTheme.text,
                    borderBottom: `1px solid ${currentTheme.border}`,
                    fontFamily: 'monospace',
                    fontSize: '0.9rem'
                  }}
                >
                  {themeOption}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

