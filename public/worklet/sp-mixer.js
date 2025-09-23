// sp-mixer.js - Superpowered stem player web component

import { MixerEngine } from '../audio/engine/mixerEngine.js';

class SPMixer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.stems = [];
    this.engine = null;
    this.isPlaying = false;
    this.isReady = false;
  }

  async connectedCallback() {
    this.render();
    this.setupEventListeners();
    
    // Initialize Superpowered engine
    try {
      this.engine = new MixerEngine({
        masterVolume: 1.0,
        sampleRate: 44100,
        bufferSize: 4096
      });
      console.log('SP-Mixer Superpowered engine initialized');
    } catch (error) {
      console.error('Failed to initialize SP-Mixer engine:', error);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: Arial, sans-serif;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .mixer-container {
          max-width: 800px;
          margin: 0 auto;
        }

        .controls {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          align-items: center;
        }

        button {
          padding: 10px 20px;
          font-size: 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          background: #007cba;
          color: white;
          transition: background-color 0.2s;
        }

        button:hover {
          background: #005a87;
        }

        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .loading {
          background: #ffa500;
        }

        .stem-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .stem-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px;
          background: white;
          border-radius: 6px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .stem-name {
          font-weight: bold;
          min-width: 100px;
        }

        .volume-control {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }

        input[type="range"] {
          flex: 1;
          max-width: 200px;
        }

        .volume-label {
          min-width: 30px;
          text-align: right;
          font-size: 14px;
        }

        .mute-btn {
          padding: 5px 10px;
          font-size: 12px;
          min-width: 60px;
        }

        .status {
          margin-bottom: 10px;
          padding: 10px;
          background: #e8f4f8;
          border-radius: 4px;
          font-size: 14px;
        }
      </style>

      <div class="mixer-container">
        <div class="status" id="status">Ready to load stems...</div>
        
        <div class="controls">
          <button id="playBtn" disabled>Play</button>
          <button id="pauseBtn" disabled>Pause</button>
          <button id="stopBtn" disabled>Stop</button>
        </div>
        
        <div class="stem-list" id="stemList">
          <!-- Stems will be rendered here -->
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const playBtn = this.shadowRoot.getElementById('playBtn');
    const pauseBtn = this.shadowRoot.getElementById('pauseBtn');
    const stopBtn = this.shadowRoot.getElementById('stopBtn');

    playBtn.addEventListener('click', () => this.play());
    pauseBtn.addEventListener('click', () => this.pause());
    stopBtn.addEventListener('click', () => this.stop());
  }

  // Load stems using Superpowered engine
  async loadStems(stems) {
    if (!this.engine) {
      console.error('Engine not initialized');
      return;
    }

    this.stems = stems;
    this.updateStatus('Loading stems...');
    
    try {
      // Map to Superpowered format
      const mappedStems = stems.map((stem) => ({
        name: stem.name || stem.label || 'Untitled',
        url: stem.url || stem.file,
        volume: stem.volume || 1.0
      }));

      console.log('Loading stems into Superpowered engine:', mappedStems);
      
      await this.engine.loadStems(mappedStems);
      
      this.isReady = true;
      this.updateStatus(`${stems.length} stems loaded successfully`);
      this.renderStems();
      this.updateButtonStates();
      
    } catch (error) {
      console.error('Failed to load stems:', error);
      this.updateStatus('Failed to load stems: ' + error.message);
    }
  }

  renderStems() {
    const stemList = this.shadowRoot.getElementById('stemList');
    stemList.innerHTML = '';

    this.stems.forEach((stem, index) => {
      const stemItem = document.createElement('div');
      stemItem.className = 'stem-item';
      
      const stemName = stem.name || stem.label || `Stem ${index + 1}`;
      
      stemItem.innerHTML = `
        <div class="stem-name">${stemName}</div>
        <div class="volume-control">
          <input 
            type="range" 
            min="0" 
            max="100" 
            value="${(stem.volume || 1.0) * 100}"
            data-stem-index="${index}"
            class="volume-slider"
          >
          <div class="volume-label">${Math.round((stem.volume || 1.0) * 100)}%</div>
          <button class="mute-btn" data-stem-index="${index}">
            Mute
          </button>
        </div>
      `;

      // Add volume slider event listener
      const volumeSlider = stemItem.querySelector('.volume-slider');
      const volumeLabel = stemItem.querySelector('.volume-label');
      
      volumeSlider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value) / 100;
        if (this.engine) {
          this.engine.setStemVolume(index, volume);
        }
        volumeLabel.textContent = `${Math.round(volume * 100)}%`;
      });

      // Add mute button event listener
      const muteBtn = stemItem.querySelector('.mute-btn');
      let isMuted = false;
      
      muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        if (this.engine) {
          this.engine.muteStem(index, isMuted);
        }
        muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
        muteBtn.style.backgroundColor = isMuted ? '#ff6b6b' : '';
      });

      stemList.appendChild(stemItem);
    });
  }

  async play() {
    if (!this.engine || !this.isReady) {
      console.warn('Engine not ready');
      return;
    }

    try {
      this.updateStatus('Starting playback...');
      await this.engine.play();
      this.isPlaying = true;
      this.updateStatus('Playing');
      this.updateButtonStates();
    } catch (error) {
      console.error('Playback failed:', error);
      this.updateStatus('Playback failed: ' + error.message);
    }
  }

  pause() {
    if (!this.engine) return;

    this.engine.pause();
    this.isPlaying = false;
    this.updateStatus('Paused');
    this.updateButtonStates();
  }

  stop() {
    if (!this.engine) return;

    this.engine.stop();
    this.isPlaying = false;
    this.updateStatus('Stopped');
    this.updateButtonStates();
  }

  updateButtonStates() {
    const playBtn = this.shadowRoot.getElementById('playBtn');
    const pauseBtn = this.shadowRoot.getElementById('pauseBtn');
    const stopBtn = this.shadowRoot.getElementById('stopBtn');

    playBtn.disabled = !this.isReady || this.isPlaying;
    pauseBtn.disabled = !this.isPlaying;
    stopBtn.disabled = !this.isReady;
    
    if (!this.isReady) {
      playBtn.classList.add('loading');
    } else {
      playBtn.classList.remove('loading');
    }
  }

  updateStatus(message) {
    const status = this.shadowRoot.getElementById('status');
    if (status) {
      status.textContent = message;
      console.log('SP-Mixer Status:', message);
    }
  }

  // Get current engine state
  getState() {
    return this.engine ? this.engine.getState() : null;
  }

  // Set playback rate
  setRate(rate) {
    if (this.engine) {
      this.engine.setRate(rate);
    }
  }

  // Seek to position
  seek(time) {
    if (this.engine) {
      this.engine.seek(time);
    }
  }

  // Clean up on disconnect
  disconnectedCallback() {
    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }
  }
}

// Register the custom element
customElements.define('sp-mixer', SPMixer);

export { SPMixer };