/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    "./App.tsx",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./feature/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    screens: {
      xs: "360px", // small phones
      sm: "400px", // phones
      md: "600px", // large phones / small tablets
      lg: "768px", // tablets
      xl: "1024px", // desktop web
    },
    extend: {
      fontFamily: {
        poppins: ["Poppins"],
        "poppins-extrabold": ["Poppins-ExtraBold"],
      },
    },
  },
  plugins: [],
};
