/**
 * CORTEX synthetic financial signer onboarding.
 *
 * An Ed25519 signed challenge proves possession of a PRIVATE KEY ONLY.
 * An internal two-person dossier review can record an opaque external
 * evidence receipt, but CANNOT independently authenticate that evidence or
 * establish a bank/processor's legal authorization. All authority flags
 * therefore remain FALSE. No HTTP connector, live-bank onboarding or keys.
 */
import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";
import type { TenantContext } from "../../core/errors";
import {
  ConflictError, CrossTenantViolationError, ForbiddenError,
  NotFoundError, ValidationError,
} from "../../core/errors";
import { getPermissionsForRole, requirePermission } from "../../core/security";
import type { FinancialSignerOnboardingRecord, FinancialSourceRegistryRecord } from "../../database/schema";
import { DatabaseStore } from "../../database/store";
import { pinFinancialSigner } from "./financialSourceProvenanceGate";

const HEX = /^[0-9a-f]{64}$/;
const OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._/-]{11,119}$/;
const BASE64 = /^[A-Za-z0-9+/]{86}==$/;
const WINDOW = 15 * 60_000;
const DOMAIN = "CORTEX-SIGNER-POSSESSION-CHALLENGE-V1\n";

function gated(): void {
  if (process.env.APEX_DEPLOYMENT_ENVIRONMENT === "production") throw new NotFoundError("Internal signer onboarding");
  if (process.env.TEST_ENV === "true") return;
  if (process.env.APEX_DEPLOYMENT_ENVIRONMENT !== "staging" ||
      process.env.CORTEX_INTERNAL_FINANCIAL_SOURCE_INTAKE_ENABLED !== "true" ||
      process.env.CORTEX_INTERNAL_SIGNER_ONBOARDING_ENABLED !== "true") {
    throw new NotFoundError("Internal signer onboarding");
  }
}

async function authorize(ctx: TenantContext, db: DatabaseStore): Promise<void> {
  requirePermission(ctx, "org:admin");
  const membership = await db.findUserMembership(ctx.userId, ctx.organizationId);
  const principal = await db.findUserById(ctx.userId);
  if (!membership || !principal || principal.status !== "active" ||
      membership.role !== ctx.userRole ||
      !getPermissionsForRole(membership.role).includes("org:admin")) {
    throw new ForbiddenError("Signer onboarding requires active institutional administrator membership");
  }
}

async function scoped<T extends {id:string;organizationId:string}>(
  repo: {findById(id:string,ctx:TenantContext,name?:string):Promise<T>},
  ctx: TenantContext, id: string, name: string,
): Promise<T> {
  try { return await repo.findById(id,ctx,name); }
  catch (err) { if (err instanceof CrossTenantViolationError) throw new NotFoundError(name); throw err; }
}

function hash(bytes: Buffer | string): string { return createHash("sha256").update(bytes).digest("hex"); }
function eqHex(a:string,b:string): boolean {
  const left=Buffer.from(a,"hex"), right=Buffer.from(b,"hex");
  return left.length===32 && right.length===32 && timingSafeEqual(left,right);
}
function recordId(org:string, registryId:string): string {
  return "fson-"+hash(JSON.stringify([org,registryId])).slice(0,40);
}

/** Canonical challenge, never a payment instruction or a bank authority credential. */
export function signerPossessionChallengeBytes(input:{
  organizationId:string;sourceRegistryId:string;fingerprintSha256:string;
  nonceBase64:string;expiresAt:string;
}):Buffer {
  if (!input || !OPAQUE.test(input.organizationId) ||
      !/^[A-Za-z0-9_-]{8,90}$/.test(input.sourceRegistryId) ||
      !HEX.test(input.fingerprintSha256) ||
      typeof input.nonceBase64!=="string" ||
      Buffer.from(input.nonceBase64,"base64").length!==32 ||
      Buffer.from(input.nonceBase64,"base64").toString("base64")!==input.nonceBase64 ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(input.expiresAt) ||
      !Number.isFinite(Date.parse(input.expiresAt))) {
    throw new ValidationError("Signer challenge format is invalid");
  }
  return Buffer.from(DOMAIN+[
    input.organizationId,input.sourceRegistryId,input.fingerprintSha256,
    input.nonceBase64,input.expiresAt,
  ].join("\n")+"\n","utf8");
}

function audit(ctx:TenantContext,action:string,id:string,metadata:Record<string,unknown>){
  return { organizationId:ctx.organizationId,actorId:ctx.userId,
    actorEmail:ctx.userEmail,action,resource:"FinancialSignerOnboarding",
    resourceId:id,requestId:ctx.requestId,status:"success" as const,
    timestamp:new Date().toISOString(),
    metadata:{...metadata, bankKeyOwnershipIndependentlyVerified:false,
      externalAuthorityApprovalVerified:false,sourceAuthenticityVerified:false},
  };
}

