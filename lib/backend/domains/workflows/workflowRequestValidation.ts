/**
 * APEX ONE — Workflow HTTP Request Schemas
 *
 * Runtime parsing for workflow graph payloads before domain execution.
 * Domain graph validation still owns DAG/business invariants; this layer owns
 * untrusted JSON shape, primitive types, allowlists, and transport bounds.
 */

import { Validator } from "../../core/validation";
import {
  assertAllowedKeys,
  assertNonEmptyObject,
  optionalRecord,
  requireArray,
  requireRecord,
  type JsonObject,
} from "../../core/requestValidation";
import type {
  CreateWorkflowDto,
  TriggerWorkflowRunDto,
  UpdateWorkflowDto,
} from "./workflowTypes";
import type { WorkflowConnection, WorkflowNode } from "../../database/schema";

const WORKFLOW_STATUSES = ["active", "draft", "paused", "archived"] as const;
const WORKFLOW_NODE_TYPES = [
  "trigger",
  "condition",
  "ai_agent",
  "action",
  "integration",
  "human_approval",
  "notification",
] as const;
const WORKFLOW_TRIGGER_TYPES = ["manual", "event", "schedule", "signal"] as const;

const CREATE_WORKFLOW_KEYS = [
  "name",
  "description",
  "subsidiary",
  "nodes",
  "connections",
  "status",
] as const;
const UPDATE_WORKFLOW_KEYS = CREATE_WORKFLOW_KEYS;
const WORKFLOW_NODE_KEYS = [
  "id",
  "type",
  "title",
  "description",
  "configuration",
  "position",
] as const;
const WORKFLOW_CONNECTION_KEYS = [
  "id",
  "fromNodeId",
  "toNodeId",
  "conditionLabel",
] as const;

function parseConfiguration(value: unknown, fieldName: string): WorkflowNode["configuration"] {
  const configuration = requireRecord(value, fieldName);
  const entries = Object.entries(configuration);

  if (entries.length > 100) {
    throw new (require("../../core/errors").ValidationError)(
      `Field '${fieldName}' cannot contain more than 100 properties`
    );
  }

  const normalized: WorkflowNode["configuration"] = {};

  for (const [key, rawValue] of entries) {
    Validator.requireString(key, `${fieldName} key`, { maxLength: 100 });

    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean"
    ) {
      if (typeof rawValue === "number" && !Number.isFinite(rawValue)) {
        Validator.requireNumber(rawValue, `${fieldName}.${key}`);
      }
      normalized[key] = rawValue;
      continue;
    }

    if (Array.isArray(rawValue)) {
      const values = requireArray(rawValue, `${fieldName}.${key}`, 100);
      normalized[key] = values.map((item, index) =>
        Validator.requireString(item, `${fieldName}.${key}[${index}]`, {
          maxLength: 500,
        })
      );
      continue;
    }

    Validator.requireString(rawValue, `${fieldName}.${key}`, { maxLength: 500 });
  }

  return normalized;
}

function parsePosition(value: unknown, fieldName: string): WorkflowNode["position"] | undefined {
  const position = optionalRecord(value, fieldName);
  if (!position) return undefined;

  assertAllowedKeys(position, ["x", "y"], fieldName);
  const x = Validator.requireNumber(position.x, `${fieldName}.x`);
  const y = Validator.requireNumber(position.y, `${fieldName}.y`);
  return { x, y };
}

function parseNodes(value: unknown): WorkflowNode[] {
  const nodes = requireArray(value, "nodes", 200);

  return nodes.map((rawNode, index) => {
    const fieldName = `nodes[${index}]`;
    const node = requireRecord(rawNode, fieldName);
    assertAllowedKeys(node, WORKFLOW_NODE_KEYS, fieldName);

    return {
      id: Validator.requireId(node.id, `${fieldName}.id`),
      type: Validator.requireEnum(node.type, WORKFLOW_NODE_TYPES, `${fieldName}.type`),
      title: Validator.requireString(node.title, `${fieldName}.title`, {
        minLength: 1,
        maxLength: 200,
      }),
      ...(node.description !== undefined
        ? {
            description: Validator.requireString(
              node.description,
              `${fieldName}.description`,
              { maxLength: 2_000 }
            ),
          }
        : {}),
      configuration: parseConfiguration(node.configuration, `${fieldName}.configuration`),
      ...(node.position !== undefined
        ? { position: parsePosition(node.position, `${fieldName}.position`) }
        : {}),
    };
  });
}

