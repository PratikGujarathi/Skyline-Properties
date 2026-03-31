import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { ProtectedRoute } from './ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Admin } from './pages/Admin';
import { Wishlist } from './pages/Wishlist';
import { Chats } from './pages/Chats';
import { HomePage } from './pages/Home';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-950 transition-colors duration-300">
              <Navbar />
              <main className="flex-grow">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  
                  <Route 
                    path="/dashboard" 
                    element={
                      <ProtectedRoute requiredRole="USER">
                        <Dashboard />
                      </ProtectedRoute>
                    } 
                  />

                  <Route 
                    path="/wishlist" 
                    element={
                      <ProtectedRoute requiredRole="USER">
                        <Wishlist />
                      </ProtectedRoute>
                    } 
                  />

                  <Route 
                    path="/chats" 
                    element={
                      <ProtectedRoute>
                        <Chats />
                      </ProtectedRoute>
                    } 
                  />
                  
                  <Route 
                    path="/admin" 
                    element={
                      <ProtectedRoute requiredRole="AGENT">
                        <Admin />
                      </ProtectedRoute>
                    } 
                  />

                  {/* Catch all redirect */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
              <Toaster position="top-right" richColors />
            </div>
          </Router>
        </AuthProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
