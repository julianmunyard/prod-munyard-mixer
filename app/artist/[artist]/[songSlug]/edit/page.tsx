'use client'

import '../../../../globals.css'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../../../lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import axios, { AxiosProgressEvent } from 'axios'
import { HexColorPicker } from 'react-colorful'
import MiniMixerPreview from '../../../../components/MiniMixerPreview'

function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function EditProject() {
  const router = useRouter()
  const { artist, songSlug } = useParams() as { artist: string; songSlug: string }
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [locked, setLocked] = useState(true)
  const [artistName, setArtistName] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [color, setColor] = useState('Red (Classic)')
  const [effect, setEffect] = useState('Delay')
  const [stems, setStems] = useState<FileList | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadedStemUrls, setUploadedStemUrls] = useState<{ label: string; file: string }[]>([])
  const [bpm, setBpm] = useState<number | ''>('') 
  const [stemNames, setStemNames] = useState<Record<number, string>>({})
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [backgroundVideo, setBackgroundVideo] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#B8001F') // default red
  const [showThemeDropdown, setShowThemeDropdown] = useState(false)
  const [showEffectDropdown, setShowEffectDropdown] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [songId, setSongId] = useState<string | null>(null)
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null)
  const [isVideoUploading, setIsVideoUploading] = useState(false)
 const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)





  // ✅ Force cream background + body data attribute
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

  // 🔄 Get user and song on mount
  useEffect(() => {
    async function getUserAndSong() {
      // User
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
        return
      }

      // Song data
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_slug', artist)
        .eq('song_slug', songSlug)
        .single()
      if (songError || !songData) {
        alert('Could not find song to edit.')
        router.push('/dashboard')
        return
      }
      setSongId(songData.id)
      setArtistName(songData.artist_name || '')
      setProjectTitle(songData.title || '')
      setColor(songData.color || 'Red (Classic)')
      setPrimaryColor(songData.primary_color || '#B8001F')
      setExistingVideoUrl(songData.background_video || null)
      setEffect(
        songData.effects === 'delay' || songData.effects === 'Delay'
          ? 'Delay (1/8 note tape-style echo)'
          : songData.effects === 'phaser' || songData.effects === 'Phaser'
          ? 'Phaser (swooshy phase shifting)'
          : 'Delay'
      )
      setBpm(songData.bpm || '')
      // Stems
      let loadedStems: { label: string; file: string }[] = []
      if (songData.stems && typeof songData.stems === 'string') {
        try { loadedStems = JSON.parse(songData.stems) } catch {}
      } else if (Array.isArray(songData.stems)) {
        loadedStems = songData.stems
      }
      setUploadedStemUrls(loadedStems)
      setUploadedFiles(loadedStems.map((s) => s.label))
      setStemNames(
        Object.fromEntries(
          loadedStems.map((s, i) => [i, s.label])
        )
      )
    }
    getUserAndSong()
  }, [artist, songSlug])

  // File upload (same as your create)
  const uploadFileWithProgress = async (file: File): Promise<string> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const fileExt = safeName.split('.').pop() || 'wav'
    const filePath = `${userEmail}/${uuidv4()}.${fileExt}`
    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
    const { data: signed, error: signedError } = await supabase
      .storage
      .from('stems')
      .createSignedUploadUrl(filePath)
    if (signedError || !signed) {
      setUploadError('Upload failed. Try again or convert file to MP3.')
      throw new Error('Failed to get signed URL')
    }
    try {
      await axios.put(signed.signedUrl, file, {
        headers: {
          'Content-Type': file.type || 'audio/wav',
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100)
            setUploadProgress(prev => ({ ...prev, [file.name]: percent }))
          }
        },
      })
    } catch (error) {
      setUploadError('File too large or upload rejected. Try converting to MP3.')
      throw error
    }
    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
    const { data: publicData } = supabase.storage.from('stems').getPublicUrl(filePath)
    if (!publicData || !publicData.publicUrl) {
      throw new Error('Could not retrieve public URL')
    }
    return publicData.publicUrl
  }

  // Handle form submit (UPDATE, not INSERT)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      alert('You must be logged in.')
      setIsSubmitting(false)
      return
    }
    if (!userEmail) {
      alert('Missing user email. Please log in again.')
      setIsSubmitting(false)
      return
    }
    if (!artistName.trim() || !projectTitle.trim()) {
      alert('Please enter both an artist name and a project title.')
      setIsSubmitting(false)
      return
    }
