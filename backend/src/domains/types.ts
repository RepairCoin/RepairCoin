export interface DomainEvent {
  type: string;
  aggregateId: string;
  data: any;
  timestamp: Date;
  source: string;
  version: number;
}

export interface DomainModule {
  name: string;
  initialize(): Promise<void>;
  routes: any;
  publicRoutes?: any; // Optional public routes that don't require auth
  cleanup?(): Promise<void>;
}