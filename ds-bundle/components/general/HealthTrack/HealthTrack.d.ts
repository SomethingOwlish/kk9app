import * as React from 'react';

/**
 * HealthTrack — from @kk9/asgard@1.0.0.
 */
export interface HealthTrackProps {
  label: string;
  attrLabel: string;
  attrDie: 4 | 6 | 8 | 10 | 12 | 20;
  value: number;
  tipExtra?: string;
  onChange?: (v: number) => void;
}

export declare const HealthTrack: React.ComponentType<HealthTrackProps>;
