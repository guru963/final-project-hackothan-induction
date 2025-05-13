// controllers/events.js
const Event = require("../models/Event.js");
const Participant = require("../models/Participant.js");

exports.createEvent = async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;
    
    const event = new Event({
      name,
      description,
      startDate,
      endDate,
      createdBy: req.user._id
    });

    await event.save();

    res.status(201).json({
      message: "Event created successfully",
      event
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to create event", 
      error: error.message 
    });
  }
};

exports.getUserEvents = async (req, res) => {
  try {
    const events = await Event.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      message: "Events fetched successfully",
      events
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch events", 
      error: error.message 
    });
  }
};

exports.getEventDetails = async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.eventId,
      createdBy: req.user._id
    }).populate("createdBy", "name email");

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Get participant counts
    const totalParticipants = await Participant.countDocuments({ event: event._id });
    const checkedInParticipants = await Participant.countDocuments({ 
      event: event._id, 
      checkInStatus: true 
    });

    res.json({
      message: "Event details fetched successfully",
      event: {
        ...event.toObject(),
        stats: {
          totalParticipants,
          checkedInParticipants
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch event details", 
      error: error.message 
    });
  }
};