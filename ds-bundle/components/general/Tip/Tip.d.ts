import * as React from 'react';

/**
 * Tip — from @kk9/asgard@1.0.0.
 */
export interface TipProps {
  text?: React.ReactNode;
  label?: string;
  children: React.ReactNode;
}

export declare const Tip: React.ComponentType<TipProps>;
