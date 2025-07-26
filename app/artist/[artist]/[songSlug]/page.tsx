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
import WaveformScrubber from '../../../components/WaveformScrubber'


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
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false) // <-- Track current playback sync
  const positionsRef = useRef<Record<string, number>>({});
  const [scrubPosition, setScrubPosition] = useState(0); // in seconds
  const [duration, setDuration] = useState(0); // in seconds. 


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


// Set duration based on the first loaded buffer
useEffect(() => {
  if (!stems.length) return;
  const firstLabel = stems[0]?.label;
  const buf = buffersRef.current[firstLabel];
  if (buf) setDuration(buf.duration);
}, [stems, loadingStems]);

useEffect(() => {
  if (!stems.length) return;

  const preloadStems = async () => {
    setLoadingStems(true);
    setAllReady(false);

    let ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext();
      await ctx.audioWorklet.addModule('/granular-processor.js');
      audioCtxRef.current = ctx;
    }

    const effect = typeof songData?.effects === 'string' ? songData.effects : songData?.effects?.[0] || '';

    await Promise.all(stems.map(async ({ label, file }) => {
      if (buffersRef.current[label]) return; // avoid duplicate loads
      const res = await fetch(file);
      const arrayBuffer = await res.arrayBuffer();
      buffersRef.current[label] = await ctx.decodeAudioData(arrayBuffer);

      const gain = ctx.createGain();

      if (effect === 'phaser') {
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        filter.type = 'allpass';
        filter.frequency.value = 1000;
        filter.Q.value = 1;

        lfo.type = 'sine';
        lfo.frequency.value = 0.5;
        lfoGain.gain.value = 500;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();

        filter.connect(wet).connect(gain);
        phaserWetRef.current[label] = wet;
        phaserDryRef.current[label] = dry;

        dry.connect(gain);
        gain.connect(ctx.destination);

        gainNodesRef.current[label] = gain;
      } else {
        const delay = ctx.createDelay(5.0);
        const feedback = ctx.createGain();
        delay.delayTime.value = 60 / 120 / 2;
        feedback.gain.value = delaysRef.current[label] || 0;
        delay.connect(feedback).connect(delay);
        delay.connect(gain).connect(ctx.destination);
        gainNodesRef.current[label] = gain;
        delayNodesRef.current[label] = delay;
        feedbackGainsRef.current[label] = feedback;
      }
    }));

    setLoadingStems(false);
    setAllReady(true);
  };

  preloadStems();
}, [stems]);


// ==================== ▶️ Playback Logic ====================
const stopAll = () => {
  stems.forEach(({ label }) => {
    const node = nodesRef.current[label];
    if (!node) return;
    // Ask processor for its current position
    node.port.postMessage({ type: 'getPosition' }); 
    node.port.onmessage = (e) => {
      if (e.data.type === 'position') {
        positionsRef.current[label] = e.data.position;
      }
    };
    try {
      node.disconnect();
    } catch {}
  });
  nodesRef.current = {};
  setIsPlaying(false);
  isPlayingRef.current = false;
};

const playAll = async () => {
  let ctx = audioCtxRef.current;
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
    await ctx.audioWorklet.addModule('/granular-processor.js');
    audioCtxRef.current = ctx;
  }

  if (ctx.state === 'suspended') await ctx.resume();
  stopAll();

  

  const effect = typeof songData?.effects === 'string' ? songData.effects : songData?.effects?.[0] || '';
  const scheduledTime = ctx.currentTime + 0.1; // 100ms in the future for perfect sync

  let nodeCount = 0; // <--- Track how many nodes are created

  stems.forEach(({ label }) => {
    const buffer = buffersRef.current[label];
    const gain = gainNodesRef.current[label];
    if (!buffer || !gain) return;

    const node = new AudioWorkletNode(ctx, 'granular-player', {
      outputChannelCount: [2], // STEREO!
    });

node.port.onmessage = (e) => {
  if (e.data.type === 'position') {
    positionsRef.current[label] = e.data.position;
  }
};

node.port.postMessage({
  type: 'load',
  buffer: [
    buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(buffer.length),
    buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)
  ],
  startTime: scheduledTime,
  startPosition: positionsRef.current[label] || 0, // <--- THIS LINE!
});

    const playbackRate = isIOS ? 2 - varispeed : varispeed;
    node.parameters.get('playbackRate')?.setValueAtTime(playbackRate, ctx.currentTime);

    const soloed = Object.values(solos).some(Boolean)
    const shouldPlay = soloed ? solos[label] : !mutes[label]
    gain.gain.value = shouldPlay ? volumes[label] : 0

    if (shouldPlay) nodeCount++; // <--- Only count nodes that actually play

    if (effect === 'phaser') {
      const wet = phaserWetRef.current[label]
      const dry = phaserDryRef.current[label]
      if (!wet || !dry) return
      wet.gain.value = delays[label]
      dry.gain.value = 1 - delays[label]
      node.connect(dry)
      node.connect(wet)
    } else {
      const delay = delayNodesRef.current[label]
      if (!delay) return
      node.connect(delay)
    }

    nodesRef.current[label] = node
  });

  // Only set playing state if there are active nodes!
  if (nodeCount > 0) {
    setIsPlaying(true);
    isPlayingRef.current = true;
  } else {
    setIsPlaying(false);
    isPlayingRef.current = false;
  }
}


  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      stopAll()
      audioCtxRef.current?.close()
    }
  }, [])

  // Playback volume, delay, and wet/dry value sync
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

  // Varispeed sync
  useEffect(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    Object.values(nodesRef.current).forEach((node) => {
      const playbackRate = isInstagram ? varispeed : (isIOS ? 2 - varispeed : varispeed)
      node.parameters.get('playbackRate')?.setValueAtTime(playbackRate, ctx.currentTime)
    })
  }, [varispeed])

