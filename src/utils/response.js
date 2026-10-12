export const sendSuccess = (res, statusCode, message, data) => {
  const body = { success: true, message };
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
};

export const ok = (res, data, message = 'Success') => sendSuccess(res, 200, message, data);

export const created = (res, data, message = 'Resource created') => sendSuccess(res, 201, message, data);

export const noContent = (res) => res.status(204).end();

export default { sendSuccess, ok, created, noContent };