'use client'

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable prefer-const */

// ==================== 📦 Imports ====================
import { useEffect, useRef, useState, ChangeEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import DelayKnob from '../../../components/DelayKnob'
import ReverbConfigModal from '../../../components/ReverbConfigModal'
import { useParams } from 'next/navigation'
import VarispeedSlider from '../../../components/VarispeedSlider'
import TransparentMixerLayout from '../../../components/TransparentMixerLayout'
import FullWaveformScrubber from '../../../components/FullWaveformScrubber'
// Import Superpowered from CDN at runtime

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

// Add type declarations for Superpowered modules
declare global {
  interface Window {
    SuperpoweredGlue: any;
    SuperpoweredWebAudio: any;
    SuperpoweredTrackLoader: any;
  }
}


// ==================== 🎵 Superpowered Manager Class ====================
class SuperpoweredMixerManager {
  private glue: any = null;
  private wa: any = null;             // SuperpoweredWebAudio instance
  private node: AudioWorkletNode | null = null; // Single audio worklet node with StereoMixer
  private onMessageCallback: ((message: any) => void) | null = null;
  private loadedStems: Set<string> = new Set(); // Track which stems are loaded
  private maxStems: number = 100; // Support up to 100 stems (dynamic mixer system)

  constructor() {
    // Don't call start() in constructor - it will be called explicitly
  }

  public async initialize() {
    await this.start();
  }


  private ensureSuperpoweredLoaded(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as any;
      if (w.SuperpoweredGlue && w.SuperpoweredWebAudio) {
        console.log("Superpowered already loaded");
        return resolve();
      }

      console.log("Loading Superpowered.js...");
      const s = document.createElement("script");
      s.src = "/superpowered/Superpowered.js";
      s.type = "module";
      s.onload = () => {
        console.log("Superpowered.js loaded, checking globals...");
        console.log("SuperpoweredGlue:", w.SuperpoweredGlue);
        console.log("SuperpoweredWebAudio:", w.SuperpoweredWebAudio);
        if (w.SuperpoweredGlue && w.SuperpoweredWebAudio) {
          console.log("Superpowered globals found, resolving...");
          resolve();
        } else {
          console.error("Superpowered loaded but globals missing");
          reject(new Error("Superpowered loaded but globals missing"));
        }
      };
      s.onerror = () => {
        console.error("Failed to load /superpowered/Superpowered.js");
        reject(new Error("Failed to load /superpowered/Superpowered.js"));
      };
      document.head.appendChild(s);
    });
  }

  private async start() {
    try {
      // 1) Load the UMD build which populates window.SuperpoweredGlue & window.SuperpoweredWebAudio
      await this.ensureSuperpoweredLoaded();

      // 2) Instantiate Glue from window
      const { SuperpoweredGlue, SuperpoweredWebAudio } = window as any;
      if (!SuperpoweredGlue || !SuperpoweredWebAudio) {
        throw new Error("Superpowered UMD not loaded (SuperpoweredGlue/SuperpoweredWebAudio missing on window)");
      }

      // 3) Init Glue (NOTE: path is /public => web path /superpowered/superpowered.wasm)
      this.glue = await SuperpoweredGlue.Instantiate(
        process.env.NEXT_PUBLIC_SUPERPOWERED_LICENSE ?? "ExampleLicenseKey-WillExpire-OnNextUpdate",
        "/superpowered/superpowered.wasm"
      );

      console.log(`[SP] v${this.glue.Version()} loaded`);

      // 4) Init WebAudio facade
      this.wa = new SuperpoweredWebAudio(48000, this.glue);
      
      console.log('Superpowered initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Superpowered:', error);
      throw error;
    }

    // 3) Create and connect the worklet node with StereoMixer
    const node = await this.wa!.createAudioNodeAsync(
      "/worklet/playerProcessor.js",         // served from /public
      "PlayerProcessor",                     // MUST match registerProcessor name
      (msg: any) => this.onMessageFromProcessor(msg)
    );

    // If the worklet failed to load or the name didn't match, you'll catch it here:
    if (!node) throw new Error("createAudioNodeAsync returned null/undefined (check path and processor name)");

    node.onprocessorerror = (e: Event) => console.error("[SP] processor error", e);

    // Connect the AudioWorkletNode to the WebAudio destination
    node.connect(this.wa!.audioContext.destination);
    await this.wa!.audioContext.suspend();

    this.node = node; // assign only after it's proven to exist
    console.log("[SP] Mixer manager ready");
    console.log("[SP] Node assigned:", !!this.node);
    console.log("[SP] WA assigned:", !!this.wa);
    console.log("[SP] Glue assigned:", !!this.glue);
    console.log("[SP] isReady:", this.isReady);
  }


  private onMessageFromProcessor(message: any, stemIndex?: number) {
    console.log(`[SP] Message from processor ${stemIndex || 'unknown'}:`, message);
    this.onMessageCallback?.(message);
  }

  setMessageCallback(cb: ((m: any) => void) | null) {
    this.onMessageCallback = cb;
  }

  get isReady() {
    const ready = !!this.node && !!this.wa && !!this.glue;
    console.log("SuperpoweredMixerManager.isReady check:", {
      node: !!this.node,
      wa: !!this.wa,
      glue: !!this.glue,
      isReady: ready
    });
    return ready;
  }

  async loadTrack(url: string, stemIndex: number = 0): Promise<void> {
    if (!this.isReady) throw new Error("Superpowered not initialized");
    if (stemIndex >= this.maxStems) {
      console.warn(`Cannot load more than ${this.maxStems} stems. Skipping stem ${stemIndex}`);
      return;
    }
    
    await this.wa.audioContext.resume();

    console.log(`Loading track ${stemIndex} with Superpowered downloadAndDecode:`, url);
    
    // Send the stem data to the single processor first
    if (this.node?.port) {
      this.node.port.postMessage({ 
        type: "loadStem", 
        payload: { 
          url, 
          stemIndex,
          maxStems: this.maxStems
        } 
      });
      
      // Use the glue's downloadAndDecode method with the worklet node
      this.glue.downloadAndDecode(url, this.node);
    } else {
      throw new Error("Audio worklet node not available");
    }
    
    this.loadedStems.add(url);
    console.log(`Track ${stemIndex} loading request sent and downloadAndDecode called`);
  }

  async loadTrackSequentially(url: string, stemIndex: number = 0): Promise<void> {
    if (!this.isReady) throw new Error("Superpowered not initialized");
    if (stemIndex >= this.maxStems) {
      console.warn(`Cannot load more than ${this.maxStems} stems. Skipping stem ${stemIndex}`);
      return;
    }
    
    // AudioContext should already be resumed when mixer is initialized

    console.log(`Loading track ${stemIndex} sequentially with Superpowered downloadAndDecode:`, url);
    
    // Create a promise that resolves when this specific stem is loaded
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`Timeout waiting for stem ${stemIndex} to load`);
        if (this.node?.port) {
          this.node.port.removeEventListener("message", handleMessage);
        }
        reject(new Error(`Timeout loading stem ${stemIndex}`));
      }, 10000); // 10 second timeout
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data.event === "assetLoaded" && event.data.stemIndex === stemIndex) {
          console.log(`Track ${stemIndex} loaded successfully`);
          clearTimeout(timeout);
          if (this.node?.port) {
            this.node.port.removeEventListener("message", handleMessage);
          }
          this.loadedStems.add(url);
          
          // Forward the event to the main message callback
          this.onMessageCallback?.(event.data);
          
          resolve();
        }
      };
      
      if (this.node?.port) {
        this.node.port.addEventListener("message", handleMessage);
      } else {
        reject(new Error("Audio worklet node not available"));
        return;
      }
      
      // Send the stem data to the single processor first
      console.log(`🎵 Sending loadStem message to worklet for stem ${stemIndex}:`, url);
      if (this.node?.port) {
        this.node.port.postMessage({ 
          type: "loadStem", 
          payload: { 
            url, 
            stemIndex,
            maxStems: this.maxStems
          } 
        });
        
        // Use the glue's downloadAndDecode method with the worklet node
        this.glue.downloadAndDecode(url, this.node);
      } else {
        reject(new Error("Audio worklet node not available for postMessage"));
        return;
      }
    });
  }

  async play() {
    if (!this.isReady) {
      console.error("Superpowered not ready for playback");
      return;
    }
    console.log("Starting playback for all stems...");
    await this.wa.audioContext.resume();
    
    // Send play message to the single processor
    if (this.node?.port) {
      this.node.port.postMessage({ type: "play" });
      console.log("Play message sent to processor");
    } else {
      console.error("Cannot send play message - audio worklet node not available");
    }
  }

  async playStem(stemIndex: number) {
    if (!this.isReady) {
      console.error("Superpowered not ready for playback");
      return;
    }
    console.log(`Starting playback for stem ${stemIndex} only...`);
    await this.wa.audioContext.resume();
    
    // Send play stem message to the single processor
    if (this.node?.port) {
      this.node.port.postMessage({ 
        type: "playStem", 
        payload: { stemIndex } 
      });
      console.log(`Play stem ${stemIndex} message sent to processor`);
    } else {
      console.error("Cannot send playStem message - audio worklet node not available");
    }
  }

  pause() {
    if (!this.isReady) return;
    
    // Send pause message to the single processor
    if (this.node?.port) {
      this.node.port.postMessage({ type: "pause" });
      console.log("Pause message sent to processor");
    } else {
      console.error("Cannot send pause message - audio worklet node not available");
    }
  }

  stop() {
    if (!this.isReady) return;
    
    // Send stop message to the single processor
    if (this.node?.port) {
      this.node.port.postMessage({ type: "stop" });
      console.log("Stop message sent to processor");
    } else {
      console.error("Cannot send stop message - audio worklet node not available");
    }
  }

  seek(seconds: number) {
    if (!this.isReady) return;
    
    // Send seek message to the single processor
    if (this.node?.port) {
      this.node.port.postMessage({ type: "seek", payload: { seconds } });
      console.log(`Seek message sent to processor: ${seconds}s`);
    } else {
      console.error("Cannot send seek message - audio worklet node not available");
    }
  }

  setMessageListener(callback: (message: any) => void) {
    if (this.node) {
      this.node.port.onmessage = callback;
    }
  }

  setParameter(id: string, value: number, stemIndex?: number) {
    if (!this.isReady) return;
    
    // Send parameter change to the single processor
    if (this.node?.port) {
      this.node.port.postMessage({ 
        type: "parameterChange", 
        payload: { id, value, stemIndex } 
      });
      console.log(`Parameter ${id} set to ${value} for stem ${stemIndex || 'all'}`);
    } else {
      console.error("Cannot send parameter change - audio worklet node not available");
    }
  }

  dispose() {
    // Disconnect the single node
    try { 
      this.node?.disconnect(); 
      console.log("Disconnected node");
    } catch (e) {
      console.error("Error disconnecting node:", e);
    }
    this.node = null;
    this.loadedStems.clear();
    this.wa = null;
    this.glue = null;
    this.onMessageCallback = null;
  }
}




