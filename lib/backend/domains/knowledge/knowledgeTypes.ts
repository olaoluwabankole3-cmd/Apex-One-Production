/**
 * APEX ONE — Knowledge Domain Types & DTOs
 */

import { KnowledgeCategory, KnowledgeItemRecord } from "../../database/schema";

export interface CreateKnowledgeItemDto {
  title: string;
  category: KnowledgeCategory;
  content: string;
  summary?: string;
  sourceDocId?: string;
  tags?: string[];
  isPublicPlatformKnowledge?: boolean;
}

export interface UpdateKnowledgeItemDto {
  title?: string;
  category?: KnowledgeCategory;
  content?: string;
  summary?: string;
  sourceDocId?: string;
  tags?: string[];
}

export interface KnowledgeFilterDto {
  category?: string;
  query?: string;
  tags?: string[];
}