// ==================== ⌨️ Space Bar Play/Stop (Robust with isPlaying) ====================
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // ...
    if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
      e.preventDefault();
      if (!allReady) return;
      if (isPlaying) {
        stopAll();
      } else {
        playAll();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [allReady, isPlaying]);




useEffect(() => {
  if (!isPlaying) return;
  let raf: number;
  const update = () => {
    const label = stems[0]?.label;
    const buf = buffersRef.current[label];
    if (buf) {
      setScrubPosition((positionsRef.current[label] || 0) / buf.sampleRate);
    }
    raf = requestAnimationFrame(update);
  };
  update();
  return () => {
    cancelAnimationFrame(raf);
  };
}, [isPlaying, stems.length]);


// Helper to format seconds as mm:ss
function formatTime(secs: number) {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Handle user scrub (seek)
function handleScrub(newPos: number) {
  // 1. Stop playback, update positions, then restart
  const wasPlaying = isPlaying; // track current playing state
  stopAll();
  stems.forEach(({ label }) => {
    positionsRef.current[label] = newPos * (buffersRef.current[label]?.sampleRate || 44100);
  });
  setScrubPosition(newPos);
  if (wasPlaying) {
    playAll();
  }
}


return (
  <>
    {!songData ? (
      <div className="p-8 text-white">Loading...</div>
    ) : (
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
        <div className="flex justify-center mb-2 gap-8">
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

{/* === SCRUBBER / TIMELINE === */}
{duration > 0 && (
<WaveformScrubber
  buffer={buffersRef.current[stems[0]?.label]}
  scrubPosition={scrubPosition}
  duration={duration}
  primary={primary}
  onScrub={handleScrub}
/>
)}



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
                    height: isMobile ? '450px' : undefined,
                    justifyContent: 'flex-start',
                  }}
                >
                  <div style={{ width: '16px', height: isMobile ? '40px' : '40px', marginBottom: isMobile ? '20px' : '18px' }} />

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      fontSize: '10px',
                      color: 'white',
                      flexGrow: 1,
                      justifyContent: 'center',
                      marginBottom: isMobile ? '20px' : '30px',
                    }}
                  >
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
                        height: isMobile ? '150px' : '150px',
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
                        marginBottom: isMobile ? '14px' : '8px',
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
                        minHeight: '34px', // Reserve enough vertical space for 2 lines
                        maxHeight: '34px', // Prevents label from getting taller than this
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
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
            {Math.round(bpm * (isInstagram ? varispeed : isIOS ? 2 - varispeed : varispeed))} BPM
          </div>
        )}
        <span className="mb-3 text-sm tracking-wider" style={{ color: primary }}>
          VARISPEED
        </span>
        {/* DESKTOP/LANDSCAPE: use varispeed as-is */}
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
            style={{
              pointerEvents: 'none',
              marginTop: '0px',
            }}
          >
            {bpm !== null && (
              <div className="text-xs font-mono mb-1" style={{ color: primary }}>
                {Math.round(bpm * (isInstagram ? varispeed : isIOS ? 2 - varispeed : varispeed))} BPM
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
              top: '-118px',
            }}
          >
            {/* MOBILE PORTRAIT: invert value and onChange */}
            <VarispeedSlider
              value={2 - varispeed}
              onChange={val => setVarispeed(2 - val)}
              isIOS={isIOS}
              primaryColor={primary}
              stemCount={stems.length}
            />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main> 
    </>
  )}
</>
)
}
