'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        router.replace('/dashboard') // ✅ logged in
      } else {
        router.replace('/login')     // ❌ not logged in
      }
    }

    checkSession()
  }, [])

  return null
}
