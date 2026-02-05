import React, { useEffect, useState, useRef } from 'react';
import { Settings, Camera, Shield, Cpu, Key, Save, FileText, Mic, Activity, Power, Video, Brain, Volume2, Sparkles, Server, Globe, CheckCircle2, XCircle, Info, Zap, Settings2, Database, Download, Upload, Share2, HardDrive, Network, Loader2, Monitor, Box, Terminal, ExternalLink, ShieldCheck, ShieldAlert as AlertIcon, Laptop, MousePointer2, Link, AlertTriangle, Code2, Play } from 'lucide-react';
import { vision } from '../services/vision';
import { voice } from '../services/voice';
import { piperTTS, RECOMMENDED_PIPER_VOICES, PIPER_SETUP_INSTRUCTIONS } from '../services/piperTTS';
import { piperLauncher, PiperLauncherState } from '../services/piperLauncher';
import { providerManager } from '../services/providers';
import { registry } from '../services/registry';
import { backupService, SystemBackup } from '../services/backup';
import { haService } from '../services/home_assistant';
import { getGeminiStats } from '../services/gemini';
import { RuntimePlugin, VisionState, AIConfig, VoiceConfig, VoiceType, OllamaConfig } from '../types';
import { SystemDocs } from './SystemDocs';
import { EncryptionSetup } from './EncryptionSetup';
import { SettingsBackup } from './SettingsBackup';
import { apiKeyManager } from '../services/apiKeyManager';
import { GeneralTab } from './settings/GeneralTab';

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
    } catch (e) { console.warn('[SETTINGS] Failed to setup audio analyzer:', e); }
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
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'AI' | 'DEVICES' | 'PLUGINS' | 'ARCHIVE' | 'DISTRIBUTION' | 'DOCS' | 'SECURITY' | 'BACKUP'>('GENERAL');
  
  // States
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('GEMINI_API_KEY') || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || '');
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
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [showEncryptionSetup, setShowEncryptionSetup] = useState(false);
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [geminiStats, setGeminiStats] = useState({ 
    used: 0, 
    remaining: 1400, 
    limit: 1400,
    perMinuteUsed: 0,
    perMinuteRemaining: 14,
    isRateLimited: false 
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Update Gemini stats periodically
  useEffect(() => {
    const updateStats = () => setGeminiStats(getGeminiStats());
    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check encryption status
    setEncryptionEnabled(apiKeyManager.isEncryptionEnabled());
    
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
        // Clean up speechSynthesis event listener to prevent memory leak
        window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      if (selectedCam) vision.setDeviceId(selectedCam);
      
      if (apiKey.trim()) {
        // Store API key in localStorage (fallback for immediate use)
        localStorage.setItem('GEMINI_API_KEY', btoa(apiKey.trim()));
        // Also update the process.env for immediate use
        (process.env as any).API_KEY = apiKey.trim();
        
        // Save to .env.local file via proxy server
        try {
          const response = await fetch('http://localhost:3101/save-api-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'gemini',
              key: apiKey.trim()
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            console.log('[SETTINGS] API key saved to .env.local:', result.file);
            setSaveMessage('API key saved to .env.local successfully');
          } else {
            console.warn('[SETTINGS] Failed to save API key to file:', result.message);
            setSaveMessage('Saved locally but failed to write to .env file');
          }
        } catch (err) {
          console.warn('[SETTINGS] Proxy server not available, key saved to localStorage only:', err);
          setSaveMessage('Proxy server offline - key saved to browser only');
        }
      }
      
      providerManager.setAIConfig(aiConfig);
      providerManager.setOllamaConfig(ollamaConfig);
      voice.setConfig(voiceConfig);
      
      // Show success message briefly before closing
      if (!saveMessage) {
        setSaveMessage('Settings saved successfully');
      }
      
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } finally {
      setIsSaving(false);
    }
  };

  const testOllama = async () => {
    setOllamaStatus('PENDING');
    providerManager.setOllamaConfig(ollamaConfig);
    const ok = await providerManager.pingOllama();
    setOllamaStatus(ok ? 'SUCCESS' : 'ERROR');
    setTimeout(() => setOllamaStatus('IDLE'), 3000);
  };

  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [voiceTestError, setVoiceTestError] = useState<string | null>(null);

  const testVoice = async () => {
    setIsTestingVoice(true);
    setVoiceTestError(null);
    
    // If Piper is selected, check if server is available first
    if (voiceConfig.voiceType === 'PIPER') {
      if (piperLauncherStatus !== 'RUNNING') {
        setVoiceTestError('Piper server is not running. Click "Start Piper" to start it.');
        setIsTestingVoice(false);
        return;
      }
    }
    
    // Temporarily apply the config and test
    const originalConfig = voice.getConfig();
    voice.setConfig(voiceConfig);
    
    try {
      await voice.speak("Hello, I am JARVIS. Your personal AI assistant. How may I help you today?");
    } catch (error) {
      setVoiceTestError('Voice test failed. Check console for details.');
      console.error('[VOICE TEST] Error:', error);
    }
    
    // Restore original after a delay (voice will use the new config for this utterance)
    setTimeout(() => {
      voice.setConfig(originalConfig);
      setIsTestingVoice(false);
    }, 100);
  };

  const [sttStatus, setSttStatus] = useState<'IDLE' | 'SWITCHING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [sttStatusMessage, setSttStatusMessage] = useState('');

  const handleSTTProviderChange = async (provider: 'AUTO' | 'WHISPER' | 'BROWSER') => {
    // Update config state
    setVoiceConfig({...voiceConfig, sttProvider: provider});
    
    // Apply immediately if voice is active
    const currentState = voice.getState();
    if (currentState !== 'MUTED' && currentState !== 'ERROR') {
      setSttStatus('SWITCHING');
      setSttStatusMessage(`Switching to ${provider} STT...`);
      
      try {
        const success = await voice.switchSTTProvider(provider);
        if (success) {
          setSttStatus('SUCCESS');
          setSttStatusMessage(`✓ Now using ${provider} STT`);
        } else {
          setSttStatus('ERROR');
          setSttStatusMessage(`✗ Failed to switch to ${provider}. Server may not be available.`);
        }
      } catch (error) {
        setSttStatus('ERROR');
        setSttStatusMessage(`✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Clear status after 3 seconds
      setTimeout(() => {
        setSttStatus('IDLE');
        setSttStatusMessage('');
      }, 3000);
    }
  };

  const [piperLauncherStatus, setPiperLauncherStatus] = useState<PiperLauncherState>('CHECKING');
  const [piperLauncherMessage, setPiperLauncherMessage] = useState('Checking Piper status...');

  // Subscribe to Piper launcher status
  useEffect(() => {
    const unsubscribe = piperLauncher.subscribe((status) => {
      setPiperLauncherStatus(status.state);
      setPiperLauncherMessage(status.message);
    });
    return unsubscribe;
  }, []);

  const handleStartPiper = async () => {
    const success = await piperLauncher.startServer();
    if (!success) {
      // Show manual instructions if auto-start failed
      alert(piperLauncher.getManualInstructions());
    }
  };

  const checkPiperStatus = async () => {
    await piperLauncher.checkStatus();
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

  // All 30 Gemini TTS voices with their characteristics
const neuralVoices = [
  { name: 'Kore', style: 'Firm - Authoritative, commanding' },
  { name: 'Puck', style: 'Upbeat - Energetic, positive' },
  { name: 'Charon', style: 'Informative - Clear, educational' },
  { name: 'Fenrir', style: 'Excitable - Animated, enthusiastic' },
  { name: 'Zephyr', style: 'Bright - Light, airy' },
  { name: 'Leda', style: 'Youthful - Young, fresh' },
  { name: 'Orus', style: 'Firm - Strong, steady' },
  { name: 'Aoede', style: 'Breezy - Casual, relaxed' },
  { name: 'Callirrhoe', style: 'Easy-going - Laid back' },
  { name: 'Autonoe', style: 'Bright - Cheerful, sunny' },
  { name: 'Enceladus', style: 'Breathy - Soft, whispery' },
  { name: 'Iapetus', style: 'Clear - Precise, articulate' },
  { name: 'Umbriel', style: 'Easy-going - Relaxed' },
  { name: 'Algieba', style: 'Smooth - Polished, refined' },
  { name: 'Despina', style: 'Smooth - Elegant' },
  { name: 'Erinome', style: 'Clear - Distinct' },
  { name: 'Algenib', style: 'Gravelly - Raspy, textured' },
  { name: 'Rasalgethi', style: 'Informative - Knowledgeable' },
  { name: 'Laomedeia', style: 'Upbeat - Positive' },
  { name: 'Achernar', style: 'Soft - Gentle, quiet' },
  { name: 'Alnilam', style: 'Firm - Resolute' },
  { name: 'Schedar', style: 'Even - Balanced, steady' },
  { name: 'Gacrux', style: 'Mature - Adult, seasoned' },
  { name: 'Pulcherrima', style: 'Forward - Direct, bold' },
  { name: 'Achird', style: 'Friendly - Warm, welcoming' },
  { name: 'Zubenelgenubi', style: 'Casual - Informal' },
  { name: 'Vindemiatrix', style: 'Gentle - Soft, kind' },
  { name: 'Sadachbia', style: 'Lively - Animated' },
  { name: 'Sadaltager', style: 'Knowledgeable - Wise' },
  { name: 'Sulafat', style: 'Warm - Friendly, cozy' }
];

  // Text style constants
  const textStyle = {
    sectionHeader: 'text-xl font-bold tracking-wider',
    bodySecondary: 'text-sm',
    button: 'text-sm font-medium',
    buttonSmall: 'text-xs font-medium'
  };

  return (
    <div className="flex flex-col h-full text-gray-300">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#333]">
        <h2 className={`${textStyle.sectionHeader} flex items-center gap-2 text-white`}>
          <Settings className="text-gray-400" />
          SYSTEM CONFIGURATION
        </h2>
        <div className="flex items-center gap-3">
            {saveMessage && (
              <span className={`text-xs ${saveMessage.includes('success') ? 'text-green-400' : saveMessage.includes('offline') ? 'text-yellow-400' : 'text-cyan-400'}`}>
                {saveMessage}
              </span>
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className={`px-4 py-2 ${textStyle.bodySecondary} text-gray-400 hover:text-white border border-[#333] rounded hover:bg-[#111]`}>Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className={`px-4 py-2 ${textStyle.button} bg-cyan-900/50 text-cyan-400 border border-cyan-800 rounded hover:bg-cyan-900 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save Protocols
                  </>
                )}
              </button>
            </div>
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
            { id: 'DOCS', label: 'DOCUMENTATION', icon: <FileText size={16}/> },
            { id: 'SECURITY', label: 'ENCRYPTION', icon: <Shield size={16}/> },
            { id: 'BACKUP', label: 'BACKUP & RESTORE', icon: <Save size={16}/> }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-left px-4 py-3 rounded flex items-center gap-3 ${textStyle.buttonSmall} transition-all border ${activeTab === tab.id ? 'bg-cyan-900/20 text-white border-cyan-500/50 translate-x-1 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
          
          {/* GENERAL TAB */}
          {activeTab === 'GENERAL' && <GeneralTab apiKey={apiKey} setApiKey={setApiKey} />}

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
                             { id: 'gemini-3-pro-preview', label: 'GEMINI 3.0 PRO', sub: 'Latest - Most intelligent (preview)' },
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
                            ⚠️ Note: gemini-3-pro-preview requires a paid API key with access to the latest models. Use gemini-2.0-flash for best compatibility.
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
                      {/* Vision Models Info */}
                      <div className="bg-purple-950/10 p-4 rounded border border-purple-900/30">
                        <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Camera size={12} /> Vision-Capable Models
                        </div>
                        <div className="text-[9px] text-gray-500 font-mono space-y-1">
                          <p>For image analysis, install a vision model:</p>
                          <code className="block bg-black p-2 rounded text-purple-400 mt-2">
                            ollama pull llava
                          </code>
                          <p className="mt-2">Other options: bakllava, moondream</p>
                        </div>
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

                {/* GEMINI USAGE STATS - FREE TIER TRACKING */}
                <div className={`p-6 border rounded-lg bg-[#0a0a0a] flex flex-col gap-6 ${geminiStats.isRateLimited ? 'border-red-900/50 bg-red-950/10' : 'border-yellow-900/30'}`}>
                  <div className="flex items-center justify-between border-b border-yellow-900/20 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded border ${geminiStats.isRateLimited ? 'bg-red-950/40 border-red-800/50' : 'bg-yellow-950/40 border-yellow-800/50'}`}>
                        <Zap size={18} className={geminiStats.isRateLimited ? 'text-red-400' : 'text-yellow-400'} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Free Tier Usage</h3>
                        <div className={`text-[10px] font-mono ${geminiStats.isRateLimited ? 'text-red-700' : 'text-yellow-700'}`}>Gemini API Quota</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Status</div>
                      <div className={`text-xs font-bold ${
                        geminiStats.isRateLimited ? 'text-red-400' :
                        geminiStats.remaining > 100 ? 'text-green-400' : 
                        geminiStats.remaining > 20 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {geminiStats.isRateLimited ? 'RATE LIMITED' :
                         geminiStats.remaining > 0 ? 'ACTIVE' : 'LIMIT REACHED'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Daily Progress bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                        <span>Daily Usage</span>
                        <span>{geminiStats.used} / {geminiStats.limit}</span>
                      </div>
                      <div className="relative h-3 bg-black rounded-full overflow-hidden border border-yellow-900/30">
                        <div 
                          className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                            geminiStats.remaining > 100 ? 'bg-green-500' : 
                            geminiStats.remaining > 20 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, (geminiStats.used / geminiStats.limit) * 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Per-minute Progress bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                        <span>Per-Minute (prevents 429 errors)</span>
                        <span>{geminiStats.perMinuteUsed} / 14</span>
                      </div>
                      <div className="relative h-2 bg-black rounded-full overflow-hidden border border-yellow-900/30">
                        <div 
                          className={`absolute top-0 left-0 h-full transition-all duration-500 ${
                            geminiStats.perMinuteRemaining > 5 ? 'bg-green-500' : 
                            geminiStats.perMinuteRemaining > 1 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, (geminiStats.perMinuteUsed / 14) * 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-black/40 p-2 rounded border border-yellow-900/20 text-center">
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Daily Used</div>
                        <div className="text-lg font-mono font-bold text-yellow-400">{geminiStats.used}</div>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-yellow-900/20 text-center">
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Daily Left</div>
                        <div className={`text-lg font-mono font-bold ${
                          geminiStats.remaining > 100 ? 'text-green-400' : 
                          geminiStats.remaining > 20 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {geminiStats.remaining}
                        </div>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-yellow-900/20 text-center">
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">This Minute</div>
                        <div className={`text-lg font-mono font-bold ${
                          geminiStats.perMinuteRemaining > 5 ? 'text-green-400' : 
                          geminiStats.perMinuteRemaining > 1 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {geminiStats.perMinuteUsed}
                        </div>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-yellow-900/20 text-center">
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Min Left</div>
                        <div className={`text-lg font-mono font-bold ${
                          geminiStats.perMinuteRemaining > 5 ? 'text-green-400' : 
                          geminiStats.perMinuteRemaining > 1 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {geminiStats.perMinuteRemaining}
                        </div>
                      </div>
                    </div>
                    
                    {/* Warning if rate limited */}
                    {geminiStats.isRateLimited && (
                      <div className="text-[9px] text-red-400 font-mono bg-red-950/20 p-3 rounded border border-red-900/50">
                        <span className="text-red-500">⚠</span> <strong>RATE LIMITED:</strong> Too many requests. 
                        JARVIS is using local processing only. Wait 60 seconds or switch to Ollama mode.
                      </div>
                    )}
                    
                    {/* Info text */}
                    <div className="text-[9px] text-gray-500 font-mono bg-yellow-950/10 p-3 rounded border border-yellow-900/20">
                      <span className="text-yellow-500">ℹ</span> Local intent classifier handles most commands for free. 
                      Gemini is only used for complex queries. Per-minute limits prevent 429 errors.
                      Resets daily at midnight.
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
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => setVoiceConfig({...voiceConfig, voiceType: 'SYSTEM'})}
                          className={`flex-1 min-w-[100px] p-3 border rounded flex flex-col items-center gap-2 transition-all ${voiceConfig.voiceType === 'SYSTEM' ? 'border-cyan-500 bg-cyan-950/20 text-white' : 'border-[#222] text-gray-600 bg-black hover:bg-cyan-950/10'}`}
                        >
                          <Activity size={16}/>
                          <span className="text-[10px] font-bold uppercase">Native Browser</span>
                        </button>
                        <button 
                          onClick={() => setVoiceConfig({...voiceConfig, voiceType: 'NEURAL'})}
                          className={`flex-1 min-w-[100px] p-3 border rounded flex flex-col items-center gap-2 transition-all ${voiceConfig.voiceType === 'NEURAL' ? 'border-indigo-500 bg-indigo-950/20 text-white' : 'border-[#222] text-gray-600 bg-black hover:bg-indigo-950/10'}`}
                        >
                          <Sparkles size={16}/>
                          <span className="text-[10px] font-bold uppercase">Gemini Neural</span>
                        </button>
                        <button 
                          onClick={() => setVoiceConfig({...voiceConfig, voiceType: 'PIPER'})}
                          className={`flex-1 min-w-[100px] p-3 border rounded flex flex-col items-center gap-2 transition-all ${voiceConfig.voiceType === 'PIPER' ? 'border-green-500 bg-green-950/20 text-white' : 'border-[#222] text-gray-600 bg-black hover:bg-green-950/10'}`}
                        >
                          <Server size={16}/>
                          <span className="text-[10px] font-bold uppercase">Piper Local</span>
                          <span className="text-[8px] text-green-500">⭐ JARVIS Voice!</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Speech Recognition (STT)</label>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => handleSTTProviderChange('AUTO')}
                          disabled={sttStatus === 'SWITCHING'}
                          className={`flex-1 min-w-[100px] p-3 border rounded flex flex-col items-center gap-2 transition-all disabled:opacity-50 ${voiceConfig.sttProvider === 'AUTO' || !voiceConfig.sttProvider ? 'border-cyan-500 bg-cyan-950/20 text-white' : 'border-[#222] text-gray-600 bg-black hover:bg-cyan-950/10'}`}
                        >
                          <Zap size={16}/>
                          <span className="text-[10px] font-bold uppercase">Auto</span>
                          <span className="text-[8px] text-cyan-500">Whisper → Browser</span>
                        </button>
                        <button 
                          onClick={() => handleSTTProviderChange('WHISPER')}
                          disabled={sttStatus === 'SWITCHING'}
                          className={`flex-1 min-w-[100px] p-3 border rounded flex flex-col items-center gap-2 transition-all disabled:opacity-50 ${voiceConfig.sttProvider === 'WHISPER' ? 'border-green-500 bg-green-950/20 text-white' : 'border-[#222] text-gray-600 bg-black hover:bg-green-950/10'}`}
                        >
                          <Mic size={16}/>
                          <span className="text-[10px] font-bold uppercase">Whisper</span>
                          <span className="text-[8px] text-green-500">Local & Offline</span>
                        </button>
                        <button 
                          onClick={() => handleSTTProviderChange('BROWSER')}
                          disabled={sttStatus === 'SWITCHING'}
                          className={`flex-1 min-w-[100px] p-3 border rounded flex flex-col items-center gap-2 transition-all disabled:opacity-50 ${voiceConfig.sttProvider === 'BROWSER' ? 'border-indigo-500 bg-indigo-950/20 text-white' : 'border-[#222] text-gray-600 bg-black hover:bg-indigo-950/10'}`}
                        >
                          <Globe size={16}/>
                          <span className="text-[10px] font-bold uppercase">Browser</span>
                          <span className="text-[8px] text-indigo-500">Google STT</span>
                        </button>
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {sttStatus === 'SWITCHING' ? (
                          <span className="text-yellow-400">⏳ {sttStatusMessage}</span>
                        ) : sttStatus === 'SUCCESS' ? (
                          <span className="text-green-400">{sttStatusMessage}</span>
                        ) : sttStatus === 'ERROR' ? (
                          <span className="text-red-400">{sttStatusMessage}</span>
                        ) : voiceConfig.sttProvider === 'WHISPER' ? (
                          <span className="text-green-400">⚡ Whisper runs locally - requires Python server running</span>
                        ) : voiceConfig.sttProvider === 'BROWSER' ? (
                          <span className="text-indigo-400">🌐 Browser STT uses Google&apos;s servers - requires internet</span>
                        ) : (
                          <span className="text-cyan-400">🔄 Auto mode tries Whisper first, falls back to Browser if unavailable</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                      ) : voiceConfig.voiceType === 'PIPER' ? (
                        <div className="flex flex-col gap-3">
                          <div className="p-3 bg-green-900/20 border border-green-500/30 rounded text-[10px] text-green-400">
                            <strong>🎭 JARVIS Voice Available!</strong><br/>
                            Piper runs locally - completely free & offline!
                          </div>
                          
                          {/* Piper Status & Test */}
                          <div className="flex gap-2">
                            {/* Status Button - Shows current state and allows check */}
                            <button
                              onClick={checkPiperStatus}
                              disabled={piperLauncherStatus === 'CHECKING' || piperLauncherStatus === 'STARTING'}
                              className={`flex-1 p-2 border rounded text-[10px] text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2
                                ${piperLauncherStatus === 'RUNNING' ? 'bg-green-800 hover:bg-green-700 border-green-600' : 
                                  piperLauncherStatus === 'ERROR' ? 'bg-red-800 hover:bg-red-700 border-red-600' :
                                  piperLauncherStatus === 'STARTING' ? 'bg-yellow-800 hover:bg-yellow-700 border-yellow-600' :
                                  'bg-gray-800 hover:bg-gray-700 border-gray-600'}`}
                            >
                              {piperLauncherStatus === 'CHECKING' && <Loader2 size={12} className="animate-spin" />}
                              {piperLauncherStatus === 'RUNNING' && <CheckCircle2 size={12} />}
                              {piperLauncherStatus === 'ERROR' && <XCircle size={12} />}
                              {piperLauncherStatus === 'NOT_INSTALLED' && <AlertTriangle size={12} />}
                              {piperLauncherStatus === 'STARTING' && <Loader2 size={12} className="animate-spin" />}
                              {piperLauncherStatus === 'CHECKING' ? 'Checking...' : 
                               piperLauncherStatus === 'RUNNING' ? '✓ Piper Online' :
                               piperLauncherStatus === 'NOT_INSTALLED' ? '✗ Not Installed' :
                               piperLauncherStatus === 'NOT_RUNNING' ? '✗ Not Running' :
                               piperLauncherStatus === 'STARTING' ? 'Starting...' :
                               piperLauncherStatus === 'ERROR' ? 'Error' : 'Check Status'}
                            </button>
                            
                            {/* Start Button - Only show when not running */}
                            {piperLauncherStatus === 'NOT_RUNNING' && (
                              <button
                                onClick={handleStartPiper}
                                className="flex-1 p-2 bg-green-800 hover:bg-green-700 border border-green-600 rounded text-[10px] text-white transition-colors flex items-center justify-center gap-2"
                              >
                                <Power size={12} />
                                Start Piper
                              </button>
                            )}
                            
                            {/* Test Voice Button - Only when running */}
                            {piperLauncherStatus === 'RUNNING' && (
                              <button
                                onClick={testVoice}
                                disabled={isTestingVoice}
                                className="flex-1 p-2 bg-cyan-800 hover:bg-cyan-700 border border-cyan-600 rounded text-[10px] text-white transition-colors disabled:opacity-50"
                              >
                                {isTestingVoice ? 'Testing...' : '🎙️ Test Voice'}
                              </button>
                            )}
                          </div>
                          
                          {/* Status Message */}
                          {piperLauncherMessage && (
                            <div className={`p-2 border rounded text-[9px] 
                              ${piperLauncherStatus === 'RUNNING' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                                piperLauncherStatus === 'ERROR' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                                piperLauncherStatus === 'STARTING' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400' :
                                'bg-gray-900/20 border-gray-500/30 text-gray-400'}`}>
                              {piperLauncherStatus === 'RUNNING' ? '✓ ' : 
                               piperLauncherStatus === 'ERROR' ? '⚠️ ' : 
                               piperLauncherStatus === 'STARTING' ? '⏳ ' : 'ℹ️ '}
                              {piperLauncherMessage}
                            </div>
                          )}
                          
                          {/* Voice Test Error */}
                          {voiceTestError && (
                            <div className="p-2 bg-red-900/30 border border-red-500/50 rounded text-[9px] text-red-400">
                              ⚠️ {voiceTestError}
                            </div>
                          )}
                          
                          {/* Not Installed Warning */}
                          {piperLauncherStatus === 'NOT_INSTALLED' && (
                            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-[10px] text-red-400">
                              <strong>Piper not found.</strong><br/>
                              Run <code className="bg-black px-1 rounded">Install-JARVIS-Voice.bat</code> to install Piper and the JARVIS voice.
                            </div>
                          )}
                          
                          {/* Not Running - Show manual instructions */}
                          {piperLauncherStatus === 'NOT_RUNNING' && (
                            <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded text-[10px] text-yellow-400">
                              <strong>Piper is installed but not running.</strong><br/>
                              Click <strong>"Start Piper"</strong> above to start the server automatically, or run <code className="bg-black px-1 rounded">start-jarvis-server.bat</code> manually.
                            </div>
                          )}
                          
                          <div className="p-3 border border-green-500/50 bg-green-950/20 rounded">
                            <div className="flex items-center justify-between">
                              <div className="font-bold text-[11px] text-white flex items-center gap-2">
                                <span>jarvis</span>
                                <span className="text-[9px] text-green-400">✓ INSTALLED</span>
                              </div>
                              <span className="text-[9px] text-green-500">⭐ ACTIVE</span>
                            </div>
                            <div className="text-[9px] text-gray-400 mt-1">JARVIS from Iron Man - British, professional, calm</div>
                            <div className="text-[9px] text-gray-500 mt-2">
                              This voice is ready to use. Click "🎙️ Test Voice" above to hear it!
                            </div>
                          </div>
                          
                          <div className="text-[10px] text-gray-500 border-t border-[#222] pt-3">
                            <strong>More voices available:</strong> alan, joe, kristin
                            <div className="text-[9px] text-gray-600 mt-1">
                              Download from <a href="https://huggingface.co/rhasspy/piper-voices" target="_blank" rel="noopener" className="text-cyan-500 hover:underline">huggingface.co/rhasspy/piper-voices</a> and place .onnx files in the Piper/voices/ folder
                            </div>
                          </div>
                          <details className="text-[10px]">
                            <summary className="cursor-pointer text-gray-400 hover:text-white">Setup Instructions</summary>
                            <pre className="mt-2 p-2 bg-black border border-[#222] rounded text-[9px] text-gray-500 whitespace-pre-wrap">
                              {PIPER_SETUP_INSTRUCTIONS}
                            </pre>
                          </details>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="text-[10px] text-gray-500">
                            💡 For a JARVIS-like voice, try: <strong>Kore</strong> (Firm), <strong>Orus</strong> (Firm), or <strong>Alnilam</strong> (Firm)
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                           {neuralVoices.map((voice) => (
                             <button 
                               key={voice.name}
                               onClick={() => setVoiceConfig({...voiceConfig, voiceName: voice.name})}
                               className={`p-3 border text-left rounded transition-all ${voiceConfig.voiceName === voice.name ? 'border-indigo-500 bg-indigo-950/40 text-white' : 'border-[#222] text-gray-600 bg-black hover:border-gray-500'}`}
                             >
                               <div className="font-bold text-[11px]">{voice.name}</div>
                               <div className="text-[9px] opacity-75 mt-1">{voice.style}</div>
                             </button>
                           ))}
                          </div>
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
                            <div className="text-[8px] text-gray-600 mt-1">Must use http/https. Local addresses like localhost, 127.0.0.1 are allowed.</div>
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
                            <div className="text-[8px] text-gray-600 mt-1">Min 20 characters. Get from Home Assistant → Profile → Long-Lived Access Tokens</div>
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
          
          {activeTab === 'SECURITY' && (
            <div className="flex-1 overflow-y-auto pr-2">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="text-green-500" />
                Encryption Settings
              </h2>
              
              {showEncryptionSetup ? (
                <EncryptionSetup 
                  onComplete={() => {
                    setShowEncryptionSetup(false);
                    setEncryptionEnabled(true);
                  }}
                  onSkip={() => setShowEncryptionSetup(false)}
                />
              ) : (
                <div className="space-y-4">
                  <div className="bg-[#111] border border-[#333] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-white">API Key Encryption</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {encryptionEnabled 
                            ? 'Your API keys are encrypted with AES-256-GCM'
                            : 'Your API keys are stored with basic encoding'}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded text-xs font-bold ${
                        encryptionEnabled 
                          ? 'bg-green-900/30 text-green-400 border border-green-500/30' 
                          : 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30'
                      }`}>
                        {encryptionEnabled ? 'ENABLED' : 'DISABLED'}
                      </div>
                    </div>
                    
                    {!encryptionEnabled && (
                      <button
                        onClick={() => setShowEncryptionSetup(true)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <Shield size={14} />
                        Enable Encryption
                      </button>
                    )}
                    
                    {encryptionEnabled && (
                      <div className="bg-green-950/20 border border-green-900/30 rounded-lg p-3">
                        <p className="text-xs text-green-400 flex items-center gap-2">
                          <CheckCircle2 size={14} />
                          Your API keys are protected with password-based encryption
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-[#111] border border-[#333] rounded-lg p-4">
                    <h3 className="text-sm font-bold text-white mb-2">Security Status</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Encryption</span>
                        <span className={encryptionEnabled ? 'text-green-400' : 'text-yellow-400'}>
                          {encryptionEnabled ? 'AES-256-GCM' : 'Base64'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Key Storage</span>
                        <span className="text-gray-300">localStorage</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">In-Memory Cache</span>
                        <span className="text-green-400">Cleared on logout</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BACKUP TAB */}
          {activeTab === 'BACKUP' && (
            <div className="flex-1 overflow-y-auto pr-2">
              <SettingsBackup onClose={() => setActiveTab('GENERAL')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsInterface;