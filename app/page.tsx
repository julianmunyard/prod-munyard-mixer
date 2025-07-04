'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

import './globals.css'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import axios, { AxiosProgressEvent } from 'axios'

export default function Home() {
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
      setLocked(false) // ✅ unlock immediately
    } else {
      alert('Please verify your email before continuing.')
      router.push('/login')
    }
  }

  getUser()
}, [])



  const uploadFileWithProgress = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const cleanName = file.name.replace(/\.[^/.]+$/, '')
    const filePath = `${userEmail}/${uuidv4()}.${fileExt}`

    const { data: signed, error: signedError } = await supabase
      .storage
      .from('stems')
      .createSignedUploadUrl(filePath)

    if (signedError || !signed) {
      throw new Error('Failed to get signed URL')
    }

    await axios.put(signed.signedUrl, file, {
      headers: {
        'Content-Type': file.type || 'audio/wav',
        'Content-Length': `${file.size}`
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        const percent = progressEvent.total
          ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
          : 0;
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

    let uploadedStemUrls: { label: string; file: string }[] = []

    if (stems && stems.length > 0) {
      for (let i = 0; i < stems.length; i++) {
        const file = stems[i]
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

        try {
          const publicUrl = await uploadFileWithProgress(file)
          uploadedStemUrls.push({
            label: file.name,
            file: publicUrl,
          })
        } catch (err) {
          console.error('Upload failed:', err)
          alert('One of your files failed to upload.')
          setIsSubmitting(false)
          return
        }
      }
    }

    const { data, error: insertError } = await supabase
      .from('songs')
      .insert({
        user_id: user.id,
        artist_name: artistName,
        title: projectTitle,
        effects: [effect],
        color,
        stems: uploadedStemUrls,
      })
      .select()
      .single()

    if (insertError || !data) {
      console.error('❌ Insert error:', insertError?.message)
      alert('Error saving your project.')
      setIsSubmitting(false)
    } else {
      console.log('✅ Inserted song:', data)
      router.push(`/mixers/${data.id}`)
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
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>
          UPLOAD STEMS
        </h1>

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
            <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>{file}</div>
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
            Choose Your Mixer Color
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ padding: '0.5rem', width: '100%', backgroundColor: 'white', color: 'black' }}
            >
              <option>Red (Classic)</option>
            </select>
          </label>

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
