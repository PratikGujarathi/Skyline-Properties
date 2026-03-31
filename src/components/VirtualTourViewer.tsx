import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Maximize2, ExternalLink } from 'lucide-react';

interface VirtualTourViewerProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export const VirtualTourViewer: React.FC<VirtualTourViewerProps> = ({ isOpen, onClose, url, title }) => {
  if (!url) return null;

  // Helper to format URL for iframe if needed (e.g. YouTube embed)
  const getEmbedUrl = (originalUrl: string) => {
    try {
      const urlObj = new URL(originalUrl);
      
      // YouTube
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
      }
      
      // Vimeo
      if (urlObj.hostname.includes('vimeo.com')) {
        const videoId = urlObj.pathname.split('/').pop();
        return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
      }

      // Matterport
      if (urlObj.hostname.includes('matterport.com')) {
        if (!originalUrl.includes('embed')) {
          // Try to convert to embed URL if it's a standard link
          // Standard: https://my.matterport.com/show/?m=XXXXXXXXXXX
          // Embed: https://my.matterport.com/show/?m=XXXXXXXXXXX&play=1
          return originalUrl.includes('?') ? `${originalUrl}&play=1` : `${originalUrl}?play=1`;
        }
      }

      // Kuula
      if (urlObj.hostname.includes('kuula.co')) {
        if (!originalUrl.includes('embed')) {
          return originalUrl.replace('/post/', '/share/collection/');
        }
      }

      return originalUrl;
    } catch (e) {
      return originalUrl;
    }
  };

  const embedUrl = getEmbedUrl(url);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/95 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full h-full max-w-6xl bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-neutral-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold/20 rounded-lg">
                  <Maximize2 className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white truncate max-w-[200px] sm:max-w-md">{title}</h3>
                  <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider">Immersive Virtual Experience</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                <button
                  onClick={onClose}
                  className="p-2.5 bg-white/10 hover:bg-red-500/20 hover:text-red-500 text-white rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 relative bg-black">
              <iframe
                src={embedUrl}
                className="w-full h-full border-none"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; xr-spatial-tracking"
                title={title}
              />
              
              {/* Loading State Overlay */}
              <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 text-gold animate-spin" />
                <p className="text-neutral-500 text-sm font-medium animate-pulse">Initializing Virtual Environment...</p>
              </div>
            </div>

            {/* Footer / Controls Info */}
            <div className="p-4 bg-neutral-900/80 border-t border-white/10 text-center">
              <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-bold">
                Interact with the viewer to explore the property in 360°
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
