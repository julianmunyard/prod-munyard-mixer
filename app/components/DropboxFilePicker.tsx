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
  
  // Get the correct origin for Dropbox - must match Dropbox app console settings
  const getDropboxOrigin = () => {
    if (typeof window === 'undefined') return 'https://munyardmixer.com'
    
    const origin = window.location.origin
    console.log('Current origin:', origin)
    
    // For localhost development, you need to add localhost:3000 to Dropbox app settings
    // For production, use https://munyardmixer.com
    return origin
  }

  useEffect(() => {
    // Load Dropbox script dynamically
    const loadDropboxScript = async () => {
      try {
        // Check if already loaded
        if (window.Dropbox && window.Dropbox.choose) {
          setDropboxReady(true)
          setError(null)
          return
        }

        // Check if script already exists
        const existingScript = document.getElementById('dropboxjs')
        if (existingScript) {
          // Script exists but Dropbox not ready, wait a bit
          setTimeout(() => {
            if (window.Dropbox && window.Dropbox.choose) {
              setDropboxReady(true)
              setError(null)
            } else {
              setError('Dropbox script loaded but not ready')
            }
          }, 2000)
          return
        }

        // Try multiple approaches to load Dropbox script
        const loadScript = (src: string) => {
          return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.id = 'dropboxjs'
            script.src = src
            script.setAttribute('data-app-key', 'tgtfykx9u7aqyn2')
            // NOTE: Do NOT set data-origin - let Dropbox auto-detect from registered domain
            // The domain 'munyardmixer.com' is registered in "Chooser / Saver / Embedder domains"
            // Setting data-origin explicitly can cause "Could not communicate" errors
            console.log('Dropbox script loaded, domain registered: munyardmixer.com')
            script.async = true
            script.crossOrigin = 'anonymous'

            script.onload = () => {
              console.log(`Dropbox script loaded from ${src}`)
              resolve(true)
            }

            script.onerror = () => {
              console.error(`Failed to load Dropbox script from ${src}`)
              reject(new Error(`Failed to load from ${src}`))
            }

            document.head.appendChild(script)
          })
        }

        // Try different sources
        const sources = [
          'https://www.dropbox.com/static/api/2/dropins.js',
          'https://dropbox.com/static/api/2/dropins.js',
          'https://www.dropbox.com/static/api/2/dropins.js?t=' + Date.now()
        ]

        let loaded = false
        for (const src of sources) {
          try {
            await loadScript(src)
            loaded = true
            break
          } catch (err) {
            console.log(`Failed to load from ${src}, trying next...`)
          }
        }

        if (!loaded) {
          setError('Failed to load Dropbox script from any source')
          return
        }

        // Wait for Dropbox to initialize
        setTimeout(() => {
          if (window.Dropbox && window.Dropbox.choose) {
            setDropboxReady(true)
            setError(null)
            console.log('Dropbox ready')
          } else {
            setError('Dropbox script loaded but API not available')
          }
        }, 2000)
      } catch (err) {
        setError(`Error loading Dropbox: ${err}`)
      }
    }

    loadDropboxScript()
  }, [])

  const handleDropboxClick = () => {
    if (!dropboxReady) {
      setError('Dropbox not ready. Please refresh the page.')
      return
    }

    setIsLoading(true)
    setError(null)

    // For mobile, show a helpful message before opening
    if (isMobile) {
      const proceed = confirm('📱 Mobile: Dropbox will open in a new tab. After selecting files, return to this page. Continue?')
      if (!proceed) {
        setIsLoading(false)
        return
      }
    }

    // Get the current origin - must match what's in Dropbox Redirect URIs
    const currentOrigin = getDropboxOrigin()
    console.log('Using origin for Dropbox chooser:', currentOrigin)
    
    // Use the exact approach from Dropbox article
    const options = {
      success: (files: any[]) => {
        console.log('✅ Dropbox success callback triggered!')
        console.log('Files selected:', files)
        console.log('File details:', files.map(f => ({ name: f.name, link: f.link, bytes: f.bytes })))
        console.log('Number of files:', files.length)
        
        // Convert Dropbox files to File objects
        const filePromises = files.map(async (file, index) => {
          try {
            console.log(`Downloading file ${index + 1}: ${file.name}`)
            console.log(`Link: ${file.link}`)
            
            // Convert Dropbox link to direct download format
            // Dropbox chooser returns links like: https://www.dropbox.com/s/xxxxx/file.mp3?dl=0
            // We need to convert to: https://www.dropbox.com/s/xxxxx/file.mp3?dl=1 for direct download
            let downloadLink = file.link
            if (downloadLink.includes('?dl=0')) {
              downloadLink = downloadLink.replace('?dl=0', '?dl=1')
            } else if (!downloadLink.includes('?dl=')) {
              downloadLink = downloadLink + (downloadLink.includes('?') ? '&' : '?') + 'dl=1'
            }
            
            console.log(`Using download link: ${downloadLink}`)
            
            // Fetch the file from Dropbox using direct download link
            // Note: Dropbox direct download links should work without CORS issues
            const response = await fetch(downloadLink, {
              method: 'GET',
              mode: 'cors',
              credentials: 'omit',
              headers: {
                'Accept': '*/*',
              }
            })
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            
            const blob = await response.blob()
            console.log(`Downloaded ${file.name}: ${blob.size} bytes, type: ${blob.type}`)
            
            // Determine MIME type from file extension if blob type is generic
            let mimeType = blob.type
            if (!mimeType || mimeType === 'application/octet-stream') {
              const ext = file.name.toLowerCase().split('.').pop()
              if (ext === 'mp3') mimeType = 'audio/mpeg'
              else if (ext === 'wav') mimeType = 'audio/wav'
              else if (ext === 'm4a') mimeType = 'audio/mp4'
              else mimeType = 'audio/wav' // default
            }
            
            return new File([blob], file.name, { 
              type: mimeType,
              lastModified: Date.now()
            })
          } catch (err: any) {
            console.error(`Error downloading file ${file.name}:`, err)
            throw new Error(`Failed to download ${file.name}: ${err?.message || 'Unknown error'}`)
          }
        })

        Promise.all(filePromises)
          .then((fileObjects) => {
            console.log('All files downloaded successfully:', fileObjects.map(f => f.name))
            onFilesSelected(fileObjects)
            setIsLoading(false)
          })
          .catch((err) => {
            console.error('Download error:', err)
            setError(`Failed to download files: ${err.message}`)
            setIsLoading(false)
          })
      },
      cancel: () => {
        console.log('User cancelled Dropbox chooser')
        setIsLoading(false)
      },
      linkType: 'direct',
      multiselect: true,
      extensions: ['audio'],
      folderselect: false
      // NOTE: Do NOT include 'origin' parameter for Chooser
      // The domain is registered in "Chooser / Saver / Embedder domains" (munyardmixer.com)
      // Dropbox automatically detects the origin from the page context
      // Including 'origin' parameter can cause "Could not communicate" errors
    }
    
    console.log('Dropbox chooser options:', { 
      linkType: options.linkType, 
      multiselect: options.multiselect,
      extensions: options.extensions,
      currentPageOrigin: currentOrigin
    })
    console.log('ℹ️ Using domain from "Chooser / Saver / Embedder domains": munyardmixer.com')

    // Use Dropbox.choose directly as shown in the article
    try {
      if (window.Dropbox && window.Dropbox.choose) {
        window.Dropbox.choose(options)
      } else {
        throw new Error('Dropbox not available')
      }
    } catch (err) {
      console.error('Dropbox error:', err)
      setError(`Dropbox error: ${err.message || err}`)
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
          <>
            📁 Dropbox (Loading...)
          </>
        ) : (
          <>
            📁 Dropbox
          </>
        )}
      </button>
      
      {error && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          border: '1px solid #ffcdd2',
          borderRadius: '4px',
          fontSize: '0.8rem',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
