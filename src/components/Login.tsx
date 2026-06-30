import React, { useState } from 'react';
import { DatabaseService } from '../services/apexClient';
import { hashPassword } from '../utils/crypto';
import type { UserSession } from '../types';
import { Lock, Mail, Loader2, ShieldAlert } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
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
      let authenticatedUser: UserSession | null = null;

      const staffMember = await DatabaseService.getStaffByEmail(email);
      
      if (staffMember) {
        const dbHash = staffMember.staff_password || '';
        if (inputHash === dbHash || password === staffMember.staff_password) {
          authenticatedUser = {
            id: staffMember.staff_id,
            name: `${staffMember.staff_fname} ${staffMember.staff_lname}`,
            email: staffMember.staff_email,
            role: 'STAFF',
            positionOrTitle: staffMember.position
          };
        } else {
          throw new Error("Incorrect password.");
        }
      } 
      else {
        const accountant = await DatabaseService.getAccountantByEmail(email);
        
        if (accountant) {
          const dbHash = accountant.acc_password || '';
          if (inputHash === dbHash || password === accountant.acc_password) {
            authenticatedUser = {
              id: accountant.acc_id,
              name: accountant.acc_name,
              email: accountant.acc_email,
              role: 'ACCOUNTANT',
              positionOrTitle: 'Accountant'
            };
          } else {
            throw new Error("Incorrect password.");
          }
        }
      }

      if (authenticatedUser) {
        onLoginSuccess(authenticatedUser);
      } else {
        throw new Error("Invalid credentials or user record not found.");
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to authenticate with database.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-orange-400/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-red-500/15 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <img 
          src="/logo.png" 
          alt="SL Software Solutions Logo" 
          className="h-16 w-auto object-contain mx-auto mb-6 drop-shadow-sm" 
        />
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Mileage Claim System
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Sign in to manage your claims and approvals
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-orange-900/5 border border-orange-100 sm:rounded-3xl sm:px-10">
          
          {errorMsg && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-600 text-sm flex items-start gap-3 shadow-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all shadow-sm"
                  placeholder="name@slsoftware.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-orange-500/30 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Authenticating...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400 font-medium">
              &copy; {new Date().getFullYear()} SL Software Solutions Sdn Bhd
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}