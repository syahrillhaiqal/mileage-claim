import React, { useState } from 'react';
import type { FullClaim, Approval, Payment } from '../types';
import { DatabaseService } from '../services/apexClient';
import { format, parseISO } from 'date-fns';
import { Check, X, Search, FileSignature, DollarSign, Wallet } from 'lucide-react';

interface ApprovalsProps {
  claims: FullClaim[];
  currentAccId: string;
  onStatusChanged: () => void;
}

export default function Approvals({ claims, currentAccId, onStatusChanged }: ApprovalsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter to show claims needing action (PENDING or APPROVED)
  const pendingClaims = claims.filter(c => 
    (c.claim_status === 'PENDING' || c.claim_status === 'APPROVED') &&
    (c.staff.staff_fname.toLowerCase().includes(searchTerm.toLowerCase()) || 
     c.staff.staff_lname.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.claim_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleApprove = async (claimId: string) => {
    setProcessingId(claimId);
    try {
      const approvalId = 'AP' + Math.floor(1000 + Math.random() * 9000);
      const approvalDate = format(new Date(), 'yyyy-MM-dd');

      const approvalRecord: Approval = {
        approval_id: approvalId,
        approval_date: approvalDate,
        approval_status: 'APPROVED',
        claim_id: claimId,
        acc_id: currentAccId
      };

      await DatabaseService.createApproval(approvalRecord);
      await DatabaseService.updateClaimStatus(claimId, 'APPROVED');
      onStatusChanged();
    } catch (err) {
      console.error(err);
      alert("Error approving claim. Check APEX ORDS connection path.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (claimId: string) => {
    setProcessingId(claimId);
    try {
      const approvalId = 'AP' + Math.floor(1000 + Math.random() * 9000);
      const approvalDate = format(new Date(), 'yyyy-MM-dd');

      const approvalRecord: Approval = {
        approval_id: approvalId,
        approval_date: approvalDate,
        approval_status: 'REJECTED',
        claim_id: claimId,
        acc_id: currentAccId
      };

      await DatabaseService.createApproval(approvalRecord);
      await DatabaseService.updateClaimStatus(claimId, 'REJECTED');
      onStatusChanged();
    } catch (err) {
      console.error(err);
      alert("Error rejecting claim.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleProcessPayment = async (claim: FullClaim) => {
    if (!claim.approval) {
      alert("Cannot process payment without an approval reference.");
      return;
    }
    setProcessingId(claim.claim_id);
    try {
      const paymentId = 'P' + Math.floor(1000 + Math.random() * 9000);
      const paymentDate = format(new Date(), 'yyyy-MM-dd');

      const paymentRecord: Payment = {
        payment_id: paymentId,
        payment_date: paymentDate,
        payment_amount: claim.total_amount,
        payment_method: 'Bank Transfer',
        approval_id: claim.approval.approval_id
      };

      await DatabaseService.createPayment(paymentRecord);
      await DatabaseService.updateClaimStatus(claim.claim_id, 'PAID');
      onStatusChanged();
    } catch (err) {
      console.error(err);
      alert("Failed processing payment transaction.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-slate-900">Pending Approvals</h1>
          <p className="text-slate-500 mt-1">Review and manage staff mileage claims.</p>
        </div>
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
            placeholder="Search by staff name or ID..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 overflow-y-auto flex-1 pb-8 min-h-0">
        {pendingClaims.map(claim => (
          <div key={claim.claim_id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 shrink-0">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm">
              <div className="flex items-center space-x-4">
                <div className="bg-indigo-100 p-2.5 rounded-lg border border-indigo-200 shrink-0">
                  <FileSignature className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-slate-900">{claim.staff.staff_fname} {claim.staff.staff_lname}</h4>
                  <p className="text-slate-500">{claim.staff.position} • {claim.staff.dept_id}</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">RM {claim.total_amount.toFixed(2)}</div>
                <div className="text-slate-500 mt-1">Submitted {format(parseISO(claim.claim_date), 'MMM dd, yyyy')}</div>
              </div>
            </div>
            
            <div className="p-6">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Trip Details ({claim.trips.length})</h5>
              <div className="space-y-3">
                {claim.trips.map(trip => (
                  <div key={trip.trip_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-xl border border-slate-100 bg-white text-sm gap-2">
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-3 shrink-0"></div>
                      <span className="font-medium text-slate-700">{trip.origin} <span className="text-slate-400 mx-2">→</span> {trip.destination}</span>
                    </div>
                    <div className="flex text-slate-500 space-x-6 text-xs w-full sm:w-auto justify-between sm:justify-end">
                      <span>{trip.distance} km</span>
                      <span>Toll: RM {trip.toll_fee.toFixed(2)}</span>
                      <span className="font-semibold text-slate-700 pr-2">RM {trip.trip_amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {claim.claim_status === 'PENDING' && (
                <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-slate-100">
                  <button 
                    disabled={processingId !== null}
                    onClick={() => handleReject(claim.claim_id)}
                    className="flex items-center px-4 py-2 border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5 mr-1" />
                    Reject
                  </button>
                  <button 
                    disabled={processingId !== null}
                    onClick={() => handleApprove(claim.claim_id)}
                    className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Approve Claim
                  </button>
                </div>
              )}

              {claim.claim_status === 'APPROVED' && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm gap-4">
                  <div className="text-emerald-700 flex items-center bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 font-bold">
                    <Check className="w-5 h-5 mr-2" /> Approved
                  </div>
                  <button 
                    disabled={processingId !== null}
                    onClick={() => handleProcessPayment(claim)}
                    className="text-indigo-600 hover:text-indigo-800 font-bold px-5 py-2.5 border border-indigo-200 hover:bg-indigo-50/50 rounded-xl transition-colors flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <Wallet className="w-4 h-4" />
                    Process Payment
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {pendingClaims.length === 0 && (
          <div className="h-64 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
            No pending approvals found.
          </div>
        )}
      </div>
    </div>
  );
}