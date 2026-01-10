'use client'

import React, { useState, useEffect } from 'react'

interface DropboxFilePickerProps {
  onFilesSelected: (files: File[]) => void
  isMobile: boolean
}

const APP_KEY = 'tgtfykx9u7aqyn2'

export default function DropboxFilePicker({ onFilesSelected, isMobile }: DropboxFilePickerProps) {
  const [loader, setLoader] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropboxReady, setDropboxReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Manually load Dropbox script (like the working CodeSandbox does internally)
    const loadDropbox = () => {
      // Check if already loaded
      if ((window as any).Dropbox && typeof (window as any).Dropbox.choose === 'function') {
        console.log('✅ Dropbox already available')
        setDropboxReady(true)
        return
      }

      // Check if script already exists
      const existingScript = document.getElementById('dropboxjs')
      if (existingScript) {
        console.log('📄 Dropbox script exists, waiting for API...')
        let attempts = 0
        const maxAttempts = 30
        const checkInterval = setInterval(() => {
          attempts++
          if ((window as any).Dropbox && typeof (window as any).Dropbox.choose === 'function') {
            console.log('✅ Dropbox API ready!')
            setDropboxReady(true)
            clearInterval(checkInterval)
          } else if (attempts >= maxAttempts) {
            console.error('❌ Dropbox API never initialized')
            setError('Dropbox failed to initialize. Check console for errors.')
            clearInterval(checkInterval)
          }
        }, 200)
        return () => clearInterval(checkInterval)
      }

      // Load the script manually
      console.log('📥 Loading Dropbox script manually...')
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.src = 'https://www.dropbox.com/static/api/2/dropins.js'
      script.id = 'dropboxjs'
      script.setAttribute('data-app-key', APP_KEY)
      script.async = true

      script.onload = () => {
        console.log('✅ Dropbox script loaded, waiting for API...')
        // Wait for API to be available
        let attempts = 0
        const maxAttempts = 30
        const checkInterval = setInterval(() => {
          attempts++
          if ((window as any).Dropbox && typeof (window as any).Dropbox.choose === 'function') {
            console.log('✅ Dropbox.choose is available!')
            setDropboxReady(true)
            setError(null)
            clearInterval(checkInterval)
          } else if (attempts >= maxAttempts) {
            console.error('❌ Dropbox API failed to initialize after script load')
            setError('Dropbox API not initializing. Domain may not be registered or needs time to propagate.')
            clearInterval(checkInterval)
          }
        }, 200)
      }

      script.onerror = () => {
        console.error('❌ Failed to load Dropbox script')
        setError('Failed to load Dropbox script. Check your internet connection.')
      }

      document.head.appendChild(script)
    }

    loadDropbox()
  }, [])

  function handleSuccess(files: any[]) {
    console.log('files >> ', files)
    
    if (!files || files.length === 0) {
      setError('No files selected')
      return
    }

    let promiseArray: Promise<File>[] = []
    setLoader(true)
    setError(null)

    files.forEach((file) => {
      promiseArray.push(
        fetch(file.link, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
          credentials: 'same-origin',
          headers: {},
          referrer: 'no-referrer'
        })
          .then((x) => x.blob())
          .then((response) => {
            console.log('response >> ', response)
            
            // Determine MIME type
            let mimeType = response.type
            if (!mimeType || mimeType === 'application/octet-stream') {
              const ext = file.name.toLowerCase().split('.').pop()
              if (ext === 'mp3') mimeType = 'audio/mpeg'
              else if (ext === 'wav') mimeType = 'audio/wav'
              else if (ext === 'm4a') mimeType = 'audio/mp4'
              else if (ext === 'aac') mimeType = 'audio/aac'
              else if (ext === 'ogg') mimeType = 'audio/ogg'
              else mimeType = 'audio/wav'
            }

            return new File([response], file.name, { 
              type: mimeType,
              lastModified: Date.now()
            })
          })
          .catch((err) => {
            console.log('error fetching file from url ', err)
            throw err
          })
      )
    })

    Promise.all(promiseArray)
      .then((fileObjects) => {
        console.log('all the files downloaded successfully !!')
        setLoader(false)
        onFilesSelected(fileObjects)
      })
      .catch((err) => {
        console.log('some error in downloading files')
        setLoader(false)
        setError(`Failed to download files: ${err?.message || 'Unknown error'}`)
      })
  }

  const handleClick = () => {
    if (!dropboxReady) {
      setError('Dropbox not ready yet. Please wait...')
      return
    }

    if (!(window as any).Dropbox || !(window as any).Dropbox.choose) {
      setError('Dropbox API not available. Please refresh the page.')
      return
    }

    console.log('🔘 Opening Dropbox chooser...')
    setError(null)

    try {
      (window as any).Dropbox.choose({
        success: handleSuccess,
        linkType: 'direct',
        cancel: () => console.log('closed'),
        folderselect: false,
        multiselect: true,
        extensions: ['.mp3', '.wav', '.m4a', '.aac', '.ogg']
      })
    } catch (err: any) {
      console.error('❌ Dropbox.choose error:', err)
      setError(`Failed to open Dropbox: ${err?.message || 'Unknown error'}`)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      {loader ? (
        <div style={{
          backgroundColor: 'rgba(26, 25, 25, 0.37)',
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 9999
        }}>
          <div style={{
            color: '#fff',
            fontSize: '1.2rem'
          }}>
            Downloading files...
          </div>
        </div>
      ) : null}
      
      <div
        style={{
          border: '3px dotted black',
          cursor: dropboxReady ? 'pointer' : 'not-allowed',
          padding: '0.5rem 1rem',
          textAlign: 'center',
          opacity: dropboxReady ? 1 : 0.7
        }}
        onClick={handleClick}
      >
        <span style={{ cursor: dropboxReady ? 'pointer' : 'not-allowed', userSelect: 'none' }}>
          {dropboxReady ? '📁 Dropbox' : '📁 Dropbox (Loading...)'}
        </span>
      </div>
      
      {error && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          border: '1px solid #ffcdd2',
          borderRadius: '4px',
          fontSize: '0.85rem',
          lineHeight: '1.4',
        }}>
          <strong>⚠️ Dropbox Error:</strong> {error}
        </div>
      )}
    </div>
  )
}
