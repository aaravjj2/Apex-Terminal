import { Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';

export const ThemeToggle = () => {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Apply theme to body
        document.body.classList.toggle('bg-gray-900', isDark);
        document.body.classList.toggle('bg-white', !isDark);
        document.body.classList.toggle('text-gray-100', isDark);
        document.body.classList.toggle('text-gray-900', !isDark);
    }, [isDark]);

    return (
        <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded hover:bg-[#2a2e39] transition text-gray-400"
            title={isDark ? 'Light Mode' : 'Dark Mode'}
        >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
};
