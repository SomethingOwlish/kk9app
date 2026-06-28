import * as React from 'react';

/**
 * StatusBar — from @kk9/asgard@1.0.0.
 */
export interface StatusBarProps {
  statuses?: StatusEntry[];
  isGM?: boolean;
  onRemove?: (s: StatusEntry) => void;
  onAdd?: () => void;
  onView?: (s: StatusEntry) => void;
}

export declare const StatusBar: React.ComponentType<StatusBarProps>;
