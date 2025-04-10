const express = require("express");
const router = express.Router();

let rooms = {};

router.post("/create", async (req, res) => {
  try {
    const roomCode = Math.random().toString(36).substring(7);
    rooms[roomCode] = { 
      users: new Map(),
      video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      timestamp: 0, 
      playing: false,
      createdAt: new Date().toISOString()
    };
    
    console.log(`[Room] Created room: ${roomCode}`);
    res.status(201).json({ 
      success: true,
      roomCode,
      message: "Room created successfully" 
    });
  } catch (error) {
    console.error("[Room Creation Error]", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to create room" 
    });
  }
});

router.get("/:roomCode", (req, res) => {
  try {
    const { roomCode } = req.params;
    if (rooms[roomCode]) {
      res.json({ 
        success: true,
        roomCode, 
        room: rooms[roomCode] 
      });
    } else {
      res.status(404).json({ 
        success: false,
        error: "Room not found" 
      });
    }
  } catch (error) {
    console.error("[Room Fetch Error]", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch room" 
    });
  }
});

module.exports = { router, rooms };