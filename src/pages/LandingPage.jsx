import React, { useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Ruler,
  Sprout,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  Target,
  Award,
} from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import SideRays from '../components/SideRays.jsx'
import s from './LandingPage.module.css'

// The working demo takeoff — every primary CTA routes here so a visitor
// clicks through to a real, measured plan instead of a dead button.
const DEMO = '/app/project/proj-1/sheet/sheet-1'

export default function LandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { openAuth, user } = useAuth()

  useEffect(() => {
    const id = location.hash ? location.hash.slice(1) : ''
    if (id) {
      const el = document.getElementById(id)
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }))
    }
  }, [location.hash])

  return (
    <div className={s.page}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className={s.raysBg} aria-hidden="true">
        <SideRays
          rayColor1="#EAB308"
          rayColor2="#96c8ff"
          origin="top-right"
          speed={2.5}
          intensity={2}
          spread={2}
          tilt={0}
          saturation={1.5}
          blend={0.75}
          falloff={1.6}
          opacity={1}
        />
      </div>
      <nav className={s.nav}>
        <Link to="/" className={s.navBrand}>
          <img src="/plotline-mark.svg" alt="Plotline" className={s.navLogo} />
          <span className={s.navWordmark}>Plotline<span>.</span></span>
        </Link>
        <div className={s.navSpacer}>
          <a className={s.navLink} href="/#product" onClick={(e) => { e.preventDefault(); navigate('/#product') }}>Product</a>
          <a className={s.navLink} href="/pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing') }}>Pricing</a>
          <a className={s.navLink} href="/#customers" onClick={(e) => { e.preventDefault(); navigate('/#customers') }}>Customers</a>
          <a className={s.navLink} href="/#docs" onClick={(e) => { e.preventDefault(); navigate('/#docs') }}>Docs</a>
          <Button variant="ghost" onClick={() => openAuth()}>Sign in</Button>
          <Button
            variant="primary"
            iconRight={<ArrowRight size={16} />}
            onClick={() => openAuth()}
          >
            Start free trial
          </Button>
        </div>
      </nav>

      <main id="main-content">
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
            <Button
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={16} />}
              onClick={() => openAuth()}
            >
              Start free trial
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate(DEMO)}
            >
              Watch demo
            </Button>
          </div>
        </div>

        {/* ---- Hero visual: plan-sheet mock, framed like a real product window ---- */}
        <div className={s.sheetStage}>
          <div className={s.sheetGlow} aria-hidden="true" />
          <div className={s.sheetBack} aria-hidden="true" />
          <div className={s.sheet}>
            <div className={s.chrome}>
              <span className={s.dot} data-c="a" />
              <span className={s.dot} data-c="b" />
              <span className={s.dot} data-c="c" />
              <span className={s.chromeTab}>Maple Grove · Irrigation Plan · A-2</span>
            </div>
            <div className={s.sheetBody}>
              <div className={s.sheetGrid} />
              <svg className={s.sheetSvg} viewBox="0 0 420 250" fill="none">
                {/* property boundary */}
                <rect x="14" y="12" width="392" height="200" rx="6"
                  stroke="var(--paper-edge)" strokeWidth="2" />
                {/* compass */}
                <g transform="translate(382,34)" opacity="0.55">
                  <circle r="13" fill="none" stroke="var(--text-subtle)" strokeWidth="1.2" />
                  <path d="M0,-9 L3,0 L0,9 L-3,0 Z" fill="var(--text-subtle)" />
                  <text x="0" y="-17" textAnchor="middle" fontSize="8" fill="var(--text-subtle)">N</text>
                </g>
                {/* area — turf */}
                <path d="M52 58 L206 44 L244 128 L70 142 Z"
                  fill="var(--takeoff-area)" fillOpacity="0.18"
                  stroke="var(--takeoff-area)" strokeWidth="2.5" strokeLinejoin="round" />
                {/* area — planting bed */}
                <path d="M268 132 L358 140 L352 186 L260 180 Z"
                  fill="var(--takeoff-volume)" fillOpacity="0.16"
                  stroke="var(--takeoff-volume)" strokeWidth="2" strokeLinejoin="round" />
                {/* linear — irrigation mainline */}
                <polyline points="40,170 118,124 214,150 340,96"
                  fill="none" stroke="var(--takeoff-linear)" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" />
                {/* count — planting / heads */}
                {[[112,124],[168,136],[228,122],[276,110],[312,100],[140,168],[204,164],[266,162],[300,158]]
                  .map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="4.5"
                      fill="var(--takeoff-count)" fillOpacity="0.92"
                      stroke="var(--slate-0)" strokeWidth="1.3" />
                  ))}
                {/* the "live" point — pulsing ring signals this is an active tool, not a photo */}
                <circle cx="228" cy="122" r="4.5" fill="var(--takeoff-count)" stroke="var(--slate-0)" strokeWidth="1.3" />
                <circle cx="228" cy="122" r="9" fill="none" stroke="var(--takeoff-count)" strokeWidth="1.5" className={s.pulseRing} />
                {/* dimension line */}
                <g stroke="var(--text-subtle)" strokeWidth="1">
                  <line x1="52" y1="214" x2="244" y2="214" />
                  <line x1="52" y1="209" x2="52" y2="219" />
                  <line x1="244" y1="209" x2="244" y2="219" />
                </g>
                <text x="148" y="208" textAnchor="middle" fontSize="9" fill="var(--text-subtle)">96'-0"</text>
              </svg>
            </div>
          </div>
          <div className={s.calloutCard} style={{ top: 30, left: 236 }}>
            <span className={s.calloutSwatch} style={{ background: 'var(--takeoff-area)' }} />
            <div>
              <div className={s.calloutLabel}>Sod</div>
              <div className={s.calloutValue}>4,820 ft²</div>
            </div>
          </div>
          <div className={s.calloutCard} style={{ top: 154, left: 12 }}>
            <span className={s.calloutSwatch} style={{ background: 'var(--takeoff-linear)' }} />
            <div>
              <div className={s.calloutLabel}>Mainline</div>
              <div className={s.calloutValue}>312 ft</div>
            </div>
          </div>
          <div className={s.calloutCard} style={{ top: 196, left: 236 }}>
            <span className={s.calloutSwatch} style={{ background: 'var(--takeoff-count)' }} />
            <div>
              <div className={s.calloutLabel}>Spray heads</div>
              <div className={s.calloutValue}>8 pts</div>
            </div>
          </div>
        </div>
      </header>

      {/* ---- Feature grid ---- */}
      <section id="product" className={`${s.section} ${s.container}`}>
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
            <Clock size={20} className={s.statIcon} />
            <div className={s.statV}>6+ hrs</div>
            <div className={s.statK}>saved per takeoff</div>
          </div>
          <div className={s.stat}>
            <Target size={20} className={s.statIcon} />
            <div className={s.statV}>99%</div>
            <div className={s.statK}>measurement accuracy</div>
          </div>
          <div className={s.stat}>
            <Award size={20} className={s.statIcon} />
            <div className={s.statV}>100%</div>
            <div className={s.statK}>built for landscapers</div>
          </div>
        </div>
        <p className={s.statsNote}>
          Figures are illustrative and based on internal estimates — individual results vary.
        </p>
      </section>

      {/* ---- Customers / testimonials ---- */}
      <section id="customers" className={`${s.section} ${s.container}`} style={{ background: 'var(--bg-app)' }}>
        <div className={s.sectionHead}>
          <div className={s.sectionKicker}>Customers</div>
          <h2 className={s.sectionTitle}>Loved by estimators in the field</h2>
          <p className={s.sectionSub}>Landscape and irrigation crews use Plotline to turn plans into priced bids in minutes.</p>
        </div>
        <div className={s.features}>
          <div className={s.feature}>
            <h3 className={s.featureTitle}>“Cut our estimating time in half.”</h3>
            <p className={s.featureText}>“Plotline reads the plan the way my foreman does — area, linear, count, done.” — Dana, GreenScape Landscaping</p>
            <span className={s.sampleTag}>Illustrative sample — not a verified customer</span>
          </div>
          <div className={s.feature}>
            <h3 className={s.featureTitle}>“The irrigation takeoff paid for itself.”</h3>
            <p className={s.featureText}>“Laterals, heads, and valves sorted by zone, straight into the bid. No more re-counts.” — Marcus, BlueLine Irrigation</p>
            <span className={s.sampleTag}>Illustrative sample — not a verified customer</span>
          </div>
        </div>
      </section>

      {/* ---- Docs / FAQ ---- */}
      <section id="docs" className={`${s.section} ${s.container}`}>
        <div className={s.sectionHead}>
          <div className={s.sectionKicker}>Docs</div>
          <h2 className={s.sectionTitle}>Questions, answered</h2>
          <p className={s.sectionSub}>Everything landscape &amp; irrigation contractors ask before they switch from paper.</p>
        </div>
        <div className={s.features}>
          <div className={s.feature}>
            <h3 className={s.featureTitle}>Do I need CAD or a PDF editor?</h3>
            <p className={s.featureText}>No. Plotline reads the PDF plans and image scans you already get from the architect. Upload the set, calibrate the scale once, and start measuring.</p>
          </div>
          <div className={s.feature}>
            <h3 className={s.featureTitle}>What does the export include?</h3>
            <p className={s.featureText}>A clean, itemized bid proposal — client name, sheet summary, and a materials takeoff grouped by category. Print to PDF or download a CSV for your accounting system.</p>
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
            <Button
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={16} />}
              onClick={() => openAuth()}
            >
              Start free trial
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className={s.ctaGhost}
              onClick={() => navigate(DEMO)}
            >
              Try the demo
            </Button>
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      </main>
      <footer className={s.footer}>
        <span className={s.footerBrand}>
          <img src="/plotline-mark.svg" alt="" className={s.navLogo} />
          Plotline
        </span>
        <span className={s.footerCopy}>© {new Date().getFullYear()} Plotline. Takeoff software for landscape &amp; irrigation.</span>
        <div className={s.footerLinks}>
          <a href="/#product" onClick={(e) => { e.preventDefault(); navigate('/#product') }}>Product</a>
          <a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing') }}>Pricing</a>
          <a href="/#customers" onClick={(e) => { e.preventDefault(); navigate('/#customers') }}>Customers</a>
          <a href="/#docs" onClick={(e) => { e.preventDefault(); navigate('/#docs') }}>Docs</a>
        </div>
        <div className={s.footerLegalLinks}>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <a href="mailto:hello@plotline.app">Contact</a>
        </div>
      </footer>
    </div>
  )
}
