const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Absolute path to the uploads directory
const uploadDir = path.join(__dirname, "../uploads");

// Ensure the folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

module.exports = multer({ storage });
