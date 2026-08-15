import { io } from 'socket.io-client';

// Use env var or default to local server port
export const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
