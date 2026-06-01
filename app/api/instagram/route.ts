import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.INSTAGRAM_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'No token configured' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url&limit=60&access_token=${token}`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()

    if (!res.ok || data.error) {
      return NextResponse.json({ error: data.error?.message ?? 'Instagram error' }, { status: 500 })
    }

    const images: string[] = (data.data ?? [])
      .filter((p: { media_type: string }) => p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL_ALBUM')
      .map((p: { media_url: string; thumbnail_url?: string }) => p.media_url ?? p.thumbnail_url)
      .filter(Boolean)

    return NextResponse.json({ images })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
