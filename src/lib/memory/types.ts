export type MemoryType = "fact" | "preference" | "goal" | "context";

export interface UserMemory {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  sourceConversationId: string | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface ExtractedMemory {
  type: MemoryType;
  content: string;
  confidence: number;
  expiresAt?: string;
}
