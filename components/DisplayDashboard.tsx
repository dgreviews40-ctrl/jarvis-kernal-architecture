import React, { useState, useEffect } from 'react';

interface DisplayDashboardProps {
  pluginId: string;
  onClose: () => void;
}

const DisplayDashboard: React.FC<DisplayDashboardProps> = ({ pluginId, onClose }) => {
  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');

  useEffect(() => {
    // Simulate loading plugin data
    setTimeout(() => {
      setStatus('active');
      setCapabilities([
        'Content Rendering',
        'Model Selection',
        'Diagram Generation',
        'Image Processing',
        'Interactive Elements',
        'Format Detection'
      ]);
      setCurrentModel('llama3');
    }, 800);
  }, []);

  const handleTestDisplay = async () => {
    try {
      // Simulate testing the display functionality
      alert('Testing display functionality...');
    } catch (error) {
      console.error('Error testing display:', error);
    }
  };

  return (
    <div className="w-full h-full bg-gray-900 text-cyan-400 font-mono p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Display Core Dashboard</h1>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {/* Status Panel */}
        <div className="bg-gray-800/50 border border-cyan-800/30 rounded-lg p-4">
          <h2 className="text-lg font-bold text-cyan-300 mb-3">Status</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Plugin:</span>
              <span className={status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Current Model:</span>
              <span className="text-white">{currentModel}</span>
            </div>
            <div className="flex justify-between">
              <span>Version:</span>
              <span className="text-white">1.0.0</span>
            </div>
          </div>
        </div>

        {/* Capabilities Panel */}
        <div className="bg-gray-800/50 border border-cyan-800/30 rounded-lg p-4">
          <h2 className="text-lg font-bold text-cyan-300 mb-3">Capabilities</h2>
          <ul className="space-y-1">
            {capabilities.map((cap, index) => (
              <li key={index} className="flex items-center">
                <span className="text-green-400 mr-2">✓</span>
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Controls Panel */}
        <div className="bg-gray-800/50 border border-cyan-800/30 rounded-lg p-4">
          <h2 className="text-lg font-bold text-cyan-300 mb-3">Controls</h2>
          <div className="space-y-3">
            <button
              onClick={handleTestDisplay}
              className="w-full bg-cyan-700 hover:bg-cyan-600 text-white py-2 px-4 rounded transition-colors"
            >
              Test Display
            </button>
            <button
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              Refresh Models
            </button>
            <button
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 bg-gray-800/50 border border-cyan-800/30 rounded-lg p-4">
        <h2 className="text-lg font-bold text-cyan-300 mb-2">About Display Core</h2>
        <p className="text-sm text-gray-300">
          The Display Core plugin provides advanced content rendering capabilities for JARVIS.
          It intelligently selects the appropriate AI model for different content types and
          renders diagrams, images, documentation, and interactive elements with security and performance in mind.
        </p>
      </div>
    </div>
  );
};

export default DisplayDashboard;