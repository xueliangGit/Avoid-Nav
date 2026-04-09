import Dexie, { type Table } from 'dexie';

export interface RiskPoint {
  id?: number;
  lng: number;
  lat: number;
  type: string;
  risk: number;
}

export class AvoidNavDB extends Dexie {
  riskPoints!: Table<RiskPoint>;

  constructor() {
    super('AvoidNavDB');
    this.version(1).stores({
      riskPoints: '++id, lng, lat, type, risk'
    });
  }
}

export const db = new AvoidNavDB();
