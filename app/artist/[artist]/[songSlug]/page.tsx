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
import FullWaveformScrubber from '../../../components/FullWaveformScrubber';






function trimMp3EncoderDelay(buffer: AudioBuffer, ctx: AudioContext): AudioBuffer {
  const OFFSET = 528;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length - OFFSET;

  const trimmed = ctx.createBuffer(
    buffer.numberOfChannels,
    length,
    sampleRate
  );

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.copyToChannel(
      buffer.getChannelData(ch).slice(OFFSET),
      ch
    );
  }

  return trimmed;
}

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
  let lastToggleTime = 0;
  const cycleWaveformBufferRef = useRef<AudioBuffer | null>(null);
  const [cycleReady, setCycleReady] = useState(false);
  const lastStartSampleRef = useRef<Record<string, number>>({});
const lastChunkEndSampleRef = useRef<Record<string, number>>({});
 



  


function trimLeadingSilence(buffer: AudioBuffer, threshold = 0.00005): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  let firstSample = 0;
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) {
      firstSample = i;
      break;
    }
  }

  const trimmedLength = buffer.length - firstSample;
  const trimmed = new AudioContext().createBuffer(buffer.numberOfChannels, trimmedLength, sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const sliced = buffer.getChannelData(ch).slice(firstSample);
    trimmed.copyToChannel(sliced, ch);
  }

  return trimmed;
}

function mergeFloat32Arrays(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}


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
const trimmed = trimMp3EncoderDelay(audioBuffer, ctx);
buffersRef.current[label] = trimmed;

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
const stopAll = async () => {
  const ctx = audioCtxRef.current;
  if (!ctx) return;

  const promises = stems.map(({ label }) => {
    return new Promise<void>((resolve) => {
      const node = nodesRef.current[label];
      if (!node) return resolve();

      const handle = (e: MessageEvent) => {
        if (e.data.type === 'position') {
          positionsRef.current[label] = e.data.position;
          node.port.removeEventListener('message', handle);
          resolve();
        }
      };

      node.port.addEventListener('message', handle);
      node.port.postMessage({ type: 'getPosition' });

      setTimeout(() => {
        node.port.removeEventListener('message', handle);
        resolve();
      }, 500);

      try {
        node.disconnect();
      } catch {}
    });
  });

  await Promise.all(promises);
  nodesRef.current = {};
  setIsPlaying(false);
  isPlayingRef.current = false;
  setAllReady(false);
};

interface CustomWorkletNode extends AudioWorkletNode {
  label?: string;
  started?: boolean;
  appending?: boolean; // ✅ Add this line
}


const cycleStartBar = useRef<number>(0);

// 🔁 Decoder thing
const combinedWaveformBufferRef = useRef<AudioBuffer | null>(null);

useEffect(() => {
  const ctx = new AudioContext();

  const generateCombinedWaveform = async () => {
    if (stems.length === 0) return;

    try {
      const decodedStems = await Promise.all(
        stems.map(async ({ file }) => {
          const res = await fetch(file);
          const buffer = await res.arrayBuffer();
          return await ctx.decodeAudioData(buffer);
        })
      );

      const minLength = Math.min(...decodedStems.map(b => b.length));
      const sampleRate = decodedStems[0].sampleRate;
      const output = ctx.createBuffer(1, minLength, sampleRate);
      const out = output.getChannelData(0);

      for (let i = 0; i < minLength; i++) {
        let sum = 0;
        for (const b of decodedStems) {
          const ch = b.numberOfChannels > 1 ? b.getChannelData(0)[i] : 0;
          sum += ch;
        }
        out[i] = sum / decodedStems.length;
      }

      combinedWaveformBufferRef.current = output;
      console.log('✅ Combined waveform ready');
    } catch (err) {
      console.error('❌ Failed to generate waveform buffer', err);
    }
  };

  generateCombinedWaveform();
}, [stems]);

//PLAY ALL//

