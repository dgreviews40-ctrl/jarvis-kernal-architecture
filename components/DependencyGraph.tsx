import React, { useEffect, useState } from 'react';
import { graphService } from '../services/graph';
import { registry } from '../services/registry';
import { GraphNode, GraphEdge, RuntimePlugin } from '../types';
import { GitMerge, ArrowRight, AlertTriangle, PlayCircle, PauseCircle } from 'lucide-react';

export const DependencyGraph: React.FC = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [plugins, setPlugins] = useState<RuntimePlugin[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    // Note: graphService.rebuild() is called in App.tsx on system ready
    // We just need to refresh our local state here

    const refresh = () => {
      const data = graphService.getGraphData();
      setNodes([...data.nodes]);
      setEdges([...data.edges]);
      setPlugins([...registry.getAll()]);
    };

    refresh();

    // Subscribe to registry updates (which trigger graph updates logic in App.tsx)
    const unsub = registry.subscribe(() => {
        // We delay slightly to allow graphService to have processed the update
        setTimeout(refresh, 50);
    });
    return unsub;
  }, []);

  const getPlugin = (id: string) => plugins.find(p => p.manifest.id === id);

  const getStatusColor = (status: RuntimePlugin['status']) => {
    switch(status) {
        case 'ACTIVE': return 'border-cyan-500 bg-cyan-950/30 text-white';
        case 'DISABLED': return 'border-gray-600 bg-gray-900/50 text-gray-500 opacity-50';
        case 'PAUSED_DEPENDENCY': return 'border-yellow-500 bg-yellow-950/30 text-yellow-500 dashed-border';
        case 'ERROR': return 'border-red-500 bg-red-950/30 text-red-500';
    }
  };

  // Group by Layer
  const layers: GraphNode[][] = [];
  nodes.forEach(node => {
      if (!layers[node.layer]) layers[node.layer] = [];
      layers[node.layer].push(node);
  });

  return (
    <div className="h-full bg-[#0d0d0d] flex flex-col overflow-hidden font-mono">
      {/* Header */}
      <div className="p-4 border-b border-[#333] bg-[#111] flex justify-between items-center">
        <h2 className="font-bold text-gray-300 flex items-center gap-2">
            <GitMerge className="text-purple-500" />
            DEPENDENCY GRAPH (DAG)
        </h2>
        <div className="text-xs flex gap-4 text-gray-500">
           <div className="flex items-center gap-1"><div className="w-2 h-2 bg-cyan-500 rounded-full"></div> ACTIVE</div>
           <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded-full"></div> PAUSED (CHAIN REACTION)</div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* GRAPH CANVAS */}
        <div className="flex-1 overflow-auto p-8 relative custom-scrollbar">
           <div className="flex gap-16 min-w-max">
               {layers.map((layerNodes, layerIndex) => (
                   <div key={layerIndex} className="flex flex-col gap-6 justify-center z-10">
                       <div className="text-center text-[10px] text-gray-600 uppercase mb-2 tracking-widest border-b border-[#222]">
                           {layerIndex === 0 ? "Core Drivers" : `Layer ${layerIndex}`}
                       </div>
                       
                       {layerNodes.map(node => {
                           const plugin = getPlugin(node.pluginId);
                           const isSelected = selectedNode === node.pluginId;
                           if (!plugin) return null;

                           return (
                               <div 
                                 key={node.pluginId}
                                 onClick={() => setSelectedNode(node.pluginId)}
                                 className={`
                                   w-48 p-3 rounded border transition-all cursor-pointer relative
                                   ${getStatusColor(plugin.status)}
                                   ${isSelected ? 'ring-2 ring-white scale-105 z-20 shadow-lg bg-black' : ''}
                                 `}
                               >
                                  <div className="font-bold text-xs truncate">{plugin.manifest.name}</div>
                                  <div className="text-[9px] opacity-70 truncate">{node.pluginId}</div>
                                  
                                  {/* Connectors (Visual Only) */}
                                  {layerIndex > 0 && (
                                     <div className="absolute top-1/2 -left-3 w-3 h-[1px] bg-gray-700"></div>
                                  )}
                                  {layerIndex < layers.length - 1 && (
                                     <div className="absolute top-1/2 -right-3 w-3 h-[1px] bg-gray-700"></div>
                                  )}

                                  {plugin.status === 'PAUSED_DEPENDENCY' && (
                                      <div className="absolute -top-2 -right-2 bg-yellow-900 text-yellow-200 text-[9px] px-1 rounded border border-yellow-700 flex items-center gap-1">
                                          <AlertTriangle size={8} /> HALTED
                                      </div>
                                  )}
                               </div>
                           );
                       })}
                   </div>
               ))}
           </div>
           
           {/* SVG Lines Overlay (Simplified for React without D3) */}
           {/* In a real production app, we would calculate coordinates. 
               Here we rely on the flex layout structure to imply flow. */}
        </div>

        {/* INSPECTOR SIDEBAR */}
        <div className="w-80 border-l border-[#333] bg-[#0a0a0a] flex flex-col">
            {selectedNode ? (
                <Inspector pluginId={selectedNode} plugins={plugins} edges={edges} />
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 text-xs italic">
                    Select a node to inspect dependencies
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

const Inspector: React.FC<{ pluginId: string, plugins: RuntimePlugin[], edges: GraphEdge[] }> = ({ pluginId, plugins, edges }) => {
    const plugin = plugins.find(p => p.manifest.id === pluginId);
    if (!plugin) return null;

    const providers = edges.filter(e => e.to === pluginId);
    const consumers = edges.filter(e => e.from === pluginId);

    return (
        <div className="p-4 flex flex-col h-full">
            <h3 className="font-bold text-lg text-white mb-1">{plugin.manifest.name}</h3>
            <div className="text-xs text-cyan-500 font-mono mb-4">{pluginId}</div>

            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                
                {/* STATUS */}
                <div className="bg-[#111] p-2 rounded border border-[#333]">
                    <div className="text-[10px] text-gray-500 uppercase">Status</div>
                    <div className="font-bold text-sm flex items-center gap-2">
                        {plugin.status === 'ACTIVE' ? <PlayCircle size={14} className="text-green-500" /> : <PauseCircle size={14} className="text-yellow-500" />}
                        {plugin.status}
                    </div>
                </div>

                {/* PROVIDES */}
                <div>
                    <div className="text-[10px] text-gray-500 uppercase mb-2 border-b border-[#222]">Provides Capability</div>
                    <div className="flex flex-wrap gap-2">
                        {plugin.manifest.provides.length === 0 && <span className="text-xs text-gray-600 italic">None</span>}
                        {plugin.manifest.provides.map(cap => (
                            <span key={cap} className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-800">
                                {cap}
                            </span>
                        ))}
                    </div>
                </div>

                {/* UPSTREAM (Dependencies) */}
                <div>
                    <div className="text-[10px] text-gray-500 uppercase mb-2 border-b border-[#222]">Upstream (Requires)</div>
                    {providers.length === 0 && <span className="text-xs text-gray-600 italic">Root Node</span>}
                    <div className="space-y-2">
                        {providers.map((edge, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs bg-[#151515] p-2 rounded">
                                <div className="w-1 h-full bg-blue-500 rounded"></div>
                                <div className="flex-1">
                                    <div className="text-gray-300">{edge.capability}</div>
                                    <div className="text-[10px] text-gray-500">via {edge.from}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* DOWNSTREAM (Dependents) */}
                <div>
                    <div className="text-[10px] text-gray-500 uppercase mb-2 border-b border-[#222]">Downstream (Impacts)</div>
                    {consumers.length === 0 && <span className="text-xs text-gray-600 italic">Leaf Node</span>}
                    <div className="space-y-2">
                        {consumers.map((edge, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs bg-[#151515] p-2 rounded">
                                <div className="w-1 h-full bg-orange-500 rounded"></div>
                                <div className="flex-1">
                                    <div className="text-gray-300">{edge.capability}</div>
                                    <div className="text-[10px] text-gray-500">used by {edge.to}</div>
                                </div>
                                <ArrowRight size={12} className="text-gray-600" />
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DependencyGraph;