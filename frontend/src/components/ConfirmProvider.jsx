import { createContext, useCallback, useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setRequest({
      title: options.title || "Konfirmasi tindakan",
      description: options.description || "Apakah Anda yakin ingin melanjutkan?",
      confirmLabel: options.confirmLabel || "Lanjutkan",
      cancelLabel: options.cancelLabel || "Batal",
      destructive: Boolean(options.destructive),
      resolve,
    });
  }), []);

  const close = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(request)} onOpenChange={(open) => !open && close(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {request?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className="btn btn-outline" onClick={() => close(false)}>
              {request?.cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${request?.destructive ? "btn-danger" : "btn-primary"}`}
              onClick={() => close(true)}
            >
              {request?.confirmLabel}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm harus digunakan di dalam ConfirmProvider");
  return confirm;
}
