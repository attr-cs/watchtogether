import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import { useEffect } from 'react';
import { getActiveRoom } from './utils/roomStorage';

// Create a separate component for the routes that needs navigation
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const activeRoom = getActiveRoom();
    if (activeRoom && location.pathname === '/') {
      navigate(`/room/${activeRoom}`);
    }
  }, [navigate, location]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomCode" element={<Room />} />
    </Routes>
  );
}

// Main App component
function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;