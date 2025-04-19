import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const PartDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [part, setPart] = useState({
    id: '',
    partNumber: '',
    revision: '',
    description: '',
    materialType: '',
    materialSpec: '',
    cycleTime: 0,
    setup: 0,
    machine: '',
    notes: '',
    images: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState({ message: '', isError: false });
  const [isEditing, setIsEditing] = useState(false);
  const [shopSettings, setShopSettings] = useState(null);
  
  // Move fetchData outside useEffect
  const fetchData = async () => {
    try {
      const [partResponse, settingsResponse] = await Promise.all([
        axios.get(`/api/parts/${id}`),
        axios.get('/api/shop-settings')
      ]);
      
      setPart(partResponse.data);
      setShopSettings(settingsResponse.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setSaveStatus({
        message: `Error loading part: ${err.response?.data?.error || err.message}`,
        isError: true
      });
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (id && id !== 'new') {
      fetchData();
    } else {
      // Creating a new part
      setIsEditing(true);
      setLoading(false);
    }
  }, [id]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPart(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleCycleTimeChange = (e) => {
    const { name, value } = e.target;
    // Convert to number
    setPart(prev => ({
      ...prev,
      [name]: Number(value)
    }));
  };
  
  const handleSavePart = async () => {
    // Validate required fields
    if (!part.partNumber || !part.description) {
      setSaveStatus({
        message: 'Part number and description are required',
        isError: true
      });
      return;
    }
    
    setSaveStatus({ message: 'Saving...', isError: false });
    
    try {
      let response;
      if (id && id !== 'new') {
        // Update existing part
        response = await axios.put(`/api/parts/${id}`, part);
      } else {
        // Create new part
        response = await axios.post('/api/parts', part);
      }
      
      setSaveStatus({ 
        message: 'Part saved successfully!', 
        isError: false 
      });
      
      // If it was a new part, redirect to the edit page
      if (id === 'new') {
        navigate(`/parts/${response.data.id}`);
      }
      
      setIsEditing(false);
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ message: '', isError: false });
      }, 3000);
    } catch (err) {
      console.error('Error saving part:', err);
      setSaveStatus({ 
        message: `Error saving part: ${err.response?.data?.error || err.message}`, 
        isError: true 
      });
    }
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
        <h1 className="text-2xl font-bold">
          {id === 'new' ? 'NEW PART' : `PART: ${part.partNumber}`}
          {part.revision && <span className="ml-2 text-gray-400">REV: {part.revision}</span>}
        </h1>
        <div className="flex space-x-2">
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="btn btn-secondary font-mono"
            >
              EDIT
            </button>
          ) : (
            <>
              <button 
                onClick={() => {
                  if (id === 'new') {
                    navigate('/parts');
                  } else {
                    setIsEditing(false);
                    fetchData();
                  }
                }}
                className="btn btn-secondary font-mono"
              >
                CANCEL
              </button>
              <button 
                onClick={handleSavePart}
                className="btn btn-primary font-mono"
              >
                SAVE
              </button>
            </>
          )}
        </div>
      </div>

      {saveStatus.message && (
        <div className={`mb-4 p-3 rounded ${saveStatus.isError ? 'bg-red-900 text-red-100' : 'bg-green-900 text-green-100'} font-mono`}>
          {saveStatus.message}
        </div>
      )}
      
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">PART NUMBER</span>
            </label>
            <input
              type="text"
              name="partNumber"
              value={part.partNumber}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="input"
              placeholder="Enter part number"
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">REVISION</span>
            </label>
            <input
              type="text"
              name="revision"
              value={part.revision}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="input"
              placeholder="Rev (e.g. A, B, C)"
            />
          </div>
          
          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text">DESCRIPTION</span>
            </label>
            <textarea
              name="description"
              value={part.description}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="input h-20 resize-none"
              placeholder="Part description"
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">MATERIAL TYPE</span>
            </label>
            <input
              type="text"
              name="materialType"
              value={part.materialType}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="input"
              placeholder="E.g. Aluminum, Steel, Plastic"
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">MATERIAL SPEC</span>
            </label>
            <input
              type="text"
              name="materialSpec"
              value={part.materialSpec}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="input"
              placeholder="E.g. 6061-T6, 1018, ABS"
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">CYCLE TIME (MINUTES)</span>
            </label>
            <input
              type="number"
              name="cycleTime"
              value={part.cycleTime}
              onChange={handleCycleTimeChange}
              disabled={!isEditing}
              className="input"
              min="0"
              step="1"
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">SETUP TIME (HOURS)</span>
            </label>
            <input
              type="number"
              name="setup"
              value={part.setup}
              onChange={handleCycleTimeChange}
              disabled={!isEditing}
              className="input"
              min="0"
              step="0.25"
            />
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text">MACHINE TYPE</span>
            </label>
            <select
              name="machine"
              value={part.machine}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="select"
            >
              <option value="">Select Machine Type</option>
              {shopSettings?.machineTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text">NOTES</span>
            </label>
            <textarea
              name="notes"
              value={part.notes}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="input h-20 resize-none"
              placeholder="Additional notes"
            />
          </div>
        </div>
      </div>
      
      {!isEditing && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-orange-400 font-mono">LEAD TIME</h3>
            <div className="flex space-x-4 items-center">
              <div className="text-3xl font-bold text-orange-500">
                {(part.cycleTime / 60 + part.setup).toFixed(2)}
              </div>
              <div className="text-gray-400">
                Hours<br />
                <span className="text-sm">
                  ({part.setup}h setup + {(part.cycleTime / 60).toFixed(2)}h cycle)
                </span>
              </div>
            </div>
          </div>
          
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-orange-400 font-mono">MATERIAL</h3>
            <div className="text-gray-200 mb-1">
              <span className="text-orange-400 font-mono text-sm">TYPE:</span> {part.materialType || 'N/A'}
            </div>
            <div className="text-gray-200">
              <span className="text-orange-400 font-mono text-sm">SPEC:</span> {part.materialSpec || 'N/A'}
            </div>
          </div>
          
          <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-orange-400 font-mono">PROCESS</h3>
            <div className="text-gray-200">
              <span className="text-orange-400 font-mono text-sm">MACHINE:</span> {part.machine || 'Not specified'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartDetails; 