const playAll = async () => {
  if (!songData || stems.length === 0) return;

  let ctx = audioCtxRef.current;
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
    await ctx.audioWorklet.addModule(`/granular-processor.js?v=${Date.now()}`);
    audioCtxRef.current = ctx;
  }

  if (ctx.state === 'suspended') await ctx.resume();
  await stopAll();

  const playbackRate = isIOS ? 2 - varispeed : varispeed;
  const bpm = songData.bpm || 120;
  const chunkSec = (60 / bpm) * 16;
  const sampleRate = 44100;
  const chunkSamples = Math.floor(chunkSec * sampleRate);
  const bytesPerSample = 2;
  const channels = 2;

  const effect = typeof songData.effects === 'string'
    ? songData.effects
    : songData.effects?.[0] || '';

  // Step 1: Decode first + second chunk of all stems BEFORE starting
  const firstChunks = await Promise.all(
    stems.map(async ({ label, file }) => {
      const resumeSample = lastStartSampleRef.current[label] || 0;
      const firstEnd = resumeSample + chunkSamples;
      lastChunkEndSampleRef.current[label] = firstEnd;

      const byteStart1 = resumeSample * bytesPerSample * channels;
      const byteEnd1 = firstEnd * bytesPerSample * channels - 1;

      const res1 = await fetch(file, {
        headers: { Range: `bytes=${byteStart1}-${byteEnd1}` },
      });
      const arrayBuffer1 = await res1.arrayBuffer();
      const buffer1 = await ctx.decodeAudioData(arrayBuffer1);

      // Decode second chunk
      const preloadStart = firstEnd;
      const preloadEnd = preloadStart + chunkSamples;
      const byteStart2 = preloadStart * bytesPerSample * channels;
      const byteEnd2 = preloadEnd * bytesPerSample * channels - 1;

      const res2 = await fetch(file, {
        headers: { Range: `bytes=${byteStart2}-${byteEnd2}` },
      });
      const arrayBuffer2 = await res2.arrayBuffer();
      const buffer2 = await ctx.decodeAudioData(arrayBuffer2);

      lastChunkEndSampleRef.current[label] = preloadEnd;

      return { label, file, resumeSample, buffer1, buffer2 };
    })
  );

  const sharedStartTime = ctx.currentTime + 2.0;

  for (const { label, file, resumeSample, buffer1, buffer2 } of firstChunks) {
    const gain = gainNodesRef.current[label];
    if (!gain || !buffer1 || !buffer2) continue;

    const node = new AudioWorkletNode(ctx, 'granular-player', {
      outputChannelCount: [2],
    }) as CustomWorkletNode;

    node.label = label;
    node.started = false;
    node.parameters.get('playbackRate')?.setValueAtTime(playbackRate, ctx.currentTime);
    nodesRef.current[label] = node;

    // Set up polling
    const appendChunk = async () => {
      const start = lastChunkEndSampleRef.current[label];
      const end = start + chunkSamples;

      const byteStart = start * bytesPerSample * channels;
      const byteEnd = end * bytesPerSample * channels - 1;

      try {
        const res = await fetch(file, {
          headers: { Range: `bytes=${byteStart}-${byteEnd}` },
        });
        const arrayBuffer = await res.arrayBuffer();
        const chunk = await ctx.decodeAudioData(arrayBuffer);

        node.port.postMessage({
          type: 'appendBuffer',
          buffer: [
            chunk.getChannelData(0),
            chunk.numberOfChannels > 1 ? chunk.getChannelData(1) : chunk.getChannelData(0),
          ],
        });

        lastChunkEndSampleRef.current[label] = end;
        console.log(`[${label}] ✅ Appended chunk ${start} → ${end}`);
      } catch (err) {
        console.warn(`[${label}] ❌ Chunk append failed`, err);
      }
    };

    node.port.onmessage = (e) => {
      if (e.data.type === 'position') {
        const pos = e.data.position;
        positionsRef.current[label] = pos;
        lastStartSampleRef.current[label] = pos;

        const remaining = lastChunkEndSampleRef.current[label] - pos;
        const secLeft = remaining / sampleRate;
        if (secLeft < 2.0) appendChunk();
      }

      if (e.data.type === 'endOfBuffer') {
        appendChunk();
      }
    };

    const startPolling = () => {
      if (!isPlayingRef.current) return;
      node.port.postMessage({ type: 'getPosition' });
      setTimeout(startPolling, 250);
    };
    startPolling();

    // Post both chunks only AFTER they're ready
    node.port.postMessage({
      type: 'load',
      buffer: [
        buffer1.getChannelData(0),
        buffer1.numberOfChannels > 1 ? buffer1.getChannelData(1) : buffer1.getChannelData(0),
      ],
      absoluteStartTime: sharedStartTime,
      startPosition: resumeSample,
    });

    node.port.postMessage({
      type: 'appendBuffer',
      buffer: [
        buffer2.getChannelData(0),
        buffer2.numberOfChannels > 1 ? buffer2.getChannelData(1) : buffer2.getChannelData(0),
      ],
    });

    const soloed = Object.values(solos).some(Boolean);
    const shouldPlay = soloed ? solos[label] : !mutes[label];
    gain.gain.setValueAtTime(shouldPlay ? volumes[label] : 0, ctx.currentTime);

    if (effect === 'phaser') {
      node.connect(phaserWetRef.current[label]);
      node.connect(phaserDryRef.current[label]);
    } else {
      node.connect(delayNodesRef.current[label]);
    }
  }

  setIsPlaying(true);
  isPlayingRef.current = true;
  setAllReady(true);
};





