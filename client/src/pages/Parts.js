import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Parts = () => {
  const [parts, setParts] = useState([]);
  const [filteredParts, setFilteredParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Fetch parts from backend
    const fetchParts = async () => {
      try {
        const response = await axios.get('/api/parts');
        setParts(response.data);
        setFilteredParts(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching parts:', err);
        setError(`Failed to load parts: ${err.response?.data?.error || err.message}`);
        setShowErrorPopup(true);
        setLoading(false);
      }
    };
    
    fetchParts();
  }, []);

  useEffect(() => {
    // Apply filters and search
    let result = [...parts];
    
    // Apply machine type filter
    if (filter !== 'all') {
      result = result.filter(part => part.machine === filter);
    }
    
    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(part => 
        part.partNumber.toLowerCase().includes(searchLower) ||
        part.description.toLowerCase().includes(searchLower) ||
        (part.revision && part.revision.toLowerCase().includes(searchLower)) ||
        (part.materialType && part.materialType.toLowerCase().includes(searchLower))
      );
    }
    
    setFilteredParts(result);
  }, [search, filter, parts]);

  const handleDeletePart = async (id) => {
    if (window.confirm('Are you sure you want to delete this part?')) {
      try {
        await axios.delete(`/api/parts/${id}`);
        // Remove from state
        setParts(parts.filter(part => part.id !== id));
      } catch (err) {
        console.error('Error deleting part:', err);
        setError(`Failed to delete part: ${err.response?.data?.error || err.message}`);
        setShowErrorPopup(true);
      }
    }
  };

  // Handle closing the error popup
  const handleDismissError = () => {
    setShowErrorPopup(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 glow-effect"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">PARTS LIBRARY</h1>
        <Link to="/parts/new" className="btn btn-primary glow-effect font-mono">
          <span className="mr-2">+</span> NEW PART
        </Link>
      </div>

      {/* Search and Filter Controls */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text">SEARCH</span>
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              placeholder="Search by part #, description, material..."
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">MACHINE FILTER</span>
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="select"
            >
              <option value="all">All Machines</option>
              <option value="3 Axis Mill">3 Axis Mill</option>
              <option value="4th Axis Mill">4th Axis Mill</option>
              <option value="Lathe">Lathe</option>
              <option value="Outside Vendor">Outside Vendor</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div className="form-control flex items-end">
            <div className="text-orange-400 font-mono mb-2">
              {filteredParts.length} {filteredParts.length === 1 ? 'part' : 'parts'} found
            </div>
          </div>
        </div>
      </div>

      {/* Parts Table */}
      {filteredParts.length === 0 ? (
        <div className="card p-12 text-center">
          <h3 className="text-xl font-mono text-gray-400 mb-2">NO PARTS FOUND</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">PART #</th>
                <th className="text-left">REV</th>
                <th className="text-left">DESCRIPTION</th>
                <th className="text-left">MATERIAL</th>
                <th className="text-left">MACHINE</th>
                <th className="text-center">CYCLE TIME (MIN)</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map(part => (
                <tr key={part.id} className="hover:bg-gray-800">
                  <td className="font-mono">
                    <Link to={`/parts/${part.id}`} className="hover:text-orange-400">
                      {part.partNumber}
                    </Link>
                  </td>
                  <td>{part.revision}</td>
                  <td className="max-w-xs truncate">{part.description}</td>
                  <td>{part.materialType}</td>
                  <td>{part.machine}</td>
                  <td className="text-center">{part.cycleTime ? `${Math.round(part.cycleTime)} min` : '-'}</td>
                  <td className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Link 
                        to={`/parts/${part.id}`} 
                        className="text-blue-400 hover:text-blue-300"
                        title="View details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => handleDeletePart(part.id)}
                        className="text-red-500 hover:text-red-400"
                        title="Delete part"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error Popup */}
      {showErrorPopup && error && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-gray-900 border border-red-700 text-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-red-500">Error!</h3>
              <button 
                onClick={handleDismissError}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-6">{error}</p>
            <div className="flex justify-end">
              <button
                onClick={handleDismissError}
                className="btn btn-primary glow-effect"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Parts; 