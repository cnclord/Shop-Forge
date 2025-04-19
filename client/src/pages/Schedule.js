import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const Schedule = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [shopSettings, setShopSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [viewMode, setViewMode] = useState('week'); // week, month
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedJob, setDraggedJob] = useState(null);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);
  const [newJob, setNewJob] = useState({
    poNumber: '',
    customer: '',
    dueDate: '',
    partNumber: '',
    revision: '',
    machine: '',
    status: 'pending',
    quantity: 1
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch purchase orders and shop settings in parallel
        const [posResponse, settingsResponse] = await Promise.all([
          axios.get('/api/purchase-orders'),
          axios.get('/api/shop-settings')
        ]);
        
        console.log('Purchase Orders Response:', posResponse.data);
        setPurchaseOrders(posResponse.data);
        setShopSettings(settingsResponse.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load schedule data');
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Calculate the date range for the current view
  const dateRange = useMemo(() => {
    const dates = [];
    const startDate = new Date(currentDate);
    
    // Reset to start of week/month
    if (viewMode === 'week') {
      const day = startDate.getDay();
      // Adjust to start from Monday (1) instead of Sunday (0)
      const daysToSubtract = day === 0 ? 6 : day - 1;
      startDate.setDate(startDate.getDate() - daysToSubtract);
      
      // Generate array of dates for the week
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push(date);
      }
    } else if (viewMode === 'month') {
      // Start from first day of month
      startDate.setDate(1);
      const month = startDate.getMonth();
      
      // Find the Monday before or on the first day of the month
      const firstDayOfMonth = startDate.getDay();
      const daysToSubtract = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
      startDate.setDate(startDate.getDate() - daysToSubtract);
      
      // Generate dates until we reach the next month
      while (dates.length < 42) { // Maximum 6 weeks
        const date = new Date(startDate);
        date.setDate(date.getDate() + dates.length);
        
        // Stop if we've gone past the end of the target month
        if (date.getMonth() !== month && dates.length > 28) {
          break;
        }
        
        dates.push(date);
      }
    }
    
    // Group dates by weeks
    const weeks = [];
    for (let i = 0; i < dates.length; i += 7) {
      weeks.push(dates.slice(i, i + 7));
    }
    
    return weeks;
  }, [currentDate, viewMode]);

  // Transform purchase orders data into format needed for display
  const scheduleByMachine = useMemo(() => {
    const result = [];
    
    // Add machines from shop settings
    if (shopSettings && shopSettings.machines) {
      shopSettings.machines.forEach(machine => {
        result.push({
          id: machine.id,
          name: machine.name,
          type: machine.type,
          jobs: []
        });
      });
    }
    
    // Add UNASSIGNED category
    result.push({
      id: 'unassigned',
      name: 'UNASSIGNED',
      type: 'N/A',
      jobs: []
    });

    // Group purchase orders by machine
    if (purchaseOrders && purchaseOrders.length) {
      purchaseOrders.forEach(po => {
        // Map database field names to the names we use in the component
        const job = {
          id: po.id,
          poNumber: po.po_number,
          partNumber: po.part_number,
          revision: po.revision,
          customer: po.customer,
          quantity: po.quantity || 1,
          scheduledStart: po.scheduled_start_date,
          scheduledEnd: po.scheduled_end_date,
          status: po.status || 'pending',
          dueDate: po.due_date,
          machine: po.machine,
          setup_time: po.part_data?.setup_time || 0,
          cycle_time: po.part_data?.cycle_time || 0,
          total_time_required: po.total_time_required
        };
        
        // Find the machine this job is assigned to
        const machineIndex = result.findIndex(m => m.id === po.machine);
        if (machineIndex >= 0 && po.scheduled_start_date && po.scheduled_end_date) {
          result[machineIndex].jobs.push(job);
        } else if (!po.machine || !po.scheduled_start_date || !po.scheduled_end_date) {
          // Only add to unassigned if it's truly unassigned (no machine) or missing dates
          const unassignedIndex = result.findIndex(m => m.id === 'unassigned');
          if (unassignedIndex >= 0) {
            result[unassignedIndex].jobs.push(job);
          }
        }
      });
    }
    
    return result;
  }, [purchaseOrders, shopSettings]);
  
  // Handle job drag start
  const handleDragStart = (job, machine) => {
    setDraggedJob({ job, fromMachine: machine });
  };
  
  // Handle dropping a job on a time slot
  const handleDrop = async (date, machineId) => {
    if (!draggedJob) return;
    
    try {
      // Calculate end date based on parts cycle times
      const totalHours = draggedJob.job.parts.reduce((total, part) => 
        total + (part.quantity * part.cycle_time) + (part.setup_time || 0), 0);
      
      const hoursPerDay = shopSettings.hoursPerDay;
      const daysPredicted = Math.ceil(totalHours / hoursPerDay);
      
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + daysPredicted);
      
      // Update job with new machine and dates
      await axios.patch(`/api/purchase-orders/${draggedJob.job.id}`, {
        machine: machineId,
        scheduled_start_date: startDate.toISOString().split('T')[0],
        scheduled_end_date: endDate.toISOString().split('T')[0]
      });
      
      // Refresh data
      const response = await axios.get('/api/purchase-orders');
      setPurchaseOrders(response.data);
      
    } catch (err) {
      console.error('Error updating job schedule:', err);
      setError('Failed to update job schedule');
    }
    
    setDraggedJob(null);
  };
  
  // Helper to check if a job is scheduled for a specific day
  const isJobScheduledForDay = (job, date) => {
    if (!job.scheduledStart) return false;
    
    const checkDate = new Date(date);
    const startDate = new Date(job.scheduledStart);
    
    // Calculate the end date based on the job duration
    const duration = calculateJobDuration(job);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + duration.totalDays - 1);
    
    // Reset time components for date comparison
    checkDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    // Check if the job is scheduled for this day
    const isInRange = checkDate >= startDate && checkDate <= endDate;
    
    // Check if it's an operating day
    if (isInRange && shopSettings?.operatingDays) {
      const dayOfWeek = checkDate.getDay();
      const isOperatingDay = shopSettings.operatingDays[DAY_NAMES[dayOfWeek]];
      
      return isOperatingDay;
    }
    
    return isInRange;
  };
  
  // Navigate to previous period
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };
  
  // Navigate to next period
  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };
  
  // Format date for display
  const formatDate = (date) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const formatted = date.toLocaleDateString(undefined, options);
    // Add opacity class if date is outside current month
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    return { formatted, isCurrentMonth };
  };
  
  // Get color based on job status
  const getStatusColor = (status) => {
    const statusConfig = shopSettings?.statuses?.find(s => s.name.toLowerCase() === status.toLowerCase());
    if (statusConfig) {
      return {
        className: 'border-transparent',
        style: { backgroundColor: statusConfig.color, color: 'white' }
      };
    }
    return {
      className: 'border-gray-600 bg-gray-700 text-gray-300'
    };
  };
  
  // Update the getNextOperatingDate to safely handle missing operating hours
  const getNextOperatingDate = (date) => {
    if (!shopSettings?.operatingDays) return date;
    
    const result = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    // If the time is after shop closing hours, we need to move to the next day
    const dayOfWeek = result.getDay();
    const dayKey = dayNames[dayOfWeek];
    
    // Safely access the end hour with a default value of 17 (5 PM)
    const endHour = shopSettings.operatingHours && 
                    shopSettings.operatingHours[`${dayKey}_end`] ? 
                    parseInt(shopSettings.operatingHours[`${dayKey}_end`]) : 17;
    
    if (result.getHours() >= endHour) {
      // Move to the next day and reset the time to start of business
      result.setDate(result.getDate() + 1);
    }
    
    // Find the next operating day
    let daysChecked = 0;
    while (daysChecked < 7) {
      const currentDayOfWeek = result.getDay();
      const currentDayKey = dayNames[currentDayOfWeek];
      
      if (shopSettings.operatingDays[currentDayKey]) {
        // This is an operating day
        // Safely access the start hour with a default value of 9 AM
        const startHour = shopSettings.operatingHours && 
                          shopSettings.operatingHours[`${currentDayKey}_start`] ? 
                          parseInt(shopSettings.operatingHours[`${currentDayKey}_start`]) : 9;
        
        result.setHours(startHour, 0, 0, 0);
        return result;
      }
      
      // Not an operating day, move to the next day
      result.setDate(result.getDate() + 1);
      daysChecked++;
    }
    
    // If we couldn't find an operating day, just return the original date
    return date;
  };
  
  // Update the addWorkingDays function to safely handle missing operating hours
  const addWorkingDays = (startDate, totalHours, shopSettings) => {
    if (!shopSettings?.operatingDays) return startDate;
    
    const result = new Date(startDate);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    let hoursRemaining = totalHours;
    
    while (hoursRemaining > 0) {
      const dayOfWeek = result.getDay();
      const dayKey = dayNames[dayOfWeek];
      
      // Check if this is an operating day
      if (shopSettings.operatingDays[dayKey]) {
        // Get operating hours for this day
        const startHour = shopSettings.operatingHours?.[`${dayKey}_start`] || 9;
        const endHour = shopSettings.operatingHours?.[`${dayKey}_end`] || 17;
        const hoursInDay = endHour - startHour;
        
        if (hoursInDay > 0) {
          // If this is the first day and we're starting mid-day,
          // calculate remaining hours in this day
          if (result.getTime() === startDate.getTime()) {
            const currentHour = result.getHours();
            if (currentHour >= startHour) {
              const remainingHoursToday = Math.max(0, endHour - currentHour);
              hoursRemaining -= Math.min(remainingHoursToday, hoursRemaining);
            } else {
              // We're before start time, use full day
              hoursRemaining -= Math.min(hoursInDay, hoursRemaining);
            }
          } else {
            // For subsequent days, use full day
            hoursRemaining -= Math.min(hoursInDay, hoursRemaining);
          }
        }
      }
      
      // If we still have hours remaining, move to next day
      if (hoursRemaining > 0) {
        result.setDate(result.getDate() + 1);
        result.setHours(shopSettings.operatingHours?.[`${dayNames[result.getDay()]}_start`] || 9, 0, 0, 0);
      }
    }
    
    // Set end time to the end of the work day
    const finalDayKey = dayNames[result.getDay()];
    const endHour = shopSettings.operatingHours?.[`${finalDayKey}_end`] || 17;
    result.setHours(endHour, 0, 0, 0);
    
    return result;
  };

  // Handle new job form input change
  const handleNewJobChange = (e) => {
    const { name, value } = e.target;
    setNewJob({
      ...newJob,
      [name]: value
    });
  };

  // Submit new job form
  const handleNewJobSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Create new job in database
      const response = await axios.put('/api/save-po', {
        poNumber: newJob.poNumber,
        customer: newJob.customer,
        dueDate: newJob.dueDate,
        part_number: newJob.partNumber,
        revision: newJob.revision,
        machine: newJob.machine,
        quantity: newJob.quantity
      });
      
      // Refresh data
      const posResponse = await axios.get('/api/purchase-orders');
      setPurchaseOrders(posResponse.data);
      
      // Reset form and close modal
      setNewJob({
        poNumber: '',
        customer: '',
        dueDate: '',
        partNumber: '',
        revision: '',
        machine: '',
        status: 'pending',
        quantity: 1
      });
      setShowNewJobModal(false);
      
    } catch (err) {
      console.error('Error creating new job:', err);
      setError('Failed to create new job');
    }
  };

  // Add a function to calculate total working days needed
  const calculateWorkingDaysNeeded = (totalHours, shopSettings) => {
    const hoursPerDay = shopSettings?.hoursPerDay || 8;
    return Math.ceil(totalHours / hoursPerDay);
  };

  // Update handleAutoSchedule
  const handleAutoSchedule = async () => {
    try {
      setAutoScheduling(true);
      setError(null);
      
      // Get unscheduled jobs
      const unscheduledJobs = purchaseOrders.filter(po => 
        !po.scheduled_start_date || !po.scheduled_end_date
      );
      
      // Sort jobs by due date and priority
      const sortedJobs = [...unscheduledJobs].sort((a, b) => {
        if (a.due_date && b.due_date) {
          return new Date(a.due_date) - new Date(b.due_date);
        }
        return a.due_date ? -1 : b.due_date ? 1 : 0;
      });

      // Keep track of machine schedules
      const machineSchedules = {};
      shopSettings.machines.forEach(machine => {
        machineSchedules[machine.id] = [];
      });

      // Load existing scheduled jobs into machineSchedules
      purchaseOrders
        .filter(po => po.scheduled_start_date && po.scheduled_end_date && po.machine)
        .forEach(job => {
          if (machineSchedules[job.machine]) {
            machineSchedules[job.machine].push({
              startDate: new Date(job.scheduled_start_date),
              endDate: new Date(job.scheduled_end_date),
              jobId: job.id
            });
          }
        });
      
      const updates = [];
      
      for (const job of sortedJobs) {
        // Calculate job duration
        const duration = calculateJobDuration(job);
        console.log(`Job ${job.id} (${job.part_number}) duration:`, duration);
        
        // Get the required machine type from part data
        const requiredMachineType = job.part_data?.machine;
        console.log('Required machine type:', requiredMachineType);
        
        // Find a suitable machine based on required type or first available
        let machineId = job.machine;
        if (!machineId) {
          // Try to find a machine matching the required type
          const availableMachine = shopSettings.machines.find(m => 
            requiredMachineType ? m.type === requiredMachineType : true
          );
          machineId = availableMachine ? availableMachine.id : null;
          
          if (requiredMachineType && !machineId) {
            console.warn(`Could not find available machine of type ${requiredMachineType} for job ${job.id}`);
            continue;
          }
        }

        // Find the next available date for the machine
        let startDate = new Date();
        
        if (machineSchedules[machineId] && machineSchedules[machineId].length > 0) {
          // Sort existing schedules by end date
          machineSchedules[machineId].sort((a, b) => a.endDate - b.endDate);
          
          // Get the latest end date
          const lastJob = machineSchedules[machineId][machineSchedules[machineId].length - 1];
          startDate = new Date(lastJob.endDate);
        }

        // Ensure we start on an operating day
        while (!shopSettings?.operatingDays?.[DAY_NAMES[startDate.getDay()]]) {
          startDate.setDate(startDate.getDate() + 1);
        }

        // Set to start of the operating day
        const startDayName = DAY_NAMES[startDate.getDay()];
        startDate.setHours(
          shopSettings.operatingHours?.[`${startDayName}_start`] || 9,
          0, 0, 0
        );

        // Calculate end date by adding required working days
        let endDate = new Date(startDate);
        let daysToAdd = calculateWorkingDaysNeeded(duration.totalTime, shopSettings);
        let daysAdded = 0;

        while (daysAdded < daysToAdd) {
          endDate.setDate(endDate.getDate() + 1);
          if (shopSettings?.operatingDays?.[DAY_NAMES[endDate.getDay()]]) {
            daysAdded++;
          }
        }

        // Set end time to end of the last working day
        const endDayName = DAY_NAMES[endDate.getDay()];
        endDate.setHours(
          shopSettings.operatingHours?.[`${endDayName}_end`] || 17,
          0, 0, 0
        );
        
        console.log(`Scheduling job ${job.id} (${job.part_number}):`, {
          startDate,
          endDate,
          totalHours: duration.totalTime,
          daysNeeded: daysToAdd,
          machineId
        });
        
        if (machineId) {
          // Add this job to the machine's schedule
          machineSchedules[machineId].push({
            startDate,
            endDate,
            jobId: job.id
          });

          updates.push({
            id: job.id,
            machine: machineId,
            scheduled_start_date: startDate.toISOString().split('T')[0],
            scheduled_end_date: endDate.toISOString().split('T')[0]
          });
        }
      }
      
      // Apply all updates
      if (updates.length > 0) {
        await axios.put('/api/schedule/batch', { updates });
        
        // Refresh data
        const response = await axios.get('/api/purchase-orders');
        setPurchaseOrders(response.data);
      }
      
      setAutoScheduling(false);
    } catch (err) {
      console.error('Error auto-scheduling:', err);
      setError('Failed to auto-schedule jobs');
      setAutoScheduling(false);
    }
  };

  // Reset all scheduled jobs
  const handleResetSchedule = async () => {
    // Show confirmation modal
    setShowConfirmResetModal(true);
  };

  // Confirm reset schedule
  const confirmResetSchedule = async () => {
    setAutoScheduling(true);
    setError(null);
    setShowErrorPopup(false);
    
    try {
      // Get all scheduled jobs
      const scheduledJobs = purchaseOrders.filter(
        po => po.scheduled_start_date || po.scheduled_end_date
      );
      
      if (scheduledJobs.length === 0) {
        setError('No scheduled jobs found to reset.');
        setShowErrorPopup(true);
        setAutoScheduling(false);
        setShowConfirmResetModal(false);
        return;
      }
      
      // Create updates to clear scheduling
      const updates = scheduledJobs.map(job => ({
        id: job.id,
        machine: null,
        scheduled_start_date: null,
        scheduled_end_date: null
      }));
      
      // Send updates to server
      await Promise.all(updates.map(update => 
        axios.patch(`/api/purchase-orders/${update.id}`, {
          machine: update.machine,
          scheduled_start_date: update.scheduled_start_date,
          scheduled_end_date: update.scheduled_end_date
        })
      ));
      
      // Refresh data
      const response = await axios.get('/api/purchase-orders');
      setPurchaseOrders(response.data);
      
      // No need to show success message
    } catch (err) {
      console.error('Error resetting schedule:', err);
      setError(`Failed to reset schedule: ${err.message}`);
      setShowErrorPopup(true);
    }
    
    setAutoScheduling(false);
    setShowConfirmResetModal(false);
  };

  // Cancel reset schedule
  const cancelResetSchedule = () => {
    setShowConfirmResetModal(false);
  };

  // Handle closing the error popup
  const handleDismissError = () => {
    setShowErrorPopup(false);
  };

  // Fix the getFinalOperatingEndDate function to safely handle missing operating hours
  const getFinalOperatingEndDate = (endDate, shopSettings) => {
    if (!shopSettings?.operatingDays) return endDate;
    
    let finalEndDate = new Date(endDate);
    // Check if end date is an operating day, if not find previous operating day
    const endDayOfWeek = finalEndDate.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    if (!shopSettings.operatingDays[dayNames[endDayOfWeek]]) {
      // If the calculated end date falls on a non-operating day, 
      // move it back to the previous operating day
      let daysChecked = 0;
      let currentDay = endDayOfWeek;
      
      while (daysChecked < 7) {
        currentDay = (currentDay - 1 + 7) % 7; // Move to previous day, wrap around
        if (shopSettings.operatingDays[dayNames[currentDay]]) {
          // Calculate days to subtract
          const daysToSubtract = (endDayOfWeek - currentDay + 7) % 7;
          finalEndDate.setDate(finalEndDate.getDate() - daysToSubtract);
          break;
        }
        daysChecked++;
      }
    }
    
    // Set the time to the end of the work day
    const dayKey = dayNames[finalEndDate.getDay()];
    const endHour = shopSettings.operatingHours && 
                   shopSettings.operatingHours[`${dayKey}_end`] ? 
                   parseInt(shopSettings.operatingHours[`${dayKey}_end`]) : 17;
    
    finalEndDate.setHours(endHour, 0, 0, 0);
    
    return finalEndDate;
  };

  // Add a function to calculate the real job duration based on setup time and cycle time
  const calculateJobDuration = (job) => {
    const setupTime = job.setup_time || job.part_data?.setup_time || 0.25; // Default to 0.25 hours
    const cycleTime = job.cycle_time || job.part_data?.cycle_time || 0.5; // Default to 0.5 hours (30 mins)
    const totalQuantity = job.quantity || 1;
    const operatingHoursPerDay = shopSettings?.hoursPerDay || 3;

    // Calculate parts per day
    const maxPartsFirstDay = Math.floor((operatingHoursPerDay - setupTime) / cycleTime); // 5 parts
    const maxPartsRegularDay = Math.floor(operatingHoursPerDay / cycleTime); // 6 parts

    // Calculate how many days needed
    let remainingParts = totalQuantity;
    let totalDays = 0;
    let totalHours = 0;

    // First day
    const firstDayParts = Math.min(maxPartsFirstDay, remainingParts);
    if (firstDayParts > 0) {
      totalDays = 1;
      remainingParts -= firstDayParts;
      totalHours = setupTime + (firstDayParts * cycleTime);
    }

    // Subsequent days
    if (remainingParts > 0) {
      const additionalFullDays = Math.floor(remainingParts / maxPartsRegularDay);
      const remainderParts = remainingParts % maxPartsRegularDay;
      
      totalDays += additionalFullDays;
      totalHours += additionalFullDays * (maxPartsRegularDay * cycleTime);

      if (remainderParts > 0) {
        totalDays += 1;
        totalHours += remainderParts * cycleTime;
      }
    }

    // Adjust total days to account for non-operating days
    if (shopSettings?.operatingDays) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      let adjustedDays = 0;
      let currentDay = new Date(job.scheduledStart || new Date());
      let daysToAdd = totalDays;

      while (daysToAdd > 0) {
        const dayOfWeek = currentDay.getDay();
        const isOperatingDay = shopSettings.operatingDays[dayNames[dayOfWeek]];
        
        if (isOperatingDay) {
          daysToAdd--;
        }
        adjustedDays++;
        currentDay.setDate(currentDay.getDate() + 1);
      }
      totalDays = adjustedDays;
    }

    console.log('Job Duration Calculation:', {
      setupTime,
      cycleTime,
      totalQuantity,
      maxPartsFirstDay,
      maxPartsRegularDay,
      totalDays,
      totalHours,
      operatingDays: shopSettings?.operatingDays
    });

    return {
      setupTime,
      cycleTime,
      totalTime: totalHours,
      totalDays
    };
  };

  // Add function to calculate parts completed per day
  const calculatePartsCompletedByDay = (job, date) => {
    if (!job.scheduledStart) return 0;
    
    const checkDate = new Date(date);
    const startDate = new Date(job.scheduledStart);
    
    // Reset time components for date comparison
    checkDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    
    // If this is before the start date, no parts completed
    if (checkDate < startDate) return 0;
    
    const totalQuantity = job.quantity || 1;
    
    // Get the job duration in days
    const scheduledEndDate = job.scheduledEnd ? new Date(job.scheduledEnd) : null;
    if (!scheduledEndDate) return 0;
    
    scheduledEndDate.setHours(0, 0, 0, 0);
    
    // If this is after the end date, all parts are completed
    if (checkDate > scheduledEndDate) return totalQuantity;
    
    // Calculate days passed including the current day
    const daysPassed = Math.floor((checkDate - startDate) / (24 * 60 * 60 * 1000)) + 1;
    const totalDays = Math.floor((scheduledEndDate - startDate) / (24 * 60 * 60 * 1000)) + 1;
    
    // Calculate proportional parts completed
    const partsCompleted = Math.min(
      Math.ceil((daysPassed / totalDays) * totalQuantity),
      totalQuantity
    );
    
    return partsCompleted;
  };

  const calculatePartsForDay = (job, date, shopSettings) => {
    // Get the setup time and cycle time
    const setupTime = job.setup_time || job.part_data?.setup_time || 0.25; // Default to 0.25 hours
    const cycleTime = job.cycle_time || job.part_data?.cycle_time || 0.5; // Default to 0.5 hours (30 mins)
    const totalQuantity = job.quantity || 1;

    // Calculate which day of the job this is (1-based)
    const startDate = new Date(job.scheduledStart);
    const currentDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    // If this date is before the start date, return 0
    if (currentDate < startDate) {
        return { partsPerDay: 0, hoursPerDay: 0, totalQuantity };
    }

    // Check if this is an operating day
    const dayOfWeek = currentDate.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const isOperatingDay = shopSettings?.operatingDays ? 
        shopSettings.operatingDays[dayNames[dayOfWeek]] : true;

    if (!isOperatingDay) {
        return { partsPerDay: 0, hoursPerDay: 0, totalQuantity };
    }

    // Get the operating hours for this specific day
    const operatingHoursForDay = shopSettings?.operatingHours?.[dayNames[dayOfWeek]] || 8;

    // Calculate how many parts we can make today based on operating hours
    const maxPartsToday = Math.floor(operatingHoursForDay / cycleTime);

    // Get actual completed parts up to yesterday
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const completedParts = calculatePartsCompletedByDay(job, yesterday);

    // Calculate remaining parts
    const remainingParts = Math.max(0, totalQuantity - completedParts);

    // Calculate parts to make today
    let partsPerDay = Math.min(maxPartsToday, remainingParts);
    let hoursPerDay = partsPerDay * cycleTime;

    // If this is the first day, account for setup time
    if (currentDate.getTime() === startDate.getTime()) {
        const maxPartsFirstDay = Math.floor((operatingHoursForDay - setupTime) / cycleTime);
        partsPerDay = Math.min(maxPartsFirstDay, remainingParts);
        hoursPerDay = setupTime + (partsPerDay * cycleTime);
    }

    // Ensure we never return negative values
    partsPerDay = Math.max(0, partsPerDay);
    hoursPerDay = Math.max(0, hoursPerDay);

    console.log(`
=== JOB CALCULATION DEBUG ===
Raw job data:
- ID: ${job.id}
- Part Number: ${job.partNumber}
- Setup Time: ${setupTime} hours
- Cycle Time: ${cycleTime} hours
- Quantity: ${totalQuantity}
- Operating Hours for ${dayNames[dayOfWeek]}: ${operatingHoursForDay}
- Max Parts Today: ${maxPartsToday}
- Completed Parts: ${completedParts}
- Remaining Parts: ${remainingParts}
- Parts Per Day: ${partsPerDay}
- Hours Per Day: ${hoursPerDay}
=== END DEBUG ===
`);

    return {
        partsPerDay,
        hoursPerDay,
        totalQuantity
    };
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
        <h1 className="text-2xl font-bold">PRODUCTION SCHEDULE</h1>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowNewJobModal(true)} 
            className="btn btn-primary glow-effect"
          >
            <span className="mr-2">+</span> NEW JOB
          </button>
          <Link to="/upload-po" className="btn btn-secondary">
            UPLOAD PO
          </Link>
          <button
            onClick={handleAutoSchedule}
            className={`btn ${autoScheduling ? 'btn-secondary opacity-75' : 'btn-primary'} glow-effect`}
            disabled={autoScheduling}
          >
            {autoScheduling ? (
              <div className="flex items-center">
                <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-black rounded-full"></div>
                SCHEDULING...
              </div>
            ) : 'AUTO SCHEDULE'}
          </button>
          <button
            onClick={handleResetSchedule}
            className={`btn ${autoScheduling ? 'btn-secondary opacity-75' : 'btn-error'} glow-effect`}
            disabled={autoScheduling}
          >
            RESET SCHEDULE
          </button>
          <div className="flex rounded-md overflow-hidden">
            <button 
              className={`px-4 py-2 font-mono ${viewMode === 'week' ? 'bg-orange-600 text-black' : 'bg-gray-800 text-gray-300'}`}
              onClick={() => setViewMode('week')}
            >
              WEEK
            </button>
            <button 
              className={`px-4 py-2 font-mono ${viewMode === 'month' ? 'bg-orange-600 text-black' : 'bg-gray-800 text-gray-300'}`}
              onClick={() => setViewMode('month')}
            >
              MONTH
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={goToPrevious}
              className="p-2 rounded-md hover:bg-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            <span className="font-mono text-sm">
              {viewMode === 'week' 
                ? `WEEK OF ${dateRange[0][0]?.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}` 
                : dateRange[0][0]?.toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}
            </span>
            
            <button 
              onClick={goToNext}
              className="p-2 rounded-md hover:bg-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error Popup */}
      {showErrorPopup && error && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-gray-900 border border-red-700 text-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-orange-500">
                {error.includes('Successfully') ? 'Success!' : 'Error!'}
              </h3>
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

      {/* Confirm Reset Modal */}
      {showConfirmResetModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-gray-900 border border-red-600 text-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-red-500">
                Confirm Reset
              </h3>
              <button 
                onClick={cancelResetSchedule}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-6">Are you sure you want to reset the entire schedule? This will clear all scheduled dates and machine assignments for all jobs.</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelResetSchedule}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetSchedule}
                className="btn btn-error glow-effect"
              >
                Reset Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Grid */}
      <div className="overflow-x-auto">
        <div className="w-full">
          {/* Week sections */}
          {dateRange.map((week, weekIndex) => (
            <div key={weekIndex} className="mb-8">
              {/* Header row with dates for this week */}
              <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-2 mb-2">
                <div className="bg-[#1a1a1a] rounded p-2 font-mono text-sm text-orange-500 font-bold">
                  MACHINE
                </div>
                
                {week.map((date, index) => {
                  const dayOfWeek = date.getDay();
                  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const dayName = dayNames[dayOfWeek];
                  const isOperatingDay = shopSettings?.operatingDays ? 
                    shopSettings.operatingDays[dayName] : true;
                  const { formatted, isCurrentMonth } = formatDate(date);
                  
                  return (
                    <div 
                      key={index} 
                      className={`bg-[#1a1a1a] rounded p-2 font-mono text-xs text-center ${
                        !isOperatingDay
                          ? 'text-red-400 opacity-50' 
                          : !isCurrentMonth && viewMode === 'month'
                          ? 'text-gray-600'
                          : 'text-gray-300'
                      }`}
                    >
                      {formatted}
                    </div>
                  );
                })}
              </div>
              
              {/* Machine rows for this week */}
              {scheduleByMachine.map(machine => (
                <div key={machine.id} className="mb-2">
                  <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-2">
                    {/* Machine column */}
                    <div className="bg-[#1f1f1f] rounded p-2 h-24">
                      <div className="font-mono text-lg font-bold">{machine.name}</div>
                      <div className="text-sm text-gray-400">{machine.type}</div>
                    </div>
                    
                    {/* Date columns for this week */}
                    {week.map((date, index) => {
                      const dayOfWeek = date.getDay();
                      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                      const dayName = dayNames[dayOfWeek];
                      const isOperatingDay = shopSettings?.operatingDays ? 
                        shopSettings.operatingDays[dayName] : true;
                      const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                      
                      return (
                        <div 
                          key={index} 
                          className={`h-24 rounded ${
                            !isOperatingDay 
                              ? 'bg-[#1a1a1a] opacity-50' 
                              : !isCurrentMonth && viewMode === 'month'
                              ? 'bg-[#1a1a1a] opacity-30'
                              : 'bg-[#1f1f1f]'
                          }`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(date, machine.id)}
                        >
                          {/* Jobs scheduled for this date */}
                          {machine.jobs
                            .filter(job => isJobScheduledForDay(job, date))
                            .map(job => {
                              const calculation = calculatePartsForDay(job, date, shopSettings);
                              return (
                                <div 
                                  key={job.id}
                                  className={`h-[88px] mx-0.5 my-0.5 rounded-md border-[1px] border-opacity-20 bg-opacity-90 flex flex-col ${getStatusColor(job.status).className}`}
                                  style={{
                                    ...getStatusColor(job.status).style,
                                    backgroundColor: `${getStatusColor(job.status).style.backgroundColor}22`,
                                    borderColor: getStatusColor(job.status).style.backgroundColor
                                  }}
                                  draggable
                                  onDragStart={() => handleDragStart(job, machine.id)}
                                >
                                  <Link to={`/po/${job.id}`} className="block flex-1 flex flex-col">
                                    {/* Part Number Header */}
                                    <div className="font-mono text-[10px] font-bold text-orange-400 border-b border-orange-400 border-opacity-20 px-1.5 py-0.5">
                                      {job.partNumber || 'No Part #'}
                                    </div>
                                    
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-0.5 p-1 flex-1">
                                      <div className="flex flex-col items-center justify-center bg-black bg-opacity-40 rounded">
                                        <span className="text-[8px] text-gray-400">Today</span>
                                        <span className="font-mono font-bold text-[11px] text-orange-400">{calculation.partsPerDay}</span>
                                      </div>
                                      <div className="flex flex-col items-center justify-center bg-black bg-opacity-40 rounded">
                                        <span className="text-[8px] text-gray-400">Complete</span>
                                        <span className="font-mono font-bold text-[11px] text-gray-200">{calculatePartsCompletedByDay(job, date)}</span>
                                      </div>
                                      <div className="flex flex-col items-center justify-center bg-black bg-opacity-40 rounded">
                                        <span className="text-[8px] text-gray-400">Total</span>
                                        <span className="font-mono font-bold text-[11px] text-gray-200">{calculation.totalQuantity}</span>
                                      </div>
                                    </div>

                                    {/* Operator */}
                                    <div className="px-1.5 py-0.5 border-t border-gray-700 border-opacity-20">
                                      <div className="flex items-center gap-1.5 text-[9px]">
                                        <span className="text-gray-400 shrink-0">Operator:</span>
                                        <span className="font-mono text-gray-200 bg-black bg-opacity-40 px-1.5 rounded w-full text-center">
                                          {job.operator || 'Unassigned'}
                                        </span>
                                      </div>
                                    </div>
                                  </Link>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Unscheduled Jobs Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4 text-orange-400 font-mono">UNSCHEDULED JOBS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {purchaseOrders
            .filter(po => !po.scheduled_start_date || !po.scheduled_end_date)
            .map(po => (
              <div 
                key={po.id}
                className="bg-[#1f1f1f] rounded-md border-[1px] border-opacity-20"
                style={{
                  borderColor: getStatusColor(po.status || 'pending').style.backgroundColor
                }}
                draggable
                onDragStart={() => handleDragStart({
                  id: po.id,
                  poNumber: po.po_number,
                  partNumber: po.part_number,
                  customer: po.customer || po.customer_name,
                  status: po.status || 'pending',
                  dueDate: po.due_date,
                  parts: po.parts || [],
                  quantity: po.quantity || 1
                }, 'unscheduled')}
              >
                <Link to={`/po/${po.id}`} className="block p-3">
                  <div className="font-mono text-sm font-bold text-orange-400 border-b border-orange-400 border-opacity-20 pb-1.5 mb-2">
                    {po.part_number || po.po_number}
                  </div>
                  <div className="text-sm text-gray-300 mb-2">{po.customer || po.customer_name}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col items-center justify-center bg-black bg-opacity-40 rounded p-1">
                      <span className="text-[8px] text-gray-400">Due Date</span>
                      <span className="font-mono font-bold text-[11px] text-gray-200">
                        {po.due_date ? new Date(po.due_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-black bg-opacity-40 rounded p-1">
                      <span className="text-[8px] text-gray-400">Quantity</span>
                      <span className="font-mono font-bold text-[11px] text-gray-200">
                        {po.quantity || 1}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
        </div>
      </div>

      {/* New Job Modal */}
      {showNewJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg shadow-lg max-w-md w-full p-6 border border-orange-600">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-orange-500 font-mono">NEW MISSION</h2>
              <button 
                onClick={() => setShowNewJobModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleNewJobSubmit}>
              <div className="grid grid-cols-1 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">PO NUMBER *</span>
                  </label>
                  <input
                    type="text"
                    name="poNumber"
                    value={newJob.poNumber}
                    onChange={handleNewJobChange}
                    className="input"
                    required
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">CUSTOMER *</span>
                  </label>
                  <input
                    type="text"
                    name="customer"
                    value={newJob.customer}
                    onChange={handleNewJobChange}
                    className="input"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">PART NUMBER</span>
                    </label>
                    <input
                      type="text"
                      name="partNumber"
                      value={newJob.partNumber}
                      onChange={handleNewJobChange}
                      className="input"
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">REVISION</span>
                    </label>
                    <input
                      type="text"
                      name="revision"
                      value={newJob.revision}
                      onChange={handleNewJobChange}
                      className="input"
                    />
                  </div>
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">QUANTITY *</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    name="quantity"
                    value={newJob.quantity}
                    onChange={handleNewJobChange}
                    className="input"
                    required
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">DUE DATE</span>
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={newJob.dueDate}
                    onChange={handleNewJobChange}
                    className="input"
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">MACHINE TYPE</span>
                  </label>
                  <select
                    name="machine"
                    value={newJob.machine}
                    onChange={handleNewJobChange}
                    className="select"
                  >
                    <option value="">Select Machine Type</option>
                    {shopSettings?.machineTypes?.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end mt-6 space-x-3">
                <button
                  type="button"
                  onClick={() => setShowNewJobModal(false)}
                  className="btn btn-secondary"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="btn btn-primary glow-effect"
                >
                  CREATE MISSION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule; 