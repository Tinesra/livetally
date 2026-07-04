import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Strand, Section, Position, Candidate, SectionTally, AuditLogEntry } from './types';
import LiveDashboard from './components/LiveDashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Vote, Shield, LogOut, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function AppContent() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [strands, setStrands] = useState<Strand[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tallies, setTallies] = useState<SectionTally[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time Firestore Listeners
    const unsubStrands = onSnapshot(collection(db, 'strands'), (snapshot) => {
      setStrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Strand)));
    });
    const unsubSections = onSnapshot(collection(db, 'sections'), (snapshot) => {
      setSections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Section)));
    });
    const unsubPositions = onSnapshot(query(collection(db, 'positions'), orderBy('order')), (snapshot) => {
      setPositions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Position)));
    });
    const unsubCandidates = onSnapshot(collection(db, 'candidates'), (snapshot) => {
      setCandidates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Candidate)));
    });
    const unsubTallies = onSnapshot(collection(db, 'tallies'), (snapshot) => {
      setTallies(snapshot.docs.map(doc => doc.data() as SectionTally));
    });
    const unsubLogs = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc')), (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLogEntry)));
      setLoading(false);
    });

    return () => {
      unsubStrands();
      unsubSections();
      unsubPositions();
      unsubCandidates();
      unsubTallies();
      unsubLogs();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-navy/10 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
            <Vote className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-navy" />
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-navy uppercase tracking-[0.2em] mb-1">COMELEC LIVE</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Establishing Secure Stream...</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't show header/footer on login page
  const isLoginPage = location.pathname === '/auth-portal';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {!isLoginPage && (
        <header className="sticky top-0 z-40 bg-navy text-white px-4 sm:px-6 py-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="p-2 bg-gold text-navy rounded-xl shadow-lg group-hover:scale-105 transition-transform">
                <Vote className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight leading-none">COMELEC</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Live Tally Aggregate</span>
                  <span className="w-1 h-1 rounded-full bg-gold/50"></span>
                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">v2.0</span>
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-6">
              <nav className="hidden md:flex items-center gap-8">
                <Link to="/" className={`text-xs font-bold uppercase tracking-widest transition-colors ${location.pathname === '/' ? 'text-gold' : 'text-white/70 hover:text-white'}`}>
                  Live Stream
                </Link>
                {user && (
                  <Link to="/admin" className={`text-xs font-bold uppercase tracking-widest transition-colors ${location.pathname === '/admin' ? 'text-gold' : 'text-white/70 hover:text-white'}`}>
                    Admin Portal
                  </Link>
                )}
              </nav>

              <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                {user ? (
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block text-right">
                      <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Active Session</p>
                      <p className="text-[11px] font-black text-white uppercase">{user.username}</p>
                    </div>
                    <button 
                      onClick={logout} 
                      className="p-2.5 bg-white/5 hover:bg-white/10 text-gold rounded-xl transition-all"
                      title="Sign Out"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={`flex-1 ${!isLoginPage ? 'max-w-7xl w-full mx-auto px-4 sm:px-6 py-8' : ''}`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LiveDashboard 
                  strands={strands}
                  sections={sections}
                  positions={positions}
                  candidates={candidates}
                  tallies={tallies}
                />
              </motion.div>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AdminDashboard 
                    strands={strands}
                    sections={sections}
                    positions={positions}
                    candidates={candidates}
                    tallies={tallies}
                    auditLogs={auditLogs}
                  />
                </motion.div>
              </ProtectedRoute>
            } />
            <Route path="/auth-portal" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      {!isLoginPage && (
        <footer className="bg-white border-t border-slate-200 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-slate-50 rounded-lg">
                <Shield className="w-5 h-5 text-navy" />
              </div>
              <div>
                <p className="text-[10px] font-black text-navy uppercase tracking-[0.2em]">COMELEC Election Aggregate</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">&copy; 2026 SHS COMELEC</p>
              </div>
            </div>

            <div className="flex items-center gap-8 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                Firestore Live
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                Secure AES-256
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
