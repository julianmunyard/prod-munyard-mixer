'use client'

import React, { useState } from 'react'

interface DropboxFilePickerProps {
  onFilesSelected: (files: File[]) => void
  isMobile: boolean
}

export default function DropboxFilePicker({ onFilesSelected, isMobile }: DropboxFilePickerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDropboxClick = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Load Dropbox Chooser script
      const script = document.createElement('script')
      script.src = 'https://www.dropbox.com/static/api/2/dropins.js'
      script.setAttribute('data-app-key', 'tgtfykx9u7aqyn2') // Your actual Dropbox app key
      script.async = true

      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })

      // Initialize Dropbox Chooser
      const options = {
        success: (files: any[]) => {
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
          setIsLoading(false)
        },
        linkType: 'direct',
        multiselect: true,
        extensions: ['audio'], // This includes all audio formats: mp3, wav, aiff, flac, etc.
        folderselect: false,
      }

      // @ts-ignore - Dropbox global
      window.Dropbox.choose(options)
    } catch (err) {
      setError('Failed to load Dropbox picker')
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDropboxClick}
      disabled={isLoading}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#ffffff',
        color: '#B8001F',
        border: '1px solid #B8001F',
        borderRadius: '4px',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        opacity: isLoading ? 0.7 : 1,
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
      ) : (
        <>
          📁 Dropbox
        </>
      )}
    </button>
  )
}
