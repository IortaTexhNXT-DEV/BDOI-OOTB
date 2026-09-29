// import React, { useEffect } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';

// const ScrollToTop = ({ children }) => {
//   const location = useLocation();
//   const navigate = useNavigate();

//   useEffect(() => {
//     window.scrollTo(0, 0);
//   }, [location.pathname]);

//   // Optionally, you can use navigate to scroll to the top when a navigation occurs
//   useEffect(() => {
//     navigate(location.pathname);
//   }, [navigate, location.pathname]);

//   return children;
// };

// export default ScrollToTop;
