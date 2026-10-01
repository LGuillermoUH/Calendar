import { useAuth } from '../context/AuthContext'

export default function Header({ onLoginClick }) {
  const { isAdmin, logout } = useAuth()

  return (
    <header className="app-header">
      <h1 className="app-title">Salón de Eventos</h1>
      {isAdmin ? (
        <button className="btn" onClick={logout} aria-label="Cerrar sesión">
          Cerrar sesión
        </button>
      ) : (
        <button className="btn" onClick={onLoginClick} aria-label="Iniciar sesión">
          Iniciar sesión
        </button>
      )}
    </header>
  )
}
