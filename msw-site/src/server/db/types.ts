export type Row = Record<string, unknown>;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Queryable {
  query<T = Row>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Driver extends Queryable {
  /** Execute a multi-statement SQL script (migrations). */
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
