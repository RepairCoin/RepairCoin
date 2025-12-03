const IssueRewardsIcon = ({ width = "100%", height = "100%" }: any) => {
  return (
    <svg width={width} height={height} viewBox="0 0 57 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <g filter="url(#filter0_d_rewards)">
        <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
      </g>
      {/* Diamond/gem icon for rewards */}
      <path
        d="M28.5 33L20 21.5C19.75 21.2 19.62 21.05 19.6 20.87C19.58 20.69 19.65 20.52 19.78 20.18L20.35 18.65C20.66 17.75 20.81 17.3 21.17 17.05C21.53 16.8 22 16.8 22.95 16.8H34.05C35 16.8 35.47 16.8 35.83 17.05C36.19 17.3 36.34 17.75 36.65 18.65L37.22 20.18C37.35 20.52 37.42 20.69 37.4 20.87C37.38 21.05 37.25 21.2 37 21.5L28.5 33Z"
        fill="#000510"
      />
      <path
        d="M28.5 33L32.5 21M28.5 33L24.5 21M37 21.5L32.5 21M32.5 21L31 17.5M32.5 21H24.5M26 17.5L24.5 21M24.5 21L20 21.5"
        stroke="#000510"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <defs>
        <filter
          id="filter0_d_rewards"
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
            result="effect1_dropShadow_rewards"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_rewards"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
};

export default IssueRewardsIcon;
