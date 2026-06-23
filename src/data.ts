import type { Accountant, Approval, Department, MileageClaim, Payment, Staff, Trip, TripPassenger, FullClaim } from './types';

export const DEPARTMENTS: Department[] = [
  { dept_id: 'D01', dept_name: 'IT Services' },
  { dept_id: 'D02', dept_name: 'Sales & Marketing' },
  { dept_id: 'D03', dept_name: 'Accounting & Finance' },
];

export const STAFF: Staff[] = [
  { staff_id: 'S001', staff_fname: 'Ahmad', staff_lname: 'Faizal', staff_phone: '012-3456789', staff_email: 'ahmad@slsoftware.com', position: 'Software Engineer', dept_id: 'D01' },
  { staff_id: 'S002', staff_fname: 'Sarah', staff_lname: 'Lee', staff_phone: '013-9876543', staff_email: 'sarah@slsoftware.com', position: 'Sales Executive', dept_id: 'D02' },
  { staff_id: 'S003', staff_fname: 'Muthu', staff_lname: 'Kumar', staff_phone: '019-8887766', staff_email: 'muthu@slsoftware.com', position: 'System Analyst', dept_id: 'D01' },
];

export const ACCOUNTANTS: Accountant[] = [
  { acc_id: 'A001', acc_name: 'Siti Nurhaliza', acc_email: 'siti@slsoftware.com', acc_phone: '011-22334455' }
];

export const CLAIMS: MileageClaim[] = [
  { claim_id: 'C1001', claim_date: '2023-10-31', claim_status: 'PAID', staff_id: 'S001' },
  { claim_id: 'C1002', claim_date: '2023-11-30', claim_status: 'APPROVED', staff_id: 'S002' },
  { claim_id: 'C1003', claim_date: '2023-11-30', claim_status: 'PENDING', staff_id: 'S001' },
  { claim_id: 'C1004', claim_date: '2023-12-05', claim_status: 'DRAFT', staff_id: 'S003' },
];

export const TRIPS: Trip[] = [
  { trip_id: 'T5001', trip_date: '2023-10-15', origin: 'HQ Office', destination: 'Client A Site', distance: 45.5, parking_fee: 10.00, toll_fee: 5.50, mileage_rate: 0.85, trip_amount: 54.18, claim_id: 'C1001' },
  { trip_id: 'T5002', trip_date: '2023-10-22', origin: 'Client A Site', destination: 'HQ Office', distance: 45.5, parking_fee: 0, toll_fee: 5.50, mileage_rate: 0.85, trip_amount: 44.18, claim_id: 'C1001' },
  { trip_id: 'T5003', trip_date: '2023-11-10', origin: 'HQ Office', destination: 'Convention Center', distance: 12.0, parking_fee: 15.00, toll_fee: 0, mileage_rate: 0.85, trip_amount: 25.20, claim_id: 'C1002' },
  { trip_id: 'T5004', trip_date: '2023-11-28', origin: 'HQ Office', destination: 'Client B Site', distance: 120.0, parking_fee: 0, toll_fee: 12.00, mileage_rate: 0.85, trip_amount: 114.00, claim_id: 'C1003' },
  { trip_id: 'T5005', trip_date: '2023-12-02', origin: 'HQ Office', destination: 'Branch Office', distance: 30.0, parking_fee: 5.00, toll_fee: 2.00, mileage_rate: 0.85, trip_amount: 32.50, claim_id: 'C1004' },
];

export const TRIP_PASSENGERS: TripPassenger[] = [
  { trip_id: 'T5004', staff_id: 'S003' } // Muthu rode with Ahmad to Client B
];

export const APPROVALS: Approval[] = [
  { approval_id: 'AP001', approval_date: '2023-11-02', approval_status: 'APPROVED', claim_id: 'C1001', acc_id: 'A001' },
  { approval_id: 'AP002', approval_date: '2023-12-02', approval_status: 'APPROVED', claim_id: 'C1002', acc_id: 'A001' },
];

export const PAYMENTS: Payment[] = [
  { payment_id: 'P9001', payment_date: '2023-11-05', payment_amount: 98.36, payment_method: 'Bank Transfer', approval_id: 'AP001' }
];

export function getFullClaims(): FullClaim[] {
  return CLAIMS.map(claim => {
    const claimTrips = TRIPS.filter(t => t.claim_id === claim.claim_id);
    const total_amount = claimTrips.reduce((sum, t) => sum + t.trip_amount, 0);
    const staff = STAFF.find(s => s.staff_id === claim.staff_id)!;
    const approval = APPROVALS.find(a => a.claim_id === claim.claim_id);
    const payment = approval ? PAYMENTS.find(p => p.approval_id === approval.approval_id) : undefined;
    
    return {
      ...claim,
      staff,
      trips: claimTrips,
      total_amount,
      approval,
      payment
    };
  });
}
