'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CheckCircle,
  Circle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Gauge,
} from 'lucide-react';
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

  // Reset state when switching lessons
  useEffect(() => {
    setIsCompleted(completed);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setPlayerReady(false);
    setHasStarted(false);
    setShowThumbnail(true);
    setShowControls(true);
    setPlaybackRate(1);
    setShowRateMenu(false);
    setPlayerError(null);
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
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showRateMenu, setShowRateMenu] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const SEEK_STEP_SECONDS = 10;
  const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

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
      // Clear any leftover children (iframe) from the stable mount node so
      // React never tries to removeChild on a node YT already replaced.
      if (mountRef.current) {
        while (mountRef.current.firstChild) {
          try { mountRef.current.removeChild(mountRef.current.firstChild); } catch { break; }
        }
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

    const mount = mountRef.current;
    if (!mount) return;

    // Clear any previous children (iframe from prior video).
    while (mount.firstChild) {
      try { mount.removeChild(mount.firstChild); } catch { break; }
    }

    // Create a fresh plain-DOM target for YT.Player. React never owns this
    // node, so when YT replaces it with an iframe there's no reconciliation
    // conflict and no removeChild errors on lesson switch.
    const target = document.createElement('div');
    const targetId = `yt-target-${Math.random().toString(36).slice(2)}`;
    target.id = targetId;
    target.style.width = '100%';
    target.style.height = '100%';
    mount.appendChild(target);

    playerRef.current = new window.YT.Player(targetId, {
      // Critical: explicit 100% so the iframe the API injects fills the
      // container. Without these, YT defaults to inline width=640 height=360
      // and certain layouts hide the visual while the audio keeps playing.
      width: '100%',
      height: '100%',
      videoId: youtubeId,
      playerVars: {
        controls: 0,
        rel: 0,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 1,
        cc_load_policy: 0,
        playsinline: 1,
        vq: 'hd1080',
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError,
      },
    });
  }

  function fitIframe(iframe: HTMLIFrameElement | null | undefined) {
    if (!iframe) return;
    iframe.setAttribute('allow', 'fullscreen; autoplay; encrypted-media; picture-in-picture');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('webkitallowfullscreen', 'true');
    iframe.setAttribute('width', '100%');
    iframe.setAttribute('height', '100%');
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
  }

  function onPlayerError(event: { data: number }) {
    if (!mountedRef.current) return;
    // YT error codes: 2 invalid param, 5 HTML5 player error, 100 not found,
    // 101 / 150 embedding disabled by owner.
    const code = event.data;
    const embedding = code === 101 || code === 150;
    setPlayerError(
      embedding
        ? 'El dueño de este video bloqueó su reproducción fuera de YouTube.'
        : code === 100
          ? 'Video no encontrado o eliminado.'
          : 'Error al cargar el video.'
    );
  }

  function onPlayerReady(event: any) {
    if (!mountedRef.current) return;
    setPlayerReady(true);
    setDuration(event.target.getDuration());
    try {
      fitIframe(event.target.getIframe() as HTMLIFrameElement | null);
    } catch {}
    try { event.target.setPlaybackQuality('hd1080'); } catch {}
  }

  function onPlayerStateChange(event: any) {
    if (!mountedRef.current) return;
    const state = event.data;
    if (state === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      setHasStarted(true);
      setShowThumbnail(false);
      // Re-apply iframe sizing defensively — some viewport changes or YT
      // internal state transitions reset the inline attributes.
      try { fitIframe(playerRef.current?.getIframe?.()); } catch {}
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

  const seekRelative = useCallback((delta: number) => {
    const p = playerRef.current;
    if (!p || typeof p.getCurrentTime !== 'function') return;
    const next = Math.max(0, Math.min(duration || Infinity, p.getCurrentTime() + delta));
    p.seekTo(next, true);
    setCurrentTime(next);
  }, [duration]);

  const changeRate = useCallback((rate: number) => {
    const p = playerRef.current;
    if (!p || typeof p.setPlaybackRate !== 'function') return;
    try {
      p.setPlaybackRate(rate);
      setPlaybackRate(rate);
    } catch {}
  }, []);

  // Keyboard shortcuts — arrow keys for seek, space for play/pause, J/L for
  // standard 10s skip, K for pause toggle. Only fires when the player is
  // on-screen (we listen at window level but ignore when the active element
  // is a text field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!playerReady) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        seekRelative(-SEEK_STEP_SECONDS);
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        seekRelative(SEEK_STEP_SECONDS);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playerReady, togglePlay, seekRelative]);

  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    // On iOS: try to get the iframe's video element for native fullscreen (rotates automatically)
    if (isIOS) {
      try {
        const iframe = containerRef.current.querySelector('iframe');
        if (iframe) {
          // Request fullscreen on the iframe itself — iOS Safari handles rotation
          const el = iframe as any;
          if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
            return;
          }
          if (el.requestFullscreen) {
            el.requestFullscreen();
            return;
          }
        }
      } catch {}
      // Fallback to CSS fullscreen
      setIsCssFullscreen((prev) => !prev);
      return;
    }

    if (!document.fullscreenEnabled) {
      setIsCssFullscreen((prev) => !prev);
      return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        try { (screen.orientation as any)?.unlock?.(); } catch {}
      }).catch(() => {});
    } else {
      containerRef.current.requestFullscreen().then(() => {
        // Lock to landscape AFTER entering fullscreen (required by Android)
        try { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); } catch {}
      }).catch(() => {});
    }
  }, [isIOS]);

  // Lock body scroll when CSS fullscreen
  useEffect(() => {
    if (isCssFullscreen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      window.scrollTo(0, 0);
      // Try to lock landscape on Android (iOS ignores this)
      try { (screen.orientation as any)?.lock?.('landscape').catch(() => {}); } catch {}
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      try { (screen.orientation as any)?.unlock?.(); } catch {}
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
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
          ? { position: 'fixed' as const, top: 0, left: 0, width: '100vw', height: '100dvh', zIndex: 9999, background: '#000' }
          : undefined
        }
        onContextMenu={preventContext}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/*
          YouTube player mount point.
          - Outer wrapper is React-controlled and stays stable.
          - Inner div is the target that YT.Player replaces with an iframe.
            We key it by youtubeId so React fully re-mounts it on lesson
            switch, preventing stale-DOM bugs that caused 'audio only'.
        */}
        <div
          ref={mountRef}
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
        {!playerReady && !playerError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
            <div className="w-8 h-8 border-2 border-jjl-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error overlay — video can't be loaded */}
        {playerError && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/95 px-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-3">
              <span className="text-red-400 text-2xl font-bold">!</span>
            </div>
            <p className="text-white text-sm font-semibold">{playerError}</p>
            <p className="text-jjl-muted text-xs mt-2">Avisale a tu instructor para que lo revise.</p>
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                className="text-white hover:text-jjl-red transition-colors"
              >
                {isPlaying ? <Pause className="h-5 w-5" fill="white" /> : <Play className="h-5 w-5" fill="white" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); seekRelative(-SEEK_STEP_SECONDS); }}
                aria-label="Retroceder 10 segundos"
                className="text-white hover:text-jjl-red transition-colors relative"
              >
                <RotateCcw className="h-5 w-5" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold tabular-nums">
                  10
                </span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); seekRelative(SEEK_STEP_SECONDS); }}
                aria-label="Adelantar 10 segundos"
                className="text-white hover:text-jjl-red transition-colors relative"
              >
                <RotateCw className="h-5 w-5" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold tabular-nums">
                  10
                </span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                aria-label={isMuted ? 'Activar audio' : 'Silenciar'}
                className="text-white hover:text-jjl-red transition-colors hidden sm:inline-flex"
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <span className="text-xs text-white/70 font-mono tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback rate */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRateMenu((v) => !v);
                  }}
                  aria-label="Velocidad"
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-[12px] font-bold tabular-nums transition-colors"
                >
                  <Gauge className="h-3.5 w-3.5" />
                  {playbackRate === 1 ? '1x' : `${playbackRate}x`}
                </button>
                {showRateMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRateMenu(false);
                      }}
                    />
                    <div className="absolute right-0 bottom-full mb-2 z-50 bg-black/95 border border-jjl-border rounded-lg py-1 shadow-2xl min-w-[88px]">
                      {RATES.map((r) => (
                        <button
                          key={r}
                          onClick={(e) => {
                            e.stopPropagation();
                            changeRate(r);
                            setShowRateMenu(false);
                          }}
                          className={`w-full px-3 py-1.5 text-left text-[12px] font-semibold tabular-nums transition-colors ${
                            playbackRate === r
                              ? 'text-jjl-red bg-jjl-red/10'
                              : 'text-white hover:bg-white/10'
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
                aria-label="Pantalla completa"
                className="text-white hover:text-jjl-red transition-colors"
              >
                {isCssFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            </div>
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
