import { httpClient } from './httpClient';
import { HistoryItem } from '../types';

export const historyApi = {
  getAll: () => httpClient.get<HistoryItem[]>('/api/history'),

  remove: (magnetLink: string) =>
    httpClient.delete<{ removed: boolean }>(
      `/api/history?magnetLink=${encodeURIComponent(magnetLink)}`,
    ),
};
