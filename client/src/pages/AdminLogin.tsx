import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Shield } from 'lucide-react';

export default function AdminLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? '/api/admin/login' : '/api/admin/signup';
    try {
      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <GlassCard className="w-full max-w-md animate-in relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand/20 text-brand rounded-2xl flex items-center justify-center mb-4 border border-brand/30">
            <Shield size={32} />
          </div>
          <h1 className="text-3xl font-display font-bold">HHM Admin</h1>
          <p className="text-secondary mt-2 text-sm">{isLogin ? 'Sign in to host the game' : 'Create a new host account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center font-bold backdrop-blur-md">{error}</div>}
          
          <Input 
            label="Username / Email"
            type="text" 
            placeholder="host@event.com" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required 
          />
          
          <Input 
            label="Password"
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          
          <Button type="submit" className="w-full">
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-secondary hover:text-primary text-sm transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-border-glass text-center">
          <Link 
            to="/play" 
            className="text-secondary hover:text-primary text-sm transition-colors"
          >
            Player? Join a House
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
