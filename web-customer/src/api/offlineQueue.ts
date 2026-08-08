import type { ChatMessage } from '../types';

const DATABASE_NAME = 'ralabs-customer';
const STORE_NAME = 'queued-chat';
const DATABASE_VERSION = 1;

interface QueuedChatMessage {
  id: string;
  threadId: string;
  content: string;
  createdAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open offline storage.'));
  });
}

export async function queueChatMessage(threadId: string, content: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      id: crypto.randomUUID(),
      threadId,
      content,
      createdAt: new Date().toISOString(),
    } satisfies QueuedChatMessage);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to queue message.'));
  });
  database.close();
}

export async function countQueuedChatMessages(): Promise<number> {
  const database = await openDatabase();
  const count = await new Promise<number>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to read offline messages.'));
  });
  database.close();
  return count;
}

export async function flushQueuedChatMessages(
  send: (threadId: string, content: string) => Promise<ChatMessage>
): Promise<number> {
  const database = await openDatabase();
  const messages = await new Promise<QueuedChatMessage[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedChatMessage[]);
    request.onerror = () => reject(request.error ?? new Error('Unable to read offline messages.'));
  });
  database.close();

  let sent = 0;
  for (const message of messages.sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    try {
      await send(message.threadId, message.content);
      const currentDatabase = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = currentDatabase.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(message.id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Unable to remove queued message.'));
      });
      currentDatabase.close();
      sent += 1;
    } catch {
      break;
    }
  }
  return sent;
}
