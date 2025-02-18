import type { EventEmitter } from 'events';

export interface RequestArguments {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export interface EIP1193Provider extends EventEmitter {
  connect(params?: any): Promise<void>;
  disconnect(): Promise<void>;
  request(args: RequestArguments): Promise<unknown>;
}