let updatedStems: { label: string; file: string }[] = []

if (stems && stems.length > 0) {
  // If uploading new stems, use those
  for (let i = 0; i < stems.length; i++) {
    const file = stems[i]
    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
    try {
      const publicUrl = await uploadFileWithProgress(file)
      updatedStems.push({ label: stemNames[i]?.trim() || file.name, file: publicUrl })
    } catch (err) {
      alert('One of your files failed to upload.')
      setIsSubmitting(false)
      return
    }
  }
} else {
  // If not uploading new stems, update the labels for the EXISTING stems
  updatedStems = uploadedStemUrls.map((stem, i) => ({
    ...stem,
    label: stemNames[i]?.trim() || stem.label,
  }))
}


let videoPublicUrl = existingVideoUrl; // Default to the existing video

if (backgroundVideo) {
  setIsVideoUploading(true)
  try {
    const videoExt = backgroundVideo.name.split('.').pop()
    const videoPath = `${user.id}/videos/${uuidv4()}.${videoExt}`
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('videos')
      .upload(videoPath, backgroundVideo, {
        contentType: backgroundVideo.type,
        upsert: false,
      })
    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
      videoPublicUrl = publicUrlData.publicUrl
    }
  } finally {
    setIsVideoUploading(false)
  }
}




    
    // Update the song row
    const artistSlug = toSlug(artistName)
    const newSongSlug = toSlug(projectTitle)

console.log('=== SUBMIT PAYLOAD ===')
console.log('songId', songId)
console.log('userId', user.id)
console.log('artistName', artistName)
console.log('projectTitle', projectTitle)
console.log('color', color)
console.log('primaryColor', primaryColor)
console.log('effect', effect)
console.log('updatedStems', updatedStems)
console.log('bpm', bpm)
console.log('artistSlug', artistSlug)
console.log('newSongSlug', newSongSlug)
console.log('backgroundVideo', backgroundVideo)

// Log right before update
console.log('About to update song row...', artistSlug, newSongSlug, songId)

const { error: updateError } = await supabase.from('songs').update({
  user_id: user.id,
  artist_name: artistName,
  title: projectTitle,
  effects: (
    effect.includes('Delay') ? 'delay'
    : effect.includes('Phaser') ? 'phaser'
    : null
  ),
  color,
  primary_color: primaryColor,
  stems: updatedStems,   // <<< NOT STRINGIFIED!!!
  bpm: bpm !== '' ? Number(bpm) : null,
  artist_slug: artistSlug,
  song_slug: newSongSlug,
  background_video: videoPublicUrl,
}).eq('id', songId)

    console.log("UPDATED SONG SLUGS:", { artistSlug, newSongSlug })
