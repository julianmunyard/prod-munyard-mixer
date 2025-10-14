// Import the superpowered library from the local files
import { SuperpoweredWebAudio } from "/superpowered/Superpowered.js";

class PlayerProcessor extends SuperpoweredWebAudio.AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.players = []; // Array of AdvancedAudioPlayer instances (unlimited)
    this.mixers = []; // Array of StereoMixer instances (one per 4 stems)
    this.reverbs = []; // Array of Reverb instances (one per stem)
    this.globalFlanger = null; // Single global flanger for final output
    this.isPlaying = false;
    this.isReady = false; // Track if worklet is ready
    this.loadedStems = new Set(); // Track which stems are loaded
    this.urlToStemIndex = new Map(); // Map URLs to stem indices for proper assignment
    this.maxStemsPerMixer = 4; // Each StereoMixer supports up to 4 stereo inputs
    this.totalStems = 0; // Total number of stems to be loaded
    this.stemGains = []; // Dynamic gain array for each stem
    this.reverbMix = []; // Reverb mix levels for each stem (0-1)
    this.stemMutes = []; // Mute state for each stem (true/false)
    this.stemSolos = []; // Solo state for each stem (true/false)
    this.outputGain = 1; // Master output gain
    this.mixerOutputBuffers = []; // Output buffers for each mixer
    this.finalMixer = null; // Final mixer to combine all mixer outputs
    this.cascadingMixers = []; // Array of cascading mixers for unlimited stems
    this.finalMixers = []; // Array of final mixers for multiple groups
    this.currentPosition = 0; // Current playback position in seconds
    this.duration = 0; // Total duration of the audio
    this.varispeedMode = 'natural'; // 'timeStretch' or 'natural' - controls how varispeed behaves
  }

  // Runs after the constructor
  onReady() {
    console.log("🎵 PlayerProcessor onReady - initializing worklet");
    
    // Pre-allocate output buffers for each stem (following Superpowered guide)
    this.stemOutputBuffers = [];
    
    // Create final mixer for combining all mixer outputs
    this.finalMixer = new this.Superpowered.StereoMixer();
    
    // Create global flanger for final output (EXACTLY like official Superpowered example)
    this.globalFlanger = new this.Superpowered.Flanger(this.samplerate);
    this.globalFlanger.enabled = true; // EXACTLY like official example
    this.globalFlanger.wet = 0.0; // Start with no effect
    this.globalFlanger.depth = 0.16; // Default depth from docs
    this.globalFlanger.lfoBeats = 16; // Default LFO from docs
    this.globalFlanger.bpm = 128; // Default BPM from docs
    this.globalFlanger.clipperThresholdDb = -3; // Default from docs
    this.globalFlanger.clipperMaximumDb = 6; // Default from docs
    this.globalFlanger.stereo = false; // Default from docs
    console.log("🎵 Created global flanger with DEFAULT settings (enabled=true, wet=0.0)");
    
    
    // Mark as ready
    this.isReady = true;

    console.log("🎵 PlayerProcessor ready - waiting for stem count to create players and mixers");

    // Process any queued stems
    this.processQueuedStems();

    // Pass an event object over to the main scope to tell it everything is ready
    this.sendMessageToMainScope({ event: 'ready' });
    // Also send the Superpowered-specific ready message
    this.port.postMessage('___superpowered___onready___');
  }

  // Process any stems that were queued before the worklet was ready
  processQueuedStems() {
    if (this.urlToStemIndex.size > 0) {
      console.log(`🎵 Processing ${this.urlToStemIndex.size} queued stems`);
      
      // Find the maximum stem index to determine how many stems we need
      let maxStemIndex = -1;
      for (const stemIndex of this.urlToStemIndex.values()) {
        maxStemIndex = Math.max(maxStemIndex, stemIndex);
      }
      
      if (maxStemIndex >= 0) {
        const maxStems = maxStemIndex + 1;
        console.log(`🎵 Creating players and mixers for ${maxStems} queued stems`);
        this.createPlayersAndMixers(maxStems);
      }
    }
  }

  // onDestruct is called when the parent destruct() method is called
  // Create players and mixers dynamically based on stem count
  createPlayersAndMixers(stemCount) {
    console.log(`🎵 Creating players and mixers for ${stemCount} stems`);
    
    this.totalStems = stemCount;
    
    // Calculate how many mixers we need (one per 4 stems)
    const numMixers = Math.ceil(stemCount / this.maxStemsPerMixer);
    console.log(`🎵 Need ${numMixers} mixers for ${stemCount} stems`);
    
     // Initialize stem gains array and reverb mix levels
    this.stemGains = new Array(stemCount).fill(1);
    this.reverbMix = new Array(stemCount).fill(0.0);
    this.stemMutes = new Array(stemCount).fill(false);
    this.stemSolos = new Array(stemCount).fill(false);
     console.log("🎵 Initialized stem gains:", this.stemGains);
     console.log("🎵 Initialized reverb mix levels:", this.reverbMix);
    
    // Create players for all stems
    for (let i = 0; i < stemCount; i++) {
      const player = new this.Superpowered.AdvancedAudioPlayer(
        this.samplerate, // The initial sample rate in Hz
        2, // numberOfChannels
        2, // numberOfVoices
        0, // voiceStealing
        0.501, // minimumBeatSize
        2.0, // maximumBeatSize
        false // enablePhaseInversion
      );
      
      player.loopOnEOF = true;
      this.players.push(player);
      
      // Pre-allocate output buffer for this stem
      const outputBuffer = new this.Superpowered.Float32Buffer(1024 * 2); // stereo = 2 channels
      this.stemOutputBuffers.push(outputBuffer);
      
      // Create reverb instance for this stem
      const reverb = new this.Superpowered.Reverb(
        this.samplerate, // The initial sample rate in Hz
        44100 // Maximum sample rate (affects memory usage)
      );
      reverb.enabled = true;
      reverb.mix = 0.0; // Start with no reverb
      reverb.roomSize = 0.8;
      reverb.damp = 0.5;
      reverb.width = 1.0;
      reverb.predelayMs = 0;
      reverb.lowCutHz = 0;
      this.reverbs.push(reverb);
      
    }
    
     // Create mixers (one per 4 stems) - this is what makes all stems play together
     console.log(`🎵 Creating ${numMixers} mixers for ${stemCount} stems`);
     console.log(`🎵 Each mixer will handle up to ${this.maxStemsPerMixer} stems`);
     
     for (let i = 0; i < numMixers; i++) {
       try {
         const mixer = new this.Superpowered.StereoMixer();
         if (mixer) {
           this.mixers.push(mixer);
           console.log(`🎵 Created mixer ${i} successfully`);
         } else {
           console.error(`🎵 Failed to create mixer ${i}`);
           this.mixers.push(null);
         }
         
         // Create output buffer for this mixer
         const mixerOutputBuffer = new this.Superpowered.Float32Buffer(1024 * 2);
         if (mixerOutputBuffer && mixerOutputBuffer.pointer) {
           this.mixerOutputBuffers.push(mixerOutputBuffer);
           console.log(`🎵 Created mixer output buffer ${i} successfully`);
         } else {
           console.error(`🎵 Failed to create mixer output buffer ${i}`);
           this.mixerOutputBuffers.push(null);
         }
       } catch (error) {
         console.error(`🎵 Error creating mixer ${i}:`, error);
         this.mixers.push(null);
         this.mixerOutputBuffers.push(null);
       }
     }
     
     console.log(`🎵 Successfully created ${this.mixers.filter(m => m).length} mixers out of ${numMixers} requested`);
     console.log(`🎵 Successfully created ${this.mixerOutputBuffers.filter(b => b).length} mixer output buffers out of ${numMixers} requested`);
     
     // Create multiple final mixers to handle unlimited stems
     this.createMultipleFinalMixers(numMixers);
     
     console.log(`🎵 Created ${numMixers} mixers for ${stemCount} stems - this makes all stems play together`);
    
     console.log(`🎵 Created ${this.players.length} players, ${this.mixers.length} mixers, and ${this.stemOutputBuffers.length} stem buffers`);
  }
  
  // Create multiple final mixers to handle unlimited stems
  createMultipleFinalMixers(numMixers) {
    console.log(`🎵 Creating final mixers for ${numMixers} mixers`);
    
    // Clear existing final mixers
    this.finalMixers.forEach(mixer => {
      if (mixer && typeof mixer.destruct === 'function') {
        try {
          mixer.destruct();
        } catch (error) {
          console.error(`🎵 Error destructing final mixer:`, error);
        }
      }
    });
    this.finalMixers = [];
    
    // We only need the main final mixer for the simplified approach
    console.log(`🎵 Using single final mixer for all ${numMixers} mixers`);
  }
  
  // Process multiple final mixers to handle unlimited stems
  processCascadingMixers(outputBuffer, buffersize) {
    // Simple approach: just use the first 4 mixer outputs directly
    const finalMixerInputs = [null, null, null, null];
    
    // Use up to 4 mixer outputs as inputs to the final mixer
    for (let i = 0; i < Math.min(4, this.mixers.length); i++) {
      if (this.mixerOutputBuffers[i] && this.mixerOutputBuffers[i].pointer) {
        finalMixerInputs[i] = this.mixerOutputBuffers[i].pointer;
      }
    }
    
    // Mix everything with the final mixer
    if (this.finalMixer) {
      try {
        this.finalMixer.process(
          finalMixerInputs[0],
          finalMixerInputs[1],
          finalMixerInputs[2],
          finalMixerInputs[3],
          outputBuffer,
          buffersize
        );
        
        // Apply global flanger to final output (like reverb does - in-place processing)
        if (this.globalFlanger && this.globalFlanger.wet > 0) {
          this.globalFlanger.samplerate = this.samplerate;
          // Simple in-place processing like reverb: process(outputBuffer.pointer, outputBuffer.pointer, buffersize)
          this.globalFlanger.process(outputBuffer.pointer, outputBuffer.pointer, buffersize);
          console.log(`🎛️ FLANGER PROCESSING: wet=${this.globalFlanger.wet}, enabled=${this.globalFlanger.enabled}`);
        }
      } catch (error) {
        console.error("🎵 Error in final mixer process:", error);
        this.Superpowered.memorySet(outputBuffer, 0, buffersize * 8);
      }
    } else {
      console.error("🎵 Final mixer is null, setting silence");
      this.Superpowered.memorySet(outputBuffer, 0, buffersize * 8);
    }
  }
  

  onDestruct() {
    console.log("PlayerProcessor onDestruct");
    
    // Clean up mixers
    this.mixers.forEach((mixer, index) => {
      if (mixer) {
        mixer.destruct();
        console.log(`Destructed mixer ${index}`);
      }
    });
    
    // Clean up cascading mixers
    if (this.cascadingMixers) {
      this.cascadingMixers.forEach((mixer, index) => {
        if (mixer) {
          mixer.destruct();
          console.log(`Destructed cascading mixer ${index}`);
        }
      });
    }
    
    // Clean up multiple final mixers
    if (this.finalMixers) {
      this.finalMixers.forEach((mixer, index) => {
        if (mixer) {
          mixer.destruct();
          console.log(`Destructed final mixer ${index}`);
        }
      });
    }
    
    // Clean up main final mixer
    if (this.finalMixer) {
      this.finalMixer.destruct();
    }
    
    // Clean up players
    this.players.forEach((player, index) => {
      if (player) {
        player.destruct();
        console.log(`Destructed player ${index}`);
      }
    });
    
    // Clean up stem output buffers
    if (this.stemOutputBuffers) {
      this.stemOutputBuffers.forEach((buffer, index) => {
        if (buffer) {
          buffer.free();
          console.log(`Freed stem output buffer ${index}`);
        }
      });
    }
    
    // Clean up mixer output buffers
    if (this.mixerOutputBuffers) {
      this.mixerOutputBuffers.forEach((buffer, index) => {
        if (buffer) {
          buffer.free();
          console.log(`Freed mixer output buffer ${index}`);
        }
      });
    }
    
    // Clean up reverb instances
    if (this.reverbs) {
      this.reverbs.forEach((reverb, index) => {
        if (reverb) {
          reverb.destruct();
          console.log(`Destructed reverb ${index}`);
        }
      });
    }
    
    // Clean up global flanger
    if (this.globalFlanger) {
      this.globalFlanger.destruct();
      console.log("Destructed global flanger");
    }
  }

  onMessageFromMainScope(message) {
    console.log("🎵 PlayerProcessor received message:", message);
    console.log("🎵 Current loadedStems:", Array.from(this.loadedStems));
    console.log("🎵 Current isPlaying:", this.isPlaying);
    
    // Handle flanger messages
    if (message.type === "flanger" && this.globalFlanger) {
      if (typeof message.wet !== 'undefined') {
        this.globalFlanger.wet = message.wet;
        console.log(`🎛️ FLANGER: Set wet to ${message.wet}`);
      }
      if (typeof message.depth !== 'undefined') {
        this.globalFlanger.depth = message.depth;
        console.log(`🎛️ FLANGER: Set depth to ${message.depth}`);
      }
      if (typeof message.lfoBeats !== 'undefined') {
        this.globalFlanger.lfoBeats = message.lfoBeats;
        console.log(`🎛️ FLANGER: Set lfoBeats to ${message.lfoBeats}`);
      }
      if (typeof message.bpm !== 'undefined') {
        this.globalFlanger.bpm = message.bpm;
        console.log(`🎛️ FLANGER: Set bpm to ${message.bpm}`);
      }
      if (typeof message.clipperThresholdDb !== 'undefined') {
        this.globalFlanger.clipperThresholdDb = message.clipperThresholdDb;
        console.log(`🎛️ FLANGER: Set clipperThresholdDb to ${message.clipperThresholdDb}`);
      }
      if (typeof message.clipperMaximumDb !== 'undefined') {
        this.globalFlanger.clipperMaximumDb = message.clipperMaximumDb;
        console.log(`🎛️ FLANGER: Set clipperMaximumDb to ${message.clipperMaximumDb}`);
      }
      if (typeof message.stereo !== 'undefined') {
        this.globalFlanger.stereo = Boolean(message.stereo);
        console.log(`🎛️ FLANGER: Set stereo to ${Boolean(message.stereo)}`);
      }
      if (typeof message.enabled !== 'undefined') {
        this.globalFlanger.enabled = Boolean(message.enabled);
        console.log(`🎛️ FLANGER: Set enabled to ${Boolean(message.enabled)}`);
      }
    }
    
    if (message.type === "loadStem") {
      console.log("Loading stem with payload:", message.payload);
      this.loadStem(message.payload);
    }
    
    if (message.type === "parameterChange") {
      this.handleParameterChange(message.payload);
    }
    
    if (message.type === "play") {
      console.log("Received play message");
      this.isPlaying = true;
      this.players.forEach((player, index) => {
        if (player && this.loadedStems.has(index)) {
          console.log(`Playing stem ${index}`);
          player.play();
        }
      });
      console.log(`Playing ${this.loadedStems.size} loaded stems`);
    }
    
    if (message.type === "playStem") {
      const { stemIndex } = message.payload;
      console.log(`Received playStem message for stem ${stemIndex}`);
      this.isPlaying = true;
      
      // Stop all stems first
      this.players.forEach((player, index) => {
        if (player && this.loadedStems.has(index)) {
          player.pause();
        }
      });
      
      // Play only the specified stem
      if (this.players[stemIndex] && this.loadedStems.has(stemIndex)) {
        console.log(`Playing only stem ${stemIndex}`);
        this.players[stemIndex].play();
      } else {
        console.warn(`Stem ${stemIndex} not found or not loaded`);
      }
    }
    
    if (message.type === "pause") {
      console.log("Received pause message");
      this.isPlaying = false;
      this.players.forEach((player, index) => {
        if (player && this.loadedStems.has(index)) {
          player.pause();
        }
      });
    }
    
    if (message.type === "stop") {
      console.log("Received stop message");
      this.isPlaying = false;
      this.players.forEach((player, index) => {
        if (player && this.loadedStems.has(index)) {
          player.pause();
          player.seek(0);
        }
      });
    }
    
    if (message.type === "seek") {
      console.log("Received seek message:", message.payload.seconds);
      this.currentPosition = message.payload.seconds;
      this.players.forEach((player, index) => {
        if (player && this.loadedStems.has(index)) {
          player.seek(message.payload.seconds);
        }
      });
    }
    
    if (message.SuperpoweredLoaded) {
      console.log("Received SuperpoweredLoaded message:", message.SuperpoweredLoaded);
      this.handleSuperpoweredLoaded(message.SuperpoweredLoaded);
    }
  }

  loadStem(payload) {
    const { url, stemIndex, maxStems } = payload;
    
    console.log(`🎵 loadStem called with:`, { url, stemIndex, maxStems });
    console.log(`🎵 Worklet ready status:`, this.isReady);
    
    // Check if worklet is ready
    if (!this.isReady) {
      console.warn(`🎵 Worklet not ready yet, queuing stem load for later`);
      // Store the URL mapping but don't process yet
      this.urlToStemIndex.set(url, stemIndex);
      return;
    }
    
    // Create players and mixers if this is the first stem
    if (this.players.length === 0 && maxStems > 0) {
      console.log(`🎵 Creating players and mixers for ${maxStems} stems`);
      this.createPlayersAndMixers(maxStems);
    }
    
    if (stemIndex >= maxStems) {
      console.warn(`Cannot load stem ${stemIndex}, max stems is ${maxStems}`);
      return;
    }
    
    // Store the URL-to-stemIndex mapping for proper assignment
    this.urlToStemIndex.set(url, stemIndex);
    console.log(`🎵 Mapped URL to stemIndex: ${url} -> ${stemIndex}`);
    console.log(`🎵 Current URL mappings:`, Array.from(this.urlToStemIndex.entries()));
  }


  handleSuperpoweredLoaded(data) {
    console.log(`🎵 handleSuperpoweredLoaded called with data:`, data);
    console.log(`🎵 URL mappings:`, Array.from(this.urlToStemIndex.entries()));
    console.log(`🎵 Current loaded stems:`, Array.from(this.loadedStems));
    
    // Find the stem index for this URL
    let assignedStemIndex = null;
    for (const [url, stemIndex] of this.urlToStemIndex.entries()) {
      if (data.url === url) {
        assignedStemIndex = stemIndex;
        break;
      }
    }
    
    if (assignedStemIndex === null) {
      console.warn(`🎵 No stem index found for URL: ${data.url}`);
      return;
    }
    
    if (this.loadedStems.has(assignedStemIndex)) {
      console.warn(`🎵 Stem ${assignedStemIndex} already loaded`);
      return;
    }
    
    console.log(`🎵 Assigning loaded data to stem ${assignedStemIndex} for URL: ${data.url}`);
    
    const player = this.players[assignedStemIndex];
    if (!player) {
      console.error(`Player ${assignedStemIndex} not found`);
      return;
    }
    
    try {
      player.pause();
      player.openMemory(
        this.Superpowered.arrayBufferToWASM(data.buffer),
        false,
        false
      );
      player.seek(0);
      
      this.loadedStems.add(assignedStemIndex);
      
      // Update duration if this is the first stem or if it's longer
      const playerDuration = player.durationSeconds;
      if (playerDuration > this.duration) {
        this.duration = playerDuration;
        console.log(`🎵 Updated duration to ${this.duration} seconds`);
      }
      
      console.log(`🎵 Stem ${assignedStemIndex} loaded successfully into player ${assignedStemIndex}`);
      this.sendMessageToMainScope({ event: "assetLoaded", stemIndex: assignedStemIndex });
      
      console.log(`🎵 Total loaded stems: ${this.loadedStems.size} out of ${this.totalStems}`);
      
      // Check if all stems are loaded
      if (this.loadedStems.size === this.totalStems) {
        console.log(`🎵 All ${this.totalStems} stems loaded successfully!`);
        this.sendMessageToMainScope({ event: "allStemsLoaded" });
      }
    } catch (error) {
      console.error(`🎵 Error loading stem ${assignedStemIndex}:`, error);
    }
  }

  handleParameterChange(payload) {
    const { id, value, stemIndex } = payload;
    
    if (id === "volume") {
      if (stemIndex !== undefined) {
        // Set volume for specific stem
        this.stemGains[stemIndex] = value;
        console.log(`Set volume for stem ${stemIndex} to ${value}`);
      } else {
        // Set volume for all stems
        this.stemGains.fill(value);
        console.log(`Set volume for all stems to ${value}`);
      }
    } else if (id === "reverb") {
      if (stemIndex !== undefined) {
        // Set reverb mix for specific stem
        this.reverbMix[stemIndex] = value;
        if (this.reverbs[stemIndex]) {
          this.reverbs[stemIndex].mix = value;
          this.reverbs[stemIndex].enabled = value > 0;
        }
        console.log(`Set reverb mix for stem ${stemIndex} to ${value}`);
      } else {
        // Set reverb mix for all stems
        this.reverbMix.fill(value);
        this.reverbs.forEach((reverb, index) => {
          if (reverb) {
            reverb.mix = value;
            reverb.enabled = value > 0;
          }
        });
        console.log(`Set reverb mix for all stems to ${value}`);
      }
    } else if (id === "reverbMix") {
      if (stemIndex !== undefined && this.reverbs[stemIndex]) {
        this.reverbs[stemIndex].mix = value;
        this.reverbMix[stemIndex] = value;
        console.log(`Set reverb mix for stem ${stemIndex} to ${value}`);
      }
    } else if (id === "reverbWidth") {
      if (stemIndex !== undefined && this.reverbs[stemIndex]) {
        this.reverbs[stemIndex].width = value;
        console.log(`Set reverb width for stem ${stemIndex} to ${value}`);
      }
    } else if (id === "reverbDamp") {
      if (stemIndex !== undefined && this.reverbs[stemIndex]) {
        this.reverbs[stemIndex].damp = value;
        console.log(`Set reverb damp for stem ${stemIndex} to ${value}`);
      }
    } else if (id === "reverbRoomSize") {
      if (stemIndex !== undefined && this.reverbs[stemIndex]) {
        this.reverbs[stemIndex].roomSize = value;
        console.log(`Set reverb room size for stem ${stemIndex} to ${value}`);
      }
    } else if (id === "reverbPredelay") {
      if (stemIndex !== undefined && this.reverbs[stemIndex]) {
        this.reverbs[stemIndex].predelayMs = value;
        console.log(`Set reverb predelay for stem ${stemIndex} to ${value}`);
      }
    } else if (id === "reverbLowCut") {
      if (stemIndex !== undefined && this.reverbs[stemIndex]) {
        this.reverbs[stemIndex].lowCutHz = value;
        console.log(`Set reverb low cut for stem ${stemIndex} to ${value}`);
      }
    } else if (id === "reverbEnabled") {
      if (stemIndex !== undefined && this.reverbs[stemIndex]) {
        this.reverbs[stemIndex].enabled = value > 0;
        console.log(`Set reverb enabled for stem ${stemIndex} to ${value > 0}`);
      }
    } else if (id === "globalFlanger") {
      // Simple global flanger control - just wet level (following official example)
      console.log(`🎛️ PLAYER PROCESSOR: Received globalFlanger message with value=${value}`);
      if (this.globalFlanger) {
        this.globalFlanger.wet = value;
        // Flanger is always enabled, wet level controls the effect (following official example)
        console.log(`🎛️ PLAYER PROCESSOR: Set global flanger wet to ${value}`);
        console.log(`🎛️ PLAYER PROCESSOR: Flanger object:`, {
          wet: this.globalFlanger.wet,
          enabled: this.globalFlanger.enabled,
          depth: this.globalFlanger.depth
        });
      } else {
        console.log(`🎛️ ERROR: Global flanger not initialized!`);
      }
    } else if (id === "globalFlangerEnabled") {
      // Toggle global flanger on/off
      if (this.globalFlanger) {
        this.globalFlanger.enabled = value > 0;
        console.log(`Set global flanger enabled to ${value > 0}`);
      }
    } else if (id === "globalFlangerDepth") {
      if (this.globalFlanger) {
        this.globalFlanger.depth = value;
        console.log(`Set global flanger depth to ${value}`);
      }
    } else if (id === "globalFlangerLfoBeats") {
      if (this.globalFlanger) {
        this.globalFlanger.lfoBeats = value;
        console.log(`Set global flanger LFO beats to ${value}`);
      }
    } else if (id === "globalFlangerBpm") {
      if (this.globalFlanger) {
        this.globalFlanger.bpm = value;
        console.log(`Set global flanger BPM to ${value}`);
      }
    } else if (id === "globalFlangerClipperThreshold") {
      if (this.globalFlanger) {
        this.globalFlanger.clipperThresholdDb = value;
        console.log(`Set global flanger clipper threshold to ${value}`);
      }
    } else if (id === "globalFlangerClipperMaximum") {
      if (this.globalFlanger) {
        this.globalFlanger.clipperMaximumDb = value;
        console.log(`Set global flanger clipper maximum to ${value}`);
      }
    } else if (id === "globalFlangerStereo") {
      if (this.globalFlanger) {
        this.globalFlanger.stereo = value > 0;
        console.log(`Set global flanger stereo to ${value > 0}`);
      }
    } else if (id === "varispeedMode") {
      // Set the varispeed mode: 0 = timeStretch, 1 = natural
      this.varispeedMode = value === 1 ? 'natural' : 'timeStretch';
      console.log(`Set varispeed mode to: ${this.varispeedMode}`);
    } else if (id === "speed") {
      // Apply speed based on current varispeed mode
      if (this.varispeedMode === 'natural') {
        // Natural varispeed: changes both speed and pitch together
        const speedMultiplier = value;
        const pitchShiftCents = (speedMultiplier - 1) * 1200; // Convert speed ratio to cents
        
        if (stemIndex !== undefined) {
          // Set natural varispeed for specific stem
          if (this.players[stemIndex]) {
            this.players[stemIndex].playbackRate = speedMultiplier;
            this.players[stemIndex].pitchShiftCents = pitchShiftCents;
            console.log(`Set natural varispeed for stem ${stemIndex}: speed=${speedMultiplier}, pitch=${pitchShiftCents} cents`);
          }
        } else {
          // Set natural varispeed for all stems
          this.players.forEach((player, index) => {
            if (player && this.loadedStems.has(index)) {
              player.playbackRate = speedMultiplier;
              player.pitchShiftCents = pitchShiftCents;
            }
          });
          console.log(`Set natural varispeed for all stems: speed=${speedMultiplier}, pitch=${pitchShiftCents} cents`);
        }
      } else {
        // Time-stretch mode: changes speed without affecting pitch
        if (stemIndex !== undefined) {
          // Set speed for specific stem
          if (this.players[stemIndex]) {
            this.players[stemIndex].playbackRate = value;
            console.log(`Set time-stretch speed for stem ${stemIndex} to ${value}`);
          }
        } else {
          // Set speed for all stems
          this.players.forEach((player, index) => {
            if (player && this.loadedStems.has(index)) {
              player.playbackRate = value;
            }
          });
          console.log(`Set time-stretch speed for all stems to ${value}`);
        }
      }
    } else if (id === "naturalVarispeed") {
      // Natural varispeed: changes both speed and pitch together
      // Value represents the speed multiplier (0.5 = half speed + half pitch)
      const speedMultiplier = value;
      const pitchShiftCents = (speedMultiplier - 1) * 1200; // Convert speed ratio to cents
      
      if (stemIndex !== undefined) {
        // Set natural varispeed for specific stem
        if (this.players[stemIndex]) {
          this.players[stemIndex].playbackRate = speedMultiplier;
          this.players[stemIndex].pitchShiftCents = pitchShiftCents;
          console.log(`Set natural varispeed for stem ${stemIndex}: speed=${speedMultiplier}, pitch=${pitchShiftCents} cents`);
        }
      } else {
        // Set natural varispeed for all stems
        this.players.forEach((player, index) => {
          if (player && this.loadedStems.has(index)) {
            player.playbackRate = speedMultiplier;
            player.pitchShiftCents = pitchShiftCents;
          }
        });
        console.log(`Set natural varispeed for all stems: speed=${speedMultiplier}, pitch=${pitchShiftCents} cents`);
      }
    } else if (id === "pitch") {
      if (stemIndex !== undefined) {
        // Set pitch for specific stem
        if (this.players[stemIndex]) {
          this.players[stemIndex].pitchShiftCents = value;
          console.log(`Set pitch for stem ${stemIndex} to ${value}`);
        }
      } else {
        // Set pitch for all stems
        this.players.forEach((player, index) => {
          if (player && this.loadedStems.has(index)) {
            player.pitchShiftCents = value;
          }
        });
        console.log(`Set pitch for all stems to ${value}`);
      }
    } else if (id === "mute") {
      if (stemIndex !== undefined && stemIndex < this.stemMutes.length) {
        this.stemMutes[stemIndex] = value > 0;
        console.log(`${value > 0 ? 'Muted' : 'Unmuted'} stem ${stemIndex}`);
      } else {
        console.warn(`Invalid stem index for mute: ${stemIndex}`);
      }
    } else if (id === "solo") {
      if (stemIndex !== undefined && stemIndex < this.stemSolos.length) {
        this.stemSolos[stemIndex] = value > 0;
        console.log(`${value > 0 ? 'Soloed' : 'Unsoloed'} stem ${stemIndex}`);
      } else {
        console.warn(`Invalid stem index for solo: ${stemIndex}`);
      }
    }
  }

  processAudio(inputBuffer, outputBuffer, buffersize, parameters) {
    try {
      // Generate test tone if no stems are loaded
      if (this.loadedStems.size === 0) {
        this.generateTestTone(outputBuffer.pointer, buffersize);
        return;
      }
      
      // Ensure the samplerate is in sync on every audio processing callback
      this.players.forEach((player, index) => {
        if (player && this.loadedStems.has(index)) {
          player.outputSamplerate = this.samplerate;
        }
      });
      
       let totalActiveStems = 0;
       
       // Process each mixer group (up to 4 stems per mixer) - this makes all stems play together
       for (let mixerIndex = 0; mixerIndex < this.mixers.length; mixerIndex++) {
         const mixer = this.mixers[mixerIndex];
         const mixerOutputBuffer = this.mixerOutputBuffers[mixerIndex];
         
         // Skip if mixer or buffer is null
         if (!mixer || !mixerOutputBuffer || !mixerOutputBuffer.pointer) {
           console.warn(`🎵 Skipping mixer ${mixerIndex} - mixer or buffer is null`);
           continue;
         }
         
         // Prepare mixer inputs array (up to 4 stereo inputs per mixer)
         const mixerInputs = [null, null, null, null];
         let activeStemsInMixer = 0;
         
         // Process stems for this mixer (4 stems per mixer)
         const startStemIndex = mixerIndex * this.maxStemsPerMixer;
         const endStemIndex = Math.min(startStemIndex + this.maxStemsPerMixer, this.players.length);
         
         for (let stemIndex = startStemIndex; stemIndex < endStemIndex; stemIndex++) {
           const player = this.players[stemIndex];
           const localIndex = stemIndex - startStemIndex; // Local index within this mixer (0-3)
           
           if (player && this.loadedStems.has(stemIndex)) {
             // Check solo and mute states (with bounds checking)
             const isMuted = this.stemMutes[stemIndex] || false;
             const isSoloed = this.stemSolos[stemIndex] || false;
             
             // Check if any stem is soloed
             const hasAnySolo = this.stemSolos.some(solo => solo);
             
             // Calculate effective gain based on solo/mute states
             let effectiveGain = this.stemGains[stemIndex];
             
             if (isMuted) {
               // Muted stems have zero gain
               effectiveGain = 0;
             } else if (hasAnySolo && !isSoloed) {
               // If any stem is soloed and this one isn't, silence it
               effectiveGain = 0;
             }
             
             // Debug logging
             if (isMuted || isSoloed || hasAnySolo) {
               console.log(`🎵 Stem ${stemIndex}: muted=${isMuted}, soloed=${isSoloed}, hasAnySolo=${hasAnySolo}, effectiveGain=${effectiveGain}`);
             }
             try {
               // Get the pre-allocated output buffer for this stem
               const stemOutputBuffer = this.stemOutputBuffers[stemIndex];
               
               // Initialize buffer to silence first
               this.Superpowered.memorySet(stemOutputBuffer.pointer, 0, buffersize * 8);
               
               // Process the AdvancedAudioPlayer into its output buffer
               const hasOutput = player.processStereo(stemOutputBuffer.pointer, false, buffersize, effectiveGain);
               
               if (hasOutput) {
                 // Apply reverb if enabled
                 const reverb = this.reverbs[stemIndex];
                 if (reverb && reverb.enabled && this.reverbMix[stemIndex] > 0) {
                   reverb.samplerate = this.samplerate;
                   reverb.process(stemOutputBuffer.pointer, stemOutputBuffer.pointer, buffersize);
                 }
                 
                 
                 mixerInputs[localIndex] = stemOutputBuffer.pointer;
                 activeStemsInMixer++;
                 totalActiveStems++;
                 
                 // Log occasionally to avoid spam
                 if (Math.random() < 0.001) { // 0.1% chance
                   console.log(`🎵 AdvancedAudioPlayer ${stemIndex} (mixer ${mixerIndex}) producing audio (gain: ${this.stemGains[stemIndex]})`);
                 }
               } else {
                 // Keep silence (already set)
                 mixerInputs[localIndex] = stemOutputBuffer.pointer;
               }
             } catch (stemError) {
               console.error(`Error processing AdvancedAudioPlayer ${stemIndex}:`, stemError);
               // Use silence buffer on error
               mixerInputs[localIndex] = this.stemOutputBuffers[stemIndex].pointer;
             }
           } else {
             // No stem loaded for this slot, use silence
             mixerInputs[localIndex] = this.stemOutputBuffers[stemIndex].pointer;
           }
         }
         
         // Mix this group of stems using the mixer - this makes stems play together
         if (mixer && activeStemsInMixer > 0) {
           try {
             mixer.process(
               mixerInputs[0], // input0
               mixerInputs[1], // input1  
               mixerInputs[2], // input2
               mixerInputs[3], // input3
               mixerOutputBuffer.pointer, // output
               buffersize // numberOfFrames
             );
           } catch (mixerError) {
             console.error(`Error in mixer ${mixerIndex}.process:`, mixerError);
             // Set mixer output to silence on error
             this.Superpowered.memorySet(mixerOutputBuffer.pointer, 0, buffersize * 8);
           }
         } else {
           // If no active stems in this mixer, set output to silence
           this.Superpowered.memorySet(mixerOutputBuffer.pointer, 0, buffersize * 8);
         }
       }
       
       // Now mix all mixer outputs using cascading mixers for unlimited stems
       if (totalActiveStems > 0) {
         try {
           console.log(`🎵 Mixing ${this.mixers.length} mixers with ${totalActiveStems} active stems`);
           console.log(`🎵 Loaded stems: ${this.loadedStems.size} out of ${this.totalStems}`);
           this.processCascadingMixers(outputBuffer.pointer, buffersize);
           console.log(`🎵 Successfully mixed all stems`);
         } catch (mixingError) {
           console.error("🎵 Error in cascading mixers:", mixingError);
           console.error("🎵 Mixer details:", {
             totalMixers: this.mixers.length,
             totalStems: this.totalStems,
             activeStems: totalActiveStems,
             loadedStems: this.loadedStems.size,
             finalMixers: this.finalMixers.length
           });
           // Set output to silence on error
           this.Superpowered.memorySet(outputBuffer.pointer, 0, buffersize * 8);
         }
       } else {
         // No active stems, set output to silence
         console.log(`🎵 No active stems, setting silence`);
         this.Superpowered.memorySet(outputBuffer.pointer, 0, buffersize * 8);
       }
      
      // Apply master output gain
      if (this.outputGain !== 1) {
        try {
          this.Superpowered.memoryMultiply(outputBuffer.pointer, this.outputGain, buffersize * 8);
        } catch (gainError) {
          console.error("Error applying output gain:", gainError);
        }
      }
      
      // Update current position
      if (this.isPlaying && this.loadedStems.size > 0) {
        this.currentPosition += buffersize / this.samplerate;
        
        // Send position update every 100ms to avoid spam
        if (Math.floor(this.currentPosition * 10) % 1 === 0) {
          this.sendMessageToMainScope({ 
            event: 'positionUpdate', 
            position: this.currentPosition,
            duration: this.duration
          });
        }
      }
      
       // VU levels disabled to prevent performance issues
      
    } catch (error) {
      console.error("Error in processAudio:", error);
      // Set output to silence on error
      if (outputBuffer && outputBuffer.pointer) {
        try {
          this.Superpowered.memorySet(outputBuffer.pointer, 0, buffersize * 8);
        } catch (silenceError) {
          console.error("Error setting silence:", silenceError);
        }
      }
    }
  }


  generateTestTone(outputPointer, buffersize) {
    // Generate a simple sine wave test tone
    const frequency = 440; // A4 note
    const amplitude = 0.1;
    
    for (let i = 0; i < buffersize; i++) {
      const sample = amplitude * Math.sin(2 * Math.PI * frequency * i / this.samplerate);
      // Write to both left and right channels
      this.Superpowered.memorySet(outputPointer + i * 8, sample, 4); // Left channel
      this.Superpowered.memorySet(outputPointer + i * 8 + 4, sample, 4); // Right channel
    }
  }
}

// Register the processor script for the browser
if (typeof AudioWorkletProcessor !== 'undefined') {
  registerProcessor('PlayerProcessor', PlayerProcessor);
}

export default PlayerProcessor;