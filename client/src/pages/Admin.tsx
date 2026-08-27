import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Plus, Play, SkipForward,
  RotateCcw, Volume2, 
  Clock, LogOut, RefreshCw,
  LayoutDashboard, Database, Home, Edit2, Upload, Key, Eye, EyeOff,
  Award, History, XCircle, CheckCircle, Download, FileSpreadsheet,
  Search, CheckCircle2, AlertCircle, Info, X,
  ArrowUp, ArrowDown, Shuffle, GripVertical
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ThemeToggle } from '../components/ThemeToggle';
import { HouseLogo } from '../components/HouseLogo';
import { CsvImportModal } from '../components/CsvImportModal';
import { downloadSampleCSV } from '../utils/csvHelper';
import { ConfirmModal, type ConfirmModalConfig } from '../components/ui/ConfirmModal';
import { ToastContainer, type ToastItem } from '../components/ui/ToastNotification';

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
  order_index?: number;
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
  winnerHouse?: House | null;
  finalLeaderboard?: House[];
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

// Helper to retrieve auth header
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export default function Admin() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'questions' | 'houses'>('live');
  const [adminUsername, setAdminUsername] = useState('');
  const [gameState, setGameState] = useState<GameState>({ status: 'IDLE', timerSeconds: 0, lockedHouseId: null, currentQuestion: null });
  const [timer, setTimer] = useState<number>(0);
  const [houses, setHouses] = useState<House[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});
  const [visibleCodes, setVisibleCodes] = useState<Record<string, boolean>>({});
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false);
  const navigate = useNavigate();

  // CSV Import & Question Search State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [questionSearch, setQuestionSearch] = useState('');
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showCsvGuideCard, setShowCsvGuideCard] = useState(false);

  // Forms state
  const [questionForm, setQuestionForm] = useState<Question>({ id: null, clue_letters: '', hero_name: '', heroine_name: '', movie_name: '', points: 1 });
  const [houseForm, setHouseForm] = useState<{ id: string | null; name: string; color: string; icon: string; loginCode: string }>({ id: null, name: '', color: '#000000', icon: 'Circle', loginCode: '' });

  // Custom UI Modals & Toasts
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, message, type, title }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchData = () => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const authHeaders = getAuthHeaders();

    fetch(serverUrl + '/api/admin/houses', {
      credentials: 'include',
      headers: { ...authHeaders }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: House[]) => {
        if (Array.isArray(data)) setHouses(data);
      })
      .catch(err => console.error('[Admin] Error fetching houses:', err));

    fetch(serverUrl + '/api/admin/questions', {
      credentials: 'include',
      headers: { ...authHeaders }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Question[]) => {
        if (Array.isArray(data)) {
          setQuestions(data);
        }
      })
      .catch(err => console.error('[Admin] Error fetching questions:', err));

    fetch(serverUrl + '/api/admin/recent-rounds', {
      credentials: 'include',
      headers: { ...authHeaders }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: RecentRound[]) => {
        if (Array.isArray(data)) setRecentRounds(data);
      })
      .catch(err => console.error('[Admin] Error fetching recent rounds:', err));

    fetch(serverUrl + '/api/sessions/active', {
      credentials: 'include',
      headers: { ...authHeaders }
    })
      .then(res => res.json())
      .then(data => {
        setActiveSessionId(data.activeSessionId);
      })
      .catch(err => console.error('[Admin] Error fetching active session:', err));
  };

  useEffect(() => {
    let isMounted = true;
    
    // Verify admin authentication before revealing dashboard
    fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/me', {
      credentials: 'include',
      headers: { ...getAuthHeaders() }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          setAdminUsername(data.username || localStorage.getItem('admin_username') || 'Admin');
          setIsCheckingAuth(false);
          fetchData();
        }
      })
      .catch(() => {
        if (isMounted) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_username');
          navigate('/admin/login', { replace: true });
        }
      });

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

    socket.on('timer:expired', () => {
      setShowTimeoutPopup(true);
    });

    socket.on('leaderboard:update', (data: House[]) => setHouses(data));
    socket.on('devices:update', (counts: Record<string, number>) => setDeviceCounts(counts));

    return () => {
      isMounted = false;
      socket.off('state:update');
      socket.off('clue:show');
      socket.off('buzzer:locked');
      socket.off('timer:tick');
      socket.off('timer:expired');
      socket.off('leaderboard:update');
      socket.off('devices:update');
    };
  }, [navigate]);

  useEffect(() => {
    if (showTimeoutPopup && gameState.status === 'LOCKED') {
      setConfirmModal({
        isOpen: true,
        title: 'Did they answer in time?',
        message: 'The 10-second timer has expired. Was the answer correct?',
        confirmText: 'Yes, Correct',
        cancelText: 'No, Wrong',
        variant: 'primary',
        icon: 'help',
        onConfirm: async () => {
          await judge(true);
        },
        onCancel: async () => {
          await judge(false);
        }
      });
      setShowTimeoutPopup(false);
    }
  }, [showTimeoutPopup, gameState.status]);

  // --- Live Game Actions ---
  const startRound = async (questionId: string | null = null) => {
    console.log('[Admin] startRound called with questionId:', questionId);
    setRevealAnswer(false);
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/start-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ questionId })
      });
      const data = await res.json();
      console.log('[Admin] startRound response status:', res.status, data);

      if (!res.ok) {
        if (data.error && (data.error.includes('No unused questions') || data.error.includes('No unused'))) {
          setConfirmModal({
            isOpen: true,
            title: 'All Questions Used',
            message: 'All questions in the bank have been used in this session!\n\nWould you like to reset all questions to available status and immediately load the next question?',
            confirmText: 'Reset & Start Clue',
            cancelText: 'Cancel',
            variant: 'primary',
            icon: 'refresh',
            onConfirm: async () => {
              await resetUsedQuestions(true);
              startRound();
            }
          });
        } else {
          showToast(data.error || 'Failed to start round', 'error');
        }
        return;
      }

      if (data.question) {
        setGameState({
          status: 'GET_READY',
          currentQuestion: data.question,
          buzzersOpen: false,
          lockedHouseId: null,
          lockedByDeviceId: null,
          lockedOutHouses: [],
          timerSeconds: 5
        });
      }

      fetchData();
    } catch (err) {
      console.error('[Admin] Error starting round:', err);
      showToast('Network error connecting to server', 'error');
    }
  };

  const judge = async (correct: boolean) => {
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ correct })
    });
    fetchData();
  };

  const resetBuzzers = async () => {
    setRevealAnswer(false);
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/reset-buzzers', {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      credentials: 'include'
    });
  };

  const revealGlobal = async () => {
    await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/reveal', {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      credentials: 'include'
    });
  };

  const goIdle = async () => {
    setRevealAnswer(false);
    try {
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/idle', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      fetchData();
    } catch (e) {
      showToast('Error setting game to idle state', 'error');
    }
  };

  const resetLeaderboard = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Leaderboard Scores?',
      message: 'This will reset all house scores back to 0. This action cannot be undone.\n\nAre you sure you want to proceed?',
      confirmText: 'Reset Scores',
      cancelText: 'Cancel',
      variant: 'destructive',
      icon: 'trash',
      onConfirm: async () => {
        try {
          const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/reset-leaderboard', {
            method: 'POST',
            headers: { ...getAuthHeaders() },
            credentials: 'include'
          });
          if (!res.ok) throw new Error('Request failed');
          fetchData();
          showToast('Leaderboard scores have been reset to 0.', 'success', 'Scores Reset');
        } catch (err) {
          showToast('Error resetting leaderboard', 'error');
        }
      }
    });
  };

  // --- Questions Actions ---
  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = questionForm.id ? 'PUT' : 'POST';
    const url = questionForm.id ? `/api/admin/questions/${questionForm.id}` : '/api/admin/questions';
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(questionForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save question');
      
      const wasEdit = Boolean(questionForm.id);
      setQuestionForm({ id: null, clue_letters: '', hero_name: '', heroine_name: '', movie_name: '', points: 1 });
      fetchData();
      showToast(wasEdit ? 'Question updated successfully!' : 'Question added to Question Bank!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error saving question', 'error');
    }
  };

  const deleteQuestion = (id?: string | null, clue?: string) => {
    if (!id) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Question?',
      message: `Are you sure you want to remove "${clue || 'this question'}" from the Question Bank?`,
      confirmText: 'Delete Question',
      cancelText: 'Cancel',
      variant: 'destructive',
      icon: 'trash',
      onConfirm: async () => {
        try {
          const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/questions/${id}`, {
            method: 'DELETE',
            headers: { ...getAuthHeaders() },
            credentials: 'include'
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete question');
          
          fetchData();
          showToast('Question deleted from Question Bank', 'success');
        } catch (err: any) {
          showToast(err.message || 'Failed to delete question', 'error');
        }
      }
    });
  };

  const resetUsedQuestions = async (silent = false) => {
    if (silent) {
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions/reset-used', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      fetchData();
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Reset Questions Status?',
      message: 'All questions currently marked as "Used" will be reset to "Available" for upcoming rounds.',
      confirmText: 'Reset Used Status',
      cancelText: 'Cancel',
      variant: 'primary',
      icon: 'refresh',
      onConfirm: async () => {
        try {
          await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions/reset-used', {
            method: 'POST',
            headers: { ...getAuthHeaders() },
            credentials: 'include'
          });
          fetchData();
          showToast('All questions reset to available status!', 'success');
        } catch (err) {
          showToast('Failed to reset questions', 'error');
        }
      }
    });
  };

  const handleCsvImportSuccess = (importedCount: number, skippedCount: number) => {
    let msg = `Successfully imported ${importedCount} question${importedCount !== 1 ? 's' : ''} into the Question Bank!`;
    if (skippedCount > 0) {
      msg += ` (${skippedCount} row${skippedCount !== 1 ? 's were' : ' was'} skipped due to missing required fields)`;
    }
    showToast(msg, 'success', 'CSV Import Complete');
    fetchData();
  };

  // Reorder question order up or down
  const moveQuestion = async (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newQuestions = [...questions];
    const [moved] = newQuestions.splice(currentIndex, 1);
    newQuestions.splice(targetIndex, 0, moved);

    // Optimistic UI update
    setQuestions(newQuestions);

    try {
      const orderedIds = newQuestions.map(q => q.id).filter(Boolean);
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ orderedIds })
      });
    } catch (err) {
      console.error('Failed to save question order:', err);
      fetchData();
    }
  };

  // Drag and Drop handlers for reordering questions
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, _index?: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newQuestions = [...questions];
    const [moved] = newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(dropIndex, 0, moved);

    setQuestions(newQuestions);
    setDraggedIndex(null);

    try {
      const orderedIds = newQuestions.map(q => q.id).filter(Boolean);
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ orderedIds })
      });
      showToast('Question order updated!', 'success');
    } catch (err) {
      console.error('Failed to save question order:', err);
      fetchData();
    }
  };

  // Shuffle all questions randomly
  const shuffleQuestions = () => {
    if (questions.length <= 1) return;

    setConfirmModal({
      isOpen: true,
      title: 'Shuffle Question Bank Order?',
      message: 'This will randomly reorder all questions in the bank. Game rounds will follow this newly shuffled sequence.',
      confirmText: 'Shuffle Questions',
      cancelText: 'Cancel',
      variant: 'primary',
      icon: 'shuffle',
      onConfirm: async () => {
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        setQuestions(shuffled);

        try {
          const orderedIds = shuffled.map(q => q.id).filter(Boolean);
          await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify({ orderedIds })
          });
          showToast('Question Bank sequence randomly shuffled!', 'success', 'Shuffled');
        } catch (err) {
          console.error('Failed to shuffle questions:', err);
          fetchData();
          showToast('Failed to save shuffled order', 'error');
        }
      }
    });
  };

  // --- Houses Actions ---
  const saveHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = houseForm.id ? 'PUT' : 'POST';
    const url = houseForm.id ? `/api/admin/houses/${houseForm.id}` : '/api/admin/houses';
    try {
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(houseForm)
      });
      const wasEdit = Boolean(houseForm.id);
      setHouseForm({ id: null, name: '', color: '#000000', icon: 'Circle', loginCode: '' });
      fetchData();
      showToast(wasEdit ? 'House details updated!' : 'New house created!', 'success');
    } catch (err) {
      showToast('Error saving house', 'error');
    }
  };

  const deleteHouse = (id: string, houseName?: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete House?',
      message: `Are you sure you want to delete ${houseName || 'this house'}? Any assigned student devices will be disconnected.`,
      confirmText: 'Delete House',
      cancelText: 'Cancel',
      variant: 'destructive',
      icon: 'trash',
      onConfirm: async () => {
        try {
          await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/houses/${id}`, {
            method: 'DELETE',
            headers: { ...getAuthHeaders() },
            credentials: 'include'
          });
          fetchData();
          showToast('House deleted successfully', 'success');
        } catch (err) {
          showToast('Failed to delete house', 'error');
        }
      }
    });
  };

  const saveCustomCode = async (id: string, houseName?: string) => {
    const clean = customCode.trim().toUpperCase();
    if (!clean || clean.length < 3 || /\s/.test(clean)) {
      showToast("Code must be at least 3 characters with no spaces.", "warning", "Invalid Code");
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Confirm House Code?',
      message: `Set login code "${clean}" for ${houseName || 'this house'}?\n\nStudents will need this new code to enter the game.`,
      confirmText: 'Confirm Code',
      cancelText: 'Cancel',
      variant: 'primary',
      icon: 'key',
      onConfirm: async () => {
        try {
          const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + `/api/admin/houses/${id}/custom-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify({ loginCode: clean })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          
          setEditingCodeId(null);
          setCustomCode('');
          fetchData();
          showToast('House Code updated successfully!', 'success');
        } catch (e: any) {
          showToast(e.message || 'Error updating Code', 'error');
        }
      }
    });
  };

  const logout = async () => {
    try {
      await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/logout', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    navigate('/admin/login');
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ name: sessionName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveSessionId(data.sessionId);
      fetchData();
      showToast('New Session Started!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Error creating session', 'error');
    }
  };

  const finishSession = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Finish & Conclude Event?',
      message: 'This will announce the final Winner House on stage and on all student devices.\n\nYou can review the final standings and then exit & delete the session data.',
      confirmText: 'Announce Winner',
      cancelText: 'Cancel',
      variant: 'primary',
      icon: 'help',
      onConfirm: async () => {
        try {
          const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/finish', {
            method: 'POST',
            headers: { ...getAuthHeaders() },
            credentials: 'include'
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          fetchData();
          showToast(`🏆 ${data.winner?.name || 'Winner House'} is declared Champion!`, 'success', 'Event Concluded');
        } catch (e: any) {
          showToast(e.message || 'Failed to finish session', 'error');
        }
      }
    });
  };

  const endSession = () => {
    setConfirmModal({
      isOpen: true,
      title: 'End & Delete Session?',
      message: 'This will close the current session and permanently delete all houses, players, and round data from this event. Are you sure you want to proceed?',
      confirmText: 'Delete Session Data',
      cancelText: 'Cancel',
      variant: 'destructive',
      icon: 'trash',
      onConfirm: async () => {
        try {
          const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/sessions/end', {
            method: 'POST',
            headers: { ...getAuthHeaders() },
            credentials: 'include'
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setActiveSessionId(null);
          setHouses([]);
          setRecentRounds([]);
          setGameState({ status: 'IDLE', timerSeconds: 0, lockedHouseId: null, currentQuestion: null });
          showToast('Session data deleted and closed.', 'success');
        } catch (e: any) {
          showToast(e.message || 'Error ending session', 'error');
        }
      }
    });
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-secondary text-sm font-medium">Verifying host session...</p>
        </div>
      </div>
    );
  }

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
          {activeSessionId && (
            <button onClick={() => setActiveTab('houses')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all font-bold text-sm ${activeTab === 'houses' ? 'bg-brand/20 text-brand' : 'hover:bg-white/5 text-secondary'}`}>
              <Home size={18} /> Houses
            </button>
          )}
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
        {activeTab === 'live' && !activeSessionId && (
          <div className="flex items-center justify-center h-full">
            <GlassCard className="max-w-md w-full p-8 text-center animate-in">
              <h2 className="text-3xl font-display font-black mb-2 text-primary">No Active Session</h2>
              <p className="text-secondary text-sm mb-8">Create a new session to start a game. This will reset the scoreboard and provision new house codes.</p>
              
              <form onSubmit={createSession} className="space-y-4">
                <Input 
                  label="Session Name (Optional)" 
                  placeholder="e.g. HHM Mega Event - Aug 2026"
                  value={sessionName}
                  onChange={e => setSessionName(e.target.value)}
                />
                <Button type="submit" className="w-full shadow-lg shadow-brand/20 py-3 mt-2 text-sm">
                  CREATE NEW SESSION
                </Button>
              </form>
            </GlassCard>
          </div>
        )}
        
        {activeTab === 'live' && activeSessionId && (
          <div className="grid grid-cols-12 gap-6 h-full animate-in">
            
            {/* Main Center Stage (What the whole room sees — completely unobstructed) */}
            <GlassCard className="col-span-8 flex flex-col items-center justify-between relative overflow-hidden h-full p-6 sm:p-8">
              
              {gameState.status === 'IDLE' ? (
                <div className="m-auto text-center animate-in">
                  <h2 className="text-5xl sm:text-7xl font-display font-black text-brand opacity-40 mb-4">HHM GAME</h2>
                  <p className="text-xl sm:text-2xl text-secondary font-bold uppercase tracking-widest">Stage Idle &bull; Load Next Question to Begin</p>
                </div>
              ) : (
                <div className="w-full flex-1 flex flex-col items-center justify-start overflow-y-auto">
                  {/* Fixed Big Clue Display (Always fixed at top, never moves or jumps) */}
                  <div className="w-full text-center shrink-0 pt-2 pb-4 sm:pb-6">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-secondary block mb-1">
                      Current Clue
                    </span>
                    <h1 className="text-7xl sm:text-8xl md:text-9xl font-display font-black leading-none tracking-tight text-primary drop-shadow-lg select-all">
                      {gameState.currentQuestion?.clue_letters}
                    </h1>
                  </div>

                  {/* Stage Body - Dynamic by State */}
                  <div className="w-full max-w-3xl flex-1 flex flex-col items-center justify-center">
                    {gameState.status === 'GET_READY' && (
                      <div className="inline-flex items-center gap-3 px-8 py-4 bg-orange-500/20 text-orange-500 rounded-full font-bold tracking-widest text-2xl border border-orange-500/30 my-4 animate-in">
                        <Clock size={28} className="animate-pulse" /> GET READY... {timer}s
                      </div>
                    )}

                    {gameState.status === 'CLUE_SHOWN' && (
                      <div className="w-full flex flex-col items-center gap-6 animate-in">
                        <div className="inline-flex items-center gap-2 px-8 py-3 bg-brand/20 text-brand rounded-full animate-pulse-subtle font-bold tracking-widest text-base sm:text-lg border border-brand/30">
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
                            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 items-baseline font-bold text-base text-primary animate-in">
                              <span className="text-secondary font-normal uppercase text-xs tracking-wider whitespace-nowrap">Hero :</span>
                              <span>{gameState.currentQuestion?.hero_name}</span>
                              <span className="text-secondary font-normal uppercase text-xs tracking-wider whitespace-nowrap">Heroine :</span>
                              <span>{gameState.currentQuestion?.heroine_name}</span>
                              <span className="text-secondary font-normal uppercase text-xs tracking-wider whitespace-nowrap">Movie :</span>
                              <span>{gameState.currentQuestion?.movie_name}</span>
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
                      <div className="w-full flex flex-col items-center gap-5 animate-in">
                        {/* Spotlight on the House that buzzed in first */}
                        <div 
                          className="w-full p-6 rounded-3xl border-2 shadow-2xl backdrop-blur-xl relative overflow-hidden"
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

                            {/* Live 10s Circular Countdown Ring */}
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
                                   strokeDashoffset={263.89 * (1 - Math.max(0, Math.min(10, timer)) / 10)} 
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
                            <span className="uppercase tracking-wider opacity-80">10s Countdown</span>
                          </div>
                        </div>

                        {/* Masked Answer Key */}
                        <div className="w-full bg-black/20 border border-border-glass p-5 rounded-2xl text-left backdrop-blur-md">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold uppercase tracking-widest text-secondary">Answer Key</span>
                            <button 
                              onClick={() => setRevealAnswer(!revealAnswer)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-primary text-xs font-bold rounded-lg border border-border-glass transition-colors"
                            >
                              {revealAnswer ? <><EyeOff size={14}/> Hide Answer</> : <><Eye size={14}/> Reveal Answer</>}
                            </button>
                          </div>

                          {revealAnswer ? (
                            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 items-baseline font-bold text-base text-primary animate-in">
                              <span className="text-secondary font-normal uppercase text-xs tracking-wider whitespace-nowrap">Hero :</span>
                              <span>{gameState.currentQuestion?.hero_name}</span>
                              <span className="text-secondary font-normal uppercase text-xs tracking-wider whitespace-nowrap">Heroine :</span>
                              <span>{gameState.currentQuestion?.heroine_name}</span>
                              <span className="text-secondary font-normal uppercase text-xs tracking-wider whitespace-nowrap">Movie :</span>
                              <span>{gameState.currentQuestion?.movie_name}</span>
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

                    {gameState.status === 'LOCKED_ALL' && (
                      <div className="flex flex-col items-center gap-6 animate-in">
                        <div className="inline-flex items-center gap-3 px-8 py-4 bg-red-500/20 text-red-500 rounded-full font-bold tracking-widest text-2xl border border-red-500/30">
                          <XCircle size={28} /> BUZZERS LOCKED
                        </div>
                        <Button onClick={revealGlobal} className="text-xl px-12 py-6 shadow-xl animate-pulse-subtle bg-blue-600 hover:bg-blue-500 text-white border-blue-400">
                          <Eye size={24} className="mr-3" /> REVEAL ANSWER TO ROOM
                        </Button>
                      </div>
                    )}

                    {gameState.status === 'JUDGED' && (
                      <div className="flex flex-col items-center gap-6 animate-in">
                        <div className="inline-flex items-center gap-3 px-8 py-4 bg-green-500/20 text-green-500 rounded-full font-bold tracking-widest text-2xl border border-green-500/30">
                          <CheckCircle size={28} /> CORRECT!
                        </div>
                        <Button onClick={revealGlobal} className="text-xl px-12 py-6 shadow-xl animate-pulse-subtle bg-blue-600 hover:bg-blue-500 text-white border-blue-400">
                          <Eye size={24} className="mr-3" /> REVEAL ANSWER TO ROOM
                        </Button>
                      </div>
                    )}

                    {gameState.status === 'REVEALED' && (
                      <div className="w-full flex flex-col items-center gap-6 animate-in">
                        <div className="w-full bg-brand/10 border-2 border-brand/40 p-6 sm:p-10 rounded-3xl text-left backdrop-blur-md shadow-2xl">
                          <div className="grid grid-cols-[auto_1fr] gap-x-6 sm:gap-x-10 gap-y-4 sm:gap-y-6 items-baseline font-display font-black">
                            <span className="text-brand opacity-90 text-2xl sm:text-3xl font-bold uppercase tracking-wider text-right whitespace-nowrap">
                              Hero :
                            </span>
                            <span className="text-3xl sm:text-5xl text-white break-words">
                              {gameState.currentQuestion?.hero_name}
                            </span>

                            <span className="text-brand opacity-90 text-2xl sm:text-3xl font-bold uppercase tracking-wider text-right whitespace-nowrap">
                              Heroine :
                            </span>
                            <span className="text-3xl sm:text-5xl text-white break-words">
                              {gameState.currentQuestion?.heroine_name}
                            </span>

                            <span className="text-brand opacity-90 text-2xl sm:text-3xl font-bold uppercase tracking-wider text-right whitespace-nowrap">
                              Movie :
                            </span>
                            <span className="text-3xl sm:text-5xl text-white break-words">
                              {gameState.currentQuestion?.movie_name}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm font-bold text-secondary uppercase tracking-widest">
                          Click "Load Next Question" on the right panel to proceed
                        </p>
                      </div>
                    )}

                    {gameState.status === 'FINISHED' && (
                      <div className="w-full flex flex-col items-center gap-6 animate-in py-4 text-center">
                        <div className="inline-flex items-center gap-2 px-6 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 rounded-full font-black tracking-widest text-sm uppercase animate-pulse">
                          <Award size={18} /> EVENT CHAMPION ANNOUNCED
                        </div>

                        {/* Grand Winner Showcase Card */}
                        {(() => {
                          const winner = gameState.winnerHouse || houses.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
                          if (!winner) return null;
                          return (
                            <div 
                              className="w-full max-w-xl p-8 rounded-3xl border-2 shadow-2xl backdrop-blur-2xl relative overflow-hidden flex flex-col items-center"
                              style={{ 
                                borderColor: winner.color, 
                                backgroundColor: `${winner.color}18` 
                              }}
                            >
                              <div className="text-6xl mb-2 animate-bounce">🏆</div>
                              <HouseLogo name={winner.name} color={winner.color} icon={winner.icon} size="xl" className="mb-3" />
                              <span className="text-xs font-black uppercase tracking-widest text-secondary block mb-1">
                                1st Place &bull; Grand Winner
                              </span>
                              <h2 className="text-4xl sm:text-5xl font-display font-black tracking-tight text-primary">
                                {winner.name}
                              </h2>
                              <div className="mt-3 px-5 py-2 rounded-2xl bg-black/40 border border-white/10 text-2xl font-display font-black" style={{ color: winner.color }}>
                                {winner.score ?? 0} Points
                              </div>
                            </div>
                          );
                        })()}

                        {/* Final Standings Leaderboard */}
                        <div className="w-full max-w-xl bg-black/30 border border-border-glass rounded-2xl p-4 backdrop-blur-md">
                          <h4 className="text-xs font-bold text-secondary uppercase tracking-widest mb-3 text-left">
                            Final Standings
                          </h4>
                          <div className="space-y-2">
                            {(gameState.finalLeaderboard || houses.slice().sort((a, b) => (b.score || 0) - (a.score || 0))).map((h, idx) => (
                              <div key={h.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
                                <div className="flex items-center gap-3">
                                  <span className="font-display font-black text-sm w-6 text-center text-secondary">
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                  </span>
                                  <HouseLogo name={h.name} color={h.color} icon={h.icon} size="xs" />
                                  <span className="font-bold text-sm text-primary">{h.name}</span>
                                </div>
                                <span className="text-base font-display font-black text-primary">{h.score ?? 0} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 mt-2">
                          <Button 
                            onClick={endSession} 
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-xl text-sm shadow-xl shadow-red-500/20 uppercase tracking-wider"
                          >
                            <Trash2 size={16} className="mr-2" /> Exit &amp; Delete Session
                          </Button>
                          <Button 
                            variant="secondary" 
                            onClick={goIdle} 
                            className="px-6 py-3.5 text-sm"
                          >
                            Back to Idle
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
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
                  className="w-full text-xs py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 transition-all font-bold tracking-widest uppercase flex items-center justify-center gap-2 mb-2.5"
                >
                  <RefreshCw size={14} /> Reset Leaderboard
                </Button>
                <Button 
                  onClick={finishSession} 
                  className="w-full text-xs py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 transition-all font-bold tracking-widest uppercase flex items-center justify-center gap-2 mb-2.5"
                >
                  <Award size={15} className="text-yellow-400" /> Finish &amp; Announce Winner
                </Button>
                <Button 
                  onClick={endSession} 
                  className="w-full text-xs py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 transition-all font-bold tracking-widest uppercase flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> End &amp; Delete Session
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
            {/* Status / Import Notification */}
            {importNotice && (
              <div className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm animate-in shadow-lg ${
                importNotice.type === 'success' 
                  ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300' 
                  : 'bg-red-500/15 border border-red-500/40 text-red-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  {importNotice.type === 'success' ? (
                    <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle size={20} className="shrink-0 text-red-400" />
                  )}
                  <span className="font-medium">{importNotice.message}</span>
                </div>
                <button 
                  onClick={() => setImportNotice(null)} 
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Header with Title & Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-display font-bold">Question Bank</h2>
                  <span className="px-3 py-1 rounded-full bg-brand/20 text-brand border border-brand/30 text-xs font-bold">
                    {(Array.isArray(questions) ? questions.length : 0)} Total
                  </span>
                </div>
                <p className="text-xs text-secondary mt-1">
                  Manage game clues, import question sets via CSV, or download template files.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button 
                  variant="secondary" 
                  onClick={shuffleQuestions}
                  disabled={!Array.isArray(questions) || questions.length <= 1}
                  className="gap-2 text-xs py-2 px-3.5"
                  title="Randomly shuffle the question playing sequence"
                >
                  <Shuffle size={16} /> Shuffle Order
                </Button>

                <Button 
                  variant="secondary" 
                  onClick={() => setShowCsvGuideCard(!showCsvGuideCard)} 
                  className="gap-2 text-xs py-2 px-3.5"
                  title="View required CSV format & columns"
                >
                  <Info size={16} className="text-brand-light" />
                  {showCsvGuideCard ? 'Hide CSV Format' : 'CSV Format Info'}
                </Button>

                <Button 
                  variant="secondary" 
                  onClick={downloadSampleCSV} 
                  className="gap-2 text-xs py-2 px-3.5"
                  title="Download ready-to-use CSV template"
                >
                  <Download size={16} /> Download Template
                </Button>

                <Button 
                  variant="primary" 
                  onClick={() => setIsCsvModalOpen(true)} 
                  className="gap-2 text-xs py-2 px-4 shadow-lg shadow-brand/20"
                >
                  <Upload size={16} /> Import CSV
                </Button>

                <Button 
                  variant="secondary" 
                  onClick={() => resetUsedQuestions(false)} 
                  className="gap-2 text-xs py-2 px-3.5"
                >
                  <RefreshCw size={16} /> Reset Used
                </Button>
              </div>
            </div>

            {/* Collapsible CSV Format Specification Guide */}
            {showCsvGuideCard && (
              <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-4 animate-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                    <FileSpreadsheet size={18} className="text-brand-light" />
                    <span>CSV Question Import Format Specifications</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={downloadSampleCSV} 
                      className="text-xs text-indigo-300 hover:text-white underline inline-flex items-center gap-1 font-semibold"
                    >
                      <Download size={13} /> Download Sample CSV
                    </button>
                    <button 
                      onClick={() => setShowCsvGuideCard(false)} 
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand-light">1. Clue</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">Required</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">Initials shown to students</p>
                    <p className="text-slate-500 font-mono text-[10px]">e.g. MSD, BB, PK</p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand-light">2. Hero</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">Required</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">Lead Actor name</p>
                    <p className="text-slate-500 font-mono text-[10px]">e.g. Prabhas, Allu Arjun</p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand-light">3. Heroine</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">Required</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">Lead Actress name</p>
                    <p className="text-slate-500 font-mono text-[10px]">e.g. Anushka, Samantha</p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand-light">4. Movie</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">Required</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">Movie Title</p>
                    <p className="text-slate-500 font-mono text-[10px]">e.g. Baahubali, Dookudu</p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand-light">5. Points</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Optional</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">Default: 1 point</p>
                    <p className="text-slate-500 font-mono text-[10px]">e.g. 1, 2, 5</p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400">
                  <strong>Header column aliases supported:</strong> <code>clue_letters</code>, <code>hero_name</code>, <code>heroine_name</code>, <code>movie_name</code>, <code>actor</code>, <code>actress</code>, <code>film</code>, <code>score</code>.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Add/Edit Form */}
              <GlassCard className="lg:col-span-4 h-fit">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-lg">
                  <Plus size={20}/> {questionForm.id ? 'Edit' : 'Add'} Question
                </h3>
                <form onSubmit={saveQuestion} className="space-y-5">
                  <Input label="Clue (e.g. MSD)" required value={questionForm.clue_letters} onChange={e=>setQuestionForm({...questionForm, clue_letters: e.target.value})} />
                  <Input label="Hero" required value={questionForm.hero_name} onChange={e=>setQuestionForm({...questionForm, hero_name: e.target.value})} />
                  <Input label="Heroine" required value={questionForm.heroine_name} onChange={e=>setQuestionForm({...questionForm, heroine_name: e.target.value})} />
                  <Input label="Movie" required value={questionForm.movie_name} onChange={e=>setQuestionForm({...questionForm, movie_name: e.target.value})} />
                  <Input type="number" label="Points" required value={String(questionForm.points)} onChange={e=>setQuestionForm({...questionForm, points: parseInt(e.target.value) || 0})} />
                  
                  <div className="flex gap-3 pt-4 border-t border-border-glass">
                    <Button type="submit" className="flex-1">Save</Button>
                    {questionForm.id && <Button variant="secondary" type="button" onClick={() => setQuestionForm({ id: null, clue_letters: '', hero_name: '', heroine_name: '', movie_name: '', points: 1 })}>Cancel</Button>}
                  </div>
                </form>
              </GlassCard>
              
              {/* Questions Table with Search & Reordering */}
              <GlassCard className="lg:col-span-8 overflow-hidden p-0 flex flex-col">
                {/* Search Bar Header */}
                <div className="p-4 bg-black/20 border-b border-border-glass flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
                    <input 
                      type="text" 
                      placeholder="Search questions by clue, hero, movie..." 
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-black/20 dark:bg-black/40 border border-border-glass rounded-xl text-xs text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                    {questionSearch && (
                      <button 
                        onClick={() => setQuestionSearch('')} 
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-secondary">
                    {!questionSearch && (
                      <span className="hidden sm:inline-block text-[11px] text-slate-400 bg-black/20 px-2.5 py-1 rounded-lg border border-border-glass">
                        Drag rows or use arrow buttons to reorder
                      </span>
                    )}
                    <span>
                      Showing <span className="text-primary font-bold">
                        {(Array.isArray(questions) ? questions : []).filter(q => {
                          if (!questionSearch.trim()) return true;
                          const s = questionSearch.toLowerCase();
                          return (
                            (q.clue_letters || '').toLowerCase().includes(s) ||
                            (q.hero_name || '').toLowerCase().includes(s) ||
                            (q.heroine_name || '').toLowerCase().includes(s) ||
                            (q.movie_name || '').toLowerCase().includes(s)
                          );
                        }).length}
                      </span> of <span className="text-primary font-bold">{(Array.isArray(questions) ? questions.length : 0)}</span>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[650px]">
                    <thead className="bg-black/20 text-secondary uppercase tracking-widest text-xs border-b border-border-glass">
                      <tr>
                        <th className="py-4 px-3 w-12 text-center font-bold">#</th>
                        <th className="py-4 px-3 w-20 text-center font-bold">Order</th>
                        <th className="py-4 px-4 font-bold">Clue</th>
                        <th className="py-4 px-4 font-bold">Answers</th>
                        <th className="py-4 px-3 font-bold text-center">Pts</th>
                        <th className="py-4 px-3 font-bold text-center">Used</th>
                        <th className="py-4 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-glass/50">
                      {(() => {
                        const rawQuestions = Array.isArray(questions) ? questions : [];
                        const isFiltered = Boolean(questionSearch.trim());
                        
                        const filtered = rawQuestions.map((q, originalIdx) => ({ q, originalIdx })).filter(({ q }) => {
                          if (!isFiltered) return true;
                          const s = questionSearch.toLowerCase();
                          return (
                            (q.clue_letters || '').toLowerCase().includes(s) ||
                            (q.hero_name || '').toLowerCase().includes(s) ||
                            (q.heroine_name || '').toLowerCase().includes(s) ||
                            (q.movie_name || '').toLowerCase().includes(s)
                          );
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="p-12 text-center text-secondary">
                                <FileSpreadsheet size={36} className="mx-auto mb-3 opacity-30 text-brand" />
                                {questionSearch ? (
                                  <div>
                                    <p className="font-semibold text-primary">No questions matching "{questionSearch}"</p>
                                    <p className="text-xs mt-1">Try searching for a different actor, movie, or clue.</p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="font-semibold text-primary">No questions in the bank yet</p>
                                    <p className="text-xs mt-1 mb-4">Add your first question manually or import a batch via CSV.</p>
                                    <Button 
                                      variant="primary" 
                                      onClick={() => setIsCsvModalOpen(true)}
                                      className="text-xs py-2 px-4 gap-2"
                                    >
                                      <Upload size={14} /> Import CSV Questions
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map(({ q, originalIdx }) => {
                          const isFirst = originalIdx === 0;
                          const isLast = originalIdx === rawQuestions.length - 1;
                          const isDragging = draggedIndex === originalIdx;

                          return (
                            <tr 
                              key={q.id || Math.random()} 
                              draggable={!isFiltered}
                              onDragStart={(e) => handleDragStart(e, originalIdx)}
                              onDragOver={(e) => handleDragOver(e, originalIdx)}
                              onDrop={(e) => handleDrop(e, originalIdx)}
                              className={`transition-all ${
                                isDragging 
                                  ? 'opacity-40 bg-brand/10 border-dashed border-2 border-brand' 
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              {/* Sequence Badge */}
                              <td className="py-4 px-3 text-center">
                                <span className="font-mono text-xs px-2 py-1 rounded-md bg-black/30 border border-border-glass text-secondary font-bold">
                                  #{originalIdx + 1}
                                </span>
                              </td>

                              {/* Reorder Controls */}
                              <td className="py-4 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {!isFiltered && (
                                    <div 
                                      className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 transition-colors"
                                      title="Drag to reorder"
                                    >
                                      <GripVertical size={16} />
                                    </div>
                                  )}
                                  <div className="flex flex-col gap-0.5">
                                    <button 
                                      onClick={() => moveQuestion(originalIdx, 'up')}
                                      disabled={isFirst || isFiltered}
                                      className="p-1 rounded bg-black/20 hover:bg-white/15 text-secondary hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                      title="Move Up"
                                    >
                                      <ArrowUp size={12} />
                                    </button>
                                    <button 
                                      onClick={() => moveQuestion(originalIdx, 'down')}
                                      disabled={isLast || isFiltered}
                                      className="p-1 rounded bg-black/20 hover:bg-white/15 text-secondary hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                      title="Move Down"
                                    >
                                      <ArrowDown size={12} />
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Clue */}
                              <td className="py-4 px-4 font-display font-bold text-xl text-brand-light">
                                {q.clue_letters}
                              </td>

                              {/* Answers */}
                              <td className="py-4 px-4">
                                 <div className="text-secondary font-bold text-xs">Hero: <span className="text-primary font-normal">{q.hero_name}</span></div>
                                 <div className="text-secondary font-bold text-xs">Heroine: <span className="text-primary font-normal">{q.heroine_name}</span></div>
                                 <div className="text-secondary font-bold text-xs">Movie: <span className="text-primary font-normal">{q.movie_name}</span></div>
                              </td>

                              {/* Points */}
                              <td className="py-4 px-3 text-center text-brand font-bold text-base">
                                {q.points}
                              </td>

                              {/* Used / Available */}
                              <td className="py-4 px-3 text-center">
                                {q.used ? (
                                  <span className="bg-white/10 text-secondary px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-border-glass">
                                    Used
                                  </span>
                                ) : (
                                  <span className="bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Available
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-4 px-4 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button 
                                    onClick={() => setQuestionForm(q)} 
                                    className="p-2 bg-black/20 text-secondary hover:text-primary hover:bg-white/10 rounded-xl transition-all" 
                                    title="Edit Question"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => deleteQuestion(q.id, q.clue_letters)} 
                                    className="p-2 bg-black/20 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all" 
                                    title="Delete Question"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
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

                  {!houseForm.id && <Input label="Login Code (e.g. AAKASH28)" type="text" required value={houseForm.loginCode} onChange={e=>setHouseForm({...houseForm, loginCode: e.target.value.toUpperCase()})} />}
                  
                  <div className="flex gap-3 pt-4 border-t border-border-glass">
                    <Button type="submit" className="flex-1">Save</Button>
                    {houseForm.id && <Button variant="secondary" type="button" onClick={() => setHouseForm({ id: null, name: '', color: '#000000', icon: 'Circle', loginCode: '' })}>Cancel</Button>}
                  </div>
                </form>
              </GlassCard>

              <div className="lg:col-span-8 space-y-6">
                {houses.map(h => (
                  <GlassCard key={h.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 sm:p-6 gap-6 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-5 sm:gap-6 flex-1 min-w-0">
                      <HouseLogo name={h.name} color={h.color} icon={h.icon} size="xl" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-2xl sm:text-3xl font-bold font-display text-primary truncate">{h.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 text-xs sm:text-sm text-secondary font-bold uppercase tracking-wider">
                           {editingCodeId === h.id ? (
                             <div className="flex items-center gap-2 bg-black/30 border border-brand/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                               <Key size={15} className="text-brand shrink-0" />
                               <input 
                                 type={visibleCodes[h.id] ? "text" : "password"} 
                                 value={customCode} 
                                 onChange={e => setCustomCode(e.target.value.toUpperCase())} 
                                 placeholder="NEW CODE" 
                                 className="bg-transparent border-none outline-none text-primary font-mono tracking-widest text-sm w-28 uppercase font-bold" 
                                 autoFocus 
                               />
                               <button 
                                 type="button"
                                 onClick={() => setVisibleCodes(prev => ({...prev, [h.id]: !prev[h.id]}))} 
                                 className="text-muted hover:text-primary transition-colors"
                                 title={visibleCodes[h.id] ? "Hide Code" : "Show Code"}
                               >
                                 {visibleCodes[h.id] ? <EyeOff size={15}/> : <Eye size={15}/>}
                               </button>
                              </div>
                           ) : (
                             <div className="flex items-center gap-2 bg-black/20 border border-border-glass px-3 py-1.5 rounded-xl backdrop-blur-sm">
                               <Key size={15} className="text-secondary shrink-0" /> 
                               <span className="font-mono tracking-widest font-bold text-primary">
                                 {visibleCodes[h.id] ? (h.login_code || '••••••••') : '••••••••'}
                               </span>
                               <button 
                                 type="button"
                                 onClick={() => setVisibleCodes(prev => ({...prev, [h.id]: !prev[h.id]}))} 
                                 className="ml-1 text-muted hover:text-primary transition-colors"
                                 title={visibleCodes[h.id] ? "Hide Code" : "Show Code"}
                               >
                                 {visibleCodes[h.id] ? <EyeOff size={15}/> : <Eye size={15}/>}
                               </button>
                              </div>
                           )}
                           <div className="flex items-center gap-2 bg-black/20 border border-border-glass px-3 py-1.5 rounded-xl backdrop-blur-sm">
                             <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse-subtle shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span> 
                             <span className="text-primary font-bold">{deviceCounts[h.id] || 0}</span> Online
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setHouseForm({id: h.id, name: h.name, color: h.color, icon: h.icon, loginCode: h.login_code || ''})} 
                          className="p-2.5 bg-black/20 hover:bg-white/10 text-secondary hover:text-primary rounded-xl transition-all border border-border-glass" 
                          title="Edit House Details"
                        >
                          <Edit2 size={16}/>
                        </button>
                        <button 
                          onClick={() => deleteHouse(h.id, h.name)} 
                          className="p-2.5 bg-black/20 hover:bg-red-500/20 text-red-500/70 hover:text-red-500 rounded-xl transition-all border border-border-glass" 
                          title="Delete House"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>

                      {editingCodeId === h.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <Button 
                            variant="primary" 
                            onClick={() => saveCustomCode(h.id, h.name)} 
                            className="flex-1 text-xs py-2 px-3 gap-1.5 font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-900/30"
                          >
                            <CheckCircle size={14}/> Confirm Code
                          </Button>
                          <Button 
                            variant="secondary" 
                            onClick={() => { setEditingCodeId(null); setCustomCode(''); }} 
                            className="text-xs py-2 px-3 gap-1 font-bold uppercase tracking-wider"
                          >
                            <XCircle size={14}/> Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="secondary" 
                          onClick={() => { setEditingCodeId(h.id); setCustomCode(h.login_code || ''); }} 
                          className="w-full text-xs py-2 px-3.5 gap-1.5 font-bold uppercase tracking-wider bg-black/20 hover:bg-white/10 border-border-glass"
                        >
                          <Edit2 size={13}/> Edit Code
                        </Button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        <CsvImportModal 
          isOpen={isCsvModalOpen} 
          onClose={() => setIsCsvModalOpen(false)} 
          onSuccess={handleCsvImportSuccess} 
          getAuthHeaders={getAuthHeaders} 
        />

        {/* Custom App Confirmation Modal */}
        <ConfirmModal 
          config={confirmModal} 
          onClose={() => setConfirmModal(null)} 
        />

        {/* In-App Toast Notifications */}
        <ToastContainer 
          toasts={toasts} 
          onDismiss={dismissToast} 
        />

      </main>
    </div>
  );
}
