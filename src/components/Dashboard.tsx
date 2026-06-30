import React, { useMemo } from 'react';
import type { FullClaim } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Car, CheckCircle2, Clock, DollarSign, Plus, ArrowRight, ShieldAlert } from 'lucide-react';

interface DashboardProps {
  claims: FullClaim[];
  currentStaffName: string;
  onAddClaimClick: () => void;
  onViewClaim?: (claimId: string) => void;
}

interface NotificationLog {
  id: string;
  claimId: string;
  date: Date;
  message: string;
  status: FullClaim['claim_status'];
}

export default function Dashboard({ claims, currentStaffName, onAddClaimClick, onViewClaim }: DashboardProps) {
  const relevantClaims = claims;

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
  const currentMonthLabel = format(currentDate, 'MMMM yyyy');

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

  // Generate historical timeline logs with simplified message strings
  const notifications = useMemo(() => {
    const eventsList: NotificationLog[] = [];

    relevantClaims.forEach((c) => {
      // 1. Submission Event
      eventsList.push({
        id: `${c.claim_id}-submitted`,
        claimId: c.claim_id,
        date: parseISO(c.claim_date),
        message: `Your claim ${c.claim_id} has been submitted.`,
        status: 'PENDING'
      });

      // 2. Audit/Decision Event
      if (c.approval) {
        const isApproved = c.approval.approval_status === 'APPROVED';
        eventsList.push({
          id: `${c.claim_id}-reviewed`,
          claimId: c.claim_id,
          date: parseISO(c.approval.approval_date),
          message: isApproved 
            ? `Your claim ${c.claim_id} has been approved!`
            : `Your claim ${c.claim_id} has been rejected.`,
          status: isApproved ? 'APPROVED' : 'REJECTED'
        });
      }

      // 3. Payment Event
      if (c.payment) {
        eventsList.push({
          id: `${c.claim_id}-paid`,
          claimId: c.claim_id,
          date: parseISO(c.payment.payment_date),
          message: `Your claim ${c.claim_id} has been paid.`,
          status: 'PAID'
        });
      }
    });

    // Sort chronologically descending
    return eventsList
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }, [relevantClaims]);

  const statusBadgeClasses = (status: FullClaim['claim_status']) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'PAID':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'PENDING':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

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
        <button 
          onClick={onAddClaimClick}
          className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-md shadow-orange-500/25 flex items-center gap-2 transition-all w-fit cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Add Travel Log
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        <KpiCard 
          title={`Total Claimed (${currentMonthLabel})`} 
          value={`RM ${currentMonthTotal.toFixed(2)}`} 
          icon={<DollarSign className="w-6 h-6 text-orange-600" />} 
          trend={trendText}
          trendUp={isTrendUp}
        />
        <KpiCard 
          title="Pending Claims (All-Time)" 
          value={pendingCount.toString()} 
          icon={<Clock className="w-6 h-6 text-amber-600" />} 
        />
        <KpiCard 
          title="Approved Claims (All-Time)" 
          value={approvedCount.toString()} 
          icon={<CheckCircle2 className="w-6 h-6 text-red-600" />} 
        />
        <KpiCard 
          title="Total Trips (All-Time)" 
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

        {/* Dynamic Activity Feed with simplified wording */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Activity Logs</h3>
            <p className="text-xs text-slate-400 mt-0.5">Click any record to inspect status logs directly</p>
          </div>
          <div className="p-4 space-y-2 overflow-y-auto flex-1">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => onViewClaim?.(notif.claimId)}
                className="group flex flex-col p-3 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-xl transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border shrink-0 ${statusBadgeClasses(notif.status)}`}>
                    {notif.status}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {format(notif.date, 'MMM dd, h:mm a')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-semibold leading-relaxed group-hover:text-slate-900 transition-colors">
                  {notif.message}
                </p>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-orange-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Audit Logs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="text-center text-slate-400 text-xs py-12 flex flex-col items-center justify-center gap-2">
                <ShieldAlert className="w-8 h-8 text-slate-300" />
                <span>No logged events recorded.</span>
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