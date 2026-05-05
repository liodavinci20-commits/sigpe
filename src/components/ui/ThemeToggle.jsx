import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  // Applique le thème sauvegardé au premier rendu
  useEffect(() => {
    const saved = localStorage.getItem('sigpes-theme');
    if (saved === 'dark') {
      document.body.classList.add('dark-mode');
      setIsDark(true);
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('sigpes-theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('sigpes-theme', 'light');
    }
  };

  return (
    <button
      className="theme-fab"
      onClick={toggle}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label="Basculer le thème"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};

export default ThemeToggle;
