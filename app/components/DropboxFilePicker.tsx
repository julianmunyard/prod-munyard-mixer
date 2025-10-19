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
    // Check if Dropbox is loaded
    const checkDropbox = () => {
      if (window.Dropbox && window.Dropbox.choose) {
        setDropboxReady(true)
        setError(null)
      } else {
        setError('Dropbox not loaded')
      }
    }

    // Check immediately
    checkDropbox()

    // Check again after a delay
    const timer = setTimeout(checkDropbox, 1000)
    
    return () => clearTimeout(timer)
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

    // Use the official Dropbox Chooser approach
    const options = {
      success: (files: any[]) => {
        console.log('Files selected:', files)
        // Convert Dropbox files to File objects
        const filePromises = files.map(async (file) => {
          try {
            const response = await fetch(file.link)
            const blob = await response.blob()
            return new File([blob], file.name, { type: blob.type })
          } catch (err) {
            console.error('Error downloading file:', err)
            throw err
          }
        })

        Promise.all(filePromises)
          .then((fileObjects) => {
            onFilesSelected(fileObjects)
            setIsLoading(false)
          })
          .catch((err) => {
            setError('Failed to download files from Dropbox')
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
      folderselect: false,
    }

    try {
      window.Dropbox.choose(options)
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
