'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else window.location.href = '/dashboard'
  }


  
  return (
    <main style={{ padding: '4rem', fontFamily: 'Geist Mono, monospace', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Login or Sign Up</h1>

      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px', margin: '0 auto' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
        />

<a
  href="/forgot-password"
  style={{
    fontSize: '0.875rem',
    color: '#B8001F',
    textDecoration: 'underline',
    textAlign: 'center',
    marginTop: '-0.25rem',
    marginBottom: '0.75rem',
    display: 'block',
  }}
>
  Forgot password?
</a>

        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        <button
          onClick={handleLogin}
          style={{ padding: '0.5rem', background: '#B8001F', color: 'white', border: 'none', fontSize: '1rem' }}
        >
          Login
        </button>

        <a
          href="/signup"
          style={{
            display: 'inline-block',
            textAlign: 'center',
            padding: '0.5rem',
            background: '#222',
            color: 'white',
            border: 'none',
            fontSize: '1rem',
            textDecoration: 'none'
          }}
        >
          Sign Up
        </a>
      </form>
    </main>
  )
}
