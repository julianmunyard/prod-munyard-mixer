type MixerPreviewModuleProps = {
  theme: string
  accentColor: string
}

export default function MixerPreviewModule({ theme, accentColor }: MixerPreviewModuleProps) {
  const isTransparent = theme === 'Transparent'

  return (
    <div
      style={{
        width: '86px',
        minHeight: '460px',
        backgroundColor: isTransparent ? 'rgba(255,255,255,0.05)' : accentColor,
        border: `1px solid ${accentColor}`,
        boxShadow: isTransparent
          ? '0 0 6px rgba(255,255,255,0.2)'
          : 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'Geist Mono, monospace',
      }}
    >
      {/* LED Pulse Meter */}
      <div
        style={{
          width: '14px',
          height: '38px',
          backgroundColor: '#15803d',
          borderRadius: '2px',
          animation: 'pulse 1s infinite',
          marginBottom: '14px',
        }}
      />

      {/* LEVEL Slider */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '24px',
          fontSize: '10px',
          color: 'white',
        }}
      >
        <span style={{ marginBottom: '4px' }}>LEVEL</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={0.6}
          readOnly
          className="volume-slider"
          style={{
            writingMode: 'bt-lr' as any,
            WebkitAppearance: 'slider-vertical',
            width: '6px',
            height: '160px',
            background: 'transparent',
          }}
        />
      </div>

      {/* Delay Knob */}
      <div style={{ marginBottom: '26px', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: 'white', marginBottom: '2px' }}>DELAY</div>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#2C2F42',
            border: '2px solid white',
            boxShadow: '0 0 0 2px #B8001F',
            position: 'relative',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '3.5px',
              height: '15px',
              backgroundColor: 'white',
              borderRadius: '2px',
              transform: 'translate(-50%, -100%) rotate(45deg)',
              transformOrigin: 'bottom center',
            }}
          />
        </div>
      </div>

      {/* Buttons + Label */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {['MUTE', 'SOLO', 'Track'].map((label, idx) => (
          <div
            key={label}
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              marginBottom: idx === 2 ? '0px' : '8px',
              backgroundColor: '#FCFAEE',
              color: accentColor,
              border: `1px solid ${accentColor}`,
              width: '100%',
              textAlign: 'center',
              lineHeight: '1.2',
              whiteSpace: 'normal',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.5 }
        }
        input[type="range"]::-webkit-slider-thumb {
          background: ${accentColor};
        }
        input[type="range"]::-moz-range-thumb {
          background: ${accentColor};
        }
        input[type="range"]::-ms-thumb {
          background: ${accentColor};
        }
      `}</style>
    </div>
  )
}
