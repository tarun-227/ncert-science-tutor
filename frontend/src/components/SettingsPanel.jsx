import { useState } from 'react'
import Icon from './Icons'
import './SettingsPanel.css'

function Seg({ value, options, onChange }) {
  return (
    <div className="set-seg">
      {options.map(o => (
        <button key={o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>
          {o.charAt(0).toUpperCase() + o.slice(1)}
        </button>
      ))}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button className="set-toggle" data-on={value ? 1 : 0} onClick={() => onChange(!value)}>
      <i />
    </button>
  )
}

export default function SettingsPanel({ density, setDensity, sidebar, setSidebar, dark, setDark }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="set-fab" onClick={() => setOpen(o => !o)} title="Settings">
        <Icon name="settings" size={18} />
      </button>

      {open && (
        <div className="set-panel">
          <div className="set-hd">
            <b>Settings</b>
            <button className="set-x" onClick={() => setOpen(false)}><Icon name="x" size={14} /></button>
          </div>
          <div className="set-body">
            <div className="set-sect">Layout</div>

            <div className="set-row">
              <span className="set-lbl">Density</span>
              <Seg value={density} options={['cozy', 'compact']} onChange={setDensity} />
            </div>

            <div className="set-row">
              <span className="set-lbl">Sidebar</span>
              <Seg value={sidebar} options={['expanded', 'icons', 'collapsed']} onChange={setSidebar} />
            </div>

            <div className="set-row set-row-h">
              <span className="set-lbl">Dark mode</span>
              <Toggle value={dark} onChange={setDark} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
