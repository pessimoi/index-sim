# Documentation map

This directory is the project memory layer for humans and AI agents. It keeps current state, rewrite plans, decisions and operations separate.

## Where to go

- AI-agent instructions: [../AGENTS.md](../AGENTS.md)
- Product/domain overview: [product/README.md](product/README.md)
- Feature inventory: [product/feature-inventory.md](product/feature-inventory.md)
- Technical map and architecture: [technical/README.md](technical/README.md)
- Rewrite specification: [technical/rewrite-spec.md](technical/rewrite-spec.md)
- UI parity specification: [technical/ui-parity-spec.md](technical/ui-parity-spec.md)
- Live integrations specification: [technical/live-integrations-spec.md](technical/live-integrations-spec.md)
- Testing strategy and commands: [technical/testing.md](technical/testing.md)
- Running, build and deploy notes: [operations/README.md](operations/README.md)
- Roadmap, backlog, decisions and ideas: [project/README.md](project/README.md)

## Supporting audit snapshots

These files are useful evidence, but they are not the living source of truth. Promote durable findings into the docs above when they become active work.

- [../ARCHITECTURE_AUDIT.md](../ARCHITECTURE_AUDIT.md)
- [../PROJECT_REVIEW_NOTES.md](../PROJECT_REVIEW_NOTES.md)
- [../SECURITY_AUDIT.md](../SECURITY_AUDIT.md)

## Ownership rule

- Current runtime facts belong in [technical/architecture.md](technical/architecture.md) or [operations/README.md](operations/README.md).
- Rewrite implementation requirements belong in [technical/rewrite-spec.md](technical/rewrite-spec.md).
- Product concepts belong in [product/README.md](product/README.md).
- Legacy-to-rewrite feature coverage belongs in [product/feature-inventory.md](product/feature-inventory.md).
- Legacy-to-rewrite UI layout and workflow parity requirements belong in [technical/ui-parity-spec.md](technical/ui-parity-spec.md).
- Hiscores and live market sync requirements belong in [technical/live-integrations-spec.md](technical/live-integrations-spec.md).
- Validation commands belong in [technical/testing.md](technical/testing.md).
- Accepted choices and open decision boundaries belong in [project/decisions.md](project/decisions.md).
- Future work belongs in [project/roadmap.md](project/roadmap.md), [project/backlog.md](project/backlog.md) or [project/idea-inbox.md](project/idea-inbox.md).

If a document and code disagree about current behavior, trust the code and update the document.
