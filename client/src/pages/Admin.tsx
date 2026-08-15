import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Plus, Play, SkipForward,
  RotateCcw, Volume2, 
  Clock, LogOut, RefreshCw,
  LayoutDashboard, Database, Home, Edit2, Upload, Key, Eye, EyeOff,
  Award, History, XCircle, CheckCircle
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ThemeToggle } from '../components/ThemeToggle';
import { HouseLogo } from '../components/HouseLogo';

interface House {
  id: string;
  name: string;
  color: string;
  icon: string;
  login_code?: string;
  score?: number;
}

interface Question {
  id?: string | null;
  clue_letters: string;
  hero_name: string;
  heroine_name: string;
  movie_name: string;
  points: number;
  used?: boolean;
}

interface GameState {
  status: string;
  timerSeconds: number;
  lockedHouseId: string | null;
  lockedByDeviceId?: string | null;
  currentQuestion?: Question | null;
  buzzElapsedMs?: number | null;
  lockedOutHouses?: string[];
  buzzersOpen?: boolean;
  lockedStudentName?: string | null;
}

interface RecentRound {
  id: string;
  clue_letters: string;
  hero_name: string;
  heroine_name: string;
  movie_name: string;
  house_name: string;
  house_color: string;
  house_icon: string;
  result: string;
  points_awarded: number;
  locked_at: number;
  student_name?: string | null;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'live' | 'questions' | 'houses'>('live');
  const [adminUsername, setAdminUsername] = useState('');
  const [gameState, setGameState] = useState<GameState>({ status: 'IDLE', timerSeconds: 0, lockedHouseId: null, currentQuestion: null });
  const [timer, setTimer] = useState<number>(0);
  const [houses, setHouses] = useState<House[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [customPin, setCustomPin] = useState('');
  const [revealAnswer, setRevealAnswer] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Forms state
  const [questionForm, setQuestionForm] = useState<Question>({ id: null, clue_letters: '', hero_name: '', heroine_name: '', movie_name: '', points: 10 });
  const [houseForm, setHouseForm] = useState<{ id: string | null; name: string; color: string; icon: string; loginCode: string }>({ id: null, name: '', color: '#000000', icon: 'Circle', loginCode: '' });

  useEffect(() => {
    fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/me', {credentials: 'include'})
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => setAdminUsername(data.username))
      .catch(() => navigate('/admin/login'));

    fetchData();

    socket.on('state:update', (state: GameState) => {
      setGameState(state);
      setTimer(state.timerSeconds);
      if (state.status === 'IDLE' || state.status === 'CLUE_SHOWN') {
        setRevealAnswer(false);
      }
    });

    socket.on('clue:show', ({ question }: { question: Question }) => {
      console.log('[Admin] Received clue:show socket broadcast:', question);
      setGameState({
        status: 'CLUE_SHOWN',
        currentQuestion: question,
        buzzersOpen: true,
        lockedHouseId: null,
        lockedByDeviceId: null,
        lockedOutHouses: [],
        timerSeconds: 0
      });
      setRevealAnswer(false);
    });

    socket.on('buzzer:locked', () => {
      setTimer(15);
    });

    socket.on('timer:tick', ({ seconds }: { seconds: number }) => {
      setTimer(seconds);
    });

    socket.on('leaderboard:update', (data: House[]) => setHouses(data));
    socket.on('devices:update', (counts: Record<string, number>) => setDeviceCounts(counts));

    return () => {
      socket.off('state:update');
      socket.off('clue:show');
      socket.off('buzzer:locked');
      socket.off('timer:tick');
      socket.off('leaderboard:update');
      socket.off('devices:update');
    };
  }, [navigate]);

