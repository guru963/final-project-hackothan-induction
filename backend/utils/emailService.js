
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const Event = require("../models/Event.js");

// Create Ethereal test account and configure transporter
async function createTransporter() {
  // Create a test account with Ethereal
  const testAccount = await nodemailer.createTestAccount();
  
  // Create reusable transporter object using Ethereal test account
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
  
  console.log('Ethereal Email credentials:');
  console.log('User:', testAccount.user);
  console.log('Pass:', testAccount.pass);
  console.log('Preview URL will be logged after sending emails');
  
  return transporter;
}

// Helper function to generate QR code as data URL
const generateQRCode = async (text) => {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    console.error('QR code generation error:', err);
    return null;
  }
};

// Helper function to log message URL after sending
const logMessageUrl = (info) => {
  console.log('Email sent successfully');
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  return info;
};

// 1. Registration Email with QR Code
exports.sendQRCodeEmail = async (participant) => {
  try {
    const transporter = await createTransporter();
    
    // Fetch the event data
    const event = await Event.findById(participant.event);
    if (!event) throw new Error('Event not found');
    
    // Generate QR code
    const qrData = {
      secret: participant.qrSecret,
      eventId: participant.event.toString(),
      participantId: participant._id.toString()
    };
    
    const qrCode = await generateQRCode(JSON.stringify(qrData));
    if (!qrCode) throw new Error('Failed to generate QR code');
    
    const mailOptions = {
      from: '"Event Team" <event@example.com>',
      to: participant.email,
      subject: `Your Event Registration Confirmation - ${event.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Welcome to ${event.name}!</h2>
          <p>Dear ${participant.name},</p>
          <p>Thank you for registering for ${event.name}. Your registration is confirmed.</p>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Event Details:</h3>
          <ul>
            <li><strong>Event:</strong> ${event.name}</li>
            <li><strong>Dates:</strong> ${new Date(event.startDate).toLocaleDateString()} to ${new Date(event.endDate).toLocaleDateString()}</li>
            <li><strong>Venue:</strong> [Event Venue]</li>
          </ul>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Your QR Code:</h3>
          <p>Please present this QR code at the event for check-in and other activities:</p>
          <img src="${qrCode}" alt="QR Code" style="display: block; margin: 20px auto; width: 200px; height: 200px;"/>
          
          <p style="margin-top: 20px;"><strong>Important Notes:</strong></p>
          <ul>
            <li>This QR code is unique to you - please don't share it with others</li>
            <li>You'll need to present this QR code each day of the event</li>
            <li>The QR code may change color daily for security purposes</li>
          </ul>
          
          <p style="margin-top: 30px;">We look forward to seeing you at the event!</p>
          <p>Best regards,<br/>The Event Team</p>
        </div>
      `,
      attachments: [{
        filename: 'event-qrcode.png',
        content: qrCode.split('base64,')[1],
        encoding: 'base64'
      }]
    };

    const info = await transporter.sendMail(mailOptions);
    return logMessageUrl(info);
  } catch (error) {
    console.error('Error sending QR code email:', error);
    throw error; // Re-throw the error for better debugging
  }
};

