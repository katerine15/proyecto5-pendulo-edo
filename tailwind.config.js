// Configuración de Tailwind para compilar vendor/tailwind.css a partir de simulador_3d.html
// Recompilar (solo si se cambian clases): npx tailwindcss@3.4.17 -i tailwind.input.css -o vendor/tailwind.css --minify
module.exports = {
  content: ['./simulador_3d.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        slate: { 850: '#151e2e', 950: '#090d16' },
      },
    },
  },
};
