import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Map, TrendingUp } from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { Input } from '../components/ui/Input.jsx'
import { PROJECTS, STATUS_LABEL, STATUS_VARIANT } from '../data/sampleData.js'
import s from './ProjectsPage.module.css'

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

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const projects = Object.values(PROJECTS).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client.toLowerCase().includes(search.toLowerCase())
  )

  const totalPipeline = Object.values(PROJECTS).reduce((s, p) => s + (p.status !== 'archived' ? p.bidValue : 0), 0)
  const openBids = Object.values(PROJECTS).filter(p => p.status === 'bid_sent').length
  const wonCount = Object.values(PROJECTS).filter(p => p.status === 'won').length
  const totalSheets = Object.values(PROJECTS).reduce((s, p) => s + p.sheetIds.length, 0)

  return (
    <div className={s.root}>
      <header className={s.top}>
        <div className={s.brand}>
          <img src="/plotline-mark.svg" alt="Plotline" className={s.logo} />
          <b className={s.wordmark}>Plotline<span className={s.dot}>.</span></b>
        </div>
        <nav className={s.nav}>
          <a className={s.navLink} data-on="true">Projects</a>
          <a className={s.navLink}>Templates</a>
          <a className={s.navLink}>Pricebook</a>
          <a className={s.navLink}>Team</a>
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
          <Avatar name="Amy Reyes" status="online" />
        </div>
      </header>

      <main className={s.main}>
        <div className={s.head}>
          <div>
            <h1 className={s.title}>Projects</h1>
            <p className={s.sub}>{Object.keys(PROJECTS).length} projects · {openBids} bids out</p>
          </div>
          <Button variant="primary" iconLeft={<Plus size={16} />}>New project</Button>
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
          {projects.map(project => (
            <div
              key={project.id}
              className={s.card}
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <div className={s.preview}>
                <svg viewBox="0 0 220 160" fill="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  {PREVIEW_POLY[project.id] && (
                    <polygon
                      points={PREVIEW_POLY[project.id]}
                      fill={PREVIEW_COLOR[project.id]}
                      fillOpacity="0.16"
                      stroke={PREVIEW_COLOR[project.id]}
                      strokeWidth="2.5"
                    />
                  )}
                  {PREVIEW_LINE[project.id] && (
                    <polyline
                      points={PREVIEW_LINE[project.id]}
                      fill="none"
                      stroke={PREVIEW_COLOR[project.id]}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
                <span className={s.statusBadge}>
                  <Badge variant={STATUS_VARIANT[project.status]} dot={project.status === 'bid_sent'}>
                    {STATUS_LABEL[project.status]}
                  </Badge>
                </span>
              </div>
              <div className={s.cardBody}>
                <div>
                  <h3 className={s.cardName}>{project.name}</h3>
                  <div className={s.cardClient}>{project.client}</div>
                </div>
                <div className={s.cardMeta}>
                  <span className={s.sheetCount}>
                    <Map size={13} />
                    {project.sheetIds.length} {project.sheetIds.length === 1 ? 'sheet' : 'sheets'}
                  </span>
                  <span className={s.bidVal}>${project.bidValue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
