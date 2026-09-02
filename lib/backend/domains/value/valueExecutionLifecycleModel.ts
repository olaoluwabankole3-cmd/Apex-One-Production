import { ConflictError } from "../../core/errors";
import type {
  ActionRecord,
  ValueCapturedRecord,
  ValueOpportunityRecord,
  WorkflowRunRecord,
} from "../../database/schema";
import type {
  ProvenanceRecord,
  ProvenanceSourceReference,
  VerificationRecord,
} from "../evidence/model";

export const VALUE_EXECUTION_COMMANDS = [
  "validate_opportunity",
  "approve_opportunity",
  "create_action",
  "approve_action",
  "start_execution",
  "complete_execution",
  "record_measurement",
  "verify_measurement",
  "reject_measurement",
  "capture_value",
] as const;

export type ValueExecutionCommandName = (typeof VALUE_EXECUTION_COMMANDS)[number];

export const VALUE_CAPTURE_CATEGORIES = [
  "Revenue recovered",
  "Revenue generated",
  "Cost avoided",
  "Capacity recovered",
  "Time saved",
] as const;

export type ValueCaptureCategory = (typeof VALUE_CAPTURE_CATEGORIES)[number];

export const STAGE7_ACTION_LINK_PREFIX = "value-execution:opportunity:";
export const STAGE7_ACTION_PROVENANCE_METHOD = "stage7_action_from_opportunity";
export const STAGE7_WORKFLOW_PROVENANCE_METHOD = "stage7_workflow_execution";
export const STAGE7_MEASUREMENT_PROVENANCE_METHOD = "stage7_value_measurement";
export const STAGE7_CAPTURE_PROVENANCE_METHOD = "stage7_value_capture";

export interface ValidateOpportunityCommand {
  command: "validate_opportunity";
  opportunityId: string;
  note?: string;
}

export interface ApproveOpportunityCommand {
  command: "approve_opportunity";
  opportunityId: string;
  note?: string;
}

export interface CreateLifecycleActionCommand {
  command: "create_action";
  opportunityId: string;
  owner?: string;
  deadline?: string;
  automationType?: "Manual" | "AI-assisted" | "Automated" | "Awaiting approval";
  requiresHumanApproval?: boolean;
}

export interface ApproveLifecycleActionCommand {
  command: "approve_action";
  opportunityId: string;
  actionId: string;
}

export interface StartExecutionCommand {
  command: "start_execution";
  opportunityId: string;
  actionId: string;
  workflowId: string;
}

export interface CompleteExecutionCommand {
  command: "complete_execution";
  opportunityId: string;
  actionId: string;
  workflowRunId: string;
}

export interface RecordMeasurementCommand {
  command: "record_measurement";
  opportunityId: string;
  actionId: string;
  workflowRunId: string;
  sources: ProvenanceSourceReference[];
  method?: string;
  confidence?: number;
  notes?: string;
}

export interface VerifyMeasurementCommand {
  command: "verify_measurement";
  opportunityId: string;
  actionId: string;
  workflowRunId: string;
  measurementProvenanceIds: string[];
  criteria: string[];
  reason?: string;
}

export interface RejectMeasurementCommand {
  command: "reject_measurement";
  opportunityId: string;
  actionId: string;
  workflowRunId: string;
  measurementProvenanceIds: string[];
  criteria: string[];
  reason: string;
}

export interface CaptureValueCommand {
  command: "capture_value";
  opportunityId: string;
  actionId: string;
  workflowRunId: string;
  measurementProvenanceIds: string[];
  category: ValueCaptureCategory;
  capturedValue: number;
  realizationDate?: string;
  evidenceDescription?: string;
}

export type ValueExecutionLifecycleCommand =
  | ValidateOpportunityCommand
  | ApproveOpportunityCommand
  | CreateLifecycleActionCommand
  | ApproveLifecycleActionCommand
  | StartExecutionCommand
  | CompleteExecutionCommand
  | RecordMeasurementCommand
  | VerifyMeasurementCommand
  | RejectMeasurementCommand
  | CaptureValueCommand;

export interface ValueExecutionLifecycleResult {
  command: ValueExecutionCommandName;
  opportunity: ValueOpportunityRecord;
  action?: ActionRecord;
  workflowRun?: WorkflowRunRecord;
  measurementProvenance?: ProvenanceRecord;
  verificationRecord?: VerificationRecord;
  valueCaptured?: ValueCapturedRecord;
}

type OpportunityStatus = ValueOpportunityRecord["status"];
type ActionStatus = ActionRecord["status"];

const OPPORTUNITY_TRANSITIONS: Readonly<
  Partial<Record<ValueExecutionCommandName, readonly [OpportunityStatus, OpportunityStatus]>>
> = {
  validate_opportunity: ["Identified", "Validated"],
  approve_opportunity: ["Validated", "Approved"],
  start_execution: ["Approved", "Executing"],
  capture_value: ["Executing", "Captured"],
};

const ACTION_TRANSITIONS: Readonly<
  Partial<Record<ValueExecutionCommandName, readonly [ActionStatus, ActionStatus]>>
> = {
  approve_action: ["Ready", "Approved"],
  start_execution: ["Approved", "In Progress"],
  complete_execution: ["In Progress", "Completed"],
  verify_measurement: ["Completed", "Measured"],
};

export function assertOpportunityLifecycleTransition(
  command: ValueExecutionCommandName,
  current: OpportunityStatus
): OpportunityStatus {
  const transition = OPPORTUNITY_TRANSITIONS[command];
  if (!transition) {
    throw new ConflictError(`Command '${command}' does not transition ValueOpportunity state`);
  }
  const [expected, next] = transition;
  if (current !== expected) {
    throw new ConflictError(
      `Command '${command}' requires ValueOpportunity status '${expected}', received '${current}'`,
      { command, current, expected, next }
    );
  }
  return next;
}

export function assertActionLifecycleTransition(
  command: ValueExecutionCommandName,
  current: ActionStatus
): ActionStatus {
  const transition = ACTION_TRANSITIONS[command];
  if (!transition) {
    throw new ConflictError(`Command '${command}' does not transition Action state`);
  }
  const [expected, next] = transition;
  if (current !== expected) {
    throw new ConflictError(
      `Command '${command}' requires Action status '${expected}', received '${current}'`,
      { command, current, expected, next }
    );
  }
  return next;
}
