import React from 'react';

interface LatisRefreshIconProps {
  className?: string;
}

const LatisRefreshIcon: React.FC<LatisRefreshIconProps> = ({ className }) => {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20 12C20 7.58168 16.4182 4 12 4C9.58728 4 7.42402 5.06808 5.95725 6.7572L4 4.8V9.6H8.8L7.09194 7.89232C8.26594 6.49104 10.0289 5.6 12 5.6C15.5346 5.6 18.4 8.46536 18.4 12C18.4 15.5346 15.5346 18.4 12 18.4C10.4124 18.4 8.95973 17.8219 7.84115 16.8647L6.44268 17.7547C7.88185 19.1448 9.84105 20 12 20C16.4182 20 20 16.4182 20 12Z"
        fill="#666666"
      />
    </svg>
  );
};

export default LatisRefreshIcon;
