import { getHistoryDb } from '@/db';
import { listPublicSearches, type PublicHistory } from '@/lib/search-history';
import HistoryClient from './history-client';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  let initialData: PublicHistory | null = null;
  try {
    const db = getHistoryDb();
    if (db) initialData = await listPublicSearches(db, { query: '', cursor: undefined });
  } catch { /* The client retains the retryable error state if D1 is unavailable. */ }
  return <HistoryClient initialData={initialData}/>;
}
