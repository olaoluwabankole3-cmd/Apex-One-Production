/**
 * APEX ONE — Workflow Graph Structure & DAG Validator
 * 
 * Validates node configurations, connection linkages, and acyclic properties.
 */

import { WorkflowNode, WorkflowConnection } from "../../database/schema";
import { ValidationError } from "../../core/errors";

export class WorkflowValidator {
  /**
   * Validate that workflow graph has a valid trigger and connected acyclic DAG structure.
   */
  public static validateWorkflowGraph(nodes: WorkflowNode[], connections: WorkflowConnection[]): void {
    if (!nodes || nodes.length === 0) {
      throw new ValidationError("Workflow must contain at least one node");
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    if (nodeIds.size !== nodes.length) {
      throw new ValidationError("Workflow node IDs must be unique");
    }

    // Must have at least one trigger node
    const triggerNodes = nodes.filter((n) => n.type === "trigger");
    if (triggerNodes.length === 0) {
      throw new ValidationError("Workflow must contain at least one 'trigger' node");
    }

    // Validate connections reference existing nodes
    for (const conn of connections) {
      if (!nodeIds.has(conn.fromNodeId)) {
        throw new ValidationError(`Connection '${conn.id}' references non-existent source node '${conn.fromNodeId}'`);
      }
      if (!nodeIds.has(conn.toNodeId)) {
        throw new ValidationError(`Connection '${conn.id}' references non-existent target node '${conn.toNodeId}'`);
      }
      if (conn.fromNodeId === conn.toNodeId) {
        throw new ValidationError(`Self-referencing loop detected on node '${conn.fromNodeId}'`);
      }
    }

    // Detect cycles using DFS
    const adjacency = new Map<string, string[]>();
    for (const n of nodes) adjacency.set(n.id, []);
    for (const c of connections) {
      adjacency.get(c.fromNodeId)!.push(c.toNodeId);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    function hasCycle(nodeId: string): boolean {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && hasCycle(neighbor)) {
          return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          throw new ValidationError("Cyclic dependencies detected in workflow connection graph");
        }
      }
    }
  }
}
