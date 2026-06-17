import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { getErrorMessage } from '../utils/error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/login', { username, password });
      localStorage.setItem('token', res.data.accessToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('Login berhasil!');
      navigate('/');
    } catch (err: unknown) {
      console.error('Login Error:', err);
      const message = getErrorMessage(err, 'Login gagal');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 font-sans antialiased">
      <div className="w-full max-w-sm border border-border bg-card shadow-sm">
        <div className="border-b border-border px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold uppercase tracking-widest">CAFE POS</h1>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">v1.0.0</span>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-tight text-muted-foreground">
            Precision Systems / Authentication
          </p>
        </div>
        
        <div className="px-8 py-8">
          <form onSubmit={handleLogin} className="grid gap-6">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="username" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  User Account
                </Label>
                <span className="text-[10px] font-mono text-muted-foreground">01</span>
              </div>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
                className="h-11 rounded-none border-border bg-background focus-visible:ring-0 focus-visible:border-foreground transition-colors"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Secure Access
                </Label>
                <span className="text-[10px] font-mono text-muted-foreground">02</span>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="h-11 rounded-none border-border bg-background focus-visible:ring-0 focus-visible:border-foreground transition-colors"
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              variant="outline"
              className="mt-4 h-11 rounded-none border-foreground bg-foreground text-background hover:bg-background hover:text-foreground font-bold uppercase tracking-widest transition-all"
            >
              {loading ? 'Processing...' : 'Authorize Login'}
            </Button>
          </form>
        </div>
        
        <div className="border-t border-border px-8 py-4 bg-muted/30">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            <span>Terminal: 001</span>
            <span>Status: Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
