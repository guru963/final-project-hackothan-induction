// controllers/participants.js
const crypto = require("crypto");
const Participant = require("../models/Participant.js");
const Event = require("../models/Event.js");
const {
  sendQRCodeEmail,
  sendLunchConfirmationEmail,
  sendCheckInConfirmationEmail,
  sendKitConfirmationEmail
} = require("../utils/emailService.js");
const { getCurrentColor } = require("../utils/colorService.js");

// Modified helper function to get event day
const getCurrentEventDay = async (eventId, providedDate) => {
  const event = await Event.findById(eventId);
  if (!event) return null;
  
  const now = providedDate ? new Date(providedDate) : new Date();
  const eventDays = [];
  
  // Generate all event days
  for (let d = new Date(event.startDate); d <= event.endDate; d.setDate(d.getDate() + 1)) {
    eventDays.push(new Date(d));
  }
  
  // Find matching day
  return eventDays.find(day => 
    day.toISOString().split('T')[0] === now.toISOString().split('T')[0]
  ) || null;
};


exports.registerParticipant = async (req, res) => {
  const { name, phone, email, college } = req.body;
  const { eventId } = req.params; 

  try {
    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if participant already exists for this event
    const exists = await Participant.findOne({
      event: eventId,
      $or: [{ email }, { phone }]
    });

    if (exists) {
      return res.status(400).json({ message: "Phone or Email already registered for this event." });
    }

    const qrSecret = crypto.randomBytes(16).toString('hex');

    const newParticipant = new Participant({
      name, 
      phone, 
      email, 
      college, 
      qrSecret, 
      event: eventId,
      dailyActivities: [] // Initialize empty daily activities array
    });

    await newParticipant.save();

    // Send QR code via email
    const emailSent = await sendQRCodeEmail(newParticipant, event);
    
    if (!emailSent) {
      console.warn('QR code email failed to send, but participant was registered');
    }

    return res.status(201).json({
      message: "Registration successful! QR code has been sent to your email.",
      data: newParticipant,
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.scanQrCode = async (req, res) => {
  const { secret, color } = req.body;
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const currentColor = getCurrentColor(event.qrColorRotation);
    const currentDay = await getCurrentEventDay(eventId);
    
    if (!currentDay) {
      return res.status(400).json({ message: "Event is not active today." });
    }

    if (!secret) {
      return res.status(400).json({ message: "Missing QR secret." });
    }

    if (color !== currentColor) {
      return res.status(400).json({ message: "Invalid or expired QR (color mismatch)." });
    }

    const participant = await Participant.findOne({ 
      qrSecret: secret,
      event: eventId
    });

    if (!participant) {
      return res.status(404).json({ message: "Invalid QR (user not found)." });
    }

    const dailyActivity = participant.getDailyActivity(currentDay);

    if (dailyActivity && dailyActivity.checkInStatus) {
      return res.status(409).json({ message: "Already checked in today." });
    }

    return res.status(200).json({ 
      message: "Verification successful!", 
      participant,
      currentDay: currentDay.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Scan QR code error:', error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.confirmCheckIn = async (req, res) => {
  const { id } = req.params;
  const { eventId } = req.params;
  const { date } = req.body;
  
  try {
    // Convert the incoming date string to a Date object
    const currentDay = new Date(date);
    if (isNaN(currentDay.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    // Check if event is active on this date (your existing function)
    const eventDay = await getCurrentEventDay(eventId, currentDay);
    if (!eventDay) {
      return res.status(400).json({ message: "Event is not active on the specified date." });
    }

    const participant = await Participant.findById(id);
    if (!participant) {
      return res.status(404).json({ message: "Participant not found." });
    }
    
    // Format date for comparison (YYYY-MM-DD)
    const formattedDate = currentDay.toISOString().split('T')[0];
    
    // Find existing activity for this date
    const activityIndex = participant.dailyActivities.findIndex(
      activity => new Date(activity.date).toISOString().split('T')[0] === formattedDate
    );
    
    // If activity exists and already checked in
    if (activityIndex !== -1 && participant.dailyActivities[activityIndex].checkInStatus) {
      return res.status(409).json({ message: "Already checked in for this date." });
    }
    
    // Update or create the daily activity
    if (activityIndex !== -1) {
      // Update existing activity
      participant.dailyActivities[activityIndex].checkInStatus = true;
    } else {
      // Create new activity
      participant.dailyActivities.push({
        date: currentDay,
        checkInStatus: true,
        isgotLunch: false,
        isgotKit: false
      });
    }
    
    await participant.save();
    
    // Send confirmation email (passing Date object)
    await sendCheckInConfirmationEmail(participant,  new Date(date));
    
    return res.status(200).json({ 
      message: `Check-in confirmed for ${formattedDate}!`,
      participant 
    });
  } catch (error) {
    console.error('Check-in confirmation error:', error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.verifyLunch = async (req, res) => {
  const { secret, color, date } = req.body; // Add date parameter

  try {
    const currentColor = getCurrentColor();

    if (!secret) {
      return res.status(400).json({ message: "Missing QR secret." });
    }

    if (color !== currentColor) {
      return res.status(400).json({ message: "Invalid or expired QR (color mismatch)." });
    }

    const participant = await Participant.findOne({ qrSecret: secret });

    if (!participant) {
      return res.status(404).json({ message: "Invalid QR (user not found)." });
    }


    // Check for the specific date's lunch status
    const dailyActivity = participant.dailyActivities.find(
      activity => new Date(activity.date).toISOString().split('T')[0] === date
    );

    if (!dailyActivity) {
      return res.status(404).json({ message: "No activity record found for this date." });
    }

    if (dailyActivity.isgotLunch) {
      return res.status(409).json({ message: "Lunch already collected for this date." });
    }
    if (!dailyActivity.checkInStatus) {
      return res.status(400).json({ message: "Please check-in first before collecting lunch." });
    }

    return res.status(200).json({ message: "Lunch verification successful!", participant });
  } catch (error) {
    console.error('Lunch verification error:', error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.markLunchCollected = async (req, res) => {
  const { id } = req.params;
  const { date } = req.body; // Add date to the request body
  
  try {
    const participant = await Participant.findById(id);
    
    if (!participant) {
      return res.status(404).json({ message: "Participant not found." });
    }
    
    // Find the daily activity for the given date
    const activityIndex = participant.dailyActivities.findIndex(
      activity => new Date(activity.date).toISOString().split('T')[0] === date
    );
    
    if (activityIndex === -1) {
      return res.status(404).json({ message: "No activity record found for this date." });
    }
    
    if (participant.dailyActivities[activityIndex].isgotLunch) {
      return res.status(409).json({ message: "Lunch already collected for this date." });
    }
    
    if (!participant.dailyActivities[activityIndex].checkInStatus) {
      return res.status(400).json({ message: "Please check-in first before collecting lunch." });
    }
    
    // Update the specific day's lunch status
    participant.dailyActivities[activityIndex].isgotLunch = true;
    await participant.save();
    
    // Send notification email about lunch collection
    await sendLunchConfirmationEmail(participant, new Date(date));
    
    return res.status(200).json({ 
      message: `Lunch collection confirmed for ${date}!`,
      participant 
    });
  } catch (error) {
    console.error('Lunch collection error:', error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.verifyKit = async (req, res) => {
  const { secret, color, date } = req.body;
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const currentColor = getCurrentColor(event.qrColorRotation);
    
    if (!secret) {
      return res.status(400).json({ message: "Missing QR secret." });
    }

    if (color !== currentColor) {
      return res.status(400).json({ message: "Invalid or expired QR (color mismatch)." });
    }

    const participant = await Participant.findOne({ 
      qrSecret: secret,
      event: eventId
    });

    if (!participant) {
      return res.status(404).json({ message: "Invalid QR (user not found)." });
    }

    // Find the specific date's activity
    const activityIndex = participant.dailyActivities.findIndex(
      activity => new Date(activity.date).toISOString().split('T')[0] === date
    );

    if (activityIndex === -1) {
      return res.status(404).json({ message: "No activity record found for this date." });
    }

    if (!participant.dailyActivities[activityIndex].checkInStatus) {
      return res.status(400).json({ message: "Please check-in first before collecting kit." });
    }

    if (participant.dailyActivities[activityIndex].isgotKit) {
      return res.status(409).json({ message: "Kit already collected for this date." });
    }

    return res.status(200).json({ 
      message: "Kit verification successful!", 
      participant
    });
  } catch (error) {
    console.error('Kit verification error:', error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.markKitCollected = async (req, res) => {
  const { id } = req.params;
  const { date } = req.body;
  
  try {
    const participant = await Participant.findById(id);
    
    if (!participant) {
      return res.status(404).json({ message: "Participant not found." });
    }
    
    // Find the specific date's activity
    const activityIndex = participant.dailyActivities.findIndex(
      activity => new Date(activity.date).toISOString().split('T')[0] === date
    );
    
    if (activityIndex === -1) {
      return res.status(404).json({ message: "No activity record found for this date." });
    }
    
    if (!participant.dailyActivities[activityIndex].checkInStatus) {
      return res.status(400).json({ message: "Please check-in first before collecting kit." });
    }
    
    if (participant.dailyActivities[activityIndex].isgotKit) {
      return res.status(409).json({ message: "Kit already collected for this date." });
    }
    
    // Update the specific day's kit status
    participant.dailyActivities[activityIndex].isgotKit = true;
    await participant.save();
    
    // Send notification email about kit collection
    await sendKitConfirmationEmail(participant, new Date(date));
    
    return res.status(200).json({ 
      message: `Kit collection confirmed for ${date}!`,
      participant 
    });
  } catch (error) {
    console.error('Kit collection error:', error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};