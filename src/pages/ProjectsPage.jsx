import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Map, Sun, Moon, Settings } from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Select } from '../components/ui/Select.jsx'
import { useAppData } from '../data/useAppData.jsx'
import { useSettings } from '../data/useSettings.jsx'
import { STATUS_LABEL, STATUS_VARIANT } from '../data/sampleData.js'
import PdfCanvas from '../components/PdfCanvas.jsx'
import { Tooltip } from '../components/ui/Tooltip.jsx'
import { SaveStatus } from '../components/SaveStatus.jsx'
import s from './ProjectsPage.module.css'

const ACCENTS = [
  { id: 'green',  label: 'Green',  color: '#258c62' },
  { id: 'blue',   label: 'Blue',   color: '#2563eb' },
  { id: 'violet', label: 'Violet', color: '#7c3aed' },
  { id: 'rose',   label: 'Rose',   color: '#e11d48' },
  { id: 'amber',  label: 'Amber',  color: '#d97706' },
]

const PREVIEW_POLY = {
  'proj-1': '30,70 150,55 175,120 45,135',
  'proj-2': '40,40 180,60 170,130 30,110',
  'proj-3': '50,50 160,45 185,120 60,135',
  'proj-4': null,
  'proj-5': '35,60 175,50 165,125 45,120',
}
const PREVIEW_LINE = {
  'proj-4': '30,120 80,60 130,100 185,50',
}
const PREVIEW_COLOR = {
  'proj-1': 'var(--takeoff-area)',
  'proj-2': 'var(--takeoff-volume)',
  'proj-3': 'var(--takeoff-linear)',
  'proj-4': 'var(--takeoff-count)',
  'proj-5': 'var(--takeoff-region)',
}

