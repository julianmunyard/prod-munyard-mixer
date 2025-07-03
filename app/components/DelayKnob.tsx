'use client'

import { useState, useRef, useEffect } from 'react'

type DelayKnobProps = {
  value: number // 0 - 1
  onChange: (val: number) => void
}

export default function DelayKnob({ value, onChange }: DelayKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      e.preventDefault()
      const delta = -e.movementY || 0
      const newVal = Math.min(1, Math.max(0, value + delta * 0.005))
      onChange(parseFloat(newVal.toFixed(2)))
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragging || e.touches.length !== 1) return
      e.preventDefault()
      const touch = e.touches[0]
      const deltaY = touch.clientY - (knobRef.current?.dataset.lastY ? parseFloat(knobRef.current.dataset.lastY) : touch.clientY)
      knobRef.current!.dataset.lastY = touch.clientY.toString()
      const newVal = Math.min(1, Math.max(0, value - deltaY * 0.01))
      onChange(parseFloat(newVal.toFixed(2)))
    }

    const stop = () => {
      setDragging(false)
      if (knobRef.current) {
        delete knobRef.current.dataset.lastY
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: false })
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', stop)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', stop)
    }
  }, [dragging, value, onChange])

  const angle = -135 + value * 270

  return (
    <div className="flex flex-col items-center text-xs text-white select-none">
      <span className="mb-1">DELAY</span>
      <div
        ref={knobRef}
        onMouseDown={() => setDragging(true)}
        onTouchStart={() => setDragging(true)}
        className="w-8 h-8 rounded-full bg-gray-700 border border-white flex items-center justify-center relative cursor-pointer"
      >
        <div
          className="absolute w-1 h-3 bg-white rounded"
          style={{ transform: `rotate(${angle}deg) translateY(-10px)` }}
        />
      </div>
    </div>
  )
}
