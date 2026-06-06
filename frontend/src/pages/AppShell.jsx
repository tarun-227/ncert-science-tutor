import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Icon from '../components/Icons'
import SettingsPanel from '../components/SettingsPanel'
import Dashboard from './Dashboard'
import StudyView from './StudyView'
import './AppShell.css'

const Topbar = ({ view, setView, studyMode, setStudyMode, profile }) => {
  const name = profile?.name || 'Student'
  const initial = name.charAt(0).toUpperCase()
  const sub = `Class ${profile?.cls || 'X'} · ${profile?.board || 'CBSE'}`
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

      <div className="profile">
        <div className="avatar">{initial}</div>
        <div className="profile-text">
          <div className="profile-name">{name}</div>
          <div className="profile-sub">{sub}</div>
        </div>
      </div>
    </div>
  )
}

export default function AppShell() {
  const [view, setView] = useState('dashboard')
  const [studyMode, setStudyMode] = useState('tutor')
  const [sidebarMode, setSidebarMode] = useState(() => localStorage.getItem('ui-sidebar') || 'icons')
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ui-dark') === '1')
  const [density, setDensity] = useState(() => localStorage.getItem('ui-density') || 'cozy')
  const [chapterId, setChapterId] = useState(null)
  const [profile, setProfile] = useState(null)

  // Load profile from onboarding
  useEffect(() => {
    try {
      const raw = localStorage.getItem('onboarding-data')
      if (raw) setProfile(JSON.parse(raw))
    } catch {}
  }, [])

  // Apply + persist density/theme
  useEffect(() => {
    document.documentElement.dataset.density = density
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('ui-density', density)
    localStorage.setItem('ui-dark', darkMode ? '1' : '0')
  }, [density, darkMode])

  useEffect(() => { localStorage.setItem('ui-sidebar', sidebarMode) }, [sidebarMode])

  const effectiveMode = sidebarMode === 'icons' && sidebarHovered ? 'expanded' : sidebarMode

  const openChapter = (id) => { setChapterId(id); setView('reader') }

  return (
    <div className="app" data-sidebar={sidebarMode}>
      <Sidebar
        mode={effectiveMode}
        activeView={view}
        setView={setView}
        onCollapse={() => setSidebarMode(m => m === 'expanded' ? 'icons' : 'expanded')}
        onHoverExpand={() => setSidebarHovered(true)}
        onHoverCollapse={() => setSidebarHovered(false)}
      />
      <div className="main">
        <Topbar view={view} setView={setView} studyMode={studyMode} setStudyMode={setStudyMode} profile={profile} />
        <div className={`canvas scroll${view === 'reader' ? ' canvas-reader' : ''}`}>
          {view === 'dashboard' && <Dashboard onOpenChapter={openChapter} />}
          {view === 'reader' && <StudyView studyMode={studyMode} chapterId={chapterId} setChapterId={setChapterId} />}
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
