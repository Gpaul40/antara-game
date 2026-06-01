import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const cardsDir = path.join(process.cwd(), 'public', 'cards')
    const files = fs.existsSync(cardsDir) ? fs.readdirSync(cardsDir) : []
    const images = files
      .filter(f => f.endsWith('_card.jpg'))
      .map(f => `/cards/${f}`)

    if (images.length < 4) {
      return NextResponse.json({ error: 'Add your photos to the /public/cards folder' }, { status: 500 })
    }

    return NextResponse.json({ images })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