console.log("Update error:", updateError)

    if (updateError) {
      alert('Error saving your changes.')
      setIsSubmitting(false)
    } else {
      // After update, fetch the latest song object from the DB
const { data: updatedSong, error: fetchError } = await supabase
  .from('songs')
  .select('artist_slug, song_slug')
  .eq('id', songId)
  .single();

if (fetchError || !updatedSong) {
  alert('Update succeeded but could not fetch new song slug.');
  setIsSubmitting(false);
  return;
}

router.replace(`/artist/${updatedSong.artist_slug}/${updatedSong.song_slug}`)

    }
  }


  
  if (locked) {
    return (
      <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: '1.25rem' }}>Verifying session…</p>
      </main>
    )
  }

  // UI is identical to create page, just uses state above
  return (
    <main
      style={{
        minHeight: '100vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '3rem 1.5rem 6rem',
        fontFamily: 'Geist Mono, monospace',
        textAlign: 'center',
        backgroundColor: '#FCFAEE',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>EDIT PROJECT</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>


          <label>
            Artist Name
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              style={{ padding: '0.5rem', width: '100%', backgroundColor: 'white', color: 'black' }}
            />
          </label>

          <label>
            Project Title
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              style={{ padding: '0.5rem', width: '100%', backgroundColor: 'white', color: 'black' }}
            />
          </label>

          <label>
  BPM (Optional)
  <input
    type="number"
    min="0"
    value={bpm}
    onChange={(e) => {
      const val = e.target.value
      setBpm(val === '' ? '' : Number(val))
    }}
    placeholder="e.g. 120"
    style={{
      padding: '0.5rem',
      width: '100%',
      backgroundColor: 'white',
      color: 'black',
    }}
  />
</label>

          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
            Upload Stems (WAV/MP3)
            <label
              htmlFor="file-upload"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ffffff',
                color: '#B8001F',
                border: '1px solid #B8001F',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'inline-block',
              }}
            >
              Choose Files
            </label>
            <span style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '0.25rem' }}>
              ⚠️ Use MP3s for faster uploads, or WAVs under 50MB.
            </span>
            <input
              id="file-upload"
              type="file"
              accept=".mp3,.wav,audio/*"
              multiple
              ref={fileInputRef}
              onChange={(e) => {
                const selected = e.target.files
                if (selected) {
                  setStems(selected)
                  setUploadedFiles(Array.from(selected).map((file) => file.name))
                }
              }}
              style={{ display: 'none' }}
            />
            {stems && (
              <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#444' }}>
                {stems.length} file{stems.length > 1 ? 's' : ''} selected
              </p>
            )}
          </label>

          {uploadedFiles.length > 0 && (
            <div style={{ width: '100%' }}>
              <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                Uploading Files
              </label>
              <div style={{ marginTop: '1rem' }}>
                {uploadedFiles.map((file, i) => (
                  <div key={i} style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ flexGrow: 1 }}>

{editingIndex === i ? (
  <input
    autoFocus
    type="text"
    value={stemNames[i] || ''}
    onChange={(e) =>
      setStemNames((prev) => ({ ...prev, [i]: e.target.value }))
    }
    onBlur={() => setEditingIndex(null)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') setEditingIndex(null)
    }}
    style={{
      width: '100%',
      padding: '0.4rem 0.5rem',
      fontSize: '0.85rem',
      marginBottom: '0.5rem',
      backgroundColor: 'white',
      color: 'black',
      border: '1px solid #ccc',
      borderRadius: '4px',
    }}
  />
) : (
  <div
    onClick={() => setEditingIndex(i)}
    style={{
      cursor: 'pointer',
      marginBottom: '0.5rem',
    }}
    title="Click to rename"
  >
    <div
      style={{
        fontSize: '0.85rem',
        color: '#B8001F',
        paddingBottom: '2px',
        display: 'inline-block',
      }}
    >
      {stemNames[i]?.trim() || file}
    </div>
    <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: '2px' }}>
      tap to rename
    </div>
  </div>
)}



                      <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '4px' }}>
                        <div
                          style={{
                            width: `${uploadProgress[file] || 0}%`,
                            backgroundColor: '#B8001F',
                            height: '8px',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease-in-out',
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFiles(prev => prev.filter(f => f !== file))
                        setUploadProgress(prev => {
                          const copy = { ...prev }
                          delete copy[file]
                          return copy
                        })
                        if (stems) {
                          const newList = Array.from(stems).filter(f => f.name !== file)
                          const newFileList = new DataTransfer()
                          newList.forEach(f => newFileList.items.add(f))
                          setStems(newFileList.files)
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#B8001F',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

<div style={{ position: 'relative', width: '100%' }}>
  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Choose Your Mixer Theme</label>
  <div
    onClick={() => setShowThemeDropdown((prev) => !prev)}
    style={{
      width: '100%',
      padding: '0.5rem',
      backgroundColor: 'white',
      color: 'black',
      border: '1px solid #ccc',
      cursor: 'pointer',
      appearance: 'none',
      position: 'relative',
    }}
  >
    {color}
    <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
      ▼
    </span>
  </div>

  {showThemeDropdown && (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        width: '100%',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        zIndex: 10,
        fontSize: '0.9rem',
      }}
    >
      {['Red (Classic)', 'Transparent'].map((themeOption) => (
        <div
          key={themeOption}
          onClick={() => {
            setColor(themeOption)
            setShowThemeDropdown(false)
          }}
          style={{
            padding: '0.5rem',
            cursor: 'pointer',
            backgroundColor: color === themeOption ? '#f3f3f3' : 'white',
          }}
        >
          {themeOption}
        </div>
      ))}
    </div>
  )}
</div>



 {/* side by side preview */}
<div
  style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2rem',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: '2rem',
  }}
