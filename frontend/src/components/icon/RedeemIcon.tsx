const RedeemIcon = ({ width = "100%", height = "100%" }: any) => {
  return (
    <svg width={width} height={height} viewBox="0 0 57 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <g filter="url(#filter0_d_redeem)">
        <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
      </g>
      {/* Gift box icon */}
      <path
        d="M23 24V32H27V24H23ZM30 32H34V24H30V32ZM35 19C35.5523 19 36 19.4477 36 20V22C36 22.5523 35.5523 23 35 23H30V19H35ZM27 23H22C21.4477 23 21 22.5523 21 22V20C21 19.4477 21.4477 19 22 19H27V23Z"
        fill="#000510"
      />
      <path
        d="M34 15.5V15.4C34 14.5 33.2 13.9 32.4 14.2C31.4 14.5 30.5 15 29.7 15.7L29 16.5V17H31.5C31.65 17 31.8 16.98 31.94 16.92L32.9 16.6C33.45 16.42 33.82 15.9 33.82 15.32L34 15.5Z"
        fill="#000510"
      />
      <path
        d="M23 15.5V15.4C23 14.5 23.8 13.9 24.6 14.2C25.6 14.5 26.5 15 27.3 15.7L28 16.5V17H25.5C25.35 17 25.2 16.98 25.06 16.92L24.1 16.6C23.55 16.42 23.18 15.9 23.18 15.32L23 15.5Z"
        fill="#000510"
      />
      <defs>
        <filter
          id="filter0_d_redeem"
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
            result="effect1_dropShadow_redeem"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_redeem"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
};

export default RedeemIcon;
