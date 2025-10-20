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

  useEffect(() => {
    // Small delay to ensure smooth appearance
    const timer = setTimeout(() => setShowContent(true), 100)
    return () => clearTimeout(timer)
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
      {/* Font face declaration */}
      <style jsx>{`
        @font-face {
          font-family: 'New York';
          src: url('/fonts/new-york.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      `}</style>
      
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          backgroundColor: '#FCFAEE', // Light beige background
          fontFamily: 'New York, serif'
        }}
      >
      {/* Main Loading Window */}
      <div 
        className="relative overflow-hidden"
        style={{
          width: 'min(90vw, 800px)',
          height: 'min(70vh, 500px)',
          backgroundColor: '#FCFAEE',
          border: '2px solid #000',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Inner teal border */}
        <div 
          className="absolute inset-1 rounded-lg"
          style={{
            border: '1px solid #20B2AA',
            pointerEvents: 'none'
          }}
        />

        {/* Content Container */}
        <div className="flex h-full">
          {/* Left Section - Vintage Studio Photo */}
          <div 
            className="relative flex-shrink-0"
            style={{
              width: '40%',
              backgroundImage: 'url("/giorgio-and-bowie.jpg")',
              backgroundSize: 'cover',
              backgroundPosition: '35% center',
              opacity: 0.9
            }}
          >
            {/* Vintage filter overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(45deg, rgba(245, 245, 220, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%)'
              }}
            />
          </div>

          {/* Right Section - Text and Progress */}
          <div 
            className="flex-1 flex flex-col justify-between p-6"
            style={{
              background: 'radial-gradient(circle at 20% 50%, rgba(32, 178, 170, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(32, 178, 170, 0.05) 0%, transparent 50%)',
              position: 'relative'
            }}
          >
            {/* Dotted pattern overlay */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(circle, #20B2AA 1px, transparent 1px)',
                backgroundSize: '8px 8px'
              }}
            />

            <div className="relative z-10">
              {/* Title */}
              <div className="flex items-center justify-between mb-4">
                <h1 
                  className="text-4xl font-bold tracking-wider"
                  style={{ 
                    color: '#000000',
                    fontFamily: 'New York, serif',
                    textShadow: '2px 2px 0px rgba(0,0,0,0.1)'
                  }}
                >
                  MUNYARD MIXER
                </h1>
                <div 
                  className="w-8 h-8 rounded-full"
                  style={{
                    background: `linear-gradient(45deg, ${primaryColor}, #FFD700)`,
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                  }}
                />
              </div>

              {/* Subtitle */}
              <div 
                className="text-sm italic mb-6 leading-relaxed"
                style={{ color: '#000000', fontFamily: 'New York, serif' }}
              >
                <div className="font-bold mb-1">Interactive Stem Player</div>
              </div>

              {/* Loading Message */}
              <div 
                className="text-lg mb-4"
                style={{ color: '#000000', fontFamily: 'New York, serif' }}
              >
                {loadingMessage}
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div 
                  className="relative h-6 overflow-hidden"
                  style={{ 
                    backgroundColor: '#FCFAEE',
                    border: '1px solid #000',
                    borderBottom: '4px solid #000',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {/* Segmented Progress Blocks */}
                  <div className="absolute inset-0 flex gap-0.5 p-0.5">
                    {Array.from({ length: 40 }, (_, i) => (
                      <div
                        key={i}
                        className="flex-1 h-full"
                        style={{
                          backgroundColor: i < Math.floor((progress / 100) * 40) ? '#20B2AA' : 'transparent'
                        }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Progress Percentage */}
                <div 
                  className="text-right text-sm mt-1"
                  style={{ color: '#000000', fontFamily: 'New York, serif' }}
                >
                  {Math.round(progress)}%
                </div>
              </div>

              {/* Song Info */}
              <div 
                className="text-sm mt-4"
                style={{ color: '#000000', fontFamily: 'New York, serif' }}
              >
                <div>Loading: {songTitle}</div>
                <div>Artist: {artistName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Animation */}
        {showContent && (
          <div 
            className="absolute top-4 right-4 w-3 h-3 animate-pulse"
            style={{
              backgroundColor: '#20B2AA',
              borderRadius: '50%',
              boxShadow: '0 0 10px #20B2AA'
            }}
          />
        )}
      </div>
    </div>
    </>
  )
}
