import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const PODetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [poDetails, setPODetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedPO, setEditedPO] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewingPDF, setViewingPDF] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingToParts, setAddingToParts] = useState(false);
  const [partAdded, setPartAdded] = useState(false);
  const [shopSettings, setShopSettings] = useState(null);
  
  // Derived state for operators list
  const operators = useMemo(() => shopSettings?.operators || [], [shopSettings]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch PO details and shop settings in parallel
        const [poResponse, settingsResponse] = await Promise.all([
          axios.get(`/api/purchase-orders/${id}`),
          axios.get('/api/shop-settings')
        ]);
        
        const poData = poResponse.data;
        console.log('Loaded PO data:', poData);
        console.log('Loaded shop settings:', settingsResponse.data);
        
        // Ensure machine type is valid
        const machineTypes = settingsResponse.data.machineTypes || [];
        if (poData.machine && !machineTypes.includes(poData.machine)) {
          console.warn(`Invalid machine type "${poData.machine}" found, resetting to empty`);
          poData.machine = '';
        }
        
        // If the PO has a part number, fetch part details
        if (poData.part_number) {
          try {
            const partResponse = await axios.get('/api/parts');
            console.log("Parts library data:", partResponse.data);
            console.log(`Looking for part: "${poData.part_number}" revision: "${poData.revision}" (${typeof poData.part_number} / ${typeof poData.revision})`);
            
            // Debug: Check for whitespace or special characters
            const partNumTrimmed = poData.part_number.trim();
            if (partNumTrimmed !== poData.part_number) {
              console.log(`Part number has whitespace! Trimmed: "${partNumTrimmed}"`);
            }
            
            // Case-insensitive matching with trimmed values for part number and revision
            const partData = partResponse.data.find(part => {
              // Trim values to handle whitespace issues
              const partNumDb = part.partNumber.trim();
              const partNumPo = poData.part_number.trim();
              const revDb = part.revision ? part.revision.trim() : '';
              const revPo = poData.revision ? poData.revision.trim() : '';
              
              const partMatch = partNumDb.toLowerCase() === partNumPo.toLowerCase();
              // If revision is null/empty or matches
              const revMatch = !revPo || !revDb || revDb.toLowerCase() === revPo.toLowerCase();
              
              console.log(`Checking: "${part.partNumber}" (Rev: "${part.revision}") against "${poData.part_number}" (Rev: "${poData.revision}")`);
              console.log(`After trim/lowercase: "${partNumDb.toLowerCase()}" vs "${partNumPo.toLowerCase()}" - Part match: ${partMatch}, Rev match: ${revMatch}`);
              
              return partMatch && revMatch;
            });
            
            if (partData) {
              console.log("FOUND MATCHING PART IN LIBRARY:", partData);
              // Attach part data to the PO and update machine type
              poData.part_data = {
                setup_time: partData.setup / 1, // Setup time is in hours
                cycle_time: partData.cycleTime / 60, // Convert minutes to hours
                machine: partData.machine
              };
              // Automatically set the machine type from the part library
              if (partData.machine) {
                poData.machine = partData.machine;
                // Update the machine on the server
                try {
                  await axios.patch(`/api/purchase-orders/${id}`, {
                    machine: partData.machine
                  });
                } catch (err) {
                  console.error('Error updating machine type:', err);
                }
              }
            } else {
              console.log("NO MATCHING PART FOUND IN LIBRARY!");
              console.log("Attempting to manually check database...");
              
              // If frontend matching failed, try a direct API lookup
              try {
                const directCheckResponse = await axios.get(`/api/parts/check/${encodeURIComponent(poData.part_number.trim())}${poData.revision ? '/' + encodeURIComponent(poData.revision.trim()) : ''}`);
                if (directCheckResponse.data && directCheckResponse.data.found) {
                  console.log("Direct database check found the part!", directCheckResponse.data.part);
                  const directPartData = directCheckResponse.data.part;
                  
                  // Attach part data to the PO
                  poData.part_data = {
                    setup_time: directPartData.setup / 1, // Setup time is in hours
                    cycle_time: directPartData.cycleTime / 60, // Convert minutes to hours
                    machine: directPartData.machine
                  };
                  // Automatically set the machine type from the part library
                  if (directPartData.machine) {
                    poData.machine = directPartData.machine;
                    // Update the machine on the server
                    try {
                      await axios.patch(`/api/purchase-orders/${id}`, {
                        machine: directPartData.machine
                      });
                    } catch (err) {
                      console.error('Error updating machine type:', err);
                    }
                  }
                } else {
                  console.log("Direct database check also failed to find the part");
                }
              } catch (directErr) {
                console.error("Error in direct part lookup:", directErr);
              }
            }
          } catch (partErr) {
            console.error('Error fetching part data:', partErr);
            // Don't fail the whole request if part data fetch fails
          }
        }
        
        setPODetails(poData);
        setEditedPO(poData);
        setShopSettings(settingsResponse.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch purchase order details');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  const handleEditToggle = () => {
    if (editing) {
      // Cancel edit - reset form
      setEditedPO(poDetails);
    }
    setEditing(!editing);
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`Changing ${name} to:`, value);
    setEditedPO(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...editedPO.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    setEditedPO(prev => ({
      ...prev,
      items: updatedItems
    }));
  };
  
  const handleSave = async () => {
    setSaving(true);
    setError(null); // Clear previous errors
    try {
      // Validate machine type
      const machineTypes = shopSettings?.machineTypes || [];
      const machineType = editedPO.machine || '';
      console.log('Saving PO - Machine Types available:', machineTypes);
      console.log('Selected machine type:', machineType);
      
      if (machineType && !machineTypes.includes(machineType)) {
        console.error('Invalid machine type detected:', machineType);
        setError('Invalid machine type selected');
        setSaving(false);
        return;
      }

      // Update PO main info
      const updatedPO = {
        po_number: editedPO.po_number,
        customer: editedPO.customer,
        revision: editedPO.revision,
        part_number: editedPO.part_number,
        due_date: editedPO.due_date,
        status: editedPO.status,
        machine: machineType,
        quantity: editedPO.quantity || 1,
        operator_id: editedPO.operator_id || null // Include operator_id
      };

      console.log('Sending PO update:', updatedPO);
      
      const response = await axios.put(`/api/purchase-orders/${id}`, updatedPO);
      console.log('Server response:', response.data);
      
      // Update local state with the exact same data we sent
      setPODetails({
        ...editedPO,
        machine: updatedPO.machine // Ensure we use the same machine type we sent
      });
      
      setEditing(false);
      setSaving(false);
    } catch (err) {
      console.error('Error saving PO:', err);
      setError('Failed to update purchase order');
      setSaving(false);
    }
  };
  
  const togglePDFView = () => {
    setViewingPDF(!viewingPDF);
  };
  
  const getStatusBadgeClass = (status) => {
    const statusConfig = shopSettings?.statuses?.find(s => s.name.toLowerCase() === status.toLowerCase());
    if (statusConfig) {
      return {
        className: 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white',
        style: { backgroundColor: statusConfig.color }
      };
    }
    return {
      className: 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-600 text-gray-100'
    };
  };
  
  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    
    setDeleting(true);
    try {
      // Delete the PO and related items
      await axios.delete(`/api/purchase-orders/${id}`);
      // Redirect to dashboard after deletion
      navigate('/');
    } catch (err) {
      setError('Failed to delete purchase order');
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(false);
  };

  const handleAddToParts = async () => {
    if (!poDetails.part_number) {
      setError("Cannot add to parts library: Part number is required");
      return;
    }

    setAddingToParts(true);
    setError(null);
    
    try {
      // Check if part already exists in the library
      const response = await axios.get('/api/parts');
      console.log("Checking if part exists:", poDetails.part_number, poDetails.revision);
      
      // Use case-insensitive matching for both part number and revision
      const partExists = response.data.some(part => {
        const partMatch = part.partNumber.toLowerCase() === poDetails.part_number.toLowerCase();
        
        // If PO revision is not defined, we should consider it a match just on part number
        // Otherwise, check if revisions match (case-insensitive)
        const revMatch = !poDetails.revision || !part.revision || 
                          part.revision.toLowerCase() === poDetails.revision.toLowerCase();
                          
        console.log(`Checking existing part: ${part.partNumber} (Rev: ${part.revision}) - Part match: ${partMatch}, Rev match: ${revMatch}`);
        return partMatch && revMatch;
      });
      
      if (partExists) {
        console.log("Part already exists in library");
        setError(`Part ${poDetails.part_number} Rev ${poDetails.revision || 'N/A'} already exists in the library`);
        setAddingToParts(false);
        
        // If part exists but wasn't found for PO details, refresh the PO to link them
        if (!poDetails.part_data) {
          console.log("Part exists but wasn't linked - refreshing data");
          refreshPartData();
        }
        return;
      }
      
      // Add the part to the parts library
      await axios.post('/api/parts', {
        partNumber: poDetails.part_number,
        revision: poDetails.revision,
        description: `Part from PO ${poDetails.po_number}`,
        materialType: '',
        materialSpec: '',
        cycleTime: 0.5, // Default 30 minutes in hours
        setup: 0.25, // Default 15 minutes in hours
        machine: poDetails.machine || '',
        notes: `Added from PO ${poDetails.po_number} (Customer: ${poDetails.customer})`
      });
      
      setPartAdded(true);
      setTimeout(() => {
        setPartAdded(false);
      }, 3000);
      
      // Refresh the part data immediately
      setTimeout(() => {
        refreshPartData();
      }, 500);
    } catch (err) {
      console.error('Error adding part to library:', err);
      setError(`Failed to add part to library: ${err.response?.data?.error || err.message}`);
    } finally {
      setAddingToParts(false);
    }
  };
  
  // Add a function to calculate the total time required for the job
  const calculateTotalTime = (poDetails) => {
    // Get the part data if available
    if (!poDetails || !poDetails.part_number) return null;
    
    console.log("Checking part data for:", poDetails.part_number);
    
    // Try to get part data from the enriched PO
    const partData = poDetails.part_data;
    const quantity = poDetails.quantity || 1;
    
    if (partData) {
      console.log("Found part data:", partData);
      const setupTimeHours = partData.setup_time || 0;
      const cycleTimeHours = partData.cycle_time || 0; // This is in hours
      
      // Calculate total time: setup time + (cycle time * quantity)
      const totalHours = setupTimeHours + (cycleTimeHours * quantity);
      
      // Just return the total hours with 2 decimal places
      return `${totalHours.toFixed(2)}h`;
    } else {
      console.log("No part data found, trying to estimate time");
      
      // Let's try to fetch the part data again in case it wasn't found initially
      if (poDetails.part_number && !partAdded) {
        // Trigger a refresh only once
        setTimeout(() => {
          refreshPartData();
        }, 500);
      }
      
      // As a fallback, try to estimate based on general rules - 30 min cycle time per part
      const defaultCycleTimeHours = 0.5; // 30 minutes per part in hours
      const defaultSetupHours = 1; // 1 hour setup time
      
      const totalHours = defaultSetupHours + (defaultCycleTimeHours * quantity);
      
      // Return the estimated time with an asterisk
      return `${totalHours.toFixed(2)}h*`;
    }
  };
  
  // Add a function to refresh part data from the library
  const refreshPartData = async () => {
    if (!poDetails || !poDetails.part_number) return;
    
    try {
      console.log("Refreshing part data for:", poDetails.part_number);
      const partResponse = await axios.get('/api/parts');
      
      // Case-insensitive matching
      const partData = partResponse.data.find(part => 
        part.partNumber.toLowerCase() === poDetails.part_number.toLowerCase() &&
        (!poDetails.revision || !part.revision || 
         part.revision.toLowerCase() === poDetails.revision.toLowerCase())
      );
      
      if (partData) {
        console.log("Found part on refresh:", partData);
        // Update PO details with part data
        setPODetails(prev => {
          const updated = {
            ...prev,
            part_data: {
              setup_time: partData.setup / 1,
              cycle_time: partData.cycleTime / 60,
              machine: partData.machine
            }
          };
          // Automatically set the machine type from the part library
          if (partData.machine) {
            updated.machine = partData.machine;
            // Update the machine on the server
            try {
              axios.patch(`/api/purchase-orders/${id}`, {
                machine: partData.machine
              });
            } catch (err) {
              console.error('Error updating machine type:', err);
            }
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("Error refreshing part data:", err);
    }
  };
  
  // Find operator name from ID
  const getOperatorName = (operatorId) => {
    if (!operatorId || !operators) return 'N/A';
    const operator = operators.find(op => op.id === operatorId);
    return operator ? operator.name : 'Unknown';
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }
  
  if (!poDetails) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Not Found!</strong>
        <span className="block sm:inline"> Purchase order not found.</span>
      </div>
    );
  }
  
  // Check if part exists and has a part number
  const canAddToParts = Boolean(poDetails.part_number);
  
  return (
    <div>
      <div className="flex items-center mb-6">
        <Link to="/" className="mr-4 font-mono">
          &larr; BACK TO MISSION CONTROL
        </Link>
        <h1 className="text-2xl font-bold">PURCHASE ORDER DETAILS</h1>
      </div>
      
      {/* PDF Viewer */}
      {viewingPDF && poDetails.pdf_path && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-filter backdrop-blur-sm">
          <div className="bg-gray-900 border border-orange-600 rounded-lg w-4/5 h-4/5 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-orange-600 bg-black">
              <h2 className="font-bold text-orange-500 font-mono">MISSION DOCUMENT: {poDetails.po_number}</h2>
              <button onClick={togglePDFView} className="text-orange-500 hover:text-orange-300">
                ✕ CLOSE
              </button>
            </div>
            <div className="flex-grow overflow-auto">
              <iframe 
                src={`http://localhost:5001/uploads/${poDetails.pdf_path}`} 
                className="w-full h-full" 
                title="PO PDF"
              />
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between mb-6">
        <div className="flex items-center">
          {poDetails.pdf_path && (
            <button onClick={togglePDFView} className="btn btn-secondary mr-2 font-mono">
              VIEW DOCUMENT
            </button>
          )}
          {canAddToParts && !editing && !deleteConfirm && (
            <button 
              className="btn bg-orange-600 text-white hover:bg-orange-700 mr-2 font-mono glow-effect"
              onClick={handleAddToParts}
              disabled={addingToParts}
            >
              {addingToParts ? 'ADDING...' : 'ADD TO PARTS LIBRARY'}
            </button>
          )}
          {partAdded && (
            <span className="text-green-500 ml-2 font-mono">✓ Added to parts library</span>
          )}
          {!editing && !deleteConfirm && (
            <button 
              className="btn bg-red-700 text-white hover:bg-red-800 mr-2 font-mono"
              onClick={handleDelete}
            >
              DELETE MISSION
            </button>
          )}
          {deleteConfirm && (
            <>
              <span className="mr-2 text-red-500 font-bold font-mono">CONFIRM DELETION?</span>
              <button 
                className="btn bg-red-700 text-white hover:bg-red-800 mr-2 font-mono"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'DELETING...' : 'CONFIRM DELETE'}
              </button>
              <button 
                className="btn btn-secondary font-mono"
                onClick={cancelDelete}
                disabled={deleting}
              >
                CANCEL
              </button>
            </>
          )}
        </div>
        <button 
          className={`btn ${editing ? 'btn-secondary' : 'btn-primary'} font-mono`}
          onClick={handleEditToggle}
        >
          {editing ? 'CANCEL EDIT' : 'EDIT MISSION DATA'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-700 text-red-100 rounded font-mono" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">PO NUMBER</h3>
          {editing ? (
            <input 
              type="text" 
              name="po_number"
              value={editedPO.po_number} 
              onChange={handleChange}
              className="input w-full bg-black border-orange-500 text-white font-mono"
            />
          ) : (
            <p className="text-lg font-bold">{poDetails.po_number}</p>
          )}
        </div>
        
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">CUSTOMER</h3>
          {editing ? (
            <input 
              type="text" 
              name="customer"
              value={editedPO.customer} 
              onChange={handleChange}
              className="input w-full bg-black border-orange-500 text-white font-mono"
            />
          ) : (
            <p className="text-lg">{poDetails.customer}</p>
          )}
        </div>
        
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">PART NUMBER</h3>
          {editing ? (
            <input 
              type="text" 
              name="part_number"
              value={editedPO.part_number || ''} 
              onChange={handleChange}
              className="input w-full bg-black border-orange-500 text-white font-mono"
              placeholder="Enter part number"
            />
          ) : (
            <p className="text-lg">{poDetails.part_number || 'N/A'}</p>
          )}
        </div>
        
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">REVISION</h3>
          {editing ? (
            <input 
              type="text" 
              name="revision"
              value={editedPO.revision || ''} 
              onChange={handleChange}
              className="input w-full bg-black border-orange-500 text-white font-mono"
              placeholder="Enter revision"
            />
          ) : (
            <p className="text-lg">{poDetails.revision || 'N/A'}</p>
          )}
        </div>
        
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">QUANTITY</h3>
          {editing ? (
            <input 
              type="number" 
              name="quantity"
              min="1"
              value={editedPO.quantity || 1} 
              onChange={handleChange}
              className="input w-full bg-black border-orange-500 text-white font-mono"
              placeholder="Enter quantity"
            />
          ) : (
            <p className="text-lg">{poDetails.quantity || 1}</p>
          )}
        </div>
        
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">STATUS</h3>
          {editing ? (
            <select 
              name="status"
              value={editedPO.status} 
              onChange={handleChange}
              className="select w-full bg-black border-orange-500 text-white font-mono"
            >
              {shopSettings?.statuses?.map(status => (
                <option key={status.id} value={status.name.toLowerCase()}>
                  {status.name.charAt(0).toUpperCase() + status.name.slice(1)}
                </option>
              ))}
            </select>
          ) : (
            <span 
              className={getStatusBadgeClass(poDetails.status).className}
              style={getStatusBadgeClass(poDetails.status).style}
            >
              {poDetails.status.charAt(0).toUpperCase() + poDetails.status.slice(1)}
            </span>
          )}
        </div>
        
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">DUE DATE</h3>
          {editing ? (
            <input 
              type="date" 
              name="due_date"
              value={editedPO.due_date} 
              onChange={handleChange}
              className="input w-full bg-black border-orange-500 text-white font-mono"
            />
          ) : (
            <p>{poDetails.due_date}</p>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">MACHINE TYPE</h3>
            {editing ? (
              <select
                name="machine"
                value={editedPO.machine || ''}
                onChange={handleChange}
                className="select w-full bg-black border-orange-500 text-white font-mono"
              >
                <option value="">Not Assigned</option>
                {shopSettings?.machineTypes
                  .filter(type => !poDetails.part_data?.machine || type === poDetails.part_data.machine)
                  .map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
              </select>
            ) : (
              <p className="text-lg">
                {poDetails.machine || 'Not Assigned'}
                {poDetails.part_data?.machine && poDetails.machine !== poDetails.part_data.machine && (
                  <span className="block text-xs text-red-500 mt-1">
                    Warning: This part requires a {poDetails.part_data.machine}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Job Duration */}
          <div className="card">
            <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">TOTAL TIME REQUIRED</h3>
            <p className="text-lg">
              {calculateTotalTime(poDetails) || 'Calculating...'}
              {!poDetails.part_data && poDetails.part_number && (
                <span className="block text-xs text-gray-500 mt-1">
                  * Estimated time. To get accurate timing, add this part to the Parts Library.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Operator */}                       
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">OPERATOR</h3>
          {editing ? (
            <select
              name="operator_id"
              value={editedPO.operator_id || ''}
              onChange={handleChange}
              className="select w-full bg-black border-orange-500 text-white font-mono"
            >
              <option value="">Not Assigned</option>
              {operators.map(op => (
                <option key={op.id} value={op.id}>{op.name}</option>
              ))}
              <option value="">-- Unassign --</option>
            </select>
          ) : (
            <p className="text-lg">{poDetails.operator_id ? getOperatorName(poDetails.operator_id) : 'Not Assigned'}</p>
          )}
        </div>
      </div>
      
      {editing && (
        <div className="flex justify-end mt-6">
          <button 
            className="btn btn-secondary mr-2 font-mono"
            onClick={handleEditToggle}
          >
            CANCEL
          </button>
          <button 
            className="btn btn-primary font-mono"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PODetails; 