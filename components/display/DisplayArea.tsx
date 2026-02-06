import React, { Suspense, useEffect, useRef, useState } from 'react';
import { X, Download, Settings, Brain } from 'lucide-react';
import { ProcessorState, VoiceState, DisplayMode, DisplayContent } from '../../types';
import { JarvisNeuralNetwork } from '../JarvisNeuralNetwork';

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

// Neural Network Control Panel
const NeuralNetworkControls: React.FC<{
  nodeSize: number;
  setNodeSize: (s: number) => void;
  brightness: number;
  setBrightness: (b: number) => void;
  rotationSpeed: number;
  setRotationSpeed: (s: number) => void;
  cpuLoad: number;
  gpuLoad: number;
  voiceState: VoiceState;
}> = ({ nodeSize, setNodeSize, brightness, setBrightness, rotationSpeed, setRotationSpeed, cpuLoad, gpuLoad, voiceState }) => {
  return (
    <div
      className="relative p-4 rounded-2xl"
      style={{
        background: 'linear-gradient(180deg, rgba(10,12,24,0.98) 0%, rgba(5,6,12,0.99) 100%)',
        border: '1px solid rgba(100, 150, 255, 0.3)',
        boxShadow: '0 4px 30px rgba(0,0,0,0.6), 0 0 40px rgba(100, 150, 255, 0.15)',
        minWidth: '260px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold tracking-widest bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          🧠 NEURAL NET
        </span>
      </div>

      {/* Node Size */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Node Size</label>
          <span className="text-[10px] font-mono font-bold text-cyan-400">{(nodeSize * 1000).toFixed(0)}</span>
        </div>
        <input
          type="range"
          min="0.03"
          max="0.18"
          step="0.01"
          value={nodeSize}
          onChange={(e) => { setNodeSize(parseFloat(e.target.value)); localStorage.setItem('jarvis.neural.nodeSize', e.target.value); }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #00ddff 0%, #00ddff ${((nodeSize - 0.03) / 0.15) * 100}%, rgba(255,255,255,0.1) ${((nodeSize - 0.03) / 0.15) * 100}%)`,
          }}
        />
      </div>

      {/* Brightness */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Brightness</label>
          <span className="text-[10px] font-mono font-bold text-yellow-400">{(brightness * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0.3"
          max="1.5"
          step="0.1"
          value={brightness}
          onChange={(e) => { setBrightness(parseFloat(e.target.value)); localStorage.setItem('jarvis.neural.brightness', e.target.value); }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #444 0%, #ffff00 ${((brightness - 0.3) / 1.2) * 100}%, rgba(255,255,255,0.1) ${((brightness - 0.3) / 1.2) * 100}%)`,
          }}
        />
      </div>

      {/* Rotation */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Rotation</label>
          <span className="text-[10px] font-mono font-bold text-purple-400">{(rotationSpeed * 1000).toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0"
          max="0.005"
          step="0.0005"
          value={rotationSpeed}
          onChange={(e) => { setRotationSpeed(parseFloat(e.target.value)); localStorage.setItem('jarvis.neural.rotation', e.target.value); }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #8844ff 0%, #ff4488 ${(rotationSpeed / 0.005) * 100}%, rgba(255,255,255,0.1) ${(rotationSpeed / 0.005) * 100}%)`,
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-cyan-400">{Math.round(cpuLoad)}%</div>
          <div className="text-[8px] text-slate-500 uppercase">CPU</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-purple-400">{Math.round(gpuLoad)}%</div>
          <div className="text-[8px] text-slate-500 uppercase">GPU</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold font-mono uppercase text-pink-400">
            {voiceState === VoiceState.SPEAKING ? 'TTS' : voiceState === VoiceState.LISTENING ? 'STT' : 'IDLE'}
          </div>
          <div className="text-[8px] text-slate-500 uppercase">Voice</div>
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
  
  // System load states
  const [cpuLoad, setCpuLoad] = useState(15);
  const [gpuLoad, setGpuLoad] = useState(8);
  
  // Neural Network settings
  const [showControls, setShowControls] = useState(false);
  const [nodeSize, setNodeSize] = useState(() => {
    const saved = localStorage.getItem('jarvis.neural.nodeSize');
    return saved ? parseFloat(saved) : 0.08;
  });
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem('jarvis.neural.brightness');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [rotationSpeed, setRotationSpeed] = useState(() => {
    const saved = localStorage.getItem('jarvis.neural.rotation');
    return saved ? parseFloat(saved) : 0.001;
  });
  
  // Simulate system load changes
  useEffect(() => {
    const interval = setInterval(() => {
      const baseCpu = processorState === ProcessorState.EXECUTING ? 50 : 
                      processorState === ProcessorState.ANALYZING ? 40 : 15;
      const baseGpu = processorState === ProcessorState.EXECUTING ? 35 : 8;
      
      setCpuLoad(prev => {
        const variation = (Math.random() - 0.5) * 12;
        return Math.max(5, Math.min(95, baseCpu + variation));
      });
      setGpuLoad(prev => {
        const variation = (Math.random() - 0.5) * 10;
        return Math.max(2, Math.min(90, baseGpu + variation));
      });
    }, 2000);
    
    return () => clearInterval(interval);
  }, [processorState]);
  
  // Dynamic brightness boost based on voice state
  const dynamicBrightness = voiceState === VoiceState.SPEAKING 
    ? brightness * 1.2 
    : voiceState === VoiceState.LISTENING 
    ? brightness * 1.1 
    : brightness;

  const renderContent = (): React.ReactNode => {
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
        return (displayContent?.custom?.component as React.ReactNode) || null;
      case 'NEURAL':
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 relative border border-cyan-900/40 bg-transparent flex flex-col items-center justify-center overflow-hidden rounded-lg min-h-0">

      {/* Neural Network Visualization */}
      {!showingContent && (
        <div className="absolute inset-0 flex items-center justify-center overflow-visible" style={{ zIndex: 1 }}>
          <JarvisNeuralNetwork
            cpuLoad={cpuLoad}
            gpuLoad={gpuLoad}
            voiceState={voiceState === VoiceState.SPEAKING ? 'speaking' : 
                       voiceState === VoiceState.LISTENING ? 'listening' : 'idle'}
            nodeSize={nodeSize}
            brightness={dynamicBrightness}
            rotationSpeed={rotationSpeed}
            width={640}
            height={640}
            showControls={false}
            onNodeSizeChange={(size) => {
              setNodeSize(size);
              localStorage.setItem('jarvis.neural.nodeSize', String(size));
            }}
            onBrightnessChange={(b) => {
              setBrightness(b);
              localStorage.setItem('jarvis.neural.brightness', String(b));
            }}
            onRotationChange={(speed) => {
              setRotationSpeed(speed);
              localStorage.setItem('jarvis.neural.rotation', String(speed));
            }}
          />
        </div>
      )}
      
      {/* Neural Network Controls */}
      {showControls && !showingContent && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50">
          <NeuralNetworkControls
            nodeSize={nodeSize}
            setNodeSize={setNodeSize}
            brightness={brightness}
            setBrightness={setBrightness}
            rotationSpeed={rotationSpeed}
            setRotationSpeed={setRotationSpeed}
            cpuLoad={cpuLoad}
            gpuLoad={gpuLoad}
            voiceState={voiceState}
          />
        </div>
      )}
      
      {/* Controls Toggle */}
      {!showingContent && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2" style={{ zIndex: 50 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowControls(!showControls);
            }}
            className={`p-2 rounded-lg transition-all duration-300 ${showControls ? 'bg-cyan-500/30 text-cyan-300' : 'bg-black/40 text-cyan-600 hover:text-cyan-400'}`}
            title="Toggle Neural Controls"
            style={{ cursor: 'pointer' }}
          >
            <Settings size={16} />
          </button>
          
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-300 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/40">
            <Brain size={14} className="animate-pulse" />
            <span>NEURAL</span>
          </div>
        </div>
      )}



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
