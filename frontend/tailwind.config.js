/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Base backgrounds
                background: '#0C0E12',
                'panel-bg': '#131722',
                'element-bg': '#1E222D',

                // Borders
                border: '#2A2E39',
                'border-active': '#434651',
                'border-focus': '#2962FF',

                // Brand
                brand: '#2962FF',
                'brand-hover': '#1E53E4',

                // Semantic - Direction
                up: '#089981',
                'up-hover': '#0AAE8E',
                down: '#F23645',
                'down-hover': '#FF4757',

                // Trade semantics (first-class aliases)
                'trade-up': '#089981',
                'trade-down': '#F23645',
                bullish: '#089981',
                bearish: '#F23645',

                // Terminal background (deep charcoal)
                terminal: '#131722',

                // Semantic - Status
                warn: '#F7931A',
                'warn-bg': 'rgba(247, 147, 26, 0.1)',

                // Mode colors
                replay: '#9333EA',
                'replay-bg': 'rgba(147, 51, 234, 0.1)',
                backtest: '#06B6D4',
                'backtest-bg': 'rgba(6, 182, 212, 0.1)',
                paper: '#F59E0B',
                'paper-bg': 'rgba(245, 158, 11, 0.1)',
                live: '#089981',
                'live-bg': 'rgba(8, 153, 129, 0.1)',

                // Text
                text: '#D1D4DC',
                'text-secondary': '#787B86',
                'text-muted': '#5D606B',

                // Misc
                limit: '#F23645',
                market: '#2962FF',
            },

            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
                mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
            },

            fontSize: {
                'xxs': ['10px', { lineHeight: '14px' }],
                'price-lg': ['28px', { lineHeight: '32px', fontWeight: '600' }],
                'price-md': ['24px', { lineHeight: '28px', fontWeight: '600' }],
                'price-sm': ['18px', { lineHeight: '22px', fontWeight: '500' }],
            },

            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '112': '28rem',
                '128': '32rem',
            },

            zIndex: {
                'base': '0',
                'content': '10',
                'dock': '20',
                'header': '30',
                'dropdown': '40',
                'overlay': '50',
                'modal': '60',
                'toast': '70',
                'tooltip': '80',
            },

            animation: {
                'slide-up': 'slide-up 0.2s ease-out',
                'slide-down': 'slide-down 0.2s ease-out',
                'slide-in-right': 'slide-in-right 0.2s ease-out',
                'slide-in-left': 'slide-in-left 0.2s ease-out',
                'fade-in': 'fade-in 0.15s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },

            keyframes: {
                'slide-up': {
                    from: { transform: 'translateY(100%)' },
                    to: { transform: 'translateY(0)' },
                },
                'slide-down': {
                    from: { transform: 'translateY(-100%)' },
                    to: { transform: 'translateY(0)' },
                },
                'slide-in-right': {
                    from: { transform: 'translateX(100%)' },
                    to: { transform: 'translateX(0)' },
                },
                'slide-in-left': {
                    from: { transform: 'translateX(-100%)' },
                    to: { transform: 'translateX(0)' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
            },

            boxShadow: {
                'dock': '0 -4px 20px rgba(0, 0, 0, 0.3)',
                'dropdown': '0 4px 20px rgba(0, 0, 0, 0.4)',
                'modal': '0 8px 32px rgba(0, 0, 0, 0.5)',
                'toast': '0 4px 12px rgba(0, 0, 0, 0.3)',
            },

            borderRadius: {
                'DEFAULT': '4px',
            },
        },
    },
    plugins: [],
}
