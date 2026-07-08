import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useCallback, createContext } from 'react';
import Sidebar from './components/Sidebar';
import SessionList from './components/SessionList';
import ConversationView from './components/ConversationView';
import GlobalSearch from './components/GlobalSearch';
import Dashboard from './components/Dashboard';
import { useTheme } from './hooks/useTheme';

export const SearchContext = createContext<() => void>(() => {});

function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setSearchOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <SearchContext.Provider value={() => setSearchOpen(true)}>
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--fg)' }}>
        <Sidebar theme={theme} onToggleTheme={toggleTheme} />
        <main style={{ flex: 1, overflow: 'hidden' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/sessions" element={<SessionList />} />
            <Route path="/sessions/:id" element={<ConversationView />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      </div>
    </BrowserRouter>
    </SearchContext.Provider>
  );
}

export default App;
