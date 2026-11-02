/** Synthetic key-possession and immediate revocation regression tests. */
process.env.TEST_ENV = "true";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { DatabaseStore } from "../lib/backend/database/store";
import type { UserRecord, OrganizationMembershipRecord } from "../lib/backend/database/schema";
import { getPermissionsForRole, type TenantContext } from "../lib/backend/core/security";
import { FinancialSourceIntakeService } from "../lib/backend/domains/reconciliation/financialSourceIntakeService";
import { FinancialSignerOnboardingService } from "../lib/backend/domains/reconciliation/financialSignerOnboardingService";
import { InMemoryObjectStorageAdapter } from "../lib/backend/domains/documents/documentStorage";
import { verifyFinancialManifestSignature, type SignedFinancialSourceManifest } from "../lib/backend/domains/reconciliation/financialSourceProvenanceGate";

const suffix=randomUUID().slice(0,12);
const org="financial-signer-"+suffix, foreign="foreign-signer-"+suffix;
const db=DatabaseStore.createFreshStore();
db.clearAll();
const now=new Date().toISOString();
for(const [id,tenant,status] of [
  ["maker",org,"active"],["proofSubmitter",org,"active"],
  ["checker",org,"active"],["checker2",org,"active"],
  ["disabled",org,"disabled"],["outsider",foreign,"active"],
] as const){
  const u:UserRecord={id,email:id+"@example.invalid",name:id,title:"Admin",status,createdAt:now};
  const m:OrganizationMembershipRecord={id:"m-"+id,organizationId:tenant,userId:id,role:"Administrator",joinedAt:now};
  db.users.set(id,u);db.memberships.set(m.id,m);
}
const ctx=(id:string,organizationId=org):TenantContext=>({
  organizationId,userId:id,userEmail:id+"@example.invalid",
  userRole:"Administrator",permissions:[...getPermissionsForRole("Administrator")],
  requestId:"signer-onboarding-test-"+suffix,timestamp:now,
});
const hash=(data:Buffer|string)=>createHash("sha256").update(data).digest("hex");
const sourceService=new FinancialSourceIntakeService(db,new InMemoryObjectStorageAdapter());
const onboarding=new FinancialSignerOnboardingService(db);

