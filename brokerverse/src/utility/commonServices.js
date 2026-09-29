import request from "./interceptor";

export const getRequest = async (url, params) => {
  const res = await request.get(url, { params });
  return res;
};

export const postRequest = async (url, payload, params) => {
  const res = await request.post(url, payload, {
    params,
  });
  return res;
};

export const putRequest = async (url, payload, params) => {
  const res = await request.put(url, payload, { params });
  return res;
};

export const deleteRequest = async (url, params) => {
  const res = await request.delete(url, { params });
  return res;
};

export const patchRequest = async (url, payload, params) => {
  const res = await request.patch(url, payload, { params });
  return res;
};
