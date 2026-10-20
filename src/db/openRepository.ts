import { openDatabaseAsync } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { Repository } from './Repository';
export async function openRepository(userId: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(userId)) throw new Error('Identidad local inválida');
  const db = await openDatabaseAsync(`apisense-${userId}.db`);
  const repository = new Repository({ exec: sql => db.execAsync(sql), run: (sql, params = []) => db.runAsync(sql, params), all: (sql, params = []) => db.getAllAsync(sql,params), close: () => db.closeAsync() }, randomUUID);
  await repository.initialize();
  return repository;
}