async function main(){
  const pair=generateKeyPairSync("ed25519");
  const policy=await sourceService.proposeSource(ctx("maker"),{
    sourceLabel:"signed-test-"+suffix,kind:"settlement",role:"expected",
    signingKey:{
      keyId:"synthetic-ed25519-"+suffix,
      ed25519PublicKeySpkiDerBase64:pair.publicKey.export({format:"der",type:"spki"}).toString("base64"),
    }
  });
  const approved=await sourceService.decideSource(ctx("checker"),{
    registryId:policy.id,expectedRevision:1,verdict:"approved",
    reason:"Synthetic signer policy independent approval only",
  });
  assert.equal(approved.externalSourceAuthorityVerified,false);
  const challenge=await onboarding.requestChallenge(ctx("maker"),policy.id);
  assert.equal(challenge.dossier.status,"challenge_pending");
  assert.equal(challenge.dossier.bankKeyOwnershipIndependentlyVerified,false);
  assert.equal(challenge.dossier.externalAuthorityApprovalVerified,false);
  assert.equal(challenge.dossier.challengeNonceSha256,hash(challenge.nonceBase64));
  assert(!JSON.stringify(challenge.dossier).includes(challenge.nonceBase64));
  await assert.rejects(()=>onboarding.requestChallenge(ctx("maker"),policy.id),/already exists|duplicate|unique|Conflict/i);
  await assert.rejects(()=>onboarding.requestChallenge(ctx("outsider",foreign),policy.id),/not found/i);
  await assert.rejects(()=>onboarding.requestChallenge(ctx("disabled"),policy.id),/membership/i);
  const wrong=generateKeyPairSync("ed25519");
  const wrongSignature=sign(null,challenge.signingBytes,wrong.privateKey).toString("base64");
  await assert.rejects(()=>onboarding.provePossession(ctx("proofSubmitter"),{
    dossierId:challenge.dossier.id,nonceBase64:challenge.nonceBase64,signatureBase64:wrongSignature,
  }),/does not prove possession/i);
  const signature=sign(null,challenge.signingBytes,pair.privateKey).toString("base64");
  await assert.rejects(()=>onboarding.provePossession(ctx("proofSubmitter"),{
    dossierId:challenge.dossier.id,nonceBase64:Buffer.alloc(32).toString("base64"),signatureBase64:signature,
  }),/nonce mismatch/i);
  const proofRace=await Promise.allSettled([
    onboarding.provePossession(ctx("maker"),{
      dossierId:challenge.dossier.id,nonceBase64:challenge.nonceBase64,signatureBase64:signature,
    }),
    onboarding.provePossession(ctx("proofSubmitter"),{
      dossierId:challenge.dossier.id,nonceBase64:challenge.nonceBase64,signatureBase64:signature,
    }),
  ]);
  assert.equal(proofRace.filter(x=>x.status==="fulfilled").length,1);
  const proven=await db.financialSignerOnboardingRepo.findById(challenge.dossier.id,ctx("checker"));
  assert.equal(proven.status,"proof_verified");
  assert.equal(proven.revision,2);
  assert.equal(proven.proofSignatureSha256,hash(Buffer.from(signature,"base64")));
  await assert.rejects(()=>onboarding.provePossession(ctx("maker"),{
    dossierId:challenge.dossier.id,nonceBase64:challenge.nonceBase64,signatureBase64:signature,
  }),/already used|decided/i);
  await assert.rejects(()=>onboarding.reviewDossier(ctx("maker"),{
    dossierId:challenge.dossier.id,expectedRevision:2,verdict:"reviewed",
    reason:"Synthetic two-person dossier evidence",externalEvidenceRef:"internal-mock-evidence-001",
    externalEvidenceSha256:hash("synthetic external evidence fixture"),
  }),/independent/i);
  const evidence={dossierId:challenge.dossier.id,expectedRevision:2,verdict:"reviewed" as const,
    reason:"Reviewed locally; external institution ownership still NOT validated",
    externalEvidenceRef:"internal-mock-evidence-001",
    externalEvidenceSha256:hash("synthetic external evidence fixture")};
  const approvals=await Promise.allSettled([
    onboarding.reviewDossier(ctx("checker"),evidence),
    onboarding.reviewDossier(ctx("checker2"),evidence),
  ]);
  assert.equal(approvals.filter(x=>x.status==="fulfilled").length,1);
  const reviewed=await db.financialSignerOnboardingRepo.findById(challenge.dossier.id,ctx("checker"));
  assert.equal(reviewed.status,"reviewed");
  assert.equal(reviewed.revision,3);
  assert.equal(reviewed.bankKeyOwnershipIndependentlyVerified,false);
  assert.equal(reviewed.sourceAuthenticityVerified,false);
  await assert.rejects(()=>onboarding.reviewDossier(ctx("checker2"),evidence),/already reviewed|changed/i);

  const csv=Buffer.from("reference,currency,amount_minor,record_id,recorded_at\nSETTLEMENT-1,NGN,10000,src-1,2026-11-01T12:00:00Z\n");
  const snapshot=await sourceService.ingestInternalSnapshot(ctx("maker"),{registryId:policy.id,csvBytes:csv});
  const utc=(offset:number)=>new Date(Date.now()+offset).toISOString().replace(/\.\d{3}Z$/,"Z");
  const manifest:SignedFinancialSourceManifest={schemaVersion:1,
    organizationId:org,registryId:policy.id,sourceReference:"synthetic-signer-test-"+suffix,
    kind:"settlement",role:"expected",sha256:snapshot.expectedSha256,bytes:csv.length,
    issuedAt:utc(-60000),expiresAt:utc(86400_000)};
  const {manifestSigningBytes}=await import("../lib/backend/domains/reconciliation/financialSourceProvenanceGate");
  const signatureForManifest=sign(null,manifestSigningBytes(manifest),pair.privateKey).toString("base64");
  assert.equal(verifyFinancialManifestSignature(manifest,signatureForManifest,approved,snapshot).signatureValid,true);

  const revokeRace=await Promise.allSettled([
    sourceService.revokeSource(ctx("checker"),{
      registryId:policy.id,expectedRevision:2,reason:"Emergency synthetic compromised signing key revocation"}),
    sourceService.revokeSource(ctx("checker2"),{
      registryId:policy.id,expectedRevision:2,reason:"Competing synthetic emergency key revocation"}),
  ]);
  assert.equal(revokeRace.filter(x=>x.status==="fulfilled").length,1);
  const revoked=await db.financialSourceRegistryRepo.findById(policy.id,ctx("maker"));
  assert.equal(revoked.status,"revoked");
  assert.equal(revoked.revision,3);
  assert.equal(revoked.externalSourceAuthorityVerified,false);
  await assert.rejects(()=>sourceService.revokeSource(ctx("maker"),{
    registryId:policy.id,expectedRevision:3,reason:"Repeated revocation is forbidden"}),/revoked|revision changed/i);
  assert.throws(()=>verifyFinancialManifestSignature(manifest,signatureForManifest,revoked,snapshot),/approved|does not match/i);
  await assert.rejects(()=>sourceService.ingestInternalSnapshot(ctx("maker"),{
    registryId:policy.id,csvBytes:csv}),/no independent approval/i);
  await assert.rejects(()=>onboarding.requestChallenge(ctx("maker"),policy.id),/not approved/i);
  const audit=await db.auditLogsRepo.findMany(ctx("checker"),{limit:100});
  assert.equal(audit.items.filter(x=>x.action==="financial_source:signer_revoked"&&x.resourceId===policy.id).length,1);
  assert.equal(audit.items.filter(x=>x.action==="financial_signer:dossier_reviewed"&&x.resourceId===reviewed.id).length,1);
  assert(!JSON.stringify(audit.items).includes(signature));
  assert(!JSON.stringify(audit.items).includes(challenge.nonceBase64));
  console.log("PASS: synthetic Ed25519 challenge proof, replay isolation, independent review, cross-tenant boundary, emergency key revocation, atomic races and audit");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
