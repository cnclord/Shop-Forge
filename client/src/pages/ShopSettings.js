import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { initializeTheme, applyTheme, getSystemTheme, setupThemeListener } from '../utils/themeManager';

// Helper function for unique IDs (if needed for local state before saving)
const generateId = () => `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

const ShopSettings = () => {
  // Get the initial theme from localStorage if available
  const savedTheme = localStorage.getItem('theme') || 'system';
  
  const [settings, setSettings] = useState({
    machines: [],
    machineTypes: [],
    hoursPerDay: 8,
    operatingDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    },
    operatingHours: {
      monday_start: 9,
      monday_end: 17,
      tuesday_start: 9,
      tuesday_end: 17,
      wednesday_start: 9,
      wednesday_end: 17,
      thursday_start: 9,
      thursday_end: 17,
      friday_start: 9,
      friday_end: 17,
      saturday_start: 9,
      saturday_end: 17,
      sunday_start: 9,
      sunday_end: 17
    },
    statuses: [],
    operators: [],
    theme: {
      colorScheme: savedTheme, // Use saved theme instead of system theme
      accentColor: 'orange'
    },
    display: {
      enableAnimations: true,
      compactMode: false,
      showGridLines: true
    },
    notifications: {
      emailEnabled: true,
      desktopEnabled: true,
      sound: 'default'
    }
  });
  
  const [newMachine, setNewMachine] = useState({
    name: '',
    type: '',
    capacity: 0,
    notes: ''
  });

  const [newMachineType, setNewMachineType] = useState('');
  const [editingMachine, setEditingMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMessagePopup, setShowMessagePopup] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ message: '', isError: false });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialSettings, setInitialSettings] = useState(null);

  const [newStatus, setNewStatus] = useState({ name: '', color: '#ff6600' });
  const [editingStatus, setEditingStatus] = useState(null);

  // State for Operators
  const [newOperatorName, setNewOperatorName] = useState('');
  const [editingOperator, setEditingOperator] = useState(null);

  // Effect to initialize theme and set up listener
  useEffect(() => {
    // Initialize theme based on current settings
    const currentTheme = settings.theme.colorScheme;
    const activeTheme = currentTheme === 'system' ? getSystemTheme() : currentTheme;
    applyTheme(activeTheme);

    // Setup system theme change listener
    const cleanup = setupThemeListener((newTheme) => {
      if (settings.theme.colorScheme === 'system') {
        applyTheme(newTheme);
      }
    });

    return cleanup;
  }, [settings.theme.colorScheme]);

  // Fetch settings from server
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get('/api/shop-settings');
        if (response.data) {
          // Preserve the theme from localStorage if it exists, otherwise use server theme
          const themeToUse = localStorage.getItem('theme') || response.data.theme?.colorScheme || 'system';
          
          // Ensure all required settings exist with defaults
          const updatedSettings = {
            ...settings,
            ...response.data,
            theme: {
              colorScheme: themeToUse,
              accentColor: response.data.theme?.accentColor || settings.theme.accentColor
            }
          };
          
          setSettings(updatedSettings);
          setInitialSettings(JSON.stringify(updatedSettings));
          
          // Apply the theme from settings
          const activeTheme = themeToUse === 'system' ? getSystemTheme() : themeToUse;
          applyTheme(activeTheme);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching shop settings:', err);
        setSaveStatus({
          message: `Error loading settings: ${err.response?.data?.error || err.message}`,
          isError: true
        });
        setShowMessagePopup(true);
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);

  // Check for changes whenever settings change
  useEffect(() => {
    if (initialSettings) {
      const currentSettings = JSON.stringify(settings);
      setHasUnsavedChanges(currentSettings !== initialSettings);
    }
  }, [settings, initialSettings]);

  const handleDayHoursChange = (day, hours) => {
    const numHours = Math.min(Math.max(parseFloat(hours) || 0, 0), 24);
    setSettings(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: numHours
      }
    }));
  };

  const handleDayToggle = (day) => {
    setSettings(prev => ({
      ...prev,
      operatingDays: {
        ...prev.operatingDays,
        [day]: !prev.operatingDays[day]
      },
      operatingHours: {
        ...prev.operatingHours,
        [day]: !prev.operatingDays[day] ? 8 : 0
      }
    }));
  };

  const handleNewMachineChange = (e) => {
    setNewMachine({
      ...newMachine,
      [e.target.name]: e.target.value
    });
  };

  const handleEditingMachineChange = (e) => {
    setEditingMachine({
      ...editingMachine,
      [e.target.name]: e.target.value
    });
  };

  const startEditing = (machine) => {
    setEditingMachine({ ...machine });
  };

  const cancelEditing = () => {
    setEditingMachine(null);
  };

  const saveEditedMachine = () => {
    if (!editingMachine.name || !editingMachine.type) {
      setSaveStatus({
        message: 'Machine name and type are required',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }

    const updatedMachines = settings.machines.map(machine => 
      machine.id === editingMachine.id ? editingMachine : machine
    );

    setSettings({
      ...settings,
      machines: updatedMachines
    });

    setEditingMachine(null);
  };

  const addMachine = () => {
    if (!newMachine.name || !newMachine.type) {
      setSaveStatus({
        message: 'Machine name and type are required',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }

    const updatedMachines = [
      ...settings.machines,
      { ...newMachine, id: Date.now().toString() }
    ];

    setSettings({
      ...settings,
      machines: updatedMachines
    });

    // Reset new machine form
    setNewMachine({
      name: '',
      type: '',
      capacity: 0,
      notes: ''
    });
  };

  const removeMachine = (id) => {
    const updatedMachines = settings.machines.filter(machine => machine.id !== id);
    setSettings({
      ...settings,
      machines: updatedMachines
    });
  };

  const handleNewMachineTypeSubmit = async (e) => {
    e.preventDefault();
    const trimmedType = newMachineType.trim();
    if (!trimmedType) return;
    
    // Don't add if it already exists (case-insensitive check)
    if (settings.machineTypes.some(type => type.toLowerCase() === trimmedType.toLowerCase())) {
      setSaveStatus({
        message: 'This machine type already exists',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }
    
    // Don't allow "Other" to be added
    if (trimmedType.toLowerCase() === 'other') {
      setSaveStatus({
        message: 'Cannot add "Other" as a machine type',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }
    
    // Add new machine type
    const updatedMachineTypes = [...settings.machineTypes, trimmedType].sort();
    setSettings(prev => ({
      ...prev,
      machineTypes: updatedMachineTypes
    }));
    setNewMachineType('');

    // Save settings immediately
    try {
      await axios.post('/api/shop-settings', {
        hoursPerDay: settings.hoursPerDay,
        operatingDays: settings.operatingDays,
        machines: settings.machines,
        machineTypes: updatedMachineTypes
      });
      
      setSaveStatus({
        message: 'Machine type added successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveStatus({
        message: `Error saving settings: ${err.response?.data?.error || err.message}`,
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  const removeMachineType = async (typeToRemove) => {
    // Check if any machines are using this type
    const isTypeInUse = settings.machines.some(machine => machine.type === typeToRemove);
    
    if (isTypeInUse) {
      setSaveStatus({
        message: 'Cannot remove machine type that is in use by existing machines',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }
    
    // Remove the machine type
    const updatedMachineTypes = settings.machineTypes.filter(type => type !== typeToRemove);
    setSettings(prev => ({
      ...prev,
      machineTypes: updatedMachineTypes
    }));

    // Save settings immediately
    try {
      await axios.post('/api/shop-settings', {
        hoursPerDay: settings.hoursPerDay,
        operatingDays: settings.operatingDays,
        machines: settings.machines,
        machineTypes: updatedMachineTypes
      });
      
      setSaveStatus({
        message: 'Machine type removed successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveStatus({
        message: `Error saving settings: ${err.response?.data?.error || err.message}`,
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  const saveSettings = async () => {
    try {
      const response = await axios.post('/api/shop-settings', {
        hoursPerDay: settings.hoursPerDay,
        operatingDays: settings.operatingDays,
        operatingHours: settings.operatingHours,
        machines: settings.machines,
        machineTypes: settings.machineTypes,
        statuses: settings.statuses,
        operators: settings.operators
      });
      
      // Update initial settings after successful save
      setInitialSettings(JSON.stringify(settings));
      setHasUnsavedChanges(false);
      
      setSaveStatus({
        message: 'Settings saved successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveStatus({
        message: `Error saving settings: ${err.response?.data?.error || err.message}`,
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  const handleNewStatusChange = (e) => {
    setNewStatus({
      ...newStatus,
      [e.target.name]: e.target.value
    });
  };

  const handleEditingStatusChange = (e) => {
    setEditingStatus({
      ...editingStatus,
      [e.target.name]: e.target.value
    });
  };

  const addStatus = () => {
    if (!newStatus.name.trim()) {
      setSaveStatus({
        message: 'Status name is required',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }

    // Check if status already exists (case-insensitive)
    if (settings.statuses.some(s => s.name.toLowerCase() === newStatus.name.toLowerCase())) {
      setSaveStatus({
        message: 'This status already exists',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }

    const updatedStatuses = [
      ...settings.statuses,
      { 
        id: `status-${Date.now()}`,
        name: newStatus.name.trim(),
        color: newStatus.color 
      }
    ];

    setSettings({
      ...settings,
      statuses: updatedStatuses
    });

    setNewStatus({ name: '', color: '#ff6600' });
  };

  const startEditingStatus = (status) => {
    setEditingStatus({ ...status });
  };

  const cancelEditingStatus = () => {
    setEditingStatus(null);
  };

  const saveEditedStatus = () => {
    if (!editingStatus.name.trim()) {
      setSaveStatus({
        message: 'Status name is required',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }

    // Check if new name conflicts with existing statuses (excluding current status)
    const nameExists = settings.statuses.some(s => 
      s.id !== editingStatus.id && 
      s.name.toLowerCase() === editingStatus.name.toLowerCase()
    );

    if (nameExists) {
      setSaveStatus({
        message: 'This status name already exists',
        isError: true
      });
      setShowMessagePopup(true);
      return;
    }

    const updatedStatuses = settings.statuses.map(status =>
      status.id === editingStatus.id ? {
        ...editingStatus,
        name: editingStatus.name.trim()
      } : status
    );

    setSettings({
      ...settings,
      statuses: updatedStatuses
    });

    setEditingStatus(null);
  };

  const removeStatus = (id) => {
    const updatedStatuses = settings.statuses.filter(status => status.id !== id);
    setSettings({
      ...settings,
      statuses: updatedStatuses
    });
  };

  const handleThemeChange = (e) => {
    const { name, value } = e.target;
    
    // Apply theme immediately if changing color scheme
    if (name === 'colorScheme') {
      const newTheme = value === 'system' ? getSystemTheme() : value;
      applyTheme(newTheme);
      // Save to localStorage
      localStorage.setItem('theme', value);
    }
    
    setSettings(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        [name]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleDisplayChange = (setting) => {
    setSettings(prev => ({
      ...prev,
      display: {
        ...prev.display,
        [setting]: !prev.display[setting]
      }
    }));
  };

  const handleNotificationChange = (setting, value) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [setting]: typeof value === 'boolean' ? value : value
      }
    }));
  };

  // Add CSS for pulsing animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse-red {
        0%, 100% { background-color: rgb(220, 38, 38); }
        50% { background-color: rgb(185, 28, 28); }
      }
      .pulse-red {
        animation: pulse-red 2s infinite;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // --- Operator Functions ---
  const handleNewOperatorChange = (e) => {
    setNewOperatorName(e.target.value);
  };

  const addOperator = () => {
    const trimmedName = newOperatorName.trim();
    if (!trimmedName) return;

    // Prevent adding duplicates (case-insensitive)
    if (settings.operators.some(op => op.name.toLowerCase() === trimmedName.toLowerCase())) {
        setSaveStatus({ message: `Operator "${trimmedName}" already exists.`, isError: true });
        setShowMessagePopup(true);
        return;
    }

    const newOp = {
      id: generateId(), // Generate temporary ID for local state/key
      name: trimmedName
    };

    setSettings(prev => ({
      ...prev,
      operators: [...prev.operators, newOp].sort((a, b) => a.name.localeCompare(b.name))
    }));
    setNewOperatorName('');
  };

  const removeOperator = (idToRemove) => {
    // Optional: Check if operator is assigned to any jobs before removing
    // This would require fetching PO data or adding a check on the backend during save.
    // For simplicity, we'll allow removal here.
    setSettings(prev => ({
      ...prev,
      operators: prev.operators.filter(op => op.id !== idToRemove)
    }));
  };

  const startEditingOperator = (operator) => {
    setEditingOperator({ ...operator });
  };

  const cancelEditingOperator = () => {
    setEditingOperator(null);
  };

  const handleEditingOperatorChange = (e) => {
    setEditingOperator(prev => ({ ...prev, name: e.target.value }));
  };

  const saveEditedOperator = () => {
    const trimmedName = editingOperator.name.trim();
    if (!trimmedName) {
        setSaveStatus({ message: 'Operator name cannot be empty.', isError: true });
        setShowMessagePopup(true);
        return;
    }

    // Check if the new name conflicts with another existing operator (excluding itself)
    if (settings.operators.some(op => op.id !== editingOperator.id && op.name.toLowerCase() === trimmedName.toLowerCase())) {
        setSaveStatus({ message: `Operator name "${trimmedName}" already exists.`, isError: true });
        setShowMessagePopup(true);
        return;
    }

    setSettings(prev => ({
      ...prev,
      operators: prev.operators.map(op =>
        op.id === editingOperator.id ? { ...op, name: trimmedName } : op
      ).sort((a, b) => a.name.localeCompare(b.name))
    }));
    setEditingOperator(null);
  };
  // --- End Operator Functions ---

  // Add new save handler functions
  const saveOperatingHours = async () => {
    try {
      await saveSettings();
      setSaveStatus({
        message: 'Operating hours saved successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (error) {
      setSaveStatus({
        message: 'Failed to save operating hours',
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  const saveMachines = async () => {
    try {
      await saveSettings();
      setSaveStatus({
        message: 'Machines saved successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (error) {
      setSaveStatus({
        message: 'Failed to save machines',
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  const saveMachineTypes = async () => {
    try {
      await saveSettings();
      setSaveStatus({
        message: 'Machine types saved successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (error) {
      setSaveStatus({
        message: 'Failed to save machine types',
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  const saveStatuses = async () => {
    try {
      await saveSettings();
      setSaveStatus({
        message: 'Statuses saved successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (error) {
      setSaveStatus({
        message: 'Failed to save statuses',
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  const saveGeneralSettings = async () => {
    try {
      await saveSettings();
      setSaveStatus({
        message: 'General settings saved successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (error) {
      setSaveStatus({
        message: 'Failed to save general settings',
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  const saveOperators = async () => {
    try {
      await saveSettings();
      setSaveStatus({
        message: 'Operators saved successfully',
        isError: false
      });
      setShowMessagePopup(true);
    } catch (error) {
      setSaveStatus({
        message: 'Failed to save operators',
        isError: true
      });
      setShowMessagePopup(true);
    }
  };

  // Update the message popup styling
  const getMessagePopupClasses = () => {
    return `message-popup ${saveStatus.isError ? 'error' : 'success'}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">SHOP SETTINGS</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Operating Hours Section - Full Width */}
        <div className="card col-span-1 md:col-span-2 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-orange-400 font-mono">OPERATING HOURS</h2>
            <button
              onClick={saveOperatingHours}
              disabled={!hasUnsavedChanges}
              className={`btn btn-sm btn-primary glow-effect ${!hasUnsavedChanges ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Save
            </button>
          </div>
          
          <div>
            <div className="grid grid-cols-7 gap-2">
              {Object.entries(settings.operatingDays).map(([day, isActive]) => (
                <div key={day} className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`w-full py-2 px-3 rounded-md text-xs font-medium uppercase font-mono ${
                      isActive 
                        ? 'bg-orange-600 text-white glow-effect' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={settings.operatingHours?.[day] || 0}
                    onChange={(e) => handleDayHoursChange(day, e.target.value)}
                    disabled={!isActive}
                    className={`w-full text-center bg-transparent ${
                      isActive 
                        ? 'text-orange-400 font-mono' 
                        : 'text-gray-500'
                    }`}
                    style={{ 
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Machines Section */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-orange-400 font-mono">MACHINES</h2>
            <button
              onClick={saveMachines}
              disabled={!hasUnsavedChanges}
              className={`btn btn-sm btn-primary glow-effect ${!hasUnsavedChanges ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Save
            </button>
          </div>
          
          {/* Add New Machine Form */}
          <div className="bg-gray-800 p-4 rounded-md mb-4">
            <h3 className="text-lg font-medium mb-2">Add New Machine</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">
                  <span className="label-text">Machine Name</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={newMachine.name}
                  onChange={handleNewMachineChange}
                  className="input w-full"
                  placeholder="e.g., Mill 1"
                />
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text">Machine Type</span>
                </label>
                <select
                  name="type"
                  value={newMachine.type}
                  onChange={handleNewMachineChange}
                  className="select w-full"
                >
                  <option value="">Select Machine Type</option>
                  {settings.machineTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text">Capacity</span>
                </label>
                <input
                  type="number"
                  name="capacity"
                  value={newMachine.capacity}
                  onChange={handleNewMachineChange}
                  className="input w-full"
                  min="0"
                  step="1"
                />
              </div>
              
              <div>
                <label className="label">
                  <span className="label-text">Notes</span>
                </label>
                <input
                  type="text"
                  name="notes"
                  value={newMachine.notes}
                  onChange={handleNewMachineChange}
                  className="input w-full"
                  placeholder="Optional notes"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={addMachine}
                className="btn btn-primary"
              >
                Add Machine
              </button>
            </div>
          </div>
          
          {/* Machine List */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {settings.machines.length === 0 ? (
              <p className="text-gray-400 italic">No machines added yet</p>
            ) : (
              settings.machines.map(machine => (
                <div key={machine.id} className="bg-gray-800 rounded-md p-3">
                  {editingMachine && editingMachine.id === machine.id ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="label">
                            <span className="label-text">Machine Name</span>
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={editingMachine.name}
                            onChange={handleEditingMachineChange}
                            className="input w-full"
                          />
                        </div>
                        
                        <div>
                          <label className="label">
                            <span className="label-text">Machine Type</span>
                          </label>
                          <select
                            name="type"
                            value={editingMachine.type}
                            onChange={handleEditingMachineChange}
                            className="select w-full"
                          >
                            <option value="">Select Machine Type</option>
                            {settings.machineTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="label">
                            <span className="label-text">Capacity</span>
                          </label>
                          <input
                            type="number"
                            name="capacity"
                            value={editingMachine.capacity}
                            onChange={handleEditingMachineChange}
                            className="input w-full"
                            min="0"
                            step="1"
                          />
                        </div>
                        
                        <div>
                          <label className="label">
                            <span className="label-text">Notes</span>
                          </label>
                          <input
                            type="text"
                            name="notes"
                            value={editingMachine.notes}
                            onChange={handleEditingMachineChange}
                            className="input w-full"
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={cancelEditing}
                          className="btn btn-secondary"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={saveEditedMachine}
                          className="btn btn-primary"
                        >
                          Save
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap justify-between items-start">
                        <div>
                          <h4 className="font-bold">{machine.name}</h4>
                          <div className="text-sm text-gray-300">
                            <span className="inline-block bg-gray-700 px-2 py-1 rounded mr-2">
                              {machine.type}
                            </span>
                            <span className="inline-block">
                              Capacity: {machine.capacity}
                            </span>
                          </div>
                          {machine.notes && (
                            <p className="text-sm text-gray-400 mt-1">{machine.notes}</p>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEditing(machine)}
                            className="btn btn-sm btn-outline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeMachine(machine.id)}
                            className="btn btn-sm btn-outline btn-error"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Machine Types Section */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-orange-400 font-mono">MACHINE TYPES</h2>
            <button
              onClick={saveMachineTypes}
              disabled={!hasUnsavedChanges}
              className={`btn btn-sm btn-primary glow-effect ${!hasUnsavedChanges ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Save
            </button>
          </div>
          
          {/* Add New Machine Type Form */}
          <div className="bg-gray-800 p-4 rounded-md mb-4">
            <form onSubmit={handleNewMachineTypeSubmit} className="flex gap-2">
              <input
                type="text"
                value={newMachineType}
                onChange={(e) => setNewMachineType(e.target.value)}
                className="input flex-grow"
                placeholder="Enter new machine type"
              />
              <button
                type="submit"
                className="btn btn-primary"
              >
                Add Type
              </button>
            </form>
          </div>
          
          {/* Machine Types List */}
          <div className="space-y-2">
            {settings.machineTypes.map((type) => (
              <div key={type} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                <span>{type}</span>
                <button
                  onClick={() => removeMachineType(type)}
                  className="btn btn-sm btn-error"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Status Management Section */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-orange-400 font-mono">STATUS MANAGEMENT</h2>
            <button
              onClick={saveStatuses}
              disabled={!hasUnsavedChanges}
              className={`btn btn-sm btn-primary glow-effect ${!hasUnsavedChanges ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Save
            </button>
          </div>
          
          {/* Add New Status */}
          <div className="bg-gray-800 p-4 rounded-md mb-4">
            <div className="flex gap-4">
              <input
                type="text"
                name="name"
                value={newStatus.name}
                onChange={handleNewStatusChange}
                placeholder="New Status Name"
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="color"
                name="color"
                value={newStatus.color}
                onChange={handleNewStatusChange}
                className="w-16 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
              />
              <button
                onClick={addStatus}
                className="btn btn-primary glow-effect"
              >
                Add Status
              </button>
            </div>
          </div>

          {/* Status List */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {settings.statuses && settings.statuses.map(status => (
              <div 
                key={status.id}
                className="bg-gray-800 rounded-md p-3"
              >
                {editingStatus?.id === status.id ? (
                  <>
                    <div className="flex gap-4 flex-1">
                      <input
                        type="text"
                        name="name"
                        value={editingStatus.name}
                        onChange={handleEditingStatusChange}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <input
                        type="color"
                        name="color"
                        value={editingStatus.color}
                        onChange={handleEditingStatusChange}
                        className="w-12 h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-end space-x-2 mt-3">
                      <button
                        onClick={saveEditedStatus}
                        className="btn btn-sm btn-primary"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditingStatus}
                        className="btn btn-sm btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="font-medium">{status.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditingStatus(status)}
                        className="btn btn-sm btn-outline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeStatus(status.id)}
                        className="btn btn-sm btn-outline btn-error"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* General Settings Section */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-accent-primary font-mono">GENERAL SETTINGS</h2>
            <button
              onClick={saveGeneralSettings}
              disabled={!hasUnsavedChanges}
              className={`btn btn-sm btn-primary glow-effect ${!hasUnsavedChanges ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Save
            </button>
          </div>
          
          {/* Theme Settings */}
          <div className="bg-secondary p-4 rounded-md mb-4">
            <h3 className="text-lg font-medium mb-3">Theme</h3>
            <div className="space-y-3">
              <div>
                <label className="label">
                  <span className="label-text">Color Scheme</span>
                </label>
                <select
                  name="colorScheme"
                  value={settings.theme.colorScheme}
                  onChange={handleThemeChange}
                  className="select w-full"
                >
                  <option value="dark">Dark Theme</option>
                  <option value="light">Light Theme</option>
                  <option value="system">System Default</option>
                </select>
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Accent Color</span>
                </label>
                <select
                  name="accentColor"
                  value={settings.theme.accentColor}
                  onChange={handleThemeChange}
                  className="select w-full"
                >
                  <option value="orange">Orange</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="purple">Purple</option>
                </select>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <div className="bg-gray-800 p-4 rounded-md mb-4">
            <h3 className="text-lg font-medium mb-3">Display</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Enable Animations</span>
                <input
                  type="checkbox"
                  checked={settings.display.enableAnimations}
                  onChange={() => handleDisplayChange('enableAnimations')}
                  className="toggle toggle-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Compact Mode</span>
                <input
                  type="checkbox"
                  checked={settings.display.compactMode}
                  onChange={() => handleDisplayChange('compactMode')}
                  className="toggle toggle-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Show Grid Lines</span>
                <input
                  type="checkbox"
                  checked={settings.display.showGridLines}
                  onChange={() => handleDisplayChange('showGridLines')}
                  className="toggle toggle-primary"
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-gray-800 p-4 rounded-md">
            <h3 className="text-lg font-medium mb-3">Notifications</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Email Notifications</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.emailEnabled}
                  onChange={(e) => handleNotificationChange('emailEnabled', e.target.checked)}
                  className="toggle toggle-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Desktop Notifications</span>
                <input
                  type="checkbox"
                  checked={settings.notifications.desktopEnabled}
                  onChange={(e) => handleNotificationChange('desktopEnabled', e.target.checked)}
                  className="toggle toggle-primary"
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Notification Sound</span>
                </label>
                <select
                  name="sound"
                  value={settings.notifications.sound}
                  onChange={(e) => handleNotificationChange('sound', e.target.value)}
                  className="select w-full bg-gray-700 border-gray-600"
                >
                  <option value="default">Default</option>
                  <option value="subtle">Subtle</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Operators Section */}
        <div className="card bg-base-200 shadow-inner mb-6">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title text-orange-500">Operators</h2>
              <button
                onClick={saveOperators}
                disabled={!hasUnsavedChanges}
                className={`btn btn-sm btn-primary glow-effect ${!hasUnsavedChanges ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Save
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Manage the operators available for job assignments.</p>

            {/* List Operators */}
            <div className="mb-4 max-h-60 overflow-y-auto border border-base-300 rounded p-2">
              {settings.operators.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">No operators defined.</p>
              ) : (
                <ul className="space-y-2">
                  {settings.operators.map((operator) => (
                    <li key={operator.id} className="flex items-center justify-between bg-base-100 p-2 rounded">
                      {editingOperator && editingOperator.id === operator.id ? (
                        // Editing View
                        <div className="flex-grow flex items-center space-x-2 mr-2">
                          <input
                            type="text"
                            value={editingOperator.name}
                            onChange={handleEditingOperatorChange}
                            className="input input-sm flex-grow"
                            autoFocus
                          />
                          <button onClick={saveEditedOperator} className="btn btn-xs btn-success">Save</button>
                          <button onClick={cancelEditingOperator} className="btn btn-xs btn-ghost">Cancel</button>
                        </div>
                      ) : (
                        // Display View
                        <> 
                          <span className="font-mono">{operator.name}</span>
                          <div className="space-x-1">
                            <button onClick={() => startEditingOperator(operator)} className="btn btn-xs btn-ghost">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => removeOperator(operator.id)} className="btn btn-xs btn-ghost text-error">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Add New Operator */}
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="New Operator Name"
                value={newOperatorName}
                onChange={handleNewOperatorChange}
                className="input input-bordered w-full"
              />
              <button onClick={addOperator} className="btn btn-secondary">ADD</button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Message Popup */}
      {showMessagePopup && (
        <div className={getMessagePopupClasses()}>
          <p>{saveStatus.message}</p>
        </div>
      )}
    </div>
  );
};

export default ShopSettings; 