// routes/participants.js
const express = require('express');
const router = express.Router();
const upload = require("../middleware/uploads.js");
const Participant = require("../models/Participant.js");
const Event=require("../models/Event.js")
const { authenticate } = require('../middleware/auth.js');
const {
  registerParticipant,
  scanQrCode,
  verifyLunch,
  markLunchCollected,
  confirmCheckIn,
  verifyKit,
  markKitCollected
} = require("../controllers/participants.js");
const { exportParticipantsCSV } = require("../controllers/exportCsv.js");
const { importParticipantsFromCSV } = require("../controllers/importCsv.js");

// Apply authentication middleware to all participant routes
router.use(authenticate);
// routes/participants.js

// Add endpoint to get daily stats
router.get('/:eventId/stats/daily', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const stats = [];
    
    // Generate dates between start and end date
    for (let d = new Date(event.startDate); d <= event.endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const participants = await Participant.find({ 
        event: req.params.eventId,
        'dailyActivities.date': { 
          $lte: new Date(new Date(d).setHours(23, 59, 59)),
          $gte: new Date(new Date(d).setHours(0, 0, 0))
        }
      });

      const dayStats = {
        date: dateStr,
        totalParticipants: participants.length,
        checkedIn: participants.filter(p => 
          p.dailyActivities.some(a => 
            a.date.toISOString().split('T')[0] === dateStr && 
            a.checkInStatus
          )
        ).length,
        lunchCollected: participants.filter(p => 
          p.dailyActivities.some(a => 
            a.date.toISOString().split('T')[0] === dateStr && 
            a.isgotLunch
          )
        ).length,
        kitCollected: participants.filter(p => 
          p.dailyActivities.some(a => 
            a.date.toISOString().split('T')[0] === dateStr && 
            a.isgotKit
          )
        ).length
      };

      stats.push(dayStats);
    }

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching daily stats',
      error: error.message
    });
  }
});
// Get all participants for an event
router.get('/:eventId', async (req, res) => {
    try {
        const participants = await Participant.find({ event: req.params.eventId })
            .sort({ registeredAt: -1 });
        
        res.status(200).json({
            success: true,
            count: participants.length,
            data: participants
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error fetching participants',
            error: error.message
        });
    }
});

// Register new participant for an event
router.post("/:eventId/register", registerParticipant);

// Scan QR code to verify participant for an event
router.post("/:eventId/scan", scanQrCode);

// Export participants for an event
router.get("/:eventId/export", exportParticipantsCSV);

// Import participants for an event
router.post("/:eventId/import", upload.single("file"), importParticipantsFromCSV);

// Lunch verification and collection for an event
router.post('/:eventId/lunch-verify', verifyLunch);
router.patch('/:eventId/lunch/:id', markLunchCollected);

// Check-in confirmation for an event
router.patch('/:eventId/checkin/:id', confirmCheckIn);

// Kit verification and collection for an event
router.post('/:eventId/kit-verify', verifyKit);
router.patch('/:eventId/kit/:id', markKitCollected);

module.exports = router;