// Queue Manager - Background processing queue for document processing
// Handles multiple document processing with priority and error recovery

import EventEmitter from 'events';

/**
 * Document processing queue with priority support
 * Processes documents sequentially with progress tracking
 */
export class DocumentQueueManager extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.isProcessing = false;
    this.currentItem = null;
    this.isPaused = false;
    this.retryAttempts = new Map(); // Track retry attempts per document
    this.maxRetries = 2;
  }

  /**
   * Add a document to the processing queue
   * @param {Object} item - Queue item { documentId, userId, filePath, priority }
   * @param {boolean} processImmediately - Start processing if queue is idle
   * @returns {string} Queue item ID
   */
  enqueue(item, processImmediately = true) {
    const queueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      documentId: item.documentId,
      userId: item.userId,
      filePath: item.filePath,
      priority: item.priority || 'normal', // 'high', 'normal', 'low'
      addedAt: Date.now(),
      status: 'queued'
    };

    // Insert based on priority
    if (queueItem.priority === 'high') {
      // Find first non-high priority item and insert before it
      const index = this.queue.findIndex(i => i.priority !== 'high');
      if (index === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(index, 0, queueItem);
      }
    } else if (queueItem.priority === 'low') {
      this.queue.push(queueItem);
    } else {
      // Normal priority - insert before low priority items
      const index = this.queue.findIndex(i => i.priority === 'low');
      if (index === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(index, 0, queueItem);
      }
    }

    console.log(`[QueueManager] Added document ${item.documentId} to queue. Queue length: ${this.queue.length}`);

    this.emit('queue-updated', {
      queueLength: this.queue.length,
      added: queueItem
    });

    if (processImmediately && !this.isProcessing && !this.isPaused) {
      this.processNext();
    }

    return queueItem.id;
  }

  /**
   * Add multiple documents to the queue
   * @param {Array<Object>} items - Array of queue items
   * @returns {Array<string>} Queue item IDs
   */
  enqueueBatch(items) {
    const ids = items.map((item, index) => {
      // Don't start processing until all items are added
      return this.enqueue(item, index === items.length - 1);
    });

    console.log(`[QueueManager] Batch added ${items.length} documents to queue`);

    this.emit('batch-queued', {
      count: items.length,
      queueLength: this.queue.length
    });

    return ids;
  }

  /**
   * Remove a document from the queue
   * @param {string} documentId - Document ID to remove
   * @returns {boolean} Whether item was removed
   */
  dequeue(documentId) {
    const index = this.queue.findIndex(item => item.documentId === documentId);
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0];
      console.log(`[QueueManager] Removed document ${documentId} from queue`);

      this.emit('queue-updated', {
        queueLength: this.queue.length,
        removed
      });

      return true;
    }
    return false;
  }

  /**
   * Get current queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      currentItem: this.currentItem ? {
        documentId: this.currentItem.documentId,
        startedAt: this.currentItem.startedAt
      } : null,
      queue: this.queue.map(item => ({
        documentId: item.documentId,
        priority: item.priority,
        status: item.status,
        addedAt: item.addedAt
      }))
    };
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.isPaused = true;
    console.log('[QueueManager] Queue paused');
    this.emit('queue-paused');
  }

  /**
   * Resume queue processing
   */
  resume() {
    this.isPaused = false;
    console.log('[QueueManager] Queue resumed');
    this.emit('queue-resumed');

    if (!this.isProcessing && this.queue.length > 0) {
      this.processNext();
    }
  }

  /**
   * Clear all items from the queue
   */
  clear() {
    const count = this.queue.length;
    this.queue = [];
    console.log(`[QueueManager] Queue cleared (${count} items removed)`);

    this.emit('queue-cleared', { count });
  }

  /**
   * Set the processor function for documents
   * @param {Function} processorFn - Async function that processes a document
   */
  setProcessor(processorFn) {
    this.processorFn = processorFn;
  }

  /**
   * Process the next item in the queue
   */
  async processNext() {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) {
      return;
    }

    if (!this.processorFn) {
      console.error('[QueueManager] No processor function set');
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.isProcessing = true;
    this.currentItem = {
      ...item,
      startedAt: Date.now()
    };

    console.log(`[QueueManager] Processing document ${item.documentId}`);

    this.emit('processing-started', {
      documentId: item.documentId,
      queueLength: this.queue.length
    });

    try {
      await this.processorFn(item);

      console.log(`[QueueManager] Completed document ${item.documentId}`);

      this.emit('processing-completed', {
        documentId: item.documentId,
        duration: Date.now() - this.currentItem.startedAt,
        queueLength: this.queue.length
      });

      // Clear retry count on success
      this.retryAttempts.delete(item.documentId);

    } catch (error) {
      console.error(`[QueueManager] Error processing document ${item.documentId}:`, error);

      // Check if we should retry
      const attempts = (this.retryAttempts.get(item.documentId) || 0) + 1;
      this.retryAttempts.set(item.documentId, attempts);

      if (attempts <= this.maxRetries) {
        console.log(`[QueueManager] Retrying document ${item.documentId} (attempt ${attempts}/${this.maxRetries})`);

        // Re-add to queue with a slight delay
        item.status = 'retrying';
        this.queue.unshift(item);

        this.emit('processing-retry', {
          documentId: item.documentId,
          attempt: attempts,
          maxRetries: this.maxRetries,
          error: error.message
        });
      } else {
        console.log(`[QueueManager] Document ${item.documentId} failed after ${attempts} attempts`);

        this.emit('processing-failed', {
          documentId: item.documentId,
          error: error.message,
          attempts
        });

        this.retryAttempts.delete(item.documentId);
      }
    } finally {
      this.isProcessing = false;
      this.currentItem = null;

      // Process next item if available
      if (this.queue.length > 0 && !this.isPaused) {
        // Small delay between processing to prevent overwhelming the system
        setTimeout(() => this.processNext(), 100);
      } else {
        this.emit('queue-empty');
      }
    }
  }

  /**
   * Get the position of a document in the queue
   * @param {string} documentId - Document ID
   * @returns {number} Position (0-indexed) or -1 if not found
   */
  getPosition(documentId) {
    if (this.currentItem?.documentId === documentId) {
      return 0;
    }
    const index = this.queue.findIndex(item => item.documentId === documentId);
    return index === -1 ? -1 : index + (this.currentItem ? 1 : 0);
  }
}

// Singleton instance
let queueManager = null;

/**
 * Get or create the queue manager singleton
 * @returns {DocumentQueueManager}
 */
export function getQueueManager() {
  if (!queueManager) {
    queueManager = new DocumentQueueManager();
  }
  return queueManager;
}

export default DocumentQueueManager;
