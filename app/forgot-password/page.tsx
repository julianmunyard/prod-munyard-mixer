'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
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
      className="min-h-screen flex items-center justify-center bg-[#FCFAEE] text-[#B8001F]"
      style={{ fontFamily: 'Geist Mono, monospace' }}
    >
      <div className="p-6 bg-white rounded shadow-md w-full max-w-md text-center">
        <h1 className="text-xl mb-4 font-bold">Forgot Password?</h1>
        {sent ? (
          <p className="text-sm">Check your email for the reset link.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-[#B8001F] p-2"
              required
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              className="bg-[#B8001F] text-white px-4 py-2"
            >
              Send Reset Link
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