const EMPTY_FORM = { name: '', client: '', address: '', status: 'draft' }

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { projects: allProjects, sheets, addProject } = useAppData()
  const { theme, setTheme, accent, setAccent } = useSettings()
  const [search, setSearch] = useState('')
  const [dlgOpen, setDlgOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [activeTab, setActiveTab] = useState('projects')

  const projectList = Object.values(allProjects).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPipeline = Object.values(allProjects).reduce((s, p) => s + (p.status !== 'archived' ? (p.bidValue || 0) : 0), 0)
  const openBids = Object.values(allProjects).filter(p => p.status === 'bid_sent').length
  const wonCount = Object.values(allProjects).filter(p => p.status === 'won').length
  const totalSheets = Object.values(allProjects).reduce((s, p) => s + (p.sheetIds?.length || 0), 0)

  const openDlg = () => { setForm(EMPTY_FORM); setDlgOpen(true) }

  const createProject = () => {
    if (!form.name.trim()) return
    const id = `proj-${Date.now()}`
    addProject({
      id,
      name: form.name.trim(),
      client: form.client.trim(),
      address: form.address.trim(),
      status: form.status,
      bidValue: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      sheetIds: [],
    })
    setDlgOpen(false)
    navigate(`/app/project/${id}`)
  }

  return (
    <div className={s.root} data-theme={theme}>
      <header className={s.top}>
        <div className={s.brand}>
          <img src="/plotline-mark.svg" alt="Plotline" className={s.logo} />
          <b className={s.wordmark}>Plotline<span className={s.dot}>.</span></b>
        </div>
        <nav className={s.nav}>
          <a className={s.navLink} data-on={activeTab === 'projects' ? 'true' : undefined} onClick={() => setActiveTab('projects')} style={{ cursor: 'pointer' }}>Projects</a>
          <span className={s.navLink} data-soon="true" aria-disabled="true">
            Templates <Badge variant="neutral">Soon</Badge>
          </span>
          <span className={s.navLink} data-soon="true" aria-disabled="true">
            Pricebook <Badge variant="neutral">Soon</Badge>
          </span>
          <span className={s.navLink} data-soon="true" aria-disabled="true">
            Team <Badge variant="neutral">Soon</Badge>
          </span>
          <a className={s.navLink} data-on={activeTab === 'settings' ? 'true' : undefined} onClick={() => setActiveTab('settings')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Settings size={13} /> Settings</a>
        </nav>
        <div className={s.topRight}>
          <div style={{ width: 240 }}>
            <Input
              placeholder="Search projects…"
              size="sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
              leadingIcon={<Search size={14} />}
            />
          </div>
          <SaveStatus />
          <Tooltip label="Account" side="bottom">
            <Avatar name="Amy Reyes" status="online" />
          </Tooltip>
        </div>
      </header>

      <main className={s.main}>
        {activeTab === 'settings' ? (
          <div style={{ maxWidth: 520, paddingTop: 8 }}>
            <h1 className={s.title} style={{ marginBottom: 4 }}>Settings</h1>
            <p className={s.sub} style={{ marginBottom: 32 }}>Appearance preferences saved to this browser.</p>

            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 16 }}>Theme</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ id: 'light', Icon: Sun, label: 'Light' }, { id: 'dark', Icon: Moon, label: 'Dark' }].map(({ id, Icon, label }) => (
                  <button key={id} onClick={() => setTheme(id)}
                    style={{ flex: 1, padding: '14px 0', borderRadius: 10, border: `2px solid ${theme === id ? 'var(--brand-600)' : 'var(--border-default)'}`, background: theme === id ? 'var(--brand-50)' : 'var(--surface-paper)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: theme === id ? 'var(--brand-600)' : 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 16 }}>Accent color</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {ACCENTS.map(a => (
                  <button key={a.id} onClick={() => setAccent(a.id)} title={a.label}
                    style={{ width: 40, height: 40, borderRadius: '50%', background: a.color, border: `3px solid ${accent === a.id ? 'var(--text-strong)' : 'transparent'}`, cursor: 'pointer', outline: accent === a.id ? `2px solid ${a.color}` : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
        <>
        <div className={s.head}>
          <div>
            <h1 className={s.title}>Projects</h1>
            <p className={s.sub}>{Object.keys(allProjects).length} projects · {openBids} bids out</p>
          </div>
          <Button variant="secondary" iconLeft={<Map size={16} />} onClick={() => navigate('/app/project/proj-1/sheet/sheet-1')}>Try a sample takeoff</Button>
          <Button variant="primary" iconLeft={<Plus size={16} />} onClick={openDlg}>New project</Button>
        </div>

        <div className={s.stats}>
          <div className={s.stat}>
            <div className={s.statK}>Open bids</div>
            <div className={s.statV}>{openBids}</div>
          </div>
          <div className={s.stat}>
            <div className={s.statK}>Pipeline value</div>
            <div className={`${s.statV} ${s.statBrand}`}>${totalPipeline.toLocaleString()}</div>
          </div>
          <div className={s.stat}>
            <div className={s.statK}>Jobs won</div>
            <div className={s.statV}>{wonCount}</div>
          </div>
          <div className={s.stat}>
            <div className={s.statK}>Sheets measured</div>
            <div className={s.statV}>{totalSheets}</div>
          </div>
        </div>

        <div className={s.grid}>
          {projectList.length > 0 ? projectList.map(project => (
            <div
              key={project.id}
              className={s.card}
              onClick={() => navigate(`/app/project/${project.id}`)}
            >
              <div className={s.preview}>
                {(() => {
                  const firstSheetId = (project.sheetIds || [])[0]
                  const firstSheet = firstSheetId ? sheets[firstSheetId] : null
                  if (firstSheet?.pdfUrl) {
                    return <PdfCanvas url={firstSheet.pdfUrl} width={220} height={160} pageNumber={firstSheet.pdfPage || 1} />
                  }
                  return (
                    <svg viewBox="0 0 220 160" fill="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                      {PREVIEW_POLY[project.id] && (
                        <polygon points={PREVIEW_POLY[project.id]}
                          fill={PREVIEW_COLOR[project.id] || 'var(--takeoff-area)'} fillOpacity="0.16"
                          stroke={PREVIEW_COLOR[project.id] || 'var(--takeoff-area)'} strokeWidth="2.5" />
                      )}
                      {PREVIEW_LINE[project.id] && (
                        <polyline points={PREVIEW_LINE[project.id]}
                          fill="none" stroke={PREVIEW_COLOR[project.id] || 'var(--takeoff-linear)'}
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                      {!PREVIEW_POLY[project.id] && !PREVIEW_LINE[project.id] && (
                        <rect x="40" y="40" width="140" height="80" rx="6"
                          fill="var(--takeoff-area)" fillOpacity="0.1"
                          stroke="var(--takeoff-area)" strokeWidth="2" strokeDasharray="6 4" />
                      )}
                    </svg>
                  )
                })()}
                <span className={s.statusBadge}>
                  <Badge variant={STATUS_VARIANT[project.status] || 'neutral'} dot={project.status === 'bid_sent'}>
                    {STATUS_LABEL[project.status] || project.status}
                  </Badge>
                </span>
              </div>
              <div className={s.cardBody}>
                <div>
                  <h3 className={s.cardName}>{project.name}</h3>
                  <div className={s.cardClient}>{project.client || project.address || '—'}</div>
                </div>
                <div className={s.cardMeta}>
                  <span className={s.sheetCount}>
                    <Map size={13} />
                    {(project.sheetIds?.length || 0)} {(project.sheetIds?.length || 0) === 1 ? 'sheet' : 'sheets'}
                  </span>
                  {project.bidValue > 0 && <span className={s.bidVal}>${project.bidValue.toLocaleString()}</span>}
                </div>
              </div>
            </div>
          )) : (
            <div className={s.empty}>
              <div className={s.emptyTitle}>No projects match “{search}”</div>
              <div className={s.emptyHint}>Check the spelling, or start a new project.</div>
              <Button variant="ghost" size="sm" onClick={() => setSearch('')}>Clear search</Button>
            </div>
          )}
        </div>
        </>
        )}
      </main>

      <Dialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        title="New project"
        description="Create a new construction takeoff project."
        width={440}
        footer={<>
          <Button variant="ghost" onClick={() => setDlgOpen(false)}>Cancel</Button>
          <Button variant="primary" iconLeft={<Plus size={15} />} onClick={createProject}
            disabled={!form.name.trim()}>
            Create project
          </Button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 6 }}>
          <Input label="Project name" placeholder="Maple Grove Phase 2…" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="GC / Client" placeholder="Hilltop Developments…" value={form.client}
            onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
          <Input label="Address" placeholder="123 Main St, Fairview…" value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <Select label="Status" value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'bid_sent', label: 'Bid sent' },
              { value: 'won', label: 'Won' },
              { value: 'archived', label: 'Archived' },
            ]} />
        </div>
      </Dialog>
    </div>
  )
}
