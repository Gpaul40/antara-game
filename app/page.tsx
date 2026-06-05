'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'

const DIFFICULTY = {
  hard: { label: 'THE COLLECTOR', pairs: 0, time: 150, columns: 16, discount: 30, code: 'NBZANTARACJ30', shopUrl: 'https://antarainternational.com/discount/NBZANTARACJ30' },
} as const

type Difficulty = keyof typeof DIFFICULTY

interface Card {
  id: number
  pairId: number
  imageUrl: string
  isFlipped: boolean
  isMatched: boolean
}

type GameState = 'intro' | 'loading' | 'peek' | 'playing' | 'level_complete' | 'won' | 'lost' | 'enter_name'

interface HighscoreEntry {
  name: string
  city: string
  time: number   // elapsed seconds
  clicks: number // total moves
  date: string   // ISO date string
}

const HIGHSCORES_KEY = 'antara-highscores'
const MAX_SCORES = 5

// Basic NSFW word blocklist — covers the most common offensive terms used as names
const NSFW_WORDS = [
  'fuck','shit','ass','bitch','cunt','dick','cock','pussy','nigger','nigga','fag','faggot',
  'whore','slut','bastard','prick','twat','wank','wanker','motherfucker','retard','spastic',
  'kike','chink','spic','wetback','gook','tranny','rape','nazi',
]

function isNSFW(value: string): boolean {
  const lower = value.toLowerCase().replace(/[^a-z]/g, '')
  return NSFW_WORDS.some(w => lower.includes(w))
}

