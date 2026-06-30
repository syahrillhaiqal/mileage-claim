import React, { useState, useMemo } from 'react';
import type { FullClaim, Department, Staff } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
  PieChart, Pie
} from 'recharts';
import { format, parseISO, startOfDay, startOfWeek, startOfMonth, differenceInCalendarDays } from 'date-fns';
import { 
  Calendar, Search, ArrowUpDown, DollarSign, 
  TrendingUp, Users, Download, Clock,
  Building2, CheckCircle2, Timer
} from 'lucide-react';

interface ReportsProps {
  claims: FullClaim[];
  departments: Department[];
  allStaff: Staff[];
}

// Shared color mapping for claim statuses so charts, badges and legends always agree
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  APPROVED: '#10B981',
  PAID: '#3B82F6',
  REJECTED: '#F43F5E',
  DRAFT: '#94A3B8'
};
const STATUS_ORDER = ['PENDING', 'APPROVED', 'PAID', 'REJECTED', 'DRAFT'] as const;

export default function Reports({ claims, departments, allStaff }: ReportsProps) {
  // Only include processed records (PAID / APPROVED / REJECTED) for the trend chart and history table
  const historicalClaims = useMemo(() => {
    return claims.filter(c => c.claim_status === 'PAID' || c.claim_status === 'APPROVED' || c.claim_status === 'REJECTED');
  }, [claims]);

  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'claim_id' | 'claim_date' | 'total_amount' | 'staff_name'>('claim_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const currentDate = new Date();
  const currentMonthLabel = format(currentDate, 'MMMM yyyy');

  // --- SNAPSHOT KPIs (computed across ALL claims, every status) ---
  const kpis = useMemo(() => {
    const paidOnly = claims.filter(c => c.claim_status === 'PAID');
    const totalPayout = paidOnly.reduce((sum, c) => sum + c.total_amount, 0);
    const avgPayout = paidOnly.length > 0 ? totalPayout / paidOnly.length : 0;
    const pendingCount = claims.filter(c => c.claim_status === 'PENDING').length;
    const uniqueClaimants = new Set(claims.map(c => c.staff_id)).size;

    // This month's total claimed amount, across every status, so the figure is explicit about its period
    let currentMonthTotal = 0;
    claims.forEach(c => {
      try {
        if (format(parseISO(c.claim_date), 'MMM yy') === format(currentDate, 'MMM yy')) {
          currentMonthTotal += c.total_amount;
        }
      } catch {
        // ignore unparsable dates
      }
    });

    // Average number of days between a claim's submission date and its approval/rejection date
    const turnaroundSamples: number[] = [];
    claims.forEach(c => {
      if (c.approval?.approval_date && c.claim_date) {
        try {
          const days = differenceInCalendarDays(parseISO(c.approval.approval_date), parseISO(c.claim_date));
          if (days >= 0) turnaroundSamples.push(days);
        } catch {
          // ignore unparsable dates
        }
      }
    });
    const avgTurnaroundDays = turnaroundSamples.length > 0
      ? turnaroundSamples.reduce((a, b) => a + b, 0) / turnaroundSamples.length
      : null;

    return {
      totalPayout,
      avgPayout,
      pendingCount,
      uniqueClaimants,
      currentMonthTotal,
      avgTurnaroundDays,
      processedCount: historicalClaims.length
    };
  }, [claims, historicalClaims, currentDate]);

  // --- TREND CHART DATA (paid claims only, grouped by selected timeframe) ---
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

  // --- STATUS DISTRIBUTION (how many claims sit in each status, across the whole system) ---
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    claims.forEach(c => { counts[c.claim_status] = (counts[c.claim_status] || 0) + 1; });
    const total = claims.length;

    return STATUS_ORDER
      .filter(status => counts[status] > 0)
      .map(status => ({
        status,
        count: counts[status],
        percent: total > 0 ? (counts[status] / total) * 100 : 0,
        fill: STATUS_COLORS[status]
      }));
  }, [claims]);

  // --- DEPARTMENT BREAKDOWN (how many distinct staff claimed, per department) ---
  const departmentBreakdown = useMemo(() => {
    type DeptAgg = {
      deptName: string;
      staffIds: Set<string>;
      claimsCount: number;
      totalAmount: number;
      paidAmount: number;
      totalStaffInDept: number;
    };
    const deptMap: Record<string, DeptAgg> = {};

    departments.forEach(d => {
      deptMap[d.dept_id] = {
        deptName: d.dept_name,
        staffIds: new Set(),
        claimsCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        totalStaffInDept: allStaff.filter(s => s.dept_id === d.dept_id).length
      };
    });

    claims.forEach(c => {
      const deptId = c.staff.dept_id;
      if (!deptMap[deptId]) {
        deptMap[deptId] = {
          deptName: 'Unassigned',
          staffIds: new Set(),
          claimsCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          totalStaffInDept: 0
        };
      }
      deptMap[deptId].staffIds.add(c.staff_id);
      deptMap[deptId].claimsCount += 1;
      deptMap[deptId].totalAmount += c.total_amount;
      if (c.claim_status === 'PAID') {
        deptMap[deptId].paidAmount += c.total_amount;
      }
    });

    return Object.values(deptMap)
      .map(d => ({
        department: d.deptName,
        staffClaimed: d.staffIds.size,
        totalStaff: d.totalStaffInDept,
        claimsCount: d.claimsCount,
        totalAmount: parseFloat(d.totalAmount.toFixed(2)),
        paidAmount: parseFloat(d.paidAmount.toFixed(2))
      }))
      .filter(d => d.claimsCount > 0 || d.totalStaff > 0)
      .sort((a, b) => b.staffClaimed - a.staffClaimed);
  }, [claims, departments, allStaff]);

  // --- TOP CLAIMANTS (staff with the highest total claimed amount) ---
  const topClaimants = useMemo(() => {
    type StaffAgg = { name: string; department: string; totalAmount: number; claimsCount: number };
    const staffMap: Record<string, StaffAgg> = {};

    claims.forEach(c => {
      if (!staffMap[c.staff_id]) {
        const deptName = departments.find(d => d.dept_id === c.staff.dept_id)?.dept_name || 'Unassigned';
        staffMap[c.staff_id] = {
          name: `${c.staff.staff_fname} ${c.staff.staff_lname}`,
          department: deptName,
          totalAmount: 0,
          claimsCount: 0
        };
      }
      staffMap[c.staff_id].totalAmount += c.total_amount;
      staffMap[c.staff_id].claimsCount += 1;
    });

    return Object.values(staffMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
  }, [claims, departments]);

  // --- Sorting / Searching for the history table ---
  const handleSorting = (field: 'claim_id' | 'claim_date' | 'total_amount' | 'staff_name') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

  const statusBadgeClasses = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'PAID': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-8 text-[14px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports &amp; Analytics</h1>
          <p className="text-slate-500 mt-1">A complete overview of claim activity, spend, and trends across the company.</p>
        </div>
        {/* <button 
          onClick={handleExportCSV}
          className="flex items-center px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md font-bold text-xs transition-all cursor-pointer"
        >
          <Download className="w-4 h-4 mr-2" /> Export Processed Claims CSV
        </button> */}
      </div>

      {/* Snapshot KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 shrink-0">
        <KpiCard 
          title={`Claimed (${currentMonthLabel})`}
          value={`RM ${kpis.currentMonthTotal.toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5 text-orange-600" />}
        />
        <KpiCard 
          title="Pending Review"
          value={kpis.pendingCount.toString()}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
        />
        <KpiCard 
          title="Total Paid Out"
          value={`RM ${kpis.totalPayout.toFixed(2)}`}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
        <KpiCard 
          title="Active Staff"
          value={kpis.uniqueClaimants.toString()}
          icon={<Users className="w-5 h-5 text-slate-700" />}
        />
        <KpiCard 
          title="Avg Claim (Paid)"
          value={`RM ${kpis.avgPayout.toFixed(2)}`}
          icon={<TrendingUp className="w-5 h-5 text-red-600" />}
        />
        <KpiCard 
          title="Avg Approval Time"
          value={kpis.avgTurnaroundDays !== null ? `${kpis.avgTurnaroundDays.toFixed(1)}d` : 'N/A'}
          icon={<Timer className="w-5 h-5 text-blue-600" />}
        />
      </div>

      {/* Charts Row 1: Trend + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Claims Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Total amount paid out over time</p>
            </div>
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

        {/* Status Distribution */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-base">Claims by Status</h3>
            <p className="text-xs text-slate-400 mt-0.5">How many claims sit in each status, right now</p>
          </div>
          <div className="h-40">
            {statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={statusBreakdown} 
                    dataKey="count" 
                    nameKey="status" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {statusBreakdown.map((entry, index) => (
                      <Cell key={`status-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number, name: string) => [`${value} claims`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No claims recorded yet.
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {statusBreakdown.map((entry) => (
              <div key={entry.status} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <span className="font-semibold text-slate-600">{entry.status}</span>
                </div>
                <span className="text-slate-400 font-medium">{entry.count} ({entry.percent.toFixed(0)}%)</span>
              </div>
            ))}
            {statusBreakdown.length === 0 && (
              <p className="text-xs text-slate-400 text-center">No data available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Department Participation + Top Claimants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 text-base">Staff Claimed by Department</h3>
            <p className="text-xs text-slate-400 mt-0.5">Number of distinct staff who have submitted at least one claim, per department</p>
          </div>
          <div className="h-64">
            {departmentBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentBreakdown} layout="vertical" margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 11}} />
                  <YAxis dataKey="department" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 10}} width={90} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value} staff`, 'Staff Claimed']}
                  />
                  <Bar dataKey="staffClaimed" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {departmentBreakdown.map((entry, index) => (
                      <Cell key={`dept-cell-${index}`} fill={index % 2 === 0 ? '#F97316' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No departmental data available.
              </div>
            )}
          </div>
        </div>

        {/* Top Claimants */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-base">Top Claimants</h3>
            <p className="text-xs text-slate-400 mt-0.5">Staff with the highest total claimed amount</p>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto">
            {topClaimants.map((person, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{person.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{person.department} &middot; {person.claimsCount} claims</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-900 shrink-0 ml-2">RM {person.totalAmount.toFixed(2)}</span>
              </div>
            ))}
            {topClaimants.length === 0 && (
              <div className="text-center text-slate-400 text-xs py-8">No claim records available.</div>
            )}
          </div>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Department Breakdown</h3>
          <p className="text-xs text-slate-400 mt-0.5">Claim participation and spend by department</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-slate-400 text-[11px] uppercase tracking-wider">
                <th scope="col" className="px-6 py-3 text-left font-semibold">Department</th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">Staff Claimed</th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">Number of Claims</th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">Total Claimed</th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">Total Paid</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-[13px]">
              {departmentBreakdown.map((d, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <Building2 className="w-4 h-4 text-orange-500" /> {d.department}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {d.staffClaimed}{d.totalStaff > 0 ? ` of ${d.totalStaff}` : ''}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{d.claimsCount}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">RM {d.totalAmount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-emerald-600 font-semibold">RM {d.paidAmount.toFixed(2)}</td>
                </tr>
              ))}
              {departmentBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 font-medium">
                    No department data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Audit Table (Processed claims are always accessible here) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800">Claim History</h3>
            <p className="text-xs text-slate-400 mt-0.5">History of all processed (approved, rejected, or paid) claims</p>
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
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('claim_date')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Processing Date <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
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
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('total_amount')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Amount <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-[13px]">
              {sortedClaims.map((claim) => (
                <tr key={claim.claim_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    <div className="flex items-center text-xs">
                      <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
                      {format(parseISO(claim.claim_date), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                    {claim.claim_id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{claim.staff.staff_fname} {claim.staff.staff_lname}</div>
                    <div className="text-xs text-slate-400">{claim.staff.position}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-black text-slate-800">
                    RM {claim.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${statusBadgeClasses(claim.claim_status)}`}>
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

function KpiCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider truncate">{title}</p>
        <p className="text-lg font-black text-slate-900 mt-1 truncate">{value}</p>
      </div>
      <div className="p-2.5 bg-slate-50 rounded-lg shrink-0">
        {icon}
      </div>
    </div>
  );
}