'use client'

import React, { useState, useEffect } from 'react'
import DropboxChooser from 'react-dropbox-chooser'

interface DropboxFilePickerProps {
  onFilesSelected: (files: File[]) => void
  isMobile: boolean
}

const APP_KEY = 'tgtfykx9u7aqyn2'

export default function DropboxFilePicker({ onFilesSelected, isMobile }: DropboxFilePickerProps) {
  const [loader, setLoader] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    // Debug: Check if Dropbox script is loading
    if (typeof window !== 'undefined') {
      // Check immediately and on script load
      const checkDropbox = () => {
        const script = document.getElementById('dropboxjs') as HTMLScriptElement
        const hasDropbox = !!(window as any).Dropbox
        
        let info = []
        info.push(`Script tag exists: ${!!script}`)
        if (script) {
          info.push(`Script src: ${script.src || 'none'}`)
          info.push(`Script loaded: ${script.getAttribute('data-loaded') || 'unknown'}`)
        }
        info.push(`window.Dropbox exists: ${hasDropbox}`)
        if (hasDropbox) {
          info.push(`window.Dropbox.choose exists: ${typeof (window as any).Dropbox.choose === 'function'}`)
        } else {
          // Check for errors
          const dropboxError = (window as any).__DROPBOX_ERROR__
          if (dropboxError) {
            info.push(`Error: ${dropboxError}`)
          }
        }
        info.push(`Hostname: ${window.location.hostname}`)
        
        setDebugInfo(info.join(' | '))
      }
      
      // Listen for script load
      const script = document.getElementById('dropboxjs') as HTMLScriptElement
      if (script && !script.hasAttribute('data-monitored')) {
        script.setAttribute('data-monitored', 'true')
        script.addEventListener('load', () => {
          console.log('✅ Dropbox script loaded event fired')
          script.setAttribute('data-loaded', 'true')
          // Wait a bit for Dropbox to initialize
          setTimeout(() => {
            if ((window as any).Dropbox) {
              console.log('✅ window.Dropbox is now available!')
            } else {
              console.error('❌ Script loaded but window.Dropbox still not available')
              // Check for console errors
              console.error('Check browser console for Dropbox errors')
            }
            checkDropbox()
          }, 1000)
        })
        script.addEventListener('error', (e) => {
          console.error('❌ Dropbox script failed to load:', e)
          setDebugInfo('Script failed to load - check network tab')
        })
      }
      
      checkDropbox()
      const interval = setInterval(checkDropbox, 2000)
      return () => clearInterval(interval)
    }
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
    console.log('🔘 Button clicked!')
    console.log('   Dropbox script tag:', document.getElementById('dropboxjs'))
    console.log('   window.Dropbox:', (window as any).Dropbox)
    console.log('   Current hostname:', window.location.hostname)
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
          cursor: 'pointer',
          padding: '0.5rem 1rem',
          textAlign: 'center'
        }}
        onClick={handleClick}
      >
        <DropboxChooser
          appKey={APP_KEY}
          success={handleSuccess}
          linkType="direct"
          cancel={() => console.log('closed')}
          folderselect={false}
          multiselect={true}
          extensions={['.mp3', '.wav', '.m4a', '.aac', '.ogg']}
        >
          <span style={{ cursor: 'pointer', userSelect: 'none' }}>📁 Dropbox</span>
        </DropboxChooser>
      </div>

      {debugInfo && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.75rem',
          backgroundColor: debugInfo.includes('window.Dropbox exists: false') ? '#fff3cd' : '#f0f0f0',
          border: debugInfo.includes('window.Dropbox exists: false') ? '1px solid #ffc107' : 'none',
          fontSize: '0.75rem',
          fontFamily: 'monospace'
        }}>
          <strong>Debug Info:</strong><br />
          {debugInfo}
          {debugInfo.includes('window.Dropbox exists: false') && (
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #ccc' }}>
              <strong style={{ color: '#856404' }}>⚠️ PROBLEM DETECTED:</strong><br />
              Dropbox script loaded but API not initialized.<br /><br />
              <strong>Since localhost IS registered, try these fixes:</strong><br />
              1. <strong>Hard refresh:</strong> Press Cmd/Ctrl + Shift + R (clears cache)<br />
              2. <strong>Wait 5 minutes:</strong> Domain changes can take time to propagate<br />
              3. <strong>Check browser console (F12):</strong> Look for Dropbox error messages<br />
              4. <strong>Try incognito/private window:</strong> Rules out cache issues<br />
              5. <strong>Check for mixed content errors:</strong> HTTP localhost + HTTPS Dropbox = blocked<br /><br />
              <strong>If still not working:</strong> The react-dropbox-chooser library might not be compatible with Next.js. We may need to load Dropbox script manually instead.
            </div>
          )}
        </div>
      )}
      
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
                <li>Add: <code style={{ background: '#fff3cd', padding: '0.1rem 0.25rem' }}>{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}</code></li>
                <li>Wait 2-3 minutes, then refresh</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
