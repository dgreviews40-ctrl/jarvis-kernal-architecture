import React, { useEffect, useState, useRef } from 'react';
import { Settings, Camera, Shield, Cpu, Key, Save, FileText, Mic, Activity, Power, Video, Brain, Volume2, Sparkles, Server, Globe, CheckCircle2, XCircle, Info, Zap, Settings2, Database, Download, Upload, Share2, HardDrive, Network, Loader2, Monitor, Box, Terminal, ExternalLink, ShieldCheck, ShieldAlert as AlertIcon, Laptop, MousePointer2, Link, AlertTriangle, Code2 } from 'lucide-react';
import { vision } from '../services/vision';
import { voice } from '../services/voice';
import { providerManager } from '../services/providers';
import { registry } from '../services/registry';
import { backupService, SystemBackup } from '../services/backup';
import { haService } from '../services/home_assistant';
import { RuntimePlugin, VisionState, AIConfig, VoiceConfig, VoiceType, OllamaConfig } from '../types';
import { SystemDocs } from './SystemDocs';

interface SettingsInterfaceProps {
  onClose: () => void;
}

const AudioTestVisualizer: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (active) initAudio();
    else cleanup();
    return () => cleanup();
  }, [active]);

  const initAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      contextRef.current = audioCtx;
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 64;
      analyzerRef.current = analyzer;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyzer);
      draw();
    } catch (e) {}
  };

  const cleanup = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (contextRef.current) contextRef.current.close();
    cancelAnimationFrame(rafRef.current);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const analyzer = analyzerRef.current;
    if (!canvas || !analyzer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      analyzer.getByteFrequencyData(dataArray);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = percent * canvas.height;
        ctx.fillStyle = percent > 0.8 ? '#ef4444' : percent > 0.5 ? '#eab308' : '#22d3ee';
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    render();
  };

  return <canvas ref={canvasRef} className="w-full h-16 bg-[#111] rounded border border-cyan-900/30" />;
};