export interface SignerChallenge {
  dossier:FinancialSignerOnboardingRecord;
  nonceBase64:string;
  signingBytes:Buffer;
}

export class FinancialSignerOnboardingService {
  constructor(private readonly db:DatabaseStore){}

  /** One immutable challenge per locally approved source policy. */
  public async requestChallenge(ctx:TenantContext,registryId:string):Promise<SignerChallenge>{
    gated();await authorize(ctx,this.db);
    const policy=await scoped(this.db.financialSourceRegistryRepo,ctx,registryId,"FinancialSourceRegistry");
    if (policy.status!=="approved" || !policy.signingKey) throw new ConflictError("Signing policy is not approved");
    const key=pinFinancialSigner(policy.signingKey);
    if (key.keyFingerprintSha256!==policy.signingKey.keyFingerprintSha256)
      throw new ConflictError("Approved signing key fingerprint is inconsistent");
    const nonce=randomBytes(32).toString("base64");
    const expiresAt=new Date(Math.ceil((Date.now()+WINDOW)/1000)*1000).toISOString().replace(".000Z","Z");
    const id=recordId(ctx.organizationId,registryId);
    const dossier=await this.db.runInTransaction(ctx,async()=>{
      await authorize(ctx,this.db);
      const latest=await scoped(this.db.financialSourceRegistryRepo,ctx,registryId,"FinancialSourceRegistry");
      if(latest.status!=="approved" || latest.signingKey?.keyFingerprintSha256!==key.keyFingerprintSha256)
        throw new ConflictError("Signing policy changed while requesting proof");
      const now=new Date().toISOString();
      const created=await this.db.financialSignerOnboardingRepo.create({
        id,sourceRegistryId:registryId,keyId:key.keyId,
        keyFingerprintSha256:key.keyFingerprintSha256,
        requestedByUserId:ctx.userId,createdAt:now,updatedAt:now,
        status:"challenge_pending",revision:1,
        challengeNonceSha256:hash(nonce),challengeIssuedAt:now,
        challengeExpiresAt:expiresAt,
        bankKeyOwnershipIndependentlyVerified:false,
        externalAuthorityApprovalVerified:false,sourceAuthenticityVerified:false,
      },ctx);
      await this.db.recordAuditLog(audit(ctx,"financial_signer:challenge_requested",id,{
        sourceRegistryId:registryId,keyFingerprintSha256:key.keyFingerprintSha256,
        nonceHashSha256:created.challengeNonceSha256,expiry:expiresAt,
      }));
      return created;
    });
    return {dossier,nonceBase64:nonce,signingBytes:signerPossessionChallengeBytes({
      organizationId:ctx.organizationId,sourceRegistryId:registryId,
      fingerprintSha256:key.keyFingerprintSha256,nonceBase64:nonce,expiresAt,
    })};
  }

