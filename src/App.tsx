import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  FileCheck2, 
  LogOut, 
  Bell,
  Loader2
} from 'lucide-react';
import { DatabaseService } from './services/apexClient';
import type { FullClaim, MileageClaim, Trip, Staff, Approval, Payment, UserSession } from './types';
import Dashboard from './components/Dashboard';
import Claims from './components/Claims';
import Approvals from './components/Approvals';
import Login from './components/Login';

function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    // Attempt session recovery from storage
    const cached = sessionStorage.getItem('sl_claims_session');
    return cached ? JSON.parse(cached) : null;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'claims' | 'approvals'>('dashboard');
  const [claims, setClaims] = useState<FullClaim[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    sessionStorage.setItem('sl_claims_session', JSON.stringify(userSession));
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setSession(null);
    setClaims([]);
    sessionStorage.removeItem('sl_claims_session');
  };

  const loadData = async () => {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    try {
      const [
        claimsData, 
        tripsData, 
        staffData, 
        approvalsData, 
        paymentsData
      ] = await Promise.all([
        DatabaseService.getMileageClaim(),
        DatabaseService.getTrip(),
        DatabaseService.getStaff(),
        DatabaseService.getApproval(),
        DatabaseService.getPayment()
      ]);

      const formattedClaims: FullClaim[] = claimsData.map((claim: MileageClaim) => {
        const claimTrips = tripsData.filter((t: Trip) => t.claim_id === claim.claim_id);
        const total_amount = claimTrips.reduce((sum: number, t: Trip) => sum + t.trip_amount, 0);
        
        const staff = staffData.find((s: Staff) => s.staff_id === claim.staff_id) || {
          staff_id: claim.staff_id,
          staff_fname: 'Unknown',
          staff_lname: 'Staff',
          staff_phone: '',
          staff_email: '',
          position: 'Staff Member',
          dept_id: 'D01'
        };

        const approval = approvalsData.find((a: Approval) => a.claim_id === claim.claim_id);
        const payment = approval ? paymentsData.find((p: Payment) => p.approval_id === approval.approval_id) : undefined;

        return {
          ...claim,
          staff,
          trips: claimTrips,
          total_amount,
          approval,
          payment
        };
      });

      setClaims(formattedClaims);
    } catch (err: any) {
      console.error("Failed to load records: ", err);
      setError("An error occurred while communicating with the database. Please reload.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  // If no user session is verified, render ONLY the login page to ensure strict protection.
  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Generate initials for User avatar
  const initials = session.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden text-[14px]">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">SL</span>
          </div>
          <div className="flex flex-col hidden sm:flex">
            <span className="font-bold text-slate-800 leading-none mb-1">SL Software Solutions</span>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Mileage Claim System</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex gap-4 items-center">
            <div className="relative">
              <div className="w-2 h-2 bg-red-500 rounded-full absolute -top-0.5 -right-0.5"></div>
              <Bell className="w-6 h-6 text-slate-400" />
            </div>
            <div className="h-8 w-px bg-slate-200 mx-1"></div>
            <div className="flex items-center gap-3">
              <div className="text-right leading-none hidden sm:block">
                <p className="font-semibold text-slate-700">{session.name}</p>
                <p className="text-[11px] text-slate-400">{session.positionOrTitle}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center text-indigo-700 font-bold">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 shrink-0 overflow-y-auto">
          <nav className="space-y-1 flex-1">
            <NavItem 
              icon={<LayoutDashboard className="w-5 h-5" />} 
              label="Dashboard" 
              isActive={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            {session.role === 'STAFF' && (
              <NavItem 
                icon={<Receipt className="w-5 h-5" />} 
                label="My Claims" 
                isActive={activeTab === 'claims'} 
                onClick={() => setActiveTab('claims')} 
              />
            )}
            {session.role === 'ACCOUNTANT' && (
              <NavItem 
                icon={<FileCheck2 className="w-5 h-5" />} 
                label="Approvals" 
                isActive={activeTab === 'approvals'} 
                onClick={() => setActiveTab('approvals')} 
              />
            )}
          </nav>

          <div className="mt-8 bg-slate-900 rounded-2xl p-5 text-white shadow-lg mb-6">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">Logged in as</p>
            <div className="mb-4">
              <p className="font-semibold text-sm truncate">{session.name}</p>
              <p className="text-xs text-indigo-400 font-medium capitalize mt-0.5">{session.role.toLowerCase()}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center w-full px-4 py-2 bg-slate-800 text-slate-300 hover:bg-rose-600 hover:text-white rounded-xl font-bold transition-all text-xs cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </aside>

        {/* Dynamic Display Area */}
        <section className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto bg-slate-50 relative p-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-slate-500 font-medium">Syncing with database records...</p>
            </div>
          ) : (
            <div className="w-full max-w-7xl mx-auto flex flex-col flex-1 min-h-0">
              {error && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={loadData} className="underline font-semibold hover:text-amber-900">Retry Connection</button>
                </div>
              )}
              {activeTab === 'dashboard' && (
                <Dashboard 
                  userRole={session.role} 
                  claims={session.role === 'STAFF' ? claims.filter(c => c.staff_id === session.id) : claims} 
                  onAddClaimClick={() => setActiveTab('claims')} 
                />
              )}
              {activeTab === 'claims' && session.role === 'STAFF' && (
                <Claims 
                  claims={claims.filter(c => c.staff_id === session.id)} 
                  currentStaffId={session.id}
                  onClaimCreated={loadData}
                />
              )}
              {activeTab === 'approvals' && session.role === 'ACCOUNTANT' && (
                <Approvals 
                  claims={claims} 
                  currentAccId={session.id}
                  onStatusChanged={loadData}
                />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 text-left rounded-xl transition-colors ${
        isActive 
          ? 'bg-indigo-50 text-indigo-700 font-semibold' 
          : 'text-slate-500 hover:bg-slate-50 font-medium'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default App;