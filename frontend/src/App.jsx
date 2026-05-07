import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ChapterPage from './pages/ChapterPage'
import QPaperPage from './pages/QPaperPage'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chapter/:id" element={<ChapterPage />} />
        <Route path="/qpaper" element={<QPaperPage />} />
      </Routes>
    </BrowserRouter>
  )
}
