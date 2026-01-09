'use client'

import React from 'react'

// EXACT Figma image assets - Latest URLs from Figma MCP
const imgEllipse6 = "https://www.figma.com/api/mcp/asset/02daa360-9dd0-4189-9aad-a6a52e5fc05b"
const imgEllipse4 = "https://www.figma.com/api/mcp/asset/f2180131-69f1-420a-b8fc-99d02049c817"
const img1 = "https://www.figma.com/api/mcp/asset/4d38fde7-42d7-4087-bb0e-65258853995b"
const img2 = "https://www.figma.com/api/mcp/asset/a3c36974-b9aa-42c5-b38b-9841bc8793ce"
const imgEllipse11 = "https://www.figma.com/api/mcp/asset/39e76f11-b831-4640-9230-452bb6511952"
const imgUnion = "https://www.figma.com/api/mcp/asset/37fc043f-9d93-4155-ac9f-4e5590f34816"
const imgUnion1 = "https://www.figma.com/api/mcp/asset/3e33256e-39c3-4a77-8120-18755364084a"
const imgEllipse14 = "https://www.figma.com/api/mcp/asset/96342d8b-c6da-40ec-9b01-f9ad8090bf1c"
const imgEllipse5 = "https://www.figma.com/api/mcp/asset/da877e39-4a17-4bb7-b1c0-8ff2660a87e0"
const imgEllipse3 = "https://www.figma.com/api/mcp/asset/3cdddc8d-da9f-4779-8292-cee231865e65"
const imgEllipse2 = "https://www.figma.com/api/mcp/asset/41e5d4b4-4ebb-4687-b055-184dbab4d284"
const imgEllipse7 = "https://www.figma.com/api/mcp/asset/ec31368d-a064-4ebc-a8ea-4e7522479f73"
const imgGroup41 = "https://www.figma.com/api/mcp/asset/774e9ee1-06b5-4d30-90c9-b1c67a1873ef"
const imgRectangle10 = "https://www.figma.com/api/mcp/asset/7124699f-99c3-4f99-91ab-856ae3aaccaa"
const imgEllipse9 = "https://www.figma.com/api/mcp/asset/3628fef8-3dcc-4c83-a9e3-65d45622b27d"
const imgGroup11 = "https://www.figma.com/api/mcp/asset/8292b621-eeaa-4351-8406-a13920b60cfc"
const imgGroup12 = "https://www.figma.com/api/mcp/asset/03a685f8-d04b-400e-8886-7fb9cbbd7d63"
const imgRectangle14 = "https://www.figma.com/api/mcp/asset/89f43e90-4e9c-4cf7-b9a1-b5f203d7ca87"
const imgGroup17 = "https://www.figma.com/api/mcp/asset/1d851244-75e7-4bc6-871a-cca8578c42de"
const imgGroup18 = "https://www.figma.com/api/mcp/asset/cecd6287-c0ac-4f11-ac31-94f0f41c614c"
const imgGroup19 = "https://www.figma.com/api/mcp/asset/7ed934c6-c7a8-4885-91bb-aa1d3a371714"
const imgRectangle15 = "https://www.figma.com/api/mcp/asset/4d19d5dc-a628-4d84-ba20-cb9b93670ef3"
const imgEllipse8 = "https://www.figma.com/api/mcp/asset/c6174c3b-941f-4534-966c-45713938b056"
const imgEllipse10 = "https://www.figma.com/api/mcp/asset/ceb70417-fa1e-4f9d-a890-a28449bcf435"
const imgRectangle35 = "https://www.figma.com/api/mcp/asset/730bc45e-4117-4417-bc96-7723b556655e"
const imgRectangle36 = "https://www.figma.com/api/mcp/asset/f82079f6-904c-4d8b-b567-8c49941ee239"
const imgGroup2 = "https://www.figma.com/api/mcp/asset/fbe97362-2a46-4535-8090-12ef8cfc6161"
const img = "https://www.figma.com/api/mcp/asset/f84045b5-6970-451b-9bad-949c0b6f419b"
const imgGroup39 = "https://www.figma.com/api/mcp/asset/b24fb8ba-3100-40a5-9079-9cffd4c45c21"
const imgGroup26 = "https://www.figma.com/api/mcp/asset/82daf126-a3bf-4aae-88d1-49b0be489d89"

