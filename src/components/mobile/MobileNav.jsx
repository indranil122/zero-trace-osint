import { useCaseFile } from '../../store/casefile'

export function MobileTopBar({ onMenu, onInspector, onNew, inspectorBadge }) {
  const caseName = useCaseFile((s) => s.caseName)
  return (
    <header className="mobile-topbar">
      <button type="button" className="mobile-icon-btn" onClick={onMenu} aria-label="Open tools">
        <span className="mobile-hamburger"><i /><i /><i /></span>
      </button>
      <div className="mobile-brand">
        <div className="mobile-brand-mark">VT</div>
        <div className="mobile-brand-text">
          <strong>VeilTrace</strong>
          <span>{caseName ? caseName.slice(0, 22) : 'Private Workbench'}</span>
        </div>
      </div>
      <div className="mobile-top-actions">
        <button type="button" className="mobile-icon-btn subtle" onClick={onInspector} aria-label="Inspector">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20L16 16" /></svg>
          {inspectorBadge > 0 && <em className="mobile-badge">{inspectorBadge}</em>}
        </button>
        <button type="button" className="mobile-new-btn" onClick={onNew}>+ New</button>
      </div>
    </header>
  )
}

export function MobileDock({ activeDrawer, onDrawer, terminalOpen, onTerminal, caseCount }) {
  return (
    <nav className="mobile-dock" aria-label="Mobile workbench nav">
      <button type="button" className={activeDrawer === 'left' ? 'active' : ''} onClick={() => onDrawer('left')} aria-label="Tools">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9H21M9 21V9" /></svg>
        <span>Tools</span>
      </button>
      <button type="button" className={activeDrawer === 'none' ? 'active' : ''} onClick={() => onDrawer('none')} aria-label="Graph">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M12 2V5M12 19V22M2 12H5M19 12H22M4.9 4.9L7 7M17 17L19.1 19.1M19.1 4.9L17 7M7 17L4.9 19.1" /></svg>
        <span>Graph</span>
        {caseCount > 0 && <em className="dock-count">{caseCount}</em>}
      </button>
      <button type="button" className={activeDrawer === 'right' ? 'active' : ''} onClick={() => onDrawer('right')} aria-label="Details">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9H16M8 13H13" /></svg>
        <span>Details</span>
      </button>
      <button type="button" className={terminalOpen ? 'active' : ''} onClick={onTerminal} aria-label="Execution log">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 17L10 11L4 5" /><path d="M12 17H20" /></svg>
        <span>Log</span>
      </button>
    </nav>
  )
}

export function DrawerBackdrop({ open, onClose }) {
  if (!open) return null
  return <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
}
