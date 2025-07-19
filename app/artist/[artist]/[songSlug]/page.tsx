'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

// ==================== Imports ====================
import { useEffect, useRef, useState, ChangeEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import DelayKnob from '../../../components/DelayKnob'
import { useParams } from 'next/navigation'
import VarispeedSlider from '../../../components/VarispeedSlider'
import TransparentMixerLayout from '../../../components/TransparentMixerLayout'



// ==================== Types ====================
type Song = {
  id: string
  title: string
  artist_name: string
  artist_slug: string
  song_slug: string
  bpm: number
  effects: string[] | string
  stems: { label: string; file: string }[] | string
  color: string
  background_video?: string
  primary_color?: string // ✅ ADD THIS
}


export type Stem = {
  label: string
  file: string
}


// ==================== Main Component ====================
export default function MixerPage() {
  // -------------------- State --------------------
  const { artist, songSlug } = useParams() as { artist: string; songSlug: string }
  const [songData, setSongData] = useState<Song | null>(null)
  const [stems, setStems] = useState<Stem[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [delays, setDelays] = useState<Record<string, number>>({})
  const [mutes, setMutes] = useState<Record<string, boolean>>({})
  const [solos, setSolos] = useState<Record<string, boolean>>({})
  const [varispeed, setVarispeed] = useState(1)
  const [showNotification, setShowNotification] = useState(false)
  const [loadingStems, setLoadingStems] = useState(true)
  const [allReady, setAllReady] = useState(false)
  const [bpm, setBpm] = useState<number | null>(null)
  const primary = songData?.primary_color || '#B8001F' // fallback red


  // -------------------- Device Detection --------------------
  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)

  // -------------------- Audio References --------------------
  const delaysRef = useRef<Record<string, number>>({})
  const audioCtxRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Record<string, AudioBuffer>>({})
  const nodesRef = useRef<Record<string, AudioWorkletNode>>({})
  const gainNodesRef = useRef<Record<string, GainNode>>({})
  const delayNodesRef = useRef<Record<string, DelayNode>>({})
  const feedbackGainsRef = useRef<Record<string, GainNode>>({})

  // ==================== Effects ====================

  // ---------- Fetch song data ----------
  useEffect(() => {
    const fetchSong = async () => {
      console.log('🧪 Fetching song with:', { artist, songSlug })
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_slug', artist)
        .eq('song_slug', songSlug)
        .single()

      if (error || !data) return console.error('❌ Song fetch failed', error)

      if (data.bpm) setBpm(data.bpm)

      const parsedStems = typeof data.stems === 'string' ? JSON.parse(data.stems) : data.stems
      const usedLabels = new Set<string>()

      const stemObjs: Stem[] = parsedStems.map((stem: any, i: number) => {
        let rawLabel = stem.label?.trim() || stem.file?.split('/').pop() || `Untitled Stem ${i + 1}`
        rawLabel = rawLabel.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
        let label = rawLabel
        while (usedLabels.has(label)) label += `_${i}`
        usedLabels.add(label)
        return { label, file: stem.file }
      })

      setSongData(data)
      setStems(stemObjs)
      setVolumes(Object.fromEntries(stemObjs.map(s => [s.label, 1])))
      setDelays(Object.fromEntries(stemObjs.map(s => [s.label, 0])))
      setMutes(Object.fromEntries(stemObjs.map(s => [s.label, false])))
      setSolos(Object.fromEntries(stemObjs.map(s => [s.label, false])))
    }

// Set red + white for all themes
document.documentElement.style.setProperty('--bg', '#B8001F')
document.documentElement.style.setProperty('--fg', '#ffffff')


    if (artist && songSlug) fetchSong()
  }, [artist, songSlug])

useEffect(() => {
  if (!songData) return;

  if (
    songData.background_video &&
    songData.color === 'Red (Classic)'
  ) {
    document.body.classList.add('red-theme-video')
  } else {
    document.body.classList.remove('red-theme-video')
  }
}, [songData])

  // ---------- Show "Rotate Phone" notification on mobile ----------
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowNotification(true)
      const timer = setTimeout(() => setShowNotification(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  // ---------- Init audio buffers and connections ----------
  useEffect(() => {
    if (!stems.length) return;
    const init = async () => {
      setLoadingStems(true)
      setAllReady(false)

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const ctx = new AudioContext()
        await ctx.audioWorklet.addModule('/granular-processor.js')
        audioCtxRef.current = ctx
      }

      const ctx = audioCtxRef.current!
      const eighth = 60 / 120 / 2
      let loadedCount = 0

for (const { label, file } of stems) {
  try {
    const res = await fetch(file)
    const arrayBuffer = await res.arrayBuffer()

const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

    buffersRef.current[label] = audioBuffer

    const gain = ctx.createGain()
    const delay = ctx.createDelay(5.0)
    const feedback = ctx.createGain()

    delay.delayTime.value = eighth
    feedback.gain.value = delaysRef.current[label] || 0
    delay.connect(feedback).connect(delay)
    delay.connect(gain).connect(ctx.destination)

    gainNodesRef.current[label] = gain
    delayNodesRef.current[label] = delay
    feedbackGainsRef.current[label] = feedback

    loadedCount++
    if (loadedCount === stems.length) {
      setLoadingStems(false)
      setAllReady(true)
    }

  } catch (err) {
    console.error(`❌ Failed to decode stem: ${label}`, err)
    alert(`Couldn’t load "${label}". Try trimming it to 5 minutes or less.`)
    setLoadingStems(false)
    return
  }
}

      stems.forEach(({ label }) => {
        delaysRef.current[label] = delays[label] || 0
      })
    }

    init()
  }, [stems])

  // ==================== Playback Logic ====================

  const stopAll = () => {
    Object.values(nodesRef.current).forEach((node) => {
      try {
        node.port.postMessage({ type: 'stop' })
        node.disconnect()
      } catch {}
    })
    nodesRef.current = {}
  }

  useEffect(() => {
    return () => {
      stopAll()
      audioCtxRef.current?.close()
    }
  }, [])


  useEffect(() => {
  return () => {
    document.documentElement.style.removeProperty('--bg')
    document.documentElement.style.removeProperty('--fg')
  }
}, [])


const playAll = async () => {
  let ctx = audioCtxRef.current

  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
    await ctx.audioWorklet.addModule('/granular-processor.js')
    audioCtxRef.current = ctx
  }

  if (ctx.state === 'suspended') await ctx.resume()

  // ✅ Try to play background video if it exists
  const bgVideo = document.querySelector('video') as HTMLVideoElement | null
  console.log('🎥 Background video element:', bgVideo)

  if (bgVideo) {
    try {
      await bgVideo.play()
    } catch (err) {
      console.warn('Background video play blocked:', err)
    }
  }

  stopAll()

  stems.forEach(({ label }) => {
    const buffer = buffersRef.current[label]
    const gain = gainNodesRef.current[label]
    const delay = delayNodesRef.current[label]
    if (!buffer || !gain || !delay) return

    const node = new AudioWorkletNode(ctx, 'granular-player')
    node.port.postMessage({ type: 'load', buffer: buffer.getChannelData(0) })
    
    const playbackRate = isIOS ? 2 - varispeed : varispeed
    node.parameters.get('playbackRate')?.setValueAtTime(playbackRate, ctx.currentTime)

    node.connect(delay)

    const soloed = Object.values(solos).some(Boolean)
    const shouldPlay = soloed ? solos[label] : !mutes[label]
    gain.gain.value = shouldPlay ? volumes[label] : 0

    nodesRef.current[label] = node
  })
}


  useEffect(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const eighth = 60 / 120 / 2

    stems.forEach(({ label }) => {
      const gain = gainNodesRef.current[label]
      const delay = delayNodesRef.current[label]
      const feedback = feedbackGainsRef.current[label]
      if (!gain || !delay || !feedback) return

      const soloed = Object.values(solos).some(Boolean)
      const shouldPlay = soloed ? solos[label] : !mutes[label]
      gain.gain.value = shouldPlay ? volumes[label] : 0

      delay.delayTime.value = eighth
      feedback.gain.setTargetAtTime(delays[label] || 0, ctx.currentTime, 2.5)
    })
  }, [volumes, mutes, solos, delays])

  useEffect(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    Object.values(nodesRef.current).forEach((node) => {
      const playbackRate = isIOS ? 2 - varispeed : varispeed;
      node.parameters.get('playbackRate')?.setValueAtTime(playbackRate, ctx.currentTime)
    })
  }, [varispeed])
