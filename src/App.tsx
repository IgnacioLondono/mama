import { useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AppDataProvider, useAppData } from './context/AppDataContext'
import { ThemeProvider } from './context/ThemeContext'
import { Home } from './pages/Home'
import { Materiales } from './pages/Materiales'
import { PatronDetalle } from './pages/PatronDetalle'
import { Patrones } from './pages/Patrones'
import { ProyectoDetalle } from './pages/ProyectoDetalle'
import { Proyectos } from './pages/Proyectos'
import './styles/global.css'

function Gate({ children }: { children: ReactNode }) {
  const { ready, error, needsLogin, login } = useAppData()
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  if (!ready) {
    return (
      <div className="empty" style={{ paddingTop: '30vh' }}>
        Abriendo tu cuaderno…
      </div>
    )
  }

  if (needsLogin) {
    async function onSubmit(e: FormEvent) {
      e.preventDefault()
      setLoginError('')
      try {
        await login(password)
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : 'Clave incorrecta.')
      }
    }

    return (
      <div className="empty" style={{ maxWidth: 360, margin: '20vh auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Tejidos de Mamá</h1>
        <p>Escribe la clave para entrar.</p>
        <form onSubmit={(e) => void onSubmit(e)}>
          <div className="field">
            <label htmlFor="clave">Clave</label>
            <input
              id="clave"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {loginError ? (
            <p style={{ color: 'var(--color-danger)' }}>{loginError}</p>
          ) : null}
          <button type="submit" className="btn btn-primary">
            Entrar
          </button>
        </form>
      </div>
    )
  }

  if (error) {
    return (
      <div className="empty" style={{ paddingTop: '25vh' }}>
        <p>{error}</p>
        <p>En local: <code>npm run dev</code></p>
      </div>
    )
  }

  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <BrowserRouter>
          <Gate>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="patrones" element={<Patrones />} />
                <Route path="patrones/:id" element={<PatronDetalle />} />
                <Route path="proyectos" element={<Proyectos />} />
                <Route path="proyectos/:id" element={<ProyectoDetalle />} />
                <Route path="materiales" element={<Materiales />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Gate>
        </BrowserRouter>
      </AppDataProvider>
    </ThemeProvider>
  )
}
