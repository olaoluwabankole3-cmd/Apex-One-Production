# CORTEX Documents & Evidence — guided record explorer

## Reason for this change

The previous Documents page showed a list of opaque document cards and a nonfunctional upload notice. A first-time authorized operator could not inspect extracted fields, search existing records or understand the difference between indexed data and verified evidence.

This is an **existing-record inspection workflow**, not a new ingestion connector, evidence certification service or bank-data uploader.

## What users can now do

1. Read the evidence-first workflow steps and source-assurance warning.
2. Browse only the documents returned by the existing authenticated `GET /api/v1/documents` repository. Refresh explicitly, or search the **already-returned, authorized records** by name, category, display unit and uploader. Category choices come only from available records; no external dataset or privileged query is introduced.
3. Select an entry to inspect its existing metadata, stored summary and extracted fields. The interface explicitly labels processed records **Indexed · unverified**, never **Verified**. A missing summary/field list displays an honest empty state, not a generated placeholder.
4. Follow a permission-checked link to Institutional Memory or Action Center where permitted; disabled capabilities are not linked.
5. Users with `document:delete` can open an explicit, named in-page confirmation before calling the unchanged authorized delete endpoint; deletion remains disabled without that permission. A failed request does not claim success.

There is no binary upload button, simulated extraction, fake OCR result, financial benefit assertion, direct AI-answer generation or independent source verification.

## Technical scope

- `components/documents/DocumentsWorkspace.tsx`: responsive QORVEX cream/copper record explorer, loading/empty/search-no-match/error states and guarded deletion. Only the existing document repository is called.
- `components/documents/documentWorkspaceModel.ts`: pure filtering, category enumeration and trust-aware display status.
- `scripts/runDocumentWorkspaceModelTests.ts`: 11 synthetic checks for filtering, category selection, record immutability, empty inventories, processed/processing classification, and explicit unverified trust boundaries.
- CI invokes `bun run test:document-workspace` in its existing security/integrity job.

The route remains wrapped in `InternalOnlyShield requiredPermission="document:read"`. Backend RBAC, tenant scoping, private document storage, audit and S3 permissions are unchanged.

## Limitations and next steps

- Stored summaries and extracted fields may be stale or incorrect. This surface does not fetch or display the original encrypted source object; the user must not infer independent original-source proof from its record details.
- The underlying document service contains authenticated storage/ingestion capabilities, but the app's safe **binary upload UX is not connected**. It must not be faked. Dedicated upload work requires explicit upload authorization, data-type constraints, protected retention, scanning, source authenticity and staging acceptance checks.
- Deletion is not reversible through this UI. Confirmation is a usability safeguard, not a substitute for backend permission and audit controls.
- Manual authenticated staging UAT should verify keyboard search, screen-reader status, role-specific permission scoping, delete confirmation, mobile layout and no unauthorized record leakage.

**Release:** engineering PR/CI first. Do not change live AWS staging without a separate immutable candidate build, protected release promotion and rollback review. No banking-data ingestion or verified loss claims.
