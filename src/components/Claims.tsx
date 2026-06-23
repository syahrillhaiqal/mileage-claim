import React, { useState } from 'react';
import type { FullClaim } from '../types';
import { format, parseISO } from 'date-fns';
import { Plus, Search, MapPin, Calendar, FileText } from 'lucide-react';

interface ClaimsProps {
  claims: FullClaim[];
}

export default function Claims({ claims }: ClaimsProps) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="flex flex-col h-full space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-slate-900">My Travel Logs</h1>
          <p className="text-slate-500 mt-1">Review and manage your expense logs.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 font-semibold hover:bg-indigo-700 transition-all w-fit"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Travel Log
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
            placeholder="Search claims..."
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white sticky top-0 z-10 border-b border-slate-100">
              <tr className="text-slate-400 text-[11px] uppercase tracking-wider">
                <th scope="col" className="px-6 py-3 text-left font-semibold">
                  Claim Details
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50 text-[13px]">
            {claims.map((claim) => (
              <tr key={claim.claim_id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="bg-indigo-50 p-2 rounded-lg mr-3 shadow-sm border border-indigo-100">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{claim.claim_id}</div>
                      <div className="text-sm text-slate-500">{claim.trips.length} Trips logged</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-slate-900 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                    {format(parseISO(claim.claim_date), 'MMM dd, yyyy')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                  ${claim.total_amount.toFixed(2)}
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
                  <button className="text-indigo-600 hover:underline font-semibold transition-colors">View Logs</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-8 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Create New Claim</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Claim Date</label>
                <input type="date" className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h3 className="text-sm font-medium text-slate-800 mb-3 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-indigo-600" /> Add Trip
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Origin</label>
                    <input type="text" placeholder="e.g. HQ Office" className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Destination</label>
                    <input type="text" placeholder="e.g. Client Site" className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Distance (km)</label>
                    <input type="number" className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Toll Fee</label>
                    <input type="number" className="w-full border border-slate-300 rounded-md shadow-sm px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white" />
                  </div>
                </div>
                <button className="mt-4 text-sm text-indigo-600 font-medium hover:text-indigo-800">
                  + Add another trip
                </button>
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button 
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
              >
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
