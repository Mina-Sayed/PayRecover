'use client';

import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Render a centered confirmation modal with title, message, and Cancel/Confirm actions.
 *
 * @param isOpen - Whether the dialog is visible
 * @param title - Main heading displayed at the top of the dialog
 * @param message - Supporting text describing the action being confirmed
 * @param confirmLabel - Text for the confirm button (defaults to `"Confirm"`)
 * @param cancelLabel - Text for the cancel button (defaults to `"Cancel"`)
 * @param variant - Visual variant of the dialog; `"danger"` shows a red accent, `"default"` shows a neutral/green accent
 * @param onConfirm - Callback invoked when the confirm button is clicked
 * @param onCancel - Callback invoked when the cancel button is clicked
 * @returns A JSX element representing the modal when `isOpen` is true, or `null` when `isOpen` is false
 */
export default function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    {variant === 'danger' && (
                        <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                    )}
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500">{message}</p>
                </div>
                <div className="flex gap-3 p-4 pt-0">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-2.5 font-medium rounded-xl transition-colors ${variant === 'danger'
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-emerald-500 text-white hover:bg-emerald-600'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
