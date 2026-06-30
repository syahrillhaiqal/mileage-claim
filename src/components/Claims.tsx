import React, { useState, useMemo } from 'react';
import type { FullClaim, MileageClaim, Trip } from '../types';
import { DatabaseService } from '../services/apexClient';
import { format, parseISO } from 'date-fns';
import { 
  Plus, Search, MapPin, Calendar, FileText, Trash2, 
  CheckCircle2, ArrowUpDown, Edit, ShieldAlert 
} from 'lucide-react';

interface ClaimsProps {
  claims: FullClaim[];
  currentStaffId: string;
  onClaimCreated: () => void;
}

interface PendingTripForm {
  trip_id?: number;
  origin: string;
  destination: string;
  distance: string;
  parking_fee: string;
  toll_fee: string;
  trip_date: string;
}

export default function Claims({ claims, currentStaffId, onClaimCreated }: ClaimsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingClaim, setEditingClaim] = useState<FullClaim | null>(null);
  const [claimDate, setClaimDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [trips, setTrips] = useState<PendingTripForm[]>([
    { origin: '', destination: '', distance: '', parking_fee: '', toll_fee: '', trip_date: format(new Date(), 'yyyy-MM-dd') }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting configurations
  const [sortField, setSortField] = useState<'claim_id' | 'claim_date' | 'total_amount' | 'claim_status'>('claim_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Warnings & Details
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [activeDetailsClaim, setActiveDetailsClaim] = useState<FullClaim | null>(null);

  const mileageRate = 0.85;

  // Safe date-formatting helper to convert Oracle timestamps to yyyy-MM-dd
  const safeDateFormat = (dateStr: string): string => {
    if (!dateStr) return format(new Date(), 'yyyy-MM-dd');
    try {
      // Handle potential timezone variants and extract local date string
      const parsed = parseISO(dateStr);
      return format(parsed, 'yyyy-MM-dd');
    } catch (err) {
      console.warn("Date parsing error on: ", dateStr, err);
      return dateStr.substring(0, 10); // Simple fallback substring extraction
    }
  };

  const handleAddTripFormLine = () => {
    setTrips([...trips, { origin: '', destination: '', distance: '', parking_fee: '', toll_fee: '', trip_date: claimDate }]);
  };

  const handleRemoveTripFormLine = (index: number) => {
    if (trips.length > 1) {
      setTrips(trips.filter((_, i) => i !== index));
    }
  };

  const handleTripInputChange = (index: number, field: keyof PendingTripForm, value: string) => {
    const updatedTrips = [...trips];
    updatedTrips[index] = {
      ...updatedTrips[index],
      [field]: value
    } as PendingTripForm;
    setTrips(updatedTrips);
  };

  const calculateTripAmount = (distance: number, parking: number, toll: number) => {
    return parseFloat(((distance * mileageRate) + parking + toll).toFixed(2));
  };

  const getClaimRoutes = (claim: FullClaim) => {
    if (!claim.trips || claim.trips.length === 0) return 'No trips logged';
    const firstTrip = claim.trips[0];
    const route = `${firstTrip.origin} ➔ ${firstTrip.destination}`;
    return claim.trips.length > 1 ? `${route} (+ ${claim.trips.length - 1} more)` : route;
  };

  const checkStatusAndProceed = (claim: FullClaim, action: 'EDIT' | 'DELETE') => {
    if (claim.claim_status !== 'PENDING') {
      setWarningMsg(`This claim is currently marked as [ ${claim.claim_status} ]. You can only edit or delete logs while they are pending review.`);
      return false;
    }
    return true;
  };

  // Pre-populates the edit modal correctly
  const handleEditInitiate = (claim: FullClaim) => {
    if (!checkStatusAndProceed(claim, 'EDIT')) return;
    setEditingClaim(claim);
    
    // Convert claim date to strict HTML5 format
    const formattedClaimDate = safeDateFormat(claim.claim_date);
    setClaimDate(formattedClaimDate);

    // Convert trip dates to strict HTML5 format
    setTrips(claim.trips.map(t => ({
      trip_id: t.trip_id,
      origin: t.origin,
      destination: t.destination,
      distance: t.distance.toString(),
      parking_fee: t.parking_fee.toString(),
      toll_fee: t.toll_fee.toString(),
      trip_date: safeDateFormat(t.trip_date || claim.claim_date)
    })));
    setIsCreating(true);
  };

  const handleDeleteInitiate = async (claim: FullClaim) => {
    if (!checkStatusAndProceed(claim, 'DELETE')) return;
    if (confirm(`Are you sure you want to delete claim reference ${claim.claim_id}? This operation cannot be undone.`)) {
      try {
        setIsSubmitting(true);
        for (const t of claim.trips) {
          await DatabaseService.deleteTrip(t.trip_id);
        }
        await DatabaseService.deleteMileageClaim(claim.claim_id);
        setSuccessMsg(`Mileage claim record ${claim.claim_id} was removed.`);
        onClaimCreated();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err) {
        console.error(err);
        alert("Failed to delete the selected record.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingClaim) {
        // --- EDIT WORKFLOW (Payload Preservation Fix) ---
        // We must include the existing claim_status and staff_id to prevent ORDS from overwriting them to NULL
        await DatabaseService.updateMileageClaim(editingClaim.claim_id, {
          claim_date: claimDate,
          claim_status: editingClaim.claim_status, // Preserves state
          staff_id: editingClaim.staff_id          // Preserves owner mapping
        });

        // Remove old trips
        for (const oldTrip of editingClaim.trips) {
          await DatabaseService.deleteTrip(oldTrip.trip_id);
        }

        // Add new trips
        for (let i = 0; i < trips.length; i++) {
          const t = trips[i];
          const distNum = parseFloat(t.distance) || 0;
          const parkNum = parseFloat(t.parking_fee) || 0;
          const tollNum = parseFloat(t.toll_fee) || 0;
          const amount = calculateTripAmount(distNum, parkNum, tollNum);

          const tripPayload = {
            trip_date: t.trip_date || claimDate,
            origin: t.origin,
            destination: t.destination,
            distance: distNum,
            parking_fee: parkNum,
            toll_fee: tollNum,
            mileage_rate: mileageRate,
            trip_amount: amount,
            claim_id: editingClaim.claim_id
          };
          await DatabaseService.createTrip(tripPayload as Trip);
        }
        setSuccessMsg(`Mileage claim ${editingClaim.claim_id} has been modified.`);
      } else {
        // --- CREATE WORKFLOW ---
        const claimPayload = {
          claim_date: claimDate,
          claim_status: 'PENDING',
          staff_id: currentStaffId
        };

        const createdClaim = await DatabaseService.createMileageClaim(claimPayload as MileageClaim);
        const realClaimId = createdClaim.claim_id; 

        if (!realClaimId) {
          throw new Error("Missing claim identification from database engine.");
        }

        for (let i = 0; i < trips.length; i++) {
          const t = trips[i];
          const distNum = parseFloat(t.distance) || 0;
          const parkNum = parseFloat(t.parking_fee) || 0;
          const tollNum = parseFloat(t.toll_fee) || 0;
          const amount = calculateTripAmount(distNum, parkNum, tollNum);

          const tripPayload = {
            trip_date: t.trip_date || claimDate,
            origin: t.origin,
            destination: t.destination,
            distance: distNum,
            parking_fee: parkNum,
            toll_fee: tollNum,
            mileage_rate: mileageRate,
            trip_amount: amount,
            claim_id: realClaimId
          };
          await DatabaseService.createTrip(tripPayload as Trip);
        }
        setSuccessMsg(`Mileage claim ${realClaimId} has been submitted successfully.`);
      }

      setIsCreating(false);
      setEditingClaim(null);
      setTrips([{ origin: '', destination: '', distance: '', parking_fee: '', toll_fee: '', trip_date: format(new Date(), 'yyyy-MM-dd') }]);
      onClaimCreated();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error(err);
      alert("Submission error. Please verify database schema and connectivity parameters.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSorting = (field: 'claim_id' | 'claim_date' | 'total_amount' | 'claim_status') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Functional Search filter logic
  const filteredClaims = claims.filter(c => {
    const routeSummary = getClaimRoutes(c).toLowerCase();
    const matchesSearch = 
      c.claim_id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.claim_status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      routeSummary.includes(searchTerm.toLowerCase()) ||
      format(parseISO(c.claim_date), 'MMM dd, yyyy').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Sorting process
  const sortedClaims = [...filteredClaims].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'total_amount') {
      comparison = a.total_amount - b.total_amount;
    } else if (sortField === 'claim_date') {
      comparison = new Date(a.claim_date).getTime() - new Date(b.claim_date).getTime();
    } else {
      comparison = (a[sortField] || '').toString().localeCompare((b[sortField] || '').toString());
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="flex flex-col h-full space-y-8 text-[14px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-slate-900">My Trip Logs</h1>
          <p className="text-slate-500 mt-1">Review and manage your expense claims.</p>
        </div>
        <button 
          onClick={() => {
            setEditingClaim(null);
            setTrips([{ origin: '', destination: '', distance: '', parking_fee: '', toll_fee: '', trip_date: format(new Date(), 'yyyy-MM-dd') }]);
            setClaimDate(format(new Date(), 'yyyy-MM-dd'));
            setIsCreating(true);
          }}
          className="flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all w-fit cursor-pointer"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Trip Log
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-emerald-800 text-sm flex items-center shadow-sm">
          <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Search Bar */}
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
            placeholder="Search claim ID, status or route details..."
          />
        </div>
      </div>

      {/* Main Claims Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
              <tr className="text-slate-400 text-[11px] uppercase tracking-wider">
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('claim_id')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Claim ID <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">Route Traveled</th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('claim_date')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Date <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('total_amount')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Amount <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold cursor-pointer" onClick={() => handleSorting('claim_status')}>
                  <div className="flex items-center gap-1 hover:text-slate-700">
                    Status <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-[13px]">
              {sortedClaims.map((claim) => (
                <tr key={claim.claim_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="bg-orange-50 p-2 rounded-lg mr-3 border border-orange-100">
                        <FileText className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{claim.claim_id}</div>
                        <div className="text-xs text-slate-500">{claim.trips.length} Trip line(s)</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium truncate max-w-xs">
                    {getClaimRoutes(claim)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-700 flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                      {format(parseISO(claim.claim_date), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                    RM {claim.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-[11px] font-bold rounded-full border ${
                      claim.claim_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      claim.claim_status === 'PAID' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      claim.claim_status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      claim.claim_status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {claim.claim_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => setActiveDetailsClaim(claim)}
                        className="text-orange-600 hover:underline font-bold cursor-pointer"
                      >
                        View Logs
                      </button>
                      <button 
                        onClick={() => handleEditInitiate(claim)}
                        className="text-slate-600 hover:text-orange-600 transition-colors p-1 cursor-pointer"
                        title="Edit Claim Draft"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteInitiate(claim)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                        title="Delete Claim Draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedClaims.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 font-medium">
                    No relevant claims matched your search terms.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claim Detail Modal */}
      {activeDetailsClaim && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-xl font-bold text-slate-900">Mileage Claim Details - {activeDetailsClaim.claim_id}</h2>
              <span className={`px-3 py-1 text-[11px] font-bold rounded-full border ${
                activeDetailsClaim.claim_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                activeDetailsClaim.claim_status === 'PAID' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                activeDetailsClaim.claim_status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                activeDetailsClaim.claim_status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                'bg-slate-100 text-slate-600 border-slate-200'
              }`}>{activeDetailsClaim.claim_status}</span>
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto mb-6 pr-2">
              {activeDetailsClaim.trips.map((trip, idx) => (
                <div key={trip.trip_id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-slate-700">
                  <div className="flex justify-between font-semibold text-slate-800 text-[13px] mb-2">
                    <span>Trip #{idx + 1}</span>
                    <span>RM {trip.trip_amount.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-500">
                    <div>Origin: <strong className="text-slate-700">{trip.origin}</strong></div>
                    <div>Destination: <strong className="text-slate-700">{trip.destination}</strong></div>
                    <div>Distance: <strong className="text-slate-700">{trip.distance} km</strong></div>
                    <div>Toll: <strong className="text-slate-700">RM {trip.toll_fee.toFixed(2)}</strong></div>
                    <div>Parking: <strong className="text-slate-700">RM {trip.parking_fee.toFixed(2)}</strong></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-sm mb-6">
              <span className="font-semibold text-slate-500">Grand Total Claim amount:</span>
              <span className="text-xl font-bold text-slate-800">RM {activeDetailsClaim.total_amount.toFixed(2)}</span>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => setActiveDetailsClaim(null)} 
                className="px-6 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors rounded-xl font-bold text-sm cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restrictive Warning Modal */}
      {warningMsg && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 text-center">
            <ShieldAlert className="w-14 h-14 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Action Restricted</h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              {warningMsg}
            </p>
            <button 
              onClick={() => setWarningMsg(null)}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl text-sm hover:opacity-90 cursor-pointer"
            >
              Understand
            </button>
          </div>
        </div>
      )}

      {/* Creation & Editing Modal Form */}
      {isCreating && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl max-w-3xl w-full p-8 max-h-[90vh] flex flex-col my-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 shrink-0">
              {editingClaim ? `Edit Mileage Claim - Reference ${editingClaim.claim_id}` : 'Create New Claim'}
            </h2>
            
            <form onSubmit={handleSubmitClaim} className="flex-1 flex flex-col min-h-0">
              <div className="overflow-y-auto flex-1 pr-2 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Claim Submission Date</label>
                  <input 
                    type="date" 
                    value={claimDate}
                    onChange={(e) => setClaimDate(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 focus:outline-none" 
                  />
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-orange-600" /> Trips ({trips.length})
                  </h3>

                  {trips.map((trip, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 relative">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Trip Line Item #{idx + 1}</span>
                        {trips.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => handleRemoveTripFormLine(idx)}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1">Date</label>
                          <input 
                            type="date"
                            required
                            value={trip.trip_date}
                            onChange={(e) => handleTripInputChange(idx, 'trip_date', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Origin</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. HQ Office" 
                            value={trip.origin}
                            onChange={(e) => handleTripInputChange(idx, 'origin', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Destination</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. Client Site" 
                            value={trip.destination}
                            onChange={(e) => handleTripInputChange(idx, 'destination', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Distance (km)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            required
                            placeholder="0"
                            value={trip.distance}
                            onChange={(e) => handleTripInputChange(idx, 'distance', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Toll Fee (RM)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00"
                            value={trip.toll_fee}
                            onChange={(e) => handleTripInputChange(idx, 'toll_fee', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Parking Fee (RM)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00"
                            value={trip.parking_fee}
                            onChange={(e) => handleTripInputChange(idx, 'parking_fee', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" 
                          />
                        </div>
                      </div>
                      <div className="mt-3 text-right text-xs font-semibold text-slate-600">
                        Line total: RM {calculateTripAmount(parseFloat(trip.distance) || 0, parseFloat(trip.parking_fee) || 0, parseFloat(trip.toll_fee) || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}

                  <button 
                    type="button"
                    onClick={handleAddTripFormLine}
                    className="text-xs text-orange-600 font-bold hover:text-orange-800 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add another trip line item
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex justify-end space-x-3 shrink-0 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setIsCreating(false);
                    setEditingClaim(null);
                  }}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl text-sm font-bold hover:opacity-95 shadow-md shadow-orange-500/20 transition-all flex items-center cursor-pointer"
                >
                  {isSubmitting ? 'Processing request...' : editingClaim ? 'Modify Claim Log' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}