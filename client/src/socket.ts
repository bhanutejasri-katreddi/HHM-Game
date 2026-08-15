import { io } from 'socket.io-client';

const backendUrl = localStorage.getItem('BACKEND_URL') || import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
export const socket = io(backendUrl);
