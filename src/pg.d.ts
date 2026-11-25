declare module '*.sql?raw' {
	const value: string;
	export default value;
}

declare module 'pg' {
	export interface QueryResult {
		rows: Record<string, unknown>[];
	}

	export class PoolClient {
		query(text: string, values?: unknown[]): Promise<QueryResult>;
		release(): void;
	}

	export class Pool {
		constructor(config: { connectionString: string });
		query(text: string, values?: unknown[]): Promise<QueryResult>;
		connect(): Promise<PoolClient>;
		end(): Promise<void>;
	}
}
