'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

// Force dynamic rendering (no static generation)
export const dynamic = 'force-dynamic'

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState(null)
  const [userId, setUserId] = useState(null)
  const [projects, setProjects] = useState([])
  const [albums, setAlbums] = useState([])
  const [activeTab, setActiveTab] = useState('songs')
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.body.setAttribute('data-page', 'dashboard')
    return () => {
      document.body.removeAttribute('data-page')
    }
  }, [])

  useEffect(() => {
    const getUserAndProjects = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserEmail(user.email || null)
      setUserId(user.id)

      // Fetch all songs
      const { data: allSongs, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (songsError) {
        console.error('Error fetching songs:', songsError)
        setProjects([])
        setAlbums([])
        setLoading(false)
        return
      }

      if (!allSongs || allSongs.length === 0) {
        setProjects([])
        setAlbums([])
        setLoading(false)
        return
      }

      // Separate single songs from album songs
      const singleSongs = []
      const albumSongs = []

      allSongs.forEach(song => {
        if (song.album_id && song.album_id !== null && song.album_id !== '') {
          albumSongs.push(song)
        } else {
          singleSongs.push(song)
        }
      })

      setProjects(singleSongs)

      // Group album songs by album_id
      if (albumSongs.length > 0) {
        const albumMap = {}
        albumSongs.forEach(song => {
          const albumKey = song.album_id
          if (!albumMap[albumKey]) {
            albumMap[albumKey] = {
              album_id: albumKey,
              album_slug: song.album_slug || albumKey,
              album_title: song.album_title || 'Untitled Album',
              artist_name: song.artist_name,
              songs: []
            }
          }
          albumMap[albumKey].songs.push(song)
        })

        const albumsArray = Object.values(albumMap).map(album => ({
          ...album,
          songs: album.songs.sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
        }))

        setAlbums(albumsArray)
      } else {
        setAlbums([])
      }

      setLoading(false)
    }

    getUserAndProjects()
  }, [])

  const handleDelete = async (songId, stems) => {
    const confirmed = window.confirm('Are you sure you want to delete this project?')
    if (!confirmed) return

    try {
      const parsedStems = typeof stems === 'string' ? JSON.parse(stems) : stems

      if (Array.isArray(parsedStems)) {
        const deleteFilePaths = parsedStems
          .map((stem) => {
            if (!stem || !stem.file) return null
            const parts = stem.file.split('/')
            if (parts.length < 2) return null
            return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
          })
          .filter(Boolean)

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

      const { error: dbError } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId)

      if (dbError) {
        console.error('DB delete error:', dbError)
        alert('Could not delete project from database.')
        return
      }

      setProjects((prev) => prev.filter((p) => p.id !== songId))
      setAlbums((prev) => prev.map(album => ({
        ...album,
        songs: album.songs.filter(s => s.id !== songId)
      })).filter(album => album.songs.length > 0))

    } catch (err) {
      console.error('Unexpected delete error:', err)
      alert('Something went wrong while deleting.')
    }
  }

  if (loading) {
    return (
      <main
        style={{
          height: '100vh',
          backgroundColor: '#FFE5E5', // OLD COMPUTER page background
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            border: '4px solid #000000',
            borderTop: '4px solid transparent',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            animation: 'spin 1s linear infinite',
            boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#FFE5E5', // OLD COMPUTER pink background
        padding: '3rem 1.5rem',
        fontFamily: 'monospace',
        textAlign: 'center',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
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
          <span>DASHBOARD.EXE</span>
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
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'left' }}>
            Your mixes
          </h1>

          {userEmail && (
            <p style={{ fontSize: '0.95rem', marginBottom: '1.5rem', textAlign: 'left' }}>
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

          {/* Tabs */}
          <div
            style={{
              display: 'inline-flex',
              gap: '0',
              marginBottom: '1.5rem',
              border: '2px solid #000000',
              backgroundColor: '#D4C5B9',
            }}
          >
          <button
            onClick={() => setActiveTab('songs')}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: activeTab === 'songs' ? '#FFFFFF' : '#D4C5B9',
              color: '#000000',
              border: 'none',
              borderRight: '2px solid #000000',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              width: '50%',
              minWidth: '120px',
            }}
          >
            Songs
          </button>
          <button
            onClick={() => setActiveTab('albums')}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: activeTab === 'albums' ? '#FFFFFF' : '#D4C5B9',
              color: '#000000',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              width: '50%',
              minWidth: '120px',
            }}
          >
            Collections
          </button>
          </div>

        {activeTab === 'songs' ? (
          <>
            {projects.length === 0 ? (
              <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', border: '2px solid #000000', backgroundColor: '#FCFAEE', fontSize: '0.95rem' }}>
                You don't have any songs yet.
              </div>
            ) : (
              <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                <p style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>Your Songs</p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {projects.map((song) => (
                    <li key={song.id} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <div
                          onClick={() => {
                            if (song.artist_slug && song.song_slug) {
                              router.push(`/artist/${song.artist_slug}/${song.song_slug}`)
                            }
                          }}
                          style={{
                            flexGrow: 1,
                            padding: '0.75rem 0.9rem',
                            border: '2px solid #000000',
                            backgroundColor: '#FFFFFF',
                            cursor: 'pointer',
                            color: '#000000',
                            boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                          }}
                        >
                          <strong>{song.title}</strong><br />
                          <span style={{ fontSize: '0.85rem' }}>{song.artist_name}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <form onSubmit={(e) => e.preventDefault()}>
                            <button
                              type="button"
                              onClick={() => handleDelete(song.id, song.stems)}
                              style={{
                                backgroundColor: '#D4C5B9',
                                color: '#000000',
                                border: '2px solid #000000',
                                padding: '0.4rem 0.9rem',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontFamily: 'monospace',
                                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                              }}
                            >
                              Delete
                            </button>
                          </form>
                          <Link
                            href={`/artist/${song.artist_slug}/${song.song_slug}/edit`}
                            style={{
                              backgroundColor: '#D4C5B9',
                              color: '#000000',
                              border: '2px solid #000000',
                              padding: '0.4rem 0.9rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              textDecoration: 'none',
                              display: 'inline-block',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                            }}
                          >
                            Edit
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            {albums.length === 0 ? (
              <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', border: '2px solid #000000', backgroundColor: '#FCFAEE', fontSize: '0.95rem' }}>
                You don't have any collections yet.
              </div>
            ) : (
              <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
                <p style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>Your Collections</p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {albums.map((album) => {
                    const songIds = album.songs.map(s => s.id).join(',')
                    const albumUrl = `/album/${album.album_id}?songs=${songIds}`
                    
                    return (
                      <li key={album.album_id} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                          <div
                            onClick={() => router.push(albumUrl)}
                            style={{
                              flexGrow: 1,
                              padding: '0.75rem 0.9rem',
                              border: '2px solid #000000',
                              backgroundColor: '#FFFFFF',
                              cursor: 'pointer',
                              color: '#000000',
                              boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                            }}
                          >
                            <strong>{album.album_title}</strong><br />
                            <span style={{ fontSize: '0.85rem', color: '#444' }}>
                              {album.artist_name} • {album.songs.length} {album.songs.length === 1 ? 'song' : 'songs'}
                            </span>
                          </div>
                          <Link
                            href={`/premium/edit/${album.album_id}`}
                            style={{
                              backgroundColor: '#D4C5B9',
                              color: '#000000',
                              border: '2px solid #000000',
                              padding: '0.4rem 0.9rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              textDecoration: 'none',
                              display: 'inline-block',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                            }}
                          >
                            Edit
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        )}

          {/* Bottom actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button
            onClick={() => router.push('/create')}
            style={{
              padding: '0.45rem 1.1rem',
              backgroundColor: '#D4C5B9',
              color: '#000000',
              fontSize: '0.9rem',
              border: '2px solid #000000',
              cursor: 'pointer',
              fontFamily: 'monospace',
              boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
            }}
          >
            Create New Song
          </button>
          <button
            onClick={() => router.push('/premium/create')}
            style={{
              padding: '0.45rem 1.1rem',
              backgroundColor: '#D4C5B9',
              color: '#000000',
              fontSize: '0.9rem',
              border: '2px solid #000000',
              cursor: 'pointer',
              fontFamily: 'monospace',
              boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
            }}
          >
            Create Collection
          </button>
          </div>
        </div>
      </div>
    </main>
  )
}
