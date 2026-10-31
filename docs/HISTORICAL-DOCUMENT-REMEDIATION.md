# CORTEX historical document integrity remediation

**Status:** historical extraction terms are quarantined on supported document reads, AI retrieval and PostgreSQL search. Stored documents are **not** rewritten, deleted or re-certified.

Old category-based extraction could fabricate payment terms, SLA thresholds and governing jurisdiction. Only new processing stamped `source-grounded-v1` can expose content-derived fields and searchable summaries; this stamp signifies a controlled extraction method, **not** independent verification.

A legacy document remains discoverable through name, category and tags. Without the policy stamp, its historical summary and fields are unassessed and must not inform an AI conclusion.

## Safe read-only operator inventory

After staging PostgreSQL is provisioned, with a read-only protected connection and an approved tenant:

```bash
bunx tsx scripts/auditLegacyDocumentExtracts.ts --tenant-id APPROVED_TENANT_ID
```

The script requires `DATABASE_URL` from the protected secret store, performs a read-only transaction and returns **counts only**. It does not reveal raw document content or IDs.

## Controlled remediation

1. Inventory and log the affected document count for each separately approved tenant.
2. Verify original encrypted source bytes, ownership, integrity checksum and required access permission.
3. Use an approved, tested parser on the **actual source**. Unsupported PDFs, Office documents and images stay unassessed.
4. Before any historical reprocessing, obtain explicit change approval and a non-destructive rehearsal plan; preserve audit and source records.
5. Reindex through reviewed application processing, never by manually stamping legacy records or issuing ad-hoc SQL updates.
6. Prove legacy invented terms cannot enter search, AI or financial decisions. Confirm tenant isolation and audit retention.
7. Sign off individual tenants before staging acceptance; no universal automatic cleanup is authorized.

This update is a **quarantine and inventory capability**, not a completed migration of existing records. There is intentionally no bulk DELETE or UPDATE routine.
