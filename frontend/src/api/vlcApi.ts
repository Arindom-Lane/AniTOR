import { httpClient } from './httpClient';

export const vlcApi = {
  /** Ask the backend to launch VLC pointed at the current stream. */
  open: () => httpClient.post<{ opened: boolean }>('/api/open-vlc'),
};
