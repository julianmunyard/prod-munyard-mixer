'use client'

export default function VerifiedPage() {
  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Geist Mono, monospace',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          ✅ Email Verified
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#aaa' }}>
          Your account has been verified!
        </p>

        <a
          href="/login"
          style={{
            marginTop: '2rem',
            display: 'inline-block',
            backgroundColor: '#B8001F',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '1rem'
          }}
        >
          Go to Login
        </a>
      </div>
    </main>
  )
}
