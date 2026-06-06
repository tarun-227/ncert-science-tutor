import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import AppShell from './pages/AppShell'
import QPaperPage from './pages/QPaperPage'
import './index.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/qpaper" element={
            <ProtectedRoute><QPaperPage /></ProtectedRoute>
          } />
          <Route path="/*" element={
            <ProtectedRoute><AppShell /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
