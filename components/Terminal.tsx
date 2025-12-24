
import React from 'react';

interface TerminalProps {
  output: string[];
  isAnalysing: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({ output, isAnalysing }) => {
  return (
    <div className="flex flex-col bg-slate-950 h-full border-t border-slate-800">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Terminal Output
        </span>
        <button 
          onClick={() => {}} 
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto code-font text-sm">
        {isAnalysing ? (
          <div className="flex items-center gap-2 text-blue-400">
            <span className="animate-spin text-lg">⚙️</span>
            <span>AI is analyzing your code...</span>
          </div>
        ) : output.length === 0 ? (
          <span className="text-slate-700 italic">No output yet. Click "Run" or "Analyze" to start.</span>
        ) : (
          output.map((line, i) => (
            <div key={i} className="mb-1">
              <span className="text-slate-500 mr-2 select-none">[{i+1}]</span>
              <span className={line.startsWith('Error:') ? 'text-red-400' : 'text-slate-300'}>
                {line}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
