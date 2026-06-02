'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'

const DIFFICULTY = {
  easy:   { label: 'INITIATE',  pairs: 8,  time: 180, columns: 8,  discount: 10, code: 'MKBANTARA13Q10', shopUrl: 'https://antarainternational.com/discount/MKBANTARA13Q10' },
  medium: { label: 'THE EDIT',  pairs: 15, time: 240, columns: 10, discount: 20, code: 'W8DANTARA2Q20',  shopUrl: 'https://antarainternational.com/discount/W8DANTARA2Q20' },
  hard:   { label: 'COLLECTOR', pairs: 25, time: 300, columns: 10, discount: 30, code: 'NBZANTARACJ30',  shopUrl: 'https://antarainternational.com/discount/NBZANTARACJ30' },
} as const

type Difficulty = keyof typeof DIFFICULTY

interface Card {
  id: number
  pairId: number
  imageUrl: string
  isFlipped: boolean
  isMatched: boolean
}

type GameState = 'intro' | 'loading' | 'peek' | 'playing' | 'won' | 'lost'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateCards(images: string[], numPairs: number): Card[] {
  const pool = images.slice(0, numPairs)
  const pairs = pool.flatMap((imageUrl, i) => [
    { id: i * 2,     pairId: i, imageUrl, isFlipped: false, isMatched: false },
    { id: i * 2 + 1, pairId: i, imageUrl, isFlipped: false, isMatched: false },
  ])
  return shuffle(pairs)
}

