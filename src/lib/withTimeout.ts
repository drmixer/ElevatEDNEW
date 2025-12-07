export const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs = 4000,
): Promise<{ timedOut: true } | { timedOut: false; value: T }> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    promise
      .then((value) => resolve({ timedOut: false, value }))
      .catch((error) => reject(error))
      .finally(() => {
        if (timer) {
          clearTimeout(timer);
        }
      });
  });
};

export default withTimeout;
