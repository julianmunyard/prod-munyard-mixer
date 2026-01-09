import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')
  
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }
  
  try {
    // Fetch the image from Figma
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status })
    }
    
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'
    
    // Return the image with proper CORS headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Error fetching Figma image:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

