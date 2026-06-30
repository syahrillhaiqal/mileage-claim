import axios from 'axios';
import type {
  Accountant,
  Approval,
  Department,
  MileageClaim,
  Payment,
  Staff,
  Trip,
  TripPassenger
} from '../types';

interface OrdsResponse<T> {
  items: T[];
  hasMore?: boolean;
  limit?: number;
  offset?: number;
  count?: number;
}

const API = axios.create({
  baseURL: 'https://oracleapex.com/ords/2026112685/api/',
  headers: { 'Content-Type': 'application/json' }
});

export const DatabaseService = {
  // Read operations
  getAccountant: () => 
    API.get<OrdsResponse<Accountant>>('/accountant/').then(res => res.data.items),
    
  getApproval: () => 
    API.get<OrdsResponse<Approval>>('/approval/').then(res => res.data.items),
    
  getDepartment: () => 
    API.get<OrdsResponse<Department>>('/department/').then(res => res.data.items),
    
  getMileageClaim: () => 
    API.get<OrdsResponse<MileageClaim>>('/mileage_claim/').then(res => res.data.items),
    
  getPayment: () => 
    API.get<OrdsResponse<Payment>>('/payment/').then(res => res.data.items),
    
  getStaff: () => 
    API.get<OrdsResponse<Staff>>('/staff/').then(res => res.data.items),
    
  getTrip: () => 
    API.get<OrdsResponse<Trip>>('/trip/').then(res => res.data.items),
    
  getTripPassenger: () => 
    API.get<OrdsResponse<TripPassenger>>('/trip_passenger/').then(res => res.data.items),

  // Lookup queries with fallbacks
  getStaffByEmail: async (email: string): Promise<Staff | undefined> => {
    try {
      const res = await API.get<OrdsResponse<Staff>>(`/staff/?q={"staff_email":"${email}"}`);
      if (res.data?.items && res.data.items.length > 0) {
        return res.data.items[0];
      }
    } catch {
      // Fallback
    }
    const allStaff = await DatabaseService.getStaff();
    return allStaff.find(s => s.staff_email.toLowerCase() === email.toLowerCase());
  },

  getAccountantByEmail: async (email: string): Promise<Accountant | undefined> => {
    try {
      const res = await API.get<OrdsResponse<Accountant>>(`/accountant/?q={"acc_email":"${email}"}`);
      if (res.data?.items && res.data.items.length > 0) {
        return res.data.items[0];
      }
    } catch {
      // Fallback
    }
    const allAcc = await DatabaseService.getAccountant();
    return allAcc.find(a => a.acc_email.toLowerCase() === email.toLowerCase());
  },

  // Create operations
  createMileageClaim: (claim: MileageClaim) =>
    API.post('/mileage_claim/', claim).then(res => res.data),

  createTrip: (trip: Trip) =>
    API.post('/trip/', trip).then(res => res.data),

  createApproval: (approval: Approval) =>
    API.post('/approval/', approval).then(res => res.data),

  createPayment: (payment: Payment) =>
    API.post('/payment/', payment).then(res => res.data),

  // Update operations
  updateClaimStatus: (claimId: string, status: MileageClaim['claim_status']) =>
    API.put(`/mileage_claim/${claimId}`, { claim_status: status }).then(res => res.data),

  updateMileageClaim: (claimId: string, claim: Partial<MileageClaim>) =>
    API.put(`/mileage_claim/${claimId}`, claim).then(res => res.data),

  // Delete operations (Support for Enhancement #2)
  deleteMileageClaim: (claimId: string) =>
    API.delete(`/mileage_claim/${claimId}`).then(res => res.data),

  deleteTrip: (tripId: number) =>
    API.delete(`/trip/${tripId}`).then(res => res.data)
};