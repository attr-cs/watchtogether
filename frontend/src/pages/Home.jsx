import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getActiveRoom } from "../utils/roomStorage";

function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Configure axios defaults
  axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;
  axios.defaults.headers.common["Content-Type"] = "application/json";

  useEffect(() => {
    const activeRoom = getActiveRoom();
    if (activeRoom) {
      navigate(`/room/${activeRoom}`);
    }
  }, [navigate]);

  const createRoom = async () => {
    if (isCreating) return;
    
    setIsCreating(true);
    setError(null);

    try {
      console.log("[Client] Sending create room request...");
      const response = await axios.post("/api/rooms/create");
      
      console.log("[Client] Room creation response:", response.data);
      
      if (response.data.success && response.data.roomCode) {
        const newRoomCode = response.data.roomCode;
        console.log(`[Client] Room created successfully: ${newRoomCode}`);
        
        // First try using navigate
        navigate(`/room/${newRoomCode}`);
        
        // Fallback: If navigation doesn't work within 100ms, use window.location
        setTimeout(() => {
          if (window.location.pathname !== `/room/${newRoomCode}`) {
            console.log("[Client] Fallback: Using window.location");
            window.location.href = `/room/${newRoomCode}`;
          }
        }, 100);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("[Client] Room creation error:", error);
      setError(error.response?.data?.error || "Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    console.log(`[Client] Joining room: ${roomCode}`);
    navigate(`/room/${roomCode.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            WatchTogether
          </h1>
          <p className="mt-4 text-gray-400">
            Watch videos together with friends in real-time
          </p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
          <button
            onClick={createRoom}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 
                     hover:to-blue-800 text-white py-4 px-6 rounded-xl text-lg font-semibold 
                     transform transition hover:scale-105 disabled:opacity-50 
                     disabled:cursor-not-allowed disabled:hover:scale-100
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            {isCreating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Room...
              </span>
            ) : "Create New Room"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">or join existing</span>
            </div>
          </div>

          <form onSubmit={joinRoom} className="space-y-4">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter Room Code"
              className="w-full bg-gray-700 text-white p-4 rounded-xl focus:outline-none 
                       focus:ring-2 focus:ring-blue-500 text-lg placeholder-gray-400"
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 
                       hover:to-green-800 text-white py-4 px-6 rounded-xl text-lg font-semibold 
                       transform transition hover:scale-105
                       focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Home;