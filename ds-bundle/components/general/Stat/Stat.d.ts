import * as React from 'react';

/**
 * Stat — from @kk9/asgard@1.0.0.
 */
export interface StatProps {
  label: string;
  value: number;
  max?: number;
  tip?: React.ReactNode;
  accent?: string;
  onChange?: (v: number) => void;
}

export declare const Stat: React.ComponentType<StatProps>;
