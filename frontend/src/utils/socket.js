import io from "socket.io-client";

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  reconnection: false, // Prevent automatic reconnection attempts
});

export default socket;