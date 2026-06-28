import * as React from 'react';

/**
 * Modal — from @kk9/asgard@1.0.0.
 * @replaces dialog
 */
export interface ModalProps {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export declare const Modal: React.ComponentType<ModalProps>;
