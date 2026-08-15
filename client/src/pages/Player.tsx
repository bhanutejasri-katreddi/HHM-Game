import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { HouseLogo } from '../components/HouseLogo';
import { LogOut, Volume2, User, ShieldAlert, Sparkles } from 'lucide-react';

interface House {
  id: string;
  name: string;
  color: string;
  icon: string;
  login_code?: string;
  score?: number;
}

interface GameState {
  status: string;
  timerSeconds: number;
  lockedHouseId: string | null;
  lockedStudentName?: string | null;
  currentQuestion?: any;
  lockedOutHouses?: string[];
  buzzersOpen?: boolean;
}

const getDeviceId = () => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('deviceId', id);
  }
  return id;
};

export default function Player() {
  const [house, setHouse] = useState<House | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('house') || 'null');
    } catch {
      return null;
    }
  });
  const [studentName, setStudentName] = useState<string>(() => localStorage.getItem('student_name') || '');
  const [housesList, setHousesList] = useState<House[]>([]);
  const [loginForm, setLoginForm] = useState({ houseId: '', loginCode: '', studentName: '' });
  
  const [gameState, setGameState] = useState<GameState>({ status: 'IDLE', timerSeconds: 0, lockedHouseId: null });
  const [timer, setTimer] = useState(0);
  const [myAnswerStatus, setMyAnswerStatus] = useState<'correct' | 'wrong' | null>(null);
  const [isTapped, setIsTapped] = useState(false);

  useEffect(() => {
    // Fetch houses for login
    fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/houses')
      .then(res => res.json())
      .then((data: House[]) => setHousesList(data))
      .catch(console.error);

    socket.on('state:update', (state: GameState) => {
      setGameState(state);
      setTimer(state.timerSeconds);
    });

    socket.on('clue:show', ({ question }: { question: any }) => {
      setGameState(prev => ({
        ...prev,
        status: 'CLUE_SHOWN',
        currentQuestion: question,
        buzzersOpen: true,
        lockedHouseId: null
      }));
    });

    socket.on('buzzer:locked', () => {
      setTimer(15);
    });

    socket.on('timer:tick', ({ seconds }: { seconds: number }) => setTimer(seconds));
    
    socket.on('answer:result', ({ correct, houseId }: { correct: boolean; houseId: string }) => {
       if (house && houseId === house.id) {
           setMyAnswerStatus(correct ? 'correct' : 'wrong');
           setTimeout(() => setMyAnswerStatus(null), 3000);
       }
    });

    if (house) {
      socket.emit('join_house', house.id);
    }

    return () => {
      socket.off('state:update');
      socket.off('clue:show');
      socket.off('buzzer:locked');
      socket.off('timer:tick');
      socket.off('answer:result');
    };
  }, [house]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...loginForm, deviceId: getDeviceId() })
      });
      const data = await res.json();
      if (data.success) {
        setHouse(data.house);
        setStudentName(loginForm.studentName);
        localStorage.setItem('house', JSON.stringify(data.house));
        localStorage.setItem('student_name', loginForm.studentName);
      } else {
        alert(data.error || 'Failed to join house');
      }
    } catch (err) {
      alert('Network error connecting to server');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('house');
    localStorage.removeItem('student_name');
    setHouse(null);
    window.location.reload();
  };

  const isLockedOut = Boolean(house && gameState.lockedOutHouses && gameState.lockedOutHouses.includes(house.id));
  const isBuzzerActive = gameState.status === 'CLUE_SHOWN' && gameState.buzzersOpen && !isLockedOut;

  const handleBuzz = async () => {
    if (!house || !isBuzzerActive) return;
    
    // Immediate physical tap feedback
    setIsTapped(true);
    setTimeout(() => setIsTapped(false), 500);

    try {
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/buzz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houseId: house.id,
          deviceId: getDeviceId(),
          clientTimestampMs: Date.now()
        })
      });
    } catch (e) {
      console.error('Buzz failed to reach server', e);
    }
  };

  const selectedJoinHouse = housesList.find(h => h.id === loginForm.houseId);

  // --- JOIN SCREEN ---
  if (!house) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        
        <GlassCard className="w-full max-w-sm sm:max-w-md animate-in relative z-10 p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            {selectedJoinHouse ? (
              <HouseLogo 
                name={selectedJoinHouse.name} 
                color={selectedJoinHouse.color} 
                icon={selectedJoinHouse.icon} 
                size="lg" 
                className="mb-3 animate-in"
              />
            ) : (
              <div className="w-14 h-14 bg-brand/20 text-brand rounded-2xl flex items-center justify-center mb-3 border border-brand/30">
                <Sparkles size={28} />
              </div>
            )}
            <h2 className="text-3xl sm:text-4xl font-display font-black text-center tracking-tight">Join House</h2>
            <p className="text-secondary text-xs sm:text-sm mt-1">HHM Live Game Show</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-secondary uppercase tracking-wider">Select House</label>
              <select 
                className="w-full bg-black/10 dark:bg-black/30 backdrop-blur-md text-primary p-3.5 rounded-xl border border-border-glass focus:border-brand outline-none transition-all text-sm font-semibold"
                value={loginForm.houseId} 
                onChange={e => setLoginForm({...loginForm, houseId: e.target.value})}
                required
              >
                <option value="">-- Choose your House --</option>
                {housesList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            
            <Input 
              label="Login Code"
              type="text" 
              placeholder="Enter House PIN (e.g. 1234)"
              value={loginForm.loginCode} 
              onChange={e => setLoginForm({...loginForm, loginCode: e.target.value})}
              required
              className="text-sm p-3.5"
            />
            
            <Input 
              label="Your Name"
              type="text" 
              placeholder="Full Name"
              value={loginForm.studentName} 
              onChange={e => setLoginForm({...loginForm, studentName: e.target.value})}
              required
              className="text-sm p-3.5"
            />
            
            <Button type="submit" className="w-full mt-2 py-3.5 text-base font-bold shadow-lg shadow-brand/20">
              ENTER GAME
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border-glass text-center">
            <Link 
              to="/admin/login" 
              className="text-secondary hover:text-primary text-xs font-medium transition-colors"
            >
              Are you a Host? Admin Login
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const isMyHouseLocked = gameState.lockedHouseId === house.id;
  const isAnotherHouseLocked = Boolean(gameState.lockedHouseId && gameState.lockedHouseId !== house.id);
  const lockedHouse = housesList.find(h => h.id === gameState.lockedHouseId);

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden select-none">
      {/* Dynamic Background Tint based on House */}
      <div 
        className="absolute inset-0 z-0 opacity-15 pointer-events-none transition-colors duration-700" 
        style={{ backgroundColor: (isAnotherHouseLocked && lockedHouse) ? lockedHouse.color : house.color }}
      />

      {/* Header Bar with Official House Logo */}
      <header className="w-full px-4 sm:px-8 py-3 flex justify-between items-center bg-black/20 backdrop-blur-xl border-b border-border-glass z-10 relative shadow-sm">
        <div className="flex items-center gap-3">
          <HouseLogo name={house.name} color={house.color} icon={house.icon} size="sm" />
          <div>
            <span className="font-display font-black text-base sm:text-lg tracking-wide block leading-tight text-primary">{house.name}</span>
            {studentName && (
              <span className="text-[10px] sm:text-xs text-secondary font-medium flex items-center gap-1">
                <User size={11} /> {studentName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle className="scale-75 sm:scale-90 origin-right" />
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors bg-white/5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border-glass"
          >
            <LogOut size={13} /> Exit
          </button>
        </div>
      </header>

      {/* Main Game Stage Area */}
      <main className="flex-1 w-full max-w-lg mx-auto flex flex-col items-center justify-center p-4 sm:p-6 relative z-10">
        
        {/* Answer Flash Animations */}
        <AnimatePresence>
          {myAnswerStatus === 'correct' && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.85 }} 
               animate={{ opacity: 1, scale: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-4 bg-green-500/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center text-5xl sm:text-7xl font-display font-black text-white shadow-2xl rounded-3xl"
             >
                 <span>CORRECT!</span>
                 <span className="text-sm sm:text-base font-ui uppercase tracking-widest mt-2 opacity-90">+1 Point Awarded</span>
             </motion.div>
          )}
          {myAnswerStatus === 'wrong' && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.85 }} 
               animate={{ opacity: 1, scale: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-4 bg-red-500/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center text-5xl sm:text-7xl font-display font-black text-white shadow-2xl rounded-3xl"
             >
                 <span>WRONG</span>
                 <span className="text-sm sm:text-base font-ui uppercase tracking-widest mt-2 opacity-90">-1 Point &bull; Locked Out for this clue</span>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Status Display Banner */}
        <div className="flex flex-col items-center justify-center text-center mb-4 sm:mb-6 w-full">
          
          {/* 1. CLUE LETTERS DISPLAY */}
          {gameState.status !== 'IDLE' && gameState.currentQuestion?.clue_letters && (
            <div className="mb-3 sm:mb-4 text-center animate-in">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted block mb-1">
                Current Clue
              </span>
              <h1 className="text-5xl xs:text-6xl sm:text-7xl md:text-8xl font-display font-black text-primary tracking-tight leading-none drop-shadow-md">
                {gameState.currentQuestion.clue_letters}
              </h1>
            </div>
          )}

          {gameState.status === 'IDLE' && (
            <div className="animate-in space-y-1 py-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Standby</span>
              <h2 className="text-lg sm:text-xl font-bold text-secondary uppercase tracking-wider">Waiting for next clue...</h2>
            </div>
          )}

          {gameState.status === 'CLUE_SHOWN' && !isLockedOut && (
            <div className="space-y-1.5 animate-in flex flex-col items-center">
              <span 
                className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border shadow-sm"
                style={{ 
                  color: house.color, 
                  borderColor: `${house.color}60`, 
                  backgroundColor: `${house.color}18` 
                }}
              >
                Round Active
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight" style={{ color: house.color }}>
                BUZZ NOW!
              </h2>
            </div>
          )}

          {gameState.status === 'CLUE_SHOWN' && isLockedOut && (
            <div className="space-y-1.5 animate-in flex flex-col items-center">
              <span className="text-xs font-black uppercase tracking-widest text-red-400 px-3.5 py-1 bg-red-500/10 border border-red-500/30 rounded-full flex items-center gap-1.5">
                <ShieldAlert size={14} /> Locked Out
              </span>
              <h2 className="text-base sm:text-lg font-bold text-secondary">
                Locked out for this question
              </h2>
            </div>
          )}

          {gameState.status === 'LOCKED' && isMyHouseLocked && (
            <div className="space-y-2 animate-in flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/40 text-xs font-black uppercase tracking-widest shadow-sm">
                <Volume2 size={15} className="animate-pulse" /> {gameState.lockedStudentName ? `YOU'RE IN, ${gameState.lockedStudentName.toUpperCase()}!` : 'YOUR HOUSE IS IN!'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-black text-primary tracking-tight">
                STAND UP &amp; ANSWER NOW
              </h2>
            </div>
          )}

          {gameState.status === 'LOCKED' && isAnotherHouseLocked && lockedHouse && (
            <div className="space-y-2 animate-in flex flex-col items-center w-full">
              {/* Broadcast Who Buzzed First Card with House Logo */}
              <div 
                className="w-full p-4 sm:p-5 rounded-2xl border-2 backdrop-blur-xl flex items-center justify-between shadow-lg"
                style={{ 
                  borderColor: lockedHouse.color, 
                  backgroundColor: `${lockedHouse.color}18` 
                }}
              >
                <div className="flex items-center gap-3 text-left">
                  <HouseLogo 
                    name={lockedHouse.name} 
                    color={lockedHouse.color} 
                    icon={lockedHouse.icon} 
                    size="md" 
                  />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                      First to Buzz In
                    </span>
                    <h3 className="text-lg sm:text-xl font-display font-black tracking-tight text-primary">
                      {lockedHouse.name}
                    </h3>
                    {gameState.lockedStudentName && (
                      <span className="text-sm font-bold text-primary block mt-0.5">
                        {gameState.lockedStudentName}
                      </span>
                    )}
                    <span className="text-[11px] text-secondary font-medium mt-1 block">Answering verbally out loud</span>
                  </div>
                </div>

                {/* Synchronized 15s Countdown Display with exact geometry */}
                <div 
                  className="w-14 h-14 rounded-full flex flex-col items-center justify-center bg-black/40 shadow-inner shrink-0 relative"
                  style={{ color: lockedHouse.color }}
                >
                  <span className="text-lg font-display font-black leading-none">{timer}s</span>
                  <span className="text-[8px] uppercase font-bold opacity-80 mt-0.5">Left</span>
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 60 60">
                     <circle cx="30" cy="30" r="25" stroke="currentColor" strokeWidth="3" fill="none" className="text-white/10" />
                     <circle 
                       cx="30" 
                       cy="30" 
                       r="25" 
                       stroke={lockedHouse.color} 
                       strokeWidth="3.5" 
                       fill="none" 
                       strokeDasharray={157.08} 
                       strokeDashoffset={157.08 * (1 - Math.max(0, Math.min(15, timer)) / 15)} 
                       strokeLinecap="round"
                       className="transition-all duration-1000 ease-linear" 
                     />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Circular Arcade Buzzer & Timer Dome */}
        <div className="relative my-2 sm:my-3 flex flex-col items-center justify-center w-full">
          {gameState.status === 'LOCKED' && isMyHouseLocked ? (
             // Circular 15s Countdown Ring with exact 100% full initial ring
             <div className="flex flex-col items-center animate-in">
               <div className="w-56 h-56 xs:w-64 xs:h-64 sm:w-72 sm:h-72 rounded-full relative flex flex-col items-center justify-center bg-black/30 backdrop-blur-xl border border-green-500/20 shadow-[0_16px_50px_rgba(34,197,94,0.25)]">
                   <span className="text-[5rem] sm:text-[6.5rem] font-display font-black leading-none text-green-400 drop-shadow-md">
                     {timer}s
                   </span>
                   <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-green-500/90 mt-1">
                     Time Remaining
                   </span>
                   <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
                      <circle 
                        cx="100" 
                        cy="100" 
                        r="88" 
                        stroke="#22c55e" 
                        strokeWidth="10" 
                        fill="none" 
                        strokeDasharray={552.92} 
                        strokeDashoffset={552.92 * (1 - Math.max(0, Math.min(15, timer)) / 15)} 
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-linear" 
                      />
                   </svg>
               </div>
               <p className="text-xs sm:text-sm font-bold text-secondary uppercase tracking-widest mt-5 text-center max-w-xs">
                 Answer out loud to the host before time expires
               </p>
             </div>
          ) : (
            // Physical Arcade-Style Circular Buzzer Button
            <div className="flex flex-col items-center">
              <button
                type="button"
                disabled={!isBuzzerActive}
                onClick={handleBuzz}
                className={`buzzer-circle-outer w-56 h-56 xs:w-64 xs:h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 p-3 sm:p-4 rounded-full border border-white/20 backdrop-blur-md transition-all ${
                  isBuzzerActive ? 'animate-buzzer-breathe' : 'opacity-40 grayscale cursor-not-allowed'
                }`}
                aria-label="Buzz to answer"
              >
                {/* Instant Tap Ripple Animation */}
                {isTapped && (
                  <div className="absolute inset-0 rounded-full border-4 border-white/80 animate-tap-ripple pointer-events-none" />
                )}

                {/* Inner Dimensional Dome Button */}
                <div 
                  className="buzzer-circle-inner"
                  style={
                    isBuzzerActive 
                      ? {
                          background: `radial-gradient(circle at 50% 35%, ${house.color}dd 0%, ${house.color}77 45%, #090d16 100%)`,
                          borderColor: `${house.color}aa`
                        }
                      : undefined
                  }
                >
                  <div className="relative z-10 flex flex-col items-center justify-center select-none">
                    <span className="font-display font-black text-4xl xs:text-5xl sm:text-6xl text-white tracking-widest leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]">
                      {isLockedOut || (gameState.status === 'LOCKED' && isAnotherHouseLocked) ? 'LOCKED' : 'BUZZ'}
                    </span>

                    <span className="text-[10px] sm:text-xs font-bold tracking-widest text-white/90 uppercase mt-4 sm:mt-5 px-3 py-0.5 rounded-full bg-black/40 backdrop-blur-xs border border-white/10 shadow-inner">
                      {isLockedOut || (gameState.status === 'LOCKED' && isAnotherHouseLocked) ? 'OUT' : isBuzzerActive ? 'TAP TO ANSWER' : 'WAIT FOR CLUE'}
                    </span>
                  </div>
                </div>
              </button>

              {gameState.status === 'LOCKED' && isAnotherHouseLocked && (
                <p className="text-[11px] sm:text-xs text-muted font-bold uppercase tracking-wider mt-4 text-center">
                  Buzzers will re-arm immediately if their answer is wrong
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer Info with Official Logo */}
      <footer className="w-full text-center py-3 px-4 text-[10px] sm:text-xs text-muted border-t border-border-glass/30 z-10 bg-black/10 flex items-center justify-center gap-2">
        <HouseLogo name={house.name} color={house.color} icon={house.icon} size="xs" />
        <span className="text-primary font-bold">HHM LIVE EVENT &bull; {house.name.toUpperCase()}</span>
      </footer>
    </div>
  );
}
