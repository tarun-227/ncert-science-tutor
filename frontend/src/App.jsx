import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import LandingPage from './pages/LandingPage'
import ChapterPage from './pages/ChapterPage'
import QPaperPage from './pages/QPaperPage'
import './index.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={
            <ProtectedRoute><LandingPage /></ProtectedRoute>
          } />
          <Route path="/chapter/:id" element={
            <ProtectedRoute><ChapterPage /></ProtectedRoute>
          } />
          <Route path="/qpaper" element={
            <ProtectedRoute><QPaperPage /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
