/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Military themed but modern
                military: {
                    900: '#1a202c', // Dark background
                    800: '#2d3748', // Card background
                    700: '#4a5568', // Borders
                    600: '#718096', // Text secondary
                    500: '#38a169', // Primary green
                    400: '#48bb78', // Accent
                    300: '#2f855a', // Darker green
                }
            }
        },
    },
    plugins: [
        require("tailwindcss-animate"),
    ],
}
