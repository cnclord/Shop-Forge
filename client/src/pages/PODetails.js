import React, { useState, useEffect } from 'react';
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
  
  useEffect(() => {
    const fetchPODetails = async () => {
      try {
        const response = await axios.get(`/api/purchase-orders/${id}`);
        setPODetails(response.data);
        setEditedPO(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch purchase order details');
        setLoading(false);
      }
    };
    fetchPODetails();
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
    try {
      // Update PO main info
      await axios.put(`/api/purchase-orders/${id}`, {
        po_number: editedPO.po_number,
        customer: editedPO.customer,
        revision: editedPO.revision,
        part_number: editedPO.part_number,
        due_date: editedPO.due_date,
        status: editedPO.status,
        machine: editedPO.machine
      });
      
      // Update local state
      setPODetails(editedPO);
      setEditing(false);
      setSaving(false);
    } catch (err) {
      setError('Failed to update purchase order');
      setSaving(false);
    }
  };
  
  const togglePDFView = () => {
    setViewingPDF(!viewingPDF);
  };
  
  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
        <div>
          {poDetails.pdf_path && (
            <button onClick={togglePDFView} className="btn btn-secondary mr-2 font-mono">
              VIEW DOCUMENT
            </button>
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
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">STATUS</h3>
          {editing ? (
            <select 
              name="status"
              value={editedPO.status} 
              onChange={handleChange}
              className="select w-full bg-black border-orange-500 text-white font-mono"
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          ) : (
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(poDetails.status)}`}>
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
        
        <div className="card">
          <h3 className="text-orange-500 text-sm font-semibold mb-2 font-mono">MACHINE TYPE</h3>
          {editing ? (
            <select
              name="machine"
              value={editedPO.machine || ''}
              onChange={handleChange}
              className="select w-full bg-black border-orange-500 text-white font-mono"
            >
              <option value="4th Axis Mill">4th Axis Mill</option>
              <option value="3 Axis Mill">3 Axis Mill</option>
              <option value="Lathe">Lathe</option>
              <option value="Outside Vendor">Outside Vendor</option>
            </select>
          ) : (
            <p className="text-lg">{poDetails.machine || 'Not assigned'}</p>
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