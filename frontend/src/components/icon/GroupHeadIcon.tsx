const GroupHeadIcon = ({
  width,
  height,
}: any) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 57 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#filter0_d_3168_4317)">
        <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
      </g>
      <circle cx="29" cy="22" r="4" fill="#101010" />
      <circle cx="34" cy="22" r="3" fill="#101010" />
      <circle cx="24" cy="22" r="3" fill="#101010" />
      <path
        d="M34 26C36.4478 26.0001 37.4286 28.4456 37.7969 29.916C37.9406 30.4899 37.4862 31 36.8945 31H34.5684C34.1653 29.4903 33.3855 27.778 31.8779 26.7998C32.4201 26.321 33.1137 26 34 26Z"
        fill="#101010"
      />
      <path
        d="M24 26C24.886 26 25.579 26.3212 26.1211 26.7998C24.6139 27.7781 23.8346 29.4905 23.4316 31H21.1045C20.5131 30.9997 20.0594 30.4898 20.2031 29.916C20.5714 28.4456 21.5522 26 24 26Z"
        fill="#101010"
      />
      <path
        d="M29 27C32.7087 27 33.6665 30.301 33.9139 32.0061C33.9932 32.5526 33.5523 33 33 33H25C24.4477 33 24.0068 32.5526 24.0861 32.0061C24.3335 30.301 25.2913 27 29 27Z"
        fill="#101010"
      />
      <defs>
        <filter
          id="filter0_d_3168_4317"
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
            result="effect1_dropShadow_3168_4317"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_3168_4317"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
};

export default GroupHeadIcon;
