'use client'

import { useState, useEffect, useRef } from 'react'

type Position = {
  x: number
  y: number
}

type ElementPositions = {
  [key: string]: Position
}

export default function VisualPositionEditor() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [positions, setPositions] = useState<ElementPositions>({})
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [showValues, setShowValues] = useState(true)

  // Load saved positions from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('visualEditorPositions')
      if (saved) {
        setPositions(JSON.parse(saved))
      }
    }
  }, [])

  // Save positions to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(positions).length > 0) {
      localStorage.setItem('visualEditorPositions', JSON.stringify(positions))
    }
  }, [positions])

  // Make elements draggable when enabled
  useEffect(() => {
    if (!isEnabled) return

    const elements = [
      { id: 'stems-container', label: 'Modules Container' },
      { id: 'mobile-effect-controls', label: 'FLANGE Effect' },
      { id: 'mobile-varispeed', label: 'VARISPEED' },
    ]

      const handleStart = (e: MouseEvent | TouchEvent, elementId: string) => {
      e.preventDefault()
      e.stopPropagation()
      setSelectedElement(elementId)
      
      const element = document.getElementById(elementId)
      if (!element) return

      const rect = element.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const startX = clientX - rect.left
      const startY = clientY - rect.top

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
        const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY
        const newX = moveX - startX - rect.left
        const newY = moveY - startY - rect.top

        setPositions(prev => ({
          ...prev,
          [elementId]: { x: newX, y: newY }
        }))

        // Apply transform immediately for visual feedback
        element.style.transform = `translate(${newX}px, ${newY}px)`
      }

      const handleEnd = () => {
        document.removeEventListener('mousemove', handleMove as any)
        document.removeEventListener('mouseup', handleEnd)
        document.removeEventListener('touchmove', handleMove as any)
        document.removeEventListener('touchend', handleEnd)
        setSelectedElement(null)
      }

      document.addEventListener('mousemove', handleMove as any)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleMove as any, { passive: false })
      document.addEventListener('touchend', handleEnd)
    }

    const handleMouseDown = (e: MouseEvent, elementId: string) => handleStart(e, elementId)
    const handleTouchStart = (e: TouchEvent, elementId: string) => handleStart(e, elementId)

    // Add drag handles to elements
    elements.forEach(({ id, label }) => {
      const element = document.getElementById(id)
      if (element) {
        element.style.cursor = 'move'
        element.style.position = 'relative'
        element.style.zIndex = isEnabled ? '9999' : 'auto'
        
        // Add visual indicator
        if (isEnabled && !element.querySelector('.drag-handle')) {
          const handle = document.createElement('div')
          handle.className = 'drag-handle'
          handle.style.cssText = `
            position: absolute;
            top: -20px;
            left: 0;
            background: rgba(184, 0, 31, 0.8);
            color: white;
            padding: 2px 6px;
            font-size: 10px;
          `
          handle.textContent = `📐 ${label}`
          handle.onmousedown = (e) => handleMouseDown(e as any, id)
          handle.ontouchstart = (e) => handleTouchStart(e as any, id)
          handle.style.touchAction = 'none'
          element.appendChild(handle)
        }
      }
    })

    return () => {
      elements.forEach(({ id }) => {
        const element = document.getElementById(id)
        if (element) {
          element.style.cursor = ''
          element.style.position = ''
          element.style.zIndex = ''
          const handle = element.querySelector('.drag-handle')
          if (handle) handle.remove()
        }
      })
    }
  }, [isEnabled, selectedElement])

  const exportValues = () => {
    const values = Object.entries(positions).map(([id, pos]) => {
      return `${id}: { marginTop: '${pos.y}px', marginLeft: '${pos.x}px' }`
    }).join('\n')
    
    navigator.clipboard.writeText(values)
    alert('Values copied to clipboard!')
  }

  const resetPositions = () => {
    setPositions({})
    localStorage.removeItem('visualEditorPositions')
    // Reset all transforms
    Object.keys(positions).forEach(id => {
      const element = document.getElementById(id)
      if (element) {
        element.style.transform = ''
      }
    })
  }

  if (!isEnabled) {
    return (
      <button
        onClick={() => setIsEnabled(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '12px',
          zIndex: 10000,
          padding: '8px 12px',
          backgroundColor: '#B8001F',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        🎨 Visual Editor
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '12px',
        zIndex: 10000,
        backgroundColor: 'rgba(252, 250, 238, 0.95)',
        border: '2px solid #B8001F',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '200px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#B8001F' }}>Visual Editor</h3>
        <button
          onClick={() => setIsEnabled(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ marginBottom: '8px', fontSize: '11px', color: '#666' }}>
        Drag elements to reposition them
      </div>

      {showValues && Object.keys(positions).length > 0 && (
        <div style={{ marginBottom: '8px', fontSize: '10px', maxHeight: '150px', overflowY: 'auto' }}>
          {Object.entries(positions).map(([id, pos]) => (
            <div key={id} style={{ marginBottom: '4px', fontFamily: 'monospace' }}>
              <strong>{id}:</strong> x: {pos.x.toFixed(0)}px, y: {pos.y.toFixed(0)}px
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
        <button
          onClick={exportValues}
          style={{
            padding: '6px 8px',
            backgroundColor: '#B8001F',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          📋 Copy Values
        </button>
        <button
          onClick={resetPositions}
          style={{
            padding: '6px 8px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          🔄 Reset
        </button>
      </div>
    </div>
  )
}

