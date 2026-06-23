import React from 'react';
import type { FullClaim } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Car, CheckCircle2, Clock, DollarSign, Plus } from 'lucide-react';

interface DashboardProps {
  userRole: 'STAFF' | 'ACCOUNTANT';
  claims: FullClaim[];
}

export default function Dashboard({ userRole, claims }: DashboardProps) {
  // Logic to process data for charts
  const relevantClaims = userRole === 'STAFF' ? claims.filter(c => c.staff_id === 'S001') : claims;
  
  const totalAmount = relevantClaims.reduce((sum, c) => sum + c.total_amount, 0);
  const pendingCount = relevantClaims.filter(c => c.claim_status === 'PENDING').length;
  const approvedCount = relevantClaims.filter(c => c.claim_status === 'APPROVED' || c.claim_status === 'PAID').length;
  
  // Aggregate monthly data for chart
  const monthlyDataMap: Record<string, number> = {};
  relevantClaims.forEach(c => {
    const month = format(parseISO(c.claim_date), 'MMM yy');
    monthlyDataMap[month] = (monthlyDataMap[month] || 0) + c.total_amount;
  });
  const chartData = Object.keys(monthlyDataMap).map(key => ({
    name: key,
    amount: parseFloat(monthlyDataMap[key].toFixed(2))
  }));

  return (
    <div className="flex flex-col h-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between shrink-0 gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome back, {userRole === 'STAFF' ? 'Ahmad Faizal' : 'Siti Nurhaliza'}
          </h1>
          <p className="text-slate-500 mt-1">Review and manage travel expenses.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md shadow-indigo-200 flex items-center gap-2 transition-all w-fit">
          <Plus className="w-5 h-5" />
          Add Travel Log
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        <KpiCard 
          title="Total Claimed" 
          value={`$${totalAmount.toFixed(2)}`} 
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />} 
          trend="+12% from last month"
          trendUp={true}
        />
        <KpiCard 
          title="Pending Claims" 
          value={pendingCount.toString()} 
          icon={<Clock className="w-6 h-6 text-amber-600" />} 
        />
        <KpiCard 
          title="Approved Claims" 
          value={approvedCount.toString()} 
          icon={<CheckCircle2 className="w-6 h-6 text-indigo-600" />} 
        />
        <KpiCard 
          title="Total Trips" 
          value={relevantClaims.reduce((sum, c) => sum + c.trips.length, 0).toString()} 
          icon={<Car className="w-6 h-6 text-blue-600" />} 
        />
      </div>

      {/* Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Expense Overview</h3>
            <span className="text-indigo-600 text-xs font-semibold hover:underline cursor-pointer">View Details</span>
          </div>
          <div className="p-6 h-72 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#F1F5F9'}} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value}`, 'Amount']}
                />
                <Bar dataKey="amount" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Recent Activity</h3>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {relevantClaims.slice(0, 4).map((claim) => (
              <div key={claim.claim_id} className="flex items-center p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className={`w-2 h-2 rounded-full mr-3 ${
                  claim.claim_status === 'APPROVED' || claim.claim_status === 'PAID' ? 'bg-emerald-500' :
                  claim.claim_status === 'PENDING' ? 'bg-amber-500' : 'bg-slate-300'
                }`} />
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-[13px]">
                    {userRole === 'ACCOUNTANT' ? claim.staff.staff_fname : `Claim ${claim.claim_id}`}
                  </p>
                  <p className="text-xs text-slate-400">{format(parseISO(claim.claim_date), 'MMM dd, yyyy')}</p>
                </div>
                <div className="text-sm font-bold text-slate-800">
                  ${claim.total_amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, trend, trendUp }: { title: string, value: string, icon: React.ReactNode, trend?: string, trendUp?: boolean }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between items-start h-full">
      <div className="w-full flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{value}</span>
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg shrink-0">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-xs">
          <span className={trendUp ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
            {trend}
          </span>
        </div>
      )}
    </div>
  );
}
