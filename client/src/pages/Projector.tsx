import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { motion, AnimatePresence } from 'framer-motion';

interface House {
  id: string;
  name: string;
  color: string;
  icon: string;
  score?: number;
}

interface Question {
  id?: string;
  clue_letters: string;
  hero_name: string;
  heroine_name: string;
  movie_name: string;
  points?: number;
}

interface GameState {
  status: string;
  timerSeconds: number;
  lockedHouseId: string | null;
  currentQuestion?: Question | null;
}

export default function Projector() {
  const [gameState, setGameState] = useState<GameState>({ status: 'IDLE', timerSeconds: 0, lockedHouseId: null, currentQuestion: null });
  const [houses, setHouses] = useState<House[]>([]);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/houses')
      .then(res => res.json())
      .then((data: House[]) => setHouses(data))
      .catch(console.error);

    socket.on('state:update', (state: GameState) => {
      setGameState(state);
      setTimer(state.timerSeconds);
    });
    
    socket.on('leaderboard:update', (data: House[]) => setHouses(data));
    socket.on('timer:tick', ({ seconds }: { seconds: number }) => setTimer(seconds));

    return () => {
      socket.off('state:update');
      socket.off('leaderboard:update');
      socket.off('timer:tick');
    };
  }, []);

  const lockedHouse = houses.find(h => h.id === gameState.lockedHouseId);

  return (
    // The "dark" class forces this specific tree to always use dark mode CSS variables
    <div className="dark min-h-screen bg-base text-primary flex flex-col relative overflow-hidden font-ui cursor-none">
      
      {/* Dynamic Background Tint based on Locked House */}
      <AnimatePresence>
        {gameState.status === 'LOCKED' && lockedHouse && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0 pointer-events-none" 
            style={{ backgroundColor: lockedHouse.color }}
          ></motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
        <AnimatePresence mode="wait">
          {gameState.status === 'IDLE' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <h1 className="text-display-xl font-display font-bold text-brand mb-4">HHM GAME</h1>
              <p className="text-4xl text-secondary uppercase tracking-widest font-bold">Get Ready</p>
            </motion.div>
          )}

          {gameState.status === 'CLUE_SHOWN' && (
            <motion.div 
              key="clue"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center flex flex-col items-center"
            >
              <h1 className="text-[14rem] leading-none font-display font-black tracking-tighter mb-12 drop-shadow-2xl">
                {gameState.currentQuestion?.clue_letters}
              </h1>
              <div className="inline-block px-10 py-5 bg-brand/20 text-brand text-5xl rounded-full border border-brand/50 animate-pulse-subtle font-bold tracking-widest shadow-[0_0_40px_rgba(99,102,241,0.2)] backdrop-blur-md">
                BUZZERS OPEN
              </div>
            </motion.div>
          )}

          {gameState.status === 'LOCKED' && lockedHouse && (
            <motion.div 
              key="locked"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center flex flex-col items-center w-full"
            >
              <h1 className="text-[8rem] font-display font-bold mb-8 opacity-30 tracking-tight">{gameState.currentQuestion?.clue_letters}</h1>
              
              <div className="flex items-center gap-16 my-12">
                <div className="w-64 h-64 rounded-full relative flex items-center justify-center bg-black/40 backdrop-blur-xl border border-border-glass shadow-2xl">
                   <span className="text-[6rem] font-bold font-display leading-none text-green-500 drop-shadow-lg">{timer}s</span>
                   <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="128" cy="128" r="122" stroke="currentColor" strokeWidth="6" fill="none" className="text-white/5" />
                      <circle cx="128" cy="128" r="122" stroke="#22c55e" strokeWidth="6" fill="none" 
                        strokeDasharray="766" strokeDashoffset={766 - (766 * (timer / 15))} 
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-linear drop-shadow-md" />
                   </svg>
                </div>
                <div className="text-left flex flex-col justify-center">
                  <h2 className="text-[9rem] font-display font-black drop-shadow-2xl leading-none tracking-tight text-primary">
                    {lockedHouse.name}
                  </h2>
                  <p className="text-4xl text-secondary mt-6 font-bold uppercase tracking-widest">is answering out loud...</p>
                </div>
              </div>
            </motion.div>
          )}

          {gameState.status === 'JUDGED' && (
            <motion.div 
              key="judged"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center w-full max-w-6xl mx-auto"
            >
              <h1 className="text-[12rem] font-display font-black tracking-tighter mb-12 text-green-500 drop-shadow-[0_0_60px_rgba(34,197,94,0.3)]">
                CORRECT
              </h1>
              <div className="text-[4rem] text-primary space-y-8 bg-black/40 backdrop-blur-xl p-16 rounded-[3rem] border border-border-glass shadow-2xl font-bold leading-tight">
                <div className="flex items-center"><span className="text-secondary font-normal w-64 text-right mr-12">Hero</span> {gameState.currentQuestion?.hero_name}</div>
                <div className="flex items-center"><span className="text-secondary font-normal w-64 text-right mr-12">Heroine</span> {gameState.currentQuestion?.heroine_name}</div>
                <div className="flex items-center"><span className="text-secondary font-normal w-64 text-right mr-12">Movie</span> {gameState.currentQuestion?.movie_name}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="h-40 bg-black/40 backdrop-blur-xl border-t border-border-glass flex items-center justify-around px-12 z-10 shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
        {houses.map(h => (
          <div key={h.id} className="flex flex-col items-center">
            <span className="text-2xl font-bold tracking-widest uppercase mb-2 text-primary">{h.name}</span>
            <span className="text-6xl font-display font-black drop-shadow-lg">{h.score ?? 0}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}
