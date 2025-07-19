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
  const { artist, songSlug } = useParams() as { artist: string; songSlug: string }
  const [songData, setSongData] = useState<Song | null>(null)
  const [stems, setStems] = useState<Stem[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [delays, setDelays] = useState<Record<string, number>>({})
  const [mutes, setMutes] = useState<Record<string, boolean>>({})
  const [solos, setSolos] = useState<Record<string, boolean>>({})
  const [varispeed, setVarispeed] = useState(1)
  const [bpm, setBpm] = useState<number | null>(null)

  const isIOS = typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent)
  const primary = songData?.primary_color || '#B8001F'

  const delaysRef = useRef<Record<string, number>>({})
  const audioCtxRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<Record<string, AudioBuffer>>({})
  const nodesRef = useRef<Record<string, AudioWorkletNode>>({})
  const gainNodesRef = useRef<Record<string, GainNode>>({})
  const delayNodesRef = useRef<Record<string, DelayNode>>({})
  const feedbackGainsRef = useRef<Record<string, GainNode>>({})

  useEffect(() => {
    const fetchSong = async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_slug', artist)
        .eq('song_slug', songSlug)
        .single()

      if (error || !data) return
      setSongData(data)
      setBpm(data.bpm)
      const parsed = typeof data.stems === 'string' ? JSON.parse(data.stems) : data.stems
      setStems(parsed)
      setVolumes(Object.fromEntries(parsed.map((s: any) => [s.label, 1])))
      setDelays(Object.fromEntries(parsed.map((s: any) => [s.label, 0])))
      setMutes(Object.fromEntries(parsed.map((s: any) => [s.label, false])))
      setSolos(Object.fromEntries(parsed.map((s: any) => [s.label, false])))
    }
    fetchSong()
  }, [artist, songSlug])

  useEffect(() => {
    if (!stems.length) return
    const init = async () => {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const ctx = new AudioContext()
        await ctx.audioWorklet.addModule('/granular-processor.js')
        audioCtxRef.current = ctx
      }

      const ctx = audioCtxRef.current
      const eighth = 60 / 120 / 2

      for (const { label, file } of stems) {
        const res = await fetch(file)
        const arrayBuffer = await res.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer)
        buffersRef.current[label] = buffer

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
      }
    }
    init()
  }, [stems])

  const stopAll = () => {
    Object.values(nodesRef.current).forEach((node) => {
      try {
        node.port.postMessage({ type: 'stop' })
        node.disconnect()
      } catch {}
    })
    nodesRef.current = {}
  }

  const playAll = async () => {
    const ctx = audioCtxRef.current
    if (!ctx) return

    stopAll()

    stems.forEach(({ label }) => {
      const buffer = buffersRef.current[label]
      const gain = gainNodesRef.current[label]
      const delay = delayNodesRef.current[label]
      if (!buffer || !gain || !delay) return

      const node = new AudioWorkletNode(ctx, 'granular-player')
      node.port.postMessage({ type: 'load', buffer: buffer.getChannelData(0) })
      node.parameters.get('playbackRate')?.setValueAtTime(
        isIOS ? 2 - varispeed : varispeed,
        ctx.currentTime
      )
      node.connect(delay)

      const soloed = Object.values(solos).some(Boolean)
      const shouldPlay = soloed ? solos[label] : !mutes[label]
      gain.gain.value = shouldPlay ? volumes[label] : 0

      nodesRef.current[label] = node
    })
  }

  if (!songData) return <div>Loading...</div>

  return (
    <main className="min-h-screen px-4 pt-20 bg-[#FCFAEE] text-[#B8001F]">
      <h1
        className="village text-center mb-12"
        style={{ fontSize: '96px', color: primary }}
      >
        {songData.title}
      </h1>

      <div className="flex justify-center overflow-x-auto md:overflow-visible">
        <div className="flex gap-6 min-w-[min-content]">
          {stems.map(({ label }) => (
            <div
              key={label}
              className="mixer-module"
              style={{ width: '86px', minHeight: '440px', backgroundColor: primary }}
            >
              {/* Your existing fader/mute/solo UI goes here */}
            </div>
          ))}
        </div>
      </div>

      {/* Varispeed - mobile portrait */}
      <div className="block md:hidden mt-10">
        <div className="text-center text-sm font-mono mb-1" style={{ color: primary }}>
          {bpm && `${Math.round(bpm * (isIOS ? 2 - varispeed : varispeed))} BPM`}
        </div>
        <div className="text-center mb-2 text-sm tracking-wider" style={{ color: primary }}>
          VARISPEED
        </div>
        <div className="flex justify-center">
          <VarispeedSlider
            value={varispeed}
            onChange={setVarispeed}
            isIOS={isIOS}
            primaryColor={primary}
          />
        </div>
      </div>

      {/* Varispeed - desktop/landscape */}
      <div className="hidden md:flex absolute right-4 top-[260px] flex-col items-center">
        <div className="mb-1 text-xs font-mono" style={{ color: primary }}>
          {bpm && `${Math.round(bpm * (isIOS ? 2 - varispeed : varispeed))} BPM`}
        </div>
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
    </main>
  )
}
