import React from 'react';
import type { FullClaim } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Car, CheckCircle2, Clock, DollarSign, Plus } from 'lucide-react';

interface DashboardProps {
  userRole: 'STAFF' | 'ACCOUNTANT';
  claims: FullClaim[];
  currentStaffName: string;
  onAddClaimClick: () => void;
}

export default function Dashboard({ userRole, claims, currentStaffName, onAddClaimClick }: DashboardProps) {
  const relevantClaims = claims;
  
  const totalAmount = relevantClaims.reduce((sum, c) => sum + c.total_amount, 0);
  const pendingCount = relevantClaims.filter(c => c.claim_status === 'PENDING').length;
  const approvedCount = relevantClaims.filter(c => c.claim_status === 'APPROVED' || c.claim_status === 'PAID').length;
  
  const monthlyDataMap: Record<string, number> = {};
  relevantClaims.forEach(c => {
    try {
      const month = format(parseISO(c.claim_date), 'MMM yy');
      monthlyDataMap[month] = (monthlyDataMap[month] || 0) + c.total_amount;
    } catch {
      // Catch date errors
    }
  });

  const chartData = Object.keys(monthlyDataMap).map(key => ({
    name: key,
    amount: parseFloat(monthlyDataMap[key].toFixed(2))
  }));

  const currentDate = new Date();
  const currentMonthKey = format(currentDate, 'MMM yy');
  
  const prevDate = new Date();
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonthKey = format(prevDate, 'MMM yy');

  const currentMonthTotal = monthlyDataMap[currentMonthKey] || 0;
  const prevMonthTotal = monthlyDataMap[prevMonthKey] || 0;

  let trendText = "No prior data";
  let isTrendUp = true;

  if (prevMonthTotal > 0) {
    const percentChange = ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
    isTrendUp = percentChange >= 0;
    trendText = `${isTrendUp ? '+' : ''}${percentChange.toFixed(1)}% from last month`;
  } else if (currentMonthTotal > 0 && prevMonthTotal === 0) {
    trendText = "+100% from last month"; 
    isTrendUp = true;
  }

  return (
    <div className="flex flex-col h-full space-y-8">
      {/* Welcome Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between shrink-0 gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome back, {currentStaffName}
          </h1>
          <p className="text-slate-500 mt-1">Review and manage travel expenses.</p>
        </div>
        {userRole === 'STAFF' && (
          <button 
            onClick={onAddClaimClick}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-md shadow-orange-500/25 flex items-center gap-2 transition-all w-fit cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Add Travel Log
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        <KpiCard 
          title="Total Claimed" 
          value={`RM ${totalAmount.toFixed(2)}`} 
          icon={<DollarSign className="w-6 h-6 text-orange-600" />} 
          trend={trendText}
          trendUp={isTrendUp}
        />
        <KpiCard 
          title="Pending Claims" 
          value={pendingCount.toString()} 
          icon={<Clock className="w-6 h-6 text-amber-600" />} 
        />
        <KpiCard 
          title="Approved Claims" 
          value={approvedCount.toString()} 
          icon={<CheckCircle2 className="w-6 h-6 text-red-600" />} 
        />
        <KpiCard 
          title="Total Trips" 
          value={relevantClaims.reduce((sum, c) => sum + c.trips.length, 0).toString()} 
          icon={<Car className="w-6 h-6 text-slate-700" />} 
        />
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Expense Overview</h3>
          </div>
          <div className="p-6 h-72 flex-1">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#F1F5F9'}} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`RM ${value}`, 'Amount']}
                  />
                  <Bar dataKey="amount" fill="#F97316" radius={[6, 6, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                No historical records available to display.
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Recent Activity</h3>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {relevantClaims.slice(0, 5).map((claim) => (
              <div key={claim.claim_id} className="flex items-center p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className={`w-2 h-2 rounded-full mr-3 ${
                  claim.claim_status === 'APPROVED' || claim.claim_status === 'PAID' ? 'bg-emerald-500' :
                  claim.claim_status === 'PENDING' ? 'bg-amber-500' : 'bg-slate-300'
                }`} />
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-[13px]">
                    {userRole === 'ACCOUNTANT' ? `${claim.staff.staff_fname} ${claim.staff.staff_lname}` : `Claim ID: ${claim.claim_id}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {format(parseISO(claim.claim_date), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div className="text-sm font-bold text-slate-800">
                  RM {claim.total_amount.toFixed(2)}
                </div>
              </div>
            ))}
            {relevantClaims.length === 0 && (
              <div className="text-center text-slate-400 text-xs py-8">
                No activity records found.
              </div>
            )}
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