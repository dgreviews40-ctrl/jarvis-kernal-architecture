
import React from 'react';
import { FileText, CheckCircle, Circle, Shield, GitBranch, Terminal, Activity, Monitor } from 'lucide-react';

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="mb-8 animate-fadeIn">
    <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2 mb-4 pb-2 border-b border-[#333]">
      {icon} {title}
    </h3>
    {children}
  </div>
);

export const SystemDocs: React.FC = () => {
  return (
    <div className="space-y-6 text-gray-300 font-mono text-sm">
      
      {/* 1. ARCHITECTURE DIAGRAM */}
      <Section title="SYSTEM ARCHITECTURE v1.3" icon={<GitBranch size={18} />}>
        <div className="bg-[#050505] p-4 rounded border border-[#333] overflow-x-auto">
          <pre className="text-xs leading-relaxed text-green-400/80 font-mono whitespace-pre">
{`
[USER INPUT] 
(Voice/Text/Vision)
      |
      v
[INGESTION LAYER] ----> [SYSTEM MONITOR] (Hardware Metrics)
      |
      v
[INTENT PARSER] <-----> [GEMINI FLASH / OLLAMA]
      |
      v
[SECURITY POLICY] (Permissions Check)
      |
      v
[ROUTER] (Complexity Analysis)
   /      \\
(Cloud)  (Local)
[GEMINI] [OLLAMA]
   \\      /
    v    v
[EXECUTION ENGINE] <--- [CIRCUIT BREAKERS]
   /      |       \\
  v       v        v
[MEMORY] [PLUGINS] [SYNTHESIS]
(Vector) (HA/API)  (TTS/UI)
`}
          </pre>
        </div>
      </Section>

      {/* 2. NATIVE INSTALLATION */}
      <Section title="NATIVE INSTALLATION" icon={<Monitor size={18} />}>
        <div className="bg-[#0a0a0a] p-5 rounded border border-cyan-900/30 space-y-4">
           <div className="text-white font-bold text-sm uppercase">Installation Protocol</div>
           <ol className="space-y-3 list-decimal pl-5">
              <li>Navigate to the <strong className="text-cyan-500">DISTRIBUTION</strong> tab in Settings.</li>
              <li>
                  Option A: Click <strong className="text-cyan-500">DOWNLOAD LAUNCHER</strong> to get a Windows Batch file. 
                  Double-click this file on your desktop to launch J.A.R.V.I.S. in a dedicated window.
              </li>
              <li>
                  Option B: If supported, click <strong className="text-cyan-500">INSTALL SYSTEM NATIVELY</strong> to 
                  add the application directly to your OS applications menu via your browser's PWA engine.
              </li>
           </ol>
           <div className="p-3 bg-indigo-950/10 border border-indigo-900/20 rounded text-[10px] text-gray-400 italic">
              Note: Running in App Mode removes browser toolbars and provides a more immersive, "Iron Man" style interface.
           </div>
        </div>
      </Section>

      {/* 3. REQUEST LIFECYCLE */}
      <Section title="END-TO-END LIFECYCLE" icon={<Activity size={18} />}>
        <ul className="space-y-3 border-l border-[#333] ml-2 pl-4">
          <li className="relative">
            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-cyan-500"></span>
            <strong className="text-white">1. Signal Acquisition:</strong> Raw audio/video/text is captured via browser APIs.
          </li>
          <li className="relative">
            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-cyan-500"></span>
            <strong className="text-white">2. Normalization:</strong> Input is converted to a standard string format. Images are Base64 encoded.
          </li>
          <li className="relative">
            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-cyan-500"></span>
            <strong className="text-white">3. Classification:</strong> The Kernel analyzes intent (e.g., COMMAND vs QUERY) using Gemini Flash.
          </li>
          <li className="relative">
            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-cyan-500"></span>
            <strong className="text-white">4. Routing & Safety:</strong> Security layer validates permissions. Router selects AI provider.
          </li>
          <li className="relative">
            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-cyan-500"></span>
            <strong className="text-white">5. Execution:</strong> The Engine triggers the appropriate Plugin via a Circuit Breaker.
          </li>
          <li className="relative">
            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-cyan-500"></span>
            <strong className="text-white">6. Synthesis:</strong> Results are formatted, stored in Memory, and spoken via TTS.
          </li>
        </ul>
      </Section>

      {/* 4. ROADMAP */}
      <Section title="DEVELOPMENT ROADMAP" icon={<Terminal size={18} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#111] p-3 rounded border border-[#333]">
                <h4 className="font-bold text-white mb-2">PHASE 1: CORE (COMPLETED)</h4>
                <div className="space-y-1">
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> Kernel Orchestration</div>
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> React UI & Dashboard</div>
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> Circuit Breakers</div>
                </div>
            </div>
            <div className="bg-[#111] p-3 rounded border border-[#333]">
                <h4 className="font-bold text-white mb-2">PHASE 2: PLUGINS (COMPLETED)</h4>
                <div className="space-y-1">
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> Long-Term Memory (SQLITE Persistence)</div>
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> Home Assistant Bridge</div>
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> Vision & Voice Layers</div>
                </div>
            </div>
            <div className="bg-[#111] p-3 rounded border border-[#333]">
                <h4 className="font-bold text-cyan-400 mb-2">PHASE 3: NATIVE (IN PROGRESS)</h4>
                <div className="space-y-1 text-cyan-500/80 font-bold">
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> Progressive Web App (PWA)</div>
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> Desktop App Launcher</div>
                    <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500"/> Local Ollama Bridge</div>
                </div>
            </div>
            <div className="bg-[#111] p-3 rounded border border-[#333] opacity-75">
                <h4 className="font-bold text-gray-400 mb-2">PHASE 4: EVOLUTION (FUTURE)</h4>
                <div className="space-y-1">
                    <div className="flex items-center gap-2"><Circle size={12} className="text-gray-600"/> Self-Correction Logic</div>
                    <div className="flex items-center gap-2"><Circle size={12} className="text-gray-600"/> Automated Code Generation</div>
                </div>
            </div>
        </div>
      </Section>

      {/* 5. SECURITY */}
      <Section title="SECURITY PROTOCOLS" icon={<Shield size={18} />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <div className="bg-red-900/20 border border-red-900/50 p-2 rounded text-red-200">
                <strong>NETWORK ISOLATION</strong><br/>
                Plugins run in sandboxed contexts. HA requires explicit tokens.
            </div>
            <div className="bg-red-900/20 border border-red-900/50 p-2 rounded text-red-200">
                <strong>SECURE KEYCHAIN</strong><br/>
                API Keys never stored in LocalStorage. Encrypted manifest used for backups.
            </div>
            <div className="bg-red-900/20 border border-red-900/50 p-2 rounded text-red-200">
                <strong>CIRCUIT BREAKERS</strong><br/>
                Prevents cascading failures from rogue plugins.
            </div>
        </div>
      </Section>

    </div>
  );
};
