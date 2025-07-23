'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

// ==================== 📦 Imports ====================
import { useEffect, useRef, useState, ChangeEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import DelayKnob from '../../../components/DelayKnob'
import { useParams } from 'next/navigation'
import VarispeedSlider from '../../../components/VarispeedSlider'
import TransparentMixerLayout from '../../../components/TransparentMixerLayout'


// ==================== 🧾 Types ====================
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
  primary_color?: string
}

export type Stem = {
  label: string
  file: string
}

// ==================== 🎬 Main Component ====================
export default function MixerPage() {
  // -------------------- 🔧 State --------------------
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
  const primary = songData?.primary_color || '#B8001F' 
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)

  // ==================== BROWSER DETECTION ====================
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isInstagram = ua.includes('Instagram');

  // -------------------- 📱 Device Detection --------------------
  useEffect(() => {
    const check = () => {
      if (typeof window !== 'undefined') {
        const isPortrait = window.innerWidth < 768 && window.innerHeight > window.innerWidth
        setIsMobilePortrait(isPortrait)
      }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const landscape = window.innerWidth < 768 && window.innerWidth > window.innerHeight
        setIsMobileLandscape(landscape)
      }
    }
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    return () => window.removeEventListener('resize', checkOrientation)
  }, [])

  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)

  // -------------------- 🔌 Audio References --------------------
  const delaysRef = useRef<Record<string, number>>({})
  const audioCtxRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Record<string, AudioBuffer>>({})
  const nodesRef = useRef<Record<string, AudioWorkletNode>>({})
  const gainNodesRef = useRef<Record<string, GainNode>>({})
  const delayNodesRef = useRef<Record<string, DelayNode>>({})
  const feedbackGainsRef = useRef<Record<string, GainNode>>({})
  const phaserWetRef = useRef<Record<string, GainNode>>({})
  const phaserDryRef = useRef<Record<string, GainNode>>({})

  // ==================== 🧠 Effects Logic ====================
  useEffect(() => {
    console.log('artist:', artist, 'songSlug:', songSlug)
    const fetchSong = async () => {
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
      setVolumes(Object.fromEntries(stemObjs.map(s => [s.label, 1])))
      setDelays(Object.fromEntries(stemObjs.map(s => [s.label, 0])))
      setMutes(Object.fromEntries(stemObjs.map(s => [s.label, false])))
      setSolos(Object.fromEntries(stemObjs.map(s => [s.label, false])))
    }

    document.documentElement.style.setProperty('--bg', '#B8001F')
    document.documentElement.style.setProperty('--fg', '#ffffff')

    if (artist && songSlug) fetchSong()
  }, [artist, songSlug])

  // 🔁 Always keep stems up-to-date with songData.stems
