import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth-context'
import { Spinner } from './ui'

const MENU: { to: string; label: string; icon: string; adminOnly?: boolean; sub?: { to: string; label: string }[] }[] = [
  { to: '/', label: 'Dashboard', icon: '⌂' },
  {
    to: '/posts',
    label: 'Posts',
    icon: '✎',
    sub: [
      { to: '/posts', label: 'All Posts' },
      { to: '/categories', label: 'Categories' },
    ],
  },
  { to: '/queue', label: 'Ingest Queue', icon: '⇣' },
  { to: '/feeds', label: 'Feeds', icon: '◉' },
  { to: '/sites', label: 'Sites', icon: '▦', adminOnly: true },
  { to: '/users', label: 'Users', icon: '☺', adminOnly: true },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  if (loading) {
    return (
      <div className="login">
        <Spinner />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  const inSection = (item: (typeof MENU)[number]) =>
    item.sub ? item.sub.some((s) => location.pathname.startsWith(s.to)) : item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)

  return (
    <>
      <div className="adminbar">
        <div className="brand">
          <button className="menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu">
            ☰
          </button>
          <span>📰 News Hoster</span>
          <NavLink to="/posts" className="hide-mobile">
            + Posts
          </NavLink>
        </div>
        <div className="right">
          <span className="hide-mobile">
            Howdy, <strong>{user.name}</strong> <span className="muted">({user.role})</span>
          </span>
          <button onClick={logout}>Log Out</button>
        </div>
      </div>
      <nav className={`adminmenu ${menuOpen ? 'open' : ''}`} aria-label="Main menu" onClick={() => setMenuOpen(false)}>
        {MENU.filter((m) => !m.adminOnly || user.role === 'admin').map((item) => (
          <div key={item.to + item.label}>
            <NavLink to={item.to} end={item.to === '/'} className={() => (inSection(item) ? 'active' : '')}>
              <span className="icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
            {item.sub &&
              inSection(item) &&
              item.sub.map((s) => (
                <NavLink key={s.to + s.label} to={s.to} end className={({ isActive }) => `sub ${isActive ? 'active' : ''}`}>
                  {s.label}
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
      <main className="wpcontent">
        <Outlet />
      </main>
    </>
  )
}
