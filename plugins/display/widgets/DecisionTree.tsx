import React, { FC, useState } from 'react';

interface DecisionNode {
  id: string;
  text: string;
  options?: DecisionOption[];
  result?: string;
}

interface DecisionOption {
  text: string;
  nextNodeId?: string;
  action?: () => void;
}

interface DecisionTreeProps {
  title: string;
  initialNode: DecisionNode;
  nodes: Record<string, DecisionNode>;
}

export const DecisionTree: FC<DecisionTreeProps> = ({ title, initialNode, nodes }) => {
  const [currentNode, setCurrentNode] = useState<DecisionNode>(initialNode);
  const [history, setHistory] = useState<DecisionNode[]>([initialNode]);

  const handleOptionSelect = (option: DecisionOption) => {
    if (option.action) {
      option.action();
    }

    if (option.nextNodeId) {
      const nextNode = nodes[option.nextNodeId];
      if (nextNode) {
        setCurrentNode(nextNode);
        setHistory([...history, nextNode]);
      }
    }
  };

  const handleBack = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setCurrentNode(newHistory[newHistory.length - 1]);
    }
  };

  return (
    <div className="bg-gray-800 border border-cyan-700 rounded-lg p-4 w-full max-w-md">
      <h3 className="text-lg font-bold text-cyan-400 mb-4">{title}</h3>
      
      {currentNode.result ? (
        <div className="text-center py-8">
          <div className="text-xl font-bold text-green-400 mb-4">Result</div>
          <div className="text-gray-300 mb-6">{currentNode.result}</div>
          <button
            onClick={() => {
              setCurrentNode(initialNode);
              setHistory([initialNode]);
            }}
            className="bg-cyan-700 hover:bg-cyan-600 text-white py-2 px-4 rounded"
          >
            Start Over
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 p-4 bg-gray-900 rounded-lg">
            <p className="text-gray-200">{currentNode.text}</p>
          </div>
          
          {currentNode.options && currentNode.options.length > 0 && (
            <div className="space-y-3 mb-6">
              {currentNode.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
                  className="w-full text-left p-3 bg-gray-700 hover:bg-cyan-700 text-gray-200 hover:text-white rounded transition-colors"
                >
                  {option.text}
                </button>
              ))}
            </div>
          )}
          
          {history.length > 1 && (
            <button
              onClick={handleBack}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded"
            >
              Back
            </button>
          )}
        </>
      )}
    </div>
  );
};