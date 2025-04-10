const { rooms } = require("../routes/rooms");

const setupVideoSync = (io) => {
  const syncStates = new Map(); // Track sync states per room
  
  // Track users with their nicknames
  const adjectives = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Swift', 'Brave', 'Bright'];
  const nouns = ['Panda', 'Fox', 'Eagle', 'Dolphin', 'Tiger', 'Wolf', 'Bear'];
  
  const generateNickname = () => {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}${Math.floor(Math.random() * 100)}`;
  };

  io.on("connection", (socket) => {
    let userNickname = generateNickname();
    
    console.log(`[Socket] New connection: ${socket.id}`);

    const updateRoomState = (roomCode, updates) => {
      if (!rooms[roomCode]) return;
      Object.assign(rooms[roomCode], updates);
      
      // Track last update time to prevent rapid updates
      if (!syncStates.has(roomCode)) {
        syncStates.set(roomCode, { lastUpdate: Date.now() });
      }
      syncStates.get(roomCode).lastUpdate = Date.now();
    };

    const canUpdateRoom = (roomCode) => {
      if (!syncStates.has(roomCode)) return true;
      const lastUpdate = syncStates.get(roomCode).lastUpdate;
      return Date.now() - lastUpdate > 500; // Minimum 500ms between updates
    };

    socket.on("join-room", (roomCode) => {
      if (!rooms[roomCode]) return;
      
        socket.join(roomCode);
        console.log(`[Room] ${socket.id} joined room: ${roomCode}`);
      
      // Initialize users as Map if it doesn't exist
      if (!rooms[roomCode].users || !(rooms[roomCode].users instanceof Map)) {
        rooms[roomCode].users = new Map();
      }

      // Add user to room with nickname
      rooms[roomCode].users.set(socket.id, {
        nickname: userNickname,
        joinedAt: new Date()
      });

      // Notify all users in room about new user
      io.to(roomCode).emit("user-joined", {
        userId: socket.id,
        nickname: userNickname,
        userCount: rooms[roomCode].users.size
      });

      // Send current room state to new user
      socket.emit("room-state", {
        video: rooms[roomCode].video,
        timestamp: rooms[roomCode].timestamp,
        playing: rooms[roomCode].playing,
        users: Array.from(rooms[roomCode].users.entries()),
        theme: rooms[roomCode].theme || 'dark'
      });

      // If video is playing, sync new user to current timestamp
      if (rooms[roomCode].playing) {
        socket.emit("sync-video", {
          video: rooms[roomCode].video,
          timestamp: rooms[roomCode].timestamp,
          playing: true
        });
      }
    });

    socket.on("play-video", ({ roomCode, timestamp, userId }) => {
      if (!rooms[roomCode] || !canUpdateRoom(roomCode)) return;
      
      updateRoomState(roomCode, {
        timestamp,
        playing: true,
        lastUpdatedBy: userId
      });

      socket.to(roomCode).emit("play-video", { timestamp, userId });
    });

    socket.on("pause-video", ({ roomCode, timestamp, userId }) => {
      if (!rooms[roomCode] || !canUpdateRoom(roomCode)) return;
      
      updateRoomState(roomCode, {
        timestamp,
        playing: false,
        lastUpdatedBy: userId
      });

      socket.to(roomCode).emit("pause-video", { timestamp, userId });
    });

    socket.on("seek-video", ({ roomCode, timestamp, userId }) => {
      if (!rooms[roomCode] || !canUpdateRoom(roomCode)) return;
      
      updateRoomState(roomCode, {
        timestamp,
        lastUpdatedBy: userId
      });

      socket.to(roomCode).emit("seek-video", { timestamp, userId });
    });

    socket.on("change-video", ({ roomCode, videoUrl }) => {
      if (rooms[roomCode]) {
        rooms[roomCode].video = videoUrl;
        rooms[roomCode].timestamp = 0; // Reset timestamp on video change
        rooms[roomCode].playing = false;
        console.log(`[Action] Video changed in ${roomCode} to ${videoUrl} by ${socket.id}`);
        io.to(roomCode).emit("sync-video", {
          video: videoUrl,
          timestamp: 0,
          playing: false,
        });
      }
    });

    socket.on("chat-message", ({ roomCode, message, replyTo }) => {
      if (!rooms[roomCode]) return;
      
        const chatMessage = {
        id: Date.now().toString(),
        userId: socket.id,
        nickname: rooms[roomCode].users.get(socket.id)?.nickname,
          message,
        replyTo,
        timestamp: new Date().toISOString()
      };

        io.to(roomCode).emit("chat-message", chatMessage);
    });

    socket.on("speed-change", ({ roomCode, speed, userId }) => {
      if (!rooms[roomCode]) return;
      
      rooms[roomCode].playbackSpeed = speed;
      console.log(`[Action] Speed changed in ${roomCode} to ${speed}x by ${userId}`);
      
      // Broadcast to all other users
      socket.to(roomCode).emit("speed-change", { speed, userId });
    });

    // Add reaction handling
    socket.on("reaction", ({ roomCode, reaction }) => {
      if (!rooms[roomCode]) return;
      
      io.to(roomCode).emit("reaction", {
        id: Date.now(),
        userId: socket.id,
        nickname: rooms[roomCode].users.get(socket.id)?.nickname,
        reaction,
        position: {
          x: 30 + Math.random() * 40, // Keep within middle 40% of screen
          y: Math.random() * 60 + 20  // Keep within middle 60% of screen
        }
      });
    });

    socket.on("theme-change", ({ roomCode, theme }) => {
      if (!rooms[roomCode]) return;
      rooms[roomCode].theme = theme;
      io.to(roomCode).emit("theme-change", { theme });
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      
      // Find all rooms this user was in
      for (const [roomCode, room] of Object.entries(rooms)) {
        if (room.users?.has(socket.id)) {
          const nickname = room.users.get(socket.id)?.nickname;
          room.users.delete(socket.id);
          
          // Notify remaining users
          io.to(roomCode).emit("user-left", {
            userId: socket.id,
            nickname,
            userCount: room.users.size
          });
          
          // If room is empty, clean up sync state
          if (room.users.size === 0) {
            syncStates.delete(roomCode);
          }
        }
      }
    });
  });
};

module.exports = setupVideoSync;