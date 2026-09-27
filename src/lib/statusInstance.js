// Shared: build a runtime status instance from a campaign status definition by
// name. Used by RollDialog (tension/fate-debt) and AttackResolvePanel (soak
// bleed / attack-carried status). Kept in lib/ so component files export only
// components (fast-refresh friendly).

function rUid() { return Math.random().toString(36).slice(2, 10); }

export function buildStatusInstance(campaignStatuses = [], name, source, fallbackTypes) {
  const def = campaignStatuses.find((s) => s.name === name);
  // Заряды и раунды берутся из определения — как у StatusEditor и у прогрессии.
  // Прежде здесь стоял null, и статус от атаки (Кровотечение на 15 зарядов) не
  // кончался никогда: списывать было нечего.
  const dur = def?.duration || {};
  const counted = dur.mode === "counter" || dur.mode === "charges";
  return {
    _uid: rUid(),
    definitionId: def?.id || "",
    name,
    status_types: def?.status_types || fallbackTypes,
    apply_stun: def?.apply_stun ?? false,
    durationMode: dur.mode || "time",
    durationRemaining: counted ? (dur.value ?? null) : null,
    autoReduce: dur.auto_reduce ?? false,
    effects: def?.effects || [],
    progresses: def?.progresses ?? false,
    progress_every: def?.progress_every ?? 1,
    progress_into_names: def?.progress_into_names || [],
    progressCount: 0,
    tickCount: 0,
    source,
  };
}
