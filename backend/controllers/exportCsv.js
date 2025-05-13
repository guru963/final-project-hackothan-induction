// Enhancement of the server-side controllers for Import/Export functionality

const { Parser } = require("json2csv");
const fs = require("fs");
const csv = require("csv-parser");
const crypto = require("crypto");
const Participant = require("../models/Participant.js");
const Event = require("../models/Event.js");
const { sendQRCodeEmail } = require("../utils/emailService.js");

/**
 * Enhanced export controller with filtering capabilities
 */
exports.exportParticipantsCSV = async (req, res) => {
  try {
    const { eventId } = req.params;
    let filters = {};
    
    // Parse filters if provided
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters);
      } catch (err) {
        console.error("Error parsing filters:", err);
      }
    }
    
    // Base query
    const baseQuery = { event: eventId };
    
    // Apply filters if not "all" selected
    if (!filters.all) {
      // Get the current date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Filter criteria array
      const filterCriteria = [];
      
      if (filters.checkedIn) {
        filterCriteria.push({
          dailyActivities: {
            $elemMatch: {
              checkInStatus: true
            }
          }
        });
      }
      
      if (filters.lunch) {
        filterCriteria.push({
          dailyActivities: {
            $elemMatch: {
              isgotLunch: true
            }
          }
        });
      }
      
      if (filters.kit) {
        filterCriteria.push({
          dailyActivities: {
            $elemMatch: {
              isgotKit: true
            }
          }
        });
      }
      
      // If any filters selected, add $and condition
      if (filterCriteria.length > 0) {
        baseQuery.$and = filterCriteria;
      }
    }
    
    // Find participants based on query
    const participants = await Participant.find(baseQuery);

    if (participants.length === 0) {
      return res.status(404).json({ message: "No participants found matching the criteria." });
    }

    // Get event details for the filename
    const event = await Event.findById(eventId);
    const eventName = event ? event.name.replace(/[^a-zA-Z0-9]/g, "_") : eventId;

    // Enhanced fields list with daily activities
    const fields = [
      {
        label: 'Name',
        value: 'name'
      },
      {
        label: 'Email',
        value: 'email'
      },
      {
        label: 'Phone',
        value: 'phone'
      },
      {
        label: 'College',
        value: 'college'
      },
      {
        label: 'Registration Date',
        value: row => new Date(row.registeredAt).toLocaleString()
      },
      {
        label: 'QR Code',
        value: 'qrSecret'
      },
      {
        label: 'Check-in Status',
        value: row => {
          const hasCheckedIn = row.dailyActivities && 
                              row.dailyActivities.some(a => a.checkInStatus);
          return hasCheckedIn ? 'Yes' : 'No';
        }
      },
      {
        label: 'Lunch Collected',
        value: row => {
          const hasLunch = row.dailyActivities && 
                          row.dailyActivities.some(a => a.isgotLunch);
          return hasLunch ? 'Yes' : 'No';
        }
      },
      {
        label: 'Kit Collected',
        value: row => {
          const hasKit = row.dailyActivities && 
                        row.dailyActivities.some(a => a.isgotKit);
          return hasKit ? 'Yes' : 'No';
        }
      },
      {
        label: 'Last Check-in Date',
        value: row => {
          if (!row.dailyActivities || !row.dailyActivities.length) return 'N/A';
          
          const checkedInDays = row.dailyActivities.filter(a => a.checkInStatus);
          if (!checkedInDays.length) return 'N/A';
          
          // Sort by date and get the latest
          const latestCheckIn = new Date(Math.max(...checkedInDays.map(d => new Date(d.date))));
          return latestCheckIn.toLocaleString();
        }
      }
    ];

    // Create CSV with enhanced options
    const json2csvParser = new Parser({ 
      fields,
      delimiter: ',',
      defaultValue: 'N/A'
    });
    
    const csv = json2csvParser.parse(participants);

    // Set headers for CSV download
    res.header("Content-Type", "text/csv");
    res.attachment(`${eventName}-participants-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("CSV Export Error:", error);
    res.status(500).json({ message: "Failed to export CSV", error: error.message });
  }
};