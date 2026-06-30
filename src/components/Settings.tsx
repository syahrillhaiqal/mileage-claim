import React, { useState, useMemo } from 'react';
import type { FullClaim, Staff } from '../types';
import { format, parseISO } from 'date-fns';
import { 
  Sliders, ClipboardList, CheckCircle2, XCircle, DollarSign, 
  UserCheck, Calendar, FileText, Search, ArrowUpDown, ChevronLeft, ChevronRight, Settings as GearsIcon 
} from 'lucide-react';

interface SettingsProps {
  claims: FullClaim[];
  allStaff: Staff[];
  mileageRate: number;
  onMileageRateChange: (rate: number) => void;
}

interface AuditLogEntry {
  id: string;
  claimId: number; // Integer PK Reference
  date: string;
  accountantId: number; // Integer PK Reference
  action: 'APPROVED' | 'REJECTED' | 'PAYMENT_ISSUED';
  employeeName: string;
  amount: number;
  details: string;
}

type SortField = 'date' | 'accountantId' | 'action' | 'claimId' | 'employeeName' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function Settings({ claims, allStaff, mileageRate, onMileageRateChange }: SettingsProps) {
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [rateInput, setRateInput] = useState<string>(mileageRate.toString());
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Search, Sorting, and Pagination states for Audit Trail
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Compile historical activity log records using integer PKs
  const rawAuditLogs = useMemo(() => {
    const logs: AuditLogEntry[] = [];

    claims.forEach(c => {
      // 1. Audit logs for approvals/rejections
      if (c.approval) {
        logs.push({
          id: `${c.approval.approval_id}-status`,
          claimId: c.claim_id,
          date: c.approval.approval_date,
          accountantId: c.approval.acc_id,
          action: c.approval.approval_status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          employeeName: `${c.staff.staff_fname} ${c.staff.staff_lname}`,
          amount: c.total_amount,
          details: `Authorized status transition to [ ${c.approval.approval_status} ]`
        });
      }

      // 2. Audit logs for disbursements/payments
      if (c.payment && c.approval) {
        logs.push({
          id: `${c.payment.payment_id}-payment`,
          claimId: c.claim_id,
          date: c.payment.payment_date,
          accountantId: c.approval.acc_id,
          action: 'PAYMENT_ISSUED',
          employeeName: `${c.staff.staff_fname} ${c.staff.staff_lname}`,
          amount: c.payment.payment_amount,
          details: `Processed disbursement via [ ${c.payment.payment_method} ]`
        });
      }
    });

    return logs;
  }, [claims]);

  // Handle Mileage rate dialog submit
  const handleSaveMileageRate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedRate = parseFloat(rateInput);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      alert("Please specify a valid decimal value greater than 0.");
      return;
    }
    onMileageRateChange(parsedRate);
    setIsRateModalOpen(false);
    setFeedbackMsg("Mileage rate constants updated successfully.");
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Triggered when sort key is clicked on table header
  const handleSortRequest = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Filter, sort, and paginate computed logs
  const processedLogs = useMemo(() => {
    // 1. Search Filter
    const filtered = rawAuditLogs.filter(log => {
      const term = searchTerm.toLowerCase();
      return (
        log.claimId.toString().toLowerCase().includes(term) ||
        log.employeeName.toLowerCase().includes(term) ||
        log.accountantId.toString().toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.amount.toString().includes(term)
      );
    });

    // 2. Sorting Process
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'claimId') {
        comparison = a.claimId - b.claimId;
      } else if (sortField === 'accountantId') {
        comparison = a.accountantId - b.accountantId;
      } else if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        comparison = a[sortField].localeCompare(b[sortField]);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rawAuditLogs, searchTerm, sortField, sortDirection]);

  // 3. Paginated dataset calculation
  const totalPages = Math.ceil(processedLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedLogs.slice(startIndex, startIndex + pageSize);
  }, [processedLogs, currentPage, pageSize]);

  const actionBadge = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'PAYMENT_ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
            <DollarSign className="w-3.5 h-3.5" /> Paid Out
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col space-y-8 text-[14px]">
      {/* Title Header */}
      <div className="shrink-0">
        <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
        <p className="text-slate-500 mt-1">Calibrate core calculation metrics and inspect past administrative actions.</p>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-semibold p-4 rounded-xl flex items-center gap-2 shrink-0 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* SECTION 1: Mileage Parameters Card (Top of Vertical Stack) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 shrink-0">
            <Sliders className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Mileage Parameters</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Current mileage computation rate: <strong className="text-slate-700">RM {mileageRate.toFixed(2)} per km</strong>
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setRateInput(mileageRate.toString());
            setIsRateModalOpen(true);
          }}
          className="px-5 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 text-xs transition-all cursor-pointer"
        >
          Update Mileage Rate
        </button>
      </div>

      {/* SECTION 2: Accountant Audit Trail Table (Bottom of Vertical Stack - Expands Natural Height) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col">
        
        {/* Controls Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="font-bold text-slate-800 text-base">Accountant Audit Trail</h2>
              <p className="text-xs text-slate-400 mt-0.5">Detailed system event records logs</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search Box */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="block w-full sm:w-64 pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                placeholder="Search logs..."
              />
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Page size:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as 10 | 50 | 100);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value={10}>Show 10</option>
                <option value={50}>Show 50</option>
                <option value={100}>Show 100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Database Grid Wrapper (Adjusted to allow full vertical natural growth) */}
        <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th scope="col" className="px-6 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => handleSortRequest('date')}>
                  <div className="flex items-center gap-1">Action Date <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th scope="col" className="px-6 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => handleSortRequest('accountantId')}>
                  <div className="flex items-center gap-1">Accountant ID <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th scope="col" className="px-6 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => handleSortRequest('action')}>
                  <div className="flex items-center gap-1">Action State <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th scope="col" className="px-6 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => handleSortRequest('claimId')}>
                  <div className="flex items-center gap-1">Claim Ref <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th scope="col" className="px-6 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => handleSortRequest('employeeName')}>
                  <div className="flex items-center gap-1">Employee Name <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th scope="col" className="px-6 py-3 text-left cursor-pointer hover:text-slate-700" onClick={() => handleSortRequest('amount')}>
                  <div className="flex items-center gap-1">Disbursed Balance <ArrowUpDown className="w-3 h-3" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-[13px]">
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {format(parseISO(log.date), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-slate-400" />
                      {log.accountantId}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {actionBadge(log.action)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-400" />
                      {log.claimId}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">
                    {log.employeeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                    RM {log.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    No relevant historical events matched your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50 rounded-b-3xl text-xs font-semibold text-slate-500">
          <span>
            Showing {processedLogs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, processedLogs.length)} of {processedLogs.length} audit entries
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MILEAGE CONFIGURATION MODAL DIALOG */}
      {isRateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-100">
              <GearsIcon className="w-5 h-5 text-orange-500" />
              <h3 className="text-base font-bold text-slate-900">Adjust Mileage Parameters</h3>
            </div>

            <form onSubmit={handleSaveMileageRate} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  New Mileage Rate (per km)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-bold text-xs">RM</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="block w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 focus:outline-none font-bold text-slate-800 sm:text-sm"
                    placeholder="0.85"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 text-xs">/ km</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}