'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null); // ✅ new
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    const { data: existingUser, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError && existingUser.user) {
      setErrorMsg('That email is already registered. Try logging in instead.');
      setIsSubmitting(false);
      return;
    }

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: 'https://prod-munyard-mixer.vercel.app/verified'
  }
});

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg('✅ Check your email to confirm your sign-up.');
    }

    setIsSubmitting(false);
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 1.5rem',
      fontFamily: 'Geist Mono, monospace',
      textAlign: 'center',
      backgroundColor: '#0a0a0a',
      color: '#fff'
    }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem' }}>
          Sign Up
        </h1>

        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '0.5rem 1rem', fontSize: '1rem', width: '100%', backgroundColor: '#1f2937', border: '1px solid #444', color: '#fff' }}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '0.5rem 1rem', fontSize: '1rem', width: '100%', backgroundColor: '#1f2937', border: '1px solid #444', color: '#fff' }}
            required
          />

          {errorMsg && <p style={{ color: '#f87171' }}>{errorMsg}</p>}

          {successMsg && (
            <div style={{
              backgroundColor: '#FCFAEE',
              color: '#B8001F',
              padding: '1rem 1.5rem',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontFamily: 'Geist Mono, monospace',
              animation: 'fadeIn 0.5s ease-in-out forwards'
            }}>
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#B8001F',
              color: 'white',
              fontSize: '1.25rem',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '3px solid white',
                  borderTop: '3px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                Creating Account…
              </>
            ) : (
              'Create Account'
            )}
          </button>

          <p style={{ fontSize: '0.9rem', marginTop: '1rem', color: '#aaa' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#fff', textDecoration: 'underline' }}>
              Log in
            </a>
          </p>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
