const CustomerIcon = ({ width, height, isActive }: any) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="9" r="4" fill={isActive ? '#000000' : 'white'} fillOpacity="0.8" />
      <circle cx="17" cy="9" r="3" fill={isActive ? '#000000' : 'white'} fillOpacity="0.8" />
      <circle cx="7" cy="9" r="3" fill={isActive ? '#000000' : 'white'} fillOpacity="0.8" />
      <path
        d="M17 13C19.4478 13.0001 20.4286 15.4456 20.7969 16.916C20.9406 17.4899 20.4862 18 19.8945 18H17.5684C17.1653 16.4903 16.3855 14.778 14.8779 13.7998C15.4201 13.321 16.1137 13 17 13Z"
        fill={isActive ? '#000000' : 'white'}
        fillOpacity="0.8"
      />
      <path
        d="M6.99942 13C7.88537 13 8.57846 13.3212 9.12051 13.7998C7.61342 14.7781 6.83405 16.4906 6.43106 18H4.10488C3.51326 18 3.05882 17.4899 3.20254 16.916C3.57079 15.4456 4.55165 13.0001 6.99942 13Z"
        fill={isActive ? '#000000' : 'white'}
        fillOpacity="0.8"
      />
      <path
        d="M12 14C15.7087 14 16.6665 17.301 16.9139 19.0061C16.9932 19.5526 16.5523 20 16 20H8C7.44772 20 7.00684 19.5526 7.08614 19.0061C7.33351 17.301 8.29134 14 12 14Z"
        fill={isActive ? '#000000' : 'white'}
        fillOpacity="0.8"
      />
    </svg>
  );
};

export default CustomerIcon;
