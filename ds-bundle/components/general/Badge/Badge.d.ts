import * as React from 'react';

/**
 * Badge — from @kk9/asgard@1.0.0.
 */
export interface BadgeProps {
  children: React.ReactNode;
  variant?: "gold" | "dim" | "danger";
}

export declare const Badge: React.ComponentType<BadgeProps>;
