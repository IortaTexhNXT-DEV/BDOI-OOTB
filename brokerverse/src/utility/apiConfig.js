import { BASE_URL } from './constant';


export const fetchUrl = (url) => {
  const baseUrl = `${BASE_URL}${url}`;
  return baseUrl;
};
/* eslint-disable */

// export const setAuthorization = (token: string) => {
//   if (!isEmpty(token)) {
//     axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
//   } else {
//     delete axios.defaults.headers.common['Authorization'];
//   }
// };
