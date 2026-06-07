/**
 * Race a promise against a timeout. Rejects with a user-friendly message
 * if the operation does not settle within `timeoutMs`.
 */
export async function withTimeout<T>(
  p: Promise<T>,
  label: string,
  timeoutMs = 30_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} prend plus de temps que prévu, réessayez.`)),
      timeoutMs,
    );
  });
  try {
    return (await Promise.race([p, timeout])) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
