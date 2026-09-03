import topologyJson from "../../../deploy/production-topology.json";

export type DeploymentAuthorityName =
  | "database"
  | "session"
  | "rateLimit"
  | "audit"
  | "objectStorage"
  | "searchIndex";

export interface DeploymentTopology {
  schemaVersion: number;
  service: string;
  runtime: {
    containerFile: string;
    port: number;
    runAsUser: string;
    minimumReplicas: number;
    rollout: {
      strategy: string;
      maxUnavailable: number;
      maxSurge: number;
    };
  };
  probes: {
    liveness: { path: string; timeoutSeconds: number; periodSeconds: number };
    startup: { path: string; timeoutSeconds: number; periodSeconds: number };
    readiness: { path: string; timeoutSeconds: number; periodSeconds: number };
  };
  authorities: Array<{
    name: DeploymentAuthorityName;
    provider: "postgres" | "redis" | "s3";
    required: boolean;
  }>;
  release: {
    immutableImageDigestRequired: boolean;
    promotionOrder: string[];
    productionRequiresStagingSource: boolean;
    rollbackStrategy: string;
    deploymentControlContract: string;
  };
}

const REQUIRED_AUTHORITY_PROVIDERS: Readonly<Record<DeploymentAuthorityName, "postgres" | "redis" | "s3">> =
  Object.freeze({
    database: "postgres",
    session: "redis",
    rateLimit: "redis",
    audit: "postgres",
    objectStorage: "s3",
    searchIndex: "postgres",
  });

const REQUIRED_AUTHORITIES = new Set<DeploymentAuthorityName>(
  Object.keys(REQUIRED_AUTHORITY_PROVIDERS) as DeploymentAuthorityName[]
);

function assertProbeTiming(name: string, timeoutSeconds: number, periodSeconds: number): void {
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error(`${name} probe timeout must be a positive integer`);
  }
  if (!Number.isInteger(periodSeconds) || periodSeconds <= 0) {
    throw new Error(`${name} probe period must be a positive integer`);
  }
}

export function assertProductionTopology(
  topology: DeploymentTopology = topologyJson as DeploymentTopology
): DeploymentTopology {
  if (topology.schemaVersion !== 1) throw new Error("Unsupported production topology schema version");
  if (topology.service !== "apex-one") throw new Error("Production topology must target apex-one");
  if (topology.runtime.containerFile !== "Dockerfile") throw new Error("Production topology must use the canonical Dockerfile");
  if (topology.runtime.port !== 3000) throw new Error("Production topology must expose application port 3000");
  if (topology.runtime.runAsUser !== "node") throw new Error("Production topology must run as non-root node user");
  if (!Number.isInteger(topology.runtime.minimumReplicas) || topology.runtime.minimumReplicas < 2) {
    throw new Error("Production topology requires at least two application replicas");
  }
  if (topology.runtime.rollout.strategy !== "rolling") throw new Error("Production topology must use a rolling rollout strategy");
  if (topology.runtime.rollout.maxUnavailable !== 0) throw new Error("Production rollout may not deliberately make a replica unavailable");
  if (!Number.isInteger(topology.runtime.rollout.maxSurge) || topology.runtime.rollout.maxSurge < 1) {
    throw new Error("Production rolling rollout requires at least one surge replica");
  }
  if (topology.probes.liveness.path !== "/api/v1/health") throw new Error("Unexpected liveness probe path");
  if (topology.probes.startup.path !== "/api/v1/health/startup") throw new Error("Unexpected startup probe path");
  if (topology.probes.readiness.path !== "/api/v1/health/ready") throw new Error("Unexpected readiness probe path");
  assertProbeTiming("Liveness", topology.probes.liveness.timeoutSeconds, topology.probes.liveness.periodSeconds);
  assertProbeTiming("Startup", topology.probes.startup.timeoutSeconds, topology.probes.startup.periodSeconds);
  assertProbeTiming("Readiness", topology.probes.readiness.timeoutSeconds, topology.probes.readiness.periodSeconds);

  if (topology.authorities.length !== REQUIRED_AUTHORITIES.size) {
    throw new Error("Production topology must define exactly six durable authorities");
  }
  const actualAuthorities = new Set(topology.authorities.map((authority) => authority.name));
  if (actualAuthorities.size !== topology.authorities.length) {
    throw new Error("Production topology may not define duplicate durable authorities");
  }
  for (const authority of REQUIRED_AUTHORITIES) {
    if (!actualAuthorities.has(authority)) throw new Error(`Production topology is missing ${authority} authority`);
  }
  for (const authority of topology.authorities) {
    const expectedProvider = REQUIRED_AUTHORITY_PROVIDERS[authority.name];
    if (!expectedProvider) throw new Error(`Production topology contains unsupported authority ${String(authority.name)}`);
    if (authority.provider !== expectedProvider) {
      throw new Error(`${authority.name} must use durable provider ${expectedProvider}`);
    }
    if (!authority.required) throw new Error(`${authority.name} must remain required in production topology`);
  }

  if (!topology.release.immutableImageDigestRequired) {
    throw new Error("Release topology must require immutable image digests");
  }
  if (topology.release.promotionOrder.join(",") !== "staging,production") {
    throw new Error("Release promotion order must be staging then production");
  }
  if (!topology.release.productionRequiresStagingSource) {
    throw new Error("Production promotion must require a staging source");
  }
  if (topology.release.rollbackStrategy !== "explicit_previous_successful_digest") {
    throw new Error("Rollback topology must require an explicit previous successful image digest");
  }
  if (topology.release.deploymentControlContract !== "/v1/releases/{promote|rollback}") {
    throw new Error("Unexpected deployment-control contract");
  }

  return topology;
}

export function getProductionTopology(): DeploymentTopology {
  return assertProductionTopology(topologyJson as DeploymentTopology);
}

export function getDeploymentTopologySummary() {
  const topology = getProductionTopology();
  return {
    schemaVersion: topology.schemaVersion,
    service: topology.service,
    minimumReplicas: topology.runtime.minimumReplicas,
    rolloutStrategy: topology.runtime.rollout.strategy,
    probePaths: {
      liveness: topology.probes.liveness.path,
      startup: topology.probes.startup.path,
      readiness: topology.probes.readiness.path,
    },
    authorities: topology.authorities.map((authority) => ({
      name: authority.name,
      provider: authority.provider,
      required: authority.required,
    })),
  };
}
