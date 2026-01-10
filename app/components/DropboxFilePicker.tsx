'use client'

import React, { useEffect, useCallback, useState } from 'react'
import Script from 'next/script'

interface file {
  id: string
  name: string
  link: string
  bytes: number
  icon: string
  thumbnailLink?: string
  isDir: boolean
}

interface DropboxFilePickerProps {
  onFilesSelected: (files: File[]) => void
  isMobile: boolean
}

interface options {
  success: (files: file[]) => void
  cancel?: () => void
  multiselect?: boolean
  linkType?: string
  folderselect?: boolean
  extensions?: string[]
  sizeLimit?: number[]
}

const APP_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || 'tgtfykx9u7aqyn2'

declare global {
  interface Window {
    Dropbox: any
  }
}

var options: options = {
  success: (files: file[]) => {
    console.log('success', files)
  },
  cancel: () => {
    console.log('cancel')
  },
  linkType: 'direct',
  multiselect: true,
  folderselect: false
}

export default function DropboxFilePicker({ onFilesSelected, isMobile }: DropboxFilePickerProps) {
  const [loader, setLoader] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [Dropbox, setDropbox] = useState<any>()

  useEffect(() => {
    options.success = (files: file[]) => {
      console.log('success', files)
      handleDropboxSuccess(files)
    }
    options.linkType = 'direct'
    options.multiselect = true
    options.folderselect = false
    options.extensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg']
    options.cancel = () => {
      console.log('cancel')
    }
  }, [onFilesSelected])

  const handleDropboxSuccess = async (files: file[]) => {
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

  const handleChoose = useCallback(() => {
    console.log('choose')
    console.log(options)
    if (Dropbox) {
      console.log('ok')
      Dropbox.choose(options)
    }
  }, [options, Dropbox])

  return (
    <>
      <Script
        type="text/javascript"
        src="https://www.dropbox.com/static/api/2/dropins.js"
        id="dropboxjs"
        data-app-key={APP_KEY}
        onLoad={() => {
          console.log('loaded')
          setDropbox(window.Dropbox)
        }}
      />
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
          onClick={handleChoose}
          style={{
            border: '3px dotted black',
            cursor: Dropbox ? 'pointer' : 'not-allowed',
            padding: '0.5rem 1rem',
            textAlign: 'center',
            opacity: Dropbox ? 1 : 0.7
          }}
        >
          {Dropbox ? '📁 Dropbox' : '📁 Dropbox (Loading...)'}
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
    </>
  )
}
