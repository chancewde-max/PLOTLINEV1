import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Ruler,
  Sprout,
  FileSpreadsheet,
  Upload,
  PenTool,
  Trophy,
  ArrowRight,
} from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import s from './LandingPage.module.css'

// No-op placeholder — wire to auth/routing later.
const noop = () => {}

export default function LandingPage() {
  const navigate = useNavigate()
  return (
    <div className={s.page}>
      <nav className={s.nav}>
        <Link to="/" className={s.navBrand}>
          <img src="/plotline-mark.svg" alt="Plotline" className={s.navLogo} />
          <span className={s.navWordmark}>Plotline<span>.</span></span>
        </Link>
        <div className={s.navSpacer}>
          <Button variant="ghost" onClick={noop}>Sign in</Button>
          <Link to="/app">
            <Button variant="primary" iconRight={<ArrowRight size={16} />} onClick={noop}>
              Start free trial
            </Button>
          </Link>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <header className={s.hero}>
        <div>
          <div className={s.eyebrow}>
            <Badge variant="brand">Takeoff software for landscape &amp; irrigation</Badge>
          </div>
          <h1 className={s.h1}>Estimate straight from the plans</h1>
          <p className={s.lede}>
            Plotline turns landscape and irrigation drawings into accurate, bid-ready
            takeoffs — measure areas, lengths, and counts right on the sheet, then export
            a clean estimate in minutes instead of hours.
          </p>
          <div className={s.ctaRow}>
            <Link to="/app">
              <Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />} onClick={noop}>
                Start free trial
              </Button>
            </Link>
            <Button variant="secondary" size="lg" onClick={() => navigate('/app/project/proj-1/sheet/sheet-1')}>Watch demo</Button>
          </div>
        </div>

        {/* ---- Hero visual: plan-sheet mock ---- */}
        <div className={s.sheet}>
          <div className={s.sheetGrid} />
          <div className={s.sheetHead}>
            <span>Maple Grove · Irrigation Plan · Sheet A-2</span>
            <span className={s.sheetPill} style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}>
              Plotline
            </span>
          </div>
          <svg className={s.sheetSvg} viewBox="0 0 420 280" fill="none">
            {/* property boundary */}
            <rect x="24" y="20" width="372" height="240" rx="8"
              stroke="var(--paper-edge)" strokeWidth="2" />
            {/* area — turf */}
            <path d="M60 70 L210 55 L250 150 L80 165 Z"
              fill="var(--takeoff-area)" fillOpacity="0.16"
              stroke="var(--takeoff-area)" strokeWidth="2.5" />
            {/* linear — irrigation mainline */}
            <polyline points="48,210 130,150 230,180 360,120"
              stroke="var(--takeoff-linear)" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
            {/* count — planting / heads */}
            {[[120,150],[180,165],[250,150],[305,135],[345,125],[150,205],[230,200],[300,200]]
              .map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="5"
                  fill="var(--takeoff-count)" fillOpacity="0.9"
                  stroke="var(--slate-0)" strokeWidth="1.5" />
              ))}
          </svg>
          <div className={s.calloutCard} style={{ top: 56, left: 250 }}>
            <span className={s.swatch} style={{ background: 'var(--takeoff-area)' }} />
            Sod · 4,820 ft²
          </div>
          <div className={s.calloutCard} style={{ top: 175, left: 36 }}>
            <span className={s.swatch} style={{ background: 'var(--takeoff-linear)' }} />
            Mainline · 312 ft
          </div>
          <div className={s.calloutCard} style={{ top: 215, left: 250 }}>
            <span className={s.swatch} style={{ background: 'var(--takeoff-count)' }} />
            8 spray heads
          </div>
        </div>
      </header>

      {/* ---- Feature grid ---- */}
      <section className={`${s.section} ${s.container}`}>
        <div className={s.sectionHead}>
          <div className={s.sectionKicker}>Built for the field</div>
          <h2 className={s.sectionTitle}>Everything a takeoff needs</h2>
          <p className={s.sectionSub}>
            Measure the way your bids are built — by area, by length, and by count.
          </p>
        </div>
        <div className={s.features}>
          <div className={s.feature}>
            <span className={s.featureIcon}><Ruler size={22} /></span>
            <h3 className={s.featureTitle}>Measure areas, lengths &amp; counts</h3>
            <p className={s.featureText}>
              Trace turf, hardscape, and beds as areas; runs and edges as lengths; trees,
              heads, and fixtures as counts — all on the same plan.
            </p>
          </div>
          <div className={s.feature}>
            <span className={s.featureIcon}><Sprout size={22} /></span>
            <h3 className={s.featureTitle}>Irrigation &amp; planting takeoffs</h3>
            <p className={s.featureText}>
              Zone-by-zone coverage, head spacing, and plant schedules with material
              categories that map straight to your pricebook.
            </p>
          </div>
          <div className={s.feature}>
            <span className={s.featureIcon}><FileSpreadsheet size={22} /></span>
            <h3 className={s.featureTitle}>Export clean bid estimates</h3>
            <p className={s.featureText}>
              Roll measured quantities into an organized estimate and send it to Excel or
              your proposal tool without re-keying a thing.
            </p>
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className={`${s.section} ${s.container}`} style={{ background: 'var(--bg-app)' }}>
        <div className={s.sectionHead}>
          <div className={s.sectionKicker}>How it works</div>
          <h2 className={s.sectionTitle}>From plan to bid in three steps</h2>
          <p className={s.sectionSub}>No setup, no training course — just open a plan and start marking.</p>
        </div>
        <div className={s.steps}>
          <div className={s.step}>
            <div className={s.stepNum} />
            <h3 className={s.stepTitle}>Upload plan</h3>
            <p className={s.stepText}>
              Drop in a PDF or image of the landscape or irrigation drawing. Plotline scales
              it to real-world dimensions automatically.
            </p>
          </div>
          <div className={s.step}>
            <div className={s.stepNum} />
            <h3 className={s.stepTitle}>Mark it up</h3>
            <p className={s.stepText}>
              Trace areas, draw runs, and drop counts. Each layer is color-coded and tallied
              as you go — no measuring tape required.
            </p>
          </div>
          <div className={s.step}>
            <div className={s.stepNum} />
            <h3 className={s.stepTitle}>Win the bid</h3>
            <p className={s.stepText}>
              Export a clean, itemized estimate with accurate quantities and get proposals
              out the door before your competition.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Stats band ---- */}
      <section className={s.container}>
        <div className={s.stats}>
          <div className={s.stat}>
            <div className={s.statV}>6+ hrs</div>
            <div className={s.statK}>saved per takeoff</div>
          </div>
          <div className={s.stat}>
            <div className={s.statV}>99%</div>
            <div className={s.statK}>measurement accuracy</div>
          </div>
          <div className={s.stat}>
            <div className={s.statV}>100%</div>
            <div className={s.statK}>built for landscapers</div>
          </div>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section className={s.container} style={{ paddingTop: 64, paddingBottom: 64 }}>
        <div className={s.cta}>
          <h2 className={s.ctaTitle}>Stop measuring by hand</h2>
          <p className={s.ctaSub}>
            Open your first plan in Plotline and see how fast a clean, accurate takeoff
            really is. Free to start — no card required.
          </p>
          <div className={s.ctaRow}>
            <Link to="/app">
              <Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />} onClick={noop}>
                Start free trial
              </Button>
            </Link>
            <Button variant="ghost" size="lg" className={s.ctaGhost} onClick={noop}>Talk to us</Button>
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className={s.footer}>
        <span className={s.footerBrand}>
          <img src="/plotline-mark.svg" alt="" className={s.navLogo} />
          Plotline
        </span>
        <span className={s.footerCopy}>© {new Date().getFullYear()} Plotline. Takeoff software for landscape &amp; irrigation.</span>
        <div className={s.footerLinks}>
          <a href="#" onClick={noop}>Product</a>
          <a href="#" onClick={noop}>Pricing</a>
          <a href="#" onClick={noop}>Docs</a>
          <a href="#" onClick={noop}>Contact</a>
        </div>
      </footer>
    </div>
  )
}
