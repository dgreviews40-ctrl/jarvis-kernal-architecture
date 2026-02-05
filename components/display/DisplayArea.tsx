import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Activity, X, Download, Zap, Settings } from 'lucide-react';
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

// Arc Reactor Control Panel - Rendered outside reactor to ensure clicks work
const ArcReactorControls: React.FC<{
  reactorMode: 'classic' | 'cinematic' | 'authentic';
  setReactorMode: (m: 'classic' | 'cinematic' | 'authentic') => void;
  reactorColor: 'classic' | 'warm' | 'cyberpunk';
  setReactorColor: (c: 'classic' | 'warm' | 'cyberpunk') => void;
  reactorGlow: number;
  setReactorGlow: (g: number) => void;
  dynamicGlow: number;
}> = ({ reactorMode, setReactorMode, reactorColor, setReactorColor, reactorGlow, setReactorGlow, dynamicGlow }) => {
  const colorInfo = {
    classic: { name: 'Palladium', color: '#00ddff' },
    warm: { name: 'Plasma', color: '#ff8800' },
    cyberpunk: { name: 'Vibranium', color: '#ff00ff' }
  };

  return (
    <div
      className="relative p-5 rounded-2xl"
      style={{
        background: 'linear-gradient(180deg, rgba(10,20,40,0.98) 0%, rgba(5,10,20,0.99) 100%)',
        border: '2px solid rgba(0, 170, 255, 0.5)',
        boxShadow: '0 4px 30px rgba(0,0,0,0.6), 0 0 40px rgba(0, 170, 255, 0.3)',
        minWidth: '260px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold tracking-widest" style={{ color: colorInfo[reactorColor].color }}>
          ⚡ REACTOR CONFIG
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: colorInfo[reactorColor].color }}>
          {Math.round(dynamicGlow * 100)}%
        </span>
      </div>

      {/* Mode Buttons */}
      <div className="mb-4">
        <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Model</label>
        <div className="grid grid-cols-3 gap-2">
          {(['authentic', 'cinematic', 'classic'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setReactorMode(m); localStorage.setItem('jarvis.arcReactor.mode', m); }}
              className="py-2 rounded-lg text-[9px] font-bold uppercase transition-all"
              style={{
                background: reactorMode === m ? 'rgba(0,170,255,0.3)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${reactorMode === m ? '#00aaff' : 'rgba(255,255,255,0.1)'}`,
                color: reactorMode === m ? '#00aaff' : '#64748b',
                boxShadow: reactorMode === m ? '0 0 15px rgba(0,170,255,0.4)' : 'none',
              }}
            >
              {m === 'authentic' ? 'MARK I' : m === 'cinematic' ? 'CINEMA' : 'CLASSIC'}
            </button>
          ))}
        </div>
      </div>

      {/* Color Buttons */}
      <div className="mb-4">
        <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Element</label>
        <div className="flex gap-2">
          {(['classic', 'warm', 'cyberpunk'] as const).map((c) => (
            <button
              key={c}
              onClick={() => { setReactorColor(c); localStorage.setItem('jarvis.arcReactor.color', c); }}
              className="flex-1 py-2 rounded-lg transition-all"
              style={{
                background: reactorColor === c ? `${colorInfo[c].color}20` : 'rgba(255,255,255,0.05)',
                border: `2px solid ${reactorColor === c ? colorInfo[c].color : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ background: colorInfo[c].color }} />
                <span className="text-[8px] uppercase font-bold" style={{ color: reactorColor === c ? colorInfo[c].color : '#64748b' }}>
                  {colorInfo[c].name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Power Slider */}
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Power Output</label>
        <input
          type="range"
          min="0.3"
          max="2"
          step="0.1"
          value={reactorGlow}
          onChange={(e) => { setReactorGlow(parseFloat(e.target.value)); localStorage.setItem('jarvis.arcReactor.glow', e.target.value); }}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${colorInfo[reactorColor].color} 0%, ${colorInfo[reactorColor].color} ${((reactorGlow - 0.3) / 1.7) * 100}%, rgba(255,255,255,0.1) ${((reactorGlow - 0.3) / 1.7) * 100}%)`,
          }}
        />
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
  
  // Arc Reactor settings
  const [reactorMode, setReactorMode] = useState<'classic' | 'cinematic' | 'authentic'>(() => {
    const saved = localStorage.getItem('jarvis.arcReactor.mode');
    return (saved as 'classic' | 'cinematic' | 'authentic') || 'authentic';
  });
  const [showReactorControls, setShowReactorControls] = useState(false);
  
  // Determine if using enhanced reactor (cinematic or authentic modes)
  const enhancedReactor = reactorMode !== 'classic';
  
  // User-adjustable settings (saved to localStorage)
  const [reactorGlow, setReactorGlow] = useState(() => {
    const saved = localStorage.getItem('jarvis.arcReactor.glow');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [reactorColor, setReactorColor] = useState<'classic' | 'warm' | 'cyberpunk'>(() => {
    const saved = localStorage.getItem('jarvis.arcReactor.color');
    return (saved as 'classic' | 'warm' | 'cyberpunk') || 'classic';
  });
  
  // Dynamic glow based on voice state + user setting
  const dynamicGlow = voiceState === VoiceState.SPEAKING 
    ? reactorGlow * 1.3 
    : voiceState === VoiceState.LISTENING 
    ? reactorGlow * 1.15 
    : reactorGlow;
  
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
        <div className="absolute inset-0 flex items-center justify-center overflow-visible" style={{ zIndex: 1 }}>
          <JarvisArcReactor
            audioStream={audioStream}
            width={520}
            height={520}
            glowIntensity={dynamicGlow}
            mode={reactorMode}
            showControls={false} // Controls rendered separately at higher z-index
            colorMode={reactorColor}
            particleCount={150}
            onGlowChange={(value) => {
              setReactorGlow(value);
              localStorage.setItem('jarvis.arcReactor.glow', String(value));
            }}
            onColorChange={(mode) => {
              setReactorColor(mode);
              localStorage.setItem('jarvis.arcReactor.color', mode);
            }}
            onModeChange={(mode) => {
              setReactorMode(mode);
              localStorage.setItem('jarvis.arcReactor.mode', mode);
            }}
          />
        </div>
      )}
      
      {/* Arc Reactor Controls - Rendered OUTSIDE at high z-index */}
      {showReactorControls && !showingContent && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50">
          <ArcReactorControls
            reactorMode={reactorMode}
            setReactorMode={setReactorMode}
            reactorColor={reactorColor}
            setReactorColor={setReactorColor}
            reactorGlow={reactorGlow}
            setReactorGlow={setReactorGlow}
            dynamicGlow={dynamicGlow}
          />
        </div>
      )}
      
      {/* Arc Reactor Mode Toggle - Always Visible */}
      {!showingContent && (
        <div 
          className="absolute bottom-4 right-4 flex items-center gap-2"
          style={{ zIndex: 50 }}
        >
          {/* Settings Toggle Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('[DisplayArea] Toggling controls:', !showReactorControls);
              setShowReactorControls(!showReactorControls);
            }}
            className={`p-2 rounded-lg transition-all duration-300 ${showReactorControls ? 'bg-cyan-500/30 text-cyan-300' : 'bg-black/40 text-cyan-600 hover:text-cyan-400'}`}
            title="Toggle Reactor Controls"
            style={{ cursor: 'pointer' }}
          >
            <Settings size={16} />
          </button>
          
          {/* Mode Switcher Button - Cycles through modes */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const modes: ('authentic' | 'cinematic' | 'classic')[] = ['authentic', 'cinematic', 'classic'];
              const currentIndex = modes.indexOf(reactorMode);
              const nextMode = modes[(currentIndex + 1) % modes.length];
              console.log('[DisplayArea] Switching reactor mode to:', nextMode);
              setReactorMode(nextMode);
              localStorage.setItem('jarvis.arcReactor.mode', nextMode);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-300 bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,200,255,0.3)]"
            title="Click to cycle reactor modes"
            style={{ cursor: 'pointer' }}
          >
            <Zap size={14} className="animate-pulse" />
            <span>{reactorMode === 'authentic' ? 'MARK I' : reactorMode === 'cinematic' ? 'CINEMATIC' : 'CLASSIC'}</span>
          </button>
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
