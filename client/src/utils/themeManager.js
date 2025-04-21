// Theme management utility

// Theme CSS variables
const themes = {
  light: {
    '--bg-primary': '#f8f9fa',
    '--bg-secondary': '#e9ecef',
    '--bg-tertiary': '#dee2e6',
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#2d2d2d',
    '--text-dim': '#4a4a4a',
    '--border-color': '#c5c5c5',
    '--accent-primary': '#ff6600',
    '--accent-hover': '#ff8533',
    '--accent-dim': '#cc5200',
    '--grid-line': 'rgba(0, 0, 0, 0.12)',
    '--panel-bg': 'rgba(248, 249, 250, 0.95)',
    '--input-bg': '#ffffff',
    '--card-bg': '#ffffff',
    '--card-border': '#d1d5db',
    '--error-bg': '#fef2f2',
    '--error-text': '#991b1b',
    '--success-bg': '#f0fdf4',
    '--success-text': '#166534'
  },
  dark: {
    '--bg-primary': '#121212',
    '--bg-secondary': '#1e1e1e',
    '--bg-tertiary': '#2d2d2d',
    '--text-primary': '#e0e0e0',
    '--text-secondary': '#b0b0b0',
    '--text-dim': '#707070',
    '--border-color': '#333333',
    '--accent-primary': '#ff6600',
    '--accent-hover': '#ff8533',
    '--accent-dim': '#cc5200',
    '--grid-line': 'rgba(255, 102, 0, 0.1)',
    '--panel-bg': 'rgba(30, 30, 30, 0.8)',
    '--input-bg': '#000000',
    '--card-bg': '#1e1e1e',
    '--card-border': '#333333',
    '--error-bg': '#450a0a',
    '--error-text': '#fecaca',
    '--success-bg': '#022c22',
    '--success-text': '#86efac'
  }
};

// Validate theme name
const isValidTheme = (theme) => {
  return theme === 'light' || theme === 'dark' || theme === 'system';
};

// Apply theme to document
const applyTheme = (theme) => {
  try {
    // Validate theme
    if (!isValidTheme(theme)) {
      console.error(`Invalid theme: ${theme}`);
      theme = 'dark'; // Fallback to dark theme
    }

    // If theme is system, get the actual theme
    const actualTheme = theme === 'system' ? getSystemTheme() : theme;
    
    const root = document.documentElement;
    const themeVars = themes[actualTheme];
    
    if (!themeVars) {
      console.error(`Theme variables not found for theme: ${actualTheme}`);
      return;
    }
    
    Object.entries(themeVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Store the current theme for persistence
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  } catch (error) {
    console.error('Error applying theme:', error);
  }
};

// Get system theme preference
const getSystemTheme = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (error) {
    console.error('Error getting system theme:', error);
    return 'dark'; // Fallback to dark theme
  }
};

// Initialize theme
const initializeTheme = (selectedTheme = 'system') => {
  try {
    // Try to get theme from localStorage first
    const savedTheme = localStorage.getItem('theme');
    const themeToUse = isValidTheme(savedTheme) ? savedTheme : selectedTheme;
    
    const theme = themeToUse === 'system' ? getSystemTheme() : themeToUse;
    applyTheme(theme);
    return theme;
  } catch (error) {
    console.error('Error initializing theme:', error);
    applyTheme('dark'); // Fallback to dark theme
    return 'dark';
  }
};

// Listen for system theme changes
const setupThemeListener = (callback) => {
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      if (callback) {
        callback(e.matches ? 'dark' : 'light');
      }
    };
    
    // Use the appropriate event listener method
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  } catch (error) {
    console.error('Error setting up theme listener:', error);
    return () => {}; // Return empty cleanup function
  }
};

export { initializeTheme, applyTheme, getSystemTheme, setupThemeListener }; 