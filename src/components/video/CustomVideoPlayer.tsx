'use client';

import { useState, useCallback, useRef, useEffect, useId } from 'react';
import { CheckCircle, Circle, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import Button from '@/components/ui/Button';

interface CustomVideoPlayerProps {
  youtubeId: string;
  title?: string;
  completed?: boolean;
  onComplete?: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
    __ytApiLoaded?: boolean;
    __ytApiCallbacks?: (() => void)[];
  }
}

export default function CustomVideoPlayer({
  youtubeId,
  title,
  completed = false,
  onComplete,
}: CustomVideoPlayerProps) {
  const [isCompleted, setIsCompleted] = useState(completed);

  // Sync with prop when switching lessons
  useEffect(() => {
    setIsCompleted(completed);
  }, [completed, youtubeId]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const uniqueId = useId().replace(/:/g, '-');
  const playerId = `yt-player-${uniqueId}`;

  // Load YouTube IFrame API
  useEffect(() => {
    mountedRef.current = true;

    function initWhenReady() {
      if (!mountedRef.current) return;
      createPlayer();
    }

    if (window.YT && window.YT.Player) {
      initWhenReady();
    } else if (window.__ytApiLoaded) {
      // API script loaded but YT not ready yet — wait
      if (!window.__ytApiCallbacks) window.__ytApiCallbacks = [];
      window.__ytApiCallbacks.push(initWhenReady);
    } else {
      window.__ytApiLoaded = true;
      window.__ytApiCallbacks = [initWhenReady];

      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode?.insertBefore(tag, firstScript);

      window.onYouTubeIframeAPIReady = () => {
        window.__ytApiCallbacks?.forEach((cb) => cb());
        window.__ytApiCallbacks = [];
      };
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [youtubeId]);

  function createPlayer() {
    if (!mountedRef.current) return;
    // Clean up previous player
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }

    const el = document.getElementById(playerId);
    if (!el) return;

    playerRef.current = new window.YT.Player(playerId, {
      videoId: youtubeId,
      playerVars: {
        controls: 0,
        rel: 0,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        cc_load_policy: 0,
        playsinline: 1,
        vq: 'hd1080',
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  }

  function onPlayerReady(event: any) {
    if (!mountedRef.current) return;
    setPlayerReady(true);
    setDuration(event.target.getDuration());
    // Force max quality
    try { event.target.setPlaybackQuality('hd1080'); } catch {}
  }

  function onPlayerStateChange(event: any) {
    if (!mountedRef.current) return;
    const state = event.data;
    if (state === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      setHasStarted(true);
      if (!hasStarted) {
        setShowThumbnail(false);
      }
      startProgressTracking();
    } else if (state === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
      stopProgressTracking();
    } else if (state === window.YT.PlayerState.ENDED) {
      setIsPlaying(false);
      stopProgressTracking();
    }
  }

  function startProgressTracking() {
    stopProgressTracking();
    intervalRef.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        const ct = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        if (!mountedRef.current) return;
        setCurrentTime(ct);
        setDuration(dur);
        if (dur > 0) setProgress((ct / dur) * 100);
      }
    }, 500);
  }

  function stopProgressTracking() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    playerRef.current.seekTo(pct * duration, true);
  }, [duration]);

  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  const [needsRotation, setNeedsRotation] = useState(false);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (isIOS || !document.fullscreenEnabled) {
      if (isCssFullscreen) {
        // Exit fullscreen
        setIsCssFullscreen(false);
        setNeedsRotation(false);
      } else {
        // Enter fullscreen — check if we need to rotate
        const portrait = window.innerHeight > window.innerWidth;
        setNeedsRotation(portrait);
        setIsCssFullscreen(true);
      }
      return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, [isIOS, isCssFullscreen]);

  // Lock body scroll when CSS fullscreen
  useEffect(() => {
    if (isCssFullscreen) {
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
      try { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); } catch {}
    } else {
      document.body.style.overflow = '';
      try { (screen.orientation as any)?.unlock?.(); } catch {}
    }
    return () => { document.body.style.overflow = ''; };
  }, [isCssFullscreen]);

  const handleComplete = () => {
    setIsCompleted(true);
    onComplete?.();
  };

  const preventContext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Thumbnail URL from YouTube (max resolution)
  const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;

  return (
    <div className="space-y-4">
      {/* Video container */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden bg-black select-none group ${
          isCssFullscreen
            ? 'fixed z-[9999] rounded-none'
            : 'w-full aspect-video rounded-xl'
        }`}
        style={isCssFullscreen
          ? needsRotation
            ? { position: 'fixed' as const, top: 0, left: 0, width: '100dvh', height: '100vw', transform: 'rotate(90deg)', transformOrigin: 'top left', marginLeft: '100vw', zIndex: 9999 }
            : { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100dvh', zIndex: 9999 }
          : undefined
        }
        onContextMenu={preventContext}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* YouTube player */}
        <div
          id={playerId}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />

        {/* Full click-capture overlay — blocks ALL interaction with YouTube iframe */}
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={togglePlay}
        />

        {/* Custom thumbnail overlay — before first play */}
        {showThumbnail && (
          <div
            className="absolute inset-0 z-20 cursor-pointer bg-black"
            onClick={togglePlay}
          >
            <img
              src={thumbnailUrl}
              alt={title || 'Video'}
              className="absolute inset-0 w-full h-full object-cover opacity-80"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
              }}
            />
            <div className="absolute inset-0 bg-black/30" />
            {playerReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-jjl-red/90 flex items-center justify-center hover:bg-jjl-red hover:scale-110 transition-all shadow-lg shadow-black/50">
                  <Play className="h-8 w-8 text-white ml-1" fill="white" />
                </div>
              </div>
            )}
            {title && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
                <p className="text-white font-semibold text-sm">{title}</p>
              </div>
            )}
          </div>
        )}

        {/* Permanent top bar — covers YouTube title/channel branding naturally */}
        {hasStarted && title && (
          <div className={`absolute top-0 left-0 right-0 z-20 pointer-events-none transition-opacity duration-300 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pt-3 pb-8">
              <p className="text-white text-sm font-medium truncate">{title}</p>
            </div>
          </div>
        )}

        {/* Loading spinner — before API is ready */}
        {!playerReady && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
            <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Floating fullscreen button — always visible on mobile for easy tap */}
        {hasStarted && !isCssFullscreen && (
          <button
            onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
            className="absolute top-3 right-3 z-30 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center active:bg-black/80"
          >
            <Maximize className="h-5 w-5 text-white" />
          </button>
        )}

        {/* Close fullscreen button — visible in CSS fullscreen mode */}
        {isCssFullscreen && (
          <button
            onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
            className="absolute top-4 right-4 z-[10000] w-11 h-11 rounded-full bg-black/70 flex items-center justify-center active:bg-black/90"
          >
            <Minimize className="h-6 w-6 text-white" />
          </button>
        )}

        {/* Pause overlay — brief center icon */}
        {hasStarted && !isPlaying && (
          <div
            className="absolute inset-0 z-15 flex items-center justify-center bg-black/20 cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
              <Play className="h-7 w-7 text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}

        {/* Custom controls bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-8 transition-opacity duration-300 ${
            hasStarted && (showControls || !isPlaying) ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Progress bar */}
          <div
            className="w-full h-1 bg-white/20 rounded-full cursor-pointer mb-3 group/progress hover:h-1.5 transition-all"
            onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
          >
            <div
              className="h-full bg-jjl-red rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-jjl-red rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="text-white hover:text-jjl-red transition-colors"
              >
                {isPlaying ? <Pause className="h-5 w-5" fill="white" /> : <Play className="h-5 w-5" fill="white" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="text-white hover:text-jjl-red transition-colors"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <span className="text-xs text-white/70 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
              className="text-white hover:text-jjl-red transition-colors"
            >
              {isCssFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Title + Complete button */}
      <div className="flex items-center justify-between gap-4">
        {title && <h3 className="text-lg font-semibold truncate">{title}</h3>}
        <Button
          variant={isCompleted ? 'secondary' : 'primary'}
          size="sm"
          onClick={handleComplete}
          disabled={isCompleted}
          className="shrink-0"
        >
          {isCompleted ? (
            <>
              <CheckCircle className="h-4 w-4 mr-1.5 text-green-400" />
              Completada
            </>
          ) : (
            <>
              <Circle className="h-4 w-4 mr-1.5" />
              Marcar como completada
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
