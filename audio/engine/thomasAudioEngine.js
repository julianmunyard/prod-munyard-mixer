import { getWavBytes } from "./utils/AudioConvertor.js";
import { SuperpoweredGlue, SuperpoweredWebAudio } from "@superpoweredsdk/web";

const timelineProcessorUrl = typeof window !== 'undefined' ? `${window.location.origin}/processors/timelineProcessor.js` : '';

class AudioEngine {
  webaudioManager = null;
  started = false;
  onTimelineFrameCursorUpdate;
  onStemDecoded;
  onTimelineDurationSet;

  async init() {
    if (!this.started) {

      this.started = true;
      this.superpowered = await SuperpoweredGlue.Instantiate(
        "ExampleLicenseKey-WillExpire-OnNextUpdate"
      );
      this.webaudioManager = new SuperpoweredWebAudio(48000, this.superpowered);
      this.webaudioManager.audioContext.suspend();
      // The location of the processor from the browser to fetch.
      // Define a handler that will be called whenever this.sendMessageToMainScope is called from the AudioWorkletProcessor scope.
      // Remember we called it with a ready event so expect to see it here.

      const onMessageProcessorAudioScope = (message) => {
        if (message.event === "ready") {
        }
        if (message.event === "timelineFrameCursor") {
          if (this.onTimelineFrameCursorUpdate)
            this.onTimelineFrameCursorUpdate(message.data.timelineFrameCursor);
        }
        if (message.event === "assets-downloaded") {
          this.onAllAssetsDownloaded();
        }
        if (message.event === "stem-decoded") {
          if (this.onStemDecoded) {
            this.onStemDecoded(message.data.decodedCount, message.data.totalCount);
          }
        }
        if (message.event === "timeline-duration-set") {
          console.log(`🔄 Timeline duration set to ${message.data.duration.toFixed(2)}s - looping enabled!`);
          if (this.onTimelineDurationSet) {
            this.onTimelineDurationSet(message.data.duration);
          }
        }
        if (message.event === "timeline-reset") {
          this.resetCallback();
        }
        if (message.event === "region-buffer-data") {
          this.onRegionBufferDataCallback(message.data);
        }
        if (message.event === "download-buffer") {
          this.downloadBuffer(
            message.data.trackId,
            message.data.regionId,
            message.data.sampleRate,
            message.data.buffer
          );
        }
      };

      // Now create the AudioWorkletNode, passing in the AudioWorkletProcessor url, its registered name (defined inside the processor) and the message callback.
      this.timelineProcessorNode =
        await this.webaudioManager.createAudioNodeAsync(
          timelineProcessorUrl,
          "TimelineProcessor",
          onMessageProcessorAudioScope
        );

      // Connect the AudioWorkletNode to the WebAudio destination (main audio output by default, such as your speakers).
      this.timelineProcessorNode.connect(
        this.webaudioManager.audioContext.destination
      );
    }
  }

  downloadBuffer(trackId, regionId, sampleRate, buffer) {
    const wavBytes = getWavBytes(buffer, {
      isFloat: false, // floating point or 16-bit integer
      numChannels: 2, // This will always be stereo. Either real stereo or dual mono
      sampleRate: sampleRate,
    });
    // console.log(wavBytes);
    const wav = new Blob([wavBytes], { type: "audio/wav" });

    // // create download link and append to Dom
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(wav);
    // downloadLink.innerText = "Download";
    // downloadLink.style.float = "right";
    downloadLink.setAttribute("download", `${trackId} - ${regionId}.wav`); // name file
    document.getElementById("root").appendChild(downloadLink);
    downloadLink.click();
  }

  reset() {
    return new Promise((resolve, reject) => {
      this.resetCallback = resolve;
      this.timelineProcessorNode.sendMessageToAudioScope({ type: "reset" });
    });
  }

  sendMessageToAudioProcessor(message) {
    this.timelineProcessorNode.sendMessageToAudioScope(message);
  }

  // ==================== 🎧 DJ Scratching Methods ====================
  
  /**
   * Start scratching mode
   * Call when user starts dragging the scrubber
   */
  scratchBegin() {
    this.sendMessageToAudioProcessor({
      type: "command",
      data: { command: "scratchBegin" }
    });
  }

  /**
   * Update scratch velocity
   * @param {number} velocity - Playback rate (negative = reverse)
   * @param {number} time - Position in seconds
   */
  scratchMove(velocity, time) {
    this.sendMessageToAudioProcessor({
      type: "command",
      data: { 
        command: "scratchMove",
        velocity: velocity,
        time: time
      }
    });
  }

  /**
   * End scratching mode
   * Call when user releases the scrubber
   */
  scratchEnd() {
    this.sendMessageToAudioProcessor({
      type: "command",
      data: { command: "scratchEnd" }
    });
  }
}

export default AudioEngine;