>
  {/* 🎨 Color Picker + Input */}
  <div style={{ flex: '1 1 280px', maxWidth: '100%' }}>
    <HexColorPicker
      color={primaryColor}
      onChange={setPrimaryColor}
      style={{
        width: '100%',
        height: '280px',
        borderRadius: '12px',
        boxShadow: '0 0 0 1px #ccc',
      }}
    />
    <input
      type="text"
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      value={primaryColor}
      onChange={(e) => {
        const val = e.target.value.trim()
        setPrimaryColor(val)
      }}
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

  {/* 🔊 Mixer Preview */}
<div
  style={{
    flex: '1 1 120px',
    maxWidth: '100%',
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties}
>
  <MiniMixerPreview theme={color} accentColor={primaryColor} />
</div>

</div>


{(color === 'Transparent' || color === 'Red (Classic)') && (
  <div style={{
    position: 'relative',
    width: '100%',
    minHeight: '140px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem'
  }}>
    <span style={{ fontWeight: 'bold' }}>Optional Background Video (MP4, WebM, MOV)</span>
    <label
      htmlFor="video-upload"
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#ffffff',
        color: '#B8001F',
        border: '1px solid #B8001F',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        display: 'inline-block',
      }}
    >
      Choose File
    </label>
    <span style={{ fontSize: '0.85rem', color: '#aaa' }}>
      This video will loop fullscreen behind the mixer.
    </span>
    <input
      id="video-upload"
      type="file"
      accept="video/mp4,video/webm,video/quicktime,.mov"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          setBackgroundVideo(file);
          setVideoPreviewUrl(URL.createObjectURL(file));
          // show spinner instantly
          setIsVideoUploading(true);
        }
      }}
      style={{ display: 'none' }}
    />
    {(videoPreviewUrl || existingVideoUrl) && (
      <div style={{
        position: 'relative',
        width: '120px',
        height: '68px',
        marginTop: '8px',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1.5px solid #B8001F',
        background: '#ececec',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <video
          src={videoPreviewUrl || existingVideoUrl || undefined}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          loop
          autoPlay
        />
        {isVideoUploading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(252,250,238, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              border: '4px solid #B8001F',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        )}
      </div>
    )}
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg);}
        100% { transform: rotate(360deg);}
      }
    `}</style>
  </div>
)}



<div style={{ position: 'relative', width: '100%' }}>
  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Which Effects Do You Want?</label>
  <div
    onClick={() => setShowEffectDropdown((prev) => !prev)}
    style={{
      width: '100%',
      padding: '0.5rem',
      backgroundColor: 'white',
      color: 'black',
      border: '1px solid #ccc',
      cursor: 'pointer',
      appearance: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      position: 'relative',
    }}
  >
    {effect}
    <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
      ▼
    </span>
  </div>
{showEffectDropdown && (
  <div
    style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      width: '100%',
      backgroundColor: 'white',
      border: '1px solid #ccc',
      zIndex: 10,
      fontSize: '0.9rem',
    }}
  >
    <div
      onClick={() => {
        setEffect('Delay (1/8 note tape-style echo)')
        setShowEffectDropdown(false)
      }}
      style={{
        padding: '0.5rem',
        cursor: 'pointer',
        backgroundColor: effect === 'Delay (1/8 note tape-style echo)' ? '#f3f3f3' : 'white',
      }}
    >
      Delay (1/8 note tape-style echo)
    </div>

    <div
      onClick={() => {
        setEffect('Phaser (swooshy phase shifting)')
        setShowEffectDropdown(false)
      }}
      style={{
        padding: '0.5rem',
        cursor: 'pointer',
        backgroundColor: effect === 'Phaser (swooshy phase shifting)' ? '#f3f3f3' : 'white',
      }}
    >
      Phaser (swooshy phase shifting)
    </div>
  </div>
  )}
</div>



          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#B8001F',
              color: 'white',
              fontSize: '1.25rem',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" style={{
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  animation: 'spin 1s linear infinite'
                }} />
                Generating…
              </>
            ) : 'Continue'}
          </button>

          {/* ✅ Custom error block goes right below button but inside <form> */}
          {uploadError && (
            <div style={{
              backgroundColor: '#FCFAEE',
              border: '2px solid #B8001F',
              color: '#B8001F',
              padding: '1rem',
              borderRadius: '6px',
              marginTop: '1.5rem',
              fontSize: '0.95rem',
              textAlign: 'left'
            }}>
              <strong>Upload Error:</strong> {uploadError}
            </div>
          )}

        </form> {/* ✅ Properly close form tag */}

      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}

