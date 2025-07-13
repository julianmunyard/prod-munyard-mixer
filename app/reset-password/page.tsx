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
      if (hash) {
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
      <div className="min-h-screen flex items-center justify-center bg-[#FCFAEE] text-[#B8001F]" style={{ fontFamily: 'Geist Mono, monospace' }}>
        <div className="p-6 bg-white rounded shadow-md w-full max-w-md text-center">
          <h1 className="text-xl mb-4 font-bold">Invalid or Expired Link</h1>
          <p className="text-sm mb-4">Please request a new password reset link.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFAEE] text-[#B8001F]" style={{ fontFamily: 'Geist Mono, monospace' }}>
      <div className="p-6 bg-white rounded shadow-md w-full max-w-md">
        <h1 className="text-xl mb-4 font-bold">Reset Your Password</h1>
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-[#B8001F] p-2 mb-4"
        />
        <button
          onClick={handleReset}
          className="bg-[#B8001F] text-white px-4 py-2 w-full"
        >
          Set New Password
        </button>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