useEffect(() => {
  if (!songData?.stems) {
    setStems([])
    return
  }
  // parse stems and label logic
  const parsedStems = typeof songData.stems === 'string'
    ? JSON.parse(songData.stems)
    : songData.stems
  const usedLabels = new Set<string>()
  const stemObjs: Stem[] = parsedStems.map((stem: any, i: number) => {
    let rawLabel = stem.label?.trim() || stem.file?.split('/').pop() || `Untitled Stem ${i + 1}`
    rawLabel = rawLabel.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
    let label = rawLabel
    while (usedLabels.has(label)) label += `_${i}`
    usedLabels.add(label)
    return { label, file: stem.file }
  })
  setStems(stemObjs)
}, [songData?.stems])

  // -------------------- 🌊 Init Audio & Effects --------------------
  useEffect(() => {
    if (!stems.length) return
    const init = async () => {
      setLoadingStems(true)
      setAllReady(false)

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const ctx = new AudioContext()
        await ctx.audioWorklet.addModule('/granular-processor.js')
        audioCtxRef.current = ctx
      }

      const ctx = audioCtxRef.current!
      let loadedCount = 0
      const effect = typeof songData?.effects === 'string' ? songData.effects : songData?.effects?.[0] || ''

      for (const { label, file } of stems) {
        try {
          const res = await fetch(file)
          const arrayBuffer = await res.arrayBuffer()
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
          buffersRef.current[label] = audioBuffer

          const gain = ctx.createGain()

          if (effect === 'phaser') {
            const dry = ctx.createGain()
            const wet = ctx.createGain()
            const filter = ctx.createBiquadFilter()
            const lfo = ctx.createOscillator()
            const lfoGain = ctx.createGain()

            filter.type = 'allpass'
            filter.frequency.value = 1000
            filter.Q.value = 1

            lfo.type = 'sine'
            lfo.frequency.value = 0.5
            lfoGain.gain.value = 500
            lfo.connect(lfoGain).connect(filter.frequency)
            lfo.start()

            filter.connect(wet).connect(gain)
            phaserWetRef.current[label] = wet
            phaserDryRef.current[label] = dry

            dry.connect(gain)
            gain.connect(ctx.destination)

            gainNodesRef.current[label] = gain
          } else {
            const delay = ctx.createDelay(5.0)
            const feedback = ctx.createGain()
            delay.delayTime.value = 60 / 120 / 2
            feedback.gain.value = delaysRef.current[label] || 0
            delay.connect(feedback).connect(delay)
            delay.connect(gain).connect(ctx.destination)
            gainNodesRef.current[label] = gain
            delayNodesRef.current[label] = delay
            feedbackGainsRef.current[label] = feedback
          }

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
    }

    init()
  }, [stems])

  // ==================== ▶️ Playback Logic ====================
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
    stopAll()

    const effect = typeof songData?.effects === 'string' ? songData.effects : songData?.effects?.[0] || ''

const scheduledTime = ctx.currentTime + 0.1; // 100ms in the future for perfect sync

stems.forEach(({ label }) => {
  const buffer = buffersRef.current[label]
  const gain = gainNodesRef.current[label]
  if (!buffer || !gain) return

  const node = new AudioWorkletNode(ctx, 'granular-player', {
    outputChannelCount: [2], // STEREO!
  });

  node.port.postMessage({
    type: 'load',
    buffer: [
      buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(buffer.length),
      buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)
    ],
    startTime: scheduledTime, // <-- THE KEY LINE FOR SYNC!
  });

      const playbackRate = isIOS ? 2 - varispeed : varispeed
      node.parameters.get('playbackRate')?.setValueAtTime(playbackRate, ctx.currentTime)

      const soloed = Object.values(solos).some(Boolean)
      const shouldPlay = soloed ? solos[label] : !mutes[label]
      gain.gain.value = shouldPlay ? volumes[label] : 0

      if (effect === 'phaser') {
        const wet = phaserWetRef.current[label]
        const dry = phaserDryRef.current[label]
        if (!wet || !dry) return
        wet.gain.value = delays[label] // use knob as wet mix
        dry.gain.value = 1 - delays[label]
        node.connect(dry)
        node.connect(wet)
      } else {
        const delay = delayNodesRef.current[label]
        if (!delay) return
        node.connect(delay)
      }

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
      if (!gain) return

      const soloed = Object.values(solos).some(Boolean)
      const shouldPlay = soloed ? solos[label] : !mutes[label]
      gain.gain.value = shouldPlay ? volumes[label] : 0

      if (delay && feedback) {
        delay.delayTime.value = eighth
        feedback.gain.setTargetAtTime(delays[label] || 0, ctx.currentTime, 2.5)
      }

      const wet = phaserWetRef.current[label]
      const dry = phaserDryRef.current[label]
      if (wet && dry) {
        wet.gain.value = delays[label]
        dry.gain.value = 1 - delays[label]
      }

      
    })

  }, [volumes, mutes, solos, delays])
  
