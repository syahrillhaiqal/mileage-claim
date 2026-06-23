import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  FileCheck2, 
  LogOut, 
  Car,
  Bell
} from 'lucide-react';
import { getFullClaims } from './data';
import Dashboard from './components/Dashboard';
import Claims from './components/Claims';
import Approvals from './components/Approvals';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claims' | 'approvals'>('dashboard');
  
  // For demonstration, act as Accountant or Staff
  // In a real app auth would handle this. We'll add a simple toggle for UX demonstration.
  const [userRole, setUserRole] = useState<'STAFF' | 'ACCOUNTANT'>('STAFF');

  const claims = getFullClaims();

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
                <p className="font-semibold text-slate-700">{userRole === 'STAFF' ? 'Ahmad Faizal' : 'Siti Nurhaliza'}</p>
                <p className="text-[11px] text-slate-400">{userRole === 'STAFF' ? 'Software Engineer' : 'Accountant'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center text-indigo-700 font-bold">
                {userRole === 'STAFF' ? 'AF' : 'SN'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar navigation */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 shrink-0 transition-all duration-300 overflow-y-auto">
          <nav className="space-y-1 flex-1">
            <NavItem 
              icon={<LayoutDashboard className="w-5 h-5" />} 
              label="Dashboard" 
              isActive={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <NavItem 
              icon={<Receipt className="w-5 h-5" />} 
              label="My Claims" 
              isActive={activeTab === 'claims'} 
              onClick={() => setActiveTab('claims')} 
            />
            {userRole === 'ACCOUNTANT' && (
              <NavItem 
                icon={<FileCheck2 className="w-5 h-5" />} 
                label="Approvals" 
                isActive={activeTab === 'approvals'} 
                onClick={() => setActiveTab('approvals')} 
              />
            )}
          </nav>

          <div className="mt-8 bg-slate-900 rounded-2xl p-5 text-white shadow-lg mb-6">
            <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-2">Role Prototype</p>
            <select 
              value={userRole} 
              onChange={(e) => {setActiveTab('dashboard'); setUserRole(e.target.value as 'STAFF' | 'ACCOUNTANT');}}
              className="w-full bg-slate-800 border border-slate-700 text-sm rounded-xl py-2 px-3 focus:ring-2 focus:ring-indigo-500 font-medium text-white mb-4"
            >
              <option value="STAFF">Staff View</option>
              <option value="ACCOUNTANT">Accountant View</option>
            </select>
            <button className="flex items-center w-full px-4 py-2 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl font-medium transition-colors text-sm">
              <LogOut className="w-4 h-4 mr-3" />
              Logout
            </button>
          </div>
        </aside>

        {/* Content Body */}
        <section className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto bg-slate-50 relative p-8">
          <div className="w-full max-w-7xl mx-auto flex flex-col flex-1 min-h-0">
            {activeTab === 'dashboard' && <Dashboard userRole={userRole} claims={claims} />}
            {activeTab === 'claims' && <Claims claims={claims.filter(c => c.staff_id === 'S001')} />}
            {activeTab === 'approvals' && userRole === 'ACCOUNTANT' && <Approvals claims={claims} />}
          </div>
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
