import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Activity, X, Download } from 'lucide-react';
import { ProcessorState, VoiceState, DisplayMode, DisplayContent } from '../../types';
import { JarvisArcReactor } from '../JarvisArcReactor';

interface DisplayAreaProps {
  processorState: ProcessorState;
  voiceState: VoiceState;
  displayMode: DisplayMode;
  displayContent: DisplayContent | null;
  onClearDisplay: () => void;
}

// Schematic Viewer Component
const SchematicViewer: React.FC<{ content: DisplayContent['schematic'] }> = ({ content }) => {
  if (!content) return null;

  let imageSrc = content.imageUrl || '';
  if (content.svgContent && !imageSrc) {
    const base64Svg = btoa(unescape(encodeURIComponent(content.svgContent)));
    imageSrc = `data:image/svg+xml;base64,${base64Svg}`;
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={content.title || 'Schematic'}
          className="max-w-full max-h-full object-contain"
          style={{ minWidth: '200px', minHeight: '200px' }}
        />
      ) : (
        <div className="text-cyan-700 text-sm">No schematic content available</div>
      )}
    </div>
  );
};

// Image Viewer Component
const ImageViewer: React.FC<{ content: DisplayContent['image'] }> = ({ content }) => {
  if (!content) return null;

  const fitClass = content.fit === 'cover' ? 'object-cover' :
                   content.fit === 'fill' ? 'object-fill' : 'object-contain';

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <img
        src={content.src}
        alt={content.alt || 'Display image'}
        className={`max-w-full max-h-full ${fitClass}`}
        style={{ minWidth: '200px', minHeight: '200px' }}
      />
    </div>
  );
};

// Web Viewer Component
const WebViewer: React.FC<{ content: DisplayContent['web'] }> = ({ content }) => {
  if (!content) return null;

  return (
    <div className="w-full h-full">
      <iframe
        src={content.url}
        title={content.title || 'Web content'}
        className="w-full h-full border-0"
        sandbox={content.sandbox ? 'allow-scripts allow-same-origin' : undefined}
      />
    </div>
  );
};

// Map Viewer Component
const MapViewer: React.FC<{ content: DisplayContent['map'] }> = ({ content }) => {
  if (!content) return null;

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a1628]">
      <div className="text-center">
        <div className="text-6xl mb-4">🗺️</div>
        <div className="text-cyan-500 font-mono text-sm">
          MAP VIEWER
        </div>
        {content.center && (
          <div className="text-cyan-700 text-xs mt-2">
            Center: {content.center[0].toFixed(4)}, {content.center[1].toFixed(4)}
          </div>
        )}
        {content.markers && content.markers.length > 0 && (
          <div className="text-cyan-700 text-xs mt-1">
            {content.markers.length} marker(s)
          </div>
        )}
        <div className="text-gray-600 text-[10px] mt-4">
          Map integration available for future enhancement
        </div>
      </div>
    </div>
  );
};

