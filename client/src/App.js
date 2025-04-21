import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import io from 'socket.io-client';
import { initializeTheme, getSystemTheme } from './utils/themeManager';

// Pages
import Dashboard from './pages/Dashboard';
import POUpload from './pages/POUpload';
import PODetails from './pages/PODetails';
import ShopSettings from './pages/ShopSettings';
import Parts from './pages/Parts';
import PartDetails from './pages/PartDetails';
import Schedule from './pages/Schedule';
import JobReport from './pages/JobReport';

// Components
import Navbar from './components/Navbar';

function App() {
  const [socketConnected, setSocketConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io('http://localhost:5001');
    
    socket.on('connect', () => {
      console.log('Connected to server');
      setSocketConnected(true);
    });
    
    socket.on('new-po', (data) => {
      console.log('New PO received:', data);
      setNotifications(prev => [
        { id: Date.now(), message: `New PO received: ${data.poNumber}`, type: 'success' },
        ...prev
      ]);
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setSocketConnected(false);
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);

  // Initialize theme on app start - use system theme as default
  useEffect(() => {
    try {
      const systemTheme = getSystemTheme();
      initializeTheme(systemTheme);
    } catch (error) {
      console.error('Error initializing theme:', error);
      // Fallback to dark theme if there's an error
      initializeTheme('dark');
    }
  }, []);
  
  return (
    <Router>
      <div className="App min-h-screen flex flex-col">
        <Navbar notifications={notifications} />
        <div className="container mx-auto px-4 py-8 flex-grow">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/po/:id" element={<PODetails />} />
            <Route path="/upload-po" element={<POUpload />} />
            <Route path="/job-report/:id" element={<JobReport />} />
            <Route path="/settings" element={<ShopSettings />} />
            <Route path="/parts" element={<Parts />} />
            <Route path="/parts/:id" element={<PartDetails />} />
          </Routes>
        </div>
        <div className={`fixed bottom-4 right-4 p-3 rounded-lg font-mono text-xs ${socketConnected ? 'bg-green-800 text-green-200 glow-effect' : 'bg-red-800 text-red-200'}`}>
          {socketConnected ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
        </div>
      </div>
    </Router>
  );
}

export default App; 