const TrophyIcon = ({ width, height }: any)  => {
  return (
    <svg width={width} height={height} viewBox="0 0 57 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#filter0_d_2775_3811)">
        <rect x="6" y="2" width="45" height="45" rx="12" fill="#FFCC00" />
      </g>
      <path
        d="M35.5268 16.1562V14H22.5938V16.1562H19V17.8633C19 19.3008 19.4268 20.6839 20.2021 21.754C20.8009 22.5805 21.7371 23.151 22.5789 23.4255C22.8233 24.7413 23.4863 25.9919 24.8336 27.0116C25.8218 27.76 27.01 28.3085 28.0742 28.5327V32.1484H24.75V34.125H33.375V32.1484H30.0508V28.5327C31.115 28.3081 32.3027 27.76 33.2914 27.0116C34.6391 25.9919 35.3017 24.7413 35.5461 23.4255C36.3879 23.151 37.3241 22.5805 37.9229 21.754C38.6982 20.6839 39.125 19.3008 39.125 17.8633V16.1562H35.5268ZM21.8031 20.5945C21.3234 19.9351 21.0318 19.0492 20.9838 18.1328H22.5938V21.1592C22.4168 21.108 22.0134 20.8843 21.8031 20.5945ZM36.3219 20.5945C36.1152 20.8915 35.8008 21.1596 35.5312 21.1596C35.5312 20.1534 35.5313 19.0802 35.529 18.1328H37.1417C37.0932 19.0492 36.7891 19.9252 36.3219 20.5945Z"
        fill="black"
      />
      <defs>
        <filter
          id="filter0_d_2775_3811"
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
            result="effect1_dropShadow_2775_3811"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_2775_3811"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
};

export default TrophyIcon;