if (!songData) return <div className="p-8 text-white">Loading...</div>

return (
  <>
    <style>{`
      input[type="range"]::-webkit-slider-thumb {
        background: ${primary};
      }
      input[type="range"]::-moz-range-thumb {
        background: ${primary};
      }
      input[type="range"]::-ms-thumb {
        background: ${primary};
      }
    `}</style>

    {/* ✅ Background Video */}
    {songData?.background_video &&
      (songData.color === 'Transparent' || songData.color === 'Red (Classic)') && (
        <video
          src={songData.background_video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            objectFit: 'cover',
            zIndex: -1,
            pointerEvents: 'none',
            backgroundColor: '#FCFAEE',
          }}
        />
      )}

    <main
      className={`min-h-screen font-sans relative overflow-y-auto ${
        songData?.color === 'Transparent' && songData?.background_video
          ? 'bg-transparent text-[#B8001F]'
          : 'bg-[#FCFAEE] text-[#B8001F]'
      }`}
    >
      {/* Title */}
      <h1
        className="village text-center px-4 mb-10 mt-10"
        style={{
          fontSize: '96px',
          letterSpacing: '0.05em',
          lineHeight: '1.1',
          color: primary,
        }}
      >
        {songData?.title}
      </h1>

      {/* Rotate Notification */}
      {showNotification && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="bg-[#FCFAEE] text-[#B8001F] px-10 py-6 rounded-xl shadow-lg flex flex-col items-center text-center pointer-events-auto">
            <p className="font-mono text-lg leading-snug">ROTATE<br />YOUR<br />PHONE</p>
          </div>
        </div>
      )}

      {/* Playback Buttons */}
      <div className="flex justify-center mb-12 gap-8 px-4">
        <button
          onClick={playAll}
          disabled={!allReady}
          className={`pressable px-6 py-2 font-mono tracking-wide flex items-center gap-2 ${
            !allReady ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : ''
          }`}
          style={allReady ? { backgroundColor: primary, color: 'white' } : undefined}
        >
          {loadingStems && (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          )}
          Play
        </button>

        <button
          onClick={stopAll}
          className="pressable text-white px-6 py-2 font-mono tracking-wide"
          style={{ backgroundColor: primary }}
        >
          Stop
        </button>

        <button
          onClick={() => {
            setSolos(Object.fromEntries(stems.map(s => [s.label, false])))
            setMutes(Object.fromEntries(stems.map(s => [s.label, false])))
          }}
          style={{ backgroundColor: primary, color: 'white' }}
          className="pressable px-6 py-2 font-mono tracking-wide"
        >
          UNSOLO
        </button>
      </div>

      {/* Mixer Section */}
      <div className="w-full">
        {songData?.color === 'Transparent' ? (
          <TransparentMixerLayout
            stems={stems}
            volumes={volumes}
            setVolumes={setVolumes}
            delays={delays}
            setDelays={setDelays}
            mutes={mutes}
            setMutes={setMutes}
            solos={solos}
            setSolos={setSolos}
            bpm={songData?.bpm}
            varispeed={varispeed}
            setVarispeed={setVarispeed}
            isIOS={isIOS}
            delaysRef={delaysRef}
            backgroundVideo={songData?.background_video}
            primaryColor={primary}
          />
        ) : (
          <>
            {/* Horizontal scroll on mobile portrait */}
            <div className="overflow-x-auto px-4 pb-8 sm:overflow-x-visible">
              <div
                className={`flex justify-start sm:justify-center ${
                  stems.length >= 6 ? 'gap-4' : 'gap-8'
                }`}
                style={{ minWidth: 'max-content' }}
              >
                {/* Your existing `.mixer-module` map stays here */}
                {/* KEEP THIS BLOCK UNCHANGED — no need to rewrite it */}
              </div>
            </div>

            {/* Varispeed: portrait = below modules, landscape = fixed top-right */}
            <div className="block sm:hidden w-full px-4 mb-16">
              <div className="flex flex-col items-center mt-6">
                {bpm && (
                  <div className="mb-1 text-xs font-mono" style={{ color: primary }}>
                    {Math.round(bpm * (isIOS ? 2 - varispeed : varispeed))} BPM
                  </div>
                )}
                <span className="mb-3 text-sm tracking-wider" style={{ color: primary }}>
                  VARISPEED
                </span>
                <VarispeedSlider
                  value={varispeed}
                  onChange={setVarispeed}
                  isIOS={isIOS}
                  primaryColor={primary}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fixed varispeed for landscape only (non-Transparent only) */}
      {songData?.color !== 'Transparent' && (
        <div className="hidden sm:flex absolute right-4 top-[260px] flex-col items-center">
          {bpm && (
            <div className="mb-1 text-xs font-mono" style={{ color: primary }}>
              {Math.round(bpm * (isIOS ? 2 - varispeed : varispeed))} BPM
            </div>
          )}
          <span className="mb-3 text-sm tracking-wider" style={{ color: primary }}>
            VARISPEED
          </span>
          <VarispeedSlider
            value={varispeed}
            onChange={setVarispeed}
            isIOS={isIOS}
            primaryColor={primary}
          />
        </div>
      )}
    </main>
  </>
)}
