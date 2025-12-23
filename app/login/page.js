'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    
    if (!supabase) {
      setError('Supabase client is not configured. Please check your environment variables.')
      console.error('❌ Supabase client is null - check .env.local file')
      return
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        console.error('Login error:', error)
        setError(error.message || 'Failed to log in. Please check your credentials.')
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err) {
      console.error('Login exception:', err)
      setError(err.message || 'Network error. Please check your internet connection and try again.')
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
          <span>LOGIN.EXE</span>
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
            Login
          </h1>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                padding: '0.75rem 0.9rem',
                fontSize: '0.9rem',
                border: '2px solid #000000',
                backgroundColor: '#FFFFFF',
                fontFamily: 'monospace',
                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                padding: '0.75rem 0.9rem',
                fontSize: '0.9rem',
                border: '2px solid #000000',
                backgroundColor: '#FFFFFF',
                fontFamily: 'monospace',
                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
              }}
            />

            <a
              href="/forgot-password"
              style={{
                fontSize: '0.85rem',
                color: '#000000',
                textDecoration: 'underline',
                textAlign: 'left',
                marginTop: '-0.5rem',
                marginBottom: '0.5rem',
                display: 'block',
                fontFamily: 'monospace',
              }}
            >
              Forgot password?
            </a>

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
              onClick={handleLogin}
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
              Login
            </button>

            <p style={{ fontSize: '0.9rem', marginTop: '1rem', textAlign: 'left', fontFamily: 'monospace' }}>
              Don't have an account?{' '}
              <a
                href="/signup"
                style={{
                  color: '#000000',
                  textDecoration: 'underline',
                  fontFamily: 'monospace',
                }}
              >
                Sign Up
              </a>
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}
