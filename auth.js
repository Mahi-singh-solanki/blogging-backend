const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const router = express.Router();

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    createdAt: { type: Date, default: Date.now },
  })
);

//signup router
router.post("/auth/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    const token = jwt.sign({ userId: user._id }, "secret", { expiresIn: "1h" });
    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server not working" });
  }
});

//login router
router.post("/auth/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && (await bcrypt.compare(req.body.password, user.password))) {
    const token = jwt.sign({ userId: user._id }, "secret", { expiresIn: "1h" });
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

//JWT middleware
async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      // decode token
      const decoded = jwt.verify(token, "secret");

      // fetch user from DB
      const dbUser = await User.findById(decoded.userId).select("-password");
      if (!dbUser) return res.status(404).json({ error: "User not found" });

      req.user = dbUser; // attach to request
      next();
    } catch (err) {
      console.error(err);
      return res.status(403).json({ error: "Invalid or expired token" });
    }
  }
}
function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
}

router.get("/auth/me", authenticateJWT, async (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    createdAt: req.user.createdAt,
  });
});

module.exports = { router, authenticateJWT, verifyAdmin };
