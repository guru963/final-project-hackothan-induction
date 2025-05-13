// routes/events.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.js');
const { 
  createEvent, 
  getUserEvents,
  getEventDetails
} = require('../controllers/events.js');

router.use(authenticate);

router.post('/', createEvent);
router.get('/', getUserEvents);
router.get('/:eventId', getEventDetails);

module.exports = router;