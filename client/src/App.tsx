import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';
import Player from './pages/Player';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <div className="bg-mesh min-h-screen text-primary transition-colors duration-300">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Player />} />
          <Route path="/play" element={<Player />} />
          <Route path="/admin/dashboard" element={
            <ErrorBoundary fallbackMessage="The Admin Dashboard encountered an unexpected error.">
              <Admin />
            </ErrorBoundary>
          } />
          <Route path="/admin/login" element={<AdminLogin />} />
          {/* Fallback any unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
