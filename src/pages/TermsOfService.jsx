{/* ============================================================
  TEMPLATE — review by a licensed attorney before production use.
  This is STANDARD BOILERPLATE, not finalized legal advice.
  Replace every [PLACEHOLDER] before publishing. See bottom of file.
  ============================================================ */}
import React from 'react'
import { Link } from 'react-router-dom'
import s from './Legal.module.css'

// [PLACEHOLDER] Fill these in before production.
const COMPANY_NAME = '[YOUR-COMPANY-LEGAL-NAME]'
const CONTACT_EMAIL = '[YOUR-EMAIL]'
const GOVERNING_STATE = '[YOUR-STATE]'
const EFFECTIVE_DATE = '[EFFECTIVE-DATE]'

const SECTIONS = [
  { id: 'accept', title: '1. Acceptance of terms' },
  { id: 'use', title: '2. Acceptable use' },
  { id: 'billing', title: '3. Subscription & billing' },
  { id: 'warranty', title: '4. Disclaimer of warranties' },
  { id: 'liability', title: '5. Limitation of liability' },
  { id: 'estimates', title: '6. Takeoff & estimate accuracy disclaimer' },
  { id: 'term', title: '7. Termination' },
  { id: 'law', title: '8. Governing law' },
  { id: 'changes', title: '9. Changes to these terms' },
  { id: 'contact', title: '10. Contact' },
]

export default function TermsOfService() {
  return (
    <div className={s.page}>
      <div className={s.banner}>
        <div className={s.bannerInner}>
          <span className={s.bannerDot} aria-hidden="true" />
          <span>
            <strong>[TEMPLATE — review by a licensed attorney before production use]</strong>
          </span>
        </div>
      </div>

      <div className={s.shell}>
        <div className={s.eyebrow}>Legal</div>
        <h1 className={s.h1}>Terms of Service</h1>
        <p className={s.effective}>
          Effective date: <span className={s.placeholder}>{EFFECTIVE_DATE}</span>
        </p>

        <nav className={s.toc} aria-label="Table of contents">
          <p className={s.tocTitle}>Contents</p>
          <ol>
            {SECTIONS.map((x) => (
              <li key={x.id}><a href={`#${x.id}`}>{x.title}</a></li>
            ))}
          </ol>
        </nav>

        <section id="accept" className={s.section}>
          <h2>1. Acceptance of terms</h2>
          <p>
            These Terms of Service (“Terms”) govern your use of the Plotline software
            provided by {COMPANY_NAME} (“Plotline”, “we”, “us”). By creating an account or
            using the service, you agree to these Terms. If you use Plotline on behalf of a
            company, you represent that you are authorized to bind that organization.
          </p>
        </section>

        <section id="use" className={s.section}>
          <h2>2. Acceptable use</h2>
          <p>You agree to use Plotline only for lawful business purposes. You will not:</p>
          <ul>
            <li>Reverse engineer, copy, or resell the service except as expressly permitted.</li>
            <li>Use the service to infringe others’ intellectual property or contractual rights.</li>
            <li>Upload unlawful, malicious, or infringing material.</li>
            <li>Attempt to disrupt, overload, or gain unauthorized access to the service or its infrastructure.</li>
            <li>Share your account credentials or let others use your seat beyond your plan’s allowance.</li>
          </ul>
          <p>
            We may suspend or terminate accounts that violate these Terms. You retain
            ownership of the content you create; we retain ownership of the Plotline software
            and brand.
          </p>
        </section>

        <section id="billing" className={s.section}>
          <h2>3. Subscription &amp; billing</h2>
          <p>
            Paid plans are billed in advance on a recurring basis (monthly or annually, as
            chosen at checkout). Except for the free Starter plan:
          </p>
          <ul>
            <li><span className={s.strong}>Auto-renewal:</span> your subscription renews automatically at the end of each billing period until you cancel.</li>
            <li><span className={s.strong}>Price &amp; frequency:</span> the current price and billing frequency are shown on the pricing page at the time of purchase and in your account/billing portal.</li>
            <li><span className={s.strong}>How to cancel:</span> you may cancel anytime from your account settings or by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Cancellation stops future renewals; you keep access until the end of the paid period.</li>
            <li><span className={s.strong}>Free trials:</span> trials convert to a paid plan automatically at the end of the trial unless cancelled first. We will disclose trial length and conversion terms at sign-up.</li>
            <li>Fees are non-refundable except where required by law. Prices may change with notice; changes apply to subsequent billing periods.</li>
          </ul>
        </section>

        <section id="warranty" className={s.section}>
          <h2>4. Disclaimer of warranties</h2>
          <p>
            THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY
            KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the service will be
            uninterrupted, error-free, or that measurements will be accurate for every plan
            or condition.
          </p>
        </section>

        <section id="liability" className={s.section}>
          <h2>5. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY_NAME} SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY
            LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS ARISING FROM YOUR USE OF THE SERVICE.
            Our total aggregate liability shall not exceed the amount you paid us in the
            twelve (12) months preceding the claim.
          </p>
        </section>

        <section id="estimates" className={s.section}>
          <h2>6. Takeoff &amp; estimate accuracy disclaimer</h2>
          <p>
            <span className={s.strong}>Plotline produces estimates and measurements, not certified quantities.</span>
            Output depends on the scale you set, the accuracy of the uploaded plan, and how
            you trace the drawing. The software is a tool to assist your takeoff — it does
            not verify field conditions, subsurface utility locations, or the completeness
            of the architect’s plans.
          </p>
          <p>
            <span className={s.strong}>YOU ARE SOLELY RESPONSIBLE</span> for verifying all quantities, dimensions,
            and counts before relying on them in a bid, proposal, or construction document.
            Always field-verify critical measurements. {COMPANY_NAME} is not responsible for
            cost overruns, change orders, or losses arising from errors, omissions, or
            assumptions in any takeoff or estimate produced with the service.
          </p>
        </section>

        <section id="term" className={s.section}>
          <h2>7. Termination</h2>
          <p>
            You may stop using Plotline at any time. We may suspend or terminate your access
            for material breach of these Terms, non-payment, or unlawful use, with or without
            notice where the law allows. Upon termination, your right to use the service
            ends; sections that by nature survive (liability, disclaimers, IP) remain in
            effect. You may export or delete your data before termination as described in our
            Privacy Policy.
          </p>
        </section>

        <section id="law" className={s.section}>
          <h2>8. Governing law</h2>
          <p>
            These Terms are governed by the laws of the State of <span className={s.placeholder}>{GOVERNING_STATE}</span>,
            without regard to its conflict-of-laws rules. The parties submit to the
            exclusive jurisdiction of the state and federal courts located in <span className={s.placeholder}>{GOVERNING_STATE}</span>.
          </p>
        </section>

        <section id="changes" className={s.section}>
          <h2>9. Changes to these terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be announced
            in the app or by email. The “Effective date” at the top reflects the latest
            version. Continued use after changes take effect constitutes acceptance.
          </p>
        </section>

        <section id="contact" className={s.section}>
          <h2>10. Contact</h2>
          <p>
            Questions about these Terms? Contact us at
            <a href={`mailto:${CONTACT_EMAIL}`}> {CONTACT_EMAIL}</a> or by mail at
            {' '}{COMPANY_NAME}.
          </p>
        </section>
      </div>

      <nav className={s.footerNav} aria-label="Legal">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
        <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
      </nav>
    </div>
  )
}
