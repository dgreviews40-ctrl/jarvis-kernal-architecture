import React, { useState } from 'react';
import { Lock, Unlock, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiKeyManager } from '../services/apiKeyManager';

interface EncryptionSetupProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const EncryptionSetup: React.FC<EncryptionSetupProps> = ({ onComplete, onSkip }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'intro' | 'setup'>('intro');

  const handleInitialize = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await apiKeyManager.initialize(password);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize encryption');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'intro') {
    return (
      <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="text-green-500" size={28} />
          <h2 className="text-xl font-bold text-white">Secure Your API Keys</h2>
        </div>
        
        <p className="text-gray-400 text-sm mb-4">
          JARVIS can encrypt your API keys using AES-GCM encryption. 
          This adds an extra layer of security to protect your keys from 
          unauthorized access.
        </p>
        
        <div className="bg-[#111] border border-[#333] rounded-lg p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" />
            Benefits
          </h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• AES-256-GCM encryption</li>
            <li>• Password-protected keys</li>
            <li>• Protection from XSS attacks</li>
            <li>• Automatic key migration</li>
          </ul>
        </div>
        
        <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-yellow-400 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              If you forget your password, your encrypted API keys cannot be recovered. 
              Make sure to store your password safely.
            </span>
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setStep('setup')}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Lock size={14} />
            Enable Encryption
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 border border-[#333] text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Lock className="text-green-500" size={28} />
        <h2 className="text-xl font-bold text-white">Set Encryption Password</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password (min 8 chars)"
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
          />
        </div>
        
        {error && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3">
            <p className="text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </p>
          </div>
        )}
        
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleInitialize}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Shield size={14} />
                Initialize Encryption
              </>
            )}
          </button>
          <button
            onClick={() => setStep('intro')}
            disabled={isLoading}
            className="px-4 py-2 border border-[#333] text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default EncryptionSetup;
