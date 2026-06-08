import { useState } from 'react'
import Icon from './Icons'
import './SettingsPanel.css'

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
            <div className="set-row">
              <span className="set-lbl">Dark mode</span>
              <Toggle value={dark} onChange={setDark} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