  const fetchData = () => {
    fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/houses', { credentials: 'include' })
      .then(res => res.json())
      .then((data: House[]) => setHouses(data))
      .catch(console.error);
    fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions', { credentials: 'include' })
      .then(res => res.json())
      .then((data: Question[]) => setQuestions(data))
      .catch(console.error);
    fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/recent-rounds', { credentials: 'include' })
      .then(res => res.json())
      .then((data: RecentRound[]) => setRecentRounds(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  // --- Live Game Actions ---
  const startRound = async (questionId: string | null = null) => {
    console.log('[Admin] startRound called with questionId:', questionId);
    setRevealAnswer(false);
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/start-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ questionId })
      });
      const data = await res.json();
      console.log('[Admin] startRound response status:', res.status, data);

      if (!res.ok) {
        if (data.error && (data.error.includes('No unused questions') || data.error.includes('No unused'))) {
          if (confirm('All questions in the bank have been used!\n\nWould you like to reset all questions to unused status and load the next clue now?')) {
            await resetUsedQuestions();
            return startRound();
          } else {
            alert('No unused questions available. Please reset used status from Question Bank or add new questions.');
          }
        } else {
          alert(data.error || 'Failed to start round');
        }
        return;
      }

      if (data.question) {
        setGameState({
          status: 'CLUE_SHOWN',
          currentQuestion: data.question,
          buzzersOpen: true,
          lockedHouseId: null,
          lockedByDeviceId: null,
          lockedOutHouses: [],
          timerSeconds: 0
        });
      }

