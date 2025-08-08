const DbIcon = ({ width, height }: any) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 57 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#filter0_d_3168_4526)">
        <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
      </g>
      <path
        d="M35 24V29C35 30.6569 32.3137 32 29 32C25.6863 32 23 30.6569 23 29V24M35 24V19M35 24C35 25.6569 32.3137 27 29 27C25.6863 27 23 25.6569 23 24M35 19C35 17.3431 32.3137 16 29 16C25.6863 16 23 17.3431 23 19M35 19C35 20.6569 32.3137 22 29 22C25.6863 22 23 20.6569 23 19M23 24V19"
        stroke="#101010"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <filter
          id="filter0_d_3168_4526"
          x="0.5"
          y="-2.38419e-07"
          width="56"
          height="56"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="3.5" />
          <feGaussianBlur stdDeviation="2.75" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.02 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_3168_4526"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_3168_4526"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
};

export default DbIcon;
