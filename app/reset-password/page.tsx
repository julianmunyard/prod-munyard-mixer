'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')

  useEffect(() => {
    const init = async () => {
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          alert('Invalid or expired link.')
        }
      }
      setLoading(false)
    }
    init()
  }, [accessToken, refreshToken])

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

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#FCFAEE] text-[#B8001F]"
      style={{ fontFamily: 'Geist Mono, monospace' }}
    >
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
