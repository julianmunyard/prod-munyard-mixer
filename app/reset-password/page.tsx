'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      // First check if we already have a valid session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setValidSession(true)
        setLoading(false)
        return
      }

      const hash = window.location.hash
      const searchParams = new URLSearchParams(window.location.search)

      // Check for PKCE flow (code in URL params)
      const code = searchParams.get('code')
      
      if (code) {
        // PKCE flow - exchange code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('PKCE exchange error:', error.message)
          setLoading(false)
          return
        }
        if (data?.session) {
          setValidSession(true)
        } else {
          console.error('No session after code exchange')
          setLoading(false)
          return
        }
      } else if (hash && hash.includes('access_token')) {
        // Legacy flow - Supabase should automatically detect the hash
        // Let's wait a bit for Supabase to process it
        await new Promise(resolve => setTimeout(resolve, 500))
        const { data, error } = await supabase.auth.getSession()
        if (error || !data?.session) {
          console.error('Session error:', error?.message || 'No session found')
          setLoading(false)
          return
        }
        setValidSession(true)
      } else {
        // No code or hash found
        console.error('No reset code or hash found in URL')
        setLoading(false)
        return
      }

      setLoading(false)
    }

    init()
  }, [])


  const handleReset = async () => {
    setError(null)

    // Validate password
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    // Verify we have a valid session before attempting to update
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired. Please request a new reset link.')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ 
      password: newPassword 
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      setError(updateError.message || 'Error resetting password. Please try again.')
    } else {
      alert('Password updated successfully! You can now log in.')
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
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              handleReset()
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}
          >
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New password (minimum 6 characters)"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setError(null)
                }}
                style={{
                  padding: '0.75rem 0.9rem',
                  paddingRight: '2.5rem',
                  fontSize: '0.9rem',
                  border: '2px solid #000000',
                  backgroundColor: '#FFFFFF',
                  fontFamily: 'monospace',
                  boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'relative' }}
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                  {!showPassword && (
                    <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2.5" />
                  )}
                </svg>
              </button>
            </div>
            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                border: '2px solid #000000',
                backgroundColor: '#FCFAEE',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                color: '#000000',
              }}>
                {error}
              </div>
            )}
            <button
              type="submit"
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
