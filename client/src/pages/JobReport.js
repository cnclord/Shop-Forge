import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const JobReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [poDetails, setPODetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [report, setReport] = useState({
    actual_hours: '',
    parts_completed: '',
    quality_issues: '',
    notes: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`/api/purchase-orders/${id}`);
        setPODetails(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching PO details:', err);
        setError('Failed to load job details');
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setReport(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/job-reports', {
        po_id: id,
        ...report
      });
      navigate('/');
    } catch (err) {
      console.error('Error submitting job report:', err);
      setError('Failed to submit job report');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 glow-effect"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">JOB COMPLETION REPORT</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Job Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400">Part Number</p>
            <p className="text-lg">{poDetails.part_number || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400">PO Number</p>
            <p className="text-lg">{poDetails.po_number}</p>
          </div>
          <div>
            <p className="text-gray-400">Customer</p>
            <p className="text-lg">{poDetails.customer}</p>
          </div>
          <div>
            <p className="text-gray-400">Quantity</p>
            <p className="text-lg">{poDetails.quantity}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Actual Hours Worked *</span>
          </label>
          <input
            type="number"
            step="0.1"
            name="actual_hours"
            value={report.actual_hours}
            onChange={handleChange}
            className="input"
            required
            min="0"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Parts Completed *</span>
          </label>
          <input
            type="number"
            name="parts_completed"
            value={report.parts_completed}
            onChange={handleChange}
            className="input"
            required
            min="0"
            max={poDetails.quantity}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Quality Issues</span>
          </label>
          <textarea
            name="quality_issues"
            value={report.quality_issues}
            onChange={handleChange}
            className="textarea h-24"
            placeholder="Describe any quality issues encountered..."
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Notes</span>
          </label>
          <textarea
            name="notes"
            value={report.notes}
            onChange={handleChange}
            className="textarea h-32"
            placeholder="Additional notes about the job..."
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            CANCEL
          </button>
          <button
            type="submit"
            className="btn btn-primary glow-effect"
          >
            SUBMIT REPORT
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobReport; 