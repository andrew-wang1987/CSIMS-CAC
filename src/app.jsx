import { useState } from 'react'
import { findNearbySupport } from './api.ts'
import SupportMap from './SupportMap.jsx'
import './App.css'

const DEFAULT_LOCATION = { latitude: 25.778, longitude: -80.208 }

const questions = [
  {
    title: 'Who made this app?',
    summary:
      'This app was created by Andrew Wang and Ethan Lopez, seniors from Miami Palmetto Senior High School.',
    answer:
      'CSIMS was built as a student project to explore how technology can support timely, informed responses to mental health crises.',
    icon: 'people',
  },
  {
    title: 'How was this app made?',
    summary:
      'The frontend is built with React, and the backend uses Python and FastAPI. Machine-learning tools help power the recommendations.',
    answer:
      'The interface brings together a React frontend, a FastAPI backend, and machine-learning models built with PyTorch and FastAI.',
    icon: 'spark',
  },
  {
    title: 'What does CSIMS do?',
    summary:
      'CSIMS was created to support mental health crisis intervention with data-informed recommendations.',
    answer:
      'The goal is to make relevant information easier to understand so people can consider a helpful next step. It is not an emergency service or a substitute for professional care.',
    icon: 'chat',
  },
]

function NavIcon({ name }) {
  if (name === 'menu') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
  }
  if (name === 'home') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14.3 9l5.9.5-4.5 3.8 1.4 5.7-5.1-3.1-5.1 3.1 1.4-5.7-4.5-3.8 5.9-.5L12 3.5Z" /><circle cx="12" cy="12" r="9.5" /></svg>
  }
  if (name === 'simulator') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="m12 5.8 1.7 4.1 4.5.4-3.4 2.8 1 4.3-3.8-2.4-3.8 2.4 1-4.3-3.4-2.8 4.5-.4L12 5.8Z" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M12 8v8M8 12h8" /></svg>
}