// Helper component for images with error handling - uses API proxy to avoid CORS
const FigmaImage = ({ src, alt, style, className, ...props }: { src: string; alt: string; style?: React.CSSProperties; className?: string; [key: string]: any }) => {
  const [imgSrc, setImgSrc] = React.useState<string | null>(null)
  const [hasError, setHasError] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  
  React.useEffect(() => {
    const proxyUrl = `/api/figma-image?url=${encodeURIComponent(src)}`
    setImgSrc(proxyUrl)
    setIsLoading(true)
    setHasError(false)
    
    const img = new Image()
    img.onload = () => {
      setIsLoading(false)
      setHasError(false)
    }
    img.onerror = () => {
      console.warn('Failed to load Figma image:', src)
      setIsLoading(false)
      setHasError(true)
    }
    img.src = proxyUrl
  }, [src])
  
  if (hasError || !imgSrc) {
    return <div style={{ ...style, backgroundColor: 'rgba(200,200,200,0.3)', border: '1px dashed #999' }} className={className} />
  }
  
  return (
    <img 
      alt={alt} 
      src={imgSrc} 
      style={{ ...style, display: 'block', maxWidth: 'none', opacity: isLoading ? 0 : 1, transition: 'opacity 0.2s' }} 
      className={className}
      onError={() => setHasError(true)}
      onLoad={() => setIsLoading(false)}
      {...props}
    />
  )
}

