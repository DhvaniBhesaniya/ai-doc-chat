import React, { useState } from "react";
import { useLogin, useRegister } from "@/hooks/useAuth.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const login = useLogin();
  const register = useRegister();

  const onSubmit = (e) => {
    e.preventDefault();
    if (mode === "login") {
      login.mutate({ email, password });
    } else {
      register.mutate({ email, password, name });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
        </div>
        <h1 className="text-white text-2xl font-bold text-center mb-2">AI DocChat</h1>
        <p className="text-white/70 text-center mb-6">{mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create an account to start chatting with your documents.'}</p>
        <div className="flex justify-center mb-6 space-x-2">
          <Button variant={mode==='login'?'default':'secondary'} onClick={() => setMode('login')} className="rounded-full">Login</Button>
          <Button variant={mode==='register'?'default':'secondary'} onClick={() => setMode('register')} className="rounded-full">Register</Button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-sm text-white/80">Name</label>
              <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" className="bg-white/20 text-white placeholder-white/50 border-white/20" />
            </div>
          )}
          <div>
            <label className="text-sm text-white/80">Email</label>
            <Input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" placeholder="you@example.com" className="bg-white/20 text-white placeholder-white/50 border-white/20" />
          </div>
          <div>
            <label className="text-sm text-white/80">Password</label>
            <Input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" placeholder="••••••••" className="bg-white/20 text-white placeholder-white/50 border-white/20" />
          </div>
          <Button type="submit" className="w-full btn-ai rounded-lg" disabled={login.isPending || register.isPending}>
            {mode==='login' ? (login.isPending?'Signing in...':'Sign in') : (register.isPending?'Creating account...':'Create account')}
          </Button>
        </form>
        {(login.isError || register.isError) && (
          <p className="text-red-300 text-sm mt-4 text-center">{(login.error||register.error)?.message || 'Something went wrong'}</p>
        )}
      </div>
    </div>
  );
} 