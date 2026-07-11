import React, { useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import styles from './MarketingSite.module.css'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useAuth } from '../auth/AuthProvider.jsx'
import {
  Ruler,
  ArrowRight,
  Play,
  Check,
  SquareDashed,
  Spline,
  LocateFixed,
  Hand,
  Layers,
  Calculator,
  Users,
  FileDown,
  History,
  Droplets,
  Sprout,
  ClipboardCheck,
  Upload,
  ScanLine,
  Send,
  Leaf,
  Quote,
  Twitter,
  Linkedin,
  Github,
  Star,
} from 'lucide-react'

// The working demo takeoff — every primary CTA routes here so a visitor
// clicks through to a real, measured plan instead of a dead button.
const DEMO = '/app/project/proj-1/sheet/sheet-1'

const FEATURES = [
  {
    icon: SquareDashed,
    color: 'var(--takeoff-area)',
    bg: 'var(--takeoff-area-bg)',
    title: 'Area & length takeoffs',
    body: 'Trace beds, lawns, walks, and walls. Area and linear tools snap to the sheet grid so every dimension is measured automatically the moment you draw.',
  },
  {
    icon: LocateFixed,
    color: 'var(--takeoff-count)',
    bg: 'var(--takeoff-count-bg)',
    title: 'Count & symbol takeoffs',
    body: 'Drop a tap to tally trees, shrubs, heads, and fixtures. Place symbols once and Plotline counts them per species, zone, and assembly.',
  },
  {
    icon: Droplets,
    color: 'var(--takeoff-slope)',
    bg: 'var(--takeoff-slope-bg)',
    title: 'Irrigation plan takeoffs',
    body: 'Measure laterals, mainlines, and valve counts by zone. Pull head schedules straight off the plan and roll them into the bid.',
  },
  {
    icon: Sprout,
    color: 'var(--mat-sod)',
    bg: 'var(--takeoff-region-bg)',
    title: 'Planting & sod takeoffs',
    body: 'Quantify sod, hydroseed, rock, and plant material by type. Plotline maps each material to its own color so a mixed plan stays readable.',
  },
  {
    icon: Calculator,
    color: 'var(--takeoff-linear)',
    bg: 'var(--takeoff-linear-bg)',
    title: 'Live bid estimate',
    body: 'Quantities flow straight into a running estimate. Attach unit prices from your pricebook and watch the total update as you mark up the sheet.',
  },
  {
    icon: FileDown,
    color: 'var(--brand-600)',
    bg: 'var(--brand-50)',
    title: 'Export & share',
    body: 'One click to an itemized PDF, a branded proposal, or a CSV of quantities for your accounting system. Share a live link your client can open.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Upload your sheets',
    body: 'Drop in a PDF set or a single plan. Plotline keeps every sheet in one project, with versions tracked so nothing gets lost.',
    icon: Upload,
  },
  {
    n: '2',
    title: 'Set scale & trace',
    body: 'Calibrate the scale once, then pick a tool and trace what you’re bidding. Quantities calculate as you go — no ruler, no guesswork.',
    icon: ScanLine,
  },
  {
    n: '3',
    title: 'Price & send',
    body: 'Apply unit prices, review the live estimate, and export a proposal your client can sign. Your first project is free.',
    icon: Send,
  },
]

