import React, { useState, useEffect } from 'react';
import Markdown from 'markdown-to-jsx';
import { ChevronRight, Home, Book, FileText, Zap, Shield, Cpu, Terminal, Globe } from 'lucide-react';

const Docs = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch based on URL params
    // For this prototype, we load the getting-started.md
    fetch('/docs/getting-started.md')
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setContent('# Error: Documentation not found.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex min-h-screen bg-black pt-20">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 h-[calc(100vh-80px)] overflow-y-auto p-6 hidden md:block">
        <div className="space-y-8">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Introduction</h4>
            <SidebarLink icon={<Home className="w-4 h-4" />} label="Overview" active />
            <SidebarLink icon={<Zap className="w-4 h-4" />} label="Quick Start" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Core Concepts</h4>
            <SidebarLink icon={<Shield className="w-4 h-4" />} label="The Daemon" />
            <SidebarLink icon={<Cpu className="w-4 h-4" />} label="AI Engine" />
            <SidebarLink icon={<Terminal className="w-4 h-4" />} label="CLI Reference" />
          </div>
          <div>
             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Advanced</h4>
             <SidebarLink icon={<FileText className="w-4 h-4" />} label="Custom Fixers" />
             <SidebarLink icon={<Globe className="w-4 h-4" />} label="Multi-Host Setup" />
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 md:p-16 max-w-4xl">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-8">
          <span>Docs</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white">Getting Started</span>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/5 rounded w-3/4" />
            <div className="h-4 bg-white/5 rounded w-1/2" />
            <div className="h-20 bg-white/5 rounded" />
          </div>
        ) : (
          <article className="prose prose-invert prose-slate max-w-none 
            prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight
            prose-p:text-slate-400 prose-code:text-indigo-400 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded
            prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl">
            <Markdown>{content}</Markdown>
          </article>
        )}
      </main>
    </div>
  );
};

const SidebarLink = ({ icon, label, active = false }) => (
  <div className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-all cursor-pointer mb-1
    ${active ? 'bg-white/10 text-white font-medium' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
    {icon}
    <span>{label}</span>
  </div>
);

export default Docs;
