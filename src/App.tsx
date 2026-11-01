import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { VisualEditorPage } from './pages/VisualEditorPage'
import { SheetEditorPage } from './pages/SheetEditorPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor/visual/:id" element={<VisualEditorPage />} />
        <Route path="/editor/sheet/:id" element={<SheetEditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
