import React, { useState, useMemo } from 'react';
import type { FullClaim } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { format, parseISO, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { 
  Calendar, Search, ArrowUpDown, DollarSign, 
  TrendingUp, Users, ShieldCheck, Download 
} from 'lucide-react';

interface ReportsProps {
  claims: FullClaim[];
}

export default function Reports({ claims }: ReportsProps) {
  // Only include processed records (PAID / REJECTED)
  const historicalClaims = useMemo(() => {
    return claims.filter(c => c.claim_status === 'PAID' || c.claim_status === 'APPROVED' || c.claim_status === 'REJECTED');
  }, [claims]);

  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'claim_id' | 'claim_date' | 'total_amount' | 'staff_name'>('claim_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // --- STATS COMPUTATIONS ---
  const kpis = useMemo(() => {
    const paidOnly = historicalClaims.filter(c => c.claim_status === 'PAID');
    const totalPayout = paidOnly.reduce((sum, c) => sum + c.total_amount, 0);
    const avgPayout = paidOnly.length > 0 ? totalPayout / paidOnly.length : 0;
    const uniqueClaimants = new Set(historicalClaims.map(c => c.staff_id)).size;

    return {
      totalPayout,
      avgPayout,
      uniqueClaimants,
      processedCount: historicalClaims.length
    };
  }, [historicalClaims]);

  // --- CHART DATA GENERATION ---
  const trendChartData = useMemo(() => {
    const paidOnly = historicalClaims.filter(c => c.claim_status === 'PAID');
    const groups: Record<string, number> = {};

    paidOnly.forEach(claim => {
      try {
        const dateObj = parseISO(claim.claim_date);
        let key = '';
        if (timeframe === 'daily') {
          key = format(startOfDay(dateObj), 'yyyy-MM-dd');
        } else if (timeframe === 'weekly') {
          key = 'Wk ' + format(startOfWeek(dateObj), 'I-yyyy');
        } else {
          key = format(startOfMonth(dateObj), 'MMM yyyy');
        }
        groups[key] = (groups[key] || 0) + claim.total_amount;
      } catch {
        // Handle unexpected date formats safely
      }
    });

    return Object.entries(groups).map(([date, amount]) => ({
      date,
      amount: parseFloat(amount.toFixed(2))
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [historicalClaims, timeframe]);

  // Breakdown metrics by department
  const departmentChartData = useMemo(() => {
    const depts: Record<string, number> = {};
    historicalClaims.filter(c => c.claim_status === 'PAID').forEach(claim => {
      const deptName = claim.staff.position || 'Unknown';
      depts[deptName] = (depts[deptName] || 0) + claim.total_amount;
    });

    return Object.entries(depts).map(([department, total]) => ({
      department,
      total: parseFloat(total.toFixed(2))
    }));
  }, [historicalClaims]);

  // Sorting handlers
  const handleSorting = (field: 'claim_id' | 'claim_date' | 'total_amount' | 'staff_name') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Searching logic
  const filteredClaims = useMemo(() => {
    return historicalClaims.filter(c => {
      const fullName = `${c.staff.staff_fname} ${c.staff.staff_lname}`.toLowerCase();
      const status = c.claim_status.toLowerCase();
      return (
        c.claim_id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullName.includes(searchTerm.toLowerCase()) ||
        status.includes(searchTerm.toLowerCase())
      );
    });
  }, [historicalClaims, searchTerm]);

  // Sorting logic
  const sortedClaims = useMemo(() => {
    return [...filteredClaims].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'total_amount') {
        comparison = a.total_amount - b.total_amount;
      } else if (sortField === 'claim_date') {
        comparison = new Date(a.claim_date).getTime() - new Date(b.claim_date).getTime();
      } else if (sortField === 'staff_name') {
        const nameA = `${a.staff.staff_fname} ${a.staff.staff_lname}`;
        const nameB = `${b.staff.staff_fname} ${b.staff.staff_lname}`;
        comparison = nameA.localeCompare(nameB);
      } else {
        comparison = (a[sortField] || '').toString().localeCompare((b[sortField] || '').toString());
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredClaims, sortField, sortDirection]);

  // CSV report exporter
  const handleExportCSV = () => {
    const headers = 'Claim ID,Employee Name,Submission Date,Total Amount,Status\r\n';
    const rows = sortedClaims.map(c => 
      `"${c.claim_id}","${c.staff.staff_fname} ${c.staff.staff_lname}","${c.claim_date}",RM ${c.total_amount.toFixed(2)},"${c.claim_status}"`
    ).join('\r\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sl_mileage_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full space-y-8 text-[14px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-slate-500 mt-1">Review your overall claim amounts and payment history.</p>
        </div>
        {/* <button 
          onClick={handleExportCSV}
          className="flex items-center px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md font-bold text-xs transition-all cursor-pointer"
        >
          <Download className="w-4 h-4 mr-2" /> Export Report CSV
        </button> */}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase">Total Amount Paid</p>
            <p className="text-2xl font-black text-slate-900 mt-1">RM {kpis.totalPayout.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-xl">
            <DollarSign className="w-6 h-6 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase">Average Claim Amount</p>
            <p className="text-2xl font-black text-slate-900 mt-1">RM {kpis.avgPayout.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl">
            <TrendingUp className="w-6 h-6 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase">Processed Claims</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{kpis.processedCount} items</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-slate-700" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase">Active Staff</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{kpis.uniqueClaimants} staff</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <Users className="w-6 h-6 text-slate-700" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Claims Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">View total claims paid over time</p>
            </div>
            {/* Timeline Selector */}
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTimeframe(mode)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
                    timeframe === mode 
                      ? 'bg-white text-orange-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64">
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPayout" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 11}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`RM ${value}`, 'Total Paid']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#F97316" strokeWidth={3} fillOpacity={1} fill="url(#colorPayout)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No history records found for the trend analysis.
              </div>
            )}
          </div>
        </div>

        {/* Roles/Job Titles Breakdown */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 text-base">Claims by Job Title</h3>
            <p className="text-xs text-slate-400 mt-0.5">Total amount claimed based on staff positions</p>
          </div>
          <div className="h-64">
            {departmentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 11}} />
                  <YAxis dataKey="department" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 10}} width={80} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`RM ${value}`, 'Total Payout']}
                  />
                  <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {departmentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#F97316' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No positional data breakdown available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historical Audit Table (Paid claims are always accessible here) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800">Claim History</h3>
            <p className="text-xs text-slate-400 mt-0.5">History of all processed and paid claims</p>
          </div>
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm"
              placeholder="Search employee, reference, status..."
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-slate-400 text-[11px] uppercase tracking-wider">
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('claim_id')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Claim ID <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('staff_name')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Staff Member <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('claim_date')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Processing Date <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('total_amount')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Amount Paid <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-[13px]">
              {sortedClaims.map((claim) => (
                <tr key={claim.claim_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                    {claim.claim_id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{claim.staff.staff_fname} {claim.staff.staff_lname}</div>
                    <div className="text-xs text-slate-400">{claim.staff.position}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    <div className="flex items-center text-xs">
                      <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
                      {format(parseISO(claim.claim_date), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-slate-800">
                    RM {claim.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                      claim.claim_status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {claim.claim_status}
                    </span>
                  </td>
                </tr>
              ))}
              {sortedClaims.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 font-medium">
                    No historical records found for this query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}