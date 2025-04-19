import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const POUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [success, setSuccess] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const [shopSettings, setShopSettings] = useState(null);
  
  // Initial data structure for manual job creation
  const initialJobData = {
    poNumber: '',
    customer: '',
    dueDate: '',
    part_number: '',
    revision: '',
    quantity: 1,
    machine: '4th Axis Mill',
    pdf_path: ''
  };
  
  useEffect(() => {
    // Fetch shop settings when component mounts
    const fetchSettings = async () => {
      try {
        const response = await axios.get('/api/shop-settings');
        setShopSettings(response.data);
      } catch (err) {
        console.error('Error fetching shop settings:', err);
      }
    };
    fetchSettings();
  }, []);
  
  const onDrop = useCallback(acceptedFiles => {
    // Only accept PDF files
    const pdfFile = acceptedFiles.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setFile(pdfFile);
      setError(null);
      setShowErrorPopup(false);
      // Create a URL for PDF preview
      const fileUrl = URL.createObjectURL(pdfFile);
      setPdfUrl(fileUrl);
    } else {
      setError('Please upload a PDF file');
      setShowErrorPopup(true);
    }
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });
  
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setShowErrorPopup(false);
      // Create a URL for PDF preview
      const fileUrl = URL.createObjectURL(selectedFile);
      setPdfUrl(fileUrl);
    } else if (selectedFile) {
      setError('Please upload a PDF file');
      setShowErrorPopup(true);
    }
  };
  
  const openFileExplorer = () => {
    fileInputRef.current.click();
  };
  
  const handleProcessPDF = async () => {
    if (!file) {
      setError('Please select a file to upload');
      setShowErrorPopup(true);
      return;
    }
    
    setUploading(true);
    setError(null);
    setShowErrorPopup(false);
    
    try {
      const formData = new FormData();
      formData.append('poFile', file);
      
      const response = await axios.post('/api/upload-po', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setUploading(false);
      setSuccess(true);
      
      // Store the extracted data
      const extractedInfo = response.data.data;
      setExtractedData(extractedInfo);
      
      // Initialize the editable data with the extracted info
      setEditedData({
        poNumber: extractedInfo.poNumber || '',
        customer: extractedInfo.customer || '',
        dueDate: extractedInfo.dueDate ? formatDate(extractedInfo.dueDate) : '',
        part_number: extractedInfo.part_number || '',
        revision: extractedInfo.revision || '',
        quantity: extractedInfo.quantity || 0,
        machine: extractedInfo.machine || '4th Axis Mill', // Default value for machine type
        pdf_path: extractedInfo.pdf_path || ''
      });
      
      // Turn on edit mode
      setEditMode(true);
      
    } catch (err) {
      setUploading(false);
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload PO');
      setShowErrorPopup(true);
    }
  };
  
  // Format date from YYYY-MM-DD to MM/DD/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // Check if already in MM/DD/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
      return dateString;
    }
    
    try {
      const date = new Date(dateString);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch (e) {
      return dateString; // Return original if parsing fails
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSaveToSystem = async () => {
    setUploading(true);
    
    try {
      // Save the final data with user's edits
      const response = await axios.put('/api/save-po', editedData);
      
      setUploading(false);
      // Redirect to dashboard after saving
      navigate('/');
      
    } catch (err) {
      setUploading(false);
      console.error('Save error:', err);
      setError(err.response?.data?.error || 'Failed to save PO data');
      setShowErrorPopup(true);
    }
  };
  
  // Function to toggle manual form display
  const toggleManualForm = () => {
    setShowManualForm(true);
    setSuccess(false);
    setEditMode(true);
    setEditedData(initialJobData);
  };

  // Handle closing the error popup
  const handleDismissError = () => {
    setShowErrorPopup(false);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">UPLOAD PURCHASE ORDER</h1>
      
      {!success && !showManualForm ? (
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg shadow-lg">
          <div {...getRootProps({ className: 'dropzone border-2 border-dashed border-gray-600 rounded-lg p-6 cursor-pointer hover:border-orange-500 transition-colors' })}>
            <input {...getInputProps()} />
            {file ? (
              <div className="text-center">
                <p className="font-mono">File selected: {file.name}</p>
                {pdfUrl && (
                  <div className="mt-4 max-h-96 overflow-auto border border-gray-700 rounded">
                    <iframe 
                      src={pdfUrl} 
                      title="PDF Preview" 
                      className="w-full h-96"
                    ></iframe>
                  </div>
                )}
              </div>
            ) : isDragActive ? (
              <p className="text-center text-lg">Drop the PDF file here...</p>
            ) : (
              <div className="text-center">
                <p className="text-lg mb-2">Drag & drop a purchase order PDF, or click to select</p>
                <p className="text-sm text-gray-400">Only PDF files are accepted</p>
              </div>
            )}
            
            <div className="mt-4 flex justify-center">
              <button 
                type="button"
                onClick={openFileExplorer}
                className="btn btn-secondary font-mono"
              >
                BROWSE FILES
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-secondary mr-2 font-mono"
              disabled={uploading}
            >
              CANCEL
            </button>
            <button 
              onClick={handleProcessPDF} 
              className={`btn btn-primary font-mono ${uploading ? 'opacity-75 cursor-not-allowed' : ''}`}
              disabled={!file || uploading}
            >
              {uploading ? (
                <div className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-black rounded-full"></div>
                  PROCESSING...
                </div>
              ) : 'PROCESS PDF'}
            </button>
          </div>
        </div>
      ) : (
        // Edit extracted data form or Manual Entry Form
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-orange-500">
            {showManualForm ? 'ENTER PO DETAILS MANUALLY' : 'REVIEW EXTRACTED DATA'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(editMode || showManualForm) && editedData && (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-orange-400 font-mono">PO NUMBER</span>
                  </label>
                  <input 
                    type="text" 
                    name="poNumber"
                    value={editedData.poNumber} 
                    onChange={handleInputChange}
                    className="input w-full bg-black border-orange-500 text-white font-mono" 
                  />
                </div>
                
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-orange-400 font-mono">CUSTOMER</span>
                  </label>
                  <input 
                    type="text" 
                    name="customer"
                    value={editedData.customer} 
                    onChange={handleInputChange}
                    className="input w-full bg-black border-orange-500 text-white font-mono" 
                  />
                </div>
                
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-orange-400 font-mono">DUE DATE</span>
                  </label>
                  <input 
                    type="date" 
                    name="dueDate"
                    value={editedData.dueDate} 
                    onChange={handleInputChange}
                    className="input w-full bg-black border-orange-500 text-white font-mono" 
                  />
                </div>
                
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-orange-400 font-mono">PART NUMBER</span>
                  </label>
                  <input 
                    type="text" 
                    name="part_number"
                    value={editedData.part_number} 
                    onChange={handleInputChange}
                    className="input w-full bg-black border-orange-500 text-white font-mono" 
                  />
                </div>
                
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-orange-400 font-mono">REVISION</span>
                  </label>
                  <input 
                    type="text" 
                    name="revision"
                    value={editedData.revision} 
                    onChange={handleInputChange}
                    className="input w-full bg-black border-orange-500 text-white font-mono" 
                  />
                </div>
                
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-orange-400 font-mono">QUANTITY</span>
                  </label>
                  <input 
                    type="number" 
                    name="quantity"
                    value={editedData.quantity} 
                    onChange={handleInputChange}
                    className="input w-full bg-black border-orange-500 text-white font-mono" 
                    min="1"
                  />
                </div>
                
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-orange-400 font-mono">MACHINE TYPE</span>
                  </label>
                  <select 
                    name="machine"
                    value={editedData.machine} 
                    onChange={handleInputChange}
                    className="select w-full bg-black border-orange-500 text-white font-mono" 
                  >
                    <option value="">Not Assigned</option>
                    {shopSettings?.machineTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            <div className="flex justify-end md:col-span-2 mt-6 gap-4">
              <button 
                onClick={() => navigate('/')} 
                className="btn btn-secondary font-mono"
              >
                CANCEL
              </button>
              <button 
                onClick={handleSaveToSystem} 
                className={`btn btn-primary font-mono ${uploading ? 'opacity-75 cursor-not-allowed' : ''}`}
                disabled={uploading}
              >
                {uploading ? (
                  <div className="flex items-center">
                    <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-black rounded-full"></div>
                    SAVING...
                  </div>
                ) : 'SAVE TO SYSTEM'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Option to manually enter PO data - only show when not in manual mode and not showing success */}
      {!success && !showManualForm && (
        <div className="mt-4 text-center">
          <button 
            onClick={toggleManualForm}
            className="btn btn-link text-orange-400 hover:text-orange-300"
          >
            OR ENTER PO DATA MANUALLY
          </button>
        </div>
      )}

      {/* Error Popup */}
      {showErrorPopup && error && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-gray-900 border border-red-700 text-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-orange-500">Error!</h3>
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

export default POUpload; 