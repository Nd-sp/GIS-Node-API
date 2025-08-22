const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const db = require("./db");

const app = express();
app.use(express.json());

// Middleware: verify admin
const verifyAdmin = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token.split(" ")[1], process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }
    req.user = user;
    next();
  });
};

// User login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db("users").where({ username }).first();
    if (!user) return res.status(400).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token, role: user.role, message: "User login successfully" });
   
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin login
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db("users").where({ username }).first();
    if (!user) return res.status(400).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Invalid password" });

    if (user.role !== "admin") return res.status(403).json({ message: "Not an admin" });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token,message: "admin login successfully" });
  
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new user (admin only)
app.post("/admin/create-user", verifyAdmin, async (req, res) => {
  const {
    name,
    username,
    email,
    mobile,
    password,
    confirmPassword,
    designation,
    location,
    role,
  } = req.body;

  // Validate required fields
  if (!name || !username || !email || !mobile || !password || !confirmPassword) {
    return res.status(400).json({ message: "All required fields must be filled" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await db("users").insert({
      name,
      username,
      email,
      mobile,
      password: hashedPassword,
      designation: designation || null,
      location: location || null,
      role: role || "user",
    });

    res.json({ message: "User created successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
