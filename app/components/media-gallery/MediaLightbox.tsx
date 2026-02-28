import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { useVideoPlayer } from '~/hooks/useVideoPlayer';
import { useAuth } from '~/utils/auth';
import { PhotoTagManager } from '../photo-tagging/PhotoTagManager';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  fileName: string;
  thumbnailUrl?: string | null;
}

interface MediaLightboxProps {
  media: MediaItem;
  onClose: () => void;
  familyId?: string;
}

export default function MediaLightbox({ media, onClose, familyId }: MediaLightboxProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Use video player hook for videos
  const videoPlayer = useVideoPlayer(
    media.url,
    '', // userId will be available from auth context in real app
    media.id
  );

  // Handle keyboard close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRequestFullscreen = async () => {
    if (media.type === 'video' && videoPlayer.videoRef.current) {
      try {
        if (!document.fullscreenElement) {
          await videoPlayer.videoRef.current.requestFullscreen();
          setIsFullscreen(true);
        } else {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      } catch (err) {
        console.error('Fullscreen request failed:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition z-51"
      >
        <X size={32} />
      </button>

      {media.type === 'image' ? (
        // Image lightbox
        <div className="max-w-4xl max-h-[90vh] relative">
          <img
            src={media.url}
            alt={media.fileName}
            className="max-w-full max-h-[90vh] object-contain"
          />

          {/* Info footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 text-white">
            <p className="font-medium mb-2">{media.fileName}</p>
            <p className="text-sm text-gray-300 mb-3">{t('media.photos')}</p>
            
            {/* Photo tagging section */}
            {familyId && user && (
              <div className="bg-black/40 rounded p-3">
                <PhotoTagManager
                  mediaId={media.id}
                  familyId={familyId}
                  photoUrl={media.url}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        // Video lightbox
        <div className="max-w-5xl w-full">
          <div className="bg-black rounded-lg overflow-hidden shadow-2xl">
            {/* Video player */}
            <div className="relative aspect-video bg-black">
              <video
                ref={videoPlayer.videoRef}
                src={media.url}
                className="w-full h-full"
                crossOrigin="anonymous"
              />

              {/* Custom controls overlay */}
              <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-0 hover:opacity-100 transition group bg-gradient-to-b from-black/20 via-transparent to-black/50">
                {/* Top info */}
                <div className="text-white">
                  <p className="font-medium">{media.fileName}</p>
                </div>

                {/* Bottom controls */}
                <div className="flex items-center justify-between">
                  {/* Time display */}
                  <div className="text-white text-sm">
                    <span>{formatTime(videoPlayer.currentTime)}</span>
                    <span className="mx-1">/</span>
                    <span>{formatTime(videoPlayer.duration)}</span>
                  </div>

                  {/* Controls */}
                  <div className="flex gap-2">
                    {/* Mute button */}
                    <button
                      onClick={videoPlayer.toggleMute}
                      className="text-white hover:text-gray-300 transition p-2 hover:bg-white/20 rounded"
                    >
                      {videoPlayer.isMuted ? (
                        <VolumeX size={20} />
                      ) : (
                        <Volume2 size={20} />
                      )}
                    </button>

                    {/* Fullscreen button */}
                    <button
                      onClick={handleRequestFullscreen}
                      className="text-white hover:text-gray-300 transition p-2 hover:bg-white/20 rounded"
                    >
                      {isFullscreen ? (
                        <Minimize size={20} />
                      ) : (
                        <Maximize size={20} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600 cursor-pointer group-hover:h-2 transition"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    videoPlayer.setCurrentTime(percent * videoPlayer.duration);
                  }}
                >
                  <div
                    className="h-full bg-red-600 transition"
                    style={{
                      width: `${(videoPlayer.currentTime / videoPlayer.duration) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Play button overlay */}
              {!videoPlayer.isPlaying && (
                <button
                  onClick={() =>
                    videoPlayer.isPlaying
                      ? videoPlayer.pause()
                      : videoPlayer.play()
                  }
                  className="absolute inset-0 flex items-center justify-center group hover:bg-black/20 transition"
                >
                  <div className="bg-white/80 hover:bg-white rounded-full p-4 opacity-75 group-hover:opacity-100 transition">
                    <svg
                      className="w-12 h-12 text-blue-600 fill-current"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </button>
              )}

              {/* Loading indicator */}
              {videoPlayer.loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="animate-spin">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
                  </div>
                </div>
              )}

              {/* Error message */}
              {videoPlayer.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center text-white">
                    <p className="font-medium mb-4">
                      {t('media.errors.playbackError')}
                    </p>
                    <button
                      onClick={() => videoPlayer.loadLastPosition()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition"
                    >
                      {t('media.errors.retryPlayback')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info footer */}
            <div className="bg-slate-900 text-white p-4">
              <p className="font-medium mb-1">{media.fileName}</p>
              <div className="flex justify-between items-center text-sm text-gray-400">
                <span>{t('media.videoPlayback')}</span>
                {videoPlayer.lastPosition && (
                  <span>
                    {t('media.lastWatchedPosition')}:{' '}
                    {formatTime(videoPlayer.lastPosition)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format seconds to mm:ss format
 */
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
