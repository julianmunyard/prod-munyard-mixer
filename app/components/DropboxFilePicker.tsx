'use client'

import React, { useState } from 'react'
import DropboxChooser from 'react-dropbox-chooser'

interface DropboxFilePickerProps {
  onFilesSelected: (files: File[]) => void
  isMobile: boolean
}

const APP_KEY = 'tgtfykx9u7aqyn2'

export default function DropboxFilePicker({ onFilesSelected, isMobile }: DropboxFilePickerProps) {
  const [loader, setLoader] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div style={{ width: '100%' }}>
      {loader && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '3px solid #B8001F',
              borderTop: '3px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span>Downloading files...</span>
          </div>
        </div>
      )}
      
      <div
        style={{
          border: '3px dotted #ccc',
          cursor: loader ? 'not-allowed' : 'pointer',
          padding: '0.5rem 1rem',
          backgroundColor: '#ffffff',
          color: '#B8001F',
          borderRadius: '4px',
          fontSize: '0.9rem',
          textAlign: 'center',
          opacity: loader ? 0.7 : 1
        }}
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
          📁 Dropbox
        </DropboxChooser>
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