      fetchData();
    } catch (err) {
      console.error('[Admin] Error starting round:', err);
      alert('Network error connecting to server');
    }
  };

  const judge = async (correct: boolean) => {
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ correct })
    });
    fetchData();
  };

  const resetBuzzers = async () => {
    setRevealAnswer(false);
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/reset-buzzers', { method: 'POST', credentials: 'include' });
  };

  const goIdle = async () => {
    setRevealAnswer(false);
    try {
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/idle', { method: 'POST', credentials: 'include' });
      fetchData();
    } catch (e) {
      alert('Error going idle');
    }
  };

  const resetLeaderboard = async () => {
    if (!confirm('This will reset all house scores to 0. This cannot be undone. Are you sure?')) return;
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/reset-leaderboard', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Request failed');
      fetchData();
    } catch(err) {
      alert('Error resetting leaderboard');
    }
  };

  // --- Questions Actions ---
  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = questionForm.id ? 'PUT' : 'POST';
    const url = questionForm.id ? `/api/admin/questions/${questionForm.id}` : '/api/admin/questions';
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + url, {
        method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(questionForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save question');
      
      setQuestionForm({ id: null, clue_letters: '', hero_name: '', heroine_name: '', movie_name: '', points: 10 });
      fetchData();
      alert('Question saved successfully');
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    }
  };

  const deleteQuestion = async (id?: string | null) => {
    if (!id) return;
    if (!confirm('Delete this question?')) return;
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/questions/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchData();
  };

  const resetUsedQuestions = async () => {
    if (!confirm('Reset all questions to unused?')) return;
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions/reset-used', { method: 'POST', credentials: 'include' });
    fetchData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const csvData = ev.target?.result;
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ csvData })
      });
      fetchData();
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };

  // --- Houses Actions ---
  const saveHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = houseForm.id ? 'PUT' : 'POST';
    const url = houseForm.id ? `/api/admin/houses/${houseForm.id}` : '/api/admin/houses';
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + url, {
      method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(houseForm)
    });
    setHouseForm({ id: null, name: '', color: '#000000', icon: 'Circle', loginCode: '' });
    fetchData();
  };

  const deleteHouse = async (id: string) => {
    if (!confirm('Delete this house?')) return;
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/houses/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchData();
  };

  const regenerateCode = async (id: string) => {
    if (!confirm('Regenerate PIN for this house? Students will need the new PIN to join.')) return;
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/houses/${id}/regenerate-code`, { method: 'POST', credentials: 'include' });
    fetchData();
  };

  const saveCustomPin = async (id: string) => {
    if (!customPin || customPin.length < 4 || /\s/.test(customPin)) {
      return alert("PIN must be at least 4 characters with no spaces.");
    }
    if (!confirm('This will invalidate the current PIN — students using it will need the new code. Proceed?')) return;
    
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/houses/${id}/custom-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ loginCode: customPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setEditingPinId(null);
      setCustomPin('');
      fetchData();
    } catch (e: any) {
      alert(e.message || 'Error occurred');
    }
  };

  const logout = async () => {
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/logout', { method: 'POST', credentials: 'include' });
    navigate('/admin/login');
  };

  const lockedHouse = houses.find(h => h.id === gameState.lockedHouseId);

  return (
    <div className="flex h-screen w-full relative z-10 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 sm:w-72 bg-glass border-r border-border-glass flex flex-col backdrop-blur-xl shrink-0">
        <div className="p-6 sm:p-8 border-b border-border-glass">
          <h1 className="text-2xl sm:text-3xl font-display font-black text-brand">HHM Admin</h1>
          <p className="text-xs text-secondary mt-1 tracking-wide uppercase font-semibold">Host: {adminUsername}</p>
        </div>
        
        <nav className="flex-1 p-3 sm:p-4 space-y-1.5 sm:space-y-2">
          <button onClick={() => setActiveTab('live')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all font-bold text-sm ${activeTab === 'live' ? 'bg-brand/20 text-brand' : 'hover:bg-white/5 text-secondary'}`}>
            <LayoutDashboard size={18} /> Live Game
          </button>
          <button onClick={() => setActiveTab('questions')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all font-bold text-sm ${activeTab === 'questions' ? 'bg-brand/20 text-brand' : 'hover:bg-white/5 text-secondary'}`}>
            <Database size={18} /> Question Bank
          </button>
          <button onClick={() => setActiveTab('houses')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all font-bold text-sm ${activeTab === 'houses' ? 'bg-brand/20 text-brand' : 'hover:bg-white/5 text-secondary'}`}>
            <Home size={18} /> Houses
          </button>
        </nav>

        <div className="p-5 border-t border-border-glass flex flex-col gap-3">
          <ThemeToggle className="w-full flex justify-center" />
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all font-bold text-sm">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 relative z-20">
        
        {/* LIVE GAME TAB */}
        {activeTab === 'live' && (
          <div className="grid grid-cols-12 gap-6 h-full animate-in">
            
            {/* Main Center Stage (What the whole room sees — completely unobstructed) */}
            <GlassCard className="col-span-8 flex flex-col items-center justify-center relative overflow-hidden h-full p-8">
              
              {gameState.status === 'IDLE' && (
                <div className="text-center">
                  <h2 className="text-5xl sm:text-7xl font-display font-black text-brand opacity-40 mb-4">HHM GAME</h2>
                  <p className="text-xl sm:text-2xl text-secondary font-bold uppercase tracking-widest">Stage Idle &bull; Load Next Question to Begin</p>
                </div>
              )}

              {gameState.status === 'CLUE_SHOWN' && (
                <div className="text-center animate-in w-full max-w-3xl px-4 flex flex-col items-center justify-center">
                  {/* Giant Unobstructed Clue */}
                  <h2 className="text-7xl sm:text-8xl md:text-9xl font-display font-black mb-8 leading-none tracking-tight text-primary drop-shadow-lg">
                    {gameState.currentQuestion?.clue_letters}
                  </h2>

                  <div className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand/20 text-brand rounded-full animate-pulse-subtle font-bold tracking-widest text-lg border border-brand/30 mb-8">
                    <Volume2 size={20} /> BUZZERS ARMED (WAITING FOR FIRST BUZZ)
                  </div>

                  {/* Masked Answer Key Card */}
                  <div className="w-full bg-black/20 border border-border-glass p-5 sm:p-6 rounded-2xl text-left backdrop-blur-md">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
                        Answer Key
                      </span>
                      <button 
                        onClick={() => setRevealAnswer(!revealAnswer)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-primary text-xs font-bold rounded-lg border border-border-glass transition-colors"
                      >
                        {revealAnswer ? <><EyeOff size={14}/> Hide Answer</> : <><Eye size={14}/> Reveal Answer</>}
                      </button>
                    </div>

                    {revealAnswer ? (
                      <div className="text-primary text-base space-y-1.5 font-bold animate-in">
                        <p><span className="text-secondary font-normal mr-4 w-20 inline-block">Hero:</span> {gameState.currentQuestion?.hero_name}</p>
                        <p><span className="text-secondary font-normal mr-4 w-20 inline-block">Heroine:</span> {gameState.currentQuestion?.heroine_name}</p>
                        <p><span className="text-secondary font-normal mr-4 w-20 inline-block">Movie:</span> {gameState.currentQuestion?.movie_name}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-muted text-sm py-1.5">
                        <span className="font-mono tracking-widest text-secondary">Hero: •••••••• | Heroine: •••••••• | Movie: ••••••••</span>
                        <span className="text-xs text-secondary opacity-70 italic">(Hidden from audience)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {gameState.status === 'LOCKED' && lockedHouse && (
                <div className="text-center w-full max-w-3xl animate-in flex flex-col items-center justify-center">
                  
                  {/* Spotlight on the House that buzzed in first with Official Logo */}
                  <div 
                    className="w-full p-6 sm:p-8 rounded-3xl border-2 shadow-2xl backdrop-blur-xl mb-6 relative overflow-hidden"
                    style={{ 
                      borderColor: lockedHouse.color, 
                      backgroundColor: `${lockedHouse.color}15` 
                    }}
                  >
                    <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 sm:gap-4 text-center sm:text-left">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <HouseLogo 
                          name={lockedHouse.name} 
                          color={lockedHouse.color} 
                          icon={lockedHouse.icon} 
                          size="lg" 
                        />
                        <div>
                          <span className="text-xs font-black uppercase tracking-widest text-secondary block mb-1">
                            First to Buzz In
                          </span>
                          <h3 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-primary">
                            {lockedHouse.name}
                          </h3>
                          {gameState.lockedStudentName && (
                            <span className="text-lg font-bold text-primary mt-0.5 block">
                              {gameState.lockedStudentName}
                            </span>
                          )}
                          {gameState.buzzElapsedMs != null && (
                            <span className="text-xs font-bold text-muted flex items-center gap-1 mt-1">
                              <Clock size={12} /> Buzzed in {(gameState.buzzElapsedMs / 1000).toFixed(2)}s
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Live 15s Circular Countdown Ring with exact 100% full initial ring */}
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 flex flex-col items-center justify-center bg-black/40 shadow-lg shrink-0 relative" style={{ borderColor: lockedHouse.color, color: lockedHouse.color }}>
                        <span className="text-3xl sm:text-4xl font-display font-black leading-none">{timer}s</span>
                        <span className="text-[9px] uppercase tracking-wider font-bold opacity-80 mt-0.5">Time Left</span>
                        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                           <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="5" fill="none" className="text-white/10" />
                           <circle 
                             cx="50" 
                             cy="50" 
                             r="42" 
                             stroke={lockedHouse.color} 
                             strokeWidth="6" 
                             fill="none" 
                             strokeDasharray={263.89} 
                             strokeDashoffset={263.89 * (1 - Math.max(0, Math.min(15, timer)) / 15)} 
                             strokeLinecap="round"
                             className="transition-all duration-1000 ease-linear" 
                           />
                        </svg>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border-glass/40 flex items-center justify-between text-xs font-bold text-secondary">
                      <span className="flex items-center gap-1.5 text-primary font-bold">
                        <Volume2 size={15} className="text-green-500 animate-pulse" /> Student is answering verbally out loud
                      </span>
                      <span className="uppercase tracking-wider opacity-80">15s Countdown</span>
                    </div>
                  </div>

                  {/* Question Clue & Masked/Unmasked Answer Key */}
                  <div className="w-full bg-black/20 border border-border-glass p-5 sm:p-6 rounded-2xl text-left backdrop-blur-md">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-black text-2xl text-primary">{gameState.currentQuestion?.clue_letters}</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-secondary">Answer Key</span>
                      </div>
                      <button 
                        onClick={() => setRevealAnswer(!revealAnswer)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-primary text-xs font-bold rounded-lg border border-border-glass transition-colors"
                      >
                        {revealAnswer ? <><EyeOff size={14}/> Hide Answer</> : <><Eye size={14}/> Reveal Answer</>}
                      </button>
                    </div>

                    {revealAnswer ? (
                      <div className="text-primary text-base space-y-1.5 font-bold animate-in">
                        <p><span className="text-secondary font-normal mr-4 w-20 inline-block">Hero:</span> {gameState.currentQuestion?.hero_name}</p>
                        <p><span className="text-secondary font-normal mr-4 w-20 inline-block">Heroine:</span> {gameState.currentQuestion?.heroine_name}</p>
                        <p><span className="text-secondary font-normal mr-4 w-20 inline-block">Movie:</span> {gameState.currentQuestion?.movie_name}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-muted text-sm py-1.5">
                        <span className="font-mono tracking-widest text-secondary">Hero: •••••••• | Heroine: •••••••• | Movie: ••••••••</span>
                        <span className="text-xs text-secondary opacity-70 italic">(Hidden from audience)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {gameState.status === 'JUDGED' && (
                <div className="text-center animate-in w-full max-w-2xl flex flex-col items-center justify-center">
                  <h2 className="text-6xl sm:text-7xl font-display font-black text-green-500 mb-6 drop-shadow-lg leading-none">CORRECT!</h2>
                  
                  <div className="w-full bg-black/20 p-6 rounded-3xl border border-border-glass text-left">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-secondary">Answer Reveal</span>
                      <button 
                        onClick={() => setRevealAnswer(!revealAnswer)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-primary text-xs font-bold rounded-lg border border-border-glass transition-colors"
                      >
                        {revealAnswer ? <><EyeOff size={14}/> Hide Answer</> : <><Eye size={14}/> Reveal Answer</>}
                      </button>
                    </div>

                    {revealAnswer ? (
                      <div className="text-xl space-y-3 font-bold text-primary animate-in">
                        <p><span className="text-secondary font-normal w-24 inline-block">Hero:</span> {gameState.currentQuestion?.hero_name}</p>
                        <p><span className="text-secondary font-normal w-24 inline-block">Heroine:</span> {gameState.currentQuestion?.heroine_name}</p>
                        <p><span className="text-secondary font-normal w-24 inline-block">Movie:</span> {gameState.currentQuestion?.movie_name}</p>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-secondary font-bold">
                        Click "Reveal Answer" to display the full movie and actors to the room.
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-bold text-secondary uppercase tracking-widest mt-6">
                    Click "Load Next Question" on the right panel to proceed
                  </p>
                </div>
              )}
            </GlassCard>

            {/* Host Controls Sidebar (Side Panel with Flow, Judgment, Leaderboard, and Recent History) */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-1">
              
              {/* ROUND CONTROL */}
              <GlassCard className="p-4 sm:p-5 shrink-0">
                <h3 className="text-xs font-bold mb-3 flex items-center gap-2 uppercase tracking-widest text-secondary">
                  <Play size={14} className="text-brand"/> Round Controls
                </h3>
                <Button onClick={() => startRound()} className="w-full text-sm sm:text-base mb-2.5 py-3 shadow-md shadow-brand/20">
                  LOAD NEXT QUESTION
                </Button>
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <Button variant="secondary" onClick={resetBuzzers} className="flex-col gap-1 py-2 text-xs">
                    <RotateCcw size={15} /> Reopen Buzzers
                  </Button>
                  <Button variant="secondary" onClick={goIdle} className="flex-col gap-1 py-2 text-xs">
                    <SkipForward size={15} /> Go Idle
                  </Button>
                </div>
                <Button 
                  onClick={resetLeaderboard} 
                  className="w-full text-xs py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 transition-all font-bold tracking-widest uppercase flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} /> Reset Leaderboard
                </Button>
              </GlassCard>

              {/* JUDGMENT CONTROLS (Displayed when a house is locked in) */}
              {gameState.status === 'LOCKED' && (
                <GlassCard className="animate-in border-2 border-brand/50 p-4 sm:p-5 shrink-0">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">Host Judgment</h3>
                    <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full border border-brand/20">
                      Live Call
                    </span>
                  </div>
                  <p className="text-xs text-secondary mb-3">
                    Listen to {lockedHouse?.name}'s verbal answer and score round:
                  </p>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => judge(true)} 
                      className="p-3.5 bg-green-500/20 hover:bg-green-500/30 text-green-500 border border-green-500/50 rounded-xl flex items-center justify-center gap-2 font-display font-black text-sm transition-all shadow-md active:scale-95"
                    >
                      <CheckCircle size={18} /> CORRECT (+1 PT)
                    </button>
                    <button 
                      onClick={() => judge(false)} 
                      className="p-3.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 rounded-xl flex items-center justify-center gap-2 font-display font-black text-sm transition-all shadow-md active:scale-95"
                    >
                      <XCircle size={18} /> WRONG (-1 PT &amp; LOCKOUT)
                    </button>
                  </div>
                </GlassCard>
              )}

              {/* LEADERBOARD with Official House Logos */}
              <GlassCard className="p-4 sm:p-5 shrink-0">
                <h3 className="text-xs font-bold mb-3 uppercase tracking-widest text-secondary flex items-center gap-2">
                  <Award size={15} className="text-yellow-500" /> Leaderboard
                </h3>
                <div className="space-y-2">
                  {houses.map(h => (
                    <div key={h.id} className="flex items-center justify-between p-2.5 bg-white/5 dark:bg-black/20 rounded-xl border border-border-glass backdrop-blur-md">
                      <div className="flex items-center gap-2.5">
                        <HouseLogo name={h.name} color={h.color} icon={h.icon} size="xs" />
                        <span className="font-bold text-sm text-primary">{h.name}</span>
                      </div>
                      <span className="text-lg font-display font-black">{h.score ?? 0}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* RECENT ROUNDS HISTORY with Official House Logos */}
              <GlassCard className="p-4 sm:p-5 shrink-0">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
                    <History size={14} /> Recent Rounds
                  </h3>
                  <span className="text-[10px] text-muted">Latest {recentRounds.length}</span>
                </div>

                {recentRounds.length === 0 ? (
                  <p className="text-xs text-muted italic">No completed rounds yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentRounds.map((r, i) => (
                      <div 
                        key={r.id || i}
                        className="p-2.5 bg-black/20 rounded-xl border border-border-glass flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-display font-black text-sm text-primary">{r.clue_letters}</span>
                          <HouseLogo name={r.house_name} color={r.house_color} icon={r.house_icon} size="xs" />
                          <span className="text-xs text-secondary truncate">
                            {r.house_name || 'House'}
                            {r.student_name && <span className="opacity-70 ml-1">— {r.student_name}</span>}
                          </span>
                        </div>

                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                          r.result === 'CORRECT' 
                            ? 'bg-green-500/20 text-green-500 border-green-500/30' 
                            : 'bg-red-500/20 text-red-500 border-red-500/30'
                        }`}>
                          {r.result === 'CORRECT' ? '+1' : '-1'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

            </div>
          </div>
        )}

        {/* QUESTIONS TAB */}
        {activeTab === 'questions' && (
          <div className="space-y-8 animate-in">
            <div className="flex justify-between items-center">
              <h2 className="text-4xl font-display font-bold">Question Bank</h2>
              <div className="flex gap-4">
                <Button variant="secondary" onClick={resetUsedQuestions} className="gap-2">
                  <RefreshCw size={18} /> Reset Used
                </Button>
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload size={18} /> Import CSV
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <GlassCard className="lg:col-span-4 h-fit">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-lg"><Plus size={20}/> {questionForm.id ? 'Edit' : 'Add'} Question</h3>
                <form onSubmit={saveQuestion} className="space-y-5">
                  <Input label="Clue (e.g. MSD)" required value={questionForm.clue_letters} onChange={e=>setQuestionForm({...questionForm, clue_letters: e.target.value})} />
                  <Input label="Hero" required value={questionForm.hero_name} onChange={e=>setQuestionForm({...questionForm, hero_name: e.target.value})} />
                  <Input label="Heroine" required value={questionForm.heroine_name} onChange={e=>setQuestionForm({...questionForm, heroine_name: e.target.value})} />
                  <Input label="Movie" required value={questionForm.movie_name} onChange={e=>setQuestionForm({...questionForm, movie_name: e.target.value})} />
                  <Input type="number" label="Points" required value={String(questionForm.points)} onChange={e=>setQuestionForm({...questionForm, points: parseInt(e.target.value) || 0})} />
                  
                  <div className="flex gap-3 pt-4 border-t border-border-glass">
                    <Button type="submit" className="flex-1">Save</Button>
                    {questionForm.id && <Button variant="secondary" type="button" onClick={() => setQuestionForm({ id: null, clue_letters: '', hero_name: '', heroine_name: '', movie_name: '', points: 10 })}>Cancel</Button>}
                  </div>
                </form>
              </GlassCard>
              
              <GlassCard className="lg:col-span-8 overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[600px]">
                    <thead className="bg-black/20 text-secondary uppercase tracking-widest text-xs border-b border-border-glass">
                      <tr>
                        <th className="p-6 font-bold">Clue</th>
                        <th className="p-6 font-bold">Answers</th>
                        <th className="p-6 font-bold text-center">Pts</th>
                        <th className="p-6 font-bold text-center">Used</th>
                        <th className="p-6 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-glass/50">
                      {(Array.isArray(questions) ? questions : []).map(q => (
                        <tr key={q.id || Math.random()} className="hover:bg-white/5 transition-colors">
                          <td className="p-6 font-display font-bold text-2xl">{q.clue_letters}</td>
                          <td className="p-6">
                             <div className="text-secondary font-bold">H: <span className="text-primary font-normal">{q.hero_name}</span></div>
                             <div className="text-secondary font-bold">H: <span className="text-primary font-normal">{q.heroine_name}</span></div>
                             <div className="text-secondary font-bold">M: <span className="text-primary font-normal">{q.movie_name}</span></div>
                          </td>
                          <td className="p-6 text-center text-brand font-bold text-lg">{q.points}</td>
                          <td className="p-6 text-center">
                            {q.used ? <span className="bg-white/10 text-secondary px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-border-glass">Used</span> : <span className="bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">Available</span>}
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setQuestionForm(q)} className="p-2.5 bg-black/20 text-secondary hover:text-primary hover:bg-white/10 rounded-xl transition-all"><Edit2 size={18} /></button>
                              <button onClick={() => deleteQuestion(q.id)} className="p-2.5 bg-black/20 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {/* HOUSES TAB */}
        {activeTab === 'houses' && (
          <div className="space-y-8 animate-in">
            <h2 className="text-4xl font-display font-bold">House Manager</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <GlassCard className="lg:col-span-4 h-fit">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-lg"><Plus size={20}/> {houseForm.id ? 'Edit' : 'Add'} House</h3>
                <form onSubmit={saveHouse} className="space-y-5">
                  <Input label="Name (e.g. House Jal)" required value={houseForm.name} onChange={e=>setHouseForm({...houseForm, name: e.target.value})} />
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-secondary uppercase tracking-wider">Color</label>
                    <input type="color" value={houseForm.color} onChange={e=>setHouseForm({...houseForm, color: e.target.value})} className="h-[52px] w-full bg-black/10 dark:bg-black/30 rounded-xl cursor-pointer border border-border-glass" />
                  </div>

                  {!houseForm.id && <Input label="Login PIN (e.g. 1234)" type="password" required value={houseForm.loginCode} onChange={e=>setHouseForm({...houseForm, loginCode: e.target.value})} />}
                  
                  <div className="flex gap-3 pt-4 border-t border-border-glass">
                    <Button type="submit" className="flex-1">Save</Button>
                    {houseForm.id && <Button variant="secondary" type="button" onClick={() => setHouseForm({ id: null, name: '', color: '#000000', icon: 'Circle', loginCode: '' })}>Cancel</Button>}
                  </div>
                </form>
              </GlassCard>

              <div className="lg:col-span-8 space-y-6">
                {houses.map(h => (
                  <GlassCard key={h.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 sm:p-6 gap-6 hover:bg-white/5">
                    <div className="flex items-center gap-6">
                      <HouseLogo name={h.name} color={h.color} icon={h.icon} size="xl" />
                      <div className="flex-1 overflow-hidden">
                        <h3 className="text-2xl sm:text-3xl font-bold font-display text-primary truncate">{h.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 text-xs sm:text-sm text-secondary font-bold uppercase tracking-wider">
                           {editingPinId === h.id ? (
                             <div className="flex items-center gap-2 bg-black/20 border border-border-glass px-3 py-1.5 rounded-lg backdrop-blur-sm">
                               <input type={visiblePins[h.id] ? "text" : "password"} value={customPin} onChange={e => setCustomPin(e.target.value)} placeholder="New PIN" className="bg-transparent border-none outline-none text-primary w-24 font-mono tracking-widest text-sm" autoFocus />
                               <button onClick={() => setVisiblePins(prev => ({...prev, [h.id]: !prev[h.id]}))} className="text-muted hover:text-primary transition-colors">
                                 {visiblePins[h.id] ? <EyeOff size={16}/> : <Eye size={16}/>}
                               </button>
                               <div className="h-4 w-px bg-border-glass mx-1"></div>
                               <button onClick={() => saveCustomPin(h.id)} className="text-green-500 hover:text-green-400 transition-colors"><CheckCircle size={18}/></button>
                               <button onClick={() => { setEditingPinId(null); setCustomPin(''); }} className="text-red-500 hover:text-red-400 transition-colors"><XCircle size={18}/></button>
                              </div>
                           ) : (
                             <div className="flex items-center gap-2 bg-black/20 border border-border-glass px-3 py-1.5 rounded-lg backdrop-blur-sm">
                               <Key size={16}/> 
                               <span className="font-mono tracking-widest">{visiblePins[h.id] ? (h.login_code || '****') : '****'}</span>
                               <button onClick={() => setVisiblePins(prev => ({...prev, [h.id]: !prev[h.id]}))} className="ml-2 text-muted hover:text-primary transition-colors">
                                 {visiblePins[h.id] ? <EyeOff size={16}/> : <Eye size={16}/>}
                               </button>
                              </div>
                           )}
                           <div className="flex items-center gap-2 bg-black/20 border border-border-glass px-3 py-1.5 rounded-lg backdrop-blur-sm">
                             <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse-subtle shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span> 
                             <span className="text-primary">{deviceCounts[h.id] || 0}</span> Online
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setHouseForm({id: h.id, name: h.name, color: h.color, icon: h.icon, loginCode: h.login_code || ''})} className="p-3 bg-black/20 hover:bg-white/10 text-secondary hover:text-primary rounded-xl transition-all border border-border-glass"><Edit2 size={18}/></button>
                        <button onClick={() => deleteHouse(h.id)} className="p-3 bg-black/20 hover:bg-red-500/20 text-red-500/70 hover:text-red-500 rounded-xl transition-all border border-border-glass"><Trash2 size={18}/></button>
                      </div>
                      {editingPinId !== h.id && (
                        <div className="flex gap-2 w-full">
                          <button onClick={() => regenerateCode(h.id)} className="flex-1 text-[10px] font-bold uppercase tracking-wider bg-black/20 hover:bg-white/10 px-2 py-2 rounded-xl border border-border-glass transition-all text-secondary hover:text-primary flex items-center justify-center gap-1"><RefreshCw size={12}/> Regenerate</button>
                          <button onClick={() => { setEditingPinId(h.id); setCustomPin(h.login_code || ''); }} className="flex-1 text-[10px] font-bold uppercase tracking-wider bg-black/20 hover:bg-white/10 px-2 py-2 rounded-xl border border-border-glass transition-all text-secondary hover:text-primary flex items-center justify-center gap-1"><Edit2 size={12}/> Edit PIN</button>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
