import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = ({ notifications = [] }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  
  return (
    <nav className="bg-black border-b border-orange-600 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-3">
          <div className="flex items-center">
            <Link to="/" className="relative flex items-center">
              {/* Hexagon Logo */}
              <div className="mr-3 w-10 h-10 flex items-center justify-center">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                  <g fill="none" stroke="#FF8C00" strokeWidth="3">
                    <polygon points="50,10 90,30 90,70 50,90 10,70 10,30" />
                    <polygon points="50,20 80,35 80,65 50,80 20,65 20,35" />
                    <polygon points="50,30 70,40 70,60 50,70 30,60 30,40" />
                    <polygon points="50,40 60,45 60,55 50,60 40,55 40,45" />
                  </g>
                </svg>
              </div>
              
              {/* Text Logo */}
              <div className="flex flex-col">
                <span className="text-xl font-bold text-orange-500 font-mono tracking-wider">
                  ShopForge
                </span>
                <span className="text-xs text-gray-400 font-mono -mt-1">MANUFACTURING CONTROL</span>
              </div>
            </Link>
            
            <div className="ml-10 hidden md:flex space-x-6">
              <NavLink to="/">MISSION CONTROL</NavLink>
              <NavLink to="/upload-po">UPLOAD MISSION</NavLink>
              <NavLink to="/schedule">SCHEDULE</NavLink>
              <NavLink to="/parts">PARTS LIBRARY</NavLink>
              <NavLink to="/settings">SHOP SETTINGS</NavLink>
            </div>
          </div>
          
          <div className="flex items-center">
            <Link to="/settings" className="mr-4 md:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
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
            
            {/* Status indicator */}
            <div className="ml-4 flex items-center">
              <div className="h-2 w-2 rounded-full bg-green-500 mr-1"></div>
              <span className="text-xs font-mono text-gray-400">ONLINE</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Custom NavLink component with active state handling
const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to || 
                  (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to} 
      className={`text-white relative font-mono group overflow-hidden ${
        isActive ? 'text-orange-500' : 'hover:text-orange-400'
      }`}
    >
      <span className="relative z-10">{children}</span>
      <span 
        className={`absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 transform origin-left transition-transform duration-300 ${
          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
        }`}
      ></span>
    </Link>
  );
};

export default Navbar; 