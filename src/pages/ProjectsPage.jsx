import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Map, Sun, Moon, Settings, Check } from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Select } from '../components/ui/Select.jsx'
import { useAppData } from '../data/useAppData.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useSettings } from '../data/useSettings.jsx'
import { STATUS_LABEL, STATUS_VARIANT } from '../data/sampleData.js'
import { loadSubscription, SUB_KEY } from '../data/subscription.js'
import PdfCanvas from '../components/PdfCanvas.jsx'
import { resolveSheetPdfUrl, sheetHasPdf } from '../components/pdfCache.js'
import { SaveStatus } from '../components/SaveStatus.jsx'
import { AccountCard } from '../components/AccountCard.jsx'
import { ProjectsPageSkeleton } from '../components/Skeleton.jsx'
import TeamTab from './TeamTab.jsx'
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

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { projects: allProjects, sheets, addProject, pdfAssets } = useAppData()
  const { user: authUser, cloudEnabled, memberships, orgId, switchWorkspace, dataLoading, updateProfile } = useAuth()
  const { theme, setTheme, accent, setAccent } = useSettings()

  // --- Account profile (name / position) — stored on the Supabase auth user ---
  const [profileForm, setProfileForm] = useState({ full_name: '', position: '' })
  const [profileStatus, setProfileStatus] = useState('idle') // idle | saving | saved | error
  useEffect(() => {
    setProfileForm({
      full_name: authUser?.user_metadata?.full_name || '',
      position: authUser?.user_metadata?.position || '',
    })
  }, [authUser?.id])
  const saveProfile = async () => {
    setProfileStatus('saving')
    try {
      await updateProfile({ full_name: profileForm.full_name.trim(), position: profileForm.position.trim() })
      setProfileStatus('saved')
      setTimeout(() => setProfileStatus('idle'), 2000)
    } catch {
      setProfileStatus('error')
    }
  }
  const profileDirty =
    profileForm.full_name !== (authUser?.user_metadata?.full_name || '') ||
    profileForm.position !== (authUser?.user_metadata?.position || '')
  const [search, setSearch] = useState('')
  const [dlgOpen, setDlgOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [activeTab, setActiveTab] = useState('projects')

  // --- Self-contained subscription / cancellation state (no backend required) ---
  const [subscription, setSubscription] = useState(loadSubscription)
  const [cancelDlgOpen, setCancelDlgOpen] = useState(false)

  // Persist every change so a cancel survives a page reload.
  useEffect(() => {
    try { localStorage.setItem(SUB_KEY, JSON.stringify(subscription)) } catch { /* ignore */ }
  }, [subscription])

  // Graceful upgrade path: if a real Stripe Customer Portal URL is configured via
  // env, the cancel flow defers billing to it. Otherwise we fall back to the
  // email path already promised in the Terms/Pricing copy.
  const stripePortalUrl = import.meta.env.VITE_STRIPE_PORTAL_URL

  const confirmCancel = () => {
    const now = new Date().toISOString()
    const effective = subscription.nextBilling // keep access until period end
    setSubscription(prev => ({
      ...prev,
      status: 'cancelled',
      cancelledAt: now,
      cancelEffective: effective,
    }))
    setCancelDlgOpen(false)
    if (stripePortalUrl) {
      window.open(stripePortalUrl, '_blank', 'noopener')
    }
  }

  const reactivate = () => {
    setSubscription(prev => ({
      ...prev,
      status: 'active',
      cancelledAt: null,
      cancelEffective: null,
    }))
  }

  const isCancelled = subscription.status === 'cancelled'
  // Honest fallback notice whenever Stripe isn't wired and the plan is cancelled.
  const showEmailFallback = isCancelled && !stripePortalUrl

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

  if (dataLoading) return <ProjectsPageSkeleton />

  return (
    <div className={s.root} data-theme={theme}>
      <header className={s.top}>
        <div className={s.brand}>
          <img src="/plotline-mark.svg" alt="Plotline" className={s.logo} />
          <b className={s.wordmark}>Plotline<span className={s.dot}>.</span></b>
        </div>
        {cloudEnabled && authUser && memberships.length > 0 && (
          <div className={s.workspaceSwitch} style={{ width: 180 }}>
            <Select
              size="sm"
              value={orgId || ''}
              onChange={e => switchWorkspace(e.target.value || null)}
              options={[
                { value: '', label: 'Personal' },
                ...memberships.map(m => ({ value: m.org_id, label: m.name })),
              ]}
            />
          </div>
        )}
        <nav className={s.nav}>
          <button type="button" className={s.navLink} data-on={activeTab === 'projects' ? 'true' : undefined} onClick={() => setActiveTab('projects')} style={{ cursor: 'pointer', background: 'none', border: 'none', font: 'inherit' }}>Projects</button>
          <span className={s.navLink} data-soon="true" aria-disabled="true">
            Templates <Badge variant="neutral">Soon</Badge>
          </span>
          <span className={s.navLink} data-soon="true" aria-disabled="true">
            Pricebook <Badge variant="neutral">Soon</Badge>
          </span>
          <button type="button" className={s.navLink} data-on={activeTab === 'team' ? 'true' : undefined} onClick={() => setActiveTab('team')} style={{ cursor: 'pointer', background: 'none', border: 'none', font: 'inherit' }}>Team</button>
          <button type="button" aria-label="Settings" className={s.navLink} data-on={activeTab === 'settings' ? 'true' : undefined} onClick={() => setActiveTab('settings')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', font: 'inherit' }}><Settings size={13} /> <span className={s.navLabel}>Settings</span></button>
        </nav>
        <div className={s.topRight}>
          <div className={s.searchWrap} style={{ width: 240 }}>
            <Input
              placeholder="Search projects…"
              size="sm"
              aria-label="Search projects"
              value={search}
              onChange={e => setSearch(e.target.value)}
              leadingIcon={<Search size={14} />}
            />
          </div>
          <span className={s.saveStatusWrap}><SaveStatus /></span>
          <AccountCard onOpenSettings={() => setActiveTab('settings')} />
        </div>
      </header>

      <main className={s.main}>
        {activeTab === 'settings' ? (
          <div style={{ maxWidth: 520, paddingTop: 8 }}>
            <h1 className={s.title} style={{ marginBottom: 4 }}>Settings</h1>
            <p className={s.sub} style={{ marginBottom: 32 }}>Appearance preferences saved to this browser.</p>

            {authUser && (
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 16 }}>Account</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Input label="Name" placeholder="Your full name" value={profileForm.full_name}
                    onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                  <Input label="Position / title" placeholder="e.g. Estimator, Project Manager" value={profileForm.position}
                    onChange={e => setProfileForm(f => ({ ...f, position: e.target.value }))} />
                  <Input label="Email" value={authUser.email} disabled />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Button variant="primary" size="sm" onClick={saveProfile} disabled={!profileDirty || profileStatus === 'saving'}>
                      {profileStatus === 'saving' ? 'Saving…' : 'Save changes'}
                    </Button>
                    {profileStatus === 'saved' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--brand-600)', fontWeight: 600 }}>
                        <Check size={13} /> Saved
                      </span>
                    )}
                    {profileStatus === 'error' && (
                      <span style={{ fontSize: 12, color: 'var(--danger-600, #dc2626)' }}>Couldn't save — try again.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

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

            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24, marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 16 }}>Billing</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Badge variant={isCancelled ? 'neutral' : 'brand'}>{subscription.plan} plan</Badge>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {isCancelled
                    ? `Cancelled — access continues until ${fmtDate(subscription.cancelEffective)}`
                    : `Renews on ${fmtDate(subscription.nextBilling)}`}
                </span>
              </div>

              <div
                aria-live="polite"
                role="status"
                style={showEmailFallback ? { display: 'block', marginTop: 4, marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', background: 'var(--brand-50)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px' } : { display: 'none' }}
              >
                {isCancelled
                  ? `Subscription cancelled. Access continues until ${fmtDate(subscription.cancelEffective)}.`
                  : ''}
                {' '}No billing provider connected yet — your cancellation is recorded. Email{' '}
                <a href="mailto:sales@plotline.app">sales@plotline.app</a> to finalize, or use the in-app contact below.
              </div>

              <div style={{ marginTop: 14 }}>
                {isCancelled ? (
                  <Button variant="secondary" onClick={reactivate}>Reactivate</Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => setCancelDlgOpen(true)}
                    aria-label="Cancel subscription"
                  >
                    Cancel subscription
                  </Button>
                )}
              </div>

              <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
                Questions about billing? Email{' '}
                <a href="mailto:sales@plotline.app">sales@plotline.app</a>
              </div>
            </div>
          </div>
        ) : activeTab === 'team' ? (
          <TeamTab />
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
                  if (sheetHasPdf(firstSheet)) {
                    return <PdfCanvas url={resolveSheetPdfUrl(firstSheet, pdfAssets)} width={220} height={160} pageNumber={firstSheet.pdfPage || 1} />
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

      <Dialog
        open={cancelDlgOpen}
        onClose={() => setCancelDlgOpen(false)}
        title="Cancel subscription?"
        description={`Your ${subscription.plan} plan will stay active until ${fmtDate(subscription.nextBilling)}, then stop renewing. You can reactivate anytime.`}
        width={440}
        footer={<>
          <Button variant="ghost" onClick={() => setCancelDlgOpen(false)}>Keep subscription</Button>
          <Button variant="danger" onClick={confirmCancel}>
            Cancel my subscription
          </Button>
        </>}
      >
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          We'll keep your access through the end of the paid period. Need help or want to
          talk through options? Email{' '}
          <a href="mailto:sales@plotline.app">sales@plotline.app</a>.
        </p>
      </Dialog>
    </div>
  )
}
