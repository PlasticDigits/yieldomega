"""WarBow PvP mechanics aligned with `TimeCurve.warbowSteal` / `warbowRevenge` / `warbowActivateGuard`.

Invariant-style rules (see GitLab #161, audit M-02):
- Steal: attacker BP > 0, victim BP ≥ 2× attacker BP; drain uses `WARBOW_STEAL_DRAIN_*_BPS`; guard reduces to 1%.
- UTC-day caps on steals received (victim) and steals committed (attacker); optional bypass (sim assumes paid).
- Revenge: within 24h window per (victim, stealer), drain 10% of stealer BP once.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ecostrategy.constants import (
    SECONDS_PER_DAY,
    WARBOW_GUARD_DURATION_SEC,
    WARBOW_MAX_STEALS_PER_DAY,
    WARBOW_REVENGE_WINDOW_SEC,
    WARBOW_STEAL_DRAIN_BPS,
    WARBOW_STEAL_DRAIN_GUARDED_BPS,
)


def warbow_steal_drain_bp(victim_bp: int, *, guarded: bool) -> int:
    """Match `TimeCurve._warbowStealDrainBp` for steals (guarded uses 100 bps)."""
    bps = WARBOW_STEAL_DRAIN_GUARDED_BPS if guarded else WARBOW_STEAL_DRAIN_BPS
    return (victim_bp * bps) // 10_000


def warbow_revenge_drain_bp(stealer_bp: int) -> int:
    """Revenge always uses `WARBOW_STEAL_DRAIN_BPS` (10%)."""
    return (stealer_bp * WARBOW_STEAL_DRAIN_BPS) // 10_000


@dataclass
class WarBowWorld:
    """Integer player indices stand in for addresses."""

    n: int
    bp: list[int] = field(default_factory=list)
    guard_until: list[float] = field(default_factory=list)
    # (victim_idx, utc_day) -> steals received that day
    steals_received: dict[tuple[int, int], int] = field(default_factory=dict)
    # (attacker_idx, utc_day) -> steals committed that day
    steals_committed: dict[tuple[int, int], int] = field(default_factory=dict)
    # (victim_idx, stealer_idx) -> exclusive expiry timestamp (0 = no open window)
    revenge_expiry_exclusive: dict[tuple[int, int], float] = field(default_factory=dict)

    steals_succeeded: int = 0
    revenges_succeeded: int = 0
    guards_activated: int = 0

    def __post_init__(self) -> None:
        if not self.bp:
            self.bp = [0] * self.n
        if not self.guard_until:
            self.guard_until = [0.0] * self.n

    @staticmethod
    def utc_day(now_sec: float) -> int:
        return int(now_sec // SECONDS_PER_DAY)

    def can_steal(self, attacker: int, victim: int, now_sec: float) -> bool:
        if attacker == victim or not (0 <= attacker < self.n and 0 <= victim < self.n):
            return False
        abp, vbp = self.bp[attacker], self.bp[victim]
        if abp <= 0:
            return False
        if vbp < 2 * abp:
            return False
        return True

    def try_steal(
        self,
        attacker: int,
        victim: int,
        now_sec: float,
        *,
        pay_bypass_if_needed: bool = True,
    ) -> bool:
        """Apply one successful steal if preconditions hold; update UTC-day counters and revenge window."""
        if not self.can_steal(attacker, victim, now_sec):
            return False

        day = self.utc_day(now_sec)
        vk = (victim, day)
        ak = (attacker, day)
        vr = self.steals_received.get(vk, 0)
        ar = self.steals_committed.get(ak, 0)
        over_victim = vr >= WARBOW_MAX_STEALS_PER_DAY
        over_attacker = ar >= WARBOW_MAX_STEALS_PER_DAY
        if (over_victim or over_attacker) and not pay_bypass_if_needed:
            return False

        vbp = self.bp[victim]
        guarded = now_sec < self.guard_until[victim]
        take = warbow_steal_drain_bp(vbp, guarded=guarded)
        if take <= 0:
            return False

        self.bp[victim] = max(0, vbp - take)
        self.bp[attacker] += take

        self.steals_received[vk] = vr + 1
        self.steals_committed[ak] = ar + 1

        self.revenge_expiry_exclusive[(victim, attacker)] = now_sec + WARBOW_REVENGE_WINDOW_SEC
        self.steals_succeeded += 1
        return True

    def try_revenge(self, victim: int, stealer: int, now_sec: float) -> bool:
        exp = self.revenge_expiry_exclusive.get((victim, stealer), 0.0)
        if exp <= 0.0 or now_sec >= exp:
            return False
        sbp = self.bp[stealer]
        take = warbow_revenge_drain_bp(sbp)
        if take <= 0:
            return False
        self.bp[stealer] = max(0, sbp - take)
        self.bp[victim] += take
        self.revenge_expiry_exclusive[(victim, stealer)] = 0.0
        self.revenges_succeeded += 1
        return True

    def try_guard(self, who: int, now_sec: float) -> bool:
        """Extend guard window to `max(existing, now + 6h)` like `TimeCurve.warbowActivateGuard`."""
        if not (0 <= who < self.n):
            return False
        u = now_sec + WARBOW_GUARD_DURATION_SEC
        if u > self.guard_until[who]:
            self.guard_until[who] = u
        self.guards_activated += 1
        return True
