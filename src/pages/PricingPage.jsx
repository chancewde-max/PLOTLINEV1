import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import {
  Check,
  ArrowRight,
  ChevronDown,
  Ruler,
  Sprout,
  FileSpreadsheet,
  Twitter,
  Linkedin,
  Github,
} from 'lucide-react'
import s from './PricingPage.module.css'

// The working demo takeoff — every primary CTA routes here so a visitor
// clicks through to a real, measured plan instead of a dead button.
const DEMO = '/app/project/proj-1/sheet/sheet-1'

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

const FAQ = [
  {
    q: 'Do I need CAD or a PDF editor to use Plotline?',
    a: 'No. Plotline reads the PDF plans and image scans you already get from the architect or engineer. Upload the set, calibrate the scale once, and start measuring — no CAD seat, no redrawing the plan.',
  },
  {
    q: 'Can I take off both landscape and irrigation on the same project?',
    a: 'Yes. Organize sheets into folders (planting, irrigation, grading) and use the area, linear, and count tools side by side. The materials list groups trees, shrubs, sod, rock, hydroseed, limestone walls, and irrigation items automatically.',
  },
  {
    q: 'What does the export include?',
    a: 'Each project exports a clean, itemized bid proposal — client name, sheet summary with quantities, folder breakdown, and a materials takeoff grouped by category. You can print to PDF or download a CSV for your accounting system. No re-keying.',
  },
  {
    q: 'How is a "project" counted on the free plan?',
    a: 'On Starter you can keep one active project at a time. Finish or archive it and start another — sheets and takeoffs are always unlimited. Upgrade to Pro when you need several bids in flight at once.',
  },
  {
    q: 'Will Plotline work for my whole crew?',
    a: 'Pro covers a single power user bidding every week. Crew adds unlimited team seats, real-time collaboration on the same plan, and role controls so estimators, PMs, and owners see what they need.',
  },
  {
    q: 'Is there a contract or setup fee?',
    a: 'No setup fees and no long-term contract on monthly plans — cancel anytime. Starter is free forever, and your first project on Pro is a free trial with no card required.',
  },
]

function Nav() {
  const navigate = useNavigate()
  return (
    <header className={s.nav}>
      <div className={`${s.container} ${s.navInner}`}>
        <a className={s.brand} href="/" aria-label="Plotline home" onClick={(e) => { e.preventDefault(); navigate('/') }}>
          <img src="/plotline-mark.svg" alt="" />
          <b>Plotline<span className={s.dot}>.</span></b>
        </a>
        <nav className={s.navLinks}>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>Product</a>
          <a href="/pricing" className={s.navLinkActive} onClick={(e) => { e.preventDefault(); navigate('/pricing') }}>Pricing</a>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>Customers</a>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>Docs</a>
        </nav>
        <div className={s.navRight}>
          <Button
            variant="ghost"
            size="sm"
            className={s.signIn}
            onClick={() => navigate('/app')}
          >
            Sign in
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(DEMO)}
          >
            Start free trial
          </Button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  const navigate = useNavigate()
  return (
    <section className={`${s.hero} ${s.container}`}>
      <span className={s.eyebrow}>
        <Ruler size={14} /> Pricing
      </span>
      <h1 className={s.h1}>Simple plans that scale with the crew</h1>
      <p className={s.lede}>
        Start free, upgrade when you’re bidding every week. No setup fees, no
        lock-in — and your first takeoff takes minutes, not hours.
      </p>
      <div className={s.heroNote}>
        <Check size={15} /> No credit card required · Cancel anytime
      </div>
    </section>
  )
}

