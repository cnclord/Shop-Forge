import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ notifications = [] }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  
  return (
    <nav className="bg-black border-b border-orange-600 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-orange-500 font-mono tracking-wider glow-effect">SHOP_MASTER</Link>
            <div className="ml-10 hidden md:flex space-x-6">
              <Link to="/" className="text-white hover:text-orange-500 transition-colors uppercase font-mono">Mission Control</Link>
              <Link to="/upload-po" className="text-white hover:text-orange-500 transition-colors uppercase font-mono">Upload Mission</Link>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="relative p-2 rounded-md hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.length > 0 && (
                  <span className="absolute top-0 right-0 bg-orange-600 text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {notifications.length}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-gray-900 rounded-md shadow-lg overflow-hidden z-10 border border-orange-600">
                  <div className="p-2 bg-black border-b border-orange-600">
                    <h3 className="text-sm font-medium text-orange-500 uppercase font-mono">System Alerts</h3>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-sm text-gray-400 font-mono">NO ALERTS DETECTED</div>
                    ) : (
                      notifications.map(notification => (
                        <div key={notification.id} className="p-3 border-b border-gray-800 hover:bg-gray-800">
                          <p className="text-sm text-gray-200 font-mono">{notification.message}</p>
                          <p className="text-xs text-orange-400 mt-1 font-mono">
                            {new Date(notification.id).toLocaleTimeString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 