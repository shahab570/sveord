export interface SyncOperation {
  id: string;
  type: 'upsert_progress' | 'delete_progress' | 'upsert_word' | 'delete_word';
  data: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

export interface SyncQueueStatus {
  pending: number;
  failed: number;
  processing: boolean;
  lastProcessed?: string;
}

export class SyncQueue {
  private queue: SyncOperation[] = [];
  private processing = false;
  private listeners: ((status: SyncQueueStatus) => void)[] = [];

  constructor() {
    // Load queue from localStorage on init
    this.loadQueue();
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.processQueue());
    window.addEventListener('offline', () => this.stopProcessing());
  }

  // Add operation to queue
  add(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): string {
    const fullOperation: SyncOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 5
    };

    this.queue.push(fullOperation);
    this.saveQueue();
    this.notifyListeners();
    
    // Try to process immediately if online
    if (navigator.onLine && !this.processing) {
      this.processQueue();
    }

    return fullOperation.id;
  }

  // Process the queue
  async processQueue(): Promise<void> {
    if (this.processing || !navigator.onLine || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.notifyListeners();

    try {
      while (this.queue.length > 0 && navigator.onLine) {
        const operation = this.queue[0];
        
        try {
          await this.processOperation(operation);
          this.queue.shift(); // Remove successful operation
          this.saveQueue();
          this.notifyListeners();
        } catch (error) {
          console.error(`Operation failed (${operation.type}):`, error);
          
          operation.retryCount++;
          
          if (operation.retryCount >= operation.maxRetries) {
            // Max retries reached, move to failed
            console.error(`Max retries reached for operation ${operation.id}`);
            this.queue.shift(); // Remove failed operation
          } else {
            // Exponential backoff
            const delay = Math.pow(2, operation.retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          this.saveQueue();
          this.notifyListeners();
        }
      }
    } finally {
      this.processing = false;
      this.notifyListeners();
    }
  }

  // Process individual operation
  private async processOperation(operation: SyncOperation): Promise<void> {
    const { supabase } = await import('@/integrations/supabase/client');
    if (operation.type === 'upsert_progress' && !operation.data?.user_id) {
      throw new Error('Missing user_id for progress sync');
    }

    switch (operation.type) {
      case 'upsert_progress':
        await supabase.from('user_progress').upsert(operation.data);
        break;
        
      case 'delete_progress':
        await supabase.from('user_progress').delete().eq('id', operation.data.id);
        break;
        
      case 'upsert_word':
        await supabase.from('words').upsert(operation.data);
        break;
        
      case 'delete_word':
        await supabase.from('words').delete().eq('id', operation.data.id);
        break;
        
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  // Stop processing (when offline)
  stopProcessing(): void {
    this.processing = false;
    this.notifyListeners();
  }

  // Get queue status
  getStatus(): SyncQueueStatus {
    return {
      pending: this.queue.filter(op => op.retryCount < op.maxRetries).length,
      failed: this.queue.filter(op => op.retryCount >= op.maxRetries).length,
      processing: this.processing,
      lastProcessed: this.queue.length > 0 ? this.queue[this.queue.length - 1].timestamp : undefined
    };
  }

  // Clear failed operations
  clearFailed(): void {
    this.queue = this.queue.filter(op => op.retryCount < op.maxRetries);
    this.saveQueue();
    this.notifyListeners();
  }

  // Retry failed operations
  async retryFailed(): Promise<void> {
    this.queue.forEach(op => op.retryCount = 0);
    this.saveQueue();
    await this.processQueue();
  }

  // Subscribe to status changes
  subscribe(listener: (status: SyncQueueStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.getStatus());
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  // Save queue to localStorage
  private saveQueue(): void {
    try {
      localStorage.setItem('syncQueue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Load queue from localStorage
  private loadQueue(): void {
    try {
      const saved = localStorage.getItem('syncQueue');
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.queue = [];
    }
  }
}

// Singleton instance
export const syncQueue = new SyncQueue();
