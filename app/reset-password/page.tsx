'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const router = useRouter()

useEffect(() => {
  const init = async () => {
    const hash = window.location.hash

    // This is all you need now — no manual parsing
    if (hash && hash.includes('access_token')) {
      const { error } = await supabase.auth.exchangeCodeForSession(hash)
      if (error) {
        console.error(error.message)
        alert('Link expired or invalid')
        setLoading(false)
        return
      }
      setValidSession(true)
    }

    setLoading(false)
  }

  init()
}, [])


  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      alert('Error resetting password.')
    } else {
      alert('Password updated. You can now log in.')
      router.push('/login')
    }
  }

  if (loading) return null

  if (!validSession) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: '#FFE5E5', // OLD COMPUTER pink background
          padding: '3rem 1.5rem',
          fontFamily: 'monospace',
          textAlign: 'center',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '500px',
            border: '3px solid #000000',
            backgroundColor: '#D4C5B9',
            boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
          }}
        >
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
            }}
          >
            <span>RESET_PASSWORD.EXE</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
              <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
              <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
            </div>
          </div>
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#FFFFFF',
              borderTop: '2px solid #000000',
            }}
          >
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'left' }}>
              Invalid or Expired Link
            </h1>
            <p style={{ fontSize: '0.9rem', textAlign: 'left', fontFamily: 'monospace' }}>
              Please request a new password reset link.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#FFE5E5', // OLD COMPUTER pink background
        padding: '3rem 1.5rem',
        fontFamily: 'monospace',
        textAlign: 'center',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          border: '3px solid #000000',
          backgroundColor: '#D4C5B9',
          boxShadow: 'inset -2px -2px 0 #000, inset 2px 2px 0 #fff',
        }}
      >
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
          }}
        >
          <span>RESET_PASSWORD.EXE</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
            <span style={{ width: 14, height: 14, border: '2px solid #000', background: '#FFFFFF' }} />
          </div>
        </div>
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#FFFFFF',
            borderTop: '2px solid #000000',
          }}
        >
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'left' }}>
            Reset Your Password
          </h1>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                padding: '0.75rem 0.9rem',
                fontSize: '0.9rem',
                border: '2px solid #000000',
                backgroundColor: '#FFFFFF',
                fontFamily: 'monospace',
                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
              }}
            />
            <button
              onClick={handleReset}
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
              Set New Password
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