function parseConnections(value: unknown): WorkflowConnection[] {
  const connections = requireArray(value, "connections", 400);

  return connections.map((rawConnection, index) => {
    const fieldName = `connections[${index}]`;
    const connection = requireRecord(rawConnection, fieldName);
    assertAllowedKeys(connection, WORKFLOW_CONNECTION_KEYS, fieldName);

    return {
      id: Validator.requireId(connection.id, `${fieldName}.id`),
      fromNodeId: Validator.requireId(
        connection.fromNodeId,
        `${fieldName}.fromNodeId`
      ),
      toNodeId: Validator.requireId(
        connection.toNodeId,
        `${fieldName}.toNodeId`
      ),
      ...(connection.conditionLabel !== undefined
        ? {
            conditionLabel: Validator.requireString(
              connection.conditionLabel,
              `${fieldName}.conditionLabel`,
              { maxLength: 200 }
            ),
          }
        : {}),
    };
  });
}

export function parseCreateWorkflowRequest(body: JsonObject): CreateWorkflowDto {
  assertAllowedKeys(body, CREATE_WORKFLOW_KEYS);

  return {
    name: Validator.requireString(body.name, "name", {
      minLength: 1,
      maxLength: 200,
    }),
    description: Validator.requireString(body.description, "description", {
      maxLength: 2_000,
    }),
    subsidiary: Validator.requireString(body.subsidiary, "subsidiary", {
      maxLength: 200,
    }),
    nodes: parseNodes(body.nodes),
    connections: parseConnections(body.connections),
    ...(body.status !== undefined
      ? { status: Validator.requireEnum(body.status, WORKFLOW_STATUSES, "status") }
      : {}),
  };
}

export function parseUpdateWorkflowRequest(body: JsonObject): UpdateWorkflowDto {
  assertAllowedKeys(body, UPDATE_WORKFLOW_KEYS);
  assertNonEmptyObject(body);

  return {
    ...(body.name !== undefined
      ? {
          name: Validator.requireString(body.name, "name", {
            minLength: 1,
            maxLength: 200,
          }),
        }
      : {}),
    ...(body.description !== undefined
      ? {
          description: Validator.requireString(body.description, "description", {
            maxLength: 2_000,
          }),
        }
      : {}),
    ...(body.subsidiary !== undefined
      ? {
          subsidiary: Validator.requireString(body.subsidiary, "subsidiary", {
            maxLength: 200,
          }),
        }
      : {}),
    ...(body.nodes !== undefined ? { nodes: parseNodes(body.nodes) } : {}),
    ...(body.connections !== undefined
      ? { connections: parseConnections(body.connections) }
      : {}),
    ...(body.status !== undefined
      ? { status: Validator.requireEnum(body.status, WORKFLOW_STATUSES, "status") }
      : {}),
  };
}

export function parseTriggerWorkflowRunRequest(
  body: JsonObject,
  workflowId: string
): TriggerWorkflowRunDto {
  assertAllowedKeys(body, ["triggerType", "contextData"]);

  return {
    workflowId: Validator.requireId(workflowId, "workflowId"),
    ...(body.triggerType !== undefined
      ? {
          triggerType: Validator.requireEnum(
            body.triggerType,
            WORKFLOW_TRIGGER_TYPES,
            "triggerType"
          ),
        }
      : {}),
    ...(body.contextData !== undefined
      ? { contextData: requireRecord(body.contextData, "contextData") }
      : {}),
  };
}

export { WORKFLOW_STATUSES };
