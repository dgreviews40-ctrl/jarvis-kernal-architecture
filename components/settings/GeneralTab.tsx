import React, { useState } from 'react';
import { Key, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { GeneralTabProps } from './types';
import { providerManager } from '../../services/providers';
import { AIProvider } from '../../types';

export const GeneralTab: React.FC<GeneralTabProps> = ({ apiKey, setApiKey }) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      setTestStatus('error');
      setTestMessage('Please enter an API key first');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Testing connection to Gemini...');

    try {
      const geminiProvider = providerManager.getProvider(AIProvider.GEMINI);
      if (!geminiProvider) {
        throw new Error('Gemini provider not found');
      }
      
      // Test with a simple request - use correct AIRequest format
      console.log('[SETTINGS] Testing API key with Gemini...');
      const response = await geminiProvider.generate({
        prompt: 'Say "OK" if you can hear me',
        systemInstruction: 'You are a helpful assistant. Keep responses very short.'
      });

      console.log('[SETTINGS] Gemini response:', response);

      if (response.text && response.text.trim()) {
        setTestStatus('success');
        setTestMessage(`API key is valid! Response: "${response.text.trim()}"`);
      } else {
        throw new Error('Empty response from Gemini');
      }
    } catch (error) {
      console.error('[SETTINGS] API key test failed:', error);
      setTestStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('API key not valid') || errorMsg.includes('403')) {
        setTestMessage('Invalid API key. Please check your key and try again.');
      } else if (errorMsg.includes('404')) {
        setTestMessage('API error: Model not found. Try a different model.');
      } else if (errorMsg.includes('429')) {
        setTestMessage('Rate limit exceeded. Please wait a moment and try again.');
      } else {
        setTestMessage(`Connection failed: ${errorMsg}`);
      }
    }
  };

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
          <div className="flex items-center gap-4 flex-wrap">
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
            
            {apiKey && (
              <button
                onClick={testApiKey}
                disabled={testStatus === 'testing'}
                className={`text-[10px] font-bold px-3 py-2 rounded border flex items-center gap-2 transition-all ${
                  testStatus === 'success' 
                    ? 'border-green-500/50 text-green-500 bg-green-500/10' 
                    : testStatus === 'error'
                    ? 'border-red-500/50 text-red-500 bg-red-500/10'
                    : 'border-cyan-500/50 text-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20'
                }`}
              >
                {testStatus === 'testing' && <Loader2 size={12} className="animate-spin" />}
                {testStatus === 'success' && <CheckCircle2 size={12} />}
                {testStatus === 'error' && <XCircle size={12} />}
                {testStatus === 'testing' ? 'TESTING...' : 'TEST KEY'}
              </button>
            )}
          </div>
          
          {testMessage && (
            <div className={`text-[10px] font-mono p-2 rounded border ${
              testStatus === 'success' 
                ? 'border-green-900/30 text-green-400 bg-green-950/20' 
                : testStatus === 'error'
                ? 'border-red-900/30 text-red-400 bg-red-950/20'
                : 'border-cyan-900/30 text-cyan-400 bg-cyan-950/20'
            }`}>
              {testMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
