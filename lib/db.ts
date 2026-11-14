import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

type SqlValue = string | number | boolean | null | Date | string[];

const globalForPool = globalThis as typeof globalThis & { pushkarDbPool?: Pool };

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Neon is not configured. Add DATABASE_URL to the server environment.");
  }
  globalForPool.pushkarDbPool ??= new Pool({ connectionString, max: 5 });
  return globalForPool.pushkarDbPool;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: SqlValue[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Neon transaction rollback failed.", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
