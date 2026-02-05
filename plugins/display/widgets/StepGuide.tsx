import React, { FC, useState } from 'react';

interface StepGuideProps {
  title: string;
  steps: string[];
  onComplete?: () => void;
}

export const StepGuide: FC<StepGuideProps> = ({ title, steps, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps([...completedSteps, currentStep]);
      }
    } else if (onComplete) {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  return (
    <div className="bg-gray-800 border border-cyan-700 rounded-lg p-4 w-full max-w-md">
      <h3 className="text-lg font-bold text-cyan-400 mb-4">{title}</h3>
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-cyan-600 h-2 rounded-full" 
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>
      <div className="mb-4 p-3 bg-gray-900 rounded">
        <h4 className="font-bold text-cyan-300 mb-2">Current Step:</h4>
        <p className="text-sm">{steps[currentStep]}</p>
      </div>
      <div className="flex justify-between mb-4">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className={`px-3 py-1 rounded ${currentStep === 0 ? 'bg-gray-700 text-gray-500' : 'bg-cyan-700 hover:bg-cyan-600 text-white'}`}
        >
          Previous
        </button>
        <button
          onClick={nextStep}
          className="px-3 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded"
        >
          {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map((_, index) => (
          <button
            key={index}
            onClick={() => goToStep(index)}
            className={`py-1 rounded text-xs ${
              index === currentStep
                ? 'bg-cyan-600 text-white'
                : completedSteps.includes(index)
                ? 'bg-green-700 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
};