function getHighscores(): HighscoreEntry[] {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHighscore(entry: HighscoreEntry): HighscoreEntry[] {
  const scores = getHighscores()
  scores.push(entry)
  // Sort by fastest time (lowest elapsed), then fewest clicks on tie
  scores.sort((a, b) => a.time !== b.time ? a.time - b.time : a.clicks - b.clicks)
  const top = scores.slice(0, MAX_SCORES)
  try { localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(top)) } catch { /* ignore */ }
  return top
}

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
  const [difficulty, setDifficulty] = useState<Difficulty>('hard')
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
  const [activePairs, setActivePairs] = useState(0)
  const [activeCols, setActiveCols] = useState(16)
  const [level, setLevel] = useState(1)
  const [levelImages, setLevelImages] = useState<string[]>([])
  const cardsRef = useRef(cards)
  cardsRef.current = cards

  // Highscores state
  const [highscores, setHighscores] = useState<HighscoreEntry[]>([])
  const [nameInput, setNameInput] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [nameError, setNameError] = useState('')
  const [wonElapsed, setWonElapsed] = useState(0)
  const [wonMoves, setWonMoves] = useState(0)
  const [cityDetecting, setCityDetecting] = useState(false)
  const [cityAutoDetected, setCityAutoDetected] = useState(false)

  useEffect(() => {
    setHighscores(getHighscores())
  }, [])

  // Auto-detect city when name entry screen appears
  useEffect(() => {
    if (gameState !== 'enter_name') return
    setCityDetecting(true)
    setCityAutoDetected(false)
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const city = data.city || ''
        if (city) {
          setCityInput(city)
          setCityAutoDetected(true)
        }
      })
      .catch(() => { /* silently fail — user can type manually */ })
      .finally(() => setCityDetecting(false))
  }, [gameState])

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
    const shuffled = shuffle(images)
    const numPairs = Math.floor(shuffled.length / 2)
    const lvl1Images = shuffled.slice(0, numPairs)
    const cols = 16
    setDifficulty(diff)
    setActivePairs(numPairs)
    setActiveCols(cols)
    setLevel(1)
    setLevelImages(shuffled) // store all shuffled images for level 2
    setCards(generateCards(lvl1Images, numPairs).map(c => ({ ...c, isFlipped: true })))
    setFlippedIds([])
    setMatchedPairs(0)
    setTimeLeft(cfg.time)
    setMoves(0)
    setIsChecking(false)
    setStreak(0)
    setPeekCountdown(3)
    setGameState('peek')
  }, [images])

  const startLevel2 = useCallback(() => {
    const shuffled = levelImages
    const numPairs = Math.floor(shuffled.length / 2)
    const lvl2Images = shuffled.slice(numPairs)
    setLevel(2)
    setActivePairs(numPairs)
    setMatchedPairs(0)
    setCards(generateCards(lvl2Images, numPairs).map(c => ({ ...c, isFlipped: true })))
    setFlippedIds([])
    setIsChecking(false)
    setStreak(0)
    setPeekCountdown(3)
    setGameState('peek')
  }, [levelImages])

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

  // Win / level-complete check
  useEffect(() => {
    const cfg = DIFFICULTY[difficulty]
    if (gameState === 'playing' && activePairs > 0 && matchedPairs === activePairs) {
      if (level === 1) {
        setGameState('level_complete')
      } else {
        const elapsed = cfg.time - timeLeft
        setWonElapsed(elapsed)
        setWonMoves(moves)
        try {
          const stored = localStorage.getItem(`antara-best-${difficulty}`)
          if (!stored || elapsed < Number(stored)) {
            localStorage.setItem(`antara-best-${difficulty}`, String(elapsed))
            setBestTime(elapsed)
          }
        } catch { /* ignore */ }
        // Reset name form and go to enter_name screen
        setNameInput('')
        setCityInput('')
        setNameError('')
        setGameState('enter_name')
      }
    }
  }, [matchedPairs, gameState, difficulty, timeLeft, activePairs, level, moves])

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
            setTimeLeft(t => t + 10)
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
          <p>Beat it in time &mdash; win 30% off your next order.</p>
        </div>
        <div className="single-level-display">
          <div className="diff-btn active single-level">
            <span className="diff-name">THE COLLECTOR</span>
            <span className="diff-discount">30% OFF</span>
            <span className="diff-detail">2 levels · {images.length > 0 ? Math.floor(images.length / 2) : '—'} pairs each · +10s per match</span>
          </div>
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
        {highscores.length > 0 && <HighscoreBoard scores={highscores} fmt={fmt} />}
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
      <div className="cards-grid peek-grid" style={{ '--cols': activeCols } as React.CSSProperties}>
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

  // ── LEVEL COMPLETE ─────────────────────────────────────────
  if (gameState === 'level_complete') return (
    <div className="result-screen won-screen">
      <div className="particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="particle" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="result-content">
        <div className="brand-logo">ANTARA INTERNATIONAL</div>
        <div className="result-icon won-icon">&#10022;</div>
        <h1 className="result-title">LEVEL 1 COMPLETE.</h1>
        <p className="result-subtitle">Halfway there. Stay sharp.</p>
        <div className="win-stats">
          <div className="win-stat"><span>{fmt(timeLeft)}</span><label>Time Left</label></div>
          <div className="win-stat-divider" />
          <div className="win-stat"><span>{moves}</span><label>Moves</label></div>
        </div>
        <p className="discount-note" style={{ marginTop: '1rem' }}>Your timer carries over to Level 2</p>
        <button className="start-btn" style={{ marginTop: '1.5rem' }} onClick={startLevel2}>BEGIN LEVEL 2</button>
      </div>
    </div>
  )


  // ── ENTER NAME (after winning) ─────────────────────────────
  if (gameState === 'enter_name') {
    const handleSubmitName = () => {
      const name = nameInput.trim()
      const city = cityInput.trim()
      if (!name || !city) { setNameError('Please enter both your name and city.'); return }
      if (name.length > 30) { setNameError('Name must be 30 characters or fewer.'); return }
      if (city.length > 40) { setNameError('City must be 40 characters or fewer.'); return }
      if (isNSFW(name) || isNSFW(city)) { setNameError('Please keep it clean — no inappropriate words.'); return }
      const updated = saveHighscore({ name, city, time: wonElapsed, clicks: wonMoves, date: new Date().toISOString() })
      setHighscores(updated)
      setGameState('won')
    }
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
            <div className="win-stat"><span>{fmt(wonElapsed)}</span><label>Time</label></div>
            <div className="win-stat-divider" />
            <div className="win-stat"><span>{wonMoves}</span><label>Clicks</label></div>
          </div>
          <div className="name-entry-block">
            <p className="name-entry-label">Claim your spot on the leaderboard</p>
            <input
              className="name-entry-input"
              type="text"
              placeholder="First name"
              value={nameInput}
              maxLength={30}
              onChange={e => { setNameInput(e.target.value); setNameError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubmitName()}
              autoFocus
            />
            <div className="city-input-wrap">
              <input
                className="name-entry-input"
                type="text"
                placeholder={cityDetecting ? 'Detecting your city…' : 'City'}
                value={cityInput}
                maxLength={40}
                onChange={e => { setCityInput(e.target.value); setNameError(''); setCityAutoDetected(false) }}
                onKeyDown={e => e.key === 'Enter' && handleSubmitName()}
                disabled={cityDetecting}
              />
              {cityAutoDetected && !cityDetecting && (
                <span className="city-detected-badge">detected</span>
              )}
            </div>
            {nameError && <p className="name-entry-error">{nameError}</p>}
            <button className="start-btn" style={{ marginTop: '1rem', width: '100%' }} onClick={handleSubmitName}>
              SUBMIT
            </button>
            <button className="play-again-btn" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => setGameState('won')}>
              Skip
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'won') {
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
            <div className="win-stat"><span>{fmt(wonElapsed)}</span><label>Time</label></div>
            <div className="win-stat-divider" />
            <div className="win-stat"><span>{wonMoves}</span><label>Clicks</label></div>
          </div>
          <div className="discount-block">
            <p className="discount-label">Your Reward</p>
            <p className="discount-value">{cfg.discount}% OFF — Unlocked</p>
            <p className="discount-note">Discount applied automatically at checkout &middot; Single use &middot; Valid 48 hours</p>
          </div>
          <a className="shop-btn shop-btn-reward" href={cfg.shopUrl}>
            CLAIM {cfg.discount}% OFF — SHOP NOW
          </a>
          {highscores.length > 0 && <HighscoreBoard scores={highscores} fmt={fmt} />}
          <button className="play-again-btn" style={{ marginTop: '1rem' }} onClick={() => setGameState('intro')}>PLAY AGAIN</button>
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
          <div className="lost-progress-bar" style={{ width: `${(matchedPairs / activePairs) * 100}%` }} />
        </div>
        <p className="pairs-info">{matchedPairs} of {activePairs} pairs matched</p>
        <button className="start-btn" onClick={() => startGame(difficulty)}>TRY AGAIN</button>
        <button className="play-again-btn" onClick={() => setGameState('intro')}>BACK</button>
      </div>
    </div>
  )

  // ── PLAYING ────────────────────────────────────────────────
  const progress = matchedPairs / activePairs

  return (
    <div className="game-screen">
      <header className="game-header">
        <div className="brand-logo-sm">ANTARA</div>
        <div className="game-stats">
          <div className="level-badge">LVL {level}/2</div>
          <div className={`timer${timeLeft < 60 ? ' urgent' : ''}`}>{fmt(timeLeft)}</div>
          <div className="pairs-stat">{matchedPairs}/{activePairs}</div>
          <div className="moves-stat">{moves} moves</div>
          {streak >= 3 && <div className="streak">{streak}x</div>}
        </div>
      </header>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="cards-grid" style={{ '--cols': activeCols } as React.CSSProperties}>
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

// ── HIGHSCORE BOARD ────────────────────────────────────────
function HighscoreBoard({ scores, fmt }: { scores: HighscoreEntry[], fmt: (s: number) => string }) {
  return (
    <div className="highscore-board">
      <p className="highscore-title">TOP {scores.length}</p>
      <table className="highscore-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>City</th>
            <th>Time</th>
            <th>Clicks</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s, i) => (
            <tr key={i} className={i === 0 ? 'hs-first' : ''}>
              <td className="hs-rank">{i === 0 ? '✦' : i + 1}</td>
              <td className="hs-name">{s.name}</td>
              <td className="hs-city">{s.city}</td>
              <td className="hs-time">{fmt(s.time)}</td>
              <td className="hs-clicks">{s.clicks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
