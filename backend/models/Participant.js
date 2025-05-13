// models/Participant.js
const mongoose = require("mongoose");

const dailyActivitySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  checkInStatus: { type: Boolean, default: false },
  isgotLunch: { type: Boolean, default: false },
  isgotKit: { type: Boolean, default: false }
});

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  college: { type: String, required: true },
  qrSecret: { type: String, unique: true },
  registeredAt: { type: Date, default: Date.now },
  event: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Event", 
    required: true 
  },
  dailyActivities: [dailyActivitySchema],
  // Add compound index to ensure unique email/phone per event
}, { 
  indexes: [
    { event: 1, email: 1, unique: true },
    { event: 1, phone: 1, unique: true }
  ]
});

// Helper method to get or create daily activity
participantSchema.methods.getDailyActivity = function(date) {
  const dateStr = date.toISOString().split('T')[0];
  let activity = this.dailyActivities.find(a => 
    a.date.toISOString().split('T')[0] === dateStr
  );
  
  if (!activity) {
    activity = { date, checkInStatus: false, isgotLunch: false, isgotKit: false };
    this.dailyActivities.push(activity);
    return activity;
  }
  
  return activity;
};

module.exports = mongoose.model("Participant", participantSchema);