import { UnderConstruction } from "@/pages/UnderConstruction";

// SPDX-License-Identifier: AGPL-3.0-only

// TODO(GitLab #125): When this page is a real gallery, surface copy that offchain JSON/media
// is loaded from an admin-configurable token URI prefix (`setBaseURI`); onchain traits stay authoritative.

export function CollectionPage() {
  return (
    <UnderConstruction
      title="Leprechaun collection"
      slug="collection"
      imageSrc="/art/scenes/collection-gallery.jpg"
    >
      Onchain traits, metadata, and indexer-backed mint history — coming after the launch milestone.
    </UnderConstruction>
  );
}
