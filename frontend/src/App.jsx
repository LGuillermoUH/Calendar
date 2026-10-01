import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/Header'
import Calendar from './components/Calendar'
import RentalsList from './components/RentalsList'
import './styles/app.css'

function AppContent() {
  const { isAdmin } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [screen, setScreen] = useState('calendar') // 'calendar' | 'rentals'

  return (
    <div className="app">
      <Header onLoginClick={() => setLoginOpen(true)} />

      {isAdmin && (
        <nav className="app-tabs" role="tablist" aria-label="Vistas de administrador">
          <button
            role="tab"
            aria-selected={screen === 'calendar'}
            className={`btn btn--ghost${screen === 'calendar' ? ' is-active' : ''}`}
            onClick={() => setScreen('calendar')}
          >Calendario</button>
          <button
            role="tab"
            aria-selected={screen === 'rentals'}
            className={`btn btn--ghost${screen === 'rentals' ? ' is-active' : ''}`}
            onClick={() => setScreen('rentals')}
          >Rentas</button>
        </nav>
      )}

      <main className="app-main">
        {screen === 'rentals' && isAdmin ? (
          <RentalsList />
        ) : (
          <Calendar loginOpen={loginOpen} onCloseLogin={() => setLoginOpen(false)} />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