export default function AntaraGame() {
  const [gameState, setGameState] = useState<GameState>('intro')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [cards, setCards] = useState<Card[]>([])
  const [images, setImages] = useState<string[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [flippedIds, setFlippedIds] = useState<number[]>([])
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [moves, setMoves] = useState(0)
  const [isChecking, setIsChecking] = useState(false)
  const [streak, setStreak] = useState(0)
  const [peekCountdown, setPeekCountdown] = useState(3)
  const [bestTime, setBestTime] = useState<number | null>(null)
  const cardsRef = useRef(cards)
  cardsRef.current = cards

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`antara-best-${difficulty}`)
      setBestTime(stored ? Number(stored) : null)
    } catch { setBestTime(null) }
  }, [difficulty])

  const loadImages = useCallback(async () => {
    setGameState('loading')
    setImageError(null)
    try {
      const res = await fetch('/api/instagram')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.images || data.images.length < 8) throw new Error('Not enough images')
      setImages(data.images)
      setGameState('intro')
    } catch (e) {
      setImageError(String(e))
      setGameState('intro')
    }
  }, [])

  useEffect(() => { loadImages() }, [loadImages])

  const startGame = useCallback((diff: Difficulty) => {
    const cfg = DIFFICULTY[diff]
    setDifficulty(diff)
    setCards(generateCards(shuffle(images), cfg.pairs).map(c => ({ ...c, isFlipped: true })))
    setFlippedIds([])
    setMatchedPairs(0)
    setTimeLeft(cfg.time)
    setMoves(0)
    setIsChecking(false)
    setStreak(0)
    setPeekCountdown(3)
    setGameState('peek')
  }, [images])

  // Peek countdown
  useEffect(() => {
    if (gameState !== 'peek') return
    if (peekCountdown <= 0) {
      setCards(prev => prev.map(c => ({ ...c, isFlipped: false })))
      setGameState('playing')
      return
    }
    const id = setTimeout(() => setPeekCountdown(p => p - 1), 1000)
    return () => clearTimeout(id)
  }, [gameState, peekCountdown])

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return
    if (timeLeft <= 0) { setGameState('lost'); return }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(id)
  }, [gameState, timeLeft])

  // Win check
  useEffect(() => {
    const cfg = DIFFICULTY[difficulty]
    if (gameState === 'playing' && matchedPairs === cfg.pairs) {
      setGameState('won')
      try {
        const elapsed = cfg.time - timeLeft
        const stored = localStorage.getItem(`antara-best-${difficulty}`)
        if (!stored || elapsed < Number(stored)) {
          localStorage.setItem(`antara-best-${difficulty}`, String(elapsed))
          setBestTime(elapsed)
        }
      } catch { /* ignore */ }
    }
  }, [matchedPairs, gameState, difficulty, timeLeft])

  const handleCardClick = useCallback((cardId: number) => {
    if (isChecking || gameState !== 'playing') return
    const card = cardsRef.current.find(c => c.id === cardId)
    if (!card || card.isFlipped || card.isMatched) return

    setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c))

    setFlippedIds(prev => {
      if (prev.length >= 2) return prev
      const next = [...prev, cardId]
      if (next.length === 2) {
        setMoves(m => m + 1)
        setIsChecking(true)
        const [a, b] = next.map(id => cardsRef.current.find(c => c.id === id)!)
        if (a.pairId === b.pairId) {
          setTimeout(() => {
            setCards(all => all.map(c =>
              next.includes(c.id) ? { ...c, isMatched: true, isFlipped: true } : c
            ))
            setMatchedPairs(m => m + 1)
            setStreak(s => s + 1)
            setFlippedIds([])
            setIsChecking(false)
          }, 400)
        } else {
          setStreak(0)
          setTimeout(() => {
            setCards(all => all.map(c =>
              next.includes(c.id) ? { ...c, isFlipped: false } : c
            ))
            setFlippedIds([])
            setIsChecking(false)
          }, 900)
        }
      }
      return next
    })
  }, [isChecking, gameState])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const cfg = DIFFICULTY[difficulty]
  const hasImages = images.length >= 8

  // ── LOADING ────────────────────────────────────────────────
  if (gameState === 'loading') return (
    <div className="intro-screen">
      <div className="intro-content">
        <div className="brand-logo">ANTARA INTERNATIONAL</div>
        <div className="loading-spinner" />
        <p className="game-subtitle">Loading The Edit&hellip;</p>
      </div>
    </div>
  )

  // ── INTRO ──────────────────────────────────────────────────
  if (gameState === 'intro') return (
    <div className="intro-screen">
      <div className="intro-content">
        <div className="brand-logo">ANTARA INTERNATIONAL</div>
        <h1 className="game-title">THE EDIT</h1>
        <p className="game-subtitle">A memory challenge for those who move with intention.</p>
        {imageError && (
          <div className="error-banner">
            <p>Add your photos to the <strong>public/cards</strong> folder to play.</p>
            <button className="retry-btn" onClick={loadImages}>Retry</button>
          </div>
        )}
        <div className="game-rules">
          <p>Match all pairs to complete the challenge.</p>
          <p>Beat it in time &mdash; win up to 30% off your next order.</p>
        </div>
        <div className="difficulty-label">SELECT LEVEL</div>
        <div className="difficulty-btns">
          {(Object.keys(DIFFICULTY) as Difficulty[]).map(d => (
            <button
              key={d}
              className={`diff-btn${difficulty === d ? ' active' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              <span className="diff-name">{DIFFICULTY[d].label}</span>
              <span className="diff-discount">{DIFFICULTY[d].discount}% OFF</span>
              <span className="diff-detail">{DIFFICULTY[d].pairs} pairs &middot; {fmt(DIFFICULTY[d].time)}</span>
            </button>
          ))}
        </div>
        {bestTime !== null && (
          <div className="best-time">Best: {fmt(bestTime)} elapsed</div>
        )}
        <button
          className="start-btn"
          onClick={() => startGame(difficulty)}
          disabled={!hasImages}
          style={!hasImages ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          {hasImages ? 'BEGIN' : 'ADD PHOTOS TO PLAY'}
        </button>
      </div>
    </div>
  )

  // ── PEEK ───────────────────────────────────────────────────
  if (gameState === 'peek') return (
    <div className="peek-screen">
      <div className="peek-overlay">
        <div className="peek-message">
          <div className="brand-logo">ANTARA</div>
          <p className="peek-text">STUDY THE BOARD</p>
          <div className="peek-countdown">{peekCountdown}</div>
        </div>
      </div>
      <div className="cards-grid peek-grid" style={{ '--cols': cfg.columns } as React.CSSProperties}>
        {cards.map(card => (
          <div key={card.id} className="card flipped">
            <div className="card-inner">
              <div className="card-back"><span className="card-back-logo">A</span></div>
              <div className="card-front card-front-img">
                <Image src={card.imageUrl} alt="" fill sizes="15vw" className="card-photo" unoptimized />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ── WON ────────────────────────────────────────────────────
  if (gameState === 'won') {
    const elapsed = cfg.time - timeLeft
    return (
      <div className="result-screen won-screen">
        <div className="particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="particle" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
        <div className="result-content">
          <div className="brand-logo">ANTARA INTERNATIONAL</div>
          <div className="result-icon won-icon">&#10022;</div>
          <h1 className="result-title">YOU PREVAILED.</h1>
          <p className="result-subtitle">Quiet confidence. Well played.</p>
          <div className="win-stats">
            <div className="win-stat"><span>{fmt(elapsed)}</span><label>Time</label></div>
            <div className="win-stat-divider" />
            <div className="win-stat"><span>{moves}</span><label>Moves</label></div>
          </div>
          <div className="discount-block">
            <p className="discount-label">Your Reward</p>
            <p className="discount-value">{cfg.discount}% OFF — Unlocked</p>
            <p className="discount-note">Discount applied automatically at checkout &middot; Single use &middot; Valid 48 hours</p>
          </div>
          <a className="shop-btn shop-btn-reward" href={cfg.shopUrl}>
            CLAIM {cfg.discount}% OFF — SHOP NOW
          </a>
          <button className="play-again-btn" onClick={() => setGameState('intro')}>PLAY AGAIN</button>
        </div>
      </div>
    )
  }

  // ── LOST ───────────────────────────────────────────────────
  if (gameState === 'lost') return (
    <div className="result-screen lost-screen">
      <div className="result-content">
        <div className="brand-logo">ANTARA INTERNATIONAL</div>
        <div className="result-icon">&#9632;</div>
        <h1 className="result-title">TIME EXPIRED.</h1>
        <p className="result-subtitle">The disciplined return. The rest move on.</p>
        <div className="lost-progress">
          <div className="lost-progress-bar" style={{ width: `${(matchedPairs / cfg.pairs) * 100}%` }} />
        </div>
        <p className="pairs-info">{matchedPairs} of {cfg.pairs} pairs matched</p>
        <button className="start-btn" onClick={() => startGame(difficulty)}>TRY AGAIN</button>
        <button className="play-again-btn" onClick={() => setGameState('intro')}>CHANGE LEVEL</button>
      </div>
    </div>
  )

  // ── PLAYING ────────────────────────────────────────────────
  const progress = matchedPairs / cfg.pairs

  return (
    <div className="game-screen">
      <header className="game-header">
        <div className="brand-logo-sm">ANTARA</div>
        <div className="game-stats">
          <div className={`timer${timeLeft < 60 ? ' urgent' : ''}`}>{fmt(timeLeft)}</div>
          <div className="pairs-stat">{matchedPairs}/{cfg.pairs}</div>
          <div className="moves-stat">{moves} moves</div>
          {streak >= 3 && <div className="streak">{streak}x</div>}
        </div>
      </header>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="cards-grid" style={{ '--cols': cfg.columns } as React.CSSProperties}>
        {cards.map(card => (
          <div
            key={card.id}
            className={`card${card.isFlipped || card.isMatched ? ' flipped' : ''}${card.isMatched ? ' matched' : ''}`}
            onClick={() => handleCardClick(card.id)}
          >
            <div className="card-inner">
              <div className="card-back">
                <span className="card-back-logo">A</span>
              </div>
              <div className="card-front card-front-img">
                <Image
                  src={card.imageUrl}
                  alt=""
                  fill
                  sizes="15vw"
                  className="card-photo"
                  unoptimized
                />
                {card.isMatched && <div className="card-matched-overlay" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
