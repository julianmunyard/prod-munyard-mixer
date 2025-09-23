'use client'

import { useParams } from 'next/navigation'

export default function TestPage() {
  const { artist, songSlug } = useParams() as { artist: string; songSlug: string }
  
  console.log('Test page - URL parameters:', { artist, songSlug });
  
  return (
    <div className="p-8">
      <h1>Test Page</h1>
      <p>Artist: {artist}</p>
      <p>Song Slug: {songSlug}</p>
      <p>This is a simple test page to verify the route is working.</p>
    </div>
  )
}