// STATIC COMPONENT - EXACT Figma recreation, NO integration
export default function FigmaMixerLayout() {
  const containerWidth = 1426
  const containerHeight = 1426
  const scale = typeof window !== 'undefined' 
    ? Math.min((window.innerWidth - 40) / containerWidth, (window.innerHeight - 40) / containerHeight, 1) 
    : 1
  
  return (
    <div 
      className="relative w-full min-h-screen overflow-auto flex items-center justify-center p-5"
      style={{
        backgroundColor: '#131715',
        border: '1px solid #e36a2b',
      }}
      data-name="parts"
      data-node-id="1:363"
    >
      <div 
        className="relative mx-auto"
        style={{
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundColor: '#131715',
        }}
      >
        {/* EXACT Figma code from get_design_context - all elements positioned exactly as in Figma */}
        {/* This is a static recreation - no dynamic content */}
        
        {/* LEFT FADER BAR */}
        <div className="absolute" style={{ left: '177.95px', top: '248.51px' }} data-node-id="1:1075">
          <div className="absolute block" style={{ height: '520.225px', left: '178.95px', top: '249.51px', width: '52.582px' }} data-name="Union" data-node-id="1:1076">
            <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgUnion} />
          </div>
          <div className="absolute" style={{ height: '513.402px', left: '182.03px', top: '254.02px', width: '46.432px' }} data-name="Union" data-node-id="1:1079">
            <div className="absolute" style={{ inset: '-0.39% -4.31%' }}>
              <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgUnion1} />
            </div>
          </div>
          <div className="absolute" style={{ left: '196.43px', top: '498.62px' }} data-node-id="1:1082">
            <div className="absolute" style={{ left: '196.43px', width: '22px', height: '22px', top: '498.62px' }}>
              <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgEllipse14} />
            </div>
            <div className="absolute" style={{ left: '199.2px', width: '16.471px', height: '16.471px', top: '501.39px' }} data-name="Screw" data-node-id="1:1084">
              <div className="absolute" style={{ inset: 0, WebkitMaskImage: `url('${imgEllipse5}')`, maskImage: `url('${imgEllipse5}')`, WebkitMaskSize: '16.471px 16.471px', maskSize: '16.471px 16.471px', WebkitMaskPosition: '0px 0px', maskPosition: '0px 0px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id="1:1086">
                <div className="absolute" style={{ inset: '-3.04%' }}>
                  <FigmaImage alt="" className="block max-w-none" style={{ width: '17.471px', height: '17.471px' }} src={imgEllipse6} />
                </div>
              </div>
              <div className="absolute" style={{ inset: '7.84%', WebkitMaskImage: `url('${imgEllipse5}')`, maskImage: `url('${imgEllipse5}')`, WebkitMaskSize: '16.471px 16.471px', maskSize: '16.471px 16.471px', WebkitMaskPosition: '-1.291px -1.291px', maskPosition: '-1.291px -1.291px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', mixBlendMode: 'screen' }} data-node-id="1:1087">
                <div className="absolute" style={{ inset: '-15.57%' }}>
                  <FigmaImage alt="" className="block max-w-none" style={{ width: '18.214px', height: '18.214px' }} src={imgEllipse4} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LARGE CIRCLE with text labels */}
        <div className="absolute" style={{ left: '318.13px', top: '178.02px' }} data-node-id="1:1088">
          <div className="absolute" style={{ left: '319.13px', width: '639.206px', height: '639.206px', top: '179.02px' }} data-node-id="1:1089">
            <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgEllipse3} />
          </div>
          <div className="absolute" style={{ left: '323.07px', width: '631.327px', height: '631.327px', top: '182.96px' }} data-node-id="1:1090">
            <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgEllipse2} />
          </div>
          <div className="absolute" style={{ left: '327.01px', width: '623.447px', height: '623.447px', top: '186.9px' }} data-node-id="1:1091">
            <div className="absolute" style={{ inset: '-0.32%' }}>
              <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgEllipse7} />
            </div>
          </div>
          <div className="absolute" style={{ left: '481.99px', top: '335.38px' }} data-node-id="1:1092">
            <div className="absolute flex items-center justify-center" style={{ left: '481.99px', mixBlendMode: 'multiply', width: '67.175px', height: '67.175px', top: '335.38px' }}>
              <div style={{ transform: 'rotate(45deg)' }}>
                <p style={{ fontFamily: "'Poppins', 'Poppins ExtraLight', sans-serif", fontWeight: 200, lineHeight: 'normal', fontStyle: 'normal', opacity: 0.6, position: 'relative', fontSize: '22.1px', color: '#000000', margin: 0, textShadow: 'none', whiteSpace: 'nowrap' }} data-node-id="1:1093">
                  96/24
                </p>
              </div>
            </div>
            <div className="absolute" style={{ height: '78.526px', left: '740.24px', top: '605.34px', width: '76.637px' }} data-node-id="1:1094">
              <div className="absolute flex items-center justify-center" style={{ left: '783.86px', width: '23.543px', height: '23.543px', top: '651.91px' }}>
                <div style={{ transform: 'rotate(47.96deg)' }}>
                  <div className="flex flex-col items-center justify-center relative" style={{ border: '0.639px solid black', borderStyle: 'solid', padding: '2.778px', borderRadius: '1.918px', width: '16.67px', height: '16.67px' }} data-node-id="1:1095">
                    <p style={{ fontFamily: "'Poppins', 'Poppins ExtraLight', sans-serif", fontWeight: 200, lineHeight: 'normal', fontStyle: 'normal', position: 'relative', fontSize: '11.113px', color: '#000000', margin: 0, flexShrink: 0, textShadow: 'none' }} data-node-id="1:1096">
                      M
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute flex h-[40.751px] items-center justify-center" style={{ left: '740.24px', mixBlendMode: 'multiply', top: '605.34px', width: '42.576px' }}>
                <div style={{ transform: 'rotate(47.96deg)' }}>
                  <p style={{ fontFamily: "'Poppins', 'Poppins ExtraLight', sans-serif", fontWeight: 200, lineHeight: 'normal', fontStyle: 'normal', opacity: 0.6, position: 'relative', fontSize: '28.133px', color: '#000000', margin: 0, textShadow: 'none' }} data-node-id="1:1097">
                    3
                  </p>
                </div>
              </div>
              <div className="absolute flex h-[22.308px] items-center justify-center" style={{ left: '766.42px', top: '632.16px', width: '21.852px' }}>
                <div style={{ transform: 'rotate(47.96deg)' }}>
                  <div className="relative" style={{ height: '12.507px', width: '18.761px' }} data-node-id="1:1098">
                    <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgGroup41} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER DIAL with screws */}
        <div className="absolute" style={{ left: '556.19px', width: '163.077px', height: '163.077px', top: '416.09px' }} data-name="Center dial" data-node-id="1:1311">
          <div className="absolute" style={{ left: '-57.82px', top: '-59.49px' }} data-node-id="1:1312">
            <div className="absolute" style={{ height: '222.738px', left: '-57.82px', top: '-59.49px', width: '221.238px' }} data-node-id="1:1313">
              <div className="absolute" style={{ inset: '0 -0.55% -0.54% 0' }}>
                <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgGroup2} />
              </div>
            </div>
            {[47.93, 53.65, 127.96].map((left, idx) => [26.83, 122.21, 70.01][idx] && (
              <div key={idx} className="absolute" style={{ left: `${left}px`, width: '11.452px', height: '11.452px', top: `${[26.83, 122.21, 70.01][idx]}px` }} data-name="Screw" data-node-id={`1:${1321 + idx}`}>
                <div className="absolute" style={{ inset: 0, WebkitMaskImage: `url('${img}')`, maskImage: `url('${img}')`, WebkitMaskSize: '11.587px 11.587px', maskSize: '11.587px 11.587px', WebkitMaskPosition: '0px 0px', maskPosition: '0px 0px' }}>
                  <FigmaImage alt="" className="block max-w-none" style={{ width: '11.452px', height: '11.452px' }} src={img1} />
                </div>
                <div className="absolute" style={{ inset: '7.84%', WebkitMaskImage: `url('${img}')`, maskImage: `url('${img}')`, WebkitMaskSize: '11.587px 11.587px', maskSize: '11.587px 11.587px', WebkitMaskPosition: '-0.908px -0.908px', maskPosition: '-0.908px -0.908px' }}>
                  <div className="absolute" style={{ inset: '-15.57%' }}>
                    <FigmaImage alt="" className="block max-w-none" style={{ width: '12.663px', height: '12.663px' }} src={img2} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute" style={{ left: '3.4px', width: '8.014px', height: '8.014px', top: '45.98px' }} data-node-id="1:1324">
            <div className="absolute" style={{ inset: '-24.67%' }}>
              <FigmaImage alt="" className="block max-w-none" style={{ width: '11.967px', height: '11.967px' }} src={imgEllipse11} />
            </div>
          </div>
        </div>

        {/* SWITCHES PANEL - Static 3 buttons as in Figma */}
        <div className="absolute" style={{ left: '144.25px', top: '1004.7px' }} data-name="Switches" data-node-id="1:1101">
          <div className="absolute" style={{ height: '241.029px', left: '145.25px', top: '1009.39px', width: '509.847px', backgroundImage: 'linear-gradient(163.1125015814295deg, rgba(1, 5, 5, 1) 9.7477%, rgba(102, 104, 105, 1) 89.277%)', borderRadius: '0 0 28px 0', WebkitMaskImage: `url('${imgRectangle10}')`, maskImage: `url('${imgRectangle10}')`, WebkitMaskSize: '513.313px 241.712px', maskSize: '513.313px 241.712px', WebkitMaskPosition: '0px -3.687px', maskPosition: '0px -3.687px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id="1:1103" />
          <div className="absolute" style={{ backgroundColor: 'rgba(217,217,217,0.6)', height: '72.26px', left: '145.25px', top: '1004.63px', width: '24.25px', WebkitMaskImage: `url('${imgRectangle10}')`, maskImage: `url('${imgRectangle10}')`, WebkitMaskSize: '513.313px 241.712px', maskSize: '513.313px 241.712px', WebkitMaskPosition: '0px 1.066px', maskPosition: '0px 1.066px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id="1:1104" />
          <div className="absolute" style={{ left: '145.25px', top: '1017.74px' }} data-name="Buttons big" data-node-id="1:1105">
            {[0, 1, 2].map((index) => {
              const buttonLeft = index * 168.61
              const maskOffsetX = -index * 168.61
              return (
                <React.Fragment key={index}>
                  <div className="absolute" style={{ height: '229.67px', left: `${145.25 + buttonLeft}px`, width: '165.61px', top: '1017.74px', backgroundImage: 'linear-gradient(180.6566844257303deg, rgba(176, 177, 176, 1) 5.1833%, rgba(235, 235, 235, 1) 0.42782%, rgba(180, 180, 180, 1) 7.2945%, rgba(195, 195, 195, 1) 63.121%, rgba(183, 183, 183, 1) 99.902%)', borderRadius: index === 0 ? '0 0 28px 0' : '1px', WebkitMaskImage: `url('${imgRectangle10}')`, maskImage: `url('${imgRectangle10}')`, WebkitMaskSize: '513.313px 241.712px', maskSize: '513.313px 241.712px', WebkitMaskPosition: `${maskOffsetX}px -12.042px`, maskPosition: `${maskOffsetX}px -12.042px`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id={`1:${1108 + index * 2}`}>
                    <div className="absolute pointer-events-none" style={{ inset: 0, boxShadow: 'inset 0px -11px 10px 0px rgba(0,0,0,0.14), inset 8px -4px 2px 0px rgba(255,255,255,0.5)' }} />
                  </div>
                  <div className="absolute" style={{ height: index === 0 ? '226.432px' : '226.53px', left: `${145.25 + buttonLeft + (index === 0 ? 3.87 : 1.56)}px`, width: index === 0 ? '159.466px' : '161.761px', top: '1017.74px', backgroundImage: 'linear-gradient(179.99999890697575deg, rgba(176, 177, 176, 1) 3.8357%, rgba(235, 235, 235, 1) 1.7088%, rgba(180, 180, 180, 1) 8.4938%, rgba(180, 180, 180, 1) 63.657%, rgba(171, 172, 171, 1) 90.234%, rgba(181, 182, 181, 1) 100%)', borderRadius: index === 0 ? '0 0 27px 0' : '1px', boxShadow: '0.5px 0.5px 1px 0px rgba(0,0,0,0.75)', WebkitMaskImage: `url('${imgRectangle10}')`, maskImage: `url('${imgRectangle10}')`, WebkitMaskSize: '513.313px 241.712px', maskSize: '513.313px 241.712px', WebkitMaskPosition: `${maskOffsetX - (index === 0 ? 3.863 : 1.558)}px -12.042px`, maskPosition: `${maskOffsetX - (index === 0 ? 3.863 : 1.558)}px -12.042px`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id={`1:${1109 + index * 2}`} />
                  {index === 1 && (
                    <div className="absolute" style={{ height: '20px', left: `${145.25 + buttonLeft + 67.84}px`, top: '1068.11px', width: '20.77px', WebkitMaskImage: `url('${imgRectangle10}')`, maskImage: `url('${imgRectangle10}')`, WebkitMaskSize: '513.313px 241.712px', maskSize: '513.313px 241.712px', WebkitMaskPosition: `${maskOffsetX - 67.797}px -62.411px`, maskPosition: `${maskOffsetX - 67.797}px -62.411px`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id={`1:${1110 + index * 2}`}>
                      <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgEllipse9} />
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
          <div className="absolute flex items-center justify-center" style={{ height: '586.353px', left: '139.09px', top: '779.09px', width: '674.792px' }}>
            <div style={{ transform: 'rotate(90deg)' }}>
              <div className="relative" style={{ height: '674.792px', width: '586.353px', WebkitMaskImage: `url('${imgRectangle10}')`, maskImage: `url('${imgRectangle10}')`, WebkitMaskSize: '513.313px 241.712px', maskSize: '513.313px 241.712px', WebkitMaskPosition: '6.164px 226.609px', maskPosition: '6.164px 226.609px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id="1:1121">
                <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgGroup12} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT VOLUME FADERS - Static 3 faders */}
        <div className="absolute" style={{ left: '1311.85px', top: '863.69px' }} data-node-id="1:1374">
          {[0, 1, 2].map((index) => {
            const faderTop = index === 0 ? 864.69 : (1034.06 + (index - 1) * 122.75)
            const faderHeight = index === 0 ? 130.596 : 53.709
            return (
              <div key={index} className="absolute" style={{ left: '1312.85px', top: `${faderTop}px` }} data-name="Mask group" data-node-id={`1:${778 + index * 4}`}>
                <div className="absolute" style={{ height: `${faderHeight}px`, left: '1312.85px', width: '9.205px', top: `${faderTop}px`, backgroundImage: index === 0 ? 'linear-gradient(179.99999999999966deg, rgba(89, 91, 93, 1) 0%, rgba(195, 197, 198, 1) 3.7837%, rgba(114, 116, 118, 1) 13.389%, rgba(104, 106, 107, 1) 45.405%, rgba(130, 132, 133, 1) 85.57%, rgba(38, 44, 46, 1) 95.03%, rgba(201, 200, 202, 1) 99.589%, rgba(255, 255, 255, 0) 100.41%)' : 'linear-gradient(179.9999999999999deg, rgba(89, 91, 93, 1) 0%, rgba(195, 197, 198, 1) 3.7837%, rgba(114, 116, 118, 1) 13.389%, rgba(104, 106, 107, 1) 45.405%, rgba(130, 132, 133, 1) 85.57%, rgba(38, 44, 46, 1) 95.03%, rgba(201, 200, 202, 1) 99.589%, rgba(255, 255, 255, 0) 100.41%)', borderRadius: '0 2px 2px 0', WebkitMaskImage: `url('${index === 0 ? imgRectangle35 : imgRectangle36}')`, maskImage: `url('${index === 0 ? imgRectangle35 : imgRectangle36}')`, WebkitMaskSize: index === 0 ? '9.205px 130.596px' : '9.205px 53.709px', maskSize: index === 0 ? '9.205px 130.596px' : '9.205px 53.709px', WebkitMaskPosition: '0px 0px', maskPosition: '0px 0px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id={`1:${index === 0 ? 780 : 784 + (index - 1) * 4}`} />
                <div className="absolute" style={{ border: '1px solid #fcfefe', borderStyle: 'solid', height: `${faderHeight + (index === 0 ? 1.143 : 0.47)}px`, left: '1312.85px', width: index === 0 ? '7.852px' : '7.931px', top: `${faderTop - (index === 0 ? 1.143 : 0.47)}px`, backgroundImage: index === 0 ? 'linear-gradient(179.9999999999996deg, rgba(89, 91, 93, 1) 0%, rgba(195, 197, 198, 1) 3.7837%, rgba(114, 116, 118, 1) 13.389%, rgba(104, 106, 107, 1) 45.405%, rgba(130, 132, 133, 1) 85.57%, rgba(38, 44, 46, 1) 95.03%, rgba(201, 200, 202, 1) 99.589%, rgba(255, 255, 255, 0) 100.41%)' : 'linear-gradient(179.99999999999983deg, rgba(160, 162, 163, 1) 0%, rgba(111, 113, 114, 1) 9.5114%, rgba(201, 203, 204, 1) 13.389%, rgba(170, 172, 171, 1) 45.405%, rgba(34, 39, 41, 1) 67.568%, rgba(72, 75, 76, 1) 85.57%, rgba(155, 157, 158, 1) 95.03%, rgba(201, 200, 202, 1) 99.589%, rgba(175, 177, 176, 1) 100.41%)', WebkitMaskImage: `url('${index === 0 ? imgRectangle35 : imgRectangle36}')`, maskImage: `url('${index === 0 ? imgRectangle35 : imgRectangle36}')`, WebkitMaskSize: index === 0 ? '9.205px 130.596px' : '9.205px 53.709px', maskSize: index === 0 ? '9.205px 130.596px' : '9.205px 53.709px', WebkitMaskPosition: index === 0 ? '0px 1.143px' : '0px 0.47px', maskPosition: index === 0 ? '0px 1.143px' : '0px 0.47px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', boxShadow: 'inset 1px 0px 2px 0px rgba(0,0,0,0.45), inset -1px 4px 0.5px 0px rgba(225,225,225,0.25)' }} data-node-id={`1:${index === 0 ? 781 : 785 + (index - 1) * 4}`} />
              </div>
            )
          })}
        </div>

        {/* VOLUME CONTROL KNOB */}
        <div className="absolute" style={{ left: '1051.25px', top: '1081.8px' }} data-node-id="1:1129">
          <div className="absolute" style={{ left: '1052.25px', top: '1099.9px' }} data-node-id="1:1130">
            <div className="absolute" style={{ height: '121.425px', left: '1052.76px', top: '1099.9px', width: '137.364px' }} data-node-id="1:1131">
              <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgRectangle14} />
            </div>
            <div className="absolute" style={{ left: '1052.25px', top: '1105px' }} data-node-id="1:1132">
              <div className="absolute" style={{ height: '111.776px', left: '1052.25px', top: '1105px', width: '137.386px', backgroundImage: 'linear-gradient(90.17568834801031deg, rgba(174, 174, 174, 1) 0%, rgba(194, 194, 194, 1) 17.223%, rgba(167, 169, 168, 1) 37.49%, rgba(113, 113, 113, 1) 76.91%, rgba(163, 164, 164, 1) 105.26%)' }} data-node-id="1:1133" />
              <div className="absolute" style={{ left: '1052.25px', top: '1105px' }} data-name="Mask group" data-node-id="1:1134">
                <div className="absolute" style={{ left: '903.08px', mixBlendMode: 'overlay', top: '960.13px' }} data-node-id="1:1136">
                  <div className="absolute flex items-center justify-center" style={{ height: '418.978px', left: '952.31px', top: '991.74px', width: '398.759px' }} data-node-id="1:1138">
                    <div style={{ transform: 'rotate(335.025deg) skewX(2.892deg)' }}>
                      <div className="relative" style={{ height: '350.082px', width: '259.354px', WebkitMaskImage: `url('${imgGroup17}')`, maskImage: `url('${imgGroup17}')`, WebkitMaskSize: '137.386px 111.776px', maskSize: '137.386px 111.776px', WebkitMaskPosition: '99.941px 113.262px', maskPosition: '99.941px 113.262px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id="1:1138">
                        <div className="absolute" style={{ inset: '0 -0.62% 0 0' }}>
                          <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgGroup18} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute flex items-center justify-center" style={{ height: '448.226px', left: '903.08px', top: '960.13px', width: '477.479px' }} data-node-id="1:1189">
                    <div style={{ transform: 'rotate(318.383deg) skewX(3.622deg)' }}>
                      <div className="relative" style={{ height: '328.515px', width: '326.63px', WebkitMaskImage: `url('${imgGroup17}')`, maskImage: `url('${imgGroup17}')`, WebkitMaskSize: '137.386px 111.776px', maskSize: '137.386px 111.776px', WebkitMaskPosition: '149.179px 144.867px', maskPosition: '149.179px 144.867px', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} data-node-id="1:1189">
                        <div className="absolute" style={{ inset: '0 0 -0.41% 0' }}>
                          <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgGroup19} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute" style={{ left: '903.08px', mixBlendMode: 'overlay', top: '960.13px' }} data-name="Mask group" data-node-id="1:1240">
                  <div className="absolute" style={{ backgroundColor: 'rgba(217,217,217,0.9)', filter: 'blur(26px)', height: '160.318px', left: '1079.48px', top: '1081.46px', width: '79.292px', WebkitMaskImage: `url('${imgGroup17}'), url('${imgRectangle15}')`, maskImage: `url('${imgGroup17}'), url('${imgRectangle15}')`, WebkitMaskSize: '137.386px 111.776px, 478.439px 449.178px', maskSize: '137.386px 111.776px, 478.439px 449.178px', WebkitMaskPosition: '-27.228px 23.539px, -176.407px -121.327px', maskPosition: '-27.228px 23.539px, -176.407px -121.327px', WebkitMaskRepeat: 'no-repeat, no-repeat', maskRepeat: 'no-repeat, no-repeat', WebkitMaskComposite: 'intersect', maskComposite: 'intersect' }} data-node-id="1:1292" />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute" style={{ left: '1070.63px', top: '1082.8px' }} data-node-id="1:1293">
            <div className="absolute" style={{ height: '17.101px', left: '1071.86px', top: '1082.8px', width: '98.72px', backgroundImage: 'linear-gradient(92.49823631826662deg, rgba(118, 120, 119, 1) 1.3979%, rgba(37, 39, 40, 1) 7.5124%, rgba(155, 155, 155, 1) 33.745%, rgba(72, 72, 72, 1) 69.81%, rgba(179, 179, 179, 1) 106.51%)' }} data-node-id="1:1294">
              <div className="absolute pointer-events-none" style={{ inset: 0, boxShadow: 'inset 0px 8px 7px 0px rgba(0,0,0,0.45)' }} />
            </div>
            <div className="absolute" style={{ height: '2.753px', left: '1070.63px', top: '1097.14px', width: '101.262px', backgroundImage: 'linear-gradient(105.53368455852082deg, rgba(118, 120, 119, 1) 1.3979%, rgba(37, 39, 40, 1) 7.5124%, rgba(155, 155, 155, 1) 33.745%, rgba(72, 72, 72, 1) 69.81%, rgba(107, 108, 108, 1) 106.51%)' }} data-node-id="1:1295" />
          </div>
        </div>

        {/* KNOB CONTROLS with crosshairs */}
        <div className="absolute" style={{ left: '1122.47px', width: '155.072px', height: '155.072px', top: '558.27px' }} data-node-id="1:1296">
          <div className="absolute flex items-center justify-center" style={{ left: '1128.19px', width: '144.296px', height: '144.296px', top: '565.33px' }}>
            <div style={{ transform: 'rotate(45deg)' }}>
              <div className="relative" style={{ border: '0.25px solid rgba(0,0,0,0.02)', borderStyle: 'solid', height: '139.875px', borderRadius: '56px', width: '64.19px' }} data-node-id="1:1297">
                <div className="absolute pointer-events-none" style={{ inset: 0, boxShadow: 'inset 1px 3px 2px 0px rgba(0,0,0,0.8), inset 2px 1px 2px 0px rgba(0,0,0,0.8)' }} />
              </div>
            </div>
          </div>
          <div className="absolute flex items-center justify-center" style={{ left: '1132.71px', width: '135.219px', height: '135.219px', top: '570.47px' }}>
            <div style={{ transform: 'rotate(45deg)' }}>
              <div style={{ backgroundColor: '#b1b1b1', height: '134.193px', borderRadius: '56px', width: '57.036px' }} data-node-id="1:1298" />
            </div>
          </div>
          {[1201.29, 1147.96].map((left, idx) => (
            <React.Fragment key={idx}>
              <div className="absolute flex items-center justify-center" style={{ left: `${left}px`, width: '52.028px', height: '52.028px', top: `${[584.5, 636.38][idx]}px` }} data-node-id={`1:${1300 + idx * 6}`}>
                <div style={{ transform: `rotate(${idx === 0 ? 359.122 : 2.547}deg)` }}>
                  <div className="relative" style={{ width: '51.249px', height: '51.249px' }} data-node-id={`1:${1301 + idx * 6}`}>
                    <div className="absolute" style={{ inset: '-13.66% -19.51% -21.46% -15.61%' }}>
                      <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgEllipse8} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute flex items-center justify-center" style={{ left: `${left + 2.04}px`, width: '48.037px', height: '48.037px', top: `${[586.49, 638.43][idx]}px` }}>
                <div style={{ transform: `rotate(${idx === 0 ? 359.122 : 2.547}deg)` }}>
                  <div className="relative" style={{ width: '47.317px', height: '47.317px' }} data-node-id={`1:${1302 + idx * 6}`}>
                    <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgEllipse10} />
                  </div>
                </div>
              </div>
              <div className="absolute" style={{ left: `${[1215.93, 1163.48][idx]}px`, top: `${[599.32, 662.24][idx]}px`, width: `${idx === 0 ? '22.387px' : '22.064px'}`, height: `${idx === 0 ? '22.387px' : '1.743px'}` }} data-node-id={`1:${1303 + idx * 6}`}>
                <div className="absolute flex items-center justify-center" style={{ height: `${idx === 0 ? '22.06px' : '1.743px'}`, left: `${idx === 0 ? '1226.57px' : '1163.48px'}`, top: `${idx === 0 ? '599.48px' : '662.24px'}`, width: `${idx === 0 ? '1.101px' : '22.064px'}` }}>
                  <div style={{ transform: `rotate(${idx === 0 ? 359.122 : 92.547}deg)` }}>
                    <div style={{ backgroundColor: '#b1b1b1', height: '22.051px', width: '0.764px' }} data-node-id={`1:${1304 + idx * 6}`} />
                  </div>
                </div>
                {idx === 0 && (
                  <div className="absolute flex items-center justify-center" style={{ height: '1.101px', left: '1216.09px', top: '609.96px', width: '22.06px' }}>
                    <div style={{ transform: 'rotate(89.122deg)' }}>
                      <div style={{ backgroundColor: '#b1b1b1', height: '22.051px', width: '0.764px' }} data-node-id="1:1305" />
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* DISPLAY PANEL (TODAY panel) */}
        <div className="absolute" style={{ left: '1110px', top: '353.05px' }} data-node-id="1:1334">
          <div className="absolute" style={{ height: '89.873px', left: '1111px', top: '354.05px', width: '156.928px' }} data-node-id="1:1335">
            <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgGroup39} />
          </div>
        </div>

        {/* BOTTOM GROUP (Play/Record/Stop buttons) - Using image group for now */}
        <div className="absolute" style={{ height: '183.717px', left: '791.25px', top: '1036.61px', width: '114.236px' }} data-node-id="1:1342">
          <FigmaImage alt="" className="block max-w-none w-full h-full" src={imgGroup26} />
        </div>

      </div>
    </div>
  )
}