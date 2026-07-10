import React, { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight, Upload, FileText, Folder, FolderPlus, FolderOpen, X, LayoutDashboard, CheckSquare, Square, MoveRight, Printer } from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Tabs } from '../components/ui/Tabs.jsx'
import SheetUploadWizard from '../components/SheetUploadWizard.jsx'
import PdfCanvas from '../components/PdfCanvas.jsx'
import BidProposal from './BidProposal.jsx'
import { useAppData } from '../data/useAppData.jsx'
import { STATUS_LABEL, STATUS_VARIANT, CATS, CAT_COLOR, SHEET_W, SHEET_H } from '../data/sampleData.js'
import s from './ProjectPage.module.css'

function SheetPreview({ sheet }) {
  const scale = 0.22
  const w = SHEET_W * scale, h = SHEET_H * scale
  if (sheet.pdfUrl) {
    return (
      <div className={s.sheetPreview} style={{ width: w, height: h, position: 'relative', overflow: 'hidden', borderRadius: 4, background: '#f5f5f3' }}>
        <PdfCanvas url={sheet.pdfUrl} width={w} height={h} pageNumber={sheet.pdfPage || 1} />
      </div>
    )
  }
  return (
    <div className={s.sheetPreview} style={{ width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} fill="none">
        {(sheet.areas || []).map(a => (
          <polygon key={a.id} points={a.poly.map(p => `${p.x},${p.y}`).join(' ')}
            fill={CAT_COLOR[a.type]} fillOpacity="0.2" stroke={CAT_COLOR[a.type]} strokeWidth="2" />
        ))}
        {(sheet.lines || []).map(l => (
          <polyline key={l.id} points={l.pts.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke={CAT_COLOR[l.type]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {(sheet.points || []).map(p => (
          <circle key={p.id} cx={p.x} cy={p.y} r="5" fill="white" stroke={CAT_COLOR[p.type]} strokeWidth="2" />
        ))}
      </svg>
    </div>
  )
}

function countByKind(sheet) {
  return {
    areas:  (sheet.areas  || []).length,
    lines:  (sheet.lines  || []).length,
    points: (sheet.points || []).length,
  }
}

const EMPTY_FORM = { name: '', code: '' }

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, sheets, addSheet, addSheets, addSheetSet, renameSheetSet, deleteSheetSet, moveSheetToSet } = useAppData()
  const [dlgOpen, setDlgOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pdfFile, setPdfFile] = useState(null)
  const pdfInputRef = useRef(null)
  const [folderDlg, setFolderDlg] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [expandedSets, setExpandedSets] = useState({})
  const [moveSheetDlg, setMoveSheetDlg] = useState(null)
  const [activeTab, setActiveTab] = useState('sheets')
  const [draggingSheetId, setDraggingSheetId] = useState(null)
  const [dragOverTarget, setDragOverTarget] = useState(null) // setId or 'unassigned'
  const [selectedSheetIds, setSelectedSheetIds] = useState(new Set())
  const [exportOpen, setExportOpen] = useState(false)

  const project = projects[projectId]

  if (!project) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Project not found.</div>

  const sheetList = (project.sheetIds || []).map(id => sheets[id]).filter(Boolean)

  // Sheets not assigned to any folder
  const assignedIds = new Set((project.sheetSets || []).flatMap(s => s.sheetIds || []))
  const unassignedSheets = sheetList.filter(sh => !assignedIds.has(sh.id))

  // Folder/region grouping for the bid proposal.
  const folderGroups = (project.sheetSets || []).map(set => ({
    name: set.name,
    sheets: (set.sheetIds || []).map(id => sheets[id]).filter(Boolean),
  })).filter(g => g.sheets.length > 0)

  const onDragStart = (e, sheetId) => {
    setDraggingSheetId(sheetId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('sheetId', sheetId)
  }
  const onDragEnd = () => { setDraggingSheetId(null); setDragOverTarget(null) }

  const onFolderDragOver = (e, targetId) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    setDragOverTarget(targetId)
  }
  const onFolderDrop = (e, targetId) => {
    e.preventDefault()
    const sheetId = e.dataTransfer.getData('sheetId')
    if (!sheetId) return
    // null → removes from all sets (unassigned); setId → moves to that folder
    moveSheetToSet(projectId, sheetId, targetId === 'unassigned' ? null : targetId)
    setDraggingSheetId(null); setDragOverTarget(null)
  }

  const openDlg = () => setWizardOpen(true)

  const handleWizardImport = (sheetArray) => {
    addSheets(projectId, sheetArray)
  }

  const handlePdfSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfFile(file)
    if (!form.name.trim()) setForm(f => ({ ...f, name: file.name.replace(/\.pdf$/i, '') }))
  }

  const createSheet = () => {
    if (!form.name.trim()) return
    const id = `sheet-${Date.now()}`
    if (pdfFile) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        addSheet(projectId, {
          id, projectId,
          name: form.name.trim(),
          code: form.code.trim() || `S-${(project.sheetIds?.length || 0) + 1}`,
          pxPerFt: null,
          pdfUrl: ev.target.result,
          areas: [], lines: [], points: [],
        })
        navigate(`/app/project/${projectId}/sheet/${id}`)
      }
      reader.readAsDataURL(pdfFile)
    } else {
      addSheet(projectId, {
        id, projectId,
        name: form.name.trim(),
        code: form.code.trim() || `S-${(project.sheetIds?.length || 0) + 1}`,
        pxPerFt: null,
        pdfUrl: null,
        areas: [], lines: [], points: [],
      })
      navigate(`/app/project/${projectId}/sheet/${id}`)
    }
    setDlgOpen(false)
  }

  return (
    <div className={s.root}>
      <header className={s.top}>
        <div className={s.brand}>
          <img src="/plotline-mark.svg" alt="Plotline" className={s.logo} />
          <b className={s.wordmark}>Plotline<span className={s.dot}>.</span></b>
        </div>
        <div className={s.breadcrumb}>
          <span className={s.crumbLink} onClick={() => navigate('/app')}>Projects</span>
          <ChevronRight size={14} className={s.crumbSep} />
          <span className={s.crumbCurrent}>{project.name}</span>
        </div>
        <div className={s.topRight}>
          <Badge variant={STATUS_VARIANT[project.status] || 'neutral'} dot={project.status === 'bid_sent'}>
            {STATUS_LABEL[project.status] || project.status}
          </Badge>
          <Avatar name="Amy Reyes" status="online" />
        </div>
      </header>

      <main className={s.main}>
        <div className={s.head}>
          <button className={s.backBtn} onClick={() => navigate('/app')}>
            <ArrowLeft size={14} />
            All projects
          </button>
          <div className={s.headInfo}>
            <h1 className={s.title}>{project.name}</h1>
            <p className={s.client}>{project.client}{project.address ? ` · ${project.address}` : ''}</p>
          </div>
          <div className={s.headRight}>
            {project.bidValue > 0 && (
              <div className={s.bidValue}>
                <span className={s.bidLabel}>Bid value</span>
                <span className={s.bidNum}>${project.bidValue.toLocaleString()}</span>
              </div>
            )}
            <Button variant="secondary" iconLeft={<Printer size={16} />} size="sm" onClick={() => setExportOpen(true)}>Export bid</Button>
            <Button variant="primary" iconLeft={<Plus size={16} />} size="sm" onClick={openDlg}>Add sheet</Button>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Tabs variant="pill" value={activeTab} onChange={setActiveTab}
            items={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'sheets', label: `Sheets (${sheetList.length})` }]} />
        </div>

        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sheets</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color: 'var(--text-strong)' }}>{sheetList.length}</div>
            </div>
            <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total areas</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color: 'var(--text-strong)' }}>{sheetList.reduce((s, sh) => s + (sh.areas || []).length, 0)}</div>
            </div>
            <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total items</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color: 'var(--text-strong)' }}>{sheetList.reduce((s, sh) => s + (sh.points || []).length, 0)}</div>
            </div>
            {project.bidValue > 0 && (
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bid value</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--brand-600)' }}>${project.bidValue.toLocaleString()}</div>
              </div>
            )}
            <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Folders</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color: 'var(--text-strong)' }}>{(project.sheetSets || []).length}</div>
            </div>
          </div>
        )}

        {activeTab === 'sheets' && <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className={s.sectionLabel} style={{ margin: 0 }}>Sheets · {sheetList.length}</div>
          <Button variant="ghost" size="sm" iconLeft={<FolderPlus size={14} />} onClick={() => { setFolderName(''); setFolderDlg(true) }}>Add folder</Button>
        </div>}
        {activeTab === 'sheets' && <>
        {/* Sheet Sets / Folders */}
        {/* Folders */}
        {selectedSheetIds.size > 0 && (
          <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-md)', background: 'var(--brand-600)', color: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{selectedSheetIds.size} sheet{selectedSheetIds.size !== 1 ? 's' : ''} selected</span>
            <span style={{ fontSize: 12, opacity: 0.8, marginRight: 4 }}>Move to:</span>
            {(project.sheetSets || []).map(set => (
              <button key={set.id}
                onClick={() => {
                  selectedSheetIds.forEach(id => moveSheetToSet(projectId, id, set.id))
                  setSelectedSheetIds(new Set())
                }}
                style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {set.name}
              </button>
            ))}
            <button
              onClick={() => {
                selectedSheetIds.forEach(id => moveSheetToSet(projectId, id, null))
                setSelectedSheetIds(new Set())
              }}
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              Unassigned
            </button>
            <button onClick={() => setSelectedSheetIds(new Set())}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 2, opacity: 0.7, display: 'flex', alignItems: 'center' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {(project.sheetSets || []).map(set => {
          const setSheets = (set.sheetIds || []).map(id => sheets[id]).filter(Boolean)
          const expanded = expandedSets[set.id] !== false
          const isOver = dragOverTarget === set.id
          const allSelected = setSheets.length > 0 && setSheets.every(sh => selectedSheetIds.has(sh.id))
          const toggleSelectAll = (e) => {
            e.stopPropagation()
            setSelectedSheetIds(prev => {
              const next = new Set(prev)
              if (allSelected) setSheets.forEach(sh => next.delete(sh.id))
              else setSheets.forEach(sh => next.add(sh.id))
              return next
            })
          }
          return (
            <div key={set.id} style={{ marginBottom: 16 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: expanded ? 8 : 0, transition: 'background 0.12s', background: isOver ? 'var(--brand-100, #d1fae5)' : 'var(--surface-sunken)', outline: isOver ? '2px dashed var(--brand-600)' : '2px solid transparent', outlineOffset: -2 }}
                onClick={() => setExpandedSets(p => ({ ...p, [set.id]: !expanded }))}
                onDragOver={e => onFolderDragOver(e, set.id)}
                onDragLeave={() => setDragOverTarget(null)}
                onDrop={e => onFolderDrop(e, set.id)}
              >
                {expanded ? <FolderOpen size={16} style={{ color: 'var(--brand-600)' }} /> : <Folder size={16} style={{ color: 'var(--brand-600)' }} />}
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--text-strong)' }}>{set.name}</span>
                {isOver && <span style={{ fontSize: 11, color: 'var(--brand-600)', fontWeight: 600 }}>Drop to add</span>}
                {!isOver && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{setSheets.length} sheet{setSheets.length !== 1 ? 's' : ''}</span>}
                {setSheets.length > 0 && (
                  <button onClick={toggleSelectAll}
                    title={allSelected ? 'Deselect all' : 'Select all'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: allSelected ? 'var(--brand-600)' : 'var(--text-subtle)', padding: 2, display: 'flex', alignItems: 'center' }}>
                    {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); deleteSheetSet(projectId, set.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>
              {expanded && setSheets.length > 0 && (
                <div className={s.grid} style={{ marginLeft: 24 }}>
                  {setSheets.map(sheet => {
                    const isSel = selectedSheetIds.has(sheet.id)
                    return (
                      <div key={sheet.id} className={s.sheetCard}
                        draggable
                        onDragStart={e => onDragStart(e, sheet.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => navigate(`/app/project/${projectId}/sheet/${sheet.id}`)}
                        style={{ opacity: draggingSheetId === sheet.id ? 0.4 : 1, cursor: 'grab', outline: isSel ? '2px solid var(--brand-600)' : undefined, outlineOffset: -2 }}>
                        <div className={s.sheetThumb}><SheetPreview sheet={sheet} /><div className={s.sheetCodeBadge}>{sheet.code}</div></div>
                        <div className={s.sheetInfo}>
                          <div className={s.sheetName}>{sheet.name}</div>
                          <div className={s.sheetCode}>{sheet.code}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned sheets */}
        {sheetList.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: 16 }}>No sheets yet.</p>
            <Button variant="primary" iconLeft={<Plus size={15} />} onClick={openDlg}>Add first sheet</Button>
          </div>
        ) : unassignedSheets.length > 0 && (
          <>
            {(project.sheetSets || []).length > 0 && (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 'var(--radius-md)', marginBottom: 8, transition: 'background 0.12s', background: dragOverTarget === 'unassigned' ? 'var(--surface-sunken)' : 'transparent', outline: dragOverTarget === 'unassigned' ? '2px dashed var(--border-strong)' : '2px solid transparent', outlineOffset: -2 }}
                onDragOver={e => onFolderDragOver(e, 'unassigned')}
                onDragLeave={() => setDragOverTarget(null)}
                onDrop={e => onFolderDrop(e, 'unassigned')}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unassigned</span>
                {dragOverTarget === 'unassigned' && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Drop to remove from folder</span>}
              </div>
            )}
            <div className={s.grid}>
              {unassignedSheets.map(sheet => {
                const counts = countByKind(sheet)
                return (
                  <div key={sheet.id} className={s.sheetCard}
                    draggable
                    onDragStart={e => onDragStart(e, sheet.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => navigate(`/app/project/${projectId}/sheet/${sheet.id}`)}
                    style={{ opacity: draggingSheetId === sheet.id ? 0.4 : 1, cursor: 'grab' }}>
                    <div className={s.sheetThumb}>
                      <SheetPreview sheet={sheet} />
                      <div className={s.sheetCodeBadge}>{sheet.code}</div>
                    </div>
                    <div className={s.sheetInfo}>
                      <div className={s.sheetName}>{sheet.name}</div>
                      <div className={s.sheetCode}>{sheet.code}</div>
                      <div className={s.sheetCounts}>
                        {counts.areas > 0 && <span className={s.countChip} style={{ color: 'var(--takeoff-area)' }}>{counts.areas} area{counts.areas !== 1 ? 's' : ''}</span>}
                        {counts.lines > 0 && <span className={s.countChip} style={{ color: 'var(--takeoff-linear)' }}>{counts.lines} wall{counts.lines !== 1 ? 's' : ''}</span>}
                        {counts.points > 0 && <span className={s.countChip} style={{ color: 'var(--takeoff-count)' }}>{counts.points} items</span>}
                        {counts.areas === 0 && counts.lines === 0 && counts.points === 0 && <span className={s.countChip} style={{ color: 'var(--text-subtle)' }}>Empty sheet</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        </>}
      </main>

      <SheetUploadWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onImport={handleWizardImport}
      />

      {/* Add folder dialog */}
      <Dialog open={folderDlg} onClose={() => setFolderDlg(false)} title="Add folder"
        description="Create a folder to organize sheets by set." width={360}
        footer={<>
          <Button variant="ghost" onClick={() => setFolderDlg(false)}>Cancel</Button>
          <Button variant="primary" iconLeft={<FolderPlus size={15} />}
            disabled={!folderName.trim()}
            onClick={() => { addSheetSet(projectId, folderName.trim()); setFolderDlg(false) }}>
            Create folder
          </Button>
        </>}>
        <Input label="Folder name" placeholder="Landscape Plans, Civil…" value={folderName}
          onChange={e => setFolderName(e.target.value)} autoFocus />
      </Dialog>

      {/* Move to folder dialog */}
      <Dialog open={!!moveSheetDlg} onClose={() => setMoveSheetDlg(null)} title="Move to folder" width={360}
        footer={<Button variant="ghost" onClick={() => setMoveSheetDlg(null)}>Cancel</Button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(project.sheetSets || []).map(set => (
            <button key={set.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              onClick={() => { moveSheetToSet(projectId, moveSheetDlg, set.id); setMoveSheetDlg(null) }}>
              <Folder size={14} style={{ color: 'var(--brand-600)' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-strong)' }}>{set.name}</span>
            </button>
          ))}
          {(project.sheetSets || []).length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No folders yet. Create one first.</p>
          )}
        </div>
      </Dialog>

      {/* Export / print bid proposal */}
      <BidProposal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        project={project}
        sheetList={sheetList}
        folderGroups={folderGroups}
        unassignedSheets={unassignedSheets}
      />
    </div>
  )
}
