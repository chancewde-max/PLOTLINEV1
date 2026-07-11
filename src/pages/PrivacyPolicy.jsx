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
const EFFECTIVE_DATE = '[EFFECTIVE-DATE]'

const SECTIONS = [
  { id: 'collect', title: '1. Information we collect' },
  { id: 'store', title: '2. How we store your data' },
  { id: 'cookies', title: '3. Cookies & local storage' },
  { id: 'third', title: '4. Third parties & sub-processors' },
  { id: 'rights', title: '5. Your rights (access, correction, deletion)' },
  { id: 'can-spam', title: '6. Email & CAN-SPAM compliance' },
  { id: 'retention', title: '7. Data retention' },
  { id: 'children', title: '8. Children’s privacy' },
  { id: 'contact', title: '9. Contact us' },
  { id: 'changes', title: '10. Changes to this policy' },
]

export default function PrivacyPolicy() {
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
        <h1 className={s.h1}>Privacy Policy</h1>
        <p className={s.effective}>
          Effective date: <span className={s.placeholder}>{EFFECTIVE_DATE}</span> · Last updated: <span className={s.placeholder}>{EFFECTIVE_DATE}</span>
        </p>

        <nav className={s.toc} aria-label="Table of contents">
          <p className={s.tocTitle}>Contents</p>
          <ol>
            {SECTIONS.map((x) => (
              <li key={x.id}><a href={`#${x.id}`}>{x.title}</a></li>
            ))}
          </ol>
        </nav>

        <section id="collect" className={s.section}>
          <h2>1. Information we collect</h2>
          <p>
            {COMPANY_NAME} (“Plotline”, “we”, “us”) provides takeoff and estimating
            software for landscape and irrigation contractors. We collect the following
            categories of information:
          </p>
          <h3>Account &amp; identity data</h3>
          <ul>
            <li><span className={s.strong}>Email address</span> and sign-in credentials you provide when you create an account (via Supabase Auth).</li>
            <li>Profile information you add (name, company, role) to use the service.</li>
          </ul>
          <h3>Customer content</h3>
          <ul>
            <li><span className={s.strong}>Project data</span> — the takeoffs, measurements, materials lists, estimates, and proposals you create in Plotline.</li>
            <li><span className={s.strong}>Uploaded files</span> — plan sheets you upload (PDFs, images), which may contain drawings, annotations, and any data embedded in those files.</li>
            <li>Billing and subscription status (managed through our payment processor).</li>
          </ul>
          <h3>Usage &amp; technical data</h3>
          <ul>
            <li>Device, browser, and IP address information needed to operate the service and keep it secure.</li>
            <li>Product usage analytics (e.g. which features you use) used to improve Plotline.</li>
          </ul>
        </section>

        <section id="store" className={s.section}>
          <h2>2. How we store your data</h2>
          <p>
            Your account data, project data, and uploaded plan files are stored in
            <span className={s.strong}> cloud infrastructure operated by Supabase</span>
            (a hosted PostgreSQL database and object storage). Authentication tokens are
            issued and verified by Supabase Auth. Data is transmitted over encrypted
            HTTPS/TLS connections.
          </p>
          <p>
            We rely on our hosting and database providers’ security controls (encryption
            at rest and in transit, access logging). You are responsible for the accuracy
            of the data you enter and for safeguarding your account credentials.
          </p>
        </section>

        <section id="cookies" className={s.section}>
          <h2>3. Cookies &amp; local storage</h2>
          <p>
            Plotline uses the following browser storage:
          </p>
          <ul>
            <li>
              <span className={s.strong}>Authentication cookies</span> set by Supabase Auth to keep you signed in
              across sessions and tabs.
            </li>
            <li>
              <span className={s.strong}>Local storage</span> to remember your preferences (such as the
              cookie/storage consent choice you make on this banner), keep a local cache of
              your project data for offline use, and improve performance.
            </li>
          </ul>
          <p>
            These are essential to operate the service and cannot be disabled while you are
            signed in. You can clear local storage and sign out at any time from your
            browser settings; doing so may require you to sign in again and may remove
            locally cached copies of your data.
          </p>
        </section>

        <section id="third" className={s.section}>
          <h2>4. Third parties &amp; sub-processors</h2>
          <p>We share data with vetted service providers who help us run Plotline:</p>
          <ul>
            <li><span className={s.strong}>Supabase</span> — cloud database, authentication, and file storage (our primary data processor).</li>
            <li><span className={s.strong}>Vercel</span> (or your hosting provider) — hosts and serves the Plotline web application.</li>
            <li>Our payment processor (e.g. Stripe) — processes subscription billing. We do not store full card numbers.</li>
            <li>Analytics and error-monitoring providers, used only to operate and improve the service.</li>
          </ul>
          <p>
            We require these providers to process data only on our instructions and under
            contractual confidentiality and security obligations. We do not sell your
            personal information.
          </p>
        </section>

        <section id="rights" className={s.section}>
          <h2>5. Your rights (access, correction, deletion)</h2>
          <p>
            Depending on where you live, you may have rights under laws such as the
            California Consumer Privacy Act (CCPA) and the EU/UK General Data Protection
            Regulation (GDPR), including:
          </p>
          <ul>
            <li>The right to <span className={s.strong}>access</span> the personal data we hold about you.</li>
            <li>The right to <span className={s.strong}>correct</span> inaccurate data.</li>
            <li>The right to <span className={s.strong}>delete</span> your account and associated project data.</li>
            <li>The right to <span className={s.strong}>export</span> your data (where technically feasible).</li>
            <li>The right to <span className={s.strong}>opt out</span> of marketing communications.</li>
          </ul>
          <p>
            To exercise these rights, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            We will verify your identity and respond within the timeframes required by
            applicable law (generally 30 days). You may also delete your account and data
            yourself from within the app’s settings where that feature is available.
          </p>
          <p>
            <span className={s.strong}>Note for California residents:</span> we do not “sell” or “share”
            personal information as those terms are defined under the CCPA. You may request
            disclosure of the categories of personal information collected and disclosed in
            the past 12 months.
          </p>
        </section>

        <section id="can-spam" className={s.section}>
          <h2>6. Email &amp; CAN-SPAM compliance</h2>
          <p>
            If we send you commercial email (product updates, tips, or promotional offers),
            we comply with the CAN-SPAM Act:
          </p>
          <ul>
            <li>We will not use false or misleading “From”, “To”, or subject lines.</li>
            <li>Our promotional emails will identify the message as an advertisement where required.</li>
            <li>Our physical mailing address, {COMPANY_NAME}, will appear in the footer of marketing emails.</li>
            <li>Every marketing email includes a clear, working <span className={s.strong}>unsubscribe</span> link.</li>
            <li>We honor opt-out requests promptly (within 10 business days, as required).</li>
          </ul>
          <p>
            Transactional emails (receipts, security notices, service announcements) are not
            promotional and may still be sent while your account is active.
          </p>
        </section>

        <section id="retention" className={s.section}>
          <h2>7. Data retention</h2>
          <p>
            We retain your account and project data for as long as your account is active.
            When you delete your account, we delete or anonymize your personal data within a
            reasonable period (and in any event within <span className={s.placeholder}>[RETENTION-PERIOD, e.g. 30 days]</span>
            of your deletion request), except where we must retain certain records to comply
            with law, resolve disputes, or enforce our agreements. Backups may contain copies
            for a limited additional retention window.
          </p>
        </section>

        <section id="children" className={s.section}>
          <h2>8. Children’s privacy</h2>
          <p>
            Plotline is a business tool intended for contractors and is not directed to
            children under 16. We do not knowingly collect personal information from
            children. If you believe a child has provided us data, contact us and we will
            delete it.
          </p>
        </section>

        <section id="contact" className={s.section}>
          <h2>9. Contact us</h2>
          <p>
            Questions about this policy or your data? Contact our privacy team at
            <a href={`mailto:${CONTACT_EMAIL}`}> {CONTACT_EMAIL}</a> or by mail at
            {' '}{COMPANY_NAME}.
          </p>
        </section>

        <section id="changes" className={s.section}>
          <h2>10. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be announced
            in the app or by email. The “Effective date” at the top reflects the latest
            version. Continued use after changes take effect constitutes acceptance.
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
