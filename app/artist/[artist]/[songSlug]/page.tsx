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
  color: string // ✅ Add this
  background_video?: string // ✅ Add this
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

      if (data.color === 'Blue & Yellow') {
        document.documentElement.style.setProperty('--bg', '#001F54')
        document.documentElement.style.setProperty('--fg', '#FFD700')
      } else {
        document.documentElement.style.setProperty('--bg', '#B8001F')
        document.documentElement.style.setProperty('--fg', '#ffffff')
      }

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

    if (artist && songSlug) fetchSong()
  }, [artist, songSlug])

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
<main
  className={`min-h-screen font-sans relative overflow-y-auto ${
    songData?.color === 'Transparent' ? 'bg-transparent' : 'bg-[#FCFAEE]'
  } text-[#B8001F] p-8 landscape:!p-0 landscape:!bg-transparent`}
>


    {/* Title */}
    <h1 className="village text-center mb-16" style={{ fontSize: '96px', letterSpacing: '0.05em', lineHeight: '1.1' }}>{songData?.title}</h1>

    {/* Rotate Notification */}
    {showNotification && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div className="bg-[#FCFAEE] text-[#B8001F] px-10 py-6 rounded-xl shadow-lg flex flex-col items-center text-center pointer-events-auto">
          <p className="font-mono text-lg leading-snug">ROTATE<br />YOUR<br />PHONE</p>
        </div>
      </div>
    )}

    {/* Playback Buttons */}
    <div className="flex justify-center mb-12 gap-8">
      <button
        onClick={playAll}
        disabled={!allReady}
        className={`pressable px-6 py-2 font-mono tracking-wide flex items-center gap-2 ${
          allReady ? 'bg-[#B30000] text-white' : 'bg-gray-400 text-gray-200 cursor-not-allowed'
        }`}
      >
        {loadingStems && (
          <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        )}
        Play
      </button>

      <button onClick={stopAll} className="pressable bg-[#B30000] text-white px-6 py-2 font-mono tracking-wide">Stop</button>

      <button
        onClick={() => {
          setSolos(Object.fromEntries(stems.map(s => [s.label, false])))
          setMutes(Object.fromEntries(stems.map(s => [s.label, false])))
        }}
        className="pressable bg-[#B30000] text-white px-6 py-2 font-mono tracking-wide"
      >
        UNSOLO
      </button>
    </div>

{/* Mixer Modules */}
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
  isIOS={isIOS}
  delaysRef={delaysRef}
  backgroundVideo={songData?.background_video} // ✅ THIS LINE MUST EXIST
/>

) : (
  <div className="flex justify-center">
    <div className={`flex ${stems.length >= 6 ? 'gap-4' : 'gap-8'}`}>
      {stems.map(({ label }) => (
        <div key={label} className="mixer-module" style={{
          width: stems.length >= 6 ? '86px' : '96px',
          minHeight: '440px',
          backgroundColor: '#B30000',
          border: '1px solid #444',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ width: '16px', height: '40px', backgroundColor: '#15803d', borderRadius: '2px', animation: 'pulse 1s infinite', marginBottom: '18px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px', fontSize: '10px', color: 'white' }}>
            <span style={{ marginBottom: '4px' }}>LEVEL</span>
            <input type="range" min="0" max="1" step="0.01" value={volumes[label]} onChange={(e) => {
              setVolumes((prev) => ({ ...prev, [label]: parseFloat(e.target.value) }))
            }} className="volume-slider" style={{
              writingMode: 'bt-lr' as any,
              WebkitAppearance: 'slider-vertical',
              width: '4px',
              height: '150px',
              background: 'transparent',
            }} />
          </div>
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <DelayKnob
              value={delays[label]}
              onChange={(val) => {
                setDelays((prev) => ({ ...prev, [label]: val }))
                delaysRef.current[label] = val
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button onClick={() => {
              setMutes(prev => ({ ...prev, [label]: !prev[label] }))
              setSolos(prev => ({ ...prev, [label]: false }))
            }} style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '4px',
              marginBottom: '8px',
              backgroundColor: mutes[label] ? '#FFD700' : 'white',
              color: mutes[label] ? 'black' : '#B8001F',
              border: 'none',
              cursor: 'pointer',
            }}>MUTE</button>

            <button onClick={() => {
              setSolos(prev => ({ ...prev, [label]: !prev[label] }))
              setMutes(prev => ({ ...prev, [label]: false }))
            }} style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '4px',
              marginBottom: '8px',
              backgroundColor: solos[label] ? '#00FF99' : 'white',
              color: solos[label] ? 'black' : '#B8001F',
              border: 'none',
              cursor: 'pointer',
            }} className={solos[label] ? 'flash' : ''}>SOLO</button>

            <div style={{
              fontSize: '12px',
              padding: '4px 6px',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#B8001F',
              marginTop: '6px',
              display: 'block',
              width: '100%',
              maxWidth: '100%',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxSizing: 'border-box',
            }}>
              {label}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}


    {/* Varispeed Slider */}
    <div className="absolute right-4 top-[260px] flex flex-col items-center">
      {bpm && (
        <div className="mb-1 text-xs text-red-700 font-mono">
          {Math.round(bpm * (isIOS ? 2 - varispeed : varispeed))} BPM
        </div>
      )}
      <span className="mb-3 text-sm text-red-700 tracking-wider">VARISPEED</span>
      <VarispeedSlider value={varispeed} onChange={setVarispeed} isIOS={isIOS} />
    </div>

  </main>
)
}
