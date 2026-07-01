import React, { useState, useMemo } from 'react';
import type { FullClaim, Approval, Payment } from '../types';
import { DatabaseService } from '../services/apexClient';
import { format, parseISO } from 'date-fns';
import { 
  CheckCircle2, XCircle, Search, Calendar, FileText, 
  ArrowUpDown, DollarSign, Wallet
} from 'lucide-react';

interface ApprovalsProps {
  claims: FullClaim[];
  currentAccId: string;
  onStatusChanged: () => void;
}

type StatusTabType = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export default function Approvals({ claims, currentAccId, onStatusChanged }: ApprovalsProps) {
  const [activeTab, setActiveTab] = useState<StatusTabType>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [sortField, setSortField] = useState<'claim_id' | 'claim_date' | 'total_amount' | 'staff_name'>('claim_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [selectedClaim, setSelectedClaim] = useState<FullClaim | null>(null);
  
  // Requirement #3: New states for isolated payment workflow
  const [paymentModalClaim, setPaymentModalClaim] = useState<FullClaim | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('BANK TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');

  const counts = useMemo(() => {
    return {
      ALL: claims.length,
      PENDING: claims.filter(c => c.claim_status === 'PENDING').length,
      APPROVED: claims.filter(c => c.claim_status === 'APPROVED').length,
      REJECTED: claims.filter(c => c.claim_status === 'REJECTED').length,
      PAID: claims.filter(c => c.claim_status === 'PAID').length,
    };
  }, [claims]);

  // Handle Approve/Reject strictly (No payments tied to it automatically)
  const handleAction = async (claimId: string, action: 'APPROVED' | 'REJECTED') => {
    setProcessingId(claimId);
    try {
      const approvalPayload: Approval = {
        approval_id: `APP-${Date.now().toString().slice(-6)}`,
        approval_date: format(new Date(), 'yyyy-MM-dd'),
        approval_status: action,
        claim_id: claimId,
        acc_id: currentAccId
      };
      
      await DatabaseService.createApproval(approvalPayload);
      await DatabaseService.updateClaimStatus(claimId, action);
      
      onStatusChanged();
      setSelectedClaim(null);
    } catch (err) {
      console.error(err);
      alert("Error processing the requested approval state update.");
    } finally {
      setProcessingId(null);
    }
  };

  // Requirement #3: Handle explicitly issuing a payment for an APPROVED claim
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalClaim || !paymentModalClaim.approval) return;

    setProcessingId(paymentModalClaim.claim_id);
    try {
      const paymentPayload: Payment = {
        payment_id: paymentRef || `PAY-${Date.now().toString().slice(-6)}`,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        payment_amount: paymentModalClaim.total_amount,
        payment_method: paymentMethod,
        approval_id: paymentModalClaim.approval.approval_id
      };

      await DatabaseService.createPayment(paymentPayload);
      await DatabaseService.updateClaimStatus(paymentModalClaim.claim_id, 'PAID');
      
      onStatusChanged();
      setPaymentModalClaim(null);
      setPaymentRef('');
      setSelectedClaim(null); // Ensure detail view closes if open
    } catch(err) {
      console.error(err);
      alert("Payment processing failed. Ensure database schemas map properly to this procedure.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSorting = (field: 'claim_id' | 'claim_date' | 'total_amount' | 'staff_name') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const statusFilteredClaims = useMemo(() => {
    if (activeTab === 'ALL') return claims;
    return claims.filter(c => c.claim_status === activeTab);
  }, [claims, activeTab]);

  const searchedClaims = useMemo(() => {
    return statusFilteredClaims.filter(c => {
      const fullName = `${c.staff.staff_fname} ${c.staff.staff_lname}`.toLowerCase();
      return (
        c.claim_id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullName.includes(searchTerm.toLowerCase()) ||
        c.total_amount.toString().includes(searchTerm)
      );
    });
  }, [statusFilteredClaims, searchTerm]);

  const sortedClaims = useMemo(() => {
    return [...searchedClaims].sort((a, b) => {
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
  }, [searchedClaims, sortField, sortDirection]);

  const tabs = [
    { id: 'ALL' as StatusTabType, label: 'All Logs' },
    { id: 'PENDING' as StatusTabType, label: 'Pending Review' },
    { id: 'APPROVED' as StatusTabType, label: 'Approved (Awaiting Pay)' },
    { id: 'REJECTED' as StatusTabType, label: 'Rejected' },
    { id: 'PAID' as StatusTabType, label: 'Paid Claim' },
  ];

  return (
    <div className="flex flex-col h-full space-y-6 text-[14px]">
      <div className="shrink-0">
        <h1 className="text-3xl font-bold text-slate-900">Approvals Control Center</h1>
        <p className="text-slate-500 mt-1">Audit, categorize, and approve employee travel claims.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px shrink-0">
        {tabs.map((tab) => {
          const tabCount = counts[tab.id];
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-all cursor-pointer ${
                isSelected 
                  ? 'border-orange-500 text-orange-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                isSelected ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {tabCount}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 sm:text-sm transition-all shadow-sm"
            placeholder="Search employee name or claim ID..."
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr className="text-slate-400 text-[11px] uppercase tracking-wider">
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('claim_date')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Submission Date <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('claim_id')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Claim ID <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('staff_name')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Employee Name <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('total_amount')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Total Amount <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                {activeTab === 'ALL' && (
                  <th scope="col" className="px-6 py-3 text-left font-semibold">Status</th>
                )}
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
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
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-500" />
                      {claim.claim_id}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs mr-2">
                        {claim.staff.staff_fname[0]}{claim.staff.staff_lname[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {claim.staff.staff_fname} {claim.staff.staff_lname}
                        </div>
                        <div className="text-xs text-slate-400 capitalize">{claim.staff.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                    RM {claim.total_amount.toFixed(2)}
                  </td>
                  {activeTab === 'ALL' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                        claim.claim_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        claim.claim_status === 'PAID' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        claim.claim_status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        claim.claim_status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {claim.claim_status}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedClaim(claim)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Inspect Logs
                      </button>
                      
                      {claim.claim_status === 'PENDING' ? (
                        <>
                          <button 
                            disabled={processingId !== null}
                            onClick={() => handleAction(claim.claim_id, 'APPROVED')}
                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Approve Claim"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button 
                            disabled={processingId !== null}
                            onClick={() => handleAction(claim.claim_id, 'REJECTED')}
                            className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Reject Claim"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : claim.claim_status === 'APPROVED' ? (
                        <button 
                          disabled={processingId !== null}
                          onClick={() => setPaymentModalClaim(claim)}
                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Issue Payment"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium italic px-2">Processed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedClaims.length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'ALL' ? 6 : 5} className="text-center py-12 text-slate-400 font-semibold">
                    No claims found in the selected tab category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Inspector Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Inspect Log Items</h2>
                <p className="text-xs text-slate-400 mt-0.5">Submitted by {selectedClaim.staff.staff_fname} {selectedClaim.staff.staff_lname}</p>
              </div>
              <span className={`px-3 py-1 text-[11px] font-bold rounded-full border ${
                selectedClaim.claim_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                selectedClaim.claim_status === 'PAID' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                selectedClaim.claim_status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                selectedClaim.claim_status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                'bg-slate-100 text-slate-600 border-slate-200'
              }`}>{selectedClaim.claim_status}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
              {selectedClaim.trips.map((trip, index) => (
                <div key={trip.trip_id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-[13px]">
                  <div className="flex justify-between font-semibold text-slate-800 mb-2">
                    <span>Trip Log #{index + 1}</span>
                    <span>RM {trip.trip_amount.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-500">
                    <div>Origin: <strong className="text-slate-700">{trip.origin}</strong></div>
                    <div>Destination: <strong className="text-slate-700">{trip.destination}</strong></div>
                    <div>Distance Travelled: <strong className="text-slate-700">{trip.distance} km</strong></div>
                    <div>Toll Fees: <strong className="text-slate-700">RM {trip.toll_fee.toFixed(2)}</strong></div>
                    <div>Parking Fees: <strong className="text-slate-700">RM {trip.parking_fee.toFixed(2)}</strong></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-sm mb-6 shrink-0">
              <span className="font-semibold text-slate-500">Proposed Payout Value:</span>
              <span className="text-2xl font-bold text-slate-900">RM {selectedClaim.total_amount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between shrink-0">
              <button 
                onClick={() => setSelectedClaim(null)} 
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors rounded-xl font-bold text-xs cursor-pointer"
              >
                Close Audit
              </button>
              
              {selectedClaim.claim_status === 'PENDING' ? (
                <div className="flex gap-2">
                  <button 
                    disabled={processingId !== null}
                    onClick={() => handleAction(selectedClaim.claim_id, 'REJECTED')}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" /> Reject Log
                  </button>
                  <button 
                    disabled={processingId !== null}
                    onClick={() => handleAction(selectedClaim.claim_id, 'APPROVED')}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-xs rounded-xl hover:opacity-90 shadow-md transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve Claim
                  </button>
                </div>
              ) : selectedClaim.claim_status === 'APPROVED' ? (
                 <button 
                    disabled={processingId !== null}
                    onClick={() => setPaymentModalClaim(selectedClaim)}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-xs rounded-xl hover:opacity-90 shadow-md transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Wallet className="w-4 h-4" /> Finalize Payment
                  </button>
              ) : (
                <div className="text-xs text-slate-400 font-semibold flex items-center italic">
                  Processed record (No actions pending)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Requirement #3: Dummy Payment Flow Modal */}
      {paymentModalClaim && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Wallet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Issue Payment</h3>
                <p className="text-xs text-slate-500">Ref: {paymentModalClaim.claim_id}</p>
              </div>
            </div>

            <form onSubmit={handleProcessPayment} className="space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Beneficiary:</span>
                  <span className="font-bold text-slate-900">{paymentModalClaim.staff.staff_fname} {paymentModalClaim.staff.staff_lname}</span>
                </div>
                <div className="flex justify-between text-xs mb-3">
                  <span className="text-slate-500">Approved Total:</span>
                  <span className="font-bold text-emerald-600">RM {paymentModalClaim.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs items-center border-t border-slate-200 pt-3 mt-3">
                  <span className="text-slate-500">Approval Ledger Ref:</span>
                  <span className="font-mono text-slate-700 bg-white px-2 py-0.5 border border-slate-200 rounded">{paymentModalClaim.approval?.approval_id}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Disbursement Method
                </label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition-all"
                >
                  <option value="BANK TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Company Cheque</option>
                  <option value="CASH">Cash </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Payment Reference (Optional)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm transition-all placeholder:text-slate-300"
                  placeholder="e.g. TRF-8392193"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={processingId !== null}
                  onClick={() => {
                    setPaymentModalClaim(null);
                    setPaymentRef('');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId !== null}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {processingId ? 'Processing...' : 'Disburse Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}