useEffect(() => {
  return () => {
    stopAll();
    audioCtxRef.current?.close();
  };
}, []);

useEffect(() => {
  const ctx = audioCtxRef.current;
  if (!ctx) return;
  const eighth = 60 / 120 / 2;

  stems.forEach(({ label }) => {
    const gain = gainNodesRef.current[label];
    const delay = delayNodesRef.current[label];
    const feedback = feedbackGainsRef.current[label];
    if (!gain) return;

    const soloed = Object.values(solos).some(Boolean);
    const shouldPlay = soloed ? solos[label] : !mutes[label];
    gain.gain.value = shouldPlay ? volumes[label] : 0;

    if (delay && feedback) {
      delay.delayTime.value = eighth;
      feedback.gain.setTargetAtTime(delays[label] || 0, ctx.currentTime, 2.5);
    }

    const wet = phaserWetRef.current[label];
    const dry = phaserDryRef.current[label];
    if (wet && dry) {
      wet.gain.value = delays[label];
      dry.gain.value = 1 - delays[label];
    }
  });
}, [volumes, mutes, solos, delays]);

useEffect(() => {
  const ctx = audioCtxRef.current;
  if (!ctx) return;
  Object.values(nodesRef.current).forEach((node) => {
    const playbackRate = isInstagram
      ? varispeed
      : isIOS
      ? 2 - varispeed
      : varispeed;
    node.parameters.get('playbackRate')?.setValueAtTime(playbackRate, ctx.currentTime);
  });
}, [varispeed]);

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
      e.preventDefault();
      const now = Date.now();
      if (now - lastToggleTime < 400) return;
      lastToggleTime = now;
      if (!allReady && !isPlayingRef.current) return;
      if (isPlayingRef.current) {
        stopAll();
      } else {
        playAll();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [allReady]);

useEffect(() => {
  if (!isPlaying || stems.length === 0) return;
  let raf: number;
  const update = () => {
    const label = stems[0]?.label;
    const buf = buffersRef.current[label];
    if (label && buf) {
      setScrubPosition((positionsRef.current[label] || 0) / buf.sampleRate);
    }
    raf = requestAnimationFrame(update);
  };
  update();
  return () => {
    cancelAnimationFrame(raf);
  };
}, [isPlaying, stems.length]);

function formatTime(secs: number) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function handleScrub(newPos: number) {
  const label = stems[0]?.label;
  const sampleRate = label
    ? buffersRef.current[label]?.sampleRate || 44100
    : 44100;

  const newPosition = newPos * sampleRate;

  stems.forEach(({ label }) => {
    const node = nodesRef.current[label];
    const buffer = buffersRef.current[label];
    if (!node || !buffer) return;

    positionsRef.current[label] = newPosition;
    node.port.postMessage({ type: 'scrub', newPosition });
  });

  setScrubPosition(newPos);
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

{(() => {
  const label = stems?.[0]?.label || '';
  const buffer = buffersRef.current[label];
  const sampleRate = buffer?.sampleRate || 44100;

  return (
    <FullWaveformScrubber
      buffer={
        buffer ?? new AudioContext().createBuffer(1, 44100, 44100)
      }
      duration={buffer?.duration ?? 30}
      position={
        (positionsRef.current[label] ?? 0) / sampleRate
      }
      bpm={songData?.bpm ?? 120}
      onScrub={(newSeconds: number) => {
        const newSamples = Math.floor(newSeconds * sampleRate);
        stems.forEach(({ label }) => {
          positionsRef.current[label] = newSamples;
        });
        playAll();
      }}
    />
  );
})()}





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
