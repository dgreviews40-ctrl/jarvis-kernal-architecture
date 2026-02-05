import React, { FC } from 'react';

interface ResourcePreviewProps {
  title: string;
  description: string;
  type: 'article' | 'video' | 'document' | 'tool' | 'tutorial';
  url?: string;
  thumbnail?: string;
  duration?: string; // For videos
  tags?: string[];
  onPreview?: () => void;
  onAccess?: () => void;
}

export const ResourcePreview: FC<ResourcePreviewProps> = ({ 
  title, 
  description, 
  type, 
  url, 
  thumbnail, 
  duration, 
  tags = [], 
  onPreview, 
  onAccess 
}) => {
  const getTypeIcon = () => {
    switch (type) {
      case 'video':
        return '▶';
      case 'document':
        return '📄';
      case 'tutorial':
        return '🎓';
      case 'tool':
        return '🛠️';
      default:
        return '📖';
    }
  };

  return (
    <div className="bg-gray-800 border border-cyan-700 rounded-lg p-4 w-full max-w-md">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{getTypeIcon()}</div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-bold text-cyan-400">{title}</h3>
            {duration && (
              <span className="text-xs bg-cyan-900 text-cyan-300 px-2 py-1 rounded">
                {duration}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 mt-1">{description}</p>
          
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag, index) => (
                <span 
                  key={index} 
                  className="text-xs bg-gray-700 text-cyan-300 px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 mt-3">
            {onPreview && (
              <button 
                onClick={onPreview}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded"
              >
                Preview
              </button>
            )}
            {onAccess && (
              <button 
                onClick={onAccess}
                className="text-xs bg-cyan-700 hover:bg-cyan-600 text-white py-1 px-2 rounded"
              >
                Access
              </button>
            )}
            {url && (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded"
              >
                Open
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};