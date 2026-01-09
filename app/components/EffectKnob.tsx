'use client'

import React from 'react'

export default function EffectKnob({ left, top, id }: { left: string; top: string; id: string }) {
  return (
    <div style={{ position: 'absolute', width: '147px', height: '148px', left, top }}>
      {/* Outer circle with shadow - filter0_di */}
      <div
        style={{
          position: 'absolute',
          width: '138px',
          height: '138px',
          left: '4px',
          top: '5px',
          background: 'conic-gradient(from 90deg, rgba(149, 152, 159, 0.7964) 0deg, rgba(89, 96, 106, 0.81) 9.02116deg, rgba(85, 91, 105, 0.81) 21.83deg, rgba(176, 176, 176, 0.82) 41.4283deg, rgba(95, 101, 115, 0.64) 62.988deg, rgba(169, 171, 179, 0.86) 83.0642deg, rgba(182, 185, 192, 0.83) 120.422deg, rgba(242, 243, 245, 0.81) 149.349deg, rgba(98, 107, 116, 0.76) 185.934deg, rgba(142, 149, 157, 0.87) 218.855deg, rgba(239, 239, 241, 0.85) 245.1deg, rgba(105, 112, 122, 0.74) 269.348deg, rgba(87, 93, 107, 0.83) 283.727deg, rgba(99, 106, 116, 0.8) 300.987deg, rgba(241, 241, 243, 0.78) 337.045deg, rgba(151, 154, 163, 0.73) 349.307deg, rgba(177, 179, 185, 0.79) 355.79deg, rgba(149, 152, 159, 0.7964) 360deg)',
          borderRadius: '50%',
          boxShadow: '0px 4px 2px rgba(0, 0, 0, 0.25), inset 0px 4px 2px rgba(0, 0, 0, 0.35)',
        }}
      />
      
      {/* Inner dark circle - filter1_i */}
      <div
        style={{
          position: 'absolute',
          width: '131px',
          height: '131px',
          left: '7.99px',
          top: '7.99px',
          background: '#5C5C5C',
          borderRadius: '50%',
          boxShadow: 'inset 1px 1px 2px 3px rgba(0, 0, 0, 0.5)',
        }}
      />
      
      {/* Main circle layer - filter2_d */}
      <div
        style={{
          position: 'absolute',
          width: '131px',
          height: '131px',
          left: '8px',
          top: '10px',
          background: 'conic-gradient(from 90deg, rgba(149, 152, 159, 0.7964) 0deg, rgba(89, 96, 106, 0.81) 9.02116deg, rgba(85, 91, 105, 0.81) 21.83deg, rgba(176, 176, 176, 0.82) 41.4283deg, rgba(95, 101, 115, 0.64) 62.988deg, rgba(169, 171, 179, 0.86) 83.0642deg, rgba(182, 185, 192, 0.83) 120.422deg, rgba(242, 243, 245, 0.81) 149.349deg, rgba(98, 107, 116, 0.76) 185.934deg, rgba(142, 149, 157, 0.87) 218.855deg, rgba(239, 239, 241, 0.85) 245.1deg, rgba(105, 112, 122, 0.74) 269.348deg, rgba(87, 93, 107, 0.83) 283.727deg, rgba(99, 106, 116, 0.8) 300.987deg, rgba(241, 241, 243, 0.78) 337.045deg, rgba(151, 154, 163, 0.73) 349.307deg, rgba(177, 179, 185, 0.79) 355.79deg, rgba(149, 152, 159, 0.7964) 360deg)',
          borderRadius: '50%',
          filter: 'drop-shadow(10px 10px 2px rgba(0, 0, 0, 0.25))',
        }}
      />
      
      {/* Center layer */}
      <div
        style={{
          position: 'absolute',
          width: '131px',
          height: '131px',
          left: '8px',
          top: '10px',
          background: 'rgba(206, 206, 206, 0.81)',
          borderRadius: '50%',
        }}
      />
      
      {/* Horizontal indicator bar at bottom - filter3_ddi */}
      <svg
        width="147"
        height="148"
        style={{ position: 'absolute', left: '0', top: '0', pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id={`paint4_linear_${id}`} x1="65.7655" y1="53.6521" x2="66.355" y2="86.6469" gradientUnits="userSpaceOnUse">
            <stop stopColor="#687079"/>
            <stop offset="0.0660526" stopColor="#B9BCC0"/>
            <stop offset="0.285714" stopColor="#D4D7DB"/>
            <stop offset="0.428571" stopColor="#D3D4D6"/>
            <stop offset="0.571429" stopColor="#E7E7E7"/>
            <stop offset="0.762161" stopColor="#E3E3E3"/>
            <stop offset="0.881232" stopColor="#F8F9FB"/>
            <stop offset="1" stopColor="#AAADAF"/>
          </linearGradient>
          <filter id={`filter3_ddi_${id}`} x="9.0022" y="47.5679" width="134.99" height="47.8931" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="8" dy="5"/>
            <feGaussianBlur stdDeviation="1.5"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="-2" dy="-2"/>
            <feGaussianBlur stdDeviation="1.5"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.3 0"/>
            <feBlend mode="normal" in2="effect1_dropShadow" result="effect2_dropShadow"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="-4" dy="-2"/>
            <feGaussianBlur stdDeviation="1.5"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
            <feBlend mode="normal" in2="shape" result="effect3_innerShadow"/>
          </filter>
        </defs>
        <g filter={`url(#filter3_ddi_${id})`}>
          <path d="M20.8233 87.4603C18.5648 87.5006 16.5611 86.0242 16.0282 83.8291C15.1821 80.3442 14.0775 75.0759 14.0061 71.0794C13.9347 67.0829 14.8505 61.7786 15.5715 58.2656C16.0256 56.0529 17.9754 54.5059 20.2338 54.4655L126.411 52.5687C128.739 52.5271 130.786 54.0964 131.261 56.3762C131.989 59.8672 132.917 65.0356 132.987 68.9539C133.057 72.8722 132.314 78.0705 131.712 81.5852C131.318 83.8805 129.329 85.5219 127 85.5635L20.8233 87.4603Z" fill={`url(#paint4_linear_${id})`}/>
        </g>
      </svg>
      
      {/* Horizontal center line - filter4_i - positioned on left side */}
      <svg
        width="147"
        height="148"
        style={{ position: 'absolute', left: '0', top: '0', pointerEvents: 'none', zIndex: 10 }}
      >
        <defs>
          <filter id={`filter4_i_${id}`} x="18.5085" y="68.3466" width="22.9973" height="6.30365" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dx="1" dy="1"/>
            <feGaussianBlur stdDeviation="1"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0"/>
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow"/>
          </filter>
        </defs>
        <g filter={`url(#filter4_i_${id})`}>
          <line x1="21.0085" y1="71.1502" x2="38.0058" y2="70.8466" stroke="#5C5C5C" strokeWidth="5" strokeLinecap="round"/>
        </g>
      </svg>
    </div>
  )
}