export const DisplayArea: React.FC<DisplayAreaProps> = ({
  processorState,
  voiceState,
  displayMode,
  displayContent,
  onClearDisplay
}) => {
  const isExecuting = processorState === ProcessorState.EXECUTING || processorState === ProcessorState.ANALYZING;
  const showingContent = displayMode !== 'NEURAL' && displayContent !== null;
  
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Initialize audio stream when voice is active
  useEffect(() => {
    const initAudio = async () => {
      // Create stream if we don't have one and we're in an active voice state
      const isActiveState = voiceState !== VoiceState.MUTED && voiceState !== VoiceState.ERROR;
      
      if (isActiveState && !streamRef.current) {
        try {
          console.log('[DisplayArea] Creating audio stream for state:', voiceState);
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          setAudioStream(stream);
        } catch (error) {
          console.error('[DisplayArea] Failed to get audio stream:', error);
        }
      } else if (!isActiveState && streamRef.current) {
        // Stop stream when going to MUTED/ERROR
        console.log('[DisplayArea] Stopping audio stream for state:', voiceState);
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setAudioStream(null);
      }
    };
    
    initAudio();
    
    return () => {
      // Only cleanup on unmount, not on state changes
    };
  }, [voiceState]);

  const renderContent = () => {
    const contentKey = displayContent 
      ? `${displayMode}-${displayContent.title || ''}-${JSON.stringify(displayContent).length}`
      : displayMode;
      
    switch (displayMode) {
      case 'SCHEMATIC':
        return <SchematicViewer key={contentKey} content={displayContent?.schematic} />;
      case 'IMAGE':
        return <ImageViewer key={contentKey} content={displayContent?.image} />;
      case 'WEB':
        return <WebViewer key={contentKey} content={displayContent?.web} />;
      case 'MAP':
        return <MapViewer key={contentKey} content={displayContent?.map} />;
      case 'CUSTOM':
        return displayContent?.custom?.component || null;
      case 'NEURAL':
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 relative border border-cyan-900/40 bg-transparent flex flex-col items-center justify-center overflow-hidden rounded-lg min-h-0">

      {/* Arc Reactor Visualization */}
      {!showingContent && (
        <div className="absolute inset-0 flex items-center justify-center z-0 overflow-visible">
          <JarvisArcReactor
            audioStream={audioStream}
            width={400}
            height={400}
            glowIntensity={voiceState === VoiceState.SPEAKING ? 1.6 : voiceState === VoiceState.LISTENING ? 1.4 : 1.2}
            rotationSpeed={voiceState === VoiceState.SPEAKING ? 1.5 : voiceState === VoiceState.LISTENING ? 1.2 : 1.0}
          />
        </div>
      )}

      {/* Processing Overlay -->
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          {isExecuting ? (
              <div className="text-center bg-black/40 p-8 rounded-2xl backdrop-blur-md border border-cyan-500/20 shadow-2xl z-30">
                  <Activity size={64} className="mx-auto text-cyan-400 animate-bounce mb-6" />
                  <div className="text-4xl font-bold text-white tracking-[0.5em] animate-pulse drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] uppercase">Processing</div>
              </div>
          ) : null}
      </div>

      {/* Main Content Area */}
      <div className="z-10 w-full h-full flex items-center justify-center relative">
        <Suspense fallback={
          <div className="flex items-center justify-center text-cyan-500/50 text-sm font-mono">
            Loading...
          </div>
        }>
          <div className="w-full h-full flex items-center justify-center">
            {renderContent()}
          </div>
        </Suspense>
      </div>

      {/* Content Title Overlay */}
      {showingContent && displayContent?.title && (
        <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded border border-cyan-900/30 z-20">
          <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider">{displayContent.title}</div>
          {displayContent.description && (
            <div className="text-[10px] text-cyan-700 mt-1">{displayContent.description}</div>
          )}
        </div>
      )}

      {/* Download Button */}
      {showingContent && (displayMode === 'IMAGE' || displayMode === 'SCHEMATIC') && displayContent && (
        <button
          onClick={() => {
            const src = displayContent.image?.src || displayContent.schematic?.imageUrl;
            const svgContent = displayContent.schematic?.svgContent;
            
            if (src) {
              const link = document.createElement('a');
              link.href = src;
              link.download = displayContent.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'download';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } else if (svgContent) {
              const blob = new Blob([svgContent], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${displayContent.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'image'}.svg`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }
          }}
          className="absolute top-4 right-14 p-2 bg-black/70 hover:bg-cyan-900/50 border border-cyan-900/30 hover:border-cyan-500/50 rounded transition-all group z-20"
          title="Download File"
        >
          <Download size={16} className="text-cyan-500 group-hover:text-cyan-300" />
        </button>
      )}

      {/* Close/Clear Button */}
      {showingContent && (
        <button
          onClick={onClearDisplay}
          className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-red-900/50 border border-cyan-900/30 hover:border-red-500/50 rounded transition-all group z-20"
          title="Return to Neural View"
        >
          <X size={16} className="text-cyan-500 group-hover:text-red-400" />
        </button>
      )}

      {/* Decorative Corners */}
      <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-cyan-600 rounded-tl-lg pointer-events-none z-10"></div>
      <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-cyan-600 rounded-tr-lg pointer-events-none z-10"></div>
      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-cyan-600 rounded-bl-lg pointer-events-none z-10"></div>
      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-cyan-600 rounded-br-lg pointer-events-none z-10"></div>

      {/* Mode Indicator */}
      {showingContent && (
        <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-1 rounded border border-cyan-900/30 z-20">
          <span className="text-[10px] text-cyan-600 font-mono uppercase tracking-wider">
            {displayMode} VIEW
          </span>
        </div>
      )}
    </div>
  );
};

export default DisplayArea;