function QuestionArtwork({ type }) {
  return (
    <div className="question-art" aria-hidden="true">
      <svg viewBox="0 0 112 112">
        {type === 'people' && (
          <>
            <path d="M56 18c-6 0-10 5-10 12s4 12 10 12 10-5 10-12-4-12-10-12Z" />
            <path d="M37 70c0-12 8-20 19-20s19 8 19 20v4H37v-4Z" />
            <path d="m23 69 4-3 4 3-1 5 5 2v5l-5 2 1 5-4 3-4-3-5 2-4-3 1-5-4-3 1-5 5-1 2-5 5 1Z" />
            <rect x="67" y="63" width="30" height="34" rx="7" />
          </>
        )}
        {type === 'spark' && (
          <>
            <path d="M56 18c3 0 5 2 7 6l8 17c2 5-1 10-6 10-3 0-6-2-9-2s-6 2-9 2c-5 0-8-5-6-10l8-17c2-4 4-6 7-6Z" />
            <path d="m23 69 4-3 4 3-1 5 5 2v5l-5 2 1 5-4 3-4-3-5 2-4-3 1-5-4-3 1-5 5-1 2-5 5 1Z" />
            <rect x="67" y="63" width="30" height="34" rx="7" />
          </>
        )}
        {type === 'chat' && (
          <>
            <rect x="27" y="24" width="61" height="45" rx="10" />
            <path d="m43 68-2 15 17-14M39 43h37M39 53h26" />
            <path d="m24 81 3-3 4 2v5l4 2-1 5-5 1-3 4-4-2-4 2-3-4-5-1v-5l4-2v-5l5-2 4 3Z" />
          </>
        )}
      </svg>
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState('home')
  const [expandedQuestion, setExpandedQuestion] = useState(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [places, setPlaces] = useState([])
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [locationError, setLocationError] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "I'm here to listen and help you think through a next step. What's going on for you right now?",
    },
  ])
  const [draft, setDraft] = useState('')
  const [chatPending, setChatPending] = useState(false)
  const [chatError, setChatError] = useState('')

  async function sendMessage(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || chatPending) return

    const nextMessages = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setDraft('')
    setChatError('')
    setChatPending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.slice(-12) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The assistant is unavailable right now.')
      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('The assistant returned an empty response. Please try again.')
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }])
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : 'Could not reach the assistant. Please try again.',
      )
    } finally {
      setChatPending(false)
    }
  }

  function requestNearbySupport() {
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser.')
      setLocationStatus('error')
      return
    }

    setLocationStatus('loading')
    setLocationError('')
    setPlaces([])
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const currentLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        }
        setLocation(currentLocation)
        try {
          const nearbyPlaces = await findNearbySupport(currentLocation)
          setPlaces(nearbyPlaces)
          setLocationStatus('loaded')
        } catch (error) {
          setLocationError(
            error instanceof Error && error.name === 'AbortError'
              ? 'The nearby search timed out. Please try again.'
              : error instanceof Error
                ? error.message
                : 'Nearby services could not be loaded. Please try again later.',
          )
          setLocationStatus('error')
        }
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was not granted. You can still call or text 988, or search manually.'
            : 'Your location could not be determined. Please try again or search manually.',
        )
        setLocationStatus('error')
      },
      { timeout: 15000, maximumAge: 60000 },
    )
  }

  const navigation = [
    { id: 'home', label: 'Home' },
    { id: 'simulator', label: 'Simulator' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className={`app-shell ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <button
          className="menu-toggle"
          type="button"
          aria-label={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
          aria-expanded={sidebarExpanded}
          onClick={() => setSidebarExpanded((expanded) => !expanded)}
        >
          <NavIcon name="menu" />
        </button>
        <nav className="nav-items">
          {navigation.map((item) => (
            <button
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              type="button"
              key={item.id}
              aria-current={activePage === item.id ? 'page' : undefined}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon"><NavIcon name={item.id} /></span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="page-content">
        {activePage === 'home' && (
          <div className="home-page">
            <section className="welcome-card" aria-labelledby="welcome-title">
              <div className="welcome-mark" aria-hidden="true">C</div>
              <div className="welcome-copy">
                <h1 id="welcome-title">Welcome to CSIMS!</h1>
                <p className="last-updated">Last updated: 9/30/2026</p>
                <p>
                  CSIMS is an app created to optimize mental health crisis intervention
                  developed for the Congressional App Challenge in the FL-27 district.
                  Utilizing a complex machine-learning algorithm created in Python, it
                  provides data-driven crisis response recommendations based on patterns
                  identified in historical data across the United States.
                </p>
              </div>
            </section>

            <section className="questions-section" aria-labelledby="questions-title">
              <h2 id="questions-title">Questions?</h2>
              <div className="question-list">
                {questions.map((question, index) => {
                  const expanded = expandedQuestion === index
                  return (
                    <article className={`question-card ${expanded ? 'expanded' : ''}`} key={question.title}>
                      <QuestionArtwork type={question.icon} />
                      <div className="question-content">
                        <h3>{question.title}</h3>
                        <p>{question.summary}</p>
                        {expanded && <p className="question-answer">{question.answer}</p>}
                        <div className="question-meta">
                          <span className="meta-plus" aria-hidden="true">+</span>
                          <span>Today · 23 min</span>
                        </div>
                      </div>
                      <button
                        className="question-toggle"
                        type="button"
                        aria-label={`${expanded ? 'Collapse' : 'Read'} ${question.title}`}
                        aria-expanded={expanded}
                        onClick={() => setExpandedQuestion(expanded ? null : index)}
                      >
                        <span aria-hidden="true">{expanded ? '⌄' : '▶'}</span>
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {activePage === 'simulator' && (
          <section className="simulator-page" aria-label="Crisis support simulator">
            <div className="simulator-map">
              <SupportMap
                location={location}
                places={places}
                showLocation={locationStatus !== 'idle'}
              />
              <span className="map-credit">Credit: OpenStreetMap</span>
            </div>
            <div className="simulator-tools">
              <div>
                <h1>Simulator</h1>
                <p>Explore the map and find nearby community and health services.</p>
              </div>
              <button
                className="location-button"
                type="button"
                onClick={requestNearbySupport}
                disabled={locationStatus === 'loading'}
              >
                {locationStatus === 'loading' ? 'Finding nearby services…' : 'Use my location'}
                {locationStatus !== 'loading' && <span aria-hidden="true">→</span>}
              </button>
            </div>
            {locationError && <p className="inline-error" role="alert">{locationError}</p>}
            {locationStatus === 'loaded' && places.length === 0 && (
              <p className="results-message">No services were found within 10 km. Try searching a wider area.</p>
            )}
            {places.length > 0 && (
              <ul className="place-list" aria-label="Nearby support services">
                {places.map((place) => (
                  <li key={place.id}>
                    <a
                      className="place-name"
                      href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {place.name} <span aria-hidden="true">↗</span>
                    </a>
                    <span className="place-meta">{place.type} · {place.distance.toFixed(1)} km</span>
                    {place.phone && <a className="place-contact" href={`tel:${place.phone}`}>{place.phone}</a>}
                    {place.website && <a className="place-contact" href={place.website} target="_blank" rel="noreferrer">Website ↗</a>}
                  </li>
                ))}
              </ul>
            )}
            <p className="map-data-note">
              Listings are community-mapped and may not reflect current availability. Your location is only shared with OpenStreetMap when you choose to search.
            </p>
          </section>
        )}

        {activePage === 'settings' && (
          <section className="settings-page" aria-labelledby="settings-title">
            <header className="settings-heading">
              <p className="eyebrow">CSIMS</p>
              <h1 id="settings-title">Settings &amp; support</h1>
              <p>Manage your support options and learn how your information is used.</p>
            </header>

            <section className="settings-card crisis-card" aria-labelledby="crisis-title">
              <div className="settings-card-copy">
                <span className="settings-symbol" aria-hidden="true">♡</span>
                <div>
                  <h2 id="crisis-title">Talk to a person</h2>
                  <p>Free, confidential crisis support in the U.S. and Canada.</p>
                </div>
              </div>
              <div className="crisis-actions">
                <a href="tel:988">Call or text 988</a>
                <a href="tel:911">Emergency: 911</a>
                <a href="https://988lifeline.org/" target="_blank" rel="noreferrer">U.S. 988 Lifeline ↗</a>
                <a href="https://988.ca/" target="_blank" rel="noreferrer">Canada 9-8-8 ↗</a>
              </div>
              <p className="settings-note">Outside the U.S. or Canada? Contact your local emergency number or crisis line.</p>
            </section>

            <section className="settings-card chat-card" aria-labelledby="chat-title">
              <div className="settings-card-copy">
                <span className="settings-symbol" aria-hidden="true">✳</span>
                <div>
                  <h2 id="chat-title">Talk it through</h2>
                  <p>A supportive AI assistant, here to listen.</p>
                </div>
              </div>
              <div className="chat-messages" aria-live="polite" aria-label="Conversation">
                {messages.map((message, index) => (
                  <div
                    className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                    key={`${message.role}-${index}`}
                  >
                    {message.role === 'assistant' && <span className="message-avatar" aria-hidden="true">C</span>}
                    <p>{message.content}</p>
                  </div>
                ))}
                {chatPending && (
                  <div className="message assistant-message" role="status">
                    <span className="message-avatar" aria-hidden="true">C</span>
                    <p className="typing">Thinking of a helpful next step…</p>
                  </div>
                )}
              </div>
              {chatError && <p className="inline-error" role="alert">{chatError}</p>}
              <form className="chat-form" onSubmit={sendMessage}>
                <label className="visually-hidden" htmlFor="message-input">Your message</label>
                <textarea
                  id="message-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type what’s on your mind…"
                  rows="2"
                  maxLength="4000"
                  disabled={chatPending}
                />
                <button type="submit" disabled={chatPending || !draft.trim()} aria-label="Send message">
                  <span aria-hidden="true">↑</span>
                </button>
              </form>
              <p className="privacy-note">Messages are sent to the configured AI provider and aren&apos;t saved by this app. Avoid sharing identifying details.</p>
              <p className="disclaimer">This AI is not a clinician or emergency service. If you may hurt yourself or someone else, call emergency services or 988 now.</p>
            </section>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
