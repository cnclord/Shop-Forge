import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, Cell, ResponsiveContainer, LineChart, Line
} from 'recharts';

const Dashboard = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('table');
  const [shopSettings, setShopSettings] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const navigate = useNavigate();

  // Color constants for charts that match theme
  const COLORS = {
    orange: '#ff6600',
    orangeLight: '#ff8533',
    orangeDim: '#cc5200',
    unassigned: '#a0aec0', // gray
    chart: {
      background: '#1e1e1e',
      text: '#e0e0e0',
      grid: '#333333',
    }
  };

  // Machine type colors
  const MACHINE_COLORS = {
    '4th Axis Mill': COLORS.orangeLight,
    '3 Axis Mill': COLORS.orange,
    'Lathe': COLORS.orangeDim,
    'Outside Vendor': '#b794f4', // purple
    'UNASSIGNED': COLORS.unassigned
  };

  const getStatusStyle = (status) => {
    const baseStyle = 'px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer hover:opacity-90';
    const statusConfig = shopSettings?.statuses?.find(s => s.name.toLowerCase() === status.toLowerCase());
    
    if (statusConfig) {
      return {
        className: `${baseStyle} text-white`,
        style: { backgroundColor: statusConfig.color }
      };
    }
    
    return {
      className: `${baseStyle} bg-gray-600 text-gray-100`
    };
  };

  useEffect(() => {
    // Fetch real data from the backend
    const fetchData = async () => {
      try {
        // Fetch purchase orders and shop settings in parallel
        const [posResponse, settingsResponse] = await Promise.all([
          axios.get('/api/purchase-orders'),
          axios.get('/api/shop-settings')
        ]);
        
        setPurchaseOrders(posResponse.data);
        setShopSettings(settingsResponse.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch purchase orders');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Prepare data for charts
  const chartData = useMemo(() => {
    if (!purchaseOrders.length) return { status: [], machines: [], timeline: [] };
    
    // For status distribution pie chart
    const statusCounts = purchaseOrders.reduce((acc, po) => {
      const status = po.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const statusData = Object.keys(statusCounts).map(status => {
      const statusConfig = shopSettings?.statuses?.find(s => s.name.toLowerCase() === status.toLowerCase());
      return {
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: statusCounts[status],
        color: statusConfig?.color || COLORS.unassigned
      };
    });

    // For machine utilization bar chart
    const machineCounts = purchaseOrders.reduce((acc, po) => {
      const machine = po.machine || 'UNASSIGNED';
      acc[machine] = (acc[machine] || 0) + 1;
      return acc;
    }, {});

    const machineData = Object.keys(machineCounts).map(machine => ({
      name: machine,
      count: machineCounts[machine],
      color: MACHINE_COLORS[machine] || COLORS.unassigned
    }));

    // For due date timeline
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextTwoWeeks = [...Array(14)].map((_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      return date.toISOString().split('T')[0];
    });

    const timelineData = nextTwoWeeks.map(date => {
      const count = purchaseOrders.filter(po => po.due_date === date).length;
      return { date, count };
    }).filter(item => item.count > 0);

    return { status: statusData, machines: machineData, timeline: timelineData };
  }, [purchaseOrders, shopSettings]);

  // Add status update function
  const updateStatus = async (poId, newStatus) => {
    try {
      // Find the status configuration to ensure we're using the correct case
      const statusConfig = shopSettings?.statuses?.find(s => s.name === newStatus);
      if (!statusConfig) {
        console.error('Invalid status:', newStatus);
        return;
      }

      // Use the exact status name from the configuration
      const response = await axios.patch(`/api/purchase-orders/${poId}`, { 
        status: statusConfig.name 
      });

      if (response.data) {
        // Update local state with the exact same status name we sent
        setPurchaseOrders(purchaseOrders.map(po => 
          po.id === poId ? { ...po, status: statusConfig.name } : po
        ));
        setEditingStatus(null);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      // Add error handling UI here
      alert('Failed to update status. Please try again.');
    }
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          backgroundColor: 'rgba(30, 30, 30, 0.9)', 
          border: '1px solid #333', 
          padding: '10px',
          color: '#e0e0e0'
        }}>
          <p className="label">{`${label}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
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
      <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">MISSION CONTROL</h1>
        <Link to="/upload-po" className="btn btn-primary glow-effect">
          <span className="mr-2">+</span> NEW MISSION
        </Link>
      </div>

      {/* Dashboard metrics summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">TOTAL MISSIONS</h3>
          <p className="text-3xl font-bold text-orange-500">{purchaseOrders.length}</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">PENDING</h3>
          <p className="text-3xl font-bold text-yellow-500">
            {purchaseOrders.filter(po => po.status === 'pending').length}
          </p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">UPCOMING DUE</h3>
          <p className="text-3xl font-bold text-blue-500">
            {purchaseOrders.filter(po => {
              if (!po.due_date) return false;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dueDate = new Date(po.due_date);
              const diffTime = dueDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays >= 0 && diffDays <= 7;
            }).length}
          </p>
        </div>
      </div>

      {/* Visualization tabs */}
      <div className="mb-4">
        <div className="flex space-x-2 border-b border-gray-700">
          <button 
            className={`py-2 px-4 ${activeTab === 'table' ? 'border-b-2 border-orange-500 text-orange-500' : 'text-gray-400'}`}
            onClick={() => setActiveTab('table')}
          >
            TABLE VIEW
          </button>
          <button 
            className={`py-2 px-4 ${activeTab === 'charts' ? 'border-b-2 border-orange-500 text-orange-500' : 'text-gray-400'}`}
            onClick={() => setActiveTab('charts')}
          >
            DASHBOARD ANALYTICS
          </button>
        </div>
      </div>

      {activeTab === 'charts' ? (
        <div className="card dashboard-card">
          <h2 className="text-xl font-semibold mb-6">MISSION ANALYTICS</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Status Distribution Chart */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-center">STATUS DISTRIBUTION</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.status}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.status.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Machine Utilization Chart */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-center">MACHINE UTILIZATION</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.machines}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chart.grid} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: COLORS.chart.text }} 
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis tick={{ fill: COLORS.chart.text }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Jobs">
                      {chartData.machines.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Due Date Timeline */}
          {chartData.timeline.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 text-center">UPCOMING DUE DATES</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData.timeline}
                    margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chart.grid} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: COLORS.chart.text }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tickFormatter={formatDate}
                    />
                    <YAxis tick={{ fill: COLORS.chart.text }} />
                    <Tooltip 
                      content={<CustomTooltip />}
                      labelFormatter={formatDate}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Due Items"
                      stroke={COLORS.orange}
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card dashboard-card">
          <h2 className="text-xl font-semibold mb-4">ACTIVE PURCHASE ORDERS</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left">PART NUMBER</th>
                  <th scope="col" className="px-6 py-3 text-left">REVISION</th>
                  <th scope="col" className="px-6 py-3 text-left">DUE DATE</th>
                  <th scope="col" className="px-6 py-3 text-left">MACHINE TYPE</th>
                  <th scope="col" className="px-6 py-3 text-left">QUANTITY</th>
                  <th scope="col" className="px-6 py-3 text-left">STATUS</th>
                  <th scope="col" className="px-6 py-3 text-left">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center">NO MISSIONS FOUND</td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{po.part_number || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{po.revision || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{po.due_date || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{po.machine || 'Not Assigned'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{po.quantity || 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingStatus === po.id ? (
                          <div className="relative">
                            <select
                              value={po.status}
                              onChange={(e) => updateStatus(po.id, e.target.value)}
                              onBlur={() => setEditingStatus(null)}
                              className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                              autoFocus
                            >
                              {shopSettings?.statuses?.map(status => (
                                <option key={status.id} value={status.name}>
                                  {status.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div
                            onClick={() => setEditingStatus(po.id)}
                            className={`rounded-md border-[1px] border-opacity-20 bg-opacity-90 ${getStatusStyle(po.status).className}`}
                            style={{
                              ...getStatusStyle(po.status).style,
                              backgroundColor: `${getStatusStyle(po.status).style.backgroundColor}22`,
                              borderColor: getStatusStyle(po.status).style.backgroundColor
                            }}
                          >
                            {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link to={`/po/${po.id}`} className="hover:underline">
                          VIEW DETAILS
                        </Link>
                        {po.status.toLowerCase() === 'completed' && (
                          <button
                            onClick={() => navigate(`/job-report/${po.id}`)}
                            className="ml-2 text-orange-500 hover:text-orange-400"
                          >
                            FILL REPORT
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 