import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage.jsx'
import ProjectPage from './pages/ProjectPage.jsx'
import SheetPage from './pages/SheetPage.jsx'
import { AppDataProvider } from './data/useAppData.jsx'
import { SettingsProvider } from './data/useSettings.jsx'

function SheetPageKeyed() {
  const { sheetId } = useParams()
  return <SheetPage key={sheetId} />
}

export default function App() {
  return (
    <SettingsProvider>
      <AppDataProvider>
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/project/:projectId" element={<ProjectPage />} />
          <Route path="/project/:projectId/sheet/:sheetId" element={<SheetPageKeyed />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppDataProvider>
    </SettingsProvider>
  )
}
