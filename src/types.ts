export interface Department {
  dept_id: string;
  dept_name: string;
}

export interface Staff {
  staff_id: string;
  staff_fname: string;
  staff_lname: string;
  staff_phone: string;
  staff_email: string;
  position: string;
  dept_id: string;
  staff_password?: string; // Stored as a hashed string in APEX
}

export interface Accountant {
  acc_id: string;
  acc_name: string;
  acc_email: string;
  acc_phone: string;
  acc_password?: string; // Stored as a hashed string in APEX
}

export interface MileageClaim {
  claim_id: string;
  claim_date: string;
  claim_status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  staff_id: string;
}

export interface Trip {
  trip_id: number;
  trip_date: string;
  origin: string;
  destination: string;
  distance: number;
  parking_fee: number;
  toll_fee: number;
  mileage_rate: number;
  trip_amount: number;
  claim_id: string;
}

export interface TripPassenger {
  trip_id: string;
  staff_id: string;
}

export interface Approval {
  approval_id: string;
  approval_date: string;
  approval_status: 'APPROVED' | 'REJECTED';
  claim_id: string;
  acc_id: string;
}

export interface Payment {
  payment_id: string;
  payment_date: string;
  payment_amount: number;
  payment_method: string;
  approval_id: string;
}

export interface FullClaim extends MileageClaim {
  staff: Staff;
  trips: Trip[];
  total_amount: number;
  approval?: Approval;
  payment?: Payment;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'STAFF' | 'ACCOUNTANT';
  positionOrTitle: string;
}