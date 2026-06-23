import React, { useState } from 'react';
import { DatabaseService } from '../services/apexClient';
import { hashPassword } from '../utils/crypto';
import type { UserSession } from '../types';
import { Lock, Mail, Loader2, ShieldAlert } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [role, setRole] = useState<'STAFF' | 'ACCOUNTANT'>('STAFF');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const inputHash = (await hashPassword(password)).toUpperCase();

      if (role === 'STAFF') {
        const staffMember = await DatabaseService.getStaffByEmail(email);
        if (!staffMember) {
          throw new Error("Invalid credentials or user record not found.");
        }
        
        // Match hashes (assuming field exists in staff payload)
        const dbHash = staffMember.staff_password || '';
        if (inputHash !== dbHash && password !== staffMember.staff_password) {
          throw new Error("Incorrect password.");
        }

        onLoginSuccess({
          id: staffMember.staff_id,
          name: `${staffMember.staff_fname} ${staffMember.staff_lname}`,
          email: staffMember.staff_email,
          role: 'STAFF',
          positionOrTitle: staffMember.position
        });
      } else {
        const accountant = await DatabaseService.getAccountantByEmail(email);
        if (!accountant) {
          throw new Error("Invalid credentials or accountant record not found.");
        }

        const dbHash = accountant.acc_password || '';
        if (inputHash !== dbHash && password !== accountant.acc_password) {
          throw new Error("Incorrect password.");
        }

        onLoginSuccess({
          id: accountant.acc_id,
          name: accountant.acc_name,
          email: accountant.acc_email,
          role: 'ACCOUNTANT',
          positionOrTitle: 'Accountant'
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to authenticate with database.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
          <span className="text-white font-extrabold text-3xl">SL</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Mileage Claim System
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          SL Software Solutions Sdn Bhd
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800 py-8 px-4 shadow-xl border border-slate-700/50 sm:rounded-3xl sm:px-10">
          
          {/* Tab Selection */}
          <div className="flex bg-slate-900 p-1.5 rounded-xl mb-6 border border-slate-700/30">
            <button
              type="button"
              onClick={() => { setRole('STAFF'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                role === 'STAFF' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Staff Portal
            </button>
            <button
              type="button"
              onClick={() => { setRole('ACCOUNTANT'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                role === 'ACCOUNTANT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Accountant
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  placeholder="name@slsoftware.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:opacity-50 transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}