  /** A broker submits the signed nonce; signature never becomes bank ownership. */
  public async provePossession(ctx:TenantContext,input:{
    dossierId:string;nonceBase64:string;signatureBase64:string;
  }):Promise<FinancialSignerOnboardingRecord>{
    gated();await authorize(ctx,this.db);
    const dossier=await scoped(this.db.financialSignerOnboardingRepo,ctx,input.dossierId,"FinancialSignerOnboarding");
    if(dossier.status!=="challenge_pending")throw new ConflictError("Signer challenge already used or decided");
    if(Date.now()>=Date.parse(dossier.challengeExpiresAt))throw new ValidationError("Signer challenge has expired");
    const policy=await scoped(this.db.financialSourceRegistryRepo,ctx,dossier.sourceRegistryId,"FinancialSourceRegistry");
    if(policy.status!=="approved" || !policy.signingKey ||
       policy.signingKey.keyFingerprintSha256!==dossier.keyFingerprintSha256)
      throw new ConflictError("Signer policy revoked or fingerprint changed");
    if(typeof input.nonceBase64!=="string" || !eqHex(hash(input.nonceBase64),dossier.challengeNonceSha256))
      throw new ValidationError("Signer challenge nonce mismatch");
    if(typeof input.signatureBase64!=="string" || !BASE64.test(input.signatureBase64))
      throw new ValidationError("Ed25519 challenge signature must be canonical");
    const signature=Buffer.from(input.signatureBase64,"base64");
    if(signature.length!==64 || signature.toString("base64")!==input.signatureBase64)
      throw new ValidationError("Signer challenge signature is not canonical");
    const payload=signerPossessionChallengeBytes({
      organizationId:ctx.organizationId,sourceRegistryId:dossier.sourceRegistryId,
      fingerprintSha256:dossier.keyFingerprintSha256,
      nonceBase64:input.nonceBase64,expiresAt:dossier.challengeExpiresAt,
    });
    const spki=Buffer.from(policy.signingKey.ed25519PublicKeySpkiDerBase64,"base64");
    const key=createPublicKey({key:spki,format:"der",type:"spki"});
    if(key.asymmetricKeyType!=="ed25519" || !verify(null,payload,key,signature))
      throw new ValidationError("Signer does not prove possession of the pinned private key");
    return this.db.runInTransaction(ctx,async()=>{
      await authorize(ctx,this.db);
      const latestPolicy=await scoped(this.db.financialSourceRegistryRepo,ctx,dossier.sourceRegistryId,"FinancialSourceRegistry");
      if(latestPolicy.status!=="approved" || latestPolicy.signingKey?.keyFingerprintSha256!==dossier.keyFingerprintSha256)
        throw new ConflictError("Signer policy changed before proof commit");
      const latest=await scoped(this.db.financialSignerOnboardingRepo,ctx,dossier.id,"FinancialSignerOnboarding");
      if(latest.status!=="challenge_pending" || latest.revision!==dossier.revision ||
         Date.now()>=Date.parse(latest.challengeExpiresAt))throw new ConflictError("Signer challenge changed or expired");
      const changed=await this.db.transitionFinancialSignerOnboarding(ctx,dossier.id,
        "challenge_pending",latest.revision,"proof_verified",{
          proofVerifiedAt:new Date().toISOString(),
          proofSubmittedByUserId:ctx.userId,
          proofSignatureSha256:hash(signature),
        });
      await this.db.recordAuditLog(audit(ctx,"financial_signer:possession_verified",dossier.id,{
        sourceRegistryId:dossier.sourceRegistryId,signatureDigestSha256:hash(signature),
        revision:changed.revision, externalSignerIdentityUnverified:true,
      }));
      return changed;
    });
  }

  /**
   * A distinct admin reviews the proof and *records* external evidence
   * references. Internal review is never independent bank certification.
   */
  public async reviewDossier(ctx:TenantContext,input:{
    dossierId:string;expectedRevision:number;verdict:"reviewed"|"rejected";
    reason:string;externalEvidenceRef:string;externalEvidenceSha256:string;
  }):Promise<FinancialSignerOnboardingRecord>{
    gated();await authorize(ctx,this.db);
    if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision!==2 ||
       !["reviewed","rejected"].includes(input.verdict)||
       typeof input.reason!=="string"||input.reason.length<12||input.reason.length>400||
       typeof input.externalEvidenceRef!=="string"||!OPAQUE.test(input.externalEvidenceRef)||
       typeof input.externalEvidenceSha256!=="string"||!HEX.test(input.externalEvidenceSha256)){
      throw new ValidationError("Incomplete signer evidence dossier review");
    }
    return this.db.runInTransaction(ctx,async()=>{
      await authorize(ctx,this.db);
      const before=await scoped(this.db.financialSignerOnboardingRepo,ctx,input.dossierId,"FinancialSignerOnboarding");
      if(before.status!=="proof_verified" || before.revision!==input.expectedRevision)
        throw new ConflictError("Signer dossier changed or already reviewed");
      if(before.requestedByUserId===ctx.userId || before.proofSubmittedByUserId===ctx.userId)
        throw new ForbiddenError("Signer dossier reviewer must be independent of requester and proof submitter");
      const policy:FinancialSourceRegistryRecord=await scoped(this.db.financialSourceRegistryRepo,ctx,before.sourceRegistryId,"FinancialSourceRegistry");
      if(policy.status!=="approved" || policy.signingKey?.keyFingerprintSha256!==before.keyFingerprintSha256)
        throw new ConflictError("Signing policy revoked or changed");
      const next=await this.db.transitionFinancialSignerOnboarding(ctx,before.id,
        "proof_verified",before.revision,input.verdict,{
          reviewedByUserId:ctx.userId,reviewedAt:new Date().toISOString(),
          reviewReason:input.reason,
          externalEvidenceRef:input.externalEvidenceRef,
          externalEvidenceSha256:input.externalEvidenceSha256,
        });
      await this.db.recordAuditLog(audit(ctx,"financial_signer:dossier_reviewed",before.id,{
        verdict:input.verdict,reviewedByUserId:ctx.userId,
        evidenceRef:input.externalEvidenceRef,evidenceDigest:input.externalEvidenceSha256,
        revision:next.revision, externalEvidenceNotIndependentlyValidated:true,
      }));
      return next;
    });
  }
}
