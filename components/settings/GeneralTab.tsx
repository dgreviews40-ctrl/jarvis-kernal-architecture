import React from 'react';
import { Key, CheckCircle2, XCircle } from 'lucide-react';
import { GeneralTabProps } from './types';

export const GeneralTab: React.FC<GeneralTabProps> = ({ apiKey, setApiKey }) => {
  return (
    <div className="space-y-6">
      <div className="p-5 border border-cyan-900/20 rounded-lg bg-[#0a0a0a]">
        <h3 className="font-bold text-cyan-500 mb-4 flex items-center gap-2 text-xs uppercase tracking-widest">
          <Key size={14} /> Gemini API Configuration
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block tracking-tight">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Gemini API key here..."
              className="w-full bg-black border border-cyan-900/30 rounded px-3 py-2 text-sm text-cyan-400 font-mono focus:border-cyan-500 outline-none transition-all"
            />
            <div className="text-[9px] text-gray-600 mt-2 font-mono">
              Get your API key from:{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-500 hover:underline"
              >
                https://aistudio.google.com/app/apikey
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`text-[10px] font-bold px-3 py-2 rounded border flex items-center gap-2 ${
                apiKey
                  ? "border-green-500/50 text-green-500 bg-green-500/10"
                  : "border-red-500/50 text-red-500 bg-red-500/10"
              }`}
            >
              {apiKey ? (
                <>
                  <CheckCircle2 size={12} /> API_KEY_DETECTED
                </>
              ) : (
                <>
                  <XCircle size={12} /> NO_KEY_CONFIGURED
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
