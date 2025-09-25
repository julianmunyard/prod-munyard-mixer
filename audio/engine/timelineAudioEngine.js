// Timeline AudioEngine - Based on Thomas's Superpowered Timeline System
// This replaces the existing audio engine with Thomas's superior timeline system

const timelineProcessorUrl = typeof window !== 'undefined' ? `${window.location.origin}/worklet/timelineProcessor.js` : '';

class TimelineAudioEngine {
  webaudioManager = null;
  started = false;
  onTimelineFrameCursorUpdate;
  onAllAssetsDownloaded;
  resetCallback;

  async init() {
    if (!this.started) {
      // Use the same Superpowered loading approach as your existing system
      const { SuperpoweredGlue, SuperpoweredWebAudio } = await import('@superpoweredsdk/web');

      this.started = true;
      this.superpowered = await SuperpoweredGlue.Instantiate(
        "ExampleLicenseKey-WillExpire-OnNextUpdate",
        "/superpowered.wasm"
      );
      this.webaudioManager = new SuperpoweredWebAudio(48000, this.superpowered);
      this.webaudioManager.audioContext.suspend();

      // Define message handler for communication with audio thread
      const onMessageProcessorAudioScope = (message) => {
        if (message.event === "ready") {
          console.log("🎵 Timeline processor ready");
        }
        if (message.event === "timelineFrameCursor") {
          if (this.onTimelineFrameCursorUpdate)
            this.onTimelineFrameCursorUpdate(message.data.timelineFrameCursor);
        }
        if (message.event === "assets-downloaded") {
          if (this.onAllAssetsDownloaded)
            this.onAllAssetsDownloaded();
        }
        if (message.event === "timeline-reset") {
          if (this.resetCallback)
            this.resetCallback();
        }
        if (message.event === "region-buffer-data") {
          // Handle region buffer data if needed
          console.log("Region buffer data received:", message.data);
        }
        if (message.event === "download-buffer") {
          // Handle buffer download if needed
          console.log("Download buffer received:", message.data);
        }
      };

      // Create the AudioWorkletNode with timeline processor
      this.timelineProcessorNode =
        await this.webaudioManager.createAudioNodeAsync(
          timelineProcessorUrl,
          "TimelineProcessor",
          onMessageProcessorAudioScope
        );

      // Connect to audio output
      this.timelineProcessorNode.connect(
        this.webaudioManager.audioContext.destination
      );
    }
  }

  // Load stems from Supabase into timeline system
  async loadStemsFromSupabase(stems) {
    console.log("🎵 Loading stems into timeline system:", stems);
    
    // Convert stems to timeline format
    const timelineData = {
      tracks: stems.map((stem, index) => ({
        id: `track_${index}`,
        actions: [{
          id: `region_${index}`,
          start: 0, // Start at beginning of timeline
          end: 255, // Play to end (will be updated with actual duration)
          url: stem.url, // Supabase URL
          data: { 
            name: stem.name || stem.label || `Stem ${index + 1}`, 
            color: `rgba(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},0.5)` 
          }
        }]
      }))
    };

    console.log("🎵 Timeline data created:", timelineData);

    // Send to timeline processor
    this.sendMessageToAudioProcessor({
      type: "initialTimelineData",
      data: timelineData
    });
  }

  // Play timeline
  play() {
    console.log("🎵 Playing timeline");
    this.webaudioManager.audioContext.resume();
    this.sendMessageToAudioProcessor({
      type: "command",
      data: { command: "play" }
    });
  }

  // Pause timeline
  pause() {
    console.log("🎵 Pausing timeline");
    this.webaudioManager.audioContext.suspend();
    this.sendMessageToAudioProcessor({
      type: "command",
      data: { command: "pause" }
    });
  }

  // Seek to position (in seconds)
  seek(timeInSeconds) {
    console.log("🎵 Seeking to:", timeInSeconds);
    this.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "updateCursor", 
        cursorSec: timeInSeconds 
      }
    });
  }

  // Reset timeline
  reset() {
    return new Promise((resolve, reject) => {
      this.resetCallback = resolve;
      this.sendMessageToAudioProcessor({ type: "reset" });
    });
  }

  // Update timeline data (for repositioning stems)
  updateTimelineData(timelineData) {
    this.sendMessageToAudioProcessor({
      type: "timelineUpdate",
      data: { timelineData }
    });
  }

  // Send message to audio processor
  sendMessageToAudioProcessor(message) {
    if (this.timelineProcessorNode) {
      this.timelineProcessorNode.sendMessageToAudioScope(message);
    }
  }

  // Get current timeline cursor position
  getCurrentTime() {
    // This would be updated by timelineFrameCursor events
    return this.currentTime || 0;
  }

  // Clean up resources
  dispose() {
    if (this.timelineProcessorNode) {
      this.timelineProcessorNode.destruct();
      this.timelineProcessorNode = null;
    }
    if (this.webaudioManager) {
      this.webaudioManager.audioContext.close();
      this.webaudioManager = null;
    }
    this.started = false;
  }
}

export default TimelineAudioEngine;
