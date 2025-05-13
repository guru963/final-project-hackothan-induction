const fs = require("fs");
const csv = require("csv-parser");
const crypto = require("crypto");
const Participant = require("../models/Participant");
const Event = require("../models/Event");
const { sendQRCodeEmail } = require("../utils/emailService");

exports.importParticipantsFromCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded"
    });
  }

  const filePath = req.file.path;
  const eventId = req.params.eventId;

  let processedCount = 0;
  let duplicateCount = 0;
  let insertedCount = 0;
  let errorEntries = [];

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      fs.unlinkSync(filePath);
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const rawRows = [];

    // Step 1: Collect all rows from CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase()
        }))
        .on("data", (row) => rawRows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    processedCount = rawRows.length;

    // Track duplicates in batch
    const seenEmails = new Set();
    const seenPhones = new Set();
    const participants = [];

    // Step 2: Validate and build participants list
    for (const row of rawRows) {
      try {
        const cleanRow = {};
        for (const key in row) {
          cleanRow[key] = row[key]?.trim();
        }

        const { name, email, phone, college } = cleanRow;

        if (!name || !email || !phone || !college) {
          errorEntries.push({ row: cleanRow, reason: "Missing required fields" });
          continue;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const lowerEmail = email.toLowerCase();

        if (!emailRegex.test(lowerEmail)) {
          errorEntries.push({ row: cleanRow, reason: "Invalid email format" });
          continue;
        }

        if (seenEmails.has(lowerEmail) || seenPhones.has(phone)) {
          duplicateCount++;
          continue;
        }

        const exists = await Participant.findOne({
          event: eventId,
          $or: [
            { email: { $regex: new RegExp(`^${lowerEmail}$`, "i") } },
            { phone }
          ]
        });

        if (exists) {
          duplicateCount++;
          continue;
        }

        participants.push({
          name,
          email: lowerEmail,
          phone,
          college,
          event: eventId,
          qrSecret: crypto.randomBytes(16).toString("hex"),
          registeredAt: new Date(),
          dailyActivities: []
        });

        seenEmails.add(lowerEmail);
        seenPhones.add(phone);
      } catch (err) {
        errorEntries.push({ row, reason: err.message });
      }
    }

    // Step 3: Insert into DB
    if (participants.length > 0) {
      const result = await Participant.insertMany(participants);
      insertedCount = result.length;

      // Always send welcome emails - removed environment variable check
      await Promise.allSettled(
        result.map(p =>
          sendQRCodeEmail(p).catch(err =>
            console.error(`Email failed for ${p.email}:`, err)
          )
        )
      );
    }

    fs.unlinkSync(filePath); // Cleanup

    // ✅ Final response
    res.status(200).json({
      success: true,
      message: `Processed ${processedCount} rows. ${insertedCount} added, ${duplicateCount} duplicates, ${errorEntries.length} errors.`,
      stats: {
        processed: processedCount,
        added: insertedCount,
        duplicates: duplicateCount,
        errors: errorEntries.length
      },
      errors: errorEntries.length > 0 ? errorEntries : undefined
    });
  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.error("CSV Import Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import participants",
      error: error.message
    });
  }
};