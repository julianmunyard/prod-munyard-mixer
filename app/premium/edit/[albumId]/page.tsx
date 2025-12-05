'use client'

import '../../../globals.css'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import { HexColorPicker } from 'react-colorful'
import { convertToMp3 } from '@/lib/convertToMp3'
import MiniMixerPreview from '../../../components/MiniMixerPreview'

function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type SongData = {
  existingId?: string // If this exists, it's an update; if not, it's a new song
  title: string
  stems: FileList | null
  uploadedFiles: string[]
  stemNames: Record<number, string>
  existingStems?: { label: string; file: string }[] // For existing songs
  bpm: number | ''
  demoFile: File | null
  demoUrl: string | null
  existingDemoUrl?: string | null
  artworkFile: File | null
  artworkUrl: string | null
  existingArtworkUrl?: string | null
  trackNumber: number
}

export default function EditAlbum() {
  const router = useRouter()
  const { albumId } = useParams() as { albumId: string }
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [locked, setLocked] = useState(true)
  const [artistName, setArtistName] = useState('')
  const [albumTitle, setAlbumTitle] = useState('')
  const [color, setColor] = useState('Red (Classic)')
  const [effect, setEffect] = useState('Delay')
  const [primaryColor, setPrimaryColor] = useState('#B8001F')
  const [showThemeDropdown, setShowThemeDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [backgroundVideo, setBackgroundVideo] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null)
  const [videoRemoved, setVideoRemoved] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  
  // Album songs state
  const [albumSongs, setAlbumSongs] = useState<SongData[]>([])
  const [editingIndex, setEditingIndex] = useState<string | null>(null)
  
  const demoFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const artworkFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  useEffect(() => {
    document.body.setAttribute('data-page', 'create')
    document.body.style.backgroundColor = '#FCFAEE'
    document.body.style.color = '#171717'
    return () => {
      document.body.removeAttribute('data-page')
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [])

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
    }
  }, [videoPreviewUrl])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setShowThemeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load existing album data
  useEffect(() => {
    async function loadAlbum() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push('/login')
        return
      }

      if (!user.email_confirmed_at && !user.confirmed_at) {
        alert('Please verify your email before continuing.')
        router.push('/login')
        return
      }

      setUserEmail(user.email ?? null)
      setLocked(false)

      // Fetch album songs
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('album_id', albumId)
        .eq('user_id', user.id)
        .order('track_number', { ascending: true })

      if (songsError || !songs || songs.length === 0) {
        alert('Could not find album to edit.')
        router.push('/dashboard')
        return
      }

      // Set album metadata from first song
      const firstSong = songs[0]
      setArtistName(firstSong.artist_name || '')
      setAlbumTitle(firstSong.album_title || '')
      setPrimaryColor(firstSong.primary_color || '#B8001F')
      setColor(firstSong.color || 'Red (Classic)')
      setExistingVideoUrl(firstSong.background_video || null)
      setEffect(
        firstSong.effects === 'delay' || firstSong.effects === 'Delay'
          ? 'Delay (1/8 note tape-style echo)'
          : firstSong.effects === 'phaser' || firstSong.effects === 'Phaser'
          ? 'Phaser (swooshy phase shifting)'
          : 'Delay'
      )

      // Convert songs to SongData format
      const loadedSongs: SongData[] = songs.map((song) => {
        let loadedStems: { label: string; file: string }[] = []
        if (song.stems && typeof song.stems === 'string') {
          try { loadedStems = JSON.parse(song.stems) } catch {}
        } else if (Array.isArray(song.stems)) {
          loadedStems = song.stems
        }

        return {
          existingId: song.id,
          title: song.title || '',
          stems: null,
          uploadedFiles: loadedStems.map(s => s.label),
          stemNames: Object.fromEntries(loadedStems.map((s, i) => [i, s.label])),
          existingStems: loadedStems,
          bpm: song.bpm || '',
          demoFile: null,
          demoUrl: null,
          existingDemoUrl: song.demo_mp3 || null,
          artworkFile: null,
          artworkUrl: null,
          existingArtworkUrl: (song as any).artwork_url || null,
          trackNumber: song.track_number || 0,
        }
      })

      setAlbumSongs(loadedSongs)
    }

    loadAlbum()
  }, [albumId, router])

  const addSongToAlbum = () => {
    const newTrackNumber = albumSongs.length > 0 
      ? Math.max(...albumSongs.map(s => s.trackNumber)) + 1 
      : 1
    setAlbumSongs([...albumSongs, { 
      title: '', 
      stems: null, 
      uploadedFiles: [], 
      stemNames: {}, 
      bpm: '', 
      demoFile: null, 
      demoUrl: null,
      artworkFile: null,
      artworkUrl: null,
      trackNumber: newTrackNumber
    }])
  }

  const removeSongFromAlbum = (index: number) => {
    if (albumSongs.length > 1) {
      setAlbumSongs(albumSongs.filter((_, i) => i !== index))
    }
  }

  const updateAlbumSong = (index: number, updates: Partial<SongData>) => {
    setAlbumSongs(albumSongs.map((song, i) => i === index ? { ...song, ...updates } : song))
  }

  const handleAlbumSongFiles = (index: number, files: FileList | null) => {
    if (!files) return
    
    const maxStemsForMobile = 15
    let processedFiles = files
    
    if (isMobile && files.length > maxStemsForMobile) {
      const limitedFiles = Array.from(files).slice(0, maxStemsForMobile)
      const newFileList = new DataTransfer()
      limitedFiles.forEach(file => newFileList.items.add(file))
      processedFiles = newFileList.files
      alert(`📱 Mobile: Limited to ${maxStemsForMobile} stems.`)
    }
    
    const song = albumSongs[index]
    
    // Get unique files only (by name) to prevent duplicates
    const fileNames = new Set<string>()
    const uniqueFiles: File[] = []
    
    Array.from(processedFiles).forEach(file => {
      if (!fileNames.has(file.name)) {
        fileNames.add(file.name)
        uniqueFiles.push(file)
      }
    })
    
    // Create a new FileList with just the unique new files
    const newFileList = new DataTransfer()
    uniqueFiles.forEach(file => newFileList.items.add(file))
    
    updateAlbumSong(index, {
      stems: newFileList.files,
      uploadedFiles: uniqueFiles.map(f => f.name),
      stemNames: {}, // Reset stem names for new files
      // Clear existing stems when new ones are uploaded (they're being replaced)
      existingStems: undefined
    })
  }
  
  // Remove a single new stem from an album song
  const removeAlbumSongStem = (songIndex: number, fileIndex: number) => {
    const song = albumSongs[songIndex]
    
    // Check if we have files to remove
    if (!song.uploadedFiles || song.uploadedFiles.length === 0 || fileIndex >= song.uploadedFiles.length) {
      console.warn('Cannot remove stem: invalid index or no files')
      return
    }
    
    // Remove from uploadedFiles array first
    const newUploadedFiles = [...song.uploadedFiles]
    newUploadedFiles.splice(fileIndex, 1)
    
    // Update stems FileList if it exists
    let newFileList: FileList | null = null
    if (song.stems && song.stems.length > 0) {
      const filesArray = Array.from(song.stems)
      if (fileIndex < filesArray.length) {
        filesArray.splice(fileIndex, 1)
        const dataTransfer = new DataTransfer()
        filesArray.forEach(file => dataTransfer.items.add(file))
        newFileList = dataTransfer.files.length > 0 ? dataTransfer.files : null
      }
    }
    
    // Remove from stemNames and reindex
    const newStemNames: Record<number, string> = {}
    Object.keys(song.stemNames || {}).forEach(key => {
      const keyNum = parseInt(key)
      if (keyNum < fileIndex) {
        newStemNames[keyNum] = song.stemNames[keyNum]
      } else if (keyNum > fileIndex) {
        newStemNames[keyNum - 1] = song.stemNames[keyNum]
      }
    })
    
    updateAlbumSong(songIndex, {
      stems: newFileList,
      uploadedFiles: newUploadedFiles,
      stemNames: newStemNames
    })
  }
  
  // Remove a single existing stem from an album song
  const removeExistingStem = (songIndex: number, fileIndex: number) => {
    const song = albumSongs[songIndex]
    if (!song.existingStems || song.existingStems.length === 0) return
    
    const newExistingStems = [...song.existingStems]
    newExistingStems.splice(fileIndex, 1)
    
    // Update stemNames to remove the deleted index and reindex
    const newStemNames: Record<number, string> = {}
    Object.keys(song.stemNames).forEach(key => {
      const keyNum = parseInt(key)
      if (keyNum < fileIndex) {
        newStemNames[keyNum] = song.stemNames[keyNum]
      } else if (keyNum > fileIndex) {
        newStemNames[keyNum - 1] = song.stemNames[keyNum]
      }
    })
    
    updateAlbumSong(songIndex, {
      existingStems: newExistingStems.length > 0 ? newExistingStems : undefined,
      stemNames: newStemNames
    })
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

    if (!artistName.trim() || !albumTitle.trim()) {
      alert('Please enter both an artist name and album title.')
      setIsSubmitting(false)
      return
    }

    // Validate all songs have titles
    for (let i = 0; i < albumSongs.length; i++) {
      const song = albumSongs[i]
      if (!song.title.trim()) {
        alert(`Please enter a title for Song ${i + 1}.`)
        setIsSubmitting(false)
        return
      }
      // Songs must have either new stems or existing stems
      if (!song.stems && (!song.existingStems || song.existingStems.length === 0)) {
        alert(`Please upload stems for Song ${i + 1}, or ensure it has existing stems.`)
        setIsSubmitting(false)
        return
      }
    }

    // Handle video
    let videoPublicUrl: string | null = null
    if (videoRemoved) {
      videoPublicUrl = null
    } else if (backgroundVideo) {
      const videoExt = backgroundVideo.name.split('.').pop()
      const videoPath = `${user.id}/videos/${uuidv4()}.${videoExt}`
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('videos')
        .upload(videoPath, backgroundVideo, {
          contentType: backgroundVideo.type,
          upsert: false,
        })
      if (uploadError) {
        alert('Failed to upload video. Please try again.')
        setIsSubmitting(false)
        return
      }
      if (uploadData) {
        const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
        videoPublicUrl = publicUrlData.publicUrl
      }
    } else {
      videoPublicUrl = existingVideoUrl
    }

    const artistSlug = toSlug(artistName)
    const albumSlug = toSlug(albumTitle)

    // Update or create each song
    const updatedSongs = []
    
    for (let i = 0; i < albumSongs.length; i++) {
      const song = albumSongs[i]
      
      // Upload new stems if provided
      let uploadedStemUrls: { label: string; file: string }[] = []
      
      if (song.stems && song.stems.length > 0) {
        // Upload new stems
        for (let j = 0; j < song.stems.length; j++) {
          const file = song.stems[j]
          let processedFile = file
          
          if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
            try {
              processedFile = await convertToMp3(file)
            } catch (err) {
              alert(`Failed to convert WAV for Song ${i + 1}.`)
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
      } else if (song.existingStems && song.existingStems.length > 0) {
        // Use existing stems, but update labels if changed
        uploadedStemUrls = song.existingStems.map((stem, j) => ({
          ...stem,
          label: song.stemNames[j]?.trim() || stem.label,
        }))
      }

      // Upload demo audio if new one provided - EXACT SAME CODE AS CREATE PAGE
      let demoUrl: string | null = song.existingDemoUrl || null
      if (song.demoFile) {
        let processedDemoFile = song.demoFile
        
        // EXACT SAME WAV CONVERSION AS CREATE PAGE
        if (song.demoFile.type === 'audio/wav' || song.demoFile.name.toLowerCase().endsWith('.wav')) {
          try {
            processedDemoFile = await convertToMp3(song.demoFile)
          } catch (err) {
            alert(`Failed to convert demo WAV for Song ${i + 1}.`)
            setIsSubmitting(false)
            return
          }
        }

        // EXACT SAME UPLOAD CODE AS CREATE PAGE
        try {
          demoUrl = await uploadFileWithProgress(processedDemoFile)
          console.log(`✅ Demo audio uploaded for Song ${i + 1}:`, demoUrl)
        } catch (err) {
          console.error(`Failed to upload demo for Song ${i + 1}:`, err)
          alert(`Upload failed for demo of Song ${i + 1}.`)
          setIsSubmitting(false)
          return
        }
      }

      // Handle artwork: keep existing, upload new, or remove
      let artworkUrl: string | null | undefined = undefined // undefined = don't update, null = remove, string = set to this URL
      
      // Check if user explicitly removed artwork (both artworkFile and existingArtworkUrl are null/removed)
      const hadExistingArtwork = song.existingArtworkUrl !== null && song.existingArtworkUrl !== undefined
      const artworkWasRemoved = hadExistingArtwork && !song.artworkFile && song.existingArtworkUrl === null
      
      if (artworkWasRemoved) {
        // User clicked "Remove Artwork" - set to null to remove from database
        artworkUrl = null
        console.log(`🗑️ Removing artwork for Song ${i + 1}`)
      } 
      // If new artwork file uploaded, upload it
      else if (song.artworkFile) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')
          
          const fileExt = song.artworkFile.name.split('.').pop()
          const filePath = `${user.id}/artwork/${uuidv4()}.${fileExt}`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('stems')
            .upload(filePath, song.artworkFile, { upsert: false })
          
          if (uploadError) throw uploadError
          
          const { data: publicUrlData } = supabase.storage.from('stems').getPublicUrl(filePath)
          artworkUrl = publicUrlData.publicUrl
          console.log(`✅ New artwork uploaded for Song ${i + 1}:`, artworkUrl)
        } catch (err) {
          console.warn(`Failed to upload artwork for Song ${i + 1}, keeping existing:`, err)
          // If upload fails, keep existing artwork (don't update)
          artworkUrl = undefined
        }
      }
      // Otherwise, keep existing artwork (artworkUrl stays undefined, won't update this field)

      const songSlug = `${toSlug(song.title)}-${i + 1}`

      const updatePayload: any = {
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
        album_title: albumTitle,
        album_slug: albumSlug,
        track_number: i + 1,
      }

      // Always include demo_mp3 if we have a value (even if null, to clear it)
      if (demoUrl !== undefined) {
        updatePayload.demo_mp3 = demoUrl
        console.log(`✅ Setting demo_mp3 for Song ${i + 1}:`, demoUrl || 'null (removing)')
      } else {
        console.log(`⏭️ Keeping existing demo_mp3 for Song ${i + 1} (no change)`)
      }
      // Always include artwork_url if we have a value (including null to remove it, but not undefined to keep existing)
      if (artworkUrl !== undefined) {
        updatePayload.artwork_url = artworkUrl
        if (artworkUrl === null) {
          console.log(`🗑️ Removing artwork_url for Song ${i + 1}`)
        } else {
          console.log(`✅ Setting artwork_url for Song ${i + 1}:`, artworkUrl)
        }
      } else {
        console.log(`⏭️ Keeping existing artwork for Song ${i + 1} (no change)`)
      }

      if (song.existingId) {
        // Update existing song
        console.log(`🔄 Updating existing song ${i + 1} (ID: ${song.existingId})`)
        console.log(`📦 Update payload:`, JSON.stringify(updatePayload, null, 2))
        const { data: updatedSong, error: updateError } = await supabase
          .from('songs')
          .update(updatePayload)
          .eq('id', song.existingId)
          .select('*')
          .single()
          
        if (updateError) {
          console.error(`❌ Failed to update song ${i + 1}:`, updateError)
          alert(`Error updating Song ${i + 1}: ${updateError.message}`)
          setIsSubmitting(false)
          return
        }
        
        console.log(`✅ Successfully updated song ${i + 1}`)
        if (updatePayload.artwork_url !== undefined) {
          console.log(`🎨 Artwork updated for song ${i + 1}:`, updatePayload.artwork_url || 'removed')
        }

        if (updateError) {
          alert(`Error updating Song ${i + 1}: ${updateError.message}`)
          setIsSubmitting(false)
          return
        }

        updatedSongs.push(updatedSong)
      } else {
        // Create new song - ensure demo_mp3 is included
        updatePayload.user_id = user.id
        updatePayload.album_id = albumId
        
        // Always include demo_mp3 for new songs if we have it
        if (demoUrl) {
          updatePayload.demo_mp3 = demoUrl
          console.log(`✅ Adding demo_mp3 to new song insert for Song ${i + 1}:`, demoUrl)
        }

        const { data: newSong, error: insertError } = await supabase
          .from('songs')
          .insert(updatePayload)
          .select()
          .single()

        if (insertError) {
          // Try workaround if album fields fail
          const basePayload: any = {
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
          
          if (demoUrl !== undefined) {
            basePayload.demo_mp3 = demoUrl
          }
          if (artworkUrl !== undefined) {
            basePayload.artwork_url = artworkUrl
          }

          const { data: baseSong, error: baseError } = await supabase
            .from('songs')
            .insert(basePayload)
            .select()
            .single()

          if (baseError || !baseSong) {
            alert(`Error creating Song ${i + 1}: ${baseError?.message || 'Unknown error'}`)
            setIsSubmitting(false)
            return
          }

          // Update with album fields
          const albumUpdate: any = {
            album_id: albumId,
            album_title: albumTitle,
            album_slug: albumSlug,
            track_number: i + 1,
          }
          if (demoUrl !== undefined) {
            albumUpdate.demo_mp3 = demoUrl
          }
          if (artworkUrl !== undefined) {
            albumUpdate.artwork_url = artworkUrl
            console.log(`✅ Setting artwork_url in albumUpdate for Song ${i + 1}:`, artworkUrl)
          }

          const { data: finalSong, error: finalError } = await supabase
            .from('songs')
            .update(albumUpdate)
            .eq('id', baseSong.id)
            .select()
            .single()

          if (finalError || !finalSong) {
            alert(`Error saving album info for Song ${i + 1}: ${finalError?.message || 'Unknown error'}`)
            setIsSubmitting(false)
            return
          }

          updatedSongs.push(finalSong)
        } else {
          updatedSongs.push(newSong)
        }
      }
    }

    // Redirect to album landing page
    const songIds = updatedSongs.map(s => s.id).join(',')
    router.push(`/album/${albumId}?songs=${songIds}`)
  }

  if (locked) {
    return (
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: '1.25rem' }}>Loading album...</p>
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
      backgroundColor: '#FCFAEE',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
    }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>EDIT ALBUM</h1>

        {userEmail && (
          <p style={{ marginBottom: '2rem' }}>
            Logged in as: {userEmail.split('@')[0].split('.')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].split('.')[0].slice(1)}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <label>
            Artist Name
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              style={{ padding: '0.5rem', width: '100%', backgroundColor: 'white', color: 'black', marginTop: '0.5rem' }}
            />
          </label>

          <label>
            Album Title
            <input
              type="text"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              style={{ padding: '0.5rem', width: '100%', backgroundColor: 'white', color: 'black', marginTop: '0.5rem' }}
            />
          </label>

          {/* Album songs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
            {albumSongs.map((song, index) => (
              <div key={index} style={{ border: '2px solid #B8001F', borderRadius: '8px', padding: '1.5rem', backgroundColor: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#B8001F' }}>
                    SONG {index + 1} {song.existingId ? '(Existing)' : '(New)'}
                  </h3>
                  {albumSongs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSongFromAlbum(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#B8001F',
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
                    style={{ padding: '0.5rem', width: '100%', backgroundColor: '#FCFAEE', color: 'black', marginTop: '0.5rem' }}
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
                    style={{ padding: '0.5rem', width: '100%', backgroundColor: '#FCFAEE', color: 'black', marginTop: '0.5rem' }}
                  />
                </label>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Stems</label>
                  <label
                    htmlFor={`album-song-${index}`}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#ffffff',
                      color: '#B8001F',
                      border: '1px solid #B8001F',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'block',
                      textAlign: 'center',
                      width: '100%',
                    }}
                  >
                    {(song.uploadedFiles.length > 0 || (song.existingStems && song.existingStems.length > 0)) ? 'Replace Files' : 'Choose Files'}
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
                  
                  {/* Show all stems in one unified list - only show existing OR new, not both */}
                  {((song.existingStems && song.existingStems.length > 0 && !song.stems) || song.uploadedFiles.length > 0) && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {/* Show existing stems ONLY if no new stems have been uploaded */}
                      {song.existingStems && song.existingStems.length > 0 && !song.stems && song.uploadedFiles.length === 0 && song.existingStems.map((stem, fileIndex) => {
                        const editingKey = `album-existing-${index}-${fileIndex}`
                        const isEditing = editingIndex === editingKey
                        return (
                          <div key={`existing-${fileIndex}`} style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              {isEditing ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={song.stemNames[fileIndex] || stem.label}
                                  onChange={(e) => {
                                    const updatedSong = { ...song, stemNames: { ...song.stemNames, [fileIndex]: e.target.value } }
                                    updateAlbumSong(index, updatedSong)
                                  }}
                                  onBlur={() => setEditingIndex(null)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingIndex(null) }}
                                  style={{ width: '100%', padding: '0.4rem', backgroundColor: 'white', color: 'black', border: '1px solid #ccc', fontSize: '0.85rem' }}
                                />
                              ) : (
                                <div 
                                  onClick={() => setEditingIndex(editingKey)} 
                                  style={{ cursor: 'pointer', padding: '0.3rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.85rem' }}
                                >
                                  {song.stemNames[fileIndex]?.trim() || stem.label}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                removeExistingStem(index, fileIndex)
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ff6b6b',
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
                      
                      {/* Show new stems ONLY (existing stems are hidden when new ones are uploaded) */}
                      {song.uploadedFiles.length > 0 && song.uploadedFiles.map((file, fileIndex) => {
                        const editingKey = `album-new-${index}-${fileIndex}`
                        const isEditing = editingIndex === editingKey
                        return (
                          <div key={`new-${fileIndex}`} style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                                  style={{ width: '100%', padding: '0.4rem', backgroundColor: 'white', color: 'black', border: '1px solid #ccc', fontSize: '0.85rem' }}
                                />
                              ) : (
                                <div 
                                  onClick={() => setEditingIndex(editingKey)} 
                                  style={{ cursor: 'pointer', padding: '0.3rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '0.85rem' }}
                                >
                                  {song.stemNames[fileIndex]?.trim() || file}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                removeAlbumSongStem(index, fileIndex)
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ff6b6b',
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
                
                {/* Demo Audio Upload */}
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                    Demo Audio (Optional - MP3 or WAV)
                    {song.existingDemoUrl && <span style={{ fontSize: '0.8rem', color: '#666' }}> (Existing: {song.existingDemoUrl.split('/').pop()})</span>}
                  </label>
                  <label
                    htmlFor={`demo-song-${index}`}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#ffffff',
                      color: '#B8001F',
                      border: '1px solid #B8001F',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'block',
                      textAlign: 'center',
                      width: '100%',
                      fontSize: '0.9rem',
                    }}
                  >
                    {song.demoFile ? song.demoFile.name : song.existingDemoUrl ? 'Replace Demo Audio' : 'Choose Demo Audio (MP3/WAV)'}
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
                  {(song.demoFile || song.existingDemoUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        updateAlbumSong(index, { demoFile: null, demoUrl: null, existingDemoUrl: null })
                        if (demoFileInputRefs.current[index]) {
                          demoFileInputRefs.current[index]!.value = ''
                        }
                      }}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#ff6b6b',
                        color: 'white',
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
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                    Artwork (Optional)
                    {song.existingArtworkUrl && <span style={{ fontSize: '0.8rem', color: '#666' }}> (Existing artwork)</span>}
                  </label>
                  {(song.artworkFile || song.existingArtworkUrl) && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <img
                        src={song.artworkFile ? URL.createObjectURL(song.artworkFile) : song.existingArtworkUrl || ''}
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
                      backgroundColor: '#ffffff',
                      color: '#B8001F',
                      border: '1px solid #B8001F',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'block',
                      textAlign: 'center',
                      width: '100%',
                      fontSize: '0.9rem',
                    }}
                  >
                    {song.artworkFile ? song.artworkFile.name : song.existingArtworkUrl ? 'Replace Artwork' : 'Choose Artwork (Image)'}
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
                  {(song.artworkFile || song.existingArtworkUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        updateAlbumSong(index, { artworkFile: null, artworkUrl: null, existingArtworkUrl: null })
                        if (artworkFileInputRefs.current[index]) {
                          artworkFileInputRefs.current[index]!.value = ''
                        }
                      }}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#ff6b6b',
                        color: 'white',
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
                backgroundColor: 'white',
                color: '#B8001F',
                border: '2px dashed #B8001F',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
              }}
            >
              + ADD SONG
            </button>
          </div>

          {/* Theme and color picker */}
          <div style={{ position: 'relative', width: '100%' }} data-dropdown>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Choose Your Mixer Theme</label>
            <div
              onClick={() => setShowThemeDropdown(!showThemeDropdown)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid #ccc',
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
                backgroundColor: 'white',
                border: '1px solid #ccc',
                zIndex: 10,
              }}>
                {['Red (Classic)', 'Transparent'].map(theme => (
                  <div
                    key={theme}
                    onClick={() => { setColor(theme); setShowThemeDropdown(false) }}
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      backgroundColor: color === theme ? '#f3f3f3' : 'white',
                    }}
                  >
                    {theme}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center', marginTop: '2rem' }}>
            <div style={{ flex: '1 1 280px', maxWidth: '100%' }}>
              <HexColorPicker
                color={primaryColor}
                onChange={setPrimaryColor}
                style={{ width: '100%', height: '280px', borderRadius: '12px' }}
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value.trim())}
                placeholder="#B8001F"
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem',
                  fontFamily: 'monospace',
                  width: '100%',
                  color: primaryColor,
                  border: `1px solid ${primaryColor}`,
                  backgroundColor: '#fff',
                }}
              />
            </div>
            <MiniMixerPreview theme={color} accentColor={primaryColor} />
          </div>

          {/* Effect selector */}
          <div style={{ position: 'relative', width: '100%' }} data-dropdown>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Effect</label>
            <select
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid #ccc',
              }}
            >
              <option value="Delay (1/8 note tape-style echo)">Delay (1/8 note tape-style echo)</option>
              <option value="Phaser (swooshy phase shifting)">Phaser (swooshy phase shifting)</option>
              <option value="None">None</option>
            </select>
          </div>

          {/* Background video */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Background Video (Optional)</label>
            {existingVideoUrl && !videoRemoved && !backgroundVideo && (
              <div style={{ marginBottom: '1rem' }}>
                <video
                  src={existingVideoUrl}
                  controls
                  style={{ width: '100%', maxHeight: '200px', marginBottom: '0.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setVideoRemoved(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Remove Video
                </button>
              </div>
            )}
            {(!existingVideoUrl || videoRemoved || backgroundVideo) && (
              <>
                <label
                  htmlFor="video-upload"
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ffffff',
                    color: '#B8001F',
                    border: '1px solid #B8001F',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'block',
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  {backgroundVideo ? backgroundVideo.name : 'Choose Video File'}
                </label>
                <input
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setBackgroundVideo(file)
                      setVideoRemoved(false)
                      const url = URL.createObjectURL(file)
                      setVideoPreviewUrl(url)
                    }
                  }}
                  style={{ display: 'none' }}
                />
                {videoPreviewUrl && (
                  <video
                    src={videoPreviewUrl}
                    controls
                    style={{ width: '100%', maxHeight: '200px', marginTop: '0.5rem' }}
                  />
                )}
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '1rem 2rem',
              backgroundColor: isSubmitting ? '#ccc' : '#B8001F',
              color: 'white',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '1.25rem',
              fontWeight: 'bold',
            }}
          >
            {isSubmitting ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </form>
      </div>
    </main>
  )
}

