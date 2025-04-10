import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../utils/socket";
import ReactPlayer from "react-player";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import { Tooltip } from "react-tooltip";
import confetti from "canvas-confetti";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { saveActiveRoom, clearActiveRoom } from "../utils/roomStorage";
import { 
  MessageCircle, 
  Share2, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2,
  ThumbsUp,
  Heart,
  Laugh,
  Star,
  PartyPopper,
  Palette,
  Smile,
  Sparkles,
  Play,
  Pause,
  Reply
} from 'lucide-react';
import screenfull from 'screenfull';

function Room() {
  const { roomCode } = useParams();
  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [timestamp, setTimestamp] = useState(0);
  const [videoUrl, setVideoUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [newUrl, setNewUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastAction = useRef(null); // Track last action to prevent loops
  const [syncTimeout, setSyncTimeout] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const SYNC_THRESHOLD = 2; // seconds
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const chatRef = useRef(null);
  const [localStateChange, setLocalStateChange] = useState(false);
  const [lastEventTime, setLastEventTime] = useState(0);
  const EVENT_THROTTLE = 1000; // 1 second minimum between events
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [userName, setUserName] = useState(`User-${Math.random().toString(36).substr(2, 4)}`);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [users, setUsers] = useState(new Map());
  const [userCount, setUserCount] = useState(0);
  const [theme, setTheme] = useState('dark');
  const [replyTo, setReplyTo] = useState(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const messageInputRef = useRef(null);
  const [showChat, setShowChat] = useState(true);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [quality, setQuality] = useState('auto');
  const [subtitle, setSubtitle] = useState('');
  const [playlist, setPlaylist] = useState([]);
  const [loop, setLoop] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);
  const processedEventsRef = useRef(new Set());
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Extended playback speeds
  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // Theme configurations
  const themes = {
    dark: {
      bg: 'bg-gray-900',
      text: 'text-white',
      secondary: 'bg-gray-800',
      accent: 'bg-blue-500'
    },
    retro: {
      bg: 'bg-amber-900',
      text: 'text-amber-100',
      secondary: 'bg-amber-800',
      accent: 'bg-green-500'
    },
    cinema: {
      bg: 'bg-black',
      text: 'text-red-500',
      secondary: 'bg-gray-900',
      accent: 'bg-red-700'
    }
  };

  // Add sync manager
  const syncManager = {
    canEmitEvent: () => {
      const now = Date.now();
      if (now - lastEventTime < EVENT_THROTTLE) return false;
      setLastEventTime(now);
      return true;
    },

    shouldSync: (currentTime, targetTime) => {
      return Math.abs(currentTime - targetTime) > SYNC_THRESHOLD;
    }
  };

  useEffect(() => {
    const checkRoom = async () => {
      try {
        const response = await axios.get(`/api/rooms/${roomCode}`);
        if (!response.data.success) {
          throw new Error("Room not found");
        }
        setIsLoading(false);
      } catch (error) {
        console.error("[Client] Room validation error:", error);
        setError("Room not found or no longer available");
        // Redirect to home after 3 seconds
        setTimeout(() => navigate("/"), 3000);
      }
    };

    checkRoom();
  }, [roomCode, navigate]);

  useEffect(() => {
    console.log(`[Client] Joining room: ${roomCode}`);
    socket.emit("join-room", roomCode);

    socket.on("room-state", ({ video, timestamp, playing, users, theme }) => {
      console.log(`[Client] Received room state - Video: ${video}, Timestamp: ${timestamp}, Playing: ${playing}`);
      if (video) setVideoUrl(video);
      if (theme) setTheme(theme);
      setUsers(new Map(users));
      
      // Sync to current video state
      if (playerRef.current) {
        playerRef.current.seekTo(timestamp, "seconds");
        setPlaying(playing);
      }
    });

    socket.on("sync-video", ({ video, timestamp, playing }) => {
      console.log(`[Client] Sync received - Video: ${video}, Timestamp: ${timestamp}, Playing: ${playing}`);
      if (video && video !== videoUrl) {
      setVideoUrl(video);
      }
      
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        if (Math.abs(currentTime - timestamp) > 0.5) { // Reduced threshold for tighter sync
        playerRef.current.seekTo(timestamp, "seconds");
      }
      }
      setPlaying(playing);
    });

    socket.on("play-video", ({ timestamp, userId }) => {
      if (userId === socket.id) return; // Ignore own events
      
      const currentTime = playerRef.current?.getCurrentTime() || 0;
      if (syncManager.shouldSync(currentTime, timestamp)) {
        playerRef.current?.seekTo(timestamp, "seconds");
      }
        setPlaying(true);
    });

    socket.on("pause-video", ({ timestamp, userId }) => {
      if (userId === socket.id) return; // Ignore own events
      
      const currentTime = playerRef.current?.getCurrentTime() || 0;
      if (syncManager.shouldSync(currentTime, timestamp)) {
        playerRef.current?.seekTo(timestamp, "seconds");
      }
        setPlaying(false);
    });

    socket.on("seek-video", ({ timestamp, userId }) => {
      if (userId === socket.id) return; // Ignore own events
      playerRef.current?.seekTo(timestamp, "seconds");
    });

    socket.on("chat-message", (message) => {
      setMessages(prev => [...prev, message]);
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    });

    socket.on("user-joined", ({ userId, nickname, userCount }) => {
      const eventKey = `join-${userId}-${Date.now()}`;
      if (!processedEventsRef.current.has(eventKey)) {
        processedEventsRef.current.add(eventKey);
      setUsers(prev => new Map(prev).set(userId, { nickname }));
      setUserCount(userCount);
        addSystemMessage(`${nickname} joined the room`);
        
        setTimeout(() => processedEventsRef.current.delete(eventKey), 5000);
      }
    });

    socket.on("user-left", ({ userId, nickname, userCount }) => {
      const eventKey = `leave-${userId}-${Date.now()}`;
      if (!processedEventsRef.current.has(eventKey)) {
        processedEventsRef.current.add(eventKey);
      setUsers(prev => {
        const newUsers = new Map(prev);
        newUsers.delete(userId);
        return newUsers;
      });
      setUserCount(userCount);
        addSystemMessage(`${nickname} left the room`);
        
        setTimeout(() => processedEventsRef.current.delete(eventKey), 5000);
      }
    });

    socket.on("reaction", ({ id, userId, nickname, reaction, position }) => {
      setReactions(prev => [...prev, { id, userId, nickname, reaction, position }]);
      
      // Remove reaction after animation
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
    });

    socket.on("theme-change", ({ theme }) => {
      setTheme(theme);
    });

    return () => {
      socket.off("sync-video");
      socket.off("play-video");
      socket.off("pause-video");
      socket.off("seek-video");
      socket.off("chat-message");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("reaction");
      socket.off("theme-change");
    };
  }, [roomCode]);

  useEffect(() => {
    if (roomCode) {
      saveActiveRoom(roomCode);
    }
  }, [roomCode]);

  // Improved play handler
  const handlePlay = () => {
    if (!syncManager.canEmitEvent()) return;
    
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    setLocalStateChange(true);
    setPlaying(true);
    
    socket.emit("play-video", { 
      roomCode, 
      timestamp: currentTime,
      userId: socket.id 
    });
  };

  // Improved pause handler
  const handlePause = () => {
    if (!syncManager.canEmitEvent()) return;
    
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    setLocalStateChange(true);
    setPlaying(false);
    
    socket.emit("pause-video", { 
      roomCode, 
      timestamp: currentTime,
      userId: socket.id 
    });
  };

  // Improved seek handler
  const handleSeek = (newTimestamp) => {
    if (!syncManager.canEmitEvent()) return;
    
    setLocalStateChange(true);
    setTimestamp(newTimestamp);
    
    socket.emit("seek-video", { 
      roomCode, 
      timestamp: newTimestamp,
      userId: socket.id 
    });
  };

  const handleChangeVideo = () => {
    if (newUrl) {
      console.log(`[Client] Changing video to ${newUrl}`);
      socket.emit("change-video", { roomCode, videoUrl: newUrl });
      setNewUrl("");
    }
  };

  const toggleFullscreen = async () => {
    const playerWrapper = document.querySelector('.player-wrapper');
    if (screenfull.isEnabled) {
      try {
        await screenfull.toggle(playerWrapper);
        setIsFullscreen(screenfull.isFullscreen);
        
        // Handle mobile rotation
        if (window.screen?.orientation && window.innerWidth < 768) {
          try {
            if (screenfull.isFullscreen) {
              await window.screen.orientation.lock('landscape');
    } else {
              await window.screen.orientation.unlock();
            }
          } catch (err) {
            console.log('Orientation lock not supported');
          }
        }
      } catch (err) {
        console.error('Fullscreen error:', err);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Improved progress handler
  const handleProgress = (state) => {
    if (localStateChange) {
      setLocalStateChange(false);
      return;
    }
    
    if (!playing) return;
    setProgress(state.playedSeconds);
    setTimestamp(state.playedSeconds);
  };

  const handleDuration = (dur) => {
    setDuration(dur);
  };

  // Periodic sync check
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (!playerRef.current || !playing) return;
      
      const currentTime = playerRef.current.getCurrentTime();
      socket.emit("request-sync", { roomCode });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(syncInterval);
  }, [playing, roomCode]);

  const sendMessage = () => {
    if (!messageInput.trim()) return;
    
    socket.emit("chat-message", {
      roomCode,
      message: messageInput.trim(),
      userId: socket.id
    });
    
    setMessageInput("");
  };

  // Handle speed change
  const handleSpeedChange = (newSpeed) => {
    setPlaybackRate(newSpeed);
    socket.emit("speed-change", {
      roomCode,
      speed: newSpeed,
      userId: socket.id
    });
  };

  // Add to useEffect socket listeners
  useEffect(() => {
    socket.on("speed-change", ({ speed, userId }) => {
      if (userId !== socket.id) {
        setPlaybackRate(speed);
      }
    });

    return () => {
      socket.off("speed-change");
    };
  }, []);

  // Update QuickReactions component
  const QuickReactions = () => {
    const reactions = [
      { icon: <ThumbsUp size={20} />, emoji: '👍' },
      { icon: <Heart size={20} />, emoji: '❤️' },
      { icon: <Laugh size={20} />, emoji: '😂' },
      { icon: <Smile size={20} />, emoji: '😊' },
      { icon: <Star size={20} />, emoji: '⭐' },
      { icon: <PartyPopper size={20} />, emoji: '🎉' },
      { icon: <Sparkles size={20} />, emoji: '✨' },
      { icon: <Palette size={20} />, emoji: '🎨' }
    ];

    return (
      <AnimatePresence>
        {showReactions && (
    <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute bottom-20 right-4 bg-gray-800/90 p-2 rounded-lg shadow-lg z-50 grid grid-cols-4 gap-2"
          >
            {reactions.map(({ icon, emoji }) => (
        <button
          key={emoji}
          onClick={() => {
                  handleReaction(emoji);
          }}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors transform hover:scale-110 text-white"
        >
                {icon}
        </button>
      ))}
    </motion.div>
        )}
      </AnimatePresence>
  );
  };

  // Floating Reactions Component
  const FloatingReactions = () => (
    <div className="fixed inset-0 pointer-events-none">
      <AnimatePresence>
        {reactions.map(({ id, reaction, position, nickname }) => (
          <motion.div
            key={id}
            initial={{ 
              scale: 0,
              y: window.innerHeight - 100,
              x: `${position.x}vw`
            }}
            animate={{ 
              scale: 1,
              y: Math.min(
                window.innerHeight * 0.3,
                window.innerHeight * (position.y / 100) - 100
              )
            }}
            exit={{ 
              scale: 0,
              opacity: 0
            }}
            transition={{ duration: 2 }}
            className="absolute text-4xl"
          >
            <div className="flex flex-col items-center">
              <span>{reaction}</span>
              <span className="text-xs text-gray-400">{nickname}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  // Volume control component
  const VolumeControl = () => (
        <button
          onClick={() => setMuted(!muted)}
      className="p-2 hover:bg-gray-700 rounded transition-colors text-white"
        >
      {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
  );

  // Enhanced video controls
  const VideoControls = () => (
    <div className="controls bg-gray-800/90 p-4 rounded-lg space-y-4">
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={playing ? handlePause : handlePlay}
            className="p-2 hover:bg-gray-700 rounded transition-colors text-white"
          >
            {playing ? <Pause size={24} /> : <Play size={24} />}
          </button>
          
          <VolumeControl />
          
          <select
            value={playbackRate}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="bg-gray-700 text-white p-2 rounded"
          >
            {playbackSpeeds.map(speed => (
              <option key={speed} value={speed}>{speed}x</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="p-2 hover:bg-gray-700 rounded transition-colors text-white"
          >
            <Smile size={24} />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-700 rounded transition-colors text-white"
          >
            {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center space-x-4">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="flex-1"
        />
        <span className="text-white">
          {formatTime(progress)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );

  // Time formatter utility
  const formatTime = (seconds) => {
    const pad = (num) => String(num).padStart(2, '0');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hours > 0 
      ? `${hours}:${pad(minutes)}:${pad(secs)}`
      : `${minutes}:${pad(secs)}`;
  };

  // Add scroll handler to detect when user manually scrolls up
  const handleChatScroll = () => {
    if (chatRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
    }
  };

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current && shouldAutoScroll) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Update ChatBox component's message area
  const ChatBox = () => (
    <div className="h-full flex flex-col bg-gray-800/90 rounded-lg overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b border-opacity-20">
        <div className="flex items-center space-x-2">
          <h3 className={`text-sm font-semibold ${themes[theme].text}`}>
            Chat ({userCount})
          </h3>
        </div>
          <button
          className="lg:hidden text-gray-400 hover:text-white"
          onClick={() => setShowChat(false)}
        >
          ▼
          </button>
      </div>

      {/* Messages */}
      <div 
        ref={chatRef} 
        onScroll={handleChatScroll}
        className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
      >
        {messages.filter(msg => !msg.type).map((msg) => ( // Filter out system messages
          <div
            key={msg.id}
            className={`group flex flex-col ${
              msg.userId === socket.id ? 'items-end' : 'items-start'
            }`}
          >
            <span className={`text-xs ${msg.userId === socket.id ? 'text-blue-400' : 'text-gray-400'} mb-1`}>
              {msg.nickname}
            </span>
            
            {msg.replyTo && (
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1 bg-gray-700/50 px-2 py-1 rounded">
                <Reply size={12} />
                <span>Replying to {msg.replyTo.nickname}: {msg.replyTo.message.substring(0, 30)}...</span>
              </div>
            )}
            
            <div className="flex items-start gap-2">
              <div className={`
                max-w-[85%] px-3 py-2 rounded-lg text-sm
                ${msg.userId === socket.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-100'}
              `}>
                {msg.message}
            </div>
              
              <button
                onClick={() => setReplyTo({ id: msg.id, nickname: msg.nickname, message: msg.message })}
                className="text-gray-400 hover:text-white"
              >
                <Reply size={16} />
              </button>
            </div>

            <span className="text-xs text-gray-500 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        ))}
      </div>

      {/* Reply indicator and input area */}
      <div className="p-3 border-t border-gray-700">
        {replyTo && (
          <div className="mb-2 p-2 bg-gray-700/50 rounded-lg text-sm flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Reply size={14} className="text-gray-400" />
              <div className="text-gray-300">
                <span className="text-gray-400">Replying to </span>
                {replyTo.nickname}:
                <span className="text-gray-400 ml-1">
                  {replyTo.message.substring(0, 30)}
                  {replyTo.message.length > 30 ? '...' : ''}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setReplyTo(null)}
              className="text-gray-400 hover:text-white ml-2"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            ref={messageInputRef}
            type="text"
            value={messageInput}
            onChange={handleMessageInput}
            placeholder={replyTo ? `Reply to ${replyTo.nickname}...` : "Type a message..."}
            className="flex-1 bg-gray-700 text-white text-sm p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
      </form>
      </div>
    </div>
  );

  // Add theme selector
  const ThemeSelector = () => (
    <div className="fixed left-4 top-4 flex space-x-2">
      {Object.keys(themes).map(themeName => (
        <button
          key={themeName}
          onClick={() => {
            setTheme(themeName);
            socket.emit("theme-change", { roomCode, theme: themeName });
          }}
          className={`px-3 py-1 rounded ${
            theme === themeName ? themes[theme].accent : themes[theme].secondary
          }`}
        >
          {themeName}
        </button>
      ))}
    </div>
  );

  const handleMessageInput = (e) => {
    setMessageInput(e.target.value);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    socket.emit("chat-message", {
      roomCode,
      message: messageInput.trim(),
      replyTo: replyTo
    });
    
    setMessageInput("");
    setReplyTo(null);
    messageInputRef.current?.focus();
  };

  // Theater Mode
  const toggleTheaterMode = () => {
    setIsTheaterMode(!isTheaterMode);
    document.body.style.overflow = !isTheaterMode ? 'hidden' : 'auto';
  };

  // User List Component
  const UserList = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`fixed right-4 top-4 w-64 ${themes[theme].secondary} rounded-lg shadow-lg p-4 z-50`}
    >
      <h3 className={`${themes[theme].text} font-semibold mb-4`}>Viewers ({users.size})</h3>
      <div className="space-y-2">
        {Array.from(users.entries()).map(([id, user]) => (
          <div key={id} className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${id === socket.id ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className={`${themes[theme].text} text-sm`}>{user.nickname}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );

  // Settings Panel
  const SettingsPanel = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed left-4 bottom-4 w-64 ${themes[theme].secondary} rounded-lg shadow-lg p-4 z-50`}
    >
      <h3 className={`${themes[theme].text} font-semibold mb-4`}>Settings</h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className={`${themes[theme].text} text-sm`}>Notifications</span>
          <button
            onClick={() => setNotifications(!notifications)}
            className={`${notifications ? themes[theme].accent : 'bg-gray-600'} px-2 py-1 rounded text-xs`}
          >
            {notifications ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex justify-between items-center">
          <span className={`${themes[theme].text} text-sm`}>Autoplay</span>
          <button
            onClick={() => setAutoplay(!autoplay)}
            className={`${autoplay ? themes[theme].accent : 'bg-gray-600'} px-2 py-1 rounded text-xs`}
          >
            {autoplay ? 'On' : 'Off'}
          </button>
        </div>
        <div className="space-y-2">
          <span className={`${themes[theme].text} text-sm`}>Quality</span>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className={`w-full ${themes[theme].secondary} ${themes[theme].text} p-1 rounded text-xs`}
          >
            <option value="auto">Auto</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>
      </div>
    </motion.div>
  );

  // Playlist Panel
  const PlaylistPanel = () => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`fixed left-4 top-20 w-64 ${themes[theme].secondary} rounded-lg shadow-lg p-4 z-50`}
    >
      <h3 className={`${themes[theme].text} font-semibold mb-4`}>Playlist</h3>
      <div className="space-y-2">
        {playlist.map((video, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className={`${themes[theme].text} text-sm truncate`}>{video.title}</span>
            <button
              onClick={() => {
                setVideoUrl(video.url);
                socket.emit("change-video", { roomCode, videoUrl: video.url });
              }}
              className={`${themes[theme].accent} px-2 py-1 rounded text-xs`}
            >
              Play
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            const url = prompt("Enter video URL:");
            if (url) {
              setPlaylist([...playlist, { url, title: `Video ${playlist.length + 1}` }]);
            }
          }}
          className={`${themes[theme].accent} w-full py-1 rounded text-xs mt-4`}
        >
          Add Video
        </button>
      </div>
    </motion.div>
  );

  // Mobile Chat Toggle Button
  const ChatButton = () => (
    <div className="relative">
      <button
        onClick={() => {
          setShowChat(true);
          setUnreadCount(0);
        }}
        className="bg-white rounded-full p-2 flex items-center"
      >
        <MessageCircle size={20} className="text-gray-900" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );

  // Add click outside handler for mobile chat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (window.innerWidth < 768 && showChat) {
        const chatBox = document.querySelector('.chat-container');
        if (chatBox && !chatBox.contains(e.target) && !e.target.closest('.chat-toggle')) {
          setShowChat(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showChat]);

  // Subtitle Support
  const addSubtitles = () => {
    const url = prompt("Enter subtitle file URL (VTT format):");
    if (url) {
      setSubtitle(url);
    }
  };

  // Room Timer
  const RoomTimer = () => {
    const [time, setTime] = useState(0);
    
    useEffect(() => {
      const timer = setInterval(() => setTime(t => t + 1), 1000);
      return () => clearInterval(timer);
    }, []);
    
    return (
      <div className={`${themes[theme].text} text-xs opacity-75`}>
        Room time: {Math.floor(time / 3600)}:{Math.floor((time % 3600) / 60).toString().padStart(2, '0')}:{(time % 60).toString().padStart(2, '0')}
      </div>
    );
  };

  // Video Loop Toggle
  const LoopToggle = () => (
    <button
      onClick={() => setLoop(!loop)}
      className={`${loop ? themes[theme].accent : 'bg-gray-600'} px-2 py-1 rounded text-xs`}
    >
      🔁 Loop
    </button>
  );

  // Screenshot Feature
  const takeScreenshot = () => {
    const video = document.querySelector('video');
    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      
      const link = document.createElement('a');
      link.download = 'screenshot.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  // Picture-in-Picture Mode
  const togglePiP = async () => {
    const video = document.querySelector('video');
    if (video) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    }
  };

  const handleLeaveRoom = () => {
    socket.emit("leave-room", { roomCode });
    clearActiveRoom();
    navigate("/");
  };

  // Update socket.js
  socket.on("disconnect", () => {
    socket.emit("leave-room", { roomCode: window.location.pathname.split('/').pop() });
  });

  // Add Leave Room button in the header
  const RoomHeader = () => (
    <div className="flex items-center justify-between mb-4 bg-gray-800/90 rounded-lg p-3">
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-bold text-white">Room: {roomCode}</h2>
        <div className="lg:hidden">
          <ChatButton />
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <button
          onClick={handleShare}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <Share2 size={16} />
          Share
        </button>
        <button
          onClick={handleLeaveRoom}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          Leave Room
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    const handleNewMessage = (message) => {
      if (!showChat) {
        setUnreadCount(prev => prev + 1);
      }
    };

    socket.on("chat-message", handleNewMessage);
    return () => socket.off("chat-message", handleNewMessage);
  }, [showChat]);

  const handleShare = async () => {
    const shareData = {
      title: 'Watch Together',
      text: 'Join my watch room!',
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Room link copied to clipboard! 📋");
      }
    } catch (err) {
      console.error('Share error:', err);
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Room link copied to clipboard! 📋");
      } catch (clipErr) {
        toast.error("Failed to share or copy link");
      }
    }
  };

  const addSystemMessage = (message) => {
    const systemMessage = {
      id: Date.now().toString(),
      type: 'system',
      message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  // Update reaction handling
  const handleReaction = (emoji) => {
    socket.emit("reaction", { 
      roomCode, 
      reaction: emoji,
      position: {
        x: 30 + Math.random() * 40,
        y: Math.random() * 30 + 50 // Adjust range to prevent going too high
      }
    });
    
    // Only show confetti for party emoji
    if (emoji === '🎉') {
      socket.emit("confetti", { roomCode });
    }
    
    setShowReactions(false);
  };

  // Add confetti handler
  useEffect(() => {
    socket.on("confetti", () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 }
      });
    });

    return () => socket.off("confetti");
  }, []);

  useEffect(() => {
    if (isFullscreen && playing) {
      // Hide controls after 2 seconds of inactivity
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000);
    } else {
      setShowControls(true);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isFullscreen, playing]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white mt-4">Joining room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-red-500">
          <p>{error}</p>
          <p className="text-sm text-gray-400 mt-2">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themes[theme].bg} transition-colors duration-300`}>
      <div className="h-screen p-2 flex flex-col">
        <RoomHeader />
        
        <div className="flex flex-1 gap-2 h-[calc(100vh-4rem)]">
          <div className="hidden lg:flex w-72 flex-shrink-0 flex-col bg-gray-800/90 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-white">Chat Room</h3>
                <span className="text-xs text-gray-400">({userCount} online)</span>
              </div>
              <div className="flex items-center space-x-2">
          <button
            onClick={() => {
                    navigator.clipboard.writeText(roomCode);
                    toast.success("Room code copied!");
            }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
          >
                  Copy Code
          </button>
              </div>
        </div>

            <div 
              ref={chatRef} 
              className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`group flex flex-col ${
                    msg.userId === socket.id ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className={`text-xs ${msg.userId === socket.id ? 'text-blue-400' : 'text-gray-400'} mb-1`}>
                    {msg.nickname}
                  </span>
                  
          <div className={`
                    max-w-[85%] px-3 py-2 rounded-lg text-sm
                    ${msg.userId === socket.id 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-100'}
                  `}>
                    {msg.message}
          </div>

                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-gray-700">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  ref={messageInputRef}
                  type="text"
                  value={messageInput}
                  onChange={handleMessageInput}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white text-sm p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-gray-800/90 rounded-lg overflow-hidden">
            <div 
              className="relative flex-1 w-full bg-black player-wrapper"
              onMouseMove={() => {
                if (isFullscreen) {
                  setShowControls(true);
                  if (controlsTimeoutRef.current) {
                    clearTimeout(controlsTimeoutRef.current);
                  }
                  controlsTimeoutRef.current = setTimeout(() => {
                    if (playing) {
                      setShowControls(false);
                    }
                  }, 2000);
                }
              }}
            >
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          playing={playing}
          volume={volume}
          muted={muted}
          playbackRate={playbackRate}
          width="100%"
            height="100%"
                style={{ position: 'absolute', top: 0, left: 0 }}
          onPlay={handlePlay}
          onPause={handlePause}
          onProgress={handleProgress}
          onDuration={handleDuration}
                config={{
                  youtube: {
                    playerVars: { showinfo: 1 }
                  }
                }}
          />
              
              <div className={`
                absolute bottom-0 left-0 right-0 
                bg-gradient-to-t from-black/80 to-transparent 
                transition-opacity duration-300
                ${showControls ? 'opacity-100' : 'opacity-0'}
                ${isFullscreen && !showControls ? 'pointer-events-none' : ''}
              `}>
          <VideoControls />
              </div>
        </div>

        <div className="p-2 flex space-x-2 border-t border-gray-700">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Enter YouTube or video URL"
                className="flex-1 bg-gray-700 text-white p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleChangeVideo}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg whitespace-nowrap transition-colors"
          >
            Change Video
          </button>
            </div>
          </div>
        </div>

        

        <div className={`
          lg:hidden fixed inset-0 bg-black/50 z-40
          ${showChat ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          transition-opacity duration-300
        `}>
          <div className={`
            absolute bottom-0 left-0 right-0 
            h-[70vh] 
            transform transition-transform duration-300
            ${showChat ? 'translate-y-0' : 'translate-y-full'}
            bg-gray-800 rounded-t-xl overflow-hidden
            flex flex-col
          `}>
            {/* Chat Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-white">Chat Room</h3>
                <span className="text-xs text-gray-400">({userCount} online)</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-white p-2"
              >
                ▼
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={chatRef} 
              className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`group flex flex-col ${
                    msg.userId === socket.id ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className={`text-xs ${msg.userId === socket.id ? 'text-blue-400' : 'text-gray-400'} mb-1`}>
                    {msg.nickname}
                  </span>
                  
                  {msg.replyTo && (
                    <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <Reply size={12} />
                      <span>Replying to {msg.replyTo.nickname}</span>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-2">
                    <div className={`
                      max-w-[85%] px-3 py-2 rounded-lg text-sm
                      ${msg.userId === socket.id 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-100'}
                    `}>
                      {msg.message}
                    </div>
                    
                    <button
                      onClick={() => setReplyTo({ id: msg.id, nickname: msg.nickname, message: msg.message })}
                      className="text-gray-400 hover:text-white"
                    >
                      <Reply size={16} />
                    </button>
                  </div>

                  <span className="text-xs text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-gray-700">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  ref={messageInputRef}
                  type="text"
                  value={messageInput}
                  onChange={handleMessageInput}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white text-sm p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <FloatingReactions />
      <QuickReactions />
        <ToastContainer
          position="bottom-left"
          autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
}

export default Room;