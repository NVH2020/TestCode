
import React from 'react';
import { Language } from '../types';

interface SidebarProps {
  onLanguageChange: (lang: Language) => void;
  currentLanguage: Language;
}

const languages: { label: string; value: Language; icon: string }[] = [
  { label: 'JavaScript', value: 'javascript', icon: '🟨' },
  { label: 'TypeScript', value: 'typescript', icon: '🟦' },
  { label: 'Python', value: 'python', icon: '🐍' },
  { label: 'HTML', value: 'html', icon: '🌐' },
  { label: 'CSS', value: 'css', icon: '🎨' },
  { label: 'SQL', value: 'sql', icon: '🗄️' },
  { label: 'C++', value: 'cpp', icon: '⚙️' },
];

export const Sidebar: React.FC<SidebarProps> = ({ onLanguageChange, currentLanguage }) => {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
          <span className="text-3xl">⚡</span> Testcode
        </h1>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">AI Playground</p>
      </div>

      <nav className="flex-1 px-4 py-2">
        <div className="mb-4">
          <h3 className="px-2 text-xs font-semibold text-slate-500 uppercase mb-2">Language</h3>
          <div className="space-y-1">
            {languages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => onLanguageChange(lang.value)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  currentLanguage === lang.value 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{lang.icon}</span>
                <span className="text-sm font-medium">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="px-2 text-xs font-semibold text-slate-500 uppercase mb-2">Features</h3>
          <ul className="space-y-4 px-2">
            <li className="flex gap-2 items-start text-xs text-slate-400">
              <span className="text-green-500 font-bold">✓</span>
              AI Debugging
            </li>
            <li className="flex gap-2 items-start text-xs text-slate-400">
              <span className="text-green-500 font-bold">✓</span>
              Complexity Analysis
            </li>
            <li className="flex gap-2 items-start text-xs text-slate-400">
              <span className="text-green-500 font-bold">✓</span>
              Real-time Simulation
            </li>
          </ul>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-600">
        POWERED BY GEMINI 3 PRO
      </div>
    </div>
  );
};
