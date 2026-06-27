// workers/analytics-worker/src/types.ts
import type {
  AnalyticsEngineDataset,
  KVNamespace,
} from "@cloudflare/workers-types";

export interface Env {
  ANALYTICS_ENGINE: AnalyticsEngineDataset;
  CONFIG_KV: KVNamespace;
  INTERNAL_KEY_BINDING: string;
}

export interface DataPoint {
  blobs: string[];
  doubles: number[];
  indexes: string[];
}

export interface TradePayload {
  exchange: string;
  action: string;
  symbol: string;
  quantity: number;
  price?: number;
  requestId?: string;
}

export interface TradeResult {
  success: boolean;
  error?: string;
}

export interface WorkerPerfData {
  worker: string;
  requests: number;
  errors: number;
  duration: number;
}

export interface SignalData {
  source: string;
  type: string;
  symbol: string;
  confidence: number;
}

export interface NotificationData {
  type: string;
  target: string;
  success: boolean;
}
