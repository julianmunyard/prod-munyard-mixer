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
    console.log('⚠️ IMPORTANT: Make sure this origin is registered in Dropbox App Console!')
    console.log('   Development: http://localhost:3000 (or your dev port)')
    console.log('   Production: https://munyardmixer.com')
    
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
          // Script exists but Dropbox not ready, poll until ready
          let attempts = 0
          const maxAttempts = 10
          const checkInterval = setInterval(() => {
            attempts++
            if (window.Dropbox && window.Dropbox.choose) {
              setDropboxReady(true)
              setError(null)
              console.log('✅ Dropbox ready (existing script)')
              clearInterval(checkInterval)
            } else if (attempts >= maxAttempts) {
              setError('Dropbox script loaded but API not available. Please refresh the page.')
              clearInterval(checkInterval)
            }
          }, 200)
          
          return () => clearInterval(checkInterval)
        }

        // Try multiple approaches to load Dropbox script
        const loadScript = (src: string) => {
          return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.id = 'dropboxjs'
            script.src = src
            script.setAttribute('data-app-key', 'tgtfykx9u7aqyn2')
            // NOTE: Do NOT set data-origin attribute
            // Dropbox will auto-detect origin from window.location.origin
            // The origin must be registered in Dropbox App Console > Settings > "Chooser / Saver / Embedder domains"
            // For development: add "localhost" (without http://, without port - Dropbox handles all ports automatically)
            // For production: add "munyardmixer.com" (without https://)
            console.log('Loading Dropbox script with app key: tgtfykx9u7aqyn2')
            console.log('Current origin will be:', window.location.origin)
            console.log('⚠️ Make sure this origin is registered in Dropbox App Console!')
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

        // Wait for Dropbox to initialize - check multiple times
        let attempts = 0
        const maxAttempts = 10
        const checkInterval = setInterval(() => {
          attempts++
          if (window.Dropbox && window.Dropbox.choose) {
            setDropboxReady(true)
            setError(null)
            console.log('✅ Dropbox ready after', attempts * 200, 'ms')
            clearInterval(checkInterval)
          } else if (attempts >= maxAttempts) {
            setError('Dropbox script loaded but API not available. Please refresh the page.')
            clearInterval(checkInterval)
          }
        }, 200)
        
        // Cleanup interval on unmount
        return () => clearInterval(checkInterval)
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

    // Verify Dropbox is available
    if (!window.Dropbox || !window.Dropbox.choose) {
      setError('Dropbox API not available. Please refresh the page.')
      setIsLoading(false)
      return
    }

    const currentOrigin = getDropboxOrigin()
    const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown'
    const currentProtocol = typeof window !== 'undefined' ? window.location.protocol : 'unknown'
    
    console.log('🔍 Dropbox Debug Info:')
    console.log('   Full origin:', currentOrigin)
    console.log('   Hostname:', currentHostname)
    console.log('   Protocol:', currentProtocol)
    console.log('   Expected in Dropbox: Register just the hostname (e.g., "munyardmixer.com" not "https://munyardmixer.com")')
    console.log('⚠️ VERIFY: In Dropbox App Console, make sure you registered:', currentHostname)
    
    // Use the exact approach from Dropbox article
    // Do NOT include origin parameter - let Dropbox auto-detect from registered domain
    const options = {
      success: async (files: any[]) => {
        console.log('✅ Dropbox success callback triggered!')
        console.log('Files selected:', files)
        console.log('File details:', files.map(f => ({ name: f.name, link: f.link, bytes: f.bytes })))
        console.log('Number of files:', files.length)
        
        if (!files || files.length === 0) {
          console.warn('No files returned from Dropbox')
          setError('No files were selected')
          setIsLoading(false)
          return
        }

        setIsLoading(true)
        setError(null)
        
        try {
          // Convert Dropbox files to File objects
          const filePromises = files.map(async (file, index) => {
            try {
              console.log(`[${index + 1}/${files.length}] Downloading: ${file.name}`)
              console.log(`Link: ${file.link}`)
              
              // When linkType is 'direct', Dropbox already returns direct download links
              // However, we need to ensure it's a direct download link
              let downloadLink = file.link
              
              // Ensure it's a direct download link (dl=1)
              if (downloadLink.includes('?dl=0') || downloadLink.includes('&dl=0')) {
                downloadLink = downloadLink.replace(/[?&]dl=0/g, '')
                downloadLink += (downloadLink.includes('?') ? '&' : '?') + 'dl=1'
              } else if (!downloadLink.includes('dl=1') && !downloadLink.includes('dl=0')) {
                downloadLink += (downloadLink.includes('?') ? '&' : '?') + 'dl=1'
              }
              
              console.log(`Using download link: ${downloadLink}`)
              
              // Fetch the file from Dropbox - NO CUSTOM HEADERS to avoid CORS preflight
              // Dropbox direct links support CORS but only for simple requests
              const response = await fetch(downloadLink, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                // DO NOT add custom headers - they trigger CORS preflight which Dropbox doesn't support
              })
              
              if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error')
                console.error(`HTTP ${response.status} for ${file.name}:`, errorText)
                throw new Error(`HTTP ${response.status}: ${response.statusText || errorText}`)
              }
              
              const blob = await response.blob()
              console.log(`✅ Downloaded ${file.name}: ${blob.size} bytes, type: ${blob.type}`)
              
              // Determine MIME type from file extension if blob type is generic
              let mimeType = blob.type
              if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'text/plain') {
                const ext = file.name.toLowerCase().split('.').pop()
                if (ext === 'mp3') mimeType = 'audio/mpeg'
                else if (ext === 'wav') mimeType = 'audio/wav'
                else if (ext === 'm4a') mimeType = 'audio/mp4'
                else if (ext === 'aac') mimeType = 'audio/aac'
                else if (ext === 'ogg') mimeType = 'audio/ogg'
                else mimeType = 'audio/wav' // default
              }
              
              const fileObject = new File([blob], file.name, { 
                type: mimeType,
                lastModified: file.bytes ? Date.now() - 86400000 : Date.now() // Use file timestamp if available
              })
              
              console.log(`✅ Created File object: ${fileObject.name} (${fileObject.size} bytes, ${fileObject.type})`)
              return fileObject
            } catch (err: any) {
              console.error(`❌ Error downloading file ${file.name}:`, err)
              throw new Error(`Failed to download ${file.name}: ${err?.message || 'Unknown error'}`)
            }
          })

          const fileObjects = await Promise.all(filePromises)
          console.log('✅ All files downloaded successfully:', fileObjects.map(f => `${f.name} (${f.size} bytes)`))
          
          // Verify all files were created successfully
          const validFiles = fileObjects.filter(f => f && f.size > 0)
          if (validFiles.length === 0) {
            throw new Error('No valid files were downloaded')
          }
          
          if (validFiles.length < fileObjects.length) {
            console.warn(`⚠️ ${fileObjects.length - validFiles.length} files failed to download`)
          }
          
          // Pass files to parent component
          onFilesSelected(validFiles)
          setIsLoading(false)
        } catch (err: any) {
          console.error('❌ Download error:', err)
          setError(`Failed to download files: ${err.message}`)
          setIsLoading(false)
        }
      },
      cancel: () => {
        console.log('User cancelled Dropbox chooser')
        setIsLoading(false)
      },
      error: (errorMessage: string) => {
        console.error('❌ Dropbox chooser error:', errorMessage)
        console.error('   Current hostname:', window.location.hostname)
        console.error('   Current origin:', window.location.origin)
        setIsLoading(false)
        const isLocalhost = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
        const isHttp = window.location.protocol === 'http:'
        const currentDomain = window.location.hostname
        
        if (errorMessage.includes('misconfigured') || errorMessage.includes('not configured') || errorMessage.includes('Could not communicate') || errorMessage.includes('Could not find host')) {
          if (isLocalhost && isHttp) {
            setError('Mixed content blocked: Dropbox (HTTPS) cannot communicate with HTTP localhost. Use ngrok for HTTPS tunnel.')
          } else {
            setError(`Domain "${currentDomain}" may not be registered or needs time to propagate. Check Dropbox App Console → Settings → "Chooser / Saver / Embedder domains" contains exactly "${currentDomain}" (no www, no protocol). Wait 3-5 minutes after adding.`)
          }
        } else {
          setError(`Dropbox error: ${errorMessage}`)
        }
      },
      linkType: 'direct',
      multiselect: true,
      // Use 'audio' category instead of specific extensions to avoid URL encoding issues
      // Dropbox supports category strings: 'images', 'audio', 'video', 'documents', 'text'
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
          padding: '0.75rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          border: '1px solid #ffcdd2',
          borderRadius: '4px',
          fontSize: '0.85rem',
          lineHeight: '1.4',
        }}>
          <strong>⚠️ Dropbox Error:</strong> {error}
          {(error.includes('misconfigured') || error.includes('not configured') || error.includes('Mixed content') || error.includes('Could not')) ? (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.9 }}>
              <strong>🔧 Quick Fix (5 minutes):</strong>
              {window.location.protocol === 'http:' && (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')) ? (
                <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                  <li><strong>Install ngrok:</strong> <code style={{ background: '#fff3cd', padding: '0.1rem 0.25rem', borderRadius: '2px' }}>brew install ngrok</code></li>
                  <li><strong>Start tunnel:</strong> <code style={{ background: '#fff3cd', padding: '0.1rem 0.25rem', borderRadius: '2px' }}>ngrok http 3000</code></li>
                  <li><strong>Copy the HTTPS URL</strong> (e.g., <code style={{ background: '#fff3cd', padding: '0.1rem 0.25rem', borderRadius: '2px' }}>abc123.ngrok.io</code>)</li>
                  <li>Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#c62828', textDecoration: 'underline' }}>Dropbox App Console</a></li>
                  <li>Select your app (key: tgtfykx9u7aqyn2) → Settings</li>
                  <li>In "Chooser / Saver / Embedder domains", add the ngrok domain</li>
                  <li>Save, wait 1-2 minutes, then use the ngrok URL instead of localhost</li>
                </ol>
              ) : (
                <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                  <li>Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#c62828', textDecoration: 'underline' }}>Dropbox App Console</a></li>
                  <li>Select your app (key: tgtfykx9u7aqyn2) → Settings</li>
                  <li>Check "Chooser / Saver / Embedder domains" contains: <code style={{ background: '#fff3cd', padding: '0.1rem 0.25rem', borderRadius: '2px' }}>{window.location.hostname}</code></li>
                  <li><strong>VERIFY:</strong> No "www" prefix, no "https://", just the domain name</li>
                  <li>If missing, add it and wait 3-5 minutes for propagation</li>
                  <li>Clear browser cache (Cmd/Ctrl + Shift + R) and try again</li>
                </ol>
              )}
              <p style={{ marginTop: '0.5rem', fontSize: '0.7rem', fontStyle: 'italic' }}>
                <strong>Debug:</strong> Check browser console (F12) for exact origin being detected. It must match exactly what's registered in Dropbox.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
