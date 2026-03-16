import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Shield, Zap, Terminal, Cpu, Globe, ArrowRight, Github, Book } from 'lucide-react';
import Docs from './components/Docs';

const App = () => {
  const [view, setView] = useState<'landing' | 'docs'>('landing');
  const heroRef = useRef(null);
  const featureRef = useRef(null);

  useEffect(() => {
    if (view !== 'landing') return;

    const ctx = gsap.context(() => {
      gsap.from('.hero-content', { 
        y: 30, 
        opacity: 0, 
        duration: 1, 
        stagger: 0.2, 
        ease: 'power3.out' 
      });
      
      gsap.from('.feature-card', {
        scrollTrigger: {
          trigger: featureRef.current,
          start: 'top 80%',
        },
        y: 20,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power2.out'
      });
    }, heroRef);

    return () => ctx.revert();
  }, [view]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
          <Zap className="w-6 h-6 fill-white" />
          <span className="font-bold tracking-tighter text-xl">ZERVOX</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <button onClick={() => setView('landing')} className={`hover:text-white transition-colors ${view === 'landing' ? 'text-white' : ''}`}>Features</button>
          <button onClick={() => setView('docs')} className={`hover:text-white transition-colors ${view === 'docs' ? 'text-white' : ''}`}>Docs</button>
          <a href="https://github.com/ziuus/Zervox" target="_blank" className="hover:text-white transition-colors">GitHub</a>
        </div>
        <button 
          onClick={() => setView('docs')}
          className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-slate-200 transition-colors">
          Get Started
        </button>
      </nav>

      {view === 'landing' ? (
        <>
          {/* Hero Section */}
          <section ref={heroRef} className="relative pt-40 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
            {/* Aurora Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-white/5 blur-[120px] rounded-full -z-10" />
        
        <div className="hero-content inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-slate-400 mb-8">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          v1.0.0 Stable Release Available
        </div>
        
        <h1 className="hero-content text-6xl md:text-8xl font-black tracking-tight mb-8 leading-[0.9]">
          Autonomous SRE.<br />
          <span className="text-slate-500">Unmatched Scale.</span>
        </h1>
        
        <p className="hero-content text-slate-400 text-lg md:text-xl max-w-2xl mb-12">
          Zervox is a next-generation SRE daemon that detects crashes, analyzes root causes with Gemini AI, and executes fixes autonomously.
        </p>
        
        <div className="hero-content flex flex-col md:flex-row gap-4">
          <button className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-95">
            Deploy Now <ArrowRight className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 border border-white/10 bg-white/5 px-8 py-3 rounded-xl font-bold hover:bg-white/10 transition-all active:scale-95">
            Read Docs <Book className="w-5 h-5" />
          </button>
        </div>

        {/* 3D Scene Placeholder */}
        <div className="hero-content mt-20 w-full max-w-4xl h-[400px] rounded-2xl glass border border-white/5 overflow-hidden flex items-center justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="text-slate-600 flex flex-col items-center gap-4">
            <Cpu className="w-16 h-16 animate-float" />
            <span className="text-sm font-mono tracking-widest uppercase">3D Visualization Engine</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" ref={featureRef} className="py-24 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-bold mb-16 tracking-tight">Built for Resilience.</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<Zap className="w-6 h-6 text-yellow-400" />}
            title="Auto-Fix Loop"
            description="Autonomous crash detection and AI-powered repair cycles that heal your apps in seconds."
          />
          <FeatureCard 
            icon={<Globe className="w-6 h-6 text-blue-400" />}
            title="Global Daemon"
            description="Manage a swarm of processes across multiple environments with a single unified interface."
          />
          <FeatureCard 
            icon={<Terminal className="w-6 h-6 text-green-400" />}
            title="Visual Insights"
            description="Minimalist dashboard designed for high cognitive fluency and rapid incident response."
          />
        </div>
      </section>

      {/* Docs Preview Section */}
      <section id="docs" className="py-24 px-6 border-t border-white/5 bg-surface">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-6 tracking-tight text-white">Advanced Documentation.</h2>
            <p className="text-slate-400 mb-8 text-lg">
              Comprehensive guides on setting up autonomous agents, fine-tuning repair strategies, and scaling your SRE operations.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <Shield className="w-5 h-5 text-indigo-400" />
                <span>Security-first execution environment</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Cpu className="w-5 h-5 text-purple-400" />
                <span>Native Gemini AI Integration</span>
              </div>
            </div>
            <button className="mt-12 text-white border-b border-white hover:opacity-70 transition-opacity pb-1">
              Explore the Knowledge Base →
            </button>
          </div>
          <div className="glass p-8 rounded-2xl border border-white/5 font-mono text-xs text-slate-500">
             <div className="flex gap-1.5 mb-6">
               <div className="w-3 h-3 rounded-full bg-red-500/20" />
               <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
               <div className="w-3 h-3 rounded-full bg-green-500/20" />
             </div>
             <div className="text-white mb-2">$ zervox start server.js --auto-fix</div>
             <div className="text-blue-400">[INFO] Zervox Daemon initialized on port 4040</div>
             <div className="text-yellow-400">[WARN] Process crash detected. Requesting AI analysis...</div>
             <div className="text-green-400 font-bold">[AUTO-FIX] Solution found: 'npm install express'</div>
             <div className="text-slate-500 italic mt-4">// Zervox is now monitoring in the background.</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center text-slate-600 text-sm">
        <div className="flex justify-center gap-6 mb-6">
           <Github className="w-5 h-5 hover:text-white transition-colors cursor-pointer" />
           <Zap className="w-5 h-5 hover:text-white transition-colors cursor-pointer" />
        </div>
        <p>&copy; 2026 Zervox Systems. Build for tomorrow, fix for today.</p>
      </footer>
    </>
  ) : (
    <Docs />
  )}
</div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="feature-card p-8 rounded-2xl glass hover:border-white/20 transition-all group">
    <div className="mb-6 bg-white/5 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3 tracking-tight group-hover:text-white transition-colors">{title}</h3>
    <p className="text-slate-500 leading-relaxed text-sm">{description}</p>
  </div>
);

export default App;
