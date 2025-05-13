// controllers/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User.js");

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
      expiresIn: "7d" 
    });

    res.status(201).json({ 
      message: "User registered successfully",
      user: { id: user._id, name: user.name, email: user.email },
      token 
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
      expiresIn: "7d" 
    });

    res.json({ 
      message: "Logged in successfully",
      user: { id: user._id, name: user.name, email: user.email },
      token 
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};