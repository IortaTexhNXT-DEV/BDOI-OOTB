import React from 'react';
import { Button } from 'primereact/button';
import './index.scss';

const MyButton = ({ isPrimary, isDarkText, label, isCurved,hasBorder, isDisabled, isLoading }) => {
  const buttonClassName = isPrimary ? 'primary-button' : 'secondary-button';
  const textColorClassName = isDarkText ? 'dark-text' : 'light-text';
  const curvedClassName = isCurved ? 'curved-button' : 'flat-button';
  const borderClassName = hasBorder ? 'border' :'none' ;

  return (
    <div className='overall__container'>
      <Button
        label={label}
        className={`${buttonClassName} ${textColorClassName} ${curvedClassName} ${borderClassName}` }
        disabled={isDisabled}
      >
        <div>
        {isLoading && 'Loading...'}
        </div>
         
         </Button>
    </div>
  );
};

export default MyButton;
