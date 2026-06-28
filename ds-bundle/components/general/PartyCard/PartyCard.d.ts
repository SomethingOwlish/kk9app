import * as React from 'react';

/**
 * PartyCard — from @kk9/asgard@1.0.0.
 */
export interface PartyCardProps {
  name: string;
  faction?: string;
  factionColor?: string;
  portraitUrl?: string;
  subtitle?: string;
  isSelf?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export declare const PartyCard: React.ComponentType<PartyCardProps>;