useEffect(() => {
  const ctx = audioCtxRef.current
  if (!ctx) return
  Object.values(nodesRef.current).forEach((node) => {
    const playbackRate = isInstagram ? varispeed : (isIOS ? 2 - varispeed : varispeed)
    node.parameters.get('playbackRate')?.setValueAtTime(playbackRate, ctx.currentTime)
  })
}, [varispeed])
   if (!songData) return <div className="p-8 text-white">Loading...</div>

  return (
    <>
      {/* 🎨 Global Inline Styles */}
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

        @media screen and (max-width: 767px) and (orientation: landscape) {
          .mixer-module {
            min-height: 220px !important;
          }
        }
      `}</style>

      {/* 🎥 Background Video */}
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

      {/* 🧱 Main Layout */}
      <main
        className={`min-h-screen font-sans relative ${
          songData?.color === 'Transparent' && songData?.background_video
            ? 'bg-transparent text-[#B8001F]'
            : 'bg-[#FCFAEE] text-[#B8001F]'
        }`}
        style={{
          minHeight: '100dvh',
          paddingBottom: '80px',
        }}
      >
        {/* 🏷️ Song Title */}
        <h1
          className="village text-center mb-16"
          style={{
            fontSize: '96px',
            letterSpacing: '0.05em',
            lineHeight: '1.1',
            color: primary,
          }}
        >
          {songData?.title}
        </h1>

        {/* 🔁 Rotate Phone Notification */}
        {showNotification && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            <div className="bg-[#FCFAEE] text-[#B8001F] px-10 py-6 rounded-xl shadow-lg flex flex-col items-center text-center pointer-events-auto">
              <p className="font-mono text-lg leading-snug">ROTATE<br />YOUR<br />PHONE</p>
            </div>
          </div>
        )}

        {/* ▶️ Playback Controls */}
        <div className="flex justify-center mb-12 gap-8">
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

        {/* 🎚️ Mixer Modules */}
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
          <div
            className="w-full flex justify-center sm:overflow-visible overflow-x-auto"
            style={{
              transform:
                typeof window !== 'undefined' &&
                window.innerWidth < 768 &&
                window.innerWidth > window.innerHeight
                  ? 'scale(0.85)'
                  : 'scale(1)',
              transformOrigin: 'top center',
            }}
          >
            <div
              className={`flex ${stems.length >= 6 ? 'gap-4' : 'gap-8'} px-2`}
              style={{
                minWidth: stems.length <= 4 ? '100%' : 'max-content',
                justifyContent: stems.length <= 4 ? 'center' : 'flex-start',
                margin: '0 auto',
              }}
            >
              {stems.map(({ label }) => (
                <div
                  key={label}
                  className="mixer-module"
                  style={{
                    width: stems.length >= 6 ? '86px' : '96px',
                    backgroundColor: primary,
                    border: '1px solid #444',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ width: '16px', height: '40px', backgroundColor: '#15803d', borderRadius: '2px', animation: 'pulse 1s infinite', marginBottom: '18px' }} />
                  
                  {/* LEVEL Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px', fontSize: '10px', color: 'white' }}>
                    <span style={{ marginBottom: '4px' }}>LEVEL</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volumes[label]}
                      onChange={(e) => {
                        setVolumes((prev) => ({ ...prev, [label]: parseFloat(e.target.value) }))
                      }}
                      className="volume-slider"
                      style={{
                        writingMode: 'bt-lr' as any,
                        WebkitAppearance: 'slider-vertical',
                        width: '4px',
                        height: '150px',
                        background: 'transparent',
                      }}
                    />
                  </div>

                  {/* Delay Knob */}
                  <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                    <DelayKnob
                      value={delays[label]}
                      onChange={(val) => {
                        setDelays((prev) => ({ ...prev, [label]: val }))
                        delaysRef.current[label] = val
                      }}
                    />
                  </div>

                  {/* Mute & Solo */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        setMutes(prev => ({ ...prev, [label]: !prev[label] }))
                        setSolos(prev => ({ ...prev, [label]: false }))
                      }}
                      style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        backgroundColor: mutes[label] ? '#FFD700' : '#FCFAEE',
                        color: mutes[label] ? 'black' : primary,
                        border: `1px solid ${primary}`,
                        cursor: 'pointer',
                      }}
                    >
                      MUTE
                    </button>

                    <button
                      onClick={() => {
                        setSolos(prev => ({ ...prev, [label]: !prev[label] }))
                        setMutes(prev => ({ ...prev, [label]: false }))
                      }}
                      style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        backgroundColor: solos[label] ? '#00FF99' : '#FCFAEE',
                        color: solos[label] ? 'black' : primary,
                        border: `1px solid ${primary}`,
                        cursor: 'pointer',
                      }}
                      className={solos[label] ? 'flash' : ''}
                    >
                      SOLO
                    </button>

                    {/* Label */}
                    <div
                      style={{
                        fontSize: '12px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#FCFAEE',
                        color: primary,
                        marginTop: '6px',
                        display: 'block',
                        width: '100%',
                        maxWidth: '100%',
                        textAlign: 'center',
                        whiteSpace: 'normal',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        wordBreak: 'normal',
                        lineHeight: '1.2',
                        boxSizing: 'border-box',
                        border: `1px solid ${primary}`,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🎚️ Varispeed Slider */}
        {songData?.color !== 'Transparent' && (
          <>
            {/* Desktop / Landscape */}
            {(!isMobilePortrait || stems.length <= 2) && (
              <div
                className="absolute right-4 flex flex-col items-center"
                style={{
                  top: songData?.title.length > 16 ? '350px' : '260px',
                }}
              >
                {bpm !== null && (
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

            {/* Mobile Portrait w/ 3+ stems */}
            {isMobilePortrait && stems.length >= 3 && (
              <div className="w-full flex justify-center sm:hidden">
                <div
                  className="relative"
                  style={{
                    marginTop: '12px',
                    width: '350px',
                    height: '140px',
                  }}
                >
                  <div
                    className="absolute top-0 left-0 w-full flex flex-col items-center"
                    style={{ pointerEvents: 'none' }}
                  >
                    {bpm !== null && (
                      <div className="text-xs font-mono mb-1" style={{ color: primary }}>
                        {Math.round(bpm * (isIOS ? 2 - varispeed : varispeed))} BPM
                      </div>
                    )}
                    <div className="text-sm tracking-wider" style={{ color: primary }}>
                      VARISPEED
                    </div>
                  </div>

                  <div
                    className="absolute left-1/2"
                    style={{
                      transform: 'translateX(-50%) rotate(-90deg)',

                      top: '-96px',
                    }}
                  >
<VarispeedSlider
  value={2 - varispeed}
  onChange={(val) => setVarispeed(2 - val)}
  isIOS={isIOS}
  primaryColor={primary}
  stemCount={stems.length} // 👈 pass this in only in the mobile portrait 3+ stems block!
/>

                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
