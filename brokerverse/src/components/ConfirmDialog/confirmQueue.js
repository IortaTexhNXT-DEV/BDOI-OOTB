/**
 * Requests waiting for an answer from <ConfirmDialogHost />, shown one at a time in the order asked. Kept apart from the
 * host so that openConfirm can enqueue before any host is mounted.
 */
const queue = [];
let listener = null;
let lastId = 0;

const notify = () => {
  if (listener) listener(queue[0] || null);
};

/** Add a request; resolves { confirmed, value } once the host settles it. */
export const enqueue = (options) =>
  new Promise((resolve) => {
    lastId += 1;
    queue.push({ id: lastId, options, resolve });
    notify();
  });

export const hasHost = () => listener !== null;

/** The host follows the first request waiting; returns the unsubscribe function. */
export const subscribe = (fn) => {
  listener = fn;
  fn(queue[0] || null);
  return () => {
    if (listener === fn) listener = null;
  };
};

/** The request shown has been answered: resolve it and show the next one. */
export const settle = (request, result) => {
  const i = queue.indexOf(request);
  if (i < 0) return;
  queue.splice(i, 1);
  request.resolve(result || { confirmed: false });
  notify();
};
