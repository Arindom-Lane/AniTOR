import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Artplayer from 'artplayer';
import { torrentApi } from '../../api/torrentApi';
import './BrowserPlayer.css';

export interface BrowserPlayerHandle {
  pause: () => void;
}

interface BrowserPlayerProps {
  title: string;
  onOpenVlc: () => void;
}

/**
 * Wraps ArtPlayer for in-browser playback.
 *
 * Pausing/playing the video tells the backend to halt/resume torrent
 * downloading — this is what stops AniTOR from silently downloading
 * in the background while the video sits paused. `pause()` is also
 * exposed via ref so the parent can stop this player before handing
 * off to VLC (see App.tsx's handleOpenVlcFromBrowser).
 */
export const BrowserPlayer = forwardRef<BrowserPlayerHandle, BrowserPlayerProps>(
  ({ title, onOpenVlc }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const artRef = useRef<Artplayer | null>(null);

    useImperativeHandle(ref, () => ({
      pause: () => artRef.current?.pause(),
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const art = new Artplayer({
        container: containerRef.current,
        url: torrentApi.videoStreamUrl,
        autoplay: true,
        pip: true,
        fullscreen: true,
        playbackRate: true,
        setting: true,
        aspectRatio: true,
      });

      // Halt downloading while paused — resumed again the moment the
      // /api/video-stream handler sees a new range request come in.
      art.on('pause', () => {
        torrentApi.pauseDownload().catch(() => {});
      });

      art.on('play', () => {
        torrentApi.resumeDownload().catch(() => {});
      });

      artRef.current = art;

      return () => {
        art.destroy(true);
        artRef.current = null;
      };
      // Re-create the player whenever a new stream starts (title changes).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title]);

    return (
      <>
        <div className="viewport-box">
          <div ref={containerRef} className="artplayer-app" />
        </div>

        <div className="status-panel">
          <div className="meta-details">
            <h3>{title}</h3>
            <p>Streaming active</p>
          </div>
          <button id="vlcBtn" onClick={onOpenVlc}>
            ▶ Open in VLC
          </button>
        </div>

        <div className="vlc-browser-hint">
          <span className="vlc-hint-icon">💡</span>
          <span>
            Click <strong>Open in VLC</strong> for <strong>multiple subtitle tracks</strong>,{' '}
            <strong>custom .srt / .ass / .ssa upload</strong>, and{' '}
            <strong>dual audio switching</strong> via <em>Audio → Audio Track</em>.
          </span>
        </div>
      </>
    );
  },
);

BrowserPlayer.displayName = 'BrowserPlayer';
