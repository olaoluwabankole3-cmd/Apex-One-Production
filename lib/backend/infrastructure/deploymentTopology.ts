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

const REQUIRED_AUTHORITIES = new Set<DeploymentAuthorityName>([
  "database",
  "session",
  "rateLimit",
  "audit",
  "objectStorage",
  "searchIndex",
]);

export function assertProductionTopology(
  topology: DeploymentTopology = topologyJson as DeploymentTopology
): DeploymentTopology {
  if (topology.schemaVersion !== 1) throw new Error("Unsupported production topology schema version");
  if (topology.service !== "apex-one") throw new Error("Production topology must target apex-one");
  if (topology.runtime.port !== 3000) throw new Error("Production topology must expose application port 3000");
  if (topology.runtime.runAsUser !== "node") throw new Error("Production topology must run as non-root node user");
  if (topology.runtime.minimumReplicas < 2) throw new Error("Production topology requires at least two application replicas");
  if (topology.runtime.rollout.strategy !== "rolling") throw new Error("Production topology must use a rolling rollout strategy");
  if (topology.runtime.rollout.maxUnavailable !== 0) throw new Error("Production rollout may not deliberately make a replica unavailable");
  if (topology.probes.liveness.path !== "/api/v1/health") throw new Error("Unexpected liveness probe path");
  if (topology.probes.startup.path !== "/api/v1/health/startup") throw new Error("Unexpected startup probe path");
  if (topology.probes.readiness.path !== "/api/v1/health/ready") throw new Error("Unexpected readiness probe path");

  const actualAuthorities = new Set(topology.authorities.map((authority) => authority.name));
  for (const authority of REQUIRED_AUTHORITIES) {
    if (!actualAuthorities.has(authority)) throw new Error(`Production topology is missing ${authority} authority`);
  }
  for (const authority of topology.authorities) {
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
