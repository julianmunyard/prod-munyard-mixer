'use client'

import React, { useEffect, useState } from 'react'

export default function DebugTimelinePage() {
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    const testTimeline = async () => {
      try {
        addLog("🔍 Starting timeline debug test...")
        
        // Test 1: Check if Superpowered can be imported
        addLog("📦 Testing Superpowered import...")
        const { SuperpoweredGlue, SuperpoweredWebAudio } = await import('@superpoweredsdk/web')
        addLog("✅ Superpowered imported successfully")
        
        // Test 2: Try to instantiate Superpowered
        addLog("🚀 Testing Superpowered instantiation...")
        const superpowered = await SuperpoweredGlue.Instantiate(
          "ExampleLicenseKey-WillExpire-OnNextUpdate",
          "/superpowered.wasm"
        )
        addLog("✅ Superpowered instantiated successfully")
        
        // Test 3: Try to create WebAudio manager
        addLog("🎵 Testing WebAudio manager creation...")
        const webaudioManager = new SuperpoweredWebAudio(48000, superpowered)
        addLog("✅ WebAudio manager created successfully")
        
        // Test 4: Try to create AudioWorkletNode
        addLog("🔧 Testing AudioWorkletNode creation...")
        const timelineProcessorUrl = `${window.location.origin}/worklet/timelineProcessor.js`
        addLog(`📍 Timeline processor URL: ${timelineProcessorUrl}`)
        
        const timelineProcessorNode = await webaudioManager.createAudioNodeAsync(
          timelineProcessorUrl,
          "TimelineProcessor",
          (message) => {
            addLog(`📨 Message from audio thread: ${JSON.stringify(message)}`)
          }
        )
        addLog("✅ AudioWorkletNode created successfully")
        
        // Test 5: Connect to destination
        addLog("🔗 Testing audio connection...")
        timelineProcessorNode.connect(webaudioManager.audioContext.destination)
        addLog("✅ Audio connected successfully")
        
        addLog("🎉 All tests passed! Timeline system should be working.")
        
      } catch (error) {
        addLog(`❌ Test failed: ${error}`)
        console.error("Timeline test failed:", error)
      }
    }

    testTimeline()
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔍 Timeline Debug Test</h1>
      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '10px', 
        borderRadius: '5px', 
        height: '400px', 
        overflowY: 'auto', 
        fontFamily: 'monospace', 
        fontSize: '12px' 
      }}>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  )
}
