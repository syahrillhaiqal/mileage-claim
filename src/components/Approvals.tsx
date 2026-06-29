import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type FilterFn
} from '@tanstack/react-table';
import type { FullClaim, Approval, Payment } from '../types';
import { DatabaseService } from '../services/apexClient';
import { format, parseISO } from 'date-fns';
import {
  BadgeInfo,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  FileSignature,
  MapPin,
  Search,
  Wallet,
  X,
  CreditCard
} from 'lucide-react';

interface ApprovalsProps {
  claims: FullClaim[];
  currentAccId: string;
  onStatusChanged: () => void;
}

export default function Approvals({ claims, currentAccId, onStatusChanged }: ApprovalsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const handleApprove = useCallback(async (claimId: string) => {
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
      alert('Error approving claim. Check APEX ORDS connection path.');
    } finally {
      setProcessingId(null);
    }
  }, [currentAccId, onStatusChanged]);

  const handleReject = useCallback(async (claimId: string) => {
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
      alert('Error rejecting claim.');
    } finally {
      setProcessingId(null);
    }
  }, [currentAccId, onStatusChanged]);

  const handleProcessPayment = useCallback(async (claim: FullClaim) => {
    if (!claim.approval) {
      alert('Cannot process payment without an approval reference.');
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
      alert('Failed processing payment transaction.');
    } finally {
      setProcessingId(null);
    }
  }, [onStatusChanged]);

  const pendingClaims = useMemo(
    () => claims.filter(c => c.claim_status === 'PENDING' || c.claim_status === 'APPROVED'),
    [claims]
  );

  const globalFilterFn: FilterFn<FullClaim> = (row, _columnId, filterValue) => {
    const query = String(filterValue ?? '').trim().toLowerCase();

    if (!query) {
      return true;
    }

    const claim = row.original;
    const haystack = [
      claim.claim_id,
      claim.claim_status,
      claim.claim_date,
      claim.staff.staff_id,
      claim.staff.staff_fname,
      claim.staff.staff_lname,
      claim.staff.position,
      claim.staff.dept_id,
      claim.approval?.approval_id,
      claim.approval?.approval_status,
      claim.approval?.approval_date,
      claim.payment?.payment_id,
      claim.payment?.payment_method,
      claim.payment?.payment_date,
      ...claim.trips.flatMap(trip => [
        trip.trip_date,
        trip.origin,
        trip.destination,
        String(trip.distance),
        String(trip.parking_fee),
        String(trip.toll_fee),
        String(trip.trip_amount)
      ])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  };

  const columns = useMemo<ColumnDef<FullClaim>[]>(() => [
    {
      id: 'expand',
      header: () => null,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={row.getToggleExpandedHandler()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          aria-label={row.getIsExpanded() ? 'Collapse claim details' : 'Expand claim details'}
        >
          {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )
    },
    {
      id: 'claim_info',
      header: 'Claim Details',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[140px]">
          <span className="font-semibold text-slate-900">{row.original.claim_id}</span>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
            <Calendar className="h-3 w-3" />
            {format(parseISO(row.original.claim_date), 'MMM dd, yyyy')}
            <span className="text-slate-300">•</span>
            <span>{row.original.trips.length} trip{row.original.trips.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      )
    },
    {
      id: 'staff_info',
      header: 'Staff Member',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[180px]">
          <span className="font-semibold text-slate-900">
            {row.original.staff.staff_fname} {row.original.staff.staff_lname}
          </span>
          <span className="mt-0.5 text-[11px] text-slate-500">
            {row.original.staff.position} <span className="mx-1 text-slate-300">•</span> {row.original.staff.dept_id}
          </span>
        </div>
      )
    },
    {
      id: 'amount_info',
      header: 'Amount',
      cell: ({ row }) => {
        const totalDistance = row.original.trips.reduce((sum, trip) => sum + trip.distance, 0);
        return (
          <div className="flex flex-col min-w-[100px]">
            <span className="font-bold text-slate-900">
              RM {row.original.total_amount.toFixed(2)}
            </span>
            <span className="mt-0.5 text-[11px] text-slate-500 font-medium">
              {totalDistance.toFixed(1)} km total
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: 'claim_status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = String(getValue());
        const statusConfig = {
          APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm',
          PAID: 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm',
          PENDING: 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm',
          REJECTED: 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm',
          DEFAULT: 'bg-slate-50 text-slate-600 border-slate-200 shadow-sm'
        };
        const statusClass = statusConfig[status as keyof typeof statusConfig] || statusConfig.DEFAULT;

        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${statusClass}`}>
            {status}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const claim = row.original;
        const isBusy = processingId === claim.claim_id;

        if (claim.claim_status === 'PENDING') {
          return (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => handleReject(claim.claim_id)}
                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                {isBusy ? 'Wait' : 'Reject'}
              </button>
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => handleApprove(claim.claim_id)}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                {isBusy ? 'Wait' : 'Approve'}
              </button>
            </div>
          );
        }

        if (claim.claim_status === 'APPROVED') {
          return (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => handleProcessPayment(claim)}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                {isBusy ? 'Processing...' : 'Pay Claim'}
              </button>
            </div>
          );
        }

        return (
          <div className="flex justify-end">
            <span className="inline-flex items-center text-xs font-medium text-slate-400">
              Resolved
            </span>
          </div>
        );
      }
    }
  ], [handleApprove, handleProcessPayment, handleReject, processingId]);

  const table = useReactTable({
    data: pendingClaims,
    columns,
    state: {
      globalFilter: searchTerm,
      expanded
    },
    onGlobalFilterChange: setSearchTerm,
    onExpandedChange: setExpanded,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true
  });

  return (
    <div className="flex h-full min-h-0 flex-col space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pending Approvals</h1>
          <p className="text-slate-500 mt-1 text-sm">Review, approve, and process staff mileage claims.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            placeholder="Search claims, staff, or IDs..."
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          {/* Removed fixed minWidth to allow natural flexing */}
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200 shadow-sm">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {table.getRowModel().rows.map(row => (
                <Fragment key={row.id}>
                  {/* Main Row */}
                  <tr className={`align-middle transition-colors hover:bg-slate-50/80 ${row.getIsExpanded() ? 'bg-slate-50/50' : ''}`}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-5 py-3.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  
                  {/* Expanded Row */}
                  {row.getIsExpanded() && (
                    <tr>
                      <td colSpan={columns.length} className="px-0 py-0 border-b-2 border-slate-100">
                        <div className="bg-slate-50 px-5 py-6 inner-shadow-sm">
                          <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            
                            {/* Top Detail Cards */}
                            <div className="grid gap-4 lg:grid-cols-3 mb-6">
                              {/* Claim Summary */}
                              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                  <BadgeInfo className="h-4 w-4 text-indigo-500" />
                                  Claim Summary
                                </div>
                                <dl className="space-y-2.5 text-sm">
                                  <div className="flex justify-between">
                                    <dt className="text-slate-500">Claim ID</dt>
                                    <dd className="font-medium text-slate-900">{row.original.claim_id}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-slate-500">Submitted</dt>
                                    <dd className="font-medium text-slate-900">{format(parseISO(row.original.claim_date), 'MMM dd, yyyy')}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-slate-500">Total Distance</dt>
                                    <dd className="font-medium text-slate-900">{row.original.trips.reduce((sum, trip) => sum + trip.distance, 0).toFixed(1)} km</dd>
                                  </div>
                                  <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                                    <dt className="text-slate-600 font-medium">Total Amount</dt>
                                    <dd className="font-bold text-indigo-600">RM {row.original.total_amount.toFixed(2)}</dd>
                                  </div>
                                </dl>
                              </div>

                              {/* Staff Information */}
                              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                  <FileSignature className="h-4 w-4 text-emerald-500" />
                                  Staff Profile
                                </div>
                                <dl className="space-y-2.5 text-sm">
                                  <div className="flex justify-between">
                                    <dt className="text-slate-500">Name</dt>
                                    <dd className="font-medium text-slate-900">{row.original.staff.staff_fname} {row.original.staff.staff_lname}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-slate-500">Staff ID</dt>
                                    <dd className="font-medium text-slate-900">{row.original.staff.staff_id}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-slate-500">Department</dt>
                                    <dd className="font-medium text-slate-900">{row.original.staff.dept_id}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-slate-500">Position</dt>
                                    <dd className="font-medium text-slate-900">{row.original.staff.position}</dd>
                                  </div>
                                </dl>
                              </div>

                              {/* Approval & Payment */}
                              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                  <CreditCard className="h-4 w-4 text-amber-500" />
                                  Audit Trail
                                </div>
                                <dl className="space-y-3 text-sm">
                                  <div>
                                    <dt className="text-xs text-slate-400 mb-0.5">Approval Reference</dt>
                                    <dd className="font-medium text-slate-900">
                                      {row.original.approval 
                                        ? <span className="flex flex-col">
                                            <span>{row.original.approval.approval_id}</span>
                                            <span className="text-[11px] text-slate-500">{format(parseISO(row.original.approval.approval_date), 'MMM dd, yyyy')}</span>
                                          </span> 
                                        : <span className="text-slate-400 italic">Pending Approval</span>}
                                    </dd>
                                  </div>
                                  <div className="pt-2 border-t border-slate-100">
                                    <dt className="text-xs text-slate-400 mb-0.5">Payment Reference</dt>
                                    <dd className="font-medium text-slate-900">
                                      {row.original.payment 
                                        ? <span className="flex flex-col">
                                            <span>{row.original.payment.payment_id} ({row.original.payment.payment_method})</span>
                                            <span className="text-[11px] text-slate-500">{format(parseISO(row.original.payment.payment_date), 'MMM dd, yyyy')}</span>
                                          </span> 
                                        : <span className="text-slate-400 italic">Pending Disbursement</span>}
                                    </dd>
                                  </div>
                                </dl>
                              </div>
                            </div>

                            {/* Trip Table */}
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                  <MapPin className="h-4 w-4 text-slate-400" />
                                  Trip Breakdown
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                  <thead className="bg-white text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    <tr>
                                      <th className="px-4 py-3 text-left">Date</th>
                                      <th className="px-4 py-3 text-left">Route Details</th>
                                      <th className="px-4 py-3 text-right">Distance</th>
                                      <th className="px-4 py-3 text-right">Parking</th>
                                      <th className="px-4 py-3 text-right">Toll</th>
                                      <th className="px-4 py-3 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50 bg-white">
                                    {row.original.trips.map(trip => (
                                      <tr key={trip.trip_id} className="transition-colors hover:bg-slate-50/50">
                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                                          {format(parseISO(trip.trip_date), 'MMM dd')}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="font-medium text-slate-800 flex items-center gap-2">
                                            {trip.origin} <ChevronRight className="h-3 w-3 text-slate-300" /> {trip.destination}
                                          </div>
                                          <div className="text-[11px] text-slate-400 mt-0.5">ID: {trip.trip_id}</div>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{trip.distance} km</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">RM {trip.parking_fee.toFixed(2)}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">RM {trip.toll_fee.toFixed(2)}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-800">RM {trip.trip_amount.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}

              {/* Empty State */}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-20">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <Check className="h-8 w-8 text-slate-300" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">No pending approvals</h3>
                      <p className="mt-1 text-sm text-slate-500">You're all caught up! There are no claims matching your criteria.</p>
                    </div>
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