'use client'

import React, { useState, useEffect } from 'react'

// Declare Dropbox global
declare global {
  interface Window {
    Dropbox: {
      choose: (options: any) => void
    }
  }
}

interface DropboxFilePickerProps {
  onFilesSelected: (files: File[]) => void
  isMobile: boolean
}

export default function DropboxFilePicker({ onFilesSelected, isMobile }: DropboxFilePickerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropboxReady, setDropboxReady] = useState(false)

  useEffect(() => {
    // Use the EXACT approach from Dropbox official documentation
    const initDropbox = () => {
      // Check if already loaded
      if (window.Dropbox && typeof window.Dropbox.choose === 'function') {
        console.log('✅ Dropbox already loaded')
        setDropboxReady(true)
        return
      }

      // Check if script already exists
      const existingScript = document.getElementById('dropboxjs')
      if (existingScript) {
        console.log('📄 Dropbox script tag exists, waiting for API...')
        // Script exists, wait for it to initialize
        let attempts = 0
        const maxAttempts = 30
        const checkInterval = setInterval(() => {
          attempts++
          if (window.Dropbox && typeof window.Dropbox.choose === 'function') {
            console.log('✅ Dropbox API ready (existing script)')
            setDropboxReady(true)
            setError(null)
            clearInterval(checkInterval)
          } else if (attempts >= maxAttempts) {
            console.error('❌ Dropbox script exists but API never initialized')
            setError('Dropbox script loaded but not initializing. Check console for errors.')
            clearInterval(checkInterval)
          }
        }, 200)
        return () => clearInterval(checkInterval)
      }

      // Load the script using official Dropbox approach
      console.log('📥 Loading Dropbox script (official method)...')
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.src = 'https://www.dropbox.com/static/api/2/dropins.js'
      script.id = 'dropboxjs'
      script.setAttribute('data-app-key', 'tgtfykx9u7aqyn2')
      script.async = true

      script.onload = () => {
        console.log('✅ Dropbox script loaded')
        // Wait for Dropbox API to be available
        let attempts = 0
        const maxAttempts = 30
        const checkInterval = setInterval(() => {
          attempts++
          if (window.Dropbox && typeof window.Dropbox.choose === 'function') {
            console.log('✅ Dropbox.choose is available!')
            setDropboxReady(true)
            setError(null)
            clearInterval(checkInterval)
          } else if (attempts >= maxAttempts) {
            console.error('❌ Dropbox API failed to initialize')
            console.error('   window.Dropbox:', window.Dropbox)
            console.error('   typeof window.Dropbox:', typeof window.Dropbox)
            if (window.Dropbox) {
              console.error('   window.Dropbox keys:', Object.keys(window.Dropbox))
            }
            setError('Dropbox API not initializing. Check domain registration in Dropbox App Console.')
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

    initDropbox()
  }, [])

  const handleDropboxClick = () => {
    if (!dropboxReady) {
      setError('Dropbox not ready yet. Please wait...')
      return
    }

    if (!window.Dropbox || !window.Dropbox.choose) {
      setError('Dropbox API not available. Please refresh the page.')
      return
    }

    setIsLoading(true)
    setError(null)

    if (isMobile) {
      const proceed = confirm('📱 Mobile: Dropbox will open in a new tab. After selecting files, return to this page. Continue?')
      if (!proceed) {
        setIsLoading(false)
        return
      }
    }

    const currentHostname = window.location.hostname
    console.log('🔍 Current hostname:', currentHostname)
    console.log('⚠️ Make sure this is registered in Dropbox App Console:', currentHostname)

    // Use official Dropbox.choose API - exact format from documentation
    try {
      window.Dropbox.choose({
        success: async (files: any[]) => {
          console.log('✅ Files selected from Dropbox:', files.length)
          
          if (!files || files.length === 0) {
            setError('No files selected')
            setIsLoading(false)
            return
          }

          try {
            // Download and convert files
            const filePromises = files.map(async (file) => {
              console.log(`📥 Downloading: ${file.name}`)
              
              // Ensure direct download link
              let downloadLink = file.link
              if (downloadLink.includes('?dl=0') || downloadLink.includes('&dl=0')) {
                downloadLink = downloadLink.replace(/[?&]dl=0/g, '') + (downloadLink.includes('?') ? '&' : '?') + 'dl=1'
              } else if (!downloadLink.includes('dl=1')) {
                downloadLink += (downloadLink.includes('?') ? '&' : '?') + 'dl=1'
              }

              const response = await fetch(downloadLink, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
              })

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
              }

              const blob = await response.blob()
              
              // Determine MIME type
              let mimeType = blob.type
              if (!mimeType || mimeType === 'application/octet-stream') {
                const ext = file.name.toLowerCase().split('.').pop()
                if (ext === 'mp3') mimeType = 'audio/mpeg'
                else if (ext === 'wav') mimeType = 'audio/wav'
                else if (ext === 'm4a') mimeType = 'audio/mp4'
                else if (ext === 'aac') mimeType = 'audio/aac'
                else if (ext === 'ogg') mimeType = 'audio/ogg'
                else mimeType = 'audio/wav'
              }

              return new File([blob], file.name, { 
                type: mimeType,
                lastModified: Date.now()
              })
            })

            const fileObjects = await Promise.all(filePromises)
            console.log('✅ All files downloaded:', fileObjects.length)
            
            onFilesSelected(fileObjects)
            setIsLoading(false)
          } catch (err: any) {
            console.error('❌ Error downloading files:', err)
            setError(`Failed to download files: ${err?.message || 'Unknown error'}`)
            setIsLoading(false)
          }
        },
        cancel: () => {
          console.log('User cancelled Dropbox chooser')
          setIsLoading(false)
        },
        error: (errorMessage: string) => {
          console.error('❌ Dropbox error:', errorMessage)
          setIsLoading(false)
          
          const currentDomain = window.location.hostname
          if (errorMessage.includes('misconfigured') || errorMessage.includes('not configured') || errorMessage.includes('Could not communicate')) {
            setError(`Domain "${currentDomain}" must be registered in Dropbox App Console → Settings → "Chooser / Saver / Embedder domains". Add exactly "${currentDomain}" (no www, no protocol).`)
          } else {
            setError(`Dropbox error: ${errorMessage}`)
          }
        },
        linkType: 'direct',
        multiselect: true,
        extensions: ['audio'], // Use category instead of file extensions
        folderselect: false
      })
    } catch (err: any) {
      console.error('❌ Dropbox.choose error:', err)
      setError(`Failed to open Dropbox: ${err?.message || 'Unknown error'}`)
      setIsLoading(false)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        onClick={handleDropboxClick}
        disabled={isLoading || !dropboxReady}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#ffffff',
          color: dropboxReady ? '#B8001F' : '#999',
          border: `1px solid ${dropboxReady ? '#B8001F' : '#999'}`,
          borderRadius: '4px',
          cursor: (isLoading || !dropboxReady) ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          opacity: (isLoading || !dropboxReady) ? 0.7 : 1,
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {isLoading ? (
          <>
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #B8001F',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Loading...
          </>
        ) : !dropboxReady ? (
          <>📁 Dropbox (Loading...)</>
        ) : (
          <>📁 Dropbox</>
        )}
      </button>
      
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
          {error.includes('must be registered') && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                <li>Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#c62828', textDecoration: 'underline' }}>Dropbox App Console</a></li>
                <li>Select app with key: <code style={{ background: '#fff3cd', padding: '0.1rem 0.25rem' }}>tgtfykx9u7aqyn2</code></li>
                <li>Settings → "Chooser / Saver / Embedder domains"</li>
                <li>Add: <code style={{ background: '#fff3cd', padding: '0.1rem 0.25rem' }}>{window.location.hostname}</code></li>
                <li>Wait 2-3 minutes, then refresh</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
