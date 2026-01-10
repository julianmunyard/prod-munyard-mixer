'use client'

import { useEffect } from 'react'

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  itemName?: string
  itemType?: 'song' | 'collection'
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  itemName = '',
  itemType = 'song'
}: DeleteConfirmationModalProps) {
  useEffect(() => {
    if (isOpen) {
      console.log('📋 Delete modal opened:', { itemName, itemType })
    }
  }, [isOpen, itemName, itemType])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleConfirm = () => {
    console.log('✅ Delete confirmation button clicked')
    onConfirm()
    // Don't close here - let the parent handle closing after deletion completes
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          border: '3px solid #000000',
          backgroundColor: '#D4C5B9',
          boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
        }}
        onClick={(e) => e.stopPropagation()}
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
          <span>CONFIRM DELETE</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              lineHeight: '1',
              fontFamily: 'monospace',
              color: '#000000',
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Content area */}
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#FFFFFF',
            borderTop: '2px solid #000000',
          }}
        >
          <p
            style={{
              fontSize: '0.95rem',
              marginBottom: '1.5rem',
              color: '#000000',
              fontFamily: 'monospace',
              lineHeight: '1.5',
            }}
          >
            {itemName ? (
              <>
                Are you sure you want to delete{' '}
                <strong style={{ fontWeight: 'bold' }}>
                  "{itemName}"?
                </strong>
              </>
            ) : (
              `Are you sure you want to delete this ${itemType}?`
            )}
          </p>

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '0.45rem 1.1rem',
                backgroundColor: '#D4C5B9',
                color: '#000000',
                fontSize: '0.9rem',
                border: '2px solid #000000',
                cursor: 'pointer',
                fontFamily: 'monospace',
                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                fontWeight: 'bold',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              style={{
                padding: '0.45rem 1.1rem',
                backgroundColor: '#FF4444',
                color: '#FFFFFF',
                fontSize: '0.9rem',
                border: '2px solid #000000',
                cursor: 'pointer',
                fontFamily: 'monospace',
                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                fontWeight: 'bold',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
