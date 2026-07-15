import React, { useState, useEffect, useCallback } from 'react'
import { UserPlus, Copy, Check, X, Crown, LogOut, Link as LinkIcon } from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Avatar } from '../components/ui/Avatar.jsx'
import { Input } from '../components/ui/Input.jsx'
import { Dialog } from '../components/ui/Dialog.jsx'
import { Select } from '../components/ui/Select.jsx'
import { Tabs } from '../components/ui/Tabs.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useAppData } from '../data/useAppData.jsx'
import { STATUS_LABEL, STATUS_VARIANT } from '../data/sampleData.js'
import {
  listOrgMembers,
  listOrgInvites,
  inviteMember,
  revokeInvite,
  removeMember,
  changeMemberRole,
  inviteLink,
} from '../data/orgSync.js'
import s from './TeamTab.module.css'

function tokenFromInput(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const parts = trimmed.split('/').filter(Boolean)
  return parts[parts.length - 1]
}

export default function TeamTab() {
  const {
    user, cloudEnabled, openAuth,
    memberships, orgId, orgRole, orgName, orgLoading, isOrgAdmin,
    switchWorkspace, createOrganization, acceptInvite, leaveOrganization,
  } = useAuth()
  const { projects, updateProject } = useAppData()

  if (!cloudEnabled) {
    return (
      <div className={s.notice}>
        Team features need cloud sync configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> to enable teams, invites, and shared projects.
      </div>
    )
  }

  if (!user) {
    return (
      <div className={s.notice}>
        <p style={{ margin: '0 0 12px' }}>Sign in to create a team or accept an invite.</p>
        <Button variant="primary" onClick={() => openAuth('signin')}>Sign in</Button>
      </div>
    )
  }

  if (orgLoading) {
    return <div className={s.notice}>Loading your team…</div>
  }

  if (!orgId) {
    return (
      <NoOrgState
        memberships={memberships}
        switchWorkspace={switchWorkspace}
        createOrganization={createOrganization}
        acceptInvite={acceptInvite}
      />
    )
  }

  return (
    <OrgState
      user={user}
      orgId={orgId}
      orgRole={orgRole}
      orgName={orgName}
      isOrgAdmin={isOrgAdmin}
      leaveOrganization={leaveOrganization}
      projects={projects}
      updateProject={updateProject}
    />
  )
}

// ---------------------------------------------------------------------------

