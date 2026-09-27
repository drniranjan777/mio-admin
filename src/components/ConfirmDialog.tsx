import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ConfirmTone = 'primary' | 'danger' | 'success' | 'warning';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

const ICON: Record<ConfirmTone, string> = { primary: 'ℹ', danger: '!', success: '✓', warning: '!' };

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

/**
 * App-styled replacement for window.confirm:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete FAQ?', tone: 'danger' }))) return;
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      state?.resolve(ok);
      setState(null);
    },
    [state],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && <Dialog {...state} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

function Dialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Destructive actions start on "Cancel" so Enter never deletes by accident.
    (tone === 'danger' ? cancelRef : confirmRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
      if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const [first, last] = [cancelRef.current, confirmRef.current];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose, tone]);

  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className={`confirm confirm-${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <div className="confirm-icon" aria-hidden>
          {ICON[tone]}
        </div>
        <h3 id="confirm-title">{title}</h3>
        {message && (
          <div id="confirm-message" className="confirm-message">
            {message}
          </div>
        )}
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn btn-ghost" onClick={() => onClose(false)}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} className={`btn confirm-btn confirm-btn-${tone}`} onClick={() => onClose(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