// 2. Daily Check-In Confirmation
exports.sendCheckInConfirmationEmail = async (participant, currentDay) => {
  try {
    const transporter = await createTransporter();
    const event = await Event.findById(participant.event);
    if (!event) throw new Error('Event not found');
    
    const dayName = currentDay.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDay.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const mailOptions = {
      from: '"Event Team" <event@example.com>',
      to: participant.email,
      subject: `Check-in Confirmed for ${dayName}, ${formattedDate} - ${event.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Check-in Successful!</h2>
          <p>Dear ${participant.name},</p>
          <p>Your check-in for <strong>${dayName}, ${formattedDate}</strong> has been confirmed.</p>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Today's Schedule:</h3>
          <ul>
            <li><strong>Morning Session:</strong> 9:00 AM - 12:00 PM</li>
            <li><strong>Lunch:</strong> 12:00 PM - 1:30 PM</li>
            <li><strong>Afternoon Session:</strong> 1:30 PM - 5:00 PM</li>
            <li><strong>Kit Collection:</strong> Available until 6:00 PM</li>
          </ul>
          
          <p style="margin-top: 20px;"><strong>Check-in Time:</strong> ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">What's Next?</h3>
          <ul>
            <li>Show this email if requested by event staff</li>
            <li>Keep your QR code accessible for other activities</li>
            <li>Visit the information desk if you need assistance</li>
          </ul>
          
          <p style="margin-top: 30px;">Enjoy your day at ${event.name}!</p>
          <p>Best regards,<br/>The Event Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return logMessageUrl(info);
  } catch (error) {
    console.error('Error sending check-in confirmation email:', error);
    return false;
  }
};

// 3. Lunch Collection Confirmation
exports.sendLunchConfirmationEmail = async (participant, currentDay) => {
  try {
    const transporter = await createTransporter();
    const event = await Event.findById(participant.event);
    if (!event) throw new Error('Event not found');
    
    const dayName = currentDay.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDay.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const mailOptions = {
      from: '"Event Team" <event@example.com>',
      to: participant.email,
      subject: `Lunch Collected for ${dayName}, ${formattedDate} - ${event.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Lunch Collection Confirmed</h2>
          <p>Dear ${participant.name},</p>
          <p>Your lunch for <strong>${dayName}, ${formattedDate}</strong> has been successfully collected.</p>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Collection Details:</h3>
          <ul>
            <li><strong>Time Collected:</strong> ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</li>
            <li><strong>Location:</strong> Main Dining Hall</li>
          </ul>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Reminders:</h3>
          <ul>
            <li>Lunch is served between 12:00 PM - 1:30 PM daily</li>
            <li>Special dietary requirements? Visit the information desk</li>
            <li>Tomorrow's lunch will require QR code verification again</li>
          </ul>
          
          <p style="margin-top: 30px;">Enjoy your meal!</p>
          <p>Best regards,<br/>The Event Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return logMessageUrl(info);
  } catch (error) {
    console.error('Error sending lunch confirmation email:', error);
    return false;
  }
};

// 4. Kit Collection Confirmation
exports.sendKitConfirmationEmail = async (participant, currentDay) => {
  try {
    const transporter = await createTransporter();
    const event = await Event.findById(participant.event);
    if (!event) throw new Error('Event not found');
    
    const dayName = currentDay.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDay.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const mailOptions = {
      from: '"Event Team" <event@example.com>',
      to: participant.email,
      subject: `Event Kit Collected - ${event.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Event Kit Collection Confirmed</h2>
          <p>Dear ${participant.name},</p>
          <p>Your event kit has been successfully collected on <strong>${dayName}, ${formattedDate}</strong>.</p>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Kit Contents:</h3>
          <ul>
            <li>Event badge and lanyard</li>
            <li>Event schedule and program guide</li>
            <li>Promotional materials from sponsors</li>
            <li>Notebook and pen</li>
            <li>Other event merchandise</li>
          </ul>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Important Notes:</h3>
          <ul>
            <li>Please wear your badge at all times during the event</li>
            <li>Report any missing items to the information desk</li>
            <li>Keep your kit safe as replacements may not be available</li>
          </ul>
          
          <p style="margin-top: 30px;">We hope you enjoy the event!</p>
          <p>Best regards,<br/>The Event Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return logMessageUrl(info);
  } catch (error) {
    console.error('Error sending kit confirmation email:', error);
    return false;
  }
};

// 5. Daily Summary Email (sent at end of each event day)
exports.sendDailySummaryEmail = async (participant, currentDay, activities) => {
  try {
    const transporter = await createTransporter();
    const event = await Event.findById(participant.event);
    if (!event) throw new Error('Event not found');
    
    const dayName = currentDay.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDay.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const mailOptions = {
      from: '"Event Team" <event@example.com>',
      to: participant.email,
      subject: `Your ${event.name} Summary for ${dayName}, ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Today's Event Summary</h2>
          <p>Dear ${participant.name},</p>
          <p>Here's a summary of your activities for <strong>${dayName}, ${formattedDate}</strong>:</p>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Your Activities:</h3>
          <ul>
            <li><strong>Check-in:</strong> ${activities.checkInTime || 'Not recorded'}</li>
            <li><strong>Lunch Collected:</strong> ${activities.lunchCollected ? 'Yes' : 'No'}</li>
            <li><strong>Kit Collected:</strong> ${activities.kitCollected ? 'Yes' : 'No'}</li>
            <li><strong>Sessions Attended:</strong> ${activities.sessionsAttended || '0'}</li>
          </ul>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Tomorrow's Preview:</h3>
          <ul>
            <li><strong>First Session:</strong> 9:00 AM - [Topic]</li>
            <li><strong>Special Event:</strong> 2:00 PM - [Activity]</li>
            <li><strong>Don't Forget:</strong> Your QR code will be required again</li>
          </ul>
          
          <p style="margin-top: 30px;">Thank you for participating today. See you tomorrow!</p>
          <p>Best regards,<br/>The Event Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return logMessageUrl(info);
  } catch (error) {
    console.error('Error sending daily summary email:', error);
    return false;
  }
};

// 6. Final Day Thank You Email
exports.sendFinalDayEmail = async (participant, event) => {
  try {
    const transporter = await createTransporter();
    
    const mailOptions = {
      from: '"Event Team" <event@example.com>',
      to: participant.email,
      subject: `Thank You for Attending ${event.name}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Thank You for Being Part of ${event.name}!</h2>
          <p>Dear ${participant.name},</p>
          <p>We hope you enjoyed ${event.name} as much as we enjoyed having you!</p>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Event Highlights:</h3>
          <ul>
            <li>[Number] sessions attended</li>
            <li>[Number] meals collected</li>
            <li>[Number] connections made</li>
          </ul>
          
          <h3 style="color: #2c3e50; margin-top: 20px;">Next Steps:</h3>
          <ul>
            <li>Complete our <a href="#">post-event survey</a></li>
            <li>Download materials from our event portal</li>
            <li>Stay tuned for photos and event recap</li>
          </ul>
          
          <p style="margin-top: 30px;">We hope to see you at our future events!</p>
          <p>Best regards,<br/>The ${event.name} Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    return logMessageUrl(info);
  } catch (error) {
    console.error('Error sending final day email:', error);
    return false;
  }
};