'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

import '../globals.css'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import axios, { AxiosProgressEvent } from 'axios'
import { HexColorPicker } from 'react-colorful'


function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function Create() {
  const router = useRouter()
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

  // ✅ Force cream background on mount
  useEffect(() => {
    document.body.style.backgroundColor = '#FCFAEE'
    document.body.style.color = '#171717'
    return () => {
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [])
  
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

  const uploadFileWithProgress = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const filePath = `${userEmail}/${uuidv4()}.${fileExt}`
    const { data: signed, error: signedError } = await supabase
      .storage.from('stems')
      .createSignedUploadUrl(filePath)
    if (signedError || !signed) throw new Error('Failed to get signed URL')
    await axios.put(signed.signedUrl, file, {
      headers: {
        'Content-Type': file.type || 'audio/wav',
        'Content-Length': `${file.size}`
      },
      onUploadProgress: (e: AxiosProgressEvent) => {
        const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0
        setUploadProgress(prev => ({ ...prev, [file.name]: percent }))
      }
    })
    return supabase.storage.from('stems').getPublicUrl(filePath).data.publicUrl
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
    let uploadedStemUrls: { label: string; file: string }[] = []
    if (stems && stems.length > 0) {
      for (let i = 0; i < stems.length; i++) {
        const file = stems[i]
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))
        try {
          const publicUrl = await uploadFileWithProgress(file)
          uploadedStemUrls.push({ label: stemNames[i]?.trim() || file.name, file: publicUrl })
        } catch (err) {
          console.error('Upload failed:', err)
          alert('One of your files failed to upload.')
          setIsSubmitting(false)
          return
        }
      }
    }

let videoPublicUrl: string | null = null
if (backgroundVideo) {
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
  console.error('❌ Video upload error:', uploadError.message)
} else {
const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
videoPublicUrl = publicUrlData.publicUrl
}
}


    const artistSlug = toSlug(artistName)
    const songSlug = toSlug(projectTitle)

    const { data, error: insertError } = await supabase.from('songs')
.insert({
  user_id: user.id,
  artist_name: artistName,
  title: projectTitle,
  effects: [effect],
  color,
  primary_color: primaryColor, // ✅ ADD THIS
  stems: uploadedStemUrls,
  bpm: bpm !== '' ? Number(bpm) : null,
  artist_slug: artistSlug,
  song_slug: songSlug,
  background_video: videoPublicUrl,
})
      .select()
      .single()

    if (insertError || !data) {
      console.error('❌ Insert error:', insertError?.message)
      alert('Error saving your project.')
      setIsSubmitting(false)
    } else {
      console.log('✅ Inserted song:', data)
      router.push(`/artist/${artistSlug}/${songSlug}`)
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
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        fontFamily: 'Geist Mono, monospace',
        textAlign: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>UPLOAD STEMS</h1>

        {userEmail && (
          <p style={{ marginBottom: '2rem' }}>
            Logged in as:{' '}
            {userEmail
              .split('@')[0]
              .split('.')[0]
              .charAt(0)
              .toUpperCase() + userEmail.split('@')[0].split('.')[0].slice(1)}
          </p>
        )}

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
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          placeholder="e.g. 120"
          style={{ padding: '0.5rem', width: '100%', backgroundColor: 'white', color: 'black' }}
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
        color: 'white',
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

        <label>
  Choose Your Mixer Theme
  <select
    value={color}
    onChange={(e) => setColor(e.target.value)}
    style={{ padding: '0.5rem', width: '100%', backgroundColor: 'white', color: 'black' }}
  >
    <option>Red (Classic)</option>
    <option>Transparent</option>
  </select>
</label>


<label>
  Choose Your Accent Color
  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
    <HexColorPicker
      color={primaryColor}
      onChange={setPrimaryColor}
      style={{
        width: '100%',
        maxWidth: '280px',
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
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          setPrimaryColor(val)
        } else {
          setPrimaryColor(val) // allow partials while typing
        }
      }}
      placeholder="#B8001F"
      style={{
        padding: '0.5rem',
        fontFamily: 'monospace',
        width: '100%',
        color: primaryColor,
        border: `1px solid ${primaryColor}`,
        backgroundColor: '#fff',
      }}
    />
  </div>
</label>



{(color === 'Transparent' || color === 'Red (Classic)') && (
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
      accept="video/mp4,video/webm"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) setBackgroundVideo(file)
      }}
      style={{ display: 'none' }}
    />
  </div>
)}

          <label>
            Which Effects Do You Want?
            <select
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              style={{ padding: '0.5rem', width: '100%', backgroundColor: 'white', color: 'black' }}
            >
              <option>Delay (1/8 note tape-style echo)</option>
            </select>
          </label>

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
        </form>
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
