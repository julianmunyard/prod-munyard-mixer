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
import MiniMixerPreview from '../components/MiniMixerPreview'
import DropboxFilePicker from '../components/DropboxFilePicker'
import { convertToMp3 } from '@/lib/convertToMp3';




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
  // NOTE: Theme selection is temporarily locked to OLD COMPUTER.
  // The old color options & theme dropdown UI are kept below but commented out.
  const [color, setColor] = useState('OLD COMPUTER')
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
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#B8001F') // default accent; UI picker disabled for now
  const [showThemeDropdown, setShowThemeDropdown] = useState(false) // kept for future use (theme dropdown disabled)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [hasWavs, setHasWavs] = useState(false)
  const [convertStatus, setConvertStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [dotCount, setDotCount] = useState(0)
  const [fileSource, setFileSource] = useState<'device' | 'dropbox'>('device')
  const [showFileSourceDropdown, setShowFileSourceDropdown] = useState(false)
  
  // Mobile detection
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setShowFileSourceDropdown(false)
        // Theme dropdown is currently disabled, but we keep this for future re-enable.
        setShowThemeDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])



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

  // Cleanup video preview URL
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



  
const handleDropboxFiles = (files: File[]) => {
  // Mobile memory optimization: limit stems to 15
  const maxStemsForMobile = 15
  let processedFiles = files
  
  if (isMobile && files.length > maxStemsForMobile) {
    processedFiles = files.slice(0, maxStemsForMobile)
    alert(`📱 Mobile detected: Limited to ${maxStemsForMobile} stems for memory optimization. Only the first ${maxStemsForMobile} files will be used.`)
  }
  
  // Create a FileList from the array of Files
  const newFileList = new DataTransfer()
  processedFiles.forEach(file => newFileList.items.add(file))
  
  setStems(newFileList.files)
  setUploadedFiles(processedFiles.map((file) => file.name))

  // Check for .wav files
  const wavDetected = processedFiles.some((file) =>
    file.name.toLowerCase().endsWith('.wav') || file.type === 'audio/wav'
  )
  setHasWavs(wavDetected)
}

const handleConvertAllToMp3 = async () => {
  if (!stems) return

  setConvertStatus('uploading')
  setDotCount(0)

  const interval = setInterval(() => {
    setDotCount((prev) => (prev >= 3 ? 0 : prev + 1))
  }, 500)

  const convertedFiles: File[] = []

  for (let i = 0; i < stems.length; i++) {
    const file = stems[i]
    if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
      try {
const ogg = await convertToMp3(file)
convertedFiles.push(ogg)
      } catch (err) {
        clearInterval(interval)
        setDotCount(0) // ✅ fix: reset dots on error too
        console.error(`Failed to convert ${file.name}:`, err)
        alert(`Conversion failed for ${file.name}`)
        setConvertStatus('idle')
        return
      }
    } else {
      convertedFiles.push(file)
    }
  }

  clearInterval(interval)
  setConvertStatus('done')

  // Replace WAVs with converted MP3s
  const newFileList = new DataTransfer()
  convertedFiles.forEach((f) => newFileList.items.add(f))
  setStems(newFileList.files)
  setUploadedFiles(Array.from(newFileList.files).map((f) => f.name))

  // ✅ Wait 3 seconds before hiding the button
  setTimeout(() => {
    setConvertStatus('idle')
    setDotCount(0)
    setHasWavs(false)
  }, 3000)
}




