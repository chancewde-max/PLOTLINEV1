import React from 'react'
import s from './Skeleton.module.css'

// Base shimmer block. Size it via width/height (number = px, string = as-is)
// or pass a className/style for custom shapes. Respects prefers-reduced-motion.
export function Skeleton({ width, height = 14, radius, style, className }) {
  const px = (v) => (typeof v === 'number' ? `${v}px` : v)
  return (
    <span
      className={`${s.block} ${className || ''}`}
      style={{
        display: 'block',
        width: width != null ? px(width) : '100%',
        height: px(height),
        ...(radius != null ? { borderRadius: px(radius) } : null),
        ...style,
      }}
    />
  )
}

// Full-page fallback for lazy routes: header + sidebar + content card grid.
// Gives the user the shape of the page immediately instead of a spinner.
export function RouteSkeleton() {
  return (
    <div className={s.route} aria-busy="true" aria-label="Loading page">
      <div className={s.routeHeader}>
        <Skeleton width={30} height={30} radius={8} />
        <Skeleton width={120} height={16} />
        <div style={{ flex: 1 }} />
        <Skeleton width={200} height={30} radius={8} />
        <Skeleton width={30} height={30} radius="50%" />
      </div>
      <div className={s.routeBody}>
        <div className={s.routeSidebar}>
          <Skeleton height={34} radius={8} />
          <Skeleton height={20} width="70%" />
          <Skeleton height={20} width="85%" />
          <Skeleton height={20} width="60%" />
          <Skeleton height={20} width="75%" />
        </div>
        <div className={s.routeContent}>
          <Skeleton height={28} width={180} />
          <Skeleton height={16} width={260} />
          <div className={s.cardGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={s.card}>
                <Skeleton height={140} radius={0} />
                <div className={s.cardBody}>
                  <Skeleton height={16} width="80%" />
                  <Skeleton height={12} width="55%" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Matches ProjectsPage: top bar (logo, nav, search, account) + title/stat
// row + project card grid.
export function ProjectsPageSkeleton() {
  return (
    <div className={s.route} aria-busy="true" aria-label="Loading projects">
      <div className={s.routeHeader}>
        <Skeleton width={30} height={30} radius={8} />
        <Skeleton width={90} height={16} />
        <div style={{ flex: 1 }} />
        <Skeleton width={220} height={32} radius={8} />
        <Skeleton width={30} height={30} radius="50%" />
      </div>
      <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={26} width={140} />
            <Skeleton height={14} width={200} />
          </div>
          <div style={{ flex: 1 }} />
          <Skeleton width={150} height={36} radius={8} />
        </div>
        <div className={s.statRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={s.stat}>
              <Skeleton height={12} width="60%" />
              <Skeleton height={22} width="40%" />
            </div>
          ))}
        </div>
        <div className={s.cardGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={s.card}>
              <Skeleton height={150} radius={0} />
              <div className={s.cardBody}>
                <Skeleton height={16} width="70%" />
                <Skeleton height={12} width="45%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Matches ProjectPage: breadcrumb header + title row + pill tabs + stat grid.
export function ProjectPageSkeleton() {
  return (
    <div className={s.route} aria-busy="true" aria-label="Loading project">
      <div className={s.routeHeader}>
        <Skeleton width={30} height={30} radius={8} />
        <Skeleton width={90} height={16} />
        <div style={{ flex: 1 }} />
        <Skeleton width={30} height={30} radius="50%" />
      </div>
      <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <Skeleton height={26} width={260} />
            <Skeleton height={14} width={320} />
          </div>
          <Skeleton width={110} height={34} radius={8} />
          <Skeleton width={110} height={34} radius={8} />
        </div>
        <div className={s.tabsRow}>
          <Skeleton width={90} height={26} radius={7} />
          <Skeleton width={90} height={26} radius={7} />
          <Skeleton width={90} height={26} radius={7} />
        </div>
        <div className={s.statRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={s.stat}>
              <Skeleton height={12} width="60%" />
              <Skeleton height={22} width="40%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Matches SheetPage: toolbar rail + left panel + canvas + right panel.
export function SheetPageSkeleton() {
  return (
    <div className={s.route} aria-busy="true" aria-label="Loading sheet">
      <div className={s.routeHeader}>
        <Skeleton width={30} height={30} radius={8} />
        <Skeleton width={140} height={16} />
        <div style={{ flex: 1 }} />
        <Skeleton width={90} height={30} radius={8} />
        <Skeleton width={30} height={30} radius="50%" />
      </div>
      <div className={s.sheetLayout}>
        <div className={s.sheetToolbar}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} width={34} height={34} radius={8} />
          ))}
        </div>
        <div className={s.sheetSidePanel}>
          <Skeleton height={18} width="60%" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={30} radius={8} />
          ))}
        </div>
        <div className={s.sheetCanvas}>
          <Skeleton width={280} height={200} radius={4} />
        </div>
        <div className={`${s.sheetSidePanel} ${s.sheetSidePanelRight}`}>
          <Skeleton height={18} width="50%" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={30} radius={8} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Skeleton
