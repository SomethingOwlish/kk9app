// Shared: build a runtime status instance from a campaign status definition by
// name. Used by RollDialog (tension/fate-debt) and AttackResolvePanel (soak
// bleed / attack-carried status). Kept in lib/ so component files export only
// components (fast-refresh friendly).

function rUid() { return Math.random().toString(36).slice(2, 10); }

export function buildStatusInstance(campaignStatuses = [], name, source, fallbackTypes) {
  const def = campaignStatuses.find((s) => s.name === name);
  return {
    _uid: rUid(),
    definitionId: def?.id || "",
    name,
    status_types: def?.status_types || fallbackTypes,
    apply_stun: def?.apply_stun ?? false,
    durationMode: def?.duration?.mode || "time",
    durationRemaining: null,
    effects: def?.effects || [],
    progresses: def?.progresses ?? false,
    progress_every: def?.progress_every ?? 1,
    progress_into_names: def?.progress_into_names || [],
    progressCount: 0,
    tickCount: 0,
    source,
  };
}
