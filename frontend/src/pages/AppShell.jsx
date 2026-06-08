import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Icon from '../components/Icons'
import SettingsPanel from '../components/SettingsPanel'
import Dashboard from './Dashboard'
import StudyView from './StudyView'
import ProfilePage from './ProfilePage'
import { fetchUserProfile, saveUserProfile, migrateLocalDataToSupabase } from '../lib/userdata'
import { migrateOldSectionCompletion } from '../lib/studyPlanStore'
import { useAuth } from '../contexts/AuthContext'
import './AppShell.css'

const Topbar = ({ view, setView, studyMode, setStudyMode, profile, onOpenProfile, onLogout }) => {
  const name = profile?.name || 'Student'
  const initial = name.charAt(0).toUpperCase()
  const sub = `Class ${profile?.cls || 'X'} · ${profile?.board || 'CBSE'}`

  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="topbar">
      <div className="tabs">
        <button className={view === 'dashboard' ? 'on' : ''} onClick={() => setView('dashboard')}>
          <Icon name="calendar" size={13} /> Planner
        </button>
        <button className={view === 'reader' ? 'on' : ''} onClick={() => setView('reader')}>
          <Icon name="quiz" size={13} /> Study
        </button>
      </div>

      <div className={`study-mode-switch${view === 'reader' ? '' : ' study-mode-hidden'}`}>
        <button className={studyMode === 'tutor' ? 'on' : ''} onClick={() => setStudyMode('tutor')}>
          <Icon name="sparkles" size={13} /> Tutor
        </button>
        <button className={studyMode === 'book' ? 'on' : ''} onClick={() => setStudyMode('book')}>
          <Icon name="note" size={13} /> Book
        </button>
      </div>

      <div className="tb-spacer" />

      <div className="profile profile-trigger" ref={ref}>
        <button
          className="profile-btn"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <div className="avatar">{initial}</div>
          <div className="profile-text">
            <div className="profile-name">{name}</div>
            <div className="profile-sub">{sub}</div>
          </div>
          <Icon name="chevron" size={12} style={{ color: 'var(--ink-4)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }} />
        </button>

        {open && (
          <div className="profile-dropdown" role="menu">
            <div className="profile-dropdown-head">
              <div className="pd-avatar">{initial}</div>
              <div>
                <div className="pd-name">{name}</div>
                <div className="pd-meta">{sub}</div>
              </div>
            </div>
            <div className="profile-dropdown-divider" />
            <button className="profile-dropdown-item" role="menuitem" onClick={() => { onOpenProfile(); setOpen(false) }}>
              <Icon name="person" size={14} /> Profile
            </button>
            <button className="profile-dropdown-item danger" role="menuitem" onClick={() => { setOpen(false); onLogout() }}>
              <Icon name="logout" size={14} /> Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState('dashboard')
  const [studyMode, setStudyMode] = useState('tutor')
  const [sidebarMode, setSidebarMode] = useState(() => localStorage.getItem('ui-sidebar') || 'icons')
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ui-dark') === '1')
  const [density, setDensity] = useState(() => localStorage.getItem('ui-density') || 'cozy')
  const [chapterId, setChapterId] = useState(null)
  const [activeSubject, setActiveSubject] = useState('science')
  const [profile, setProfile] = useState(null)

  // Migrate all old localStorage data to Supabase (runs once per session)
  useEffect(() => {
    migrateOldSectionCompletion()
    migrateLocalDataToSupabase()
  }, [])

  // Load profile for the CURRENT account. Re-runs whenever the signed-in user
  // changes so switching Google accounts never shows the previous user's name.
  useEffect(() => {
    if (!user) return
    try {
      const raw = localStorage.getItem('onboarding-data')
      if (raw) setProfile(JSON.parse(raw)) // instant placeholder; reconciled below
    } catch {}
    fetchUserProfile().then(p => {
      if (p) {
        setProfile(p)
        localStorage.setItem('onboarding-data', JSON.stringify(p))
      } else {
        // New account with no saved profile yet — derive the name from the
        // Google identity instead of leaving the previous account's name up.
        const meta = user.user_metadata || {}
        const fresh = { name: meta.full_name || meta.name || 'Student', cls: 'X', board: 'CBSE' }
        setProfile(fresh)
        localStorage.setItem('onboarding-data', JSON.stringify(fresh))
      }
    })
  }, [user?.id])

  // Apply + persist density/theme
  useEffect(() => {
    document.documentElement.dataset.density = density
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('ui-density', density)
    localStorage.setItem('ui-dark', darkMode ? '1' : '0')
  }, [density, darkMode])

  useEffect(() => { localStorage.setItem('ui-sidebar', sidebarMode) }, [sidebarMode])

  const effectiveMode = sidebarMode === 'icons' && sidebarHovered ? 'expanded' : sidebarMode

  const openChapter = (id, subject) => {
    setChapterId(id)
    setView('reader')
    if (subject) setActiveSubject(subject)
  }

  // Persist profile edits → Supabase user_profiles + localStorage, update UI
  const handleSaveProfile = async (next) => {
    setProfile(next)
    localStorage.setItem('onboarding-data', JSON.stringify(next))
    await saveUserProfile(next)
  }

  // Log out of Supabase and return to the onboarding / sign-in screen.
  // Clear the cached profile so the next account doesn't inherit this name.
  const handleLogout = async () => {
    try { await signOut() } catch {}
    localStorage.removeItem('onboarding-data')
    localStorage.removeItem('onboarding-done')
    setProfile(null)
    navigate('/onboarding')
  }

  return (
    <div className="app" data-sidebar={sidebarMode}>
      <Sidebar
        mode={effectiveMode}
        activeView={view}
        activeSubject={activeSubject}
        setView={setView}
        onOpenChapter={openChapter}
        onCollapse={() => setSidebarMode(m => m === 'expanded' ? 'icons' : 'expanded')}
        onHoverExpand={() => setSidebarHovered(true)}
        onHoverCollapse={() => setSidebarHovered(false)}
      />
      <div className="main">
        <Topbar
          view={view} setView={setView}
          studyMode={studyMode} setStudyMode={setStudyMode}
          profile={profile}
          onOpenProfile={() => setView('profile')}
          onLogout={handleLogout}
        />
        <div className={`canvas scroll${view === 'reader' ? ' canvas-reader' : ''}`}>
          {view === 'dashboard' && <Dashboard onOpenChapter={openChapter} />}
          {view === 'reader' && <StudyView studyMode={studyMode} chapterId={chapterId} setChapterId={setChapterId} />}
          {view === 'profile' && <ProfilePage profile={profile} onSaveProfile={handleSaveProfile} />}
        </div>
      </div>

      <SettingsPanel
        density={density} setDensity={setDensity}
        sidebar={sidebarMode} setSidebar={setSidebarMode}
        dark={darkMode} setDark={setDarkMode}
      />
    </div>
  )
}