// resolve a Supabase storage path to a URL.
async function resolveStemUrl(file: string): Promise<string> {
  if (/^https?:\/\//i.test(file)) return file;

  const clean = file.replace(/^\/+/, "");
  const parts = clean.split("/");
  const bucket = parts.shift()!;
  const objectPath = parts.join("/");

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

// ==================== 🎬 Main Component ====================
export default function MixerPage() {
  try {
    // -------------------- 🔧 State --------------------
    const { artist, songSlug } = useParams() as { artist: string; songSlug: string }
    
    console.log('URL parameters:', { artist, songSlug });
    console.log('Component is rendering...');
  const [songData, setSongData] = useState<Song | null>(null)
  const [stems, setStems] = useState<Stem[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [reverbs, setReverbs] = useState<Record<string, number>>({})
  const [mutes, setMutes] = useState<Record<string, boolean>>({})
  const [solos, setSolos] = useState<Record<string, boolean>>({})
  const [varispeed, setVarispeed] = useState(1)
  const [isNaturalVarispeed, setIsNaturalVarispeed] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [reverbConfigModal, setReverbConfigModal] = useState<{
    isOpen: boolean
    stemLabel: string
    stemIndex: number
    position?: { x: number; y: number }
  }>({ isOpen: false, stemLabel: '', stemIndex: 0 })
  const [reverbConfigs, setReverbConfigs] = useState<Record<string, {
    mix: number
    width: number
    damp: number
    roomSize: number
    predelayMs: number
    lowCutHz: number
    enabled: boolean
  }>>({})
  const [loadingStems, setLoadingStems] = useState(true)
  const [allReady, setAllReady] = useState(false)
  const [loadedStemsCount, setLoadedStemsCount] = useState(0)
  const [totalStemsCount, setTotalStemsCount] = useState(0)
  const [mixerReady, setMixerReady] = useState(false)
  const [bpm, setBpm] = useState<number | null>(null)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const primary = songData?.primary_color || '#B8001F' 
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)
  const [scrubPosition, setScrubPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  let lastToggleTime = 0;

  // -------------------- 🎵 Superpowered Manager Reference --------------------
  const mixerManagerRef = useRef<SuperpoweredMixerManager | null>(null);
  const stemsRef = useRef<Stem[]>([]);
  const totalStemsCountRef = useRef(0);

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

  // ==================== 🎵 Superpowered Initialization ====================
  useEffect(() => {
    let mounted = true;

    const initSuperpowered = async () => {
      try {
        console.log("Initializing Superpowered...");
        const manager = new SuperpoweredMixerManager();
        
        // Set up message callback - use refs to prevent infinite loops
        const messageCallback = (message: any) => {
          if (!mounted) return;

          console.log("📨 Message from processor:", message);

          if (message?.event === "ready") {
            console.log("📨 PlayerProcessor ready");
            // Don't set allReady here - wait for all stems to load
            setLoadingStems(false);
          } else if (message?.event === "assetLoaded") {
            console.log("📨 Asset loaded event received:", message);
            // Track individual stem loads using refs
            setLoadedStemsCount(prev => {
              const newCount = prev + 1;
              const totalCount = stemsRef.current.length || totalStemsCountRef.current;
              console.log(`📨 Asset loaded successfully (${newCount}/${totalCount})`);
              return newCount;
            });
          }
        };
        
        manager.setMessageCallback(messageCallback);

        // Initialize Superpowered and wait for it to complete
        await manager.initialize();
        console.log("Superpowered initialization completed");

        if (mounted) {
          mixerManagerRef.current = manager;
          setMixerReady(true);
          console.log("🎵 Mixer ready state set to true");
          
          // Set up message listener for position updates
          manager.setMessageListener((event: MessageEvent) => {
            if (event.data.event === 'positionUpdate') {
              setCurrentPosition(event.data.position);
              setAudioDuration(event.data.duration);
              setDuration(event.data.duration); // Update scrubber duration
            }
          });
        }
      } catch (err) {
        console.error("Failed to initialize Superpowered:", err);
        if (mounted) {
          setLoadingStems(false);
        }
      }
    };

    initSuperpowered();

    return () => {
      mounted = false;
      if (mixerManagerRef.current) {
        mixerManagerRef.current.setMessageCallback(null); // Clear callback
        mixerManagerRef.current.dispose();
        mixerManagerRef.current = null;
      }
    };
  }, []);

  // ==================== 🧠 Data Loading ====================
  useEffect(() => {
    console.log('🧠 Data Loading useEffect triggered');
    console.log('🧠 artist:', artist);
    console.log('🧠 songSlug:', songSlug);
    console.log('🧠 artist && songSlug:', artist && songSlug);
    
    const fetchSong = async () => {
      console.log('🧠 Fetching song data for:', { artist, songSlug });
      
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_slug', artist)
        .eq('song_slug', songSlug)
        .single()

      console.log('🧠 Supabase response:', { data, error });

      if (error) {
        console.error('Song fetch failed with error:', error);
        return;
      }
      
      if (!data) {
        console.warn('No data found for artist:', artist, 'song:', songSlug);
        console.log('This might mean there is no data in the database for this combination');
        return;
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
      setVolumes(Object.fromEntries(stemObjs.map(s => [s.label, 1])))
      setReverbs(Object.fromEntries(stemObjs.map(s => [s.label, 0])))
      setMutes(Object.fromEntries(stemObjs.map(s => [s.label, false])))
      setSolos(Object.fromEntries(stemObjs.map(s => [s.label, false])))
      
      // Initialize reverb configs with default values
      const defaultReverbConfig = {
        mix: 0.4,
        width: 1.0,
        damp: 0.5,
        roomSize: 0.8,
        predelayMs: 0,
        lowCutHz: 0,
        enabled: true
      }
      setReverbConfigs(Object.fromEntries(stemObjs.map(s => [s.label, defaultReverbConfig])))
    }

    document.documentElement.style.setProperty('--bg', '#B8001F')
    document.documentElement.style.setProperty('--fg', '#ffffff')

    if (artist && songSlug) {
      console.log('🧠 Calling fetchSong with:', { artist, songSlug });
      fetchSong();
    } else {
      console.log('🧠 Not calling fetchSong - missing artist or songSlug');
    }
  }, [artist, songSlug])

  // 🔁 Keep stems up-to-date with songData.stems
  useEffect(() => {
    console.log('🎵 Stems useEffect triggered');
    console.log('🎵 songData?.stems:', songData?.stems);
    
    if (!songData?.stems) {
      console.log('🎵 No stems data, setting empty array');
      setStems([])
      return
    }
    const parsedStems = typeof songData.stems === 'string'
      ? JSON.parse(songData.stems)
      : songData.stems
    console.log('🎵 Parsed stems:', parsedStems);
    
    const usedLabels = new Set<string>()
    const stemObjs: Stem[] = parsedStems.map((stem: any, i: number) => {
      let rawLabel = stem.label?.trim() || stem.file?.split('/').pop() || `Untitled Stem ${i + 1}`
      rawLabel = rawLabel.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
      let label = rawLabel
      while (usedLabels.has(label)) label += `_${i}`
      usedLabels.add(label)
      return { label, file: stem.file }
    })
    console.log('🎵 Setting stems to:', stemObjs);
    setStems(stemObjs);
    stemsRef.current = stemObjs; // Update ref
  }, [songData?.stems])

  // ==================== 🎵 Load All Stems ====================
  useEffect(() => {
    const loadAllTracks = async () => {
      console.log("🎵 loadAllTracks useEffect triggered");
      console.log("🎵 mixerReady:", mixerReady);
      console.log("🎵 stems.length:", stems.length);
      console.log("🎵 stems:", stems);
      console.log("🎵 artist:", artist, "songSlug:", songSlug);
      
      if (!mixerReady || !stems.length) {
        console.log("🎵 Skipping loadAllTracks - conditions not met");
        console.log("🎵 mixerReady:", mixerReady);
        console.log("🎵 stems.length:", stems.length);
        console.log("🎵 stems:", stems);
        return;
      }
      
      // Check if we have valid URL parameters
      if (!artist || !songSlug) {
        console.log("🎵 Skipping loadAllTracks - missing URL parameters");
        return;
      }

      console.log("Starting to load all tracks...");
      setLoadingStems(true);
      setAllReady(false);
      setLoadedStemsCount(0);
      setTotalStemsCount(stems.length);
      totalStemsCountRef.current = stems.length; // Update ref
      console.log(`🎵 Set totalStemsCount to ${stems.length}`);

      try {
        // Load stems sequentially to ensure correct order assignment
        console.log(`🎵 Starting to load ${stems.length} stems sequentially...`);
        
        if (stems.length === 0) {
          console.error("🎵 No stems to load - stems array is empty!");
          setLoadingStems(false);
          return;
        }
        
        for (let index = 0; index < stems.length; index++) {
          const stem = stems[index];
          console.log(`🎵 Processing stem ${index}:`, stem);
          const url = await resolveStemUrl(stem.file);
          console.log(`Loading track ${index}:`, url);
          console.log(`🎵 About to call loadTrackSequentially for stem ${index}`);
          await mixerManagerRef.current!.loadTrackSequentially(url, index);
          console.log(`🎵 loadTrackSequentially completed for stem ${index}`);
          console.log(`Track ${index} loaded successfully`);
        }
        
        console.log("All tracks loaded successfully");
        setLoadingStems(false);
        setAllReady(true);
        console.log("🎵 setAllReady(true) called");
      } catch (e) {
        console.error("Failed to load tracks:", e);
        setLoadingStems(false);
      }
    };

    loadAllTracks();
  }, [stems, mixerReady]);


  // ==================== 🎵 Auto-Play Logic ====================
  useEffect(() => {
    console.log("🎵 Auto-play useEffect triggered - allReady:", allReady, "mixerReady:", mixerReady);
    if (allReady && mixerReady) {
      console.log("🧪 AUTO-TEST: All ready, starting auto-play in 2 seconds...");
      
      const timer = setTimeout(() => {
        if (mixerManagerRef.current?.isReady) {
          console.log("🧪 AUTO-TEST: Executing auto-play...");
          playAll();
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [allReady, mixerReady]);

  // ==================== 🎵 Playback Functions ====================
  const playAll = async () => {
    if (!mixerManagerRef.current) return;
    
    
    await mixerManagerRef.current.play();
    setIsPlaying(true);
    isPlayingRef.current = true;
  };

  const stopAll = async () => {
    if (!mixerManagerRef.current) return;
    mixerManagerRef.current.stop();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setScrubPosition(0);
  };

  // ==================== 🎚️ SCRUBBING & POSITION ====================
  function handleScrub(newPos: number) {
    if (!mixerManagerRef.current) return;
    setScrubPosition(newPos);
    setCurrentPosition(newPos);
    mixerManagerRef.current.seek(newPos);
  }

  // ==================== 🎛️ Parameter Updates ====================
  useEffect(() => {
    if (!mixerManagerRef.current || !stems.length) return;
    
    // Set volume for each individual stem
    stems.forEach((stem, index) => {
      const volume = volumes[stem.label] ?? 1;
      mixerManagerRef.current!.setParameter("volume", volume, index);
    });
  }, [volumes, stems]);


  useEffect(() => {
    if (!mixerManagerRef.current) return;
    // Set varispeed mode: 0 = timeStretch, 1 = natural
    mixerManagerRef.current.setParameter("varispeedMode", isNaturalVarispeed ? 1 : 0);
  }, [isNaturalVarispeed]);

  useEffect(() => {
    if (!mixerManagerRef.current) return;
    mixerManagerRef.current.setParameter("speed", varispeed);
  }, [varispeed]);

  // Reverb parameter updates
  useEffect(() => {
    if (!mixerManagerRef.current || !stems.length) return;
    
    // Set reverb for each individual stem
    stems.forEach((stem, index) => {
      const reverbMix = reverbs[stem.label] ?? 0;
      mixerManagerRef.current!.setParameter("reverb", reverbMix, index);
    });
  }, [reverbs, stems]);

  // ==================== 🎛️ REVERB CONFIGURATION ====================
  const handleReverbConfigOpen = (stemLabel: string, stemIndex: number, position?: { x: number; y: number }) => {
    setReverbConfigModal({
      isOpen: true,
      stemLabel,
      stemIndex,
      position
    })
  }

  const handleReverbConfigClose = () => {
    setReverbConfigModal({
      isOpen: false,
      stemLabel: '',
      stemIndex: 0
    })
  }

  const handleReverbConfigSave = (config: {
    mix: number
    width: number
    damp: number
    roomSize: number
    predelayMs: number
    lowCutHz: number
    enabled: boolean
  }) => {
    const stemLabel = reverbConfigModal.stemLabel
    const stemIndex = reverbConfigModal.stemIndex
    
    // Update the reverb config state
    setReverbConfigs(prev => ({
      ...prev,
      [stemLabel]: config
    }))
    
    // Send all reverb parameters to the worklet
    if (mixerManagerRef.current) {
      mixerManagerRef.current.setParameter("reverbMix", config.mix, stemIndex)
      mixerManagerRef.current.setParameter("reverbWidth", config.width, stemIndex)
      mixerManagerRef.current.setParameter("reverbDamp", config.damp, stemIndex)
      mixerManagerRef.current.setParameter("reverbRoomSize", config.roomSize, stemIndex)
      mixerManagerRef.current.setParameter("reverbPredelay", config.predelayMs, stemIndex)
      mixerManagerRef.current.setParameter("reverbLowCut", config.lowCutHz, stemIndex)
      mixerManagerRef.current.setParameter("reverbEnabled", config.enabled ? 1 : 0, stemIndex)
    }
  }

  // ==================== 🎮 KEYBOARD CONTROLS ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastToggleTime < 200) return;
        lastToggleTime = now;
        
        console.log(`Space pressed - Currently playing: ${isPlayingRef.current}`);
        
        if (isPlayingRef.current) {
          stopAll();
        } else {
          playAll();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ==================== 🎨 UTILITY FUNCTIONS ====================
  function formatTime(secs: number) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ==================== 🎨 RENDER ====================
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
                min-height: 260px !important;
              }
            }
            @media screen and (max-width: 767px) {
              .stems-container::-webkit-scrollbar {
                display: none;
              }
              .stems-container {
                -ms-overflow-style: none;
                scrollbar-width: none;
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
                fontSize: isMobile ? '48px' : '96px',
                letterSpacing: '0.05em',
                lineHeight: '1.1',
                color: primary,
                padding: isMobile ? '0 16px' : '0',
              }}
            >
              {songData?.title}
            </h1>


            {/* ▶️ Playback Controls */}
            <div className={`flex justify-center mb-2 ${isMobile ? 'gap-4' : 'gap-8'} ${isMobile ? 'px-4' : ''}`}>
              <button
                onClick={playAll}
                disabled={!allReady}
                className={`pressable ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide flex items-center gap-2 transition-all duration-200 ${
                  !allReady 
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-60' 
                    : 'hover:opacity-90'
                }`}
                style={allReady ? { backgroundColor: primary, color: 'white' } : undefined}
              >
                {loadingStems && (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                {loadingStems 
                  ? `Loading... (${loadedStemsCount}/${stems.length || totalStemsCount})` 
                  : allReady 
                    ? 'Play' 
                    : `Loading... (${loadedStemsCount}/${stems.length || totalStemsCount})`
                }
              </button>

              <button
                onClick={stopAll}
                className={`pressable text-white ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide`}
                style={{ backgroundColor: primary }}
              >
                Stop
              </button>

              <button
                onClick={() => {
                  // Prevent clicking if audio engine not ready
                  if (mixerManagerRef.current?.isReady !== true) {
                    console.warn('Audio engine not ready, ignoring UNSOLO click');
                    return;
                  }
                  
                  // Update UI state first
                  setSolos(Object.fromEntries(stems.map(s => [s.label, false])))
                  setMutes(Object.fromEntries(stems.map(s => [s.label, false])))
                  
                  // Clear all solo and mute states in audio engine with error handling
                  try {
                    stems.forEach((_, index) => {
                      mixerManagerRef.current!.setParameter("solo", 0, index);
                      mixerManagerRef.current!.setParameter("mute", 0, index);
                    });
                    console.log('Cleared all solo and mute states');
                  } catch (error) {
                    console.error('Failed to clear solo/mute states:', error);
                  }
                }}
                style={{ backgroundColor: primary, color: 'white' }}
                className={`pressable ${isMobile ? 'px-4 py-1 text-sm' : 'px-6 py-2'} font-mono tracking-wide`}
              >
                UNSOLO
              </button>
            </div>

            {/* 🎵 Progress Bar */}
            <div className="w-full max-w-4xl mx-auto mb-8 px-4">
              <div 
                className="bg-gray-200 h-2 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percentage = x / rect.width;
                  const newTime = percentage * duration;
                  handleScrub(newTime);
                }}
              >
                <div 
                  className="h-full transition-all duration-100"
                  style={{ 
                    width: `${duration > 0 ? (currentPosition / duration) * 100 : 0}%`,
                    backgroundColor: primary 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1" style={{ color: primary }}>
                <span>{formatTime(currentPosition)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* 🎚️ Mixer Modules */}
            <div
              className="w-full flex justify-center relative"
              style={{
                padding: isMobile ? '0' : '0',
                overflow: 'hidden',
                height: isMobile ? '420px' : 'auto',
                maxHeight: isMobile ? '420px' : 'none',
                marginTop: '-20px', // Move mixer modules up closer to timestamp
              }}
            >
              {/* Fade indicators for mobile scrolling */}
              {isMobile && (
                <>
                </>
              )}
              <div
                className={`flex ${isMobile ? 'gap-2' : stems.length >= 6 ? 'gap-4' : 'gap-8'} ${isMobile ? 'overflow-x-auto stems-container' : ''}`}
                style={{
                  width: '100%',
                  maxWidth: isMobile ? '100vw' : 'none',
                  justifyContent: isMobile ? 'flex-start' : 'center',
                  flexWrap: 'nowrap',
                  margin: '0 auto',
                  padding: isMobile ? '0 8px' : '0 8px',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch',
                  overflowY: 'hidden',
                  height: '100%',
                  alignItems: 'center',
                }}
              >
                {stems.map(({ label }) => (
                  <div
                    key={label}
                    className="mixer-module"
                    style={{
                      width: isMobile ? '80px' : stems.length >= 6 ? '86px' : '96px',
                      backgroundColor: primary,
                      border: '1px solid #444',
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
                      borderRadius: '10px',
                      padding: isMobile ? '12px' : '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: isMobile ? '420px' : '420px', // Increased height for more colored space
                      justifyContent: 'flex-start',
                      flexShrink: 0,
                      minWidth: isMobile ? '80px' : 'auto',
                    }}
                  >
                    <div style={{ width: '16px', height: isMobile ? '30px' : '40px', marginBottom: isMobile ? '16px' : '18px' }} />

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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volumes[label] || 0}
                          onChange={(e) => {
                            setVolumes((prev) => ({ ...prev, [label]: parseFloat(e.target.value) }))
                          }}
                          className="volume-slider"
                          style={{
                            writingMode: 'bt-lr' as any,
                            WebkitAppearance: 'slider-vertical',
                            width: '4px',
                            height: isMobile ? '140px' : '180px', // Increased height for more volume control length
                            background: 'transparent',
                          }}
                        />
                      </div>
                    </div>

                    {/* Reverb Knob */}
                    <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                      <div className="flex flex-col items-center text-xs select-none" style={{ color: 'white' }}>
                        <span 
                          className="mb-1 cursor-pointer hover:opacity-75"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const stemIndex = stems.findIndex(s => s.label === label)
                            handleReverbConfigOpen(label, stemIndex, { x: e.clientX, y: e.clientY })
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const stemIndex = stems.findIndex(s => s.label === label)
                            handleReverbConfigOpen(label, stemIndex, { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY })
                          }}
                        >
                          REVERB
                        </span>
                        <DelayKnob
                          value={reverbs[label] || 0}
                          onChange={(val) => {
                            setReverbs((prev) => ({ ...prev, [label]: val }))
                          }}
                        />
                      </div>
                    </div>

                    {/* Mute & Solo */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <button
                        onClick={() => {
                          // Prevent rapid clicking
                          if (mixerManagerRef.current?.isReady !== true) {
                            console.warn('Audio engine not ready, ignoring mute click');
                            return;
                          }
                          
                          const stemIndex = stems.findIndex(s => s.label === label);
                          if (stemIndex === -1) {
                            console.warn(`Stem not found: ${label}`);
                            return;
                          }
                          
                          const newMuteState = !mutes[label];
                          
                          // Update UI state first
                          setMutes(prev => ({ ...prev, [label]: newMuteState }))
                          setSolos(prev => ({ ...prev, [label]: false }))
                          
                          // Apply mute to audio engine with error handling
                          try {
                            mixerManagerRef.current.setParameter("mute", newMuteState ? 1 : 0, stemIndex);
                            console.log(`${newMuteState ? 'Muted' : 'Unmuted'} stem ${stemIndex}: ${label}`);
                          } catch (error) {
                            console.error('Failed to set mute parameter:', error);
                            // Revert UI state on error
                            setMutes(prev => ({ ...prev, [label]: !newMuteState }))
                          }
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
                          // Prevent rapid clicking
                          if (mixerManagerRef.current?.isReady !== true) {
                            console.warn('Audio engine not ready, ignoring solo click');
                            return;
                          }
                          
                          const stemIndex = stems.findIndex(s => s.label === label);
                          if (stemIndex === -1) {
                            console.warn(`Stem not found: ${label}`);
                            return;
                          }
                          
                          const newSoloState = !solos[label];
                          
                          // Update UI state first
                          setSolos(prev => ({ ...prev, [label]: newSoloState }))
                          setMutes(prev => ({ ...prev, [label]: false }))
                          
                          // Apply solo to audio engine with error handling
                          try {
                            mixerManagerRef.current.setParameter("solo", newSoloState ? 1 : 0, stemIndex);
                            console.log(`${newSoloState ? 'Soloed' : 'Unsoloed'} stem ${stemIndex}: ${label}`);
                          } catch (error) {
                            console.error('Failed to set solo parameter:', error);
                            // Revert UI state on error
                            setSolos(prev => ({ ...prev, [label]: !newSoloState }))
                          }
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
                          minHeight: '34px',
                          maxHeight: '34px',
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

            {/* 🎚️ Varispeed Slider */}
            {(!isMobilePortrait || stems.length <= 2) && (
              <div
                className="absolute right-4 flex flex-col items-center"
                style={{
                  top: songData?.title.length > 16 ? '350px' : '260px',
                }}
              >
                {bpm !== null && (
                  <div className="mb-1 text-xs font-mono" style={{ color: primary }}>
                    {Math.round(bpm * varispeed)} BPM
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
                  bpm={bpm}
                />
                {/* Mode Toggle Button - Centered below slider */}
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => setIsNaturalVarispeed(!isNaturalVarispeed)}
                    className="px-3 py-2 text-xs font-mono rounded border"
                    style={{ 
                      color: primary,
                      borderColor: primary,
                      backgroundColor: isNaturalVarispeed ? primary + '20' : 'transparent',
                      pointerEvents: 'auto', // Enable pointer events for mobile tapping
                      minHeight: '32px', // Ensure minimum touch target size
                      minWidth: '70px' // Ensure minimum touch target size
                    }}
                    title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                  >
                    {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Portrait Varispeed */}
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
                        {Math.round(bpm * varispeed)} BPM
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
                    <VarispeedSlider
                      value={2 - varispeed}
                      onChange={val => setVarispeed(2 - val)}
                      isIOS={isIOS}
                      primaryColor={primary}
                      stemCount={stems.length}
                    />
                  </div>
                  
                  {/* Mode Toggle Button - Centered below slider for mobile */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                    <button
                      onClick={() => setIsNaturalVarispeed(!isNaturalVarispeed)}
                      className="px-3 py-2 text-xs font-mono rounded border"
                      style={{ 
                        color: primary,
                        borderColor: primary,
                        backgroundColor: isNaturalVarispeed ? primary + '20' : 'transparent',
                        pointerEvents: 'auto', // Enable pointer events for mobile tapping
                        minHeight: '32px', // Ensure minimum touch target size
                        minWidth: '70px' // Ensure minimum touch target size
                      }}
                      title={`Switch to ${isNaturalVarispeed ? 'Time-stretch' : 'Natural'} mode`}
                    >
                      {isNaturalVarispeed ? 'NATURAL' : 'STRETCH'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>


          {/* 🎛️ Reverb Configuration Modal */}
          <ReverbConfigModal
            isOpen={reverbConfigModal.isOpen}
            onClose={handleReverbConfigClose}
            onSave={handleReverbConfigSave}
            initialConfig={reverbConfigs[reverbConfigModal.stemLabel] || {
              mix: 0.4,
              width: 1.0,
              damp: 0.5,
              roomSize: 0.8,
              predelayMs: 0,
              lowCutHz: 0,
              enabled: true
            }}
            stemLabel={reverbConfigModal.stemLabel}
            position={reverbConfigModal.position}
          />
        </>
      )}
    </>
  )
  } catch (error) {
    console.error('Component error:', error);
    return (
      <div className="p-8 text-white">
        <h1>Error</h1>
        <p>Something went wrong: {error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}