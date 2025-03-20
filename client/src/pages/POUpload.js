import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const POUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  
  const onDrop = useCallback(acceptedFiles => {
    // Only accept PDF files
    const pdfFile = acceptedFiles.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setFile(pdfFile);
      setError(null);
      // Create a URL for PDF preview
      const fileUrl = URL.createObjectURL(pdfFile);
      setPdfUrl(fileUrl);
    } else {
      setError('Please upload a PDF file');
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
      // Create a URL for PDF preview
      const fileUrl = URL.createObjectURL(selectedFile);
      setPdfUrl(fileUrl);
    } else if (selectedFile) {
      setError('Please upload a PDF file');
    }
  };
  
  const openFileExplorer = () => {
    fileInputRef.current.click();
  };
  
  const handleProcessPDF = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    setUploading(true);
    setError(null);
    
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
    }
  };
  
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">UPLOAD NEW MISSION</h1>
      
      {!success ? (
        <div className="card">
          <div className="mb-6">
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-orange-500 bg-gray-900' : 'border-gray-600 hover:border-orange-400'
              }`}
            >
              <input {...getInputProps()} />
              
              <div className="flex flex-col items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-orange-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-orange-400 font-mono">SELECTED FILE:</p>
                    <p className="text-sm">{file.name} ({(file.size / 1024).toFixed(2)} KB)</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-orange-400 font-mono">DRAG AND DROP MISSION DOCUMENT</p>
                    <p className="text-xs mt-1 font-mono">PDF FILES ONLY</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* File Explorer Button */}
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
          
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded mb-4 font-mono" role="alert">
              <p>ERROR: {error}</p>
            </div>
          )}
          
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
        // Show PDF preview and extracted data side by side
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mx-auto" style={{ maxWidth: '98%' }}>
          {/* PDF Preview - Takes up 2/3 of the screen width */}
          <div className="card lg:col-span-2">
            <h2 className="text-xl font-bold mb-4 text-orange-400 font-mono">PDF PREVIEW</h2>
            <div className="border border-gray-600 rounded-md overflow-hidden" style={{ height: '900px' }}>
              {pdfUrl && (
                <iframe 
                  src={pdfUrl} 
                  className="w-full h-full"
                  title="PO PDF Preview"
                />
              )}
            </div>
          </div>
          
          {/* Extracted Data with Edit Form - Takes up 1/3 of the screen width */}
          <div className="card">
            <h2 className="text-xl font-bold mb-2 text-orange-400 font-mono">EXTRACTED DATA</h2>
            <p className="text-sm mb-3 font-mono">VERIFY AND EDIT IF NEEDED</p>
            
            {editedData && (
              <div className="space-y-3">
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
                    <span className="label-text text-orange-400 font-mono">DUE DATE</span>
                  </label>
                  <input 
                    type="text" 
                    name="dueDate"
                    value={editedData.dueDate} 
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
                    <option value="4th Axis Mill">4th Axis Mill</option>
                    <option value="3 Axis Mill">3 Axis Mill</option>
                    <option value="Lathe">Lathe</option>
                    <option value="Outside Vendor">Outside Vendor</option>
                  </select>
                </div>
              </div>
            )}
            
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded my-4 font-mono" role="alert">
                <p>ERROR: {error}</p>
              </div>
            )}
            
            <div className="flex justify-end mt-6">
              <button 
                onClick={() => {
                  setSuccess(false);
                  setEditMode(false);
                  setEditedData(null);
                }} 
                className="btn btn-secondary mr-2 font-mono"
                disabled={uploading}
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
    </div>
  );
};

export default POUpload; 