const TIERS = [
  {
    name: 'Starter',
    desc: 'For solo estimators getting off paper.',
    price: '$0',
    per: '/ forever',
    cta: 'Start free',
    popular: false,
    features: [
      '1 active project',
      'Unlimited sheets & takeoffs',
      'Area, linear & count tools',
      'PDF & CSV export',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    desc: 'For crews bidding every week.',
    price: '$49',
    per: '/mo',
    cta: 'Start free trial',
    popular: true,
    features: [
      'Unlimited projects',
      'Irrigation & planting takeoffs',
      'Live bid estimate & pricebook',
      'Branded proposals & sharing',
      'Version history & revisions',
      'Priority email support',
    ],
  },
  {
    name: 'Crew',
    desc: 'For multi-user operations.',
    price: '$149',
    per: '/mo',
    cta: 'Talk to sales',
    popular: false,
    features: [
      'Everything in Pro',
      'Unlimited team seats',
      'Real-time plan collaboration',
      'Role & permission controls',
      'API & accounting integrations',
      'Dedicated onboarding',
    ],
  },
]

const TESTIMONIALS = [
  {
    quote:
      'We cut our estimating time in half the first week. Plotline reads the plan the way my foreman does — area, linear, count, done.',
    name: 'Dana Whitfield',
    role: 'Estimator, GreenScape Landscaping',
    initials: 'GS',
    sample: true,
  },
  {
    quote:
      'The irrigation takeoff alone paid for the year. Laterals, heads, and valves sorted by zone, straight into the bid. No more re-counts.',
    name: 'Marcus Reyes',
    role: 'Owner, BlueLine Irrigation Co.',
    initials: 'BL',
    sample: true,
  },
]

const LOGOS = ['Hilltop', 'GreenAxis', 'Oakmont', 'Vantage', 'Beacon']

const WORKFLOW = [
  {
    n: '1',
    title: 'Upload plan PDF',
    body: 'Drop in the landscape or irrigation set you already receive from the architect — no CAD seat, no redrawing. Plotline keeps every sheet in one project.',
    icon: Upload,
  },
  {
    n: '2',
    title: 'Measure areas, lines & counts',
    body: 'Set scale once, then trace turf, hardscape, and beds as areas; runs and walls as lengths; trees, heads, and fixtures as counts — all color-coded on the sheet.',
    icon: Ruler,
  },
  {
    n: '3',
    title: 'Generate material list',
    body: 'Quantities roll into a live materials list grouped by category — sod, rock, hydroseed, trees, shrubs, limestone walls, and irrigation items — ready for your pricebook.',
    icon: FileSpreadsheet,
  },
  {
    n: '4',
    title: 'Export the bid',
    body: 'Print a branded proposal or download a CSV your accounting system can ingest. Send it before your competition has finished measuring by hand.',
    icon: FileDown,
  },
]

function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { openAuth } = useAuth()

  useEffect(() => {
    const id = location.hash ? location.hash.slice(1) : ''
    if (id) {
      const el = document.getElementById(id)
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }))
    }
  }, [location.hash])

  return (
    <header className={styles.nav}>
      <div className={`${styles.container} ${styles.navInner}`}>
        <a className={styles.brand} href="/" aria-label="Plotline home" onClick={(e) => { e.preventDefault(); navigate('/') }}>
          <img src="/plotline-mark.svg" alt="" />
          <b>Plotline<span className={styles.dot}>.</span></b>
        </a>
        <nav className={styles.navLinks}>
          <a href="/#product" onClick={(e) => { e.preventDefault(); navigate('/#product') }}>Product</a>
          <a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing') }}>Pricing</a>
          <a href="/#customers" onClick={(e) => { e.preventDefault(); navigate('/#customers') }}>Customers</a>
          <a href="/#docs" onClick={(e) => { e.preventDefault(); navigate('/#docs') }}>Docs</a>
        </nav>
        <div className={styles.navRight}>
          <div className={styles.navCta}>
            <Button
              variant="ghost"
              size="sm"
              className={styles.signIn}
              onClick={() => openAuth()}
            >
              Sign in
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openAuth()}
            >
              Start free trial
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  const navigate = useNavigate()
  const { openAuth } = useAuth()
  return (
    <section className={styles.hero} id="top">
      <div className={`${styles.container} ${styles.heroGrid}`}>
        <div>
          <span className={styles.eyebrow}>
            <Ruler size={14} /> For landscape &amp; irrigation contractors
          </span>
          <h1>
            Estimate straight<br />from the <span className={styles.hl}>plans</span>.
          </h1>
          <p className={styles.lede}>
            Open a sheet, trace what you’re bidding, and watch quantities flow
            into a live estimate. Plotline turns plan markup and takeoff into
            one fast, accurate workflow built for the field.
          </p>
          <div className={styles.heroCta}>
            <Button
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={17} />}
              onClick={() => openAuth()}
            >
              Start free trial
            </Button>
            <Button
              variant="secondary"
              size="lg"
              iconLeft={<Play size={16} />}
              onClick={() => navigate(DEMO)}
            >
              Watch 2-min demo
            </Button>
          </div>
          <div className={styles.heroNote}>
            <Check size={15} /> No credit card · Unlimited sheets on trial
          </div>
        </div>

        <div className={styles.shot} aria-hidden="true">
          <div className={styles.shotSheet}>
            <svg viewBox="0 0 420 330" preserveAspectRatio="none">
              {/* area polygon */}
              <polygon
                points="70,70 250,60 280,200 90,220"
                fill="rgba(46,158,79,0.16)"
                stroke="var(--takeoff-area)"
                strokeWidth="2.5"
              />
              {/* outline / linear */}
              <polyline
                points="70,70 250,60 280,200 90,220 70,70"
                fill="none"
                stroke="var(--takeoff-linear)"
                strokeWidth="2"
              />
              {/* count symbols */}
              {[[120, 110], [200, 95], [160, 170]].map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r="7" fill="#fff" stroke="var(--takeoff-count)" strokeWidth="2.5" />
                  <circle cx={x} cy={y} r="2.5" fill="var(--takeoff-count)" />
                </g>
              ))}
              {/* corner ticks */}
              {[70, 250, 280, 90].map((x, i) => {
                const ys = [70, 60, 200, 220]
                return (
                  <rect
                    key={i}
                    x={x - 4}
                    y={ys[i] - 4}
                    width="8"
                    height="8"
                    fill="#fff"
                    stroke="var(--takeoff-area)"
                    strokeWidth="2"
                  />
                )
              })}
            </svg>
            <span className={`${styles.callout} ${styles.calloutArea}`}>4,820 sq ft</span>
            <span className={`${styles.callout} ${styles.calloutLinear}`}>142 lin ft</span>
            <span className={`${styles.callout} ${styles.calloutCount}`}>9 trees</span>
          </div>
          <div className={styles.toolbar}>
            <span className={styles.tool}><Hand size={17} /></span>
            <span className={`${styles.tool} ${styles.on}`}><SquareDashed size={17} /></span>
            <span className={styles.tool}><Spline size={17} /></span>
            <span className={styles.tool}><LocateFixed size={17} /></span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Logos() {
  return (
    <section className={styles.logos}>
      <div className={styles.container}>
        <div className={styles.logosRow}>
          <span className={styles.logosLabel}>Trusted by crews at</span>
          {LOGOS.map((name) => (
            <span key={name} className={styles.logoName}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section className={`${styles.section}`} id="product">
      <div className={styles.container}>
        <div className={styles.secHead}>
          <span className={styles.eyebrowPlain}>Everything in one workspace</span>
          <h2>From plan sheet to priced bid</h2>
          <p>
            Plotline replaces the printout, the scale ruler, and the
            spreadsheet with a single workspace built for estimators.
          </p>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map(({ icon: Icon, color, bg, title, body }) => (
            <article key={title} className={styles.feature}>
              <div className={styles.featureIcon} style={{ background: bg, color }}>
                <Icon size={21} />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Steps() {
  return (
    <section className={`${styles.section} ${styles.steps}`}>
      <div className={styles.container}>
        <div className={styles.secHead}>
          <span className={styles.eyebrowPlain}>How it works</span>
          <h2>Three steps to an estimate</h2>
        </div>
        <div className={styles.stepsGrid}>
          {STEPS.map(({ n, title, body, icon: Icon }) => (
            <div key={n} className={styles.step}>
              <div className={styles.stepNum}>{n}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Workflow() {
  return (
    <section className={`${styles.section} ${styles.workflow}`}>
      <div className={styles.container}>
        <div className={styles.secHead}>
          <span className={styles.eyebrowPlain}>For landscape &amp; irrigation contractors</span>
          <h2>How crews run a takeoff in Plotline</h2>
          <p>
            The same four moves, every bid — from the PDF you already have to a
            priced proposal your client can sign.
          </p>
        </div>
        <div className={styles.workflowGrid}>
          {WORKFLOW.map(({ n, title, body, icon: Icon }) => (
            <div key={n} className={styles.workflowStep}>
              <div className={styles.workflowIcon}>
                <Icon size={20} />
              </div>
              <div className={styles.workflowStepNum}>Step {n}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Integrations() {
  return (
    <section className={`${styles.section} ${styles.integrations}`}>
      <div className={styles.container}>
        <div className={styles.secHead}>
          <span className={styles.eyebrowPlain}>Works with what you have</span>
          <h2>No CAD required — just your plans</h2>
          <p>
            Plotline reads the PDFs and image scans you already get. Export
            straight into the tools your office runs.
          </p>
        </div>
        <div className={styles.integrationsRow}>
          {['PDF plans & scans', 'Excel / CSV', 'QuickBooks', 'Google Drive', 'Email proposals'].map((name) => (
            <div key={name} className={styles.integrationChip}>{name}</div>
          ))}
        </div>
        <p className={styles.integrationsNote}>
          Bring your own pricebook. Plotline maps every measured material to its
          category so quantities flow into your estimate without re-keying.
        </p>
      </div>
    </section>
  )
}

function StatsBand() {
  return (
    <section className={styles.sectionTight}>
      <div className={styles.container}>
        <div className={styles.band}>
          <div className={styles.bandItem}>
            <div className={styles.bandValue}>
              <em>3×</em>
            </div>
            <div className={styles.bandKey}>faster takeoffs than paper &amp; ruler</div>
          </div>
          <div className={styles.bandItem}>
            <div className={styles.bandValue}>98%</div>
            <div className={styles.bandKey}>quantity accuracy vs. manual counts</div>
          </div>
          <div className={styles.bandItem}>
            <div className={styles.bandValue}>12k+</div>
            <div className={styles.bandKey}>sheets measured every week</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const navigate = useNavigate()
  const { openAuth } = useAuth()
  return (
    <section className={styles.section} id="pricing">
      <div className={styles.container}>
        <div className={styles.secHead}>
          <span className={styles.eyebrowPlain}>Pricing</span>
          <h2>Simple plans that scale with the crew</h2>
          <p>Start free, upgrade when you’re bidding every week. No setup fees.</p>
        </div>
        <div className={styles.pricingGrid}>
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={`${styles.tier} ${tier.popular ? styles.tierPopular : ''}`}
            >
              {tier.popular && (
                <div className={styles.popularTag}>
                  <Badge variant="brand" dot>
                    Most popular
                  </Badge>
                </div>
              )}
              <h3 className={styles.tierName}>{tier.name}</h3>
              <p className={styles.tierDesc}>{tier.desc}</p>
              <div className={styles.tierPrice}>
                <span className={styles.tierAmount}>{tier.price}</span>
                <span className={styles.tierPer}>{tier.per}</span>
              </div>
              <ul className={styles.tierFeatures}>
                {tier.features.map((f) => (
                  <li key={f}>
                    <Check size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={tier.popular ? 'primary' : 'secondary'}
                fullWidth
                onClick={() => tier.cta === 'Talk to sales' ? navigate('/app') : openAuth()}
              >
                {tier.cta}
              </Button>
            </article>
          ))}
        </div>
      </div>
      <p className={styles.pricingLegal}>
        All paid plans are billed at the listed price and billing frequency and{' '}
        <strong>auto-renew</strong> until cancelled. Cancel anytime from your account
        settings or by emailing <a href="mailto:sales@plotline.app">sales@plotline.app</a>;
        you keep access through the end of the paid period. Free trials convert to a paid
        plan automatically unless cancelled before the trial ends.
      </p>
    </section>
  )
}

function Testimonials() {
  return (
    <section className={styles.section} id="customers">
      <div className={styles.container}>
        <div className={styles.secHead}>
          <span className={styles.eyebrowPlain}>Customers</span>
          <h2>Loved by estimators in the field</h2>
        </div>
        <div className={styles.testimonialGrid}>
          {TESTIMONIALS.map(({ quote, name, role, initials }) => (
            <figure key={name} className={styles.quote}>
              <Quote size={28} color="var(--brand-200)" />
              <blockquote className={styles.quoteText}>“{quote}”</blockquote>
              <figcaption className={styles.quoteAuthor}>
                <span className={styles.avatar}>{initials}</span>
                <span>
                  <span className={styles.quoteName}>{name}</span>
                  <br />
                  <span className={styles.quoteRole}>{role}</span>
                </span>
              </figcaption>
              {sample && (
                <span className={styles.sampleTag}>Illustrative sample — not a verified customer</span>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  const navigate = useNavigate()
  const { openAuth } = useAuth()
  return (
    <section className={styles.finalCta} id="docs">
      <div className={styles.container}>
        <div className={styles.finalCtaInner}>
          <h2>Win the bid before lunch.</h2>
          <p>Start measuring in minutes. Your first project is free — no card required.</p>
          <div className={styles.finalCtaRow}>
            <Button
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={17} />}
              onClick={() => openAuth()}
            >
              Start free trial
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate(DEMO)}
            >
              Book a demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const navigate = useNavigate()
  const cols = [
    {
      title: 'Product',
      links: ['Takeoff tools', 'Live estimate', 'Irrigation', 'Planting', 'Pricing'],
    },
    {
      title: 'Company',
      links: ['About', 'Customers', 'Careers', 'Blog', 'Contact'],
    },
    {
      title: 'Resources',
      links: ['Docs', 'Help center', 'API', 'Status', 'Changelog'],
    },
  ]
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrandCol}>
            <a className={styles.brand} href="#top" aria-label="Plotline home">
              <img src="/plotline-mark.svg" alt="" />
              <b>Plotline<span className={styles.dot}>.</span></b>
            </a>
            <p>
              Estimate straight from the plans.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title} className={styles.footerCol}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href={l === 'Pricing' ? '/pricing' : (l === 'Customers' ? '/#customers' : (l === 'Contact' ? 'mailto:sales@plotline.app' : '/#docs'))}
                      target={l === 'Contact' ? undefined : undefined}
                      onClick={(e) => {
                        if (l === 'Contact') return
                        e.preventDefault()
                        navigate(l === 'Pricing' ? '/pricing' : (l === 'Customers' ? '/#customers' : '/#docs'))
                      }}
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={styles.footerBottom}>
          <span className={styles.footerCopy}>
            © 2026 Plotline. Estimate straight from the plans.
          </span>
          <div className={styles.footerLegalLinks}>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <a href="mailto:hello@plotline.app">Contact</a>
          </div>
          <div className={styles.footerSocial}>
            <a href="https://twitter.com" aria-label="Twitter" target="_blank" rel="noreferrer"><Twitter size={16} /></a>
            <a href="https://linkedin.com" aria-label="LinkedIn" target="_blank" rel="noreferrer"><Linkedin size={16} /></a>
            <a href="https://github.com" aria-label="GitHub" target="_blank" rel="noreferrer"><Github size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function MarketingSite() {
  return (
    <div className={styles.root}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Nav />
      <main id="main-content">
        <Hero />
        <Logos />
        <Features />
        <Steps />
        <Workflow />
        <Integrations />
        <StatsBand />
        <Pricing />
        <Testimonials />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
