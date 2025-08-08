const ThreeDotsIcon = ({ width, height }: any) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 57 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#filter0_d_3168_4519)">
        <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
      </g>
      <path
        d="M22 26C22 26.5523 22.4477 27 23 27C23.5523 27 24 26.5523 24 26C24 25.4477 23.5523 25 23 25C22.4477 25 22 25.4477 22 26Z"
        stroke="#000510"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28 24C28 24.5523 28.4477 25 29 25C29.5523 25 30 24.5523 30 24C30 23.4477 29.5523 23 29 23C28.4477 23 28 23.4477 28 24Z"
        stroke="#000510"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M34 22C34 22.5523 34.4477 23 35 23C35.5523 23 36 22.5523 36 22C36 21.4477 35.5523 21 35 21C34.4477 21 34 21.4477 34 22Z"
        stroke="#000510"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <filter
          id="filter0_d_3168_4519"
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
            result="effect1_dropShadow_3168_4519"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_3168_4519"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
};

export default ThreeDotsIcon;
