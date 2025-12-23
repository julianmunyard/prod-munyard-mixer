'use client'

import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://munyardmixer.com/reset-password',
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
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
      {/* Outer "window" frame to match OLD COMPUTER dashboard aesthetic */}
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
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
          }}
        >
          <span>RESET_PASSWORD.EXE</span>
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
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'left' }}>
            Forgot Password?
          </h1>
          
          {sent ? (
            <div style={{
              padding: '0.75rem 1rem',
              border: '2px solid #000000',
              backgroundColor: '#FCFAEE',
              fontSize: '0.9rem',
              fontFamily: 'monospace',
              textAlign: 'left',
            }}>
              Check your email for the reset link.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: '0.75rem 0.9rem',
                  fontSize: '0.9rem',
                  border: '2px solid #000000',
                  backgroundColor: '#FFFFFF',
                  fontFamily: 'monospace',
                  boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                }}
                required
              />
              {error && (
                <p style={{
                  color: '#000000',
                  backgroundColor: '#FCFAEE',
                  padding: '0.75rem 1rem',
                  border: '2px solid #000000',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                }}>
                  {error}
                </p>
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
                Send Reset Link
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
