// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageSection } from "@/components/ui/PageSection";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { useIndexerConnectivity } from "@/hooks/useIndexerConnectivity";
import { arenaEventPagePath } from "@/lib/indexerApi";
import {
  useArenaEventDirectory,
  type ArenaEventDirectoryKind,
} from "@/pages/arena/useArenaEventDirectory";

const KIND_FILTERS: { id: ArenaEventDirectoryKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "podium_settlement", label: "Podium settlements" },
  { id: "last_buy_epoch_start", label: "Last Buy epochs" },
];

function podiumLabelFromApi(podium: string | null | undefined): string | null {
  if (!podium) return null;
  switch (podium) {
    case "last_buy":
      return "Last Buy";
    case "warbow":
      return "WarBow";
    case "defended_streak":
      return "Defended Streak";
    case "time_booster":
      return "Time Booster";
    default:
      return podium;
  }
}

export function ArenaEventDirectorySection() {
  const [kind, setKind] = useState<ArenaEventDirectoryKind>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const { isOffline } = useIndexerConnectivity();
  const directory = useArenaEventDirectory(kind, search);

  const emptyMessage = useMemo(() => {
    if (directory.loading) return null;
    if (directory.indexerNote) return directory.indexerNote;
    if ((directory.items?.length ?? 0) === 0) {
      return search
        ? "No arena events match your search yet."
        : "No indexed arena events yet — play activity will appear here after settlements.";
    }
    return null;
  }, [directory.indexerNote, directory.items, directory.loading, search]);

  return (
    <PageSection
      title="Event directory"
      spotlight
      badgeLabel="indexer history"
      badgeTone="info"
      dataTestId="arena-event-directory"
    >
      <p className="arena-event-directory__lede">
        Permanent links to podium settlements and Last Buy epoch starts — searchable without a wallet.
      </p>

      <div className="arena-event-directory__toolbar" role="toolbar" aria-label="Filter arena events">
        <div className="arena-event-directory__chips" role="group" aria-label="Event kind">
          {KIND_FILTERS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`arena-event-directory__chip${kind === chip.id ? " arena-event-directory__chip--active" : ""}`}
              aria-pressed={kind === chip.id}
              onClick={() => setKind(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <form
          className="arena-event-directory__search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <label className="arena-event-directory__search-label" htmlFor="arena-event-search">
            Search events
          </label>
          <input
            id="arena-event-search"
            type="search"
            className="arena-event-directory__search-input"
            placeholder="Title, epoch, address, or tx hash"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="arena-event-directory__search-btn">
            Search
          </button>
        </form>
      </div>

      {isOffline ? (
        <StatusMessage variant="warning">
          Indexer offline — showing the last cached event list when available.
        </StatusMessage>
      ) : null}

      {directory.loading ? (
        <p className="arena-event-directory__status" aria-live="polite">
          Loading arena events…
        </p>
      ) : null}

      {emptyMessage ? (
        <StatusMessage variant={directory.indexerNote ? "warning" : "placeholder"}>{emptyMessage}</StatusMessage>
      ) : null}

      {directory.items && directory.items.length > 0 ? (
        <ul className="arena-event-directory__list">
          {directory.items.map((event) => (
            <li key={event.id} className="arena-event-directory__item">
              <Link to={arenaEventPagePath(event.id)} className="arena-event-directory__link">
                <span className="arena-event-directory__title">{event.title}</span>
                <span className="arena-event-directory__meta">
                  {podiumLabelFromApi(event.podium) ? (
                    <span>{podiumLabelFromApi(event.podium)}</span>
                  ) : null}
                  {event.epoch ? <span>Epoch {event.epoch}</span> : null}
                  {event.block_timestamp ? (
                    <UnixTimestampDisplay raw={event.block_timestamp} compact />
                  ) : (
                    <span>Block {event.block_number}</span>
                  )}
                </span>
                <span className="arena-event-directory__subtitle">{event.subtitle}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {directory.nextOffset != null ? (
        <div className="arena-event-directory__more">
          <button
            type="button"
            className="arena-event-directory__more-btn"
            disabled={directory.loadingMore}
            onClick={() => directory.loadMore()}
          >
            {directory.loadingMore ? "Loading…" : "Load more events"}
          </button>
        </div>
      ) : null}
    </PageSection>
  );
}
