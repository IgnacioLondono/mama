import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  IconBook,
  IconDesk,
  IconMoon,
  IconNeedles,
  IconSun,
  IconYarn,
} from './Icons'
import { useTheme } from '../context/ThemeContext'
import styles from './Layout.module.css'

const links = [
  { to: '/', label: 'Mesa', end: true, Icon: IconDesk },
  { to: '/proyectos', label: 'Tejiendo', Icon: IconNeedles },
  { to: '/patrones', label: 'Patrones', Icon: IconBook },
  { to: '/materiales', label: 'Inventario', Icon: IconYarn },
]

export function Layout() {
  const { pathname } = useLocation()
  const { theme, toggleTheme } = useTheme()
  const workMode = /^\/proyectos\/[^/]+/.test(pathname)

  return (
    <div className={`app-shell ${workMode ? styles.shellWork : ''}`}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <NavLink to="/" className={styles.brand}>
            <span className={styles.brandMark}>TM</span>
            <span className={styles.brandText}>Tejidos de Mamá</span>
          </NavLink>
          <div className={styles.right}>
            <button
              type="button"
              className={styles.themeBtn}
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
              }
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
              <span className={styles.themeLabel}>
                {theme === 'dark' ? 'Claro' : 'Oscuro'}
              </span>
            </button>
            <nav className={styles.navDesktop} aria-label="Principal">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    isActive ? `${styles.link} ${styles.active}` : styles.link
                  }
                >
                  <l.Icon width={16} height={16} />
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className={workMode ? styles.mainWork : 'main'}>
        <Outlet />
      </main>

      {!workMode ? (
        <nav className={styles.navMobile} aria-label="Móvil">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
              }
            >
              <l.Icon width={18} height={18} />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