export const SettingsInterface: React.FC<SettingsInterfaceProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'AI' | 'DEVICES' | 'PLUGINS' | 'ARCHIVE' | 'DISTRIBUTION' | 'DOCS'>('GENERAL');
  
  // States
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('GEMINI_API_KEY') || process.env.API_KEY || '');
  const [aiConfig, setAiConfig] = useState<AIConfig>(providerManager.getAIConfig());
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>(providerManager.getOllamaConfig());
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(voice.getConfig());
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState<string>('');
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Archive States
  const [exportDest, setExportDest] = useState<'LOCAL' | 'NETWORK'>('LOCAL');
  const [networkPath, setNetworkPath] = useState('//STARK-NAS/backups/jarvis/');
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Distribution States
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [targetUrl, setTargetUrl] = useState('http://localhost:3000');
  const [hostingMode, setHostingMode] = useState<'CLOUD' | 'LOCAL'>('LOCAL');
  const [urlWarning, setUrlWarning] = useState(false);

  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [isTestingVideo, setIsTestingVideo] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Detect environment
    if (typeof window !== 'undefined') {
        const current = window.location.href;
        if (current.includes('localhost') || current.includes('127.0.0.1')) {
            setHostingMode('LOCAL');
            setTargetUrl(current);
        } else {
            setHostingMode('CLOUD');
            // If blob, don't set it as target, keep default
            if (!current.startsWith('blob:')) {
                setTargetUrl(current);
            }
        }
    }

    vision.getDevices().then(devices => {
        setCameras(devices);
        if (devices.length > 0) setSelectedCam(devices[0].deviceId);
    });
    
    const loadVoices = () => {
        const v = window.speechSynthesis.getVoices();
        setSystemVoices(v);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    const unsubVision = vision.subscribe((state) => {
        if (state === VisionState.ACTIVE && videoRef.current) {
            const stream = vision.getStream();
            if (stream && videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
        }
    });

    // Capture PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
        unsubVision();
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleSave = () => {
    if (selectedCam) vision.setDeviceId(selectedCam);
    if (apiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', apiKey.trim());
      // Also update the process.env for immediate use
      (process.env as any).API_KEY = apiKey.trim();
    }
    providerManager.setAIConfig(aiConfig);
    providerManager.setOllamaConfig(ollamaConfig);
    voice.setConfig(voiceConfig);
    onClose();
  };

  const testOllama = async () => {
    setOllamaStatus('PENDING');
    providerManager.setOllamaConfig(ollamaConfig);
    const ok = await providerManager.pingOllama();
    setOllamaStatus(ok ? 'SUCCESS' : 'ERROR');
    setTimeout(() => setOllamaStatus('IDLE'), 3000);
  };

  const refreshOllamaModels = async () => {
    setLoadingModels(true);
    try {
      const models = await providerManager.getOllamaModels();
      setAvailableOllamaModels(models);
      // If the current model is not in the list, keep it in the config but don't select it in the dropdown
      if (models.length > 0 && !models.includes(ollamaConfig.model)) {
        // Optionally set to the first available model, or leave as is
        // For now, we'll leave the current selection as is
      }
    } catch (error) {
      console.error('Error refreshing Ollama models:', error);
      setAvailableOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 1500)); 
    if (exportDest === 'LOCAL') {
      backupService.downloadLocal();
    } else {
      console.log(`[NETWORK_UPLINK] Data transmitted to ${networkPath}`);
    }
    setIsExporting(false);
  };

  const handleRestore = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string) as SystemBackup;
        await backupService.restore(backup);
        setAiConfig(providerManager.getAIConfig());
        setOllamaConfig(providerManager.getOllamaConfig());
        setVoiceConfig(voice.getConfig());
        alert("KERNEL RESTORATION SUCCESSFUL. SUBSYSTEMS RELOADED.");
      } catch (err) {
        alert("RESTORATION FAILED: Invalid manifest signature.");
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  const createWindowsLauncher = () => {
    let finalUrl = targetUrl.trim();
    if (!finalUrl.startsWith('http')) {
        finalUrl = 'http://' + finalUrl;
    }

    // Robust Batch Script that searches for Chrome/Edge locations
    const scriptContent = `@echo off
TITLE JARVIS KERNEL LAUNCHER
ECHO [SYSTEM] INITIALIZING UPLINK...
ECHO [TARGET] ${finalUrl}
ECHO.
ECHO NOTE: Ensure the JARVIS Server (npm start) is running before using this launcher.
ECHO.

REM Attempt to find Chrome
if exist "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --app="${finalUrl}"
    exit
)
if exist "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" --app="${finalUrl}"
    exit
)
if exist "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" --app="${finalUrl}"
    exit
)

REM Fallback to Edge
start msedge --app="${finalUrl}"
exit
`;
    try {
        const blob = new Blob([scriptContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "JARVIS_Launcher.bat";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("System blocked download. Please copy the URL manually and create a shortcut.");
        console.error("Launcher generation failed:", e);
    }
  };

  const handleNativeInstall = async () => {
    if (!installPrompt) {
        alert("Installation is already handled by your browser. Check the address bar for the 'App Available' icon, or use the 'Download Launcher' option below.");
        return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setInstallPrompt(null);
  };

  const neuralVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

  return (
    <div className="flex flex-col h-full text-gray-300">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#333]">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <Settings className="text-gray-400" />
          SYSTEM CONFIGURATION
        </h2>
        <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#333] rounded hover:bg-[#111] uppercase font-bold tracking-widest">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-bold bg-cyan-900/50 text-cyan-400 border border-cyan-800 rounded hover:bg-cyan-900 flex items-center gap-2 uppercase tracking-widest">
                <Save size={14} /> Save Protocols
            </button>
        </div>
      </div>

      <div className="flex flex-1 gap-8 overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 flex flex-col gap-2 shrink-0">
          {[
            { id: 'GENERAL', label: 'API & SECURITY', icon: <Key size={16}/> },
            { id: 'AI', label: 'AI CORE ENGINE', icon: <Brain size={16}/> },
            { id: 'DEVICES', label: 'A/V DEVICES', icon: <Camera size={16}/> },
            { id: 'PLUGINS', label: 'MODULES', icon: <Cpu size={16}/> },
            { id: 'ARCHIVE', label: 'DATA ARCHIVE', icon: <Database size={16}/> },
            { id: 'DISTRIBUTION', label: 'DISTRIBUTION', icon: <Monitor size={16}/> },
            { id: 'DOCS', label: 'DOCUMENTATION', icon: <FileText size={16}/> }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-left px-4 py-3 rounded flex items-center gap-3 text-xs font-bold transition-all border ${activeTab === tab.id ? 'bg-cyan-900/20 text-white border-cyan-500/50 translate-x-1 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
          
          {/* GENERAL TAB */}
          {activeTab === 'GENERAL' && (
             <div className="space-y-6">
                <div className="p-5 border border-cyan-900/20 rounded-lg bg-[#0a0a0a]">
                   <h3 className="font-bold text-cyan-500 mb-4 flex items-center gap-2 text-xs uppercase tracking-widest"><Key size={14} /> Gemini API Configuration</h3>
                   <div className="space-y-4">
                     <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block tracking-tight">API Key</label>
                        <input 
                          type="password" 
                          value={apiKey} 
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter your Gemini API key here..." 
                          className="w-full bg-black border border-cyan-900/30 rounded px-3 py-2 text-sm text-cyan-400 font-mono focus:border-cyan-500 outline-none transition-all"
                        />
                        <div className="text-[9px] text-gray-600 mt-2 font-mono">
                          Get your API key from: <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-cyan-500 hover:underline">https://aistudio.google.com/app/apikey</a>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                       <span className={`text-[10px] font-bold px-3 py-2 rounded border flex items-center gap-2 ${apiKey ? 'border-green-500/50 text-green-500 bg-green-500/10' : 'border-red-500/50 text-red-500 bg-red-500/10'}`}>
                          {apiKey ? <><CheckCircle2 size={12} /> API_KEY_DETECTED</> : <><XCircle size={12} /> NO_KEY_CONFIGURED</>}
                       </span>
                     </div>
                   </div>
                </div>
             </div>
          )}

          {/* AI ENGINE TAB */}
          {activeTab === 'AI' && (
             <div className="flex flex-col gap-6 animate-fadeIn pb-12">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="p-6 border border-indigo-900/30 rounded-lg bg-[#0a0a0a] flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b border-indigo-900/20 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-950/40 rounded border border-indigo-800/50">
                          <Globe size={18} className="text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Cloud Intelligence</h3>
                          <div className="text-[10px] text-indigo-700 font-mono">Google Gemini Protocols</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-3 block tracking-wider">Model Selection</label>
                        <div className="flex flex-col gap-2">
                           {[
                             { id: 'gemini-2.0-flash', label: 'GEMINI 2.0 FLASH', sub: 'Fastest multimodal (recommended)' },
                             { id: 'gemini-2.5-flash', label: 'GEMINI 2.5 FLASH', sub: 'Speed optimized & efficient' },
                             { id: 'gemini-1.5-flash', label: 'GEMINI 1.5 FLASH', sub: 'Standard fast (1M context)' }
                           ].map(model => (
                             <button 
                                key={model.id}
                                onClick={() => setAiConfig({...aiConfig, model: model.id as any})}
                                className={`p-3 border text-left rounded transition-all flex justify-between items-center ${aiConfig.model === model.id ? 'border-indigo-500 bg-indigo-950/20' : 'border-[#222] bg-black hover:border-indigo-900'}`}
                             >
                                <div>
                                  <div className={`text-xs font-bold ${aiConfig.model === model.id ? 'text-white' : 'text-gray-500'}`}>{model.label}</div>
                                  <div className="text-[9px] text-gray-600 font-mono uppercase">{model.sub}</div>
                                </div>
                                {aiConfig.model === model.id && <Zap size={12} className="text-indigo-400" />}
                             </button>
                           ))}
                        </div>
                        <div className="mt-4 p-3 bg-yellow-950/20 border border-yellow-900/30 rounded">
                          <div className="text-[9px] text-yellow-600 font-mono">
                            ⚠️ Note: gemini-1.5-pro is not compatible with the current SDK version. Use gemini-2.5-flash for best quality.
                          </div>
                        </div>
                      </div>
                      <div className="bg-indigo-950/5 p-4 rounded border border-indigo-900/10">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Neural Sampling [Temp]</label>
                            <span className="text-indigo-400 font-mono font-bold text-xs bg-black px-2 py-0.5 rounded border border-indigo-900/50">{aiConfig.temperature.toFixed(1)}</span>
                        </div>
                        <input 
                            type="range" min="0" max="1.5" step="0.1" 
                            value={aiConfig.temperature}
                            onChange={(e) => setAiConfig({...aiConfig, temperature: parseFloat(e.target.value)})}
                            className="w-full accent-indigo-500 h-1.5 bg-indigo-900/20 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border border-red-900/30 rounded-lg bg-[#0a0a0a] flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b border-red-900/20 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-950/40 rounded border border-red-800/50">
                          <Server size={18} className="text-red-400" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Simulated Logic</h3>
                          <div className="text-[10px] text-red-700 font-mono">Ollama Local Kernels</div>
                        </div>
                      </div>
                      <button 
                        onClick={testOllama}
                        disabled={ollamaStatus === 'PENDING'}
                        className={`px-3 py-1 rounded text-[10px] font-bold border transition-all flex items-center gap-2
                          ${ollamaStatus === 'SUCCESS' ? 'bg-green-950/20 border-green-500 text-green-400' : 
                            ollamaStatus === 'ERROR' ? 'bg-red-950/20 border-red-500 text-red-400' : 
                            'bg-black border-red-900/50 text-red-400 hover:bg-red-900/20'}
                        `}
                      >
                         {ollamaStatus === 'PENDING' ? <Loader2 size={12} className="animate-spin" /> : 
                          ollamaStatus === 'SUCCESS' ? <CheckCircle2 size={12} /> : 
                          ollamaStatus === 'ERROR' ? <XCircle size={12} /> : <Settings2 size={12} />}
                         {ollamaStatus === 'PENDING' ? 'PINGING' : 
                          ollamaStatus === 'SUCCESS' ? 'ONLINE' : 
                          ollamaStatus === 'ERROR' ? 'FAULT' : 'TEST'}
                      </button>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block tracking-tight">Access Endpoint</label>
                        <input 
                            type="text" 
                            value={ollamaConfig.url} 
                            onChange={(e) => setOllamaConfig({...ollamaConfig, url: e.target.value})}
                            placeholder="http://localhost:11434"
                            className="w-full bg-black border border-red-900/30 rounded px-3 py-2 text-xs text-red-400 font-mono focus:border-red-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Active Model ID</label>
                          <button
                            onClick={refreshOllamaModels}
                            disabled={loadingModels}
                            className="text-[9px] font-bold text-red-400 hover:text-red-300 disabled:opacity-50 flex items-center gap-1"
                          >
                            {loadingModels ? (
                              <>
                                <Loader2 size={10} className="animate-spin" /> REFRESHING...
                              </>
                            ) : (
                              <>
                                <Download size={10} /> REFRESH MODELS
                              </>
                            )}
                          </button>
                        </div>
                        {availableOllamaModels.length > 0 ? (
                          <select
                            value={ollamaConfig.model}
                            onChange={(e) => setOllamaConfig({...ollamaConfig, model: e.target.value})}
                            className="w-full bg-black border border-red-900/30 rounded px-3 py-2 text-xs text-red-400 font-mono focus:border-red-500 outline-none transition-all"
                          >
                            {availableOllamaModels.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={ollamaConfig.model}
                            onChange={(e) => setOllamaConfig({...ollamaConfig, model: e.target.value})}
                            placeholder="llama3"
                            className="w-full bg-black border border-red-900/30 rounded px-3 py-2 text-xs text-red-400 font-mono focus:border-red-500 outline-none transition-all"
                          />
                        )}
                      </div>
                      <div className="bg-red-950/5 p-4 rounded border border-red-900/10 mt-auto">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Local Temperature</label>
                            <span className="text-red-400 font-mono font-bold text-xs bg-black px-2 py-0.5 rounded border border-red-900/50">{ollamaConfig.temperature.toFixed(1)}</span>
                        </div>
                        <input 
                            type="range" min="0" max="1.5" step="0.1" 
                            value={ollamaConfig.temperature}
                            onChange={(e) => setOllamaConfig({...ollamaConfig, temperature: parseFloat(e.target.value)})}
                            className="w-full accent-red-500 h-1.5 bg-red-900/20 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border border-cyan-900/30 rounded-lg bg-[#0a0a0a] flex flex-col gap-6">
                  <div className="flex items-center justify-between border-b border-cyan-900/20 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-950/40 rounded border border-cyan-800/50">
                        <Volume2 size={18} className="text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Acoustic Synthesis</h3>
                        <div className="text-[10px] text-cyan-700 font-mono">Vocal Feedback Protocols</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-4">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Engine Mode</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setVoiceConfig({...voiceConfig, voiceType: 'SYSTEM'})}
                          className={`flex-1 p-3 border rounded flex flex-col items-center gap-2 transition-all ${voiceConfig.voiceType === 'SYSTEM' ? 'border-cyan-500 bg-cyan-950/20 text-white' : 'border-[#222] text-gray-600 bg-black hover:bg-cyan-950/10'}`}
                        >
                          <Activity size={16}/>
                          <span className="text-[10px] font-bold uppercase">Native Browser</span>
                        </button>
                        <button 
                          onClick={() => setVoiceConfig({...voiceConfig, voiceType: 'NEURAL'})}
                          className={`flex-1 p-3 border rounded flex flex-col items-center gap-2 transition-all ${voiceConfig.voiceType === 'NEURAL' ? 'border-indigo-500 bg-indigo-950/20 text-white' : 'border-[#222] text-gray-600 bg-black hover:bg-indigo-950/10'}`}
                        >
                          <Sparkles size={16}/>
                          <span className="text-[10px] font-bold uppercase">Gemini Neural</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Identity Profile</label>
                      {voiceConfig.voiceType === 'SYSTEM' ? (
                        <div className="flex-1">
                          <select 
                            value={voiceConfig.voiceName}
                            onChange={(e) => setVoiceConfig({...voiceConfig, voiceName: e.target.value})}
                            className="w-full bg-black border border-cyan-900/30 text-xs rounded p-2.5 text-cyan-400 font-mono outline-none focus:border-cyan-500"
                          >
                            {systemVoices.map(v => (
                              <option key={v.name} value={v.name}>{v.name.slice(0, 20)}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                           {neuralVoices.map(name => (
                             <button 
                               key={name}
                               onClick={() => setVoiceConfig({...voiceConfig, voiceName: name})}
                               className={`p-2 border text-[10px] font-bold rounded text-center transition-all ${voiceConfig.voiceName === name ? 'border-indigo-500 bg-indigo-950/40 text-white' : 'border-[#222] text-gray-600 bg-black hover:border-gray-500'}`}
                             >
                               {name.toUpperCase()}
                             </button>
                           ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
             </div>
          )}

          {/* DISTRIBUTION TAB (NEW) */}
          {activeTab === 'DISTRIBUTION' && (
             <div className="flex flex-col gap-6 animate-fadeIn pb-12">
                <div className="p-6 border border-cyan-900/30 rounded-lg bg-[#0a0a0a] flex flex-col gap-8">
                   <div className="flex items-center justify-between border-b border-cyan-900/20 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-950/40 rounded border border-cyan-800/50 text-cyan-400">
                          <Monitor size={18} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Deployment Center</h3>
                          <div className="text-[10px] text-cyan-700 font-mono">Standalone Application Protocols</div>
                        </div>
                      </div>
                   </div>

                   {/* HOSTING MODE SELECTION */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button 
                        onClick={() => { setHostingMode('CLOUD'); setTargetUrl(window.location.href); }}
                        className={`p-4 border rounded text-left transition-all ${hostingMode === 'CLOUD' ? 'bg-indigo-950/20 border-indigo-500' : 'bg-[#111] border-[#333] hover:border-gray-500'}`}
                      >
                         <div className="flex items-center gap-2 font-bold text-sm text-white mb-1">
                            <Globe size={16} /> Option A: Cloud / Web
                         </div>
                         <div className="text-[10px] text-gray-500">Run JARVIS directly in this browser window from the current cloud provider.</div>
                      </button>

                      <button 
                        onClick={() => { setHostingMode('LOCAL'); setTargetUrl('http://localhost:3000'); }}
                        className={`p-4 border rounded text-left transition-all ${hostingMode === 'LOCAL' ? 'bg-cyan-950/20 border-cyan-500' : 'bg-[#111] border-[#333] hover:border-gray-500'}`}
                      >
                         <div className="flex items-center gap-2 font-bold text-sm text-white mb-1">
                            <HardDrive size={16} /> Option B: True Local Hosting
                         </div>
                         <div className="text-[10px] text-gray-500">Run JARVIS offline on your Windows hard drive. Requires Node.js.</div>
                      </button>
                   </div>

                   {/* LOCAL GUIDE */}
                   {hostingMode === 'LOCAL' && (
                     <div className="bg-[#111] border border-cyan-900/30 p-4 rounded space-y-4 animate-fadeIn">
                        <div className="flex items-center gap-2 text-cyan-500 font-bold text-xs uppercase tracking-widest">
                            <Code2 size={14} /> Setup Instructions (Windows)
                        </div>
                        <div className="text-[11px] text-gray-400 space-y-2 font-mono">
                           <p>To run locally, you cannot just download the launcher. You must run the server code.</p>
                           <ol className="list-decimal pl-4 space-y-2 text-gray-300">
                              <li>Download the source code (or copy files to a folder).</li>
                              <li>Install <strong>Node.js</strong> (LTS version) if not installed.</li>
                              <li>Open <strong>Command Prompt</strong> in the folder and run:
                                 <div className="bg-black p-2 my-1 rounded border border-[#333] text-green-500 select-all cursor-pointer">npm install && npm run dev</div>
                              </li>
                              <li>Once the server starts (it will say <span className="text-white">Local: http://localhost:5173</span> or similar), verify the port number below.</li>
                           </ol>
                        </div>
                     </div>
                   )}

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-4 border-t border-[#222]">
                      {/* DOWNLOAD LAUNCHER SECTION */}
                      <div className="space-y-6">
                         <div className="flex items-center gap-2 text-cyan-500 font-bold text-xs uppercase tracking-widest mb-4">
                            <Laptop size={14} /> Desktop Launcher Generator
                         </div>
                         
                         <div className="bg-black/40 border border-[#222] p-6 rounded-lg space-y-6">
                            <div className="text-[11px] text-gray-400 leading-relaxed font-mono">
                               Generates a Windows shortcut (.bat) to open JARVIS in App Mode without browser toolbars.
                               <br/><br/>
                               
                               <div className="bg-[#111] p-3 rounded border border-[#333] mb-4">
                                  <label className="text-[9px] font-bold text-gray-500 uppercase block mb-2">Target Server Address</label>
                                  <div className="flex flex-col gap-2">
                                     <div className="flex gap-2">
                                         <input 
                                           type="text" 
                                           value={targetUrl}
                                           onChange={(e) => {
                                               setTargetUrl(e.target.value);
                                               setUrlWarning(e.target.value.startsWith('blob:'));
                                           }}
                                           placeholder="e.g. http://localhost:3000"
                                           className={`flex-1 bg-black border text-xs px-2 py-1 rounded font-mono ${urlWarning ? 'border-yellow-500 text-yellow-300' : 'border-cyan-900/50 text-cyan-400'}`}
                                         />
                                     </div>
                                     {urlWarning && (
                                         <div className="flex items-start gap-2 text-[9px] text-yellow-500 bg-yellow-950/20 p-2 rounded border border-yellow-900/50">
                                             <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                             <div>
                                                 <strong>INVALID URL:</strong> 'blob:' URLs are temporary and cannot be accessed from the desktop. Please switch to "True Local Hosting" or use the Cloud URL.
                                             </div>
                                         </div>
                                     )}
                                  </div>
                               </div>

                               <button 
                                 onClick={createWindowsLauncher}
                                 className="w-full py-4 bg-cyan-900/50 border border-cyan-500 text-cyan-400 rounded font-bold text-xs uppercase tracking-[0.2em] hover:bg-cyan-900 transition-all flex items-center justify-center gap-3"
                               >
                                  <Download size={16} /> DOWNLOAD LAUNCHER
                               </button>
                            </div>
                         </div>
                      </div>

                      {/* NATIVE INSTALL SECTION */}
                      <div className="space-y-6">
                         <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-widest mb-4">
                            <Box size={14} /> Browser Install (PWA)
                         </div>
                         
                         <div className="bg-black/40 border border-[#222] p-5 rounded-lg space-y-5">
                            <div className="text-[11px] text-gray-400 leading-relaxed font-mono">
                               Alternative: Install directly via Chrome/Edge PWA engine. This works for both Cloud and Local modes instantly.
                            </div>

                            {installPrompt ? (
                                <button 
                                  onClick={handleNativeInstall}
                                  className="w-full py-3 border border-indigo-500 bg-indigo-950/30 text-indigo-400 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-900/50 transition-all flex items-center justify-center gap-2"
                                >
                                   <Download size={14} /> INSTALL APP
                                </button>
                            ) : (
                                <div className="p-3 bg-indigo-950/10 border border-indigo-900/20 rounded text-center">
                                   <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Status: Ready</div>
                                   <div className="text-[9px] text-gray-600">
                                      Click the <span className="text-white border border-gray-600 px-1 rounded mx-1">App Available</span> icon in your address bar.
                                   </div>
                                </div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'ARCHIVE' && (
             <div className="flex flex-col gap-6 animate-fadeIn pb-12">
                <div className="p-6 border border-cyan-900/30 rounded-lg bg-[#0a0a0a] flex flex-col gap-8">
                   <div className="flex items-center justify-between border-b border-cyan-900/20 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-950/40 rounded border border-cyan-800/50 text-cyan-400">
                          <Share2 size={18} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase tracking-widest">System Backup Protocol</h3>
                          <div className="text-[10px] text-cyan-700 font-mono">Kernel Persistence Management</div>
                        </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-6">
                         <div className="flex items-center gap-2 text-cyan-500 font-bold text-xs uppercase tracking-widest mb-4">
                            <Download size={14} /> Neural Weight Extraction
                         </div>
                         <div className="bg-black/40 border border-[#222] p-4 rounded-lg space-y-4">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Target Destination</label>
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => setExportDest('LOCAL')}
                                 className={`flex-1 p-3 border rounded flex items-center justify-center gap-3 text-[10px] font-bold transition-all ${exportDest === 'LOCAL' ? 'border-cyan-500 bg-cyan-950/20 text-white' : 'border-[#222] text-gray-500 bg-black'}`}
                               >
                                  <HardDrive size={14} /> LOCAL TERMINAL
                               </button>
                               <button 
                                 onClick={() => setExportDest('NETWORK')}
                                 className={`flex-1 p-3 border rounded flex items-center justify-center gap-3 text-[10px] font-bold transition-all ${exportDest === 'NETWORK' ? 'border-indigo-500 bg-indigo-950/20 text-white' : 'border-[#222] text-gray-500 bg-black'}`}
                               >
                                  <Network size={14} /> NETWORK UPLINK
                               </button>
                            </div>
                            {exportDest === 'NETWORK' && (
                               <div className="mt-4 animate-fadeIn">
                                  <label className="text-[9px] font-bold text-indigo-800 uppercase mb-1 block">Network UNC Path</label>
                                  <input 
                                     type="text" 
                                     value={networkPath} 
                                     onChange={(e) => setNetworkPath(e.target.value)}
                                     className="w-full bg-black border border-indigo-900/30 rounded px-3 py-2 text-[10px] text-indigo-400 font-mono focus:border-indigo-500 outline-none"
                                  />
                               </div>
                            )}
                            <button 
                              onClick={handleExport}
                              disabled={isExporting}
                              className="w-full py-4 mt-4 bg-cyan-900/50 border border-cyan-500 text-cyan-400 rounded font-bold text-xs uppercase tracking-[0.2em] hover:bg-cyan-900 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                               {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                               {isExporting ? 'TRANSMITTING...' : 'INITIATE BACKUP'}
                            </button>
                         </div>
                      </div>
                      <div className="space-y-6">
                         <div className="flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-widest mb-4">
                            <Upload size={14} /> Neural Reintegration
                         </div>
                         <div className="bg-black/40 border border-orange-900/20 p-6 rounded-lg border-dashed flex flex-col items-center justify-center text-center gap-4">
                            <div className="p-4 bg-orange-950/20 rounded-full border border-orange-800/30 text-orange-400">
                               <Database size={32} />
                            </div>
                            <div>
                               <div className="text-xs font-bold text-white uppercase mb-1">Upload Restoration Manifest</div>
                               <div className="text-[10px] text-gray-600 font-mono">Format: .JSON | Encrypted: AES-256</div>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={onFileChange} accept=".json" className="hidden" />
                            <button 
                              onClick={handleRestore}
                              disabled={isRestoring}
                              className="px-6 py-2 border border-orange-500/50 bg-orange-950/20 text-orange-400 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-orange-900/40 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                               {isRestoring ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                               {isRestoring ? 'VERIFYING...' : 'BROWSE ARCHIVES'}
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'DEVICES' && (
             <div className="space-y-6">
                <div className="p-5 border border-cyan-900/20 rounded-lg bg-[#0a0a0a]">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="font-bold text-cyan-500 flex items-center gap-2 text-xs uppercase tracking-widest"><Video size={14} /> Optical Hardware</h3>
                       <button onClick={() => setIsTestingVideo(!isTestingVideo)} className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors ${isTestingVideo ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-[#222] text-gray-300 border-[#333]'}`}>
                           {isTestingVideo ? 'TERMINATE_PREVIEW' : 'INIT_TEST'}
                       </button>
                   </div>
                   <div className="space-y-4">
                       <select value={selectedCam} onChange={(e) => setSelectedCam(e.target.value)} className="w-full bg-black border border-cyan-900/30 text-white rounded px-3 py-2 text-xs font-mono">
                         {cameras.map(cam => <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `ID: ${cam.deviceId.slice(0, 8)}`}</option>)}
                       </select>
                       <div className="relative h-48 bg-black border border-cyan-900/10 rounded overflow-hidden flex items-center justify-center">
                           <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-contain ${isTestingVideo ? 'opacity-100' : 'opacity-0 hidden'}`}/>
                           {!isTestingVideo && <div className="text-gray-800 text-[10px] flex flex-col items-center gap-2 uppercase tracking-widest"><Video size={20} /> Preview Dormant</div>}
                       </div>
                   </div>
                </div>
                <div className="p-5 border border-cyan-900/20 rounded-lg bg-[#0a0a0a]">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="font-bold text-cyan-500 flex items-center gap-2 text-xs uppercase tracking-widest"><Mic size={14} /> Acoustic Sensors</h3>
                       <button onClick={() => setIsTestingAudio(!isTestingAudio)} className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors ${isTestingAudio ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-[#222] text-gray-300 border-[#333]'}`}>
                           {isTestingAudio ? 'STOP_SIGNAL_TEST' : 'TEST_FREQUENCY'}
                       </button>
                   </div>
                   <AudioTestVisualizer active={isTestingAudio} />
                </div>
             </div>
          )}

          {activeTab === 'PLUGINS' && (
             <div className="space-y-3">
                {registry.getAll().map(plugin => (
                    <div key={plugin.manifest.id} className="p-4 border border-cyan-900/10 rounded-lg bg-[#0a0a0a] flex items-center justify-between">
                        <div>
                            <div className="font-bold text-gray-300 text-sm">{plugin.manifest.name}</div>
                            <div className="text-[10px] text-gray-600 font-mono">{plugin.manifest.id} • v{plugin.manifest.version}</div>
                        </div>
                        <div className={`text-[9px] font-bold px-2 py-1 rounded border ${plugin.status === 'ACTIVE' ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-gray-500 border-gray-700 bg-gray-900'}`}>
                            {plugin.status}
                        </div>
                    </div>
                ))}

                {/* Home Assistant Configuration */}
                <div className="p-4 border border-cyan-900/10 rounded-lg bg-[#0a0a0a]">
                    <div className="font-bold text-gray-300 text-sm mb-3">Home Assistant Bridge</div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Home Assistant URL</label>
                            <input
                                type="text"
                                placeholder="http://homeassistant.local:8123"
                                className="w-full bg-black border border-cyan-900/30 text-white rounded px-3 py-2 text-xs font-mono"
                                defaultValue={localStorage.getItem('HA_URL') || ''}
                                onChange={(e) => {
                                    localStorage.setItem('HA_URL', e.target.value);
                                }}
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Long-Lived Access Token</label>
                            <input
                                type="password"
                                placeholder="Enter your Home Assistant access token"
                                className="w-full bg-black border border-cyan-900/30 text-white rounded px-3 py-2 text-xs font-mono"
                                defaultValue={localStorage.getItem('HA_TOKEN') || ''}
                                onChange={(e) => {
                                    localStorage.setItem('HA_TOKEN', e.target.value);
                                }}
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={async () => {
                                    const url = localStorage.getItem('HA_URL');
                                    const token = localStorage.getItem('HA_TOKEN');

                                    if (!url || !token) {
                                        alert('Please enter both URL and token');
                                        return;
                                    }

                                    try {
                                        haService.configure(url, token);
                                        const status = await haService.getStatus();

                                        if (status.connected) {
                                            alert(`Connected successfully! Found ${status.entitiesCount} entities.`);
                                        } else {
                                            alert(`Connection failed: ${status.error}`);
                                        }
                                    } catch (error) {
                                        alert(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                    }
                                }}
                                className="px-3 py-1.5 text-xs font-bold bg-cyan-900/30 text-cyan-400 border border-cyan-800 rounded hover:bg-cyan-900/50"
                            >
                                Test Connection
                            </button>

                            <button
                                onClick={async () => {
                                    try {
                                        const status = await haService.getStatus();
                                        if (status.connected) {
                                            alert(`Connected! Found ${status.entitiesCount} entities.`);
                                        } else {
                                            alert(`Disconnected: ${status.error}`);
                                        }
                                    } catch (error) {
                                        alert(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                    }
                                }}
                                className="px-3 py-1.5 text-xs font-bold bg-gray-800/30 text-gray-400 border border-gray-700 rounded hover:bg-gray-800/50"
                            >
                                Check Status
                            </button>
                        </div>
                    </div>
                </div>
             </div>
          )}
          
          {activeTab === 'DOCS' && <SystemDocs />}
        </div>
      </div>
    </div>
  );
};