const uploadFileWithProgress = async (file: File): Promise<string> => {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const fileExt = safeName.split('.').pop() || 'wav'
  const filePath = `${userEmail}/${uuidv4()}.${fileExt}`

  console.log('🚀 Uploading file...')
  console.log('🧾 Name:', file.name)
  console.log('📂 Type:', file.type)
  console.log('📏 Size (MB):', (file.size / 1024 / 1024).toFixed(2))

  // Set initial progress to 0%
  setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

  const { data: signed, error: signedError } = await supabase
    .storage
    .from('stems')
    .createSignedUploadUrl(filePath)

  if (signedError || !signed) {
    console.error('❌ Failed to get signed URL:', signedError)
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
    console.error('🔥 Direct upload failed:', error)
    setUploadError('File too large or upload rejected. Try converting to MP3.')
    throw error
  }
  
  // Ensure final 100%
  setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))

  const { data: publicData } = supabase.storage.from('stems').getPublicUrl(filePath)
  if (!publicData || !publicData.publicUrl) {
    console.error('⚠️ Failed to get public URL')
    throw new Error('Could not retrieve public URL')
  }

  return publicData.publicUrl
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

      let processedFile = file

 if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
  try {
    console.log(`🎛 Converting ${file.name} to OGG...`)
    processedFile = await convertToMp3(file)
    console.log('✅ Conversion complete:', processedFile.name)
  } catch (err) {
    console.error('❌ OGG conversion failed:', err)
    alert('Failed to convert WAV to OGG.')
    setIsSubmitting(false)
    return
  }
}

      try {
        const publicUrl = await uploadFileWithProgress(processedFile)
        uploadedStemUrls.push({ label: stemNames[i]?.trim() || processedFile.name, file: publicUrl })
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

    const { data, error: insertError } = await supabase
      .from('songs')
      .insert({
        user_id: user.id,
        artist_name: artistName,
        title: projectTitle,
        effects:
          effect.includes('Delay')
            ? 'delay'
            : effect.includes('Phaser')
            ? 'phaser'
            : null,
        color,
        primary_color: primaryColor, // ✅ ADD THIS
        // Force all mixers created from this page to use the OLD COMPUTER page theme.
        page_theme: 'OLD COMPUTER',
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
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '3rem 1.5rem 6rem',
        fontFamily: 'monospace',
        textAlign: 'center',
        backgroundColor: '#FFE5E5', // OLD COMPUTER pink
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >

      {/* Outer "window" frame to match OLD COMPUTER mixer/album aesthetic */}
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          border: '3px solid #000000',
          backgroundColor: '#D4C5B9',
          boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
          textAlign: 'left',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 0.9rem',
            borderBottom: '3px solid #000000',
            backgroundColor: '#C0C0C0',
            fontWeight: 'bold',
            fontSize: '0.9rem',
          }}
        >
          <span>CREATE-MIX.EXE</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
          </div>
        </div>

        {/* Content area */}
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#FFFFFF',
            borderTop: '2px solid #000000',
          }}
        >
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Upload stems</h1>

        {userEmail && (
          <p style={{ marginBottom: '1.25rem', fontSize: '0.95rem' }}>
            Logged in as{' '}
            <span style={{ fontWeight: 'bold' }}>
              {userEmail
                .split('@')[0]
                .split('.')[0]
                .charAt(0)
                .toUpperCase() + userEmail.split('@')[0].split('.')[0].slice(1)}
            </span>
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>


          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              Artist name
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                style={{
                  marginTop: '0.25rem',
                  padding: '0.45rem 0.5rem',
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  border: '2px solid #000000',
                  fontFamily: 'monospace',
                }}
              />
            </label>

            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              Project title
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                style={{
                  marginTop: '0.25rem',
                  padding: '0.45rem 0.5rem',
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  border: '2px solid #000000',
                  fontFamily: 'monospace',
                }}
              />
            </label>

            <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              BPM (optional)
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
                  marginTop: '0.25rem',
                  padding: '0.45rem 0.5rem',
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  border: '2px solid #000000',
                  fontFamily: 'monospace',
                }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
            <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
              Choose stems (WAV/MP3)
            </label>
            
            {/* File Source Dropdown */}
            <div style={{ position: 'relative', width: '100%' }} data-dropdown>
              <div
                onClick={() => setShowFileSourceDropdown(!showFileSourceDropdown)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.5rem',
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  border: '2px solid #000000',
                  cursor: 'pointer',
                  appearance: 'none',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                }}
              >
                <span>
                  {fileSource === 'device' ? '📱 From this device' : '📁 From Dropbox'}
                </span>
                <span style={{ fontSize: '0.8rem' }}>▼</span>
              </div>

              {showFileSourceDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    width: '100%',
                    backgroundColor: '#FFFFFF',
                    border: '2px solid #000000',
                    zIndex: 10,
                    fontSize: '0.9rem',
                    boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                  }}
                >
                  <div
                    onClick={() => {
                      setFileSource('device')
                      setShowFileSourceDropdown(false)
                    }}
                    style={{
                      padding: '0.45rem 0.5rem',
                      cursor: 'pointer',
                      backgroundColor: fileSource === 'device' ? '#E0E0E0' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    📱 From This Device
                  </div>
                  <div
                    onClick={() => {
                      setFileSource('dropbox')
                      setShowFileSourceDropdown(false)
                    }}
                    style={{
                      padding: '0.45rem 0.5rem',
                      cursor: 'pointer',
                      backgroundColor: fileSource === 'dropbox' ? '#E0E0E0' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    📁 From Dropbox
                  </div>
                </div>
              )}
            </div>

            {/* File Upload Button */}
            {fileSource === 'device' ? (
              <div style={{ width: '100%' }}>
                <label
                  htmlFor="file-upload"
                  style={{
                    padding: '0.45rem 1rem',
                    backgroundColor: '#D4C5B9',
                    color: '#000000',
                    border: '2px solid #000000',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    display: 'block',
                    textAlign: 'center',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                    boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                  }}
                >
                  Choose files
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".mp3,.wav,audio/*"
                  multiple
                  ref={fileInputRef}
                  onChange={(e) => {
                    const selected = e.target.files
                    if (selected) {
                      // Mobile memory optimization: limit stems to 15
                      const maxStemsForMobile = 15
                      let processedFiles = selected
                      
                      if (isMobile && selected.length > maxStemsForMobile) {
                        // Create a new FileList with only the first 15 files
                        const limitedFiles = Array.from(selected).slice(0, maxStemsForMobile)
                        const newFileList = new DataTransfer()
                        limitedFiles.forEach(file => newFileList.items.add(file))
                        processedFiles = newFileList.files
                        
                        // Show warning
                        alert(`📱 Mobile detected: Limited to ${maxStemsForMobile} stems for memory optimization. Only the first ${maxStemsForMobile} files will be used.`)
                      }
                      
                      setStems(processedFiles)
                      setUploadedFiles(Array.from(processedFiles).map((file) => file.name))

                      // Check for .wav files
                      const wavDetected = Array.from(processedFiles).some((file) =>
                        file.name.toLowerCase().endsWith('.wav') || file.type === 'audio/wav'
                      )
                      setHasWavs(wavDetected)
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div style={{ width: '100%' }}>
                <DropboxFilePicker onFilesSelected={handleDropboxFiles} isMobile={isMobile} />
              </div>
            )}

            <span style={{ fontSize: '0.8rem', color: '#555', textAlign: 'left', marginTop: '0.25rem' }}>
              ⚠️ Use MP3s for faster uploads, or WAVs under 50MB.
              {isMobile && (
                <><br />📱 Mobile: limited to 15 stems for memory optimization.</>
              )}
            </span>
            
            {stems && (
              <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#444' }}>
                {stems.length} file{stems.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>



          

          {uploadedFiles.length > 0 && (
            <div style={{ width: '100%' }}>
              <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block', fontSize: '0.9rem' }}>
                Uploading files
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


{hasWavs && (
  <button
    type="button"
    onClick={handleConvertAllToMp3}
    disabled={convertStatus === 'uploading'}
    style={{
      marginTop: '1rem',
      padding: '0.6rem 1rem',
      backgroundColor: '#D4C5B9',
      color: '#000000',
      border: '2px solid #000000',
      fontSize: '1rem',
      borderRadius: '4px',
      cursor: convertStatus === 'uploading' ? 'not-allowed' : 'pointer',
    }}
  >
    {convertStatus === 'idle' && 'UPLOAD'}
    {convertStatus === 'uploading' && (dotCount === 0 ? 'UPLOADING' : `UPLOADING ${'.'.repeat(dotCount)}`)}
    {convertStatus === 'done' && 'DONE!'}
  </button>
)}

{/* 🎨 Mixer theme selection is locked to OLD COMPUTER for now.
    The previous dropdown + color picker UI are kept below but commented out for future use. */}
<div style={{ width: '100%', marginTop: '1.5rem', textAlign: 'left' }}>
  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
    Mixer Theme
  </label>
  <div
    style={{
      width: '100%',
      padding: '0.5rem',
      backgroundColor: 'white',
      color: 'black',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '0.9rem',
    }}
  >
    OLD COMPUTER (locked)
  </div>
</div>

{/* Legacy theme dropdown, color picker, and background video UI removed from JSX
    but preserved elsewhere in this file if needed in the future. */}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#D4C5B9',
              color: '#000000',
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
              border: '2px solid #000000',
              color: '#000000',
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

      {/* Close outer window frame */}
    </div>

    </main>
  )
}
