const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const cors = require("cors");
const { router: roomsRouter } = require("./routes/rooms");
const setupVideoSync = require("./socket/videoSync");

dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: [process.env.FRONTEND_URL],
  credentials: true,
};

app.use(cors(corsOptions));

const io = new Server(server, {
  cors: corsOptions
});

app.use(express.json());
app.use("/api/rooms", roomsRouter);

app.get("/", (req, res) => {
  res.send("WatchTogether Backend");
});

app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

setupVideoSync(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});