import { Routes, Route, Navigate } from 'react-router-dom'
import ProjectsPage from './pages/ProjectsPage.jsx'
import ProjectPage from './pages/ProjectPage.jsx'
import SheetPage from './pages/SheetPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/project/:projectId" element={<ProjectPage />} />
      <Route path="/project/:projectId/sheet/:sheetId" element={<SheetPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
