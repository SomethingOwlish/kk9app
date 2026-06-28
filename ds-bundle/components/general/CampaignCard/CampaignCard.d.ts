import * as React from 'react';

/**
 * CampaignCard — from @kk9/asgard@1.0.0.
 */
export interface CampaignCardProps {
  name: string;
  system?: string;
  playerCount?: number;
  isGM?: boolean;
  status?: string;
  onClick?: () => void;
}

export declare const CampaignCard: React.ComponentType<CampaignCardProps>;
