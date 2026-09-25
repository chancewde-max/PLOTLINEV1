// Cross-account cloud sync leaks (L1–L3).
//
// Vite must be started with the dummy Supabase project:
//   VITE_SUPABASE_URL=https://plotline-e2e.supabase.co
//   VITE_SUPABASE_ANON_KEY=test-anon-key
// Every request to that host is intercepted. Debounces are advanced with
// Playwright's fake clock (no fixed sleeps).
const { chromium } = require('playwright')

const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const SUPABASE_URL = 'https://plotline-e2e.supabase.co'
const SUPABASE_STORAGE_KEY = 'sb-plotline-e2e-auth-token'
const SECRET = 'proj-secret-a'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORG_B = 'org-bbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`)
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'content-type': 'application/json',
  }
}

function userRecord(id, email) {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function sessionFor(user) {
  return {
    access_token: `e2e-access-${user.id}`,
    refresh_token: `e2e-refresh-${user.id}`,
    token_type: 'bearer',
    expires_in: 3600,
    // Far future so a fake-clock jump does not look like expiry.
    expires_at: 2_000_000_000,
    user,
  }
}

function eqFilter(url, column) {
  try {
    const raw = new URL(url).searchParams.get(column) || ''
    return raw.replace(/^eq\./, '')
  } catch {
    return ''
  }
}

function secretRow() {
  return {
    projects: {
      [SECRET]: {
        id: SECRET,
        name: 'Secret Alpha Takeoff',
        status: 'estimating',
        client: 'Alpha Client',
        sheetIds: ['sheet-secret-a'],
        proposalVersions: [],
        mtoVersions: [],
      },
    },
    sheets: {
      'sheet-secret-a': {
        id: 'sheet-secret-a',
        projectId: SECRET,
        name: 'Secret Sheet A',
      },
    },
    custom_cats: [],
    company: { name: 'Alpha Co', address: '', phone: '', email: '', logoDataUrl: '' },
    proposal_templates: {},
    mto_templates: {},
    clients: {},
    pdf_assets: {},
    ocr_memory: {},
    phrases: {},
    vendors: [],
  }
}

function isWrite(method) {
  return method === 'POST' || method === 'PATCH' || method === 'PUT'
}

async function authCall(page, action, email) {
  return page.evaluate(async ({ action, email }) => {
    const mod = await import('/src/lib/supabaseClient.js')
    if (!mod.supabase) throw new Error('supabase client is null (dummy env missing)')
    if (action === 'signOut') {
      const { error } = await mod.supabase.auth.signOut()
      if (error) throw new Error(error.message)
      const { data } = await mod.supabase.auth.getSession()
      return data.session?.user?.id || null
    }
    const { data, error } = await mod.supabase.auth.signInWithPassword({
      email,
      password: 'e2e-password',
    })
    if (error) throw new Error(error.message)
    return data.user?.id || null
  }, { action, email })
}

async function localKeysWithSecret(page) {
  return page.evaluate(({ secret, userA }) => {
    const allowed = `plotline-appdata:user:${userA}`
    const hits = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || key === allowed) continue
      const value = localStorage.getItem(key) || ''
      if (value.includes(secret)) hits.push(key)
    }
    return hits
  }, { secret: SECRET, userA: USER_A })
}

