import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { PROJECTS, SHEETS, STATUS_LABEL, STATUS_VARIANT, CATS, CAT_COLOR, SHEET_W, SHEET_H } from '../data/sampleData.js'
import s from './ProjectPage.module.css'

function SheetPreview({ sheet }) {
  const scale = 0.22
  const w = SHEET_W * scale, h = SHEET_H * scale
  return (
    <div className={s.sheetPreview} style={{ width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} fill="none">
        {sheet.areas.map(a => (
          <polygon
            key={a.id}
            points={a.poly.map(p => `${p.x},${p.y}`).join(' ')}
            fill={CAT_COLOR[a.type]}
            fillOpacity="0.2"
            stroke={CAT_COLOR[a.type]}
            strokeWidth="2"
          />
        ))}
        {sheet.lines.map(l => (
          <polyline
            key={l.id}
            points={l.pts.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={CAT_COLOR[l.type]}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {sheet.points.map(p => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r="5"
            fill="white"
            stroke={CAT_COLOR[p.type]}
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  )
}

function countByKind(sheet) {
  const areas = sheet.areas.length
  const lines = sheet.lines.length
  const points = sheet.points.length
  return { areas, lines, points }
}

export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const project = PROJECTS[projectId]

  if (!project) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Project not found.</div>

  const sheets = project.sheetIds.map(id => SHEETS[id]).filter(Boolean)

  return (
    <div className={s.root}>
      <header className={s.top}>
        <div className={s.brand}>
          <img src="/plotline-mark.svg" alt="Plotline" className={s.logo} />
          <b className={s.wordmark}>Plotline<span className={s.dot}>.</span></b>
        </div>
        <div className={s.breadcrumb}>
          <span className={s.crumbLink} onClick={() => navigate('/')}>Projects</span>
          <ChevronRight size={14} className={s.crumbSep} />
          <span className={s.crumbCurrent}>{project.name}</span>
        </div>
        <div className={s.topRight}>
          <Badge variant={STATUS_VARIANT[project.status]} dot={project.status === 'bid_sent'}>
            {STATUS_LABEL[project.status]}
          </Badge>
          <Avatar name="Amy Reyes" status="online" />
        </div>
      </header>

      <main className={s.main}>
        <div className={s.head}>
          <button className={s.backBtn} onClick={() => navigate('/')}>
            <ArrowLeft size={14} />
            All projects
          </button>
          <div className={s.headInfo}>
            <h1 className={s.title}>{project.name}</h1>
            <p className={s.client}>{project.client}</p>
          </div>
          <div className={s.headRight}>
            <div className={s.bidValue}>
              <span className={s.bidLabel}>Bid value</span>
              <span className={s.bidNum}>${project.bidValue.toLocaleString()}</span>
            </div>
            <Button variant="primary" iconLeft={<Plus size={16} />} size="sm">Add sheet</Button>
          </div>
        </div>

        <div className={s.sectionLabel}>Sheets · {sheets.length}</div>

        <div className={s.grid}>
          {sheets.map(sheet => {
            const counts = countByKind(sheet)
            const totalItems = counts.areas + counts.lines + counts.points
            return (
              <div
                key={sheet.id}
                className={s.sheetCard}
                onClick={() => navigate(`/project/${projectId}/sheet/${sheet.id}`)}
              >
                <div className={s.sheetThumb}>
                  <SheetPreview sheet={sheet} />
                  <div className={s.sheetCodeBadge}>{sheet.code}</div>
                </div>
                <div className={s.sheetInfo}>
                  <div className={s.sheetName}>{sheet.name}</div>
                  <div className={s.sheetCode}>{sheet.code}</div>
                  <div className={s.sheetCounts}>
                    {counts.areas > 0 && (
                      <span className={s.countChip} style={{ color: 'var(--takeoff-area)' }}>
                        {counts.areas} area{counts.areas !== 1 ? 's' : ''}
                      </span>
                    )}
                    {counts.lines > 0 && (
                      <span className={s.countChip} style={{ color: 'var(--takeoff-linear)' }}>
                        {counts.lines} wall{counts.lines !== 1 ? 's' : ''}
                      </span>
                    )}
                    {counts.points > 0 && (
                      <span className={s.countChip} style={{ color: 'var(--takeoff-count)' }}>
                        {counts.points} items
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
