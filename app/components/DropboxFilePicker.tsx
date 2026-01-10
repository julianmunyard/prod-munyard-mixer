'use client'

import React, { useState, useEffect } from 'react'
import DropboxChooser from 'react-dropbox-chooser'

interface DropboxFilePickerProps {
  onFilesSelected: (files: File[]) => void
  isMobile: boolean
}

export default function DropboxFilePicker({ onFilesSelected, isMobile }: DropboxFilePickerProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropboxReady, setDropboxReady] = useState(false)

  // Check if Dropbox script is loaded
  useEffect(() => {
    if (typeof window === 'undefined') return

    console.log('🔍 Checking for Dropbox script...')
    
    // Check if script exists
    const script = document.getElementById('dropboxjs')
    if (script) {
      console.log('✅ Dropbox script tag found')
      
      // Wait for Dropbox API to be available
      let attempts = 0
      const maxAttempts = 20
      const checkInterval = setInterval(() => {
        attempts++
        if (window.Dropbox && typeof (window as any).Dropbox.choose === 'function') {
          console.log('✅ Dropbox API is ready!')
          setDropboxReady(true)
          clearInterval(checkInterval)
        } else if (attempts >= maxAttempts) {
          console.error('❌ Dropbox API not available after 4 seconds')
          setError('Dropbox not loading. Check domain registration and browser console.')
          clearInterval(checkInterval)
        }
      }, 200)
      
      return () => clearInterval(checkInterval)
    } else {
      console.warn('⚠️ Dropbox script tag not found - react-dropbox-chooser should add it')
      // Give it a moment to load
      setTimeout(() => {
        const scriptAfterDelay = document.getElementById('dropboxjs')
        if (!scriptAfterDelay) {
          setError('Dropbox script not loading. Check browser console for errors.')
        }
      }, 2000)
    }
  }, [])

  const handleSuccess = async (files: any[]) => {
    console.log('✅ Dropbox success callback triggered!')
    console.log('✅ Files selected from Dropbox:', files)
    
    if (!files || files.length === 0) {
      setError('No files selected')
      return
    }

    setIsDownloading(true)
    setError(null)

    try {
      // Download and convert files
      const filePromises = files.map(async (file: any) => {
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
      setIsDownloading(false)
    } catch (err: any) {
      console.error('❌ Error downloading files:', err)
      setError(`Failed to download files: ${err?.message || 'Unknown error'}`)
      setIsDownloading(false)
    }
  }

  const handleCancel = () => {
    console.log('User cancelled Dropbox chooser')
    setIsDownloading(false)
  }

  return (
    <div style={{ width: '100%' }}>
      <DropboxChooser
        appKey="tgtfykx9u7aqyn2"
        success={handleSuccess}
        cancel={handleCancel}
        multiselect={true}
        extensions={['.mp3', '.wav', '.m4a', '.aac', '.ogg']}
        linkType="direct"
      >
        <button
          type="button"
          disabled={isDownloading}
          onClick={() => {
            console.log('🔘 Dropbox button clicked!')
            console.log('   Dropbox script exists?', !!document.getElementById('dropboxjs'))
            console.log('   window.Dropbox exists?', !!(window as any).Dropbox)
            if ((window as any).Dropbox) {
              console.log('   window.Dropbox.choose exists?', typeof (window as any).Dropbox.choose === 'function')
            }
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#ffffff',
            color: '#B8001F',
            border: '1px solid #B8001F',
            borderRadius: '4px',
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: isDownloading ? 0.7 : 1,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {isDownloading ? (
            <>
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid #B8001F',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Downloading...
            </>
          ) : !dropboxReady ? (
            <>📁 Dropbox (Loading...)</>
          ) : (
            <>📁 Dropbox</>
          )}
        </button>
      </DropboxChooser>
      
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
          {error.includes('must be registered') && typeof window !== 'undefined' && (
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
