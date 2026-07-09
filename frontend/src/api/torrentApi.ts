import { httpClient } from './httpClient';
import { TorrentStats } from '../types';

/** Everything related to starting/controlling the torrent stream. */
export const torrentApi = {
  /** Add a magnet link and get back the resolved video title. */
  startStream: (magnetLink: string) =>
    httpClient.post<{ title: string }>('/api/stream', { magnetLink }),

  /** Halt downloading — called when the browser player is paused. */
  pauseDownload: () => httpClient.post<{ paused: boolean }>('/api/pause-download'),

  /** Resume downloading — called when the browser player plays again. */
  resumeDownload: () => httpClient.post<{ paused: boolean }>('/api/resume-download'),

  /** Fully tear down the torrent (page unload / new magnet link). */
  stopStream: () => httpClient.post<{ stopped: boolean }>('/api/stop-stream'),

  /** Poll live download stats. */
  getStats: () => httpClient.get<TorrentStats>('/api/stats'),

  /** Direct video source URL used by both the browser player and VLC. */
  videoStreamUrl: '/api/video-stream',
};
