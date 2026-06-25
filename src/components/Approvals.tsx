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
  X
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
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          aria-label={row.getIsExpanded() ? 'Collapse claim details' : 'Expand claim details'}
        >
          {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )
    },
    {
      accessorKey: 'claim_id',
      header: 'Claim',
      cell: ({ row, getValue }) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{String(getValue())}</div>
          <div className="text-[11px] text-slate-500">{row.original.trips.length} trip{row.original.trips.length === 1 ? '' : 's'}</div>
        </div>
      )
    },
    {
      id: 'staff',
      header: 'Staff',
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">
            {row.original.staff.staff_fname} {row.original.staff.staff_lname}
          </div>
          <div className="text-[11px] text-slate-500">{row.original.staff.staff_id}</div>
        </div>
      )
    },
    {
      id: 'department',
      header: 'Department / Position',
      cell: ({ row }) => (
        <div className="min-w-0 text-sm text-slate-700">
          <div className="font-medium text-slate-900">{row.original.staff.position}</div>
          <div className="text-[11px] text-slate-500">Department {row.original.staff.dept_id}</div>
        </div>
      )
    },
    {
      accessorKey: 'claim_date',
      header: 'Submitted',
      cell: ({ getValue }) => (
        <div className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
          <Calendar className="h-4 w-4 text-slate-400" />
          {format(parseISO(String(getValue())), 'MMM dd, yyyy')}
        </div>
      )
    },
    {
      id: 'distance',
      header: 'Distance',
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-sm text-slate-700">
          {row.original.trips.reduce((sum, trip) => sum + trip.distance, 0).toFixed(1)} km
        </div>
      )
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      cell: ({ getValue }) => (
        <div className="whitespace-nowrap font-semibold text-slate-900">
          RM {Number(getValue()).toFixed(2)}
        </div>
      )
    },
    {
      accessorKey: 'claim_status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = String(getValue());
        const statusClass =
          status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
          status === 'PAID' ? 'bg-blue-50 text-blue-700 border-blue-100' :
          status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
          status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-100' :
          'bg-slate-100 text-slate-600 border-slate-200';

        return (
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide ${statusClass}`}>
            {status}
          </span>
        );
      }
    },
    {
      id: 'approval_payment',
      header: 'Approval / Payment',
      cell: ({ row }) => {
        const approval = row.original.approval;
        const payment = row.original.payment;

        return (
          <div className="space-y-1 text-[11px] text-slate-600">
            {approval ? (
              <div>
                <span className="font-semibold text-slate-900">Approval:</span> {approval.approval_id} · {approval.approval_status} · {format(parseISO(approval.approval_date), 'MMM dd, yyyy')}
              </div>
            ) : (
              <div>No approval record yet</div>
            )}
            {payment ? (
              <div>
                <span className="font-semibold text-slate-900">Payment:</span> {payment.payment_id} · {payment.payment_method} · {format(parseISO(payment.payment_date), 'MMM dd, yyyy')}
              </div>
            ) : (
              <div>No payment record yet</div>
            )}
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: 'Actions',
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
                className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="mr-1.5 h-4 w-4" />
                {isBusy ? 'Rejecting' : 'Reject'}
              </button>
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => handleApprove(claim.claim_id)}
                className="inline-flex items-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className="mr-1.5 h-4 w-4" />
                {isBusy ? 'Approving' : 'Approve'}
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
                className="inline-flex items-center rounded-xl border border-indigo-200 px-3 py-2 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Wallet className="mr-1.5 h-4 w-4" />
                {isBusy ? 'Processing' : 'Process Payment'}
              </button>
            </div>
          );
        }

        return (
          <div className="flex justify-end">
            <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
              No action required
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-slate-900">Pending Approvals</h1>
          <p className="text-slate-500 mt-1">Review and manage staff mileage claims.</p>
        </div>
        <div className="relative w-full sm:w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
            placeholder="Search by claim, staff, department, status, approval, or payment..."
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full divide-y divide-slate-200" style={{ minWidth: 1380 }}>
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-white">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="text-[11px] uppercase tracking-wider text-slate-400">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white text-[13px]">
              {table.getRowModel().rows.map(row => (
                <Fragment key={row.id}>
                  <tr className="align-top transition-colors hover:bg-slate-50/70">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-4 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={row.getVisibleCells().length} className="px-4 pb-5 pt-0">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="grid gap-4 lg:grid-cols-3">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <BadgeInfo className="h-4 w-4" />
                                Claim Summary
                              </div>
                              <dl className="space-y-2 text-sm text-slate-700">
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Claim ID</dt>
                                  <dd className="font-semibold text-slate-900">{row.original.claim_id}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Submitted</dt>
                                  <dd className="font-semibold text-slate-900">{format(parseISO(row.original.claim_date), 'MMM dd, yyyy')}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Trips</dt>
                                  <dd className="font-semibold text-slate-900">{row.original.trips.length}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Distance</dt>
                                  <dd className="font-semibold text-slate-900">{row.original.trips.reduce((sum, trip) => sum + trip.distance, 0).toFixed(1)} km</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Amount</dt>
                                  <dd className="font-semibold text-slate-900">RM {row.original.total_amount.toFixed(2)}</dd>
                                </div>
                              </dl>
                            </div>

                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <FileSignature className="h-4 w-4" />
                                Staff Information
                              </div>
                              <dl className="space-y-2 text-sm text-slate-700">
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Name</dt>
                                  <dd className="font-semibold text-slate-900 text-right">{row.original.staff.staff_fname} {row.original.staff.staff_lname}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Staff ID</dt>
                                  <dd className="font-semibold text-slate-900">{row.original.staff.staff_id}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Department</dt>
                                  <dd className="font-semibold text-slate-900">{row.original.staff.dept_id}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Position</dt>
                                  <dd className="font-semibold text-slate-900 text-right">{row.original.staff.position}</dd>
                                </div>
                              </dl>
                            </div>

                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <Wallet className="h-4 w-4" />
                                Approval / Payment
                              </div>
                              <dl className="space-y-2 text-sm text-slate-700">
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Status</dt>
                                  <dd className="font-semibold text-slate-900">{row.original.claim_status}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Approval</dt>
                                  <dd className="font-semibold text-slate-900 text-right">
                                    {row.original.approval ? `${row.original.approval.approval_id} (${format(parseISO(row.original.approval.approval_date), 'MMM dd, yyyy')})` : 'Not recorded'}
                                  </dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <dt className="text-slate-500">Payment</dt>
                                  <dd className="font-semibold text-slate-900 text-right">
                                    {row.original.payment ? `${row.original.payment.payment_id} (${format(parseISO(row.original.payment.payment_date), 'MMM dd, yyyy')})` : 'Not recorded'}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          </div>

                          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                Trip breakdown
                              </div>
                              <div className="text-xs text-slate-500">Mileage, toll, and totals per trip</div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-400">
                                  <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Trip Date</th>
                                    <th className="px-4 py-3 text-left font-semibold">Route</th>
                                    <th className="px-4 py-3 text-left font-semibold">Distance</th>
                                    <th className="px-4 py-3 text-left font-semibold">Parking</th>
                                    <th className="px-4 py-3 text-left font-semibold">Toll</th>
                                    <th className="px-4 py-3 text-left font-semibold">Rate</th>
                                    <th className="px-4 py-3 text-left font-semibold">Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {row.original.trips.map(trip => (
                                    <tr key={trip.trip_id} className="align-top">
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{format(parseISO(trip.trip_date), 'MMM dd, yyyy')}</td>
                                      <td className="px-4 py-3 text-slate-700">
                                        <div className="font-medium text-slate-900">{trip.origin} <span className="mx-2 text-slate-300">→</span> {trip.destination}</div>
                                        <div className="text-[11px] text-slate-500">Trip ID {trip.trip_id}</div>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{trip.distance} km</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">RM {trip.parking_fee.toFixed(2)}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">RM {trip.toll_fee.toFixed(2)}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">RM {trip.mileage_rate.toFixed(2)}</td>
                                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">RM {trip.trip_amount.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}

              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16">
                    <div className="h-64 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                      No matching claims found.
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