function PricingTiers() {
  const navigate = useNavigate()
  return (
    <section className={`${s.section} ${s.container}`}>
      <div className={s.pricingGrid}>
        {TIERS.map((tier) => (
          <article
            key={tier.name}
            className={`${s.tier} ${tier.popular ? s.tierPopular : ''}`}
          >
            {tier.popular && (
              <div className={s.popularTag}>
                <Badge variant="brand" dot>
                  Most popular
                </Badge>
              </div>
            )}
            <h3 className={s.tierName}>{tier.name}</h3>
            <p className={s.tierDesc}>{tier.desc}</p>
            <div className={s.tierPrice}>
              <span className={s.tierAmount}>{tier.price}</span>
              <span className={s.tierPer}>{tier.per}</span>
            </div>
            <ul className={s.tierFeatures}>
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
              iconRight={tier.popular ? <ArrowRight size={16} /> : undefined}
              onClick={() => navigate(tier.cta === 'Talk to sales' ? '/app' : DEMO)}
            >
              {tier.cta}
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className={`${s.section} ${s.faqSection}`} id="faq">
      <div className={`${s.container} ${s.faqInner}`}>
        <div className={s.secHead}>
          <span className={s.eyebrowPlain}>Questions</span>
          <h2>Pricing, answered</h2>
          <p>Everything landscape &amp; irrigation contractors ask before they switch from paper.</p>
        </div>
        <div className={s.faqList}>
          {FAQ.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q} className={`${s.faqItem} ${isOpen ? s.faqItemOpen : ''}`}>
                <button
                  className={s.faqQ}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{item.q}</span>
                  <ChevronDown size={18} className={s.faqChevron} />
                </button>
                {isOpen && (
                  <div className={s.faqA}>
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  const navigate = useNavigate()
  return (
    <section className={`${s.section} ${s.finalCta}`}>
      <div className={s.container}>
        <div className={s.finalCtaInner}>
          <h2>Win the bid before lunch.</h2>
          <p>Start measuring in minutes. Your first project is free — no card required.</p>
          <div className={s.finalCtaRow}>
            <Button
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={17} />}
              onClick={() => navigate(DEMO)}
            >
              Start free trial
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/app')}
            >
              Talk to us
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const navigate = useNavigate()
  return (
    <footer className={s.footer}>
      <div className={s.container}>
        <div className={s.footerTop}>
          <div className={s.footerBrandCol}>
            <a className={s.brand} href="/" aria-label="Plotline home" onClick={(e) => { e.preventDefault(); navigate('/') }}>
              <img src="/plotline-mark.svg" alt="" />
              <b>Plotline<span className={s.dot}>.</span></b>
            </a>
            <p>Estimate straight from the plans.</p>
          </div>
          <div className={s.footerCols}>
            <div className={s.footerCol}>
              <h4>Product</h4>
              <ul>
                {['Takeoff tools', 'Live estimate', 'Irrigation', 'Planting', 'Pricing'].map((l) => (
                  <li key={l}>
                    <a href="/" onClick={(e) => { e.preventDefault(); navigate(l === 'Pricing' ? '/pricing' : DEMO) }}>{l}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.footerCol}>
              <h4>Company</h4>
              <ul>
                {['About', 'Customers', 'Careers', 'Blog', 'Contact'].map((l) => (
                  <li key={l}><a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>{l}</a></li>
                ))}
              </ul>
            </div>
            <div className={s.footerCol}>
              <h4>Resources</h4>
              <ul>
                {['Docs', 'Help center', 'API', 'Status', 'Changelog'].map((l) => (
                  <li key={l}><a href="/" onClick={(e) => { e.preventDefault(); navigate('/app') }}>{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className={s.footerBottom}>
          <span className={s.footerCopy}>© 2026 Plotline. Estimate straight from the plans.</span>
          <div className={s.footerSocial}>
            <a href="/" aria-label="Twitter" onClick={(e) => e.preventDefault()}><Twitter size={16} /></a>
            <a href="/" aria-label="LinkedIn" onClick={(e) => e.preventDefault()}><Linkedin size={16} /></a>
            <a href="/" aria-label="GitHub" onClick={(e) => e.preventDefault()}><Github size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function PricingPage() {
  return (
    <div className={s.root}>
      <Nav />
      <main>
        <Hero />
        <PricingTiers />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
