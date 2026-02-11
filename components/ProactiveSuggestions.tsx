/**
 * Proactive Suggestions Component
 * 
 * Phase 3, Task 2: UI Handler for proactive suggestions
 * Displays proactive check-ins, habit reminders, and contextual suggestions
 * from the proactiveEventHandler via event bus
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Heart, 
  Trophy, 
  Lightbulb, 
  X,
  Sparkles
} from 'lucide-react';
import { eventBus } from '../services/eventBus';
import { proactiveEventHandler, ProactiveSuggestion } from '../services/proactiveEventHandler';

interface ProactiveSuggestionsProps {
  maxVisible?: number;
}

interface DisplayedSuggestion extends ProactiveSuggestion {
  displayId: string;
  isExiting?: boolean;
}

export const ProactiveSuggestions: React.FC<ProactiveSuggestionsProps> = ({ 
  maxVisible = 3 
}) => {
  const [suggestions, setSuggestions] = useState<DisplayedSuggestion[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);

  // Subscribe to proactive opportunities
  useEffect(() => {
    const unsubscribe = eventBus.subscribe('proactive:opportunities_available', (event) => {
      if (!isEnabled) return;
      
      const payload = event.payload as { opportunities?: any[]; count?: number } | undefined;
      if (!payload?.opportunities) return;

      // Process opportunities through handler to get formatted suggestions
      Promise.all(
        payload.opportunities.map(async (opp, index) => {
          // Build suggestion for each opportunity
          const displayOptions = {
            showNotification: false, // We'll handle UI ourselves
            speak: false,
            requireInteraction: opp.type === 'concern',
            priority: opp.type === 'concern' ? 'high' : 'medium' as const
          };
          
          // Use the handler to build suggestion
          const suggestion = await (proactiveEventHandler as any).buildSuggestion(opp, displayOptions);
          return {
            ...suggestion,
            displayId: `${suggestion.id}_${Date.now()}_${index}`,
            isExiting: false
          };
        })
      ).then(newSuggestions => {
        setSuggestions(prev => {
          const combined = [...newSuggestions, ...prev];
          // Limit to maxVisible
          return combined.slice(0, maxVisible);
        });
      });
    });

    return unsubscribe;
  }, [isEnabled, maxVisible]);

  const handleAction = useCallback((suggestion: DisplayedSuggestion, actionIndex: number) => {
    const action = suggestion.actions[actionIndex];
    if (action) {
      action.action();
    }
    // Remove from display
    setSuggestions(prev => prev.filter(s => s.displayId !== suggestion.displayId));
  }, []);

  const handleDismiss = useCallback((displayId: string) => {
    // Mark as exiting for animation
    setSuggestions(prev => 
      prev.map(s => s.displayId === displayId ? { ...s, isExiting: true } : s)
    );
    // Remove after animation
    setTimeout(() => {
      setSuggestions(prev => prev.filter(s => s.displayId !== displayId));
    }, 300);
  }, []);

  const getIcon = (type: ProactiveSuggestion['type']) => {
    switch (type) {
      case 'concern':
        return <Heart className="w-5 h-5 text-rose-400" />;
      case 'achievement':
        return <Trophy className="w-5 h-5 text-amber-400" />;
      case 'milestone':
        return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'general':
      default:
        return <Lightbulb className="w-5 h-5 text-cyan-400" />;
    }
  };

  const getBorderColor = (type: ProactiveSuggestion['type']) => {
    switch (type) {
      case 'concern':
        return 'border-rose-500/30';
      case 'achievement':
        return 'border-amber-500/30';
      case 'milestone':
        return 'border-purple-500/30';
      case 'general':
      default:
        return 'border-cyan-500/30';
    }
  };

  const getBgGradient = (type: ProactiveSuggestion['type']) => {
    switch (type) {
      case 'concern':
        return 'from-rose-950/80 to-slate-900/90';
      case 'achievement':
        return 'from-amber-950/80 to-slate-900/90';
      case 'milestone':
        return 'from-purple-950/80 to-slate-900/90';
      case 'general':
      default:
        return 'from-cyan-950/80 to-slate-900/90';
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 max-w-sm">
      {/* Toggle button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            isEnabled 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
              : 'bg-slate-700/50 text-slate-400 border border-slate-600'
          }`}
        >
          {isEnabled ? 'Proactive: On' : 'Proactive: Off'}
        </button>
      </div>

      {suggestions.map((suggestion) => (
        <div
          key={suggestion.displayId}
          className={`
            relative overflow-hidden rounded-xl border ${getBorderColor(suggestion.type)}
            bg-gradient-to-br ${getBgGradient(suggestion.type)}
            backdrop-blur-md shadow-lg shadow-black/20
            transition-all duration-300 ease-out
            ${suggestion.isExiting ? 'opacity-0 translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100'}
          `}
        >
          {/* Header */}
          <div className="flex items-start gap-3 p-4">
            <div className="mt-0.5">
              {getIcon(suggestion.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-slate-100 mb-1">
                {suggestion.title}
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed">
                {suggestion.message}
              </p>
            </div>
            <button
              onClick={() => handleDismiss(suggestion.displayId)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Actions */}
          {suggestion.actions.length > 0 && (
            <div className="flex gap-2 px-4 pb-4">
              {suggestion.actions.slice(0, 2).map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleAction(suggestion, index)}
                  className={`
                    flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all
                    ${action.variant === 'primary'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                      : 'bg-slate-700/50 text-slate-300 border border-slate-600 hover:bg-slate-700'
                    }
                  `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        </div>
      ))}
    </div>
  );
};

export default ProactiveSuggestions;
