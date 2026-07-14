import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import { AppDataProvider } from './data/useAppData.jsx'
import { SettingsProvider } from './data/useSettings.jsx'
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx'
import { AuthModal } from './auth/AuthModal.jsx'
import { RouteSkeleton } from './components/Skeleton.jsx'
import ConsentBanner from './components/ConsentBanner.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import TermsOfService from './pages/TermsOfService.jsx'

// Lazy-load the pdf-heavy route components so pdf.js / tesseract are not in the
// initial bundle. SheetPage pulls in pdfjs-dist (and tesseract.js), so it is the
// most important one to split out.
const LazySheetPage = lazy(() => import('./pages/SheetPage.jsx'))
const LazyProjectPage = lazy(() => import('./pages/ProjectPage.jsx'))
const LazyProjectsPage = lazy(() => import('./pages/ProjectsPage.jsx'))
const LazyPricingPage = lazy(() => import('./pages/PricingPage.jsx'))
const LazyAcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage.jsx'))

function SheetPageKeyed() {
  const { sheetId } = useParams()
  return <LazySheetPage key={sheetId} />
}

// Single global auth modal, driven by AuthProvider's open-state so any CTA
// (e.g. the landing "Sign in") can open it via useAuth().openAuth().
function AuthModalMount() {
  const { authOpen, closeAuth } = useAuth()
  return <AuthModal open={authOpen} onClose={closeAuth} />
}

export default function App() {
  return (
    <SettingsProvider>
      <AppDataProvider>
        <AuthProvider>
          {/* Marketing landing page owns '/'. The app shell (ProjectsPage and below)
              was moved under '/app' so the public route stays clean. LandingPage is
              eager-loaded (no pdf/tesseract deps) for a fast first paint. */}
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/pricing" element={
              <Suspense fallback={<RouteSkeleton />}>
                <LazyPricingPage />
              </Suspense>
            } />
            <Route path="/app" element={
              <Suspense fallback={<RouteSkeleton />}>
                <LazyProjectsPage />
              </Suspense>
            } />
            <Route path="/app/project/:projectId" element={
              <Suspense fallback={<RouteSkeleton />}>
                <LazyProjectPage />
              </Suspense>
            } />
            <Route path="/app/project/:projectId/sheet/:sheetId" element={
              <Suspense fallback={<RouteSkeleton />}>
                <SheetPageKeyed />
              </Suspense>
            } />
            <Route path="/invite/:token" element={
              <Suspense fallback={<RouteSkeleton />}>
                <LazyAcceptInvitePage />
              </Suspense>
            } />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
          <AuthModalMount />
          <ConsentBanner />
        </AuthProvider>
      </AppDataProvider>
    </SettingsProvider>
  )
}
