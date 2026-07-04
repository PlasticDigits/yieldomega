// SPDX-License-Identifier: AGPL-3.0-only

import type { WarbowHeroSubcardHelpTopic } from "@/pages/arena/warbowHeroSubcardHelpCopy";

type Props = {
  topic: WarbowHeroSubcardHelpTopic;
  label: string;
  onOpen: (topic: WarbowHeroSubcardHelpTopic) => void;
};

export function WarbowHeroSubcardHelpButton({ topic, label, onOpen }: Props) {
  return (
    <button
      type="button"
      className="warbow-hero-card__help warbow-hero-card__subcard-help"
      data-testid={`warbow-hero-${topic}-help`}
      aria-label={`Open ${label} help`}
      onClick={() => onOpen(topic)}
    >
      ?
    </button>
  );
}
