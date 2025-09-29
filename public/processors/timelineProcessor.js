// timelineProcessor.js
// Import the superpowered library from local files
// This uses the same Superpowered SDK as the main thread to prevent compatibility issues
import { SuperpoweredWebAudio } from "/SP-es6.js";
import SuperpoweredTimeline from "./SuperpoweredTimeline/index.js";

class TimelineProcessor extends SuperpoweredWebAudio.AudioWorkletProcessor {
  // Runs after the constructor.
  timeline;
  stopped = false;

  onReady() {
    this.timeline = new SuperpoweredTimeline(
      this.samplerate,
      128,
      10,
      this.Superpowered,
      this
    );
    this.sendMessageToMainScope({ event: "ready" });
  }

  onMessageFromMainScope(message) {
    if (message.SuperpoweredLoaded) {
      this.timeline.loadAsset(message.SuperpoweredLoaded);
    }
    if (message.type === "initialTimelineData") {
      this.timeline.handleLoadTimeline(message.data);
    } else if (message.type === "timelineUpdate") {
      this.timeline.handleTimelineDataUpdate(message.data.timelineData);
    } else if (message.type === "command") {
      this.timeline.handleCommand(message.data);
    } else if (message.type === "trackControl") {
      this.timeline.handleTrackControl(message.data);
    } else if (message.type === "reset") {
      this.timeline.terminate();
      this.stopped = true;
      this.sendMessageToMainScope({ event: "timeline-reset" });
    }
  }

  sendTimelineFrameCursorUpdate(timelineFrameCursor) {
    this.sendMessageToMainScope({
      event: "timelineFrameCursor",
      data: { timelineFrameCursor },
    });
  }

  allAssetsDownloaded() {
    this.stopped = false;
    this.sendMessageToMainScope({ event: "assets-downloaded" });
  }

  handleBufferDownload(trackId, regionId, sampleRate, buffer) {
    this.sendMessageToMainScope({
      event: "download-buffer",
      data: {
        trackId,
        regionId,
        sampleRate,
        buffer,
      },
    });
  }

  // onDestruct is called when the parent destruct() method is called.
  // You should clear up all Superpowered object instances here.
  onDestruct() {
    // Here we should destroy the timeline, all of its tracks, regions, players etc
    this.timeline.terminate();
    this.stopped = true;
  }

  processAudio(inputBuffer, outputBuffer, buffersize, parameters) {
    if (this.stopped) {
      return true;
    }
    return this.timeline.processTimeline(inputBuffer, outputBuffer, buffersize);
  }
}

// The following code registers the processor script for the browser, note the label and reference.
if (typeof AudioWorkletProcessor !== "undefined")
  registerProcessor("TimelineProcessor", TimelineProcessor);
export default TimelineProcessor;
