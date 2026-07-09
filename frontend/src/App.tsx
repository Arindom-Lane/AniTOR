import { useCallback, useEffect, useRef, useState } from 'react';

import { Header } from './components/Header/Header';
import { ModeSelector } from './components/ModeSelector/ModeSelector';
import { MagnetInputBar } from './components/MagnetInputBar/MagnetInputBar';
import { BrowserPlayer, BrowserPlayerHandle } from './components/BrowserPlayer/BrowserPlayer';
import { VlcPanel } from './components/VlcPanel/VlcPanel';
import { AnimeInfoPanel } from './components/AnimeInfoPanel/AnimeInfoPanel';
import { HistoryModal } from './components/HistoryModal/HistoryModal';
import { Footer } from './components/Footer/Footer';

import { useTheme } from './hooks/useTheme';
import { useStreamMode } from './hooks/useStreamMode';
import { useTorrentStats } from './hooks/useTorrentStats';
import { useAnimeInfo } from './hooks/useAnimeInfo';

import { torrentApi } from './api/torrentApi';
import { vlcApi } from './api/vlcApi';
import { StreamMode } from './types';

export default function App() {
  const { theme, setTheme } = useTheme();
  const { mode, selectMode } = useStreamMode();

  // The mode picker can be reopened later from the header badge even
  // after a mode has already been chosen — that's tracked separately
  // from the persisted `mode` value itself.
  const [overlayOpen, setOverlayOpen] = useState(mode === null);

  const [magnetLink, setMagnetLink] = useState('');
  const [streamTitle, setStreamTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [vlcMessage, setVlcMessage] = useState<string | null>(null);

  const playerRef = useRef<BrowserPlayerHandle>(null);

  const isStreaming = streamTitle !== null;
  const stats = useTorrentStats(isStreaming);
  const { info: animeInfo, status: animeStatus } = useAnimeInfo(streamTitle);

  // Tear down the torrent on the server whenever the tab is closed or
  // refreshed — this is what guarantees cached data never lingers
  // (requirement: delete cache on refresh / new magnet link).
  useEffect(() => {
    const handleUnload = () => {
      navigator.sendBeacon('/api/stop-stream');
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const handleSelectMode = useCallback(
    (next: StreamMode) => {
      selectMode(next);
      setOverlayOpen(false);
    },
    [selectMode],
  );

  const startStream = useCallback(
    async (magnet: string) => {
      if (!magnet.trim()) {
        alert('Paste a magnet link first');
        return;
      }

      setIsLoading(true);
      setStreamTitle(null);
      setVlcMessage(null);

      try {
        const { title } = await torrentApi.startStream(magnet);
        setStreamTitle(title);

        if (mode === 'vlc') {
          setVlcMessage('Opening VLC…');
          try {
            await vlcApi.open();
            setVlcMessage('Streaming in VLC ✓');
          } catch {
            setVlcMessage('Could not open VLC — is it installed?');
          }
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to start stream');
      } finally {
        setIsLoading(false);
      }
    },
    [mode],
  );

  const handleHistorySelect = useCallback(
    (magnet: string) => {
      setMagnetLink(magnet);
      setHistoryOpen(false);
      startStream(magnet);
    },
    [startStream],
  );

  // Pause the embedded player before handing off to VLC, so the two
  // never download/play the same torrent at the same time.
  const handleOpenVlcFromBrowser = useCallback(async () => {
    playerRef.current?.pause();
    try {
      await vlcApi.open();
    } catch {
      alert('Could not open VLC. Make sure it is installed.');
    }
  }, []);

  // First visit — no mode chosen yet, so force a choice before
  // showing the rest of the app.
  if (mode === null) {
    return <ModeSelector onSelect={handleSelectMode} />;
  }

  return (
    <>
      {overlayOpen && (
        <ModeSelector
          onSelect={handleSelectMode}
          dismissable
          onDismiss={() => setOverlayOpen(false)}
        />
      )}

      <Header
        mode={mode}
        theme={theme}
        onThemeChange={setTheme}
        onSwitchMode={() => setOverlayOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <main>
        <MagnetInputBar
          value={magnetLink}
          onChange={setMagnetLink}
          onSubmit={() => startStream(magnetLink)}
          isLoading={isLoading}
          mode={mode}
        />

        {mode === 'vlc' && !isStreaming && (
          <div className="vlc-mode-hint">
            <span className="vlc-hint-icon">🎬</span>
            <div>
              <strong>VLC Direct</strong> — streams open in VLC with multiple subtitle
              tracks, custom subtitle upload (.srt / .ass / .ssa), and dual audio switching.
            </div>
          </div>
        )}

        {isStreaming && (
          <div className="stream-layout">
            <div className="stream-main">
              {mode === 'browser' ? (
                <BrowserPlayer
                  ref={playerRef}
                  title={streamTitle!}
                  onOpenVlc={handleOpenVlcFromBrowser}
                />
              ) : (
                <VlcPanel title={streamTitle!} statusMessage={vlcMessage} />
              )}
            </div>

            <AnimeInfoPanel info={animeInfo} status={animeStatus} />
          </div>
        )}
      </main>

      <Footer stats={stats} visible={isStreaming} />

      {historyOpen && (
        <HistoryModal onClose={() => setHistoryOpen(false)} onSelect={handleHistorySelect} />
      )}
    </>
  );
}
