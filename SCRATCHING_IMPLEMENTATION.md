# 🎧 Vinyl-Style DJ Scratching Implementation

## Overview
Added authentic **vinyl-style scratching** to the timeline scrubber using Superpowered's audio engine. When you drag the scrubber, the audio scratches like a real turntable with natural pitch shifting - creating that classic "**RARRRRR**" sound!

## How It Works

### 1. **Mouse Tracking (TimelineScrubber.tsx)**
- Tracks mouse velocity during dragging
- Calculates how fast and in which direction you're moving
- Sends real-time scratch updates to the audio engine

### 2. **Audio Engine Control (thomasAudioEngine.js)**
- `scratchBegin()` - Called when you start dragging
- `scratchMove(velocity, time)` - Called continuously while dragging
- `scratchEnd()` - Called when you release

### 3. **Timeline & Track Layer**
- Commands flow through: Timeline → Track → Region
- All tracks scratch simultaneously
- Maintains sync across all stems

### 4. **Region Playback (SuperpoweredRegion.js)**
The actual scratching magic happens here:

```javascript
scratchBegin() {
  - Saves current play state
  - Pauses normal timeline progression
  - DISABLES time-stretching (pitch changes naturally like vinyl!)
}

scratchMove(velocity, positionMs) {
  - Seeks to the exact scrubber position
  - Sets playback rate based on drag velocity (0.1x to 8x)
  - Velocity is boosted 2.5x for responsiveness
  - Pitch shifts naturally with speed (no time-stretching!)
  - Creates authentic vinyl "RARRRRR" scratch sound!
}

scratchEnd() {
  - Resets playback rate to 1.0x
  - Restores normal playback or pause
  - Returns to normal time-stretching settings
}
```

## Features

✅ **Velocity-Based Scratching** - Faster drags = faster playback & higher pitch
✅ **Forward & Reverse** - Drag backwards to play in reverse (with lower pitch!)
✅ **Natural Pitch Shifting** - Pitch changes with speed like real vinyl
✅ **Multi-Track** - All stems scratch together in sync
✅ **State Preservation** - Returns to play/pause state after scratching
✅ **Responsive Feel** - 2.5x velocity boost for dramatic scratching

## Usage

1. **Click and hold** on the timeline scrubber
2. **Drag left or right** to scratch through the audio
3. **Drag fast** for high-speed scratching
4. **Drag slow** for pitched-down scratching
5. **Release** to return to normal playback

## Technical Details

- Uses Superpowered AdvancedAudioPlayer's `playbackRate` property
- **Time-stretching is DISABLED** - allows natural pitch shifting (vinyl sound!)
- Velocity range: 0.1x (super slow) to 8x (super fast)
- Velocity calculation: `(positionDelta / timeDelta) * 2.5` for responsiveness
- Position updates in real-time as you drag
- Continuous playback during scratching creates the "rarrrrr" effect
- Natural velocity curve: gentle for slow movements, more range for fast

## Powered By

[Superpowered Audio SDK](https://superpowered.com/audio-player) - Professional DJ features including:
- Built-in resampler for scratching
- Time-stretching and pitch-shifting
- Zero-latency position reporting
- High-quality audio at any playback rate

