// Create a new file for room storage management
const ROOM_STORAGE_KEY = 'watchTogether_activeRoom';

export const saveActiveRoom = (roomCode) => {
  localStorage.setItem('activeRoom', roomCode);
};

export const getActiveRoom = () => {
  return localStorage.getItem('activeRoom');
};

export const clearActiveRoom = () => {
  localStorage.removeItem('activeRoom');
}; 