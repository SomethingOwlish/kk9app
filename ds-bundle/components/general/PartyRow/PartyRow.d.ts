import * as React from 'react';

/**
 * PartyRow — from @kk9/asgard@1.0.0.
 */
export interface PartyRowProps {
  name: string;
  faction?: string;
  factionColor?: string;
  portraitUrl?: string;
  subtitle?: string;
  vitals?: Vital[];
  actions?: React.ReactNode;
}

export declare const PartyRow: React.ComponentType<PartyRowProps>;