// mode: 'switch' (A→B, no null), 'expiry' (A signs out via the client, then B),
// 'fail' (B's snapshot GET returns 500). bOrg: B's active workspace is an org.
async function runCase(browser, { name, mode, bOrg }) {
  const writes = []
  let holdB = null
  let releaseB = () => {}
  if (mode === 'switch') {
    holdB = new Promise((resolve) => { releaseB = resolve })
  }
  const userA = userRecord(USER_A, 'a@plotline.test')
  const userB = userRecord(USER_B, 'b@plotline.test')
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const supabaseHost = new URL(SUPABASE_URL).host
  await ctx.route(`**/*${supabaseHost}/**`, async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders() })
      return
    }
    const url = req.url()
    if (url.includes('/auth/v1/token')) {
      const grant = new URL(url).searchParams.get('grant_type')
      let body = {}
      try { body = JSON.parse(req.postData() || '{}') } catch { /* ignore */ }
      const email = body.email || ''
      const user = email === 'b@plotline.test' || grant === 'refresh_token' && (req.postData() || '').includes(USER_B)
        ? userB
        : userA
      // Password grant for B, refresh for whoever is in the body.
      const next = email === 'b@plotline.test' ? userB : userA
      await route.fulfill({
        status: 200,
        headers: corsHeaders(),
        body: JSON.stringify(sessionFor(grant === 'refresh_token' ? user : next)),
      })
      return
    }
    if (url.includes('/auth/v1/logout')) {
      await route.fulfill({ status: 204, headers: corsHeaders(), body: '' })
      return
    }
    if (url.includes('/auth/v1/user')) {
      await route.fulfill({ status: 200, headers: corsHeaders(), body: JSON.stringify(userA) })
      return
    }
    if (url.includes('/rest/v1/org_members')) {
      const uid = eqFilter(url, 'user_id')
      const rows = uid === USER_B && bOrg
        ? [{
          org_id: ORG_B,
          role: 'admin',
          joined_at: '2026-01-01T00:00:00Z',
          organizations: { name: 'B Team', owner_id: USER_B },
        }]
        : []
      await route.fulfill({ status: 200, headers: corsHeaders(), body: JSON.stringify(rows) })
      return
    }
    if (url.includes('/rest/v1/app_data') || url.includes('/rest/v1/org_data')) {
      if (isWrite(req.method())) {
        writes.push({
          method: req.method(),
          url,
          body: req.postData() || '',
        })
        await route.fulfill({ status: 201, headers: corsHeaders(), body: '{}' })
        return
      }
      const uid = eqFilter(url, 'user_id')
      const oid = eqFilter(url, 'org_id')
      const forB = uid === USER_B || oid === ORG_B
      if (forB && mode === 'fail') {
        await route.fulfill({
          status: 500,
          headers: corsHeaders(),
          body: JSON.stringify({ message: 'permission denied', code: '42501' }),
        })
        return
      }
      if (forB && mode === 'switch') await holdB
      const payload = forB ? null : secretRow()
      await route.fulfill({
        status: 200,
        headers: corsHeaders(),
        body: payload == null ? 'null' : JSON.stringify(payload),
      })
      return
    }
    await route.fulfill({ status: 200, headers: corsHeaders(), body: '{}' })
  })
  await ctx.addInitScript(({ key, session, orgKey, orgId }) => {
    localStorage.setItem(key, JSON.stringify(session))
    if (orgKey && orgId) localStorage.setItem(orgKey, orgId)
  }, {
    key: SUPABASE_STORAGE_KEY,
    session: sessionFor(userA),
    orgKey: bOrg ? null : null,
    orgId: null,
  })
  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  try {
    await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.getByText('Secret Alpha Takeoff').waitFor({ timeout: 15000 })
    // A's real 800ms cloud save, then the local 500ms write. Install the fake
    // clock only after both, so a later runFor cannot replay A's own save.
    await page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/rest/v1/app_data'),
      { timeout: 10000 },
    )
    await page.waitForFunction((secret) => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if ((localStorage.getItem(key) || '').includes(secret)) return true
      }
      return false
    }, SECRET, { timeout: 10000 })
    await page.clock.install()
    if (bOrg) {
      await page.evaluate(({ userB, orgB }) => {
        localStorage.setItem(`plotline-workspace-${userB}`, orgB)
      }, { userB: USER_B, orgB: ORG_B })
    }
    const cut = writes.length
    if (mode === 'expiry') {
      const signedOut = await authCall(page, 'signOut')
      if (signedOut) throw new Error(`expected no session after signOut, still ${signedOut}`)
    }
    const snapTable = bOrg ? '/rest/v1/org_data' : '/rest/v1/app_data'
    const snapMatch = (r) => r.url().includes(snapTable) && r.method() === 'GET'
    const snapSeen = mode === 'switch'
      ? page.waitForRequest(snapMatch, { timeout: 15000 })
      : page.waitForResponse((r) => snapMatch(r.request()), { timeout: 15000 })
    const signedIn = await authCall(page, 'signIn', 'b@plotline.test')
    if (signedIn !== USER_B) throw new Error(`sign-in returned ${signedIn}`)
    // Membership resolution updates orgIdRef before this snapshot request is
    // answered. Timers stay frozen until then, so the 800ms cloud save cannot
    // fire against the previous user's rows early. runFor then flushes the
    // 500ms local save and the 800ms cloud save with no wall-clock sleep.
    await snapSeen
    await page.clock.runFor(3_000)
    if (mode === 'switch') releaseB()
    await page.clock.runFor(3_000)
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    const localHits = await localKeysWithSecret(page)
    const forB = writes.slice(cut).filter((w) =>
      w.body.includes(SECRET) && (w.body.includes(USER_B) || (bOrg && w.body.includes(ORG_B))))
    const pass = forB.length === 0 && localHits.length === 0
    const targets = writes.slice(cut).map((w) => {
      const table = w.url.includes('org_data') ? 'org_data' : 'app_data'
      return `${w.method} ${table}${w.body.includes(SECRET) ? ' SECRET' : ''}`
    })
    record(name, pass,
      `postSwitchWrites=${targets.join(',') || 'none'} forB=${forB.length} localHits=${localHits.join(',') || 'none'} pageErrors=${pageErrors.length}`)
  } catch (err) {
    record(name, false, `threw: ${err.message} pageErrors=${pageErrors.join(' | ') || 'none'}`)
  } finally {
    if (mode === 'switch') releaseB()
    await ctx.close()
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/usr/local/bin/google-chrome',
    headless: true,
  })
  try {
    await runCase(browser, {
      name: 'L1 A→B with no null user does not write A into B',
      mode: 'switch',
      bOrg: false,
    })
    await runCase(browser, {
      name: 'L2 session expiry then B sign-in does not migrate A',
      mode: 'expiry',
      bOrg: false,
    })
    await runCase(browser, {
      name: 'L3 B snapshot failure does not autosave A into B',
      mode: 'fail',
      bOrg: true,
    })
  } finally {
    await browser.close()
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n=== ${failed.length === 0 ? 'ALL PASS' : 'FAILURES: ' + failed.length} / ${results.length} ===`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('SCRIPT ERROR:', err)
  process.exit(2)
})
