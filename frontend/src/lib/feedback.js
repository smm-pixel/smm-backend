import { toast } from "sonner";

export const notify = (message, options = {}) => {
  const text = typeof message === "string" ? message : "Terjadi kesalahan.";
  const { type = "default", ...toastOptions } = options;
  return toast[type]?.(text, toastOptions) || toast(text, toastOptions);
};

export const notifySuccess = (message, options) => notify(message, { ...options, type: "success" });
export const notifyError = (message, options) => notify(message, { ...options, type: "error" });
export const notifyInfo = (message, options) => notify(message, { ...options, type: "info" });
