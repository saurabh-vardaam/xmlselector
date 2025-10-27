import React from 'react';

interface LatisCloseIconProps {
  className?: string;
  [key: string]: any;
}

const LatisCloseIcon: React.FC<LatisCloseIconProps> = ({ className, ...props }) => {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path
        d="M12 20C7.58172 20 4 16.4182 4 12C4 7.58172 7.58172 4 12 4C16.4182 4 20 7.58172 20 12C20 16.4182 16.4182 20 12 20ZM12 18.4C15.5346 18.4 18.4 15.5346 18.4 12C18.4 8.46538 15.5346 5.6 12 5.6C8.46538 5.6 5.6 8.46538 5.6 12C5.6 15.5346 8.46538 18.4 12 18.4ZM12 10.8686L14.2627 8.60589L15.3941 9.73726L13.1314 12L15.3941 14.2627L14.2627 15.3941L12 13.1314L9.73726 15.3941L8.60589 14.2627L10.8686 12L8.60589 9.73726L9.73726 8.60589L12 10.8686Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default LatisCloseIcon;
