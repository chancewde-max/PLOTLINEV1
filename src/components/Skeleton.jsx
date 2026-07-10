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

export default Skeleton
