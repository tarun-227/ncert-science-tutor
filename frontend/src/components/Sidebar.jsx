import Icon from './Icons'
import './Sidebar.css'

const SUBJECTS = [
  { id: 'science', name: 'Science', color: 'sci', icon: '⚛' },
]

export default function Sidebar({ mode, activeView, setView, onCollapse, onHoverExpand, onHoverCollapse }) {
  const isIcons = mode === 'icons'
  const isCollapsed = mode === 'collapsed'
  if (isCollapsed) return null

  return (
    <aside
      className={`sb ${isIcons ? 'sb-icons' : ''}`}
      onMouseEnter={onHoverExpand}
      onMouseLeave={onHoverCollapse}
    >
      <div className="sb-top">
        <div className="sb-logo">
          <span className="sb-logo-mark"><Icon name="leaf" size={18} /></span>
          {!isIcons && <span className="sb-logo-name">Master<span className="sb-dot">.</span>AI</span>}
        </div>
        <button className="sb-collapse" onClick={onCollapse} title={isIcons ? 'Expand' : 'Collapse'}>
          <Icon name="side-toggle" size={16} />
        </button>
      </div>

      {!isIcons && (
        <button className="sb-class">
          <div className="sb-class-av">A</div>
          <div className="sb-class-text">
            <div className="sb-class-t">Class Ten</div>
            <div className="sb-class-s">NCERT Solutions</div>
          </div>
          <Icon name="chev-down" size={14} />
        </button>
      )}

      <div className="sb-scroll scroll">
        {!isIcons && <div className="sb-label">Core subjects</div>}
        <div className="sb-list">
          {SUBJECTS.map(s => (
            <button
              key={s.id}
              className={`sb-item ${activeView === 'reader' ? 'on' : ''}`}
              onClick={() => setView('reader')}
              title={s.name}
            >
              <span className="sb-ic" data-color={s.color}>{s.icon}</span>
              {!isIcons && <span className="sb-name">{s.name}</span>}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