function NoOrgState({ memberships, switchWorkspace, createOrganization, acceptInvite }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const [linkInput, setLinkInput] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinErr, setJoinErr] = useState(null)

  const create = async () => {
    if (!name.trim()) return
    setBusy(true); setErr(null)
    try {
      await createOrganization(name.trim())
    } catch (e) {
      setErr(e?.message || 'Could not create team')
    } finally {
      setBusy(false)
    }
  }

  const join = async () => {
    const token = tokenFromInput(linkInput)
    if (!token) return
    setJoinBusy(true); setJoinErr(null)
    try {
      await acceptInvite(token)
    } catch (e) {
      setJoinErr(e?.message || 'Could not accept invite')
    } finally {
      setJoinBusy(false)
    }
  }

  return (
    <div>
      {memberships.length > 0 && (
        <div className={s.card} style={{ maxWidth: 880, marginBottom: 16 }}>
          <div className={s.cardTitle}>Your teams</div>
          <p className={s.cardHint}>
            You're currently viewing your personal projects. Switch to a team to see its shared projects.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {memberships.map(m => (
              <div key={m.org_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-strong)' }}>{m.name}</span>
                  <Badge variant={m.role === 'admin' ? 'brand' : 'neutral'}>{m.role === 'admin' ? 'Admin' : 'Member'}</Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={() => switchWorkspace(m.org_id)}>Switch</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={s.grid2}>
      <div className={s.card}>
        <div className={s.cardTitle}>Create a team</div>
        <p className={s.cardHint}>
          Projects, sheets, and categories become shared with everyone you invite.
          You'll be the team admin.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Team name"
            placeholder="Hilltop Landscaping…"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          {err && <div className={s.error}>{err}</div>}
          <Button variant="primary" onClick={create} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create team'}
          </Button>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.cardTitle}>Have an invite link?</div>
        <p className={s.cardHint}>
          Paste the invite link (or just the code) your team admin sent you.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Invite link"
            placeholder="https://…/invite/…"
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
          />
          {joinErr && <div className={s.error}>{joinErr}</div>}
          <Button variant="secondary" iconLeft={<LinkIcon size={15} />} onClick={join} disabled={joinBusy || !linkInput.trim()}>
            {joinBusy ? 'Joining…' : 'Join team'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function OrgState({ user, orgId, orgRole, orgName, isOrgAdmin, leaveOrganization, projects, updateProject }) {
  const [subTab, setSubTab] = useState('members')
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loadingRoster, setLoadingRoster] = useState(true)

  const refreshRoster = useCallback(async () => {
    setLoadingRoster(true)
    const [m, i] = await Promise.all([listOrgMembers(orgId), listOrgInvites(orgId)])
    setMembers(m)
    setInvites(i)
    setLoadingRoster(false)
  }, [orgId])

  useEffect(() => { refreshRoster() }, [refreshRoster])

  return (
    <div>
      <div className={s.headerRow}>
        <div>
          <div className={s.orgName}>{orgName}</div>
          <div className={s.orgSub}>
            {members.length} {members.length === 1 ? 'member' : 'members'} ·{' '}
            <Badge variant={isOrgAdmin ? 'brand' : 'neutral'}>{orgRole === 'admin' ? 'Admin' : 'Member'}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" iconLeft={<LogOut size={14} />} onClick={() => {
          if (window.confirm(`Leave ${orgName}? You'll go back to your personal workspace.`)) {
            leaveOrganization()
          }
        }}>
          Leave team
        </Button>
      </div>

      <div className={s.subnav}>
        <Tabs
          variant="pill"
          items={[
            { value: 'members', label: 'Members', count: members.length },
            { value: 'pipeline', label: 'Pipeline', count: Object.keys(projects).length },
          ]}
          value={subTab}
          onChange={setSubTab}
        />
      </div>

      {subTab === 'members' ? (
        <MembersPanel
          orgId={orgId}
          user={user}
          isOrgAdmin={isOrgAdmin}
          members={members}
          invites={invites}
          loading={loadingRoster}
          onChanged={refreshRoster}
        />
      ) : (
        <PipelinePanel
          members={members}
          projects={projects}
          updateProject={updateProject}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function MembersPanel({ orgId, user, isOrgAdmin, members, invites, loading, onChanged }) {
  const [inviteDlgOpen, setInviteDlgOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteErr, setInviteErr] = useState(null)
  const [freshLink, setFreshLink] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const openInviteDlg = () => {
    setInviteEmail(''); setInviteRole('member'); setInviteErr(null); setFreshLink(null)
    setInviteDlgOpen(true)
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteErr(null)
    try {
      const inv = await inviteMember(orgId, inviteEmail.trim(), inviteRole, user.id)
      setFreshLink(inv)
      onChanged()
    } catch (e) {
      setInviteErr(e?.message || 'Could not send invite')
    } finally {
      setInviting(false)
    }
  }

  const copy = async (token, key) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token))
      setCopiedId(key)
      setTimeout(() => setCopiedId(c => (c === key ? null : c)), 1500)
    } catch { /* clipboard unavailable */ }
  }

  const doRevoke = async (inviteId) => {
    await revokeInvite(inviteId).catch(() => {})
    onChanged()
  }

  const doRemove = async (userId) => {
    if (!window.confirm('Remove this teammate from the team?')) return
    await removeMember(orgId, userId).catch(() => {})
    onChanged()
  }

  const doChangeRole = async (userId, role) => {
    await changeMemberRole(orgId, userId, role).catch(() => {})
    onChanged()
  }

  return (
    <div>
      {isOrgAdmin && (
        <div className={s.toolbar}>
          <Button variant="primary" size="sm" iconLeft={<UserPlus size={14} />} onClick={openInviteDlg}>
            Invite teammate
          </Button>
        </div>
      )}

      <div className={s.card} style={{ padding: 0 }}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
              {isOrgAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id}>
                <td>
                  <div className={s.memberCell}>
                    <Avatar name={m.full_name || m.email || 'Member'} size="sm" />
                    <div>
                      <div>{m.full_name || m.email}{m.user_id === user.id ? ' (you)' : ''}</div>
                      {m.full_name && <div className={s.mutedCell} style={{ fontSize: 12 }}>{m.email}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  {isOrgAdmin && m.user_id !== user.id ? (
                    <Select
                      size="sm"
                      value={m.role}
                      onChange={e => doChangeRole(m.user_id, e.target.value)}
                      options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]}
                    />
                  ) : (
                    <Badge variant={m.role === 'admin' ? 'brand' : 'neutral'}>
                      {m.role === 'admin' && <Crown size={11} style={{ marginRight: 4, verticalAlign: -1 }} />}
                      {m.role === 'admin' ? 'Admin' : 'Member'}
                    </Badge>
                  )}
                </td>
                <td className={s.mutedCell}>{new Date(m.joined_at).toLocaleDateString()}</td>
                {isOrgAdmin && (
                  <td>
                    {m.user_id !== user.id && (
                      <button className={s.iconBtn} title="Remove" onClick={() => doRemove(m.user_id)}>
                        <X size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!loading && members.length === 0 && (
              <tr><td colSpan={4} className={s.mutedCell}>No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isOrgAdmin && invites.length > 0 && (
        <>
          <div className={s.sectionLabel}>Pending invites</div>
          <div className={s.card} style={{ padding: 0 }}>
            <table className={s.table}>
              <thead>
                <tr><th>Email</th><th>Role</th><th>Sent</th><th /></tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td><Badge variant="neutral">{inv.role === 'admin' ? 'Admin' : 'Member'}</Badge></td>
                    <td className={s.mutedCell}>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className={s.iconBtn} title="Copy invite link" onClick={() => copy(inv.token, inv.id)}>
                          {copiedId === inv.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button className={s.iconBtn} title="Revoke" onClick={() => doRevoke(inv.id)}>
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog
        open={inviteDlgOpen}
        onClose={() => setInviteDlgOpen(false)}
        title="Invite a teammate"
        description="There's no email server hooked up yet, so send the link yourself (text, Slack, email — whatever's easiest)."
        width={440}
        footer={freshLink ? (
          <Button variant="primary" onClick={() => setInviteDlgOpen(false)}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setInviteDlgOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? 'Creating…' : 'Create invite link'}
            </Button>
          </>
        )}
      >
        {freshLink ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Invite created for <b>{freshLink.email}</b>. Copy this link and send it to them:
            </div>
            <div className={s.linkBox}>
              <span className={s.linkText}>{inviteLink(freshLink.token)}</span>
              <button className={s.iconBtn} onClick={() => copy(freshLink.token, 'fresh')}>
                {copiedId === 'fresh' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Email"
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <Select
              label="Role"
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]}
            />
            {inviteErr && <div className={s.error}>{inviteErr}</div>}
          </div>
        )}
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------

function PipelinePanel({ members, projects, updateProject }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')

  const memberByIdLabel = Object.fromEntries(members.map(m => [m.user_id, m.full_name || m.email]))
  const list = Object.values(projects).filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (assigneeFilter === 'unassigned' && p.assignedTo) return false
    if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && p.assignedTo !== assigneeFilter) return false
    return true
  })

  return (
    <div>
      <div className={s.toolbar}>
        <Select
          size="sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'bid_sent', label: 'Bid sent' },
            { value: 'won', label: 'Won' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        <Select
          size="sm"
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'unassigned', label: 'Unassigned' },
            ...members.map(m => ({ value: m.user_id, label: m.full_name || m.email })),
          ]}
        />
      </div>

      <div className={s.card} style={{ padding: 0 }}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Status</th>
              <th>Bid value</th>
              <th>Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className={s.mutedCell}>{p.client || '—'}</td>
                <td>
                  <Badge variant={STATUS_VARIANT[p.status] || 'neutral'}>
                    {STATUS_LABEL[p.status] || p.status}
                  </Badge>
                </td>
                <td className={s.mutedCell}>{p.bidValue ? `$${p.bidValue.toLocaleString()}` : '—'}</td>
                <td>
                  <Select
                    size="sm"
                    value={p.assignedTo || ''}
                    onChange={e => updateProject(p.id, { assignedTo: e.target.value || null })}
                    options={[
                      { value: '', label: 'Unassigned' },
                      ...members.map(m => ({ value: m.user_id, label: memberByIdLabel[m.user_id] })),
                    ]}
                  />
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className={s.mutedCell}>No projects match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
