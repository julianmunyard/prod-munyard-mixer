'use client'

import React, { useEffect, useState } from 'react'

interface PoolsuiteLoadingScreenProps {
  songTitle: string
  artistName: string
  progress: number
  loadingMessage: string
  onComplete: () => void
  primaryColor?: string
}

export default function PoolsuiteLoadingScreen({
  songTitle,
  artistName,
  progress,
  loadingMessage,
  onComplete,
  primaryColor = '#B8001F'
}: PoolsuiteLoadingScreenProps) {
  const [showContent, setShowContent] = useState(false)
  const [isVerySmallScreen, setIsVerySmallScreen] = useState(false)
  const [isSmallScreen, setIsSmallScreen] = useState(false)

  useEffect(() => {
    // Small delay to ensure smooth appearance
    const timer = setTimeout(() => setShowContent(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Handle screen size detection to prevent hydration issues
    const checkScreenSize = () => {
      if (typeof window !== 'undefined') {
        setIsVerySmallScreen(window.innerWidth < 400)
        setIsSmallScreen(window.innerWidth < 600)
      }
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => {
    // Auto-complete when progress reaches 100%
    if (progress >= 100) {
      const timer = setTimeout(() => {
        onComplete()
      }, 500) // Small delay to show 100% completion
      return () => clearTimeout(timer)
    }
  }, [progress, onComplete])

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          backgroundColor: '#FFE5E5', // Pink background to match dashboard
        }}
      >
      {/* Main Loading Window - OLD COMPUTER aesthetic */}
      <div 
        className="relative"
        style={{
          width: 'min(95vw, 800px)',
          maxWidth: isVerySmallScreen ? '95vw' : 'min(90vw, 800px)',
          border: '3px solid #000000',
          backgroundColor: '#D4C5B9',
          boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 0.9rem',
            borderBottom: '3px solid #000000',
            backgroundColor: '#C0C0C0',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            fontFamily: 'monospace',
          }}
        >
          <span>LOADING</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
          </div>
        </div>

        {/* Content area */}
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#FFFFFF',
            borderTop: '2px solid #000000',
          }}
        >
          {/* Title */}
          <h1 
            style={{ 
              fontSize: isVerySmallScreen ? '1.5rem' : isSmallScreen ? '1.8rem' : '2rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: '#000000',
              fontFamily: 'monospace',
            }}
          >
            MUNYARD MIXER
          </h1>

          {/* Loading Message */}
          <div 
            style={{ 
              fontSize: '0.95rem',
              marginBottom: '1.5rem',
              color: '#000000',
              fontFamily: 'monospace',
            }}
          >
            {loadingMessage}
          </div>

          {/* Progress Bar Container */}
          <div style={{ marginBottom: '1rem' }}>
            <div 
              style={{ 
                position: 'relative',
                height: '24px',
                overflow: 'hidden',
                backgroundColor: '#FFFFFF',
                border: '2px solid #000000',
                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
              }}
            >
              {/* Segmented Progress Blocks */}
              <div style={{ 
                position: 'absolute',
                inset: '2px',
                display: 'flex',
                gap: '2px',
                padding: '2px',
              }}>
                {Array.from({ length: 40 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: '100%',
                      backgroundColor: i < Math.floor((progress / 100) * 40) ? '#000000' : 'transparent'
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* Progress Percentage */}
            <div 
              style={{ 
                textAlign: 'right',
                fontSize: '0.85rem',
                marginTop: '0.5rem',
                color: '#000000',
                fontFamily: 'monospace',
              }}
            >
              {Math.round(progress)}%
            </div>
          </div>

          {/* Song Info */}
          <div 
            style={{ 
              fontSize: '0.9rem',
              marginTop: '1rem',
              color: '#000000',
              fontFamily: 'monospace',
            }}
          >
            <div style={{ marginBottom: '0.5rem' }}>Loading: {songTitle}</div>
            <div>Artist: {artistName}</div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
