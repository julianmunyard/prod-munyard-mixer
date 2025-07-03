'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState(null)
  const [userId, setUserId] = useState(null)
  const [projects, setProjects] = useState([])
  const router = useRouter()

  useEffect(() => {
    const getUserAndProjects = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserEmail(user.email || null)
      setUserId(user.id)

      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, title, artist_name, stems')
        .eq('user_id', user.id)

      if (songsError) console.error('Songs fetch error:', songsError)
      else setProjects(songs || [])
    }

    getUserAndProjects()
  }, [])

const handleDelete = async (songId, stems) => {
  const confirmed = window.confirm('Are you sure you want to delete this project?')
  if (!confirmed) return

  try {
    // SAFELY handle stem file paths
    const parsedStems = typeof stems === 'string' ? JSON.parse(stems) : stems

if (Array.isArray(stems)) {
  const deleteFilePaths = stems
    .map((stem) => {
      if (!stem || !stem.file) return null // 🛡️ protect against undefined
      const parts = stem.file.split('/')
      if (parts.length < 2) return null
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
    })
    .filter(Boolean) // remove nulls

      if (deleteFilePaths.length > 0) {
        const { error: storageError } = await supabase
          .storage
          .from('stems')
          .remove(deleteFilePaths)

        if (storageError) {
          console.error('Storage delete error:', storageError)
          alert('Could not delete files from storage.')
          return
        }
      }
    }

    // Delete from songs table
    const { error: dbError } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId)

    if (dbError) {
      console.error('DB delete error:', dbError)
      alert('Could not delete project from database.')
      return
    }

    // Update UI
    setProjects((prev) => prev.filter((p) => p.id !== songId))

  } catch (err) {
    console.error('Unexpected delete error:', err)
    alert('Something went wrong while deleting.')
  }
}



  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 1.5rem',
      fontFamily: 'Geist Mono, monospace',
      textAlign: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>
          Dashboard
        </h1>

{userEmail && (
  <p style={{ fontSize: '1rem', marginBottom: '2rem' }}>
    Welcome, {userEmail.split('@')[0].split('.')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].split('.')[0].slice(1)}
  </p>
)}


       {projects.length === 0 ? (
  <div style={{ marginBottom: '2rem' }}>
    <p style={{ fontSize: '1.25rem' }}>You don’t have any projects yet.</p>
  </div>
) : (
  <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
    <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Projects:</p>
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {projects.map((song) => (
        <li key={song.id} style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div
              onClick={() => router.push(`/mixers/${song.id}`)}
              style={{
                flexGrow: 1,
                padding: '1rem',
                border: '1px solid #ccc',
                borderRadius: '6px',
                backgroundColor: '#f5f5f5',
                cursor: 'pointer',
                color: 'black' // ✅ Sets all inner text to black
              }}
            >
              <strong>{song.title}</strong><br />
              <span>{song.artist_name}</span>
            </div>
<button
  type="button"
  onClick={() => handleDelete(song.id, song.stems)}
  style={{
    backgroundColor: '#B8001F',
    color: 'black',
    border: 'none',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '0.9rem'
  }}
>
  Delete
</button>

          </div>
        </li>
      ))}
    </ul>
  </div>
)}

        <button
          onClick={() => router.push('/')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#B8001F',
            color: 'white',
            fontSize: '1.25rem',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Create New Project
        </button>
      </div>
    </main>
  )
}
