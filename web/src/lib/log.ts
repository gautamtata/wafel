type Log = (message: string, ...details: unknown[]) => void;

export const log: { warn: Log; error: Log } = {
  warn: (message, ...details) => console.warn(message, ...details),
  error: (message, ...details) => console.error(message, ...details),
};
