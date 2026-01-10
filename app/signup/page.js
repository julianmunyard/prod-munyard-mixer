'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import BarLoadingIndicator from '../components/BarLoadingIndicator';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          <span>SIGNUP.EXE</span>
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
            Sign Up
          </h1>

          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <input
              type="email"
              placeholder="Email"
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

            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            {errorMsg && (
              <p style={{
                color: '#000000',
                backgroundColor: '#FCFAEE',
                padding: '0.75rem 1rem',
                border: '2px solid #000000',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
              }}>
                {errorMsg}
              </p>
            )}

            {successMsg && (
              <div style={{
                backgroundColor: '#FCFAEE',
                color: '#000000',
                padding: '0.75rem 1rem',
                border: '2px solid #000000',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
              }}>
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.45rem 1.1rem',
                backgroundColor: '#D4C5B9',
                color: '#000000',
                fontSize: '0.9rem',
                border: '2px solid #000000',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
                fontFamily: 'monospace',
                boxShadow: 'inset -1px -1px 0 #000, inset 1px 1px 0 #fff',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}
            >
              {isSubmitting ? (
                <>
                  <BarLoadingIndicator size="small" />
                  Creating Account…
                </>
              ) : (
                'Create Account'
              )}
            </button>

            <p style={{ fontSize: '0.9rem', marginTop: '1rem', textAlign: 'left', fontFamily: 'monospace' }}>
              Already have an account?{' '}
              <a href="/login" style={{ color: '#000000', textDecoration: 'underline', fontFamily: 'monospace' }}>
                Log in
              </a>
            </p>
          </form>
        </div>
      </div>

    </main>
  );
}
